/**
 * add-to-base-modal.test.tsx — «Добавить продукт в базу» из дневника.
 *
 * Раньше добавление своих продуктов жило только в разделе «Кухня», и из
 * поиска дневника его не было видно. Здесь проверяем, что форма реально
 * пишет продукт в базу (КБЖУ + марка + штрихкод) и обновляет существующую
 * запись вместо дубля.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddToBaseModal } from '../AddToBaseModal';
import { loadCustomFoods, saveOrUpdateCustomFood, type CustomFoodEntry } from '../../../../../engines/meal-custom-food';

vi.mock('../../../../../engines/openfoodfacts.engine', () => ({
  saveToCache: vi.fn(async () => {}),
}));
vi.mock('../../../../../engines/food-barcode-catalog.engine', () => ({
  saveSharedBarcode: vi.fn(async () => true),
}));

const baseEntry: CustomFoodEntry = {
  id: 'custom_test_1',
  name: 'Протеиновый батончик',
  brand: 'Bombbar',
  barcode: '4600000000001',
  kcal: 210,
  protein: 20,
  fat: 7,
  carbs: 18,
  fiber: 5,
  category: 'supplement',
  servingSize: '60 г',
  source: 'manual',
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => cleanup());

describe('AddToBaseModal — продукт в свою базу', () => {
  it('сохраняет название, марку, штрихкод и КБЖУ', async () => {
    const onClose = vi.fn();
    render(<AddToBaseModal open initial={null} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Название продукта'), { target: { value: 'Творог 5%' } });
    fireEvent.change(screen.getByLabelText('Марка'), { target: { value: 'Простоквашино' } });
    fireEvent.change(screen.getByLabelText('Штрихкод'), { target: { value: '4600000000001' } });
    fireEvent.change(screen.getByLabelText('Ккал'), { target: { value: '121' } });
    fireEvent.change(screen.getByLabelText('Белки'), { target: { value: '16' } });
    fireEvent.change(screen.getByLabelText('Жиры'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Углев.'), { target: { value: '3' } });

    fireEvent.click(screen.getByLabelText('Сохранить продукт в базу'));

    const saved = loadCustomFoods();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      name: 'Творог 5%',
      brand: 'Простоквашино',
      barcode: '4600000000001',
      kcal: 121,
      protein: 16,
      fat: 5,
      carbs: 3,
      source: 'manual',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('без названия не сохраняет и показывает ошибку', () => {
    render(<AddToBaseModal open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Ккал'), { target: { value: '100' } });
    fireEvent.click(screen.getByLabelText('Сохранить продукт в базу'));

    expect(loadCustomFoods()).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toContain('название');
  });

  it('без калорийности не сохраняет', () => {
    render(<AddToBaseModal open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Название продукта'), { target: { value: 'Вода' } });
    fireEvent.click(screen.getByLabelText('Сохранить продукт в базу'));

    expect(loadCustomFoods()).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toContain('калорийность');
  });

  it('подставляет поля найденного продукта', () => {
    render(
      <AddToBaseModal
        open
        initial={{ name: 'Творог «Простоквашино» 5%', brand: 'Простоквашино', kcal: 121, protein: 16, fat: 5, carbs: 3 }}
        onClose={vi.fn()}
      />,
    );
    expect((screen.getByLabelText('Название продукта') as HTMLInputElement).value).toContain('Простоквашино');
    expect((screen.getByLabelText('Марка') as HTMLInputElement).value).toBe('Простоквашино');
    expect((screen.getByLabelText('Ккал') as HTMLInputElement).value).toBe('121');
  });

  it('повторное сохранение с тем же штрихкодом обновляет запись', async () => {
    saveOrUpdateCustomFood(baseEntry);
    render(<AddToBaseModal open initial={{ ...baseEntry, kcal: 220 }} onClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Сохранить продукт в базу'));

    const saved = loadCustomFoods();
    expect(saved).toHaveLength(1);
    expect(saved[0].kcal).toBe(220);
    expect(saved[0].id).toBe(baseEntry.id);
    // Штрихкод уходит в общий кэш/базу — сканер найдёт продукт офлайн.
    const off = await import('../../../../../engines/openfoodfacts.engine');
    await waitFor(() => expect(off.saveToCache).toHaveBeenCalled());
  });
});
