/** shared.ts — общие константы/типы TrainingScreen (вынесено из монолита).
 * Чистая версия: только то, что реально используется. 5-зонная навигация — в nav.ts. */
/** Единый словарь разминки — канон warmup.engine (был расходящийся дубль). */
export { WARMUP_LABELS } from '../../../engines/warmup.engine';

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
  | 'tempo' | 'meso_tracker' | 'specialization' | 'peaking'   | 'mmc_tracking' | 'mindset' | 'mobility'
  | 'checkin' | 'strength' | 'bb_tools' | 'pl_weakpoints' | 'load_safety' | 'split_gen' | 'goals' | 'pri_reppat' | 'insights'
  | 'strength_analysis' | 'load_management' | 'diagnostics' | 'diagnostics_hub' | 'quality_hub' | 'periodization_hub' | 'periodization_taper_hub' | 'quality_diagnostics' | 'quality_joint_hub' | 'volume_hub'
   | 'training_mix_hub' | 'mix_presets' | 'mix_hub' | 'warmup' | 'cooldown' | 'rir_calibration' | 'readiness_forecast' | 'rir_forecast_hub' | 'tools_hub' | 'taper_planner' | 'joint_health' | 'joints_ortho' | 'intelligence_hub' | 'metabolic_hub';
export type TrainingPage = 'hero' | 'tabs';

export const TAB_LABELS: Record<TrainingTab, string> = {
  constructor: '🛠 Конструктор тренировок', runtime: '▶️ Проведение тренировки', exercises: '🏋️ Упражнения', calculators: '⚖️ Тоннаж',
  diary: '📝 Дневник', cycles: '🔄 Циклы', history: '📜 История', analytics: '📊 Аналитика',
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
  calc_taper: '🔻 Тапинг-методики',
  calc_fatigue: '📉 Индекс усталости',
  calc_vbt: '⚡ VBT / скорость',
  calc_plates: '🧮 Калькулятор блинов',
  calc_mrv: '🎯 Оценщик MRV',
  tempo: '⏱️ Темп повторений',
  meso_tracker: '📈 Трекер мезоциклов',
  specialization: '🎯 Специализация',
  peaking: '📈 Пик-протоколы',

  mmc_tracking: '🔄 MMC/Пампинг/Суставы',
  mindset: '🧠 Психология',
  mobility: '🧘 Мобильность',
  warmup: '🔥 Разминка',
  cooldown: '❄️ Заминка',
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
  periodization_hub: '🔄 Периодизация (legacy → тейпер-хаб)',
  periodization_taper_hub: '🔄 Периодизация и тапер',
   quality_diagnostics: '🎯 Качество+Диагностика (→ раздельно)',
   quality_joint_hub: '🎯 Качество + Диагностика (legacy → ⭐/🔬)',
   quality_hub: '⭐ Качество программы',
   diagnostics_hub: '🔬 Диагностика движения',
  volume_hub: '📐 Объём-хаб',
  training_mix_hub: '🧪 Тренировочные миксы (→ микс-хаб)',
  mix_presets: '🧪 Пресеты здоровья (→ микс-хаб)',
  mix_hub: '🧪 Миксы',
  tonnage: '📦 Тоннаж калькулятор',
  rir_calibration: '🎯 RIR калибратор (→ хаб)',
  readiness_forecast: '🔮 Прогноз готовности (→ хаб)',
  rir_forecast_hub: '🎯 RIR + Прогноз — единый хаб',
  tools_hub: '🧠 PRI / схема повторов',
  taper_planner: '📉 Планировщик тейпера (→ тейпер-хаб)',
   joint_health: '🦴 Суставы и ортопедия (→ единый)',
  joints_ortho: '🦴 Суставы и ортопедия',
  intelligence_hub: '⚡ Интеллект — единый пульт',
  metabolic_hub: '⚖️ Метаболика',

};

// ══ Режим зоны «Планировщик»: ПЛ-авто / ББ-авто / Ручной / Кардио / Стронг+ТА / Единоборства
// (сегментированный переключатель в nav.ts).
export type PlanningTrack = 'pl' | 'bb' | 'manual' | 'cardio' | 'strength' | 'combat';
const PT_KEY = 'he_training_planning_track';
export function getPlanningTrack(): PlanningTrack {
  try {
    const v = localStorage.getItem(PT_KEY);
    if (v === 'bb' || v === 'manual' || v === 'cardio' || v === 'strength' || v === 'combat') return v as PlanningTrack;
    // Backward-compat: старое значение 'my' → 'manual'.
    if (v === 'my') return 'manual';
    return 'pl';
  } catch { return 'pl'; }
}
export function setPlanningTrack(t: PlanningTrack): void {
  try { localStorage.setItem(PT_KEY, t); } catch { /* ignore */ }
}
