/**
 * planner-hv-meal-count.test.ts — §8.79: контракт белка HV-дня упирается в число приёмов.
 *
 * Дефект (счёт 60 дней, до стадии): на HV/болюс-дне движок открывал 10 основных приёмов
 * (3 основных + 6 перекусов + предсон) плюс пери-окна. Полы уже съедают 3×0.30 г/кг (у 110 кг
 * это 99 г) + предсон (44) + два окна (~59) = 202 г из 300, на шесть перекусов остаётся ~16 г.
 * Порог бейджа `pd` там 21 г — и «Б 15/21» горит на каждом втором перекусе, хотя день собран
 * верно: замер показывал 3–5 бейджей на дне.
 *
 * Правило: если день HV (≥4200 ккал или ≥1100 г углеводов), основных приёмов не больше 9 —
 * 202 + 5×20 ≈ 300 г, то есть каждый перекус снова может дотянуть до контракта.
 *
 * Замер 60 дней: бейджи 49 → 31, оценка 92.617 → 93.150 (0 дней хуже, 8 лучше), вёдра 88 → 90,
 * максимальная тарелка 887 → 887 г, канон >3% 3 → 3 (hugeCarb/4|5/тр попутно 5.2% → 3.6%).
 *
 * Отклонено замером: кап 6 приёмов на отдыхе — оценка 93.6 и 17 бейджей, но канон c1500/отд
 * 1.2% → 17.3%: 1500 г углеводов в пять приёмов физически не влезают.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';

const PROFILES: Array<[string, number, number, 'male' | 'female', number, number, number, number]> = [
  ['p500', 110, 90, 'male', 4600, 500, 120, 0],
  ['c1500', 110, 90, 'male', 8370, 300, 130, 1500],
  ['hugeCarb', 100, 82, 'male', 6700, 250, 100, 0],
  ['mass110', 110, 90, 'male', 5200, 260, 120, 0],
  ['normal90', 90, 73, 'male', 3000, 200, 80, 0],
  ['mid75', 75, 61, 'male', 2400, 180, 70, 0],
  ['small60', 60, 49, 'female', 1600, 150, 45, 0],
  ['cutF50', 50, 41, 'female', 1240, 110, 40, 0],
  ['recomp80', 80, 65, 'male', 2200, 200, 60, 0],
  ['keto85', 85, 70, 'male', 2400, 180, 150, 0],
];
type P = (typeof PROFILES)[number];
const carbsFor = (p: P) => p[7] || Math.max(0, Math.round((p[4] - 4 * p[5] - 9 * p[6]) / 4));

const build = (p: P, mc: number, tr: boolean, on: boolean) => buildDayPlan({
  weightKg: p[1], lbmKg: p[2], bodyFatPct: 18, sex: p[3],
  goalKcal: p[4], goalProteinG: p[5], goalFatG: p[6], goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  ...(on ? {} : { hvMealCap79: false }),
} as any) as any;

const FIXED_TYPES = new Set(['preworkout', 'postworkout', 'intra', 'presleep']);
const regulars = (plan: any) => ((plan.meals || []) as any[]).filter((m) => !FIXED_TYPES.has(String(m.type)));
const isHvDay = (p: P) => p[4] >= 4200 || carbsFor(p) >= 1100;
const solidG = (m: any) => ((m.items || []) as any[])
  .filter((i: any) => !['liquid', 'supplement'].includes(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
const maxPlate = (plan: any) => Math.max(0, ...((plan.meals || []) as any[]).map((m) => solidG(m)));
const buckets = (plan: any) => ((plan.meals || []) as any[]).filter((m) => (m.items || []).length > 0 && solidG(m) > 500).length;
const badges = (plan: any) => ((plan.meals || []) as any[]).filter((m) => {
  const pd = Number(m.target?.pd);
  return pd > 0 && (Number(m.totals?.p) || 0) < pd - 3;
}).length;
const devOf = (plan: any, p: P) => {
  const c = carbsFor(p);
  const t = plan.totals || {};
  return Math.max(
    Math.abs(Number(t.kcal) - p[4]) / p[4],
    Math.abs(Number(t.p) - p[5]) / p[5],
    Math.abs(Number(t.f) - p[6]) / p[6],
    c > 0 ? Math.abs(Number(t.c) - c) / c : 0,
  );
};

const DAYS = PROFILES.flatMap((p) => [4, 5, 6].flatMap((mc) => [true, false].map((tr) => ({
  key: `${p[0]}/${mc}/${tr ? 'тр' : 'отд'}`, p, tr, hv: isHvDay(p),
  on: build(p, mc, tr, true), off: build(p, mc, tr, false),
}))));

describe('§8.79 HV-день: не больше девяти основных приёмов', () => {
  it('матрица покрывает 60 дней, HV-дни в ней есть', () => {
    expect(DAYS).toHaveLength(60);
    expect(DAYS.filter((d) => d.hv).length).toBeGreaterThanOrEqual(24);
  });

  it('HV-день не открывает больше 9 основных приёмов', () => {
    const bad: string[] = [];
    for (const d of DAYS.filter((x) => x.hv)) {
      const n = regulars(d.on).length;
      if (n > 9) bad.push(`${d.key}: ${n} основных приёмов`);
    }
    expect(bad.join(', ')).toBe('');
  });

  it('обычные дни не тронуты ни на грамм', () => {
    const bad: string[] = [];
    for (const d of DAYS.filter((x) => !x.hv)) {
      const on = ((d.on.meals || []) as any[]).map((m) => `${m.type}:${((m.items || []) as any[]).map((i: any) => `${i.id}${Math.round(Number(i.amount) || 0)}`).join('+')}`);
      const off = ((d.off.meals || []) as any[]).map((m) => `${m.type}:${((m.items || []) as any[]).map((i: any) => `${i.id}${Math.round(Number(i.amount) || 0)}`).join('+')}`);
      if (on.join('|') !== off.join('|')) bad.push(d.key);
    }
    expect(bad.join(', ')).toBe('');
  });

  it('ни один день не теряет балл и не ухудшает канон', () => {
    const worse: string[] = [];
    const canon: string[] = [];
    for (const d of DAYS) {
      const qa = Number(d.on.qualityScore?.total) || 0;
      const qb = Number(d.off.qualityScore?.total) || 0;
      if (qa < qb) worse.push(`${d.key}: ${qb} → ${qa}`);
      const devOn = devOf(d.on, d.p);
      const devOff = devOf(d.off, d.p);
      if (devOn > Math.max(devOff, 0.029) + 1e-9) {
        canon.push(`${d.key}: ${(devOff * 100).toFixed(1)}% → ${(devOn * 100).toFixed(1)}%`);
      }
    }
    expect(worse.join(', ')).toBe('');
    expect(canon.join(', ')).toBe('');
  });

  it('бейджей строго меньше, тарелки не выходят за прежний предел, вёдер незначительно больше (замер 49 → 31)', () => {
    const bOn = DAYS.reduce((s, d) => s + badges(d.on), 0);
    const bOff = DAYS.reduce((s, d) => s + badges(d.off), 0);
    expect(bOn).toBeLessThan(bOff);
    expect(bOff - bOn).toBeGreaterThanOrEqual(15);
    // Тарелка может стать крупнее (приёмы слились), но не крупнее худшей тарелки до стадии
    // (887 г) и не более чем на два «ведра» на день.
    const plates: string[] = [];
    for (const d of DAYS) {
      if (maxPlate(d.on) > 900) plates.push(`${d.key}: ${Math.round(maxPlate(d.on))} г`);
      if (buckets(d.on) > buckets(d.off) + 2) {
        plates.push(`${d.key}: вёдер ${buckets(d.off)} → ${buckets(d.on)}`);
      }
    }
    expect(plates.join(', ')).toBe('');
    const wOn = DAYS.reduce((s, d) => s + buckets(d.on), 0);
    const wOff = DAYS.reduce((s, d) => s + buckets(d.off), 0);
    expect(wOn).toBeLessThanOrEqual(wOff + 2);
  });

  it('срезка приёмов объясняется нотой и не молчит', () => {
    const bad: string[] = [];
    let noted = 0;
    for (const d of DAYS) {
      const cut = regulars(d.on).length < regulars(d.off).length;
      const notes = ((d.on.notes || []) as string[]).filter((n) => typeof n === 'string' && n.includes('§8.79'));
      if (cut) {
        noted++;
        if (notes.length === 0) bad.push(`${d.key}: приёмов ${regulars(d.off).length} → ${regulars(d.on).length}, ноты нет`);
      }
    }
    expect(bad.join(', ')).toBe('');
    expect(noted).toBeGreaterThanOrEqual(8);
  });
});
