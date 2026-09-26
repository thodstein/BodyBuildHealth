/**
 * free-engines-date-canon.test.ts — канон календарной даты в «прочих» движках.
 *
 * Раунд: periodization-designer, coaching-psychology, cooldown, mindset-protocol,
 * body-composition, diary-insights, mobility-protocol, pct-planner, warmup
 * (labs-scheduler — отдельно, см. ниже).
 *
 * ПОЧЕМУ ВРЕМЯ В ТЕСТЕ УТРЕННЕЕ, А НЕ ВЕЧЕРНЕЕ. Все проверки сидят на одном
 * моменте 08:00 по местному времени 27-го. В UTC+ это 22:00 ПРЕДЫДУЩЕГО дня, то
 * есть именно в этот час код «извлекает день из момента» и получает вчерашнюю
 * дату. Вечерний сдвиг тоже ловится, но утро — это реальный сценарий: утренняя
 * отметка разминки, чек-ин, взвешивание, «сегодня» в сводках. Если система
 * сдвинута назад (UTC-минус), этот тест становится вакуумным — поэтому
 * оговорка печатается, и мутация (возврат UTC) тогда роняет source-guard.
 *
 * ЧТО ТЕСТ ЛОВИТ (не «наличие строки», а следствие):
 *  1) writer/reader-пары дневных ключей — запись и чтение обязаны говорить об
 *     ОДНОМ дне, иначе утренняя отметка не попадает в серию/сводку дня;
 *  2) серии (разминка, заминка, привычки, ПР) — счётчик обязан считать день
 *     «сегодня», а не вчера;
 *  3) окна приверженности — граничная пара (−N дней внутри / −N−1 снаружи),
 *     потому что сдвиг окна на сутки незаметен на «середине»;
 *  4) прогнозы/проекции (вес, ПКТ, ПР) — стартовая точка = календарный «сегодня»;
 *  5) labs-scheduler: 3 оставшихся date-only места — НЕ долг (арифметика над
 *     строкой даты, см. комментарий в движке), и это зафиксировано явно.
 *
 * ГРАНИЦА: обработчики хабов/компонентов не вызываются — здесь чистые движки,
 * поэтому локи поведенческие и дешёвые.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { localIsoDate, localIsoDateOffset, shiftIsoDate } from '../../core/local-date';

// Момент, в котором UTC отстаёт от календаря ровно на сутки.
const УТРО_СЛЕДУЮЩЕГО_ДНЯ = new Date(2026, 8, 27, 8, 0); // 27-е 08:00 местного
const СЕГОДНЯ = '2026-09-27';                              // календарь
const ВЧЕРА_ПО_UTC = '2026-09-26';                         // то, что «видит» toISOString()

/** Смещение машины вперёд UTC. На UTC-минус локи-различители вакуумны. */
const СМЕЩЕНИЕ_ВПЕРЕД = -new Date(2026, 8, 27).getTimezoneOffset() > 0;

const src = (файл: string) => readFileSync(join(process.cwd(), 'src/engines', файл), 'utf8');
const безКомментариев = (код: string) => код.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const dateOnly = (файл: string) => (безКомментариев(src(файл)).match(/\.toISOString\(\)\s*\.slice\(\s*0\s*,\s*10\s*\)/g) || []).length;

const ЧИСТЫЕ_ФАЙЛЫ = [
  'periodization-designer.engine.ts',
  'coaching-psychology.engine.ts',
  'cooldown.engine.ts',
  'mindset-protocol.engine.ts',
  'body-composition.engine.ts',
  'diary-insights.engine.ts',
  'mobility-protocol.engine.ts',
  'pct-planner.engine.ts',
  'warmup.engine.ts',
];

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(УТРО_СЛЕДУЮЩЕГО_ДНЯ);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('исходная точка: этот момент действительно различает календарь и UTC', () => {
  it('канон даёт 27-е, UTC отстаёт на 26-е', () => {
    expect(localIsoDate(new Date())).toBe(СЕГОДНЯ);
    if (СМЕЩЕНИЕ_ВПЕРЕД) {
      expect(new Date().toISOString().slice(0, 10)).toBe(ВЧЕРА_ПО_UTC);
    } else {
      console.log('[date-canon] машина не впереди UTC — поведенческие локи-различители вырождены, держит source-guard');
    }
  });
});

describe('writer/reader дневных ключей: запись и чтение — один календарный день', () => {
  it('привычка: toggleHabit пишет сегодняшний ключ, который потом читает getHabitStats', async () => {
    const { toggleHabit, getHabitStats, loadHabits } = await import('../periodization-designer.engine');
    const после = toggleHabit('water');
    const вчера = после.find(h => h.id === 'water')!.completions.find(c => c.date === СЕГОДНЯ);
    expect(вчера, `toggleHabit записал не ${СЕГОДНЯ}`).toBeTruthy();
    expect(loadHabits().find(h => h.id === 'water')!.streak).toBe(1);
    const stats = getHabitStats();
    expect(stats.todayCompleted).toBe(1);
    expect(stats.bestHabit.streak).toBe(1);
  });

  it('цель и веха: createGoal/addMilestone ставят дату дня создания', async () => {
    const { createGoal, addGoal, addMilestone, loadGoals } = await import('../periodization-designer.engine');
    const goal = createGoal('Присед 140', 'strength', 140, 'кг', '2026-12-31');
    expect(goal.startDate).toBe(СЕГОДНЯ);
    addGoal(goal);
    addMilestone(goal.id, 120);
    const цели = loadGoals();
    expect(цели[0].milestones[0].date).toBe(СЕГОДНЯ);
  });

  it('рекорд ПР: recordPR пишет календарный день, серия его же читает', async () => {
    const { recordPR, getPRStats } = await import('../coaching-psychology.engine');
    const запись = recordPR({ exercise: 'Присед', weight: 140, reps: 1 } as never);
    expect(запись.date).toBe(СЕГОДНЯ);
    const stats = getPRStats();
    expect(stats.prStreak, 'ПР записан сегодня, но серия не увидела его').toBe(1);
    // ОДИН ПР за сегодня: цикл серии доходит до конца списка и НЕ делает break,
    // поэтому daysSinceLastPR считается запасной веткой — ровно та, где старый
    // код писал Math.round(минус_2_часа / сутки) = -0 (отрицательный ноль).
    expect(stats.daysSinceLastPR, 'ПР сделан сегодня — «дней назад» не может быть отрицательным нулём').toBe(0);
  });

  it('серия ПР за два дня подряд: серия 2, «дней назад» = 0', async () => {
    const { recordPR, getPRStats } = await import('../coaching-psychology.engine');
    localStorage.setItem('he_pr_tracker', JSON.stringify([
      { exercise: 'Присед', weight: 130, reps: 1, date: localIsoDateOffset(-1), estimated1RM: 130 },
    ]));
    recordPR({ exercise: 'Присед', weight: 140, reps: 1 } as never);
    const stats = getPRStats();
    expect(stats.prStreak).toBe(2);
    expect(stats.daysSinceLastPR).toBe(0);
  });

  it('сессия дневника: createSession без даты ставит сегодняшний день', async () => {
    const { createSession } = await import('../diary-insights.engine');
    expect(createSession({ focus: 'fullbody' }).date).toBe(СЕГОДНЯ);
    expect(createSession({ focus: 'fullbody', date: '2026-01-01' }).date).toBe('2026-01-01');
  });

  it('прогресс дня мышления: saveDayProgress без даты → loadDayProgress() без даты находит его', async () => {
    const { saveDayProgress, loadDayProgress } = await import('../mindset-protocol.engine');
    saveDayProgress({ date: СЕГОДНЯ, doneItems: ['ritual-1'] });
    const прочитали = loadDayProgress();
    expect(прочитали.date).toBe(СЕГОДНЯ);
    expect(прочитали.doneItems, 'запись за сегодня не нашлась — ключи разошлись').toEqual(['ritual-1']);
    expect(loadDayProgress('2026-01-01').doneItems).toEqual([]);
  });

  it('прогресс дня мобильности: та же пара ключей', async () => {
    const { saveMobilityDayProgress, loadMobilityDayProgress } = await import('../mobility-protocol.engine');
    saveMobilityDayProgress({ date: СЕГОДНЯ, doneItems: ['hip-1'] });
    const прочитали = loadMobilityDayProgress();
    expect(прочитали.date).toBe(СЕГОДНЯ);
    expect(прочитали.doneItems).toEqual(['hip-1']);
  });
});

describe('серии не должны терять «сегодня»', () => {
  it('разминка: отметка сегодня = серия 1', async () => {
    const { upsertWarmupLog, warmupStreak } = await import('../warmup.engine');
    upsertWarmupLog({ date: СЕГОДНЯ, done: true, quality: 4 } as never);
    expect(warmupStreak(), 'серия разминки обнулилась из-за сдвига дня').toBe(1);
  });

  it('заминка: отметка сегодня = серия 1', async () => {
    const { upsertCooldownLog, cooldownStreak } = await import('../cooldown.engine');
    upsertCooldownLog({ date: СЕГОДНЯ, done: true, quality: 4 } as never);
    expect(cooldownStreak(), 'серия заминки обнулилась из-за сдвига дня').toBe(1);
  });

  it('серия из нескольких дней: вчера+позавчера продолжаются сегодняшней отметкой', async () => {
    const { upsertWarmupLog, warmupStreak } = await import('../warmup.engine');
    upsertWarmupLog({ date: localIsoDateOffset(-1), done: true, quality: 4 } as never);
    upsertWarmupLog({ date: localIsoDateOffset(-2), done: true, quality: 4 } as never);
    upsertWarmupLog({ date: СЕГОДНЯ, done: true, quality: 4 } as never);
    expect(warmupStreak()).toBe(3);
  });
});

describe('окна приверженности: граничная пара (−N внутри / −N−1 снаружи)', () => {
  it('разминка за 30 дней', async () => {
    const { upsertWarmupLog, warmupAdherence } = await import('../warmup.engine');
    upsertWarmupLog({ date: localIsoDateOffset(-30), done: true, quality: 3 } as never);
    expect(warmupAdherence(30).total, 'запись ровно на −30 дней выпала из окна').toBe(1);
    upsertWarmupLog({ date: localIsoDateOffset(-31), done: true, quality: 3 } as never);
    expect(warmupAdherence(30).total, 'запись на −31 день попала в окно').toBe(1);
  });

  it('заминка за 30 дней', async () => {
    const { upsertCooldownLog, cooldownAdherence } = await import('../cooldown.engine');
    upsertCooldownLog({ date: localIsoDateOffset(-30), done: true, quality: 3 } as never);
    expect(cooldownAdherence(30).total).toBe(1);
    upsertCooldownLog({ date: localIsoDateOffset(-31), done: true, quality: 3 } as never);
    expect(cooldownAdherence(30).total).toBe(1);
  });

  it('мобильность за 30 дней', async () => {
    const { upsertMobilityCheckin, mobilityAdherence } = await import('../mobility-protocol.engine');
    upsertMobilityCheckin({ date: localIsoDateOffset(-30), done: true, romScore: 4 });
    expect(mobilityAdherence(30).total).toBe(1);
    upsertMobilityCheckin({ date: localIsoDateOffset(-31), done: true, romScore: 4 });
    expect(mobilityAdherence(30).total).toBe(1);
  });

  it('протокол мышления за 30 дней', async () => {
    const { upsertCheckin, protocolAdherence } = await import('../mindset-protocol.engine');
    upsertCheckin({ date: localIsoDateOffset(-30), confidence: 4, arousal: 3, focus: 4, protocolFollowed: true } as never);
    expect(protocolAdherence(30).total).toBe(1);
    upsertCheckin({ date: localIsoDateOffset(-31), confidence: 4, arousal: 3, focus: 4, protocolFollowed: true } as never);
    expect(protocolAdherence(30).total).toBe(1);
  });

  it('недельный объём дневника: запись ровно неделю назад входит в окно', async () => {
    const { createSession, createSet, buildHistoryContext } = await import('../diary-insights.engine');
    const сессия = createSession({ sessionId: 's1', date: localIsoDateOffset(-7), focus: 'fullbody' });
    const сет = createSet({ setId: 'x1', sessionId: 's1', exerciseId: 'bench', actualReps: 5, actualWeight: 100 } as never);
    expect(buildHistoryContext([сет] as never, [сессия] as never).weeklyVolume).toBe(500);
  });
});

describe('прогнозы и проекции стартуют от календарного «сегодня»', () => {
  it('проекция веса: первая точка = сегодня, дальше +7 дней', async () => {
    const { projectWeight } = await import('../body-composition.engine');
    const прогноз = projectWeight(100, -0.5, 90, 2);
    expect(прогноз[0].date).toBe(СЕГОДНЯ);
    expect(прогноз[1].date).toBe(shiftIsoDate(СЕГОДНЯ, 7));
    expect(прогноз[2].date).toBe(shiftIsoDate(СЕГОДНЯ, 14));
  });

  it('ПКТ без активных препаратов: startDate = сегодня', async () => {
    const { generatePCTPlan } = await import('../pct-planner.engine');
    expect(generatePCTPlan([], 4).startDate).toBe(СЕГОДНЯ);
  });

  it('ПКТ с курсом: старт = сегодня + смещение в неделях', async () => {
    const { generatePCTPlan } = await import('../pct-planner.engine');
    const курс = [{ id: 'd1', substanceId: 'tren_ace', doseValue: 200, doseUnit: 'мг', frequency: 'daily', startWeek: 1, endWeek: 8 }];
    const план = generatePCTPlan(курс as never, 8);
    const ожидание = localIsoDateOffset(Math.ceil(план.pctStartWeek - 8) * 7);
    expect(план.startDate).toBe(ожидание);
  });

  it('прогноз следующего ПР: дата считается от сегодняшнего календаря', async () => {
    const { recordPR, getPRStats } = await import('../coaching-psychology.engine');
    // Старый ПР сеем в журнал напрямую: recordPR всегда штампует СЕГОДНЯ, а для
    // прогноза нужен восходящий тренд (два РАЗНЫХ дня), иначе daysDiff = 0.
    localStorage.setItem('he_pr_tracker', JSON.stringify([
      { exercise: 'Жим', weight: 100, reps: 1, date: localIsoDateOffset(-30), estimated1RM: 100 },
    ]));
    recordPR({ exercise: 'Жим', weight: 110, reps: 1 } as never);
    // Про daysSinceLastPR здесь НЕ утверждаем: с разрывом в серии срабатывает
    // другая, предсуществующая ветвь цикла (индекс пропущенного дня). Это не
    // канон дат, и её семантику этот раунд не трогает.
    const прогноз = getPRStats().projectedNextPR['Жим'];
    expect(прогноз, 'прогноз не построился — нужен восходящий тренд').toBeTruthy();
    expect(прогноз.date >= СЕГОДНЯ, `прогноз ${прогноз.date} раньше сегодня`).toBe(true);
  });
});

describe('labs-scheduler: 3 оставшихся date-only — арифметика над датой, а не долг', () => {
  it('каждое dueDate = startDate + N недель (свойство не зависит от смещения)', async () => {
    const { generateCheckpoints } = await import('../labs-scheduler.engine');
    const ctx = { age: 30, sex: 'male', weight: 80, height: 180, bodyFat: 15, level: 'intermediate' } as never;
    const чекпоинты = generateCheckpoints('course', '2026-09-27', 12, ctx);
    expect(чекпоинты.length).toBeGreaterThan(0);
    for (const т of чекпоинты) {
      expect(т.dueDate, `неделя ${т.weekOffset}: ${т.dueDate} != старт+${т.weekOffset} нед`).toBe(
        shiftIsoDate('2026-09-27', т.weekOffset * 7),
      );
    }
  });

  it('в зоне контура это единственный файл с date-only, и ровно 3 — решение зафиксировано', () => {
    const с_долгом = ЧИСТЫЕ_ФАЙЛЫ.filter(ф => dateOnly(ф) > 0);
    expect(с_долгом, `date-only вернулись в: ${с_долгом.join(', ')}`).toEqual([]);
    // Осознанное исключение: см. комментарий в labs-scheduler.engine.ts.
    expect(dateOnly('labs-scheduler.engine.ts')).toBe(3);
  });
});

describe('source-guard: канон импортирован и date-only не вернулся', () => {
  it('все 9 движков берут дату из core/local-date', () => {
    for (const ф of ЧИСТЫЕ_ФАЙЛЫ) {
      expect(dateOnly(ф), `${ф}: date-only вызов вернулся`).toBe(0);
      expect(src(ф), `${ф}: нет импорта канона`).toMatch(/from '\.\.\/core\/local-date'/);
    }
  });

  it('cooldown: сдвиг даты идёт через shiftIsoDate, а не самописной UTC-математикой', () => {
    expect(src('cooldown.engine.ts')).toMatch(/shiftIsoDate/);
  });
});
