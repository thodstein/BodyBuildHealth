/** diary-entry-helpers.test.tsx — единый поиск каталога + сиды нового упражнения.
 *
 * Покрывает два найденных бага форм записи дневника:
 *  1. QuickEntry подставлял новому упражнению вес ТЕКУЩЕГО выбранного
 *     (второе упражнение наследовало вес первого).
 *  2. Групповой чип «Грудь/Спина/…» в подробной форме гас: search-эффект
 *     перезатирал вручную подставленный список пустым совпадением по имени.
 */
import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { searchExerciseCatalog, seedForNewExercise, mrvBaseForLevel, localIsoDate, bestE1rmSeriesForWeek, csvCell, weekdayMon0 } from '../diary-shared';
import { QuickEntry } from '../QuickEntry';
import { DiaryRecordingForm } from '../DiaryRecordingForm';
import { WorkoutWeekCard } from '../diary-cards';
import { readManualFlags, manualVirtualLog } from '../TrainingCalendarTab';
import { WarmupDiaryView } from '../WarmupDiaryView';
import { CooldownDiaryView } from '../CooldownDiaryView';
import { DiaryProgressView } from '../DiaryProgressView';
import { csvImportParsers } from '../CsvImportTab';
import { TrainingDiaryHub } from '../TrainingDiaryHub';
import { MindsetTab } from '../MindsetTab';
import { MobilityTab } from '../MobilityTab';
import { loadCheckins, buildPresetProtocol, upsertProtocol, setActiveProtocol } from '../../../../engines/mindset-protocol.engine';
import { loadMobilityCheckins, buildPresetMobility, upsertMobilityProtocol, setActiveMobility } from '../../../../engines/mobility-protocol.engine';
import type { DiaryHubCtx } from '../diary-hub-context';
import type { WorkoutLog, StrengthLogEntry } from '../../../core/types';

beforeEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

const mkEx = (exerciseName: string, exerciseId: string, weight: number, reps: number): StrengthLogEntry => ({
  id: `w1_${exerciseId}`,
  date: '2026-09-01',
  exerciseId,
  exerciseName,
  sets: [{ weight, reps, rir: 2, rpe: 7 }],
  totalVolume: weight * reps,
  estimated1RM: Math.round(weight * 1.27),
  isCompound: true,
  weekNumber: 1,
});

const mkHistory = (): WorkoutLog[] => [
  {
    id: 'w1',
    date: '2026-09-01',
    duration: 60,
    exercises: [
      mkEx('Жим штанги лёжа', 'bench_bar', 80, 8),
      mkEx('Подъём штанги на бицепс стоя', 'curl_bar', 20, 10),
    ] as StrengthLogEntry[],
  },
];

describe('searchExerciseCatalog — единый поиск форм записи', () => {
  it('пустой запрос → []', () => {
    expect(searchExerciseCatalog('')).toEqual([]);
    expect(searchExerciseCatalog('   ')).toEqual([]);
  });

  it('обычный запрос ищет по имени и ограничен лимитом', () => {
    const res = searchExerciseCatalog('жим', 8);
    expect(res.length).toBeGreaterThan(0);
    expect(res.length).toBeLessThanOrEqual(8);
    expect(res.map(e => (e as { name: string }).name)).toContain('Жим штанги лёжа');
  });

  it('групповая метка «грудь» возвращает группу груди (не пусто)', () => {
    const res = searchExerciseCatalog('Грудь');
    expect(res.length).toBeGreaterThan(0);
    expect(res.every(e => (e as { group: string }).group === 'chest')).toBe(true);
  });

  it('метка «бицепс» маппится на группу arms каталога (не пусто)', () => {
    const res = searchExerciseCatalog('Бицепс');
    expect(res.length).toBeGreaterThan(0);
    expect(res.every(e => (e as { group: string }).group === 'arms')).toBe(true);
  });

  it('метка «ноги» возвращает семейство ног', () => {
    const res = searchExerciseCatalog('Ноги');
    expect(res.length).toBeGreaterThan(0);
    const allowed = new Set(['legs', 'quads', 'hamstrings', 'glutes', 'calves']);
    expect(res.every(e => allowed.has((e as { group: string }).group))).toBe(true);
  });
});

describe('seedForNewExercise — сид из истории ДОБАВЛЯЕМОГО упражнения', () => {
  it('второе упражнение получает свой вес, а не вес первого', () => {
    const history = mkHistory();
    expect(seedForNewExercise(history, 'Жим штанги лёжа', false)).toMatchObject({ weight: 80, reps: 8 });
    // Ключевой кейс бага: бицепс должен получить 20, а не 80 от жима.
    expect(seedForNewExercise(history, 'Подъём штанги на бицепс стоя', false)).toMatchObject({ weight: 20, reps: 10 });
  });

  it('собственный вес → 0, неизвестное упражнение → дефолты', () => {
    const history = mkHistory();
    expect(seedForNewExercise(history, 'Подтягивания', true).weight).toBe(0);
    expect(seedForNewExercise(history, 'Несуществующее упражнение', false)).toMatchObject({ weight: 0, reps: 10, rir: 2 });
  });
});

describe('QuickEntry — новое упражнение наследует СВОЮ историю', () => {
  it('второй добавленный снаряд показывает свой прошлый вес (20, а не 80)', async () => {
    render(
      <QuickEntry
        diary={{ saveWorkoutLog: async () => {} } as never}
        historyWorkouts={mkHistory()}
        selectedWeek={1}
        onSave={() => {}}
      />,
    );
    const search = screen.getByPlaceholderText('🔍 Поиск упражнения...') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'жим' } });
    fireEvent.click(await screen.findByText('Жим штанги лёжа'));
    fireEvent.change(search, { target: { value: 'бицепс' } });
    fireEvent.click(await screen.findByText('Подъём штанги на бицепс стоя'));
    // Открыт только текущий (второй) снаряд — его поле веса должно быть 20.
    const weightInput = screen.getByPlaceholderText('кг') as HTMLInputElement;
    expect(weightInput.value).toBe('20');
  });
});

describe('DiaryRecordingForm — групповой чип не гаснет', () => {
  it('клик «Грудь» показывает упражнения груди', async () => {
    render(
      <DiaryRecordingForm
        diary={{ saveWorkoutLog: async () => {}, saveStrengthLog: async () => {} } as never}
        selectedWeek={1}
        onSave={() => {}}
        historyWorkouts={[]}
      />,
    );
    fireEvent.click(screen.getByText('Грудь'));
    expect(await screen.findByText('Жим штанги лёжа')).toBeTruthy();
  });
});

describe('mrvBaseForLevel — порог алерта перетренированности', () => {
  it('intermediate без курса → 20', () => {
    expect(mrvBaseForLevel('intermediate', false)).toBe(20);
  });
  it('enhanced едет на базе advanced (24), курс ×1.2', () => {
    expect(mrvBaseForLevel('enhanced', false)).toBe(24);
    expect(mrvBaseForLevel('enhanced', true)).toBeCloseTo(28.8, 5);
  });
  it('неизвестный уровень → 20 (без NaN)', () => {
    expect(mrvBaseForLevel('unknown-level', false)).toBe(20);
  });
});

describe('WorkoutWeekCard — PRO-хуки и экшены', () => {
  it('рендерит неделю с PRO-классом и кнопками правок', () => {
    const { container } = render(
      <WorkoutWeekCard
        weekLabel="Неделя 1"
        workouts={mkHistory()}
        expanded
        onToggle={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(container.querySelector('.ww-card')).toBeTruthy();
    expect(container.querySelector('.ww-head')).toBeTruthy();
    expect(container.querySelector('.ww-act')).toBeTruthy();
    expect(screen.getByTitle('Редактировать')).toBeTruthy();
    expect(screen.getByTitle('Удалить')).toBeTruthy();
  });
});

describe('localIsoDate — без UTC-сдвига', () => {
  it('полночь+30мин локального времени остаётся тем же днём', () => {
    // В UTC+3 toISOString дал бы предыдущий день — баг ключей дневников.
    const d = new Date(2026, 8, 8, 0, 30, 0);
    expect(localIsoDate(d)).toBe('2026-09-08');
  });
  it('формат YYYY-MM-DD с паддингом', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });
});

describe('bestE1rmSeriesForWeek — спарклайн СВОЕЙ недели', () => {
  it('серия строится из тренировок переданной недели в хронологии', () => {
    const week = [
      { ...mkHistory()[0], date: '2026-09-01', exercises: [mkEx('Жим штанги лёжа', 'bench_bar', 80, 8)] },
      { ...mkHistory()[0], id: 'w2', date: '2026-09-03', exercises: [mkEx('Жим штанги лёжа', 'bench_bar', 85, 8)] },
    ] as WorkoutLog[];
    const series = bestE1rmSeriesForWeek(week);
    expect(series).toHaveLength(2);
    expect(series[1]).toBeGreaterThan(series[0]);
    // Разные недели — разные серии (раньше все карточки показывали одну глобальную).
    const other = bestE1rmSeriesForWeek([
      { ...mkHistory()[0], id: 'w3', date: '2026-09-08', exercises: [mkEx('Жим штанги лёжа', 'bench_bar', 60, 8)] },
    ] as WorkoutLog[]);
    expect(other[0]).toBeLessThan(series[0]);
  });
  it('пустая неделя → пустая серия (без NaN)', () => {
    expect(bestE1rmSeriesForWeek([])).toEqual([]);
  });
});

describe('TrainingCalendarTab — ручные отметки', () => {
  it('readManualFlags читает Set, manualVirtualLog строит маркер', () => {
    localStorage.setItem('he_cal_manual', JSON.stringify(['2026-09-08']));
    expect(readManualFlags().has('2026-09-08')).toBe(true);
    const v = manualVirtualLog('2026-09-08');
    expect(v.date).toBe('2026-09-08');
    expect(v.exercises).toEqual([]);
  });
  it('битый storage → пустой Set (без throw)', () => {
    localStorage.setItem('he_cal_manual', 'not-json{');
    expect(readManualFlags().size).toBe(0);
  });
});

describe('Warmup/Cooldown — PRO-хуки при живых записях', () => {  it('разминка: статы, heatmap и фут 48px', () => {
    localStorage.setItem('he_warmup_diary', JSON.stringify([
      { id: 'w1', date: '2026-09-06', done: true, quality: 4, doneItems: 3, totalItems: 4 },
      { id: 'w2', date: '2026-09-07', done: true, quality: 5, doneItems: 4, totalItems: 4 },
      { id: 'w3', date: '2026-09-08', done: false, quality: null, skippedReason: 'спешка' },
    ]));
    const { container } = render(<WarmupDiaryView historyWorkouts={[]} />);
    expect(container.querySelector('.wu-stats')).toBeTruthy();
    expect(container.querySelector('.wu-heat')).toBeTruthy();
    expect(container.querySelector('.wu-foot')).toBeTruthy();
  });
  it('заминка: статы и фут 48px', () => {
    localStorage.setItem('he_cooldown_diary', JSON.stringify([
      { id: 'c1', date: '2026-09-06', done: true, quality: 4, doneItems: 2, totalItems: 3 },
      { id: 'c2', date: '2026-09-07', done: true, quality: 5, doneItems: 3, totalItems: 3 },
    ]));
    const { container } = render(<CooldownDiaryView />);
    expect(container.querySelector('.cd-stats')).toBeTruthy();
    expect(container.querySelector('.cd-foot')).toBeTruthy();
  });
});

describe('Ритуалы — чек-ины датируются ЛОКАЛЬНЫМ днём', () => {  // Инстант, где UTC-дата (09-08) и локальная (09-09, UTC+10) расходятся:
  // старый toISOString-код клал чек-ин на вчера.
  const PINNED = new Date('2026-09-08T21:30:00Z');
  const mkHub = (historyWorkouts: unknown[] = []) => ({ historyWorkouts }) as unknown as DiaryHubCtx;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('психо-чек-ин пишется на 09-09, а не 09-08', () => {
    const p = buildPresetProtocol('pl');
    upsertProtocol(p);
    setActiveProtocol(p.id);
    render(<MindsetTab hub={mkHub()} />);
    fireEvent.click(screen.getByRole('button', { name: '💾 Сохранить чек-ин' }));
    const list = loadCheckins();
    expect(list.length).toBeGreaterThan(0);
    expect(list[list.length - 1].date).toBe('2026-09-09');
  });

  it('чек-ин мобильности пишется на 09-09, а не 09-08', () => {
    const p = buildPresetMobility('pl');
    upsertMobilityProtocol(p);
    setActiveMobility(p.id);
    render(<MobilityTab hub={mkHub()} />);
    fireEvent.click(screen.getByRole('button', { name: '💾 Сохранить чек-ин' }));
    const list = loadMobilityCheckins();
    expect(list.length).toBeGreaterThan(0);
    expect(list[list.length - 1].date).toBe('2026-09-09');
  });
});

describe('csvCell — гашение формульных инъекций', () => {  it('=,+,-,@ в начале гасятся апострофом', () => {
    expect(csvCell('=cmd|xxx')).toBe("'=cmd|xxx");
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@sum')).toBe("'@sum");
  });
  it('обычные строки/числа/пусто — без изменений', () => {
    expect(csvCell('Жим штанги лёжа')).toBe('Жим штанги лёжа');
    expect(csvCell(80)).toBe('80');
    expect(csvCell(null)).toBe('');
    expect(csvCell('a=b')).toBe('a=b');
  });
});

describe('DiaryProgressView — PRO-хуки', () => {
  it('замеры, история и рекорды с хуками', () => {
    const hub = {
      measurements: [{ date: '2026-09-08', weightKg: 80, waistCm: 85, chestCm: 100, armLeftCm: 38, armRightCm: 38, thighLeftCm: 60, thighRightCm: 60 }],
      setMeasurements: () => {},
      mWeight: 80, setMWeight: () => {}, mWaist: 85, setMWaist: () => {}, mChest: 100, setMChest: () => {},
      mArm: 38, setMArm: () => {}, mThigh: 60, setMThigh: () => {}, mDate: '2026-09-08', setMDate: () => {},
      saveMeasurementHandler: () => {}, measureAnalytics: null, repData: null,
      historyWorkouts: [mkHistory()[0], { ...mkHistory()[0], id: 'w2', date: '2026-09-03' }],
    };
    const { container } = render(<DiaryProgressView hub={hub as never} />);
    expect(container.querySelector('.pg-measure')).toBeTruthy();
    expect(container.querySelector('.pg-hist')).toBeTruthy();
    expect(container.querySelector('.pg-pr')).toBeTruthy();
  });
});

describe('weekdayMon0 — день недели по локальному календарю', () => {
  it('Пн=0 … Вс=6 (2026-09-07 — понедельник)', () => {
    expect(weekdayMon0('2026-09-07')).toBe(0);
    expect(weekdayMon0('2026-09-08')).toBe(1);
    expect(weekdayMon0('2026-09-13')).toBe(6);
  });
  it('совпадает с локальным getDay-сдвигом', () => {
    for (const d of ['2026-01-01', '2026-05-20', '2026-12-31']) {
      const [y, m, day] = d.split('-').map(Number);
      expect(weekdayMon0(d)).toBe((new Date(y, m - 1, day).getDay() + 6) % 7);
    }
  });
});

describe('csvImportParsers — без потерь и мусора', () => {
  it('hevy: вес 0 (свой вес) сохраняется, пустые поля — пусто, а не undefined', () => {
    const out = csvImportParsers.parseHevy(JSON.stringify([
      { start_time: '2026-09-08T10:00:00Z', exercises: [{ title: 'Подтягивания', sets: [{ weight_kg: 0, reps: 10 }] }] },
    ]));
    const row = out.split('\n')[1];
    expect(row).toContain(',0,10,');
    expect(out).not.toContain('undefined');
  });
  it('strong/mesomorph: 0 и пропуски без undefined', () => {
    const s = csvImportParsers.parseStrong(JSON.stringify([
      { Date: '2026-09-08', Exercises: [{ Name: 'Жим', Sets: [{ WeightKg: 0, Reps: 5 }] }] },
    ]));
    expect(s.split('\n')[1]).toContain(',0,5,');
    const m = csvImportParsers.parseMesomorph(JSON.stringify({ date: '2026-09-08', exercises: [{ name: 'Тяга', sets: [{ weight: 60 }] }] }));
    expect(m).not.toContain('undefined');
  });
  it('csvName: запятая в названии — в кавычки', () => {
    expect(csvImportParsers.csvName('Жим, лёжа')).toBe('"Жим, лёжа"');
    expect(csvImportParsers.csvName('Жим')).toBe('Жим');
  });
});

describe('DiaryHistoryView — главная карточка истории', () => {  it('history-режим хаба рендерит th-main со статой', async () => {
    const { TrainingDiaryHub } = await import('../TrainingDiaryHub');
    const w1 = mkHistory()[0];
    const w2 = { ...w1, id: 'w2', date: '2026-09-03' };
    const { container } = render(
      <TrainingDiaryHub
        initialMode="history"
        diary={{ checkProgressionAlerts: async () => [] } as never}
        diaryStats={[]}
        diaryProgress={[{ week: 36, year: 2026, totalVolume: 5000, workoutCount: 2, compoundWorkouts: 2, isolationWorkouts: 0, total1RM: 100 }]}
        historyWorkouts={[w1, w2] as never}
        macrocycle={null}
        selectedWeek={1}
        level="intermediate"
        onRefresh={() => {}}
        trainingOutput={null}
        goal="bulk"
        daysPerWeek={3}
        splitType="auto"
        periodizationType="auto"
        mesoLength={8}
        tprofile={{ onCourse: false }}
        linked={{}}
      />,
    );
    expect(container.querySelector('.th-main')).toBeTruthy();
    expect(container.querySelector('.ww-card')).toBeTruthy();
  });
});

describe('DiarySubnav — сквозная навигация по 10 разделам', () => {
  const renderHub = () => {
    const w1 = mkHistory()[0];
    return render(
      <TrainingDiaryHub
        diary={{ checkProgressionAlerts: async () => [] } as never}
        diaryStats={[]}
        diaryProgress={[{ week: 36, year: 2026, totalVolume: 5000, workoutCount: 2, compoundWorkouts: 2, isolationWorkouts: 0, total1RM: 100 }]}
        historyWorkouts={[w1, { ...w1, id: 'w2', date: '2026-09-03' }] as never}
        macrocycle={null}
        selectedWeek={1}
        level="intermediate"
        onRefresh={() => {}}
        trainingOutput={null}
        goal="bulk"
        daysPerWeek={3}
        splitType="auto"
        periodizationType="auto"
        mesoLength={8}
        tprofile={{ onCourse: false }}
        linked={{}}
      />,
    );
  };

  it('все 10 кнопок на месте', () => {
    renderHub();
    for (const label of ['📓 Запись', '📜 История', '📏 Прогресс', '📈 Анализ', '🧘 Ритуалы', '📊 Фидбек', '⭐ Мои', '🏁 Соревн.', '💡 Рекоменд.', '🛠 Инструменты']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('переходы работают, subnav не пропадает, актив подсвечен', () => {
    renderHub();
    fireEvent.click(screen.getByRole('button', { name: '📜 История' }));
    expect(screen.getByText('📜 История тренировок')).toBeTruthy();
    expect(document.querySelector('.td-subnav')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '📏 Прогресс' }));
    expect(screen.getByText('📏 Замеры тела')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '📈 Анализ' }));
    expect(screen.getByText('Объём/нед')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '🧘 Ритуалы' }));
    expect(screen.getByText('Протокол ещё не собран')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '🛠 Инструменты' }));
    expect(screen.getByText('📥 Экспорт CSV')).toBeTruthy();
    expect(screen.getByRole('button', { name: '🛠 Инструменты' }).getAttribute('data-active')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '📓 Запись' }));
    expect(screen.getByText('⚡ Быстро')).toBeTruthy();
  });
});
