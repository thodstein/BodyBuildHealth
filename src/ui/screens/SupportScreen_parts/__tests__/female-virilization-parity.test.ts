/**
 * female-virilization-parity.test.ts — §6.4 п.1: два источника женских порогов
 * не разъезжаются.
 *
 * Пороги вирилизации живут в двух местах:
 *  - движок `FEMALE_AAS_PROFILES` (judge курса, мг/НЕДЕЛЮ);
 *  - UI `FEMALE_VIRILIZATION_CALC` (живой калькулятор в табе «Женщины», для
 *    оральных — мг/ДЕНЬ).
 *
 * Раньше совпадение держалось «на честном слове»: правка в одном файле тихо
 * расходилась с другим. Тест пересчитывает дневные пороги в недельные и сверяет
 * красный порог + андрогенный индекс + флаг абсолютного противопоказания.
 */
import { describe, it, expect } from 'vitest';
import { FEMALE_VIRILIZATION_CALC } from '../supportProtocolWomenData';
import { resolveFemaleAasProfile } from '../../../../engines/female-aas-risk';

/** Красный порог в мг/нед (оральные в таблице заданы мг/день). */
const redPerWeek = (item: (typeof FEMALE_VIRILIZATION_CALC)[number]): number =>
  item.unit === 'мг/день' ? item.red * 7 : item.red;

describe('женские пороги: движок ↔ калькулятор вирилизации', () => {
  it('таблица не пустая', () => {
    expect(FEMALE_VIRILIZATION_CALC.length).toBeGreaterThanOrEqual(14);
  });

  it('каждая позиция резолвится в профиль движка', () => {
    for (const item of FEMALE_VIRILIZATION_CALC) {
      expect(resolveFemaleAasProfile(item.id), item.id).toBeTruthy();
    }
  });

  it('красный порог совпадает (мг/нед после нормировки)', () => {
    for (const item of FEMALE_VIRILIZATION_CALC) {
      const p = resolveFemaleAasProfile(item.id)!;
      if (p.contraindicated) continue;
      expect(redPerWeek(item), `${item.name} (${item.id})`).toBe(p.red);
    }
  });

  it('андрогенный индекс совпадает', () => {
    for (const item of FEMALE_VIRILIZATION_CALC) {
      const p = resolveFemaleAasProfile(item.id)!;
      expect(p.androgenIndex, `${item.name} (${item.id})`).toBe(item.androgenIndex);
    }
  });

  it('абсолютные противопоказания совпадают в обе стороны', () => {
    for (const item of FEMALE_VIRILIZATION_CALC) {
      const p = resolveFemaleAasProfile(item.id)!;
      expect(Boolean(p.contraindicated), item.name).toBe(Boolean(item.contraindicated));
    }
  });
});
