import { describe, it, expect } from 'vitest';
import { SM_BIOMECH, diagnoseSMWeakPoint, isValidAngleForSMWeakPoint, SM_WEAKPOINT_BY_EVENT } from '../strength-sport-sm-biomechanics.engine';
import { scoreSM } from '../strength-sport-sm-scoring.engine';
import { buildDiaryTrendSM, detectSMWeakFromDiary } from '../strength-sport-sm-diary.engine';
import { diagnoseCarrySway, carrySwayFromPoints } from '../strength-sport-video.engine';
import { buildSMDiagnosticsHtml, buildSMCsv } from '../strength-sport-sm-export.engine';

describe('Strongman diagnostics PRO: SM_BIOMECH 13', () => {
  it('13 phases present', () => {
    expect(Object.keys(SM_BIOMECH).length).toBeGreaterThanOrEqual(13);
    expect(SM_BIOMECH.log_dip).toBeDefined();
    expect(SM_BIOMECH.yoke_walk).toBeDefined();
    expect(SM_BIOMECH.stone_load).toBeDefined();
    expect(SM_BIOMECH.farmers_grip).toBeDefined();
  });
  it('angle validation', () => {
    expect(isValidAngleForSMWeakPoint('log_dip', 10)).toBe(true);
    expect(isValidAngleForSMWeakPoint('log_dip', 20)).toBe(false);
    expect(SM_BIOMECH.log_dip.references.length).toBeGreaterThan(0);
  });
  it('corrections non-empty', () => {
    for (const k of Object.keys(SM_BIOMECH)) {
      const b = (SM_BIOMECH as any)[k];
      expect(b.corrections.length).toBeGreaterThan(0);
      expect(b.biomechanicalReason.length).toBeGreaterThan(20);
    }
  });
  it('SM_WEAKPOINT_BY_EVENT', () => {
    expect(SM_WEAKPOINT_BY_EVENT.log_press).toContain('log_dip');
    expect(SM_WEAKPOINT_BY_EVENT.yoke_walk).toContain('yoke_walk');
    expect(SM_WEAKPOINT_BY_EVENT.atlas_stone_load).toContain('stone_lap');
  });
  it('diagnoseSMWeakPoint', () => {
    expect(diagnoseSMWeakPoint('yoke_walk')?.label).toContain('Йок');
  });
});

describe('Strongman scoring RSS', () => {
  it('balance 100', () => {
    const r = scoreSM({ weakCount: 0, mobilityFails: 0, gripFails: 0, hasMobility: true, hasGrip: true });
    expect(r.score).toBe(100);
    expect(r.level).toBe('ok');
  });
  it('3 weak → warn/critical', () => {
    const r = scoreSM({ weakCount: 3, hasVideo: false });
    expect(r.score).toBeLessThan(80);
    expect(r.penalties.length).toBe(3);
  });
  it('asymmetry floor', () => {
    const r = scoreSM({ weakCount: 0, asymmetryPct: 13, hasVideo: true });
    expect(r.floors.length).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(49);
  });
  it('sway critical floor', () => {
    const r = scoreSM({ weakCount: 1, carrySwayCm: 5.5 });
    expect(r.floors.some(f => f.includes('Sway'))).toBe(true);
    expect(r.score).toBeLessThanOrEqual(49);
  });
  it('VBT 15% warn', () => {
    const r = scoreSM({ weakCount: 0, vbtLossPct: 16 });
    expect(r.findings.some(f => f.text.includes('VBT'))).toBe(true);
  });
  it('grip fails floor', () => {
    const r = scoreSM({ weakCount: 0, gripFails: 2 });
    expect(r.floors.length).toBeGreaterThan(0);
  });
  it('verification', () => {
    const r = scoreSM({ weakCount: 1, hasVideo: true, hasVbt: true, hasMobility: true, hasGrip: true });
    expect(r.verification).toBe(1);
  });
});

describe('Strongman diary', () => {
  it('buildDiaryTrendSM empty → null', () => {
    expect(buildDiaryTrendSM([])).toBeNull();
  });
  it('downtrend detect', () => {
    const now = Date.now();
    const mk = (name: string, w: number, daysAgo: number) => ({ exerciseName: name, date: new Date(now - daysAgo * 86400000).toISOString(), sets: [{ weight: w, reps: 1 }] });
    const logs = [
      mk('yoke_walk', 300, 5), mk('yoke_walk', 320, 35),
      mk('farmers_walk_heavy', 120, 5), mk('farmers_walk_heavy', 140, 35),
    ];
    const t = buildDiaryTrendSM(logs);
    expect(t).not.toBeNull();
    const y = t!.find(x => x.lift === 'yoke');
    expect(y).toBeDefined();
  });
  it('detectSMWeak', () => {
    const now = Date.now();
    const mk = (name: string, w: number, d: number) => ({ exerciseName: name, date: new Date(now - d * 86400000).toISOString(), sets: [{ weight: w, reps: 1 }] });
    const logs = [mk('yoke_walk', 250, 5), mk('yoke_walk', 300, 35)];
    expect(detectSMWeakFromDiary(logs).length).toBeGreaterThan(0);
  });
});

describe('Carry sway', () => {
  it('diagnoseCarrySway thresholds', () => {
    expect(diagnoseCarrySway(2).severity).toBe('ok');
    expect(diagnoseCarrySway(4).severity).toBe('warn');
    expect(diagnoseCarrySway(6).severity).toBe('critical');
  });
  it('carrySwayFromPoints', () => {
    const pts = [{ x: -1, y: 0, t: 0 }, { x: 1, y: 10, t: 0.1 }, { x: 2, y: 20, t: 0.2 }];
    expect(carrySwayFromPoints(pts)).toBeCloseTo(3, 0);
  });
});

describe('SM export', () => {
  it('html contains score and weak', () => {
    const html = buildSMDiagnosticsHtml({ weakPoints: ['log_dip'], score: 85, level: 'ok', verification: 0.5, findings: ['ok'] });
    expect(html).toContain('85');
    expect(html).toContain('log_dip');
  });
  it('csv rows', () => {
    const csv = buildSMCsv({ weakPoints: ['yoke_walk'], score: 49, level: 'critical', verification: 0.3, findings: ['floor'] });
    expect(csv).toContain('yoke_walk');
    expect(csv).toContain('49');
  });
  it('platform+tacky in html', () => {
    const html = buildSMDiagnosticsHtml({ weakPoints: [], score: 100, level: 'ok', verification: 1, platformHeightCm: 140, tacky: true, findings: [] });
    expect(html).toContain('140');
  });
});
