/**
 * week-buckets-and-today-index — две ошибки календаря в дневнике/тренировке.
 *
 *  1. Недельные бакеты аналитики резались по номеру дня месяца (день 7 мешался
 *     с 8–14) и начинались с воскресенья, а `new Date('YYYY-MM-DD')` брал
 *     полночь UTC. Канон — понедельник недели в ЛОКАЛЬНОМ календаре.
 *  2. Кнопка «Сегодня» в ExecutionZone брала номер дня плана `he_pl_runtime`
 *     (после `%` и clamp в длину микроцикла). План и микроцикл — разные
 *     источники: в 4-дневном плане при 3-дневном микроцикле открывался чужой
 *     день. Канон — день недели ВНУТРИ списка дней микроцикла (метки Пн…Вс),
 *     а день отдыха — не выбор дня вовсе.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { weekStartIsoMon, todayTrainingDayIndex } from '../diary-shared';

describe('weekStartIsoMon: неделя с понедельника, без UTC-сдвига', () => {
  it('воскресенье 01.11 принадлежит неделе с понедельника 26.10', () => {
    expect(weekStartIsoMon('2026-11-01')).toBe('2026-10-26');
  });

  it('понедельник — сам себе начало недели', () => {
    expect(weekStartIsoMon('2026-11-02')).toBe('2026-11-02');
  });

  it('суббота 07.11 и воскресенье 08.11 — та же неделя, что понедельник 02.11', () => {
    expect(weekStartIsoMon('2026-11-07')).toBe('2026-11-02');
    expect(weekStartIsoMon('2026-11-08')).toBe('2026-11-02');
  });
});

describe('todayTrainingDayIndex: день внутри списка микроцикла', () => {
  it('пятница 06.11 в 4-дневном Пн/Вт/Чт/Пт — третий индекс', () => {
    expect(todayTrainingDayIndex(['Пн', 'Вт', 'Чт', 'Пт'], '2026-11-06')).toBe(3);
  });

  it('понедельник 02.11 — первый день списка', () => {
    expect(todayTrainingDayIndex(['Пн', 'Вт', 'Чт', 'Пт'], '2026-11-02')).toBe(0);
  });

  it('3-дневный микроцикл Пн/Ср/Пт: пятница — 2, а не clamp из чужого 4-дневного плана', () => {
    // Старый путь брал индекс дня ЧУЖОГО плана и зажимал его в длину списка:
    // второй assert показывает, что индекс теперь идёт от метки дня, а не от плана.
    expect(todayTrainingDayIndex(['Пн', 'Ср', 'Пт'], '2026-11-06')).toBe(2);
    expect(todayTrainingDayIndex(['Пн', 'Ср', 'Пт'], '2026-11-02')).toBe(0);
    expect(todayTrainingDayIndex(['Пн', 'Ср'], '2026-11-06')).toBe(-1);
  });

  it('5-дневный микроцикл Пн/Вт/Ср/Пт/Сб: пятница — 3, хотя шаблон профиля кладёт её в 4', () => {
    expect(todayTrainingDayIndex(['Пн', 'Вт', 'Ср', 'Пт', 'Сб'], '2026-11-06')).toBe(3);
  });

  it('суббота в 3-дневном Пн/Ср/Пт — отдых (-1), а не «показать следующую»', () => {
    expect(todayTrainingDayIndex(['Пн', 'Ср', 'Пт'], '2026-11-07')).toBe(-1);
  });

  it('метка с уточнением матчится по первым двум буквам', () => {
    expect(todayTrainingDayIndex(['Пн (тяж)', 'Пт (лёгк)'], '2026-11-06')).toBe(1);
  });

  it('пустой список — отдых, без исключения', () => {
    expect(todayTrainingDayIndex([], '2026-11-06')).toBe(-1);
    expect(todayTrainingDayIndex([undefined, ''], '2026-11-06')).toBe(-1);
  });
});

describe('ExecutionZone: «Сегодня» берёт день из своего списка', () => {
  const src = readFileSync(join(process.cwd(), 'src/ui/screens/TrainingScreen_parts/ExecutionZone.tsx'), 'utf8');

  it('индекс — todayTrainingDayIndex по меткам дней микроцикла', () => {
    expect(src).toContain('todayTrainingDayIndex(');
    expect(src).toContain('trainingDaysList.map((day: any) => day?.day)');
    expect(src).not.toContain('todayPlanDayIndex');
  });

  it('день отдыха — кнопка неактивна и подписана честно', () => {
    expect(src).toContain('disabled={restToday}');
    expect(src).toContain("'Сегодня — день отдыха'");
    expect(src).toContain("'📅 Сегодня — отдых'");
  });
});
