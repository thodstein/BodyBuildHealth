/**
 * planner-hv-snack-protein.test.ts — §8.72: перекус на HV-дне не голодает по белку.
 *
 * Дефект (замер 60 дней): 59 красных бейджей «Б факт / порог», из них 53 — перекусы
 * high-volume дней (`c1500` 4/день, `hugeCarb` 3–5/день, `mass110` 2/день): день несёт
 * 9–13 кормлений, перекус получает 8–18 г белка при пороге `pd` 21–28 г. §8.63 (перенос
 * белка в слабый приём) на HV-днях отключён по построению.
 *
 * Почему нельзя просто «снять с основного приёма»: на HV-дне завтрак/обед/ужин стоят
 * ровно на MPS-полу 0.30 г/кг (110 кг → 33 г: завтрак 44, обед 33, ужин 35), а день
 * 300 г белка на 13 кормлений физически даёт ~21 г на приём. Замер варианта «донор —
 * любой приём»: 25 бейджей снимается, но ужин отдаёт курицу 75 → 65 г и падает
 * `planner-realism-guarantees` F1.8 («цельный белок основного приёма ≥75 г у атлетов
 * ≥80 кг»). Поэтому донор — сначала СВОЙ класс (перекус с запасом над `pd`, 27–29 г),
 * затем пери-окно сверх своего `target.p`, и только в последнюю очередь основной приём
 * строго выше пола.
 *
 * Замок держит контракт стадии:
 *  1. ни один день не теряет балл качества и не выходит из канона 3%;
 *  2. бейджей строго меньше (замер: 59 → 50), «вёдер» >500 г не больше;
 *  3. белок дня сохранён (±1.5 г) — это перенос, а не срез;
 *  4. основной приём, стоявший на MPS-полу, не опускается ниже него;
 *  5. порции: шаг 5 г, еда ≥40 г, порошок/яичный белок ≥10 г, ≤200 г;
 *  6. стадия работает только на HV-днях; выключенный флаг = прежний план.
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
  // §8.84 (перенос белка между приёмами) изолирован: замок мерит только свою стадию.
  proteinSmooth84: false,
  hvSnackProtein72: on,
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
/** Бейдж приёма: «Б факт / порог», показывается только на недобор до `pd` (−3). */
const badges = (plan: any) => (plan.meals || []).filter((m: any) => Number(m.target?.pd) > 0
  && (Number(m.totals?.p) || 0) < Number(m.target.pd) - 3);
const PROT = new Set(['protein', 'fast_protein', 'slow_protein']);
const isPowder = (id: any) => /whey|isolate|casein|protein_powder|яичн.*бел|egg_white/i.test(String(id || ''));
const isMain = (m: any) => ['breakfast', 'lunch', 'dinner'].includes(String(m.type || ''));

const DAYS: Array<{ key: string; p: P; on: any; off: any }> = [];
for (const p of PROFILES) for (const mc of [4, 5, 6]) for (const tr of [true, false]) {
  DAYS.push({ key: `${p[0]}/${mc}/${tr ? 'тр' : 'отд'}`, p, on: build(p, mc, tr, true), off: build(p, mc, tr, false) });
}
const NOTE = '🥩 Перекусы не голодают:';

describe('§8.72 перекус HV-дня: белок перекуса держится порогом', () => {
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

  it('бейджей строго меньше, «вёдер» >500 г — не больше', () => {
    const bOn = DAYS.reduce((s, d) => s + badges(d.on).length, 0);
    const bOff = DAYS.reduce((s, d) => s + badges(d.off).length, 0);
    expect(bOn).toBeLessThan(bOff); // замер: 59 → 50
    expect(bOn).toBeLessThanOrEqual(50);
    const wOn = DAYS.reduce((s, d) => s + buckets(d.on), 0);
    const wOff = DAYS.reduce((s, d) => s + buckets(d.off), 0);
    expect(wOn).toBeLessThanOrEqual(wOff);
  });

  it('белок дня сохранён: перенос, а не срез', () => {
    const lost: string[] = [];
    for (const d of DAYS) {
      const pOn = Number(d.on.totals?.p) || 0;
      const pOff = Number(d.off.totals?.p) || 0;
      if (Math.abs(pOn - pOff) > 1.5) lost.push(`${d.key}: ${pOff.toFixed(1)} → ${pOn.toFixed(1)}`);
    }
    expect(lost.join(', ')).toBe('');
  });

  it('пери-окно не отдаёт ниже своего контракта, перекус-донор не ниже порога', () => {
    const broke: string[] = [];
    const FIXED = new Set(['preworkout', 'postworkout', 'intra', 'presleep']);
    for (const d of DAYS) {
      (d.off.meals || []).forEach((off: any, idx: number) => {
        const on = (d.on.meals || [])[idx];
        if (!on || !FIXED.has(String(off.type || ''))) return;
        const tgt = Number(off.target?.p) || 0;
        const pOff = Number(off.totals?.p) || 0;
        const pOn = Number(on.totals?.p) || 0;
        if (tgt > 0 && pOff >= tgt && pOn < tgt - 0.5) {
          broke.push(`${d.key} ${off.type}: ${pOff.toFixed(1)} → ${pOn.toFixed(1)} (контракт ${tgt})`);
        }
      });
    }
    expect(broke.join(', ')).toBe('');
  });

  it('основной приём, стоявший на MPS-полу, не опускается ниже него', () => {
    const dropped: string[] = [];
    for (const d of DAYS) {
      const w = d.p[1];
      const floor = 0.30 * w;
      (d.off.meals || []).forEach((off: any, idx: number) => {
        if (!isMain(off)) return;
        const on = (d.on.meals || [])[idx];
        if (!on) return;
        const pOff = Number(off.totals?.p) || 0;
        const pOn = Number(on.totals?.p) || 0;
        if (pOff >= floor && pOn < floor - 0.5) {
          dropped.push(`${d.key} ${off.type}: ${pOff.toFixed(1)} → ${pOn.toFixed(1)} (пол ${floor.toFixed(1)})`);
        }
      });
    }
    expect(dropped.join(', ')).toBe('');
  });

  it('порции: шаг 5 г, еда ≥40 г (основной приём ≥75 г), порошок ≥10 г, ≤200 г', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const w = d.p[1];
      (d.on.meals || []).forEach((on: any, idx: number) => {
        const off = (d.off.meals || [])[idx];
        if (!off) return;
        (on.items || []).forEach((it: any, j: number) => {
          const prev = (off.items || [])[j];
          if (!prev || !PROT.has(String(it.role))) return;
          const a = Number(it.amount) || 0;
          const b = Number(prev.amount) || 0;
          if (Math.round(a) === Math.round(b)) return;
          const main = ['breakfast', 'lunch', 'dinner'].includes(String(on.type || ''));
          const minG = isPowder(it.id) ? 10 : (main && w >= 80 ? 75 : 40);
          if (a % 5 !== 0 || a < minG || a > 200) {
            bad.push(`${d.key} ${on.type} ${it.id}: ${b} → ${a}`);
          }
        });
      });
    }
    expect(bad.join(', ')).toBe('');
  });

  it('стадия объясняется нотой; не-HV дни и выключенный флаг — без изменений', () => {
    let fired = 0;
    for (const d of DAYS) {
      const notesOn = ((d.on.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      const notesOff = ((d.off.notes || []) as string[]).filter((n) => typeof n === 'string' && n.startsWith(NOTE));
      expect(notesOff).toHaveLength(0);
      const changed = badges(d.on).length !== badges(d.off).length
        || Number(d.on.totals?.p) !== Number(d.off.totals?.p);
      if (notesOn.length > 0) {
        fired++;
        expect(changed).toBe(true);
        expect(notesOn[0]).toMatch(/белок дня сохранён/);
      }
      // Не-HV профиль стадией не трогается вовсе.
      const hv = d.p[4] >= 4200 || d.p[7] >= 600 || d.p[5] / d.p[1] >= 2.8;
      if (!hv) {
        expect(changed).toBe(false);
        expect(notesOn).toHaveLength(0);
      }
    }
    expect(fired).toBeGreaterThanOrEqual(5);
  });
});
