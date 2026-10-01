/**
 * ss-pro-cycles.test.ts — PRO-волна циклов ТА/стронга (12 новых).
 * Локи: реестр, форма (weeks/week1/%), фазы без дыр, делоды/тейперы/mock
 * в диапазоне, сборка без throw, инвариант sets==workSets, профессиональные
 * якоря (comp-12 mock, peak-8 mock+тейпер, static лог+становая, moving переноски).
 */
import { describe, it, expect } from 'vitest';
import { SS_CYCLES, getSSCycleById } from '../../../data/ss-cycles/ss-cycle-index';
import { buildSSCyclePlan } from '../strength-sport-ss-cycle-to-plan.engine';

const WM = {
  snatch: 80, cleanJerk: 100, clean: 100, jerk: 100, backSquat: 140, frontSquat: 120,
  deadlift: 180, overheadPress: 60, bench: 90, logPress: 80, yokeWalk: 220,
  farmersWalk: 150, atlasStone: 110, frameCarry: 180, axlePress: 70, axleDeadlift: 180,
  sandbagLoad: 110, kegToss: 60, husafellCarry: 140, carDeadlift: 220, circusDbPress: 70,
} as any;

const PRO_IDS = [
  'ss-ta-technique-6', 'ss-ta-strength-8', 'ss-ta-squat-spec-6', 'ss-ta-masters-8',
  'ss-ta-russian-12', 'ss-ta-comp-12', 'ss-ta-taper-2', 'ss-ta-gpp-8',
  'ss-sm-beginner-8', 'ss-sm-gpp-10', 'ss-sm-static-12', 'ss-sm-moving-8',
  'ss-sm-loading-6', 'ss-sm-peak-8', 'ss-sm-taper-2',
  'ss-hb-base-10', 'ss-hb-peak-6',
];

const inputFor = (mode: string, over: any = {}) => ({
  mode, goal: 'strength', level: 'intermediate',
  weeks: 12, daysPerWeek: 4, workMax: WM, equipment: ['barbell', 'other'], ...over,
}) as any;

describe('PRO-циклы: реестр', () => {
  it('32 цикла всего (было 15), id уникальны', () => {
    expect(SS_CYCLES.length).toBe(32);
    const ids = SS_CYCLES.map(c => c.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('все 17 PRO-циклов в реестре и достаются по id', () => {
    for (const id of PRO_IDS) {
      const c = getSSCycleById(id);
      expect(c, id).toBeTruthy();
      expect(c!.meta.id).toBe(id);
    }
  });
  it('режимы: 14 ТА + 14 стронг + 4 гибрид', () => {
    const ta = SS_CYCLES.filter(c => c.meta.mode === 'weightlifting').length;
    const sm = SS_CYCLES.filter(c => c.meta.mode === 'strongman').length;
    const hb = SS_CYCLES.filter(c => c.meta.mode === 'hybrid').length;
    expect(ta).toBe(14);
    expect(sm).toBe(14);
    expect(hb).toBe(4);
  });
});

describe('PRO-циклы: форма', () => {
  const pro = () => PRO_IDS.map(id => getSSCycleById(id)!);

  it('weeks.length == meta.weeks, week1 == weeks[0], дни в вилке', () => {
    for (const c of pro()) {
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

  it('% в (0,1.1], bodyweight pct=0, сеты/повторы положительны', () => {
    for (const c of pro()) {
      for (const w of c.weeks) for (const d of w) for (const e of d.exercises) {
        expect(e.sets.length, `${c.meta.id}/${e.id}`).toBeGreaterThan(0);
        expect(e.name, `${c.meta.id}/${e.id}`).not.toBe(e.id); // русское имя задано
        for (const s of e.sets) {
          if ((e as any).bodyweight) expect(s.pct, `${c.meta.id}/${e.id}`).toBe(0);
          else {
            expect(s.pct, `${c.meta.id}/${e.id}`).toBeGreaterThan(0);
            expect(s.pct, `${c.meta.id}/${e.id}`).toBeLessThanOrEqual(1.1);
          }
          expect(s.sets, `${c.meta.id}/${e.id}`).toBeGreaterThanOrEqual(1);
          expect(s.reps, `${c.meta.id}/${e.id}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('фазы покрывают все недели без дыр', () => {
    for (const c of pro()) {
      const phases = c.meta.phases || [];
      expect(phases.length, c.meta.id).toBeGreaterThan(0);
      const covered = new Set<number>();
      for (const p of phases) {
        for (let w = p.weekStart; w <= p.weekEnd; w++) covered.add(w);
      }
      for (let w = 1; w <= c.meta.weeks; w++) {
        expect(covered.has(w), `${c.meta.id} week ${w}`).toBe(true);
      }
    }
  });

  it('делоды/тейперы/mock внутри [1..weeks]', () => {
    for (const c of pro()) {
      for (const w of c.meta.deloadWeeks || []) {
        expect(w, `${c.meta.id} deload`).toBeGreaterThanOrEqual(1);
        expect(w, `${c.meta.id} deload`).toBeLessThanOrEqual(c.meta.weeks);
      }
      for (const w of c.meta.taperWeeks || []) {
        expect(w, `${c.meta.id} taper`).toBeGreaterThanOrEqual(1);
        expect(w, `${c.meta.id} taper`).toBeLessThanOrEqual(c.meta.weeks);
      }
      for (const w of c.meta.mockWeeks || []) {
        expect(w, `${c.meta.id} mock`).toBeGreaterThanOrEqual(1);
        expect(w, `${c.meta.id} mock`).toBeLessThanOrEqual(c.meta.weeks);
      }
    }
  });

  it('description/howItWorks/conditions не пусты', () => {
    for (const c of pro()) {
      expect(c.meta.description.length, c.meta.id).toBeGreaterThan(20);
      expect(c.meta.howItWorks.length, c.meta.id).toBeGreaterThan(20);
      expect(c.meta.conditions.length, c.meta.id).toBeGreaterThan(0);
    }
  });
});

describe('PRO-циклы: сборка', () => {
  it('каждый PRO-цикл строится faithful без throw + sets==workSets', () => {
    for (const id of PRO_IDS) {
      const c = getSSCycleById(id)!;
      const plan = buildSSCyclePlan(c, inputFor(c.meta.mode, {
        weeks: c.meta.weeks, daysPerWeek: c.meta.sessionsPerWeek,
      }), { cycleMode: 'faithful' });
      expect(plan.weeksData.length, id).toBe(c.meta.weeks);
      expect(plan.patternId, id).toBe(`cycle:${id}`);
      for (const w of plan.weeksData) for (const s of w.sessions) for (const e of s.exercises) {
        expect(e.sets, `${id}/${e.id}`).toBe(e.workSets.length);
        expect(e.workSets.length, `${id}/${e.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('comp-12: нед.12 — тейпер+mock с заявками (opener/2-й/3-й)', () => {
    const plan = buildSSCyclePlan('ss-ta-comp-12', inputFor('weightlifting', { weeks: 12, daysPerWeek: 5 }), { cycleMode: 'faithful' });
    expect(plan.weeksData[11].taper).toBe(true);
    const snatchDay = plan.weeksData[11].sessions.find(s => s.sessionTag === 'snatch_day')!;
    const sn = snatchDay.exercises.find(e => e.id === 'snatch')!;
    expect(sn.workSets.length).toBe(3);
    // Заявки 90/96/101% — симуляция старта (имя в плане — каноническое из каталога)
    const pcts = sn.workSets.map(s => s.pct);
    expect(pcts[0]).toBe(90);
    expect(pcts[1]).toBe(96);
    expect(pcts[2]).toBe(101);
    expect(plan.rationale.join(' ')).toMatch(/Mock-недели 12/);
  });

  it('peak-8: mock нед.7, тейпер нед.8, объём тейпера меньше', () => {
    const plan = buildSSCyclePlan('ss-sm-peak-8', inputFor('strongman', { weeks: 8, daysPerWeek: 4 }), { cycleMode: 'faithful' });
    expect(plan.weeksData[6].taper).toBe(false); // mock-неделя не тейпер
    expect(plan.weeksData[7].taper).toBe(true);
    const mockDay = plan.weeksData[6].sessions.find(s => s.sessionTag === 'overhead_day')!;
    const log = mockDay.exercises.find(e => e.id === 'log_press')!;
    expect(log.workSets.map(s => s.pct)).toEqual([90, 96, 101]);
    expect(plan.weeksData[7].totalSets).toBeLessThan(plan.weeksData[6].totalSets || 0);
    expect(plan.rationale.join(' ')).toMatch(/Mock-недели 7/);
  });

  it('static-12: лог + становая в каждой неделе; тейпер нед.12', () => {
    const plan = buildSSCyclePlan('ss-sm-static-12', inputFor('strongman', { weeks: 12, daysPerWeek: 4 }), { cycleMode: 'faithful' });
    for (const w of plan.weeksData) {
      const ids = w.sessions.flatMap(s => s.exercises.map(e => e.id));
      expect(ids, `w${w.week}`).toContain('log_press');
      expect(ids.some(x => x.includes('deadlift')), `w${w.week}`).toBe(true);
    }
    expect(plan.weeksData[11].taper).toBe(true);
  });

  it('moving-8: дистанция растёт к концу (20 → 40м)', () => {
    const plan = buildSSCyclePlan('ss-sm-moving-8', inputFor('strongman', { weeks: 8, daysPerWeek: 4 }), { cycleMode: 'faithful' });
    const yokeDist = (wi: number) => {
      const ex = plan.weeksData[wi].sessions.flatMap(s => s.exercises).find(e => e.id === 'yoke_walk')!;
      return (ex.workSets[0] as any).distanceM as number;
    };
    expect(yokeDist(0)).toBe(20);
    expect(yokeDist(6)).toBe(40);
    expect(yokeDist(7)).toBeLessThan(yokeDist(6)); // финальная неделя короче (техника)
  });

  it('TA-циклы несут присед; SM-циклы — ивенты (лог/йок/камни)', () => {
    const idsOf = (plan: any) => plan.weeksData.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.id)));
    const taIds = idsOf(buildSSCyclePlan('ss-ta-comp-12', inputFor('weightlifting', { weeks: 12, daysPerWeek: 5 }), { cycleMode: 'faithful' }));
    expect(taIds.some((x: string) => x.includes('squat'))).toBe(true);
    const smIds = idsOf(buildSSCyclePlan('ss-sm-static-12', inputFor('strongman', { weeks: 12, daysPerWeek: 4 }), { cycleMode: 'faithful' }));
    expect(smIds).toContain('log_press');
    expect(smIds).toContain('atlas_stone_load');
    expect(smIds).toContain('frame_carry');
  });

  it('masters-8: без максимумов (все % ≤ 0.86) и есть техника-день', () => {
    const plan = buildSSCyclePlan('ss-ta-masters-8', inputFor('weightlifting', { weeks: 8, daysPerWeek: 4 }), { cycleMode: 'faithful' });
    for (const w of plan.weeksData) for (const s of w.sessions) for (const e of s.exercises) {
      for (const ws of e.workSets) expect(ws.pct ?? 0).toBeLessThanOrEqual(86);
    }
    expect(plan.weeksData[0].sessions.some(s => s.sessionTag === 'technique_day')).toBe(true);
  });

  it('тейпер-2 (ТА/СМ): 2 недели, тейпер-неделя помечена, интенсивность сохранена', () => {
    for (const id of ['ss-ta-taper-2', 'ss-sm-taper-2']) {
      const c = getSSCycleById(id)!;
      expect(c.meta.weeks, id).toBe(2);
      expect(c.meta.tags || [], id).toContain('taper');
      const plan = buildSSCyclePlan(c, inputFor(c.meta.mode, { weeks: 2, daysPerWeek: 4 }), { cycleMode: 'faithful' });
      expect(plan.weeksData.length, id).toBe(2);
      expect(plan.weeksData[1].taper, id).toBe(true);
      // Интенсивность сохранена: максимум % недели 2 ≥ максимума недели 1 − 5
      const maxPct = (wi: number) => Math.max(...plan.weeksData[wi].sessions.flatMap(s => s.exercises.flatMap(e => e.workSets.map(ws => ws.pct ?? 0))));
      expect(maxPct(1), id).toBeGreaterThanOrEqual(maxPct(0) - 5);
      // Объём падает (свежесть): сетов в нед.2 ≤ нед.1
      expect(plan.weeksData[1].totalSets || 0, id).toBeLessThanOrEqual(plan.weeksData[0].totalSets || 0);
    }
  });

  it('гибрид: база несёт штангу+ивенты с делодами, пик — mock нед.5 и тейпер нед.6', () => {
    const base = buildSSCyclePlan('ss-hb-base-10', inputFor('hybrid', { weeks: 10, daysPerWeek: 4 }), { cycleMode: 'faithful' });
    const ids = base.weeksData.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => e.id)));
    expect(ids).toContain('back_squat');
    expect(ids).toContain('log_press');
    expect(ids).toContain('farmers_walk_heavy');
    expect(ids).toContain('atlas_stone_load');
    expect(base.weeksData[3].deload).toBe(true);
    expect(base.weeksData[7].deload).toBe(true);

    const peak = buildSSCyclePlan('ss-hb-peak-6', inputFor('hybrid', { weeks: 6, daysPerWeek: 4 }), { cycleMode: 'faithful' });
    expect(peak.weeksData[4].taper).toBe(false); // mock-неделя
    expect(peak.weeksData[5].taper).toBe(true);
    const olyDay = peak.weeksData[4].sessions.find(s => s.sessionTag === 'oly_day')!;
    expect(olyDay.exercises.find(e => e.id === 'snatch')!.workSets.map(x => x.pct)).toEqual([90, 96, 101]);
    expect(peak.rationale.join(' ')).toMatch(/Mock-недели 5/);
  });
});
