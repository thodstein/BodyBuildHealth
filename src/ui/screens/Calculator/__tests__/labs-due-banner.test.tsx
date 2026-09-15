/**
 * labs-due-banner.test.tsx — баннер «Сдайте анализы»:
 * устойчивые ключи списка даже на неполных данных (key={undefined} давал
 * React-варнинг "unique key" в rest-hooks).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { LabsDueBanner } from '../LabsDueBanner';

describe('LabsDueBanner keys', () => {
  beforeEach(() => {
    try { localStorage.removeItem('he_calc_labs_banner_pinned'); } catch { /* noop */ }
  });
  afterEach(() => {
    cleanup();
    try { localStorage.removeItem('he_calc_labs_banner_pinned'); } catch { /* noop */ }
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

  it('закреплена по умолчанию: sticky под шапкой', () => {
    const { container } = render(
      <LabsDueBanner
        systems={[
          { system: 'cardio', name: 'Сердце', icon: '❤️', color: '#ef4444', count: 2, markers: ['ЛПНП'] } as never,
        ]}
      />,
    );
    const root = container.querySelector('.calc-labsdue') as HTMLElement;
    expect(root?.dataset?.labsdue).toBe('pinned');
    expect(root?.style?.position).toBe('sticky');
    expect(root?.style?.top).toContain('56px');
  });

  it('кнопка 📌 открепляет и персистит выбор', () => {
    const { container, getByLabelText } = render(
      <LabsDueBanner
        systems={[
          { system: 'cardio', name: 'Сердце', icon: '❤️', color: '#ef4444', count: 2, markers: ['ЛПНП'] } as never,
        ]}
      />,
    );
    fireEvent.click(getByLabelText('Открепить карточку анализов'));
    const root = container.querySelector('.calc-labsdue') as HTMLElement;
    expect(root?.dataset?.labsdue).toBe('unpinned');
    expect(root?.style?.position).toBe('static');
    expect(getByLabelText('Закрепить карточку анализов')).toBeTruthy();
    try { expect(localStorage.getItem('he_calc_labs_banner_pinned')).toBe('0'); } catch { /* noop */ }
  });
});
