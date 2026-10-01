/**
 * ss-sm-peak-8.ts — Стронг пик к соревнованию, 8 недель (4 д/нед).
 * Предсоревновательный пик: ивенты в центре (лог, становая, медли, камни),
 * % растут 75→95%, объём падает; нед.7 — mock-соревнование (симуляция),
 * нед.8 — тейпер (Winwood/cessation). Заявки mock — от текущего ПМ.
 * Источник: открытые пиковые блоки стронгмена (event peaking).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

const PCT = [0.75, 0.78, 0.82, 0.78, 0.86, 0.90, 0.95, 0.65];
const DELOAD = [4];

function buildWeek(w: number): SSDaySpec[] {
  const p = PCT[w - 1];
  const deload = DELOAD.includes(w);
  const mock = w === 7;
  const taper = w === 8;
  const reps = w <= 4 ? 3 : 2;
  const sets = deload ? 2 : taper ? 1 : w <= 4 ? 4 : w <= 6 ? 3 : 2;
  return [
    day('overhead_day', deload ? 'лёг' : 'тяж',
      mock
        ? ex('log_press', 'Лог-жим — заявка (opener/2-й/3-й)', 'strongman', 1.4, [s(0.90, 1, 1), s(0.96, 1, 1), s(1.01, 1, 1)])
        : ex('log_press', 'Лог-жим', 'strongman', 1.4, [s(p, reps, sets)]),
      ex('axle_press', 'Аксель-жим (подсобка)', 'strongman', 1.0, [s(Math.max(0.65, p - 0.10), 3, deload ? 2 : 3)], { role: 'accessory' }),
      ex('pin_press', 'Дожим с пинов', 'chest', 0.7, [s(0.70, 5, 3)], { base: 'bench', role: 'accessory' }),
    ),
    day('deadlift_day', deload ? 'лёг' : 'тяж',
      mock
        ? ex('deadlift_max', 'Становая макс — заявка', 'strongman', 1.4, [s(0.92, 1, 1), s(0.98, 1, 1)])
        : ex('deadlift', 'Становая тяга', 'back', 1.4, [s(p, reps, sets)]),
      ex('axle_deadlift', 'Аксель-становая (подсобка)', 'strongman', 1.0, [s(Math.max(0.62, p - 0.10), 3, deload ? 2 : 3)], { role: 'accessory' }),
      ex('frame_carry', 'Рама — холд 20с', 'strongman', 0.9, [s(Math.max(0.70, p - 0.05), 1, deload ? 2 : 3, { timeCapS: 20 })]),
    ),
    day('event_day', deload ? 'лёг' : 'тяж',
      mock
        ? ex('circus_db_medley', 'Медли гантелей — симуляция', 'strongman', 1.0, [s(0.85, 1, 4, { timeCapS: 90 })])
        : ex('circus_db_medley', 'Медли гантелей (лестница)', 'strongman', 1.0, [s(Math.max(0.65, p - 0.10), 1, deload ? 2 : 4, { timeCapS: 90 })]),
      ex('farmers_walk_heavy', 'Фермер 20м', 'strongman', 1.1, [s(Math.max(0.72, p - 0.05), 1, deload ? 2 : 3, { distanceM: 20, timeCapS: 60 })]),
      ex('sandbag_load', 'Мешок — загрузка', 'strongman', 0.9, [s(taper ? 0.60 : Math.max(0.68, p - 0.10), 2, deload ? 2 : 3, { timeCapS: 60 })]),
    ),
    day('event_day', deload ? 'лёг' : 'тяж',
      ex('atlas_stone_load', 'Атлас-камень — серия', 'strongman', 1.1, [s(taper ? 0.60 : Math.max(0.68, p - 0.10), 2, deload ? 2 : 4, { timeCapS: 60 })]),
      ex('car_deadlift_18', 'Автодедлифт 18″ (синглы)', 'strongman', 1.0, [s(taper ? 0.70 : Math.max(0.78, p - 0.05), 1, deload ? 2 : 3)]),
      ex('keg_over_bar', 'Бочка через планку', 'strongman', 0.8, [s(taper ? 0.60 : Math.max(0.65, p - 0.15), 2, deload ? 2 : 3)]),
    ),
  ];
}

const weeks: SSDaySpec[][] = Array.from({ length: 8 }, (_, i) => buildWeek(i + 1));

export const SS_SM_PEAK_8: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-peak-8',
    title: 'Стронг пик к соревнованию — 8 недель (4 д/нед)',
    mode: 'strongman',
    weeks: 8,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced'],
    period: 'peak',
    correctionPct: 0,
    equipment: ['barbell', 'log', 'stone', 'farmers'],
    needsSpecialty: true,
    description: 'Пиковый блок: лог/становая/медли/камни 3→2→1, % 75→95%. Нед.7 — mock-соревнование (заявки opener/2-й/3-й), нед.8 — тейпер. Делод нед.4.',
    howItWorks: 'Каждая неделя = 4 дня: лог / становая / медли+фермер / камни+автодедлифт. Объём падает к пику, % растут. Mock нед.7 симулирует соревнование, тейпер нед.8 по Winwood/cessation.',
    conditions: ['Опытный стронгмен', '4 д/нед', 'Спец-снаряды или фолбэк', 'Соревновательный сезон'],
    tags: ['peak', 'competition', 'log', 'deadlift', 'medley', 'stones', 'mock'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'build', title: 'Наращивание 4x3, делод нед.4' },
      { weekStart: 5, weekEnd: 6, phase: 'peak', title: 'Пик 3x2' },
      { weekStart: 7, weekEnd: 7, phase: 'test', title: 'Mock-соревнование (симуляция)' },
      { weekStart: 8, weekEnd: 8, phase: 'taper', title: 'Тейпер (Winwood/cessation)' },
    ],
    deloadWeeks: [4],
    taperWeeks: [8],
    mockWeeks: [7],
    sourcePhaseSource: 'original',
  },
  week1: weeks[0],
  weeks,
};
