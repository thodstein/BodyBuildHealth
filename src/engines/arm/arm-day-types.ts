/**
 * arm-day-types.ts — типы дней и TAG_MUSCLES для арм-планировщика.
 * Зеркало bb-day-types.ts, но для арм-мышц.
 */
import type { ArmDayCharacter, ArmMuscle } from './arm-types';

export type { ArmDayCharacter };

export interface ArmMuscleSlot {
  muscle: ArmMuscle;
  role: 'primary' | 'accessory';
  character: ArmDayCharacter;
  volumeSets: number;
}

export interface ArmBBDay {
  index: number;
  character: ArmDayCharacter;
  restDay: boolean;
  slots: ArmMuscleSlot[];
  comment?: string;
}

/** Группы, которые всегда только 'тяж'/'техника', без чистого 'памп' (как bb FORCE_HEAVY_GROUPS). */
export const FORCE_HEAVY_GROUPS_ARM: ReadonlySet<string> = new Set([
  'side_pressure', // боковое — только тяж/техника, не памп
]);

/** Группы техники — всегда 'техника' или 'лёг', не тяж. */
export const FORCE_TECHNIQUE_GROUPS: ReadonlySet<string> = new Set([
  'risers',
  'thumb',
  'shoulder_stab',
]);

/** Единый источник sessionTag → мышцы для движка + селектора. */
export const TAG_MUSCLES_ARM: Record<string, string[]> = {
  TableHeavy: ['wrist_flexors', 'pronators', 'brachialis', 'back_pressure'],
  TableTech: ['risers', 'pronators', 'supinators', 'shoulder_stab', 'wrist_flexors'],
  TableCup: ['wrist_flexors', 'risers', 'thumb', 'brachialis'],
  TablePronation: ['pronators', 'brachioradialis', 'wrist_flexors', 'back_pressure'],
  TableSupination: ['supinators', 'brachialis', 'biceps_long', 'shoulder_stab'],
  GripHeavy: ['grip_support', 'grip_pinch', 'wrist_flexors', 'thumb', 'brachioradialis'],
  SupportGrip: ['grip_support', 'wrist_flexors', 'thumb', 'back_pressure'],
  PinchGrip: ['grip_pinch', 'thumb', 'wrist_extensors', 'risers'],
  CrushGrip: ['grip_crush', 'brachialis', 'wrist_flexors', 'forearms'],
  HubPinch: ['grip_pinch', 'thumb', 'risers'],
  Hammer: ['brachialis', 'brachioradialis', 'biceps_long', 'wrist_flexors'],
  Support: ['back_pressure', 'side_pressure', 'shoulder_stab', 'core_anchor'],
  SidePress: ['side_pressure', 'shoulder_stab', 'core_anchor', 'wrist_flexors'],
  BackPress: ['back_pressure', 'brachialis', 'biceps_long', 'shoulder_stab'],
  FullArm: ['wrist_flexors', 'pronators', 'supinators', 'brachialis', 'risers', 'grip_support', 'back_pressure'],
  ArmWrestlingBase: ['wrist_flexors', 'pronators', 'risers', 'brachialis', 'back_pressure', 'shoulder_stab'],
  ArmLiftingBase: ['grip_support', 'grip_pinch', 'grip_crush', 'wrist_flexors', 'thumb', 'brachioradialis'],
  HybridArm: ['wrist_flexors', 'pronators', 'grip_support', 'brachialis', 'back_pressure', 'side_pressure'],
  Recovery: ['shoulder_stab', 'wrist_extensors', 'core_anchor'],
  LegsCore: ['core_anchor', 'shoulder_stab'],
};

export const ARM_SESSION_TAG_LABEL: Record<string, string> = {
  TableHeavy: 'Стол — тяж',
  TableTech: 'Стол — техника',
  TableCup: 'Стол — cup',
  TablePronation: 'Стол — пронация',
  TableSupination: 'Стол — супинация',
  GripHeavy: 'Хват — тяж',
  SupportGrip: 'Хват — поддержка',
  PinchGrip: 'Хват — щипок',
  CrushGrip: 'Хват — дробление',
  HubPinch: 'Хаб — щипок',
  Hammer: 'Молот',
  Support: 'Поддержка',
  SidePress: 'Боковое',
  BackPress: 'Тяга на себя',
  FullArm: 'Фулл-арм',
  ArmWrestlingBase: 'Арм — база',
  ArmLiftingBase: 'Лифтинг — база',
  HybridArm: 'Гибрид',
  Recovery: 'Восстановление',
  LegsCore: 'Ноги/кор',
};

export function tagMusclesArm(tag: string): string[] {
  return TAG_MUSCLES_ARM[tag] || [tag];
}

/** Hummerus-risk паттерн (side pressure). */
export const HUMERUS_RISK_RE = /side.*press|боковое/i;

export function isSidePressureTag(tag: string): boolean {
  return HUMERUS_RISK_RE.test(tag) || tag === 'SidePress';
}
