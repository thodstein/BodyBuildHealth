/**
 * support-plan/systems.ts — построение systems/mechanisms/coverageGaps/
 * uncoveredMechanisms/riskDynamics/riskBreakdown из результата TZ движка.
 */

import { SUPPLEMENTS_DB } from '../../data/support-db/supplements';
import { PHARMACY_DB } from '../../data/support-db/pharmacy-db';
import { getSupportMechs, canonSupportId } from '../../data/support-db/mech-map';
import { PROCEDURE_DB } from '../risk-engine-tz-spec';
import type { CalculatorResult, PlanMechanism } from './types';
import { SYS_ORDER, sysName, sysEmoji } from './types';

/** Системы организма с их raw/net риском и списком механизмов. */
export function buildSystems(
  tzRes: CalculatorResult
): Record<string, { raw: number; net: number; mechanisms: string[] }> {
  const out: Record<string, { raw: number; net: number; mechanisms: string[] }> = {};
  const tzSystems = tzRes.risk?.systems || [];
  for (const sys of SYS_ORDER) {
    const tzEntry = tzSystems.find((s: any) => s.id === sys);
    const raw = tzEntry?.rawScore ?? 0;
    const net = tzEntry?.afterSupport ?? Math.max(0, raw - 10);
    out[sys] = {
      raw: Math.round(raw),
      net: Math.max(0, Math.round(net)),
      mechanisms: (tzEntry?.mechanisms || []).map((m: any) => m.name).filter(Boolean),
    };
  }
  return out;
}

/**
 * Вещества поддержки, реально дающие k этому механизму.
 *
 * Раньше «покрытие механизма» определялось по органу: любое вещество с
 * `organId === sysId` объявлялось покрывающим ВСЕ механизмы системы — план
 * показывал «Механизмы с покрытием» там, где модель k не давала. Здесь —
 * точное сопоставление по единому резолверу `mech-map` (тем же, что считает
 * k в механизм-модели) + синергетические трио из движка.
 */
const PLASMA_TRIO = ['hydration', 'cardio_aerobic', 'electrolyte_balance'];
const FIBRINO_TRIO = ['nattokinase', 'serrapeptase', 'bromelain'];

function coveringForMech(organId: string, mechId: string, selected: string[]): string[] {
  const out: string[] = [];
  const selectedCanon = new Set(selected.map(id => canonSupportId(id)));
  for (const subId of selected) {
    const entries = getSupportMechs(subId);
    const proc = entries.length > 0 ? entries : (PROCEDURE_DB[canonSupportId(subId)] || PROCEDURE_DB[subId] || []);
    if (proc.some(e => e.organId === organId && e.mechId === mechId)) out.push(subId);
  }
  if (out.length > 0) return out;
  // Синергетические трио дают k без прямой записи механизма (как в движке).
  const trios: Array<{ ids: string[]; mechs: string[] }> = [
    { ids: PLASMA_TRIO, mechs: ['hem1', 'cv4', 'cv3'] },
    { ids: FIBRINO_TRIO, mechs: ['hem2', 'cv4', 'hem1'] },
  ];
  for (const t of trios) {
    if (t.mechs.includes(mechId) && t.ids.every(id => selectedCanon.has(id))) {
      out.push(...t.ids.filter(id => selectedCanon.has(id)));
    }
  }
  return out;
}

/** Список всех механизмов риска с веществами, которые их покрывают. */
export function buildMechanisms(tzRes: CalculatorResult): PlanMechanism[] {
  const organs = tzRes.tzSpecResult?.organs;
  const selected = tzRes.selectedSubstances || [];

  // ── Точный путь: механизм-ориентированная модель ──
  // Берём ТОЛЬКО механизмы, которые дают риск в этом курсе (`raw > 0`), и
  // помечаем покрытие по `k_used` (как `mechanismCoverageOf`) — иначе план
  // заявлял покрытие механизмов, к которым курс не относится.
  if (Array.isArray(organs) && organs.length > 0) {
    const out: PlanMechanism[] = [];
    for (const organ of organs) {
      for (const m of (organ.mechanisms || [])) {
        const riskBefore = Number(m.raw) || 0;
        if (riskBefore <= 0) continue;
        const covering = coveringForMech(organ.id, m.id, selected);
        out.push({
          mechKey: m.id,
          mechLabel: m.name || m.id,
          systemLabel: sysName(organ.id),
          substances: covering,
          riskBefore: Math.round(riskBefore),
          riskAfter: Math.round(Number(m.afterSupport) || 0),
          covered: (Number(m.k_used) || 0) > 0 || covering.length > 0,
          confidence: m.q_label || '',
        });
      }
    }
    return out;
  }

  // ── Fallback: механизм-модели нет (старый/упавший расчёт) ──
  // Грубое системное сопоставление — единственное, что доступно без k.
  const out: PlanMechanism[] = [];
  const tzSystems = tzRes.risk?.systems || [];
  for (const sysEntry of tzSystems) {
    const sysId: string = sysEntry.id;
    const sysLabel = sysName(sysId);
    for (const m of (sysEntry.mechanisms || [])) {
      if (!m?.name) continue;
      const covering: string[] = [];
      for (const subId of selected) {
        const db = SUPPLEMENTS_DB[subId] || PHARMACY_DB[subId];
        if (db && db.some((e: any) => e.organId === sysId || (sysId === 'neuro' && e.organId === 'cns'))) {
          covering.push(subId);
        }
      }
      // Reduction based on coverage: 0 → 1.0 (no reduction), 1 → 0.65, 2+ → 0.45
      const reductionFactor = covering.length === 0 ? 1.0
        : covering.length === 1 ? 0.65
        : 0.45;
      out.push({
        mechKey: `${sysId}.${m.id || m.name}`,
        mechLabel: m.name,
        systemLabel: sysLabel,
        substances: covering,
        riskBefore: Math.round(m.contribution || 0),
        riskAfter: Math.max(0, Math.round((m.contribution || 0) * reductionFactor)),
        covered: covering.length > 0,
        confidence: '',
      });
    }
  }
  return out;
}

/** Пробелы покрытия: системы с остаточным риском > 20%. */
export function buildCoverageGaps(
  tzRes: CalculatorResult
): Array<{ system: string; label: string; raw: number; net: number; gapPercent: number }> {
  const out: Array<{ system: string; label: string; raw: number; net: number; gapPercent: number }> = [];
  const systems = buildSystems(tzRes);
  for (const sys of SYS_ORDER) {
    const s = systems[sys];
    if (!s) continue;
    const gapPercent = Math.max(0, s.net - 20);
    if (gapPercent > 5) {
      out.push({
        system: sys,
        label: `${sysEmoji(sys)} ${sysName(sys)}`,
        raw: s.raw,
        net: s.net,
        gapPercent: Math.round(gapPercent),
      });
    }
  }
  return out;
}

/**
 * Непокрытые механизмы: дают риск, но ни одно вещество плана не даёт им k.
 * Раньше использовался `m.substances.length === 0` при грубом системном
 * сопоставлении — список врал и в обе стороны. Теперь источник — точный
 * `covered` из `buildMechanisms` (тот же, что в `mechanismCoverage`).
 */
export function buildUncoveredMechanisms(
  tzRes: CalculatorResult
): Array<{ mechKey: string; mechLabel: string; systemLabel: string; risk: number }> {
  return buildMechanisms(tzRes)
    .filter(m => m.covered === false)
    .map(m => ({
      mechKey: m.mechKey,
      mechLabel: m.mechLabel,
      systemLabel: m.systemLabel,
      risk: m.riskBefore,
    }))
    .sort((a, b) => b.risk - a.risk);
}

/** Динамика риска по системам (для таблицы сравнения). */
export function buildRiskDynamics(
  tzRes: CalculatorResult
): Array<{ system: string; before: number; after: number; mechanisms: PlanMechanism[] }> {
  const out: Array<{ system: string; before: number; after: number; mechanisms: PlanMechanism[] }> = [];
  const systems = buildSystems(tzRes);
  const allMechs = buildMechanisms(tzRes);
  for (const sys of SYS_ORDER) {
    const s = systems[sys];
    if (!s) continue;
    out.push({
      system: sys,
      before: s.raw,
      after: s.net,
      mechanisms: allMechs.filter(m => m.systemLabel === sysName(sys)),
    });
  }
  return out;
}

/** Расшифровка источников риска по системам (для отображения). */
export function buildRiskBreakdown(
  _state: any,
  tzRes: CalculatorResult
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const systems = buildSystems(tzRes);
  for (const sys of SYS_ORDER) {
    const s = systems[sys];
    if (!s || s.raw < 5) continue;
    const reasons: string[] = [];
    const mechs = (tzRes.risk?.systems || []).find((sr: any) => sr.id === sys);
    if (mechs?.mechanisms) {
      for (const m of mechs.mechanisms) {
        if (m.contribution > 5) reasons.push(`${m.name}: ${Math.round(m.contribution)}%`);
      }
    }
    if (reasons.length === 0 && s.raw > 0) reasons.push(`Суммарный риск: ${s.raw}%`);
    out[sys] = reasons.slice(0, 5);
  }
  return out;
}
