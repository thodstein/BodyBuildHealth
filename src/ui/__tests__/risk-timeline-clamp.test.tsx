/**
 * risk-timeline-clamp.test.tsx — guard на баг: при пересборке таймлайна
 * короче выбранной недели маркер уезжал за график, а подпись врала
 * («Неделя: 12 / 4»). После фикса — кламп отображения (safeWeek).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { RiskTimelineChart } from '../screens/SupportScreen_parts/RiskTimelineChart';
import type { TimelineWeekData } from '../../engines/support-plan';

afterEach(() => {
  cleanup();
});

function week(n: number): TimelineWeekData {
  return {
    week: n,
    overallRaw: 10 + n,
    overallNet: 8 + n,
    organPercents: {},
    organAfterPercents: {},
    activeDrugs: [],
    drugConcentrations: {},
  } as TimelineWeekData;
}

const longTl = Array.from({ length: 12 }, (_, i) => week(i + 1));
const shortTl = Array.from({ length: 4 }, (_, i) => week(i + 1));

describe('RiskTimelineChart clamp', () => {
  it('1. укорочение таймлайна клампит неделю 12 → 4 везде', () => {
    const { container, rerender } = render(
      <RiskTimelineChart timeline={longTl} />,
    );
    const slider = container.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '12' } });
    expect(container.textContent).toContain('Неделя: 12 / 12');
    rerender(<RiskTimelineChart timeline={shortTl} />);
    expect(container.textContent).toContain('Неделя: 4 / 4');
    expect(container.textContent).toContain('на неделе 4');
    // Маркер внутри графика: при 4 неделях ширина 200, без клампа x1=640.
    const marker = container.querySelector('line[stroke="#00e68a"]');
    expect(marker).not.toBeNull();
    expect(Number(marker?.getAttribute('x1'))).toBeLessThanOrEqual(200);
  });
});
