import type { TrainingDirection } from './training-methodology.engine';

/**
 * Map of direction → recommended methodology names.
 * Used by constructors to highlight relevant methods when a cycle/split is selected.
 */
export const DIRECTION_METHOD_MAP: Record<TrainingDirection, string[]> = {
  strength: [
    'Линейная периодизация (Linear Periodization)',
    'Блочная периодизация (Block Periodization)',
    'Сопряжённый метод (Conjugate / Westside)',
    '5/3/1 (Wendler)',
    'Метод максимальных усилий (Max Effort Method)',
    'Метод динамических усилий (Dynamic Effort Method)',
    'Кластерный метод (Cluster Sets)',
    'RPE-based Autoregulation',
    'Progressive Overload (базовый принцип)',
    'RTS Emerging Strategies (RPE-программирование по Tuchscherer)',
    'Westside Conjugate: структура ME/DE дней',
    'Cluster 5×5 (для 2×/нед)',
    'Негативы (Эксцентрические повторения)',
    'Wave Loading (Волны нагрузки)',
    'Squat Every Day (высокочастотный)',
    'Силовой цикл 2×/нед (ПЛ)',
    'Болгарский метод (Bulgarian Method / Daily Max)',
    'Пауза в нижней точке (Bottom Pause)',
    'Paused Reps (вариации для 2×/нед)',
    'Жимовое троеборье (Bench-only блочная периодизация)',
    'Приседательное троеборье (Squat-центричная периодизация)',
    'Тяговое троеборье (Deadlift-центричная периодизация)',
    'Темп "Силовой" (2-1-1-0)',
    'Темп "Взрывной" (1-0-0-0)',
    'Темп "Скоростной / CAT" (1-0-0-0)',
  ],
  bodybuilding: [
    'Волновая периодизация (Daily Undulating Periodization — DUP)',
    'Метод повторных усилий (Repeated Effort Method)',
    'Rest-Pause Training',
    'Drop Sets (Дроп-сеты)',
    'Myo-Reps',
    'Blood Flow Restriction (BFR)',
    'Pre-Exhaust (Предварительное утомление)',
    'German Volume Training (GVT / 10×10)',
    'FST-7 (Fascia Stretch Training)',
    'Gironda 8×8',
    'Суперсеты (Antagonist Supersets)',
    'Трисеты / Гигантские сеты',
    'Форсированные повторения (Forced Reps)',
    'Двойная прогрессия (Double Progression)',
    'Тройная прогрессия (Triple Progression)',
    'Drop-Set 4/8/12 (метод 50)',
    'Antagonist Superset 2×/нед (Грудь/Спина)',
    'Метаболический тренинг (Giant Sets для жиросжигания)',
    '1.5 повторения',
    'Темп "Гипертрофичный" (3-1-1-0)',
    'Темп "TUL-максимум" (4-2-1-1)',
    'Темп "Изометрия в растяжении" (2-3-1-0)',
    'Tempo для гипертрофии (3-1-1-0)',
    'Volume Landmarks (MEV/MAV/MRV)',
    'High-Frequency Hypertrophy (2×/нед на группу)',
    'Volume Progression RP (мезо 2×/нед)',
    'GVT 2×/нед (10×10 на группу)',
    'HIT (High-Intensity Training / Mentzer)',
    'PPL 6× (2×/нед на группу)',
    'Массонабор груди (Грудная специализация)',
    'Массонабор спины (Спинная специализация)',
    'Массонабор ног (Ножная специализация)',
    'Акцент на плечи (Дельтовидная специализация)',
    'Акцент на руки (Бицепс+Трицепс специализация)',
    'Кор и пресс (Core-специализация)',
    'Верхняя грудь (специализация)',
    'Средняя грудь (специализация)',
    'Нижняя грудь (специализация)',
    'Широчайшие (Ширина спины)',
    'Толщина спины (Средняя часть)',
    'Поясница (Разгибатели спины)',
    'Квадрицепс (специализация)',
    'Бицепс бедра (специализация)',
    'Ягодицы (специализация)',
    'Икры (специализация)',
    'Средняя дельта (Ширина плеч)',
    'Задняя дельта (специализация)',
    'Бицепс (специализация)',
    'Трицепс (специализация)',
    'Передняя дельта (специализация)',
    'Предплечье (специализация хвата)',
  ],
  both: [
    'Линейная периодизация (Linear Periodization)',
    'Волновая периодизация (Daily Undulating Periodization — DUP)',
    'Блочная периодизация (Block Periodization)',
    'Progressive Overload (базовый принцип)',
    'RPE-based Autoregulation',
    'Emom (Every Minute on the Minute)',
    '2×/нед на группу (база)',
    'Верх/Низ 4× (2×/нед на группу)',
    'Full Body 3× (группа ~3×/нед)',
    'Негативы (Эксцентрические повторения)',
    'Wave Loading (Волны нагрузки)',
  ],
};

export function getRecommendedMethods(direction: TrainingDirection): string[] {
  const dirs: TrainingDirection[] = direction === 'both' ? ['strength', 'bodybuilding', 'both'] : [direction];
  return [...new Set(dirs.flatMap(d => DIRECTION_METHOD_MAP[d] || []))];
}

export const SPLIT_METHOD_MAP: Record<string, string[]> = {
  fullbody_3: ['Двойная прогрессия (Double Progression)', 'Progressive Overload (базовый принцип)', 'RPE-based Autoregulation'],
  fullbody_2: ['Двойная прогрессия (Double Progression)', 'Progressive Overload (базовый принцип)', 'RPE-based Autoregulation'],
  fullbody_4: ['Volume Progression RP (мезо 2×/нед)', 'Двойная прогрессия (Double Progression)', 'Метаболический тренинг (Giant Sets для жиросжигания)'],
  upper_lower_4: ['Двойная прогрессия (Double Progression)', 'Volume Landmarks (MEV/MAV/MRV)', 'Суперсеты (Antagonist Supersets)'],
  upper_lower_3: ['Двойная прогрессия (Double Progression)', '2×/нед на группу (база)', 'Верх/Низ 4× (2×/нед на группу)'],
  ppl_6: ['Volume Progression RP (мезо 2×/нед)', 'Drop Sets (Дроп-сеты)', 'Myo-Reps', 'FST-7 (Fascia Stretch Training)'],
  rolling_3_1_3_1: ['Volume Progression RP (мезо 2×/нед)', 'Метаболический тренинг (Giant Sets для жиросжигания)', 'Drop Sets (Дроп-сеты)'],
  rolling_4_1: ['Двойная прогрессия (Double Progression)', 'Суперсеты (Antagonist Supersets)', 'Volume Landmarks (MEV/MAV/MRV)'],
  tpt_o_ttp: ['Volume Progression RP (мезо 2×/нед)', 'Метаболический тренинг (Giant Sets для жиросжигания)', 'FST-7 (Fascia Stretch Training)'],
  arnold_6: ['Суперсеты (Antagonist Supersets)', 'Трисеты / Гигантские сеты', 'Pre-Exhaust (Предварительное утомление)'],
  bro_5: ['Drop Sets (Дроп-сеты)', 'Myo-Reps', 'FST-7 (Fascia Stretch Training)', 'Gironda 8×8', '1.5 повторения'],
  phul_4: ['Двойная прогрессия (Double Progression)', 'Метод максимальных усилий (Max Effort Method)', 'Метод повторных усилий (Repeated Effort Method)'],
  push_pull_2: ['Двойная прогрессия (Double Progression)', 'Суперсеты (Antagonist Supersets)', '2×/нед на группу (база)'],
  torso_limb_4: ['Суперсеты (Antagonist Supersets)', 'Pre-Exhaust (Предварительное утомление)', 'Темп "Гипертрофичный" (3-1-1-0)'],
  strength_4: ['Линейная периодизация (Linear Periodization)', 'Метод максимальных усилий (Max Effort Method)', 'Кластерный метод (Cluster Sets)', 'Пауза в нижней точке (Bottom Pause)'],
};

export function getRecommendedMethodsForSplit(splitId: string): string[] {
  return SPLIT_METHOD_MAP[splitId] || [];
}

/** METHOD_COMPATIBILITY_MAP — когда выбрана одна методика, подсвечиваем совместимые */
export const METHOD_COMPATIBILITY_MAP: Record<string, string[]> = {
  // Периодизация → совместимые прогрессии и техники
  'Линейная периодизация (Linear Periodization)': ['Progressive Overload (базовый принцип)', 'Метод максимальных усилий (Max Effort Method)', 'Темп "Силовой" (2-1-1-0)', 'Пауза в нижней точке (Bottom Pause)'],
  'Блочная периодизация (Block Periodization)': ['Метод максимальных усилий (Max Effort Method)', 'Метод динамических усилий (Dynamic Effort Method)', 'Метод повторных усилий (Repeated Effort Method)', 'Volume Landmarks (MEV/MAV/MRV)'],
  'Волновая периодизация (Daily Undulating Periodization — DUP)': ['Метод повторных усилий (Repeated Effort Method)', 'RPE-based Autoregulation', 'Drop Sets (Дроп-сеты)', 'Rest-Pause Training'],
  'Сопряжённый метод (Conjugate / Westside)': ['Метод максимальных усилий (Max Effort Method)', 'Метод динамических усилий (Dynamic Effort Method)', 'Кластерный метод (Cluster Sets)', 'Темп "Скоростной / CAT" (1-0-0-0)'],
  '5/3/1 (Wendler)': ['Progressive Overload (базовый принцип)', 'RPE-based Autoregulation', 'Кластерный метод (Cluster Sets)'],
  'RTS Emerging Strategies (RPE-программирование по Tuchscherer)': ['RPE-based Autoregulation', 'Метод максимальных усилий (Max Effort Method)', 'Темп "Силовой" (2-1-1-0)'],

  // Прогрессия → совместимые
  'Progressive Overload (базовый принцип)': ['Линейная периодизация (Linear Periodization)', '5/3/1 (Wendler)', 'Двойная прогрессия (Double Progression)', 'Тройная прогрессия (Triple Progression)'],
  'Двойная прогрессия (Double Progression)': ['Progressive Overload (базовый принцип)', 'Volume Landmarks (MEV/MAV/MRV)', 'High-Frequency Hypertrophy (2×/нед на группу)', 'PPL 6× (2×/нед на группу)'],
  'Тройная прогрессия (Triple Progression)': ['Двойная прогрессия (Double Progression)', 'Volume Landmarks (MEV/MAV/MRV)', 'Rest-Pause Training'],

  // Интенсивность → совместимые техники
  'Rest-Pause Training': ['Drop Sets (Дроп-сеты)', 'Myo-Reps', 'Темп "Гипертрофичный" (3-1-1-0)'],
  'Drop Sets (Дроп-сеты)': ['Rest-Pause Training', 'Myo-Reps', 'Drop-Set 4/8/12 (метод 50)', 'Темп "TUL-максимум" (4-2-1-1)'],
  'Myo-Reps': ['Rest-Pause Training', 'Drop Sets (Дроп-сеты)', 'Blood Flow Restriction (BFR)'],
  'Суперсеты (Antagonist Supersets)': ['Antagonist Superset 2×/нед (Грудь/Спина)', 'Трисеты / Гигантские сеты', '2×/нед на группу (база)'],
  'Трисеты / Гигантские сеты': ['Суперсеты (Antagonist Supersets)', 'Метаболический тренинг (Giant Sets для жиросжигания)', '1.5 повторения'],
  'Кластерный метод (Cluster Sets)': ['Cluster 5×5 (для 2×/нед)', 'Метод максимальных усилий (Max Effort Method)', 'Темп "Взрывной" (1-0-0-0)'],
  'Негативы (Эксцентрические повторения)': ['Метод максимальных усилий (Max Effort Method)', 'Темп "Силовой" (2-1-1-0)', 'Форсированные повторения (Forced Reps)'],
  'Blood Flow Restriction (BFR)': ['Myo-Reps', 'High-Frequency Hypertrophy (2×/нед на группу)'],
  'Метаболический тренинг (Giant Sets для жиросжигания)': ['Трисеты / Гигантские сеты', 'Drop Sets (Дроп-сеты)', 'Темп "TUL-максимум" (4-2-1-1)'],

  // Техника → совместимые
  'Темповые повторения (Tempo)': ['Темп "Гипертрофичный" (3-1-1-0)', 'Темп "Силовой" (2-1-1-0)', 'Темп "Стандартный" (2-0-1-0)'],
  'Темп "Гипертрофичный" (3-1-1-0)': ['Темповые повторения (Tempo)', 'Темп "TUL-максимум" (4-2-1-1)', 'Drop Sets (Дроп-сеты)'],
  'Темп "Силовой" (2-1-1-0)': ['Темповые повторения (Tempo)', 'Пауза в нижней точке (Bottom Pause)', 'Paused Reps (вариации для 2×/нед)'],
  'Темп "Скоростной / CAT" (1-0-0-0)': ['Метод динамических усилий (Dynamic Effort Method)', 'Кластерный метод (Cluster Sets)', 'Cluster 5×5 (для 2×/нед)'],
  'Пауза в нижней точке (Bottom Pause)': ['Темп "Силовой" (2-1-1-0)', 'Paused Reps (вариации для 2×/нед)', 'Метод максимальных усилий (Max Effort Method)'],
  '1.5 повторения': ['Трисеты / Гигантские сеты', 'Темп "Гипертрофичный" (3-1-1-0)', 'Gironda 8×8'],
  'Форсированные повторения (Forced Reps)': ['Негативы (Эксцентрические повторения)', 'Drop Sets (Дроп-сеты)', 'Rest-Pause Training'],

  // Объём → совместимые
  'Volume Landmarks (MEV/MAV/MRV)': ['High-Frequency Hypertrophy (2×/нед на группу)', 'Volume Progression RP (мезо 2×/нед)', 'Двойная прогрессия (Double Progression)'],
  'German Volume Training (GVT / 10×10)': ['GVT 2×/нед (10×10 на группу)', 'Темп "Стандартный" (2-0-1-0)', 'Суперсеты (Antagonist Supersets)'],
  'High-Frequency Hypertrophy (2×/нед на группу)': ['Volume Landmarks (MEV/MAV/MRV)', '2×/нед на группу (база)', 'PPL 6× (2×/нед на группу)', 'Верх/Низ 4× (2×/нед на группу)'],
  'FST-7 (Fascia Stretch Training)': ['Drop Sets (Дроп-сеты)', 'Темп "TUL-максимум" (4-2-1-1)', 'Темп "Изометрия в растяжении" (2-3-1-0)'],
  'Gironda 8×8': ['German Volume Training (GVT / 10×10)', '1.5 повторения', 'Темп "Стандартный" (2-0-1-0)'],

  // Частота → совместимые
  'PPL 6× (2×/нед на группу)': ['Двойная прогрессия (Double Progression)', 'High-Frequency Hypertrophy (2×/нед на группу)', '2×/нед на группу (база)'],
  'Верх/Низ 4× (2×/нед на группу)': ['Двойная прогрессия (Double Progression)', 'High-Frequency Hypertrophy (2×/нед на группу)', 'Метод максимальных усилий (Max Effort Method)'],
  '2×/нед на группу (база)': ['High-Frequency Hypertrophy (2×/нед на группу)', 'Двойная прогрессия (Double Progression)', 'PPL 6× (2×/нед на группу)', 'Верх/Низ 4× (2×/нед на группу)'],

  // Специализации (массонабор) → совместимые общие
  'Массонабор груди (Грудная специализация)': ['Темп "Гипертрофичный" (3-1-1-0)', 'Rest-Pause Training', 'Drop Sets (Дроп-сеты)'],
  'Массонабор спины (Спинная специализация)': ['Темп "Силовой" (2-1-1-0)', 'Кластерный метод (Cluster Sets)', 'Myo-Reps'],
  'Массонабор ног (Ножная специализация)': ['German Volume Training (GVT / 10×10)', 'Blood Flow Restriction (BFR)', 'Drop Sets (Дроп-сеты)'],
  'Акцент на плечи (Дельтовидная специализация)': ['Myo-Reps', 'Drop Sets (Дроп-сеты)', 'Rest-Pause Training'],
  'Акцент на руки (Бицепс+Трицепс специализация)': ['Суперсеты (Antagonist Supersets)', '21s', 'Drop Sets (Дроп-сеты)'],
};

/** Получить рекомендованные методики на основе уже выбранных */
export function getRecommendedForMethods(selectedMethods: string[]): Set<string> {
  const s = new Set<string>();
  for (const m of selectedMethods) {
    const compat = METHOD_COMPATIBILITY_MAP[m];
    if (compat) { for (const c of compat) s.add(c); }
  }
  return s;
}
