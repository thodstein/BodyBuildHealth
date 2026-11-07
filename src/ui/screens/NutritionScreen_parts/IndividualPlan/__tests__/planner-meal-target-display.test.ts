import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * §8.60 «цель приёма — план приёма, а не доля, которой в дне нет».
 *
 * Дефект (замер 60 дней, 10 профилей × 4/5/6 приёмов × трен/отдых): Σ целевого жира
 * составлял 80.5% дневного, Σ целевых углеводов — 79.1%. Доли 0.20/0.15/0.22 (+0.10 за
 * перекус) в сумме далеко не 1, а остаток дня сборка добирает корректором в те же
 * тарелки. Поэтому бейдж «факт / цель» горел на **208 из 322** приёмов по жиру и на
 * **288** по углеводам — при том, что собственная ось оценки «жир в одном приёме»
 * зелёная (максимум доли 30% при норме ≤35%).
 *
 * Нормировать сами доли нельзя: попытка «Σ долей = 1» уже была проведена и отклонена
 * замерами (падает сходимость, ломаются капсы порций) — разбор лежит в движке.
 * Поэтому `target.f`/`target.c` НЕ трогаются (их читают корректор, гейты и оценка), а
 * рядом кладутся цели-для-показа `target.fd`/`target.cd`:
 *   жир  = неизбежный жир тарелки (белок/гарнир/овощи) + её жировой пункт, сжатый до
 *          остатка дневного бюджета (k ≤ 1);
 *   углеводы = фактическая доля приёма, сжатая до дневного бюджета (k ≤ 1).
 * Смысл k ≤ 1: день, который сам не дотягивает до бюджета, не «обещает» приёму еду,
 * которой в дне нет. Сжимается цель только когда день ПЕРЕБИРАЕТ — тогда бейдж честно
 * называет приём, который забрал больше своей доли.
 *
 * Замер после: бейджи по жиру 208 → **0**, по углеводам 288 → **27** (это дни, где день
 * перебирает углеводы и цель сжата). План не изменился ни на грамм: состав приёмов,
 * `target.p/c/f`, сумма целей и оценка дня совпадают с выключенным флагом.
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

const build = (p: typeof PROFILES[number], mc: number, tr: boolean, flag: boolean): any => buildDayPlan({
  weightKg: p.w, lbmKg: p.lbm, bodyFatPct: p.bf, sex: p.sex,
  goalKcal: p.k, goalProteinG: p.p, goalFatG: p.f, goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  mealTargetFatShare: flag,
} as unknown as MealPlanInput);

const cells = (flag: boolean) => PROFILES.flatMap((p) => [4, 5, 6].flatMap((mc) => [true, false].map((tr) => ({
  key: `${p.id}/${mc}/${tr ? 'тр' : 'отд'}`,
  profile: p,
  plan: build(p, mc, tr, flag),
}))));

describe('§8.60 цель приёма = план приёма (`target.fd` / `target.cd`)', () => {
  it('бейджи «факт / цель» по жиру и углеводам: 208 и 288 → 0 и ≤27 на 60 дней', () => {
    let fat = 0;
    let carb = 0;
    let meals = 0;
    for (const { plan } of cells(true)) {
      for (const m of plan.meals || []) {
        if (!Number.isFinite(Number(m.target?.fd))) continue;
        meals++;
        if (Math.abs((Number(m.totals?.f) || 0) - (Number(m.target.fd) || 0)) > 3) fat++;
        if (Math.abs((Number(m.totals?.c) || 0) - (Number(m.target.cd) || 0)) > 3) carb++;
      }
    }
    expect(meals).toBeGreaterThan(250);
    expect(fat, 'жир вне цели >3 г').toBe(0);
    expect(carb, 'углеводы вне цели >3 г').toBeLessThanOrEqual(27);
  });

  it('цель не обещает больше, чем в дне: Σ показных целей ≤ дневной бюджет', () => {
    const bad: string[] = [];
    for (const { key, profile, plan } of cells(true)) {
      const sumFd = (plan.meals || []).reduce((s: number, m: any) => s + (Number(m.target?.fd) || 0), 0);
      const sumCd = (plan.meals || []).reduce((s: number, m: any) => s + (Number(m.target?.cd) || 0), 0);
      const plateF = (plan.meals || []).reduce((s: number, m: any) => s + (Number(m.totals?.f) || 0), 0);
      const plateC = (plan.meals || []).reduce((s: number, m: any) => s + (Number(m.totals?.c) || 0), 0);
      // Допуск — округление до грамма на приём.
      if (sumFd > Math.min(profile.f, plateF) + (plan.meals || []).length) bad.push(`${key}: Σfd ${sumFd} > ${profile.f}/${plateF.toFixed(0)}`);
      if (sumCd > Math.min(carbsFor(profile), plateC) + (plan.meals || []).length) bad.push(`${key}: Σcd ${sumCd} > ${carbsFor(profile)}/${plateC.toFixed(0)}`);
    }
    expect(bad.slice(0, 6).join(' | ')).toBe('');
  });

  it('сборка не тронута: состав приёмов и target.p/c/f совпадают с выключенным флагом', () => {
    const off = new Map(cells(false).map((r) => [r.key, r.plan]));
    const diff: string[] = [];
    for (const { key, plan } of cells(true)) {
      const before: any = off.get(key);
      const a = (plan.meals || []).map((m: any) => `${m.type}=${(m.items || []).map((i: any) => `${i.id}:${i.amount}`).join(',')}|${m.target?.p}/${m.target?.c}/${m.target?.f}`);
      const b = (before?.meals || []).map((m: any) => `${m.type}=${(m.items || []).map((i: any) => `${i.id}:${i.amount}`).join(',')}|${m.target?.p}/${m.target?.c}/${m.target?.f}`);
      if (a.join(';') !== b.join(';')) diff.push(key);
      if ((Number(plan.qualityScore?.total) || 0) !== (Number(before?.qualityScore?.total) || 0)) diff.push(`${key}:score`);
    }
    expect(diff.slice(0, 5).join(', ')).toBe('');
  });

  it('окна и инсулин-окна цель не получают: peri/интра/предсон идут по дизайну', () => {
    const bad: string[] = [];
    for (const { key, plan } of cells(true)) {
      for (const m of plan.meals || []) {
        const t = String(m.type);
        const fixed = ['preworkout', 'postworkout', 'intra', 'presleep'].includes(t) || (m as any)._insulinWindow;
        if (fixed && (Number.isFinite(Number(m.target?.fd)) || Number.isFinite(Number(m.target?.cd)))) bad.push(`${key}:${t}`);
      }
    }
    expect(bad.slice(0, 5).join(', ')).toBe('');
  });
});
