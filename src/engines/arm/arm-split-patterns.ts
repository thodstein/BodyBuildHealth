/**
 * arm-split-patterns.ts — сплиты для армрестлинга/армлифтинга.
 * Зеркало bb-split-patterns.ts, но для арм-сессий.
 */
import type { SplitPattern, ScheduleDay } from '../bb/bb-split-patterns';

export type { SplitPattern, ScheduleDay };

export const ARM_SPLIT_PATTERNS: SplitPattern[] = [
  {
    id: 'arm_2_table_support',
    name: 'Арм 2×/нед — Стол + Поддержка',
    rotationDays: 7, sessionsPerRotation: 2,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'TableHeavy' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Support' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['beginner', 'intermediate'],
    description: 'Новичок: стол тяж 1× + поддержка 1×. Tendon-адаптация, 3 мес без 100% спарринга.',
    direction: 'both',
  },
  {
    id: 'arm_3_full',
    name: 'Арм 3×/нед — Фулл-арм',
    rotationDays: 7, sessionsPerRotation: 3,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'TableHeavy' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'GripHeavy' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Support' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['beginner', 'intermediate', 'advanced'],
    description: 'Стол + хват + поддержка. 48ч между тяжёлыми.',
    direction: 'both',
  },
  {
    id: 'arm_4_upper_lower',
    name: 'Арм 4×/нед — Стол/Хват/Техника/Поддержка',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'TableHeavy' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'GripHeavy' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'TableTech' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Support' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced'],
    description: 'Классика StrengthLog: 2 стола (тяж+техника) + хват + поддержка. 1–2 дня отдых.',
    direction: 'both',
  },
  {
    id: 'arm_5_specialized',
    name: 'Арм 5×/нед — PRO специализация',
    rotationDays: 7, sessionsPerRotation: 5,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'TableHeavy' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Hammer' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'GripHeavy' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'TableTech' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Support' },
      { kind: 'отдых', character: null },
    ],
    level: ['advanced', 'enhanced'],
    description: 'PRO: стол тяж + молот + хват тяж + стол техника + поддержка. Для advanced с хорошей рекавери.',
    direction: 'both',
  },
  {
    id: 'arm_rolling_3_1',
    name: 'Rolling 3/1 (4 дня)',
    rotationDays: 4, sessionsPerRotation: 3,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'TableHeavy' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'GripHeavy' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Support' },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: '3/1 rolling: стол/хват/поддержка/отдых. Не привязан к неделе, как bb rolling.',
    direction: 'both',
  },
  {
    id: 'grip_3_support',
    name: 'Хват 3× — Поддержка/Щипок/Дробление',
    rotationDays: 7, sessionsPerRotation: 3,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'SupportGrip' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'PinchGrip' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'CrushGrip' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['beginner', 'intermediate', 'advanced'],
    description: 'Армлифтинг: поддержка (Rolling Thunder/Axle) + щипок (Saxon/Hub) + дробление (CoC).',
    direction: 'both',
  },
  {
    id: 'grip_4_mixed',
    name: 'Хват 4× — Микс',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'SupportGrip' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'PinchGrip' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'SupportGrip' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'CrushGrip' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: 'Армлифтинг 4×: поддержка 2× + щипок + дробление. Для соревнований.',
    direction: 'both',
  },
  {
    id: 'hybrid_4_arm_pl',
    name: 'Гибрид 4× — Арм + Поддержка + Ноги',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'TableHeavy' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'GripHeavy' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Support' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'LegsCore' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced'],
    description: 'Гибрид: стол + хват + поддержка + ноги/кор (якорь).',
    direction: 'both',
  },
];

export function getArmPattern(id: string): SplitPattern | undefined {
  return ARM_SPLIT_PATTERNS.find(p => p.id === id);
}

export function validateArmSplitPatterns(): string[] {
  const errors: string[] = [];
  for (const p of ARM_SPLIT_PATTERNS) {
    if (p.schedule.length !== p.rotationDays) {
      errors.push(`${p.id}: schedule.length ${p.schedule.length} !== rotationDays ${p.rotationDays}`);
    }
    const training = p.schedule.filter(d => d.kind === 'тренировка').length;
    if (training !== p.sessionsPerRotation) {
      errors.push(`${p.id}: training ${training} !== sessionsPerRotation ${p.sessionsPerRotation}`);
    }
    if (training === 0) errors.push(`${p.id}: no training days`);
  }
  return errors;
}

try {
  const errs = validateArmSplitPatterns();
  if (errs.length > 0) console.warn(`[arm-split-patterns] Инвариант нарушен:\n` + errs.join('\n'));
} catch {}
