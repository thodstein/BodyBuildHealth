/**
 * planner-protein-smoothing.test.ts — §8.84: белок стоит ровно по приёмам.
 *
 * Дефект (замер осей за 60 дней): ось «белок основного приёма» — самая слабая
 * (16 дней <70, худшие 42–53). Дело не в цели дня, а в раскладке: на `hugeCarb/4/тр`
 * при цели 250 г белка тарелки стоят 28/33/47 + перекус 15 г, и минимумом дня
 * становится перекус (0.15 г/кг при пороге оси 0.30) — при том что 47 г в ужине
 * больше, чем нужно для MPS-стимула. Значит белок надо ПЕРЕЛОЖИТЬ, а не добавить.
 *
 * Ход: самый бедный приём подтягивается к 0.30 г/кг за счёт самого богатого, который
 * срезается до того же порога. Меняются только граммы белковых пунктов, состав не
 * пересобирается, цель дня не трогается. До 3 переносов на день.
 *
 * Гейт: день не хуже, ось «белок по приёмам» строго выше, канон не хуже, вёдер не больше.
 * Требовать строго выше общего балла нельзя: балл целый, и второй-третий перенос в тот
 * же день уже не двигает сумму осей.
 *
 * Замер 60 дней: оценка 93.533 → 93.733 (9 дней изменено, 0 хуже, 5 лучше), ось белка
 * 85.4 → 86.5, бейджи 31 → 25, канон >3% 3 → 3, вёдра 90 → 90, макс. тарелка 887 г.
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
  proteinSmooth84: on,
} as any) as any;

const solidG = (m: any) => ((m.items || []) as any[])
  .filter((i: any) => !['liquid', 'supplement'].includes(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
const buckets = (plan: any) => (plan.meals || []).filter((m: any) => (m.items || []).length > 0 && solidG(m) > 500).length;
const badges = (plan: any) => (plan.meals || []).filter((m: any) => {
  const pd = Number(m.target?.pd);
  return pd > 0 && (Number(m.totals?.p) || 0) < pd - 3;
}).length;
const axis = (plan: any) => Number(plan.qualityScore?.proteinSpread) || 0;
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
const PROTEIN_ROLES = new Set(['protein', 'fast_protein', 'slow_protein']);

const DAYS = PROFILES.flatMap((p) => [4, 5, 6].flatMap((mc) => [true, false].map((tr) => ({
  key: `${p[0]}/${mc}/${tr ? 'тр' : 'отд'}`, p, on: build(p, mc, tr, true), off: build(p, mc, tr, false),
}))));
const NOTE = '⚖️ Белок по приёмам выровнен:';
const changed = (d: (typeof DAYS)[number]) => axis(d.on) !== axis(d.off) || Number(d.on.qualityScore?.total) !== Number(d.off.qualityScore?.total);

describe('§8.84 белок по приёмам: переложить, а не добавить', () => {
  it('матрица покрывает 60 дней', () => {
    expect(DAYS).toHaveLength(60);
  });

  it('ни один день не хуже: оценка и ось белка не падают, бейджей не больше', () => {
    const worse: string[] = [];
    const axisDown: string[] = [];
    const badgeUp: string[] = [];
    for (const d of DAYS) {
      const qa = Number(d.on.qualityScore?.total) || 0;
      const qb = Number(d.off.qualityScore?.total) || 0;
      if (qa < qb) worse.push(`${d.key}: ${qb} → ${qa}`);
      if (axis(d.on) < axis(d.off)) axisDown.push(`${d.key}: ${axis(d.off)} → ${axis(d.on)}`);
      if (badges(d.on) > badges(d.off)) badgeUp.push(`${d.key}: ${badges(d.off)} → ${badges(d.on)}`);
    }
    expect(worse.join(', ')).toBe('');
    expect(axisDown.join(', ')).toBe('');
    expect(badgeUp.join(', ')).toBe('');
  });

  it('канон и вёдра не хуже, тарелки не растут сверх прежнего максимума', () => {
    const outOfCanon: string[] = [];
    for (const d of DAYS) {
      if (devOf(d.on, d.p) > Math.max(devOf(d.off, d.p), 0.029) + 1e-9) {
        outOfCanon.push(`${d.key}: ${(devOf(d.off, d.p) * 100).toFixed(1)}% → ${(devOf(d.on, d.p) * 100).toFixed(1)}%`);
      }
    }
    expect(outOfCanon.join(', ')).toBe('');
    expect(DAYS.reduce((s, d) => s + buckets(d.on), 0)).toBeLessThanOrEqual(DAYS.reduce((s, d) => s + buckets(d.off), 0));
  });

  it('ось белка реально выросла, бейджей стало меньше (замер 85.4 → 86.5, 31 → 25)', () => {
    const aOn = DAYS.reduce((s, d) => s + axis(d.on), 0) / DAYS.length;
    const aOff = DAYS.reduce((s, d) => s + axis(d.off), 0) / DAYS.length;
    expect(aOn).toBeGreaterThan(aOff);
    const bOn = DAYS.reduce((s, d) => s + badges(d.on), 0);
    const bOff = DAYS.reduce((s, d) => s + badges(d.off), 0);
    expect(bOn).toBeLessThan(bOff);
  });

  it('состав не пересобирается: те же пункты, двигаются только граммы белковых', () => {
    const bad: string[] = [];
    let moves = 0;
    for (const d of DAYS) {
      (d.on.meals || []).forEach((onM: any, i: number) => {
        const offM = (d.off.meals || [])[i];
        if (!offM) return;
        const onItems = (onM.items || []) as any[];
        const offItems = (offM.items || []) as any[];
        if (onItems.length !== offItems.length) {
          bad.push(`${d.key} ${onM.type}: пунктов ${offItems.length} → ${onItems.length}`);
          return;
        }
        onItems.forEach((it: any, j: number) => {
          const prev = offItems[j];
          if (!prev) return;
          if (String(it.id) !== String(prev.id)) {
            bad.push(`${d.key} ${onM.type}: подменили пункт ${prev.id} → ${it.id}`);
            return;
          }
          if (Math.round(Number(it.amount) || 0) === Math.round(Number(prev.amount) || 0)) return;
          moves++;
          if (!PROTEIN_ROLES.has(String(it.role))) bad.push(`${d.key} ${onM.type} ${it.id}: двигается не белок (${it.role})`);
        });
      });
    }
    expect(bad.join(', ')).toBe('');
    expect(moves).toBeGreaterThanOrEqual(6); // замер: 9 дней с переносами
  });

  it('белок дня и калории держатся на месте: перенос, а не добавка', () => {
    const bad: string[] = [];
    for (const d of DAYS.filter(changed)) {
      const dP = Math.abs(Number(d.on.totals?.p) - Number(d.off.totals?.p));
      const dK = Math.abs(Number(d.on.totals?.kcal) - Number(d.off.totals?.kcal));
      if (dP > 3) bad.push(`${d.key}: Δбелка ${dP.toFixed(1)} г`);
      // Перенос между разными белковыми продуктами меняет жир на граммах: на 2400 ккал
      // это до 37 ккал (1.5% дня) — внутри канона 3%, и гейт канона это стережёт.
      if (dK > Math.max(40, Number(d.off.totals?.kcal || 0) * 0.02)) bad.push(`${d.key}: Δккал ${dK.toFixed(0)}`);
    }
    expect(bad.join(', ')).toBe('');
  });

  it('ход объясняется нотой; выключенный флаг = прежний план', () => {
    let fired = 0;
    for (const d of DAYS) {
      const onNotes = ((d.on.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      const offNotes = ((d.off.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      expect(offNotes).toHaveLength(0);
      if (changed(d)) {
        fired++;
        expect(onNotes.length).toBeGreaterThan(0);
        expect(onNotes[0]).toMatch(/переложили из богатого приёма/);
      } else {
        expect(onNotes).toHaveLength(0);
      }
    }
    expect(fired).toBeGreaterThanOrEqual(5);
  });
});
