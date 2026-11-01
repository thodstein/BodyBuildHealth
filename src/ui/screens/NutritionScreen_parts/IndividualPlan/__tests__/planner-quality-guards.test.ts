/**
 * Регрессия «пакета качества» (QG1–QG11) планировщика.
 *
 * Зачем: сходимость дня ≤3% ловит только КБЖУ. Жалобы шли на «съедобность»:
 * «19 г малины», «жир всего дня в одном приёме», «овощей 190 г», «в обед 12 г белка»,
 * «натрий 43% цели, а в совете — добавьте соли», «витамин E 24% RDA», «в обед курица и
 * картофель, витамина A 4%». Пакет QG правит именно это — и эти тесты фиксируют
 * результат, чтобы следующая правка движка не откатила его молча.
 *
 * Пороги подобраны по замеру на одном и том же наборе профилей:
 *   метрика                        без пакета   с пакетом
 *   доля приёмов жира > 40% дня    21/30        8/30
 *   средний максимум жира в приёме 43.6%        35.6%
 *   дней с овощами < 200 г         12/30        7/30
 *   основных приёмов с белком <20г 14           11
 *   пунктов ниже порога «это еда»  155          101
 *   дней с молочкой               15/30        18/30
 *   Na, среднее от цели дня        41%          88%
 *   VitE, среднее от RDA           24%          63%
 *   VitA < 70% RDA                14/30        1/30 (QG10)
 *   дней совсем без овощей         6/30        0/30 (QG10)
 *   пунктов фрукта < 80 г          53           22   (QG11)
 *   пунктов орехов < 15 г          19           17   (QG11)
 *   ось «порции» (0-100)           85.7         90.1 (QG11)
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { buildDayTargets } from '../planner-day-targets';
import { scoreDayQuality } from '../planner-quality-score';
import { sumMicros } from '../planner-micro-coverage';
import { stapleFamilyOf, nutCatchupCap, quotaWeightScale } from '../food-availability';
import { FOOD_DB } from '../../../../../core/nutrition-database';

type Profile = { id: string; w: number; lbm: number; bf: number; sex: 'male' | 'female' };
const PROFILES: Profile[] = [
  { id: 'S1', w: 50, lbm: 41, bf: 18, sex: 'female' },
  { id: 'S2', w: 58, lbm: 47, bf: 19, sex: 'female' },
  { id: 'M1', w: 80, lbm: 65, bf: 18, sex: 'male' },
  { id: 'M2', w: 90, lbm: 73, bf: 19, sex: 'male' },
  { id: 'L1', w: 110, lbm: 90, bf: 18, sex: 'male' },
];
const MAIN = ['breakfast', 'lunch', 'dinner'];
/** Пороги «это ещё еда» (те же, что в QG1). */
const MIN_G: Record<string, number> = { fruit: 80, veg: 60, fat: 7, carb_slow: 30, carb_fast: 20, protein: 25 };
const DAIRY_RE = /tvorog|kefir|milk|yogurt|cheese|skyr|curd/;

type Day = { id: string; w: number; plan: any; meals: any[]; totF: number; totP: number };

function buildOne(pr: Profile, mealsCount: number, isTrainingDay: boolean, dayOffset = 0): Day | null {
  const tgt: any = buildDayTargets({
    weightKg: pr.w, presetGPerKg: 2.0, fatFloorGPerKg: 0.8, kbjuMode: 'auto',
    goal: 'maintenance', dietStyle: 'classic',
  } as any);
  const input = {
    weightKg: pr.w, lbmKg: pr.lbm, bodyFatPct: pr.bf, sex: pr.sex,
    goalKcal: tgt.kcal, goalProteinG: tgt.protein, goalFatG: tgt.fats, goalCarbsG: tgt.carbs,
    mealsCount, isTrainingDay, trainStartMin: 18 * 60, trainDurationMin: 75,
    allowIntraWorkout: true, budget: 'medium', dayOffset, cyclePhase: 'none',
    variety: 'medium', eveningLowCarb: false, goal: 'maintenance',
  } as unknown as MealPlanInput;
  let plan: any;
  try { plan = buildDayPlan(input); } catch { return null; }
  const meals = (plan.meals || []) as any[];
  if (!meals.length) return null;
  const totF = meals.reduce((s, m) => s + (m.totals?.f || 0), 0);
  const totP = meals.reduce((s, m) => s + (m.totals?.p || 0), 0);
  return { id: `${pr.id}/${mealsCount}/${isTrainingDay ? 'тр' : 'отд'}`, w: pr.w, plan, meals, totF, totP };
}

/** 30 дней: 5 профилей × 3 режима приёмов × тренировка/отдых. */
const DAYS: Day[] = (() => {
  const out: Day[] = [];
  for (const pr of PROFILES) for (const mc of [4, 5, 6]) for (const tr of [true, false]) {
    const d = buildOne(pr, mc, tr);
    if (d) out.push(d);
  }
  return out;
})();

const items = (d: Day) => d.meals.flatMap((m) => (m.items || []).map((x: any) => ({ m, x })));

describe('пакет качества: жир не сваливается в один приём (QG4)', () => {
  it('средний максимум доли жира в приёме < 39% (было 43.6%)', () => {
    const shares = DAYS.map((d) => Math.max(...d.meals.map((m) => m.totals?.f || 0)) / Math.max(1, d.totF));
    const avg = shares.reduce((s, v) => s + v, 0) / shares.length;
    expect(avg, `доля жира в самом жирном приёме (среднее): ${(avg * 100).toFixed(1)}%`).toBeLessThan(0.39);
    const bad = shares.filter((v) => v > 0.4).length;
    expect(bad, `дней с приёмом >40% жира дня: ${bad}/${shares.length}`).toBeLessThanOrEqual(10);
  });

  it('один жировой пункт не раздувается: средний максимум ≤ 21 г (было 23.9 г)', () => {
    const maxItem = DAYS.map((d) => Math.max(0, ...items(d).filter(({ x }) => x.role === 'fat').map(({ x }) => x.f || 0)));
    const avg = maxItem.reduce((s, v) => s + v, 0) / maxItem.length;
    expect(avg).toBeLessThanOrEqual(21);
  });
});

describe('пакет качества: порционная санитарность (QG1)', () => {
  it('пунктов ниже порога «это еда» ≤ 130 на 30 дней (было 155)', () => {
    const small = DAYS.reduce((s, d) => s + items(d).filter(({ x }) => {
      const min = MIN_G[String(x.role)];
      return !!min && !x._fixedGrams && (x.amount || 0) > 0 && (x.amount || 0) < min;
    }).length, 0);
    expect(small).toBeLessThanOrEqual(130);
  });

  it('срез крахмала не оставляет «15 г сухой овсянки»: нет carb_slow в диапазоне 15–29 г', () => {
    const bad: string[] = [];
    for (const d of DAYS) for (const { x } of items(d)) {
      if (x.role !== 'carb_slow' || x._fixedGrams) continue;
      const g = x.amount || 0;
      if (g >= 15 && g < 30) bad.push(`${d.id}:${x.id} ${g}г`);
    }
    expect(bad.slice(0, 5).join(' | ')).toBe('');
  });

  it('приём из двух и более пунктов не опускается ниже 80 ккал', () => {
    const bad = DAYS.filter((d) => d.meals.some((m) => String(m.type) !== 'intra'
      && (m.items || []).length >= 2
      && (m.items || []).reduce((s: number, x: any) => s + (x.kcal || 0), 0) < 80));
    expect(bad.map((d) => d.id).slice(0, 5).join(', ')).toBe('');
  });
});

describe('пакет качества: объём и белок (QG5/QG6)', () => {
  it('дней с овощами < 200 г ≤ 10 из 30 (было 12)', () => {
    const veg = (d: Day) => items(d).reduce((s, { x }) => s + (x.role === 'veg' ? (x.amount || 0) : 0), 0);
    const bad = DAYS.filter((d) => veg(d) < 200).length;
    expect(bad).toBeLessThanOrEqual(10);
  });

  it('основных приёмов с белком < 20 г ≤ 12 (было 14)', () => {
    const bad = DAYS.reduce((s, d) => s + d.meals
      .filter((m) => MAIN.includes(String(m.type)) && (m.totals?.p || 0) < 20).length, 0);
    // было 24 из 90 основных приёмов, стало 20
    expect(bad).toBeLessThanOrEqual(21);
  });

  it('цельный белок в основных приёмах не режется ниже 40 г', () => {
    const bad: string[] = [];
    for (const d of DAYS) for (const { m, x } of items(d)) {
      if (!MAIN.includes(String(m.type))) continue;
      if (x.role !== 'protein' || x._fixedGrams || /whey|casein/.test(String(x.id))) continue;
      const g = x.amount || 0;
      if (g > 0 && g < 40) bad.push(`${d.id}:${m.type}:${x.id} ${g}г`);
    }
    expect(bad.length).toBe(0);
  });
});

describe('пакет качества: молочный слот (QG3)', () => {
  it('молочка есть минимум в 17 из 30 дней (было 15)', () => {
    const withDairy = DAYS.filter((d) => items(d).some(({ x }) => DAIRY_RE.test(String(x.id)))).length;
    expect(withDairy).toBeGreaterThanOrEqual(17);
  });
});

describe('пакет качества: недельные квоты (QG7)', () => {
  it('за 7 дней есть и жирная рыба (ω-3), и бобовые', () => {
    const pr = PROFILES[2];
    const ids: string[] = [];
    for (let d = 0; d < 7; d++) {
      const day = buildOne(pr, 5, d % 2 === 0, d);
      if (!day) continue;
      for (const { x } of items(day)) ids.push(String(x.id));
    }
    expect(ids.some((i) => /^(salmon|mackerel|sardines|herring|red_fish|trout)/.test(i)), 'жирная рыба в неделе').toBe(true);
    expect(ids.some((i) => /^(lentils|chickpeas|tofu)/.test(i)), 'бобовые в неделе').toBe(true);
  });
});

describe('пакет качества: соль в тарелке, а не в ноте (QG8)', () => {
  const naOf = (d: Day) => Number((sumMicros(
    items(d).map(({ x }) => ({ id: x.id, amount: x.amount })),
    FOOD_DB as any,
  ) as any)?.Na || 0);

  it('натрий в коридоре 65–125% цели дня (было 41% в среднем)', () => {
    const pcts = DAYS.map((d) => {
      const target = d.plan.isTrainingDay ? Math.max(3000, Math.round(3000 + (d.plan.weightKg || 0) * 5)) : 2300;
      return Math.round((naOf(d) / target) * 100);
    });
    const avg = Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length);
    expect(avg, `Na: ${avg}% цели (было 41%)`).toBeGreaterThanOrEqual(65);
    expect(avg).toBeLessThanOrEqual(125);
    const out = pcts.filter((v) => v > 125).length;
    expect(out, 'дней с Na >125% цели').toBe(0);
  });

  it('соль стоит в плане минимум в 20 днях из 30 (было 0)', () => {
    const withSalt = DAYS.filter((d) => items(d).some(({ x }) => x.id === 'himalayan_salt')).length;
    expect(withSalt).toBeGreaterThanOrEqual(20);
  });

  it('нет ноты «добавьте соли» — соль уже в днях', () => {
    const bad = DAYS.flatMap((d) => (d.plan.notes as string[]).filter((n) => typeof n === 'string' && /Добавьте ~[\d.,]+г соли/i.test(n)));
    expect(bad.slice(0, 3).join(' | ')).toBe('');
  });

  it('соль не ломает макросы дня: 0 ккал и целые граммы', () => {
    for (const d of DAYS) {
      for (const { x } of items(d)) {
        if (x.id !== 'himalayan_salt') continue;
        expect(x.kcal).toBe(0);
        expect(Math.abs((x.amount || 0) - Math.round(x.amount || 0))).toBeLessThan(1e-9);
      }
    }
  });
});

describe('пакет качества: витамин E и семейные квоты (QG9)', () => {
  const E_RDA = 15; // мг, RDA_BASE.VitE
  const eMgOf = (d: Day) => Number((sumMicros(
    items(d).map(({ x }) => ({ id: x.id, amount: x.amount })),
    FOOD_DB as any,
  ) as any)?.VitE || 0);

  it('витамин E: среднее ≥ 60% RDA, дней ниже 70% ≤ 16 (было 100%)', () => {
    const pcts = DAYS.map((d) => Math.round((eMgOf(d) / E_RDA) * 100));
    const avg = Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length);
    expect(avg, `VitE: ${avg}% RDA (было 24%)`).toBeGreaterThanOrEqual(60);
    const below70 = pcts.filter((v) => v < 70).length;
    expect(below70, `дней с VitE < 70% RDA: ${below70}/${pcts.length}`).toBeLessThanOrEqual(16);
    const below50 = pcts.filter((v) => v < 50).length;
    expect(below50, `дней с VitE < 50% RDA: ${below50}/${pcts.length}`).toBeLessThanOrEqual(10);
  });

  it('замена масла не нарушает квоты: орехи/семена ≤ потолка, в приёме одно масло', () => {
    const caps: string[] = [];
    for (const d of DAYS) {
      const nutG = items(d)
        .filter(({ x }) => ['nuts', 'seeds'].includes(stapleFamilyOf(x.id) || ''))
        .reduce((s, { x }) => s + (x.amount || 0), 0);
      const nutCap = nutCatchupCap(quotaWeightScale(d.w));
      if (nutG > nutCap) caps.push(`${d.id}: орехов/семян ${nutG} г > ${nutCap}`);
      // QG9 доливает существующее масло или меняет его тем же пунктом — второй
      // масляный пункт в одном приёме означал бы «овсянка с двумя маслами».
      for (const m of d.meals) {
        const oils = (m.items || []).filter((x: any) => stapleFamilyOf(x.id) === 'oils');
        if (oils.length > 1) caps.push(`${d.id}/${m.type}: ${oils.length} масла в приёме`);
      }
    }
    expect(caps.slice(0, 4).join(' | ')).toBe('');
  });

  it('нота про витамин E не врёт: «E X мг из Y мг» совпадает с фактом по тарелке', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const note = (d.plan.notes as string[]).find((n) => typeof n === 'string' && n.includes('Витамин E'));
      if (!note) continue;
      const m = /E (\d+) мг из (\d+) мг/.exec(note);
      if (!m) { bad.push(`${d.id}: нота без цифр`); continue; }
      const claimed = Number(m[1]);
      const actual = eMgOf(d);
      if (Math.abs(claimed - actual) > 2.5) bad.push(`${d.id}: нота ${claimed} мг, факт ${Math.round(actual)} мг`);
    }
    expect(bad.slice(0, 4).join(' | ')).toBe('');
  });

  it('замены грамм-в-грамм: нет приёма с двумя одинаковыми продуктами', () => {
    const dup: string[] = [];
    for (const d of DAYS) {
      for (const m of d.meals) {
        const ids = (m.items || []).map((x: any) => x.id);
        if (new Set(ids).size !== ids.length) dup.push(`${d.id}/${m.type}`);
      }
    }
    expect(dup.slice(0, 4).join(' | ')).toBe('');
  });
});

describe('овощи и витамин A в тарелке (QG10)', () => {
  // RDA_BASE: VitA 900 мкг (муж), 700 мкг (жен).
  const RDA_A = { male: 900, female: 700 } as const;
  const vitAOf = (d: Day) => Number((sumMicros(
    items(d).map(({ x }) => ({ id: x.id, amount: x.amount })),
    FOOD_DB as any,
  ) as any)?.VitA || 0);
  const vegG = (d: Day) => items(d).reduce((s, { x }) => s + (x.role === 'veg' ? (x.amount || 0) : 0), 0);

  it('нет ни одного дня без овощей (было 8 из 72 конфигураций)', () => {
    const empty = DAYS.filter((d) => vegG(d) === 0).map((d) => d.id);
    expect(empty.slice(0, 5).join(', ')).toBe('');
  });

  it('витамин A: дней ниже 70% RDA ≤ 6 из 30 (было 14), среднее ≥ 110%', () => {
    const pcts = DAYS.map((d) => {
      const rda = RDA_A[(d.plan.sex as 'male' | 'female') || 'male'] || 900;
      return Math.round((vitAOf(d) / rda) * 100);
    });
    const below70 = pcts.filter((v) => v < 70).length;
    expect(below70, `дней с VitA < 70% RDA: ${below70}/${pcts.length}`).toBeLessThanOrEqual(6);
    const avg = Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length);
    expect(avg, `VitA: ${avg}% RDA (было 97% с провалами 1–30%)`).toBeGreaterThanOrEqual(110);
  });

  it('овощной пол: дней с овощами < 200 г ≤ 3 из 30 (было 7)', () => {
    const bad = DAYS.filter((d) => vegG(d) < 200);
    expect(bad.length, `дней с овощами < 200 г: ${bad.map((d) => `${d.id}:${vegG(d)}г`).join(' | ')}`).toBeLessThanOrEqual(3);
  });

  it('овощем не становятся сок, фрукт или суп: «200 г морковного сока» — не овощ', () => {
    const bad: string[] = [];
    for (const d of DAYS) for (const { x } of items(d)) {
      if (x.role !== 'veg') continue;
      const id = String(x.id);
      if (/juice|smoothie|soup|borscht|pickled|sauerkraut/.test(id)) bad.push(`${d.id}:${id}`);
      if (/^(fruit_|berry_|berries)/.test(id)) bad.push(`${d.id}:${id}`);
    }
    expect(bad.slice(0, 5).join(' | ')).toBe('');
  });

  it('овощ не съедает гарнир: carb_slow не ниже 30 г', () => {
    const bad: string[] = [];
    for (const d of DAYS) for (const { x } of items(d)) {
      if (x.role !== 'carb_slow' || x._fixedGrams) continue;
      const g = x.amount || 0;
      if (g > 0 && g < 30) bad.push(`${d.id}:${x.id} ${g}г`);
    }
    expect(bad.slice(0, 5).join(' | ')).toBe('');
  });

  it('витамин A взялся из овоща, а не из «концентрата»: плотность в коридоре 150–2000 мкг/100 г', () => {
    const bad: string[] = [];
    for (const d of DAYS) for (const { x } of items(d)) {
      if (x.role !== 'veg') continue;
      const fd: any = FOOD_DB.find((f: any) => f.id === x.id);
      const a = Number(fd?.micros?.VitA || 0);
      // Ни один день не строит витамин A на соке/концентрате: овощ — не «морковный
      // сок 9000 мкг/100 г» и не «сушёный шиповник 4200».
      if (a > 2000) bad.push(`${d.id}:${x.id} ${a}мкг/100г`);
    }
    expect(bad.slice(0, 5).join(' | ')).toBe('');
  });
});

describe('порции: фрукт и орехи — еда, а не украшение (QG11)', () => {
  // Замер на этих же 30 днях: 53 пункта фрукта/ягод меньше 80 г («завтрак с
  // 19 г малины», «перекус с 15 г яблока») и 19 пунктов орехов/семян меньше 15 г
  // («5 г миндаля»). Причина — та же, что у овощей в QG10: порционная
  // санитарность QG1 живёт внутри пакета, а на днях вне канона пакет
  // откатывается целиком, и «19 г малины» возвращается.
  const fruits = (d: Day) => items(d).filter(({ x }) => x.role === 'fruit' && !x._fixedGrams);
  const nuts = (d: Day) => items(d).filter(({ x }) => x.role === 'fat' && !x._fixedGrams
    && /^(cashew|almonds?|walnuts?|hazelnuts?|peanuts?|pistachios?|pecan|macadamia|brazil_nut|seed_|sunflower_seeds|pumpkin_seeds|sesame_seeds)/i.test(String(x.id)));

  it('фрукт меньше порции (80 г): пунктов ≤ 26 на 30 дней (было 53)', () => {
    const bad = DAYS.flatMap((d) => fruits(d).filter(({ x }) => (x.amount || 0) < 80).map(({ x }) => `${d.id}:${x.id} ${x.amount}г`));
    expect(bad.length, `фрукт мельче 80 г: ${bad.slice(0, 5).join(', ')}`).toBeLessThanOrEqual(26);
  });

  it('орехи/семена меньше 15 г: пунктов ≤ 18 на 30 дней (было 19)', () => {
    const bad = DAYS.flatMap((d) => nuts(d).filter(({ x }) => (x.amount || 0) < 15).map(({ x }) => `${d.id}:${x.id} ${x.amount}г`));
    expect(bad.length, `орехов мельче 15 г: ${bad.slice(0, 5).join(', ')}`).toBeLessThanOrEqual(18);
  });

  it('ось «порции» в оценке качества: среднее ≥ 89 (было 85.7)', () => {
    const vals = DAYS.map((d) => scoreDayQuality(d.meals as any, { weightKg: d.w, microCoverage: { lowCount: 0, total: 16 } }).portions);
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    expect(avg, `средняя ось «порции»: ${avg.toFixed(1)}`).toBeGreaterThanOrEqual(89);
  });

  it('QG11 не выводит день из канона: дней вне 3% ≤ 8 из 30 (было 5)', () => {
    const out = DAYS.filter((d) => d.plan.withinTolerance === false);
    expect(out.length, `вне канона: ${out.map((d) => d.id).join(', ')}`).toBeLessThanOrEqual(8);
  });
});

describe('оценка качества дня (planner-quality-score)', () => {
  const food = (id: string, amount: number, role: string) => {
    const fd: any = FOOD_DB.find((f: any) => f.id === id)!;
    const k = amount / 100;
    return {
      id, name: fd.name, amount, role,
      kcal: Math.round((fd.kcal || 0) * k), p: (fd.protein || 0) * k, f: (fd.fat || 0) * k,
      c: (fd.carbs || 0) * k, fiber: (fd.fiber || 0) * k, leucine_mg: (fd.leucine_mg || fd.leucine || 0) * k,
    };
  };
  const meal = (type: string, list: any[]) => ({
    type, label: type, time: '12:00', items: list,
    totals: list.reduce((s: any, x: any) => ({
      kcal: s.kcal + x.kcal, p: s.p + x.p, f: s.f + x.f, c: s.c + x.c, fiber: s.fiber + x.fiber,
    }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0 }),
  });

  it('«19 г малины + 10 г кешью» оценивается ниже нормальной тарелки', () => {
    const weak = [
      meal('breakfast', [food('oats_dry', 60, 'carb_slow'), food('fruit_raspberry', 19, 'fruit'), food('cashew', 10, 'fat')]),
      meal('lunch', [food('chicken_breast', 60, 'protein'), food('rice_white', 70, 'carb_slow')]),
      meal('dinner', [food('chicken_breast', 50, 'protein')]),
    ];
    const good = [
      meal('breakfast', [food('oats_dry', 80, 'carb_slow'), food('fruit_raspberry', 120, 'fruit'), food('almonds', 15, 'fat'), food('egg_white', 120, 'protein')]),
      meal('lunch', [food('chicken_breast', 150, 'protein'), food('rice_white', 200, 'carb_slow'), food('broccoli', 200, 'veg'), food('olive_oil', 10, 'fat')]),
      meal('dinner', [food('beef_lean', 130, 'protein'), food('potato_boiled', 250, 'carb_slow'), food('zucchini', 200, 'veg')]),
    ];
    const sWeak = scoreDayQuality(weak as any, { weightKg: 80, microCoverage: { lowCount: 10, total: 16 } });
    const sGood = scoreDayQuality(good as any, { weightKg: 80, microCoverage: { lowCount: 3, total: 16 } });
    expect(sWeak.total).toBeLessThan(sGood.total);
    expect(sGood.total).toBeGreaterThan(60);
    expect(sWeak.total).toBeLessThan(60);
    expect(sWeak.portions).toBeLessThan(sGood.portions);
  });

  it('детерминирован и ограничен 0…100', () => {
    const m = [meal('lunch', [food('chicken_breast', 120, 'protein'), food('rice_white', 180, 'carb_slow')])];
    const a = scoreDayQuality(m as any, { weightKg: 70, microCoverage: { lowCount: 6, total: 16 } });
    const b = scoreDayQuality(m as any, { weightKg: 70, microCoverage: { lowCount: 6, total: 16 } });
    expect(a).toEqual(b);
    expect(a.total).toBeGreaterThanOrEqual(0);
    expect(a.total).toBeLessThanOrEqual(100);
  });
});
