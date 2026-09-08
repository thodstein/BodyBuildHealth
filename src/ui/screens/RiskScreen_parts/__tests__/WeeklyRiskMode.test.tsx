/**
 * WeeklyRiskMode.test.tsx — guard на баг: тоггл «Средний/Понедельно» был
 * мёртвым (обе ветки рисовали одни точки). После фикса «Средний» показывает
 * нарастающее среднее: недели [10, 30, 60] → на нед.3 среднее 33%.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { WeeklyRiskChart } from '../WeeklyRiskChart';

afterEach(() => {
  cleanup();
});

function point(week: number, net: number) {
  return {
    week,
    overallRaw: net,
    overallNet: net,
    systemBreakdown: {},
    activeDrugs: [],
    peakConcentration: 0,
    accumulationPhase: 'steady' as const,
  };
}

const DYNAMICS = {
  weeks: [point(1, 10), point(2, 30), point(3, 60)],
  courseDuration: 3,
} as any;

describe('WeeklyRiskChart mode', () => {
  it('1. понедельно — сырые значения (нед.3 → Net 60%)', () => {
    const { container } = render(
      <WeeklyRiskChart
        dynamics={DYNAMICS}
        selectedWeek={2}
        onWeekSelect={() => {}}
        mode="week"
        onModeChange={() => {}}
      />,
    );
    expect(container.textContent).toContain('Net: 60%');
  });

  it('2. средний — нарастающее среднее (нед.3 → Net 33% + пометка)', () => {
    const { container } = render(
      <WeeklyRiskChart
        dynamics={DYNAMICS}
        selectedWeek={2}
        onWeekSelect={() => {}}
        mode="average"
        onModeChange={() => {}}
      />,
    );
    expect(container.textContent).toContain('Net: 33%');
    expect(container.textContent).toContain('среднее');
  });

  it('3. точки короткого курса (3 нед) ведут на 0/1/2 без дублей', () => {
    const fn = vi.fn();
    const { container } = render(
      <WeeklyRiskChart
        dynamics={DYNAMICS}
        selectedWeek={0}
        onWeekSelect={fn}
        mode="week"
        onModeChange={() => {}}
      />,
    );
    const dots = Array.from(container.querySelectorAll('span')).filter(
      (s) => (s as HTMLElement).style.borderRadius === '50%',
    );
    expect(dots.length).toBe(3);
    fireEvent.click(dots[2] as HTMLElement);
    expect(fn).toHaveBeenCalledWith(2);
  });

  it('4. выбранная дальняя неделя при ужатом курсе клампится (10 → нед.3)', () => {
    const { container } = render(
      <WeeklyRiskChart
        dynamics={DYNAMICS}
        selectedWeek={10}
        onWeekSelect={() => {}}
        mode="week"
        onModeChange={() => {}}
      />,
    );
    expect(container.textContent).toContain('Нед. 3');
  });

  it('5. точки доступны: role=button и подпись недели', () => {
    const { container } = render(
      <WeeklyRiskChart
        dynamics={DYNAMICS}
        selectedWeek={0}
        onWeekSelect={() => {}}
        mode="week"
        onModeChange={() => {}}
      />,
    );
    const dots = Array.from(container.querySelectorAll('span')).filter(
      (s) => (s as HTMLElement).style.borderRadius === '50%',
    );
    expect(dots.length).toBe(3);
    for (const d of dots) {
      expect((d as HTMLElement).getAttribute('role')).toBe('button');
      expect((d as HTMLElement).getAttribute('aria-label')).toMatch(/Неделя \d/);
    }
  });
});
