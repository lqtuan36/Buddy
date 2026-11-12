import { PointsPolicy, StarSourceType, StarTransaction } from '../types/domain';

/**
 * Centralized Points & Star Policy Module
 * - No negative stars
 * - No streak punishment
 * - No rank comparisons
 * - Strict idempotency key check to prevent duplicate awards for the same eligible action
 */

export const DEFAULT_POINTS_POLICY: PointsPolicy = {
  taskCompletionStars: 2,
  routineBonusStars: 1,
  storyReflectionStars: 1,
  parentPraiseStars: 2,
  monthlyWheelThresholdStars: 50,
  maxDailyTaskAwardsPerTask: 1,
};

export function getTodayDateKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function buildIdempotencyKey(
  sourceType: StarSourceType,
  sourceId: string,
  dateKey: string = getTodayDateKey()
): string {
  return `${sourceType}:${sourceId}:${dateKey}`;
}

export function canAwardStars(
  ledger: StarTransaction[],
  idempotencyKey: string
): { allowed: boolean; reason?: string } {
  const duplicate = ledger.some((entry) => entry.idempotencyKey === idempotencyKey);
  if (duplicate) {
    return {
      allowed: false,
      reason: 'Hôm nay con đã nhận ngôi sao cho hoạt động này rồi! Buddy vẫn rất tự hào vì con chăm chỉ làm lại nhé!',
    };
  }
  return { allowed: true };
}

export function createStarAward(params: {
  childId: string;
  sourceType: StarSourceType;
  sourceId: string;
  title: string;
  note: string;
  policy: PointsPolicy;
  customAmount?: number;
  dateKey?: string;
}): StarTransaction {
  const dateKey = params.dateKey || getTodayDateKey();
  const monthKey = dateKey.slice(0, 7);
  const idempotencyKey = buildIdempotencyKey(params.sourceType, params.sourceId, dateKey);

  let rawAmount = params.policy.taskCompletionStars;
  if (params.sourceType === 'routine_checkin') {
    rawAmount = params.policy.routineBonusStars;
  } else if (params.sourceType === 'story_reflection') {
    rawAmount = params.policy.storyReflectionStars;
  } else if (params.sourceType === 'parent_encouragement') {
    rawAmount = params.policy.parentPraiseStars;
  }
  if (typeof params.customAmount === 'number') {
    rawAmount = params.customAmount;
  }

  // Enforce positive stars only (> 0)
  const safeAmount = Math.max(1, Math.min(5, Math.round(rawAmount)));

  return {
    id: `star-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    childId: params.childId,
    dateKey,
    monthKey,
    amount: safeAmount,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    idempotencyKey,
    title: params.title,
    note: params.note,
    createdAt: new Date().toISOString(),
  };
}

export function calculateStarSummary(
  ledger: StarTransaction[],
  policy: PointsPolicy,
  todayKey: string = getTodayDateKey(),
  monthKey: string = getCurrentMonthKey()
) {
  const dailyStars = ledger
    .filter((tx) => tx.dateKey === todayKey && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const monthlyStars = ledger
    .filter((tx) => tx.monthKey === monthKey && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalStars = ledger
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const wheelEligible = monthlyStars >= policy.monthlyWheelThresholdStars;
  const starsRemainingForWheel = Math.max(0, policy.monthlyWheelThresholdStars - monthlyStars);

  return {
    dailyStars,
    monthlyStars,
    totalStars,
    wheelEligible,
    starsRemainingForWheel,
    threshold: policy.monthlyWheelThresholdStars,
  };
}
