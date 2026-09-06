/** nav.ts — единая 5-зонная навигация тренировочного блока.
 * Заменяет хаос из 3 групп x ~25 вкладок + SRCBBScreen + TrainingToolkitScreen.
 * Каждый инструмент (вкладка) принадлежит ровно одной зоне — дублей нет.
 */
import type { TrainingTab } from './shared';
import type { NativeIconName } from '../../native/NativeIcons';
import { makeAlpha } from '../../native/accent';

export type TrainingZone = 'planner' | 'training' | 'diary' | 'calculators' | 'library';

/** Бренд-акцент зоны планировщика: в APK за темой, в TG/web — минт. */
export const TRAIN_ACCENT_VAR = 'var(--train-accent, #00e68a)';
export const TRAIN_ACCENT_RGB = 'var(--train-accent-rgb, 0,230,138)';
/** Единая реализация — native/accent.makeAlpha (сигнатура и выхлоп те же). */
export const trainAlpha = makeAlpha(TRAIN_ACCENT_VAR, TRAIN_ACCENT_RGB);

export interface ZoneCategory { label: string; icon: NativeIconName; tabs: TrainingTab[]; }

export interface ZoneDef {
  title: string;
  icon: NativeIconName;
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
    title: 'Планировщик',
    icon: 'layers',
    color: TRAIN_ACCENT_VAR,
    subtitle: 'ПЛ-авто / ББ-авто / Арм / Стронг+ТА / Единоборства — построение плана',
    tabs: [],
  },
  training: {
    title: 'Тренировка',
    icon: 'play',
    color: '#22c55e',
    subtitle: 'Проведение тренировки, таймеры отдыха, учёт подходов',
    tabs: ['runtime', 'timers'],
  },
  diary: {
    title: 'Дневник',
    icon: 'notebook',
    color: '#a855f7',
    subtitle: 'Дневник тренировок: запись, история, прогресс, аналитика, практики, инструменты',
    tabs: ['diary', 'history', 'progress', 'analytics_lite', 'rituals', 'tools'],
    categories: [
      { label: 'Работа', icon: 'file', tabs: ['diary', 'history'] },
      { label: 'Отслеживание', icon: 'chart', tabs: ['progress', 'analytics_lite'] },
      { label: 'Практики', icon: 'cpu', tabs: ['rituals'] },
      { label: 'Управление', icon: 'sliders', tabs: ['tools'] },
    ],
  },
  calculators: {
    title: 'Интеллект тренировки',
    icon: 'zap',
    color: '#3b82f6',
    subtitle: 'Единый пульт: нагрузка → восстановление → авторегуляция → прогноз (без дублей)',
    tabs: [
      'intelligence_hub', 'strength_analysis', 'quality_hub', 'diagnostics_hub', 'arm_diagnostics_hub', 'wl_diagnostics_hub', 'strongman_diagnostics_hub', 'bb_diagnostics_hub', 'joints_ortho', 'periodization_taper_hub',
      'exercise_lab', 'volume_hub', 'tempo_hub', 'mix_hub', 'metabolic_hub',
    ],
  },
  library: {
    title: 'Библиотека',
    icon: 'bookOpen',
    color: '#f59e0b',
    subtitle: 'Каталог процессов: циклы, программы, методики, упражнения + мои',
    tabs: ['library', 'programs', 'mytraining', 'methods', 'exercises'],
    categories: [
      { label: 'Процессы', icon: 'grid', tabs: ['library', 'programs', 'mytraining'] },
      { label: 'Знания и методики', icon: 'cpu', tabs: ['methods', 'exercises'] },
    ],
  },
};

/** Режимы зоны 'planner' — сегментированный переключатель.
 *  PL-авто и BB-авто — авто-планировщики.
 *  Manual ("Ручной конструктор") — пустая UserProgram, которую пользователь сам
 *  редактирует (program-store.ts).
 *  Cardio ("Кардио-конструктор") — отдельный CardioCycle (cardio.engine).
 *  Strength ("Стронг+ТА") и Combat ("Единоборства") — изолированные силовые конструкторы,
 *  только заловая часть, внезальная нагрузка — декларация OutsideLoad. */
export type PlannerMode = 'pl' | 'bb' | 'manual' | 'cardio' | 'strength' | 'combat' | 'arm';
export const PLANNER_MODES: { id: PlannerMode; label: string; icon: NativeIconName; hint: string }[] = [
  { id: 'pl', label: 'ПЛ-авто', icon: 'award', hint: 'Пауэрлифтинг: LMS-циклы, ПМ-прогрессия, пик-протоколы' },
  { id: 'bb', label: 'ББ-авто', icon: 'dumbbell', hint: 'Бодибилдинг: сплиты, объём по группам, PED-адаптация, прогрессия' },
  { id: 'manual', label: 'Ручной', icon: 'plus', hint: 'Своя программа: создать с нуля, загрузить для правки' },
  { id: 'cardio', label: 'Кардио', icon: 'activity', hint: 'Кардио-цикл: Zone 2/HIIT, фазы, taper' },
  { id: 'strength', label: 'Стронг+ТА', icon: 'target', hint: 'Тяжёлая атлетика / Стронг: рывок, толчок, лог, камни, outside-load' },
  { id: 'combat', label: 'Единоборства', icon: 'shield', hint: 'Бокс/ММА/Борьба: шея, хват, ротация, внезальная 4-5×/нед' },
  { id: 'arm', label: 'Арм', icon: 'move', hint: 'Армрестлинг / Армлифтинг: стол + хваты, РУ/РА, tendon-cap' },
];

/** Порядок вывода зон на hero-экране. */
export const ZONE_ORDER: TrainingZone[] = ['planner', 'training', 'diary', 'calculators', 'library'];

/** Карта: какая вкладка в какой зоне живёт (для внешней навигации по имени вкладки). */
const TAB_TO_ZONE: Partial<Record<TrainingTab, TrainingZone>> = {};
for (const z of ZONE_ORDER) for (const t of ZONES[z].tabs) TAB_TO_ZONE[t] = z;
// алиасы дневника (старые подвкладки → новые 6)
(TAB_TO_ZONE as Record<string, TrainingZone>)['analytics'] = 'diary';
(TAB_TO_ZONE as Record<string, TrainingZone>)['calendar'] = 'diary';
(TAB_TO_ZONE as Record<string, TrainingZone>)['checkin'] = 'diary';
(TAB_TO_ZONE as Record<string, TrainingZone>)['mmc_tracking'] = 'diary';
(TAB_TO_ZONE as Record<string, TrainingZone>)['mindset'] = 'diary';
(TAB_TO_ZONE as Record<string, TrainingZone>)['mobility'] = 'diary';
(TAB_TO_ZONE as Record<string, TrainingZone>)['warmup'] = 'diary';
(TAB_TO_ZONE as Record<string, TrainingZone>)['cooldown'] = 'diary';
(TAB_TO_ZONE as Record<string, TrainingZone>)['reports'] = 'diary';
(TAB_TO_ZONE as Record<string, TrainingZone>)['import_data'] = 'diary';
(TAB_TO_ZONE as Record<string, TrainingZone>)['mytraining'] = 'diary';
(TAB_TO_ZONE as Record<string, TrainingZone>)['history'] = 'diary';
// алиасы для депрекейтнутых дублей (удалены из ZONES.tabs, но должны резолвиться)
(TAB_TO_ZONE as Record<string, TrainingZone>)['diagnostics'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['diagnostics_hub'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['quality_hub'] = 'calculators';
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
(TAB_TO_ZONE as Record<string, TrainingZone>)['pri_reppat'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['calc_plates'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['tools_hub'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['tempo'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['tempo_hub'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['quality_diagnostics'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['joint_health'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['quality_joint_hub'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['load_safety'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['load_management'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['intelligence_hub'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['metabolic_hub'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['arm_diagnostics'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['arm_diagnostics_hub'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['wl_diagnostics'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['wl_diagnostics_hub'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['strongman_diagnostics'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['strongman_diagnostics_hub'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['bb_diagnostics'] = 'calculators';
(TAB_TO_ZONE as Record<string, TrainingZone>)['bb_diagnostics_hub'] = 'calculators';

export function zoneForTab(tab: TrainingTab): TrainingZone {
  return TAB_TO_ZONE[tab] ?? 'planner';
}
