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
export type UnifiedSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface UnifiedInteraction {
  source: 'support_db' | 'drug_interactions' | 'pharma_rules';
  a: string;
  b: string;
  type: 'synergy' | 'conflict' | 'caution' | 'danger' | 'block' | 'warn' | 'monitor' | 'info';
  severity: UnifiedSeverity;
  effect: string;
  mechanism: string;
  recommendation: string;
  raw: any; // оригинальный объект из источника
}

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

// ─── Source 1: support_db (БАД-БАД / БАД-drug) ───
function extractSupportDb(substanceIds: string[]): SupportInteraction[] {
  if (!substanceIds?.length) return [];
  const norm = new Set(substanceIds.map(s => resolveInteractionId(s)));
  const out: SupportInteraction[] = [];
  for (const i of INTERACTIONS_DB) {
    const a = resolveInteractionId(i.substanceA);
    const b = resolveInteractionId(i.substanceB);
    if (norm.has(a) && norm.has(b)) out.push(i);
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
      raw: d,
    });
  }

  for (const p of pharma) {
    // Для pharma_rules: effect = краткая суть (например, "Тяжёлая гипогликемия"),
    // recommendation = действие ("Контроль глюкозы каждые 2ч").
    // Извлекаем первое предложение mechanism как краткую суть.
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

// Старый формат findInteractionsForSubstance (support-substances)
export function findInteractionsForSubstance(id: string): SupportInteraction[] {
  return INTERACTIONS_DB.filter(e => resolveInteractionId(e.substanceA) === resolveInteractionId(id) || resolveInteractionId(e.substanceB) === resolveInteractionId(id));
}

export function findSynergies(id: string): SupportInteraction[] {
  return findInteractionsForSubstance(id).filter(i => i.type === 'synergy');
}

export function findConflicts(id: string): SupportInteraction[] {
  return findInteractionsForSubstance(id).filter(i => i.type === 'conflict' || i.type === 'caution');
}
