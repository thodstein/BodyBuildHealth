/**
 * support-plan/display.ts — display-данные: synergyComment, monitoring,
 * specialInstructions, conflicts, labFindings.
 */

import { ALL_INTERACTIONS, SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { evaluateRecommendations } from '../recommendation-engine';
import type { CalculatorState, CalculatorResult } from '../support-calculator.types';
import { catalogEntry } from './types';

/**
 * Комментарий о синергиях и конфликтах между выбранными веществами.
 * Сканирует ALL_INTERACTIONS на пары, где оба вещества есть в плане.
 */
export function buildSynergyComment(ids: string[]): string {
  const idSet = new Set(ids.map((x: string) => x.toLowerCase()));
  const syns: string[] = [];
  const confs: string[] = [];
  for (const inter of ALL_INTERACTIONS) {
    const a = (inter.substanceA || '').toLowerCase();
    const b = (inter.substanceB || '').toLowerCase();
    if (!a || !b) continue;
    if (idSet.has(a) && idSet.has(b)) {
      const type = (inter.type || '').toLowerCase();
      const isSynergy = type.includes('synerg') || type.includes('синерг') || type === 'synergy';
      const isConflict = type.includes('conflict') || type.includes('antagon') || type.includes('конфликт') || type === 'conflict';
      const label = `${inter.substanceA} + ${inter.substanceB}`;
      const eff = inter.effect || inter.notes || '';
      if (isSynergy) syns.push(`• ${label}: ${eff}`);
      else if (isConflict) confs.push(`• ${label}: ${eff}`);
    }
  }
  const parts: string[] = [];
  if (syns.length > 0) parts.push(`Синергии (${syns.length}):\n${syns.slice(0, 8).join('\n')}`);
  if (confs.length > 0) parts.push(`Конфликты (${confs.length}):\n${confs.slice(0, 5).join('\n')}`);
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
