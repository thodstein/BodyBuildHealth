/**
 * bb-intensity-techniques.ts — интенс-техники гипертрофии (Этап BB11, UI-каталог).
 * Дропсеты, rest-pause, суперсеты, myo-reps, BFR/окклюзия, lengthened partials и т.д.
 * Применяются к памп-дням и фазе интенсификации.
 *
 * ВАЖНО: канонический источник движка — `bb-autocoach.engine.ts` (INTENSITY_TECHNIQUES,
 * DEFAULT_TECHNIQUE_BY_PHASE, applyIntensityTechniqueToExercise). Этот файл — UI-каталог
 * расширенных техник (bfr, lengthened_partials, superset/triset, pre/post_exhaust и др.),
 * не дублирующий движок. Для отображения bridge — `bb-technique-display.ts` (обе системы имён).
 * @deprecated engine: используйте `bb-autocoach.engine.ts`; этот файл — только каталог UI.
 *
 * Волна 5.5 (BB-AUTO-EXHAUSTIVE-PRO): философия каталога — ТАЙМ-ЭФФЕКТИВНОСТЬ,
 * не превосходство. Sødal 2023: drop-set ≈ традиционные подходы (SMD 0.04);
 * Havers 2026 / Tsartsapakis 2026: rest-pause — небольшой плюс при равном
 * числе сетов; Enes 2025: темп/амплитуда минимально влияют при равном усилии.
 * Техники выбираются ради экономии времени/комфорта суставов, а не «большего роста».
 */
export type Technique = 'dropset' | 'rest_pause' | 'superset' | 'triset' | 'myo_rep' | 'bfr' | 'lengthened_partials' | 'mechanical_drop' | 'pre_exhaust' | 'post_exhaust' | 'slow_eccentric' | 'rest_pause_cluster';

export interface TechniqueSpec {
  technique: Technique;
  name: string;
  appliesTo: 'тяж' | 'памп' | 'both';
  level: string[];          // подходящие уровни
  description: string;
  params?: Record<string, number | string>;
}

export const INTENSITY_TECHNIQUES: TechniqueSpec[] = [
  { technique: 'dropset', name: 'Дроп-сет', appliesTo: 'памп', level: ['intermediate','advanced','enhanced'], description: 'После основного подхода — 1-2 снижения веса на 20-30% до отказа. Метаболический стресс, экономия времени (Sødal 2023: гипертрофия ≈ традиционным подходам, SMD 0.04).', params: { drops: 2, dropPct: 25 } },
  { technique: 'rest_pause', name: 'Rest-pause', appliesTo: 'тяж', level: ['advanced','enhanced'], description: 'Мини-сет до отказа, 15-20с отдых, ещё мини-сет. Больше объёма за то же время (Sødal 2023: небольшой плюс, не превосходство).', params: { restSec: 20, minies: 2 } },
  { technique: 'superset', name: 'Суперсет', appliesTo: 'both', level: ['intermediate','advanced','enhanced'], description: 'Два упражнения без отдыха (антагонисты или одна группа). Плотность — экономия времени; стимул сопоставим.', params: { exercises: 2 } },
  { technique: 'myo_rep', name: 'Myo-reps', appliesTo: 'памп', level: ['advanced','enhanced'], description: 'Активационный подход 15-20 reps, затем мини-сеты 3-5 с коротким отдыхом. Меньше полных подходов при сопоставимом стимуле.', params: { activationReps: 15, miniReps: 4, minies: 4, restSec: 15 } },
  { technique: 'bfr', name: 'BFR (окклюзия)', appliesTo: 'памп', level: ['intermediate','advanced','enhanced'], description: 'Окклюзия сосудов + лёгкий вес 20-30% 1RM, высокий КПШ. Гипертрофия с малой нагрузкой на суставы (Loenneke 2012).', params: { pct1RM: 30, reps: '30/15/15/15' } },
  { technique: 'lengthened_partials', name: 'Lengthened partials', appliesTo: 'памп', level: ['advanced','enhanced'], description: 'Частичная амплитуда в растянутой позиции. Гипертрофия растяжением (Wolf 2023: ES 0.283 по длине).', params: { partialReps: 8 } },
  { technique: 'mechanical_drop', name: 'Механический дроп', appliesTo: 'памп', level: ['intermediate','advanced','enhanced'], description: 'Смена на более выгодную позицию без отдыха (напр. жим→жим в раме). Продление сета без сброса веса.', params: { steps: 2 } },
  { technique: 'pre_exhaust', name: 'Пре-истощение', appliesTo: 'тяж', level: ['intermediate','advanced'], description: 'Изоляция целевой мышцы перед базой. Сильный памп; превосходства над обычным порядком нет (Ho 2024 NMA — порядок не важен для гипертрофии).' },
  { technique: 'post_exhaust', name: 'Пост-истощение', appliesTo: 'тяж', level: ['intermediate','advanced'], description: 'Изоляция после базы. Добивка целевой мышцы при том же бюджете времени.' },
  { technique: 'triset', name: 'Трисет', appliesTo: 'памп', level: ['advanced','enhanced'], description: 'Три упражнения на одну группу без отдыха. Плотность и метаболический стресс; к гипертрофии — тайм-эффективность.', params: { exercises: 3 } },
  { technique: 'rest_pause_cluster', name: 'Кластерный rest-pause', appliesTo: 'тяж', level: ['advanced','enhanced'], description: 'Тяжёлый вес (85-90% 1RM) с 10-15с отдыха между повторениями. Сила+качество техники в одном подходе (Haff).', params: { pct1RM: 87, repsPerCluster: 2, clusters: 4, restSec: 15 } },
  { technique: 'slow_eccentric', name: 'Медленный эксцентрик', appliesTo: 'both', level: ['intermediate','advanced','enhanced'], description: '4с эксцентрик. Больше натяжения в растянутой позиции; гипертрофия ≈ обычному темпу при равном усилии (Enes 2025).' },
];

export function techniquesFor(character: 'тяж' | 'памп' | 'both', level: string): TechniqueSpec[] {
  return INTENSITY_TECHNIQUES.filter(t => (t.appliesTo === character || t.appliesTo === 'both') && t.level.includes(level));
}