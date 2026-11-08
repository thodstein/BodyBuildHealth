/**
 * planner-seed-swap.test.ts — §8.75: семя/орех — еда, а не украшение.
 *
 * Дефект (замер 60 дней): 130 пунктов `role: fat` меньше 15 г. §8.57/§8.61 растит
 * орехи до 15 г, но её список (`cashew|almonds|walnuts|…`) не знает `chia_seeds`,
 * `flax`, `hemp` — 26 крошек чиа так и висят «5 г семян» (30 ккал, ни Ca, ни омега-3).
 *
 * Фикс без роста калорий: семя растёт до 15 г, масло того же приёма ужимается ровно на
 * его жир. Предсон не трогаем — там орех дизайнерский (мелатонин-порция 8–10 г).
 *
 * Отклонено по построению: рост семени «сверху» (без масла того же приёма) — это +38
 * ккал на приём, канон-гейт отбивает такие дни.
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
  seedSwap75: on,
} as any) as any;

const solidG = (m: any) => ((m.items || []) as any[])
  .filter((i: any) => !['liquid', 'supplement'].includes(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
const buckets = (plan: any) => (plan.meals || []).filter((m: any) => (m.items || []).length > 0 && solidG(m) > 500).length;
const isNut = (x: any) => String(x?.role) === 'fat'
  && /(nut|almond|cashew|walnut|hazel|pistach|pecan|macadamia|brazil|seed|chia|flax|hemp|sesame|poppy)/i.test(String(x.id))
  && !/(paste|butter|oil)/i.test(String(x.id));
const isFatTrim = (x: any) => String(x?.role) === 'fat' && !isNut(x) && !/(paste|butter_p|cheese)/i.test(String(x.id));
/** Крошки ореха/семени вне предсона: там орех — дизайнерская мелатонин-порция. */
const nutCrumbs = (plan: any) => (plan.meals || [])
  .filter((m: any) => String(m.type) !== 'presleep')
  .flatMap((m: any) => (m.items || []))
  .filter((i: any) => isNut(i) && (Number(i.amount) || 0) > 0 && (Number(i.amount) || 0) < 15).length;
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
  key: `${p[0]}/${mc}/${tr ? 'тр' : 'отд'}`, p, on: build(p, mc, tr, true), off: build(p, mc, tr, false),
}))));
const NOTE = '🥜 Семя/орех — еда, а не украшение:';

describe('§8.75 семя/орех вместо масла', () => {
  it('матрица покрывает 60 дней', () => {
    expect(DAYS).toHaveLength(60);
  });

  it('ни один день не теряет балл, не выходит из канона, вёдер не больше', () => {
    const worse: string[] = [];
    const outOfCanon: string[] = [];
    for (const d of DAYS) {
      const qa = Number(d.on.qualityScore?.total) || 0;
      const qb = Number(d.off.qualityScore?.total) || 0;
      if (qa < qb) worse.push(`${d.key}: ${qb} → ${qa}`);
      if (devOf(d.on, d.p) > Math.max(devOf(d.off, d.p), 0.03) + 1e-9) {
        outOfCanon.push(`${d.key}: ${(devOf(d.off, d.p) * 100).toFixed(1)}% → ${(devOf(d.on, d.p) * 100).toFixed(1)}%`);
      }
    }
    expect(worse.join(', ')).toBe('');
    expect(outOfCanon.join(', ')).toBe('');
    const wOn = DAYS.reduce((s, d) => s + buckets(d.on), 0);
    const wOff = DAYS.reduce((s, d) => s + buckets(d.off), 0);
    expect(wOn).toBeLessThanOrEqual(wOff);
  });

  it('орех-крошек строго меньше, новых не появляется, предсон не тронут', () => {
    const nOn = DAYS.reduce((s, d) => s + nutCrumbs(d.on), 0);
    const nOff = DAYS.reduce((s, d) => s + nutCrumbs(d.off), 0);
    expect(nOn).toBeLessThan(nOff); // замер: 45 → 38
    const grew: string[] = [];
    const presleepTouched: string[] = [];
    for (const d of DAYS) {
      if (nutCrumbs(d.on) > nutCrumbs(d.off)) grew.push(d.key);
      const pick = (pl: any) => ((pl.meals || []).find((m: any) => String(m.type) === 'presleep')?.items || [])
        .map((i: any) => `${i.id}:${i.amount}`).join(',');
      if (pick(d.on) !== pick(d.off)) presleepTouched.push(d.key);
    }
    expect(grew.join(', ')).toBe('');
    expect(presleepTouched.join(', ')).toBe('');
  });

  it('обмен без роста калорий: жир дня тот же, ккал уезжают не больше 20', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const dF = Math.abs(Number(d.on.totals?.f) - Number(d.off.totals?.f));
      const dK = Math.abs(Number(d.on.totals?.kcal) - Number(d.off.totals?.kcal));
      if (dF > 0.6) bad.push(`${d.key}: Δжир ${dF.toFixed(2)} г`);
      if (dK > 20) bad.push(`${d.key}: Δккал ${dK.toFixed(0)}`);
    }
    expect(bad.join(', ')).toBe('');
  });

  it('растёт только семя (до ≥15 г), ужимается только жировой пункт; состав блюда тот же', () => {
    const bad: string[] = [];
    let changed = 0;
    for (const d of DAYS) {
      (d.on.meals || []).forEach((onM: any, idx: number) => {
        const offM = (d.off.meals || [])[idx];
        if (!offM) return;
        const onIds = (onM.items || []).map((i: any) => i.id).join('|');
        const offIds = (offM.items || []).map((i: any) => i.id).join('|');
        if (onIds !== offIds) bad.push(`${d.key} ${onM.type}: состав блюда изменился`);
        (onM.items || []).forEach((it: any, j: number) => {
          const prev = (offM.items || [])[j];
          if (!prev) return;
          const a = Math.round(Number(it.amount) || 0);
          const b = Math.round(Number(prev.amount) || 0);
          if (a === b) return;
          changed++;
          if (isNut(it)) {
            if (!(a >= b)) bad.push(`${d.key} ${onM.type} ${it.id}: орех уменьшился ${b} → ${a}`);
          } else if (isFatTrim(it)) {
            if (!(a < b)) bad.push(`${d.key} ${onM.type} ${it.id}: жир не ужался ${b} → ${a}`);
            if (a < 5) bad.push(`${d.key} ${onM.type} ${it.id}: масло ниже 5 г (${a})`);
          } else {
            bad.push(`${d.key} ${onM.type} ${it.id}: тронут не тот пункт ${b} → ${a}`);
          }
        });
      });
    }
    expect(bad.join(', ')).toBe('');
    expect(changed).toBeGreaterThanOrEqual(5);
  });

  it('стадия объясняется нотой, выключенный флаг = прежний план', () => {
    let fired = 0;
    for (const d of DAYS) {
      const notesOn = ((d.on.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      const notesOff = ((d.off.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      expect(notesOff).toHaveLength(0);
      if (notesOn.length > 0) {
        fired++;
        expect(nutCrumbs(d.on)).toBeLessThan(nutCrumbs(d.off));
        expect(notesOn[0]).toMatch(/за счёт масла того же приёма/);
      }
    }
    expect(fired).toBeGreaterThanOrEqual(3);
  });
});
