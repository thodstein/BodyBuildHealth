/**
 * volume-diary-import.test.tsx — К2: импорт дневника обогащает 1RM базлайнами профиля.
 * Без обогащения тяжёлые сеты дневника считались бы от дефолта 100 (heavy-детект врал бы).
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { VolumeOptimizerTab } from '../VolumeOptimizerTab';

vi.mock('../../../../core/data-link', () => ({
  useDataLink: () => ({
    profile: {
      settings: {
        trainingLevel: 'intermediate',
        strengthBaselines: { bench_bar: 120 },
        training: {},
      },
    },
  }),
}));

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

describe('volume diary import: 1RM из базлайнов профиля', () => {
  it('жим 100 при базлайне 120 (83%) — НЕ тяжёлый; без базлайна был бы тяжёлым', () => {
    localStorage.setItem('he_workout_log_v1', JSON.stringify([
      { date: todayISO(), exercises: [{ exerciseId: 'bench_bar', sets: [{ weightKg: 100, reps: 8, rpe: 8 }] }] },
    ]));
    render(<VolumeOptimizerTab />);
    fireEvent.click(screen.getByText('📥 Из дневника (7д)'));
    expect(screen.getByText(/Импорт: 1 строк/)).toBeTruthy();
    // 100/120 = 83% < 85% → тяжёлого компаунда 0 (без обогащения было бы 100/100 → 1)
    expect(screen.getByText(/Тяж\. компаунд: 0/).parentElement?.textContent).toContain('0');
  });
});
