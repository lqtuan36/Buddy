import React from 'react';
import {
  Mic,
  Volume2,
  Star,
  Settings,
  ChevronRight,
  ShieldCheck,
  Backpack,
  Calendar,
  Gift,
  Sparkles,
  BookOpen,
  Compass,
  Play,
} from 'lucide-react';
import { useBuddy } from '../context/BuddyContext';
import { BuddyAvatar } from './BuddyAvatar';
import {
  TaskStepIllustration,
  StoryEditorialIllustration,
  GrowthTopicIllustration,
} from './BuddyIllustrations';
import { getTodayDateKey } from '../services/pointsPolicy';

/**
 * v1.4 HIGH-FIDELITY KIDS HOME VIEW (90%+ Visual Fidelity Match)
 * 1. Clean Top Header (Personal Greeting + Stars 18px button + Voice Settings 18px button)
 * 2. Balanced Buddy Hero Section (3D Buddy Centerpiece + Speech Bubble + "Nói chuyện với Buddy" 18px CTA)
 * 3. Prominent "Việc tiếp theo" Card (Large Warm Storybook Scene + Star Badge + "Bắt đầu ngay" 18px CTA)
 * 4. 3 Harmonious Companion Cards ("Hành trình của con", "Truyện tối nay", "Tiến độ hôm nay")
 */
export const KidsHomeView: React.FC = () => {
  const {
    data,
    voiceState,
    starSummary,
    greetingInfo,
    hasGreetedThisSession,
    needsManualGreetingButton,
    triggerBuddyGreeting,
    schoolPrepReminder,
    speakSchoolPrepReminder,
    dismissSchoolPrepReminder,
    tonightScheduledStory,
    navigateTab,
    openSubView,
    openBuddyChat,
    setSelectedJourneyTopicId,
  } = useBuddy();

  const todayKey = getTodayDateKey();
  const approvedRoutines = data.routines.filter((r) => r.approvedByParent);
  const completedRoutinesToday = approvedRoutines.filter((r) =>
    r.completedDates.includes(todayKey)
  ).length;
  const totalRoutinesCount = Math.max(1, approvedRoutines.length);
  const progressPercent = Math.min(
    100,
    Math.round((completedRoutinesToday / totalRoutinesCount) * 100)
  );

  // Featured Next Activity: prioritize uncompleted routine's task or Chuẩn bị cặp sách
  const approvedTasks = data.tasks.filter((t) => t.approvalStatus === 'approved');
  const nextPendingRoutine = approvedRoutines.find(
    (r) => !r.completedDates.includes(todayKey)
  );
  const featuredTask =
    approvedTasks.find((t) => t.id === 'task-backpack') ||
    approvedTasks.find((t) => t.id === nextPendingRoutine?.linkedTaskId) ||
    approvedTasks[0];

  // Current Growth Journey Topic
  const approvedTopics = (data.growthTopics || []).filter(
    (t) => t.approvalStatus === 'approved' && t.selectedByParent
  );
  const currentJourneyTopic =
    approvedTopics.find((t) => t.isCurrentFocus) || approvedTopics[0];
  const experiencedInTopic = currentJourneyTopic
    ? currentJourneyTopic.experiences.filter((e) => e.status === 'experienced').length
    : 0;

  // Tonight's Bedtime Story
  const tonightStory =
    tonightScheduledStory ||
    data.stories.find((s) => s.approvedByParent && !s.hiddenByParent) ||
    data.stories[0];

  const isBuddySpeaking =
    voiceState.status === 'playing' || voiceState.status === 'speaking';
  const showManualGreetPrompt =
    needsManualGreetingButton || Boolean(voiceState.autoplayBlocked) || !hasGreetedThisSession;

  return (
    <div className="space-y-6 pb-6">
      {/* 1. TOP HEADER: Personalized greeting + Stars & Voice Settings */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#5C6F8C]">
            Người bạn nhỏ mỗi ngày · Giọng {data.voicePreference.gender === 'male' ? 'Nam' : 'Nữ'}
          </p>
          <h1 className="font-kids text-xl sm:text-2xl font-extrabold text-[#23324D] tracking-tight truncate">
            {greetingInfo.headline}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openSubView({ type: 'stars-detail' })}
            className="min-h-[44px] px-4 py-2 rounded-[18px] bg-[#FFF0C9] hover:bg-[#ffe5a3] text-[#23324D] font-kids font-extrabold text-sm inline-flex items-center gap-1.5 shadow-[0_4px_12px_rgba(245,158,11,0.12)] transition-transform active:scale-95 cursor-pointer"
            title="Ngôi sao của con"
          >
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span className="tabular-nums">{starSummary.monthlyStars}</span>
          </button>

          <button
            type="button"
            onClick={() => openSubView({ type: 'voice-settings' })}
            className="w-11 h-11 rounded-[18px] bg-white hover:bg-[#EAF3FF] border border-[#23324D]/8 text-[#23324D] flex items-center justify-center shadow-[0_4px_12px_rgba(35,50,77,0.05)] transition-colors cursor-pointer"
            aria-label="Cài đặt giọng nói của Buddy"
            title="Cài đặt giọng nói Buddy"
          >
            <Settings className="w-5 h-5 text-[#3978F6]" />
          </button>
        </div>
      </header>

      {/* 2. BUDDY HERO SECTION: Centered 3D Mascot + Speech Bubble + Primary CTA */}
      <section className="rounded-[32px] bg-gradient-to-b from-[#EAF3FF] via-[#F2F7FF] to-white border border-[#3978F6]/15 p-6 text-center shadow-[0_14px_36px_rgba(57,120,246,0.09)] flex flex-col items-center">
        <div className="my-1">
          <BuddyAvatar
            size="hero"
            isSpeaking={isBuddySpeaking}
            mood="happy"
          />
        </div>

        {/* Personalized Time-of-Day Speech Bubble */}
        <div className="mt-4 w-full max-w-md rounded-[24px] bg-white/95 border border-[#3978F6]/12 px-4 py-3.5 shadow-[0_6px_20px_rgba(35,50,77,0.05)] flex items-center justify-between gap-3 text-left">
          <p className="font-kids text-sm sm:text-base font-bold text-[#23324D] leading-snug">
            “{greetingInfo.spokenText}”
          </p>
          <button
            type="button"
            onClick={() => triggerBuddyGreeting(true)}
            className={`w-11 h-11 rounded-[18px] flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
              isBuddySpeaking
                ? 'bg-[#3978F6] text-white shadow-[0_4px_14px_rgba(57,120,246,0.35)]'
                : 'bg-[#EAF3FF] hover:bg-[#3978F6] text-[#3978F6] hover:text-white'
            }`}
            aria-label="Nghe lời chào của Buddy"
            title="Nghe Buddy chào"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        {showManualGreetPrompt && (
          <button
            type="button"
            onClick={() => triggerBuddyGreeting(true)}
            className="mt-3 inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-[18px] bg-[#FFF0C9] hover:bg-[#ffe5a3] text-[#23324D] font-kids font-extrabold text-xs shadow-2xs transition-transform active:scale-95 cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-amber-700" />
            <span>Chào Buddy (Bật âm thanh)</span>
          </button>
        )}

        <button
          type="button"
          onClick={openBuddyChat}
          className="mt-4 w-full max-w-md min-h-[54px] px-6 py-3.5 rounded-[18px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-base shadow-[0_10px_24px_rgba(57,120,246,0.28)] inline-flex items-center justify-center gap-2.5 transition-transform active:scale-[0.98] cursor-pointer"
        >
          <Mic className="w-5 h-5" />
          <span>Nói chuyện với Buddy</span>
        </button>
      </section>

      {/* 3. FEATURED NEXT ACTIVITY ("VIỆC TIẾP THEO") + SCHOOL PREP REMINDER */}
      <section aria-label="Việc tiếp theo của con" className="space-y-4">
        {schoolPrepReminder && !schoolPrepReminder.isDismissed && (
          <div className="rounded-[28px] bg-gradient-to-br from-[#FFF0C9] via-[#FFF9EB] to-[#EAF3FF] border border-amber-300/80 p-4 sm:p-5 shadow-[0_10px_26px_rgba(245,158,11,0.1)] space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[18px] bg-white flex items-center justify-center text-[#3978F6] shadow-2xs shrink-0">
                  <Backpack className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-kids font-extrabold text-amber-900 tabular-nums">
                    Nhắc lịch học · {schoolPrepReminder.prepTime}
                  </span>
                  <h2 className="font-kids text-base sm:text-lg font-extrabold text-[#23324D]">
                    Chuẩn bị sách vở cho {schoolPrepReminder.tomorrowDayLabel}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={speakSchoolPrepReminder}
                  className="min-h-[38px] px-3 py-1.5 rounded-[18px] bg-white hover:bg-[#3978F6] text-[#3978F6] hover:text-white font-kids font-extrabold text-xs inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Nghe</span>
                </button>
                <button
                  type="button"
                  onClick={dismissSchoolPrepReminder}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-[18px] text-xs font-bold text-[#23324D]/60 hover:text-[#23324D] cursor-pointer"
                >
                  Ẩn
                </button>
              </div>
            </div>

            <div className="rounded-[20px] bg-white/95 border border-amber-200/70 p-3.5 text-left space-y-1">
              <p className="font-kids font-extrabold text-xs sm:text-sm text-[#23324D]">
                <span className="text-[#3978F6]">Môn học:</span>{' '}
                {schoolPrepReminder.subjects.join(' · ')}
              </p>
              {schoolPrepReminder.supplies.length > 0 && (
                <p className="text-xs font-semibold text-[#5C6F8C]">
                  <span className="text-emerald-800 font-bold">Đồ dùng:</span>{' '}
                  {schoolPrepReminder.supplies.join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        {featuredTask && (
          <div className="rounded-[30px] bg-white border border-[#23324D]/8 p-5 shadow-[0_14px_36px_rgba(35,50,77,0.06)] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-kids font-extrabold text-[#3978F6]">
                <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span>Việc tiếp theo của con</span>
              </span>
              <span className="px-3 py-1 rounded-[14px] bg-[#FFF0C9] text-amber-900 font-kids font-extrabold text-xs tabular-nums">
                +{featuredTask.starReward} ★ · {featuredTask.steps.length} bước tranh
              </span>
            </div>

            <div
              onClick={() =>
                openSubView({
                  type: 'guide-task',
                  taskId: featuredTask.id,
                  routineId: nextPendingRoutine?.id,
                })
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openSubView({
                    type: 'guide-task',
                    taskId: featuredTask.id,
                    routineId: nextPendingRoutine?.id,
                  });
                }
              }}
              className="group cursor-pointer space-y-4"
            >
              <TaskStepIllustration
                illustrationKey={featuredTask.coverIllustration}
                variant="cover"
                className="w-full h-52 sm:h-60 rounded-[24px]"
                showActionCaption
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="min-w-0">
                  <h3 className="font-kids text-xl sm:text-2xl font-extrabold text-[#23324D]">
                    {featuredTask.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-semibold text-[#5C6F8C] mt-0.5">
                    {featuredTask.subtitle}
                  </p>
                </div>

                <span className="shrink-0 min-h-[48px] px-5 py-2.5 rounded-[18px] bg-[#3978F6] group-hover:bg-[#2964DF] text-white font-kids font-extrabold text-sm shadow-[0_8px_20px_rgba(57,120,246,0.25)] inline-flex items-center justify-center gap-2 transition-colors">
                  <Play className="w-4 h-4 fill-white" />
                  <span>Bắt đầu ngay</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 4. THREE HARMONIOUS COMPANION BLOCKS:
          (1) Hành trình của con · (2) Truyện tối nay · (3) Tiến độ hôm nay */}
      <section aria-label="Tiện ích đồng hành mỗi ngày" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card A: Hành trình của con */}
        {currentJourneyTopic && (
          <div className="rounded-[28px] bg-gradient-to-br from-[#FFF0C9]/85 via-white to-[#EDE7FF]/75 border border-amber-300/60 p-5 shadow-[0_8px_24px_rgba(35,50,77,0.05)] flex flex-col justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <GrowthTopicIllustration
                slug={currentJourneyTopic.slug}
                className="w-16 h-16 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1 text-xs font-kids font-extrabold text-[#6B3FA0]">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Hành trình của con · Chặng {currentJourneyTopic.stageOrder}</span>
                </span>
                <h2 className="font-kids text-lg font-extrabold text-[#23324D] mt-0.5 leading-snug">
                  {currentJourneyTopic.title}
                </h2>
                <p className="text-xs font-semibold text-[#5C6F8C] mt-0.5">
                  {currentJourneyTopic.landmarkName} · Đã trải nghiệm {experiencedInTopic}/{currentJourneyTopic.experiences.length} bước
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedJourneyTopicId(currentJourneyTopic.id);
                navigateTab('journey');
              }}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-[18px] bg-white hover:bg-[#3978F6] text-[#3978F6] hover:text-white font-kids font-extrabold text-xs sm:text-sm shadow-2xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Mở bản đồ phiêu lưu</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Card B: Truyện tối nay */}
        {tonightStory && (
          <div className="rounded-[28px] bg-gradient-to-br from-[#EDE7FF]/85 via-white to-[#EAF3FF]/75 border border-indigo-200/80 p-5 shadow-[0_8px_24px_rgba(35,50,77,0.05)] flex flex-col justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-16 h-16 shrink-0">
                <StoryEditorialIllustration
                  type={tonightStory.illustrationType}
                  className="w-full h-full rounded-[18px] p-1.5"
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1 text-xs font-kids font-extrabold text-indigo-800">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>
                    Truyện tối nay · {data.bedtimeStoryConfig?.bedtimeReminderTime || '20:30'}
                  </span>
                </span>
                <h2 className="font-kids text-lg font-extrabold text-[#23324D] mt-0.5 leading-snug line-clamp-1">
                  {tonightStory.title}
                </h2>
                <p className="text-xs font-semibold text-[#5C6F8C] mt-0.5">
                  Thời lượng {tonightStory.durationMinutes} phút · Giọng đọc ấm áp
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  openSubView({ type: 'story-detail', storyId: tonightStory.id })
                }
                className="min-h-[44px] px-3.5 py-2 rounded-[18px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Nghe ngay</span>
              </button>
              <button
                type="button"
                onClick={() => openSubView({ type: 'story-list' })}
                className="min-h-[44px] px-3.5 py-2 rounded-[18px] bg-white hover:bg-[#EAF3FF] text-[#3978F6] font-kids font-extrabold text-xs sm:text-sm inline-flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
              >
                Kho truyện
              </button>
            </div>
          </div>
        )}

        {/* Card C: Tiến độ hôm nay (Spans full width on tablet 2-col grid) */}
        <div className="md:col-span-2 rounded-[28px] bg-gradient-to-r from-[#DDF5E8] via-[#EAF3FF] to-[#FFF0C9] border border-[#23324D]/8 p-5 shadow-[0_8px_24px_rgba(35,50,77,0.05)] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-kids font-extrabold text-emerald-900">
                Tiến độ hôm nay của {data.profile.displayName}
              </span>
              <h2 className="font-kids text-lg sm:text-xl font-extrabold text-[#23324D] mt-0.5">
                Đã hoàn thành {completedRoutinesToday}/{approvedRoutines.length} việc tốt
              </h2>
            </div>

            <button
              type="button"
              onClick={() => navigateTab('activities')}
              className="min-h-[42px] px-4 py-2 rounded-[18px] bg-white hover:bg-[#EAF3FF] text-[#3978F6] font-kids font-extrabold text-xs sm:text-sm shadow-2xs inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>Tất cả việc</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full h-3.5 rounded-full bg-white/90 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#3978F6] to-[#2EC27E] transition-all duration-300"
              style={{ width: `${Math.max(10, progressPercent)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-0.5">
            <button
              type="button"
              onClick={() => openSubView({ type: 'monthly-tracker' })}
              className="rounded-[18px] bg-white/95 hover:bg-white p-3 flex items-center gap-3 text-left shadow-2xs cursor-pointer transition-colors"
            >
              <div className="w-10 h-10 rounded-[14px] bg-[#DDF5E8] flex items-center justify-center text-emerald-800 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-kids font-extrabold text-xs sm:text-sm text-[#23324D] truncate">
                  Bảng theo dõi tháng
                </p>
                <p className="text-[11px] font-semibold text-[#5C6F8C] truncate">
                  Xem thói quen mỗi ngày
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => openSubView({ type: 'rewards-wheel' })}
              className="rounded-[18px] bg-white/95 hover:bg-white p-3 flex items-center gap-3 text-left shadow-2xs cursor-pointer transition-colors"
            >
              <div className="w-10 h-10 rounded-[14px] bg-[#FFE4D8] flex items-center justify-center text-rose-800 shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-kids font-extrabold text-xs sm:text-sm text-[#23324D] truncate">
                  Quà tặng của con
                </p>
                <p className="text-[11px] font-semibold text-[#5C6F8C] truncate">
                  {starSummary.wheelEligible
                    ? 'Mở vòng quay ngay!'
                    : `Còn ${starSummary.starsRemainingForWheel} ★ nữa`}
                </p>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Subtle Parent Gate Entry at Footer */}
      <div className="flex items-center justify-center pt-1">
        <button
          type="button"
          onClick={() => openSubView({ type: 'parent-dashboard' })}
          className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-[18px] bg-white/80 hover:bg-white border border-[#23324D]/8 text-xs font-semibold text-[#5C6F8C] hover:text-[#3978F6] transition-colors cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4 text-[#3978F6]" />
          <span>Khu vực Ba Mẹ (Buddy Parents)</span>
        </button>
      </div>
    </div>
  );
};
