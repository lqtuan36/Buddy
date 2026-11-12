import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Star,
  Sparkles,
  PlusCircle,
} from 'lucide-react';
import { useBuddy } from '../context/BuddyContext';
import { BuddyAvatar } from './BuddyAvatar';
import { TaskStepIllustration } from './BuddyIllustrations';
import { getCurrentMonthKey, getTodayDateKey } from '../services/pointsPolicy';

interface DayCompletionSummary {
  dateKey: string;
  dayNumber: number;
  isToday: boolean;
  isFuture: boolean;
  completedTaskIds: string[];
  completedRoutineIds: string[];
  starsEarned: number;
  completionDetails: Array<{
    id: string;
    taskId?: string;
    title: string;
    timeLabel: string;
    stars: number;
    illustrationKey?: string;
  }>;
}

const WEEKDAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const BuddyMonthlyTrackerView: React.FC<{
  initialFilterTaskId?: string;
  onBack: () => void;
}> = ({ initialFilterTaskId, onBack }) => {
  const { data, confirmOfflineActivityForDate, openSubView } = useBuddy();

  const todayKey = getTodayDateKey();
  const currentMonthKey = getCurrentMonthKey(); // YYYY-MM

  const [selectedTaskFilter, setSelectedTaskFilter] = useState<string>(
    initialFilterTaskId || 'all'
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const approvedTasks = data.tasks.filter((t) => t.approvalStatus === 'approved');

  // Build calendar cells for currentMonthKey
  const { leadingEmptyCount, daysData, activeDaysCount, monthlyCompletedActionsCount } =
    useMemo(() => {
      const [yearStr, monthStr] = currentMonthKey.split('-');
      const year = Number(yearStr) || 2026;
      const monthIndex = (Number(monthStr) || 11) - 1;

      const firstDay = new Date(year, monthIndex, 1);
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      // Convert JS Sunday=0..Saturday=6 into Monday=0..Sunday=6
      const leadingEmpty = (firstDay.getDay() + 6) % 7;

      const summaries: DayCompletionSummary[] = [];
      let activeDays = 0;
      let totalActions = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, '0');
        const dateKey = `${currentMonthKey}-${dayStr}`;
        const isToday = dateKey === todayKey;
        const isFuture = dateKey > todayKey;

        // 1. TaskRuns on this date
        const runsForDate = data.taskRuns.filter(
          (run) =>
            run.dateKey === dateKey &&
            run.status === 'completed' &&
            (selectedTaskFilter === 'all' || run.taskId === selectedTaskFilter)
        );

        // 2. Routines completed on this date
        const routinesForDate = data.routines.filter(
          (r) =>
            r.approvedByParent &&
            r.completedDates.includes(dateKey) &&
            (selectedTaskFilter === 'all' || r.linkedTaskId === selectedTaskFilter)
        );

        // 3. Stars earned on this date
        const starsForDate = data.starLedger.filter((tx) => {
          if (tx.dateKey !== dateKey) return false;
          if (selectedTaskFilter === 'all') return true;
          return tx.sourceId === selectedTaskFilter;
        });

        const starsEarned = starsForDate.reduce((sum, tx) => sum + tx.amount, 0);

        const detailsMap = new Map<
          string,
          {
            id: string;
            taskId?: string;
            title: string;
            timeLabel: string;
            stars: number;
            illustrationKey?: string;
          }
        >();

        for (const run of runsForDate) {
          const matchedTask = data.tasks.find((t) => t.id === run.taskId);
          const timeStr = run.completedAt
            ? new Date(run.completedAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '19:45';
          detailsMap.set(`task-${run.taskId}`, {
            id: run.id,
            taskId: run.taskId,
            title: matchedTask?.title || 'Nhiệm vụ hoàn thành',
            timeLabel: `Hoàn thành lúc ${timeStr}`,
            stars: run.starsAwarded || matchedTask?.starReward || 2,
            illustrationKey: matchedTask?.coverIllustration,
          });
        }

        for (const routine of routinesForDate) {
          const key = `task-${routine.linkedTaskId}`;
          if (!detailsMap.has(key)) {
            const matchedTask = data.tasks.find((t) => t.id === routine.linkedTaskId);
            detailsMap.set(key, {
              id: routine.id,
              taskId: routine.linkedTaskId,
              title: routine.title,
              timeLabel: `Đúng lịch hẹn ${routine.dueTime}`,
              stars: data.pointsPolicy.routineBonusStars,
              illustrationKey: matchedTask?.coverIllustration,
            });
          }
        }

        for (const tx of starsForDate) {
          if (tx.sourceType === 'task_completion') {
            const key = `task-${tx.sourceId}`;
            if (!detailsMap.has(key)) {
              const matchedTask = data.tasks.find((t) => t.id === tx.sourceId);
              const timeStr = tx.createdAt
                ? new Date(tx.createdAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '19:00';
              detailsMap.set(key, {
                id: tx.id,
                taskId: tx.sourceId,
                title: matchedTask?.title || tx.title,
                timeLabel: `Hoàn thành lúc ${timeStr}`,
                stars: tx.amount,
                illustrationKey: matchedTask?.coverIllustration,
              });
            }
          } else if (selectedTaskFilter === 'all') {
            detailsMap.set(`tx-${tx.id}`, {
              id: tx.id,
              title: tx.title,
              timeLabel: tx.note,
              stars: tx.amount,
            });
          }
        }

        const completionDetails = Array.from(detailsMap.values());
        const completedTaskIds = Array.from(
          new Set([
            ...runsForDate.map((r) => r.taskId),
            ...routinesForDate.map((r) => r.linkedTaskId),
          ])
        );

        if (completionDetails.length > 0) {
          activeDays++;
          totalActions += completionDetails.length;
        }

        summaries.push({
          dateKey,
          dayNumber: d,
          isToday,
          isFuture,
          completedTaskIds,
          completedRoutineIds: routinesForDate.map((r) => r.id),
          starsEarned,
          completionDetails,
        });
      }

      return {
        leadingEmptyCount: leadingEmpty,
        daysData: summaries,
        activeDaysCount: activeDays,
        monthlyCompletedActionsCount: totalActions,
      };
    }, [
      currentMonthKey,
      todayKey,
      data.taskRuns,
      data.routines,
      data.starLedger,
      data.tasks,
      data.pointsPolicy.routineBonusStars,
      selectedTaskFilter,
    ]);

  const selectedDaySummary =
    daysData.find((d) => d.dateKey === selectedDateKey) ||
    daysData.find((d) => d.isToday) ||
    daysData[0];

  const handleConfirmOfflineTask = async (taskId: string) => {
    if (!selectedDaySummary || selectedDaySummary.isFuture) return;
    const res = await confirmOfflineActivityForDate(taskId, selectedDaySummary.dateKey);
    setFeedbackBanner(res.message);
    window.setTimeout(() => setFeedbackBanner(null), 4000);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-[16px] bg-white hover:bg-[#EAF3FF] border border-[#23324D]/8 text-xs sm:text-sm font-kids font-bold text-[#23324D] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>

        <div className="inline-flex items-center gap-1.5 text-xs font-kids font-extrabold text-[#3978F6] bg-[#EAF3FF] px-3 py-1.5 rounded-xl">
          <Calendar className="w-3.5 h-3.5" />
          <span>Tháng {currentMonthKey}</span>
        </div>
      </div>

      {/* Hero Summary Card */}
      <section className="rounded-[28px] bg-gradient-to-br from-[#DDF5E8] via-[#EAF3FF] to-[#FFF0C9] border border-[#3978F6]/15 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BuddyAvatar size="sm" mood="celebrating" />
            <div>
              <span className="text-[11px] font-kids font-extrabold text-[#3978F6]">
                Bảng theo dõi thói quen tháng
              </span>
              <h1 className="font-kids text-lg sm:text-xl font-extrabold text-[#23324D]">
                Hành trình của {data.profile.displayName}
              </h1>
            </div>
          </div>

          <div className="text-right">
            <p className="font-kids text-xl font-extrabold text-emerald-700 tabular-nums">
              {activeDaysCount} ngày
            </p>
            <p className="text-[11px] font-semibold text-[#23324D]/70">
              có việc tốt ({monthlyCompletedActionsCount} việc)
            </p>
          </div>
        </div>
      </section>

      {feedbackBanner && (
        <div className="rounded-[18px] bg-[#DDF5E8] border border-emerald-400/60 px-4 py-3 text-xs sm:text-sm font-kids font-bold text-[#23324D] flex items-center justify-between gap-2">
          <span>✓ {feedbackBanner}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs underline cursor-pointer shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Habit / Task Filter Segmented Bar */}
      <section className="space-y-2">
        <p className="text-xs font-kids font-bold text-[#23324D]/70 px-1">
          Lọc theo từng thói quen của con:
        </p>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedTaskFilter('all')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-kids font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              selectedTaskFilter === 'all'
                ? 'bg-[#3978F6] text-white shadow-2xs'
                : 'bg-white text-[#23324D]/75 hover:bg-[#EAF3FF] border border-[#23324D]/8'
            }`}
          >
            Tất cả thói quen
          </button>
          {approvedTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => setSelectedTaskFilter(task.id)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-kids font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                selectedTaskFilter === task.id
                  ? 'bg-[#3978F6] text-white shadow-2xs'
                  : 'bg-white text-[#23324D]/75 hover:bg-[#EAF3FF] border border-[#23324D]/8'
              }`}
            >
              {task.title}
            </button>
          ))}
        </div>
      </section>

      {/* Monthly Calendar Grid */}
      <section className="rounded-[26px] bg-white border border-[#23324D]/8 p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {WEEKDAY_HEADERS.map((label) => (
            <div
              key={label}
              className="text-[11px] font-kids font-extrabold text-[#23324D]/55 py-1"
            >
              {label}
            </div>
          ))}

          {Array.from({ length: leadingEmptyCount }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-12 rounded-2xl bg-transparent" />
          ))}

          {daysData.map((day) => {
            const hasCompleted = day.completionDetails.length > 0;
            const isSelected = selectedDaySummary?.dateKey === day.dateKey;

            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => setSelectedDateKey(day.dateKey)}
                className={`h-12 rounded-2xl flex flex-col items-center justify-center relative transition-all cursor-pointer tabular-nums ${
                  isSelected
                    ? 'bg-[#3978F6] text-white shadow-sm scale-[1.03]'
                    : hasCompleted
                    ? 'bg-[#DDF5E8] text-emerald-950 hover:bg-[#c8ecd8]'
                    : day.isToday
                    ? 'bg-[#FFF0C9] text-[#23324D] border border-amber-400'
                    : 'bg-[#F7F9FD] text-[#23324D]/75 hover:bg-[#EAF3FF]/60'
                }`}
              >
                <span className="font-kids font-extrabold text-xs leading-none">
                  {day.dayNumber}
                </span>
                {hasCompleted ? (
                  <span
                    className={`mt-1 text-[10px] font-kids font-extrabold leading-none ${
                      isSelected ? 'text-[#FFF0C9]' : 'text-emerald-700'
                    }`}
                  >
                    ★ {day.completionDetails.length}
                  </span>
                ) : day.isToday ? (
                  <span className="mt-1 text-[9px] font-bold text-amber-800 leading-none">
                    Hôm nay
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#23324D]/8 text-[11px] text-[#23324D]/65">
          <span>💡 Chạm vào từng ngày trên lịch để xem việc đã làm và số sao nhận được.</span>
          <span className="font-bold text-emerald-700">Không trừ sao những ngày nghỉ</span>
        </div>
      </section>

      {/* Selected Day Inspection Panel */}
      {selectedDaySummary && (
        <section className="rounded-[26px] bg-white border border-[#3978F6]/15 p-4 sm:p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-kids font-extrabold text-[#3978F6]">
                Chi tiết ngày {selectedDaySummary.dateKey}
              </span>
              <h2 className="font-kids text-lg font-extrabold text-[#23324D]">
                {selectedDaySummary.completionDetails.length > 0
                  ? `Đã hoàn thành ${selectedDaySummary.completionDetails.length} hoạt động`
                  : 'Chưa ghi nhận hoạt động nào trong ngày này'}
              </h2>
            </div>

            {selectedDaySummary.starsEarned > 0 && (
              <div className="px-3 py-1.5 rounded-xl bg-[#FFF0C9] font-kids font-extrabold text-xs text-amber-900 inline-flex items-center gap-1 tabular-nums">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <span>+{selectedDaySummary.starsEarned} sao</span>
              </div>
            )}
          </div>

          {selectedDaySummary.completionDetails.length > 0 ? (
            <div className="space-y-2.5">
              {selectedDaySummary.completionDetails.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[20px] bg-[#F7F9FD] border border-[#23324D]/8 p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.illustrationKey ? (
                      <div className="w-14 h-14 shrink-0">
                        <TaskStepIllustration
                          illustrationKey={
                            item.illustrationKey as Parameters<
                              typeof TaskStepIllustration
                            >[0]['illustrationKey']
                          }
                          className="w-full h-full rounded-[14px] p-1"
                        />
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-[#DDF5E8] flex items-center justify-center text-emerald-700 shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className="font-kids font-extrabold text-sm text-[#23324D] truncate">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[#23324D]/65 inline-flex items-center gap-1 mt-0.5 tabular-nums">
                        <Clock className="w-3 h-3 text-[#3978F6]" />
                        <span>{item.timeLabel}</span>
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-xl bg-[#DDF5E8] text-emerald-900 font-kids font-extrabold text-xs shrink-0 tabular-nums">
                    ✓ Đã xong
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#23324D]/70 bg-[#F7F9FD] rounded-2xl p-3.5">
              {selectedDaySummary.isFuture
                ? 'Ngày này chưa tới. Hẹn con cùng Buddy thực hiện việc tốt vào ngày đó nhé!'
                : 'Nếu con đã thực hiện việc tốt ở ngoài ứng dụng trong ngày này, con hoặc ba mẹ có thể bấm xác nhận bên dưới nhé.'}
            </p>
          )}

          {/* Out-of-app / Offline Activity Confirmation (Only for uncompleted tasks on past/today dates) */}
          {!selectedDaySummary.isFuture && (
            <div className="pt-2 border-t border-[#23324D]/8 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-kids font-extrabold text-[#23324D]/80">
                <Sparkles className="w-3.5 h-3.5 text-[#3978F6]" />
                <span>Ghi nhận việc con đã làm ngoài ứng dụng ({selectedDaySummary.dateKey}):</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {approvedTasks.map((task) => {
                  const alreadyDoneOnSelectedDay =
                    selectedDaySummary.completedTaskIds.includes(task.id);

                  if (alreadyDoneOnSelectedDay) {
                    return (
                      <div
                        key={task.id}
                        className="min-h-[40px] px-3 py-2 rounded-xl bg-[#DDF5E8]/60 text-emerald-900 text-xs font-kids font-bold flex items-center justify-between"
                      >
                        <span className="truncate">{task.title}</span>
                        <span className="shrink-0">✓ Đã tự động đồng bộ</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() =>
                        selectedDaySummary.isToday
                          ? openSubView({ type: 'guide-task', taskId: task.id })
                          : handleConfirmOfflineTask(task.id)
                      }
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-[#EAF3FF] hover:bg-[#3978F6] text-[#23324D] hover:text-white text-xs font-kids font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <span className="truncate">{task.title}</span>
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>{selectedDaySummary.isToday ? 'Làm ngay' : 'Xác nhận'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
