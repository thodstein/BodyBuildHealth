/**
 * bb-ped-adaptation.engine.ts — адаптация BB-плана под фармакологию (Этап BB15/BB15b).
 * PED: ААС + ИНСУЛИН + MGF + IGF-1 + ГР. Каждое вещество по-своему влияет на
 * MRV/частоту/объём/восстановление/пери-тренировочное питание.
 *
 * Данные PED берутся из pharma-database/course (READ-only, не модифицируем —
 * параллельный агент владеет фарма-блоком). Здесь — только логика адаптации тренировки.
 *
 * DOSE-AWARE (v2): множитель MRV/восстановления зависит от ДОЗЫ вещества, а не только
 * от факта его наличия. 250 мг теста ≠ 2000 мг теста по влиянию на толерантность к
 * объёму. Пороги основаны на клинических данных (Israetel RP, Helms MAAS) и
 * интерполируются линейно между контрольными точками.
 */

export type PED = 'AAS' | 'insulin' | 'MGF' | 'IGF1' | 'GH';

export type CourseIntensity = 'mild' | 'moderate' | 'heavy';

export interface PEDEffect {
  ped: PED;
  mrvMultiplier: number;      // множитель MRV (толерантность к объёму) — БАЗА (средняя доза)
  recoveryMultiplier: number; // скорость восстановления — БАЗА
  periWorkoutCarbs?: 'high' | 'moderate' | 'low'; // углеводы вокруг тренировки
  notes: string;
}

/** Базовые эффекты PED (для совместимости со старым API — без доз).
 *  При наличии doseAwareDoses эти значения ОБОГОЩАЮТСЯ дозо-зависимым множителем. */
export const PED_EFFECTS: Record<PED, PEDEffect> = {
  AAS: {
    ped: 'AAS',
    mrvMultiplier: 1.35, recoveryMultiplier: 1.35,
    periWorkoutCarbs: 'moderate',
    notes: 'ААС (500 мг тест/нед): синтез белка ×2-3, восстановление ↑↑, MRV +35% (Israetel enhanced). Каждые +250 мг ≈ +5% к MRV.',
  },
  insulin: {
    ped: 'insulin',
    mrvMultiplier: 1.28, recoveryMultiplier: 1.25,
    periWorkoutCarbs: 'high',
    notes: 'Инсулин: суперкомпенсация гликогена, шунт нутриентов в клетку, +28% работоспособности. Требует высоких углеводов вокруг тренировки.',
  },
  MGF: {
    ped: 'MGF',
    mrvMultiplier: 1.10, recoveryMultiplier: 1.12,
    notes: 'MGF (PEG-MGF): локальная активация сателлитных клеток, +10% локального объёма. Эффект ограничен тренируемыми мышцами.',
  },
  IGF1: {
    ped: 'IGF1',
    mrvMultiplier: 1.18, recoveryMultiplier: 1.18,
    notes: 'IGF-1 LR3: системный анаболизм, гиперплазия, +18% MRV.',
  },
  GH: {
    ped: 'GH',
    mrvMultiplier: 1.22, recoveryMultiplier: 1.25,
    notes: 'ГР (4 МЕ/день): ремонт соединительной ткани, липолиз, +22% MRV. Синергия с инсулином (IGF-1↑).',
  },
};

/**
 * Дозо-зависимые множители MRV для каждого PED.
 * Ключ — порог дозы, значение — множитель MRV (относительно натурала = 1.0).
 * Интерполяция линейна между порогами; выше последнего — cap.
 *
 * Источники: Israetel RP (enhanced volume landmarks), Helms MAAS, Pediaa/muscle-
 * builder Pro данные. Пороги подобраны под реальную практику бодибилдинга.
 *
 * Единицы доз:
 *  - AAS: мг тестостерона-эквивалента / нед (test-e = 1.0, deca = 0.7×мг, tren = 2.5×мг)
 *  - insulin: МЕ / день
 *  - MGF: мкг / нед
 *  - IGF1: мкг / день
 *  - GH: МЕ / день
 */
const PED_DOSE_CURVES: Record<PED, { threshold: number; mrv: number; rec: number }[]> = {
  AAS: [
    { threshold: 0,    mrv: 1.00, rec: 1.00 },   // натурал
    { threshold: 125,  mrv: 1.10, rec: 1.10 },   // TRT-низ
    { threshold: 250,  mrv: 1.18, rec: 1.18 },   // TRT-высокий / лёгкий курс
    { threshold: 500,  mrv: 1.35, rec: 1.35 },   // стандартный курс
    { threshold: 750,  mrv: 1.45, rec: 1.42 },
    { threshold: 1000, mrv: 1.52, rec: 1.48 },   // продвинутый курс
    { threshold: 1500, mrv: 1.60, rec: 1.54 },
    { threshold: 2000, mrv: 1.66, rec: 1.58 },   // heavy курс
    { threshold: 3000, mrv: 1.70, rec: 1.62 },   // cap (mega-dose, >3000 не добавляет)
  ],
  insulin: [
    { threshold: 0,  mrv: 1.00, rec: 1.00 },
    { threshold: 5,  mrv: 1.15, rec: 1.12 },
    { threshold: 10, mrv: 1.28, rec: 1.22 },
    { threshold: 15, mrv: 1.32, rec: 1.26 },
    { threshold: 20, mrv: 1.35, rec: 1.28 },
    { threshold: 30, mrv: 1.38, rec: 1.30 },
    { threshold: 40, mrv: 1.40, rec: 1.32 },  // cap
  ],
  MGF: [
    { threshold: 0,   mrv: 1.00, rec: 1.00 },
    { threshold: 100, mrv: 1.05, rec: 1.06 },
    { threshold: 200, mrv: 1.10, rec: 1.10 },
    { threshold: 300, mrv: 1.13, rec: 1.12 },
    { threshold: 400, mrv: 1.15, rec: 1.14 },  // cap
  ],
  IGF1: [
    { threshold: 0,  mrv: 1.00, rec: 1.00 },
    { threshold: 25, mrv: 1.10, rec: 1.10 },
    { threshold: 50, mrv: 1.18, rec: 1.16 },
    { threshold: 75, mrv: 1.22, rec: 1.19 },
    { threshold: 100, mrv: 1.25, rec: 1.22 },  // cap
  ],
  GH: [
    { threshold: 0,  mrv: 1.00, rec: 1.00 },
    { threshold: 2,  mrv: 1.15, rec: 1.18 },
    { threshold: 4,  mrv: 1.22, rec: 1.25 },
    { threshold: 6,  mrv: 1.27, rec: 1.29 },
    { threshold: 8,  mrv: 1.30, rec: 1.32 },
    { threshold: 12, mrv: 1.33, rec: 1.35 },
    { threshold: 15, mrv: 1.35, rec: 1.37 },  // cap
  ],
};

/** Интерполяция множителя по дозе на кривой PED. */
function interpolateDose(ped: PED, dose: number): { mrv: number; rec: number } {
  const curve = PED_DOSE_CURVES[ped];
  if (!curve || curve.length === 0) return { mrv: 1, rec: 1 };
  if (dose <= 0) return { mrv: 1, rec: 1 };
  // Ниже первого порога (или threshold=0) — берём первый ненулевой
  let prev = curve[0];
  for (let i = 1; i < curve.length; i++) {
    const pt = curve[i];
    if (dose <= pt.threshold) {
      const span = pt.threshold - prev.threshold;
      if (span <= 0) return { mrv: pt.mrv, rec: pt.rec };
      const t = (dose - prev.threshold) / span;
      return {
        mrv: prev.mrv + (pt.mrv - prev.mrv) * t,
        rec: prev.rec + (pt.rec - prev.rec) * t,
      };
    }
    prev = pt;
  }
  // Выше последнего порога — cap
  const last = curve[curve.length - 1];
  return { mrv: last.mrv, rec: last.rec };
}

/** Множитель courseIntensity — дополнительный boost сверх PED-доз.
 *  Отражает: оральные 17α, высокая частота, прочие факторы "тяжести" курса
 *  не учтённые напрямую дозами ААС/ГР/инсулина. */
const COURSE_INTENSITY_MULT: Record<CourseIntensity, number> = {
  mild: 1.00,
  moderate: 1.04,
  heavy: 1.08,
};

export interface PEDAdaptation {
  activePEDs: PED[];
  pedDoses: Record<string, number>;
  courseIntensity: CourseIntensity;
  combinedMrvMultiplier: number;
  combinedRecoveryMultiplier: number;
  periWorkoutCarbs: 'high' | 'moderate' | 'low';
  adjustedMrv: Record<string, number>; // muscle -> скорректированный MRV
  perPED: { ped: PED; dose: number; mrvMult: number; recMult: number }[];
  rationale: string[];
  risks: string[];
}

/**
 * Рассчитать адаптацию по активным PED.
 * @param activePEDs — список активных веществ
 * @param baseMrv — базовый MRV по мышцам (из volume-landmarks)
 * @param pedDoses — дозы PED (мг/нед или МЕ/день или мкг). Ключи: 'AAS','insulin','MGF','IGF1','GH'.
 *                   Если не переданы — используется базовый множитель PED_EFFECTS (старый behaviour).
 * @param courseIntensity — интенсивность курса (mild/moderate/heavy). Дополнительный MRV boost.
 */
export function adaptForPEDs(
  activePEDs: PED[],
  baseMrv: Record<string, number>,
  pedDoses?: Record<string, number>,
  courseIntensity?: CourseIntensity,
): PEDAdaptation {
  const doses = pedDoses || {};
  const intensity: CourseIntensity = courseIntensity || 'moderate';
  const intensityMult = COURSE_INTENSITY_MULT[intensity];

  let mrvMult = 1, recMult = 1;
  let carbs: 'high' | 'moderate' | 'low' = 'moderate';
  const rationale: string[] = [];
  const risks: string[] = [];
  const perPED: { ped: PED; dose: number; mrvMult: number; recMult: number }[] = [];

  for (const ped of activePEDs) {
    const base = PED_EFFECTS[ped];
    if (!base) continue;
    // P2-12: previously `Number(doses[ped]) || 0` silently returned 0 for string doses
    // like "500mg" (NaN → 0 → fallback to base multiplier, losing dose-aware precision).
    // Now strips non-numeric suffixes before parsing.
    const rawDose = doses[ped];
    const dose = typeof rawDose === 'number' ? rawDose
      : rawDose != null ? (parseFloat(String(rawDose).replace(/[^0-9.]/g, '')) || 0)
      : 0;
    // Dose-aware множитель (если доза передана и > 0 — интерполяция по кривой;
    // иначе — fallback на базовый множитель PED_EFFECTS)
    let doseMrv: number, doseRec: number;
    if (dose > 0 && PED_DOSE_CURVES[ped]) {
      const interp = interpolateDose(ped, dose);
      doseMrv = interp.mrv;
      doseRec = interp.rec;
    } else {
      doseMrv = base.mrvMultiplier;
      doseRec = base.recoveryMultiplier;
    }
    // Комбинирование с убывающей отдачей — diminishing 0.85.
    mrvMult += (doseMrv - 1) * 0.85;
    recMult += (doseRec - 1) * 0.85;
    if (base.periWorkoutCarbs === 'high') carbs = 'high';
    perPED.push({ ped, dose, mrvMult: doseMrv, recMult: doseRec });
    const doseStr = dose > 0 ? ` (${dose} ${ped === 'AAS' ? 'мг/нед' : ped === 'insulin' || ped === 'GH' ? 'МЕ/день' : 'мкг'})` : '';
    rationale.push(`${ped}${doseStr}: MRV ×${doseMrv.toFixed(2)}, восст ×${doseRec.toFixed(2)} — ${base.notes}`);
  }

  // GH + инсулин синергия: IGF-1 × инсулин = +15% к комбинированному эффекту
  const hasGH = activePEDs.includes('GH');
  const hasInsulin = activePEDs.includes('insulin');
  if (hasGH && hasInsulin) {
    const ghMrv = perPED.find(p => p.ped === 'GH')?.mrvMult ?? 1;
    const insMrv = perPED.find(p => p.ped === 'insulin')?.mrvMult ?? 1;
    const ghRec = perPED.find(p => p.ped === 'GH')?.recMult ?? 1;
    const insRec = perPED.find(p => p.ped === 'insulin')?.recMult ?? 1;
    const synergyMrv = (ghMrv - 1) * (insMrv - 1) * 0.15;
    const synergyRec = (ghRec - 1) * (insRec - 1) * 0.15;
    mrvMult += synergyMrv;
    recMult += synergyRec;
    rationale.push(`GH+инсулин синергия: +MRV ×${(1+synergyMrv).toFixed(3)}, +восст ×${(1+synergyRec).toFixed(3)} (IGF-1 × инсулин).`);
  }

  // Course intensity boost (поверх PED-множителя)
  if (activePEDs.length > 0 && intensityMult > 1) {
    mrvMult *= intensityMult;
    rationale.push(`Интенсивность курса (${intensity}): дополнительный MRV ×${intensityMult.toFixed(2)} (оральные/частота/прочее).`);
  }

  // Суммарный множитель: натурал = 1.0, соло-ААС 500мг = ~1.28, полный стек heavy = до 1.85
  // B8: recMult cap 1.85 — синхрон с mrvMult, чтобы не было рассинхрона
  mrvMult = Math.min(mrvMult, 1.85);
  recMult = Math.min(recMult, 1.85);
  const adjustedMrv: Record<string, number> = {};
  for (const m of Object.keys(baseMrv)) adjustedMrv[m] = Math.round(baseMrv[m] * mrvMult);

  // риски (BB15c — интеграция с risk-engine/pharma-interactions)
  const aasDose = Number(doses['AAS']) || 0;
  if (activePEDs.includes('insulin')) risks.push('Инсулин: риск гипогликемии — контроль глюкозы, достаточные углеводы вокруг тренировки.');
  if (activePEDs.includes('GH')) risks.push('ГР: инсулинорезистентность при длительном использовании, возможны отёки.');
  if (activePEDs.includes('insulin') && activePEDs.includes('GH')) risks.push('Инсулин + ГР: синергия, но рост риска гипогликемии и инсулинорезистентности.');
  if (activePEDs.includes('AAS')) {
    risks.push('ААС: контроль гематокрита, эстрадиола, липидов, оси HPTA.');
    if (aasDose >= 1500) risks.push(`⚠ Высокая доза ААС (${aasDose} мг/нед): риск эритроцитоза (HCT>54), гипертонии, дислипидемии. Сократить объём при росте АД/усталости.`);
  }

  return {
    activePEDs, pedDoses: doses, courseIntensity: intensity,
    combinedMrvMultiplier: mrvMult,
    combinedRecoveryMultiplier: recMult, periWorkoutCarbs: carbs, adjustedMrv,
    perPED, rationale, risks,
  };
}

/** Описание для UI. */
export function explainPEDAdaptation(a: PEDAdaptation): string {
  const lines = [
    `Активные PED: ${a.activePEDs.join(', ') || 'нет (натурал)'}`,
    `Суммарный MRV×${a.combinedMrvMultiplier.toFixed(2)}, восстановление×${a.combinedRecoveryMultiplier.toFixed(2)}`,
    `Пери-WO углеводы: ${a.periWorkoutCarbs}`,
    ...a.rationale.map(x => '✓ ' + x),
    ...a.risks.map(x => '! ' + x),
  ];
  return lines.join('\n');
}
