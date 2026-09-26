/**
 * diary-date-canon.test.tsx — дневники считают «сегодня» по локальному канону.
 *
 * Контекст. Эти файлы брали «сегодня» как `toISOString().slice(0, 10)` (UTC),
 * тогда как записи пишутся по локальному канону (workout-logger → core/local-date).
 * В вечерние часы при смещении UTC+3…+12 ключи расходились на сутки: подсказка
 * «сегодня нет тренировки — день отдыха» показывалась в день, когда тренировка
 * уже была записана, а в имя выгружаемого файла попадала вчерашняя дата.
 *
 * Что здесь проверено и чем это доказано (всё — мутацией, см. журнал):
 *
 * 1. Поведенческий лок, мутационно-чувствительный: имя экспортируемого CSV
 *    берётся из локального канона. Часы закреплены на 2026-09-26T20:30:00Z,
 *    где UTC = 26-е, а календарь = 27-е. Возврат UTC в этой строке даёт
 *    `diary_export_2026-09-26.csv` вместо `..._2026-09-27.csv` — тест падает.
 *
 * 2. Поведенческие локи подсказки дня отдыха: тренировка за сегодня скрывает
 *    подсказку, её отсутствие — показывает. Эти два НЕ ловят возврат UTC
 *    (в дневное время локальная и UTC-даты совпадают) — честная граница
 *    зафиксирована комментарием в тесте; их ценность в другом: они держат
 *    сам гейт `trainedToday`, который читает «сегодня».
 *
 * 3. Source-guard: date-only вызовы не вернулись ни в один из трёх файлов.
 *
 * Две границы, найденные мутацией (важно, чтобы не чинить несуществующее):
 *  · подсказка «тренировка была — добавь запись» из `MixDiarySection` в SSR
 *    недостижима — компонент читает записи в useEffect и делает
 *    `if (records.length === 0) return null`, т.е. в статическом рендере секция
 *    всегда пуста;
 *  · полный `vi.useFakeTimers()` обрезает дерево `renderToStaticMarkup`
 *    (23 200 против 25 200 символов), из-за чего проверки «этого текста нет»
 *    проходят вхолостую. Поэтому часы закрепляются точечным фейком только
 *    `Date` — планировщик React остаётся настоящим.
 */
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TrainingDiaryHub } from '../TrainingDiaryHub';
import { DiaryToolsView } from '../DiaryToolsView';
import { localIsoDate, localIsoDateOffset } from '../../../../core/local-date';
import {
  MOBILITY_PROTOCOLS_KEY, MOBILITY_ACTIVE_KEY,
} from '../../../../engines/mobility-protocol.engine';
import type { WorkoutLog, StrengthLogEntry } from '../../../../core/types';
import type { StrengthDiary, WeeklyProgress } from '../../../../engines/strength-diary.engine';

/** Момент, где локальный календарь уже на сутки впереди UTC. */
const МОМЕНТ_РАСХОЖДЕНИЯ = '2026-09-26T20:30:00Z';
const ЛОКАЛЬНЫЙ_ДЕНЬ_ПРИ_РАСХОЖДЕНИИ = '2026-09-27';
const UTC_ДЕНЬ_ПРИ_РАСХОЖДЕНИИ = '2026-09-26';
/** Видимая подсказка дня отдыха в хабе. */
const ПОДСКАЗКА_ОТДЫХ = 'день отдыха';

const workout = (date: string): WorkoutLog => ({
  id: `w_${date}`, date, duration: 60, overallRPE: 7, recoveryBefore: 5, split: 'PPL', notes: '',
  exercises: [{
    id: `${date}_bench`, date, exerciseId: 'bench_press', exerciseName: 'Жим штанги лёжа',
    isCompound: true, weekNumber: 1, sets: [{ weight: 80, reps: 8, rir: 2, rpe: 7 }],
    totalVolume: 640, estimated1RM: 100,
  }] as StrengthLogEntry[],
} as WorkoutLog);

const пропсыХаба = (historyWorkouts: WorkoutLog[]) => ({
  diary: {} as any as StrengthDiary,
  diaryStats: [],
  diaryProgress: [] as WeeklyProgress[],
  historyWorkouts,
  strengthLogs: [],
  weeklyProgress: [],
  currentDate: localIsoDate(),
  initialMode: 'record' as any,
} as any);

const разметкаХаба = (historyWorkouts: WorkoutLog[]) =>
  renderToStaticMarkup(<TrainingDiaryHub {...пропсыХаба(historyWorkouts)} />);

/** Минимальный контекст для DiaryToolsView: нужен только для кнопок экспорта. */
const hubДляЭкспорта = (historyWorkouts: WorkoutLog[]) => ({
  diary: {}, historyWorkouts, macrocycle: null, trainingOutput: null, goal: 'bulk', level: 'intermediate',
  daysPerWeek: 4, splitType: 'auto', periodizationType: 'auto', mesoLength: 12,
  trainingArchive: [], setTrainingArchive: () => {},
  trainingReportGenerated: false, setTrainingReportGenerated: () => {},
  measurements: [], setMeasurements: () => {},
  dupes: [], setDupes: () => {}, dupesBusy: false, setDupesBusy: () => {}, onRefresh: () => {},
} as any);

/** Протокол мобильности с пунктом дня отдыха — иначе гейту нечего скрывать. */
const сидПротоколаМобильности = () => {
  localStorage.setItem(MOBILITY_PROTOCOLS_KEY, JSON.stringify([{
    id: 'mob_test', name: 'Тест', direction: 'general', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    items: [
      { id: 'mob_daily', slot: 'daily', title: 'Ежедневно', script: 'мягкая работа', durationMin: 5 },
      { id: 'mob_rest', slot: 'rest_day', title: 'День отдыха', script: 'сессия восстановления', durationMin: 10 },
    ],
  }]));
  localStorage.setItem(MOBILITY_ACTIVE_KEY, 'mob_test');
};

beforeEach(() => { localStorage.clear(); сидПротоколаМобильности(); });
afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

describe('дневник: имя выгружаемого файла = локальный день (главный поведенческий лок)', () => {
  it('вечером, когда календарь впереди UTC, в имя файла попадает сегодняшний день', () => {
    if (-new Date().getTimezoneOffset() <= 0) { console.log('[diary-dates] TZ=0 — проверка пропущена'); return; }
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(МОМЕНТ_РАСХОЖДЕНИЯ));
    // Расхождение зафиксировано: UTC считает 26-е, календарь — 27-е.
    expect(new Date().toISOString().slice(0, 10)).toBe(UTC_ДЕНЬ_ПРИ_РАСХОЖДЕНИИ);
    expect(localIsoDate()).toBe(ЛОКАЛЬНЫЙ_ДЕНЬ_ПРИ_РАСХОЖДЕНИИ);

    const скачанные: string[] = [];
    const кликПоЯкорю = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { скачанные.push(this.download); };
    const createObjectURL = URL.createObjectURL;
    const revokeObjectURL = URL.revokeObjectURL;
    (URL as any).createObjectURL = () => 'blob:test';
    (URL as any).revokeObjectURL = () => {};
    try {
      render(<DiaryToolsView hub={hubДляЭкспорта([workout(ЛОКАЛЬНЫЙ_ДЕНЬ_ПРИ_РАСХОЖДЕНИИ)])} />);
      fireEvent.click(screen.getByText(/Скачать CSV/));
    } finally {
      HTMLAnchorElement.prototype.click = кликПоЯкорю;
      (URL as any).createObjectURL = createObjectURL;
      (URL as any).revokeObjectURL = revokeObjectURL;
    }

    expect(скачанные[0]).toBe(`diary_export_${ЛОКАЛЬНЫЙ_ДЕНЬ_ПРИ_РАСХОЖДЕНИИ}.csv`);
  });
});

describe('дневник: гейт «тренировка сегодня» в подсказке дня отдыха', () => {
  it('тренировка за сегодняшний день скрывает подсказку дня отдыха', () => {
    // Граница: при возврате UTC-версии этот тест остаётся зелёным в дневное
    // время (локальная и UTC-даты совпадают) — его ловит лок имени файла выше.
    expect(разметкаХаба([workout(localIsoDate())])).not.toContain(ПОДСКАЗКА_ОТДЫХ);
  });

  it('без тренировки за сегодня подсказка дня отдыха видна', () => {
    expect(разметкаХаба([workout(localIsoDateOffset(-1))])).toContain(ПОДСКАЗКА_ОТДЫХ);
  });
});

describe('дневник: source-guard контура', () => {
  it('в трёх файлах дневников нет date-only вызовов и они импортируют канон', () => {
    for (const имя of ['TrainingDiaryHub.tsx', 'DiaryToolsView.tsx', 'DiaryHistoryView.tsx']) {
      const src = readFileSync(join(process.cwd(), 'src/ui/screens/TrainingScreen_parts', имя), 'utf8');
      const код = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(код.match(/\.toISOString\(\)\s*\.slice\(\s*0\s*,\s*10\s*\)/g) || [], `${имя}: вернулись date-only вызовы`).toEqual([]);
      expect(src, `${имя}: нет импорта канона`).toContain('core/local-date');
    }
  });
});
