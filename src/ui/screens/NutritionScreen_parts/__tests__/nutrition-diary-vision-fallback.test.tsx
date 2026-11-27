/**
 * nutrition-diary-vision-fallback.test.tsx — замки AI-fallback в дневнике.
 *
 * 1. OCR не нашёл ни одной позиции (фото тарелки без текста) → вызывается
 *    AI-распознавание, и позиции попадают в очередь.
 * 2. Если OCR уже дал позиции — AI не вызывается вовсе (не тратим квоту и
 *    не подменяем проверенный путь «на всякий случай»).
 * 3. Ошибка AI не ломает экран: показывается текст ошибки, очередь пуста.
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
    safeSet: (key: string, data: unknown) => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        /* quota */
      }
    },
  }),
}));

const ocrMock = vi.hoisted(() => ({ processUploadedFile: vi.fn() }));
vi.mock('../../../../core/ocr-engine', () => ({ processUploadedFile: ocrMock.processUploadedFile }));

const visionMock = vi.hoisted(() => ({
  recognizeFoodOrLabel: vi.fn(),
  isFoodVisionAvailable: vi.fn(() => true),
}));
vi.mock('../../../../engines/food-vision.engine', () => visionMock);

import { NutritionDiary } from '../NutritionDiary';

const renderDiaryAdd = () => {
  const utils = render(<NutritionDiary foodEntries={[]} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Добавить' }));
  return utils;
};

const uploadImage = (container: HTMLElement, name = 'plate.jpg') => {
  const fileInput = container.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
  expect(fileInput).toBeTruthy();
  fireEvent.change(fileInput, {
    target: { files: [new File([new Uint8Array([1, 2, 3])], name, { type: 'image/jpeg' })] },
  });
};

beforeEach(() => {
  localStorage.clear();
  ocrMock.processUploadedFile.mockReset();
  visionMock.recognizeFoodOrLabel.mockReset();
  visionMock.isFoodVisionAvailable.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
});

describe('Дневник: AI-fallback распознавания фото', () => {
  it('OCR пуст → AI узнаёт блюдо, позиции в очереди', async () => {
    ocrMock.processUploadedFile.mockResolvedValue({ text: '', labs: [], meals: [], warnings: [] });
    visionMock.recognizeFoodOrLabel.mockResolvedValue({
      ok: true,
      mode: 'food',
      meals: [
        {
          date: '2026-11-26',
          mealType: 'Приём пищи',
          items: [
            { name: 'Курица', qty: '200 г', qtyGrams: 200, kcal: 165, p: 31, f: 3.6, c: 0 },
            { name: 'Рис', qty: '150 г', qtyGrams: 150, kcal: 130, p: 2.7, f: 0.3, c: 28 },
          ],
        },
      ],
      warnings: ['«Соус» нет в локальной базе — КБЖУ оценены ИИ'],
      provider: 'gemini',
      model: 'gemini-flash-latest',
    });

    const { container } = renderDiaryAdd();
    uploadImage(container);

    await waitFor(() => expect(screen.getByText(/На очереди \(2\)/)).toBeTruthy());
    expect(visionMock.recognizeFoodOrLabel).toHaveBeenCalledTimes(1);
    const [, options] = visionMock.recognizeFoodOrLabel.mock.calls[0];
    expect(options).toMatchObject({ ocrText: '' });
    // Предупреждение AI доходит до пользователя.
    expect(screen.getByText(/КБЖУ оценены ИИ/)).toBeTruthy();
  });

  it('OCR прочитал текст, но не разобрал таблицу → AI читает упаковку на 100 г', async () => {
    ocrMock.processUploadedFile.mockResolvedValue({
      text: 'Пищевая ценность на 100 г Белки Жиры Углеводы',
      labs: [],
      meals: [],
      warnings: [],
    });
    visionMock.recognizeFoodOrLabel.mockResolvedValue({
      ok: true,
      mode: 'label',
      meals: [
        {
          date: '2026-11-26',
          mealType: 'Приём пищи',
          items: [{ name: 'Творог 5% (Простоквашино)', qty: '100 г', qtyGrams: 100, kcal: 121, p: 16, f: 5, c: 3 }],
        },
      ],
      warnings: ['Данные прочитаны с этикетки ИИ — сверьте цифры с упаковкой.'],
    });

    const { container } = renderDiaryAdd();
    uploadImage(container, 'label.jpg');

    await waitFor(() => expect(screen.getByText(/На очереди \(1\)/)).toBeTruthy());
    const [, options] = visionMock.recognizeFoodOrLabel.mock.calls[0];
    expect(options.ocrText).toContain('Пищевая ценность');
    // Режим этикетки объясняет, что вес нужно указать вручную.
    expect(screen.getByText(/прочитал упаковку/)).toBeTruthy();
  });

  it('OCR нашёл позиции → AI не вызывается', async () => {
    ocrMock.processUploadedFile.mockResolvedValue({
      text: 'Курица 200 г 330 ккал Б:35 Ж:7 У:0',
      labs: [],
      meals: [
        {
          mealType: 'Завтрак',
          items: [{ name: 'Курица', qty: '200 г', qtyGrams: 200, kcal: 165, p: 31, f: 3.6, c: 0 }],
        },
      ],
      warnings: [],
    });

    const { container } = renderDiaryAdd();
    uploadImage(container);

    await waitFor(() => expect(screen.getByText(/На очереди \(1\)/)).toBeTruthy());
    expect(visionMock.recognizeFoodOrLabel).not.toHaveBeenCalled();
  });

  it('AI выключен в этом окружении → вызова нет, экран живёт как раньше', async () => {
    visionMock.isFoodVisionAvailable.mockReturnValue(false);
    ocrMock.processUploadedFile.mockResolvedValue({
      text: '',
      labs: [],
      meals: [],
      warnings: ['Текст не распознан'],
    });

    const { container } = renderDiaryAdd();
    uploadImage(container);

    await waitFor(() => expect(screen.getByText('Текст не распознан')).toBeTruthy());
    expect(visionMock.recognizeFoodOrLabel).not.toHaveBeenCalled();
  });

  it('ошибка AI показывается текстом, очередь остаётся пустой', async () => {
    ocrMock.processUploadedFile.mockResolvedValue({ text: '', labs: [], meals: [], warnings: [] });
    visionMock.recognizeFoodOrLabel.mockResolvedValue({
      ok: false,
      meals: [],
      warnings: [],
      error: 'Провайдер ответил 429',
    });

    const { container } = renderDiaryAdd();
    uploadImage(container);

    await waitFor(() => expect(screen.getByText('Провайдер ответил 429')).toBeTruthy());
    expect(screen.queryByText(/На очереди/)).toBeNull();
  });
});
