/**
 * combat-e8-tests.test.ts — 8.5 журнал тестов (своя динамика, без норм).
 *
 * Смысл тестов — обратный: в модуле НЕТ норм и НЕТ «прогноза по результату».
 * Проверяется именно это, плюс арифметика «своей базы».
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  COMBAT_TESTS_KEY, COMBAT_TESTS_CAP, COMBAT_TEST_BATTERY, COMBAT_TEST_BY_ID,
  TEST_BATTERY_CAVEAT, CombatTestId, TestEntry,
  normalizeTests, loadTests, addTest, removeTest, testLine, testBattery,
} from '../combat-measurements.engine';

const t = (date: string, testId: CombatTestId, value: number): TestEntry => ({ date, testId, value });

beforeEach(() => localStorage.clear());

describe('E8.5.1 — форма записи', () => {
  it('батарея состоит из обычных полевых тестов с единицами и направлением', () => {
    expect(COMBAT_TEST_BATTERY.length).toBeGreaterThanOrEqual(6);
    for (const d of COMBAT_TEST_BATTERY) {
      expect(d.label.length).toBeGreaterThan(2);
      expect(d.unit.length).toBeGreaterThan(0);
      expect(['up', 'down']).toContain(d.direction);
      expect(d.plausible[0]).toBeLessThan(d.plausible[1]);
    }
  });

  it('время-считающие тесты имеют направление down', () => {
    expect(COMBAT_TEST_BY_ID.shuttle_4x10.direction).toBe('down');
    expect(COMBAT_TEST_BY_ID.plank.direction).toBe('up');
  });

  it('мусор отбрасывается, правдоподобное проходит', () => {
    const out = normalizeTests([
      t('2026-09-01', 'pushup', 30),
      { date: 'bad', testId: 'pushup', value: 30 },
      { date: '2026-09-02', testId: 'нет-такого', value: 5 },
      t('2026-09-03', 'pushup', -4),
      t('2026-09-04', 'pushup', 9999),
      { date: '2026-09-05', testId: 'plank', value: null },
    ] as any);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(30);
  });

  it('одна дата+тест = одна запись, поздняя перезаписывает', () => {
    const out = normalizeTests([t('2026-09-01', 'pushup', 20), t('2026-09-01', 'pushup', 24)] as any);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(24);
  });

  it('кап и сортировка по дате', () => {
    const many = Array.from({ length: COMBAT_TESTS_CAP + 10 }, (_, i) =>
      t(`2026-09-${String((i % 28) + 1).padStart(2, '0')}`, 'pushup', 10 + (i % 5)));
    const out = normalizeTests(many);
    expect(out.length).toBeLessThanOrEqual(COMBAT_TESTS_CAP);
    for (let i = 1; i < out.length; i++) expect(out[i].date >= out[i - 1].date).toBe(true);
  });
});

describe('E8.5.2 — хранилище', () => {
  it('запись долетает и читается обратно', () => {
    expect(addTest('2026-09-10', 'pullup', 12)).toBe(true);
    expect(loadTests()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(COMBAT_TESTS_KEY)!).length).toBe(1);
  });

  it('битое хранилище не ломает чтение и запись', () => {
    localStorage.setItem(COMBAT_TESTS_KEY, '{oops');
    expect(loadTests()).toEqual([]);
    expect(addTest('2026-09-11', 'plank', 120)).toBe(true);
  });

  it('удаление по дате+тесту', () => {
    addTest('2026-09-10', 'pushup', 20);
    addTest('2026-09-10', 'plank', 90);
    expect(removeTest('2026-09-10', 'pushup')).toBe(true);
    const left = loadTests();
    expect(left).toHaveLength(1);
    expect(left[0].testId).toBe('plank');
  });
});

describe('E8.5.3 — своя база, а не чужая норма', () => {
  it('без замеров честный no_data', () => {
    const l = testLine([], 'pushup');
    expect(l.trend).toBe('no_data');
    expect(l.latest).toBeNull();
    expect(l.vsBestPct).toBeNull();
  });

  it('рост считается относительно своих же замеров', () => {
    const l = testLine([t('2026-09-01', 'pushup', 20), t('2026-09-10', 'pushup', 25)], 'pushup');
    expect(l.latest).toBe(25);
    expect(l.best).toBe(25);
    expect(l.trend).toBe('up');
    expect(l.vsBestPct).toBe(0);
  });

  it('для времени лучше меньше — падение это рост формы', () => {
    const l = testLine([t('2026-09-01', 'shuttle_4x10', 22), t('2026-09-10', 'shuttle_4x10', 19)], 'shuttle_4x10');
    expect(l.best).toBe(19);
    expect(l.trend).toBe('up');
  });

  it('для времени рост числа — ухудшение', () => {
    const l = testLine([t('2026-09-01', 'shuttle_4x10', 19), t('2026-09-10', 'shuttle_4x10', 24)], 'shuttle_4x10');
    expect(l.trend).toBe('down');
    expect(l.vsBestPct).toBe(26.3);
  });

  it('один замер — тренда ещё нет, но лучший уже есть', () => {
    const l = testLine([t('2026-09-01', 'plank', 60)], 'plank');
    expect(l.trend).toBe('flat');
    expect(l.best).toBe(60);
    expect(l.count).toBe(1);
  });

  it('сводка честно собирает направление формы', () => {
    const rows = [
      t('2026-09-01', 'pushup', 20), t('2026-09-10', 'pushup', 25),
      t('2026-09-01', 'plank', 60), t('2026-09-10', 'plank', 90),
    ];
    const b = testBattery(rows);
    expect(b.direction).toBe('up');
    expect(b.testsWithData).toBe(2);
    expect(b.note).toMatch(/растёт/);
  });

  it('смешанная динамика не объявляется победой', () => {
    const rows = [
      t('2026-09-01', 'pushup', 20), t('2026-09-10', 'pushup', 25),
      t('2026-09-01', 'shuttle_4x10', 19), t('2026-09-10', 'shuttle_4x10', 24),
    ];
    const b = testBattery(rows);
    expect(b.direction).toBe('mixed');
    expect(b.note).toMatch(/смешанная/);
  });

  it('без данных сводка не врёт', () => {
    const b = testBattery([]);
    expect(b.direction).toBe('no_data');
    expect(b.testsWithData).toBe(0);
    expect(b.note).toMatch(/Замеров нет/);
  });
});

describe('E8.5.4 — главное: норм нет, и это написано', () => {
  it('оговорка про невозможность прогноза присутствует дословно', () => {
    expect(TEST_BATTERY_CAVEAT).toMatch(/не норма/);
    expect(TEST_BATTERY_CAVEAT).toMatch(/41214825/);
    expect(TEST_BATTERY_CAVEAT).toMatch(/планировать бой по этим цифрам нельзя/);
  });

  it('сводка всегда несёт оговорку, даже когда данных нет', () => {
    expect(testBattery([]).caveat).toBe(TEST_BATTERY_CAVEAT);
  });

  it('в блоке 8.5 нет ни одной нормы или вердикта «хорошо/плохо»', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/engines/combat/combat-measurements.engine.ts', 'utf8'));
    const block = src.slice(src.indexOf('8.5 Журнал тестов'), src.indexOf('8.4 Скрининг'));
    // Ловим ИМЕНА констант-норм, а не слово «минимум»: в блоке оно лежит
    // безобидно в «[минимум, максимум]» для отбраковки мусора.
    // (Широкий вариант этого guard'а ловил сам себя — урок из E0.7.)
    expect(block).not.toMatch(/МИНИМУМ_НОРМА|МАКСИМУМ_НОРМА|NORM_MIN|NORM_MAX|normMin|requiredKg/);
    // и нет вердикта по значению
    expect(block).not.toMatch(/verdict:\s*'(good|bad)'|level:\s*'(good|bad)'/);
  });

  it('смысл отказа зафиксирован в коде источником', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/engines/combat/combat-measurements.engine.ts', 'utf8'));
    const block = src.slice(src.indexOf('8.5 Журнал тестов'), src.indexOf('8.4 Скрининг'));
    expect(block).toMatch(/41214825/);
    expect(block).toMatch(/p > 0\.05/);
  });
});
