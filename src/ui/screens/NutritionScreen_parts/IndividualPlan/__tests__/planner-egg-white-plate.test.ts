/**
 * planner-egg-white-plate.test.ts — §8.71: яичный белок не уносит тарелку.
 *
 * Дефект (замер 60 дней): в 10 днях завтрак — 300–408 г яичного белка (13 белков =
 * упаковка). Именно они держали «вёдра >500 г» на обычных профилях (`recomp80/4/отд`
 * 541 г, `keto85/4/отд` 519 г). Прямой кап в `EDIBILITY_CAPS` замерен и ОТКЛОНЁН: он
 * ломает 2–3 дня (белок дня уезжает, `planner-meal-protein-floor`).
 *
 * Замок держит контракт стадии:
 *  1. ни один день не теряет балл качества и не выходит из канона 3%;
 *  2. «вёдер» >500 г не становится больше;
 *  3. белок дня сохраняется (обмен идёт «белок за белок», донор — творог/йогурт/молоко);
 *  4. порции яичного белка сверх 250 г в плане после стадии меньше, чем без неё;
 *  5. выключенный флаг = прежний план (нота «🥚» не появляется).
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
  // §8.78 (плотный овощ вместо объёма) выключается в обоих вариантах: иначе A/B
  // перестаёт быть сравнением одной стадии (микро меняются до её гейтов).
  vegDensity78: false,
  eggSwap71: on,
} as any) as any;

const solidG = (m: any) => ((m.items || []) as any[])
  .filter((i: any) => !['liquid', 'supplement'].includes(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
const buckets = (plan: any) => (plan.meals || []).filter((m: any) => (m.items || []).length > 0 && solidG(m) > 500).length;
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
const eggOver = (plan: any, cap = 250) => (plan.meals || []).flatMap((m: any) => (m.items || []))
  .filter((i: any) => String(i.id) === 'egg_white' && (Number(i.amount) || 0) > cap).length;

const DAYS: Array<{ key: string; p: P; on: any; off: any }> = [];
for (const p of PROFILES) for (const mc of [4, 5, 6]) for (const tr of [true, false]) {
  DAYS.push({ key: `${p[0]}/${mc}/${tr ? 'тр' : 'отд'}`, p, on: build(p, mc, tr, true), off: build(p, mc, tr, false) });
}
const NOTE = '🥚 Белок яйца не уносит тарелку:';

describe('§8.71 яичный белок: порция не превращается в упаковку', () => {
  it('матрица покрывает 60 дней', () => {
    expect(DAYS).toHaveLength(60);
  });

  it('ни один день не теряет балл и не выходит из канона', () => {
    const worse: string[] = [];
    const outOfCanon: string[] = [];
    let canonOn = 0, canonOff = 0;
    for (const d of DAYS) {
      const qa = Number(d.on.qualityScore?.total) || 0;
      const qb = Number(d.off.qualityScore?.total) || 0;
      if (qa < qb) worse.push(`${d.key}: ${qb} → ${qa}`);
      if (devOf(d.on, d.p) > 0.03) canonOn++;
      if (devOf(d.off, d.p) > 0.03) canonOff++;
      if (devOf(d.on, d.p) > Math.max(devOf(d.off, d.p), 0.03) + 1e-9) {
        outOfCanon.push(`${d.key}: ${(devOf(d.off, d.p) * 100).toFixed(1)}% → ${(devOf(d.on, d.p) * 100).toFixed(1)}%`);
      }
    }
    expect(worse.join(', ')).toBe('');
    expect(outOfCanon.join(', ')).toBe('');
    expect(canonOn).toBeLessThanOrEqual(canonOff);
  });

  it('«вёдер» >500 г не больше, а яичного белка сверх 250 г — меньше', () => {
    const bOn = DAYS.reduce((s, d) => s + buckets(d.on), 0);
    const bOff = DAYS.reduce((s, d) => s + buckets(d.off), 0);
    expect(bOn).toBeLessThanOrEqual(bOff);
    expect(bOn).toBeLessThan(bOff); // замер: 90 → 88
    const eOn = DAYS.reduce((s, d) => s + eggOver(d.on), 0);
    const eOff = DAYS.reduce((s, d) => s + eggOver(d.off), 0);
    expect(eOn).toBeLessThan(eOff); // замер: 10 → 4
    expect(eOn).toBeLessThanOrEqual(4);
  });

  it('белок дня сохраняется: обмен «белок за белок», а не срез', () => {
    const lost: string[] = [];
    for (const d of DAYS) {
      const pOn = Number(d.on.totals?.p) || 0;
      const pOff = Number(d.off.totals?.p) || 0;
      // Донор подбирается по белку в граммах (шаг 5 г), поэтому допускаем ±2% дня.
      if (Math.abs(pOn - pOff) > Math.max(3, pOff * 0.02)) lost.push(`${d.key}: ${pOff} → ${pOn}`);
    }
    expect(lost.join(', ')).toBe('');
  });

  it('стадия объясняется нотой, а выключенный флаг = прежний план', () => {
    let fired = 0;
    for (const d of DAYS) {
      const notesOn = ((d.on.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      const notesOff = ((d.off.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      expect(notesOff).toHaveLength(0);
      if (notesOn.length > 0) {
        fired++;
        expect(notesOn[0]).toMatch(/белок дня сохранён/);
        // Нота не врёт: в дне реально стало меньше яичного белка (ужата самая крупная порция).
        const maxWhites = (plan: any) => Math.max(0, ...(plan.meals || []).flatMap((m: any) => (m.items || []))
          .filter((i: any) => String(i.id) === 'egg_white').map((i: any) => Number(i.amount) || 0));
        expect(maxWhites(d.on) < maxWhites(d.off) || eggOver(d.on) < eggOver(d.off)).toBe(true);
      }
    }
    expect(fired).toBeGreaterThanOrEqual(1);
  });
});
