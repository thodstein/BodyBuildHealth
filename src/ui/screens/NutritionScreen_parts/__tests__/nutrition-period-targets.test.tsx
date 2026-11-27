/**
 * Тест «сколько должно быть» в отчётах питания (жалоба: за неделю/месяц видно
 * только набранное, а нормы за период нет).
 *
 * Ядро — чистый хелпер period-targets; плюс два рендера, которые проверяют, что
 * цель действительно доехала до полосы и легенды (WeekDaySelector) и что норма
 * за N дней попадает в разметку итогов недели (WeekView).
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { buildPeriodGoal, countDaysWithRecords, emptyTargets } from '../period-targets';
import { WeekDaySelector } from '../diary/WeekDaySelector';
import { WeekView } from '../diary/WeekView';

const WEEK = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'];

describe('buildPeriodGoal', () => {
  it('сумма vs норма за дни с записями и среднее против дневной цели', () => {
    const goal = buildPeriodGoal(
      { kcal: 9750, protein: 400, fats: 300, carbs: 900 },
      { kcal: 2400, protein: 160, fats: 70, carbs: 300 },
      5,
      7,
    );
    expect(goal.daysWithRecords).toBe(5);
    expect(goal.periodDays).toBe(7);
    expect(goal.avgPerDay.kcal).toBe(1950);
    expect(goal.pctOfDaily.kcal).toBe(81); // 1950 / 2400 = 81.25 → 81
    expect(goal.goalPerLoggedDays.kcal).toBe(12000); // 2400 × 5
    expect(goal.goalPerPeriod.kcal).toBe(16800); // 2400 × 7 — норма за ВЕСЬ период недели
    expect(goal.pctOfPeriod.kcal).toBe(81); // 9750 / 12000 = 81.25 → 81
    expect(goal.goalPerLoggedDays.protein).toBe(800);
    expect(goal.pctOfPeriod.protein).toBe(50); // 400 / 800
    expect(goal.avgPerDay.carbs).toBe(180); // 900 / 5
    expect(goal.enoughData).toBe(true);
  });

  it('пустой дневник и нулевая цель — нули без NaN/Infinity', () => {
    const goal = buildPeriodGoal(emptyTargets(), emptyTargets(), 0, 7);
    for (const part of [goal.avgPerDay, goal.goalPerLoggedDays, goal.pctOfDaily, goal.pctOfPeriod]) {
      Object.values(part).forEach((v) => {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBe(0);
      });
    }
    expect(goal.enoughData).toBe(false);
  });

  it('нулевая цель при непустом дневнике — проценты 0, не Infinity', () => {
    const goal = buildPeriodGoal({ kcal: 3000, protein: 200, fats: 100, carbs: 400 }, emptyTargets(), 4, 7);
    expect(goal.avgPerDay.kcal).toBe(750);
    expect(goal.pctOfDaily.kcal).toBe(0);
    expect(goal.goalPerLoggedDays.kcal).toBe(0);
    expect(goal.pctOfPeriod.kcal).toBe(0);
  });

  it('дней с записями 0 — среднее 0 и данных мало', () => {
    const goal = buildPeriodGoal(
      { kcal: 0, protein: 0, fats: 0, carbs: 0 },
      { kcal: 2400, protein: 160, fats: 70, carbs: 300 },
      0,
      31,
    );
    expect(goal.avgPerDay.kcal).toBe(0);
    expect(goal.pctOfDaily.kcal).toBe(0);
    expect(goal.goalPerLoggedDays.kcal).toBe(0);
    expect(goal.periodDays).toBe(31);
    expect(goal.enoughData).toBe(false);
  });

  it('2 дня с записями — данных всё ещё мало', () => {
    const goal = buildPeriodGoal(
      { kcal: 5000, protein: 300, fats: 150, carbs: 600 },
      { kcal: 2400, protein: 160, fats: 70, carbs: 300 },
      2,
      7,
    );
    expect(goal.daysWithRecords).toBe(2);
    expect(goal.avgPerDay.kcal).toBe(2500);
    expect(goal.goalPerLoggedDays.kcal).toBe(4800);
    expect(goal.enoughData).toBe(false);
  });
});

describe('countDaysWithRecords', () => {
  it('уникальные даты позиций, пустой список — 0', () => {
    expect(countDaysWithRecords([])).toBe(0);
    expect(
      countDaysWithRecords([
        { kcal: 300, date: '2026-09-07' },
        { kcal: 200, date: '2026-09-07' },
        { kcal: 0, date: '2026-09-09' }, // позиция без ккал — всё равно запись
        { kcal: 100, date: '2026-09-10' },
      ]),
    ).toBe(3);
  });

  it('плоский список без дат — один день', () => {
    expect(countDaysWithRecords([{ kcal: 100 }, { kcal: 200 }])).toBe(1);
  });
});

describe('WeekDaySelector: полоса и легенда от цели, а не от 2500', () => {
  it('1200 ккал при цели 2400 — половина полосы и цель в подписи недели', () => {
    const { container, getByText } = render(
      <WeekDaySelector
        weekDays={WEEK}
        selectedDate="2026-09-07"
        onSelectDate={vi.fn()}
        diaryData={{ '2026-09-07': { meals: { Завтрак: [{ name: 'Овсянка', kcal: 1200, p: 40, f: 20, c: 180 }] } } }}
        targets={{ kcal: 2400, protein: 160, fats: 70, carbs: 300 }}
      />,
    );
    const widths = Array.from(container.querySelectorAll('.nd-weekday div'))
      .map((el) => (el as HTMLElement).style.width)
      .filter(Boolean);
    expect(widths).toContain('50%');
    expect(getByText(/норма 2400 ккал/)).toBeTruthy();
    expect(getByText('🎯 цель 2400 ккал/дн')).toBeTruthy();
    expect(getByText('2160–2640')).toBeTruthy(); // 0.9·цели … 1.1·цели
  });
});

describe('WeekView: норма за N дней в итогах недели', () => {
  it('2 дня с записями → норма = цель × 2 и предупреждение о малых данных', () => {
    const { container, getByText } = render(
      <WeekView
        diaryData={{
          '2026-09-07': { meals: { Завтрак: [{ name: 'Овсянка', kcal: 1200, p: 40, f: 20, c: 180 }] } },
          '2026-09-08': { meals: { Обед: [{ name: 'Рис', kcal: 1200, p: 10, f: 5, c: 250 }] } },
          '2026-09-09': { meals: {} }, // пустой день не считается
        }}
        targets={{ kcal: 2400, protein: 160, fats: 70, carbs: 300 }}
        selectedDate="2026-09-09"
      />,
    );
    expect(container.querySelector('.nd-weekgoal')).not.toBeNull();
    expect(getByText(/Норма за 2 дн\./)).toBeTruthy();
    expect(container.textContent).toContain('4800 ккал');
    expect(getByText(/Мало данных для вывода: 2 из 7 дн\./)).toBeTruthy();
    expect(getByText('2/7 дн')).toBeTruthy();
  });
});

describe('WeekDaySelector: сдвиг недели от локальной даты-календаря', () => {
  it('‹ из 2026-11-27 даёт 2026-11-20 (без UTC-сдвига на день)', () => {
    const onSelect = vi.fn();
    render(
      <WeekDaySelector
        weekDays={['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']}
        selectedDate="2026-11-27"
        onSelectDate={onSelect}
        diaryData={{}}
        targets={{ kcal: 2400, protein: 160, fats: 70, carbs: 300 }}
      />,
    );
    fireEvent.click(document.querySelector('[aria-label="Пред. неделя"]') as HTMLElement);
    expect(onSelect).toHaveBeenLastCalledWith('2026-11-20');
    fireEvent.click(document.querySelector('[aria-label="След. неделя"]') as HTMLElement);
    expect(onSelect).toHaveBeenLastCalledWith('2026-12-04');
  });
});

describe('WeekView: перебор цели виден, полоса при этом не выходит за 100%', () => {
  it('3000 ккал при цели 2400 → 125% и красная строка, ширина полосы 100%', () => {
    const { container, getByText } = render(
      <WeekView
        diaryData={{
          '2026-09-07': { meals: { Завтрак: [{ name: 'Борщ', kcal: 3000, p: 90, f: 60, c: 400 }] } },
        }}
        targets={{ kcal: 2400, protein: 160, fats: 70, carbs: 300 }}
        selectedDate="2026-09-07"
      />,
    );
    expect(getByText('125%')).toBeTruthy();
    const bars = Array.from(container.querySelectorAll('.nd-dayrow div')).filter(
      (el) => (el as HTMLElement).style.width === '100%',
    );
    expect(bars.length).toBeGreaterThan(0);
    // не «зелёное» состояние: процент подсвечен красным (isOver)
    expect(getComputedStyle(getByText('125%')).color).toBe('rgb(239, 68, 68)');
  });
});
