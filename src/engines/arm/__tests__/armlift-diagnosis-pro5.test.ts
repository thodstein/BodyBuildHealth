import { describe, it, expect } from 'vitest';
import { failuresFor, faultsFor } from '../armlift-failure-modes.engine';
import { diagnoseArmlift } from '../armlift-diagnosis.engine';
import { rankArmliftCorrections, buildArmliftSpecBlock } from '../armlift-correction.engine';
import { diagnoseArmliftCause, countGripSessions } from '../armlift-cause.engine';
import { injectArmliftCorrections, correctionsToInjectionItems, applyArmliftSpecWave } from '../armlift-injection.engine';
import { getArmExerciseById } from '../../../core/exercise-catalog-arm';
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
  it('thumb ведёт plate_pinch_hold из каталога (NSCA)', () => {
    const top = rankArmliftCorrections('thumb');
    expect(top[0].id).toBe('plate_pinch_hold');
    expect(top.every((c) => getArmExerciseById(c.exId) != null)).toBe(true);
  });
  it('crush-снаряды чинятся crush-пулом (CoC), а не штангой', () => {
    const top = rankArmliftCorrections('fingers', 'coc_gripper');
    expect(top[0].exId).toMatch(/coc_|silver/);
  });
  it('все коррекции всех звеньев — реальные id каталога', () => {
    for (const wl of ['thumb', 'fingers', 'wrist_ext', 'support_endurance', 'technique', 'asymmetry', 'conditioning'] as const) {
      for (const c of rankArmliftCorrections(wl)) {
        expect(getArmExerciseById(c.exId)).toBeTruthy();
      }
    }
  });
  it('спец-блок 4 нед волной, таргет — снаряд', () => {
    const spec = buildArmliftSpecBlock('thumb', 'saxon_bar');
    expect(spec.length).toBe(4);
    expect(spec[3].focus).toContain('Делод');
    expect(spec.every((w) => w.target === 'saxon_bar')).toBe(true);
  });
});

describe('PRO-5 real: поиск причины со скорингом', () => {
  it('боль — гейт pain 0.95, не скоринг', () => {
    const r = diagnoseArmliftCause({ implement: 'rolling_thunder', pain: true });
    expect(r.cause).toBe('pain');
    expect(r.confidence).toBe(0.95);
  });
  it('локоть — тоже pain', () => {
    expect(diagnoseArmliftCause({ elbowPain: true }).cause).toBe('pain');
  });
  it('2 фола — technique с evidence', () => {
    const r = diagnoseArmliftCause({ implement: 'rolling_thunder', faultIds: ['not_center', 'body_drag'] });
    expect(r.cause).toBe('technique');
    expect(r.evidence.join(' ')).toContain('Фолы');
    expect(r.fix.length).toBeGreaterThan(0);
  });
  it('редкие сессии — volume', () => {
    const r = diagnoseArmliftCause({ implement: 'saxon_bar', gripSessions28d: 1, gripFreqPerWeek: 1 });
    expect(r.cause).toBe('volume');
  });
  it('тренд стоит при объёме — technique, а не volume', () => {
    const r = diagnoseArmliftCause({ implement: 'rolling_thunder', gripSessions28d: 10, trendDeltaPct: 0 });
    expect(r.cause).toBe('technique');
  });
  it('тренд падает при объёме + частота 5 — fatigue', () => {
    const r = diagnoseArmliftCause({ implement: 'rolling_thunder', gripSessions28d: 12, trendDeltaPct: -5, gripFreqPerWeek: 5 });
    expect(r.cause).toBe('fatigue');
  });
  it('срыв внизу + pinch 6с — max_strength', () => {
    const r = diagnoseArmliftCause({ implement: 'saxon_bar', failurePoint: 'off_floor', pinchHoldSec: 6 });
    expect(r.cause).toBe('max_strength');
  });
  it('середина + farmer 20с — endurance', () => {
    const r = diagnoseArmliftCause({ implement: 'rolling_thunder', failurePoint: 'mid', farmerHoldSec: 20 });
    expect(r.cause).toBe('endurance');
  });
  it('жёсткий большой на щипке — mobility', () => {
    const r = diagnoseArmliftCause({ implement: 'saxon_bar', thumbStiff: true });
    expect(r.cause).toBe('mobility');
  });
  it('пусто — честный low confidence', () => {
    const r = diagnoseArmliftCause({});
    expect(r.confidence).toBeLessThan(0.5);
    expect(r.evidence.length).toBeGreaterThan(0);
  });
  it('CoC ниже №2 — max_strength crush', () => {
    const r = diagnoseArmliftCause({ implement: 'coc_gripper', cocLevel: 1 });
    expect(r.cause).toBe('max_strength');
    expect(r.evidence.join(' ')).toContain('CoC');
  });
  it('Silver 10с — endurance crush', () => {
    const r = diagnoseArmliftCause({ implement: 'silver_bullet', silverSec: 10 });
    expect(r.cause).toBe('endurance');
  });
  it('объём считается по снаряду, L/R маппятся на базу', () => {
    const iso = (back: number): string => {
      const d = new Date(); d.setDate(d.getDate() - back);
      return d.toISOString().slice(0, 10);
    };
    const log = [
      { date: iso(5), implement: 'rolling_thunder_L', weightKg: 60, success: true },
      { date: iso(3), implement: 'rolling_thunder_R', weightKg: 62, success: true },
      { date: iso(3), implement: 'hub', weightKg: 30, success: true },
      { date: iso(200), implement: 'rolling_thunder', weightKg: 50, success: true },
    ];
    expect(countGripSessions(log, 'rolling_thunder')).toBe(2);
    expect(countGripSessions(log)).toBe(3);
    expect(countGripSessions([])).toBe(0);
  });
});

describe('PRO-5 real: инъекция коррекций в план', () => {
  const fakePlan = () => ({
    level: 'intermediate',
    rationale: [] as string[],
    weeks: [
      { week: 1, sessions: [{ sessionTag: 'SupportGrip', exercises: [] }, { sessionTag: 'PinchGrip', exercises: [] }] },
      { week: 2, deload: true, sessions: [{ sessionTag: 'SupportGrip', exercises: [] }] },
    ],
  });
  it('plate_pinch_hold встаёт в PinchGrip с холдами и весом из workMax', () => {
    const r = injectArmliftCorrections(fakePlan(), [{ exId: 'plate_pinch_hold', sets: 3, dayTag: 'PinchGrip' }], { workMax: { grip_pinch: 40 } });
    expect(r.injected).toBe(1);
    const sess = r.plan.weeks[0].sessions.find((s: any) => s.sessionTag === 'PinchGrip');
    const ex = sess.exercises[0];
    expect(ex.exerciseId).toBe('plate_pinch_hold');
    expect(ex.muscle).toBe('grip_pinch');
    expect(ex.workSets[0].weight).toBe(26);
    expect(ex.isStatic).toBe(true);
    expect(r.plan.rationale.join(' ')).toContain('инъецировано');
  });
  it('делод скипается, дубли давятся, бюджет держит', () => {
    const dup = injectArmliftCorrections(fakePlan(), [{ exId: 'plate_pinch_hold', sets: 3 }], { weekIdxs: [0] });
    expect(dup.injected).toBe(1);
    const again = injectArmliftCorrections(dup.plan, [{ exId: 'plate_pinch_hold', sets: 3 }], { weekIdxs: [0] });
    expect(again.injected).toBe(0);
    expect(again.skippedDup).toBe(1);
    const deload = injectArmliftCorrections(fakePlan(), [{ exId: 'rolling_thunder', sets: 3 }], { weekIdxs: [1] });
    expect(deload.injected).toBe(0);
    expect(deload.skippedDeload).toBe(1);
    const over = injectArmliftCorrections(fakePlan(), [{ exId: 'rolling_thunder', sets: 6 }], { budget: 5 });
    expect(over.injected).toBe(0);
    expect(over.skippedBudget).toBe(1);
  });
  it('неизвестный exId — честный варнинг без падения', () => {
    const r = injectArmliftCorrections(fakePlan(), [{ exId: 'zzz_nope', sets: 3 }]);
    expect(r.injected).toBe(0);
    expect(r.notes.join(' ')).toContain('нет в каталоге');
  });
  it('correctionsToInjectionItems берёт топ-3 с дозами', () => {
    const top = rankArmliftCorrections('thumb');
    const items = correctionsToInjectionItems(top);
    expect(items.length).toBe(3);
    expect(items[0].exId).toBe('plate_pinch_hold');
    expect(items.every((t) => t.sets >= 1 && t.sets <= 6)).toBe(true);
  });
  it('волна спеца раскладывает сеты по 4 неделям', () => {
    const plan = {
      level: 'intermediate', rationale: [] as string[],
      weeks: [1, 2, 3, 4, 5].map((week) => ({
        week, sessions: [{ sessionTag: 'PinchGrip', exercises: [] }],
      })),
    };
    const spec = [
      { week: 1, targetSets: { plate_pinch_hold: 3 }, dayMap: { plate_pinch_hold: 'PinchGrip' } },
      { week: 2, targetSets: { plate_pinch_hold: 4 }, dayMap: { plate_pinch_hold: 'PinchGrip' } },
      { week: 3, targetSets: { plate_pinch_hold: 3 }, dayMap: { plate_pinch_hold: 'PinchGrip' } },
      { week: 4, targetSets: { plate_pinch_hold: 2 }, dayMap: { plate_pinch_hold: 'PinchGrip' } },
    ];
    const r = applyArmliftSpecWave(plan, spec, [{ exId: 'plate_pinch_hold', sets: 3, dayTag: 'PinchGrip' }], { workMax: { grip_pinch: 40 } });
    expect(r.injected).toBe(4);
    expect(r.plan.weeks[1].sessions[0].exercises[0].sets).toBe(4);
    expect(r.plan.weeks[3].sessions[0].exercises[0].sets).toBe(2);
  });
  it('пометка слабой руки идёт в комментарий', () => {
    const plan = {
      level: 'intermediate', rationale: [] as string[],
      weeks: [{ week: 1, sessions: [{ sessionTag: 'SupportGrip', exercises: [] }] }],
    };
    const r = injectArmliftCorrections(plan, [{ exId: 'rolling_thunder', sets: 3 }], { workMax: { grip_support: 80 }, weakArmNote: 'слабой рукой первой' });
    expect(r.injected).toBe(1);
    expect(r.plan.weeks[0].sessions[0].exercises[0].comment).toContain('слабой рукой первой');
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
