/**
 * lab-generator-honest-weight.test.tsx — Epic B: генератор Шага 1 не выдумывает кг.
 * Без базы в профиле — «—» + честное предупреждение; с базой — кг из профиля.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PrescriptionTab from '../ExerciseLabPrescription';

const PROFILE_KEY = 'he_profile_v2';

function seedProfile(settings: Record<string, unknown>) {
  const raw = localStorage.getItem(PROFILE_KEY);
  let base: Record<string, unknown> = {};
  try {
    base = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    base = {};
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...base, settings }));
}

describe('lab-generator-honest-weight', () => {
  beforeEach(() => {
    localStorage.removeItem(PROFILE_KEY);
  });

  it('без базы в профиле: веса «—» + предупреждение, выдуманных кг нет', async () => {
    seedProfile({});
    render(<PrescriptionTab />);
    // Генератор считает в useEffect — ждём строки таблицы.
    await waitFor(() => {
      expect(screen.getByText('Вес')).toBeTruthy();
    });
    const dashes = screen.getAllByText('—');
    // Хотя бы одна ячейка веса — прочерк (5 строк генератора без базы).
    expect(dashes.length).toBeGreaterThanOrEqual(5);
    expect(
      screen.getByText(/Примерные кг не показываем/),
    ).toBeTruthy();
  });

  it('с полной базой в профиле: все строки с кг, предупреждения нет', async () => {
    seedProfile({
      training: {
        workMax: { chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60 },
      },
    });
    render(<PrescriptionTab />);
    await waitFor(() => {
      expect(screen.getByText('Вес')).toBeTruthy();
    });
    // Все 5 строк генератора — с кг из профиля, честного предупреждения нет.
    expect(screen.queryByText(/Примерные кг не показываем/)).toBeNull();
    const kgCells = screen.getAllByText(/^\d+(\.\d+)? кг$/);
    expect(kgCells.length).toBeGreaterThanOrEqual(5);
  });
});
