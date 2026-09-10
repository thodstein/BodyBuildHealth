/**
 * support-substances-desc.test.ts — guard полноты описаний.
 * Пустых description быть не должно: пикер/синергии/взаимодействия
 * показывают карточки с описанием, пустые — это «пробелы» в UI.
 * Backfill живёт в support-substances.ts (каталог + алиасы + ручные).
 */
import { describe, it, expect } from 'vitest';
import { ALL_SUBSTANCES } from '../support-substances';

describe('support substances descriptions', () => {
  it('ни одного пустого description', () => {
    const empty = ALL_SUBSTANCES.filter((s) => !s.description || s.description.trim().length === 0);
    expect(empty.map((s) => s.id), 'subs without description').toEqual([]);
  });

  it('описания осмысленной длины (не заглушки)', () => {
    const stubs = ALL_SUBSTANCES.filter((s) => (s.description || '').trim().length < 20);
    expect(stubs.map((s) => s.id), 'stub descriptions <20 chars').toEqual([]);
  });
});
