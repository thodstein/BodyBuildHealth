/**
 * strongman-diagnostics-inject.test.tsx — аудит SM-плана + инъекция коррекций в план + откат.
 * Паритет с ТА/арм: хаб показывает покрытие фаз, вставляет коррекции в he_strength_sport_plan_v1
 * и умеет откатить (снапшот в sessionStorage).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { StrongmanDiagnosticsHub } from '../StrongmanDiagnosticsHub';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  (HTMLCanvasElement.prototype as any).getContext = vi.fn(() => null);
});

const PLAN_KEY = 'he_strength_sport_plan_v1';

function miniPlan() {
  return {
    id: 't', mode: 'strongman', goal: 'strength', level: 'intermediate', weeks: 1, patternId: 'x',
    weeksData: [
      {
        week: 1, phase: 'accumulation', deload: false,
        sessions: [{ week: 1, day: 1, sessionTag: 'event_day', character: 'тяж', exercises: [{ id: 'log_press', name: 'Жим лога', group: 'shoulders', pattern: 'press', role: 'primary', character: 'тяж', sets: 3, reps: '5', rir: 2, weight: 80, workSets: [{ reps: 5, rir: 2, weight: 80 }], warmupSets: [] }] }],
      },
    ],
    workMax: {}, rationale: [],
  };
}

describe('StrongmanDiagnosticsHub: план-аудит + инъекция + откат', () => {
  it('без плана — честная плашка, инъекция предупреждает', async () => {
    render(<StrongmanDiagnosticsHub />);
    expect(document.body.querySelector('[data-sm="sm-plan-audit"]')).toBeTruthy();
    expect(document.body.textContent).toContain('план стронга не собран');
    fireEvent.click(document.body.querySelector('[data-sm="sm-inject"]') as HTMLElement);
    await waitFor(() => expect(document.body.querySelector('[data-sm="sm-inject-msg"]')?.textContent || '').toMatch(/Нет плана|Выбери/));
  });

  it('с планом: аудит покрытия + чипы фаз', async () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(miniPlan()));
    render(<StrongmanDiagnosticsHub />);
    await waitFor(() => expect(document.body.textContent).toContain('покрытие фаз'));
    expect(document.body.querySelectorAll('[data-sm="sm-coverage"] [data-covered]').length).toBeGreaterThan(0);
  });

  it('инъекция пишет коррекции в план, откат возвращает', async () => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(miniPlan()));
    localStorage.setItem('he_strongman_diagnostics_hub_v1', JSON.stringify({ pressWeak: ['press_start'] }));
    render(<StrongmanDiagnosticsHub />);
    await waitFor(() => expect(document.body.querySelector('[data-sm="sm-inject"]')).toBeTruthy());
    const before = localStorage.getItem(PLAN_KEY) || '';
    fireEvent.click(document.body.querySelector('[data-sm="sm-inject"]') as HTMLElement);
    await waitFor(() => expect(document.body.querySelector('[data-sm="sm-inject-msg"]')?.textContent || '').toMatch(/Вставлено коррекций|Не влезло|упала/), { timeout: 3000 });
    const after = localStorage.getItem(PLAN_KEY) || '';
    // что-то вставилось → план изменился и несёт отметку инъекции
    expect(after).not.toBe(before);
    expect(after).toContain('диагностика: инъецировано');
    // откат
    const rb = document.body.querySelector('[data-sm="sm-rollback"]') as HTMLElement;
    expect(rb).toBeTruthy();
    fireEvent.click(rb);
    await waitFor(() => expect(localStorage.getItem(PLAN_KEY)).not.toContain('инъецировано'));
  });
});
