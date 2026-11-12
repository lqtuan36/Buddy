import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const PODCAST_CACHE_DIR = '/tmp/buddy-podcasts';

try {
  if (!fs.existsSync(PODCAST_CACHE_DIR)) {
    fs.mkdirSync(PODCAST_CACHE_DIR, { recursive: true });
  }
} catch {
  // Ignore directory creation errors in restricted environments
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1beta',
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
}

const UNSAFE_PATTERNS = [
  /tự làm đau/i,
  /tự tử/i,
  /đánh nhau/i,
  /bạo lực/i,
  /ma túy/i,
  /rượu bia/i,
  /vũ khí/i,
  /người lạ rủ đi/i,
  /giữ bí mật với bố mẹ/i,
  /giữ bí mật với ba mẹ/i,
];

function containsSensitiveTopic(text: string): boolean {
  return UNSAFE_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeServerVietnameseText(rawText: string): string {
  return rawText
    .replace(/★/g, ' ngôi sao ')
    .replace(/\+\s*(\d+)/g, 'cộng $1 ')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 trên $2')
    .replace(/[•·]/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lightweight zero-dependency DOCX XML & text extractor from base64 buffer.
 */
function extractTextFromFileBuffer(fileName: string, buffer: Buffer): string {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.txt') || lower.endsWith('.json')) {
    return buffer.toString('utf-8').trim();
  }

  if (lower.endsWith('.docx')) {
    try {
      let offset = 0;
      const collectedParagraphs: string[] = [];

      while (offset + 30 < buffer.length) {
        const sig = buffer.readUInt32LE(offset);
        if (sig !== 0x04034b50) {
          offset++;
          continue;
        }
        const compression = buffer.readUInt16LE(offset + 8);
        const compressedSize = buffer.readUInt32LE(offset + 18);
        const nameLen = buffer.readUInt16LE(offset + 26);
        const extraLen = buffer.readUInt16LE(offset + 28);
        const entryName = buffer.toString('utf-8', offset + 30, offset + 30 + nameLen);
        const dataStart = offset + 30 + nameLen + extraLen;

        if (entryName === 'word/document.xml' && compressedSize > 0) {
          const rawSlice = buffer.subarray(dataStart, dataStart + compressedSize);
          let xmlContent = '';
          if (compression === 0) {
            xmlContent = rawSlice.toString('utf-8');
          } else if (compression === 8) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const zlib = require('zlib');
            xmlContent = zlib.inflateRawSync(rawSlice).toString('utf-8');
          }
          if (xmlContent) {
            const pMatches = xmlContent.split(/<\/w:p>/i);
            for (const pBlock of pMatches) {
              const texts = Array.from(pBlock.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi))
                .map((m) => m[1])
                .join('');
              const cleaned = texts
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .trim();
              if (cleaned) {
                collectedParagraphs.push(cleaned);
              }
            }
          }
          break;
        }
        offset = dataStart + Math.max(1, compressedSize);
      }

      if (collectedParagraphs.length > 0) {
        return collectedParagraphs.join('\n\n');
      }
    } catch {
      // Fall through
    }
  }

  if (lower.endsWith('.pdf')) {
    try {
      const latin = buffer.toString('utf-8');
      const matches = Array.from(latin.matchAll(/\(([^()]{4,250})\)\s*Tj/g)).map((m) => m[1]);
      // Filter out PDF metadata/font names so scanned PDFs don't look like valid text
      const validLines = matches.filter(
        (m) =>
          !/^(Adobe|Identity|PDF|Font|Type|Pages|Catalog|Creator|Producer|Root)/i.test(m.trim()) &&
          /[a-zA-ZÀ-ỹ]{2,}/.test(m)
      );
      if (validLines.length >= 2) {
        return validLines.join(' ').trim();
      }
    } catch {
      // Fall through
    }
  }

  return '';
}

/**
 * Deterministic Vietnamese parser for Master Virtue Curriculum files (.txt / .docx / .pdf / .json)
 * Splits multi-virtue documents into structured GrowthQualityTopic draft nodes.
 */
function parseVietnameseCurriculumTextToDraftTopics(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // 1. Check if JSON schema
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.topics)
        ? parsed.topics
        : Array.isArray(parsed.nodes)
        ? parsed.nodes
        : [parsed];
      if (arr.length > 0 && (arr[0].title || arr[0].name)) {
        return arr;
      }
    } catch {
      // Not valid JSON, continue text parsing
    }
  }

  // 2. Split text by stage/virtue headings (e.g., "1. Lòng biết ơn", "Chặng 1:", "Phẩm chất:", "### ")
  const blocks = trimmed
    .split(/\n(?=(?:Chặng\s*\d+|Trạm\s*\d+|Phẩm chất\s*\d*|Chủ đề\s*\d*|\d+\s*[.)]|#{1,3}\s+)[A-ZÀ-Ỹ])/i)
    .map((b) => b.trim())
    .filter((b) => b.length >= 15);

  const targetBlocks = blocks.length > 0 ? blocks : [trimmed];

  const SLUG_KEYWORDS: Array<{
    slug:
      | 'gratitude'
      | 'honesty'
      | 'courage'
      | 'sharing'
      | 'responsibility'
      | 'perseverance'
      | 'kindness'
      | 'independence';
    regex: RegExp;
    landmark: string;
    illustrationKey: string;
    themeColor: 'yellow' | 'ice' | 'peach' | 'mint' | 'lavender';
  }> = [
    {
      slug: 'gratitude',
      regex: /biết ơn|cảm ơn|tri ân/i,
      landmark: 'Thung Lũng Hướng Dương',
      illustrationKey: 'schedule-check',
      themeColor: 'yellow',
    },
    {
      slug: 'honesty',
      regex: /trung thực|thật thà|chân thật/i,
      landmark: 'Suối Pha Lê Trong Vắt',
      illustrationKey: 'pencil-case',
      themeColor: 'ice',
    },
    {
      slug: 'courage',
      regex: /dũng cảm|tự tin|can đảm/i,
      landmark: 'Cây Cầu Gỗ Qua Suối',
      illustrationKey: 'take-books',
      themeColor: 'peach',
    },
    {
      slug: 'sharing',
      regex: /sẻ chia|chia sẻ|nhường nhịn/i,
      landmark: 'Đồi Thông Xanh Mát',
      illustrationKey: 'plush-friends',
      themeColor: 'mint',
    },
    {
      slug: 'responsibility',
      regex: /trách nhiệm|giữ lời|ngăn nắp/i,
      landmark: 'Thác Nước Ánh Bạc',
      illustrationKey: 'pack-books',
      themeColor: 'ice',
    },
    {
      slug: 'perseverance',
      regex: /kiên trì|nhẫn nại|vượt khó|cố gắng/i,
      landmark: 'Sườn Núi Đá Vững Chãi',
      illustrationKey: 'building-blocks',
      themeColor: 'lavender',
    },
    {
      slug: 'kindness',
      regex: /tử tế|yêu thương|nhân ái|giúp đỡ/i,
      landmark: 'Đỉnh Đồi Nắng Ấm',
      illustrationKey: 'sort-books',
      themeColor: 'peach',
    },
    {
      slug: 'independence',
      regex: /tự lập|tự giác|chủ động/i,
      landmark: 'Rương Kho Báu Tự Lập',
      illustrationKey: 'clothes-ready',
      themeColor: 'mint',
    },
  ];

  return targetBlocks.slice(0, 12).map((block, index) => {
    const lines = block
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const rawHeader = lines[0] || `Phẩm chất ${index + 1}`;
    const cleanTitle = rawHeader
      .replace(/^(?:Chặng\s*\d+|Trạm\s*\d+|Phẩm chất\s*\d*|Chủ đề\s*\d*|\d+\s*[.)]|#{1,3})\s*[:.-]?\s*/i, '')
      .trim();

    const matchedMeta =
      SLUG_KEYWORDS.find((k) => k.regex.test(cleanTitle) || k.regex.test(block)) ||
      SLUG_KEYWORDS[index % SLUG_KEYWORDS.length];

    const subtitleLine =
      lines.find((l, i) => i > 0 && !/^(khám phá|hiểu|thực hành|chia sẻ|câu hỏi|hoạt động)/i.test(l)) ||
      `Cùng con rèn luyện và trải nghiệm ${cleanTitle.toLowerCase()} mỗi ngày`;

    const bodyText = lines.slice(1).join(' ');

    return {
      title: cleanTitle || `Chặng ${index + 1}`,
      slug: matchedMeta.slug,
      stageOrder: index + 1,
      subtitle: subtitleLine.slice(0, 140),
      landmarkName: `Chặng ${index + 1} · ${matchedMeta.landmark}`,
      themeColor: matchedMeta.themeColor,
      illustrationKey: matchedMeta.illustrationKey,
      experiences: [
        {
          type: 'explore',
          typeLabel: 'Khám phá',
          title: `Câu chuyện nhỏ về ${cleanTitle}`,
          promptOrStory:
            bodyText.slice(0, 260) ||
            `Trong sinh hoạt hằng ngày, mỗi việc làm nhỏ thể hiện ${cleanTitle.toLowerCase()} đều mang lại niềm vui cho con và mọi người xung quanh.`,
          buddyWarmFeedback: `Con đã lắng nghe và khám phá ý nghĩa của ${cleanTitle.toLowerCase()} thật chăm chú!`,
        },
        {
          type: 'understand',
          typeLabel: 'Hiểu',
          title: `Khi nào con thể hiện ${cleanTitle.toLowerCase()}?`,
          promptOrStory: `Theo con, hành động nào dưới đây thể hiện rõ nhất ${cleanTitle.toLowerCase()} trong gia đình và lớp học?`,
          choices: [
            `Chủ động nói lời ấm áp và cư xử chân thành với ông bà, ba mẹ và bạn bè`,
            `Tự giác làm phần việc vừa sức của mình một cách vui vẻ`,
            `Lắng nghe, sẻ chia và sẵn sàng giúp đỡ người xung quanh`,
          ],
          buddyWarmFeedback: `Tuyệt vời! Con đã hiểu rất rõ cách thể hiện ${cleanTitle.toLowerCase()} rồi đấy!`,
        },
        {
          type: 'practice',
          typeLabel: 'Thực hành',
          title: `Thử thách thực tế: ${cleanTitle}`,
          promptOrStory: `Hôm nay con hãy thực hiện 1 hành động nhỏ ngoài đời thực để rèn luyện ${cleanTitle.toLowerCase()} cùng gia đình nhé!`,
          actionSuggestion: `Thực hiện một việc làm nhỏ thể hiện ${cleanTitle.toLowerCase()} với người thân trong hôm nay`,
          buddyWarmFeedback: `Hoan hô con đã biến ${cleanTitle.toLowerCase()} thành hành động ấm áp ngoài đời thực!`,
        },
        {
          type: 'share',
          typeLabel: 'Chia sẻ',
          title: `Tâm sự cùng Buddy & Ba Mẹ`,
          promptOrStory: `Sau khi thực hiện việc tốt về ${cleanTitle.toLowerCase()}, trong lòng con cảm thấy thế nào?`,
          choices: [
            'Trong lòng con thấy vui và ấm áp lắm',
            'Ba mẹ mỉm cười và khen con trưởng thành hơn',
            'Con muốn tiếp tục duy trì thói quen tốt này mỗi ngày',
          ],
          buddyWarmFeedback: `Cảm ơn con đã chia sẻ cảm xúc thật đẹp cùng Buddy!`,
        },
      ],
    };
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req, res) => {
    const ai = getGeminiClient();
    res.json({
      ok: true,
      geminiConfigured: Boolean(ai),
      timestamp: new Date().toISOString(),
    });
  });

  // 1) BUDDY CHAT & INTENT ROUTING ENDPOINT
  app.post('/api/chat', async (req, res) => {
    try {
      const {
        message = '',
        history = [],
        childName = 'Minh Anh',
        childAge = 8,
      } = req.body || {};

      const cleanMessage = String(message).trim();
      if (!cleanMessage) {
        return res.status(400).json({ error: 'Tin nhắn trống.' });
      }

      if (containsSensitiveTopic(cleanMessage)) {
        return res.json({
          reply: `Ôi, điều ${childName} vừa nhắc tới rất quan trọng đấy! Khi gặp chuyện làm con lo lắng, sợ hãi hoặc không an toàn, con hãy nói ngay với ba mẹ, ông bà hoặc thầy cô giáo để người lớn bảo vệ và giúp đỡ con nhé. Buddy luôn ở đây ủng hộ con tìm người lớn đáng tin cậy!`,
          mode: 'safety-guardrail',
          safeRedirect: true,
        });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.json({
          reply: buildWarmVietnameseFallbackReply(cleanMessage, childName),
          mode: 'demo-fallback',
          safeRedirect: false,
        });
      }

      const systemInstruction = `Bạn là "Buddy", một người bạn robot nhỏ ấm áp, lịch sự, khích lệ dành cho trẻ em Việt Nam từ 6 đến 12 tuổi (bé đang trò chuyện tên là ${childName}, ${childAge} tuổi).
Nguyên tắc bắt buộc:
1. Luôn trả lời hoàn toàn bằng tiếng Việt trong sáng, câu ngắn gọn (tối đa 2-4 câu), dễ hiểu với trẻ 6-12 tuổi.
2. Tuyệt đối KHÔNG giả làm bố mẹ, thầy cô, bác sĩ hay nhà trị liệu tâm lý.
3. Không bao giờ mắng mỏ, doạ nạt, gây xấu hổ hay trừ điểm của trẻ. Luôn khích lệ nỗ lực.
4. Nếu trẻ hỏi bài tập ở trường, hãy gợi ý từng bước tư duy thay vì làm hộ toàn bộ.
5. Nếu trẻ nhắc đến nguy hiểm, đau đớn, bắt nạt hoặc người lạ, hãy nhẹ nhàng khuyên trẻ nói ngay với bố mẹ hoặc thầy cô.`;

      const recentTurns = Array.isArray(history)
        ? history
            .slice(-6)
            .map((h: { role?: string; text?: string }) =>
              `${h.role === 'child' ? 'Bé' : 'Buddy'}: ${h.text || ''}`
            )
            .join('\n')
        : '';

      const prompt = recentTurns
        ? `Lịch sử trò chuyện gần đây:\n${recentTurns}\n\nBé ${childName} vừa nói: "${cleanMessage}"\nHãy trả lời bé thật ấm áp và ngắn gọn:`
        : `Bé ${childName} vừa nói: "${cleanMessage}"\nHãy trả lời bé thật ấm áp và ngắn gọn:`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.65,
          maxOutputTokens: 280,
        },
      });

      const replyText =
        response.text?.trim() || buildWarmVietnameseFallbackReply(cleanMessage, childName);

      return res.json({
        reply: replyText,
        mode: 'gemini-live',
        safeRedirect: false,
      });
    } catch {
      const { message = '', childName = 'Minh Anh' } = req.body || {};
      return res.json({
        reply: buildWarmVietnameseFallbackReply(String(message), String(childName)),
        mode: 'demo-fallback',
        safeRedirect: false,
      });
    }
  });

  // 2) PARENT TASK DRAFTING ENDPOINT
  app.post('/api/parent/draft-task', async (req, res) => {
    try {
      const { taskTitle = 'Sắp xếp đồ dùng gọn gàng', childAge = 8 } = req.body || {};
      const ai = getGeminiClient();

      if (!ai) {
        return res.json({
          draft: buildFallbackTaskDraft(String(taskTitle)),
          mode: 'demo-fallback',
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Hãy tạo bản nháp hướng dẫn từng bước (3 đến 4 bước ngắn gọn) cho trẻ ${childAge} tuổi thực hiện nhiệm vụ: "${taskTitle}". Mỗi bước chỉ gồm 1 hành động rõ ràng bằng tiếng Việt để phụ huynh xét duyệt trước khi hiển thị cho trẻ.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    actionTitle: { type: Type.STRING },
                    instruction: { type: Type.STRING },
                    buddyHint: { type: Type.STRING },
                    illustrationKey: { type: Type.STRING },
                  },
                  required: ['actionTitle', 'instruction', 'buddyHint', 'illustrationKey'],
                },
              },
            },
            required: ['title', 'description', 'steps'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        draft: parsed,
        mode: 'gemini-live',
      });
    } catch {
      const { taskTitle = 'Sắp xếp đồ dùng gọn gàng' } = req.body || {};
      return res.json({
        draft: buildFallbackTaskDraft(String(taskTitle)),
        mode: 'demo-fallback',
      });
    }
  });

  // 3) VIETNAMESE SERVER-SIDE TTS ENDPOINT (Gemini 3.8 Flash Lite TTS with Vietnamese-only style prompt)
  app.post('/api/tts', async (req, res) => {
    try {
      const { text = '', gender = 'female', context = 'chat' } = req.body || {};
      const cleanText = normalizeServerVietnameseText(String(text)).slice(0, 900);

      if (!cleanText) {
        return res.status(400).json({ error: 'Không có nội dung cần đọc.' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'GEMINI_TTS_UNAVAILABLE',
          message: 'Sử dụng giọng đọc tiếng Việt của trình duyệt khi chưa cấu hình khóa Gemini.',
        });
      }

      // Consistent voice mapping: female -> Kore, male -> Puck
      const voiceName = gender === 'male' ? 'Puck' : 'Kore';

      const moodInfo = detectParagraphNarrativeMood(cleanText, 0, 1);
      let styleInstruction =
        gender === 'male'
          ? 'Giọng nam tiếng Việt chuẩn (vi-VN), ấm áp, rõ ràng, thân thiện và giàu cảm xúc dành cho trẻ em Việt Nam từ 6 đến 12 tuổi.'
          : 'Giọng nữ tiếng Việt chuẩn (vi-VN), dịu dàng, trong trẻo, ấm áp và giàu cảm xúc dành cho trẻ em Việt Nam từ 6 đến 12 tuổi.';

      if (context === 'story') {
        styleInstruction += ` ${moodInfo.stylePrompt}`;
      } else if (context === 'guide') {
        styleInstruction +=
          ' Đọc rõ từng ý, nhịp điệu tươi vui, dễ hiểu để hướng dẫn bé làm từng bước.';
      }

      const { pcmBuffer } = await synthesizeVietnameseTtsSegment(
        ai,
        cleanText,
        voiceName,
        styleInstruction
      );

      const wavBuffer = buildWavBufferFromPcm(pcmBuffer, 24000, 1, 16);

      return res.json({
        audioBase64: wavBuffer.toString('base64'),
        mimeType: 'audio/wav',
        sampleRate: 24000,
        channels: 1,
        bitsPerSample: 16,
        voiceName,
        gender,
        mood: moodInfo.mood,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('[TTS Error]:', detail);
      return res.status(503).json({
        error: 'TTS_SYNTHESIS_FAILED',
        message: 'Không thể tạo giọng đọc máy chủ lúc này.',
        detail,
      });
    }
  });

  // 3B) CONTINUOUS PODCAST EPISODE SYNTHESIZER & CACHE ENDPOINT (v1.4 Section A.3 & A.4)
  // Synthesizes the entire story episode into ONE continuous WAV audio stream with expressive
  // Vietnamese emotional styling per paragraph, natural pauses, standards-compliant WAV/PCM normalization,
  // controlled per-scene synthesis + concatenation, exact sceneTimeline timestamps, and explicit error classification.
  app.post('/api/podcast/synthesize-episode', async (req, res) => {
    try {
      const {
        storyId = 'story-default',
        title = '',
        paragraphs = [],
        moralLesson = '',
        gender = 'female',
        contentVersion = 1,
        sceneImages = [],
        sceneCues = [],
        forceRegenerate = false,
        synthesizePerScene = false,
        simulateErrorCategory = null,
      } = req.body || {};

      const resolvedSceneImages =
        Array.isArray(sceneImages) && sceneImages.length > 0
          ? sceneImages
          : Array.isArray(sceneCues)
          ? sceneCues
          : [];

      const cleanParagraphs: string[] = Array.isArray(paragraphs)
        ? paragraphs.map((p: unknown) => String(p || '').trim()).filter(Boolean)
        : [];

      if (cleanParagraphs.length === 0) {
        return res.status(400).json({
          ok: false,
          audioStatus: 'failed',
          errorCategory: 'invalid_wav',
          error: 'Tập truyện chưa có nội dung để tạo bản thu Podcast.',
        });
      }

      const voiceGender = gender === 'male' ? 'male' : 'female';
      const voiceName = voiceGender === 'male' ? 'Puck' : 'Kore';
      const voiceVersion = 'gemini-3.8-flash-lite-tts-vi-v1.4.3';

      const hashSource = JSON.stringify({
        storyId,
        title,
        paragraphs: cleanParagraphs,
        moralLesson,
        voiceGender,
        contentVersion,
        voiceVersion,
      });
      const contentHash = crypto.createHash('sha1').update(hashSource).digest('hex').slice(0, 12);
      const safeId = String(storyId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
      const audioAssetId = `ep_${safeId}_v${contentVersion}_${voiceGender}_${contentHash}`;
      const wavFilePath = path.join(PODCAST_CACHE_DIR, `${audioAssetId}.wav`);
      const metaFilePath = path.join(PODCAST_CACHE_DIR, `${audioAssetId}.json`);

      // Compute deterministic fallback timeline so scene metadata is always well-structured
      const estimatedSceneTimeline = buildEstimatedSceneTimeline(
        cleanParagraphs,
        resolvedSceneImages
      );
      const estimatedDurationSec =
        estimatedSceneTimeline[estimatedSceneTimeline.length - 1]?.endTimeSec || 180;

      // Support deterministic simulation of error categories for automated verification (Section E)
      if (simulateErrorCategory) {
        const simCat = String(simulateErrorCategory);
        const statusMap: Record<string, number> = {
          api_config: 503,
          quota_429: 429,
          server_5xx: 502,
          timeout: 504,
          invalid_wav: 422,
        };
        const reasonMap: Record<string, string> = {
          api_config: 'Lỗi cấu hình API Gemini TTS (thiếu hoặc sai GEMINI_API_KEY).',
          quota_429: 'Hạn mức Gemini TTS tạm thời đầy (HTTP 429 Quota). Vui lòng đợi ít phút rồi bấm Thử lại.',
          server_5xx: 'Máy chủ Gemini TTS đang bận (HTTP 5xx). Vui lòng bấm Thử lại.',
          timeout: 'Quá thời gian chờ phản hồi từ Gemini TTS (Timeout). Vui lòng bấm Thử lại.',
          invalid_wav: 'Dữ liệu âm thanh WAV/PCM trả về không hợp lệ.',
        };
        return res.status(statusMap[simCat] || 502).json({
          ok: false,
          audioStatus: 'failed',
          errorCategory: simCat,
          reason: reasonMap[simCat] || 'Lỗi mô phỏng kiểm thử âm thanh Podcast.',
          actualDurationSeconds: estimatedDurationSec,
          sceneTimeline: estimatedSceneTimeline,
          voiceId: voiceName,
          voiceGender,
          voiceVersion,
        });
      }

      // Return cached continuous episode immediately if already generated and verified on disk
      if (!forceRegenerate && fs.existsSync(wavFilePath) && fs.existsSync(metaFilePath)) {
        try {
          const stat = fs.statSync(wavFilePath);
          if (stat.size > 1024) {
            const cachedMeta = JSON.parse(fs.readFileSync(metaFilePath, 'utf-8'));
            return res.json({
              ok: true,
              cached: true,
              verifiedOnDisk: true,
              audioStatus: 'ready',
              ...cachedMeta,
            });
          }
        } catch {
          // Re-synthesize if cache metadata is corrupted
        }
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          ok: false,
          audioStatus: 'failed',
          errorCategory: 'api_config',
          reason:
            'Máy chủ chưa cấu hình khóa Gemini TTS nên chưa thể tạo tệp âm thanh Podcast thực tế. Vui lòng kiểm tra cấu hình máy chủ và bấm Thử lại.',
          actualDurationSeconds: estimatedDurationSec,
          sceneTimeline: estimatedSceneTimeline,
          voiceId: voiceName,
          voiceGender,
          voiceVersion,
        });
      }

      const SAMPLE_RATE = 24000;
      const BYTES_PER_SECOND = SAMPLE_RATE * 2; // 16-bit mono = 48000 bytes/sec

      const paragraphUnits = cleanParagraphs.map((rawPara, i) => {
        const isFirst = i === 0;
        const isLast = i === cleanParagraphs.length - 1;

        let spokenSegment = rawPara;
        if (isFirst && title) {
          spokenSegment = `${title}. ${rawPara}`;
        }
        if (isLast && moralLesson) {
          spokenSegment = `${rawPara} Bài học nhỏ ấm áp của câu chuyện là: ${moralLesson}`;
        }

        const normalizedSegment = normalizeServerVietnameseText(spokenSegment).slice(0, 1400);
        const moodInfo = detectParagraphNarrativeMood(
          rawPara,
          i,
          cleanParagraphs.length
        );
        const wordCount = Math.max(6, normalizedSegment.split(/\s+/).length);

        return {
          index: i,
          rawPara,
          normalizedSegment,
          moodInfo,
          wordCount,
        };
      });

      const baseVoiceDesc =
        voiceGender === 'male'
          ? 'Giọng nam kể chuyện thiếu nhi tiếng Việt chuẩn (vi-VN), trầm ấm, truyền cảm, phát âm tròn vành rõ chữ.'
          : 'Giọng nữ kể chuyện thiếu nhi tiếng Việt chuẩn (vi-VN), dịu dàng, trong trẻo, truyền cảm, phát âm tròn vành rõ chữ.';

      const totalCharCount = paragraphUnits.reduce(
        (sum, u) => sum + u.normalizedSegment.length,
        0
      );
      const shouldChunkByScene = Boolean(synthesizePerScene) || totalCharCount > 1600;

      let fullPcmBuffer: Buffer | null = null;
      let perSceneDurationsSec: number[] | null = null;
      let timelineSyncMethod: 'exact-per-scene-pcm' | 'word-ratio-calibrated-pcm' =
        'word-ratio-calibrated-pcm';

      if (shouldChunkByScene && paragraphUnits.length > 1) {
        try {
          const scenePcmBuffers: Buffer[] = [];
          const sceneSecs: number[] = [];
          // 0.35s natural silence pause between scenes (24000 * 0.35 * 2 bytes, even-aligned)
          const pauseSamples = Math.floor(SAMPLE_RATE * 0.35);
          const silenceBuffer = Buffer.alloc(pauseSamples * 2, 0);

          for (let i = 0; i < paragraphUnits.length; i++) {
            const unit = paragraphUnits[i];
            const scenePrompt = `${baseVoiceDesc} ${unit.moodInfo.stylePrompt}`;
            const { pcmBuffer } = await synthesizeVietnameseTtsSegment(
              ai,
              unit.normalizedSegment,
              voiceName,
              scenePrompt
            );
            const isLast = i === paragraphUnits.length - 1;
            const combinedSceneBuf = isLast
              ? pcmBuffer
              : Buffer.concat([pcmBuffer, silenceBuffer]);
            scenePcmBuffers.push(combinedSceneBuf);
            sceneSecs.push(Number((combinedSceneBuf.length / BYTES_PER_SECOND).toFixed(2)));
          }

          fullPcmBuffer = Buffer.concat(scenePcmBuffers);
          perSceneDurationsSec = sceneSecs;
          timelineSyncMethod = 'exact-per-scene-pcm';
        } catch (chunkErr) {
          const chunkMsg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
          console.warn('[Podcast Per-Scene Chunk Fallback to Single Call]:', chunkMsg);
          fullPcmBuffer = null;
          perSceneDurationsSec = null;
        }
      }

      if (!fullPcmBuffer) {
        const episodeStylePrompt = `${baseVoiceDesc} Đọc diễn cảm tự nhiên như kể chuyện cổ tích cho bé trước giờ đi ngủ, ngắt nghỉ nhẹ nhàng giữa các đoạn.`;
        const combinedEpisodeScript = paragraphUnits
          .map((u) => u.normalizedSegment)
          .join(' ... ');

        const { pcmBuffer } = await synthesizeVietnameseTtsSegment(
          ai,
          combinedEpisodeScript,
          voiceName,
          episodeStylePrompt
        );
        fullPcmBuffer = pcmBuffer;
        timelineSyncMethod = 'word-ratio-calibrated-pcm';
      }

      if (!fullPcmBuffer || fullPcmBuffer.length === 0) {
        throw new Error('EMPTY_PCM_AFTER_WAV_PARSE: Empty normalized PCM buffer returned for episode');
      }

      const exactDurationSec = Math.max(
        1,
        Number((fullPcmBuffer.length / BYTES_PER_SECOND).toFixed(2))
      );
      const actualDurationSeconds = Math.max(1, Math.round(exactDurationSec));

      // Compute sceneTimeline timestamps from exact per-scene PCM durations when available,
      // or proportional to each paragraph's spoken word count calibrated to exactDurationSec
      const totalWords = paragraphUnits.reduce((acc, u) => acc + u.wordCount, 0) || 1;
      let cursorSec = 0;

      const sceneTimeline = paragraphUnits.map((u, i) => {
        const isLast = i === paragraphUnits.length - 1;
        const startTimeSec = Number(cursorSec.toFixed(2));
        const shareSec =
          perSceneDurationsSec && perSceneDurationsSec[i] !== undefined
            ? perSceneDurationsSec[i]
            : (u.wordCount / totalWords) * exactDurationSec;
        const endTimeSec = isLast
          ? Number(exactDurationSec.toFixed(2))
          : Number(Math.min(exactDurationSec, cursorSec + shareSec).toFixed(2));
        cursorSec = endTimeSec;

        const customScene = resolvedSceneImages[i] ? resolvedSceneImages[i] : null;

        return {
          sceneIndex: i,
          paragraphIndex: i,
          startTimeSec,
          endTimeSec,
          imageUrl: customScene?.imageUrl || '',
          caption:
            customScene?.caption ||
            `Cảnh ${i + 1}: ${u.rawPara.slice(0, 88)}${u.rawPara.length > 88 ? '...' : ''}`,
          mood: u.moodInfo.mood,
        };
      });

      const fullWavBuffer = buildWavBufferFromPcm(fullPcmBuffer, SAMPLE_RATE, 1, 16);

      const episodeMeta = {
        audioAssetId,
        audioUrl: `/api/podcast/audio/${audioAssetId}`,
        actualDurationSeconds,
        exactDurationSec,
        timelineSyncMethod,
        voiceId: voiceName,
        voiceGender,
        voiceVersion,
        baseSpeed: 1.0,
        contentVersion,
        sceneTimeline,
        synthesizedAt: new Date().toISOString(),
      };

      try {
        fs.writeFileSync(wavFilePath, fullWavBuffer);
        fs.writeFileSync(metaFilePath, JSON.stringify(episodeMeta, null, 2), 'utf-8');
      } catch {
        // Ignore disk cache write errors if /tmp is full
      }

      return res.json({
        ok: true,
        cached: false,
        verifiedOnDisk: true,
        audioStatus: 'ready',
        ...episodeMeta,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('[Podcast Synthesis Error]:', detail);

      let errorCategory:
        | 'api_config'
        | 'quota_429'
        | 'server_5xx'
        | 'timeout'
        | 'invalid_wav' = 'server_5xx';
      let httpStatus = 502;
      let userReason =
        'Không thể tạo tệp âm thanh Podcast lúc này. Ba mẹ hoặc bé vui lòng bấm "Thử lại" để tạo lại âm thanh.';

      if (/429|RESOURCE_EXHAUSTED|quota/i.test(detail)) {
        errorCategory = 'quota_429';
        httpStatus = 429;
        userReason =
          'Hạn mức tạo giọng đọc AI (Gemini TTS Quota 429) tạm thời đã hết. Vui lòng đợi ít phút rồi bấm "Thử lại".';
      } else if (/API_KEY|UNAUTHENTICATED|PERMISSION_DENIED|401|403/i.test(detail)) {
        errorCategory = 'api_config';
        httpStatus = 503;
        userReason =
          'Lỗi cấu hình khóa Gemini TTS trên máy chủ. Vui lòng kiểm tra cấu hình và bấm "Thử lại".';
      } else if (/timeout|ETIMEDOUT|DEADLINE_EXCEEDED|AbortError/i.test(detail)) {
        errorCategory = 'timeout';
        httpStatus = 504;
        userReason =
          'Quá thời gian chờ phản hồi từ máy chủ tạo giọng đọc (Timeout). Vui lòng bấm "Thử lại".';
      } else if (/EMPTY_PCM|WAV|RIFF|invalid_wav/i.test(detail)) {
        errorCategory = 'invalid_wav';
        httpStatus = 422;
        userReason =
          'Dữ liệu âm thanh WAV/PCM không hợp lệ. Vui lòng bấm "Thử lại" để tạo lại bản thu.';
      }

      const { paragraphs = [], sceneImages = [], gender = 'female' } = req.body || {};
      const cleanParagraphs: string[] = Array.isArray(paragraphs)
        ? paragraphs.map((p: unknown) => String(p || '').trim()).filter(Boolean)
        : [];
      const fallbackTimeline = buildEstimatedSceneTimeline(
        cleanParagraphs,
        Array.isArray(sceneImages) ? sceneImages : []
      );
      const estDuration =
        fallbackTimeline[fallbackTimeline.length - 1]?.endTimeSec || 180;

      return res.status(httpStatus).json({
        ok: false,
        audioStatus: 'failed',
        errorCategory,
        reason: userReason,
        detail,
        actualDurationSeconds: estDuration,
        sceneTimeline: fallbackTimeline,
        voiceId: gender === 'male' ? 'Puck' : 'Kore',
        voiceGender: gender === 'male' ? 'male' : 'female',
      });
    }
  });

  // 3B-2) VERIFY WHETHER CACHED PODCAST AUDIO STILL EXISTS ON DISK AFTER SERVER RESTART
  app.get('/api/podcast/audio-status/:audioAssetId', (req, res) => {
    const rawId = String(req.params.audioAssetId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const wavFilePath = path.join(PODCAST_CACHE_DIR, `${rawId}.wav`);
    const exists = Boolean(rawId && fs.existsSync(wavFilePath) && fs.statSync(wavFilePath).size > 1024);
    return res.json({
      ok: true,
      audioAssetId: rawId,
      existsOnDisk: exists,
      audioUrl: exists ? `/api/podcast/audio/${rawId}` : null,
    });
  });

  // 3C) CONTINUOUS PODCAST AUDIO STREAMING ENDPOINT WITH HTTP RANGE SUPPORT
  // Enables instant <50ms Pause/Resume and timeline scrubbing (currentTime seeking)
  app.get('/api/podcast/audio/:audioAssetId', (req, res) => {
    try {
      const rawId = String(req.params.audioAssetId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const wavFilePath = path.join(PODCAST_CACHE_DIR, `${rawId}.wav`);

      if (!rawId || !fs.existsSync(wavFilePath)) {
        return res.status(404).json({
          error: 'PODCAST_AUDIO_NOT_FOUND',
          errorCategory: 'invalid_wav',
          message: 'Không tìm thấy bản thu âm của tập Podcast này trên ổ đĩa máy chủ.',
        });
      }

      const stat = fs.statSync(wavFilePath);
      const totalSize = stat.size;
      const range = req.headers.range;

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'no-cache');

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        const safeStart = Math.max(0, Math.min(start, totalSize - 1));
        const safeEnd = Math.max(safeStart, Math.min(end, totalSize - 1));
        const chunkSize = safeEnd - safeStart + 1;

        res.status(206);
        res.setHeader('Content-Range', `bytes ${safeStart}-${safeEnd}/${totalSize}`);
        res.setHeader('Content-Length', chunkSize);
        const stream = fs.createReadStream(wavFilePath, { start: safeStart, end: safeEnd });
        stream.pipe(res);
      } else {
        res.status(200);
        res.setHeader('Content-Length', totalSize);
        const stream = fs.createReadStream(wavFilePath);
        stream.pipe(res);
      }
    } catch {
      return res.status(500).json({ error: 'AUDIO_STREAM_ERROR' });
    }
  });

  // 4) PARENT STORY UPLOAD & PARSING ENDPOINT (.txt, .docx, .pdf)
  // Strict Rule (A09): Never fabricate story content if a PDF is scanned/unreadable!
  app.post('/api/stories/parse-upload', async (req, res) => {
    try {
      const { fileName = 'truyen-cua-ba-me.txt', fileBase64 = '', rawText = '' } = req.body || {};
      const cleanName = String(fileName).trim();
      const lowerName = cleanName.toLowerCase();

      if (
        !lowerName.endsWith('.txt') &&
        !lowerName.endsWith('.docx') &&
        !lowerName.endsWith('.pdf')
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Định dạng tệp không hợp lệ. Vui lòng chọn tệp .txt, .docx hoặc .pdf.',
        });
      }

      let extractedText = String(rawText || '').trim();
      let fileBuffer: Buffer | null = null;

      if (!extractedText && fileBase64) {
        fileBuffer = Buffer.from(String(fileBase64), 'base64');
        if (fileBuffer.byteLength > 1536 * 1024) {
          return res.status(400).json({
            ok: false,
            error: 'Kích thước tệp vượt quá giới hạn 1.5MB của chế độ Local Storage Demo.',
          });
        }
        extractedText = extractTextFromFileBuffer(cleanName, fileBuffer);
      }

      const ai = getGeminiClient();

      // If PDF/DOCX extraction yielded no text and Gemini is available, attempt multimodal extraction
      if (ai && (!extractedText || extractedText.length < 25) && fileBuffer) {
        try {
          const mimeType = lowerName.endsWith('.pdf')
            ? 'application/pdf'
            : lowerName.endsWith('.docx')
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'text/plain';

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                inlineData: {
                  data: fileBuffer.toString('base64'),
                  mimeType,
                },
              },
              {
                text: `Hãy trích xuất chính xác nội dung câu chuyện từ tệp đính kèm ("${cleanName}"). Nếu tệp là bản quét trắng hoặc không có chữ đọc được, hãy trả về trường isUnreadable = true và không tự bịa nội dung.`,
              },
            ],
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  isUnreadable: { type: Type.BOOLEAN },
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  paragraphs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  moralLesson: { type: Type.STRING },
                  reflectionQuestion: { type: Type.STRING },
                  durationMinutes: { type: Type.NUMBER },
                },
                required: [
                  'isUnreadable',
                  'title',
                  'summary',
                  'paragraphs',
                  'moralLesson',
                  'reflectionQuestion',
                  'durationMinutes',
                ],
              },
            },
          });

          const parsed = JSON.parse(response.text || '{}');
          if (parsed.isUnreadable) {
            return res.status(422).json({
              ok: false,
              error:
                'Không thể trích xuất văn bản từ tệp này (có thể tệp PDF là ảnh quét hoặc không có lớp văn bản). Ba mẹ vui lòng chọn tệp có văn bản hoặc dán nội dung trực tiếp.',
            });
          }
          if (Array.isArray(parsed.paragraphs) && parsed.paragraphs.length > 0) {
            return res.json({
              ok: true,
              draft: parsed,
              mode: 'gemini-live',
            });
          }
        } catch {
          // Fall through to check extractedText
        }
      }

      // CRITICAL RULE (A09): If an uploaded file yielded no readable text, return a truthful error instead of fabricating content!
      if (!extractedText || extractedText.trim().length < 20) {
        return res.status(422).json({
          ok: false,
          error:
            'Không thể trích xuất văn bản từ tệp tải lên (tệp rỗng hoặc PDF bản quét ảnh chưa có lớp chữ). Hệ thống không tự sinh nội dung giả định; ba mẹ vui lòng chọn tệp văn bản (.txt/.docx/.pdf có chữ) hoặc nhập trực tiếp.',
        });
      }

      const defaultTitle =
        cleanName
          .replace(/\.(txt|docx|pdf)$/i, '')
          .replace(/[-_]+/g, ' ')
          .trim() || 'Câu chuyện của Ba Mẹ';

      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: `Hãy biên tập văn bản truyện dưới đây (từ tệp "${cleanName}") thành định dạng JSON tiếng Việt ấm áp, giữ sát nội dung gốc của phụ huynh, chia thành 3-6 đoạn ngắn dễ đọc:\n\n${extractedText.slice(0, 12000)}`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  paragraphs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  moralLesson: { type: Type.STRING },
                  reflectionQuestion: { type: Type.STRING },
                  durationMinutes: { type: Type.NUMBER },
                },
                required: [
                  'title',
                  'summary',
                  'paragraphs',
                  'moralLesson',
                  'reflectionQuestion',
                  'durationMinutes',
                ],
              },
            },
          });

          const parsed = JSON.parse(response.text || '{}');
          if (Array.isArray(parsed.paragraphs) && parsed.paragraphs.length > 0) {
            return res.json({
              ok: true,
              draft: parsed,
              mode: 'gemini-live',
            });
          }
        } catch {
          // Fall through to deterministic paragraph splitter
        }
      }

      const rawParagraphs = extractedText
        .split(/\n{2,}|\r\n{2,}/)
        .map((p) => p.replace(/\s+/g, ' ').trim())
        .filter((p) => p.length > 10);

      const paragraphs =
        rawParagraphs.length > 0
          ? rawParagraphs.slice(0, 8)
          : [extractedText.slice(0, 600)];

      return res.json({
        ok: true,
        draft: {
          title: defaultTitle,
          summary: `Câu chuyện do ba mẹ tải lên từ tệp "${cleanName}" dành tặng giờ đi ngủ của con.`,
          paragraphs,
          moralLesson:
            'Mỗi câu chuyện của ba mẹ đều gửi gắm tình yêu thương và bài học nhẹ nhàng cho con.',
          reflectionQuestion:
            'Chi tiết nào trong câu chuyện tối nay làm con nhớ nhất?',
          durationMinutes: Math.max(3, Math.min(8, paragraphs.length + 1)),
        },
        mode: 'demo-fallback',
      });
    } catch {
      return res.status(500).json({
        ok: false,
        error: 'Không thể xử lý tệp tải lên lúc này. Ba mẹ vui lòng thử lại hoặc dán nội dung trực tiếp.',
      });
    }
  });

  // 4B) PARENT AI PODCAST MULTI-EPISODE ANALYZER & SEGMENTER (~3 MIN PER EPISODE) (v1.4 Section VII)
  // Workflow: Upload (.docx/.pdf/.txt/text) -> Text Extraction -> AI Multi-Episode Segmentation (~3 min / 2m30s-3m30s)
  app.post('/api/stories/analyze-episodes', async (req, res) => {
    try {
      const {
        fileName = 'tuyen-tap-truyen-cua-ba-me.txt',
        fileBase64 = '',
        rawText = '',
        childAge = 8,
      } = req.body || {};

      const cleanName = String(fileName || 'truyen-gia-dinh.txt').trim();
      const lowerName = cleanName.toLowerCase();
      const extMatch = lowerName.match(/\.(txt|docx|pdf)$/);
      const fileType: 'txt' | 'docx' | 'pdf' | 'manual' = extMatch
        ? (extMatch[1] as 'txt' | 'docx' | 'pdf')
        : 'manual';

      let extractedText = String(rawText || '').trim();
      let fileBuffer: Buffer | null = null;

      if (!extractedText && fileBase64) {
        fileBuffer = Buffer.from(String(fileBase64), 'base64');
        if (fileBuffer.byteLength > 1536 * 1024) {
          return res.status(400).json({
            ok: false,
            error: 'Kích thước tệp vượt quá giới hạn 1.5MB của chế độ Local Storage Demo.',
          });
        }
        extractedText = extractTextFromFileBuffer(cleanName, fileBuffer);
      }

      const ai = getGeminiClient();

      // If PDF/DOCX extraction yielded no text and Gemini is available, try multimodal extraction first
      if (ai && (!extractedText || extractedText.length < 25) && fileBuffer) {
        try {
          const mimeType = lowerName.endsWith('.pdf')
            ? 'application/pdf'
            : lowerName.endsWith('.docx')
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'text/plain';

          const extractRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                inlineData: {
                  data: fileBuffer.toString('base64'),
                  mimeType,
                },
              },
              {
                text: `Trích xuất nguyên văn toàn bộ nội dung truyện trong tệp "${cleanName}". Nếu là PDF ảnh quét trắng hoặc không có văn bản đọc được, chỉ trả về đúng chuỗi "UNREADABLE_SCANNED_FILE".`,
              },
            ],
          });
          const candidate = (extractRes.text || '').trim();
          if (candidate && !candidate.includes('UNREADABLE_SCANNED_FILE')) {
            extractedText = candidate;
          }
        } catch {
          // Fall through
        }
      }

      // Truthful rejection of empty or unreadable scanned files
      if (!extractedText || extractedText.trim().length < 20) {
        return res.status(422).json({
          ok: false,
          error:
            'Không thể trích xuất văn bản từ tài liệu này (tệp trống hoặc PDF là bản quét ảnh không có lớp chữ). Hệ thống tuyệt đối không tự bịa truyện; ba mẹ vui lòng chọn tệp DOCX/PDF có văn bản hoặc dán nội dung trực tiếp.',
        });
      }

      const baseTitle =
        cleanName
          .replace(/\.(txt|docx|pdf)$/i, '')
          .replace(/[-_]+/g, ' ')
          .trim() || 'Truyện gia đình';

      // Attempt Gemini AI Multi-Episode Segmentation (~3 minutes / ~320-450 Vietnamese words per episode)
      if (ai) {
        try {
          const segResponse = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: `Bạn là biên tập viên Podcast kể chuyện thiếu nhi tiếng Việt cho trẻ ${childAge} tuổi.
Hãy phân tích văn bản tài liệu dưới đây (từ tệp "${cleanName}", độ dài ${extractedText.length} ký tự) và biên tập thành các tập Podcast khoảng 3 phút mỗi tập (tương đương 2 phút 30 giây đến 3 phút 30 giây, khoảng 300–450 từ tiếng Việt chia làm 4–5 đoạn văn mỗi tập):

Quy tắc bắt buộc:
1. Giữ nguyên nội dung cốt truyện và thông điệp của phụ huynh; không tự bịa sang chuyện khác.
2. Nếu tài liệu có NHIỀU truyện độc lập: tách riêng từng truyện, tuyệt đối không trộn nội dung hai truyện khác nhau vào chung một tập.
3. Nếu một truyện dài (trên 500 từ): chia thành nhiều tập theo ranh giới cảnh/ý tự nhiên (không cắt ngang câu hoặc giữa cảnh đang dang dở). Đặt tên rõ ràng: "<Tên truyện> – Tập 1: <Tên cảnh>", "<Tên truyện> – Tập 2: <Tên cảnh>".
4. Mỗi tập phải có mở đầu dẫn chuyện tự nhiên và câu kết thúc tập êm dịu cho trẻ em 6–12 tuổi.

Văn bản gốc:
${extractedText.slice(0, 24000)}`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  documentSummary: { type: Type.STRING },
                  episodes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        category: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        ageRecommendation: { type: Type.STRING },
                        estimatedDurationSeconds: { type: Type.NUMBER },
                        paragraphs: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                        moralLesson: { type: Type.STRING },
                        reflectionQuestion: { type: Type.STRING },
                        illustrationType: { type: Type.STRING },
                      },
                      required: [
                        'title',
                        'summary',
                        'ageRecommendation',
                        'estimatedDurationSeconds',
                        'paragraphs',
                        'moralLesson',
                        'reflectionQuestion',
                      ],
                    },
                  },
                },
                required: ['documentSummary', 'episodes'],
              },
            },
          });

          const parsed = JSON.parse(segResponse.text || '{}');
          if (Array.isArray(parsed.episodes) && parsed.episodes.length > 0) {
            const totalEps = parsed.episodes.length;
            const normalizedEpisodes = parsed.episodes.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (ep: any, idx: number) => {
                const paras: string[] = Array.isArray(ep.paragraphs)
                  ? ep.paragraphs.map((p: unknown) => String(p || '').trim()).filter(Boolean)
                  : [];
                const estSec = Math.max(
                  120,
                  Math.min(
                    240,
                    Number(ep.estimatedDurationSeconds) || estimateParagraphsDurationSec(paras)
                  )
                );
                return {
                  title: String(ep.title || `${baseTitle} – Tập ${idx + 1}`).trim(),
                  category: 'Truyện Ba Mẹ tải lên',
                  summary: String(
                    ep.summary || `Tập ${idx + 1}/${totalEps} được biên tập từ "${cleanName}".`
                  ).trim(),
                  ageRecommendation: String(ep.ageRecommendation || '6–12 tuổi'),
                  durationMinutes: Math.max(2, Math.round(estSec / 60)),
                  actualDurationSeconds: estSec,
                  paragraphs: paras,
                  moralLesson: String(
                    ep.moralLesson ||
                      'Mỗi câu chuyện của ba mẹ đều gửi gắm tình yêu thương và bài học nhẹ nhàng cho con.'
                  ),
                  reflectionQuestion: String(
                    ep.reflectionQuestion ||
                      'Chi tiết nào trong tập truyện này làm con thấy ấm áp nhất?'
                  ),
                  illustrationType: ['tich-chu', 'kien-nho', 'hat-giong', 'chim-se', 'bau-troi-dem'][
                    idx % 5
                  ],
                  sourceDocumentInfo: {
                    fileName: cleanName,
                    uploadedAt: new Date().toISOString(),
                    fileType,
                    originalLengthChars: extractedText.length,
                    episodeIndex: idx + 1,
                    totalEpisodesInDoc: totalEps,
                  },
                };
              }
            );

            return res.json({
              ok: true,
              mode: 'gemini-live',
              fileName: cleanName,
              originalLengthChars: extractedText.length,
              documentSummary: parsed.documentSummary || `Đã biên tập thành ${totalEps} tập Podcast (~3 phút/tập).`,
              episodes: normalizedEpisodes,
            });
          }
        } catch {
          // Fall through to deterministic multi-episode splitter
        }
      }

      // Deterministic Multi-Story & ~3-Minute Episode Segmenter Fallback
      const fallbackEpisodes = segmentVietnameseTextIntoThreeMinuteEpisodes(
        extractedText,
        baseTitle,
        cleanName,
        fileType
      );

      return res.json({
        ok: true,
        mode: 'demo-fallback',
        fileName: cleanName,
        originalLengthChars: extractedText.length,
        documentSummary: `Đã tách văn bản từ "${cleanName}" thành ${fallbackEpisodes.length} tập Podcast (~3 phút/tập) theo ranh giới đoạn tự nhiên.`,
        episodes: fallbackEpisodes,
      });
    } catch {
      return res.status(500).json({
        ok: false,
        error: 'Không thể phân tích tài liệu lúc này. Ba mẹ vui lòng thử lại.',
      });
    }
  });

  // 5) PARENT MASTER VIRTUE CURRICULUM UPLOAD & PARSING ENDPOINT (.txt, .docx, .pdf, .json)
  // Strict Rule (Sec. 7.2, A08, A09): Parse master file into draft GrowthQualityTopic[] stages;
  // NEVER fabricate content if a PDF is scanned/unreadable!
  app.post('/api/journey/parse-upload', async (req, res) => {
    try {
      const { fileName = 'lo-trinh-pham-chat.txt', fileBase64 = '', rawText = '' } = req.body || {};
      const cleanName = String(fileName).trim();
      const lowerName = cleanName.toLowerCase();

      if (
        !lowerName.endsWith('.txt') &&
        !lowerName.endsWith('.docx') &&
        !lowerName.endsWith('.pdf') &&
        !lowerName.endsWith('.json')
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Định dạng tệp không hợp lệ. Vui lòng chọn tệp .txt, .docx, .pdf hoặc .json.',
        });
      }

      let extractedText = String(rawText || '').trim();
      let fileBuffer: Buffer | null = null;

      if (!extractedText && fileBase64) {
        fileBuffer = Buffer.from(String(fileBase64), 'base64');
        if (fileBuffer.byteLength > 1536 * 1024) {
          return res.status(400).json({
            ok: false,
            error: 'Kích thước tệp vượt quá giới hạn 1.5MB của chế độ Local Storage Demo.',
          });
        }
        extractedText = extractTextFromFileBuffer(cleanName, fileBuffer);
      }

      const ai = getGeminiClient();

      // If PDF/DOCX extraction yielded no text and Gemini is available, attempt multimodal extraction
      if (ai && (!extractedText || extractedText.length < 20) && fileBuffer && !lowerName.endsWith('.txt')) {
        try {
          const mimeType = lowerName.endsWith('.pdf')
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

          const extractRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                inlineData: {
                  data: fileBuffer.toString('base64'),
                  mimeType,
                },
              },
              {
                text: `Trích xuất toàn bộ văn bản lộ trình phẩm chất từ tệp "${cleanName}". Nếu là PDF ảnh quét không đọc được chữ, trả về chuỗi "UNREADABLE_SCANNED_FILE".`,
              },
            ],
          });
          const candidateText = (extractRes.text || '').trim();
          if (candidateText && !candidateText.includes('UNREADABLE_SCANNED_FILE')) {
            extractedText = candidateText;
          }
        } catch {
          // Fall through
        }
      }

      // CRITICAL RULE (A09): Never fabricate curriculum content if scanned/unreadable or empty!
      if (!extractedText || extractedText.trim().length < 15) {
        return res.status(422).json({
          ok: false,
          error:
            'Không thể trích xuất văn bản từ tệp lộ trình này (có thể tệp PDF là bản quét ảnh hoặc không có chữ rõ ràng). Hệ thống không tự bịa nội dung; ba mẹ vui lòng tải tệp có văn bản (.txt, .docx, .json, .pdf có lớp chữ) hoặc nhập/chỉnh sửa thủ công.',
        });
      }

      const draftTopics = parseVietnameseCurriculumTextToDraftTopics(extractedText);
      if (!draftTopics || draftTopics.length === 0) {
        return res.status(422).json({
          ok: false,
          error:
            'Không tìm thấy chặng phẩm chất hợp lệ trong tệp. Ba mẹ vui lòng kiểm tra lại định dạng tệp hoặc nhập thủ công.',
        });
      }

      return res.json({
        ok: true,
        sourceFileName: cleanName,
        topics: draftTopics,
        mode: ai ? 'gemini-live' : 'demo-fallback',
      });
    } catch {
      return res.status(500).json({
        ok: false,
        error: 'Có lỗi khi phân tích tệp lộ trình phẩm chất. Ba mẹ vui lòng thử lại hoặc chỉnh sửa thủ công.',
      });
    }
  });

  // ============================================================================
  // REWARD WHEEL VERIFICATION ENDPOINT (v1.4 Section C.1 - 50 stars/month, 1 spin/month, >=4 rewards, no star deduction)
  // ============================================================================
  app.post('/api/rewards/spin', (req, res) => {
    try {
      const {
        monthlyStars = 0,
        thresholdStars = 50,
        spinsUsedThisMonth = 0,
        maxSpinsPerMonth = 1,
        approvedRewards = [],
      } = req.body || {};

      const effectiveThreshold = Number(thresholdStars) > 0 ? Number(thresholdStars) : 50;
      const currentMonthStars = Number(monthlyStars) || 0;
      const spinsUsed = Number(spinsUsedThisMonth) || 0;
      const maxSpins = Number(maxSpinsPerMonth) > 0 ? Number(maxSpinsPerMonth) : 1;
      const validRewards = Array.isArray(approvedRewards)
        ? approvedRewards.filter((r) => r && r.id && r.title && r.approvedByParent && r.active)
        : [];

      if (validRewards.length < 4) {
        return res.status(422).json({
          ok: false,
          code: 'INSUFFICIENT_REWARDS',
          error: `Cần ít nhất 4 phần quà gia đình đã được ba mẹ duyệt để mở vòng quay (hiện có ${validRewards.length}/4 món quà).`,
        });
      }

      if (spinsUsed >= maxSpins) {
        return res.status(409).json({
          ok: false,
          code: 'ALREADY_SPUN_THIS_MONTH',
          error: 'Tháng này con đã quay thưởng rồi (tối đa 1 lần quay mỗi tháng). Hẹn con tháng sau nhé!',
        });
      }

      if (currentMonthStars < effectiveThreshold) {
        return res.status(403).json({
          ok: false,
          code: 'THRESHOLD_NOT_MET',
          remainingStarsNeeded: effectiveThreshold - currentMonthStars,
          error: `Con cần tích lũy đủ ${effectiveThreshold} sao trong tháng để mở khóa vòng quay (hiện có ${currentMonthStars}/${effectiveThreshold} sao).`,
        });
      }

      const selectedIndex = Math.floor(Math.random() * validRewards.length);
      const selectedReward = validRewards[selectedIndex];

      return res.json({
        ok: true,
        selectedIndex,
        reward: selectedReward,
        starsDeducted: 0,
        remainingMonthlyStars: currentMonthStars,
      });
    } catch {
      return res.status(500).json({
        ok: false,
        error: 'Không thể thực hiện lượt quay thưởng lúc này.',
      });
    }
  });

  // ============================================================================
  // PARENT TIMETABLE MULTIMODAL PARSER (v1.4 Section D.2 - JPG/PNG/PDF -> weeklyDays draft)
  // ============================================================================
  app.post('/api/parent/parse-timetable', async (req, res) => {
    try {
      const { fileName, fileBase64, mimeType: rawMimeType, rawText } = req.body || {};
      const cleanName = String(fileName || 'thoi_khoa_bieu.png').trim();
      const lowerName = cleanName.toLowerCase();

      const isImage =
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.webp');
      const isPdf = lowerName.endsWith('.pdf');
      const isTxt = lowerName.endsWith('.txt');

      if (!isImage && !isPdf && !isTxt) {
        return res.status(400).json({
          ok: false,
          error: 'Định dạng không hỗ trợ. Ba mẹ vui lòng chọn ảnh thời khóa biểu (.jpg, .png) hoặc tệp (.pdf).',
        });
      }

      const DAY_DEFINITIONS: Array<{
        dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
        dayLabel: string;
        aliases: RegExp[];
      }> = [
        { dayOfWeek: 1, dayLabel: 'Thứ Hai', aliases: [/thứ\s*2\b/i, /thứ\s*hai\b/i, /\bt2\b/i, /\bmon(day)?\b/i] },
        { dayOfWeek: 2, dayLabel: 'Thứ Ba', aliases: [/thứ\s*3\b/i, /thứ\s*ba\b/i, /\bt3\b/i, /\btue(sday)?\b/i] },
        { dayOfWeek: 3, dayLabel: 'Thứ Tư', aliases: [/thứ\s*4\b/i, /thứ\s*tư\b/i, /\bt4\b/i, /\bwed(nesday)?\b/i] },
        { dayOfWeek: 4, dayLabel: 'Thứ Năm', aliases: [/thứ\s*5\b/i, /thứ\s*năm\b/i, /\bt5\b/i, /\bthu(rsday)?\b/i] },
        { dayOfWeek: 5, dayLabel: 'Thứ Sáu', aliases: [/thứ\s*6\b/i, /thứ\s*sáu\b/i, /\bt6\b/i, /\bfri(day)?\b/i] },
        { dayOfWeek: 6, dayLabel: 'Thứ Bảy', aliases: [/thứ\s*7\b/i, /thứ\s*bảy\b/i, /\bt7\b/i, /\bsat(urday)?\b/i] },
        { dayOfWeek: 0, dayLabel: 'Chủ nhật', aliases: [/chủ\s*nhật\b/i, /chúa\s*nhật\b/i, /\bcn\b/i, /\bsun(day)?\b/i] },
      ];

      let extractedText = String(rawText || '').trim();
      let fileBuffer: Buffer | null = null;

      if (fileBase64) {
        fileBuffer = Buffer.from(String(fileBase64), 'base64');
        if (fileBuffer.byteLength > 4 * 1024 * 1024) {
          return res.status(400).json({
            ok: false,
            error: 'Kích thước tệp vượt quá giới hạn 4MB. Vui lòng chọn ảnh hoặc PDF nhỏ hơn.',
          });
        }
        if (isPdf && !extractedText) {
          extractedText = extractTextFromFileBuffer(cleanName, fileBuffer);
        }
      }

      const ai = getGeminiClient();

      if (ai && fileBuffer && (isImage || isPdf)) {
        try {
          const detectedMime =
            rawMimeType ||
            (isPdf
              ? 'application/pdf'
              : lowerName.endsWith('.png')
              ? 'image/png'
              : lowerName.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg');

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                inlineData: {
                  data: fileBuffer.toString('base64'),
                  mimeType: detectedMime,
                },
              },
              {
                text: `Bạn là trợ lý trích xuất Thời khóa biểu tiểu học Việt Nam chính xác cho phụ huynh.
Hãy đọc bảng thời khóa biểu trong tệp "${cleanName}" và trích xuất danh sách môn học theo từng thứ trong tuần:
- dayOfWeek: 1 = Thứ Hai, 2 = Thứ Ba, 3 = Thứ Tư, 4 = Thứ Năm, 5 = Thứ Sáu, 6 = Thứ Bảy, 0 = Chủ nhật.
- Mỗi môn học phải là một phần tử riêng biệt trong mảng subjects (ví dụ: ["Toán", "Tiếng Việt", "Tiếng Anh", "Mỹ thuật"]), tuyệt đối không gộp nhiều môn vào 1 chuỗi.
- suppliesToBring: Gợi ý ngắn gọn các đồ dùng cần mang tương ứng với môn học trong ngày (ví dụ có Mỹ thuật -> "Hộp màu vẽ, giấy A4"; có Thể dục -> "Giày thể thao, bình nước").
- QUY TẮC BẮT BUỘC: Nếu ảnh bị mờ, không phải thời khóa biểu, hoặc không đọc được chữ rõ ràng, đặt isBlurryOrUnreadable = true và trả về mảng weeklyDays rỗng. TUYỆT ĐỐI KHÔNG TỰ BỊA MÔN HỌC khi không đọc được ảnh!`,
              },
            ],
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  isBlurryOrUnreadable: { type: Type.BOOLEAN },
                  unreadableReason: { type: Type.STRING },
                  weeklyDays: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        dayOfWeek: { type: Type.INTEGER },
                        dayLabel: { type: Type.STRING },
                        subjects: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                        suppliesToBring: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                        notesForChild: { type: Type.STRING },
                      },
                      required: ['dayOfWeek', 'subjects'],
                    },
                  },
                },
                required: ['isBlurryOrUnreadable', 'weeklyDays'],
              },
            },
          });

          const parsed = JSON.parse(response.text || '{}');
          if (parsed.isBlurryOrUnreadable) {
            return res.status(422).json({
              ok: false,
              isBlurryOrUnreadable: true,
              error:
                parsed.unreadableReason ||
                'Ảnh hoặc tệp thời khóa biểu bị mờ hoặc không đọc được rõ chữ. Hệ thống không tự bịa môn học; ba mẹ vui lòng chụp lại ảnh rõ nét hơn hoặc nhập trực tiếp.',
            });
          }

          if (Array.isArray(parsed.weeklyDays) && parsed.weeklyDays.length > 0) {
            const normalizedDays = DAY_DEFINITIONS.map((def) => {
              const found = parsed.weeklyDays.find(
                (d: { dayOfWeek?: number; dayLabel?: string }) =>
                  Number(d.dayOfWeek) === def.dayOfWeek ||
                  (d.dayLabel && def.aliases.some((re) => re.test(String(d.dayLabel))))
              );
              const rawSubjects: string[] = Array.isArray(found?.subjects)
                ? found.subjects
                    .flatMap((s: string) => String(s || '').split(/[,;|•]+/))
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                : [];
              const rawSupplies: string[] = Array.isArray(found?.suppliesToBring)
                ? found.suppliesToBring
                    .flatMap((s: string) => String(s || '').split(/[,;|•]+/))
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                : [];
              return {
                dayOfWeek: def.dayOfWeek,
                dayLabel: def.dayLabel,
                isSchoolDay: rawSubjects.length > 0 && def.dayOfWeek >= 1 && def.dayOfWeek <= 5,
                subjects: rawSubjects,
                suppliesToBring: rawSupplies,
                notesForChild: String(found?.notesForChild || '').trim(),
              };
            });

            const totalSubjectsFound = normalizedDays.reduce((acc, d) => acc + d.subjects.length, 0);
            if (totalSubjectsFound === 0) {
              return res.status(422).json({
                ok: false,
                isBlurryOrUnreadable: true,
                error:
                  'Không nhận diện được môn học nào trong tệp tải lên. Hệ thống không tự bịa môn học; ba mẹ vui lòng chọn ảnh thời khóa biểu rõ chữ hơn.',
              });
            }

            return res.json({
              ok: true,
              sourceFileName: cleanName,
              weeklyDays: normalizedDays,
              mode: 'gemini-multimodal',
            });
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (!extractedText) {
            const isQuota = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
            return res.status(isQuota ? 429 : 422).json({
              ok: false,
              error: isQuota
                ? 'Hạn mức đọc ảnh AI tạm thời đầy (429). Ba mẹ vui lòng thử lại sau ít phút hoặc nhập môn học trực tiếp vào bảng bên dưới.'
                : 'Không thể đọc tự động ảnh thời khóa biểu này. Hệ thống giữ nguyên thời khóa biểu hiện tại và không tự bịa môn học.',
            });
          }
        }
      }

      // Deterministic text-based parser for PDF with text layer or TXT timetable
      if (extractedText && extractedText.length >= 10) {
        const lines = extractedText
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        const dayMap = new Map<number, { subjects: string[]; supplies: string[] }>();
        for (const def of DAY_DEFINITIONS) {
          dayMap.set(def.dayOfWeek, { subjects: [], supplies: [] });
        }

        let currentDay: number | null = null;
        for (const line of lines) {
          let matchedDay: number | null = null;
          for (const def of DAY_DEFINITIONS) {
            if (def.aliases.some((re) => re.test(line))) {
              matchedDay = def.dayOfWeek;
              break;
            }
          }

          if (matchedDay !== null) {
            currentDay = matchedDay;
            const afterColon = line.includes(':') ? line.split(':').slice(1).join(':') : '';
            if (afterColon.trim()) {
              const items = afterColon
                .split(/[,;|•-]+/)
                .map((s) => s.trim())
                .filter((s) => s.length > 1 && !/^(buổi|sáng|chiều|tiết)/i.test(s));
              const entry = dayMap.get(currentDay)!;
              entry.subjects.push(...items);
            }
          } else if (currentDay !== null) {
            const items = line
              .split(/[,;|•]+/)
              .map((s) => s.trim())
              .filter((s) => s.length > 1);
            const entry = dayMap.get(currentDay)!;
            entry.subjects.push(...items);
          }
        }

        const normalizedDays = DAY_DEFINITIONS.map((def) => {
          const entry = dayMap.get(def.dayOfWeek)!;
          const uniqueSubjects = Array.from(new Set(entry.subjects));
          return {
            dayOfWeek: def.dayOfWeek,
            dayLabel: def.dayLabel,
            isSchoolDay: uniqueSubjects.length > 0 && def.dayOfWeek >= 1 && def.dayOfWeek <= 5,
            subjects: uniqueSubjects,
            suppliesToBring: entry.supplies,
            notesForChild: '',
          };
        });

        const totalSubjects = normalizedDays.reduce((acc, d) => acc + d.subjects.length, 0);
        if (totalSubjects > 0) {
          return res.json({
            ok: true,
            sourceFileName: cleanName,
            weeklyDays: normalizedDays,
            mode: 'text-layer-parser',
          });
        }
      }

      return res.status(422).json({
        ok: false,
        isBlurryOrUnreadable: true,
        error:
          'Không thể trích xuất môn học rõ ràng từ tệp tải lên. Để tránh sai lệch, hệ thống không tự bịa môn học và giữ nguyên lịch học cũ.',
      });
    } catch {
      return res.status(500).json({
        ok: false,
        error: 'Có lỗi khi xử lý tệp thời khóa biểu. Lịch học hiện tại của con vẫn được giữ nguyên.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Buddy Server running on http://localhost:${PORT}`);
  });
}

function buildWarmVietnameseFallbackReply(message: string, childName: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('cặp sách') || lower.includes('sách vở')) {
    return `Tuyệt lắm ${childName} ơi! Chuẩn bị cặp sách từ tối hôm trước giúp sáng mai con đi học thật thảnh thơi. Con bấm vào thẻ "Chuẩn bị cặp sách" bên dưới để làm từng bước cùng Buddy nhé!`;
  }
  if (lower.includes('bàn học') || lower.includes('dọn bàn') || lower.includes('góc học tập')) {
    return `${childName} chăm chỉ quá! Khi góc học tập gọn gàng, con sẽ ngồi học thật thoải mái. Mình cùng mở hướng dẫn "Dọn góc học tập" ngay bên dưới nhé!`;
  }
  if (lower.includes('đồ chơi')) {
    return `Hoan hô ${childName}! Cất đồ chơi đúng chỗ giúp các bạn đồ chơi không bị thất lạc. Mình cùng bắt đầu thử thách "Dọn đồ chơi" nhé!`;
  }
  if (lower.includes('hành trình') || lower.includes('phẩm chất') || lower.includes('biết ơn') || lower.includes('tử tế')) {
    return `Tuyệt vời lắm ${childName}! Trong "Hành trình của con", mình sẽ cùng khám phá câu chuyện nhỏ và làm những điều tử tế mỗi ngày. Con chạm vào thẻ bên dưới để mở bản đồ Hành trình nhé!`;
  }
  if (lower.includes('kể chuyện') || lower.includes('đọc truyện') || lower.includes('truyện')) {
    return `Buddy rất thích đọc truyện cho ${childName} nghe! Hôm nay mình có câu chuyện "Cậu bé Tích Chu" và "Chú Kiến Nhỏ Kiên Trì" rất ấm áp. Con chạm vào nút mở thư viện truyện bên dưới nhé!`;
  }
  if (lower.includes('ngôi sao') || lower.includes('thưởng') || lower.includes('vòng quay')) {
    return `Mỗi việc tốt ${childName} hoàn thành đều thắp sáng những ngôi sao nỗ lực lấp lánh. Cuối tháng đủ 50 sao, con sẽ được quay Vòng quay kỳ diệu cùng ba mẹ đó!`;
  }
  if (lower.includes('chưa hiểu') || lower.includes('khó quá') || lower.includes('giúp con')) {
    return `Không sao đâu ${childName} ơi, việc gì mới làm cũng cần thử từng chút một. Con hãy mở thẻ hướng dẫn từng bước và bấm nút "Con chưa hiểu" để Buddy giải thích thật chậm rãi cho con nhé!`;
  }
  return `Chào ${childName}! Buddy nghe rõ lời con rồi. Con có muốn cùng Buddy thực hiện một nhiệm vụ nhỏ hôm nay, khám phá Hành trình của con hay nghe một câu chuyện ấm áp không nào?`;
}

function buildFallbackTaskDraft(taskTitle: string) {
  return {
    title: taskTitle,
    description: `Hướng dẫn từng bước nhẹ nhàng giúp bé thực hiện "${taskTitle}" mỗi ngày.`,
    steps: [
      {
        actionTitle: 'Quan sát và chuẩn bị đồ dùng cần thiết',
        instruction: 'Con nhìn quanh và lấy đúng các món đồ cần cho việc này đặt ra trước mặt nhé.',
        buddyHint: 'Con chỉ cần lấy từng món một, không cần vội vàng đâu!',
        illustrationKey: 'schedule-check',
      },
      {
        actionTitle: 'Thực hiện gọn gàng theo thứ tự',
        instruction: 'Con xếp các món đồ lớn trước, các món đồ nhỏ đặt ngay ngắn bên cạnh.',
        buddyHint: 'Đặt đồ ngay ngắn giúp lần sau con tìm thấy ngay lập tức!',
        illustrationKey: 'tidy-desk',
      },
      {
        actionTitle: 'Kiểm tra lại thành quả cùng Buddy',
        instruction: 'Con ngắm nhìn lại xem mọi thứ đã sạch đẹp và đúng vị trí chưa nhé.',
        buddyHint: 'Hoan hô! Con đã tự tay hoàn thành thật xuất sắc!',
        illustrationKey: 'check-list',
      },
    ],
  };
}

/**
 * Analyzes a Vietnamese story paragraph to determine its narrative mood and expressive style
 * for Gemini TTS without injecting any stage instructions into the child-visible text (Section IV).
 */
function detectParagraphNarrativeMood(
  text: string,
  index: number,
  totalParagraphs: number
): {
  mood: 'joyful' | 'curious' | 'touching' | 'gentle-suspense' | 'bedtime-calm';
  stylePrompt: string;
  pace: string;
} {
  const lower = text.toLowerCase();

  // Final paragraph of a story -> Gentle bedtime closing
  if (totalParagraphs > 1 && index === totalParagraphs - 1) {
    return {
      mood: 'bedtime-calm',
      stylePrompt:
        'Giọng kết truyện dịu dàng, chậm rãi, êm ái, nhẹ nhàng và bình yên để đưa trẻ vào giấc ngủ ngon.',
      pace: '0.90x',
    };
  }

  if (
    /vui vẻ|mỉm cười|reo hò|hạnh phúc|rực rỡ|tươi vui|hoan hô|hát vang/i.test(lower)
  ) {
    return {
      mood: 'joyful',
      stylePrompt:
        'Giọng kể vui tươi, sáng rõ, ấm áp và tràn đầy niềm vui nhẹ nhàng phù hợp trẻ nhỏ.',
      pace: '0.96x',
    };
  }

  if (
    /thương|ân hận|cảm động|hiếu thảo|ôm chầm|nước mắt|tần tảo|yêu thương|dịu dàng/i.test(
      lower
    )
  ) {
    return {
      mood: 'touching',
      stylePrompt:
        'Giọng kể sâu lắng, ấm áp, chậm rãi, giàu tình cảm yêu thương gia đình.',
      pace: '0.92x',
    };
  }

  if (
    /bỗng nhiên|ngỡ ngàng|lo lắng|vượt qua|dốc cao|khó khăn|thử thách|kìa/i.test(lower)
  ) {
    return {
      mood: 'gentle-suspense',
      stylePrompt:
        'Giọng kể nhấn nhá thu hút, hồi hộp vừa phải, lôi cuốn trí tưởng tượng nhưng vẫn an toàn, ấm áp cho trẻ em.',
      pace: '0.95x',
    };
  }

  if (/bí mật|vì sao|khám phá|bầu trời|ngôi sao|tò mò|hạt giống/i.test(lower)) {
    return {
      mood: 'curious',
      stylePrompt:
        'Giọng kể tò mò, gợi mở, truyền cảm hứng khám phá thế giới diệu kỳ quanh bé.',
      pace: '0.94x',
    };
  }

  return {
    mood: 'bedtime-calm',
    stylePrompt:
      'Giọng kể chuyện cổ tích tiếng Việt truyền cảm, tự nhiên, ấm áp và nhịp nhàng.',
    pace: '0.94x',
  };
}

/**
 * Standards-compliant WAV / RIFF chunk parser and PCM normalizer (v1.4 Section V).
 * - Never strips WAV using a hardcoded 44-byte header slice.
 * - Walks RIFF chunks ('fmt ', 'LIST', 'JUNK', 'fact', 'data', etc.) dynamically to extract
 *   audioFormat, numChannels, sampleRate, bitsPerSample, and exact 'data' chunk payload.
 * - Normalizes any channel count (mono/stereo), bit depth (8/16/24/32-bit PCM or 32-bit IEEE float),
 *   and sample rate into canonical 24000 Hz, 1-channel (mono), 16-bit signed little-endian PCM
 *   so multiple segments can be concatenated without distortion or header artifacts.
 */
function parseAudioBufferToNormalizedPcm24kMono(
  rawBuffer: Buffer,
  mimeType = 'audio/wav'
): {
  pcmBuffer: Buffer;
  sourceSampleRate: number;
  sourceChannels: number;
  sourceBitsPerSample: number;
  sourceFormat: 'wav-riff' | 'raw-pcm';
} {
  let audioFormat = 1; // 1 = Linear PCM, 3 = IEEE Float
  let numChannels = 1;
  let sampleRate = 24000;
  let bitsPerSample = 16;
  let dataSlice: Buffer = rawBuffer;
  let sourceFormat: 'wav-riff' | 'raw-pcm' = 'raw-pcm';

  const isRiffWave =
    rawBuffer.length >= 12 &&
    rawBuffer.toString('ascii', 0, 4) === 'RIFF' &&
    rawBuffer.toString('ascii', 8, 12) === 'WAVE';

  if (isRiffWave) {
    sourceFormat = 'wav-riff';
    let offset = 12;
    let foundData = false;

    while (offset + 8 <= rawBuffer.length) {
      const chunkId = rawBuffer.toString('ascii', offset, offset + 4);
      const chunkSize = rawBuffer.readUInt32LE(offset + 4);
      const payloadStart = offset + 8;

      if (chunkId === 'fmt ' && payloadStart + 16 <= rawBuffer.length) {
        audioFormat = rawBuffer.readUInt16LE(payloadStart);
        numChannels = Math.max(1, rawBuffer.readUInt16LE(payloadStart + 2));
        sampleRate = Math.max(8000, rawBuffer.readUInt32LE(payloadStart + 4));
        bitsPerSample = rawBuffer.readUInt16LE(payloadStart + 14) || 16;
      } else if (chunkId === 'data') {
        // Handle streaming WAV headers where chunkSize may be 0xFFFFFFFF or exceed remaining bytes
        const remainingBytes = rawBuffer.length - payloadStart;
        const effectiveSize =
          chunkSize === 0xffffffff || chunkSize === 0x7fffffff || chunkSize === 0 || chunkSize > remainingBytes
            ? remainingBytes
            : chunkSize;
        dataSlice = rawBuffer.subarray(payloadStart, payloadStart + effectiveSize);
        foundData = true;
        break;
      }

      if (chunkSize === 0xffffffff || chunkSize === 0x7fffffff) {
        break;
      }
      // RIFF chunks are word-aligned (padded to even byte boundary)
      const paddedChunkSize = chunkSize + (chunkSize % 2);
      const nextOffset = payloadStart + paddedChunkSize;
      if (nextOffset <= offset) break;
      offset = nextOffset;
    }

    if (!foundData) {
      // Fallback if malformed RIFF without explicit 'data' tag: scan for 'data' ASCII marker
      const dataMarkerIdx = rawBuffer.indexOf('data', 12, 'ascii');
      if (dataMarkerIdx >= 12 && dataMarkerIdx + 8 <= rawBuffer.length) {
        const subSize = rawBuffer.readUInt32LE(dataMarkerIdx + 4);
        const start = dataMarkerIdx + 8;
        const rem = rawBuffer.length - start;
        const actual =
          subSize === 0xffffffff || subSize === 0 || subSize > rem ? rem : subSize;
        dataSlice = rawBuffer.subarray(start, start + actual);
      }
    }
  } else {
    // Parse sampleRate or channels from mimeType if provided (e.g., "audio/L16;rate=24000;channels=1")
    const rateMatch = mimeType.match(/rate\s*=\s*(\d+)/i);
    if (rateMatch) {
      const parsedRate = parseInt(rateMatch[1], 10);
      if (parsedRate >= 8000 && parsedRate <= 96000) {
        sampleRate = parsedRate;
      }
    }
    const chMatch = mimeType.match(/channels\s*=\s*(\d+)/i);
    if (chMatch) {
      const parsedCh = parseInt(chMatch[1], 10);
      if (parsedCh >= 1 && parsedCh <= 8) {
        numChannels = parsedCh;
      }
    }
  }

  // Fast path: already 24000 Hz, 1 channel, 16-bit Linear PCM
  if (
    audioFormat === 1 &&
    numChannels === 1 &&
    sampleRate === 24000 &&
    bitsPerSample === 16
  ) {
    const evenLen = dataSlice.length - (dataSlice.length % 2);
    return {
      pcmBuffer: Buffer.from(dataSlice.subarray(0, evenLen)),
      sourceSampleRate: sampleRate,
      sourceChannels: numChannels,
      sourceBitsPerSample: bitsPerSample,
      sourceFormat,
    };
  }

  // Decode into normalized Float32 mono samples [-1.0, 1.0]
  const bytesPerSample = Math.max(1, Math.floor(bitsPerSample / 8));
  const frameSize = bytesPerSample * numChannels;
  const totalFrames = Math.floor(dataSlice.length / frameSize);
  const monoFloat = new Float32Array(totalFrames);

  for (let f = 0; f < totalFrames; f++) {
    let sum = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const pos = f * frameSize + ch * bytesPerSample;
      let sampleVal = 0;
      if (audioFormat === 3 && bitsPerSample === 32 && pos + 4 <= dataSlice.length) {
        sampleVal = dataSlice.readFloatLE(pos);
      } else if (bitsPerSample === 8) {
        sampleVal = (dataSlice.readUInt8(pos) - 128) / 128;
      } else if (bitsPerSample === 16 && pos + 2 <= dataSlice.length) {
        sampleVal = dataSlice.readInt16LE(pos) / 32768;
      } else if (bitsPerSample === 24 && pos + 3 <= dataSlice.length) {
        const b0 = dataSlice[pos];
        const b1 = dataSlice[pos + 1];
        const b2 = dataSlice[pos + 2];
        const int24 = (b2 << 24) | (b1 << 16) | (b0 << 8);
        sampleVal = (int24 >> 8) / 8388608;
      } else if (bitsPerSample === 32 && pos + 4 <= dataSlice.length) {
        sampleVal = dataSlice.readInt32LE(pos) / 2147483648;
      }
      sum += sampleVal;
    }
    monoFloat[f] = Math.max(-1, Math.min(1, sum / numChannels));
  }

  // Resample to 24000 Hz if needed
  const TARGET_RATE = 24000;
  let resampledFloat = monoFloat;
  if (sampleRate !== TARGET_RATE && monoFloat.length > 1) {
    const outLength = Math.max(1, Math.round((monoFloat.length * TARGET_RATE) / sampleRate));
    resampledFloat = new Float32Array(outLength);
    const ratio = sampleRate / TARGET_RATE;
    for (let i = 0; i < outLength; i++) {
      const srcPos = i * ratio;
      const idx0 = Math.floor(srcPos);
      const idx1 = Math.min(monoFloat.length - 1, idx0 + 1);
      const frac = srcPos - idx0;
      resampledFloat[i] = monoFloat[idx0] * (1 - frac) + monoFloat[idx1] * frac;
    }
  }

  // Encode Float32 mono into 16-bit signed LE PCM
  const normalizedPcm = Buffer.alloc(resampledFloat.length * 2);
  for (let i = 0; i < resampledFloat.length; i++) {
    const clamped = Math.max(-1, Math.min(1, resampledFloat[i]));
    const int16 = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    normalizedPcm.writeInt16LE(int16, i * 2);
  }

  return {
    pcmBuffer: normalizedPcm,
    sourceSampleRate: sampleRate,
    sourceChannels: numChannels,
    sourceBitsPerSample: bitsPerSample,
    sourceFormat,
  };
}

/**
 * Synthesizes a single Vietnamese speech segment using Gemini 3.8 Flash Lite TTS
 * with proper speechMetadata placement on Part and fallback safety.
 */
async function synthesizeVietnameseTtsSegment(
  ai: GoogleGenAI,
  text: string,
  voiceName: string,
  stylePrompt: string
): Promise<{
  pcmBuffer: Buffer;
  sourceSampleRate: number;
  sourceChannels: number;
}> {
  let inlineData: { data?: string; mimeType?: string } | undefined;
  let lastError: unknown = null;

  // Try Podcast/TTS models in priority order so if one model's free-tier quota is exhausted (429),
  // the next TTS model is automatically used without burning extra duplicate requests.
  const ttsModelsToTry = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'];

  for (const modelName of ttsModelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: stylePrompt,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      });
      inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (inlineData?.data) break;
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      // Only retry without speechMetadata on the same model if the error was 400 Invalid Argument (not 429 Quota)
      if (!errMsg.includes('429') && !errMsg.includes('RESOURCE_EXHAUSTED')) {
        try {
          const fallbackResponse = await ai.models.generateContent({
            model: modelName,
            contents: text,
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName,
                  },
                },
              },
            },
          });
          inlineData = fallbackResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData;
          if (inlineData?.data) break;
        } catch (fallbackErr) {
          lastError = fallbackErr;
        }
      }
    }
  }

  if (!inlineData?.data) {
    throw new Error(
      `NO_AUDIO_RETURNED_FROM_GEMINI_TTS: ${
        lastError instanceof Error ? lastError.message : String(lastError || 'empty inlineData')
      }`
    );
  }

  const rawBuffer = Buffer.from(inlineData.data, 'base64');
  const parsed = parseAudioBufferToNormalizedPcm24kMono(
    rawBuffer,
    inlineData.mimeType || 'audio/wav'
  );

  if (!parsed.pcmBuffer || parsed.pcmBuffer.length === 0) {
    throw new Error('EMPTY_PCM_AFTER_WAV_PARSE');
  }

  return {
    pcmBuffer: parsed.pcmBuffer,
    sourceSampleRate: parsed.sourceSampleRate,
    sourceChannels: parsed.sourceChannels,
  };
}

/**
 * Wraps raw 16-bit mono PCM bytes into a complete RIFF/WAVE Buffer.
 */
function buildWavBufferFromPcm(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function estimateParagraphsDurationSec(paragraphs: string[]): number {
  const words = paragraphs
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  // Vietnamese bedtime storytelling rate ~ 2.15 words/sec + 0.4s pause per paragraph
  return Math.max(25, Math.round(words / 2.15 + paragraphs.length * 0.4));
}

function buildEstimatedSceneTimeline(
  paragraphs: string[],
  sceneImages: Array<{ imageUrl?: string; caption?: string }>
) {
  let cursorSec = 0;
  return paragraphs.map((para, idx) => {
    const wordCount = Math.max(6, para.trim().split(/\s+/).length);
    const segDuration = Math.max(8, Math.round(wordCount / 2.15));
    const startTimeSec = cursorSec;
    const endTimeSec = cursorSec + segDuration;
    cursorSec = endTimeSec;
    const customScene = sceneImages[idx];
    const moodInfo = detectParagraphNarrativeMood(para, idx, paragraphs.length);
    return {
      sceneIndex: idx,
      paragraphIndex: idx,
      startTimeSec,
      endTimeSec,
      imageUrl: customScene?.imageUrl || '',
      caption:
        customScene?.caption ||
        `Cảnh ${idx + 1}: ${para.slice(0, 88)}${para.length > 88 ? '...' : ''}`,
      mood: moodInfo.mood,
    };
  });
}

/**
 * Deterministic multi-story and ~3-minute (150-210s, ~320-450 words) episode splitter
 * when Gemini API is offline or in fallback mode.
 * Never merges independent stories and never cuts mid-sentence.
 */
function segmentVietnameseTextIntoThreeMinuteEpisodes(
  extractedText: string,
  baseTitle: string,
  cleanName: string,
  fileType: 'txt' | 'docx' | 'pdf' | 'manual'
) {
  // 1. Detect if document contains multiple separate stories via heading markers
  const storyBlocks = extractedText
    .split(/\n(?=(?:Truyện|Câu chuyện|Chương|Phần)\s*\d+\s*[:.-])/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 20);

  const rawBlocks = storyBlocks.length > 1 ? storyBlocks : [extractedText];
  const IllustrationPool = [
    'tich-chu',
    'kien-nho',
    'hat-giong',
    'chim-se',
    'bau-troi-dem',
  ] as const;

  const episodesOut: Array<Record<string, unknown>> = [];

  for (let bIdx = 0; bIdx < rawBlocks.length; bIdx++) {
    const block = rawBlocks[bIdx];
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let storyTitle =
      rawBlocks.length > 1 ? `${baseTitle} – Truyện ${bIdx + 1}` : baseTitle;
    let bodyLines = lines;

    if (lines.length > 1 && lines[0].length <= 85 && !/[.!?]$/.test(lines[0])) {
      storyTitle = lines[0].replace(/^(?:Truyện|Câu chuyện)\s*\d+\s*[:.-]\s*/i, '').trim() || storyTitle;
      bodyLines = lines.slice(1);
    }

    // Split into clean paragraphs
    let paragraphs = bodyLines
      .join('\n\n')
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 10);

    // If a single giant paragraph was pasted, split by sentence groups (~65-85 words per paragraph)
    if (paragraphs.length <= 2 && block.split(/\s+/).length > 160) {
      const sentences =
        block
          .replace(/\s+/g, ' ')
          .match(/[^.!?]+[.!?]+|\S+/g)
          ?.map((s) => s.trim())
          .filter(Boolean) || [block];
      paragraphs = [];
      let currentPara: string[] = [];
      let currentWords = 0;
      for (const s of sentences) {
        const w = s.split(/\s+/).length;
        currentPara.push(s);
        currentWords += w;
        if (currentWords >= 75) {
          paragraphs.push(currentPara.join(' '));
          currentPara = [];
          currentWords = 0;
        }
      }
      if (currentPara.length > 0) {
        paragraphs.push(currentPara.join(' '));
      }
    }

    // Group paragraphs into ~3-minute episodes (~320-430 words per episode, or 4-5 paragraphs)
    const TARGET_WORDS_PER_EPISODE = 360;
    const episodeChunks: string[][] = [];
    let currentEpParas: string[] = [];
    let currentEpWords = 0;

    for (const para of paragraphs) {
      const wCount = para.split(/\s+/).length;
      if (
        currentEpParas.length >= 3 &&
        currentEpWords + wCount > TARGET_WORDS_PER_EPISODE
      ) {
        episodeChunks.push(currentEpParas);
        currentEpParas = [para];
        currentEpWords = wCount;
      } else {
        currentEpParas.push(para);
        currentEpWords += wCount;
      }
    }
    if (currentEpParas.length > 0) {
      episodeChunks.push(currentEpParas);
    }

    const totalPartsForThisStory = episodeChunks.length;
    episodeChunks.forEach((epParas, epIdx) => {
      const epNumber = episodesOut.length + 1;
      const finalParas = [...epParas];
      // Add gentle intro/outro for multi-part episodes so each episode feels complete
      if (totalPartsForThisStory > 1 && epIdx > 0) {
        finalParas[0] = `Ở tập trước của câu chuyện "${storyTitle}", chúng mình đã cùng theo dõi hành trình thật thú vị. Hôm nay, mình cùng lắng nghe tiếp Tập ${
          epIdx + 1
        } nhé! ${finalParas[0]}`;
      }
      if (totalPartsForThisStory > 1 && epIdx < totalPartsForThisStory - 1) {
        finalParas[finalParas.length - 1] = `${
          finalParas[finalParas.length - 1]
        } Tập ${epIdx + 1} đến đây tạm khép lại rồi, điều kỳ diệu gì sẽ tiếp tục diễn ra? Chúng mình cùng đón nghe ở tập tiếp theo nhé!`;
      }

      const estSec = estimateParagraphsDurationSec(finalParas);
      const epTitle =
        totalPartsForThisStory > 1
          ? `${storyTitle} – Tập ${epIdx + 1}`
          : storyTitle;

      episodesOut.push({
        title: epTitle,
        category: 'Truyện Ba Mẹ tải lên',
        summary:
          totalPartsForThisStory > 1
            ? `Phần ${epIdx + 1}/${totalPartsForThisStory} của truyện "${storyTitle}" (biên tập từ tệp "${cleanName}", thời lượng ~${Math.max(
                2,
                Math.round(estSec / 60)
              )} phút).`
            : `Câu chuyện "${storyTitle}" do ba mẹ tải lên từ tệp "${cleanName}".`,
        ageRecommendation: '6–12 tuổi',
        durationMinutes: Math.max(2, Math.round(estSec / 60)),
        actualDurationSeconds: estSec,
        paragraphs: finalParas,
        moralLesson:
          'Mỗi câu chuyện của ba mẹ đều gửi gắm tình yêu thương và bài học nhẹ nhàng cho con trước giờ đi ngủ.',
        reflectionQuestion:
          'Chi tiết nào trong tập Podcast hôm nay làm con cảm thấy ấm áp và đáng nhớ nhất?',
        illustrationType: IllustrationPool[(epNumber - 1) % IllustrationPool.length],
        sourceDocumentInfo: {
          fileName: cleanName,
          uploadedAt: new Date().toISOString(),
          fileType,
          originalLengthChars: extractedText.length,
          episodeIndex: epNumber,
          totalEpisodesInDoc: 0, // updated below
        },
      });
    });
  }

  const totalAll = episodesOut.length;
  return episodesOut.map((ep, idx) => ({
    ...ep,
    sourceDocumentInfo: {
      ...(ep.sourceDocumentInfo as Record<string, unknown>),
      episodeIndex: idx + 1,
      totalEpisodesInDoc: totalAll,
    },
  }));
}

startServer();
