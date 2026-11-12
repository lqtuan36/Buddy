import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Plus,
  Lock,
  Unlock,
  Clock,
  Star,
  Gift,
  Sliders,
  ArrowLeft,
  Edit3,
  ChevronRight,
  Heart,
  BookOpen,
  Calendar,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  Compass,
  LayoutDashboard,
  ArrowUp,
  ArrowDown,
  Headphones,
  RefreshCw,
  Play,
  Pause,
} from 'lucide-react';
import { useBuddy } from '../context/BuddyContext';
import { BuddyAvatar } from './BuddyAvatar';
import {
  TaskStepIllustration,
  RoutinePeriodIllustration,
  StoryEditorialIllustration,
  GrowthTopicIllustration,
  STORYBOOK_REWARD_CELEBRATION_IMAGE,
  MISSING_STORYBOOK_ASSETS_MANIFEST,
  TASK_STEP_ASSET_REGISTRY,
  getDefaultStorySceneCues,
  auditStorySceneIllustrations,
} from './BuddyIllustrations';
import { voiceService } from '../services/voiceService';
import {
  formatPodcastTime,
  podcastPlaybackController,
  PodcastPlaybackSnapshot,
} from '../services/podcastPlaybackController';
import {
  ChildCharacterVariant,
  DayOfWeekNumber,
  GrowthExperienceItem,
  GrowthQualityTopic,
  IllustrationKey,
  SchoolScheduleConfig,
  SchoolScheduleOverride,
  Story,
  StoryCategory,
  Task,
  TaskStep,
  VoiceGender,
} from '../types/domain';
import { getTodayDateKey } from '../services/pointsPolicy';
import { storyRepository } from '../services/repository';

/**
 * TAB CỦA CON – MY LITTLE WORLD (v1.4 Section 8 Strict 7-Block Order):
 * 1. Hồ sơ bé và Buddy hero (căn chỉnh hài hòa avatar, điểm sao, huy hiệu)
 * 2. Tổng sao và hoạt động hoàn thành
 * 3. Bảng theo dõi tháng (kèm dải 7 ngày trực quan)
 * 4. Chặng phẩm chất gần đây (và câu trả lời/chia sẻ đã lưu của con)
 * 5. Thành tích của con & Phần thưởng gia đình (minh họa Warm Storybook)
 * 6. Cài đặt giọng nói / sở thích
 * 7. Lối vào Khu vực phụ huynh
 */
export const ChildProfileOverviewView: React.FC = () => {
  const {
    data,
    voiceState,
    starSummary,
    openSubView,
    navigateTab,
    updateVoicePreference,
    setSelectedJourneyTopicId,
  } = useBuddy();

  const pref = data.voicePreference;
  const todayKey = getTodayDateKey();

  const totalRoutineCheckins = data.routines.reduce(
    (acc, r) => acc + r.completedDates.length,
    0
  );
  const completedActivitiesTotal =
    data.taskRuns.length + totalRoutineCheckins;

  const experiencedJourneyCount = (data.growthTopics || []).reduce(
    (sum, topic) =>
      sum + topic.experiences.filter((e) => e.status === 'experienced').length,
    0
  );

  const wheelProgressPercent = Math.min(
    100,
    Math.round(
      (starSummary.monthlyStars / Math.max(1, starSummary.threshold)) * 100
    )
  );

  const approvedRewards = data.rewards.filter(
    (r) => r.approvedByParent && r.active
  );

  const approvedTopics = (data.growthTopics || []).filter(
    (t) => t.approvalStatus === 'approved' && t.selectedByParent
  );

  // Build 7-day mini habit strip for Monthly Tracker card preview
  const last7DaysStrip = React.useMemo(() => {
    const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const baseDate = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - (6 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const hasActivity =
        data.routines.some((r) => r.completedDates.includes(key)) ||
        data.starLedger.some((tx) => tx.dateKey === key);
      return {
        dateKey: key,
        dayNum: d.getDate(),
        dayLabel: dayLabels[d.getDay()],
        hasActivity,
        isToday: key === todayKey,
      };
    });
  }, [data.routines, data.starLedger, todayKey]);

  const handleQuickSelectVoice = async (gender: VoiceGender) => {
    await updateVoicePreference({ gender });
    const sampleText =
      gender === 'male'
        ? `Chào ${data.profile.displayName}! Mình là Buddy với giọng Nam ấm áp đây!`
        : `Chào ${data.profile.displayName}! Mình là Buddy với giọng Nữ dịu dàng đây!`;
    voiceService.speak(sampleText, { ...pref, gender, muted: false }, 'chat');
  };

  const handleQuickTestVoice = () => {
    const sample =
      pref.gender === 'male'
        ? `Xin chào ${data.profile.displayName}! Hôm nay con đã làm được thật nhiều việc tốt cùng Buddy!`
        : `Xin chào ${data.profile.displayName}! Buddy rất vui được đồng hành trong thế giới nhỏ của con!`;
    voiceService.speak(sample, pref, 'chat');
  };

  return (
    <div className="space-y-4 pb-6">
      {/* 1. Hồ sơ bé và Buddy Hero (Balanced Avatar + Star Score + Badges) */}
      <section className="rounded-[28px] bg-gradient-to-b from-[#EAF3FF] via-[#F3F8FF] to-white border border-[#3978F6]/15 p-5 text-center shadow-[0_10px_28px_rgba(57,120,246,0.08)] flex flex-col items-center space-y-3">
        <BuddyAvatar
          size="xl"
          isSpeaking={voiceState.status === 'playing' || voiceState.status === 'speaking'}
          mood="happy"
        />

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white text-[#3978F6] font-kids font-extrabold text-xs shadow-2xs">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>
              Thế giới nhỏ của {data.profile.displayName} ({data.profile.ageYears} tuổi · Minh họa{' '}
              {data.profile.characterVariant === 'boy' ? 'Bé trai' : 'Bé gái'})
            </span>
          </div>

          <h1 className="font-kids text-xl sm:text-2xl font-extrabold text-[#23324D] pt-0.5">
            Chào {data.profile.displayName} đáng yêu! 🌟
          </h1>

          <p className="text-xs sm:text-sm text-[#23324D]/75 max-w-xs mx-auto leading-relaxed">
            Nơi lưu giữ ngôi sao nỗ lực, hành trình phẩm chất và quà tặng gia đình của con.
          </p>
        </div>

        {/* Harmonious Achievement Badges Row */}
        <div className="w-full pt-1 grid grid-cols-3 gap-2">
          <div className="rounded-[18px] bg-white/95 border border-[#3978F6]/12 p-2.5 text-center shadow-2xs">
            <span className="text-base block">⭐</span>
            <p className="font-kids font-extrabold text-xs text-[#23324D] mt-0.5 tabular-nums">
              {starSummary.monthlyStars} sao
            </p>
            <span className="block text-[10px] font-bold text-[#5C6F8C]">
              Tháng này
            </span>
          </div>
          <div className="rounded-[18px] bg-white/95 border border-[#3978F6]/12 p-2.5 text-center shadow-2xs">
            <span className="text-base block">🏅</span>
            <p className="font-kids font-extrabold text-xs text-[#23324D] mt-0.5 tabular-nums">
              {completedActivitiesTotal} việc tốt
            </p>
            <span className="block text-[10px] font-bold text-[#5C6F8C]">
              Chăm ngoan
            </span>
          </div>
          <div className="rounded-[18px] bg-white/95 border border-[#3978F6]/12 p-2.5 text-center shadow-2xs">
            <span className="text-base block">🌱</span>
            <p className="font-kids font-extrabold text-xs text-[#23324D] mt-0.5 tabular-nums">
              {experiencedJourneyCount} dấu ấn
            </p>
            <span className="block text-[10px] font-bold text-[#5C6F8C]">
              Phẩm chất
            </span>
          </div>
        </div>
      </section>

      {/* 2. Tổng sao và hoạt động hoàn thành */}
      <section aria-label="Tổng sao và hoạt động hoàn thành" className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => openSubView({ type: 'stars-detail' })}
          className="text-left rounded-[24px] bg-[#FFF0C9] hover:bg-[#ffe6a8] p-3.5 transition-all shadow-2xs flex items-center gap-3 cursor-pointer"
        >
          <div className="w-14 h-14 shrink-0">
            <RoutinePeriodIllustration
              period="morning"
              className="w-full h-full rounded-[16px]"
            />
          </div>
          <div className="min-w-0">
            <p className="font-kids text-xl sm:text-2xl font-extrabold text-[#23324D] tabular-nums">
              {starSummary.monthlyStars} ★
            </p>
            <p className="font-kids text-xs font-extrabold text-amber-950/85 truncate">
              Chi tiết sao →
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigateTab('activities')}
          className="text-left rounded-[24px] bg-[#EAF3FF] hover:bg-[#d8e8ff] p-3.5 transition-all shadow-2xs flex items-center gap-3 cursor-pointer"
        >
          <div className="w-14 h-14 shrink-0">
            <TaskStepIllustration
              illustrationKey="pack-books"
              className="w-full h-full rounded-[16px] p-0.5"
            />
          </div>
          <div className="min-w-0">
            <p className="font-kids text-xl sm:text-2xl font-extrabold text-[#23324D] tabular-nums">
              {completedActivitiesTotal} việc
            </p>
            <p className="font-kids text-xs font-extrabold text-[#3978F6] truncate">
              Việc hôm nay →
            </p>
          </div>
        </button>
      </section>

      {/* 3. Bảng theo dõi tháng (with 7-Day Visual Habit Strip) */}
      <section
        aria-label="Bảng theo dõi tháng"
        className="rounded-[26px] bg-gradient-to-br from-[#DDF5E8] via-[#EAF3FF] to-white border border-emerald-300/60 p-4 sm:p-5 shadow-2xs space-y-3.5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-[18px] bg-white flex items-center justify-center text-[#188050] shadow-2xs shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-kids font-extrabold text-[#188050] uppercase">
                Bảng theo dõi tháng {data.profile.currentCycleMonth}
              </span>
              <h2 className="font-kids text-base sm:text-lg font-extrabold text-[#23324D] leading-snug">
                Chuỗi 7 ngày thói quen tốt của con
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openSubView({ type: 'monthly-tracker' })}
            className="min-h-[38px] px-3.5 py-1.5 rounded-[18px] bg-white hover:bg-[#3978F6] text-[#188050] hover:text-white font-kids font-extrabold text-xs shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            Xem cả tháng →
          </button>
        </div>

        {/* 7-Day Visual Habit Check-in Strip */}
        <div className="grid grid-cols-7 gap-1.5">
          {last7DaysStrip.map((day) => (
            <button
              key={day.dateKey}
              type="button"
              onClick={() => openSubView({ type: 'monthly-tracker' })}
              className={`rounded-[16px] p-2 text-center border transition-all cursor-pointer ${
                day.hasActivity
                  ? 'bg-white border-emerald-400 shadow-2xs'
                  : day.isToday
                  ? 'bg-white/90 border-[#3978F6]'
                  : 'bg-white/60 border-transparent'
              }`}
            >
              <span className="block text-[10px] font-kids font-extrabold text-[#5C6F8C]">
                {day.dayLabel}
              </span>
              <span className="block font-kids font-extrabold text-xs text-[#23324D] tabular-nums mt-0.5">
                {day.dayNum}
              </span>
              <span
                className={`mt-1 mx-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  day.hasActivity
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200/70 text-slate-400'
                }`}
              >
                {day.hasActivity ? '✓' : '·'}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Chặng phẩm chất gần đây (và chia sẻ của con đã lưu) */}
      <section className="rounded-[26px] bg-white border border-[#23324D]/8 p-4 sm:p-5 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-kids font-extrabold text-[#6B3FA0] bg-[#EDE7FF] px-2.5 py-0.5 rounded-full">
              {experiencedJourneyCount} dấu ấn phẩm chất
            </span>
            <h2 className="font-kids text-lg font-extrabold text-[#23324D] mt-1">
              Chặng phẩm chất gần đây của con
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigateTab('journey')}
            className="min-h-[36px] px-3 py-1 rounded-[18px] bg-[#EAF3FF] hover:bg-[#3978F6] text-xs font-kids font-extrabold text-[#3978F6] hover:text-white transition-colors cursor-pointer shrink-0"
          >
            Mở bản đồ →
          </button>
        </div>

        {/* Quick Stages with Warm Storybook Illustrations & Full Non-Truncated Titles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {approvedTopics.slice(0, 4).map((topic) => {
            const doneCount = topic.experiences.filter(
              (e) => e.status === 'experienced'
            ).length;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => {
                  setSelectedJourneyTopicId(topic.id);
                  navigateTab('journey');
                }}
                className="group text-left rounded-[18px] bg-[#F7F9FD] hover:bg-[#EAF3FF]/60 border border-[#23324D]/8 p-2 flex flex-col justify-between gap-2 cursor-pointer"
              >
                <GrowthTopicIllustration
                  slug={topic.slug}
                  variant="scene"
                  className="w-full h-22 rounded-[14px]"
                />
                <div className="min-w-0 px-0.5">
                  <p className="font-kids font-extrabold text-xs text-[#23324D] leading-snug whitespace-normal break-words">
                    {topic.title}
                  </p>
                  <p className="text-[10px] font-bold text-[#3978F6] tabular-nums mt-0.5">
                    {doneCount}/{topic.experiences.length} bước
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. Thành tích của con & Quà tặng gia đình (Warm Storybook Visual Card) */}
      <section className="rounded-[28px] bg-gradient-to-br from-[#FFE4D8] via-[#FFF4EE] to-[#FFF0C9] border border-rose-200/70 p-4 sm:p-5 space-y-3.5 shadow-2xs">
        <div className="relative overflow-hidden rounded-[22px] border border-white/80 shadow-xs">
          <img
            src={STORYBOOK_REWARD_CELEBRATION_IMAGE}
            alt="Thành tích của con và Quà tặng gia đình"
            loading="lazy"
            decoding="async"
            className="w-full h-40 sm:h-48 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#23324D]/65 via-transparent to-transparent" />
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-full bg-white/95 text-rose-700 font-kids font-extrabold text-xs shadow-2xs">
              🏆 Thành tích & Quà tặng gia đình
            </span>
            <span className="px-3 py-1 rounded-full bg-[#FFF0C9] text-[#23324D] font-kids font-extrabold text-xs tabular-nums shadow-2xs">
              {starSummary.monthlyStars}/{data.pointsPolicy.monthlyWheelThresholdStars} ★
            </span>
          </div>
          <div className="absolute bottom-3 left-3.5 right-3.5 text-white">
            <h2 className="font-kids text-base sm:text-lg font-extrabold leading-snug drop-shadow-xs">
              {starSummary.wheelEligible
                ? 'Chúc mừng con đã mở khóa Vòng quay Quà tặng!'
                : `Còn ${starSummary.starsRemainingForWheel} ngôi sao nữa để mở Vòng quay kỳ diệu`}
            </h2>
          </div>
        </div>

        <div className="w-full h-3.5 rounded-full bg-white/85 overflow-hidden p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500 transition-all duration-300"
            style={{ width: `${Math.max(8, wheelProgressPercent)}%` }}
          />
        </div>

        <button
          type="button"
          onClick={() => openSubView({ type: 'rewards-wheel' })}
          className="w-full min-h-[46px] px-4 py-2.5 rounded-[18px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-sm inline-flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
        >
          <span>Mở Vòng quay Quà của con</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </section>

      {/* 6. Cài đặt giọng nói / sở thích */}
      <section className="rounded-[26px] bg-gradient-to-b from-[#EDE7FF]/70 to-white border border-[#3978F6]/12 p-4 sm:p-5 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-kids font-extrabold text-[#3978F6]">
              Giọng nói tiếng Việt của Buddy
            </span>
            <h2 className="font-kids text-lg font-extrabold text-[#23324D]">
              Chọn giọng đọc con yêu thích
            </h2>
          </div>

          <button
            type="button"
            onClick={() => openSubView({ type: 'voice-settings' })}
            className="min-h-[36px] px-3 py-1 rounded-[18px] bg-white hover:bg-[#EAF3FF] border border-[#23324D]/10 text-xs font-kids font-bold text-[#3978F6] inline-flex items-center gap-1 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Tùy chỉnh</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleQuickSelectVoice('female')}
            className={`rounded-[18px] p-3 text-left border-2 transition-all cursor-pointer ${
              pref.gender === 'female'
                ? 'bg-white border-[#3978F6] shadow-2xs'
                : 'bg-white/60 border-transparent hover:border-[#3978F6]/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-kids font-extrabold text-sm text-[#23324D]">
                Giọng Nữ
              </span>
              {pref.gender === 'female' && (
                <CheckCircle2 className="w-4 h-4 text-[#3978F6]" />
              )}
            </div>
            <p className="text-[11px] text-[#23324D]/70 mt-0.5">
              Dịu dàng, ấm áp
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleQuickSelectVoice('male')}
            className={`rounded-[18px] p-3 text-left border-2 transition-all cursor-pointer ${
              pref.gender === 'male'
                ? 'bg-white border-[#3978F6] shadow-2xs'
                : 'bg-white/60 border-transparent hover:border-[#3978F6]/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-kids font-extrabold text-sm text-[#23324D]">
                Giọng Nam
              </span>
              {pref.gender === 'male' && (
                <CheckCircle2 className="w-4 h-4 text-[#3978F6]" />
              )}
            </div>
            <p className="text-[11px] text-[#23324D]/70 mt-0.5">
              Vui tươi, khỏe khoắn
            </p>
          </button>
        </div>

        <button
          type="button"
          onClick={handleQuickTestVoice}
          className="w-full min-h-[44px] px-4 py-2 rounded-[18px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Volume2 className="w-4 h-4" />
          <span>Nghe thử giọng của Buddy</span>
        </button>
      </section>

      {/* 7. Lối vào Khu vực phụ huynh */}
      <section className="rounded-[24px] bg-white border border-[#23324D]/10 p-4 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-[#EAF3FF] flex items-center justify-center text-[#23324D] shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#3978F6]" />
          </div>
          <div className="min-w-0">
            <h2 className="font-kids text-sm sm:text-base font-extrabold text-[#23324D] truncate">
              Khu vực Ba Mẹ (Buddy Parents)
            </h2>
            <p className="text-xs text-[#23324D]/65 truncate">
              Tổng quan, Lịch học, Nhiệm vụ, Hành trình, Truyện & Quà
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openSubView({ type: 'parent-dashboard' })}
          className="min-h-[42px] px-3.5 py-2 rounded-[18px] bg-[#23324D] hover:bg-[#182338] text-white font-kids font-extrabold text-xs inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Mở cổng</span>
        </button>
      </section>
    </div>
  );
};

/**
 * 7) MY BUDDY / VOICE SETTINGS SUBVIEW
 */
export const MyBuddySettingsView: React.FC<{ onBack?: () => void }> = ({
  onBack,
}) => {
  const {
    data,
    voiceState,
    voiceCapabilities,
    updateVoicePreference,
    openSubView,
  } = useBuddy();

  const pref = data.voicePreference;

  const handleSelectGender = async (gender: VoiceGender) => {
    await updateVoicePreference({ gender });
    const sampleText =
      gender === 'male'
        ? `Chào ${data.profile.displayName}! Mình là Buddy với giọng đọc Nam ấm áp. Mình sẽ đồng hành cùng con mỗi ngày nhé!`
        : `Chào ${data.profile.displayName}! Mình là Buddy với giọng đọc Nữ dịu dàng. Mình luôn sẵn sàng trò chuyện và đọc truyện cho con nghe!`;
    voiceService.speak(
      sampleText,
      { ...pref, gender, muted: false },
      'chat'
    );
  };

  const handleTestVoice = () => {
    const sample =
      pref.gender === 'male'
        ? `Xin chào ${data.profile.displayName}! Đây là giọng đọc Nam ấm áp của Buddy. Hôm nay con đã sẵn sàng làm việc tốt chưa nào?`
        : `Xin chào ${data.profile.displayName}! Đây là giọng đọc Nữ dịu dàng của Buddy. Tối nay mình cùng nghe một câu chuyện thật hay nhé!`;
    voiceService.speak(sample, pref, 'chat');
  };

  return (
    <div className="space-y-4 pb-6">
      {onBack && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-[16px] bg-white hover:bg-[#EAF3FF] border border-[#23324D]/8 text-xs sm:text-sm font-kids font-bold text-[#23324D] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Thế giới của con</span>
          </button>
        </div>
      )}

      {/* ONE Consistent Buddy Character Showcase */}
      <section className="rounded-[28px] bg-gradient-to-b from-[#EAF3FF] via-white to-[#EDE7FF] border border-[#3978F6]/15 p-5 text-center shadow-xs flex flex-col items-center space-y-3">
        <BuddyAvatar
          size="xl"
          isSpeaking={voiceState.status === 'playing'}
          mood="happy"
        />
        <div>
          <span className="inline-block text-[11px] font-bold text-[#3978F6] bg-white px-3 py-1 rounded-xl shadow-2xs">
            1 Nhân vật Buddy duy nhất
          </span>
          <h1 className="font-kids text-2xl font-extrabold text-[#23324D] mt-2">
            Giọng nói của Buddy
          </h1>
          <p className="text-xs sm:text-sm text-[#23324D]/75 mt-1 max-w-sm mx-auto leading-relaxed">
            Chọn giọng đọc <strong>Nam ấm áp</strong> hoặc <strong>Nữ dịu dàng</strong> cho bạn robot Buddy của {data.profile.displayName}.
          </p>
        </div>
      </section>

      {/* Voice Gender Selection Cards */}
      <section className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-4 shadow-xs">
        <div>
          <h2 className="font-kids text-lg font-extrabold text-[#23324D]">
            Chọn giọng đọc tiếng Việt của Buddy
          </h2>
          <p className="text-xs text-[#23324D]/70 mt-0.5">
            {voiceCapabilities.voiceAvailabilityNote}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Option 1: Female Voice */}
          <button
            type="button"
            onClick={() => handleSelectGender('female')}
            className={`text-left rounded-[22px] p-4 border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              pref.gender === 'female'
                ? 'bg-[#EAF3FF] border-[#3978F6] shadow-xs'
                : 'bg-[#F7F9FD] border-transparent hover:border-[#3978F6]/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <BuddyAvatar size="sm" />
                <div>
                  <h3 className="font-kids text-base font-extrabold text-[#23324D]">
                    Giọng Nữ dịu dàng
                  </h3>
                  <p className="text-xs text-[#23324D]/75">
                    Trong trẻo, nhẹ nhàng khi kể chuyện
                  </p>
                </div>
              </div>
              {pref.gender === 'female' && (
                <CheckCircle2 className="w-5 h-5 text-[#3978F6] shrink-0" />
              )}
            </div>

            <div className="pt-2.5 border-t border-[#23324D]/8 flex items-center justify-between text-xs text-[#23324D]/70">
              <span>
                {voiceCapabilities.geminiTtsAvailable
                  ? 'Gemini Kore (Chuẩn AI)'
                  : 'Giọng Nữ trình duyệt'}
              </span>
              <span className="font-bold text-[#3978F6]">
                {pref.gender === 'female' ? 'Đang chọn' : 'Chọn giọng này'}
              </span>
            </div>
          </button>

          {/* Option 2: Male Voice */}
          <button
            type="button"
            onClick={() => handleSelectGender('male')}
            className={`text-left rounded-[22px] p-4 border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              pref.gender === 'male'
                ? 'bg-[#EAF3FF] border-[#3978F6] shadow-xs'
                : 'bg-[#F7F9FD] border-transparent hover:border-[#3978F6]/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <BuddyAvatar size="sm" />
                <div>
                  <h3 className="font-kids text-base font-extrabold text-[#23324D]">
                    Giọng Nam ấm áp
                  </h3>
                  <p className="text-xs text-[#23324D]/75">
                    Trầm ấm, rõ ràng và vui tươi
                  </p>
                </div>
              </div>
              {pref.gender === 'male' && (
                <CheckCircle2 className="w-5 h-5 text-[#3978F6] shrink-0" />
              )}
            </div>

            <div className="pt-2.5 border-t border-[#23324D]/8 flex items-center justify-between text-xs text-[#23324D]/70">
              <span>
                {voiceCapabilities.geminiTtsAvailable
                  ? 'Gemini Puck (Chuẩn AI)'
                  : 'Giọng Nam trình duyệt'}
              </span>
              <span className="font-bold text-[#3978F6]">
                {pref.gender === 'male' ? 'Đang chọn' : 'Chọn giọng này'}
              </span>
            </div>
          </button>
        </div>

        {/* Replay, Test, Mute & Volume Controls */}
        <div className="rounded-[20px] bg-[#F7F9FD] border border-[#23324D]/8 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTestVoice}
                className="min-h-[42px] px-4 py-2 rounded-[16px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>Nghe thử giọng đã chọn</span>
              </button>

              <button
                type="button"
                onClick={() => voiceService.replayLast()}
                className="min-h-[42px] px-3.5 py-2 rounded-[16px] bg-white hover:bg-[#EAF3FF] border border-[#23324D]/12 text-[#23324D] font-kids font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-[#3978F6]" />
                <span>Phát lại</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => updateVoicePreference({ muted: !pref.muted })}
              className={`min-h-[42px] px-3.5 py-2 rounded-[16px] font-kids font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer ${
                pref.muted
                  ? 'bg-[#FFE4D8] text-rose-800'
                  : 'bg-[#DDF5E8] text-emerald-900'
              }`}
            >
              {pref.muted ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span>Đang tắt tiếng</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>Âm thanh bật</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#23324D]/8">
            <div>
              <label className="flex items-center justify-between text-xs font-bold text-[#23324D] mb-1.5 tabular-nums">
                <span>Âm lượng giọng đọc</span>
                <span>{Math.round(pref.volume * 100)}%</span>
              </label>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={pref.volume}
                onChange={(e) =>
                  updateVoicePreference({
                    volume: parseFloat(e.target.value),
                    muted: false,
                  })
                }
                className="w-full accent-[#3978F6] cursor-pointer"
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-bold text-[#23324D] mb-1.5 tabular-nums">
                <span>Tốc độ đọc của Buddy</span>
                <span>{pref.speechRate.toFixed(2)}x</span>
              </label>
              <input
                type="range"
                min={0.8}
                max={1.15}
                step={0.05}
                value={pref.speechRate}
                onChange={(e) =>
                  updateVoicePreference({
                    speechRate: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-[#3978F6] cursor-pointer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Access to Buddy Parents Dashboard */}
      <section className="rounded-[24px] bg-white border border-[#23324D]/10 p-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#3978F6]">
            <ShieldCheck className="w-4 h-4" />
            <span>Dành cho Ba Mẹ</span>
          </div>
          <h2 className="font-kids text-base font-extrabold text-[#23324D]">
            Mở cổng quản lý Buddy Parents
          </h2>
        </div>

        <button
          type="button"
          onClick={() => openSubView({ type: 'parent-dashboard' })}
          className="min-h-[42px] px-4 py-2 rounded-[16px] bg-[#23324D] hover:bg-[#182338] text-white font-kids font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Mở cổng</span>
        </button>
      </section>
    </div>
  );
};

/**
 * 8) BUDDY PARENTS – v1.3 REDESIGNED PARENT DASHBOARD (7 Clear Groups + Desktop Sidebar + Mobile Group Nav)
 * Groups:
 * 1. Tổng quan (overview)
 * 2. Lịch học và nhắc việc (schedule)
 * 3. Nhiệm vụ (tasks)
 * 4. Hành trình phẩm chất (journey)
 * 5. Truyện gia đình (stories)
 * 6. Sao và quà tặng (rewards)
 * 7. Cài đặt và an toàn (settings)
 */
type ParentGroupKey =
  | 'overview'
  | 'schedule'
  | 'tasks'
  | 'journey'
  | 'stories'
  | 'rewards'
  | 'settings';

export const ParentDashboardView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const {
    data,
    parentUnlocked,
    starSummary,
    tonightScheduledStory,
    unlockParentArea,
    lockParentArea,
    updateSchoolSchedule,
    saveParentStory,
    saveParentStoryBatch,
    reorderStoriesByParent,
    synthesizeStoryPodcastEpisode,
    deleteParentStory,
    toggleStoryVisibility,
    updateBedtimeStoryConfig,
    saveAndApproveTask,
    createNewApprovedTask,
    deleteTaskByParent,
    saveGrowthTopicByParent,
    saveGrowthCurriculumBatchByParent,
    updateRoutineConfig,
    updateRewardConfig,
    addFamilyReward,
    deleteRewardByParent,
    confirmRewardSpinByParent,
    awardParentPraiseStar,
    updatePointsPolicy,
    updateParentSettings,
    updateChildProfileName,
    updateChildCharacterVariant,
    resetDemoData,
  } = useBuddy();

  // Demo Gate Form State
  const [passcodeInput, setPasscodeInput] = useState('1234');
  const [adultConfirmed, setAdultConfirmed] = useState(true);
  const [gateError, setGateError] = useState<string | null>(null);

  // 7 Dashboard Groups
  const [parentGroup, setParentGroup] = useState<ParentGroupKey>('overview');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Kid-View Preview Modal State
  const [previewItem, setPreviewItem] = useState<
    | { type: 'task'; task: Task }
    | { type: 'story'; story: Story }
    | { type: 'journey'; topic: GrowthQualityTopic }
    | null
  >(null);

  // Confirmation State for Deletions
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    kind: 'task' | 'story' | 'reward';
    id: string;
    title: string;
  } | null>(null);

  // --- GROUP 2: SCHOOL SCHEDULE STATE ---
  const [scheduleDraft, setScheduleDraft] = useState<SchoolScheduleConfig>(() =>
    JSON.parse(JSON.stringify(data.schoolSchedule))
  );
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<DayOfWeekNumber>(1);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  const [overrideDateInput, setOverrideDateInput] = useState('');
  const [overrideReasonInput, setOverrideReasonInput] = useState('');
  const [overrideSubjectsInput, setOverrideSubjectsInput] = useState('');
  const [overrideSuppliesInput, setOverrideSuppliesInput] = useState('');

  // --- GROUP 3: TASK EDITOR STATE ---
  const [editingTaskId, setEditingTaskId] = useState<string>(data.tasks[0]?.id || 'task-backpack');
  const selectedTask = data.tasks.find((t) => t.id === editingTaskId) || data.tasks[0];
  const [taskDraft, setTaskDraft] = useState<Task>(selectedTask);
  const [aiDraftPrompt, setAiDraftPrompt] = useState('');
  const [isAiDrafting, setIsAiDrafting] = useState(false);

  // --- GROUP 4: GROWTH JOURNEY EDITOR & MASTER CURRICULUM UPLOAD STATE ---
  const [editingTopicId, setEditingTopicId] = useState<string>(
    data.growthTopics?.[0]?.id || 'journey-gratitude'
  );
  const selectedTopic =
    (data.growthTopics || []).find((t) => t.id === editingTopicId) || data.growthTopics?.[0];
  const [topicDraft, setTopicDraft] = useState<GrowthQualityTopic | null>(() =>
    selectedTopic ? JSON.parse(JSON.stringify(selectedTopic)) : null
  );
  const [isParsingCurriculumFile, setIsParsingCurriculumFile] = useState(false);
  const [curriculumUploadError, setCurriculumUploadError] = useState<string | null>(null);
  const [uploadedCurriculumBatch, setUploadedCurriculumBatch] = useState<GrowthQualityTopic[] | null>(
    null
  );
  const [uploadedCurriculumSource, setUploadedCurriculumSource] = useState<string>('');

  // --- GROUP 5: STORIES STATE ---
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingStoryDraft, setEditingStoryDraft] = useState<Story>({
    id: `story-parent-${Date.now()}`,
    title: '',
    category: 'Truyện Ba Mẹ tải lên',
    summary: 'Câu chuyện yêu thương do ba mẹ chuẩn bị cho giờ đi ngủ của con.',
    durationMinutes: 4,
    ageRecommendation: '6–12 tuổi',
    coverTheme: 'lavender',
    illustrationType: 'bau-troi-dem',
    paragraphs: [
      'Đêm đã khuya, ánh trăng dịu dàng chiếu qua khung cửa sổ nhỏ. Ba mẹ gửi tặng con một câu chuyện thật ấm áp trước giờ đi ngủ.',
    ],
    moralLesson: 'Tình yêu thương gia đình luôn đồng hành cùng con trong mỗi giấc mơ đẹp.',
    reflectionQuestion: 'Chi tiết nào trong câu chuyện tối nay làm con thấy ấm áp nhất?',
    reflectionSuggestions: [
      'Tình cảm yêu thương của gia đình',
      'Sự kiên trì và lòng tốt bụng',
      'Con muốn chúc ba mẹ ngủ thật ngon',
    ],
    approvedByParent: false,
    isParentUploaded: true,
    sourceType: 'manual',
    askQuestionAfterStory: true,
    createdAt: new Date().toISOString(),
  });
  const [paragraphsTextInput, setParagraphsTextInput] = useState(
    editingStoryDraft.paragraphs.join('\n\n')
  );
  const [scheduleStoryDateKey, setScheduleStoryDateKey] = useState(getTodayDateKey());
  const [scheduleStoryTargetId, setScheduleStoryTargetId] = useState(
    data.bedtimeStoryConfig?.tonightStoryId || data.stories[0]?.id || 'story-tich-chu'
  );
  // v1.4 AI Multi-Episode Podcast Library State
  const [rawDocumentTextInput, setRawDocumentTextInput] = useState('');
  const [aiEpisodeBatchDrafts, setAiEpisodeBatchDrafts] = useState<Story[] | null>(null);
  const [analyzedDocSummary, setAnalyzedDocSummary] = useState<{
    fileName: string;
    originalLengthChars: number;
    totalEpisodes: number;
  } | null>(null);
  const [synthesizingStoryId, setSynthesizingStoryId] = useState<string | null>(null);
  const [parentAudioSnap, setParentAudioSnap] = useState<PodcastPlaybackSnapshot>(() =>
    podcastPlaybackController.getSnapshot()
  );

  useEffect(() => {
    const unsubscribe = podcastPlaybackController.subscribe((snap) => {
      setParentAudioSnap(snap);
    });
    return () => {
      unsubscribe();
      podcastPlaybackController.stopAndCleanup();
    };
  }, []);

  const handleParentPreviewEpisodeAudio = async (episode: Story) => {
    const isThisEpisode = parentAudioSnap.storyId === episode.id;
    if (
      isThisEpisode &&
      (parentAudioSnap.status === 'playing' ||
        parentAudioSnap.status === 'loading' ||
        parentAudioSnap.status === 'generating')
    ) {
      podcastPlaybackController.pause();
      return;
    }
    if (isThisEpisode && parentAudioSnap.status === 'paused') {
      podcastPlaybackController.play();
      return;
    }

    await podcastPlaybackController.loadEpisode(
      episode,
      data.voicePreference,
      getDefaultStorySceneCues(episode.illustrationType || 'tich-chu'),
      { autoPlay: true }
    );
  };

  // --- GROUP 6 & 7 STATE ---
  const [newRewardTitle, setNewRewardTitle] = useState('');
  const [newRewardDesc, setNewRewardDesc] = useState('');
  const [praiseTitle, setPraiseTitle] = useState('');
  const [praiseNote, setPraiseNote] = useState('');
  const [childNameInput, setChildNameInput] = useState(data.profile.displayName);
  const [childAgeInput, setChildAgeInput] = useState(data.profile.ageYears);
  const [characterVariantInput, setCharacterVariantInput] = useState<ChildCharacterVariant>(
    data.profile.characterVariant || 'girl'
  );

  const showNotice = (msg: string) => {
    setValidationError(null);
    setStatusBanner(msg);
    window.setTimeout(() => setStatusBanner(null), 4500);
  };

  // --- OVERVIEW COMPUTED STATS ---
  const todayKey = getTodayDateKey();
  const approvedRoutines = data.routines.filter((r) => r.approvedByParent);
  const upcomingRoutinesToday = approvedRoutines.filter(
    (r) => !r.completedDates.includes(todayKey)
  );
  const completedRoutinesListToday = approvedRoutines.filter((r) =>
    r.completedDates.includes(todayKey)
  );
  const pendingTasksCount = data.tasks.filter(
    (t) => t.approvalStatus !== 'approved'
  ).length;
  const pendingStoriesCount = data.stories.filter(
    (s) => !s.approvedByParent || s.approvalStatus !== 'approved' || s.hiddenByParent
  ).length;
  const pendingJourneyCount = (data.growthTopics || []).filter(
    (t) => t.approvalStatus && t.approvalStatus !== 'approved'
  ).length;
  const unconfirmedRedemptions = (data.rewardSpins || []).filter(
    (r) => r.status === 'pending_parent_confirmation'
  );
  const totalPendingApprovalItems =
    pendingTasksCount +
    pendingStoriesCount +
    pendingJourneyCount +
    unconfirmedRedemptions.length;
  const currentFocusTopic =
    (data.growthTopics || []).find((t) => t.isCurrentFocus) || data.growthTopics?.[0];

  // --- SCHOOL SCHEDULE HANDLERS (v1.4 Section D.2 & D.3) ---
  const activeDayDraft =
    scheduleDraft.weeklyDays.find((d) => d.dayOfWeek === selectedDayOfWeek) ||
    scheduleDraft.weeklyDays[0];

  // Raw text state for subjects & supplies so typing spaces, Vietnamese diacritics, and commas
  // never strips trailing spaces or splits prematurely until onBlur or Save (Section D.3)
  const [daySubjectsRawText, setDaySubjectsRawText] = useState<string>(() =>
    (activeDayDraft?.subjects || []).join(', ')
  );
  const [daySuppliesRawText, setDaySuppliesRawText] = useState<string>(() =>
    (activeDayDraft?.supplies || []).join(', ')
  );

  useEffect(() => {
    const dayObj =
      scheduleDraft.weeklyDays.find((d) => d.dayOfWeek === selectedDayOfWeek) ||
      scheduleDraft.weeklyDays[0];
    setDaySubjectsRawText((dayObj?.subjects || []).join(', '));
    setDaySuppliesRawText((dayObj?.supplies || []).join(', '));
  }, [selectedDayOfWeek, scheduleDraft.weeklyDays]);

  const commitDaySubjectsToDraft = (rawText: string) => {
    const subjects = rawText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setScheduleDraft((prev) => ({
      ...prev,
      weeklyDays: prev.weeklyDays.map((d) =>
        d.dayOfWeek === selectedDayOfWeek ? { ...d, subjects } : d
      ),
    }));
  };

  const commitDaySuppliesToDraft = (rawText: string) => {
    const supplies = rawText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setScheduleDraft((prev) => ({
      ...prev,
      weeklyDays: prev.weeklyDays.map((d) =>
        d.dayOfWeek === selectedDayOfWeek ? { ...d, supplies } : d
      ),
    }));
  };

  // Timetable Document Upload State (Section D.2: JPG/PNG/PDF -> preview -> Áp dụng vào bản nháp)
  const [isParsingTimetable, setIsParsingTimetable] = useState(false);
  const [timetableUploadError, setTimetableUploadError] = useState<string | null>(null);
  const [timetableSourceFileName, setTimetableSourceFileName] = useState<string>('');
  const [timetableExtractedDays, setTimetableExtractedDays] = useState<
    Array<{
      dayOfWeek: DayOfWeekNumber;
      dayLabel: string;
      subjectsText: string;
      suppliesText: string;
      notesForChild: string;
    }> | null
  >(null);

  const handleTimetableFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTimetableUploadError(null);
    setIsParsingTimetable(true);

    try {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = window.btoa(binary);
      const rawText = file.name.toLowerCase().endsWith('.txt') ? await file.text() : '';

      const res = await fetch('/api/parent/parse-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type,
          rawText,
        }),
      });
      const payload = await res.json();

      if (!res.ok || !payload.ok || !Array.isArray(payload.weeklyDays)) {
        setTimetableUploadError(
          payload.error ||
            'Không thể đọc rõ thời khóa biểu từ tệp này. Lịch học hiện tại của con vẫn được giữ nguyên.'
        );
        return;
      }

      const mappedPreview = payload.weeklyDays.map(
        (d: {
          dayOfWeek: DayOfWeekNumber;
          dayLabel: string;
          subjects?: string[];
          suppliesToBring?: string[];
          notesForChild?: string;
        }) => ({
          dayOfWeek: d.dayOfWeek,
          dayLabel: d.dayLabel,
          subjectsText: Array.isArray(d.subjects) ? d.subjects.join(', ') : '',
          suppliesText: Array.isArray(d.suppliesToBring) ? d.suppliesToBring.join(', ') : '',
          notesForChild: String(d.notesForChild || ''),
        })
      );

      setTimetableSourceFileName(file.name);
      setTimetableExtractedDays(mappedPreview);
      showNotice(
        `Đã trích xuất thời khóa biểu từ "${file.name}"! Ba mẹ hãy kiểm tra từng ngày và bấm "Áp dụng vào bản nháp".`
      );
    } catch {
      setTimetableUploadError(
        'Có lỗi khi tải thời khóa biểu. Hệ thống giữ nguyên thời khóa biểu cũ của con.'
      );
    } finally {
      setIsParsingTimetable(false);
      e.target.value = '';
    }
  };

  const handleApplyTimetableToDraft = () => {
    if (!timetableExtractedDays) return;
    const nextWeeklyDays = scheduleDraft.weeklyDays.map((existingDay) => {
      const extracted = timetableExtractedDays.find(
        (item) => Number(item.dayOfWeek) === Number(existingDay.dayOfWeek)
      );
      if (!extracted) return existingDay;
      const parsedSubjects = extracted.subjectsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const parsedSupplies = extracted.suppliesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        ...existingDay,
        subjects: parsedSubjects,
        supplies: parsedSupplies.length > 0 ? parsedSupplies : existingDay.supplies,
        note: extracted.notesForChild || existingDay.note,
      };
    });

    setScheduleDraft({
      ...scheduleDraft,
      weeklyDays: nextWeeklyDays,
    });
    setTimetableExtractedDays(null);
    showNotice(
      'Đã áp dụng thời khóa biểu vừa trích xuất vào bản nháp! Ba mẹ bấm "Lưu & Áp dụng Thời khóa biểu" để lưu chính thức nhé.'
    );
  };

  const handleUpdateDayNote = (noteText: string) => {
    setScheduleDraft({
      ...scheduleDraft,
      weeklyDays: scheduleDraft.weeklyDays.map((d) =>
        d.dayOfWeek === selectedDayOfWeek ? { ...d, note: noteText } : d
      ),
    });
  };

  const handleAddDateOverride = () => {
    if (!overrideDateInput) return;
    const newOverride: SchoolScheduleOverride = {
      id: `override-${Date.now()}`,
      dateKey: overrideDateInput,
      reason: overrideReasonInput.trim() || 'Lịch học thay đổi đặc biệt',
      subjects: overrideSubjectsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      supplies: overrideSuppliesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    setScheduleDraft({
      ...scheduleDraft,
      dateOverrides: [
        ...scheduleDraft.dateOverrides.filter((o) => o.dateKey !== overrideDateInput),
        newOverride,
      ],
    });
    setOverrideDateInput('');
    setOverrideReasonInput('');
    setOverrideSubjectsInput('');
    setOverrideSuppliesInput('');
  };

  const handleRemoveDateOverride = (id: string) => {
    setScheduleDraft({
      ...scheduleDraft,
      dateOverrides: scheduleDraft.dateOverrides.filter((o) => o.id !== id),
    });
  };

  const handleConfirmSaveSchedule = async () => {
    const parsedSubjects = daySubjectsRawText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedSupplies = daySuppliesRawText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const finalDraft: SchoolScheduleConfig = {
      ...scheduleDraft,
      weeklyDays: scheduleDraft.weeklyDays.map((d) =>
        d.dayOfWeek === selectedDayOfWeek
          ? { ...d, subjects: parsedSubjects, supplies: parsedSupplies }
          : d
      ),
    };
    setScheduleDraft(finalDraft);
    await updateSchoolSchedule(finalDraft);
    setShowOverwriteConfirm(false);
    showNotice(
      `Đã lưu Thời khóa biểu của con (Nhắc lúc ${finalDraft.prepReminderTime})! Lời nhắc chuẩn bị cặp sách ngày mai đã được cập nhật.`
    );
  };

  // --- TASK HANDLERS (Validation + Save Draft + Preview + Approve + Delete) ---
  const handleSelectTaskToEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskDraft(JSON.parse(JSON.stringify(task)));
    setValidationError(null);
  };

  const handleStartNewBlankTask = () => {
    const newBlank: Task = {
      id: `task-custom-${Date.now()}`,
      slug: `custom-${Date.now()}`,
      title: 'Nhiệm vụ mới của con',
      subtitle: 'Mô tả ngắn gọn về nhiệm vụ hằng ngày',
      category: 'preparation',
      iconName: 'Sparkles',
      themeColor: 'ice',
      coverIllustration: 'schedule-check',
      estimatedMinutes: 5,
      starReward: 2,
      approvalStatus: 'draft',
      lastApprovedAt: new Date().toISOString(),
      steps: [
        {
          id: `step-new-${Date.now()}-1`,
          stepNumber: 1,
          actionTitle: 'Bước 1: Chuẩn bị đồ dùng',
          instruction: 'Con lấy đúng đồ dùng cần thiết đặt ngay ngắn trước mặt nhé.',
          simpleExplanation: 'Con chỉ cần lấy từng món đồ một theo bức tranh là được!',
          buddyPraise: 'Tuyệt vời! Con đã hoàn thành bước đầu tiên!',
          illustrationKey: 'schedule-check',
        },
      ],
    };
    setEditingTaskId(newBlank.id);
    setTaskDraft(newBlank);
    setValidationError(null);
  };

  const handleStepChange = (
    idx: number,
    field: keyof TaskStep,
    value: string
  ) => {
    const nextSteps = taskDraft.steps.map((st, i) =>
      i === idx ? { ...st, [field]: value } : st
    );
    setTaskDraft({ ...taskDraft, steps: nextSteps });
  };

  const handleAddStepToDraft = () => {
    if (taskDraft.steps.length >= 6) return;
    const nextNum = taskDraft.steps.length + 1;
    const newStep: TaskStep = {
      id: `step-custom-${Date.now()}`,
      stepNumber: nextNum,
      actionTitle: `Bước ${nextNum}: Thực hiện tiếp theo`,
      instruction: 'Con thực hiện bước này gọn gàng và cẩn thận nhé.',
      simpleExplanation: 'Con làm từ từ theo hướng dẫn của ba mẹ là xong ngay.',
      buddyPraise: 'Giỏi lắm! Con vừa hoàn thành thêm một bước nữa rồi!',
      illustrationKey: 'check-list',
    };
    setTaskDraft({ ...taskDraft, steps: [...taskDraft.steps, newStep] });
  };

  const validateTaskDraft = (): boolean => {
    if (!taskDraft.title.trim()) {
      setValidationError('Vui lòng nhập tên nhiệm vụ trước khi lưu.');
      return false;
    }
    if (taskDraft.steps.length === 0) {
      setValidationError('Nhiệm vụ cần có ít nhất 1 bước hướng dẫn.');
      return false;
    }
    for (let i = 0; i < taskDraft.steps.length; i++) {
      if (!taskDraft.steps[i].actionTitle.trim() || !taskDraft.steps[i].instruction.trim()) {
        setValidationError(`Vui lòng nhập đầy đủ tiêu đề và hướng dẫn cho Bước ${i + 1}.`);
        return false;
      }
    }
    setValidationError(null);
    return true;
  };

  const handleSaveTaskWithStatus = async (status: 'approved' | 'draft') => {
    if (!validateTaskDraft()) return;
    const exists = data.tasks.some((t) => t.id === taskDraft.id);
    if (exists) {
      await saveAndApproveTask({ ...taskDraft, approvalStatus: status }, status);
    } else {
      await createNewApprovedTask(
        {
          slug: taskDraft.slug,
          title: taskDraft.title,
          subtitle: taskDraft.subtitle,
          category: taskDraft.category,
          iconName: taskDraft.iconName,
          themeColor: taskDraft.themeColor,
          coverIllustration: taskDraft.coverIllustration,
          estimatedMinutes: taskDraft.estimatedMinutes,
          starReward: taskDraft.starReward,
          approvalStatus: status,
          steps: taskDraft.steps,
        },
        status
      );
    }
    showNotice(
      status === 'approved'
        ? `Đã phê duyệt nhiệm vụ "${taskDraft.title}"! Nội dung đã hiển thị trên màn hình của con.`
        : `Đã lưu bản nháp nhiệm vụ "${taskDraft.title}" (Chưa hiển thị cho con).`
    );
  };

  const handleGenerateAiTaskDraft = async () => {
    if (!aiDraftPrompt.trim() || isAiDrafting) return;
    setIsAiDrafting(true);
    try {
      const res = await fetch('/api/parent/draft-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle: aiDraftPrompt.trim(),
          childAge: data.profile.ageYears,
        }),
      });
      const payload = await res.json();
      if (payload.draft) {
        const steps: TaskStep[] = (payload.draft.steps || []).slice(0, 5).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (st: any, idx: number) => ({
            id: `step-ai-${Date.now()}-${idx}`,
            stepNumber: idx + 1,
            actionTitle: st.actionTitle || `Bước ${idx + 1}`,
            instruction: st.instruction || 'Con thực hiện cẩn thận nhé.',
            simpleExplanation: st.buddyHint || 'Con làm từng chút một là được ngay!',
            buddyPraise: 'Tuyệt vời! Con làm bước này khéo lắm!',
            illustrationKey: (st.illustrationKey as IllustrationKey) || 'check-list',
          })
        );
        const draftedTask: Task = {
          id: `task-ai-${Date.now()}`,
          slug: `custom-${Date.now()}`,
          title: payload.draft.title || aiDraftPrompt.trim(),
          subtitle: payload.draft.description || 'Nhiệm vụ do AI soạn nháp chờ ba mẹ duyệt',
          category: 'preparation',
          iconName: 'Sparkles',
          themeColor: 'ice',
          coverIllustration: steps[0]?.illustrationKey || 'tidy-desk',
          estimatedMinutes: 5,
          starReward: 2,
          approvalStatus: 'draft',
          lastApprovedAt: new Date().toISOString(),
          steps,
        };
        setTaskDraft(draftedTask);
        setAiDraftPrompt('');
        showNotice(
          `AI đã soạn bản nháp "${draftedTask.title}". Ba mẹ hãy kiểm tra và bấm "Phê duyệt" hoặc "Lưu nháp" bên phải nhé!`
        );
      }
    } finally {
      setIsAiDrafting(false);
    }
  };

  // --- GROWTH JOURNEY & MASTER CURRICULUM UPLOAD HANDLERS (Sec. 7.2, A08, A09, A10) ---
  const handleSelectJourneyTopicToEdit = (topic: GrowthQualityTopic) => {
    setEditingTopicId(topic.id);
    setTopicDraft(JSON.parse(JSON.stringify(topic)));
    setValidationError(null);
  };

  const handleJourneyExpChange = (
    idx: number,
    field: keyof GrowthExperienceItem,
    value: string
  ) => {
    if (!topicDraft) return;
    const nextExps = topicDraft.experiences.map((exp, i) =>
      i === idx ? { ...exp, [field]: value } : exp
    );
    setTopicDraft({ ...topicDraft, experiences: nextExps });
  };

  const handleJourneyExpChoicesChange = (idx: number, rawChoicesText: string) => {
    if (!topicDraft) return;
    const choices = rawChoicesText
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean);
    const nextExps = topicDraft.experiences.map((exp, i) =>
      i === idx ? { ...exp, choices } : exp
    );
    setTopicDraft({ ...topicDraft, experiences: nextExps });
  };

  const handleMoveStageOrder = async (topicId: string, direction: 'up' | 'down') => {
    const sorted = [...(data.growthTopics || [])].sort(
      (a, b) => a.stageOrder - b.stageOrder
    );
    const idx = sorted.findIndex((t) => t.id === topicId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const temp = sorted[idx];
    sorted[idx] = sorted[swapIdx];
    sorted[swapIdx] = temp;

    const reordered = sorted.map((t, i) => ({
      ...t,
      stageOrder: i + 1,
    }));
    await saveGrowthCurriculumBatchByParent(reordered, false);
    showNotice('Đã cập nhật thứ tự các chặng trên bản đồ Hành trình của con!');
  };

  const handleCurriculumMasterFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCurriculumUploadError(null);

    if (file.size > storyRepository.getMaxUploadBytes()) {
      setCurriculumUploadError(
        'Tệp lộ trình vượt quá giới hạn 1.5MB của chế độ Local Storage Demo. Ba mẹ vui lòng chọn tệp nhỏ hơn.'
      );
      e.target.value = '';
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['txt', 'docx', 'pdf', 'json'].includes(ext)) {
      setCurriculumUploadError(
        'Chỉ hỗ trợ tệp lộ trình phẩm chất định dạng .txt, .docx, .pdf hoặc .json.'
      );
      e.target.value = '';
      return;
    }

    setIsParsingCurriculumFile(true);
    try {
      let rawText = '';
      if (ext === 'txt' || ext === 'json') {
        rawText = await file.text();
      }

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileBase64 = window.btoa(binary);

      const res = await fetch('/api/journey/parse-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileBase64,
          rawText,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok || !Array.isArray(payload.topics)) {
        setCurriculumUploadError(
          payload.error ||
            'Không thể trích xuất văn bản từ tệp lộ trình này (có thể là PDF bản quét ảnh). Hệ thống không tự bịa nội dung; ba mẹ vui lòng chọn tệp có văn bản hoặc chỉnh sửa thủ công.'
        );
        return;
      }

      const nowIso = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedTopics: GrowthQualityTopic[] = payload.topics.map((raw: any, idx: number) => ({
        id: raw.id || `journey-master-${Date.now()}-${idx}`,
        slug: raw.slug || 'gratitude',
        stageOrder: idx + 1,
        title: raw.title || `Chặng ${idx + 1}`,
        subtitle:
          raw.subtitle || 'Khám phá, hiểu, thực hành và chia sẻ phẩm chất tốt đẹp mỗi ngày',
        landmarkName: raw.landmarkName || `Chặng ${idx + 1} · Trạm Khám Phá`,
        themeColor: raw.themeColor || 'yellow',
        illustrationKey: raw.illustrationKey || 'schedule-check',
        starRewardPerExperience: 1,
        approvalStatus: 'draft',
        selectedByParent: true,
        isCurrentFocus: idx === 0,
        isParentUploaded: true,
        sourceFileName: file.name,
        version: 1,
        updatedAt: nowIso,
        experiences: Array.isArray(raw.experiences)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            raw.experiences.map((exp: any, eIdx: number) => ({
              id: exp.id || `exp-master-${Date.now()}-${idx}-${eIdx}`,
              type: exp.type || (['explore', 'understand', 'practice', 'share'][eIdx] as GrowthExperienceItem['type']),
              typeLabel:
                exp.typeLabel ||
                (['Khám phá', 'Hiểu', 'Thực hành', 'Chia sẻ'][eIdx] as GrowthExperienceItem['typeLabel']),
              title: exp.title || `Hoạt động ${eIdx + 1}`,
              promptOrStory: exp.promptOrStory || '',
              choices: Array.isArray(exp.choices) ? exp.choices : undefined,
              actionSuggestion: exp.actionSuggestion,
              buddyWarmFeedback:
                exp.buddyWarmFeedback || 'Hoan hô con đã hoàn thành bước trải nghiệm này!',
              status: 'not_explored',
            }))
          : [],
      }));

      setUploadedCurriculumBatch(mappedTopics);
      setUploadedCurriculumSource(file.name);
      if (mappedTopics[0]) {
        setTopicDraft(JSON.parse(JSON.stringify(mappedTopics[0])));
      }
      showNotice(
        `Đã tách thành công ${mappedTopics.length} chặng phẩm chất từ tệp "${file.name}"! Ba mẹ hãy kiểm tra, chỉnh sửa và bấm "Phê duyệt & Xuất bản lộ trình" bên dưới.`
      );
    } catch {
      setCurriculumUploadError(
        'Có lỗi khi đọc tệp lộ trình phẩm chất. Ba mẹ vui lòng kiểm tra lại tệp hoặc chỉnh sửa thủ công.'
      );
    } finally {
      setIsParsingCurriculumFile(false);
      e.target.value = '';
    }
  };

  const handlePublishUploadedCurriculum = async (approveAll: boolean) => {
    if (!uploadedCurriculumBatch || uploadedCurriculumBatch.length === 0) return;
    await saveGrowthCurriculumBatchByParent(uploadedCurriculumBatch, approveAll);
    const first = uploadedCurriculumBatch[0];
    setUploadedCurriculumBatch(null);
    if (first) {
      setEditingTopicId(first.id);
      setTopicDraft(first);
    }
    showNotice(
      approveAll
        ? `Đã phê duyệt & xuất bản ${uploadedCurriculumBatch.length} chặng phẩm chất lên Bản đồ Hành trình của con!`
        : `Đã lưu bản nháp ${uploadedCurriculumBatch.length} chặng phẩm chất (Chưa hiển thị cho con).`
    );
  };

  const handleSaveJourneyTopic = async (status: 'approved' | 'draft') => {
    if (!topicDraft) return;
    if (!topicDraft.title.trim() || !topicDraft.subtitle.trim()) {
      setValidationError('Vui lòng nhập đầy đủ tên chủ đề phẩm chất và mô tả ngắn.');
      return;
    }
    const nextTopic: GrowthQualityTopic = {
      ...topicDraft,
      approvalStatus: status,
      selectedByParent: status === 'approved' ? topicDraft.selectedByParent : false,
    };
    setTopicDraft(nextTopic);
    await saveGrowthTopicByParent(nextTopic);
    showNotice(
      status === 'approved'
        ? `Đã phê duyệt & cập nhật chủ đề Hành trình "${nextTopic.title}" cho con!`
        : `Đã lưu bản nháp chủ đề "${nextTopic.title}" (Chưa hiển thị cho con).`
    );
  };

  // --- BEDTIME STORY & AI MULTI-EPISODE PODCAST LIBRARY HANDLERS (v1.4 Section VII) ---
  const runMultiEpisodeAnalysis = async (params: {
    fileName: string;
    fileBase64?: string;
    rawText?: string;
    sourceType: 'txt' | 'docx' | 'pdf' | 'manual';
  }) => {
    setUploadError(null);
    setIsParsingFile(true);
    try {
      const res = await fetch('/api/stories/analyze-episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: params.fileName,
          fileBase64: params.fileBase64,
          rawText: params.rawText,
          childAge: data.profile.ageYears,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok || !Array.isArray(payload.episodes)) {
        setUploadError(
          payload.error ||
            'Không thể trích xuất nội dung từ tài liệu này (tệp có thể rỗng hoặc là PDF bản quét ảnh). Hệ thống không tự bịa nội dung; ba mẹ vui lòng chọn tệp có văn bản hoặc dán nội dung trực tiếp.'
        );
        return;
      }

      const nowIso = new Date().toISOString();
      const totalEpisodes = payload.episodes.length;
      const illustTypes: Story['illustrationType'][] = [
        'bau-troi-dem',
        'tich-chu',
        'kien-nho',
        'hat-giong',
        'chim-se',
      ];
      const themes: Story['coverTheme'][] = ['lavender', 'ice', 'yellow', 'mint', 'peach'];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedEpisodes: Story[] = payload.episodes.map((ep: any, idx: number) => ({
        id: `story-ep-${Date.now()}-${idx + 1}`,
        title: ep.title || `${params.fileName.replace(/\.[^.]+$/, '')} – Tập ${idx + 1}`,
        category: 'Truyện Ba Mẹ tải lên',
        summary:
          ep.summary ||
          `Tập ${idx + 1}/${totalEpisodes} được AI biên tập (~3 phút) từ tài liệu gia đình.`,
        durationMinutes: ep.durationMinutes || 3,
        actualDurationSeconds: ep.estimatedDurationSeconds || 180,
        ageRecommendation: ep.ageRecommendation || `${data.profile.ageGroup} tuổi`,
        coverTheme: themes[idx % themes.length],
        illustrationType: illustTypes[idx % illustTypes.length],
        paragraphs:
          Array.isArray(ep.paragraphs) && ep.paragraphs.length > 0
            ? ep.paragraphs
            : ['Nội dung tập truyện đã sẵn sàng để ba mẹ kiểm tra.'],
        moralLesson:
          ep.moralLesson ||
          'Mỗi câu chuyện trước giờ đi ngủ mang đến cho con bài học yêu thương ấm áp.',
        reflectionQuestion:
          ep.reflectionQuestion ||
          'Chi tiết nào trong tập truyện tối nay làm con thấy thú vị nhất?',
        reflectionSuggestions:
          Array.isArray(ep.reflectionSuggestions) && ep.reflectionSuggestions.length >= 2
            ? ep.reflectionSuggestions
            : [
                'Tình cảm yêu thương ấm áp trong câu chuyện',
                'Sự kiên trì và lòng tốt của nhân vật',
                'Con muốn nghe tiếp tập sau vào tối mai',
              ],
        approvedByParent: false,
        approvalStatus: 'draft',
        hiddenByParent: false,
        isParentUploaded: true,
        sourceFileName: params.fileName,
        sourceType: params.sourceType,
        uploadedAt: nowIso,
        createdAt: nowIso,
        askQuestionAfterStory: true,
        audioStatus: 'none',
        contentVersion: 1,
        orderIndex: idx + 1,
        sourceDocumentInfo: {
          fileName: params.fileName,
          fileType: params.sourceType,
          uploadedAt: nowIso,
          originalLengthChars: payload.sourceDocumentInfo?.originalLengthChars || 0,
          episodeNumber: idx + 1,
          totalEpisodesInDoc: totalEpisodes,
        },
      }));

      setAiEpisodeBatchDrafts(mappedEpisodes);
      setAnalyzedDocSummary({
        fileName: params.fileName,
        originalLengthChars: payload.sourceDocumentInfo?.originalLengthChars || 0,
        totalEpisodes,
      });

      if (mappedEpisodes[0]) {
        setEditingStoryDraft(mappedEpisodes[0]);
        setParagraphsTextInput(mappedEpisodes[0].paragraphs.join('\n\n'));
      }

      showNotice(
        `AI đã biên tập tài liệu "${params.fileName}" thành ${totalEpisodes} tập Podcast (~3 phút/tập)! Ba mẹ hãy kiểm tra danh sách bản nháp bên dưới và bấm Phê duyệt.`
      );
    } catch {
      setUploadError(
        'Có lỗi khi phân tích tài liệu. Ba mẹ vui lòng kiểm tra lại tệp hoặc dán văn bản trực tiếp.'
      );
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleFileUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (file.size > storyRepository.getMaxUploadBytes()) {
      setUploadError(
        'Tệp tải lên vượt quá giới hạn 1.5MB của chế độ Local Storage Demo. Ba mẹ vui lòng chọn tệp nhỏ hơn hoặc dán văn bản trực tiếp.'
      );
      e.target.value = '';
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['txt', 'docx', 'pdf'].includes(ext)) {
      setUploadError('Chỉ hỗ trợ tệp định dạng .docx, .pdf hoặc .txt.');
      e.target.value = '';
      return;
    }

    try {
      let rawText = '';
      if (ext === 'txt') {
        rawText = await file.text();
      }
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileBase64 = window.btoa(binary);

      await runMultiEpisodeAnalysis({
        fileName: file.name,
        fileBase64,
        rawText,
        sourceType: ext as 'txt' | 'docx' | 'pdf',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleAnalyzeRawTextToEpisodes = async () => {
    if (!rawDocumentTextInput.trim() || rawDocumentTextInput.trim().length < 40) {
      setUploadError('Vui lòng dán nội dung truyện tối thiểu 40 ký tự để AI phân tích và chia tập.');
      return;
    }
    await runMultiEpisodeAnalysis({
      fileName: editingStoryDraft.title.trim() || 'Truyện Gia Đình',
      rawText: rawDocumentTextInput.trim(),
      sourceType: 'manual',
    });
  };

  const handleApproveEpisodeBatch = async (approveAll: boolean, generateAudioForFirst = false) => {
    if (!aiEpisodeBatchDrafts || aiEpisodeBatchDrafts.length === 0) return;
    const res = await saveParentStoryBatch(aiEpisodeBatchDrafts, approveAll);
    if (!res.ok) {
      setUploadError(res.error || 'Không thể lưu danh sách tập truyện.');
      return;
    }
    const firstEp = aiEpisodeBatchDrafts[0];
    const count = aiEpisodeBatchDrafts.length;
    setAiEpisodeBatchDrafts(null);
    setRawDocumentTextInput('');

    if (approveAll && generateAudioForFirst && firstEp) {
      showNotice(
        `Đã phê duyệt ${count} tập vào Thư viện Podcast! Đang tạo tệp âm thanh liên tục cho "${firstEp.title}"...`
      );
      setSynthesizingStoryId(firstEp.id);
      await synthesizeStoryPodcastEpisode(firstEp.id, false);
      setSynthesizingStoryId(null);
      showNotice(`Hoàn tất tạo âm thanh liên tục cho "${firstEp.title}"!`);
    } else {
      showNotice(
        approveAll
          ? `Đã phê duyệt & thêm ${count} tập truyện vào Thư viện Podcast của con!`
          : `Đã lưu ${count} tập truyện ở trạng thái Bản nháp (Chưa hiển thị cho con).`
      );
    }
  };

  const handleTriggerEpisodeAudioGeneration = async (storyId: string, force = false) => {
    setSynthesizingStoryId(storyId);
    const res = await synthesizeStoryPodcastEpisode(storyId, force);
    setSynthesizingStoryId(null);
    if (res.ok) {
      showNotice(
        `Đã tạo thành công bản thu Podcast liên tục (${formatPodcastTime(
          res.actualDurationSeconds || 180
        )})!`
      );
    } else {
      showNotice(
        res.error ||
          'Máy chủ TTS đang dùng chế độ đọc liên tục trình duyệt. Ba mẹ có thể bấm Tạo lại bất cứ lúc nào.'
      );
    }
  };

  const handleSelectExistingStoryToEdit = (story: Story) => {
    setEditingStoryDraft({ ...story });
    setParagraphsTextInput(story.paragraphs.join('\n\n'));
    setUploadError(null);
  };

  const handleStartNewStoryDraft = () => {
    const fresh: Story = {
      id: `story-parent-${Date.now()}`,
      title: '',
      category: 'Truyện Ba Mẹ tải lên',
      summary: 'Câu chuyện yêu thương do ba mẹ chuẩn bị riêng cho giờ đi ngủ của con.',
      durationMinutes: 3,
      ageRecommendation: '6–12 tuổi',
      coverTheme: 'lavender',
      illustrationType: 'bau-troi-dem',
      paragraphs: [
        'Ngày xửa ngày xưa, trong một ngôi nhà nhỏ ngập tràn tiếng cười, có một bạn nhỏ rất ngoan ngoãn và giàu lòng yêu thương...',
      ],
      moralLesson: 'Mỗi ngày cố gắng làm việc tốt sẽ mang lại niềm vui cho cả gia đình.',
      reflectionQuestion: 'Hôm nay điều gì làm con cảm thấy vui và ấm áp nhất trước khi ngủ?',
      reflectionSuggestions: [
        'Được nghe giọng Buddy đọc truyện của ba mẹ',
        'Hoàn thành gọn gàng các việc trong ngày',
        'Chúc ba mẹ và cả nhà ngủ thật ngon',
      ],
      approvedByParent: false,
      approvalStatus: 'draft',
      isParentUploaded: true,
      sourceType: 'manual',
      askQuestionAfterStory: true,
      audioStatus: 'none',
      contentVersion: 1,
      createdAt: new Date().toISOString(),
    };
    setEditingStoryDraft(fresh);
    setParagraphsTextInput(fresh.paragraphs.join('\n\n'));
    setUploadError(null);
  };

  const handleSaveStoryWithStatus = async (approveForKid: boolean) => {
    const splitParas = paragraphsTextInput
      .split(/\n{2,}/)
      .map((p) => p.replace(/\n+/g, ' ').trim())
      .filter(Boolean);

    if (!editingStoryDraft.title.trim()) {
      setUploadError('Vui lòng nhập tên tập truyện trước khi lưu.');
      return;
    }
    if (splitParas.length === 0) {
      setUploadError('Vui lòng nhập nội dung câu chuyện.');
      return;
    }

    const finalStory: Story = {
      ...editingStoryDraft,
      title: editingStoryDraft.title.trim(),
      paragraphs: splitParas,
      approvedByParent: approveForKid,
      approvalStatus: approveForKid ? 'approved' : 'draft',
      hiddenByParent: !approveForKid,
    };

    // Also update item inside aiEpisodeBatchDrafts if currently reviewing batch
    if (aiEpisodeBatchDrafts) {
      setAiEpisodeBatchDrafts((prev) =>
        prev ? prev.map((ep) => (ep.id === finalStory.id ? finalStory : ep)) : null
      );
    }

    const result = await saveParentStory(finalStory);
    if (!result.ok) {
      setUploadError(result.error || 'Vui lòng kiểm tra lại nội dung truyện.');
      return;
    }
    setUploadError(null);
    setEditingStoryDraft(finalStory);
    showNotice(
      approveForKid
        ? `Đã phê duyệt & lưu tập "${finalStory.title}" vào Thư viện Podcast của con!`
        : `Đã lưu bản nháp "${finalStory.title}" (Chưa hiển thị cho con).`
    );
  };

  const handleExecuteConfirmedDelete = async () => {
    if (!confirmDeleteTarget) return;
    const { kind, id, title } = confirmDeleteTarget;
    if (kind === 'task') {
      await deleteTaskByParent(id);
      const remaining = data.tasks.filter((t) => t.id !== id);
      if (remaining[0]) {
        handleSelectTaskToEdit(remaining[0]);
      }
      showNotice(`Đã xóa nhiệm vụ "${title}".`);
    } else if (kind === 'story') {
      await deleteParentStory(id);
      showNotice(`Đã xóa truyện "${title}".`);
    } else if (kind === 'reward') {
      await deleteRewardByParent(id);
      showNotice(`Đã xóa phần thưởng "${title}".`);
    }
    setConfirmDeleteTarget(null);
  };

  // Render Demo Gate if not unlocked yet
  if (!parentUnlocked) {
    return (
      <div className="max-w-lg mx-auto py-6">
        <div className="rounded-[24px] bg-white border border-[#23324D]/12 p-6 md:p-8 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#3978F6] bg-[#EAF3FF] px-3 py-1 rounded-xl">
              DEMO GATE · Cổng xác nhận Phụ huynh
            </span>
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-bold text-[#23324D]/70 hover:text-[#23324D] cursor-pointer"
            >
              ← Quay lại màn hình của bé
            </button>
          </div>

          <div className="space-y-2">
            <h1 className="font-kids text-2xl font-extrabold text-[#23324D]">
              Khu vực dành riêng cho Phụ huynh (Buddy Parents)
            </h1>
            <p className="text-sm text-[#23324D]/75 leading-relaxed">
              Lưu ý minh bạch: Đây là <strong>Cổng Demo (Demo Gate)</strong> phục vụ kiểm thử nhanh. Khi triển khai thực tế, khu vực này sử dụng xác thực tài khoản người lớn (Firebase Authentication).
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const ok = unlockParentArea(passcodeInput, adultConfirmed);
              if (!ok) {
                setGateError(
                  `Vui lòng tích xác nhận phụ huynh và nhập đúng mã PIN mẫu (${data.parentSettings.demoPasscode}).`
                );
              } else {
                setGateError(null);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-[#23324D] mb-1.5">
                Mã PIN Demo của Phụ huynh (Mặc định: {data.parentSettings.demoPasscode})
              </label>
              <input
                type="text"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                className="w-full min-h-[48px] px-4 rounded-[16px] bg-[#F7F9FD] border border-[#23324D]/15 font-mono text-lg font-bold text-[#23324D]"
              />
            </div>

            <label className="flex items-start gap-2.5 text-xs text-[#23324D]/85 cursor-pointer">
              <input
                type="checkbox"
                checked={adultConfirmed}
                onChange={(e) => setAdultConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#3978F6]"
              />
              <span>
                Tôi xác nhận mình là phụ huynh/người giám hộ đang kiểm thử và cấu hình nội dung cho bé.
              </span>
            </label>

            {gateError && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl">
                {gateError}
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 min-h-[48px] px-5 py-3 rounded-[16px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>Mở Bảng điều khiển Phụ huynh</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const PARENT_NAV_GROUPS: Array<{
    id: ParentGroupKey;
    label: string;
    shortLabel: string;
    badge?: number;
    icon: React.ReactNode;
  }> = [
    {
      id: 'overview',
      label: '1. Tổng quan',
      shortLabel: 'Tổng quan',
      badge: totalPendingApprovalItems > 0 ? totalPendingApprovalItems : undefined,
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'schedule',
      label: '2. Lịch học & Nhắc việc',
      shortLabel: 'Lịch học & Nhắc việc',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: 'tasks',
      label: '3. Nhiệm vụ',
      shortLabel: 'Nhiệm vụ',
      badge: pendingTasksCount > 0 ? pendingTasksCount : undefined,
      icon: <Edit3 className="w-4 h-4" />,
    },
    {
      id: 'journey',
      label: '4. Hành trình phẩm chất',
      shortLabel: 'Hành trình phẩm chất',
      badge: pendingJourneyCount > 0 ? pendingJourneyCount : undefined,
      icon: <Compass className="w-4 h-4" />,
    },
    {
      id: 'stories',
      label: '5. Câu chuyện',
      shortLabel: 'Câu chuyện',
      badge: pendingStoriesCount > 0 ? pendingStoriesCount : undefined,
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'rewards',
      label: '6. Sao & Quà',
      shortLabel: 'Sao & Quà',
      badge: unconfirmedRedemptions.length > 0 ? unconfirmedRedemptions.length : undefined,
      icon: <Gift className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: '7. Cài đặt',
      shortLabel: 'Cài đặt',
      icon: <Sliders className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-5 pb-10">
      {/* Top Header (Section D.1: Concise title without long intro strings) */}
      <div className="rounded-[24px] bg-[#23324D] text-white p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-kids text-xl sm:text-2xl font-extrabold">
            Đồng hành cùng {data.profile.displayName} ({data.profile.ageYears} tuổi ·{' '}
            {data.profile.characterVariant === 'boy' ? 'Nam' : 'Nữ'})
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[42px] px-4 py-2 rounded-[16px] bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Sang màn hình của Con</span>
          </button>

          <button
            type="button"
            onClick={lockParentArea}
            className="min-h-[42px] px-4 py-2 rounded-[16px] bg-rose-500/90 hover:bg-rose-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Khóa cổng</span>
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="rounded-[18px] bg-[#DDF5E8] border border-emerald-500/40 px-4 py-3 text-sm font-bold text-[#23324D] flex items-center justify-between">
          <span>✓ {statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-xs underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {validationError && (
        <div className="rounded-[18px] bg-rose-50 border border-rose-300 px-4 py-3 text-sm font-bold text-rose-700 flex items-center justify-between">
          <span>⚠️ {validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-xs underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Confirmation Modal before deleting any item */}
      {confirmDeleteTarget && (
        <div className="rounded-[22px] bg-[#FFE4D8] border-2 border-rose-400 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-kids font-extrabold text-sm sm:text-base text-[#23324D]">
                Xác nhận xóa "{confirmDeleteTarget.title}"?
              </h3>
              <p className="text-xs text-[#23324D]/80">
                Mục này sẽ bị xóa khỏi danh sách hiển thị của con.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExecuteConfirmedDelete}
              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
            >
              Xác nhận xóa
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteTarget(null)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white text-[#23324D] font-bold text-xs border border-[#23324D]/15 cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Kid-View Preview Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-[#23324D]/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewItem(null);
          }}
        >
          <div className="w-full max-w-md bg-[#F7F9FD] rounded-[28px] p-5 border border-white shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#23324D]/10 pb-3">
              <span className="px-3 py-1 rounded-full bg-[#EAF3FF] text-[#3978F6] font-kids font-extrabold text-xs">
                Xem trước giao diện Trẻ em
              </span>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="px-3 py-1 rounded-xl bg-white text-xs font-bold text-[#23324D] border border-[#23324D]/15 cursor-pointer"
              >
                Đóng xem trước
              </button>
            </div>

            {previewItem.type === 'task' && (
              <div className="space-y-3">
                <TaskStepIllustration
                  illustrationKey={previewItem.task.coverIllustration}
                  variant="cover"
                  className="w-full h-44 rounded-[22px]"
                  showActionCaption
                />
                <h3 className="font-kids text-xl font-extrabold text-[#23324D]">
                  {previewItem.task.title} (+{previewItem.task.starReward} ★)
                </h3>
                <p className="text-xs text-[#5C6F8C]">{previewItem.task.subtitle}</p>
                <div className="space-y-2">
                  {previewItem.task.steps.map((st, idx) => (
                    <div
                      key={st.id}
                      className="rounded-2xl bg-white p-3 border border-[#23324D]/8 flex items-center gap-3"
                    >
                      <div className="w-14 h-14 shrink-0">
                        <TaskStepIllustration
                          illustrationKey={st.illustrationKey}
                          className="w-full h-full rounded-xl p-0.5"
                        />
                      </div>
                      <div>
                        <p className="font-kids font-extrabold text-xs text-[#3978F6]">
                          Bước {idx + 1}: {st.actionTitle}
                        </p>
                        <p className="text-xs text-[#23324D]">{st.instruction}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {previewItem.type === 'story' && (
              <div className="space-y-3">
                <StoryEditorialIllustration
                  type={previewItem.story.illustrationType}
                  className="w-full h-40 rounded-[22px]"
                />
                <h3 className="font-kids text-xl font-extrabold text-[#23324D]">
                  {previewItem.story.title || 'Truyện chưa đặt tên'}
                </h3>
                <div className="space-y-2 bg-white p-3.5 rounded-2xl border border-[#23324D]/8 max-h-48 overflow-y-auto">
                  {previewItem.story.paragraphs.map((p, i) => (
                    <p key={i} className="text-xs sm:text-sm text-[#23324D] leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>
                <p className="text-xs font-bold text-indigo-800 bg-[#EDE7FF] p-3 rounded-xl">
                  Bài học: {previewItem.story.moralLesson}
                </p>
              </div>
            )}

            {previewItem.type === 'journey' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <GrowthTopicIllustration
                    slug={previewItem.topic.slug}
                    className="w-16 h-16 shrink-0"
                  />
                  <div>
                    <span className="text-xs font-kids font-extrabold text-[#3978F6]">
                      Trạm {previewItem.topic.stageOrder}: {previewItem.topic.landmarkName}
                    </span>
                    <h3 className="font-kids text-xl font-extrabold text-[#23324D]">
                      {previewItem.topic.title}
                    </h3>
                    <p className="text-xs text-[#5C6F8C]">{previewItem.topic.subtitle}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {previewItem.topic.experiences.map((exp) => (
                    <div
                      key={exp.id}
                      className="rounded-2xl bg-white p-3 border border-[#23324D]/8 space-y-1"
                    >
                      <span className="text-[11px] font-kids font-extrabold text-[#3978F6]">
                        {exp.typeLabel}: {exp.title}
                      </span>
                      <p className="text-xs text-[#23324D]">{exp.promptOrStory}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Responsive Mobile & Tablet Group Navigation (7 Clear Functional Groups) */}
      <div className="space-y-5">
        <nav aria-label="Nhóm quản lý Khu vực Phụ huynh">
          <div className="flex items-center gap-2 overflow-x-auto md:flex-wrap pb-1.5 md:pb-0 no-scrollbar bg-white rounded-[24px] p-2.5 border border-[#23324D]/10 shadow-2xs">
            {PARENT_NAV_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setParentGroup(group.id);
                  setValidationError(null);
                }}
                className={`min-h-[42px] px-3.5 py-2 rounded-[18px] text-xs font-kids font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  parentGroup === group.id
                    ? 'bg-[#3978F6] text-white shadow-2xs'
                    : 'bg-[#F7F9FD] text-[#23324D] hover:bg-[#EAF3FF]'
                }`}
              >
                {group.icon}
                <span>{group.shortLabel}</span>
                {typeof group.badge === 'number' && group.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none ${
                      parentGroup === group.id
                        ? 'bg-white text-[#3978F6]'
                        : 'bg-amber-400 text-[#23324D]'
                    }`}
                  >
                    {group.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Main Active Group Content */}
        <div className="space-y-6">
          {/* =====================================================================
              GROUP 1: TỔNG QUAN (ACTION-ORIENTED OVERVIEW)
              ===================================================================== */}
          {parentGroup === 'overview' && (
            <div className="space-y-5">
              {/* 4 Key Actionable Blocks for Parents (Section II.1) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Block 1: Nội dung cần phụ huynh phê duyệt */}
                <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-900 bg-[#FFF0C9] px-3 py-1 rounded-xl">
                      1. Nội dung cần phụ huynh phê duyệt
                    </span>
                    <span className="text-xs font-kids font-extrabold text-[#23324D]">
                      {totalPendingApprovalItems} mục chờ xử lý
                    </span>
                  </div>

                  {totalPendingApprovalItems === 0 ? (
                    <div className="rounded-2xl bg-[#DDF5E8]/60 border border-emerald-500/20 p-3.5 text-xs font-bold text-emerald-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Tất cả nhiệm vụ, câu chuyện, phẩm chất và quà đều đã được phê duyệt.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingTasksCount > 0 && (
                        <div className="rounded-xl bg-[#F7F9FD] p-3 border border-[#23324D]/8 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#23324D]">
                            {pendingTasksCount} nhiệm vụ đang ở trạng thái Nháp / Chờ duyệt
                          </span>
                          <button
                            type="button"
                            onClick={() => setParentGroup('tasks')}
                            className="px-3 py-1.5 rounded-xl bg-[#3978F6] text-white text-[11px] font-kids font-extrabold cursor-pointer shrink-0"
                          >
                            Duyệt nhiệm vụ
                          </button>
                        </div>
                      )}
                      {pendingStoriesCount > 0 && (
                        <div className="rounded-xl bg-[#F7F9FD] p-3 border border-[#23324D]/8 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#23324D]">
                            {pendingStoriesCount} tập câu chuyện đang chờ duyệt hoặc tạm ẩn
                          </span>
                          <button
                            type="button"
                            onClick={() => setParentGroup('stories')}
                            className="px-3 py-1.5 rounded-xl bg-[#3978F6] text-white text-[11px] font-kids font-extrabold cursor-pointer shrink-0"
                          >
                            Mở Câu chuyện
                          </button>
                        </div>
                      )}
                      {pendingJourneyCount > 0 && (
                        <div className="rounded-xl bg-[#F7F9FD] p-3 border border-[#23324D]/8 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#23324D]">
                            {pendingJourneyCount} chủ đề Hành trình phẩm chất chờ duyệt
                          </span>
                          <button
                            type="button"
                            onClick={() => setParentGroup('journey')}
                            className="px-3 py-1.5 rounded-xl bg-[#3978F6] text-white text-[11px] font-kids font-extrabold cursor-pointer shrink-0"
                          >
                            Duyệt Hành trình
                          </button>
                        </div>
                      )}
                      {unconfirmedRedemptions.length > 0 && (
                        <div className="rounded-xl bg-[#FFF0C9]/60 p-3 border border-amber-300 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-amber-950">
                            {unconfirmedRedemptions.length} phần quà con quay trúng chờ Ba Mẹ trao
                          </span>
                          <button
                            type="button"
                            onClick={() => setParentGroup('rewards')}
                            className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-[11px] font-kids font-extrabold cursor-pointer shrink-0"
                          >
                            Xác nhận quà
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Block 2: Lịch nhắc gần nhất */}
                <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#3978F6] bg-[#EAF3FF] px-3 py-1 rounded-xl">
                      2. Lịch nhắc gần nhất
                    </span>
                    <button
                      type="button"
                      onClick={() => setParentGroup('schedule')}
                      className="text-xs font-bold text-[#3978F6] hover:underline cursor-pointer"
                    >
                      Chỉnh lịch →
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    <div className="rounded-2xl bg-[#F7F9FD] p-3 border border-[#23324D]/8 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-kids font-extrabold text-xs sm:text-sm text-[#23324D]">
                          Nhắc chuẩn bị sách vở & cặp sách
                        </p>
                        <p className="text-[11px] text-[#5C6F8C]">
                          {data.schoolSchedule.reminderEnabled
                            ? 'Đang bật nhắc tự động mỗi tối'
                            : 'Đang tạm tắt nhắc tự động'}
                        </p>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl bg-[#EAF3FF] text-[#3978F6] font-mono font-extrabold text-sm">
                        {data.schoolSchedule.prepReminderTime}
                      </span>
                    </div>

                    <div className="rounded-2xl bg-[#F7F9FD] p-3 border border-[#23324D]/8 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-kids font-extrabold text-xs sm:text-sm text-[#23324D] truncate">
                          Podcast trước giờ ngủ: {tonightScheduledStory?.title || 'Chưa chọn'}
                        </p>
                        <p className="text-[11px] text-[#5C6F8C]">
                          Giờ nghỉ ngơi buổi tối: {data.parentSettings.bedtimeQuietHour}
                        </p>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl bg-[#FFE4D8] text-rose-800 font-mono font-extrabold text-sm shrink-0">
                        {data.bedtimeStoryConfig?.bedtimeReminderTime || '20:30'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Block 3: Nhiệm vụ sắp đến */}
                <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-indigo-800 bg-[#EDE7FF] px-3 py-1 rounded-xl">
                      3. Nhiệm vụ sắp đến hôm nay
                    </span>
                    <button
                      type="button"
                      onClick={() => setParentGroup('tasks')}
                      className="text-xs font-bold text-[#3978F6] hover:underline cursor-pointer"
                    >
                      Quản lý nhiệm vụ →
                    </button>
                  </div>

                  {upcomingRoutinesToday.length === 0 ? (
                    <p className="text-xs text-emerald-700 font-bold bg-[#DDF5E8]/60 p-3 rounded-xl">
                      ✓ Con đã hoàn thành toàn bộ lịch việc thường ngày hôm nay!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {upcomingRoutinesToday.slice(0, 4).map((routine) => (
                        <div
                          key={routine.id}
                          className="rounded-xl bg-[#F7F9FD] p-2.5 border border-[#23324D]/8 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <p className="font-kids font-extrabold text-[#23324D]">
                              {routine.title}
                            </p>
                            <p className="text-[11px] text-[#5C6F8C]">
                              {routine.period === 'morning'
                                ? 'Buổi sáng'
                                : routine.period === 'after_school'
                                ? 'Sau giờ học'
                                : 'Buổi tối'}{' '}
                              · +{data.pointsPolicy.routineBonusStars} ★
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-white border border-[#23324D]/10 font-mono font-bold text-[#3978F6]">
                            {routine.dueTime || 'Hôm nay'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Block 4: Hoạt động đã hoàn thành */}
                <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-800 bg-[#DDF5E8] px-3 py-1 rounded-xl">
                      4. Hoạt động đã hoàn thành ({completedRoutinesListToday.length}/
                      {approvedRoutines.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setParentGroup('rewards')}
                      className="text-xs font-bold text-[#3978F6] hover:underline cursor-pointer"
                    >
                      {starSummary.monthlyStars}/{starSummary.threshold} ★ tháng này →
                    </button>
                  </div>

                  <div className="space-y-2">
                    {completedRoutinesListToday.length === 0 && data.taskRuns.length === 0 ? (
                      <p className="text-xs text-[#5C6F8C]">
                        Chưa có hoạt động nào hoàn thành trong hôm nay.
                      </p>
                    ) : (
                      <>
                        {completedRoutinesListToday.slice(0, 3).map((routine) => (
                          <div
                            key={routine.id}
                            className="rounded-xl bg-[#DDF5E8]/45 p-2.5 border border-emerald-500/20 flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="font-kids font-extrabold text-[#23324D]">
                              ✓ {routine.title}
                            </span>
                            <span className="font-bold text-emerald-800">
                              +{data.pointsPolicy.routineBonusStars} ★
                            </span>
                          </div>
                        ))}
                        {data.taskRuns.slice(0, 2).map((run) => {
                          const matchedTask = data.tasks.find((t) => t.id === run.taskId);
                          return (
                            <div
                              key={run.id}
                              className="rounded-xl bg-[#F7F9FD] p-2.5 border border-[#23324D]/8 flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="font-bold text-[#23324D]">
                                Hoàn thành hướng dẫn: {matchedTask?.title || 'Nhiệm vụ'}
                              </span>
                              <span className="text-[11px] font-bold text-[#3978F6]">
                                +{run.starsAwarded} ★
                              </span>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Current Virtue Topic & Recent Child Reflections */}
              <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-3 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-kids text-base font-extrabold text-[#23324D]">
                      Hành trình phẩm chất & Chia sẻ gần đây của {data.profile.displayName}
                    </h3>
                    {currentFocusTopic && (
                      <p className="text-xs text-[#5C6F8C]">
                        Chủ đề trọng tâm: <strong>{currentFocusTopic.title}</strong> (
                        {
                          currentFocusTopic.experiences.filter(
                            (e) => e.status === 'experienced'
                          ).length
                        }
                        /{currentFocusTopic.experiences.length} bước đã trải nghiệm)
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setParentGroup('journey')}
                    className="text-xs font-bold text-[#3978F6] hover:underline cursor-pointer"
                  >
                    Quản lý Hành trình phẩm chất →
                  </button>
                </div>

                {(data.growthLogs || []).length === 0 ? (
                  <p className="text-xs text-[#5C6F8C]">Chưa có ghi nhận trải nghiệm mới.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {data.growthLogs.slice(0, 4).map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl bg-[#F7F9FD] p-3 border border-[#23324D]/6 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-bold text-[#3978F6]">{log.topicTitle}</span> ·{' '}
                          <span className="font-bold text-[#23324D]">{log.experienceTitle}</span>
                          {log.childReflection && (
                            <p className="text-[#5C6F8C] italic mt-0.5">
                              Chia sẻ của con: “{log.childReflection}”
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 shrink-0">
                          {log.dateKey}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              GROUP 2: LỊCH HỌC VÀ NHẮC VIỆC (v1.4 Section D.2, D.3, D.4)
              ===================================================================== */}
          {parentGroup === 'schedule' && (
            <div className="space-y-6">
              {/* School Schedule Card */}
              <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 md:p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#23324D]/10 pb-4">
                  <div>
                    <span className="text-xs font-bold text-[#3978F6]">
                      Nhắc chuẩn bị sách vở trong ứng dụng (In-App Reminder)
                    </span>
                    <h2 className="font-kids text-xl font-extrabold text-[#23324D]">
                      Thời khóa biểu của {data.profile.displayName} (Thứ Hai – Chủ Nhật)
                    </h2>
                    <p className="text-xs text-[#23324D]/70 mt-0.5">
                      Khi tới giờ nhắc buổi tối, Buddy sẽ hiển thị thẻ nhắc và đọc đúng các môn học & đồ dùng cần chuẩn bị cho ngày mai.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {/* Section D.2: Upload Timetable (JPG/PNG/PDF) */}
                    <label className="min-h-[44px] px-4 py-2.5 rounded-[18px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer shadow-2xs">
                      <Upload className="w-4 h-4" />
                      <span>
                        {isParsingTimetable
                          ? 'Đang đọc thời khóa biểu...'
                          : 'Tải thời khóa biểu (JPG/PNG/PDF)'}
                      </span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf,.txt"
                        onChange={handleTimetableFileUpload}
                        disabled={isParsingTimetable}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        commitDaySubjectsToDraft(daySubjectsRawText);
                        commitDaySuppliesToDraft(daySuppliesRawText);
                        setShowOverwriteConfirm(true);
                      }}
                      className="min-h-[44px] px-5 py-2.5 rounded-[18px] bg-emerald-600 hover:bg-emerald-700 text-white font-kids font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Lưu & Áp dụng Thời khóa biểu</span>
                    </button>
                  </div>
                </div>

                {timetableUploadError && (
                  <div className="rounded-[18px] bg-rose-50 border border-rose-200 p-3.5 text-xs font-bold text-rose-700 flex items-center justify-between gap-2">
                    <span>⚠️ {timetableUploadError}</span>
                    <button
                      type="button"
                      onClick={() => setTimetableUploadError(null)}
                      className="underline shrink-0 cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                )}

                {/* Section D.2: Preview & Edit Extracted Timetable Before Applying to Draft */}
                {timetableExtractedDays && (
                  <div className="rounded-[22px] bg-[#EAF3FF]/80 border-2 border-[#3978F6]/50 p-4 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-kids font-extrabold text-[#3978F6] uppercase">
                          Xem trước thời khóa biểu từ tệp "{timetableSourceFileName}"
                        </span>
                        <h3 className="font-kids text-base font-extrabold text-[#23324D]">
                          Kiểm tra và chỉnh sửa môn học từng ngày trước khi áp dụng
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleApplyTimetableToDraft}
                          className="min-h-[40px] px-4 py-2 rounded-[18px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Áp dụng vào bản nháp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTimetableExtractedDays(null)}
                          className="min-h-[40px] px-3.5 py-2 rounded-[18px] bg-white text-[#23324D] font-bold text-xs border border-[#23324D]/15 cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {timetableExtractedDays.map((item, idx) => (
                        <div
                          key={item.dayOfWeek}
                          className="rounded-xl bg-white p-3 border border-[#3978F6]/20 space-y-1.5"
                        >
                          <label className="block font-kids font-extrabold text-xs text-[#23324D]">
                            {item.dayLabel}
                          </label>
                          <input
                            type="text"
                            value={item.subjectsText}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTimetableExtractedDays((prev) =>
                                prev
                                  ? prev.map((d, i) =>
                                      i === idx ? { ...d, subjectsText: val } : d
                                    )
                                  : null
                              );
                            }}
                            placeholder="Các môn học cách nhau dấu phẩy..."
                            className="w-full min-h-[38px] px-3 rounded-lg bg-[#F7F9FD] border border-[#23324D]/15 text-xs font-bold"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showOverwriteConfirm && (
                  <div className="rounded-[20px] bg-[#FFF0C9] border-2 border-amber-400 p-4 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-kids font-extrabold text-sm sm:text-base text-[#23324D]">
                          Xác nhận cập nhật & ghi đè Thời khóa biểu hiện tại?
                        </h3>
                        <p className="text-xs text-[#23324D]/80 mt-0.5">
                          Thời khóa biểu mới ({scheduleDraft.cycleType === 'weekly' ? 'Lặp lại theo tuần' : 'Áp dụng theo tháng'} từ{' '}
                          <strong>{scheduleDraft.effectiveFrom}</strong> đến{' '}
                          <strong>{scheduleDraft.effectiveTo}</strong>, nhắc lúc{' '}
                          <strong>{scheduleDraft.prepReminderTime}</strong>) sẽ thay thế lịch cũ của bé.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleConfirmSaveSchedule}
                        className="min-h-[40px] px-4 py-2 rounded-[18px] bg-emerald-600 hover:bg-emerald-700 text-white font-kids font-bold text-xs cursor-pointer"
                      >
                        ✓ Đồng ý ghi đè & Lưu ngay
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowOverwriteConfirm(false)}
                        className="min-h-[40px] px-4 py-2 rounded-[18px] bg-white text-[#23324D] font-bold text-xs border border-[#23324D]/15 cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#23324D] mb-1">
                      Chế độ lịch học
                    </label>
                    <select
                      value={scheduleDraft.cycleType}
                      onChange={(e) =>
                        setScheduleDraft({
                          ...scheduleDraft,
                          cycleType: e.target.value as 'weekly' | 'monthly',
                        })
                      }
                      className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-xs font-bold"
                    >
                      <option value="weekly">Lặp lại hàng tuần</option>
                      <option value="monthly">Theo chu kỳ tháng</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#23324D] mb-1">
                      Ngày bắt đầu áp dụng
                    </label>
                    <input
                      type="date"
                      value={scheduleDraft.effectiveFrom}
                      onChange={(e) =>
                        setScheduleDraft({
                          ...scheduleDraft,
                          effectiveFrom: e.target.value,
                        })
                      }
                      className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-xs font-bold tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#23324D] mb-1">
                      Ngày kết thúc áp dụng
                    </label>
                    <input
                      type="date"
                      value={scheduleDraft.effectiveTo}
                      onChange={(e) =>
                        setScheduleDraft({
                          ...scheduleDraft,
                          effectiveTo: e.target.value,
                        })
                      }
                      className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-xs font-bold tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#23324D] mb-1">
                      Giờ nhắc chuẩn bị sách vở buổi tối
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={scheduleDraft.prepReminderTime}
                        onChange={(e) =>
                          setScheduleDraft({
                            ...scheduleDraft,
                            prepReminderTime: e.target.value,
                          })
                        }
                        className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 font-mono text-xs font-bold"
                      />
                      <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#23324D] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scheduleDraft.reminderEnabled}
                          onChange={(e) =>
                            setScheduleDraft({
                              ...scheduleDraft,
                              reminderEnabled: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-[#3978F6]"
                        />
                        <span>Bật nhắc</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Monday - Sunday Day Selector & Editor (Section D.3: Raw text input preserves spaces/commas) */}
                <div className="pt-3 border-t border-[#23324D]/10 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {scheduleDraft.weeklyDays.map((dayItem) => (
                      <button
                        key={dayItem.dayOfWeek}
                        type="button"
                        onClick={() => {
                          commitDaySubjectsToDraft(daySubjectsRawText);
                          commitDaySuppliesToDraft(daySuppliesRawText);
                          setSelectedDayOfWeek(dayItem.dayOfWeek);
                        }}
                        className={`min-h-[40px] px-3.5 py-1.5 rounded-[18px] font-kids font-extrabold text-xs transition-colors cursor-pointer ${
                          selectedDayOfWeek === dayItem.dayOfWeek
                            ? 'bg-[#3978F6] text-white shadow-2xs'
                            : 'bg-[#F7F9FD] text-[#23324D] hover:bg-[#EAF3FF] border border-[#23324D]/10'
                        }`}
                      >
                        {dayItem.dayLabel} ({dayItem.subjects.length} môn)
                      </button>
                    ))}
                  </div>

                  {activeDayDraft && (
                    <div className="rounded-[20px] bg-[#F7F9FD] border border-[#23324D]/10 p-4 space-y-3.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h3 className="font-kids text-base sm:text-lg font-extrabold text-[#23324D]">
                          Chỉnh sửa ngày: {activeDayDraft.dayLabel}
                        </h3>
                        <span className="text-xs text-[#3978F6] font-bold">
                          Ngăn cách các môn và đồ dùng bằng dấu phẩy (,)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-bold text-[#23324D] mb-1">
                            Các môn học trong ngày {activeDayDraft.dayLabel}
                          </label>
                          <input
                            type="text"
                            value={daySubjectsRawText}
                            onChange={(e) => setDaySubjectsRawText(e.target.value)}
                            onBlur={(e) => commitDaySubjectsToDraft(e.target.value)}
                            placeholder="VD: Toán, Tiếng Việt, Tiếng Anh, Mỹ thuật"
                            className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-[#23324D]/15 text-sm font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#23324D] mb-1">
                            Sách vở & đồ dùng cần chuẩn bị từ tối hôm trước
                          </label>
                          <input
                            type="text"
                            value={daySuppliesRawText}
                            onChange={(e) => setDaySuppliesRawText(e.target.value)}
                            onBlur={(e) => commitDaySuppliesToDraft(e.target.value)}
                            placeholder="VD: Sách Toán, Vở ô ly, Hộp bút màu, Bình nước"
                            className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-[#23324D]/15 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#23324D] mb-1">
                          Lời dặn dò thêm của Ba Mẹ cho ngày {activeDayDraft.dayLabel}
                        </label>
                        <input
                          type="text"
                          value={activeDayDraft.note || ''}
                          onChange={(e) => handleUpdateDayNote(e.target.value)}
                          placeholder="VD: Thứ Năm có tiết Thể dục, con nhớ chuẩn bị giày thể thao nhé!"
                          className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-[#23324D]/15 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Section D.4: "Ngày ngoại lệ / Sự kiện đặc biệt" and "Thói quen Sáng · Chiều · Tối & Giờ nhắc"
                  are hidden from UI while preserving underlying data & reminder logic. */}
            </div>
          )}

          {/* =====================================================================
              GROUP 3: NHIỆM VỤ (TASKS CRUD, DRAFT, PREVIEW, APPROVE, DELETE)
              ===================================================================== */}
          {parentGroup === 'tasks' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-5 space-y-4">
                <div className="rounded-[22px] bg-white border border-[#23324D]/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-kids text-base font-extrabold text-[#23324D]">
                      Danh sách nhiệm vụ ({data.tasks.length})
                    </h2>
                    <button
                      type="button"
                      onClick={handleStartNewBlankTask}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#3978F6] hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tạo mới</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {data.tasks.map((t) => (
                      <div
                        key={t.id}
                        className={`p-3 rounded-[16px] border transition-colors flex items-start justify-between gap-2 ${
                          taskDraft.id === t.id
                            ? 'bg-[#EAF3FF] border-[#3978F6]'
                            : 'bg-[#F7F9FD] border-transparent hover:border-[#23324D]/15'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectTaskToEdit(t)}
                          className="text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span
                              className={`font-bold ${
                                t.approvalStatus === 'approved'
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {t.approvalStatus === 'approved'
                                ? '✓ Đã phê duyệt'
                                : 'Bản nháp (Ẩn với con)'}
                            </span>
                            <span className="text-[#23324D]/60 tabular-nums">
                              · {t.steps.length} bước
                            </span>
                          </div>
                          <p className="font-kids font-extrabold text-sm text-[#23324D] mt-0.5 truncate">
                            {t.title}
                          </p>
                        </button>

                        {t.id !== 'task-backpack' && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteTarget({
                                kind: 'task',
                                id: t.id,
                                title: t.title,
                              })
                            }
                            className="w-7 h-7 rounded-lg bg-white hover:bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 cursor-pointer"
                            title="Xóa nhiệm vụ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[22px] bg-[#EDE7FF]/60 border border-indigo-200 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-800">
                    <Sparkles className="w-4 h-4" />
                    <span>AI Soạn nháp nhiệm vụ cho Ba Mẹ duyệt</span>
                  </div>
                  <p className="text-xs text-[#23324D]/75">
                    AI tạo bản nháp (chưa hiển thị cho con) để phụ huynh kiểm tra và phê duyệt.
                  </p>
                  <input
                    type="text"
                    value={aiDraftPrompt}
                    onChange={(e) => setAiDraftPrompt(e.target.value)}
                    placeholder="VD: Gấp chăn màn buổi sáng..."
                    className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-indigo-200 text-xs sm:text-sm"
                  />
                  <button
                    type="button"
                    disabled={!aiDraftPrompt.trim() || isAiDrafting}
                    onClick={handleGenerateAiTaskDraft}
                    className="w-full min-h-[42px] px-4 py-2 rounded-[14px] bg-[#3978F6] hover:bg-[#2964DF] disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                  >
                    {isAiDrafting ? 'Đang soạn nháp...' : 'AI Soạn bản nháp nhiệm vụ'}
                  </button>
                </div>
              </div>

              <div className="md:col-span-7 rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#23324D]/10 pb-4">
                  <div>
                    <span className="text-xs font-bold text-[#3978F6]">
                      Trạng thái:{' '}
                      {taskDraft.approvalStatus === 'approved'
                        ? 'Đã phê duyệt hiển thị cho con'
                        : 'Bản nháp (Chưa hiển thị cho con)'}
                    </span>
                    <h2 className="font-kids text-xl font-extrabold text-[#23324D]">
                      {taskDraft.title}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewItem({ type: 'task', task: taskDraft })}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#EAF3FF] hover:bg-[#d8e8ff] text-[#3978F6] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem trước</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveTaskWithStatus('draft')}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#FFF0C9] hover:bg-[#ffe5a3] text-amber-900 font-bold text-xs cursor-pointer"
                    >
                      Lưu nháp
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveTaskWithStatus('approved')}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-kids font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Phê duyệt cho con</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#23324D] mb-1">
                      Tên nhiệm vụ hiển thị cho bé
                    </label>
                    <input
                      type="text"
                      value={taskDraft.title}
                      onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })}
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#23324D] mb-1">
                      Mô tả ngắn
                    </label>
                    <input
                      type="text"
                      value={taskDraft.subtitle}
                      onChange={(e) => setTaskDraft({ ...taskDraft, subtitle: e.target.value })}
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-kids font-extrabold text-base text-[#23324D]">
                      Các bước hướng dẫn ({taskDraft.steps.length} bước)
                    </h3>
                    {taskDraft.steps.length < 6 && (
                      <button
                        type="button"
                        onClick={handleAddStepToDraft}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#3978F6] hover:underline cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm bước</span>
                      </button>
                    )}
                  </div>

                  {taskDraft.steps.map((step, index) => (
                    <div
                      key={step.id}
                      className="rounded-[18px] bg-[#F7F9FD] border border-[#23324D]/10 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-[#3978F6]">
                        <span>Bước {index + 1}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#23324D]/70 mb-1">
                            Hành động chính (Tiêu đề bước)
                          </label>
                          <input
                            type="text"
                            value={step.actionTitle}
                            onChange={(e) =>
                              handleStepChange(index, 'actionTitle', e.target.value)
                            }
                            className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-[#23324D]/15 text-sm font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#23324D]/70 mb-1">
                            Lời giải thích khi bé bấm "Con chưa hiểu"
                          </label>
                          <input
                            type="text"
                            value={step.simpleExplanation}
                            onChange={(e) =>
                              handleStepChange(index, 'simpleExplanation', e.target.value)
                            }
                            className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-[#23324D]/15 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#23324D]/70 mb-1">
                          Hướng dẫn ngắn gọn cho bé
                        </label>
                        <input
                          type="text"
                          value={step.instruction}
                          onChange={(e) =>
                            handleStepChange(index, 'instruction', e.target.value)
                          }
                          className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-[#23324D]/15 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              GROUP 4: HÀNH TRÌNH PHẨM CHẤT & MASTER CURRICULUM UPLOAD (Sec. 7.2, A08–A10)
              ===================================================================== */}
          {parentGroup === 'journey' && (
            <div className="space-y-5">
              {/* ParentCurriculumUpload Banner (.txt, .docx, .pdf, .json) */}
              <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-[#3978F6]">
                      Tải tệp tổng hợp Lộ trình Phẩm chất (.txt, .docx, .pdf có chữ, .json)
                    </span>
                    <h2 className="font-kids text-lg sm:text-xl font-extrabold text-[#23324D]">
                      Nhập nhanh nhiều chặng phẩm chất từ tệp của Ba Mẹ
                    </h2>
                    <p className="text-xs text-[#5C6F8C] mt-0.5">
                      Hệ thống tự động tách tệp thành các chặng nháp (Khám phá · Hiểu · Thực hành · Chia sẻ) để Ba Mẹ chỉnh sửa, sắp xếp thứ tự và phê duyệt trước khi hiển thị trên bản đồ của con.
                    </p>
                  </div>

                  <label className="min-h-[44px] px-4 py-2.5 rounded-[16px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-xs inline-flex items-center gap-2 cursor-pointer shrink-0">
                    <Upload className="w-4 h-4" />
                    <span>
                      {isParsingCurriculumFile
                        ? 'Đang phân tích tệp...'
                        : 'Tải tệp lộ trình (.txt/.docx/.pdf/.json)'}
                    </span>
                    <input
                      type="file"
                      accept=".txt,.docx,.pdf,.json"
                      onChange={handleCurriculumMasterFileUpload}
                      disabled={isParsingCurriculumFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {curriculumUploadError && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-bold text-rose-700 flex items-center justify-between gap-2">
                    <span>⚠️ {curriculumUploadError}</span>
                    <button
                      type="button"
                      onClick={() => setCurriculumUploadError(null)}
                      className="underline shrink-0 cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                )}

                {uploadedCurriculumBatch && uploadedCurriculumBatch.length > 0 && (
                  <div className="rounded-[20px] bg-[#EAF3FF]/70 border-2 border-[#3978F6]/40 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-kids font-extrabold text-[#3978F6] uppercase">
                          Bản nháp từ tệp "{uploadedCurriculumSource}" ({uploadedCurriculumBatch.length} chặng)
                        </span>
                        <h3 className="font-kids text-base font-extrabold text-[#23324D]">
                          Kiểm tra và xuất bản các chặng vừa trích xuất
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePublishUploadedCurriculum(false)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#FFF0C9] text-amber-900 font-bold text-xs cursor-pointer"
                        >
                          Lưu tất cả làm Bản nháp
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePublishUploadedCurriculum(true)}
                          className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-kids font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Phê duyệt & Xuất bản lên Bản đồ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadedCurriculumBatch(null)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white text-[#23324D] font-bold text-xs border border-[#23324D]/15 cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {uploadedCurriculumBatch.map((draftItem, dIdx) => (
                        <button
                          key={draftItem.id}
                          type="button"
                          onClick={() => {
                            setTopicDraft(JSON.parse(JSON.stringify(draftItem)));
                          }}
                          className="text-left p-3 rounded-xl bg-white border border-[#3978F6]/25 hover:border-[#3978F6] cursor-pointer"
                        >
                          <span className="text-[10px] font-bold text-[#3978F6]">
                            Chặng nháp {dIdx + 1} · 4 bước
                          </span>
                          <p className="font-kids font-extrabold text-sm text-[#23324D] truncate">
                            {draftItem.title}
                          </p>
                          <p className="text-[11px] text-[#5C6F8C] truncate">
                            {draftItem.subtitle}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                {/* 1. Danh sách các chặng trên Bản đồ (Clean 1-col mobile / 2-col tablet grid) */}
                <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-4 sm:p-5 space-y-3.5 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-kids text-base sm:text-lg font-extrabold text-[#23324D]">
                        Các chặng phẩm chất trên Bản đồ ({data.growthTopics?.length || 0})
                      </h2>
                      <p className="text-xs text-[#5C6F8C]">
                        Chạm vào từng chặng để chỉnh sửa 4 bước, đổi thứ tự hoặc bật/tắt hiển thị trên bản đồ của con.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...(data.growthTopics || [])]
                      .sort((a, b) => a.stageOrder - b.stageOrder)
                      .map((topic, idx, arr) => {
                        const isSelected = topicDraft?.id === topic.id;
                        const isApproved =
                          topic.approvalStatus === 'approved' && topic.selectedByParent;
                        return (
                          <div
                            key={topic.id}
                            className={`p-3.5 rounded-[20px] border-2 transition-all flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-[#EAF3FF] border-[#3978F6] shadow-2xs'
                                : 'bg-[#F7F9FD] border-[#23324D]/8 hover:border-[#3978F6]/40'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectJourneyTopicToEdit(topic)}
                              className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                            >
                              <GrowthTopicIllustration
                                slug={topic.slug}
                                className="w-12 h-12 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-kids font-extrabold ${
                                      isApproved
                                        ? 'bg-[#DDF5E8] text-[#188050]'
                                        : 'bg-[#FFF0C9] text-amber-800'
                                    }`}
                                  >
                                    {isApproved ? '✓ Đang mở' : 'Bản nháp / Ẩn'}
                                  </span>
                                  {topic.isCurrentFocus && (
                                    <span className="px-2 py-0.5 rounded-full bg-[#3978F6] text-white font-kids font-extrabold text-[10px]">
                                      Chủ đề tuần
                                    </span>
                                  )}
                                </div>
                                <p className="font-kids font-extrabold text-sm sm:text-base text-[#23324D] leading-snug mt-1 whitespace-normal break-words">
                                  Chặng {topic.stageOrder}: {topic.title}
                                </p>
                                <p className="text-[11px] text-[#5C6F8C] truncate">
                                  {topic.landmarkName} · {topic.experiences.length} hoạt động
                                </p>
                              </div>
                            </button>

                            {/* Reorder Stage Up/Down Buttons */}
                            <div className="flex flex-col gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveStageOrder(topic.id, 'up')}
                                className="w-8 h-8 rounded-[12px] bg-white hover:bg-[#EAF3FF] disabled:opacity-30 flex items-center justify-center text-[#23324D] border border-[#23324D]/10 cursor-pointer"
                                title="Chuyển chặng lên trước"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === arr.length - 1}
                                onClick={() => handleMoveStageOrder(topic.id, 'down')}
                                className="w-8 h-8 rounded-[12px] bg-white hover:bg-[#EAF3FF] disabled:opacity-30 flex items-center justify-center text-[#23324D] border border-[#23324D]/10 cursor-pointer"
                                title="Chuyển chặng xuống sau"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* 2. Trình chỉnh sửa chi tiết Chặng phẩm chất đang chọn */}
                {topicDraft && (
                  <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-4 sm:p-5 space-y-5 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#23324D]/10 pb-4">
                      <div>
                        <span className="text-xs font-bold text-[#3978F6]">
                          Đang chỉnh sửa Trạm {topicDraft.stageOrder} · {topicDraft.landmarkName}{' '}
                          {topicDraft.version ? `(v${topicDraft.version})` : ''}
                        </span>
                        <h2 className="font-kids text-xl font-extrabold text-[#23324D]">
                          {topicDraft.title}
                        </h2>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewItem({ type: 'journey', topic: topicDraft })}
                          className="min-h-[40px] px-3.5 py-2 rounded-[18px] bg-[#EAF3FF] hover:bg-[#d8e8ff] text-[#3978F6] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem trước Popup</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveJourneyTopic('draft')}
                          className="min-h-[40px] px-3.5 py-2 rounded-[18px] bg-[#FFF0C9] hover:bg-[#ffe5a3] text-amber-900 font-bold text-xs cursor-pointer"
                        >
                          Lưu nháp
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveJourneyTopic('approved')}
                          className="min-h-[40px] px-4 py-2 rounded-[18px] bg-emerald-600 hover:bg-emerald-700 text-white font-kids font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Phê duyệt cho con</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="flex items-center gap-2 text-xs font-bold text-[#23324D] bg-[#F7F9FD] p-3 rounded-xl border border-[#23324D]/10 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={topicDraft.selectedByParent}
                          onChange={(e) =>
                            setTopicDraft({ ...topicDraft, selectedByParent: e.target.checked })
                          }
                          className="w-4 h-4 accent-[#3978F6]"
                        />
                        <span>Hiển thị chủ đề này trên Bản đồ Hành trình của con</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-bold text-[#23324D] bg-[#FFF0C9]/50 p-3 rounded-xl border border-amber-300/60 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(topicDraft.isCurrentFocus)}
                          onChange={(e) =>
                            setTopicDraft({ ...topicDraft, isCurrentFocus: e.target.checked })
                          }
                          className="w-4 h-4 accent-[#3978F6]"
                        />
                        <span>Đặt làm Chủ đề gợi ý nổi bật trong tuần này</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#23324D] mb-1">
                          Tên phẩm chất
                        </label>
                        <input
                          type="text"
                          value={topicDraft.title}
                          onChange={(e) =>
                            setTopicDraft({ ...topicDraft, title: e.target.value })
                          }
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#23324D] mb-1">
                          Thông điệp ngắn gọn
                        </label>
                        <input
                          type="text"
                          value={topicDraft.subtitle}
                          onChange={(e) =>
                            setTopicDraft({ ...topicDraft, subtitle: e.target.value })
                          }
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-kids font-extrabold text-sm sm:text-base text-[#23324D]">
                        4 Bước trải nghiệm trong Popup (Khám phá · Hiểu · Thực hành · Chia sẻ)
                      </h3>
                      {topicDraft.experiences.map((exp, idx) => (
                        <div
                          key={exp.id}
                          className="rounded-2xl bg-[#F7F9FD] border border-[#23324D]/10 p-3.5 space-y-2.5"
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-[#3978F6]">
                            <span>
                              Bước {idx + 1}: {exp.typeLabel}
                            </span>
                            <span className="text-[#5C6F8C]">
                              Trạng thái hiện tại: {exp.status}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={exp.title}
                            onChange={(e) =>
                              handleJourneyExpChange(idx, 'title', e.target.value)
                            }
                            placeholder="Tiêu đề hoạt động..."
                            className="w-full min-h-[38px] px-3 rounded-xl bg-white border border-[#23324D]/15 text-xs sm:text-sm font-bold"
                          />
                          <textarea
                            rows={2}
                            value={exp.promptOrStory}
                            onChange={(e) =>
                              handleJourneyExpChange(idx, 'promptOrStory', e.target.value)
                            }
                            placeholder="Câu chuyện tình huống hoặc câu hỏi gợi mở..."
                            className="w-full p-2.5 rounded-xl bg-white border border-[#23324D]/15 text-xs leading-relaxed"
                          />
                          {(exp.type === 'understand' || exp.type === 'share' || exp.choices) && (
                            <div>
                              <label className="block text-[11px] font-semibold text-[#5C6F8C] mb-1">
                                Các lựa chọn trả lời trắc nghiệm / checkbox (mỗi lựa chọn 1 dòng):
                              </label>
                              <textarea
                                rows={3}
                                value={(exp.choices || []).join('\n')}
                                onChange={(e) =>
                                  handleJourneyExpChoicesChange(idx, e.target.value)
                                }
                                className="w-full p-2.5 rounded-xl bg-white border border-[#23324D]/15 text-xs"
                              />
                            </div>
                          )}
                          {exp.type === 'practice' && (
                            <div>
                              <label className="block text-[11px] font-semibold text-[#5C6F8C] mb-1">
                                Gợi ý hành động thực tế ngoài đời thực:
                              </label>
                              <input
                                type="text"
                                value={exp.actionSuggestion || ''}
                                onChange={(e) =>
                                  handleJourneyExpChange(idx, 'actionSuggestion', e.target.value)
                                }
                                className="w-full min-h-[36px] px-3 rounded-xl bg-white border border-[#23324D]/15 text-xs"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              GROUP 5: THƯ VIỆN PODCAST AI CỦA PHỤ HUYNH (6-STEP DOCX/PDF -> ~3-MIN EPISODES)
              ===================================================================== */}
          {parentGroup === 'stories' && (
            <div className="space-y-5">
              {/* STEP 1, 2, 3: Upload DOCX / PDF / TXT or Paste Long Text -> AI Multi-Episode Segmentation (~3 min/episode) */}
              <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-4 shadow-2xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-kids text-lg sm:text-xl font-extrabold text-[#23324D]">
                      Tải tài liệu truyện (.docx, .pdf, .txt) để tạo tập Podcast cho con
                    </h2>
                  </div>

                  <label className="min-h-[44px] px-4 py-2.5 rounded-[18px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-xs inline-flex items-center gap-2 cursor-pointer shrink-0 shadow-2xs">
                    <Upload className="w-4 h-4" />
                    <span>
                      {isParsingFile
                        ? 'AI đang trích xuất & chia tập...'
                        : 'Tải tệp .DOCX / .PDF / .TXT'}
                    </span>
                    <input
                      type="file"
                      accept=".txt,.docx,.pdf"
                      onChange={handleFileUploadChange}
                      disabled={isParsingFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Optional Direct Long Text Paste for AI Multi-Episode Segmentation */}
                <div className="rounded-[18px] bg-[#F7F9FD] border border-[#23324D]/10 p-3.5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#23324D]">
                      Hoặc dán văn bản truyện dài để AI tự động chia thành các tập Podcast ~3 phút:
                    </span>
                    <button
                      type="button"
                      disabled={isParsingFile || !rawDocumentTextInput.trim()}
                      onClick={handleAnalyzeRawTextToEpisodes}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-[18px] bg-[#23324D] hover:bg-[#344973] disabled:opacity-40 text-[#FFF0C9] font-kids font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Phân tích & Chia tập Podcast (~3 phút/tập)</span>
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={rawDocumentTextInput}
                    onChange={(e) => setRawDocumentTextInput(e.target.value)}
                    placeholder="Dán nội dung truyện cổ tích hoặc truyện gia đình dài vào đây để AI biên tập và chia thành các tập ~3 phút..."
                    className="w-full p-2.5 rounded-xl bg-white border border-[#23324D]/12 text-xs leading-relaxed"
                  />
                </div>

                {uploadError && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-bold text-rose-700 flex items-center justify-between gap-2">
                    <span>⚠️ {uploadError}</span>
                    <button
                      type="button"
                      onClick={() => setUploadError(null)}
                      className="underline shrink-0 cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                )}

                {/* STEP 4: Parent Review Panel for AI Multi-Episode Drafts */}
                {aiEpisodeBatchDrafts && aiEpisodeBatchDrafts.length > 0 && (
                  <div className="rounded-[22px] bg-gradient-to-r from-[#EAF3FF] via-[#F4F1FF] to-[#FFF0C9]/60 border-2 border-[#3978F6]/50 p-4 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-kids font-extrabold text-[#3978F6] uppercase">
                          Bước 4 · Ba Mẹ duyệt bản nháp từ "{analyzedDocSummary?.fileName}" (
                          {aiEpisodeBatchDrafts.length} tập ·{' '}
                          {analyzedDocSummary?.originalLengthChars || 0} ký tự gốc)
                        </span>
                        <h3 className="font-kids text-base sm:text-lg font-extrabold text-[#23324D]">
                          Kiểm tra, chỉnh sửa từng tập trước khi thêm vào Thư viện Podcast của con
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApproveEpisodeBatch(false, false)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-[18px] bg-[#FFF0C9] hover:bg-[#ffe5a3] text-amber-950 font-kids font-extrabold text-xs cursor-pointer"
                        >
                          Lưu tất cả làm Bản nháp
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveEpisodeBatch(true, true)}
                          className="min-h-[38px] px-4 py-1.5 rounded-[18px] bg-emerald-600 hover:bg-emerald-700 text-white font-kids font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Duyệt tất cả & Tạo âm thanh Podcast</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAiEpisodeBatchDrafts(null);
                            setAnalyzedDocSummary(null);
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-[18px] bg-white text-[#23324D] font-bold text-xs border border-[#23324D]/15 cursor-pointer"
                        >
                          Hủy bỏ
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {aiEpisodeBatchDrafts.map((ep, idx) => {
                        const isSelected = editingStoryDraft.id === ep.id;
                        return (
                          <div
                            key={ep.id}
                            className={`text-left p-3.5 rounded-[18px] border-2 transition-all flex flex-col justify-between gap-2.5 ${
                              isSelected
                                ? 'bg-white border-[#3978F6] shadow-2xs'
                                : 'bg-white/90 border-transparent hover:border-[#3978F6]/40'
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-1.5 flex-wrap text-[10px] font-kids font-extrabold">
                                <span className="px-2 py-0.5 rounded-md bg-[#EAF3FF] text-[#3978F6]">
                                  Tập {idx + 1}/{aiEpisodeBatchDrafts.length} · ~
                                  {formatPodcastTime(ep.actualDurationSeconds || 180)}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-[#FFF0C9] text-amber-900">
                                  {ep.ageRecommendation}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md ${
                                    ep.approvedByParent
                                      ? 'bg-[#DDF5E8] text-[#188050]'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {ep.approvedByParent ? '✓ Đã duyệt' : 'Bản nháp'}
                                </span>
                              </div>

                              <p className="font-kids font-extrabold text-sm text-[#23324D] leading-snug">
                                {ep.title}
                              </p>

                              <div className="flex items-center gap-2 text-[10px] font-bold text-[#5C6F8C] flex-wrap">
                                <span>Chủ đề: {ep.category}</span>
                                <span>·</span>
                                <span>Nguồn: {ep.sourceFileName || analyzedDocSummary?.fileName}</span>
                              </div>

                              <p className="text-[11px] text-[#23324D]/80 line-clamp-2 leading-relaxed">
                                {ep.paragraphs[0] || ep.summary}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-[#23324D]/8 flex items-center justify-between gap-1.5 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSelectExistingStoryToEdit(ep)}
                                  className="min-h-[32px] px-2.5 py-1 rounded-[14px] bg-[#EAF3FF] hover:bg-[#3978F6] text-[#3978F6] hover:text-white font-kids font-extrabold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Chỉnh sửa</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleParentPreviewEpisodeAudio(ep)}
                                  className="min-h-[32px] px-2.5 py-1 rounded-[14px] bg-[#23324D] hover:bg-[#344973] text-[#FFF0C9] font-kids font-extrabold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  {parentAudioSnap.storyId === ep.id &&
                                  (parentAudioSnap.status === 'playing' ||
                                    parentAudioSnap.status === 'loading' ||
                                    parentAudioSnap.status === 'generating') ? (
                                    <>
                                      <Pause className="w-3 h-3" />
                                      <span>Tạm dừng</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3 h-3" />
                                      <span>Nghe thử</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const approvedEp: Story = {
                                      ...ep,
                                      approvedByParent: true,
                                      approvalStatus: 'approved',
                                      hiddenByParent: false,
                                    };
                                    await saveParentStory(approvedEp);
                                    setAiEpisodeBatchDrafts((prev) =>
                                      prev
                                        ? prev.map((item) =>
                                            item.id === ep.id ? approvedEp : item
                                          )
                                        : null
                                    );
                                    showNotice(
                                      `Đã duyệt "${ep.title}" và đang tạo âm thanh Podcast liên tục...`
                                    );
                                    await handleTriggerEpisodeAudioGeneration(ep.id, false);
                                  }}
                                  className="min-h-[32px] px-2.5 py-1 rounded-[14px] bg-emerald-600 hover:bg-emerald-700 text-white font-kids font-extrabold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Duyệt</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const remaining = aiEpisodeBatchDrafts.filter(
                                      (item) => item.id !== ep.id
                                    );
                                    setAiEpisodeBatchDrafts(
                                      remaining.length > 0 ? remaining : null
                                    );
                                    showNotice(`Đã loại bỏ bản nháp "${ep.title}".`);
                                  }}
                                  className="min-h-[32px] px-2.5 py-1 rounded-[14px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-kids font-extrabold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Loại bỏ</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Parent Podcast Preview Player Banner */}
              {parentAudioSnap.storyId && parentAudioSnap.status !== 'idle' && (
                <div className="rounded-[22px] bg-[#23324D] text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        const matched =
                          data.stories.find((s) => s.id === parentAudioSnap.storyId) ||
                          aiEpisodeBatchDrafts?.find((s) => s.id === parentAudioSnap.storyId);
                        if (matched) handleParentPreviewEpisodeAudio(matched);
                      }}
                      className="w-10 h-10 rounded-full bg-[#3978F6] hover:bg-[#2968e6] text-white flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      {parentAudioSnap.status === 'playing' ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[#FFF0C9]">
                        Nghe thử Podcast trong cổng Phụ huynh ·{' '}
                        {parentAudioSnap.status === 'generating' ||
                        parentAudioSnap.status === 'loading'
                          ? 'Đang tạo giọng đọc tiếng Việt...'
                          : parentAudioSnap.status === 'error'
                          ? 'Lỗi phát âm thanh'
                          : parentAudioSnap.status === 'playing'
                          ? 'Đang phát'
                          : 'Đang tạm dừng'}
                      </p>
                      <p className="font-kids font-extrabold text-sm truncate">
                        {data.stories.find((s) => s.id === parentAudioSnap.storyId)?.title ||
                          aiEpisodeBatchDrafts?.find((s) => s.id === parentAudioSnap.storyId)
                            ?.title ||
                          'Tập Podcast'}
                      </p>
                      {parentAudioSnap.errorMessage && (
                        <p className="text-xs text-rose-300 mt-0.5">
                          ⚠️ {parentAudioSnap.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono text-xs font-bold text-white/85 tabular-nums">
                      {formatPodcastTime(parentAudioSnap.currentTimeSec)} /{' '}
                      {formatPodcastTime(parentAudioSnap.durationSec || 180)}
                    </span>
                    <button
                      type="button"
                      onClick={() => podcastPlaybackController.stopAndCleanup()}
                      className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer"
                    >
                      Dừng nghe
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* Left Column: Schedule Tonight's Story + Step 5 & 6 Podcast Library Management */}
                <div className="md:col-span-5 space-y-4">
                  <div className="rounded-[22px] bg-white border border-[#23324D]/10 p-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h2 className="font-kids text-base font-extrabold text-[#23324D]">
                        Lịch phát Podcast trước giờ ngủ
                      </h2>
                      <span className="text-xs font-bold text-indigo-700">
                        Giờ kể chuyện
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#23324D] mb-1">
                          Giờ đọc truyện mỗi tối
                        </label>
                        <input
                          type="time"
                          value={data.bedtimeStoryConfig?.bedtimeReminderTime || '20:30'}
                          onChange={(e) => {
                            updateBedtimeStoryConfig({
                              bedtimeReminderTime: e.target.value,
                            });
                            showNotice(`Đã đặt giờ đọc truyện buổi tối lúc ${e.target.value}`);
                          }}
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 font-mono text-xs font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#23324D] mb-1">
                          Tập Podcast chọn cho tối nay
                        </label>
                        <select
                          value={data.bedtimeStoryConfig?.tonightStoryId || ''}
                          onChange={(e) => {
                            updateBedtimeStoryConfig({
                              tonightStoryId: e.target.value,
                            });
                            showNotice('Đã cập nhật tập Podcast nổi bật cho tối nay!');
                          }}
                          className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-xs font-bold"
                        >
                          {data.stories
                            .filter((s) => s.approvedByParent && !s.hiddenByParent)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#23324D]/8 space-y-2">
                      <label className="block text-xs font-bold text-[#23324D]">
                        Đặt lịch tập Podcast theo ngày cụ thể:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={scheduleStoryDateKey}
                          onChange={(e) => setScheduleStoryDateKey(e.target.value)}
                          className="min-h-[38px] px-2.5 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-xs font-bold tabular-nums"
                        />
                        <select
                          value={scheduleStoryTargetId}
                          onChange={(e) => setScheduleStoryTargetId(e.target.value)}
                          className="flex-1 min-h-[38px] px-2.5 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-xs font-bold truncate"
                        >
                          {data.stories
                            .filter((s) => s.approvedByParent && !s.hiddenByParent)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            updateBedtimeStoryConfig({
                              scheduledByDate: {
                                [scheduleStoryDateKey]: scheduleStoryTargetId,
                              },
                            });
                            showNotice(`Đã hẹn lịch đọc truyện cho ngày ${scheduleStoryDateKey}!`);
                          }}
                          className="min-h-[38px] px-3 rounded-[18px] bg-[#3978F6] text-white text-xs font-bold cursor-pointer shrink-0"
                        >
                          Đặt lịch
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center justify-between text-xs font-bold text-[#23324D] pt-2 border-t border-[#23324D]/8 cursor-pointer">
                      <span>Cho phép Buddy hỏi 1 câu nhẹ nhàng sau khi nghe xong:</span>
                      <input
                        type="checkbox"
                        checked={data.bedtimeStoryConfig?.enablePostStoryQuestion !== false}
                        onChange={(e) =>
                          updateBedtimeStoryConfig({
                            enablePostStoryQuestion: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#3978F6]"
                      />
                    </label>
                  </div>

                  {/* Step 5 & 6: Podcast Library Management (Reorder, Audio Generation, Visibility, Delete) */}
                  <div className="rounded-[22px] bg-white border border-[#23324D]/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-kids text-base font-extrabold text-[#23324D]">
                          Thư viện Podcast Gia đình ({data.stories.length} tập)
                        </h2>
                        <p className="text-[11px] text-[#5C6F8C]">
                          Sắp xếp thứ tự tập, tạo âm thanh, nghe thử, phê duyệt hoặc xóa.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleStartNewStoryDraft}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#3978F6] hover:underline cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Soạn tập mới</span>
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                      {[...data.stories]
                        .sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999))
                        .map((st, idx, arr) => {
                          const isGeneratingThis =
                            synthesizingStoryId === st.id || st.audioStatus === 'generating';
                          const isPlayingThis =
                            parentAudioSnap.storyId === st.id &&
                            (parentAudioSnap.status === 'playing' ||
                              parentAudioSnap.status === 'loading' ||
                              parentAudioSnap.status === 'generating');
                          return (
                            <div
                              key={st.id}
                              className={`rounded-2xl p-3 border transition-colors space-y-2 ${
                                editingStoryDraft.id === st.id
                                  ? 'bg-[#EAF3FF] border-[#3978F6]'
                                  : 'bg-[#F7F9FD] border-[#23324D]/8'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSelectExistingStoryToEdit(st)}
                                  className="text-left flex-1 min-w-0 cursor-pointer"
                                >
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold flex-wrap">
                                    <span
                                      className={
                                        st.approvedByParent && !st.hiddenByParent
                                          ? 'text-emerald-700'
                                          : 'text-amber-700'
                                      }
                                    >
                                      {st.hiddenByParent
                                        ? 'Bản nháp / Đã ẩn'
                                        : st.approvedByParent
                                        ? '✓ Đã phê duyệt'
                                        : 'Chờ duyệt'}
                                    </span>
                                    {st.sourceDocumentInfo?.episodeNumber && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px]">
                                        Tập {st.sourceDocumentInfo.episodeNumber}/
                                        {st.sourceDocumentInfo.totalEpisodesInDoc || 1}
                                      </span>
                                    )}
                                    {st.isParentUploaded && (
                                      <span className="text-rose-600">· Ba mẹ tải lên</span>
                                    )}
                                  </div>
                                  <p className="font-kids font-extrabold text-sm text-[#23324D] truncate mt-0.5">
                                    {st.title}
                                  </p>
                                  <p className="text-[11px] text-[#5C6F8C] tabular-nums">
                                    {st.actualDurationSeconds
                                      ? `Thời lượng ${formatPodcastTime(st.actualDurationSeconds)}`
                                      : `Ước tính ~${st.durationMinutes || 3} phút`}{' '}
                                    · {st.paragraphs.length} cảnh
                                  </p>
                                </button>

                                {/* Reorder + Hide + Delete Controls */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => reorderStoriesByParent(st.id, 'up')}
                                    className="w-7 h-7 rounded-lg bg-white hover:bg-[#EAF3FF] disabled:opacity-30 flex items-center justify-center text-[#23324D] cursor-pointer"
                                    title="Đưa tập lên trên"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === arr.length - 1}
                                    onClick={() => reorderStoriesByParent(st.id, 'down')}
                                    className="w-7 h-7 rounded-lg bg-white hover:bg-[#EAF3FF] disabled:opacity-30 flex items-center justify-center text-[#23324D] cursor-pointer"
                                    title="Đưa tập xuống dưới"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleStoryVisibility(st.id, !st.hiddenByParent)}
                                    className="w-7 h-7 rounded-lg bg-white hover:bg-[#EAF3FF] flex items-center justify-center text-[#23324D]/70 cursor-pointer"
                                    title={st.hiddenByParent ? 'Hiện lại tập này' : 'Ẩn tập này'}
                                  >
                                    {st.hiddenByParent ? (
                                      <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5 text-[#3978F6]" />
                                    )}
                                  </button>

                                  {st.isParentUploaded && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmDeleteTarget({
                                          kind: 'story',
                                          id: st.id,
                                          title: st.title,
                                        })
                                      }
                                      className="w-7 h-7 rounded-lg bg-white hover:bg-rose-50 flex items-center justify-center text-rose-600 cursor-pointer"
                                      title="Xóa tập truyện tải lên"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Audio Synthesis Status & Quick Actions Row */}
                              <div className="pt-1.5 border-t border-[#23324D]/8 flex items-center justify-between gap-2 flex-wrap">
                                <span
                                  className={`text-[10px] font-kids font-extrabold px-2 py-0.5 rounded-md ${
                                    st.audioStatus === 'ready'
                                      ? 'bg-[#DDF5E8] text-[#188050]'
                                      : isGeneratingThis
                                      ? 'bg-[#FFF0C9] text-amber-900'
                                      : st.audioStatus === 'failed'
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-white text-[#5C6F8C]'
                                  }`}
                                >
                                  {st.audioStatus === 'ready'
                                    ? `✓ Âm thanh sẵn sàng (${formatPodcastTime(
                                        st.actualDurationSeconds || 180
                                      )})`
                                    : isGeneratingThis
                                    ? '⏳ Đang tạo âm thanh...'
                                    : st.audioStatus === 'failed'
                                    ? '⚠️ Lỗi tạo âm thanh'
                                    : 'Chưa tạo sẵn âm thanh'}
                                </span>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleParentPreviewEpisodeAudio(st)}
                                    className="px-2.5 py-1 rounded-lg bg-[#3978F6] hover:bg-[#2968e6] text-white text-[10px] font-kids font-extrabold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    {isPlayingThis ? (
                                      <>
                                        <Pause className="w-3 h-3" />
                                        <span>Tạm dừng</span>
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-3 h-3" />
                                        <span>Nghe thử</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isGeneratingThis}
                                    onClick={() =>
                                      handleTriggerEpisodeAudioGeneration(
                                        st.id,
                                        st.audioStatus === 'ready'
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-[#23324D] hover:bg-[#344973] disabled:opacity-40 text-[#FFF0C9] text-[10px] font-kids font-extrabold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <RefreshCw
                                      className={`w-3 h-3 ${isGeneratingThis ? 'animate-spin' : ''}`}
                                    />
                                    <span>
                                      {st.audioStatus === 'ready' ? 'Tạo lại Audio' : 'Tạo Audio'}
                                    </span>
                                  </button>

                                  {st.approvedByParent && !st.hiddenByParent && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateBedtimeStoryConfig({ tonightStoryId: st.id });
                                        showNotice(`Đã chọn "${st.title}" làm truyện tối nay!`);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EDE7FF] text-indigo-700 text-[10px] font-kids font-extrabold border border-indigo-200 cursor-pointer"
                                    >
                                      Chọn tối nay
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Episode Detail Editor & Approval */}
                <div className="md:col-span-7 rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#23324D]/10 pb-4">
                    <div>
                      <span className="text-xs font-bold text-[#3978F6]">
                        Biên tập chi tiết tập Podcast ({editingStoryDraft.ageRecommendation || '6–12 tuổi'} · v{editingStoryDraft.contentVersion || 1})
                      </span>
                      <h2 className="font-kids text-xl font-extrabold text-[#23324D]">
                        {editingStoryDraft.title || 'Tập truyện mới'}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleParentPreviewEpisodeAudio({
                            ...editingStoryDraft,
                            paragraphs: paragraphsTextInput
                              .split(/\n{2,}/)
                              .map((p) => p.trim())
                              .filter(Boolean),
                          })
                        }
                        className="min-h-[40px] px-3.5 py-2 rounded-[18px] bg-[#23324D] hover:bg-[#344973] text-[#FFF0C9] font-kids font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        {parentAudioSnap.storyId === editingStoryDraft.id &&
                        (parentAudioSnap.status === 'playing' ||
                          parentAudioSnap.status === 'loading' ||
                          parentAudioSnap.status === 'generating') ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Tạm dừng</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Nghe thử</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setPreviewItem({
                            type: 'story',
                            story: {
                              ...editingStoryDraft,
                              paragraphs: paragraphsTextInput
                                .split(/\n{2,}/)
                                .map((p) => p.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        className="min-h-[40px] px-3.5 py-2 rounded-[18px] bg-[#EAF3FF] hover:bg-[#d8e8ff] text-[#3978F6] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem trước</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveStoryWithStatus(false)}
                        className="min-h-[40px] px-3.5 py-2 rounded-[18px] bg-[#FFF0C9] hover:bg-[#ffe5a3] text-amber-900 font-bold text-xs cursor-pointer"
                      >
                        Lưu nháp
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveStoryWithStatus(true)}
                        className="min-h-[40px] px-4 py-2 rounded-[18px] bg-emerald-600 hover:bg-emerald-700 text-white font-kids font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Phê duyệt cho con</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-[#23324D] mb-1">
                        Tên tập Podcast
                      </label>
                      <input
                        type="text"
                        value={editingStoryDraft.title}
                        onChange={(e) =>
                          setEditingStoryDraft({ ...editingStoryDraft, title: e.target.value })
                        }
                        placeholder="VD: Chú Thỏ Trắng biết vâng lời – Tập 1..."
                        className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-sm font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#23324D] mb-1">
                        Độ tuổi phù hợp
                      </label>
                      <select
                        value={editingStoryDraft.ageRecommendation || '6–12 tuổi'}
                        onChange={(e) =>
                          setEditingStoryDraft({
                            ...editingStoryDraft,
                            ageRecommendation: e.target.value,
                          })
                        }
                        className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-xs font-bold"
                      >
                        <option value="6–8 tuổi">6–8 tuổi</option>
                        <option value="9–12 tuổi">9–12 tuổi</option>
                        <option value="6–12 tuổi">6–12 tuổi</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#23324D] mb-1">
                        Chủ đề / Danh mục
                      </label>
                      <select
                        value={editingStoryDraft.category}
                        onChange={(e) =>
                          setEditingStoryDraft({
                            ...editingStoryDraft,
                            category: e.target.value as StoryCategory,
                          })
                        }
                        className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-xs font-bold"
                      >
                        <option value="Truyện Ba Mẹ tải lên">Truyện Ba Mẹ tải lên</option>
                        <option value="Biết ơn và yêu thương">Biết ơn và yêu thương</option>
                        <option value="Vượt khó và kiên trì">Vượt khó và kiên trì</option>
                        <option value="Trung thực và sẻ chia">Trung thực và sẻ chia</option>
                        <option value="Truyện dân gian Việt Nam">Truyện dân gian Việt Nam</option>
                        <option value="Khám phá thế giới">Khám phá thế giới</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#23324D] mb-1">
                        Tóm tắt ngắn gọn
                      </label>
                      <input
                        type="text"
                        value={editingStoryDraft.summary}
                        onChange={(e) =>
                          setEditingStoryDraft({
                            ...editingStoryDraft,
                            summary: e.target.value,
                          })
                        }
                        className="w-full min-h-[42px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#23324D] mb-1">
                      Nội dung tập Podcast (Mỗi đoạn cách nhau 1 dòng trống · Hệ thống sẽ ghép liền mạch thành 1 tập âm thanh liên tục kèm mốc chuyển cảnh)
                    </label>
                    <textarea
                      rows={7}
                      value={paragraphsTextInput}
                      onChange={(e) => setParagraphsTextInput(e.target.value)}
                      placeholder="Nhập hoặc chỉnh sửa các đoạn của tập truyện tại đây..."
                      className="w-full p-3.5 rounded-2xl bg-[#F7F9FD] border border-[#23324D]/15 text-sm leading-relaxed"
                    />
                  </div>

                  {/* Section A.4: Scene Illustration Accuracy Audit & Optional Per-Paragraph Image Override */}
                  {(() => {
                    const currentParas = paragraphsTextInput
                      .split(/\n{2,}/)
                      .map((p) => p.trim())
                      .filter(Boolean);
                    const audit = auditStorySceneIllustrations({
                      ...editingStoryDraft,
                      paragraphs: currentParas,
                    });
                    return (
                      <div className="rounded-[20px] bg-[#F7F9FD] border border-[#23324D]/10 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="font-kids font-extrabold text-sm text-[#23324D]">
                              Kiểm tra tranh minh họa theo từng đoạn ({audit.dedicatedOrCustomCount}/
                              {audit.totalParagraphs} đoạn có tranh riêng)
                            </h3>
                            {audit.flaggedSharedFallbackCount > 0 && (
                              <p className="text-[11px] font-bold text-amber-800 mt-0.5">
                                ⚠️ Có {audit.flaggedSharedFallbackCount} đoạn đang dùng ảnh Warm Storybook dùng chung (đã gắn cờ bên dưới để ba mẹ có thể gắn URL ảnh riêng nếu muốn).
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {audit.items.map((item) => {
                            const existingCustom =
                              editingStoryDraft.paragraphSceneImages?.[item.paragraphIndex];
                            return (
                              <div
                                key={item.paragraphIndex}
                                className="rounded-xl bg-white p-2.5 border border-[#23324D]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <img
                                    src={item.imageUrl}
                                    alt={item.caption}
                                    className="w-12 h-12 rounded-lg object-cover shrink-0 border border-[#23324D]/10"
                                  />
                                  <div className="min-w-0">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-kids font-extrabold ${
                                        item.flaggedForParentReview
                                          ? 'bg-amber-100 text-amber-900'
                                          : 'bg-[#DDF5E8] text-[#188050]'
                                      }`}
                                    >
                                      Đoạn {item.paragraphIndex + 1} · {item.statusLabel}
                                    </span>
                                    <p className="text-[11px] text-[#5C6F8C] truncate mt-0.5">
                                      {currentParas[item.paragraphIndex]?.slice(0, 75) || item.caption}
                                    </p>
                                  </div>
                                </div>

                                <input
                                  type="text"
                                  value={existingCustom?.imageUrl || ''}
                                  onChange={(e) => {
                                    const nextUrl = e.target.value;
                                    const baseArr = Array.from(
                                      { length: currentParas.length },
                                      (_, i) =>
                                        editingStoryDraft.paragraphSceneImages?.[i] || {
                                          imageUrl: '',
                                          caption: '',
                                        }
                                    );
                                    baseArr[item.paragraphIndex] = {
                                      imageUrl: nextUrl,
                                      caption:
                                        existingCustom?.caption ||
                                        currentParas[item.paragraphIndex]?.slice(0, 70) ||
                                        '',
                                    };
                                    setEditingStoryDraft({
                                      ...editingStoryDraft,
                                      paragraphSceneImages: baseArr,
                                    });
                                  }}
                                  placeholder="Dán URL ảnh riêng (tùy chọn)..."
                                  className="sm:w-52 min-h-[34px] px-2.5 rounded-lg bg-[#F7F9FD] border border-[#23324D]/15 text-[11px]"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#23324D] mb-1">
                        Bài học nhẹ nhàng của tập truyện
                      </label>
                      <input
                        type="text"
                        value={editingStoryDraft.moralLesson}
                        onChange={(e) =>
                          setEditingStoryDraft({
                            ...editingStoryDraft,
                            moralLesson: e.target.value,
                          })
                        }
                        className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#23324D] mb-1">
                        Câu hỏi suy ngẫm cuối tập (Tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={editingStoryDraft.reflectionQuestion}
                        onChange={(e) =>
                          setEditingStoryDraft({
                            ...editingStoryDraft,
                            reflectionQuestion: e.target.value,
                          })
                        }
                        className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              GROUP 6: SAO VÀ QUÀ TẶNG (REWARDS, WHEEL CONFIRMATION, STAR LEDGER)
              ===================================================================== */}
          {parentGroup === 'rewards' && (
            <div className="space-y-6">
              {/* Spin Confirmation */}
              <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-4">
                <h2 className="font-kids text-xl font-extrabold text-[#23324D]">
                  Xác nhận kết quả Vòng quay cuối tháng của con
                </h2>

                {data.rewardSpins.length === 0 ? (
                  <p className="text-sm text-[#23324D]/70 bg-[#F7F9FD] rounded-2xl p-4">
                    Tháng này bé chưa thực hiện lượt quay thưởng nào. Khi bé quay xong, kết quả sẽ hiển thị tại đây để ba mẹ xác nhận.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.rewardSpins.map((spin) => (
                      <div
                        key={spin.id}
                        className="rounded-[20px] bg-[#FFF0C9]/70 border border-amber-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div>
                          <span className="text-xs font-bold text-amber-900">
                            Chu kỳ tháng {spin.cycleMonth} ·{' '}
                            {spin.status === 'confirmed'
                              ? 'Đã xác nhận trao thưởng'
                              : 'Đang chờ Ba Mẹ xác nhận'}
                          </span>
                          <h3 className="font-kids text-lg font-extrabold text-[#23324D] mt-0.5">
                            🎁 {spin.rewardTitle}
                          </h3>
                        </div>

                        {spin.status === 'pending_parent_confirmation' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await confirmRewardSpinByParent(
                                spin.id,
                                'Ba mẹ đã xác nhận! Cuối tuần này cả nhà mình cùng thực hiện nhé!'
                              );
                              showNotice(`Đã xác nhận phần thưởng "${spin.rewardTitle}" cho bé!`);
                            }}
                            className="min-h-[42px] px-4 py-2 rounded-[16px] bg-emerald-600 hover:bg-emerald-700 text-white font-kids font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Xác nhận phần thưởng này</span>
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-emerald-700">
                            ✓ Ba mẹ đã duyệt
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Family Rewards List & Add/Delete */}
              <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-4">
                <div>
                  <h2 className="font-kids text-xl font-extrabold text-[#23324D]">
                    Danh sách phần thưởng trên Vòng quay ({data.rewards.length})
                  </h2>
                  <p className="text-xs text-[#23324D]/70">
                    Bật/tắt phê duyệt, thêm mới hoặc xóa phần thưởng gắn kết gia đình.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {data.rewards.map((reward) => (
                    <div
                      key={reward.id}
                      className="rounded-[18px] bg-[#F7F9FD] border border-[#23324D]/10 p-4 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <h3 className="font-kids font-bold text-base text-[#23324D] truncate">
                          {reward.title}
                        </h3>
                        <p className="text-xs text-[#23324D]/70 mt-0.5">
                          {reward.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3978F6] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={reward.approvedByParent && reward.active}
                            onChange={(e) => {
                              updateRewardConfig({
                                ...reward,
                                approvedByParent: e.target.checked,
                                active: e.target.checked,
                              });
                            }}
                            className="w-4 h-4 accent-[#3978F6]"
                          />
                          <span>Duyệt</span>
                        </label>

                        {data.rewards.length > 4 && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteTarget({
                                kind: 'reward',
                                id: reward.id,
                                title: reward.title,
                              })
                            }
                            className="w-7 h-7 rounded-lg bg-white hover:bg-rose-50 text-rose-600 flex items-center justify-center cursor-pointer"
                            title="Xóa phần thưởng"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {data.rewards.length < 8 && (
                  <div className="pt-3 border-t border-[#23324D]/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={newRewardTitle}
                      onChange={(e) => setNewRewardTitle(e.target.value)}
                      placeholder="Tên phần thưởng mới (VD: Đi sở thú)..."
                      className="min-h-[42px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-sm"
                    />
                    <input
                      type="text"
                      value={newRewardDesc}
                      onChange={(e) => setNewRewardDesc(e.target.value)}
                      placeholder="Mô tả ngắn..."
                      className="min-h-[42px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-sm"
                    />
                    <button
                      type="button"
                      disabled={!newRewardTitle.trim()}
                      onClick={async () => {
                        await addFamilyReward(newRewardTitle, newRewardDesc, 'mint', true);
                        setNewRewardTitle('');
                        setNewRewardDesc('');
                        showNotice('Đã thêm & phê duyệt phần thưởng gia đình mới vào vòng quay!');
                      }}
                      className="min-h-[42px] px-4 rounded-xl bg-[#3978F6] text-white font-bold text-xs disabled:opacity-40 cursor-pointer"
                    >
                      + Thêm & Phê duyệt
                    </button>
                  </div>
                )}
              </div>

              {/* Praise Star Award + Points Policy + Ledger */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-5 space-y-4">
                  <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-3">
                    <h2 className="font-kids text-lg font-extrabold text-[#23324D]">
                      Tặng ngôi sao khích lệ cho con
                    </h2>
                    <input
                      type="text"
                      value={praiseTitle}
                      onChange={(e) => setPraiseTitle(e.target.value)}
                      placeholder="VD: Con tự giác gấp quần áo giúp mẹ"
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-sm"
                    />
                    <input
                      type="text"
                      value={praiseNote}
                      onChange={(e) => setPraiseNote(e.target.value)}
                      placeholder="Lời khen của ba mẹ..."
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-sm"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await awardParentPraiseStar(
                          praiseTitle || 'Ba mẹ khen con ngoan',
                          praiseNote || 'Con rất biết quan tâm gia đình'
                        );
                        setPraiseTitle('');
                        setPraiseNote('');
                        showNotice('Đã gửi tặng ngôi sao khích lệ cho bé!');
                      }}
                      className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-kids font-extrabold text-xs sm:text-sm cursor-pointer"
                    >
                      ★ Tặng +{data.pointsPolicy.parentPraiseStars} sao khích lệ
                    </button>
                  </div>

                  <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-3">
                    <h2 className="font-kids text-base font-extrabold text-[#23324D]">
                      Cấu hình Chính sách Sao
                    </h2>
                    <div className="space-y-2.5 text-xs">
                      <label className="flex items-center justify-between">
                        <span>Sao cần để mở Vòng quay tháng:</span>
                        <input
                          type="number"
                          min={10}
                          max={100}
                          value={data.pointsPolicy.monthlyWheelThresholdStars}
                          onChange={(e) =>
                            updatePointsPolicy({
                              ...data.pointsPolicy,
                              monthlyWheelThresholdStars: Math.max(
                                10,
                                Math.min(100, Number(e.target.value) || 50)
                              ),
                            })
                          }
                          className="w-20 min-h-[36px] px-2 rounded-lg bg-[#F7F9FD] border border-[#23324D]/15 font-bold text-center tabular-nums"
                        />
                      </label>

                      <label className="flex items-center justify-between">
                        <span>Sao thưởng mỗi nhiệm vụ:</span>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={data.pointsPolicy.taskCompletionStars}
                          onChange={(e) =>
                            updatePointsPolicy({
                              ...data.pointsPolicy,
                              taskCompletionStars: Math.max(
                                1,
                                Math.min(5, Number(e.target.value) || 2)
                              ),
                            })
                          }
                          className="w-20 min-h-[36px] px-2 rounded-lg bg-[#F7F9FD] border border-[#23324D]/15 font-bold text-center tabular-nums"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-3">
                  <h2 className="font-kids text-lg font-extrabold text-[#23324D]">
                    Nhật ký Sao của {data.profile.displayName} ({data.starLedger.length})
                  </h2>
                  <div className="divide-y divide-[#23324D]/8 max-h-[340px] overflow-y-auto">
                    {data.starLedger.map((tx) => (
                      <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-kids font-bold text-sm text-[#23324D]">{tx.title}</p>
                          <p className="text-xs text-[#23324D]/70">{tx.note}</p>
                          <p className="text-[11px] text-[#23324D]/50 tabular-nums">
                            Ngày {tx.dateKey}
                          </p>
                        </div>
                        <span className="font-kids font-extrabold text-sm text-amber-600 tabular-nums shrink-0">
                          +{tx.amount} ★
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              GROUP 7: CÀI ĐẶT – HỒ SƠ BÉ (STRICTLY 3 FIELDS: TÊN BÉ, TUỔI, GIỚI TÍNH)
              ===================================================================== */}
          {parentGroup === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-4">
                <div>
                  <span className="text-xs font-bold text-[#3978F6]">
                    Hồ sơ của bé (3 thông tin cơ bản)
                  </span>
                  <h2 className="font-kids text-lg font-extrabold text-[#23324D] mt-0.5">
                    Thông tin của bé
                  </h2>
                  <p className="text-xs text-[#5C6F8C] mt-0.5">
                    Giới tính của bé dùng để đồng bộ nhân vật trong tranh minh họa hoạt động và câu chuyện (độc lập với giọng đọc của Buddy).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Field 1: Tên bé */}
                  <div>
                    <label className="block text-xs font-bold text-[#23324D] mb-1">
                      1. Tên bé
                    </label>
                    <input
                      type="text"
                      value={childNameInput}
                      onChange={(e) => setChildNameInput(e.target.value)}
                      placeholder="Nhập tên bé..."
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-sm font-bold text-[#23324D]"
                    />
                  </div>

                  {/* Field 2: Tuổi */}
                  <div>
                    <label className="block text-xs font-bold text-[#23324D] mb-1">
                      2. Tuổi
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={14}
                      value={childAgeInput}
                      onChange={(e) => setChildAgeInput(Number(e.target.value) || 8)}
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F7F9FD] border border-[#23324D]/15 text-sm font-bold text-[#23324D] tabular-nums"
                    />
                  </div>
                </div>

                {/* Field 3: Giới tính: Nam / Nữ */}
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold text-[#23324D]">
                    3. Giới tính
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        { variant: 'boy' as ChildCharacterVariant, genderLabel: 'Nam' },
                        { variant: 'girl' as ChildCharacterVariant, genderLabel: 'Nữ' },
                      ] as const
                    ).map(({ variant, genderLabel }) => {
                      const isSelected = characterVariantInput === variant;
                      return (
                        <button
                          key={variant}
                          type="button"
                          onClick={async () => {
                            setCharacterVariantInput(variant);
                            await updateChildCharacterVariant(variant);
                            showNotice(
                              `Đã chọn Giới tính "${genderLabel}" và đồng bộ tranh minh họa Warm Storybook!`
                            );
                          }}
                          className={`rounded-[20px] p-3 text-left border-2 transition-all cursor-pointer space-y-2 ${
                            isSelected
                              ? 'bg-[#EAF3FF] border-[#3978F6] shadow-2xs'
                              : 'bg-[#F7F9FD] border-[#23324D]/10 hover:border-[#3978F6]/40'
                          }`}
                        >
                          <div className="w-full h-24 rounded-[14px] overflow-hidden">
                            <TaskStepIllustration
                              illustrationKey="schedule-check"
                              characterVariant={variant}
                              className="w-full h-full"
                            />
                          </div>
                          <div className="flex items-center justify-between px-1">
                            <div>
                              <p className="font-kids font-extrabold text-sm text-[#23324D]">
                                {genderLabel}
                              </p>
                              <p className="text-[11px] text-[#5C6F8C]">
                                Minh họa bé {genderLabel === 'Nam' ? 'trai' : 'gái'}
                              </p>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-[#3978F6] shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    if (!childNameInput.trim()) {
                      setValidationError('Vui lòng nhập Tên bé.');
                      return;
                    }
                    await updateChildProfileName(
                      childNameInput.trim(),
                      childAgeInput,
                      data.profile.parentConsentGranted ?? true,
                      characterVariantInput
                    );
                    showNotice(
                      `Đã lưu Hồ sơ bé: ${childNameInput.trim()} (${childAgeInput} tuổi · Giới tính: ${
                        characterVariantInput === 'boy' ? 'Nam' : 'Nữ'
                      })!`
                    );
                  }}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-[18px] bg-[#3978F6] hover:bg-[#2968e6] text-white font-kids font-extrabold text-xs cursor-pointer"
                >
                  Lưu hồ sơ của bé
                </button>
              </div>

              <div className="rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-4">
                <h2 className="font-kids text-lg font-extrabold text-[#23324D]">
                  Kiểm soát Thời gian, Giọng nói & Khôi phục Demo
                </h2>

                <label className="flex items-center justify-between text-xs font-bold text-[#23324D]">
                  <span>Cho phép bé dùng nút Micro trong Trò chuyện:</span>
                  <input
                    type="checkbox"
                    checked={data.parentSettings.allowVoiceInput}
                    onChange={(e) =>
                      updateParentSettings({ allowVoiceInput: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#3978F6]"
                  />
                </label>

                <label className="flex items-center justify-between text-xs font-bold text-[#23324D]">
                  <span>Giờ nghỉ ngơi buổi tối:</span>
                  <input
                    type="time"
                    value={data.parentSettings.bedtimeQuietHour}
                    onChange={(e) =>
                      updateParentSettings({ bedtimeQuietHour: e.target.value })
                    }
                    className="min-h-[36px] px-2.5 rounded-lg bg-[#F7F9FD] border border-[#23324D]/15 font-mono"
                  />
                </label>

                <div className="pt-4 border-t border-[#23324D]/10 space-y-2">
                  <p className="text-xs text-[#23324D]/70">
                    Muốn thử lại toàn bộ kịch bản từ đầu với dữ liệu gốc của bé Minh Anh?
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      await resetDemoData();
                      showNotice('Đã khôi phục toàn bộ dữ liệu mẫu ban đầu!');
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FFE4D8] hover:bg-[#ffd5c2] text-rose-900 font-bold text-xs cursor-pointer"
                  >
                    Khôi phục dữ liệu mẫu ban đầu (Reset Demo)
                  </button>
                </div>
              </div>

              {/* Asset Registry & Missing Storybook Assets Manifest (Sec. 6 & A12) */}
              <div className="md:col-span-2 rounded-[24px] bg-white border border-[#23324D]/10 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-[#3978F6]">
                      AssetRegistry v1.4 · Warm Storybook Illustration System
                    </span>
                    <h2 className="font-kids text-base sm:text-lg font-extrabold text-[#23324D]">
                      Trạng thái minh bạch Hệ thống Tranh minh họa từng bước
                    </h2>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#DDF5E8] text-[#188050] font-bold text-xs">
                    {TASK_STEP_ASSET_REGISTRY.length} ảnh raster thật (Chuẩn bị cặp sách) + 1 Bản đồ giấy cổ điển
                  </span>
                </div>
                <p className="text-xs text-[#5C6F8C]">
                  Nhiệm vụ trọng tâm <strong>Chuẩn bị cặp sách (5 bước)</strong> và <strong>Bản đồ Hành trình của con</strong> sử dụng ảnh raster Warm Storybook thật. {MISSING_STORYBOOK_ASSETS_MANIFEST.length} bước của các nhiệm vụ phụ hiện sử dụng minh họa SVG Warm Storybook đồng bộ và được liệt kê rõ trong danh mục sản xuất tiếp theo:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {MISSING_STORYBOOK_ASSETS_MANIFEST.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-xl bg-[#F7F9FD] border border-[#23324D]/8 p-2.5 text-xs"
                    >
                      <p className="font-bold text-[#23324D]">{item.taskTitle}</p>
                      <p className="text-[11px] text-[#5C6F8C] line-clamp-1">
                        {item.stepDescription}
                      </p>
                      <span className="text-[10px] font-mono text-[#3978F6]">
                        {item.recommendedFilename}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
