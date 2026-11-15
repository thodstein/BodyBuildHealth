/**
 * female-cycle-phase.test.ts — проход 77: фаза цикла из даты и фазовые
 * коридоры E2/ЛГ/ФСГ.
 *
 * До него «♀ — по фазе, не подавлять» было единственным ответом приложения:
 * дата последней менструации хранилась в профиле (`settings.lifestyle`), но
 * литературы фаз никто не читал — женщина видела объединение коридоров и не
 * понимала, какая норма у неё сегодня.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  cycleState, cycleStateFromProfile, clampCycleLength,
  phaseHormoneBand, phaseUnionBand, phaseHormoneText,
} from '../female-cycle-phase.engine';
import { PROG_NG_TO_NMOL } from '../lab-norms.engine';

/** Дата на `daysAgo` дней раньше 2026-11-14 (локальный календарь). */
function startDaysAgo(daysAgo: number): string {
  const d = new Date(2026, 10, 14);
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ON = '2026-11-14';
const female = (daysAgo: number, length?: number) => cycleState(
  { sex: 'female', lastPeriodStart: startDaysAgo(daysAgo), cycleLengthDays: length },
  ON,
);

describe('cycleState: день цикла и фаза', () => {
  it('день 1 — менструальная, день 7 — фолликулярная, 12 — овуляторная, 16 — лютеиновая', () => {
    expect(female(0)?.cycleDay).toBe(1);
    expect(female(0)?.phase).toBe('menstrual');
    expect(female(6)?.cycleDay).toBe(7);
    expect(female(6)?.phase).toBe('follicular');
    expect(female(11)?.cycleDay).toBe(12);
    expect(female(11)?.phase).toBe('ovulatory');
    expect(female(15)?.cycleDay).toBe(16);
    expect(female(15)?.phase).toBe('luteal');
  });

  it('цикл замыкается: 28 дней назад — снова день 1', () => {
    expect(female(28)?.cycleDay).toBe(1);
    expect(female(29)?.cycleDay).toBe(2);
    expect(female(28)?.cycleLength).toBe(28);
  });

  it('день входит в 1..длина, подпись по-русски', () => {
    const s = female(15);
    expect(s?.cycleDay).toBe(16);
    expect(s?.label).toBe('Лютеиновая');
    expect(s && s.cycleDay <= s.cycleLength && s.cycleDay >= 1).toBe(true);
  });

  it('длина цикла: 21–35, мусор и пустое — 28', () => {
    expect(clampCycleLength(28)).toBe(28);
    expect(clampCycleLength(10)).toBe(21);
    expect(clampCycleLength(40)).toBe(35);
    expect(clampCycleLength(undefined)).toBe(28);
    expect(clampCycleLength(null)).toBe(28);
    expect(clampCycleLength(Number.NaN)).toBe(28);
    expect(female(0, 21)?.cycleLength).toBe(21);
  });

  it('короткий цикл сдвигает фазы: при 21 дне 10-й день уже овуляторный', () => {
    expect(female(9, 21)?.cycleDay).toBe(10);
    expect(female(9, 21)?.phase).toBe('ovulatory');
  });

  it('нет данных/не женщина/будущее — null (фазу не выдумываем)', () => {
    expect(cycleState({ sex: 'female' }, ON)).toBeNull();
    expect(cycleState({ sex: 'female', lastPeriodStart: '14.11.2026' }, ON)).toBeNull();
    expect(cycleState({ sex: 'male', lastPeriodStart: startDaysAgo(5) }, ON)).toBeNull();
    expect(cycleState({ lastPeriodStart: startDaysAgo(5) }, ON)).toBeNull();
    expect(cycleState({ sex: 'female', lastPeriodStart: '2026-12-01' }, ON)).toBeNull();
  });

  it('фаза из профиля: settings.lifestyle.lastPeriodStart', () => {
    const profile = { settings: { personal: { sex: 'female' }, lifestyle: { lastPeriodStart: startDaysAgo(15), cycleLengthDays: 28 } } };
    expect(cycleStateFromProfile(profile, ON)?.phase).toBe('luteal');
    expect(cycleStateFromProfile(null, ON)).toBeNull();
    expect(cycleStateFromProfile({ settings: { personal: { sex: 'male' }, lifestyle: { lastPeriodStart: startDaysAgo(15) } } }, ON)).toBeNull();
  });
});

describe('фазовые коридоры гормонов', () => {
  it('E2: фолликулярная 40–200, лютеиновая 70–500 пг/мл', () => {
    expect(phaseHormoneBand('E2', 'follicular')).toEqual({ low: 40, high: 200 });
    expect(phaseHormoneBand('E2', 'luteal')).toEqual({ low: 70, high: 500 });
  });

  it('менструальная — ориентир фолликулярной (своего коридора нет ни в одном источнике)', () => {
    expect(phaseHormoneBand('E2', 'menstrual')).toEqual({ low: 40, high: 200 });
  });

  it('овуляторная — null: пик E2/ЛГ шире любого фазового коридора', () => {
    expect(phaseHormoneBand('E2', 'ovulatory')).toBeNull();
    expect(phaseHormoneBand('LH', 'ovulatory')).toBeNull();
    expect(phaseHormoneBand('E2', null)).toBeNull();
  });

  it('ЛГ 2–10 / 5–25 и ФСГ 3–10 / 1.5–8 МЕ/л', () => {
    expect(phaseHormoneBand('LH', 'follicular')).toEqual({ low: 2, high: 10 });
    expect(phaseHormoneBand('LH', 'luteal')).toEqual({ low: 5, high: 25 });
    expect(phaseHormoneBand('FSH', 'follicular')).toEqual({ low: 3, high: 10 });
    expect(phaseHormoneBand('FSH', 'luteal')).toEqual({ low: 1.5, high: 8 });
  });

  it('объединение фаз — фолбэк: E2 40–500, ЛГ 2–25, ФСГ 1.5–10', () => {
    expect(phaseUnionBand('E2')).toEqual({ low: 40, high: 500 });
    expect(phaseUnionBand('LH')).toEqual({ low: 2, high: 25 });
    expect(phaseUnionBand('FSH')).toEqual({ low: 1.5, high: 10 });
  });

  it('подпись коридора называет фазу, а не только числа', () => {
    expect(phaseHormoneText('E2', 'follicular')).toBe('40–200 пг/мл (фолликулярная)');
    expect(phaseHormoneText('E2', 'luteal')).toBe('70–500 пг/мл (лютеиновая)');
    expect(phaseHormoneText('LH', 'luteal')).toBe('5–25 МЕ/л (лютеиновая)');
    expect(phaseHormoneText('E2', 'ovulatory')).toBeNull();
  });
});

describe('прогестерон: фазовые коридоры (проход 79)', () => {
  it('фолликулярная 0.1–1.5, лютеиновая 5–20 нг/мл', () => {
    expect(phaseHormoneBand('PROG', 'follicular')).toEqual({ low: 0.1, high: 1.5 });
    expect(phaseHormoneBand('PROG', 'luteal')).toEqual({ low: 5, high: 20 });
  });

  it('менструальная идёт по фолликулярному ориентиру — прогестерон там тоже низкий', () => {
    expect(phaseHormoneBand('PROG', 'menstrual')).toEqual({ low: 0.1, high: 1.5 });
  });

  it('овуляторная — числа нет; без фазы — объединение коридоров', () => {
    expect(phaseHormoneBand('PROG', 'ovulatory')).toBeNull();
    expect(phaseHormoneBand('PROG', null)).toBeNull();
    expect(phaseUnionBand('PROG')).toEqual({ low: 0.1, high: 20 });
  });

  it('подпись коридора — в нг/мл, как в бланке женщины', () => {
    expect(phaseHormoneText('PROG', 'luteal')).toBe('5–20 нг/мл (лютеиновая)');
    expect(phaseHormoneText('PROG', 'follicular')).toBe('0.1–1.5 нг/мл (фолликулярная)');
  });

  it('нг/мл → нмоль/л — одна константа, без литерала в labs-mapping', () => {
    expect(PROG_NG_TO_NMOL).toBe(3.18);
    const src = readFileSync(resolve(process.cwd(), 'src/core/labs-mapping.ts'), 'utf8');
    expect(src).toContain('1 / PROG_NG_TO_NMOL');
    expect(src).not.toContain('1 / 3.18');
  });
});
