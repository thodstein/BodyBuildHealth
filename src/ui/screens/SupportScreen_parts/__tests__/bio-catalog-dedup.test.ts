/**
 * bio-catalog-dedup.test.ts — каталог биодоступности склеивает 3 источника
 * (каталог → фарма → пептиды) без дублей id. Дубли давали повторяющиеся
 * React-ключи списка (cjc1295, bpc157, tb500...) — дубли/пропажа строк.
 */
import { describe, it, expect } from 'vitest';
import { buildBioavailabilityCatalog } from '../SupportBioavailabilityData';
import { SUPPORT_CATALOG_DATA } from '../../../../data/support-database';
import { PEPTIDE_DB } from '../../../../engines/peptide-calculator.engine';
import { PHARMA_DB } from '../../../../core/pharma-database';

describe('bio catalog dedup', () => {
  it('id уникальны — дублей ключей списка нет', () => {
    const cat = buildBioavailabilityCatalog();
    expect(cat.length).toBeGreaterThan(0);
    const ids = cat.map((e) => e.id);
    expect(new Set(ids).size, 'duplicate ids').toBe(ids.length);
  });

  it('пересечение источников реально существует и побеждает каталог', () => {
    const overlap = Object.keys(SUPPORT_CATALOG_DATA).find(
      (id) => (PEPTIDE_DB as Record<string, unknown>)[id] || (PHARMA_DB as Record<string, unknown>)[id],
    );
    expect(overlap, 'expected catalog↔pharma/peptide id overlap').toBeTruthy();
    const cat = buildBioavailabilityCatalog();
    expect(cat.filter((e) => e.id === overlap).length).toBe(1);
    expect(cat.find((e) => e.id === overlap)?.source).toBe('catalog');
  });
});
