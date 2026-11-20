/**
 * date-local-today.test.ts — проход 172: даты, которые видит человек, — это
 * его календарный день, а не UTC-день.
 *
 * Проба идёт поведением: время фиксируется на МЕСТНОМ утре (01:00), когда в
 * UTC+10…+12 уже (или ещё) вчера, поэтому прежняя запись
 * `new Date().toISOString().slice(0,10)` вернула бы 20 ноября вместо 21-го.
 * На машине с нулевым/отрицательным смещением разницы нет и проба совпадает с
 * каноном — она не «вакуумная», а просто не различает реализации: канон
 * проверяется на всех машинах, регресс ловится на наших.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { localIsoDate } from '../../core/local-date';
import { generateReportText } from '../../core/export';
import { generateMedicalReportHTML } from '../pdf-report.engine';
import { addWeightEntry, getNutritionV2Data } from '../../core/nutrition-v2-data';
import { buildIntelDeloadIcs } from '../pro/intelligence-export.engine';
import { todayIso } from '../../ui/screens/ProfileScreen_v2/diary-helpers';

/** Местное утро 21.11.2026 — в UTC+10 это ещё 20.11 по UTC. */
const МЕСТНОЕ_УТРО = () => new Date(2026, 10, 21, 1, 0, 0);

afterEach(() => {
  vi.useRealTimers();
});

describe('проход 172: «сегодня» в отчётах — местный день', () => {
  it('текстовый отчёт печатает местную дату', () => {
    vi.useFakeTimers();
    vi.setSystemTime(МЕСТНОЕ_УТРО());
    expect(generateReportText({})).toContain('2026-11-21');
    expect(localIsoDate()).toBe('2026-11-21');
  });

  it('медицинский отчёт печатает местную дату формирования', () => {
    vi.useFakeTimers();
    vi.setSystemTime(МЕСТНОЕ_УТРО());
    const html = generateMedicalReportHTML({ role: 'user' } as any, [], {} as any, null, '');
    expect(html).toContain('Дата формирования: 2026-11-21');
  });

  it('вес записывается в местный день (ключ истории веса)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(МЕСТНОЕ_УТРО());
    localStorage.removeItem('he_nutrition_v2');
    addWeightEntry(80);
    const history = getNutritionV2Data().weightHistory;
    expect(history).toHaveLength(1);
    expect(history[0].date).toBe('2026-11-21');
  });

  it('ICS deload-недели: понедельник считается от местного дня', () => {
    // 21.11.2026 — суббота; следующая неделя начинается 23.11.
    const ics = buildIntelDeloadIcs(true, МЕСТНОЕ_УТРО());
    expect(ics).toBeTruthy();
    expect(ics).toContain('DTSTART:20261123');
    expect(ics).toContain('DTEND:20261130');
  });
});

describe('проход 173: «сегодня» в профиле — местный день', () => {
  it('todayIso (дневники профиля) даёт местную дату', () => {
    // Прежде здесь жили три копии локального форматирования; копии удалены,
    // сигнатура сохранена. Проба держит контракт на месте.
    vi.useFakeTimers();
    vi.setSystemTime(МЕСТНОЕ_УТРО());
    expect(todayIso()).toBe('2026-11-21');
  });
});
