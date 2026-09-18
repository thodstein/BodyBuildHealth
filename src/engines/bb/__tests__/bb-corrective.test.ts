import { describe, it, expect } from 'vitest';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import {
  BB_CORRECTIVES, BB_CORRECTIVE_COUNT, correctiveById, rankCorrectives,
  tagsForMovementScreens, correctiveDose, correctiveExportLines,
} from '../bb-corrective.engine';
// Статика вместо dynamic import: dynamic-import под нагрузкой машины упирается
// в дефолтный testTimeout 5с (доказано: с --testTimeout=60000 тот же файл — 3.7с).
// Циклов нет (инъекция/экспорт bb-corrective не импортируют).
import { injectBBWeakPoints } from '../bb-diagnostics-injection.engine';
import { buildBBDiagnosticsHtml, buildBBDiagnosticsCsv } from '../bb-diagnostics-export.engine';

const IDS = new Set((EXERCISE_CATALOG as any[]).map((c) => String(c.id).toLowerCase()));

describe('bb-corrective K1 library', () => {
  it('размер библиотеки >= 40', () => {
    expect(BB_CORRECTIVE_COUNT).toBeGreaterThanOrEqual(40);
    expect(BB_CORRECTIVES.length).toBe(BB_CORRECTIVE_COUNT);
  });
  it('все exerciseId существуют в каталоге', () => {
    const miss = BB_CORRECTIVES.filter((c) => !IDS.has(c.exerciseId.toLowerCase()));
    expect(miss.map((m) => `${m.id}→${m.exerciseId}`)).toEqual([]);
  });
  it('id уникальны; протоколы в коридорах', () => {
    const ids = BB_CORRECTIVES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of BB_CORRECTIVES) {
      expect(c.protocol.sets).toBeGreaterThanOrEqual(1);
      expect(c.protocol.sets).toBeLessThanOrEqual(6);
      expect(c.protocol.repsMin).toBeGreaterThanOrEqual(3);
      expect(c.protocol.repsMax).toBeGreaterThanOrEqual(c.protocol.repsMin);
      expect(c.protocol.rir).toBeGreaterThanOrEqual(0);
      expect(c.protocol.rir).toBeLessThanOrEqual(4);
      expect(c.cues.length).toBe(3);
      expect(c.retest.length).toBeGreaterThan(0);
      expect(c.source.length).toBeGreaterThan(0);
    }
  });
  it('каждый драйвер имеет ≥2 коррекции; bench-fix/nhe/erir покрыты', () => {
    for (const d of ['driver:ankle', 'driver:hip', 'driver:thoracic', 'driver:shoulder', 'driver:core']) {
      expect(BB_CORRECTIVES.filter((c) => c.targets.includes(d)).length).toBeGreaterThanOrEqual(2);
    }
    expect(BB_CORRECTIVES.filter((c) => c.targets.includes('bench-fix')).length).toBeGreaterThanOrEqual(2);
    expect(BB_CORRECTIVES.filter((c) => c.targets.includes('nhe-weak')).length).toBeGreaterThanOrEqual(2);
    expect(BB_CORRECTIVES.filter((c) => c.targets.includes('erir-low')).length).toBeGreaterThanOrEqual(2);
    expect(BB_CORRECTIVES.filter((c) => c.targets.includes('add-weak')).length).toBeGreaterThanOrEqual(1);
  });
  it('tagsForMovementScreens: маппинг сигналов', () => {
    expect(tagsForMovementScreens({ zones: ['Delt_Mid'], driver: 'ankle', benchLevel: 'fix', nheWeak: true, erirLow: true, painLevel: 'yellow' }))
      .toEqual(expect.arrayContaining(['delt_mid', 'driver:ankle', 'bench-fix', 'nhe-weak', 'erir-low', 'pm-yellow']));
    expect(tagsForMovementScreens({})).toEqual([]);
  });
  it('rankCorrectives: драйвер+зона бьёт generic; красная боль режет противопоказанные', () => {
    const r = rankCorrectives({ zones: ['quads'], driver: 'ankle', cause: 'technique' });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].corr.targets).toEqual(expect.arrayContaining(['quads']));
    const red = rankCorrectives({ zones: ['chest'], painLevel: 'red' });
    expect(red.every((x) => !x.corr.contraindicated.includes('pm-red'))).toBe(true);
  });
  it('correctiveDose: recovery и red режут объём/RIR', () => {
    const c = correctiveById('cu-incline-length')!;
    const base = correctiveDose(c, 'volume');
    expect(base.sets).toBe(c.protocol.sets);
    const rec = correctiveDose(c, 'recovery');
    expect(rec.sets).toBeLessThanOrEqual(2);
    expect(rec.rir).toBeGreaterThanOrEqual(c.protocol.rir);
    const y = correctiveDose(c, 'volume', { painYellow: true });
    expect(y.sets).toBeLessThan(base.sets);
  });
  it('exportLines: 3 строки с дозой и ре-тестом', () => {
    const c = correctiveById('dr-facepull')!;
    const lines = correctiveExportLines(c, null);
    expect(lines.length).toBe(3);
    expect(lines.join(' ')).toMatch(/RIR|Кью|Ре-тест/);
  });
  it('инъекция берёт дозу библиотеки (sets/tempo/label), legacy без неё цел', () => {
    const plan = { pattern: { id: 't' }, weeks: [{ week: 1, sessions: [{ day: 1, exercises: [] }] }], rationale: [] } as any;
    const withCorr = injectBBWeakPoints(plan, ['delt_mid'], {
      budget: 500,
      preferredIds: { delt_mid: 'lateral_raise' },
      corrective: { delt_mid: { sets: 2, reps: 15, rir: 3, tempo: '2-1-2-0', label: 'Тест-доза' } },
    });
    expect(withCorr.injected).toBe(1);
    const ex = withCorr.plan.weeks[0].sessions[0].exercises[0] as any;
    expect(ex.sets).toBe(2);
    expect(ex.workSets[0].reps).toBe(15);
    expect(ex.workSets[0].rir).toBe(3);
    expect(String(ex.comment)).toMatch(/Тест-доза/);
    const legacy = injectBBWeakPoints(plan, ['delt_mid'], { budget: 500 });
    const exL = legacy.plan.weeks[0].sessions[0].exercises[0] as any;
    expect(exL.sets).toBe(3);
    expect(exL.workSets[0].rir).toBe(2);
  });
  it('экспорт несёт correctiveDetail в HTML+CSV без дублей', () => {
    const report = { weakCandidates: [], weakMusclesCanonical: [], weakZonesGranular: [], symmetry: { ratios: {}, issues: [] }, stimulus: { issues: [], global: { lengthened: 0, midRange: 0, shortened: 0, compound: 0, isolation: 0 } }, score: { score: 80, level: 'ok', verification: 'high', floors: [] }, findings: [], priorities: [] } as any;
    const meta = { correctiveDetail: [{ id: 'dm-lateral-pause', zone: 'delt_mid', exerciseId: 'lateral_raise', protocol: '3×12–15 RIR1', cues: ['a', 'b', 'c'], source: 'S' }] } as any;
    expect(buildBBDiagnosticsHtml(report, meta)).toMatch(/Коррекции/);
    expect(buildBBDiagnosticsCsv(report, null, meta)).toMatch(/corr_id/);
    expect(buildBBDiagnosticsHtml(report, {})).not.toMatch(/Коррекции/);
  });
  it('teenBlocked режет teen-loaded (нордик), остальное NHE цело', () => {
    const base = rankCorrectives({ zones: ['hamstrings'], nheWeak: true });
    expect(base.map((x) => x.corr.id)).toContain('h-nordic-ecc');
    const teen = rankCorrectives({ zones: ['hamstrings'], nheWeak: true, teenBlocked: true });
    expect(teen.map((x) => x.corr.id)).not.toContain('h-nordic-ecc');
    expect(teen.length).toBeGreaterThan(0);
  });
  it('shoulderPain режет брусья и нейтральные подтягивания', () => {
    const pain = rankCorrectives({ zones: ['chest'], shoulderPain: true });
    expect(pain.map((x) => x.corr.exerciseId)).not.toContain('dips_chest');
    const back = rankCorrectives({ zones: ['back_width'], shoulderPain: true });
    expect(back.map((x) => x.corr.id)).not.toContain('bw-neutral-safe');
  });
  it('rot-gap тег ведёт на wall-slide', () => {
    expect(tagsForMovementScreens({ rotGap: true })).toContain('rot-gap');
    expect(tagsForMovementScreens({})).not.toContain('rot-gap');
    const r = rankCorrectives({ zones: ['back'], rotGap: true });
    expect(r.map((x) => x.corr.id)).toContain('sh-wall-slide');
  });
  it('оборудование: гантели+вес — гоблет есть, жима ногами нет; без списка — всё', () => {
    const home = rankCorrectives({ zones: ['quads'], equipment: ['dumbbell', 'bodyweight'] });
    const ids = home.map((x) => x.corr.exerciseId);
    expect(ids).toContain('goblet_squat');
    expect(ids).not.toContain('leg_press');
    const full = rankCorrectives({ zones: ['quads'] });
    expect(full.map((x) => x.corr.exerciseId)).toContain('leg_press');
  });
  it('bodyweight-атлет: брусья есть, кроссовер — нет', () => {
    const bw = rankCorrectives({ zones: ['chest'], equipment: ['bodyweight'] });
    const ids = bw.map((x) => x.corr.exerciseId);
    expect(ids).toContain('dips_chest');
    expect(ids).not.toContain('cable_fly_low');
  });
  it('зона бьёт сигнал: зона +5 — свой топ даже при чужом erir-low', () => {
    const r = rankCorrectives({ zones: ['chest_upper'] });
    expect(r[0].score).toBeGreaterThanOrEqual(5);
    expect(r[0].why).toContain('в зону');
    const sig = rankCorrectives({ zones: ['chest_upper'], cause: 'volume', erirLow: true });
    expect(sig[0].corr.id).toMatch(/^(cu-|ch-)/);
  });
});
