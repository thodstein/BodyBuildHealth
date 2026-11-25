import { describe, it, expect, beforeAll } from 'vitest';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';
import { assembleRecipeDay, rebalanceDayAfterRecipes, sumDayTotals } from '../planner-recipe-mode';

/**
 * §8.140 (P1-5) — честность чисел рецептурного дня.
 *
 * Дефект, который держит замок (замер 40 seeds × канон 2/3, §8.140 в
 * docs/NUTRITION-PLANNER-QUALITY-AUDIT-2026-10.md):
 *
 *  1) финальный грамм-трим квот (`trimQuotaOverflow`: орехи/семена, масла, яйца) менял
 *     `amount` через `scaleItem`, но НЕ пересчитывал `m.totals`. Отчёт дня читал фантомные
 *     макросы: «✓ Корректор: 4.8% → 1.5%» — а фактический день 7.1 %. На сетке этого файла трим
 *     срабатывает в 7 днях из 80, и без пересчёта каждый такой день отчитывался не тем числом.
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
 * `planner-recipe-mode.ts:4991–4998`): двусторонний по ккал/Ж/У + НЕДОБОР белка (§8.91).
 * Ревью 2026-11-25 предлагало двусторонний белок — отклонено: отчётное `deviationPct`
 * (`:4989–4999`) считает полом, двусторонняя формула даёт 37 «расхождений» на переборе белка,
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
        grid.push({
          canon,
          seed: s,
          mealMismatch,
          devReported: Number(res.deviationPct) || 0,
          devFact: Math.round(floorDev(factTot, targets) * 10) / 10,
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

  it('withinTolerance не обещает канон на фантоме', () => {
    const bad = grid.filter((r) => r.within && r.devFact > r.canon + 0.2);
    const report = bad
      .slice(0, 6)
      .map((r) => {
        const closer = r.notes.find((n) => /Корректор дневных целей/.test(n)) || '—';
        return `canon=${r.canon} seed=${r.seed}: within=true, факт ${r.devFact}% (${closer})`;
      })
      .join('\n');
    expect(bad.length, `дней с «в каноне» на фантоме: ${bad.length}\n${report}`).toBe(0);
  });

  // Замок честности чисел может быть зелёным «по пустоте»: если на сетке не срабатывает ни один
  // трим, ни один шаг посадки или нет ни одного дня «в каноне», три проверки выше ничего не
  // доказывают. Замер 2026-11-25: трим — 7/80 дней, шаг посадки — 39/80 (134 шага), «в каноне» —
  // 23 дня канона 2 % + 35 дней канона 3 % = 58/80. Нижние границы держат сетку живой, не
  // прибивая её: они ниже замера в разы, поэтому законная правка движка их не снимает.
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
});
