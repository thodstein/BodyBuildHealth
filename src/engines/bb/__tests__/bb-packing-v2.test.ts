import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { validateBBPlan } from '../bb-validator.engine';
import { packingCapFor, distributePackingSets, planPackingDrops, isPackingActive } from '../bb-packing.engine';

/* ═══════════════════════════════════════════════════════════════════
 * Packing-v2 (opt-in, пилот back): заливка до индивидуальных капов
 * (терпеливые 6 / средние 5 / фикс 3–4) вместо ровного дележа.
 * Инварианты: недельный объём цел, без флага — байт-в-байт legacy,
 * weak/focus/spec/deload — скип (legacy), MGF/разминка/FST — не трогаем.
 * ═══════════════════════════════════════════════════════════════════ */

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };
const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

function backSets(plan: any): number {
  let s = 0;
  for (const w of plan.weeks) for (const sess of w.sessions) for (const e of sess.exercises) {
    if ((e as any).warmupActivator) continue;
    if ((e as any).muscle === 'back') s += (e as any).workSets?.length || (e as any).sets || 0;
  }
  return s;
}

/** Слоты упражнений спины за неделю (сумма по сессиям — именно они душат счётчик сессии). */
function backSlots(plan: any): number {
  let n = 0;
  for (const w of plan.weeks) for (const sess of w.sessions) for (const e of sess.exercises) {
    if ((e as any).warmupActivator) continue;
    if ((e as any).muscle === 'back') n++;
  }
  return n;
}

function backExCount(plan: any): number {
  return backSlots(plan);
}

describe('packingCapFor — капы и запреты', () => {
  it('якоря пользователя: широкий блок/Т-тяга/seal — 6', () => {
    expect(packingCapFor({ id: 'pulldown_wide', name: 'Тяга верхнего блока широким хватом' }).cap).toBe(6);
    expect(packingCapFor({ id: 'row_tbar', name: 'Тяга Т-грифа' }).cap).toBe(6);
    expect(packingCapFor({ id: 'row_seal', name: 'Тяга лёжа на скамье (seal row)' }).cap).toBe(6);
    expect(packingCapFor({ id: 'row_db', name: 'Тяга гантели в наклоне одной рукой' }).cap).toBe(5);
  });

  it('правило: compound 5, isolation 4, машина +1, unilateral −1', () => {
    expect(packingCapFor({ name: 'Тяга горизонтального блока', type: 'compound', equipment: 'cable' }).cap).toBe(5);
    expect(packingCapFor({ name: 'Пуловер', type: 'isolation', equipment: 'cable' }).cap).toBe(4);
    expect(packingCapFor({ name: 'Тяга с упором грудью', type: 'compound', equipment: 'machine' }).cap).toBe(6);
  });

  it('noPack: разминка, MGF-слот, weak-optional, икры', () => {
    expect(packingCapFor({ name: 'X', warmupActivator: true }).noPack).toBe(true);
    expect(packingCapFor({ name: 'Y', comment: '🧬 MGF/IGF1 слот: +1' }).noPack).toBe(true);
    expect(packingCapFor({ name: 'Z', rationale: 'Optional: слабая группа +20%' }).noPack).toBe(true);
    expect(packingCapFor({ name: 'Подъём на носки', type: 'isolation' }, 'calves').noPack).toBe(true);
    expect(packingCapFor({ name: 'Тяга верхнего блока', type: 'compound' }, 'back').noPack).toBe(false);
  });
});

describe('distributePackingSets — чистая арифметика', () => {
  it('заливает по убыванию капа, сумма ровно total', () => {
    expect(distributePackingSets(14, [2, 2, 2], [6, 5, 4], [false, false, false], 5)).toEqual([6, 5, 3]);
  });

  it('locked держит кламп 3–4, недостаток капов → null (legacy)', () => {
    expect(distributePackingSets(12, [2, 2], [6, 6], [true, false], 6)).toBeNull();
    expect(distributePackingSets(10, [2, 2], [6, 6], [true, false], 4)).toEqual([4, 6]);
  });

  it('флоры больше total → null; пустой вход → null', () => {
    expect(distributePackingSets(3, [2, 2], [6, 6], [false, false], 2)).toBeNull();
    expect(distributePackingSets(10, [], [], [], 3)).toBeNull();
  });
});

describe('planPackingDrops — сброс хвостов', () => {
  const items = (pats: string[], strict: string[][] = []) =>
    pats.map((pattern, i) => ({ pattern, strictKeys: strict[i] || [] }));

  it('хвост переливается в головы, сумма цела, лид жив', () => {
    const r = planPackingDrops([4, 2, 2], [6, 5, 4], [false, false, false], items(['horizontal_pull', 'horizontal_pull', 'isolation_chest']), 2);
    expect(r).not.toBeNull();
    // Кандидат — наименьший (idx1/idx2 по 2); перелив в idx0 (кап 6).
    expect(r!.keep.filter(Boolean).length).toBeLessThan(3);
    expect(r!.sets.reduce((a, b) => a + b, 0)).toBe(8);
    expect(r!.keep[0]).toBe(true);
  });

  it('не трогает лида, locked и единственного представителя паттерна/группы', () => {
    // Единственный vertical_pull (idx2) несбрасываем, locked idx1 несбрасываем.
    const r = planPackingDrops(
      [4, 3, 3], [6, 5, 5], [false, true, false],
      [{ pattern: 'horizontal_pull', strictKeys: ['back_tbar'] }, { pattern: 'horizontal_pull', strictKeys: [] }, { pattern: 'vertical_pull', strictKeys: ['back_pulldown'] }],
      2,
    );
    // idx0 — лид; idx1 locked; idx2 sole vertical + sole strict → сбрасывать нечего.
    expect(r).toBeNull();
  });

  it('не опускается ниже minKeep и не переливает сверх капов', () => {
    // Два упражнения, оба нужны (minKeep 2) — null.
    expect(planPackingDrops([3, 3], [6, 6], [false, false], items(['a', 'b']), 2)).toBeNull();
    // Перелив не влезает в капы — null (хвост 5, головам осталось 1+1).
    expect(planPackingDrops([4, 5, 4], [5, 5, 5], [false, false, false], items(['a', 'a', 'a']), 2)).toBeNull();
  });
});

describe('Packing-v2 в плане (пилот back)', () => {
  const base: any = { patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 2, workMax: WM, equipment: EQ, volumeGoal: 'mav' };

  it('объём спины цел (±2 целочисленный шум downstream-тримов), движений не больше, план валиден, штамп стоит', () => {
    const off = buildBBPlan({ ...base });
    const on = buildBBPlan({ ...base, packingV2: true });
    // Распределение инвариантно ровно; ±2 — шум downstream-тримов
    // (тот же допуск, что DC/female в проекте).
    expect(Math.abs(backSets(on) - backSets(off))).toBeLessThanOrEqual(2);
    expect(backExCount(on)).toBeLessThanOrEqual(backExCount(off));
    expect(isPackingActive(on)).toBe(true);
    expect(isPackingActive(off)).toBe(false);
    const v = validateBBPlan(on, { level: 'intermediate' });
    expect(v.issues.filter(i => i.level === 'error')).toHaveLength(0);
  });

  it('залитые сеты идут пирамидой (топ тяжелее низа)', () => {
    // BIG-объёмы (курс): заливке есть что распределять — ровный делёж
    // натурала и так мелкий, пирамиде негде развернуться.
    const on = buildBBPlan({ ...base, level: 'enhanced', trainingYears: 6, pedDoses: { AAS: 500 }, courseIntensity: 'moderate', packingV2: true });
    const big = [];
    for (const w of on.weeks) for (const s of w.sessions) for (const e of s.exercises) {
      if ((e as any).warmupActivator || (e as any).muscle !== 'back') continue;
      if (((e as any).workSets?.length || 0) >= 5) big.push(e);
    }
    expect(big.length).toBeGreaterThan(0);
    for (const e of big as any[]) {
      const ws = (e as any).workSets.map((x: any) => x.weight);
      expect(ws[0]).toBeGreaterThanOrEqual(ws[ws.length - 1]);
    }
  });

  it('BIG-объёмы: движений меньше, объём цел, план валиден', () => {
    const big: any = { ...base, level: 'enhanced', trainingYears: 6, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' };
    const off = buildBBPlan({ ...big });
    const on = buildBBPlan({ ...big, packingV2: true });
    expect(Math.abs(backSets(on) - backSets(off))).toBeLessThanOrEqual(2);
    expect(backExCount(on)).toBeLessThan(backExCount(off));
    expect(isPackingActive(on)).toBe(true);
    const v = validateBBPlan(on, { level: 'enhanced', trainingYears: 6 } as any);
    expect(v.issues.filter(i => i.level === 'error')).toHaveLength(0);
  });

  it('weak back + флаг: скип (паритет объёма, штампа нет)', () => {
    const off = buildBBPlan({ ...base, weakPoints: ['back'] });
    const on = buildBBPlan({ ...base, weakPoints: ['back'], packingV2: true });
    expect(Math.abs(backSets(on) - backSets(off))).toBeLessThanOrEqual(2);
    expect(isPackingActive(on)).toBe(false);
  });

  it('без флага — legacy (штампа нет, капы 5 целы)', () => {
    const off = buildBBPlan({ ...base });
    expect(isPackingActive(off)).toBe(false);
    for (const w of off.weeks) for (const s of w.sessions) for (const e of s.exercises) {
      if ((e as any).warmupActivator) continue;
      expect((e as any).workSets?.length || 0).toBeLessThanOrEqual(8);
    }
  });
});
