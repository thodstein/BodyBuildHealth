/**
 * support-plan/systems.ts — построение systems/mechanisms/coverageGaps/
 * uncoveredMechanisms/riskDynamics/riskBreakdown из результата TZ движка.
 */

import { SUPPLEMENTS_DB } from '../../data/support-db/supplements';
import { PHARMACY_DB } from '../../data/support-db/pharmacy-db';
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

/** Список всех механизмов риска с веществами, которые их покрывают. */
export function buildMechanisms(tzRes: CalculatorResult): PlanMechanism[] {
  const out: PlanMechanism[] = [];
  const tzSystems = tzRes.risk?.systems || [];
  for (const sysEntry of tzSystems) {
    const sysId: string = sysEntry.id;
    const sysLabel = sysName(sysId);
    for (const m of (sysEntry.mechanisms || [])) {
      if (!m?.name) continue;
      // substances covering this mechanism (best-effort: list those covering this system)
      const covering: string[] = [];
      for (const subId of tzRes.selectedSubstances) {
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

/** Непокрытые механизмы (риск > 5%, ни одно вещество не покрывает). */
export function buildUncoveredMechanisms(
  tzRes: CalculatorResult
): Array<{ mechKey: string; mechLabel: string; systemLabel: string; risk: number }> {
  const out: Array<{ mechKey: string; mechLabel: string; systemLabel: string; risk: number }> = [];
  const mechs = buildMechanisms(tzRes);
  for (const m of mechs) {
    if (m.riskBefore > 5 && m.substances.length === 0) {
      out.push({
        mechKey: m.mechKey,
        mechLabel: m.mechLabel,
        systemLabel: m.systemLabel,
        risk: m.riskBefore,
      });
    }
  }
  return out;
}

/** Динамика риска по системам (для таблицы сравнения). */
export function buildRiskDynamics(
  tzRes: CalculatorResult
): Array<{ system: string; before: number; after: number; mechanisms: PlanMechanism[] }> {
  const out: Array<{ system: string; before: number; after: number; mechanisms: PlanMechanism[] }> = [];
  const systems = buildSystems(tzRes);
  for (const sys of SYS_ORDER) {
    const s = systems[sys];
    if (!s) continue;
    out.push({
      system: sys,
      before: s.raw,
      after: s.net,
      mechanisms: [],
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
