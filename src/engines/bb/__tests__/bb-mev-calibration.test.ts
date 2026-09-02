import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildMEVCalibration, recordMEVCalibrationWeek, resolveMEVAfterCalibration,
  isMEVCalibrationComplete, mevCalibrationProgress, personalLandmarksFor,
  calibratedLandmarksFor, saveMEVCalibration, loadMEVCalibration, clearMEVCalibration,
  startSetsForCalibration, mevSignalDegradation, allCalibrationMuscles,
} from '../bb-mev-calibration.engine';

const GOOD: { pump: number; soreness: number; performance: number } = { pump: 4, soreness: 1, performance: 4 };
const DEGRADED: { pump: number; soreness: number; performance: number } = { pump: 2, soreness: 4, performance: 2 };

describe('bb-mev-calibration', () => {
  beforeEach(() => clearMEVCalibration());

  it('startSetsForCalibration = популяционный MEV − 2 (флор 2)', () => {
    const s = startSetsForCalibration('intermediate', ['chest', 'biceps']);
    // intermediate chest mev=8 → 6; biceps mev=4 → 2 (флор 2)
    expect(s.chest).toBe(6);
    expect(s.biceps).toBe(2);
    // delt_front mev=0 → флор 2
    expect(startSetsForCalibration('intermediate', ['delt_front']).delt_front).toBe(2);
  });

  it('buildMEVCalibration формирует протокол без недель', () => {
    const cal = buildMEVCalibration('intermediate', ['chest', 'back'], '2026-09-01');
    expect(cal.weeks).toHaveLength(0);
    expect(cal.startSetsByMuscle.chest).toBeGreaterThan(0);
    expect(isMEVCalibrationComplete(cal)).toBe(false);
  });

  it('mevSignalDegradation: soreness>=3 или performance<3', () => {
    expect(mevSignalDegradation(GOOD)).toBe(false);
    expect(mevSignalDegradation({ ...GOOD, soreness: 3 })).toBe(true);
    expect(mevSignalDegradation({ ...GOOD, performance: 2 })).toBe(true);
  });

  it('recordMEVCalibrationWeek с хорошим сигналом не разрешает', () => {
    let cal = buildMEVCalibration('intermediate', ['chest']);
    cal = recordMEVCalibrationWeek(cal, GOOD);
    expect(cal.weeks).toHaveLength(1);
    expect(isMEVCalibrationComplete(cal)).toBe(false);
  });

  it('2 подряд деградации → авто-разрешение', () => {
    let cal = buildMEVCalibration('intermediate', ['chest']);
    cal = recordMEVCalibrationWeek(cal, GOOD);      // нед 1 ок
    cal = recordMEVCalibrationWeek(cal, DEGRADED);  // нед 2 деградация (1-я)
    expect(isMEVCalibrationComplete(cal)).toBe(false);
    cal = recordMEVCalibrationWeek(cal, DEGRADED);  // нед 3 деградация (2-я подряд)
    expect(isMEVCalibrationComplete(cal)).toBe(true);
    expect(cal.userMevByMuscle!.chest).toBeDefined();
  });

  it('resolveMEVAfterCalibration без деградаций: mev = start + недель', () => {
    let cal = buildMEVCalibration('intermediate', ['chest']);
    // start chest = 6; 3 недели без деградации → mev = 9
    cal = recordMEVCalibrationWeek(cal, GOOD);
    cal = recordMEVCalibrationWeek(cal, GOOD);
    cal = recordMEVCalibrationWeek(cal, GOOD);
    const resolved = resolveMEVAfterCalibration(cal);
    expect(resolved.userMevByMuscle!.chest).toBe(9);
    expect(isMEVCalibrationComplete(resolved)).toBe(true);
  });

  it('resolveMEVAfterCalibration с деградацией: mev = сеты последней недели без деградации', () => {
    let cal = buildMEVCalibration('intermediate', ['chest']);
    cal = recordMEVCalibrationWeek(cal, GOOD);      // нед1 ок → mev 7
    cal = recordMEVCalibrationWeek(cal, GOOD);      // нед2 ок → mev 8
    cal = recordMEVCalibrationWeek(cal, DEGRADED);  // нед3 деградация → стоп
    const resolved = resolveMEVAfterCalibration(cal);
    expect(resolved.userMevByMuscle!.chest).toBe(8);
  });

  it('personalLandmarksFor: оверрайд mev, mav/mrv масштабируются, MRV ≤ +30% потолка', () => {
    let cal = buildMEVCalibration('intermediate', ['chest']);
    cal = recordMEVCalibrationWeek(cal, GOOD);
    cal = recordMEVCalibrationWeek(cal, GOOD);
    cal = resolveMEVAfterCalibration(cal); // mev chest = 8
    const lm = personalLandmarksFor('intermediate', 'chest', 7, cal)!;
    expect(lm.mev).toBe(8);
    // intermediate chest table mev=8 → ratio 1.0; mav=14, mrv=20 (не выше +30%)
    expect(lm.mav).toBeGreaterThanOrEqual(lm.mev);
    expect(lm.mrv).toBeGreaterThanOrEqual(lm.mav);
    expect(lm.mrv).toBeLessThanOrEqual(Math.round(20 * 1.3));
  });

  it('personalLandmarksFor: rotation != 7 дней масштабирует', () => {
    let cal = buildMEVCalibration('intermediate', ['chest']);
    cal = resolveMEVAfterCalibration(cal); // mev = start(6) + 0 = 6
    const lm = personalLandmarksFor('intermediate', 'chest', 4, cal)!;
    // 6 * 4/7 ≈ 3.4 → 3
    expect(lm.mev).toBe(3);
  });

  it('personalLandmarksFor: null без завершённой калибровки / неизвестной мышцы', () => {
    const cal = buildMEVCalibration('intermediate', ['chest']); // не завершена
    expect(personalLandmarksFor('intermediate', 'chest', 7, cal)).toBeNull();
    const done = resolveMEVAfterCalibration(cal);
    expect(personalLandmarksFor('intermediate', 'neck', 7, done)).toBeNull();
  });

  it('calibratedLandmarksFor: personal приоритет, иначе популяционный', () => {
    const cal = resolveMEVAfterCalibration(buildMEVCalibration('intermediate', ['chest']));
    const personal = calibratedLandmarksFor('intermediate', 'chest', 7, cal);
    expect(personal!.mev).toBe(6); // start
    // мышца вне калибровки → популяционный
    const table = calibratedLandmarksFor('intermediate', 'biceps', 7, cal);
    expect(table!.mev).toBe(4);
  });

  it('storage roundtrip: save → load → clear', () => {
    let cal = buildMEVCalibration('intermediate', ['chest', 'back']);
    cal = resolveMEVAfterCalibration(cal);
    saveMEVCalibration(cal);
    const loaded = loadMEVCalibration();
    expect(loaded!.id).toBe(cal.id);
    expect(loaded!.userMevByMuscle!.chest).toBe(cal.userMevByMuscle!.chest);
    expect(mevCalibrationProgress(loaded).resolved).toBe(true);
    clearMEVCalibration();
    expect(loadMEVCalibration()).toBeNull();
  });

  it('mevCalibrationProgress: недели и флаг', () => {
    let cal = buildMEVCalibration('intermediate', ['chest']);
    expect(mevCalibrationProgress(cal)).toEqual({ weeksDone: 0, resolved: false });
    cal = recordMEVCalibrationWeek(cal, GOOD);
    expect(mevCalibrationProgress(cal)).toEqual({ weeksDone: 1, resolved: false });
    expect(mevCalibrationProgress(null)).toEqual({ weeksDone: 0, resolved: false });
  });

  it('allCalibrationMuscles возвращает канонические группы', () => {
    const m = allCalibrationMuscles('intermediate');
    expect(m).toContain('chest');
    expect(m).toContain('quads');
    expect(m.length).toBeGreaterThan(8);
  });
});
