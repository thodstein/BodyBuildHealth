import { describe, expect, it } from 'vitest';
import { applyTaperToFinalWeeks, type BBPlan } from '../bb-autocoach.engine';
import { buildBBPlan } from '../bb-builder.engine';

/**
 * Волна 0, п. 0.5 — идемпотентность авто-тейпера финализатора.
 *
 * Дефект (аудит): applyTaperToFinalWeeks пересчитывал taper-окно по объёму и
 * накладывал кривую ПОВЕРХ себя при повторной финализации (revalidate после
 * ручных правок в «Коррекции»): W(n-2) ×0.75×0.75, W(n-1) ×0.50×0.50 —
 * суммарно −8.13% объёма за 3 прогона.
 *
 * Фикс: структурный флаг week.taperApplied — помеченные недели пропускаются.
 */
const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

const totals = (p: BBPlan): number[] => p.weeks.map(w => w.sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + (e.sets || 0), 0), 0));

describe('BB taper: идемпотентность applyTaperToFinalWeeks (Волна 0, п.0.5)', () => {
  it('повторный вызов не режет taper-недели второй раз (байт-в-байт по сетам)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 8, workMax: WM });
    const once = applyTaperToFinalWeeks(plan, plan.weeks.length);
    const twice = applyTaperToFinalWeeks(once, once.weeks.length);
    expect(totals(twice)).toEqual(totals(once));
    // И недели-тейпера реально помечены структурным флагом.
    const tapered = once.weeks.filter(w => (w as any).taperApplied === true);
    expect(tapered.length).toBeGreaterThan(0);
  });

  it('taper-неделя без флага (legacy-план из storage) режется ровно один раз', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 6, workMax: WM });
    // Легаси-имитация: флаг снят со всех недель (план из старого storage).
    for (const w of plan.weeks) delete (w as any).taperApplied;
    const once = applyTaperToFinalWeeks(plan, plan.weeks.length);
    const twice = applyTaperToFinalWeeks(once, once.weeks.length);
    expect(totals(twice)).toEqual(totals(once));
  });

  it('source-guard: taper-пасс читает taperApplied (защита от удаления гарда)', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('src/engines/bb/bb-autocoach.engine.ts', 'utf8');
    expect(src).toMatch(/taperApplied/);
    const body = src.slice(src.indexOf('export function applyTaperToFinalWeeks'));
    expect(body).toMatch(/taperApplied === true/);
  });
});
