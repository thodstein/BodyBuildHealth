/**
 * profile-routine-merge.test.tsx — рутинг v2 (утро/вечер), миграция legacy,
 * мерж записи здоровья при quick-add.
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
import { AddPulseModal } from '../pulse-diary-modal';
import { ProfileDiariesTab } from '../ProfileDiariesTab';
import { HR_DIARY_KEY } from '../../../../engines/hr-diary.engine';

describe('Рутинг v2 — шаги', () => {
  it('утренний: сон → АД → ЧСС → вес → здоровье → конец', () => {
    expect(ROUTINE_STEPS.morning).toEqual(['sleep', 'bp', 'pulse', 'weight', 'health']);
    expect(routineNextStep('morning', 'sleep')).toBe('bp');
    expect(routineNextStep('morning', 'bp')).toBe('pulse');
    expect(routineNextStep('morning', 'pulse')).toBe('weight');
    expect(routineNextStep('morning', 'weight')).toBe('health');
    expect(routineNextStep('morning', 'health')).toBeNull();
  });

  it('вечерний: АД → ЧСС → конец', () => {
    expect(ROUTINE_STEPS.evening).toEqual(['bp', 'pulse']);
    expect(routineNextStep('evening', 'bp')).toBe('pulse');
    expect(routineNextStep('evening', 'pulse')).toBeNull();
  });

  it('routineStepIndex и лейблы', () => {
    expect(routineStepIndex('morning', 'pulse')).toBe(2);
    expect(ROUTINE_STEP_LABELS.pulse).toBe('ЧСС');
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
    expect(migrateLegacyRoutine(JSON.stringify({ kind: 'evening', step: 'pulse' }))).toEqual({
      kind: 'evening',
      step: 'pulse',
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

describe('AddPulseModal — базовая функциональность', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('рендерит форму ЧСС, пресет вечера применяется', () => {
    render(<AddPulseModal open onClose={() => {}} onSave={() => {}} presetTimeOfDay="evening" />);
    expect(screen.getByText('Запись ЧСС')).toBeTruthy();
    expect(screen.getByText('🌆 Вечер (в покое)')).toBeTruthy();
  });

  it('сохранение передаёт bpm и timeOfDay', () => {
    let saved: any = null;
    render(<AddPulseModal open onClose={() => {}} onSave={(e: any) => { saved = e; }} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '62' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    expect(saved).toMatchObject({ bpm: 62, timeOfDay: 'morning' });
  });
});

describe('ProfileDiariesTab — вечерний рутинг с ЧСС', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.confirm = () => true;
  });

  it('кнопки рутинга присутствуют: утренний и вечерний лог', () => {
    render(<ProfileDiariesTab />);
    expect(screen.getByText(/Утренний лог: сон → АД → ЧСС → вес → здоровье/)).toBeTruthy();
    expect(screen.getByText(/Вечерний лог: АД → ЧСС/)).toBeTruthy();
  });

  it('запуск вечернего рутинга → модалка АД, после сохранения → ЧСС', () => {
    render(<ProfileDiariesTab />);
    fireEvent.click(screen.getByText(/Вечерний лог: АД → ЧСС/));
    // Модалка АД открыта (заголовок «Запись давления»)
    expect(screen.getByText('Запись давления')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    // Шаг ЧСС: модалка «Запись ЧСС» с пресетом вечера
    expect(screen.getByText('Запись ЧСС')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    // Рутинг завершён: ЧСС сохранён в he_hr_diary
    const hr = JSON.parse(localStorage.getItem(HR_DIARY_KEY) || '[]');
    expect(hr.length).toBe(1);
    expect(hr[0].timeOfDay).toBe('evening');
  });
});
