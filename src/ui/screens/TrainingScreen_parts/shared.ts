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

export type TrainingTab = 'plan' | 'runtime' | 'exercises' | 'calculators' | 'diary' | 'cycles' | 'history' | 'analytics' | 'methods' | 'visual' | 'programs' | 'timers' | 'progress' | 'mytraining' | 'programcalc' | 'reports' | 'srcbb';
export type TrainingPage = 'hero' | 'tabs';
export type TrainingGroup = 'training' | 'planning' | 'info' | null;

export const TAB_GROUPS: Record<string, { title: string; icon: string; tabs: TrainingTab[]; color: string }> = {
  training: { title: '🏋️ Тренировки', icon: '🏋️', tabs: ['runtime', 'timers'], color: 'var(--accent)' },
  planning: { title: '📐 Планирование', icon: '📐', tabs: ['srcbb', 'plan', 'cycles', 'programs', 'mytraining', 'methods', 'programcalc'], color: '#3b82f6' },
  info: { title: '📊 Инфо', icon: '📊', tabs: ['analytics', 'visual', 'progress', 'calculators', 'exercises', 'diary', 'history', 'reports'], color: '#8b5cf6' },
};

export const TAB_LABELS: Record<TrainingTab, string> = {
  plan: '📋 План', runtime: '▶ Тренировка', exercises: '🏋️ Упражнения', calculators: '📐 Калькуляторы',
  diary: '📝 Дневник', cycles: '🔄 Циклы', history: '📜 История', analytics: '📊 Аналитика',
  methods: '🧠 Методики', visual: '📈 Визуализация', programs: '📚 Программы', timers: '⏱ Таймеры',
  progress: '📏 Прогресс', mytraining: '⭐ Мои', programcalc: '🛠️ Ручной конструктор',
  reports: '📄 Отчёты',
  srcbb: '🏆 СРЦ/BB',
};

// ── Этап R: PlanningMode (реструктуризация планировщика, AGENTS.md критич.баг #1) ──
// Два режима планирования, разделённых чтобы устранить дублирование информации
// (программа показывалась одновременно в СРЦ/BB-движке и в ручном конструкторе).
//   src_auto    → авто-подбор (СРЦ + Бодибилдинг) через SRCBBScreen (единственный источник программ)
//   constructor → ручной конструктор (план/циклы/программы/методики/калькулятор)
export type PlanningMode = 'src_auto' | 'constructor';
const PM_KEY = 'he_training_planning_mode';
export function getPlanningMode(): PlanningMode {
  try { return localStorage.getItem(PM_KEY) === 'constructor' ? 'constructor' : 'src_auto'; } catch { return 'src_auto'; }
}
export function setPlanningMode(m: PlanningMode): void {
  try { localStorage.setItem(PM_KEY, m); } catch { /* ignore */ }
}
// Вкладки группы «Планирование» по режиму (взаимоисключающие — нет дублей).
export const SRC_AUTO_PLANNING_TABS: TrainingTab[] = ['srcbb'];
export const CONSTRUCTOR_PLANNING_TABS: TrainingTab[] = ['plan', 'cycles', 'programs', 'mytraining', 'methods', 'programcalc'];
export function planningTabsFor(mode: PlanningMode): TrainingTab[] {
  return mode === 'src_auto' ? SRC_AUTO_PLANNING_TABS : CONSTRUCTOR_PLANNING_TABS;
}
