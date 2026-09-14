/**
 * calc-dedup-p1.test.tsx — P1-аудит калькулятора поддержки (docs/SUPPORT-CALC-FULL-AUDIT-PLAN.md §7):
 *
 * Д3: алерты курса (rec.alerts) показываются ОДИН раз — в сводке (якорь #calc-alerts-summary);
 *     в «Мониторинге» — только бейдж и ссылка «К тревогам», без копии текстов.
 * Д4: однострочные дубли pedFlags убраны — детали показывает SafetyPedEscalation
 *     («MULTI-ORAL» ровно один раз, старой строки «Более 1 орального 17α» больше нет).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { AutoCalculator } from '../AutoCalculator';

beforeEach(() => {
  localStorage.clear();
});

const seedLabs = () => {
  localStorage.setItem(
    'he_autocalc_state',
    JSON.stringify({
      labs: {
        fullPanel: {
          date: '2026-09-01',
          panelBiochem: { ALT: '250', AST: '80' },
          panelHematology: { HCT: '50' },
        },
      },
    }),
  );
};

const courseLinked = (substanceId: string, doseValue: number) => [
  { id: '1', substanceId, doseValue, doseUnit: 'mg', frequency: 1, startWeek: 1, endWeek: 12 },
];

describe('Д3: алерты rec.alerts — единственная точка показа', () => {
  it('алерт ALT 250 показан один раз + якорь сводки + ссылка в мониторинге', async () => {
    seedLabs();
    render(
      React.createElement(AutoCalculator, {
        embedded: true,
        courseWeek: 4,
        courseLinked: courseLinked('test_enan', 250),
        onApply: () => {},
      } as any),
    );
    await waitFor(
      () => {
        expect(screen.queryAllByText(/ALT = 250/).length).toBe(1);
      },
      { timeout: 5000 },
    );
    // Якорь сводки существует, а в мониторинге — ни одного дубля SafetyAlerts-блока
    expect(document.getElementById('calc-alerts-summary')).not.toBeNull();
    expect(document.querySelectorAll('.calc-safetyalerts').length).toBe(0);
  });

  it('бейдж «тревоги: N — в сводке» виден в шапке мониторинга (без дубля текста)', async () => {
    seedLabs();
    render(
      React.createElement(AutoCalculator, {
        embedded: true,
        courseWeek: 4,
        courseLinked: courseLinked('test_enan', 250),
        onApply: () => {},
      } as any),
    );
    const header = await screen.findByText(/Мониторинг анализов и показателей/, {}, { timeout: 8000 });
    // Шапка мониторинга — тап-контейнер со бейджем тревог
    await waitFor(
      () => {
        expect(document.querySelector('[data-alerts-badge]')).not.toBeNull();
      },
      { timeout: 8000 },
    );
    // раскрываем мониторинг — внутри только ссылка, не тексты алертов
    fireEvent.click(header);
    await waitFor(
      () => {
        expect(screen.queryAllByText(/К тревогам/).length).toBeGreaterThan(0);
      },
      { timeout: 8000 },
    );
    expect(screen.queryAllByText(/ALT = 250/).length).toBe(1);
  });
});

describe('Д4: pedFlags — без однострочных дублей', () => {
  it('multi-oral: «MULTI-ORAL» один раз, старой строки нет', async () => {
    render(
      React.createElement(AutoCalculator, {
        embedded: true,
        courseWeek: 6,
        courseLinked: [
          ...courseLinked('methand', 30),
          { id: '2', substanceId: 'stan', doseValue: 50, doseUnit: 'mg', frequency: 1, startWeek: 1, endWeek: 12 },
        ],
        onApply: () => {},
      } as any),
    );
    // Курс подхватился → раскрываем «Мониторинг» (внутри него живёт блок предупреждений)
    await waitFor(
      () => {
        expect(screen.queryAllByText(/Курс ААС · 2/).length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );
    const header = await screen.findByText(/Мониторинг анализов и показателей/, {}, { timeout: 8000 });
    fireEvent.click(header);
    await waitFor(
      () => {
        expect(screen.queryAllByText(/MULTI-ORAL/).length).toBe(1);
      },
      { timeout: 8000 },
    );
    // Старый однострочник «Более 1 орального 17α» удалён (детали — в SafetyPedEscalation)
    expect(screen.queryAllByText(/Более 1 орального/).length).toBe(0);
    // Блок предупреждений существует и считает эскалации
    expect(screen.queryAllByText(/Предупреждения о курсе/).length).toBeGreaterThan(0);
  });
});
