/**
 * support-plan/stacks.ts — рекомендация стеков из ALL_STACKS
 * на основе покрытых систем и веществ.
 */

import { ALL_STACKS } from '../../data/support-database';
import { SUPPLEMENTS_DB } from '../../data/support-db/supplements';
import { PHARMACY_DB } from '../../data/support-db/pharmacy-db';
import type { CalculatorState, CalculatorResult, StackRecommendation } from './types';
import { SYS_ORDER, clamp, sysName } from './types';
import { buildSystems } from './systems';

/**
 * Лёгкая рекомендация стеков: для каждого стека считается:
 *  - coveragePercent: сколько веществ стека уже в плане
 *  - coveredSystems: сколько активных систем стек покрывает
 *  - synergyBonus: synergyScore стека
 *  - wasteSubstances: вещества стека, не покрывающие активные системы
 *  - score: итоговый скор (0-100)
 *
 * Возвращает топ-5 стеков по релевантности.
 */
export function recommendStacksLight(
  state: CalculatorState,
  tzRes: CalculatorResult
): StackRecommendation[] {
  const out: StackRecommendation[] = [];
  const selectedSet = new Set(tzRes.selectedSubstances.map((s: string) => s.toLowerCase()));
  const systems = buildSystems(tzRes);
  // Активные системы (raw > 15)
  const activeSystems = SYS_ORDER.filter(s => (systems[s]?.raw || 0) > 15);

  for (const stack of ALL_STACKS) {
    try {
      const stackSubs = (stack.substances || []).map((s: any) => (s.id || '').toLowerCase());
      if (stackSubs.length === 0) continue;
      // Сколько веществ стека уже в плане
      const covered = stackSubs.filter((id: string) => selectedSet.has(id));
      const coveragePercent = Math.round((covered.length / stackSubs.length) * 100);
      // Покрытие активных систем
      const stackSystems = (stack.anatomicalMapping?.organSystems || []).map((s: string) => s.toLowerCase());
      const coveredSystems = activeSystems.filter(s =>
        stackSystems.some((ss: string) => ss.includes(s) || s.includes(ss))
      );
      // Synergy bonus
      const synergyBonus = stack.synergyScore || 0;
      // Waste — вещества стека, не покрывающие активные системы
      const wasteSubstances = stackSubs.filter((id: string) => {
        const db = SUPPLEMENTS_DB[id] || PHARMACY_DB[id];
        if (!db) return false;
        return !db.some((e: any) =>
          activeSystems.includes(e.organId) ||
          activeSystems.includes(e.organId === 'cns' ? 'neuro' : e.organId)
        );
      });
      // Score
      const score = clamp(
        coveragePercent * 0.4 + coveredSystems.length * 10 + synergyBonus * 0.3 - wasteSubstances.length * 5,
        0, 100
      );
      // Фильтр: только релевантные
      if (score < 30 && coveragePercent < 30) continue;
      out.push({
        stack,
        score: Math.round(score),
        coveragePercent,
        coveredSystems: coveredSystems.map((s: string) => sysName(s)),
        coveredMechanisms: (stack.anatomicalMapping?.mechanismCodes || []).slice(0, 5),
        synergyBonus,
        wasteSubstances,
        reason: `Покрытие ${coveragePercent}% (${covered.length}/${stackSubs.length}), систем: ${coveredSystems.length}, синергия: ${synergyBonus}`,
      });
    } catch {}
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 5);
}
