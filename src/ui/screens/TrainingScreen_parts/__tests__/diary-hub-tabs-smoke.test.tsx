import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrainingDiaryHub } from '../TrainingDiaryHub';
import { DiaryRecordingForm } from '../DiaryRecordingForm';
import { QuickEntry } from '../QuickEntry';
import { SessionPlayer, type PlayerDay } from '../../SRCBBScreen_parts/SessionPlayer';
import type { WorkoutLog, StrengthLogEntry } from '../../../core/types';
import type { StrengthDiary, WeeklyProgress } from '../../../engines/strength-diary.engine';

const mkWorkout = (date: string, split: string, weight: number): WorkoutLog => ({
  id: `w_${date}`,
  date,
  duration: 65,
  overallRPE: 7,
  recoveryBefore: 5,
  split,
  notes: 'хорошая тренировка',
  exercises: [
    {
      id: `${date}_bench`, date, exerciseId: 'bench_press', exerciseName: 'Жим штанги лёжа', isCompound: true, weekNumber: 1,
      sets: [{ weight, reps: 8, rir: 2, rpe: 7 }, { weight, reps: 6, rir: 1, rpe: 8 }],
      totalVolume: weight * 14, estimated1RM: Math.round(weight * 1.27),
    },
    {
      id: `${date}_squat`, date, exerciseId: 'squat', exerciseName: 'Приседания', isCompound: true, weekNumber: 1,
      sets: [{ weight: weight * 1.2, reps: 5, rir: 2, rpe: 7 }],
      totalVolume: weight * 1.2 * 5, estimated1RM: Math.round(weight * 1.2 * 1.17),
    },
  ] as StrengthLogEntry[],
});

const mkProgress = (): WeeklyProgress[] => [
  { week: 1, year: 2026, totalVolume: 5000, workoutCount: 2, compoundWorkouts: 2, isolationWorkouts: 0, total1RM: 100 },
  { week: 2, year: 2026, totalVolume: 7000, workoutCount: 3, compoundWorkouts: 3, isolationWorkouts: 0, total1RM: 110 },
  { week: 3, year: 2026, totalVolume: 9000, workoutCount: 3, compoundWorkouts: 3, isolationWorkouts: 0, total1RM: 115 },
];

const baseProps = {
  diary: {} as any as StrengthDiary,
  diaryStats: [],
  diaryProgress: mkProgress(),
  historyWorkouts: [
    mkWorkout('2026-08-10', 'PPL', 80),
    mkWorkout('2026-08-08', 'PPL', 77.5),
    mkWorkout('2026-08-05', 'FullBody', 75),
  ],
  macrocycle: null,
  selectedWeek: 1,
  level: 'intermediate',
  onRefresh: () => {},
  trainingOutput: null,
  goal: 'bulk',
  daysPerWeek: 4,
  splitType: 'auto',
  periodizationType: 'auto',
  mesoLength: 12,
  tprofile: { weakPoints: [], bodyWeight: 80, onCourse: false, courseIntensity: 1, goal: 'bulk', level: 'intermediate' },
  linked: { profile: { settings: { personal: { height: 175 } } } },
};

const CASES: [string, string][] = [
  ['record', '⚡ Быстро'],
  ['history', 'История тренировок'],
  ['analytics', 'Объём/нед'],
  ['progress', 'Замеры тела'],
  ['tools', 'Экспорт CSV'],
  ['calendar', ''],
  ['checkin', ''],
  ['mmc', ''],
];

describe('TrainingDiaryHub — все вкладки рендерят контент', () => {
  for (const [mode, marker] of CASES) {
    it(`mode ${mode} рендерится без ошибок${marker ? ` и содержит «${marker}»` : ''}`, () => {
      const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode={mode as any} />);
      expect(html.length).toBeGreaterThan(100);
      if (marker) expect(html).toContain(marker);
    });
  }
});

describe('Формы записи дневника', () => {
  it('DiaryRecordingForm рендерится с заголовком сохранения', () => {
    const html = renderToStaticMarkup(
      <DiaryRecordingForm diary={{ saveWorkoutLog: async () => {}, saveStrengthLog: async () => {} } as any} selectedWeek={1} onSave={() => {}} historyWorkouts={baseProps.historyWorkouts} />
    );
    expect(html).toContain('Записать тренировку');
    expect(html).toContain('Сохран');
  });
  it('QuickEntry рендерится без ошибок', () => {
    const html = renderToStaticMarkup(
      <QuickEntry diary={{ saveWorkoutLog: async () => {} } as any} historyWorkouts={baseProps.historyWorkouts} selectedWeek={1} onSave={() => {}} />
    );
    expect(html.length).toBeGreaterThan(50);
  });
});

describe('SessionPlayer (проведение тренировки)', () => {
  const mkDays = (): PlayerDay[] => [
    {
      label: 'День 1',
      exercises: [{ name: 'Жим штанги лёжа', muscleGroup: 'chest', targetSets: [{ weight: 80, reps: 5, rir: 2 }, { weight: 80, reps: 5, rir: 2 }], restSec: 120 }],
    },
    {
      label: 'День 2',
      exercises: [{ name: 'Приседания', muscleGroup: 'quads', targetSets: [{ weight: 100, reps: 5, rir: 2 }], restSec: 180 }],
    },
  ];
  it('рендерит вкладки дней и кнопку старта', () => {
    const html = renderToStaticMarkup(<SessionPlayer days={mkDays()} weekNumber={1} focus="ББ тест" />);
    expect(html).toContain('День 1');
    expect(html).toContain('День 2');
    expect(html).toContain('Начать тренировку');
  });
  it('рендерит пустое состояние без дней', () => {
    const html = renderToStaticMarkup(<SessionPlayer days={[]} weekNumber={1} focus="x" />);
    expect(html).toContain('Нет дней');
  });
});

describe('Дневник: старт тренировки', () => {
  it('кнопка «Начать тренировку» открывает проведение', async () => {
    const { render, fireEvent, cleanup } = await import('@testing-library/react');
    localStorage.clear();
    let opened = 0;
    const { container, unmount } = render(
      <TrainingDiaryHub
        {...baseProps}
        diary={{ checkProgressionAlerts: async () => [] } as any}
        initialMode="record"
        onStartSession={() => { opened += 1; }}
      />
    );
    const btn = container.querySelector('[data-act="diary-start"]') as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('Начать тренировку');
    fireEvent.click(btn);
    expect(opened).toBe(1);
    unmount();
    cleanup();
  });

  it('без onStartSession кнопки нет — мёртвых кнопок не рисуем', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(html).not.toContain('data-act="diary-start"');
  });

  it('подпись старта берёт план на сегодня (день, упражнения, подходы)', () => {
    const todayIdx = (new Date().getDay() + 6) % 7;
    const plan = Array.from({ length: 7 }, () => ({ name: 'Отдых', duration: 0, exercises: [] as any[] }));
    plan[todayIdx] = {
      name: 'Грудь/трицепс', duration: 55,
      exercises: [{ name: 'Жим штанги лёжа', sets: 4, reps: 8 }, { name: 'Разводка', sets: 3, reps: 12 }],
    } as any;
    const html = renderToStaticMarkup(
      <TrainingDiaryHub {...baseProps} trainingOutput={{ plan } as any} initialMode="record" onStartSession={() => {}} />
    );
    expect(html).toContain('data-act="diary-start"');
    expect(html).toContain('Грудь/трицепс');
    expect(html).toContain('7 подх.');
  });
});

describe('Дневник: вход в практики из «Сегодня»', () => {
  it('«К разминке» открывает «Ритуалы» → Разминка, а не пустой экран', async () => {
    const { render, fireEvent, cleanup } = await import('@testing-library/react');
    localStorage.clear();
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const { container, unmount } = render(
      <TrainingDiaryHub {...baseProps} initialMode="record" onStartSession={() => {}}
        diary={{ checkProgressionAlerts: async () => [] } as any}
        historyWorkouts={[mkWorkout(iso, 'PPL', 80)]} />
    );
    expect(container.textContent).toContain('Разминка сегодня не отмечена');
    const toWarmup = Array.from(container.querySelectorAll('button'))
      .find(b => (b.textContent || '').includes('К разминке')) as HTMLElement | undefined;
    expect(toWarmup).toBeTruthy();
    fireEvent.click(toWarmup!);
    // Раньше здесь ставился несуществующий mode='warmup' — контент под шапкой исчезал.
    expect(container.textContent).toContain('🧘 Мобильность');
    expect(container.querySelector('[data-act="diary-start"]')).toBeNull();
    unmount();
    cleanup();
    localStorage.clear();
  });
});

describe('Дневник: порядок записи', () => {
  it('старт → «Сегодня» → форма записи → доп. карточки', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" onStartSession={() => {}} />);
    const start = html.indexOf('data-act="diary-start"');
    const today = html.indexOf('class="td-today"');
    const form = html.indexOf('⚡ Быстро');
    const aux = html.indexOf('data-pl="record-aux"');
    expect(start).toBeGreaterThan(-1);
    expect(today).toBeGreaterThan(start);
    // Раньше форма записи была последней: три карточки контекста оттесняли её вниз.
    expect(form).toBeGreaterThan(today);
    expect(aux).toBeGreaterThan(form);
    // «Привычки недели» и «Миксы» — контекст, а не запись: они больше не стоят
    // между «Сегодня» и формой и не оттесняют ввод вниз.
    expect(html.indexOf('hab-week')).toBeGreaterThan(form);
  });

  it('«Доделать сегодня» — одна карточка вместо четырёх баннеров, без дублирующей сводки', () => {
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const html = renderToStaticMarkup(
      <TrainingDiaryHub {...baseProps} initialMode="record" onStartSession={() => {}}
        diary={{ checkProgressionAlerts: async () => [] } as any}
        historyWorkouts={[mkWorkout(iso, 'PPL', 80)]} />
    );
    const todo = html.indexOf('data-act="todo-today"') >= 0 ? html.indexOf('data-act="todo-today"') : html.indexOf('data-pl="todo-today"');
    expect(todo).toBeGreaterThan(-1);
    // Все действия дня — внутри одной карточки, а не четырьмя отдельными баннерами
    for (const act of ['todo-checkin', 'todo-warmup-done', 'todo-warmup-go', 'todo-cooldown-done']) {
      expect(html.indexOf(`data-act="${act}"`)).toBeGreaterThan(todo);
    }
    expect(html).toContain('Доделать сегодня');
    // Отдельного дубля «Сегодня / Всего / Последняя» больше нет — эти числа уже в карточке дня
    expect(html).not.toContain('Сводка дневника');
  });

  it('«Контекст дня» — один свёрнутый блок: привычки/миксы/ББ/кардио не растягивают запись', async () => {
    const { render, fireEvent, cleanup } = await import('@testing-library/react');
    localStorage.clear();
    const { container, unmount } = render(
      <TrainingDiaryHub
        {...baseProps}
        initialMode="record"
        onStartSession={() => {}}
        diary={{ checkProgressionAlerts: async () => [] } as any}
      />
    );
    const toggle = container.querySelector('[data-act="record-aux-toggle"]') as HTMLElement | null;
    expect(toggle).not.toBeNull();
    expect(toggle!.textContent).toContain('Контекст дня');
    const body = container.querySelector('[data-pl="record-aux-body"]') as HTMLElement | null;
    expect(body).not.toBeNull();
    // По умолчанию справка свёрнута — сначала запись, потом контекст.
    expect(body!.style.display).toBe('none');
    expect(body!.querySelector('.hab-week')).not.toBeNull();
    fireEvent.click(toggle!);
    expect(body!.style.display).toBe('flex');
    expect(toggle!.getAttribute('aria-expanded')).toBe('true');
    unmount();
    cleanup();
    localStorage.clear();
  });
});
