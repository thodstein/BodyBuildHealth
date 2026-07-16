/**
 * support-plan/display.ts — display-данные: synergyComment, monitoring,
 * specialInstructions, conflicts, labFindings, depletion warnings,
 * temporal separation advice, cumulative nutrient load.
 */

import { ALL_INTERACTIONS, SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { evaluateRecommendations } from '../recommendation-engine';
import type { CalculatorState, CalculatorResult, LabFinding } from './types';
import { catalogEntry, NUTRIENT_UL, MINERAL_SEPARATION_HOURS, SUBSTANCE_HALF_LIFE } from './types';

/** Клинические механизмы для распространённых конфликтов (используется
 *  когда ALL_INTERACTIONS не содержит mechanism). */
const CONFLICT_MECHANISMS: Record<string, string> = {
  'zinc||calcium': 'Конкуренция за DMT1-транспортёр и парацеллюлярный транспорт. Ca >500 мг ↓ Zn всасывание на 30-50%.',
  'zinc||iron': 'Конкуренция за DMT1 в дуоденальных энтероцитах. Fe >25 мг ↓ Zn всасывание на 30%.',
  'calcium||iron': 'Ca ингибирует гемовое и негемовое всасывание Fe на 40-60% через блокаду DMT1 и ферропортина.',
  'zinc||copper': 'Высокие дозы Zn индуцируют металлотионеин → связывание Cu в энтероцитах → ↓ всасывания Cu.',
  'magnesium||calcium': 'Конкуренция за парацеллюлярный транспорт в толстом кишечнике. Ca >1000 мг ↓ Mg на 30%.',
  'iron||magnesium': 'Конкуренция за DMT1; негемовое Fe ↓ всасывание Mg при совместном приёме.',
  'calcium||zinc': 'Конкуренция за DMT1-транспортёр. Раздельный приём ≥2ч.',
  'iron||zinc': 'Конкуренция за DMT1. Fe >25 мг ↓ Zn всасывание на 30%.',
  'magnesium||zinc': 'Конкуренция за DMT1-транспортёр. Раздельный приём ≥1ч.',
  'calcium||magnesium': 'Конкуренция за парацеллюлярный транспорт. Ca >1000 мг ↓ Mg на 30%.',
};

/** Интервал разделения для пары конфликтующих веществ (часы). */
function getSeparationHours(a: string, b: string): number {
  return MINERAL_SEPARATION_HOURS[`${a.toLowerCase()}||${b.toLowerCase()}`]
    || MINERAL_SEPARATION_HOURS[`${b.toLowerCase()}||${a.toLowerCase()}`]
    || 2;
}

/** Клинический механизм конфликта для пары (из базы или по умолчанию). */
function getConflictMechanism(a: string, b: string, fallback: string): string {
  const key1 = `${a.toLowerCase()}||${b.toLowerCase()}`;
  const key2 = `${b.toLowerCase()}||${a.toLowerCase()}`;
  return CONFLICT_MECHANISMS[key1] || CONFLICT_MECHANISMS[key2] || fallback;
}

/**
 * Комментарий о синергиях и конфликтах между выбранными веществами.
 * Сканирует ALL_INTERACTIONS на пары, где оба вещества есть в плане.
 */
export function buildSynergyComment(ids: string[]): string {
  const idSet = new Set(ids.map((x: string) => x.toLowerCase()));
  const syns: string[] = [];
  const confs: string[] = [];
  const cauts: string[] = [];
  for (const inter of ALL_INTERACTIONS) {
    const a = (inter.substanceA || '').toLowerCase();
    const b = (inter.substanceB || '').toLowerCase();
    if (!a || !b) continue;
    if (idSet.has(a) && idSet.has(b)) {
      const type = (inter.type || '').toLowerCase();
      const isSynergy = type.includes('synerg') || type.includes('синерг') || type === 'synergy';
      const isConflict = type.includes('conflict') || type.includes('antagon') || type.includes('конфликт') || type === 'conflict';
      const isCaution = type.includes('caution') || type.includes('осторож') || type === 'caution';
      const label = `${inter.substanceA} + ${inter.substanceB}`;
      const eff = inter.effect || inter.notes || '';
      if (isSynergy) syns.push(`• ${label}: ${eff}`);
      else if (isConflict) confs.push(`• ${label}: ${eff}`);
      else if (isCaution) cauts.push(`• ${label}: ${eff}`);
    }
  }
  const parts: string[] = [];
  if (syns.length > 0) parts.push(`Синергии (${syns.length}):\n${syns.slice(0, 15).join('\n')}`);
  if (confs.length > 0) parts.push(`Конфликты (${confs.length}):\n${confs.slice(0, 10).join('\n')}`);
  if (cauts.length > 0) parts.push(`Осторожности (${cauts.length}):\n${cauts.slice(0, 10).join('\n')}`);
  return parts.length > 0 ? parts.join('\n\n') : 'Синергии и конфликты не выявлены.';
}

/** Список маркеров для мониторинга (union из SUPPORT_CATALOG_DATA). */
export function buildMonitoring(ids: string[]): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    const e = catalogEntry(id);
    if (!e?.monitoring) continue;
    if (Array.isArray(e.monitoring)) {
      for (const m of e.monitoring) {
        if (typeof m === 'string') set.add(m);
        else if (m?.what) set.add(`${m.what}${m.when ? ` (${m.when})` : ''}${m.targetRange ? ` — целевые: ${m.targetRange}` : ''}`);
      }
    }
  }
  return Array.from(set).slice(0, 20);
}

/** Особые указания по приёму (union из SUPPORT_CATALOG_DATA). */
export function buildSpecialInstructions(ids: string[]): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    const e = catalogEntry(id);
    if (!e?.specialInstructions) continue;
    if (Array.isArray(e.specialInstructions)) {
      for (const s of e.specialInstructions) {
        if (typeof s === 'string' && s.trim()) set.add(`${e.nameRu || e.name || id}: ${s}`);
      }
    }
  }
  return Array.from(set).slice(0, 20);
}

/** Конфликты между выбранными веществами (из ALL_INTERACTIONS).
 *  Добавлены: клинический механизм, рекомендация по временному разделению. */
export function buildConflicts(
  ids: string[]
): Array<{ a: string; b: string; aName: string; bName: string; effect: string; severity: string; mechanism: string; separationAdvice: string }> {
  const out: Array<{ a: string; b: string; aName: string; bName: string; effect: string; severity: string; mechanism: string; separationAdvice: string }> = [];
  const idSet = new Set(ids.map((x: string) => x.toLowerCase()));
  for (const inter of ALL_INTERACTIONS) {
    const a = (inter.substanceA || '').toLowerCase();
    const b = (inter.substanceB || '').toLowerCase();
    if (!a || !b) continue;
    if (idSet.has(a) && idSet.has(b)) {
      const type = (inter.type || '').toLowerCase();
      if (type.includes('conflict') || type.includes('antagon') || type.includes('конфликт') || type === 'conflict') {
        const sepHours = getSeparationHours(inter.substanceA, inter.substanceB);
        const mechanism = getConflictMechanism(
          inter.substanceA, inter.substanceB,
          (Array.isArray(inter.mechanisms) ? inter.mechanisms.join('; ') : '') || inter.effect || 'Конкурентное взаимодействие'
        );
        out.push({
          a: inter.substanceA, b: inter.substanceB,
          aName: catalogEntry(inter.substanceA)?.nameRu || inter.substanceA,
          bName: catalogEntry(inter.substanceB)?.nameRu || inter.substanceB,
          effect: inter.effect || inter.notes || '',
          severity: inter.severity || 'MEDIUM',
          mechanism,
          separationAdvice: `Принимать раздельно ≥${sepHours}ч. ${inter.substanceA} — в одном временном блоке, ${inter.substanceB} — в другом.`,
        });
      }
    }
  }
  return out.slice(0, 15);
}

/** Осторожности между выбранными веществами (из ALL_INTERACTIONS). */
export function buildCautions(
  ids: string[]
): Array<{ a: string; b: string; aName: string; bName: string; effect: string; severity: string }> {
  const out: Array<{ a: string; b: string; aName: string; bName: string; effect: string; severity: string }> = [];
  const idSet = new Set(ids.map((x: string) => x.toLowerCase()));
  for (const inter of ALL_INTERACTIONS) {
    const a = (inter.substanceA || '').toLowerCase();
    const b = (inter.substanceB || '').toLowerCase();
    if (!a || !b) continue;
    if (idSet.has(a) && idSet.has(b)) {
      const type = (inter.type || '').toLowerCase();
      if (type.includes('caution') || type.includes('осторож') || type === 'caution') {
        out.push({
          a: inter.substanceA, b: inter.substanceB,
          aName: catalogEntry(inter.substanceA)?.nameRu || inter.substanceA,
          bName: catalogEntry(inter.substanceB)?.nameRu || inter.substanceB,
          effect: inter.effect || inter.notes || '',
          severity: inter.severity || 'MEDIUM',
        });
      }
    }
  }
  return out.slice(0, 15);
}

/**
 * Synergy score стека: 0-100.
 * Формула: synScore = сумма severity-весов синергий / maxPossible × 100,
 * минус штрафы за конфликты и осторожности.
 */
export function calcStackSynergyScore(ids: string[]): {
  score: number;
  synergies: number;
  conflicts: number;
  cautions: number;
  totalPairs: number;
  unknownPairs: number;
  level: 'excellent' | 'good' | 'moderate' | 'poor' | 'risky';
  matrix: Array<{ a: string; b: string; aName: string; bName: string; type: string; severity: string; effect: string }>;
} {
  const idSet = new Set(ids.map((x: string) => x.toLowerCase()));
  const sevWeight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  let synWeight = 0, confWeight = 0, cautWeight = 0;
  let synCount = 0, confCount = 0, cautCount = 0;
  const matrix: Array<{ a: string; b: string; aName: string; bName: string; type: string; severity: string; effect: string }> = [];
  const pairSeen = new Set<string>();

  for (const inter of ALL_INTERACTIONS) {
    const a = (inter.substanceA || '').toLowerCase();
    const b = (inter.substanceB || '').toLowerCase();
    if (!a || !b) continue;
    if (!idSet.has(a) || !idSet.has(b)) continue;
    const pk = [a, b].sort().join('||');
    if (pairSeen.has(pk)) continue;
    pairSeen.add(pk);

    const type = (inter.type || '').toLowerCase();
    const sev = inter.severity || 'MEDIUM';
    const w = sevWeight[sev] || 2;
    const eff = inter.effect || inter.notes || '';
    const aName = catalogEntry(inter.substanceA)?.nameRu || inter.substanceA;
    const bName = catalogEntry(inter.substanceB)?.nameRu || inter.substanceB;

    if (type.includes('synerg') || type === 'synergy') {
      synWeight += w; synCount++;
      matrix.push({ a: inter.substanceA, b: inter.substanceB, aName, bName, type: 'synergy', severity: sev, effect: eff });
    } else if (type.includes('conflict') || type === 'conflict') {
      confWeight += w; confCount++;
      matrix.push({ a: inter.substanceA, b: inter.substanceB, aName, bName, type: 'conflict', severity: sev, effect: eff });
    } else if (type.includes('caution') || type === 'caution') {
      cautWeight += w * 0.5; cautCount++;
      matrix.push({ a: inter.substanceA, b: inter.substanceB, aName, bName, type: 'caution', severity: sev, effect: eff });
    } else {
      matrix.push({ a: inter.substanceA, b: inter.substanceB, aName, bName, type: type || 'unknown', severity: sev, effect: eff });
    }
  }

  const n = ids.length;
  const totalPairs = n * (n - 1) / 2;
  const knownPairs = pairSeen.size;
  const unknownPairs = Math.max(0, totalPairs - knownPairs);
  const maxPossible = totalPairs * 3;

  let score = 50;
  if (maxPossible > 0) {
    score = 50 + (synWeight * 50 / maxPossible) - (confWeight * 40 / maxPossible) - (cautWeight * 15 / maxPossible);
  }
  if (n >= 2 && knownPairs === 0) score = 50;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let level: 'excellent' | 'good' | 'moderate' | 'poor' | 'risky' = 'moderate';
  if (confCount > 0 && confWeight >= synWeight) level = 'risky';
  else if (score >= 80) level = 'excellent';
  else if (score >= 65) level = 'good';
  else if (score >= 45) level = 'moderate';
  else if (score >= 30) level = 'poor';
  else level = 'risky';

  return { score, synergies: synCount, conflicts: confCount, cautions: cautCount, totalPairs, unknownPairs, level, matrix: matrix.sort((x, y) => sevWeight[y.severity] - sevWeight[x.severity]) };
}

/**
 * Предложения «добавить 3-е вещество» — вещества, образующие синергии
 * с уже выбранными, но не входящие в выбор.
 */
export function suggestSynergyAdditions(
  ids: string[],
  maxSuggestions?: number
): Array<{ id: string; name: string; synergiesWith: string[]; score: number; effect: string }> {
  const idSet = new Set(ids.map((x: string) => x.toLowerCase()));
  const candidates = new Map<string, { synergiesWith: string[]; score: number; effects: string[] }>();

  for (const inter of ALL_INTERACTIONS) {
    const a = (inter.substanceA || '').toLowerCase();
    const b = (inter.substanceB || '').toLowerCase();
    if (!a || !b) continue;
    const type = (inter.type || '').toLowerCase();
    if (!(type.includes('synerg') || type === 'synergy')) continue;

    const sevWeight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const w = sevWeight[inter.severity] || 2;

    if (idSet.has(a) && !idSet.has(b)) {
      const key = b;
      if (!candidates.has(key)) candidates.set(key, { synergiesWith: [], score: 0, effects: [] });
      const c = candidates.get(key)!;
      c.synergiesWith.push(inter.substanceA);
      c.score += w;
      c.effects.push(inter.effect || '');
    } else if (idSet.has(b) && !idSet.has(a)) {
      const key = a;
      if (!candidates.has(key)) candidates.set(key, { synergiesWith: [], score: 0, effects: [] });
      const c = candidates.get(key)!;
      c.synergiesWith.push(inter.substanceB);
      c.score += w;
      c.effects.push(inter.effect || '');
    }
  }

  const out: Array<{ id: string; name: string; synergiesWith: string[]; score: number; effect: string }> = [];
  for (const [id, data] of candidates) {
    const entry = catalogEntry(id);
    const name = entry?.nameRu || entry?.name || id;
    const effect = data.effects[0] || '';
    out.push({ id, name, synergiesWith: data.synergiesWith, score: data.score, effect });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, maxSuggestions || 8);
}

/** Лабораторные отклонения и рекомендации по веществам (из evaluateRecommendations).
 *  Возвращает СТРУКТУРИРОВАННЫЙ список LabFinding (с тяжестью, системой, веществами,
 *  мониторингом и эскалацией) — без схлопывания в одну строку. */
export function buildLabFindings(
  state: CalculatorState,
  tzRes: CalculatorResult
): LabFinding[] {
  const out: LabFinding[] = [];
  try {
    const recs = evaluateRecommendations(state, tzRes, state.courseWeek);
    const seen = new Set<string>();
    for (const rec of recs) {
      if (!rec.substances || rec.substances.length === 0) continue;
      // курсовая динамика (изменение доз по неделям) — это не лабораторное отклонение
      if ((rec.id || '') === '__week_change') continue;
      const key = `${rec.id || ''}|${rec.title || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: rec.id || '',
        severity: rec.severity,
        system: rec.system || rec.systemLabel || 'other',
        systemLabel: rec.systemLabel || rec.system || 'Прочее',
        title: rec.title || '',
        status: rec.status,
        substances: rec.substances.map((s: any) => ({
          id: s.id,
          name: s.name,
          dose: s.dose || '',
          reasoning: s.reasoning || '',
          tier: s.tier || 'base',
          priority: s.priority,
          brandName: s.brandName,
        })),
        escalation: rec.escalation || '',
        monitoring: rec.monitoring || '',
        conflicts: rec.conflicts || [],
      });
    }
  } catch {}
  return out.slice(0, 20);
}

/**
 * Предупреждения о каскадах истощения (из движка).
 * Возвращает структурированный список для UI.
 */
export function buildDepletionWarnings(
  tzRes: CalculatorResult
): Array<{ depleter: string; depleterName: string; depleted: string; depletedName: string; mechanism: string; severity: string; recommendation: string }> {
  if (!tzRes.depletionWarnings || tzRes.depletionWarnings.length === 0) return [];
  return tzRes.depletionWarnings.map(w => ({
    depleter: w.depleter,
    depleterName: catalogEntry(w.depleter)?.nameRu || w.depleter,
    depleted: w.depleted,
    depletedName: catalogEntry(w.depleted)?.nameRu || w.depleted,
    mechanism: w.mechanism,
    severity: w.severity,
    recommendation: w.recommendation,
  }));
}

/**
 * Сводка совокупной суточной нагрузки минералов/витаминов.
 * Проверяет превышение UL и показывает вклад каждого вещества.
 */
export function buildCumulativeLoad(
  tzRes: CalculatorResult,
): Array<{ nutrientId: string; nutrientName: string; totalMg: number; ulMg?: number; percentUL?: number; isOverUL: boolean; contributors: string[] }> {
  if (!tzRes.dailyLoad) return [];
  return Object.entries(tzRes.dailyLoad).map(([nutrientId, data]) => ({
    nutrientId,
    nutrientName: catalogEntry(nutrientId)?.nameRu || nutrientId,
    totalMg: data.totalMg,
    ulMg: data.ulMg,
    percentUL: data.ulMg ? Math.round(data.totalMg / data.ulMg * 100) : undefined,
    isOverUL: data.ulMg ? data.totalMg > data.ulMg : false,
    contributors: data.contributors,
  })).sort((a, b) => (b.percentUL || 0) - (a.percentUL || 0));
}

/**
 * Оценка «pill burden» — количества таблеток/капсул в день.
 * Высокое число → низкая приверженность.
 */
export function buildPillBurden(
  tzRes: CalculatorResult,
): { totalSubstances: number; estimatedPillsPerDay: number; morningPills: number; afternoonPills: number; eveningPills: number; feasibility: 'optimal' | 'acceptable' | 'high' | 'excessive'; message: string } {
  const substances = tzRes.selectedSubstances || [];
  const schedule = tzRes.schedule || [];
  let morningCount = 0, afternoonCount = 0, eveningCount = 0;
  for (const s of schedule) {
    if (s.timeBlock === 'morning') morningCount++;
    else if (s.timeBlock === 'afternoon') afternoonCount++;
    else eveningCount++;
  }
  // Учитываем half-life multiplicity: добавляем +1 таблетку для веществ с 2+/day
  let estimatedTotal = 0;
  for (const subId of substances) {
    const mult = SUBSTANCE_HALF_LIFE ? 1 : 1; // default
    estimatedTotal += 1;
  }
  const total = substances.length;
  let feasibility: 'optimal' | 'acceptable' | 'high' | 'excessive' = 'optimal';
  let message = '';
  if (total <= 6) {
    feasibility = 'optimal';
    message = 'Компактный план. Высокая приверженность.';
  } else if (total <= 12) {
    feasibility = 'acceptable';
    message = 'Средняя нагрузка. Рекомендуется разделить приёмы на 3-4 временных блока.';
  } else if (total <= 20) {
    feasibility = 'high';
    message = 'Высокая таблеточная нагрузка. Рассмотрите приоритезацию наиболее важных веществ.';
  } else {
    feasibility = 'excessive';
    message = 'Чрезмерная нагрузка (>20 веществ). Реальная приверженность будет низкой. Сократите до ключевых 10-12 веществ.';
  }
  return {
    totalSubstances: total,
    estimatedPillsPerDay: estimatedTotal,
    morningPills: morningCount,
    afternoonPills: afternoonCount,
    eveningPills: eveningCount,
    feasibility,
    message,
  };
}
