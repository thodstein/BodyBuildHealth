/**
 * cardio-diary-slot.test.tsx — автономный кардио-слой дня:
 * без активного цикла — пустое состояние; с активным — план/факт.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { CardioDiarySlot } from '../CardioDiarySlot';
import { buildCardioCycleFromTemplateId } from '../../../../engines/lms/cardio-templates.engine';
import { saveCardioCycle, setActiveCardioCycle } from '../../../../engines/lms/cardio.engine';

const CYCLES_KEY = 'he_cardio_cycles';
const ACTIVE_KEY = 'he_active_cardio_cycle';
const LOG_KEY = 'he_cardio_sessions';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(LOG_KEY);
  } catch { /* ignore */ }
});

describe('CardioDiarySlot', () => {
  afterEach(() => {
    try { vi.useRealTimers(); } catch { /* ignore */ }
  });

  it('без активного цикла — пустое состояние', () => {
    const { container } = render(<CardioDiarySlot />);
    expect(container.textContent).toContain('Нет активного цикла');
  });

  it('с активным циклом — план сегодня + факт 0', () => {
    // Date-флейк: C25K тренируется только Пн/Ср/Пт — фиксируем «сегодня» на понедельник.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0));
    try {
      const c = buildCardioCycleFromTemplateId('cardio-run-c25k-9', {})!;
      saveCardioCycle(c);
      setActiveCardioCycle(c);
      const { container } = render(<CardioDiarySlot />);
      expect(container.querySelector('[data-testid="cardio-diary-slot"]')).not.toBeNull();
      expect(container.textContent).toContain('Кардио сегодня');
      expect(container.textContent).toContain('План:');
      expect(screen.getByText(/факт: 0 мин/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
