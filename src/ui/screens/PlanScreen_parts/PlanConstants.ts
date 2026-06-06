// Constants for PlanScreen

export const GOALS = [
  { value: 'bulk', label: 'Набор мышечной массы' },
  { value: 'cut', label: 'Сушка' },
  { value: 'maintenance', label: 'Поддержание' },
  { value: 'strength', label: 'Сила' },
  { value: 'recomp', label: 'Перекомпозиция' },
  { value: 'rehab', label: 'Реабилитация' },
] as const;

export const LEVELS = [
  { value: 'beginner', label: 'Начинающий' },
  { value: 'intermediate', label: 'Средний' },
  { value: 'advanced', label: 'Продвинутый' },
  { value: 'enhanced', label: 'Элитный (допы)' },
] as const;

export const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;

export const GROUP_LABELS: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Пресс',
};

export const RIR_TABLE: Record<string, Record<string, [number, number]>> = {
  strength: { beginner: [3, 4], intermediate: [2, 3], advanced: [1, 2], enhanced: [1, 2] },
  hypertrophy: { beginner: [2, 3], intermediate: [1, 2], advanced: [1, 2], enhanced: [0, 1] },
  bulk: { beginner: [2, 3], intermediate: [1, 2], advanced: [1, 2], enhanced: [0, 1] },
  cut: { beginner: [2, 3], intermediate: [2, 3], advanced: [1, 2], enhanced: [1, 2] },
  maintenance: { beginner: [2, 3], intermediate: [2, 3], advanced: [2, 3], enhanced: [2, 3] },
  recomp: { beginner: [2, 3], intermediate: [1, 2], advanced: [1, 2], enhanced: [1, 2] },
  rehab: { beginner: [3, 5], intermediate: [3, 4], advanced: [3, 4], enhanced: [2, 3] },
  endurance: { beginner: [3, 4], intermediate: [2, 3], advanced: [2, 3], enhanced: [1, 2] },
};

export const SPLIT_LABELS: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Пресс' };
