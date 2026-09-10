/**
 * sup-pharma-desc.test.ts — guard описаний фармы.
 * У PHARMA_DB нет текстового description: pharmaSummary собирает его
 * из effects + risks записи, иначе карточки фармы (био/тайминг/стеки) пустые.
 */
import { describe, it, expect } from 'vitest';
import { PHARMA_DB } from '../../../../core/pharma-database';
import { pharmaSummary, buildBioavailabilityCatalog } from '../SupportBioavailabilityData';

describe('pharma descriptions', () => {
  it('pharmaSummary непуст для всех записей с именем', () => {
    const bad: string[] = [];
    for (const [id, ph] of Object.entries(PHARMA_DB as Record<string, any>)) {
      if (!ph || !ph.name) continue;
      if (!pharmaSummary(ph)) bad.push(id);
    }
    expect(bad, 'pharma without summary').toEqual([]);
  });

  it('каталог биодоступности: pharma-записи с описанием', () => {
    const cat = buildBioavailabilityCatalog();
    const pharma = cat.filter((e) => e.source === 'pharma');
    expect(pharma.length > 0, 'pharma entries present').toBe(true);
    const empty = pharma.filter((e) => !e.description);
    expect(empty.map((e) => e.id), 'pharma entries without description').toEqual([]);
  });
});
