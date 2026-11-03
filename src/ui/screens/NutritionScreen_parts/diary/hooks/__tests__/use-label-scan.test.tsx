/**
 * use-label-scan.test.tsx — регрессия на «файл загрузился, но до
 * распознавателя не дошло».
 *
 * Здесь проверяется вся цепочка хука: камера → File → processUploadedFile →
 * parseNutritionLabel → автосохранение в custom_foods_v1. Мокается только
 * граница (камера и OCR), парсер и хранилище — настоящие, поэтому тест ловит
 * и зависание загрузки, и потерю результата после распознавания.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const LABEL_TEXT = [
  'Сыр Моцарелла',
  'Пищевая ценность на 100 г',
  'Белки, г',
  '18,0',
  'Жиры, г',
  '24,0',
  'Углеводы, г',
  '2,0',
  'Энергетическая ценность, ккал',
  '280',
].join('\n');

vi.mock('../../../../../../core/native-bridge', () => ({
  pickCameraPhoto: vi.fn(async () => ({ uri: 'data:image/jpeg;base64,AAAA', format: 'jpeg' })),
  pickPhoto: vi.fn(async () => ({ uri: 'data:image/jpeg;base64,BBBB', format: 'jpeg' })),
}));

vi.mock('../../../../../../core/ocr-engine', () => ({
  processUploadedFile: vi.fn(async () => ({
    text: [
      'Сыр Моцарелла',
      'Пищевая ценность на 100 г',
      'Белки, г',
      '18,0',
      'Жиры, г',
      '24,0',
      'Углеводы, г',
      '2,0',
      'Энергетическая ценность, ккал',
      '280',
    ].join('\n'),
    labs: [],
    meals: [],
    warnings: [],
  })),
}));

import { useLabelScan } from '../useLabelScan';
import { loadCustomFoods } from '../../../../../../engines/meal-custom-food';
import { pickCameraPhoto, pickPhoto } from '../../../../../../core/native-bridge';
import { processUploadedFile } from '../../../../../../core/ocr-engine';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

function setup() {
  const toast = vi.fn();
  const queued: unknown[] = [];
  const hook = renderHook(() => useLabelScan({ showToast: toast, onAddToQueue: (entry) => queued.push(entry) }));
  return { ...hook, toast, queued };
}

describe('useLabelScan: камера → OCR → своя база', () => {
  it('доводит снимок до распознавателя и сразу сохраняет продукт', async () => {
    const { result, toast, queued } = setup();

    await act(async () => { result.current.handleLabelCamera(); });

    await waitFor(() => expect(result.current.labelDraft).not.toBeNull());

    // Файл реально ушёл в OCR (а не остался на этапе «загружаем…»).
    expect(pickCameraPhoto).toHaveBeenCalledTimes(1);
    expect(pickPhoto).not.toHaveBeenCalled();
    expect(processUploadedFile).toHaveBeenCalledTimes(1);
    const passedFile = vi.mocked(processUploadedFile).mock.calls[0][0] as File;
    expect(passedFile).toBeInstanceOf(File);
    expect(passedFile.type).toBe('image/jpeg');

    // Распознавание закончилось, спиннер снят.
    expect(result.current.labelLoading).toBe(false);
    expect(result.current.labelError).toBe('');
    expect(result.current.labelProgress).toBe(0);

    // Значения попали в черновик как «на 100 г».
    expect(result.current.labelDraft).toMatchObject({ name: 'Сыр Моцарелла', kcal: 280, p: 18, f: 24, c: 2, savedToBase: true });

    // И сразу в базу своих продуктов — без нажатия «сохранить».
    const saved = loadCustomFoods();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: 'Сыр Моцарелла', kcal: 280, protein: 18, fat: 24, carbs: 2, source: 'label_photo' });
    expect(saved[0].labelText).toContain('Белки, г');
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('сохранён в базу'));
    expect(queued).toHaveLength(0);
  });

  it('в галерею идёт через pickPhoto, а не через камеру', async () => {
    const { result } = setup();
    await act(async () => { result.current.handleLabelGallery(); });
    await waitFor(() => expect(result.current.labelDraft).not.toBeNull());
    expect(pickPhoto).toHaveBeenCalledTimes(1);
    expect(pickCameraPhoto).not.toHaveBeenCalled();
  });

  it('на фото без КБЖУ показывает ошибку и не зависает в загрузке', async () => {
    vi.mocked(processUploadedFile).mockResolvedValueOnce({
      text: 'Состав: молоко, соль', labs: [], meals: [], warnings: ['КБЖУ не найдено'],
    } as never);
    const { result } = setup();

    await act(async () => { result.current.handleLabelCamera(); });

    await waitFor(() => expect(result.current.labelError).not.toBe(''));
    expect(result.current.labelLoading).toBe(false);
    expect(result.current.labelDraft).toBeNull();
    expect(loadCustomFoods()).toHaveLength(0);
    expect(result.current.labelError).toContain('КБЖУ');
  });

  it('падение распознавания снимает спиннер и показывает причину', async () => {
    vi.mocked(processUploadedFile).mockRejectedValueOnce(new Error('tesseract не стартовал'));
    const { result } = setup();

    await act(async () => { result.current.handleLabelCamera(); });

    await waitFor(() => expect(result.current.labelError).not.toBe(''));
    expect(result.current.labelLoading).toBe(false);
    expect(result.current.labelError).toContain('tesseract не стартовал');
    expect(loadCustomFoods()).toHaveLength(0);
  });

  it('отмена камеры даёт понятную ошибку, а не вечную загрузку', async () => {
    vi.mocked(pickCameraPhoto).mockResolvedValueOnce(null);
    const { result } = setup();

    await act(async () => { result.current.handleLabelCamera(); });

    await waitFor(() => expect(result.current.labelError).toContain('Камера не открылась'));
    expect(result.current.labelLoading).toBe(false);
    expect(processUploadedFile).not.toHaveBeenCalled();
  });
});

// Строка держится в файле, чтобы пример этикетки было видно рядом с моками.
void LABEL_TEXT;
