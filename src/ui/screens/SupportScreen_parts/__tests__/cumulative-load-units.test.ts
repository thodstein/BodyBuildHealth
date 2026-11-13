/**
 * cumulative-load-units.test.ts — проход 32: «Совокупная суточная нагрузка»
 * считает в единицах реестра пределов, а не в той, что случайно лежит в базе.
 *
 * Дефект: `doseRange` витамина E — МЕ (до 400), а реестр держит мг
 * α-токоферола: E 400 МЕ сравнивался с UL 300 напрямую → ложное «превышение»
 * (реально ~268 мг). Подпись всегда была «мг», даже когда предел в мкг/МЕ.
 *
 * Витамин D в реестре тоже в МЕ (4000), поэтому здесь конверсия НЕ нужна —
 * тест фиксирует паритет шкал, чтобы не появилась обратная ошибка «4000 МЕ →
 * 100 мкг против предела 4000».
 */
import { describe, it, expect } from 'vitest';
import { toRegistryAmount } from '../UnifiedSynergyCalculator';
import {
  stackLimitVerdicts,
  NUTRIENT_LIMITS_V2,
} from '../../../../engines/support-limits';

describe('toRegistryAmount: шкала базы → шкала реестра', () => {
  it('витамин D: реестр в МЕ — значение проходит без конверсии', () => {
    expect(toRegistryAmount('vitamin_d3', 4000)).toBe(4000);
    expect(toRegistryAmount('vitamin_d3', 8000)).toBe(8000);
  });

  it('витамин E: 400 МЕ ≈ 268 мг α-токоферола (ниже UL 300)', () => {
    expect(toRegistryAmount('vitamin_e', 400)).toBe(268);
    expect(toRegistryAmount('vitamin_e', 500)).toBe(335);
  });

  it('селен и цинк не конвертируются (уже в единицах реестра)', () => {
    expect(toRegistryAmount('selenium', 200)).toBe(200);
    expect(toRegistryAmount('zinc', 40)).toBe(40);
    expect(toRegistryAmount('magnesium', 350)).toBe(350);
  });

  it('МЕ без нутриентной шкалы (hCG) в сумму не попадает', () => {
    expect(toRegistryAmount('hcg', 500)).toBeUndefined();
  });

  it('нулевая или отрицательная доза — не вклад', () => {
    expect(toRegistryAmount('zinc', 0)).toBeUndefined();
  });
});

describe('вердикт по совокупной нагрузке', () => {
  it('D3 4000 МЕ — ровно UL, без превышения', () => {
    const [c] = stackLimitVerdicts([
      { id: 'vitamin_d3', nameRu: 'Витамин D3', doseMg: toRegistryAmount('vitamin_d3', 4000)! },
    ]);
    expect(c.nutrient).toBe('vitamin_d');
    expect(c.amountPerDay).toBe(NUTRIENT_LIMITS_V2.vitamin_d.value);
    expect(c.verdict.over).toBe(false);
  });

  it('D3 8000 МЕ — превышение UL в МЕ (а не «8000 мг»)', () => {
    const [c] = stackLimitVerdicts([
      { id: 'vitamin_d3', nameRu: 'Витамин D3', doseMg: toRegistryAmount('vitamin_d3', 8000)! },
    ]);
    expect(c.amountPerDay).toBe(8000);
    expect(c.verdict.over).toBe(true);
    expect(c.verdict.message).toContain('МЕ');
  });

  it('витамин E 400 МЕ — в пределах UL 300 мг', () => {
    const [c] = stackLimitVerdicts([
      { id: 'vitamin_e', nameRu: 'Витамин E', doseMg: toRegistryAmount('vitamin_e', 400)! },
    ]);
    expect(c.amountPerDay).toBe(268);
    expect(c.verdict.over).toBe(false);
  });
});
