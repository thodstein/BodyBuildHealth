import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { suggestCycleForMacroPhase } from '../arm-cycle-selector.engine';

function weekSets(p: any, w: number): number {
  const wk = p.weeks.find((x: any) => x.week === w);
  return wk.sessions.reduce((s: number, ss: any) => s + ss.exercises.reduce((a: number, e: any) => a + e.sets, 0), 0);
}
function hasTaperMark(p: any, w: number): boolean {
  const wk = p.weeks.find((x: any) => x.week === w);
  return /\[arm-taper:/.test(String(wk.note || ''));
}

describe('arm-cycle-r2 (taper wiring + split check + coc + macro)', () => {
  it('classic-пресет: финализатор маркеров не ставит (как раньше)', () => {
    let p: any = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 8, cycleId: 'strengthlog_8' } as any);
    p = finalizeArmPlan(p, { level: 'intermediate' });
    for (let w = 1; w <= 8; w++) expect(hasTaperMark(p, w)).toBe(false);
  });
  it('coc_8: хвост режется кривой, срединный делоад — нет', () => {
    let p: any = buildArmPlan({ discipline: 'armlifting', patternId: 'grip_3_support', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 8, cycleId: 'coc_8' } as any);
    const beforeTail = weekSets(p, 8);
    p = finalizeArmPlan(p, { level: 'intermediate' });
    expect(hasTaperMark(p, 8)).toBe(true);
    expect(hasTaperMark(p, 4)).toBe(false); // срединный делоад — только builder 0.6
    expect(weekSets(p, 8)).toBeLessThanOrEqual(Math.round(beforeTail * 0.6) + 2);
    expect(p.rationale.some((l: string) => /Тейпер-пресет coc_deload/.test(l))).toBe(true);
  });
  it('toproll_6: кривая 0.9/0.7 без двойного среза + идемпотентность', () => {
    let p: any = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'toproll', weeks: 6, cycleId: 'toproll_6' } as any);
    const w6before = weekSets(p, 6);
    p = finalizeArmPlan(p, { level: 'intermediate' });
    // Маркеры только на хвосте (w5/w6), не на рабочих неделях.
    expect(hasTaperMark(p, 5)).toBe(true);
    expect(hasTaperMark(p, 6)).toBe(true);
    expect(hasTaperMark(p, 4)).toBe(false);
    // Хвост шёл с weekMult 1.0 → кривая ЕДИНСТВЕННЫЙ срез (не 0.45!).
    // Точное число не ассертим: аддитивные пассы (+2 стол, +2 pron/sup,
    // +2 flex/ext) поднимают итог поверх среза — это не тейпер.
    expect(weekSets(p, 6)).toBeLessThan(w6before); // срез кусается несмотря на добавки
    expect(weekSets(p, 6)).toBeGreaterThan(Math.round(w6before * 0.45)); // не двойной срез
    const snap = JSON.stringify(p.weeks.map((w: any) => w.sessions.map((s: any) => s.exercises.map((e: any) => e.sets))));
    finalizeArmPlan(p, { level: 'intermediate' });
    expect(JSON.stringify(p.weeks.map((w: any) => w.sessions.map((s: any) => s.exercises.map((e: any) => e.sets))))).toBe(snap);
  });
  it('сплит-консистенция: только с cycleId, только warnings', () => {
    let p: any = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_2_table_support', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 8, cycleId: 'strengthlog_8' } as any);
    p = finalizeArmPlan(p, { level: 'intermediate' });
    const v = validateArmPlan(p, 'intermediate');
    expect(v.warnings.some((w) => /частота различается/.test(w))).toBe(true);
    expect(v.valid).toBe(v.errors.length === 0 && (v.mrvOverflow || []).length === 0);
    // без cycleId — тишина
    let q: any = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_2_table_support', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 8 });
    q = finalizeArmPlan(q, { level: 'intermediate' });
    expect(validateArmPlan(q, 'intermediate').warnings.some((w) => /Цикл/.test(w))).toBe(false);
  });
  it('CoC-покрытие: crush в каждой неделе при cocWorking', () => {
    let p: any = buildArmPlan({ discipline: 'armlifting', patternId: 'grip_3_support', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 3, cocWorking: 'no1' } as any);
    p = finalizeArmPlan(p, { level: 'intermediate' });
    for (const wk of p.weeks) {
      const has = wk.sessions.some((s: any) => s.exercises.some((e: any) => e.muscle === 'grip_crush'));
      expect(has).toBe(true);
    }
  });
  it('dobrorezov_44: полный год — 44 нед, все фазы, инварианты', () => {
    let p: any = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 44, cycleId: 'dobrorezov_44', cycleConsent: true } as any);
    expect(p.weeks.length).toBe(44);
    const phases = new Set(p.weeks.map((w: any) => w.phase));
    expect(phases.has('accumulation')).toBe(true);
    expect(phases.has('intensification')).toBe(true);
    p = finalizeArmPlan(p, { level: 'intermediate' });
    for (const wk of p.weeks) for (const s of wk.sessions) for (const e of s.exercises) {
      expect(e.sets).toBe(e.workSets.length);
    }
    expect(validateArmPlan(p, 'intermediate').errors.length).toBe(0);
  });
  it('годовой мост: фазы → известные циклы', () => {
    expect(suggestCycleForMacroPhase('hypertrophy')).toContain('strengthlog_8');
    expect(suggestCycleForMacroPhase('strength')).toContain('src_toproll_12');
    expect(suggestCycleForMacroPhase('peaking')).toContain('toproll_6');
    expect(suggestCycleForMacroPhase('transition')).toEqual(['brzenk_1_1']);
    expect(suggestCycleForMacroPhase('peaking', 'armlifting')).toContain('coc_12');
  });
});
