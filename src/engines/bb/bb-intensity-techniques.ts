/**
 * bb-intensity-techniques.ts — интенс-техники гипертрофии (Этап BB11, REUSE+EXTEND set-scheme/advanced-methods).
 * Дропсеты, rest-pause, суперсеты, myo-reps, BFR/окклюзия, lengthened partials, механический дроп, пре/пост-истощение.
 * Применяются к памп-дням и фазе интенсификации.
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
  { technique: 'dropset', name: 'Дроп-сет', appliesTo: 'памп', level: ['intermediate','advanced','enhanced'], description: 'После основного подхода — 1-2 снижения веса на 20-30% до отказа. Метаболический стресс.', params: { drops: 2, dropPct: 25 } },
  { technique: 'rest_pause', name: 'Rest-pause', appliesTo: 'тяж', level: ['advanced','enhanced'], description: 'Мини-сет до отказа, 15-20с отдых, ещё мини-сет. Механическое натяжение + набор КПШ.', params: { restSec: 20, minies: 2 } },
  { technique: 'superset', name: 'Суперсет', appliesTo: 'both', level: ['intermediate','advanced','enhanced'], description: 'Два упражнения без отдыха (антагонисты или одна группа). Плотность.', params: { exercises: 2 } },
  { technique: 'myo_rep', name: 'Myo-reps', appliesTo: 'памп', level: ['advanced','enhanced'], description: 'Активационный подход 15-20RePS, затем мини-сеты 3-5 с коротким отдыхом. Высокая эффективность.', params: { activationReps: 15, miniReps: 4, minies: 4, restSec: 15 } },
  { technique: 'bfr', name: 'BFR (окклюзия)', appliesTo: 'памп', level: ['intermediate','advanced','enhanced'], description: 'Окклюзия сосудов + лёгкий вес 20-30% 1RM, высокий КПШ. Гипертрофия с малой нагрузкой.', params: { pct1RM: 30, reps: '30/15/15/15' } },
  { technique: 'lengthened_partials', name: 'Lengthened partials', appliesTo: 'памп', level: ['advanced','enhanced'], description: 'Частичная амплитуда в растянутой позиции. Гипертрофия растяжением.', params: { partialReps: 8 } },
  { technique: 'mechanical_drop', name: 'Механический дроп', appliesTo: 'памп', level: ['intermediate','advanced','enhanced'], description: 'Смена на более выгодную biomechanics позицию без отдыха (напр. жим→жим в раме).', params: { steps: 2 } },
  { technique: 'pre_exhaust', name: 'Пре-истощение', appliesTo: 'тяж', level: ['intermediate','advanced'], description: 'Изоляция целевой мышцы перед базой. Снижение веса базы, но больший стимул мышцы.' },
  { technique: 'post_exhaust', name: 'Пост-истощение', appliesTo: 'тяж', level: ['intermediate','advanced'], description: 'Изоляция после базы. Добивка целевой мышцы.' },
  { technique: 'slow_eccentric', name: 'Медленный эксцентрик', appliesTo: 'both', level: ['intermediate','advanced','enhanced'], description: '4с эксцентрик. Больше повреждений и натяжения в растянутой позиции.' },
];

export function techniquesFor(character: 'тяж' | 'памп' | 'both', level: string): TechniqueSpec[] {
  return INTENSITY_TECHNIQUES.filter(t => (t.appliesTo === character || t.appliesTo === 'both') && t.level.includes(level));
}