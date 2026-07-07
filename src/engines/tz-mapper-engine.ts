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
  libidoLow?: boolean;
  bpSystolic?: number;
  lipidLdl?: number;
}

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
  manualChoices?: { addSubs?: string[]; removeSubs?: string[]; explicitCategories?: TzCategory[] }
): { subs: RecommendedSub[]; suppression: SuppressedSub[] } {
  const phaseProto = getPhaseProtocol(phase);
  const limits = CATEGORY_LIMITS[level];
  const totalLimit = TOTAL_LIMIT[level];

  const usedSubs = new Set<string>();
  const subs: RecommendedSub[] = [];
  const suppression: SuppressedSub[] = [];
  const categoryCount = new Map<TzCategory, number>();
  for (const cat of Object.keys(limits) as TzCategory[]) categoryCount.set(cat, 0);

  // ───────────────────────────────────────────────────────────────────
  // 0. Ручной режим — добавки из explicit list
  // ───────────────────────────────────────────────────────────────────
  if (level === 'manual' && manualChoices?.addSubs) {
    for (const sid of manualChoices.addSubs) {
      if (usedSubs.has(sid.toLowerCase())) continue;
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
      usedSubs.add(sid.toLowerCase());
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
      if (usedSubs.has(cand.substanceId.toLowerCase())) continue;
      const cov = getMechs(cand.substanceId, activated);
      subs.push({
        substanceId: cand.substanceId,
        category: cat,
        k: cand.k,
        q: cand.q,
        reason: `Обязательная категория "${cat}" фазы "${phaseProto.label}"`,
        mechsCovered: cov,
      });
      usedSubs.add(cand.substanceId.toLowerCase());
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
      if (usedSubs.has(cand.substanceId.toLowerCase())) continue;

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
      usedSubs.add(cand.substanceId.toLowerCase());
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
      if (usedSubs.has(cand.substanceId.toLowerCase())) continue;

      const mechsCovered = getMechs(cand.substanceId, activated);
      subs.push({
        substanceId: cand.substanceId,
        category: cat,
        k: 0,
        q: 'C',
        reason: `Расширение broad-spectrum (покрывает ${cand.breadth} мехов)`,
        mechsCovered,
      });
      usedSubs.add(cand.substanceId.toLowerCase());
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
      if (usedSubs.has(cand.substanceId.toLowerCase())) continue;
      subs.push({
        substanceId: cand.substanceId,
        category: cat,
        k: cand.k,
        q: cand.q,
        reason: `Приоритет фазы: ${mechId}`,
        mechsCovered: [mechId, ...getMechs(cand.substanceId, activated)],
        triggeredByMech: mechId,
      });
      usedSubs.add(cand.substanceId.toLowerCase());
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
      if (usedSubs.has(cand.substanceId.toLowerCase())) continue;
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
function buildRecommendation(ctx: MapperCtx): SupportRecommendation {
  // ── 1. активировать мехи ─
  const activated = getActivatedTzMechs(ctx.labs);
  // ── 2. фаза ─
  const phase = detectPhase(ctx.phaseCtx);
  const phaseProto = getPhaseProtocol(phase);
  // ── 3. отбор ─
  const { subs, suppression } = selectSubstances(activated, phase, ctx.level, ctx.manualChoices);
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
  return `${ctx.level}|${labsKey}|${phaseKey}|${boostKey}|${JSON.stringify(ctx.manualChoices||{})}|${ctx.onCourse||''}|${ctx.e2Level||''}|${ctx.hasHCG||''}`;
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