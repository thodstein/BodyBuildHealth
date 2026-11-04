/**
 * coach-athlete-log.test.ts — журнал атлета.
 *
 * Главное, что защищаем тестами:
 *  • «вес тела» без веса и подход без упражнения не сохраняются (нет пустых записей);
 *  • тоннаж считается только по записям с весом — никакой подстановки нулей;
 *  • «лучший подход» — максимум среди записанного, а не «расчётный максимум»;
 *  • тренд веса честно молчит, если записей меньше двух;
 *  • лимит 5000 не вытесняет старые записи;
 *  • даты — календарные, «31 февраля» отклоняется.
 */
import { describe, expect, it } from 'vitest';
import { localIsoDate, shiftIsoDate } from '../../../core/local-date';
import {
  COACH_LOG_MAX,
  addCoachLogEntry,
  bestSetFor,
  bodyweightTrend,
  emptyCoachLog,
  exercisesForAthlete,
  entriesForAthlete,
  isValidLogDate,
  logSummaryFor,
  parseCoachLog,
  readCoachLog,
  removeCoachLogEntry,
  serializeCoachLog,
  tonnageInRange,
  updateCoachLogEntry,
  writeCoachLog,
} from '../coach-athlete-log.engine';

const NOW = '2026-11-04T10:00:00.000Z';
const A = 'a1';

const lift = (over: Record<string, unknown> = {}) =>
  addCoachLogEntry(
    emptyCoachLog(),
    { athleteId: A, date: '2026-11-04', exercise: 'Присед', sets: 3, reps: 5, weightKg: 120, ...over },
    { id: 'l1', now: NOW },
  );

describe('добавление записи о подходе', () => {
  it('атлет обязателен', () => {
    const r = addCoachLogEntry(emptyCoachLog(), { exercise: 'Присед', sets: 3, reps: 5, weightKg: 100 });
    expect(r.error).toBe('athlete');
    expect(r.store.items).toHaveLength(0);
  });

  it('упражнение обязательно, подходы/повторы в здравых пределах', () => {
    const r = addCoachLogEntry(
      emptyCoachLog(),
      { athleteId: A, exercise: '   ', sets: 3, reps: 5, weightKg: 100 },
      { id: 'l1' },
    );
    expect(r.error).toBe('exercise');
    expect(addCoachLogEntry(emptyCoachLog(), { athleteId: A, exercise: 'X', sets: 0, reps: 5 }, { id: 'l2' }).error).toBe('sets');
    expect(addCoachLogEntry(emptyCoachLog(), { athleteId: A, exercise: 'X', sets: 3, reps: 0 }, { id: 'l3' }).error).toBe('reps');
  });

  it('запись сохраняется, вес с запятой нормализуется, RPE округляется до 0.5', () => {
    const r = lift({ weightKg: '122,5', rpe: 8.3, note: '  легко  ' });
    expect(r.error).toBeNull();
    expect(r.entry).toMatchObject({ athleteId: A, exercise: 'Присед', sets: 3, reps: 5, weightKg: 122.5, rpe: 8.5, note: 'легко' });
  });

  it('без веса подход допустим (своё тело/резинка), мусор в весе → null, а не 0', () => {
    const r = lift({ weightKg: 'abc' });
    expect(r.entry?.weightKg).toBeNull();
    expect(lift({ weightKg: 0 }).entry?.weightKg).toBeNull();
  });

  it('без даты ставим сегодня по локальному канону', () => {
    const r = addCoachLogEntry(emptyCoachLog(), { athleteId: A, exercise: 'Жим', sets: 3, reps: 5 }, { id: 'l1', now: NOW });
    expect(r.entry?.date).toBe(localIsoDate());
  });

  it('несуществующая дата отклоняется', () => {
    const r = addCoachLogEntry(emptyCoachLog(), { athleteId: A, date: '2026-02-31', exercise: 'Жим', sets: 3, reps: 5 }, { id: 'l1' });
    expect(r.error).toBe('date');
  });

  it(`лимит ${COACH_LOG_MAX}: отказ, старые записи не вытесняются`, () => {
    const items = Array.from({ length: COACH_LOG_MAX }, (_, i) => ({
      id: `l${i}`,
      athleteId: A,
      date: '2026-11-04',
      kind: 'lift' as const,
      exercise: 'Присед',
      sets: 3,
      reps: 5,
      weightKg: 100,
      rpe: null,
      note: '',
      createdAt: NOW,
      updatedAt: NOW,
    }));
    const full = { version: 1 as const, items };
    const r = addCoachLogEntry(full, { athleteId: A, exercise: 'Жим', sets: 3, reps: 5, weightKg: 80 }, { id: 'extra' });
    expect(r.error).toBe('limit');
    expect(r.store).toBe(full);
  });
});

describe('запись веса тела', () => {
  it('вес обязателен — запись без веса не создаётся', () => {
    const r = addCoachLogEntry(emptyCoachLog(), { athleteId: A, kind: 'bodyweight' }, { id: 'b1' });
    expect(r.error).toBe('weight');
    expect(r.store.items).toHaveLength(0);
  });

  it('вес тела сохраняется без подходов и упражнения', () => {
    const r = addCoachLogEntry(
      emptyCoachLog(),
      { athleteId: A, kind: 'bodyweight', weightKg: 82.4, date: '2026-11-04' },
      { id: 'b1', now: NOW },
    );
    expect(r.entry).toMatchObject({ kind: 'bodyweight', weightKg: 82.4, sets: 0, reps: 0, exercise: '' });
  });
});

describe('правка и удаление', () => {
  it('правка пересчитывает поля и отклоняет пустое упражнение', () => {
    const s = lift().store;
    const ok = updateCoachLogEntry(s, 'l1', { weightKg: 125, reps: 4 }, { now: NOW });
    expect(ok.items[0]).toMatchObject({ weightKg: 125, reps: 4 });
    expect(updateCoachLogEntry(ok, 'l1', { exercise: '   ' })).toBe(ok);
    expect(updateCoachLogEntry(ok, 'l1', { date: '2026-13-01' })).toBe(ok);
  });

  it('неизвестный id — no-op; удаление работает', () => {
    const s = lift().store;
    expect(updateCoachLogEntry(s, 'nope', { reps: 1 })).toBe(s);
    expect(removeCoachLogEntry(s, 'nope')).toBe(s);
    expect(removeCoachLogEntry(s, 'l1').items).toEqual([]);
  });
});

describe('арифметика по записям', () => {
  const store = (() => {
    let s = emptyCoachLog();
    const rows = [
      { id: 'l1', date: '2026-10-01', exercise: 'Присед', sets: 3, reps: 5, weightKg: 100 },
      { id: 'l2', date: '2026-11-01', exercise: 'Присед', sets: 5, reps: 3, weightKg: 120 },
      { id: 'l3', date: '2026-11-02', exercise: 'Присед', sets: 1, reps: 1, weightKg: 120 },
      { id: 'l4', date: '2026-11-02', exercise: 'Жим', sets: 4, reps: 6, weightKg: 80 },
      { id: 'l5', date: '2026-11-03', exercise: 'Подтягивания', sets: 3, reps: 8, weightKg: null },
    ];
    for (const r of rows) {
      s = addCoachLogEntry(s, { athleteId: A, ...r }, { id: r.id, now: NOW }).store;
    }
    s = addCoachLogEntry(s, { athleteId: 'a2', date: '2026-11-02', exercise: 'Присед', sets: 1, reps: 1, weightKg: 300 }, { id: 'x1', now: NOW }).store;
    s = addCoachLogEntry(s, { athleteId: A, kind: 'bodyweight', weightKg: 84, date: '2026-10-10' }, { id: 'b1', now: NOW }).store;
    s = addCoachLogEntry(s, { athleteId: A, kind: 'bodyweight', weightKg: 82, date: '2026-11-03' }, { id: 'b2', now: NOW }).store;
    return s;
  })();

  it('записи атлета — свежие сверху и только его', () => {
    const ids = entriesForAthlete(store, A).map(e => e.id);
    expect(ids).toEqual(['b2', 'l5', 'l3', 'l4', 'l2', 'b1', 'l1']);
    expect(ids).not.toContain('x1');
  });

  it('упражнения — без повторов, по алфавиту, чужие не попадают', () => {
    expect(exercisesForAthlete(store, A)).toEqual(['Жим', 'Подтягивания', 'Присед']);
  });

  it('лучший подход: максимальный вес, при равенстве — больше повторов', () => {
    const best = bestSetFor(store, A, 'присед');
    expect(best?.weightKg).toBe(120);
    expect(best?.entry.id).toBe('l2'); // 5×3 тяжелее «1×1»
    expect(best?.times).toBe(2);
  });

  it('лучший подход игнорирует записи без веса и чужих атлетов', () => {
    expect(bestSetFor(store, A, 'Подтягивания')).toBeNull();
    // 300 кг — у другого атлета
    expect(bestSetFor(store, 'a2', 'Присед')?.weightKg).toBe(300);
  });

  it('тоннаж = Σ подходы × повторы × вес, без записей без веса', () => {
    // 3*5*100 + 5*3*120 + 1*1*120 + 4*6*80 = 1500 + 1800 + 120 + 1920
    expect(tonnageInRange(store, A, '2026-10-01', '2026-11-30')).toBe(5340);
    // ноябрь без октября: 1800 + 120 + 1920
    expect(tonnageInRange(store, A, '2026-11-01', '2026-11-30')).toBe(3840);
  });

  it('тренд веса: меньше двух записей — молчим, две — считаем дельту', () => {
    let one = emptyCoachLog();
    one = addCoachLogEntry(one, { athleteId: A, kind: 'bodyweight', weightKg: 82, date: '2026-11-01' }, { id: 'b1', now: NOW }).store;
    expect(bodyweightTrend(one, A, '2026-11-04')).toBeNull();

    const trend = bodyweightTrend(store, A, '2026-11-04', 30);    expect(trend?.deltaKg).toBe(-2);
    expect(trend?.from.weightKg).toBe(84);
    expect(trend?.to.weightKg).toBe(82);
    // окно 7 дней: октябрьская запись не попадает → данных мало
    expect(bodyweightTrend(store, A, '2026-11-04', 7)).toBeNull();
  });

  it('сводка считает записи и тоннаж за 30 дней', () => {
    const sum = logSummaryFor(store, A, '2026-11-04');
    expect(sum.lifts).toBe(5);
    expect(sum.bodyweights).toBe(2);
    expect(sum.entries).toBe(7);
    expect(sum.lastDate).toBe('2026-11-03');
    // 30 дней от 2026-11-04 → с 2026-10-05: октябрьский присед (10-01) вне окна
    expect(sum.tonnage30).toBe(3840);
  });
});

describe('хранение и терпимость', () => {
  it('roundtrip; недоступное/падающее хранилище не роняет', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
    const s = lift().store;
    writeCoachLog(storage, s);
    expect(readCoachLog(storage).items[0].exercise).toBe('Присед');
    expect(readCoachLog(null).items).toEqual([]);
    const throwing = { getItem: () => { throw new Error('boom'); }, setItem: () => { throw new Error('quota'); } };
    expect(readCoachLog(throwing).items).toEqual([]);
    expect(() => writeCoachLog(throwing, s)).not.toThrow();
  });

  it('мусор отбрасывается: без атлета, без упражнения, «вес тела» без веса, дубли id', () => {
    expect(parseCoachLog('{oops').items).toEqual([]);
    expect(parseCoachLog(JSON.stringify({ version: 2, items: [] })).items).toEqual([]);
    const raw = JSON.stringify({
      version: 1,
      items: [
        { id: 'l1', athleteId: 'a1', date: '2026-11-04', kind: 'lift', exercise: 'Присед', sets: 3, reps: 5, weightKg: 100 },
        { id: 'l1', athleteId: 'a1', date: '2026-11-04', kind: 'lift', exercise: 'Дубль', sets: 3, reps: 5, weightKg: 100 },
        { id: 'l2', athleteId: '', date: '2026-11-04', kind: 'lift', exercise: 'X', sets: 3, reps: 5 },
        { id: 'l3', athleteId: 'a1', date: '2026-11-04', kind: 'lift', exercise: '  ', sets: 3, reps: 5 },
        { id: 'b1', athleteId: 'a1', date: '2026-11-04', kind: 'bodyweight', weightKg: null },
        { id: 'b2', athleteId: 'a1', date: '2026-02-31', kind: 'bodyweight', weightKg: 80 },
        'мусор',
      ],
    });
    expect(parseCoachLog(raw).items.map(e => e.id)).toEqual(['l1']);
  });

  it('сериализация сохраняет вид записи, RPE и заметку', () => {
    const s = lift({ rpe: 9, note: 'тяжело' }).store;
    expect(parseCoachLog(serializeCoachLog(s)).items[0]).toMatchObject({ rpe: 9, note: 'тяжело', kind: 'lift' });
  });

  it('проверка даты честная (30 февраля нет)', () => {
    expect(isValidLogDate('2026-02-28')).toBe(true);
    expect(isValidLogDate('2026-02-29')).toBe(false);
    expect(isValidLogDate(shiftIsoDate(localIsoDate(), -1))).toBe(true);
    expect(isValidLogDate('04.11.2026')).toBe(false);
  });
});
