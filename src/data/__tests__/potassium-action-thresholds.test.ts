/**
 * potassium-action-thresholds — три «верхних» числа калия живут в одном месте.
 *
 * Проход 210. До правки 5.5 (флаг комплексного отчёта), 6.0 (критический
 * результат разбора) и 6.5 (неотложная ступень) были литералами в трёх разных
 * файлах. Числа разные не по ошибке: это три разных вопроса к одному анализу.
 * Гард держит две вещи: (1) значения и их порядок, (2) то, что потребители
 * читают реестр, а не возвращают свои литералы.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { POTASSIUM_ACTION } from '../potassium-action-thresholds';
import { LAB_TIERS } from '../lab-tier-ranges';

const LAB_ANALYSIS_SRC = readFileSync(join(__dirname, '..', '..', 'engines', 'lab-analysis.engine.ts'), 'utf8');
const REPORT_SRC = readFileSync(join(__dirname, '..', '..', 'engines', 'comprehensive-report.engine.ts'), 'utf8');
const TIERS_SRC = readFileSync(join(__dirname, '..', 'lab-tier-ranges.ts'), 'utf8');

describe('пороги калия: одно место, три разных вопроса', () => {
  it('значения закреплены и упорядочены', () => {
    expect(POTASSIUM_ACTION.reportFlagHigh).toBe(5.5);
    expect(POTASSIUM_ACTION.criticalResultHigh).toBe(6.0);
    expect(POTASSIUM_ACTION.emergencyHigh).toBe(6.5);
    expect(POTASSIUM_ACTION.reportFlagHigh).toBeLessThan(POTASSIUM_ACTION.criticalResultHigh);
    expect(POTASSIUM_ACTION.criticalResultHigh).toBeLessThan(POTASSIUM_ACTION.emergencyHigh);
  });

  it('ступень действия и норма не поехали', () => {
    expect(LAB_TIERS.POTASSIUM.emergencyHigh).toBe(POTASSIUM_ACTION.emergencyHigh);
    expect(LAB_TIERS.POTASSIUM.normal).toEqual([3.5, 5.1]);
  });

  it('потребители читают реестр, а не свои литералы', () => {
    expect(LAB_ANALYSIS_SRC).toContain('criticalHigh: POTASSIUM_ACTION.criticalResultHigh');
    expect(LAB_ANALYSIS_SRC).not.toContain('criticalHigh: 6.0');
    expect(REPORT_SRC).toContain('k > POTASSIUM_ACTION.reportFlagHigh');
    expect(REPORT_SRC).not.toContain('k > 5.5');
    expect(TIERS_SRC).toContain('emergencyHigh:POTASSIUM_ACTION.emergencyHigh');
  });
});
