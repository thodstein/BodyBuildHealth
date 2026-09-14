import { describe, expect, it } from 'vitest';
import { programToBBPlan, cycleTemplateToFullProgram } from '../cycle-to-plan';
import { getCyclesByDirection } from '../../../data/lms-cycles/lms-cycle-index';
import { validateBBPlan } from '../bb-validator.engine';

/**
 * 3.8 (план BB-AUTO-EXHAUSTIVE-PRO): аудит библиотеки BB-циклов по РЕАЛЬНОМУ UI-пути
 * «📋 ПРОФ-цикл» → cycleTemplateToFullProgram → programToBBPlan (adapt/faithful).
 * Инварианты: уникальные id, каждый цикл собирается, 0 error-уровня валидатора,
 * фазы на всех неделях, sets === workSets.length, делоад-недели снижены.
 */

const WM = {
  chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7,
  glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7,
};

const cycles = getCyclesByDirection('bodybuilding').filter(c => !c.meta.id.startsWith('embed-'));

const _cache = new Map<string, ReturnType<typeof programToBBPlan>>();
function build(id: string, mode: 'adapt' | 'faithful') {
  const key = `${id}/${mode}`;
  if (!_cache.has(key)) {
    const c = cycles.find(x => x.meta.id === id);
    if (!c) throw new Error(`cycle not found: ${id}`);
    const prog = cycleTemplateToFullProgram(c);
    _cache.set(key, programToBBPlan(prog, { workMax: WM, level: 'intermediate', mode }));
  }
  return _cache.get(key)!;
}

const weekSets = (w: any) => w.sessions.reduce((s: number, ss: any) => s + ss.exercises.reduce((x: number, e: any) => x + (e.sets || 0), 0), 0);

describe('3.8 — библиотека BB-циклов (UI-путь ПРОФ-цикл → programToBBPlan)', () => {
  it('уникальные id, список ≥35, без embed-*', () => {
    const ids = cycles.map(c => c.meta.id);
    expect(ids.length).toBeGreaterThanOrEqual(35);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => !id.startsWith('embed-'))).toBe(true);
  });

  it('каждый цикл конвертируется и собирается (adapt) без error-уровня валидатора', () => {
    for (const c of cycles) {
      const prog = cycleTemplateToFullProgram(c);
      expect(prog, c.meta.id).toBeTruthy();
      expect(prog.weeks.length, c.meta.id).toBeGreaterThan(0);
      const plan = build(c.meta.id, 'adapt');
      const r = validateBBPlan(plan as any, { level: 'intermediate' });
      expect(
        r.issues.filter((i: any) => i.level === 'error').map((i: any) => i.message),
        c.meta.id,
      ).toHaveLength(0);
    }
  }, 120000);

  it('faithful-режим собирается без error-уровня для каждого цикла', () => {
    for (const c of cycles) {
      const plan = build(c.meta.id, 'faithful');
      const r = validateBBPlan(plan as any, { level: 'intermediate' });
      expect(
        r.issues.filter((i: any) => i.level === 'error').map((i: any) => i.message),
        `${c.meta.id} (faithful)`,
      ).toHaveLength(0);
    }
  }, 120000);

  it('фазы заполнены, sets === workSets.length', () => {
    for (const c of cycles) {
      const plan = build(c.meta.id, 'adapt');
      for (const w of plan.weeks as any[]) {
        expect(String(w.phase || ''), `${c.meta.id} W${w.week}`).not.toBe('');
        for (const s of w.sessions) {
          for (const e of s.exercises) {
            const wsLen = (e.workSets || []).length;
            expect(Math.abs((e.sets || 0) - wsLen), `${c.meta.id} W${w.week} ${e.name}`).toBeLessThanOrEqual(0.01);
          }
        }
      }
    }
  }, 120000);

  it('делод-недели: объём ≤ предыдущей недели (или pump-семантика)', () => {
    for (const c of cycles) {
      const plan = build(c.meta.id, 'adapt');
      const weeks = plan.weeks as any[];
      for (let i = 1; i < weeks.length; i++) {
        const w = weeks[i];
        if (w.phase !== 'deload' && w.deload !== true) continue;
        const sets = weekSets(w);
        const prevSets = weekSets(weeks[i - 1]);
        const meanWeight = (ww: any) => {
          const xs = ww.sessions.flatMap((ss: any) => ss.exercises.flatMap((e: any) => (e.workSets || []).map((x: any) => x.weight || 0))).filter((x: number) => x > 0);
          return xs.length ? xs.reduce((a: number, b: number) => a + b, 0) / xs.length : 0;
        };
        const minRir = Math.min(...w.sessions.flatMap((ss: any) => ss.exercises.map((e: any) => e.rir)).filter((x: any) => Number.isFinite(x)));
        const pumpDeload = meanWeight(w) > 0 && meanWeight(w) <= meanWeight(weeks[i - 1]) * 0.8 && minRir >= 3;
        expect(sets <= Math.ceil(prevSets * 0.75) || pumpDeload, `${c.meta.id} W${w.week}: ${sets} vs ${prevSets}`).toBe(true);
      }
    }
  }, 120000);
});
