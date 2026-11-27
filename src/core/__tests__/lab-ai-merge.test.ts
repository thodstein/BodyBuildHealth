/**
 * lab-ai-merge.test.ts — медицинский контур слияния OCR и AI-проверки бланка.
 *
 * Замки: OCR-значение не переписывается при расхождении, AI-добавка идёт
 * только с пониженной уверенностью, неизвестный маркер не попадает в импорт,
 * входной массив OCR не мутируется.
 */
import { describe, expect, it } from 'vitest';
import { mergeLabAiCandidates } from '../lab-ai-merge';
import type { ParsedLabValue } from '../ocr-engine';
import type { FoodVisionLabValue } from '../../engines/food-vision.types';

function ocrLab(overrides: Partial<ParsedLabValue> = {}): ParsedLabValue {
  return {
    code: 'HGB',
    name: 'Гемоглобин',
    value: 140,
    unit: 'g/L',
    confidence: 0.7,
    ...overrides,
  };
}

function aiLab(overrides: Partial<FoodVisionLabValue> = {}): FoodVisionLabValue {
  return {
    code: 'HGB',
    name: 'Гемоглобин',
    value: 140,
    unit: 'g/L',
    confidence: 0.9,
    ...overrides,
  };
}

describe('mergeLabAiCandidates', () => {
  it('равное значение: усиливает уверенность и добирает границы', () => {
    const ocr = [ocrLab()];
    const result = mergeLabAiCandidates(ocr, [aiLab({ refLow: 130, refHigh: 160 })], 'Гемоглобин 140 г/л 130-160');

    expect(result.labs).toHaveLength(1);
    expect(result.labs[0].value).toBe(140);
    expect(result.labs[0].confidence).toBe(0.9);
    expect(result.labs[0].refLow).toBe(130);
    expect(result.labs[0].refHigh).toBe(160);
    expect(result.enriched).toBe(1);
    expect(result.conflicts).toBe(0);
    expect(result.added).toBe(0);
  });

  it('границы AI не становятся нормой бланка, если их нет в OCR-тексте', () => {
    const ocr = [ocrLab()];
    const result = mergeLabAiCandidates(ocr, [aiLab({ refLow: 130, refHigh: 160 })], 'Гемоглобин 140 г/л');

    expect(result.labs[0].refLow).toBeUndefined();
    expect(result.labs[0].refHigh).toBeUndefined();
    expect(result.labs[0].confidence).toBe(0.9);
  });

  it('расхождение: оставляет OCR и считает конфликт', () => {
    const ocr = [ocrLab()];
    const result = mergeLabAiCandidates(ocr, [aiLab({ value: 125 })], 'Гемоглобин 140 г/л');

    expect(result.labs).toHaveLength(1);
    expect(result.labs[0].value).toBe(140);
    expect(result.conflicts).toBe(1);
    expect(result.enriched).toBe(0);
    expect(result.warnings.some((w) => /оставлено OCR/.test(w))).toBe(true);
  });

  it('AI-добавка с уверенностью 0.9 сохраняется с потолком 0.6', () => {
    const ocr = [ocrLab()];
    const result = mergeLabAiCandidates(
      ocr,
      [
        aiLab({
          code: 'TSH',
          name: 'ТТГ',
          value: 2.1,
          unit: 'mIU/L',
          confidence: 0.9,
          refLow: undefined,
          refHigh: undefined,
        }),
      ],
      'ТТГ 2,1 мЕд/л',
    );

    const added = result.labs.find((lab) => lab.code === 'TSH');
    expect(result.added).toBe(1);
    expect(added).toBeDefined();
    expect(added?.value).toBe(2.1);
    expect(added?.unit).toBe('mIU/L');
    expect(added?.confidence).toBe(0.6);
    expect(added?.raw).toBe('AI-проверка');
    expect(result.warnings.some((w) => /AI добавил/.test(w))).toBe(true);
  });

  it('неизвестный маркер пропускается с предупреждением, входной OCR не мутируется', () => {
    const ocr = [ocrLab()];
    const snapshot = JSON.parse(JSON.stringify(ocr));
    const result = mergeLabAiCandidates(
      ocr,
      [aiLab({ code: 'ZZZ', name: 'ZZZ', value: 1, unit: 'U/L', confidence: 0.9 })],
      'Гемоглобин 140 г/л',
    );

    expect(result.labs).toHaveLength(1);
    expect(result.added).toBe(0);
    expect(result.warnings.some((w) => /вне каталога — пропущено/.test(w))).toBe(true);
    expect(ocr).toEqual(snapshot);
  });

  it('повторная AI-проверка не поднимает уверенность AI-добавки выше 0.6', () => {
    const first = mergeLabAiCandidates(
      [],
      [aiLab({ code: 'TSH', name: 'ТТГ', value: 2.1, unit: 'mIU/L', confidence: 0.9 })],
      'ТТГ 2,1 мЕд/л',
    );
    const again = mergeLabAiCandidates(
      first.labs,
      [aiLab({ code: 'TSH', name: 'ТТГ', value: 2.1, unit: 'mIU/L', confidence: 0.99 })],
      'ТТГ 2,1 мЕд/л',
    );

    const tsh = again.labs.find((lab) => lab.code === 'TSH');
    expect(tsh?.confidence).toBe(0.6);
    expect(again.added).toBe(0);
    expect(again.enriched).toBe(0);
  });

  it('AI-добавка получает isAbnormal по границам бланка/каталога', () => {
    const result = mergeLabAiCandidates(
      [],
      [aiLab({ code: 'K', name: 'Калий', value: 6.5, unit: 'mmol/L', confidence: 0.9, refLow: 3.5, refHigh: 5.1 })],
      'Калий 6,5 ммоль/л 3,5-5,1',
    );

    const k = result.labs.find((lab) => lab.code === 'K');
    expect(k).toMatchObject({ value: 6.5, refLow: 3.5, refHigh: 5.1, isAbnormal: true });
  });

  it('несовместимая единица AI не подтверждает OCR-значение', () => {
    const ocr = [ocrLab({ code: 'HGB', value: 140, unit: 'g/L' })];
    const result = mergeLabAiCandidates(
      ocr,
      [aiLab({ code: 'HGB', name: 'Гемоглобин', value: 140, unit: 'U/L', confidence: 0.9 })],
      'Гемоглобин 140 г/л',
    );

    expect(result.labs[0].value).toBe(140);
    expect(result.labs[0].confidence).toBe(0.7);
    expect(result.conflicts).toBe(1);
    expect(result.warnings.some((w) => /единицы не совпали/.test(w))).toBe(true);
  });

  it('дубль кода в ответе AI добавляет показатель один раз', () => {
    const result = mergeLabAiCandidates(
      [],
      [
        aiLab({ code: 'TSH', name: 'ТТГ', value: 2.1, unit: 'mIU/L', confidence: 0.9 }),
        aiLab({ code: 'TSH', name: 'ТТГ', value: 2.2, unit: 'mIU/L', confidence: 0.9 }),
      ],
      'ТТГ 2,1 мЕд/л',
    );

    expect(result.labs.filter((lab) => lab.code === 'TSH')).toHaveLength(1);
    expect(result.added).toBe(1);
    expect(result.warnings.some((w) => /повторно/.test(w))).toBe(true);
  });
});
