/**
 * d3-single-dose.test.ts — гард «у витамина D одна базовая доза».
 *
 * Аудит 2026-11: `DEFAULT_DOSAGES.vitamin_d3` = 5000 МЕ (витрина плана),
 * каталог = 0.125 мг (5000 МЕ), а титрация движка считала 50 мкг = 2000 МЕ.
 * План показывал одно, UL-блок проверял другое, а 5000 МЕ вообще выше UL
 * 4000 МЕ — то есть каждый план формально выходил за предел.
 *
 * Решение продукта: единственная базовая/витринная доза — 2000 МЕ (50 мкг).
 * 5000–10000 МЕ остаются только в текстах коррекции дефицита (по назначению
 * врача) и в формах-альтернативах каталога, но не как доза плана.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_DOSAGES } from '../support-meta';
import { SUPPORT_CATALOG_DATA } from '../support-database';
import { formatDefaultDose, formatDoseFromMg } from '../dose-units';
import { NUTRIENT_UL } from '../../engines/support-plan/types';
import { ALL_STACKS } from '../support-stacks';

const cat = () => (SUPPORT_CATALOG_DATA as any).vitamin_d3;

describe('витамин D3: одна базовая доза на весь контур', () => {
  it('DEFAULT_DOSAGES и каталог согласованы: 2000 МЕ = 0.05 мг', () => {
    expect(DEFAULT_DOSAGES.vitamin_d3.mg).toBe(2000);
    expect(cat().dosage.mg).toBeCloseTo(0.05, 6);
    expect(formatDefaultDose('vitamin_d3', DEFAULT_DOSAGES.vitamin_d3.mg)).toBe('2000 МЕ');
    expect(formatDoseFromMg('vitamin_d3', cat().dosage.mg)).toBe('2000 МЕ');
  });

  it('базовая доза ниже UL и не срезается капом', () => {
    // NUTRIENT_UL хранит D3 в мкг: 100 мкг = 4000 МЕ.
    expect(NUTRIENT_UL.vitamin_d3).toBe(100);
    const mcg = DEFAULT_DOSAGES.vitamin_d3.mg * 0.025; // МЕ → мкг
    expect(mcg).toBe(50);
    expect(mcg).toBeLessThan(NUTRIENT_UL.vitamin_d3);
  });

  it('все протоколы стеков используют 2000 МЕ, а не 5000', () => {
    const d3 = ALL_STACKS.flatMap(s => s.substances.filter((x: any) => x.id === 'vitamin_d3'));
    expect(d3.length).toBeGreaterThan(0);
    for (const sub of d3) {
      if (sub.dose) expect(String(sub.dose)).not.toContain('5000');
    }
  });

  it('5000 МЕ остаётся только как форма коррекции дефицита', () => {
    const forms: any[] = cat().forms || [];
    const best = forms.find(f => f.best);
    expect(best?.nameRu).toContain('2000');
    const high = forms.find(f => String(f.nameRu).includes('5000'));
    if (high) {
      expect(high.best).not.toBe(true);
      expect(String(high.notes || '')).toMatch(/дефицит/i);
    }
  });
});
