import React, { useState, useEffect } from 'react';
import {
  ChildCharacterVariant,
  GrowthQualitySlug,
  IllustrationKey,
  RoutinePeriod,
  Story,
  TaskStepAssetBinding,
} from '../types/domain';

/**
 * Global reactive characterVariant store synchronized with ChildProfile.characterVariant ('boy' | 'girl').
 * Ensures all TaskStepIllustration instances across the app automatically reflect the parent's selection
 * while remaining completely independent of Buddy's Male/Female voice preference.
 */
let currentGlobalCharacterVariant: ChildCharacterVariant = 'girl';
const characterVariantListeners = new Set<(variant: ChildCharacterVariant) => void>();

export function setGlobalCharacterVariant(variant: ChildCharacterVariant): void {
  const safe: ChildCharacterVariant = variant === 'boy' ? 'boy' : 'girl';
  if (currentGlobalCharacterVariant === safe) return;
  currentGlobalCharacterVariant = safe;
  for (const fn of characterVariantListeners) {
    fn(safe);
  }
}

export function getGlobalCharacterVariant(): ChildCharacterVariant {
  return currentGlobalCharacterVariant;
}

function useActiveCharacterVariant(
  overrideVariant?: ChildCharacterVariant
): ChildCharacterVariant {
  const [globalVar, setGlobalVar] = useState<ChildCharacterVariant>(
    () => currentGlobalCharacterVariant
  );
  useEffect(() => {
    setGlobalVar(currentGlobalCharacterVariant);
    const listener = (next: ChildCharacterVariant) => setGlobalVar(next);
    characterVariantListeners.add(listener);
    return () => {
      characterVariantListeners.delete(listener);
    };
  }, []);
  return overrideVariant || globalVar;
}

/**
 * BUDDY ACTION SCENE IMAGE SYSTEM (v1.4 Warm Storybook Illustration & Asset Registry)
 * Supports 5 visual forms:
 * - Task Cover Image (variant="cover")
 * - Step Action Image (variant="step")
 * - Help Detail Image (variant="help")
 * - Completion Image (variant="result")
 * - Growth Journey Illustration (variant="journey" & GrowthJourneyBannerIllustration)
 */

export type SceneVariant = 'cover' | 'step' | 'help' | 'result' | 'journey';

export interface ActionSceneAsset {
  key: IllustrationKey;
  actionCaption: string;
  helpCallout: string;
  objectFocusTag: string;
  bgGradient: string;
  accentColor: string;
  childExpression: 'smile' | 'focused' | 'proud';
  storybookImageUrl?: string; // Girl character Warm Storybook painting
  boyStorybookImageUrl?: string; // Boy character Warm Storybook painting
  neutralFallbackImageUrl?: string; // Neutral fallback if a future key lacks a variant
}

export const GROWTH_JOURNEY_MAP_IMAGE =
  '/src/assets/images/growth_journey_roadmap_banner_1794015911753.jpg';

export const VIRTUE_ADVENTURE_PARCHMENT_MAP =
  '/src/assets/images/virtue_adventure_roadmap_parchment_1794126089140.jpg';

export const STORYBOOK_REWARD_CELEBRATION_IMAGE =
  '/src/assets/images/storybook_family_reward_celebration_1794417036395.jpg';

export const ACTION_SCENE_REGISTRY: Record<IllustrationKey, ActionSceneAsset> = {
  'schedule-check': {
    key: 'schedule-check',
    actionCaption: 'Bé xem thời khóa biểu ngày mai trên bàn học',
    helpCallout: 'Nhìn cột Thứ của ngày mai để biết các môn học cần chuẩn bị',
    objectFocusTag: 'Bảng thời khóa biểu · Cột ngày mai',
    bgGradient: 'from-[#FFF8EB] via-[#EAF3FF] to-[#EDE7FF]',
    accentColor: '#3978F6',
    childExpression: 'focused',
    storybookImageUrl: '/src/assets/images/backpack_step1_schedule_1794015907346.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_backpack_schedule_storybook_1794473273938.jpg',
  },
  'take-books': {
    key: 'take-books',
    actionCaption: 'Bé lấy sách giáo khoa và vở bài tập theo môn học',
    helpCallout: 'Mỗi môn học lấy 1 quyển sách và 1 quyển vở đặt ngay ngắn ra bàn',
    objectFocusTag: 'Sách giáo khoa · Vở bài tập từng môn',
    bgGradient: 'from-[#FFF6E5] via-[#FFF0C9] to-[#EAF3FF]',
    accentColor: '#F59E0B',
    childExpression: 'smile',
    storybookImageUrl: '/src/assets/images/backpack_step2_books_1794015906504.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_backpack_schedule_storybook_1794473273938.jpg',
  },
  'pack-books': {
    key: 'pack-books',
    actionCaption: 'Bé xếp sách to phía sau, vở nhỏ phía trước vào balo',
    helpCallout: 'Quyển to đặt sát lưng cặp, quyển nhỏ đặt phía ngoài cho thẳng góc',
    objectFocusTag: 'Balo mở · Sách Toán & Tiếng Việt',
    bgGradient: 'from-[#FFF8EC] via-[#EAF3FF] to-[#DDF5E8]',
    accentColor: '#3978F6',
    childExpression: 'smile',
    storybookImageUrl: '/src/assets/images/backpack_step3_pack_1794015906586.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_backpack_schedule_storybook_1794473273938.jpg',
  },
  'pencil-case': {
    key: 'pencil-case',
    actionCaption: 'Bé kiểm tra hộp bút đủ bút chì, thước kẻ và tẩy',
    helpCallout: 'Đếm đủ: 2 bút chì + 1 thước kẻ + 1 cục tẩy trắng rồi đặt vào ngăn phụ',
    objectFocusTag: 'Hộp bút · Bút chì · Thước · Tẩy',
    bgGradient: 'from-[#FFF5E0] via-[#FFF0C9] to-[#FFE4D8]',
    accentColor: '#F59E0B',
    childExpression: 'focused',
    storybookImageUrl: '/src/assets/images/backpack_step4_pencilcase_1794015908856.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_backpack_ready_storybook_1794473276587.jpg',
  },
  'water-bottle': {
    key: 'water-bottle',
    actionCaption: 'Bé kéo khóa balo và đặt cặp ở vị trí phù hợp cạnh bàn học',
    helpCallout: 'Kéo kín khóa balo và đặt ngay ngắn lên ghế gỗ cạnh bàn học cho sáng mai',
    objectFocusTag: 'Balo gọn gàng · Vị trí cạnh bàn học',
    bgGradient: 'from-[#FFF8EB] via-[#EAF3FF] to-[#FFF0C9]',
    accentColor: '#3978F6',
    childExpression: 'proud',
    storybookImageUrl: '/src/assets/images/backpack_step5_ready_1794015910816.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_backpack_ready_storybook_1794473276587.jpg',
  },
  'pen-holder': {
    key: 'pen-holder',
    actionCaption: 'Bé gom bút chì và bút màu cắm gọn vào ống đựng bút',
    helpCallout: 'Quay đầu bút gọn gàng và đặt ống bút ở góc phải bàn học',
    objectFocusTag: 'Ống đựng bút · Bút màu gọn gàng',
    bgGradient: 'from-[#FFF8EB] via-[#DDF5E8] to-[#EAF3FF]',
    accentColor: '#22C55E',
    childExpression: 'smile',
    storybookImageUrl: '/src/assets/images/storybook_step_pencil_case_1794014694648.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_tidy_desk_storybook_1794473278280.jpg',
  },
  'tidy-desk': {
    key: 'tidy-desk',
    actionCaption: 'Bé sắp xếp góc học tập sáng sủa, ngăn nắp',
    helpCallout: 'Đèn học bên trái, kệ sách và ống bút đặt sát góc bàn',
    objectFocusTag: 'Bàn học sạch thoáng · Đèn học ấm áp',
    bgGradient: 'from-[#FFF8EB] via-[#DDF5E8] to-[#FFF0C9]',
    accentColor: '#10B981',
    childExpression: 'proud',
    storybookImageUrl: '/src/assets/images/storybook_tidy_desk_scene_1794417032385.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_tidy_desk_storybook_1794473278280.jpg',
  },
  'sort-books': {
    key: 'sort-books',
    actionCaption: 'Bé xếp sách và truyện đứng thẳng hàng trên kệ gỗ',
    helpCallout: 'Xoay phần gáy sách ra ngoài để dễ nhìn tên từng quyển',
    objectFocusTag: 'Giá sách gỗ · Gáy sách thẳng hàng',
    bgGradient: 'from-[#FFF8EB] via-[#EDE7FF] to-[#EAF3FF]',
    accentColor: '#6366F1',
    childExpression: 'focused',
    storybookImageUrl: '/src/assets/images/storybook_step_take_books_1794014691572.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_tidy_desk_storybook_1794473278280.jpg',
  },
  'wipe-table': {
    key: 'wipe-table',
    actionCaption: 'Bé dùng khăn mềm lau sạch bụi trên mặt bàn học',
    helpCallout: 'Lau nhẹ nhàng từ trái sang phải cho mặt bàn gỗ sáng bóng',
    objectFocusTag: 'Khăn mềm · Mặt bàn sạch bóng',
    bgGradient: 'from-[#FFF8EB] via-[#DDF5E8] to-[#FFF0C9]',
    accentColor: '#22C55E',
    childExpression: 'smile',
    storybookImageUrl: '/src/assets/images/storybook_tidy_desk_scene_1794417032385.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_tidy_desk_storybook_1794473278280.jpg',
  },
  'building-blocks': {
    key: 'building-blocks',
    actionCaption: 'Bé nhặt các khối xếp hình trên sàn bỏ vào hộp',
    helpCallout: 'Nhặt các mảnh nhỏ trên sàn trước để đi lại an toàn',
    objectFocusTag: 'Khối gỗ & Lego · Hộp đựng',
    bgGradient: 'from-[#FFF8EB] via-[#FFF0C9] to-[#FFE4D8]',
    accentColor: '#F59E0B',
    childExpression: 'smile',
    storybookImageUrl: '/src/assets/images/storybook_tidy_toys_scene_1794417033448.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_tidy_toys_storybook_1794473279074.jpg',
  },
  'toy-box': {
    key: 'toy-box',
    actionCaption: 'Bé đẩy giỏ đồ chơi gọn gàng về sát góc phòng',
    helpCallout: 'Đặt giỏ đồ chơi sát tường để lối đi trong phòng rộng rãi',
    objectFocusTag: 'Giỏ đồ chơi lớn · Góc phòng gọn',
    bgGradient: 'from-[#FFF8EB] via-[#FFE4D8] to-[#FFF0C9]',
    accentColor: '#F97316',
    childExpression: 'proud',
    storybookImageUrl: '/src/assets/images/storybook_tidy_toys_scene_1794417033448.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_tidy_toys_storybook_1794473279074.jpg',
  },
  'plush-friends': {
    key: 'plush-friends',
    actionCaption: 'Bé ôm gấu bông đặt ngồi ngay ngắn trên kệ',
    helpCallout: 'Xếp các bạn thú bông tựa lưng vào kệ thật êm ái',
    objectFocusTag: 'Gấu bông · Kệ đồ chơi',
    bgGradient: 'from-[#FFF8EB] via-[#FFE4D8] to-[#EDE7FF]',
    accentColor: '#EC4899',
    childExpression: 'smile',
    storybookImageUrl: '/src/assets/images/storybook_tidy_toys_scene_1794417033448.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_tidy_toys_storybook_1794473279074.jpg',
  },
  'soap-bubbles': {
    key: 'soap-bubbles',
    actionCaption: 'Bé làm ướt tay và nhấn lấy bọt xà phòng thơm',
    helpCallout: 'Chỉ cần nhấn 1 giọt xà phòng nhỏ rồi xoa đều hai tay',
    objectFocusTag: 'Chai xà phòng · Bọt mịn thơm',
    bgGradient: 'from-[#FFF8EB] via-[#EAF3FF] to-[#EDE7FF]',
    accentColor: '#3978F6',
    childExpression: 'smile',
    storybookImageUrl: '/src/assets/images/storybook_wash_hands_scene_1794417034068.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_wash_hands_storybook_1794473280537.jpg',
  },
  'wash-hands': {
    key: 'wash-hands',
    actionCaption: 'Bé chà kỹ lòng bàn tay và kẽ ngón tay dưới vòi nước',
    helpCallout: 'Đan các ngón tay vào nhau và đếm chậm từ 1 tới 20',
    objectFocusTag: 'Vòi nước mát · Đôi bàn tay sạch',
    bgGradient: 'from-[#FFF8EB] via-[#EAF3FF] to-[#DDF5E8]',
    accentColor: '#0EA5E9',
    childExpression: 'focused',
    storybookImageUrl: '/src/assets/images/storybook_wash_hands_scene_1794417034068.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_wash_hands_storybook_1794473280537.jpg',
  },
  'clean-towel': {
    key: 'clean-towel',
    actionCaption: 'Bé khóa vòi nước và lau khô tay bằng khăn bông mềm',
    helpCallout: 'Khóa vòi nước trước rồi thấm khô cả lòng và mu bàn tay',
    objectFocusTag: 'Khăn bông khô · Vòi nước đã khóa',
    bgGradient: 'from-[#FFF8EB] via-[#FFF0C9] to-[#DDF5E8]',
    accentColor: '#F59E0B',
    childExpression: 'proud',
    storybookImageUrl: '/src/assets/images/storybook_wash_hands_scene_1794417034068.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_wash_hands_storybook_1794473280537.jpg',
  },
  'clothes-ready': {
    key: 'clothes-ready',
    actionCaption: 'Bé chọn và xếp phẳng bộ đồng phục đi học cho sáng mai',
    helpCallout: 'Treo hoặc gấp sẵn áo và quần đồng phục ở nơi dễ lấy nhất',
    objectFocusTag: 'Bộ đồng phục · Móc treo gọn',
    bgGradient: 'from-[#FFF8EB] via-[#EDE7FF] to-[#FFF0C9]',
    accentColor: '#6366F1',
    childExpression: 'smile',
    storybookImageUrl: '/src/assets/images/storybook_prepare_clothes_scene_1794417035702.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_prepare_clothes_storybook_1794473282170.jpg',
  },
  'shoes-hat': {
    key: 'shoes-hat',
    actionCaption: 'Bé đặt đôi tất sạch cạnh giày và mũ đội đầu',
    helpCallout: 'Đặt đôi tất ngay bên trong hoặc cạnh đôi giày đi học',
    objectFocusTag: 'Giày thể thao · Tất sạch · Mũ',
    bgGradient: 'from-[#FFF8EB] via-[#FFF0C9] to-[#FFE4D8]',
    accentColor: '#3978F6',
    childExpression: 'focused',
    storybookImageUrl: '/src/assets/images/storybook_prepare_clothes_scene_1794417035702.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_prepare_clothes_storybook_1794473282170.jpg',
  },
  'check-list': {
    key: 'check-list',
    actionCaption: 'Bé điểm danh đủ 3 món: Cặp sách, bình nước và quần áo',
    helpCallout: 'Nhìn lại 3 món: Cặp sách + Bình nước + Quần áo ngày mai',
    objectFocusTag: 'Bảng điểm danh 3 món sẵn sàng 100%',
    bgGradient: 'from-[#FFF8EB] via-[#DDF5E8] to-[#FFF0C9]',
    accentColor: '#10B981',
    childExpression: 'proud',
    storybookImageUrl: '/src/assets/images/storybook_step_backpack_ready_1794014695481.jpg',
    boyStorybookImageUrl: '/src/assets/images/boy_backpack_ready_storybook_1794473276587.jpg',
  },
};

/**
 * Explicit manifest of secondary step illustrations that share a task-level Warm Storybook painting
 * and can be expanded into per-step individual paintings in future content packs.
 */
export const MISSING_STORYBOOK_ASSETS_MANIFEST: Array<{
  key: IllustrationKey;
  taskTitle: string;
  stepDescription: string;
  recommendedFilename: string;
}> = [
  {
    key: 'wipe-table',
    taskTitle: 'Dọn góc học tập',
    stepDescription: 'Bé dùng khăn mềm lau sạch mặt bàn học dưới nắng ấm (hiện dùng chung tranh góc học tập)',
    recommendedFilename: 'storybook_step_wipe_table.webp',
  },
  {
    key: 'plush-friends',
    taskTitle: 'Cất đồ chơi gọn gàng',
    stepDescription: 'Cận cảnh bé ôm gấu bông đặt ngay ngắn lên kệ đồ chơi (hiện dùng chung tranh cất đồ chơi)',
    recommendedFilename: 'storybook_step_plush_friends.webp',
  },
  {
    key: 'clean-towel',
    taskTitle: 'Rửa tay sạch sẽ',
    stepDescription: 'Cận cảnh bé khóa vòi nước và lau khô tay bằng khăn bông màu vàng ấm (hiện dùng chung tranh rửa tay)',
    recommendedFilename: 'storybook_step_clean_towel.webp',
  },
];

/**
 * v1.4 Formal Asset Registry linking taskId, stepId, coverImage, stepImage, helpImage, and real-artwork status
 */
export const TASK_STEP_ASSET_REGISTRY: TaskStepAssetBinding[] = [
  {
    taskId: 'task-backpack',
    stepId: 'step-bp-1',
    stepNumber: 1,
    illustrationKey: 'schedule-check',
    coverImage: '/src/assets/images/backpack_step3_pack_1794015906586.jpg',
    stepImage: '/src/assets/images/backpack_step1_schedule_1794015907346.jpg',
    helpImage: '/src/assets/images/backpack_step1_schedule_1794015907346.jpg',
    hasRealArtwork: true,
  },
  {
    taskId: 'task-backpack',
    stepId: 'step-bp-2',
    stepNumber: 2,
    illustrationKey: 'take-books',
    coverImage: '/src/assets/images/backpack_step3_pack_1794015906586.jpg',
    stepImage: '/src/assets/images/backpack_step2_books_1794015906504.jpg',
    helpImage: '/src/assets/images/backpack_step2_books_1794015906504.jpg',
    hasRealArtwork: true,
  },
  {
    taskId: 'task-backpack',
    stepId: 'step-bp-3',
    stepNumber: 3,
    illustrationKey: 'pack-books',
    coverImage: '/src/assets/images/backpack_step3_pack_1794015906586.jpg',
    stepImage: '/src/assets/images/backpack_step3_pack_1794015906586.jpg',
    helpImage: '/src/assets/images/backpack_step3_pack_1794015906586.jpg',
    hasRealArtwork: true,
  },
  {
    taskId: 'task-backpack',
    stepId: 'step-bp-4',
    stepNumber: 4,
    illustrationKey: 'pencil-case',
    coverImage: '/src/assets/images/backpack_step3_pack_1794015906586.jpg',
    stepImage: '/src/assets/images/backpack_step4_pencilcase_1794015908856.jpg',
    helpImage: '/src/assets/images/backpack_step4_pencilcase_1794015908856.jpg',
    hasRealArtwork: true,
  },
  {
    taskId: 'task-backpack',
    stepId: 'step-bp-5',
    stepNumber: 5,
    illustrationKey: 'water-bottle',
    coverImage: '/src/assets/images/backpack_step3_pack_1794015906586.jpg',
    stepImage: '/src/assets/images/backpack_step5_ready_1794015910816.jpg',
    helpImage: '/src/assets/images/backpack_step5_ready_1794015910816.jpg',
    hasRealArtwork: true,
  },
  {
    taskId: 'task-desk',
    stepId: 'step-desk-cover',
    stepNumber: 1,
    illustrationKey: 'tidy-desk',
    coverImage: '/src/assets/images/storybook_tidy_desk_scene_1794417032385.jpg',
    stepImage: '/src/assets/images/storybook_tidy_desk_scene_1794417032385.jpg',
    helpImage: '/src/assets/images/storybook_tidy_desk_scene_1794417032385.jpg',
    hasRealArtwork: true,
  },
  {
    taskId: 'task-toys',
    stepId: 'step-toys-cover',
    stepNumber: 1,
    illustrationKey: 'toy-box',
    coverImage: '/src/assets/images/storybook_tidy_toys_scene_1794417033448.jpg',
    stepImage: '/src/assets/images/storybook_tidy_toys_scene_1794417033448.jpg',
    helpImage: '/src/assets/images/storybook_tidy_toys_scene_1794417033448.jpg',
    hasRealArtwork: true,
  },
  {
    taskId: 'task-wash-hands',
    stepId: 'step-wash-cover',
    stepNumber: 1,
    illustrationKey: 'wash-hands',
    coverImage: '/src/assets/images/storybook_wash_hands_scene_1794417034068.jpg',
    stepImage: '/src/assets/images/storybook_wash_hands_scene_1794417034068.jpg',
    helpImage: '/src/assets/images/storybook_wash_hands_scene_1794417034068.jpg',
    hasRealArtwork: true,
  },
  {
    taskId: 'task-tomorrow-clothes',
    stepId: 'step-clothes-cover',
    stepNumber: 1,
    illustrationKey: 'clothes-ready',
    coverImage: '/src/assets/images/storybook_prepare_clothes_scene_1794417035702.jpg',
    stepImage: '/src/assets/images/storybook_prepare_clothes_scene_1794417035702.jpg',
    helpImage: '/src/assets/images/storybook_prepare_clothes_scene_1794417035702.jpg',
    hasRealArtwork: true,
  },
];

interface StepIllustrationProps {
  illustrationKey: IllustrationKey;
  className?: string;
  showActionCaption?: boolean;
  variant?: SceneVariant;
  characterVariant?: ChildCharacterVariant;
}

const StorybookChildCharacter: React.FC<{
  expression: 'smile' | 'focused' | 'proud';
  shirtColor?: string;
}> = ({ expression, shirtColor = '#3978F6' }) => (
  <g transform="translate(14, 24)">
    <ellipse cx="44" cy="126" rx="28" ry="6" fill="#23324D" opacity="0.1" />
    <path
      d="M 20 84 Q 44 74 68 84 L 74 122 Q 44 128 14 122 Z"
      fill={shirtColor}
    />
    <path
      d="M 32 82 L 44 92 L 56 82"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M 64 92 Q 86 86 96 72"
      fill="none"
      stroke="#FFCCBC"
      strokeWidth="10"
      strokeLinecap="round"
    />
    <circle cx="97" cy="71" r="6" fill="#FFCCBC" />
    <circle cx="44" cy="52" r="26" fill="#FFE0B2" />
    <path
      d="M 18 48 Q 20 20 46 22 Q 70 22 70 48 Q 58 36 42 38 Q 26 38 18 48 Z"
      fill="#23324D"
    />
    <ellipse cx="29" cy="56" rx="4.5" ry="2.8" fill="#FF8A80" opacity="0.6" />
    <ellipse cx="59" cy="56" rx="4.5" ry="2.8" fill="#FF8A80" opacity="0.6" />
    <circle cx="34" cy="49" r="3.2" fill="#23324D" />
    <circle cx="54" cy="49" r="3.2" fill="#23324D" />
    <circle cx="35" cy="48" r="1" fill="#FFFFFF" />
    <circle cx="55" cy="48" r="1" fill="#FFFFFF" />
    {expression === 'proud' ? (
      <path d="M 37 59 Q 44 67 51 59 Z" fill="#EF4444" />
    ) : expression === 'focused' ? (
      <path
        d="M 39 60 Q 44 64 49 60"
        fill="none"
        stroke="#23324D"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    ) : (
      <path
        d="M 37 58 Q 44 65 51 58"
        fill="none"
        stroke="#23324D"
        strokeWidth="3"
        strokeLinecap="round"
      />
    )}
  </g>
);

export const TaskStepIllustration: React.FC<StepIllustrationProps> = ({
  illustrationKey,
  className = 'w-full h-48',
  showActionCaption = false,
  variant = 'step',
  characterVariant,
}) => {
  const [imgError, setImgError] = useState(false);
  const activeCharacterVariant = useActiveCharacterVariant(characterVariant);
  const matchedAsset = ACTION_SCENE_REGISTRY[illustrationKey];
  const isNeutralFallback = !matchedAsset;
  const asset = matchedAsset || ACTION_SCENE_REGISTRY['pack-books'];

  const resolvedStorybookImageUrl =
    activeCharacterVariant === 'boy'
      ? asset.boyStorybookImageUrl || asset.storybookImageUrl
      : asset.storybookImageUrl;

  const hasRasterStorybookImage = Boolean(resolvedStorybookImageUrl && !imgError);

  const renderObjectSceneSvg = () => {
    switch (illustrationKey) {
      case 'schedule-check':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(57,120,246,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#3978F6" />
            <rect x="98" y="140" width="184" height="14" rx="7" fill="#D7B38C" />
            <rect x="112" y="20" width="156" height="122" rx="22" fill="#FFFFFF" />
            <rect x="112" y="20" width="156" height="34" rx="18" fill="#3978F6" />
            <rect x="128" y="32" width="76" height="8" rx="4" fill="#FFFFFF" opacity="0.85" />
            <circle cx="246" cy="37" r="6" fill="#FFF0C9" />
            <rect x="124" y="62" width="64" height="68" rx="12" fill="#FFF0C9" stroke="#F59E0B" strokeWidth="2.5" />
            <rect x="132" y="72" width="48" height="12" rx="6" fill="#3978F6" />
            <rect x="132" y="90" width="44" height="12" rx="6" fill="#22C55E" />
            <rect x="132" y="108" width="48" height="12" rx="6" fill="#F97316" />
            <rect x="196" y="66" width="56" height="14" rx="7" fill="#EAF3FF" />
            <rect x="196" y="88" width="56" height="14" rx="7" fill="#DDF5E8" />
            <rect x="196" y="110" width="56" height="14" rx="7" fill="#EDE7FF" />
          </svg>
        );

      case 'take-books':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(245,158,11,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#F59E0B" />
            <rect x="108" y="138" width="174" height="14" rx="7" fill="#C89F74" />
            <rect x="132" y="42" width="56" height="76" rx="10" fill="#3978F6" />
            <rect x="140" y="54" width="38" height="10" rx="5" fill="#FFFFFF" opacity="0.8" />
            <rect x="196" y="52" width="52" height="68" rx="10" fill="#22C55E" />
            <rect x="204" y="64" width="36" height="10" rx="5" fill="#FFFFFF" opacity="0.8" />
            <path
              d="M 102 74 Q 118 58 130 68"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="3.5"
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
          </svg>
        );

      case 'pack-books':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(57,120,246,0.18)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#2563EB" />
            <ellipse cx="196" cy="160" rx="74" ry="9" fill="#23324D" opacity="0.1" />
            <path d="M 168 32 Q 196 10 224 32" fill="none" stroke="#2964DF" strokeWidth="8" strokeLinecap="round" />
            <g transform="rotate(-6 172 44)">
              <rect x="148" y="14" width="44" height="52" rx="9" fill="#FF8A65" />
            </g>
            <g transform="rotate(6 214 46)">
              <rect x="192" y="20" width="42" height="46" rx="9" fill="#FFD54F" />
            </g>
            <rect x="136" y="44" width="120" height="110" rx="32" fill="#3978F6" />
            <rect x="152" y="82" width="88" height="54" rx="20" fill="#EAF3FF" />
          </svg>
        );

      case 'pencil-case':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(245,158,11,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#F59E0B" />
            <ellipse cx="198" cy="158" rx="76" ry="9" fill="#23324D" opacity="0.1" />
            <g transform="rotate(-8 156 58)">
              <rect x="146" y="24" width="18" height="64" rx="6" fill="#FFB300" />
              <polygon points="146,24 155,8 164,24" fill="#FFE082" />
            </g>
            <rect x="182" y="18" width="26" height="70" rx="7" fill="#22C55E" />
            <g transform="rotate(8 234 62)">
              <rect x="218" y="38" width="30" height="46" rx="10" fill="#FF8A80" />
              <rect x="218" y="54" width="30" height="18" fill="#FFFFFF" opacity="0.92" />
            </g>
            <rect x="122" y="78" width="154" height="68" rx="26" fill="#3978F6" />
            <rect x="134" y="90" width="130" height="44" rx="18" fill="#EAF3FF" />
          </svg>
        );

      case 'water-bottle':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(57,120,246,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#0EA5E9" />
            <ellipse cx="202" cy="158" rx="68" ry="9" fill="#3978F6" opacity="0.14" />
            <rect x="128" y="64" width="54" height="84" rx="20" fill="#3978F6" opacity="0.85" />
            <rect x="174" y="16" width="54" height="20" rx="9" fill="#23324D" />
            <rect x="162" y="36" width="78" height="112" rx="26" fill="#58A6FF" />
            <rect x="176" y="64" width="50" height="54" rx="16" fill="#EAF3FF" />
          </svg>
        );

      case 'pen-holder':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(34,197,94,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            {/* Warm Storybook Window Light Backdrop */}
            <rect x="216" y="12" width="66" height="58" rx="12" fill="#FFF9E6" opacity="0.7" />
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#10B981" />
            <rect x="114" y="142" width="172" height="14" rx="7" fill="#C89F74" />
            <rect x="164" y="24" width="15" height="70" rx="7.5" fill="#3978F6" transform="rotate(-10 172 60)" />
            <rect x="190" y="16" width="15" height="74" rx="7.5" fill="#FFB300" />
            <rect x="214" y="26" width="15" height="70" rx="7.5" fill="#EC4899" transform="rotate(12 222 62)" />
            <rect x="152" y="70" width="92" height="74" rx="24" fill="#22C55E" />
            <rect x="164" y="82" width="12" height="50" rx="6" fill="#FFFFFF" opacity="0.32" />
            <circle cx="186" cy="108" r="4" fill="#FFFFFF" />
            <circle cx="210" cy="108" r="4" fill="#FFFFFF" />
            <path d="M 190 120 Q 198 127 206 120" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        );

      case 'tidy-desk':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(57,120,246,0.15)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <circle cx="256" cy="36" r="24" fill="#FFF0C9" opacity="0.8" />
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#3978F6" />
            <rect x="114" y="130" width="170" height="18" rx="9" fill="#B6895B" />
            <rect x="128" y="120" width="34" height="10" rx="5" fill="#3978F6" />
            <path d="M 144 120 L 144 64 L 172 48" fill="none" stroke="#3978F6" strokeWidth="7" strokeLinecap="round" />
            <path d="M 164 36 L 198 56 L 162 64 Z" fill="#FFD54F" />
            <rect x="184" y="112" width="54" height="18" rx="6" fill="#3978F6" />
            <rect x="188" y="96" width="46" height="16" rx="6" fill="#22C55E" />
            <rect x="246" y="84" width="28" height="46" rx="10" fill="#FF7043" />
          </svg>
        );

      case 'sort-books':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(99,102,241,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#6366F1" />
            <rect x="118" y="132" width="164" height="15" rx="7.5" fill="#B6895B" />
            <rect x="134" y="44" width="30" height="88" rx="8" fill="#3978F6" />
            <rect x="140" y="56" width="6" height="62" rx="3" fill="#FFFFFF" opacity="0.4" />
            <rect x="170" y="34" width="32" height="98" rx="8" fill="#22C55E" />
            <rect x="177" y="48" width="6" height="70" rx="3" fill="#FFFFFF" opacity="0.4" />
            <rect x="208" y="52" width="30" height="80" rx="8" fill="#F59E0B" />
            <rect x="242" y="42" width="30" height="90" rx="8" fill="#8B5CF6" />
          </svg>
        );

      case 'wipe-table':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(34,197,94,0.15)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#10B981" />
            <rect x="114" y="96" width="168" height="44" rx="16" fill="#E6C29F" stroke="#B6895B" strokeWidth="3" />
            <path d="M 134 118 L 262 118" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" opacity="0.7" />
            <rect x="166" y="72" width="68" height="34" rx="14" fill="#FFD54F" />
            <circle cx="144" cy="56" r="7" fill="#3978F6" />
            <circle cx="252" cy="50" r="9" fill="#22C55E" />
          </svg>
        );

      case 'building-blocks':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(245,158,11,0.17)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#F59E0B" />
            <ellipse cx="202" cy="152" rx="78" ry="12" fill="#FDE68A" opacity="0.55" />
            <rect x="130" y="88" width="48" height="48" rx="12" fill="#FF7043" />
            <circle cx="154" cy="112" r="10" fill="#FFFFFF" opacity="0.35" />
            <rect x="184" y="88" width="48" height="48" rx="12" fill="#3978F6" />
            <polygon points="180,36 150,86 210,86" fill="#22C55E" />
            <circle cx="254" cy="112" r="24" fill="#FBBF24" />
          </svg>
        );

      case 'toy-box':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(244,63,94,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#F97316" />
            <ellipse cx="202" cy="158" rx="76" ry="9" fill="#23324D" opacity="0.1" />
            <rect x="148" y="38" width="34" height="34" rx="9" fill="#FF7043" />
            <polygon points="202,24 182,66 222,66" fill="#26A69A" />
            <circle cx="240" cy="52" r="18" fill="#FFCA28" />
            <rect x="124" y="68" width="152" height="76" rx="24" fill="#3978F6" />
            <rect x="138" y="82" width="124" height="48" rx="15" fill="#EAF3FF" />
            <circle cx="200" cy="106" r="11" fill="#FFD54F" />
          </svg>
        );

      case 'plush-friends':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(139,92,246,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#EC4899" />
            <rect x="124" y="130" width="154" height="15" rx="7.5" fill="#B6895B" />
            <circle cx="172" cy="50" r="15" fill="#D7CCC8" />
            <circle cx="232" cy="50" r="15" fill="#D7CCC8" />
            <circle cx="202" cy="82" r="38" fill="#FFF8EE" stroke="#D7CCC8" strokeWidth="3.5" />
            <circle cx="189" cy="74" r="4.5" fill="#23324D" />
            <circle cx="215" cy="74" r="4.5" fill="#23324D" />
            <ellipse cx="202" cy="88" rx="13" ry="8" fill="#FFCCBC" />
            <circle cx="202" cy="85" r="3.5" fill="#8D6E63" />
          </svg>
        );

      case 'soap-bubbles':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(57,120,246,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#3978F6" />
            <rect x="166" y="58" width="72" height="84" rx="24" fill="#3978F6" />
            <rect x="188" y="36" width="28" height="22" rx="7" fill="#EAF3FF" />
            <path d="M 202 36 L 202 22 L 230 22" fill="none" stroke="#23324D" strokeWidth="6.5" strokeLinecap="round" />
            <circle cx="142" cy="72" r="18" fill="#FFFFFF" stroke="#3978F6" strokeWidth="3" />
            <circle cx="258" cy="66" r="20" fill="#FFFFFF" stroke="#3978F6" strokeWidth="3" />
            <circle cx="250" cy="116" r="15" fill="#DDF5E8" stroke="#22C55E" strokeWidth="3" />
          </svg>
        );

      case 'wash-hands':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(34,197,94,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#0EA5E9" />
            <path d="M 146 30 L 204 30 Q 220 30 220 48" fill="none" stroke="#3978F6" strokeWidth="13" strokeLinecap="round" />
            <circle cx="208" cy="74" r="6.5" fill="#58A6FF" />
            <circle cx="224" cy="90" r="7.5" fill="#58A6FF" />
            <circle cx="196" cy="98" r="5.5" fill="#58A6FF" />
            <circle cx="174" cy="110" r="25" fill="#FFFFFF" stroke="#3978F6" strokeWidth="3.5" />
            <circle cx="220" cy="118" r="28" fill="#FFFFFF" stroke="#22C55E" strokeWidth="3.5" />
          </svg>
        );

      case 'clean-towel':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(245,158,11,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#F59E0B" />
            <line x1="132" y1="38" x2="268" y2="38" stroke="#B6895B" strokeWidth="7" strokeLinecap="round" />
            <rect x="152" y="38" width="96" height="98" rx="16" fill="#FFB300" />
            <rect x="152" y="112" width="96" height="13" fill="#FFFFFF" opacity="0.78" />
            <circle cx="262" cy="70" r="8" fill="#22C55E" />
          </svg>
        );

      case 'shoes-hat':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(57,120,246,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#6366F1" />
            <path d="M 144 76 Q 192 28 240 76 Z" fill="#3978F6" />
            <rect x="136" y="72" width="124" height="13" rx="6.5" fill="#2964DF" />
            <rect x="142" y="108" width="54" height="28" rx="13" fill="#FF7043" />
            <rect x="142" y="128" width="56" height="8" rx="4" fill="#FFFFFF" />
            <rect x="206" y="108" width="54" height="28" rx="13" fill="#FF7043" />
            <rect x="206" y="128" width="56" height="8" rx="4" fill="#FFFFFF" />
          </svg>
        );

      case 'clothes-ready':
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(99,102,241,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#6366F1" />
            {/* Wooden Hanger & Uniform Shirt */}
            <path d="M 176 32 Q 202 14 228 32" fill="none" stroke="#B6895B" strokeWidth="6" strokeLinecap="round" />
            <path
              d="M 166 34 L 238 34 L 264 62 L 242 78 L 228 64 L 228 134 L 176 134 L 176 64 L 162 78 L 140 62 Z"
              fill="#3978F6"
            />
            <rect x="188" y="34" width="28" height="14" rx="6" fill="#FFFFFF" />
            <circle cx="202" cy="78" r="14" fill="#FFF0C9" />
          </svg>
        );

      case 'check-list':
      default:
        return (
          <svg
            viewBox="0 0 300 180"
            className="w-full h-full max-h-56 drop-shadow-[0_12px_20px_rgba(16,185,129,0.16)]"
            role="img"
            aria-label={asset.actionCaption}
          >
            <StorybookChildCharacter expression={asset.childExpression} shirtColor="#10B981" />
            {/* 3-Item Ready Checklist Board: Backpack + Water Bottle + Uniform */}
            <rect x="122" y="22" width="150" height="124" rx="22" fill="#FFFFFF" stroke="#10B981" strokeWidth="3" />
            <rect x="138" y="38" width="24" height="24" rx="7" fill="#DDF5E8" />
            <path d="M 144 50 L 149 55 L 157 45" fill="none" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" />
            <rect x="172" y="44" width="82" height="12" rx="6" fill="#3978F6" />

            <rect x="138" y="72" width="24" height="24" rx="7" fill="#DDF5E8" />
            <path d="M 144 84 L 149 89 L 157 79" fill="none" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" />
            <rect x="172" y="78" width="72" height="12" rx="6" fill="#0EA5E9" />

            <rect x="138" y="106" width="24" height="24" rx="7" fill="#DDF5E8" />
            <path d="M 144 118 L 149 123 L 157 113" fill="none" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" />
            <rect x="172" y="112" width="78" height="12" rx="6" fill="#F59E0B" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`rounded-[24px] bg-gradient-to-br ${asset.bgGradient} flex flex-col items-center justify-between relative overflow-hidden select-none border border-amber-900/8 ${
        hasRasterStorybookImage ? 'p-0' : 'p-3.5'
      } ${className}`}
    >
      {hasRasterStorybookImage ? (
        <div className="relative w-full h-full flex-1 min-h-0 overflow-hidden">
          <img
            key={`${illustrationKey}-${activeCharacterVariant}`}
            src={resolvedStorybookImageUrl}
            alt={asset.actionCaption}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#23324D]/55 via-transparent to-transparent pointer-events-none" />

          {isNeutralFallback && (
            <div className="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded-lg bg-[#23324D]/80 text-white text-[10px] font-kids font-bold">
              Minh họa mặc định
            </div>
          )}

          {variant === 'help' && (
            <div className="absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-xl bg-amber-500/95 text-white text-[10px] font-kids font-extrabold shadow-xs">
              Gợi ý: {asset.objectFocusTag}
            </div>
          )}

          {variant === 'result' && (
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-xl bg-emerald-600/95 text-white text-[11px] font-kids font-extrabold shadow-xs whitespace-nowrap">
              Hoàn thành xuất sắc!
            </div>
          )}

          {showActionCaption && (
            <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-xs text-[11px] sm:text-xs font-kids font-extrabold text-[#23324D] shadow-2xs text-center line-clamp-1">
              {variant === 'help' ? asset.helpCallout : asset.actionCaption}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/55 blur-md pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/45 blur-md pointer-events-none" />

          {variant === 'help' && (
            <div className="z-10 self-start px-2.5 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-kids font-extrabold shadow-2xs">
              Gợi ý: {asset.objectFocusTag}
            </div>
          )}

          {variant === 'result' && (
            <div className="z-10 self-center px-3 py-0.5 rounded-lg bg-emerald-600 text-white text-[11px] font-kids font-extrabold shadow-2xs">
              Hoàn thành xuất sắc!
            </div>
          )}

          <div className="w-full flex-1 flex items-center justify-center min-h-0">
            {renderObjectSceneSvg()}
          </div>

          {showActionCaption && (
            <div className="z-10 mt-1 px-3 py-1 rounded-xl bg-white/95 text-[11px] sm:text-xs font-kids font-extrabold text-[#23324D] shadow-2xs text-center line-clamp-1">
              {variant === 'help' ? asset.helpCallout : asset.actionCaption}
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Growth Journey Landscape Banner Illustration (Warm Storybook Roadmap Hero)
 */
export const GrowthJourneyBannerIllustration: React.FC<{
  className?: string;
  childrenOverlay?: React.ReactNode;
}> = ({ className = 'w-full h-48 sm:h-56', childrenOverlay }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`rounded-[28px] bg-gradient-to-br from-[#FFF5E1] via-[#DDF5E8] to-[#EAF3FF] relative overflow-hidden border border-amber-900/10 shadow-[0_10px_28px_rgba(35,50,77,0.08)] ${className}`}
    >
      {!imgError ? (
        <img
          src={GROWTH_JOURNEY_MAP_IMAGE}
          alt="Bản đồ Hành trình của con"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <svg viewBox="0 0 400 200" className="w-full h-full" role="img" aria-label="Hành trình của con">
          <circle cx="330" cy="48" r="28" fill="#FFD54F" />
          <path d="M 0 150 Q 120 90 240 140 T 400 120 L 400 200 L 0 200 Z" fill="#A7F3D0" />
          <path
            d="M 40 190 Q 140 120 220 150 T 350 90"
            fill="none"
            stroke="#FDE68A"
            strokeWidth="16"
            strokeLinecap="round"
          />
        </svg>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#23324D]/65 via-[#23324D]/15 to-transparent pointer-events-none" />
      {childrenOverlay && <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5">{childrenOverlay}</div>}
    </div>
  );
};

/**
 * Registry of dedicated Warm Storybook illustrations for all 8 virtues in Hành trình của con.
 * Every virtue has a unique child-action scene painting (no shared or duplicate images).
 */
export const VIRTUE_STORYBOOK_SCENE_REGISTRY: Record<
  GrowthQualitySlug,
  {
    imageUrl: string;
    actionCaption: string;
    bgGradient: string;
  }
> = {
  gratitude: {
    imageUrl: '/src/assets/images/virtue_gratitude_storybook_1794460710601.jpg',
    actionCaption: 'Em bé lễ phép dâng tách trà ấm và nói lời cảm ơn bà cùng mẹ',
    bgGradient: 'from-[#FFF0C9] to-[#FFE4D8]',
  },
  honesty: {
    imageUrl: '/src/assets/images/virtue_honesty_storybook_1794460711759.jpg',
    actionCaption: 'Em bé dũng cảm nói thật với mẹ khi lỡ làm đổ cốc nước trên bàn',
    bgGradient: 'from-[#EAF3FF] to-[#DDF5E8]',
  },
  courage: {
    imageUrl: '/src/assets/images/virtue_courage_storybook_1794460713117.jpg',
    actionCaption: 'Em bé tự tin bước qua đường đá nhỏ trong công viên cùng Buddy cổ vũ',
    bgGradient: 'from-[#FFE4D8] to-[#FFF0C9]',
  },
  sharing: {
    imageUrl: '/src/assets/images/virtue_sharing_storybook_1794460714086.jpg',
    actionCaption: 'Hai bạn nhỏ vui vẻ chia sẻ hộp bút màu và cùng vẽ tranh',
    bgGradient: 'from-[#DDF5E8] to-[#EAF3FF]',
  },
  responsibility: {
    imageUrl: '/src/assets/images/virtue_responsibility_storybook_1794460715451.jpg',
    actionCaption: 'Em bé chủ động tưới chậu hoa hướng dương và xếp cặp sách gọn gàng',
    bgGradient: 'from-[#EAF3FF] to-[#EDE7FF]',
  },
  perseverance: {
    imageUrl: '/src/assets/images/virtue_perseverance_storybook_1794460716219.jpg',
    actionCaption: 'Em bé kiên nhẫn xếp từng khối gỗ cao đến ngôi sao trên đỉnh',
    bgGradient: 'from-[#EDE7FF] to-[#FFF0C9]',
  },
  kindness: {
    imageUrl: '/src/assets/images/virtue_kindness_storybook_1794460828167.jpg',
    actionCaption: 'Em bé che ô và phụ xách giỏ trái cây giúp bà cụ hàng xóm',
    bgGradient: 'from-[#FFE4D8] to-[#EDE7FF]',
  },
  independence: {
    imageUrl: '/src/assets/images/virtue_independence_storybook_1794460831008.jpg',
    actionCaption: 'Em bé tự giác buộc dây giày và mặc đồng phục gọn gàng buổi sáng',
    bgGradient: 'from-[#DDF5E8] to-[#FFF0C9]',
  },
};

/**
 * Growth Quality Topic Warm Storybook Scene Illustration
 * Supports both compact checkpoint pins/cards and large scene banners with captions.
 */
export const GrowthTopicIllustration: React.FC<{
  slug: GrowthQualitySlug;
  className?: string;
  variant?: 'checkpoint' | 'scene';
  showCaption?: boolean;
}> = ({ slug, className = 'w-16 h-16', variant = 'checkpoint', showCaption = false }) => {
  const [imgError, setImgError] = useState(false);
  const sceneMeta =
    VIRTUE_STORYBOOK_SCENE_REGISTRY[slug] || VIRTUE_STORYBOOK_SCENE_REGISTRY.gratitude;

  if (!imgError && sceneMeta.imageUrl) {
    return (
      <div
        className={`rounded-[20px] bg-gradient-to-br ${sceneMeta.bgGradient} border border-white/85 relative overflow-hidden shadow-2xs select-none ${className}`}
      >
        <img
          src={sceneMeta.imageUrl}
          alt={sceneMeta.actionCaption}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
        {variant === 'scene' && (
          <div className="absolute inset-0 bg-gradient-to-t from-[#23324D]/55 via-transparent to-transparent pointer-events-none" />
        )}
        {showCaption && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-xs text-[11px] sm:text-xs font-kids font-extrabold text-[#23324D] shadow-2xs text-center line-clamp-1">
            {sceneMeta.actionCaption}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-[20px] bg-gradient-to-br ${sceneMeta.bgGradient} border border-white/80 flex items-center justify-center p-2 shadow-2xs ${className}`}
    >
      <svg viewBox="0 0 80 80" className="w-full h-full" role="img" aria-label={slug}>
        {slug === 'gratitude' && (
          <>
            <circle cx="40" cy="36" r="18" fill="#FFB300" />
            <circle cx="40" cy="36" r="9" fill="#6D4C41" />
            <path d="M 40 54 L 40 70" stroke="#2E7D32" strokeWidth="5" strokeLinecap="round" />
            <ellipse cx="30" cy="60" rx="8" ry="4" fill="#4CAF50" />
            <ellipse cx="50" cy="60" rx="8" ry="4" fill="#4CAF50" />
          </>
        )}
        {slug === 'honesty' && (
          <>
            <polygon points="40,12 62,34 40,66 18,34" fill="#38BDF8" />
            <polygon points="40,16 54,34 40,58" fill="#BAE6FD" opacity="0.7" />
            <circle cx="26" cy="22" r="3" fill="#FFFFFF" />
          </>
        )}
        {slug === 'courage' && (
          <>
            <path d="M 40 12 L 62 22 L 62 42 Q 62 60 40 68 Q 18 60 18 42 L 18 22 Z" fill="#F97316" />
            <polygon points="40,24 44,34 55,34 46,41 49,51 40,45 31,51 34,41 25,34 36,34" fill="#FFF0C9" />
          </>
        )}
        {slug === 'sharing' && (
          <>
            <circle cx="28" cy="40" r="14" fill="#34D399" />
            <circle cx="52" cy="40" r="14" fill="#60A5FA" />
            <path d="M 40 28 C 35 22, 26 26, 26 34 C 26 42, 40 50, 40 54 C 40 50, 54 42, 54 34 C 54 26, 45 22, 40 28 Z" fill="#FB7185" />
          </>
        )}
        {slug === 'responsibility' && (
          <>
            <rect x="22" y="22" width="36" height="44" rx="10" fill="#3978F6" />
            <rect x="28" y="34" width="24" height="22" rx="6" fill="#EAF3FF" />
            <path d="M 33 45 L 38 50 L 47 39" fill="none" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />
          </>
        )}
        {slug === 'perseverance' && (
          <>
            <polygon points="14,64 40,20 66,64" fill="#8B5CF6" />
            <polygon points="30,37 40,20 50,37" fill="#FFF0C9" />
            <line x1="40" y1="20" x2="40" y2="10" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
            <polygon points="40,10 54,14 40,18" fill="#EF4444" />
          </>
        )}
        {slug === 'kindness' && (
          <>
            <circle cx="40" cy="40" r="24" fill="#FBBF24" opacity="0.25" />
            <path d="M 40 26 C 33 17, 18 22, 18 35 C 18 48, 40 58, 40 64 C 40 58, 62 48, 62 35 C 62 22, 47 17, 40 26 Z" fill="#F43F5E" />
          </>
        )}
        {slug === 'independence' && (
          <>
            <path d="M 18 42 L 40 20 L 62 42 L 54 42 L 54 64 L 26 64 L 26 42 Z" fill="#10B981" />
            <rect x="35" y="46" width="10" height="18" rx="3" fill="#FFF0C9" />
          </>
        )}
      </svg>
    </div>
  );
};

/**
 * Period Banner Illustration for Morning / After School / Evening adventures
 */
export const RoutinePeriodIllustration: React.FC<{
  period: RoutinePeriod;
  className?: string;
}> = ({ period, className = 'w-16 h-16' }) => {
  if (period === 'morning') {
    return (
      <div
        className={`rounded-[18px] bg-gradient-to-br from-[#FFF0C9] to-[#FFE4D8] flex items-center justify-center p-2 ${className}`}
      >
        <svg viewBox="0 0 80 80" className="w-full h-full" role="img" aria-label="Buổi sáng">
          <circle cx="40" cy="42" r="18" fill="#FFB300" />
          <path
            d="M 40 14 L 40 8 M 62 24 L 67 19 M 18 24 L 13 19"
            stroke="#F59E0B"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path d="M 16 56 Q 40 46 64 56" fill="#FFFFFF" opacity="0.85" />
        </svg>
      </div>
    );
  }
  if (period === 'after_school') {
    return (
      <div
        className={`rounded-[18px] bg-gradient-to-br from-[#FFE4D8] to-[#EAF3FF] flex items-center justify-center p-2 ${className}`}
      >
        <svg viewBox="0 0 80 80" className="w-full h-full" role="img" aria-label="Sau giờ học">
          <circle cx="48" cy="34" r="14" fill="#FF7043" />
          <rect x="20" y="38" width="38" height="24" rx="12" fill="#FFFFFF" />
          <circle cx="34" cy="36" r="12" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }
  return (
    <div
      className={`rounded-[18px] bg-gradient-to-br from-[#EDE7FF] to-[#23324D] flex items-center justify-center p-2 ${className}`}
    >
      <svg viewBox="0 0 80 80" className="w-full h-full" role="img" aria-label="Buổi tối">
        <circle cx="44" cy="38" r="18" fill="#FFF0C9" />
        <circle cx="52" cy="32" r="15" fill="#3B4970" />
        <circle cx="22" cy="24" r="3" fill="#FFF0C9" />
        <circle cx="26" cy="54" r="2.5" fill="#FFFFFF" />
      </svg>
    </div>
  );
};

/**
 * Dedicated Warm Storybook Cover & Per-Paragraph Scene Illustrations for Buddy Story Podcast
 * Each scene entry includes `isDedicatedSceneArtwork` so our audit can transparently distinguish
 * dedicated story paintings from shared Warm Storybook library paintings (Section A.4).
 */
export const STORY_STORYBOOK_COVER_REGISTRY: Record<
  Story['illustrationType'],
  {
    coverUrl: string;
    caption: string;
    bgGradient: string;
    paragraphScenes: Array<{
      imageUrl: string;
      sceneCaption: string;
      isDedicatedSceneArtwork: boolean;
    }>;
  }
> = {
  'tich-chu': {
    coverUrl: '/src/assets/images/story_tich_chu_storybook_1794460832415.jpg',
    caption: 'Cậu bé Tích Chu và dòng nước suối Tiên hiếu thảo',
    bgGradient: 'from-[#EDE7FF] via-[#EAF3FF] to-[#FFF0C9]',
    paragraphScenes: [
      {
        imageUrl: '/src/assets/images/virtue_gratitude_storybook_1794460710601.jpg',
        sceneCaption: 'Bà nội luôn dịu dàng quạt mát và chăm sóc Tích Chu',
        isDedicatedSceneArtwork: false,
      },
      {
        imageUrl: '/src/assets/images/story_tich_chu_storybook_1794460832415.jpg',
        sceneCaption: 'Bà khát nước hóa thành chim trắng bay đi tìm suối mát',
        isDedicatedSceneArtwork: true,
      },
      {
        imageUrl: '/src/assets/images/virtue_courage_storybook_1794460713117.jpg',
        sceneCaption: 'Tích Chu dũng cảm băng rừng vượt suối tìm nước Suối Tiên cho bà',
        isDedicatedSceneArtwork: false,
      },
      {
        imageUrl: '/src/assets/images/story_tich_chu_storybook_1794460832415.jpg',
        sceneCaption: 'Tích Chu múc nước Suối Tiên mát lành mang về cho bà uống',
        isDedicatedSceneArtwork: true,
      },
      {
        imageUrl: '/src/assets/images/storybook_family_reward_celebration_1794417036395.jpg',
        sceneCaption: 'Hai bà cháu đoàn tụ ấm áp và Tích Chu luôn biết ơn, hiếu thảo',
        isDedicatedSceneArtwork: false,
      },
    ],
  },
  'kien-nho': {
    coverUrl: '/src/assets/images/story_kien_nho_storybook_1794460833766.jpg',
    caption: 'Chú Kiến Nhỏ kiên trì mang hạt bánh qua đồi cỏ',
    bgGradient: 'from-[#FFF0C9] via-[#FFE4D8] to-[#DDF5E8]',
    paragraphScenes: [
      {
        imageUrl: '/src/assets/images/story_kien_nho_storybook_1794460833766.jpg',
        sceneCaption: 'Kiến Nhỏ tìm thấy mẩu bánh thơm dưới gốc cây táo',
        isDedicatedSceneArtwork: true,
      },
      {
        imageUrl: '/src/assets/images/virtue_perseverance_storybook_1794460716219.jpg',
        sceneCaption: 'Đường lên đồi dốc cao nhưng Kiến Nhỏ kiên nhẫn thử từng bước nhỏ',
        isDedicatedSceneArtwork: false,
      },
      {
        imageUrl: '/src/assets/images/story_kien_nho_storybook_1794460833766.jpg',
        sceneCaption: 'Kiến Nhỏ bền bỉ đẩy mẩu bánh lên tới đỉnh đồi xanh mát',
        isDedicatedSceneArtwork: true,
      },
      {
        imageUrl: '/src/assets/images/virtue_sharing_storybook_1794460714086.jpg',
        sceneCaption: 'Kiến Nhỏ mang bánh về tổ và vui vẻ chia sẻ cùng cả đàn',
        isDedicatedSceneArtwork: false,
      },
    ],
  },
  'hat-giong': {
    coverUrl: '/src/assets/images/story_hat_giong_storybook_1794460835632.jpg',
    caption: 'Hạt Giống Nhỏ dũng cảm vươn mình đón ánh nắng mai',
    bgGradient: 'from-[#DDF5E8] via-[#EAF3FF] to-[#FFF0C9]',
    paragraphScenes: [
      {
        imageUrl: '/src/assets/images/virtue_responsibility_storybook_1794460715451.jpg',
        sceneCaption: 'Hạt giống nhỏ nằm trong lòng đất ấm lắng nghe tiếng mưa xuân',
        isDedicatedSceneArtwork: false,
      },
      {
        imageUrl: '/src/assets/images/story_hat_giong_storybook_1794460835632.jpg',
        sceneCaption: 'Chị Mưa Xuân và Bác Mặt Trời dịu dàng gọi Hạt Giống Nhỏ thức dậy',
        isDedicatedSceneArtwork: true,
      },
      {
        imageUrl: '/src/assets/images/story_hat_giong_storybook_1794460835632.jpg',
        sceneCaption: 'Mầm xanh dũng cảm vươn hai chiếc lá non đón ánh mặt trời',
        isDedicatedSceneArtwork: true,
      },
      {
        imageUrl: '/src/assets/images/virtue_courage_storybook_1794460713117.jpg',
        sceneCaption: 'Bông hoa hướng dương rực rỡ tỏa hương thơm ngát khắp khu vườn',
        isDedicatedSceneArtwork: false,
      },
    ],
  },
  'chim-se': {
    coverUrl: '/src/assets/images/story_chim_se_storybook_1794460836248.jpg',
    caption: 'Đôi bạn Chim Sẻ Nâu sẻ chia hạt kê vàng trong vườn hoa',
    bgGradient: 'from-[#FFE4D8] via-[#FFF0C9] to-[#EAF3FF]',
    paragraphScenes: [
      {
        imageUrl: '/src/assets/images/story_chim_se_storybook_1794460836248.jpg',
        sceneCaption: 'Sẻ Nâu tìm được chiếc lá đầy hạt kê vàng óng sau cơn mưa',
        isDedicatedSceneArtwork: true,
      },
      {
        imageUrl: '/src/assets/images/virtue_kindness_storybook_1794460828167.jpg',
        sceneCaption: 'Sẻ Nâu nhìn thấy bạn Sẻ Út đang ướt cánh nép dưới hiên nhà',
        isDedicatedSceneArtwork: false,
      },
      {
        imageUrl: '/src/assets/images/story_chim_se_storybook_1794460836248.jpg',
        sceneCaption: 'Sẻ Nâu chia một nửa phần hạt kê vàng cho bạn Sẻ Út',
        isDedicatedSceneArtwork: true,
      },
      {
        imageUrl: '/src/assets/images/virtue_sharing_storybook_1794460714086.jpg',
        sceneCaption: 'Đôi bạn hót vang khúc ca yêu thương và sẻ chia trên cành hoa',
        isDedicatedSceneArtwork: false,
      },
    ],
  },
  'bau-troi-dem': {
    coverUrl: '/src/assets/images/story_bau_troi_dem_storybook_1794460837850.jpg',
    caption: 'Bầu trời đêm dịu êm cùng ánh trăng và ngôi sao nhỏ',
    bgGradient: 'from-[#1E2942] via-[#2C3E6B] to-[#3978F6]',
    paragraphScenes: [
      {
        imageUrl: '/src/assets/images/story_bau_troi_dem_storybook_1794460837850.jpg',
        sceneCaption: 'Ánh trăng lưỡi liềm và những vì sao dịu dàng ru con vào giấc ngủ',
        isDedicatedSceneArtwork: true,
      },
      {
        imageUrl: '/src/assets/images/storybook_prepare_clothes_scene_1794417035702.jpg',
        sceneCaption: 'Căn phòng nhỏ gọn gàng, ấm áp sau một ngày con chăm ngoan',
        isDedicatedSceneArtwork: false,
      },
      {
        imageUrl: '/src/assets/images/story_bau_troi_dem_storybook_1794460837850.jpg',
        sceneCaption: 'Ngôi sao nhỏ mỉm cười lắng nghe ước mơ của bé qua khung cửa sổ',
        isDedicatedSceneArtwork: true,
      },
      {
        imageUrl: '/src/assets/images/storybook_family_reward_celebration_1794417036395.jpg',
        sceneCaption: 'Tình yêu thương của Ba Mẹ và Buddy đồng hành trong giấc mơ đẹp',
        isDedicatedSceneArtwork: false,
      },
    ],
  },
};

export interface StorySceneIllustrationAuditItem {
  paragraphIndex: number;
  imageUrl: string;
  caption: string;
  status: 'custom_parent' | 'dedicated_story' | 'shared_storybook_fallback';
  flaggedForParentReview: boolean;
  statusLabel: string;
}

export interface StoryIllustrationAuditReport {
  storyId: string;
  storyTitle: string;
  totalParagraphs: number;
  dedicatedOrCustomCount: number;
  flaggedSharedFallbackCount: number;
  items: StorySceneIllustrationAuditItem[];
}

/**
 * Audits each paragraph of a Story to verify whether its scene illustration is a custom parent-assigned
 * image / dedicated story scene painting, or a shared Warm Storybook fallback that parents may wish to customize
 * (Section A.4: Never falsely claim 100% scene illustration match when shared fallback images are used).
 */
export function auditStorySceneIllustrations(story: Story): StoryIllustrationAuditReport {
  const storyVisual =
    STORY_STORYBOOK_COVER_REGISTRY[story.illustrationType] ||
    STORY_STORYBOOK_COVER_REGISTRY['tich-chu'];
  const defaultScenes = storyVisual.paragraphScenes;

  const items: StorySceneIllustrationAuditItem[] = story.paragraphs.map((para, idx) => {
    const customScene = story.paragraphSceneImages?.[idx];
    const timelineCue = story.sceneTimeline?.[idx];
    const defaultEntry = defaultScenes[idx % defaultScenes.length];

    const customUrl = customScene?.imageUrl?.trim() || timelineCue?.imageUrl?.trim() || '';
    const isCustomDifferentFromDefault =
      Boolean(customUrl) && customUrl !== defaultEntry?.imageUrl;

    if (isCustomDifferentFromDefault) {
      return {
        paragraphIndex: idx,
        imageUrl: customUrl,
        caption: customScene?.caption || timelineCue?.caption || para.slice(0, 70),
        status: 'custom_parent',
        flaggedForParentReview: false,
        statusLabel: 'Ảnh riêng do ba mẹ chọn',
      };
    }

    if (defaultEntry?.isDedicatedSceneArtwork) {
      return {
        paragraphIndex: idx,
        imageUrl: defaultEntry.imageUrl,
        caption: defaultEntry.sceneCaption,
        status: 'dedicated_story',
        flaggedForParentReview: false,
        statusLabel: 'Tranh gốc đúng nhân vật truyện',
      };
    }

    return {
      paragraphIndex: idx,
      imageUrl: defaultEntry?.imageUrl || storyVisual.coverUrl,
      caption: defaultEntry?.sceneCaption || para.slice(0, 70),
      status: 'shared_storybook_fallback',
      flaggedForParentReview: true,
      statusLabel: 'Ảnh Warm Storybook dùng chung (có thể đổi ảnh riêng)',
    };
  });

  const dedicatedOrCustomCount = items.filter((i) => !i.flaggedForParentReview).length;
  const flaggedSharedFallbackCount = items.filter((i) => i.flaggedForParentReview).length;

  return {
    storyId: story.id,
    storyTitle: story.title,
    totalParagraphs: story.paragraphs.length,
    dedicatedOrCustomCount,
    flaggedSharedFallbackCount,
    items,
  };
}

export const StoryEditorialIllustration: React.FC<{
  type: Story['illustrationType'];
  className?: string;
}> = ({ type, className = 'w-full h-52' }) => {
  const [imgError, setImgError] = useState(false);
  const storyVisual =
    STORY_STORYBOOK_COVER_REGISTRY[type] || STORY_STORYBOOK_COVER_REGISTRY['tich-chu'];

  if (!imgError && storyVisual.coverUrl) {
    return (
      <div
        className={`rounded-[24px] bg-gradient-to-br ${storyVisual.bgGradient} relative overflow-hidden select-none border border-white/80 ${className}`}
      >
        <img
          src={storyVisual.coverUrl}
          alt={storyVisual.caption}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-[24px] bg-gradient-to-br ${storyVisual.bgGradient} relative overflow-hidden flex items-center justify-center p-6 ${className}`}
    >
      {type === 'bau-troi-dem' ? (
        <svg viewBox="0 0 320 180" className="w-full h-full max-h-44" role="img" aria-label="Bầu trời đêm">
          <circle cx="240" cy="56" r="28" fill="#FFF0C9" />
          <circle cx="252" cy="48" r="24" fill="#24345A" />
          <circle cx="64" cy="42" r="4" fill="#FFF0C9" />
          <circle cx="118" cy="28" r="5" fill="#FFFFFF" />
          <circle cx="168" cy="64" r="3.5" fill="#FFF0C9" />
          <circle cx="88" cy="96" r="4" fill="#EAF3FF" />
          <path d="M 30 155 Q 100 120 170 155 T 300 150 L 320 180 L 0 180 Z" fill="#17223B" />
        </svg>
      ) : (
        <svg viewBox="0 0 320 180" className="w-full h-full max-h-44" role="img" aria-label="Minh họa câu chuyện">
          <circle cx="80" cy="48" r="22" fill="#FFF0C9" />
          <path d="M 20 155 Q 110 95 200 145 T 310 135 L 320 180 L 0 180 Z" fill="#90CAF9" opacity="0.65" />
          <circle cx="160" cy="115" r="24" fill="#FFFFFF" />
        </svg>
      )}
    </div>
  );
};

export const getDefaultStorySceneCues = (
  type: Story['illustrationType']
): { imageUrl: string; sceneCaption: string }[] => {
  const storyVisual =
    STORY_STORYBOOK_COVER_REGISTRY[type] || STORY_STORYBOOK_COVER_REGISTRY['tich-chu'];
  return storyVisual.paragraphScenes;
};

/**
 * Per-Paragraph / Timeline Scene Warm Storybook Illustration for Buddy Story Podcast Player.
 * Section A.2: Never displays "Cảnh X/Y" or paragraph text subtitles on top of the child player artwork.
 */
export const StoryParagraphSceneIllustration: React.FC<{
  type: Story['illustrationType'];
  paragraphIndex: number;
  totalParagraphs: number;
  customImageUrl?: string;
  customCaption?: string;
  className?: string;
  hideBuiltInOverlays?: boolean;
}> = ({
  type,
  paragraphIndex,
  customImageUrl,
  customCaption,
  className = 'w-full h-56 sm:h-64',
  hideBuiltInOverlays = true,
}) => {
  const [imgError, setImgError] = useState(false);
  const storyVisual =
    STORY_STORYBOOK_COVER_REGISTRY[type] || STORY_STORYBOOK_COVER_REGISTRY['tich-chu'];
  const scenes = storyVisual.paragraphScenes;
  const fallbackScene = scenes[paragraphIndex % scenes.length] || {
    imageUrl: storyVisual.coverUrl,
    sceneCaption: storyVisual.caption,
  };
  const resolvedImageUrl = customImageUrl || fallbackScene.imageUrl;
  const resolvedCaption = customCaption || fallbackScene.sceneCaption;

  return (
    <div
      className={`rounded-[24px] bg-gradient-to-br ${storyVisual.bgGradient} relative overflow-hidden select-none border border-white/85 shadow-xs ${className}`}
    >
      {!imgError ? (
        <img
          key={`${type}-scene-${paragraphIndex}-${resolvedImageUrl}`}
          src={resolvedImageUrl}
          alt={resolvedCaption}
          loading="eager"
          decoding="async"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-center transition-all duration-500"
        />
      ) : (
        <StoryEditorialIllustration type={type} className="w-full h-full" />
      )}
      {!hideBuiltInOverlays && (
        <div className="absolute inset-0 bg-gradient-to-t from-[#23324D]/65 via-transparent to-[#23324D]/15 pointer-events-none" />
      )}
    </div>
  );
};



