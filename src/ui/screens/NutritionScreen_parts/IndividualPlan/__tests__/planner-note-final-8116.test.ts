/**
 * planner-note-final-8116.test.ts — §8.116: «витрина не врёт» в ПОСЛЕДНЕЙ точке конвейера.
 *
 * Дефект (замер сетки 336 дней, HEAD 1cac5332a):
 *  • нота «📐 Белок N г при цели M г» печатается в середине сборки (§8.91), а последняя миля
 *    §8.111 и ремонт §8.114/§8.114b меняют граммы белка ПОСЛЕ неё — 3 дня авто и 1 ручной
 *    печатали «Белок 86 г» при факте 83 г; на предельном дне (55 кг / 6 приёмов / 275 У) —
 *    «96» при факте 89 г;
 *  • нота «Белок по приёмам: 26/9/16/10/19 г» на `45/6/T/maint/manual` расходилась с
 *    тарелками 21/6/9/16/1/10/19 (приём с 1 г белка выпал из списка): строка пересобиралась
 *    до реанимации §8.115, которая перекладывает белок между приёмами.
 *
 * Правило §8.116: в последней точке (сразу после `mergeDuplicateItems` + `_resyncMps`,
 * когда тарелки больше не меняются) обе строки пересчитываются по ФАКТУ:
 *  • «📐 Белок» несёт фактические граммы дня и показывается только если факт реально выше
 *    цели >2 % (иначе строка «день выше вашей цифры» — ложь, и она снимается);
 *  • «Белок по приёмам / равномерно» пересобирается тем же `_refreshProteinNote` — список
 *    чисел ровно по основным приёмам (без peri-окон), как их видит пользователь на тарелках.
 *
 * Замок: сетка 168 авто + 168 ручных дней, каждая строка сверяется с `plan.totals` и
 * `meal.totals.p` финального плана. Адресного долга нет: любая расходимость валит замок.
 *
 * Замер после §8.116: «📐 Белок» осталась на 2 днях авто и 0 ручных — на остальных днях
 * перебора >2 % нет, и строка снята (она утверждала бы «день выше вашей цифры» без причины);
 * «Белок по приёмам / равномерно» печатается 168/168 в каждом пути и совпадает с тарелками.
 */
import { describe, expect, it } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

const atwater = (p: number, f: number, c: number) => Math.round(4 * p + 9 * f + 4 * c);

const GOALS: Record<'cut' | 'maint' | 'mass', [number, number, number]> = {
  cut: [2.0, 0.8, 2.2], maint: [1.8, 1.0, 3.0], mass: [1.8, 1.0, 4.2],
};

const PERI = ['preworkout', 'postworkout', 'intra'];

type Row = {
  key: string;
  /** нарушения ноты «📐 Белок N г при цели M г» */
  belokBad: string[];
  /** нарушения ноты «Белок по приёмам / равномерно» */
  spreadBad: string[];
  hasBelok: boolean;
  hasSpread: boolean;
};

const buildGrid = (manual: boolean): Row[] => {
  const rows: Row[] = [];
  let i = 0;
  for (const w of [45, 55, 70, 85, 100, 115, 130]) {
    for (const mc of [3, 4, 5, 6]) {
      for (const tr of [true, false]) {
        for (const goal of ['cut', 'maint', 'mass'] as const) {
          const [gp, gf, gc] = GOALS[goal];
          const p = Math.round(w * gp); const f = Math.round(w * gf); const c = Math.round(w * gc);
          const input = {
            weightKg: w, lbmKg: Math.round(w * 0.82), bodyFatPct: 18, sex: 'male',
            goalKcal: atwater(p, f, c), goalProteinG: p, goalFatG: f, goalCarbsG: c,
            mealsCount: mc, isTrainingDay: tr,
            trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75, allowIntraWorkout: true,
            budget: 'medium', dayOffset: i % 7, cyclePhase: 'none', variety: 'medium',
            goal, quality: 'full',
            excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: i % 3,
            ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
          } as unknown as MealPlanInput;
          const plan: any = buildDayPlan(input);
          const key = `${w}/${mc}/${tr ? 'T' : 'R'}/${goal}${manual ? '/manual' : ''}`;
          const notes: string[] = (plan.notes || []).map((n: any) => String(n));
          const factP = Math.round(Number(plan.totals?.p) || 0);
          const factRaw = Number(plan.totals?.p) || 0;

          const belokBad: string[] = [];
          const belok = notes.find((n) => /^📐 Белок \d+ г при цели \d+ г/.test(n));
          if (belok) {
            const m = belok.match(/^📐 Белок (\d+) г при цели (\d+) г/);
            const shown = Number(m?.[1] || 0);
            const goalP = Number(m?.[2] || 0);
            if (Math.abs(shown - factP) > 1) {
              belokBad.push(`«${shown}» vs факт ${factP}`);
            }
            if (!(factRaw > goalP * 1.02)) {
              belokBad.push(`нота есть, а перебора нет: факт ${factRaw.toFixed(1)} ≤ цели ${goalP} +2 %`);
            }
          }

          const spreadBad: string[] = [];
          const spread = notes.find((n) => /^(Белок по приёмам|Белок равномерно): [\d/]+ г/.test(n));
          if (spread) {
            const mm = spread.match(/^(?:Белок по приёмам|Белок равномерно): ([\d/]+) г/);
            const vals = (mm?.[1] || '').split('/').filter(Boolean).map(Number);
            const mains = (plan.meals || []).filter((m: any) => !PERI.includes(String(m.type))
              && (Number(m?.totals?.p) || 0) > 0);
            const facts = mains.map((m: any) => Math.round(Number(m?.totals?.p) || 0));
            if (vals.length !== facts.length) {
              spreadBad.push(`${vals.length} чисел (${vals.join('/')}) при ${facts.length} приёмах с белком (${facts.join('/')})`);
            } else if (facts.some((v: number, k: number) => v !== vals[k])) {
              spreadBad.push(`«${vals.join('/')}» vs тарелки ${facts.join('/')}`);
            }
          }

          rows.push({
            key, belokBad, spreadBad,
            hasBelok: Boolean(belok), hasSpread: Boolean(spread),
          });
          i++;
        }
      }
    }
  }
  return rows;
};

const AUTO = buildGrid(false);
const MANUAL = buildGrid(true);

const check = (rows: Row[], label: string, minBelok: number) => {
  expect(rows.length, `${label}: сетка не собрана`).toBe(168);
  const belok = rows.flatMap((r) => r.belokBad.map((b) => `${r.key}: ${b}`));
  const spread = rows.flatMap((r) => r.spreadBad.map((b) => `${r.key}: ${b}`));
  expect(belok.join('; '), `${label}: «📐 Белок» расходится с фактом`).toBe('');
  expect(spread.join('; '), `${label}: «Белок по приёмам» расходится с тарелками`).toBe('');
  // Замок не должен быть пустым: нота раскладки печатается почти всегда.
  expect(rows.filter((r) => r.hasSpread).length, `${label}: нота раскладки белка пропала`)
    .toBeGreaterThan(140);
  // §8.116: когда перебора нет, строка «день выше вашей цифры» снимается — в ручном пути
  // (цель белка соблюдается в 3 %) её больше нет вовсе; в авто она остаётся только на днях,
  // где MPS-полы реально вытолкнули белок выше цели >2 %.
  expect(rows.filter((r) => r.hasBelok).length, `${label}: нота «📐 Белок» пропала`)
    .toBeGreaterThanOrEqual(minBelok);
};

describe('§8.116 витрина не врёт: ноты белка пересчитаны по финальной тарелке', () => {
  it('авто-путь: «📐 Белок» и «Белок по приёмам» совпадают с фактом на всех 168 днях', () => {
    check(AUTO, 'авто', 1);
  });

  it('ручной путь: «📐 Белок» и «Белок по приёмам» совпадают с фактом на всех 168 днях', () => {
    check(MANUAL, 'ручной', 0);
  });

  it('адресные дни замера §8.116 больше не расходятся', () => {
    const keys = ['45/4/T/mass', '45/6/T/maint', '45/6/R/mass', '45/6/T/maint/manual'];
    const all = [...AUTO, ...MANUAL];
    for (const k of keys) {
      const row = all.find((r) => r.key === k);
      expect(row, `день ${k} не найден в сетке`).toBeTruthy();
      expect([...(row as Row).belokBad, ...(row as Row).spreadBad].join('; '), `день ${k}`).toBe('');
    }
  });
});
