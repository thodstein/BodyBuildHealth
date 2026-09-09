/**
 * Guard-тест PRO-слоя дневника питания (§89-91).
 * Ловит молчаливый откат nd-хуков: без них APK-CSS не цепляется.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MacroSummary } from '../diary/MacroSummary';
import { WeekDaySelector } from '../diary/WeekDaySelector';
import { MealCard } from '../diary/MealCard';
import { DayMealsList } from '../diary/DayMealsList';
import { QualityInsights } from '../diary/QualityInsights';
import { NutritionDiaryCharts } from '../NutritionDiaryCharts';
import { StorageErrorBanner } from '../diary/StorageErrorBanner';
import { WeekView } from '../diary/WeekView';
import { formatDate, parseDateOnly } from '../../../../core/utils/date-utils';

vi.mock('../useNutritionDiary', () => ({
  useFrequentFoods: vi.fn(() => []),
  useRecentFoods: vi.fn(() => []),
}));

import { FrequentFoodsPanel } from '../diary/FrequentFoodsPanel';
import { DiarySection } from '../diary/DiarySection';
import { NutritionDiary } from '../NutritionDiary';
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

  it('WeekDaySelector: стрелки сдвигают неделю на ±7 локальных дней', () => {
    const onSelect = vi.fn();
    render(
      <WeekDaySelector weekDays={WEEK} selectedDate="2026-09-09" onSelectDate={onSelect} diaryData={{}} />
    );
    fireEvent.click(screen.getByLabelText('Пред. неделя'));
    expect(onSelect).toHaveBeenCalledWith('2026-09-02');
    fireEvent.click(screen.getByLabelText('След. неделя'));
    expect(onSelect).toHaveBeenCalledWith('2026-09-16');
  });

  it('WeekDaySelector: Enter/Space по дню зовёт onSelectDate', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <WeekDaySelector weekDays={WEEK} selectedDate="2026-09-09" onSelectDate={onSelect} diaryData={{}} />
    );
    const days = container.querySelectorAll('.nd-weekday');
    fireEvent.keyDown(days[1], { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('2026-09-08');
    fireEvent.keyDown(days[3], { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith('2026-09-10');
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
    expect(container.querySelector('.nd-daycount')).not.toBeNull();
    expect(container.querySelector('.nd-mealcard')).not.toBeNull();
    expect(container.querySelectorAll('.nd-mealbtn')).toHaveLength(2);
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

  it('NutritionDiaryCharts: корень + гейджи + топ-хук', () => {
    const dayMeals = {
      'Завтрак': [{ name: 'Яйца', qty: '100 г', kcal: 150, p: 12, f: 10, c: 1 }],
      'Обед': [{ name: 'Гречка', qty: '100 г', kcal: 130, p: 4, f: 1, c: 27 }],
    };
    const diaryData = {
      '2026-09-08': { meals: { 'Обед': [{ name: 'Гречка', kcal: 130, p: 4, f: 1, c: 27 }] } },
      '2026-09-09': { meals: dayMeals },
    };
    const { container } = render(
      <NutritionDiaryCharts dayMeals={dayMeals} dayTotals={{ kcal: 280, p: 16, f: 11, c: 28 }}
        targets={{ kcal: 2500, protein: 160, fats: 70, carbs: 300 }}
        diaryData={diaryData} selectedDate="2026-09-09" refreshKey={0} />
    );
    expect(container.querySelector('.nd-charts')).not.toBeNull();
    expect(container.querySelector('.nd-donutleg')).not.toBeNull();
    expect(container.querySelectorAll('.nd-gauge')).toHaveLength(2);
    expect(container.querySelector('.nd-topname')).not.toBeNull();
    expect(container.querySelector('.nd-mealscount')).not.toBeNull();
  });

  it('NutritionDiaryCharts: пусто — null', () => {
    const { container } = render(
      <NutritionDiaryCharts dayMeals={{}} dayTotals={{ kcal: 0, p: 0, f: 0, c: 0 }}
        diaryData={{}} selectedDate="2026-09-09" refreshKey={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('StorageErrorBanner: пусто — null; с ошибкой — nd-storeerr', () => {
    const { container } = render(<StorageErrorBanner error={null} onDismiss={noop} />);
    expect(container.firstChild).toBeNull();
    const { container: full } = render(
      <StorageErrorBanner error="Тестовая ошибка квоты" onDismiss={noop} />
    );
    expect(full.querySelector('.nd-storeerr')).not.toBeNull();
    expect(full.querySelector('.nd-storedismiss')).not.toBeNull();
    expect(full.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('parseDateOnly: локальный парсинг без UTC-сдвига', () => {
    // 2026-09-07 — понедельник в любой зоне (new Date('...').getDay() врёт в UTC−)
    expect(parseDateOnly('2026-09-07').getDay()).toBe(1);
    expect(parseDateOnly('2026-09-13').getDay()).toBe(0);
    for (const ds of WEEK) {
      expect(formatDate(parseDateOnly(ds))).toBe(ds);
    }
  });

  it('WeekDaySelector: номера и имена дней из локального парсинга', () => {
    const { container } = render(
      <WeekDaySelector weekDays={WEEK} selectedDate="2026-09-09" onSelectDate={noop} diaryData={{}} />
    );
    const names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const days = container.querySelectorAll('.nd-weekday');
    expect(days).toHaveLength(7);
    days.forEach((el, i) => {
      expect(el.getAttribute('aria-label')).toContain(names[i]);
      expect(el.textContent).toContain(String(parseDateOnly(WEEK[i]).getDate()));
    });
  });

  it('WeekView: сводка + 4 стат-тайла + 7 строк', () => {
    const { container } = render(
      <WeekView diaryData={{}} targets={{ kcal: 2500, protein: 160, fats: 70, carbs: 300 }}
        selectedDate="2026-09-09" onSelectDate={noop} />
    );
    expect(container.querySelector('.nd-weekview')).not.toBeNull();
    expect(container.querySelector('.nd-weeksum')).not.toBeNull();
    expect(container.querySelector('.nd-weekstats')).not.toBeNull();
    expect(container.querySelectorAll('.nd-weekstat')).toHaveLength(4);
    expect(container.querySelectorAll('.nd-dayrow')).toHaveLength(7);
  });

  it('WeekView: навигация ±7 локальных дней + шевроны + пустая подсказка', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <WeekView diaryData={{}} targets={{ kcal: 2500, protein: 160, fats: 70, carbs: 300 }}
        selectedDate="2026-09-09" onSelectDate={onSelect} />
    );
    expect(container.querySelector('.nd-weeknav')).not.toBeNull();
    expect(container.querySelector('.nd-weekempty')).not.toBeNull();
    expect(container.querySelectorAll('.nd-daychev')).toHaveLength(7);
    fireEvent.click(screen.getByLabelText('Пред. неделя'));
    expect(onSelect).toHaveBeenCalledWith('2026-09-02');
    fireEvent.click(screen.getByLabelText('След. неделя'));
    expect(onSelect).toHaveBeenCalledWith('2026-09-16');
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

  it('FrequentFoodsPanel: шапка разворачивается с клавиатуры', () => {
    (useFrequentFoods as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      { name: 'Гречка', kcal: 130, p: 4, f: 1, c: 27, qty: 100 },
    ]);
    render(<FrequentFoodsPanel diary={{}} onAddFood={noop} />);
    const head = screen.getByLabelText('Быстрое добавление');
    expect(head.getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyDown(head, { key: 'Enter' });
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Гречка')).toBeInTheDocument();
  });

  it('DiarySection: секция с хуком nd-sec-<id> + заголовок + счётчик', () => {
    const { container } = render(
      <DiarySection id="meals" icon="🍽" title="Приёмы пищи" sub="2026-09-09" color="#60a5fa" count="3 поз.">
        <div>тело</div>
      </DiarySection>
    );
    expect(container.querySelector('.nd-section')).not.toBeNull();
    expect(container.querySelector('.nd-sec-meals')).not.toBeNull();
    expect(container.querySelector('.nd-sec-head')).not.toBeNull();
    expect(container.querySelector('.nd-sec-count')).not.toBeNull();
    expect(screen.getByText('Приёмы пищи')).toBeInTheDocument();
    expect(screen.getByText('3 поз.')).toBeInTheDocument();
    expect(container.querySelector('.nd-sec-body')).not.toBeNull();
  });

  it('NutritionDiaryCharts: мини-гейджи жиров/углеводов + 4 спарклайна', () => {
    const dayMeals = {
      'Завтрак': [{ name: 'Яйца', qty: '100 г', kcal: 150, p: 12, f: 10, c: 1 }],
    };
    const diaryData = {
      '2026-09-08': { meals: { 'Обед': [{ name: 'Гречка', kcal: 130, p: 4, f: 1, c: 27 }] } },
      '2026-09-09': { meals: dayMeals },
    };
    const { container } = render(
      <NutritionDiaryCharts dayMeals={dayMeals} dayTotals={{ kcal: 280, p: 16, f: 11, c: 28 }}
        targets={{ kcal: 2500, protein: 160, fats: 70, carbs: 300 }}
        diaryData={diaryData} selectedDate="2026-09-09" refreshKey={0} />
    );
    // большие гейджи — ровно 2 (Ккал/Белки), жиры/углеводы — мини
    expect(container.querySelectorAll('.nd-gauge')).toHaveLength(2);
    expect(container.querySelectorAll('.nd-gauge-mini')).toHaveLength(2);
    expect(container.querySelector('.nd-balance')).not.toBeNull();
    expect(container.querySelector('.nd-minigauges')).not.toBeNull();
    expect(container.querySelector('.nd-trends')).not.toBeNull();
    expect(container.querySelectorAll('.nd-spark').length).toBeGreaterThanOrEqual(4);
  });

  it('NutritionDiary: секция Данные с экспортом/импортом/очисткой', () => {
    const { container } = render(<NutritionDiary foodEntries={[]} />);
    expect(container.querySelector('.nd-sec-data')).not.toBeNull();
    expect(container.querySelector('.nd-data-grid')).not.toBeNull();
    expect(container.querySelector('.nd-import')).not.toBeNull();
    expect(container.querySelector('.nd-wipeall')).not.toBeNull();
    expect(screen.getByText(/Экспорт JSON/)).toBeInTheDocument();
    expect(screen.getByText(/Экспорт CSV/)).toBeInTheDocument();
    expect(screen.getByText(/Импорт JSON/)).toBeInTheDocument();
  });

  it('NutritionDiary: табы обёрнуты в секции add/week', () => {
    const { container } = render(<NutritionDiary foodEntries={[]} />);
    expect(container.querySelector('.nd-sec-add')).not.toBeNull();
    expect(container.querySelector('.nd-sec-week')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Неделя' }));
    expect(container.querySelector('.nd-sec-week')).not.toBeNull();
  });
});
