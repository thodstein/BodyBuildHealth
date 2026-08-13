/** mix-effectiveness-card.test.tsx — smoke-тест карточки «🎯 Эффективность миксов»:
 *  рендер с данными (RPE/объём в дни с миксом и без), пустое состояние без данных. */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MixEffectivenessCard } from '../MixEffectivenessCard';

beforeEach(() => {
  localStorage.clear();
});

describe('MixEffectivenessCard', () => {
  it('не рендерится без тренировок', () => {
    const { container } = render(<MixEffectivenessCard workouts={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('показывает сравнение сессий с миксом и без', () => {
    localStorage.setItem('he_support_diary', JSON.stringify([
      { date: '2026-08-10', mixIntake: { mix_1: { pre: true } } },
      { date: '2026-08-12', mixIntake: {} },
    ]));
    render(<MixEffectivenessCard workouts={[
      { date: '2026-08-10', overallRPE: 8, duration: 70, exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-12', overallRPE: 6, duration: 55, exercises: [{ totalVolume: 9000 }] },
    ]} />);
    expect(screen.getByText('🎯 Эффективность миксов')).toBeTruthy();
    expect(screen.getByText('RPE 8')).toBeTruthy();
    expect(screen.getByText('RPE 6')).toBeTruthy();
    expect(screen.getByText(/объём выше на/)).toBeTruthy();
    expect(screen.getByText(/сессий с миксом: 1, без: 1/)).toBeTruthy();
  });

  it('устойчив к битому дневнику поддержки', () => {
    localStorage.setItem('he_support_diary', '{{{');
    const { container } = render(<MixEffectivenessCard workouts={[
      { date: '2026-08-10', overallRPE: 8, exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-12', overallRPE: 6, exercises: [{ totalVolume: 9000 }] },
    ]} />);
    expect(container.innerHTML).toBe('');
  });
});
