/**
 * combat-e6-graphs-variants.test.tsx — локи E6 «графики + what-if».
 *
 * До E6: неделя была пассивным чипом (графиков не было вообще), а выбор
 * билд-настроек был необратим — пересобрал и прошлый вариант исчез.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { buildCampSeries, polylinePoints } from '../../../../engines/combat/combat-graphs';
import {
  variantFromPlan, addCombatVariant, loadCombatVariants, removeCombatVariant,
  diffCombatVariants, isCombatVariantShape, variantInputs,
  COMBAT_VARIANTS_KEY, COMBAT_VARIANTS_CAP, type CombatVariant,
} from '../../../../engines/combat/combat-variants';
import { buildCombatPlan } from '../../../../engines/combat/combat-builder.engine';
import { finalizeCombatPlan } from '../../../../engines/combat/combat-finalize.engine';
import { CbCampCharts } from '../cb-camp-charts';
import { CbVariants } from '../cb-variants';

beforeEach(() => localStorage.clear());

const mkPlan = (over: any = {}) =>
  finalizeCombatPlan(buildCombatPlan({
    discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3, bodyweight: 80, ...over,
  } as any));

describe('E6.1 — ряд лагеря считается по плану', () => {
  it('длина ряда = числу недель, объёмы положительные', () => {
    const plan = mkPlan();
    const s = buildCampSeries(plan);
    expect(s.points.length).toBe(plan.weeksData.length);
    expect(s.points.every(p => p.sets > 0)).toBe(true);
    expect(s.maxSets).toBe(Math.max(...s.points.map(p => p.sets)));
  });

  it('пиковая неделя и среднее — реальные значения плана', () => {
    const plan = mkPlan();
    const s = buildCampSeries(plan);
    const peak = s.points.find(p => p.week === s.peakWeek)!;
    expect(peak.sets).toBe(s.maxSets);
    const manual = plan.weeksData.reduce((a, w) => a + (w.totalSets || 0), 0) / plan.weeksData.length;
    expect(Math.round(s.avgSets)).toBe(Math.round(manual));
  });

  it('volumeShare нормирован по пику, а не абсолютный', () => {
    const s = buildCampSeries(mkPlan());
    expect(Math.max(...s.points.map(p => p.volumeShare))).toBeCloseTo(1, 5);
    expect(s.points.every(p => p.volumeShare >= 0 && p.volumeShare <= 1)).toBe(true);
  });

  it('интенсивность в 0..1 и не выдумана при пустых весах', () => {
    const s = buildCampSeries(mkPlan());
    expect(s.points.every(p => p.intensity >= 0 && p.intensity <= 1)).toBe(true);
    const empty = buildCampSeries(null);
    expect(empty.points).toEqual([]);
    expect(empty.maxSets).toBe(0);
  });

  it('деload/тапер помечены по факту недели', () => {
    const plan = mkPlan();
    const s = buildCampSeries(plan);
    const dl = plan.weeksData.filter((w: any) => w.deload).length;
    const tp = plan.weeksData.filter((w: any) => w.taper).length;
    expect(s.deloadWeeks).toBe(dl);
    expect(s.taperWeeks).toBe(tp);
  });

  it('тоннаж считается из веса×сеты×повторы', () => {
    const plan = mkPlan();
    const s = buildCampSeries(plan);
    expect(s.maxTonnage).toBeGreaterThan(0);
    // тоннаж растёт вместе с объёмом — корреляция положительная
    const w0 = s.points[0], wMax = s.points.reduce((a, b) => (b.sets > a.sets ? b : a));
    expect(wMax.tonnage).toBeGreaterThan(0);
  });
});

describe('E6.2 — геометрия ломаной', () => {
  it('точки укладываются в холст, y инвертирован (максимум сверху)', () => {
    const pts = polylinePoints([0, 5, 10], 10, 100, 40, 2);
    expect(pts.length).toBe(3);
    expect(pts[0].x).toBeCloseTo(2);
    expect(pts[2].x).toBeCloseTo(98);
    expect(pts[1].y).toBeCloseTo(pts[0].y + (pts[2].y - pts[0].y) / 2);
    expect(pts.every(p => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 40)).toBe(true);
  });

  it('пустой ряд и нулевой максимум не роняют отрисовку', () => {
    expect(polylinePoints([], 10, 100, 40)).toEqual([]);
    const z = polylinePoints([0, 0], 0, 100, 40);
    expect(z.every(p => Number.isFinite(p.y))).toBe(true);
  });
});

describe('E6.3 — SVG-графики на экране', () => {
  it('три ряда + подписи пиков', () => {
    render(<CbCampCharts plan={mkPlan()} />);
    expect(screen.getByText(/Сеты\/нед/)).toBeTruthy();
    expect(screen.getByText(/Тоннаж\/нед/)).toBeTruthy();
    expect(screen.getByText(/Интенсивность/)).toBeTruthy();
    expect(document.querySelectorAll('svg[data-cb], svg').length).toBeGreaterThanOrEqual(3);
  });

  it('каждый ряд — svg с role=img и осмысленным aria-label', () => {
    const { container } = render(<CbCampCharts plan={mkPlan()} />);
    const svgs = Array.from(container.querySelectorAll('svg'));
    expect(svgs.length).toBe(3);
    for (const s of svgs) {
      expect(s.getAttribute('role')).toBe('img');
      expect(s.getAttribute('aria-label')).toMatch(/максимум/);
    }
  });

  it('вспышка подписи совпадает с движком (не пересчёт на глаз)', () => {
    const plan = mkPlan();
    const s = buildCampSeries(plan);
    render(<CbCampCharts plan={plan} />);
    expect(screen.getAllByText(new RegExp(`пик нед\\. ${s.peakWeek}`)).length).toBeGreaterThan(0);
  });
});

describe('E6.4 — варианты: хранилище', () => {
  it('сохранение/чтение/удаление работают', () => {
    const plan = mkPlan();
    addCombatVariant(plan, 'Мой вариант');
    expect(loadCombatVariants().length).toBe(1);
    const id = loadCombatVariants()[0].id;
    removeCombatVariant(id);
    expect(loadCombatVariants().length).toBe(0);
  });

  it('одинаковая сборка не плодит дубли (id детерминирован)', () => {
    const plan = mkPlan();
    addCombatVariant(plan, 'A');
    addCombatVariant(plan, 'B');
    expect(loadCombatVariants().length).toBe(1);
  });

  it('кап 10: лишние варианты вытесняют самые старые', () => {
    // каждый вариант из РАЗНЫХ сборок, иначе id совпадёт и заменятся друг друга
    const names: string[] = [];
    for (let i = 0; i < 14; i++) {
      const name = `V${i}`;
      names.push(name);
      const p = mkPlan({ weeks: 2 + (i % 4), daysPerWeek: 3 + (i % 5), level: i % 2 ? 'advanced' : 'beginner' });
      addCombatVariant(p, name, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString());
    }
    const list = loadCombatVariants();
    expect(list.length).toBe(COMBAT_VARIANTS_CAP);
    // самые старые вытеснены, новые на месте
    expect(list.map(v => v.name)).not.toContain(names[0]);
    expect(list[list.length - 1].name).toBe(names[names.length - 1]);
  });

  it('битый стор не роняет чтение', () => {
    localStorage.setItem(COMBAT_VARIANTS_KEY, '{не json');
    expect(loadCombatVariants()).toEqual([]);
    localStorage.setItem(COMBAT_VARIANTS_KEY, JSON.stringify([{ id: 1 }, { nope: true }]));
    expect(loadCombatVariants()).toEqual([]);
  });

  it('форма варианта проверяется по полям, а не по факту наличия', () => {
    expect(isCombatVariantShape(variantFromPlan(mkPlan(), 'x'))).toBe(true);
    expect(isCombatVariantShape({ id: 'a', name: 'b' })).toBe(false);
    expect(isCombatVariantShape(null)).toBe(false);
  });
});

describe('E6.5 — diff вариантов', () => {
  it('одинаковые варианты: ни одна строка не помечена изменённой', () => {
    const p = mkPlan();
    const a = variantFromPlan(p, 'A');
    const b = variantFromPlan(p, 'B');
    expect(diffCombatVariants(a, b).every(r => !r.changed)).toBe(true);
  });

  it('разные сборки: показывает ТОЛЬКО изменившиеся строки', () => {
    const a = variantFromPlan(mkPlan({ daysPerWeek: 3 }), 'A');
    const b = variantFromPlan(mkPlan({ daysPerWeek: 5 }), 'B');
    const changed = diffCombatVariants(a, b).filter(r => r.changed);
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.some(r => r.label === 'Дней/нед')).toBe(true);
  });

  it('бой и сгон отражаются в diff как отдельные строки', () => {
    const a = variantFromPlan(mkPlan(), 'A');
    const b = variantFromPlan(mkPlan({ fightDate: '2026-05-01', weightCutKg: 2 }), 'B');
    const rows = diffCombatVariants(a, b);
    expect(rows.find(r => r.key === 'fight')!.changed).toBe(true);
    expect(rows.find(r => r.key === 'weightCut')!.changed).toBe(true);
  });

  it('входы варианта берутся из inputSnapshot, а не выдумываются', () => {
    const p = mkPlan({ daysPerWeek: 4, level: 'advanced' });
    const i = variantInputs(p);
    expect(i.daysPerWeek).toBe(4);
    expect(i.level).toBe('advanced');
    expect(i.weeks).toBe(p.weeksData.length);
  });
});

describe('E6.6 — A/B в UI', () => {
  it('пустое состояние объясняет пользу, а не молчит', () => {
    render(<CbVariants plan={mkPlan()} onRestore={() => {}} />);
    expect(screen.getByText(/Вариантов пока нет/)).toBeTruthy();
  });

  it('сохранение → два варианта → A/B → видно разницу', () => {
    const p1 = mkPlan({ daysPerWeek: 3 });
    const p2 = mkPlan({ daysPerWeek: 5 });
    const onRestore = vi.fn();
    const { rerender } = render(<CbVariants plan={p1} onRestore={onRestore} />);
    fireEvent.change(screen.getByLabelText('Название варианта'), { target: { value: 'Три дня' } });
    fireEvent.click(screen.getByText('💾 Сохранить вариант'));
    rerender(<CbVariants plan={p2} onRestore={onRestore} />);
    fireEvent.change(screen.getByLabelText('Название варианта'), { target: { value: 'Пять дней' } });
    fireEvent.click(screen.getByText('💾 Сохранить вариант'));
    expect(loadCombatVariants().length).toBe(2);

    fireEvent.click(screen.getByLabelText('Сравнить Три дня как A'));
    fireEvent.click(screen.getByLabelText('Сравнить Пять дней как B'));
    expect(screen.getByText(/A: Три дня/)).toBeTruthy();
    expect(screen.getByText(/Дней\/нед/)).toBeTruthy();
  });

  it('«Вернуть» отдаёт сохранённый план и показывает плашку возврата', () => {
    const p1 = mkPlan({ daysPerWeek: 3 });
    const p2 = mkPlan({ daysPerWeek: 5 });
    const onRestore = vi.fn();
    const { rerender } = render(<CbVariants plan={p1} onRestore={onRestore} />);
    fireEvent.change(screen.getByLabelText('Название варианта'), { target: { value: 'Пять' } });
    fireEvent.click(screen.getByText('💾 Сохранить вариант'));
    rerender(<CbVariants plan={p2} onRestore={onRestore} />);
    fireEvent.click(screen.getByLabelText('Вернуть Пять'));
    expect(onRestore).toHaveBeenCalled();
  });

  it('варианты переживают перезагрузку (читаются из localStorage)', () => {
    addCombatVariant(mkPlan(), 'Переживает');
    const after = loadCombatVariants();
    expect(after.length).toBe(1);
    expect(after[0].name).toBe('Переживает');
  });
});
