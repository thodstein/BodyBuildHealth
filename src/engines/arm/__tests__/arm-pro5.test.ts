import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { validateArmPlan } from '../arm-validator.engine';
import {
  taperStateFor, isCycleTaperActive, resolveProgressionRates, acwrMultFor,
  pedHonestyNote, weightHonestyMark, foreignPoolWarnings,
} from '../arm-pro5-core.engine';
import {
  axisScoreOf, applyPro5Safety, hookVolumeOf, checkHookCap, flexorPronatorEccentric,
} from '../arm-pro5-safety.engine';
import { PLATFORM_RULES_2026, platformRuleFor, LMS_RULES_2026, lmsLadderTo } from '../arm-pro5-platform-rules.engine';
import { checkCocGates } from '../arm-pro5-coc-gate.engine';
import { rirForRpe, strengthLogRir, larrattSinglesFor, isSinglesCandidate } from '../arm-pro5-singles.engine';
import { suggestSplitForCycle, consentPreview, deloadEnforcement, ARM_PHASE_PRESETS } from '../arm-pro5-ux.engine';
import { buildContestSimWeek, waf2025FoulChecklist } from '../arm-contest-sim.engine';
import { buildArmBlock, buildArmYearBlocks } from '../arm-annual';

const BASE: any = { discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'toproll', weeks: 8 };

describe('arm-pro5 core (P6)', () => {
  it('taperStateFor: хвост делоад/пик с конца', () => {
    const s = taperStateFor({ 1: 'accumulation', 2: 'accumulation', 3: 'deload', 4: 'peaking' }, 4);
    expect(s.tailStart).toBe(3);
    expect(s.hasTail).toBe(true);
    const s2 = taperStateFor({ 1: 'accumulation', 2: 'accumulation' }, 2);
    expect(s2.hasTail).toBe(false);
    expect(s2.tailStart).toBe(3);
  });
  it('isCycleTaperActive: только пресет + хвост', () => {
    const s = taperStateFor({ 1: 'accumulation', 2: 'peaking' }, 2);
    expect(isCycleTaperActive(s, 'peaking', 2, 'toproll_taper')).toBe(true);
    expect(isCycleTaperActive(s, 'peaking', 2, null)).toBe(false);
    expect(isCycleTaperActive(s, 'accumulation', 1, 'toproll_taper')).toBe(false);
  });
  it('resolveProgressionRates: legacy и распил', () => {
    const leg = resolveProgressionRates({ correctionPct: 0.5 });
    expect(leg.cyclePctPerWeek).toBe(0.5);
    expect(leg.mesoRate).toBeCloseTo(1.005, 5);
    expect(leg.migrated).toBe(false);
    const split = resolveProgressionRates({ correctionPct: 0.5, cyclePctPerWeek: 1, mesoRatePct: 2 });
    expect(split.cyclePctPerWeek).toBe(1);
    expect(split.mesoRate).toBeCloseTo(1.02, 5);
    expect(split.migrated).toBe(true);
    const empty = resolveProgressionRates({});
    expect(empty.cyclePctPerWeek).toBe(0);
    expect(empty.mesoRate).toBeCloseTo(1.025, 5);
  });
  it('acwrMultFor: мало данных — 1; danger/caution режут', () => {
    expect(acwrMultFor({}).mult).toBe(1);
    expect(acwrMultFor({}).zone).toBe('none');
    const mk = (rpe: number, n: number, mins = 60) => Array.from({ length: n }, (_, i) => ({ dateIso: `2026-01-${String(i + 1).padStart(2, '0')}`, srpe: rpe, durationMin: mins }));
    const danger = acwrMultFor({ diary: [...mk(5, 10), ...mk(13.4, 7)] });
    expect(danger.zone).toBe('danger');
    expect(danger.mult).toBe(0.65);
    const caution = acwrMultFor({ diary: [...mk(5, 10), ...mk(10, 7)] });
    expect(caution.zone).toBe('caution');
    expect(caution.mult).toBe(0.85);
  });
  it('pedHonestyNote: неизвестный id помечается', () => {
    expect(pedHonestyNote(undefined)).toBeNull();
    expect(pedHonestyNote({})).toBeNull();
    expect(pedHonestyNote({ test_e: 500 })).toBeNull();
    expect(pedHonestyNote({ mystery_xyz: 100 })).toContain('mystery_xyz');
  });
  it('weightHonestyMark: пустой workMax — ориентир', () => {
    expect(weightHonestyMark('wrist_flexors', {})).toBe(true);
    expect(weightHonestyMark('wrist_flexors', { wrist_flexors: 40 })).toBe(false);
    expect(weightHonestyMark('wrist_flexors', { wrist: 30 })).toBe(false);
  });
  it('foreignPoolWarnings: чужая группа ловится', () => {
    const bad: any = [{ week: 1, sessions: [{ exercises: [{ muscle: 'side_pressure', name: 'Хват', substitutionGroup: 'grip_support' }] }] }];
    expect(foreignPoolWarnings(bad).length).toBeGreaterThan(0);
    const good: any = [{ week: 1, sessions: [{ exercises: [{ muscle: 'side_pressure', name: 'Бок', substitutionGroup: 'side_press' }] }] }];
    expect(foreignPoolWarnings(good)).toEqual([]);
  });
});

describe('arm-pro5 safety (P1)', () => {
  it('axisScoreOf считает флаги', () => {
    expect(axisScoreOf({})).toBe(0);
    expect(axisScoreOf({ trunkRotatedTowardAttack: true, wristBehindShoulder: true, wristExtendedDorsally: true })).toBe(3);
  });
  it('high-риск: side в технику + blocked', () => {
    const r = applyPro5Safety({ axisCheck: { trunkRotatedTowardAttack: true, wristBehindShoulder: true, wristExtendedDorsally: true } });
    expect(r.forceSideTechnique).toBe(true);
    expect(r.blocked.length).toBe(1);
    expect(r.notes.length).toBeGreaterThan(0);
  });
  it('guarded: только warning', () => {
    const r = applyPro5Safety({ axisCheck: { trunkRotatedTowardAttack: true } });
    expect(r.forceSideTechnique).toBe(false);
    expect(r.blocked).toEqual([]);
    expect(r.warnings.length).toBe(1);
  });
  it('warmup-gate: холод без разминки', () => {
    const r = applyPro5Safety({ axisCheck: { coldNoWarmup: true }, warmupDone: false });
    expect(r.warmupRequired).toBe(true);
    const ok = applyPro5Safety({ axisCheck: { coldNoWarmup: true }, warmupDone: true });
    expect(ok.warmupRequired).toBe(false);
  });
  it('hook: боль ≥3 даёт RIR+1 и протокол', () => {
    const r = applyPro5Safety({ elbowPain: 4 });
    expect(r.hookRirShift).toBe(1);
    expect(r.notes.some((n) => n.includes('эксцентрик'))).toBe(true);
    expect(applyPro5Safety({ elbowPain: 1 }).hookRirShift).toBe(0);
  });
  it('losing-gate: защита + старт ≤2 нед', () => {
    const r = applyPro5Safety({ axisCheck: { fightingFromDefense: true }, weeksToStart: 1 });
    expect(r.forbidStressSingles).toBe(true);
    expect(applyPro5Safety({ axisCheck: { fightingFromDefense: true }, weeksToStart: 6 }).forbidStressSingles).toBe(false);
  });
  it('checkHookCap: кап 12', () => {
    const wk: any = { week: 1, sessions: [{ exercises: [{ muscle: 'supinators', sets: 8 }, { muscle: 'wrist_flexors', sets: 6 }] }] };
    expect(checkHookCap([wk], 12).length).toBe(1);
    expect(checkHookCap([wk], 20)).toEqual([]);
    expect(hookVolumeOf(wk)).toBe(14);
  });
  it('flexorPronatorEccentric — назначаемый блок', () => {
    const b = flexorPronatorEccentric();
    expect(b.sets).toBe(3);
    expect(b.tempo).toBe('4-0-1-0');
  });
});

describe('arm-pro5 platform rules (P2)', () => {
  it('9 снарядов 2026 с правилами', () => {
    expect(PLATFORM_RULES_2026.length).toBe(9);
    for (const r of PLATFORM_RULES_2026) {
      expect(r.grip.length).toBeGreaterThan(0);
      expect(r.fouls.length).toBeGreaterThan(0);
      expect(r.wrNote.length).toBeGreaterThan(0);
    }
  });
  it('raptor/fat_gripz честно без %', () => {
    expect(platformRuleFor('raptor_1h')?.wrNote).toContain('Ориентира нет');
    expect(platformRuleFor('fat_gripz_doh')?.wrNote).toContain('только кг');
    expect(platformRuleFor('rolling_thunder')?.wrNote).toContain('верифицирован');
    expect(platformRuleFor('nope')).toBeUndefined();
  });
  it('LMS-канон и лесенка только вверх', () => {
    expect(LMS_RULES_2026).toContain('60с');
    const lad = lmsLadderTo(100);
    expect(lad[0]).toBe(85);
    expect(lad[lad.length - 1]).toBe(100);
    for (let i = 1; i < lad.length; i++) expect(lad[i]).toBeGreaterThan(lad[i - 1]);
    expect(lmsLadderTo(0)).toEqual([]);
  });
});

describe('arm-pro5 coc gates (P3)', () => {
  it('crush + тяжёлая тяга в один день — warning', () => {
    const wk: any = { sessions: [{ exercises: [{ muscle: 'back_pressure', sets: 4, character: 'тяж' }, { muscle: 'grip_crush', sets: 3, name: 'CoC №2' }] }] };
    const w = checkCocGates(wk, 1);
    expect(w.some((s) => s.includes('тяжёлая тяга'))).toBe(true);
    expect(w.some((s) => s.includes('Expand Bands'))).toBe(true);
  });
  it('чистый день — тихо', () => {
    const wk: any = { sessions: [{ exercises: [{ muscle: 'grip_crush', sets: 3, name: 'CoC №2' }, { muscle: 'wrist_extensors', sets: 3 }] }] };
    expect(checkCocGates(wk, 1)).toEqual([]);
  });
});

describe('arm-pro5 singles + RPE (P4)', () => {
  it('rirForRpe карта', () => {
    expect(rirForRpe(8)).toBe(2);
    expect(rirForRpe(9)).toBe(1);
    expect(rirForRpe(7)).toBe(3);
    expect(rirForRpe(10)).toBe(0);
  });
  it('strengthLogRir: первая половина RIR выше', () => {
    expect(strengthLogRir(2, 'тяж')).toBe(2);
    expect(strengthLogRir(6, 'тяж')).toBe(1);
    expect(strengthLogRir(2, 'техника')).toBe(3);
    expect(strengthLogRir(7, 'техника')).toBe(2);
  });
  it('larrattSinglesFor: 5×1 @92%', () => {
    const s = larrattSinglesFor();
    expect(s.sets).toBe(5);
    expect(s.reps).toBe(1);
    expect(s.pctOfMax).toBe(0.92);
    expect(s.comment).toContain('17–18');
  });
  it('isSinglesCandidate', () => {
    expect(isSinglesCandidate('pronators')).toBe(true);
    expect(isSinglesCandidate('side_pressure')).toBe(false);
  });
});

describe('arm-pro5 ux + period (P5/P7)', () => {
  it('suggestSplitForCycle: ближайший по частоте', () => {
    const splits: any = [
      { id: 's2', name: 'Два', sessionsPerRotation: 2, rotationDays: 7 },
      { id: 's4', name: 'Четыре', sessionsPerRotation: 4, rotationDays: 7 },
    ];
    const s = suggestSplitForCycle({ id: 'c', name: 'Цикл', daysPerWeek: 4, tablePerWeek: 1, discipline: 'armwrestling' }, splits);
    expect(s?.id).toBe('s4');
    expect(suggestSplitForCycle({ id: 'c', name: 'Ц', daysPerWeek: 4, tablePerWeek: 0, discipline: 'a' }, [])).toBeNull();
  });
  it('consentPreview: 4 состояния', () => {
    expect(consentPreview({ fit: 'exact', cycleWeeks: 8, targetWeeks: 8, cycleName: 'Ц' }).canApply).toBe(true);
    expect(consentPreview({ fit: 'proposed_extend', cycleWeeks: 6, targetWeeks: 8, cycleName: 'Ц' }).lines.join(' ')).toContain('Было');
    expect(consentPreview({ fit: 'proposed_shrink', cycleWeeks: 12, targetWeeks: 8, cycleName: 'Ц' }).lines.join(' ')).toContain('Станет');
    expect(consentPreview({ fit: 'strict_skip', cycleWeeks: 6, targetWeeks: 8, cycleName: 'Ц' }).canApply).toBe(false);
  });
  it('deloadEnforcement: каденс 4 (masters 3)', () => {
    const no: Record<number, string> = { 1: 'accumulation', 2: 'accumulation', 3: 'accumulation', 4: 'accumulation', 5: 'accumulation', 6: 'accumulation' };
    expect(deloadEnforcement(no, 6, false).length).toBeGreaterThan(0);
    const ok: Record<number, string> = { 1: 'accumulation', 2: 'accumulation', 3: 'accumulation', 4: 'deload', 5: 'accumulation', 6: 'accumulation', 7: 'accumulation', 8: 'deload' };
    expect(deloadEnforcement(ok, 8, false)).toEqual([]);
    expect(deloadEnforcement({ 1: 'accumulation', 2: 'accumulation', 3: 'accumulation', 4: 'accumulation', 5: 'accumulation', 6: 'accumulation' }, 6, true).length).toBeGreaterThan(0);
  });
  it('ARM_PHASE_PRESETS: 3 фазы', () => {
    expect(Object.keys(ARM_PHASE_PRESETS).sort()).toEqual(['off_season', 'peaking', 'strength_power']);
    expect(ARM_PHASE_PRESETS.peaking.volumeMult).toBe(0.6);
  });
});

describe('arm-pro5 builder wiring', () => {
  it('ось high: side в технику + ⛔ + rationale', () => {
    const p: any = buildArmPlan({ ...BASE, axisCheck: { trunkRotatedTowardAttack: true, wristBehindShoulder: true, wristExtendedDorsally: true } });
    expect(p.rationale.some((r: string) => r.includes('ось high'))).toBe(true);
    expect(p.safetyWarnings.some((w: string) => w.startsWith('⛔'))).toBe(true);
    for (const wk of p.weeks) for (const s of wk.sessions) for (const e of s.exercises) {
      if (e.muscle === 'side_pressure') expect(e.character).not.toBe('тяж');
    }
  });
  it('без axisCheck — тихо (байт-в-байт)', () => {
    const p: any = buildArmPlan({ ...BASE });
    expect(p.rationale.some((r: string) => r.includes('ось high'))).toBe(false);
    expect(p.safetyWarnings.some((w: string) => w.startsWith('⛔'))).toBe(false);
  });
  it('PED unknown id — честная строка, поведение то же', () => {
    const p: any = buildArmPlan({ ...BASE, pedDoses: { mystery_xyz: 100 }, courseIntensity: 'moderate' });
    expect(p.rationale.some((r: string) => r.includes('неизвестные id'))).toBe(true);
    const known: any = buildArmPlan({ ...BASE, pedDoses: { test_e: 100 }, courseIntensity: 'moderate' });
    expect(known.rationale.some((r: string) => r.includes('неизвестные id'))).toBe(false);
  });
  it('синглы: heavySingles + advanced дают Larratt-блок', () => {
    const p: any = buildArmPlan({ ...BASE, level: 'advanced', heavySingles: true });
    const comments = p.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.comment || '')));
    expect(comments.some((c: string) => c.includes('Larratt-синглы'))).toBe(true);
    expect(p.rationale.some((r: string) => r.includes('Larratt-синглы 5×1'))).toBe(true);
    const off: any = buildArmPlan({ ...BASE, level: 'advanced' });
    expect(off.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.comment || ''))).some((c: string) => c.includes('Larratt-синглы'))).toBe(false);
  });
  it('rpeParity: RIR выше в первой половине', () => {
    const a: any = buildArmPlan({ ...BASE, weeks: 4 });
    const b: any = buildArmPlan({ ...BASE, weeks: 4, rpeParity: true });
    const rirOf = (p: any) => p.weeks[0].sessions.flatMap((s: any) => s.exercises).filter((e: any) => e.character === 'тяж').map((e: any) => e.rir);
    const ra = rirOf(a);
    const rb = rirOf(b);
    expect(rb.length).toBeGreaterThan(0);
    expect(Math.min(...rb)).toBeGreaterThanOrEqual(Math.min(...ra));
    expect(b.rationale.some((r: string) => r.includes('StrengthLog'))).toBe(true);
  });
  it('вес-ориентир помечается без workMax', () => {
    const p: any = buildArmPlan({ ...BASE });
    const comments = p.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.comment || '')));
    expect(comments.some((c: string) => c.includes('вес ориентир'))).toBe(true);
    const wm: any = buildArmPlan({ ...BASE, workMax: { wrist_flexors: 40, wrist_extensors: 20, pronators: 30, supinators: 30, risers: 25, thumb: 15, brachialis: 50, biceps_long: 60, biceps_short: 60, brachioradialis: 40, back_pressure: 80, side_pressure: 70, grip_support: 60, grip_pinch: 40, grip_crush: 50, shoulder_stab: 30, core_anchor: 50, ulnar_deviators: 20, radial_deviators: 20 } });
    const c2 = wm.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.comment || '')));
    expect(c2.some((c: string) => c.includes('вес ориентир'))).toBe(false);
  });
  it('cyclePctPerWeek распил: строка раздельных полей', () => {
    const p: any = buildArmPlan({ ...BASE, cyclePctPerWeek: 1, mesoRatePct: 2 });
    expect(p.rationale.some((r: string) => r.includes('раздельные поля PRO-5'))).toBe(true);
    const leg: any = buildArmPlan({ ...BASE, correctionPct: 0.5 });
    expect(leg.rationale.some((r: string) => r.includes('legacy correctionPct'))).toBe(true);
  });
  it('ACWR danger режет MRV и пишет строку', () => {
    const mk = (rpe: number, n: number) => Array.from({ length: n }, (_, i) => ({ dateIso: `2026-02-${String(i + 1).padStart(2, '0')}`, srpe: rpe, durationMin: 60 }));
    const base: any = buildArmPlan({ ...BASE });
    const danger: any = buildArmPlan({ ...BASE, diary: [...mk(5, 10), ...mk(13.4, 7)] });
    expect(danger.mrvByMuscle.brachialis).toBeLessThan(base.mrvByMuscle.brachialis);
    expect(danger.rationale.some((r: string) => r.includes('ACWR'))).toBe(true);
  });
  it('сплит-подсказка при расхождении с циклом', () => {
    const p: any = buildArmPlan({ ...BASE, patternId: 'arm_2_table_support', cycleId: 'strengthlog_8', cycleConsent: true });
    expect(p.rationale.some((r: string) => r.includes('подходит сплит'))).toBe(true);
  });
  it('hook-кап: гейт только hook/явный кап; без перегруза тихо', () => {
    const hook: any = buildArmPlan({ ...BASE, technique: 'hook', weeks: 8 });
    expect(hook.safetyWarnings.some((w: string) => w.includes('hook-объём'))).toBe(false);
    const hookCap: any = buildArmPlan({ ...BASE, technique: 'hook', weeks: 8, hookCapSets: 8 });
    expect(hookCap.safetyWarnings.some((w: string) => w.includes('hook-объём'))).toBe(true);
    const bal: any = buildArmPlan({ ...BASE, technique: 'balanced', weeks: 4 });
    expect(bal.safetyWarnings.some((w: string) => w.includes('hook-объём'))).toBe(false);
    const explicit: any = buildArmPlan({ ...BASE, technique: 'balanced', weeks: 4, hookCapSets: 4 });
    expect(explicit.safetyWarnings.some((w: string) => w.includes('hook-объём'))).toBe(true);
  });
  it('валидатор: blocked при оси high, valid как было', () => {
    const p: any = buildArmPlan({ ...BASE, axisCheck: { trunkRotatedTowardAttack: true, wristBehindShoulder: true, wristExtendedDorsally: true } });
    const v = validateArmPlan(p);
    expect(v.blocked && v.blocked.length).toBeGreaterThan(0);
    expect(v.blocked!.some((b) => b.includes('Ось high'))).toBe(true);
    const plain: any = buildArmPlan({ ...BASE });
    expect(validateArmPlan(plain).blocked).toEqual([]);
  });
  it('WAF-2025: чек-лист фолов в contest-sim', () => {    const s = buildContestSimWeek({ discipline: 'armwrestling' });
    expect(s.checklist.some((c) => c.includes('центрлайн'))).toBe(true);
    expect(waf2025FoulChecklist().length).toBe(7);
    const lift = buildContestSimWeek({ discipline: 'armlifting', targetKg: 100 });
    expect(lift.attempts).toEqual([90, 96, 102]);
  });
  it('annual: фазовый пресет виден в warnings блока', () => {
    const t = buildArmBlock({ blockKey: 'b1', weeks: 4, phase: 'transition' }, {});
    expect(t.warnings.some((w) => w.includes('Фаза года'))).toBe(true);
    expect(t.warnings.some((w) => w.includes('transition'))).toBe(true);
    const p = buildArmBlock({ blockKey: 'b2', weeks: 4, phase: 'peaking' }, {});
    expect(p.peakApplied).toBe(true);
    expect(p.warnings.some((w) => w.includes('peaking'))).toBe(true);
  });
  it('annual: PRO-5 passthrough (ставки/RPE/hook-кап)', () => {
    const r = buildArmBlock({ blockKey: 'r', weeks: 8, phase: 'strength' }, { cycleId: 'strengthlog_8', cycleConsent: true, cyclePctPerWeek: 1, mesoRatePct: 2 } as any);
    expect(r.armPlan.rationale.some((x: string) => x.includes('раздельные поля PRO-5'))).toBe(true);
    const h = buildArmBlock({ blockKey: 'h', weeks: 4, phase: 'strength' }, { hookCapSets: 4 } as any);
    expect(h.armPlan.safetyWarnings.some((w: string) => w.includes('hook-объём'))).toBe(true);
    const base = buildArmBlock({ blockKey: 'b', weeks: 4, phase: 'strength' }, {});
    expect(base.armPlan.safetyWarnings.some((w: string) => w.includes('hook-объём'))).toBe(false);
  });
  it('annual: consent-превью цикла в warnings', () => {
    const no = buildArmBlock({ blockKey: 'n', weeks: 8, phase: 'strength' }, { cycleId: 'tableready_12' } as any);
    expect(no.warnings.some((w) => w.includes('generic'))).toBe(true);
    const yes = buildArmBlock({ blockKey: 'y', weeks: 8, phase: 'strength' }, { cycleId: 'tableready_12', cycleConsent: true } as any);
    expect(yes.warnings.some((w) => w.includes('Станет'))).toBe(true);
  });
  it('E2E 52 нед: год собирается, тейпер один раз (без двойного среза)', () => {
    const blocks = buildArmYearBlocks('super_series', 52, { level: 'intermediate' });
    expect(blocks.reduce((s, b) => s + b.weeks, 0)).toBe(52);
    let markers = 0;
    for (const b of blocks) {
      const res = buildArmBlock(
        { blockKey: b.blockKey, weeks: b.weeks, phase: b.phase },
        { level: 'intermediate', taperEnabled: b.phase === 'peaking' } as any,
      );
      expect(res.weeks.length).toBeGreaterThan(0);
      for (const wk of res.armPlan.weeks as any[]) {
        const hits = String(wk.note || '').split('[arm-taper:').length - 1;
        expect(hits).toBeLessThanOrEqual(1);
        markers += hits;
      }
    }
    expect(markers).toBeGreaterThan(0);
    expect(markers).toBeLessThanOrEqual(3);
  });
  it('гард двойного среза: хвост non-classic идёт полным (режет только кривая)', () => {
    const base: any = { discipline: 'armwrestling', patternId: 'arm_4_upper_lower', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 6 };
    const vol = (p: any, w: number) => p.weeks[w - 1].sessions.reduce((s: number, ss: any) => s + ss.exercises.reduce((a: number, e: any) => a + e.sets, 0), 0);
    const cyc: any = buildArmPlan({ ...base, cycleId: 'toproll_6', cycleConsent: true });
    const gen: any = buildArmPlan({ ...base });
    // хвост toproll-пресета идёт с weekMult 1.0 (generic пик — 0.45): без гарда было бы 0.45×кривая
    expect(vol(cyc, 6)).toBeGreaterThan(vol(gen, 6));
  });
});
