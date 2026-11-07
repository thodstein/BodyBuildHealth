/**
 * planner-note-truth.test.ts — §8.64: ноты не спорят с планом.
 *
 * Дефект (замер 60 дней): тайминговые ноты считались на ПРОМЕЖУТОЧНЫХ тарелках
 * (≈строка 6000), а §8.57/§8.59/§8.63 позже перекладывали белок. В итоге нота
 * «MPS gap 8.3ч … добавьте белковый перекус» стояла ровно на тех днях, где
 * перекус УЖЕ был (cutF50/5/тр: 40 г в 15:30), а строка «"Завтрак" недобирает
 * (27 г), цель ≥0.30 г/кг» сама себе противоречила (27/90 = 0.30).
 *
 * Замок проверяет САМОСОГЛАСОВАННОСТЬ текста с финальной тарелкой, а не красоту
 * формулировок: правишь ноту — обязан не соврать.
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
const build = (p: (typeof PROFILES)[number], mealsCount: number, isTrainingDay: boolean) => buildDayPlan({
  weightKg: p[1], lbmKg: p[2], bodyFatPct: 18, sex: p[3],
  goalKcal: p[4], goalProteinG: p[5], goalFatG: p[6],
  goalCarbsG: p[7] || Math.max(0, Math.round((p[4] - 4 * p[5] - 9 * p[6]) / 4)),
  mealsCount, isTrainingDay, trainStartMin: isTrainingDay ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
} as any) as any;

const toMin = (s: any): number => {
  const m = typeof s === 'string' ? s.match(/^(\d{1,2}):(\d{2})/) : null;
  if (!m) return -1;
  const h = Number(m[1]), mm = Number(m[2]);
  return h >= 0 && h < 24 && mm >= 0 && mm < 60 ? h * 60 + mm : -1;
};

type Timeline = Array<{ t: number; label: string; p: number }>;

const timelineOf = (plan: any): Timeline => (plan.meals as any[])
  .filter((m) => (m.items || []).length > 0 && toMin(m.time) >= 0)
  .map((m) => ({ t: toMin(m.time), label: String(m.label || m.type || ''), p: Number(m.totals?.p) || 0 }))
  .sort((a, b) => a.t - b.t);

const DAYS: Array<{ key: string; weightKg: number; goalP: number; plan: any }> = [];
for (const p of PROFILES) for (const mc of [4, 5, 6]) for (const tr of [true, false]) {
  DAYS.push({ key: `${p[0]}/${mc}/${tr ? 'тр' : 'отд'}`, weightKg: p[1], goalP: p[5], plan: build(p, mc, tr) });
}

describe('§8.64 ноты не спорят с финальным планом', () => {
  it('матрица покрывает 60 дней', () => {
    expect(DAYS).toHaveLength(60);
  });

  it('«MPS gap»: совет совпадает с тем, что в плане реально есть', () => {
    let notesSeen = 0;
    for (const d of DAYS) {
      const gapNotes = (d.plan.notes as string[]).filter((n) => typeof n === 'string' && n.startsWith('⏰ MPS gap '));
      expect(gapNotes.length).toBeLessThanOrEqual(1);
      const allNotes = (d.plan.notes as string[]).filter((n) => typeof n === 'string');
      const hasWeakNote = allNotes.some((n) => n.startsWith('Белок по приёмам:') && n.includes('недобирает'));
      const note = gapNotes[0];
      // Пересчёт по финалу: разрыв между фактическими кормлениями ≥25 г.
      const feeds = timelineOf(d.plan).filter((f) => f.p >= 25);
      let gap = 0, from: (typeof feeds)[number] | null = null, to: (typeof feeds)[number] | null = null;
      for (let i = 1; i < feeds.length; i++) {
        const g = feeds[i].t - feeds[i - 1].t;
        if (g > gap) { gap = g; from = feeds[i - 1]; to = feeds[i]; }
      }
      const between = feeds.length >= 2 && from && to ? timelineOf(d.plan).filter((f) => f.t > from!.t && f.t < to!.t) : [];
      if (!note) {
        // Ноты нет — тогда (а) разрыва нет, либо (б) он уже назван в строке «недобирает».
        expect(gap <= 240 || (between.length > 0 && hasWeakNote)).toBe(true);
        continue;
      }
      notesSeen++;
      expect(gap).toBeGreaterThan(240); // иначе ноты быть не должно
      if (between.length > 0) {
        // Есть приём в промежутке — просим усилить ЕГО, а не добавлять новый.
        expect(hasWeakNote).toBe(false); // иначе дубль совета — в «Белок по приёмам»
        expect(note).toContain('доведите его до ≥25 г');
        expect(note).not.toContain('добавьте белковый перекус');
        const weakest = [...between].sort((a, b) => a.p - b.p)[0];
        expect(note).toContain(`«${weakest.label}»`);
        expect(weakest.p).toBeLessThan(25);
      } else {
        expect(note).toContain('добавьте белковый перекус');
      }
    }
    expect(notesSeen).toBeGreaterThan(0);
  });

  it('«Приёмы слишком близко»: названная пара действительно ближе 60 мин', () => {
    for (const d of DAYS) {
      const close = (d.plan.notes as string[]).filter((n) => typeof n === 'string' && n.startsWith('⏱ Приёмы слишком близко'));
      expect(close.length).toBeLessThanOrEqual(1);
      const tl = timelineOf(d.plan);
      const isWin = (l: string) => /предтренировочн|пост-тренировочный|посттренировочн|Внутри тренировки|preworkout|postworkout|intra/i.test(l);
      let minGap = Infinity, a = '', b = '';
      for (let i = 1; i < tl.length; i++) {
        const g = tl[i].t - tl[i - 1].t;
        if (isWin(tl[i].label) || isWin(tl[i - 1].label)) continue;
        if (g > 0 && g < minGap) { minGap = g; a = tl[i - 1].label; b = tl[i].label; }
      }
      if (!close.length) continue;
      expect(minGap).toBeLessThan(60);
      expect(close[0]).toContain(`«${a}» → «${b}»`);
      expect(close[0]).toContain(`${minGap} мин`);
    }
  });

  it('«недобирает (N г = X г/кг)»: число согласовано с порогом, а не противоречит ему', () => {
    let checked = 0;
    for (const d of DAYS) {
      for (const n of d.plan.notes as string[]) {
        if (typeof n !== 'string' || !n.startsWith('Белок по приёмам:')) continue;
        const m = n.match(/недобирает \((\d+(?:\.\d+)?) г = (\d+(?:\.\d+)?) г\/кг\), цель ≥(\d+) г/);
        if (!m) continue;
        checked++;
        const g = Number(m[1]), gpk = Number(m[2]), floor = Number(m[3]);
        expect(g).toBeLessThan(floor);            // «недобирает 27 г при цели ≥27» — запрещено
        expect(gpk).toBeLessThan(0.3);            // доля ниже порога, а не «0.3 = норма»
        expect(Math.floor((g / d.weightKg) * 100) / 100).toBeCloseTo(gpk, 1);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('«Большой интервал» появляется только при реальном разрыве >5 ч', () => {
    for (const d of DAYS) {
      const big = (d.plan.notes as string[]).filter((n) => typeof n === 'string' && n.startsWith('⏱ Большой интервал '));
      expect(big.length).toBeLessThanOrEqual(1);
      const tl = timelineOf(d.plan);
      let maxGap = 0;
      for (let i = 1; i < tl.length; i++) maxGap = Math.max(maxGap, tl[i].t - tl[i - 1].t);
      if (!big.length) continue;
      expect(maxGap).toBeGreaterThan(300);
      expect(big[0]).toContain(`${Math.round(maxGap / 60)} ч`);
    }
  });

  it('§8.65 ужин не прилипает к предсну (<60 мин запрещено)', () => {
    let withPresleep = 0;
    for (const d of DAYS) {
      const meals = (d.plan.meals as any[]).filter((m) => (m.items || []).length > 0);
      const dinner = meals.find((m) => m.type === 'dinner');
      const ps = meals.find((m) => m.type === 'presleep');
      if (!dinner) continue;
      if (ps) {
        withPresleep++;
        const gap = ((toMin(ps.time) - toMin(dinner.time)) + 1440) % 1440;
        expect(gap).toBeGreaterThanOrEqual(60);
        // И сам предсон остаётся «за 30 мин до сна», а не отъезжает.
        expect(ps.time).toBe('21:30');
      }
    }
    expect(withPresleep).toBeGreaterThan(30);
  });

  it('§8.66 «порог приёма снижен» — только когда день не оплачивает 0.30 г/кг', () => {
    const FIXED = new Set(['preworkout', 'postworkout', 'intra', 'presleep']);
    let capped = 0;
    for (const d of DAYS) {
      const meals = (d.plan.meals as any[]).filter((m) => (m.items || []).length > 0);
      const reg = meals.filter((m) => Number.isFinite(Number(m.target?.pd)));
      const fixedP = meals.filter((m) => FIXED.has(String(m.type)))
        .reduce((s, m) => s + (Number(m.target?.p) || 0), 0);
      const floor = Math.round(0.3 * d.weightKg);
      const budget = Math.max(0, d.goalP - fixedP);
      const fair = reg.length > 0 ? budget / reg.length : floor;
      const note = (d.plan.notes as string[]).find((x) => typeof x === 'string' && x.startsWith('⚖️ Белка дня '));
      if (note) {
        capped++;
        // Нота — только когда округлённый бюджет на приём ниже порога.
        expect(Math.round(fair)).toBeLessThan(floor);
        const want = Math.min(floor, Math.max(Math.min(15, floor), Math.round(fair)));
        expect(note).toContain(`порог приёма снижен до ${want} г`);
      } else {
        // И наоборот: день, который явно не оплачивает порог, обязан объяснить это.
        expect(Math.round(fair)).toBeGreaterThanOrEqual(floor - 1);
      }
      // Порог-для-показа никогда не выше 0.30 г/кг.
      for (const m of reg) expect(Number(m.target.pd)).toBeLessThanOrEqual(floor);
    }
    expect(capped).toBeGreaterThan(0);
  });
});
