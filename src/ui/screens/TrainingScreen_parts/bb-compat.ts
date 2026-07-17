/**
 * bb-compat.ts — матрица совместимости параметров ББ-авто.
 * При выборе одного параметра (цель/уровень) — определяет рекомендованные
 * значения для остальных (стратегия прогрессии, тип делода, интенсивность-техника,
 * цель объёма, сплит-паттерны).
 *
 * Принцип "цепочки": выбор цели → подсвечивает ★ совместимые стратегии/делод/техники.
 * Пользователь может выбрать любой вариант, но ★ помогает принять решение.
 */

export interface BBCompatMatrix {
  // По цели (mass/cut/recomp/maintenance/strength_mass)
  byGoal: Record<string, {
    loadStrategy: string[];     // рекомендованные стратегии прогрессии
    deloadType: string[];       // рекомендованные типы делода
    intensityTechnique: string[]; // рекомендованные интенсивность-техники
    volumeGoal: string[];       // рекомендованная цель объёма
    splitHints: string[];       // рекомендованные сплит-паттерны (id)
    description: string;        // почему эти рекомендации
  }>;
  // По уровню (beginner/intermediate/advanced/enhanced)
  byLevel: Record<string, {
    intensityTechnique: string[]; // разрешённые/рекомендованные техники
    volumeGoal: string[];
    splitHints: string[];       // рекомендованные сплиты
    weeksRange: [number, number]; // рекомендованный диапазон мезоцикла
    deloadFreq: number;         // рекомендованная частота делода (нед)
    description: string;
  }>;
}

export const BB_COMPAT: BBCompatMatrix = {
  byGoal: {
    mass: {
      loadStrategy: ['double_progression', 'linear'],
      deloadType: ['pump'],
      intensityTechnique: ['rest_pause', 'drop_set', 'myo_reps'],
      volumeGoal: ['mav', 'mrv'],
      splitHints: ['ppl_6', 'upper_lower_4', 'arnold_6', 'bro_5'],
      description: 'Масса: двойная прогрессия (добить повторы → +вес), pump-делод (кровоток+восстановление), rest_pause/drop_set для механического натяжения, объём MAV-MRV.',
    },
    cut: {
      loadStrategy: ['rpe_based', 'wave'],
      deloadType: ['neural', 'pump'],
      intensityTechnique: ['none', 'pause_rep'],
      volumeGoal: ['mev', 'mav'],
      splitHints: ['upper_lower_3', 'push_pull_2', 'fullbody_3'],
      description: 'Сушка: RPE-авторегуляция (сохранение силы при дефиците), neural-делod (ЦНС), без интенсивность-техник (восстановление ↓), объём MEV-MAV.',
    },
    recomp: {
      loadStrategy: ['double_progression', 'wave'],
      deloadType: ['pump'],
      intensityTechnique: ['pause_rep', 'drop_set'],
      volumeGoal: ['mav'],
      splitHints: ['upper_lower_4', 'ppl_6', 'fullbody_3'],
      description: 'Рекомпозиция: двойная прогрессия + волновая (управление утомлением), pump-делод, pause_rep (время под нагрузкой), объём MAV.',
    },
    maintenance: {
      loadStrategy: ['rpe_based', 'wave'],
      deloadType: ['pump', 'neural'],
      intensityTechnique: ['none'],
      volumeGoal: ['mev', 'mav'],
      splitHints: ['fullbody_2', 'upper_lower_3', 'push_pull_2'],
      description: 'Поддержание: RPE/волновая (без перегрузки), pump/neural-делод, без интенсивность-техник, объём MEV-MAV.',
    },
    strength_mass: {
      loadStrategy: ['linear', 'double_progression'],
      deloadType: ['neural', 'pump'],
      intensityTechnique: ['pause_rep', 'rest_pause'],
      volumeGoal: ['mav'],
      splitHints: ['phul_4', 'upper_lower_4', 'fullbody_3'],
      description: 'Сила+Масса: линейная прогрессия (силовая), neural-делod (ЦНС), pause_rep (механическое натяжение), объём MAV.',
    },
  },
  byLevel: {
    beginner: {
      intensityTechnique: ['none', 'pause_rep'],
      volumeGoal: ['mev', 'mav'],
      splitHints: ['fullbody_3', 'fullbody_2', 'upper_lower_4'],
      weeksRange: [6, 12],
      deloadFreq: 4,
      description: 'Новичок: простые сплиты (фулбоди/верх-низ), без интенсивность-техник (техника важнее), объём MEV-MAV, мезоцикл 6-12 нед.',
    },
    intermediate: {
      intensityTechnique: ['none', 'pause_rep', 'drop_set', 'rest_pause'],
      volumeGoal: ['mav'],
      splitHints: ['upper_lower_4', 'ppl_6', 'push_pull_2', 'bro_5', 'torso_limb_4'],
      weeksRange: [8, 16],
      deloadFreq: 4,
      description: 'Средний: PPL/верх-низ/bro-split, можно drop_set/rest_pause, объём MAV, мезоцикл 8-16 нед.',
    },
    advanced: {
      intensityTechnique: ['rest_pause', 'drop_set', 'myo_reps', 'mechanical_drop', 'pause_rep'],
      volumeGoal: ['mav', 'mrv'],
      splitHints: ['ppl_6', 'arnold_6', 'rolling_3_1_3_1', 'pro_8_day', 'tpt_o_ttp'],
      weeksRange: [8, 20],
      deloadFreq: 4,
      description: 'Опытный: высокочастотные сплиты (PPL/Arnold/PRO 8-дн), все интенсивность-техники, объём MAV-MRV, мезоцикл 8-20 нед.',
    },
    enhanced: {
      intensityTechnique: ['rest_pause', 'drop_set', 'myo_reps', 'mechanical_drop'],
      volumeGoal: ['mrv'],
      splitHints: ['ppl_6', 'pro_8_day', 'fullbody_4', 'rolling_3_1_3_1'],
      weeksRange: [12, 24],
      deloadFreq: 3,
      description: 'Enhanced (PED): максимальная частота (PPL/PRO 8-дн/FB 4×), все интенсивность-техники, объём MRV (PED повышают толерантность), мезоцикл 12-24 нед, делод каждые 3 нед.',
    },
  },
};

/** Получить рекомендованные значения для параметра, исходя из цели и уровня. */
export function getBBSuggestions(
  goal: string,
  level: string,
): {
  loadStrategy: Set<string>;
  deloadType: Set<string>;
  intensityTechnique: Set<string>;
  volumeGoal: Set<string>;
  splitHints: Set<string>;
  weeksRange: [number, number] | null;
  deloadFreq: number | null;
  goalDesc: string;
  levelDesc: string;
} {
  const g = BB_COMPAT.byGoal[goal] || BB_COMPAT.byGoal.mass;
  const l = BB_COMPAT.byLevel[level] || BB_COMPAT.byLevel.intermediate;
  // Пересечение goal × level для intensityTechnique (только то, что разрешено уровнем)
  const intensityTechnique = new Set(g.intensityTechnique.filter(t => l.intensityTechnique.includes(t)));
  // Объединение для loadStrategy (goal приоритет, но level может расширить)
  const loadStrategy = new Set(g.loadStrategy);
  const deloadType = new Set(g.deloadType);
  // Пересечение для volumeGoal
  const volumeGoal = new Set(g.volumeGoal.filter(v => l.volumeGoal.includes(v)));
  // Пересечение для splitHints
  const splitHints = new Set(g.splitHints.filter(s => l.splitHints.includes(s)));
  return {
    loadStrategy,
    deloadType,
    intensityTechnique: intensityTechnique.size > 0 ? intensityTechnique : new Set(['none']),
    volumeGoal: volumeGoal.size > 0 ? volumeGoal : new Set(['mav']),
    splitHints: splitHints.size > 0 ? splitHints : new Set(l.splitHints),
    weeksRange: l.weeksRange,
    deloadFreq: l.deloadFreq,
    goalDesc: g.description,
    levelDesc: l.description,
  };
}
