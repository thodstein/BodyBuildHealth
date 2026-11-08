/**
 * nutrition-charts-topfood.test.tsx — «Топ продуктов» в дневнике:
 * названия показываются целиком (не режутся «…»), а тап по строке открывает
 * добавление с этим названием в поиске.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NutritionDiaryCharts } from '../NutritionDiaryCharts';

const LONG_NAME = 'Творог «Простоквашино» 5%, 200 г';

const diaryData = {
  '2026-11-06': { meals: { Завтрак: [{ name: LONG_NAME, kcal: 121 }, { name: 'Гречка', kcal: 130 }] } },
  '2026-11-07': { meals: { Завтрак: [{ name: LONG_NAME, kcal: 121 }], Обед: [{ name: 'Гречка', kcal: 130 }] } },
};

const renderCharts = (onPickFood?: (name: string) => void) =>
  render(
    <NutritionDiaryCharts
      dayMeals={{ Завтрак: [{ name: LONG_NAME, kcal: 121 }] as any }}
      dayTotals={{ kcal: 500, p: 20, f: 10, c: 60 }}
      diaryData={diaryData}
      selectedDate="2026-11-08"
      refreshKey={0}
      onPickFood={onPickFood}
    />,
  );

afterEach(() => {
  cleanup();
});

describe('Топ продуктов', () => {
  it('показывает полное название, а не обрезок', () => {
    const { container } = renderCharts();
    const names = Array.from(container.querySelectorAll('.nd-topname')).map(n => n.textContent || '');
    expect(names).toContain(LONG_NAME);
    expect(names.some(n => n.includes('…'))).toBe(false);
    // Никакого nowrap/ellipsis: длинное название переносится.
    const el = Array.from(container.querySelectorAll('.nd-topname')).find(n => n.textContent === LONG_NAME) as HTMLElement;
    expect(el.style.whiteSpace).toBe('normal');
    expect(el.style.textOverflow).toBe('');
  });

  it('тап по строке отдаёт название наружу (поиск + добавление)', () => {
    const onPick = vi.fn();
    renderCharts(onPick);
    fireEvent.click(screen.getByLabelText(`Найти ${LONG_NAME} и добавить`));
    expect(onPick).toHaveBeenCalledWith(LONG_NAME);
  });

  it('без обработчика строки не притворяются кнопками', () => {
    renderCharts();
    expect(screen.queryAllByLabelText(/и добавить/)).toHaveLength(0);
  });
});
