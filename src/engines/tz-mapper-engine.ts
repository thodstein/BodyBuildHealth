// ════════════════════════════════════════════════════════════════════════════
//  TZ-MAPPER-ENGINE — главный движок: лабы + фаза → план поддержки
//
//  Реализует 3 пресета + ручной режим:
//    resolveBasePlan(ctx)      — минимальный набор (6-12 веществ)
//    resolveMediumPlan(ctx)    — умеренное расширение (12-20)
//    resolveMaxPlan(ctx)       — максимальный стек (18-32)
//    resolveManualPlan(...)    — ручной режим (только guardrails)
//
//  Возвращает SupportRecommendation:
//    subs[]         — финальный список веществ смеханизмами
//    suppression[]  — подавленные/исключённые
//    coverage       — матрица покрытия { organId: { mechId: k } }
//    gaps           — непокрытые ТЗ-механизмы
//    conflicts      — попарные конфликты
//    guardrails     — сработавшие ограничения
//    phase          — определённая фаза
//    boosters       — активированные бустеры (если есть)
//    summary        — текстовое описание для UI
//
//  Архитектура:
//    1. Активировать механизмы по лабам (tz-bridge-marker)
//    2. Учесть фазу (mandatory/suppressed categories)
//    3. Отбор веществ для каждого механизма по k×breadth
//    4. Капы по категориям (CATEGORY_LIMITS)
//    5. Кап по total (TOTAL_LIMIT)
//    6. Guardrails (screen всех выбранных)
//    7. Покрытие матрицы + gaps
//    8. Бустеры поверх (если фаза разрешает)
// ════════════════════════════════════════════════════════════════════════════

import type { TzMechId, TzOrganId, ActivatedMech, LabValues, Severity } from './tz-bridge-marker';
import { getActivatedTzMechs, ALL_TZ_MECH_IDS, ALL_TZ_ORGANS } from './tz-bridge-marker';
import {
  TZ_MECH_TO_SUBS,
  CATEGORY_LIMITS,
  TOTAL_LIMIT,
  type TzMechSubstance,
  type TzCategory,
  type SupportLevel,
  type GuardrailContext,
  type GuardrailResult,
  type ConflictPair,
  screenGuardrails,
  screenPairConflicts,
  getSubsForMech,
  topBreadthSubs,
} from './tz-bridge-mechanism';
import {
  PHASE_PROTOCOL,
  detectPhase,
  getPhaseProtocol,
  getMandatoryCategories,
  isCategoryAllowed,
  getPhaseCoreMechs,
  areBoostersAllowed,
  type PhaseKey,
  type PhaseContext,
  type PhaseProtocol as PhaseProto,
} from './tz-bridge-phase';
import {
  applyBoosters,
  getBoosterSubs,
  getBoosterMechs,
  type BoosterTriggerCtx,
  type AppliedBooster,
} from './tz-bridge-boosters';
import { TZ_MECH_LABELS, TZ_SYSTEM_LABELS } from '../data/support-db';
import { canonId, sameClassIds } from './support-plan/shared-constants';
import { getPrioritySubstances, deriveSeverity, type SeverityLevel } from '../data/lab-priority-map';
import { computeTierAdjustments, type TierAdjustmentResult, type TierAddSub, type TierAlert, type TierTitration, type TierNutritionTip } from '../data/lab-tier-recommendations';
import { computeSynergy } from '../data/lab-synergy-engine';
import { checkContraindications, type ContraAlert } from '../data/substance-contraindications';

// ════════════════════════════════════════════════════════════════════════════
//  ТИПЫ РЕКОМЕНДАЦИИ
// ════════════════════════════════════════════════════════════════════════════
export interface RecommendedSub {
  substanceId: string;
  category: TzCategory;
  k: number;
  q: 'A' | 'B' | 'C';
  reason: string;                // почему выбрано
  mechsCovered: TzMechId[];     // какие мехи закрывает
  triggeredByMech?: TzMechId;   // основной механизм (для отладки)
  priority?: 1 | 2 | 3 | 4;    // приоритет выбора
}

export interface SuppressedSub {
  substanceId: string;
  reason: string;
  category: TzCategory;
}

export interface OrganMechCoverage {
  mechId: TzMechId;
  covered: boolean;
  bestK: number;
  bestSub: string;
}

export interface OrganCoverage {
  organId: TzOrganId;
  organLabel: string;
  mechs: OrganMechCoverage[];
  totalCovered: number;
  totalMechs: number;
  coveragePercent: number;
}

export interface PhaseAssignedDrug {
  substanceId: string;
  reason: string;
  trigger: string;
  category: TzCategory;
}

export interface SupportRecommendation {
  level: SupportLevel;
  phase: PhaseKey;
  phaseLabel: string;
  subs: RecommendedSub[];
  suppression: SuppressedSub[];
  coverage: OrganCoverage[];
  gaps: { organId: TzOrganId; organLabel: string; mechId: TzMechId; mechLabel: string; suggestions: string[] }[];
  conflicts: ConflictPair[];
  guardrails: GuardrailResult[];
  boosters: AppliedBooster[];
  activatedMechs: ActivatedMech[];
  summary: string;
  rationale: string;
  phaseAssignedDrugs?: PhaseAssignedDrug[];
  // TIER-system
  tierAdjustments?: TierAdjustmentResult;
  alerts?: TierAlert[];
  stopCourse?: boolean;
  titrationFactors?: Map<string, number>;
  nutritionTips?: TierNutritionTip[];
  pedFlags?: PEDFlags;  // v5: warnings for UI (multi-oral, GH+ins, winny+oxy)
  contraindications?: import('../data/substance-contraindications').ContraAlert[];
}

// ════════════════════════════════════════════════════════════════════════════
//  ВХОДНОЙ КОНТЕКСТ ДЛЯ ДВИЖКА
// ════════════════════════════════════════════════════════════════════════════
export interface MapperCtx {
  labs: LabValues;                 // маркёры → значения
  phaseCtx: PhaseContext;         // контекст фазы
  boosterCtx?: BoosterTriggerCtx; // триггеры бустеров
  level: SupportLevel;             // base | medium | max | manual
  manualChoices?: {                 // ручной выбор веществ (для manual)
    addSubs?: string[];
    removeSubs?: string[];
    explicitCategories?: TzCategory[];
  };
  // clinical context for guardrails
  onCourse?: boolean;
  e2Level?: number;
  e2Sensitivity?: number;
  hemoglobin?: number;
  hematocrit?: number;
  hasHCG?: boolean;
  hasAI?: boolean;
  hasCabergoline?: boolean;
  libidoLow?: boolean;
  bpSystolic?: number;
  lipidLdl?: number;
  aasIds?: string[];   // legacy — список ID ААС (для обратной совместимости)
  pedDoses?: PEDDose[]; // v5 — PED с дозами + классами
  healthConditions?: string[];  // заболевания пользователя для проверки противопоказаний
}

// Импорт PED-типов и helpers
import type { PEDDose, PEDFlags } from '../data/ped-potency-table';
import { computeIntensityFactor, derivePEDFlags, doseByIntensity, classifyPed, type PEDClass } from '../data/ped-potency-table';

// ════════════════════════════════════════════════════════════════════════════
//  ВСПОМОГАТЕЛЬНЫЕ
// ════════════════════════════════════════════════════════════════════════════
function mechOrganLabel(mechId: TzMechId): { organId: TzOrganId; organLabel: string; mechLabel: string } {
  const organId = (mechId.startsWith('cv') ? 'cardio' :
                  mechId.startsWith('liv') ? 'hepatic' :
                  mechId.startsWith('ren') ? 'renal' :
                  mechId.startsWith('cns') ? 'cns' :
                  mechId.startsWith('rep') ? 'reproductive' : 'hematologic') as TzOrganId;
  return {
    organId,
    organLabel: TZ_SYSTEM_LABELS[organId] || organId,
    mechLabel: TZ_MECH_LABELS[mechId] || mechId,
  };
}

function buildGuardrailCtx(ctx: MapperCtx): GuardrailContext {
  const phase = detectPhase(ctx.phaseCtx);
  return {
    onCourse: ctx.onCourse ?? (phase === 'course' || phase === 'bridge' || phase === 'trt'),
    inPCT: phase === 'pct',
    e2Level: ctx.e2Level,
    e2Sensitivity: ctx.e2Sensitivity,
    hemoglobin: ctx.hemoglobin,
    hematocrit: ctx.hematocrit,
    hasHCG: ctx.hasHCG,
    hasAI: ctx.hasAI,
    hasTBooster: false, // будет определено после отбора
    bpSystolic: ctx.bpSystolic,
    libidoLow: ctx.libidoLow,
    lipidLdl: ctx.lipidLdl,
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  ОСНОВНОЙ АЛГОРИТМ — ОТБОР ВЕЩЕСТВ
// ════════════════════════════════════════════════════════════════════════════
function selectSubstances(
  activated: ActivatedMech[],
  phase: PhaseKey,
  level: SupportLevel,
  manualChoices?: { addSubs?: string[]; removeSubs?: string[]; explicitCategories?: TzCategory[] },
  initialSubs?: string[]  // протокол subs — блокируют дубли заранее
): { subs: RecommendedSub[]; suppression: SuppressedSub[] } {
  const phaseProto = getPhaseProtocol(phase);
  const limits = CATEGORY_LIMITS[level];
  const totalLimit = TOTAL_LIMIT[level];

  const protocolSet = new Set((initialSubs || []).map(s => s.toLowerCase()));
  const shouldBlock = (id: string): boolean => {
    const key = id.toLowerCase();
    if (JOINT_BLOCK_AUTO.has(key)) return true;
    if ((phase === 'course' || phase === 'bridge') && REPRO_COURSE_BLOCK_AUTO.has(key)) return true;
    if (RAAS_ALL.has(key) && (protocolSet.has(key) || subs.some(s => RAAS_ALL.has(s.substanceId.toLowerCase())))) return true;
    if (STATIN_ALL.has(key) && (STATIN_ALL.has(key) && (protocolSet.has(key) || subs.some(s => STATIN_ALL.has(s.substanceId.toLowerCase()))))) return true;
    if (protocolSet.has(key)) return true;
    const cls = sameClassIds(id);
    if (cls.length && cls.some(alt => protocolSet.has(alt.toLowerCase()))) return true;
    return false;
  };

  const usedSubs = new Set<string>();
  const usedCanon = new Set<string>();
  // Протокол уже "used" — не добавлять дубли
  for (const id of (initialSubs || [])) {
    usedSubs.add(id.toLowerCase());
    usedCanon.add(canonId(id));
  }
  const subs: RecommendedSub[] = [];
  const suppression: SuppressedSub[] = [];
  const categoryCount = new Map<TzCategory, number>();
  for (const cat of Object.keys(limits) as TzCategory[]) categoryCount.set(cat, 0);

  // Дедупликация: canonId + sameClassIds
  const isAlreadyUsed = (id: string): boolean => {
    const c = canonId(id);
    if (usedSubs.has(id.toLowerCase()) || usedCanon.has(c)) return true;
    const cls = sameClassIds(id);
    for (const alt of cls) {
      if (usedSubs.has(alt.toLowerCase()) || usedCanon.has(canonId(alt))) return true;
    }
    return false;
  };
  const markUsed = (id: string) => {
    usedSubs.add(id.toLowerCase());
    usedCanon.add(canonId(id));
    for (const alt of sameClassIds(id)) {
      usedSubs.add(alt.toLowerCase());
      usedCanon.add(canonId(alt));
    }
  };

  // ───────────────────────────────────────────────────────────────────
  // 0. Ручной режим — добавки из explicit list
  // ───────────────────────────────────────────────────────────────────
  if (level === 'manual' && manualChoices?.addSubs) {
    for (const sid of manualChoices.addSubs) {
      if (isAlreadyUsed(sid)) continue;
      // найти любое вхождение в TZ_MECH_TO_SUBS
      const mechsCovered: TzMechId[] = [];
      let bestK = 0;
      let bestQ: 'A'|'B'|'C' = 'C';
      let bestCat: TzCategory = 'other';
      let triggeredBy: TzMechId | undefined = undefined;
      for (const mechId of ALL_TZ_MECH_IDS) {
        const found = TZ_MECH_TO_SUBS[mechId].substances.find(s => s.substanceId.toLowerCase() === sid.toLowerCase());
        if (found) {
          mechsCovered.push(mechId);
          if (found.k > bestK) {
            bestK = found.k;
            bestQ = found.q;
            bestCat = found.category;
            triggeredBy = mechId;
          }
        }
      }
      subs.push({
        substanceId: sid,
        category: bestCat,
        k: bestK,
        q: bestQ,
        reason: 'Ручное добавление пользователем',
        mechsCovered,
        triggeredByMech: triggeredBy,
      });
      markUsed(sid);
    }
    // ───────────────────────────────────────────────────────────────────
    //  Ручной режим — БЕЗ авто-отбора
    // ───────────────────────────────────────────────────────────────────
    return { subs, suppression };
  }

  // ───────────────────────────────────────────────────────────────────
  // 1. Обязательные категории фазы (mandatory)
  // ───────────────────────────────────────────────────────────────────
  for (const cat of phaseProto.mandatory) {
    // топ-N субстанций из этой категории по breadth
    const cands = topSubsByCategory(cat, 6);
    for (const cand of cands) {
      if (categoryCount.get(cat)! >= limits[cat]) break;
      if (subs.length >= totalLimit) break;
      if (shouldBlock(cand.substanceId)) continue;
      if (isAlreadyUsed(cand.substanceId)) continue;
      const cov = getMechs(cand.substanceId, activated);
      subs.push({
        substanceId: cand.substanceId,
        category: cat,
        k: cand.k,
        q: cand.q,
        reason: `Обязательная категория "${cat}" фазы "${phaseProto.label}"`,
        mechsCovered: cov,
      });
      markUsed(cand.substanceId);
      categoryCount.set(cat, categoryCount.get(cat)! + 1);
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // 2. Покрытие активированных механизмов по Labs
  // ───────────────────────────────────────────────────────────────────
  // Сортируем мехи по severity (severe > moderate > mild)
  const sevRank: Record<Severity, number> = { normal: 0, mild: 1, moderate: 2, severe: 3 };
  const sortedActivated = activated.slice().sort((a, b) => sevRank[b.severity] - sevRank[a.severity]);

  for (const act of sortedActivated) {
    // Топ-N веществ для этого мех-ма, не подавлено фазой
    const candidates = getSubsForMech(act.mechId, 8).filter(s => isCategoryAllowed(phase, s.category));
    for (const cand of candidates) {
      if (subs.length >= totalLimit) break;
      const cat = cand.category;
      if (categoryCount.get(cat)! >= limits[cat]) continue;
      if (shouldBlock(cand.substanceId)) continue;
      if (isAlreadyUsed(cand.substanceId)) continue;

      // Собираем все покрываемые мехи для этой субстанции
      const mechsCovered = getMechs(cand.substanceId, activated);

      subs.push({
        substanceId: cand.substanceId,
        category: cat,
        k: cand.k,
        q: cand.q,
        reason: `Механизм ${act.mechId}: ${act.markers.map(m => m.marker).join(', ')} (${act.severity})`,
        mechsCovered,
        triggeredByMech: act.mechId,
      });
      markUsed(cand.substanceId);
      categoryCount.set(cat, categoryCount.get(cat)! + 1);

      // Если мех-м покрыт ≥0.5 кумулятивно — break
      if (cand.k >= 0.3) break;
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // 3.拓宽ение через broad-spectrum (для medium/max)
  // ───────────────────────────────────────────────────────────────────
  if (level === 'medium' || level === 'max') {
    const top = topBreadthSubs(15);
    for (const cand of top) {
      if (subs.length >= totalLimit) break;
      const cat = classifyBySubstanceId(cand.substanceId);
      if (!isCategoryAllowed(phase, cat)) continue;
      if (categoryCount.get(cat)! >= limits[cat]) continue;
      if (shouldBlock(cand.substanceId)) continue;
      if (isAlreadyUsed(cand.substanceId)) continue;

      const mechsCovered = getMechs(cand.substanceId, activated);
      subs.push({
        substanceId: cand.substanceId,
        category: cat,
        k: 0,
        q: 'C',
        reason: `Расширение broad-spectrum (покрывает ${cand.breadth} мехов)`,
        mechsCovered,
      });
      markUsed(cand.substanceId);
      categoryCount.set(cat, categoryCount.get(cat)! + 1);
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // 4. Фаза coreMechs — приоритет (если не покрыты)
  // ───────────────────────────────────────────────────────────────────
  for (const mechId of phaseProto.coreMechs) {
    if (subs.length >= totalLimit) break;
    // проверить, покрыт ли мех现状
    const alreadyCovered = subs.some(s => s.mechsCovered.includes(mechId) && s.k > 0);
    if (alreadyCovered) continue;

    const cands = getSubsForMech(mechId, 5).filter(s => isCategoryAllowed(phase, s.category));
    for (const cand of cands) {
      if (subs.length >= totalLimit) break;
      const cat = cand.category;
      if (categoryCount.get(cat)! >= limits[cat]) continue;
      if (shouldBlock(cand.substanceId)) continue;
      if (isAlreadyUsed(cand.substanceId)) continue;
      subs.push({
        substanceId: cand.substanceId,
        category: cat,
        k: cand.k,
        q: cand.q,
        reason: `Приоритет фазы: ${mechId}`,
        mechsCovered: [mechId, ...getMechs(cand.substanceId, activated)],
        triggeredByMech: mechId,
      });
      markUsed(cand.substanceId);
      categoryCount.set(cat, categoryCount.get(cat)! + 1);
      break;
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // 5. Suppression — что не включено из-за фазы
  // ───────────────────────────────────────────────────────────────────
  for (const cat of phaseProto.suppressed) {
    // топ-N потенциальных субстанций из этой категории
    const cands = topSubsByCategory(cat, 3);
    for (const cand of cands) {
      if (shouldBlock(cand.substanceId)) continue;
      if (isAlreadyUsed(cand.substanceId)) continue;
      suppression.push({
        substanceId: cand.substanceId,
        category: cat,
        reason: `Подавлено фазой "${phaseProto.label}" — категория не нужна`,
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // 6. Ручной режим — исключения
  // ───────────────────────────────────────────────────────────────────
  if (manualChoices?.removeSubs) {
    const removeSet = new Set(manualChoices.removeSubs.map(s => s.toLowerCase()));
    const removed = subs.filter(s => removeSet.has(s.substanceId.toLowerCase()));
    for (const r of removed) {
      suppression.push({
        substanceId: r.substanceId,
        category: r.category,
        reason: 'Исключено пользователем (manual remove)',
      });
    }
    // удалить из subs
    return { subs: subs.filter(s => !removeSet.has(s.substanceId.toLowerCase())), suppression };
  }

  return { subs, suppression };
}

// Топ-N субстанций из конкретной категории по breadth
function topSubsByCategory(cat: TzCategory, n: number): { substanceId: string; k: number; q: 'A'|'B'|'C' }[] {
  const acc = new Map<string, { k: number; q: 'A'|'B'|'C'; breadth: number }>();
  for (const mechId of ALL_TZ_MECH_IDS) {
    for (const s of TZ_MECH_TO_SUBS[mechId].substances) {
      if (s.category !== cat) continue;
      const cur = acc.get(s.substanceId) || { k: 0, q: 'C' as const, breadth: 0 };
      cur.breadth += 1;
      if (s.k > cur.k) { cur.k = s.k; cur.q = s.q; }
      acc.set(s.substanceId, cur);
    }
  }
  return Array.from(acc.entries())
    .map(([substanceId, v]) => ({ substanceId, k: v.k, q: v.q }))
    .sort((a, b) => b.k - a.k)
    .slice(0, n);
}

function classifyBySubstanceId(sid: string): TzCategory {
  const s = sid.toLowerCase();
  const pharmaKeys = [
    'atorvastatin','rosuvastatin','simvastatin','pravastatin','lisinopril',
    'telmisartan','telmi','losartan','valsartan','nebivolol','carvedilol',
    'aspirin','anastrozole','tamoxifen','clomiphene','enclomiphene',
    'cabergoline','finasteride','metformin','hcg',
  ];
  if (pharmaKeys.some(p => s === p || s.startsWith(p))) return 'pharma';
  if (/vitamin_/.test(s)) return 'vitamin';
  if (/magnesium|zinc|selenium|boron|copper|iron|chromium/.test(s)) return 'mineral';
  if (/ashwagandha|rhodiola|ginseng|cordyceps|astragalus/.test(s)) return 'adaptogen';
  if (/nac|glutathione|alpha_lipoic|coq10|curcumin|egcg/.test(s)) return 'antioxidant';
  if (/boswellia|bromelain|nattokinase|msm|serrapeptase/.test(s)) return 'antiinflam';
  return 'other';
}

// Получить ТЗ-мехи, покрываемые субстанцией (полный список)
function getMechs(substanceId: string, activated: ActivatedMech[]): TzMechId[] {
  const result: TzMechId[] = [];
  for (const mechId of ALL_TZ_MECH_IDS) {
    if (TZ_MECH_TO_SUBS[mechId].substances.some(s => s.substanceId.toLowerCase() === substanceId.toLowerCase())) {
      result.push(mechId);
    }
  }
  return result;
}

// ════════════════════════════════════════════════════════════════════════════
//  ПОКРЫТИЕ МАТРИЦЫ (28 мех × 6 органов)
// ════════════════════════════════════════════════════════════════════════════
function buildCoverageMatrix(
  subs: RecommendedSub[]
): { coverage: OrganCoverage[]; gaps: { organId: TzOrganId; organLabel: string; mechId: TzMechId; mechLabel: string; suggestions: string[] }[] } {
  const organCoverage: OrganCoverage[] = [];
  const gaps: { organId: TzOrganId; organLabel: string; mechId: TzMechId; mechLabel: string; suggestions: string[] }[] = [];

  for (const organId of ALL_TZ_ORGANS) {
    const mechs: OrganMechCoverage[] = [];
    let coveredN = 0;
    let totalN = 0;
    for (const mechId of ALL_TZ_MECH_IDS) {
      const { organId: o } = mechOrganLabel(mechId);
      if (o !== organId) continue;
      totalN++;
      // найти лучшую субстанцию для этого мех-ма из списка subs
      let bestK = 0; let bestSub = ''; let covered = false;
      for (const rs of subs) {
        if (!rs.mechsCovered.includes(mechId)) continue;
        // Найти k этого вещества для этого мех из TZ_MECH_TO_SUBS
        const found = TZ_MECH_TO_SUBS[mechId].substances.find(s => s.substanceId.toLowerCase() === rs.substanceId.toLowerCase());
        if (found && found.k > bestK) {
          bestK = found.k; bestSub = rs.substanceId; covered = true;
        }
      }
      mechs.push({ mechId, covered, bestK, bestSub });
      if (covered) coveredN++;

      if (!covered) {
        // suggestions — топ-3 для этого мех-ма
        const sug = getSubsForMech(mechId, 3).map(s => s.substanceId);
        const { organLabel, mechLabel } = mechOrganLabel(mechId);
        gaps.push({ organId, organLabel, mechId, mechLabel, suggestions: sug });
      }
    }
    const percent = totalN ? Math.round((coveredN / totalN) * 100) : 0;
    organCoverage.push({
      organId,
      organLabel: TZ_SYSTEM_LABELS[organId] || organId,
      mechs,
      totalCovered: coveredN, totalMechs: totalN, coveragePercent: percent,
    });
  }
  return { coverage: organCoverage, gaps };
}

// ════════════════════════════════════════════════════════════════════════════
//  ОСНОВНЫЕ API: 3 пресета + ручной режим
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
//  ФАЗОВЫЕ НАЗНАЧЕНИЯ — логика auto-assign (hCG, AI, cabergoline, hepatic/renal)
//  Зеркалит engine.ts:62-168 (calculateSupportTZ), но для tz-mapper-engine.
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
//  АВТО-НАЗНАЧЕНИЕ: чёрные списки
// ════════════════════════════════════════════════════════════════════════════
const JOINT_BLOCK_AUTO = new Set([
  'boswellia', 'chondroitin', 'chondroitin_sulfate', 'collagen',
  'collagen_uc2', 'glucosamine', 'hyaluronic', 'hyaluronic_acid', 'msm',
  'gonadorelin', 'kisspeptin',
]);
const REPRO_COURSE_BLOCK_AUTO = new Set([
  'ashwagandha', 'boron', 'clomi', 'clomiphene', 'enclomiphene',
  'dhea', 'fadogia', 'letrozole', 'maca', 'tamoxifen', 'tamox',
  'tongkat_ali', 'tribulus', 'turkesterone', 'forskolin',
  'pharma_clomiphene', 'pharma_enclomiphene', 'pharma_letrozole',
  'fenugreek', 'dim', 'indinol', 'i3c', 'indole_3_carbinol',
]);
const RAAS_ALL = new Set([
  'telmisartan', 'losartan', 'valsartan', 'irbesartan', 'olmesartan', 'candesartan',
  'lisinopril', 'enalapril', 'ramipril', 'perindopril', 'captopril',
]);
const STATIN_ALL = new Set([
  'atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'pitavastatin',
  'red_yeast', 'red_yeast_rice', 'bergamot',
]);

// ════════════════════════════════════════════════════════════════════════════
//  ПРОТОКОЛ v4 — специалист-фармацевт
//  Уровни: 1=база(всегда) 2=тест-соло 3=тандем(трен/нандрон/болденон) 4=орал
// ════════════════════════════════════════════════════════════════════════════
function computeProtocol(ctx: MapperCtx): PhaseAssignedDrug[] {
  const phase = detectPhase(ctx.phaseCtx);
  // v5: pedDoses (если задан) → peds. Иначе legacy aasIds → имитируем PEDDose без дозы.
  let peds: PEDDose[] = ctx.pedDoses || [];
  if (peds.length === 0 && ctx.aasIds && ctx.aasIds.length > 0) {
    peds = ctx.aasIds.map(id => ({ id, pClass: classifyPed(id) }));
  }
  const flags = derivePEDFlags(peds);
  if (peds.length === 0 && phase !== 'pct') return [];

  const intensity = computeIntensityFactor(peds);
  const result: PhaseAssignedDrug[] = [];
  const seen = new Set<string>();
  const add = (id: string, reason: string, trigger: string, category: TzCategory) => {
    const key = id.toLowerCase();
    if (seen.has(key)) return;
    if (ctx.hasHCG && key === 'hcg') return;
    if (ctx.hasAI && (key === 'anastrozole' || key === 'tamoxifen' || key === 'letrozole')) return;
    seen.add(key);
    result.push({ substanceId: id, reason, trigger, category });
  };

  // ─── УРОВЕНЬ 1: БАЗА (при любом AAS) — dose-aware через intensity ───
  if (flags.hasAAS || flags.hasSarm) {
    const telDose = doseByIntensity(20, 80, intensity);
    const tudcaDose = doseByIntensity(500, 1000, intensity) * (flags.hasOral17 ? 2 : 1);
    const nacDose = doseByIntensity(1200, 1800, intensity) * (flags.hasOral17 ? 1.5 : 1);
    const omegaDose = doseByIntensity(2, 4, intensity);
    add('tadalafil', `Tadalafil 5 мг/день — PDE5i → вазодилатация + защита простаты`, 'PED в курсе', 'pharma');
    add('telmisartan', `Telmisartan ${telDose} мг — ARB + PPAR-γ (АД, инсулин-чувствительность)`, 'PED в курсе', 'pharma');
    add('agmatine', 'Agmatine 1 г 2р/день — eNOS → NO, инсулин-сенситайзер', 'PED в курсе', 'pharma');
    add('tudca', `TUDCA ${tudcaDose} мг — BSEP-зависимый желчеотток${flags.hasOral17 ? ' (×2 орал)' : ''}`, 'PED в курсе', 'hepatoprotector');
    add('nac', `NAC ${nacDose} мг — глутатион (фаза II детокс)${flags.hasOral17 ? ' (×1.5 орал)' : ''}`, 'PED в курсе', 'hepatoprotector');
    add('omega3', `Omega-3 ${omegaDose} г — ↓ ТГ, ↑ HDL, мембраны, эндотелий`, 'PED в курсе', 'cardioprotector');
    add('coq10', 'CoQ10 200 мг — митохондрии миокарда, кофактор', 'PED в курсе', 'antioxidant');
    add('tmg', 'TMG 1000 мг — донатор CH₃ → ↓ гомоцистеин (AAS ↑ Hcy)', 'PED в курсе', 'amino');
    add('taurine', 'Taurine 1000 мг — осмолит, кардиопротектор', 'PED в курсе', 'amino');
    add('hcg', 'hCG 500 МЕ 2р/нед — клетки Лейдига', 'AAS в курсе', 'hormonal');
  }

  // ─── ТЕСТОСТЕРОН-СПЕЦИФИКА (dose-aware anastrozole) ───
  if (flags.hasTest) {
    const testP = peds.find(p => p.pClass === 'aas_test');
    const testMg = testP?.mgPerWeek ?? 500;
    let aiDose = '0.5 мг 2р/нед';
    if (testMg <= 250) aiDose = 'не нужно (или 0.25 мг при E2↑)';
    else if (testMg <= 500) aiDose = '0.25-0.5 мг 2р/нед';
    else if (testMg <= 1000) aiDose = '0.5 мг 2р/нед';
    else aiDose = '1 мг/день (титровать)';
    add('anastrozole', `Anastrozole ${aiDose} — ⚠ ТОЛЬКО ПОД КОНТРОЛЕМ АНАЛИЗОВ (E2 20-40 pg/mL) [test ${testMg} мг/нед]`, `Тестостерон ${testMg} мг/нед`, 'pharma');
    add('pycnogenol', 'Pycnogenol 150 мг — eNOS + защита эндотелия', 'Тестостерон', 'antioxidant');
    add('citrulline', 'Citrulline 6 г — NO-предшественник', 'Тестостерон', 'amino');
    add('bergamot', 'Bergamot 500 мг — HMG-CoA редуктаза (липиды)', 'Тестостерон', 'cardioprotector');
    add('astaxanthin', 'Astaxanthin 4 мг — липофильный антиоксидант', 'Тестостерон', 'antioxidant');
  }

  // ─── НАНДРОЛОН — особый профиль (progestagen, объём, либидо↓) ───
  if (flags.hasNandrolone) {
    const np = peds.find(p => p.pClass === 'aas_nandrolone');
    const nMg = np?.mgPerWeek ?? 300;
    let caberDose = '0.25 мг 2р/нед';
    if (nMg <= 200) caberDose = 'только при пролактине >15';
    else if (nMg <= 400) caberDose = '0.25 мг 2р/нед';
    else caberDose = '0.5 мг 2р/нед';
    add('cabergoline', `Cabergoline ${caberDose} — ⚠ ТОЛЬКО ПОД КОНТРОЛЕМ АНАЛИЗОВ [nandrolone ${nMg} мг]`, `Нандролон ${nMg} мг/нед`, 'pharma');
    add('nebivolol', 'Nebivolol 2.5 мг — ⚠ Под контролем ЧСС и АД (β1+NO, объём+HR↓)', `Нандролон (объём + HR)`, 'pharma');
    add('hesperidin', 'Hesperidin 500 + Diosmin 450 — венотоник (объём, отёки)', 'Нандролон (отёки)', 'cardioprotector');
    add('dandelion', 'Dandelion 500 мг 2р/день — K⁺-сберегающий диуретик', 'Нандролон (задержка)', 'pharma');
    add('astragalus', 'Astragalus 500 мг — защита клубочков', 'Нандролон', 'nephroprotector');
    add('cordyceps', 'Cordyceps 1000 мг — ↓ BUN/креатинин', 'Нандролон', 'nephroprotector');
  }

  // ─── ТРЕНБОЛОН — aggressive profile (нeuro, липиды↓↓, почки) ───
  if (flags.hasTren) {
    const tp = peds.find(p => p.pClass === 'aas_tren');
    const tMg = tp?.mgPerWeek ?? 200;
    const trenIntens = (tMg / 500) * 3.0; // внешний scale 3.0
    const tudcaTren = Math.round(500 * (1 + trenIntens * 0.5));
    add('cabergoline', `Cabergoline ${tMg > 400 ? '0.5 мг' : '0.25 мг'} 2р/нед — ⚠ ПОД КОНТРОЛЕМ АНАЛИЗОВ (пролактин)`, `Тренболон ${tMg} мг`, 'pharma');
    add('nebivolol', 'Nebivolol 2.5-5 мг — ⚠ Под контролем ЧСС и АД', 'Тренболон', 'pharma');
    add('astragalus', `Astragalus ${Math.round(500 * (1 + trenIntens * 0.5))} мг — клубочки (трен-нефротокс)`, 'Тренболон', 'nephroprotector');
    add('cordyceps', `Cordyceps ${Math.round(1000 * (1 + trenIntens * 0.3))} мг — BUN/креатинин`, 'Тренболон', 'nephroprotector');
    add('alpha_lipoic', 'Alpha-lipoic 300 мг — Nrf2 (трен окислительный)', 'Тренболон', 'antioxidant');
    add('curcumin', 'Curcumin 500 мг — NF-κB (↓ CRP/IL-6)', 'Тренболон', 'antiinflam');
    add('berberine', 'Berberine 1500 мг — AMPK (инсулинорезистентность)', 'Тренболон', 'pharma');
    add('dandelion', 'Dandelion 500 мг 2р/день — отёки', 'Тренболон', 'pharma');
    add('hesperidin', 'Hesperidin 500 + Diosmin 450 — венотоник', 'Тренболон', 'cardioprotector');
    add('theanine', 'L-Theanine 200 мг — нейропротекция (трен-нейротокс) + сон', 'Тренболон (ЦНС)', 'amino');
    add('glycine', 'Glycine 3 г — сон, нейропротекция (mTOR)', 'Тренболон (ЦНС)', 'amino');
  }

  // ─── БОЛДЕНОН — HCT++ ───
  if (flags.hasBold) {
    add('serrapeptase', 'Serrapeptase 10 мг — ОБЯЗАТЕЛЬНО (HCT↑↑↑ на EQ)', 'Болденон (HCT)', 'pharma');
    add('nattokinase', 'Nattokinase 100 мг — фибринолиз (HCT↑↑↑)', 'Болденон (HCT)', 'pharma');
    add('bromelain', 'Bromelain 500 мг — ↓ PAI-1', 'Болденон (HCT)', 'antiinflam');
    add('nebivolol', 'Nebivolol 2.5 мг — ⚠ Под контролем ЧСС и АД', 'Болденон', 'pharma');
  }

  // ─── ДГТ-inject (Masteron, Primo) — анти-эстро, липиды↓↓ ───
  if (flags.hasDhtInject) {
    add('niacin', 'Niacin 500-1500 мг на ночь — ↑HDL (Masteron/Primo ↓HDL)', 'ДГТ-inject (липиды)', 'vitamin');
    add('bergamot', 'Bergamot 1000 мг — липиды (поверх базы)', 'ДГТ-inject (липиды)', 'cardioprotector');
  }

  // ─── ОРАЛЫ 17α: общее + спец ───
  if (flags.hasOral17) {
    add('milk_thistle', 'Milk thistle 280 мг — стабилизация мембран', 'Орал 17α', 'hepatoprotector');
  }

  // ─── WINSTROL special: липиды disaster + суставы ───
  if (peds.some(p => p.pClass === 'aas_oral_winny')) {
    add('niacin', 'Niacin 1500 мг на ночь — ⚠ Winny ↓HDL до 50% (lipid disaster)', 'Winstrol (липиды)', 'vitamin');
    add('garlic', 'Garlic 1200 мг — ↓LDL (Winny)', 'Winstrol (липиды)', 'cardioprotector');
    add('omega3', 'Omega-3 6 г — липиды (поверх) [переопределение базы]', 'Winstrol (липиды)', 'cardioprotector');
  }

  // ─── OXYMETHOLONE (Anadrol) special ───
  if (peds.some(p => p.pClass === 'aas_oral_oxy')) {
    add('tamoxifen', 'Tamoxifen 20 мг — ⚠ Anadrol НЕ ароматизируется, AI не работает. Гино → SERM', 'Anadrol (эстро-подобный)', 'pharma');
    add('spironolactone', 'Spironolactone 25-50 мг — ⚠ через врача (отёки, ↑Aldo на Anadrol)', 'Anadrol (отеки)', 'pharma');
    add('hesperidin', 'Hesperidin 500 + Diosmin 450 — венотоник', 'Anadrol (отеки)', 'cardioprotector');
  }

  // ─── GH (somatropin) — ИНДУСИРОРЕЗИСТЕНТНОСТЬ + BP ───
  if (flags.hasGH) {
    const ghP = peds.find(p => p.pClass === 'gh');
    const ghIU = ghP?.iuPerDay ?? 4;
    let berberineDose = '1000 мг';
    if (ghIU > 6) berberineDose = '2000 мг';
    add('berberine', `Berberine ${berberineDose} — AMPK (GH↑ IR)`, `GH ${ghIU} МЕ/день`, 'pharma');
    add('alpha_lipoic', 'Alpha-lipoic 300 мг — инсулин-чувствительность (GH)', 'GH', 'antioxidant');
    add('taurine', `Taurine ${ghIU > 4 ? '2000' : '1000'} мг — осмолит (GH ↑ вода)`, 'GH', 'amino');
    add('hesperidin', 'Hesperidin 500 + Diosmin 450 — венотоник (GH BP↑)', 'GH', 'cardioprotector');
    add('astaxanthin', 'Astaxanthin 4 мг — антиоксидант (GH)', 'GH', 'antioxidant');
    if (ghIU > 6) {
      add('metformin', 'Metformin 500 мг — ⚠ через врача (GH >6 МЕ IR↑↑)', 'GH >6 МЕ', 'pharma');
    }
  }

  // ─── INSULIN — ⚠ HYPO RISK ───
  if (flags.hasInsulin) {
    const iP = peds.find(p => p.pClass === 'insulin');
    const iIU = iP?.iuPerDay ?? 10;
    add('berberine', 'Berberine ' + (iIU > 15 ? '2000' : '1500') + ' мг — AMPK (insulin IR)', 'Insulin ' + iIU + ' МЕ/день', 'pharma');
    add('alpha_lipoic', 'Alpha-lipoic 300-600 мг — инсулин-чувствительность', 'Insulin', 'antioxidant');
    add('chromium', 'Chromium picolinate 200 мкг — ⚠ ТОЛЬКО с инсулином (кофактор рецептора)', 'Insulin', 'mineral');
    add('magnesium', 'Magnesium 600 мг — ↑ (insulin)', 'Insulin', 'mineral');
    if (iIU > 20) {
      add('metformin', 'Metformin 500 мг — ⚠ через врача (insulin >20 МЕ)', 'Insulin >20 МЕ', 'pharma');
    }
  }

  // ─── IGF-1 (LR3/DES) — гипогликемия + glycine ───
  if (flags.hasIGF) {
    add('berberine', 'Berberine 1500 мг — glucose (IGF hypo risk)', 'IGF-1', 'pharma');
    add('alpha_lipoic', 'Alpha-lipoic 300 мг — insulin sens', 'IGF-1', 'antioxidant');
    add('glycine', 'Glycine 3 г — mTOR support', 'IGF-1 (satellite cell)', 'amino');
    add('taurine', 'Taurine 2000 мг — osmolyte (cell volume)', 'IGF-1', 'amino');
  }

  // ─── MGF ───
  if (flags.hasMGF) {
    add('glycine', 'Glycine 3 г — satellite cell proliferation (mTOR)', 'MGF', 'amino');
    add('taurine', 'Taurine 2000 мг — cell volume', 'MGF', 'amino');
    add('b_complex', 'B-Complex — метилирование (satellite proliferation)', 'MGF', 'vitamin');
  }

  // ─── CLENBUTEROL — тратит таурин ───
  if (flags.hasClenbut) {
    add('taurine', 'Taurine 5000 мг — ⚠ Clen истощает таурин (судороги!)', 'Clenbuterol', 'amino');
    add('magnesium', 'Magnesium 600 мг — судороги', 'Clenbuterol', 'mineral');
    add('potassium', 'Potassium 200 мг — ⚠ (электролиты)', 'Clenbuterol', 'mineral');
  }

  // ─── T3/T4 (тиреоид) ───
  if (flags.hasT3 || flags.hasT4) {
    add('calcium', 'Calcium 1000 мг + D3+K2 — T3/T4 ↑ bone loss', 'Tireoid', 'mineral');
    add('nebivolol', 'Nebivolol 2.5 мг — ⚠ при ЧСС>80 (T3↑HR)', 'Tireoid', 'pharma');
    add('melatonin', 'Melatonin 0.3-1 мг — сон (T3 insomnia)', 'Tireoid', 'other');
  }

  return result;
}

function buildRecommendation(ctx: MapperCtx): SupportRecommendation {
  // ── 1. активировать мехи ─
  const activated = getActivatedTzMechs(ctx.labs);
  // ── 2. фаза ─
  const phase = detectPhase(ctx.phaseCtx);
  const phaseProto = getPhaseProtocol(phase);
  // ── 2a. вычислить PED-флаги (для UI warnings) ─
  let peds = ctx.pedDoses || [];
  if (peds.length === 0 && ctx.aasIds && ctx.aasIds.length > 0) {
    peds = ctx.aasIds.map(id => ({ id, pClass: classifyPed(id) }));
  }
  const pedFlags = derivePEDFlags(peds);
  // ── 3. протокол специалиста-фармацевта (ПЕРВЫМ — обязательный стек) ─
  const protocolAll = computeProtocol(ctx);
  const protocolIds = protocolAll.map(pd => pd.substanceId);
  const subs: RecommendedSub[] = [];
  const phaseDrugs: PhaseAssignedDrug[] = [];
  for (const pd of protocolAll) {
    subs.push({ substanceId: pd.substanceId, category: pd.category, k: 0.5, q: 'A', reason: pd.reason, mechsCovered: [], priority: 1 });
    phaseDrugs.push(pd);
  }
  // ── 4. gap-filling — ТОЛЬКО если протокол пустой (нет AAS) ─
  let suppression: SuppressedSub[] = [];
  if (protocolAll.length === 0) {
    const { subs: mechSubs, suppression: supp } = selectSubstances(activated, phase, ctx.level, ctx.manualChoices);
    for (const s of mechSubs) { if (!subs.some(x => canonId(x.substanceId) === canonId(s.substanceId))) subs.push(s); }
    suppression = supp;
  }
  // ── 5. базовые витамины (D3+K2, Mg, B6, B12, Folate, VitC) ─
  const BASE_VITS: Array<{ id: string; category: TzCategory; reason: string }> = [
    { id: 'vitamin_d3', category: 'vitamin', reason: 'D3 5000 МЕ — иммунитет, костный метаболизм' },
    { id: 'vitamin_k2', category: 'vitamin', reason: 'K2 MK-7 100 мкг — обязателен с D3' },
    { id: 'b_complex', category: 'vitamin', reason: 'B-Complex (B6 P5P 25 мг + B12 метил 1000 мкг + 5-MTHF 400 мкг) — метилирование, гомоцистеин' },
    { id: 'magnesium', category: 'mineral', reason: 'Mg 400 мг — кофактор D3, сон, вазодилатация' },
    { id: 'vitamin_c', category: 'vitamin', reason: 'VitC 500 мг — антиоксидант, регенерация витамина E' },
    { id: 'vitamin_e', category: 'antioxidant', reason: 'VitE 200 МЕ — липофильный антиоксидант (с Astaxanthin + VitC), защита мембран' },
  ];
  for (const bv of BASE_VITS) {
    if (subs.some(s => canonId(s.substanceId) === canonId(bv.id))) continue;
    subs.push({ substanceId: bv.id, category: bv.category, k: 0.5, q: 'B', reason: bv.reason, mechsCovered: [], priority: 2 });
  }
  // ── 6. привязка к анализам (lab→substance priority map) ─
  const LAB_NORMALS: Record<string, { default: number; higherIsWorse: boolean }> = {
    ALT: { default: 40, higherIsWorse: true },
    AST: { default: 40, higherIsWorse: true },
    GGT: { default: 55, higherIsWorse: true },
    BILIRUBIN: { default: 21, higherIsWorse: true },
    BILIRUBIN_TOTAL: { default: 21, higherIsWorse: true },
    TOTAL_BILIRUBIN: { default: 21, higherIsWorse: true },
    LDL: { default: 3.0, higherIsWorse: true },
    CHOLESTEROL_LDL: { default: 3.0, higherIsWorse: true },
    HDL: { default: 1.0, higherIsWorse: false },
    TRIGLYCERIDES: { default: 1.7, higherIsWorse: true },
    HCT: { default: 50, higherIsWorse: true },
    HEMATOCRIT: { default: 50, higherIsWorse: true },
    HEMOGLOBIN: { default: 165, higherIsWorse: true },
    HGB: { default: 165, higherIsWorse: true },
    CREATININE: { default: 105, higherIsWorse: true },
    EGFR: { default: 90, higherIsWorse: false },
    URIC_ACID: { default: 420, higherIsWorse: true },
    TSH: { default: 2.5, higherIsWorse: true },
    E2: { default: 30, higherIsWorse: true },
    ESTRADIOL: { default: 30, higherIsWorse: true },
    PRL: { default: 15, higherIsWorse: true },
    PROLACTIN: { default: 15, higherIsWorse: true },
    TESTOSTERONE: { default: 20, higherIsWorse: false },
    TOTAL_TESTOSTERONE: { default: 20, higherIsWorse: false },
    CRP: { default: 3, higherIsWorse: true },
    HSCRP: { default: 3, higherIsWorse: true },
    VITAMIN_D: { default: 30, higherIsWorse: false },
    B12: { default: 200, higherIsWorse: false },
    FERRITIN: { default: 100, higherIsWorse: false },
    GLUCOSE: { default: 5.5, higherIsWorse: true },
    HBA1C: { default: 5.7, higherIsWorse: true },
    CORTISOL: { default: 400, higherIsWorse: true },
    DHEA_S: { default: 200, higherIsWorse: false },
    HOMOCYSTEINE: { default: 12, higherIsWorse: true },
    POTASSIUM: { default: 4.5, higherIsWorse: true },
    CALCIUM: { default: 2.4, higherIsWorse: true },
    MAGNESIUM: { default: 0.85, higherIsWorse: false },
    ZINC: { default: 12, higherIsWorse: false },
    SELENIUM: { default: 80, higherIsWorse: false },
    CK: { default: 200, higherIsWorse: true },
    PROTEIN_URINE: { default: 0.15, higherIsWorse: true },
    UREA: { default: 8, higherIsWorse: true },
    PLT: { default: 350, higherIsWorse: true },
    D_DIMER: { default: 0.5, higherIsWorse: true },
    FIBRINOGEN: { default: 4, higherIsWorse: true },
    BIL: { default: 21, higherIsWorse: true },
    TG: { default: 1.7, higherIsWorse: true },
    INSULIN: { default: 10, higherIsWorse: true },
    PSA: { default: 4, higherIsWorse: true },
    PROGESTERONE: { default: 1.5, higherIsWorse: true },
    PROG: { default: 1.5, higherIsWorse: true },
    SHBG: { default: 40, higherIsWorse: false },
    DHT: { default: 2.5, higherIsWorse: false },
    CK_MB: { default: 5, higherIsWorse: true },
    TROPONIN: { default: 0.04, higherIsWorse: true },
    ESR: { default: 15, higherIsWorse: true },
  };
  if (ctx.labs && Object.keys(ctx.labs).length > 0) {
    const labSubs: Array<{ id: string; reason: string; marker: string; severity: SeverityLevel }> = [];
    for (const [marker, value] of Object.entries(ctx.labs)) {
      if (typeof value !== 'number' || isNaN(value)) continue;
      const norm = LAB_NORMALS[marker.toUpperCase()];
      if (!norm) continue;
      const sev = deriveSeverity(value, norm.default, norm.higherIsWorse);
      const entries = getPrioritySubstances(marker, sev);
      for (const e of entries) {
        labSubs.push({ id: e.substanceId, reason: e.reason, marker, severity: sev });
      }
    }
    // Дедупликация и отбор top-3 per marker
    const labMap = new Map<string, { id: string; reason: string; marker: string; severity: SeverityLevel }>();
    for (const ls of labSubs) {
      const key = `${ls.marker}|${ls.id}`;
      if (labMap.has(key)) continue;
      labMap.set(key, ls);
    }
    for (const ls of labMap.values()) {
      const canon = canonId(ls.id);
      if (JOINT_BLOCK_AUTO.has(canon.toLowerCase())) continue;
      if ((phase === 'course' || phase === 'bridge') && REPRO_COURSE_BLOCK_AUTO.has(canon.toLowerCase())) continue;
      if (RAAS_ALL.has(canon.toLowerCase()) && subs.some(s => RAAS_ALL.has(s.substanceId.toLowerCase()))) continue;
      if (STATIN_ALL.has(canon.toLowerCase()) && subs.some(s => STATIN_ALL.has(s.substanceId.toLowerCase()))) continue;
      // Если AI уже назначен — цинк для E2 не нужен (дублирование механизма)
      if (canon === 'zinc' && ls.marker.toUpperCase() === 'E2' && subs.some(s => s.substanceId === 'anastrozole' || s.substanceId === 'letrozole')) continue;
      if (subs.some(s => s.substanceId.toLowerCase() === canon)) continue;
      if (subs.some(s => canonId(s.substanceId) === canon)) continue;
      // Дедупликация по классу
      const cls = sameClassIds(ls.id);
      if (cls.length > 0 && subs.some(s => cls.includes(s.substanceId.toLowerCase()))) continue;
      subs.push({
        substanceId: canon,
        category: 'pharma' as TzCategory,
        k: 0.6,
        q: 'A',
        reason: `[ЛАБ: ${ls.marker}] ${ls.reason}`,
        mechsCovered: [],
        priority: 1,
      });
    }
  }
  // ── 3d. TIER-ADJUSTMENTS: adaptive (addSubs), titration, nutrition, alerts + синергии ─
  const tierAdj = computeTierAdjustments(ctx.labs);
  // Добавить tier-adaptive препараты
  for (const a of tierAdj.addSubs) {
    const canon = canonId(a.id);
    if (subs.some(s => canonId(s.substanceId) === canon)) continue;
    if (JOINT_BLOCK_AUTO.has(canon.toLowerCase())) continue;
    if (RAAS_ALL.has(canon.toLowerCase()) && subs.some(s => RAAS_ALL.has(s.substanceId.toLowerCase()))) continue;
    if (STATIN_ALL.has(canon.toLowerCase()) && subs.some(s => STATIN_ALL.has(s.substanceId.toLowerCase()))) continue;
    subs.push({
      substanceId: canon,
      category: 'pharma' as TzCategory,
      k: 0.55,
      q: 'B',
      reason: `[TIER-${a.tier} ${a.marker}] ${a.reason}` + (a.dose ? ` (${a.dose})` : ''),
      mechsCovered: [],
      priority: 1,
    });
  }
  // Титрация (факторы — для UI; dosis записываем в reason)
  const titrationFactors = new Map<string, number>();
  for (const t of tierAdj.titrations) {
    const canon = canonId(t.id);
    const existing = subs.find(s => canonId(s.substanceId) === canon);
    if (existing) {
      existing.reason += ` [TITR↑${t.factor}× по ${t.marker}: ${t.reason}]`;
      existing.priority = 1;
    }
    titrationFactors.set(canon, (titrationFactors.get(canon) ?? 1) * t.factor);
  }
  // ── 3e. Синергии (после всех препаратов) ─
  const synergyCtx = {
    hasOral: (ctx.aasIds || []).some(id => ['oxandrolone','anavar','stanozolol','winstrol','methandienone','dianabol','oxymetholone','anadrol','turinabol','oral_turinabol','methyltestosterone'].some(x => id.toLowerCase().includes(x))),
    hct: ctx.labs['HCT'] || ctx.labs['HEMATOCRIT'],
    plt: ctx.labs['PLT'] || ctx.labs['PLATELETS'],
    ldl: ctx.labs['LDL'] || ctx.labs['CHOLESTEROL_LDL'],
    hdl: ctx.labs['HDL'],
    tsh: ctx.labs['TSH'],
  };
  const synergyR = computeSynergy(subs.map(s => s.substanceId), synergyCtx);
  for (const sa of synergyR.addedSubs) {
    if (subs.some(s => canonId(s.substanceId) === canonId(sa.id))) continue;
    subs.push({
      substanceId: canonId(sa.id),
      category: classifyBySubstanceId(sa.id),
      k: 0.55,
      q: 'B',
      reason: `[СИНЕРГИЯ с ${sa.primary}: ${sa.reason}]`,
      mechsCovered: [],
      priority: 2,
    });
  }
  // ── 4. guardrails ─
  const gCtx = buildGuardrailCtx(ctx);
  gCtx.hasTBooster = subs.some(s => isTBoosterById(s.substanceId));
  const guardrails = screenGuardrails(subs.map(s => s.substanceId), gCtx);
  // ── 5. pair conflicts ─
  const conflicts = screenPairConflicts(subs.map(s => s.substanceId));
  // ── 6. coverage ─
  const { coverage, gaps } = buildCoverageMatrix(subs);
  // ── 7. бустеры ─
  let boosters: AppliedBooster[] = [];
  if (areBoostersAllowed(phase) && ctx.boosterCtx && ctx.level !== 'manual') {
    boosters = applyBoosters(subs.map(s => s.substanceId), ctx.boosterCtx, subs.map(s => s.substanceId));
  }
  // ── 8. summary ─
  const summary = buildSummary(subs, activated, phase, phaseProto, ctx.level, coverage, gaps, guardrails, boosters, suppression);
  const rationale = phaseProto.algorithm;

  return {
    level: ctx.level,
    phase,
    phaseLabel: phaseProto.label,
    subs, suppression,
    coverage, gaps, conflicts, guardrails,
    boosters, activatedMechs: activated,
    summary, rationale,
    phaseAssignedDrugs: phaseDrugs,
    tierAdjustments: tierAdj,
    alerts: tierAdj.alerts,
    stopCourse: tierAdj.stopCourse,
    titrationFactors,
    nutritionTips: tierAdj.nutrition,
    pedFlags,
    contraindications: checkContraindications(subs.map(s => s.substanceId), ctx.healthConditions),
  };
}

function isTBoosterById(id: string): boolean {
  const t = ['fadogia','tongkat','maca','fenugreek','tribulus','macuna','turkesterone','ashwagandha'];
  const s = id.toLowerCase();
  return t.some(x => s === x || s.startsWith(x));
}

function buildSummary(
  subs: RecommendedSub[],
  activated: ActivatedMech[],
  phase: PhaseKey,
  proto: PhaseProto,
  level: SupportLevel,
  coverage: OrganCoverage[],
  gaps: { mechId: TzMechId }[],
  guardrails: GuardrailResult[],
  boosters: AppliedBooster[],
  suppression: SuppressedSub[]
): string {
  const levelRu: Record<SupportLevel, string> = {
    base: 'Базовый',
    medium: 'Средний',
    max: 'Максимальный',
    manual: 'Ручной',
  };
  const lines: string[] = [];
  lines.push(`Пресет: ${levelRu[level]} (${phase} фаза) — ${subs.length} веществ.`);
  lines.push(`Активировано ${activated.length} ТЗ-механизмов по лабам; фаза «${proto.label}».`);
  const totalCovered = coverage.reduce((a, c) => a + c.totalCovered, 0);
  const totalMechs = coverage.reduce((a, c) => a + c.totalMechs, 0);
  lines.push(`Покрытие: ${totalCovered}/${totalMechs} ТЗ-механизмов (${Math.round(totalCovered/totalMechs*100)}%).`);
  lines.push(`Gaps: ${gaps.length} непокрытых механизмов.`);
  if (guardrails.length) lines.push(`Guardrail-предупреждений: ${guardrails.length} (block: ${guardrails.filter(g=>g.level==='block').length}).`);
  if (boosters.length) lines.push(`Бустеры активированы: ${boosters.map(b => b.label).join(', ')}.`);
  if (suppression.length) lines.push(`Подавленные вещества (фаза): ${suppression.length}.`);
  return lines.join(' ');
}

// ──────────────────────────────────────────────────────────────────
//  КЭШ для пресетов (одинаковый ctx → один результат)
// ──────────────────────────────────────────────────────────────────
const cache = new Map<string, SupportRecommendation>();

function cacheKey(ctx: MapperCtx): string {
  const labsKey = JSON.stringify(ctx.labs);
  const phaseKey = JSON.stringify(ctx.phaseCtx);
  const boostKey = ctx.boosterCtx ? JSON.stringify(ctx.boosterCtx) : '';
  return `${ctx.level}|${labsKey}|${phaseKey}|${boostKey}|${JSON.stringify(ctx.manualChoices||{})}|${ctx.onCourse||''}|${ctx.e2Level||''}|${ctx.hasHCG||''}|${ctx.hasAI||''}|${ctx.hasCabergoline||''}|${(ctx.aasIds||[]).join(',')}`;
}

function getFromCache(ctx: MapperCtx): SupportRecommendation | null {
  const k = cacheKey(ctx);
  const v = cache.get(k);
  if (v) return v;
  return null;
}
function putInCache(ctx: MapperCtx, r: SupportRecommendation): void {
  const k = cacheKey(ctx);
  cache.set(k, r);
  // cache не растёт безмерно — почистим если > 100
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  ПУБЛИЧНЫЕ API
// ════════════════════════════════════════════════════════════════════════════
export function resolveBasePlan(ctx: MapperCtx): SupportRecommendation {
  const cached = getFromCache({ ...ctx, level: 'base' });
  if (cached) return cached;
  const r = buildRecommendation({ ...ctx, level: 'base' });
  putInCache({ ...ctx, level: 'base' }, r);
  return r;
}

export function resolveMediumPlan(ctx: MapperCtx): SupportRecommendation {
  const cached = getFromCache({ ...ctx, level: 'medium' });
  if (cached) return cached;
  const r = buildRecommendation({ ...ctx, level: 'medium' });
  putInCache({ ...ctx, level: 'medium' }, r);
  return r;
}

export function resolveMaxPlan(ctx: MapperCtx): SupportRecommendation {
  const cached = getFromCache({ ...ctx, level: 'max' });
  if (cached) return cached;
  const r = buildRecommendation({ ...ctx, level: 'max' });
  putInCache({ ...ctx, level: 'max' }, r);
  return r;
}

export function resolveManualPlan(ctx: MapperCtx): SupportRecommendation {
  // manual — без авто-отбора, только ручные добавки (но guardrails всё равно работают)
  const r = buildRecommendation({ ...ctx, level: 'manual' });
  return r;
}

// Универсальный ресолвер
export function resolvePlan(ctx: MapperCtx): SupportRecommendation {
  switch (ctx.level) {
    case 'base': return resolveBasePlan(ctx);
    case 'medium': return resolveMediumPlan(ctx);
    case 'max': return resolveMaxPlan(ctx);
    case 'manual': return resolveManualPlan(ctx);
  }
  return resolveBasePlan(ctx);
}

// ════════════════════════════════════════════════════════════════════════════
//  Query API (для UI)
// ════════════════════════════════════════════════════════════════════════════
export function getMechLabelTz(mechId: TzMechId): string {
  return TZ_MECH_LABELS[mechId] || mechId;
}
export function getOrganLabelTz(organId: TzOrganId): string {
  return TZ_SYSTEM_LABELS[organId] || organId;
}

// Экспорты из зависимостей для удобного импорта в UI
export {
  getActivatedTzMechs,
  TZ_MECH_TO_SUBS,
  CATEGORY_LIMITS,
  TOTAL_LIMIT,
  PHASE_PROTOCOL,
  detectPhase,
  applyBoosters,
};