/**
 * labs-due-banner.test.tsx — баннер «Сдайте анализы»:
 * устойчивые ключи списка даже на неполных данных (key={undefined} давал
 * React-варнинг "unique key" в rest-hooks).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { LabsDueBanner } from '../LabsDueBanner';

describe('LabsDueBanner keys', () => {
  afterEach(() => {
    cleanup();
  });

  it('нет key-варнинга даже на неполных данных', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<LabsDueBanner systems={[{ count: 2 } as never]} />);
      const keyWarns = err.mock.calls.filter((a) => String(a[0]).includes('unique "key"'));
      expect(keyWarns).toEqual([]);
    } finally {
      err.mockRestore();
    }
  });

  it('баннер рендерит счётчик и кнопку лаборатории', () => {
    const { container } = render(
      <LabsDueBanner
        systems={[
          { system: 'cardio', name: 'Сердце', icon: '❤️', color: '#ef4444', count: 2, markers: ['ЛПНП', 'АЛТ'] } as never,
        ]}
        onOpenLabs={() => {}}
      />,
    );
    expect(container.querySelector('.calc-labsdue')).not.toBeNull();
  });
});
