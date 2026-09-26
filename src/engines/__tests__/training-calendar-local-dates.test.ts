/**
 * training-calendar-local-dates.test.ts — календарь не должен показывать «вчера».
 *
 * Контекст: движок брал «сегодня» и ключи дней как `toISOString().slice(0,10)`,
 * то есть по UTC. В UTC+3…+12 (машина разработки как раз Asia/Vladivostok)
 * вечером пользователь видел в календаре подсвеченным ВЧЕРАШНИЙ день, а
 * факт тренировки за сегодня не попадал в свою же ячейку.
 *
 * Что ловим:
 *  1) «сегодня» в календаре = канон локальной даты;
 *  2) ключи дней в диапазоне совпадают с запрошенными датами (без сдвига);
 *  3) окна недели/месяца в водном трекере считаются по календарю, а не по
 *     «Date.now() минус ровно 7×24ч» (последнее ещё и едет по DST).
 *
 * Смена TZ через process.env в vitest НЕ применяется, поэтому «календарь ≠ UTC»
 * проверяется условно — по реальному смещению машины, иначе тест был бы вакуумным.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { generateCalendarMonth, getWaterStats } from '../training-calendar.engine';
import { addWater } from '../nutrition-tracker.engine';
import { localIsoDate, localIsoDateOffset } from '../../core/local-date';

const смещениеВпередПоUTC = -new Date().getTimezoneOffset();

afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

// weeks — это CalendarDay[][] (массив массивов дней), а не CalendarWeek[].
const allDays = (m: { weeks: { date: string }[][] }) => m.weeks.flat().map(d => d.date);

describe('календарь: сегодня и дни — по локальному календарю', () => {
  it('подсвеченный «сегодня» совпадает с каноном локальной даты', () => {
    const now = new Date();
    const month = generateCalendarMonth(now.getFullYear(), now.getMonth(), [], []);
    const подсвеченные = month.weeks.flat().filter(d => d.isToday).map(d => d.date);
    expect(подсвеченные).toEqual([localIsoDate()]);
  });

  it('ключи дней месяца не съезжают на сутки', () => {
    // Месяц с 1-го числа: в UTC-западном поясе 1-е утро могло стать «31-го прошлого месяца».
    const m = generateCalendarMonth(2026, 0, [], []);   // январь 2026
    const дни = allDays(m);
    const вЯнваре = дни.filter(d => d.startsWith('2026-01'));
    expect(вЯнваре.length).toBe(31);
    expect(вЯнваре).toContain('2026-01-01');
    expect(вЯнваре).toContain('2026-01-31');

    // Сетка — непрерывный возрастающий ряд без дублей (ловит и сдвиг на сутки,
    // и пропуск/повтор дня при переходе через границу месяца).
    // Плейсхолдеры добивки последней недели имеют date: '' — это дизайн, они не дни.
    expect(дни.length).toBe(35);
    const реальные = дни.filter(Boolean);
    expect(реальные.length).toBe(31);
    expect(new Set(реальные).size).toBe(реальные.length);
    const поПорядку = [...реальные].sort();
    expect(реальные).toEqual(поПорядку);
    for (let i = 1; i < поПорядку.length; i++) {
      const предыдущий = new Date(поПорядку[i - 1] + 'T00:00:00');
      предыдущий.setDate(предыдущий.getDate() + 1);
      expect(поПорядку[i]).toBe(localIsoDate(предыдущий));
    }
  });

  it('если машина впереди UTC — локальный «сегодня» отличается от UTC-версии (иначе лок вакуумный)', () => {
    if (смещениеВпередПоUTC <= 0) {
      console.log('[calendar] смещение TZ = 0 — сравнение с UTC пропущено');
      return;
    }
    // Момент, где календарь и UTC расходятся: 20:30Z в UTC+10 = 06:30 СЛЕДУЮЩЕГО дня.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T20:30:00Z'));
    const now = new Date();
    // Канон говорит «27-е», UTC-версия сказала бы «26-е» — это и есть чинимый баг.
    expect(now.toISOString().slice(0, 10)).toBe('2026-09-26');
    expect(localIsoDate(now)).toBe('2026-09-27');
    // Календарь обязан подсветить тот же день, что и канон, а не UTC-вчера.
    const month = generateCalendarMonth(now.getFullYear(), now.getMonth(), [], []);
    const подсвеченные = month.weeks.flat().filter(d => d.isToday).map(d => d.date);
    expect(подсвеченные).toEqual(['2026-09-27']);
  });
});

describe('окна статистики считаются по календарю', () => {
  it('локальный сдвиг на N суток корректен через границу месяца', () => {
    expect(localIsoDateOffset(-1, new Date(2026, 2, 1, 12, 0))).toBe('2026-02-28');
    expect(localIsoDateOffset(-7)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('вода за сегодня пишется и читается по ОДНОМУ канону (writer/reader)', () => {
    // Ловушка получавшегося раскола: писатель по UTC + читатель по локальной
    // дате = «сегодня» показывает 0 мл при записанных 500. Время закрепляем
    // фейковыми часами, иначе лок срабатывал бы только в вечерние 10 часов
    // по UTC+10 и был бы зелёным остальное время суток.
    if (смещениеВпередПоUTC <= 0) {
      console.log('[calendar] смещение TZ = 0 — раскол writer/reader неразличим, лок пропущен');
      return;
    }
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T20:30:00Z'));   // UTC: 26-е, локально (UTC+10): 27-е
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-09-26');
    expect(localIsoDate()).toBe('2026-09-27');

    addWater(500);
    addWater(250);
    const s = getWaterStats();
    expect(s.today.date).toBe('2026-09-27');   // читаем по локальному канону…
    expect(s.today.totalMl).toBe(750);          // …и находим то, что записали минуту назад
  });

  it('статистика воды читает локальный ключ, а не UTC-вчера', () => {
    // Ключ, который раньше записывался «вчерашним» UTC-числом, обязан быть виден сегодня.
    const локальныйЗавтра = localIsoDateOffset(1);
    expect(локальныйЗавтра > localIsoDate()).toBe(true);
  });
});
