/**
 * Аудит Sep 2026 «цель — качественный цикл»: честная НАГРУЗКА циклового UI-пути
 * (`cycleTemplateToFullProgram → programToBBPlan`).
 *
 * Найдено дампом всех 38 BB-циклов (male/female, intermediate):
 *
 * 1) **Мульти-спек источника терялся** — конвертер брал `sets: [{pct,reps,sets}, …]`
 *    только ПЕРВЫМ спеком: bench `[{0.4,12,1},{0.6,10,4}]` → 1-2 сета на 40%,
 *    а downstream `parseWorkSetSpecs` не находил % в notes → fallback PCT_FOR_RIR[rir]
 *    (мышечный, БЕЗ учёта повторов) → все упражнения мышцы получали одинаковый вес
 *    («разводка = жиму»; франц. жим 120-153% ПМ). Теперь схема `%×reps` едет в notes,
 *    сумма сетов сохраняется, каждый спек = свои work-сеты.
 *
 * 2) **Филлеры наследовали шаблон**: fill/баланс-спины/спец-частота делали
 *    `structuredClone(session.exercises[0])` → добор предплечий получал вес и
 *    инструкции приседа (153% ПМ, «Паттерн: приседательный паттерн»). Теперь
 *    вес считается от workMax СВОЕЙ мышцы, профиль строит enrich по своему имени.
 */
import { describe, expect, it } from 'vitest';
import { cycleTemplateToFullProgram, programToBBPlan } from '../cycle-to-plan';
import { getCycleById } from '../../../data/lms-cycles/lms-cycle-index';

const WM = { chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7, glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7 };
const buildProgram = (id: string) => {
  const c = getCycleById(id);
  expect(c, id).toBeTruthy();
  return cycleTemplateToFullProgram(c!);
};
const buildPlan = (id: string) => programToBBPlan(buildProgram(id), {
  workMax: WM, level: 'intermediate', trainingYears: 3, mode: 'adapt', sex: 'male', goal: 'mass',
} as any);
const topWeight = (e: any) => Math.max(0, ...(e.workSets || []).map((x: any) => Number(x.weight) || 0));

describe('качество цикла: мульти-спек источника сохраняется (конвертер)', () => {
  it('cycle-08: bench `[{40%×12×1},{60%×10×4}]` → 5 сетов и схема в notes', () => {
    const prog: any = buildProgram('cycle-08');
    const bench = prog.weeks[0].days.flatMap((d: any) => d.exercises).find((e: any) => /Жим лежа/i.test(e.name));
    expect(bench, 'bench в дне источника').toBeTruthy();
    expect(bench.sets).toBe(5); // 1 + 4 (раньше — 1)
    expect(bench.notes).toContain('40%×12');
    expect(bench.notes).toContain('60%×10');
  });

  it('cycle-08: рамп-сет легче рабочих (первый < последнего)', () => {
    const plan: any = buildPlan('cycle-08');
    const bench = plan.weeks[0].sessions.flatMap((s: any) => s.exercises).find((e: any) => /Жим штанги лёжа/i.test(e.name));
    expect(bench).toBeTruthy();
    const ws = bench.workSets || [];
    expect(ws.length).toBeGreaterThanOrEqual(2);
    expect(Number(ws[0].weight)).toBeLessThan(Number(ws[ws.length - 1].weight));
  });

  it('cycle-08: разводка НЕ равна жиму (вес от своего % ПМ, не мышечный fallback)', () => {
    const plan: any = buildPlan('cycle-08');
    const all = plan.weeks[0].sessions.flatMap((s: any) => s.exercises);
    const bench = all.find((e: any) => /Жим штанги лёжа/i.test(e.name));
    const fly = all.find((e: any) => /Разводка|Кроссовер|Сведение/i.test(e.name));
    expect(bench && fly).toBeTruthy();
    expect(topWeight(fly)).toBeLessThan(topWeight(bench) * 0.7);
  });
});

describe('качество цикла: филлеры не наследуют чужой вес/профиль', () => {
  it('cycle-bb-05: ни одно упражнение не превышает ~1.2× workMax своей мышцы', () => {
    const plan: any = buildPlan('cycle-bb-05');
    const bad: string[] = [];
    for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
      if ((e as any).warmupActivator) continue;
      const wm = WM[e.muscle as keyof typeof WM];
      if (!wm) continue;
      const t = topWeight(e);
      if (t > wm * 1.2 + 0.01) bad.push(`W${w.week} ${e.name} (${e.muscle}): ${t} > ${Math.round(wm * 1.2)}`);
    }
    expect(bad).toEqual([]);
  });

  it('cycle-bb-05: предплечья — вес от workMax предплечий (было 153% = вес приседа)', () => {
    const plan: any = buildPlan('cycle-bb-05');
    const wrists = plan.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises)
      .filter((e: any) => /запяст|wrist/i.test(e.name || ''));
    expect(wrists.length).toBeGreaterThan(0);
    for (const e of wrists) expect(topWeight(e), e.name).toBeLessThanOrEqual(WM.forearms * 0.6);
  });

  it('cycle-bb-05: инструкции филлера — по СВОЕМУ движению (не «приседательный паттерн»)', () => {
    const plan: any = buildPlan('cycle-bb-05');
    const wrists = plan.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises)
      .filter((e: any) => /запяст|wrist/i.test(e.name || ''));
    for (const e of wrists) {
      const comment = String(e.comment || '');
      expect(comment).not.toMatch(/приседательн/i);
      expect(comment).toMatch(/предплеч|wrist|запяст|accessory/i);
    }
  });
});
