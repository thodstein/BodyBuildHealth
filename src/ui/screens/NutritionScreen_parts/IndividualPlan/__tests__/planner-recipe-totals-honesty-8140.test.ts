import { describe, it, expect, beforeAll } from 'vitest';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';
import {
  assembleRecipeDay,
  rebalanceDayAfterRecipes,
  sumDayTotals,
  totalsAfterGramChange,
  trimQuotaOverflowForDay,
} from '../planner-recipe-mode';
import { stapleFamilyOf } from '../food-availability';

/**
 * §8.140 (P1-5) — честность чисел рецептурного дня.
 *
 * Дефект, который держит замок (замер 40 seeds × канон 2/3, §8.140 в
 * docs/NUTRITION-PLANNER-QUALITY-AUDIT-2026-10.md):
 *
 *  1) финальный грамм-трим квот (`trimQuotaOverflow`: орехи/семена, масла, яйца) менял
 *     `amount` через `scaleItem`, но НЕ пересчитывал `m.totals`. Отчёт дня читал фантомные
 *     макросы: «✓ Корректор: 4.8% → 1.5%» — а фактический день 7.1 %. На сетке этого файла трим
 *     срабатывает в 14 днях из 80, и без пересчёта каждый такой день отчитывался не тем числом.
 *  2) посадка ядер решала шаг по РАСЧЁТНОМУ `bestDev`, а применяла округлённые граммы
 *     (`scaleItem` пересчитывает ккал из формулы) — трасса «расчёт 2.94 % → факт 3.05 %».
 *
 * Инварианты, которые проверяются на сетке:
 *  - `m.totals` каждого непустого приёма = сумма его позиций (в пределах округления);
 *  - отчётное `deviationPct` = отклонение, пересчитанное по фактическим позициям;
 *  - `withinTolerance === true` не может стоять на дне, чьё фактическое отклонение > канона.
 */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SNACK_POOL = ['walnuts', 'banana', 'cottage_cheese_5', 'oats', 'almonds', 'kefir', 'apple', 'rice_cakes'];
const mkItem = (id: string, amount: number) => {
  const f = FOOD_DB.find((x: any) => x.id === id)!;
  const r = amount / 100;
  return {
    name: f.name,
    id,
    amount,
    kcal: Math.round((f.kcal || 0) * r),
    p: Math.round((f.protein || 0) * r * 10) / 10,
    f: Math.round((f.fat || 0) * r * 10) / 10,
    c: Math.round((f.carbs || 0) * r * 10) / 10,
  };
};

function buildDay(seed: number, targets: { kcal: number; p: number; f: number; c: number }) {
  const rand = rng(seed);
  const snacks = [0, 1].map((si) => {
    const items = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => {
      const id = SNACK_POOL[Math.floor(rand() * SNACK_POOL.length)];
      return mkItem(id, 30 + Math.floor(rand() * 12) * 10);
    });
    return {
      label: si === 0 ? 'Перекус' : 'Перед сном',
      type: si === 0 ? 'snack' : 'presleep',
      items,
      totals: {
        kcal: items.reduce((s, i) => s + i.kcal, 0),
        p: items.reduce((s, i) => s + i.p, 0),
        f: items.reduce((s, i) => s + i.f, 0),
        c: items.reduce((s, i) => s + i.c, 0),
      },
    };
  });
  const mains = ['Завтрак', 'Обед', 'Ужин'].map((label, mi) => {
    const share = [0.25, 0.35, 0.3][mi];
    return {
      label,
      type: ['breakfast', 'lunch', 'dinner'][mi],
      items: [],
      totals: { kcal: 0, p: 0, f: 0, c: 0 },
      target: {
        p: Math.round(targets.p * share),
        f: Math.round(targets.f * share),
        c: Math.round(targets.c * share),
      },
    };
  });
  return [mains[0], snacks[0], mains[1], snacks[1], mains[2]];
}

/**
 * Отклонение дня так, как его считает сам рецептурный контур (`_floorDev`,
 * `planner-recipe-mode.ts:5053–5059`): двусторонний по ккал/Ж/У + НЕДОБОР белка (§8.91).
 * Ревью 2026-11-25 предлагало двусторонний белок — отклонено: отчётное `deviationPct`
 * (`:5114`) считает полом, двусторонняя формула даёт 37 «расхождений» на переборе белка,
 * которого отчёт не обещает.
 */
const floorDev = (t: any, tg: any): number => {
  const dk = (Math.abs((t.kcal || 0) - (tg.kcal || 0)) / Math.max(1, tg.kcal || 1)) * 100;
  const dpUnder = (Math.max(0, (tg.p || 0) - (t.p || 0)) / Math.max(1, tg.p || 1)) * 100;
  const df = (Math.abs((t.f || 0) - (tg.f || 0)) / Math.max(1, tg.f || 1)) * 100;
  const dc = (Math.abs((t.c || 0) - (tg.c || 0)) / Math.max(1, tg.c || 1)) * 100;
  return Math.max(dk, dpUnder, df, dc);
};

const sumItems = (m: any) =>
  ((m.items || []) as any[]).reduce(
    (a: any, x: any) => ({
      kcal: a.kcal + (Number(x.kcal) || 0),
      p: a.p + (Number(x.p) || 0),
      f: a.f + (Number(x.f) || 0),
      c: a.c + (Number(x.c) || 0),
    }),
    { kcal: 0, p: 0, f: 0, c: 0 },
  );

const SEEDS = 40;
const CANONS = [3, 2];

describe('§8.140 P1-5: числа рецептурного дня честные', () => {
  const pool = getRecipes();
  const grid: Array<{
    canon: number;
    seed: number;
    mealMismatch: string[];
    devReported: number;
    devFact: number;
    /** §8.143 п. 8(2): неокруглённое отклонение — только по нему судится флаг `withinTolerance`. */
    devFactRaw: number;
    within: boolean;
    trimmed: boolean;
    scaled: boolean;
    notes: string[];
  }> = [];

  beforeAll(() => {
    for (const canon of CANONS) {
      for (let s = 0; s < SEEDS; s++) {
        const rand = rng(1000 + s);
        const kcalT = 1800 + Math.floor(rand() * 8) * 200;
        const weight = 70 + (s % 5) * 10;
        const targets = {
          kcal: kcalT,
          p: Math.round(weight * 2),
          f: Math.round((kcalT * 0.27) / 9),
          c: Math.round((kcalT - weight * 2 * 4 - kcalT * 0.27) / 4),
        };
        const res = assembleRecipeDay({
          meals: buildDay(s, targets) as any,
          pool,
          targets,
          excludedIds: new Set<string>(),
          maxPrepTimeMin: 120,
          isVegetarian: false,
          usedNamesAcrossDays: new Set<string>(),
          goal: 'mass',
          canonPct: canon,
          athleteWeightKg: weight,
        } as any);

        const mealMismatch: string[] = [];
        for (const m of res.meals as any[]) {
          if ((m.items || []).length === 0) continue;
          const si = sumItems(m);
          const dk = Math.abs((m.totals?.kcal || 0) - si.kcal);
          const dp = Math.abs((m.totals?.p || 0) - si.p);
          const df = Math.abs((m.totals?.f || 0) - si.f);
          const dc = Math.abs((m.totals?.c || 0) - si.c);
          if (dk > 1 || dp > 0.25 || df > 0.25 || dc > 0.25) {
            mealMismatch.push(
              `${String(m.label)}: totals ${Math.round(m.totals?.kcal || 0)}/` +
                `${(m.totals?.p || 0).toFixed(1)}/${(m.totals?.f || 0).toFixed(1)}/${(m.totals?.c || 0).toFixed(1)} vs ` +
                `позиции ${Math.round(si.kcal)}/${si.p.toFixed(1)}/${si.f.toFixed(1)}/${si.c.toFixed(1)}`,
            );
          }
        }
        const factTot = (res.meals as any[]).reduce(
          (a: any, m: any) => {
            const si = sumItems(m);
            return { kcal: a.kcal + si.kcal, p: a.p + si.p, f: a.f + si.f, c: a.c + si.c };
          },
          { kcal: 0, p: 0, f: 0, c: 0 },
        );
        // Контроль: тоталы дня, собранные из приёмов, совпадают с суммой позиций —
        // иначе «факт» самого замка был бы не фактом.
        const dayTot = sumDayTotals(res.meals as any);
        if (Math.abs(dayTot.kcal - factTot.kcal) > 2) {
          mealMismatch.push(`день: sumDayTotals ${Math.round(dayTot.kcal)} vs позиции ${Math.round(factTot.kcal)}`);
        }
        const devFactRaw = floorDev(factTot, targets);
        grid.push({
          canon,
          seed: s,
          mealMismatch,
          devReported: Number(res.deviationPct) || 0,
          devFact: Math.round(devFactRaw * 10) / 10,
          devFactRaw,
          within: !!res.withinTolerance,
          trimmed: (res.notes || []).some((n: any) => /^⚖️ (Орехи\/семена|Масла|Яйца):/.test(String(n))),
          scaled: (res.notes || []).some((n: any) => /^⚖️ Порция «/.test(String(n))),
          notes: (res.notes || []).map((n: any) => String(n)),
        });
      }
    }
    expect(grid).toHaveLength(SEEDS * CANONS.length);
  }, 600000);

  it('тоталы каждого приёма = сумма его позиций (нет фантомных макросов)', () => {
    const bad = grid.filter((r) => r.mealMismatch.length > 0);
    const report = bad
      .slice(0, 6)
      .map((r) => `canon=${r.canon} seed=${r.seed}: ${r.mealMismatch.join('; ')}`)
      .join('\n');
    expect(bad.length, `приёмов с фантомными тоталами: ${bad.length}\n${report}`).toBe(0);
  });

  it('отчётное отклонение дня = отклонение по фактическим позициям', () => {
    const bad = grid.filter((r) => Math.abs(r.devReported - r.devFact) > 0.15);
    const report = bad
      .slice(0, 6)
      .map((r) => `canon=${r.canon} seed=${r.seed}: отчёт ${r.devReported}% vs факт ${r.devFact}%`)
      .join('\n');
    expect(bad.length, `дней, где отчёт ≠ факт: ${bad.length}\n${report}`).toBe(0);
  });

  // §8.143 п. 8(2): вердикт судится НЕокруглённым отклонением. Раньше отчётное `_finDevR`
  // округлялось до 0.1, и день с фактом 2.022 % печатал «2 %» и проходил `<= 2` — флаг
  // «в допуске» стоял на дне ЗА каноном (единственный такой день сетки: seed 30, канон 2).
  // Теперь свойство двустороннее и точное: `within` истинно ровно тогда, когда фактическое
  // отклонение не больше канона. Мутация «вернуть округлённое сравнение» → красный на этом дне.
  it('withinTolerance — ровно «факт не больше канона», без округления и фантомов', () => {
    const bad = grid.filter((r) => !!r.within !== r.devFactRaw <= r.canon + 1e-9);
    const report = bad
      .slice(0, 6)
      .map((r) => {
        const closer = r.notes.find((n) => /Корректор дневных целей/.test(n)) || '—';
        return `canon=${r.canon} seed=${r.seed}: within=${r.within}, факт ${r.devFactRaw.toFixed(3)}% (${closer})`;
      })
      .join('\n');
    expect(bad.length, `дней, где флаг спорит с фактом: ${bad.length}\n${report}`).toBe(0);
  });

  // Замок честности чисел может быть зелёным «по пустоте»: если на сетке не срабатывает ни один
  // трим, ни один шаг посадки или нет ни одного дня «в каноне», три проверки выше ничего не
  // доказывают. Замер 2026-11-25 (после §8.143): трим — 14/80 дней, шаг посадки — 76/80,
  // «в каноне» — 65/80. Нижние границы держат сетку живой, не прибивая её: они ниже замера
  // в разы, поэтому законная правка движка их не снимает.
  it('сетка не вакуумна: трим квот и посадка срабатывают, дни «в каноне» есть', () => {
    const trimmed = grid.filter((r) => r.trimmed).length;
    const scaled = grid.filter((r) => r.scaled).length;
    const within = grid.filter((r) => r.within).length;
    expect(trimmed, `дней с тримом квот: ${trimmed}`).toBeGreaterThan(0);
    expect(scaled, `дней с шагом посадки: ${scaled}`).toBeGreaterThan(0);
    expect(within, `дней «в каноне»: ${within}`).toBeGreaterThanOrEqual(20);
  });

  // Вторая половина P1-5 (§8.140): шаг посадки судится ФАКТОМ. Прямой свидетель: день приходит
  // в посадку с ядром из позиций по 7 г, и любой шаг коридора ±3 % округляется в ноль
  // (`Math.round(7 × 1.03) = 7`). Аналитика такой шаг «улучшает» — раньше он применялся:
  // граммы не менялись, но печаталась нота «⚖️ Порция … для сходимости» и жёгся коридор
  // `cumScale`, после чего настоящий шаг в ту же сторону был уже запрещён. Мутации, которые
  // обязаны красить этот тест: `_calcOk` обратно на `fact <= devFinal` и поиск кандидата по
  // расчётному `dv` вместо `fact` (проверено 2026-11-25).
  it('шаг посадки, который округляется в ноль, не применяется и не врёт нотой', () => {
    const items = [{ name: 'Рис', id: 'rice_white', amount: 7, kcal: 25, p: 0.5, f: 0.1, c: 5.4 }];
    const totals = { kcal: 25, p: 0.5, f: 0.1, c: 5.4 };
    const day: any[] = [{ label: 'Обед', type: 'lunch', recipeApplied: 'Тест-рецепт', items, totals }];
    const targets = { kcal: 2000, p: 150, f: 60, c: 200 };
    const res = rebalanceDayAfterRecipes(day as any, targets as any, { maxIter: 0, canonPct: 3 } as any);
    // Сетка живая: день вне канона, иначе блок посадки не запускался бы и тест был бы вакуумным.
    expect(res.deviationPct).toBeGreaterThan(3);
    const scaledNotes = (res.notes || []).filter((n: any) => /⚖️ Порция «/.test(String(n)));
    expect(scaledNotes, `нот о шаге посадки: ${scaledNotes.join(' | ')}`).toHaveLength(0);
    const after = sumDayTotals(res.meals as any);
    expect(after.kcal).toBeCloseTo(totals.kcal, 5);
    expect(after.p).toBeCloseTo(totals.p, 5);
    expect(after.f).toBeCloseTo(totals.f, 5);
    expect(after.c).toBeCloseTo(totals.c, 5);
  });

  // §8.143: нота трима — свидетельство ФАКТА, а не намерения. Раньше `trimByFam` печатал
  // «приведено к квоте», как только сумма семьи превышала квоту, — даже когда каждый пункт
  // уже стоял на полу (`minG = 8` г у орехов) и ни один грамм не срезался. Свидетели на одном
  // пути: (а) контроль — 3 × 60 г орехов реально режутся и нота есть, иначе тест вакуумный;
  // (б) 16 × 8 г = 128 г при квоте 60 г, но floor(8 × 0.47) = 3 → max(8, 3) = 8 — резать
  // нечего, ноты быть не должно; (в) яйца режутся, но пол 50 г на яйцо не даёт дойти до
  // квоты — нота обязана сказать фактический остаток (5 × 60 = 300 при квоте 230 → 250),
  // а не «приведено к квоте»; (г) 5 × 50 = 250 г выше квоты, но каждый пункт на полу —
  // ноты нет. Мутации, которые обязаны красить тест: убрать `if (cut <= 0) return;` в
  // `trimByFam`; убрать `if (cut > 0)` у яиц; вернуть яйцам безусловную фразу «приведено
  // к квоте»; снять guard `_afterEggs <= eggCap + 1` (в).
  it('трим печатает ноту только когда граммы действительно срезаны', () => {
    const opts = { weightScale: 1, targetScale: 1, targets: { kcal: 2400, p: 160, f: 70, c: 280 } };
    const day = (amounts: number[]) => {
      const items = amounts.map((g) => mkItem('walnuts', g));
      const per = Math.ceil(items.length / 3);
      const meals: any[] = [
        { label: 'Завтрак', type: 'breakfast', recipeApplied: 'Тест-рецепт', items: items.slice(0, per), totals: {} },
        { label: 'Обед', type: 'lunch', items: items.slice(per, per * 2), totals: {} },
        { label: 'Ужин', type: 'dinner', items: items.slice(per * 2), totals: {} },
      ];
      meals.forEach((m) => (m.totals = sumItems(m)));
      return meals;
    };
    const eggDay = (amounts: number[]) => {
      const items = amounts.map((g) => mkItem('egg_whole', g));
      const per = Math.ceil(items.length / 2);
      const meals: any[] = [
        { label: 'Завтрак', type: 'breakfast', items: items.slice(0, per), totals: {} },
        { label: 'Обед', type: 'lunch', items: items.slice(per), totals: {} },
      ];
      meals.forEach((m) => (m.totals = sumItems(m)));
      return meals;
    };
    const eggsG = (meals: any[]) =>
      meals
        .flatMap((m: any) => m.items || [])
        .filter((it: any) => it.id === 'egg_whole')
        .reduce((s: number, it: any) => s + (it.amount || 0), 0);
    const nutsG = (meals: any[]) =>
      meals
        .flatMap((m: any) => m.items || [])
        .filter((it: any) => ['nuts', 'seeds'].includes(stapleFamilyOf(it.id) || ''))
        .reduce((s: number, it: any) => s + (it.amount || 0), 0);

    // (а) Контроль: 180 г орехов выше квоты 60 г — трим живой, нота честная, тоталы пересчитаны.
    const heavy = day([60, 60, 60]);
    const heavyNotes = trimQuotaOverflowForDay(heavy as any, opts as any);
    expect(heavyNotes, `нот трима: ${heavyNotes.join(' | ')}`).toHaveLength(1);
    expect(heavyNotes[0]).toContain('Орехи/семена');
    expect(nutsG(heavy), 'граммы орехов должны уменьшиться').toBeLessThan(180);
    heavy.forEach((m) => expect(m.totals.kcal).toBeCloseTo(sumItems(m).kcal, 5));

    // (б) Свидетель: всё на полу 8 г — срезать нечего, нота была бы ложью.
    const floored = day(Array.from({ length: 16 }, () => 8));
    const flooredNotes = trimQuotaOverflowForDay(floored as any, opts as any);
    expect(nutsG(floored), 'граммы орехов не должны меняться').toBe(128);
    expect(flooredNotes, `ложных нот трима: ${flooredNotes.join(' | ')}`).toHaveLength(0);

    // (в) Яйца: 5 × 60 = 300 г > 230, floor(60 × 0.767) = 46 → пол 50 г ⇒ факт 250 г.
    // Нота обязана назвать 250 г, а не обещать квоту 230.
    const eggHeavy = eggDay([60, 60, 60, 60, 60]);
    const eggHeavyNotes = trimQuotaOverflowForDay(eggHeavy as any, opts as any);
    expect(eggHeavyNotes, `нот трима яиц: ${eggHeavyNotes.join(' | ')}`).toHaveLength(1);
    expect(eggsG(eggHeavy), 'яйца должны урезаться до пола').toBe(250);
    expect(eggHeavyNotes[0]).toContain('урезано до 250 г');
    expect(eggHeavyNotes[0]).not.toContain('приведено к квоте');
    eggHeavy.forEach((m) => expect(m.totals.kcal).toBeCloseTo(sumItems(m).kcal, 5));

    // (г) Яйца: 5 × 50 = 250 г выше квоты, но каждый пункт на полу — ноты нет.
    const eggFloored = eggDay([50, 50, 50, 50, 50]);
    const eggFlooredNotes = trimQuotaOverflowForDay(eggFloored as any, opts as any);
    expect(eggsG(eggFloored), 'граммы яиц не должны меняться').toBe(250);
    expect(eggFlooredNotes, `ложных нот яиц: ${eggFlooredNotes.join(' | ')}`).toHaveLength(0);

    // (д) Достижимая квота: 2 × 40 = 80 г при квоте 60 → floor(40 × 0.75) = 30, пол не мешает,
    // шаг доходит до квоты — нота обязана быть «приведено к квоте», не «урезано до».
    const nutsReach = day([40, 40]);
    const nutsReachNotes = trimQuotaOverflowForDay(nutsReach as any, opts as any);
    expect(nutsG(nutsReach), 'орехи должны дойти до квоты').toBe(60);
    expect(nutsReachNotes, `ноты: ${nutsReachNotes.join(' | ')}`).toHaveLength(1);
    expect(nutsReachNotes[0]).toContain('приведено к квоте 60 г/день');

    // (е) Натрий после среза: `scaleItem` переносит `na` СТАРОЙ порции — соль осталась бы от
    // прежней тарелки. Пункт без записи в FOOD_DB (`naAfterResize` идёт пропорционально):
    // 60 г с na 20 → 24 г (шаг 60 %), na = round(20 × 24/60) = 8, а не 20. И `totals.na`
    // приёма = сумма позиций.
    const saltDay: any[] = [
      {
        label: 'Завтрак',
        type: 'breakfast',
        items: [
          { id: 'test_nuts', name: 'Тест-орехи', amount: 60, kcal: 390, p: 8, f: 38, c: 8, na: 20 },
          { id: 'test_nuts', name: 'Тест-орехи', amount: 60, kcal: 390, p: 8, f: 38, c: 8, na: 20 },
          { id: 'test_nuts', name: 'Тест-орехи', amount: 60, kcal: 390, p: 8, f: 38, c: 8, na: 20 },
        ],
        totals: { kcal: 1170, p: 24, f: 114, c: 24, na: 60 },
      },
    ];
    const saltNotes = trimQuotaOverflowForDay(saltDay as any, opts as any);
    expect(saltNotes, `ноты: ${saltNotes.join(' | ')}`).toHaveLength(1);
    expect(saltDay[0].items[0].amount, 'граммы должны уменьшиться').toBeLessThan(60);
    expect(saltDay[0].items[0].na, 'соль должна уйти вместе с граммами').toBeLessThan(20);
    expect(saltDay[0].totals.na, 'тотал натрия = сумма позиций').toBe(
      saltDay[0].items.reduce((s: number, it: any) => s + (it.na || 0), 0),
    );
  });

  // §8.143 п. 6: канон ПУТИ доходит до свапа ядра через call-site `assembleRecipeDay`
  // (`canonPct: _canonPct` в opts `applyRecipeCoreSwap`). Замер этой же сетки (40 seeds):
  // наборы нот 🔄 расходятся на 7 seeds, свапов 50 (канон 2) против 43 (канон 3).
  // Свидетель — seed 7: при каноне 2 день 2.6 % и стадия срабатывает (1 нота 🔄), при каноне 3
  // день 2.7 %, ранний выход — 0 нот. Мутация «убрать `canonPct: _canonPct` из вызова»
  // → оба прогона судятся жёсткими 3 %, нот ноль в обоих → красный.
  it('канон пути доходит до свапа ядра (call-site `canonPct`)', () => {
    expect(grid, 'сетка должна быть собрана').toHaveLength(SEEDS * CANONS.length);
    const row = (canon: number) => grid.find((r) => r.canon === canon && r.seed === 7);
    const swapsOf = (r: any) => (((r && r.notes) || []) as string[]).filter((n) => /🔄/.test(n));
    const c2 = row(2);
    const c3 = row(3);
    expect(c2, 'нужен день seed 7 при каноне 2').toBeTruthy();
    expect(c3, 'нужен день seed 7 при каноне 3').toBeTruthy();
    // Контроль: стадия живая — на своём каноне день 2.6 % обязан получить попытку свапа.
    expect(swapsOf(c2).length, `канон 2: ${swapsOf(c2).join(' | ')}`).toBeGreaterThanOrEqual(1);
    // Свидетель проводки: при жёстких 3 % этот же день (2.7 %) в стадию не входит.
    expect(swapsOf(c3), `канон 3: ${swapsOf(c3).join(' | ')}`).toHaveLength(0);
  });

  // §8.143 п. 8(3): правки ГРАММОВ в рецептурном пути (трим квот, белковый добор в перекус,
  // ребаланс дня, чистка тарелки, замена блюда вариантом) ставили тоталы через `sumMealTotals`,
  // который не знает натрия: известный `totals.na` приёма исчезал (свидетель ниже — день,
  // где перекус нёс натрий). Правило собрано в `totalsAfterGramChange`: макросы из позиций +
  // поле `na`, если сумма позиций известна (> 0) — независимо от того, было ли поле раньше
  // (§10.6: старые экспорты без `totals.na` иначе теряли соль навсегда).
  it('пересчёт тоталов после правки граммов не теряет известный натрий', () => {
    const apple = (na?: number) =>
      ({
        id: 'apple',
        name: 'Яблоко',
        amount: 100,
        kcal: 40,
        p: 0.4,
        f: 0.2,
        c: 10,
        ...(na != null ? { na } : {}),
      }) as any;
    // (а) поле было, натрий позиций известен → сумма позиций (кэш составного блюда:
    // у продукта из FOOD_DB плотность важнее кэша — см. `planner-sodium-reader-8143`).
    const composite = (na: number) =>
      ({ id: 'zzz_composite_plate', name: 'Составное блюдо', amount: 100, kcal: 40, p: 4, f: 2, c: 3, na }) as any;
    const a = totalsAfterGramChange({
      items: [composite(5)],
      totals: { kcal: 40, p: 4, f: 2, c: 3, na: 40 } as any,
    });
    expect((a as any).na).toBe(5);
    // (б) поля не было, но позиции несут известный натрий → восстанавливается (§10.6):
    // импортированный план без `totals.na` больше не теряет соль на каждой пересборке.
    const b = totalsAfterGramChange({ items: [composite(5)], totals: { kcal: 40, p: 4, f: 2, c: 3 } as any });
    expect((b as any).na).toBe(5);
    // (в) поле было, но ни одна позиция не несёт известного натрия → поля НЕТ: честное
    // «не знаем» вместо прежнего числа (оно относилось к прежнему составу блюда), и не ноль.
    const unknown = { id: 'zzz_unknown_food', name: 'Неизвестно', amount: 100, kcal: 40, p: 1, f: 1, c: 1 } as any;
    const c = totalsAfterGramChange({ items: [unknown], totals: { kcal: 40, p: 1, f: 1, c: 1, na: 40 } as any });
    expect('na' in (c as any), 'неизвестный натрий не превращается в число').toBe(false);
    // (в2) поля не было и позиции неизвестны → поля нет (не ложный ноль).
    const c2 = totalsAfterGramChange({ items: [unknown], totals: { kcal: 40, p: 1, f: 1, c: 1 } as any });
    expect('na' in (c2 as any)).toBe(false);
    // (г) белок/углеводы пересчитаны из позиций — иначе добор не изменил бы день.
    const g = totalsAfterGramChange({ items: [apple(5)], totals: { kcal: 40, p: 0.4, f: 0.2, c: 10 } as any });
    expect(g.p, 'белок обязан пересчитаться из позиций').toBe(0.4);
  });

  // §8.143 п. 8(3), проводка: день, собранный рецептами, держит известный натрий приёма сквозь
  // все пересборки (ребаланс → корректор → тримы). Перекус входит в сборку с `na` 5 мг на 300 г
  // яблока; граммы меняются, и если хоть одна пересборка тоталов идёт через `sumMealTotals`
  // (мутация: `recalcMealTotals` в `day-target-corrector`), поле исчезает из выхода дня.
  // Второй свидетель — натрий ПОЗИЦИИ обязан масштабироваться вместе с граммами (`scaleItem`
  // в корректоре → `naAfterResize`): 5 мг на ужатой порции — соль «от прежней тарелки».
  it('день из рецептов держит натрий приёма сквозь пересборки', () => {
    const apple = FOOD_DB.find((f) => f.id === 'apple')!;
    const it0 = {
      name: apple.name,
      id: apple.id,
      amount: 300,
      kcal: Math.round((apple.kcal || 0) * 3),
      p: Math.round((apple.protein || 0) * 3 * 10) / 10,
      f: Math.round((apple.fat || 0) * 3 * 10) / 10,
      c: Math.round((apple.carbs || 0) * 3 * 10) / 10,
      na: 5,
    };
    const empty = (label: string, type: string, target: any) =>
      ({ label, type, items: [], totals: { kcal: 0, p: 0, f: 0, c: 0 }, target }) as any;
    const meals: any[] = [
      empty('Завтрак', 'breakfast', { p: 50, f: 15, c: 60 }),
      {
        label: 'Перекус',
        type: 'snack',
        items: [{ ...it0 }],
        totals: { kcal: it0.kcal, p: it0.p, f: it0.f, c: it0.c, na: 5 },
      },
      empty('Обед', 'lunch', { p: 60, f: 20, c: 80 }),
      empty('Ужин', 'dinner', { p: 50, f: 15, c: 60 }),
    ];
    const res = assembleRecipeDay({
      meals,
      pool: getRecipes(),
      targets: { kcal: 2200, p: 200, f: 70, c: 260 },
      excludedIds: new Set<string>(),
      maxPrepTimeMin: 120,
      isVegetarian: false,
      usedNamesAcrossDays: new Set<string>(),
      goal: 'mass',
      canonPct: 3,
      athleteWeightKg: 90,
    } as any);
    const snack = (res.meals as any[]).find((m) => m.label === 'Перекус');
    expect(snack, 'перекус обязан остаться в дне').toBeTruthy();
    expect(typeof snack.totals?.na, 'тотал натрия обязан дожить до выхода дня').toBe('number');
    expect(snack.totals.na).toBeGreaterThan(0);
    // Граммы перекуса изменились — натрий позиции масштабируется вместе с ними.
    const item = (snack.items || [])[0];
    expect(item.amount, 'перекус в этом замере обязан быть ужат').toBeLessThan(300);
    const expected = Math.round((5 * item.amount) / 300);
    expect(Math.abs((item.na || 0) - expected), `na позиции ${item.na} при ${item.amount} г`).toBeLessThanOrEqual(1);
    const sumItems = (snack.items || []).reduce((s: number, i: any) => s + (i.na || 0), 0);
    expect(Math.abs((snack.totals.na || 0) - Math.round(sumItems)), 'тотал натрия = сумма позиций').toBeLessThanOrEqual(
      1,
    );
  });
});
