/**
 * planner-peri-promise-8123.test.ts — §8.123 «пери-окно не обещает того, чего нет в тарелке».
 *
 * Дефект (замер 80 тренировочных дней, сетка §8.112): 33 окна обещали 21–30 г углеводов,
 * а тарелка несла 0–3 г. Механика (воспроизведена пошаговыми чекпойнтами):
 *   1) билдер окна кладёт болюс по бюджету — сухие 50 г (паста соба / крем риса);
 *   2) «посадка дня» при сходимости ужимает его до 19–23 г сухого — ниже смыслового пола;
 *   3) проход «мелочь <30 г» снимает позицию целиком.
 * Цель окна при этом оставалась 22/27 г У, а ноты дня обещали «сыворотка + быстрые углеводы»
 * и «белок + медленные углеводы». Пользователь видел обещание на пустой тарелке.
 *
 * Правило §8.123: витрина окна = ФАКТ тарелки. Если фактическая доза <60 % обещанной,
 * target окна приводится к факту, rationale и ноты дня перестают обещать дозу,
 * а нота §8.113b («окна остаются углеводными») не печатается, если окно всё же несёт белок.
 * Граммы тарелки не меняются — калибровка дня (сходимость, обрезки) не страдает.
 *
 * Замок держит три вещи на сетке 80 дней:
 *  1. обещание окна выполнено: target У/Б ≤ факта/0.6 (иначе витрина врёт);
 *  2. ни одна нота не обещает углеводы окну, где их <20 г;
 *  3. день не хуже канона: ≤3 % отклонения и ни одного обрезка.
 */

import { describe, expect, it } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { MIN_MEANINGFUL_G } from '../planner-quality-score';

type Profile = { id: string; w: number; k: number; p: number; f: number; c?: number };

const PROFILES: Profile[] = [
  { id: 'p500', w: 110, k: 4600, p: 500, f: 120 },
  { id: 'c1500', w: 110, k: 8370, p: 300, f: 130, c: 1500 },
  { id: 'hugeCarb', w: 100, k: 6700, p: 250, f: 100 },
  { id: 'mass110', w: 110, k: 5200, p: 260, f: 120 },
  { id: 'normal90', w: 90, k: 3000, p: 200, f: 80 },
  { id: 'mid75', w: 75, k: 2400, p: 180, f: 70 },
  { id: 'small60', w: 60, k: 1600, p: 150, f: 45 },
  { id: 'cutF50', w: 50, k: 1240, p: 110, f: 40 },
  { id: 'recomp80', w: 80, k: 2200, p: 200, f: 60 },
  { id: 'keto85', w: 85, k: 2400, p: 180, f: 150 },
];

const carbsFor = (p: Profile) => (p.c && p.c > 0 ? p.c : Math.max(0, Math.round((p.k - 4 * p.p - 9 * p.f) / 4)));

const build = (p: Profile, mc: number, manual: boolean): any => buildDayPlan({
  weightKg: p.w, lbmKg: Math.round(p.w * 0.82), bodyFatPct: 18, sex: 'male',
  goalKcal: p.k, goalProteinG: p.p, goalFatG: p.f, goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
} as unknown as MealPlanInput) as any;

const PERI = ['preworkout', 'postworkout', 'intra'];
const isCarbDose = (it: any) => it.role === 'carb_slow' || it.role === 'carb_fast'
  || (it.role === 'liquid' && (Number(it.c) || 0) > 0.5);
const isProt = (it: any) => it.role === 'protein' || it.role === 'fast_protein' || it.role === 'slow_protein';
const isPowder = (id: string) => /^(whey|supp_|casein)/i.test(String(id || ''));

const carbsOf = (m: any) => (m.items || []).filter(isCarbDose).reduce((s: number, it: any) => s + (Number(it.c) || 0), 0);
const protOf = (m: any) => (m.items || []).filter(isProt).reduce((s: number, it: any) => s + (Number(it.p) || 0), 0);

describe('§8.123 — пери-окно не обещает того, чего нет в тарелке', () => {
  const days: Array<{ key: string; manual: boolean; plan: any }> = [];
  for (const manual of [false, true]) {
    for (const p of PROFILES) {
      for (const mc of [3, 4, 5, 6]) {
        days.push({ key: `${manual ? 'руч' : 'авт'}/${p.id}/${mc}/тр`, manual, plan: build(p, mc, manual) });
      }
    }
  }

  it('сетка 80 тренировочных дней собрана', () => {
    expect(days.length).toBe(80);
    expect(days.filter(d => d.manual).length).toBe(40);
    expect(days.filter(d => !d.manual).length).toBe(40);
  });

  it('обещание окна выполнено: тарелка несёт ≥60 % цели по У и Б', () => {
    const bad: string[] = [];
    for (const { key, plan } of days) {
      for (const m of plan.meals || []) {
        if (!PERI.includes(String(m.type))) continue;
        const t = (m.target || {}) as any;
        const pc = Number(t.c) || 0;
        const pp = Number(t.p) || 0;
        const ac = carbsOf(m);
        const ap = protOf(m);
        if (pc > 0 && ac < pc * 0.6) bad.push(`${key} ${m.type}: цель ${pc} У, факт ${Math.round(ac)}`);
        if (pp > 0 && ap < pp * 0.6) bad.push(`${key} ${m.type}: цель ${pp} Б, факт ${Number(ap).toFixed(1)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('нота не обещает углеводы окну, где их нет (<20 г)', () => {
    const bad: string[] = [];
    for (const { key, plan } of days) {
      const prew = (plan.meals || []).find((m: any) => m.type === 'preworkout');
      const postw = (plan.meals || []).find((m: any) => m.type === 'postworkout');
      for (const n of plan.notes || []) {
        const s = String(n);
        if (/^Pre-workout: белок \+ медленные углеводы/.test(s) && prew && carbsOf(prew) < 20) {
          bad.push(`${key}: нота пред-трена обещает У при ${Math.round(carbsOf(prew))} г`);
        }
        if (/^Post-workout: сыворотка \+ быстрые углеводы/.test(s) && postw && carbsOf(postw) < 20) {
          bad.push(`${key}: нота пост-трена обещает У при ${Math.round(carbsOf(postw))} г`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('нота §8.113b «остаются углеводными» не печатается, когда окно несёт цельный белок', () => {
    const bad: string[] = [];
    for (const { key, plan } of days) {
      const wins = (plan.meals || []).filter((m: any) => ['preworkout', 'postworkout'].includes(String(m.type)));
      const winProt = wins.reduce((s: number, m: any) => s + (m.items || [])
        .filter((it: any) => it.role === 'protein' && !isPowder(it.id) && !it._fixedGrams)
        .reduce((a: number, it: any) => a + (Number(it.p) || 0), 0), 0);
      const claims = (plan.notes || []).some((n: any) => /^🍽️ Предтрен\/пост-трен остаются углеводными/.test(String(n)));
      if (claims && winProt > 0) bad.push(`${key}: нота «остаются углеводными» при ${Math.round(winProt)} г цельного белка в окнах`);
    }
    expect(bad).toEqual([]);
  });

  it('день не хуже канона: ≤3 % и ни одного обрезка', () => {
    const devs: number[] = [];
    const crumbs: string[] = [];
    for (const { key, plan } of days) {
      devs.push(Number(plan.deviationPct) || 0);
      for (const m of plan.meals || []) {
        for (const it of (m.items || []) as any[]) {
          const g = Number(it.amount) || 0;
          const role = String(it.role || '');
          if (it._fixedGrams || g <= 0) continue;
          const floor = role === 'carb_slow' ? Number(MIN_MEANINGFUL_G.carb_slow || 30)
            : role === 'carb_fast' ? Number(MIN_MEANINGFUL_G.carb_fast || 20)
              : role === 'protein' ? (isPowder(it.id) ? Number(MIN_MEANINGFUL_G.fast_protein || 20) : Number(MIN_MEANINGFUL_G.protein || 40))
                : role === 'fast_protein' || role === 'slow_protein' ? Number(MIN_MEANINGFUL_G.fast_protein || 20)
                  : 0;
          if (floor > 0 && g < floor) crumbs.push(`${key} ${m.type} ${it.id}:${Math.round(g)} (${role})`);
        }
      }
    }
    expect(Math.max(...devs)).toBeLessThanOrEqual(3.01);
    expect(crumbs).toEqual([]);
  });
});
