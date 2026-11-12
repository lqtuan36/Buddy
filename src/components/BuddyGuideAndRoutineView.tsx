import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Play,
  Star,
  Calendar,
  Backpack,
  Volume2,
} from 'lucide-react';
import { useBuddy } from '../context/BuddyContext';
import {
  TaskStepCard,
  ResultCard,
} from './DesignSystem';
import { BuddyAvatar } from './BuddyAvatar';
import {
  TaskStepIllustration,
  RoutinePeriodIllustration,
} from './BuddyIllustrations';
import { getTodayDateKey } from '../services/pointsPolicy';
import { voiceService } from '../services/voiceService';
import { RoutinePeriod } from '../types/domain';

/**
 * Interactive Single-Task Visual Step Card Runner (Buddy Guide v1.3)
 * Uses the Warm Storybook Action Scene Card System:
 * - StepCard (TaskStepCard): 1 step = 1 card = 1 child action scene illustration
 * - HelpCard: Visual explanation card when child taps "Con chưa hiểu"
 * - ResultCard: Visual celebration card upon completing the task + "Xem bảng theo dõi tháng"
 * - Syncs activeTaskStepContext with BuddyContext so Floating Buddy knows the exact step.
 */
export const BuddyTaskStepRunner: React.FC<{
  taskId: string;
  routineId?: string;
  onBack: () => void;
}> = ({ taskId, routineId, onBack }) => {
  const {
    data,
    completeTaskStepRun,
    navigateTab,
    openSubView,
    setActiveTaskStepContext,
  } = useBuddy();
  const task = data.tasks.find((t) => t.id === taskId);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);
  const [helpRequestedStepIds, setHelpRequestedStepIds] = useState<string[]>([]);
  const [showSimpleHint, setShowSimpleHint] = useState(false);
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);
  const isSubmittingStepRef = useRef(false);
  const [completionResult, setCompletionResult] = useState<{
    done: boolean;
    awarded: boolean;
    starsAdded: number;
    message: string;
  } | null>(null);

  const steps = task?.steps || [];
  const currentStep = steps[currentStepIndex] || steps[0];

  // Sync current step context for Floating Buddy AI Assistant
  useEffect(() => {
    if (!task || completionResult?.done) {
      setActiveTaskStepContext(null);
      return;
    }
    setActiveTaskStepContext({
      taskId: task.id,
      stepIndex: currentStepIndex,
    });
    return () => {
      setActiveTaskStepContext(null);
    };
  }, [task, currentStepIndex, completionResult?.done, setActiveTaskStepContext]);

  const lastAutoSpokenStepRef = useRef<string | null>(null);

  // Stop active voice when leaving the step runner
  useEffect(() => {
    return () => {
      voiceService.cancel();
    };
  }, [taskId]);

  const buildConciseStepSpeechText = (stepIdx: number, rawActionTitle: string): string => {
    const cleanTitle = rawActionTitle.replace(/^Bước\s*\d+\s*[:.-]\s*/i, '').trim();
    return `Bước ${stepIdx + 1}: ${cleanTitle}`;
  };

  // Auto-read concise step title ONCE when step changes (unless completion screen is active)
  useEffect(() => {
    if (!task || !currentStep || completionResult?.done) return;
    const stepSignature = `${task.id}:${currentStepIndex}`;
    if (lastAutoSpokenStepRef.current === stepSignature) return;
    lastAutoSpokenStepRef.current = stepSignature;

    const timer = window.setTimeout(() => {
      const textToSpeak = buildConciseStepSpeechText(currentStepIndex, currentStep.actionTitle);
      void voiceService.speak(textToSpeak, data.voicePreference, 'guide');
    }, 280);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, task?.id, completionResult?.done]);

  if (!task || !currentStep) {
    return (
      <div className="rounded-[24px] bg-white p-6 text-center space-y-4">
        <p className="font-kids font-bold text-lg">Không tìm thấy nhiệm vụ này.</p>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-5 py-2 rounded-[18px] bg-[#3978F6] text-white font-bold cursor-pointer"
        >
          Quay lại
        </button>
      </div>
    );
  }

  const isCurrentStepDone = completedStepIds.includes(currentStep.id);

  // "Nghe" button replays the exact concise step title once without auto-looping
  const handleListenCurrentStep = () => {
    const textToSpeak = buildConciseStepSpeechText(currentStepIndex, currentStep.actionTitle);
    void voiceService.speak(textToSpeak, data.voicePreference, 'guide');
  };

  // "Con làm xong rồi" is the single action to record step completion and immediately advance to next step
  const handleMarkStepDone = async () => {
    if (isSubmittingStepRef.current || completionResult?.done) return;
    isSubmittingStepRef.current = true;
    setIsSubmittingStep(true);

    try {
      const updatedCompleted = completedStepIds.includes(currentStep.id)
        ? completedStepIds
        : [...completedStepIds, currentStep.id];

      setCompletedStepIds(updatedCompleted);
      setShowSimpleHint(false);

      // If there is a next step, immediately advance to it without blocking with an intermediate banner
      if (currentStepIndex + 1 < steps.length) {
        setCurrentStepIndex((idx) => idx + 1);
        window.setTimeout(() => {
          isSubmittingStepRef.current = false;
          setIsSubmittingStep(false);
        }, 200);
        return;
      }

      // Final step completed: save task completion & award stars once; completeTaskStepRun speaks celebration once
      const allStepIds = Array.from(new Set([...updatedCompleted, ...steps.map((s) => s.id)]));
      setCompletedStepIds(allStepIds);
      const result = await completeTaskStepRun(
        task.id,
        allStepIds,
        helpRequestedStepIds,
        routineId
      );
      setCompletionResult({
        done: true,
        awarded: result.awarded,
        starsAdded: result.starsAdded,
        message: result.message,
      });
    } finally {
      if (currentStepIndex + 1 >= steps.length) {
        isSubmittingStepRef.current = false;
        setIsSubmittingStep(false);
      }
    }
  };

  const handleNeedHelp = () => {
    setShowSimpleHint(true);
    if (!helpRequestedStepIds.includes(currentStep.id)) {
      setHelpRequestedStepIds((prev) => [...prev, currentStep.id]);
    }
    void voiceService.speak(currentStep.simpleExplanation, data.voicePreference, 'guide');
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0 && !isSubmittingStepRef.current) {
      setShowSimpleHint(false);
      lastAutoSpokenStepRef.current = null;
      setCurrentStepIndex((idx) => idx - 1);
    }
  };

  // Render Visual ResultCard when task is completed
  if (completionResult?.done) {
    return (
      <div className="pb-6">
        <ResultCard
          task={task}
          childName={data.profile.displayName}
          awarded={completionResult.awarded}
          starsAdded={completionResult.starsAdded}
          message={completionResult.message}
          onReplayPraise={() =>
            voiceService.speak(
              completionResult.message,
              data.voicePreference,
              'celebration'
            )
          }
          onOpenMonthlyTracker={() =>
            openSubView({ type: 'monthly-tracker', filterTaskId: task.id })
          }
          onGoHome={() => navigateTab('home')}
          onMoreActivities={onBack}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Compact Top Header (leaves room on top-right for compact Floating Buddy pill) */}
      <div className="flex items-center justify-between gap-3 pr-16 sm:pr-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-[18px] bg-white hover:bg-[#EAF3FF] border border-[#23324D]/8 text-xs sm:text-sm font-kids font-bold text-[#23324D] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>

        <div className="text-right min-w-0">
          <h1 className="font-kids text-sm sm:text-lg font-extrabold text-[#23324D] truncate">
            {task.title}
          </h1>
          <p className="text-[11px] font-kids font-extrabold text-amber-600">
            Thưởng +{task.starReward} ★ · {steps.length} bước
          </p>
        </div>
      </div>

      {/* Visual StepCard (1 Step = 1 Card = 1 Warm Storybook Scene Illustration + HelpCard support) */}
      <TaskStepCard
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={steps.length}
        completedCount={completedStepIds.length}
        isStepCompleted={isCurrentStepDone}
        isSubmitting={isSubmittingStep}
        showSimpleHint={showSimpleHint}
        onCompleteStep={handleMarkStepDone}
        onNeedHelp={handleNeedHelp}
        onRepeatAudio={handleListenCurrentStep}
        onPrevStep={handlePrevStep}
      />
    </div>
  );
};

/**
 * TAB HOẠT ĐỘNG – VISUAL DAILY ADVENTURES & WARM STORYBOOK TASK CARDS (v1.4)
 */
export const BuddyActivitiesView: React.FC = () => {
  const {
    data,
    starSummary,
    schoolPrepReminder,
    speakSchoolPrepReminder,
    openSubView,
    toggleRoutineDirectCheckin,
  } = useBuddy();
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const todayKey = getTodayDateKey();
  const approvedTasks = data.tasks.filter((t) => t.approvalStatus === 'approved');
  const approvedRoutines = data.routines.filter((r) => r.approvedByParent);

  const completedRoutinesCount = approvedRoutines.filter((r) =>
    r.completedDates.includes(todayKey)
  ).length;
  const totalRoutinesCount = Math.max(1, approvedRoutines.length);
  const progressPercent = Math.min(
    100,
    Math.round((completedRoutinesCount / totalRoutinesCount) * 100)
  );

  // Pick next uncompleted routine's linked task, or Chuẩn bị cặp sách
  const nextPendingRoutine = approvedRoutines.find(
    (r) => !r.completedDates.includes(todayKey)
  );
  const featuredTask =
    approvedTasks.find((t) => t.id === nextPendingRoutine?.linkedTaskId) ||
    approvedTasks.find(
      (t) =>
        !data.starLedger.some(
          (tx) =>
            tx.dateKey === todayKey &&
            tx.sourceType === 'task_completion' &&
            tx.sourceId === t.id
        )
    ) ||
    approvedTasks[0];

  const periods: Array<{
    key: RoutinePeriod;
    label: string;
    subtitle: string;
    timeRange: string;
    bgClass: string;
    badgeClass: string;
  }> = [
    {
      key: 'morning',
      label: 'Buổi sáng năng lượng',
      subtitle: 'Khởi đầu ngày mới tươi vui',
      timeRange: '06:30 – 08:00',
      bgClass: 'bg-[#FFF0C9]/70',
      badgeClass: 'bg-white text-amber-800',
    },
    {
      key: 'after_school',
      label: 'Sau giờ học',
      subtitle: 'Góc học tập & đồ chơi ngăn nắp',
      timeRange: '16:30 – 18:30',
      bgClass: 'bg-[#FFE4D8]/70',
      badgeClass: 'bg-white text-rose-800',
    },
    {
      key: 'evening',
      label: 'Buổi tối ấm áp',
      subtitle: 'Sẵn sàng cho ngày mai & nghe truyện',
      timeRange: '19:30 – 21:00',
      bgClass: 'bg-[#EDE7FF]/75',
      badgeClass: 'bg-white text-indigo-800',
    },
  ];

  const handleToggleRoutine = async (routineId: string) => {
    const res = await toggleRoutineDirectCheckin(routineId);
    setFeedbackToast(res.message);
    window.setTimeout(() => setFeedbackToast(null), 3500);
  };

  return (
    <div className="space-y-5 pb-6">
      {/* 1. Header & Việc hôm nay */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          <p className="text-xs font-kids font-extrabold text-[#3978F6]">
            Khám phá bằng thẻ hình minh họa ấm áp
          </p>
          <h1 className="font-kids text-2xl font-extrabold text-[#23324D]">
            Việc hôm nay của con
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openSubView({ type: 'monthly-tracker' })}
            className="min-h-[40px] px-3 py-1.5 rounded-[18px] bg-[#DDF5E8] hover:bg-[#c8ecd8] text-emerald-950 font-kids font-extrabold text-xs inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Bảng theo dõi hoạt động tháng"
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
            <span>Lịch tháng</span>
          </button>

          <button
            type="button"
            onClick={() => openSubView({ type: 'stars-detail' })}
            className="min-h-[40px] px-3.5 py-1.5 rounded-[18px] bg-[#FFF0C9] hover:bg-[#ffe5a3] text-[#23324D] font-kids font-extrabold text-sm inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span className="tabular-nums">{starSummary.monthlyStars}</span>
          </button>
        </div>
      </div>

      {feedbackToast && (
        <div className="rounded-[20px] bg-[#DDF5E8] border border-emerald-400/50 px-4 py-3 text-xs sm:text-sm font-kids font-bold text-[#23324D] flex items-center justify-between gap-2 shadow-2xs">
          <span>{feedbackToast}</span>
          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            className="text-xs underline shrink-0 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Visual Progress Hero */}
      <section className="rounded-[28px] bg-gradient-to-r from-[#DDF5E8] via-[#EAF3FF] to-[#FFF0C9] border border-[#3978F6]/12 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BuddyAvatar size="sm" mood="happy" />
            <div>
              <span className="text-[11px] font-kids font-extrabold text-[#3978F6]">
                Hành trình hôm nay
              </span>
              <h2 className="font-kids text-lg sm:text-xl font-extrabold text-[#23324D]">
                Đã xong {completedRoutinesCount}/{approvedRoutines.length} hoạt động
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openSubView({ type: 'monthly-tracker' })}
            className="px-3 py-1.5 rounded-[18px] bg-white hover:bg-[#EAF3FF] font-kids font-extrabold text-xs text-[#3978F6] shadow-2xs tabular-nums cursor-pointer"
          >
            Xem lịch tháng →
          </button>
        </div>

        <div className="w-full h-3.5 rounded-full bg-white/85 overflow-hidden p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#3978F6] to-emerald-500 transition-all duration-300"
            style={{ width: `${Math.max(10, progressPercent)}%` }}
          />
        </div>
      </section>

      {/* School Schedule Prep Reminder Banner in Activities */}
      {schoolPrepReminder && (
        <section className="rounded-[24px] bg-[#FFF0C9]/85 border border-amber-300/80 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Backpack className="w-4 h-4 text-[#3978F6]" />
              <span className="font-kids font-extrabold text-sm text-[#23324D]">
                Chuẩn bị sách vở cho {schoolPrepReminder.tomorrowDayLabel} (Nhắc {schoolPrepReminder.prepTime})
              </span>
            </div>
            <button
              type="button"
              onClick={speakSchoolPrepReminder}
              className="min-h-[32px] px-2.5 py-1 rounded-[18px] bg-white text-[#3978F6] font-kids font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Nghe</span>
            </button>
          </div>
          <p className="text-xs text-[#23324D]/85">
            <strong>Môn học:</strong> {schoolPrepReminder.subjects.join(', ')} ·{' '}
            <strong>Đồ dùng:</strong> {schoolPrepReminder.supplies.join(', ')}
          </p>
        </section>
      )}

      {/* 2. Featured Task (Large Image Card + Mini Step Preview Strip) */}
      {featuredTask && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-kids font-extrabold text-[#3978F6]">
              ★ Nhiệm vụ nổi bật tiếp theo
            </span>
            {nextPendingRoutine && (
              <span className="text-xs font-kids font-bold text-[#23324D]/65 tabular-nums">
                Hẹn lúc {nextPendingRoutine.dueTime}
              </span>
            )}
          </div>

          <div className="rounded-[30px] bg-white border border-[#3978F6]/15 p-4 sm:p-5 shadow-[0_12px_32px_rgba(57,120,246,0.08)] space-y-4">
            {/* Large Warm Storybook Action Scene */}
            <div className="relative">
              <TaskStepIllustration
                illustrationKey={featuredTask.coverIllustration}
                variant="cover"
                className="w-full h-52 sm:h-60 rounded-[24px]"
                showActionCaption
              />
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <span className="px-3 py-1 rounded-xl bg-white/95 text-[#23324D] font-kids font-extrabold text-xs shadow-2xs">
                  {featuredTask.steps.length} bước cảnh
                </span>
                <span className="px-3 py-1 rounded-xl bg-[#FFF0C9] text-amber-900 font-kids font-extrabold text-xs shadow-2xs">
                  +{featuredTask.starReward} ★
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-kids text-xl font-extrabold text-[#23324D]">
                {featuredTask.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#23324D]/75 leading-relaxed">
                {featuredTask.subtitle}
              </p>
            </div>

            {/* Visual Step Preview Strip (supports all 5 steps of Chuẩn bị cặp sách) */}
            <div
              className={`grid gap-2 ${
                featuredTask.steps.length >= 5 ? 'grid-cols-5' : 'grid-cols-4'
              }`}
            >
              {featuredTask.steps.slice(0, 5).map((st, idx) => (
                <div
                  key={st.id}
                  className="rounded-2xl bg-[#F7F9FD] p-1.5 border border-[#23324D]/6 text-center"
                >
                  <TaskStepIllustration
                    illustrationKey={st.illustrationKey}
                    className="w-full h-14 rounded-xl p-0.5"
                  />
                  <span className="block text-[10px] font-kids font-extrabold text-[#23324D]/75 mt-1 truncate">
                    Bước {idx + 1}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                openSubView({
                  type: 'guide-task',
                  taskId: featuredTask.id,
                  routineId: nextPendingRoutine?.id,
                })
              }
              className="w-full min-h-[52px] px-6 py-3 rounded-[18px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-base shadow-[0_8px_20px_rgba(57,120,246,0.25)] inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Bắt đầu theo thẻ hình</span>
            </button>
          </div>
        </section>
      )}

      {/* 3. Hoạt động theo buổi (Visual Period Cards with Large Warm Storybook Scenes) */}
      <section className="space-y-3">
        <h2 className="font-kids text-lg font-extrabold text-[#23324D] px-1">
          Hoạt động theo buổi
        </h2>

        <div className="space-y-4">
          {periods.map((period) => {
            const periodRoutines = approvedRoutines.filter((r) => r.period === period.key);
            const doneInPeriod = periodRoutines.filter((r) =>
              r.completedDates.includes(todayKey)
            ).length;

            return (
              <div
                key={period.key}
                className={`rounded-[28px] ${period.bgClass} border border-[#23324D]/8 p-4 sm:p-5 space-y-3.5`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <RoutinePeriodIllustration
                      period={period.key}
                      className="w-15 h-15 shrink-0 shadow-2xs"
                    />
                    <div>
                      <h3 className="font-kids text-base sm:text-lg font-extrabold text-[#23324D]">
                        {period.label}
                      </h3>
                      <p className="text-xs text-[#23324D]/70">
                        {period.subtitle} · <span className="tabular-nums">{period.timeRange}</span>
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-kids font-extrabold tabular-nums shadow-2xs ${period.badgeClass}`}
                  >
                    {doneInPeriod}/{periodRoutines.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {periodRoutines.map((routine) => {
                    const isDone = routine.completedDates.includes(todayKey);
                    const linkedTask = approvedTasks.find((t) => t.id === routine.linkedTaskId);

                    return (
                      <div
                        key={routine.id}
                        className="rounded-[24px] bg-white border border-[#23324D]/8 p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div
                          onClick={() => {
                            if (linkedTask) {
                              openSubView({
                                type: 'guide-task',
                                taskId: linkedTask.id,
                                routineId: routine.id,
                              });
                            } else {
                              handleToggleRoutine(routine.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (linkedTask) {
                                openSubView({
                                  type: 'guide-task',
                                  taskId: linkedTask.id,
                                  routineId: routine.id,
                                });
                              } else {
                                handleToggleRoutine(routine.id);
                              }
                            }
                          }}
                          className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="w-20 h-20 sm:w-22 sm:h-22 shrink-0">
                            <TaskStepIllustration
                              illustrationKey={
                                linkedTask?.coverIllustration || 'check-list'
                              }
                              className="w-full h-full rounded-[18px]"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[11px] font-kids font-extrabold text-[#3978F6] tabular-nums">
                              <span>{routine.dueTime}</span>
                              {isDone && (
                                <span className="text-emerald-700">
                                  · ✓ Đã hoàn thành
                                </span>
                              )}
                            </div>
                            <h4
                              className={`font-kids text-sm sm:text-base font-extrabold leading-snug mt-0.5 ${
                                isDone ? 'text-[#23324D]/60' : 'text-[#23324D]'
                              }`}
                            >
                              {routine.title}
                            </h4>
                            {linkedTask && (
                              <p className="text-[11px] text-[#23324D]/65 mt-0.5">
                                {linkedTask.steps.length} bước cảnh hướng dẫn · +{linkedTask.starReward} ★
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {linkedTask && (
                            <button
                              type="button"
                              onClick={() =>
                                openSubView({
                                  type: 'guide-task',
                                  taskId: linkedTask.id,
                                  routineId: routine.id,
                                })
                              }
                              className="min-h-[40px] px-3.5 py-1.5 rounded-[18px] bg-[#EAF3FF] hover:bg-[#3978F6] text-[#3978F6] hover:text-white font-kids font-extrabold text-xs transition-colors cursor-pointer"
                            >
                              Mở thẻ
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleRoutine(routine.id)}
                            className={`w-10 h-10 rounded-[18px] flex items-center justify-center transition-colors cursor-pointer ${
                              isDone
                                ? 'bg-emerald-500 text-white'
                                : 'bg-[#F7F9FD] hover:bg-[#DDF5E8] text-[#23324D]/45 hover:text-emerald-700'
                            }`}
                            title={isDone ? 'Đã hoàn thành hôm nay' : 'Đánh dấu hoàn thành'}
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
