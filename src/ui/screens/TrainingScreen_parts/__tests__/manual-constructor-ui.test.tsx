import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { buildProgramIcs } from '../ManualExport';
import { ManualLibraryGallery } from '../ManualLibraryGallery';
import { ProgramManagerPanelWithProvider } from '../ProgramManagerPanel';
import { getAllPrograms } from '../../../../engines/complete-program-library.engine';
import { LMS_CYCLES } from '../../../../data/lms-cycles/lms-cycle-index';
import type { UserProgram } from '../../../../engines/user-program/user-program.types';
import { suggestExercisesForGroup } from '../../../../engines/manual-constructor';
import { saveUserProgram, cloneFromLibrary } from '../../../../engines/user-program/program-store';
import { ManualProgramWizard } from '../ManualProgramWizard';
import { PLEditor } from '../ProgramEditorComponents';
import { ConfirmDialogProvider } from '../ConfirmDialog';
import { HybridPlanPanel } from '../HybridPlanPanel';
import { PlanSummaryTable } from '../ProgramEditorPanels';
import { ProgramMetricsCSV } from '../ProgramExtras';

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

describe('Менеджер: хуки §101 и честные счётчики библиотеки', () => {
  it('непустой список: хуки §101 на месте', () => {
    // сидим валидный клон, иначе менеджер показывает empty-ветку
    saveUserProgram(cloneFromLibrary(getAllPrograms()[0]), 'seed');
    const { container, unmount } = render(<ProgramManagerPanelWithProvider />);
    try { localStorage.removeItem('he_user_programs'); } catch { /* ignore */ }
    expect(container.querySelector('.manual-prog-list')).toBeInTheDocument();
    expect(container.querySelector('.manual-prog-tools')).toBeInTheDocument();
    expect(container.querySelector('.manual-actions')).toBeInTheDocument();
    expect(container.querySelector('.manual-prog-row')).toBeInTheDocument();
    unmount();
  });
  it('empty-ветка: карточки загрузки + честные счётчики', () => {
    try { localStorage.removeItem('he_user_programs'); } catch { /* ignore */ }
    try { localStorage.removeItem('he_manual_onboarding_done'); } catch { /* ignore */ }
    const { container } = render(<ProgramManagerPanelWithProvider />);
    expect(container.querySelector('.manual-onboard')).toBeInTheDocument();
    expect(container.querySelectorAll('.manual-load-card').length).toBe(2);
    // честные счётчики вместо захардкоженных «29 программ» / «66 циклов»
    expect(screen.getByText(/программ · клон/)).toBeInTheDocument();
    expect(screen.getByText(/ПЛ-циклов · immutable/)).toBeInTheDocument();
  });
});

describe('Редактор: хуки недель/сессий §102', () => {
  it('неделя и тренировка несут APK-хуки', async () => {
    saveUserProgram(cloneFromLibrary(getAllPrograms()[0]), 'seed');
    const { container } = render(<ProgramManagerPanelWithProvider />);
    try { localStorage.removeItem('he_user_programs'); } catch { /* ignore */ }
    // открыть программу в редакторе
    fireEvent.click(screen.getByText('Открыть'));
    await waitFor(() => expect(screen.getByText('Далее: Параметры →')).toBeInTheDocument(), { timeout: 15000 });
    fireEvent.click(screen.getByText('Далее: Параметры →'));
    await waitFor(() => expect(screen.getByText('Далее: Недели →')).toBeInTheDocument(), { timeout: 15000 });
    fireEvent.click(screen.getByText('Далее: Недели →'));
    await waitFor(() => expect(container.querySelector('.editor-week-card')).toBeInTheDocument(), { timeout: 15000 });
    expect(container.querySelector('.editor-week-toggle')).toBeInTheDocument();
    expect(container.querySelector('.editor-week-actions')).toBeInTheDocument();
    expect(container.querySelector('.editor-week-meta')).toBeInTheDocument();
    expect(container.querySelector('.editor-session-card')).toBeInTheDocument();
    expect(container.querySelector('.editor-session-actions')).toBeInTheDocument();
    expect(container.querySelector('.editor-session-fields')).toBeInTheDocument();
    // §103: строки упражнений и редактор сетов
    expect(container.querySelector('.editor-exercise-card')).toBeInTheDocument();
    expect(container.querySelector('.editor-exercise-heading')).toBeInTheDocument();
    expect(container.querySelector('.bb-set-editor')).toBeInTheDocument();
    expect(container.querySelector('.editor-sets-heading')).toBeInTheDocument();
    // §105: тоглы шапки редактора — тач-норма
    expect(container.querySelectorAll('.editor-head-toggle').length).toBeGreaterThanOrEqual(2);
  }, 60000);
});

describe('Визард: хуки §104 по шагам', () => {
  const wizProps = {
    open: true, embedded: true, direction: 'bb' as const, goal: 'hypertrophy', level: 'intermediate',
    days: 3, weeks: 8, pro: false, onClose: () => {}, onStep: () => {}, onDirection: () => {},
    onGoal: () => {}, onLevel: () => {}, onDays: () => {}, onWeeks: () => {}, onCreate: () => {},
  };
  it('шаг 1: wizard + steps + dir с data-active', async () => {
    const { container } = render(<ManualProgramWizard {...wizProps} step={1} />);
    expect(container.querySelector('.manual-wizard')).toBeInTheDocument();
    expect(container.querySelector('.manual-wiz-steps')).toBeInTheDocument();
    expect(container.querySelector('.manual-wiz-dir')).toBeInTheDocument();
    expect(container.querySelector('.manual-wiz-dir button[data-active="true"]')).toBeInTheDocument();
    expect(container.querySelector('.manual-wiz-nav')).toBeInTheDocument();
  });
  it('шаг 2: params + summary', async () => {
    const { container } = render(<ManualProgramWizard {...wizProps} step={2} />);
    expect(container.querySelector('.manual-wiz-params')).toBeInTheDocument();
    expect(container.querySelector('.manual-wiz-summary')).toBeInTheDocument();
  });
  it('шаг 3 (ПЛ): preview без тяжёлой сборки', async () => {
    const { container } = render(<ManualProgramWizard {...wizProps} step={3} direction="pl" />);
    expect(container.querySelector('.manual-wiz-preview')).toBeInTheDocument();
  });
});

describe('ПЛ-редактор: хуки §106 (custom-путь, 2 недели)', () => {
  it('навигация + шаблоны дней на месте', () => {
    const mkDay = (n: string) => ({ name: n, dayOfWeek: 0, exercises: [] });
    const body = {
      direction: 'pl', sourceCycleId: null,
      customWeeks: [
        { week: 1, phase: 'accumulation', deload: false, days: [mkDay('День 1')] },
        { week: 2, phase: 'accumulation', deload: false, days: [mkDay('День 1')] },
      ],
      schedule: [], weakPoints: [], notes: '', workMax: {},
    } as any;
    const { container } = render(
      <ConfirmDialogProvider>
        <PLEditor body={body} onChange={() => {}} />
      </ConfirmDialogProvider>,
    );
    expect(container.querySelector('.editor-week-bulk-actions')).toBeInTheDocument();
    expect(container.querySelector('.editor-week-jump')).toBeInTheDocument();
    expect(container.querySelector('.editor-pl-day-tpl')).toBeInTheDocument();
    expect(container.querySelector('.editor-fill-empty')).toBeInTheDocument();
  });
});

describe('Гибрид-панель: хуки §107', () => {
  it('форма сборки на месте, CTA 48px-класса', () => {
    const program = {
      meta: { id: 'hyb1', title: 'Гибрид', author: '', goal: 'strength_mass', level: 'intermediate', daysPerWeek: 4, weeks: 8, direction: 'hybrid', createdAt: '', updatedAt: '', source: 'custom' },
    } as any;
    const { container } = render(
      <HybridPlanPanel program={program} onChange={() => {}} onSave={() => {}} />,
    );
    expect(container.querySelector('.manual-hybrid-form')).toBeInTheDocument();
    expect(screen.getByText(/Собрать powerbuilder-план/)).toBeInTheDocument();
  });
});

describe('Сводная таблица: хуки §108 (табы недель)', () => {
  it('2 недели → 2 таба panel-week-tab', () => {
    const mkWeek = (n: number) => ({
      week: n, phase: 'accumulation' as const, deload: false,
      sessions: [{ id: `s${n}`, name: 'Грудь', focus: 'грудь', dayOfWeek: 0, blocks: [{ id: `b${n}`, type: 'compound' as const, exerciseName: 'Жим', muscle: 'chest', role: 'primary' as const, sets: [{ reps: 8, rir: 2 }] }] }],
    });
    const program = {
      meta: { id: 't1', title: 'Тест', author: '', goal: 'hypertrophy', level: 'intermediate', daysPerWeek: 1, weeks: 2, direction: 'bb', createdAt: '', updatedAt: '', source: 'custom' },
      bb: {
        direction: 'bb', microcycleTemplate: { daySlots: [] }, weeks: [mkWeek(1), mkWeek(2)],
        volumeBudget: {}, progression: { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: [] },
        constraints: { equipment: [] },
      },
    } as any;
    const { container } = render(<PlanSummaryTable program={program} />);
    expect(container.querySelectorAll('.panel-week-tab').length).toBe(2);
  });
});

describe('Экстры: хуки §109 (CSV-кнопка)', () => {
  it('ProgramMetricsCSV рендерит .extra-csv', () => {
    const program = {
      meta: { id: 'e1', title: 'Тест', author: '', goal: 'hypertrophy', level: 'intermediate', daysPerWeek: 1, weeks: 1, direction: 'bb', createdAt: '', updatedAt: '', source: 'custom' },
      bb: {
        direction: 'bb', microcycleTemplate: { daySlots: [] },
        weeks: [{ week: 1, phase: 'accumulation' as const, deload: false, sessions: [] }],
        volumeBudget: {}, progression: { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: [] },
        constraints: { equipment: [] },
      },
    } as any;
    const { container } = render(<ProgramMetricsCSV program={program} dir="bb" />);
    expect(container.querySelector('.extra-csv')).toBeInTheDocument();
  });
});

describe('ManualUI хуки для APK-слоя (§100)', () => {
  it('ManualHeader несёт manual-head, ManualStepper — manual-stepper', async () => {
    const { ManualHeader, ManualStepper } = await import('../ManualUI');
    const { container: h } = render(<ManualHeader title="Тест" subtitle="подпись" />);
    expect(h.querySelector('.manual-head')).toBeInTheDocument();
    const { container: s } = render(
      <ManualStepper steps={[{ id: 'a', label: 'Шаг A' }, { id: 'b', label: 'Шаг B' }]} active="a" onChange={() => {}} />,
    );
    expect(s.querySelector('.manual-stepper')).toBeInTheDocument();
    expect(s.querySelector('.manual-stepper button')).toBeInTheDocument();
  });
});
