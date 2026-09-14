/**
 * combat-rotation-vbt.engine.ts — P10 честная VBT-калибровка ротации/баллистики.
 * Позиция (не меняется): калибровать удар жимом — врать, поэтому ротация
 * (landmine/medball/sledge/канаты) НЕ маппится на bench/squat — только
 * loss-порог по цели (combatLossThresholdForGoal: power/camp 20, endurance 30,
 * иначе 25) + зона из канона pro/vbt. e1RM по скорости НЕ считаем никогда.
 * REUSE: velocityLossZone из pro/vbt, combatLossThresholdForGoal из combat-vbt.
 */
import { velocityLossZone } from '../pro/vbt.engine';
import { combatLossThresholdForGoal } from '../combat/combat-vbt.engine';

export type CombatRotationGoal = 'power' | 'endurance' | 'camp' | 'other';

const ROTATIONAL_RE =
  /landmine_rotation|landmine_180|med_ball_rot_throw|med_ball_throw|med_ball_slam|sledge_hammer|battle_rope|pallof_rotation_press/i;

/** Ротация/баллистика — некалибрована по определению (нет LVP-профиля). */
export function isRotationalUncalibrated(exerciseId: string | null | undefined): boolean {
  if (!exerciseId) return true;
  return ROTATIONAL_RE.test(exerciseId);
}

export interface CombatRotationVelocity {
  lossPct: number | null;
  zone: string;
  threshold: number;
  calibrated: false;
  e1RMByVelocity: null;
  recommendation: string;
}

export function diagnoseRotationVelocity(
  bestVel: number | null | undefined,
  lastVel: number | null | undefined,
  exerciseId: string,
  goal: CombatRotationGoal = 'other',
): CombatRotationVelocity {
  const threshold = combatLossThresholdForGoal(
    goal === 'power' || goal === 'camp' ? 'power' : goal === 'endurance' ? 'endurance' : 'general',
  );
  if (bestVel == null || lastVel == null || !Number.isFinite(bestVel) || !Number.isFinite(lastVel) || bestVel <= 0) {
    return {
      lossPct: null, zone: 'unknown', threshold, calibrated: false, e1RMByVelocity: null,
      recommendation: `Нет пары замеров для ${exerciseId} — введите лучшую и последнюю скорость`,
    };
  }
  const lossPct = ((bestVel - lastVel) / bestVel) * 100;
  const zone = velocityLossZone(lossPct);
  const rec = lossPct > 30
    ? `Потеря ${lossPct.toFixed(0)}% (порог ${threshold}): стоп, техника рассыпалась — отдых и перезамер`
    : lossPct > threshold
      ? `Потеря ${lossPct.toFixed(0)}% выше порога ${threshold}: снизить объём ротации, e1RM не считаем (нет калибровки)`
      : `Потеря ${lossPct.toFixed(0)}% в пределах порога ${threshold} — работайте дальше`;
  return { lossPct, zone, threshold, calibrated: false, e1RMByVelocity: null, recommendation: rec };
}
