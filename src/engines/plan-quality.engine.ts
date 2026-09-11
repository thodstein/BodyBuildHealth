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

import {
  checkSessionCap,
  deloadQualityCheck,
  frequencyForVolume,
  isSpecMaintenance,
  lengthBiasCheck,
  loadLayerCheck,
  rirProfileCheck,
  shoulderBalanceCheck,
} from './quality-score-v2.engine';

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
  // ─── Quality Hub PRO (V2-срезы, всё опционально — без них поведение байт-в-байт) ───
  /** Максимум прямых сетов мышцы в одной сессии (для session-капа ≤10). */
  sessionMaxByMuscle?: Record<string, number>;
  /** Имена упражнений по мышцам (для effective-объёма и длины). */
  namesByMuscle?: Record<string, string[]>;
  /** RIR-профиль плана (средний RIR, доли RIR≤2/RIR 0). */
  rirStats?: { avgRir: number; fracRirLE2: number; fracRir0: number; totalSets: number };
  /** Глубина делода (срез объёма 0–1, сдвиг RIR, срез нагрузки, тег фазы). */
  deloadDepth?: { depthVolume?: number | null; rirShift?: number | null; loadDrop?: number | null; phaseTag?: 'deload' | 'taper' | 'peak' | 'none' };
  /** Плечевой баланс верха (жимы vs тяги БЕЗ ног + плоскости + face-pull). */
  shoulder?: { pressSets: number; pullSets: number; hasVerticalPull: boolean; hasHorizontalPull: boolean; hasFacePullOrER: boolean };
  /** Доля длины по мышцам ({lengthSets, totalSets}). */
  lengthShare?: Record<string, { lengthSets: number; totalSets: number }>;
  /** Нагрузка из дневника (ACWR/монотония; без дневника — 0 штрафа). */
  loadData?: { acwr?: number | null; monotony?: number | null; hasDiary: boolean };
  /** Цели спец-блока + MV-режим (не-цели на MEV — поддержание, не штраф). */
  specTargets?: string[];
  maintenanceMuscles?: string[];
}

// ─── Основная функция ───

export function validatePlanQuality(input: PlanQualityInput): PlanQualityResult {
  const {
    dayGroups, weeklySets, frequency, level,
    weakPoints = [], hasDeload = false, deloadWeeks = [],
    planType = 'manual', totalWeeks = 8, exerciseNames = [],
    injuries = [], onCourse = false,
    mrvByMuscle, trainingYears, pedMultiplier,
  } = input;
  const goal = (input as any).goal as string | undefined;
  const trainingFocus = (input as any).trainingFocus as string | undefined;
  const methodology = (input as any).methodology as string | undefined;
  const volumeGoal = (input as any).volumeGoal as string | undefined;
  const specialization = (input as any).specialization as boolean | undefined;
  const focusGroup = (input as any).focusGroup as string | undefined;
  const splitPattern = (input as any).splitPattern as string | undefined;
  // V2-входы (опционально — без них поведение прежнее)
  const sessionMaxByMuscle = (input as any).sessionMaxByMuscle as Record<string, number> | undefined;
  const namesByMuscle = (input as any).namesByMuscle as Record<string, string[]> | undefined;
  const rirStats = (input as any).rirStats as { avgRir: number; fracRirLE2: number; fracRir0: number; totalSets: number } | undefined;
  const deloadDepth = (input as any).deloadDepth as { depthVolume?: number | null; rirShift?: number | null; loadDrop?: number | null; phaseTag?: 'deload' | 'taper' | 'peak' | 'none' } | undefined;
  const shoulder = (input as any).shoulder as { pressSets: number; pullSets: number; hasVerticalPull: boolean; hasHorizontalPull: boolean; hasFacePullOrER: boolean } | undefined;
  const lengthShare = (input as any).lengthShare as Record<string, { lengthSets: number; totalSets: number }> | undefined;
  const loadData = (input as any).loadData as { acwr?: number | null; monotony?: number | null; hasDiary: boolean } | undefined;
  const specTargets = (input as any).specTargets as string[] | undefined;
  const maintenanceMuscles = (input as any).maintenanceMuscles as string[] | undefined;

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
  if (goal) {
    const avgSets = Object.values(weeklySets as Record<string, number>).reduce((a,b)=>a+b,0) / Math.max(1, Object.keys(weeklySets).length);
    if (goal === 'cut' && avgSets > 18) {
      issues.push({
        id: 'goal_cut_volume_high', severity: 'warning', category: 'volume',
        message: `Цель «сушка» выбрана, но средний объём ${avgSets.toFixed(1)} сетов/группа > MAV — на дефиците риск перетрена`,
        detail: `Выбрано: цель cut · План: ${avgSets.toFixed(1)} сетов/группа (MAV≈18)`,
        fix: `Снизить объём до MAV или сменить цель на mass/recomp`,
      });
    }
    if (goal === 'strength_mass' && avgSets < 10) {
      issues.push({
        id: 'goal_strength_low', severity: 'info', category: 'volume',
        message: `Цель «сила+масса» выбрана, но объём низкий (${avgSets.toFixed(1)}) — для силы нужен базовый объём`,
        detail: `Выбрано: strength_mass · План: ${avgSets.toFixed(1)}`,
        fix: `Увеличить объём до MEV/MAV`,
      });
    }
  }
  // Объёмная цель vs факт
  if (volumeGoal) {
    const vg = volumeGoal;
    const overMrv = Object.entries(weeklySets as Record<string, number>).some(([g, s]) => s > (getThresholds(g, level, mrvByMuscle).mrv));
    if (vg === 'mrv' && !overMrv && Object.values(weeklySets as Record<string, number>).every(s=> s < 20)) {
      issues.push({
        id: 'vol_goal_mrv_not_reached', severity: 'info', category: 'volume',
        message: `Цель объёма «максимальный (MRV)» выбрана, но ни одна группа не на MRV — план ниже выбранного уровня`,
        detail: `Выбрано: ${vg} · План: макс ${Math.max(...Object.values(weeklySets as Record<string, number>)).toFixed(1)} сетов`,
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
  if (focusGroup) {
    const fg = focusGroup;
    const fgSets = (weeklySets as Record<string, number>)[fg] ?? (weeklySets as Record<string, number>)[fg.toLowerCase()] ?? 0;
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
  if (specialization && (!weakPoints || weakPoints.length===0)) {
    issues.push({
      id: 'spec_no_weak', severity: 'info', category: 'weak_point',
      message: `Включена специализация, но слабые группы не указаны — план строится как без акцента`,
      detail: `Выбрано: specialization=true · План: weakPoints пусто`,
      fix: `Указать слабые группы или выключить специализацию`,
    });
  }
  // Методика vs разнообразие (упрощённо)
  if (methodology && methodology !== 'compound_first') {
    const uniq = new Set(exerciseNames.flat()).size;
    if (uniq < 6) {
      issues.push({
        id: 'methodology_low_diversity', severity: 'info', category: 'exercise',
        message: `Методика «${methodology}» выбрана, но разнообразие низкое (${uniq} упр.) — эффект методики снижен`,
        detail: `Выбрано: методика ${methodology} · План: ${uniq} уникальных упражнений`,
        fix: `Добавить вариаций для методики`,
      });
    }
  }

  // ─── Quality Hub PRO: V2-срезы (только при новых входах; иначе — тишина) ───
  // MV-конверсия: vol_low на поддержании (MV-режим спец-блока) — info вместо warning.
  // V2-issues копятся отдельно, чтобы legacy-цикл штрафов их не задваивал.
  let v2ScoreAdj = 0;
  const v2Issues: QualityIssue[] = [];
  for (const iss of issues) {
    if (!iss.id.startsWith('vol_low_') || iss.severity !== 'warning') continue;
    const g = iss.muscle || iss.id.slice('vol_low_'.length);
    const t = getThresholds(g, level, mrvByMuscle);
    const sets = (weeklySets as Record<string, number>)[g] ?? 0;
    if (isSpecMaintenance(g, sets, t.mev, specTargets, maintenanceMuscles)) {
      iss.severity = 'info';
      iss.message += ' — поддержание (MV-режим), не штрафуется';
      v2ScoreAdj += 3; // возврат штрафа warning(−5)→info(−2)
    }
  }
  const pushV2 = (
    v: { id: string; severity: 'critical' | 'warning' | 'info'; category: QualityIssue['category']; message: string; muscle?: string; fix?: string },
    penalty: number,
  ) => {
    if (issues.some(i => i.id === v.id) || v2Issues.some(i => i.id === v.id)) return;
    v2Issues.push(v);
    v2ScoreAdj -= penalty;
    if (v.fix) recommendations.push(v.fix);
  };
  // Session-кап (нужен sessionMaxByMuscle)
  if (sessionMaxByMuscle) {
    for (const [g, m] of Object.entries(sessionMaxByMuscle)) {
      const hit = checkSessionCap(g, m);
      if (hit && (weeklySets as Record<string, number>)[g] != null) {
        pushV2({ ...hit, category: 'volume' }, 3);
      }
    }
  }
  // Частота-от-объёма (нужны пороги мышцы — только для групп уже в отчёте)
  for (const m of muscles) {
    const f = frequencyForVolume(m.muscle, m.weeklySets, m.mav, m.mrv, m.frequency);
    if (!f || f.severity === 'info') {
      if (f) pushV2({ ...f, category: 'frequency' }, 0);
      continue;
    }
    // Не дублируем legacy freq_zero (тот же смысл) — дополняем только split-кейсы.
    if (f.id.startsWith('freq_split_')) pushV2({ ...f, category: 'frequency' }, f.severity === 'critical' ? 8 : 4);
  }
  // RIR-профиль
  if (rirStats) {
    for (const r of rirProfileCheck(rirStats, level)) {
      pushV2({ ...r, category: 'progression' }, r.severity === 'critical' ? 8 : 4);
    }
  }
  // Качество делода (глубина — только если передана; наличие/интервал уже проверены выше)
  if (deloadDepth) {
    for (const d of deloadQualityCheck({
      hasDeload, totalWeeks, deloadWeeks,
      depthVolume: deloadDepth.depthVolume,
      rirShift: deloadDepth.rirShift,
      loadDrop: deloadDepth.loadDrop,
      phaseTag: deloadDepth.phaseTag,
    })) {
      if (d.id === 'no_deload' || d.id === 'deload_rare') continue; // уже покрыты legacy-гейтами
      pushV2({ ...d, category: 'deload' }, d.severity === 'warning' ? 3 : 1);
    }
  }
  // Плечо v2 (верх отдельно от ног) — legacy push/pull-ratio оставлен как есть
  if (shoulder) {
    for (const s of shoulderBalanceCheck(shoulder)) {
      pushV2({ ...s, category: 'balance' }, s.severity === 'warning' ? 3 : 1);
    }
  }
  // Длина
  if (lengthShare) {
    for (const l of lengthBiasCheck(lengthShare)) {
      pushV2({ ...l, category: 'exercise' }, 2);
    }
  }
  // Нагрузка (без дневника — 0 штрафа по построению loadLayerCheck)
  if (loadData) {
    const { issues: li } = loadLayerCheck(loadData);
    for (const l of li) {
      pushV2({ ...l, category: 'progression' }, l.severity === 'warning' ? 3 : 1);
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

  // V2-добавка (0 без новых входов — совместимость)
  for (const v of v2Issues) issues.push(v);
  score += v2ScoreAdj;

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
  specTargets?: string[]; maintenanceMuscles?: string[];
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

  // ─── Quality Hub PRO: V2-деривация из факта плана ───
  const sessionMaxByMuscle: Record<string, number> = {};
  const namesByMuscle: Record<string, string[]> = {};
  let rirSum = 0; let rirSets = 0; let rirLE2 = 0; let rir0 = 0;
  let deloadSetsSum = 0; let deloadWeeksN = 0; let baseSetsSum = 0; let baseWeeksN = 0;
  let deloadRirSum = 0; let deloadRirN = 0; let baseRirSum = 0; let baseRirN = 0;
  for (const week of bbPlan.weeks) {
    const isDeloadW = !!(week as any).deload || (week as any).phase === 'deload';
    let weekSets = 0;
    for (const sess of week.sessions) {
      const perMuscle: Record<string, number> = {};
      for (const ex of sess.exercises) {
        perMuscle[ex.muscle] = (perMuscle[ex.muscle] || 0) + ex.sets;
        const nm = ex.name || '';
        const arr = namesByMuscle[ex.muscle] || (namesByMuscle[ex.muscle] = []);
        if (nm && !arr.includes(nm)) arr.push(nm);
        const rir = Number((ex as any).rir);
        if (Number.isFinite(rir)) {
          rirSum += rir * ex.sets; rirSets += ex.sets;
          if (rir <= 2) rirLE2 += ex.sets;
          if (rir <= 0) rir0 += ex.sets;
          if (isDeloadW) { deloadRirSum += rir * ex.sets; deloadRirN += ex.sets; }
          else { baseRirSum += rir * ex.sets; baseRirN += ex.sets; }
        }
        weekSets += ex.sets;
      }
      for (const [g, s] of Object.entries(perMuscle)) {
        sessionMaxByMuscle[g] = Math.max(sessionMaxByMuscle[g] || 0, s);
      }
    }
    if (isDeloadW) { deloadSetsSum += weekSets; deloadWeeksN += 1; }
    else { baseSetsSum += weekSets; baseWeeksN += 1; }
  }
  const rirStats = rirSets >= 5 ? {
    avgRir: Math.round((rirSum / rirSets) * 10) / 10,
    fracRirLE2: Math.round((rirLE2 / rirSets) * 100) / 100,
    fracRir0: Math.round((rir0 / rirSets) * 100) / 100,
    totalSets: rirSets,
  } : undefined;
  const baseAvg = baseWeeksN > 0 ? baseSetsSum / baseWeeksN : 0;
  const deloadAvg = deloadWeeksN > 0 ? deloadSetsSum / deloadWeeksN : 0;
  const deloadDepth = hasDeloadActual ? {
    depthVolume: baseAvg > 0 && deloadWeeksN > 0
      ? Math.max(0, Math.min(1, Math.round((1 - deloadAvg / baseAvg) * 100) / 100))
      : null,
    rirShift: deloadRirN > 0 && baseRirN > 0
      ? Math.round(((deloadRirSum / deloadRirN) - (baseRirSum / baseRirN)) * 10) / 10
      : null,
    loadDrop: null,
    phaseTag: 'deload' as const,
  } : undefined;

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
    sessionMaxByMuscle, namesByMuscle, rirStats, deloadDepth,
    shoulder: deriveShoulderFromNames(namesByMuscle, weeklySets),
    lengthShare: deriveLengthShare(namesByMuscle, weeklySets),
    specTargets: (opts as any).specTargets ?? (bbPlan as any).inputSnapshot?.specTargets,
    maintenanceMuscles: (opts as any).maintenanceMuscles,
  };
}

/** Доля «длины» по именам: наклон/RDL/overhead/глубокая/разводка/сидя-сгибание. */
const LENGTH_NAME_RE = /наклон|incline|румын|rdl|stiff|мёртв|dead.?lift|overhead|над голов|глубок|развод|fly|пуловер|pullover|сидя.*сгиб|seated.*curl|выпад|lunge|болгар/i;

export function deriveLengthShare(
  namesByMuscle: Record<string, string[]>,
  weeklySets: Record<string, number>,
): Record<string, { lengthSets: number; totalSets: number }> {
  const out: Record<string, { lengthSets: number; totalSets: number }> = {};
  for (const [muscle, names] of Object.entries(namesByMuscle)) {
    const total = weeklySets[muscle] || 0;
    if (!total || !names.length) continue;
    const hit = names.filter(n => LENGTH_NAME_RE.test(n)).length;
    const lengthSets = Math.round((total * hit) / names.length);
    out[muscle] = { lengthSets, totalSets: total };
  }
  return out;
}

const VERTICAL_PULL_RE = /подтяг|pull.?up|pulldown|верхн.*блок|тяга.*сверху/i;
const HORIZONTAL_PULL_RE = /тяга.*(наклон|штанг|гантел|горизонт|сидя|блок.*низ)|row|тяга.*т.?гриф/i;
const FACEPULL_RE = /лиц|face.?pull|наружн.*рот|external.*rot|задн.*дельт.*(мах|развед)/i;

/** Плечевой баланс верха по факту имён (ноги исключены по построению). */
export function deriveShoulderFromNames(
  namesByMuscle: Record<string, string[]>,
  weeklySets: Record<string, number>,
): { pressSets: number; pullSets: number; hasVerticalPull: boolean; hasHorizontalPull: boolean; hasFacePullOrER: boolean } {
  const s = (g: string) => weeklySets[g] || 0;
  const pressSets = s('chest') + s('triceps') + s('shoulders') + s('delt_front') + s('delt_mid');
  const pullSets = s('back') + s('biceps') + s('delt_rear');
  const allNames = [...(namesByMuscle['back'] || []), ...(namesByMuscle['biceps'] || []), ...(namesByMuscle['shoulders'] || []), ...(namesByMuscle['delt_rear'] || [])];
  return {
    pressSets, pullSets,
    hasVerticalPull: allNames.some(n => VERTICAL_PULL_RE.test(n)),
    hasHorizontalPull: allNames.some(n => HORIZONTAL_PULL_RE.test(n)),
    hasFacePullOrER: allNames.some(n => FACEPULL_RE.test(n)),
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
  const sessionMaxByMuscle: Record<string, number> = {};
  const namesByMuscle: Record<string, string[]> = {};

  for (const day of days) {
    dayGroups.push(day.groups);
    exerciseNames.push(day.exercises.map(e => e.name));
    const perMuscle: Record<string, number> = {};
    for (const g of day.groups) {
      frequency[g] = (frequency[g] || 0) + 1;
    }
    for (const ex of day.exercises) {
      weeklySets[ex.group] = (weeklySets[ex.group] || 0) + ex.sets;
      perMuscle[ex.group] = (perMuscle[ex.group] || 0) + ex.sets;
      const arr = namesByMuscle[ex.group] || (namesByMuscle[ex.group] = []);
      if (ex.name && !arr.includes(ex.name)) arr.push(ex.name);
    }
    for (const [g, s] of Object.entries(perMuscle)) {
      sessionMaxByMuscle[g] = Math.max(sessionMaxByMuscle[g] || 0, s);
    }
  }

  return {
    dayGroups, weeklySets, frequency,
    level: opts.level, weakPoints: opts.weakPoints,
    hasDeload: opts.hasDeload, planType: 'manual',
    totalWeeks: opts.mesoLength || opts.totalWeeks || 1,
    exerciseNames, injuries: opts.injuries,
    sessionMaxByMuscle, namesByMuscle,
    shoulder: deriveShoulderFromNames(namesByMuscle, weeklySets),
    lengthShare: deriveLengthShare(namesByMuscle, weeklySets),
  };
}
