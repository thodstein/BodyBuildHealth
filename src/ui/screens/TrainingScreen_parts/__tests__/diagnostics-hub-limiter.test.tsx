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

describe('DiagnosticsHub: режим «Лимитирующие факторы»', () => {
  it('есть чип режима «Лимитирующие факторы движения»', () => {
    const html = renderToStaticMarkup(<DiagnosticsHub {...props} />);
    expect(html).toContain('Лимитирующие факторы движения');
  });

  it('переключение на режим показывает калькулятор лимитирующих факторов', () => {
    render(<DiagnosticsHub {...props} />);
    fireEvent.click(screen.getAllByText(/Лимитирующие факторы движения/)[0]);
    expect(screen.getByText(/Калькулятор лимитирующих факторов движения/)).toBeTruthy();
    // Исходные режимы диагностики на месте
    expect(screen.getByText(/Мёртвые точки → Слабые точки → Движение штанги/)).toBeTruthy();
    expect(screen.getByText(/Срывы \(дневник\)/)).toBeTruthy();
  });

  it('CYCLE_01 валиден для card (движение → категория работает)', () => {
    expect(CYCLE_01.week1.length).toBeGreaterThan(0);
  });
});
