/**
 * annual-training — годовой план, собранный по конструкторам (ПЛ/ББ/ручной).
 *
 * Принцип: макро-разметка отвечает за календарь, генерацию тренировок выполняет
 * конструктор, выбранный для каждого блока. Собранные блоки кэшируются и не
 * перезаписываются при изменении разметки (помечаются 'stale').
 */
export * from './annual-training.types';
export * from './block-builders.engine';
export * from './annual-training-storage';
export * from './annual-training-print';
export * from './annual-training-cardio.engine';
