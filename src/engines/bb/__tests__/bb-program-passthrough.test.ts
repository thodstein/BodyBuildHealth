import { describe, expect, it } from 'vitest';
import { programToBBPlan, cycleTemplateToFullProgram } from '../cycle-to-plan';
import { getCyclesByDirection } from '../../../data/lms-cycles/lms-cycle-index';
import { isWeightReachable } from '../bb-plates.engine';

const WM = {
  chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7,
  glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7,
};

/** P0-11/12 (аудит 2026-09): program-путь — цикл из «ПРОФ-цикл» собирается,
 *  а платформенные опции (пластины/реабилитация/DC/wearable) реально доезжают. */
const bbCycleProgram = () => {
  const c = getCyclesByDirection('bodybuilding').find(x => !x.meta.id.startsWith('embed-'));
  expect(c).toBeDefined();
  return cycleTemplateToFullProgram(c!);
};

describe('P0-11 — BB-цикл как программа собирается в план', () => {
  it('цикл → FullProgram → валидный план с неделями и сессиями', () => {
    const plan = programToBBPlan(bbCycleProgram(), { workMax: WM, level: 'intermediate', mode: 'adapt' });
    expect(plan.weeks.length).toBeGreaterThan(0);
    expect(plan.weeks[0].sessions.length).toBeGreaterThan(0);
    expect(plan.weeks[0].sessions.some(s => s.exercises.length > 0)).toBe(true);
  });
});

describe('P0-12 — passthrough program-пути (паритет с generic)', () => {
  it('availablePlates: пост-округление доезжает (рационал + достижимость)', () => {
    const plates = [20, 10, 5, 2.5, 1.25];
    const plan = programToBBPlan(bbCycleProgram(), {
      workMax: WM, level: 'intermediate', mode: 'adapt', availablePlates: plates,
    });
    expect(plan.rationale.join(' ')).toMatch(/Пластины/);
    // Штанговые веса (≥ веса грифа) обязаны быть достижимы набором;
    // лёгкие гантели/блоки живут вне штанг-математики (target<0) — не проверяем.
    const barWeights = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
      .flatMap(e => (e.workSets || []).map(x => Number(x.weight))).filter(v => Number.isFinite(v) && v >= 20);
    expect(barWeights.length).toBeGreaterThan(0);
    const bad = barWeights.filter(v => !isWeightReachable(v, plates, 20));
    expect(bad, `недостижимые веса: ${bad.slice(0, 5).join(', ')}`).toHaveLength(0);
  });

  it('rehabMuscles: рампа возврата снижает объём мышцы на первой неделе', () => {
    const base = programToBBPlan(bbCycleProgram(), { workMax: WM, level: 'intermediate', mode: 'adapt' });
    const withRehab = programToBBPlan(bbCycleProgram(), {
      workMax: WM, level: 'intermediate', mode: 'adapt', rehabMuscles: ['chest'],
    });
    const chestSets = (p: typeof base) => p.weeks[0].sessions
      .flatMap(s => s.exercises).filter(e => e.muscle === 'chest')
      .reduce((a, e) => a + (e.sets || 0), 0);
    expect(chestSets(withRehab)).toBeLessThan(chestSets(base));
    expect(withRehab.rationale.join(' ')).toMatch(/Реабилитация|рампа|возврат/i);
  });

  it('dcMode: гейт уровня+дозы (750 мг/нед) — rationale честно сообщает о скипе/применении', () => {
    const pass = programToBBPlan(bbCycleProgram(), {
      workMax: WM, level: 'enhanced', trainingYears: 5, mode: 'adapt',
      peds: ['AAS'], pedDoses: { AAS: 750 }, dcMode: true,
    });
    expect(pass.rationale.join(' ')).toMatch(/DC-лайт: widowmaker/);
    const skip = programToBBPlan(bbCycleProgram(), {
      workMax: WM, level: 'intermediate', mode: 'adapt',
      peds: ['AAS'], pedDoses: { AAS: 750 }, dcMode: true,
    });
    expect(skip.rationale.join(' ')).toMatch(/DC-лайт пропущен/);
  });

  it('wearable: плохой HRV снижает recovery-вход (mrvMultiplier плана ниже)', () => {
    const clean = programToBBPlan(bbCycleProgram(), { workMax: WM, level: 'enhanced', trainingYears: 5, mode: 'adapt' });
    const tired = programToBBPlan(bbCycleProgram(), {
      workMax: WM, level: 'enhanced', trainingYears: 5, mode: 'adapt',
      wearable: { morningHRV: 25, sleepHours: 4.5 },
    });
    expect((tired as any).mrvMultiplier).toBeLessThan((clean as any).mrvMultiplier);
  });
});
