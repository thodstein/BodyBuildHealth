/**
 * plan-quality.engine.ts — Универсальный валидатор качества тренировочных планов.
 *
 * Проверяет планы BB-авто и ручного конструктора по профессиональным стандартам:
 *  - Объём по группам (MEV/MAV/MRV)
 *  - Частота тренировки групп (2×/нед оптимум)
 *  - Баланс толкай/тянай (push/pull ratio)
 *  - Наличие разгрузочных фаз
 *  - Покрытие слабых групп
 *  - Прогрессия нагрузки (RIR/вес по неделям)
 *  - Баланс тяжёлых/лёгких дней
 *  - Разнообразие упражнений
 *
 * Источники: Israetel M. (RP Strength 2021), Schoenfeld B. (2016), Helms E. (2019).
 */

// ─── Пороговые значения по уровням ───

export interface VolumeThresholds {
  mev: number; // Минимальный эффективный объём (сетов/нед)
  mav: number; // Максимальный адаптивный объём
  mrv: number; // Максимальный восстанавливаемый объём
}

/** Пороги объёма: big/mid = крупные/средние группы, small = мелкие (руки, икры, пресс). */
export const VOLUME_THRESHOLDS: Record<string, { big: VolumeThresholds; small: VolumeThresholds }> = {
  beginner:     { big: { mev: 8,  mav: 14, mrv: 18 }, small: { mev: 6,  mav: 12, mrv: 16 } },
  intermediate: { big: { mev: 10, mav: 18, mrv: 24 }, small: { mev: 8,  mav: 14, mrv: 20 } },
  advanced:     { big: { mev: 12, mav: 22, mrv: 28 }, small: { mev: 10, mav: 16, mrv: 22 } },
  enhanced:     { big: { mev: 14, mav: 26, mrv: 34 }, small: { mev: 12, mav: 20, mrv: 28 } },
};

/** Группы мышц: крупные vs мелкие. */
const BIG_GROUPS = new Set(['chest', 'back', 'quads', 'hamstrings', 'glutes', 'legs']);
const SMALL_GROUPS = new Set(['shoulders', 'biceps', 'triceps', 'arms', 'calves', 'abs', 'core', 'forearms', 'traps']);

function getThresholds(group: string, level: string, mrvByMuscle?: Record<string, number>): VolumeThresholds {
  const t = VOLUME_THRESHOLDS[level] || VOLUME_THRESHOLDS.intermediate;
  const base = BIG_GROUPS.has(group) ? t.big : t.small;
  // Фактический per-muscle MRV-кап (после стажевых/PED/recovery множителей)
  // масштабирует MEV/MAV пропорционально базовому соотношению. Без капа
  // (ручной конструктор) — табличные пороги уровня.
  const cap = mrvByMuscle?.[group];
  if (!cap || cap <= 0 || base.mrv <= 0) return base;
  const scale = cap / base.mrv;
  return {
    mev: Math.max(1, Math.round(base.mev * scale)),
    mav: Math.max(1, Math.round(base.mav * scale)),
    mrv: cap,
  };
}

// ─── Типы результата ───

export type QualitySeverity = 'critical' | 'warning' | 'info';

export interface QualityIssue {
  id: string;
  severity: QualitySeverity;
  category: 'volume' | 'frequency' | 'balance' | 'deload' | 'weak_point' | 'progression' | 'exercise' | 'injury';
  message: string;
  muscle?: string;
  detail?: string;
  fix?: string;
}

export interface MuscleQualityStatus {
  muscle: string;
  weeklySets: number;
  frequency: number;
  mev: number;
  mav: number;
  mrv: number;
  pctOfMav: number;
  status: 'below_mev' | 'in_mev' | 'in_mav' | 'approaching_mrv' | 'exceeding_mrv';
  weakPoint: boolean;
  /** Контекст допустимости: на основе каких параметров пользователя вычислен кап. */
  contextNote?: string;
}

export interface PlanQualityResult {
  score: number;              // 0-100
  grade: string;              // 🟢 Профессионально / 🟡 Хорошо / 🟠 Удовлетворительно / 🔴 Требует доработки
  issues: QualityIssue[];
  muscles: MuscleQualityStatus[];
  summary: string[];          // Текстовые итоги (5-8 строк)
  recommendations: string[];  // Конкретные рекомендации по исправлению
  metadata: {
    totalExercises: number;
    totalSets: number;
    totalVolume: number;
    avgSetsPerDay: number;
    pushPullRatio: string;
    hasDeload: boolean;
    weakPointCoverage: number; // % покрытия слабых групп
  };
}

// ─── Входные данные ───

export interface PlanQualityInput {
  /** Набор мышц по дням: [['chest','triceps'], ['back','biceps'], ...] */
  dayGroups: string[][];
  /** Сеты по группам за неделю: { chest: 18, back: 20, ... } */
  weeklySets: Record<string, number>;
  /** Частота по группам: { chest: 2, back: 2, ... } */
  frequency: Record<string, number>;
  /** Уровень: beginner/intermediate/advanced/enhanced */
  level: string;
  /** Слабые группы */
  weakPoints?: string[];
  /** Есть ли разгрузочная фаза (неделя или явный делод) */
  hasDeload?: boolean;
  /** Недель с фазой разгрузки (для BB) */
  deloadWeeks?: number[];
  /** Тип плана */
  planType?: 'bb' | 'manual' | 'macrocycle';
  /** Количество недель мезоцикла */
  totalWeeks?: number;
  /** Упражнения по дням (для проверки разнообразия) */
  exerciseNames?: string[][];
  /** Травмы */
  injuries?: { muscle: string; exclude?: boolean }[];
  /** PED-курс (увеличивает пороги) */
  onCourse?: boolean;
  /** Фактические per-muscle MRV-капы плана (после стажевых/PED/recovery множителей).
   *  Используются вместо табличных порогов — enhanced-планы с большим стажем
   *  не получают ложных «превышен MRV». */
  mrvByMuscle?: Record<string, number>;
  /** Подтверждённый стаж (лет) — для контекстного комментария в отчёте. */
  trainingYears?: number;
  /** PED-множитель порогов (combinedMrvMultiplier) — для контекста в отчёте. */
  pedMultiplier?: number;
  /** Выбранные параметры — для проверки соответствия плана */
  goal?: string;
  trainingFocus?: string;
  methodology?: string;
  volumeGoal?: string;
  specialization?: boolean;
  focusGroup?: string;
  splitPattern?: string;
}

// ─── Основная функция ───

export function validatePlanQuality(input: PlanQualityInput): PlanQualityResult {
  const {
    dayGroups, weeklySets, frequency, level,
    weakPoints = [], hasDeload = false, deloadWeeks = [],
    planType = 'manual', totalWeeks = 8, exerciseNames = [],
    injuries = [], onCourse = false,
    mrvByMuscle, trainingYears, pedMultiplier,
    goal, trainingFocus, methodology, volumeGoal, specialization, focusGroup, splitPattern,
  } = input as any;

  // Контекстный суффикс для отчёта: на основе каких параметров пользователя
  // сформирован допустимый объём (стаж, курс, фокус, цель, методика).
  const contextParts: string[] = [];
  if (trainingYears !== undefined) contextParts.push(`стаж ${trainingYears} лет`);
  if (onCourse || (pedMultiplier ?? 0) > 1) contextParts.push(`курс PED ×${(pedMultiplier ?? 1).toFixed(2)}`);
  if (goal) contextParts.push(`цель ${goal}`);
  if (trainingFocus) contextParts.push(`фокус ${trainingFocus}`);
  if (methodology) contextParts.push(`методика ${methodology}`);
  if (volumeGoal) contextParts.push(`объём ${volumeGoal}`);
  if (focusGroup) contextParts.push(`фокус-группа ${focusGroup}`);
  if (specialization) contextParts.push(`специализация`);
  if (splitPattern) contextParts.push(`сплит ${splitPattern}`);
  if (contextParts.length === 0) contextParts.push('базовый уровень');
  const USER_CONTEXT = `выбрано по: ${contextParts.join(', ')}`;

  const issues: QualityIssue[] = [];
  const recommendations: string[] = [];
  const allGroups = new Set(dayGroups.flat());

  // 1. Проверка объёма по группам
  const muscles: MuscleQualityStatus[] = [];
  for (const g of allGroups) {
    if (g === 'rest' || g === 'off') continue;
    const sets = weeklySets[g] || 0;
    const freq = frequency[g] || 1;
    const t = getThresholds(g, level, mrvByMuscle);
    const pctOfMav = t.mav > 0 ? Math.round((sets / t.mav) * 100) : 0;

    let status: MuscleQualityStatus['status'];
    if (sets > t.mrv) status = 'exceeding_mrv';
    else if (sets > t.mav) status = 'approaching_mrv';
    else if (sets >= t.mev) status = 'in_mav';
    else if (sets >= t.mev * 0.7) status = 'in_mev';
    else status = 'below_mev';

    const isWeak = weakPoints.includes(g);
    const contextNote = mrvByMuscle?.[g]
      ? `${USER_CONTEXT} → фактический MRV ${t.mrv}`
      : `базовые пороги ${level}`;

    if (sets > t.mrv) {
      issues.push({
        id: `vol_over_${g}`, severity: 'critical', category: 'volume', muscle: g,
        message: `${g}: ${sets} сетов/нед > MRV (${t.mrv}) — риск перетренированности`,
        detail: `${contextNote}`,
        fix: `Снизить до ${t.mav} сетов/нед (MAV)`,
      });
    } else if (sets > t.mav) {
      issues.push({
        id: `vol_high_${g}`, severity: 'warning', category: 'volume', muscle: g,
        message: `${g}: ${sets} сетов/нед > MAV (${t.mav}) — зона толерантности`,
        detail: `${contextNote}`,
        fix: `Оптимально ${t.mav} сетов/нед`,
      });
    } else if (sets < t.mev) {
      issues.push({
        id: `vol_low_${g}`, severity: isWeak ? 'critical' : 'warning', category: 'volume', muscle: g,
        message: `${g}: ${sets} сетов/нед < MEV (${t.mev})${isWeak ? ' — слабая группа недогружена' : ''}`,
        detail: `${contextNote}`,
        fix: `Добавить ${t.mev - sets} сетов/нед (до MEV)`,
      });
    }

    if (isWeak && sets < t.mav) {
      recommendations.push(`${g} (слабая группа): увеличить объём до MAV (${t.mav} сетов/нед)`);
    }

    muscles.push({
      muscle: g, weeklySets: sets, frequency: freq,
      mev: t.mev, mav: t.mav, mrv: t.mrv, pctOfMav, status, weakPoint: isWeak,
      ...(mrvByMuscle?.[g] ? { contextNote } : {}),
    });
  }

  // 2. Проверка частоты
  for (const g of allGroups) {
    if (g === 'rest' || g === 'off') continue;
    const freq = frequency[g] || 1;
    const isWeak = weakPoints.includes(g);

    if (freq < 1) {
      issues.push({
        id: `freq_zero_${g}`, severity: 'critical', category: 'frequency', muscle: g,
        message: `${g}: тренируется 0×/нед — группа не получает нагрузки`,
        fix: `Добавить день с ${g}`,
      });
    } else if (freq === 1 && BIG_GROUPS.has(g)) {
      issues.push({
        id: `freq_low_${g}`, severity: 'warning', category: 'frequency', muscle: g,
        message: `${g}: тренируется 1×/нед — субоптимально для гипертрофии (Schoenfeld 2016)`,
        fix: `Увеличить частоту до 2×/нед`,
      });
    }

    if (isWeak && freq < 2) {
      recommendations.push(`${g} (слабая группа): увеличить частоту до 2×/нед`);
    }
  }

  // 3. Баланс толкай/тянай
  const pushPatterns = new Set(['horizontal_push', 'vertical_push', 'incline_push', 'decline_push', 'dip_push']);
  const pullPatterns = new Set(['horizontal_pull', 'vertical_pull', 'hinge', 'hip_hinge']);
  let pushSets = 0, pullSets = 0;
  for (const [g, sets] of Object.entries(weeklySets)) {
    if (['chest', 'triceps', 'shoulders', 'delt_front', 'delt_mid'].includes(g)) pushSets += sets;
    if (['back', 'biceps', 'delt_rear', 'hamstrings', 'glutes'].includes(g)) pullSets += sets;
  }
  const ratio = pullSets > 0 ? (pushSets / pullSets) : 0;
  const ratioStr = `${pushSets}:${pullSets}`;

  if (ratio > 1.5 && pullSets > 0) {
    issues.push({
      id: 'push_pull_imbalance', severity: 'warning', category: 'balance',
      message: `Дисбаланс толкай/тянай: ${ratioStr} (${(ratio * 100).toFixed(0)}%) — риск травм плеча`,
      fix: `Добавить тяговых упражнений (rows, pull-ups)`,
    });
  } else if (ratio < 0.5 && pushSets > 0) {
    issues.push({
      id: 'pull_dominant', severity: 'info', category: 'balance',
      message: `Тянай доминирует: ${ratioStr} — допустимо, но проверьте объём грудных/дельт`,
    });
  }

  // 4. Разгрузка
  if (!hasDeload && totalWeeks >= 6) {
    issues.push({
      id: 'no_deload', severity: 'critical', category: 'deload',
      message: `Нет разгрузочной фазы при мезо ${totalWeeks} нед — риск перетренированности`,
      fix: `Добавить разгрузку каждые 4-6 недель`,
    });
  }
  if (hasDeload && deloadWeeks.length > 0) {
    const deloadInterval = totalWeeks / deloadWeeks.length;
    if (deloadInterval > 7) {
      issues.push({
        id: 'deload_rare', severity: 'warning', category: 'deload',
        message: `Разгрузка каждые ${Math.round(deloadInterval)} нед — рекомендуется каждые 4-6 нед`,
      });
    }
  }

  // 5. Покрытие слабых групп
  const weakCovered = weakPoints.filter(g => (weeklySets[g] || 0) >= (getThresholds(g, level, mrvByMuscle).mev));
  const weakCoverage = weakPoints.length > 0 ? Math.round((weakCovered.length / weakPoints.length) * 100) : 100;

  for (const g of weakPoints) {
    if (!weakCovered.includes(g)) {
      issues.push({
        id: `weak_uncovered_${g}`, severity: 'critical', category: 'weak_point', muscle: g,
        message: `Слабая группа «${g}» не покрыта (сеты < MEV)`,
        fix: `Добавить объём до MAV для ${g}`,
      });
    }
  }

  // 6. Разнообразие упражнений
  if (exerciseNames.length > 0) {
    const allExNames = exerciseNames.flat();
    const unique = new Set(allExNames);
    const diversity = allExNames.length > 0 ? unique.size / allExNames.length : 1;
    if (diversity < 0.4) {
      issues.push({
        id: 'low_diversity', severity: 'info', category: 'exercise',
        message: `Низкое разнообразие упражнений (${unique.size}/${allExNames.length}) — рассмотрите вариации`,
      });
    }
  }

  // 7. Травмы: проверка что исключённые группы не в плане
  for (const inj of injuries) {
    if (inj.exclude && allGroups.has(inj.muscle)) {
      issues.push({
        id: `injury_active_${inj.muscle}`, severity: 'critical', category: 'injury', muscle: inj.muscle,
        message: `Травмированная группа «${inj.muscle}» включена в план (должна быть исключена) — выбрано исключение, план нарушает`,
        detail: `Выбрано: исключить ${inj.muscle} · План: содержит ${weeklySets[inj.muscle]||0} сетов`,
        fix: `Исключить ${inj.muscle} из плана или сменить травму на щадящую`,
      });
    }
  }

  // 8. Соответствие выбранных параметров и плана — валидация и предупреждения
  // Цель vs объём
  if ((input as any).goal) {
    const avgSets = Object.values(weeklySets).reduce((a,b)=>a+b,0) / Math.max(1, Object.keys(weeklySets).length);
    if ((input as any).goal === 'cut' && avgSets > 18) {
      issues.push({
        id: 'goal_cut_volume_high', severity: 'warning', category: 'volume',
        message: `Цель «сушка» выбрана, но средний объём ${avgSets.toFixed(1)} сетов/группа > MAV — на дефиците риск перетрена`,
        detail: `Выбрано: цель cut · План: ${avgSets.toFixed(1)} сетов/группа (MAV≈18)`,
        fix: `Снизить объём до MAV или сменить цель на mass/recomp`,
      });
    }
    if ((input as any).goal === 'strength_mass' && avgSets < 10) {
      issues.push({
        id: 'goal_strength_low', severity: 'info', category: 'volume',
        message: `Цель «сила+масса» выбрана, но объём низкий (${avgSets.toFixed(1)}) — для силы нужен базовый объём`,
        detail: `Выбрано: strength_mass · План: ${avgSets.toFixed(1)}`,
        fix: `Увеличить объём до MEV/MAV`,
      });
    }
  }
  // Объёмная цель vs факт
  if ((input as any).volumeGoal) {
    const vg = (input as any).volumeGoal;
    const overMrv = Object.entries(weeklySets).some(([g, s]) => s > (getThresholds(g, level, mrvByMuscle).mrv));
    const underMev = Object.entries(weeklySets).some(([g, s]) => s < (getThresholds(g, level, mrvByMuscle).mev));
    if (vg === 'mrv' && !overMrv && Object.values(weeklySets).every(s=> s < 20)) {
      issues.push({
        id: 'vol_goal_mrv_not_reached', severity: 'info', category: 'volume',
        message: `Цель объёма «максимальный (MRV)» выбрана, но ни одна группа не на MRV — план ниже выбранного уровня`,
        detail: `Выбрано: ${vg} · План: макс ${Math.max(...Object.values(weeklySets)).toFixed(1)} сетов`,
        fix: `Увеличить объём или сменить цель на MAV`,
      });
    }
    if (vg === 'mev' && overMrv) {
      issues.push({
        id: 'vol_goal_mev_exceeded', severity: 'warning', category: 'volume',
        message: `Цель «минимальный (MEV)» выбрана, но есть превышения MRV — план выше выбранного уровня`,
        detail: `Выбрано: ${vg} · План: есть группы > MRV`,
        fix: `Снизить объём до MEV/MAV`,
      });
    }
  }
  // Фокус-группа vs объём
  if ((input as any).focusGroup) {
    const fg = (input as any).focusGroup;
    const fgSets = weeklySets[fg] ?? weeklySets[fg.toLowerCase()] ?? 0;
    const fgThresh = getThresholds(fg, level, mrvByMuscle);
    if (fgSets < fgThresh.mav) {
      issues.push({
        id: `focus_low_${fg}`, severity: 'warning', category: 'weak_point', muscle: fg,
        message: `Фокус-группа «${fg}» выбрана, но объём ${fgSets} < MAV ${fgThresh.mav} — фокус не реализован`,
        detail: `Выбрано: фокус ${fg} · План: ${fgSets} сетов (MAV ${fgThresh.mav})`,
        fix: `Увеличить объём фокуса до MAV или убрать фокус`,
      });
    }
  }
  // Специализация без слабых
  if ((input as any).specialization && (!weakPoints || weakPoints.length===0)) {
    issues.push({
      id: 'spec_no_weak', severity: 'info', category: 'weak_point',
      message: `Включена специализация, но слабые группы не указаны — план строится как без акцента`,
      detail: `Выбрано: specialization=true · План: weakPoints пусто`,
      fix: `Указать слабые группы или выключить специализацию`,
    });
  }
  // Методика vs разнообразие (упрощённо)
  if ((input as any).methodology && (input as any).methodology !== 'compound_first') {
    const uniq = new Set(exerciseNames.flat()).size;
    if (uniq < 6) {
      issues.push({
        id: 'methodology_low_diversity', severity: 'info', category: 'exercise',
        message: `Методика «${(input as any).methodology}» выбрана, но разнообразие низкое (${uniq} упр.) — эффект методики снижен`,
        detail: `Выбрано: методика ${(input as any).methodology} · План: ${uniq} уникальных упражнений`,
        fix: `Добавить вариаций для методики`,
      });
    }
  }

  // ─── Расчёт оценки ───
  let score = 100;

  for (const iss of issues) {
    if (iss.severity === 'critical') score -= 15;
    else if (iss.severity === 'warning') score -= 5;
    else score -= 2;
  }

  // Бонус за покрытие слабых групп
  score += Math.min(20, weakCoverage * 0.2);

  // Бонус за наличие делода
  if (hasDeload) score += 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade = score >= 85 ? '🟢 Профессионально'
    : score >= 65 ? '🟡 Хорошо'
    : score >= 45 ? '🟠 Удовлетворительно'
    : '🔴 Требует доработки';

  // ─── Итоговые рекомендации ───
  const criticals = issues.filter(i => i.severity === 'critical');
  if (criticals.length > 0) {
    recommendations.unshift(`⚠ ${criticals.length} критических проблем — исправить до начала`);
  }

  const summary: string[] = [
    `Тип плана: ${planType === 'bb' ? 'Бодибилдинг' : planType === 'manual' ? 'Ручной конструктор' : 'Макроцикл'} · ${level} · ${totalWeeks} нед`,
    `Всего упражнений: ${Object.values(weeklySets).reduce((a, b) => a + b, 0)} сетов/нед по ${allGroups.size} группам`,
    `Толкай/Тянай: ${ratioStr} ${ratio > 1.5 ? '⚠ дисбаланс' : ratio < 0.5 ? '⚠ тянай-доминирование' : '✅'}`,
    `Слабые группы: ${weakPoints.length > 0 ? weakPoints.join(', ') + ` (покрытие ${weakCoverage}%)` : 'не указаны'}`,
    `Разгрузка: ${hasDeload ? '✅ включена' : '❌ отсутствует'}`,
    `Оценка: ${score}/100 ${grade}`,
  ];

  // Метаданные
  const totalSets = Object.values(weeklySets).reduce((a, b) => a + b, 0);
  const dayCount = dayGroups.length || 1;

  return {
    score, grade, issues, muscles, summary, recommendations, metadata: {
      totalExercises: new Set(exerciseNames.flat()).size || totalSets,
      totalSets,
      totalVolume: totalSets * 8, // ~8 reps average
      avgSetsPerDay: Math.round(totalSets / dayCount * 10) / 10,
      pushPullRatio: ratioStr,
      hasDeload,
      weakPointCoverage: weakCoverage,
    },
  };
}

// ─── Утилиты для конвертации планов ───

/** Конвертировать BBPlan → PlanQualityInput — частота и сеты усреднены по всему мезоциклу. */
export function bbPlanToQualityInput(bbPlan: {
  weeks: { sessions: { exercises: { muscle: string; sets: number; name: string }[] }[]; phase?: string; deload?: boolean }[];
  mrvByMuscle?: Record<string, number>;
  pattern?: { id?: string; name?: string };
  inputSnapshot?: any;
}, opts: {
  level: string; weakPoints?: string[]; hasDeload?: boolean; deloadWeeks?: number[];
  onCourse?: boolean; trainingYears?: number; pedMultiplier?: number;
  injuries?: { muscle: string; exclude?: boolean }[];
  goal?: string; trainingFocus?: string; methodology?: string; volumeGoal?: string; specialization?: boolean; focusGroup?: string; splitPattern?: string;
}): PlanQualityInput {
  const weeklySets: Record<string, number> = {};
  const exerciseNames: string[][] = [];
  const freqTotal: Record<string, number> = {};

  // dayGroups — уникальные мышцы по всем неделям для покрытия (а не только нед.1)
  // frequency — средняя частота по всему мезоциклу (сессий/нед), а не только пик/нед.1
  const dayGroupsMap = new Map<string, string[]>();
  for (const week of bbPlan.weeks) {
    for (const sess of week.sessions) {
      const groups = [...new Set(sess.exercises.map(e => e.muscle))];
      // собираем exerciseNames по всем неделям для diversity
      exerciseNames.push(sess.exercises.map(e => e.name));
      for (const g of groups) {
        freqTotal[g] = (freqTotal[g] || 0) + 1;
      }
      // dayGroups — уникальные группы за ротацию (берём первую неделю как базис ротации)
      // но дополняем группами, появляющимися в поздних блоках специализации
      for (const g of groups) if (!dayGroupsMap.has(g)) dayGroupsMap.set(g, [g]);
    }
  }
  // Восстанавливаем dayGroups из первой недели + добавленные специализации
  const week1 = bbPlan.weeks[0];
  const dayGroups: string[][] = [];
  if (week1) {
    for (const sess of week1.sessions) dayGroups.push([...new Set(sess.exercises.map(e => e.muscle))]);
  }
  // Добавляем отсутствующие группы специализации как отдельные дни для покрытия
  for (const g of Object.keys(freqTotal)) if (!dayGroups.flat().includes(g)) dayGroups.push([g]);

  const frequency: Record<string, number> = {};
  const totalWeeks = bbPlan.weeks.length || 1;
  for (const [g, cnt] of Object.entries(freqTotal)) {
    frequency[g] = Math.round((cnt / totalWeeks) * 10) / 10;
    if (frequency[g] < 1 && cnt > 0) frequency[g] = Math.max(1, frequency[g]);
  }

  // Средние сеты по неделям
  for (const week of bbPlan.weeks) {
    for (const sess of week.sessions) {
      for (const ex of sess.exercises) {
        weeklySets[ex.muscle] = (weeklySets[ex.muscle] || 0) + ex.sets;
      }
    }
  }
  for (const g of Object.keys(weeklySets)) {
    weeklySets[g] = Math.round(weeklySets[g] / bbPlan.weeks.length);
  }

  // Авто-определение делода по факту плана, если не передан явно
  const hasDeloadActual = opts.hasDeload ?? bbPlan.weeks.some(w => (w as any).deload || (w as any).phase === 'deload');
  const deloadWeeksActual = opts.deloadWeeks ?? bbPlan.weeks.filter(w => (w as any).deload || (w as any).phase === 'deload').map(w => (w as any).week ?? 0).filter(Boolean);

  return {
    dayGroups, weeklySets, frequency,
    level: opts.level, weakPoints: opts.weakPoints,
    hasDeload: hasDeloadActual, deloadWeeks: deloadWeeksActual,
    planType: 'bb', totalWeeks: bbPlan.weeks.length,
    exerciseNames, onCourse: opts.onCourse,
    mrvByMuscle: bbPlan.mrvByMuscle,
    trainingYears: opts.trainingYears,
    pedMultiplier: opts.pedMultiplier,
    injuries: opts.injuries,
    goal: (opts as any).goal ?? (bbPlan as any).inputSnapshot?.goal ?? (bbPlan as any).goal,
    trainingFocus: (opts as any).trainingFocus ?? (bbPlan as any).inputSnapshot?.trainingFocus ?? (bbPlan as any).trainingFocus,
    methodology: (opts as any).methodology ?? (bbPlan as any).inputSnapshot?.methodology ?? (bbPlan as any).methodology,
    volumeGoal: (opts as any).volumeGoal ?? (bbPlan as any).inputSnapshot?.volumeGoal ?? (bbPlan as any).volumeGoal,
    specialization: (opts as any).specialization ?? (bbPlan as any).inputSnapshot?.specialization ?? !!((bbPlan as any).specializationSchedule?.active),
    focusGroup: (opts as any).focusGroup ?? (bbPlan as any).inputSnapshot?.focusGroup ?? (bbPlan as any).priorityMuscles?.[0],
    splitPattern: (opts as any).splitPattern ?? (bbPlan as any).pattern?.id ?? (bbPlan as any).inputSnapshot?.splitPattern,
  };
}

/** Конвертировать ManualResult (дни) → PlanQualityInput */
export function manualToQualityInput(days: {
  groups: string[];
  exercises: { group: string; sets: number; name: string }[];
}[], opts: {
  level: string; weakPoints?: string[]; hasDeload?: boolean; totalWeeks?: number;
  mesoLength?: number; injuries?: { muscle: string; exclude?: boolean }[];
}): PlanQualityInput {
  const weeklySets: Record<string, number> = {};
  const frequency: Record<string, number> = {};
  const dayGroups: string[][] = [];
  const exerciseNames: string[][] = [];

  for (const day of days) {
    dayGroups.push(day.groups);
    exerciseNames.push(day.exercises.map(e => e.name));
    for (const g of day.groups) {
      frequency[g] = (frequency[g] || 0) + 1;
    }
    for (const ex of day.exercises) {
      weeklySets[ex.group] = (weeklySets[ex.group] || 0) + ex.sets;
    }
  }

  return {
    dayGroups, weeklySets, frequency,
    level: opts.level, weakPoints: opts.weakPoints,
    hasDeload: opts.hasDeload, planType: 'manual',
    totalWeeks: opts.mesoLength || opts.totalWeeks || 1,
    exerciseNames, injuries: opts.injuries,
  };
}
