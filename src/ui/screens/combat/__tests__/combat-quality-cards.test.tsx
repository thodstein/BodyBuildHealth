/**
 * combat-quality-cards.test.tsx — кросс-мезо и дневник видны в UI:
 * CbMesoCard (мёртвый summary оживлён), CbDiaryCard (тренды/бейджи).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CbMesoCard, CbDiaryCard } from '../CombatPlanView';

const prev = {
  id: 'p1', discipline: 'mma', weeks: 4, patternId: 'combat_3',
  inputSnapshot: { workMaxByExercise: { bench_bar: 80 } },
} as any;

describe('combat quality cards', () => {
  it('мезо без прошлого — первый цикл', () => {
    render(<CbMesoCard prev={null} nextInput={{}} />);
    expect(screen.getByText('Кросс-мезоцикл')).toBeTruthy();
    expect(document.body.textContent).toContain('Первый мезоцикл');
  });

  it('мезо с прошлым — дельты весов', () => {
    render(<CbMesoCard prev={prev} nextInput={{ workMaxByExercise: { bench_bar: 82.5 } }} />);
    expect(document.body.textContent).toContain('80 → 82.5');
  });

  it('дневник без данных — ничего', () => {
    const { container } = render(<CbDiaryCard trends={null} />);
    expect(container.textContent).toBe('');
  });

  it('дневник с трендами — чипы и бейджи', () => {
    render(
      <CbDiaryCard
        trends={[
          { group: 'neck', changePct: -8, recentMax: 90, prevMax: 98 },
          { group: 'grip', changePct: 5, recentMax: 105, prevMax: 100 },
        ]}
      />,
    );
    expect(screen.getByText('Дневник — тренды групп')).toBeTruthy();
    expect(document.body.textContent).toContain('Шея');
    expect(document.body.textContent).toContain('слабо');
    expect(document.body.textContent).toContain('рост');
  });
});
