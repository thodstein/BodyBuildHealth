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

const MODE_STACK_IDS: Record<string, string[]> = {
  joint: ['joints_regeneration_stack','articular_stack','bone_stack'],
  repro: ['hormonal_pct_stack','post_cycle_recovery_stack','libido_erectile_stack','libido_stack'],
  neuro: ['neuroprotection_stack','nootropic_stack','nootropic_energy_stack','cholinergic_nootropic_stack','anti_stress_stack','sleep_recovery_stack','membrane_ps_ump_pc_stack','longevity_nad_stack'],
};

/**
 * Лёгкая рекомендация стеков: для каждого стека считается:
 *  - coveragePercent: сколько веществ стека уже в плане
 *  - coveredSystems: сколько активных систем стек покрывает
 *  - synergyBonus: synergyScore стека
 *  - wasteSubstances: вещества стека, не покрывающие активные системы
 *  - score: итоговый скор (0-100)
 *
 * Возвращает топ-12 стеков по релевантности.
 * При включённых mode-тоглах (jointMode/reproMode/neuroMode) добавляет
 * стеки для соответствующих систем даже если их score низкий.
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

  // Mode-specific stacks
  const modeForcedIds = new Set<string>();
  if (state.jointMode) MODE_STACK_IDS.joint.forEach(id => modeForcedIds.add(id));
  if (state.reproMode) MODE_STACK_IDS.repro.forEach(id => modeForcedIds.add(id));
  if (state.neuroMode) MODE_STACK_IDS.neuro.forEach(id => modeForcedIds.add(id));

  for (const stack of ALL_STACKS) {
    try {
      const stackSubs = (stack.substances || []).map((s: any) => (s.id || '').toLowerCase());
      if (stackSubs.length === 0) continue;
      const stackIdLower = (stack.id || '').toLowerCase();
      const isModeForced = modeForcedIds.has(stackIdLower);
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
      let score = clamp(
        coveragePercent * 0.4 + coveredSystems.length * 10 + synergyBonus * 0.3 - wasteSubstances.length * 5,
        0, 100
      );
      // Mode-forced stacks get a bonus
      if (isModeForced) score = Math.max(score, 50);
      // Фильтр: только релевантные или mode-forced
      if (!isModeForced && score < 30 && coveragePercent < 30) continue;
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
  return out.slice(0, 12);
}
