import { describe, it, expect } from 'vitest';
import { failuresFor, faultsFor } from '../armlift-failure-modes.engine';
import { diagnoseArmlift } from '../armlift-diagnosis.engine';
import { rankArmliftCorrections, buildArmliftSpecBlock } from '../armlift-correction.engine';
import { buildArmliftingReport, buildArmliftingHtml, buildArmliftingCsv } from '../armlifting-diagnostics.engine';

describe('PRO-5 D1: точки срыва и фолы per-implement', () => {
  it('RT имеет срыв/середину/локаут и фол рамки', () => {
    expect(failuresFor('rolling_thunder').map((f) => f.id)).toEqual(['off_floor', 'mid', 'lockout']);
    expect(faultsFor('rolling_thunder').some((f) => f.id === 'touch_frame')).toBe(true);
  });
  it('Hub требует 5 подушечек и запрещает ручку', () => {
    const ids = faultsFor('hub').map((f) => f.id);
    expect(ids).toContain('no_fingertips');
    expect(ids).toContain('doorknob');
  });
  it('Axle — только DOH + полка', () => {
    const ids = faultsFor('apollon_axle').map((f) => f.id);
    expect(ids).toContain('not_doh');
    expect(ids).toContain('hip_shelf');
  });
  it('Silver — вертикаль и сет', () => {
    const ids = faultsFor('silver_bullet').map((f) => f.id);
    expect(ids).toContain('off_vertical');
  });
  it('неизвестный снаряд — безопасный fallback', () => {
    expect(failuresFor('zzz').length).toBeGreaterThan(0);
    expect(faultsFor('zzz').length).toBeGreaterThan(0);
  });
});

describe('PRO-5 D1: диагноз слабого звена', () => {
  it('боль — стоп с high', () => {
    const d = diagnoseArmlift({ implement: 'rolling_thunder', pain: true });
    expect(d.weakLink).toBe('conditioning');
    expect(d.confidence).toBe('high');
  });
  it('2+ фола — техника high', () => {
    const d = diagnoseArmlift({ implement: 'rolling_thunder', faultIds: ['not_center', 'body_drag'] });
    expect(d.weakLink).toBe('technique');
    expect(d.confidence).toBe('high');
  });
  it('асимметрия >15 — asymmetry', () => {
    const d = diagnoseArmlift({ implement: 'rolling_thunder', asymmetryPct: 18 });
    expect(d.weakLink).toBe('asymmetry');
  });
  it('pinch-hold <10 — thumb', () => {
    const d = diagnoseArmlift({ implement: 'saxon_bar', pinchHoldSec: 6 });
    expect(d.weakLink).toBe('thumb');
  });
  it('farmer <20 — support_endurance', () => {
    const d = diagnoseArmlift({ implement: 'rolling_thunder', farmerHoldSec: 12 });
    expect(d.weakLink).toBe('support_endurance');
  });
  it('слабая экстензия — wrist_ext', () => {
    const d = diagnoseArmlift({ implement: 'rolling_thunder', wristExtWeak: true });
    expect(d.weakLink).toBe('wrist_ext');
  });
  it('срыв с пола без тестов — fingers/thumb low', () => {
    const d = diagnoseArmlift({ implement: 'rolling_thunder', failurePoint: 'off_floor' });
    expect(d.weakLink).toBe('fingers');
    expect(d.confidence).toBe('low');
  });
  it('пусто — честный fingers/fatigue low', () => {
    const d = diagnoseArmlift({});
    expect(d.confidence).toBe('low');
  });
});

describe('PRO-5 D2: коррекции и спец-блок', () => {
  it('топ-3 на каждое звено, без повторов id', () => {
    for (const wl of ['thumb', 'fingers', 'wrist_ext', 'support_endurance', 'technique', 'asymmetry', 'conditioning'] as const) {
      const top = rankArmliftCorrections(wl);
      expect(top.length).toBe(3);
      expect(new Set(top.map((t) => t.id)).size).toBe(3);
    }
  });
  it('thumb ведёт plate pinch (NSCA)', () => {
    expect(rankArmliftCorrections('thumb')[0].id).toBe('plate_pinch');
  });
  it('спец-блок 4 нед волной, таргет — снаряд', () => {
    const spec = buildArmliftSpecBlock('thumb', 'saxon_bar');
    expect(spec.length).toBe(4);
    expect(spec[3].focus).toContain('Делод');
    expect(spec.every((w) => w.target === 'saxon_bar')).toBe(true);
  });
});

describe('PRO-5 добивка: диагноз в экспорте (аддитивно)', () => {
  const base = () => ({
    date: '2026-09-15', sex: 'М',
    report: buildArmliftingReport({ rtKg: 65.25, sex: 'male' }),
    lmsAttempts: [60, 65.25] as number[], lmsLabel: 'Rolling Thunder',
  });
  it('без диагноза — как раньше (без строк diagnosis)', () => {
    expect(buildArmliftingHtml(base())).not.toContain('Диагноз движений');
    expect(buildArmliftingCsv(base())).not.toContain('diagnosis;');
  });
  it('с диагнозом — HTML и CSV несут строки', () => {
    const data = {
      ...base(),
      diagTitle: 'Слабое звено: большой палец (pinch) · strength/med',
      diagCorrections: ['Plate pinch 3×20–30с — 2 плиты'],
      diagSpec: ['Нед 1: База', 'Нед 4: Делод хвату'],
    };
    const html = buildArmliftingHtml(data);
    expect(html).toContain('Диагноз движений');
    expect(html).toContain('Plate pinch');
    expect(html).toContain('Нед 4');
    const csv = buildArmliftingCsv(data);
    expect(csv).toContain('diagnosis;');
    expect(csv).toContain('corrections;');
    expect(csv).toContain('spec_block;');
  });
  it('XSS в диагнозе экранируется', () => {
    const html = buildArmliftingHtml({ ...base(), diagTitle: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;script&gt;');
  });
});
