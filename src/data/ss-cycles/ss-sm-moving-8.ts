/**
 * ss-sm-moving-8.ts — Стронг переноски, 8 недель (4 д/нед).
 * Блок локомоции: йок/фермер/рама/мешок/утка — дистанция и темп растут,
 * плюс ножной драйв (присед/выпады) и кондиция (сани/покрышка).
 * % на снаряд растёт умеренно (75→90%), объём — через дистанцию 20→40м.
 * Источник: открытые блоки moving events стронгмена.
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const PCT = [0.75, 0.78, 0.80, 0.76, 0.83, 0.86, 0.88, 0.90];
const DIST = [20, 20, 25, 20, 30, 30, 40, 30];
const DELOAD = [4];

function buildWeek(w: number): SSDaySpec[] {
  const p = PCT[w - 1];
  const d = DIST[w - 1];
  const deload = DELOAD.includes(w);
  const sets = deload ? 2 : w <= 4 ? 3 : 4;
  const cs = (extra?: Partial<SSSetSpec>): SSSetSpec[] => [{ pct: p, reps: 1, sets, distanceM: d, timeCapS: 60, ...extra }];
  return [
    day('event_day', deload ? 'лёг' : 'тяж',
      ex('yoke_walk', `Йок ${d}м`, 'strongman', 1.2, cs()),
      ex('duck_walk', `Утиная походка ${Math.max(10, d - 10)}м`, 'strongman', 0.9, cs({ pct: Math.max(0.60, p - 0.10), distanceM: Math.max(10, d - 10) })),
      ex('sandbag_carry', `Мешок на груди ${d}м`, 'strongman', 0.9, cs({ pct: Math.max(0.60, p - 0.08) })),
    ),
    day('event_day', deload ? 'лёг' : 'тяж',
      ex('farmers_walk_heavy', `Фермер ${d}м`, 'strongman', 1.2, cs()),
      ex('frame_carry', `Рама ${d}м`, 'strongman', 1.1, cs({ pct: Math.max(0.62, p - 0.05) })),
      ex('zercher_carry', `Зерчер ${Math.max(15, d - 5)}м`, 'strongman', 0.8, cs({ pct: Math.max(0.55, p - 0.15), distanceM: Math.max(15, d - 5) })),
    ),
    day('squat_day', deload ? 'лёг' : 'тяж',
      ex('back_squat', 'Присед со штангой (ножной драйв)', 'legs', 1.2, [s(Math.min(0.88, p), w <= 4 ? 5 : 3, deload ? 2 : 4)]),
      ex('bulgarian_split', 'Болгарский сплит', 'legs', 0.7, [s(0.50, 8, deload ? 2 : 3)], { base: 'backSquat', baseMult: 0.5, role: 'accessory' }),
      ex('calf_raise', 'Подъёмы на носки (голень под йок)', 'legs', 0.5, [s(0.55, 10, 3)], { base: 'backSquat', baseMult: 1.1, role: 'accessory' }),
    ),
    day('event_day', 'памп',
      ex('sled_push_sprint', 'Сани-спринт 25м', 'strongman', 1.0, [s(0.70, 1, deload ? 3 : 6, { distanceM: 25, timeCapS: 30 })]),
      ex('tire_flip', 'Покрышка (60с)', 'strongman', 1.0, [s(0.75, 1, deload ? 2 : 4, { timeCapS: 60 })]),
      ex('arm_over_arm', 'Канат к себе 20м', 'strongman', 0.9, [s(0.70, 1, deload ? 2 : 3, { distanceM: 20, timeCapS: 90 })]),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 8 }, (_, i) => buildWeek(i + 1));

export const SS_SM_MOVING_8: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-moving-8',
    title: 'Стронг переноски — 8 недель (4 д/нед)',
    mode: 'strongman',
    weeks: 8,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced'],
    period: 'build',
    correctionPct: 0,
    equipment: ['barbell', 'yoke', 'farmers'],
    needsSpecialty: true,
    description: 'Блок локомоции: йок/фермер/рама/мешок/утка — дистанция 20→40м, % 75→90%. Ножной драйв (присед/выпады/голень) + кондиция (сани/покрышка/канат). Делод нед.4.',
    howItWorks: 'Каждая неделя = 4 дня: йок-день / фермер-рама-день / ноги / кондиция. Объём растёт через дистанцию (20→40м) и подходы (3→4). Прогрессия вшита, correctionPct=0.',
    conditions: ['Знать ПМ йока/фермера', '4 д/нед', 'Спец-снаряды (йок/рама/сани) или фолбэк'],
    tags: ['yoke', 'farmers', 'carry', 'moving', 'conditioning'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'base', title: 'Объём 20-25м, делод нед.4' },
      { weekStart: 5, weekEnd: 8, phase: 'build', title: 'Дистанция 30-40м, темп' },
    ],
    deloadWeeks: [4],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
