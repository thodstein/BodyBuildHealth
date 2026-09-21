/**
 * ocr-preprocess.test.ts — предобработка скриншотов питания для АПК-OCR:
 * dataUrl→Blob, детект тёмной темы, скоринг текстов, порядок PSM.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  dataUrlToBlob,
  meanLuminance,
  isDarkFrame,
  scoreOcrText,
  pickBestOcrText,
  isGoodOcrText,
  hasMacroLabels,
  isCompleteOcrText,
} from '../ocr-preprocess';

vi.mock('tesseract.js', () => {
  const calls: string[] = [];
  return {
    __calls: calls,
    createWorker: vi.fn(async () => ({
      setParameters: vi.fn(async (p: Record<string, string>) => {
        calls.push(`psm:${p.tessedit_pageseg_mode}`);
      }),
      recognize: vi.fn(async () => {
        calls.push('recognize');
        return { data: { text: 'Курица 200 г 330 ккал Б:40 Ж:10 У:0\nРис 150 г' } };
      }),
      terminate: vi.fn(async () => {}),
    })),
  };
});

import { recognizeImageTextOffline } from '../../core/ocr-engine';

describe('ocr-preprocess: чистые функции', () => {
  it('dataUrlToBlob: base64 → Blob с типом, мусор → null', () => {
    const blob = dataUrlToBlob('data:image/png;base64,iVBORw0KGgo=');
    expect(blob).not.toBeNull();
    expect(blob?.type).toBe('image/png');
    expect(dataUrlToBlob('not-a-data-url')).toBeNull();
    expect(dataUrlToBlob('')).toBeNull();
  });

  it('meanLuminance/isDarkFrame: белое светлое, чёрное тёмное', () => {
    const white = new Uint8ClampedArray([255, 255, 255, 255, 250, 250, 250, 255]);
    const black = new Uint8ClampedArray([10, 12, 14, 255, 20, 20, 20, 255]);
    expect(meanLuminance(white, 1)).toBeGreaterThan(200);
    expect(meanLuminance(black, 1)).toBeLessThan(40);
    expect(isDarkFrame(black, 1)).toBe(true);
    expect(isDarkFrame(white, 1)).toBe(false);
  });

  it('scoreOcrText: строка с КБЖУ бьёт мусор той же длины', () => {
    const good = 'Курица 200 г 330 ккал Б:40 Ж:10 У:0';
    const junk = 'щшгарпрвапывроапвыапрвппаввыаывапы';
    expect(scoreOcrText(good)).toBeGreaterThan(scoreOcrText(junk));
    expect(scoreOcrText('')).toBe(0);
  });

  it('pickBestOcrText: богатый выигрывает, ничья — первый', () => {
    expect(pickBestOcrText(['', 'Курица 200 г 330 ккал'])).toBe('Курица 200 г 330 ккал');
    expect(pickBestOcrText(['abc', 'abc'])).toBe('abc');
    expect(pickBestOcrText([])).toBe('');
  });

  it('isGoodOcrText: гейт по длине+цифрам+буквам', () => {
    expect(isGoodOcrText('Курица 200 г 330 ккал Б:40 Ж:10 У:0')).toBe(true);
    expect(isGoodOcrText('Курица')).toBe(false);
    expect(isGoodOcrText('123456789012345678901234567890')).toBe(false);
    expect(isGoodOcrText('')).toBe(false);
  });

  it('isCompleteOcrText: без строк макросов разреженный проход обязателен', () => {
    expect(hasMacroLabels('Белки 40 г')).toBe(true);
    expect(hasMacroLabels('Б:40 Ж:10')).toBe(true);
    expect(hasMacroLabels('Куриная грудка 200 г 330 ккал')).toBe(false);
    expect(isCompleteOcrText('Курица 200 г 330 ккал Б:40 Ж:10 У:0')).toBe(true);
    // FatSecret-кейс: ккал есть, макросов нет — раннего выхода нет
    expect(isCompleteOcrText('Завтрак\nКуриная грудка\n200 г\n330 ккал')).toBe(false);
  });
});

describe('recognizeImageTextOffline: порядок и прогресс', () => {
  it('PSM-6 ставится до первого recognize, прогресс репортится', async () => {
    const seen: number[] = [];
    const file = new File(['x'.repeat(64)], 'screen.jpg', { type: 'image/jpeg' });
    const text = await recognizeImageTextOffline(file, 15_000, (f) => seen.push(f));
    expect(text).toContain('Курица');
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBeLessThanOrEqual(1);
    const mod = await import('tesseract.js') as unknown as { __calls: string[] };
    const psmIdx = mod.__calls.findIndex((c) => c === 'psm:6');
    const recIdx = mod.__calls.findIndex((c) => c === 'recognize');
    expect(psmIdx).toBeGreaterThanOrEqual(0);
    expect(recIdx).toBeGreaterThanOrEqual(0);
    expect(psmIdx).toBeLessThan(recIdx);
  });
});
