/**
 * Typed Domain Models for Buddy – AI Personal Buddy (v1.3 UX/UI Restructure & Growth Journey)
 * Covers all required entities: ChildProfile, VoicePreference, Task, TaskStep,
 * Routine, SchoolScheduleConfig, TaskRun, StarTransaction, Reward, RewardSpin,
 * Story, BedtimeStoryConfig, GrowthQualityTopic, GrowthJourneyLog, ParentApproval.
 */

export type VoiceGender = 'female' | 'male';

export type VoiceContextType = 'greeting' | 'chat' | 'guide' | 'story' | 'celebration';

export interface VoicePreference {
  gender: VoiceGender;
  volume: number; // 0.0 to 1.0
  muted: boolean;
  speechRate: number; // 0.85 to 1.15
  preferServerTts: boolean;
  updatedAt: string;
}

export type ChildCharacterVariant = 'boy' | 'girl';

export interface ChildProfile {
  id: string;
  displayName: string; // Fictional demo child name "Minh Anh"
  nickname: string;
  ageGroup: '6-8' | '9-12';
  ageYears: number;
  avatarColor: string;
  currentCycleMonth: string; // e.g. "2026-11"
  isDemoProfile: boolean;
  parentConsentGranted: boolean;
  characterVariant?: ChildCharacterVariant; // 'boy' | 'girl' selected explicitly by Parent
}

export type IllustrationKey =
  | 'schedule-check'
  | 'take-books'
  | 'pack-books'
  | 'pencil-case'
  | 'water-bottle'
  | 'tidy-desk'
  | 'sort-books'
  | 'wipe-table'
  | 'pen-holder'
  | 'toy-box'
  | 'building-blocks'
  | 'plush-friends'
  | 'wash-hands'
  | 'soap-bubbles'
  | 'clean-towel'
  | 'clothes-ready'
  | 'shoes-hat'
  | 'check-list';

export interface TaskStep {
  id: string;
  stepNumber: number;
  actionTitle: string; // 1 clear action
  instruction: string; // Concise Vietnamese instruction
  simpleExplanation: string; // Shown when child taps "Con chưa hiểu"
  buddyPraise: string; // Supportive response when step is completed
  illustrationKey: IllustrationKey;
}

export type ApprovalStatus = 'approved' | 'pending_review' | 'draft';

export interface ParentApproval {
  id: string;
  targetType: 'task' | 'reward' | 'story' | 'routine' | 'schedule' | 'journey';
  targetId: string;
  status: ApprovalStatus;
  reviewedBy: string;
  reviewedAt: string;
  notes?: string;
}

export interface Task {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: 'study' | 'tidy' | 'hygiene' | 'preparation';
  iconName: string;
  themeColor: 'ice' | 'mint' | 'yellow' | 'peach' | 'lavender';
  coverIllustration: IllustrationKey;
  estimatedMinutes: number;
  starReward: number;
  approvalStatus: ApprovalStatus;
  lastApprovedAt: string;
  steps: TaskStep[];
}

export type RoutinePeriod = 'morning' | 'after_school' | 'evening';

export interface Routine {
  id: string;
  title: string;
  period: RoutinePeriod;
  dueTime: string; // "07:00", "17:30", "20:00"
  linkedTaskId: string;
  reminderEnabled: boolean;
  approvedByParent: boolean;
  completedDates: string[]; // Array of YYYY-MM-DD strings when completed
}

/**
 * v1.2 Parent School Schedule & Reminders
 */
export type DayOfWeekNumber = 1 | 2 | 3 | 4 | 5 | 6 | 0; // 1 = Thứ Hai ... 6 = Thứ Bảy, 0 = Chủ Nhật

export interface SchoolDaySchedule {
  dayOfWeek: DayOfWeekNumber;
  dayLabel: string; // "Thứ Hai", "Thứ Ba", ...
  subjects: string[]; // e.g., ["Toán", "Tiếng Việt", "Mỹ thuật"]
  supplies: string[]; // e.g., ["Sách Toán", "Vở ô ly", "Hộp bút màu"]
  note?: string;
}

export interface SchoolScheduleOverride {
  id: string;
  dateKey: string; // YYYY-MM-DD (cho ngày ngoại lệ / sự kiện đặc biệt)
  reason: string; // e.g. "Hoạt động ngoại khóa", "Thi giữa kỳ"
  subjects: string[];
  supplies: string[];
}

export interface SchoolScheduleConfig {
  cycleType: 'weekly' | 'monthly';
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string; // YYYY-MM-DD
  prepReminderTime: string; // e.g. "19:45"
  reminderEnabled: boolean;
  weeklyDays: SchoolDaySchedule[];
  dateOverrides: SchoolScheduleOverride[];
  updatedAt: string;
}

export interface TaskRun {
  id: string;
  taskId: string;
  routineId?: string;
  dateKey: string; // YYYY-MM-DD
  startedAt: string;
  completedStepIds: string[];
  helpRequestedStepIds: string[];
  status: 'in_progress' | 'completed';
  completedAt?: string;
  starsAwarded: number;
  confirmedOffline?: boolean;
}

export type StarSourceType =
  | 'task_completion'
  | 'routine_checkin'
  | 'parent_encouragement'
  | 'story_reflection'
  | 'growth_experience';

export interface StarTransaction {
  id: string;
  childId: string;
  dateKey: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  amount: number; // Always positive (> 0), no negative stars
  sourceType: StarSourceType;
  sourceId: string;
  idempotencyKey: string; // Prevents duplicate awards for the same eligible action
  title: string;
  note: string;
  createdAt: string;
}

export interface PointsPolicy {
  taskCompletionStars: number;
  routineBonusStars: number;
  storyReflectionStars: number;
  parentPraiseStars: number;
  monthlyWheelThresholdStars: number;
  maxDailyTaskAwardsPerTask: number;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  iconName: string;
  colorTheme: 'ice' | 'lavender' | 'mint' | 'yellow' | 'peach';
  approvedByParent: boolean;
  active: boolean;
}

export interface RewardSpin {
  id: string;
  childId: string;
  cycleMonth: string; // e.g., "2026-11"
  rewardId: string;
  rewardTitle: string;
  spunAt: string;
  status: 'pending_parent_confirmation' | 'confirmed';
  confirmedAt?: string;
  parentNote?: string;
  isDemoSimulation: boolean;
}

export type StoryCategory =
  | 'Truyện dân gian Việt Nam'
  | 'Vượt khó và kiên trì'
  | 'Biết ơn và yêu thương'
  | 'Trung thực và sẻ chia'
  | 'Khám phá thế giới'
  | 'Truyện Ba Mẹ tải lên';

export type PodcastAudioStatus = 'none' | 'generating' | 'ready' | 'failed';

export type StoryApprovalStatus = 'draft' | 'approved' | 'rejected';

export interface StorySceneCue {
  sceneIndex: number;
  paragraphIndex: number;
  startTimeSec: number;
  endTimeSec: number;
  imageUrl: string;
  caption: string;
  mood?: string;
}

export interface StorySourceDocumentInfo {
  fileName?: string;
  uploadedAt?: string;
  fileType?: 'docx' | 'pdf' | 'txt' | 'manual';
  originalLengthChars?: number;
  episodeIndex?: number;
  episodeNumber?: number;
  totalEpisodesInDoc?: number;
}

export interface Story {
  id: string;
  title: string;
  category: StoryCategory;
  summary: string;
  durationMinutes: number;
  ageRecommendation: string;
  coverTheme: 'lavender' | 'ice' | 'mint' | 'yellow' | 'peach';
  illustrationType: 'tich-chu' | 'kien-nho' | 'hat-giong' | 'chim-se' | 'bau-troi-dem';
  paragraphs: string[];
  moralLesson: string;
  reflectionQuestion: string;
  reflectionSuggestions: string[];
  approvedByParent: boolean;
  // v1.2 Parent-Uploaded Bedtime Story fields
  isParentUploaded?: boolean;
  sourceFileName?: string;
  sourceType?: 'builtin' | 'pdf' | 'docx' | 'txt' | 'manual';
  hiddenByParent?: boolean;
  askQuestionAfterStory?: boolean; // Parent can toggle whether Buddy asks 1 question after story
  scheduledDates?: string[]; // YYYY-MM-DD dates when this story is scheduled
  createdAt?: string;
  uploadedAt?: string;
  // v1.4 Continuous Podcast & AI Episode Library fields
  audioAssetId?: string;
  audioUrl?: string;
  audioStatus?: PodcastAudioStatus;
  actualDurationSeconds?: number;
  voiceId?: string;
  voiceGender?: VoiceGender;
  voiceVersion?: string;
  baseSpeed?: number;
  contentVersion?: number;
  sceneTimeline?: StorySceneCue[];
  paragraphSceneImages?: Array<{ imageUrl?: string; caption?: string }>;
  sourceDocumentInfo?: StorySourceDocumentInfo;
  approvalStatus?: StoryApprovalStatus;
  orderIndex?: number;
}

export interface BedtimeStoryConfig {
  bedtimeReminderTime: string; // e.g. "20:30"
  tonightStoryId?: string;
  scheduledByDate: Record<string, string>; // YYYY-MM-DD -> storyId
  enablePostStoryQuestion: boolean;
  updatedAt: string;
}

/**
 * v1.3 NEW GROWTH JOURNEY – HÀNH TRÌNH CỦA CON
 * No moral grading or percentage scores on child's character.
 * Tracks experiential stages: Chưa khám phá | Đang thực hiện | Đã trải nghiệm | Muốn thử lại.
 */
export type GrowthExperienceType = 'explore' | 'understand' | 'practice' | 'share';

export type GrowthExperienceStatus =
  | 'not_explored' // Chưa khám phá
  | 'in_progress' // Đang thực hiện
  | 'experienced' // Đã trải nghiệm
  | 'want_to_retry'; // Muốn thử lại

export type GrowthActivityInputType =
  | 'single_choice'
  | 'multi_choice'
  | 'short_text'
  | 'emotion_log'
  | 'real_life_action';

export interface GrowthExperienceItem {
  id: string;
  type: GrowthExperienceType;
  typeLabel: 'Khám phá' | 'Hiểu' | 'Thực hành' | 'Chia sẻ';
  title: string;
  promptOrStory: string;
  inputType?: GrowthActivityInputType;
  choices?: string[]; // Optional gentle reflection/understanding options (non-judgmental)
  actionSuggestion?: string; // Real-life practice suggestion or sharing prompt
  buddyWarmFeedback: string;
  status: GrowthExperienceStatus;
  childResponse?: string;
  selectedChoices?: string[];
  emotionTag?: string;
  realLifeConfirmed?: boolean;
  lastUpdatedAt?: string;
}

export type GrowthQualitySlug =
  | 'gratitude' // Lòng biết ơn
  | 'honesty' // Tính trung thực
  | 'courage' // Lòng dũng cảm
  | 'sharing' // Sự sẻ chia
  | 'responsibility' // Tính trách nhiệm
  | 'perseverance' // Lòng kiên trì
  | 'kindness' // Sự tử tế
  | 'independence'; // Tính tự lập

export interface GrowthQualityTopic {
  id: string;
  slug: GrowthQualitySlug;
  stageOrder: number; // 1 to N on the roadmap
  title: string; // e.g., "Lòng biết ơn"
  subtitle: string; // e.g., "Trân trọng những điều ấm áp quanh con"
  landmarkName: string; // e.g., "Khu vườn Hướng Dương"
  themeColor: 'ice' | 'mint' | 'yellow' | 'peach' | 'lavender';
  illustrationKey: IllustrationKey;
  starRewardPerExperience: number;
  approvalStatus: ApprovalStatus;
  selectedByParent: boolean;
  isCurrentFocus?: boolean;
  xPercent?: number; // Horizontal position (%) on the illustrated parchment adventure map
  yPercent?: number; // Vertical position (%) on the illustrated parchment adventure map
  version?: number; // Curriculum version for non-destructive parent edits
  isParentUploaded?: boolean;
  sourceFileName?: string;
  experiences: GrowthExperienceItem[]; // 4 experiences: Khám phá, Hiểu, Thực hành, Chia sẻ
  updatedAt: string;
}

export interface TaskStepAssetBinding {
  taskId: string;
  stepId: string;
  stepNumber: number;
  illustrationKey: IllustrationKey;
  coverImage: string;
  stepImage: string;
  helpImage: string;
  hasRealArtwork: boolean;
}

export interface GrowthJourneyLog {
  id: string;
  topicId: string;
  topicTitle: string;
  experienceId: string;
  experienceType: GrowthExperienceType;
  experienceTitle: string;
  status: GrowthExperienceStatus;
  childReflection?: string;
  buddyFeedback: string;
  dateKey: string; // YYYY-MM-DD
  createdAt: string;
}

export interface CompanionActionDirective {
  intent:
    | 'greeting_chat'
    | 'start_task'
    | 'ask_today_activities'
    | 'need_help'
    | 'listen_story'
    | 'view_stars_rewards'
    | 'open_journey';
  autoNavigate: boolean;
  taskId?: string;
  storyId?: string;
  topicId?: string;
  targetTab?: 'home' | 'activities' | 'journey' | 'profile' | 'buddy';
  targetSubView?:
    | { type: 'guide-task'; taskId?: string; routineId?: string }
    | { type: 'story-list' }
    | { type: 'story-detail'; storyId: string }
    | { type: 'stars-detail' }
    | { type: 'rewards-wheel' }
    | { type: 'monthly-tracker'; filterTaskId?: string };
  cardTitle?: string;
  cardSubtitle?: string;
  helpExplanation?: string;
  illustrationKey?: IllustrationKey;
  ctaLabel?: string;
}

export interface ChatMessage {
  id: string;
  role: 'child' | 'buddy';
  text: string;
  createdAt: string;
  mode?: 'gemini-live' | 'demo-fallback' | 'safety-guardrail';
  intentTag?: string;
  actionDirective?: CompanionActionDirective;
  actionCard?: {
    intent:
      | 'start_task'
      | 'today_activities'
      | 'tell_story'
      | 'need_help'
      | 'view_stars_rewards'
      | 'open_journey'
      | 'greeting_or_chat';
    actionLabel: string;
    taskId?: string;
    storyId?: string;
    topicId?: string;
    helpTopicTaskId?: string;
    targetTab?: 'home' | 'activities' | 'journey' | 'profile' | 'buddy';
  };
}

export interface ParentSettings {
  dailyScreenLimitMinutes: number;
  bedtimeQuietHour: string; // e.g., "21:00"
  requireParentConfirmationForRewards: boolean;
  allowVoiceInput: boolean;
  demoPasscode: string;
}

export interface BuddyAppData {
  profile: ChildProfile;
  voicePreference: VoicePreference;
  pointsPolicy: PointsPolicy;
  tasks: Task[];
  routines: Routine[];
  schoolSchedule: SchoolScheduleConfig;
  taskRuns: TaskRun[];
  starLedger: StarTransaction[];
  rewards: Reward[];
  rewardSpins: RewardSpin[];
  stories: Story[];
  bedtimeStoryConfig: BedtimeStoryConfig;
  growthTopics: GrowthQualityTopic[];
  growthLogs: GrowthJourneyLog[];
  parentApprovals: ParentApproval[];
  chatHistory: ChatMessage[];
  parentSettings: ParentSettings;
}
