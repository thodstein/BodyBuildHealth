/**
 * ta-v5.test.ts — V5: turnover/catch, глубокий толчок, баланс тяг,
 * баллистик-оговорка, анти-смешивание, re-screen фаз, возрастная шкала.
 */
import { turnoverDiag, jerkDriveDiag, pullPowerBalance, lvpBallisticNote, movementOfWeak, mixedWaveNote } from '../strength-sport-ta-v5.engine';
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
