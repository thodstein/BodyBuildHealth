/** nav.ts — единая 5-зонная навигация тренировочного блока.
 * Заменяет хаос из 3 групп x ~25 вкладок + SRCBBScreen + TrainingToolkitScreen.
 * Каждый инструмент (вкладка) принадлежит ровно одной зоне — дублей нет.
 */
import type { TrainingTab } from './shared';

export type TrainingZone = 'planner' | 'training' | 'diary' | 'calculators' | 'library';

export interface ZoneCategory { label: string; icon: string; tabs: TrainingTab[]; }

export interface ZoneDef {
  title: string;
  icon: string;
  color: string;
  subtitle: string;
  /** Вкладки, которые рендерятся в этой зоне. У зоны 'planner' нет вкладок —
   *  она использует сегментированный переключатель (ПЛ-авто / ББ-авто / Ручной сбор). */
  tabs: TrainingTab[];
  /** Опциональная группировка вкладок по категориям (для аккуратного поднава). */
  categories?: ZoneCategory[];
}

export const ZONES: Record<TrainingZone, ZoneDef> = {
  planner: {
    title: '🏗 Планировщик',
    icon: '🏗',
    color: '#00e68a',
    subtitle: 'ПЛ-авто / ББ-авто / Ручной сбор — построение плана и макроцикла',
    tabs: [],
  },
  training: {
    title: '▶️ Тренировка',
    icon: '▶️',
    color: '#22c55e',
    subtitle: 'Проведение тренировки, таймеры отдыха, учёт подходов',
    tabs: ['runtime', 'timers'],
  },
  diary: {
    title: '📊 Дневник и аналитика',
    icon: '📊',
    color: '#a855f7',
    subtitle: 'Дневник, история, аналитика, прогресс, календарь, отчёты',
    tabs: ['diary', 'insights', 'strength', 'calendar', 'checkin', 'mmc_tracking', 'import_data'],
  },
  calculators: {
    title: '🧮 Калькуляторы',
    icon: '🧮',
    color: '#3b82f6',
    subtitle: 'Все калькуляторы в одном месте: сила, нагрузка, периодизация, инвентарь',
      tabs: [
      'strength_analysis', 'load_management', 'diagnostics', 'periodization_hub',
      'exercise_lab', 'load_safety', 'split_gen', 'pri_reppat',
      'calc_plates', 'calc_quality', 'volume',
      'training_mix_hub', 'tonnage',
    ],
    categories: [
      { label: 'Унифицированные', icon: '🧠', tabs: ['strength_analysis', 'load_management', 'diagnostics', 'periodization_hub', 'exercise_lab'] },
      { label: 'Инструменты', icon: '🛠️', tabs: ['load_safety', 'split_gen', 'pri_reppat', 'calc_plates', 'calc_quality', 'volume', 'tonnage'] },
      { label: 'Прочее', icon: '📋', tabs: ['training_mix_hub'] },
    ],
  },
  library: {
    title: '📖 Библиотека',
    icon: '📖',
    color: '#f59e0b',
    subtitle: 'Каталог процессов: циклы, программы, методики, пик-протоколы, упражнения',
    tabs: ['library', 'programs', 'methods', 'peaking', 'calc_taper', 'exercises', 'mytraining'],
  },
};

/** Порядок вывода зон на hero-экране. */
export const ZONE_ORDER: TrainingZone[] = ['planner', 'training', 'diary', 'calculators', 'library'];

/** Карта: какая вкладка в какой зоне живёт (для внешней навигации по имени вкладки). */
const TAB_TO_ZONE: Partial<Record<TrainingTab, TrainingZone>> = {};
for (const z of ZONE_ORDER) for (const t of ZONES[z].tabs) TAB_TO_ZONE[t] = z;

export function zoneForTab(tab: TrainingTab): TrainingZone {
  return TAB_TO_ZONE[tab] ?? 'planner';
}

/** Режимы зоны 'planner' — сегментированный переключатель. */
export type PlannerMode = 'pl' | 'bb' | 'manual';
export const PLANNER_MODES: { id: PlannerMode; label: string; icon: string; hint: string }[] = [
  { id: 'pl', label: 'ПЛ-авто', icon: '🏆', hint: 'Пауэрлифтинг: силовые циклы, ПМ-прогрессия, пик' },
  { id: 'bb', label: 'ББ-авто', icon: '💪', hint: 'Бодибилдинг: сплиты, объём по группам, прогрессия' },
  { id: 'manual', label: 'Ручной сбор', icon: '🛠', hint: 'Конструктор с полным ручным выбором параметров' },
];
