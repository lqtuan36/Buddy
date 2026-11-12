import { VoiceContextType, VoiceGender, VoicePreference } from '../types/domain';

export type VoiceEngineMode =
  | 'gemini-server-tts'
  | 'browser-speech-synthesis'
  | 'text-fallback';

/**
 * v1.4 UnifiedVoiceService State Machine:
 * Supports 'idle' | 'loading' | 'speaking' | 'playing' | 'paused' | 'error'
 * ('playing' is kept synchronized with 'speaking' for backward compatibility across views)
 */
export type VoicePlaybackStatus =
  | 'idle'
  | 'loading'
  | 'speaking'
  | 'playing'
  | 'paused'
  | 'error';

export interface VoicePlaybackState {
  status: VoicePlaybackStatus;
  activeEngine: VoiceEngineMode;
  activeGender: VoiceGender;
  lastSpokenText: string;
  currentUtteranceId: string | null;
  statusMessage: string;
  autoplayBlocked?: boolean;
}

export interface VoiceRuntimeCapabilities {
  geminiTtsAvailable: boolean;
  browserSpeechAvailable: boolean;
  vietnameseVoicesCount: number;
  maleVietnameseVoiceFound: boolean;
  femaleVietnameseVoiceFound: boolean;
  voiceAvailabilityNote: string;
}

type VoiceSubscriber = (
  state: VoicePlaybackState,
  capabilities: VoiceRuntimeCapabilities
) => void;

/**
 * Normalizes Vietnamese text before TTS playback so numbers, symbols, dates, and abbreviations
 * are spoken naturally in 100% Vietnamese without English symbol pronunciations.
 */
export function normalizeVietnameseTextForTts(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/★/g, ' ngôi sao ')
    .replace(/\+\s*(\d+)\s*ngôi sao/gi, 'cộng $1 ngôi sao')
    .replace(/\+\s*(\d+)/g, 'cộng $1 ')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 trên $2')
    .replace(/\bVD:/gi, 'Ví dụ:')
    .replace(/\bAI\b/g, 'ây ai')
    .replace(/[•·]/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createWavBlobFromPcm(
  pcmBytes: Uint8Array,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Blob {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBytes.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const pcmTarget = new Uint8Array(buffer, 44);
  pcmTarget.set(pcmBytes);

  return new Blob([buffer], { type: 'audio/wav' });
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

class UnifiedVoiceService {
  private audioElement: HTMLAudioElement | null = null;
  private activeObjectUrl: string | null = null;
  private currentAbortController: AbortController | null = null;
  private activeSpeechUtterance: SpeechSynthesisUtterance | null = null;
  private subscribers: Set<VoiceSubscriber> = new Set();
  private lastPref: VoicePreference | null = null;
  private lastContext: VoiceContextType = 'chat';
  private activeUtteranceToken = 0;
  private lastRequestSignature = '';
  private lastRequestTimestamp = 0;

  private state: VoicePlaybackState = {
    status: 'idle',
    activeEngine: 'browser-speech-synthesis',
    activeGender: 'female',
    lastSpokenText: '',
    currentUtteranceId: null,
    statusMessage: 'Sẵn sàng phát giọng nói của Buddy.',
    autoplayBlocked: false,
  };

  private capabilities: VoiceRuntimeCapabilities = {
    geminiTtsAvailable: false,
    browserSpeechAvailable:
      typeof window !== 'undefined' && 'speechSynthesis' in window,
    vietnameseVoicesCount: 0,
    maleVietnameseVoiceFound: false,
    femaleVietnameseVoiceFound: false,
    voiceAvailabilityNote: 'Đang kiểm tra giọng đọc tiếng Việt trên thiết bị...',
  };

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        this.inspectBrowserVoices();
        window.speechSynthesis.onvoiceschanged = () => {
          this.inspectBrowserVoices();
          this.notify();
        };
      } catch {
        // Ignore initialization errors on restricted webviews
      }
    }
  }

  public setGeminiTtsAvailable(available: boolean): void {
    this.capabilities.geminiTtsAvailable = available;
    this.updateCapabilityNote();
    this.notify();
  }

  /**
   * Live-updates volume, mute, and playbackRate on any active audio element without restarting speech.
   */
  public syncLivePreference(preference: VoicePreference): void {
    this.lastPref = preference;
    if (preference.muted || preference.volume <= 0) {
      this.cancel();
      return;
    }
    if (this.audioElement) {
      try {
        this.audioElement.volume = Math.max(0, Math.min(1, preference.volume));
        this.audioElement.playbackRate = Math.max(
          0.75,
          Math.min(1.25, preference.speechRate || 1.0)
        );
      } catch {
        // Ignore audio element live update error
      }
    }
  }

  private inspectBrowserVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.capabilities.browserSpeechAvailable = false;
      this.updateCapabilityNote();
      return;
    }

    try {
      const voices = window.speechSynthesis.getVoices() || [];
      // STRICT VIETNAMESE-ONLY VOICE FILTER (v1.4 Sec 4.1 & A02):
      // Only select voices whose lang starts with 'vi' (preferring 'vi-VN').
      const viVoices = voices.filter((v) =>
        (v.lang || '').toLowerCase().startsWith('vi')
      );

      this.capabilities.vietnameseVoicesCount = viVoices.length;
      this.capabilities.maleVietnameseVoiceFound = viVoices.some((v) =>
        /nam|male|minh|an|quang|hieu|phuc/i.test(v.name)
      );
      this.capabilities.femaleVietnameseVoiceFound = viVoices.some((v) =>
        /nu|nữ|female|linh|mai|lan|hoai|my|vy/i.test(v.name)
      );
    } catch {
      this.capabilities.vietnameseVoicesCount = 0;
    }
    this.updateCapabilityNote();
  }

  private updateCapabilityNote(): void {
    if (this.capabilities.geminiTtsAvailable) {
      this.capabilities.voiceAvailabilityNote =
        'Đang dùng Giọng AI Gemini (Hỗ trợ đầy đủ Giọng Nam & Giọng Nữ tiếng Việt tự nhiên).';
      return;
    }

    if (!this.capabilities.browserSpeechAvailable) {
      this.capabilities.voiceAvailabilityNote =
        'Thiết bị chưa có giọng đọc tiếng Việt. Buddy sẽ hiển thị lời thoại bằng chữ rõ ràng.';
      return;
    }

    if (this.capabilities.vietnameseVoicesCount === 0) {
      this.capabilities.voiceAvailabilityNote =
        'Thiết bị chưa có giọng đọc tiếng Việt. Buddy sẽ hiển thị lời thoại bằng chữ để tránh phát nhầm giọng tiếng Anh.';
      return;
    }

    if (this.capabilities.vietnameseVoicesCount >= 2) {
      this.capabilities.voiceAvailabilityNote = `Trình duyệt có ${this.capabilities.vietnameseVoicesCount} giọng đọc tiếng Việt (vi-VN) cho Giọng Nam và Giọng Nữ.`;
    } else {
      this.capabilities.voiceAvailabilityNote =
        'Trình duyệt có 1 giọng đọc tiếng Việt (vi-VN). Buddy tự động điều chỉnh âm sắc ấm áp cho Giọng Nam và trong trẻo cho Giọng Nữ.';
    }
  }

  public subscribe(fn: VoiceSubscriber): () => void {
    this.subscribers.add(fn);
    fn(this.state, this.capabilities);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notify(): void {
    for (const fn of this.subscribers) {
      fn({ ...this.state }, { ...this.capabilities });
    }
  }

  private detachAndCancelBrowserSpeech(): void {
    if (this.activeSpeechUtterance) {
      try {
        this.activeSpeechUtterance.onstart = null;
        this.activeSpeechUtterance.onend = null;
        this.activeSpeechUtterance.onerror = null;
      } catch {
        // Ignore handler detachment errors
      }
      this.activeSpeechUtterance = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser cancel errors
      }
    }
  }

  private cleanupAudioResources(): void {
    if (this.currentAbortController) {
      try {
        this.currentAbortController.abort();
      } catch {
        // Ignore abort errors
      }
      this.currentAbortController = null;
    }

    if (this.audioElement) {
      try {
        this.audioElement.onplay = null;
        this.audioElement.onended = null;
        this.audioElement.onerror = null;
        this.audioElement.pause();
        this.audioElement.removeAttribute('src');
        this.audioElement.load();
      } catch {
        // Ignore cleanup errors
      }
      this.audioElement = null;
    }

    if (this.activeObjectUrl) {
      try {
        URL.revokeObjectURL(this.activeObjectUrl);
      } catch {
        // Ignore URL revoke errors
      }
      this.activeObjectUrl = null;
    }

    this.detachAndCancelBrowserSpeech();
  }

  /**
   * Cancels any active audio or speechSynthesis playback immediately.
   * Prevents overlapping voices when switching tabs, closing modals, or tapping a new speaker button.
   */
  public cancel(): void {
    this.activeUtteranceToken += 1;
    this.cleanupAudioResources();

    if (this.state.status !== 'idle') {
      this.state = {
        ...this.state,
        status: 'idle',
        currentUtteranceId: null,
        statusMessage: 'Đã dừng phát âm thanh.',
      };
      this.notify();
    }
  }

  public stop(): void {
    this.cancel();
  }

  public pause(): void {
    if (this.audioElement && !this.audioElement.paused) {
      try {
        this.audioElement.pause();
        this.state = {
          ...this.state,
          status: 'paused',
          statusMessage: 'Đã tạm dừng giọng đọc của Buddy.',
        };
        this.notify();
        return;
      } catch {
        // Fall through
      }
    }
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      window.speechSynthesis.speaking
    ) {
      try {
        window.speechSynthesis.pause();
        this.state = {
          ...this.state,
          status: 'paused',
          statusMessage: 'Đã tạm dừng giọng đọc của Buddy.',
        };
        this.notify();
      } catch {
        // Ignore pause error
      }
    }
  }

  public resume(): void {
    if (this.audioElement && this.audioElement.paused && this.state.status === 'paused') {
      this.audioElement
        .play()
        .then(() => {
          this.state = {
            ...this.state,
            status: 'playing',
            statusMessage: 'Buddy đang tiếp tục đọc...',
          };
          this.notify();
        })
        .catch(() => {
          // Ignore resume error
        });
      return;
    }
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      window.speechSynthesis.paused
    ) {
      try {
        window.speechSynthesis.resume();
        this.state = {
          ...this.state,
          status: 'playing',
          statusMessage: 'Buddy đang tiếp tục đọc...',
        };
        this.notify();
      } catch {
        // Ignore resume error
      }
    }
  }

  public clearAutoplayBlocked(): void {
    if (this.state.autoplayBlocked) {
      this.state = {
        ...this.state,
        autoplayBlocked: false,
      };
      this.notify();
    }
  }

  public async replayLast(): Promise<void> {
    if (!this.state.lastSpokenText || !this.lastPref) return;
    await this.speak(
      this.state.lastSpokenText,
      { ...this.lastPref, muted: false },
      this.lastContext
    );
  }

  public async speak(
    text: string,
    preference: VoicePreference,
    context: VoiceContextType = 'chat',
    onEnded?: () => void
  ): Promise<{ ok: boolean; autoplayBlocked?: boolean }> {
    const cleanText = text.trim();
    if (!cleanText) return { ok: false };

    // Duplicate-request lock: if the exact same text & gender was triggered within 900ms and is already loading/playing, ignore duplicate tap/effect
    const now = Date.now();
    const signature = `${preference.gender}:${context}:${cleanText}`;
    if (
      signature === this.lastRequestSignature &&
      now - this.lastRequestTimestamp < 900 &&
      (this.state.status === 'loading' ||
        this.state.status === 'playing' ||
        this.state.status === 'speaking')
    ) {
      return { ok: true };
    }
    this.lastRequestSignature = signature;
    this.lastRequestTimestamp = now;

    this.lastPref = preference;
    this.lastContext = context;

    // 1. Always cancel any active playback before starting new utterance (Single-Source Guarantee)
    this.cleanupAudioResources();
    this.activeUtteranceToken += 1;
    const token = this.activeUtteranceToken;
    const utteranceId = `utt-${now}-${token}`;
    const normalizedText = normalizeVietnameseTextForTts(cleanText);

    if (preference.muted || preference.volume <= 0) {
      this.state = {
        status: 'idle',
        activeEngine: 'text-fallback',
        activeGender: preference.gender,
        lastSpokenText: cleanText,
        currentUtteranceId: null,
        statusMessage: 'Đang tắt âm thanh (Chế độ đọc chữ).',
        autoplayBlocked: false,
      };
      this.notify();
      return { ok: true };
    }

    // 2. Primary Path: Server-side Gemini TTS (when available & enabled)
    if (preference.preferServerTts && this.capabilities.geminiTtsAvailable) {
      this.state = {
        status: 'loading',
        activeEngine: 'gemini-server-tts',
        activeGender: preference.gender,
        lastSpokenText: cleanText,
        currentUtteranceId: utteranceId,
        statusMessage: `Đang chuẩn bị giọng ${
          preference.gender === 'male' ? 'Nam' : 'Nữ'
        } tiếng Việt của Buddy...`,
        autoplayBlocked: false,
      };
      this.notify();

      const abortController = new AbortController();
      this.currentAbortController = abortController;

      const geminiResult = await this.tryPlayGeminiServerTts(
        normalizedText,
        preference,
        context,
        token,
        utteranceId,
        abortController.signal
      );

      // If another utterance superseded this one while loading/playing, stop here and NEVER fall back to browser speech
      if (token !== this.activeUtteranceToken || geminiResult === 'superseded') {
        return { ok: false };
      }

      if (geminiResult === 'played') {
        if (token === this.activeUtteranceToken && onEnded) {
          onEnded();
        }
        return { ok: true };
      }

      // If Gemini audio already started playing and then stopped/errored mid-stream, do NOT repeat with browser SpeechSynthesis
      if (geminiResult === 'failed_after_play') {
        return { ok: false };
      }

      if (geminiResult === 'autoplay_blocked') {
        this.state = {
          status: 'idle',
          activeEngine: 'gemini-server-tts',
          activeGender: preference.gender,
          lastSpokenText: cleanText,
          currentUtteranceId: null,
          statusMessage: 'Nhấn "Chào Buddy" để bật âm thanh trên trình duyệt.',
          autoplayBlocked: true,
        };
        this.notify();
        return { ok: false, autoplayBlocked: true };
      }
    }

    // Ensure no newer utterance superseded this one before falling back to browser SpeechSynthesis
    if (token !== this.activeUtteranceToken) {
      return { ok: false };
    }

    // 3. Secondary Fallback Path: Browser SpeechSynthesis with STRICT Vietnamese-Only ('vi' / 'vi-VN') filter
    // Only reached if Gemini Server TTS is unavailable or failed BEFORE audio started playing.
    if (this.capabilities.browserSpeechAvailable) {
      const browserResult = await this.tryPlayVietnameseBrowserSpeech(
        normalizedText,
        cleanText,
        preference,
        context,
        token,
        utteranceId
      );

      if (token !== this.activeUtteranceToken || browserResult === 'superseded') {
        return { ok: false };
      }

      if (browserResult === 'played') {
        if (token === this.activeUtteranceToken && onEnded) {
          onEnded();
        }
        return { ok: true };
      }
      if (browserResult === 'autoplay_blocked') {
        this.state = {
          status: 'idle',
          activeEngine: 'browser-speech-synthesis',
          activeGender: preference.gender,
          lastSpokenText: cleanText,
          currentUtteranceId: null,
          statusMessage: 'Nhấn "Chào Buddy" để bật âm thanh tiếng Việt.',
          autoplayBlocked: true,
        };
        this.notify();
        return { ok: false, autoplayBlocked: true };
      }
    }

    // 4. Final Safe Fallback: Text-only mode (NEVER speak with English/foreign voice)
    if (token === this.activeUtteranceToken) {
      this.state = {
        status: 'idle',
        activeEngine: 'text-fallback',
        activeGender: preference.gender,
        lastSpokenText: cleanText,
        currentUtteranceId: null,
        statusMessage: 'Thiết bị chưa có giọng đọc tiếng Việt',
        autoplayBlocked: false,
      };
      this.notify();
    }
    return { ok: false };
  }

  private async tryPlayGeminiServerTts(
    normalizedText: string,
    preference: VoicePreference,
    context: VoiceContextType,
    token: number,
    utteranceId: string,
    signal: AbortSignal
  ): Promise<
    'played' | 'autoplay_blocked' | 'failed_before_play' | 'failed_after_play' | 'superseded'
  > {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: normalizedText,
          gender: preference.gender,
          context,
        }),
        signal,
      });

      if (token !== this.activeUtteranceToken) return 'superseded';
      if (!response.ok) return 'failed_before_play';

      const payload = await response.json();
      if (token !== this.activeUtteranceToken) return 'superseded';
      if (!payload?.audioBase64) return 'failed_before_play';

      const pcmBytes = base64ToUint8Array(payload.audioBase64);
      const mimeType: string = payload.mimeType || 'audio/wav';

      const isAlreadyRiffWav =
        pcmBytes.byteLength >= 12 &&
        pcmBytes[0] === 0x52 && // 'R'
        pcmBytes[1] === 0x49 && // 'I'
        pcmBytes[2] === 0x46 && // 'F'
        pcmBytes[3] === 0x46 && // 'F'
        pcmBytes[8] === 0x57 && // 'W'
        pcmBytes[9] === 0x41 && // 'A'
        pcmBytes[10] === 0x56 && // 'V'
        pcmBytes[11] === 0x45; // 'E'

      let audioBlob: Blob;
      if (isAlreadyRiffWav || mimeType.includes('wav')) {
        audioBlob = new Blob([pcmBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
      } else if (mimeType.includes('pcm') || mimeType.includes('L16')) {
        audioBlob = createWavBlobFromPcm(pcmBytes, payload.sampleRate || 24000, 1, 16);
      } else {
        audioBlob = new Blob([pcmBytes.buffer as ArrayBuffer], { type: mimeType });
      }

      if (token !== this.activeUtteranceToken) return 'superseded';

      // Never allow Web Speech API and Gemini TTS to play simultaneously
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }

      const objectUrl = URL.createObjectURL(audioBlob);
      this.activeObjectUrl = objectUrl;
      const audio = new Audio(objectUrl);
      audio.volume = Math.max(0, Math.min(1, preference.volume));
      audio.playbackRate = Math.max(0.75, Math.min(1.25, preference.speechRate || 1.0));
      this.audioElement = audio;

      let hasStartedPlaying = false;

      return await new Promise<
        'played' | 'autoplay_blocked' | 'failed_before_play' | 'failed_after_play' | 'superseded'
      >((resolve) => {
        audio.onended = () => {
          if (this.activeObjectUrl === objectUrl) {
            URL.revokeObjectURL(objectUrl);
            this.activeObjectUrl = null;
          }
          if (this.audioElement === audio) {
            this.audioElement = null;
          }
          if (token !== this.activeUtteranceToken) {
            resolve('superseded');
            return;
          }
          this.state = {
            ...this.state,
            status: 'idle',
            currentUtteranceId: null,
            statusMessage: 'Buddy đã nói xong.',
            autoplayBlocked: false,
          };
          this.notify();
          resolve('played');
        };

        audio.onerror = () => {
          if (this.activeObjectUrl === objectUrl) {
            URL.revokeObjectURL(objectUrl);
            this.activeObjectUrl = null;
          }
          if (this.audioElement === audio) {
            this.audioElement = null;
          }
          if (token !== this.activeUtteranceToken) {
            resolve('superseded');
            return;
          }
          this.state = {
            ...this.state,
            status: 'idle',
            currentUtteranceId: null,
          };
          this.notify();
          resolve(hasStartedPlaying ? 'failed_after_play' : 'failed_before_play');
        };

        audio
          .play()
          .then(() => {
            if (token !== this.activeUtteranceToken) {
              audio.pause();
              resolve('superseded');
              return;
            }
            hasStartedPlaying = true;
            this.state = {
              status: 'playing',
              activeEngine: 'gemini-server-tts',
              activeGender: preference.gender,
              lastSpokenText: this.state.lastSpokenText,
              currentUtteranceId: utteranceId,
              statusMessage: `Buddy đang nói (Giọng ${
                preference.gender === 'male' ? 'Nam' : 'Nữ'
              } AI tiếng Việt)...`,
              autoplayBlocked: false,
            };
            this.notify();
          })
          .catch((err: unknown) => {
            if (this.activeObjectUrl === objectUrl) {
              URL.revokeObjectURL(objectUrl);
              this.activeObjectUrl = null;
            }
            if (this.audioElement === audio) {
              this.audioElement = null;
            }
            if (token !== this.activeUtteranceToken) {
              resolve('superseded');
              return;
            }
            const errName = err instanceof Error ? err.name : '';
            if (errName === 'NotAllowedError') {
              resolve('autoplay_blocked');
            } else {
              resolve('failed_before_play');
            }
          });
      });
    } catch {
      if (token !== this.activeUtteranceToken || signal.aborted) {
        return 'superseded';
      }
      return 'failed_before_play';
    }
  }

  /**
   * Browser SpeechSynthesis fallback with STRICT Vietnamese-Only voice selection.
   * NEVER falls back to English ('en-US') or non-Vietnamese voices when viVoices is empty (A02).
   */
  private async tryPlayVietnameseBrowserSpeech(
    normalizedText: string,
    displayText: string,
    preference: VoicePreference,
    context: VoiceContextType,
    token: number,
    utteranceId: string
  ): Promise<'played' | 'autoplay_blocked' | 'no_vi_voice' | 'failed' | 'superseded'> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return 'no_vi_voice';
    }

    try {
      const voices = window.speechSynthesis.getVoices() || [];
      // Strictly select voices whose lang starts with 'vi', preferring 'vi-VN'
      const viVoices = voices
        .filter((v) => (v.lang || '').toLowerCase().startsWith('vi'))
        .sort((a, b) => {
          const aExact = (a.lang || '').toLowerCase() === 'vi-vn' ? 0 : 1;
          const bExact = (b.lang || '').toLowerCase() === 'vi-vn' ? 0 : 1;
          return aExact - bExact;
        });

      // CRITICAL RULE (v1.4 Sec 4.1 & A02): If the browser has NO Vietnamese voice,
      // DO NOT call speechSynthesis.speak with default English voice!
      if (viVoices.length === 0) {
        return 'no_vi_voice';
      }

      this.detachAndCancelBrowserSpeech();

      const utterance = new SpeechSynthesisUtterance(normalizedText);
      this.activeSpeechUtterance = utterance;
      utterance.lang = 'vi-VN';
      utterance.volume = Math.max(0, Math.min(1, preference.volume));

      const baseRate = context === 'story' ? 0.94 : 1.0;
      const userRate = preference.speechRate || 1.0;

      if (preference.gender === 'male') {
        const maleVoice =
          viVoices.find((v) => /nam|male|minh|an|quang|hieu/i.test(v.name)) ||
          (viVoices.length > 1 ? viVoices[1] : viVoices[0]);
        utterance.voice = maleVoice;
        utterance.pitch = 0.9;
        utterance.rate = Math.max(0.75, Math.min(1.25, baseRate * userRate * 0.97));
      } else {
        const femaleVoice =
          viVoices.find((v) => /nu|nữ|female|linh|mai|lan|hoai|my/i.test(v.name)) ||
          viVoices[0];
        utterance.voice = femaleVoice;
        utterance.pitch = 1.12;
        utterance.rate = Math.max(0.75, Math.min(1.25, baseRate * userRate));
      }

      return await new Promise<'played' | 'autoplay_blocked' | 'failed' | 'superseded'>(
        (resolve) => {
          utterance.onstart = () => {
            if (token !== this.activeUtteranceToken) {
              this.detachAndCancelBrowserSpeech();
              resolve('superseded');
              return;
            }
            this.state = {
              status: 'playing',
              activeEngine: 'browser-speech-synthesis',
              activeGender: preference.gender,
              lastSpokenText: displayText,
              currentUtteranceId: utteranceId,
              statusMessage: `Buddy đang đọc (Giọng ${
                preference.gender === 'male' ? 'Nam' : 'Nữ'
              } tiếng Việt vi-VN)...`,
              autoplayBlocked: false,
            };
            this.notify();
          };

          utterance.onend = () => {
            if (this.activeSpeechUtterance === utterance) {
              this.activeSpeechUtterance = null;
            }
            if (token !== this.activeUtteranceToken) {
              resolve('superseded');
              return;
            }
            this.state = {
              ...this.state,
              status: 'idle',
              currentUtteranceId: null,
              statusMessage: 'Buddy đã đọc xong.',
              autoplayBlocked: false,
            };
            this.notify();
            resolve('played');
          };

          utterance.onerror = (event) => {
            if (this.activeSpeechUtterance === utterance) {
              this.activeSpeechUtterance = null;
            }
            if (token !== this.activeUtteranceToken) {
              resolve('superseded');
              return;
            }
            const errCode = (event as SpeechSynthesisErrorEvent)?.error || '';
            if (errCode === 'not-allowed') {
              resolve('autoplay_blocked');
            } else {
              this.state = {
                ...this.state,
                status: 'idle',
                currentUtteranceId: null,
                statusMessage: 'Thiết bị chưa có giọng đọc tiếng Việt',
              };
              this.notify();
              resolve('failed');
            }
          };

          window.speechSynthesis.speak(utterance);
        }
      );
    } catch {
      this.activeSpeechUtterance = null;
      return 'failed';
    }
  }

  public getState(): VoicePlaybackState {
    return { ...this.state };
  }

  public getCapabilities(): VoiceRuntimeCapabilities {
    this.inspectBrowserVoices();
    return { ...this.capabilities };
  }
}

export const voiceService = new UnifiedVoiceService();
