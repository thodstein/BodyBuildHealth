/**
 * addfood-fiber-search.test.tsx — «клетчатка» в дневнике находит сухие пищевые
 * волокна без сети: каталог src/data/fiber-foods.ts подключён к локальному
 * поиску AddFoodPanel, поэтому офлайн-каталог в АПК не пустой.
 *
 * Порция по клику: у псиллиума в каталоге типовая порция 4 г (1 ч. л. с
 * этикетки FDC), PortionSheet открывается сразу на ней, а введённые 12 г уходят
 * в очередь как 12 г — не 100 г «по умолчанию» и не флор 10 г.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../useNutritionDiary', () => ({
  useFrequentFoods: () => [],
  useRecentFoods: () => [],
}));

vi.mock('../../diary/hooks/useDiaryToast', () => ({
  useDiaryToast: () => ({
    toast: null,
    showToast: () => {},
    safeSet: (key: string, data: unknown) => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        /* quota */
      }
    },
  }),
}));

// Сеть глушим: проверяем именно локальный каталог клетчатки.
vi.mock('../../../../../engines/openfoodfacts.engine', () => ({
  searchByName: vi.fn(async () => []),
  searchByBarcode: vi.fn(async () => null),
  saveToCache: vi.fn(async () => undefined),
  productToFoodItem: (p: any) => p,
}));

vi.mock('../../../../../engines/retail-search.engine', () => ({
  RETAIL_CHAINS: {},
  RETAIL_RESULT_LIMIT: 24,
  retailToFoodItem: (p: any) => p,
  searchRetailProducts: vi.fn(async () => ({ items: [], available: false })),
}));

vi.mock('../../../../../engines/barcode-lookup.engine', () => ({
  lookupBarcode: vi.fn(async () => null),
  normalizeScannedBarcode: (raw: string) => (raw || '').replace(/\D/g, '').trim(),
  rememberScannedProduct: () => {},
  customFoodToOFFProduct: (entry: any) => entry,
  retailToOFFProduct: (retail: any, barcode: string) => ({ ...retail, barcode }),
  isNutritionComplete: () => false,
}));

import { NutritionDiary } from '../../NutritionDiary';

const renderDiaryAdd = () => {
  const utils = render(<NutritionDiary foodEntries={[]} />);
  fireEvent.click(screen.getByRole('tab', { name: /Добавить/ }));
  return utils;
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('клетчатка в поиске дневника (офлайн-каталог)', () => {
  it('«клетчатка» находит псиллиум и пшеничные отруби', async () => {
    renderDiaryAdd();
    fireEvent.change(screen.getByLabelText('Поиск продуктов'), { target: { value: 'клетчатка' } });

    expect(await screen.findByText('Псиллиум (шелуха, порошок)', undefined, { timeout: 4000 })).toBeTruthy();
    expect(await screen.findByText('Пшеничные отруби (сухая клетчатка)', undefined, { timeout: 4000 })).toBeTruthy();
  }, 20000);

  it('клик по псиллиуму открывает порцию с этикетки (4 г), 12 г уходят в очередь', async () => {
    renderDiaryAdd();
    fireEvent.change(screen.getByLabelText('Поиск продуктов'), { target: { value: 'клетчатка' } });

    fireEvent.click(await screen.findByText('Псиллиум (шелуха, порошок)', undefined, { timeout: 4000 }));

    const dialog = await screen.findByRole('dialog', { name: /Псиллиум/ });
    expect(dialog.getAttribute('aria-label')).toContain('Псиллиум');
    // Типовая порция каталога (defaultPortion: 4 г = 1 ч. л. с этикетки),
    // а не привычные 100 г.
    const portion = screen.getByLabelText('Порция в граммах') as HTMLInputElement;
    expect(portion.value).toBe('4');

    fireEvent.change(portion, { target: { value: '12' } });
    fireEvent.click(screen.getByLabelText('Добавить в очередь'));

    await waitFor(() => expect(screen.getByText(/На очереди \(1\)/)).toBeTruthy());
    // В очереди именно 12 г (375 ккал/100 г → 45 ккал на порцию), не 100 г.
    expect(screen.getByLabelText('Изменить количество: 12 г')).toBeTruthy();
    // 375 ккал/100 г × 12 г = 45 ккал — в шапке очереди и в строке позиции.
    expect(screen.getAllByText('45 ккал').length).toBeGreaterThan(0);
  }, 20000);

  it('порция с этикетки 4 г попадает в очередь как 4 г, а не 10 г', async () => {
    renderDiaryAdd();
    fireEvent.change(screen.getByLabelText('Поиск продуктов'), { target: { value: 'псиллиум' } });

    fireEvent.click(await screen.findByText('Псиллиум (шелуха, порошок)', undefined, { timeout: 4000 }));
    fireEvent.click(await screen.findByLabelText('Добавить в очередь'));

    await waitFor(() => expect(screen.getByText(/На очереди \(1\)/)).toBeTruthy());
    // Флор 10 г в очереди завышал чайную ложку в 2,5 раза.
    expect(screen.getByLabelText('Изменить количество: 4 г')).toBeTruthy();
    // 375 ккал/100 г × 4 г = 15 ккал (при флоре 10 г было бы 38 ккал).
    expect(screen.getAllByText('15 ккал').length).toBeGreaterThan(0);
  }, 20000);
});
