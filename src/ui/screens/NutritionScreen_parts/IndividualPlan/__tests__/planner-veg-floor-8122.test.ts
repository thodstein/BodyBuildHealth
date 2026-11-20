import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { MIN_MEANINGFUL_G } from '../planner-quality-score';
import { isHerbSpiceId, isProteinPowderId, isPureSupplementId, isSauceCondimentFood } from '../food-availability';
import { FOOD_DB } from '../../../../../core/nutrition-database';

/**
 * §8.122 «овощ не спорит с контрактом дня» (замок).
 *
 * Дефект (замер сетки 160 дней = 10 профилей × 3–6 приёмов × трен/отдых × авто/ручной,
 * 80 дней на каждый путь, БЕЗ добора, микро-посыпка овощем не считается): овощей <200 г —
 * **41 день на ручном пути** (из них 9 — совсем без овоща) и 10 на авто; один вид овоща —
 * 38 на ручном и 6 на авто.
 *
 * Причины (разбор по коду и пробам, не догадка):
 *  • весь добор жил под `if (_relab88.length > 0)` — день, в котором §8.88 нечего
 *    переименовывать, овоща не получал вовсе (на ручном пути пакет качества QG5 не
 *    применяется: `_qgGated` — ручные цели авторитетны);
 *  • «почти пол» 191–198 г: рост на последние 5–9 г блокировался порогом «не меньше +10 г»;
 *  • тарелка: приёмы приходят в финал уже с 660–700 г твёрдого — комнаты на 150–200 г нет;
 *  • остальное — физика дня (кетоз 150 г жира; кат 1240 ккал: 200 г овоща — 5 % белка дня).
 *
 * Правило. Пол 200 г и два вида (QG10) — часть продукта, но добор в финале бьётся с
 * ремонтными стадиями (§8.111–§8.114b): добавленный овощ отнимал у дня комнату, и whey
 * в перекусе становился обрезком (`45/4/R/cut/manual`, 15 г), а тарелка без учёта своей
 * комнаты выбивалась в 729–784 г. Поэтому выбор делается на ГОТОВЫХ днях: движок собирает
 * день без добора и день с добором, и берёт овощной только если он не хуже честного
 * по каждому инварианту (обрезки, отклонение ≤ канона, «вёдра», тарелка ≤ max(700, честная)).
 *
 * Замер после §8.122:
 *   ручной: <200 г — 41 → **26** дней, без овоща — 9 → **3**, один вид — 38 → **29**,
 *           вне канона 0;
 *   авто:   <200 г — 10 → **5**, один вид — 6 → **3**, вне канона 0.
 * Остаток — физика: день 4600–8370 ккал (белок 250–500 г) уже стоит тарелками 650–750 г;
 * 200 г овоща туда не влезают без вытеснения еды, а тарелка 700 г — контракт (E-PLATE).
 *
 * Второй проход (§8.88-замок ловил регрессию): добор, который отказывался ставить овощ
 * в тарелку 437 г «потому что 500 — уже ведро», терял честную роль на `small60/4/тр` и
 * `recomp80/5/тр` (рыба оставалась «овощем», балл 89/96 против 87/94). Овощ теперь
 * вписывается вместе с ккал-нейтральным срезом крахмала того же приёма (`_cutFit88`),
 * а день без добора и день с добором сравниваются по НАСТОЯЩЕМУ овощу (§8.88: белок
 * ≥12 г/100 г — не овощ), иначе шорткат «день уже держит QG10» видел рыбу как овощ.
 */

const PROFILES = [
  { id: 'p500', w: 110, k: 4600, p: 500, f: 120 },
  { id: 'c1500', w: 110, k: 8370, p: 300, f: 130, c: 1500 },
  { id: 'hugeCarb', w: 100, k: 6700, p: 250, f: 100 },
  { id: 'mass110', w: 110, k: 5200, p: 260, f: 120 },
  { id: 'normal90', w: 90, k: 3000, p: 200, f: 80 },
  { id: 'mid75', w: 75, k: 2400, p: 180, f: 70 },
  { id: 'small60', w: 60, k: 1600, p: 150, f: 45 },
  { id: 'cutF50', w: 50, k: 1240, p: 110, f: 40 },
  { id: 'recomp80', w: 80, k: 2200, p: 200, f: 60 },
  { id: 'keto85', w: 85, k: 2400, p: 180, f: 150 },
];

const carbsFor = (p: any) => (p.c && p.c > 0 ? p.c : Math.max(0, Math.round((p.k - 4 * p.p - 9 * p.f) / 4)));

const build = (p: any, mc: number, tr: boolean, manual: boolean, extra: any = {}): any => buildDayPlan({
  weightKg: p.w, lbmKg: Math.round(p.w * 0.82), bodyFatPct: 18, sex: 'male',
  goalKcal: p.k, goalProteinG: p.p, goalFatG: p.f, goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
  ...extra,
} as unknown as MealPlanInput);

const CRUMB_PLANT_G = 40;

/** Пол порции по роли — та же арифметика, что держит замок §8.112. */
const crumbFloor = (it: any): number => {
  const role = String(it?.role || '');
  if (!role || role === 'supplement' || role === 'liquid' || role === 'other') return 0;
  if (it && it._fixedGrams) return 0;
  const id = String(it?.id || '');
  const fd: any = FOOD_DB.find((f: any) => String(f.id) === id);
  if (!fd) return 0;
  if (isSauceCondimentFood(fd) || isHerbSpiceId(id)) return 0;
  if (isPureSupplementId(id, fd.category)) return 0;
  if (isProteinPowderId(id)) return 20;
  if (role === 'veg' || role === 'fruit') return CRUMB_PLANT_G;
  return Number((MIN_MEANINGFUL_G as any)[role] || 0);
};

const items = (plan: any): any[] => (plan.meals || []).flatMap((m: any) => m.items || []);
const solid = (m: any): number => ((m.items || []) as any[])
  .filter((x: any) => String(x.role || '') !== 'liquid')
  .reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
/** Овощ дня по §8.122: микро-посыпка (§8.4) овощем не считается — она не слот тарелки. */
const vegItems = (plan: any): any[] => items(plan)
  .filter((x: any) => x.role === 'veg' && !x._microClosure && !x._microGap);
const vegG = (plan: any): number => vegItems(plan)
  .reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
const vegKinds = (plan: any): number => new Set(vegItems(plan).map((x: any) => String(x.id))).size;
const crumbs = (plan: any): number => items(plan).filter((x: any) => {
  const f = crumbFloor(x);
  return f > 0 && (Number(x.amount) || 0) < f - 1e-9;
}).length;
const buckets = (plan: any): number => (plan.meals || []).filter((m: any) => (m.items || []).length > 0 && solid(m) > 500).length;

type Row = { key: string; manual: boolean; on: any; off: any };
const ROWS: Row[] = [];
for (const manual of [true, false]) {
  for (const p of PROFILES) for (const mc of [3, 4, 5, 6]) for (const tr of [true, false]) {
    ROWS.push({
      key: `${manual ? 'руч' : 'авт'}/${p.id}/${mc}/${tr ? 'тр' : 'отд'}`,
      manual,
      on: build(p, mc, tr, manual),
      off: build(p, mc, tr, manual, { vegTopUp88: false }),
    });
  }
}

describe('§8.122 овощной пол: 200 г и два вида не спорят с контрактом дня', () => {
  it('сетка покрывает 160 дней (80 авто + 80 ручных)', () => {
    expect(ROWS).toHaveLength(160);
  });

  it('добор никогда не создаёт обрезок, вёдер и переполненных тарелок', () => {
    const bad: string[] = [];
    for (const r of ROWS) {
      if (crumbs(r.on) > crumbs(r.off)) {
        bad.push(`${r.key}: обрезков ${crumbs(r.off)} → ${crumbs(r.on)}`);
      }
      if (buckets(r.on) > buckets(r.off)) {
        bad.push(`${r.key}: вёдер ${buckets(r.off)} → ${buckets(r.on)}`);
      }
      const plainPlate = new Map<string, number>((r.off.meals || []).map((m: any) => [String(m.label), solid(m)]));
      for (const m of r.on.meals || []) {
        const cap = Math.max(700, plainPlate.get(String(m.label)) || 0);
        if (solid(m) > cap + 1e-9) bad.push(`${r.key}: ${m.label} ${solid(m)} г > ${cap} г`);
      }
      if (vegG(r.on) < vegG(r.off)) bad.push(`${r.key}: овоща меньше, чем без добора`);
    }
    expect(bad.join(' | ')).toBe('');
  });

  it('все дни в каноне: авто ≤3 %, ручной ≤2 % по каждой оси', () => {
    const bad: string[] = [];
    for (const r of ROWS) {
      const dev = Number(r.on.deviationPct) || 0;
      const lim = r.manual ? 2 : 3;
      if (dev > lim + 1e-6) bad.push(`${r.key}: ${dev.toFixed(2)} % > ${lim} %`);
    }
    expect(bad.join(' | ')).toBe('');
  });

  it('покрытие овощем (факт): ручной <200 г ≤26, без овоща ≤3, один вид ≤29', () => {
    const rows = ROWS.filter(r => r.manual);
    const low = rows.filter(r => vegG(r.on) < 200);
    const zero = rows.filter(r => vegG(r.on) === 0);
    const one = rows.filter(r => vegKinds(r.on) < 2);
    expect(low.length, low.map(r => `${r.key}:${vegG(r.on)}`).join(' | ')).toBeLessThanOrEqual(26);
    expect(zero.length, zero.map(r => r.key).join(' | ')).toBeLessThanOrEqual(3);
    expect(one.length, one.map(r => r.key).join(' | ')).toBeLessThanOrEqual(29);
  });

  it('покрытие овощем (факт): авто <200 г ≤5, один вид ≤3', () => {
    const rows = ROWS.filter(r => !r.manual);
    const low = rows.filter(r => vegG(r.on) < 200);
    const one = rows.filter(r => vegKinds(r.on) < 2);
    expect(low.length, low.map(r => `${r.key}:${vegG(r.on)}`).join(' | ')).toBeLessThanOrEqual(5);
    expect(one.length, one.map(r => r.key).join(' | ')).toBeLessThanOrEqual(3);
  });

  it('добор действительно работает: адресные дни выросли (было 0 и 161–166 г)', () => {
    const at = (key: string) => ROWS.find(r => r.key === key)!;
    expect(vegG(at('руч/hugeCarb/3/тр').on)).toBeGreaterThanOrEqual(100); // было 0
    expect(vegG(at('руч/hugeCarb/3/тр').off)).toBe(0);
    expect(vegG(at('руч/cutF50/6/тр').on)).toBeGreaterThanOrEqual(100);   // было 0
    expect(vegG(at('руч/cutF50/6/тр').off)).toBe(0);
    expect(vegG(at('руч/mass110/3/отд').on)).toBeGreaterThanOrEqual(185); // было 166
    expect(vegG(at('руч/mass110/3/отд').off)).toBe(166);
  });

  it('авторские порции рецептов не трогаются: овощей с `_fixedGrams` не больше, чем без добора', () => {
    for (const r of ROWS) {
      const fixedOn = items(r.on).filter((x: any) => x.role === 'veg' && x._fixedGrams).length;
      const fixedOff = items(r.off).filter((x: any) => x.role === 'veg' && x._fixedGrams).length;
      expect(fixedOn, r.key).toBeLessThanOrEqual(fixedOff);
    }
  });
});
