/**
 * calc-deadcode-p1.test.tsx — P1-аудит: оживление «Мега-подбора» и ручного пикера,
 * отсутствие мёртвых состояний/импортов карточек в Calc.mapper.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutoCalculator } from '../AutoCalculator';
import { CalcMapperCard } from '../Calc.mapper';
import { normalizeCalculatorState, DEFAULT_STATE } from '../Calc.types';

beforeEach(() => {
  localStorage.clear();
});

describe('оживление мега-попапа (showMegaPopup)', () => {
  it('с курсом есть кнопка «🚀 Мега», клик открывает попап', async () => {
    render(
      React.createElement(AutoCalculator, {
        embedded: true,
        courseWeek: 6,
        courseLinked: [{ id: '1', substanceId: 'tren_acet', doseValue: 500, doseUnit: 'mg', frequency: 1, startWeek: 1, endWeek: 12 }],
        onApply: () => {},
      } as never),
    );
    const btn = await screen.findByText(/Мега \(/, {}, { timeout: 8000 });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.queryAllByText(/🚀 Мега-усиление/).length).toBeGreaterThan(0);
    });
  });
});

describe('оживление onOpenManualPicker', () => {
  it('кнопка пикера видна и вызывает колбэк', () => {
    const onOpenManualPicker = vi.fn();
    const st = normalizeCalculatorState({ ...DEFAULT_STATE });
    render(
      React.createElement(CalcMapperCard, {
        state: st,
        onStateChange: () => {},
        onApply: () => {},
        onOpenManualPicker,
      } as never),
    );
    const btn = screen.getByText(/Расширенный ручной пикер/);
    fireEvent.click(btn);
    expect(onOpenManualPicker).toHaveBeenCalledTimes(1);
  });

  it('без пропа кнопка не рендерится (SSR-путь вызовов цел)', () => {
    const st = normalizeCalculatorState({ ...DEFAULT_STATE });
    render(
      React.createElement(CalcMapperCard, { state: st, onStateChange: () => {}, onApply: () => {} } as never),
    );
    expect(screen.queryAllByText(/Расширенный ручной пикер/).length).toBe(0);
  });
});

describe('мёртвый код удалён (source-lock)', () => {
  it('нет мёртвых состояний/импортов карточек', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/Calculator/Calc.mapper.tsx'), 'utf8');
    expect(src).not.toContain('showInteractions');
    expect(src).not.toContain('savedSearch');
    expect(src).not.toContain('manualSubInput');
    expect(src).not.toContain('catalogSubsCount');
    expect(src).not.toContain('CalcPEDCard');
    expect(src).not.toContain('CalcProfileCard');
    expect(src).not.toContain('CalcLabsCard');
    expect(src).not.toContain('SafetyDepletion');
    expect(src).not.toContain('SafetyPctTiming');
    expect(src).not.toContain('getSubstanceForm');
    expect(src).not.toContain('getTitrationProtocol');
  });
});
