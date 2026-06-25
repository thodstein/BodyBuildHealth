/**
 * Advanced Diagnostics Engine — 5 Analytical Modules
 *
 * Runs entirely in-browser (Telegram Mini App / PWA). No server needed.
 * Mirrors Python mdss-api/advanced_diagnostics.py algorithm identically.
 *
 * Engines:
 *  1. PK/PD  — concentration simulation, hormonal swing detection
 *  2. Interactions — receptor-level drug-drug conflict detection
 *  3. Vitals — HRV/RHR/BP telemetry alert analysis
 *  4. BioAge — phenotypic aging from toxic load + vitals
 *  5. PCT Reboot — PCT start day + HPTA reboot probability
 *
 * @module advanced-diagnostics.engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Half-life in DAYS per ester type */
export const ESTER_HALF_LIFE_DAYS: Record<string, number> = {
  propionate: 0.8,
  acetate: 1.0,
  enanthate: 4.5,
  cypionate: 5.0,
  decanoate: 7.5,
  undecanoate: 21.0,
  oral: 0.3,
  phenylpropionate: 1.5,
  hexahydrobenzylcarbonate: 6.0,
};

/** 19-nor substances */
const NINETEEN_NOR_DRUGS = ['trenbolone', 'nandrolone', 'trestolone'];

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE 1: PK/PD — Concentration Simulation
// ═══════════════════════════════════════════════════════════════════════════

export interface DrugDoseInput {
  name: string;
  ester: string;
  mgPerWeek: number;
  injectionsPerWeek: number;
}

export interface PKPDOutput {
  drugName: string;
  ester: string;
  halfLifeDays: number;
  eliminationRate: number;
  peakConcMg: number;
  troughConcMg: number;
  peakTroughDeltaPct: number;
  hormonalSwingFlag: boolean;
  dailyProfile: number[]; // mg/day for 30 days
}

/**
 * Simulates 30-day concentration profile.
 * Formula: C_t = C_0 * exp(-k * t), where k = ln(2) / T1/2.
 * Peak/trough delta > 40% → hormonal swing flag.
 */
export function computePKPD(drugs: DrugDoseInput[]): PKPDOutput[] {
  if (!Array.isArray(drugs)) return [];
  return drugs.filter(Boolean).map((drug) => {
    const injPerWeek = Math.max(drug.injectionsPerWeek || 0, 0.1);
    const tHalf = ESTER_HALF_LIFE_DAYS[drug.ester] || (7.0 / injPerWeek);
    const k = Math.log(2) / Math.max(tHalf, 0.01);
    const dosePerInjection = (drug.mgPerWeek || 0) / Math.max(drug.injectionsPerWeek || 0, 1);
    const intervalDays = 7.0 / injPerWeek;

    const dailyProfile: number[] = new Array(30).fill(0);
    let currentConc = 0;

    for (let day = 0; day < 30; day++) {
      currentConc *= Math.exp(-k * 1.0);
      if (day % Math.max(1, Math.round(intervalDays)) === 0) {
        currentConc += dosePerInjection;
      }
      dailyProfile[day] = Math.round(currentConc * 100) / 100;
    }

    const last14 = dailyProfile.slice(-14);
    const peakConc = last14.length > 0 ? Math.max(...last14) : 0;
    const troughConc = last14.length > 0 ? Math.min(...last14) : 0;
    const deltaPct = ((peakConc - troughConc) / Math.max(peakConc, 0.01)) * 100;
    const hormonalSwing = deltaPct > 40;

    return {
      drugName: drug.name,
      ester: drug.ester,
      halfLifeDays: Math.round(tHalf * 100) / 100,
      eliminationRate: Math.round(k * 10000) / 10000,
      peakConcMg: Math.round(peakConc * 100) / 100,
      troughConcMg: Math.round(troughConc * 100) / 100,
      peakTroughDeltaPct: Math.round(deltaPct * 10) / 10,
      hormonalSwingFlag: hormonalSwing,
      dailyProfile,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE 2: Interactions — Drug-Drug Conflict Detection
// ═══════════════════════════════════════════════════════════════════════════

export interface InteractionOutput {
  severity: 'critical' | 'warning';
  drugsInvolved: string[];
  message: string;
  mechanism: string;
}

interface InteractionRule {
  drugs: string[];
  severity: 'critical' | 'warning';
  message: string;
  mechanism: string;
}

const INTERACTION_RULES: InteractionRule[] = [
  {
    drugs: ['boldenone', 'primobolan'],
    severity: 'critical',
    message: 'КРИТИЧЕСКИЙ РИСК: Обвал Эстрадиола (E2) до нуля. Болденон + Примоболан не ароматизируются → нулевой E2 → риск остеопороза, нейротоксичности, депрессии, разрушения суставов.',
    mechanism: 'Двойная блокада ароматазы: оба препарата — non-aromatizable DHT-производные. E2 необходим для нейропротекции (BDNF↑), костного ремоделирования, либидо, суставной смазки.',
  },
  {
    drugs: ['boldenone', 'masteron'],
    severity: 'critical',
    message: 'КРИТИЧЕСКИЙ РИСК: Обвал Эстрадиола (E2) до нуля. Болденон (не ароматизируется) + Мастерон (анти-эстроген через SHBG↓) → критически низкий E2.',
    mechanism: 'Болденон = 0% ароматизации. Мастерон = конкурент AR + SHBG↓ → свободный E2↑ но быстрый клиренс → нетто E2 < 5 пг/мл.',
  },
  {
    drugs: ['nandrolone', 'finasteride'],
    severity: 'critical',
    message: 'КРИТИЧЕСКИЙ РИСК: Блокада 5-AR оставляет активный нандролон вместо слабого ДГН. Риск тотальной эректильной дисфункции (Deca-Dick).',
    mechanism: '5α-редуктаза (SRD5A2) конвертирует нандролон → ДГН — слабый андроген. Финастерид блокирует SRD5A2 → нандролон остаётся в неизменённом виде → ПРЛ↑, либидо↓, ЭД.',
  },
  {
    drugs: ['nandrolone', 'dutasteride'],
    severity: 'critical',
    message: 'КРИТИЧЕСКИЙ РИСК: Дутастерид блокирует оба изофермента 5-AR (тип I+II). Нандролон не метаболизируется в ДГН. Риск Deca-Dick 80%+.',
    mechanism: 'Дутастерид = неселективный ингибитор SRD5A1 + SRD5A2. Полная блокада конверсии нандролон→ДГН.',
  },
  {
    drugs: ['trenbolone', 'clenbuterol'],
    severity: 'critical',
    message: 'КРИТИЧЕСКИЙ РИСК: Перегорание парасимпатической ЦНС и кардиотоксичность. Тренболон (GABA_A-антагонист) + Кленбутерол (β2-агонист) → симпатический овердрайв, тахикардия, апоптоз кардиомиоцитов.',
    mechanism: 'Тренболон → GABA_A-антагонизм → CNS excitation → тревожность, бессонница. Кленбутерол → β2-AR → cAMP↑ → Ca²⁺ перегрузка кардиомиоцитов → некроз/апоптоз миокарда.',
  },
];

export function computeInteractions(drugNames: string[]): InteractionOutput[] {
  if (!Array.isArray(drugNames)) return [];
  const results: InteractionOutput[] = [];
  const lower = drugNames.filter(n => n != null).map(n => n.toLowerCase().trim());
  const seen = new Set<string>();

  for (const rule of INTERACTION_RULES) {
    const [d1, d2] = rule.drugs.map(d => d.toLowerCase().trim());
    if (lower.includes(d1) && lower.includes(d2)) {
      const key = `${d1}+${d2}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ ...rule, drugsInvolved: [d1, d2] });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE 3: Vitals — Telemetry Analysis
// ═══════════════════════════════════════════════════════════════════════════

export interface VitalsInput {
  hrv: number;   // ms, normal 50-100
  rhr: number;   // bpm, normal 50-75
  bpSys: number; // mmHg, normal 100-130
  bpDia: number; // mmHg, normal 60-85
}

export interface VitalsOutput {
  hrv: number;
  rhr: number;
  bpSys: number;
  bpDia: number;
  alerts: string[];
}

export function computeVitals(v: VitalsInput): VitalsOutput {
  if (!v) return { hrv: 0, rhr: 0, bpSys: 0, bpDia: 0, alerts: ['Ошибка: нет данных по витальным показателям'] };
  const hrv = v.hrv ?? 0;
  const rhr = v.rhr ?? 0;
  const bpSys = v.bpSys ?? 0;
  const bpDia = v.bpDia ?? 0;
  const alerts: string[] = [];

  if (hrv < 35) {
    alerts.push(
      `ВНИМАНИЕ: Истощение ЦНС (Симпатический овердрайв). HRV = ${hrv} мс < 35 мс. Рекомендация: делод-неделя, магний 400 мг, мелатонин 3-5 мг.`
    );
  }
  if (rhr > 75) {
    alerts.push(
      `ВНИМАНИЕ: Перегрузка миокарда или гиперволемия. RHR = ${rhr} уд/мин > 75. Рекомендация: проверка HCT, флеботомия при >52%, гидратация.`
    );
  }
  if (v.bpSys > 140 || v.bpDia > 90) {
    alerts.push(
      `ВНИМАНИЕ: Гипертензия. Риск нефропатии и ГЛЖ. АД = ${v.bpSys}/${v.bpDia}. Рекомендация: телмисартан 40-80 мг, натрий <2 г/день, кардио.`
    );
  }

  return { hrv: v.hrv, rhr: v.rhr, bpSys: v.bpSys, bpDia: v.bpDia, alerts };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE 4: BioAge — Phenotypic Aging Calculator
// ═══════════════════════════════════════════════════════════════════════════

export interface BioAgeInput {
  chronologicalAge: number;
  vitals: VitalsInput;
  totalWeeklyMg: number;
}

export interface BioAgeOutput {
  chronologicalAge: number;
  biologicalAge: number;
  ageAcceleration: number;
  bpPenalty: number;
  hrvPenalty: number;
  toxicLoadPenalty: number;
  agingRate: string;
}

/**
 * BioAge = ChronologicalAge + BP_penalty + HRV_penalty + Toxic_Load
 * BP_penalty  = (bp_sys - 120) * 0.15  (if bp_sys > 120)
 * HRV_penalty = (60 - hrv) * 0.2       (if hrv < 60)
 * Toxic_Load  = total_weekly_mg / 200
 */
export function computeBioAge(input: BioAgeInput): BioAgeOutput {
  if (!input || !input.vitals) return { chronologicalAge: 0, biologicalAge: 0, ageAcceleration: 0, bpPenalty: 0, hrvPenalty: 0, toxicLoadPenalty: 0, agingRate: 'Нет данных' };
  const bpSys = input.vitals.bpSys ?? 120;
  const hrv = input.vitals.hrv ?? 60;
  const totalMg = input.totalWeeklyMg ?? 0;
  const age = input.chronologicalAge ?? 0;
  const bpPenalty = Math.max(0, (bpSys - 120) * 0.15);
  const hrvPenalty = Math.max(0, (60 - hrv) * 0.2);
  const toxicPenalty = totalMg / 200;

  const bioAge = age + bpPenalty + hrvPenalty + toxicPenalty;
  const acceleration = bioAge - age;
  const agingRate = `Вы стареете на ${(1 + Math.max(0, acceleration)).toFixed(2)} лет за календарный год.`;

  return {
    chronologicalAge: Math.round(age * 10) / 10,
    biologicalAge: Math.round(bioAge * 100) / 100,
    ageAcceleration: Math.round(acceleration * 100) / 100,
    bpPenalty: Math.round(bpPenalty * 100) / 100,
    hrvPenalty: Math.round(hrvPenalty * 100) / 100,
    toxicLoadPenalty: Math.round(toxicPenalty * 100) / 100,
    agingRate,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE 5: PCT & HPTA Reboot — Timing + Success Probability
// ═══════════════════════════════════════════════════════════════════════════

export interface PCTRebootInput {
  drugs: DrugDoseInput[];
  has19NorInHistory: boolean;
}

export interface PCTRebootOutput {
  pctStartDay: number;
  longestHalfLifeDrug: string;
  longestHalfLifeDays: number;
  levelsAtPctStart: number;
  has19Nor: boolean;
  rebootSuccessProbability: number; // 0-100
  recommendation: string;
}

export function computePCTReboot(input: PCTRebootInput): PCTRebootOutput {
  if (!input || !Array.isArray(input.drugs) || input.drugs.length === 0) {
    return {
      pctStartDay: 0,
      longestHalfLifeDrug: 'none',
      longestHalfLifeDays: 0,
      levelsAtPctStart: 0,
      has19Nor: !!(input?.has19NorInHistory),
      rebootSuccessProbability: input?.has19NorInHistory ? 60 : 100,
      recommendation: 'Нет активных препаратов. ПКТ не требуется.',
    };
  }

  // Find drug with longest ester half-life
  let longestDrug: DrugDoseInput = input.drugs[0];
  let longestTH = 0;

  for (const drug of input.drugs) {
    if (!drug) continue;
    const th = ESTER_HALF_LIFE_DAYS[drug.ester] || 7.0;
    if (th > longestTH) {
      longestTH = th;
      longestDrug = drug;
    }
  }

  const k = Math.log(2) / Math.max(longestTH, 0.01);
  const dosePerInj = (longestDrug?.mgPerWeek || 0) / Math.max(longestDrug?.injectionsPerWeek || 0, 1);
  const intervalDays = 7.0 / Math.max(longestDrug?.injectionsPerWeek || 0, 1);
  const accFactor = 1.0 / (1.0 - Math.exp(-k * intervalDays));
  const initialConc = dosePerInj * accFactor;

  // Day-by-day elimination until < 2.0 mg
  let pctDay = 0;
  let current = 0;
  for (let day = 1; day <= 90; day++) {
    current = initialConc * Math.exp(-k * day);
    if (current < 2.0) {
      pctDay = day;
      break;
    }
  }
  if (pctDay === 0) pctDay = Math.max(3, Math.round(3.0 * longestTH));

  // 19-nor check
  const has19NorNow = !!(input.drugs.some(d => d && d.name && NINETEEN_NOR_DRUGS.includes((d.name || '').toLowerCase())));
  const effective19Nor = has19NorNow || input.has19NorInHistory;

  let baseProb = 85;
  if (effective19Nor) baseProb -= 40;
  if (longestTH > 10) baseProb -= 15;
  const prob = Math.max(5, Math.min(100, baseProb));

  let recommendation = `Начать ПКТ на ${pctDay}-й день после последней инъекции. `;
  if (effective19Nor) {
    recommendation +=
      `ОБНАРУЖЕН 19-nor — метаболиты сохраняются до 18 мес. ` +
      `Вероятность ребута HPTA: ${prob}%. ` +
      `Расширенный протокол: Кломифен 50/25/25 + Тамоксифен 20/10 + ХГЧ 500 МЕ 2×/нед × 3 нед, схема 3/1 (3 нед через 1) до ПКТ.`;
  } else {
    recommendation +=
      `Стандартный протокол: Кломифен 50/25/25/12.5 мг × 4 нед + Тамоксифен 20/10 мг × 4 нед.`;
  }

  return {
    pctStartDay: pctDay,
    longestHalfLifeDrug: longestDrug.name,
    longestHalfLifeDays: Math.round(longestTH * 10) / 10,
    levelsAtPctStart: Math.round(current * 100) / 100,
    has19Nor: effective19Nor,
    rebootSuccessProbability: Math.round(prob * 10) / 10,
    recommendation,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Super-Function: Run All 5 Engines ──
// ═══════════════════════════════════════════════════════════════════════════

export interface AdvancedDiagnosticsResult {
  pkpd: PKPDOutput[];
  interactions: InteractionOutput[];
  vitals: VitalsOutput;
  bioage: BioAgeOutput;
  pctReboot: PCTRebootOutput;
  summary: string;
}

export function runAdvancedDiagnostics(
  age: number,
  drugs: DrugDoseInput[],
  vitals: VitalsInput,
  has19NorHistory: boolean,
): AdvancedDiagnosticsResult {
  const safeDrugs = Array.isArray(drugs) ? drugs : [];
  const pkpd = computePKPD(safeDrugs);
  const interactions = computeInteractions(safeDrugs.filter(Boolean).map(d => d.name || ''));
  const vitalsResult = computeVitals(vitals);

  const totalMg = safeDrugs.reduce((sum, d) => sum + (d?.mgPerWeek || 0), 0);
  const bioage = computeBioAge({ chronologicalAge: age, vitals, totalWeeklyMg: totalMg });

  const pctReboot = computePCTReboot({ drugs: safeDrugs, has19NorInHistory: has19NorHistory });

  // Build summary
  const parts: string[] = [];

  const swingFlags = pkpd.filter(r => r.hormonalSwingFlag);
  if (swingFlags.length > 0) {
    parts.push(
      `⚠ Гормональные качели: ${swingFlags.length} препарат(ов) с дельтой >40% — ${swingFlags.map(r => r.drugName).join(', ')}.`
    );
  }

  const crit = interactions.filter(i => i.severity === 'critical');
  if (crit.length > 0) {
    parts.push(
      `🔴 ${crit.length} критических межлекарственных конфликта: ${crit.map(i => i.drugsInvolved.join('+')).join(', ')}.`
    );
  }

  if (vitalsResult.alerts.length > 0) {
    parts.push(`🟡 ${vitalsResult.alerts.length} предупреждений по витальным показателям.`);
  }

  if (bioage.ageAcceleration > 2) {
    parts.push(`⏳ Ускоренное старение: +${bioage.ageAcceleration.toFixed(1)} лет к биологическому возрасту.`);
  }

  if (pctReboot.has19Nor) {
    parts.push(`💊 19-nor в анамнезе — вероятность ребута HPTA: ${pctReboot.rebootSuccessProbability}%.`);
  }

  const summary = parts.length > 0
    ? parts.join(' ')
    : '✅ Все показатели в пределах нормы. Продолжайте мониторинг.';

  return { pkpd, interactions, vitals: vitalsResult, bioage, pctReboot, summary };
}
