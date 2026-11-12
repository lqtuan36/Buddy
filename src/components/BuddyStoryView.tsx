import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Clock,
  Moon,
  Sparkles,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Heart,
  Headphones,
  RefreshCw,
} from 'lucide-react';
import { useBuddy } from '../context/BuddyContext';
import { Story, StoryCategory } from '../types/domain';
import {
  StoryEditorialIllustration,
  StoryParagraphSceneIllustration,
  getDefaultStorySceneCues,
} from './BuddyIllustrations';
import { BuddyAvatar } from './BuddyAvatar';
import { voiceService } from '../services/voiceService';
import {
  podcastPlaybackController,
  PodcastPlaybackSnapshot,
  formatPodcastTime,
} from '../services/podcastPlaybackController';

const STORY_CATEGORIES: Array<'Tất cả' | StoryCategory> = [
  'Tất cả',
  'Truyện Ba Mẹ tải lên',
  'Truyện dân gian Việt Nam',
  'Vượt khó và kiên trì',
  'Biết ơn và yêu thương',
  'Trung thực và sẻ chia',
  'Khám phá thế giới',
];

const PODCAST_PROGRESS_STORAGE_KEY = 'buddy_v14_podcast_progress_v2';

interface StoryPodcastProgressItem {
  currentTimeSec: number;
  durationSec: number;
  currentParagraph: number;
  totalParagraphs: number;
  status: 'not_started' | 'listening' | 'completed';
  updatedAt: string;
}

type PodcastProgressMap = Record<string, StoryPodcastProgressItem>;

function loadPodcastProgressMap(): PodcastProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PODCAST_PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PodcastProgressMap;
  } catch {
    return {};
  }
}

function savePodcastProgressItem(
  storyId: string,
  item: StoryPodcastProgressItem
): PodcastProgressMap {
  const current = loadPodcastProgressMap();
  const next: PodcastProgressMap = {
    ...current,
    [storyId]: item,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PODCAST_PROGRESS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }
  return next;
}

const YOUTUBE_SPEED_OPTIONS: Array<{ rate: number; label: string }> = [
  { rate: 0.85, label: '0.85x' },
  { rate: 1.0, label: '1x' },
  { rate: 1.1, label: '1.1x' },
  { rate: 1.25, label: '1.25x' },
];

/**
 * 6) BUDDY STORY PODCAST LIBRARY & CONTINUOUS YOUTUBE-STYLE PODCAST PLAYER (v1.4)
 * - Continuous full-episode audio synthesis & caching (no paragraph-by-paragraph restarts)
 * - Instant <50ms synchronous Pause/Resume from exact timestamp
 * - YouTube-inspired unified control frame: scrubbable timeline slider, mm:ss / mm:ss,
 *   Rewind 15s (-15s), Center Play/Pause, Forward 15s (+15s), Speed (0.85x, 1x, 1.1x, 1.25x),
 *   and Volume/Mute controls
 * - Automatic Warm Storybook scene illustration transitions along the episode timeline
 */
export const BuddyStoryLibraryView: React.FC<{
  onSelectStory: (storyId: string) => void;
  onBack: () => void;
}> = ({ onSelectStory, onBack }) => {
  const { data, tonightScheduledStory } = useBuddy();
  const [selectedCategory, setSelectedCategory] = useState<'Tất cả' | StoryCategory>('Tất cả');
  const [progressMap] = useState<PodcastProgressMap>(() => loadPodcastProgressMap());

  // Only show stories approved, not hidden by Parent, and not in failed audio generation state
  const approvedStories = [...data.stories]
    .filter(
      (s) =>
        s.approvedByParent &&
        !s.hiddenByParent &&
        s.audioStatus !== 'failed'
    )
    .sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999));

  const filteredStories =
    selectedCategory === 'Tất cả'
      ? approvedStories
      : approvedStories.filter(
          (s) =>
            s.category === selectedCategory ||
            (selectedCategory === 'Truyện Ba Mẹ tải lên' && s.isParentUploaded)
        );

  const renderEpisodeDurationText = (story: Story) => {
    if (story.actualDurationSeconds && story.actualDurationSeconds > 0) {
      return `Thời lượng ${formatPodcastTime(story.actualDurationSeconds)}`;
    }
    return `Ước tính ~${story.durationMinutes || 3} phút`;
  };

  const renderListeningBadge = (story: Story) => {
    const prog = progressMap[story.id];
    const hasLedgerStar = data.starLedger.some(
      (tx) => tx.sourceType === 'story_reflection' && tx.sourceId === story.id
    );

    if (prog?.status === 'completed' || hasLedgerStar) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#DDF5E8] text-[#188050] font-kids font-extrabold text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Đã nghe</span>
        </span>
      );
    }
    if (prog?.status === 'listening' && prog.currentTimeSec > 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#EAF3FF] text-[#3978F6] font-kids font-extrabold text-[11px] tabular-nums">
          <Headphones className="w-3.5 h-3.5" />
          <span>
            Đang nghe · {formatPodcastTime(prog.currentTimeSec)} /{' '}
            {formatPodcastTime(prog.durationSec || (story.durationMinutes || 3) * 60)}
          </span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#F7F9FD] text-[#5C6F8C] font-kids font-extrabold text-[11px]">
        <span>Chưa nghe</span>
      </span>
    );
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-[18px] bg-white hover:bg-[#EDE7FF] border border-[#23324D]/8 text-xs sm:text-sm font-kids font-bold text-[#23324D] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Trang chủ</span>
        </button>

        <div className="inline-flex items-center gap-1.5 text-xs font-kids font-bold text-indigo-900 bg-[#EDE7FF] px-3 py-1.5 rounded-[18px] tabular-nums">
          <Moon className="w-3.5 h-3.5 text-indigo-600" />
          <span>Podcast đêm khuya · {data.bedtimeStoryConfig?.bedtimeReminderTime || '20:30'}</span>
        </div>
      </div>

      {/* Calm Bedtime Podcast Hero */}
      <section className="rounded-[28px] bg-gradient-to-br from-[#23324D] via-[#2D3E64] to-[#435B8C] text-white p-5 flex items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#FFF0C9]">
            <Headphones className="w-3.5 h-3.5" />
            <span>Buddy Story Podcast ({approvedStories.length} tập âm thanh liên tục)</span>
          </span>
          <h1 className="font-kids text-xl sm:text-2xl font-extrabold leading-tight">
            Đài phát thanh cổ tích của {data.profile.displayName}
          </h1>
          <p className="text-xs text-white/80">
            Mỗi tập phát liền mạch với giọng kể tiếng Việt truyền cảm và tranh minh họa tự chuyển cảnh.
          </p>
        </div>
        <BuddyAvatar size="md" mood="calm" />
      </section>

      {/* Tonight's Parent-Scheduled Story Highlight */}
      {tonightScheduledStory && (
        <section
          aria-label="Truyện tối nay Ba Mẹ chọn cho con"
          className="rounded-[28px] bg-gradient-to-r from-[#EDE7FF] via-[#F5F2FF] to-[#FFF0C9] border-2 border-indigo-300/70 p-4 space-y-3 shadow-2xs"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-kids font-extrabold text-indigo-800">
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span>Tập Podcast tối nay Ba Mẹ chọn cho con</span>
            </span>
            {renderListeningBadge(tonightScheduledStory)}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-24 h-24 sm:w-28 sm:h-24 shrink-0">
                <StoryEditorialIllustration
                  type={tonightScheduledStory.illustrationType}
                  className="w-full h-full rounded-[18px]"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-kids font-bold text-[#3978F6]">
                    {tonightScheduledStory.category}
                  </span>
                  {tonightScheduledStory.sourceDocumentInfo?.episodeNumber && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-kids font-extrabold">
                      Tập {tonightScheduledStory.sourceDocumentInfo.episodeNumber}/
                      {tonightScheduledStory.sourceDocumentInfo.totalEpisodesInDoc || 1}
                    </span>
                  )}
                </div>
                <h2 className="font-kids text-base sm:text-lg font-extrabold text-[#23324D] leading-snug mt-0.5">
                  {tonightScheduledStory.title}
                </h2>
                <p className="text-xs text-[#23324D]/75 line-clamp-2 mt-0.5">
                  {tonightScheduledStory.summary}
                </p>
                <p className="text-[11px] font-kids font-bold text-[#5C6F8C] mt-1 tabular-nums">
                  {renderEpisodeDurationText(tonightScheduledStory)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectStory(tonightScheduledStory.id)}
              className="min-h-[44px] px-4 py-2.5 rounded-[18px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-xs sm:text-sm shrink-0 cursor-pointer shadow-2xs inline-flex items-center justify-center gap-1.5"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Nghe Podcast</span>
            </button>
          </div>
        </section>
      )}

      {/* Horizontal Scrollable Category Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {STORY_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-[18px] text-xs font-kids font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              selectedCategory === cat
                ? 'bg-[#3978F6] text-white shadow-2xs'
                : 'bg-white text-[#23324D]/75 hover:bg-[#EDE7FF] border border-[#23324D]/8'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Podcast Episode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredStories.length === 0 ? (
          <div className="md:col-span-2 rounded-[24px] bg-white border border-[#23324D]/8 p-6 text-center space-y-2">
            <p className="font-kids font-bold text-base text-[#23324D]">
              Chưa có câu chuyện nào trong chủ đề này.
            </p>
            <p className="text-xs text-[#23324D]/65">
              Ba mẹ có thể tải thêm truyện mới (.docx, .pdf, .txt) để AI biên tập thành các tập Podcast ~3 phút trong mục Buddy Parents nhé!
            </p>
          </div>
        ) : (
          filteredStories.map((story) => (
            <div
              key={story.id}
              onClick={() => onSelectStory(story.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectStory(story.id);
                }
              }}
              className="group rounded-[26px] bg-white border border-[#23324D]/8 p-4 shadow-[0_8px_24px_rgba(35,50,77,0.06)] hover:border-[#3978F6] transition-all cursor-pointer flex flex-col justify-between gap-3.5"
            >
              <div className="space-y-3">
                {/* Large Warm Storybook Cover Illustration */}
                <div className="relative">
                  <StoryEditorialIllustration
                    type={story.illustrationType}
                    className="w-full h-44 sm:h-48 rounded-[20px]"
                  />
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-white/95 text-[#23324D] font-kids font-extrabold text-[11px] shadow-2xs">
                      {story.category}
                    </span>
                    {renderListeningBadge(story)}
                  </div>
                  <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                    {story.isParentUploaded && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-rose-600/95 text-white font-kids font-extrabold text-[10px]">
                        Thư viện Gia đình
                      </span>
                    )}
                    {story.sourceDocumentInfo?.episodeNumber && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#23324D]/90 text-[#FFF0C9] font-kids font-extrabold text-[10px]">
                        Tập {story.sourceDocumentInfo.episodeNumber}/
                        {story.sourceDocumentInfo.totalEpisodesInDoc || 1}
                      </span>
                    )}
                  </div>
                </div>

                {/* Story Title & Summary */}
                <div className="space-y-1 px-0.5">
                  <h2 className="font-kids text-base sm:text-lg font-extrabold text-[#23324D] group-hover:text-[#3978F6] transition-colors leading-snug">
                    {story.title}
                  </h2>
                  <p className="text-xs text-[#5C6F8C] line-clamp-2 leading-relaxed">
                    {story.summary}
                  </p>
                </div>
              </div>

              {/* Footer: Explicit Duration + Rounded-18px Play Button */}
              <div className="pt-2.5 border-t border-[#23324D]/8 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-kids font-bold text-[#5C6F8C] tabular-nums">
                  <Clock className="w-3.5 h-3.5 text-[#3978F6]" />
                  <span>{renderEpisodeDurationText(story)}</span>
                </div>

                <span className="min-h-[38px] px-3.5 py-1.5 rounded-[18px] bg-[#3978F6] group-hover:bg-[#2964DF] text-white font-kids font-extrabold text-xs inline-flex items-center gap-1.5 shadow-2xs transition-colors">
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Nghe ngay</span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/**
 * StoryPlayerView – Continuous Episode Podcast Player with YouTube-Style Control Frame (v1.4 Section A.1–A.6)
 */
export const StoryPlayerView: React.FC<{
  storyId: string;
  onSelectStory?: (storyId: string) => void;
  onBack: () => void;
}> = ({ storyId, onSelectStory, onBack }) => {
  const {
    data,
    awardStoryReflectionStar,
    updateVoicePreference,
    saveParentStory,
  } = useBuddy();

  // Navigate only among parent-approved, non-hidden stories (Section A.5)
  const approvedStories = [...data.stories]
    .filter((s) => s.approvedByParent && !s.hiddenByParent)
    .sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999));

  const currentApprovedIndex = approvedStories.findIndex((s) => s.id === storyId);
  const prevStory =
    currentApprovedIndex > 0 ? approvedStories[currentApprovedIndex - 1] : null;
  const nextStory =
    currentApprovedIndex >= 0 && currentApprovedIndex < approvedStories.length - 1
      ? approvedStories[currentApprovedIndex + 1]
      : null;

  const story: Story | undefined =
    approvedStories.find((s) => s.id === storyId) ||
    data.stories.find((s) => s.id === storyId);

  const [snapshot, setSnapshot] = useState<PodcastPlaybackSnapshot>(() =>
    podcastPlaybackController.getSnapshot()
  );
  // Section A.1: Controls overlay visible on pointer enter / touch toggle, hidden (opacity-0 pointer-events-none) when mouse leaves
  const [controlsOverlayVisible, setControlsOverlayVisible] = useState(true);
  const [showReflection, setShowReflection] = useState(false);
  const [questionSkipped, setQuestionSkipped] = useState(false);
  const [reflectionStepIndex, setReflectionStepIndex] = useState<0 | 1 | 2>(0);
  const [reflectionAnswers, setReflectionAnswers] = useState<[string, string, string]>([
    '',
    '',
    '',
  ]);
  const [reflectionFeedback, setReflectionFeedback] = useState<string | null>(null);
  const closingSpokenForStoryRef = useRef<string | null>(null);

  const pref = data.voicePreference;

  // Subscribe to podcastPlaybackController
  useEffect(() => {
    const unsub = podcastPlaybackController.subscribe((nextSnap) => {
      setSnapshot(nextSnap);
      if (nextSnap.status === 'error' || nextSnap.audioStatus === 'failed') {
        setControlsOverlayVisible(true);
      }
    });
    return () => {
      unsub();
    };
  }, []);

  // Load or synthesize the continuous episode when entering the player or switching voice gender
  useEffect(() => {
    if (!story) return;
    let cancelled = false;
    closingSpokenForStoryRef.current = null;
    setShowReflection(false);
    setQuestionSkipped(false);
    setReflectionStepIndex(0);
    setReflectionAnswers(['', '', '']);
    setReflectionFeedback(null);
    setControlsOverlayVisible(true);
    voiceService.cancel();

    const baseCues = getDefaultStorySceneCues(story.illustrationType);
    const defaultCues = story.paragraphs.map((_, idx) => {
      const customImg = story.paragraphSceneImages?.[idx]?.imageUrl?.trim();
      const customCap = story.paragraphSceneImages?.[idx]?.caption?.trim();
      const fallback = baseCues[idx % Math.max(1, baseCues.length)];
      return {
        imageUrl: customImg || fallback?.imageUrl || '',
        sceneCaption: customCap || fallback?.sceneCaption || story.title,
      };
    });
    const savedProg = loadPodcastProgressMap()[story.id];
    const resumeAtSec =
      savedProg && savedProg.status === 'listening' && savedProg.currentTimeSec > 2
        ? savedProg.currentTimeSec
        : 0;

    void podcastPlaybackController.loadEpisode(story, pref, defaultCues, {
      initialTimeSec: resumeAtSec,
      autoPlay: false,
      forceRegenerate: false,
      onEpisodeMetadataReady: (res) => {
        if (cancelled) return;
        if (
          res.audioStatus === 'ready' &&
          res.audioUrl &&
          (story.audioAssetId !== res.audioAssetId || story.audioStatus !== 'ready')
        ) {
          void saveParentStory({
            ...story,
            audioStatus: 'ready',
            audioAssetId: res.audioAssetId,
            audioUrl: res.audioUrl,
            actualDurationSeconds: res.actualDurationSeconds,
            durationMinutes: Math.max(1, Math.round((res.actualDurationSeconds || 180) / 60)),
            voiceGender: pref.gender,
            sceneTimeline: res.sceneTimeline,
          });
        }
      },
    });

    return () => {
      cancelled = true;
      podcastPlaybackController.stopAndCleanup();
      voiceService.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, pref.gender]);

  // Persist listening progress & trigger 3 sequential post-story questions when episode reaches 'ended'
  useEffect(() => {
    if (!story) return;
    if (snapshot.storyId !== story.id) return;

    const totalParagraphs = Math.max(1, story.paragraphs.length);
    if (snapshot.status === 'playing' || snapshot.status === 'paused') {
      savePodcastProgressItem(story.id, {
        currentTimeSec: snapshot.currentTimeSec,
        durationSec: snapshot.durationSec,
        currentParagraph: snapshot.activeSceneIndex,
        totalParagraphs,
        status: 'listening',
        updatedAt: new Date().toISOString(),
      });
    } else if (snapshot.status === 'ended') {
      savePodcastProgressItem(story.id, {
        currentTimeSec: snapshot.durationSec,
        durationSec: snapshot.durationSec,
        currentParagraph: totalParagraphs - 1,
        totalParagraphs,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      });

      const shouldAsk =
        story.askQuestionAfterStory !== false &&
        data.bedtimeStoryConfig?.enablePostStoryQuestion !== false;

      if (closingSpokenForStoryRef.current !== story.id) {
        closingSpokenForStoryRef.current = story.id;
        if (shouldAsk && !questionSkipped) {
          setShowReflection(true);
          setReflectionStepIndex(0);
        }
      }
    }
  }, [
    story,
    snapshot.storyId,
    snapshot.status,
    snapshot.currentTimeSec,
    snapshot.durationSec,
    snapshot.activeSceneIndex,
    data.bedtimeStoryConfig?.enablePostStoryQuestion,
    questionSkipped,
  ]);

  if (!story) {
    return (
      <div className="rounded-[24px] bg-white p-6 text-center space-y-4">
        <p className="font-kids font-bold text-lg">Không tìm thấy câu chuyện.</p>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-4 py-2 rounded-[18px] bg-[#3978F6] text-white font-bold cursor-pointer"
        >
          Quay lại
        </button>
      </div>
    );
  }

  const totalParagraphs = Math.max(1, story.paragraphs.length);
  const safeSceneIndex = Math.min(
    Math.max(0, snapshot.activeSceneIndex),
    totalParagraphs - 1
  );
  const activeCue = snapshot.sceneTimeline[safeSceneIndex];

  const shouldAskQuestionAfterStory =
    story.askQuestionAfterStory !== false &&
    data.bedtimeStoryConfig?.enablePostStoryQuestion !== false;

  const isPlaying = snapshot.status === 'playing';
  const isGenerating =
    snapshot.status === 'generating' ||
    snapshot.status === 'loading' ||
    snapshot.audioStatus === 'generating';
  const isErrorState =
    snapshot.status === 'error' || snapshot.audioStatus === 'failed';
  const isStoryFinished = snapshot.status === 'ended';

  const durationSec = Math.max(1, snapshot.durationSec || (story.durationMinutes || 3) * 60);
  const currentTimeSec = Math.min(durationSec, Math.max(0, snapshot.currentTimeSec || 0));
  const progressPercent = Math.min(100, Math.max(0, (currentTimeSec / durationSec) * 100));

  // Build 3 sequential questions suitable for 1st graders (age 6–7) (Section A.6)
  const sequentialQuestions: Array<{
    stepNumber: 1 | 2 | 3;
    badge: string;
    question: string;
    options: string[];
  }> = [
    {
      stepNumber: 1,
      badge: 'Câu hỏi 1/3 · Hiểu câu chuyện',
      question:
        story.reflectionQuestion ||
        `Trong câu chuyện "${story.title}", điều gì làm con nhớ nhất?`,
      options:
        Array.isArray(story.reflectionSuggestions) && story.reflectionSuggestions.length >= 2
          ? story.reflectionSuggestions
          : [
              'Nhân vật biết yêu thương và giúp đỡ mọi người',
              'Nhân vật kiên trì vượt qua thử thách nhỏ',
              'Cả nhà luôn ấm áp bên nhau',
            ],
    },
    {
      stepNumber: 2,
      badge: 'Câu hỏi 2/3 · Chi tiết con yêu thích',
      question: 'Con thích chi tiết nào nhất trong câu chuyện vừa rồi?',
      options: [
        'Lúc nhân vật chính cố gắng làm điều tốt thật đáng yêu',
        'Khung cảnh thiên nhiên và ngôi nhà ấm áp trong truyện',
        'Khoảnh khắc mọi người mỉm cười hạnh phúc bên nhau',
      ],
    },
    {
      stepNumber: 3,
      badge: 'Câu hỏi 3/3 · Việc tốt nhỏ của con',
      question: 'Sau câu chuyện này, con muốn làm điều tốt nhỏ gì nhỉ?',
      options: [
        'Nói lời cảm ơn và ôm ba mẹ, ông bà trước khi đi ngủ',
        'Tự giác chuẩn bị đồ dùng và giúp đỡ việc nhỏ trong nhà',
        'Chia sẻ niềm vui và đối xử dịu dàng với bạn bè',
      ],
    },
  ];

  // Episode navigation handler (Section A.5: Stop old audio cleanly before switching)
  const handleNavigateEpisode = (targetStory: Story | null) => {
    if (!targetStory || !onSelectStory) return;
    podcastPlaybackController.stopAndCleanup();
    voiceService.cancel();
    onSelectStory(targetStory.id);
  };

  // Synchronous <50ms Pause / Resume handler
  const handleTogglePlayPause = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    voiceService.cancel();
    if (isErrorState) {
      void handleRetryEpisodeSynthesis();
      return;
    }
    podcastPlaybackController.togglePlayPause();
  };

  const handleSeekSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const targetSec = parseFloat(e.target.value);
    if (!Number.isNaN(targetSec)) {
      podcastPlaybackController.seekTo(targetSec);
    }
  };

  const handleSkipBackward15 = (e: React.MouseEvent) => {
    e.stopPropagation();
    podcastPlaybackController.skipBy(-15);
  };

  const handleSkipForward15 = (e: React.MouseEvent) => {
    e.stopPropagation();
    podcastPlaybackController.skipBy(15);
  };

  const handleReplayEpisode = (e: React.MouseEvent) => {
    e.stopPropagation();
    voiceService.cancel();
    setQuestionSkipped(false);
    setShowReflection(false);
    setReflectionStepIndex(0);
    setReflectionAnswers(['', '', '']);
    setReflectionFeedback(null);
    closingSpokenForStoryRef.current = null;
    podcastPlaybackController.seekTo(0);
    podcastPlaybackController.play();
  };

  const handleRetryEpisodeSynthesis = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setControlsOverlayVisible(true);
    const defaultCues = getDefaultStorySceneCues(story.illustrationType);
    await podcastPlaybackController.loadEpisode(story, pref, defaultCues, {
      initialTimeSec: 0,
      autoPlay: true,
      forceRegenerate: true,
      onEpisodeMetadataReady: (res) => {
        if (res.audioStatus === 'ready' && res.audioUrl) {
          void saveParentStory({
            ...story,
            audioStatus: 'ready',
            audioAssetId: res.audioAssetId,
            audioUrl: res.audioUrl,
            actualDurationSeconds: res.actualDurationSeconds,
            sceneTimeline: res.sceneTimeline,
          });
        }
      },
    });
  };

  const handleSelectSpeed = (rate: number, e: React.MouseEvent) => {
    e.stopPropagation();
    podcastPlaybackController.setPlaybackRate(rate);
    void updateVoicePreference({ speechRate: rate });
  };

  const handleAdjustSceneOffset = (deltaSec: number, e: React.MouseEvent) => {
    e.stopPropagation();
    podcastPlaybackController.setSceneOffsetSec((snapshot.sceneOffsetSec || 0) + deltaSec);
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !snapshot.muted;
    podcastPlaybackController.setVolume(snapshot.volume, nextMuted);
    void updateVoicePreference({ muted: nextMuted });
  };

  const handleChangeVolume = (newVol: number) => {
    const nextMuted = newVol <= 0;
    podcastPlaybackController.setVolume(newVol, nextMuted);
    void updateVoicePreference({ volume: newVol, muted: nextMuted });
  };

  const handleAnswerSequentialQuestion = async (optionText: string) => {
    // Ensure Podcast audio and voiceService never overlap (Section A.6)
    podcastPlaybackController.pause();
    voiceService.cancel();

    const updatedAnswers: [string, string, string] = [...reflectionAnswers] as [
      string,
      string,
      string,
    ];
    updatedAnswers[reflectionStepIndex] = optionText;
    setReflectionAnswers(updatedAnswers);

    if (reflectionStepIndex < 2) {
      const nextIdx = (reflectionStepIndex + 1) as 0 | 1 | 2;
      setReflectionStepIndex(nextIdx);
      const nextQuestionPrompt = sequentialQuestions[nextIdx].question;
      void voiceService.speak(nextQuestionPrompt, data.voicePreference, 'story');
      return;
    }

    // Completed all 3 questions -> award star with idempotency
    const combinedSummary = updatedAnswers.filter(Boolean).join(' | ');
    const res = await awardStoryReflectionStar(story.id, combinedSummary);
    const warmReply = `${res.message} Buddy rất yêu những chia sẻ ấm áp của ${data.profile.displayName}. Giờ thì nhắm mắt lại, Buddy chúc con ngủ thật ngon nhé!`;
    setReflectionFeedback(`${warmReply} 🌙`);
    void voiceService.speak(warmReply, data.voicePreference, 'story');
  };

  const handleSkipQuestion = () => {
    podcastPlaybackController.pause();
    voiceService.cancel();
    setQuestionSkipped(true);
    setShowReflection(false);
    const skipGoodnight = `Không sao đâu ${data.profile.displayName} ơi! Giờ mình cùng nhắm mắt nghỉ ngơi nhé. Buddy chúc con ngủ thật ngon và mơ đẹp!`;
    setReflectionFeedback(`${skipGoodnight} 🌙`);
    void voiceService.speak(skipGoodnight, data.voicePreference, 'story');
  };

  // Section A.1: When mouse leaves the player frame, overlay is strictly opacity-0 pointer-events-none
  // unless an error/loading banner requires attention or keyboard focus is inside.
  const isOverlayShown =
    controlsOverlayVisible || isGenerating || isErrorState;

  return (
    <div className="space-y-4 pb-8">
      {/* Top Bar + Episode Navigation (Section A.5: ← Truyện trước / Truyện tiếp →) */}
      <div className="flex items-center justify-between gap-2 flex-wrap pr-14 sm:pr-0">
        <button
          type="button"
          onClick={() => {
            podcastPlaybackController.stopAndCleanup();
            voiceService.cancel();
            onBack();
          }}
          className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-[18px] bg-white hover:bg-[#EDE7FF] border border-[#23324D]/8 text-xs sm:text-sm font-kids font-bold text-[#23324D] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Thư viện Podcast</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={!prevStory}
            onClick={() => handleNavigateEpisode(prevStory)}
            className="min-h-[40px] px-3 py-1.5 rounded-[18px] bg-white hover:bg-[#EAF3FF] disabled:opacity-40 disabled:cursor-not-allowed border border-[#23324D]/10 text-xs font-kids font-extrabold text-[#23324D] transition-colors cursor-pointer"
            aria-label={prevStory ? `Truyện trước: ${prevStory.title}` : 'Không có truyện trước'}
          >
            ← Truyện trước
          </button>

          <button
            type="button"
            disabled={!nextStory}
            onClick={() => handleNavigateEpisode(nextStory)}
            className="min-h-[40px] px-3 py-1.5 rounded-[18px] bg-white hover:bg-[#EAF3FF] disabled:opacity-40 disabled:cursor-not-allowed border border-[#23324D]/10 text-xs font-kids font-extrabold text-[#23324D] transition-colors cursor-pointer"
            aria-label={nextStory ? `Truyện tiếp: ${nextStory.title}` : 'Không có truyện tiếp'}
          >
            Truyện tiếp →
          </button>
        </div>
      </div>

      {/* Main Bedtime Story Podcast Player Card */}
      <div className="rounded-[28px] bg-gradient-to-b from-[#EDE7FF] via-[#F4F1FF] to-white border border-indigo-200/80 p-3 sm:p-5 shadow-[0_12px_32px_rgba(35,50,77,0.08)] space-y-4">
        {/* =====================================================================
            FULL IMAGE OVERLAY PODCAST PLAYER (Section A.1 & A.2)
            - Layer 1: Warm Storybook scene illustration filling 100% of the player frame
            - Layer 2: Interaction-only overlay (opacity-0 pointer-events-none on mouseLeave,
              opacity-100 pointer-events-auto on mouseEnter / touch tap)
            - No scene numbers ("Cảnh X/Y") or paragraph subtitles over or under the artwork
            ===================================================================== */}
        <div
          data-testid="podcast-player-frame"
          onClick={() => {
            setControlsOverlayVisible((v) => !v);
          }}
          onMouseEnter={() => {
            setControlsOverlayVisible(true);
          }}
          onMouseMove={() => {
            if (!controlsOverlayVisible) {
              setControlsOverlayVisible(true);
            }
          }}
          onMouseLeave={() => {
            setControlsOverlayVisible(false);
          }}
          className="relative w-full min-h-[450px] sm:min-h-[520px] rounded-[26px] overflow-hidden shadow-[0_14px_36px_rgba(17,26,46,0.22)] border border-white/85 select-none cursor-pointer group"
        >
          {/* LAYER 1: Full-Frame Warm Storybook Scene Illustration (No scene number or subtitle overlays) */}
          <StoryParagraphSceneIllustration
            type={story.illustrationType}
            paragraphIndex={safeSceneIndex}
            totalParagraphs={totalParagraphs}
            customImageUrl={activeCue?.imageUrl}
            customCaption={story.title}
            hideBuiltInOverlays
            className="absolute inset-0 w-full h-full rounded-none border-0"
          />

          {/* LAYER 2: Interaction-Only Overlay Controls (strictly opacity-0 pointer-events-none when hidden) */}
          <div
            data-testid="podcast-controls-overlay"
            className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-200 focus-within:opacity-100 focus-within:pointer-events-auto ${
              isOverlayShown
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Top Overlay Header: Story Title + Voice & Speed Info (No "Cảnh X/Y" badge) */}
            <div className="bg-gradient-to-b from-[#0E1729]/85 via-[#0E1729]/45 to-transparent p-3.5 sm:p-5 flex items-start justify-between gap-2.5">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-xl bg-[#3978F6]/90 text-white font-kids font-extrabold text-[11px]">
                    {story.category}
                  </span>
                  {story.sourceDocumentInfo?.episodeNumber && (
                    <span className="px-2.5 py-0.5 rounded-xl bg-[#FFF0C9] text-[#23324D] font-kids font-extrabold text-[11px] tabular-nums">
                      Tập {story.sourceDocumentInfo.episodeNumber}/
                      {story.sourceDocumentInfo.totalEpisodesInDoc || 1}
                    </span>
                  )}
                </div>
                <h1 className="font-kids text-lg sm:text-2xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] leading-snug line-clamp-2">
                  {story.title}
                </h1>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-3 py-1 rounded-[18px] bg-[#111A2E]/85 backdrop-blur-xs text-[#FFF0C9] text-[11px] sm:text-xs font-kids font-bold tabular-nums border border-white/15">
                  Giọng {pref.gender === 'male' ? 'Nam' : 'Nữ'} · {snapshot.playbackRate}x
                </span>
              </div>
            </div>

            {/* Middle Area left clear so main character in the Warm Storybook artwork is never covered */}
            <div className="flex-1 min-h-[110px] sm:min-h-[150px] flex items-center justify-center pointer-events-none px-4">
              {isGenerating && (
                <div className="px-4 py-2.5 rounded-[20px] bg-[#111A2E]/85 backdrop-blur-md border border-white/20 text-[#FFF0C9] font-kids font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 shadow-lg">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#3978F6]" />
                  <span>Buddy đang chuẩn bị âm thanh tiếng Việt liên tục...</span>
                </div>
              )}
            </div>

            {/* Bottom Unified Overlay Control Deck */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-t from-[#0D1526]/95 via-[#0D1526]/82 to-transparent pt-10 pb-4 px-3.5 sm:px-5 space-y-3 text-white cursor-default"
            >
              {/* Truthful Error State Banner with Retry Button (Section A.3) */}
              {isErrorState && !isGenerating && (
                <div className="rounded-[18px] bg-rose-950/90 border border-rose-400/50 px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-xs">
                  <span className="font-kids font-bold text-rose-100 leading-snug">
                    ⚠️{' '}
                    {snapshot.errorMessage ||
                      'Không thể phát âm thanh lúc này. Vui lòng bấm Thử lại.'}
                  </span>
                  <button
                    type="button"
                    onClick={handleRetryEpisodeSynthesis}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-[18px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-xs shrink-0 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Thử lại</span>
                  </button>
                </div>
              )}

              {/* A. Scrubbable Timeline Slider + mm:ss / mm:ss */}
              <div className="space-y-1.5">
                <div className="relative flex items-center py-1.5">
                  <div className="w-full h-2.5 rounded-full bg-white/25 overflow-hidden relative pointer-events-none">
                    <div
                      className="h-full bg-gradient-to-r from-[#3978F6] to-[#FFF0C9] transition-all duration-100"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Subtle Timeline Cue Ticks (without "Cảnh X" text labels) */}
                  {snapshot.sceneTimeline.map((cue, idx) => {
                    if (idx === 0 || durationSec <= 0) return null;
                    const leftPct = Math.min(98, Math.max(2, (cue.startTimeSec / durationSec) * 100));
                    return (
                      <span
                        key={cue.sceneIndex}
                        style={{ left: `${leftPct}%` }}
                        className="absolute top-1/2 -translate-y-1/2 w-1 h-2.5 rounded-xs bg-white/60 pointer-events-none"
                      />
                    );
                  })}

                  <input
                    type="range"
                    min={0}
                    max={durationSec}
                    step={0.25}
                    value={currentTimeSec}
                    onChange={handleSeekSliderChange}
                    disabled={isGenerating || isErrorState}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Thanh thời gian tập Podcast"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[#EAF3FF] tabular-nums gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 font-kids font-extrabold">
                    <span className="text-[#FFF0C9]">{formatPodcastTime(currentTimeSec)}</span>
                    <span className="text-white/45">/</span>
                    <span>{formatPodcastTime(durationSec)}</span>
                  </div>

                  <div className="inline-flex items-center gap-2 text-[11px] font-kids font-bold">
                    {isGenerating ? (
                      <span className="inline-flex items-center gap-1.5 text-[#FFF0C9]">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang tạo bản thu...</span>
                      </span>
                    ) : isErrorState ? (
                      <span className="text-rose-300">Chưa sẵn sàng âm thanh</span>
                    ) : isPlaying ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>Đang phát liên tục</span>
                      </span>
                    ) : snapshot.status === 'paused' ? (
                      <span className="text-amber-200">Đã tạm dừng · Bấm Phát để nghe tiếp</span>
                    ) : isStoryFinished ? (
                      <span className="text-[#FFF0C9]">Đã phát xong tập Podcast 🌙</span>
                    ) : (
                      <span className="text-white/85">Sẵn sàng phát</span>
                    )}
                  </div>
                </div>
              </div>

              {/* B. Primary Overlay Transport Row: Rewind 15s (-15s) / Center Play-Pause / Forward 15s (+15s) / Replay */}
              <div className="flex items-center justify-center gap-3 sm:gap-5">
                <button
                  type="button"
                  onClick={handleSkipBackward15}
                  disabled={isGenerating || isErrorState}
                  className="min-h-[44px] px-3.5 py-2 rounded-[18px] bg-white/15 hover:bg-white/25 backdrop-blur-xs disabled:opacity-40 text-white font-kids font-extrabold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer tabular-nums border border-white/15"
                  title="Tua lùi 15 giây"
                  aria-label="Tua lùi 15 giây"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>-15s</span>
                </button>

                <button
                  type="button"
                  onClick={handleTogglePlayPause}
                  disabled={isGenerating}
                  className="w-16 h-16 rounded-full bg-[#3978F6] hover:bg-[#2964DF] disabled:opacity-50 text-white shadow-[0_6px_22px_rgba(57,120,246,0.55)] border-2 border-white/30 flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                  title={isPlaying ? 'Tạm dừng ngay' : 'Phát tiếp từ vị trí hiện tại'}
                  aria-label={isPlaying ? 'Tạm dừng ngay' : 'Phát tiếp từ vị trí hiện tại'}
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 fill-white" />
                  ) : (
                    <Play className="w-7 h-7 fill-white translate-x-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSkipForward15}
                  disabled={isGenerating || isErrorState}
                  className="min-h-[44px] px-3.5 py-2 rounded-[18px] bg-white/15 hover:bg-white/25 backdrop-blur-xs disabled:opacity-40 text-white font-kids font-extrabold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer tabular-nums border border-white/15"
                  title="Tua nhanh 15 giây"
                  aria-label="Tua nhanh 15 giây"
                >
                  <span>+15s</span>
                  <RotateCw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleReplayEpisode}
                  disabled={isGenerating || isErrorState}
                  className="w-11 h-11 rounded-[18px] bg-white/15 hover:bg-white/25 backdrop-blur-xs disabled:opacity-40 text-[#FFF0C9] flex items-center justify-center transition-colors cursor-pointer border border-white/15"
                  title="Phát lại từ đầu (00:00)"
                  aria-label="Phát lại từ đầu (00:00)"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* C. Bottom Overlay Speed, Volume & ±2s Scene Timing Calibration Controls */}
              <div className="pt-2.5 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                {/* Speed Selector (0.85x, 1x, 1.1x, 1.25x) */}
                <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                  <span className="text-[11px] font-kids font-bold text-[#EAF3FF]/85">
                    Tốc độ:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {YOUTUBE_SPEED_OPTIONS.map((opt) => {
                      const isActiveSpeed = Math.abs(snapshot.playbackRate - opt.rate) < 0.03;
                      return (
                        <button
                          key={opt.rate}
                          type="button"
                          onClick={(e) => handleSelectSpeed(opt.rate, e)}
                          className={`min-h-[32px] px-2.5 py-1 rounded-[18px] text-xs font-kids font-extrabold transition-colors cursor-pointer tabular-nums ${
                            isActiveSpeed
                              ? 'bg-[#FFF0C9] text-[#23324D] shadow-2xs'
                              : 'bg-white/15 hover:bg-white/25 text-white/90'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Volume & Mute */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`w-9 h-9 rounded-[18px] flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      snapshot.muted
                        ? 'bg-rose-500/90 text-white'
                        : 'bg-white/15 hover:bg-white/25 text-[#FFF0C9]'
                    }`}
                    title={snapshot.muted ? 'Bật âm thanh' : 'Tắt tiếng'}
                    aria-label={snapshot.muted ? 'Bật âm thanh' : 'Tắt tiếng'}
                  >
                    {snapshot.muted ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={snapshot.muted ? 0 : snapshot.volume}
                    onChange={(e) => handleChangeVolume(parseFloat(e.target.value))}
                    className="w-full accent-[#FFF0C9] cursor-pointer"
                    aria-label="Điều chỉnh âm lượng Podcast"
                  />
                  <span className="text-[11px] font-kids font-bold text-[#EAF3FF]/90 w-10 text-right tabular-nums">
                    {snapshot.muted ? '0%' : `${Math.round(snapshot.volume * 100)}%`}
                  </span>
                </div>
              </div>

              {/* D. ±2s Scene Sync Offset Calibration (Section A.4) */}
              <div className="pt-1.5 flex items-center justify-between gap-2 flex-wrap text-[11px] text-[#EAF3FF]/85">
                <span className="font-kids font-bold">
                  Đồng bộ tranh theo giọng đọc (±2s):
                </span>
                <div className="flex items-center gap-1.5 tabular-nums">
                  <button
                    type="button"
                    onClick={(e) => handleAdjustSceneOffset(-0.5, e)}
                    disabled={(snapshot.sceneOffsetSec || 0) <= -2}
                    className="min-h-[28px] px-2.5 py-0.5 rounded-[18px] bg-white/15 hover:bg-white/25 disabled:opacity-40 text-white font-kids font-extrabold cursor-pointer"
                    aria-label="Lùi thời gian chuyển tranh 0.5 giây"
                  >
                    -0.5s
                  </button>
                  <span className="px-2 py-0.5 rounded-lg bg-black/35 text-[#FFF0C9] font-kids font-extrabold">
                    {(snapshot.sceneOffsetSec || 0) > 0
                      ? `+${snapshot.sceneOffsetSec}s`
                      : `${snapshot.sceneOffsetSec || 0}s`}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleAdjustSceneOffset(0.5, e)}
                    disabled={(snapshot.sceneOffsetSec || 0) >= 2}
                    className="min-h-[28px] px-2.5 py-0.5 rounded-[18px] bg-white/15 hover:bg-white/25 disabled:opacity-40 text-white font-kids font-extrabold cursor-pointer"
                    aria-label="Tăng thời gian chuyển tranh 0.5 giây"
                  >
                    +0.5s
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calm Goodnight Card when episode finishes */}
        {(isStoryFinished || reflectionFeedback) && (
          <div className="rounded-[22px] bg-gradient-to-r from-[#23324D] to-[#344973] text-white p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BuddyAvatar size="sm" mood="calm" />
              <div>
                <p className="font-kids font-extrabold text-sm sm:text-base text-[#FFF0C9]">
                  🌙 Chúc {data.profile.displayName} ngủ thật ngon nhé!
                </p>
                <p className="text-xs text-white/80">
                  {reflectionFeedback ||
                    'Tập Podcast đã kết thúc êm dịu. Con cùng Buddy trả lời 3 câu hỏi nhỏ bên dưới nhé!'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section A.6: Three Sequential Post-Story Questions for 1st Graders (Age 6–7) with Skip ("Bỏ qua") */}
        {shouldAskQuestionAfterStory && showReflection && !questionSkipped && !reflectionFeedback && (
          <div className="rounded-[24px] bg-[#FFF0C9]/90 border border-amber-300/70 p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-kids font-extrabold text-amber-900">
                <Sparkles className="w-4 h-4" />
                <span>
                  {sequentialQuestions[reflectionStepIndex].badge} (+{data.pointsPolicy.storyReflectionStars} ★)
                </span>
              </div>

              <button
                type="button"
                onClick={handleSkipQuestion}
                className="min-h-[36px] px-3.5 py-1 rounded-[18px] bg-white/90 hover:bg-white text-[#5C6F8C] hover:text-[#23324D] font-kids font-extrabold text-xs transition-colors cursor-pointer"
              >
                Bỏ qua
              </button>
            </div>

            {/* Step Progress Dots (1 -> 2 -> 3) */}
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((idx) => (
                <span
                  key={idx}
                  className={`h-2 rounded-full transition-all ${
                    idx === reflectionStepIndex
                      ? 'w-8 bg-[#3978F6]'
                      : idx < reflectionStepIndex
                      ? 'w-4 bg-emerald-500'
                      : 'w-4 bg-amber-300/70'
                  }`}
                />
              ))}
            </div>

            <h3 className="font-kids text-base sm:text-lg font-extrabold text-[#23324D]">
              {sequentialQuestions[reflectionStepIndex].question}
            </h3>

            <div className="space-y-2">
              {sequentialQuestions[reflectionStepIndex].options.map((suggestion) => {
                const isChosen = reflectionAnswers[reflectionStepIndex] === suggestion;
                return (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void handleAnswerSequentialQuestion(suggestion)}
                    className={`w-full text-left min-h-[46px] px-4 py-2.5 rounded-[18px] font-kids font-bold text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isChosen
                        ? 'bg-[#3978F6] text-white'
                        : 'bg-white hover:bg-[#DDF5E8] text-[#23324D]'
                    }`}
                  >
                    <span>{suggestion}</span>
                    {isChosen && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

