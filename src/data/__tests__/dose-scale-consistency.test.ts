/**
 * dose-scale-consistency.test.ts — гард на «шкальную» ошибку в данных доз.
 *
 * Две разные шкалы живут рядом и легко перепутать:
 *  - `DEFAULT_DOSAGES[id].mg` — НАТУРАЛЬНАЯ единица вещества
 *    (selenium 200 = 200 мкг, vitamin_d3 5000 = 5000 МЕ);
 *  - `SUPPORT_CATALOG_DATA[id].dosage.mg` — МИЛЛИГРАММЫ.
 *
 * Если кто-то добавит в `DEFAULT_DOSAGES` значение в миллиграммах для
 * мкг-вещества, лейбл («мкг») станет врать в 1000×. Здесь сверяются обе
 * таблицы: отношение «натуральная единица / мг» должно совпадать с единицей
 * вещества (допуск 50× — рекомендованные дозы могут отличаться, но не шкалой).
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_DOSAGES } from '../support-meta';
import { SUPPORT_CATALOG_DATA } from '../support-catalog-data';
import { defaultDoseUnit, formatDefaultDose, formatDoseFromMg, naturalFromMg } from '../dose-units';

/** Сколько натуральных единиц в 1 мг для конкретного вещества. */
function unitsPerMg(id: string): number {
  const unit = defaultDoseUnit(id);
  if (unit === 'мкг') return 1000;
  // Витамин D: 1 МЕ = 0,025 мкг → 40 000 МЕ в 1 мг.
  if (id === 'vitamin_d3' || id === 'vitamin_d') return 40_000;
  // МЕ/Ед/млрд КОЕ каталог хранит уже в этой единице (hcg 500 → 500 МЕ).
  return 1;
}

const catalogEntry = (id: string) =>
  (SUPPORT_CATALOG_DATA as any)[id] || (SUPPORT_CATALOG_DATA as any)[id.toUpperCase()];

describe('DEFAULT_DOSAGES ↔ SUPPORT_CATALOG_DATA: шкала единиц', () => {
  const ids = Object.keys(DEFAULT_DOSAGES).filter(id => {
    const def = (DEFAULT_DOSAGES as any)[id]?.mg;
    const catMg = catalogEntry(id)?.dosage?.mg;
    return Number.isFinite(def) && def > 0 && Number.isFinite(catMg) && catMg > 0;
  });

  it('обе таблицы вообще пересекаются (иначе гард бесполезен)', () => {
    expect(ids.length).toBeGreaterThan(30);
  });

  it('отношение доз совпадает с единицей вещества (нет ×1000)', () => {
    const broken: string[] = [];
    for (const id of ids) {
      const def = (DEFAULT_DOSAGES as any)[id].mg as number;
      const catMg = catalogEntry(id).dosage.mg as number;
      const normalized = def / catMg / unitsPerMg(id);
      if (!(normalized > 1 / 50 && normalized < 50)) {
        broken.push(`${id}: DEFAULT ${def} ${defaultDoseUnit(id)} vs каталог ${catMg} мг (×${normalized.toFixed(4)} от ожидания)`);
      }
    }
    expect(broken, broken.join('; ')).toEqual([]);
  });

  it('витамин D: 5000 МЕ по умолчанию = 0.125 мг в каталоге', () => {
    expect((DEFAULT_DOSAGES as any).vitamin_d3.mg).toBe(5000);
    expect(defaultDoseUnit('vitamin_d3')).toBe('МЕ');
    expect(catalogEntry('vitamin_d3').dosage.mg).toBeCloseTo(0.125, 3);
  });

  it('селен: 200 мкг по умолчанию = 0.2 мг в каталоге', () => {
    expect((DEFAULT_DOSAGES as any).selenium.mg).toBe(200);
    expect(defaultDoseUnit('selenium')).toBe('мкг');
    expect(catalogEntry('selenium').dosage.mg).toBeCloseTo(0.2, 3);
  });

  /**
   * Регрессия 2026-11: фолбэк плана на дозу каталога клал МГ в поле, которое
   * читатели подписывают как натуральную единицу (`formatDefaultDose`),
   * — биотин «5 мг» превращался в «5 мкг» (1000× ниже). `naturalFromMg`
   * должен давать ту же ФИЗИЧЕСКУЮ дозу, что и мг-форматтер каталога.
   */
  it('naturalFromMg ↔ formatDoseFromMg: одна и та же доза на всех позициях каталога', () => {
    const broken: string[] = [];
    for (const [id, e] of Object.entries(SUPPORT_CATALOG_DATA as Record<string, any>)) {
      const catMg = e?.dosage?.mg;
      if (!(Number.isFinite(catMg) && catMg > 0)) continue;
      const viaMg = formatDoseFromMg(id, catMg);
      const viaNatural = formatDefaultDose(id, naturalFromMg(id, catMg));
      if (viaMg !== viaNatural) broken.push(`${id}: ${catMg} мг → «${viaMg}» vs «${viaNatural}»`);
    }
    expect(broken, broken.join('; ')).toEqual([]);
  });
});
