import { describe, it, expect } from 'vitest';
import { preferVegPlan122 } from '../meal-plan-engine';

/**
 * §8.122 / P1-3 «овощное плечо и +1 ведро» (юнит на саму ветку `bucketsOf122`).
 *
 * Сетка — `planner-veg-floor-8122`; здесь десять ручных дней, чтобы замок держал ПРАВИЛО, а не
 * факт сетки. Правило выше по коду (граммы/виды → обрезки → балл → роль → канон) остаётся
 * прежним; проверяется только ветка «вёдер»: допустимо ровно ОДНО НОВОЕ «ведро» (>500 г
 * твёрдого), если овоща стало больше (≥150 г или новый вид) И само новое ведро пересекло 500 г
 * из-за добавленного овоща (прирост в этом приёме ≥ 40 г — пол «крошки» §8.112, и без него
 * тарелка ≤500 г); два новых ведра и больше — отказ (независимо от знака разницы счётчиков);
 * +1 без роста овоща — отказ; тарелка >900 г — жёсткий отказ.
 *
 * Дни минимальной формы: `preferVegPlan122` читает `meals[].label`, `meals[].items[].{id,role,
 * amount,p}`, `meals[].totals.{p,f}`, `notes`, `deviationPct`, `canonPct`; балл дня он считает
 * сам (`scoreDayQuality` + микро из `FOOD_DB`), поэтому id — реальные продукты.
 */

const PER100: Record<string, { p: number; f: number; c: number; kcal: number; fiber: number }> = {
  chicken_breast: { p: 23, f: 2.7, c: 0, kcal: 165, fiber: 0 },
  buckwheat: { p: 12.6, f: 3.3, c: 62, kcal: 313, fiber: 10 },
  cucumber: { p: 0.7, f: 0.1, c: 3.6, kcal: 15, fiber: 0.5 },
  carrot: { p: 0.9, f: 0.2, c: 9.6, kcal: 41, fiber: 2.8 },
  broccoli: { p: 2.8, f: 0.4, c: 6.6, kcal: 34, fiber: 2.6 },
};

const item = (id: keyof typeof PER100, role: string, amount: number, extra: Record<string, unknown> = {}) => {
  const q = PER100[id];
  const k = amount / 100;
  return {
    id,
    role,
    amount,
    p: +(q.p * k).toFixed(2),
    f: +(q.f * k).toFixed(2),
    c: +(q.c * k).toFixed(2),
    kcal: +(q.kcal * k).toFixed(1),
    fiber: +(q.fiber * k).toFixed(2),
    ...extra,
  };
};

const meal = (label: string, items: any[]) => ({
  label,
  type: 'lunch',
  items,
  totals: {
    p: +items.reduce((s, x) => s + x.p, 0).toFixed(2),
    f: +items.reduce((s, x) => s + x.f, 0).toFixed(2),
    c: +items.reduce((s, x) => s + x.c, 0).toFixed(2),
    kcal: +items.reduce((s, x) => s + x.kcal, 0).toFixed(1),
    fiber: +items.reduce((s, x) => s + x.fiber, 0).toFixed(2),
  },
  target: { p: 0, f: 0, c: 0 },
});

const day = (meals: any[]): any => ({
  meals,
  totals: { p: 0, f: 0, c: 0, kcal: 0, fiber: 0 },
  notes: [],
  deviationPct: 0.5,
  canonPct: 2,
  withinTolerance: true,
});

const INPUT: any = { weightKg: 80, sex: 'male', cyclePhase: 'none', isTrainingDay: false };

const chicken = (g: number) => item('chicken_breast', 'protein', g);
const buckwheat = (g: number) => item('buckwheat', 'carb_slow', g);
const cucumber = (g: number, extra: Record<string, unknown> = {}) => item('cucumber', 'veg', g, extra);
const carrot = (g: number) => item('carrot', 'veg', g);
const broccoli = (g: number) => item('broccoli', 'veg', g);

describe('§8.122 / P1-3: «ведро» пускается только за овощ', () => {
  it('(i) +1 ведро, рост овоща 140 г (<150) и те же виды → отказ', () => {
    // Обед — ведро в обоих плечах (530 г); новое ведро ужина 480 → 620 даёт +140 г огурца
    // (0 → 140 г): рост <150 г и второго вида нет. Первая сработавшая проверка — ветка
    // «вёдер» (рост/виды), не более ранняя: пол «крошки» 40 г пройден (140 ≥ 40), вёдра 1→2,
    // балл не хуже — значит без дневного гейта день был бы принят.
    const plain = day([
      meal('Обед', [chicken(150), buckwheat(320), cucumber(60)]),
      meal('Ужин', [chicken(150), buckwheat(330)]),
    ]);
    const veg = day([
      meal('Обед', [chicken(150), buckwheat(320), cucumber(60)]),
      meal('Ужин', [chicken(150), buckwheat(330), cucumber(140)]),
    ]);
    expect(preferVegPlan122(veg, plain, INPUT)).toBe(false);
  });

  it('(ii) +2 ведра, даже при росте овоща 200 г → отказ', () => {
    // Ужин 480 → 559 (+79 г) и перекус 400 → 521 (+121 г): оба пересекли 500 г, рост 200 г,
    // но +2 ведра — потолок правила — отказ (вёдра 1→3, балл 59→83; более ранние гейты пройдены).
    const plain = day([
      meal('Обед', [chicken(150), buckwheat(360)]),
      meal('Ужин', [chicken(150), buckwheat(330)]),
      meal('Перекус', [chicken(120), buckwheat(280)]),
    ]);
    const veg = day([
      meal('Обед', [chicken(150), buckwheat(360)]),
      meal('Ужин', [chicken(150), buckwheat(330), cucumber(79)]),
      meal('Перекус', [chicken(120), buckwheat(280), cucumber(121)]),
    ]);
    expect(preferVegPlan122(veg, plain, INPUT)).toBe(false);
  });

  it('(iii) +1 ведро, но перешагнувший приём не получил овоща (dVegM = 0) → отказ', () => {
    // Рост овоща 150 г отдан перекусу (200 → 350 г, не ведро), а ведром стал ужин за счёт
    // +40 г крупы (470 → 510): рост ≥150 г есть, но новое ведро овощем не вызвано — первая
    // сработавшая проверка именно `driven` (граммы/виды/обрезки/балл 50→70/канон проходят).
    const plain = day([
      meal('Обед', [chicken(150), buckwheat(360)]),
      meal('Ужин', [chicken(150), buckwheat(320)]),
      meal('Перекус', [chicken(120), buckwheat(80)]),
    ]);
    const veg = day([
      meal('Обед', [chicken(150), buckwheat(360)]),
      meal('Ужин', [chicken(150), buckwheat(360)]),
      meal('Перекус', [chicken(120), buckwheat(80), cucumber(150)]),
    ]);
    expect(preferVegPlan122(veg, plain, INPUT)).toBe(false);
  });

  it('(iv) +1 ведро, +150 г овоща в этом же приёме → принято', () => {
    // Ужин 470 → 620 г: без 150 г огурца тарелка была бы 470 г (≤500) — ведро куплено овощем.
    // Диагностика: единственный принятый кейс, балл 50 → 68.
    const plain = day([
      meal('Обед', [chicken(150), buckwheat(360)]),
      meal('Ужин', [chicken(150), buckwheat(320)]),
      meal('Перекус', [chicken(120), buckwheat(80)]),
    ]);
    const veg = day([
      meal('Обед', [chicken(150), buckwheat(360)]),
      meal('Ужин', [chicken(150), buckwheat(320), cucumber(150)]),
      meal('Перекус', [chicken(120), buckwheat(80)]),
    ]);
    expect(preferVegPlan122(veg, plain, INPUT)).toBe(true);
  });

  it('(v) тот же день, но тарелка 901 г → отказ по абсолютному пределу E-PLATE', () => {
    // Тарелка 901 г стоит в ОБОИХ плечах (иначе её отказ был бы виден не тут), поэтому
    // единственный гейт, отвергающий овощное плечо, — жёсткий предел 900 г (ветка «вёдер»
    // пройдена: вёдра 1→2, driven да; балл 43→60).
    const plain = day([
      meal('Обед', [chicken(250), buckwheat(651)]),
      meal('Ужин', [chicken(150), buckwheat(320)]),
      meal('Перекус', [chicken(120), buckwheat(80)]),
    ]);
    const veg = day([
      meal('Обед', [chicken(250), buckwheat(651)]),
      meal('Ужин', [chicken(150), buckwheat(320), cucumber(150)]),
      meal('Перекус', [chicken(120), buckwheat(80)]),
    ]);
    expect(preferVegPlan122(veg, plain, INPUT)).toBe(false);
  });

  it('(vi) +1 ведро, рост овоща 100 г, НО новый вид в этом же приёме → принято (форма mass110)', () => {
    // Обед 510 г — ведро в обоих плечах. Ужин 500 → 600 г: +100 г моркови (нового вида),
    // поэтому дневной гейт (рост ≥150 ИЛИ новый вид) пройден, `driven` видит 100 г прироста
    // в самом ведре (≥40 г), а `solid − dVeg = 500` — ровно граница (правило `≤ 500`, без
    // овоща тарелка была бы ведром лишь на границе), то есть это форма `mass110/{3,4,5,6}/тр`,
    // где выигрыш даёт второй вид, а не 150 г.
    const plain = day([
      meal('Обед', [chicken(150), buckwheat(360)]),
      meal('Ужин', [chicken(150), buckwheat(300), cucumber(50)]),
    ]);
    const veg = day([
      meal('Обед', [chicken(150), buckwheat(360)]),
      meal('Ужин', [chicken(150), buckwheat(300), cucumber(50), carrot(100)]),
    ]);
    expect(preferVegPlan122(veg, plain, INPUT)).toBe(true);
  });

  it('(vii) +1 ведро, но прирост овоща в нём 2 г (остальные 148 г — в другом приёме) → отказ', () => {
    // Дневной гейт пройден (рост 150 г и новый вид), но ведро Ужина 499 → 501 г перешагнуло
    // 500 г на 2 г огурца — это ниже пола «крошки» 40 г (§8.112), значит овощ ведро не купил.
    // Пометка `_fixedGrams` нужна, чтобы день не отвергся РАНЬШЕ по гейту обрезков (2 г овоща
    // иначе считается обрезком роли), и проверялась именно ветка «вёдер».
    const plain = day([
      meal('Обед', [chicken(100), buckwheat(200), broccoli(50)]),
      meal('Ужин', [chicken(150), buckwheat(349)]),
    ]);
    const veg = day([
      meal('Обед', [chicken(100), buckwheat(200), broccoli(198)]),
      meal('Ужин', [chicken(150), buckwheat(349), cucumber(2, { _fixedGrams: true })]),
    ]);
    expect(preferVegPlan122(veg, plain, INPUT)).toBe(false);
  });

  it('(viii) +1 ведро, овоща +100 г, но и БЕЗ овоща тарелка >500 г → отказ', () => {
    // Ужин 480 → 700 г: 100 г овоща добавили, но ещё 120 г пришло крупы — без овоща тарелка
    // осталась бы 600 г (>500), значит ведро создано не овощем. Дневной гейт пройден (новый
    // вид), пол 40 г пройден (100 ≥ 40), первым падает `solid − dVegM ≤ 500`.
    const plain = day([meal('Ужин', [chicken(150), buckwheat(330)])]);
    const veg = day([meal('Ужин', [chicken(150), buckwheat(450), cucumber(100)])]);
    expect(preferVegPlan122(veg, plain, INPUT)).toBe(false);
  });

  it('(ix) срезал два ведра, создал два — разница счётчиков 0 → отказ по числу новых', () => {
    // Честный день держит ведра в Обеде и Ужине (550 г), овощной их срезает (400 г) и создаёт
    // два НОВЫХ — Завтрак 600 г и Перекус 550 г, оба куплены овощем (+150 г в каждом). Разница
    // счётчиков = 0, поэтому гейт `bV > bP` в ветку не входит: без отдельного счётчика новых
    // вёдер день был бы принят, хотя приёмов >500 г в нём два и оба новые.
    const plain = day([
      meal('Обед', [chicken(150), buckwheat(400)]),
      meal('Ужин', [chicken(150), buckwheat(400)]),
      meal('Перекус', [chicken(120), buckwheat(100)]),
    ]);
    const veg = day([
      meal('Завтрак', [chicken(150), buckwheat(300), cucumber(150)]),
      meal('Обед', [chicken(150), buckwheat(250)]),
      meal('Ужин', [chicken(150), buckwheat(250)]),
      meal('Перекус', [chicken(120), buckwheat(280), carrot(150)]),
    ]);
    expect(preferVegPlan122(veg, plain, INPUT)).toBe(false);
  });

  it('(x) граница пола: ровно 40 г нового вида в ведре — принято, 39 г — отказ', () => {
    // Пол `CRUMB_PLANT_122 = 40` держится в двух местах: 39 г огурца ниже него, а 39 г овоща
    // вообще не порция (пол «крошки»), поэтому 39 г помечены `_fixedGrams` — иначе день
    // отвергся бы раньше по обрезкам. Форма дня — принятый кейс (iv): Ужин 470 г, без овоща
    // ведром не был; рост дня 40/39 г (<150), но вид новый — дневной гейт пройден, решает
    // только пол `dVegM >= 40`.
    const plain = day([
      meal('Обед', [chicken(150), buckwheat(360)]),
      meal('Ужин', [chicken(150), buckwheat(320)]),
      meal('Перекус', [chicken(120), buckwheat(80)]),
    ]);
    const on40 = day([
      meal('Обед', [chicken(150), buckwheat(360)]),
      meal('Ужин', [chicken(150), buckwheat(320), cucumber(40)]),
      meal('Перекус', [chicken(120), buckwheat(80)]),
    ]);
    const on39 = day([
      meal('Обед', [chicken(150), buckwheat(360)]),
      meal('Ужин', [chicken(150), buckwheat(321), cucumber(39, { _fixedGrams: true })]),
      meal('Перекус', [chicken(120), buckwheat(80)]),
    ]);
    expect(preferVegPlan122(on40, plain, INPUT)).toBe(true);
    expect(preferVegPlan122(on39, plain, INPUT)).toBe(false);
  });
});
