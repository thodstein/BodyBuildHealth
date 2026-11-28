/**
 * tier-reason.test.ts — E2: доза лаб-ступени не печатается в прозе.
 *
 * Причина ступени объясняет «почему», дозу показывает карточка плана. Тест
 * держит реальные строки `lab-tier-recommendations.ts`, чтобы новое «N мг» в
 * прозе не вернуло второе число рядом с карточкой.
 */
import { describe, expect, it } from 'vitest';
import { stripDosePhrases } from '../support-plan/tier-reason';

describe('stripDosePhrases: доза уходит из причины, смысл остаётся', () => {
  it('«Силимарин 280 мг — …» → без дозы', () => {
    expect(stripDosePhrases('Силимарин 280 мг — стабилизация мембран гепатоцитов')).toBe(
      'Силимарин — стабилизация мембран гепатоцитов',
    );
  });

  it('«Бергамот ×2 (1000 мг) — …» → без кратности и дозы', () => {
    expect(stripDosePhrases('Бергамот ×2 (1000 мг) — HMG-CoA редуктаза')).toBe('Бергамот — HMG-CoA редуктаза');
  });

  it('«Омега-3 ↑3 г» → «Омега-3», а не «Омега-»', () => {
    expect(stripDosePhrases('Омега-3 ↑3 г')).toBe('Омега-3');
  });

  it('доза в середине фразы: «Ниацин 500 мг на ночь — …»', () => {
    expect(stripDosePhrases('Ниацин 500 мг на ночь — ↑HDL first-line')).toBe('Ниацин на ночь — ↑HDL first-line');
  });

  it('МЕ и млрд КОЕ тоже снимаются', () => {
    expect(stripDosePhrases('Витамин D3 2000 МЕ — иммунитет')).toBe('Витамин D3 — иммунитет');
    expect(stripDosePhrases('Пробиотики 20 млрд КОЕ — барьер')).toBe('Пробиотики — барьер');
  });

  it('текст без дозы не меняется', () => {
    expect(stripDosePhrases('TUDCA — стимуляция BSEP-желчеоттока')).toBe('TUDCA — стимуляция BSEP-желчеоттока');
  });
});
