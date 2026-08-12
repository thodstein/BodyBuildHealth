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
  NEURO_BOOST,
  JOINTS_BOOST,
  HEMATO_BOOST,
  type BoosterTriggerCtx,
  type AppliedBooster,
} from './tz-bridge-boosters';
import { assessPedRisk, type PedRiskAssessment } from './ped-risk-matrix';
import { TZ_MECH_LABELS, TZ_SYSTEM_LABELS } from '../data/support-db';
import { canonId, sameClassIds } from './support-plan/shared-constants';
import { getPrioritySubstances, deriveSeverity, type SeverityLevel } from '../data/lab-priority-map';
import { computeTierAdjustments, type TierAdjustmentResult, type TierAddSub, type TierAlert, type TierTitration, type TierNutritionTip } from '../data/lab-tier-recommendations';
import { computeSynergy } from '../data/lab-synergy-engine';
import { checkContraindications, type ContraAlert } from '../data/substance-contraindications';
import { checkInteractions } from '../data/drug-interactions';

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

export interface MedicalProcedureRecommendation {
  id: 'erythrocytapheresis' | 'phlebotomy' | 'urgent_thrombosis_evaluation' | 'hematology_review';
  label: string;
  reason: string;
  trigger: string;
  doctorOnly: true;
  monitoring: string[];
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
  protocolWarnings?: string[];   // H3/H4: клинические предупреждения (гипотония, кровотечение)
  procedures?: MedicalProcedureRecommendation[];
  assayWarnings?: string[];
  monitoringPlan?: string;       // H5: структурированный график лаб-мониторинга (строка, legacy)
  monitoringSchedule?: MonitoringSection[]; // H6: структурированный мониторинг (до курса → экстренно)
  supportRisks?: SupportRisk[];  // H7: комбинаторные риски самого плана поддержки
  pedRisk?: PedRiskAssessment;   // v6: оценка PED-риска нейро/суставы (для UI-баннеров)
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
  symptoms?: string[];         // симптомы: gynecomastia, edema_severe, joint_pain, insomnia, anxiety, low_libido, hair_loss, prostate_symptoms
  pedRisk?: PedRiskAssessment;  // v6: оценка PED-риска нейро/суставы
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

function buildProcedureRecommendations(ctx: MapperCtx): MedicalProcedureRecommendation[] {
  const hct = ctx.labs['HEMATOCRIT'] ?? ctx.labs['HCT'];
  const hgb = ctx.labs['HEMOGLOBIN'] ?? ctx.labs['HGB'];
  const dDimer = ctx.labs['D_DIMER'];
  const out: MedicalProcedureRecommendation[] = [];
  const bloodMonitoring = ['HCT', 'HGB', 'RBC', 'PLT', 'fibrinogen', 'INR', 'APTT'];

  if ((hct != null && hct >= 52) || (hgb != null && hgb >= 185)) {
    out.push({
      id: 'erythrocytapheresis',
      label: 'Эритроцитаферез',
      reason: `Выраженный эритроцитоз: ${hct != null ? `HCT ${hct}%` : `HGB ${hgb} г/л`}.`,
      trigger: 'HCT ≥52% или HGB ≥185 г/л',
      doctorOnly: true,
      monitoring: bloodMonitoring,
    });
    out.push({
      id: 'phlebotomy',
      label: 'Терапевтическая флеботомия',
      reason: 'Альтернативная процедурная коррекция эритроцитарной массы, если определена врачом.',
      trigger: 'Эритроцитоз подтверждён повторным ОАК',
      doctorOnly: true,
      monitoring: ['HCT', 'HGB', 'RBC', 'ferritin', 'iron'],
    });
  } else if ((hct != null && hct >= 48) || (hgb != null && hgb >= 175)) {
    out.push({
      id: 'hematology_review',
      label: 'Оценка гематолога',
      reason: 'Пограничное повышение эритроцитарных показателей требует повторного ОАК и оценки причин гемоконцентрации/эритропоэза.',
      trigger: 'HCT ≥48% или HGB ≥175 г/л',
      doctorOnly: true,
      monitoring: ['HCT', 'HGB', 'RBC', 'PLT', 'ferritin'],
    });
  }

  if (dDimer != null && dDimer > 0.5) {
    out.push({
      id: 'urgent_thrombosis_evaluation',
      label: 'Срочная оценка тромботического риска',
      reason: `D-димер ${dDimer} выше референса. Самостоятельно добавлять антикоагулянт нельзя.`,
      trigger: 'D-димер >0.5',
      doctorOnly: true,
      monitoring: ['D_DIMER', 'fibrinogen', 'PLT', 'INR', 'APTT'],
    });
  }
  return out;
}

function buildAssayWarnings(substanceIds: string[], ctx: MapperCtx): string[] {
  const ids = new Set(substanceIds.map(id => id.toLowerCase()));
  const warnings: string[] = [];
  const hasAny = (...values: string[]) => values.some(value => ids.has(value));

  if (hasAny('biotin', 'vitamin_b7')) {
    warnings.push('Биотин может искажать иммунохимические тесты (ТТГ/FT4/FT3, тропонин). Сообщить лаборатории и соблюдать её протокол подготовки.');
  }
  if (hasAny('creatine', 'creatine_monohydrate')) {
    warnings.push('Креатин может повышать сывороточный креатинин без пропорционального падения функции почек. Интерпретировать вместе с eGFR, цистатином-C и UACR.');
  }
  if (hasAny('hydration', 'electrolyte_balance')) {
    warnings.push('Гидратация и электролиты меняют концентрационные показатели. Для сравнения HCT/HGB/мочевины/Na сдавать анализы в сопоставимом состоянии гидратации.');
  }
  if (ids.has('cardio_aerobic')) {
    warnings.push('Интенсивная тренировка может временно повышать CK, AST, CRP и иногда тропонин. Учитывать время последней нагрузки при интерпретации.');
  }
  if (hasAny('nattokinase', 'serrapeptase', 'bromelain', 'lumbrokinase', 'aspirin', 'warfarin', 'enoxaparin', 'apixaban', 'rivaroxaban', 'dabigatran', 'ginkgo', 'garlic')) {
    warnings.push('Фибринолитики/антиагреганты/антикоагулянты необходимо указывать врачу перед коагулограммой, инвазивными процедурами и операцией: меняется гемостатический риск.');
  }
  if (ctx.aasIds?.length || ctx.pedDoses?.length) {
    warnings.push('TT/FT/E2/LH/FSH/SHBG/PRL/HCT и липиды интерпретируются на фоне PED и не являются естественным baseline. В отчёте указывать все препараты и дозы.');
  }
  return Array.from(new Set(warnings));
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
  // 1b. Обязательная нутриция фазы (mandatoryNutrition)
  //     Добавляется ВСЕГДА, независимо от покрытия механизмов
  //     (напр. PCT: эстроген-клиренс DIM/Ca-D-glucarate/fiber/sulforaphane)
  // ───────────────────────────────────────────────────────────────────
  if (phaseProto.mandatoryNutrition) {
    for (const sid of phaseProto.mandatoryNutrition) {
      if (subs.length >= totalLimit) break;
      if (shouldBlock(sid)) continue;
      if (isAlreadyUsed(sid)) continue;

      // Найти лучшее покрытие механизмов в TZ_MECH_TO_SUBS
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
        reason: 'Обязательная PCT-нутриция (эстроген-клиренс)',
        mechsCovered,
        triggeredByMech: triggeredBy,
      });
      markUsed(sid);
      if (categoryCount.has(bestCat)) categoryCount.set(bestCat, categoryCount.get(bestCat)! + 1);
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
        k: 0.3,
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

// Получить k вещества для мех-ма из TZ_MECH_TO_SUBS (0 если не найден)
function getSubKForMech(substanceId: string, mechId: TzMechId): number {
  const found = TZ_MECH_TO_SUBS[mechId].substances.find(s => s.substanceId.toLowerCase() === substanceId.toLowerCase());
  return found ? found.k : 0;
}

// ════════════════════════════════════════════════════════════════════════════
//  ПОКРЫТИЕ МАТРИЦЫ (28 мех × 6 органов)
// ════════════════════════════════════════════════════════════════════════════
function buildCoverageMatrix(
  subs: RecommendedSub[],
  activated?: ActivatedMech[],
): { coverage: OrganCoverage[]; gaps: { organId: TzOrganId; organLabel: string; mechId: TzMechId; mechLabel: string; suggestions: string[] }[] } {
  const organCoverage: OrganCoverage[] = [];
  const gaps: { organId: TzOrganId; organLabel: string; mechId: TzMechId; mechLabel: string; suggestions: string[] }[] = [];
  const activatedSet = activated ? new Set(activated.map(m => m.mechId)) : null;

  for (const organId of ALL_TZ_ORGANS) {
    const mechs: OrganMechCoverage[] = [];
    let coveredN = 0;
    let totalN = 0;
    for (const mechId of ALL_TZ_MECH_IDS) {
      const { organId: o } = mechOrganLabel(mechId);
      if (o !== organId) continue;
      // Если передан activated — считаем только активированные мехи в totalN
      if (activatedSet && !activatedSet.has(mechId)) continue;
      totalN++;
      // найти лучшую субстанцию для этого мех-ма из списка subs
      let bestK = 0; let bestSub = ''; let covered = false;
      for (const rs of subs) {
        const inCovered = rs.mechsCovered.includes(mechId);
        const k = getSubKForMech(rs.substanceId, mechId);
        if (!inCovered && k <= 0) continue;
        const effectiveK = k > 0 ? k : (rs.k > 0 ? rs.k * 0.4 : 0);
        if (effectiveK > bestK) {
          bestK = effectiveK; bestSub = rs.substanceId; covered = true;
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
  'red_yeast', 'red_yeast_rice',
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
  const totalAAS = peds.filter(p => p.pClass.startsWith('aas_')).reduce((s, p) => s + (p.mgPerWeek ?? 0), 0);
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

  // ─── 🛑 WINSTROL + ANADROL — ОБЯЗАТЕЛЬНЫЙ ПРОТОКОЛ (hard-stop combo, ПЕРВЫМ для приоритета) ───
  // Крайне гепатотоксичная и липидно-разрушительная комбинация (↓HDL до 50%+).
  // Требует обязательного протокола защиты: NAC + TUDCA (высокие дозы) + Omega-3 6 г + LFT каждые 2 нед.
  // Размещён ДО базового протокола, чтобы «ОБЯЗАТЕЛЬНО»-причины добавлялись первыми (seen дедуплицирует поздние дубли).
  if (flags.isWinnyPlusOxy) {
    add('nac', 'NAC 1800 мг — ОБЯЗАТЕЛЬНО: глутатион (фаза II детокс) при Winny+Oxy', '🛑 Winny+Anadrol: обязательный протокол', 'hepatoprotector');
    add('tudca', 'TUDCA 1000 мг — ОБЯЗАТЕЛЬНО: BSEP-желчеотток при Winny+Oxy (×2 защита)', '🛑 Winny+Anadrol: обязательный протокол', 'hepatoprotector');
    add('omega3', 'Omega-3 6 г — ОБЯЗАТЕЛЬНО: ↓HDL до 50% на комбо, спасение липидного профиля', '🛑 Winny+Anadrol: обязательный протокол', 'cardioprotector');
    add('milk_thistle', 'Milk thistle 600 мг — ОБЯЗАТЕЛЬНО: стабилизация мембран гепатоцитов', '🛑 Winny+Anadrol: обязательный протокол', 'hepatoprotector');
    add('niacin', 'Niacin 1500 мг на ночь — ОБЯЗАТЕЛЬНО: ↑HDL (lipid disaster на комбо)', '🛑 Winny+Anadrol: обязательный протокол', 'vitamin');
    add('coq10', 'CoQ10 200 мг — ОБЯЗАТЕЛЬНО: митохондрии миокарда/гепатоцитов', '🛑 Winny+Anadrol: обязательный протокол', 'antioxidant');
  }

  // ─── УРОВЕНЬ 1: БАЗА (при любом AAS) — dose-aware через intensity ───
  if (flags.hasAAS || flags.hasSarm) {
    const telDose = Math.round(doseByIntensity(20, 80, intensity) / 10) * 10;
    const tudcaDose = doseByIntensity(500, 1000, intensity) * (flags.hasOral17 ? 2 : 1);
    const nacDose = doseByIntensity(1200, 1800, intensity) * (flags.hasOral17 ? 1.5 : 1);
    const omegaDose = doseByIntensity(2, 4, intensity);
    add('hydration', 'Гидратация — базовая поддержка объёма плазмы и гемоконцентрации', 'Любой активный PED-курс', 'other');
    add('cardio_aerobic', 'Кардио — базовая эндотелиальная и реологическая поддержка', 'Любой активный PED-курс', 'other');
    add('electrolyte_balance', 'Электролиты Na/K/Mg — базовая поддержка водно-электролитного баланса; контроль K⁺/Na⁺/Mg²⁺ обязателен', 'Любой активный PED-курс', 'mineral');
    add('daily_steps', 'Бытовая активность 10 000+ шагов/день — NEAT: реология, эндотелий, липиды', 'Любой активный PED-курс', 'other');
    add('no_smoking', 'Отказ от курения — эндотелий, CO-Hb/гемоконцентрация, атерогенный риск', 'Любой активный PED-курс', 'other');
    add('no_alcohol', 'Отказ от алкоголя — печень (ГГТ/ЩФ/жир), липиды, АД, ЦНС', 'Любой активный PED-курс', 'other');
    add('tadalafil', `Tadalafil 5 мг/день — PDE5i → вазодилатация, эндотелий/АД`, 'PED в курсе', 'pharma');
    add('telmisartan', `Telmisartan ${telDose} мг — ARB + PPAR-γ (АД, инсулин-чувствительность)`, 'PED в курсе', 'pharma');
    add('agmatine', flags.hasNandrolone
      ? 'Agmatine 1 г 2р/день — обязательный компонент профиля нандролона: NMDA/NO-модуляция, поддержка дофаминергического и эндотелиального контуров'
      : 'Agmatine 1 г 2р/день — eNOS → NO, инсулин-сенситайзер',
      flags.hasNandrolone ? 'Нандролон/19-nor в курсе' : 'PED в курсе', 'pharma');
    add('tudca', `TUDCA ${tudcaDose} мг — BSEP-зависимый желчеотток${flags.hasOral17 ? ' (×2 орал)' : ''}`, 'PED в курсе', 'hepatoprotector');
    add('nac', `NAC ${nacDose} мг — глутатион (фаза II детокс)${flags.hasOral17 ? ' (×1.5 орал)' : ''}`, 'PED в курсе', 'hepatoprotector');
    add('omega3', `Omega-3 ${omegaDose} г — ↓ ТГ, ↑ HDL, мембраны, эндотелий`, 'PED в курсе', 'cardioprotector');
    add('coq10', 'CoQ10 200 мг — митохондрии миокарда, кофактор', 'PED в курсе', 'antioxidant');
    add('tmg', 'TMG 1000 мг — донатор CH₃ → ↓ гомоцистеин (AAS ↑ Hcy)', 'PED в курсе', 'amino');
    add('taurine', 'Taurine 1000 мг — осмолит, кардиопротектор', 'PED в курсе', 'amino');
    const hcgDose = totalAAS <= 500 ? '500 МЕ 2р/нед' : totalAAS <= 1000 ? '750 МЕ 2р/нед' : '1000 МЕ 2-3р/нед';
    add('hcg', `hCG ${hcgDose} — клетки Лейдига (HPTA), поддержка ${totalAAS} мг/нед AAS`, 'AAS в курсе', 'hormonal');
    if (totalAAS >= 500 || flags.hasTren || flags.hasNandrolone || flags.hasBold) {
      add('nebivolol', 'Nebivolol 2.5 мг — минимальный старт; СТРОГО ПОД КОНТРОЛЕМ АД И ЧСС', 'Высокая суммарная PED/кардио-нагрузка', 'pharma');
    }
  }

  // ─── ТЕСТОСТЕРОН-СПЕЦИФИКА (dose-aware anastrozole) ───
  if (flags.hasTest) {
    const testP = peds.find(p => p.pClass === 'aas_test');
    const testMg = testP?.mgPerWeek ?? 500;
    // total aromatizable AAS = test + nandrolone + boldenone + DHB + others
    const aromAAS = peds.filter(p => 
      p.pClass === 'aas_test' || 
      p.pClass === 'aas_nandrolone' || 
      p.pClass === 'aas_bold' || 
      p.pClass === 'aas_dht_inject'
    ).reduce((sum, p) => sum + (p.mgPerWeek || 0), 0);
    let aiDose = '0.5 мг 2р/нед';
    if (aromAAS <= 300) aiDose = '0.25 мг 2р/нед (лишь при E2>40)';
    else if (aromAAS <= 600) aiDose = '0.25 мг 2р/нед';
    else if (aromAAS <= 1000) aiDose = '0.5 мг 2р/нед';
    else aiDose = '1 мг/день (титровать)';
    const hasOxy = peds.some(p => p.pClass === 'aas_oral_oxy');
    const oxyNote = hasOxy ? ' ⚠ Anadrol: AI НЕ работает при гино — нужен Tamoxifen (через «Усилить»)' : '';
    add('anastrozole', `Anastrozole ${aiDose} — титровать к E2 20-40 pg/mL, НЕ подавлять <15 (боль в суставах, либидо↓, когнитивные)${oxyNote}`, `Σ Ароматизирующих ААС ${aromAAS} мг/нед (тест ${testMg})`, 'pharma');
    add('pycnogenol', 'Pycnogenol 150 мг — eNOS + защита эндотелия', 'Тестостерон', 'antioxidant');
    add('citrulline', 'Citrulline 6 г — NO-предшественник', 'Тестостерон', 'amino');
    add('bergamot', 'Bergamot 500 мг — HMG-CoA редуктаза (липиды)', 'Тестостерон', 'cardioprotector');
    add('astaxanthin', 'Astaxanthin 4 мг — липофильный антиоксидант', 'Тестостерон', 'antioxidant');
  }

  // ─── АРОМАТИЗИРУЮЩИЙ AAS БЕЗ ТЕСТОСТЕРОНА — эстроген-контроль (critical) ───
  if (!flags.hasTest && (flags.hasNandrolone || flags.hasBold || flags.hasTren)) {
    add('anastrozole', 'Anastrozole 0.25 мг 2р/нед — эстроген-контроль (nandrolone/boldenone ароматизируют); титровать к E2 20-40 pg/mL, НЕ подавлять <15', 'Ароматизирующий AAS без теста', 'pharma');
  }

  // ─── НАНДРОЛОН — особый профиль (progestagen, объём, либидо↓) ───
  if (flags.hasNandrolone) {
    // Каберголин не добавляем в назначенный план автоматически.
    // Наличие нандролона само по себе не подтверждает гиперпролактинемию.
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
    // Каберголин остаётся lab-gated: только при подтверждённом PRL и назначении врача.
    add('nebivolol', 'Nebivolol 2.5-5 мг — ⚠ Под контролем ЧСС и АД', 'Тренболон', 'pharma');
    add('astragalus', `Astragalus ${Math.round(500 * (1 + trenIntens * 0.5))} мг — клубочки (трен-нефротокс)`, 'Тренболон', 'nephroprotector');
    add('cordyceps', `Cordyceps ${Math.round(1000 * (1 + trenIntens * 0.3))} мг — BUN/креатинин`, 'Тренболон', 'nephroprotector');
    add('alpha_lipoic', 'Alpha-lipoic 300 мг — Nrf2 (трен окислительный)', 'Тренболон', 'antioxidant');
    add('curcumin', 'Curcumin 500 мг — NF-κB (↓ CRP/IL-6)', 'Тренболон', 'antiinflam');
    add('berberine', 'Berberine 1500 мг — AMPK (инсулинорезистентность)', 'Тренболон', 'pharma');
    add('dandelion', 'Dandelion 500 мг 2р/день — отёки', 'Тренболон', 'pharma');
    add('hesperidin', 'Hesperidin 500 + Diosmin 450 — венотоник', 'Тренболон', 'cardioprotector');
    // Нейротоксичность 19-nor: берём профиль из NEURO_BOOST/нейро-лабораторной матрицы,
    // а не только симптоматические теанин и глицин.
    add('magnesium_l_threonate', 'Magnesium L-треонат 2000 мг (≈144 мг элементарного Mg) — нейронагрузка 19-nor, NMDA/GABA и сон', 'Тренболон (ЦНС)', 'mineral');
    add('phosphatidylserine', 'Фосфатидилсерин 300-400 мг — стресс/HPA-контур и кортизольная нагрузка 19-nor', 'Тренболон (ЦНС)', 'neuroprotector');
    add('vitamin_b12', 'Витамин B12 1000 мкг — нейрометаболическая поддержка по профилю нейротоксичности ААС', 'Тренболон (ЦНС)', 'vitamin');
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

  // ─── ОБЩИЙ: Serra+Natto+Bromelain на жёстких курсах (HCT++/фибринолиз) ───
  // Назначается при intensity > 1.3 (нестандартные дозы, мультиндр-комбо)
  // Болденон уже покрывает выше — seen исключает дубли
  if (!flags.hasBold && flags.hasAAS && intensity > 1.3) {
    add('serrapeptase', `Serrapeptase 10 мг — проф. фибринолиз (интен_${intensity.toFixed(1)})`, 'Жёсткий курс (HCT/фибрин)', 'pharma');
    add('nattokinase', 'Nattokinase 100 мг — плазмин → ↓ фибрин (↑ вязкость на курсе)', 'Жёсткий курс', 'pharma');
    add('bromelain', 'Bromelain 500 мг — ↓ PAI-1, фибринолитик', 'Жёсткий курс', 'antiinflam');
  }

  // ─── ДГТ-inject (Masteron, Primo) — анти-эстро, липиды↓↓ ───
  if (flags.hasDhtInject) {
    add('niacin', 'Niacin 500-1500 мг на ночь — ↑HDL (Masteron/Primo ↓HDL)', 'ДГТ-inject (липиды)', 'vitamin');
    add('bergamot', 'Bergamot 1000 мг — липиды (поверх базы)', 'ДГТ-inject (липиды)', 'cardioprotector');
  }

  // ─── ОРАЛЫ 17α: общее + спец ───
  if (flags.hasOral17) {
    add('milk_thistle', 'Milk thistle 600 мг — стабилизация мембран (силимарин)', 'Орал 17α', 'hepatoprotector');
  }

  // ─── WINSTROL special: липиды disaster + суставы ───
  if (peds.some(p => p.pClass === 'aas_oral_winny')) {
    add('niacin', 'Niacin 1500 мг на ночь — ⚠ Winny ↓HDL до 50% (lipid disaster)', 'Winstrol (липиды)', 'vitamin');
    add('garlic', 'Garlic 1200 мг — ↓LDL (Winny)', 'Winstrol (липиды)', 'cardioprotector');
    add('omega3', 'Omega-3 6 г — липиды (поверх) [переопределение базы]', 'Winstrol (липиды)', 'cardioprotector');
  }

  // ─── OXYMETHOLONE (Anadrol) special ───
  if (peds.some(p => p.pClass === 'aas_oral_oxy')) {
    add('hesperidin', 'Hesperidin 500 + Diosmin 450 — венотоник', 'Anadrol (отеки)', 'cardioprotector');
    // Tamoxifen — ТОЛЬКО при симптомах гино
    const symptoms = ctx.symptoms || [];
    if (symptoms.includes('gynecomastia')) {
      add('tamoxifen', 'Tamoxifen 20 мг — ⚠ ТОЛЬКО ПРИ ГИНО (Anadrol: AI не работает, нужен SERM)', 'Anadrol + гино', 'pharma');
    }
    // Гидрохлоротиазид — при выраженных отёках (НЕ спиронолактон: он блокатор AR + 5α-редуктазу + CYP17)
    if (symptoms.includes('edema_severe')) {
      add('hydrochlorothiazide', 'Гидрохлоротиазид 12.5-25 мг/утро — ⚠ через врача (отёки на Anadrol, ↓объём, мониторинг K+/Na+)', 'Anadrol + отёки', 'pharma');
      add('potassium', 'Kалий 200 мг — ⚠ восполнение на диуретике (тиазид вымывает K+)', 'Anadrol + отёки (K+-защита)', 'mineral');
    }
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

  // ─── CLENBUTEROL — тратит таурин + электролитный дисбаланс ───
  if (flags.hasClenbut) {
    add('taurine', 'Taurine 5 г/сут, разделённо на 3 приёма (1.5+1.5+2 г) — ⚠ Clen истощает таурин (судороги, аритмия!)', 'Clenbuterol', 'amino');
    add('magnesium', 'Magnesium 600-800 мг — судороги/аритмия (β2-агонист)', 'Clenbuterol', 'mineral');
    add('potassium', 'Potassium 400-600 мг/сут — ⚠ электролиты (Clen ↓K+, риск аритмии)', 'Clenbuterol', 'mineral');
    add('coq10', 'CoQ10 200 мг — митохондрии миокарда (Clen тахикардия/нагрузка)', 'Clenbuterol', 'antioxidant');
  }

  // ─── T3/T4 (тиреоид) — кардиозащита + костная протекция ───
  if (flags.hasT3 || flags.hasT4) {
    add('nebivolol', 'Nebivolol 2.5-5 мг — ОБЯЗАТЕЛЬНО при ЧСС>80 в покое (T3/T4 ↑HR, риск тахиаритмии); контроль ЧСС ежедневно', 'Tireoid (тахикардия)', 'pharma');
    add('calcium', 'Calcium 1000 мг + D3 2000 МЕ + K2 100 мкг — костная протекция (T3/T4 ↑ bone resorption)', 'Tireoid (кости)', 'mineral');
    add('magnesium', 'Magnesium 400-600 мг — костная протекция + антиаритмический', 'Tireoid (кости/сердце)', 'mineral');
    add('melatonin', 'Melatonin 0.3-1 мг — сон (T3 insomnia)', 'Tireoid (сон)', 'other');
    add('coq10', 'CoQ10 200 мг — митохондрии миокарда (T3 ↑ метаболизм миокарда)', 'Tireoid (сердце)', 'antioxidant');
  }

  return result;
}

// ── H3/H4: клинические предупреждения по комбинациям в протоколе ──
function computeProtocolWarnings(protocolIds: string[], flags?: ReturnType<typeof derivePEDFlags>): string[] {
  const ids = protocolIds.map(s => s.toLowerCase());
  const has = (x: string) => ids.includes(x);
  const w: string[] = [];
  if (flags?.hasNandrolone || flags?.hasTren || flags?.hasBold) {
    w.push('⚠ КАБЕРГОЛИН НЕ НАЗНАЧЕН: при 19-nor нужен PRL, повторное подтверждение/макропролактин и обязательное назначение врача. Не принимать профилактически.');
  }
  if (has('tadalafil') && has('telmisartan') && has('nebivolol')) {
    w.push('⚠ ГИПОТОНИЯ: tadalafil + telmisartan + nebivolol одновременно — ежедневный контроль АД (цель систолическое >100 мм рт.ст.); при головокружении/слабости снизить дозу telmisartan или nebivolol');
  }
  if (has('tadalafil') && has('telmisartan') && !has('nebivolol')) {
    w.push('⚠ ГИПОТОНИЯ: tadalafil + telmisartan — контроль АД (оба снижают); при добавлении небиволола риск усиливается');
  }
  const hasFib = has('serrapeptase') || has('nattokinase') || has('bromelain');
  if (has('omega3') && hasFib) {
    w.push('⚠ КРОВОТЕЧЕНИЕ: omega-3 3-6 г + фибринолитики (серрапептаза/наттокиназа/бромелайн) — отменить ЗА 1-2 нед до операции, инъекций, травмопасных тренировок; контроль времени кровотечения');
  }
  // CRITICAL: Winstrol + Anadrol — токсичный дуэт (гепато-/нефро- + липидный коллапс, AI не работает при гино)
  if (flags?.isWinnyPlusOxy) {
    w.push('🛑 WINSTROL + ANADROL — КРИТИЧЕСКАЯ КОМБИНАЦИЯ: крайне гепатотоксична и разрушает липидный профиль (↓HDL до 50%+). ОБЯЗАТЕЛЬНЫЙ ПРОТОКОЛ: NAC 1800 мг + TUDCA 1000 мг + Omega-3 6 г + Силимарин 600 мг + Niacin 1500 мг + CoQ10 200 мг. Контроль АЛТ/АСТ КАЖДЫЕ 2 НЕД — при ALT>2×ULN немедленная отмена. Анастрозол НЕ работает при гинекомастии на оксиметолоне — нужен тамоксифен. НЕ рекомендуется держать комбо дольше 4 нед');
  }
  // CRITICAL: >1 орал 17α — кумулятивная гепатотоксичность
  if (flags?.isMultiOral) {
    w.push('🛑 МУЛЬТИ-ОРАЛ (несколько 17α-алкилированных): кумулятивная гепатотоксичность. Не держать >6-8 нед, АЛТ/АСТ каждые 2 нед, обязателен TUDCA+NAC+силимарин, при АЛТ>200 — СТОП');
  }
  // CRITICAL: ароматизирующий AAS без тестостерона → эстроген-контроль обязателен
  if ((flags?.hasNandrolone || flags?.hasBold || flags?.hasTren) && !flags?.hasTest) {
    w.push('⚠ Ароматизирующий AAS без базового тестостерона: nandrolone/boldenone ароматизируют в эстрадиол. Назначить анастрозол 0.25-0.5 мг 2р/нед (титровать к E2 20-40 пг/мл), контроль пролактина (nandrolone) и гинекомастии');
  }
  // MED: GH + инсулин — тяжёлый ИР + гипогликемия при инсулине
  if (flags?.isGHPlusInsulin) {
    w.push('⚠ GH + ИНСУЛИН: выраженная инсулинорезистентность + риск тяжёлой гипогликемии. Берберин 2 г + метформин, глюкоза натощак/постпрандиально каждые 4 нед; инсулин только после углеводной еды, иметь глюкозу под рукой');
  }
  return w;
}

// ── H5: структурированный график лабораторного мониторинга ──
function buildMonitoringPlan(ctx: MapperCtx, flags: ReturnType<typeof derivePEDFlags>, phase: PhaseKey): string {
  if (phase === 'pct') {
    return 'Мониторинг ПКТ:\n• Нед 2 после отмены: ЛГ, ФСГ, общ. тестостерон, эстрадиол, пролактин\n• Нед 6 после отмены: ЛГ, ФСГ, общ. тестостерон, эстрадиол\n• При невосстановлении HPTA (>6 нед, ТТГ/ЛГ < 50% нормы) — эндокринолог';
  }
  const onPED = flags.hasAAS || flags.hasSarm || flags.hasGH || flags.hasInsulin || flags.hasIGF;
  if (!onPED) return '';
  const lines: string[] = [];
  if (Object.keys(ctx.labs || {}).length === 0) {
    lines.push('⚠ Анализы отсутствуют: базовая поддержка рассчитана по фармакологии и фазе, но фактический уровень рисков не подтверждён.');
  }
  lines.push('• 0 нед (исходно): ОАК+БХ (АЛТ/АСТ/ГГТ/билирубин/ЩФ), липидограмма, эстрадиол, пролактин, ТТГ, глюкоза/HbA1c, креатинин/eGFR, АД, ЧСС, PSA (мужчины >40л или при наличии ААС)');
  if (flags.hasOral17) lines.push('• каждые 2 нед: АЛТ/АСТ (орал 17α — гепатотоксичность). При ALT>2×ULN — снизить/отменить орал');
  else lines.push('• 4 нед: АД, ЧСС, HCT/гемоглобин, АЛТ/АСТ');
  lines.push('• 4 нед: HCT, ферритин (управление эритроцитозом), эстрадиол (титрация AI), пролактин (nandrolone/tren)');
  lines.push('• 8 нед: ОАК+БХ+липидограмма, эстрадиол, пролактин, ТТГ, УЗИ печени и предстательной железы, D-димер (при HCT>52%)');
  lines.push('• 12 нед: как на 8 нед');
  if (flags.hasGH) lines.push('• при GH: глюкоза натощак + HbA1c каждые 4 нед, IGF-1 каждые 6-8 нед (титрация дозы, цель — верхняя граница возрастной нормы)');
  if (flags.hasInsulin) lines.push('• при инсулине: глюкоза натощак + через 2 ч после еды каждые 4 нед, K+ каждые 4 нед');
  if (flags.hasIGF) lines.push('• при IGF-1: глюкоза 3р/сут в первую неделю (риск гипогликемии), далее натощак каждую нед');
  if (flags.hasClenbut) lines.push('• при кленбутероле: K+, Na+, магний, креатинин каждые 2 нед (электролитный дисбаланс), ЧСС/АД ежедневно');
  if (flags.hasT3 || flags.hasT4) lines.push('• при T3/T4: ТТГ, своб.T3, своб.T4 каждые 4 нед, кальций/PTH/вит.D (костная защита), ЧСС/АД');
  if (flags.hasTren) lines.push('• при тренболоне: ЧСС/АД ежедневно, сон/тревога/раздражительность ежедневно, креатинин/eGFR/UACR/K/Na/Mg каждые 2-4 нед, PRL/E2 каждые 4 нед; ЭКГ при тахикардии/боли/одышке');
  if (flags.hasNandrolone) lines.push('• при нандролоне: PRL с повторным подтверждением при отклонении, E2/TT/FT/LH/FSH/SHBG каждые 4 нед; либидо/эректильная функция и симптомы гинекомастии в дневнике');
  if (flags.hasBold) lines.push('• при болденоне/DHB: ОАК (HCT/HGB/RBC/PLT) каждые 2-4 нед, ferritin/iron/transferrin saturation; при HCT↑ — обсуждение эритроцитафереза/флеботомии только с врачом');
  if (phase === 'bridge') lines.push('• мост: повтор липидов, ОАК, АЛТ/АСТ, АД/ЧСС каждые 6 нед; сохранять контроль HCT и E2');
  if (phase === 'fertility') lines.push('• фертильность: спермограмма + LH/FSH/TT/E2/PRL каждые 6-8 нед; hCG/FSH-схема только под врачом');
  if (phase === 'trt') lines.push('• TRT: ОАК/HCT, PSA, E2, TT/FT/SHBG, липиды и АД каждые 8-12 нед после стабилизации, чаще при отклонениях');
  lines.push('• внепланово при симптомах: головная боль, желтуха, отёки, гинекомастия, боль в груди, одышка, тахикардия >100, АД >160/100');
  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════════════
//  СТРУКТУРИРОВАННЫЙ МОНИТОРИНГ — единая графа «Мониторинг и анализы»
//  baseline (до курса) → daily → week2 → week4 → week8 → post → urgent.
//  Учитывает фазу, препараты (PED-флаги) и целевые диапазоны.
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
//  DOCTOR_CONTROLLED_IDS — рецептурные/врачебные препараты.
//  Доступны к выбору в попапах, но в плане помечаются
//  «под обязательным контролем врача».
// ════════════════════════════════════════════════════════════════════════════
export const DOCTOR_CONTROLLED_IDS = new Set<string>([
  // АД/сердце
  'tadalafil', 'telmisartan', 'nebivolol', 'metoprolol', 'bisoprolol',
  'atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin',
  // Гормоны/ПКТ
  'anastrozole', 'letrozole', 'exemestane', 'tamoxifen', 'clomiphene',
  'enclomiphene', 'cabergoline', 'hcg', 'finasteride',
  // Метаболизм
  'metformin', 'pioglitazone',
  // Диуретики/электролиты Rx
  'spironolactone', 'hydrochlorothiazide', 'indapamide', 'eplerenone',
  // Антикоагулянты/антиагреганты Rx
  'warfarin', 'enoxaparin', 'sulodexide', 'lumbrokinase', 'dipyridamole',
  'pentoxifylline', 'apixaban', 'rivaroxaban', 'dabigatran',
  // Нейро Rx (LV3/LV4)
  'memantine', 'lamotrigine', 'amantadine', 'guanfacine', 'tizanidine',
  'fluvoxamine', 'naltrexone', 'dihexa', 'tropoflavin', 'phenylpiracetam',
  'fasoracetam', 'bromantane', 'pregnenolone', 'noopept',
  // Пептиды (исследовательские)
  'bpc157', 'tb500', 'ghk_cu', 'bpc_157', 'thymosin_beta4',
]);

export function isDoctorControlled(id: string): boolean {
  return DOCTOR_CONTROLLED_IDS.has(String(id || '').toLowerCase());
}

export interface SupportRisk {
  id: string;
  label: string;
  level: 'low' | 'medium' | 'high';
  detail: string;
}

// ════════════════════════════════════════════════════════════════════════════
//  РИСКИ ПОДДЕРЖКИ — комбинаторные риски самого плана поддержки
//  (не курса): гипотония, гиперкалиемия, кровотечение, гепато-, гипогликемия,
//  CYP3A4-нагрузка. Калькулируются по итоговому составу subs.
// ════════════════════════════════════════════════════════════════════════════
export function buildSupportRisks(subs: RecommendedSub[]): SupportRisk[] {
  const ids = new Set(subs.map(s => canonId(s.substanceId)));
  const has = (x: string) => ids.has(x);
  const risks: SupportRisk[] = [];

  const hypotensionCount = ['tadalafil', 'telmisartan', 'nebivolol'].filter(has).length;
  if (hypotensionCount >= 2) {
    risks.push({
      id: 'hypotension',
      label: 'Гипотония',
      level: hypotensionCount >= 3 ? 'high' : 'medium',
      detail: `${['Тадалафил', 'Тельмисартан', 'Небиволол'].filter((_, i) => hypotensionCount >= 2).slice(0, hypotensionCount).join(' + ')} — ежедневный контроль АД (сист. >100); при головокружении/слабости снизить дозу.`,
    });
  }

  const kSparing = ['telmisartan', 'spironolactone', 'eplerenone', 'potassium'].filter(has);
  if (kSparing.length >= 2) {
    risks.push({
      id: 'hyperkalemia',
      label: 'Гиперкалиемия',
      level: kSparing.length >= 3 ? 'high' : 'medium',
      detail: `K⁺-сберегающая комбинация (${kSparing.join(' + ')}): контроль K⁺ каждые 4 нед, ЭКГ при K⁺ >5.5.`,
    });
  }

  const fibrinolytics = ['nattokinase', 'serrapeptase', 'bromelain', 'lumbrokinase', 'aspirin', 'dipyridamole', 'pentoxifylline', 'warfarin', 'enoxaparin', 'sulodexide', 'ginkgo', 'garlic'].filter(has);
  if (fibrinolytics.length >= 2) {
    risks.push({
      id: 'bleeding',
      label: 'Риск кровотечения',
      level: fibrinolytics.length >= 3 ? 'high' : 'medium',
      detail: `Фибринолитики/антиагреганты (${fibrinolytics.join(' + ')}): сообщить врачу перед операцией/инвазивными процедурами; антикоагулянты не добавлять самостоятельно.`,
    });
  }

  const cyp3a4 = ['tadalafil', 'anastrozole', 'simvastatin'].filter(has).length;
  const cypInhibitors = ['milk_thistle', 'berberine', 'grapefruit'].filter(has);
  if (cyp3a4 > 0 && cypInhibitors.length > 0) {
    risks.push({
      id: 'cyp3a4',
      label: 'CYP3A4-взаимодействие',
      level: 'medium',
      detail: `${cypInhibitors.join(' + ')} ингибируют CYP3A4 → ↑ концентрация tadalafil/anastrozole: разнести приём на 2+ ч, мониторинг побочек.`,
    });
  }

  const hypoglycemia = ['berberine', 'alpha_lipoic', 'chromium'].filter(has);
  if (hypoglycemia.length > 0 && (has('insulin_rapid') || has('somatropin') || has('igf1_lr3') || has('metformin'))) {
    risks.push({
      id: 'hypoglycemia',
      label: 'Гипогликемия',
      level: 'high',
      detail: `${hypoglycemia.join(' + ')} на фоне инсулина/GH/метформина: контроль глюкозы, не принимать натощак без показаний.`,
    });
  }

  const giIrritants = ['aspirin', 'nattokinase', 'omega3'].filter(has).length;
  if (giIrritants >= 2 && (has('telmisartan') || has('spironolactone'))) {
    risks.push({
      id: 'gi',
      label: 'ЖКТ-нагрузка',
      level: 'medium',
      detail: 'Аспирин/омега-3/фибринолитики + препараты с ЖКТ-эффектом: принимать с едой, при боли/изжоге — гастропротектор.',
    });
  }

  return risks;
}

export interface MonitoringItemLine {
  marker: string;
  reason: string;
  target?: string;
  drug?: string;
  escalation?: string;
}

export interface MonitoringSection {
  id: 'baseline' | 'daily' | 'week2' | 'week4' | 'week8' | 'week12' | 'post' | 'urgent';
  label: string;
  period: string;
  icon: string;
  items: MonitoringItemLine[];
}

export function buildMonitoringSchedule(
  ctx: MapperCtx,
  flags: ReturnType<typeof derivePEDFlags>,
  phase: PhaseKey,
  protocolIds: string[] = [],
): MonitoringSection[] {
  const planIdSet = new Set(protocolIds.map(s => s.toLowerCase()));
  const sections: MonitoringSection[] = [];
  const add = (id: MonitoringSection['id'], label: string, period: string, icon: string, items: MonitoringItemLine[]) => {
    if (items.length === 0) return;
    sections.push({ id, label, period, icon, items });
  };
  const onPED = flags.hasAAS || flags.hasSarm || flags.hasGH || flags.hasInsulin || flags.hasIGF;

  const baseline: MonitoringItemLine[] = [];
  baseline.push({
    marker: 'ОАК + БХ (АЛТ/АСТ/ГГТ/билирубин/ЩФ), липидограмма, E2, PRL, ТТГ, глюкоза/HbA1c, креатинин/eGFR',
    reason: 'Исходная точка рисков до начала курса; сравнение во время/после',
    target: 'АЛТ<40, АСТ<40, HCT<50%, LDL<3.0, E2 20-40 пг/мл',
  });
  baseline.push({ marker: 'АД, ЧСС', reason: 'Базовое артериальное давление и пульс', target: 'АД<130/85, ЧСС 60-90' });
  baseline.push({ marker: 'Электролиты Na⁺/K⁺/Mg²⁺', reason: 'База для ARB/диуретиков/кленбутерола', target: 'K 3.5-5.0, Na 135-145, Mg 0.75-1.0' });
  baseline.push({ marker: 'Коагулограмма (МНО/АЧТВ/фибриноген/D-димер)', reason: 'База перед фибринолитиками/антиагрегантами', target: 'фибриноген 2-4 г/л, D-димер <0.5' });
  baseline.push({ marker: 'Ферритин, сыв. железо, витамин D (25-OH), B12, фолат', reason: 'База для управления эритроцитозом и дефицитами', target: 'ферритин 50-200, D3 50-80 нг/мл' });
  baseline.push({ marker: 'ЭКГ', reason: 'Базовая ритмология (перед β-блокаторами/высокими дозами)', escalation: 'QTc>450 или аритмия — кардиолог до курса' });
  if (flags.hasOral17) {
    baseline.push({ marker: 'УЗИ печени', reason: 'База перед 17α-оралами', escalation: 'Стеатоз/фиброз — гепатолог' });
  }
  baseline.push({ marker: 'PSA', reason: 'Мужчины >40 лет или при наличии ААС в анамнезе', target: 'PSA<4 нг/мл', drug: 'aas' });
  if (phase === 'fertility') {
    baseline.push({ marker: 'Спермограмма + LH/FSH/TT/E2/PRL', reason: 'Исходный фертильный профиль', drug: 'fertility' });
  }
  if (phase === 'trt') {
    baseline.push({ marker: 'TT/FT/SHBG + ОАК/HCT', reason: 'Базовый гормональный профиль TRT', target: 'TT 15-30 нмоль/л, HCT<50%' });
  }
  add('baseline', 'До курса (исходно)', '0 нед — перед началом', '📋', baseline);

  const daily: MonitoringItemLine[] = [];
  daily.push({ marker: 'Вес (утром)', reason: 'Задержка воды/отёки', target: '↑ <2 кг/нед', escalation: '↑>2 кг/нед + отёки — Na⁺, диуретики под врачом' });
  daily.push({ marker: 'Гидратация (мл/день, цвет мочи)', reason: 'Тёмная моча = дегидратация → гемоконцентрация', target: '40-45 мл/кг/сут, моча светло-жёлтая' });
  if (flags.hasTren || flags.hasNandrolone || flags.hasBold || (ctx.pedDoses || []).some(p => (p.mgPerWeek || 0) >= 500) || flags.hasClenbut) {
    daily.push({ marker: 'АД, ЧСС', reason: 'Высокая PED/кардио-нагрузка или кленбутерол', target: 'АД<130/85, ЧСС 60-90', escalation: 'ЧСС покоя >100 или АД>160/100 — STOP и врач' });
  }
  if (flags.hasTren) {
    daily.push({ marker: 'Сон, тревога, раздражительность', reason: 'Нейротоксичность 19-nor', escalation: 'ЭКГ при тахикардии/боли/одышке' });
  }
  if (flags.hasNandrolone) {
    daily.push({ marker: 'Либидо, эректильная функция, гинекомастия', reason: 'Профиль нандролона — вести дневник', escalation: 'PRL при отклонении — повторное подтверждение' });
  }
  if (flags.hasInsulin) {
    daily.push({ marker: 'Глюкоза 3р/сут (1-я неделя)', reason: 'Риск гипогликемии при инсулине', target: '3.9-7.8 ммоль/л', escalation: 'Гипогликемия — срочно пересмотреть дозу' });
  }
  add('daily', 'Ежедневно', 'каждый день', '🌡', daily);

  if (phase !== 'pct') {
  const week2: MonitoringItemLine[] = [];
  if (flags.hasOral17) {
    week2.push({ marker: 'АЛТ/АСТ', reason: 'Оралы 17α — гепатотоксичность', target: 'АЛТ<40, АСТ<40', drug: 'oral17', escalation: 'ALT>2×ULN — снизить/отменить орал' });
  }
  if (flags.hasClenbut) {
    week2.push({ marker: 'K⁺, Na⁺, Mg, креатинин', reason: 'Электролитный дисбаланс на кленбутероле', target: 'K 3.5-5.0, Na 135-145, Mg 0.75-1.0' });
  }
  if (flags.hasTren) {
    week2.push({ marker: 'Креатинин, eGFR, UACR, K/Na/Mg', reason: 'Трен-нефротоксичность', target: 'eGFR>60, UACR<30' });
  }
  add('week2', 'Через 2 недели', 'каждые 2 нед', '🧪', week2);

  const week4: MonitoringItemLine[] = [];
  week4.push({ marker: 'АД, ЧСС, HCT/HGB, АЛТ/АСТ', reason: 'Базовый контроль на курсе', target: 'HCT<50%, HGB<170 г/л' });
  week4.push({ marker: 'HCT, ферритин', reason: 'Управление эритроцитозом', target: 'HCT<50%, ферритин 30-300' });
  week4.push({ marker: 'E2 (титрация AI), PRL', reason: 'Гормональный контроль', target: 'E2 20-40 пг/мл, PRL<25' });
  if ((ctx.pedDoses || []).some(p => (p.mgPerWeek || 0) >= 500)) {
    week4.push({ marker: 'Липидограмма (ЛПНП/ЛПВП/ТГ)', reason: 'Дозы >500 мг/нед — липидный контроль', target: 'LDL<3.0, HDL>1.0, ТГ<1.7' });
  }
  if (['nattokinase', 'serrapeptase', 'bromelain', 'aspirin'].some(id => planIdSet.has(id))) {
    week4.push({ marker: 'Коагулограмма (фибриноген, D-димер)', reason: 'Фибринолитики/антиагреганты в плане', target: 'D-димер <0.5', escalation: 'D-димер>0.5 — срочная оценка тромботического риска' });
  }
  if (flags.hasTren) {
    week4.push({ marker: 'PRL, E2', reason: '19-nor: пролактин и ароматизация', target: 'PRL<25, E2 20-40' });
  }
  if (flags.hasNandrolone) {
    week4.push({ marker: 'E2/TT/FT/LH/FSH/SHBG', reason: 'HPTA и эстрогеновый профиль нандролона', target: 'LH/FSH в норме на фоне поддержки hCG' });
  }
  if (flags.hasBold) {
    week4.push({ marker: 'ОАК (HCT/HGB/RBC/PLT), ferritin/iron/TSAT', reason: 'Эритроцитоз болденона/DHB', target: 'HCT<52%, TSAT 20-45%', escalation: 'HCT↑ — эритроцитаферез/флеботомия ТОЛЬКО с врачом' });
  }
  if (flags.hasGH) {
    week4.push({ marker: 'Глюкоза натощак + HbA1c; IGF-1 каждые 6-8 нед', reason: 'Метаболический контроль GH', target: 'HbA1c<5.7%', drug: 'gh' });
  }
  if (flags.hasT3 || flags.hasT4) {
    week4.push({ marker: 'ТТГ, своб.T3/T4, кальций/PTH/вит.D', reason: 'Костная защита и щитовидная ось', drug: 't3' });
  }
  add('week4', 'Через 4 недели', 'каждые 4 нед', '🩸', week4);
  }

  if (phase !== 'pct') {
  const week8: MonitoringItemLine[] = [];
  week8.push({ marker: 'ОАК + БХ + липидограмма, E2, PRL, ТТГ', reason: 'Полный пересмотр на курсе', target: 'LDL<3.0, HDL>1.0, ТГ<1.7' });
  week8.push({ marker: 'УЗИ печени (при ААС), D-димер (при HCT>52%)', reason: 'Органный контроль', escalation: 'D-димер>0.5 — срочная оценка тромботического риска' });
  week8.push({ marker: 'Повтор полного набора (ОАК+БХ+липиды+гормоны)', reason: 'Длительные курсы — каждые 12 нед' });
  if (phase === 'bridge') {
    week8.push({ marker: 'Липиды, ОАК, АЛТ/АСТ, АД/ЧСС', reason: 'Контроль моста (каждые 6 нед)' });
  }
  if (phase === 'fertility') {
    week8.push({ marker: 'Спермограмма + LH/FSH/TT/E2/PRL', reason: 'Динамика фертильности (каждые 6-8 нед)' });
  }
  if (phase === 'trt') {
    week8.push({ marker: 'ОАК/HCT, PSA, E2, TT/FT/SHBG, липиды, АД', reason: 'Стабильный TRT-контроль (каждые 8-12 нед)' });
  }
  add('week8', 'Через 8 недель', 'каждые 8 нед', '🩺', week8);
  }

  if (phase !== 'pct') {
  const week12: MonitoringItemLine[] = [];
  week12.push({ marker: 'Полный набор: ОАК+БХ+липиды, E2/PRL/ТТГ, глюкоза/HbA1c, креатинин/eGFR, HCT/ферритин', reason: 'Длительные курсы (>8 нед) — полный пересмотр', target: 'как на 8 нед' });
  week12.push({ marker: 'УЗИ печени и предстательной железы, ЭКГ', reason: 'Органный контроль длительных курсов', escalation: 'Отклонения — профильный врач' });
  if (phase === 'bridge') {
    week12.push({ marker: 'Липиды, ОАК, АЛТ/АСТ, АД/ЧСС', reason: 'Контроль моста (каждые 6 нед)' });
  }
  add('week12', 'Через 12 недель', 'длительные курсы >8 нед', '🗓', week12);
  }

  const post: MonitoringItemLine[] = [];
  if (phase === 'pct') {
    post.push({ marker: 'LH, FSH, TT, E2, PRL', reason: 'Нед 2 после отмены — старт восстановления HPTA', drug: 'pct' });
    post.push({ marker: 'LH, FSH, TT, E2', reason: 'Нед 6 после отмены — динамика', escalation: 'Не восстановление >6 нед (LH/FSH <50% нормы) — эндокринолог' });
    post.push({ marker: 'Липиды, ОАК, АЛТ/АСТ, HCT', reason: 'Контроль после курса' });
  } else {
    post.push({ marker: 'Липиды, ОАК, АЛТ/АСТ, HCT', reason: 'Контроль после курса', target: 'HCT<50%, АЛТ<40' });
    post.push({ marker: 'LH/FSH/TT/E2/PRL — через 8-12 нед после отмены', reason: 'Проверка восстановления HPTA', escalation: 'Не восстановилось — эндокринолог' });
  }
  add('post', 'После курса (ПКТ/выход)', 'нед 2 и 6 после отмены', '🎯', post);

  const urgent: MonitoringItemLine[] = [];
  urgent.push({ marker: 'Боль в груди, одышка, тахикардия >100, АД >160/100', reason: 'Кардио-симптомы на фоне PED', escalation: 'STOP AAS + срочный врач' });
  urgent.push({ marker: 'Желтуха, отёки, гинекомастия, головная боль', reason: 'Симптомы печень/объём/гормоны', escalation: 'БХ + врач' });
  urgent.push({ marker: 'D-димер >0.5 или симптомы ТГВ/ТЭЛА (боль/отёк одной ноги)', reason: 'Тромботический риск', escalation: 'Срочная медицинская оценка; антикоагулянт ТОЛЬКО по назначению' });
  urgent.push({ marker: 'Температура >38.5°C, покраснение/абсцесс в месте инъекции', reason: 'Инфекция места инъекции', escalation: 'Срочно врач — абсцесс требует дренирования' });
  urgent.push({ marker: 'Судороги, потеря сознания, нарушение зрения', reason: 'Гипервязкость/неврология', escalation: 'Экстренная госпитализация' });
  if (flags.hasOral17) {
    urgent.push({ marker: 'ALT >2×ULN', reason: 'Гепатотоксичность оралов', escalation: 'Снизить/отменить орал, врач' });
  }
  add('urgent', 'Экстренно при симптомах', 'немедленно', '🚨', urgent);

  return sections;
}

// ──────────────────────────────────────────────────────────────────
//  СИМПТОМ-ЗАВИСИМЫЕ ПРЕПАРАТЫ (работают БЕЗ PED — отдельная функция)
//  Вызывается из buildRecommendation, а не из computeProtocol,
//  т.к. computeProtocol имеет early return при peds.length === 0.
// ──────────────────────────────────────────────────────────────────
function computeSymptomDrugs(ctx: MapperCtx): PhaseAssignedDrug[] {
  const symptoms = ctx.symptoms || [];
  if (symptoms.length === 0) return [];
  const result: PhaseAssignedDrug[] = [];
  const seen = new Set<string>();
  const add = (id: string, reason: string, trigger: string, category: TzCategory) => {
    const key = id.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ substanceId: id, reason, trigger, category });
  };
  if (symptoms.includes('gynecomastia')) {
    add('tamoxifen', 'Tamoxifen 20 мг — ⚠ ТОЛЬКО ПРИ ГИНО (симптом: гинекомастия)', 'Симптом: гино', 'pharma');
  }
  if (symptoms.includes('prostate_symptoms')) {
    add('saw_palmetto', 'Saw Palmetto 320 мг — ⚠ ДГПЖ симптомы (частое мочеиспускание, слабая струя)', 'Симптом: простата', 'pharma');
  }
  if (symptoms.includes('insomnia')) {
    add('melatonin', 'Melatonin 0.3-1 мг — сон (симптом: бессонница)', 'Симптом: сон', 'other');
    add('glycine', 'Glycine 3 г — сон (симптом: бессонница)', 'Симптом: сон', 'amino');
  }
  if (symptoms.includes('anxiety')) {
    add('theanine', 'L-Theanine 200 мг — ↓ тревога (симптом: тревога/раздражительность)', 'Симптом: тревога', 'amino');
  }
  if (symptoms.includes('hair_loss')) {
    add('saw_palmetto', 'Saw Palmetto 320 мг — 5α-редуктаза (симптом: облысение)', 'Симптом: волосы', 'pharma');
  }
  if (symptoms.includes('low_libido')) {
    add('tadalafil', 'Tadalafil 5-10 мг — либидо (симптом: ↓ либидо, on-demand 10 мг)', 'Симптом: либидо', 'pharma');
  }
  // ── Отёки ──
  // НЕ спиронолактон ( блокатор AR + 5α-R + CYP17 — конфликт с AAS)
  // 1-я линия: тиазидный диуретик (гидрохлоротиазид или индапамид)
  // 2-я линия: фуросемид (коротко, при тяжёлых)
  // + K+ восполнение (тиазиды/индапамид вымывают калий)
  // + натуральная поддержка (dandelion, hesperidin+diosmin)
  if (symptoms.includes('edema_severe')) {
    add('hydrochlorothiazide', 'Гидрохлоротиазид 12.5-25 мг/утро — ⚠ через врача (отёки, ↓объём циркуляции, мониторинг K+/Na+ каждые 2 нед)', 'Симптом: отёки', 'pharma');
    add('potassium', 'Kалий 200 мг — ⚠ восполнение на диуретике (тиазид → гипокалиемия)', 'Симптом: отёки (K+)', 'mineral');
    add('dandelion', 'Dandelion 500 мг 2р/день — натуральный диуретик (↓задержка воды, ↑Na+ экскреция)', 'Симптом: отёки (натур.)', 'other');
    add('hesperidin', 'Hesperidin 500 + Diosmin 450 — венотоник (↓капиллярная проницаемость, отёки ног)', 'Симптом: отёки (венотоник)', 'cardioprotector');
  }
  // ── Суставные боли ──
  if (symptoms.includes('joint_pain')) {
    add('glucosamine', 'Glucosamine 1500 мг + Chondroitin 800 мг — хондропротекция (симптом: боль в суставах)', 'Симптом: суставы', 'other');
    add('omega3', 'Omega-3 2-3 г — ↓ воспаление суставов (симптом: боль в суставах)', 'Симптом: суставы', 'cardioprotector');
    add('curcumin', 'Curcumin 1000 мг + Piperine 10 мг — ↓ воспаление (симптом: боль в суставах)', 'Симптом: суставы', 'antiinflam');
  }
  // ── Головная боль ──
  if (symptoms.includes('headache')) {
    add('magnesium', 'Magnesium 400-600 мг — ↓ головная боль (симптом: головная боль, спазм сосудов)', 'Симптом: головная боль', 'mineral');
    add('coq10', 'CoQ10 100 мг — ↓ мигрень (симптом: головная боль)', 'Симптом: головная боль', 'cardioprotector');
  }
  // ── Сердцебиение ──
  if (symptoms.includes('palpitations')) {
    add('magnesium', 'Magnesium 600 мг — ↓ аритмия (симптом: сердцебиение)', 'Симптом: сердцебиение', 'mineral');
    add('potassium', 'Kалий 200 мг — ↓ аритмия (симптом: сердцебиение, мониторинг K+)', 'Симптом: сердцебиение', 'mineral');
    add('taurine', 'Taurine 3 г — стабилизация мембран кардиомиоцитов (симптом: сердцебиение)', 'Симптом: сердцебиение', 'amino');
  }
  // ── Акне ──
  if (symptoms.includes('acne')) {
    add('zinc', 'Zinc 30 мг — ↓ себорегуляция (симптом: акне)', 'Симптом: акне', 'mineral');
    add('saw_palmetto', 'Saw Palmetto 320 мг — 5α-редуктаза (симптом: акне, DHT-зависимое)', 'Симптом: акне', 'pharma');
  }
  // ── Перепады настроения ──
  if (symptoms.includes('mood_swings')) {
    add('theanine', 'L-Theanine 200 мг — ↓ тревожность (симптом: перепады настроения)', 'Симптом: настроение', 'amino');
    add('ashwagandha', 'Ashwagandha 300-600 мг — ↓ кортизол (симптом: перепады настроения, стресс)', 'Симптом: настроение', 'adaptogen');
    add('omega3', 'Omega-3 2-3 г — ↓ нейровоспаление (симптом: перепады настроения)', 'Симптом: настроение', 'cardioprotector');
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
  const protocolWarnings = computeProtocolWarnings(protocolIds, pedFlags);
  const monitoringPlan = buildMonitoringPlan(ctx, pedFlags, phase);
  const monitoringSchedule = buildMonitoringSchedule(ctx, pedFlags, phase, protocolIds);
  const subs: RecommendedSub[] = [];
  const phaseDrugs: PhaseAssignedDrug[] = [];
  for (const pd of protocolAll) {
    subs.push({ substanceId: pd.substanceId, category: pd.category, k: 0.5, q: 'A', reason: pd.reason, mechsCovered: [], priority: 1 });
    phaseDrugs.push(pd);
  }
  // ── 3a. симптом-зависимые препараты (работают БЕЗ PED) ─
  const symptomDrugs = computeSymptomDrugs(ctx);
  for (const sd of symptomDrugs) {
    if (subs.some(s => canonId(s.substanceId) === canonId(sd.substanceId))) continue;
    subs.push({ substanceId: sd.substanceId, category: sd.category, k: 0.5, q: 'A', reason: sd.reason, mechsCovered: [], priority: 1 });
    phaseDrugs.push(sd);
  }
  // ── 4. gap-filling — ТОЛЬКО если протокол пустой (нет AAS) ─
  let suppression: SuppressedSub[] = [];
  if (protocolAll.length === 0) {
    const { subs: mechSubs, suppression: supp } = selectSubstances(activated, phase, ctx.level, ctx.manualChoices);
    for (const s of mechSubs) { if (!subs.some(x => canonId(x.substanceId) === canonId(s.substanceId))) subs.push(s); }
    suppression = supp;
  }
  // ── 4a. BUGFIX: manual subs — добавить даже при непустом протоколе (AAS) ─
  // selectSubstances (шаг 4) вызывается только если protocolAll пуст. При наличии
  // AAS protocolAll непустой → manualChoices.addSubs никогда не доходили. Добавляем отдельно.
  if (ctx.level === 'manual' && ctx.manualChoices?.addSubs && protocolAll.length > 0) {
    for (const sid of ctx.manualChoices.addSubs) {
      const canon = canonId(sid);
      if (subs.some(s => canonId(s.substanceId) === canon)) continue;
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
    }
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
  // ── 4. бустеры (ДО guardrails — чтобы guardrails/interactions покрывали booster subs) ─
  let boosters: AppliedBooster[] = [];
  if (areBoostersAllowed(phase) && ctx.boosterCtx) {
    boosters = applyBoosters(subs.map(s => s.substanceId), ctx.boosterCtx, subs.map(s => s.substanceId));
    // BUGFIX: merge booster subs into main subs list (раньше были только в boosters field, невидимы в UI)
    for (const ab of boosters) {
      for (const bs of ab.subs) {
        if (subs.some(s => s.substanceId.toLowerCase() === bs.substanceId.toLowerCase())) continue;
        subs.push({
          substanceId: bs.substanceId,
          category: 'other' as TzCategory,
          k: 0.5,
          q: 'B',
          reason: `[БУСТЕР ${ab.label}${ab.tier ? ` LV${ab.tier}` : ''}] ${bs.reason}`,
          mechsCovered: [],
          // tier≥2 (PED-risk/symptom) → priority 2 (выживает при TOTAL_LIMIT trim)
          // tier<2 или stack → priority 3 (отсекается первым) / 1 (stack)
          priority: ab.key === 'stack' ? 1 : ((ab.tier ?? 0) >= 2 ? 2 : 3),
        });
      }
    }
  }
  // ── 4a. Пользовательские добавки/удаления (попап) — финальное применение ─
  // Применяем ПОСЛЕ всей сборки (протокол/симптомы/витамины/лабы/синергии/
  // бустеры), чтобы guardrails, конфликты, покрытие и риск пересчитывались
  // по итоговому составу — это полноценный пересчёт вместо локального merge.
  const manualAddIds = ctx.manualChoices?.addSubs || [];
  const manualRemoveSet = new Set((ctx.manualChoices?.removeSubs || []).map(s => s.toLowerCase()));
  if (manualAddIds.length > 0) {
    for (const sid of manualAddIds) {
      const canon = canonId(sid);
      if (manualRemoveSet.has(sid.toLowerCase()) || manualRemoveSet.has(canon)) continue;
      if (subs.some(s => canonId(s.substanceId) === canon)) continue;
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
        substanceId: canon,
        category: bestCat,
        k: bestK || 0.5,
        q: bestQ,
        reason: 'Добавлено пользователем (попап)',
        mechsCovered,
        triggeredByMech: triggeredBy,
        priority: 1,
      });
    }
  }
  if (manualRemoveSet.size > 0) {
    for (let i = subs.length - 1; i >= 0; i--) {
      const id = subs[i].substanceId;
      if (manualRemoveSet.has(id.toLowerCase()) || manualRemoveSet.has(canonId(id))) {
        suppression.push({ substanceId: id, category: subs[i].category, reason: 'Исключено пользователем (попап)' });
        subs.splice(i, 1);
      }
    }
  }
  // ── 5. guardrails (теперь покрывают ВСЕ subs, включая booster и manual) ─
  const gCtx = buildGuardrailCtx(ctx);
  gCtx.hasTBooster = subs.some(s => isTBoosterById(s.substanceId));
  const guardrails = screenGuardrails(subs.map(s => s.substanceId), gCtx);
  // ── 6. pair conflicts ─
  const conflicts = screenPairConflicts(subs.map(s => s.substanceId));
  // ── 6a. Guardrail block: удалить subs с level='block' из плана ─
  const blockGuardrailIds = new Set(
    guardrails.filter(g => g.level === 'block' && g.substanceId).map(g => g.substanceId!.toLowerCase())
  );
  if (blockGuardrailIds.size > 0) {
    for (let i = subs.length - 1; i >= 0; i--) {
      if (blockGuardrailIds.has(subs[i].substanceId.toLowerCase())) {
        subs.splice(i, 1);
      }
    }
  }
  // ── 7. coverage (передаём activated для фильтрации gaps) ─
  const { coverage, gaps } = buildCoverageMatrix(subs, activated);
  // ── 8. summary ─
  let summary = buildSummary(subs, activated, phase, phaseProto, ctx.level, coverage, gaps, guardrails, boosters, suppression);
  // Добавить PED-risk reasons в summary (для UI-баннера)
  if (ctx.boosterCtx?.pedRiskReasons?.length) {
    summary += ` ⚠ PED-риск: ${ctx.boosterCtx.pedRiskReasons.join('; ')}.`;
  }
  const rationale = phaseProto.algorithm;
  const procedures = buildProcedureRecommendations(ctx);
  const assayWarnings = buildAssayWarnings(subs.map(s => s.substanceId), ctx);

  // Если каберголин фактически назначен (lab-gated по PRL), убираем
  // противоречащее предупреждение «НЕ НАЗНАЧЕН».
  const cabergolineAssigned = subs.some(s => canonId(s.substanceId) === 'cabergoline');
  const finalProtocolWarnings = cabergolineAssigned
    ? protocolWarnings.filter(w => !w.includes('КАБЕРГОЛИН НЕ НАЗНАЧЕН'))
    : protocolWarnings;

  // ── Bleeding-риск: фибринолитики/антиагреганты/антикоагулянты в плане ─
  // Фибринолитическая синергия (натто+серра+бромелайн) полезна, но при
  // дополнительных антиагрегантах даёт аддитивный риск кровотечения.
  const FIBRINOLYTIC_IDS = new Set([
    'nattokinase', 'serrapeptase', 'bromelain', 'lumbrokinase',
    'aspirin', 'dipyridamole', 'pentoxifylline', 'warfarin', 'enoxaparin',
    'sulodexide', 'ginkgo', 'garlic',
  ]);
  const bleedingSubs = Array.from(new Set(
    subs.map(s => canonId(s.substanceId)).filter(id => FIBRINOLYTIC_IDS.has(id))
  ));
  const bleedingRisk = bleedingSubs.length >= 2
    ? (bleedingSubs.length >= 3 ? 'high' : 'medium')
    : 'low';
  if (bleedingRisk !== 'low') {
    finalProtocolWarnings.push(
      `🩸 Фибринолитическая/антиагрегантная нагрузка (${bleedingSubs.join(' + ')}): суммарный риск кровотечения ${bleedingRisk === 'high' ? 'ВЫСОКИЙ' : 'повышен'}. Сообщить врачу перед операцией/инвазивными процедурами; не добавлять дополнительные антикоагулянты самостоятельно.`
    );
  }

  // ── Отсеивание block-конфликтов ПЕРЕД возвратом ──
  const blockPairs = checkInteractions(subs.map(s => s.substanceId)).filter(i => i.severity === 'block');
  if (blockPairs.length > 0) {
    for (const intr of blockPairs) {
      const aIdx = subs.findIndex(s => s.substanceId.toLowerCase() === intr.a.toLowerCase());
      const bIdx = subs.findIndex(s => s.substanceId.toLowerCase() === intr.b.toLowerCase());
      if (aIdx >= 0 && bIdx >= 0) {
        const aPrio = subs[aIdx].priority ?? 3;
        const bPrio = subs[bIdx].priority ?? 3;
        const victim = aPrio <= bPrio ? aIdx : bIdx;
        const survivor = aPrio <= bPrio ? bIdx : aIdx;
        finalProtocolWarnings.push(
          `⛔ Блок-конфликт: ${subs[victim].substanceId} исключён из плана — несовместим с ${subs[survivor].substanceId}: ${intr.reason} (${intr.action})`
        );
        subs.splice(victim, 1);
      }
    }
  }

  // ── TOTAL_LIMIT: trim по priority для non-manual уровней ─
  // Протокол (priority 1) всегда остаётся; base vits (2), boosters (3), manual (4) — обрезаются
  if (ctx.level !== 'manual') {
    const limit = TOTAL_LIMIT[ctx.level];
    if (subs.length > limit) {
      subs.sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3));
      subs.length = limit;
    }
  }

  // ── POST-TRIM SAFETY NET: на «Максимум» — обязательная нейро/суставная защита ──
  // Даже если trim срезал все priority-2/3 нейро/суставные вещества,
  // добавляем базовые 3+3 с priority=1 (не отсекаются).
  // Фаза фертильности (allowBoosters=false) пропускается.
  if (ctx.level === 'max' && areBoostersAllowed(phase)) {
    const neuroIds = new Set(NEURO_BOOST.subs.map(s => s.substanceId.toLowerCase()));
    const jointIds = new Set(JOINTS_BOOST.subs.map(s => s.substanceId.toLowerCase()));
    // Нейрозащита
    if (!subs.some(s => neuroIds.has(s.substanceId.toLowerCase()))) {
      for (const id of ['magnesium','ashwagandha','l_theanine']) {
        if (subs.some(s => canonId(s.substanceId) === canonId(id))) continue;
        subs.push({
          substanceId: id, category: 'neuroprotector' as TzCategory,
          k: 0.5, q: 'B' as const,
          reason: '[МАКС: обязательная нейрозащита]', mechsCovered: [],
          priority: 1,
        });
      }
    }
    // Суставы
    if (!subs.some(s => jointIds.has(s.substanceId.toLowerCase()))) {
      for (const id of ['collagen','glucosamine','msm']) {
        if (subs.some(s => canonId(s.substanceId) === canonId(id))) continue;
        subs.push({
          substanceId: id, category: 'amino' as TzCategory,
          k: 0.5, q: 'B' as const,
          reason: '[МАКС: обязательная защита суставов]', mechsCovered: [],
          priority: 1,
        });
      }
    }
    // Гемато (эритроцитоз/антиагрегант) — фибринолитическое трио
    const hematoIds = new Set(HEMATO_BOOST.subs.map(s => s.substanceId.toLowerCase()));
    if (!subs.some(s => hematoIds.has(s.substanceId.toLowerCase()))) {
      for (const id of ['nattokinase','serrapeptase','bromelain']) {
        if (subs.some(s => canonId(s.substanceId) === canonId(id))) continue;
        subs.push({
          substanceId: id, category: 'enzyme' as TzCategory,
          k: 0.5, q: 'C' as const,
          reason: '[МАКС: обязательная фибринолитическая защита]', mechsCovered: [],
          priority: 1,
        });
      }
    }
  }

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
    protocolWarnings: finalProtocolWarnings,
    procedures,
    assayWarnings,
    monitoringPlan,
    monitoringSchedule,
    supportRisks: buildSupportRisks(subs),
    pedRisk: ctx.pedRisk,
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
  const pedKey = (ctx.pedDoses||[]).map(p=>`${p.id}:${p.pClass}:${p.mgPerWeek||p.iuPerDay||p.mcgPerDay||0}`).join(',');
  const symKey = (ctx.symptoms||[]).join(',');
  return `${ctx.level}|${labsKey}|${phaseKey}|${boostKey}|${JSON.stringify(ctx.manualChoices||{})}|${ctx.onCourse||''}|${ctx.e2Level||''}|${ctx.hasHCG||''}|${ctx.hasAI||''}|${ctx.hasCabergoline||''}|${(ctx.aasIds||[]).join(',')}|${pedKey}|${symKey}`;
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
