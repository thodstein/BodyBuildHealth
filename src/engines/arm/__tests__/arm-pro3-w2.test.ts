import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveRedFlags, loadRedFlags, loadRedFlagLog, hasStopFlag, redFlagLabels, ARM_RED_FLAG_DEFS,
} from '../arm-redflags.store';
import { wafClassFor, armliftNormsFor, normPct } from '../arm-norms-table.engine';
import { buildArmBridgeData } from '../arm-bridge-payload.engine';
import { buildArmDiagnosticsHtml, buildArmDiagnosticsCsv } from '../arm-diagnostics-export.engine';

/**
 * PRO-3 W2: персист и нормы — P4 (red-flags), P5 (движковая часть сценариев — сторадж-хелперы
 * живут в UI, здесь контракт), P3 (WAF-классы).
 */
describe('PRO-3 W2 P4: red-flags стор', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* noop */ }
  });
  it('save/load roundtrip', () => {
    expect(loadRedFlags()).toEqual([]);
    saveRedFlags(['pain', 'numb']);
    expect(loadRedFlags()).toEqual(['pain', 'numb']);
  });
  it('пустой выбор пишется (осознанное «чисто») и читается', () => {
    saveRedFlags(['pain']);
    saveRedFlags([]);
    expect(loadRedFlags()).toEqual([]);
    expect(loadRedFlagLog().length).toBe(2);
  });
  it('битый стор → []', () => {
    try { localStorage.setItem('he_arm_diag_redflags', 'not-json{{{'); } catch { /* noop */ }
    expect(loadRedFlags()).toEqual([]);
  });
  it('стоп-флаги: боль/онемение — стоп, щелчки — нет', () => {
    expect(hasStopFlag(['pain'])).toBe(true);
    expect(hasStopFlag(['numb'])).toBe(true);
    expect(hasStopFlag(['click'])).toBe(false);
    expect(hasStopFlag([])).toBe(false);
  });
  it('метки по id', () => {
    expect(redFlagLabels(['pain', 'click'])).toEqual(['Острая боль', 'Щелчки в локте']);
    expect(ARM_RED_FLAG_DEFS.length).toBe(5);
  });
  it('мост несёт armRedFlags (пусто → [])', () => {
    const base: any = {
      groups: [], technique: 'hook', weakPoints: [], biomechCards: [], corrections: [], scoring: null,
      diag: {}, angles: {}, force: {}, vbt: {}, dynamic: {}, bench: {}, tendon: 8, findings: [],
      humerus: [], balance: [], asymmetry: null, info: [], weakCauses: {}, topByPoint: {},
      spec: null, mobilityFails: [], acwrDanger: [], bilateral: null, attempts: [],
    };
    expect((buildArmBridgeData({ ...base, redFlags: ['pain'] }) as any).armRedFlags).toEqual(['pain']);
    expect((buildArmBridgeData(base) as any).armRedFlags).toEqual([]);
  });
  it('экспорт содержит red-flags секцию (HTML+CSV), пусто — тишина', () => {
    const data: any = {
      date: '2026-09-11', level: 'intermediate', technique: 'hook', points: [],
      redFlags: ['Острая боль', 'Онемение пальцев'],
    };
    const html = buildArmDiagnosticsHtml(data);
    expect(html).toContain('Red-flags');
    expect(html).toContain('Острая боль');
    const csv = buildArmDiagnosticsCsv(data);
    expect(csv).toContain('redflags;');
    const emptyHtml = buildArmDiagnosticsHtml({ ...data, redFlags: [] });
    expect(emptyHtml).not.toContain('Red-flags');
  });
});

describe('PRO-3 W2 P3: WAF-классы и нормы', () => {
  it('муж 82.5 → М-85, до границы 2.5', () => {
    const c = wafClassFor(82.5, 'male');
    expect(c.cls).toBe('85');
    expect(c.label).toBe('М-85');
    expect(c.toNext).toBe(2.5);
  });
  it('жен 62 → Ж-65 (женская сетка, не мужская)', () => {
    const c = wafClassFor(62, 'female');
    expect(c.cls).toBe('65');
    expect(c.label).toBe('Ж-65');
    // по мужской сетке было бы 65 тоже — берём различающий кейс:
    const c2 = wafClassFor(58, 'female');
    expect(c2.cls).toBe('60');
    expect(c2.label).toBe('Ж-60');
  });
  it('тяж 120 → открытая, без сгонки', () => {
    const c = wafClassFor(120, 'male');
    expect(c.cls).toBe('110+');
    expect(c.limit).toBeNull();
    expect(c.toNext).toBeNull();
  });
  it('нормы снарядов: RT М/Ж из канона, Excalibur без числа', () => {
    const m = armliftNormsFor('male');
    const f = armliftNormsFor('female');
    expect(m.find((n) => n.implement === 'rolling_thunder')?.wrKg).toBe(130.5);
    expect(f.find((n) => n.implement === 'rolling_thunder')?.wrKg).toBe(77.2);
    const ex = m.find((n) => n.implement === 'excalibur');
    expect(ex?.wrKg).toBeNull();
    expect(ex?.source).toContain('SAR');
  });
  it('normPct: 65.25/130.5 = 50%', () => {
    expect(normPct(65.25, 130.5)).toBe(50);
    expect(normPct(0, 130.5)).toBeNull();
    expect(normPct(60, null)).toBeNull();
  });
});
