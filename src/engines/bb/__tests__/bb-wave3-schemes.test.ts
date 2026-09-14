/**
 * bb-wave3-schemes.test.ts — Волна-3 (аудит 2026-09), этап A:
 * 3.3 rep-schemes: реальная фаза плана + гейт minLevel;
 * 3.4 единые схемы объёма (GVT = ровно 10×10, Gironda = 8×8);
 * 3.5 единый BFR-протокол 30-15-15-15 (scheme + builder bfrMode).
 */
import { describe, it, expect } from 'vitest';
import { REP_SCHEMES, applySchemeToPlan, applyBfrPattern, levelMeetsMin } from '../bb-rep-schemes.engine';
import { recommendPEDMethodology } from '../bb-ped-methodology.engine';
import { applyVolumeScheme } from '../bb-finalize.engine';
import { buildBBPlan } from '../bb-builder.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('Волна-3.3 — rep-schemes видят реальную фазу плана', () => {
  it('AAS advanced + intensification → dc_rp возможен (было недостижимо)', () => {
    const m = recommendPEDMethodology({ peds: ['AAS'], pedDoses: { AAS: 1000 }, level: 'advanced', phase: 'intensification' });
    expect(m.recommendedScheme.heavy).toBe('dc_rp');
  });

  it('AAS + peaking → cluster возможен', () => {
    const m = recommendPEDMethodology({ peds: ['AAS'], pedDoses: { AAS: 1000 }, level: 'advanced', phase: 'peaking' });
    expect(m.recommendedScheme.heavy).toBe('cluster');
  });

  it('без фазы — прежнее accumulation-поведение (обратная совместимость)', () => {
    const m = recommendPEDMethodology({ peds: ['AAS'], pedDoses: { AAS: 1000 }, level: 'advanced' });
    expect(m.recommendedScheme.heavy).toBe('hypertrophy_8_12');
  });

  it('minLevel уважается: dc_rp не применяется intermediate', () => {
    expect(levelMeetsMin('intermediate', 'advanced')).toBe(false);
    expect(levelMeetsMin('advanced', 'advanced')).toBe(true);
    expect(levelMeetsMin('enhanced', undefined)).toBe(true);
    const mk = () => ({
      rationale: [], mrvByMuscle: {},
      weeks: [{ week: 1, phase: 'accumulation', sessions: [{ character: 'тяж', exercises: [{
        muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 3,
        repsRange: [6, 8], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 100 }, { reps: 8, rir: 2, weight: 100 }, { reps: 8, rir: 2, weight: 100 }],
      }] }] }],
    });
    const opts = { weightForRepMax: (reps: number, wm: number) => wm * 0.8, workMax: WM, defaultWorkMax: () => 50, intensityMult: 1 };
    expect(applySchemeToPlan(mk() as any, REP_SCHEMES.dc_rp, 'heavy_primary', { ...opts, level: 'intermediate' })).toBe(0);
    expect(applySchemeToPlan(mk() as any, REP_SCHEMES.dc_rp, 'heavy_primary', { ...opts, level: 'advanced' })).toBe(1);
  });
});

describe('Волна-3.4 — единые схемы объёма: GVT = ровно 10×10', () => {
  const mkPlan = () => ({
    rationale: [], mrvByMuscle: { chest: 60 },
    weeks: [{
      week: 1, phase: 'accumulation',
      sessions: [{
        character: 'памп',
        exercises: [1, 2].map(i => ({
          muscle: 'chest', name: `Сведение в кроссовере ${i}`, role: 'accessory', character: 'памп',
          sets: 3, repsRange: [12, 15], rir: 3,
          workSets: [{ reps: 15, rir: 3, weight: 20 }, { reps: 15, rir: 3, weight: 20 }, { reps: 15, rir: 3, weight: 20 }],
        })),
      }],
    }],
  });

  it('GVT: все сеты 10 повторов (было 12), 5+5, отдых 75с', () => {
    const plan = mkPlan();
    applyVolumeScheme(plan as any, 'gvt');
    const exs = plan.weeks[0].sessions[0].exercises;
    const marked = exs.filter((e: any) => String(e.comment).includes('GVT'));
    expect(marked.length).toBe(2);
    for (const e of marked) {
      expect(e.sets).toBe(5);
      expect(e.workSets.every((ws: any) => ws.reps === 10), `${e.name}`).toBe(true);
      expect(e.workSets.every((ws: any) => ws.restSeconds === 75)).toBe(true);
      expect(e.repsRange).toEqual([10, 10]);
    }
  });

  it('Gironda: 8×8 (было 10 повторов)', () => {
    const plan = mkPlan();
    applyVolumeScheme(plan as any, 'gironda');
    const marked = plan.weeks[0].sessions[0].exercises.filter((e: any) => String(e.comment).includes('8×8'));
    expect(marked.length).toBeGreaterThan(0);
    for (const e of marked) expect(e.workSets.every((ws: any) => ws.reps === 8)).toBe(true);
  });

  it('полный план с volumeScheme gvt: помеченные сеты ровно 10', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 4, workMax: WM, volumeScheme: 'gvt' } as any);
    let checked = 0;
    for (const w of plan.weeks as any[]) for (const s of w.sessions) for (const e of s.exercises) {
      if (!/GVT/.test(String((e as any).comment || ''))) continue;
      for (const ws of (e as any).workSets) { expect(ws.reps).toBe(10); checked++; }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('Волна-3.5 — единый BFR-протокол 30-15-15-15', () => {
  it('applyBfrPattern: 4 сета 30-15-15-15, 25% workMax, отдых 30с', () => {
    const ex: any = { name: 'Разгибания ног', sets: 3, workSets: [] };
    applyBfrPattern(ex, 100);
    expect(ex.sets).toBe(4);
    expect(ex.workSets.map((ws: any) => ws.reps)).toEqual([30, 15, 15, 15]);
    expect(ex.workSets.every((ws: any) => ws.weight === 25)).toBe(true);
    expect(ex.workSets.every((ws: any) => ws.restSeconds === 30)).toBe(true);
  });

  it('scheme=bfr применяет тот же протокол (не uniform 23)', () => {
    const plan: any = {
      rationale: [], mrvByMuscle: {},
      weeks: [{ week: 1, phase: 'accumulation', sessions: [{ character: 'памп', exercises: [{
        muscle: 'quads', name: 'Разгибания ног', role: 'accessory', character: 'памп', sets: 3,
        repsRange: [15, 20], rir: 3, workSets: [{ reps: 18, rir: 3, weight: 30 }, { reps: 18, rir: 3, weight: 30 }, { reps: 18, rir: 3, weight: 30 }],
      }] }] }],
    };
    const applied = applySchemeToPlan(plan, REP_SCHEMES.bfr, 'pump_accessory', {
      weightForRepMax: (reps: number, wm: number) => wm * 0.8, workMax: WM, defaultWorkMax: () => 50, intensityMult: 1, level: 'intermediate',
    });
    expect(applied).toBe(1);
    const ex = plan.weeks[0].sessions[0].exercises[0];
    expect(ex.workSets.map((ws: any) => ws.reps)).toEqual([30, 15, 15, 15]);
  });
});
