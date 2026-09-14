/**
 * calc-risk-lift-p1.test.tsx — остаток Д10 (callback-лифт риска):
 * CalcMapperCard отдаёт наверх риск с ручными правками (onRiskChange), а без правок — null:
 * верхняя карточка AutoCalculator показывает расчёт движка, как раньше.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CalcMapperCard } from '../Calc.mapper';
import { normalizeCalculatorState, DEFAULT_STATE } from '../Calc.types';

beforeEach(() => {
  localStorage.clear();
});

const stateWithCourse = () => normalizeCalculatorState({
  ...DEFAULT_STATE,
  pharma: {
    ...DEFAULT_STATE.pharma,
    aas: [{ id: 'test_enan', doseMgWeek: 250, weeks: 12, startWeek: 1, endWeek: 12 }] as never,
  },
});

describe('Д10-остаток: лифт риска с ручными правками', () => {
  it('без правок onRiskChange(null), после выбора стека — объект риска', async () => {
    const onRisk = vi.fn();
    render(
      React.createElement(CalcMapperCard, {
        state: stateWithCourse(),
        onStateChange: () => {},
        onApply: () => {},
        onRiskChange: onRisk,
      } as never),
    );
    // Без правок — верхняя карточка считает как раньше
    await waitFor(() => expect(onRisk).toHaveBeenCalledWith(null), { timeout: 8000 });

    // Ручной режим → выбор первого стека → применить
    fireEvent.click(screen.getByText('Ручной режим'));
    await waitFor(() => expect(document.querySelector('[data-stack-row]')).toBeTruthy(), { timeout: 8000 });
    fireEvent.click(document.querySelector('[data-stack-row]') as Element);
    fireEvent.click(screen.getByText(/Применить ручной выбор/));

    await waitFor(
      () => {
        const last = onRisk.mock.calls.length > 0 ? onRisk.mock.calls[onRisk.mock.calls.length - 1][0] : null;
        expect(last, 'риск с правками должен уехать наверх').toBeTruthy();
        expect(Array.isArray(last.organs)).toBe(true);
      },
      { timeout: 10000 },
    );
  }, 20000);
});

describe('интеграция AutoCalculator (source-lock)', () => {
  it('верхняя карточка использует mapperRisk ?? result.tzSpecResult и подпись правок', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/Calculator/AutoCalculator.tsx'), 'utf8');
    expect(src).toContain('const tz = mapperRisk ?? result.tzSpecResult;');
    expect(src).toContain('data-manual-risk');
    expect(src).toContain('onRiskChange={setMapperRisk}');
  });
});
