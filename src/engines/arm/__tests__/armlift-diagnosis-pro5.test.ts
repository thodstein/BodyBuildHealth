import { describe, it, expect } from 'vitest';
import { failuresFor, faultsFor, movementFor } from '../armlift-failure-modes.engine';
import { diagnoseArmlift } from '../armlift-diagnosis.engine';
import { rankArmliftCorrections, buildArmliftSpecBlock } from '../armlift-correction.engine';
import { diagnoseArmliftCause, countGripSessions, flexExtRatio } from '../armlift-cause.engine';
import { injectArmliftCorrections, correctionsToInjectionItems, applyArmliftSpecWave } from '../armlift-injection.engine';
import { benchmarkPinchHold, benchmarkFarmerHold, benchmarkCoc, overallGripLevel } from '../armlift-benchmarks.engine';
import { cocLadderFor } from '../armlift-correction.engine';
import { saveDiagSnapshot, loadDiagHistory, lastSnapshotFor, retestVerdict, weeksBetween } from '../armlift-history.engine';
import { assessArmliftMobility } from '../armlift-mobility.engine';
import { diagImplementForReportWeakest, relevantTestsFor } from '../armlift-failure-modes.engine';
import { intensityForCause } from '../armlift-injection.engine';
import { clearDiagHistory } from '../armlift-history.engine';
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

describe('PRO-5 D8: карта движений', () => {
  const IMPLS = ['rolling_thunder', 'apollon_axle', 'saxon_bar', 'hub', 'pinch_block', 'coc_gripper', 'silver_bullet', 'excalibur', 'raptor_175', 'country_crush', 'grandfather_clock', 'anvil', 'saxon_medley', 'fat_gripz'];
  it('у каждого снаряда цепочка setup → фазы срыва', () => {
    for (const impl of IMPLS) {
      const chain = movementFor(impl);
      expect(chain[0].id).toBe('setup');
      expect(chain.length).toBeGreaterThanOrEqual(3);
      expect(chain.every((ph) => ph.label && ph.good)).toBe(true);
    }
  });
  it('фолы фаз — только из чек-листа снаряда (без выдуманных)', () => {
    for (const impl of IMPLS) {
      const allowed = new Set(faultsFor(impl).map((fl) => fl.id));
      for (const ph of movementFor(impl)) {
        for (const fid of ph.faultIds) {
          expect(allowed.has(fid)).toBe(true);
        }
      }
    }
  });
  it('фазы срыва покрывают точки срыва снаряда', () => {
    for (const impl of IMPLS) {
      const phases = new Set(movementFor(impl).map((ph) => ph.id));
      for (const fp of failuresFor(impl)) {
        expect(phases.has(fp.id)).toBe(true);
      }
    }
  });
  it('ранжир поднимает коррекцию, чинящую фазу срыва', () => {
    const plain = rankArmliftCorrections('support_endurance', 'rolling_thunder', {});
    expect(plain.map((c) => c.id)).toEqual(['farmer_walk_fat', 'towel_pullup', 'fat_gripz_curl']);
    const withPhase = rankArmliftCorrections('support_endurance', 'rolling_thunder', { failurePoint: 'hold_short' });
    expect(withPhase.map((c) => c.id)).toEqual(['farmer_walk_fat', 'fat_gripz_curl', 'towel_pullup']);
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
  it('CoC не закрыл — crush, а не thumb', () => {
    const d = diagnoseArmlift({ implement: 'coc_gripper', failurePoint: 'close_fail' });
    expect(d.weakLink).toBe('crush');
  });
  it('Silver плывёт — crush endurance', () => {
    const d = diagnoseArmlift({ implement: 'silver_bullet', failurePoint: 'hold_long' });
    expect(d.weakLink).toBe('crush');
    expect(d.cause).toBe('endurance');
  });
  it('crush чинится crush-пулом каталога', () => {
    const top = rankArmliftCorrections('crush');
    expect(top.length).toBe(3);
    expect(top[0].exId).toMatch(/coc_|silver/);
    expect(top.every((c) => getArmExerciseById(c.exId) != null)).toBe(true);
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

describe('PRO-5 D10 E1: уровни тест-батареи', () => {
  it('пороги pinch/farmer/CoC + итог по слабейшему', () => {
    expect(benchmarkPinchHold(5)).toBe('beginner');
    expect(benchmarkPinchHold(15)).toBe('intermediate');
    expect(benchmarkPinchHold(30)).toBe('advanced');
    expect(benchmarkPinchHold(50)).toBe('elite');
    expect(benchmarkFarmerHold(10)).toBe('beginner');
    expect(benchmarkFarmerHold(50)).toBe('elite');
    expect(benchmarkCoc(0)).toBe('beginner');
    expect(benchmarkCoc(1.5)).toBe('intermediate');
    expect(benchmarkCoc(2)).toBe('advanced');
    expect(benchmarkCoc(3)).toBe('elite');
    expect(benchmarkPinchHold(null)).toBeNull();
    expect(benchmarkPinchHold(-5)).toBeNull();
    expect(overallGripLevel(['advanced', 'intermediate', 'elite'])).toBe('intermediate');
    expect(overallGripLevel([null, null])).toBeNull();
  });
});

describe('PRO-5 D10 E3/E6: баланс и кожа', () => {
  it('flexExtRatio: норма и дисбаланс', () => {
    expect(flexExtRatio(30, 25)).toBe(1.2);
    expect(flexExtRatio(40, 20)).toBe(2);
    expect(flexExtRatio(null, 20)).toBeNull();
    expect(flexExtRatio(30, 0)).toBeNull();
  });
  it('ratio >1.5 — mobility с evidence про экстензоры', () => {
    const r = diagnoseArmliftCause({ implement: 'rolling_thunder', flexHoldSec: 40, extHoldSec: 20 });
    expect(r.cause).toBe('mobility');
    expect(r.evidence.join(' ')).toContain('2');
  });
  it('ratio в норме — не стреляет', () => {
    const r = diagnoseArmliftCause({ implement: 'rolling_thunder', flexHoldSec: 30, extHoldSec: 25 });
    expect(r.cause).not.toBe('mobility');
  });
  it('сорвана кожа — гейт pain с щипковым фиксом', () => {
    const r = diagnoseArmliftCause({ implement: 'saxon_bar', skinTear: true });
    expect(r.cause).toBe('pain');
    expect(r.fix).toContain('щипка');
  });
  it('перепонка — гейт pain', () => {
    expect(diagnoseArmliftCause({ thumbWebPain: true }).cause).toBe('pain');
  });
  it('дисбаланс поднимает экстензоры в топ', () => {
    const plain = rankArmliftCorrections('support_endurance', 'rolling_thunder', {});
    const imb = rankArmliftCorrections('support_endurance', 'rolling_thunder', { extImbalance: true });
    expect(imb.some((c) => /wrist_ext_bb|wrist_roller|reverse_ez_curl/.test(c.exId))).toBe(true);
    expect(JSON.stringify(imb.map((c) => c.id))).not.toBe(JSON.stringify(plain.map((c) => c.id)));
  });
});

describe('PRO-5 D11 E2: CoC-лестница', () => {
  it('ступени рабочий→целевой', () => {
    expect(cocLadderFor(null)).toEqual({ workId: 'coc_trainer', goalId: 'coc_no1' });
    expect(cocLadderFor(0)).toEqual({ workId: 'coc_trainer', goalId: 'coc_no1' });
    expect(cocLadderFor(1)).toEqual({ workId: 'coc_no1', goalId: 'coc_no1_5' });
    expect(cocLadderFor(1.5)).toEqual({ workId: 'coc_no1_5', goalId: 'coc_no2' });
    expect(cocLadderFor(2)).toEqual({ workId: 'coc_no2', goalId: null });
    expect(cocLadderFor(3)).toEqual({ workId: 'coc_no2', goalId: null });
  });
  it('ранжир с уровнем строит лесенку, без — общий пул', () => {
    const ladder = rankArmliftCorrections('crush', 'coc_gripper', { cocLevel: 1 });
    expect(ladder[0].exId).toBe('coc_no1');
    expect(ladder.some((c) => /негатив|частичк/.test(c.protocol))).toBe(true);
    const generic = rankArmliftCorrections('crush', 'coc_gripper', {});
    expect(generic[0].exId).toBe('coc_trainer');
  });
});

describe('PRO-5 D11 E4 / D12 E7: перетест и история', () => {
  it('вердикты: рост/падение/стагнация/холд/нет данных', () => {
    expect(retestVerdict(20, 25).verdict).toBe('up');
    expect(retestVerdict(20, 15).verdict).toBe('deload');
    expect(retestVerdict(20, 20.5, 5).verdict).toBe('stagnant');
    expect(retestVerdict(20, 20.5, 2).verdict).toBe('hold');
    expect(retestVerdict(null, 20).verdict).toBe('no_data');
  });
  it('weeksBetween считает недели', () => {
    expect(weeksBetween('2026-09-01', '2026-09-01')).toBe(0);
    expect(weeksBetween('2026-09-01', '2026-09-29')).toBe(4);
    expect(weeksBetween('2026-09-29', '2026-09-01')).toBe(0);
  });
  it('снапшоты: запись/чтение/последний по снаряду', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    saveDiagSnapshot({ date: '2026-09-01', implement: 'saxon_bar', weakLink: 'thumb', cause: 'max_strength', pinchHoldSec: 10 });
    saveDiagSnapshot({ date: '2026-09-10', implement: 'saxon_bar', weakLink: 'thumb', cause: 'endurance', pinchHoldSec: 15 });
    saveDiagSnapshot({ date: '2026-09-10', implement: 'rolling_thunder', weakLink: 'fingers', cause: 'volume' });
    expect(loadDiagHistory().length).toBe(3);
    expect(lastSnapshotFor('saxon_bar', false)?.cause).toBe('endurance');
    expect(lastSnapshotFor('hub', false)).toBeNull();
  });
});

describe('PRO-5 D12 E5: дозы и волны', () => {
  const plan6 = () => ({
    level: 'intermediate', rationale: [] as string[],
    weeks: [1, 2, 3, 4, 5, 6].map((week) => ({
      week, sessions: [{ sessionTag: 'PinchGrip', exercises: [] }],
    })),
  });
  it('спец 6 нед: волна 6 значений, делод в конце', () => {
    const spec = buildArmliftSpecBlock('thumb', 'saxon_bar', undefined, 6);
    expect(spec.length).toBe(6);
    expect(spec[5].focus).toContain('Делод');
    expect(spec[1].targetSets['plate_pinch_hold']).toBeGreaterThanOrEqual(spec[5].targetSets['plate_pinch_hold']);
    expect(buildArmliftSpecBlock('thumb', 'saxon_bar').length).toBe(4);
  });
  it('волна применяется на 6 недель плана', () => {
    const spec = buildArmliftSpecBlock('thumb', 'saxon_bar', undefined, 6);
    const r = applyArmliftSpecWave(plan6(), spec, [{ exId: 'plate_pinch_hold', sets: 3, dayTag: 'PinchGrip' }], { workMax: { grip_pinch: 40 } });
    expect(r.injected).toBe(6);
    expect(r.plan.weeks[5].sessions[0].exercises[0].sets).toBe(2);
  });
  it('новичку −1 сет (минимум 1)', () => {
    const plan = {
      level: 'beginner', rationale: [] as string[],
      weeks: [{ week: 1, sessions: [{ sessionTag: 'SupportGrip', exercises: [] }] }],
    };
    const r = injectArmliftCorrections(plan, [{ exId: 'rolling_thunder', sets: 3 }], { level: 'beginner', workMax: { grip_support: 80 } });
    expect(r.injected).toBe(1);
    expect(r.plan.weeks[0].sessions[0].exercises[0].sets).toBe(2);
    const r1 = injectArmliftCorrections(plan, [{ exId: 'rolling_thunder', sets: 1 }], { level: 'beginner', workMax: { grip_support: 80 } });
    expect(r1.plan.weeks[0].sessions[0].exercises[0].sets).toBe(1);
  });
});

describe('PRO-5 D13: мобильность ROM + pinch L/R', () => {
  it('ROM: нормы, погранично, провалы', () => {
    expect(assessArmliftMobility({ wristExtDeg: 75, wristFlexDeg: 80, thumbOppOk: true }).passed).toBe(true);
    const r = assessArmliftMobility({ wristExtDeg: 55, wristFlexDeg: 60, thumbOppOk: false });
    expect(r.fails).toEqual(['wrist_ext', 'wrist_flex', 'thumb_opp']);
    expect(assessArmliftMobility({}).passed).toBe(true);
    expect(assessArmliftMobility({ wristExtDeg: 65 }).notes.join(' ')).toContain('погранично');
  });
  it('ROM-провалы идут в причину mobility', () => {
    const r = diagnoseArmliftCause({ implement: 'saxon_bar', mobilityFails: ['wrist_ext', 'thumb_opp'] });
    expect(r.cause).toBe('mobility');
    expect(r.evidence.join(' ')).toContain('ретест');
  });
  it('pinch L/R: строки + асимметрия в вердикте', () => {
    const r = buildArmliftingReport({ pinchL: 40, pinchR: 50, sex: 'male' });
    expect(r.rows.some((x) => x.implement === 'pinch_block_L')).toBe(true);
    expect(r.rows.some((x) => x.implement === 'pinch_block_R')).toBe(true);
    expect(r.pinchAsymPct).toBe(20);
    expect(r.verdict).toContain('Pinch-асимметрия');
  });
  it('pinch single как раньше, без асимметрии', () => {
    const r = buildArmliftingReport({ pinchKg: 40, sex: 'male' });
    expect(r.rows.some((x) => x.implement === 'pinch_block')).toBe(true);
    expect(r.pinchAsymPct).toBeNull();
  });
});

describe('PRO-5 D14: ACWR в причине', () => {
  it('dangerous/caution → fatigue с evidence', () => {
    expect(diagnoseArmliftCause({ acwrZone: 'dangerous' }).cause).toBe('fatigue');
    const r = diagnoseArmliftCause({ acwrZone: 'caution' });
    expect(r.evidence.join(' ')).toContain('ACWR');
  });
  it('optimal/пусто — fatigue не стреляет', () => {
    expect(diagnoseArmliftCause({ acwrZone: 'optimal' }).cause).not.toBe('fatigue');
    expect(diagnoseArmliftCause({ acwrZone: 'undertrained' }).cause).not.toBe('fatigue');
    expect(diagnoseArmliftCause({}).cause).not.toBe('fatigue');
  });
});

describe('PRO-5 D15: слабейший в диагностику, разминка, очистка истории', () => {
  it('маппинг вердикт → снаряд (L/R режем, чужое — null)', () => {
    expect(diagImplementForReportWeakest('saxon_bar')).toBe('saxon_bar');
    expect(diagImplementForReportWeakest('rolling_thunder_L')).toBe('rolling_thunder');
    expect(diagImplementForReportWeakest('hub_R')).toBe('hub');
    expect(diagImplementForReportWeakest(null)).toBeNull();
    expect(diagImplementForReportWeakest('zzz_nope')).toBeNull();
  });
  it('лесенка несёт разминку', () => {
    const ladder = rankArmliftCorrections('crush', 'coc_gripper', { cocLevel: 1 });
    expect(ladder[0].warmup).toContain('Разминка');
    expect(ladder.some((c) => c.warmup)).toBe(true);
  });
  it('очистка истории работает', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    saveDiagSnapshot({ date: '2026-09-01', implement: 'hub', weakLink: 'thumb', cause: 'volume' });
    expect(loadDiagHistory().length).toBe(1);
    clearDiagHistory();
    expect(loadDiagHistory().length).toBe(0);
  });
});

describe('PRO-5 D16: релевантные тесты и доза от причины', () => {
  it('каждый снаряд знает свои тесты', () => {
    expect(relevantTestsFor('rolling_thunder')).toEqual(['Farmer-hold']);
    expect(relevantTestsFor('saxon_bar')).toEqual(['Pinch-hold']);
    expect(relevantTestsFor('coc_gripper')).toEqual(['CoC', 'Silver']);
    expect(relevantTestsFor('saxon_medley')).toEqual(['Pinch-hold', 'Farmer-hold']);
    expect(relevantTestsFor('zzz')).toEqual(['Pinch-hold', 'Farmer-hold']);
  });
  it('интенсивность от причины: щадяще/база/сила', () => {
    expect(intensityForCause('pain')).toBe(0.5);
    expect(intensityForCause('fatigue')).toBe(0.5);
    expect(intensityForCause('mobility')).toBe(0.5);
    expect(intensityForCause('max_strength')).toBe(0.7);
    expect(intensityForCause('technique')).toBe(0.65);
    expect(intensityForCause(null)).toBe(0.65);
  });
  it('items несут интенсивность причины', () => {
    const items = correctionsToInjectionItems(rankArmliftCorrections('thumb'), 3, intensityForCause('mobility'));
    expect(items.every((t) => t.intensityPct === 0.5)).toBe(true);
    const def = correctionsToInjectionItems(rankArmliftCorrections('thumb'));
    expect(def.every((t) => t.intensityPct === 0.65)).toBe(true);
  });
});
