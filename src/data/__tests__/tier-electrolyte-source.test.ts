/**
 * tier-electrolyte-source.test.ts — проход 209: числа калия и фосфора названы.
 *
 * Калий. Норма 3.5–5.1 ммоль/л — референс Хеликс 06-064 (взрослые). Экстренная
 * граница 2.5 / 6.5 — не «правдоподобное число»: тяжёлой дискалиемией считаются
 * K < 2.5 или > 6.5 ммоль/л (PMID 30353786), а внутривенный кальций показан уже
 * при K ≥ 6.5 (PMID 41506858). Обе границы цитируются в самой таблице.
 *
 * Фосфор. Норма 0.81–1.45 ммоль/л — Хеликс 06-046 (18+), совпадает с каталогом.
 * Экстренные 0.4 / 2.5 источником не подтверждены — записи об этом остаются
 * порогом приложения, и тест держит именно это положение, а не выдаёт число за
 * guideline: если кто-то «поправит» 0.4 на «красивое» 0.5, тест и комментарий в
 * таблице разойдутся.
 */
import { describe, expect, it } from 'vitest';
import { LAB_TIERS, deriveTier } from '../lab-tier-ranges';
import { UCUM_MAP } from '../../core/constants';

describe('проход 209: калий и фосфор — числа с источником', () => {
  it('калий: норма 3.5–5.1 совпадает с каталогом (Хеликс 06-064)', () => {
    expect([...LAB_TIERS.POTASSIUM.normal]).toEqual([3.5, 5.1]);
    expect([UCUM_MAP.K.lln, UCUM_MAP.K.uln]).toEqual([3.5, 5.1]);
    expect([UCUM_MAP.POTASSIUM.lln, UCUM_MAP.POTASSIUM.uln]).toEqual([3.5, 5.1]);
  });

  it('калий: экстренные 2.5 / 6.5 — определение тяжёлой дискалиемии', () => {
    expect(LAB_TIERS.POTASSIUM.emergencyLow).toBe(2.5);
    expect(LAB_TIERS.POTASSIUM.emergencyHigh).toBe(6.5);
    // Ступень 3 достижима только на этих границах, а не на «следующем шаге».
    expect(deriveTier('POTASSIUM', 2.5, 'male')).toBe(3);
    expect(deriveTier('POTASSIUM', 2.6, 'male')).toBe(2);
    expect(deriveTier('POTASSIUM', 6.5, 'male')).toBe(3);
    expect(deriveTier('POTASSIUM', 6.4, 'male')).toBe(2);
  });

  it('калий: 5.05 — ещё норма, 5.15 — уже грань', () => {
    expect(deriveTier('POTASSIUM', 5.05, 'male')).toBe(0);
    expect(deriveTier('POTASSIUM', 5.15, 'male')).toBe(1);
  });

  it('фосфор: норма 0.81–1.45 совпадает с каталогом (Хеликс 06-046)', () => {
    expect([...LAB_TIERS.PHOSPHORUS.normal]).toEqual([0.81, 1.45]);
    expect([UCUM_MAP.PHOSPHORUS.lln, UCUM_MAP.PHOSPHORUS.uln]).toEqual([0.81, 1.45]);
  });

  it('фосфор: 0.4 / 2.5 остаются порогом приложения, ступень достижима', () => {
    expect(LAB_TIERS.PHOSPHORUS.emergencyLow).toBe(0.4);
    expect(LAB_TIERS.PHOSPHORUS.emergencyHigh).toBe(2.5);
    expect(deriveTier('PHOSPHORUS', 0.4, 'male')).toBe(3);
    expect(deriveTier('PHOSPHORUS', 0.5, 'male')).toBe(2);
    expect(deriveTier('PHOSPHORUS', 1.0, 'male')).toBe(0);
    expect(deriveTier('PHOSPHORUS', 2.5, 'male')).toBe(3);
  });
});
