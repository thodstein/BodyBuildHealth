import { describe, it, expect } from 'vitest';
import { diagnoseRotationVelocity, isRotationalUncalibrated } from '../combat-rotation-vbt.engine';

/** P10: ротация некалибрована всегда; пороги по цели; e1RM никогда; штанга не тронута. */
describe('combat rotation-vbt (P10 honest)', () => {
  it('ротация и пусто — некалиброваны', () => {
    expect(isRotationalUncalibrated('landmine_rotation')).toBe(true);
    expect(isRotationalUncalibrated('med_ball_rot_throw')).toBe(true);
    expect(isRotationalUncalibrated('sledge_hammer')).toBe(true);
    expect(isRotationalUncalibrated('battle_rope')).toBe(true);
    expect(isRotationalUncalibrated(null)).toBe(true);
    expect(isRotationalUncalibrated('bench_bar')).toBe(false);
  });

  it('пороги по цели: power/camp 20, endurance 30', () => {
    expect(diagnoseRotationVelocity(3, 2.9, 'med_ball_rot_throw', 'power').threshold).toBe(20);
    expect(diagnoseRotationVelocity(3, 2.9, 'med_ball_rot_throw', 'camp').threshold).toBe(20);
    expect(diagnoseRotationVelocity(3, 2.9, 'med_ball_rot_throw', 'endurance').threshold).toBe(30);
  });

  it('e1RM не считаем никогда, потеря ориентировочная', () => {
    const d = diagnoseRotationVelocity(3.0, 2.0, 'sledge_hammer', 'power');
    expect(d.calibrated).toBe(false);
    expect(d.e1RMByVelocity).toBeNull();
    expect(d.lossPct).toBeCloseTo(33.3, 0);
    expect(d.recommendation).toMatch(/стоп/);
    const ok = diagnoseRotationVelocity(3.0, 2.9, 'landmine_rotation', 'power');
    expect(ok.e1RMByVelocity).toBeNull();
    expect(ok.recommendation).toMatch(/в пределах/);
  });

  it('без пары замеров — честный запрос, не ноль', () => {
    const d = diagnoseRotationVelocity(null, 2.0, 'med_ball_throw', 'power');
    expect(d.lossPct).toBeNull();
    expect(d.recommendation).toMatch(/введите/);
  });
});
