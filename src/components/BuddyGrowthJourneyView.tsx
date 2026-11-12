import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Volume2,
  CheckCircle2,
  RotateCcw,
  Heart,
  BookOpen,
  Lightbulb,
  HandHeart,
  MessageCircleHeart,
  MapPin,
  X,
  CheckSquare,
  Square,
  Save,
  Compass,
} from 'lucide-react';
import { useBuddy } from '../context/BuddyContext';
import {
  GrowthExperienceItem,
  GrowthExperienceStatus,
  GrowthExperienceType,
  GrowthQualityTopic,
} from '../types/domain';
import { BuddyAvatar } from './BuddyAvatar';
import {
  GrowthTopicIllustration,
  VIRTUE_ADVENTURE_PARCHMENT_MAP,
} from './BuddyIllustrations';
import { voiceService } from '../services/voiceService';

const EXPERIENCE_TYPE_META: Record<
  GrowthExperienceType,
  {
    label: string;
    shortLabel: string;
    badgeBg: string;
    badgeText: string;
    cardBg: string;
    icon: React.ReactNode;
    starReward: number;
  }
> = {
  explore: {
    label: '1. Khám phá',
    shortLabel: 'Khám phá',
    badgeBg: 'bg-[#EAF3FF]',
    badgeText: 'text-[#3978F6]',
    cardBg: 'bg-[#F7F9FD]',
    icon: <BookOpen className="w-3.5 h-3.5 text-[#3978F6]" />,
    starReward: 0,
  },
  understand: {
    label: '2. Hiểu',
    shortLabel: 'Hiểu',
    badgeBg: 'bg-[#EDE7FF]',
    badgeText: 'text-[#6B3FA0]',
    cardBg: 'bg-[#FAF8FF]',
    icon: <Lightbulb className="w-3.5 h-3.5 text-[#6B3FA0]" />,
    starReward: 0,
  },
  practice: {
    label: '3. Thực hành',
    shortLabel: 'Thực hành',
    badgeBg: 'bg-[#DDF5E8]',
    badgeText: 'text-[#188050]',
    cardBg: 'bg-[#F4FBF7]',
    icon: <HandHeart className="w-3.5 h-3.5 text-[#188050]" />,
    starReward: 2,
  },
  share: {
    label: '4. Chia sẻ',
    shortLabel: 'Chia sẻ',
    badgeBg: 'bg-[#FFE4D8]',
    badgeText: 'text-[#C84B20]',
    cardBg: 'bg-[#FFF9F6]',
    icon: <MessageCircleHeart className="w-3.5 h-3.5 text-[#C84B20]" />,
    starReward: 1,
  },
};

const STATUS_META: Record<
  GrowthExperienceStatus,
  {
    label: string;
    bg: string;
    text: string;
    dot: string;
    ringColor: string;
    pinBg: string;
  }
> = {
  not_explored: {
    label: 'Chưa khám phá',
    bg: 'bg-slate-100',
    text: 'text-[#5C6F8C]',
    dot: 'bg-slate-400',
    ringColor: 'border-amber-900/25',
    pinBg: 'bg-white/95',
  },
  in_progress: {
    label: 'Đang thực hiện',
    bg: 'bg-[#EAF3FF]',
    text: 'text-[#3978F6]',
    dot: 'bg-[#3978F6]',
    ringColor: 'border-[#3978F6]',
    pinBg: 'bg-[#EAF3FF]',
  },
  experienced: {
    label: 'Đã trải nghiệm',
    bg: 'bg-[#DDF5E8]',
    text: 'text-[#188050]',
    dot: 'bg-[#2EC27E]',
    ringColor: 'border-[#2EC27E]',
    pinBg: 'bg-[#DDF5E8]',
  },
  want_to_retry: {
    label: 'Muốn thử lại',
    bg: 'bg-[#FFF0C9]',
    text: 'text-[#9A6700]',
    dot: 'bg-[#F6B73C]',
    ringColor: 'border-[#F6B73C]',
    pinBg: 'bg-[#FFF0C9]',
  },
};

const EMOTION_TAGS = [
  { id: 'vui-ve', label: 'Vui vẻ 😊' },
  { id: 'am-ap', label: 'Ấm áp 💖' },
  { id: 'tu-hao', label: 'Tự hào 🌟' },
  { id: 'hao-hung', label: 'Hào hứng 🎉' },
  { id: 'binh-tinh', label: 'Bình tĩnh 🌿' },
];

/**
 * Default percentage coordinates along the winding trail on the vintage parchment adventure map
 * (From bottom forest entry at y=88% up across the wooden bridge, waterfall, hill, to the top peak at y=19%)
 */
const DEFAULT_TRAIL_COORDS: Array<{ x: number; y: number }> = [
  { x: 46, y: 88 }, // 1. Forest Trailhead
  { x: 34, y: 76 }, // 2. Meadow Bend
  { x: 54, y: 65 }, // 3. Wooden Bridge over Stream
  { x: 64, y: 54 }, // 4. Sparkling Waterfall Bank
  { x: 38, y: 44 }, // 5. Cozy Cottage Crossroads
  { x: 62, y: 35 }, // 6. Pine Ridge Slope
  { x: 38, y: 26 }, // 7. Sunlit Mountain Bend
  { x: 52, y: 17 }, // 8. Golden Summit Gate
];

export const BuddyGrowthJourneyView: React.FC = () => {
  const {
    data,
    voiceState,
    selectedJourneyTopicId,
    setSelectedJourneyTopicId,
    updateGrowthExperienceStatus,
    openBuddyChat,
    sendChatMessage,
  } = useBuddy();

  // Only show parent-approved & selected topics to child
  const approvedTopics = (data.growthTopics || [])
    .filter((t) => t.approvalStatus === 'approved' && t.selectedByParent)
    .sort((a, b) => a.stageOrder - b.stageOrder);

  // Popup modal state: null when closed, topicId when open (preserves roadmap scroll position!)
  const [popupTopicId, setPopupTopicId] = useState<string | null>(null);
  const [showTreasureModal, setShowTreasureModal] = useState(false);
  const [mapImgError, setMapImgError] = useState(false);

  const popupTopic: GrowthQualityTopic | undefined = approvedTopics.find(
    (t) => t.id === popupTopicId
  );

  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);
  const [selectedSingleChoice, setSelectedSingleChoice] = useState<string>('');
  const [selectedMultiChoices, setSelectedMultiChoices] = useState<string[]>([]);
  const [selectedEmotionTag, setSelectedEmotionTag] = useState<string>('');
  const [realLifeChecked, setRealLifeChecked] = useState<boolean>(false);
  const [reflectionInput, setReflectionInput] = useState<string>('');
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const activeExperience: GrowthExperienceItem | undefined =
    popupTopic?.experiences.find((e) => e.id === selectedExpId) ||
    popupTopic?.experiences.find((e) => e.status !== 'experienced') ||
    popupTopic?.experiences[0];

  const isSpeaking =
    voiceState.status === 'playing' || voiceState.status === 'speaking';

  // Synchronize form fields when switching experience tab inside popup
  useEffect(() => {
    if (!activeExperience) return;
    setReflectionInput(activeExperience.childResponse || '');
    setSelectedSingleChoice(activeExperience.childResponse || '');
    setSelectedMultiChoices(activeExperience.selectedChoices || []);
    setSelectedEmotionTag(activeExperience.emotionTag || '');
    setRealLifeChecked(
      Boolean(
        activeExperience.realLifeConfirmed ||
          activeExperience.status === 'experienced'
      )
    );
    setFeedbackNotice(null);
  }, [activeExperience?.id, popupTopicId]);

  const handleOpenNodePopup = (topic: GrowthQualityTopic) => {
    setSelectedJourneyTopicId(topic.id);
    setPopupTopicId(topic.id);
    const firstUnfinished =
      topic.experiences.find((e) => e.status !== 'experienced') ||
      topic.experiences[0];
    setSelectedExpId(firstUnfinished?.id || null);
  };

  const handleCloseNodePopup = () => {
    voiceService.cancel();
    setPopupTopicId(null);
    setFeedbackNotice(null);
  };

  const handleSpeakExperience = (topic: GrowthQualityTopic, exp: GrowthExperienceItem) => {
    const choicesText =
      exp.choices && exp.choices.length > 0
        ? ` Các gợi ý cho con gồm: ${exp.choices.join('. ')}.`
        : '';
    const textToSpeak = `Chặng ${topic.stageOrder}: ${topic.title}. ${exp.typeLabel}: ${exp.title}. ${exp.promptOrStory} ${
      exp.actionSuggestion ? `Gợi ý thực hành: ${exp.actionSuggestion}.` : ''
    }${choicesText}`;
    voiceService.speak(textToSpeak, data.voicePreference, 'guide');
  };

  const handleToggleMultiChoice = (choice: string) => {
    setSelectedMultiChoices((prev) =>
      prev.includes(choice) ? prev.filter((c) => c !== choice) : [...prev, choice]
    );
  };

  const buildCombinedResponseText = (exp: GrowthExperienceItem): string => {
    const parts: string[] = [];
    if (selectedEmotionTag) {
      parts.push(`Cảm xúc: ${selectedEmotionTag}`);
    }
    if (exp.type === 'understand' && selectedSingleChoice) {
      parts.push(selectedSingleChoice);
    }
    if (selectedMultiChoices.length > 0) {
      parts.push(selectedMultiChoices.join('; '));
    }
    if (reflectionInput.trim() && reflectionInput.trim() !== selectedSingleChoice) {
      parts.push(reflectionInput.trim());
    }
    if (exp.type === 'practice' && realLifeChecked && parts.length === 0) {
      parts.push(exp.actionSuggestion || `Đã thực hành: ${exp.title}`);
    }
    return parts.join(' · ') || exp.childResponse || 'Con đã tham gia hoạt động cùng Buddy';
  };

  const handleSaveOrComplete = async (
    topic: GrowthQualityTopic,
    exp: GrowthExperienceItem,
    targetStatus: GrowthExperienceStatus
  ) => {
    const combinedNote = buildCombinedResponseText(exp);
    const res = await updateGrowthExperienceStatus(
      topic.id,
      exp.id,
      targetStatus,
      combinedNote,
      {
        selectedChoices: selectedMultiChoices,
        emotionTag: selectedEmotionTag,
        realLifeConfirmed: realLifeChecked || targetStatus === 'experienced',
      }
    );
    setFeedbackNotice(res.message);
  };

  const getTopicStatusMeta = (topic: GrowthQualityTopic) => {
    const expCount = topic.experiences.filter((e) => e.status === 'experienced').length;
    const retryCount = topic.experiences.filter((e) => e.status === 'want_to_retry').length;
    const inProgCount = topic.experiences.filter((e) => e.status === 'in_progress').length;
    if (expCount === topic.experiences.length && topic.experiences.length > 0) {
      return STATUS_META.experienced;
    }
    if (retryCount > 0 && expCount === 0 && inProgCount === 0) {
      return STATUS_META.want_to_retry;
    }
    if (expCount > 0 || inProgCount > 0 || retryCount > 0) {
      return STATUS_META.in_progress;
    }
    return STATUS_META.not_explored;
  };

  const totalExperiencedStages = approvedTopics.filter(
    (t) => t.experiences.filter((e) => e.status === 'experienced').length >= 2
  ).length;

  const totalExperiencedSteps = approvedTopics.reduce(
    (acc, t) => acc + t.experiences.filter((e) => e.status === 'experienced').length,
    0
  );

  // Compute node coordinates on the parchment adventure map with safe horizontal margins so full titles never clip
  const positionedNodes = approvedTopics.map((topic, idx) => {
    const fallback = DEFAULT_TRAIL_COORDS[idx % DEFAULT_TRAIL_COORDS.length];
    const ySpread =
      approvedTopics.length > 8
        ? Math.round(88 - (idx / Math.max(1, approvedTopics.length - 1)) * 70)
        : topic.yPercent ?? fallback.y;
    const rawX = topic.xPercent ?? fallback.x;
    const safeX = Math.max(32, Math.min(68, rawX));
    return {
      topic,
      x: safeX,
      y: ySpread,
    };
  });

  const currentFocusTopic =
    approvedTopics.find((t) => t.id === selectedJourneyTopicId) ||
    approvedTopics.find((t) => t.isCurrentFocus) ||
    approvedTopics[0];

  return (
    <div className="space-y-4 pb-6">
      {/* 1. Compact Journey Header & Buddy Guide Bar */}
      <div className="rounded-[26px] bg-white border border-[#23324D]/8 p-4 shadow-[0_8px_24px_rgba(35,50,77,0.06)] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF0C9] text-[#7A4F00] text-[11px] font-kids font-extrabold">
              <Compass className="w-3.5 h-3.5 text-amber-600" />
              <span>Bản đồ phiêu lưu phẩm chất</span>
            </span>
            <h1 className="font-kids font-extrabold text-xl sm:text-2xl text-[#23324D] mt-1">
              Hành trình của {data.profile.displayName}
            </h1>
          </div>

          <div className="text-right shrink-0">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-2xl bg-[#DDF5E8] text-[#188050] font-kids font-extrabold text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{totalExperiencedSteps} dấu ấn</span>
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2.5 bg-[#F7F9FD] rounded-[18px] p-2.5 border border-[#23324D]/6">
          <div className="flex items-center gap-2.5 min-w-0">
            <BuddyAvatar size="xs" isSpeaking={isSpeaking} mood="happy" />
            <p className="font-kids text-xs sm:text-sm font-bold text-[#23324D] leading-snug">
              Chạm vào từng trạm trên bản đồ kho báu bên dưới để mở câu chuyện, trả lời câu hỏi và thực hành việc tốt nhé!
            </p>
          </div>
          {currentFocusTopic && (
            <button
              type="button"
              onClick={() => handleOpenNodePopup(currentFocusTopic)}
              className="shrink-0 px-3.5 py-2 rounded-[18px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-xs transition-colors cursor-pointer"
            >
              Mở chặng {currentFocusTopic.stageOrder}
            </button>
          )}
        </div>
      </div>

      {/* 2. Illustrated Vintage Parchment Adventure Roadmap (Sec. 7.1 & A06) */}
      <section
        aria-label="Bản đồ phiêu lưu phẩm chất"
        className="rounded-[30px] bg-[#F5E6C8] border-2 border-[#C8A97E] shadow-[0_14px_36px_rgba(92,64,28,0.16)] overflow-hidden relative"
      >
        {/* Top Parchment Legend Bar (100% Vietnamese) */}
        <div className="bg-[#FDF6E7]/95 backdrop-blur-xs border-b border-[#C8A97E]/50 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 z-20 relative">
          <span className="font-kids font-extrabold text-xs sm:text-sm text-[#4A3520] flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#D97706]" />
            <span>Đường mòn Khám Phá ({approvedTopics.length} chặng)</span>
          </span>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-kids font-extrabold">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#DDF5E8] text-[#188050]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2EC27E]" />
              Đã trải nghiệm
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EAF3FF] text-[#3978F6]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3978F6]" />
              Đang thực hiện
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[#5C6F8C]">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Chưa khám phá
            </span>
          </div>
        </div>

        {/* Scrollable / Responsive Adventure Map Canvas */}
        <div className="relative w-full h-[840px] sm:h-[900px] md:h-[940px] select-none overflow-hidden bg-gradient-to-b from-[#FAF0D7] via-[#E8F3D8] to-[#DCECC9]">
          {/* Background Illustrated Parchment Map (Zero foreign text) */}
          {!mapImgError ? (
            <img
              src={VIRTUE_ADVENTURE_PARCHMENT_MAP}
              alt="Bản đồ phiêu lưu Hành trình của con"
              loading="eager"
              decoding="async"
              onError={() => setMapImgError(true)}
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-[#FDF3DC] via-[#DDF5E8] to-[#C7E9B4]" />
          )}

          {/* Subtle warm vignette for high contrast of Vietnamese node cards */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#23324D]/10 via-transparent to-[#23324D]/20 pointer-events-none" />

          {/* SVG Winding Trail Connecting All Checkpoints & Treasure Chest */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
          >
            {positionedNodes.map((node, i) => {
              const next =
                i < positionedNodes.length - 1
                  ? positionedNodes[i + 1]
                  : { x: 50, y: 7 };
              const isCompleted =
                node.topic.experiences.filter((e) => e.status === 'experienced')
                  .length === node.topic.experiences.length;
              return (
                <line
                  key={`line-${node.topic.id}`}
                  x1={node.x}
                  y1={node.y}
                  x2={next.x}
                  y2={next.y}
                  stroke={isCompleted ? '#2EC27E' : '#FFFFFF'}
                  strokeWidth="0.9"
                  strokeDasharray={isCompleted ? 'none' : '1.8 1.4'}
                  strokeLinecap="round"
                  opacity="0.92"
                />
              );
            })}
          </svg>

          {/* Destination: Glowing Treasure Chest at the Summit (y = 7%) */}
          <div
            style={{ left: '50%', top: '6.5%' }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
          >
            <button
              type="button"
              onClick={() => setShowTreasureModal(true)}
              className="group px-3.5 py-2 rounded-[18px] bg-gradient-to-r from-[#FFF0C9] via-[#FFE082] to-[#FFF0C9] border-2 border-amber-500 shadow-[0_8px_22px_rgba(217,119,6,0.38)] hover:scale-105 transition-all cursor-pointer flex items-center gap-2"
            >
              <span className="text-lg">🏆</span>
              <div className="text-left">
                <span className="block font-kids font-extrabold text-xs sm:text-sm text-[#6B3E00] leading-none">
                  Rương Kho Báu Phẩm Chất
                </span>
                <span className="block text-[10px] font-bold text-[#8A5A00] mt-0.5">
                  Đã mở {totalExperiencedStages}/{approvedTopics.length} chặng · Chạm để xem
                </span>
              </div>
            </button>
          </div>

          {/* Interactive JourneyNode Checkpoints along the Trail — FULL TITLES NEVER TRUNCATED */}
          {positionedNodes.map(({ topic, x, y }) => {
            const statusMeta = getTopicStatusMeta(topic);
            const experiencedCount = topic.experiences.filter(
              (e) => e.status === 'experienced'
            ).length;
            const isFocus = Boolean(topic.isCurrentFocus);

            return (
              <div
                key={topic.id}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
              >
                <button
                  type="button"
                  onClick={() => handleOpenNodePopup(topic)}
                  className={`group relative flex items-center gap-2.5 p-2 pr-3.5 rounded-[22px] border-2 ${statusMeta.ringColor} bg-white/96 hover:bg-white shadow-[0_8px_22px_rgba(35,50,77,0.22)] hover:scale-105 active:scale-95 transition-all cursor-pointer min-w-[186px] max-w-[235px] sm:max-w-[275px]`}
                  aria-label={`Mở chặng ${topic.stageOrder}: ${topic.title}`}
                >
                  {/* Focus Pulse Badge */}
                  {isFocus && (
                    <span className="absolute -top-2.5 left-3 px-2 py-0.5 rounded-full bg-[#3978F6] text-white font-kids font-extrabold text-[9px] shadow-2xs whitespace-nowrap">
                      Đang học tuần này
                    </span>
                  )}

                  {/* Circular Checkpoint Pin with Stage Number & Warm Storybook Illustration */}
                  <div className="relative w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#F7F9FD] border-2 border-white shadow-xs flex items-center justify-center shrink-0 overflow-hidden">
                    <GrowthTopicIllustration
                      slug={topic.slug}
                      className="w-full h-full rounded-full"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#23324D] text-white font-kids font-extrabold text-[10px] flex items-center justify-center border border-white">
                      {topic.stageOrder}
                    </span>
                  </div>

                  {/* Full Vietnamese Title (No Truncate!) & 4-Step Progress Badge */}
                  <div className="text-left min-w-0 flex-1">
                    <p className="font-kids font-extrabold text-xs sm:text-sm text-[#23324D] leading-snug whitespace-normal break-words">
                      {topic.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-kids font-extrabold ${statusMeta.bg} ${statusMeta.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                        {statusMeta.label}
                      </span>
                      <span className="text-[10px] font-kids font-extrabold text-[#5C6F8C] tabular-nums">
                        {experiencedCount}/{topic.experiences.length}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}

          {/* Bottom Start Banner on Map */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-[#23324D]/90 text-white font-kids font-extrabold text-[11px] shadow-md whitespace-nowrap">
            🚩 Điểm xuất phát: Rừng Thông Ánh Sáng · Chạm trạm số 1 để bắt đầu
          </div>
        </div>
      </section>

      {/* 3. Warm Storybook Stage Cards Grid (Full Virtue Names + Warm Storybook Scene Illustrations) */}
      <section className="bg-white rounded-[26px] p-4 shadow-[0_8px_24px_rgba(35,50,77,0.06)] border border-[#23324D]/8 space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-kids font-extrabold text-[#3978F6]">
              Minh họa Warm Storybook từng phẩm chất
            </span>
            <h2 className="font-kids font-extrabold text-base sm:text-lg text-[#23324D]">
              Các chặng phẩm chất ({approvedTopics.length})
            </h2>
          </div>
          <span className="text-xs font-bold text-[#5C6F8C]">
            Chạm để mở hoạt động
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {approvedTopics.map((topic) => {
            const statusMeta = getTopicStatusMeta(topic);
            const doneCount = topic.experiences.filter(
              (e) => e.status === 'experienced'
            ).length;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => handleOpenNodePopup(topic)}
                className="group text-left rounded-[22px] p-2.5 bg-[#F7F9FD] hover:bg-[#EAF3FF]/65 border border-[#23324D]/8 hover:border-[#3978F6] transition-all cursor-pointer flex flex-col justify-between gap-2.5 shadow-2xs"
              >
                <div className="space-y-2">
                  <div className="relative">
                    <GrowthTopicIllustration
                      slug={topic.slug}
                      variant="scene"
                      className="w-full h-28 sm:h-32 rounded-[16px]"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/95 text-[#3978F6] font-kids font-extrabold text-[10px] shadow-2xs">
                      Chặng {topic.stageOrder}
                    </span>
                  </div>
                  <div className="px-0.5">
                    <h3 className="font-kids font-extrabold text-xs sm:text-sm text-[#23324D] leading-snug whitespace-normal break-words">
                      {topic.title}
                    </h3>
                    <p className="text-[11px] font-semibold text-[#5C6F8C] line-clamp-1 mt-0.5">
                      {topic.landmarkName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1.5 px-0.5 border-t border-[#23324D]/6">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-kids font-extrabold ${statusMeta.bg} ${statusMeta.text}`}
                  >
                    {statusMeta.label}
                  </span>
                  <span className="text-[10px] font-kids font-bold text-[#5C6F8C] tabular-nums">
                    {doneCount}/{topic.experiences.length}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* =======================================================================
          POPUP SHEET WHEN TAPPING A NODE ON THE ADVENTURE MAP (Sec. 7.1, A06, A07)
          Opens as Bottom Sheet on Phone (<768px) or Dialog Sheet on Tablet (>=768px)
          without losing scroll position on the roadmap!
          ======================================================================= */}
      {popupTopic && activeExperience && (
        <div
          className="fixed inset-0 z-50 bg-[#23324D]/55 backdrop-blur-[2px] flex items-end md:items-center justify-center p-0 md:p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseNodePopup();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={popupTopic.title}
            className="w-full md:max-w-[600px] max-h-[88dvh] bg-[#F7F9FD] rounded-t-[32px] md:rounded-[32px] shadow-[0_-14px_48px_rgba(35,50,77,0.28)] border border-white flex flex-col overflow-hidden"
          >
            {/* Mobile Drag Handle + Top Bar */}
            <div className="pt-2.5 px-4 pb-3 bg-white border-b border-[#23324D]/8 shrink-0">
              <div className="md:hidden w-12 h-1.5 rounded-full bg-[#23324D]/15 mx-auto mb-2.5" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <GrowthTopicIllustration
                    slug={popupTopic.slug}
                    className="w-13 h-13 rounded-[16px] shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#EAF3FF] text-[#3978F6] font-kids font-extrabold text-[11px]">
                        {popupTopic.landmarkName}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-kids font-extrabold ${
                          getTopicStatusMeta(popupTopic).bg
                        } ${getTopicStatusMeta(popupTopic).text}`}
                      >
                        {getTopicStatusMeta(popupTopic).label}
                      </span>
                    </div>
                    <h2 className="font-kids font-extrabold text-lg sm:text-xl text-[#23324D] leading-snug mt-0.5">
                      {popupTopic.title}
                    </h2>
                    <p className="text-xs font-semibold text-[#5C6F8C] line-clamp-1">
                      {popupTopic.subtitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseNodePopup}
                  className="w-9 h-9 rounded-[18px] bg-[#EAF3FF] hover:bg-[#3978F6] text-[#3978F6] hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  aria-label="Đóng cửa sổ chặng phẩm chất"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 4 Group Tabs: Khám phá · Hiểu · Thực hành · Chia sẻ */}
              <div className="grid grid-cols-4 gap-1.5 mt-3">
                {popupTopic.experiences.map((exp) => {
                  const meta = EXPERIENCE_TYPE_META[exp.type];
                  const isCurrent = exp.id === activeExperience.id;
                  const isDone = exp.status === 'experienced';
                  return (
                    <button
                      key={exp.id}
                      type="button"
                      onClick={() => setSelectedExpId(exp.id)}
                      className={`p-2 rounded-[18px] border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isCurrent
                          ? 'border-[#3978F6] bg-[#EAF3FF] shadow-2xs'
                          : 'border-[#23324D]/8 bg-[#F7F9FD] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-kids font-extrabold text-[11px] text-[#23324D] truncate">
                          {meta.shortLabel}
                        </span>
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#2EC27E] shrink-0" />
                        ) : meta.starReward > 0 ? (
                          <span className="text-[10px] font-kids font-extrabold text-amber-700">
                            +{meta.starReward}★
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[9px] font-bold text-[#5C6F8C] truncate mt-0.5">
                        {STATUS_META[exp.status].label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Popup Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Warm Storybook Virtue Scene Banner + Audio Read-Aloud Header */}
              <div className="rounded-[24px] bg-white border border-[#23324D]/8 p-3.5 shadow-2xs space-y-3">
                <GrowthTopicIllustration
                  slug={popupTopic.slug}
                  variant="scene"
                  showCaption
                  className="w-full h-44 sm:h-52 rounded-[20px]"
                />

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="min-w-0 space-y-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-kids font-extrabold ${
                        EXPERIENCE_TYPE_META[activeExperience.type].badgeBg
                      } ${EXPERIENCE_TYPE_META[activeExperience.type].badgeText}`}
                    >
                      {EXPERIENCE_TYPE_META[activeExperience.type].icon}
                      {EXPERIENCE_TYPE_META[activeExperience.type].label}
                    </span>
                    <h3 className="font-kids font-extrabold text-base sm:text-lg text-[#23324D] leading-snug">
                      {activeExperience.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSpeakExperience(popupTopic, activeExperience)}
                    className={`shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-[18px] font-kids font-extrabold text-xs transition-colors cursor-pointer ${
                      isSpeaking
                        ? 'bg-[#3978F6] text-white'
                        : 'bg-[#EAF3FF] hover:bg-[#3978F6] text-[#3978F6] hover:text-white'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Nghe Buddy đọc</span>
                  </button>
                </div>

                <div className="rounded-[18px] bg-[#F7F9FD] p-3.5 border border-[#23324D]/6 space-y-2">
                  <p className="text-xs sm:text-sm font-bold text-[#23324D] leading-relaxed">
                    {activeExperience.promptOrStory}
                  </p>
                  {activeExperience.actionSuggestion && (
                    <div className="pt-2 border-t border-[#23324D]/8 flex items-start gap-2">
                      <Heart className="w-4 h-4 text-[#FF8E72] fill-[#FF8E72] shrink-0 mt-0.5" />
                      <p className="text-xs font-kids font-extrabold text-[#3978F6]">
                        Việc tốt gợi ý: {activeExperience.actionSuggestion}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* INTERACTIVE ACTIVITY INPUTS (Sec. 7.1 & A07) */}
              {/* A. Single-Choice Question (for "Hiểu") */}
              {activeExperience.type === 'understand' &&
                activeExperience.choices &&
                activeExperience.choices.length > 0 && (
                  <div className="rounded-[22px] bg-white border border-[#23324D]/8 p-3.5 space-y-2.5">
                    <p className="text-xs font-kids font-extrabold text-[#23324D]">
                      Trắc nghiệm 1 lựa chọn – Nếu là con, con sẽ chọn cách nào?
                    </p>
                    <div className="space-y-2">
                      {activeExperience.choices.map((choice, idx) => {
                        const isPicked = selectedSingleChoice === choice;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setSelectedSingleChoice(choice);
                              setReflectionInput(choice);
                            }}
                            className={`w-full text-left p-3 rounded-[18px] border-2 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-between gap-2 ${
                              isPicked
                                ? 'border-[#2EC27E] bg-[#DDF5E8]/65 text-[#188050]'
                                : 'border-[#23324D]/10 bg-[#F7F9FD] text-[#23324D] hover:border-[#3978F6]/50'
                            }`}
                          >
                            <span>{choice}</span>
                            {isPicked && (
                              <CheckCircle2 className="w-4 h-4 text-[#188050] shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* B. Multi-Choice Checkboxes (for "Chia sẻ" or when choices exist outside Understand) */}
              {activeExperience.type !== 'understand' &&
                activeExperience.choices &&
                activeExperience.choices.length > 0 && (
                  <div className="rounded-[22px] bg-white border border-[#23324D]/8 p-3.5 space-y-2.5">
                    <p className="text-xs font-kids font-extrabold text-[#23324D]">
                      Chọn nhiều ý đúng với trải nghiệm của con (Checkbox):
                    </p>
                    <div className="space-y-2">
                      {activeExperience.choices.map((choice, idx) => {
                        const isChecked =
                          selectedMultiChoices.includes(choice) ||
                          selectedSingleChoice === choice;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleToggleMultiChoice(choice)}
                            className={`w-full text-left p-3 rounded-[18px] border-2 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2.5 ${
                              isChecked
                                ? 'border-[#3978F6] bg-[#EAF3FF]/70 text-[#23324D]'
                                : 'border-[#23324D]/10 bg-[#F7F9FD] text-[#23324D]'
                            }`}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-[#3978F6] shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span>{choice}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* C. Real-Life Action Confirmation Checkbox (for "Thực hành") */}
              {activeExperience.type === 'practice' && (
                <div className="rounded-[22px] bg-[#DDF5E8]/60 border-2 border-[#2EC27E]/40 p-3.5">
                  <button
                    type="button"
                    onClick={() => setRealLifeChecked((prev) => !prev)}
                    className="w-full text-left flex items-center gap-3 cursor-pointer"
                  >
                    {realLifeChecked ? (
                      <CheckSquare className="w-5 h-5 text-[#188050] shrink-0" />
                    ) : (
                      <Square className="w-5 h-5 text-[#188050] shrink-0" />
                    )}
                    <div>
                      <p className="font-kids font-extrabold text-xs sm:text-sm text-[#188050]">
                        Xác nhận hành động ngoài đời thực (+2 ★)
                      </p>
                      <p className="text-xs font-semibold text-[#23324D]/80">
                        Con đã thực hiện việc tốt này cùng ông bà, ba mẹ hoặc bạn bè
                      </p>
                    </div>
                  </button>
                </div>
              )}

              {/* D. Emotion Journal Selector + Short Text Answer */}
              <div className="rounded-[22px] bg-white border border-[#23324D]/8 p-3.5 space-y-3">
                <div>
                  <span className="block text-xs font-kids font-extrabold text-[#23324D] mb-1.5">
                    Nhật ký cảm xúc của con hôm nay:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOTION_TAGS.map((emo) => {
                      const active = selectedEmotionTag === emo.label;
                      return (
                        <button
                          key={emo.id}
                          type="button"
                          onClick={() =>
                            setSelectedEmotionTag(active ? '' : emo.label)
                          }
                          className={`px-2.5 py-1 rounded-[18px] font-kids font-extrabold text-xs transition-all cursor-pointer border ${
                            active
                              ? 'bg-[#FFF0C9] border-amber-400 text-[#7A4F00] shadow-2xs'
                              : 'bg-[#F7F9FD] border-[#23324D]/10 text-[#5C6F8C] hover:bg-white'
                          }`}
                        >
                          {emo.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-kids font-extrabold text-[#5C6F8C] mb-1">
                    Câu trả lời ngắn hoặc chia sẻ của con cùng Buddy & Ba Mẹ:
                  </label>
                  <input
                    type="text"
                    value={reflectionInput}
                    onChange={(e) => setReflectionInput(e.target.value)}
                    placeholder="Nhập câu trả lời hoặc việc tốt con đã làm..."
                    className="w-full px-3.5 py-2.5 rounded-[18px] bg-[#F7F9FD] border border-[#23324D]/15 text-xs sm:text-sm font-semibold text-[#23324D] focus:outline-none focus:border-[#3978F6]"
                  />
                </div>
              </div>

              {feedbackNotice && (
                <div className="bg-[#FFF0C9] border border-amber-300 text-[#7A4F00] px-3.5 py-2.5 rounded-2xl text-xs font-kids font-extrabold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                  <span>{feedbackNotice}</span>
                </div>
              )}
            </div>

            {/* Sticky Popup Footer Actions: "Lưu lại" | "Con đã làm xong" | "Muốn thử lại" */}
            <div className="p-3.5 sm:px-5 bg-white border-t border-[#23324D]/8 flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleSaveOrComplete(popupTopic, activeExperience, 'in_progress')
                }
                className="min-h-[44px] px-3.5 py-2 rounded-[18px] bg-[#EAF3FF] hover:bg-[#d8e8ff] text-[#3978F6] font-kids font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu lại</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSaveOrComplete(popupTopic, activeExperience, 'want_to_retry')
                }
                className="min-h-[44px] px-3 py-2 rounded-[18px] bg-[#FFF0C9]/80 hover:bg-[#ffe5a3] text-[#8A5A00] font-kids font-extrabold text-xs inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Thử lại sau</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSaveOrComplete(popupTopic, activeExperience, 'experienced')
                }
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-[18px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-xs sm:text-sm shadow-2xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Con đã làm xong</span>
                {EXPERIENCE_TYPE_META[activeExperience.type].starReward > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FFF0C9] text-[#8A5A00] text-[11px] font-extrabold">
                    +{EXPERIENCE_TYPE_META[activeExperience.type].starReward} ★
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Treasure Chest Summary Modal */}
      {showTreasureModal && (
        <div
          className="fixed inset-0 z-50 bg-[#23324D]/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTreasureModal(false);
          }}
        >
          <div className="w-full max-w-md bg-gradient-to-b from-[#FFF9EB] to-white rounded-[30px] p-5 border-2 border-amber-300 shadow-2xl space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#FFF0C9] mx-auto flex items-center justify-center text-3xl shadow-xs">
              🏆
            </div>
            <div>
              <span className="px-3 py-1 rounded-full bg-[#FFF0C9] text-[#8A5A00] font-kids font-extrabold text-xs">
                Đỉnh Núi Kho Báu Phẩm Chất
              </span>
              <h2 className="font-kids font-extrabold text-xl text-[#23324D] mt-2">
                Hành trang tốt đẹp của {data.profile.displayName}
              </h2>
              <p className="text-xs sm:text-sm text-[#5C6F8C] mt-1">
                Con đã lưu lại <strong>{totalExperiencedSteps} dấu ấn trải nghiệm</strong> trên bản đồ phiêu lưu phẩm chất!
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowTreasureModal(false);
                  openBuddyChat();
                  sendChatMessage(
                    'Buddy ơi, con vừa xem Rương Kho Báu Phẩm Chất trên bản đồ Hành trình!',
                    'open_journey'
                  );
                }}
                className="min-h-[44px] px-4 py-2 rounded-[18px] bg-[#3978F6] text-white font-kids font-extrabold text-xs cursor-pointer"
              >
                Khoe với Buddy
              </button>
              <button
                type="button"
                onClick={() => setShowTreasureModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-[18px] bg-slate-100 text-[#23324D] font-kids font-extrabold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
