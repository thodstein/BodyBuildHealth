/**
 * planner-veg-density.test.ts — §8.78: овощ должен кормить, а не занимать объём.
 *
 * Дефект (замер осей за 60 дней): 9 дней с микро <70. Дефициты — VitB9 (9 дней),
 * VitK (8), Fe (7), K (7), VitD (7), VitE (7). При этом овощная ось 96.4: овощи в
 * дне ЕСТЬ, но «пустые» — сельдерей 100 г = 29 мкг VitK и 0 B9, пименто = 0 B9,
 * напа = 32 мкг. Плотный овощ того же веса (шпинат 100 г = 483 мкг VitK, 194 мкг B9,
 * 3 мг Fe, 99 мг Ca) закрывает 3–5 дефицитов при +7 ккал/100 г.
 *
 * Гейт: качество дня строго выше (микро реально прибавилось), канон не хуже, не выходит
 * из 3%, день не выносится за 5% («Точность рациона» пишет предупреждение), вёдер не
 * больше; один обмен на день, продукт в дне не дублируется, вес овоща не меняется.
 *
 * HV-дни исключены: там составом владеют инсулиновые окна и рецептурная сборка (замер
 * `R-1500`: обмен сдвигал день и сборщик рецептов выбирал другой перекус — «Перекус 3»
 * оставался без белка).
 *
 * Замер 60 дней: оценка 92.317 → 92.617 (8 дней лучше, 0 хуже), микро 85.9 → 88.5,
 * дефицитов 111 → 93, канон >3% 3 → 3, дней >5% 3 → 3, вёдра 88 → 88.
 * Отклонено замером: ореховая паста вместо масла (§8.76) и фрукт за счёт жира (§8.77) —
 * канон-гейт отбивает.
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
  vegDensity78: on,
} as any) as any;

const DENSE = new Set(['spinach', 'kale', 'veg_kale', 'broccoli']);
const WEAK = /^(celery|veg_celerysticks|veg_celery_root|pepper_pimento|veg_cabbage_napa|cucumber|tomato|zucchini|pumpkin|veg_cauliflower|veg_asparagus_green|asparagus)$/i;
const solidG = (m: any) => ((m.items || []) as any[])
  .filter((i: any) => !['liquid', 'supplement'].includes(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
const buckets = (plan: any) => (plan.meals || []).filter((m: any) => (m.items || []).length > 0 && solidG(m) > 500).length;
const lowMicro = (plan: any) => ((plan.microSummary?.coverage || []) as any[]).filter((c: any) => Number(c.pct) < 70).length;
const microScore = (plan: any) => Number(plan.qualityScore?.micro) || 0;
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
const flat = (plan: any) => (plan.meals || []).flatMap((m: any) => (m.items || []) as any[]);

const DAYS = PROFILES.flatMap((p) => [4, 5, 6].flatMap((mc) => [true, false].map((tr) => ({
  key: `${p[0]}/${mc}/${tr ? 'тр' : 'отд'}`, p, on: build(p, mc, tr, true), off: build(p, mc, tr, false),
}))));
const NOTE = '🥬 Овощ должен кормить:';

describe('§8.78 плотный овощ вместо объёма', () => {
  it('матрица покрывает 60 дней', () => {
    expect(DAYS).toHaveLength(60);
  });

  it('HV-дни не трогаются: там составом владеют инсулиновые окна и рецептурная сборка', () => {
    const hv = DAYS.filter((d) => d.p[4] >= 4200 || (d.p[5] / d.p[1]) >= 2.8);
    expect(hv.length).toBeGreaterThanOrEqual(12);
    const bad: string[] = [];
    for (const d of hv) {
      const onIds = flat(d.on).map((i: any) => `${i.id}:${Math.round(Number(i.amount) || 0)}`);
      const offIds = flat(d.off).map((i: any) => `${i.id}:${Math.round(Number(i.amount) || 0)}`);
      if (onIds.join(',') !== offIds.join(',')) bad.push(`${d.key}: состав уехал`);
      if (Number(d.on.qualityScore?.total) !== Number(d.off.qualityScore?.total)) bad.push(`${d.key}: оценка уехала`);
      if (((d.on.notes || []) as string[]).some((n) => String(n).startsWith(NOTE))) bad.push(`${d.key}: нота обмена`);
    }
    expect(bad.join(', ')).toBe('');
  });

  it('ни один день не теряет балл и не ухудшает канон, вёдер не больше', () => {
    const worse: string[] = [];
    const outOfCanon: string[] = [];
    for (const d of DAYS) {
      const qa = Number(d.on.qualityScore?.total) || 0;
      const qb = Number(d.off.qualityScore?.total) || 0;
      if (qa < qb) worse.push(`${d.key}: ${qb} → ${qa}`);
      // День, уже стоявший вне канона (экстремальные профили), не имеет права стать хуже;
      // день в зоне — не имеет права выйти из неё.
      const devOn = devOf(d.on, d.p);
      const devOff = devOf(d.off, d.p);
      if (devOn > Math.max(devOff, 0.029) + 1e-9) {
        outOfCanon.push(`${d.key}: ${(devOff * 100).toFixed(1)}% → ${(devOn * 100).toFixed(1)}%`);
      }
    }
    expect(worse.join(', ')).toBe('');
    expect(outOfCanon.join(', ')).toBe('');
    const wOn = DAYS.reduce((s, d) => s + buckets(d.on), 0);
    const wOff = DAYS.reduce((s, d) => s + buckets(d.off), 0);
    expect(wOn).toBeLessThanOrEqual(wOff);
  });

  it('микро реально прибавилось: оценка оси выше, дефицитов меньше (замер 85.9 → 88.5)', () => {
    const mOn = DAYS.reduce((s, d) => s + microScore(d.on), 0) / DAYS.length;
    const mOff = DAYS.reduce((s, d) => s + microScore(d.off), 0) / DAYS.length;
    const lOn = DAYS.reduce((s, d) => s + lowMicro(d.on), 0);
    const lOff = DAYS.reduce((s, d) => s + lowMicro(d.off), 0);
    expect(mOn).toBeGreaterThan(mOff);
    expect(lOn).toBeLessThan(lOff);
  });

  it('меняется только овощ: пустой → плотный, вес тот же, состав дна не пересобирается', () => {
    const bad: string[] = [];
    let swaps = 0;
    for (const d of DAYS) {
      (d.on.meals || []).forEach((onM: any, i: number) => {
        const offM = (d.off.meals || [])[i];
        if (!offM) return;
        const onItems = (onM.items || []) as any[];
        const offItems = (offM.items || []) as any[];
        if (onItems.length !== offItems.length) bad.push(`${d.key} ${onM.type}: изменилось число пунктов`);
        onItems.forEach((it: any, j: number) => {
          const prev = offItems[j];
          if (!prev) return;
          if (String(it.id) === String(prev.id)) {
            if (Math.round(Number(it.amount) || 0) !== Math.round(Number(prev.amount) || 0)) {
              bad.push(`${d.key} ${onM.type} ${it.id}: граммы уехали ${prev.amount} → ${it.amount}`);
            }
            return;
          }
          swaps++;
          if (!WEAK.test(String(prev.id))) bad.push(`${d.key} ${onM.type}: убран не пустой овощ (${prev.id})`);
          if (!DENSE.has(String(it.id))) bad.push(`${d.key} ${onM.type}: пришёл не плотный овощ (${it.id})`);
          if (String(it.role) !== 'veg' || String(prev.role) !== 'veg') bad.push(`${d.key} ${onM.type}: роль не veg`);
          if (Math.round(Number(it.amount) || 0) !== Math.round(Number(prev.amount) || 0)) {
            bad.push(`${d.key} ${onM.type}: вес овоща изменился ${prev.amount} → ${it.amount}`);
          }
        });
      });
    }
    expect(bad.join(', ')).toBe('');
    expect(swaps).toBeGreaterThanOrEqual(5); // замер: 9 обменов на 60 дней
  });

  it('один обмен на день и без дублей продукта в дне', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const onIds = flat(d.on).map((i: any) => String(i.id));
      for (const dense of DENSE) {
        const n = onIds.filter((id) => id === dense).length;
        if (n > 1) bad.push(`${d.key}: ${dense} × ${n}`);
      }
      let swaps = 0;
      (d.on.meals || []).forEach((onM: any, i: number) => {
        const offM = (d.off.meals || [])[i];
        if (!offM) return;
        ((onM.items || []) as any[]).forEach((it: any, j: number) => {
          const prev = ((offM.items || []) as any[])[j];
          if (prev && String(it.id) !== String(prev.id)) swaps++;
        });
      });
      if (swaps > 1) bad.push(`${d.key}: обменов ${swaps}`);
    }
    expect(bad.join(', ')).toBe('');
  });

  it('калории дня почти не двигаются (≤30 ккал), жир/белок почти не тронуты', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const dK = Math.abs(Number(d.on.totals?.kcal) - Number(d.off.totals?.kcal));
      const dP = Math.abs(Number(d.on.totals?.p) - Number(d.off.totals?.p));
      const dF = Math.abs(Number(d.on.totals?.f) - Number(d.off.totals?.f));
      if (dK > 30) bad.push(`${d.key}: Δккал ${dK.toFixed(0)}`);
      // Плотный овощ сам несёт белок (шпинат 2.9 г/100 г против сельдерея 0.7 г) —
      // на большой порции это до 5 г дня (≤3% от цели), дальше день пересобирается.
      if (dP > 5) bad.push(`${d.key}: Δбелка ${dP.toFixed(1)} г`);
      if (dF > 1.5) bad.push(`${d.key}: Δжира ${dF.toFixed(1)} г`);
    }
    expect(bad.join(', ')).toBe('');
  });

  it('обмен объясняется нотой; выключенный флаг = прежний план', () => {
    let fired = 0;
    for (const d of DAYS) {
      const onNotes = ((d.on.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      const offNotes = ((d.off.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      expect(offNotes).toHaveLength(0);
      const changed = microScore(d.on) !== microScore(d.off);
      if (changed) {
        fired++;
        expect(onNotes.length).toBeGreaterThan(0);
        expect(onNotes[0]).toMatch(/плотный овощ того же веса/);
      } else {
        expect(onNotes).toHaveLength(0);
      }
    }
    expect(fired).toBeGreaterThanOrEqual(5);
  });
});
