/**
 * planner-powder-portion.test.ts — §8.73: порошок не мельче полупорции.
 *
 * Дефект (замер 60 дней): 27 «пустых ложек» — порция порошка меньше 20 г в тарелке.
 * Самая громкая: `recomp80/6/тр` «Полдник — whey_isolate 11 г» (8 г белка) при цели
 * 19 г и пороге `pd` 23 г; день недобирал белок 193.5/200 = −3.25% и висел «вне канона».
 * 11 г изолята — не еда и не порция: пользователь видит пустую ложку и красный бейдж.
 *
 * Замок держит контракт стадии:
 *  1. ни один день не теряет балл и не выходит из канона 3%;
 *  2. «пустых ложек» (<20 г) строго меньше, новых не появляется;
 *  3. шаг не ухудшает отклонение белка дня от цели (день с −1.3% не перелетает в +2.8%);
 *  4. «вёдер» >500 г не больше;
 *  5. меняются только граммы порошка (до ровно 20 г), состав блюд не пересобирается;
 *  6. стадия объясняется нотой; выключенный флаг = прежний план.
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
  powderMinPortion73: on,
  // §8.74 (огрызок — не порция) выключается в обоих вариантах: она меняет состав блюд
  // и мешала бы проверять «состав тот же». Её собственный замок — planner-fruit-crumb.test.ts.
  fruitCrumb74: false,
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
const isPowder = (id: any) => /whey|isolate|casein|protein_powder/i.test(String(id || ''));
const scoops = (plan: any, maxG = 20) => (plan.meals || []).flatMap((m: any) => (m.items || []))
  .filter((i: any) => isPowder(i.id) && (Number(i.amount) || 0) < maxG).length;

const DAYS: Array<{ key: string; p: P; on: any; off: any }> = [];
for (const p of PROFILES) for (const mc of [4, 5, 6]) for (const tr of [true, false]) {
  DAYS.push({ key: `${p[0]}/${mc}/${tr ? 'тр' : 'отд'}`, p, on: build(p, mc, tr, true), off: build(p, mc, tr, false) });
}
const NOTE = '🥄 Порошок не мельче полупорции:';

describe('§8.73 порошок: пустая ложка — не порция', () => {
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
    expect(canonOn).toBeLessThanOrEqual(canonOff); // замер: 4 → 3
  });

  it('«пустых ложек» строго меньше и «вёдер» не больше', () => {
    const sOn = DAYS.reduce((s, d) => s + scoops(d.on), 0);
    const sOff = DAYS.reduce((s, d) => s + scoops(d.off), 0);
    expect(sOn).toBeLessThan(sOff); // замер: 27 → 23
    const wOn = DAYS.reduce((s, d) => s + buckets(d.on), 0);
    const wOff = DAYS.reduce((s, d) => s + buckets(d.off), 0);
    expect(wOn).toBeLessThanOrEqual(wOff);
  });

  it('шаг не ухудшает отклонение белка дня от цели', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const goal = d.p[5];
      const before = Math.abs(Number(d.off.totals?.p) - goal);
      const after = Math.abs(Number(d.on.totals?.p) - goal);
      if (after > before + 0.5) {
        bad.push(`${d.key}: ${Number(d.off.totals?.p).toFixed(1)} → ${Number(d.on.totals?.p).toFixed(1)} (цель ${goal})`);
      }
    }
    expect(bad.join(', ')).toBe('');
  });

  it('меняются только граммы порошка — ровно до 20 г, состав блюда тот же', () => {
    const bad: string[] = [];
    let changed = 0;
    for (const d of DAYS) {
      (d.on.meals || []).forEach((on: any, idx: number) => {
        const off = (d.off.meals || [])[idx];
        if (!off) return;
        const onIds = (on.items || []).map((i: any) => i.id).join('|');
        const offIds = (off.items || []).map((i: any) => i.id).join('|');
        if (onIds !== offIds) bad.push(`${d.key} ${on.type}: состав блюда изменился`);
        (on.items || []).forEach((it: any, j: number) => {
          const prev = (off.items || [])[j];
          if (!prev) return;
          const a = Number(it.amount) || 0;
          const b = Number(prev.amount) || 0;
          if (Math.round(a) === Math.round(b)) return;
          changed++;
          if (!isPowder(it.id) || Math.round(a) !== 20) {
            bad.push(`${d.key} ${on.type} ${it.id}: ${b} → ${a}`);
          }
        });
      });
    }
    expect(bad.join(', ')).toBe('');
    expect(changed).toBeGreaterThanOrEqual(1);
  });

  it('стадия объясняется нотой, выключенный флаг = прежний план', () => {
    let fired = 0;
    for (const d of DAYS) {
      const notesOn = ((d.on.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      const notesOff = ((d.off.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      expect(notesOff).toHaveLength(0);
      const changed = scoops(d.on) !== scoops(d.off) || Number(d.on.totals?.p) !== Number(d.off.totals?.p);
      if (notesOn.length > 0) {
        fired++;
        expect(changed).toBe(true);
        expect(notesOn[0]).toMatch(/без новой еды/);
      }
    }
    expect(fired).toBeGreaterThanOrEqual(2);
  });
});
