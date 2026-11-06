import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * §8.54 Целостность порции: граммы и нутриенты — про ОДНО И ТО ЖЕ количество еды.
 *
 * Найденный дефект (60 дней, профили аудита): поздние стадии обрезают ГРАММЫ
 * (клетчаточный кап, P4b-дип), а нутриенты остаются от прежнего количества.
 * Замер: **11 позиций** —
 *  - «5 г семян чиа = 110 ккал» (2200 ккал/100 г при 486 в БД): жир от 22 г;
 *  - «100 г овсянки = 858 ккал» (858 ккал/100 г при 350 в БД): нутриенты от 245 г.
 * Пользователь видит тарелку, которая не складывается, а день «сходится» на
 * фантомных калориях. Это и есть одна из причин жалобы «в плане ерунда».
 *
 * Почему не починено одной строкой: существующий `sanitizeItemNutrients` ловит
 * макро-ошибку допуском ±15 г — для 5-граммовой порции это слепо (12 г жира против
 * ожидаемых 1.5 г = «норма»). Проверка по плотности ловит всё, но после честного
 * ремонта день теряет фантомные ккал и движок добирает их ЧИСТЫМ МАСЛОМ (замер:
 * перекус из 40 г оливкового масла, ось «порции» 77, белок перекуса 0.12 г/кг):
 * avg 91.25 → 92.43, канон 5 → 4, «голодных» 4 → 1, но 12 дней теряют балл.
 * Это отдельная стадия (жир цельным продуктом + распределение белка), поэтому
 * здесь — барьер по замеренному значению: долг виден и не растёт.
 *
 * Замок: число битых позиций не больше 11. Любая новая правка, которая создаёт
 * такие позиции (или чинит их — тогда барьер опускается вместе с правкой), обязана
 * обновить это число осознанно.
 */

const PROFILES: Array<{ id: string; w: number; lbm: number; bf: number; sex: 'male' | 'female'; k: number; p: number; f: number; c?: number }> = [
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

const carbsFor = (p: { k: number; p: number; f: number; c?: number }) => (
  p.c && p.c > 0 ? p.c : Math.max(0, Math.round((p.k - 4 * p.p - 9 * p.f) / 4))
);

const build = (p: typeof PROFILES[number], mc: number, tr: boolean): any => buildDayPlan({
  weightKg: p.w, lbmKg: p.lbm, bodyFatPct: p.bf, sex: p.sex,
  goalKcal: p.k, goalProteinG: p.p, goalFatG: p.f, goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
} as unknown as MealPlanInput);

const dbById = new Map<string, any>();

/** Позиция «битая», если её калорийная плотность физически невозможна:
 *  > 1000 ккал/100 г (потолок чистого жира), а для не-жира — > 700 ккал/100 г
 *  (самый плотный сухой продукт — крупа/сухофрукт, ~380–400). Именно так ловятся
 *  «5 г чиа = 110 ккал» (2200) и «100 г овсянки = 858 ккал». */
function brokenPortions(plan: any): string[] {
  const out: string[] = [];
  for (const m of plan.meals || []) {
    for (const it of m.items || []) {
      const amount = Number(it.amount) || 0;
      if (amount <= 0) continue;
      const kcal = Number(it.kcal)
        || 4 * (Number(it.p) || 0) + 9 * (Number(it.f) || 0) + 4 * (Number(it.c) || 0);
      const dens = (kcal / amount) * 100;
      const role = String(it.role || '');
      const limit = role === 'fat' ? 1000 : 700;
      if (dens > limit) out.push(`${String(m.label || m.type)}/${String(it.id)} ${amount}г=${Math.round(kcal)}к (${Math.round(dens)} ккал/100 г)`);
    }
  }
  return out;
}

describe('§8.54 целостность порции (барьер по замеренному долгу)', () => {
  it('битых позиций не больше 11 на 60 днях', { timeout: 900000 }, () => {
    const offenders: string[] = [];
    for (const p of PROFILES) for (const mc of [4, 5, 6]) for (const tr of [true, false]) {
      const plan = build(p, mc, tr);
      for (const b of brokenPortions(plan)) offenders.push(`${p.id}/${mc}/${tr ? 'тр' : 'отд'} ${b}`);
    }
    // eslint-disable-next-line no-console
    if (offenders.length) console.error('битые порции:\n' + offenders.join('\n'));
    expect(offenders.length).toBeLessThanOrEqual(11);
  });

  it('битые порции не появляются в обычных днях (mid75/normal90/recomp80 5–6 приёмов)', { timeout: 900000 }, () => {
    const bad: string[] = [];
    for (const p of PROFILES.filter((x) => ['mid75', 'normal90', 'recomp80'].includes(x.id))) {
      for (const mc of [5, 6]) for (const tr of [true, false]) {
        for (const b of brokenPortions(build(p, mc, tr))) bad.push(`${p.id}/${mc}/${tr ? 'тр' : 'отд'} ${b}`);
      }
    }
    expect(bad.join(' | ')).toBe('');
  });
});
