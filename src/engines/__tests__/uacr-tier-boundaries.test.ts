/**
 * uacr-tier-boundaries.test.ts — проход 207 (ревью P2/P3): альбуминурия
 * (`UACR`, мг/г) живёт одной шкалой в трёх местах — ступени механизма
 * (`labMi(uacr,[30,300,1000])`), лестница (`LAB_TIERS.UACR`) и пороги-якоря
 * (`clinicalFloorsForLabs`), — и границы обязаны совпадать числом.
 *
 * Класс дефекта: границы были записаны `>` (`>300`, `>30`), а шкала считает
 * полуинтервалами `[lo, hi)`: ровно 30 мг/г давало «ступень 1 без флага», ровно
 * 300 — «ступень 2 без флага». Клинический отчёт на граничном числе
 * расходился с советом (`computeTierAdjustments`) на том же числе.
 *
 * Здесь держатся:
 *  1) границы шкалы (29/30/299/300/999/1000) — ступень и якорь;
 *  2) каталог (`UCUM_MAP.UACR.uln`) и лестница называют один верх нормы;
 *  3) совет на 400 мг/г — ступень 2 без ярлыка A3, на 1200 — A3 с полосой.
 */
import { describe, it, expect } from 'vitest';
import { clinicalFloorsForLabs } from '../risk-engine-tz-spec';
import { LAB_TIERS, deriveTier } from '../../data/lab-tier-ranges';
import { computeTierAdjustments } from '../../data/lab-tier-recommendations';
import { ucumInfo } from '../../core/constants';

const uacrFloors = (value: number) =>
  clinicalFloorsForLabs({ UACR: value }).filter((f) => f.organId === 'renal' && f.label.includes('UACR'));

describe('проход 207: границы UACR — один полуинтервал на движок и лестницу', () => {
  it('ступень шкалы: 29 → A1, 30 → A2, 299 → A2, 300 → 2-я, 1000 → третья ступень', () => {
    expect(deriveTier('UACR', 29)).toBe(0);
    expect(deriveTier('UACR', 30)).toBe(1);
    expect(deriveTier('UACR', 299)).toBe(1);
    expect(deriveTier('UACR', 300)).toBe(2);
    expect(deriveTier('UACR', 999)).toBe(2);
    expect(deriveTier('UACR', 1000)).toBe(3);
  });

  it('якорь риска срабатывает на той же границе, что и ступень', () => {
    expect(uacrFloors(29)).toHaveLength(0);
    // 30 — уже A2: уровень 25, без второго ярлыка A3.
    expect(
      uacrFloors(30)
        .map((f) => f.level)
        .sort(),
    ).toEqual([25]);
    expect(
      uacrFloors(299)
        .map((f) => f.level)
        .sort(),
    ).toEqual([25]);
    // Ревью P3-2: 300 — ещё A2 по KDIGO (A3 — строго выше 300), поэтому здесь
    // только A2-ярлык; молчания нет, совет по шкале на 300 уже ведёт к нефрологу.
    expect(
      uacrFloors(300)
        .map((f) => f.level)
        .sort(),
    ).toEqual([25]);
    // Ярлык A2 ограничен своим диапазоном: на 301 мг/г пациент уже A3, и второй
    // ярлык «A2» рядом был бы вторым ответом на том же числе.
    expect(
      uacrFloors(301)
        .map((f) => f.level)
        .sort(),
    ).toEqual([50]);
    expect(
      uacrFloors(1000)
        .map((f) => f.level)
        .sort(),
    ).toEqual([50]);
    expect(uacrFloors(301).find((f) => f.level === 50)?.label).toMatch(/A3/);
    expect(uacrFloors(1000).find((f) => f.level === 50)?.label).toMatch(/A3/);
  });

  it('каталог и лестница держат один верх нормы (долг двух таблиц по UACR закрыт)', () => {
    const info = ucumInfo('UACR');
    expect(info, 'нет записи UCUM_MAP.UACR').toBeTruthy();
    expect(info!.uln).toBe(LAB_TIERS.UACR.normal[1]);
    expect(LAB_TIERS.UACR.normal[1]).toBe(30);
    // Третья ступень — не новое число: это же значение у якоря в движке.
    expect(LAB_TIERS.UACR.emergencyHigh).toBe(1000);
    expect(LAB_TIERS.UACR.unit).toBe('mg/g');
  });
});

describe('проход 207: совет по UACR не путает ступень с ярлыком A3', () => {
  it('400 мг/г — ступень 2 (стойкая альбуминурия), а не «A3 ≥1000»', () => {
    const res = computeTierAdjustments({ UACR: 400 });
    expect(res.tierSummary.find((t) => t.marker === 'UACR')?.tier).toBe(2);
    expect(res.alerts.filter((a) => a.marker === 'UACR')).toHaveLength(0);
    const actions = res.nutrition.filter((n) => n.marker === 'UACR').map((n) => n.action);
    expect(actions.join(' ')).toMatch(/Нефролог/);
    expect(actions.join(' ')).toMatch(/иАПФ|сартан/);
  });

  it('1200 мг/г — тревога A3 с полосой ≥1000 мг/г', () => {
    const res = computeTierAdjustments({ UACR: 1200 });
    const alert = res.alerts.find((a) => a.marker === 'UACR');
    expect(alert, 'на 1200 мг/г нет тревоги UACR').toBeTruthy();
    expect(alert!.tier).toBe(3);
    expect(alert!.message).toContain('A3');
    // Порог категории назван своим числом, а не полосой ≥1000 (ревью P3-1).
    expect(alert!.message).toContain('300');
    expect(alert!.message).toContain('1000');
    expect(alert!.message).toContain('1200');
  });

  it('29 мг/г — норма, совет не выдумывается', () => {
    const res = computeTierAdjustments({ UACR: 29 });
    expect(res.tierSummary.find((t) => t.marker === 'UACR')).toBeUndefined();
    expect(res.alerts.filter((a) => a.marker === 'UACR')).toHaveLength(0);
  });
});
