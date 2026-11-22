import { describe, it, expect } from 'vitest';
import { CLINICAL_MARKERS, EC50_SOURCED } from '../../data/clinical-pathology-db';

/**
 * Проход 207: у ec50 явно объявлен провенанс.
 *
 * ec50 в CLINICAL_MARKERS — точки полумаксимума эвристической модели, а не
 * лабораторные нормы. Клинический источник объявлен только для записей из
 * EC50_SOURCED (сейчас — eGFR, порог ХБП 3 стадии по KDIGO 2024). Правило 26:
 * число без источника не выдаётся за клиническое, поэтому источник нельзя
 * дописать записи мимо карты и нельзя оставить в карте ключ без записи.
 */

const markers = Object.entries(CLINICAL_MARKERS);
const sourcedKeys = Object.keys(EC50_SOURCED);

describe('проход 207: провенанс ec50 объявлен явно', () => {
  it('каждый ключ EC50_SOURCED есть в реестре и несёт ровно ту же строку источника', () => {
    for (const key of sourcedKeys) {
      const marker = CLINICAL_MARKERS[key];
      expect(marker, `ключ ${key} из EC50_SOURCED отсутствует в CLINICAL_MARKERS`).toBeDefined();
      expect(marker.ec50Source).toBe(EC50_SOURCED[key]);
    }
  });

  it('eGFR в реестре имеет непустой ec50Source', () => {
    expect(CLINICAL_MARKERS.eGFR).toBeDefined();
    expect(CLINICAL_MARKERS.eGFR.ec50Source?.trim()).toBeTruthy();
  });

  it('ни у одной другой записи нет ec50Source — источник не объявляется мимо карты', () => {
    const withSource = markers.filter(([, marker]) => marker.ec50Source !== undefined).map(([key]) => key);
    expect(withSource.sort()).toEqual([...sourcedKeys].sort());
  });

  it('у всех записей ec50 положительный', () => {
    for (const [key, marker] of markers) {
      expect(marker.ec50, `ec50 у ${key} должен быть положительным`).toBeGreaterThan(0);
    }
  });

  it('у всех размерных записей unit непустой (безразмерные индексы исключены)', () => {
    // pH_Urine, HOMA-IR, FibroIndex — безразмерные индексы, у них unit = ''.
    const dimensionless = new Set(['pH_Urine', 'HOMA-IR', 'FibroIndex']);
    for (const [key, marker] of markers) {
      expect(typeof marker.unit, `unit у ${key} должен быть строкой`).toBe('string');
      if (!dimensionless.has(key)) {
        expect(marker.unit.trim(), `unit у ${key} должен быть непустым`).not.toBe('');
      }
    }
  });
});
