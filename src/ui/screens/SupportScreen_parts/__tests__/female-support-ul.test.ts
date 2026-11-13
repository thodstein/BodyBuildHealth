/**
 * female-support-ul.test.ts — §6.4 п.2: «примерные протоколы поддержки» женщины
 * не обещают доз выше UL.
 *
 * Было: цинк 25–50/30–50 мг/день (UL 40), магний 400–600 мг/день при UL 350
 * (в одной строке «кросс-кап 350 (UL)» и доза 400–600 — прямое противоречие),
 * B6 100–200 мг/день (UL 12) без подписи. Женщина видела на одном экране
 * дозу, кап и UL, которые не сходятся.
 *
 * Тест читает данные, а не рендер: парсит основную часть дозы (до скобок) и
 * сверяет с `NUTRIENT_LIMITS_V2`.
 */
import { describe, it, expect } from 'vitest';
import { FEMALE_SUPPORT_PROTOCOLS } from '../supportProtocolWomenData';
import { NUTRIENT_LIMITS_V2 } from '../../../../engines/support-limits';

const ROWS = FEMALE_SUPPORT_PROTOCOLS.flatMap((p) =>
  p.rows.map((r) => ({ ...r, protocol: p.title })),
);

/** Верхняя граница ОСНОВНОЙ дозы (до скобок с пояснением). */
function maxOf(dose: string, unit: string): number | null {
  const main = dose.split('(')[0];
  const m = main.match(new RegExp(`(\\d+(?:[.,]\\d+)?)(?:\\s*[–-]\\s*(\\d+(?:[.,]\\d+)?))?\\s*${unit}`));
  if (!m) return null;
  const num = (x: string) => parseFloat(x.replace(',', '.'));
  return Math.max(num(m[1]), m[2] ? num(m[2]) : 0);
}

const rowsNamed = (re: RegExp) => ROWS.filter((r) => re.test(r.name));

describe('женские протоколы поддержки: дозы в границах UL', () => {
  it('протоколы и строки найдены (защита от пустого прогона)', () => {
    expect(FEMALE_SUPPORT_PROTOCOLS.length).toBeGreaterThanOrEqual(8);
    expect(rowsNamed(/цинк/i).length).toBeGreaterThan(3);
    expect(rowsNamed(/магний/i).length).toBeGreaterThan(3);
  });

  it('цинк: основная доза ≤ UL 40 мг', () => {
    const ul = NUTRIENT_LIMITS_V2.zinc.value;
    for (const r of rowsNamed(/цинк/i)) {
      const max = maxOf(r.dose, 'мг');
      if (max === null) continue;
      expect(max, `${r.protocol}: ${r.dose}`).toBeLessThanOrEqual(ul);
    }
  });

  it('магний: основная доза ≤ UL 350 мг из добавок', () => {
    const ul = NUTRIENT_LIMITS_V2.magnesium.value;
    for (const r of rowsNamed(/магний/i)) {
      const max = maxOf(r.dose, 'мг');
      if (max === null) continue;
      expect(max, `${r.protocol}: ${r.dose}`).toBeLessThanOrEqual(ul);
    }
  });

  it('витамин D: основная доза ≤ 4000 МЕ', () => {
    const ul = NUTRIENT_LIMITS_V2.vitamin_d.value;
    for (const r of rowsNamed(/витамин\s*D/i)) {
      const max = maxOf(r.dose, 'МЕ');
      if (max === null) continue;
      expect(max, `${r.protocol}: ${r.dose}`).toBeLessThanOrEqual(ul);
    }
  });

  it('B6 выше UL подписан предупреждением', () => {
    const ul = NUTRIENT_LIMITS_V2.vitamin_b6.value;
    for (const r of rowsNamed(/B6|P5P/i)) {
      const max = maxOf(r.dose, 'мг');
      if (max === null || max <= ul) continue;
      expect(`${r.dose} ${r.note}`, r.protocol).toContain('UL B6');
    }
  });
});
