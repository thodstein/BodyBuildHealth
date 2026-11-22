/**
 * risk-lab-coverage.test.ts — проход 206: «покрытие анализами» считает маркеры
 * модели, а не строки бланка.
 *
 * Класс дефекта: `labCoverage` (он же `d_cov`) задаёт надбавку за
 * неопределённость `U_i = 1 + 0.25·(1−d_cov)`, то есть должен отвечать на вопрос
 * «какие анализы модели у нас есть». Пока бланк разбирал отдельный читатель,
 * счётчик невольно это и делал. Общий читатель (проход 206) пропускает всё
 * введённое, и счётчик рос бы от ЦЕА, нейтрофилов или 3α-АДГ — надбавка за
 * неопределённость падала бы от анализов, которых модель не читает.
 */
import { describe, it, expect } from 'vitest';
import { RISK_LAB_MARKERS, riskLabCoverage } from '../risk-engine-tz-spec';

describe('проход 206: покрытие анализами — маркеры модели', () => {
  it('пустая карта — базовые 30%, как в прежней формуле', () => {
    expect(riskLabCoverage({})).toBe(0.3);
  });

  it('маркер модели добавляет один шаг 0.04', () => {
    expect(riskLabCoverage({ K: 4.3 })).toBeCloseTo(0.34, 10);
    expect(riskLabCoverage({ K: 4.3, HCT: 46 })).toBeCloseTo(0.38, 10);
  });

  it('анализ вне модели покрытие не поднимает', () => {
    // Оба поля есть в форме, но ни один механизм и ни одно правило их не читают.
    expect(riskLabCoverage({ CEA: 5, NEUTROPHILS: 4.2 })).toBe(0.3);
  });

  it('одно и то же число под двумя написаниями считается один раз', () => {
    // `tierLabView` дублирует ключ (K и POTASSIUM) — это один анализ.
    expect(riskLabCoverage({ K: 4.3, POTASSIUM: 4.3 })).toBeCloseTo(0.34, 10);
  });

  it('потолок — 1.0', () => {
    const all = Object.fromEntries(RISK_LAB_MARKERS.map((m) => [m, 1]));
    expect(riskLabCoverage(all)).toBe(1);
  });

  it('в списке модели есть и «складовые» коды, и производные', () => {
    for (const marker of ['K', 'HCT', 'GLU', 'HOMA', 'EGFR', 'CREATININE', 'ALT', 'TT']) {
      expect(RISK_LAB_MARKERS, marker).toContain(marker);
    }
    expect(RISK_LAB_MARKERS).not.toContain('CEA');
  });
});
