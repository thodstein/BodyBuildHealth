/**
 * ss-hb-transit-2.ts — Гибрид переходка 2 недели (3 д/нед).
 * Разгрузочный мост между тяжёлыми блоками: техника 60-70%, короткие
 * сессии, сани/мешок легко, мобильность. Оба тижня — deload (RIR 4).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

function buildWeek(): SSDaySpec[] {
  return [
    day('snatch_day', 'лёг',
      ex('hang_snatch', 'Рывок с виса — техника 65%', 'olympic', 0.9, [s(0.65, 3, 4)]),
      ex('overhead_squat_v2', 'Присед над головой', 'legs', 0.7, [s(0.60, 3, 3)]),
      ex('face_pull', 'Протяжка к лицу', 'shoulders', 0.4, [s(0.30, 15, 3)], { base: 'overheadPress', baseMult: 1, role: 'accessory' }),
    ),
    day('overhead_day', 'лёг',
      ex('push_press', 'Швунг — техника 65%', 'shoulders', 0.9, [s(0.65, 3, 4)]),
      ex('db_press', 'Жим гантелей', 'shoulders', 0.6, [s(0.55, 8, 3)], { base: 'bench', role: 'accessory' }),
      ex('row_db', 'Тяга гантели', 'back', 0.5, [s(0.30, 10, 3)], { base: 'deadlift', baseMult: 1, role: 'accessory' }),
    ),
    day('event_day', 'лёг',
      ex('farmers_walk_heavy', 'Фермер легко 50%', 'strongman', 0.6, [s(0.50, 1, 3, { distanceM: 30, timeCapS: 60 })]),
      ex('sandbag_carry', 'Мешок легко', 'strongman', 0.6, [s(0.55, 1, 2, { distanceM: 25, timeCapS: 60 })]),
      ex('plank', 'Планка', 'accessory', 0.3, [s(0, 45, 3)], { bodyweight: true, role: 'accessory' }),
    ),
  ];
}

const weeks: SSDaySpec[][] = [buildWeek(), buildWeek()];

export const SS_HB_TRANSIT_2: SSCycleTemplate = {
  meta: {
    id: 'ss-hb-transit-2',
    title: 'Гибрид переходка — 2 недели (3 д/нед)',
    mode: 'hybrid',
    weeks: 2,
    sessionsPerWeek: 3,
    level: ['beginner', 'intermediate', 'advanced', 'enhanced'],
    period: 'base',
    correctionPct: 0,
    equipment: ['barbell', 'dumbbell'],
    description: 'Мост между блоками: обе недели — разгрузка (RIR 4), техника 60-70%, короткие сессии, лёгкие переноски. Без максимумов.',
    howItWorks: '3 лёгких дня: рывок с виса / швунг+гантели / фермер+мешок. Ставится после пика или между тяжёлыми циклами в годовой сборке.',
    conditions: ['После тяжёлого блока', '3 д/нед'],
    tags: ['hybrid', 'deload', 'transition', 'technique'],
    phases: [
      { weekStart: 1, weekEnd: 2, phase: 'deload', title: 'Переходка RIR 4' },
    ],
    deloadWeeks: [1, 2],
    sourcePhaseSource: 'inferred',
  },
  week1: weeks[0],
  weeks,
};
