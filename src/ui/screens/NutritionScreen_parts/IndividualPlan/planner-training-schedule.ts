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

/** Тренировочный ли день offset (0 = первый день плана). Отрицательные offset корректны. */
export function isTrainingDayFor(schedule: TrainSchedule, offset: number): boolean {
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
      const pos = ((offset % 7) + 7) % 7;
      return !!schedule.weeklyDays[pos];
    }
  }
}

/** Число тренировочных дней в 7-дневном окне (для сводки/профиля daysPerWeek). */
export function weeklyTrainingCount(schedule: TrainSchedule): number {
  let n = 0;
  for (let d = 0; d < 7; d++) if (isTrainingDayFor(schedule, d)) n++;
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
