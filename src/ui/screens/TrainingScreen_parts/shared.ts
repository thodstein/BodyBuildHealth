/** shared.ts — общие константы/типы TrainingScreen (вынесено из монолита). */
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

export type TrainingTab =
  | 'plan' | 'runtime' | 'exercises' | 'excalc' | 'calculators' | 'diary' | 'cycles' | 'history'
  | 'analytics' | 'methods' | 'visual' | 'programs' | 'timers' | 'progress' | 'mytraining'
  | 'programcalc' | 'reports' | 'srcbb' | 'volume' | 'library' | 'powerlifting' | 'bodybuilding'
  | 'calc_substitute' | 'calc_quality' | 'calc_1rm' | 'import_data' | 'pl_norms' | 'pl_pro' | 'rel_strength' | 'calendar' | 'mixes' | 'periodization_designer' | 'tech_calc' | 'deload_scheduler' | 'meso_progression'
  | 'calc_taper' | 'calc_fatigue' | 'calc_vbt' | 'calc_plates' | 'calc_mrv' | 'target_muscle'
  | 'tempo' | 'meso_tracker';
export type TrainingPage = 'hero' | 'tabs';
// Главная — ровно 3 раздела: Тренировка (вести), Планирование (планировать), Инфо (смотреть).
export type TrainingGroup = 'training' | 'planning' | 'info' | null;

export const TAB_GROUPS: Record<string, { title: string; icon: string; tabs: TrainingTab[]; color: string }> = {
  training: { title: '🏋️ Тренировка', icon: '🏋️', tabs: ['runtime', 'timers', 'diary', 'mixes'], color: 'var(--accent)' },
  planning: { title: '📐 Планирование', icon: '📐', tabs: ['srcbb', 'plan', 'cycles', 'mytraining', 'programcalc', 'volume', 'powerlifting', 'bodybuilding', 'excalc', 'calc_substitute', 'calc_quality', 'calc_1rm', 'calculators', 'periodization_designer', 'deload_scheduler', 'meso_progression', 'rel_strength', 'calc_taper', 'calc_fatigue', 'calc_vbt', 'calc_plates', 'calc_mrv', 'tempo', 'meso_tracker'], color: '#3b82f6' },
  info: { title: '📊 Инфо', icon: '📊', tabs: ['analytics', 'visual', 'progress', 'history', 'reports', 'exercises', 'methods', 'programs', 'library', 'calendar', 'import_data'], color: '#a855f7' },
};

export const TAB_LABELS: Record<TrainingTab, string> = {
  plan: '📋 План тренировок', runtime: '▶️ Проведение тренировки', exercises: '🏋️ Упражнения', calculators: '⚖️ Нагрузка/тоннаж',
  diary: '📝 Дневник + аналитика', cycles: '🔄 Циклы', history: '📜 История', analytics: '📊 Аналитика',
  methods: '🧠 Методики', visual: '📈 Визуализация', programs: '📚 Программы', timers: '⏱️ Таймеры отдыха',
  progress: '📏 Прогресс', mytraining: '⭐ Мои тренировки', programcalc: '🛠️ Ручной конструктор', excalc: '🧮 Подбор упражнения', volume: '📐 Расчёт объёма',
  reports: '📄 Отчёты',
  srcbb: '🏆 Силовой цикл / Бодибилдинг',
  library: '📖 Каталог циклов',
  powerlifting: '🏋️ Пауэрлифтинг',
  bodybuilding: '💪 Бодибилдинг',
  calc_substitute: '🔄 Замена упражнения',
  calc_quality: '🎯 Качество программы',
  calc_1rm: '🎯 Калькулятор 1RM',
  import_data: '📥 Импорт CSV',
  pl_norms: '🏆 Нормативы ПЛ',
  pl_pro: '🏋️ Pro ПЛ-инструменты',
  rel_strength: '💪 Относительная сила',
  calendar: '📅 Календарь тренировок',
  mixes: '💪 Тренировочные миксы',
  periodization_designer: '🎨 Дизайнер периодизации',
  tech_calc: '🧬 Техника упражнений',
  deload_scheduler: '🧘 Планировщик делода',
  meso_progression: '📈 Прогрессия мезо',
  calc_taper: '🔻 Тапер-планер',
  calc_fatigue: '📉 Индекс усталости',
  calc_vbt: '⚡ VBT / скорость',
  calc_plates: '🧮 Калькулятор блинов',
  calc_mrv: '🎯 Оценщик MRV',
  target_muscle: '🎯 Целевая мышца',
  tempo: '⏱️ Темп повторений',
  meso_tracker: '📈 Трекер мезоциклов',
};

// ══ Этап R/U: 3 плоские трассы планировщика (ПЛ / ББ / Ручной сбор), одна вкладка — один клик.
//   pl    → ПЛ (сила, СРЦ-авто)        → SRCBBScreen track='pl'
//   bb    → ББ (бодибилдинг, авто)     → SRCBBScreen track='bb'
//   manual→ Ручной сбор (план/циклы/методики/калькулятор)
export type PlanningTrack = 'pl' | 'bb' | 'manual';
const PT_KEY = 'he_training_planning_track';
export function getPlanningTrack(): PlanningTrack {
  try { const v = localStorage.getItem(PT_KEY); return v === 'manual' || v === 'bb' ? v : 'pl'; } catch { return 'pl'; }
}
export function setPlanningTrack(t: PlanningTrack): void {
  try { localStorage.setItem(PT_KEY, t); } catch { /* ignore */ }
}
export const PL_PLANNING_TABS: TrainingTab[] = ['srcbb', 'volume', 'powerlifting'];
export const BB_PLANNING_TABS: TrainingTab[] = ['srcbb', 'volume', 'bodybuilding'];
export const MANUAL_PLANNING_TABS: TrainingTab[] = ['plan', 'cycles', 'mytraining', 'programcalc', 'volume'];
// Калькуляторы доступны в любой трассе планировщика (подбор / замена / качество / нагрузка)
const CALC_TABS: TrainingTab[] = ['excalc', 'calc_substitute', 'calc_quality', 'calc_1rm', 'pl_norms', 'pl_pro', 'rel_strength', 'calculators', 'tech_calc', 'target_muscle', 'calc_taper', 'calc_fatigue', 'calc_vbt', 'calc_plates', 'calc_mrv', 'deload_scheduler', 'tempo', 'meso_tracker'];
export function planningTabsFor(track: PlanningTrack): TrainingTab[] {
  const base = track === 'manual' ? MANUAL_PLANNING_TABS : track === 'bb' ? BB_PLANNING_TABS : PL_PLANNING_TABS;
  return [...base, ...CALC_TABS];
}
// Бэкворд-совместимость (старый импорт PlanningMode)
export type PlanningMode = PlanningTrack;
export const getPlanningMode = getPlanningTrack;
export const setPlanningMode = (m: string) => setPlanningTrack(m === 'constructor' ? 'manual' : m === 'src_auto' ? 'pl' : 'pl');