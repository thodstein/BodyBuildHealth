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
import {
  FEMALE_SUPPORT_PROTOCOLS,
  FEMALE_PSYCHE_EFFECTS,
  FEMALE_EMERGENCY_CRITICAL,
  FEMALE_EMERGENCY_URGENT,
} from '../supportProtocolWomenData';
import { NUTRIENT_LIMITS_V2 } from '../../../../engines/support-limits';
import { HCT_THRESHOLDS } from '../../../../engines/lab-norms.engine';
import { CROSS_CAPS } from '../supportProtocolsShared';

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

// ── Проход 40: правила, которые уже несут мужские протоколы, в женских тоже ──
describe('женские протоколы: медь, потолок B6, потолок NAC, шкала витамина E', () => {
  it('цинк ≥25 мг/сут — в строке есть медь (иначе дефицит Cu)', () => {
    const missing: string[] = [];
    for (const r of rowsNamed(/цинк/i)) {
      const max = maxOf(r.dose, 'мг');
      if (max === null || max < 25) continue;
      if (!/медь|меди|Cu\b/i.test(`${r.dose} ${r.note}`)) missing.push(`${r.protocol}: ${r.dose} — ${r.note}`);
    }
    expect(missing).toEqual([]);
  });

  it('B6 не выше потолка протокола (кап 100 мг из CROSS_CAPS)', () => {
    const cap = CROSS_CAPS.find(c => c.key === 'b6')!.cap;
    for (const r of rowsNamed(/B6|P5P/i)) {
      const max = maxOf(r.dose, 'мг');
      if (max === null) continue;
      expect(max, `${r.protocol}: ${r.dose}`).toBeLessThanOrEqual(cap);
    }
  });

  it('NAC: подпись «кросс-кап 4000» называет движковый кап 2400', () => {
    const bad: string[] = [];
    for (const r of rowsNamed(/NAC/i)) {
      if (!/4000/.test(`${r.dose} ${r.note}`)) continue;
      if (!/2400/.test(r.note)) bad.push(`${r.protocol}: ${r.note}`);
    }
    expect(bad).toEqual([]);
  });

  it('витамин E в МЕ: пересчёт в мг α-токоферола в пределах UL 300 мг', () => {
    const ul = NUTRIENT_LIMITS_V2.vitamin_e.value; // мг α-токоферола
    const rows = rowsNamed(/витамин\s*E/i);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const me = maxOf(r.dose, 'МЕ');
      if (me === null) continue;
      const mg = me * 0.67; // 1 МЕ = 0.67 мг d-α-токоферола
      expect(mg, `${r.protocol}: ${r.dose}`).toBeLessThanOrEqual(ul);
      expect(`${r.dose} ${r.note}`, r.protocol).toMatch(/UL|мг/);
    }
  });
});

// ── Проход 45: экстренная лестница HCT и «магний» вне таблиц доз ──
describe('женский протокол: HCT-лестница и магний в тактике', () => {
  it('экстренный HCT стоит на женской шкале 48/52, а не на 55', () => {
    const f = HCT_THRESHOLDS.female;
    const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
    const urgent = FEMALE_EMERGENCY_URGENT.find(r => /гематокрит/i.test(r.situation))!;
    const critical = FEMALE_EMERGENCY_CRITICAL.find(r => /гематокрит/i.test(r.situation))!;
    expect(urgent, 'нет строки «Гематокрит» в URGENT').toBeTruthy();
    expect(critical, 'нет строки «Гематокрит» в CRITICAL').toBeTruthy();
    // URGENT — полоса [эритроцитоз; порог флеботомии], CRITICAL — порог флеботомии + мужской.
    expect(nums(urgent.situation)).toEqual([f.erythrocytosis, f.block]);
    expect(nums(critical.situation)).toContain(f.block);
    expect(nums(critical.situation)).toContain(HCT_THRESHOLDS.male.block);
    expect(nums(critical.situation)).not.toContain(55);
  });

  it('магний в тактике (тревожность/бессонница) ≤ UL 350 мг', () => {
    const ul = NUTRIENT_LIMITS_V2.magnesium.value;
    const withMg = FEMALE_PSYCHE_EFFECTS.filter(r => /магний/i.test(r.action));
    expect(withMg.length).toBeGreaterThan(0);
    for (const r of withMg) {
      const m = r.action.match(new RegExp(`магний[^\\d]{0,12}(\\d+(?:[.,]\\d+)?)\\s*мг`, 'i'));
      if (!m) continue;
      const mg = parseFloat(m[1].replace(',', '.'));
      expect(mg, `${r.problem}: ${r.action}`).toBeLessThanOrEqual(ul);
    }
  });
});
