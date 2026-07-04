/**
 * support-plan/display.ts — display-данные: synergyComment, monitoring,
 * specialInstructions, conflicts, labFindings.
 */

import { ALL_INTERACTIONS, SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { evaluateRecommendations } from '../recommendation-engine';
import type { CalculatorState, CalculatorResult } from './types';
import { catalogEntry } from './types';

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

/** Конфликты между выбранными веществами (из ALL_INTERACTIONS). */
export function buildConflicts(
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
      if (type.includes('conflict') || type.includes('antagon') || type.includes('конфликт') || type === 'conflict') {
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

/** Лабораторные отклонения и рекомендации по веществам (из evaluateRecommendations). */
export function buildLabFindings(
  state: CalculatorState,
  tzRes: CalculatorResult
): Array<{ marker: string; name: string; value: string; threshold: string; organ: string; suggestedSubs: string[] }> {
  const out: Array<{ marker: string; name: string; value: string; threshold: string; organ: string; suggestedSubs: string[] }> = [];
  try {
    const recs = evaluateRecommendations(state, tzRes, state.courseWeek);
    const seen = new Set<string>();
    for (const rec of recs) {
      if (!rec.substances || rec.substances.length === 0) continue;
      const key = `${rec.id || ''}|${rec.title || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        marker: rec.id || '',
        name: rec.title || rec.systemLabel || '',
        value: rec.substances.map((s: any) => `${s.name}: ${s.reasoning || ''}`).join('; '),
        threshold: rec.escalation || '',
        organ: rec.system || rec.systemLabel || '',
        suggestedSubs: rec.substances.map((s: any) => s.id || s.name).filter(Boolean),
      });
    }
  } catch {}
  return out.slice(0, 20);
}
