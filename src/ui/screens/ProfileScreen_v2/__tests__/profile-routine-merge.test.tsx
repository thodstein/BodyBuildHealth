/**
 * profile-routine-merge.test.tsx — рутинг v2 (утро/вечер, ЧСС в записях АД),
 * миграция legacy, мерж записи здоровья при quick-add.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ROUTINE_STEPS,
  routineNextStep,
  routineStepIndex,
  migrateLegacyRoutine,
  ROUTINE_STEP_LABELS,
  ROUTINE_KIND_LABELS,
} from '../diary-modals';
import { mergeHealthEntry } from '../../../../engines/health-diary.engine';
import { ProfileDiariesTab } from '../ProfileDiariesTab';

describe('Рутинг v2 — шаги (ЧСС ведётся в АД)', () => {
  it('утренний: сон → АД (с ЧСС) → вес → здоровье → конец', () => {
    expect(ROUTINE_STEPS.morning).toEqual(['sleep', 'bp', 'weight', 'health']);
    expect(routineNextStep('morning', 'sleep')).toBe('bp');
    expect(routineNextStep('morning', 'bp')).toBe('weight');
    expect(routineNextStep('morning', 'weight')).toBe('health');
    expect(routineNextStep('morning', 'health')).toBeNull();
  });

  it('вечерний: АД (с ЧСС) → конец', () => {
    expect(ROUTINE_STEPS.evening).toEqual(['bp']);
    expect(routineNextStep('evening', 'bp')).toBeNull();
  });

  it('routineStepIndex и лейблы', () => {
    expect(routineStepIndex('morning', 'bp')).toBe(1);
    expect(ROUTINE_STEP_LABELS.bp).toBe('Давление и ЧСС');
    expect(ROUTINE_KIND_LABELS.morning).toBe('Утренний лог');
    expect(ROUTINE_KIND_LABELS.evening).toBe('Вечерний лог');
  });
});

describe('migrateLegacyRoutine — миграция sessionStorage', () => {
  it('legacy-значения (sleep/bp/weight) → утренний рутинг', () => {
    expect(migrateLegacyRoutine('sleep')).toEqual({ kind: 'morning', step: 'sleep' });
    expect(migrateLegacyRoutine('bp')).toEqual({ kind: 'morning', step: 'bp' });
    expect(migrateLegacyRoutine('weight')).toEqual({ kind: 'morning', step: 'weight' });
  });

  it('v2 JSON восстанавливается; мусор → null', () => {
    expect(migrateLegacyRoutine(JSON.stringify({ kind: 'evening', step: 'bp' }))).toEqual({
      kind: 'evening',
      step: 'bp',
    });
    expect(migrateLegacyRoutine(JSON.stringify({ kind: 'night', step: 'x' }))).toBeNull();
    expect(migrateLegacyRoutine(null)).toBeNull();
    expect(migrateLegacyRoutine('garbage')).toBeNull();
  });
});

describe('mergeHealthEntry — мерж quick-add с записью дня', () => {
  const existing = {
    date: '2026-08-15',
    pain: { zones: { shoulders: 5, knees: 3 }, totalScore: 8 },
    symptoms: [{ id: 's1', name: 'Головная боль', severity: 3 as const }],
    neuro: null,
    acne: null,
    hemato: null,
    notes: 'боль с 3D-карты',
  };

  it('нейро-ввод не затирает боль и симптомы', () => {
    const merged = mergeHealthEntry(existing as any, {
      date: '2026-08-15',
      pain: null,
      symptoms: [],
      neuro: { symptoms: { anxiety: true }, totalScore: 1 },
      acne: null,
      hemato: null,
      notes: '',
    });
    expect(merged.pain?.totalScore).toBe(8);
    expect(merged.symptoms.length).toBe(1);
    expect(merged.neuro?.totalScore).toBe(1);
  });

  it('zones объединяются, totalScore пересчитывается', () => {
    const merged = mergeHealthEntry(existing as any, {
      date: '2026-08-15',
      pain: { zones: { knees: 7 }, totalScore: 7 },
      symptoms: [],
      neuro: null,
      acne: null,
      hemato: null,
      notes: '',
    });
    expect(merged.pain?.zones).toEqual({ shoulders: 5, knees: 7 });
    expect(merged.pain?.totalScore).toBe(12);
  });

  it('симптомы дедуплицируются по имени, новые добавляются', () => {
    const merged = mergeHealthEntry(existing as any, {
      date: '2026-08-15',
      pain: null,
      symptoms: [
        { id: 's2', name: 'Головная боль', severity: 5 as const },
        { id: 's3', name: 'Тошнота', severity: 2 as const },
      ],
      neuro: null,
      acne: null,
      hemato: null,
      notes: '',
    });
    expect(merged.symptoms.map((s: any) => s.name)).toEqual(['Головная боль', 'Тошнота']);
    expect(merged.symptoms[0].severity).toBe(5); // новое значение побеждает
  });

  it('нет существующей записи → ввод как есть (с id/датами)', () => {
    const merged = mergeHealthEntry(null, {
      date: '2026-08-15',
      pain: null,
      symptoms: [],
      neuro: null,
      acne: null,
      hemato: null,
      notes: 'x',
    });
    expect(merged.date).toBe('2026-08-15');
    expect(merged.notes).toBe('x');
  });
});

describe('ProfileDiariesTab — рутинг с ЧСС в АД', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.confirm = () => true;
  });

  it('кнопки рутинга присутствуют: утренний и вечерний лог', () => {
    render(<ProfileDiariesTab />);
    expect(screen.getByText(/Утренний лог: сон → АД \(с ЧСС\) → вес → здоровье/)).toBeTruthy();
    expect(screen.getByText(/Вечерний лог: АД \(с ЧСС\)/)).toBeTruthy();
  });

  it('вечерний рутинг: АД сохраняется с timeOfDay=evening и ЧСС', () => {
    render(<ProfileDiariesTab />);
    fireEvent.click(screen.getByText(/Вечерний лог: АД \(с ЧСС\)/));
    expect(screen.getByText('Запись давления')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    const bp = JSON.parse(localStorage.getItem('he_bp_diary') || '[]');
    expect(bp.length).toBe(1);
    expect(bp[0].timeOfDay).toBe('evening');
    expect(Number(bp[0].hr)).toBeGreaterThan(0);
  });

  it('утренний рутинг: сон → АД (утро) → вес → здоровье', () => {
    render(<ProfileDiariesTab />);
    fireEvent.click(screen.getByText(/Утренний лог: сон → АД \(с ЧСС\) → вес → здоровье/));
    expect(screen.getByText('Запись сна')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    // Шаг АД (утро)
    expect(screen.getByText('Запись давления')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    // Шаг веса
    expect(screen.getByText('Вес и замеры тела')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    // Шаг здоровья
    expect(screen.getByText('Запись здоровья')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Нейро/ }));
    fireEvent.click(screen.getByRole('button', { name: /Тревожность/ }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    const bp = JSON.parse(localStorage.getItem('he_bp_diary') || '[]');
    expect(bp.length).toBe(1);
    expect(bp[0].timeOfDay).toBe('morning');
    expect(Number(bp[0].hr)).toBeGreaterThan(0);
    // Рутинг завершён — кнопки запуска снова видны
    expect(screen.getByText(/Утренний лог: сон → АД \(с ЧСС\) → вес → здоровье/)).toBeTruthy();
  });
});
