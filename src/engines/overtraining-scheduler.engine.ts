/**
 * Overtraining Detection & Auto-Scheduler — реэкспорт из единого deload-engine.
 *
 * Вся логика вынесена в `deload-engine.ts`. Этот файл оставлен для
 * обратной совместимости; все импорты прозрачно перенаправляются.
 *
 * @module overtraining-scheduler (deprecated, use deload-engine)
 */

export {
  detectOvertraining,
  autoSchedule,
  type OvertrainingInput,
  type OvertrainingOutput,
  type AutoScheduleInput,
  type ScheduledWeek,
  type AutoScheduleOutput,
} from './deload-engine';
