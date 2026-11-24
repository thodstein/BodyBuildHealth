import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { MIN_MEANINGFUL_G, isRealVegItem } from '../planner-quality-score';
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
 * по каждому инварианту (обрезки, отклонение ≤ канона, «вёдра», тарелка ≤ честная + овощ,
 * но не более 900 г — контракт E-PLATE/§8.127).
 *
 * Замер после §8.122 (вторая редакция, 2026-11-24, после правок добора и приёмки §8.122):
 *   ручной: <200 г — 41 → **9** дней, без овоща — 9 → **1**, один вид — 38 → **9**,
 *           вне канона 0;
 *   авто:   <200 г — 10 → **0**, один вид — 6 → **1**, вне канона 0.
 * Остаток — физика: день 4600–8370 ккал (белок 250–500 г) уже стоит тарелками 650–750 г;
 * 200 г овоща туда не влезают без вытеснения еды, а тарелка 700 г — контракт (E-PLATE).
 *
 * Второй проход (§8.88-замок ловил регрессию): добор, который отказывался ставить овощ
 * в тарелку 437 г «потому что 500 — уже ведро», терял честную роль на `small60/4/тр` и
 * `recomp80/5/тр` (рыба оставалась «овощем», балл 89/96 против 87/94). Овощ теперь
 * вписывается вместе с ккал-нейтральным срезом крахмала того же приёма (`_cutFit88`),
 * а день без добора и день с добором сравниваются по НАСТОЯЩЕМУ овощу (§8.88: белок
 * ≥12 г/100 г — не овощ), иначе шорткат «день уже держит QG10» видел рыбу как овощ.
 *
 * P1-3 (§8.139, 2026-11-24): «ведро» перестало быть безусловным отказом — овощному плечу
 * разрешено ОДНО новое «ведро» (>500 г твёрдого), если оно куплено овощем: рост ≥150 г или
 * новый вид, и новый приём пересёк 500 г именно из-за добавленного овоща (прирост овоща в
 * самом ведре ≥40 г — пол «крошки» §8.112, чтобы 2 г огурца не «покупали» ведро). Замер:
 * ручной `<200` 9 → 4, без овоща 1 → 0, один вид 9 → 4, вёдра 121 → 126 (mass110/3–6/тр
 * 198→341 г, 1→2 вида, ведра 1→2; keto85/4/тр 0→250 г, 0→2 вида, ведра 0→1), средний балл
 * ручных дней (`scoreDayQuality` без микро) 77.91 → 82.05, канон 0, обрезки 0, тарелки >700 —
 * 49, >900 — 0; авто-сторона — вёдра 120 → 120, балл 89.96 → 90.41. Агрегатного потолка у замка нет: каждое новое ведро
 * проверяется правилом по дням, а общее число таких дней (замер — 5) держится счётчиком.
 *
 * Предикат овоща у замка теперь ОДИН с движком — `isRealVegItem` (§8.124: роль `veg` +
 * плотность белка < 12 г/100 г; `_microClosure`/`_microGap` не исключаются). Пересчёт сетки
 * 2026-11-24 этим предикатом фактов не изменил: ручной `on` — `<200` 4, без овоща 0, один вид 4,
 * вёдра 126 (off — 121); авто `on` — `<200` 0, один вид 1, вёдра 120 (off — 120). Агрегатной
 * константы «вёдер» в замке нет: правило проверяется по дням (потолок обязаны двигать P1-2/P1-5).
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

const build = (p: any, mc: number, tr: boolean, manual: boolean, extra: any = {}): any =>
  buildDayPlan({
    weightKg: p.w,
    lbmKg: Math.round(p.w * 0.82),
    bodyFatPct: 18,
    sex: 'male',
    goalKcal: p.k,
    goalProteinG: p.p,
    goalFatG: p.f,
    goalCarbsG: carbsFor(p),
    mealsCount: mc,
    isTrainingDay: tr,
    trainStartMin: tr ? 18 * 60 : undefined,
    trainDurationMin: 75,
    allowIntraWorkout: true,
    budget: 'medium',
    dayOffset: 0,
    cyclePhase: 'none',
    variety: 'medium',
    goal: 'maintenance',
    quality: 'full',
    excludedIds: new Set<string>(),
    allergenTags: new Set<string>(),
    randomSalt: 0,
    ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
    ...extra,
  } as unknown as MealPlanInput);

const CRUMB_PLANT_G = 40;

/** Пол порции по роли — та же арифметика, что держит замок §8.112, включая исключения движка
 *  (`crumbFloor122`: `_fixedGrams`, `_microClosure`, `_microGap` — это не обрезки). */
const crumbFloor = (it: any): number => {
  const role = String(it?.role || '');
  if (!role || role === 'supplement' || role === 'liquid' || role === 'other') return 0;
  if (it && (it._fixedGrams || it._microClosure || it._microGap)) return 0;
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
const solid = (m: any): number =>
  ((m.items || []) as any[])
    .filter((x: any) => String(x.role || '') !== 'liquid')
    .reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
/** Овощ дня — ТЕМ ЖЕ предикатом, что движок (§8.124: роль `veg` + плотность белка < 12 г/100 г;
 *  `_microClosure`/`_microGap` не исключаются — закрытие VitA морковью 80 г это настоящий овощ). */
const vegItems = (plan: any): any[] => items(plan).filter((x: any) => isRealVegItem(x));
const vegG = (plan: any): number => vegItems(plan).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
const vegKinds = (plan: any): number => new Set(vegItems(plan).map((x: any) => String(x.id))).size;
const crumbs = (plan: any): number =>
  items(plan).filter((x: any) => {
    const f = crumbFloor(x);
    return f > 0 && (Number(x.amount) || 0) < f - 1e-9;
  }).length;
const buckets = (plan: any): number =>
  (plan.meals || []).filter((m: any) => (m.items || []).length > 0 && solid(m) > 500).length;
/** Копия правила движка (`preferVegPlan122`): разрешено ровно ОДНО НОВОЕ «ведро» — приём >500 г,
 *  который в честном дне ведром не был (или которого там нет). Считаются именно новые, а не
 *  разница счётчиков: добор, срезавший одно ведро и создавший два, по разнице прошёл бы как «+1». */
const newBucketsOf = (on: any, off: any): any[] =>
  (on.meals || []).filter((m: any) => {
    if (solid(m) <= 500) return false;
    const pm = (off.meals || []).find((x: any) => String(x.label) === String(m.label));
    return !pm || solid(pm) <= 500;
  });
/** Копия `driven` движка: новое ведро обязано быть вызвано добавленным овощем — прирост овоща в
 *  самом ведре ≥40 г (пол «крошки» §8.112) и без него тарелка была бы ≤500 г. Иначе тест зелёный
 *  при удалённом `driven`. */
const newBucketDriven = (on: any, off: any): boolean =>
  newBucketsOf(on, off).some((m: any) => {
    const pm = (off.meals || []).find((x: any) => String(x.label) === String(m.label));
    if (!pm) return false;
    const dVeg = vegG({ meals: [m] }) - vegG({ meals: [pm] });
    return dVeg >= 40 && solid(m) - dVeg <= 500;
  });

type Row = { key: string; manual: boolean; on: any; off: any };
const ROWS: Row[] = [];
for (const manual of [true, false]) {
  for (const p of PROFILES)
    for (const mc of [3, 4, 5, 6])
      for (const tr of [true, false]) {
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

  it('метки приёмов уникальны внутри дня — правило «вёдер» ищет пару по `label`', () => {
    // `preferVegPlan122` и копии ниже сопоставляют приёмы по `label`; при двух одинаковых метках
    // сравнение возьмёт первый приём, и метрика «вёдер» станет бессмысленной. Инвариант нигде
    // не объявлен, поэтому проверяется здесь, а не подразумевается.
    const bad: string[] = [];
    for (const r of ROWS) {
      for (const plan of [r.on, r.off]) {
        const labels = (plan.meals || []).map((m: any) => String(m.label));
        if (new Set(labels).size !== labels.length) bad.push(`${r.key}: ${labels.join(' / ')}`);
      }
    }
    expect(bad.join(' | ')).toBe('');
  });

  it('добор не создаёт обрезок и переполненных тарелок; «вёдра» — только +1 по правилу', () => {
    const bad: string[] = [];
    for (const r of ROWS) {
      if (crumbs(r.on) > crumbs(r.off)) {
        bad.push(`${r.key}: обрезков ${crumbs(r.off)} → ${crumbs(r.on)}`);
      }
      const bOn = buckets(r.on);
      const bOff = buckets(r.off);
      // Счётчик НОВЫХ вёдер — до гейта «вёдра выросли»: день «срезал два, создал два» по разнице
      // счётчиков даёт ноль, а приёмов >500 г стало на два больше. Отказ по числу новых стоит
      // вне ветки — тем же порядком, что в движке.
      const nr = newBucketsOf(r.on, r.off);
      if (nr.length > 1) {
        bad.push(
          `${r.key}: новых вёдер ${nr.length} (всего ${bOff} → ${bOn}) при овоще ${vegG(r.off)} → ${vegG(r.on)} г`,
        );
      }
      if (bOn > bOff) {
        // P1-3: одно НОВОЕ «ведро» разрешено, только если овоща стало больше (≥150 г или новый
        // вид) И само ведро пересекло 500 г из-за добавленного овоща. Замер 2026-11-24: 5 таких
        // дней на ручном (mass110/3–6/тр — 198 → 341 г, но второй вид; keto85/4/тр — 0 → 250 г).
        const grew = vegG(r.on) - vegG(r.off);
        const moreKinds = vegKinds(r.on) > vegKinds(r.off);
        if (!(grew >= 150 || moreKinds) || !newBucketDriven(r.on, r.off)) {
          bad.push(`${r.key}: новых вёдер ${nr.length} при овоще ${vegG(r.off)} → ${vegG(r.on)} г`);
        }
      }
      const plainPlate = new Map<string, number>((r.off.meals || []).map((m: any) => [String(m.label), solid(m)]));
      const plainVeg = new Map<string, number>(
        (r.off.meals || []).map((m: any) => [String(m.label), vegG({ meals: [m] })]),
      );
      for (const m of r.on.meals || []) {
        // §8.122 (правка): приём может быть шире честного ровно на ДОБАВЛЕННЫЙ в него овощ.
        // Исторический замер (то дерево, на котором правило вводилось): `руч/hugeCarb/3/тр` —
        // ужин 789 г против честных 734 (+100 г яблока, −45 г крахмала), день 0.60 % против
        // 0.40 %, балл 87 против 79; прежняя формула `max(700, честная)` откатывала такой день
        // к честному и теряла овощ. Числа этого дня на текущем дереве другие (см. ниже, кейс
        // «добор действительно работает»), поэтому это обоснование формулы, а не факт сетки.
        //
        // Абсолютный предел 900 г (контракт E-PLATE/§8.127) проверяется отдельно: правило
        // «честная + овощ» при честной тарелке 880 г разрешило бы 1000 г.
        const dVeg = Math.max(0, vegG({ meals: [m] }) - Number(plainVeg.get(String(m.label)) || 0));
        const cap = Math.min(900, Math.max(700, (plainPlate.get(String(m.label)) || 0) + dVeg));
        if (solid(m) > cap + 1e-9) bad.push(`${r.key}: ${m.label} ${solid(m)} г > ${cap} г`);
        if (solid(m) > 900 + 1e-9) bad.push(`${r.key}: ${m.label} ${solid(m)} г > 900 г (E-PLATE)`);
      }
      if (vegG(r.on) < vegG(r.off)) bad.push(`${r.key}: овоща меньше, чем без добора`);
    }
    // P1-3: агрегатной константы «вёдер» здесь нет — её обязаны поднимать P1-2/P1-5, поэтому
    // потолок держит правило по дням выше. Регрессионный сигнал (НЕ продуктовая константа):
    // замер 2026-11-24 — 5 дней с новым «ведром» на ручной стороне (mass110/3–6/тр, keto85/4/тр),
    // авто — 0. Рост этого числа значит, что вёдра появляются шире замысла правила.
    const grewDays = ROWS.filter((r) => newBucketsOf(r.on, r.off).length > 0).length;
    if (grewDays > 5) bad.push(`дней с новым «ведром»: ${grewDays} > 5 (замер 2026-11-24: 5)`);
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

  it('покрытие овощем (факт): ручной <200 г ≤4, без овоща ≤0, один вид ≤4', () => {
    const rows = ROWS.filter((r) => r.manual);
    const low = rows.filter((r) => vegG(r.on) < 200);
    const zero = rows.filter((r) => vegG(r.on) === 0);
    const one = rows.filter((r) => vegKinds(r.on) < 2);
    expect(low.length, low.map((r) => `${r.key}:${vegG(r.on)}`).join(' | ')).toBeLessThanOrEqual(4);
    expect(zero.length, zero.map((r) => r.key).join(' | ')).toBeLessThanOrEqual(0);
    expect(one.length, one.map((r) => r.key).join(' | ')).toBeLessThanOrEqual(4);
  });

  it('покрытие овощем (факт): авто <200 г ≤0, один вид ≤1', () => {
    const rows = ROWS.filter((r) => !r.manual);
    const low = rows.filter((r) => vegG(r.on) < 200);
    const one = rows.filter((r) => vegKinds(r.on) < 2);
    expect(low.length, low.map((r) => `${r.key}:${vegG(r.on)}`).join(' | ')).toBeLessThanOrEqual(0);
    expect(one.length, one.map((r) => r.key).join(' | ')).toBeLessThanOrEqual(1);
  });

  it('добор действительно работает: адресные дни выросли (было 0 и 166 г)', () => {
    const at = (key: string) => ROWS.find((r) => r.key === key)!;
    expect(vegG(at('руч/hugeCarb/3/тр').on)).toBeGreaterThanOrEqual(200); // было 0
    // §8.122: базовая сборка дня держит только broccoli 156 г (один вид), а обе тарелки
    // стоят на своём пределе (обед 872/872, ужин 734/734). Добор ставит огурец 100 г в
    // «Перекус 3» — единственный приём с комнатой (564 → 644 г при пределе 700) — вместе
    // с ккал-нейтральным срезом крахмала: день 256 г / 2 вида, девиация 0.40 %, балл 84.
    expect(vegKinds(at('руч/hugeCarb/3/тр').on)).toBeGreaterThanOrEqual(2);
    expect(vegG(at('руч/cutF50/6/тр').on)).toBeGreaterThanOrEqual(100); // было 0
    // Отношение, а не прибитый ноль: честный день вправе вырасти (P1-2 лечит именно это; было 0).
    expect(vegG(at('руч/cutF50/6/тр').on)).toBeGreaterThanOrEqual(vegG(at('руч/cutF50/6/тр').off));
    // Честный день держал 166 г — на 34 г ниже пола QG10. P1-2 вправе это вылечить, поэтому
    // пол дня проверяем у овощного плеча, а не у честного (было 166 г).
    expect(vegG(at('руч/mass110/3/отд').on)).toBeGreaterThanOrEqual(200);
  });

  it('авторские порции рецептов не трогаются: `_fixedGrams`-позиции дня идентичны без добора', () => {
    // Замок не на «количестве» флагов, а на составе: каждая позиция с `_fixedGrams`
    // (авторская порция, микро-добивка, креатин — в сетке их 16 на овощах и 832 всего)
    // обязана остаться в том же приёме с тем же весом. Сравнение по тройке
    // «приём/продукт/граммы» ловит и удаление, и переезд, и досыпку.
    const fixedSet = (plan: any): string[] =>
      (plan.meals || []).flatMap((m: any) =>
        ((m.items || []) as any[])
          .filter((x: any) => x._fixedGrams)
          .map((x: any) => `${String(m.label)}|${String(x.id)}|${Number(x.amount) || 0}`),
      );
    let seen = 0;
    for (const r of ROWS) {
      const on = fixedSet(r.on);
      const off = fixedSet(r.off);
      seen += off.length;
      expect(on, r.key).toEqual(off);
    }
    // Замок не вакуумный: сетка реально несёт `_fixedGrams`-позиции.
    expect(seen).toBeGreaterThan(0);
  });
});
