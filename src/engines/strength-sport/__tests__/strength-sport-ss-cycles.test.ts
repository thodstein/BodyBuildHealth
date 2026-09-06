import { describe, it, expect } from 'vitest';
import { SS_CYCLES, getSSCycleById } from '../../../data/ss-cycles/ss-cycle-index';
import { rankSSCycle, recommendSSCycle, bulgarianGate } from '../strength-sport-ss-selector.engine';
import { buildSSCyclePlan } from '../strength-sport-ss-cycle-to-plan.engine';
import { buildAnnualFromSSCycles, validateSSAnnual } from '../strength-sport-ss-annual.engine';
import { buildStrengthPrintHtml, buildStrengthCsv } from '../strength-sport-export';

const WM = {
  snatch: 80, cleanJerk: 100, backSquat: 140, frontSquat: 120, deadlift: 180,
  overheadPress: 60, bench: 90, logPress: 80, yokeWalk: 220, farmersWalk: 150,
  atlasStone: 110, frameCarry: 180, axlePress: 70,
} as any;

const baseInput = (over: any = {}) => ({
  mode: 'weightlifting', goal: 'strength', level: 'intermediate',
  weeks: 8, daysPerWeek: 5, workMax: WM, ...over,
}) as any;

describe('ss-cycles index integrity', () => {
  it('10 циклов, id уникальны', () => {
    expect(SS_CYCLES.length).toBe(10);
    const ids = SS_CYCLES.map(c => c.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('weeks.length == meta.weeks, week1 == weeks[0], дни в вилке sessionsPerWeek..Max', () => {
    for (const c of SS_CYCLES) {
      expect(c.weeks.length, c.meta.id).toBe(c.meta.weeks);
      expect(c.week1, c.meta.id).toEqual(c.weeks[0]);
      const lo = c.meta.sessionsPerWeek;
      const hi = c.meta.sessionsPerWeekMax ?? c.meta.sessionsPerWeek;
      for (const [i, w] of c.weeks.entries()) {
        expect(w.length, `${c.meta.id} w${i + 1}`).toBeGreaterThanOrEqual(lo);
        expect(w.length, `${c.meta.id} w${i + 1}`).toBeLessThanOrEqual(hi);
      }
    }
  });
  it('% в (0, 1.1] (bodyweight pct=0), сеты/повторы положительные, дистанция/кап положительные', () => {
    for (const c of SS_CYCLES) {
      for (const w of c.weeks) for (const d of w) for (const e of d.exercises) {
        expect(e.sets.length, `${c.meta.id}/${e.id}`).toBeGreaterThan(0);
        for (const s of e.sets) {
          if ((e as any).bodyweight) expect(s.pct, `${c.meta.id}/${e.id}`).toBe(0);
          else {
            expect(s.pct, `${c.meta.id}/${e.id}`).toBeGreaterThan(0);
            expect(s.pct, `${c.meta.id}/${e.id}`).toBeLessThanOrEqual(1.1);
          }
          expect(s.sets).toBeGreaterThanOrEqual(1);
          expect(s.reps).toBeGreaterThanOrEqual(0);
          if (s.distanceM != null) expect(s.distanceM).toBeGreaterThanOrEqual(0);
          if (s.timeCapS != null) expect(s.timeCapS).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('ss-selector', () => {
  it('TA 5д/8нед intermediate → general-8 exact', () => {
    const rec = recommendSSCycle({ mode: 'weightlifting', level: 'intermediate', daysPerWeek: 5, weeks: 8 });
    expect(rec?.meta.id).toBe('ss-ta-general-8');
  });
  it('болгарский заблокирован без согласия, разрешён с согласием+advanced', () => {
    const blocked = rankSSCycle({ mode: 'weightlifting', level: 'advanced', daysPerWeek: 6, weeks: 8 });
    const bg = blocked.find(r => r.cycle.meta.id === 'ss-ta-bulgarian')!;
    expect(bg.blocked).toMatch(/согласие/);
    const allowed = rankSSCycle({ mode: 'weightlifting', level: 'advanced', daysPerWeek: 6, weeks: 8, cycleConsent: true });
    expect(allowed.find(r => r.cycle.meta.id === 'ss-ta-bulgarian')!.blocked).toBeUndefined();
  });
  it('болгарский гейт: новичок и ACWR-caution блокируют', () => {
    expect(bulgarianGate({ mode: 'weightlifting', level: 'beginner', daysPerWeek: 6, weeks: 8, cycleConsent: true })).toMatch(/advanced/);
    expect(bulgarianGate({ mode: 'weightlifting', level: 'advanced', daysPerWeek: 6, weeks: 8, cycleConsent: true, acwrZone: 'caution' })).toMatch(/ACWR/);
  });
  it('стронг без снарядов → куб с fallbackNote, а не пусто', () => {
    const ranked = rankSSCycle({ mode: 'strongman', level: 'intermediate', daysPerWeek: 4, weeks: 12, equipment: ['barbell'] });
    const cube = ranked.find(r => r.cycle.meta.id === 'ss-sm-cube-12')!;
    expect(cube.blocked).toBeUndefined();
    expect(cube.fallbackNote).toMatch(/фолбэк/);
  });
});

describe('ss-cycle-to-plan faithful (дословный)', () => {
  it('ta-general-8: 8 недель, patternId cycle:, инвариант sets==workSets', () => {
    const plan = buildSSCyclePlan('ss-ta-general-8', baseInput(), { cycleMode: 'faithful' });
    expect(plan.weeksData.length).toBe(8);
    expect(plan.patternId).toBe('cycle:ss-ta-general-8');
    for (const w of plan.weeksData) for (const s of w.sessions) for (const e of s.exercises) {
      expect(e.sets, `${e.id}`).toBe(e.workSets.length);
      expect(e.workSets.length).toBeGreaterThan(0);
    }
    expect(plan.inputSnapshot?.cycleId).toBe('ss-ta-general-8');
  });
  it('531: веса от TM 90% (жим 60 → TM 54 → 65% = 35кг)', () => {
    const plan = buildSSCyclePlan('ss-sm-531-4',
      { mode: 'strongman', goal: 'strength', level: 'intermediate', weeks: 4, daysPerWeek: 4, workMax: WM } as any,
      { cycleMode: 'faithful' });
    const ohp = plan.weeksData[0].sessions[0].exercises.find(e => e.id === 'ohp')!;
    expect(ohp.workSets[0].weight).toBe(35); // 60×0.9×0.65=35.1 → 35
    expect(ohp.comment).toMatch(/AMRAP/);
  });
  it('start-12: тейпер нед.12 меньше объёма нед.11, ивенты ≤70%', () => {
    const plan = buildSSCyclePlan('ss-sm-start-12',
      { mode: 'strongman', goal: 'strength', level: 'beginner', weeks: 12, daysPerWeek: 4, workMax: WM } as any,
      { cycleMode: 'faithful' });
    expect(plan.weeksData[11].taper).toBe(true);
    expect(plan.weeksData[11].totalSets).toBeLessThan(plan.weeksData[10].totalSets || 0);
    const evDay = plan.weeksData[11].sessions.find(s => s.sessionTag === 'event_day')!;
    for (const e of evDay.exercises) for (const ws of e.workSets) {
      expect(ws.pct).toBeLessThanOrEqual(70);
    }
  });
  it('якорь к дате старта в rationale', () => {
    const plan = buildSSCyclePlan('ss-sm-start-12',
      { mode: 'strongman', goal: 'peaking', level: 'beginner', weeks: 12, daysPerWeek: 4, workMax: WM, competitionDate: '2026-10-01' } as any,
      { cycleMode: 'faithful' });
    expect(plan.rationale.join(' ')).toMatch(/Якорь к старту 2026-10-01/);
  });
  it('фолбэк без снарядов: йок ×0.73 с комментарием', () => {
    const plan = buildSSCyclePlan('ss-sm-cube-12',
      { mode: 'strongman', goal: 'strength', level: 'intermediate', weeks: 12, daysPerWeek: 4, workMax: WM, equipment: ['barbell'] } as any,
      { cycleMode: 'faithful' });
    expect(plan.validation.warnings.join(' ')).toMatch(/замены/);
    const yoke = plan.weeksData[0].sessions.flatMap(s => s.exercises).find(e => e.id === 'yoke_walk')!;
    expect(yoke.comment).toMatch(/×0.73/);
  });
  it('все циклы реестра строятся без throw', () => {
    for (const c of SS_CYCLES) {
      const plan = buildSSCyclePlan(c, baseInput({ mode: c.meta.mode === 'hybrid' ? 'hybrid' : c.meta.mode }) as any, { cycleMode: 'faithful' });
      expect(plan.weeksData.length).toBe(c.meta.weeks);
    }
  });
});

describe('ss-cycle-to-plan adapt', () => {
  it('ACWR dangerous режет объём vs faithful + warning про faithful', () => {
    const acwr = { ratio: 1.8, zone: 'dangerous' };
    const faithful = buildSSCyclePlan('ss-ta-general-8', baseInput({ acwr }), { cycleMode: 'faithful' });
    const adapt = buildSSCyclePlan('ss-ta-general-8', baseInput({ acwr }), { cycleMode: 'adapt' });
    const fSets = faithful.weeksData[0].totalSets || 0;
    const aSets = adapt.weeksData[0].totalSets || 0;
    expect(aSets).toBeLessThan(fSets);
    expect(faithful.validation.warnings.join(' ')).toMatch(/Дословный режим/);
  });
  it('травма колена режет вес приседа даже в faithful', () => {
    const plan = buildSSCyclePlan('ss-ta-general-8',
      baseInput({ injuries: [{ location: 'knee' }] }), { cycleMode: 'faithful' });
    const sq = plan.weeksData[0].sessions[0].exercises.find(e => e.id === 'back_squat')!;
    // 140×0.70=98 → ×0.6=58.8 → 60 (шаг 2.5 в faithful? шаг 2.5: 58.75→60? round(58.8/2.5)=24→60)
    expect(sq.workSets[0].weight).toBeLessThan(98);
    expect(sq.comment).toMatch(/Щадящий/);
  });
  it('adapt: per-lift VBT-history режет объём (snatch −31% > верхнего порога 20%)', () => {
    const faithful = buildSSCyclePlan('ss-ta-general-8', baseInput(), { cycleMode: 'faithful' });
    const adapt = buildSSCyclePlan('ss-ta-general-8',
      baseInput({ velocityHistory: { snatch: [1.60, 1.10] } }), { cycleMode: 'adapt' });
    const fSets = faithful.weeksData[0].totalSets || 0;
    const aSets = adapt.weeksData[0].totalSets || 0;
    expect(aSets).toBeLessThan(fSets);
  });
  it('adapt: просадка дневника −8% режет, плато +1 сет', () => {
    const faithful = buildSSCyclePlan('ss-ta-general-8', baseInput(), { cycleMode: 'faithful' });
    const down = buildSSCyclePlan('ss-ta-general-8',
      baseInput({ diaryTrend: [{ lift: 'squat', changePct: -8 }] }), { cycleMode: 'adapt' });
    expect((down.weeksData[0].totalSets || 0)).toBeLessThan(faithful.weeksData[0].totalSets || 0);
    const plateau = buildSSCyclePlan('ss-ta-general-8',
      baseInput({ diaryTrend: [{ lift: 'squat', changePct: 0 }] }), { cycleMode: 'adapt' });
    expect((plateau.weeksData[0].totalSets || 0)).toBeGreaterThan(faithful.weeksData[0].totalSets || 0);
  });
  it('adapt: HRV-история не роняет сборку, веса не выше faithful', () => {
    const faithful = buildSSCyclePlan('ss-ta-general-8', baseInput(), { cycleMode: 'faithful' });
    try { localStorage.setItem('he_hrv_log', JSON.stringify([55, 58, 52, 57, 54, 56, 53, 55])); } catch { /* noop */ }
    let adapt;
    try {
      adapt = buildSSCyclePlan('ss-ta-general-8', baseInput(), { cycleMode: 'adapt' });
    } finally {
      try { localStorage.removeItem('he_hrv_log'); } catch { /* noop */ }
    }
    const fW = faithful.weeksData[0].sessions[0].exercises[0].workSets[0].weight;
    const aW = adapt.weeksData[0].sessions[0].exercises[0].workSets[0].weight;
    expect(aW).toBeLessThanOrEqual(fW);
  });
  it('весогонка: протокол в rationale, сборка без throw', () => {
    const plan = buildSSCyclePlan('ss-ta-general-8',
      baseInput({ weightCutKg: 3, bodyweight: 80, sex: 'male' }), { cycleMode: 'adapt' });
    expect(plan.weeksData.length).toBe(8);
    expect(plan.rationale.join(' ')).toMatch(/Весогонка/);
  });
  it('гибрид с профильным циклом — честное предупреждение', () => {
    const plan = buildSSCyclePlan('ss-ta-general-8', baseInput({ mode: 'hybrid' }), { cycleMode: 'faithful' });
    expect(plan.validation.warnings.join(' ')).toMatch(/Гибрид/);
  });
});

describe('ss-selector weak/contest', () => {  it('слабый лог тянет стронг-циклы с логом вверх', () => {
    const ranked = rankSSCycle({ mode: 'strongman', level: 'intermediate', daysPerWeek: 4, weeks: 12, weakPoints: ['log_press'] });
    const top = ranked.filter(r => !r.blocked)[0];
    const ids = top.cycle.weeks.flatMap(w => w.flatMap(d => d.exercises.map(e => e.id)));
    expect(ids).toContain('log_press');
    expect(top.reasons.join(' ')).toMatch(/слабые покрыты/);
  });
  it('контест-ивенты поднимают цикл с их покрытием', () => {
    const ranked = rankSSCycle({ mode: 'strongman', level: 'intermediate', daysPerWeek: 4, weeks: 12, contestEvents: ['yoke_walk', 'atlas_stone_load'] });
    const top = ranked.filter(r => !r.blocked)[0];
    expect(top.reasons.join(' ')).toMatch(/контест-ивенты/);
  });
});

describe('ss-annual из циклов', () => {
  it('два цикла → блоки 1-8 + 9-12, валидация ок', () => {
    const annual = buildAnnualFromSSCycles(['ss-ta-general-8', 'ss-sm-531-4'], baseInput());
    expect(annual.totalWeeks).toBe(12);
    expect(annual.blocks.length).toBe(2);
    expect(annual.blocks[0].startWeek).toBe(1);
    expect(annual.blocks[1].startWeek).toBe(9);
    expect(validateSSAnnual(annual).ok).toBe(true);
  });
  it('дата старта якорится на последний блок с тейпером', () => {
    const annual = buildAnnualFromSSCycles(['ss-ta-general-8', 'ss-sm-start-12'], baseInput(), { competitionDate: '2026-10-01', taperWeeks: 1 });
    const last = annual.blocks[annual.blocks.length - 1];
    expect(last.competitionDate).toBe('2026-10-01');
    expect(last.plan?.weeksData.some(w => (w as any).taper)).toBe(true);
  });
  it('неизвестный id → throw', () => {
    expect(() => buildAnnualFromSSCycles(['nope'], baseInput())).toThrow(/не найден/);
  });
});

describe('ss-print/csv', () => {
  it('печать содержит cycle-id, дистанции и AMRAP', () => {
    const sm = buildSSCyclePlan('ss-sm-start-12',
      { mode: 'strongman', goal: 'strength', level: 'beginner', weeks: 12, daysPerWeek: 4, workMax: WM } as any,
      { cycleMode: 'faithful' });
    const html = buildStrengthPrintHtml(sm);
    expect(html).toContain('cycle:ss-sm-start-12');
    expect(html).toContain('м');
    const w531 = buildSSCyclePlan('ss-sm-531-4',
      { mode: 'strongman', goal: 'strength', level: 'intermediate', weeks: 4, daysPerWeek: 4, workMax: WM } as any,
      { cycleMode: 'faithful' });
    expect(buildStrengthPrintHtml(w531)).toContain('AMRAP');
  });
  it('csv содержит шапку с Дист и строки ивентов', () => {
    const sm = buildSSCyclePlan('ss-sm-start-12',
      { mode: 'strongman', goal: 'strength', level: 'beginner', weeks: 12, daysPerWeek: 4, workMax: WM } as any,
      { cycleMode: 'faithful' });
    const csv = buildStrengthCsv(sm);
    expect(csv.split('\n')[0]).toContain('Дист');
    expect(csv).toContain('Фермер');
  });
});
