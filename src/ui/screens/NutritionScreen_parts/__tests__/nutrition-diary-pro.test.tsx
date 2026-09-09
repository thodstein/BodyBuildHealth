/**
 * Guard-тест PRO-слоя дневника питания (§89-90).
 * Ловит молчаливый откат nd-хуков: без них APK-CSS не цепляется.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MacroSummary } from '../diary/MacroSummary';
import { WeekDaySelector } from '../diary/WeekDaySelector';
import { MealCard } from '../diary/MealCard';
import { DayMealsList } from '../diary/DayMealsList';
import { QualityInsights } from '../diary/QualityInsights';

vi.mock('../useNutritionDiary', () => ({
  useFrequentFoods: vi.fn(() => []),
  useRecentFoods: vi.fn(() => []),
}));

import { FrequentFoodsPanel } from '../diary/FrequentFoodsPanel';
import { useFrequentFoods } from '../useNutritionDiary';

const WEEK = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'];
const noop = vi.fn();

describe('nutrition-diary-pro hooks', () => {
  it('MacroSummary: сетка nd-macros + 4 плитки + остаток', () => {
    const { container } = render(
      <MacroSummary dayTotals={{ kcal: 2000, p: 150, f: 60, c: 250 }} targets={{ kcal: 2500, protein: 160, fats: 70, carbs: 300 }} />
    );
    expect(container.querySelector('.nd-macros')).not.toBeNull();
    expect(container.querySelectorAll('.nd-macro')).toHaveLength(4);
    expect(container.querySelector('.nd-macro-remain')).not.toBeNull();
  });

  it('MacroSummary: перебор ставит data-over', () => {
    const { container } = render(
      <MacroSummary dayTotals={{ kcal: 3000, p: 200, f: 100, c: 400 }} targets={{ kcal: 2500, protein: 160, fats: 70, carbs: 300 }} />
    );
    expect(container.querySelector('.nd-macro-remain')?.getAttribute('data-over')).toBe('true');
  });

  it('WeekDaySelector: лента + 7 дней + выбранный data-selected', () => {
    const { container } = render(
      <WeekDaySelector weekDays={WEEK} selectedDate="2026-09-09" onSelectDate={noop} diaryData={{}} />
    );
    expect(container.querySelector('.nd-week')).not.toBeNull();
    expect(container.querySelectorAll('.nd-weekday')).toHaveLength(7);
    const selected = container.querySelectorAll('.nd-weekday[data-selected="true"]');
    expect(selected).toHaveLength(1);
    expect(container.querySelectorAll('.nd-week-nav')).toHaveLength(2);
  });

  it('WeekDaySelector: клик по дню зовёт onSelectDate', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <WeekDaySelector weekDays={WEEK} selectedDate="2026-09-09" onSelectDate={onSelect} diaryData={{}} />
    );
    const days = container.querySelectorAll('.nd-weekday');
    fireEvent.click(days[0]);
    expect(onSelect).toHaveBeenCalledWith('2026-09-07');
  });

  it('MealCard: карточка + строки + экшены 44px-хуки', () => {
    const items = [
      { name: 'Курица', qty: '100 г', kcal: 165, p: 31, f: 3.6, c: 0 },
      { name: 'Рис', qty: '100 г', kcal: 130, p: 2.7, f: 0.3, c: 28 },
    ];
    const { container } = render(
      <MealCard mealName="Обед" items={items} onEditItem={noop} onDeleteItem={noop} onCopyMeal={noop} onSavePreset={noop} />
    );
    expect(container.querySelector('.nd-mealcard')).not.toBeNull();
    expect(container.querySelectorAll('.nd-mealitem')).toHaveLength(2);
    expect(container.querySelector('.nd-itemedit')).not.toBeNull();
    expect(container.querySelector('.nd-itemdel')).not.toBeNull();
    expect(screen.getByText('Курица')).toBeInTheDocument();
  });

  it('DayMealsList: пусто — nd-dayempty; с данными — nd-dayactions', () => {
    const { container, rerender } = render(
      <DayMealsList dayMeals={{}} onEditItem={noop} onDeleteItem={noop} onCopyMeal={noop} onSavePreset={noop}
        onImportFromPlan={noop} onClearDay={noop} onFillMicros={noop} selectedDate="2026-09-09" copySource={null} onPasteMeal={noop} onCancelCopy={noop} />
    );
    expect(container.querySelector('.nd-dayempty')).not.toBeNull();
    rerender(
      <DayMealsList dayMeals={{ 'Завтрак': [{ name: 'Яйца', qty: '100 г', kcal: 150, p: 12, f: 10, c: 1 }] }}
        onEditItem={noop} onDeleteItem={noop} onCopyMeal={noop} onSavePreset={noop}
        onImportFromPlan={noop} onClearDay={noop} onFillMicros={noop} selectedDate="2026-09-09" copySource={null} onPasteMeal={noop} onCancelCopy={noop} />
    );
    expect(container.querySelector('.nd-dayactions')).not.toBeNull();
    expect(container.querySelector('.nd-mealcard')).not.toBeNull();
  });

  it('QualityInsights: пусто — null; с данными — nd-quality/nd-mood/nd-patterns', () => {
    const { container } = render(
      <QualityInsights mealQuality={null} selectedDate="2026-09-09" dayMeals={{}}
        foodPatterns={{}} foodTriggers={{}} onSavePattern={noop} onSaveTrigger={noop} mealMood={{}} onSaveMealMood={noop} />
    );
    expect(container.firstChild).toBeNull();
    const { container: full } = render(
      <QualityInsights mealQuality={null} selectedDate="2026-09-09" dayMeals={{ 'Обед': [] }}
        foodPatterns={{}} foodTriggers={{}} onSavePattern={noop} onSaveTrigger={noop} mealMood={{}} onSaveMealMood={noop} />
    );
    expect(full.querySelector('.nd-quality')).not.toBeNull();
    expect(full.querySelector('.nd-mood')).not.toBeNull();
    expect(full.querySelector('.nd-patterns')).not.toBeNull();
    expect(full.querySelector('.nd-mood-note')).not.toBeNull();
  });

  it('FrequentFoodsPanel: хуки ленты и чипов', () => {
    (useFrequentFoods as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      { name: 'Гречка', kcal: 130, p: 4, f: 1, c: 27, qty: 100 },
    ]);
    const { container } = render(<FrequentFoodsPanel diary={{}} onAddFood={noop} />);
    fireEvent.click(screen.getByText('▼'));
    expect(container.querySelector('.nd-freq')).not.toBeNull();
    expect(container.querySelector('.nd-freqchips')).not.toBeNull();
    const active = container.querySelectorAll('.nd-freqchip[data-active="true"]');
    expect(active).toHaveLength(1);
    expect(container.querySelector('.nd-freqitem')).not.toBeNull();
  });
});
