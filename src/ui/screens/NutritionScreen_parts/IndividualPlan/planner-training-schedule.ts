/**
 * planner-training-schedule.ts — плавающий график тренировок для привязки рациона.
 *
 * Раньше был только фиксированный недельный паттерн trainingDays[7] (Пн..Вс).
 * Теперь три режима:
 *   'weekly'  — фиксированные дни недели (как было);
 *   'eod'     — через день (offset % 2, якорь на чётных днях);
 *   'pattern' — цикл N+M (например 2+1: 2 тренировочных, 1 отдых).
 * offset — день от начала планирования (0 = первый день плана).
 *
 * Чистые функции — тестируются без React/localStorage.
 */

export type TrainScheduleType = 'weekly' | 'eod' | 'pattern';

export interface TrainSchedule {
  enabled: boolean;
  startTime: string;   // 'HH:MM'
  endTime: string;     // 'HH:MM'
  weeklyDays: boolean[]; // 7 элементов (индекс 0 = Пн)
  scheduleType: TrainScheduleType;
  pattern: { work: number; off: number };
}

export const DEFAULT_TRAIN_SCHEDULE: TrainSchedule = {
  enabled: false,
  startTime: '16:00',
  endTime: '18:00',
  weeklyDays: [true, false, true, false, true, true, false],
  scheduleType: 'weekly',
  pattern: { work: 2, off: 1 },
};

/** Нормализация сырого объекта (localStorage / профиль) → валидный TrainSchedule. */
export function normalizeTrainSchedule(raw: any): TrainSchedule {
  const base = DEFAULT_TRAIN_SCHEDULE;
  if (!raw || typeof raw !== 'object') return { ...base, weeklyDays: [...base.weeklyDays], pattern: { ...base.pattern } };
  const type: TrainScheduleType = raw.scheduleType === 'eod' || raw.scheduleType === 'pattern' ? raw.scheduleType : 'weekly';
  const rawDays = Array.isArray(raw.weeklyDays) && raw.weeklyDays.length > 0 ? raw.weeklyDays.map((d: any) => !!d) : null;
  const days = rawDays ? Array.from({ length: 7 }, (_, i) => rawDays[i] ?? false) : [...base.weeklyDays];
  const work = Number.isFinite(raw.pattern?.work) && raw.pattern.work >= 1 && raw.pattern.work <= 7 ? Math.round(raw.pattern.work) : base.pattern.work;
  const off = Number.isFinite(raw.pattern?.off) && raw.pattern.off >= 1 && raw.pattern.off <= 7 ? Math.round(raw.pattern.off) : base.pattern.off;
  const time = (t: any, fb: string) => {
    if (typeof t !== 'string' || !/^\d{1,2}:\d{2}$/.test(t)) return fb;
    const [h, m] = t.split(':').map(Number);
    return (h >= 0 && h <= 23 && m >= 0 && m <= 59) ? t : fb;
  };
  return {
    enabled: !!raw.enabled,
    startTime: time(raw.startTime, base.startTime),
    endTime: time(raw.endTime, base.endTime),
    weeklyDays: days,
    scheduleType: type,
    pattern: { work, off },
  };
}

/**
 * Индекс дня недели для offset = 0 (0 = Пн … 6 = Вс).
 * `weeklyDays` индексируется по дню недели (0 = Пн), а `offset` во всём
 * планировщике отсчитывается от СЕГОДНЯ (`_prepDate = isoAddDays(isoToday(), offset)`).
 * Поэтому база обязана быть сегодняшним днём недели, иначе весь график съезжает.
 * Та же формула, что в `planner-work.ts` (isWorkDayForIndex).
 */
export function todayDowBase(now: Date = new Date()): number {
  return (now.getDay() + 6) % 7;
}

/**
 * Тренировочный ли день offset (0 = СЕГОДНЯ, не «первый день плана»).
 *
 * FIX B4 (аудит 2026-10): раньше `weekly`-ветка читала `weeklyDays[offset % 7]`,
 * то есть offset 0 всегда означал Понедельник, независимо от реальной даты.
 * Сегодняшний понедельник это маскировал; в любой другой день недели график
 * тренировок, peri-workout приёмы, carb-periodization и карточка периодизации
 * смещались на `todayDowBase()` дней. Теперь база — день недели, `dowBase`
 * можно передать явно (тесты / детерминизм / сдвиг на старт плана).
 */
export function isTrainingDayFor(schedule: TrainSchedule, offset: number, dowBase?: number): boolean {
  if (!schedule.enabled) return false;
  switch (schedule.scheduleType) {
    case 'eod': {
      const pos = ((offset % 2) + 2) % 2;
      return pos === 0;
    }
    case 'pattern': {
      const work = Math.max(1, schedule.pattern.work);
      const off = Math.max(1, schedule.pattern.off);
      const cycle = work + off;
      const pos = ((offset % cycle) + cycle) % cycle;
      return pos < work;
    }
    default: {
      const base = typeof dowBase === 'number' && Number.isFinite(dowBase) ? Math.trunc(dowBase) : todayDowBase();
      const pos = (((offset + base) % 7) + 7) % 7;
      return !!schedule.weeklyDays[pos];
    }
  }
}

/** Число тренировочных дней в 7-дневном окне (для сводки/профиля daysPerWeek). */
export function weeklyTrainingCount(schedule: TrainSchedule): number {
  // Окно 0..6 покрывает все 7 дней недели, поэтому количество не зависит от базы;
  // dowBase: 0 передаём явно, чтобы результат не зависел от дня запуска (детерминизм).
  let n = 0;
  for (let d = 0; d < 7; d++) if (isTrainingDayFor(schedule, d, 0)) n++;
  return n;
}

/** Человекочитаемое описание графика (для UI). */
export function describeSchedule(schedule: TrainSchedule): string {
  if (!schedule.enabled) return 'Привязка выключена';
  if (schedule.scheduleType === 'eod') return 'Через день (EOD)';
  if (schedule.scheduleType === 'pattern') {
    return `Цикл ${schedule.pattern.work}+${schedule.pattern.off} (${schedule.pattern.work} тр / ${schedule.pattern.off} отдых)`;
  }
  const train = schedule.weeklyDays.filter(Boolean).length;
  const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const days = schedule.weeklyDays.map((d, i) => (d ? labels[i] : null)).filter(Boolean).join(', ');
  return `Недельный график: ${train} тр (${days})`;
}

/** Снапшот локальных состояний планировщика → объект для localStorage/профиля. */
export function buildTrainSchedule(
  enabled: boolean,
  startTime: string,
  endTime: string,
  weeklyDays: boolean[],
  scheduleType: TrainScheduleType,
  pattern: { work: number; off: number },
): TrainSchedule {
  return normalizeTrainSchedule({ enabled, startTime, endTime, weeklyDays, scheduleType, pattern });
}
