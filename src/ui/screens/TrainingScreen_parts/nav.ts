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
    tabs: ['runtime', 'timers', 'mixes'],
  },
  diary: {
    title: '📊 Дневник и аналитика',
    icon: '📊',
    color: '#a855f7',
    subtitle: 'Дневник, история, аналитика, прогресс, календарь, отчёты',
    tabs: ['diary', 'insights', 'strength', 'goals', 'calendar', 'checkin', 'mmc_tracking', 'import_data'],
  },
  calculators: {
    title: '🧮 Калькуляторы',
    icon: '🧮',
    color: '#3b82f6',
    subtitle: 'Все калькуляторы в одном месте: сила, нагрузка, периодизация, инвентарь',
    tabs: [
      'exercise_lab', 'calc_1rm', 'calc_plates', 'calc_vbt', 'calc_mrv',
      'calculators', 'calc_fatigue', 'tempo', 'deload_scheduler', 'calc_taper',
      'periodization_designer', 'meso_progression', 'meso_tracker', 'rel_strength',
      'pl_norms', 'pl_weakpoints', 'specialization', 'peaking', 'conjugate', 'pl_pro', 'calc_quality',
      'volume', 'cycles', 'bb_tools', 'load_safety', 'split_gen', 'competition', 'pri_reppat', 'mix_presets', 'synergy',
    ],
    categories: [
      { label: 'Сила и нагрузка', icon: '🏋️', tabs: ['calc_1rm', 'calc_vbt', 'rel_strength', 'pl_norms', 'pl_weakpoints', 'calculators', 'calc_mrv', 'calc_fatigue', 'volume'] },
      { label: 'Периодизация', icon: '🔄', tabs: ['periodization_designer', 'meso_progression', 'meso_tracker', 'deload_scheduler', 'calc_taper', 'specialization', 'peaking', 'conjugate', 'cycles'] },
      { label: 'Инструменты и качество', icon: '🧪', tabs: ['calc_plates', 'tempo', 'exercise_lab', 'bb_tools', 'load_safety', 'competition', 'calc_quality', 'pl_pro'] },
    ],
  },
  library: {
    title: '📖 Библиотека',
    icon: '📖',
    color: '#f59e0b',
    subtitle: 'Каталог тренировочных процессов: циклы, программы, методики, упражнения',
    tabs: ['library', 'programs', 'methods', 'exercises', 'mytraining'],
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
  { id: 'pl', label: 'ПЛ-авто', icon: '🏆', hint: 'Пауэрлифтинг: циклы СРЦ, ПМ-прогрессия, пик' },
  { id: 'bb', label: 'ББ-авто', icon: '💪', hint: 'Бодибилдинг: сплиты, объём по группам, прогрессия' },
  { id: 'manual', label: 'Ручной сбор', icon: '🛠', hint: 'Конструктор с полным ручным выбором параметров' },
];
