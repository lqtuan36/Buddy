import React, { useState } from 'react';

/**
 * BuddyAvatar
 * Keeps the current Google AI Studio 3D robot mascot (/assets/aistudio/image_5e8ff415.png)
 * and presents it with a harmonious soft Ice Blue / Cloud White aura so it serves
 * as the visual centerpiece of the companion app.
 *
 * Visual Fidelity Upgrade:
 * - Zero "Đang nói..." text badge when speaking.
 * - Uses soft halo glow, gentle scale, and an animated 3-bar soundwave indicator when Buddy speaks.
 */

export const BUDDY_MASCOT_ASSET_PATH = '/assets/aistudio/image_5e8ff415.png';

interface BuddyAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  isSpeaking?: boolean;
  mood?: 'happy' | 'calm' | 'celebrating' | 'thinking';
  className?: string;
  showHalo?: boolean;
}

const SIZE_MAP: Record<NonNullable<BuddyAvatarProps['size']>, string> = {
  xs: 'w-10 h-10',
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
  hero: 'w-44 h-44 sm:w-52 sm:h-52',
};

export const BuddyAvatar: React.FC<BuddyAvatarProps> = ({
  size = 'md',
  isSpeaking = false,
  mood = 'happy',
  className = '',
  showHalo = true,
}) => {
  const [imgError, setImgError] = useState(false);

  const haloBg =
    mood === 'calm'
      ? 'from-[#EDE7FF] via-[#EAF3FF] to-white'
      : mood === 'celebrating'
      ? 'from-[#FFF0C9] via-[#EAF3FF] to-white'
      : 'from-[#EAF3FF] via-[#F7F9FD] to-white';

  const isAnimatedSize = size === 'lg' || size === 'xl' || size === 'hero';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${SIZE_MAP[size]} ${className}`}
      aria-label="Nhân vật robot Buddy thân thiện"
    >
      {showHalo && (
        <>
          {size === 'hero' && (
            <div
              className={`absolute -inset-4 rounded-full bg-gradient-to-b from-[#3978F6]/16 via-[#EDE7FF]/35 to-transparent blur-xl pointer-events-none transition-opacity duration-300 ${
                isSpeaking ? 'opacity-100 scale-105' : 'opacity-75'
              }`}
            />
          )}
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-b ${haloBg} shadow-[0_12px_32px_rgba(57,120,246,0.14)] border border-white/95 transition-all duration-300 ${
              isSpeaking
                ? 'scale-105 ring-4 ring-[#3978F6]/30 shadow-[0_0_28px_rgba(57,120,246,0.35)]'
                : ''
            }`}
          />
        </>
      )}

      {!imgError ? (
        <img
          src={BUDDY_MASCOT_ASSET_PATH}
          alt="Buddy – Người bạn Robot AI thân thiện"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`relative z-10 w-full h-full object-contain rounded-full ${
            size === 'hero'
              ? 'p-1.5 drop-shadow-[0_14px_24px_rgba(35,50,77,0.14)]'
              : 'p-0.5'
          } ${isAnimatedSize ? 'animate-buddy-float' : ''}`}
        />
      ) : (
        <svg
          viewBox="0 0 160 160"
          className={`relative z-10 w-full h-full p-1 ${
            isAnimatedSize ? 'animate-buddy-float' : ''
          }`}
          role="img"
          aria-label="Buddy Robot"
        >
          <defs>
            <radialGradient id="buddyHeadGrad" cx="45%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="70%" stopColor="#EAF3FF" />
              <stop offset="100%" stopColor="#C9DFFF" />
            </radialGradient>
            <linearGradient id="buddyVisorRim" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#72B4FF" />
              <stop offset="50%" stopColor="#D6B8FF" />
              <stop offset="100%" stopColor="#5AA9FF" />
            </linearGradient>
          </defs>
          <ellipse cx="80" cy="126" rx="34" ry="20" fill="url(#buddyHeadGrad)" />
          <ellipse cx="38" cy="122" rx="14" ry="9" transform="rotate(-25 38 122)" fill="url(#buddyHeadGrad)" />
          <ellipse cx="122" cy="122" rx="14" ry="9" transform="rotate(25 122 122)" fill="url(#buddyHeadGrad)" />
          <circle cx="80" cy="125" r="8" fill="none" stroke="#3978F6" strokeWidth="2.5" />
          <rect x="18" y="54" width="12" height="32" rx="6" fill="#C9DFFF" />
          <rect x="130" y="54" width="12" height="32" rx="6" fill="#C9DFFF" />
          <rect x="26" y="22" width="108" height="88" rx="44" fill="url(#buddyHeadGrad)" />
          <rect
            x="34"
            y="32"
            width="92"
            height="68"
            rx="34"
            fill="#F7F9FD"
            stroke="url(#buddyVisorRim)"
            strokeWidth="3"
          />
          <circle cx="58" cy="64" r="13" fill="#1E2942" />
          <circle cx="102" cy="64" r="13" fill="#1E2942" />
          <circle cx="54" cy="59" r="4" fill="#FFFFFF" />
          <circle cx="98" cy="59" r="4" fill="#FFFFFF" />
          <ellipse cx="52" cy="81" rx="7" ry="3.5" fill="#F49EC4" opacity="0.65" />
          <ellipse cx="108" cy="81" rx="7" ry="3.5" fill="#F49EC4" opacity="0.65" />
          <path
            d="M 71 75 Q 80 82 89 75"
            fill="none"
            stroke="#23324D"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Visual-only speaking wave indicator (NO "Đang nói..." text label) */}
      {isSpeaking && size !== 'xs' && (
        <span
          aria-hidden="true"
          className="absolute -bottom-1 right-1.5 z-20 inline-flex items-end gap-0.5 px-2 py-1 rounded-full bg-[#3978F6] shadow-[0_4px_12px_rgba(57,120,246,0.4)] border-2 border-white"
        >
          <span className="w-1 h-2 bg-white rounded-full animate-pulse" />
          <span className="w-1 h-3 bg-white rounded-full animate-bounce" />
          <span className="w-1 h-2 bg-white rounded-full animate-pulse" />
        </span>
      )}
    </div>
  );
};
