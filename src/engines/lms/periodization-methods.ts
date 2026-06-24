/**
 * periodization-methods.ts — методы периодизации и accommodating resistance (Этап PL1, REUSE+EXTEND advanced-methods).
 * linear / undulating (DUP) / conjugate / block; цепи/резина (accommodating resistance); cluster sets; PAP; контрастный тренинг.
 */
export type PeriodizationMethod = 'linear' | 'undulating' | 'conjugate' | 'block' | 'daily_undulating';

export interface MethodSpec {
  method: PeriodizationMethod;
  name: string;
  description: string;
  bestFor: string;
  weeklyPattern: string;        // пример недели
  level: string[];
}

export const PERIODIZATION_METHODS: MethodSpec[] = [
  { method: 'linear', name: 'Линейная периодизация', description: 'Объём снижается, интенсивность растёт от недели к неделе (Bompa).', bestFor: 'Новички, средний уровень; просто и предсказуемо.', weeklyPattern: 'Нед1: 3×12@70% → Нед4: 3×3@90%', level: ['novice','II-KMS','intermediate'] },
  { method: 'undulating', name: 'Волнообразная (DUP)', description: 'Интенсивность и объём меняются каждую тренировку: сила/гипертрофия/мощность.', bestFor: 'Средний-продвинутый; больше вариативности.', weeklyPattern: 'Пн: 3×5@85% (сила), Ср: 4×10@70% (гип), Пт: 6×3@78% (мощность)', level: ['KMS-MS','advanced','enhanced'] },
  { method: 'conjugate', name: 'Конъюгейт (сопряжённый)', description: 'Максимум силы + вариативность: max effort / dynamic effort / повторный метод. Упражнения ротируются 1-3 нед.', bestFor: 'Продвинутые пауэрлифтеры.', weeklyPattern: 'Пн: ME нижнее тело (1RM до 3RM), Ср: DE верх (скорость 8×3@50-60%), Пт: ME верх, Сб: DE низ', level: ['MS-MSMK','advanced','enhanced'] },
  { method: 'block', name: 'Блочная (Issurin)', description: 'Последовательные блоки: накопление → интенсификация → пик. Концентрированная нагрузка на одно качество.', bestFor: 'Продвинутые, соревновательная подготовка.', weeklyPattern: 'Блок1 (накопление 4нед): объём гипертрофии → Блок2 (интенсификация 4нед): сила → Блок3 (пик 2нед)', level: ['KMS-MS','MS-MSMK','advanced','enhanced'] },
  { method: 'daily_undulating', name: 'Ежедневно-волнообразная', description: 'RPE/RIR варьируется по неделе (4/6/8/3).', bestFor: 'Продвинутые натуральные.', weeklyPattern: 'Нед1 RIR4 → Нед2 RIR2 → Нед3 RIR0 → Нед4 deload', level: ['intermediate','advanced'] },
];

export interface AccommodatingResistance {
  type: 'chains' | 'bands' | 'chains_bands';
  name: string;
  effect: string;
  topWeightAddPct: number;   // сколько добавить в верхней точке (% от base)
  bestFor: string;
}

export const ACCOMMODATING_RESISTANCE: AccommodatingResistance[] = [
  { type: 'chains', name: 'Цепи', effect: 'Нагрузка растёт к верхней точке (где атлет сильнее) — учит дожиму и скорости.', topWeightAddPct: 0.10, bestFor: 'Жим, присед — преодоление мёртвой точки вверху.' },
  { type: 'bands', name: 'Резина', effect: 'Ускорение эксцентрики + доп. нагрузка вверху + учит скорость.', topWeightAddPct: 0.15, bestFor: 'Присед, тяга — скорость и мощность.' },
  { type: 'chains_bands', name: 'Цепи + резина', effect: 'Комбинация — максимальный accommodating эффект.', topWeightAddPct: 0.20, bestFor: 'Продвинутые, special exercises.' },
];

export interface AdvancedTechnique {
  id: string;
  name: string;
  description: string;
  scheme: string;
}
export const ADVANCED_TECHNIQUES: AdvancedTechnique[] = [
  { id: 'cluster', name: 'Cluster sets', description: 'Мини-сеты с внутриподходным отдыхом — больше КПШ при высокой интенсивности.', scheme: '4×(2.2.2) @85-90%, 20с внутри' },
  { id: 'pap', name: 'Post-Activation Potentiation', description: 'Тяжёлый подход → затем взрывной лёгкий. PAP усиливает мощность.', scheme: '1×3@90% → 2мин отдых → 3×3@50% взрыв' },
  { id: 'contrast', name: 'Контрастный тренинг', description: 'Чередование тяжёлого и лёгкого взрывного в одном подходе.', scheme: '3×(5@80% + 5@30% взрыв)' },
];

export function methodsForLevel(level: string): MethodSpec[] {
  return PERIODIZATION_METHODS.filter(m => m.level.includes(level));
}