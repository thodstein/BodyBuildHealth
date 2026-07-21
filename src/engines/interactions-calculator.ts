// ════════════════════════════════════════════════════════════════════════════
//  InteractionsCalculator — ЕДИНЫЙ КАЛЬКУЛЯТОР ВЗАИМОДЕЙСТВИЙ
// ════════════════════════════════════════════════════════════════════════════
//  Объединяет 3 источника:
//    1. INTERACTIONS_DB (support-interactions-db) — БАД-БАД / БАД-лекарство
//    2. DRUG_INTERACTIONS (drug-interactions) — фарма-блокировки + class-based
//    3. checkDrugInteractions (pharma-interactions.engine) — 22 AAS/PED правила
//
//  Единое API: `calculateInteractions({ substances, course })` →
//  возвращает UnifiedResult с общим скорингом + секционированные данные по источнику.
//
//  Все старые точки вызова сохранены через re-export ниже —
//  изменений в UI НЕТ, движок работает прозрачно.
// ════════════════════════════════════════════════════════════════════════════

import { INTERACTIONS_DB, resolveInteractionId } from '../data/support-interactions-db';
import { DRUG_INTERACTIONS, checkInteractions as checkDrugList } from '../data/drug-interactions';
import { checkDrugInteractions, getDrugDrugConflicts, getClassInstructions, getCourseRecommendations, type InteractionAlert, type DrugDrugConflict, type ClassInstruction, type CourseRecommendation } from './pharma-interactions.engine';
import type { InteractionEntry } from '../core/types';
import type { CourseEntry } from '../core/types';
import type { Interaction as SupportInteraction, SeverityLevel, InteractionType } from '../data/support-interactions-db';
import type { DrugInteraction } from '../data/drug-interactions';
import type { UnifiedSeverity, UnifiedInteraction, TimingInfo, InteractionSource, InteractionType, Locale } from '../data/interactions-types';

export type { UnifiedSeverity, UnifiedInteraction, TimingInfo, InteractionSource, InteractionType, Locale };

// ─── Re-exports для обратной совместимости ───
export {
  checkDrugInteractions,
  getDrugDrugConflicts,
  getClassInstructions,
  getCourseRecommendations,
  INTERACTIONS_DB,
  resolveInteractionId,
  DRUG_INTERACTIONS,
  checkDrugList as checkInteractions,
  checkDrugList,
};
export type { InteractionAlert, DrugDrugConflict, ClassInstruction, CourseRecommendation, DrugInteraction };

// ─── Unified result shape ───
// Типы UnifiedSeverity, UnifiedInteraction, TimingInfo вынесены в ../data/interactions-types
// (re-export выше для обратной совместимости)

export interface UnifiedResult {
  // 0-100, где 100 = безопасно, 0 = заблокировано
  score: number;
  blocked: boolean;

  // Секционированные данные по источникам
  bySource: {
    supportDb: SupportInteraction[];
    drugInteractions: DrugInteraction[];
    pharmaRules: InteractionAlert[];
  };

  // Объединённые взаимодействия с нормализованной формой
  all: UnifiedInteraction[];

  // Сгруппированные по severity
  bySeverity: Record<UnifiedSeverity, UnifiedInteraction[]>;

  // Краткие счётчики для UI
  counts: {
    synergies: number;
    conflicts: number;
    blocks: number;
    warnings: number;
    monitor: number;
    info: number;
  };
}

export interface CalculateInput {
  /** Свободный список ID веществ (БАДы, витамины, минералы) */
  substances?: string[];
  /** Курс фармы (AAS, GH, insulin, SARM...) — опционально */
  course?: CourseEntry[];
}

// ─── Severity normalization ───
function toUnifiedSeverity(
  source: UnifiedInteraction['source'],
  rawType: string,
  rawSev: string | number | undefined
): UnifiedSeverity {
  if (source === 'pharma_rules') {
    const t = String(rawType);
    if (t === 'critical') return 'CRITICAL';
    if (t === 'warning') return 'HIGH';
    return 'INFO';
  }
  if (source === 'drug_interactions') {
    const s = String(rawSev);
    if (s === 'block') return 'CRITICAL';
    if (s === 'warn') return 'HIGH';
    if (s === 'monitor') return 'MEDIUM';
    return 'LOW';
  }
  // support_db: severity 'LOW' | 'MEDIUM' | 'HIGH', type synergy/conflict/caution
  const sev = String(rawSev || 'LOW').toUpperCase();
  if (sev === 'HIGH') return 'HIGH';
  if (sev === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

// ─── Precomputed индекс INTERACTIONS_DB: resolvedId → Interaction[] ───
// O(1) lookup вместо O(N) перебора. Строится лениво при первом обращении.
let _interactionsIndex: Map<string, SupportInteraction[]> | null = null;

function buildInteractionsIndex(): Map<string, SupportInteraction[]> {
  if (_interactionsIndex) return _interactionsIndex;
  const idx = new Map<string, SupportInteraction[]>();
  for (const i of INTERACTIONS_DB) {
    const a = resolveInteractionId(i.substanceA);
    const b = resolveInteractionId(i.substanceB);
    if (!idx.has(a)) idx.set(a, []);
    if (!idx.has(b)) idx.set(b, []);
    idx.get(a)!.push(i);
    idx.get(b)!.push(i);
  }
  _interactionsIndex = idx;
  return idx;
}

// ─── Source 1: support_db (БАД-БАД / БАД-drug) ───
function extractSupportDb(substanceIds: string[]): SupportInteraction[] {
  if (!substanceIds?.length) return [];
  const idx = buildInteractionsIndex();
  const seen = new Set<string>();
  const out: SupportInteraction[] = [];
  for (const raw of substanceIds) {
    const resolved = resolveInteractionId(raw);
    const candidates = idx.get(resolved);
    if (!candidates) continue;
    for (const i of candidates) {
      if (seen.has(i.id)) continue;
      seen.add(i.id);
      out.push(i);
    }
  }
  return out;
}

// ─── Source 2: drug-interactions (class-based) ───
function extractDrugInteractions(substanceIds: string[]): DrugInteraction[] {
  if (!substanceIds?.length) return [];
  return checkDrugList(substanceIds);
}

// ─── Source 3: pharma rules (22 AAS/PED rules) ───
function extractPharmaRules(course?: CourseEntry[]): InteractionAlert[] {
  if (!course?.length) return [];
  return checkDrugInteractions(course);
}

// ─── Timing extraction из текста recommendation/notes ───
// Извлекает: intervalHours, withFood, timeOfDay, monitoringPeriod, durationDays
//
// Телеметрия: глобальные счётчики для отслеживания эффективности regex
let _timingTotal = 0;
let _timingMatched = 0;
let _timingLastReport = 0;

export function getTimingTelemetry(): { total: number; matched: number; missRate: number; reset: () => void } {
  return {
    total: _timingTotal,
    matched: _timingMatched,
    missRate: _timingTotal > 0 ? 1 - _timingMatched / _timingTotal : 0,
    reset: () => { _timingTotal = 0; _timingMatched = 0; },
  };
}

export function extractTiming(text: string): TimingInfo | undefined {
  if (!text) return undefined;
  _timingTotal++;
  const t: TimingInfo = {};

  // Интервал между приёмами: "Интервал ≥ 2ч", "разнести на 4+ ч", "STOP за 48 ч"
  // Unicode флаг 'u' обязателен для кириллицы; 'i' для регистра
  const intervalMatch = text.match(/(?:интервал\w*\s*[≥>=]*\s*|разнест\w*\s*на\s*|за\s*|stop\s*за\s*|пауза\s*)(\d+)\s*ч/iu);
  if (intervalMatch) {
    t.intervalHours = parseInt(intervalMatch[1], 10);
  }

  const lower = text.toLowerCase();

  // ── Режим приёма пищи ──
  if (/(натощак|fasting|empty stomach|на\s*пустой\s*желудок)/iu.test(lower)) t.withFood = 'fasting';
  else if (/(до\s*еды|за\s*\d+\s*мин\s*до\s*еды|before\s*meal|за\s*\d+\s*мин\s*до\s*приема)/iu.test(lower)) t.withFood = 'before_meal';
  else if (/(с\s*жирн\w*\s*едой|с\s*едой|with\s*meal|with\s*food|во\s*время\s*еды|вместе\s*с\s*едой)/iu.test(lower)) t.withFood = 'with_meal';
  else if (/(после\s*еды|after\s*meal)/iu.test(lower)) t.withFood = 'after_meal';

  // ── Время суток (перед сном, утром, днём, вечером) ──
  if (/(перед\s*сном|at\s*bedtime|before\s*bed|вечером\s*перед\s*сном)/iu.test(lower)) t.timeOfDay = 'bedtime';
  else if (/(утром|утра|at\s*morning|in\s*the\s*morning)/iu.test(lower)) t.timeOfDay = 'morning';
  else if (/(днём|днем|afternoon|в\s*обед)/iu.test(lower)) t.timeOfDay = 'noon';
  else if (/(вечером|in\s*the\s*evening)/iu.test(lower)) t.timeOfDay = 'evening';

  // ── Мониторинг: "каждые 2 нед", "каждые 1-2 мес", "каждые 4 недели" ──
  const monMatch = text.match(/кажд(?:ые|ую|ые)?\s+(\d+(?:-\d+)?)\s+(нед|недел|мес|месяц|дн|день|дня|недели|месяца|месяцев)/iu);
  if (monMatch) {
    t.monitoringPeriod = `каждые ${monMatch[1]} ${monMatch[2]}`;
  }

  // ── Длительность приёма: "курс 8 нед", "принимать 4-6 нед" ──
  const durMatch = text.match(/(?:курс|принимать|приём|прием|длительность)\s+(\d+(?:-\d+)?)\s*(нед|недел|мес|месяц|дн|день|дня|недели|месяца|месяцев)/iu);
  if (durMatch) {
    t.durationDays = durMatch[1] + ' ' + durMatch[2];
  }

  if (Object.keys(t).length > 0) {
    _timingMatched++;
  }
  // Каждые 1000 вызовов — логировать в console (для dev-mode мониторинга)
  if (_timingTotal - _timingLastReport >= 1000) {
    const rate = _timingTotal > 0 ? (1 - _timingMatched / _timingTotal) * 100 : 0;
    if (typeof console !== 'undefined') {
      console.log(`[timing telemetry] ${_timingTotal} extracts, ${rate.toFixed(1)}% miss rate`);
    }
    _timingLastReport = _timingTotal;
  }
  return Object.keys(t).length > 0 ? t : undefined;
}

/**
 * Рендерит мини-бейдж телеметрии (для dev-mode panel).
 * Если missRate > 30% → рекомендует расширить regex.
 */
export function TimingTelemetryBadge(): { text: string; color: string; shouldImprove: boolean } {
  const t = getTimingTelemetry();
  const missRate = t.missRate * 100;
  const text = t.total === 0
    ? '⏰ Telemetry: нет данных'
    : `⏰ Timing: ${t.matched}/${t.total} (${missRate.toFixed(0)}% miss)`;
  return {
    text,
    color: missRate > 40 ? '#ef4444' : missRate > 25 ? '#f59e0b' : '#00e68a',
    shouldImprove: missRate > 30 && t.total >= 10,
  };
}

// ─── Severity weight table (для unified score) ───
const SEVERITY_PTS: Record<UnifiedSeverity, number> = {
  CRITICAL: 35,
  HIGH: 18,
  MEDIUM: 8,
  LOW: -3, // synergy / mild
  INFO: 0,  // нейтральная информация, score не штрафует
};
const SEVERITY_RANK: Record<UnifiedSeverity, number> = {
  CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1,
};

// ─── Unified score ───
function computeScore(items: UnifiedInteraction[]): { score: number; blocked: boolean } {
  let pts = 0;
  let blocked = false;
  for (const i of items) {
    pts += SEVERITY_PTS[i.severity] ?? 0;
    if (i.severity === 'CRITICAL' && (i.type === 'block' || i.type === 'danger')) blocked = true;
  }
  return { score: Math.max(0, Math.min(100, 100 - pts)), blocked };
}

// ─── Class-normalization: ANTICOAGULANTS ↔ @anticoagulant ↔ @ANTICOAGULANT ───
// Для дедупликации class-based и substance-based записей как одной пары.
const CLASS_TO_CANONICAL: Record<string, string> = {
  '@anticoagulant': 'CLASS_ANTICOAGULANT',
  '@anticoagulants': 'CLASS_ANTICOAGULANT',
  'anticoagulants': 'CLASS_ANTICOAGULANT',
  'anticoagulant': 'CLASS_ANTICOAGULANT',
  '@statin': 'CLASS_STATIN',
  '@raas': 'CLASS_RAAS',
  '@antidiabetic': 'CLASS_ANTIDIABETIC',
  '@macrolide': 'CLASS_MACROLIDE',
  '@cyp3a4_inhibitor': 'CLASS_CYP3A4_INHIBITOR',
  '@cyp3a4_substrate': 'CLASS_CYP3A4_SUBSTRATE',
  '@alpha_blocker': 'CLASS_ALPHA_BLOCKER',
  '@d2_antagonist': 'CLASS_D2_ANTAGONIST',
  '@alcohol': 'CLASS_ALCOHOL',
  '@nsaid': 'CLASS_NSAID',
  '@contrast': 'CLASS_CONTRAST',
  '@ssri': 'CLASS_SSRI',
  '@tetracycline': 'CLASS_TETRACYCLINE',
  '@levothyroxine': 'CLASS_LEVOTHYROXINE',
};

function normalizeForDedup(id: string): string {
  const resolved = resolveInteractionId(id);
  const cls = CLASS_TO_CANONICAL[resolved.toLowerCase()];
  return cls || resolved;
}

// ─── Dedup key: канонический sorted (a,b), class-aware ───
function dedupKey(a: string, b: string): string {
  const ra = normalizeForDedup(a);
  const rb = normalizeForDedup(b);
  return ra < rb ? `${ra}|${rb}` : `${rb}|${ra}`;
}

// ─── MAIN: единый вход ───
/**
 * Единый калькулятор взаимодействий для БАД, фармы и AAS/PED-курсов.
 *
 * @param input - { substances?: string[], course?: CourseEntry[] }
 *   - substances: ID БАДов/витаминов/минералов (например "CAFFEINE", "VITAMIN_K2")
 *   - course: Курс фармы (AAS, GH, инсулин, SARMs) с дозами и неделями
 *   Оба параметра опциональны. Если оба пустые → score=100, all=[]
 *
 * @returns UnifiedResult:
 *   - score: 0-100 (100 = безопасно, 0 = заблокировано)
 *   - blocked: true если есть CRITICAL block/danger
 *   - bySource: { supportDb, drugInteractions, pharmaRules } — секционированные данные
 *   - all: UnifiedInteraction[] — нормализованные взаимодействия (dedup по паре)
 *   - bySeverity: Record<CRITICAL|HIGH|MEDIUM|LOW|INFO, UnifiedInteraction[]>
 *   - counts: { synergies, conflicts, blocks, warnings, monitor, info }
 *
 * Severity шкала:
 *   CRITICAL (35 штрафа) → HIGH (18) → MEDIUM (8) → LOW (-3 бонус) → INFO (0)
 *
 * @example
 *   calculateInteractions({ substances: ['VITAMIN_K2', 'WARFARIN'] })
 *   // → score: 47, blocked: true, bySeverity.CRITICAL: [...]
 *
 *   calculateInteractions({ course: [
 *     { substanceId: 'test_enan', doseValue: 750, doseUnit: 'mg/wk', ... },
 *     { substanceId: 'tren_ace', doseValue: 350, doseUnit: 'mg/wk', ... },
 *   ]})
 *   // → score: 82, bySource.pharmaRules: [tren+test warning]
 */
export function calculateInteractions(input: CalculateInput): UnifiedResult {
  const subs = input.substances || [];
  const course = input.course;

  // 1. Сбор по источникам
  const support = extractSupportDb(subs);
  const drugList = extractDrugInteractions(subs);
  const pharma = extractPharmaRules(course);

  // 2. Унификация + дедупликация по (a,b): оставляем max severity, объединяем raw
  const dedupMap = new Map<string, UnifiedInteraction>();

  const addOrUpgrade = (item: UnifiedInteraction) => {
    const key = dedupKey(item.a, item.b);
    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, item);
      return;
    }
    // Если новая запись "сильнее" (выше rank) — заменяем
    if (SEVERITY_RANK[item.severity] > SEVERITY_RANK[existing.severity]) {
      // Сохраняем ссылку на предыдущий raw в массив (для UI)
      const prevRaw = Array.isArray((existing as any)._mergedRaw) ? (existing as any)._mergedRaw : [existing.raw];
      prevRaw.push(item.raw);
      (existing as any)._mergedRaw = prevRaw;
      dedupMap.set(key, { ...item, _mergedRaw: prevRaw } as any);
    } else {
      // Добавляем raw к существующему (для traceability)
      const merged = Array.isArray((existing as any)._mergedRaw) ? (existing as any)._mergedRaw : [existing.raw];
      merged.push(item.raw);
      (existing as any)._mergedRaw = merged;
    }
  };

  for (const s of support) {
    addOrUpgrade({
      source: 'support_db',
      a: s.substanceA,
      b: s.substanceB,
      type: s.type,
      severity: toUnifiedSeverity('support_db', s.type, s.severity),
      effect: s.effect,
      mechanism: (s.mechanisms || []).join('; '),
      recommendation: s.notes,
      timing: extractTiming(s.notes),
      raw: s,
    });
  }

  for (const d of drugList) {
    addOrUpgrade({
      source: 'drug_interactions',
      a: d.a,
      b: d.b,
      type: d.severity === 'block' ? 'block' : d.severity === 'warn' ? 'warn' : 'monitor',
      severity: toUnifiedSeverity('drug_interactions', '', d.severity),
      effect: d.reason,
      mechanism: '',
      recommendation: d.action,
      timing: extractTiming(d.action),
      raw: d,
    });
  }

  for (const p of pharma) {
    const effectShort = (p.mechanism || '').split(/[.!?]/)[0]?.trim() || p.recommendation;
    addOrUpgrade({
      source: 'pharma_rules',
      a: (p.drugs || [])[0] || '',
      b: (p.drugs || [])[1] || '',
      type: p.type === 'critical' ? 'danger' : p.type === 'warning' ? 'conflict' : 'info',
      severity: toUnifiedSeverity('pharma_rules', p.type, ''),
      effect: effectShort,
      mechanism: p.mechanism,
      recommendation: p.recommendation,
      timing: extractTiming(p.recommendation),
      raw: p,
    });
  }

  const all: UnifiedInteraction[] = Array.from(dedupMap.values());

  // 3. Группировка
  const bySeverity: Record<UnifiedSeverity, UnifiedInteraction[]> = {
    CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [], INFO: [],
  };
  for (const i of all) bySeverity[i.severity].push(i);

  // 4. Counts
  const counts = {
    synergies: all.filter(i => i.type === 'synergy').length,
    conflicts: all.filter(i => i.type === 'conflict' || i.type === 'danger').length,
    blocks: all.filter(i => i.type === 'block').length,
    warnings: all.filter(i => i.type === 'warn').length,
    monitor: all.filter(i => i.type === 'monitor').length,
    info: all.filter(i => i.type === 'info' || i.type === 'caution').length,
  };

  // 5. Score
  const { score, blocked } = computeScore(all);

  return {
    score,
    blocked,
    bySource: { supportDb: support, drugInteractions: drugList, pharmaRules: pharma },
    all,
    bySeverity,
    counts,
  };
}

// ─── Адаптеры для обратной совместимости со старыми API ───

// Сортировка: CRITICAL первыми → HIGH → MEDIUM → LOW → INFO
const SEVERITY_ORDER: Record<UnifiedSeverity, number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4,
};

/**
 * Сортирует массив unified items по severity (CRITICAL сверху) с опциональным фильтром.
 * @param items - результат calculateInteractions().all
 * @param options.onlyCritical - если true, оставить только CRITICAL
 * @param options.onlySeverity - фильтр по конкретному severity
 * @param options.maxSeverity - порог (показать <= maxSeverity, т.е. CRITICAL+HIGH при 'HIGH')
 * @param options.types - whitelist типов (например ['block', 'danger'] для показа только критичных)
 */
export interface FilterOptions {
  onlyCritical?: boolean;
  onlySeverity?: UnifiedSeverity;
  maxSeverity?: UnifiedSeverity;
  types?: UnifiedInteraction['type'][];
}

export function filterAndSortInteractions(
  items: UnifiedInteraction[],
  options: FilterOptions = {}
): UnifiedInteraction[] {
  let result = items;
  if (options.onlyCritical) result = result.filter(i => i.severity === 'CRITICAL');
  if (options.onlySeverity) result = result.filter(i => i.severity === options.onlySeverity);
  if (options.maxSeverity) {
    const max = SEVERITY_ORDER[options.maxSeverity];
    result = result.filter(i => SEVERITY_ORDER[i.severity] <= max);
  }
  if (options.types && options.types.length > 0) {
    const set = new Set(options.types);
    result = result.filter(i => set.has(i.type));
  }
  return [...result].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// Старый формат analyzeInteractions (interaction-checker.engine)

// Старый формат analyzeInteractions (interaction-checker.engine)
// Совместим со ВСЕМИ источниками: support_db + drug_interactions + pharma_rules.
export interface LegacyInteractionResult {
  score: number;
  conflicts: any[];
  synergies: any[];
  warnings: string[];
  blocked: boolean;
}

export function analyzeInteractions(substanceIds: string[]): LegacyInteractionResult {
  const r = calculateInteractions({ substances: substanceIds });
  return {
    score: r.score,
    // conflicts = всё "негативное" из всех источников (кроме synergy/info/monitor)
    conflicts: r.all.filter(i =>
      i.type === 'conflict' || i.type === 'caution' || i.type === 'danger'
      || i.type === 'block' || i.type === 'warn'
    ),
    synergies: r.all.filter(i => i.type === 'synergy'),
    warnings: r.all
      .filter(i => i.severity === 'HIGH' || i.severity === 'CRITICAL')
      .map(i => `${i.a} + ${i.b}: ${i.effect}`),
    blocked: r.blocked,
  };
}

// Старый формат findInteractionsForSubstance (support-substances) — O(1) через индекс
export function findInteractionsForSubstance(id: string): SupportInteraction[] {
  const idx = buildInteractionsIndex();
  const seen = new Set<string>();
  const out: SupportInteraction[] = [];
  const candidates = idx.get(resolveInteractionId(id));
  if (!candidates) return [];
  for (const i of candidates) {
    if (seen.has(i.id)) continue;
    seen.add(i.id);
    out.push(i);
  }
  return out;
}

export function findSynergies(id: string): SupportInteraction[] {
  return findInteractionsForSubstance(id).filter(i => i.type === 'synergy');
}

export function findConflicts(id: string): SupportInteraction[] {
  return findInteractionsForSubstance(id).filter(i => i.type === 'conflict' || i.type === 'caution');
}
