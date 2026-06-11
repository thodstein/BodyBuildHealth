/**
 * Recommendation Engine — Technique fixes, load/volume/intensity adjustments,
 * exercise replacement, variation selection.
 *
 * Generates actionable training recommendations based on analytics.
 *
 * @module recommendation-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type RecType = 'technique' | 'load' | 'volume' | 'intensity' | 'exercise' | 'variation' | 'frequency' | 'recovery';
export type RecSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface Recommendation {
  id: string;
  type: RecType;
  severity: RecSeverity;
  message: string;
  details: string;
  priority: number; // 0-100, higher = more urgent
}

export interface RecommendationInput {
  techniqueScore: number;
  techniqueErrors: string[];
  fatigueScore: number;
  recoveryScore: number;
  priScore: number;
  riskLevel: string;
  riskFlags: string[];
  volumeTrend: number;
  intensityAvg: number;
  frequency: number;
  velocityLoss: number;
  monotony: number;
  strain: number;
  weakPoints: string[];
  currentExercises: string[];
  goal: string;
}

export interface RecommendationOutput {
  recommendations: Recommendation[];
  topPriority: Recommendation | null;
  summary: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Technique recommendations
// ═══════════════════════════════════════════════════════════════════════════

const TECHNIQUE_FIXES: Record<string, { message: string; fix: string; exercises: string[]; priority: number }> = {
  knee_valgus: {
    message: 'Колени заваливаются внутрь при приседе',
    fix: 'Добавьте banded squats и clamshells для укрепления отводящих мышц бедра',
    exercises: ['banded_squat', 'clamshell', 'lateral_band_walk', 'copenhagen_plank'],
    priority: 80,
  },
  butt_wink: {
    message: 'Округление поясницы в нижней точке приседа',
    fix: 'Работайте над мобильностью тазобедренного и голеностопа. Ограничьте глубину до исчезновения wink.',
    exercises: ['goblet_squat', 'ankle_mobility', 'cat_cow', 'hip_90_90'],
    priority: 75,
  },
  rounding_back: {
    message: 'Округление спины при тяге',
    fix: 'Укрепите разгибатели спины и кор. Используйте trap bar для снижения нагрузки на поясницу.',
    exercises: ['back_extension', 'dead_bug', 'bird_dog', 'romanian_deadlift'],
    priority: 85,
  },
  forward_lean: {
    message: 'Избыточный наклон вперёд в приседе',
    fix: 'Укрепите квадрицепсы (front squat), работайте над вертикальностью торса',
    exercises: ['front_squat', 'leg_press', 'goblet_squat', 'wall_sit'],
    priority: 70,
  },
  soft_lockout: {
    message: 'Недожим в жиме лёжа',
    fix: 'Укрепите трицепсы и передние дельты. Добавьте board press и close-grip bench.',
    exercises: ['close_grip_bench', 'board_press', 'tricep_extension', 'floor_press'],
    priority: 70,
  },
  early_hip_rise: {
    message: 'Таз поднимается раньше плеч в тяге',
    fix: 'Укрепите квадрицепсы и кор. Работайте над стартовой позицией.',
    exercises: ['deficit_deadlift', 'front_squat', 'leg_press', 'pause_deadlift'],
    priority: 80,
  },
  bar_drift: {
    message: 'Гриф уходит от тела в тяге',
    fix: 'Добавьте lat activation перед тягой. Используйте banded deadlift.',
    exercises: ['lat_pulldown', 'banded_deadlift', 'scapular_pullup', 'barbell_row'],
    priority: 65,
  },
  depth_deficit: {
    message: 'Недостаточная глубина в приседе',
    fix: 'Работайте над мобильностью. Добавьте tempo squat (3-1-3-0) для контроля.',
    exercises: ['tempo_squat', 'goblet_squat', 'ankle_mobility', 'hip_opener'],
    priority: 60,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Pattern-based exercise substitutions
// ═══════════════════════════════════════════════════════════════════════════

const SAFER_ALTERNATIVES: Record<string, string[]> = {
  back_squat: ['safety_bar_squat', 'front_squat', 'goblet_squat', 'leg_press'],
  bench_press: ['dumbbell_bench', 'floor_press', 'push_up', 'cable_flye'],
  deadlift: ['trap_bar_deadlift', 'romanian_deadlift', 'block_pull', 'kettlebell_swing'],
  overhead_press: ['seated_dumbbell_press', 'landmine_press', 'arnold_press', 'lateral_raise'],
  barbell_row: ['dumbbell_row', 'cable_row', 'chest_supported_row', 'lat_pulldown'],
  pull_up: ['lat_pulldown', 'banded_pull_up', 'ring_row', 'inverted_row'],
};

const VARIATION_BY_WEAK_POINT: Record<string, string[]> = {
  off_the_bottom: ['pause_squat', 'pin_squat', 'deficit_deadlift'],
  lockout: ['block_pull', 'rack_pull', 'board_press', 'floor_press'],
  mid_range: ['banded_squat', 'banded_bench', 'chain_deadlift'],
  stability: ['tempo_squat', 'tempo_bench', 'safety_bar_squat'],
  grip: ['farmer_carry', 'fat_grip_deadlift', 'towel_pullup', 'plate_pinch'],
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Engine
// ═══════════════════════════════════════════════════════════════════════════

export function generateRecommendations(input: RecommendationInput): RecommendationOutput {
  const recs: Recommendation[] = [];
  let id = 0;

  const add = (type: RecType, severity: RecSeverity, message: string, details: string, priority: number) => {
    recs.push({ id: `rec-${++id}`, type, severity, message, details, priority });
  };

  // ── 1. Technique recommendations ──
  for (const error of input.techniqueErrors) {
    const fix = TECHNIQUE_FIXES[error];
    if (fix) {
      const sev = fix.priority >= 80 ? 'high' : fix.priority >= 60 ? 'medium' : 'low';
      add('technique', sev, fix.message, fix.fix + '. Упражнения: ' + fix.exercises.join(', '), fix.priority);
    }
  }

  if (input.techniqueScore < 0.4) {
    add('technique', 'high', 'Критически низкая техника', 'Приоритет: качество движения, а не вес. Используйте tempo-вариации (4-2-2-1).', 90);
  }

  // ── 2. Load adjustments ──
  if (input.velocityLoss > 40) {
    add('load', 'high', `Velocity loss ${Math.round(input.velocityLoss)}% — превышен порог`, 'Снизьте вес на 10-15% для сохранения скорости и качества повторений.', 85);
  }

  if (input.fatigueScore > 0.7 && input.intensityAvg > 80) {
    add('intensity', 'medium', 'Высокая усталость при высокой интенсивности', 'Снизьте интенсивность на 5-10% или уменьшите количество рабочих подходов.', 75);
  }

  // ── 3. Volume adjustments ──
  if (input.monotony > 2.0) {
    add('volume', 'medium', `Монотонность ${input.monotony.toFixed(1)} — риск перетренированности`, 'Варьируйте нагрузку между днями. Добавьте лёгкий день.', 70);
  }

  if (input.strain > 300) {
    add('volume', 'high', `Strain ${Math.round(input.strain)} — критическая накопленная нагрузка`, 'Делоад-неделя рекомендована. Снизьте объём на 40-50% на 7 дней.', 90);
  }

  // ── 4. Frequency adjustments ──
  if (input.fatigueScore > 0.8 && input.frequency >= 5) {
    add('frequency', 'medium', 'Высокая частота при критической усталости', 'Уменьшите частоту до 3-4 тренировок в неделю на 1-2 недели.', 65);
  }

  if (input.recoveryScore < 0.3 && input.frequency >= 4) {
    add('frequency', 'high', 'Низкое восстановление — снизьте частоту', '3 тренировки/нед до восстановления recovery > 0.5.', 80);
  }

  // ── 5. Exercise replacements (risk-based) ──
  if (input.riskLevel === 'high') {
    const riskyExercises = input.currentExercises.filter(ex => SAFER_ALTERNATIVES[ex]);
    for (const ex of riskyExercises) {
      const safer = SAFER_ALTERNATIVES[ex].slice(0, 2).join(', ');
      add('exercise', 'high', `Замените ${ex} из-за высокого риска`, `Безопасные альтернативы: ${safer}`, 88);
    }
  }

  // ── 6. Variation suggestions for weak points ──
  for (const wp of input.weakPoints) {
    const variations = VARIATION_BY_WEAK_POINT[wp];
    if (variations) {
      add('variation', 'low', `Слабое место: ${wp}`, `Добавьте вариации: ${variations.join(', ')}`, 45);
    }
  }

  // ── 7. Recovery recommendations ──
  if (input.recoveryScore < 0.3) {
    add('recovery', 'high', 'Критически низкое восстановление', 'Приоритет: сон 8+ часов, гидратация 3-4L, магний 400 мг, мелатонин 3 мг.', 92);
  }

  if (input.priScore < 30) {
    add('recovery', 'high', `PRI ${input.priScore}% — низкая готовность`, 'Активное восстановление: прогулка 30 мин, растяжка, foam rolling. Пропустите тяжёлую тренировку.', 88);
  }

  // Sort by priority
  recs.sort((a, b) => b.priority - a.priority);

  const top = recs.length > 0 ? recs[0] : null;
  const criticalCount = recs.filter(r => r.severity === 'critical' || r.severity === 'high').length;
  const summary = criticalCount > 0
    ? `🔴 ${criticalCount} критических рекомендаций. ${recs.length} всего.`
    : recs.length > 0
      ? `🟡 ${recs.length} рекомендаций по улучшению тренировок.`
      : '✅ Все показатели в норме. Текущий план оптимален.';

  return { recommendations: recs, topPriority: top, summary };
}
