/**
 * planner-microrole-veg.test.ts — §8.88: роль микро-добавки — по природе продукта,
 * овощной слот добирается настоящим овощем.
 *
 * Дефект §8.87: `activelyCloseTopDeficiency` (закрытие дефицита витамина D/омега-3) и
 * `closeExtremeMicroGaps` ставили ЛЮБОЙ продукт ролью `veg`. Замер 60 дней: 10 дней из 60,
 * 953 г «овощей» — это рыба (`salmon` 883 г за 9 дней, `sardines` 70 г). Ось «овощ»
 * (22% оценки дня) считает `role === 'veg'`, а стадии плотности (§8.78/§8.83) ищут овощ
 * по роли — то есть рыба в овощном слоте МАСКИРОВАЛА отсутствие овоща.
 *
 * Ход: роль правится в ФИНАЛЕ сборки (`buildDayPlan`, перед оценкой качества), а не в
 * момент добавки. Если менять роль сразу, день пересобирается целиком — замер дал
 * 14 дней лучше / 12 хуже, бейджи 24→28, вёдра 91→94, канон 3→4 дня. В финале состав
 * уже зафиксирован, поэтому меняется только учёт, а освободившийся овощной слот
 * добирается настоящим овощем с ккал-нейтральным срезом крахмала того же приёма.
 *
 * Правило общее: любой пункт роли `veg` с плотностью белка ≥12 г/100 г — не овощ.
 * Действует гарантия дня: если честная роль + добор овоща стоят дню балл или проседает
 * ось овоща (200 г овоща физически не влезают в тарелки ≤500 г), роль откладывается
 * и это прямо написано в ноте «Долг §8.88».
 *
 * Замер 60 дней (keto 120 г углей): оценка 93.650 → 93.700 (2 дня лучше, 0 хуже),
 * вёдра 90 → 90, канон >3% 3 → 3, микро 90.3 → 90.4, овощная ось 97.7 → 97.8,
 * фальшивый «овощ» 10 дней → 2 (отложены с нотой).
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';

const PROFILES: Array<[string, number, number, 'male' | 'female', number, number, number, number]> = [
  ['p500', 110, 90, 'male', 4600, 500, 120, 0],
  ['c1500', 110, 90, 'male', 8370, 300, 130, 1500],
  ['hugeCarb', 100, 82, 'male', 6700, 250, 100, 0],
  ['mass110', 110, 90, 'male', 5200, 260, 120, 0],
  ['normal90', 90, 73, 'male', 3000, 200, 80, 0],
  ['mid75', 75, 61, 'male', 2400, 180, 70, 0],
  ['small60', 60, 49, 'female', 1600, 150, 45, 0],
  ['cutF50', 50, 41, 'female', 1240, 110, 40, 0],
  ['recomp80', 80, 65, 'male', 2200, 200, 60, 0],
  ['keto85', 85, 70, 'male', 2400, 180, 150, 0],
];
type P = (typeof PROFILES)[number];
const carbsFor = (p: P) => p[7] || Math.max(0, Math.round((p[4] - 4 * p[5] - 9 * p[6]) / 4));

const build = (p: P, mc: number, tr: boolean, on: boolean) => buildDayPlan({
  weightKg: p[1], lbmKg: p[2], bodyFatPct: 18, sex: p[3],
  goalKcal: p[4], goalProteinG: p[5], goalFatG: p[6], goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  microRoleByNature88: on,
} as any) as any;

const solidG = (m: any) => ((m.items || []) as any[])
  .filter((i: any) => !['liquid', 'supplement'].includes(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
const flat = (plan: any) => (plan.meals || []).flatMap((m: any) => (m.items || []) as any[]);
const buckets = (plan: any) => (plan.meals || []).filter((m: any) => (m.items || []).length > 0 && solidG(m) > 500).length;
const badges = (plan: any) => (plan.meals || []).filter((m: any) => Number(m.target?.pd) > 0
  && (Number(m.totals?.p) || 0) < Number(m.target.pd) - 3).length;
/** «Фальшивый овощ»: пункт роли `veg`, где белка ≥0.12 г на грамм продукта (рыба/печень/творог). */
const fakeVeg = (plan: any) => flat(plan)
  .filter((i: any) => String(i.role) === 'veg' && (Number(i.p) || 0) / Math.max(1, Number(i.amount) || 1) >= 0.12);
const vegG = (plan: any) => flat(plan).filter((i: any) => String(i.role) === 'veg').reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
const devOf = (plan: any, p: P) => {
  const c = carbsFor(p);
  const t = plan.totals || {};
  return Math.max(
    Math.abs(Number(t.kcal) - p[4]) / p[4],
    Math.abs(Number(t.p) - p[5]) / p[5],
    Math.abs(Number(t.f) - p[6]) / p[6],
    c > 0 ? Math.abs(Number(t.c) - c) / c : 0,
  );
};

const DAYS = PROFILES.flatMap((p) => [4, 5, 6].flatMap((mc) => [true, false].map((tr) => ({
  key: `${p[0]}/${mc}/${tr ? 'тр' : 'отд'}`, p,
  on: build(p, mc, tr, true), off: build(p, mc, tr, false),
}))));
const AFFECTED = DAYS.filter((d) => fakeVeg(d.off).length > 0);

describe('§8.88 роль микро-добавки по природе + настоящий овощ в слот', () => {
  it('матрица покрывает 60 дней, и дефект на базе воспроизводится', () => {
    expect(DAYS).toHaveLength(60);
    expect(AFFECTED.length).toBeGreaterThan(0);
  });

  it('рыба/печень больше не считаются овощем (кроме дней, где честность стоит балла — с нотой)', () => {
    const bad: string[] = [];
    const deferred: string[] = [];
    for (const d of DAYS) {
      const f = fakeVeg(d.on);
      if (f.length === 0) continue;
      const note = (d.on.notes || []).some((n: string) => String(n).includes('Честная роль микро-добавки отложена'));
      if (note) deferred.push(d.key);
      else bad.push(`${d.key}: ${f.map((i: any) => `${i.name} ${Math.round(i.amount)}г`).join(', ')}`);
    }
    expect(bad).toEqual([]);
    // Долг, вскрытый честными данными: если 200 г настоящего овоща физически не влезают
    // в тарелки ≤500 г (день уже у капа), роль откладывается и это прямо написано в ноте.
    // Замер 60 дней: 2 дня из 60 (`normal90/4/тр`, `keto85/4/тр`), тарелки 451/454/485 г.
    expect(deferred.length).toBeLessThanOrEqual(2);
    for (const key of deferred) {
      const d = DAYS.find((x) => x.key === key)!;
      expect((d.on.notes || []).some((n: string) => String(n).includes('Долг §8.88'))).toBe(true);
    }
  });

  it('дефект существует только благодаря флагу: с ним роль честная, без него — прежняя', () => {
    expect(AFFECTED.length).toBeGreaterThan(0);
    const deferred = DAYS.filter((d) => (d.on.notes || []).some((n: string) => String(n).includes('отложена')));
    for (const d of AFFECTED) {
      if (deferred.some((x) => x.key === d.key)) continue;
      for (const it of fakeVeg(d.off)) {
        const same = flat(d.on).find((x: any) => x.id === it.id && Math.round(Number(x.amount)) === Math.round(Number(it.amount)));
        if (same) expect(String(same.role)).not.toBe('veg');
      }
    }
  });

  it('овощной слот на затронутых днях закрыт настоящим овощем, а не пустотой', () => {
    const bad: string[] = [];
    for (const d of AFFECTED) {
      if ((d.on.notes || []).some((n: string) => String(n).includes('отложена'))) continue;
      const realG = vegG(d.on);
      if (realG < 100) bad.push(`${d.key}: овощей ${Math.round(realG)} г`);
    }
    expect(bad).toEqual([]);
  });

  it('ни один день не стал хуже; вёдра, бейджи и канон не выросли', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const qa = Number(d.on.qualityScore?.total) || 0;
      const qb = Number(d.off.qualityScore?.total) || 0;
      if (qa < qb) bad.push(`${d.key}: качество ${qb}→${qa}`);
      if (buckets(d.on) > buckets(d.off)) bad.push(`${d.key}: вёдра ${buckets(d.off)}→${buckets(d.on)}`);
      if (badges(d.on) > badges(d.off)) bad.push(`${d.key}: бейджи ${badges(d.off)}→${badges(d.on)}`);
      const da = devOf(d.on, d.p), db = devOf(d.off, d.p);
      if (db <= 0.03 && da > 0.03) bad.push(`${d.key}: канон ${(db * 100).toFixed(1)}%→${(da * 100).toFixed(1)}%`);
    }
    expect(bad).toEqual([]);
  });

  it('оси овоща и микро не проседают, тарелка не растёт', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      if ((Number(d.on.qualityScore?.veg) || 0) < (Number(d.off.qualityScore?.veg) || 0) - 3) {
        bad.push(`${d.key}: овощ ${d.off.qualityScore?.veg}→${d.on.qualityScore?.veg}`);
      }
      if ((Number(d.on.qualityScore?.micro) || 0) < (Number(d.off.qualityScore?.micro) || 0)) {
        bad.push(`${d.key}: микро ${d.off.qualityScore?.micro}→${d.on.qualityScore?.micro}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('план говорит правду нотой: роль по природе видна пользователю', () => {
    const honest = AFFECTED.filter((d) => !(d.on.notes || []).some((n: string) => String(n).includes('отложена')));
    const withNote = honest.filter((d) => (d.on.notes || []).some((n: string) => String(n).includes('Роль по природе')));
    expect(withNote.length).toBe(honest.length);
    expect(honest.some((d) => (d.on.notes || []).some((n: string) => String(n).includes('Овощной слот закрыт настоящим овощем')))).toBe(true);
  });

  it('граммы «овощей» уменьшились не больше, чем на вес фальшивых овощей', () => {
    for (const d of AFFECTED) {
      const fake = fakeVeg(d.off).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
      const drop = vegG(d.off) - vegG(d.on);
      expect(drop).toBeLessThanOrEqual(fake + 1);
    }
  });
});
