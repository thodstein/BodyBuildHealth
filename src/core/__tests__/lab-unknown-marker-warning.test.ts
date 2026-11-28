/**
 * lab-unknown-marker-warning.test.ts — неизвестный маркер не исчезает молча.
 *
 * `finalizeLabCandidates` не имеет права придумывать единицу/норму, но обязан
 * сказать пользователю, что строка не сопоставлена с каталогом. Иначе OCR
 * «нашёл» показатель, а в списке его нет без объяснения.
 */
import { describe, expect, it } from 'vitest';
import { finalizeLabCandidates, type ParsedLabValue } from '../ocr-engine';

describe('finalizeLabCandidates: unknown marker', () => {
  it('маркер без единицы и вне каталога даёт warning, а не тишину', () => {
    const warnings: string[] = [];
    const labs = finalizeLabCandidates(
      [{ code: 'ZZZ_UNKNOWN', name: 'Неизвестный показатель', value: 1, unit: undefined as any } as ParsedLabValue],
      warnings,
    );

    expect(labs).toHaveLength(0);
    expect(warnings.join(' ')).toContain('Неизвестный показатель');
    expect(warnings.join(' ')).toContain('не сопоставлен с каталогом');
  });

  it('известный код без единицы получает единицу каталога и не шумит warning-ом', () => {
    const warnings: string[] = [];
    const labs = finalizeLabCandidates(
      [{ code: 'TSH', name: 'ТТГ', value: 2.1, unit: undefined as any } as ParsedLabValue],
      warnings,
    );

    expect(labs).toHaveLength(1);
    expect(labs[0].unit).toBe('mIU/L');
    expect(warnings).toEqual([]);
  });
});
