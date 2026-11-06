/**
 * nutrition-diary-ocr-save.test.tsx — регрессии OCR-панели дневника:
 * 1) распознанные из скриншота продукты реально попадают в приём пищи;
 * 2) во время распознавания видны проценты выполнения (как в анализах);
 * 3) строка добавления закреплена (sticky) и не «бегает» по экрану;
 * 4) в карточке сырого текста есть своя кнопка добавления;
 * 5) после добавления дневник уводит на вкладку «День»;
 * 6) в панели нет плавающих (position: fixed) кнопок.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../useNutritionDiary', () => ({
  useFrequentFoods: () => [],
  useRecentFoods: () => [],
}));

// Тост с таймером на 2.5 с переживает размонтирование и падает уже после
// teardown окружения — для этого теста сообщение не важно, важна запись в дневник.
vi.mock('../diary/hooks/useDiaryToast', () => ({
  useDiaryToast: () => ({ toast: null, showToast: () => {}, safeSet: (key: string, data: unknown) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ } } }),
}));

vi.mock('../../../../core/ocr-engine', () => ({
  processUploadedFile: vi.fn(async () => ({
    text: 'Завтрак\nКурица 200 г 330 ккал Б:35 Ж:7 У:0\nРис 150 г 200 ккал Б:4 Ж:1 У:42',
    labs: [],
    meals: [
      { mealType: 'Завтрак', items: [
        { name: 'Курица', qty: '200 г', qtyGrams: 200, kcal: 330, p: 35, f: 7, c: 0 },
        { name: 'Рис', qty: '150 г', qtyGrams: 150, kcal: 200, p: 4, f: 1, c: 42 },
      ] },
    ],
    warnings: [],
  })),
}));

import { NutritionDiary } from '../NutritionDiary';
import { readDiaryV2 } from '../diary-storage-v2';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('Дневник: сохранение распознанных скриншотов', () => {
  it('кнопка сохранения переносит распознанные продукты в приём пищи', async () => {
    const { getByLabelText, getByText, queryByText } = render(<NutritionDiary foodEntries={[]} />);

    fireEvent.click(getByLabelText('Текст'));
    fireEvent.change(getByLabelText('Текст для распознавания'), {
      target: { value: 'Курица 200 г 330 ккал Б:35 Ж:7 У:0' },
    });
    fireEvent.click(getByLabelText('Распознать'));

    await waitFor(() => expect(getByText(/На очереди \(1\)/)).toBeTruthy());

    fireEvent.click(getByLabelText('Сохранить'));

    await waitFor(() => {
      const diary = readDiaryV2() as Record<string, any>;
      const days = Object.values(diary);
      expect(days.length).toBeGreaterThan(0);
      const meals = Object.values(days[0].meals || {}) as any[][];
      expect(meals.flat().length).toBe(1);
      expect(meals[0][0].name).toContain('Курица');
    });

    // Очередь очищается после сохранения.
    await waitFor(() => expect(queryByText(/На очереди/)).toBeNull());
  });

  it('скриншот из галереи: распознанные строки тоже сохраняются в дневник', async () => {
    const { container, getByLabelText } = render(<NutritionDiary foodEntries={[]} />);

    const fileInput = container.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const file = new File([new Uint8Array([1, 2, 3])], 'screen.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(getByLabelText('Сохранить')).toBeTruthy());
    fireEvent.click(getByLabelText('Сохранить'));

    await waitFor(() => {
      const diary = readDiaryV2() as Record<string, any>;
      const meals = Object.values(Object.values(diary)[0]?.meals || {}) as any[][];
      expect(meals.flat().map(i => i.name)).toEqual(['Курица', 'Рис']);
    });
  });

  it('показывает проценты выполнения и закреплённую строку добавления', async () => {
    const { processUploadedFile } = await import('../../../../core/ocr-engine');
    let finish: (value: unknown) => void = () => {};
    vi.mocked(processUploadedFile).mockImplementationOnce(async (_file: File, opts: any) => {
      opts?.onProgress?.(0.42);
      return new Promise<any>((resolve) => { finish = resolve; });
    });

    const { container } = render(<NutritionDiary foodEntries={[]} />);
    fireEvent.click(screen.getByLabelText('Текст'));
    const fileInput = container.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File([new Uint8Array([1])], 's.png', { type: 'image/png' })] } });

    // Проценты распознавания, как в анализах.
    await waitFor(() => expect(screen.getByLabelText('Прогресс распознавания').textContent).toBe('42%'));
    expect(screen.getByText('Распознаю скриншот…')).toBeTruthy();

    await act(async () => {
      finish({
        text: 'Курица 200 г 330 ккал Б:35 Ж:7 У:0',
        labs: [],
        meals: [{ mealType: 'Завтрак', items: [{ name: 'Курица', qty: '200 г', qtyGrams: 200, kcal: 330, p: 35, f: 7, c: 0 }] }],
        warnings: [],
      });
    });

    // Строка добавления закреплена (sticky), а не «бегает» по экрану.
    const actions = container.querySelector('.nd-ocr-actions') as HTMLElement;
    expect(actions).toBeTruthy();
    expect(actions.style.position).toBe('sticky');

    // В карточке сырого текста есть своя кнопка добавления.
    expect(screen.getByText(/Текст со скриншота/)).toBeTruthy();
    expect(screen.getByLabelText('Добавить в дневник')).toBeTruthy();
    expect(screen.getByLabelText('Разобрать заново')).toBeTruthy();
  });

  it('поиск не sticky, а строка добавления закреплена над пилюлей навигации', async () => {
    const { container } = render(<NutritionDiary foodEntries={[]} />);

    // Карточка поиска — в потоке: иначе она накрывала распознанные продукты.
    expect(container.querySelector('.nd-add-sticky')).toBeNull();

    fireEvent.click(screen.getByLabelText('Текст'));
    fireEvent.change(screen.getByLabelText('Текст для распознавания'), {
      target: { value: 'Курица 200 г 330 ккал Б:35 Ж:7 У:0' },
    });
    fireEvent.click(screen.getByLabelText('Распознать'));
    await waitFor(() => expect(screen.getByText(/На очереди \(1\)/)).toBeTruthy());

    const actions = container.querySelector('.nd-ocr-actions') as HTMLElement;
    expect(actions).toBeTruthy();
    expect(actions.style.position).toBe('sticky');
    // bottom от --nav-height уводил кнопку ПОД пилюлю навигации — тап не работал.
    expect(actions.style.bottom).toContain('--tabbar-lift');
    // Дублирующая кнопка прямо в карточке очереди — видна без прокрутки.
    expect(screen.getByLabelText('Добавить позиции в дневник')).toBeTruthy();
  });

  it('после добавления уводит на «День», чтобы результат было видно', async () => {
    const { container } = render(<NutritionDiary foodEntries={[]} />);
    const fileInput = container.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File([new Uint8Array([1])], 's.png', { type: 'image/png' })] } });

    await waitFor(() => expect(screen.getByLabelText('Сохранить')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Сохранить'));

    // Вкладка «День» содержит секцию приёмов пищи и добавленную позицию.
    await waitFor(() => expect(screen.getAllByLabelText('Приёмы пищи').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Курица').length).toBeGreaterThan(0);
  });

  it('в панели добавления нет плавающих (fixed) кнопок', async () => {
    const { container } = render(<NutritionDiary foodEntries={[]} />);
    fireEvent.click(screen.getByLabelText('Текст'));
    const fixedButtons = Array.from(container.querySelectorAll('button'))
      .filter(btn => (btn as HTMLElement).style.position === 'fixed');
    expect(fixedButtons).toHaveLength(0);
  });
});
