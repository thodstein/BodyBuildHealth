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
    subtitle: 'ПЛ-авто / ББ-авто — построение плана и макроцикла',
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
    title: '📓 Дневник',
    icon: '📓',
    color: '#a855f7',
    subtitle: 'Дневник тренировок: запись, история, аналитика, прогресс, календарь, чек-ин',
    // Дневник — единственная навигация для hub. Не смешиваем её с
    // внутренним переключателем TrainingDiaryHub.
    // «История тренировок» и «Сводка недели» — ТОЛЬКО подвкладка дневника
    // (не дублируются на экранах ББ-авто/ПЛ-авто).
    tabs: ['diary', 'analytics', 'progress', 'calendar', 'checkin', 'mmc_tracking', 'mindset', 'mobility', 'reports'],
    categories: [
      { label: 'Запись и день', icon: '✍️', tabs: ['diary', 'calendar'] },
      { label: 'Анализ и сила', icon: '📊', tabs: ['analytics', 'progress', 'mmc_tracking'] },
      { label: 'Психика и восстановление', icon: '🧠', tabs: ['mindset', 'mobility', 'checkin'] },
      { label: 'Инструменты', icon: '🧰', tabs: ['reports'] },
    ],
  },
  calculators: {
    title: '⚡ Интеллект тренировки',
    icon: '⚡',
    color: '#3b82f6',
    subtitle: 'Персональный пульс-контроль: показатели, качество плана, инструменты сборки, периодизация',
    tabs: [
      'strength_analysis', 'load_management', 'diagnostics', 'periodization_hub',
      'exercise_lab', 'load_safety', 'split_gen', 'pri_reppat',
      'calc_plates', 'calc_quality', 'volume',
      'training_mix_hub', 'mix_presets', 'tonnage',
    ],
  },
  library: {
    title: '📖 Библиотека',
    icon: '📖',
    color: '#f59e0b',
    subtitle: 'Каталог процессов: циклы, программы, методики, пик-протоколы, упражнения',
    // «Мои тренировки» перенесены в Дневник (подвкладка TrainingDiaryHub).
    tabs: ['library', 'programs', 'methods', 'peaking', 'calc_taper', 'exercises'],
    categories: [
      { label: 'Процессы', icon: '🗂', tabs: ['library', 'programs'] },
      { label: 'Знания и методики', icon: '🧠', tabs: ['methods', 'peaking', 'calc_taper', 'exercises'] },
    ],
  },
};

/** Режимы зоны 'planner' — сегментированный переключатель.
 *  PL-авто и BB-авто — авто-планировщики.
 *  Manual ("Ручной конструктор") — пустая UserProgram, которую пользователь сам
 *  редактирует (program-store.ts). Не дублирует BB-auto — пустой blackboard,
 *  который программируется пользователем по факту. */
export type PlannerMode = 'pl' | 'bb' | 'manual';
export const PLANNER_MODES: { id: PlannerMode; label: string; icon: string; hint: string }[] = [
  { id: 'pl', label: 'ПЛ-авто', icon: '🏆', hint: 'Пауэрлифтинг: LMS-циклы, ПМ-прогрессия, пик-протоколы' },
  { id: 'bb', label: 'ББ-авто', icon: '💪', hint: 'Бодибилдинг: сплиты, объём по группам, PED-адаптация, прогрессия' },
  { id: 'manual', label: 'Ручной конструктор', icon: '✋', hint: 'Своя программа: создать с нуля, загрузить для правки, авто-черновик для ручной правки' },
];

/** Порядок вывода зон на hero-экране. */
export const ZONE_ORDER: TrainingZone[] = ['planner', 'training', 'diary', 'calculators', 'library'];

/** Карта: какая вкладка в какой зоне живёт (для внешней навигации по имени вкладки). */
const TAB_TO_ZONE: Partial<Record<TrainingTab, TrainingZone>> = {};
for (const z of ZONE_ORDER) for (const t of ZONES[z].tabs) TAB_TO_ZONE[t] = z;

export function zoneForTab(tab: TrainingTab): TrainingZone {
  return TAB_TO_ZONE[tab] ?? 'planner';
}
