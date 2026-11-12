/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Home,
  CheckSquare,
  Compass,
  UserRound,
  Sparkles,
  X,
} from 'lucide-react';
import { BuddyProvider, useBuddy, ActiveTab } from './context/BuddyContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KidsHomeView } from './components/KidsHomeView';
import { BuddyChatView, FloatingBuddyChat } from './components/BuddyChatView';
import {
  BuddyActivitiesView,
  BuddyTaskStepRunner,
} from './components/BuddyGuideAndRoutineView';
import { BuddyGrowthJourneyView } from './components/BuddyGrowthJourneyView';
import {
  BuddyStarsView,
  RewardWheelView,
} from './components/BuddyStarsAndRewardsView';
import { BuddyMonthlyTrackerView } from './components/BuddyMonthlyTrackerView';
import {
  BuddyStoryLibraryView,
  StoryPlayerView,
} from './components/BuddyStoryView';
import {
  ChildProfileOverviewView,
  MyBuddySettingsView,
  ParentDashboardView,
} from './components/MyBuddyAndParentsView';

/**
 * v1.4 MAIN 4-TAB NAVIGATION (MOBILE & TABLET COMPANION):
 * Trang chủ | Hoạt động | Hành trình | Của con
 * (Buddy Chat is a persistent Floating Assistant icon at bottom-right)
 */
const NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'home', label: 'Trang chủ', icon: Home },
  { id: 'activities', label: 'Hoạt động', icon: CheckSquare },
  { id: 'journey', label: 'Hành trình', icon: Compass },
  { id: 'profile', label: 'Của con', icon: UserRound },
];

const BuddyShell: React.FC = () => {
  const {
    activeTab,
    subView,
    celebration,
    navigateTab,
    openSubView,
    closeSubView,
    dismissCelebration,
  } = useBuddy();

  const renderMainContent = () => {
    if (subView.type === 'guide-task') {
      return (
        <BuddyTaskStepRunner
          taskId={subView.taskId}
          routineId={subView.routineId}
          onBack={closeSubView}
        />
      );
    }

    if (subView.type === 'monthly-tracker') {
      return (
        <BuddyMonthlyTrackerView
          initialFilterTaskId={subView.filterTaskId}
          onBack={closeSubView}
        />
      );
    }

    if (subView.type === 'stars-detail') {
      return <BuddyStarsView onBack={closeSubView} />;
    }

    if (subView.type === 'rewards-wheel') {
      return <RewardWheelView onBack={closeSubView} />;
    }

    if (subView.type === 'story-list') {
      return (
        <BuddyStoryLibraryView
          onSelectStory={(storyId) =>
            openSubView({ type: 'story-detail', storyId })
          }
          onBack={closeSubView}
        />
      );
    }

    if (subView.type === 'story-detail') {
      return (
        <StoryPlayerView
          storyId={subView.storyId}
          onSelectStory={(nextStoryId) =>
            openSubView({ type: 'story-detail', storyId: nextStoryId })
          }
          onBack={() => openSubView({ type: 'story-list' })}
        />
      );
    }

    if (subView.type === 'voice-settings') {
      return <MyBuddySettingsView onBack={closeSubView} />;
    }

    if (subView.type === 'parent-dashboard') {
      return <ParentDashboardView onBack={closeSubView} />;
    }

    switch (activeTab) {
      case 'home':
        return <KidsHomeView />;
      case 'activities':
        return <BuddyActivitiesView />;
      case 'journey':
        return <BuddyGrowthJourneyView />;
      case 'profile':
        return <ChildProfileOverviewView />;
      case 'buddy':
        return <BuddyChatView />;
      default:
        return <KidsHomeView />;
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-gradient-to-b from-[#E5EFFD] via-[#ECF3FE] to-[#E6EEFB] text-[#23324D] flex flex-col items-center justify-start sm:py-2 md:py-3 sm:px-3">
      {/* Strictly Mobile (~390-430px) & Tablet (768-860px) App Frame – No desktop layout */}
      <div className="w-full max-w-[430px] md:max-w-[820px] h-full bg-[#F7F9FD] sm:rounded-[36px] sm:shadow-[0_20px_60px_rgba(35,50,77,0.12)] sm:border sm:border-white flex flex-col relative overflow-hidden">
        {/* Gentle Celebratory Microanimation Toast */}
        {celebration && (
          <div className="px-4 pt-3 z-30 shrink-0">
            <div className="rounded-[22px] bg-gradient-to-r from-[#FFF0C9] via-[#DDF5E8] to-[#EAF3FF] border border-amber-300 px-4 py-2.5 shadow-sm flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <p className="font-kids font-extrabold text-xs sm:text-sm text-[#23324D]">
                    {celebration.title}
                  </p>
                  <p className="text-[11px] text-[#23324D]/80">{celebration.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissCelebration}
                className="w-9 h-9 rounded-[18px] bg-white/85 hover:bg-white flex items-center justify-center text-[#23324D] cursor-pointer shrink-0"
                aria-label="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Dedicated Main Scrollable Content Area (Bottom Nav stays pinned outside this scroll container) */}
        <main className="flex-1 w-full min-h-0 px-4 sm:px-5 md:px-6 pt-4 pb-28 overflow-y-auto overscroll-contain">
          {renderMainContent()}
        </main>

        {/* Persistent Icon-Only Floating Buddy AI Assistant across all child screens */}
        <FloatingBuddyChat />

        {/* Rock-Solid Fixed Bottom Navigation Bar (Always visible on Mobile & Tablet, never scrolls away) */}
        <nav
          aria-label="Điều hướng chính"
          className="shrink-0 z-40 min-h-[74px] pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-md border-t border-[#23324D]/8 grid grid-cols-4 items-center px-2.5 shadow-[0_-6px_24px_rgba(35,50,77,0.06)]"
        >
          {NAV_ITEMS.map((item) => {
            const IconComponent = item.icon;
            const isActive =
              (subView.type === 'none' && activeTab === item.id) ||
              ((subView.type === 'voice-settings' ||
                subView.type === 'parent-dashboard' ||
                subView.type === 'stars-detail' ||
                subView.type === 'rewards-wheel') &&
                item.id === 'profile') ||
              ((subView.type === 'guide-task' || subView.type === 'monthly-tracker') &&
                item.id === 'activities') ||
              ((subView.type === 'story-list' || subView.type === 'story-detail') &&
                item.id === 'home');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTab(item.id)}
                className={`min-h-[54px] min-w-[48px] py-1 flex flex-col items-center justify-center rounded-[18px] transition-all cursor-pointer select-none ${
                  isActive
                    ? 'text-[#3978F6] font-bold'
                    : 'text-[#23324D]/55 hover:text-[#23324D]/85'
                }`}
              >
                <div
                  className={`px-4 py-1.5 rounded-[18px] transition-colors ${
                    isActive ? 'bg-[#EAF3FF]' : 'bg-transparent'
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                </div>
                <span className="font-kids text-[11px] sm:text-xs font-extrabold mt-0.5 whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <BuddyProvider>
        <BuddyShell />
      </BuddyProvider>
    </ErrorBoundary>
  );
}
