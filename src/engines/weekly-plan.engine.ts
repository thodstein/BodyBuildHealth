// Advanced Risk Engine — 4 calculation methods + weekly plan + daily schedule
import { PEPTIDE_DB, PEPTIDE_SYNERGY, PEPTIDE_CONFLICTS } from './peptide-calculator.engine';
import { ALL_SUBSTANCES, type SupportSubstance } from '../data/support-database';

export type RiskCalcMethod = 'basic' | 'monte_carlo' | 'bayesian' | 'time_series';

export interface RiskMethodInfo {
  id: RiskCalcMethod;
  label: string;
  desc: string;
  emoji: string;
}

export const RISK_METHODS: RiskMethodInfo[] = [
  { id: 'basic', label: 'Базовый', desc: 'Прямой расчёт по весам систем и препаратов', emoji: '📊' },
  { id: 'monte_carlo', label: 'Монте-Карло', desc: 'Симуляция 10K итераций с распределением вероятностей', emoji: '🎲' },
  { id: 'bayesian', label: 'Байесовский', desc: 'Апостериорная вероятность с учётом априорных данных анализов', emoji: '🔮' },
  { id: 'time_series', label: 'Временной ряд', desc: 'Прогноз динамики рисков на неделю вперёд', emoji: '📈' },
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const SYSTEM_LABELS: Record<string, string> = {
  cardio: 'ССС', hepatic: 'Печень', renal: 'Почки', neuro: 'ЦНС',
  endocrine: 'Эндо', hematologic: 'Кровь', reproductive: 'Репрод', musculoskeletal: 'Суставы',
};

const ORGAN_LABELS: Record<string, string> = {
  heart: 'Сердце', vascular: 'Сосуды', liver: 'Печень', kidneys: 'Почки',
  brain: 'Мозг', nervous_system: 'Нервная система', thyroid: 'Щитовидка',
  adrenals: 'Надпочечники', gonads: 'Гонады', testes: 'Яички', prostate: 'Простата',
  pancreas: 'Поджелудочная', bone_marrow: 'Костный мозг', joints: 'Суставы',
  tendons: 'Сухожилия', ligaments: 'Связки', cartilage: 'Хрящ', bone: 'Кости',
  gut: 'ЖКТ', lungs: 'Лёгкие', skin: 'Кожа', eyes: 'Глаза',
};

import { TZ_MECH_LABELS } from '../data/support-db';

export interface SupplementPlanEntry {
  substanceId: string;
  name: string;
  mechanism: string;
  mechanismRu: string;
  organs: string[];
  organLabels: string[];
  systems: string[];
  systemLabels: string[];
  synergies: { partner: string; partnerName: string; strength: number }[];
  timing: string;
  timeSlot: 'empty_stomach' | 'morning' | 'lunch' | 'evening' | 'night';
  doseSuggestion: string;
}

export interface DailySchedule {
  dayIndex: number;
  dayLabel: string;
  date: string;
  emptyStomach: SupplementPlanEntry[];
  morning: SupplementPlanEntry[];
  lunch: SupplementPlanEntry[];
  evening: SupplementPlanEntry[];
  night: SupplementPlanEntry[];
  riskLevel: number;
  riskSystemBreakdown: Record<string, number>;
}

export interface WeeklyPlan {
  riskMethod: RiskCalcMethod;
  overallRisk: { current: number; projected: number; reduction: number };
  schedules: DailySchedule[];
  coveredSystems: { system: string; label: string; coverage: number; substances: string[] }[];
  coveredOrgans: { organ: string; label: string; coverage: number; substances: string[] }[];
  keyMechanisms: { name: string; label: string; substances: string[] }[];
  synergyPairs: { a: string; b: string; score: number }[];
}

function getSubstanceInfo(id: string): { name: string; mechanisms: string[]; organs: string[] } | null {
  const sub = ALL_SUBSTANCES.find(s => s.id === id);
  if (sub) return { name: sub.name, mechanisms: sub.mechanisms, organs: sub.organs };
  const pep = PEPTIDE_DB[id];
  if (pep) return { name: pep.shortName, mechanisms: pep.mechanisms, organs: [] };
  return null;
}

function getSystemsFromOrgans(organs: string[]): string[] {
  const map: Record<string, string> = {
    heart: 'cardio', vascular: 'cardio', liver: 'hepatic', kidneys: 'renal',
    brain: 'neuro', nervous_system: 'neuro', thyroid: 'endocrine', adrenals: 'endocrine',
    gonads: 'endocrine', testes: 'reproductive', prostate: 'reproductive',
    pancreas: 'endocrine', bone_marrow: 'hematologic', joints: 'musculoskeletal',
    tendons: 'musculoskeletal', ligaments: 'musculoskeletal', cartilage: 'musculoskeletal',
    bone: 'musculoskeletal', gut: 'hepatic', lungs: 'cardio', skin: 'musculoskeletal',
    eyes: 'neuro',
  };
  return [...new Set(organs.map(o => map[o]).filter(Boolean))];
}

export function computeBasicRisk(systems: string[], baseWeights: Record<string, number>, drugLoads: Record<string, number>): Record<string, number> {
  const risk: Record<string, number> = {};
  for (const sys of systems) {
    risk[sys] = Math.min(100, Math.round((baseWeights[sys] ?? 15) + (drugLoads[sys] ?? 0)));
  }
  return risk;
}

export function computeMonteCarloRisk(
  systems: string[], baseWeights: Record<string, number>, drugLoads: Record<string, number>,
  iterations: number = 10000,
): { mean: Record<string, number>; ci95: Record<string, { low: number; high: number }> } {
  const mean: Record<string, number> = {};
  const ci95: Record<string, { low: number; high: number }> = {};
  const samples: Record<string, number[]> = {};

  for (const sys of systems) {
    samples[sys] = [];
    const base = baseWeights[sys] ?? 15;
    const drug = drugLoads[sys] ?? 0;
    for (let i = 0; i < iterations; i++) {
      const noise = (Math.random() - 0.5) * 0.3 * (base + drug);
      samples[sys].push(Math.min(100, Math.max(0, base + drug + noise)));
    }
    samples[sys].sort((a, b) => a - b);
    mean[sys] = Math.round(samples[sys].reduce((a, b) => a + b, 0) / iterations);
    const lowIdx = Math.floor(iterations * 0.025);
    const highIdx = Math.floor(iterations * 0.975);
    ci95[sys] = { low: Math.round(samples[sys][lowIdx]), high: Math.round(samples[sys][highIdx]) };
  }
  return { mean, ci95 };
}

export function computeBayesianRisk(
  systems: string[], baseWeights: Record<string, number>, drugLoads: Record<string, number>,
  labStress: Record<string, number>, priorConfidence: number = 0.3,
): Record<string, number> {
  const risk: Record<string, number> = {};
  for (const sys of systems) {
    const prior = (baseWeights[sys] ?? 15) + (drugLoads[sys] ?? 0);
    const likelihood = labStress[sys] ?? prior;
    const posterior = Math.round(prior * (1 - priorConfidence) + likelihood * priorConfidence);
    risk[sys] = Math.min(100, Math.max(0, posterior));
  }
  return risk;
}

export function computeTimeSeriesRisk(
  systems: string[], baseWeights: Record<string, number>, drugLoads: Record<string, number>,
  days: number = 7, trendFactor: number = 0.95,
): Record<string, number[]> {
  const series: Record<string, number[]> = {};
  for (const sys of systems) {
    series[sys] = [];
    const current = Math.min(100, (baseWeights[sys] ?? 15) + (drugLoads[sys] ?? 0));
    for (let d = 0; d < days; d++) {
      const trend = current * Math.pow(trendFactor, d);
      const noise = (Math.random() - 0.5) * 10;
      series[sys].push(Math.round(Math.min(100, Math.max(0, trend + noise))));
    }
  }
  return series;
}

export function computeOverallRisk(riskMap: Record<string, number>): number {
  const vals = Object.values(riskMap);
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function getTimeSlot(mechanism: string): SupplementPlanEntry['timeSlot'] {
  const m = mechanism.toUpperCase();
  if (m.includes('GH_UP') || m.includes('IGF1') || m.includes('DOPAMINE') || m.includes('CORTISOL_UP')) return 'empty_stomach';
  if (m.includes('ENERGY') || m.includes('ATP') || m.includes('MITO') || m.includes('FOCUS') || m.includes('STIMULANT')) return 'morning';
  if (m.includes('ANTIOX') || m.includes('INSULIN') || m.includes('LIPID') || m.includes('COQ10')) return 'lunch';
  if (m.includes('TESTOSTERONE') || m.includes('MUSCLE') || m.includes('COLLAGEN') || m.includes('PROTEIN')) return 'evening';
  if (m.includes('SLEEP') || m.includes('GABA') || m.includes('MELATONIN') || m.includes('CORTISOL_DOWN') || m.includes('RECOVERY')) return 'night';
  return 'morning';
}

function getDoseSuggestion(id: string): string {
  const doses: Record<string, string> = {
    nac: '600-1200 мг', omega3: '2000-4000 мг', tudca: '250-500 мг', magnesium: '200-400 мг',
    vitamin_d3: '2000-4000 МЕ', coq10: '100-200 мг', zinc: '15-30 мг', berberine: '500-1000 мг',
    ashwagandha: '300-600 мг', alpha_lipoic: '300-600 мг', vitamin_k2: '100-200 мкг',
    selenium: '100-200 мкг', milk_thistle: '300-600 мг', vitamin_b12: '500-1000 мкг',
    folate: '400-800 мкг', taurine: '1000-3000 мг', melatonin: '1-3 мг',
    curcumin: '500-1000 мг', vitamin_c: '500-1000 мг', l_carnitine: '1000-2000 мг',
    glucosamine: '1500 мг', collagen: '5-10 г', bpc157: '250-500 мкг',
    tb500: '5-10 мг', hcg: '500 МЕ 2р/нед, 3/1', telmisartan: '20-40 мг', nebivolol: '2.5-5 мг',
  };
  return doses[id] ?? 'См. инструкцию';
}

function findSynergiesInStack(substanceIds: string[]): { a: string; b: string; score: number }[] {
  const pairs: { a: string; b: string; score: number }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < substanceIds.length; i++) {
    for (let j = i + 1; j < substanceIds.length; j++) {
      const a = substanceIds[i], b = substanceIds[j];
      const key = [a, b].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const pepSyn = PEPTIDE_SYNERGY[a]?.[b] ?? PEPTIDE_SYNERGY[b]?.[a] ?? 0;
      if (pepSyn > 0) { pairs.push({ a, b, score: pepSyn }); continue; }
      const allSyns = ALL_SUBSTANCES.filter(s => s.id === a || s.id === b);
      if (allSyns.length === 2 && allSyns[0].mechanisms.some(m1 => allSyns[1].mechanisms.includes(m1))) {
        pairs.push({ a, b, score: 1 });
      }
    }
  }
  return pairs;
}

export function generateWeeklyPlan(
  selectedSubstances: string[],
  riskMethod: RiskCalcMethod,
  baseWeights: Record<string, number>,
  drugLoads: Record<string, number>,
  labStress: Record<string, number>,
  supportCoverage: Record<string, number>,
): WeeklyPlan {
  const systems = ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive', 'musculoskeletal'];

  let currentRisk: Record<string, number>;
  let projectedRisk: Record<string, number>;
  let timeSeriesRisk: Record<string, number[]>;

  switch (riskMethod) {
    case 'monte_carlo': {
      const mc = computeMonteCarloRisk(systems, baseWeights, drugLoads);
      currentRisk = mc.mean;
      projectedRisk = Object.fromEntries(Object.entries(mc.ci95).map(([k, v]) => [k, v.low]));
      timeSeriesRisk = computeTimeSeriesRisk(systems, baseWeights, drugLoads, 7);
      break;
    }
    case 'bayesian': {
      currentRisk = computeBayesianRisk(systems, baseWeights, drugLoads, labStress);
      projectedRisk = computeBayesianRisk(systems, baseWeights, drugLoads, labStress, 0.5);
      timeSeriesRisk = computeTimeSeriesRisk(systems, baseWeights, drugLoads, 7);
      break;
    }
    case 'time_series': {
      currentRisk = computeBasicRisk(systems, baseWeights, drugLoads);
      timeSeriesRisk = computeTimeSeriesRisk(systems, baseWeights, drugLoads, 7);
      projectedRisk = Object.fromEntries(systems.map(s => [s, timeSeriesRisk[s]?.[6] ?? currentRisk[s]]));
      break;
    }
    default: {
      currentRisk = computeBasicRisk(systems, baseWeights, drugLoads);
      projectedRisk = currentRisk;
      timeSeriesRisk = computeTimeSeriesRisk(systems, baseWeights, drugLoads, 7);
    }
  }

  const overallCurrent = computeOverallRisk(currentRisk);
  const overallProjected = computeOverallRisk(projectedRisk);
  const reduction = overallCurrent > 0 ? Math.round(((overallCurrent - overallProjected) / overallCurrent) * 100) : 0;

  // Build supplement plan entries
  const entries: SupplementPlanEntry[] = [];
  for (const id of selectedSubstances) {
    const info = getSubstanceInfo(id);
    if (!info) continue;
    const mechanisms = info.mechanisms;
    const primaryMech = mechanisms[0] || 'SUPPORT';
    const organs = info.organs.length > 0 ? info.organs : [id];
    const systems = getSystemsFromOrgans(organs);
    const synergies = findSynergiesInStack(selectedSubstances)
      .filter(p => p.a === id || p.b === id)
      .map(p => ({ partner: p.a === id ? p.b : p.a, partnerName: getSubstanceInfo(p.a === id ? p.b : p.a)?.name || '', strength: p.score }));

    entries.push({
      substanceId: id,
      name: info.name,
      mechanism: primaryMech,
      mechanismRu: TZ_MECH_LABELS[primaryMech] || primaryMech.replace(/_/g, ' '),
      organs,
      organLabels: organs.map(o => ORGAN_LABELS[o] || o),
      systems,
      systemLabels: systems.map(s => SYSTEM_LABELS[s] || s),
      synergies,
      timing: getTimeSlot(primaryMech) === 'empty_stomach' ? 'Натощак' : getTimeSlot(primaryMech) === 'morning' ? 'Утро' : getTimeSlot(primaryMech) === 'lunch' ? 'Обед' : getTimeSlot(primaryMech) === 'evening' ? 'Вечер' : 'На ночь',
      timeSlot: getTimeSlot(primaryMech),
      doseSuggestion: getDoseSuggestion(id),
    });
  }

  // Build daily schedule
  const schedules: DailySchedule[] = [];
  for (let d = 0; d < 7; d++) {
    const dayRisk: Record<string, number> = {};
    for (const sys of systems) {
      dayRisk[sys] = timeSeriesRisk[sys]?.[d] ?? currentRisk[sys];
    }

    schedules.push({
      dayIndex: d,
      dayLabel: WEEKDAYS_RU[d],
      date: `День ${d + 1}`,
      emptyStomach: entries.filter(e => e.timeSlot === 'empty_stomach'),
      morning: entries.filter(e => e.timeSlot === 'morning'),
      lunch: entries.filter(e => e.timeSlot === 'lunch'),
      evening: entries.filter(e => e.timeSlot === 'evening'),
      night: entries.filter(e => e.timeSlot === 'night'),
      riskLevel: computeOverallRisk(dayRisk),
      riskSystemBreakdown: dayRisk,
    });
  }

  // Coverage analysis
  const coveredSystems = systems.map(sys => {
    const sysEntries = entries.filter(e => e.systems.includes(sys));
    const coverage = Math.min(100, sysEntries.length * 15 + (supportCoverage[sys] ?? 0));
    return { system: sys, label: SYSTEM_LABELS[sys] || sys, coverage, substances: sysEntries.map(e => e.substanceId) };
  });

  const allOrgans = [...new Set(entries.flatMap(e => e.organs))];
  const coveredOrgans = allOrgans.map(org => {
    const orgEntries = entries.filter(e => e.organs.includes(org));
    return { organ: org, label: ORGAN_LABELS[org] || org, coverage: Math.min(100, orgEntries.length * 15), substances: orgEntries.map(e => e.substanceId) };
  });

  const allMechs = [...new Set(entries.flatMap(e => e.mechanism ? [e.mechanism] : []))];
  const keyMechanisms = allMechs.slice(0, 12).map(m => ({
    name: m,
    label: TZ_MECH_LABELS[m] || m.replace(/_/g, ' '),
    substances: entries.filter(e => e.mechanism === m).map(e => e.substanceId),
  }));

  const synergyPairs = findSynergiesInStack(selectedSubstances);

  return {
    riskMethod,
    overallRisk: { current: overallCurrent, projected: overallProjected, reduction },
    schedules,
    coveredSystems,
    coveredOrgans,
    keyMechanisms,
    synergyPairs,
  };
}
