/**
 * risk-analyses-bound.test.ts — проход 152: риск «по анализам» не считает
 * неподтверждённую сторону границы.
 *
 * Было: `calculateRiskFromAnalyses` брал число из бланка как измеренное и
 * сравнивал с нормой. «HDL >0.5» (предел метода) при нижней границе 0.9 давал
 * полный кардио-вклад, будто HDL измерен как 0.5, — риск из записи, которая не
 * говорит, низкий он или нормальный. «Ферритин >1000» и «ЛПНП >5» наоборот
 * работали правильно случайно: их сторона границей доказана.
 *
 * Стало: сторону отклонения доказывает либо точное число, либо граница
 * (`boundProvesSide`); недоказанная граница не даёт вклада и называется в
 * `boundUnproven`, а не исчезает.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateRiskFromAnalyses } from '../risk-calculator-v2.engine';
import type { LabPoint } from '../../core/types';

const lab = (code: string, value: number, bound?: '<' | '>'): LabPoint =>
  ({ id: `${code}-${value}-${bound || ''}`, code, name: code, value, unit: '', date: '2026-11-14', ...(bound ? { bound } : {}) } as any);

const cardio = (labs: LabPoint[]) =>
  ((calculateRiskFromAnalyses(labs, 'male') as any).systemContributions as Record<string, number>).cardio;

const unproven = (labs: LabPoint[]) => (calculateRiskFromAnalyses(labs, 'male') as any).boundUnproven as any[];

describe('проход 152: обратный маркер — граница не доказывает низкое', () => {
  it('точный HDL 0.5 — кардио-риск есть (как было)', () => {
    expect(cardio([lab('HDL', 0.5)])).toBeGreaterThan(0);
  });

  it('«HDL >0.5» — сторона не доказана: вклада нет, запись названа', () => {
    expect(cardio([lab('HDL', 0.5, '>')])).toBe(0);
    expect(unproven([lab('HDL', 0.5, '>')])).toEqual([{ code: 'HDL', value: 0.5, bound: '>' }]);
  });

  it('«HDL <0.5» — низкое доказано: риск считается', () => {
    expect(cardio([lab('HDL', 0.5, '<')])).toBeGreaterThan(0);
    expect(unproven([lab('HDL', 0.5, '<')])).toEqual([]);
  });
});

describe('проход 152: прямой маркер — доказанная высокая сторона остаётся риском', () => {
  it('«ЛПНП >5» — высокое доказано, риск есть', () => {
    expect(cardio([lab('LDL', 5, '>')])).toBeGreaterThan(0);
  });

  it('«ЛПНП >2» при верхней 3 — не доказано: вклада нет', () => {
    expect(cardio([lab('LDL', 2, '>')])).toBe(0);
    expect(unproven([lab('LDL', 2, '>')])).toEqual([{ code: 'LDL', value: 2, bound: '>' }]);
  });

  it('«Ферритин >1000» — высокое доказано, вклад в печень и кровь', () => {
    const c = (calculateRiskFromAnalyses([lab('FERRITIN', 1000, '>')], 'male') as any).systemContributions;
    expect(c.hepatic).toBeGreaterThan(0);
    expect(c.hematologic).toBeGreaterThan(0);
  });

  it('«СРБ <5» не даёт вклада, но и не исчезает молча', () => {
    const res = calculateRiskFromAnalyses([lab('CRP', 5, '<')], 'male') as any;
    expect(res.systemContributions.cardio).toBe(0);
    expect(res.systemContributions.hematologic).toBe(0);
    expect(res.boundUnproven).toEqual([{ code: 'CRP', value: 5, bound: '<' }]);
  });
});

describe('проход 152: точные числа считаются как раньше', () => {
  it('ЛПНП 6 без границы и «ЛПНП >6» дают один вклад', () => {
    expect(cardio([lab('LDL', 6)])).toBeCloseTo(cardio([lab('LDL', 6, '>')]), 6);
    expect(unproven([lab('LDL', 6)])).toEqual([]);
  });
});

describe('проход 152: список отклонений на экране «Риск» — тот же модуль, что в «Анализах»', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/RiskScreen.tsx'), 'utf8');

  it('процент отклонения считает computeMarkerDeviations, а не своя копия', () => {
    expect(src).toContain('computeMarkerDeviations(labs as any, profileSex)');
    // Своя таблица систем и своя арифметика отклонения удалены.
    expect(src).not.toContain('LAB_SYSTEM_GROUPS');
    expect(src).not.toContain("if (norm > uln) deviation = (norm - uln) / uln;");
  });

  it('значение печатается со знаком границы, процент — только у точного числа', () => {
    expect(src).toContain('labValueLabel(m.value, m.bound)');
    expect(src).toContain("absDev==null?'':absDev+'%'");
    expect(src).toContain('data-risk-marker-bound={m.bound');
  });

  it('«все маркеры в норме» не печатается, когда есть записи без вывода', () => {
    expect(src).toContain('Без вывода: {labRisks.unknownCount}');
    expect(src).toContain('Отклонений не найдено, но есть записи без вывода');
    expect(src).toContain('labRisks.unknownCount>0');
  });
});
