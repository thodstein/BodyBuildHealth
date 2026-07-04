/**
 * rep-tempo.engine.ts — Движок управления темпом повторений (Rep Tempo).
 * 
 * Формат темпа: "X-X-X-X"
 * X1: Эксцентрическая фаза (опускание веса)
 * X2: Изометрическая пауза в нижней точке (stretch)
 * X3: Концентрическая фаза (подъём веса)
 * X4: Изометрическая пауза в верхней точке (peak contraction)
 * 
 * Пример: "3-1-1-0" -> 3с опускание, 1с пауза внизу, 1с подъём, 0с пауза вверху.
 */

export type TempoPhase = {
  eccentric: number;
  bottomPause: number;
  concentric: number;
  topPause: number;
};

export interface TempoPreset {
  id: string;
  nameRu: string;
  tempo: TempoPhase;
  description: string;
  goal: 'strength' | 'hypertrophy' | 'power' | 'technique';
}

export const TEMPO_PRESETS: Record<string, TempoPreset> = {
  standard: {
    id: 'standard',
    nameRu: 'Стандартный',
    tempo: { eccentric: 2, bottomPause: 0, concentric: 1, topPause: 0 },
    description: 'Контролируемый спуск и мощный подъём. Подходит для большинства упражнений.',
    goal: 'hypertrophy',
  },
  hypertrophy: {
    id: 'hypertrophy',
    nameRu: 'Гипертрофичный',
    tempo: { eccentric: 3, bottomPause: 1, concentric: 1, topPause: 0 },
    description: 'Увеличенный TUL (время под нагрузкой). Акцент на эксцентрику и растяжение.',
    goal: 'hypertrophy',
  },
  strength: {
    id: 'strength',
    nameRu: 'Силовой',
    tempo: { eccentric: 2, bottomPause: 1, concentric: 1, topPause: 0 },
    description: 'Контроль в нижней точке для исключения инерции, взрывной подъём.',
    goal: 'strength',
  },
  power: {
    id: 'power',
    nameRu: 'Взрывной',
    tempo: { eccentric: 1, bottomPause: 0, concentric: 0, topPause: 0 },
    description: 'Максимальная скорость в обеих фазах. Минимальный контроль, максимальный драйв.',
    goal: 'power',
  },
  technique: {
    id: 'technique',
    nameRu: 'Техничный / Обучающий',
    tempo: { eccentric: 4, bottomPause: 2, concentric: 2, topPause: 1 },
    description: 'Медленный темп для отработки нейромышечной связи и идеальной формы.',
    goal: 'technique',
  },
};

/** Форматирует объект темпа в строку "X-X-X-X" */
export function formatTempo(tempo: TempoPhase): string {
  return `${tempo.eccentric}-${tempo.bottomPause}-${tempo.concentric}-${tempo.topPause}`;
}

/** Парсит строку "X-X-X-X" обратно в объект TempoPhase */
export function parseTempo(tempoStr: string): TempoPhase | null {
  const parts = tempoStr.split('-').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  return {
    eccentric: parts[0],
    bottomPause: parts[1],
    concentric: parts[2],
    topPause: parts[3],
  };
}

/**
 * Вычисляет общее время одного повторения.
 */
export function calculateRepDuration(tempo: TempoPhase): number {
  return tempo.eccentric + tempo.bottomPause + tempo.concentric + tempo.topPause;
}

/**
 * Рекомендует темп на основе цели тренировки и типа упражнения.
 */
export function recommendTempo(goal: string, exerciseType: 'compound' | 'isolation'): string {
  if (goal === 'strength') return 'strength';
  if (goal === 'power') return 'power';
  if (exerciseType === 'isolation') return 'hypertrophy';
  return 'standard';
}
