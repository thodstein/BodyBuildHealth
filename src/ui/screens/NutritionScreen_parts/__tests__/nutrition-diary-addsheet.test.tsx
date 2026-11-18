/**
 * nutrition-diary-addsheet.test.tsx — полноэкранный лист добавления еды:
 * 0) дневник открывается на «Дне», лист — по вкладке «Добавить»;
 * 1) открыт как диалог поверх экрана, с поиском и кнопкой закрытия;
 * 2) поиск НЕ сбрасывается после «＋» — можно добавить несколько продуктов;
 * 3) очередь можно очистить целиком;
 * 4) Esc закрывает лист и возвращает на «День»;
 * 5) пустой поиск предлагает популярные запросы.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../useNutritionDiary', () => ({
  useFrequentFoods: () => [],
  useRecentFoods: () => [],
}));

vi.mock('../diary/hooks/useDiaryToast', () => ({
  useDiaryToast: () => ({
    toast: null,
    showToast: () => {},
    safeSet: (key: string, data: unknown) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ } },
  }),
}));

// Сеть в тестах не нужна: поиск по брендам/сетям отключён, работаем по FOOD_DB.
vi.mock('../../../../engines/openfoodfacts.engine', () => ({
  searchByName: vi.fn(async () => []),
  searchByBarcode: vi.fn(async () => ({ name: 'Творог «Простоквашино» 5%', kcal: 121, protein: 16, fat: 5, carbs: 3 })),
  productToFoodItem: (p: any) => p,
}));
vi.mock('../../../../engines/retail-search.engine', () => ({
  RETAIL_CHAINS: {},
  RETAIL_RESULT_LIMIT: 24,
  retailToFoodItem: (p: any) => p,
  searchRetailProducts: vi.fn(async () => ({ items: [], available: false })),
}));

import { NutritionDiary } from '../NutritionDiary';
import { mealForNow } from '../diary/hooks/useDiaryMealTypes';

/**
 * Дневник открывается на «Дне» (смотреть, что съел), а полноэкранный лист
 * добавления — по вкладке «Добавить». Тесты листа открывают его явно, чтобы
 * проверять именно лист, а не дефолтную вкладку.
 */
const renderDiary = () => render(<NutritionDiary foodEntries={[]} />);
const renderDiaryAdd = () => {
  const utils = renderDiary();
  fireEvent.click(screen.getByRole('tab', { name: 'Добавить' }));
  return utils;
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('Дневник: полноэкранный лист добавления еды', () => {
  // «＋» теперь сначала спрашивает порцию (окно «Сколько грамм?»), поэтому
  // добавление из поиска = выбрать продукт → подтвердить 100 г в шторке.
  const addFirstFromSearch = () => {
    fireEvent.click(screen.getAllByLabelText('Указать порцию')[0]);
    fireEvent.click(screen.getByLabelText('Добавить в очередь'));
  };

  it('по умолчанию открывается «День», лист добавления — только по вкладке', () => {
    const { container } = renderDiary();
    // Пришёл в дневник — видишь свои приёмы, а не поиск.
    expect(container.querySelector('.nd-addsheet')).toBeNull();
    expect(screen.getAllByLabelText('Приёмы пищи').length).toBeGreaterThan(0);

    // Добавление — один тап по вкладке.
    fireEvent.click(screen.getByRole('tab', { name: 'Добавить' }));
    expect(container.querySelector('.nd-addsheet')).toBeTruthy();
    expect(screen.getByLabelText('Поиск продуктов')).toBeTruthy();
  });

  it('камера этикетки из виджета сама открывает лист «Добавить»', async () => {
    // Виджет «Питание» → «Фото» ставит флаг; панель камеры живёт в листе добавления,
    // поэтому дневник, стартующий на «Дне», обязан переключиться.
    sessionStorage.setItem('he:nut-label-cam', '1');
    const { container } = renderDiary();
    await waitFor(() => expect(container.querySelector('.nd-addsheet')).not.toBeNull());
  });

  it('открывается как диалог на весь экран с поиском и кнопкой закрытия', () => {
    const { container } = renderDiaryAdd();
    const sheet = container.querySelector('.nd-addsheet') as HTMLElement;
    expect(sheet).toBeTruthy();
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByLabelText('Поиск продуктов')).toBeTruthy();
    expect(screen.getByLabelText('Закрыть добавление')).toBeTruthy();
    // Тело листа — единственная прокручиваемая область.
    expect(container.querySelector('.nd-add-body')).toBeTruthy();
  });

  it('поиск не сбрасывается после «＋»: можно добавить несколько продуктов подряд', async () => {
    renderDiaryAdd();
    const input = screen.getByLabelText('Поиск продуктов') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'творог' } });

    await waitFor(() => expect(screen.getAllByLabelText('Указать порцию').length).toBeGreaterThan(0));
    const resultRows = () => document.querySelectorAll('.nd-result').length;
    const resultsBefore = resultRows();

    addFirstFromSearch();

    await waitFor(() => expect(screen.getByText(/На очереди \(1\)/)).toBeTruthy());
    // Главное: выдача на месте, искать заново не нужно.
    expect(input.value).toBe('творог');
    expect(resultRows()).toBe(resultsBefore);

    addFirstFromSearch();
    await waitFor(() => expect(screen.getByText(/На очереди \(2\)/)).toBeTruthy());
  });

  it('очередь очищается одной кнопкой', async () => {
    renderDiaryAdd();
    const input = screen.getByLabelText('Поиск продуктов') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'творог' } });
    await waitFor(() => expect(screen.getAllByLabelText('Указать порцию').length).toBeGreaterThan(0));
    addFirstFromSearch();
    await waitFor(() => expect(screen.getByText(/На очереди \(1\)/)).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Очистить очередь'));
    await waitFor(() => expect(screen.queryByText(/На очереди \(1\)/)).toBeNull());
  });

  it('Esc закрывает лист и показывает «День»', () => {
    const { container } = renderDiaryAdd();
    expect(container.querySelector('.nd-addsheet')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(container.querySelector('.nd-addsheet')).toBeNull();
    expect(screen.getAllByLabelText('Приёмы пищи').length).toBeGreaterThan(0);
  });

  it('на пустом поиске предлагает популярные запросы', async () => {
    renderDiaryAdd();
    const chip = screen.getByLabelText('Искать творог');
    fireEvent.click(chip);
    await waitFor(() => expect((screen.getByLabelText('Поиск продуктов') as HTMLInputElement).value).toBe('творог'));
  });

  it('релевантность: точное слово в начале названия идёт первым', async () => {
    renderDiaryAdd();
    fireEvent.change(screen.getByLabelText('Поиск продуктов'), { target: { value: 'творог' } });
    await waitFor(() => expect(document.querySelectorAll('.nd-result').length).toBeGreaterThan(0));
    const firstName = (document.querySelector('.nd-result .nd-result-name, .nd-result') as HTMLElement | null)?.textContent?.toLowerCase() || '';
    expect(firstName).toContain('творог');
    // Именно «Творог …», а не «Сырники творожные» / «Запеканка творожная».
    expect(/^[^a-zа-яё]*творог/.test(firstName.trim())).toBe(true);
  });

  it('штрихкод, вставленный в поиск, ищется сразу — без «Сканировать»', async () => {
    renderDiaryAdd();
    fireEvent.change(screen.getByLabelText('Поиск продуктов'), { target: { value: '4600000000001' } });
    await waitFor(() => expect(document.querySelector('.nd-barcode-result')?.textContent).toContain('Простоквашино'));
    addFirstFromSearch();
    await waitFor(() => expect(screen.getByText(/На очереди \(1\)/)).toBeTruthy());
  });

  it('из пустой выдачи можно сразу добавить продукт в базу', async () => {
    renderDiaryAdd();
    fireEvent.change(screen.getByLabelText('Поиск продуктов'), { target: { value: 'щщщнесуществующий' } });

    await waitFor(() => expect(screen.getByText(/Ничего не найдено/)).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Добавить найденное название в базу'));

    // Открывается форма своей базы с уже введённым запросом.
    expect(await screen.findByLabelText('Добавить продукт в базу')).toBeTruthy();
    expect((screen.getByLabelText('Название продукта') as HTMLInputElement).value).toBe('щщщнесуществующий');
  });

  it('честно сообщает, когда каталоги сетей недоступны', async () => {
    renderDiaryAdd();
    fireEvent.change(screen.getByLabelText('Поиск продуктов'), { target: { value: 'творог' } });
    await waitFor(() => expect(screen.getByText(/Каталоги сетей сейчас недоступны/)).toBeTruthy());
  });

  it('звезда в результатах поиска кладёт продукт в избранное', async () => {
    renderDiaryAdd();
    fireEvent.change(screen.getByLabelText('Поиск продуктов'), { target: { value: 'творог' } });

    await waitFor(() => expect(screen.getAllByLabelText('В избранное').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByLabelText('В избранное')[0]);

    await waitFor(() => expect(screen.getAllByLabelText('Убрать из избранного').length).toBe(1));
    const ids = JSON.parse(localStorage.getItem('he_food_favs') || '[]');
    expect(ids.length).toBeGreaterThan(0);
    expect(String(localStorage.getItem('he_food_favs_meta') || '').toLowerCase()).toContain('творог');

    // Повторный тап снимает звезду — и продукт уходит из избранного.
    fireEvent.click(screen.getAllByLabelText('Убрать из избранного')[0]);
    await waitFor(() => expect(screen.queryAllByLabelText('Убрать из избранного')).toHaveLength(0));
    expect(JSON.parse(localStorage.getItem('he_food_favs') || '[]')).toEqual([]);
  });

  it('«Отменить» в тосте убирает случайно добавленную позицию', async () => {
    renderDiaryAdd();
    fireEvent.change(screen.getByLabelText('Поиск продуктов'), { target: { value: 'творог' } });

    await waitFor(() => expect(screen.getAllByLabelText('Указать порцию').length).toBeGreaterThan(0));
    addFirstFromSearch();
    await waitFor(() => expect(screen.getByText(/На очереди \(1\)/)).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Отменить добавление'));
    await waitFor(() => expect(screen.queryByText(/На очереди \(1\)/)).toBeNull());
    expect(document.querySelector('.nd-queued-toast')).toBeNull();
  });

  it('после сохранения показывает сами приёмы пищи, а не только КБЖУ', async () => {
    const spy = vi.fn();
    const orig = (Element.prototype as any).scrollIntoView;
    (Element.prototype as any).scrollIntoView = spy;
    try {
      renderDiaryAdd();
      fireEvent.change(screen.getByLabelText('Поиск продуктов'), { target: { value: 'творог' } });
      await waitFor(() => expect(screen.getAllByLabelText('Указать порцию').length).toBeGreaterThan(0));
      addFirstFromSearch();
      await waitFor(() => expect(screen.getByText(/На очереди \(1\)/)).toBeTruthy());

      fireEvent.click(screen.getByLabelText('Сохранить'));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(document.querySelector('.nd-sec-meals')).toBeTruthy();
      await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(0));
    } finally {
      (Element.prototype as any).scrollIntoView = orig;
    }
  });

  it('приём по умолчанию — по часам, и выбранный чип можно сбросить', async () => {
    const at = (h: number) => new Date(2026, 10, 8, h, 0, 0);
    expect(mealForNow(at(8))).toBe('Завтрак');
    expect(mealForNow(at(13))).toBe('Обед');
    expect(mealForNow(at(19))).toBe('Ужин');
    expect(mealForNow(at(2))).toBe('Перекус');

    renderDiaryAdd();
    const active = () => screen.getAllByLabelText(/^Приём: /).find(b => b.getAttribute('aria-pressed') === 'true');
    await waitFor(() => expect(active()).toBeTruthy());
    const chip = active()!;
    fireEvent.click(chip);
    await waitFor(() => expect(chip.getAttribute('aria-pressed')).toBe('false'));
    // Не «отскакивает» обратно в дефолт после сброса.
    await new Promise(r => setTimeout(r, 60));
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });
});
