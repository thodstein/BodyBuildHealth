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
    tabs: ['diary', 'analytics', 'progress', 'calendar', 'checkin', 'mmc_tracking', 'mindset', 'mobility', 'warmup', 'cooldown', 'reports'],
    categories: [
      { label: 'Запись и день', icon: '✍️', tabs: ['diary', 'calendar'] },
      { label: 'Анализ и сила', icon: '📊', tabs: ['analytics', 'progress', 'mmc_tracking'] },
      { label: 'Психика и восстановление', icon: '🧠', tabs: ['mindset', 'mobility', 'warmup', 'cooldown', 'checkin'] },
      { label: 'Инструменты', icon: '🧰', tabs: ['reports'] },
    ],
  },
  calculators: {
    title: '⚡ Интеллект тренировки',
    icon: '⚡',
    color: '#3b82f6',
    subtitle: 'Персональный пульс-контроль: показатели, качество плана, инструменты сборки, периодизация',
    // хабы единые (аналог VolumeHub): periodization_taper_hub (2→1), mix_hub (2→1), rir_forecast_hub (2→1)
    tabs: [
      'strength_analysis', 'load_management', 'quality_diagnostics', 'periodization_taper_hub',
      'exercise_lab', 'load_safety', 'volume_hub', 'pri_reppat',
      'calc_plates', 'rir_forecast_hub', 'joint_health',
      'mix_hub', 'bb_foundation',
    ],
  },
  library: {
    title: '📖 Библиотека',
    icon: '📖',
    color: '#f59e0b',
    subtitle: 'Каталог процессов: циклы, программы, методики, упражнения',
    // «Мои тренировки» перенесены в Дневник. peaking/calc_taper перенесены в Интеллект → taper_planner (единый калькулятор ПЛ/ББ)
    tabs: ['library', 'programs', 'methods', 'exercises'],
    categories: [
      { label: 'Процессы', icon: '🗂', tabs: ['library', 'programs'] },
      { label: 'Знания и методики', icon: '🧠', tabs: ['methods', 'exercises'] },
    ],
  },
};

/** Режимы зоны 'planner' — сегментированный переключатель.
 *  PL-авто и BB-авто — авто-планировщики.
 *  Manual ("Ручной конструктор") — пустая UserProgram, которую пользователь сам
 *  редактирует (program-store.ts). Не дублирует BB-auto — пустой blackboard,
 *  который программируется пользователем по факту.
 *  Cardio ("Кардио-конструктор") — отдельный CardioCycle (cardio.engine),
 *  подключается к PL/BB ссылкой (cardio-bridge). */
export type PlannerMode = 'pl' | 'bb' | 'manual' | 'cardio';
export const PLANNER_MODES: { id: PlannerMode; label: string; icon: string; hint: string }[] = [
  { id: 'pl', label: 'ПЛ-авто', icon: '🏆', hint: 'Пауэрлифтинг: LMS-циклы, ПМ-прогрессия, пик-протоколы' },
  { id: 'bb', label: 'ББ-авто', icon: '💪', hint: 'Бодибилдинг: сплиты, объём по группам, PED-адаптация, прогрессия' },
  { id: 'manual', label: 'Ручной конструктор', icon: '✋', hint: 'Своя программа: создать с нуля, загрузить для правки, авто-черновик для ручной правки' },
  { id: 'cardio', label: 'Кардио-конструктор', icon: '❤️', hint: 'Отдельный кардио-цикл: Zone 2/HIIT, фазы, taper к стартам, подключение к ПЛ/ББ' },
];

/** Порядок вывода зон на hero-экране. */
export const ZONE_ORDER: TrainingZone[] = ['planner', 'training', 'diary', 'calculators', 'library'];

/** Карта: какая вкладка в какой зоне живёт (для внешней навигации по имени вкладки). */
const TAB_TO_ZONE: Partial<Record<TrainingTab, TrainingZone>> = {};
for (const z of ZONE_ORDER) for (const t of ZONES[z].tabs) TAB_TO_ZONE[t] = z;
// алиасы для депрекейтнутых дублей (удалены из ZONES.tabs, но должны резолвиться)
(TAB_TO_ZONE as Record<string, TrainingZone>)['diagnostics'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['calc_quality'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['volume'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['tonnage'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['split_gen'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['calc_taper'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['taper_planner'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['periodization_hub'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['peaking'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['periodization_taper_hub'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['training_mix_hub'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['mix_presets'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['mix_hub'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['rir_calibration'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['readiness_forecast'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['rir_forecast_hub'] = 'calculators';

export function zoneForTab(tab: TrainingTab): TrainingZone {
  return TAB_TO_ZONE[tab] ?? 'planner';
}
