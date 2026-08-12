import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CycleLayoutView } from '../CycleCatalog';
import { LMS_CYCLES } from '../../../../data/lms-cycles/lms-cycle-index';
import type { SRCycleTemplate } from '../../../../data/lms-cycles/lms-types';

const mkCycle = (over: Partial<SRCycleTemplate> = {}): SRCycleTemplate => ({
  meta: {
    id: 'test-cycle',
    title: 'Тест',
    direction: 'powerlifting',
    level: 'II-KMS',
    period: 'strength',
    sessionsPerWeek: 3,
    weeks: 4,
    correctionPct: 0.005,
    description: 'описание',
    howItWorks: 'инструкция',
    conditions: [],
  },
  week1: [
    { exercises: [
      { name: 'Присед', group: 'ПР', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.68, reps: 6, sets: 4, rir: 2 }] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{ pct: 0.45, reps: 6, sets: 3 }] },
    ] },
  ],
  ...over,
});

describe('CycleLayoutView', () => {
  it('renders day headers and exercise names from week1', () => {
    render(<CycleLayoutView cycle={mkCycle()} />);
    expect(screen.getByText('День 1')).toBeTruthy();
    expect(screen.getByText('Присед')).toBeTruthy();
    expect(screen.getByText('Жим лежа')).toBeTruthy();
  });

  it('renders sets×reps @%ПМ and RIR chips', () => {
    render(<CycleLayoutView cycle={mkCycle()} />);
    expect(screen.getByText('4×6 @68% · RIR 2')).toBeTruthy();
    expect(screen.getByText('3×6 @45%')).toBeTruthy();
  });

  it('joins multiple set specs of one exercise with "+"', () => {
    const c = mkCycle({
      week1: [{ exercises: [
        { name: 'Жим', group: 'ЖМ', coef: 1, mnosz: 1, sets: [{ pct: 0.6, reps: 5, sets: 2 }, { pct: 0.7, reps: 5, sets: 2 }] },
      ] }],
    });
    render(<CycleLayoutView cycle={c} />);
    expect(screen.getByText('2×5 @60% + 2×5 @70%')).toBeTruthy();
  });

  it('renders the explicit weeks selector and switches week layouts', () => {
    const c = mkCycle({
      weeks: [
        [{ exercises: [{ name: 'Неделя-1-упр', group: 'ПР', coef: 1, mnosz: 1, sets: [{ pct: 0.6, reps: 5, sets: 3 }] }] }],
        [{ exercises: [{ name: 'Неделя-2-упр', group: 'ПР', coef: 1, mnosz: 1, sets: [{ pct: 0.7, reps: 4, sets: 3 }] }] }],
      ],
    });
    render(<CycleLayoutView cycle={c} />);
    expect(screen.getByText('Неделя 1')).toBeTruthy();
    expect(screen.getByText('Неделя 2')).toBeTruthy();
    expect(screen.getByText('Неделя-1-упр')).toBeTruthy();
    fireEvent.click(screen.getByText('Неделя 2'));
    expect(screen.getByText('Неделя-2-упр')).toBeTruthy();
    expect(screen.queryByText('Неделя-1-упр')).toBeNull();
  });

  it('shows progression note when only week1 exists and cycle is longer', () => {
    render(<CycleLayoutView cycle={mkCycle()} />);
    expect(screen.getByText(/генерируются прогрессией/)).toBeTruthy();
  });

  it('resets week selection when the cycle id changes', () => {
    const weeks = [
      [{ exercises: [{ name: 'A1', group: 'ПР', coef: 1, mnosz: 1, sets: [{ pct: 0.6, reps: 5, sets: 3 }] }] }],
      [{ exercises: [{ name: 'A2', group: 'ПР', coef: 1, mnosz: 1, sets: [{ pct: 0.7, reps: 4, sets: 3 }] }] }],
    ];
    const { rerender } = render(<CycleLayoutView cycle={mkCycle({ weeks, meta: { ...mkCycle().meta } })} />);
    fireEvent.click(screen.getByText('Неделя 2'));
    expect(screen.getByText('A2')).toBeTruthy();
    rerender(<CycleLayoutView cycle={mkCycle({ weeks: [[{ exercises: [{ name: 'B1', group: 'ПР', coef: 1, mnosz: 1, sets: [{ pct: 0.6, reps: 5, sets: 3 }] }] }], weeks[1]], meta: { ...mkCycle().meta, id: 'test-cycle-2' } })} />);
    expect(screen.getByText('B1')).toBeTruthy();
    expect(screen.queryByText('A2')).toBeNull();
  });

  it('handles cycles without any day layout gracefully', () => {
    const c = mkCycle({ week1: [] });
    render(<CycleLayoutView cycle={c} />);
    expect(screen.getByText(/не задана/)).toBeTruthy();
  });

  it('renders layouts for every cycle in the library without throwing', () => {
    for (const cycle of LMS_CYCLES) {
      render(<CycleLayoutView cycle={cycle} />);
    }
  });
});
