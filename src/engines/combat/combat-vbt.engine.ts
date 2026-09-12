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

/**
 * P6: честный маппинг. Баллистика (медболы/кувалда/канаты/прыжки/мах) — null
 * (нет калибровки кривой «скорость-%1RM» для ударов; калибровать жимом/приседом — врать).
 * Неизвестное — null, а не молчаливый squat.
 */
const BALLISTIC_RE = /med_ball|sledge|battle_rope|box_jump|depth_jump|broad_jump|kb_swing|throw|slam/i;

export function isCombatLiftCalibrated(id: string | null | undefined): boolean {
  return mapCombatLift(id || '') !== null;
}

function mapCombatLift(id: string): VBTLift | null {
  const low = id.toLowerCase();
  if (BALLISTIC_RE.test(low)) return null;
  if (low.includes('landmine_rotation') || low.includes('landmine_180')) return null;
  if (low.includes('bench') || low.includes('ohp') || low.includes('push_press') || low.includes('landmine_press')) return 'bench';
  if (low.includes('squat') || low.includes('lunge') || low.includes('step_up')) return 'squat';
  if (low.includes('dead') || low.includes('rdl') || low.includes('trap_bar') || low.includes('pull') || low.includes('row')) return 'deadlift';
  if (low.includes('press')) return 'bench';
  return null;
}

export function velocityForCombat(pct1RM: number, liftId?: string): number {
  // liftId не передан — legacy generic (squat-кривая, как раньше); явный id — честный маппинг (null → NaN)
  const lift = mapCombatLift(liftId == null ? 'squat' : liftId);
  if (!lift) return NaN;
  return baseVelocityForPct(lift, pct1RM);
}

export function estimate1RMFromVelocityCombat(weight: number, velocity: number, liftId?: string): number {
  const lift = mapCombatLift(liftId == null ? 'squat' : liftId);
  if (!lift) return 0;
  if (velocity <= 0 || weight <= 0) return 0;
  return baseEstimate(lift, velocity, weight).e1RM || 0;
}

export function diagnoseVelocityLossCombat(bestVel: number, lastVel: number, threshold: 20 | 10 | 25 | 40 = 20, weight?: number, liftId?: string): {
  lossPct: number; zone: string; exceeded: boolean; e1RMByVelocity: number | null; recommendation: string; calibrated: boolean;
} {
  const vl = baseVelocityLoss([bestVel, lastVel], threshold as any);
  const lossPct = vl?.lossPct ?? 0;
  const exceeded = !!vl?.exceeded;
  const zone = baseZone(lossPct);
  // liftId не передан — legacy generic (squat, как раньше); явный id — честный маппинг
  const calibrated = liftId == null ? true : isCombatLiftCalibrated(liftId);
  const e1RMByVelocity = calibrated && weight && weight > 0 && lastVel > 0 ? estimate1RMFromVelocityCombat(weight, lastVel, liftId) : null;
  let rec = '';
  if (lossPct > 30) rec = 'Стоп сет — ЦНС устала';
  else if (lossPct > 25) rec = 'Снизьте вес 5%, RIR+1';
  else if (lossPct > 20) rec = 'RIR+1 — контроль';
  else rec = 'Оптимально — можно добавить сет';
  if (!calibrated) rec = `Нет калибровки скорости для ${liftId || 'движения'} (баллистика) — loss ${lossPct}% ориентировочный, e1RM не считаем`;
  return { lossPct, zone, exceeded, e1RMByVelocity, recommendation: rec, calibrated };
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
  // P6: точный матч по id (lowercase). Двусторонний includes врал: row ловил battle_rope, press — всё.
  const low = (liftId || '').toLowerCase();
  return history.filter(e => (e.liftId || '').toLowerCase() === low).map(e => e.velocity);
}

/**
 * P6: порог потери по цели (вместо дефолта 20 везде):
 * power/camp — 20 (сила, жёстко), endurance — 30 (терпит), остальное — 25.
 */
export function combatLossThresholdForGoal(goal: string | null | undefined): 20 | 25 | 30 {
  if (goal === 'endurance') return 30;
  if (goal === 'power' || goal === 'camp') return 20;
  return 25;
}

/**
 * P6: MCV-критерий перехода ATR (PoinT GO): EWMA-тренд скорости ≥+5% к прошлому блоку
 * подтверждает адаптацию для Transmutation. Возвращает hint-строку или null.
 */
export function atrTransitionHintForTrend(liftId: string, changePct: number | null): string | null {
  if (typeof changePct !== 'number' || !Number.isFinite(changePct)) return null;
  if (changePct >= 5) return `VBT ${liftId} +${changePct}% — адаптация подтверждает переход к Transmutation (MCV-критерий +5%)`;
  return null;
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
