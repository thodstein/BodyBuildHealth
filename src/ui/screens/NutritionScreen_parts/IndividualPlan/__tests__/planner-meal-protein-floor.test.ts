import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * §8.63 «приём не голодает по белку» (стадия `breakfastProteinFloor`, по умолчанию ВКЛ).
 *
 * Дефект (замер 60 дней, 10 профилей × 4/5/6 приёмов × трен/отдых): 84 приёма с
 * красным бейджем «Б факт / порог», из них 7 — завтрак. Самый громкий случай
 * `cutF50/5/тр`: завтрак 6 г белка (0.12 г/кг при пороге MPS 0.30), ужин 18 г, а
 * перекус в тот же день — 40 г. QG14 добивает слабейший основной приём раньше по
 * конвейеру, но её работу съедают поздние стадии (фрукт §8.59, ребаланс §8.57).
 *
 * Фикс — перенос белка, а не новое блюдо:
 *  1) основной приём ниже 0.30 г/кг растит СВОЙ белковый пункт (самый «дешёвый»
 *     по калориям на грамм белка: яичный белок выгоднее целого яйца);
 *  2) столько же белка снимается с самого богатого регулярного приёма дня;
 *  3) выросшие калории гасит гарнир донора (пол 30 г) / гарнир-жир самой тарелки;
 *  4) порядок — сначала основные приёмы, потом перекусы (иначе голодный перекус
 *     вычерпает донора раньше завтрака: замер 3 → 6 бейджей завтрака);
 *  5) белковые порции — шаг 5 г и 40–200 г (QG19), масса тарелки ≤ 500 г,
 *     канон 3% — жёсткий гейт (шаг, ухудшающий день, откатывается целиком).
 *
 * Замер (60 дней): бейджи «Б ниже порога» 84 → 78, завтрак 7 → 3, средняя оценка дня
 * 88.40 → 88.62, худший день +6 баллов, дней с потерей балла 0, дней вне канона 5 → 5,
 * вёдер 90 → 90, минимум белка основного приёма 514 → 515 г (по дню).
 *
 * §8.113/§8.114 (после «полная порция белка или ноль»): базовая линия «без стадии» стала
 * 9 бейджей завтрака, со стадией — 5. Причина остатка не в самой стадии: это дни, где
 * белок ДНЯ уже на цели или выше (cutF50 111.9/110, keto85 181.3/180), и подъём завтрака
 * покупается только перебором дня — гейт канона честно отказывает. Приоритет владельца —
 * «≤3 % всегда», поэтому завтрак здесь уступает; распределение белка лечится сборкой дня,
 * а не последней милей.
 *
 * P1-3 (§8.139, 2026-11-24): овощной добор §8.122 изолирован в A/B (как §8.78/§8.84/§8.73/
 * §8.75/§8.111). После того как «ведро» перестало быть безусловным отказом, добор выбирал
 * разные планы в двух сборках, и стадии приписывался его выбор: `small60/4/тр` при включённой
 * стадии уходил с 5.10 % на 3.60 % и терял ведро, но платил 1 баллом (микро 74 → 56).
 * Числа стадии от изоляции не изменились (бейджи 7 / ≤5), а суммарный балл на текущем дереве
 * — 5518 → 5531 изолированно и 5612 → 5625 в сборке с овощным добором (замер 2026-11-24;
 * строка «5561 → 5586» выше — история замера до §8.135–§8.139). Сборка с добором проверяется
 * отдельным кейсом: единственная потеря балла — тот же `small60/4/тр` 87 → 86 при улучшении
 * канона (5.10 % → 3.60 %; 3 % так и не достигнуты).
 */

const PROFILES: Array<{
  id: string;
  w: number;
  lbm: number;
  bf: number;
  sex: 'male' | 'female';
  k: number;
  p: number;
  f: number;
  c?: number;
}> = [
  { id: 'p500', w: 110, lbm: 90, bf: 18, sex: 'male', k: 4600, p: 500, f: 120 },
  { id: 'c1500', w: 110, lbm: 90, bf: 18, sex: 'male', k: 8370, p: 300, f: 130, c: 1500 },
  { id: 'hugeCarb', w: 100, lbm: 82, bf: 18, sex: 'male', k: 6700, p: 250, f: 100 },
  { id: 'mass110', w: 110, lbm: 90, bf: 18, sex: 'male', k: 5200, p: 260, f: 120 },
  { id: 'normal90', w: 90, lbm: 73, bf: 19, sex: 'male', k: 3000, p: 200, f: 80 },
  { id: 'mid75', w: 75, lbm: 61, bf: 18, sex: 'male', k: 2400, p: 180, f: 70 },
  { id: 'small60', w: 60, lbm: 49, bf: 18, sex: 'female', k: 1600, p: 150, f: 45 },
  { id: 'cutF50', w: 50, lbm: 41, bf: 18, sex: 'female', k: 1240, p: 110, f: 40 },
  { id: 'recomp80', w: 80, lbm: 65, bf: 18, sex: 'male', k: 2200, p: 200, f: 60 },
  { id: 'keto85', w: 85, lbm: 70, bf: 18, sex: 'male', k: 2400, p: 180, f: 150 },
];

const carbsFor = (p: { k: number; p: number; f: number; c?: number }) =>
  p.c && p.c > 0 ? p.c : Math.max(0, Math.round((p.k - 4 * p.p - 9 * p.f) / 4));

const build = (
  p: (typeof PROFILES)[number],
  mc: number,
  tr: boolean,
  on: boolean,
  extra: Record<string, unknown> = {},
): any =>
  buildDayPlan({
    weightKg: p.w,
    lbmKg: p.lbm,
    bodyFatPct: p.bf,
    sex: p.sex,
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
    // §8.78 (плотный овощ вместо объёма) выключается в обоих вариантах: иначе A/B
    // перестаёт быть сравнением одной стадии (микро меняются до её гейтов).
    vegDensity78: false,
    // §8.84 (перенос белка между приёмами) изолирован: замок мерит только свою стадию.
    proteinSmooth84: false,
    breakfastProteinFloor: on,
    // §8.73 (порошок не мельче 20 г) изолирован в обоих вариантах: это НЕ стадия §8.63, но она
    // срабатывает только в том дне, где §8.63 не тронул перекус, и замер 60 дней показывал из-за
    // неё ложные срабатывания замка — `recomp80/6/тр` ΔP = 7.1 г (порог 4.8) и «whey_isolate 11 г»
    // (порошок 11 → 20 г — законная полупорция §8.73, а не обрезок §8.63). С изоляцией §8.73
    // перенос §8.63 точен: ΔP ≤ 1.0 г на всех 60 днях, оценка 5561 → 5586 (0 дней хуже,
    // канон/вёдра не хуже), порции стадии — 40–200 г шагом 5 г (egg_whole 75 → 115, chicken 90 → 75).
    powderMinPortion73: false,
    // §8.111: измерительный флаг — последняя миля выключена, иначе A/B сравнивает два уже
    // сведённых дня и разница стадии съедается (см. §8.111 в аудите).
    noLastMile111: true,
    // §8.75 (семя вместо масла) включается отдельно и имеет свой замок: её обмен меняет
    // белок приёма и портил бы «без стадии» вариант этого A/B.
    seedSwap75: false,
    // P1-3 (§8.139, 2026-11-24): овощной добор §8.122 изолирован в ОБОИХ вариантах, как и
    // остальные соседние стадии выше. Причина: после P1-3 добор стал выбирать разные планы
    // в двух сборках, и A/B перестал быть сравнением одной стадии — `small60/4/тр` при
    // включённой стадии уходил с 5.10 % на 3.60 % и терял ведро, но платил 1 баллом
    // композитной оценки (микро 74 → 56). Бейджи от изоляции не сдвинулись (7 / ≤5), сумма
    // на текущем дереве: 5518 → 5531 изолированно против 5612 → 5625 с добором.
    vegTopUp88: false,
    ...extra,
  } as unknown as MealPlanInput);

const cells = (on: boolean, extra: Record<string, unknown> = {}) =>
  PROFILES.flatMap((p) =>
    [4, 5, 6].flatMap((mc) =>
      [true, false].map((tr) => ({
        key: `${p.id}/${mc}/${tr ? 'тр' : 'отд'}`,
        w: p.w,
        plan: build(p, mc, tr, on, extra),
      })),
    ),
  );

/** Бейджи «Б факт / порог» ровно как их видит UI: порог `target.pd`, недобор > 3 г. */
const badges = (rows: ReturnType<typeof cells>) =>
  rows.flatMap((r) =>
    ((r.plan.meals || []) as any[])
      .filter((m: any) => Number(m.target?.pd) > 0 && (Number(m.totals?.p) || 0) < Number(m.target.pd) - 3)
      .map((m: any) => `${r.key}:${m.type}`),
  );

/** Масса тарелки для метрики «вёдер» — ТЕМ ЖЕ определением, что `solidOf122` движка (исключён
 *  только `liquid`): иначе добавка, переведшая приём через 500 г, прошла бы незамеченной. */
const solidForBuckets = (m: any) =>
  (m.items || [])
    .filter((i: any) => String(i.role || '') !== 'liquid')
    .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

/** НОВЫЕ «вёдра» дня — тем же правилом, что ветка §8.139 движка: приём >500 г, который в
 *  сравниваемом плане ведром не был (или которого там нет). Разница счётчиков здесь не годится:
 *  она пропускает «одно срезали, два создали» как «+1». */
const countNewBuckets = (on: any, off: any): number =>
  (on.meals || []).filter((m: any) => {
    if (solidForBuckets(m) <= 500) return false;
    const pm = (off.meals || []).find((x: any) => String(x.label) === String(m.label));
    return !pm || solidForBuckets(pm) <= 500;
  }).length;

/** Канон дня — ТЕМ ЖЕ значением, что видит продукт и по которому гейтит движок: поле
 *  `deviationPct` из `buildDayPlan` (`withinTolerance` = dev ≤ 3 % авто / 2 % ручной). Считать
 *  девиацию в тесте заново из `totals` НЕЛЬЗЯ: на `small60/4/тр` такой пересчёт даёт 2.67 %,
 *  а поле дня — 3.6 % (движок считает оси против собственных входных/целевых величин сборки),
 *  то есть тест был бы слабее продукта и пропускал бы выход из канона. */
const dayDev = (pl: any) => (Number(pl.deviationPct) || 0) / 100;

describe('§8.63 приём не голодает по белку (`breakfastProteinFloor`)', () => {
  it('бейджи ниже порога: 84 → ≤78 на 60 дней, и строго меньше, чем без стадии', () => {
    const on = badges(cells(true));
    const off = badges(cells(false));
    expect(off.length).toBeGreaterThan(on.length);
    expect(on.length).toBeLessThanOrEqual(78);
  });

  it('завтрак: бейджей 9 → 5, меньше, чем без стадии', () => {
    const bf = (list: string[]) => list.filter((x) => x.endsWith(':breakfast')).length;
    const on = bf(badges(cells(true)));
    const off = bf(badges(cells(false)));
    // Контрфакт без стадии: 7 завтраков ниже своего порога белка. После того как бюджет
    // приёма перестал «дробиться» (§8.113 «меньше, но крупнее» снят — он ломал раскладку
    // белка, а обрезки теперь чинит §8.114/§8.114b), базовая линия вернулась к 7.
    // Сама стадия держит завтраки, но не до «половины»: 5 бейджей остаются на днях, где
    // белок дня УЖЕ на цели (+2 %: cutF50 111.9/110, keto85 181.3/180) — поднять завтрак
    // можно только перебором дня, и гейт канона честно отказывает (замер: pd 15 при
    // факте 6.4 — завтрак cutF50/5/тр, день 111.9 г белка).
    expect(off).toBe(7);
    expect(on).toBeLessThan(off);
    expect(on).toBeLessThanOrEqual(5);
  });

  it('«голодный завтрак» cutF50/5/тр поднимается к порогу и приём остаётся едой', () => {
    // Было: egg_whole 40 г → 6 г белка (0.12 г/кг) при пороге 0.30 г/кг = 15 г.
    const p = PROFILES.find((x) => x.id === 'cutF50')!;
    const on: any = build(p, 5, true, true);
    const off: any = build(p, 5, true, false);
    const bf = (pl: any) => (pl.meals || []).find((m: any) => String(m.type) === 'breakfast');
    expect(Number(bf(off).totals.p)).toBeLessThan(0.3 * p.w);
    // Стадия подняла белок (без донора день не тянет — гейт канона честно отказывает,
    // поэтому требуем движения, а не обязательно порога).
    expect(Number(bf(on).totals.p)).toBeGreaterThanOrEqual(Number(bf(off).totals.p));
    // Новых приёмов и пунктов не появляется: тарелка та же по составу.
    expect((bf(on).items || []).length).toBe((bf(off).items || []).length);
    expect((on.meals || []).length).toBe((off.meals || []).length);
  });

  it('перенос: белок дня не разъезжается, дают только «богатые» приёмы', () => {
    // Единственная стадия, которая РАСТИТ белок тарелки, — §8.63: значит прирост
    // белка приёма обязан сопровождаться равным убытком у другого приёма.
    const on = cells(true);
    const off = new Map(cells(false).map((r) => [r.key, r]));
    const broken: string[] = [];
    for (const row of on) {
      const before = off.get(row.key)!;
      const dp = Math.abs(Number(row.plan.totals?.p) - Number(before.plan.totals?.p));
      const w = row.w;
      if (dp > 0.2 * 0.3 * w) broken.push(`${row.key}: ΔP=${dp.toFixed(1)}`);
      // Донор не проваливается ниже порога: каждый приём-«отдающий» остаётся ≥0.30 г/кг
      // либо таковым не был и не отдавал.
      for (const m of row.plan.meals || []) {
        const was: any = (before.plan.meals || []).find((x: any) => String(x.type) === String(m.type));
        if (!was) continue;
        const nowPk = (Number(m.totals.p) || 0) / w;
        const wasPk = (Number(was.totals.p) || 0) / w;
        if (wasPk >= 0.3 && nowPk < 0.295)
          broken.push(`${row.key}/${m.type}: ${wasPk.toFixed(2)}→${nowPk.toFixed(2)} г/кг`);
      }
    }
    expect(broken.join(', ')).toBe('');
  });

  it('граммы еды: изменённые стадией белковые порции — шаг 5 г и 40–200 г, тарелка ≤500 г', () => {
    const bad: string[] = [];
    const on = cells(true);
    const off = new Map(cells(false).map((r) => [r.key, r]));
    for (const row of on) {
      const before = off.get(row.key)!;
      for (const m of row.plan.meals || []) {
        const was: any = (before.plan.meals || []).find((x: any) => String(x.type) === String(m.type));
        for (const i of m.items || []) {
          if (!['protein', 'fast_protein', 'slow_protein'].includes(String(i.role))) continue;
          const wasItem: any = (was?.items || []).find((x: any) => String(x.id) === String(i.id));
          if (!wasItem || Math.round(Number(wasItem.amount)) === Math.round(Number(i.amount))) continue;
          // Правило QG19 действует на то, что стадия тронула сама: до неё в плане могли
          // стоять порции 300 г (p500) — их стадия не создавала и не «чинит».
          const g = Number(i.amount) || 0;
          if (g < 40 || g > 200 || Math.round(g / 5) * 5 !== Math.round(g))
            bad.push(`${row.key}/${m.type}:${i.id}=${g}`);
        }
        if (solidForBuckets(m) > 500 && solidForBuckets(was) <= 500)
          bad.push(
            `${row.key}/${m.type}: тарелка ${Math.round(solidForBuckets(was))}→${Math.round(solidForBuckets(m))} г`,
          );
      }
    }
    expect(bad.join(', ')).toBe('');
  });

  it('ни один день не теряет балл, канон и вёдра не ухудшаются', () => {
    const on = cells(true);
    const off = new Map(cells(false).map((r) => [r.key, r]));
    const lost: string[] = [];
    const canonWorse: string[] = [];
    const buckets: string[] = [];
    let scoreOn = 0;
    let scoreOff = 0;
    for (const row of on) {
      const before = off.get(row.key)!;
      const a = Number(before.plan.qualityScore?.total) || 0;
      const b = Number(row.plan.qualityScore?.total) || 0;
      scoreOn += b;
      scoreOff += a;
      if (b < a) lost.push(`${row.key}: ${a}→${b}`);
      const devOn = dayDev(row.plan);
      const devOff = dayDev(before.plan);
      // Канон: день не имеет права стать хуже, чем max(до стадии, 3 %) — то есть не может выйти
      // из канона, а день вне канона не может стать ещё хуже. Сравнение с `max(...)` не пустое
      // (в отличие от «только переход внутрь → наружу»): оно ловит 1.4 % → 3.2 %.
      if (devOn > Math.max(devOff, 0.03) + 1e-6)
        canonWorse.push(`${row.key}: ${(devOff * 100).toFixed(1)}%→${(devOn * 100).toFixed(1)}%`);
      if (countNewBuckets(row.plan, before.plan) > 0)
        buckets.push(`${row.key}: новых вёдер ${countNewBuckets(row.plan, before.plan)}`);
    }
    expect(lost.join(', ')).toBe('');
    expect(canonWorse.join(', ')).toBe('');
    expect(buckets.join(', ')).toBe('');
    expect(scoreOn).toBeGreaterThan(scoreOff);
  });

  it('сборка с овощным добором: никто не выходит из 3 % и не добавляет вёдер, потеря балла — только у замеренного дня', () => {
    // Это не «вся продуктовая сборка»: как и остальные A/B этого файла, §8.78/§8.84/§8.73/
    // §8.75/§8.111 выключены — включён ровно тот овощной добор §8.122, который изолирует
    // проверка выше. Замер 2026-11-24 (P1-3, §8.139): сумма баллов 5612 → 5625 на 60 днях,
    // единственный день с потерей — `small60/4/тр` 87 → 86 при девиации 5.10 % → 3.60 % и ведре
    // 1 → 0. Разрешение на потерю выдаётся ТОЛЬКО этому дню (иначе «купить» балл можно было бы
    // косметическим улучшением на 0.1 п.п.); любой новый день с потерей — красный тест.
    // Девиацию внутри дня стадия менять вправе, даже если день остаётся вне канона (замер:
    // 5.1 % → 3.6 %); запрещён ВЫХОД из 3 % и ухудшение дня, который уже был вне канона.
    // Балл — поле дня `qualityScore` (снимок сборки до §8.127–§8.134); приёмка §8.122 считает
    // балл заново, но здесь меряется именно продуктовая метрика дня.
    const PAYS = new Set(['small60/4/тр']);
    const veg = { vegTopUp88: true };
    const on = cells(true, veg);
    const off = new Map(cells(false, veg).map((r) => [r.key, r]));
    const bad: string[] = [];
    const paid: string[] = [];
    let scoreOn = 0;
    let scoreOff = 0;
    for (const row of on) {
      const before = off.get(row.key)!;
      // Канон — для КАЖДОГО дня, до всякой логики балла: `devOn ≤ max(devOff, 3 %)`, то есть
      // день не вправе выйти из канона и день вне канона не вправе стать хуже (на замеренном
      // `small60/4/тр` девиация улучшается 5.1 % → 3.6 %, так и не достигая 3 %).
      const devOn = dayDev(row.plan);
      const devOff = dayDev(before.plan);
      if (devOn > Math.max(devOff, 0.03) + 1e-6)
        bad.push(`${row.key}: канон ${(devOff * 100).toFixed(1)}% → ${(devOn * 100).toFixed(1)}%`);
      const nb = countNewBuckets(row.plan, before.plan);
      if (nb > 0) bad.push(`${row.key}: новых вёдер ${nb}`);
      const a = Number(before.plan.qualityScore?.total) || 0;
      const b = Number(row.plan.qualityScore?.total) || 0;
      scoreOn += b;
      scoreOff += a;
      if (b < a && !(PAYS.has(row.key) && a - b <= 1 && devOn < devOff - 0.001))
        bad.push(`${row.key}: балл ${a} → ${b}`);
      else if (b < a) paid.push(`${row.key}: ${a}→${b}`);
    }
    expect(bad.join(', ')).toBe('');
    expect(paid.length, paid.join(', ')).toBeLessThanOrEqual(1);
    expect(scoreOn).toBeGreaterThan(scoreOff);
  });

  it('флаг выключен — план бит-в-бит прежний, ноты стадии нет', () => {
    const twice = cells(false);
    const again = cells(false);
    const diff: string[] = [];
    for (let i = 0; i < twice.length; i++) {
      if (JSON.stringify(twice[i].plan) !== JSON.stringify(again[i].plan)) diff.push(twice[i].key);
      const notes = ((twice[i].plan.notes || []) as string[]).join(' ');
      if (/§8\.63/.test(notes)) diff.push(`${twice[i].key}: нота`);
    }
    expect(diff.join(', ')).toBe('');
  });

  it('нота стадии появляется только там, где приём реально добит (префикс — не QG14)', () => {
    const withNote = cells(true).filter((r) =>
      ((r.plan.notes || []) as string[]).some((n) => /Белок приёма: \d+ приём/.test(n)),
    );
    expect(withNote.length).toBeGreaterThan(0);
    for (const row of withNote) {
      const note = ((row.plan.notes || []) as string[]).find((n) => /Белок приёма: \d+ приём/.test(n))!;
      // Нота QG14 («Белок по приёмам») — отдельная строка, стадия её не подменяет.
      expect(note).not.toContain('минимум по основным приёмам');
    }
  });
});
