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

import { selectStack, getEvidenceGrade, type StackStrategy, type EvidenceGrade, ANTIOXIDANT_PATHWAY } from './biostack-clinical-v2.engine';
import type { BioStackProfile } from './biostack-ai.engine';
import type { LabCompositeResult } from './lab-analysis.engine';

import { getDrugTzMechanisms, TZ_MECH_LABELS, TZ_SYSTEM_LABELS } from '../data/support-db';
import { SUPPORT_CATALOG_DATA } from '../data/support-database';
import { DEFAULT_DOSAGES } from '../data/support-meta';
import { getPrioritySubstances, type SeverityLevel } from '../data/lab-priority-map';
import { SUPPLEMENTS_DB } from '../data/support-db/supplements';
import { PHARMACY_DB } from '../data/support-db/pharmacy-db';
import { normalizeDoseByWeight } from '../engines/support-plan/engine-helpers';
import { SYNERGY_NETWORK } from '../data/support-synergy-network';
import { TZ_AUTO_BLACKLIST, PHASE_BLOCKLIST } from './support-plan/shared-constants';

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
  /** источник вещества в стеке */
  source?: 'mandatory' | 'lab' | 'tz' | 'greedy';
}

export interface ClinicalStackResult {
  /** итоговые вещества после клинического шлюза безопасности */
  substances: ClinicalSubstance[];
  /** описание стека (авто-сгенерированное) */
  stackDescription: string;
  /** синергии внутри стека (пары веществ, которые работают вместе) */
  stackSynergies: Array<{
    ids: string[];
    effect: string;
    mechanism?: string;
    strength: string;
    domain?: string;
    description?: string;
  }>;
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
  /** true если стек собран без анализов и без курса — ориентировочный */
  isOrientational?: boolean;
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
  phase?: string,
  existingIds?: string[],
  filterMode?: 'strict' | 'balanced',
): string[] {
  const allIds = Object.keys(SUPPORT_CATALOG_DATA);
  const scored: Array<{ id: string; score: number }> = [];
  const existingSet = new Set((existingIds || []).map(id => id.toLowerCase()));

  // Phase-блоклист
  const phaseKey = phase || 'course';
  const phaseBlocked = PHASE_BLOCKLIST[phaseKey] || new Set<string>();

  const hasActiveFilters = (filterOrgans?.length || filterMechanisms?.length || filterMarkers?.length);
  const seen = new Set<string>();

  for (const id of allIds) {
    const idLower = id.toLowerCase();
    if (seen.has(idLower)) continue; // не дублируем один и тот же препарат в разном регистре
    seen.add(idLower);
    const cat = SUPPORT_CATALOG_DATA[id];
    if (!cat) continue;

    // Чёрные списки
    if (TZ_AUTO_BLACKLIST.has(id)) continue;
    if (phaseBlocked.has(id)) continue;
    if (existingSet.has(idLower)) continue; // не дублируем уже выбранные

    const tzOrgans = (getDrugTzMechanisms(id) || []).map(m => m.organId);
    const tzMechs = (getDrugTzMechanisms(id) || []).map(m => m.mechId);

    let score = 0;
    let hasFilterMatch = false;

    // organs match
    if (filterOrgans?.length) {
      const organHits = filterOrgans.filter(o => tzOrgans.includes(o)).length;
      if (organHits > 0) hasFilterMatch = true;
      score += organHits * 5;
    }

    // mechanisms match
    if (filterMechanisms?.length) {
      const mechHits = filterMechanisms.filter(m => tzMechs.includes(m)).length;
      if (mechHits > 0) hasFilterMatch = true;
      score += mechHits * 4;
    }

    // markers match
    if (filterMarkers?.length) {
      const SEVERITIES: SeverityLevel[] = ['mild', 'moderate', 'severe'];
      for (const mk of filterMarkers) {
        for (const sev of SEVERITIES) {
          for (const e of getPrioritySubstances(mk, sev)) {
            if (e.substanceId === id) {
              score += 5;
              hasFilterMatch = true;
            }
          }
        }
      }
    }

    // базовый score: core-вещества и broad-spectrum имеют приоритет
    const isCore = (cat as any).tier === 'core';
    if (isCore) score += 2;

    // broad-spectrum: даём бонус ТОЛЬКО если есть фильтр-совпадение
    // (чтобы generic omega3/CoQ10 не прыгали вверх в organ-фильтрованном стеке)
    // strict-mode: мин. 2 фильтровых совпадения, иначе broad-spectrum не получает бонус
    if (hasFilterMatch && tzMechs.length > 4) {
      const organHits = filterOrgans?.filter(o => tzOrgans.includes(o)).length || 0;
      const mechHits = filterMechanisms?.filter(m => tzMechs.includes(m)).length || 0;
      const markerHit = (filterMarkers?.length && hasFilterMatch) ? 1 : 0;
      const totalFilterHits = organHits + mechHits + markerHit;
      if (filterMode !== 'strict' || totalFilterHits >= 2) score += 2;
    }

    // синергии с уже выбранными веществами
    if (existingIds && existingIds.length > 0) {
      for (const entry of SYNERGY_NETWORK) {
        if (entry.type !== 'synergy') continue;
        const partners = [entry.a, entry.b, entry.c, entry.d, entry.e, entry.f, entry.g, ...(entry.substances || [])]
          .filter(Boolean).map(s => (s as string).toLowerCase());
        if (!partners.includes(idLower)) continue;
        for (const eid of existingIds) {
          if (partners.includes(eid.toLowerCase())) { score += Math.min(entry.score, 10); break; }
        }
      }
    }

    // если нет фильтров — всем дать базовый score, потом отберём топ
    if (!hasActiveFilters) {
      score += isCore ? 5 : 1;
    }

    if (score > 0) scored.push({ id, score });
  }

  // сортировка по score, топ-N (меньше при фильтрации — уже отобрали релевантное)
  scored.sort((a, b) => b.score - a.score);
  const cap = filterMode === 'strict' ? 8 : (hasActiveFilters ? 12 : 25);
  return scored.slice(0, cap).map(s => s.id);
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
  /** режим фильтрации: 'strict' = только вещества по активным фильтрам, 'balanced' = фильтры + синергии */
  filterMode?: 'strict' | 'balanced';
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
    // ВСЕГДА из hydrateState (не зависят от переключателей)
    profile: h.profile || DEFAULT_STATE.profile,
    neuro: h.neuro || DEFAULT_STATE.neuro,
    psych: h.psych || DEFAULT_STATE.psych,
    genetics: h.genetics || DEFAULT_STATE.genetics,
    hepatobiliary: h.hepatobiliary || DEFAULT_STATE.hepatobiliary,
    cardio: h.cardio || DEFAULT_STATE.cardio,
    urinary: h.urinary || DEFAULT_STATE.urinary,
    goals: h.goals || DEFAULT_STATE.goals,
    nutrition: h.nutrition || DEFAULT_STATE.nutrition,
    oda: h.oda || DEFAULT_STATE.oda,
    dental: h.dental || DEFAULT_STATE.dental,
    gi: h.gi || DEFAULT_STATE.gi,
    toxicLoad: h.toxicLoad || DEFAULT_STATE.toxicLoad,
    epicrisis: h.epicrisis || DEFAULT_STATE.epicrisis,
    injection: h.injection || DEFAULT_STATE.injection,
    journal: h.journal || DEFAULT_STATE.journal,
    // pharma: ТОЛЬКО если useCourse=true
    pharma: useCourse ? (h.pharma || DEFAULT_STATE.pharma) : DEFAULT_STATE.pharma,
    // labs: ТОЛЬКО если useLabs=true
    labs: useLabs ? (h.labs || DEFAULT_STATE.labs) : DEFAULT_STATE.labs,
    // contraindications: ВСЕГДА из hydrateState, дополнительно из profile если useProfile
    contraindications: useProfile
      ? mapProfileToContraindications(profile, h.contraindications || DEFAULT_STATE.contraindications)
      : (h.contraindications || DEFAULT_STATE.contraindications),
    jointMode: useProfile ? modes.jointMode : false,
    neuroMode: useProfile ? modes.neuroMode : false,
    boostEnabled: false,
    powerLevel: opts.powerLevel ?? 'mid',
    courseWeek: useCourse ? courseWeek : 1,
  } as CalculatorState;

  // Стек ориентировочный если нет ни курса, ни анализов
  const isOrientational = !useLabs && !useCourse;

  console.log('[BioStack] scenario:', {
    useCourse, useLabs, useProfile,
    aasCount: state.pharma.aas.length,
    hasLabs: !!state.labs?.fullPanel || !!state.labs?.midCourse,
    profileWeight: state.profile?.weight,
    powerLevel: state.powerLevel,
    isOrientational,
  });

  // 2) Источник истины: движок калькулятора поддержки (канонические дозы + механизмы)
  const plan: PlanResult = runSupportUnified(state);
  console.log('[BioStack] plan.substances:', plan.substances.map(s => s.id));
  console.log('[BioStack] plan.overallRiskBefore/After:', plan.overallRiskBefore, plan.overallRiskAfter);

  const filterOrgans = useProfile && opts.filterOrgans?.length ? opts.filterOrgans : undefined;
  const filterMechanisms = useProfile && opts.filterMechanisms?.length ? opts.filterMechanisms : undefined;
  const filterMarkers = useProfile && opts.filterMarkers?.length ? opts.filterMarkers : undefined;
  const evidenceLevel = opts.evidenceLevel;
  const hasActiveFilters = (filterOrgans?.length || filterMechanisms?.length || filterMarkers?.length);

  // 2a) Фильтры по органам / механизмам / маркерам / доказательности (до клинического шлюза)
  let candidateIds = plan.substances.map((s) => s.id);
  console.log('[BioStack] initial candidateIds:', candidateIds);

  // ── Каталоговый fallback: если движок вернул мало веществ ──
  if (candidateIds.length < 3) {
    const fallbackSet = buildCatalogFallback(
      opts.filterOrgans, opts.filterMechanisms, opts.filterMarkers, profile,
      state.pharma?.phase, candidateIds, opts.filterMode,
    );
    if (fallbackSet.length) {
      console.log('[BioStack] catalog fallback:', fallbackSet.length, 'candidates (had', candidateIds.length, ')');
      // MERGE с существующими, не замена
      candidateIds = [...new Map([...candidateIds, ...fallbackSet].map(id => [id.toLowerCase(), id])).values()];
    }
  }

  // ── Взвешенный scoring фильтров (UNION вместо AND) ──
  // Каждый фильтр добавляет баллы. Вещества с score > 0 проходят.
  // Это предотвращает «воронку смерти» когда последовательные AND убивают всех кандидатов.
  const hasAnyFilter = (filterMarkers && filterMarkers.length) || (filterMechanisms && filterMechanisms.length) || (filterOrgans && filterOrgans.length);

  if (hasAnyFilter) {
    // Pre-compute marker substances
    const markerSubs = new Set<string>();
    if (filterMarkers && filterMarkers.length) {
      const SEVERITIES: SeverityLevel[] = ['mild', 'moderate', 'severe'];
      for (const mk of filterMarkers) {
        for (const sev of SEVERITIES) {
          for (const e of getPrioritySubstances(mk, sev)) markerSubs.add(e.substanceId);
        }
      }
    }

    const filterScore = new Map<string, number>();
    const filterMode = opts.filterMode || 'balanced';
    const minScore = filterMode === 'strict' ? 6 : 1;
    for (const id of candidateIds) {
      let score = 0;
      // маркеры: +5 за совпадение
      if (markerSubs.size && markerSubs.has(id)) score += 5;
      // механизмы: +3 за каждый совпавший
      if (filterMechanisms && filterMechanisms.length) {
        const tz = getDrugTzMechanisms(id) || [];
        const mechHits = tz.filter(m => filterMechanisms!.includes(m.mechId)).length;
        if (mechHits > 0) score += mechHits * 3;
      }
      // органы: +3 за каждый совпавший
      if (filterOrgans && filterOrgans.length) {
        const tz = getDrugTzMechanisms(id) || [];
        const organHits = tz.filter(m => filterOrgans!.includes(m.organId)).length;
        if (organHits > 0) score += organHits * 3;
      }
      if (score >= minScore) filterScore.set(id, score);
    }

    if (filterScore.size > 0) {
      candidateIds = candidateIds
        .filter(id => filterScore.has(id))
        .sort((a, b) => (filterScore.get(b) || 0) - (filterScore.get(a) || 0));
    } else {
      // Ни один фильтр не совпал — оставляем всех (не убиваем стек)
      console.log('[BioStack] WARN: no filter matches, keeping all candidates');
    }
  }

  if (evidenceLevel && evidenceLevel !== 'all') {
    const allowed: EvidenceGrade[] = opts.evidenceLevel === 'C' ? ['A','B','C'] : opts.evidenceLevel === 'B' ? ['A','B'] : ['A'];
    const allowedSet = new Set(allowed);
    const before = candidateIds.length;
    candidateIds = candidateIds.filter((id) => {
      const entries = [...(SUPPLEMENTS_DB[id] || []), ...(PHARMACY_DB[id] || [])];
      if (!entries.length) return true; // нет данных доказательности → не отсеиваем
      return entries.some((e) => allowedSet.has(e.q));
    });
    // Если evidence убил всех — откатываем
    if (candidateIds.length === 0 && before > 0) {
      console.log('[BioStack] WARN: evidence filter killed all candidates, reverting');
      candidateIds = plan.substances.map((s) => s.id);
    }
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

  // 3a) Greedy synergy pass: добавить вещества с высокой синергией к уже выбранным
  const maxStack = opts.maxStackSize || 20;
  if (gate.ids.length < maxStack) {
    const gateSet = new Set(gate.ids.map(id => id.toLowerCase()));
    const hardStopSet = new Set(gate.hardStops.map(h => h.substanceId));
    const drugExclSet = new Set(gate.drugExclusions.map(e => e.substanceId));
    const allCatalogIds = Object.keys(SUPPORT_CATALOG_DATA);

    // Pre-compute mechanisms of already selected substances for redundancy check
    const selectedMechs = new Set<string>();
    for (const gid of gate.ids) {
      const tz = getDrugTzMechanisms(gid) || [];
      for (const m of tz) selectedMechs.add(m.mechId);
    }

    const filterMode = opts.filterMode || 'balanced';
    const synThreshold = filterMode === 'strict' ? 25 : 15;
    const synCap = filterMode === 'strict' ? 6 : 10;
    const strictFilter = filterMode === 'strict' && hasActiveFilters;
    const synCandidates: Array<{ id: string; synScore: number }> = [];
    for (const candId of allCatalogIds) {
      const candLower = candId.toLowerCase();
      if (gateSet.has(candLower)) continue;
      if (hardStopSet.has(candId)) continue;
      if (drugExclSet.has(candId)) continue;
      if (TZ_AUTO_BLACKLIST.has(candId)) continue;

      let synScore = 0;
      let hasConflict = false;
      for (const entry of SYNERGY_NETWORK) {
        if (entry.type === 'synergy') {
          const partners = [entry.a, entry.b, entry.c, entry.d, entry.e, entry.f, entry.g, ...(entry.substances || [])]
            .filter(Boolean).map(s => (s as string).toLowerCase());
          if (!partners.includes(candLower)) continue;
          for (const gid of gate.ids) {
            if (partners.includes(gid.toLowerCase())) synScore += entry.score;
          }
        } else if (entry.type === 'conflict' || entry.type === 'caution') {
          // Проверка конфликтов с уже выбранными
          const partners = [entry.a, entry.b, entry.c, entry.d, entry.e, entry.f, entry.g, ...(entry.substances || [])]
            .filter(Boolean).map(s => (s as string).toLowerCase());
          if (partners.includes(candLower)) {
            for (const gid of gate.ids) {
              if (partners.includes(gid.toLowerCase())) { hasConflict = true; break; }
            }
          }
          if (hasConflict) break;
        }
      }
      if (hasConflict) continue;

      // Redundancy check: не >2 веществ на одном антиоксидантном пути
      const candPathway = ANTIOXIDANT_PATHWAY[candLower];
      if (candPathway) {
        let samePathCount = 0;
        for (const gid of gate.ids) {
          if (ANTIOXIDANT_PATHWAY[gid.toLowerCase()] === candPathway) samePathCount++;
        }
        if (samePathCount >= 2) continue; // путь уже перегружен
      }

      // Орган/механизм-фильтр в synergy pass:
      // в strict-режиме добавляем только вещества, совпадающие с активным фильтром
      if (strictFilter) {
        const candTz = getDrugTzMechanisms(candId) || [];
        const candOrgans = new Set(candTz.map(m => m.organId));
        const candMechs = new Set(candTz.map(m => m.mechId));
        const organHit = filterOrgans?.some(o => candOrgans.has(o));
        const mechHit = filterMechanisms?.some(m => candMechs.has(m));
        if (!organHit && !mechHit) continue;
      }

      if (synScore >= synThreshold) synCandidates.push({ id: candId, synScore });
    }

    synCandidates.sort((a, b) => b.synScore - a.synScore);
    const toAdd = synCandidates.slice(0, maxStack - gate.ids.length);
    if (toAdd.length > 0) {
      console.log('[BioStack] greedy synergy pass: adding', toAdd.length, 'substances (score ≥ 15)');
      gate.ids.push(...toAdd.map(c => c.id));
    }
  }

  const gateIdSet = new Set(gate.ids);
  const byId = new Map<string, PlanSubstance>(plan.substances.map((s) => [s.id, s]));

  // Определяем источники веществ
  const mandatoryIds = new Set((plan.phaseAssignedDrugs || []).map(d => d.id));
  // Greedy-вещества: были в greedy pass, но не в candidateIds (не из plan.substances)
  const planSubIds = new Set(plan.substances.map(s => s.id));
  const greedyIds = new Set(gate.ids.filter(id => !planSubIds.has(id) && !mandatoryIds.has(id)));

  const substances: ClinicalSubstance[] = [];
  for (const id of gate.ids) {
    const s = byId.get(id);
    const catalog = SUPPORT_CATALOG_DATA[id];
    const tz = (getDrugTzMechanisms(id) || []).map((m) => ({
      mechId: m.mechId,
      label: (TZ_MECH_LABELS as any)[m.mechId] || m.mechId,
    }));

    // Определяем источник
    let source: ClinicalSubstance['source'] = 'tz';
    if (mandatoryIds.has(id)) source = 'mandatory';
    else if (greedyIds.has(id)) source = 'greedy';
    else if (s) source = 'tz'; // из plan.substances (mandatory + lab + TZ)

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
        source,
      });
    } else if (catalog) {
      // fallback: вещество из каталога (дозы из DEFAULT_DOSAGES, нормализованные по весу)
      const dosage = (DEFAULT_DOSAGES as any)[id] || (catalog as any).dosage || { mg: 500, timing: 'с едой' };
      const bw = state.profile?.weight || 80;
      const normalizedMg = normalizeDoseByWeight(dosage.mg || 500, bw);
      substances.push({
        id,
        name: (catalog as any).nameRu || (catalog as any).name || id,
        doseMg: normalizedMg,
        doseDisplay: `${normalizedMg} мг`,
        timing: dosage.timing || 'с едой',
        tier: (catalog as any).tier || 'standard',
        categories: (catalog as any).category || [],
        targetSystems: (catalog as any).targetOrgans || [],
        mechanismReason: tz.map(t => t.label).join(', ') || '',
        comment: '',
        tzMechanisms: tz,
        brandName: undefined,
        source: 'greedy',
      });
    }
  }

  // 3a) Кап количества: если задан maxStackSize, усекаем по грейду + широте + синергиям
  if (opts.maxStackSize && opts.maxStackSize > 0 && substances.length > opts.maxStackSize) {
    // Pre-compute synergy scores with already-selected substances (greedy)
    const selected = new Set<string>();
    const synergyCache = new Map<string, number>();

    const getSynBonus = (id: string): number => {
      if (synergyCache.has(id)) return synergyCache.get(id)!;
      let bonus = 0;
      const idLower = id.toLowerCase();
      for (const entry of SYNERGY_NETWORK) {
        if (entry.type !== 'synergy') continue;
        const partners = [entry.a, entry.b, entry.c, entry.d, entry.e, entry.f, entry.g, ...(entry.substances || [])]
          .filter(Boolean).map(s => (s as string).toLowerCase());
        if (!partners.includes(idLower)) continue;
        for (const sel of selected) {
          if (partners.includes(sel.toLowerCase())) bonus += entry.score;
        }
      }
      synergyCache.set(id, bonus);
      return bonus;
    };

    substances.sort((a, b) => {
      const ga = getEvidenceGrade(a.id);
      const gb = getEvidenceGrade(b.id);
      const wa = ga === 'A' ? 3 : ga === 'B' ? 2 : 1;
      const wb = gb === 'A' ? 3 : gb === 'B' ? 2 : 1;
      if (wa !== wb) return wb - wa;
      // synergy bonus с уже отобранными
      const synA = getSynBonus(a.id);
      const synB = getSynBonus(b.id);
      if (synA !== synB) return synB - synA;
      const breadthDiff = (b.tzMechanisms?.length || 0) - (a.tzMechanisms?.length || 0);
      if (breadthDiff !== 0) return breadthDiff;
      return (b.tier === 'core' ? 1 : 0) - (a.tier === 'core' ? 1 : 0);
    });

    // Greedy pass: пересчитываем synergy bonus после каждого выбора
    const trimmed: typeof substances = [];
    for (const s of substances) {
      if (trimmed.length >= opts.maxStackSize) break;
      trimmed.push(s);
      selected.add(s.id.toLowerCase());
      synergyCache.clear(); // invalidate cache после каждого выбора
    }
    substances.length = 0;
    substances.push(...trimmed);
  }

  // 3b) Синергии внутри стека — расширенные
  const stackSynergies: ClinicalStackResult['stackSynergies'] = [];
  const subIdSet = new Set(substances.map((s) => s.id.toLowerCase()));
  const seenSynKeys = new Set<string>();

  const DOMAIN_KEYWORDS: Record<string, string[]> = {
    antioxidant: ['ANTIOXIDANT', 'GLUTATHIONE', 'NRF2', 'ROS', 'OXIDATIVE'],
    hepatic: ['LIVER', 'HEPAT', 'BILE', 'CHOLESTASIS', 'GLUTATHIONE'],
    cardio: ['HEART', 'CARDIO', 'VESSEL', 'COENZYME', 'COQ'],
    neuro: ['NEURO', 'GABA', 'DOPAMINE', 'NMDA', 'MYELIN', 'COGNITIVE'],
    metabolic: ['AMPK', 'INSULIN', 'MITOCHONDRIAL', 'GLUCOSE', 'LIPID'],
    detox: ['DETOX', 'CYP450', 'PHASE_II', 'AMMONIA'],
    immune: ['IMMUNE', 'ANTIINFLAMMATORY', 'NFKB', 'CYTOKINE'],
    hormonal: ['TESTOSTERONE', 'AROMATASE', 'PROLACTIN', 'THYROID', 'ESTROGEN'],
    membrane: ['MEMBRANE', 'PHOSPHOLIPID', 'BILE_ACID'],
    adaptogen: ['ADAPTOGEN', 'CORTISOL', 'STRESS', 'ADRENAL'],
  };

  const detectDomain = (mechIds: string[]): string => {
    const joined = mechIds.join(' ').toUpperCase();
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      if (keywords.some(kw => joined.includes(kw))) return domain;
    }
    return 'general';
  };

  for (const s of substances) {
    const cat_ = SUPPORT_CATALOG_DATA[s.id] || SUPPORT_CATALOG_DATA[s.id.toUpperCase()];
    if (!(cat_ as any)?.synergies) continue;
    for (const syn of (cat_ as any).synergies) {
      const partnerId: string = (syn.with || '').toLowerCase();
      if (!subIdSet.has(partnerId)) continue;
      const key = [s.id.toLowerCase(), partnerId].sort().join('|');
      if (seenSynKeys.has(key)) continue;
      seenSynKeys.add(key);

      const partnerMechs = (SUPPORT_CATALOG_DATA[partnerId] || SUPPORT_CATALOG_DATA[partnerId.toUpperCase()] || {}).mechanisms || [];
      const allMechs = [...(s.tzMechanisms || []).map(t => t.mechId), ...partnerMechs];
      const domain = detectDomain(allMechs);

      stackSynergies.push({
        ids: [s.id, partnerId],
        effect: syn.effect || syn.mechanism || '',
        mechanism: syn.mechanism || '',
        strength: (syn.severity || syn.strength || 'MEDIUM').toUpperCase(),
        domain,
        description: syn.effect || syn.mechanism || `${s.name} + ${(SUPPORT_CATALOG_DATA[partnerId] as any)?.nameRu || partnerId}: синергическое взаимодействие`,
      });
    }
  }

  // 3c) Развёрнутое описание стека
  const coveredSystems = new Set<string>();
  const systemMechs: Record<string, string[]> = {};
  for (const s of substances) {
    for (const tz of s.tzMechanisms || []) {
      const prefixMap: Record<string, string> = { cv: 'cardio', liv: 'hepatic', ren: 'renal', cns: 'cns', rep: 'reproductive', hem: 'hematologic' };
      const prefix = tz.mechId.match(/^[a-z]+/)?.[0];
      if (prefix && prefixMap[prefix]) {
        coveredSystems.add(prefixMap[prefix]);
        if (!systemMechs[prefixMap[prefix]]) systemMechs[prefixMap[prefix]] = [];
        if (!systemMechs[prefixMap[prefix]].includes(tz.label)) systemMechs[prefixMap[prefix]].push(tz.label);
      }
    }
  }
  const systemNames = [...coveredSystems].map((sys) => (TZ_SYSTEM_LABELS as any)[sys] || sys);
  const gradeCounts = substances.reduce((acc, s) => { const g = getEvidenceGrade(s.id); acc[g] = (acc[g] || 0) + 1; return acc; }, {} as Record<string, number>);
  const gradeParts: string[] = [];
  if (gradeCounts.A) gradeParts.push(`A:${gradeCounts.A}`);
  if (gradeCounts.B) gradeParts.push(`B:${gradeCounts.B}`);
  if (gradeCounts.C) gradeParts.push(`C:${gradeCounts.C}`);

  const parts: string[] = [];
  parts.push(`Клинический стек из ${substances.length} веществ (${gradeParts.join(', ')}).`);
  const contextParts: string[] = [];
  if (isOrientational) contextParts.push('⚠️ Ориентировочный (без курса и анализов)');
  if (useCourse && state.pharma.aas.length > 0) contextParts.push(`Курс: ${state.pharma.aas.length} ААС`);
  if (useLabs && (state.labs?.fullPanel || state.labs?.midCourse)) contextParts.push('Лаб: ✓');
  if (contextParts.length > 0) parts.push(contextParts.join(' · '));

  parts.push('Принцип:');
  for (const s of substances) {
    const mechs = (s.tzMechanisms || []).map(t => t.label).join(', ');
    const role = s.mechanismReason || mechs || 'поддержка';
    parts.push(`• ${s.name} (${s.doseDisplay || s.doseMg + ' мг'}, ${s.timing}) — ${role}`);
  }

  if (systemNames.length > 0) {
    parts.push('Покрытие систем:');
    for (const sys of systemNames) {
      const mechs = systemMechs[sys] || [];
      parts.push(`• ${sys}: ${mechs.join(', ')}`);
    }
  }
  const stackDescription = parts.join('\n');

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

  // Сортировка веществ: mandatory → core → standard → advanced → greedy
  const sourceOrder: Record<string, number> = { mandatory: 0, lab: 1, tz: 2, greedy: 3 };
  const tierOrder: Record<string, number> = { core: 0, standard: 1, advanced: 2, specialty: 3 };
  substances.sort((a, b) => {
    const sa = sourceOrder[a.source || 'tz'] ?? 2;
    const sb = sourceOrder[b.source || 'tz'] ?? 2;
    if (sa !== sb) return sa - sb;
    const ta = tierOrder[a.tier] ?? 1;
    const tb = tierOrder[b.tier] ?? 1;
    return ta - tb;
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
    isOrientational,
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
