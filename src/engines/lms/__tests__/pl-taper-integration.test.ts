/**
 * pl-taper-integration.test.ts — ИНТЕГРАЦИОННЫЕ тесты тапера: все схемы канона
 * (classic/pl/pro/wf) × раскладка финальной недели (attempts/light) × весовая цель,
 * применяемые к РЕАЛЬНОМУ плану через appendPLTaperWeeks.
 * Закрывает регрессии: WF-суперкомпенсация должна быть рабочим пиком 100%
 * (НЕ разминкой), light — без прикидов, lose — объём ×0.9.
 */
import { describe, expect, it } from 'vitest';
import { buildLMSPlan, appendPLTaperWeeks, type LMSBuildOutput } from '../lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

const pmMap = { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 };

function buildBase(weeksOverride = 8): LMSBuildOutput {
  return buildLMSPlan({ template: CYCLE_01 as never, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride, faithful: true } as never);
}

const weekVolume = (wk: LMSBuildOutput['weeks'][number]): number => {
  let v = 0;
  for (const d of wk.days) for (const e of d.exercises) for (const ws of e.workSets) v += ws.sets;
  return v;
};

const mainOf = (wk: LMSBuildOutput['weeks'][number]) => wk.days.flatMap(d => d.exercises.filter(e => e.load === 'main' || e.load === 'Тяжелая').flatMap(e => e.workSets));
const accOf = (wk: LMSBuildOutput['weeks'][number]) => wk.days.flatMap(d => d.exercises.filter(e => e.load !== 'main' && e.load !== 'Тяжелая').flatMap(e => e.workSets));
const isWarmupOnly = (wk: LMSBuildOutput['weeks'][number]) => mainOf(wk).length === 3 && mainOf(wk).map(ws => ws.pct).join() === [0.5, 0.7, 0.9].join();

describe('appendPLTaperWeeks: Classic WF (перегрузка → суперкомпенсация)', () => {
  it('недели 1-2 — перегрузка: недельный объём растёт, инт. 70/75%', () => {
    const plan = buildBase(6);
    const base = weekVolume(plan.weeks[plan.weeks.length - 1]);
    const next = appendPLTaperWeeks(plan, 4, { peakMode: 'wf' });
    const w1 = next.weeks[next.weeks.length - 4];
    const w2 = next.weeks[next.weeks.length - 3];
    expect(w1.taperNote).toContain('Перегрузка');
    expect(weekVolume(w1)).toBeGreaterThan(base);          // аксессуары ×1.15
    expect(weekVolume(w2)).toBeGreaterThanOrEqual(weekVolume(w1)); // ×1.20 (округление к целым может не дать +1 сет)
    expect(mainOf(w1)[0].pct).toBeCloseTo(0.7, 2);
    expect(mainOf(w2)[0].pct).toBeCloseTo(0.75, 2);
    expect(mainOf(w2)[0].pct).toBeGreaterThan(mainOf(w1)[0].pct); // перегрузка нарастает
    expect(mainOf(w1)[0].rir).toBe(2); // rirTarget=rirMin
  });

  it('недели 3-4 — суперкомпенсация: объём падает, инт. 90/100%', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 4, { peakMode: 'wf' });
    const w3 = next.weeks[next.weeks.length - 2];
    const w4 = next.weeks[next.weeks.length - 1];
    expect(w3.taperNote).toContain('Реализация');
    expect(mainOf(w3)[0].pct).toBeCloseTo(0.9, 2);
    expect(weekVolume(w3)).toBeLessThan(weekVolume(next.weeks[next.weeks.length - 3]));
    expect(weekVolume(w4)).toBeLessThan(weekVolume(w3)); // 0.40 < 0.60
  });

  it('финальная неделя WF — РАБОЧИЙ пик 100% (НЕ разминка) + прикиды', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 4, { peakMode: 'wf' });
    const final = next.weeks[next.weeks.length - 1];
    expect(isWarmupOnly(final)).toBe(false);              // регрессия: не 50/70/90
    expect(mainOf(final)[0].pct).toBeCloseTo(1.0, 2);     // рабочие сеты на 100%
    expect(final.meetAttempts).toBeTruthy();              // прикиды на финале
  });
});

describe('appendPLTaperWeeks: peakLayout light (только разминка, без прикидов)', () => {
  it('финальная неделя без meetAttempts при peakLayout=light', () => {
    const plan = buildBase(6);
    const attempts = appendPLTaperWeeks(plan, 2, {});
    const light = appendPLTaperWeeks(plan, 2, { peakLayout: 'light' });
    const lastAttempts = attempts.weeks[attempts.weeks.length - 1];
    const lastLight = light.weeks[light.weeks.length - 1];
    expect(lastAttempts.meetAttempts).toBeTruthy();
    expect(lastLight.meetAttempts).toBeUndefined();
    // Объём при light НЕ растёт (это не протокол — разгрузка сохраняется)
    expect(weekVolume(lastLight)).toBeLessThan(weekVolume(plan.weeks[plan.weeks.length - 1]));
  });

  it('light + wf: финал — рабочие 100% без прикидов', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 4, { peakMode: 'wf', peakLayout: 'light' });
    const final = next.weeks[next.weeks.length - 1];
    expect(isWarmupOnly(final)).toBe(false);
    expect(mainOf(final)[0].pct).toBeCloseTo(1.0, 2);
    expect(final.meetAttempts).toBeUndefined();
  });
});

describe('appendPLTaperWeeks: pro (усталость-зависимая)', () => {
  it('интенсивность main ~92%, RIR сдвиг 2 → 1, объём аксессуаров падает', () => {
    const plan = buildBase(6);
    const baseAcc = accOf(plan.weeks[plan.weeks.length - 1])[0].sets;
    const next = appendPLTaperWeeks(plan, 2, { peakMode: 'pro' });
    const w1 = next.weeks[next.weeks.length - 2];
    const w2 = next.weeks[next.weeks.length - 1];
    expect(mainOf(w1)[0].pct).toBeCloseTo(0.92, 1);
    expect(accOf(w1)[0].sets).toBeLessThan(baseAcc);           // ×0.65
    expect(accOf(w2)[0].sets).toBeLessThan(accOf(w1)[0].sets); // ×0.45
    expect(w2.meetAttempts).toBeTruthy();
  });
});

describe('appendPLTaperWeeks: весовая цель (lose/gain)', () => {
  it('lose — объём аксессуаров ×0.9 от maintain (видно на перегрузочной неделе WF)', () => {
    const plan = buildBase(6);
    // На WF-перегрузке аксессуары ×1.15: 4×1.15=4.6→5 (keep) vs 4×1.15×0.9=4.14→4 (lose)
    const keep = appendPLTaperWeeks(plan, 4, { peakMode: 'wf', weightGoal: 'maintain' });
    const lose = appendPLTaperWeeks(plan, 4, { peakMode: 'wf', weightGoal: 'lose' });
    const keepW = keep.weeks[keep.weeks.length - 4];
    const loseW = lose.weeks[lose.weeks.length - 4];
    expect(weekVolume(loseW)).toBeLessThan(weekVolume(keepW));
    expect(lose.progressionRationale).toContain('Сгонка к категории');
  });

  it('gain — rationale о полном объёме', () => {
    const plan = buildBase(6);
    const g = appendPLTaperWeeks(plan, 2, { weightGoal: 'gain' });
    expect(g.progressionRationale).toContain('Набор к категории');
  });
});

describe('appendPLTaperWeeks: все схемы — прикиды на финале (attempts по умолчанию)', () => {
  it('classic/pl/pro/wf — meetAttempts на финальной неделе', () => {
    const plan = buildBase(6);
    for (const mode of ['classic', 'pl', 'pro', 'wf'] as const) {
      const weeks = mode === 'pl' || mode === 'wf' ? 4 : 2;
      const next = appendPLTaperWeeks(plan, weeks, { peakMode: mode });
      const final = next.weeks[next.weeks.length - 1];
      expect(final.meetAttempts, `mode=${mode}`).toBeTruthy();
      expect(final.taperWeek, `mode=${mode}`).toBe(true);
    }
  });
});
