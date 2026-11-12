import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  MessageCircle,
  ChevronRight,
  HelpCircle,
  X,
  Minimize2,
  Compass,
} from 'lucide-react';
import { useBuddy } from '../context/BuddyContext';
import { BuddyAvatar } from './BuddyAvatar';
import { BuddyMessage, HelpCard } from './DesignSystem';
import {
  TaskStepIllustration,
  StoryEditorialIllustration,
  RoutinePeriodIllustration,
  GrowthTopicIllustration,
} from './BuddyIllustrations';
import { voiceService } from '../services/voiceService';
import { ChatMessage } from '../types/domain';

interface CompanionQuickCard {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  intent: string;
  bgClass: string;
  visualPreview: React.ReactNode;
}

/**
 * Shared Inner Companion Experience (used inside FloatingBuddyChat sheet/drawer and standalone BuddyChatView)
 */
export const BuddyChatView: React.FC<{
  isOverlaySheet?: boolean;
  onCloseSheet?: () => void;
  onMinimizeSheet?: () => void;
}> = ({ isOverlaySheet = false, onCloseSheet, onMinimizeSheet }) => {
  const {
    data,
    geminiConfigured,
    voiceState,
    starSummary,
    sendChatMessage,
    isChatLoading,
    clearChatHistory,
    openSubView,
    navigateTab,
    updateVoicePreference,
    activeTaskStepContext,
    setSelectedJourneyTopicId,
    closeBuddyChat,
  } = useBuddy();

  const hasChildMessages = data.chatHistory.some((m) => m.role === 'child');
  const [forceCompanionStage, setForceCompanionStage] = useState(false);

  const isConversationMode = hasChildMessages && !forceCompanionStage;

  const [inputText, setInputText] = useState('');
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isConversationMode) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data.chatHistory.length, isChatLoading, isConversationMode]);

  const isSpeaking = voiceState.status === 'playing';

  // Companion State: idle | listening | thinking | speaking
  const companionState: 'idle' | 'listening' | 'thinking' | 'speaking' =
    isListeningMic
      ? 'listening'
      : isChatLoading
      ? 'thinking'
      : isSpeaking
      ? 'speaking'
      : 'idle';

  const lastBuddyMsgObj =
    [...data.chatHistory].reverse().find((m) => m.role === 'buddy') || null;
  const lastBuddyMessage =
    lastBuddyMsgObj?.text ||
    `Chào ${data.profile.displayName}! Con hãy chạm vào Micro để nói chuyện hoặc chọn 1 thẻ hình bên dưới nhé!`;

  // Contextual current step info if child is inside Task Guide
  const currentStepInfo = React.useMemo(() => {
    if (!activeTaskStepContext) return null;
    const t = data.tasks.find((item) => item.id === activeTaskStepContext.taskId);
    const st = t?.steps[activeTaskStepContext.stepIndex];
    if (!t || !st) return null;
    return { task: t, step: st, stepNumber: activeTaskStepContext.stepIndex + 1 };
  }, [activeTaskStepContext, data.tasks]);

  // 4 Required Quick Suggestions with visual miniature scenes
  const QUICK_SUGGESTION_CARDS: CompanionQuickCard[] = [
    {
      id: 'quick-curious',
      title: 'Hỏi điều thú vị',
      subtitle: 'Khám phá thế giới quanh con',
      prompt: 'Buddy ơi, vì sao sau cơn mưa lại có cầu vồng nhiều màu sắc vậy?',
      intent: 'greeting_or_chat',
      bgClass: 'bg-[#EAF3FF] hover:bg-[#d8e9ff]',
      visualPreview: (
        <div className="w-12 h-11 shrink-0">
          <StoryEditorialIllustration
            type="hat-giong"
            className="w-full h-full rounded-[14px] p-1"
          />
        </div>
      ),
    },
    {
      id: 'quick-today',
      title: 'Bắt đầu việc hôm nay',
      subtitle: 'Mở hoạt động trong ngày',
      prompt: 'Buddy ơi, bắt đầu việc hôm nay của con nhé!',
      intent: 'today_activities',
      bgClass: 'bg-[#DDF5E8] hover:bg-[#ccebd9]',
      visualPreview: (
        <div className="w-12 h-11 shrink-0">
          <TaskStepIllustration
            illustrationKey="pack-books"
            className="w-full h-full rounded-[14px] p-1"
          />
        </div>
      ),
    },
    {
      id: 'quick-story',
      title: 'Nghe kể chuyện',
      subtitle: 'Truyện ấm áp mỗi tối',
      prompt: 'Buddy ơi, kể chuyện cho con nghe nhé!',
      intent: 'tell_story',
      bgClass: 'bg-[#EDE7FF] hover:bg-[#e0d6ff]',
      visualPreview: (
        <div className="w-12 h-11 shrink-0">
          <StoryEditorialIllustration
            type="bau-troi-dem"
            className="w-full h-full rounded-[14px] p-1"
          />
        </div>
      ),
    },
    {
      id: 'quick-stars',
      title: 'Xem sao của con',
      subtitle: `${starSummary.monthlyStars} ngôi sao tháng này`,
      prompt: 'Buddy ơi, cho con xem sao của con nhé!',
      intent: 'view_stars_rewards',
      bgClass: 'bg-[#FFF0C9] hover:bg-[#ffe5a3]',
      visualPreview: (
        <div className="w-12 h-11 shrink-0">
          <RoutinePeriodIllustration
            period="morning"
            className="w-full h-full rounded-[14px]"
          />
        </div>
      ),
    },
  ];

  const NATURAL_VOICE_EXAMPLES = [
    {
      label: '“Buddy ơi, con muốn chuẩn bị cặp sách”',
      prompt: 'Buddy ơi, con muốn chuẩn bị cặp sách',
      intent: 'start_task',
    },
    {
      label: '“Mở Hành trình của con”',
      prompt: 'Buddy ơi, mở hành trình của con nhé',
      intent: 'open_journey',
    },
    {
      label: '“Con chưa hiểu bước này”',
      prompt: 'Con chưa hiểu bước này',
      intent: 'need_help',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isChatLoading) return;
    const text = inputText;
    setInputText('');
    setForceCompanionStage(false);
    await sendChatMessage(text);
  };

  const handleQuickCardClick = async (card: CompanionQuickCard) => {
    if (isChatLoading) return;
    setForceCompanionStage(false);
    await sendChatMessage(card.prompt, card.intent);
  };

  const handleVoiceExampleClick = async (prompt: string, intent: string) => {
    if (isChatLoading) return;
    setForceCompanionStage(false);
    await sendChatMessage(prompt, intent);
  };

  const handleResetConversation = async () => {
    voiceService.stop();
    await clearChatHistory();
    setForceCompanionStage(false);
  };

  // Browser Speech Recognition behind capability check (Only when user clicks Mic)
  const handleToggleMic = () => {
    if (!data.parentSettings.allowVoiceInput) {
      setMicNote('Ba mẹ đang tắt tính năng nói bằng micro trong cài đặt Phụ huynh.');
      return;
    }

    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setMicNote(
        'Trình duyệt này chưa hỗ trợ thu âm trực tiếp. Con hãy chạm vào các câu nói mẫu hoặc thẻ hình bên dưới nhé!'
      );
      return;
    }

    if (isListeningMic) {
      setIsListeningMic(false);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRecognitionCtor as any)();
      recognition.lang = 'vi-VN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListeningMic(true);
      setMicNote(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = async (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        setIsListeningMic(false);
        if (transcript && transcript.trim()) {
          setForceCompanionStage(false);
          await sendChatMessage(transcript.trim());
        }
      };

      recognition.onerror = () => {
        setIsListeningMic(false);
        setMicNote('Buddy chưa nghe rõ lời con nói. Con thử bấm nói lại hoặc chạm thẻ gợi ý nhé!');
      };

      recognition.onend = () => {
        setIsListeningMic(false);
      };

      recognition.start();
    } catch {
      setIsListeningMic(false);
      setMicNote('Chưa bật được micro. Con hãy chạm vào câu nói mẫu hoặc gõ chữ bên dưới nhé!');
    }
  };

  const renderEmbeddedActionCard = (msg: ChatMessage) => {
    const action = msg.actionCard;
    if (!action || action.intent === 'greeting_or_chat') return null;

    if (action.intent === 'need_help') {
      const targetTask =
        data.tasks.find((t) => t.id === (action.helpTopicTaskId || action.taskId)) ||
        data.tasks[0];
      const stepIdx =
        activeTaskStepContext && activeTaskStepContext.taskId === targetTask.id
          ? activeTaskStepContext.stepIndex
          : 0;
      const targetStep = targetTask.steps[stepIdx] || targetTask.steps[0];

      return (
        <div className="pt-1">
          <HelpCard
            stepTitle={`${targetTask.title} – ${targetStep?.actionTitle || 'Hướng dẫn'}`}
            simpleExplanation={
              targetStep?.simpleExplanation ||
              'Con chỉ cần nhìn theo từng bức tranh nhỏ và làm từ từ từng bước một cùng Buddy là xong ngay!'
            }
            illustrationKey={targetStep?.illustrationKey || targetTask.coverIllustration}
            onListenHelp={() =>
              voiceService.speak(
                targetStep?.simpleExplanation || msg.text,
                data.voicePreference,
                'guide'
              )
            }
            onDismissOrAction={() => {
              openSubView({ type: 'guide-task', taskId: targetTask.id }, true);
              closeBuddyChat();
            }}
            actionButtonLabel={`Mở thẻ hình hướng dẫn: ${targetTask.title} →`}
          />
        </div>
      );
    }

    if (action.intent === 'start_task') {
      const targetTask =
        data.tasks.find((t) => t.id === action.taskId) || data.tasks[0];
      return (
        <div
          onClick={() => {
            openSubView({ type: 'guide-task', taskId: targetTask.id }, true);
            closeBuddyChat();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openSubView({ type: 'guide-task', taskId: targetTask.id }, true);
              closeBuddyChat();
            }
          }}
          className="rounded-[24px] bg-white border-2 border-[#3978F6]/25 p-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-3.5"
        >
          <div className="w-20 h-20 shrink-0">
            <TaskStepIllustration
              illustrationKey={targetTask.coverIllustration}
              className="w-full h-full rounded-[16px] p-1"
            />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-kids font-extrabold text-[#3978F6] bg-[#EAF3FF] px-2.5 py-0.5 rounded-full">
              Hướng dẫn thẻ hình · +{targetTask.starReward} ★
            </span>
            <h4 className="font-kids text-base font-extrabold text-[#23324D] truncate mt-1">
              {targetTask.title}
            </h4>
            <p className="text-xs text-[#23324D]/70 truncate">
              {targetTask.steps.length} bước tranh minh họa dễ hiểu
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-[#3978F6] text-white flex items-center justify-center shrink-0">
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      );
    }

    if (action.intent === 'open_journey') {
      const matchedTopic =
        (data.growthTopics || []).find((t) => t.id === action.topicId) ||
        (data.growthTopics || []).find((t) => t.isCurrentFocus) ||
        data.growthTopics?.[0];

      return (
        <button
          type="button"
          onClick={() => {
            if (matchedTopic) {
              setSelectedJourneyTopicId(matchedTopic.id);
            }
            navigateTab('journey', true);
            closeBuddyChat();
          }}
          className="w-full rounded-[22px] bg-[#EDE7FF]/80 hover:bg-[#e2d8ff] border border-indigo-300/60 p-3.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <GrowthTopicIllustration
              slug={matchedTopic?.slug || 'gratitude'}
              className="w-14 h-14 shrink-0"
            />
            <div className="min-w-0">
              <span className="text-[11px] font-kids font-extrabold text-indigo-900">
                Hành trình của con
              </span>
              <h4 className="font-kids text-base font-extrabold text-[#23324D] truncate">
                {action.actionLabel}
              </h4>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-indigo-900 shrink-0" />
        </button>
      );
    }

    if (action.intent === 'tell_story') {
      const story =
        data.stories.find((s) => s.id === action.storyId) || data.stories[0];
      return (
        <div
          onClick={() => {
            openSubView({ type: 'story-list' }, true);
            closeBuddyChat();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openSubView({ type: 'story-list' }, true);
              closeBuddyChat();
            }
          }}
          className="rounded-[24px] bg-[#EDE7FF]/80 border border-indigo-300/60 p-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-3.5"
        >
          <div className="w-20 h-20 shrink-0">
            <StoryEditorialIllustration
              type={story.illustrationType}
              className="w-full h-full rounded-[16px] p-1.5"
            />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-kids font-extrabold text-indigo-800 bg-white px-2.5 py-0.5 rounded-full">
              Kể chuyện mỗi tối
            </span>
            <h4 className="font-kids text-base font-extrabold text-[#23324D] truncate mt-1">
              {action.actionLabel}
            </h4>
            <p className="text-xs text-[#23324D]/75 truncate">
              Chạm để mở trình phát truyện cùng Buddy
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-[#3978F6] text-white flex items-center justify-center shrink-0">
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      );
    }

    if (action.intent === 'today_activities') {
      return (
        <button
          type="button"
          onClick={() => {
            navigateTab('activities', true);
            closeBuddyChat();
          }}
          className="w-full rounded-[22px] bg-[#DDF5E8] hover:bg-[#ccebd9] p-3.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 shrink-0">
              <TaskStepIllustration
                illustrationKey="schedule-check"
                className="w-full h-full rounded-[14px] p-1"
              />
            </div>
            <div>
              <span className="text-[11px] font-kids font-extrabold text-emerald-900">
                Việc hôm nay của con
              </span>
              <h4 className="font-kids text-base font-extrabold text-[#23324D]">
                {action.actionLabel}
              </h4>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-emerald-900 shrink-0" />
        </button>
      );
    }

    if (action.intent === 'view_stars_rewards') {
      return (
        <button
          type="button"
          onClick={() => {
            openSubView({ type: 'stars-detail' }, true);
            closeBuddyChat();
          }}
          className="w-full rounded-[22px] bg-[#FFF0C9] hover:bg-[#ffe5a3] p-3.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 shrink-0">
              <RoutinePeriodIllustration
                period="morning"
                className="w-full h-full rounded-[14px]"
              />
            </div>
            <div>
              <span className="text-[11px] font-kids font-extrabold text-amber-900">
                {starSummary.monthlyStars} ngôi sao tháng này
              </span>
              <h4 className="font-kids text-base font-extrabold text-[#23324D]">
                {action.actionLabel}
              </h4>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-900 shrink-0" />
        </button>
      );
    }

    return null;
  };

  return (
    <div className="space-y-3.5">
      {/* Header with optional Minimize & Close controls when inside Floating Sheet/Drawer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BuddyAvatar
            size="xs"
            isSpeaking={isSpeaking}
            mood={companionState === 'thinking' ? 'thinking' : 'happy'}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-kids text-base sm:text-lg font-extrabold text-[#23324D] truncate">
                Trợ lý Buddy
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-kids font-bold ${
                  geminiConfigured
                    ? 'bg-[#DDF5E8] text-emerald-800'
                    : 'bg-[#EAF3FF] text-[#3978F6]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    geminiConfigured ? 'bg-emerald-500' : 'bg-[#3978F6]'
                  }`}
                />
                <span>{geminiConfigured ? 'AI Trực tuyến' : 'Sẵn sàng'}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasChildMessages && (
            <button
              type="button"
              onClick={() => setForceCompanionStage((prev) => !prev)}
              className="min-h-[34px] px-2.5 py-1 rounded-[18px] bg-white hover:bg-[#EAF3FF] border border-[#23324D]/10 text-[11px] font-kids font-bold text-[#3978F6] inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{isConversationMode ? 'Ngắm Buddy' : 'Hội thoại'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              updateVoicePreference({ muted: !data.voicePreference.muted })
            }
            className="w-9 h-9 rounded-[18px] bg-white hover:bg-[#EAF3FF] border border-[#23324D]/10 flex items-center justify-center text-[#23324D] transition-colors cursor-pointer"
            title={data.voicePreference.muted ? 'Bật giọng đọc' : 'Tắt giọng đọc'}
          >
            {data.voicePreference.muted ? (
              <VolumeX className="w-4 h-4 text-rose-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#3978F6]" />
            )}
          </button>

          {hasChildMessages && (
            <button
              type="button"
              onClick={handleResetConversation}
              className="w-9 h-9 rounded-[18px] bg-white hover:bg-[#EAF3FF] border border-[#23324D]/10 flex items-center justify-center text-[#23324D]/75 hover:text-[#3978F6] transition-colors cursor-pointer"
              title="Làm mới cuộc trò chuyện"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {isOverlaySheet && onMinimizeSheet && (
            <button
              type="button"
              onClick={onMinimizeSheet}
              className="w-9 h-9 rounded-[18px] bg-white hover:bg-[#EAF3FF] border border-[#23324D]/10 flex items-center justify-center text-[#23324D]/75 hover:text-[#3978F6] transition-colors cursor-pointer"
              title="Thu nhỏ Buddy"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          )}

          {isOverlaySheet && onCloseSheet && (
            <button
              type="button"
              onClick={onCloseSheet}
              className="w-9 h-9 rounded-[18px] bg-[#EAF3FF] hover:bg-[#3978F6] text-[#3978F6] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng cửa sổ Buddy"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Contextual Banner when child is inside a Task Guide step */}
      {currentStepInfo && (
        <div className="rounded-2xl bg-[#FFF0C9]/90 border border-amber-300 px-3.5 py-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-kids font-extrabold text-amber-900 uppercase">
              Đang hướng dẫn Bước {currentStepInfo.stepNumber} · {currentStepInfo.task.title}
            </span>
            <p className="font-kids font-bold text-xs text-[#23324D] truncate">
              {currentStepInfo.step.actionTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              handleVoiceExampleClick('Con chưa hiểu bước này', 'need_help')
            }
            className="shrink-0 px-3 py-1.5 rounded-[18px] bg-white hover:bg-[#3978F6] text-[#23324D] hover:text-white font-kids font-extrabold text-xs transition-colors cursor-pointer shadow-2xs"
          >
            Giải thích bước này
          </button>
        </div>
      )}

      {/* MODE 1: AI COMPANION STAGE */}
      {!isConversationMode ? (
        <>
          <section className="rounded-[28px] bg-gradient-to-b from-[#EAF3FF] via-[#F2F7FF] to-white border border-[#3978F6]/15 p-4 sm:p-5 text-center shadow-[0_10px_28px_rgba(57,120,246,0.08)] flex flex-col items-center relative overflow-hidden">
            {/* State Badge: idle | listening | thinking | speaking (Visual wave only when speaking) */}
            <div className="mb-1.5 min-h-[26px] flex items-center justify-center">
              {companionState === 'listening' && (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500 text-white font-kids font-extrabold text-xs shadow-xs animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span>Đang lắng nghe con...</span>
                </span>
              )}
              {companionState === 'thinking' && (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF0C9] text-amber-900 font-kids font-extrabold text-xs shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                  <span>Buddy đang suy nghĩ...</span>
                </span>
              )}
              {companionState === 'speaking' && (
                <span
                  aria-hidden="true"
                  className="inline-flex items-end gap-1 px-3.5 py-1.5 rounded-full bg-[#3978F6]/12 border border-[#3978F6]/25 shadow-2xs"
                >
                  <span className="w-1 h-2.5 rounded-full bg-[#3978F6] animate-bounce" />
                  <span className="w-1 h-3.5 rounded-full bg-[#3978F6] animate-pulse" />
                  <span className="w-1 h-2 rounded-full bg-[#3978F6] animate-bounce" />
                </span>
              )}
              {companionState === 'idle' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 text-[#3978F6] font-kids font-bold text-xs shadow-2xs">
                  <span>Buddy sẵn sàng lắng nghe {data.profile.displayName}</span>
                </span>
              )}
            </div>

            {/* Centered 3D Buddy Robot */}
            <div className="my-1">
              <BuddyAvatar
                size={isOverlaySheet ? 'xl' : 'hero'}
                isSpeaking={isSpeaking}
                mood={companionState === 'thinking' ? 'thinking' : 'happy'}
              />
            </div>

            {/* Short Friendly Speech Bubble */}
            <div className="mt-2.5 w-full max-w-sm rounded-[22px] bg-white border border-[#3978F6]/15 px-3.5 py-2.5 shadow-2xs flex items-center justify-between gap-2.5 text-left">
              <p className="font-kids text-xs sm:text-sm font-bold text-[#23324D] leading-snug line-clamp-3">
                “{lastBuddyMessage}”
              </p>
              <button
                type="button"
                onClick={() =>
                  voiceService.speak(lastBuddyMessage, data.voicePreference, 'chat')
                }
                className="w-9 h-9 rounded-[18px] bg-[#EAF3FF] hover:bg-[#3978F6] text-[#3978F6] hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                title="Nghe Buddy nói"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {/* Primary CTA: Big Microphone Button */}
            <div className="mt-4 flex flex-col items-center">
              <button
                type="button"
                onClick={handleToggleMic}
                className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-[0_10px_28px_rgba(57,120,246,0.32)] active:scale-95 ${
                  isListeningMic
                    ? 'bg-rose-500 text-white ring-8 ring-rose-500/20 animate-pulse'
                    : 'bg-[#3978F6] hover:bg-[#2964DF] text-white ring-8 ring-[#3978F6]/12'
                }`}
                aria-label={isListeningMic ? 'Dừng thu âm' : 'Nhấn để nói chuyện với Buddy'}
              >
                {isListeningMic ? (
                  <MicOff className="w-7 h-7" />
                ) : (
                  <Mic className="w-7 h-7" />
                )}
              </button>
              <p className="mt-1.5 font-kids font-extrabold text-xs text-[#23324D]/80">
                {isListeningMic
                  ? 'Con hãy nói yêu cầu với Buddy nhé...'
                  : 'Nhấn Micro để nói với Buddy'}
              </p>
            </div>

            {/* 1-Tap Natural Voice Command Tryout Pills */}
            <div className="mt-3 pt-2.5 border-t border-[#3978F6]/10 w-full">
              <div className="flex flex-wrap justify-center gap-1.5">
                {NATURAL_VOICE_EXAMPLES.map((ex) => (
                  <button
                    key={ex.prompt}
                    type="button"
                    disabled={isChatLoading}
                    onClick={() => handleVoiceExampleClick(ex.prompt, ex.intent)}
                    className="px-2.5 py-1 rounded-[18px] bg-white hover:bg-[#3978F6] text-[#3978F6] hover:text-white border border-[#3978F6]/20 font-kids font-extrabold text-[11px] transition-colors cursor-pointer shadow-2xs"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 4 Visual Quick Suggestions (2 x 2 Image Cards) */}
          <section aria-label="Gợi ý nhanh cùng Buddy" className="space-y-2">
            <div className="grid grid-cols-2 gap-2.5">
              {QUICK_SUGGESTION_CARDS.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  disabled={isChatLoading}
                  onClick={() => handleQuickCardClick(card)}
                  className={`text-left rounded-[18px] ${card.bgClass} p-3 transition-all shadow-2xs hover:shadow-sm flex items-center gap-2.5 cursor-pointer disabled:opacity-50`}
                >
                  {card.visualPreview}
                  <div className="min-w-0">
                    <h3 className="font-kids text-xs sm:text-sm font-extrabold text-[#23324D] leading-tight truncate">
                      {card.title}
                    </h3>
                    <p className="text-[10px] font-semibold text-[#23324D]/70 mt-0.5 truncate">
                      {card.subtitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        /* MODE 2: CONVERSATION & VISUAL ACTION ROUTING MODE */
        <>
          <div className="rounded-[22px] bg-white border border-[#23324D]/8 p-3.5 min-h-[240px] max-h-[340px] overflow-y-auto space-y-3.5 shadow-2xs">
            {data.chatHistory.map((msg) => {
              if (msg.role === 'buddy') {
                return (
                  <div key={msg.id} className="space-y-2">
                    <BuddyMessage
                      text={msg.text}
                      voicePreference={data.voicePreference}
                      context="chat"
                    />
                    {renderEmbeddedActionCard(msg)}
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[82%] rounded-[20px] rounded-tr-md bg-[#3978F6] text-white px-3.5 py-2.5 shadow-2xs">
                    <p className="font-kids font-bold text-sm sm:text-base leading-relaxed">
                      {msg.text}
                    </p>
                  </div>
                </div>
              );
            })}

            {isChatLoading && (
              <div className="rounded-[18px] bg-[#EAF3FF]/70 p-3 flex items-center gap-2.5 text-xs text-[#23324D] font-kids font-bold">
                <BuddyAvatar size="xs" mood="thinking" />
                <span>Buddy đang hiểu ý con và mở thẻ hướng dẫn...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Intent Pills in Conversation Mode */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              disabled={isChatLoading}
              onClick={() => handleVoiceExampleClick('Con chưa hiểu', 'need_help')}
              className="min-h-[34px] px-3 py-1 rounded-[18px] bg-[#FFF0C9] hover:bg-[#ffe5a3] text-[#23324D] font-kids font-extrabold text-xs whitespace-nowrap inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
              <span>Con chưa hiểu</span>
            </button>
            <button
              type="button"
              disabled={isChatLoading}
              onClick={() =>
                handleVoiceExampleClick('Mở Hành trình của con', 'open_journey')
              }
              className="min-h-[34px] px-3 py-1 rounded-[18px] bg-[#EDE7FF] hover:bg-[#e0d6ff] text-[#23324D] font-kids font-extrabold text-xs whitespace-nowrap inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-indigo-700" />
              <span>Hành trình của con</span>
            </button>
            {QUICK_SUGGESTION_CARDS.map((card) => (
              <button
                key={card.id}
                type="button"
                disabled={isChatLoading}
                onClick={() => handleQuickCardClick(card)}
                className={`min-h-[34px] px-3 py-1 rounded-[18px] ${card.bgClass} text-[#23324D] font-kids font-extrabold text-xs whitespace-nowrap inline-flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50`}
              >
                {card.title}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Friendly Microphone Notice */}
      {micNote && (
        <div className="rounded-[18px] bg-[#FFF0C9] border border-amber-300/80 px-3.5 py-2 text-xs font-kids font-bold text-[#23324D] flex items-center justify-between gap-2">
          <span>{micNote}</span>
          <button
            type="button"
            onClick={() => setMicNote(null)}
            className="text-xs underline shrink-0 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Bottom Input Bar with Mic + Text Input + Send */}
      <form
        onSubmit={handleSubmit}
        className="rounded-[22px] bg-white border border-[#23324D]/12 p-1.5 flex items-center gap-2 shadow-[0_6px_20px_rgba(35,50,77,0.05)]"
      >
        <button
          type="button"
          onClick={handleToggleMic}
          className={`w-10 h-10 rounded-[18px] flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
            isListeningMic
              ? 'bg-rose-500 text-white animate-pulse'
              : 'bg-[#EAF3FF] hover:bg-[#d8e9ff] text-[#3978F6]'
          }`}
          title={isListeningMic ? 'Dừng nghe' : 'Nói bằng micro'}
        >
          {isListeningMic ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder='VD: "Buddy ơi, con muốn chuẩn bị cặp sách"...'
          className="flex-1 min-h-[40px] px-1.5 text-xs sm:text-sm font-kids font-bold text-[#23324D] placeholder:text-[#23324D]/45 focus:outline-none"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isChatLoading}
          className="min-h-[40px] px-3.5 rounded-[18px] bg-[#3978F6] hover:bg-[#2964DF] disabled:opacity-40 text-white font-kids font-extrabold text-xs sm:text-sm inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
        >
          <span>Gửi</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};

/**
 * v1.4 FLOATING BUDDY AI COMPANION (ICON-ONLY BUTTON + SHEET/DIALOG)
 * - Strictly icon-only circular trigger (56px / w-14 h-14 rounded-full) containing the 3D Buddy robot avatar.
 * - NO text label ("Hỏi Buddy", "Chat với Buddy", etc.) attached to the floating trigger button (Sec. 2 & A05).
 * - Positioned at bottom-right above the fixed bottom navigation bar, or top-right in Step Guide (`guide-task`) & Story Player (`story-detail`) so primary bottom CTAs are never covered.
 * - Adapts to `window.visualViewport` height when virtual keyboard opens on phone/tablet.
 */
export const FloatingBuddyChat: React.FC = () => {
  const {
    subView,
    voiceState,
    isChatLoading,
    isBuddyChatOpen,
    openBuddyChat,
    closeBuddyChat,
    minimizeBuddyChat,
  } = useBuddy();

  const [isInputFocusedOnPage, setIsInputFocusedOnPage] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        setIsInputFocusedOnPage(true);
      }
    };
    const handleFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        const tag = active?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          setIsInputFocusedOnPage(false);
        }
      }, 150);
    };

    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        setViewportHeight(Math.round(window.visualViewport.height));
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
    }
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
      }
    };
  }, []);

  // Do not show Floating Kid Assistant inside Parent Dashboard
  if (subView.type === 'parent-dashboard') {
    return null;
  }

  const isCompactTopMode =
    subView.type === 'guide-task' || subView.type === 'story-detail';

  const isSpeaking =
    voiceState.status === 'playing' || voiceState.status === 'speaking';

  return (
    <>
      {/* 1. Circular Icon-Only 3D Buddy Floating Button (56px, NO text label) */}
      {!isBuddyChatOpen && !isInputFocusedOnPage && (
        <button
          type="button"
          onClick={openBuddyChat}
          className={`${
            isCompactTopMode
              ? 'absolute top-3 right-3 z-40 w-12 h-12'
              : 'absolute bottom-[86px] right-4 z-40 w-14 h-14'
          } rounded-full bg-gradient-to-b from-[#EAF3FF] via-white to-[#DDF5E8] border-2 border-[#3978F6] shadow-[0_10px_26px_rgba(57,120,246,0.34)] hover:shadow-[0_14px_32px_rgba(57,120,246,0.48)] flex items-center justify-center transition-all active:scale-95 cursor-pointer`}
          aria-label="Mở trợ lý Buddy"
          title="Mở trợ lý Buddy"
        >
          <div className="relative flex items-center justify-center">
            <BuddyAvatar
              size="xs"
              isSpeaking={isSpeaking}
              mood={isChatLoading ? 'thinking' : 'happy'}
            />
            <span
              className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                isSpeaking
                  ? 'bg-[#3978F6] animate-ping'
                  : isChatLoading
                  ? 'bg-[#F6B73C] animate-pulse'
                  : 'bg-[#2EC27E]'
              }`}
            />
          </div>
        </button>
      )}

      {/* 2. Floating Buddy Bottom Sheet (Phone <768px) / Constrained Dialog Panel (Tablet >=768px) */}
      {isBuddyChatOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-[#23324D]/45 backdrop-blur-[2px] animate-fadeIn p-0 md:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              minimizeBuddyChat();
            }
          }}
        >
          <div
            style={
              viewportHeight
                ? { maxHeight: `${Math.max(320, viewportHeight - 24)}px` }
                : undefined
            }
            className="w-full md:max-w-[540px] max-h-[86dvh] md:max-h-[84dvh] bg-[#F7F9FD] rounded-t-[32px] md:rounded-[32px] shadow-[0_-12px_48px_rgba(35,50,77,0.24)] border border-white flex flex-col overflow-hidden"
          >
            {/* Drag Handle Bar */}
            <div className="pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-[#23324D]/15" />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
              <BuddyChatView
                isOverlaySheet
                onCloseSheet={closeBuddyChat}
                onMinimizeSheet={minimizeBuddyChat}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

