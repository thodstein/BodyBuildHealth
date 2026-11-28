/**
 * support-dose-source-debt.test.ts — реестр долга «у дозы нет источника» (E1).
 *
 * План E1 требовал источник у каждой дозы. Для 55 из 74 записей
 * `DEFAULT_DOSAGES` ссылка есть в `EVIDENCE_DOSAGES` или `support-dosing`;
 * для 19 — нет. Выдумывать ссылку нельзя, поэтому долг зафиксирован списком:
 * новая доза без источника (или наоборот — источник без записи в списке)
 * роняет тест, и решение принимается явно.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_DOSAGES } from '../support-meta';
import { getEvidenceDosage } from '../evidence-dosage-db';
import { getProtocolRefs } from '../support-dosing';

/**
 * Почему эти четыре остаются без ссылки (проверено в проходе 211):
 *  - `p5p` 25 мг — человеческих РКИ именно с P5P 25 мг нет; EFSA UL для B6 12 мг —
 *    это предел, а не источник дозы;
 *  - `agmatine` 1 г — ближайшие человеческие данные 1.335–3.56 г/сут (PMID 20447305),
 *    доза 1 г не изучалась;
 *  - `tmg` 1 г — человеческие схемы 1.5–6 г; 1 г не подтверждён;
 *  - `dandelion` 500 мг — у человека изучен экстракт 8 мл 3×/д (PMID 19678785),
 *    а не 500 мг сухого экстракта.
 */
const KNOWN_WITHOUT_SOURCE = new Set(['p5p', 'agmatine', 'tmg', 'dandelion']);

function refsOf(id: string): string[] {
  const own = DEFAULT_DOSAGES[id]?.refs || [];
  if (own.length > 0) return own;
  const fromDoseDb = getEvidenceDosage(id)?.references || [];
  if (fromDoseDb.length > 0) return fromDoseDb;
  return getProtocolRefs(id) || [];
}

describe('источник дозы: долг не растёт молча', () => {
  it('список доз без источника совпадает с зафиксированным', () => {
    const missing = Object.keys(DEFAULT_DOSAGES)
      .filter((id) => refsOf(id).length === 0)
      .sort();
    expect(missing).toEqual([...KNOWN_WITHOUT_SOURCE].sort());
  });

  it('у каждой дозы вне списка есть хотя бы одна ссылка', () => {
    for (const id of Object.keys(DEFAULT_DOSAGES)) {
      if (KNOWN_WITHOUT_SOURCE.has(id)) continue;
      expect(refsOf(id).length, `${id}: доза без источника`).toBeGreaterThan(0);
    }
  });
});
