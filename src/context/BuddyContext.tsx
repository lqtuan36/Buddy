import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  ApprovalStatus,
  BedtimeStoryConfig,
  BuddyAppData,
  ChatMessage,
  ChildCharacterVariant,
  DayOfWeekNumber,
  GrowthExperienceStatus,
  GrowthJourneyLog,
  GrowthQualityTopic,
  ParentSettings,
  PodcastAudioStatus,
  PointsPolicy,
  Reward,
  RewardSpin,
  Routine,
  SchoolScheduleConfig,
  Story,
  StorySceneCue,
  Task,
  VoicePreference,
} from '../types/domain';
import { createInitialSeedData } from '../data/seedData';
import { appRepository, StorageMode, storyRepository } from '../services/repository';
import {
  buildIdempotencyKey,
  calculateStarSummary,
  canAwardStars,
  createStarAward,
  getCurrentMonthKey,
  getTodayDateKey,
} from '../services/pointsPolicy';
import { voiceService, VoicePlaybackState, VoiceRuntimeCapabilities } from '../services/voiceService';
import { podcastPlaybackController } from '../services/podcastPlaybackController';
import { setGlobalCharacterVariant, getDefaultStorySceneCues } from '../components/BuddyIllustrations';
import { resolveCompanionIntent } from '../services/intentRouter';

export type ActiveTab = 'home' | 'activities' | 'journey' | 'profile' | 'buddy';
export type SubView =
  | { type: 'none' }
  | { type: 'guide-task'; taskId: string; routineId?: string }
  | { type: 'routine-list' }
  | { type: 'stars-detail' }
  | { type: 'monthly-tracker'; filterTaskId?: string }
  | { type: 'story-list' }
  | { type: 'story-detail'; storyId: string }
  | { type: 'rewards-wheel' }
  | { type: 'voice-settings' }
  | { type: 'parent-dashboard' };

export interface CelebrationBanner {
  id: string;
  title: string;
  subtitle: string;
  starsAdded: number;
}

export interface TimeOfDayGreetingInfo {
  periodKey: 'morning' | 'afternoon' | 'evening';
  periodLabel: string; // "buổi sáng" | "buổi chiều" | "buổi tối"
  headline: string; // "Chào buổi sáng, Minh Anh!"
  spokenText: string;
}

export interface SchoolPrepReminderInfo {
  tomorrowDateKey: string;
  tomorrowDayLabel: string;
  prepTime: string;
  subjects: string[];
  supplies: string[];
  note?: string;
  isOverride: boolean;
  overrideReason?: string;
  isPrepCompletedToday: boolean;
  isDismissed: boolean;
  spokenReminderText: string;
}

export interface ActiveTaskStepContext {
  taskId: string;
  stepIndex: number;
}

const SESSION_GREETING_STORAGE_KEY = 'buddy_v12_session_greeted';
const DISMISSED_SCHEDULE_REMINDER_KEY = 'buddy_v12_dismissed_schedule_date';

export function buildTimeOfDayGreeting(displayName: string, date = new Date()): TimeOfDayGreetingInfo {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) {
    return {
      periodKey: 'morning',
      periodLabel: 'buổi sáng',
      headline: `Chào buổi sáng, ${displayName}! 👋`,
      spokenText: `Chào buổi sáng ${displayName}! Chúc con một ngày mới thật vui tươi. Hôm nay mình cùng khám phá hoạt động mới và Hành trình của con nhé!`,
    };
  }
  if (hour >= 12 && hour < 18) {
    return {
      periodKey: 'afternoon',
      periodLabel: 'buổi chiều',
      headline: `Chào buổi chiều, ${displayName}! ☀️`,
      spokenText: `Chào buổi chiều ${displayName}! Hôm nay đi học của con có vui không? Mình cùng hoàn thành việc hôm nay để nhận sao lấp lánh nhé!`,
    };
  }
  return {
    periodKey: 'evening',
    periodLabel: 'buổi tối',
    headline: `Chào buổi tối, ${displayName}! 🌙`,
    spokenText: `Chào buổi tối ${displayName}! Tối nay mình cùng chuẩn bị cặp sách cho ngày mai rồi nghe một câu chuyện thật ấm áp trước khi ngủ nhé!`,
  };
}

function getTomorrowDateInfo(): { dateKey: string; dayOfWeek: DayOfWeekNumber } {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return {
    dateKey: `${year}-${month}-${day}`,
    dayOfWeek: tomorrow.getDay() as DayOfWeekNumber,
  };
}

interface BuddyContextValue {
  data: BuddyAppData;
  isLoaded: boolean;
  storageMode: StorageMode;
  geminiConfigured: boolean;
  activeTab: ActiveTab;
  subView: SubView;
  voiceState: VoicePlaybackState;
  voiceCapabilities: VoiceRuntimeCapabilities;
  celebration: CelebrationBanner | null;
  parentUnlocked: boolean;
  activeReminder: Routine | null;
  starSummary: ReturnType<typeof calculateStarSummary>;

  // v1.3 Floating Buddy Assistant state & context
  isBuddyChatOpen: boolean;
  isBuddyMinimized: boolean;
  openBuddyChat: () => void;
  closeBuddyChat: () => void;
  minimizeBuddyChat: () => void;
  activeTaskStepContext: ActiveTaskStepContext | null;
  setActiveTaskStepContext: (ctx: ActiveTaskStepContext | null) => void;

  // v1.4 Growth Journey state & actions
  selectedJourneyTopicId: string | null;
  setSelectedJourneyTopicId: (topicId: string | null) => void;
  updateGrowthExperienceStatus: (
    topicId: string,
    experienceId: string,
    status: GrowthExperienceStatus,
    childResponse?: string,
    extra?: {
      selectedChoices?: string[];
      emotionTag?: string;
      realLifeConfirmed?: boolean;
    }
  ) => Promise<{ awarded: boolean; starsAdded: number; message: string }>;
  saveGrowthTopicByParent: (updatedTopic: GrowthQualityTopic) => Promise<void>;
  saveGrowthCurriculumBatchByParent: (
    topics: GrowthQualityTopic[],
    approveAll: boolean
  ) => Promise<void>;

  // v1.2 Personalized Session Greeting
  greetingInfo: TimeOfDayGreetingInfo;
  hasGreetedThisSession: boolean;
  needsManualGreetingButton: boolean;
  triggerBuddyGreeting: (isUserInitiated?: boolean) => Promise<void>;

  // v1.2 School Schedule & Tomorrow Prep Reminder
  schoolPrepReminder: SchoolPrepReminderInfo | null;
  speakSchoolPrepReminder: () => Promise<void>;
  dismissSchoolPrepReminder: () => void;
  updateSchoolSchedule: (nextSchedule: SchoolScheduleConfig) => Promise<void>;

  // Navigation
  navigateTab: (tab: ActiveTab, keepVoicePlaying?: boolean) => void;
  openSubView: (view: SubView, keepVoicePlaying?: boolean) => void;
  closeSubView: () => void;
  dismissCelebration: () => void;
  dismissReminder: () => void;

  // Parent Auth / Demo Gate
  unlockParentArea: (passcodeInput: string, adultConfirmed: boolean) => boolean;
  lockParentArea: () => void;

  // 1) Chat
  sendChatMessage: (text: string, intentTag?: string) => Promise<void>;
  isChatLoading: boolean;
  clearChatHistory: () => Promise<void>;

  // 2) Guide & 3) Routine & 4) Stars + Monthly Tracker Offline Confirmation
  completeTaskStepRun: (
    taskId: string,
    completedStepIds: string[],
    helpRequestedStepIds: string[],
    routineId?: string
  ) => Promise<{ awarded: boolean; starsAdded: number; message: string }>;
  toggleRoutineDirectCheckin: (routineId: string) => Promise<{ awarded: boolean; message: string }>;
  confirmOfflineActivityForDate: (
    taskId: string,
    dateKey: string
  ) => Promise<{ awarded: boolean; starsAdded: number; message: string }>;
  awardStoryReflectionStar: (storyId: string, reflectionAnswer: string) => Promise<{ awarded: boolean; message: string }>;
  awardParentPraiseStar: (reasonTitle: string, note: string) => Promise<void>;

  // 5) Rewards Wheel
  spinRewardWheel: () => Promise<{ ok: boolean; spin?: RewardSpin; error?: string }>;
  confirmRewardSpinByParent: (spinId: string, parentNote?: string) => Promise<void>;

  // 6) v1.2 + v1.4 Parent-Uploaded Bedtime Stories, AI Podcast Library & Scheduling
  tonightScheduledStory: Story | null;
  saveParentStory: (story: Story) => Promise<{ ok: boolean; error?: string }>;
  saveParentStoryBatch: (stories: Story[], approveAll: boolean) => Promise<{ ok: boolean; error?: string }>;
  reorderStoriesByParent: (storyId: string, direction: 'up' | 'down') => Promise<void>;
  synthesizeStoryPodcastEpisode: (
    storyId: string,
    forceRegenerate?: boolean
  ) => Promise<{
    ok: boolean;
    audioStatus: PodcastAudioStatus;
    actualDurationSeconds?: number;
    error?: string;
  }>;
  deleteParentStory: (storyId: string) => Promise<void>;
  toggleStoryVisibility: (storyId: string, hidden: boolean) => Promise<void>;
  updateBedtimeStoryConfig: (patch: Partial<BedtimeStoryConfig>) => Promise<void>;

  // 7) Voice Settings
  updateVoicePreference: (patch: Partial<VoicePreference>) => Promise<void>;

  // 8) Parent Management & Child Character Variant
  saveAndApproveTask: (updatedTask: Task, status?: ApprovalStatus) => Promise<void>;
  createNewApprovedTask: (newTask: Omit<Task, 'id' | 'lastApprovedAt'>, status?: ApprovalStatus) => Promise<void>;
  deleteTaskByParent: (taskId: string) => Promise<void>;
  updateRoutineConfig: (updatedRoutine: Routine) => Promise<void>;
  updateRewardConfig: (updatedReward: Reward) => Promise<void>;
  addFamilyReward: (title: string, description: string, colorTheme: Reward['colorTheme'], approved?: boolean) => Promise<void>;
  deleteRewardByParent: (rewardId: string) => Promise<void>;
  updatePointsPolicy: (policy: PointsPolicy) => Promise<void>;
  updateParentSettings: (settings: Partial<ParentSettings>) => Promise<void>;
  updateChildProfileName: (
    displayName: string,
    ageYears: number,
    parentConsentGranted: boolean,
    characterVariant?: ChildCharacterVariant
  ) => Promise<void>;
  updateChildCharacterVariant: (characterVariant: ChildCharacterVariant) => Promise<void>;
  resetDemoData: () => Promise<void>;
}

const BuddyContext = createContext<BuddyContextValue | null>(null);

export const BuddyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<BuddyAppData>(() => createInitialSeedData());
  const [isLoaded, setIsLoaded] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [subView, setSubView] = useState<SubView>({ type: 'none' });
  const [celebration, setCelebration] = useState<CelebrationBanner | null>(null);
  const [parentUnlocked, setParentUnlocked] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [dismissedReminderIds, setDismissedReminderIds] = useState<string[]>([]);

  // v1.3 Floating Buddy Chat state
  const [isBuddyChatOpen, setIsBuddyChatOpen] = useState(false);
  const [isBuddyMinimized, setIsBuddyMinimized] = useState(false);
  const [activeTaskStepContext, setActiveTaskStepContext] = useState<ActiveTaskStepContext | null>(null);

  // v1.3 Growth Journey selected topic
  const [selectedJourneyTopicId, setSelectedJourneyTopicId] = useState<string | null>(null);

  // v1.2 Session Greeting tracking (does not replay on tab switch or refresh within session)
  const [hasGreetedThisSession, setHasGreetedThisSession] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.sessionStorage.getItem(SESSION_GREETING_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [needsManualGreetingButton, setNeedsManualGreetingButton] = useState<boolean>(false);
  const [healthChecked, setHealthChecked] = useState<boolean>(false);
  const autoGreetingAttemptedRef = useRef<boolean>(hasGreetedThisSession);

  // v1.2 Dismissed school prep reminder tracking
  const [dismissedScheduleDate, setDismissedScheduleDate] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.sessionStorage.getItem(DISMISSED_SCHEDULE_REMINDER_KEY) || '';
    } catch {
      return '';
    }
  });

  const [voiceState, setVoiceState] = useState<VoicePlaybackState>(() => voiceService.getState());
  const [voiceCapabilities, setVoiceCapabilities] = useState<VoiceRuntimeCapabilities>(() =>
    voiceService.getCapabilities()
  );

  // Load persisted data and check server capabilities
  useEffect(() => {
    let mounted = true;
    appRepository.loadAppData().then((loaded) => {
      if (mounted) {
        setData(loaded);
        setIsLoaded(true);
      }
    });

    fetch('/api/health')
      .then((res) => res.json())
      .then((health) => {
        if (mounted && health) {
          const hasGemini = Boolean(health.geminiConfigured);
          setGeminiConfigured(hasGemini);
          voiceService.setGeminiTtsAvailable(hasGemini);
          setHealthChecked(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setGeminiConfigured(false);
          voiceService.setGeminiTtsAvailable(false);
          setHealthChecked(true);
        }
      });

    const unsubVoice = voiceService.subscribe((st, caps) => {
      if (mounted) {
        setVoiceState(st);
        setVoiceCapabilities(caps);
        if (st.autoplayBlocked) {
          setNeedsManualGreetingButton(true);
        }
      }
    });

    return () => {
      mounted = false;
      unsubVoice();
    };
  }, []);

  // Sync global character illustration variant ('boy' | 'girl') whenever profile updates
  useEffect(() => {
    setGlobalCharacterVariant(data.profile.characterVariant || 'girl');
  }, [data.profile.characterVariant]);

  const greetingInfo = useMemo(
    () => buildTimeOfDayGreeting(data.profile.displayName),
    [data.profile.displayName]
  );

  const triggerBuddyGreeting = useCallback(
    async (isUserInitiated = false) => {
      try {
        if (isUserInitiated) {
          voiceService.clearAutoplayBlocked();
          setNeedsManualGreetingButton(false);
        }
        // Mark session greeting immediately BEFORE awaiting speak() so re-renders never double-trigger
        setHasGreetedThisSession(true);
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(SESSION_GREETING_STORAGE_KEY, '1');
          } catch {
            // Ignore storage errors
          }
        }
        const res = await voiceService.speak(
          greetingInfo.spokenText,
          data.voicePreference,
          'greeting'
        );
        if (res.autoplayBlocked && !isUserInitiated) {
          setNeedsManualGreetingButton(true);
          return;
        }
        setNeedsManualGreetingButton(false);
      } catch {
        setNeedsManualGreetingButton(true);
      }
    },
    [greetingInfo.spokenText, data.voicePreference]
  );

  // Automatically attempt session voice greeting ONCE after both app data and /api/health are ready
  useEffect(() => {
    if (!isLoaded || !healthChecked || hasGreetedThisSession || autoGreetingAttemptedRef.current) {
      return;
    }
    autoGreetingAttemptedRef.current = true;
    const timer = window.setTimeout(() => {
      void triggerBuddyGreeting(false);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isLoaded, healthChecked, hasGreetedThisSession, triggerBuddyGreeting]);

  const persist = useCallback(async (nextData: BuddyAppData) => {
    setData(nextData);
    await appRepository.saveAppData(nextData);
  }, []);

  const triggerCelebration = useCallback(
    (title: string, subtitle: string, starsAdded: number, spokenPraise?: string) => {
      setCelebration({
        id: `cel-${Date.now()}`,
        title,
        subtitle,
        starsAdded,
      });
      if (spokenPraise) {
        voiceService.speak(spokenPraise, data.voicePreference, 'celebration');
      }
    },
    [data.voicePreference]
  );

  const openBuddyChat = useCallback(() => {
    setIsBuddyChatOpen(true);
    setIsBuddyMinimized(false);
  }, []);

  const closeBuddyChat = useCallback(() => {
    setIsBuddyChatOpen(false);
    setIsBuddyMinimized(false);
  }, []);

  const minimizeBuddyChat = useCallback(() => {
    setIsBuddyChatOpen(false);
    setIsBuddyMinimized(true);
  }, []);

  const navigateTab = useCallback((tab: ActiveTab, keepVoicePlaying = false) => {
    if (tab === 'buddy') {
      openBuddyChat();
      return;
    }
    if (!keepVoicePlaying) {
      voiceService.stop();
      podcastPlaybackController.stopAndCleanup();
    }
    setActiveTab(tab);
    setSubView({ type: 'none' });
  }, [openBuddyChat]);

  const openSubView = useCallback((view: SubView, keepVoicePlaying = false) => {
    if (!keepVoicePlaying) {
      voiceService.stop();
      if (view.type !== 'story-detail') {
        podcastPlaybackController.stopAndCleanup();
      }
    }
    setSubView(view);
  }, []);

  const closeSubView = useCallback(() => {
    voiceService.stop();
    podcastPlaybackController.stopAndCleanup();
    setSubView({ type: 'none' });
  }, []);

  const dismissCelebration = useCallback(() => {
    setCelebration(null);
  }, []);

  // In-app active reminder logic
  const todayKey = getTodayDateKey();
  const activeReminder =
    data.routines.find(
      (r) =>
        r.approvedByParent &&
        r.reminderEnabled &&
        !r.completedDates.includes(todayKey) &&
        !dismissedReminderIds.includes(r.id)
    ) || null;

  const dismissReminder = useCallback(() => {
    if (activeReminder) {
      setDismissedReminderIds((prev) => [...prev, activeReminder.id]);
    }
  }, [activeReminder]);

  // v1.2 Compute Tomorrow's School Schedule & Prep Reminder
  const schoolPrepReminder = useMemo<SchoolPrepReminderInfo | null>(() => {
    const schedule = data.schoolSchedule;
    if (!schedule || !schedule.reminderEnabled) return null;

    const { dateKey: tomorrowDateKey, dayOfWeek } = getTomorrowDateInfo();

    if (schedule.effectiveFrom && tomorrowDateKey < schedule.effectiveFrom) return null;
    if (schedule.effectiveTo && tomorrowDateKey > schedule.effectiveTo) return null;

    const override = schedule.dateOverrides.find((o) => o.dateKey === tomorrowDateKey);
    const weeklyDay = schedule.weeklyDays.find((d) => d.dayOfWeek === dayOfWeek);

    const dayLabel = weeklyDay?.dayLabel || 'Ngày mai';
    const subjects = override ? override.subjects : weeklyDay?.subjects || [];
    const supplies = override ? override.supplies : weeklyDay?.supplies || [];
    const note = override ? override.reason : weeklyDay?.note;

    if (subjects.length === 0 && supplies.length === 0) return null;

    const isPrepCompletedToday =
      data.routines.some(
        (r) => r.linkedTaskId === 'task-backpack' && r.completedDates.includes(todayKey)
      ) ||
      data.taskRuns.some(
        (run) =>
          run.taskId === 'task-backpack' &&
          run.dateKey === todayKey &&
          run.status === 'completed'
      );

    const subjectText = subjects.length > 0 ? `môn ${subjects.join(', ')}` : 'các môn học';
    const supplyText = supplies.length > 0 ? supplies.join(', ') : 'sách vở và hộp bút';
    const spokenReminderText = `${data.profile.displayName} ơi, đã tới giờ chuẩn bị cặp sách cho ${dayLabel} rồi! Ngày mai con có ${subjectText}. Con nhớ chuẩn bị ${supplyText} cùng Buddy nhé!`;

    return {
      tomorrowDateKey,
      tomorrowDayLabel: dayLabel,
      prepTime: schedule.prepReminderTime || '19:45',
      subjects,
      supplies,
      note,
      isOverride: Boolean(override),
      overrideReason: override?.reason,
      isPrepCompletedToday,
      isDismissed: dismissedScheduleDate === tomorrowDateKey,
      spokenReminderText,
    };
  }, [data.schoolSchedule, data.routines, data.taskRuns, data.profile.displayName, todayKey, dismissedScheduleDate]);

  const speakSchoolPrepReminder = useCallback(async () => {
    if (!schoolPrepReminder) return;
    await voiceService.speak(
      schoolPrepReminder.spokenReminderText,
      data.voicePreference,
      'guide'
    );
  }, [schoolPrepReminder, data.voicePreference]);

  const dismissSchoolPrepReminder = useCallback(() => {
    if (!schoolPrepReminder) return;
    setDismissedScheduleDate(schoolPrepReminder.tomorrowDateKey);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(
          DISMISSED_SCHEDULE_REMINDER_KEY,
          schoolPrepReminder.tomorrowDateKey
        );
      } catch {
        // Ignore storage error
      }
    }
  }, [schoolPrepReminder]);

  const updateSchoolSchedule = useCallback(
    async (nextSchedule: SchoolScheduleConfig) => {
      const stamped: SchoolScheduleConfig = {
        ...nextSchedule,
        updatedAt: new Date().toISOString(),
      };
      const nextRoutines = data.routines.map((r) =>
        r.linkedTaskId === 'task-backpack'
          ? { ...r, dueTime: stamped.prepReminderTime, reminderEnabled: stamped.reminderEnabled }
          : r
      );
      const approval = {
        id: `approval-sched-${Date.now()}`,
        targetType: 'schedule' as const,
        targetId: 'school-schedule',
        status: 'approved' as const,
        reviewedBy: 'Phụ huynh',
        reviewedAt: new Date().toISOString(),
        notes: `Cập nhật thời khóa biểu (${stamped.cycleType === 'weekly' ? 'Theo tuần' : 'Theo tháng'}, nhắc lúc ${stamped.prepReminderTime}).`,
      };
      await persist({
        ...data,
        schoolSchedule: stamped,
        routines: nextRoutines,
        parentApprovals: [approval, ...data.parentApprovals],
      });
    },
    [data, persist]
  );

  const unlockParentArea = useCallback(
    (passcodeInput: string, adultConfirmed: boolean): boolean => {
      if (!adultConfirmed) return false;
      if (passcodeInput.trim() === data.parentSettings.demoPasscode) {
        setParentUnlocked(true);
        return true;
      }
      return false;
    },
    [data.parentSettings.demoPasscode]
  );

  const lockParentArea = useCallback(() => {
    setParentUnlocked(false);
    if (subView.type === 'parent-dashboard') {
      setSubView({ type: 'none' });
    }
  }, [subView.type]);

  // 1) FLOATING BUDDY AI COMPANION (Context-Aware Natural Language Understanding + Action Routing)
  const sendChatMessage = useCallback(
    async (text: string, intentTag?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const detected = resolveCompanionIntent(trimmed, data, intentTag);

      // Context-aware enhancement: If child is currently inside a Task Guide step and asks for help
      let contextualStepHelpReply: string | null = null;
      let contextualHelpTaskId: string | undefined = detected.helpTopicTaskId;
      if (detected.intent === 'need_help' && activeTaskStepContext) {
        const activeTask = data.tasks.find((t) => t.id === activeTaskStepContext.taskId);
        const activeStep = activeTask?.steps[activeTaskStepContext.stepIndex];
        if (activeTask && activeStep) {
          contextualHelpTaskId = activeTask.id;
          contextualStepHelpReply = `${data.profile.displayName} đang ở Bước ${
            activeTaskStepContext.stepIndex + 1
          } (${activeStep.actionTitle}) của nhiệm vụ "${activeTask.title}". Để Buddy giải thích siêu dễ nhé: ${
            activeStep.simpleExplanation
          }`;
        }
      }

      const userMsg: ChatMessage = {
        id: `chat-user-${Date.now()}`,
        role: 'child',
        text: trimmed,
        createdAt: new Date().toISOString(),
        intentTag: intentTag || detected.intent,
      };

      const updatedHistory = [...data.chatHistory, userMsg];
      const interimData: BuddyAppData = {
        ...data,
        chatHistory: updatedHistory,
      };
      await persist(interimData);
      setIsChatLoading(true);

      const triggerAutoNavigation = () => {
        if (!detected.autoNavigate) return;
        window.setTimeout(() => {
          if (detected.targetSubView) {
            setSubView(detected.targetSubView);
            // Minimize drawer on mobile so child immediately sees the target screen
            setIsBuddyChatOpen(false);
            setIsBuddyMinimized(true);
          } else if (detected.targetTab) {
            setActiveTab(detected.targetTab);
            setSubView({ type: 'none' });
            if (detected.topicId) {
              setSelectedJourneyTopicId(detected.topicId);
            }
            setIsBuddyChatOpen(false);
            setIsBuddyMinimized(true);
          }
        }, 950);
      };

      try {
        let replyText = contextualStepHelpReply || detected.suggestedReply;
        let replyMode: ChatMessage['mode'] = geminiConfigured ? 'gemini-live' : 'demo-fallback';

        if (
          !contextualStepHelpReply &&
          (detected.intent === 'greeting_or_chat' || detected.intent === 'need_help')
        ) {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: trimmed,
              history: updatedHistory.slice(-6),
              childName: data.profile.displayName,
              childAge: data.profile.ageYears,
            }),
          });
          const payload = await res.json();
          if (payload.reply) {
            replyText =
              detected.intent === 'need_help'
                ? `${payload.reply} Con nhìn Thẻ Trợ Giúp bằng hình ảnh bên dưới nhé!`
                : payload.reply;
            replyMode = payload.mode || replyMode;
          }
        }

        const buddyMsg: ChatMessage = {
          id: `chat-buddy-${Date.now()}`,
          role: 'buddy',
          text: replyText,
          createdAt: new Date().toISOString(),
          mode: replyMode,
          actionCard: {
            intent: detected.intent,
            actionLabel: detected.actionLabel,
            taskId: contextualHelpTaskId || detected.taskId,
            storyId: detected.storyId,
            topicId: detected.topicId,
            helpTopicTaskId: contextualHelpTaskId || detected.helpTopicTaskId,
            targetTab: detected.targetTab,
          },
        };

        const finalData: BuddyAppData = {
          ...interimData,
          chatHistory: [...updatedHistory, buddyMsg],
        };
        await persist(finalData);
        voiceService.speak(buddyMsg.text, data.voicePreference, 'chat');
        triggerAutoNavigation();
      } catch {
        const fallbackMsg: ChatMessage = {
          id: `chat-buddy-${Date.now()}`,
          role: 'buddy',
          text: contextualStepHelpReply || detected.suggestedReply,
          createdAt: new Date().toISOString(),
          mode: 'demo-fallback',
          actionCard: {
            intent: detected.intent,
            actionLabel: detected.actionLabel,
            taskId: contextualHelpTaskId || detected.taskId,
            storyId: detected.storyId,
            topicId: detected.topicId,
            helpTopicTaskId: contextualHelpTaskId || detected.helpTopicTaskId,
            targetTab: detected.targetTab,
          },
        };
        await persist({
          ...interimData,
          chatHistory: [...updatedHistory, fallbackMsg],
        });
        voiceService.speak(fallbackMsg.text, data.voicePreference, 'chat');
        triggerAutoNavigation();
      } finally {
        setIsChatLoading(false);
      }
    },
    [data, geminiConfigured, persist, activeTaskStepContext]
  );

  const clearChatHistory = useCallback(async () => {
    const initialMsg: ChatMessage = {
      id: `msg-reset-${Date.now()}`,
      role: 'buddy',
      text: `Chào ${data.profile.displayName}! Cuộc trò chuyện mới đã sẵn sàng. Hôm nay con muốn tâm sự hay hỏi Buddy điều gì nào?`,
      createdAt: new Date().toISOString(),
      mode: geminiConfigured ? 'gemini-live' : 'demo-fallback',
    };
    await persist({
      ...data,
      chatHistory: [initialMsg],
    });
  }, [data, geminiConfigured, persist]);

  // v1.4 GROWTH JOURNEY – HÀNH TRÌNH CỦA CON
  // Awards Effort Stars upon completing Practice (+2) or Share (+1) + records Experience Milestone & rich responses
  const updateGrowthExperienceStatus = useCallback(
    async (
      topicId: string,
      experienceId: string,
      status: GrowthExperienceStatus,
      childResponse?: string,
      extra?: {
        selectedChoices?: string[];
        emotionTag?: string;
        realLifeConfirmed?: boolean;
      }
    ) => {
      const topic = (data.growthTopics || []).find((t) => t.id === topicId);
      if (!topic) {
        return { awarded: false, starsAdded: 0, message: 'Không tìm thấy chủ đề hành trình.' };
      }
      const exp = topic.experiences.find((e) => e.id === experienceId);
      if (!exp) {
        return { awarded: false, starsAdded: 0, message: 'Không tìm thấy hoạt động trải nghiệm.' };
      }

      const nowIso = new Date().toISOString();
      const dateKey = getTodayDateKey();

      const nextTopics = data.growthTopics.map((t) => {
        if (t.id !== topicId) return t;
        return {
          ...t,
          updatedAt: nowIso,
          experiences: t.experiences.map((e) =>
            e.id === experienceId
              ? {
                  ...e,
                  status,
                  childResponse: childResponse !== undefined ? childResponse : e.childResponse,
                  selectedChoices:
                    extra?.selectedChoices !== undefined
                      ? extra.selectedChoices
                      : e.selectedChoices,
                  emotionTag:
                    extra?.emotionTag !== undefined ? extra.emotionTag : e.emotionTag,
                  realLifeConfirmed:
                    extra?.realLifeConfirmed !== undefined
                      ? extra.realLifeConfirmed
                      : e.realLifeConfirmed,
                  lastUpdatedAt: nowIso,
                }
              : e
          ),
        };
      });

      let nextLedger = [...data.starLedger];
      let starsAdded = 0;

      // Award Effort Stars when completing "Thực hành" (+2) or "Chia sẻ" (+1)
      const isRewardableStage =
        status === 'experienced' && (exp.type === 'practice' || exp.type === 'share');

      if (isRewardableStage) {
        const idemKey = buildIdempotencyKey('growth_experience', `${topicId}-${experienceId}`, dateKey);
        const eligibility = canAwardStars(data.starLedger, idemKey);
        if (eligibility.allowed) {
          const rewardStars = exp.type === 'practice' ? 2 : 1;
          const starTx = createStarAward({
            childId: data.profile.id,
            sourceType: 'growth_experience',
            sourceId: `${topicId}:${experienceId}`,
            title: `Hành trình ${topic.title}: ${exp.typeLabel}`,
            note: childResponse
              ? `Chia sẻ/Thực hành: "${childResponse}"`
              : `Hoàn thành bước ${exp.typeLabel} – ${exp.title}`,
            policy: data.pointsPolicy,
            customAmount: rewardStars,
            dateKey,
          });
          starTx.idempotencyKey = idemKey;
          nextLedger = [starTx, ...nextLedger];
          starsAdded = starTx.amount;
        }
      }

      let nextLogs = [...(data.growthLogs || [])];
      if (status === 'experienced' || status === 'want_to_retry' || (childResponse && childResponse.trim())) {
        const logEntry: GrowthJourneyLog = {
          id: `glog-${Date.now()}`,
          topicId: topic.id,
          topicTitle: topic.title,
          experienceId: exp.id,
          experienceType: exp.type,
          experienceTitle: exp.title,
          status,
          childReflection: childResponse,
          buddyFeedback: exp.buddyWarmFeedback,
          dateKey,
          createdAt: nowIso,
        };
        nextLogs = [logEntry, ...nextLogs];
      }

      await persist({
        ...data,
        growthTopics: nextTopics,
        growthLogs: nextLogs,
        starLedger: nextLedger,
      });

      if (status === 'experienced') {
        if (starsAdded > 0) {
          triggerCelebration(
            `Dấu mốc trải nghiệm! +${starsAdded} ★`,
            `Con vừa hoàn thành bước "${exp.typeLabel}" của chủ đề ${topic.title}!`,
            starsAdded,
            exp.buddyWarmFeedback
          );
        } else {
          voiceService.speak(exp.buddyWarmFeedback, data.voicePreference, 'guide');
        }
        return {
          awarded: starsAdded > 0,
          starsAdded,
          message: exp.buddyWarmFeedback,
        };
      }

      if (status === 'want_to_retry') {
        const retryMsg = `Tuyệt lắm ${data.profile.displayName}! Muốn thử lại để rèn luyện thêm là một thói quen rất đáng khen!`;
        voiceService.speak(retryMsg, data.voicePreference, 'guide');
        return { awarded: false, starsAdded: 0, message: retryMsg };
      }

      return {
        awarded: false,
        starsAdded: 0,
        message: 'Đã lưu câu trả lời và trạng thái hoạt động trong Hành trình của con!',
      };
    },
    [data, persist, triggerCelebration]
  );

  const saveGrowthTopicByParent = useCallback(
    async (updatedTopic: GrowthQualityTopic) => {
      const nowIso = new Date().toISOString();
      // Preserve child's existing responses when parent edits a topic (Sec. 7.2 Versioning)
      const existingTopic = (data.growthTopics || []).find((t) => t.id === updatedTopic.id);
      const mergedExperiences = updatedTopic.experiences.map((exp, idx) => {
        const prevExp =
          existingTopic?.experiences.find((e) => e.id === exp.id) ||
          existingTopic?.experiences[idx];
        return {
          ...exp,
          status: prevExp?.status ?? exp.status,
          childResponse: prevExp?.childResponse ?? exp.childResponse,
          selectedChoices: prevExp?.selectedChoices ?? exp.selectedChoices,
          emotionTag: prevExp?.emotionTag ?? exp.emotionTag,
          realLifeConfirmed: prevExp?.realLifeConfirmed ?? exp.realLifeConfirmed,
          lastUpdatedAt: prevExp?.lastUpdatedAt ?? exp.lastUpdatedAt,
        };
      });

      const stamped: GrowthQualityTopic = {
        ...updatedTopic,
        version: (existingTopic?.version || 1) + 1,
        experiences: mergedExperiences,
        updatedAt: nowIso,
      };
      const exists = Boolean(existingTopic);
      let nextTopics = exists
        ? data.growthTopics.map((t) => (t.id === stamped.id ? stamped : t))
        : [...(data.growthTopics || []), stamped];

      if (stamped.isCurrentFocus) {
        nextTopics = nextTopics.map((t) => ({
          ...t,
          isCurrentFocus: t.id === stamped.id,
        }));
      }

      const approval = {
        id: `approval-journey-${Date.now()}`,
        targetType: 'journey' as const,
        targetId: stamped.id,
        status: stamped.approvalStatus,
        reviewedBy: 'Phụ huynh',
        reviewedAt: nowIso,
        notes: `${
          stamped.approvalStatus === 'approved' ? 'Phê duyệt' : 'Lưu bản nháp'
        } chủ đề Hành trình "${stamped.title}" (v${stamped.version}).`,
      };

      await persist({
        ...data,
        growthTopics: nextTopics,
        parentApprovals: [approval, ...data.parentApprovals],
      });
    },
    [data, persist]
  );

  const saveGrowthCurriculumBatchByParent = useCallback(
    async (uploadedTopics: GrowthQualityTopic[], approveAll: boolean) => {
      const nowIso = new Date().toISOString();
      const defaultCoords = [
        { x: 48, y: 88 },
        { x: 34, y: 76 },
        { x: 48, y: 65 },
        { x: 58, y: 55 },
        { x: 45, y: 46 },
        { x: 36, y: 37 },
        { x: 44, y: 28 },
        { x: 48, y: 19 },
      ];

      // Merge uploaded topics with existing topics by id or title/slug, preserving child responses
      const existingByIdOrSlug = new Map<string, GrowthQualityTopic>();
      for (const existing of data.growthTopics || []) {
        existingByIdOrSlug.set(existing.id, existing);
        existingByIdOrSlug.set(existing.title.toLowerCase(), existing);
      }

      const mergedBatch: GrowthQualityTopic[] = uploadedTopics.map((topic, index) => {
        const prev =
          existingByIdOrSlug.get(topic.id) ||
          existingByIdOrSlug.get(topic.title.toLowerCase());
        const coord = defaultCoords[index % defaultCoords.length];

        const mergedExps = topic.experiences.map((exp, eIdx) => {
          const prevExp = prev?.experiences[eIdx];
          return {
            ...exp,
            status: prevExp?.status ?? exp.status ?? 'not_explored',
            childResponse: prevExp?.childResponse ?? exp.childResponse,
            selectedChoices: prevExp?.selectedChoices ?? exp.selectedChoices,
            emotionTag: prevExp?.emotionTag ?? exp.emotionTag,
            realLifeConfirmed: prevExp?.realLifeConfirmed ?? exp.realLifeConfirmed,
            lastUpdatedAt: prevExp?.lastUpdatedAt ?? exp.lastUpdatedAt,
          };
        });

        return {
          ...topic,
          id: prev?.id || topic.id || `journey-upload-${Date.now()}-${index}`,
          stageOrder: index + 1,
          xPercent: topic.xPercent ?? prev?.xPercent ?? coord.x,
          yPercent: topic.yPercent ?? prev?.yPercent ?? coord.y,
          version: (prev?.version || 1) + 1,
          approvalStatus: approveAll ? 'approved' : topic.approvalStatus,
          selectedByParent: approveAll ? true : topic.selectedByParent,
          isCurrentFocus: index === 0 ? true : Boolean(topic.isCurrentFocus),
          experiences: mergedExps,
          updatedAt: nowIso,
        };
      });

      const approval = {
        id: `approval-curriculum-${Date.now()}`,
        targetType: 'journey' as const,
        targetId: 'curriculum-batch',
        status: (approveAll ? 'approved' : 'draft') as ApprovalStatus,
        reviewedBy: 'Phụ huynh',
        reviewedAt: nowIso,
        notes: `${
          approveAll ? 'Phê duyệt & xuất bản' : 'Lưu bản nháp'
        } lộ trình ${mergedBatch.length} chặng phẩm chất từ tệp tổng hợp.`,
      };

      await persist({
        ...data,
        growthTopics: mergedBatch,
        parentApprovals: [approval, ...data.parentApprovals],
      });
    },
    [data, persist]
  );

  // 2) BUDDY GUIDE + 3) ROUTINE + 4) STARS
  const completeTaskStepRun = useCallback(
    async (
      taskId: string,
      completedStepIds: string[],
      helpRequestedStepIds: string[],
      routineId?: string
    ) => {
      const task = data.tasks.find((t) => t.id === taskId);
      if (!task) {
        return { awarded: false, starsAdded: 0, message: 'Không tìm thấy nhiệm vụ.' };
      }

      const dateKey = getTodayDateKey();
      const idempotencyKey = buildIdempotencyKey('task_completion', taskId, dateKey);
      const eligibility = canAwardStars(data.starLedger, idempotencyKey);

      let nextLedger = [...data.starLedger];
      let starsAdded = 0;

      if (eligibility.allowed) {
        const starTx = createStarAward({
          childId: data.profile.id,
          sourceType: 'task_completion',
          sourceId: taskId,
          title: `Hoàn thành: ${task.title}`,
          note: `Con thực hiện đủ ${task.steps.length} bước hướng dẫn cùng Buddy`,
          policy: data.pointsPolicy,
          customAmount: task.starReward || data.pointsPolicy.taskCompletionStars,
          dateKey,
        });
        nextLedger = [starTx, ...nextLedger];
        starsAdded = starTx.amount;
      }

      const nextRoutines = data.routines.map((r) => {
        if (r.id === routineId || r.linkedTaskId === taskId) {
          const nextDates = r.completedDates.includes(dateKey)
            ? r.completedDates
            : [...r.completedDates, dateKey];
          return { ...r, completedDates: nextDates };
        }
        return r;
      });

      const taskRunRecord = {
        id: `run-${Date.now()}`,
        taskId,
        routineId,
        dateKey,
        startedAt: new Date().toISOString(),
        completedStepIds,
        helpRequestedStepIds,
        status: 'completed' as const,
        completedAt: new Date().toISOString(),
        starsAwarded: starsAdded,
      };

      const nextData: BuddyAppData = {
        ...data,
        routines: nextRoutines,
        starLedger: nextLedger,
        taskRuns: [taskRunRecord, ...data.taskRuns],
      };

      await persist(nextData);

      if (starsAdded > 0) {
        const praise = `Hoan hô ${data.profile.displayName}! Con đã hoàn thành "${task.title}" và nhận được ${starsAdded} ngôi sao lấp lánh!`;
        triggerCelebration(
          `Tuyệt vời! +${starsAdded} Ngôi sao`,
          `Con đã hoàn thành "${task.title}" thật gọn gàng!`,
          starsAdded,
          praise
        );
        return { awarded: true, starsAdded, message: praise };
      } else {
        const repeatMsg =
          eligibility.reason ||
          `Hoan hô con đã ôn lại nhiệm vụ "${task.title}"! Ngôi sao của hôm nay đã được ghi nhận vào sổ sao của con rồi nhé.`;
        voiceService.speak(repeatMsg, data.voicePreference, 'celebration');
        return { awarded: false, starsAdded: 0, message: repeatMsg };
      }
    },
    [data, persist, triggerCelebration]
  );

  const confirmOfflineActivityForDate = useCallback(
    async (taskId: string, dateKey: string) => {
      const task = data.tasks.find((t) => t.id === taskId);
      if (!task) {
        return { awarded: false, starsAdded: 0, message: 'Không tìm thấy hoạt động này.' };
      }

      const alreadyRun = data.taskRuns.some(
        (r) => r.taskId === taskId && r.dateKey === dateKey && r.status === 'completed'
      );
      const linkedRoutine = data.routines.find((r) => r.linkedTaskId === taskId);
      const alreadyRoutine = linkedRoutine?.completedDates.includes(dateKey) || false;

      if (alreadyRun || alreadyRoutine) {
        return {
          awarded: false,
          starsAdded: 0,
          message: `Hoạt động "${task.title}" ngày ${dateKey} đã được ghi nhận trong bảng theo dõi rồi nhé!`,
        };
      }

      const idempotencyKey = buildIdempotencyKey('task_completion', taskId, dateKey);
      const eligibility = canAwardStars(data.starLedger, idempotencyKey);

      let nextLedger = [...data.starLedger];
      let starsAdded = 0;

      if (eligibility.allowed) {
        const starTx = createStarAward({
          childId: data.profile.id,
          sourceType: 'task_completion',
          sourceId: taskId,
          title: `Hoàn thành: ${task.title}`,
          note: `Xác nhận hoàn thành trên Bảng theo dõi tháng (${dateKey})`,
          policy: data.pointsPolicy,
          customAmount: task.starReward || data.pointsPolicy.taskCompletionStars,
          dateKey,
        });
        nextLedger = [starTx, ...nextLedger];
        starsAdded = starTx.amount;
      }

      const nextRoutines = data.routines.map((r) => {
        if (r.linkedTaskId === taskId && !r.completedDates.includes(dateKey)) {
          return { ...r, completedDates: [...r.completedDates, dateKey] };
        }
        return r;
      });

      const offlineRun = {
        id: `run-offline-${Date.now()}`,
        taskId,
        routineId: linkedRoutine?.id,
        dateKey,
        startedAt: new Date().toISOString(),
        completedStepIds: task.steps.map((s) => s.id),
        helpRequestedStepIds: [],
        status: 'completed' as const,
        completedAt: new Date().toISOString(),
        starsAwarded: starsAdded,
        confirmedOffline: true,
      };

      await persist({
        ...data,
        routines: nextRoutines,
        starLedger: nextLedger,
        taskRuns: [offlineRun, ...data.taskRuns],
      });

      if (starsAdded > 0) {
        const praise = `Tuyệt vời! Buddy đã ghi nhận "${task.title}" vào ngày ${dateKey} và tặng con thêm ${starsAdded} ngôi sao!`;
        triggerCelebration(
          `Ghi nhận thành công! +${starsAdded} ★`,
          `Đã đánh dấu "${task.title}" vào bảng theo dõi tháng!`,
          starsAdded,
          praise
        );
        return { awarded: true, starsAdded, message: praise };
      }

      return {
        awarded: false,
        starsAdded: 0,
        message: `Đã ghi nhận "${task.title}" vào ngày ${dateKey}!`,
      };
    },
    [data, persist, triggerCelebration]
  );

  const toggleRoutineDirectCheckin = useCallback(
    async (routineId: string) => {
      const routine = data.routines.find((r) => r.id === routineId);
      if (!routine) return { awarded: false, message: 'Không tìm thấy lịch trình.' };

      const dateKey = getTodayDateKey();
      const alreadyDone = routine.completedDates.includes(dateKey);

      if (alreadyDone) {
        const nextRoutines = data.routines.map((r) =>
          r.id === routineId
            ? { ...r, completedDates: r.completedDates.filter((d) => d !== dateKey) }
            : r
        );
        await persist({ ...data, routines: nextRoutines });
        return {
          awarded: false,
          message: 'Đã cập nhật lại trạng thái việc cần làm hôm nay.',
        };
      }

      const sourceId = routine.linkedTaskId || routine.id;
      const taskIdemKey = buildIdempotencyKey('task_completion', sourceId, dateKey);
      const routineIdemKey = buildIdempotencyKey('routine_checkin', routine.id, dateKey);

      const hasTaskStar = !canAwardStars(data.starLedger, taskIdemKey).allowed;
      const hasRoutineStar = !canAwardStars(data.starLedger, routineIdemKey).allowed;

      let nextLedger = [...data.starLedger];
      let starsAdded = 0;

      if (!hasTaskStar && !hasRoutineStar) {
        const starTx = createStarAward({
          childId: data.profile.id,
          sourceType: 'routine_checkin',
          sourceId: routine.id,
          title: `Thói quen tốt: ${routine.title}`,
          note: `Hoàn thành đúng lịch hẹn (${routine.dueTime})`,
          policy: data.pointsPolicy,
          customAmount: data.pointsPolicy.routineBonusStars,
          dateKey,
        });
        nextLedger = [starTx, ...nextLedger];
        starsAdded = starTx.amount;
      }

      const nextRoutines = data.routines.map((r) =>
        r.id === routineId
          ? { ...r, completedDates: [...r.completedDates, dateKey] }
          : r
      );

      await persist({
        ...data,
        routines: nextRoutines,
        starLedger: nextLedger,
      });

      if (starsAdded > 0) {
        triggerCelebration(
          `Giỏi lắm! +${starsAdded} Ngôi sao`,
          `Con đã hoàn thành "${routine.title}"!`,
          starsAdded,
          `Tuyệt vời! ${data.profile.displayName} đã hoàn thành "${routine.title}" và nhận thêm ${starsAdded} ngôi sao!`
        );
      }

      return {
        awarded: starsAdded > 0,
        message:
          starsAdded > 0
            ? `Đã cộng +${starsAdded} ngôi sao cho thói quen hôm nay!`
            : 'Đã đánh dấu hoàn thành! (Ngôi sao cho việc này hôm nay đã được ghi nhận trước đó).',
      };
    },
    [data, persist, triggerCelebration]
  );

  const awardStoryReflectionStar = useCallback(
    async (storyId: string, reflectionAnswer: string) => {
      const story = data.stories.find((s) => s.id === storyId);
      if (!story) return { awarded: false, message: 'Không tìm thấy câu chuyện.' };

      const dateKey = getTodayDateKey();
      const idempotencyKey = buildIdempotencyKey('story_reflection', storyId, dateKey);
      const check = canAwardStars(data.starLedger, idempotencyKey);

      if (!check.allowed) {
        return {
          awarded: false,
          message:
            'Cảm ơn con đã chia sẻ suy nghĩ rất ấm áp! Hôm nay con đã nhận ngôi sao kể chuyện cho truyện này rồi nhé.',
        };
      }

      const starTx = createStarAward({
        childId: data.profile.id,
        sourceType: 'story_reflection',
        sourceId: storyId,
        title: `Suy ngẫm sau truyện: ${story.title}`,
        note: `Chia sẻ của con: "${reflectionAnswer}"`,
        policy: data.pointsPolicy,
        customAmount: data.pointsPolicy.storyReflectionStars,
        dateKey,
      });

      await persist({
        ...data,
        starLedger: [starTx, ...data.starLedger],
      });

      triggerCelebration(
        `Ấm áp quá! +${starTx.amount} Ngôi sao`,
        `Cảm ơn suy nghĩ rất đáng yêu của ${data.profile.displayName}!`,
        starTx.amount,
        `Buddy cảm ơn ${data.profile.displayName} đã chia sẻ suy nghĩ thật hay sau câu chuyện nhé!`
      );

      return {
        awarded: true,
        message: `Con nhận được +${starTx.amount} ngôi sao suy ngẫm!`,
      };
    },
    [data, persist, triggerCelebration]
  );

  const awardParentPraiseStar = useCallback(
    async (reasonTitle: string, note: string) => {
      const starTx = createStarAward({
        childId: data.profile.id,
        sourceType: 'parent_encouragement',
        sourceId: `praise-${Date.now()}`,
        title: reasonTitle.trim() || 'Ba mẹ khen ngợi nỗ lực của con',
        note: note.trim() || 'Ghi nhận sự cố gắng tích cực của con',
        policy: data.pointsPolicy,
        customAmount: data.pointsPolicy.parentPraiseStars,
      });

      await persist({
        ...data,
        starLedger: [starTx, ...data.starLedger],
      });
    },
    [data, persist]
  );

  // 5) BUDDY REWARDS WHEEL
  const spinRewardWheel = useCallback(async () => {
    const cycleMonth = getCurrentMonthKey();
    const existingSpin = data.rewardSpins.find(
      (s) => s.childId === data.profile.id && s.cycleMonth === cycleMonth
    );

    if (existingSpin) {
      return {
        ok: false,
        error: 'Tháng này con đã quay thưởng rồi! Mỗi tháng mình có 1 lượt quay kỷ niệm gia đình nhé.',
      };
    }

    const summary = calculateStarSummary(data.starLedger, data.pointsPolicy);
    if (!summary.wheelEligible) {
      return {
        ok: false,
        error: `Con cần tích lũy đủ ${summary.threshold} ngôi sao trong tháng để mở vòng quay (hiện có ${summary.monthlyStars} sao).`,
      };
    }

    const approvedRewards = data.rewards.filter((r) => r.approvedByParent && r.active);
    if (approvedRewards.length < 4) {
      return {
        ok: false,
        error: 'Ba mẹ cần bật ít nhất 4 phần thưởng gia đình trong mục Buddy Parents trước khi quay nhé.',
      };
    }

    try {
      const res = await fetch('/api/rewards/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: data.profile.id,
          cycleMonth,
          monthlyStars: summary.monthlyStars,
          requiredStars: summary.threshold,
          approvedRewards,
          existingSpin,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.spinRecord) {
        return {
          ok: false,
          error: payload.error || 'Không thể thực hiện lượt quay lúc này.',
        };
      }

      const newSpin: RewardSpin = {
        id: payload.spinRecord.spinId,
        childId: data.profile.id,
        cycleMonth,
        rewardId: payload.spinRecord.rewardId,
        rewardTitle: payload.spinRecord.rewardTitle,
        spunAt: payload.spinRecord.spunAt,
        status: 'pending_parent_confirmation',
        isDemoSimulation: appRepository.getStorageMode() === 'local-demo',
      };

      await persist({
        ...data,
        rewardSpins: [newSpin, ...data.rewardSpins],
      });

      voiceService.speak(
        `Chúc mừng ${data.profile.displayName}! Vòng quay gia đình đã chọn món quà "${newSpin.rewardTitle}". Con hãy mời ba mẹ xác nhận món quà kỷ niệm này nhé!`,
        data.voicePreference,
        'celebration'
      );

      return { ok: true, spin: newSpin };
    } catch {
      const chosen = approvedRewards[Math.floor(Math.random() * approvedRewards.length)];
      const fallbackSpin: RewardSpin = {
        id: `spin-local-${cycleMonth}-${Date.now()}`,
        childId: data.profile.id,
        cycleMonth,
        rewardId: chosen.id,
        rewardTitle: chosen.title,
        spunAt: new Date().toISOString(),
        status: 'pending_parent_confirmation',
        isDemoSimulation: true,
      };
      await persist({
        ...data,
        rewardSpins: [fallbackSpin, ...data.rewardSpins],
      });
      return { ok: true, spin: fallbackSpin };
    }
  }, [data, persist]);

  const confirmRewardSpinByParent = useCallback(
    async (spinId: string, parentNote?: string) => {
      const nextSpins = data.rewardSpins.map((s) =>
        s.id === spinId
          ? {
              ...s,
              status: 'confirmed' as const,
              confirmedAt: new Date().toISOString(),
              parentNote: parentNote || 'Ba mẹ đã xác nhận cùng con thực hiện cuối tuần này!',
            }
          : s
      );
      await persist({
        ...data,
        rewardSpins: nextSpins,
      });
    },
    [data, persist]
  );

  // 6) v1.2 + v1.4 PARENT-UPLOADED BEDTIME STORIES, AI PODCAST LIBRARY & TONIGHT'S SCHEDULED STORY
  const tonightScheduledStory = useMemo<Story | null>(() => {
    const visibleApproved = [...data.stories]
      .filter((s) => s.approvedByParent && !s.hiddenByParent)
      .sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999));
    if (visibleApproved.length === 0) return null;

    const scheduledForTodayId = data.bedtimeStoryConfig?.scheduledByDate?.[todayKey];
    if (scheduledForTodayId) {
      const found = visibleApproved.find((s) => s.id === scheduledForTodayId);
      if (found) return found;
    }

    if (data.bedtimeStoryConfig?.tonightStoryId) {
      const found = visibleApproved.find((s) => s.id === data.bedtimeStoryConfig.tonightStoryId);
      if (found) return found;
    }

    return visibleApproved[0];
  }, [data.stories, data.bedtimeStoryConfig, todayKey]);

  const saveParentStory = useCallback(
    async (story: Story): Promise<{ ok: boolean; error?: string }> => {
      const validation = storyRepository.validateStoryPayload(story);
      if (!validation.valid) {
        return { ok: false, error: validation.reason };
      }

      const existing = data.stories.find((s) => s.id === story.id);
      const contentChanged =
        existing &&
        (existing.title !== story.title ||
          existing.paragraphs.join('\n') !== story.paragraphs.join('\n'));

      const stampedStory: Story = {
        ...story,
        contentVersion: contentChanged
          ? (existing?.contentVersion || 1) + 1
          : story.contentVersion || existing?.contentVersion || 1,
        orderIndex: story.orderIndex ?? existing?.orderIndex ?? data.stories.length + 1,
        approvalStatus: story.approvedByParent
          ? 'approved'
          : story.approvalStatus || 'draft',
        audioStatus: contentChanged ? 'none' : story.audioStatus || existing?.audioStatus || 'none',
        audioAssetId: contentChanged ? undefined : story.audioAssetId || existing?.audioAssetId,
        audioUrl: contentChanged ? undefined : story.audioUrl || existing?.audioUrl,
      };

      const exists = Boolean(existing);
      const nextStories = exists
        ? data.stories.map((s) => (s.id === stampedStory.id ? stampedStory : s))
        : [stampedStory, ...data.stories];

      const approval = {
        id: `approval-story-${Date.now()}`,
        targetType: 'story' as const,
        targetId: stampedStory.id,
        status: stampedStory.approvedByParent ? ('approved' as const) : ('draft' as const),
        reviewedBy: 'Phụ huynh',
        reviewedAt: new Date().toISOString(),
        notes: `${exists ? 'Cập nhật' : 'Tải lên'} truyện "${stampedStory.title}" (${
          stampedStory.approvedByParent ? 'Đã duyệt' : 'Bản nháp'
        }, v${stampedStory.contentVersion}).`,
      };

      await persist({
        ...data,
        stories: nextStories,
        parentApprovals: [approval, ...data.parentApprovals],
      });

      return { ok: true };
    },
    [data, persist]
  );

  const saveParentStoryBatch = useCallback(
    async (stories: Story[], approveAll: boolean): Promise<{ ok: boolean; error?: string }> => {
      if (!Array.isArray(stories) || stories.length === 0) {
        return { ok: false, error: 'Danh sách tập truyện trống.' };
      }
      for (const st of stories) {
        const check = storyRepository.validateStoryPayload(st);
        if (!check.valid) {
          return { ok: false, error: `${st.title}: ${check.reason}` };
        }
      }

      const nowIso = new Date().toISOString();
      const baseOrder = data.stories.length;
      const stampedBatch: Story[] = stories.map((st, idx) => ({
        ...st,
        approvedByParent: approveAll ? true : st.approvedByParent,
        approvalStatus: approveAll ? 'approved' : st.approvalStatus || 'draft',
        hiddenByParent: false,
        contentVersion: st.contentVersion || 1,
        orderIndex: st.orderIndex ?? baseOrder + idx + 1,
        audioStatus: st.audioStatus || 'none',
        uploadedAt: st.uploadedAt || nowIso,
      }));

      const batchIds = new Set(stampedBatch.map((s) => s.id));
      const remaining = data.stories.filter((s) => !batchIds.has(s.id));
      const nextStories = [...stampedBatch, ...remaining];

      const approval = {
        id: `approval-story-batch-${Date.now()}`,
        targetType: 'story' as const,
        targetId: stampedBatch[0].id,
        status: approveAll ? ('approved' as const) : ('draft' as const),
        reviewedBy: 'Phụ huynh',
        reviewedAt: nowIso,
        notes: `${
          approveAll ? 'Phê duyệt & thêm vào Thư viện Podcast' : 'Lưu bản nháp'
        } ${stampedBatch.length} tập truyện từ tài liệu của phụ huynh.`,
      };

      await persist({
        ...data,
        stories: nextStories,
        parentApprovals: [approval, ...data.parentApprovals],
      });

      return { ok: true };
    },
    [data, persist]
  );

  const reorderStoriesByParent = useCallback(
    async (storyId: string, direction: 'up' | 'down') => {
      const sorted = [...data.stories].sort(
        (a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999)
      );
      const idx = sorted.findIndex((s) => s.id === storyId);
      if (idx === -1) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;

      const temp = sorted[idx];
      sorted[idx] = sorted[swapIdx];
      sorted[swapIdx] = temp;

      const reindexed = sorted.map((st, index) => ({
        ...st,
        orderIndex: index + 1,
      }));

      await persist({
        ...data,
        stories: reindexed,
      });
    },
    [data, persist]
  );

  const synthesizeStoryPodcastEpisode = useCallback(
    async (
      storyId: string,
      forceRegenerate = false
    ): Promise<{
      ok: boolean;
      audioStatus: PodcastAudioStatus;
      actualDurationSeconds?: number;
      error?: string;
    }> => {
      const targetStory = data.stories.find((s) => s.id === storyId);
      if (!targetStory) {
        return { ok: false, audioStatus: 'failed', error: 'Không tìm thấy tập truyện.' };
      }

      // Mark generating state immediately
      const generatingStories = data.stories.map((s) =>
        s.id === storyId ? { ...s, audioStatus: 'generating' as const } : s
      );
      setData((prev) => ({ ...prev, stories: generatingStories }));

      try {
        const nextContentVersion = forceRegenerate
          ? (targetStory.contentVersion || 1) + 1
          : targetStory.contentVersion || 1;
        const defaultCues = getDefaultStorySceneCues(targetStory.illustrationType);
        const sceneCuesPayload: StorySceneCue[] = targetStory.paragraphs.map((p, idx) => {
          const cue = defaultCues[idx % defaultCues.length];
          return {
            sceneIndex: idx,
            paragraphIndex: idx,
            startTimeSec: 0,
            endTimeSec: 0,
            imageUrl: cue?.imageUrl || '',
            caption: cue?.sceneCaption || `Cảnh ${idx + 1}: ${targetStory.title}`,
            paragraphText: p,
          };
        });

        const res = await fetch('/api/podcast/synthesize-episode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyId: targetStory.id,
            title: targetStory.title,
            paragraphs: targetStory.paragraphs,
            moralLesson: targetStory.moralLesson,
            gender: data.voicePreference.gender,
            baseSpeed: 1,
            contentVersion: nextContentVersion,
            sceneCues: sceneCuesPayload,
          }),
        });

        const payload = await res.json();
        if (res.ok && payload.audioStatus === 'ready' && payload.audioUrl) {
          const updatedStory: Story = {
            ...targetStory,
            contentVersion: nextContentVersion,
            audioStatus: 'ready',
            audioAssetId: payload.audioAssetId,
            audioUrl: payload.audioUrl,
            actualDurationSeconds: payload.actualDurationSeconds,
            durationMinutes: Math.max(1, Math.round((payload.actualDurationSeconds || 180) / 60)),
            voiceId: payload.voiceId,
            voiceGender: payload.voiceGender,
            voiceVersion: payload.voiceVersion,
            baseSpeed: 1,
            sceneTimeline: payload.sceneTimeline,
          };

          const finalStories = data.stories.map((s) =>
            s.id === storyId ? updatedStory : s
          );
          await persist({
            ...data,
            stories: finalStories,
          });
          return {
            ok: true,
            audioStatus: 'ready',
            actualDurationSeconds: payload.actualDurationSeconds,
          };
        } else {
          const failedStories = data.stories.map((s) =>
            s.id === storyId ? { ...s, audioStatus: 'failed' as const } : s
          );
          await persist({
            ...data,
            stories: failedStories,
          });
          return {
            ok: false,
            audioStatus: 'failed',
            error:
              payload.message ||
              'Máy chủ TTS chưa tạo được tệp âm thanh tập truyện. Khi phát sẽ dùng chế độ đọc liên tục trên trình duyệt.',
          };
        }
      } catch {
        const failedStories = data.stories.map((s) =>
          s.id === storyId ? { ...s, audioStatus: 'failed' as const } : s
        );
        await persist({
          ...data,
          stories: failedStories,
        });
        return {
          ok: false,
          audioStatus: 'failed',
          error: 'Không thể kết nối máy chủ tạo âm thanh tập truyện.',
        };
      }
    },
    [data, persist]
  );

  const deleteParentStory = useCallback(
    async (storyId: string) => {
      const nextStories = data.stories.filter((s) => s.id !== storyId);
      await persist({
        ...data,
        stories: nextStories,
      });
    },
    [data, persist]
  );

  const toggleStoryVisibility = useCallback(
    async (storyId: string, hidden: boolean) => {
      const nextStories = data.stories.map((s) =>
        s.id === storyId ? { ...s, hiddenByParent: hidden } : s
      );
      await persist({
        ...data,
        stories: nextStories,
      });
    },
    [data, persist]
  );

  const updateBedtimeStoryConfig = useCallback(
    async (patch: Partial<BedtimeStoryConfig>) => {
      const nextConfig: BedtimeStoryConfig = {
        ...data.bedtimeStoryConfig,
        ...patch,
        scheduledByDate: {
          ...data.bedtimeStoryConfig.scheduledByDate,
          ...(patch.scheduledByDate || {}),
        },
        updatedAt: new Date().toISOString(),
      };
      await persist({
        ...data,
        bedtimeStoryConfig: nextConfig,
      });
    },
    [data, persist]
  );

  // 7) MY BUDDY VOICE PREFERENCES
  const updateVoicePreference = useCallback(
    async (patch: Partial<VoicePreference>) => {
      const nextVoice: VoicePreference = {
        ...data.voicePreference,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      voiceService.syncLivePreference(nextVoice);
      await persist({
        ...data,
        voicePreference: nextVoice,
      });
    },
    [data, persist]
  );

  // 8) PARENT DASHBOARD ACTIONS (Supports Draft, Preview, Approve, Delete Confirmation)
  const saveAndApproveTask = useCallback(
    async (updatedTask: Task, status: ApprovalStatus = 'approved') => {
      const stampedTask: Task = {
        ...updatedTask,
        approvalStatus: status,
        lastApprovedAt: new Date().toISOString(),
      };
      const exists = data.tasks.some((t) => t.id === stampedTask.id);
      const nextTasks = exists
        ? data.tasks.map((t) => (t.id === stampedTask.id ? stampedTask : t))
        : [...data.tasks, stampedTask];

      const newApproval = {
        id: `approval-${Date.now()}`,
        targetType: 'task' as const,
        targetId: stampedTask.id,
        status,
        reviewedBy: 'Phụ huynh',
        reviewedAt: new Date().toISOString(),
        notes: `${status === 'approved' ? 'Phê duyệt' : 'Lưu bản nháp'} nhiệm vụ "${
          stampedTask.title
        }" (${stampedTask.steps.length} bước).`,
      };
      await persist({
        ...data,
        tasks: nextTasks,
        parentApprovals: [newApproval, ...data.parentApprovals],
      });
    },
    [data, persist]
  );

  const createNewApprovedTask = useCallback(
    async (
      newTaskInput: Omit<Task, 'id' | 'lastApprovedAt'>,
      status: ApprovalStatus = 'approved'
    ) => {
      const newTask: Task = {
        ...newTaskInput,
        id: `task-custom-${Date.now()}`,
        approvalStatus: status,
        lastApprovedAt: new Date().toISOString(),
      };
      const newApproval = {
        id: `approval-${Date.now()}`,
        targetType: 'task' as const,
        targetId: newTask.id,
        status,
        reviewedBy: 'Phụ huynh',
        reviewedAt: new Date().toISOString(),
        notes: `${status === 'approved' ? 'Tạo mới & phê duyệt' : 'Tạo bản nháp'} nhiệm vụ "${
          newTask.title
        }".`,
      };
      await persist({
        ...data,
        tasks: [...data.tasks, newTask],
        parentApprovals: [newApproval, ...data.parentApprovals],
      });
    },
    [data, persist]
  );

  const deleteTaskByParent = useCallback(
    async (taskId: string) => {
      const nextTasks = data.tasks.filter((t) => t.id !== taskId);
      await persist({
        ...data,
        tasks: nextTasks,
      });
    },
    [data, persist]
  );

  const updateRoutineConfig = useCallback(
    async (updatedRoutine: Routine) => {
      const nextRoutines = data.routines.map((r) =>
        r.id === updatedRoutine.id ? updatedRoutine : r
      );
      await persist({
        ...data,
        routines: nextRoutines,
      });
    },
    [data, persist]
  );

  const updateRewardConfig = useCallback(
    async (updatedReward: Reward) => {
      const nextRewards = data.rewards.map((r) =>
        r.id === updatedReward.id ? updatedReward : r
      );
      await persist({
        ...data,
        rewards: nextRewards,
      });
    },
    [data, persist]
  );

  const addFamilyReward = useCallback(
    async (
      title: string,
      description: string,
      colorTheme: Reward['colorTheme'],
      approved = true
    ) => {
      const newReward: Reward = {
        id: `reward-custom-${Date.now()}`,
        title: title.trim(),
        description: description.trim() || 'Hoạt động gắn kết cả gia đình cuối tuần.',
        iconName: 'Gift',
        colorTheme,
        approvedByParent: approved,
        active: approved,
      };
      await persist({
        ...data,
        rewards: [...data.rewards, newReward],
      });
    },
    [data, persist]
  );

  const deleteRewardByParent = useCallback(
    async (rewardId: string) => {
      const nextRewards = data.rewards.filter((r) => r.id !== rewardId);
      await persist({
        ...data,
        rewards: nextRewards,
      });
    },
    [data, persist]
  );

  const updatePointsPolicy = useCallback(
    async (policy: PointsPolicy) => {
      await persist({
        ...data,
        pointsPolicy: policy,
      });
    },
    [data, persist]
  );

  const updateParentSettings = useCallback(
    async (settings: Partial<ParentSettings>) => {
      await persist({
        ...data,
        parentSettings: {
          ...data.parentSettings,
          ...settings,
        },
      });
    },
    [data, persist]
  );

  const updateChildProfileName = useCallback(
    async (
      displayName: string,
      ageYears: number,
      parentConsentGranted: boolean,
      characterVariant?: ChildCharacterVariant
    ) => {
      const cleanName = displayName.trim() || 'Minh Anh';
      const safeAge = Math.max(4, Math.min(15, Math.round(ageYears)));
      const resolvedVariant: ChildCharacterVariant =
        characterVariant || data.profile.characterVariant || 'girl';
      setGlobalCharacterVariant(resolvedVariant);
      await persist({
        ...data,
        profile: {
          ...data.profile,
          displayName: cleanName,
          nickname: `Bé ${cleanName}`,
          ageYears: safeAge,
          ageGroup: safeAge <= 8 ? '6-8' : '9-12',
          parentConsentGranted,
          characterVariant: resolvedVariant,
        },
      });
    },
    [data, persist]
  );

  const updateChildCharacterVariant = useCallback(
    async (characterVariant: ChildCharacterVariant) => {
      setGlobalCharacterVariant(characterVariant);
      await persist({
        ...data,
        profile: {
          ...data.profile,
          characterVariant,
        },
      });
    },
    [data, persist]
  );

  const resetDemoData = useCallback(async () => {
    voiceService.stop();
    podcastPlaybackController.stopAndCleanup();
    const fresh = await appRepository.resetToSeedData();
    setGlobalCharacterVariant(fresh.profile.characterVariant || 'girl');
    setData(fresh);
    setSubView({ type: 'none' });
    setActiveTab('home');
  }, []);

  const starSummary = calculateStarSummary(data.starLedger, data.pointsPolicy);

  return (
    <BuddyContext.Provider
      value={{
        data,
        isLoaded,
        storageMode: appRepository.getStorageMode(),
        geminiConfigured,
        activeTab,
        subView,
        voiceState,
        voiceCapabilities,
        celebration,
        parentUnlocked,
        activeReminder,
        starSummary,
        isBuddyChatOpen,
        isBuddyMinimized,
        openBuddyChat,
        closeBuddyChat,
        minimizeBuddyChat,
        activeTaskStepContext,
        setActiveTaskStepContext,
        selectedJourneyTopicId,
        setSelectedJourneyTopicId,
        updateGrowthExperienceStatus,
        saveGrowthTopicByParent,
        saveGrowthCurriculumBatchByParent,
        greetingInfo,
        hasGreetedThisSession,
        needsManualGreetingButton,
        triggerBuddyGreeting,
        schoolPrepReminder,
        speakSchoolPrepReminder,
        dismissSchoolPrepReminder,
        updateSchoolSchedule,
        navigateTab,
        openSubView,
        closeSubView,
        dismissCelebration,
        dismissReminder,
        unlockParentArea,
        lockParentArea,
        sendChatMessage,
        isChatLoading,
        clearChatHistory,
        completeTaskStepRun,
        toggleRoutineDirectCheckin,
        confirmOfflineActivityForDate,
        awardStoryReflectionStar,
        awardParentPraiseStar,
        spinRewardWheel,
        confirmRewardSpinByParent,
        tonightScheduledStory,
        saveParentStory,
        saveParentStoryBatch,
        reorderStoriesByParent,
        synthesizeStoryPodcastEpisode,
        deleteParentStory,
        toggleStoryVisibility,
        updateBedtimeStoryConfig,
        updateVoicePreference,
        saveAndApproveTask,
        createNewApprovedTask,
        deleteTaskByParent,
        updateRoutineConfig,
        updateRewardConfig,
        addFamilyReward,
        deleteRewardByParent,
        updatePointsPolicy,
        updateParentSettings,
        updateChildProfileName,
        updateChildCharacterVariant,
        resetDemoData,
      }}
    >
      {children}
    </BuddyContext.Provider>
  );
};

export function useBuddy(): BuddyContextValue {
  const ctx = useContext(BuddyContext);
  if (!ctx) {
    throw new Error('useBuddy must be used inside BuddyProvider');
  }
  return ctx;
}
