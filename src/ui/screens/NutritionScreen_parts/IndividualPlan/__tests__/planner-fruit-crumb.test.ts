/**
 * planner-fruit-crumb.test.ts — §8.74: огрызок — не порция.
 *
 * Дефект (замер 60 дней): 37 приёмов, где «фрукт» меньше 40 г — «яблоко 20 г»,
 * «хурма 19 г», «малина 19 г». Это остаток добивки, а не еда: в тарелке висит
 * огрызок, который пользователь либо выбрасывает, либо не замечает.
 *
 * Фикс: крошка фрукта (<40 г, категория `veg_fruit`, без «фруктовых» гороха/кукурузы)
 * убирается из тарелки. Гейт на приём: канон дня не хуже и не выходит из 3%, белок дня
 * не уезжает, качество не ниже, вёдер не больше; иначе откат.
 *
 * Отклонено замером: компенсация крошки плотным гарниром на те же углеводы — фрукт несёт
 * воду и клетчатку, рис даёт втрое больше ккал (`mid75/6/тр`: 2433 → 2451 ккал, канон
 * 1.9 → 2.8%). Огрызок просто убирается.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';
import { FOOD_DB } from '../../../../../core/nutrition-database';

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
const MIN_FRUIT = 40;

const build = (p: P, mc: number, tr: boolean, on: boolean) => buildDayPlan({
  weightKg: p[1], lbmKg: p[2], bodyFatPct: 18, sex: p[3],
  goalKcal: p[4], goalProteinG: p[5], goalFatG: p[6], goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  // §8.78 (плотный овощ вместо объёма) выключается в обоих вариантах: иначе A/B
  // перестаёт быть сравнением одной стадии (микро меняются до её гейтов).
  vegDensity78: false,
  fruitCrumb74: on,
  // §8.75 (семя вместо масла) выключается в обоих вариантах: она ужимает масло в приёме,
  // а этот замок проверяет «прочие граммы не тронуты».
  seedSwap75: false,
} as any) as any;

const solidG = (m: any) => ((m.items || []) as any[])
  .filter((i: any) => !['liquid', 'supplement'].includes(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
const buckets = (plan: any) => (plan.meals || []).filter((m: any) => (m.items || []).length > 0 && solidG(m) > 500).length;
const isFruit = (x: any) => {
  if (String(x?.role) !== 'fruit') return false;
  const fd: any = FOOD_DB.find((f: any) => String(f.id) === String(x.id));
  if (!fd || String(fd.category) !== 'veg_fruit') return false;
  return !/pea|lentil|bean|chickpea|corn|maize|soy|edamame/i.test(String(x.id));
};
const crumbItems = (plan: any) => (plan.meals || []).flatMap((m: any) => (m.items || []))
  .filter((i: any) => isFruit(i) && (Number(i.amount) || 0) > 0 && (Number(i.amount) || 0) < MIN_FRUIT);
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
  key: `${p[0]}/${mc}/${tr ? 'тр' : 'отд'}`, p, on: build(p, mc, tr, true), off: build(p, mc, tr, false),
}))));
const NOTE = '🍓 Огрызок — не порция:';

describe('§8.74 огрызок — не порция', () => {
  it('матрица покрывает 60 дней', () => {
    expect(DAYS).toHaveLength(60);
  });

  it('ни один день не теряет балл, не выходит из канона, вёдер не больше', () => {
    const worse: string[] = [];
    const outOfCanon: string[] = [];
    for (const d of DAYS) {
      const qa = Number(d.on.qualityScore?.total) || 0;
      const qb = Number(d.off.qualityScore?.total) || 0;
      if (qa < qb) worse.push(`${d.key}: ${qb} → ${qa}`);
      if (devOf(d.on, d.p) > Math.max(devOf(d.off, d.p), 0.03) + 1e-9) {
        outOfCanon.push(`${d.key}: ${(devOf(d.off, d.p) * 100).toFixed(1)}% → ${(devOf(d.on, d.p) * 100).toFixed(1)}%`);
      }
    }
    expect(worse.join(', ')).toBe('');
    expect(outOfCanon.join(', ')).toBe('');
    const wOn = DAYS.reduce((s, d) => s + buckets(d.on), 0);
    const wOff = DAYS.reduce((s, d) => s + buckets(d.off), 0);
    expect(wOn).toBeLessThanOrEqual(wOff);
  });

  it('огрызков строго меньше и новых не появляется', () => {
    const crOn = DAYS.reduce((s, d) => s + crumbItems(d.on).length, 0);
    const crOff = DAYS.reduce((s, d) => s + crumbItems(d.off).length, 0);
    expect(crOn).toBeLessThan(crOff); // замер: 37 → 13
    const grew: string[] = [];
    DAYS.forEach((d) => {
      if (crumbItems(d.on).length > crumbItems(d.off).length) grew.push(d.key);
    });
    expect(grew.join(', ')).toBe('');
  });

  it('меняется только состав: убранные позиции — крошки фрукта, прочие граммы те же', () => {
    const bad: string[] = [];
    let removed = 0;
    for (const d of DAYS) {
      (d.on.meals || []).forEach((onM: any, idx: number) => {
        const offM = (d.off.meals || [])[idx];
        if (!offM) return;
        const onById = new Map<string, any>((onM.items || []).map((i: any) => [String(i.id), i]));
        for (const offIt of (offM.items || [])) {
          const onIt = onById.get(String(offIt.id));
          if (!onIt) {
            removed++;
            const okCrumb = isFruit(offIt) && (Number(offIt.amount) || 0) > 0 && (Number(offIt.amount) || 0) < MIN_FRUIT;
            if (!okCrumb) bad.push(`${d.key} ${onM.type}: убрано не-крошка ${offIt.id} ${offIt.amount} г`);
            continue;
          }
          if (Math.round(Number(onIt.amount) || 0) !== Math.round(Number(offIt.amount) || 0)) {
            bad.push(`${d.key} ${onM.type} ${offIt.id}: ${offIt.amount} → ${onIt.amount}`);
          }
        }
        for (const onIt of (onM.items || [])) {
          if (!(offM.items || []).some((i: any) => String(i.id) === String(onIt.id))) {
            bad.push(`${d.key} ${onM.type}: появилось ${onIt.id} ${onIt.amount} г`);
          }
        }
      });
    }
    expect(bad.join(', ')).toBe('');
    expect(removed).toBeGreaterThanOrEqual(10);
  });

  it('белок дня не уезжает от чистки', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const dp = Math.abs(Number(d.on.totals?.p) - Number(d.off.totals?.p));
      if (dp > 1) bad.push(`${d.key}: Δбелка ${dp.toFixed(2)} г`);
    }
    expect(bad.join(', ')).toBe('');
  });

  it('стадия объясняется нотой, выключенный флаг = прежний план', () => {
    let fired = 0;
    for (const d of DAYS) {
      const notesOn = ((d.on.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      const notesOff = ((d.off.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      expect(notesOff).toHaveLength(0);
      const cleaned = crumbItems(d.on).length < crumbItems(d.off).length;
      if (notesOn.length > 0) {
        fired++;
        expect(cleaned).toBe(true);
        expect(notesOn[0]).toMatch(/крошка фрукта меньше 40 г убрана/);
      }
    }
    expect(fired).toBeGreaterThanOrEqual(5);
  });
});
