import { describe, it, expect, beforeEach } from 'vitest';
import { scorePlatform, planAttempts, platformWrFor } from '../arm-platform.engine';
import { buildArmDiagnosticsHtml, buildArmDiagnosticsCsv } from '../arm-diagnostics-export.engine';
import { loadArmMeasureHistory, saveArmMeasureSnapshot } from '../arm-force-history.store';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { injectArmCorrections } from '../arm-diagnostics-injection.engine';
import type { ArmWeakPoint } from '../arm-biomechanics.engine';

function basePlan(level = 'intermediate', weeks = 2) {
  const p = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level, goal: 'strength', technique: 'toproll', weeks, gripFocus: 'support' } as any);
  return finalizeArmPlan(p, { level });
}

describe('arm P2 E13: platform', () => {
  it('%WR: 68кг RT = 52.1% M', () => {
    const r = scorePlatform({ implement: 'rolling_thunder', sex: 'male', attempts: [{ attempt: 1, weightKg: 68, success: true }] });
    expect(r.wrPct).toBe(52.1);
    expect(r.worldRecordKg).toBe(130.5);
  });
  it('female WR 77.2', () => {
    expect(platformWrFor('rolling_thunder', 'female')).toBe(77.2);
    const r = scorePlatform({ implement: 'rolling_thunder', sex: 'female', attempts: [{ attempt: 1, weightKg: 77.2, success: true }] });
    expect(r.wrPct).toBe(100);
  });
  it('planAttempts 90/96/102', () => {
    expect(planAttempts(100)).toEqual([90, 96, 102]);
    expect(planAttempts(0)).toEqual([]);
  });
});

describe('arm P2 E14: export', () => {
  const data: any = {
    date: '2026-09-04', level: 'intermediate', technique: 'toproll', score: 72, scoreLevel: 'warn',
    verificationPct: 35, floors: ['Side >9 — humerus cap 49'], asymmetryPct: 8, forceTotal: 60,
    dynamicTactic: 'Быстрый', acwr: 1.1, tendonAcwr: 1.2,
    points: [{ weakPoint: 'pron_open', label: 'Пронация — вход', angleRangeDeg: [90, 120], keyJoint: 'пронация', cause: 'volume (60%)', causeFix: 'Добрать объём', topCorrections: [{ id: 'pronation_cable', score: 100 }], simDelta: '+3 сета' }],
    injectionNotes: ['✓ pron_open → pronation_cable'],
  };
  it('HTML: точки + причины + инъекция', () => {
    const h = buildArmDiagnosticsHtml(data);
    expect(h).toContain('pron_open');
    expect(h).toContain('Пронация — вход');
    expect(h).toContain('Добрать объём');
    expect(h).toContain('Инъекция');
  });
  it('HTML: XSS-esc', () => {
    const h = buildArmDiagnosticsHtml({ ...data, points: [{ weakPoint: 'x', label: '<script>alert(1)</script>' }] });
    expect(h).not.toContain('<script>alert(1)</script>');
    expect(h).toContain('&lt;script&gt;');
  });
  it('CSV: шапка + BOM + точка с запятой', () => {
    const s = buildArmDiagnosticsCsv(data);
    expect(s.charCodeAt(0)).toBe(65279);
    expect(s).toContain('weak_point;label;angle;cause;fix;top3;delta');
    expect(s).toContain('pron_open');
  });
  it('CSV: кавычки при разделителе', () => {
    const s = buildArmDiagnosticsCsv({ ...data, points: [{ weakPoint: 'x', label: 'a;b', cause: 'c"d' }] });
    expect(s).toContain('"a;b"');
    expect(s).toContain('"c""d"');
  });
});

describe('arm P2 E15: snapshots', () => {
  beforeEach(() => { localStorage.clear(); });
  it('roundtrip RT/side/back/L/R', () => {
    saveArmMeasureSnapshot({ rtKg: 68, sideKg: 30, backKg: 50, leftKg: 40, rightKg: 50 });
    const h = loadArmMeasureHistory();
    expect(h.length).toBe(1);
    expect(h[0].rtKg).toBe(68);
    expect(h[0].rightKg).toBe(50);
  });
  it('мусор и пусто игнорируются', () => {
    saveArmMeasureSnapshot({} as any);
    expect(loadArmMeasureHistory()).toEqual([]);
    localStorage.setItem('he_arm_measure_history', 'битое');
    expect(loadArmMeasureHistory()).toEqual([]);
  });
  it('даты ISO и порядок', () => {
    saveArmMeasureSnapshot({ rtKg: 60, date: '2026-08-01' });
    saveArmMeasureSnapshot({ rtKg: 68, date: '2026-09-01' });
    const h = loadArmMeasureHistory();
    expect(h.map((x) => x.rtKg)).toEqual([60, 68]);
  });
});

describe('arm P2 E16: gated side', () => {
  it('gated: side_mid только ремень/изометрия', () => {
    const plan = basePlan('advanced', 2);
    const res = injectArmCorrections(plan, ['side_mid' as ArmWeakPoint], { budget: 500, gatedSideIso: true });
    expect(res.injected).toBeGreaterThanOrEqual(1);
    const allowed = new Set(['side_belt_table', 'table_pushdown_iso', 'internal_rotation_band']);
    // ids только из notes инъекции (в плане могут быть предсуществующие cable — их не считаем)
    const ids = res.notes
      .filter((n) => n.startsWith('✓'))
      .map((n) => (n.match(/→ (\S+) в/) || [])[1])
      .filter(Boolean);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => allowed.has(id as string))).toBe(true);
  });
  it('без gate — обычная инъекция 1 точка', () => {
    const plan = basePlan('intermediate', 2);
    const res = injectArmCorrections(plan, ['side_mid' as ArmWeakPoint], { budget: 500 });
    expect(res.injected).toBeGreaterThanOrEqual(1);
  });
});
