/**
 * combat-vbt.engine.ts — VBT для единоборств (обёртка над pro/vbt).
 * Маппит боевые движения → VBTLift (bench для жимов, squat для приседов/прыжков).
 */
import {
  velocityForPct as baseVelocityForPct,
  pctForVelocity as basePctForVelocity,
  estimate1RMFromVelocity as baseEstimate,
  velocityLoss as baseVelocityLoss,
  velocityLossZone as baseZone,
  thresholdForIntent,
  type VBTLift,
  type VBTIntent,
  type VelocityLossResult,
} from '../pro/vbt.engine';

export type CombatLiftId = string;

function mapCombatLift(id: string): VBTLift {
  const low = id.toLowerCase();
  // ротационные/взрывные — скорость выше, ближе к жиму/скоростно-силовой (1.0-1.6м/с), не присед 0.30
  if (low.includes('landmine_rotation') || low.includes('landmine_180') || low.includes('med_ball_rot') || low.includes('med_ball_throw') || low.includes('med_ball_slam') || low.includes('sledge') || low.includes('battle_rope')) return 'bench';
  if (low.includes('bench') || low.includes('ohp') || low.includes('push_press') || low.includes('landmine_press')) return 'bench';
  if (low.includes('squat') || low.includes('lunge') || low.includes('step_up') || low.includes('jump')) return 'squat';
  if (low.includes('dead') || low.includes('rdl') || low.includes('trap_bar') || low.includes('pull') || low.includes('row')) return 'deadlift';
  if (low.includes('press')) return 'bench';
  return 'squat';
}

export function velocityForCombat(pct1RM: number, liftId?: string): number {
  const lift = mapCombatLift(liftId || 'squat');
  return baseVelocityForPct(lift, pct1RM);
}

export function estimate1RMFromVelocityCombat(weight: number, velocity: number, liftId?: string): number {
  const lift = mapCombatLift(liftId || 'squat');
  if (velocity <= 0 || weight <= 0) return 0;
  return baseEstimate(lift, velocity, weight).e1RM || 0;
}

export function diagnoseVelocityLossCombat(bestVel: number, lastVel: number, threshold: 20 | 10 | 25 | 40 = 20, weight?: number, liftId?: string): {
  lossPct: number; zone: string; exceeded: boolean; e1RMByVelocity: number | null; recommendation: string;
} {
  const vl = baseVelocityLoss([bestVel, lastVel], threshold as any);
  const lossPct = vl?.lossPct ?? 0;
  const exceeded = !!vl?.exceeded;
  const zone = baseZone(lossPct);
  const e1RMByVelocity = weight && weight > 0 && lastVel > 0 ? estimate1RMFromVelocityCombat(weight, lastVel, liftId) : null;
  let rec = '';
  if (lossPct > 30) rec = 'Стоп сет — ЦНС устала';
  else if (lossPct > 25) rec = 'Снизьте вес 5%, RIR+1';
  else if (lossPct > 20) rec = 'RIR+1 — контроль';
  else rec = 'Оптимально — можно добавить сет';
  return { lossPct, zone, exceeded, e1RMByVelocity, recommendation: rec };
}

export function vbtRecommendationCombat(lossPct: number): { action: string; rirAdd: number; volumeMult: number } {
  if (lossPct > 30) return { action: 'Стоп сет', rirAdd: 2, volumeMult: 0.6 };
  if (lossPct > 25) return { action: 'Снизьте вес 5% + RIR+1', rirAdd: 1, volumeMult: 0.85 };
  if (lossPct > 20) return { action: 'RIR+1', rirAdd: 1, volumeMult: 0.9 };
  return { action: 'Оптимально', rirAdd: 0, volumeMult: 1 };
}

// --- Per-exercise history + EWMA (как в cardio-diary hrvEwma) ---
export interface VbtHistoryEntry { liftId: string; velocity: number; date: string; weight?: number }

export function loadVbtHistoryCB(): VbtHistoryEntry[] {
  try {
    for (const key of ['he_combat_vbt_log','he_vbt_log','he_vbt_history','he_training_vbt']) {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        const out = arr.map((x: any) => ({
          liftId: String(x.liftId || x.id || x.exerciseId || 'squat'),
          velocity: Number(x.velocity ?? x.vel ?? x.v),
          date: String(x.date || new Date().toISOString().slice(0,10)),
          weight: x.weight != null ? Number(x.weight) : undefined,
        })).filter((e: any) => Number.isFinite(e.velocity) && e.velocity > 0.05 && e.velocity < 4);
        if (out.length) return out;
      }
    }
    // fallback: workout_log may contain velocity
    try {
      const wl = typeof localStorage !== 'undefined' ? localStorage.getItem('he_workout_log') : null;
      if (wl) {
        const arr = JSON.parse(wl);
        const out: VbtHistoryEntry[] = [];
        for (const sess of arr || []) for (const ex of (sess.exercises || [])) for (const s of (ex.sets || [])) if (s.velocity) out.push({ liftId: ex.id || ex.name, velocity: Number(s.velocity), date: sess.date, weight: s.weight });
        if (out.length) return out.slice(-48);
      }
    } catch {}
  } catch {}
  return [];
}

export function saveVbtHistoryCB(entries: VbtHistoryEntry[]): void {
  try { localStorage.setItem('he_combat_vbt_log', JSON.stringify(entries.slice(-48))); } catch {}
}

export function vbtEwma(velocities: number[], alpha = 0.3): number | null {
  if (!Array.isArray(velocities) || velocities.length===0) return null;
  const vals = velocities.filter(v=> typeof v==='number' && v>0.05 && v<4);
  if (!vals.length) return null;
  let ewma = vals[0];
  for (let i=1;i<vals.length;i++) ewma = alpha*vals[i] + (1-alpha)*ewma;
  return Math.round(ewma*100)/100;
}

export function vbtHistoryForLift(history: VbtHistoryEntry[], liftId: string): number[] {
  const low = (liftId||'').toLowerCase();
  return history.filter(e => e.liftId.toLowerCase()===low || e.liftId.toLowerCase().includes(low) || low.includes(e.liftId.toLowerCase())).map(e=> e.velocity);
}

export function diagnoseVelocityLossEwma(bestVel: number, history: number[]|VbtHistoryEntry[], liftId?: string, threshold: 20|10|25|40 = 20, weight?: number): { lossPct: number; zone: string; exceeded: boolean; e1RMByVelocity: number | null; ewma: number | null; recommendation: string } {
  const vels = Array.isArray(history) && history.length && typeof (history as any)[0]==='object' && 'velocity' in (history as any)[0] ? (history as VbtHistoryEntry[]).filter(e=> !liftId || e.liftId===liftId).map(e=> e.velocity) : history as number[];
  const ewma = vbtEwma(vels);
  const last = vels.length ? vels[vels.length-1] : bestVel * 0.85;
  return { ...diagnoseVelocityLossCombat(bestVel, last, threshold, weight, liftId), ewma };
}

export function vbtTrendForLift(history: VbtHistoryEntry[], liftId: string): { recentEwma: number | null; prevEwma: number | null; changePct: number | null } {
  const vels = vbtHistoryForLift(history, liftId);
  if (vels.length < 6) return { recentEwma: null, prevEwma: null, changePct: null };
  const recent = vbtEwma(vels.slice(-7));
  const prev = vbtEwma(vels.slice(-14, -7));
  if (recent == null || prev == null || prev===0) return { recentEwma: recent, prevEwma: prev, changePct: null };
  const changePct = Math.round((recent - prev)/prev*100*10)/10;
  return { recentEwma: recent, prevEwma: prev, changePct };
}

export { thresholdForIntent };
export type { VBTIntent, VelocityLossResult };
