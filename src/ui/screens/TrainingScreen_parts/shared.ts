/** shared.ts — общие константы/типы TrainingScreen (вынесено из монолита).
 * Чистая версия: только то, что реально используется. 5-зонная навигация — в nav.ts. */
export const WARMUP_LABELS: Record<string, string> = {
  jumping_jack: 'Прыжки Jumping Jack', arm_circles: 'Круги руками', leg_swings: 'Махи ногами',
  hip_circle: 'Круги тазом', ankle_mobility: 'Мобилизация голеностопа', shoulder_circle: 'Круги плечами',
  thoracic_rotation: 'Ротация грудного отдела', cat_camel: 'Кошка-корова', worlds_greatest: 'Глубокий выпад с ротацией',
  banded_clam: 'Ракушка с резинкой', external_rotation: 'Внешняя ротация плеча', bird_dog: 'Bird-dog',
  dead_bug: 'Dead bug', light_cardio: 'Лёгкое кардио', squat: 'Присед',
  deep_breathing: 'Глубокое дыхание', box_breathing: 'Квадратное дыхание',
};

export const GOALS = [
  { value: 'bulk', label: 'Масса', icon: '💪' },
  { value: 'cut', label: 'Сушка', icon: '🔥' },
  { value: 'strength', label: 'Сила', icon: '🏋️' },
  { value: 'maintenance', label: 'Поддержание', icon: '⚖️' },
  { value: 'recomp', label: 'Рекомпозиция', icon: '🔁' },
  { value: 'rehab', label: 'Реабилитация', icon: '🩹' },
] as const;

export const LEVELS = [
  { value: 'beginner', label: 'Новичок', icon: '🌱' },
  { value: 'intermediate', label: 'Средний', icon: '📈' },
  { value: 'advanced', label: 'Опытный', icon: '🏆' },
  { value: 'enhanced', label: 'Enhanced', icon: '⚡' },
] as const;

export const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
export const GROUP_LABELS: Record<string, string> = {
    chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор',
};
export const EQUIP_LABELS: Record<string, string> = { barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блок', bodyweight: 'Вес тела', band: 'Резинка', kettlebell: 'Гиря', specialty_bar: 'Спецгриф' };
export const JOINT_LABELS: Record<string, string> = { high: 'высокая', med: 'средняя', low: 'низкая' };
export const PHASE_LABELS: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', peaking: 'Пик', deload: 'Разгрузка' };
export const PHASE_HINTS: Record<string, string> = {
  accumulation: 'Фаза накопления: умеренная интенсивность, рост объёма, контроль техники и восстановления.',
  intensification: 'Фаза интенсификации: выше рабочие веса, меньше лишнего объёма, строгий контроль RPE.',
  peaking: 'Пиковая фаза: приоритет тяжёлых подходов, низкая усталость, больше отдыха между сессиями.',
  deload: 'Разгрузка: снижаем объём и интенсивность, восстанавливаем суставы и нервную систему.',
};

/** Полный набор возможных вкладок тренировочного блока (включая sentinel/legacy значения).
 *  Актуальная 5-зонная группировка — в nav.ts (ZONES). */
export type TrainingTab =
  | 'constructor' | 'runtime' | 'exercises' | 'exercise_lab' | 'calculators' | 'diary' | 'cycles' | 'history'
  | 'tonnage'
  | 'analytics' | 'methods' | 'visual' | 'programs' | 'timers' | 'progress' | 'mytraining'
  | 'reports' | 'srcbb' | 'volume' | 'library' | 'powerlifting' | 'bodybuilding'
  | 'calc_quality' | 'calc_1rm' | 'import_data' | 'pl_norms' | 'rel_strength' | 'calendar' | 'mixes' | 'periodization_designer' | 'deload_scheduler' | 'meso_progression'
  | 'calc_taper' | 'calc_fatigue' | 'calc_vbt' | 'calc_plates' | 'calc_mrv'
  | 'tempo' | 'meso_tracker' | 'specialization' | 'peaking' | 'mmc_tracking'
  | 'checkin' | 'strength' | 'bb_tools' | 'pl_weakpoints' | 'load_safety' | 'split_gen' | 'goals' | 'pri_reppat' | 'insights'
  | 'strength_analysis' | 'load_management' | 'diagnostics' | 'periodization_hub'
  | 'training_mix_hub';
export type TrainingPage = 'hero' | 'tabs';

export const TAB_LABELS: Record<TrainingTab, string> = {
  constructor: '🛠 Конструктор тренировок', runtime: '▶️ Проведение тренировки', exercises: '🏋️ Упражнения', calculators: '⚖️ Тоннаж',
  diary: '📝 Дневник + аналитика + отчёты', cycles: '🔄 Циклы', history: '📜 История', analytics: '📊 Аналитика',
  methods: '🧠 Методики', visual: '📈 Визуализация', programs: '📚 Программы', timers: '⏱️ Таймеры отдыха',
  progress: '📏 Прогресс', mytraining: '⭐ Мои тренировки', exercise_lab: '🧬 Лаборатория упражнений', volume: '📐 Расчёт объёма',
  reports: '📄 Отчёты',
  srcbb: '🏆 Силовой цикл / Бодибилдинг',
  library: '📖 Каталог циклов',
  powerlifting: '🏋️ Пауэрлифтинг',
  bodybuilding: '💪 Бодибилдинг',
  calc_quality: '🎯 Качество программы',
  calc_1rm: '🎯 Калькулятор 1RM',
  import_data: '📥 Импорт CSV',
  pl_norms: '🏆 Нормативы ПЛ',

  rel_strength: '💪 Относительная сила',
  calendar: '📅 Календарь тренировок',
  mixes: '💪 Тренировочные миксы',
  periodization_designer: '🎨 Дизайнер периодизации',
  deload_scheduler: '🧘 Планировщик делода',
  meso_progression: '📈 Прогрессия мезо',
  calc_taper: '🔻 Тапер-планер',
  calc_fatigue: '📉 Индекс усталости',
  calc_vbt: '⚡ VBT / скорость',
  calc_plates: '🧮 Калькулятор блинов',
  calc_mrv: '🎯 Оценщик MRV',
  tempo: '⏱️ Темп повторений',
  meso_tracker: '📈 Трекер мезоциклов',
  specialization: '🎯 Специализация',
  peaking: '📈 Пик-протоколы',

  mmc_tracking: '🔄 MMC/Пампинг/Суставы',
  checkin: '📋 Чек-ин метрик',
  strength: '💪 Аналитика силы',
  bb_tools: '💪 ББ-инструменты',
  pl_weakpoints: '🎯 Слабые точки ПЛ',
  load_safety: '🫀 Нагрузка/авторег',
  split_gen: '🧩 Генератор сплитов',
  // competition moved into PeakingPanel (SRCBBScreen)
  goals: '🎯 Цели и привычки',
  pri_reppat: '🧠 PRI/схема повт',
  insights: '💡 Авто-инсайты',

  strength_analysis: '🏋️ Анализ силы',
  load_management: '📊 Управление нагрузкой',
  diagnostics: '🔬 Диагностика',
  periodization_hub: '🔄 Периодизация',
  training_mix_hub: '🧪 Тренировочные миксы',
  tonnage: '📦 Тоннаж калькулятор',

};

// ══ Режим зоны «Планировщик»: ПЛ-авто / ББ-авто / Ручной сбор (сегментированный переключатель в nav.ts).
export type PlanningTrack = 'pl' | 'bb' | 'manual';
const PT_KEY = 'he_training_planning_track';
export function getPlanningTrack(): PlanningTrack {
  try { const v = localStorage.getItem(PT_KEY); return v === 'manual' || v === 'bb' ? v : 'pl'; } catch { return 'pl'; }
}
export function setPlanningTrack(t: PlanningTrack): void {
  try { localStorage.setItem(PT_KEY, t); } catch { /* ignore */ }
}
