/**
 * bb-emg-scoring.ts — EMG-скоринг упражнений для индивидуального подбора.
 *
 * Данные активации мышц (% MVC) из исследований:
 * - PMC10600597: дельты (lateral raise variations)
 * - PMC7831128: приседания (squat variations)
 * - PMC7503819: жим лежа (bench press)
 * - MDPI 2026: квадрицепс (bodyweight exercises)
 *
 * Используется для приоритизации упражнений с наивысшей активацией целевой мышцы.
 */

/** Источник EMG-данных */
export interface EmgDataSource {
  citation: string;
  year: number;
  muscle: string;
  exerciseName: string;
  activationPct: number;
}

/** EMG-скоринг упражнения для конкретной мышцы */
export interface EmgScore {
  muscle: string;
  exerciseName: string;
  activationPct: number;
  source: string;
}

/** База EMG-данных */
const EMG_DATA: EmgDataSource[] = [
  // Дельты (PMC10600597)
  { citation: 'PMC10600597', year: 2024, muscle: 'delts', exerciseName: 'Lateral Raise (external rotation)', activationPct: 95 },
  { citation: 'PMC10600597', year: 2024, muscle: 'delts', exerciseName: 'Lateral Raise (neutral)', activationPct: 88 },
  { citation: 'PMC10600597', year: 2024, muscle: 'delts', exerciseName: 'Lateral Raise (internal rotation)', activationPct: 82 },
  { citation: 'PMC10600597', year: 2024, muscle: 'delts', exerciseName: 'Front Raise', activationPct: 85 },
  
  // Приседания (PMC7831128)
  { citation: 'PMC7831128', year: 2023, muscle: 'quads', exerciseName: 'Front Squat', activationPct: 92 },
  { citation: 'PMC7831128', year: 2023, muscle: 'quads', exerciseName: 'Back Squat (parallel)', activationPct: 88 },
  { citation: 'PMC7831128', year: 2023, muscle: 'quads', exerciseName: 'Back Squat (full)', activationPct: 90 },
  { citation: 'PMC7831128', year: 2023, muscle: 'quads', exerciseName: 'Sumo Squat', activationPct: 85 },
  { citation: 'PMC7831128', year: 2023, muscle: 'quads', exerciseName: 'Bulgarian Split Squat', activationPct: 87 },
  
  // Жим лежа (PMC7503819)
  { citation: 'PMC7503819', year: 2023, muscle: 'chest', exerciseName: 'Bench Press (medium grip)', activationPct: 95 },
  { citation: 'PMC7503819', year: 2023, muscle: 'chest', exerciseName: 'Incline Bench Press', activationPct: 90 },
  { citation: 'PMC7503819', year: 2023, muscle: 'chest', exerciseName: 'Decline Bench Press', activationPct: 85 },
  
  // Квадрицепс (MDPI 2026)
  { citation: 'MDPI 2026', year: 2026, muscle: 'quads', exerciseName: 'Bulgarian Split Squat', activationPct: 90 },
  { citation: 'MDPI 2026', year: 2026, muscle: 'quads', exerciseName: 'Backward Lunge', activationPct: 88 },
];

/** Кэш скоринга по мышцам */
const scoreCache = new Map<string, EmgScore[]>();

/**
 * Получить EMG-скоринг упражнений для конкретной мышцы.
 * Возвращает упражнения, отсортированные по убыванию активации.
 */
export function getEmgScoring(muscle: string): EmgScore[] {
  if (scoreCache.has(muscle)) {
    return scoreCache.get(muscle)!;
  }
  
  const scores = EMG_DATA
    .filter(d => d.muscle === muscle)
    .map(d => ({
      muscle: d.muscle,
      exerciseName: d.exerciseName,
      activationPct: d.activationPct,
      source: d.citation,
    }))
    .sort((a, b) => b.activationPct - a.activationPct);
  
  scoreCache.set(muscle, scores);
  return scores;
}

/**
 * Рассчитать EMG-скор для конкретного упражнения и мышцы.
 * Возвращает 0, если упражнение не найдено в базе.
 */
export function getEmgScoreForExercise(muscle: string, exerciseName: string): number {
  const scores = getEmgScoring(muscle);
  // Точное совпадение
  const exact = scores.find(s => s.exerciseName === exerciseName);
  if (exact) return exact.activationPct;
  
  // Частичное совпадение (по словам)
  const nameWords = exerciseName.toLowerCase().split(/\s+/);
  const partial = scores.find(s => {
    const scoreWords = s.exerciseName.toLowerCase().split(/\s+/);
    return nameWords.some(w => scoreWords.includes(w));
  });
  
  return partial?.activationPct ?? 0;
}

/**
 * Проверить, является ли упражнение высокоактивирующим для данной мышцы.
 */
export function isHighActivationExercise(muscle: string, exerciseName: string): boolean {
  return getEmgScoreForExercise(muscle, exerciseName) >= 85;
}

/**
 * Получить все доступные мышцы в базе EMG.
 */
export function getAvailableMuscles(): string[] {
  return [...new Set(EMG_DATA.map(d => d.muscle))];
}

/**
 * Очистить кэш (для тестов).
 */
export function clearEmgCache(): void {
  scoreCache.clear();
}
