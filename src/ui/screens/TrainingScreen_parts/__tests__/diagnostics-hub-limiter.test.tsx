import { describe, expect, it } from 'vitest';
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

describe('DiagnosticsHub: единый инструмент движения', () => {
  it('рендерит Мастер движения (9 лифтов) без дублей суставов', () => {
    const html = renderToStaticMarkup(<DiagnosticsHub {...props} />);
    expect(html).toContain('Диагностика движения');
    expect(html).toContain('срывы');
    expect(html).toContain('RIR-калибровка');
    expect(html).toContain('мезоцикла');
    expect(html).toContain('9 движений');
    expect(html).not.toContain('Суставы + ортопедия');
  });

  it('CYCLE_01 валиден для card (движение → категория работает)', () => {
    expect(CYCLE_01.week1.length).toBeGreaterThan(0);
  });
});
