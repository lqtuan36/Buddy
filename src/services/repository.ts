import { BuddyAppData, Story } from '../types/domain';
import { createInitialSeedData } from '../data/seedData';
import { getCurrentMonthKey } from './pointsPolicy';

export type StorageMode = 'local-demo' | 'firebase-cloud';

export interface IDataRepository {
  getStorageMode(): StorageMode;
  loadAppData(): Promise<BuddyAppData>;
  saveAppData(data: BuddyAppData): Promise<void>;
  resetToSeedData(): Promise<BuddyAppData>;
}

/**
 * Dedicated StoryRepository interface ready for Firebase Storage / Firestore migration.
 * In Local Storage Demo mode, enforces safe document size limits and clear privacy labeling.
 */
export interface IStoryRepository {
  getStorageMode(): StorageMode;
  getMaxUploadBytes(): number;
  validateStoryPayload(story: Story): { valid: boolean; reason?: string };
}

const STORAGE_KEY = 'buddy_ai_personal_buddy_state_v1';
const MAX_DEMO_STORY_CHARS = 35000; // Safe limit for localStorage demo mode

export class LocalDemoStoryRepository implements IStoryRepository {
  getStorageMode(): StorageMode {
    return 'local-demo';
  }

  getMaxUploadBytes(): number {
    return 1536 * 1024; // 1.5 MB max upload file size in Demo Mode
  }

  validateStoryPayload(story: Story): { valid: boolean; reason?: string } {
    const joined = story.paragraphs.join('\n');
    if (!story.title.trim()) {
      return { valid: false, reason: 'Vui lòng nhập tiêu đề câu chuyện.' };
    }
    if (story.paragraphs.length === 0 || joined.trim().length < 20) {
      return {
        valid: false,
        reason: 'Nội dung truyện quá ngắn. Ba mẹ vui lòng nhập ít nhất 1 đoạn truyện.',
      };
    }
    if (joined.length > MAX_DEMO_STORY_CHARS) {
      return {
        valid: false,
        reason: `Trong chế độ Local Storage Demo, nội dung mỗi truyện tối đa ${MAX_DEMO_STORY_CHARS.toLocaleString()} ký tự để đảm bảo bộ nhớ trình duyệt hoạt động mượt mà.`,
      };
    }
    return { valid: true };
  }
}

export const storyRepository: IStoryRepository = new LocalDemoStoryRepository();

/**
 * LocalDemoRepository
 * Persists demo state in localStorage with explicit DEMO labeling and v1.2 schema migration.
 * Implements IDataRepository so migrating to Firebase Firestore only requires
 * swapping the repository implementation without touching UI components.
 */
export class LocalDemoRepository implements IDataRepository {
  getStorageMode(): StorageMode {
    return 'local-demo';
  }

  async loadAppData(): Promise<BuddyAppData> {
    const seed = createInitialSeedData();
    if (typeof window === 'undefined') {
      return seed;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        return seed;
      }
      const parsed = JSON.parse(raw) as Partial<BuddyAppData>;
      const merged: BuddyAppData = {
        ...seed,
        ...parsed,
        profile: {
          ...seed.profile,
          ...(parsed.profile || {}),
          characterVariant:
            parsed.profile?.characterVariant === 'boy' ||
            parsed.profile?.characterVariant === 'girl'
              ? parsed.profile.characterVariant
              : seed.profile.characterVariant || 'girl',
          currentCycleMonth: getCurrentMonthKey(),
        },
        voicePreference: {
          ...seed.voicePreference,
          ...(parsed.voicePreference || {}),
        },
        pointsPolicy: {
          ...seed.pointsPolicy,
          ...(parsed.pointsPolicy || {}),
          monthlyWheelThresholdStars:
            parsed.pointsPolicy?.monthlyWheelThresholdStars &&
            parsed.pointsPolicy.monthlyWheelThresholdStars !== 15 &&
            parsed.pointsPolicy.monthlyWheelThresholdStars !== 20
              ? parsed.pointsPolicy.monthlyWheelThresholdStars
              : 50,
        },
        parentSettings: {
          ...seed.parentSettings,
          ...(parsed.parentSettings || {}),
        },
        schoolSchedule: {
          ...seed.schoolSchedule,
          ...(parsed.schoolSchedule || {}),
          weeklyDays:
            Array.isArray(parsed.schoolSchedule?.weeklyDays) &&
            parsed.schoolSchedule!.weeklyDays.length > 0
              ? parsed.schoolSchedule!.weeklyDays
              : seed.schoolSchedule.weeklyDays,
          dateOverrides: Array.isArray(parsed.schoolSchedule?.dateOverrides)
            ? parsed.schoolSchedule!.dateOverrides
            : seed.schoolSchedule.dateOverrides,
        },
        bedtimeStoryConfig: {
          ...seed.bedtimeStoryConfig,
          ...(parsed.bedtimeStoryConfig || {}),
          scheduledByDate: {
            ...seed.bedtimeStoryConfig.scheduledByDate,
            ...(parsed.bedtimeStoryConfig?.scheduledByDate || {}),
          },
        },
        tasks:
          Array.isArray(parsed.tasks) && parsed.tasks.length > 0
            ? parsed.tasks.map((t) => {
                // Ensure task-backpack is upgraded to the 5 distinct Warm Storybook steps in v1.3
                if (t.id === 'task-backpack' && t.steps.length < 5) {
                  return seed.tasks.find((st) => st.id === 'task-backpack') || t;
                }
                return t;
              })
            : seed.tasks,
        routines:
          Array.isArray(parsed.routines) && parsed.routines.length > 0
            ? parsed.routines
            : seed.routines,
        stories:
          Array.isArray(parsed.stories) && parsed.stories.length > 0
            ? parsed.stories.map((st, idx) => ({
                ...st,
                contentVersion: st.contentVersion ?? 1,
                orderIndex: st.orderIndex ?? idx,
                approvalStatus:
                  st.approvalStatus ?? (st.approvedByParent ? 'approved' : 'draft'),
                audioStatus:
                  st.audioStatus === 'generating'
                    ? 'none'
                    : st.audioStatus ?? (st.audioUrl ? 'ready' : 'none'),
              }))
            : seed.stories.map((st, idx) => ({
                ...st,
                contentVersion: st.contentVersion ?? 1,
                orderIndex: st.orderIndex ?? idx,
                approvalStatus:
                  st.approvalStatus ?? (st.approvedByParent ? 'approved' : 'draft'),
                audioStatus: st.audioStatus ?? 'none',
              })),
        rewards:
          Array.isArray(parsed.rewards) && parsed.rewards.length > 0
            ? parsed.rewards
            : seed.rewards,
        growthTopics:
          Array.isArray(parsed.growthTopics) && parsed.growthTopics.length > 0
            ? parsed.growthTopics.map((savedTopic, idx) => {
                const seedMatch = seed.growthTopics.find(
                  (st) => st.id === savedTopic.id || st.slug === savedTopic.slug
                );
                // Default winding trail coordinates from bottom (88%) to top (18%)
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
                const fallbackCoord = defaultCoords[idx % defaultCoords.length];
                return {
                  ...(seedMatch || {}),
                  ...savedTopic,
                  xPercent:
                    savedTopic.xPercent ??
                    seedMatch?.xPercent ??
                    fallbackCoord.x,
                  yPercent:
                    savedTopic.yPercent ??
                    seedMatch?.yPercent ??
                    fallbackCoord.y,
                  version: savedTopic.version ?? 1,
                  experiences: Array.isArray(savedTopic.experiences)
                    ? savedTopic.experiences.map((savedExp, eIdx) => {
                        const seedExp = seedMatch?.experiences?.[eIdx];
                        return {
                          ...(seedExp || {}),
                          ...savedExp,
                        };
                      })
                    : seedMatch?.experiences || [],
                };
              })
            : seed.growthTopics,
        growthLogs: Array.isArray(parsed.growthLogs) ? parsed.growthLogs : seed.growthLogs,
        starLedger: Array.isArray(parsed.starLedger) ? parsed.starLedger : seed.starLedger,
        rewardSpins: Array.isArray(parsed.rewardSpins) ? parsed.rewardSpins : seed.rewardSpins,
        taskRuns:
          Array.isArray(parsed.taskRuns) && parsed.taskRuns.length > 0
            ? parsed.taskRuns
            : seed.taskRuns,
        parentApprovals: Array.isArray(parsed.parentApprovals)
          ? parsed.parentApprovals
          : seed.parentApprovals,
        chatHistory:
          Array.isArray(parsed.chatHistory) && parsed.chatHistory.length > 0
            ? parsed.chatHistory
            : seed.chatHistory,
      };
      return merged;
    } catch {
      return seed;
    }
  }

  async saveAppData(data: BuddyAppData): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Không thể lưu dữ liệu vào bộ nhớ trình duyệt:', err);
    }
  }

  async resetToSeedData(): Promise<BuddyAppData> {
    const seed = createInitialSeedData();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    }
    return seed;
  }
}

export const appRepository: IDataRepository = new LocalDemoRepository();
