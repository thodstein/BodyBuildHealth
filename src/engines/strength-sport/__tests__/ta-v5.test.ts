/**
 * ta-v5.test.ts — V5: turnover/catch, глубокий толчок, баланс тяг,
 * баллистик-оговорка, анти-смешивание, re-screen фаз, возрастная шкала.
 */
import { turnoverDiag, jerkDriveDiag, pullPowerBalance, lvpBallisticNote, movementOfWeak, mixedWaveNote } from '../strength-sport-ta-v5.engine';
import { analyzeBarTracking } from '../strength-sport-video.engine';
import { appendTAPullPower, taPullPowerTrend } from '../strength-sport-ta-pullpower-history.engine';
import { qPoints, qMasterFactor, qMasters } from '../strength-sport-ta-progress.engine';
import { appendTAPhaseSnapshot, taPhaseTrend } from '../strength-sport-ta-phase-history.engine';
import { qAgeScale } from '../strength-sport-ta-progress.engine';

describe('V5 turnover/catch', () => {
  it('пусто → null (не гадаем)', () => {
    expect(turnoverDiag({})).toBeNull();
  });
  it('медленный уход + высокий приём + overpull', () => {
    const r = turnoverDiag({ yMaxCm: 135, turnoverMs: 600, catchKneeDeg: 120 })!;
    expect(r.turnover).toBe('slow');
    expect(r.catch).toBe('high');
    expect(r.overpull).toBe(true);
    expect(r.text).toMatch(/перетягиваешь/);
  });
  it('низкий бар + быстрый уход = маркер успеха', () => {
    const r = turnoverDiag({ yMaxCm: 118, turnoverMs: 300, catchKneeDeg: 70 })!;
    expect(r.turnover).toBe('fast');
    expect(r.catch).toBe('deep');
    expect(r.text).toMatch(/маркер успеха/);
  });
  it('префикс движения + молчание без фактов', () => {
    const r = turnoverDiag({ yMaxCm: 118, turnoverMs: 300, catchKneeDeg: 70, lift: 'clean' })!;
    expect(r.text.startsWith('Взятие:')).toBe(true);
    expect(turnoverDiag({ yMaxCm: 125 })).toBeNull();
  });
});

describe('V5 jerk drive', () => {
  it('пусто → null', () => {
    expect(jerkDriveDiag({})).toBeNull();
  });
  it('увод назад + быстрый dip', () => {
    const t = jerkDriveDiag({ catchBackCm: 6, dipFast: true, hipFast: true })!;
    expect(t).toMatch(/маркер успеха/);
    expect(t).toMatch(/быстрое сгибание/);
  });
  it('увода нет — честный совет', () => {
    expect(jerkDriveDiag({ catchBackCm: 0 })!).toMatch(/за линию ушей/);
  });
});

describe('V5 pull balance', () => {
  it('пусто → null', () => {
    expect(pullPowerBalance({})).toBeNull();
  });
  it('низкий Hmax + мощность = успех', () => {
    const t = pullPowerBalance({ yMaxCm: 110, normLo: 115, normHi: 131, secondPullW: 2000, bwKg: 80 })!;
    expect(t).toMatch(/маркер успеха/);
    expect(t).toMatch(/25 Вт\/кг/);
  });
  it('высокий Hmax + мощность = тяни/садись', () => {
    expect(pullPowerBalance({ yMaxCm: 140, normLo: 115, normHi: 131, secondPullW: 2000, bwKg: 80 })!).toMatch(/садись быстрее/);
  });
});

describe('V5 ballistic', () => {
  it('баллистика молчит (рывок)', () => {
    expect(lvpBallisticNote('snatch', 50)).toBeNull();
  });
  it('присед лёгкий → нота', () => {
    expect(lvpBallisticNote('squat', 50)!).toMatch(/тормозной фазой/);
  });
  it('тяжёлая точка молчит', () => {
    expect(lvpBallisticNote('squat', 80)).toBeNull();
  });
});

describe('V5 anti-mix', () => {
  it('движения по префиксу', () => {
    expect(movementOfWeak('snatch_mid')).toBe('snatch');
    expect(movementOfWeak('clean_catch')).toBe('clean');
    expect(movementOfWeak('jerk_drive')).toBe('jerk');
    expect(movementOfWeak('squat_bottom')).toBe('base');
  });
  it('рывок+взятие → варнинг, одно движение молчит', () => {
    expect(mixedWaveNote(['snatch_mid', 'clean_mid'])!).toMatch(/разноси по дням/);
    expect(mixedWaveNote(['snatch_mid', 'snatch_catch'])).toBeNull();
    expect(mixedWaveNote([])).toBeNull();
  });
});

describe('V5 phase history', () => {
  it('один снимок → тренда нет', () => {
    const h = appendTAPhaseSnapshot([], { date: '2026-09-01', weakPoints: ['snatch_mid'] });
    expect(taPhaseTrend(h)).toBeNull();
  });
  it('ушло/висит/новое', () => {
    let h = appendTAPhaseSnapshot([], { date: '2026-09-01', weakPoints: ['snatch_mid', 'jerk_dip'] });
    h = appendTAPhaseSnapshot(h, { date: '2026-09-10', weakPoints: ['jerk_dip', 'clean_mid'] });
    const t = taPhaseTrend(h)!;
    expect(t.resolved).toEqual(['snatch_mid']);
    expect(t.persistent).toEqual(['jerk_dip']);
    expect(t.fresh).toEqual(['clean_mid']);
  });
  it('тот же день перезаписывается, кап держится', () => {
    let h = appendTAPhaseSnapshot([], { date: '2026-09-01', weakPoints: ['a'] });
    h = appendTAPhaseSnapshot(h, { date: '2026-09-01', weakPoints: ['b'] });
    expect(h.length).toBe(1);
    expect(h[0].weakPoints).toEqual(['b']);
  });
});

describe('V5 age scale', () => {
  it('гейты: пусто/ребёнок → null', () => {
    expect(qAgeScale(null)).toBeNull();
    expect(qAgeScale(10)).toBeNull();
  });
  it('юноша/взрослый/мастер', () => {
    expect(qAgeScale(15)!.scale).toBe('Q-youth');
    expect(qAgeScale(25)!.scale).toBe('Q-points');
    expect(qAgeScale(45)!.scale).toBe('Q-masters');
  });
});

describe('П2 turnover из трекинга', () => {
  const riseThenFall = () => {
    const pts: Array<{ x: number; y: number; t: number }> = [];
    for (let i = 0; i < 10; i++) pts.push({ x: 0, y: i * 10, t: i / 30 });
    for (let i = 1; i <= 8; i++) pts.push({ x: 0, y: 90 - i * 7, t: (9 + i) / 30 });
    return pts;
  };
  it('подъём→падение даёт turnoverMs в коридоре', () => {
    const r = analyzeBarTracking(riseThenFall())!;
    expect(r.turnoverMs).not.toBeNull();
    expect(r.turnoverMs as number).toBeGreaterThanOrEqual(100);
    expect(r.turnoverMs as number).toBeLessThanOrEqual(600);
  });
  it('монотонный подъём → null (не гадаем)', () => {
    const pts = Array.from({ length: 12 }, (_, i) => ({ x: 0, y: i * 8, t: i / 30 }));
    expect(analyzeBarTracking(pts)!.turnoverMs).toBeNull();
  });
  it('пусто/мало точек → null', () => {
    expect(analyzeBarTracking([])).toBeNull();
    expect(analyzeBarTracking([{ x: 0, y: 0, t: 0 }])).toBeNull();
  });
});

describe('П3 история мощности', () => {
  it('один замер → тренда нет', () => {
    const h = appendTAPullPower([], { date: '2026-09-01', watts: 1800 });
    expect(taPullPowerTrend(h)).toBeNull();
  });
  it('дельта + лучшая', () => {
    let h = appendTAPullPower([], { date: '2026-09-01', watts: 1800 });
    h = appendTAPullPower(h, { date: '2026-09-10', watts: 1950 });
    const t = taPullPowerTrend(h)!;
    expect(t.deltaW).toBe(150);
    expect(t.bestW).toBe(1950);
    expect(t.text).toMatch(/\+150Вт/);
  });
  it('мусор отсеивается, день перезаписывается', () => {
    let h = appendTAPullPower([{ date: 'x', watts: NaN } as any], { date: '2026-09-01', watts: 1800.6 });
    expect(h[0].watts).toBe(1801);
    h = appendTAPullPower(h, { date: '2026-09-01', watts: 1700 });
    expect(h.length).toBe(1);
    expect(h[0].watts).toBe(1700);
  });
});

describe('П4 Q-masters (MF/HMF дословно)', () => {
  it('гейты: молодым и без данных — null', () => {
    expect(qMasterFactor(null, 'male')).toBeNull();
    expect(qMasterFactor(29, 'male')).toBeNull();
    expect(qMasters(200, 80, 'male', 25)).toBeNull();
    expect(qMasters(null, 80, 'male', 40)).toBeNull();
  });
  it('точечные значения таблиц (weighttraining.nz / IMWA)', () => {
    expect(qMasterFactor(30, 'male')).toBe(1);
    expect(qMasterFactor(30, 'female')).toBe(1);
    expect(qMasterFactor(40, 'male')).toBe(1.112);
    expect(qMasterFactor(40, 'female')).toBe(1.108);
    expect(qMasterFactor(60, 'male')).toBe(1.477);
    // Huebner 2019: у женщин после ~45 спад круче, чем у мужчин
    expect(qMasterFactor(60, 'female')).toBe(1.704);
  });
  it('Q-masters = Q-points × фактор; кламп края', () => {
    const q = qPoints(200, 80, 'male')!;
    expect(qMasters(200, 80, 'male', 40)).toBe(Math.round(q * 1.112 * 100) / 100);
    expect(qMasterFactor(120, 'male')).toBe(4.863);
    expect(qMasterFactor(120, 'female')).toBe(3.935);
  });
  it('монотонность неубывания 30–90', () => {
    for (let a = 31; a <= 90; a++) {
      expect(qMasterFactor(a, 'male') as number).toBeGreaterThanOrEqual(qMasterFactor(a - 1, 'male') as number);
      expect(qMasterFactor(a, 'female') as number).toBeGreaterThanOrEqual(qMasterFactor(a - 1, 'female') as number);
    }
  });
});
