/**
 * ss-sm-start-12.ts — Стронг старт 12 недель (3→4 д/нед).
 * Обезличенный аналог открытого 12-недельного стартового стронг-цикла:
 * фаза 1 (1-4): база штанги 3 д/нед, присед 4x6 72-78%, жим стоя 4x6,
 * тяга 4x5 75-82%, линейно +шаг/нед; фаза 2 (5-8): +ивент-день
 * (фермер BW/рука, йок 1.5BW, камни), тяга/присед 5x3+4x3 82-88%,
 * лог 5x3 70-80%; фаза 3 (9-11): синглы 90-95%, mock в нед.11;
 * нед.12: тейпер −50% объёма, 80-85%, ивенты ≤70%.
 * Источник: открытый интернет-цикл (beginner strongman 12-week, 3 фазы).
 */
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec, SSSetSpec } from './ss-types';

const s = (pct: number, reps: number, sets = 1, extra?: Partial<SSSetSpec>): SSSetSpec => ({ pct, reps, sets, ...extra });
const ex = (id: string, name: string, group: string, coef: number, sets: SSSetSpec[], extra?: Partial<SSExerciseSpec>): SSExerciseSpec => ({ id, name, group, coef, sets, ...extra });
const day = (tag: SSDaySpec['tag'], character: SSDaySpec['character'], ...exercises: SSExerciseSpec[]): SSDaySpec => ({ tag, character, exercises });

// Фаза 1: линейный прирост (закодирован рампой %)
const F1_SQ = [0.72, 0.74, 0.76, 0.78];
const F1_DL = [0.75, 0.77, 0.80, 0.82];

function foundationWeek(w: number): SSDaySpec[] {
  const sq = F1_SQ[w - 1];
  const dl = F1_DL[w - 1];
  return [
    day('squat_day', 'тяж',
      ex('back_squat', 'Присед задний', 'legs', 1.2, [s(sq, 6, 4)]),
      ex('front_squat', 'Фронтальный присед (стойка для ивентов)', 'legs', 1.0, [s(0.62, 8, 3)]),
      ex('bulgarian_split', 'Выпады шагающие', 'legs', 0.6, [s(0.30, 12, 3)], { base: 'backSquat', role: 'accessory' }),
      ex('leg_press', 'Жим ногами (высокая постановка)', 'legs', 0.7, [s(1.10, 12, 3)], { base: 'backSquat', role: 'accessory' }),
      ex('plank', 'Планка / колесо', 'accessory', 0.3, [s(0, 30, 3)], { bodyweight: true, role: 'accessory' }),
    ),
    day('overhead_day', 'тяж',
      ex('ohp', 'Жим стоя строго', 'shoulders', 1.2, [s(sq, 6, 4)]),
      ex('push_press', 'Швунг жимовой (тайминг)', 'shoulders', 1.0, [s(0.82, 5, 3)], { base: 'overheadPress' }),
      ex('bench_bar', 'Жим лёжа (база трицепса)', 'shoulders', 0.9, [s(0.68, 8, 4)]),
      ex('row_db', 'Тяга гантели (верх спины)', 'back', 0.7, [s(0.35, 10, 4)], { base: 'deadlift', baseMult: 1, role: 'accessory' }),
      ex('pin_press', 'Дожим узким хватом (локаут)', 'shoulders', 0.7, [s(0.60, 12, 3)], { base: 'bench', role: 'accessory' }),
    ),
    day('deadlift_day', 'тяж',
      ex('deadlift', 'Становая тяга (сброс каждую)', 'back', 1.4, [s(dl, 5, 4)]),
      ex('row_bar', 'Тяга штанги в наклоне', 'back', 0.8, [s(0.35, 8, 4)], { base: 'deadlift', baseMult: 1, role: 'accessory' }),
      ex('rdl', 'Румынская тяга (медленно)', 'legs', 0.8, [s(0.60, 10, 3)]),
      ex('farmers_walk_heavy', 'Фермер статикой (хват)', 'strongman', 0.8, [s(0.70, 1, 3, { timeCapS: 45 })]),
      ex('hanging_leg_raise', 'Подносы ног в висе', 'accessory', 0.3, [s(0, 12, 3)], { bodyweight: true, role: 'accessory' }),
    ),
  ];
}

// Фаза 2: ивент-день + тяжёлые тройки
const F2 = [0.82, 0.84, 0.86, 0.88];
function eventIntroWeek(w: number): SSDaySpec[] {
  const p = F2[w - 5];
  return [
    day('squat_day', 'тяж',
      ex('back_squat', 'Присед задний', 'legs', 1.2, [s(p, 3, 5)]),
      ex('deadlift', 'Становая тяга', 'back', 1.3, [s(p, 3, 4)]),
      ex('good_morning', 'Наклоны со штангой (шарнир)', 'back', 0.6, [s(0.40, 8, 3)], { base: 'deadlift', baseMult: 1, role: 'accessory' }),
      ex('plank', 'Кор-цепь: планка/паллоф/колесо', 'accessory', 0.3, [s(0, 45, 3)], { bodyweight: true, role: 'accessory' }),
    ),
    day('overhead_day', 'тяж',
      ex('log_press', 'Лог: взятие + жим', 'strongman', 1.4, [s(0.70 + (w - 5) * 0.03, 3, 5)]),
      ex('ohp', 'Жим стоя строго (объём)', 'shoulders', 1.0, [s(0.68, 8, 3)]),
      ex('bench_bar', 'Жим наклонный (угол лога)', 'shoulders', 0.8, [s(0.68, 8, 4)]),
      ex('face_pull', 'Протяжка к лицу (здоровье плеч)', 'shoulders', 0.4, [s(0.40, 15, 4)], { base: 'overheadPress', baseMult: 1, role: 'accessory' }),
    ),
    day('event_day', 'тяж',
      ex('farmers_walk_heavy', 'Фермер 50ft (осанка)', 'strongman', 1.2, [s(0.75, 1, 4, { distanceM: 15 })]),
      ex('yoke_walk', 'Йок 50ft', 'strongman', 1.2, [s(0.75, 1, 4, { distanceM: 15 })]),
      ex('atlas_stone_load', 'Камни/мешок на платформу', 'strongman', 1.1, [s(0.70, 2, 5, { timeCapS: 60 })]),
      ex('tire_flip', 'Покрышка/сани (кондиция)', 'strongman', 0.8, [s(0.70, 3, 5, { timeCapS: 60 })]),
    ),
    day('deadlift_day', 'памп',
      ex('sandbag_carry', 'Медли: 3 ивента подряд', 'strongman', 1.0, [s(0.65, 1, 4, { distanceM: 20, timeCapS: 90 })]),
      ex('sled_push_sprint', 'Сани толкание 40yd', 'strongman', 0.7, [s(0.65, 1, 6, { distanceM: 35 })]),
      ex('farmers_walk_heavy', 'Хват: удержания до отказа', 'strongman', 0.6, [s(0.80, 1, 3, { timeCapS: 60 })]),
    ),
  ];
}

// Фаза 3: синглы + mock (нед.11) + тейпер (нед.12)
function compPrepWeek(w: number): SSDaySpec[] {
  if (w === 12) {
    return [
      day('squat_day', 'лёг',
        ex('deadlift', 'Тяга 80-85% (без максимумов)', 'back', 1.0, [s(0.82, 3, 2)]),
        ex('back_squat', 'Присед 80-85%', 'legs', 1.0, [s(0.82, 3, 2)]),
      ),
      day('overhead_day', 'лёг',
        ex('log_press', 'Лог 80% техника', 'strongman', 1.0, [s(0.80, 3, 2)]),
        ex('ohp', 'Жим стоя лёгкий 50-55%', 'shoulders', 0.6, [s(0.55, 8, 2)]),
      ),
      day('event_day', 'лёг',
        ex('farmers_walk_heavy', 'Фермер 50% (походка/дыхание)', 'strongman', 0.6, [s(0.50, 1, 2, { distanceM: 30 })]),
        ex('atlas_stone_load', 'Камни ≤70%', 'strongman', 0.6, [s(0.65, 2, 2, { timeCapS: 60 })]),
      ),
      day('deadlift_day', 'лёг',
        ex('face_pull', 'Пул-апарты/растяжка', 'shoulders', 0.3, [s(0.30, 25, 2)], { base: 'overheadPress', baseMult: 1, role: 'accessory' }),
        ex('plank', 'Мобильность: бёдра/грудь/плечи', 'accessory', 0.2, [s(0, 20, 1)], { bodyweight: true, role: 'accessory' }),
      ),
    ];
  }
  const mock = w === 11;
  const top = mock ? 0.92 : 0.90 + (w - 9) * 0.02;
  return [
    day('squat_day', 'тяж',
      ex('deadlift', mock ? 'Тяга — тяжёлый сингл' : 'Тяга 90-95%', 'back', 1.4, [s(0.90, 1, 3), s(top, 1, 1)]),
      ex('back_squat', 'Присед 85-90% (контролируемо)', 'legs', 1.1, [s(0.87, 3, 3)]),
      ex('hip_thrust', 'Ягодичный мост (камни/тяги)', 'legs', 0.6, [s(0.60, 8, 3)], { base: 'deadlift', baseMult: 1, role: 'accessory' }),
    ),
    day('overhead_day', 'тяж',
      ex('log_press', mock ? 'Лог — тяжёлый сингл (взятие каждое)' : 'Лог 90-95%', 'strongman', 1.4, [s(0.90, 1, 3), s(top, 1, 1)]),
      ex('pin_press', 'Жим узким (локаут)', 'shoulders', 0.8, [s(0.78, 5, 4)], { base: 'bench', role: 'accessory' }),
    ),
    day('event_day', 'тяж',
      ex('deadlift', mock ? 'Ивент 1: тяга на разы 60с' : 'Тяга на разы 70-75%', 'back', 1.2, [s(0.72, 8, mock ? 1 : 3, { timeCapS: 60 })]),
      ex('log_press', mock ? 'Ивент 2: лог на разы 60с' : 'Лог на разы 65-70%', 'strongman', 1.2, [s(0.68, 6, mock ? 1 : 3, { timeCapS: 60 })]),
      ex('farmers_walk_heavy', mock ? 'Ивент 3: фермер на время' : 'Фермер 75-85%', 'strongman', 1.2, [s(0.80, 1, mock ? 1 : 3, { distanceM: 15, timeCapS: 60 })]),
      ...(mock ? [ex('atlas_stone_load', 'Ивент 4: камни 60с', 'strongman', 1.1, [s(0.75, 3, 1, { timeCapS: 60 })])] : []),
    ),
    day('deadlift_day', 'лёг',
      ex('ohp', 'Жим стоя лёгкий (техника)', 'shoulders', 0.6, [s(0.55, 8, 3)]),
      ex('farmers_walk_heavy', 'Фермер лёгкий 50% (походка)', 'strongman', 0.5, [s(0.50, 1, 3, { distanceM: 30 })]),
    ),
  ];
}

const weeks: SSDaySpec[][] = [
  ...[1, 2, 3, 4].map(foundationWeek),
  ...[5, 6, 7, 8].map(eventIntroWeek),
  ...[9, 10, 11, 12].map(compPrepWeek),
];

export const SS_SM_START_12: SSCycleTemplate = {
  meta: {
    id: 'ss-sm-start-12',
    title: 'Стронг старт — 12 недель (3→4 д/нед)',
    mode: 'strongman',
    weeks: 12,
    sessionsPerWeek: 3,
    sessionsPerWeekMax: 4,
    level: ['beginner', 'intermediate'],
    period: 'mixed',
    correctionPct: 0,
    equipment: ['barbell'],
    description: 'С дивана в новички-стронг: 1-4 база штанги 3×/нед (присед/жим/тяга linear), 5-8 +ивент-день (фермер/йок/камни), 9-11 синглы 90-95% + mock в нед.11, нед.12 тейпер −50% объёма.',
    howItWorks: 'Фаза 1: 4x6/4x5 с ростом %; фаза 2: тройки 82-88% + ивенты; фаза 3: синглы и mock (отдых 15 мин между ивентами как на старте); нед.12: половина сетов, 80-85%, ивенты ≤70%. Прогрессия вшита.',
    conditions: ['База: присед/жим/тяга/жим стоя с техникой', 'Без снарядов можно (замены в плане)', 'Сон 7-9ч, профицит'],
    tags: ['strongman', 'beginner', 'events', 'taper', 'mock'],
    phases: [
      { weekStart: 1, weekEnd: 4, phase: 'base', title: 'Фундамент: штанга 3×/нед' },
      { weekStart: 5, weekEnd: 8, phase: 'build', title: 'Ввод ивентов + тройки' },
      { weekStart: 9, weekEnd: 11, phase: 'peak', title: 'Синглы + mock-соревнование' },
      { weekStart: 12, weekEnd: 12, phase: 'taper', title: 'Тейпер −50% объёма' },
    ],
    taperWeeks: [12],
    mockWeeks: [11],
    sourcePhaseSource: 'inferred',
  },
  week1: weeks[0],
  weeks,
};
