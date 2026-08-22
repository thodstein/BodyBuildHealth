import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { DiagnosticsHub } from '../DiagnosticsHub';
import type { WorkoutLog } from '../../../../core/types';
import { CYCLE_01 } from '../../../../data/lms-cycles/cycle-01';

const props = {
  sessions: [] as WorkoutLog[],
  tprofile: { weakPoints: [] } as any,
  readinessRecovery: 70,
  readinessFatigue: 30,
  mesoWeeks: 12,
  missedSessions: 0,
  currentVolume: 18,
  currentRir: 2,
};

describe('DiagnosticsHub: единый инструмент (дедуп)', () => {
  it('есть чипы единых мастеров (дедуп старых movement/limiter/jsi)', () => {
    const html = renderToStaticMarkup(<DiagnosticsHub {...props} />);
    expect(html).toContain('Мастер движения');
    expect(html).toContain('Суставы + AI-ортопед');
    expect(html).toContain('Срывы (дневник)');
    expect(html).not.toContain('Лимитирующие факторы движения');
    expect(html).not.toContain('Мёртвые → Слабые → Бар');
  });

  it('переключение на мастер показывает единый инструмент, точечные калькуляторы на месте', () => {
    render(<DiagnosticsHub {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Мастер движения/ }));
    expect(screen.getByText(/единый инструмент/)).toBeTruthy();
    expect(screen.getAllByText(/Срывы/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /RIR/ })).toBeTruthy();
  });

  it('CYCLE_01 валиден для card (движение → категория работает)', () => {
    expect(CYCLE_01.week1.length).toBeGreaterThan(0);
  });
});
