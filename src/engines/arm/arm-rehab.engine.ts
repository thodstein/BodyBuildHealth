/**
 * arm-rehab.engine.ts — TOP T5b: return-to-pull 10–16 недель.
 *
 * Источник: GoldenGrip/Cureus/JCDR — spiral humerus: иммобилизация → passive ROM
 * → light pron/sup → loaded grip; union + full ROM критерий; 10–16 нед типично.
 * UCL/медиальный эпикондилит: торсия — главный враг, прогрессия медленная.
 * Rice-bucket/band/iso — базовый прогрев каждой фазы.
 *
 * Скрининг, не диагноз: red-flags → к врачу. Чистый модуль.
 */

export type RehabInjury = 'humerus' | 'ucl' | 'biceps' | 'elbow_tendon' | 'wrist';

export interface RehabInput {
  injury?: string;
  weeksSince?: number; // недель с травмы/операции
  pain?: number; // 0-10 сейчас
  romFull?: boolean; // полный ли объём движений
  surgery?: boolean;
}

export interface RehabPhase {
  phase: number; // 0-4
  title: string;
  weeks: string;
  allowed: string[];
  forbidden: string[];
  criteriaToNext: string;
}

export interface RehabPlan {
  injury: RehabInjury;
  phase: number;
  phases: RehabPhase[];
  current: RehabPhase;
  redFlags: string[];
  note: string;
}

function normInjury(v: unknown): RehabInjury {
  const s = String(v || 'elbow_tendon').toLowerCase();
  if (/humer|перелом|плеч.*кост/i.test(s)) return 'humerus';
  if (/ucl|медиал|локтев.*связ/i.test(s)) return 'ucl';
  if (/biceps|бицепс/i.test(s)) return 'biceps';
  if (/wrist|кист|запяст/i.test(s)) return 'wrist';
  return 'elbow_tendon';
}

const PHASES: RehabPhase[] = [
  {
    phase: 0, title: 'Иммобилизация + врач', weeks: '0–2 нед',
    allowed: ['Покой', 'Холод 0.5–2ч при подозрении', 'Пальцы здоровой руки — лёгкие движения'],
    forbidden: ['Любая борьба', 'нагрузка травмированной', 'прогрев через боль'],
    criteriaToNext: 'Диагноз (рентген при подозрении перелома) + спад острой боли.',
  },
  {
    phase: 1, title: 'Passive ROM', weeks: '2–6 нед',
    allowed: ['Пассивные движения', 'rice-bucket лёгкий', 'band без сопротивления'],
    forbidden: ['Нагрузка с весом', 'пронация/супинация под нагрузкой', 'спарринг'],
    criteriaToNext: 'Full ROM без боли + union по снимку (для перелома).',
  },
  {
    phase: 2, title: 'Light pron/sup + iso', weeks: '6–10 нед',
    allowed: ['Лёгкие пронация/супинация', 'изометрия 10с RPE≤6', 'экстензоры band'],
    forbidden: ['Side pressure динамика', 'максимумы', 'ремень', 'спарринг 100%'],
    criteriaToNext: '2 недели без боли при лёгкой нагрузке.',
  },
  {
    phase: 3, title: 'Loaded grip', weeks: '10–14 нед',
    allowed: ['Fat Gripz лёгкий', 'wrist curl 15–20 RPE6', 'table техника 50%'],
    forbidden: ['Стресс-синглы 100–125%', 'соревнования', 'тяжёлый side'],
    criteriaToNext: 'Сила ≥80% здоровой стороны, боль 0.',
  },
  {
    phase: 4, title: 'Return-to-pull', weeks: '14–16+ нед',
    allowed: ['Полный стол 70% → 100% за 3 недели', 'спарринг 70% → 90%', 'тест-старт'],
    forbidden: ['Красная линия в первую неделю', 'игнор боли'],
    criteriaToNext: 'Контрольный спарринг без боли + full ROM.',
  },
];

export function buildRehabPlan(input: RehabInput = {}): RehabPlan {
  const injury = normInjury(input.injury);
  const w = Math.max(0, Math.round(Number(input.weeksSince ?? 0) || 0));
  const pain = Number(input.pain ?? 0);
  let phase = w <= 2 ? 0 : w <= 6 ? 1 : w <= 10 ? 2 : w <= 14 ? 3 : 4;
  // Боль откатывает фазу назад (защита)
  if (pain >= 5 && phase >= 2) phase = 1;
  else if (pain >= 3 && phase >= 3) phase = 2;
  if (injury === 'humerus' && input.surgery !== false && w < 6 && phase > 1) phase = 1; // перелом — консервативно
  const redFlags = [
    'Деформация/отёк/онемение (radial nerve!) — немедленно к врачу + рентген.',
    'Spiral humerus часто требует операции + пластина — не «перетерпеть».',
    'Повторная острая боль на фазе — откат на фазу назад + врач при >недели.',
  ];
  const note = `${injury}: фаза ${phase} (${PHASES[phase].title}) — ${PHASES[phase].weeks}. Union + full ROM — критерии, не сроки.`;
  return { injury, phase, phases: PHASES, current: PHASES[phase], redFlags, note };
}
