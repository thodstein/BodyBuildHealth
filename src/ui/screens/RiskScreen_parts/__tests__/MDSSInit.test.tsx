/**
 * MDSSInit.test.tsx — guard на баг: tWeeks и генетика инициализировались
 * один раз при маунте, а курс/профиль подгружаются из IndexedDB позже →
 * MDSS считал с дефолтами (4 нед, без генетики) при живом курсе.
 * После фикса — подхват по прибытии данных, ручной ввод не затирается.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';

let mockCourse: any[] = [];
let mockProfile: any = { settings: {} };
const stableLabs: any[] = [];

vi.mock('../../../../core/data-link', () => ({
  useDataLink: () => ({
    profile: mockProfile,
    labs: stableLabs,
    course: mockCourse,
  }),
  notifyDataChange: () => {},
}));

import { MDSSRiskDisplay } from '../../RiskScreen';

afterEach(() => {
  cleanup();
  mockCourse = [];
  mockProfile = { settings: {} };
});

function runAnalysis(container: HTMLElement) {
  fireEvent.click(
    Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Запустить анализ'),
    ) as HTMLElement,
  );
}

describe('MDSSRiskDisplay late data', () => {
  it('1. курс, приехавший после маунта, подтягивает недели (4 → 12)', async () => {
    const { container, rerender } = render(<MDSSRiskDisplay />);
    runAnalysis(container);
    await waitFor(() => {
      expect(
        container.querySelector('input[type="number"]'),
      ).not.toBeNull();
    });
    const weeks = () =>
      (container.querySelector('input[type="number"]') as HTMLInputElement)
        .value;
    expect(weeks()).toBe('4');
    mockCourse = [
      { substanceId: 'x', doseValue: 100, startWeek: 0, endWeek: 12 },
    ];
    rerender(<MDSSRiskDisplay />);
    await waitFor(() => {
      expect(weeks()).toBe('12');
    });
  });

  it('2. ручной ввод недель не затирается прибывшим курсом', async () => {
    const { container, rerender } = render(<MDSSRiskDisplay />);
    runAnalysis(container);
    await waitFor(() => {
      expect(
        container.querySelector('input[type="number"]'),
      ).not.toBeNull();
    });
    const input = container.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '20' } });
    expect(input.value).toBe('20');
    mockCourse = [
      { substanceId: 'x', doseValue: 100, startWeek: 0, endWeek: 16 },
    ];
    rerender(<MDSSRiskDisplay />);
    expect(
      (container.querySelector('input[type="number"]') as HTMLInputElement)
        .value,
    ).toBe('20');
  });

  it('3. генетика из профиля подхватывается после маунта', async () => {
    const { container, rerender } = render(<MDSSRiskDisplay />);
    runAnalysis(container);
    await waitFor(() => {
      expect(
        container.querySelector('input[type="text"]'),
      ).not.toBeNull();
    });
    expect(
      (container.querySelector('input[type="text"]') as HTMLInputElement).value,
    ).toBe('');
    mockProfile = { settings: { genetics: { COMT_slow: true } } };
    rerender(<MDSSRiskDisplay />);
    await waitFor(() => {
      expect(
        (container.querySelector('input[type="text"]') as HTMLInputElement)
          .value,
      ).toBe('COMT_slow');
    });
  });
});
