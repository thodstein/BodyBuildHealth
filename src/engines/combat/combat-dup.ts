/**
 * combat-dup.ts — изолированный DUP для единоборств.
 * 4 режима: power_endurance (тяж RIR-1 / памп +1rep), heavy_light (3 волны внутри нед), conjugate (max/dynamic/repetition)
 *
 * ИНВАРИАНТ (баг-фикс раунда PRO-3): заголовочные поля упражнения
 * (`ex.reps` / `ex.weight`) обязаны совпадать с тем, что лежит в `workSets`.
 * Раньше power_endurance и heavy_light меняли только per-set значения, и план
 * печатал/экспортировал «4×10-15 · 60кг» при фактических сетах 11×60 — UI,
 * печать, CSV и ICS врали на одном и том же упражнении.
 */
import type { CombatPlan } from './combat.types';

export type CombatDUP = 'off' | 'power_endurance' | 'heavy_light' | 'conjugate';

/** int-кламп RIR: DUP не имеет права писать дробей в поле, которое все движки читают как целое. */
function clampRir(v: number): number { return Math.max(1, Math.min(4, Math.round(v))); }

/** Пересчитать заголовок упражнения из его же рабочих сетов — один источник правды. */
function syncHeadline(ex: CombatPlan['weeksData'][number]['sessions'][number]['exercises'][number]): void {
  const ws = ex.workSets || [];
  if (!ws.length) return;
  const first = ws[0];
  const last = ws[ws.length - 1];
  if (first.weight === last.weight) ex.weight = first.weight;
  if (first.reps === last.reps) ex.reps = `${first.reps}`;
  else ex.reps = `${Math.min(first.reps, last.reps)}-${Math.max(first.reps, last.reps)}`;
}

export function applyCombatDUP(plan: CombatPlan, mode: CombatDUP = 'power_endurance'): CombatPlan {
  if (mode === 'off') return plan;
  for (const wk of plan.weeksData) {
    if (wk.deload || wk.taper) continue;
    for (const sess of wk.sessions) {
      // широкая форма (includes 'power'), а не точное равенство: full_power —
      // единственный тег сплитов combat_2b/combat_3b и фолбэк билдера, и он
      // раньше не попадал ни в тяж, ни в лёгкую волну heavy_light
      const isPower = sess.sessionTag.includes('power');
      if (mode === 'power_endurance') {
        for (const ex of sess.exercises) {
          if (isPower) ex.rir = clampRir(ex.rir - 1);
          else {
            ex.rir = clampRir(ex.rir + 1);
            ex.workSets = ex.workSets.map(s => ({ ...s, reps: s.reps + 1 }));
            syncHeadline(ex);
          }
        }
      } else if (mode === 'heavy_light') {
        // волна внутри недели: power сессии тяж, conditioning лёг, neck_grip средние
        const isLight = sess.sessionTag.includes('conditioning');
        for (const ex of sess.exercises) {
          if (isPower) {
            ex.rir = clampRir(ex.rir - 1);
            ex.workSets = ex.workSets.map(s => ({ ...s, weight: Math.round(s.weight * 1.02 / 2.5) * 2.5 }));
            syncHeadline(ex);
          } else if (isLight) {
            ex.rir = clampRir(ex.rir + 1);
            ex.workSets = ex.workSets.map(s => ({ ...s, reps: s.reps + 1, weight: Math.round(s.weight * 0.92 / 2.5) * 2.5 }));
            syncHeadline(ex);
          } else {
            // средняя волна: рабочие сеты не трогаем — только RIR
            ex.rir = clampRir(ex.rir);
          }
        }
      } else if (mode === 'conjugate') {
        // max effort: 1-3 повт, RIR1, dynamic: 8×3 60% speed, repetition: 8-12 RIR3
        const weekMod = wk.week % 3;
        for (const ex of sess.exercises) {
          if (weekMod === 1) { // max
            if (ex.role === 'primary') { ex.rir = 1; ex.reps = '1-3'; ex.workSets = ex.workSets.map(s => ({ ...s, reps: 2, rir: 1 })); }
          } else if (weekMod === 2) { // dynamic
            ex.rir = 3; ex.reps = '3-5'; ex.tempo = 'X-0-X-0'; ex.workSets = ex.workSets.map(s => ({ ...s, reps: 3, rir: 3, tempo: 'X-0-X-0' })); ex.restSeconds = 90;
          } else { // repetition
            ex.rir = 3; ex.reps = '8-12'; ex.workSets = ex.workSets.map(s => ({ ...s, reps: 10, rir: 3 })); ex.restSeconds = 75;
          }
        }
      }
    }
  }
  plan.rationale.push(`Combat DUP ${mode}`);
  return plan;
}
