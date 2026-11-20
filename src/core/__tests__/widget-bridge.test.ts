/**
 * widget-bridge.test.ts — JS-фасад виджетов APK.
 * Вне native (jsdom = web) плагин недоступен: проверяем фолбэк-пути
 * (снапшоты/очередь в localStorage), чистые хелперы и разбор очереди
 * виджет -> дневники. Ни один вызов не бросает наружу.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  formatTimer,
  clampPct,
  clampMl,
  parseQueueItems,
  queueWaterMl,
  queueFood,
  queueWidgetSize,
  drainWidgetQueue,
  syncTrainingWidget,
  syncComplianceWidget,
  syncNutritionWidget,
  consumeWidgetLaunchTarget,
  requestPinWidget,
  widgetTimerCommand,
  getWidgetTimerState,
  readFallbackSnapshot,
  resetWidgetBridgeCache,
  normalizeWidgetOpacity,
  widgetOpacity,
  setWidgetOpacity,
  WIDGET_OPACITIES,
} from '../widget-bridge';
import {
  applyWidgetQueue,
  normalizeMealKey,
  collectWorkout,
  collectNutrition,
  addDaysIso,
  resolveWorkoutPlan,
  formatPlanLine,
  trainingWeekdays,
  collectCalendar,
  watchNutritionForWidgets,
} from '../../ui/native/widget-sync';
import { localIsoDate } from '../local-date';

beforeEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  resetWidgetBridgeCache();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  resetWidgetBridgeCache();
});

describe('чистые хелперы', () => {
  it('1. formatTimer MM:SS', () => {
    expect(formatTimer(0)).toBe('00:00');
    expect(formatTimer(90)).toBe('01:30');
    expect(formatTimer(65)).toBe('01:05');
    expect(formatTimer(3600)).toBe('60:00');
    expect(formatTimer(-5)).toBe('00:00');
    expect(formatTimer(NaN)).toBe('00:00');
  });

  it('2. clampPct/clampMl', () => {
    expect(clampPct(150)).toBe(100);
    expect(clampPct(-3)).toBe(0);
    expect(clampPct(72.4)).toBe(72);
    expect(clampPct(NaN)).toBe(0);
    expect(clampMl(0)).toBe(250);
    expect(clampMl(-10)).toBe(250);
    expect(clampMl(5000)).toBe(2000);
    expect(clampMl(330)).toBe(330);
  });

  it('3. parseQueueItems фильтрует мусор', () => {
    expect(parseQueueItems('not-json')).toEqual([]);
    expect(parseQueueItems('{"a":1}')).toEqual([]);
    expect(
      parseQueueItems(
        JSON.stringify([
          { type: 'water', ml: 250, ts: 1 },
          { type: 'food', name: 'X', ts: 2 },
          { type: 'unknown' },
          null,
          42,
        ]),
      ),
    ).toEqual([
      { type: 'water', ml: 250, ts: 1 },
      { type: 'food', name: 'X', ts: 2 },
    ]);
  });
});

describe('фолбэк вне native', () => {
  it('4. очередь воды копится и дренируется с очисткой', async () => {
    expect(await queueWidgetSize()).toBe(0);
    expect(await queueWaterMl(250)).toBe(1);
    expect(await queueWaterMl(500)).toBe(2);
    expect(await queueWidgetSize()).toBe(2);
    const items = await drainWidgetQueue();
    expect(items.length).toBe(2);
    expect(items[0].type).toBe('water');
    expect(await queueWidgetSize()).toBe(0);
    expect(await drainWidgetQueue()).toEqual([]);
  });

  it('5. очередь еды режет невалидные значения', async () => {
    await queueFood({ name: 'Творог', kcal: 240, p: 34, f: 10, c: 6, meal: 'snack' });
    await queueFood({ name: '', kcal: NaN, p: -1, f: 0, c: 0, meal: 'lunch' });
    const items = await drainWidgetQueue();
    expect(items.length).toBe(2);
    expect(items[1].kcal).toBe(0);
    expect(items[1].p).toBe(0);
  });

  it('6. снапшоты пишутся в фолбэк и читаются', async () => {
    expect(await syncTrainingWidget({ title: 'A', subtitle: 'B', meta: 'C' })).toBe(false);
    expect(await syncComplianceWidget({ pct: 142, label: 'L', detail: 'D' })).toBe(false);
    expect(await syncNutritionWidget({
      kcal: 1, targetKcal: 2, protein: 3, fat: 4, carbs: 5,
      targetProtein: 6, targetFat: 7, targetCarbs: 8,
      waterMl: 9, waterTargetMl: 10,
    })).toBe(false);
    const n = readFallbackSnapshot('nutrition') as {
      kcal: number; protein: number; fat: number; carbs: number; waterMl: number;
      targetProtein: number; targetFat: number; targetCarbs: number; waterTargetMl: number;
    };
    expect(n.kcal).toBe(1);
    expect(n.fat).toBe(4);
    expect(n.carbs).toBe(5);
    expect(n.targetProtein).toBe(6);
    expect(n.targetCarbs).toBe(8);
    expect(n.waterTargetMl).toBe(10);
    const t = readFallbackSnapshot('training') as { title: string };
    expect(t.title).toBe('A');
    const c = readFallbackSnapshot('compliance') as { pct: number };
    expect(c.pct).toBe(100);
  });

  it('7. launch target и pin вне native — безопасные no-op', async () => {
    expect(await consumeWidgetLaunchTarget()).toBeNull();
    expect(await requestPinWidget('timer')).toEqual({ requested: false, reason: 'not-native' });
  });

  it('8. таймер вне native возвращает фолбэк без бросков', async () => {
    expect(await widgetTimerCommand('preset', 60)).toEqual({
      running: true,
      remainingSec: 60,
      durationSec: 60,
    });
    expect(await getWidgetTimerState()).toEqual({
      running: false,
      remainingSec: 90,
      durationSec: 90,
    });
  });
});

describe('очередь -> дневники', () => {
  it('9. вода из виджета падает в he_water_log', async () => {
    await queueWaterMl(250);
    await queueWaterMl(500);
    const applied = applyWidgetQueue(await drainWidgetQueue());
    expect(applied).toEqual({
      waterMl: 750,
      foods: 0,
      tasks: 0,
      tasksAdded: 0,
      notesAdded: 0,
      setsAdded: 0,
      workoutsStarted: 0,
      workoutsFinished: 0,
    });
    const log = JSON.parse(localStorage.getItem('he_water_log') || '[]');
    // Канон даты — локальный календарь (`local-date`), а не UTC: `toISOString()`
    // в UTC+10 до 10:00 утра отдаёт «вчера», и тест падал только по утрам.
    const today = localIsoDate();
    const row = log.find((e: { date: string }) => e.date === today);
    expect(row.amountMl).toBe(750);
  });

  it('10. еда из виджета падает в nutrition_diary_v2 (секция дневника)', async () => {
    await queueFood({ name: 'Овсянка', kcal: 300, p: 10, f: 6, c: 55, meal: 'breakfast' });
    const applied = applyWidgetQueue(await drainWidgetQueue());
    expect(applied).toEqual({
      waterMl: 0,
      foods: 1,
      tasks: 0,
      tasksAdded: 0,
      notesAdded: 0,
      setsAdded: 0,
      workoutsStarted: 0,
      workoutsFinished: 0,
    });
    const diary = JSON.parse(localStorage.getItem('nutrition_diary_v2') || '{}');
    const dates = Object.keys(diary).filter((k) => k !== '__version');
    expect(dates.length).toBe(1);
    // Английский ключ виджета приводим к подписи дневника, иначе блюдо
    // оказывается в невидимой секции «breakfast».
    expect(diary[dates[0]].meals['Завтрак'][0].name).toBe('Овсянка');
    expect(diary[dates[0]].meals['Завтрак'][0].kcal).toBe(300);
  });

  it('11. битый элемент не роняет остальные', async () => {
    await queueWaterMl(250);
    const applied = applyWidgetQueue([
      { type: 'water', ml: 100, ts: Date.now() },
      { type: 'food', name: '', ts: Date.now() },
      null as never,
    ]);
    expect(applied.waterMl).toBe(100);
    expect(applied.foods).toBe(0);
  });

  it('12. задача из виджета отмечается в планшете', async () => {
    const { addCoachTask, readCoachPlanner, writeCoachPlanner, emptyCoachPlanner } = await import(
      '../../engines/coach/coach-planner.engine'
    );
    const added = addCoachTask(emptyCoachPlanner(), { title: 'Сдать ферритин', date: localIsoDate() });
    writeCoachPlanner(localStorage, added.store);
    const applied = applyWidgetQueue([
      { type: 'task', id: added.task!.id, done: true, ts: Date.now() },
    ]);
    expect(applied.tasks).toBe(1);
    const stored = readCoachPlanner(localStorage);
    expect(stored.items.find(t => t.id === added.task!.id)?.done).toBe(true);
  });

  it('13. быстрая задача из виджета создаётся с нативным id', async () => {
    const { readCoachPlanner } = await import('../../engines/coach/coach-planner.engine');
    const applied = applyWidgetQueue([
      {
        type: 'task_add',
        id: 'w_task_1',
        title: 'Позвонить тренеру',
        date: localIsoDate(),
        time: '18:00',
        priority: 'high',
        ts: Date.now(),
      },
    ]);
    expect(applied.tasksAdded).toBe(1);
    const stored = readCoachPlanner(localStorage);
    const task = stored.items.find(t => t.id === 'w_task_1');
    expect(task?.title).toBe('Позвонить тренеру');
    expect(task?.time).toBe('18:00');
    expect(task?.priority).toBe('high');
  });

  it('14. быстрая заметка из виджета создаётся с чек-листом', async () => {
    const { readCoachNotes } = await import('../../engines/coach/coach-notes.engine');
    const applied = applyWidgetQueue([
      {
        type: 'note_add',
        id: 'w_note_1',
        title: 'После тренировки',
        checklist: [
          { id: 'c_1', text: 'Растяжка', done: false },
          { id: 'c_2', text: 'Протеин', done: false },
        ],
        ts: Date.now(),
      },
    ]);
    expect(applied.notesAdded).toBe(1);
    const note = readCoachNotes(localStorage).items.find(n => n.id === 'w_note_1');
    expect(note?.title).toBe('После тренировки');
    expect(note?.checklist?.length).toBe(2);
  });

  it('15. отметка «сделано» у только что добавленной с виджета задачи не теряется', async () => {
    const { readCoachPlanner } = await import('../../engines/coach/coach-planner.engine');
    // Порядок как в очереди: сначала задача, потом её отметка.
    const applied = applyWidgetQueue([
      { type: 'task', id: 'w_task_2', done: true, ts: Date.now() },
      {
        type: 'task_add',
        id: 'w_task_2',
        title: 'Выпить креатин',
        date: localIsoDate(),
        ts: Date.now(),
      },
    ]);
    expect(applied.tasksAdded).toBe(1);
    const stored = readCoachPlanner(localStorage);
    const task = stored.items.find(t => t.id === 'w_task_2');
    expect(task?.title).toBe('Выпить креатин');
    expect(task?.done).toBe(true);
  });
});

describe('прозрачность фона виджетов', () => {
  it('16. ступени 100 / 85 / 70 / 50', () => {
    expect(WIDGET_OPACITIES).toEqual([100, 85, 70, 50]);
    expect(normalizeWidgetOpacity(100)).toBe(100);
    expect(normalizeWidgetOpacity(92)).toBe(85);
    expect(normalizeWidgetOpacity(80)).toBe(70);
    expect(normalizeWidgetOpacity(60)).toBe(50);
    expect(normalizeWidgetOpacity(0)).toBe(50);
    expect(normalizeWidgetOpacity(Number.NaN)).toBe(100);
  });

  it('17. вне APK прозрачность 100 и вызовы не бросают', async () => {
    expect(await widgetOpacity()).toBe(100);
    expect(await setWidgetOpacity(80)).toBe(70);
  });
});

describe('приёмы пищи из виджета', () => {
  it('18. английские ключи приводятся к подписям дневника', () => {
    expect(normalizeMealKey('breakfast')).toBe('Завтрак');
    expect(normalizeMealKey('lunch')).toBe('Обед');
    expect(normalizeMealKey('dinner')).toBe('Ужин');
    expect(normalizeMealKey('snack')).toBe('Перекус');
    expect(normalizeMealKey('Ужин')).toBe('Ужин');
    expect(normalizeMealKey('')).toBe('Перекус');
  });
});

describe('виджет «Проведение тренировки»', () => {
  const ACTIVE_KEY = 'he_workout_active_v1';
  const LOG_KEY = 'he_workout_log_v2';

  const PLAN = {
    days: [
      {
        label: 'Верх A',
        exercises: [
          {
            name: 'Жим лёжа',
            muscleGroup: 'chest',
            restSec: 120,
            targetSets: [
              { weight: 80, reps: 8, rir: 2 },
              { weight: 80, reps: 8, rir: 1 },
            ],
          },
          {
            name: 'Тяга блока',
            muscleGroup: 'back',
            targetSets: [{ weight: 60, reps: 12, rir: 3 }],
          },
        ],
      },
      {
        label: 'Низ A',
        exercises: [{ name: 'Присед', muscleGroup: 'legs', targetSets: [{ weight: 100, reps: 5, rir: 2 }] }],
      },
    ],
    focus: 'upper_lower',
    week: 3,
    track: 'bb',
  };

  const seedPlan = () => localStorage.setItem('he_pl_runtime', JSON.stringify(PLAN));

  it('19. план дня: упражнения, подходы и строка плана', () => {
    seedPlan();
    const plan = resolveWorkoutPlan(localIsoDate());
    expect(plan).not.toBeNull();
    expect(plan!.exercises.length).toBe(2);
    expect(plan!.plannedSets).toBe(3);
    expect(formatPlanLine(plan!.exercises[0])).toBe('2×8 · 80 кг');
    // Один подход в плане — RIR выводится, диапазоны не выдумываются.
    expect(formatPlanLine(plan!.exercises[1])).toBe('1×12 · 60 кг · RIR 3');
  });

  it('20. без живой сессии снапшот показывает план с нулевым прогрессом', () => {
    seedPlan();
    const snap = collectWorkout();
    expect(snap.live).toBe(false);
    expect(snap.title).not.toMatch(/●/);
    expect(snap.exercises[0].name).toBe('Жим лёжа');
    expect(snap.exercises[0].done).toBe(0);
    expect(snap.exercises[0].planned).toBe(2);
    expect(snap.exercises[0].weight).toBe(80);
    expect(snap.setsPlanned).toBe(3);
    expect(snap.progress).toBe(0);
  });

  it('21. подход с виджета запускает сессию из плана и пишется в live-сессию', () => {
    seedPlan();
    const applied = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 82.5, reps: 7, rir: 2, ts: Date.now() },
    ]);
    expect(applied.setsAdded).toBe(1);
    expect(applied.workoutsStarted).toBe(1);

    const active = JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null');
    expect(active).not.toBeNull();
    expect(active.exercises.length).toBe(2);
    const set = active.exercises[0].sets[0];
    expect(set.weightKg).toBe(82.5);
    expect(set.reps).toBe(7);
    expect(set.rir).toBe(2);
    // RPE выводится как 10 − RIR, если не задан явно.
    expect(set.rpe).toBe(8);
    expect(active.plannedSetsTotal).toBe(3);

    // Снапшот после записи: живая сессия, прогресс 1 из 3.
    const snap = collectWorkout();
    expect(snap.live).toBe(true);
    expect(snap.setsDone).toBe(1);
    expect(snap.exercises[0].done).toBe(1);
    expect(snap.progress).toBe(33);
  });

  it('22. техника и пауза сохраняются в подходе', () => {
    seedPlan();
    applyWidgetQueue([
      {
        type: 'set_add',
        exerciseName: 'Жим лёжа',
        weight: 100,
        reps: 3,
        rir: 1,
        rpe: 9.5,
        technique: 5,
        pause: true,
        notes: 'локти ближе',
        ts: Date.now(),
      },
    ]);
    const active = JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null');
    const set = active.exercises[0].sets[0];
    expect(set.rpe).toBe(9.5);
    expect(set.techniqueScore).toBe(5);
    expect(set.pause).toBe(true);
    expect(set.notes).toBe('локти ближе');
  });

  it('23. «Завершить» сохраняет сессию в журнал и очищает живую', () => {
    seedPlan();
    applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 80, reps: 8, rir: 2, ts: Date.now() },
    ]);
    const res = applyWidgetQueue([{ type: 'workout_finish', ts: Date.now() }]);
    expect(res.workoutsFinished).toBe(1);
    expect(localStorage.getItem(ACTIVE_KEY)).toBeNull();

    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    expect(log.length).toBe(1);
    expect(log[0].totalSets).toBe(1);
    expect(log[0].exercises[0].exerciseName).toBe('Жим лёжа');
    // После завершения виджет снова показывает план, а не «идёт».
    expect(collectWorkout().live).toBe(false);
  });

  it('24. вес 0 отклоняется: ни подхода, ни сессии', () => {
    seedPlan();
    const res = applyWidgetQueue([
      { type: 'set_add', exerciseName: 'Жим лёжа', weight: 0, reps: 8, ts: Date.now() },
    ]);
    expect(res.setsAdded).toBe(0);
    expect(res.workoutsStarted).toBe(0);
    expect(localStorage.getItem(ACTIVE_KEY)).toBeNull();
  });

  it('25. без плана снапшот честно пуст и не выдумывает упражнения', () => {
    const snap = collectWorkout();
    expect(snap.exercises).toEqual([]);
    expect(snap.subtitle).toContain('План не найден');
  });

  it('26. график тренировок дня: настройка профиля и раскладка daysPerWeek', () => {
    expect(trainingWeekdays({ daysPerWeek: 3 })).toEqual([
      true, false, true, false, true, false, false,
    ]);
    expect(
      trainingWeekdays({
        daysPerWeek: 3,
        schedule: { enabled: true, scheduleType: 'weekly', weeklyDays: [true, false, false, true, false, false, false] },
      }),
    ).toEqual([true, false, false, true, false, false, false]);
  });
});

describe('календарь: тренировки, БАДы, фарма и дела', () => {
  it('27. график тренировок попадает в события календаря', () => {
    const cal = collectCalendar();
    const training = cal.items.filter(i => i.kind === 'training');
    expect(training.length).toBeGreaterThan(30);
    // Дни недели тренировок повторяются по графику, а не «каждый день».
    const dows = new Set(training.map(t => new Date(`${t.date}T00:00:00`).getDay()));
    expect(dows.size).toBeGreaterThan(0);
    expect(dows.size).toBeLessThan(7);
    expect(training[0].title).toContain('Тренировка');
  });

  it('28. БАДы и инъекции видны, «сделано» берётся из дневников', () => {
    const today = localIsoDate();
    localStorage.setItem('he_support_plan_result', JSON.stringify(['mag', 'd3']));
    localStorage.setItem(
      'he_support_diary',
      JSON.stringify([{ date: today, substances: { mag: { taken: true }, d3: { taken: true } } }]),
    );
    const dow = (new Date(`${today}T00:00:00`).getDay() + 6) % 7;
    localStorage.setItem(
      'he_injection_schedule',
      JSON.stringify([
        { id: 'inj1', substance: 'Тестостерон энантат', dose: '250 мг', daysOfWeek: [dow], active: true },
      ]),
    );
    localStorage.setItem(
      'he_injection_diary',
      JSON.stringify([{ date: today, substance: 'Тестостерон энантат', dose: '250 мг' }]),
    );

    const cal = collectCalendar();
    const supp = cal.items.find(i => i.kind === 'supp' && i.date === today);
    expect(supp).toBeTruthy();
    expect(supp!.done).toBe(true);
    expect(supp!.title).toContain('БАДы');

    const pharma = cal.items.find(i => i.kind === 'pharma' && i.date === today);
    expect(pharma).toBeTruthy();
    expect(pharma!.done).toBe(true);
    expect(pharma!.title).toContain('Тестостерон');
  });

  it('29. личные дела остаются в календаре с kind=task', async () => {
    const { addCoachTask, readCoachPlanner, writeCoachPlanner, emptyCoachPlanner } = await import(
      '../../engines/coach/coach-planner.engine'
    );
    const added = addCoachTask(emptyCoachPlanner(), { title: 'Позвонить врачу', date: localIsoDate() });
    writeCoachPlanner(localStorage, added.store);

    const cal = collectCalendar();
    const task = cal.items.find(i => i.id === added.task!.id);
    expect(task).toBeTruthy();
    expect(task!.kind).toBe('task');
    expect(task!.title).toBe('Позвонить врачу');
  });
});

describe('аналитика питания: день, неделя, месяц', () => {
  it('30. еда из виджета несёт порцию и приём пищи', async () => {
    await queueFood({ name: 'Овсянка', kcal: 350, p: 12, f: 8, c: 55, meal: 'Завтрак', qty: 250 });
    await queueFood({ name: 'Гигантская порция', kcal: 900, p: 1, f: 1, c: 1, meal: 'lunch', qty: 99999 });
    const items = await drainWidgetQueue();
    expect(items[0].qty).toBe(250);
    expect(items[0].meal).toBe('Завтрак');
    // Порция ограничена 5 кг — как и в дневнике.
    expect(items[1].qty).toBe(5000);
  });

  it('31. syncNutritionWidget держит периоды и обрезает отрицательные значения', async () => {
    const ok = await syncNutritionWidget({
      kcal: 100,
      targetKcal: 2000,
      protein: 10,
      fat: 5,
      carbs: 20,
      targetProtein: 100,
      targetFat: 60,
      targetCarbs: 200,
      waterMl: 300,
      waterTargetMl: 2000,
      periods: {
        day: { kcal: 100, protein: 10, fat: 5, carbs: 20, waterMl: 300, days: 1, waterDays: 1 },
        week: { kcal: -50, protein: 70, fat: -1, carbs: 120, waterMl: -10, days: 2, waterDays: 1 },
        month: { kcal: 1200, protein: 70, fat: 40, carbs: 120, waterMl: 900, days: 3, waterDays: 3 },
      },
    });
    // Вне native — фолбэк-снапшот, но контракт периодов тот же.
    expect(ok).toBe(false);
    const snap = readFallbackSnapshot('nutrition') as {
      periods: Record<string, { kcal: number; fat: number; waterMl: number; days: number }>;
    };
    expect(snap.periods.week.kcal).toBe(0);
    expect(snap.periods.week.fat).toBe(0);
    expect(snap.periods.week.waterMl).toBe(0);
    expect(snap.periods.month.days).toBe(3);
  });

  it('32. collectNutrition: неделя с Пн и месяц включают записи периода', async () => {
    const { writeDiaryV2 } = await import('../../ui/screens/NutritionScreen_parts/diary-storage-v2');
    const { addWater } = await import('../../engines/nutrition-tracker.engine');

    const today = localIsoDate();
    const [y, m, d] = today.split('-').map(Number);
    const mondayIdx = (new Date(y, m - 1, d).getDay() + 6) % 7; // 0 = Пн
    const monday = addDaysIso(today, -mondayIdx);
    const otherDay = mondayIdx === 0 ? null : monday;

    // Запись в понедельник текущей недели + сегодня (дальше от недели не уходим).
    const entryKcal: Record<string, number> = {};
    entryKcal[today] = 620;
    if (otherDay && otherDay !== today) entryKcal[otherDay] = 500;

    const meals: Record<string, { meals: Record<string, any[]> }> = {};
    for (const [date, kcal] of Object.entries(entryKcal)) {
      meals[date] = {
        meals: { lunch: [{ name: 'Блюдо', kcal, p: 30, f: 10, c: 50, qty: 150 }] },
      };
    }
    writeDiaryV2(meals as any);
    addWater(400);

    const sum = (from: string, to: string) =>
      Object.entries(entryKcal)
        .filter(([date]) => date >= from && date <= to)
        .reduce((acc, [, kcal]) => acc + kcal, 0);
    const count = (from: string, to: string) =>
      Object.keys(entryKcal).filter((date) => date >= from && date <= to).length;

    const monthFirst = `${y}-${`${m}`.padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const monthLast = `${y}-${`${m}`.padStart(2, '0')}-${`${lastDay}`.padStart(2, '0')}`;
    const weekLast = addDaysIso(monday, 6);

    const n = collectNutrition();
    expect(n.periods.day.kcal).toBe(entryKcal[today]);
    expect(n.periods.day.waterMl).toBe(400);
    expect(n.periods.week.kcal).toBe(sum(monday, weekLast));
    expect(n.periods.week.days).toBe(count(monday, weekLast));
    expect(n.periods.month.kcal).toBe(sum(monthFirst, monthLast));
    expect(n.periods.month.days).toBe(count(monthFirst, monthLast));
    expect(n.periods.month.days).toBeGreaterThanOrEqual(n.periods.week.days);
  });

  it('33. collectNutrition: цели как на экране «Питание» — из плана, не из профиля', async () => {
    const { writeDiaryV2 } = await import('../../ui/screens/NutritionScreen_parts/diary-storage-v2');
    const { publishPlanTargets, PLAN_TARGETS_KEY } = await import(
      '../../ui/screens/NutritionScreen_parts/IndividualPlan/plan-targets-bridge'
    );

    const today = localIsoDate();
    writeDiaryV2({
      [today]: { meals: { lunch: [{ name: 'Блюдо', kcal: 700, p: 40, f: 20, c: 70, qty: 200 }] } },
    } as any);

    publishPlanTargets({ kcal: 2150, protein: 180, fats: 60, carbs: 210 });
    const n = collectNutrition();

    // Цели — ровно те, что видит дневник (мост плана), а не профильный расчёт.
    expect(n.targetKcal).toBe(2150);
    expect(n.targetProtein).toBe(180);
    expect(n.targetFat).toBe(60);
    expect(n.targetCarbs).toBe(210);
    // Факт КБЖУ берётся из дневника и целью не подменяется.
    expect(n.kcal).toBe(700);
    expect(n.protein).toBe(40);
    expect(n.fat).toBe(20);
    expect(n.carbs).toBe(70);
    expect(JSON.parse(localStorage.getItem(PLAN_TARGETS_KEY) || '{}').kcal).toBe(2150);
  });

  it('34. без плана цели виджета остаются профильными, мусорный план их не подменяет', async () => {
    const { PLAN_TARGETS_KEY } = await import(
      '../../ui/screens/NutritionScreen_parts/IndividualPlan/plan-targets-bridge'
    );
    const before = collectNutrition();
    expect(before.targetKcal).toBeGreaterThan(0);
    expect(before.targetProtein).toBeGreaterThan(0);

    // Полупустой/нулевой план — не цель: мост отбрасывает его (kcal <= 0).
    localStorage.setItem(
      PLAN_TARGETS_KEY,
      JSON.stringify({ kcal: 0, protein: 999, fats: 1, carbs: 1 }),
    );
    const after = collectNutrition();
    expect(after.targetKcal).toBe(before.targetKcal);
    expect(after.targetProtein).toBe(before.targetProtein);
    // Вода планом не задаётся — цель остаётся профильной.
    expect(after.waterTargetMl).toBeGreaterThan(0);
  });

  it('35. правка дневника сразу пере-пушивает снапшот питания', async () => {
    const { writeDiaryV2 } = await import('../../ui/screens/NutritionScreen_parts/diary-storage-v2');
    vi.useFakeTimers();
    try {
      const off = watchNutritionForWidgets(10);
      const today = localIsoDate();
      writeDiaryV2({
        [today]: { meals: { lunch: [{ name: 'Блюдо', kcal: 480, p: 30, f: 12, c: 55 }] } },
      } as any);
      await vi.advanceTimersByTimeAsync(60);

      const snap = readFallbackSnapshot('nutrition') as {
        kcal: number;
        protein: number;
        periods: { day: { kcal: number; protein: number } };
      };
      // Снапшот обновлён без возврата приложения в фокус — цифры стола совпадают.
      expect(snap.kcal).toBe(480);
      expect(snap.protein).toBe(30);
      expect(snap.periods.day.kcal).toBe(480);
      expect(snap.periods.day.protein).toBe(30);
      off();
    } finally {
      vi.useRealTimers();
    }
  });
});
