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

export type SplitPatternDirection = 'strength' | 'bodybuilding' | 'both';

export interface SplitPattern {
  id: string;
  name: string;
  rotationDays: number;        // длина ротации
  sessionsPerRotation: number;
  schedule: ScheduleDay[];     // последовательность дней ротации
  level: string[];             // подходящие уровни
  description: string;
  direction?: SplitPatternDirection;
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
    level: ['novice', 'intermediate'],
    description: 'Все группы 3×/нед. Максимальная частота стимуляции белка, лучший синтез для натуралов.',
    direction: 'both',
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
    level: ['beginner', 'II-KMS', 'intermediate'],
    description: 'Верх/Низ 2×/нед; второй верх — памп, низ всегда тяж. Каждая мышца 2×/нед.',
    direction: 'both',
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
    direction: 'bodybuilding',
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
    direction: 'bodybuilding',
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
    direction: 'bodybuilding',
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
    direction: 'bodybuilding',
  },
  // ── 4 новых ПРОФ-сплита ──
  {
    id: 'arnold_6',
    name: 'Arnold Split 6×/нед',
    rotationDays: 7, sessionsPerRotation: 6,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'ChestBack' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'ShouldersArms' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'ChestBack' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'ShouldersArms' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
    ],
    level: ['II-KMS', 'advanced', 'enhanced'],
    description: 'Arnold-сплит: грудь+спина → плечи+руки → ноги ×2. Плечи/руки второй раз — памп. Ноги всегда тяж.',
    direction: 'bodybuilding',
  },
  {
    id: 'torso_limb_4',
    name: 'Торс/Конечности 4×/нед',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Torso' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Limbs' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Torso' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Limbs' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced'],
    description: 'Торс (грудь+спина+плечи) → Конечности (ноги+руки+икры). Второй проход — памп. Специализация слабых групп.',
    direction: 'bodybuilding',
  },
  {
    id: 'bro_5',
    name: 'Bro Split 5×/нед',
    rotationDays: 7, sessionsPerRotation: 5,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Chest' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Back' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Shoulders' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Arms' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced'],
    description: 'Классический Bro Split: грудь/спина/плечи/руки/ноги — 5 тренировок, 2 дня отдых. Высокий объём на группу 1×/нед.',
    direction: 'bodybuilding',
  },
  {
    id: 'phul_4',
    name: 'PHUL 4×/нед (Power+Hypertrophy)',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'UpperPower' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'LowerPower' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'UpperHyp' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'LowerHyp' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: 'PHUL: верх сила (1-5 повт) + низ сила + верх гипертрофия (8-15) + низ гипертрофия. Баланс силы и массы.',
    direction: 'both',
  },
  // ════════════════════════════════════════════════════════════
  // НОВЫЕ: частотные сплиты 2-3×/нед на группу
  // ════════════════════════════════════════════════════════════
  {
    id: 'fullbody_2',
    name: 'Фулбоди 2×/нед',
    rotationDays: 4, sessionsPerRotation: 2,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'FullBody' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'FullBody' },
      { kind: 'отдых', character: null },
    ],
    level: ['beginner', 'intermediate', 'advanced'],
    description: 'Все группы 2×/нед. 2 тренировки на 4 дня. Оптимальная частота для натуралов и восстановления.',
    direction: 'both',
  },
  {
    id: 'push_pull_2',
    name: 'Push/Pull 4×/нед (каждая мышца 2×)',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Pull' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Pull' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: 'Push/Pull 2×/нед: один тяж, один памп. Каждая мышца 2×/нед. Сбалансированный объём без перетрена.',
    direction: 'both',
  },
  {
    id: 'upper_lower_3',
    name: 'Верх/Низ 4×/нед (2 тяж + 2 памп)',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Upper' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Lower' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Upper' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Lower' },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced'],
    description: 'Верх 1.5×/нед, низ 1.5×/нед — средняя частота с акцентом на восстановление. Подходит под дефицит калорий.',
    direction: 'both',
  },
  {
    id: 'fullbody_4',
    name: 'Фулбоди 4×/нед (продвинутая частота)',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'FullBody' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'FullBody' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'FullBody' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'FullBody' },
      { kind: 'отдых', character: null },
    ],
    level: ['advanced', 'enhanced'],
    description: 'FB 4×/нед: тяж/памп/тяж/памп. Максимальная частота для продвинутых с PED или отличным восстановлением.',
    direction: 'both',
  },
  {
    id: 'pro_8_day',
    name: 'PRO 8-дневный сплит (специализация)',
    rotationDays: 8, sessionsPerRotation: 6,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'LegsBiceps' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Pull' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Pull' },
      { kind: 'отдых', character: null },
    ],
    level: ['advanced', 'enhanced'],
    description: '8-дн ротация: квадрицепс тяж+бицепс / грудь памп+плечи+трицепс / спина тяж+задняя дельта+трапеции / отдых / ноги тяж (бицепс бедра+ягодицы) / грудь тяж+трицепс / спина памп+бицепс+задняя дельта / отдых. Специализация слабых групп. Только для продвинутых (KMS-MS).',
    direction: 'bodybuilding',
  },
  {
    id: 'glute_focus_4',
    name: 'Glute Focus 4×/нед (женский)',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Glutes' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Upper' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'GlutesHams' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Upper' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: 'Женский сплит с приоритетом ягодичных: 2 тяж-дня Glutes (hip-thrust, back squat, B-stance hip-thrust) + 1 GlutesHams (RDL, hip-thrust, glute kickback) + 2 Upper (горизонтальная тяга, жим, плечи). Минимум 2×/нед ягодичные для гипертрофии.',
    direction: 'bodybuilding',
  },
  // ════════════════════════════════════════════════════════════
  // NEW 2024: 8 additional split patterns (higher/lowet frequency)
  // ════════════════════════════════════════════════════════════
  {
    id: 'upper_lower_5',
    name: 'Верх/Низ 5×/нед',
    rotationDays: 7, sessionsPerRotation: 5,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Upper' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Lower' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Upper' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Lower' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Upper' },
      { kind: 'отдых', character: null },
    ],
    level: ['advanced', 'enhanced'],
    description: 'Верх/Низ 5×/нед: верх 3×, низ 2×. Максимальная частота для верхней части тела.',
    direction: 'both',
  },
  {
    id: 'fullbody_5',
    name: 'Фулбоди 5×/нед',
    rotationDays: 7, sessionsPerRotation: 5,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'FullBody' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'FullBody' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'FullBody' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'FullBody' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'FullBody' },
      { kind: 'отдых', character: null },
    ],
    level: ['advanced', 'enhanced'],
    description: 'Fullbody 5×/нед: 3 тяж + 2 памп. Только для продвинутых с PED или отличным восстановлением.',
    direction: 'both',
  },
  {
    id: 'upper_lower_6',
    name: 'Верх/Низ 6×/нед',
    rotationDays: 7, sessionsPerRotation: 6,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Upper' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Lower' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Upper' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Lower' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Upper' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Lower' },
    ],
    level: ['enhanced'],
    description: 'Верх/Низ 6×/нед: 3× верх, 3× низ. Только для enhanced на PED.',
    direction: 'both',
  },
  {
    id: 'ppl_3',
    name: 'PPL 3×/нед (полный цикл)',
    rotationDays: 7, sessionsPerRotation: 3,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Pull' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['beginner', 'intermediate'],
    description: 'PPL 3×/нед: каждая группа 1×/нед. Простой сплит для начинающих.',
    direction: 'both',
  },
  {
    id: 'bro_6',
    name: 'Bro Split 6×/нед',
    rotationDays: 7, sessionsPerRotation: 6,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Chest' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Back' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Shoulders' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Arms' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Chest' },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced'],
    description: 'Bro Split 6×/нед: каждая группа 1×/нед + второй день груди. Высокий объём на грудь.',
    direction: 'bodybuilding',
  },
  {
    id: 'ppl_rest_ppl',
    name: 'PPL×2 6×/нед (отдых посередине)',
    rotationDays: 7, sessionsPerRotation: 6,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Pull' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Pull' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Legs' },
    ],
    level: ['advanced', 'enhanced'],
    description: 'PPL×2 с отдыхом посередине. Каждая группа 2×/нед с 3-дневным перерывом.',
    direction: 'bodybuilding',
  },
  {
    id: 'upper_lower_rest_3',
    name: 'Верх/Низ 3×/нед (отдых после каждой)',
    rotationDays: 7, sessionsPerRotation: 3,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Upper' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Lower' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Upper' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['beginner', 'intermediate'],
    description: 'Верх/Низ 3×/нед: отдых после каждой тренировки. Полное восстановление.',
    direction: 'both',
  },
  {
    id: 'push_pull_legs_4',
    name: 'Push/Pull/Legs 4×/нед',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Pull' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Legs' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Push' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced'],
    description: 'PPL 4×/нед: Push 2×, Pull 1×, Legs 1×. Акцент на жимовые мышцы.',
    direction: 'bodybuilding',
  },
  // ════════════════════════════════════════════════════════════
  // D1: Female glute specialization 5×/нед — dedicated split for
  // female trainees prioritizing glute hypertrophy.
  // 3 glute-focused sessions (2 тяж + 1 памп) + 2 upper body sessions.
  // Glutes hit 3×/нед (evidence: Schoenfeld 2016 — 2-3×/нед optimal).
  // ════════════════════════════════════════════════════════════
  {
    id: 'female_glute_5',
    name: 'Женский Glute Focus 5×/нед',
    rotationDays: 7, sessionsPerRotation: 5,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Glutes' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Upper' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'GlutesHams' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Glutes' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Upper' },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: 'Женский сплит 5×/нед с приоритетом ягодичных: 3 glute-сессии (2 тяж + 1 памп) + 2 upper. Ягодичные 3×/нед (Schoenfeld 2016), верх тела 2×/нед.',
    direction: 'bodybuilding',
  },
];

export function getPattern(id: string): SplitPattern | undefined {
  const legacyIds: Record<string, string> = {
    ppl_6day: 'ppl_6',
    fullbody_3x: 'fullbody_3',
  };
  const resolvedId = legacyIds[id] ?? id;
  const found = SPLIT_PATTERNS.find(p => p.id === resolvedId);
  if (!found) {
    console.warn(`[bb-split-patterns] getPattern: pattern id="${id}" не найден. Доступные: ${SPLIT_PATTERNS.map(p => p.id).join(', ')}`);
  }
  return found;
}

/** Сессии одного прохода ротации (без отдыхов). */
export function sessionsOf(p: SplitPattern): ScheduleDay[] {
  return p.schedule.filter(d => d.kind === 'тренировка');
}

/** Циклический индекс дня ротации (для генерации нескольких недель). */
export function dayOfRotation(p: SplitPattern, absoluteDayIndex: number): ScheduleDay {
  return p.schedule[absoluteDayIndex % p.rotationDays];
}
