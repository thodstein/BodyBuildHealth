/**
 * bb-prep-process.engine.ts — современный процесс подготовки к соревнованиям
 * (медицинский мониторинг, гидратация/электролиты, процедуры под контролем врача).
 *
 * Доказательная база (PubMed/EuropePMC):
 * - Buechel, Helms et al. 2025-2026 (JISSN) — пост-шоу восстановление, метаболическая
 *   адаптация, refeeding (PMC13202672, PMC12536638).
 * - Chappell, Helms 2021 (J Hum Kinet) — биопсихосоциальный мониторинг подготовки (PMC8336548).
 * - Helms 2019 (Sports) — устойчивая парадигма питания (PMC6681103).
 * - Smoliga 2023 (Sports Med) — преждевременная смертность бодибилдеров (PMC9885939).
 * - 2026 (J Endocrinol Invest) — гипонатриемия при нагрузке (PMC12847173).
 * - Vecchiato 2026 (Sports Med Open) — сердечно-сосудистый мониторинг при PED (PMC13109459).
 *
 * ВАЖНО (harm reduction): НИКАКИХ назначений дозировок и препаратов. Все процедуры
 * (капельницы/инфузии, анализы, спец-процедуры) — ТОЛЬКО под контролем врача, как
 * медицинские чек-поинты и опции, с предупреждениями и эскалацией при отклонениях.
 */

import type { BBContestCategory, BBContestPrepPlan } from './bb-contest-prep.engine';
import type { PrepCycleConfig } from './bb-prep-cycle.engine';

export type PrepProcessStage =
  | 'medical_screen'
  | 'labs_baseline'
  | 'monitoring'
  | 'hydration'
  | 'procedures'
  | 'post_show';

export interface PrepProcessStep {
  id: string;
  stage: PrepProcessStage;
  title: string;
  timing: string;
  details: string[];
  doctorRequired?: boolean;
  warning?: string;
}

export interface PrepProcedure {
  id: string;
  name: string;
  category: 'iv' | 'lab' | 'procedure' | 'assessment';
  doctorOnly: true;
  indication: string;
  monitoring: string[];
  warning: string;
  evidenceRefs: string[];
}

export interface PrepLabItem {
  name: string;
  when: string;
  why: string;
}

export interface PrepProcessResult {
  steps: PrepProcessStep[];
  procedures: PrepProcedure[];
  recommendedProcedures: string[];
  labPanel: PrepLabItem[];
  hydrationGuidelines: string[];
  postShow: { phase: string; details: string[] };
  warnings: string[];
  note: string;
}

/** Процедуры под контролем врача (harm reduction, без назначений). */
export const PREP_PROCEDURES: PrepProcedure[] = [
  {
    id: 'iv_hydration',
    name: 'Инфузия/капельница (гидратация, электролиты)',
    category: 'iv',
    doctorOnly: true,
    indication: 'Только по назначению врача: дегидратация, электролитные нарушения, длительные дефициты в финале подготовки.',
    monitoring: ['Электролиты (Na/K/Mg/Ca)', 'Глюкоза', 'АД/пульс', 'Диурез', 'Признаки гипонатриемии/перегрузки жидкостью'],
    warning: '⚠ Инфузии — медицинская процедура: риск перегрузки жидкостью, гипонатриемии, флебита, электролитных сдвигов. Только врач, только по показаниям, с контролем лаборатории. Не заменяет питание/гидратацию.',
    evidenceRefs: ['PMC12847173', 'PMC12704824'],
  },
  {
    id: 'bloodwork',
    name: 'Лабораторный контроль (кровь)',
    category: 'lab',
    doctorOnly: true,
    indication: 'Периодический контроль здоровья в подготовке: липиды, печень, почки, электролиты, гормоны, гематокрит.',
    monitoring: ['HCT/эритроциты', 'Липиды (LDL/HDL/ТГ)', 'Печень (АЛТ/АСТ/ГГТ)', 'Почки (креатинин/eGFR, ОАМ)', 'Электролиты', 'TT/FT/E2/SHBG/PRL/ТТГ'],
    warning: '⚠ Анализы интерпретирует врач. Отклонения (HCT≥54, eGFR<60, АЛТ/АСТ>2×ВГН, K<3.0) — мед-эскалация.',
    evidenceRefs: ['PMC9885939', 'PMC13109459'],
  },
  {
    id: 'ecg_cardio',
    name: 'Кардио-скрининг (ЭКГ/АД)',
    category: 'assessment',
    doctorOnly: true,
    indication: 'При курсе/сердечно-сосудистых рисках — до и в финале подготовки.',
    monitoring: ['АД в динамике', 'ЭКГ', 'Пульс в покое', 'Субъективные симптомы (одышка, сердцебиение, боли)'],
    warning: '⚠ Контроль сердечно-сосудистой системы обязателен при PED/курсе (Vecchiato 2026). Без врача — не интерпретировать.',
    evidenceRefs: ['PMC13109459'],
  },
  {
    id: 'endocrinology',
    name: 'Эндокринный мониторинг',
    category: 'lab',
    doctorOnly: true,
    indication: 'Ось HPTA, щитовидная железа, кортизол, PRL — при курсе и в пост-шоу восстановлении.',
    monitoring: ['TT/FT', 'E2', 'SHBG', 'LH/FSH', 'ТТГ/своб. Т4', 'Кортизол', 'PRL'],
    warning: '⚠ Восстановление оси HPTA и липидов после курса — под контролем врача.',
    evidenceRefs: ['PMC9885939'],
  },
  {
    id: 'special_fluid',
    name: 'Спец-процедуры под контролем врача',
    category: 'procedure',
    doctorOnly: true,
    indication: 'Например, эритроцитаферез/флеботомия при эритроцитозе (HCT≥54) — только по назначению гематолога.',
    monitoring: ['HCT/железо/ферритин', 'Электролиты', 'АД'],
    warning: '⚠ Любые инвазивные/спец-процедуры — исключительно по назначению врача, с обоснованными показаниями.',
    evidenceRefs: ['PMC9885939'],
  },
];

/** Перечень анализов по фазам (базовая → контроль → пик → пост-шоу). */
export const PREP_LAB_PANEL: PrepLabItem[] = [
  { name: 'ОАК + СОЭ', when: 'До начала подготовки', why: 'База: HCT/эритроциты (риск эритроцитоза при курсе), лейкоциты, тромбоциты.' },
  { name: 'Липидный профиль (LDL/HDL/ТГ)', when: 'До + середина + финал', why: 'Дислипидемия — частый эффект курса; контроль до и во время дефицита.' },
  { name: 'Глюкоза/инсулин/HOMA-IR', when: 'До + середина', why: 'Инсулинорезистентность при дефиците/курсе.' },
  { name: 'Печень (АЛТ/АСТ/ГГТ, билирубин)', when: 'До + каждые 3-4 нед', why: 'Оральные ААС/перегрузка БЖУ — риск гепатотоксичности.' },
  { name: 'Почки (креатинин/eGFR, ОАМ)', when: 'До + середина + пик', why: 'Дегидратация, белок, высокий объём — контроль почек (PMC12704824).' },
  { name: 'Электролиты (Na/K/Mg/Ca)', when: 'До + пик', why: 'Манипуляции водой/натрием в пик-неделю — риск гипонатриемии (PMC12847173).' },
  { name: 'Гормоны (TT/FT/E2/SHBG/PRL/ТТГ/кортизол)', when: 'До + пост-шоу', why: 'База оси HPTA, восстановление после курса.' },
  { name: 'Ферритин/витамин D', when: 'До + пост-шоу', why: 'Дефицит железа (особенно женщины), D3 — здоровье костей.' },
];

/** Гидратация/электролиты (доказательно, harm reduction). */
export const PREP_HYDRATION_GUIDELINES: string[] = [
  'Вода по жажде + 3-4 л/день в подготовке; НЕ перепивать — избыток воды при низком натрии = риск гипонатриемии (PMC12847173).',
  'Натрий ~2800 мг/день стабильно в подготовке; в пик-неделе — строго по протоколу под контролем.',
  'При длительных сессиях/высоком потоотделении — изотоник/электролиты (Mg/K) по рекомендации врача.',
  'Признаки гипонатриемии (головная боль, тошнота, спутанность, судороги) — немедленно прекратить воду и обратиться к врачу.',
  'Электролиты: K 3500-4000 мг, Mg 300-400 мг — не снижать в подготовке (анти-судороги).',
];

/** Пост-шоу восстановление (Buechel, Helms 2025-2026). */
export const PREP_POST_SHOW: { phase: string; details: string[] } = {
  phase: 'Post-show (1-4 нед после шоу)',
  details: [
    'Постепенное повышение калорий (refeeding): поддерживающий уровень, +200-300 ккал от дефицита, белок 2 г/кг.',
    'Вес +1-2 кг в первую неделю — гликоген/вода (норма, не жир); не паниковать.',
    'Возврат объёма тренировок постепенно (+10-15%/нед), лёгкие full-body 2-3×/нед.',
    'Контроль гормонов/липидов (при курсе) и ферритина — восстановление оси HPTA под контролем врача.',
    'Метаболическая адаптация: термогенез снижен — калории поднимать ступенчато, не разом.',
  ],
};

/** Собрать процесс подготовки. */
export function buildPrepProcess(cfg: PrepCycleConfig, prepPlan: BBContestPrepPlan): PrepProcessResult {
  const sex = cfg.sex;
  const female = sex === 'female';
  const warnings: string[] = [
    '⚠ Это медицинский чек-лист и мониторинг, НЕ назначения. Капельницы/процедуры/анализы — ТОЛЬКО под контролем врача.',
    'Любые препараты, инфузии и инвазивные процедуры — только по назначению и под наблюдением врача.',
  ];
  if (cfg.enhanced) {
    warnings.push('⚠ На курсе: обязателен лабораторный и кардио-мониторинг (HCT, липиды, печень, почки, АД, ЭКГ) — PMC9885939, PMC13109459.');
  }
  if (female) {
    warnings.push('👩 Женщины: контроль ферритина/железа, RED-S/EA, костное здоровье, цикл (лютеиновая фаза — задержка воды).');
  }

  const steps: PrepProcessStep[] = [
    {
      id: 'medical_screen',
      stage: 'medical_screen',
      title: '🩺 Медицинский вход (до подготовки)',
      timing: 'За 2-4 нед до старта подготовки',
      details: [
        'Консультация врача/спортивного врача: противопоказания, хронические заболевания, АД, сердечно-сосудистые риски.',
        'Оценка %жира, веса, состава тела — целевая сухость категории.',
        'Если курс — обязательно мед-сопровождение и план мониторинга.',
      ],
      doctorRequired: true,
    },
    {
      id: 'labs_baseline',
      stage: 'labs_baseline',
      title: '🧪 Базовая лаборатория',
      timing: 'До начала дефицита',
      details: PREP_LAB_PANEL.slice(0, 4).map(l => `${l.name} — ${l.why}`),
      doctorRequired: true,
    },
    {
      id: 'monitoring',
      stage: 'monitoring',
      title: '📈 Мониторинг в подготовке',
      timing: 'Еженедельно',
      details: [
        'Вес: среднее за 7 дней (не единичное взвешивание), темп 0.25-0.75%/нед.',
        'HRV/сон/стресс — восстановление; при падении — снизить объём (уже в плане).',
        'Настроение/аппетит/энергия — биопсихосоциальный мониторинг (Chappell, Helms 2021).',
        'АД и пульс — при курсе/рисках.',
      ],
    },
    {
      id: 'hydration',
      stage: 'hydration',
      title: '💧 Гидратация и электролиты',
      timing: 'Вся подготовка + пик',
      details: PREP_HYDRATION_GUIDELINES,
    },
    {
      id: 'procedures',
      stage: 'procedures',
      title: '🩸 Процедуры под контролем врача',
      timing: 'По назначению врача',
      details: PREP_PROCEDURES.map(p => `${p.name} — ${p.indication}`),
      doctorRequired: true,
    },
    {
      id: 'post_show',
      stage: 'post_show',
      title: '🔄 Пост-шоу восстановление',
      timing: '1-4 нед после шоу',
      details: PREP_POST_SHOW.details,
    },
  ];

  // Рекомендованные процедуры по профилю (гарм-редукшн, только индикации).
  const recommended: string[] = [];
  if (cfg.enhanced) {
    recommended.push('bloodwork', 'ecg_cardio', 'endocrinology');
  } else {
    recommended.push('bloodwork');
  }
  recommended.push('iv_hydration'); // как опция при показаниях

  const procedures = PREP_PROCEDURES;
  const note = `Процесс подготовки (${prepPlan.category}, ${prepPlan.sex === 'female' ? 'женщина' : 'мужчина'}): мед-вход → базовая лаборатория → еженедельный мониторинг → гидратация/электролиты → процедуры под контролем врача → пост-шоу восстановление.`;

  return { steps, procedures, recommendedProcedures: recommended, labPanel: PREP_LAB_PANEL, hydrationGuidelines: PREP_HYDRATION_GUIDELINES, postShow: PREP_POST_SHOW, warnings, note };
}
