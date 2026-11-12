import React, { useState } from 'react';
import {
  ArrowLeft,
  Star,
  Gift,
  Sparkles,
  ShieldCheck,
  Heart,
  Volume2,
} from 'lucide-react';
import { useBuddy } from '../context/BuddyContext';
import { BuddyAvatar } from './BuddyAvatar';
import { getCurrentMonthKey } from '../services/pointsPolicy';
import { voiceService } from '../services/voiceService';

/**
 * 4) BUDDY STARS VIEW (Mobile Companion Layout)
 */
export const BuddyStarsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { data, starSummary, openSubView } = useBuddy();

  const handleListenSummary = () => {
    const msg = `${data.profile.displayName} ơi! Hôm nay con nhận được ${starSummary.dailyStars} ngôi sao, và trong tháng này con đã có ${starSummary.monthlyStars} ngôi sao nỗ lực. Buddy rất tự hào về con!`;
    voiceService.speak(msg, data.voicePreference, 'celebration');
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-[18px] bg-white hover:bg-[#EAF3FF] border border-[#23324D]/8 text-xs sm:text-sm font-kids font-bold text-[#23324D] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Trang chủ</span>
        </button>

        <button
          type="button"
          onClick={() => openSubView({ type: 'rewards-wheel' })}
          className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-[18px] bg-[#FFE4D8] hover:bg-[#ffd5c2] text-[#23324D] font-kids font-bold text-xs transition-colors cursor-pointer"
        >
          <Gift className="w-4 h-4 text-rose-600" />
          <span>Vòng quay Quà tặng</span>
        </button>
      </div>

      {/* Hero Star Card */}
      <section className="rounded-[28px] bg-gradient-to-b from-[#FFF0C9] via-[#FFF9E6] to-white border border-amber-300/60 p-5 text-center shadow-xs space-y-4">
        <div className="flex flex-col items-center">
          <BuddyAvatar size="lg" mood="celebrating" />
          <button
            type="button"
            onClick={handleListenSummary}
            className="mt-2.5 inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-[18px] bg-white hover:bg-[#EAF3FF] text-[#3978F6] text-xs font-kids font-bold border border-[#3978F6]/15 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Nghe Buddy khen con</span>
          </button>
        </div>

        <div>
          <h1 className="font-kids text-2xl font-extrabold text-[#23324D]">
            Ngôi sao của {data.profile.displayName}
          </h1>
          <p className="text-xs text-[#23324D]/75 mt-1">
            Mỗi ngôi sao là lời khen cho sự cố gắng của con!
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-[20px] bg-white p-3 border border-amber-200/80">
            <p className="text-[11px] text-[#23324D]/65">Hôm nay</p>
            <p className="font-kids text-xl font-extrabold text-amber-600 tabular-nums mt-0.5">
              +{starSummary.dailyStars} ★
            </p>
          </div>

          <div className="rounded-[20px] bg-white p-3 border border-amber-200/80">
            <p className="text-[11px] text-[#23324D]/65">Tháng này</p>
            <p className="font-kids text-xl font-extrabold text-[#3978F6] tabular-nums mt-0.5">
              {starSummary.monthlyStars} ★
            </p>
          </div>

          <div className="rounded-[20px] bg-white p-3 border border-amber-200/80">
            <p className="text-[11px] text-[#23324D]/65">Vòng quay</p>
            <p className="font-kids text-lg font-extrabold text-emerald-700 tabular-nums mt-0.5">
              {starSummary.monthlyStars}/{starSummary.threshold} ★
            </p>
          </div>
        </div>
      </section>

      {/* Star Activity History */}
      <section className="rounded-[24px] bg-white border border-[#23324D]/8 p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <h2 className="font-kids text-lg font-extrabold text-[#23324D]">
            Nhật ký ngôi sao ({data.starLedger.length})
          </h2>
          <span className="text-[11px] text-[#23324D]/60">Không trừ sao</span>
        </div>

        <div className="divide-y divide-[#23324D]/8">
          {data.starLedger.map((tx) => (
            <div
              key={tx.id}
              className="py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FFF0C9] flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                  <Star className="w-4 h-4 fill-amber-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-kids font-bold text-sm text-[#23324D] truncate">
                    {tx.title}
                  </h3>
                  <p className="text-xs text-[#23324D]/70 line-clamp-1">{tx.note}</p>
                  <p className="text-[10px] text-[#23324D]/50 tabular-nums mt-0.5">
                    {tx.dateKey}
                  </p>
                </div>
              </div>

              <span className="font-kids font-extrabold text-sm text-amber-600 tabular-nums shrink-0">
                +{tx.amount} ★
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

/**
 * 5) BUDDY REWARDS WHEEL VIEW (v1.4 Section C.1–C.3)
 * - Monthly threshold: 50 stars (auto-unlocked when monthlyStars >= 50, 1 spin/month, never deducts stars)
 * - Center Gift Box IS the Spin button ("Quay"); no separate spin button below the wheel
 * - Exact slice rotation alignment so the top pointer lands on the won reward slice
 * - Hides "Danh sách quà gia đình" in child UI while preserving parent rewards
 */
export const RewardWheelView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { data, starSummary, spinRewardWheel, openSubView } = useBuddy();
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [spinError, setSpinError] = useState<string | null>(null);

  const cycleMonth = getCurrentMonthKey();
  const approvedRewards = data.rewards.filter((r) => r.approvedByParent && r.active);
  const currentMonthSpin = data.rewardSpins.find(
    (s) => s.childId === data.profile.id && s.cycleMonth === cycleMonth
  );

  const hasEnoughApprovedRewards = approvedRewards.length >= 4;
  const isWheelUnlocked = starSummary.wheelEligible && hasEnoughApprovedRewards;

  const canSpinNow =
    !currentMonthSpin &&
    isWheelUnlocked &&
    !isSpinning;

  // Hide spin result card while wheel animation is still in progress
  const visibleSpinResult = !isSpinning ? currentMonthSpin : undefined;

  const handleCenterGiftSpin = async () => {
    if (isSpinning) return;
    setSpinError(null);

    if (currentMonthSpin) {
      return;
    }

    if (!hasEnoughApprovedRewards) {
      setSpinError(
        'Ba mẹ cần bật phê duyệt ít nhất 4 phần quà trong mục Buddy Parents trước khi quay nhé!'
      );
      return;
    }

    if (!starSummary.wheelEligible) {
      setSpinError(
        `Con cần đủ ${starSummary.threshold} ★ trong tháng để mở khóa vòng quay (hiện có ${starSummary.monthlyStars} ★).`
      );
      return;
    }

    setIsSpinning(true);

    const res = await spinRewardWheel();
    if (!res.ok || !res.spin) {
      setIsSpinning(false);
      setSpinError(res.error || 'Chưa thể quay thưởng lúc này.');
      return;
    }

    // Calculate exact slice angle so the top pointer (0 deg) lands on the center of the won reward slice
    const totalSlices = Math.max(1, approvedRewards.length);
    const anglePerSlice = 360 / totalSlices;
    const wonIdx = Math.max(
      0,
      approvedRewards.findIndex((r) => r.id === res.spin?.rewardId)
    );
    const sliceCenterDeg = wonIdx * anglePerSlice + anglePerSlice / 2;
    const currentMod = ((wheelRotation % 360) + 360) % 360;
    const targetMod = (360 - (sliceCenterDeg % 360)) % 360;
    const deltaMod = (targetMod - currentMod + 360) % 360;
    const nextAngle = wheelRotation + 1440 + deltaMod;

    setWheelRotation(nextAngle);

    window.setTimeout(() => {
      setIsSpinning(false);
    }, 1850);
  };

  const SLICE_COLORS = ['#EAF3FF', '#EDE7FF', '#DDF5E8', '#FFF0C9', '#FFE4D8', '#D9ECFF'];

  return (
    <div className="space-y-4 pb-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-[18px] bg-white hover:bg-[#EAF3FF] border border-[#23324D]/8 text-xs sm:text-sm font-kids font-bold text-[#23324D] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Trang chủ</span>
        </button>

        <span className="inline-flex items-center gap-1 text-xs font-kids font-bold text-rose-800 bg-[#FFE4D8] px-3 py-1.5 rounded-[18px]">
          <Heart className="w-3.5 h-3.5 text-rose-500" />
          <span>Vòng quay tháng {cycleMonth}</span>
        </span>
      </div>

      {/* Main Wheel Companion Card */}
      <section className="rounded-[28px] bg-white border border-[#23324D]/8 p-5 text-center shadow-xs space-y-4">
        <div>
          <h1 className="font-kids text-xl sm:text-2xl font-extrabold text-[#23324D]">
            Vòng quay Quà của con
          </h1>
          <p className="text-xs text-[#23324D]/70 mt-1">
            Tích lũy đủ {starSummary.threshold} ★ trong tháng để mở 1 lượt quay kỷ niệm (Không trừ sao)
          </p>
        </div>

        {/* Wheel Visual with Center Gift Box as the ONLY Spin Button */}
        <div className="flex flex-col items-center py-2">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            {/* Top Pointer */}
            <div
              data-testid="wheel-top-pointer"
              className="absolute -top-3 z-20 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-[#3978F6] drop-shadow-xs"
            />

            <div
              data-testid="reward-wheel-disc"
              data-rotation={wheelRotation}
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transition: isSpinning
                  ? 'transform 1.8s cubic-bezier(0.16, 1, 0.3, 1)'
                  : 'none',
              }}
              className="w-full h-full rounded-full border-8 border-[#EAF3FF] shadow-md overflow-hidden relative bg-[#F7F9FD]"
            >
              {hasEnoughApprovedRewards ? (
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  {approvedRewards.map((reward, index) => {
                    const total = approvedRewards.length;
                    const anglePerSlice = 360 / total;
                    const startAngle = index * anglePerSlice;
                    const endAngle = startAngle + anglePerSlice;
                    const startRad = ((startAngle - 90) * Math.PI) / 180;
                    const endRad = ((endAngle - 90) * Math.PI) / 180;
                    const x1 = 100 + 100 * Math.cos(startRad);
                    const y1 = 100 + 100 * Math.sin(startRad);
                    const x2 = 100 + 100 * Math.cos(endRad);
                    const y2 = 100 + 100 * Math.sin(endRad);
                    const largeArc = anglePerSlice > 180 ? 1 : 0;
                    const d = `M 100 100 L ${x1} ${y1} A 100 100 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    const midAngle = startAngle + anglePerSlice / 2;
                    const midRad = ((midAngle - 90) * Math.PI) / 180;
                    const tx = 100 + 62 * Math.cos(midRad);
                    const ty = 100 + 62 * Math.sin(midRad);

                    return (
                      <g
                        key={reward.id}
                        data-slice-index={index}
                        data-reward-id={reward.id}
                      >
                        <path
                          d={d}
                          fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                        <text
                          x={tx}
                          y={ty}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#23324D"
                          fontSize="8.5"
                          fontWeight="bold"
                        >
                          Quà {index + 1}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="w-full h-full flex items-center justify-center p-8 text-xs font-kids font-bold text-[#5C6F8C]">
                  Chờ Ba Mẹ duyệt đủ 4 món quà
                </div>
              )}
            </div>

            {/* Center Gift Box Spin Button (Special Circular Button in Center of Wheel) */}
            <button
              type="button"
              data-testid="wheel-center-spin-button"
              disabled={!canSpinNow}
              onClick={handleCenterGiftSpin}
              aria-label={
                currentMonthSpin && !isSpinning
                  ? 'Đã quay thưởng tháng này'
                  : !hasEnoughApprovedRewards
                  ? 'Chưa đủ 4 quà được duyệt'
                  : !starSummary.wheelEligible
                  ? `Đang khóa, cần đủ ${starSummary.threshold} sao`
                  : 'Bấm hộp quà để Quay thưởng'
              }
              className={`absolute z-10 w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center shadow-md transition-transform ${
                canSpinNow
                  ? 'bg-[#3978F6] hover:bg-[#2964DF] border-white text-white cursor-pointer active:scale-95 animate-pulse'
                  : currentMonthSpin && !isSpinning
                  ? 'bg-[#DDF5E8] border-emerald-500 text-emerald-900 cursor-default'
                  : 'bg-white border-amber-400 text-[#23324D] cursor-not-allowed'
              }`}
            >
              {isSpinning ? (
                <>
                  <Sparkles className="w-5 h-5 animate-spin text-[#FFF0C9]" />
                  <span className="font-kids font-extrabold text-[10px] mt-0.5">
                    Đang quay
                  </span>
                </>
              ) : currentMonthSpin ? (
                <>
                  <Gift className="w-5 h-5 text-emerald-700" />
                  <span className="font-kids font-extrabold text-[10px] mt-0.5">
                    Đã quay
                  </span>
                </>
              ) : !hasEnoughApprovedRewards ? (
                <>
                  <Gift className="w-5 h-5 text-amber-600" />
                  <span className="font-kids font-extrabold text-[9px] mt-0.5 leading-tight px-1">
                    Chờ đủ quà
                  </span>
                </>
              ) : !starSummary.wheelEligible ? (
                <>
                  <Gift className="w-5 h-5 text-amber-600 opacity-75" />
                  <span className="font-kids font-extrabold text-[10px] text-amber-900 mt-0.5 tabular-nums">
                    🔒 {starSummary.monthlyStars}/{starSummary.threshold}★
                  </span>
                </>
              ) : (
                <>
                  <Gift className="w-6 h-6 text-[#FFF0C9]" />
                  <span className="font-kids font-extrabold text-xs tracking-wide mt-0.5">
                    Quay
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Short Guidance / Status Box */}
        {!hasEnoughApprovedRewards ? (
          <div className="rounded-[20px] bg-rose-50 border border-rose-200 p-3.5 text-xs font-kids font-bold text-rose-800">
            Hiện mới có {approvedRewards.length}/4 món quà được duyệt. Ba mẹ hãy bật ít nhất 4 phần quà trong mục Buddy Parents trước khi quay nhé!
          </div>
        ) : visibleSpinResult ? (
          <div
            data-testid="wheel-win-card"
            className="rounded-[22px] bg-gradient-to-br from-[#DDF5E8] via-[#EAFBF1] to-[#FFF0C9]/50 border-2 border-emerald-400/70 p-4 text-center space-y-2.5 shadow-2xs"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-emerald-800 text-xs font-kids font-extrabold shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {visibleSpinResult.status === 'confirmed'
                  ? '✓ Ba mẹ đã xác nhận trao quà'
                  : '⏳ Đang chờ ba mẹ xác nhận'}
              </span>
            </div>
            <h2 className="font-kids text-lg sm:text-xl font-extrabold text-[#23324D]">
              🎁 Chúc mừng! Con nhận được {visibleSpinResult.rewardTitle}
            </h2>
            {visibleSpinResult.status === 'pending_parent_confirmation' && (
              <button
                type="button"
                onClick={() => openSubView({ type: 'parent-dashboard' })}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-[18px] bg-[#23324D] hover:bg-[#182338] text-white text-xs sm:text-sm font-kids font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Mời ba mẹ xác nhận món quà</span>
              </button>
            )}
          </div>
        ) : !starSummary.wheelEligible ? (
          <div className="rounded-[20px] bg-[#FFF0C9]/85 border border-amber-300/70 p-3.5 text-xs text-[#23324D] space-y-1">
            <div className="flex items-center justify-between font-kids font-extrabold text-sm">
              <span>🔒 Vòng quay đang khóa</span>
              <span className="tabular-nums text-[#3978F6]">
                {starSummary.monthlyStars} / {starSummary.threshold} ★
              </span>
            </div>
            <p className="text-xs text-[#23324D]/80 text-left">
              Con cần tích lũy thêm <strong>{starSummary.starsRemainingForWheel} ngôi sao</strong> nữa trong tháng này để hộp quà ở giữa vòng quay tự động mở khóa nhé!
            </p>
          </div>
        ) : (
          <div className="rounded-[20px] bg-[#EAF3FF] border border-[#3978F6]/25 p-3.5 text-xs font-kids font-bold text-[#23324D]">
            ✨ Con đã đủ {starSummary.monthlyStars}/{starSummary.threshold} ★! Hãy chạm vào <strong>Hộp quà "Quay"</strong> ở chính giữa vòng quay để nhận quà tháng này nhé!
          </div>
        )}

        {spinError && (
          <div className="rounded-[18px] bg-rose-50 border border-rose-200 p-3 text-xs font-kids font-bold text-rose-700">
            {spinError}
          </div>
        )}
      </section>
    </div>
  );
};

