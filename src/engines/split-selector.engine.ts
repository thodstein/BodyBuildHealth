import type { TrainingInput } from '../core/types';

export interface SplitCandidate {
  id: string;
  name: string;
  desc: string;
  groupsPerDay: string[][];
  score: number;
  rationale: string[];
}

const SPLIT_CATALOG: Record<string, {
  name: string;
  desc: string;
  groupsPerDay: string[][];
  minDays: number;
  maxDays: number;
  levels: string[];
  goals: string[];
  minRecovery: number;
  weakGroupFreq: number;
  injurySafe: boolean;
}> = {
  fullbody_3: {
    name: 'Фулбоди 3 дня',
    desc: 'Все группы на каждой тренировке. Частота 3×/нед на каждую группу.',
    groupsPerDay: [['chest', 'back', 'legs', 'shoulders', 'arms', 'core']],
    minDays: 3, maxDays: 3, levels: ['beginner', 'intermediate'], goals: ['maintenance', 'rehab', 'strength', 'bulk', 'cut'],
    minRecovery: 40, weakGroupFreq: 3, injurySafe: true,
  },
  recovery_3: {
    name: 'Восстановительный 3x',
    desc: '50% объёма, RIR 4, безопасные движения. Для делеода и реабилитации.',
    groupsPerDay: [['chest', 'back', 'shoulders'], ['legs', 'core'], ['full_body_light']],
    minDays: 3, maxDays: 3, levels: ['beginner', 'intermediate', 'advanced', 'enhanced'], goals: ['rehab', 'maintenance'],
    minRecovery: 0, weakGroupFreq: 2, injurySafe: true,
  },
  upper_lower_4: {
    name: 'Верх/Низ 4 дня',
    desc: 'Чередование верхних и нижних дней. Каждая группа 2×/нед, оптимальный баланс.',
    groupsPerDay: [['chest', 'back', 'shoulders', 'arms'], ['legs', 'core']],
    minDays: 4, maxDays: 4, levels: ['beginner', 'intermediate', 'advanced'], goals: ['bulk', 'strength', 'maintenance', 'recomp', 'cut'],
    minRecovery: 50, weakGroupFreq: 2, injurySafe: false,
  },
  ppl_5: {
    name: 'PPL 5 дней',
    desc: 'Push/Pull/Legs + 2 акцентных дня. Частота 2-3×/нед, специализация.',
    groupsPerDay: [['chest', 'shoulders', 'arms'], ['back', 'arms'], ['legs', 'core'], ['chest', 'back'], ['legs', 'shoulders']],
    minDays: 5, maxDays: 5, levels: ['intermediate', 'advanced', 'enhanced'], goals: ['bulk', 'hypertrophy', 'recomp', 'strength'],
    minRecovery: 55, weakGroupFreq: 3, injurySafe: false,
  },
  ppl_2x_6: {
    name: 'PPL 2× 6 дней',
    desc: 'Push/Pull/Legs дважды в неделю. Максимальный объём и частота.',
    groupsPerDay: [['chest', 'shoulders'], ['back', 'arms'], ['legs', 'core']],
    minDays: 6, maxDays: 6, levels: ['advanced', 'enhanced'], goals: ['bulk', 'hypertrophy', 'strength'],
    minRecovery: 65, weakGroupFreq: 4, injurySafe: false,
  },
  push_pull_legs_6: {
    name: 'Push/Pull/Legs 6x',
    desc: 'PPL × 2 с вариациями упражнений. Максимальный объём.',
    groupsPerDay: [['chest', 'shoulders'], ['back', 'arms'], ['legs', 'core']],
    minDays: 6, maxDays: 6, levels: ['advanced', 'enhanced'], goals: ['hypertrophy', 'bulk'],
    minRecovery: 70, weakGroupFreq: 4, injurySafe: false,
  },
  strength_4: {
    name: 'Силовой 4 дня',
    desc: 'Compound фокус, RIR 2-3, длинный отдых. Присед/Жим/Тяга/ОФП.',
    groupsPerDay: [['legs', 'core'], ['chest', 'shoulders'], ['back', 'arms'], ['legs', 'shoulders']],
    minDays: 4, maxDays: 4, levels: ['intermediate', 'advanced', 'enhanced'], goals: ['strength'],
    minRecovery: 55, weakGroupFreq: 2, injurySafe: false,
  },
  bro_5: {
    name: 'Бро-сплит 5 дней',
    desc: 'Одна группа в день. Максимальный объём на группу, но частота 1×/нед.',
    groupsPerDay: [['chest'], ['back'], ['legs'], ['shoulders', 'arms'], ['arms', 'core']],
    minDays: 5, maxDays: 5, levels: ['intermediate', 'advanced'], goals: ['hypertrophy', 'bulk'],
    minRecovery: 60, weakGroupFreq: 1, injurySafe: false,
  },
  torso_limbs_4: {
    name: 'Торс/Конечности 4 дня',
    desc: 'Для травм поясницы и коленей. Минимум нагрузки на суставы.',
    groupsPerDay: [['chest', 'back', 'shoulders'], ['legs', 'core'], ['chest', 'shoulders', 'arms'], ['legs', 'core']],
    minDays: 4, maxDays: 4, levels: ['beginner', 'intermediate'], goals: ['rehab', 'maintenance', 'recomp'],
    minRecovery: 40, weakGroupFreq: 2, injurySafe: true,
  },
  arnold_6: {
    name: 'Сплит Арнольда 6x',
    desc: 'Грудь+Спина / Плечи+Руки / Ноги × 2. Высокочастотный для продвинутых.',
    groupsPerDay: [['chest', 'back'], ['shoulders', 'arms'], ['legs', 'core']],
    minDays: 6, maxDays: 6, levels: ['advanced', 'enhanced'], goals: ['bulk', 'hypertrophy'],
    minRecovery: 65, weakGroupFreq: 3, injurySafe: false,
  },
  powerbuilding_4: {
    name: 'Пауэрбилдинг 4 дня',
    desc: 'Силовое + гипертрофийное. День 1,3: сила. День 2,4: объём.',
    groupsPerDay: [['chest', 'shoulders', 'arms'], ['legs', 'core'], ['back', 'arms'], ['legs', 'shoulders']],
    minDays: 4, maxDays: 4, levels: ['intermediate', 'advanced'], goals: ['strength', 'bulk', 'recomp'],
    minRecovery: 55, weakGroupFreq: 2, injurySafe: false,
  },
  hypertrophy_5: {
    name: 'Гипертрофия 5 дней',
    desc: 'Грудь+трицепс/Спина+бицепс/Ноги/Плечи+руки/Повтор ног. Макс. объём.',
    groupsPerDay: [['chest', 'arms'], ['back', 'arms'], ['legs', 'core'], ['shoulders', 'arms'], ['legs', 'core']],
    minDays: 5, maxDays: 5, levels: ['advanced', 'enhanced'], goals: ['hypertrophy', 'bulk'],
    minRecovery: 60, weakGroupFreq: 3, injurySafe: false,
  },
  cbs_5: {
    name: 'Грудь/Спина/Ноги/Дельты/Руки 5x',
    desc: 'Классический раздельный сплит для промежуточных.',
    groupsPerDay: [['chest'], ['back'], ['legs'], ['shoulders', 'arms'], ['arms', 'core']],
    minDays: 5, maxDays: 5, levels: ['intermediate', 'advanced'], goals: ['hypertrophy', 'bulk', 'maintenance'],
    minRecovery: 60, weakGroupFreq: 1, injurySafe: false,
  },
  powerlifting_4: {
    name: 'Пауэрлифтинг 4 дня',
    desc: 'Присед/Жим/Тяга/ОФП. Силовой пикинг с ME/DE днями. Конjugate-подход.',
    groupsPerDay: [['legs', 'core'], ['chest', 'shoulders', 'arms'], ['back', 'arms', 'core'], ['legs', 'shoulders']],
    minDays: 4, maxDays: 4, levels: ['intermediate', 'advanced', 'enhanced'], goals: ['strength', 'maintenance'],
    minRecovery: 55, weakGroupFreq: 2, injurySafe: false,
  },
  powerlifting_5: {
    name: 'Пауэрлифтинг 5 дней',
    desc: 'С/Ж/Т + 2 дня слабых мест. Динамические и максимальные усилия.',
    groupsPerDay: [['legs'], ['chest', 'shoulders'], ['back', 'core'], ['legs'], ['chest', 'back', 'arms']],
    minDays: 5, maxDays: 5, levels: ['advanced', 'enhanced'], goals: ['strength'],
    minRecovery: 60, weakGroupFreq: 3, injurySafe: false,
  },
  armwrestling_4: {
    name: 'Армрестлинг 4 дня',
    desc: 'Специализация хвата, пронации, сгибания кисти. 2 дня рука/предплечье + 2 дня ОФП.',
    groupsPerDay: [['arms', 'shoulders'], ['back', 'core'], ['arms', 'legs'], ['chest', 'shoulders', 'core']],
    minDays: 4, maxDays: 4, levels: ['intermediate', 'advanced', 'enhanced'], goals: ['strength', 'bulk', 'maintenance'],
    minRecovery: 55, weakGroupFreq: 2, injurySafe: false,
  },
  armwrestling_5: {
    name: 'Армрестлинг 5 дней',
    desc: '3 дня специализация (хват, пронация, рычаг) + 2 дня ОФП.',
    groupsPerDay: [['arms', 'shoulders'], ['back', 'core'], ['arms'], ['chest', 'legs'], ['shoulders', 'arms', 'core']],
    minDays: 5, maxDays: 5, levels: ['advanced', 'enhanced'], goals: ['strength', 'bulk'],
    minRecovery: 60, weakGroupFreq: 3, injurySafe: false,
  },
  olympic_5: {
    name: 'Тяжёлая атлетика 5 дней',
    desc: 'Рывок/Толчок/Присед/Тяга/ОФП. Техника + позиции + сила.',
    groupsPerDay: [['legs', 'shoulders'], ['back', 'core'], ['legs', 'shoulders'], ['chest', 'back', 'arms'], ['legs', 'core']],
    minDays: 5, maxDays: 5, levels: ['advanced', 'enhanced'], goals: ['strength', 'bulk'],
    minRecovery: 65, weakGroupFreq: 3, injurySafe: false,
  },
  olympic_6: {
    name: 'Тяжёлая атлетика 6 дней',
    desc: 'Рывок/Толчок/Присед/Тяга+Жим/ОФП/Повтор. Максимальная частота для элиты.',
    groupsPerDay: [['legs', 'shoulders'], ['back', 'arms'], ['legs', 'core'], ['chest', 'shoulders'], ['back', 'core'], ['legs', 'arms']],
    minDays: 6, maxDays: 6, levels: ['enhanced'], goals: ['strength', 'bulk'],
    minRecovery: 70, weakGroupFreq: 4, injurySafe: false,
  },
};

export function selectSplit(input: TrainingInput): SplitCandidate[] {
  const candidates: SplitCandidate[] = [];
  const { daysPerWeek, recovery, fatigue, nutrition, level, goal, weakPoints, injuries } = input;
  const hasInjury = injuries && injuries.length > 0;

  for (const [id, split] of Object.entries(SPLIT_CATALOG)) {
    let score = 0;
    const rationale: string[] = [];

    // Days match (×3 — mandatory)
    if (split.minDays <= daysPerWeek && split.maxDays >= daysPerWeek) {
      score += 30;
      rationale.push(`${daysPerWeek} дней/нед — подходит для ${split.name}`);
    } else {
      continue;
    }

    // Level match (×2)
    if (split.levels.includes(level)) {
      score += 20;
      rationale.push(`Уровень "${level}" — допустим для данного сплита`);
    } else {
      score -= 15;
      rationale.push(`Уровень "${level}" — не рекомендуется для данного сплита`);
    }

    // Goal match (×2)
    if (split.goals.includes(goal)) {
      score += 20;
      rationale.push(`Цель "${goal}" — оптимальна для данного сплита`);
    } else if (goal === 'strength' && id === 'strength_4') {
      score += 25;
      rationale.push('Силовая цель → силовой сплит приоритет');
    } else {
      score -= 10;
      rationale.push(`Цель "${goal}" — не оптимальна для данного сплита`);
    }

    // Recovery compatibility (×1.5)
    if (recovery >= split.minRecovery) {
      score += 15;
    } else {
      score -= 20;
      rationale.push(`Восстановление ${recovery}% < минимального ${split.minRecovery}% для этого сплита`);
    }

    // Fatigue penalty (×1)
    if (fatigue > 70) {
      score -= 10;
      if (id === 'recovery_3') score += 15;
    }

    // Nutrition penalty (×1)
    if (nutrition < 50) {
      score -= 5;
      if (id === 'recovery_3') score += 10;
    }

    // Weak points priority (×1)
    if (weakPoints.length > 0 && split.weakGroupFreq >= 3) {
      score += 10;
      rationale.push(`Отстающие группы (${weakPoints.length}) — частота ${split.weakGroupFreq}×/нед для специализации`);
    } else if (weakPoints.length > 0 && split.weakGroupFreq <= 1) {
      score -= 10;
      rationale.push('Частота 1×/нед — недостаточна для отстающих групп');
    }

    // Injury safety (×1)
    if (hasInjury && split.injurySafe) {
      score += 15;
      rationale.push('Безопасен при травмах — минимизация осевых нагрузок');
    } else if (hasInjury && !split.injurySafe) {
      score -= 10;
      rationale.push('Осторожно: содержит упражнения с высокой нагрузкой на суставы');
    }

    // Enhanced bonus (×1)
    if (level === 'enhanced' && id.includes('6') && recovery >= 65) {
      score += 10;
      rationale.push('На курсе → повышенное восстановление позволяет высокий объём');
    }

    candidates.push({
      id,
      name: split.name,
      desc: split.desc,
      groupsPerDay: split.groupsPerDay,
      score,
      rationale,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

export function selectBestSplit(input: TrainingInput): SplitCandidate {
  const candidates = selectSplit(input);
  return candidates[0] || {
    id: 'upper_lower_4',
    name: 'Верх/Низ 4 дня (по умолчанию)',
    desc: 'Универсальный сплит для среднего уровня',
    groupsPerDay: [['chest', 'back', 'shoulders', 'arms'], ['legs', 'core']],
    score: 0,
    rationale: ['Сплит по умолчанию — недостаточно данных для точного выбора'],
  };
}

export function getSplitOptions(input: TrainingInput): SplitCandidate[] {
  return selectSplit(input).slice(0, 5);
}