import { describe, expect, it } from 'vitest';
import { generateBBRecommendations, planWeeklySets, weeklySetsByMuscle, bbRecSummary } from '../bb-training-recommendations.engine';

const PLAN = {
  pattern: { name: 'PPL 6×/нед' },
  weeks: [
    { phase: 'accumulation', sessions: [
      { day: 1, exercises: [{ name: 'Жим лёжа', muscle: 'chest', sets: 4 }, { name: 'Разведения', muscle: 'chest', sets: 3 }] },
      { day: 2, exercises: [{ name: 'Тяга', muscle: 'back', sets: 5 }] },
      { day: 3, exercises: [{ name: 'Присед', muscle: 'quads', sets: 4 }] },
    ] },
    { phase: 'intensification', sessions: [{ day: 1, exercises: [{ name: 'Жим лёжа', muscle: 'chest', sets: 4 }] }] },
  ],
  pedAdaptation: { combinedMrvMultiplier: 1.45, combinedRecoveryMultiplier: 1.4, activePEDs: ['AAS'], pedDoses: { AAS: 750 }, risks: ['ААС: контроль гематокрита.'] },
  rationale: [],
};

const BASE: Parameters<typeof generateBBRecommendations>[0] = {
  plan: PLAN as any,
  params: { level: 'enhanced', goal: 'mass', weeks: 8, peds: ['AAS'], pedDoses: { AAS: 750 }, courseIntensity: 'moderate', focusGroup: 'back' },
  profile: { weightKg: 80, proteinPerKg: 1.4 },
  nutrition: { avgKcal: 2200, avgProtein: 110, avgCarbs: 200, days: 7 },
  supportSubs: [],
  acwr: 1.2,
  lastSleepHours: 7,
};

describe('BB training recommendations', () => {
  it('секции: программа, фарма, питание, добавки, выполнение', () => {
    const sections = generateBBRecommendations(BASE);
    const ids = sections.map(s => s.id);
    expect(ids).toContain('program');
    expect(ids).toContain('ped');
    expect(ids).toContain('nutrition');
    expect(ids).toContain('supplements');
    expect(ids).toContain('execution');
    expect(sections.flatMap(s => s.items).length).toBeGreaterThan(0);
  });

  it('программа: сводка сплита, фаза и акцент', () => {
    const sections = generateBBRecommendations({ ...BASE, currentWeek: 1 });
    const prog = sections.find(s => s.id === 'program')!;
    expect(prog.items.some(i => i.text.includes('PPL 6×/нед'))).toBe(true);
    expect(prog.items.some(i => i.text.includes('накопление'))).toBe(true);
    expect(prog.items.some(i => i.text.includes('спина'))).toBe(true);
  });

  it('делод-фаза на текущей неделе даёт специфичную рекомендацию', () => {
    const plan = JSON.parse(JSON.stringify(PLAN));
    plan.weeks[1].phase = 'deload';
    const sections = generateBBRecommendations({ ...BASE, plan, currentWeek: 2 });
    const prog = sections.find(s => s.id === 'program')!;
    expect(prog.items.some(i => i.text.includes('разгрузка'))).toBe(true);
  });

  it('PED: кап-предупреждение при дозе выше порога', () => {
    const sections = generateBBRecommendations({ ...BASE, params: { ...BASE.params, peds: ['IGF1'], pedDoses: { IGF1: 150 } } });
    const ped = sections.find(s => s.id === 'ped')!;
    expect(ped.items.some(i => i.text.includes('выше капа'))).toBe(true);
  });

  it('PED: предупреждение о сухожилиях при MRV ≥1.3; инсулин → углеводы пери-WO', () => {
    const pedSections = generateBBRecommendations({ ...BASE, params: { ...BASE.params, peds: ['AAS', 'insulin'], pedDoses: { AAS: 750, insulin: 10 } } });
    const ped = pedSections.find(s => s.id === 'ped')!;
    expect(ped.items.some(i => i.text.includes('Сухожилия'))).toBe(true);
    expect(ped.items.some(i => i.text.includes('углеводов вокруг тренировки'))).toBe(true);
  });

  it('питание: низкий белок и калораж для массы дают warn', () => {
    const sections = generateBBRecommendations(BASE);
    const nutrition = sections.find(s => s.id === 'nutrition')!;
    expect(nutrition.items.some(i => i.text.includes('Белок 1.4 г/кг ниже'))).toBe(true);
    expect(nutrition.items.some(i => i.text.includes('набора массы'))).toBe(true);
  });

  it('сушка: калораж >27 ккал/кг → warn', () => {
    const sections = generateBBRecommendations({ ...BASE, params: { ...BASE.params, goal: 'cut' }, nutrition: { avgKcal: 2600, avgProtein: 170, avgCarbs: 250, days: 7 } });
    const nutrition = sections.find(s => s.id === 'nutrition')!;
    expect(nutrition.items.some(i => i.text.includes('сушитесь'))).toBe(true);
  });

  it('добавки: курс без гепатопротектора → NAC/TUDCA; высокий MRV без суставной → коллаген', () => {
    const sections = generateBBRecommendations(BASE);
    const supp = sections.find(s => s.id === 'supplements')!;
    expect(supp.items.some(i => i.text.includes('NAC 600-1200 мг'))).toBe(true);
    expect(supp.items.some(i => i.text.includes('коллаген'))).toBe(true);
  });

  it('добавки: при наличии NAC и коллагена предупреждения не дублируются', () => {
    const sections = generateBBRecommendations({ ...BASE, supportSubs: ['NAC', 'collagen'] });
    const supp = sections.find(s => s.id === 'supplements')!;
    expect(supp.items.some(i => i.text.includes('NAC 600-1200 мг'))).toBe(false);
    expect(supp.items.some(i => i.text.includes('коллаген 10-15 г'))).toBe(false);
  });

  it('выполнение: RIR слишком низкий (<0.5) → warn; ACWR >1.5 → critical', () => {
    const sections = generateBBRecommendations({ ...BASE, acwr: 1.7, historyWorkouts: [{ date: new Date().toISOString().slice(0, 10), exercises: [{ name: 'Жим лёжа', sets: [{ rir: 0 }, { rir: 0 }] }] }] as any });
    const exec = sections.find(s => s.id === 'execution')!;
    expect(exec.items.some(i => i.text.includes('в отказ'))).toBe(true);
    expect(exec.items.some(i => i.severity === 'critical')).toBe(true);
  });

  it('сон <6 ч → предупреждение', () => {
    const sections = generateBBRecommendations({ ...BASE, lastSleepHours: 5 });
    const exec = sections.find(s => s.id === 'execution')!;
    expect(exec.items.some(i => i.text.includes('Сон 5 ч'))).toBe(true);
  });

  it('без плана: рекомендация построить план', () => {
    const sections = generateBBRecommendations({ ...BASE, plan: undefined, params: undefined });
    const prog = sections.find(s => s.id === 'program')!;
    expect(prog.items.some(i => i.text.includes('постройте план'))).toBe(true);
  });

  it('planWeeklySets считает рабочие сеты без warmup', () => {
    const plan = { weeks: [{ sessions: [{ exercises: [{ sets: 4 }, { sets: 3, warmupActivator: true }] }] }] };
    expect(planWeeklySets(plan)).toBe(4);
  });

  it('weeklySetsByMuscle агрегирует по группам из каталога', () => {
    const workouts = [{ date: new Date().toISOString().slice(0, 10), exercises: [{ exerciseId: 'bench_bar', sets: [{}, {}, {}] }] }] as any;
    const wsg = weeklySetsByMuscle(workouts, 1);
    const last = Object.values(wsg).map(arr => arr[0] || 0).reduce((a, b) => a + b, 0);
    expect(last).toBeGreaterThan(0);
  });

  it('bbRecSummary считает warn/critical', () => {
    const sections = generateBBRecommendations({ ...BASE, acwr: 1.7 });
    const s = bbRecSummary(sections);
    expect(s.total).toBe(sections.flatMap(x => x.items).length);
    expect(s.criticals).toBeGreaterThanOrEqual(1);
  });
});
