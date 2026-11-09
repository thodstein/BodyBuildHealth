/**
 * planner-veg-dense-diet.test.ts — §8.83: малый день строит тарелку плотным овощем,
 * а не пустым гарниром.
 *
 * Дефект (замер осей за 60 дней): 9 дней с микро <70, и 8 из них — cutF50/small60
 * (1240–1600 ккал). RDA не масштабируется по калориям: на дне 1240 ккал овощей почти
 * нет, микро 30–48%. §8.78 здесь не спасает — он меняет «пустой» овощ на плотный, а
 * менять нечего: в дне нет овоща вообще (`cutF50/6/отд`: 39% микро, q 67).
 *
 * Ход: в основной приём без овоща ставится 150 г плотного (брокколи/шпинат/кейл); его
 * белок вычитается из белкового якоря ТОГО ЖЕ приёма, остаток калорий — из гарнира
 * того же приёма. День не разъезжается, канон держится.
 *
 * Порядок важен: §8.83 запускается ПОСЛЕ §8.78 (сначала апгрейд существующего овоща,
 * потом добавление там, где его нет). Обратный порядок на `small60/5/тр` давал два хода
 * в один день и 96 → 95 при том же микро.
 *
 * Замер 60 дней: оценка 93.150 → 93.533 (3 дня лучше, 0 хуже), микро 88.8 → 90.3,
 * канон >3% 3 → 3, бейджи 31 → 31, вёдра 90 → 90, макс. тарелка 887 г без изменений.
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
  vegDenseDiet83: on,
} as any) as any;

const DENSE = new Set(['spinach', 'kale', 'veg_kale', 'broccoli']);
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
const NOTE = '🥬 Малый день:';

const DAYS = PROFILES.flatMap((p) => [4, 5, 6].flatMap((mc) => [true, false].map((tr) => ({
  key: `${p[0]}/${mc}/${tr ? 'тр' : 'отд'}`, p, on: build(p, mc, tr, true), off: build(p, mc, tr, false),
}))));
const FIRED = DAYS.filter((d) => microScore(d.on) !== microScore(d.off) || Number(d.on.qualityScore?.total) !== Number(d.off.qualityScore?.total));

describe('§8.83 малый день — плотный овощ вместо пустого гарнира', () => {
  it('матрица покрывает 60 дней', () => {
    expect(DAYS).toHaveLength(60);
  });

  it('действует только на малых днях (≤1700 ккал): у остальных план не шевелится', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      if (d.p[4] <= 1700) continue;
      const onIds = flat(d.on).map((i: any) => `${i.id}:${Math.round(Number(i.amount) || 0)}`).join(',');
      const offIds = flat(d.off).map((i: any) => `${i.id}:${Math.round(Number(i.amount) || 0)}`).join(',');
      if (onIds !== offIds) bad.push(`${d.key}: состав уехал (${d.p[4]} ккал)`);
      if (((d.on.notes || []) as string[]).some((n) => String(n).startsWith(NOTE))) bad.push(`${d.key}: нота на большом дне`);
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

  it('микро реально прибавилось: ось выше, дефицитных дней меньше (замер 88.8 → 90.3)', () => {
    const mOn = DAYS.reduce((s, d) => s + microScore(d.on), 0) / DAYS.length;
    const mOff = DAYS.reduce((s, d) => s + microScore(d.off), 0) / DAYS.length;
    const lOn = DAYS.reduce((s, d) => s + lowMicro(d.on), 0);
    const lOff = DAYS.reduce((s, d) => s + lowMicro(d.off), 0);
    expect(mOn).toBeGreaterThan(mOff);
    expect(lOn).toBeLessThan(lOff);
  });

  it('добавляется ровно один плотный овощ 150 г в основной приём, где овоща не было', () => {
    const bad: string[] = [];
    let added = 0;
    for (const d of FIRED) {
      (d.on.meals || []).forEach((onM: any, i: number) => {
        const offM = (d.off.meals || [])[i];
        if (!offM) return;
        const onItems = (onM.items || []) as any[];
        const offIds = ((offM.items || []) as any[]).map((x: any) => String(x.id));
        const fresh = onItems.filter((it: any) => !offIds.includes(String(it.id)) && !((offM.items || []) as any[]).some((x: any) => String(x.id) === String(it.id) && Math.round(Number(x.amount) || 0) === Math.round(Number(it.amount) || 0)));
        for (const it of fresh) {
          added++;
          if (!DENSE.has(String(it.id))) bad.push(`${d.key} ${onM.type}: пришёл не плотный овощ (${it.id})`);
          if (String(it.role) !== 'veg') bad.push(`${d.key} ${onM.type}: роль не veg`);
          if (Math.round(Number(it.amount) || 0) < 100) bad.push(`${d.key} ${onM.type}: порция ${it.amount} г`);
          if (!['breakfast', 'lunch', 'dinner'].includes(String(onM.type))) bad.push(`${d.key}: правка в перекусе (${onM.type})`);
          if (offIds.length && ((offM.items || []) as any[]).some((x: any) => String(x.role) === 'veg')) {
            bad.push(`${d.key} ${onM.type}: овощ уже был — это работа §8.78`);
          }
        }
      });
      const onIds = flat(d.on).map((i: any) => String(i.id));
      for (const dense of DENSE) {
        if (onIds.filter((id) => id === dense).length > 1) bad.push(`${d.key}: ${dense} × 2`);
      }
    }
    expect(bad.join(', ')).toBe('');
    expect(added).toBeGreaterThanOrEqual(3); // замер: 3 дня на 60
  });

  it('день не пересобирается: калории, белок и жир держатся на месте', () => {
    const bad: string[] = [];
    for (const d of FIRED) {
      const dK = Math.abs(Number(d.on.totals?.kcal) - Number(d.off.totals?.kcal));
      const dP = Math.abs(Number(d.on.totals?.p) - Number(d.off.totals?.p));
      const dF = Math.abs(Number(d.on.totals?.f) - Number(d.off.totals?.f));
      // Округление компенсации (якорь режется с шагом 5 г) даёт до 30 ккал дня — 1–2%,
      // внутри канона 3%; «день не пересобирается» проверяется отдельно по Б/Ж.
      if (dK > Math.max(30, Number(d.off.totals?.kcal || 0) * 0.02)) bad.push(`${d.key}: Δккал ${dK.toFixed(0)}`);
      if (dP > 3) bad.push(`${d.key}: Δбелка ${dP.toFixed(1)} г`);
      if (dF > 1.5) bad.push(`${d.key}: Δжира ${dF.toFixed(1)} г`);
    }
    expect(bad.join(', ')).toBe('');
  });

  it('ход объясняется нотой; выключенный флаг = прежний план', () => {
    let fired = 0;
    for (const d of DAYS) {
      const onNotes = ((d.on.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      const offNotes = ((d.off.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      expect(offNotes).toHaveLength(0);
      const changed = microScore(d.on) !== microScore(d.off) || Number(d.on.qualityScore?.total) !== Number(d.off.qualityScore?.total);
      if (changed) {
        fired++;
        expect(onNotes.length).toBeGreaterThan(0);
        expect(onNotes[0]).toMatch(/микро важнее объёма/);
      } else {
        expect(onNotes).toHaveLength(0);
      }
    }
    expect(fired).toBeGreaterThanOrEqual(3);
  });
});
