/**
 * fertility-supplement-ul.test.ts — дозы добавок фертильности не выше UL.
 *
 * Аудит 2026-11 (проход 22): на экране «Фертильность/ПКТ» жил свой набор доз,
 * не связанный с реестром пределов: D3 3000–5000 МЕ (UL 4000), цинк 30–50 мг
 * (UL 40), витамин E 400–800 МЕ (~268–536 мг, UL 300 мг). Пользователь видел
 * на разных экранах разные «базовые» дозы одного вещества. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NUTRIENT_LIMITS_V2 } from '../../engines/support-limits';

const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/FertilityPCTScreen.tsx'), 'utf8');

describe('фертильность/ПКТ: дозы в границах UL', () => {
  it('числа в тексте совпадают с реестром пределов', () => {
    expect(NUTRIENT_LIMITS_V2.vitamin_d.value).toBe(4000); // МЕ
    expect(NUTRIENT_LIMITS_V2.zinc.value).toBe(40);        // мг
    expect(NUTRIENT_LIMITS_V2.vitamin_e.value).toBe(300);  // мг
    expect(src).toContain('2000-4000 МЕ/день');
    expect(src).toContain('до 40 мг/день');
    expect(src).toContain('до 300 мг/день');
  });

  it('старые дозы выше UL не вернулись ни в один список', () => {
    expect(src).not.toContain('3000-5000 МЕ/день');
    expect(src).not.toContain('4000-5000 МЕ');
    expect(src).not.toContain('30-50 мг');
    expect(src).not.toContain('400-800 МЕ/день');
  });

  it('все три списка (ПКТ-текст, ПКТ-карточка, универсальный) исправлены', () => {
    const d3 = src.match(/2000-4000 МЕ\/день/g) || [];
    const zinc = src.match(/до 40 мг\/день/g) || [];
    const e = src.match(/до 300 мг\/день/g) || [];
    expect(d3.length).toBe(3);
    expect(zinc.length).toBe(4);
    expect(e.length).toBe(3);
  });
});
