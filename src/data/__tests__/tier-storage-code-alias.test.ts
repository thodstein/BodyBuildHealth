/**
 * tier-storage-code-alias.test.ts — проход 180: код склада находит свою лестницу.
 *
 * Класс дефекта: `labSliceToValues` отдаёт коды склада/UCUM (`UA`, `GLU`, `TG`,
 * `K`, `CA`), а `LAB_TIERS`/`TIER_RULES` названы клиническими именами
 * (`URIC_ACID`, `GLUCOSE`, `TRIGLYCERIDES`, `POTASSIUM`, `CALCIUM`). Пока
 * перевода не было, анализ из бланка молча не получал ни ступени, ни совета:
 * мочевая кислота 500 мкмоль/л давала `deriveTier` = 0, и `computeTierAdjustments`
 * не печатал ни строки.
 *
 * Гард меряет поведением, а не таблицей: каждый псевдоним обязан вести в строку
 * порогов, давать ту же ступень, что каноническое имя, и печатать свою находку
 * или совет. `FT` был единственным двойником с разной шкалой (каталог 8–30 пг/мл
 * против диализной 0.3–1.0 нмоль/л) — проход 191 перевёл строку в пг/мл РФ-бланка,
 * и псевдоним стал доказанным. КФК-МВ переведён в Ед/л в проходе 185, поэтому
 * написание парсера `CKMB` строку находит.
 */
import { describe, expect, it } from 'vitest';
import {
  LAB_TIERS,
  STORAGE_TIER_ALIAS,
  TIER_MARKER_ALIAS,
  deriveTier,
  getLabEntry,
  tierMarkerKey,
} from '../lab-tier-ranges';
import { computeTierAdjustments } from '../lab-tier-recommendations';
import { ucumInfo } from '../../core/constants';
import { unitsIncommensurable } from '../../core/labs-mapping';

/** Значение, попадающее в «лечение» (tier 2) своей шкалы. */
const TIER2_VALUE: Record<string, number> = {
  UA: 500,
  BIL: 50,
  GLU: 7.0,
  TG: 3.0,
  CHOL: 7.0,
  K: 6.0,
  NA: 152,
  CA: 2.9,
  MG: 0.6,
  P: 2.0,
  VITD: 15,
  HOMA: 4.0,
  // Проход 191: ниже любой взрослой полосы РФ (7.72) — ступень «лечение».
  FT: 7,
};

describe('проход 180: код склада → строка порогов', () => {
  it('каждый псевдоним ведёт в существующую строку', () => {
    for (const [code, row] of Object.entries(STORAGE_TIER_ALIAS)) {
      expect(LAB_TIERS[row], `${code} → ${row}`).toBeDefined();
      expect(tierMarkerKey(code)).toBe(row);
      expect(getLabEntry(code)?.marker).toBe(row);
      expect(TIER_MARKER_ALIAS[code]).toBe(row);
    }
  });

  it('единицы каталога и строки — одной величины', () => {
    for (const [code, row] of Object.entries(STORAGE_TIER_ALIAS)) {
      const info = ucumInfo(code);
      expect(info, `${code} есть в каталоге`).toBeDefined();
      expect(
        unitsIncommensurable(info!.prefUnit, LAB_TIERS[row].unit),
        `${code} (${info!.prefUnit}) vs ${row} (${LAB_TIERS[row].unit})`,
      ).toBe(false);
    }
  });

  it('ступень под кодом склада равна ступени под каноном', () => {
    for (const [code, row] of Object.entries(STORAGE_TIER_ALIAS)) {
      const value = TIER2_VALUE[code];
      if (value === undefined) continue;
      expect(deriveTier(code, value, 'male'), `${code} ${value}`).toBe(
        deriveTier(row, value, 'male'),
      );
      expect(deriveTier(code, value, 'male'), `${code} ${value}`).toBeGreaterThan(0);
    }
  });

  it('раньше молчавшие анализы дают совет или находку', () => {
    for (const code of Object.keys(TIER2_VALUE)) {
      const res = computeTierAdjustments({ [code]: TIER2_VALUE[code] }, 'male');
      const findings =
        res.addSubs.length + res.titrations.length + res.nutrition.length + res.alerts.length;
      expect(findings, `${code} ${TIER2_VALUE[code]}`).toBeGreaterThan(0);
      expect(res.tierSummary.map((s) => s.marker)).toContain(code);
    }
  });

  it('мочевая кислота из бланка больше не «норма»', () => {
    expect(deriveTier('UA', 500, 'male')).toBe(2);
    const res = computeTierAdjustments({ UA: 500 }, 'male');
    expect(res.addSubs.some((s) => s.marker === 'UA')).toBe(true);
  });

  it('свободный тестостерон: псевдоним появился вместе с единицей (проход 191)', () => {
    // Было: каталог 8–30 пг/мл против строки 0.3–1.0 нмоль/л (диализ/расчёт).
    // Число чужой шкалы толковалось бы в чужой единице, поэтому псевдонима не было.
    // Проход 191 перевёл строку в пг/мл РФ-бланка (12.3–46.6) — перевод доказан.
    expect(TIER_MARKER_ALIAS['FT']).toBe('FREE_TESTOSTERONE');
    expect(STORAGE_TIER_ALIAS['FT']).toBe('FREE_TESTOSTERONE');
    expect(deriveTier('FT', 0.1, 'male')).toBe(2);
  });

  it('КФК-МВ: написание парсера «CKMB» находит строку в Ед/л', () => {
    expect(TIER_MARKER_ALIAS['CKMB']).toBe('CK_MB');
    expect(tierMarkerKey('CKMB')).toBe('CK_MB');
    expect(deriveTier('CKMB', 60, 'male')).toBe(2);
    const res = computeTierAdjustments({ CKMB: 60 }, 'male');
    expect(res.tierSummary.map((s) => s.marker)).toContain('CKMB');
    expect(res.nutrition.some((n) => n.target.toLowerCase().includes('тропонин'))).toBe(true);
  });

  it('тропонин из формы читается кодом склада', () => {
    expect(tierMarkerKey('TROPONIN')).toBe('TROPONIN_I');
    expect(deriveTier('TROPONIN', 0.5, 'male')).toBe(2);
  });
});
