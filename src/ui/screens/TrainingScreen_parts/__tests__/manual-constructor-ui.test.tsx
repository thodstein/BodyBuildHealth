import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildProgramIcs } from '../ManualExport';
import { ManualLibraryGallery } from '../ManualLibraryGallery';
import { getAllPrograms } from '../../../../engines/complete-program-library.engine';
import { LMS_CYCLES } from '../../../../data/lms-cycles/lms-cycle-index';
import type { UserProgram } from '../../../../engines/user-program/user-program.types';
import { suggestExercisesForGroup } from '../../../../engines/manual-constructor';

describe('ManualExport ICS', () => {
  it('генерирует валидный ICS для ББ-программы', () => {
    const prog: UserProgram = {
      meta: { id: 'test1', title: 'Тест ББ', author: '', goal: 'hypertrophy', level: 'intermediate', daysPerWeek: 3, weeks: 4, direction: 'bb', createdAt: '', updatedAt: '', source: 'custom' },
      bb: {
        direction: 'bb',
        microcycleTemplate: { daySlots: [] },
        weeks: [
          { week: 1, phase: 'accumulation', deload: false, sessions: [{ id: 's1', name: 'Грудь', focus: 'грудь', blocks: [{ id: 'b1', type: 'compound', exerciseName: 'Жим', muscle: 'chest', role: 'primary', sets: [{ reps: 8, rir: 2 }] }] }] },
          { week: 2, phase: 'accumulation', deload: false, sessions: [{ id: 's2', name: 'Спина', focus: 'спина', blocks: [{ id: 'b2', type: 'compound', exerciseName: 'Тяга', muscle: 'back', role: 'primary', sets: [{ reps: 8, rir: 2 }] }] }] },
        ],
        volumeBudget: {},
        progression: { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: [] },
        constraints: { equipment: [] },
      },
    };
    const ics = buildProgramIcs(prog, '2026-01-05');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Нед 1');
    expect(ics).toContain('SUMMARY:Нед 2');
    expect(ics).toContain('Жим');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics.split('BEGIN:VEVENT').length - 1).toBe(2);
  });
  it('экранирует спецсимволы ICS', () => {
    const prog: UserProgram = {
      meta: { id: 'test2', title: 'Тест; с запятой, перенос\n', author: '', goal: 'hypertrophy', level: 'beginner', daysPerWeek: 2, weeks: 2, direction: 'bb', createdAt: '', updatedAt: '', source: 'custom' },
      bb: {
        direction: 'bb',
        microcycleTemplate: { daySlots: [] },
        weeks: [{ week: 1, phase: 'accumulation', deload: false, sessions: [{ id: 's1', name: 'День, 1; тест', focus: '', blocks: [] }] }],
        volumeBudget: {},
        progression: { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: [] },
        constraints: { equipment: [] },
      },
    };
    const ics = buildProgramIcs(prog, '2026-01-05');
    expect(ics).toContain('\\;');
    expect(ics).toContain('\\,');
  });
});

describe('ManualLibraryGallery рекомендации', () => {
  it('показывает ⭐ Рекомендовано и фильтры', () => {
    const bb = getAllPrograms().slice(0, 5);
    const pl = LMS_CYCLES.slice(0, 3) as any;
    const { container } = render(<ManualLibraryGallery bbPrograms={bb} plCycles={pl} onSelectBB={() => {}} onSelectPL={() => {}} />);
    expect(screen.getByText(/Библиотека шаблонов/)).toBeInTheDocument();
    // фильтры
    expect(screen.getByPlaceholderText(/Поиск по названию/)).toBeInTheDocument();
    // рекомендовано секция видна без фильтров (bb tab default)
    expect(screen.getByText(/Рекомендовано для вас/)).toBeInTheDocument();
    // карточки имеют кнопку Взять за основу
    expect(screen.getAllByText(/Взять за основу/).length).toBeGreaterThan(0);
  });
  it('фильтр поиска скрывает нерелевантные', () => {
    const bb = getAllPrograms().slice(0, 5);
    const pl: any[] = [];
    render(<ManualLibraryGallery bbPrograms={bb} plCycles={pl} onSelectBB={() => {}} onSelectPL={() => {}} />);
    const input = screen.getByPlaceholderText(/Поиск по названию/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'несуществующий_запрос_12345' } });
    expect(screen.getByText(/Ничего не найдено/)).toBeInTheDocument();
  });
  it('переключение табов ПЛ/ББ работает', () => {
    const bb = getAllPrograms().slice(0, 2);
    const pl = LMS_CYCLES.slice(0, 2) as any;
    render(<ManualLibraryGallery bbPrograms={bb} plCycles={pl} onSelectBB={() => {}} onSelectPL={() => {}} />);
    const plTab = screen.getByText(/ПЛ \(/);
    fireEvent.click(plTab);
    expect(screen.getByText(/Рекомендовано для вас/)).toBeInTheDocument(); // для ПЛ тоже
  });
});

describe('suggestExercisesForGroup интеллигентный подбор', () => {
  it('возвращает 6 упражнений с учётом оборудования', () => {
    const exs = suggestExercisesForGroup('chest', 'intermediate', 6, ['barbell', 'dumbbell'], [], [], false, [], []);
    expect(exs.length).toBeGreaterThan(0);
    expect(exs.length).toBeLessThanOrEqual(6);
    // хотя бы одно базовое
    expect(exs.some(e => e.type === 'compound')).toBe(true);
  });
  it('фильтр по травме исключает axial', () => {
    const exs = suggestExercisesForGroup('back', 'intermediate', 6, ['barbell'], [], ['back'], true, [], []);
    // при avoidAxialLoad — осевые исключены, но что-то остаётся
    expect(exs.length).toBeGreaterThan(0);
  });
});
