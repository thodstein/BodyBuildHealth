/**
 * strength-sport-sm-attempts-bridge.engine.ts — МОСТ ПОПЫТОК ХАБ→КОНТЕСТ (SM PRO)
 *
 * Хаб хранит yoke/farmers/stone/log/axle кг + contestId; мост строит план попыток
 * на каждый ивент контеста через существующий sm-attempts движок:
 *  max-ивенты → buildSMEventPlan (85/92/98 openers + warmup 50/65/75/85);
 *  loading/medley → stoneLadder + medleyPlan (85-95% ПМ, переходы 5с).
 * Чистый движок (contest пресеты импортируются, но не мутятся).
 */

import { CONTEST_PRESETS, type StrongmanContest } from './strength-sport-contest.types';
import {
  buildSMEventPlan,
  buildMedleyPlan,
  buildStoneLadder,
  SM_EVENT_STEP,
  type SMStrategy,
  type SMEventPlan,
  type MedleyPlan,
} from './strength-sport-strongman-attempts.engine';

export interface SMHubMaxes {
  yokeKg?: number | null;
  farmersKg?: number | null;
  stoneKg?: number | null;
  logKg?: number | null;
  axleKg?: number | null;
}

export interface SMAttemptsBridgeResult {
  contest: StrongmanContest;
  plans: SMEventPlan[];
  medley: MedleyPlan | null;
  stoneLadder: number[];
  rationale: string[];
}

function maxForEvent(eventId: string, m: SMHubMaxes): number | null {
  const id = String(eventId).toLowerCase();
  if (id.includes('yoke')) return m.yokeKg ?? null;
  if (id.includes('farmer') || id.includes('frame_carry') || id.includes('husafell') || id.includes('conan') || id.includes('shield')) return m.farmersKg ?? null;
  if (id.includes('stone') || id.includes('sandbag') || id.includes('keg') || id.includes('tire')) return m.stoneKg ?? null;
  if (id.includes('log') || id.includes('axle') || id.includes('viking') || id.includes('circus') || id.includes('press')) return (m.logKg ?? m.axleKg ?? null) as number | null;
  if (id.includes('deadlift') || id.includes('truck') || id.includes('arm_over_arm') || id.includes('sled')) return null;
  return null;
}

/** Построить планы попыток на ивенты контеста из максимумов хаба. */
export function buildSMAttemptsForContest(
  contestId: string | null | undefined,
  maxes: SMHubMaxes,
  strategy: SMStrategy = 'balanced',
  contestOverride?: StrongmanContest | null,
): SMAttemptsBridgeResult | null {
  const contest: StrongmanContest | undefined =
    contestOverride ?? (contestId ? (CONTEST_PRESETS as Record<string, StrongmanContest>)[contestId] : undefined);
  if (!contest || !Array.isArray(contest.events) || contest.events.length === 0) return null;
  const plans: SMEventPlan[] = [];
  const rationale: string[] = [`Контест: ${contest.name || contestId} · стратегия ${strategy}`];
  for (const ev of contest.events) {
    const pm = maxForEvent(ev.id, maxes);
    if (pm == null || !Number.isFinite(pm) || pm <= 0) {
      rationale.push(`${ev.id}: ПМ не задан — opener по весу контеста ${ev.weight ?? ev.ladderWeights?.[ev.ladderWeights.length - 1] ?? '—'}кг`);
      continue;
    }
    const step = SM_EVENT_STEP[ev.id] || 2.5;
    void step;
    const plan = buildSMEventPlan(ev.id, pm, strategy);
    if (plan) {
      plans.push(plan);
      rationale.push(`${ev.id}: ${plan.attempts.opener}/${plan.attempts.second}/${plan.attempts.third}кг (ПМ ${pm}кг)`);
    }
  }
  // Medley: carries контеста → один medley-план
  const carryEvents = contest.events.filter((e) => /yoke|farmer|frame|husafell|conan|sled|truck|arm_over/.test(String(e.id).toLowerCase()));
  let medley: MedleyPlan | null = null;
  if (carryEvents.length >= 2) {
    const med = carryEvents.map((e) => {
      const pm = maxForEvent(e.id, maxes) ?? e.weight ?? 100;
      return { id: e.id, pm, distanceM: e.distanceM ?? 20 };
    });
    medley = buildMedleyPlan(med, strategy);
    if (medley) rationale.push(`Medley: ${medley.events.map((e) => `${e.id} ${e.weight}кг`).join(' → ')} · ${medley.totalTimeS}с / cap ${medley.timeCapS}с`);
  }
  // Лестница камней: по stone-ПМ
  const stonePm = maxes.stoneKg ?? null;
  const stoneLadder = stonePm != null && stonePm > 0 ? buildStoneLadder(stonePm, 5, 5) : [];
  if (stoneLadder.length) rationale.push(`Лестница камней: ${stoneLadder.join(' → ')}кг`);
  return { contest, plans, medley, stoneLadder, rationale };
}
