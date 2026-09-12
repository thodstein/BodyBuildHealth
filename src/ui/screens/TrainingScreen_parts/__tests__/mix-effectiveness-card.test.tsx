/** mix-effectiveness-card.test.tsx — smoke-тест карточки «🎯 Эффективность миксов»:
 *  рендер с данными (RPE/объём в дни с миксом и без), пустое состояние без данных. */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MixEffectivenessCard } from '../MixEffectivenessCard';

beforeEach(() => {
  localStorage.clear();
});

describe('MixEffectivenessCard', () => {
  // PRO: min 5/группу — честный порог вместо «1 vs 1» (эпик F, re-baseline осознанно)
  it('показывает честный недобор вместо пустоты', () => {
    const { container } = render(<MixEffectivenessCard workouts={[]} />);
    expect(container.innerHTML).toContain('Нужно ≥5 сессий');
  });

  it('1 vs 1 — недобор, а не «вывод»', () => {
    localStorage.setItem('he_support_diary', JSON.stringify([
      { date: '2026-08-10', mixIntake: { mix_1: { pre: true } } },
      { date: '2026-08-12', mixIntake: {} },
    ]));
    render(<MixEffectivenessCard workouts={[
      { date: '2026-08-10', overallRPE: 8, duration: 70, exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-12', overallRPE: 6, duration: 55, exercises: [{ totalVolume: 9000 }] },
    ]} />);
    expect(screen.getByText('🎯 Эффективность миксов')).toBeTruthy();
    expect(screen.getByText(/Нужно ≥5 сессий/)).toBeTruthy();
  });

  it('5 vs 5 — показывает сравнение', () => {
    const diary = [10, 11, 12, 13, 14].map(d => ({ date: `2026-08-${d}`, mixIntake: { mix_1: { pre: true } } }));
    diary.push({ date: '2026-08-20', mixIntake: {} } as any, { date: '2026-08-21', mixIntake: {} } as any, { date: '2026-08-22', mixIntake: {} } as any, { date: '2026-08-23', mixIntake: {} } as any, { date: '2026-08-24', mixIntake: {} } as any);
    localStorage.setItem('he_support_diary', JSON.stringify(diary));
    render(<MixEffectivenessCard workouts={[
      { date: '2026-08-10', overallRPE: 8, duration: 70, exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-11', overallRPE: 8, duration: 70, exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-12', overallRPE: 8, duration: 70, exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-13', overallRPE: 8, duration: 70, exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-14', overallRPE: 8, duration: 70, exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-20', overallRPE: 6, duration: 55, exercises: [{ totalVolume: 9000 }] },
      { date: '2026-08-21', overallRPE: 6, duration: 55, exercises: [{ totalVolume: 9000 }] },
      { date: '2026-08-22', overallRPE: 6, duration: 55, exercises: [{ totalVolume: 9000 }] },
      { date: '2026-08-23', overallRPE: 6, duration: 55, exercises: [{ totalVolume: 9000 }] },
      { date: '2026-08-24', overallRPE: 6, duration: 55, exercises: [{ totalVolume: 9000 }] },
    ]} />);
    expect(screen.getByText('RPE 8')).toBeTruthy();
    expect(screen.getByText('RPE 6')).toBeTruthy();
    expect(screen.getByText(/объём выше на/)).toBeTruthy();
    expect(screen.getByText(/сессий с миксом: 5, без: 5/)).toBeTruthy();
  });

  it('показывает селектор цели, когда тренировки несут goal', () => {
    const diary = [10, 11, 12, 13, 14].map(d => ({ date: `2026-08-${d}`, mixIntake: { mix_1: { pre: true } } }));
    diary.push({ date: '2026-08-20', mixIntake: {} } as any, { date: '2026-08-21', mixIntake: {} } as any, { date: '2026-08-22', mixIntake: {} } as any, { date: '2026-08-23', mixIntake: {} } as any, { date: '2026-08-24', mixIntake: {} } as any);
    localStorage.setItem('he_support_diary', JSON.stringify(diary));
    render(<MixEffectivenessCard workouts={[
      { date: '2026-08-10', overallRPE: 8, goal: 'pump', exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-11', overallRPE: 8, goal: 'pump', exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-12', overallRPE: 8, goal: 'pump', exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-13', overallRPE: 8, goal: 'pump', exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-14', overallRPE: 8, goal: 'pump', exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-20', overallRPE: 6, exercises: [{ totalVolume: 9000 }] },
      { date: '2026-08-21', overallRPE: 6, exercises: [{ totalVolume: 9000 }] },
      { date: '2026-08-22', overallRPE: 6, exercises: [{ totalVolume: 9000 }] },
      { date: '2026-08-23', overallRPE: 6, exercises: [{ totalVolume: 9000 }] },
      { date: '2026-08-24', overallRPE: 6, exercises: [{ totalVolume: 9000 }] },
    ]} />);
    expect(screen.getByLabelText(/Фильтр эффективности по цели/)).toBeTruthy();
  });

  it('устойчив к битому дневнику поддержки', () => {
    localStorage.setItem('he_support_diary', '{{{');
    render(<MixEffectivenessCard workouts={[
      { date: '2026-08-10', overallRPE: 8, exercises: [{ totalVolume: 12000 }] },
      { date: '2026-08-12', overallRPE: 6, exercises: [{ totalVolume: 9000 }] },
    ]} />);
    expect(screen.getByText(/Нужно ≥5 сессий/)).toBeTruthy();
  });
});
