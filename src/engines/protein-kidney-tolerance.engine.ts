/**
 * protein-kidney-tolerance.engine.ts — «Белок и почки»: переносимость белка
 * по ОАМ (общий анализ мочи) + мочевине + креатинину/СКФ.
 *
 * Зачем отдельный движок:
 *  - Метаболика считает «сколько белка нужно», но не отвечает на вопрос
 *    «сколько белка ещё можно добавить, если почки уже нагружены».
 *  - Ответ нельзя строить по одному креатинину: высокий белок и обезвоживание
 *    поднимают мочевину без повреждения почек, а протеинурия/гематурия наоборот
 *    требуют снижения белка даже при нормальной СКФ.
 *
 * Что считаем:
 *  1) CKD-EPI 2021 (race-free) по креатинину, стадии G1–G5.
 *  2) Альбуминурию/протеинурию A1–A3 по UACR или UPCR (KDIGO 2024).
 *  3) BUN/креатинин — преренальный паттерн, но с честной оговоркой о слабости
 *     признака (высокий белок/дегидратация/ЖК-кровотечение дают тот же сдвиг).
 *  4) Осмолярную нагрузку (RSL) и необходимый объём мочи/воды.
 *  5) Потолок белка (g/кг) и «возможную прибавку» с шагом и контролем.
 *
 * Источники:
 *  - KDIGO 2024 CKD: белок 0.8 г/кг при G3–G5; избегать >1.3 г/кг при риске
 *    прогрессии; категории альбуминурии A1/A2/A3.
 *  - CKD-EPI 2021 creatinine equation (race-free).
 *  - ISSN/Helms: силовой тренинг 1.6–2.2 г/кг; приём 0.4 г/кг за приём.
 *  - RSL взрослых: 5.8 мОсм на 1 г белка + Na + K + Cl (мЭкв) — учебная
 *    формула клинического питания (B).
 *  - Uosm ≈ (SG − 1.000) × 40 000 — приближение, ломается при глюкозе,
 *    протеинурии и контрасте (C).
 *
 * ВАЖНО: это не диагноз. Движок не назначает лечение и не заменяет врача.
 */
import { localIsoDate, localIsoDateOffset } from '../core/local-date';

export type PkSex = 'male' | 'female';
export type PkTraining = 'sedentary' | 'recreational' | 'resistance' | 'athlete';
export type PkGoal = 'cut' | 'maintain' | 'bulk';
export type PkLevel = 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
export type PkFlagSeverity = 'info' | 'warn' | 'danger';
export type GfrCategory = 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5' | 'unknown';
export type AlbuminuriaCategory = 'A1' | 'A2' | 'A3' | 'unknown';

export interface ProteinKidneyInput {
  /** Текущий вес, кг. */
  weightKg: number;
  heightCm?: number;
  age: number;
  sex: PkSex;
  training: PkTraining;
  goal: PkGoal;
  /** Сколько белка человек ест сейчас, г/сут. */
  proteinGPerDay: number;
  /** Выпиваемая вода, мл/сут. */
  waterMlPerDay?: number;
  /** % жира — для оценки тощей массы (необязательно). */
  bodyFatPct?: number;
  creatineUse?: boolean;
  knownCkd?: boolean;
  /** Приём ААС (анаболических стероидов): меняет трактовку креатинина и потолок. */
  aasUse?: boolean;
  /** Кровь. */
  ureaMmolL?: number;
  creatinineUmolL?: number;
  /** Измеренная СКФ (если лаборатория уже посчитала). */
  egfrMeasured?: number;
  /** Электролиты рациона (не крови), для RSL. */
  dietarySodiumG?: number;
  dietaryPotassiumG?: number;
  dietaryChlorideG?: number;
  /** ОАМ. */
  urineSg?: number;
  urinePh?: number;
  /** Тест-полоска: 0=neg, 0.5=следы, 1=+, 2=++, 3=+++, 4=++++. */
  urineProteinScore?: number;
  /** Количественный белок мочи, г/л. */
  urineProteinGL?: number;
  /** Креатинин мочи, ммоль/л (для UPCR). */
  urineCreatinineMmolL?: number;
  /** Микроальбумин мочи, мг/л. */
  microalbuminMgL?: number;
  /** Готовый альбумин/креатинин, мг/ммоль. */
  uacrMgMmol?: number;
  urineVolume24hMl?: number;
  urineLeuPerUl?: number;
  urineEryPerUl?: number;
  urineNitriteScore?: number;
  urineGlucoseScore?: number;
  urineKetonesScore?: number;
  urineCastsPerUl?: number;
  /** Планируемая прибавка белка, г/сут (what-if). */
  plannedIncreaseGPerDay?: number;
  /** Сколько приёмов пищи в день (если пользователь задал). */
  mealsPerDay?: number;
}

export interface PkSignal {
  key: string;
  label: string;
  value: string;
  points: number;
  max: number;
  color: string;
  note?: string;
}

export interface PkFlag {
  code: string;
  severity: PkFlagSeverity;
  title: string;
  detail: string;
}

export interface PkEvidence {
  id: string;
  text: string;
  grade: 'A' | 'B' | 'C' | 'E';
}

export interface PkStep {
  totalProteinG: number;
  gPerKg: number;
  afterDays: number;
  note: string;
  /** Шаг выше доказанной пользы (> benefit cap): переносимость есть, смысла мало. */
  beyondBenefit: boolean;
}

export interface PkPlan {
  increaseG: number;
  totalG: number;
  gPerKg: number;
  withinCap: boolean;
  /** Влезает в потолок пользы (не только переносимости). */
  withinBenefit: boolean;
  /** Влезает в потолок переносимости. */
  withinTolerance: boolean;
  extraWaterMl: number;
}

export type PkUtilizationStatus = 'handled' | 'partial' | 'excess' | 'unknown';

/**
 * Ответ на вопрос «белок усваивается?».
 *
 * Важно: анализами нельзя измерить долю белка, ушедшую в мышцы. Мочевина и
 * BUN/креатинин показывают, как организм выводит азотистую нагрузку: если она
 * в норме при высоком белке — нагрузка переносится; если мочевина растёт —
 * часть аминокислот окисляется/выводится, и добавлять белок бессмысленно.
 */
export interface PkUtilization {
  status: PkUtilizationStatus;
  label: string;
  detail: string;
  color: string;
  confidence: 'high' | 'medium' | 'low';
  /** Значения, на которых построен вывод. */
  markers: string[];
}

export type PkStatus = 'above_tolerance' | 'above_benefit' | 'within' | 'below_min';

/**
 * Когда пересдать анализы. Дата считается от сегодня, чтобы её можно было
 * показать человеку и он не «забыл через две недели».
 */
export interface PkRetest {
  afterDays: number;
  date: string;
  title: string;
  reason: string;
  items: string[];
  urgent: boolean;
  color: string;
}

export interface ProteinKidneyResult {
  weightKg: number;
  bmi?: number;
  leanMassKg?: number;

  proteinGPerDay: number;
  proteinGPerKg: number;
  /** Потолок переносимости по почкам (может быть выше спортивной пользы). */
  capGPerKg: number;
  capGPerDay: number;
  /** Потолок доказанной пользы (1.6–2.2 г/кг). */
  benefitCapGPerKg: number;
  benefitCapGPerDay: number;
  capReasons: string[];
  /** Запас до потолка пользы, г/сут. */
  headroomGPerDay: number;
  headroomGPerKg: number;
  /** Запас до потолка переносимости, г/сут. */
  toleranceHeadroomGPerDay: number;
  increaseAllowed: boolean;
  /** Можно ли расти по переносимости (даже если польза уже исчерпана). */
  canIncreaseToTolerance: boolean;
  increasePaused: boolean;
  pauseReason?: string;
  status: PkStatus;
  utilization: PkUtilization;
  /** Когда и что пересдать. */
  retest: PkRetest;
  /** Откуда взялся потолок пользы — чтобы «пользы нет» не было голословным. */
  benefitBasis: string;
  /** Белок в г/кг тощей массы и те же потолки на LBM (для атлетов). */
  proteinGPerKgLbm?: number;
  benefitCapLbmGPerKg?: number;
  toleranceCapLbmGPerKg?: number;

  egfr?: number;
  egfrSource: 'measured' | 'ckd-epi' | 'none';
  gfrCategory: GfrCategory;
  bunMgDl?: number;
  bunCreatinineRatio?: number;
  bunCrPattern: 'low' | 'normal' | 'high' | 'unknown';

  albuminuriaCategory: AlbuminuriaCategory;
  uacrMgMmol?: number;
  uacrMgG?: number;
  albuminuriaSource: 'uacr' | 'microalbumin' | 'protein' | 'dipstick' | 'none';

  urineOsmolality?: number;
  urineOsmolalityRange?: [number, number];
  rslMOsmPerDay: number;
  rslProteinPart: number;
  rslElectrolytePart: number;
  rslElectrolytesKnown: boolean;
  urineVolumeNeededMl: number;
  waterTargetMl: number;
  waterActualMl?: number;
  waterDeficitMl?: number;
  hydrationStatus: 'unknown' | 'good' | 'borderline' | 'dehydrated';
  concentrationRisk: 'low' | 'moderate' | 'high';

  score: number;
  level: PkLevel;
  levelLabel: string;
  color: string;
  signals: PkSignal[];
  flags: PkFlag[];
  recommendations: string[];
  steps: PkStep[];

  perMealProteinG: number;
  maxPerMealProteinG: number;
  recommendedMeals: number;
  planned: PkPlan | null;

  evidence: PkEvidence[];
  disclaimer: string;
}

const LEVELS: Array<{ min: number; level: PkLevel; label: string; color: string }> = [
  { min: 70, level: 'critical', label: 'Критическая', color: '#ef4444' },
  { min: 50, level: 'high', label: 'Высокая', color: '#f97316' },
  { min: 30, level: 'elevated', label: 'Повышенная', color: '#f59e0b' },
  { min: 15, level: 'moderate', label: 'Умеренная', color: '#eab308' },
  { min: 0, level: 'low', label: 'Низкая', color: '#22c55e' },
];

const BASE_CAP: Record<PkTraining, number> = {
  sedentary: 1.6,
  recreational: 1.8,
  resistance: 2.2,
  athlete: 2.2,
};

/**
 * Потолок переносимости для здоровых почек, г/кг.
 *
 * Источник: ISSN 2017 (польза до ~2.2 г/кг) + Antonio et al. 2016 (до 3.3 г/кг
 * у тренированных мужчин год без изменения функции почек) + Helms (до ~3.1 г/кг
 * LBM в дефиците). Это НЕ рекомендация есть столько: выше 2.2 г/кг пользы для
 * мышц не добавляется, поэтому в UI это отдельный, «серый» потолок.
 */
const EXTENDED_CAP: Record<PkTraining, number> = {
  sedentary: 2.0,
  recreational: 2.6,
  resistance: 3.0,
  athlete: 3.0,
};

/**
 * Переносимость для тренирующихся на ААС, г/кг BW.
 *
 * Обоснование: у атлетов на ААС больше тощей массы и сильнее задержка азота,
 * поэтому верхняя граница переносимости смещается к 3.2 г/кг — это всё ещё
 * внутри данных Antonio 2016 (2.5–3.3 г/кг год без изменений функции почек).
 * Отдельных RCT «белок × ААС» нет, поэтому это переносимость, а не польза.
 */
const AAS_EXTENDED_CAP: Record<PkTraining, number> = {
  sedentary: 2.2,
  recreational: 2.8,
  resistance: 3.2,
  athlete: 3.2,
};

/** Почему потолок пользы именно такой — источник, а не «цифра с потолка». */
const BENEFIT_BASIS: Record<PkTraining, string> = {
  sedentary: '1.6 г/кг — верх общей рекомендации (ISSN 2017: 1.4–2.0 г/кг)',
  recreational: '1.8 г/кг — тренировки без цели гипертрофии (ISSN 2017: 1.4–2.0 г/кг)',
  resistance: '2.2 г/кг — верх плато дозы для гипертрофии (Morton 2018: перелом ~1.6 г/кг, 95% CI до 2.2; ISSN 2017: 1.6–2.2)',
  athlete: '2.2 г/кг — верх плато дозы для гипертрофии (Morton 2018: перелом ~1.6 г/кг, 95% CI до 2.2; ISSN 2017: 1.6–2.2)',
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const r1 = (v: number): number => Math.round(v * 10) / 10;
const r0 = (v: number): number => Math.round(v);

/** 'YYYY-MM-DD' → 'DD.MM.YYYY' для текста рекомендации. */
const ruDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

/** CKD-EPI 2021 (race-free). Креатинин — мкмоль/л, результат — мл/мин/1.73 м². */
export function ckdEpi2021(creatinineUmolL: number, age: number, sex: PkSex): number {
  if (!Number.isFinite(creatinineUmolL) || creatinineUmolL <= 0 || !Number.isFinite(age) || age <= 0) {
    return NaN;
  }
  const scr = creatinineUmolL / 88.4;
  const kappa = sex === 'female' ? 0.7 : 0.9;
  const alpha = sex === 'female' ? -0.241 : -0.302;
  const femaleFactor = sex === 'female' ? 1.012 : 1;
  return (
    142 *
    Math.pow(Math.min(scr / kappa, 1), alpha) *
    Math.pow(Math.max(scr / kappa, 1), -1.2) *
    Math.pow(0.9938, age) *
    femaleFactor
  );
}

export function gfrCategoryOf(egfr?: number): GfrCategory {
  if (egfr == null || !Number.isFinite(egfr) || egfr <= 0) return 'unknown';
  if (egfr >= 90) return 'G1';
  if (egfr >= 60) return 'G2';
  if (egfr >= 45) return 'G3a';
  if (egfr >= 30) return 'G3b';
  if (egfr >= 15) return 'G4';
  return 'G5';
}

export const GFR_CATEGORY_LABEL: Record<GfrCategory, string> = {
  G1: 'G1 · ≥90',
  G2: 'G2 · 60–89',
  G3a: 'G3a · 45–59',
  G3b: 'G3b · 30–44',
  G4: 'G4 · 15–29',
  G5: 'G5 · <15',
  unknown: 'СКФ нет',
};

export const ALBUMINURIA_LABEL: Record<AlbuminuriaCategory, string> = {
  A1: 'A1 · норма',
  A2: 'A2 · умеренная',
  A3: 'A3 · выраженная',
  unknown: 'нет данных',
};

/** Категория альбуминурии по UACR (мг/ммоль). Границы KDIGO 2024. */
export function classifyAlbuminuria(uacrMgMmol?: number): AlbuminuriaCategory {
  if (uacrMgMmol == null || !Number.isFinite(uacrMgMmol) || uacrMgMmol < 0) return 'unknown';
  if (uacrMgMmol < 3) return 'A1';
  if (uacrMgMmol <= 30) return 'A2';
  return 'A3';
}

/** Оценка осмолярности мочи по удельному весу: (SG−1)×40 000, диапазон ±15%. */
export function estimateUrineOsmolality(urineSg?: number): { value?: number; range?: [number, number] } {
  if (urineSg == null || !Number.isFinite(urineSg) || urineSg < 1.000 || urineSg > 1.060) return {};
  const value = (urineSg - 1.0) * 40000;
  return { value: r0(value), range: [r0(value * 0.85), r0(value * 1.15)] };
}

/**
 * Потенциальная осмолярная нагрузка (RSL), мОсм/сут.
 * Взрослые: 5.8 мОсм/г белка + Na + K + Cl (мЭкв).
 * Cl по умолчанию = Na, если задан только натрий.
 */
export function renalSoluteLoad(args: {
  proteinGPerDay: number;
  dietarySodiumG?: number;
  dietaryPotassiumG?: number;
  dietaryChlorideG?: number;
}): { total: number; proteinPart: number; electrolytePart: number; electrolytesKnown: boolean } {
  const proteinPart = Math.max(0, args.proteinGPerDay) * 5.8;
  const na = args.dietarySodiumG != null ? Math.max(0, args.dietarySodiumG) * 43.5 : null;
  const k = args.dietaryPotassiumG != null ? Math.max(0, args.dietaryPotassiumG) * 25.6 : null;
  const cl = args.dietaryChlorideG != null
    ? Math.max(0, args.dietaryChlorideG) * 28.2
    : (na != null ? na : null);
  const electrolytePart = (na ?? 0) + (k ?? 0) + (cl ?? 0);
  return {
    total: r0(proteinPart + electrolytePart),
    proteinPart: r0(proteinPart),
    electrolytePart: r0(electrolytePart),
    electrolytesKnown: na != null || k != null || cl != null,
  };
}

/**
 * Потолок белка, г/кг/сут. Возвращает **потолок переносимости**:
 *  - база = спортивная польза (1.6–2.2 г/кг);
 *  - если есть почечные/острые ограничения — снижаем;
 *  - если все маркеры чистые — расширяем до переносимости (до 3.0 г/кг),
 *    но это не рекомендация: пользы сверх базы не добавляет.
 */
export function proteinToleranceCap(args: {
  training: PkTraining;
  age: number;
  knownCkd?: boolean;
  aasUse?: boolean;
  egfr?: number;
  albuminuria?: AlbuminuriaCategory;
  proteinuriaScore?: number;
  urineProteinGL?: number;
  hematuria?: boolean;
  infectionSigns?: boolean;
  ureaMmolL?: number;
  urineSg?: number;
}): { cap: number; reasons: string[] } {
  const benefit = BASE_CAP[args.training] ?? 2.2;
  let cap = benefit;
  const reasons: string[] = [`Польза: до ${r1(benefit)} г/кг`];

  const lower = (v: number, why: string) => {
    if (v < cap) {
      cap = v;
      reasons.push(why);
    }
  };

  if (args.knownCkd) lower(0.8, 'Известная ХБП: 0.8 г/кг (KDIGO 2024)');
  if (args.age >= 65) lower(1.8, 'Возраст ≥65: осторожный потолок 1.8 г/кг');

  const egfr = args.egfr;
  if (egfr != null && Number.isFinite(egfr)) {
    if (egfr < 30) lower(0.8, `СКФ ${r0(egfr)}: ≤0.8 г/кг + нефролог`);
    else if (egfr < 45) lower(0.8, `СКФ ${r0(egfr)}: ≤0.8 г/кг (G3b/G4)`);
    else if (egfr < 60) lower(1.0, `СКФ ${r0(egfr)}: ≤1.0 г/кг (G3a)`);
  }

  if (args.albuminuria === 'A3') lower(1.0, 'A3 (UACR >30 мг/ммоль): ≤1.0 г/кг + нефролог');
  else if (args.albuminuria === 'A2') lower(1.3, 'A2 (UACR 3–30 мг/ммоль): ≤1.3 г/кг');

  const score = args.proteinuriaScore;
  if (score != null && score >= 2) lower(1.3, 'Белок мочи ≥2+: ≤1.3 г/кг');
  else if (score != null && score >= 1) lower(1.8, 'Белок мочи 1+: ≤1.8 г/кг до повторного анализа');
  if (args.urineProteinGL != null && args.urineProteinGL >= 1) lower(1.3, 'Белок мочи ≥1 г/л: ≤1.3 г/кг');

  if (args.hematuria && (args.albuminuria === 'A2' || args.albuminuria === 'A3' || (score ?? 0) >= 1)) {
    lower(1.2, 'Гематурия + протеинурия: ≤1.2 г/кг + нефролог');
  }
  if (args.infectionSigns) lower(1.8, 'Признаки ИМП: белок мочи может быть ложным, потолок временно 1.8 г/кг');

  const urea = args.ureaMmolL;
  if (urea != null && Number.isFinite(urea)) {
    if (urea > 20) lower(0.8, `Мочевина ${r1(urea)}: ≤0.8 г/кг, срочно к врачу`);
    else if (urea > 12) lower(1.2, `Мочевина ${r1(urea)}: ≤1.2 г/кг`);
    else if (urea > 8.3) lower(1.8, `Мочевина ${r1(urea)}: ≤1.8 г/кг до нормализации`);
  }

  // Расширение до переносимости — только когда ни одно ограничение не сработало
  // и есть подтверждённо чистые почки. Без анализов не расширяем: «не знаю» ≠ «здоров».
  // На ААС порог СКФ ниже (75): креатинин завышен мышцами, CKD-EPI занижает СКФ.
  const egfrFloor = args.aasUse ? 75 : 90;
  const renalClean =
    cap === benefit &&
    !args.knownCkd &&
    args.age < 65 &&
    egfr != null && Number.isFinite(egfr) && egfr >= egfrFloor &&
    urea != null && Number.isFinite(urea) && urea <= 8.3 &&
    (args.albuminuria == null || args.albuminuria === 'A1' || args.albuminuria === 'unknown') &&
    (score == null || score < 0.5) &&
    (args.urineProteinGL == null || args.urineProteinGL < 0.3) &&
    !args.hematuria &&
    !args.infectionSigns &&
    (args.urineSg == null || args.urineSg <= 1.03);
  if (renalClean) {
    const ext = (args.aasUse ? AAS_EXTENDED_CAP : EXTENDED_CAP)[args.training] ?? benefit;
    if (ext > cap) {
      cap = ext;
      reasons.push(args.aasUse
        ? `ААС + чистые анализы: переносимость до ${r1(ext)} г/кг (больше тощей массы; СКФ по креатинину может быть занижена — проверьте цистатин C)`
        : `Почки без отклонений: переносимость до ${r1(ext)} г/кг (здоровые тренированные; сверх ${r1(benefit)} пользы не добавляет)`);
    }
  }

  return { cap: r1(clamp(cap, 0.6, 3.2)), reasons };
}

function scoreLevel(score: number): { level: PkLevel; label: string; color: string } {
  const hit = LEVELS.find((l) => score >= l.min) ?? LEVELS[LEVELS.length - 1]!;
  return { level: hit.level, label: hit.label, color: hit.color };
}

/**
 * Вывод «усваивается ли белок» по доступным анализам.
 *
 * Честная рамка: ни мочевина, ни ОАМ не измеряют всасывание/синтез мышц.
 * Они показывают, как выводится азотистая нагрузка. Именно это и отвечает на
 * практический вопрос «есть ли смысл добавлять белок»: если азот выводится
 * нормально — нагрузка переносится; если мочевина растёт — избыток окисляется.
 */
function buildUtilization(args: {
  ureaMmolL?: number;
  bunCrPattern: 'low' | 'normal' | 'high' | 'unknown';
  bunCreatinineRatio?: number;
  egfr?: number;
  albuminuria: AlbuminuriaCategory;
  uacrMgMmol?: number;
  proteinuriaScore?: number;
  urineProteinGL?: number;
  proteinGkg: number;
  benefitCapGPerKg: number;
  /** СКФ посчитана по креатинину у человека на ААС — она может быть занижена. */
  aasCreatinineEgfr?: boolean;
  hydrationStatus: 'unknown' | 'good' | 'borderline' | 'dehydrated';
}): PkUtilization {
  const markers: string[] = [];
  if (args.ureaMmolL != null) markers.push(`мочевина ${r1(args.ureaMmolL)}`);
  if (args.bunCreatinineRatio != null) markers.push(`BUN/Cr ${args.bunCreatinineRatio}`);
  if (args.egfr != null) markers.push(`СКФ ${r0(args.egfr)}`);
  if (args.uacrMgMmol != null) markers.push(`UACR ${r1(args.uacrMgMmol)}`);
  const gkg = r1(args.proteinGkg);

  const urea = args.ureaMmolL;
  const confident = urea != null && args.egfr != null;
  const confidence: PkUtilization['confidence'] = args.aasCreatinineEgfr
    ? (confident ? 'medium' : 'low')
    : confident ? 'high' : urea != null ? 'medium' : 'low';

  if (urea == null) {
    return {
      status: 'unknown',
      label: 'Нужна мочевина',
      detail: 'ОАМ и креатинин показывают почки, но не то, как выводится азот от белка. Чтобы ответить «усваивается или нет», введите мочевину крови (лучше вместе с креатинином).',
      color: '#94a3b8',
      confidence: 'low',
      markers,
    };
  }

  if (urea > 12) {
    return {
      status: 'excess',
      label: 'Не утилизируется в этом объёме',
      detail: `Мочевина ${r1(urea)} ммоль/л — азотистая нагрузка выше того, что организм справляется выводить. При ${gkg} г/кг заметная часть белка окисляется и уходит в азот, а не в пластику. Снизьте белок до потолка, добавьте воду и повторите urea/creatinine через 2–3 дня; при сохранении — врач.`,
      color: '#ef4444',
      confidence,
      markers,
    };
  }

  if (args.albuminuria === 'A3' || (args.proteinuriaScore ?? 0) >= 2 || (args.urineProteinGL ?? 0) >= 1) {
    const uacr = args.uacrMgMmol != null ? `UACR ${r1(args.uacrMgMmol)} мг/ммоль. ` : '';
    return {
      status: 'excess',
      label: 'Белок теряется с мочой',
      detail: `${uacr}Выраженная протеинурия: часть белка уходит в мочу, а не в пластику. Судить об «усвоении» по мочевине на таком фоне нельзя — сначала нефролог и повторный анализ, наращивание белка запрещено.`,
      color: '#ef4444',
      confidence,
      markers,
    };
  }

  if (urea > 8.3) {
    return {
      status: 'partial',
      label: 'Мочевина выше оптимума',
      detail: `Мочевина ${r1(urea)} ммоль/л выше оптимума: при ${gkg} г/кг часть белка, вероятно, окисляется и выводится. При нормальном креатинине это чаще белковая нагрузка или дефицит воды, а не болезнь. Сначала вода и повтор анализа — потом прибавка.`,
      color: '#f59e0b',
      confidence,
      markers,
    };
  }

  if (args.bunCrPattern === 'high') {
    return {
      status: 'partial',
      label: 'Признаки дегидратации',
      detail: `BUN/креатинин ${args.bunCreatinineRatio ?? '>20'} — преренальный паттерн: дегидратация или высокая белковая нагрузка. Почки могут быть ни при чём, но пока вода не восстановлена, судить об усвоении нельзя.`,
      color: '#f59e0b',
      confidence,
      markers,
    };
  }

  if (urea < 2.5 && args.proteinGkg >= 1.4) {
    return {
      status: 'unknown',
      label: 'Данные не сходятся',
      detail: `Мочевина ${r1(urea)} при заявленных ${gkg} г/кг выглядит низкой. Возможно, белка в дневнике меньше, чем в плане, много воды или есть особенности печени. Оценивать переносимость по такому анализу рано — перепроверьте дневник и анализ.`,
      color: '#94a3b8',
      confidence: 'low',
      markers,
    };
  }

  if (args.egfr != null && args.egfr < 60) {
    return {
      status: 'partial',
      label: 'Почки ограничивают',
      detail: `СКФ ${r0(args.egfr)} — фильтрация снижена, белок ${gkg} г/кг может выводиться не полностью. Ориентир — 0.8 г/кг (KDIGO 2024); наращивание только с нефрологом.`,
      color: '#f59e0b',
      confidence,
      markers,
    };
  }

  const waterNote = args.hydrationStatus === 'borderline'
    ? ' Моча концентрированная — добавьте воды, это улучшит выведение азота.'
    : args.hydrationStatus === 'dehydrated'
      ? ' Есть дефицит воды: сначала гидратация, иначе оценка занижена.'
      : '';
  const aasNote = args.aasCreatinineEgfr
    ? ' СКФ здесь по креатинину: на ААС она может быть занижена мышцами — для точности сдайте цистатин C.'
    : '';
  const benefit = r1(args.benefitCapGPerKg);
  const beyondBenefit = args.proteinGkg > args.benefitCapGPerKg
    ? ` Сверх ~${benefit} г/кг дополнительная мышечная польза в среднем не доказана (плато дозы): лишний белок окисляется. Поднимать выше есть смысл только при очень больших объёмах/дефиците калорий и с контролем анализов.`
    : '';

  return {
    status: 'handled',
    label: beyondBenefit ? `Переносится, но сверх ${benefit} польза не доказана` : 'Переносится',
    detail: `Мочевина, креатинин/СКФ и белок мочи в норме — азотистую нагрузку ${gkg} г/кг вы переносите.${beyondBenefit}${waterNote}${aasNote} Анализы показывают выведение азота, а не долю белка, ушедшую в мышцы.`,
    color: beyondBenefit ? '#eab308' : '#22c55e',
    confidence,
    markers,
  };
}

/**
 * Когда пересдать анализы. Логика зависит от того, что мы делаем с белком:
 * острые отклонения → быстро, плановая прибавка → 14 дней, стабильный режим → 3 месяца.
 */
function buildRetest(args: {
  hardStop: boolean;
  increasePaused: boolean;
  ureaHigh: boolean;
  hasBaseLabs: boolean;
  stepsPlanned: boolean;
  status: PkStatus;
  aasUse: boolean;
  today?: string;
}): PkRetest {
  const items = ['мочевина крови', 'креатинин крови', 'ОАМ — утренняя моча, средняя струя'];
  if (args.aasUse) items.push('цистатин C (eGFR-cys)', 'АД + гематокрит');
  if (args.hardStop || args.aasUse) items.push('UACR (альбумин/креатинин мочи)');

  const today = args.today ?? localIsoDate();
  const make = (afterDays: number, title: string, reason: string, color: string, urgent = false): PkRetest => ({
    afterDays,
    date: localIsoDateOffset(afterDays, new Date(`${today}T12:00:00`)),
    title,
    reason,
    items,
    urgent,
    color,
  });

  if (!args.hasBaseLabs) {
    return make(0, 'Сдать сейчас', 'Без мочевины и креатинина переносимость белка не оценить: ОАМ сам по себе не показывает выведение азота.', '#60a5fa');
  }
  if (args.ureaHigh) {
    return make(3, 'Пересдать через 2–3 дня', 'Мочевина >12: исключить ошибку анализа и ухудшение. Кровь — утром, без тяжёлой тренировки и большого белка накануне.', '#ef4444', true);
  }
  if (args.hardStop) {
    return make(14, 'Контроль через 2 недели', 'Пока белок не наращиваем: проверяем, стойкое ли отклонение, и не появилось ли новых признаков.', '#f97316', true);
  }
  if (args.increasePaused) {
    return make(7, 'Через 3–7 дней, после воды', 'Обезвоживание/инфекция завышают мочевину и белок мочи: сначала вода или лечение, потом анализ.', '#f59e0b');
  }
  if (args.stepsPlanned) {
    return make(14, 'Через 14 дней после первого шага', 'Проверяем, как почки отвечают на новый объём белка. Без этого шага прибавку не продолжаем.', '#22c55e');
  }
  if (args.status === 'above_tolerance') {
    return make(14, 'Через 14 дней после снижения', 'Убеждаемся, что мочевина и ОАМ вернулись к норме, прежде чем обсуждать любой рост белка.', '#f97316');
  }
  if (args.status === 'above_benefit') {
    return make(30, 'Через месяц', 'Выше ориентира пользы: проверяем переносимость на текущем объёме, затем — раз в 3 месяца.', '#eab308');
  }
  return make(90, 'Плановый контроль через 3 месяца', 'Стабильный режим: смотрим динамику мочевины, креатинина и ОАМ; UACR — раз в 6–12 месяцев.', '#22c55e');
}

/** Основной расчёт. Все входы необязательны, кроме веса/возраста/белка. */
export function calcProteinKidney(input: ProteinKidneyInput): ProteinKidneyResult {
  const weight = Math.max(20, Number(input.weightKg) || 0);
  const height = input.heightCm != null && input.heightCm > 0 ? input.heightCm : undefined;
  const age = Math.max(14, Number(input.age) || 0);
  const proteinG = Math.max(0, Number(input.proteinGPerDay) || 0);
  const proteinGkg = weight > 0 ? proteinG / weight : 0;
  const bmi = height ? weight / Math.pow(height / 100, 2) : undefined;

  // Тощая масса: если % жира задан — по нему; иначе не выдумываем.
  const leanMassKg = input.bodyFatPct != null && input.bodyFatPct > 0 && input.bodyFatPct < 60
    ? weight * (1 - input.bodyFatPct / 100)
    : undefined;

  const egfrFromCr = input.creatinineUmolL != null && input.creatinineUmolL > 0
    ? ckdEpi2021(input.creatinineUmolL, age, input.sex)
    : undefined;
  const egfr = input.egfrMeasured != null && input.egfrMeasured > 0
    ? input.egfrMeasured
    : (egfrFromCr != null && Number.isFinite(egfrFromCr) ? r0(egfrFromCr) : undefined);
  const egfrSource: 'measured' | 'ckd-epi' | 'none' = input.egfrMeasured != null && input.egfrMeasured > 0
    ? 'measured'
    : (egfr != null ? 'ckd-epi' : 'none');
  const gfrCategory = gfrCategoryOf(egfr);

  const bunMgDl = input.ureaMmolL != null && input.ureaMmolL > 0 ? r1(input.ureaMmolL * 2.8) : undefined;
  const creatinineMgDl = input.creatinineUmolL != null && input.creatinineUmolL > 0
    ? input.creatinineUmolL / 88.4
    : undefined;
  const bunCr = bunMgDl != null && creatinineMgDl != null && creatinineMgDl > 0
    ? r1(bunMgDl / creatinineMgDl)
    : undefined;
  const bunCrPattern: 'low' | 'normal' | 'high' | 'unknown' = bunCr == null
    ? 'unknown'
    : bunCr < 10 ? 'low' : bunCr > 20 ? 'high' : 'normal';

  // ── Альбуминурия / протеинурия ───────────────────────────────────────────
  let uacrMgMmol = input.uacrMgMmol;
  let albuminuriaSource: 'uacr' | 'microalbumin' | 'protein' | 'dipstick' | 'none' = 'none';
  if (uacrMgMmol != null && uacrMgMmol >= 0) {
    albuminuriaSource = 'uacr';
  } else if (input.microalbuminMgL != null && input.urineCreatinineMmolL != null && input.urineCreatinineMmolL > 0) {
    uacrMgMmol = input.microalbuminMgL / input.urineCreatinineMmolL;
    albuminuriaSource = 'microalbumin';
  } else if (input.urineProteinGL != null && input.urineCreatinineMmolL != null && input.urineCreatinineMmolL > 0) {
    uacrMgMmol = (input.urineProteinGL * 1000) / input.urineCreatinineMmolL;
    albuminuriaSource = 'protein';
  }
  let albuminuriaCategory = classifyAlbuminuria(uacrMgMmol);
  if (albuminuriaCategory === 'unknown' && input.urineProteinScore != null) {
    // По тест-полоске категорию A ставить нельзя (нет креатинина мочи),
    // но сам факт протеинурии уже ограничивает потолок белка.
    albuminuriaSource = 'dipstick';
    albuminuriaCategory = input.urineProteinScore >= 2 ? 'A2' : input.urineProteinScore >= 1 ? 'A2' : 'unknown';
  }
  const uacrMgG = uacrMgMmol != null ? r1(uacrMgMmol * 8.84) : undefined;

  // ── Осмолярность мочи / вода ─────────────────────────────────────────────
  const osm = estimateUrineOsmolality(input.urineSg);
  const rsl = renalSoluteLoad({
    proteinGPerDay: proteinG,
    dietarySodiumG: input.dietarySodiumG,
    dietaryPotassiumG: input.dietaryPotassiumG,
    dietaryChlorideG: input.dietaryChlorideG,
  });
  // Цель — умеренная концентрация 600 мОсм/кг; минимум воды = объём мочи + 600 мл.
  const urineVolumeNeededMl = rsl.total > 0 ? r0((rsl.total / 600) * 1000) : 0;
  const waterTargetMl = r0(Math.max(weight * 35, urineVolumeNeededMl + 600));
  const waterActualMl = input.waterMlPerDay != null && input.waterMlPerDay > 0 ? input.waterMlPerDay : undefined;
  const waterDeficitMl = waterActualMl != null ? Math.max(0, waterTargetMl - waterActualMl) : undefined;

  const sg = input.urineSg;
  let hydrationStatus: 'unknown' | 'good' | 'borderline' | 'dehydrated' = 'unknown';
  if (sg != null && Number.isFinite(sg) && sg >= 1.000) {
    if (sg <= 1.015) hydrationStatus = 'good';
    else if (sg <= 1.020) hydrationStatus = 'good';
    else if (sg <= 1.025) hydrationStatus = 'borderline';
    else hydrationStatus = 'dehydrated';
  } else if (waterDeficitMl != null) {
    hydrationStatus = waterDeficitMl > 700 ? 'dehydrated' : waterDeficitMl > 300 ? 'borderline' : 'good';
  }

  let concentrationRisk: 'low' | 'moderate' | 'high' = 'low';
  if (sg != null && sg > 1.030) concentrationRisk = 'high';
  else if (sg != null && sg > 1.020) concentrationRisk = 'moderate';
  else if (waterDeficitMl != null && waterDeficitMl > 700) concentrationRisk = 'high';
  else if (waterDeficitMl != null && waterDeficitMl > 300) concentrationRisk = 'moderate';
  if (rsl.total > 0 && osm.value != null && osm.value > 800) concentrationRisk = 'high';

  // ── Флаги ────────────────────────────────────────────────────────────────
  const flags: PkFlag[] = [];
  const addFlag = (code: string, severity: PkFlagSeverity, title: string, detail: string) => {
    flags.push({ code, severity, title, detail });
  };

  if (egfr != null && egfr < 30) {
    addFlag('egfr_critical', 'danger', 'СКФ ниже 30', 'Это стадия G4–G5. Наращивание белка и высокобелковые диеты — только после нефролога. Срочно обсудите тактику.');
  } else if (egfr != null && egfr < 60) {
    addFlag('egfr_low', 'warn', 'СКФ ниже 60', 'Почечная фильтрация снижена. KDIGO 2024: белок 0.8 г/кг при G3–G5, избегать >1.3 г/кг. Нужен нефролог/диетолог.');
  }

  if (albuminuriaCategory === 'A3') {
    addFlag('albuminuria_a3', 'danger', 'Выраженная альбуминурия/протеинурия', 'UACR >30 мг/ммоль (или белок ≥3+). Не наращивайте белок до повторного анализа и консультации нефролога.');
  } else if (albuminuriaCategory === 'A2') {
    addFlag('albuminuria_a2', 'warn', 'Умеренная альбуминурия/протеинурия', 'UACR 3–30 мг/ммоль или белок 1–2+. Повторите анализ утром, исключите инфекцию и нагрузку; при стойкости — нефролог.');
  }

  const hematuria = (input.urineEryPerUl != null && input.urineEryPerUl > 3);
  if (hematuria && (albuminuriaCategory === 'A2' || albuminuriaCategory === 'A3' || (input.urineProteinScore ?? 0) >= 1)) {
    addFlag('hematuria_proteinuria', 'danger', 'Кровь + белок в моче', 'Такое сочетание требует очного осмотра и нефролога; не объясняйте его только тренировками.');
  } else if (hematuria) {
    addFlag('hematuria', 'warn', 'Эритроциты в моче', 'Изолированная гематурия бывает после нагрузки, но её нужно перепроверить и исключить урологическую причину.');
  }

  const infectionSigns = (input.urineNitriteScore ?? 0) >= 1 &&
    ((input.urineLeuPerUl ?? 0) > 10 || (input.urineLeuPerUl == null && (input.urineNitriteScore ?? 0) >= 1));
  if (infectionSigns) {
    addFlag('uti', 'warn', 'Возможна инфекция мочевых путей', 'Нитриты/лейкоциты могут давать ложную протеинурию. Повторите ОАМ после лечения и перед выводами о почках.');
  }

  if (input.ureaMmolL != null && input.ureaMmolL > 20) {
    addFlag('urea_critical', 'danger', 'Мочевина >20 ммоль/л', 'Это не «просто высокий белок». Нужен срочный врачебный разбор: обезвоживание, кровотечение, почечная недостаточность.');
  } else if (input.ureaMmolL != null && input.ureaMmolL > 12) {
    addFlag('urea_high', 'warn', 'Мочевина >12 ммоль/л', 'Проверьте гидратацию, тренировки и белок. Повторите urea/creatinine через 2–3 дня; при сохранении — врач.');
  } else if (input.ureaMmolL != null && input.ureaMmolL > 8.3) {
    addFlag('urea_borderline', 'warn', 'Мочевина выше нормы', 'Часто это высокая белковая нагрузка или дефицит воды, а не болезнь почек. Сначала вода и повтор анализа, потом прибавка белка.');
  }

  if (bunCrPattern === 'high') {
    addFlag('bun_cr_high', 'info', 'BUN/креатинин >20', 'Преренальный паттерн: дегидратация, высокий белок, катаболизм или ЖК-кровотечение. Сам по себе не диагноз, но прибавку белка лучше отложить до повтора.');
  } else if (bunCrPattern === 'low') {
    addFlag('bun_cr_low', 'info', 'BUN/креатинин <10', 'Бывает при низком белке, болезни печени, высоком креатинине или большой мышечной массе. Смотрите на СКФ и ОАМ, а не на ratio.');
  }

  if (sg != null && sg > 1.030) {
    addFlag('concentrated_urine', 'warn', 'Очень концентрированная моча', `SG ${sg.toFixed(3)}. Это признак дефицита воды; на таком фоне высокий белок и камни рискованны. Сначала гидратация.`);
  }

  if ((input.urineGlucoseScore ?? 0) >= 1) {
    addFlag('glycosuria', 'warn', 'Глюкоза в моче', 'Проверьте глюкозу крови/HbA1c. Глюкоза завышает SG и может искажать оценку концентрации.');
  }
  if ((input.urineKetonesScore ?? 0) >= 2) {
    addFlag('ketonuria', 'info', 'Кетоны в моче', 'На низкоуглеводной диете это ожидаемо; при высоком уровне глюкозы крови — срочно к врачу.');
  }
  if ((input.urineCastsPerUl ?? 0) > 2) {
    addFlag('casts', 'warn', 'Цилиндры в моче', 'Гиалиновые цилиндры бывают после нагрузки; зернистые/эритроцитарные — повод для очного разбора.');
  }

  if (input.knownCkd) {
    addFlag('known_ckd', 'warn', 'Известная ХБП', 'Целевой белок 0.8 г/кг (KDIGO 2024). Любое повышение — только с нефрологом/диетологом.');
  }
  if (input.creatineUse) {
    addFlag('creatine', 'info', 'Креатин влияет на креатинин', 'Креатин может поднимать креатинин без повреждения почек. Оценивайте СКФ в динамике и не пугайтесь одного числа.');
  }
  if (input.aasUse) {
    addFlag('aas', 'info', 'ААС: как читать анализы',
      'Креатинин завышен мышечной массой — CKD-EPI может занижать СКФ: подтвердите цистатин C (eGFR-cys) или измеренную СКФ. Потолок расширен до 3.2 г/кг только при чистых мочевине/моче/СКФ. Контроль на ААС: АД, гематокрит, липиды, ОАМ + UACR каждые 3–6 мес.');
    if (egfr != null && egfrSource === 'ckd-epi' && egfr < 90) {
      addFlag('aas_egfr_artifact', 'warn', 'СКФ может быть занижена из-за мышц',
        `CKD-EPI по креатинину ${r0(egfr)} — на ААС это часто артефакт мышечной массы, а не снижение фильтрации. Решение о белке — по цистатину C/измеренной СКФ + мочевине и белку мочи.`);
    }
  }

  // ── Потолки и прибавка ───────────────────────────────────────────────────
  const benefitCapGkg = BASE_CAP[input.training] ?? 2.2;
  const benefitCapGday = r0(benefitCapGkg * weight);
  const capInfo = proteinToleranceCap({
    training: input.training,
    age,
    knownCkd: input.knownCkd,
    aasUse: input.aasUse,
    egfr,
    albuminuria: albuminuriaCategory,
    proteinuriaScore: input.urineProteinScore,
    urineProteinGL: input.urineProteinGL,
    hematuria,
    infectionSigns,
    ureaMmolL: input.ureaMmolL,
    urineSg: input.urineSg,
  });
  const capGkg = capInfo.cap;
  const capGday = r0(capGkg * weight);
  const headroom = Math.max(0, r0((benefitCapGkg - proteinGkg) * weight));
  const toleranceHeadroom = Math.max(0, r0((capGkg - proteinGkg) * weight));
  const overTolerance = Math.max(0, r0((proteinGkg - capGkg) * weight));
  const overBenefit = Math.max(0, r0((proteinGkg - benefitCapGkg) * weight));

  const hardStop = (egfr != null && egfr < 60) ||
    input.knownCkd === true ||
    albuminuriaCategory === 'A3' ||
    (input.urineProteinScore ?? 0) >= 2 ||
    (input.urineProteinGL ?? 0) >= 1 ||
    (input.ureaMmolL ?? 0) > 12;

  const pausedByHydration = hydrationStatus === 'dehydrated' || concentrationRisk === 'high';
  const pausedByUrea = (input.ureaMmolL ?? 0) > 8.3 || bunCrPattern === 'high';
  const pausedByInfection = infectionSigns;
  const increasePaused = !hardStop && (pausedByHydration || pausedByUrea || pausedByInfection);
  const increaseRecommended = !hardStop && !increasePaused && headroom >= 5;
  const canIncreaseToTolerance = !hardStop && !increasePaused && toleranceHeadroom >= 5;
  const increaseAllowed = increaseRecommended;
  const pauseReason = increasePaused
    ? (pausedByHydration
      ? 'Сначала вода: моча концентрированная. Наращивание белка на обезвоживании только увеличит осмолярную нагрузку.'
      : pausedByInfection
        ? 'Сначала лечение/повтор ОАМ: инфекция искажает белок мочи.'
        : 'Сначала нормализуйте мочевину/гидратацию и повторите анализ — потом прибавка белка.')
    : undefined;

  const status: PkStatus = proteinGkg > capGkg + 1e-9
    ? 'above_tolerance'
    : proteinGkg > benefitCapGkg + 1e-9 ? 'above_benefit'
      : proteinGkg < Math.min(1.2, benefitCapGkg) ? 'below_min'
        : 'within';

  // ── Усвоение / переносимость ─────────────────────────────────────────────
  const aasCreatinineEgfr = input.aasUse === true && egfrSource === 'ckd-epi';
  const utilization = buildUtilization({
    ureaMmolL: input.ureaMmolL,
    bunCrPattern,
    bunCreatinineRatio: bunCr,
    egfr,
    albuminuria: albuminuriaCategory,
    uacrMgMmol,
    proteinuriaScore: input.urineProteinScore,
    urineProteinGL: input.urineProteinGL,
    proteinGkg,
    benefitCapGPerKg: benefitCapGkg,
    aasCreatinineEgfr,
    hydrationStatus,
  });

  // ── Шаги наращивания ─────────────────────────────────────────────────────
  // Сначала ведём к потолку пользы. Если он уже исчерпан, но переносимость
  // позволяет — показываем «серые» шаги выше пользы (по запросу пользователя).
  const steps: PkStep[] = [];
  // На стопе или паузе шагов нет вообще: сначала безопасность, потом прибавка.
  const targetHeadroom = (hardStop || increasePaused)
    ? 0
    : headroom >= 5 ? headroom : (canIncreaseToTolerance ? toleranceHeadroom : 0);
  if (targetHeadroom >= 5) {
    const step = clamp(r0((targetHeadroom / 3) / 5) * 5, 5, 15);
    let cur = proteinG;
    for (let i = 1; i <= 8 && cur < proteinG + targetHeadroom; i++) {
      cur = Math.min(proteinG + targetHeadroom, cur + step);
      const gkg = cur / weight;
      const beyondBenefit = gkg > benefitCapGkg + 1e-9;
      steps.push({
        totalProteinG: r0(cur),
        gPerKg: r1(gkg),
        afterDays: i * 14,
        beyondBenefit,
        note: beyondBenefit
          ? `Сверх ${r1(benefitCapGkg)} г/кг прирост в среднем не ускоряется — только если есть причина (дефицит, большие объёмы). Пересдача анализов обязательна.`
          : i === 1
            ? `Первый шаг +${r0(cur - proteinG)} г/сут; через 10–14 дней — urea, creatinine, ОАМ.`
            : 'Следующий шаг только если предыдущий анализ без ухудшения.',
      });
      if (cur >= proteinG + targetHeadroom) break;
    }
  }

  // ── Когда пересдать ──────────────────────────────────────────────────────
  const retest = buildRetest({
    hardStop,
    increasePaused,
    ureaHigh: (input.ureaMmolL ?? 0) > 12,
    hasBaseLabs: input.ureaMmolL != null || input.creatinineUmolL != null || input.egfrMeasured != null,
    stepsPlanned: steps.length > 0,
    status,
    aasUse: input.aasUse === true,
  });

  // ── Индекс нагрузки ──────────────────────────────────────────────────────
  const signals: PkSignal[] = [];
  const addSignal = (key: string, label: string, value: string, points: number, max: number, color: string, note?: string) => {
    signals.push({ key, label, value, points, max, color, note });
  };

  // СКФ
  {
    const p = egfr == null ? 0 : egfr < 15 ? 50 : egfr < 30 ? 38 : egfr < 45 ? 26 : egfr < 60 ? 16 : egfr < 90 ? 5 : 0;
    addSignal('egfr', 'СКФ', egfr == null ? 'нет' : `${r0(egfr)} · ${gfrCategory}`, p, 50,
      p >= 26 ? '#ef4444' : p >= 16 ? '#f97316' : p > 0 ? '#eab308' : '#22c55e',
      egfrSource === 'ckd-epi' ? 'рассчитана по CKD-EPI 2021' : egfrSource === 'measured' ? 'из лаборатории' : 'нужен креатинин');
  }
  // Мочевина
  {
    const u = input.ureaMmolL;
    const p = u == null ? 0 : u > 20 ? 30 : u > 12 ? 22 : u > 8.3 ? 13 : u > 6.5 ? 5 : 0;
    addSignal('urea', 'Мочевина', u == null ? 'нет' : `${r1(u)} ммоль/л`, p, 30,
      p >= 22 ? '#ef4444' : p >= 13 ? '#f97316' : p > 0 ? '#eab308' : '#22c55e',
      'высокий белок/дегидратация тоже поднимают');
  }
  // Альбуминурия/белок
  {
    const p = albuminuriaCategory === 'A3' ? 35 : albuminuriaCategory === 'A2' ? 16 : albuminuriaCategory === 'A1' ? 0 : 0;
    addSignal('albuminuria', 'Белок мочи', ALBUMINURIA_LABEL[albuminuriaCategory], p, 35,
      p >= 35 ? '#ef4444' : p >= 16 ? '#f97316' : '#22c55e',
      uacrMgMmol != null ? `UACR ${r1(uacrMgMmol)} мг/ммоль` : albuminuriaSource === 'dipstick' ? 'по тест-полоске' : 'нужен UACR/UPCR');
  }
  // Концентрация
  {
    const p = sg == null ? 0 : sg > 1.030 ? 20 : sg > 1.025 ? 14 : sg > 1.020 ? 8 : sg > 1.015 ? 3 : 0;
    addSignal('sg', 'Концентрация', sg == null ? 'нет' : sg.toFixed(3), p, 20,
      p >= 14 ? '#f97316' : p >= 8 ? '#eab308' : '#22c55e',
      osm.value != null ? `≈${osm.value} мОсм/кг (оценка)` : 'SG из ОАМ');
  }
  // Текущая нагрузка
  {
    const p = proteinGkg > 3.2 ? 24 : proteinGkg > 2.6 ? 16 : proteinGkg > 2.2 ? 9 : proteinGkg > 1.6 ? 4 : 0;
    addSignal('load', 'Белок сейчас', `${r1(proteinGkg)} г/кг`, p, 24,
      p >= 16 ? '#f97316' : p >= 9 ? '#eab308' : '#22c55e',
      `${r0(proteinG)} г/сут`);
  }
  // Воспаление/кровь/цилиндры
  {
    let p = 0;
    if (hematuria) p += 6;
    if (infectionSigns) p += 8;
    if ((input.urineCastsPerUl ?? 0) > 2) p += 6;
    addSignal('sediment', 'Осадок мочи', hematuria || infectionSigns || (input.urineCastsPerUl ?? 0) > 2 ? 'есть отклонения' : 'без отклонений', p, 20,
      p >= 12 ? '#ef4444' : p > 0 ? '#f59e0b' : '#22c55e',
      'эритроциты/лейкоциты/цилиндры');
  }

  const rawScore = signals.reduce((s, x) => s + x.points, 0);
  const score = clamp(r0(rawScore), 0, 100);
  const lvl = scoreLevel(score);

  // ── Рекомендации ─────────────────────────────────────────────────────────
  const recs: string[] = [];
  if (utilization.status === 'excess') {
    recs.push(`Признаки перегрузки: ${utilization.label.toLowerCase()}. Сначала снизьте белок до ${capGday} г/сут, добавьте воду и повторите анализы.`);
  } else if (utilization.status === 'partial') {
    recs.push(`Ограничение по переносимости: ${utilization.label.toLowerCase()}. Прибавка — только после повторного анализа (2–3 дня) и нормализации воды.`);
  } else if (utilization.status === 'handled' && proteinGkg > benefitCapGkg) {
    recs.push(`Анализы в норме: ${r1(proteinGkg)} г/кг переносятся. Но дополнительной пользы сверх ${r1(benefitCapGkg)} г/кг в среднем не доказано — прибавка имеет смысл только по причине (дефицит, очень большие объёмы) и с контролем.`);
  }
  if (status === 'above_tolerance') {
    recs.push(`Сейчас белка на ${overTolerance} г/сут больше потолка переносимости (${r1(capGkg)} г/кг). Снизьте до ${capGday} г/сут и повторите urea/creatinine/ОАМ через 2–3 недели.`);
  } else if (status === 'above_benefit') {
    recs.push(`Сейчас ${r1(proteinGkg)} г/кг — выше ориентира пользы на ${overBenefit} г/сут. Переносимость позволяет до ${r1(capGkg)} г/кг (${capGday} г/сут), но сверх ${r1(benefitCapGkg)} г/кг прирост в среднем не ускоряется: держите объём, если он нужен по другим причинам.`);
  } else if (increaseRecommended) {
    recs.push(`Потенциал прибавки: +${headroom} г/сут до ${r1(benefitCapGkg)} г/кг (${benefitCapGday} г/сут). Шаг — не больше 10–15 г/сут за 10–14 дней.`);
  } else if (hardStop) {
    recs.push(`Наращивание белка не рекомендуется: сначала врач/нефролог. Потолок для расчёта — ${r1(capGkg)} г/кг (${capGday} г/сут).`);
  }
  if (increasePaused && pauseReason) recs.push(`Пауза на прибавку: ${pauseReason}`);
  recs.push(`Вода: цель ~${waterTargetMl} мл/сут (35 мл/кг и не меньше объёма для выведения осмолей). ${waterActualMl != null ? `Сейчас ${waterActualMl} мл${waterDeficitMl ? `, не хватает ~${waterDeficitMl} мл` : ''}.` : 'Введите фактическое потребление воды для точной оценки.'}`);
  recs.push(`Белок дробить: ~${r0(proteinG / Math.max(1, input.mealsPerDay ?? 4))} г/приём, ориентир 0.4 г/кг (${r1(0.4 * weight)} г), верхний предел 0.55 г/кг (${r1(0.55 * weight)} г).`);
  if (
    (albuminuriaCategory !== 'A1' && albuminuriaCategory !== 'unknown') ||
    (input.urineProteinScore ?? 0) >= 1 ||
    (egfr != null && egfr < 60)
  ) {
    recs.push('Ограничьте соль до <2 г натрия/сут; НПВС (ибупрофен, напроксен) — избегать. При стойкой протеинурии обсудите нефропротекцию с врачом.');
  }
  recs.push(`Пересдать ${ruDate(retest.date)} (${retest.title.toLowerCase()}): ${retest.items.join(', ')}.`);
  if (input.aasUse) {
    recs.push('На ААС: цистатин C вместо оценки только по креатинину; АД, гематокрит и липиды — раз в 3–6 месяцев.');
  }
  if (leanMassKg != null) {
    recs.push(`Белок на тощую массу: ${r1(proteinG / leanMassKg)} г/кг LBM (ориентир 2.0–2.8 г/кг LBM для силовых, но потолок по почкам выше приоритета).`);
  }

  // ── What-if ──────────────────────────────────────────────────────────────
  let planned: PkPlan | null = null;
  const inc = Math.max(0, Number(input.plannedIncreaseGPerDay) || 0);
  if (inc > 0) {
    const total = proteinG + inc;
    const gkg = total / weight;
    planned = {
      increaseG: r0(inc),
      totalG: r0(total),
      gPerKg: r1(gkg),
      withinCap: gkg <= capGkg + 0.001 && !hardStop,
      withinBenefit: gkg <= benefitCapGkg + 0.001,
      withinTolerance: gkg <= capGkg + 0.001 && !hardStop,
      extraWaterMl: r0((inc * 5.8 / 600) * 1000),
    };
  }

  const perMealProteinG = r0(proteinG / Math.max(1, input.mealsPerDay ?? 4));
  const maxPerMealProteinG = r1(0.55 * weight);
  const recommendedMeals = clamp(r0(proteinG / Math.max(1, 0.4 * weight)), 3, 6);
  const proteinGPerKgLbm = leanMassKg != null && leanMassKg > 0 ? r1(proteinG / leanMassKg) : undefined;
  const benefitCapLbmGPerKg = leanMassKg != null && leanMassKg > 0 ? r1((benefitCapGkg * weight) / leanMassKg) : undefined;
  const toleranceCapLbmGPerKg = leanMassKg != null && leanMassKg > 0 ? r1((capGkg * weight) / leanMassKg) : undefined;
  const benefitBasis = `${BENEFIT_BASIS[input.training]}${input.aasUse
    ? ' На ААС отдельных RCT по белку нет: ориентир пользы тот же, а переносимость считается по тощей массе.'
    : ''}`;

  const evidence: PkEvidence[] = [
    { id: 'kdigo-2024', text: 'KDIGO 2024: при G3–G5 белок 0.8 г/кг/сут; избегать >1.3 г/кг при риске прогрессии.', grade: 'A' },
    { id: 'ckd-epi', text: 'CKD-EPI 2021 (race-free) — расчёт СКФ по креатинину, возрасту и полу.', grade: 'A' },
    { id: 'issn', text: 'ISSN/Helms: силовой тренинг 1.6–2.2 г/кг/сут; 0.4 г/кг за приём для максимальной стимуляции синтеза белка.', grade: 'A' },
    { id: 'antonio-2016', text: 'Antonio et al. 2016 (J Nutr Metab): 2.5–3.3 г/кг белка год у тренированных мужчин — без изменений функции почек. Это про переносимость, не про пользу: выше ~2.2 г/кг прирост мышц не ускоряется.', grade: 'B' },
    { id: 'morton-2018', text: 'Morton et al. 2018 (Br J Sports Med), мета-анализ 49 RCT: плато дозы белка для гипертрофии ~1.6 г/кг/сут, верхняя граница 95% CI ~2.2 г/кг. Отсюда «потолок пользы», а не из запрета.', grade: 'A' },
    { id: 'aas', text: 'Отдельных RCT «доза белка у людей на ААС» нет. ААС увеличивают тощую массу и задержку азота, поэтому переносимость считаем по LBM, а СКФ по креатинину подтверждаем цистатином C.', grade: 'E' },
    { id: 'utilization', text: 'Мочевина и BUN/креатинин отражают выведение азотистой нагрузки, а не долю белка, ушедшую в мышцы. Норма при высоком белке = нагрузка переносится; рост мочевины = избыток окисляется.', grade: 'B' },
    { id: 'uacr', text: 'KDIGO: альбуминурия A1 <3, A2 3–30, A3 >30 мг/ммоль (30/300 мг/г).', grade: 'A' },
    { id: 'rsl', text: 'Осмолярная нагрузка взрослых: ~5.8 мОсм на 1 г белка + Na + K + Cl (мЭкв).', grade: 'B' },
    { id: 'sg-osm', text: 'Оценка осмолярности мочи по SG: (SG−1)×40 000 — приближение, ломается при глюкозе/протеинурии.', grade: 'C' },
    { id: 'bun-cr', text: 'BUN/креатинин 10–20 — ориентир, а не диагноз: высокий белок и дегидратация дают тот же сдвиг.', grade: 'B' },
  ];

  return {
    weightKg: weight,
    bmi: bmi != null ? r1(bmi) : undefined,
    leanMassKg: leanMassKg != null ? r1(leanMassKg) : undefined,

    proteinGPerDay: r0(proteinG),
    proteinGPerKg: r1(proteinGkg),
    capGPerKg: capGkg,
    capGPerDay: capGday,
    benefitCapGPerKg: benefitCapGkg,
    benefitCapGPerDay: benefitCapGday,
    capReasons: capInfo.reasons,
    headroomGPerDay: headroom,
    headroomGPerKg: r1(Math.max(0, benefitCapGkg - proteinGkg)),
    toleranceHeadroomGPerDay: toleranceHeadroom,
    increaseAllowed,
    canIncreaseToTolerance,
    increasePaused,
    pauseReason,
    status,
    utilization,
    retest,
    benefitBasis,
    proteinGPerKgLbm,
    benefitCapLbmGPerKg,
    toleranceCapLbmGPerKg,

    egfr,
    egfrSource,
    gfrCategory,
    bunMgDl,
    bunCreatinineRatio: bunCr,
    bunCrPattern,

    albuminuriaCategory,
    uacrMgMmol: uacrMgMmol != null ? r1(uacrMgMmol) : undefined,
    uacrMgG,
    albuminuriaSource,

    urineOsmolality: osm.value,
    urineOsmolalityRange: osm.range,
    rslMOsmPerDay: rsl.total,
    rslProteinPart: rsl.proteinPart,
    rslElectrolytePart: rsl.electrolytePart,
    rslElectrolytesKnown: rsl.electrolytesKnown,
    urineVolumeNeededMl,
    waterTargetMl,
    waterActualMl,
    waterDeficitMl,
    hydrationStatus,
    concentrationRisk,

    score,
    level: lvl.level,
    levelLabel: lvl.label,
    color: lvl.color,
    signals,
    flags,
    recommendations: recs,
    steps,

    perMealProteinG,
    maxPerMealProteinG,
    recommendedMeals,
    planned,

    evidence,
    disclaimer: 'Инструмент для самонаблюдения и планирования, не диагноз. При СКФ <60, стойкой протеинурии, гематурии, мочевине >12 или любых симптомах — врач/нефролог. Не отменяйте назначения самостоятельно.',
  };
}

/** Сохранённый снимок для динамики. */
export interface ProteinKidneySnapshot {
  date: string;
  proteinGPerKg: number;
  proteinGPerDay: number;
  ureaMmolL?: number;
  creatinineUmolL?: number;
  egfr?: number;
  urineSg?: number;
  uacrMgMmol?: number;
  capGPerKg: number;
  headroomGPerDay: number;
  score: number;
  level: PkLevel;
}

export const PROTEIN_KIDNEY_HISTORY_KEY = 'he_protein_kidney_history_v1';
export const PROTEIN_KIDNEY_INPUT_KEY = 'he_protein_kidney_input_v1';

export function toSnapshot(input: ProteinKidneyInput, result: ProteinKidneyResult, date = localIsoDate()): ProteinKidneySnapshot {
  return {
    date,
    proteinGPerKg: result.proteinGPerKg,
    proteinGPerDay: result.proteinGPerDay,
    ureaMmolL: input.ureaMmolL,
    creatinineUmolL: input.creatinineUmolL,
    egfr: result.egfr,
    urineSg: input.urineSg,
    uacrMgMmol: result.uacrMgMmol,
    capGPerKg: result.capGPerKg,
    headroomGPerDay: result.headroomGPerDay,
    score: result.score,
    level: result.level,
  };
}

export function loadProteinKidneyHistory(): ProteinKidneySnapshot[] {
  try {
    const raw = localStorage.getItem(PROTEIN_KIDNEY_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(-30) : [];
  } catch {
    return [];
  }
}

export function saveProteinKidneySnapshot(s: ProteinKidneySnapshot): ProteinKidneySnapshot[] {
  try {
    const prev = loadProteinKidneyHistory();
    // Один день — один снимок: повторное сохранение заменяет, а не копит дубли.
    const next = [...prev.filter((x) => x.date !== s.date), s].slice(-30);
    localStorage.setItem(PROTEIN_KIDNEY_HISTORY_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function clearProteinKidneyHistory(): void {
  try {
    localStorage.removeItem(PROTEIN_KIDNEY_HISTORY_KEY);
  } catch {
    /* quota / private mode */
  }
}
