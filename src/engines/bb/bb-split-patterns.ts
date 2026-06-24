/**
 * bb-split-patterns.ts — расписание и rolling-микроциклы бодибилдинга (Этап BB3).
 *
 * 1. Rolling-ротации переменной длины (НЕ привязаны к 7-дн неделе):
 *    3/1/3/1 (8дн), 4/1 (5дн), 2/1/2/1 (6дн), 6/1 (7дн), PPLx2-rolling.
 * 2. 7-дневные тяж/памп/отдых РАСПИСАНИЯ: ТПТ-О-ТТП (тяж/памп/тяж/отдых/тяж/тяж/памп) и варианты.
 * Расписание задаёт характер сессии в дне; первичная/добивка — внутри тяж-дня (bb-day-types).
 */

export type SlotKind = 'тренировка' | 'отдых';
export interface ScheduleDay {
  kind: SlotKind;
  character: 'тяж' | 'памп' | 'лёг' | null; // null для отдыха
  sessionTag?: string;                      // Push/Pull/Legs/Upper/Lower/FullBody...
}

export interface SplitPattern {
  id: string;
  name: string;
  rotationDays: number;        // длина ротации
  sessionsPerRotation: number;
  schedule: ScheduleDay[];     // последовательность дней ротации
  level: string[];             // подходящие уровни
  description: string;
}

export const SPLIT_PATTERNS: SplitPattern[] = [
  {
    id: 'fullbody_3',
    name: 'Фулбоди 3×/нед',
    rotationDays: 7, sessionsPerRotation: 3,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'FullBody' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'FullBody' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'FullBody' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['novice'],
    description: 'Все группы 3×/нед, одна сессия — фулбоди. Для новичков.',
  },
  {
    id: 'upper_lower_4',
    name: 'Верх/Низ 4×/нед',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Upper' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Lower' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Upper' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Lower' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['II-KMS', 'intermediate'],
    description: 'Верх/Низ 2×/нед; второй верх — памп, низ всегда тяж.',
  },
  {
    id: 'ppl_6',
    name: 'PPL 6×/нед',
    rotationDays: 7, sessionsPerRotation: 6,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Pull' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Pull' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
    ],
    level: ['KMS-MS', 'advanced', 'enhanced'],
    description: 'PPL×2; второй Push/Pull — памп, Legs всегда тяж (памп-слот заменён на тяж).',
  },
  {
    id: 'rolling_3_1_3_1',
    name: 'Rolling 3/1/3/1 (8 дней)',
    rotationDays: 8, sessionsPerRotation: 6,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Pull' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Pull' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
      { kind: 'отдых', character: null },
    ],
    level: ['KMS-MS', 'advanced', 'enhanced'],
    description: '8-дневная ротация: 3 тяж / отдых / 2 памп+1 тяж-ноги / отдых. Высокая частота.',
  },
  {
    id: 'rolling_4_1',
    name: 'Rolling 4/1 (5 дней)',
    rotationDays: 5, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Pull' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Upper' },
      { kind: 'отдых', character: null },
    ],
    level: ['II-KMS', 'intermediate'],
    description: '5-дневная ротация: 3 тяж + 1 памп-верх / отдых. Ноги всегда тяж.',
  },
  {
    id: 'tpt_o_ttp',
    name: 'ТПТ-О-ТТП (7 дней)',
    rotationDays: 7, sessionsPerRotation: 6,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Pull' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Pull' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Push' },
    ],
    level: ['KMS-MS', 'advanced', 'enhanced'],
    description: 'тяж/памп/тяж/отдых/тяж/тяж/памп. Ноги всегда тяж (памп-дни — только верх).',
  },
];

export function getPattern(id: string): SplitPattern | undefined {
  return SPLIT_PATTERNS.find(p => p.id === id);
}

/** Сессии одного прохода ротации (без отдыхов). */
export function sessionsOf(p: SplitPattern): ScheduleDay[] {
  return p.schedule.filter(d => d.kind === 'тренировка');
}

/** Циклический индекс дня ротации (для генерации нескольких недель). */
export function dayOfRotation(p: SplitPattern, absoluteDayIndex: number): ScheduleDay {
  return p.schedule[absoluteDayIndex % p.rotationDays];
}