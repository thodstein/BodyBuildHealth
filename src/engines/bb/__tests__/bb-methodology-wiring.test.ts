/**
 * bb-methodology-wiring.test.ts — итерация A, главная проверка DoD:
 * «выбор методики меняет не только порядок, но и то, что она обещает».
 *
 * До этого файла `fst7` в селекторе методики давал памп-праймер и порядок, но
 * 7-сетовый финишер включался только отдельным селектором «схема объёма», а
 * `hyperemia` обещала короткие паузы и не меняла ни одной. Здесь проверяется
 * фактический эффект в собранном плане, а не наличие строки в спеке.
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { applyMethodologyRest } from '../bb-methodology-spec';

const WM = {
  chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7,
  glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7,
};

/** GH < 4 → joint-guard выключен, FST-7 7-in-1 проходит гейт. */
const plan = (methodology: any, opts: { gh?: number; volumeScheme?: any } = {}) => buildBBPlan({
  patternId: 'upper_lower_4',
  level: 'enhanced',
  trainingYears: 9,
  goal: 'mass',
  sex: 'male',
  weeks: 2,
  workMax: WM,
  peds: ['AAS', 'GH'],
  pedDoses: { AAS: 500, GH: opts.gh ?? 2 },
  courseIntensity: 'moderate',
  methodology,
  ...(opts.volumeScheme ? { volumeScheme: opts.volumeScheme } : {}),
} as any);

const exercisesOf = (p: any) =>
  (p?.weeks || []).flatMap((w: any) => (w.sessions || []).flatMap((s: any) => (s.exercises || []) as any[]));

describe('методика FST-7 включает схему объёма без отдельного выбора', () => {
  it('methodology=fst7 → plan.volumeScheme = fst7 и реальный 7-сетовый финишер', () => {
    const p: any = plan('fst7');
    expect(p.volumeScheme).toBe('fst7');
    expect(p.rationale.join('\n')).toMatch(/Методика FST-7 включает схему объёма FST-7/);
    const seven = exercisesOf(p).filter(ex => (ex.sets || 0) >= 7);
    // Регресс-защита: до фикса BFR-оверлей переписывал финишер на 4-5 сетов и
    // «FST-7» был NO-OP (17/17 финишеров урезаны при обещании 7× в комментарии).
    expect(seven.length).toBeGreaterThan(0);
    // Памп-схема не переписала reps финишера на BFR 30-15-15-15.
    for (const ex of seven) expect(Number(ex.repsRange?.[0]), `${ex.name}`).toBeGreaterThanOrEqual(8);
  });

  it('7-сетовый финишер не выводит мышцу за MRV (объём перераспределён, а не добавлен)', () => {
    const p: any = plan('fst7');
    const week = p.weeks[0];
    const direct: Record<string, number> = {};
    for (const s of week.sessions) for (const e of s.exercises) {
      if ((e as any).warmupActivator) continue;
      direct[e.muscle] = (direct[e.muscle] || 0) + (Number(e.sets) || 0);
    }
    const finishers = week.sessions.flatMap((s: any) => s.exercises).filter((e: any) => (e.sets || 0) >= 7);
    expect(finishers.length).toBeGreaterThan(0);
    for (const ex of finishers) {
      const mrv = Number(p.mrvByMuscle?.[ex.muscle]) || 0;
      if (mrv > 0) expect(direct[ex.muscle], ex.muscle).toBeLessThanOrEqual(Math.ceil(mrv * 1.15));
    }
  });

  it('гейт joint-guard честно даунгрейдит и объясняет причину', () => {
    const p: any = plan('fst7', { gh: 4 });
    expect(p.volumeScheme).toBe('standard');
    expect(p.rationale.join('\n')).toMatch(/FST-7/);
    expect(p.rationale.join('\n')).toMatch(/joint-guard/);
    // Обещания 7 сетов нет — и в плане их нет.
    expect(exercisesOf(p).filter(ex => (ex.sets || 0) >= 7)).toEqual([]);
  });

  it('явный выбор схемы gironda приоритетнее методики', () => {
    const p: any = plan('fst7', { volumeScheme: 'gironda' });
    expect(p.volumeScheme).toBe('gironda');
  });
});

describe('applyMethodologyRest: отдых как протокол методики', () => {
  it('hyperemia режет паузу аксессуара на 15 с', () => {
    expect(applyMethodologyRest(90, 'accessory', 'hyperemia')).toBe(75);
  });

  it('пол паузы соблюдён — ниже 45 с не опускаемся', () => {
    expect(applyMethodologyRest(50, 'accessory', 'hyperemia')).toBe(45);
    expect(applyMethodologyRest(40, 'accessory', 'hyperemia')).toBe(45);
  });

  it('базу (primary) не трогает — сила требует полного отдыха', () => {
    expect(applyMethodologyRest(120, 'primary', 'hyperemia')).toBe(120);
  });

  it('остальные методики отдых не меняют', () => {
    for (const m of ['compound_first', 'pre_exhaust', 'post_exhaust', 'mountain_dog', 'fst7']) {
      expect(applyMethodologyRest(75, 'accessory', m), m).toBe(75);
    }
  });
});
