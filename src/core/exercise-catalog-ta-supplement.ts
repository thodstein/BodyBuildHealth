/**
 * exercise-catalog-ta-supplement.ts — TA-специфичные упражнения (PLOS 2026, Torokhtiy)
 * Дополнение к EXERCISE_CATALOG без правки основного файла (кодировка PowerShell).
 * Регистрирует deficit_snatch etc с корректными группами для WLDiagnosticsHub.
 */
import type { Exercise } from './types';

export const TA_CATALOG_SUPPLEMENT: Exercise[] = [
  { id: 'deficit_snatch', name: 'Рывок с дефицита', group: 'legs', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'med', fatigueCost: 7, targetMuscle: 'Ноги/спина (отрыв)', movementPattern: 'hinge', canReplace: ['snatch_pull'], cannotReplace: [] },
  { id: 'block_snatch', name: 'Рывок с блоков', group: 'legs', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'low', fatigueCost: 6, targetMuscle: 'Подрыв', movementPattern: 'hinge', canReplace: ['snatch'], cannotReplace: [] },
  { id: 'pause_snatch', name: 'Рывок с паузой', group: 'legs', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'med', fatigueCost: 7, targetMuscle: 'Средняя тяга', movementPattern: 'hinge', canReplace: ['snatch_pull'], cannotReplace: [] },
  { id: 'high_hang_snatch', name: 'Рывок с высокого виса', group: 'legs', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'low', fatigueCost: 6, targetMuscle: 'Уход под штангу', movementPattern: 'hinge', canReplace: ['muscle_snatch'], cannotReplace: [] },
  { id: 'muscle_snatch', name: 'Масл-рывок', group: 'shoulders', type: 'compound', equipment: 'barbell', difficulty: 'intermediate', jointStress: 'low', fatigueCost: 5, targetMuscle: 'Трапеции/плечи', movementPattern: 'vertical_push', canReplace: ['high_hang_snatch'], cannotReplace: [] },
  { id: 'deficit_clean', name: 'Взятие с дефицита', group: 'legs', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'med', fatigueCost: 7, targetMuscle: 'Отрыв', movementPattern: 'hinge', canReplace: ['clean_pull'], cannotReplace: [] },
  { id: 'block_clean', name: 'Взятие с блоков', group: 'legs', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'low', fatigueCost: 6, targetMuscle: 'Подрыв', movementPattern: 'hinge', canReplace: ['clean_and_jerk'], cannotReplace: [] },
  { id: 'pause_clean', name: 'Взятие с паузой', group: 'legs', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'med', fatigueCost: 7, targetMuscle: 'Середина', movementPattern: 'hinge', canReplace: ['clean_pull'], cannotReplace: [] },
  { id: 'pause_jerk', name: 'Толчок с паузой', group: 'shoulders', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'low', fatigueCost: 6, targetMuscle: 'Фиксация', movementPattern: 'vertical_push', canReplace: ['split_jerk'], cannotReplace: [] },
  { id: 'jerk_dip', name: 'Подсед для толчка', group: 'legs', type: 'compound', equipment: 'barbell', difficulty: 'intermediate', jointStress: 'low', fatigueCost: 5, targetMuscle: 'Квадрицепс', movementPattern: 'squat', canReplace: ['pause_jerk'], cannotReplace: [] },
  { id: 'snatch_pull', name: 'Рывковая тяга', group: 'back', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'med', fatigueCost: 8, targetMuscle: 'Тяга', movementPattern: 'hinge', canReplace: ['pause_pull'], cannotReplace: [] },
  { id: 'clean_pull', name: 'Толчковая тяга', group: 'back', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'med', fatigueCost: 8, targetMuscle: 'Тяга', movementPattern: 'hinge', canReplace: ['snatch_pull'], cannotReplace: [] },
  { id: 'pause_pull', name: 'Тяга с паузой', group: 'back', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'med', fatigueCost: 7, targetMuscle: 'Проход коленей', movementPattern: 'hinge', canReplace: ['deficit_pull'], cannotReplace: [] },
  { id: 'overhead_squat_v2', name: 'Присед оверхед', group: 'legs', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'med', fatigueCost: 6, targetMuscle: 'Оверхед сед', movementPattern: 'squat', canReplace: ['snatch_balance'], cannotReplace: [] },
];

// side-effect регистрация (опционально, если EXERCISE_CATALOG импортирует)
try {
  const { EXERCISE_CATALOG } = require('./exercise-catalog') as any;
  if (Array.isArray(EXERCISE_CATALOG)) {
    for (const ex of TA_CATALOG_SUPPLEMENT) if (!EXERCISE_CATALOG.find((e: any) => e.id === ex.id)) EXERCISE_CATALOG.push(ex);
  }
} catch {}
