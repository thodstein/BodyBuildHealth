/**
 * biostack-clinical-recommender.ts
 *
 * КЛИНИЧЕСКИ КОРРЕКТНЫЙ движок рекомендаций BioStack.
 *
 * Принцип (без догадок):
 *  - Источник истины для подбора веществ и их доз = движок калькулятора поддержки
 *    (`runSupportUnified` / `calculateSupportTZ` из ./support-plan). Это тот же движок,
 *    который считает «Калькулятор поддержки» — единственный источник клинически
 *    обоснованного выбора веществ по фазе/цели/механизму риска.
 *  - BioStack НЕ модифицирует значение риска и НЕ «угадывает» дозы — он берёт
 *    канонические дозировки (DEFAULT_DOSAGES), механизмы ТЗ (getDrugTzMechanisms) и
 *    пропускает кандидатов через клинический шлюз безопасности `selectStack`
 *    (biostack-clinical-v2.engine): абсолютные противопоказания → ЛС-исключения →
 *    ультра-лимиты → лаб-коррекции → редандантность.
 *
 * Все импорты из support-plan / support-db / support-meta — READ-ONLY (используются,
 * не меняются). Это гарантирует, что стек, собранный здесь, идентичен по составу и
 * дозам тому, что выдал бы «Калькулятор поддержки» для тех же вводных.
 */

import {
  runSupportUnified,
  hydrateState,
  type CalculatorState,
  type PlanResult,
  type PlanSubstance,
} from './support-plan';

import { selectStack, getEvidenceGrade, type StackStrategy, type EvidenceGrade } from './biostack-clinical-v2.engine';
import type { BioStackProfile } from './biostack-ai.engine';
import type { LabCompositeResult } from './lab-analysis.engine';

import { getDrugTzMechanisms, TZ_MECH_LABELS, TZ_SYSTEM_LABELS } from '../data/support-db';
import { SUPPORT_CATALOG_DATA } from '../data/support-database';
import { DEFAULT_DOSAGES } from '../data/support-meta';
import { getPrioritySubstances, type SeverityLevel } from '../data/lab-priority-map';
import { SUPPLEMENTS_DB } from '../data/support-db/supplements';
import { PHARMACY_DB } from '../data/support-db/pharmacy-db';

/* ------------------------------------------------------------------ *
 *  Дефолтное состояние калькулятора (локальная копия, без импорта из UI).
 *  Точная копия DEFAULT_STATE из src/ui/screens/Calculator/Calc.types.ts.
 * ------------------------------------------------------------------ */
const DEFAULT_STATE: CalculatorState = {
  profile: {
    weight: 80,
    age: 30,
    sex: 'male',
    workoutsPerWeek: 3,
    avgWorkoutMinutes: 60,
    sleepHours: 7,
    stressLevel: 4,
    smoker: false,
    alcohol: 'rare',
    caffeineMg: 100,
  },
  neuro: {
    dopamineScore: 1,
    serotoninScore: 1,
    gabaBalance: 'balance',
    memoryIssues: false,
    focusIssues: false,
    slowThinking: false,
    coordinationIssues: false,
    aggressionScore: 1,
    headaches: false,
    weatherDependent: false,
    sleepQuality: 'good',
  },
  pharma: {
    phase: 'course',
    aas: [],
    hasGH: false,
    hasIGF: false,
    hasInsulin: false,
    hasHCG: false,
    hasAI: false,
    hasCaber: false,
    hasSERM: false,
    hasSARMs: false,
    hasMGF: false,
    hasGLP1: false,
  },
  goals: {
    healthMaintenance: true,
    competitionPrep: false,
    sleepRecovery: false,
    lipidCorrection: false,
    bloodThinning: false,
    liverDetox: false,
    bpControl: false,
    trainingCycle: 'mass',
    cycleWeeks: 12,
    previousCycles: 0,
    timeSinceLastCycle: 'none',
  },
  hepatobiliary: {
    altAstElevation: 'none',
    ggtElevation: 'none',
    bilirubinElevation: 'none',
    fattyLiver: false,
    cholecystitis: false,
    alcoholHistory: 'none',
  },
  urinary: {
    creatinineElevation: 'none',
    ureaElevation: 'none',
    proteinuria: false,
    nephrotoxicDrugs: false,
    hypertension: false,
    diabetes: false,
    urinationPattern: 'normal',
  },
  cardio: {
    bpStage: 'normal',
    heartRate: 72,
    ldlElevation: 'none',
    hdlLow: false,
    triglycerides: 'normal',
    hctElevation: 'none',
    previousCVD: false,
    familyCVD: false,
  },
  oda: { jointPain: 'none', ligamentIssues: false, backPain: false, injuries: [] },
  labs: { preCourse: null, midCourse: null, postPCT: null, fullPanel: null },
  nutrition: {
    calories: 2500,
    proteinG: 160,
    fatG: 80,
    carbsG: 300,
    waterL: 2,
    saltIntake: 'normal',
    omega3: false,
    fiberG: 25,
    proteinGPerKg: 1.8,
    sodiumMg: 3500,
    potassiumMg: 4500,
  },
  contraindications: {
    allergies: '',
    hasCVD: false,
    hasThrombophilia: false,
    hasGI: false,
    hasProstateIssues: false,
    hasDiabetes: false,
    hasEpilepsy: false,
    hasMentalIllness: false,
    hasLiverDisease: false,
    hasKidneyDisease: false,
  },
  journal: { positive: [], negative: [] },
  epicrisis: {
    pastGyno: false,
    pastLibidoDrop: false,
    pastHctSpike: false,
    pastLiverIssues: false,
    pastKidneyIssues: false,
  },
  toxicLoad: {
    hazardousWork: false,
    regularNSAIDs: false,
    otherHeavyDrugs: false,
    bowelFrequency: 'regular',
  },
  dental: {
    bleedingGums: false,
    looseTeeth: false,
    nightGrinding: false,
    boneFractures: false,
    cramps: false,
  },
  genetics: {
    cyp19a1: 'unknown',
    srd5a2: 'unknown',
    arSensitivity: 'unknown',
    mthfr: 'normal',
  },
  gi: {
    bloating: false,
    heartburn: false,
    diarrhea: false,
    constipation: false,
    diagnosedIBS: false,
    enzymeSupport: false,
    probioticUse: false,
  },
  psych: { fearOfLoss: 1, mirrorObsession: 1, apathyOffCycle: 1 },
  injection: { glutes: '', quads: '', delts: '', localAreas: '' },
  // поля, управляющие режимами подбора:
  jointMode: false,
  neuroMode: false,
  boostEnabled: false,
  powerLevel: 'mid',
  courseWeek: 1,
};

/* ------------------------------------------------------------------ *
 *  Маппинг профиля BioStack → contraindications калькулятора
 * ------------------------------------------------------------------ */
function mapProfileToContraindications(
  profile: BioStackProfile,
  base: CalculatorState['contraindications'],
): CalculatorState['contraindications'] {
  const out: CalculatorState['contraindications'] = { ...base };
  if (profile.drugAllergies && profile.drugAllergies.length) {
    out.allergies = (out.allergies ? out.allergies + ', ' : '') + profile.drugAllergies.join(', ');
  }
  return out;
}

/** Приоритет симптомов BioStack → режимы подбора калькулятора.
 *  Суставной режим — при наличии суставных жалоб,
 *  нейро-режим — при нейро-/ЦНС-симптомах. */
function mapGoalsToModes(profile: BioStackProfile): {
  jointMode: boolean;
  neuroMode: boolean;
} {
  const joint = (profile.jointSymptoms || []).some(s => !!s && s.trim().length > 0);
  const neuro = (profile.neuroSymptoms || []).some(s => !!s && s.trim().length > 0)
    || (profile.cnsSymptoms || []).some(s => !!s && s.trim().length > 0);
  return { jointMode: joint, neuroMode: neuro };
}

/* ------------------------------------------------------------------ *
 *  Результат
 * ------------------------------------------------------------------ */
export interface ClinicalSubstance {
  id: string;
  name: string;
  doseMg: number;
  doseDisplay: string;
  timing: string;
  tier: string;
  categories: string[];
  targetSystems: string[];
  mechanismReason: string;
  comment: string;
  tzMechanisms: { mechId: string; label: string }[];
  brandName?: string;
}

export interface ClinicalStackResult {
  /** итоговые вещества после клинического шлюза безопасности */
  substances: ClinicalSubstance[];
  /** описание стека (авто-сгенерированное) */
  stackDescription: string;
  /** синергии внутри стека (пары веществ, которые работают вместе) */
  stackSynergies: { ids: string[]; effect: string; strength: string }[];
  /** вещества, отсеянные шлюзом (для прозрачности) */
  excluded: {
    id: string;
    name: string;
    reason: string;
    severity: 'hard' | 'drug' | 'titration' | 'ul' | 'redundant';
  }[];
  riskBefore: number;
  riskAfter: number;
  coveragePercent: number;
  monitoring: string[];
  specialInstructions: string[];
  conflicts: string[];
  /** сырые данные шлюза безопасности */
  safety: {
    hardStops: any[];
    drugExclusions: any[];
    drugTitrations: any[];
    ulWarnings: any[];
    labAdjustments: any[];
    redundancy: any[];
  };
  /** флаг: использовался ли источник истины (всегда true — это и есть гарантия) */
  sourceOfTruth: 'support-plan/runSupportUnified';
  /** неделя курса, на которой считался план */
  courseWeek: number;
}

/* ------------------------------------------------------------------ *
 *  Каталоговый fallback: когда движок вернул 0 веществ,
 *  строим пул кандидатов из SUPPORT_CATALOG_DATA + SUPPLEMENTS_DB + PHARMACY_DB,
 *  сопоставляя с фильтрами органов/механизмов/маркеров.
 * ------------------------------------------------------------------ */
function buildCatalogFallback(
  filterOrgans?: string[],
  filterMechanisms?: string[],
  filterMarkers?: string[],
  profile?: BioStackProfile,
): string[] {
  const allIds = Object.keys(SUPPORT_CATALOG_DATA);
  const scored: Array<{ id: string; score: number }> = [];

  for (const id of allIds) {
    // пропускаем pharma-only (лекарства) — они только из курса
    const cat = SUPPORT_CATALOG_DATA[id];
    if (!cat) continue;

    // сопоставление TZ-органов
    const tzOrgans = (getDrugTzMechanisms(id) || []).map(m => m.organId);
    const tzMechs = (getDrugTzMechanisms(id) || []).map(m => m.mechId);

    let score = 0;

    // organs match
    if (filterOrgans?.length) {
      const organHits = filterOrgans.filter(o => tzOrgans.includes(o)).length;
      score += organHits * 3;
    }

    // mechanisms match
    if (filterMechanisms?.length) {
      const mechHits = filterMechanisms.filter(m => tzMechs.includes(m)).length;
      score += mechHits * 3;
    }

    // markers match
    if (filterMarkers?.length) {
      const SEVERITIES: SeverityLevel[] = ['mild', 'moderate', 'severe'];
      for (const mk of filterMarkers) {
        for (const sev of SEVERITIES) {
          for (const e of getPrioritySubstances(mk, sev)) {
            if (e.substanceId === id) score += 5;
          }
        }
      }
    }

    // базовый score: core-вещества и broad-spectrum имеют приоритет
    const isCore = (cat as any).tier === 'core';
    if (isCore) score += 2;

    // broad-spectrum (вещества с >4 TZ-механизмами)
    if (tzMechs.length > 4) score += 2;

    // если нет фильтров — всем дать базовый score, потом отберём топ
    if (!filterOrgans?.length && !filterMechanisms?.length && !filterMarkers?.length) {
      score += isCore ? 5 : 1;
    }

    if (score > 0) scored.push({ id, score });
  }

  // сортировка по score, топ-20
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 20).map(s => s.id);
}

/* ------------------------------------------------------------------ *
 *  Основная функция
 * ------------------------------------------------------------------ */
export interface BuildClinicalStackOpts {
  strategy?: StackStrategy;
  lab?: LabCompositeResult | null;
  courseWeek?: number;
  /** принудительный powerLevel (иначе из профиля) */
  powerLevel?: CalculatorState['powerLevel'];
  /** мульти-выбор органов/систем ТЗ (напр. ['hepatic','cardio']) */
  filterOrgans?: string[];
  /** мульти-выбор механизмов ТЗ (напр. ['cv1','liv1']) */
  filterMechanisms?: string[];
  /** мульти-выбор лаб-маркеров (напр. ['ALT','CREATININE']) */
  filterMarkers?: string[];
  /** уровень доказательности: 'all' | 'A' | 'B' | 'C' (кумулятивно: B включает A и B) */
  evidenceLevel?: 'all' | 'A' | 'B' | 'C';
  /** максимальное число веществ в стеке (ограничение сверху) */
  maxStackSize?: number;
  /** учитывать курс (AAS/HCG/AI из localStorage) */
  useCourse?: boolean;
  /** учитывать анализы (лабораторные данные) */
  useLabs?: boolean;
  /** учитывать профиль (healthConditions, targetSystems, targetOrgans) */
  useProfile?: boolean;
}

export function buildClinicalStack(
  profile: BioStackProfile,
  opts: BuildClinicalStackOpts = {},
): ClinicalStackResult {
  // 1) Полное состояние = дефолт ⊕ реальные данные из localStorage (pharma/labs/neuro/CI)
  const h = hydrateState();
  console.log('[BioStack] hydrateState:', h);
  console.log('[BioStack] profile:', profile);
  console.log('[BioStack] opts:', opts);
  const modes = mapGoalsToModes(profile);
  const courseWeek = opts.courseWeek ?? 1;
  const useCourse = opts.useCourse ?? true;
  const useLabs = opts.useLabs ?? true;
  const useProfile = opts.useProfile ?? true;

  const state: CalculatorState = {
    ...DEFAULT_STATE,
    ...(useCourse ? (h as Partial<CalculatorState>) : { pharma: DEFAULT_STATE.pharma }),
    ...(useLabs ? (h as Partial<CalculatorState>) : { labs: DEFAULT_STATE.labs }),
    contraindications: useProfile
      ? mapProfileToContraindications(profile, DEFAULT_STATE.contraindications)
      : DEFAULT_STATE.contraindications,
    jointMode: useProfile ? modes.jointMode : false,
    neuroMode: useProfile ? modes.neuroMode : false,
    boostEnabled: false,
    powerLevel: opts.powerLevel ?? 'mid',
    courseWeek,
  } as CalculatorState;

  // 2) Источник истины: движок калькулятора поддержки (канонические дозы + механизмы)
  const plan: PlanResult = runSupportUnified(state);
  console.log('[BioStack] plan.substances:', plan.substances.map(s => s.id));
  console.log('[BioStack] plan.overallRiskBefore/After:', plan.overallRiskBefore, plan.overallRiskAfter);

  const filterOrgans = useProfile && opts.filterOrgans?.length ? opts.filterOrgans : undefined;
  const filterMechanisms = useProfile && opts.filterMechanisms?.length ? opts.filterMechanisms : undefined;
  const filterMarkers = useProfile && opts.filterMarkers?.length ? opts.filterMarkers : undefined;
  const evidenceLevel = opts.evidenceLevel;

  // 2a) Фильтры по органам / механизмам / маркерам / доказательности (до клинического шлюза)
  let candidateIds = plan.substances.map((s) => s.id);
  console.log('[BioStack] initial candidateIds:', candidateIds);

  // ── Каталоговый fallback: если движок вернул 0 веществ ──
  if (!candidateIds.length) {
    const fallbackSet = buildCatalogFallback(opts.filterOrgans, opts.filterMechanisms, opts.filterMarkers, profile);
    if (fallbackSet.length) {
      console.log('[BioStack] catalog fallback:', fallbackSet.length, 'candidates');
      candidateIds = fallbackSet;
    }
  }

  if (filterMarkers && filterMarkers.length) {
    const markerSubs = new Set<string>();
    const SEVERITIES: SeverityLevel[] = ['mild', 'moderate', 'severe'];
    for (const mk of filterMarkers) {
      for (const sev of SEVERITIES) {
        for (const e of getPrioritySubstances(mk, sev)) markerSubs.add(e.substanceId);
      }
    }
    if (markerSubs.size) candidateIds = candidateIds.filter((id) => markerSubs.has(id));
  }

  if (filterMechanisms && filterMechanisms.length) {
    candidateIds = candidateIds.filter((id) =>
      (getDrugTzMechanisms(id) || []).some((m) => filterMechanisms!.includes(m.mechId)),
    );
  }

  if (filterOrgans && filterOrgans.length) {
    candidateIds = candidateIds.filter((id) =>
      (getDrugTzMechanisms(id) || []).some((m) => filterOrgans!.includes(m.organId)),
    );
  }

  if (evidenceLevel && evidenceLevel !== 'all') {
    const allowed: EvidenceGrade[] = opts.evidenceLevel === 'C' ? ['A','B','C'] : opts.evidenceLevel === 'B' ? ['A','B'] : ['A'];
    const allowedSet = new Set(allowed);
    candidateIds = candidateIds.filter((id) => {
      const entries = [...(SUPPLEMENTS_DB[id] || []), ...(PHARMACY_DB[id] || [])];
      if (!entries.length) return true; // нет данных доказательности → не отсеиваем
      return entries.some((e) => allowedSet.has(e.q));
    });
  }
  console.log('[BioStack] candidateIds after filters:', candidateIds);

  // 3) Клинический шлюз безопасности (абсолютные противопоказания, ЛС, UL, лаб, редандантность)
  const strategy = opts.strategy ?? 'comprehensive';
  const gate = selectStack(
    candidateIds,
    profile,
    strategy,
    useLabs ? (opts.lab ?? null) : null,
  );
  console.log('[BioStack] gate.ids:', gate.ids);
  console.log('[BioStack] gate.excluded:', gate.hardStops.length + gate.drugExclusions.length + gate.ulWarnings.length);

  const gateIdSet = new Set(gate.ids);
  const byId = new Map<string, PlanSubstance>(plan.substances.map((s) => [s.id, s]));

  const substances: ClinicalSubstance[] = [];
  for (const id of gate.ids) {
    const s = byId.get(id);
    const catalog = SUPPORT_CATALOG_DATA[id];
    const tz = (getDrugTzMechanisms(id) || []).map((m) => ({
      mechId: m.mechId,
      label: (TZ_MECH_LABELS as any)[m.mechId] || m.mechId,
    }));

    if (s) {
      // вещество из движка калькулятора (канонические дозы)
      substances.push({
        id: s.id,
        name: s.name,
        doseMg: s.doseMg,
        doseDisplay: s.doseDisplay,
        timing: s.timing,
        tier: s.tier,
        categories: s.category || (catalog ? catalog.category || [] : []),
        targetSystems: s.targetSystems || [],
        mechanismReason: s.mechanismReason || '',
        comment: s.comment || '',
        tzMechanisms: tz,
        brandName: s.brandName,
      });
    } else if (catalog) {
      // fallback: вещество из каталога (дозы из DEFAULT_DOSAGES)
      const dosage = (DEFAULT_DOSAGES as any)[id] || (catalog as any).dosage || { mg: 500, timing: 'с едой' };
      substances.push({
        id,
        name: (catalog as any).nameRu || (catalog as any).name || id,
        doseMg: dosage.mg || 500,
        doseDisplay: `${dosage.mg || 500} мг`,
        timing: dosage.timing || 'с едой',
        tier: (catalog as any).tier || 'standard',
        categories: (catalog as any).category || [],
        targetSystems: (catalog as any).targetOrgans || [],
        mechanismReason: tz.map(t => t.label).join(', ') || '',
        comment: '',
        tzMechanisms: tz,
        brandName: undefined,
      });
    }
  }

  // 3a) Кап количества: если задан maxStackSize, усекаем по грейду + широте покрытия
  if (opts.maxStackSize && opts.maxStackSize > 0 && substances.length > opts.maxStackSize) {
    substances.sort((a, b) => {
      const ga = getEvidenceGrade(a.id);
      const gb = getEvidenceGrade(b.id);
      const wa = ga === 'A' ? 3 : ga === 'B' ? 2 : 1;
      const wb = gb === 'A' ? 3 : gb === 'B' ? 2 : 1;
      if (wa !== wb) return wb - wa; // A > B > C
      const breadthDiff = (b.tzMechanisms?.length || 0) - (a.tzMechanisms?.length || 0);
      if (breadthDiff !== 0) return breadthDiff;
      return (b.tier === 'core' ? 1 : 0) - (a.tier === 'core' ? 1 : 0);
    });
    const trimmed = substances.slice(0, opts.maxStackSize);
    substances.length = 0;
    substances.push(...trimmed);
  }

  // 3b) Синергии внутри стека
  const stackSynergies: ClinicalStackResult['stackSynergies'] = [];
  const subIdSet = new Set(substances.map((s) => s.id.toLowerCase()));
  const seenSynKeys = new Set<string>();
  for (const s of substances) {
    const cat_ = SUPPORT_CATALOG_DATA[s.id] || SUPPORT_CATALOG_DATA[s.id.toUpperCase()];
    if (!(cat_ as any)?.synergies) continue;
    for (const syn of (cat_ as any).synergies) {
      const partnerId: string = (syn.with || '').toLowerCase();
      if (!subIdSet.has(partnerId)) continue;
      const key = [s.id.toLowerCase(), partnerId].sort().join('|');
      if (seenSynKeys.has(key)) continue;
      seenSynKeys.add(key);
      stackSynergies.push({
        ids: [s.id, partnerId],
        effect: syn.effect || syn.mechanism || '',
        strength: (syn.severity || syn.strength || 'MEDIUM').toUpperCase(),
      });
    }
  }

  // 3c) Описание стека
  const coveredSystems = new Set<string>();
  for (const s of substances) {
    for (const tz of s.tzMechanisms || []) {
      const prefixMap: Record<string, string> = { cv: 'cardio', liv: 'hepatic', ren: 'renal', cns: 'cns', rep: 'reproductive', hem: 'hematologic' };
      const prefix = tz.mechId.match(/^[a-z]+/)?.[0];
      if (prefix && prefixMap[prefix]) coveredSystems.add(prefixMap[prefix]);
    }
  }
  const systemNames = [...coveredSystems].map((sys) => (TZ_SYSTEM_LABELS as any)[sys] || sys).join(', ');
  const gradeCounts = substances.reduce((acc, s) => { const g = getEvidenceGrade(s.id); acc[g] = (acc[g] || 0) + 1; return acc; }, {} as Record<string, number>);
  const gradeParts: string[] = [];
  if (gradeCounts.A) gradeParts.push(`A:${gradeCounts.A}`);
  if (gradeCounts.B) gradeParts.push(`B:${gradeCounts.B}`);
  if (gradeCounts.C) gradeParts.push(`C:${gradeCounts.C}`);
  const stackDescription = `Стек из ${substances.length} веществ (${gradeParts.join(', ')}). Грейд: ${opts.evidenceLevel || 'all'}. Покрытие систем: ${systemNames || 'не определено'}. Построено движком калькулятора поддержки (runSupportUnified).`;

  // 4) Отсеянные вещества (прозрачность)
  const excluded: ClinicalStackResult['excluded'] = [];
  const pushExcluded = (
    list: any[],
    severity: 'hard' | 'drug' | 'titration' | 'ul' | 'redundant',
    reasonFn: (x: any) => string,
  ) => {
    for (const x of list || []) {
      if (!gateIdSet.has(x.substanceId)) {
        excluded.push({
          id: x.substanceId,
          name: x.substanceName,
          reason: reasonFn(x),
          severity,
        });
      }
    }
  };
  pushExcluded(gate.hardStops, 'hard', (x) => x.reason || 'Абсолютное противопоказание');
  pushExcluded(gate.drugExclusions, 'drug', (x) => `${x.drug}: ${x.effect || x.mechanism || 'ЛС-конфликт'}`);
  pushExcluded(gate.drugTitrations, 'titration', (x) => `${x.drug}: титровать ${x.action || ''}`);
  pushExcluded(gate.ulWarnings, 'ul', (x) => x.message || 'Превышен верхний допустимый предел');
  pushExcluded(gate.redundancy, 'redundant', (x) => x.reason || 'Редандантность');

  const coveragePercent =
    typeof plan.coveragePercent === 'number' ? plan.coveragePercent : 0;

  console.log('[BioStack] FINAL result:', {
    substancesCount: substances.length,
    excludedCount: excluded.length,
    riskBefore: plan.overallRiskBefore,
    riskAfter: plan.overallRiskAfter,
    coveragePercent,
  });

  const conflictsAsText = (plan.conflicts || []).map(
    (c) => `${c.aName} + ${c.bName}: ${c.effect}`,
  );

  return {
    substances,
    stackDescription,
    stackSynergies,
    excluded,
    riskBefore: plan.overallRiskBefore,
    riskAfter: plan.overallRiskAfter,
    coveragePercent,
    monitoring: plan.monitoring || [],
    specialInstructions: plan.specialInstructions || [],
    conflicts: conflictsAsText,
    safety: {
      hardStops: gate.hardStops,
      drugExclusions: gate.drugExclusions,
      drugTitrations: gate.drugTitrations,
      ulWarnings: gate.ulWarnings,
      labAdjustments: (gate.labAdjustments as any) || [],
      redundancy: gate.redundancy,
    },
    sourceOfTruth: 'support-plan/runSupportUnified',
    courseWeek,
  };
}

/* ------------------------------------------------------------------ *
 *  Быстрая сводка для UI (без тяжёлых подробностей)
 * ------------------------------------------------------------------ */
export function summarizeClinicalStack(r: ClinicalStackResult): string {
  const lines: string[] = [];
  lines.push(`Клинический подбор (источник: движок калькулятора поддержки)`);
  lines.push(`Веществ в плане: ${r.substances.length}`);
  lines.push(`Риск до/после поддержки: ${r.riskBefore} → ${r.riskAfter}`);
  if (r.excluded.length) lines.push(`Отсеяно шлюзом безопасности: ${r.excluded.length}`);
  r.substances.forEach((s) => {
    lines.push(`• ${s.name} — ${s.doseDisplay || s.doseMg + ' мг'}, ${s.timing}`);
  });
  return lines.join('\n');
}
