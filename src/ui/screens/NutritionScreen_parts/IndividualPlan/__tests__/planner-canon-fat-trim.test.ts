/**
 * planner-canon-fat-trim.test.ts — §8.68: канон 3% по жиру закрывается финальной срезкой.
 *
 * Дефект (замер 60 дней): `small60/4/тр` Ж 46.6/45 = +3.6%, `recomp80/6/тр` Ж 62.4/60 =
 * +4.0% — два ОБЫЧНЫХ дня вне канона из-за жира, при остальных осях в норме. Жир
 * добавляют стадии (E, QG9/24, добор) уже после последней сходимости, и вернуть его
 * в канон нечем: все резалки стоят выше по конвейеру.
 *
 * 2026-11 (стадия перенесена в САМЫЙ КОНЕЦ конвейера): прежнее место срабатывало по
 * промежуточному канону — `small60/4/тр` срезался, когда день был вне 3%, а поздние
 * стадии сходили его сами, и итог был хуже, чем без срезки (2.15 % → 2.40 %) при ноте
 * «день сведён к канону». На финальной тарелке принятый по строгому улучшению шаг уже
 * не может ухудшить день. Текущий замер: канон держится на 60/60 днях БЕЗ срезки —
 * срабатываний 0, поэтому стадия живёт как страховка для реальных дней.
 *
 * Замок держит три инварианта стадии:
 *  1. ни один день не теряет балл качества и не уходит из канона;
 *  2. шаг принимается только при СТРОГОМ улучшении сходимости (иначе «трим ради трима»);
 *  3. полы порций не двигаются: масла ≥5 г, орехи/семена ≥15 г.
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
const carbsFor = (p: (typeof PROFILES)[number]) => p[7] || Math.max(0, Math.round((p[4] - 4 * p[5] - 9 * p[6]) / 4));

const build = (p: (typeof PROFILES)[number], mc: number, tr: boolean, on: boolean) =>
  buildDayPlan({
    weightKg: p[1],
    lbmKg: p[2],
    bodyFatPct: 18,
    sex: p[3],
    goalKcal: p[4],
    goalProteinG: p[5],
    goalFatG: p[6],
    goalCarbsG: carbsFor(p),
    mealsCount: mc,
    isTrainingDay: tr,
    trainStartMin: tr ? 18 * 60 : undefined,
    trainDurationMin: 75,
    allowIntraWorkout: true,
    budget: 'medium',
    dayOffset: 0,
    cyclePhase: 'none',
    variety: 'medium',
    goal: 'maintenance',
    quality: 'full',
    excludedIds: new Set<string>(),
    allergenTags: new Set<string>(),
    randomSalt: 0,
    // §8.78 (плотный овощ вместо объёма) выключается в обоих вариантах: иначе A/B
    // перестаёт быть сравнением одной стадии (микро меняются до её гейтов).
    vegDensity78: false,
    fatCanonTrim: on,
    // §8.111: последняя миля тоже выключена в ОБОИХ вариантах — это измерительный A/B одной
    // стадии (§8.68). С включённой последней милей оба дня сходятся к канону и разница
    // стадии съедается. Пользовательский путь всегда идёт с последней милей.
    noLastMile111: true,
  } as any) as any;

const devOf = (plan: any, p: (typeof PROFILES)[number]) => {
  const c = carbsFor(p);
  const t = plan.totals || {};
  return Math.max(
    Math.abs(Number(t.kcal) - p[4]) / p[4],
    Math.abs(Number(t.p) - p[5]) / p[5],
    Math.abs(Number(t.f) - p[6]) / p[6],
    c > 0 ? Math.abs(Number(t.c) - c) / c : 0,
  );
};
const fatDev = (plan: any, p: (typeof PROFILES)[number]) => Math.abs(Number(plan.totals?.f) - p[6]) / p[6];

const isOil = (id: string) => /oil|ghee|lard|butter/i.test(id);
// ВАЖНО: регекс «орех/семя» ловит `oil_sunflower_unrefined` — масла исключаем явно.
const isNut = (id: string) =>
  !isOil(id) && /almond|pecan|walnut|cashew|seed|chia|hazelnut|pistach|sunflower|pumpkin|flax|sesame|peanut/i.test(id);

const DAYS: Array<{ key: string; p: (typeof PROFILES)[number]; on: any; off: any }> = [];
for (const p of PROFILES)
  for (const mc of [4, 5, 6])
    for (const tr of [true, false]) {
      DAYS.push({
        key: `${p[0]}/${mc}/${tr ? 'тр' : 'отд'}`,
        p,
        on: build(p, mc, tr, true),
        off: build(p, mc, tr, false),
      });
    }

const NOTE = '⚖️ Канон по жиру:';

describe('§8.68 канон по жиру: финальная срезка жира', () => {
  it('матрица покрывает 60 дней', () => {
    expect(DAYS).toHaveLength(60);
  });

  it('ни один день не теряет балл и не выпадает из канона', () => {
    const worse: string[] = [];
    const outOfCanon: string[] = [];
    let canonOff = 0,
      better = 0;
    for (const d of DAYS) {
      const qa = Number(d.on.qualityScore?.total) || 0;
      const qb = Number(d.off.qualityScore?.total) || 0;
      if (qa < qb) worse.push(`${d.key}: ${qb} → ${qa}`);
      if (qa > qb) better++;
      if (devOf(d.on, d.p) > 0.03) outOfCanon.push(`${d.key}: ${(devOf(d.on, d.p) * 100).toFixed(2)}%`);
      if (devOf(d.off, d.p) > 0.03) canonOff++;
    }
    expect(worse.join(', ')).toBe('');
    // Канон — не «не хуже, чем без срезки», а «весь день в 3 %»: 60/60 дней, замер 2026-11.
    expect(outOfCanon.join(', ')).toBe('');
    const canonOn = outOfCanon.length;
    expect(canonOn).toBeLessThanOrEqual(canonOff);
    // Стадия стоит в конце конвейера (2026-11): если она не сработала, день не менялся —
    // «лучших» дней ожидаемо 0. Ненулевое значение здесь = срезка снова понадобилась,
    // и это видно в проверке `fired` ниже.
    expect(better).toBe(0);
  });

  it('стадия срабатывает только там, где день был вне канона, и реально улучшает жир', () => {
    let fired = 0;
    for (const d of DAYS) {
      const note = ((d.on.notes || []) as string[]).find((n) => typeof n === 'string' && n.startsWith(NOTE));
      if (!note) continue;
      fired++;
      // День был вне канона — иначе срезка не нужна.
      expect(devOf(d.off, d.p)).toBeGreaterThan(0.03);
      // Жир дня стал строго ближе к цели.
      expect(fatDev(d.on, d.p)).toBeLessThan(fatDev(d.off, d.p));
      // И день теперь не хуже канона, чем был.
      expect(devOf(d.on, d.p)).toBeLessThan(devOf(d.off, d.p));
    }
    // Замер 2026-11 (стадия в конце конвейера): канон держится на всех 60 днях БЕЗ срезки —
    // 0 срабатываний. Замок требует, чтобы так и осталось: срабатывание означает, что
    // какой-то день снова ушёл за 3%, и тогда три проверки выше держат стадию честной
    // (вне канона → жир ближе к цели → день строго лучше).
    expect(fired).toBe(0);
  });

  it('исходные дни дефекта сведены к канону без срезки', () => {
    // Ради этих двух дней стадия и заводилась (см. шапку файла). Сейчас их закрывают
    // поздние стадии конвейера (§8.127/§8.128/последняя миля) — замок держит РЕЗУЛЬТАТ:
    // если день снова уедет за 3%, тест упадёт здесь, а не «молча» в отчёте.
    const byKey = new Map(DAYS.map((d) => [d.key, d]));
    for (const key of ['small60/4/тр', 'recomp80/6/тр']) {
      const d = byKey.get(key);
      expect(d, `нет дня ${key} в матрице`).toBeTruthy();
      const dd = d as { key: string; p: (typeof PROFILES)[number]; on: any };
      expect(devOf(dd.on, dd.p), `${key}: отклонение ${(devOf(dd.on, dd.p) * 100).toFixed(2)}%`).toBeLessThanOrEqual(
        0.03,
      );
      expect(fatDev(dd.on, dd.p), `${key}: жир ${(fatDev(dd.on, dd.p) * 100).toFixed(2)}%`).toBeLessThanOrEqual(0.03);
    }
  });

  it('полы порций сохранены: масла ≥5 г, орехи/семена ≥15 г', () => {
    const badOils: string[] = [];
    const nutsOf = (plans: any[]) => {
      const out: string[] = [];
      for (const d of plans)
        for (const m of d.meals || [])
          for (const it of m.items || []) {
            if (String(it?.role) !== 'fat' || it._fixedGrams) continue;
            const g = Number(it.amount) || 0;
            if (isOil(String(it.id)) && g > 0 && g < 5) badOils.push(`${d.key ?? ''}:${it.id}=${g}`);
            if (isNut(String(it.id)) && g > 0 && g < 15) out.push(`${it.id}=${g}`);
          }
      return out;
    };
    // Считаем оба варианта ДО проверок: `badOils` наполняется внутри `nutsOf`.
    const nutOn = DAYS.flatMap((d) => nutsOf([d.on]));
    const nutOff = DAYS.flatMap((d) => nutsOf([d.off]));
    // Масло — пол 5 г держит сама стадия: ниже неё ни один масляный пункт не уходит
    // ни с флагом, ни без него.
    expect(badOils.join(' | ')).toBe('');
    // Орехи/семена: крошки (8 г миндаля в предсне и т.п.) были и до стадии — она их не
    // создаёт и не обязана убирать: сравниваем «не больше, чем без неё».
    expect(nutOn.length).toBeLessThanOrEqual(nutOff.length);
  });

  it('выключенный флаг не пишет ноту и не ломает арифметику дня', () => {
    for (const d of DAYS) {
      const note = ((d.off.notes || []) as string[]).find((n) => typeof n === 'string' && n.startsWith(NOTE));
      expect(note, `${d.key}: нота срезки при выключенном флаге`).toBeUndefined();
      // Арифметика тарелки: ккал = 4Б + 9Ж + 4У (иначе «канон» считался бы по мусору).
      const t = d.off.totals || {};
      const atw = 4 * Number(t.p) + 9 * Number(t.f) + 4 * Number(t.c);
      const k = Number(t.kcal) || 0;
      expect(Math.abs(atw - k) / Math.max(1, k), `${d.key}: ккал ${k} vs БЖУ ${Math.round(atw)}`).toBeLessThan(0.02);
    }
  });
});
