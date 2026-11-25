/**
 * training-runtime-day-default.test.ts — замок на «день проведения» по умолчанию.
 *
 * 1. `runtimeDay` (день микроцикла в зоне выполнения) — индекс 0-based в списке
 *    ТРЕНИРОВОЧНЫХ дней плана, а не день недели. Дефолт 1 молча открывал второй
 *    тренировочный день, хотя первый тоже мог быть тренировочным.
 *    Кроме нового дефолта нужна миграция: прежняя версия писала `he_runtime_day = 1`
 *    при первом рендере, поэтому у существующих установок ключ уже лежит с единицей.
 * 2. Плеер плана получает `initialDayIndex` — день считает ExecutionZone по якорю
 *    `he_pl_runtime.startDate`; без этого на длинном BB-цикле всегда открывался день 1.
 *
 * Часть проверок — по исходникам (поведение зависит от большого числа пропсов:
 * профиль, localStorage, календарь, и смок-рендер TrainingScreen проверяет не то),
 * часть — юнит-тесты миграции на настоящем `localStorage` (jsdom).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  readRuntimeDay,
  resolveRuntimeDayIndex,
  writeRuntimeDay,
  RUNTIME_DAY_KEY,
  RUNTIME_DAY_MIGRATED_KEY,
} from '../runtime-day';

const trainingScreen = readFileSync('src/ui/screens/TrainingScreen.tsx', 'utf8');
const executionZone = readFileSync('src/ui/screens/TrainingScreen_parts/ExecutionZone.tsx', 'utf8');
const runtimeDaySource = readFileSync('src/ui/screens/TrainingScreen_parts/runtime-day.ts', 'utf8');

describe('день проведения по умолчанию', () => {
  it('runtimeDay берётся из readRuntimeDay, а не из localStorage с дефолтом 1', () => {
    const line = trainingScreen
      .split(/\r?\n/)
      .find((l) => l.includes('const [runtimeDay, setRuntimeDay]') && l.includes('useState'));
    expect(line).toBeTruthy();
    expect(line).toContain('readRuntimeDay()');
    expect(line).not.toContain("|| '1'");
    // Второй независимой записи ключа на экране быть не должно.
    expect(trainingScreen).not.toContain("localStorage.setItem('he_runtime_day'");
  });

  it('SessionPlayer получает день из якоря плана, а не всегда первый', () => {
    expect(executionZone).toContain('initialDayIndex={initialPlanDay}');
    expect(executionZone).toContain('startDate: plRuntime.startDate');
    expect(executionZone).toContain('pickPlanDayIndex(');
  });
});

describe('миграция he_runtime_day', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('чистая установка начинается с первого тренировочного дня (0)', () => {
    expect(readRuntimeDay()).toBe(0);
    expect(localStorage.getItem(RUNTIME_DAY_MIGRATED_KEY)).toBe('1');
  });

  it('унаследованная единица прежнего дефолта снимается один раз', () => {
    // Так ключ выглядит у всех, кто пользовался версией с дефолтом 1.
    localStorage.setItem(RUNTIME_DAY_KEY, JSON.stringify(1));
    expect(readRuntimeDay()).toBe(0);
    expect(localStorage.getItem(RUNTIME_DAY_KEY)).toBe('0');
    expect(localStorage.getItem(RUNTIME_DAY_MIGRATED_KEY)).toBe('1');
  });

  it('осмысленный выбор после миграции не срезается', () => {
    localStorage.setItem(RUNTIME_DAY_MIGRATED_KEY, '1');
    localStorage.setItem(RUNTIME_DAY_KEY, JSON.stringify(1));
    // Пользователь сам выбрал второй тренировочный день уже после миграции — значение остаётся.
    expect(readRuntimeDay()).toBe(1);
  });

  it('до миграции сбрасывается только унаследованная единица, остальные значения сохраняются', () => {
    // Старый ключ не хранил признака «выбрано пользователем»: и авто-дефолт, и ручной
    // выбор второго дня выглядели как `1`, поэтому единица сбрасывается в обоих случаях
    // (задокументированная цена миграции). Остальные значения не трогаются.
    localStorage.setItem(RUNTIME_DAY_KEY, JSON.stringify(2));
    expect(readRuntimeDay()).toBe(2);
    expect(localStorage.getItem(RUNTIME_DAY_MIGRATED_KEY)).toBe('1');
  });

  it('выбор дня пишется вместе с флагом миграции', () => {
    expect(writeRuntimeDay(2)).toBe(2);
    expect(localStorage.getItem(RUNTIME_DAY_KEY)).toBe('2');
    expect(localStorage.getItem(RUNTIME_DAY_MIGRATED_KEY)).toBe('1');
    expect(readRuntimeDay()).toBe(2);
  });

  it('провал записи флага миграции не превращает прочитанный выбор в 0', () => {
    // Квота на ключ флага: раньше весь read был в одном try, и любая ошибка записи
    // возвращала 0 — TrainingScreen тут же сохранял этот 0 поверх валидного дня.
    localStorage.setItem(RUNTIME_DAY_KEY, JSON.stringify(2));
    const realSetItem = localStorage.setItem.bind(localStorage);
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === RUNTIME_DAY_MIGRATED_KEY) {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      }
      realSetItem(key, value);
    });
    try {
      expect(readRuntimeDay()).toBe(2);
      expect(localStorage.getItem(RUNTIME_DAY_KEY)).toBe('2');
    } finally {
      spy.mockRestore();
    }
  });

  it('провал записи мигрированного значения не ставит флаг и не врёт про 0', () => {
    // Флаг раньше писался ПЕРВЫМ: если запись значения падала, миграция больше не
    // повторялась и унаследованная единица оставалась навсегда.
    localStorage.setItem(RUNTIME_DAY_KEY, JSON.stringify(1));
    const realSetItem = localStorage.setItem.bind(localStorage);
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === RUNTIME_DAY_KEY) {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      }
      realSetItem(key, value);
    });
    try {
      expect(readRuntimeDay()).toBe(1);
      expect(localStorage.getItem(RUNTIME_DAY_MIGRATED_KEY)).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('битое значение и выход за 0…6 не ломают чтение', () => {
    localStorage.setItem(RUNTIME_DAY_KEY, 'не число');
    expect(readRuntimeDay()).toBe(0);
    expect(writeRuntimeDay(99)).toBe(6);
    expect(writeRuntimeDay(-3)).toBe(0);
  });
});

describe('runtimeDay — индекс списка тренировочных дней, а не день недели', () => {
  it('документация не выдаёт индекс за день недели', () => {
    // Прежний док-комментарий обещал «0 = Пн … 6 = Вс»: следующий читатель строил
    // на этом миграции и путался, почему «вторник» открывает второй день плана.
    expect(runtimeDaySource).not.toContain('0 = Пн');
    expect(runtimeDaySource).toContain('индекс в списке тренировочных дней');
  });

  it('ExecutionZone клампит день по длине отфильтрованного списка', () => {
    expect(executionZone).toContain('resolveRuntimeDayIndex(runtimeDay, trainingDaysList.length)');
  });

  it('индекс вне списка клампится последним днём, пустой список — 0', () => {
    expect(resolveRuntimeDayIndex(5, 3)).toBe(2);
    expect(resolveRuntimeDayIndex(5, 0)).toBe(0);
    expect(resolveRuntimeDayIndex(-2, 3)).toBe(0);
    expect(resolveRuntimeDayIndex(2, 3)).toBe(2);
    expect(resolveRuntimeDayIndex(Number.NaN, 3)).toBe(0);
  });
});
