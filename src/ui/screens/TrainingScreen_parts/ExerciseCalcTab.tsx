import React, { useMemo, useState, useEffect } from 'react';
import { EXERCISE_CATALOG, getExerciseById, getExercisesByGroup, getSubstitutes, canReplace } from '../../../core/exercise-catalog';
import { calcExercisePrescription, assignIntensityTechnique } from '../../../engines/training.engine';
import { forceVector, lengthenedPartials, prescribeExercises } from '../../../engines/pro/exercise-prescription.engine';
import { getVolumeByMuscle } from '../../../engines/training-methodology.engine';
import { formatTempo, calculateRepDuration, parseTempo, TEMPO_PRESETS, recommendTempo } from '../../../engines/rep-tempo.engine';
import { mesocyclePhaseForWeek } from '../../../engines/rir-matrix.engine';
import { PopupSelect, PopupNumber, PopupText, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';
import { useDataLink } from '../../../core/data-link';
import { getTargetMuscleForExercise, getTargetMusclesByGroup } from '../../../data/target-muscle-db';
import type { Exercise } from '../../../core/types';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const CARD: React.CSSProperties = { padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' };

const GROUPS = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
const GROUP_RU: Record<string, string> = { all: 'Все группы', chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор' };

const REGION_MAP: Record<string, Array<{ id: string; label: string; desc: string }>> = {
  chest: [
    { id: 'all', label: 'Вся грудь', desc: 'без фильтра' },
    { id: 'upper', label: 'Верх (ключичная)', desc: 'акцент на верхний пучок' },
    { id: 'mid', label: 'Середина', desc: 'средняя часть груди' },
    { id: 'lower', label: 'Низ (грудинная)', desc: 'нижние пучки' },
    { id: 'inner', label: 'Внутренний край', desc: 'центр грудины' },
  ],
  back: [
    { id: 'all', label: 'Вся спина', desc: 'без фильтра' },
    { id: 'lats', label: 'Широчайшие (верх/внешн.)', desc: 'V-образный силуэт' },
    { id: 'lower_lats', label: 'Низ широчайших', desc: 'завершение спины' },
    { id: 'upper_back', label: 'Верх (ромбы/трапеции)', desc: 'толщина спины' },
    { id: 'lower_back', label: 'Поясница', desc: 'разгибатели спины' },
  ],
  legs: [
    { id: 'all', label: 'Всё бедро', desc: 'без фильтра' },
    { id: 'quads', label: 'Квадрицепс', desc: 'передняя поверхность' },
    { id: 'hamstrings', label: 'Бицепс бедра', desc: 'задняя поверхность' },
    { id: 'glutes', label: 'Ягодицы', desc: 'тазовая область' },
    { id: 'calves', label: 'Голень', desc: 'икроножные' },
  ],
  shoulders: [
    { id: 'all', label: 'Все пучки', desc: 'без фильтра' },
    { id: 'front', label: 'Передняя дельта', desc: 'жимовые движения' },
    { id: 'mid', label: 'Средняя дельта', desc: 'ширина плеч' },
    { id: 'rear', label: 'Задняя дельта', desc: 'задняя часть, осанка' },
  ],
  arms: [
    { id: 'all', label: 'Все мышцы рук', desc: 'без фильтра' },
    { id: 'biceps', label: 'Бицепс', desc: 'сгибатели руки' },
    { id: 'triceps', label: 'Трицепс', desc: 'разгибатели руки' },
    { id: 'forearm', label: 'Предплечье', desc: 'хват, запястья' },
  ],
  core: [
    { id: 'all', label: 'Весь кор', desc: 'без фильтра' },
    { id: 'abs', label: 'Пресс', desc: 'прямая мышца живота' },
    { id: 'obliques', label: 'Косые', desc: 'ротация, стабилизация' },
    { id: 'lower_back', label: 'Поясница', desc: 'разгибатели' },
  ],
};

const MUSCLE_KEY_TO_REGION: Record<string, string> = {
  pec_upper: 'upper', pec_mid: 'mid', pec_lower: 'lower',
  quad_lateralis: 'quads', quad_medialis: 'quads', quad_rectus: 'quads',
  hamstrings: 'hamstrings', glutes: 'glutes', gastrocnemius: 'calves', soleus: 'calves',
  delt_front: 'front', delt_mid: 'mid', delt_rear: 'rear',
  biceps_long: 'biceps', biceps_short: 'biceps', brachialis: 'biceps',
  triceps_long: 'triceps', triceps_lateral: 'triceps', triceps_medial: 'triceps', anconeus: 'triceps',
  brachioradialis: 'forearm', flexors: 'forearm', extensors: 'forearm',
  abs_upper: 'abs', abs_lower: 'abs', oblique_external: 'obliques', oblique_internal: 'obliques',
  lats: 'lats', traps_upper: 'upper_back', rhomboids: 'upper_back', traps_mid: 'upper_back',
  spinal_erector: 'lower_back',
};

function getExerciseRegion(exId: string, group: string): string {
  if (group === 'all') return 'all';
  try {
    const tm = getTargetMuscleForExercise(exId);
      if (tm) {
      const k = tm.muscleKey.toLowerCase();
      const match = MUSCLE_KEY_TO_REGION[k];
      if (match) return match;
      if (k.includes('_lower')) return 'lower';
      if (k.includes('_upper')) return 'upper';
      if (k.includes('_mid')) return 'mid';
    }
  } catch { /* ignore */ }
  return 'all';
}

const RIR_TO_RPE: Record<number, number> = { 0: 10, 1: 9, 2: 8, 3: 7, 4: 6, 5: 5, 6: 4, 7: 3, 8: 2 };
const RPE_LABEL: Record<number, string> = { 10: 'Максимально', 9: 'Тяжело, 1 в запасе', 8: 'Умеренно тяжело', 7: 'Средне', 6: 'Легко', 5: 'Очень легко', 4: 'Разминка' };

interface SchemeAlt { name: string; sets: number; reps: string; rir: number; rest: number; desc: string }

function getSchemeAlternatives(ex: Exercise, goal: string, level: string, week: number, totalWeeks: number): SchemeAlt[] {
  const phase = mesocyclePhaseForWeek(week, totalWeeks);
  const isDeload = phase === 'deload';
  const isCompound = ex.type === 'compound';
  const base: SchemeAlt[] = [];
  const p = isDeload ? 'deload' : 'normal';
  if (goal === 'strength') {
    base.push({ name: 'Объёмный', sets: 5, reps: '5', rir: isDeload ? 4 : 2, rest: 180, desc: isDeload ? '5×5, RIR 4 — восстановление' : '5×5, классический объём для силы' });
    base.push({ name: 'Стандарт', sets: 3, reps: '5', rir: isDeload ? 4 : 2, rest: 180, desc: isDeload ? '3×5, RIR 4 — техника' : '3×5 — основной силовой формат' });
    base.push({ name: 'Интенсивный', sets: 3, reps: '3', rir: isDeload ? 4 : 1, rest: 210, desc: isDeload ? '3×3, RIR 4 — легко' : '3×3 — работа с ~87-90% 1RM' });
  } else if (goal === 'hypertrophy') {
    base.push({ name: 'Объёмный', sets: isCompound ? 4 : 3, reps: '10-12', rir: isDeload ? 4 : 1, rest: 90, desc: isDeload ? '3×10-12, RIR 4, отдых 90с' : 'Классический объём для гипертрофии' });
    base.push({ name: 'Пампинг', sets: isCompound ? 4 : 4, reps: '12-15', rir: isDeload ? 4 : 2, rest: 60, desc: isDeload ? '4×12-15, RIR 4' : '4×12-15, RIR 2 — пампинг, метаболический стресс' });
    base.push({ name: 'Тяжёлый', sets: isCompound ? 5 : 4, reps: '6-8', rir: isDeload ? 4 : 1, rest: 120, desc: isDeload ? '3×6-8, RIR 4' : 'Тяжёлый объём для миофибриллярной гипертрофии' });
  } else if (goal === 'endurance') {
    base.push({ name: 'Объёмный', sets: 3, reps: '15-20', rir: isDeload ? 4 : 3, rest: 45, desc: '3×15-20, RIR 3 — аэробная выносливость' });
    base.push({ name: 'Высокообъёмный', sets: 4, reps: '20-25', rir: isDeload ? 5 : 3, rest: 30, desc: '4×20-25 — капилляризация, метаболическая адаптация' });
    base.push({ name: 'Средний', sets: 3, reps: '12-15', rir: isDeload ? 4 : 2, rest: 60, desc: '3×12-15 — гибрид силы и выносливости' });
  } else if (goal === 'power') {
    base.push({ name: 'Взрывной', sets: 5, reps: '3', rir: isDeload ? 4 : 2, rest: 180, desc: '5×3 — скорость и мощность' });
    base.push({ name: 'Динамический', sets: 8, reps: '2', rir: isDeload ? 4 : 3, rest: 120, desc: '8×2 — динамические усилия, ~60% 1RM' });
    base.push({ name: 'Тяжёлый', sets: 3, reps: '3-5', rir: isDeload ? 4 : 1, rest: 210, desc: '3×3-5 — силовая мощность' });
  } else {
    base.push({ name: 'Стандарт', sets: 3, reps: '8-12', rir: 2, rest: 90, desc: '3×8-12, RIR 2 — универсальный формат' });
    base.push({ name: 'Объёмный', sets: 4, reps: '10-15', rir: 2, rest: 60, desc: '4×10-15 — акцент на объём' });
    base.push({ name: 'Щадящий', sets: 2, reps: '10-12', rir: 4, rest: 120, desc: '2×10-12, RIR 4 — минимальная нагрузка' });
  }
  if (isDeload) base.forEach(s => { s.rir = Math.max(4, s.rir); s.rest = Math.min(s.rest, 90); });
  return base.slice(0, 3);
}

function formatRepsRange(goal: string, isCompound: boolean): string {
  const ranges: Record<string, [number, number]> = {
    strength: [3, 6], hypertrophy: [8, 12], bulk: [6, 10], cut: [10, 15],
    maintenance: [8, 12], endurance: [12, 20], rehab: [12, 20], recomp: [6, 10],
  };
  const r = { ...(ranges[goal] || [8, 12]) };
  if (isCompound) { r[0] = Math.max(3, r[0] - 2); r[1] = Math.max(6, r[1] - 2); }
  return `${r[0]}-${r[1]}`;
}

// ── PROFESSIONAL BODYBUILDING ANALYSIS ──

type ForceCurveType = 'stretch_mediated' | 'mid_range' | 'peak_contraction' | 'variable';

interface ForceCurveProfile {
  curve: ForceCurveType;
  label: string;
  score: number;          // hypertrophy stretch score 1-10
  desc: string;
  bestGoal: string;
  repStyle: string;
}

function getResistanceProfile(ex: Exercise): ForceCurveProfile {
  const g = ex.group;
  const t = ex.type;
  const n = ex.name.toLowerCase();
  const js = ex.jointStress || 'medium';

  // Keyword-based detection for known stretch-mediated exercises
  const stretchKeywords = ['fly', 'развод', 'pullover', 'пуловер', 'romanian', 'румын', 'rdl',
    'good morning', 'гуд', 'dip', 'брусь', 'deep squat', 'front squat', 'фронт', 'lunge', 'выпад',
    'bulgarian', 'болгар', 'overhead triceps', 'француз', 'incline curl', 'скотт', 'concentration',
    'концентра', 'leg curl', 'сгибани', 'hyperextension', 'гиперэкстен', 'pull-up', 'подтяг',
    'chin-up', 'cable crossover', 'кроссовер', 'pec deck', 'бабоч'];
  const isStretch = stretchKeywords.some(k => n.includes(k));

  // Mid-range dominant keywords
  const midKeywords = ['bench press', 'жим штан', 'deadlift', 'станов', 'squat', 'присед',
    'row', 'тяга гант', 'military press', 'арме', 'press machine', 'shoulder press',
    'triceps pushdown', 'разгибани', 'barbell curl', 'подъем на биц', 'standing calf',
    'leg press', 'hack squat', 'гантеля'];
  const isMid = midKeywords.some(k => n.includes(k));

  // Peak contraction
  const peakKeywords = ['kickback', 'kick-back', 'отведени', 'lateral raise', 'махи сторон',
    'front raise', 'перед собой', 'bent-over raise', 'face pull', 'pull face', 'cable curl',
    'triceps extension', 'leg extension', 'calf raise', 'подъем на нос'];
  const isPeak = peakKeywords.some(k => n.includes(k));

  let curve: ForceCurveType;
  let score: number;
  let bestGoal: string;
  let repStyle: string;

  if (isStretch) {
    curve = 'stretch_mediated';
    score = t === 'compound' ? 9 : 10;
    bestGoal = 'hypertrophy';
    repStyle = 'Медленная эксцентрика 3-4с, пауза в растянутой позиции 1-2с';
  } else if (isPeak) {
    curve = 'peak_contraction';
    score = t === 'compound' ? 4 : 6;
    bestGoal = 'pump';
    repStyle = 'Быстрая концентрика с пиковым удержанием 2с, короткая амплитуда';
  } else if (isMid) {
    curve = 'mid_range';
    score = t === 'compound' ? 5 : 6;
    bestGoal = 'strength';
    repStyle = 'Взрывная концентрика, контролируемая эксцентрика, без пауз в крайних точках';
  } else if (t === 'compound' && g === 'legs') {
    curve = 'stretch_mediated';
    score = 8;
    bestGoal = 'hypertrophy';
    repStyle = 'Полная амплитуда, пауза в нижней точке, медленный подъём';
  } else if (t === 'compound') {
    curve = 'mid_range';
    score = 5;
    bestGoal = 'strength';
    repStyle = 'Стандартный темп, избегайте пауз в крайних точках';
  } else {
    curve = 'peak_contraction';
    score = 5;
    bestGoal = 'pump';
    repStyle = 'Пиковое сокращение 1-2с, контролируемая эксцентрика';
  }

  const curveLabel: Record<ForceCurveType, string> = {
    stretch_mediated: 'Растяжение (длинная позиция)',
    mid_range: 'Середина амплитуды',
    peak_contraction: 'Пиковое сокращение',
    variable: 'Переменная',
  };
  const curveDesc: Record<ForceCurveType, string> = {
    stretch_mediated: 'Максимальное сопротивление приходится на растянутую позицию. Идеально для гипертрофии — создаёт наибольшее механическое напряжение в саркомерах, активирует mTOR и факторы роста. Лучшие упражнения для роста.',
    mid_range: 'Основное усилие в середине амплитуды (самая сильная биомеханическая зона). Эффективно для силы и миофибриллярной гипертрофии, но уступает stretch-mediated в общем росте мышц.',
    peak_contraction: 'Пик нагрузки в сокращённой позиции. Хорошо для насоса и метаболического стресса, минимальное механическое растяжение. Используйте как добивочные.',
    variable: 'Профиль сопротивления меняется в зависимости от угла и оборудования. Анализируйте индивидуально.',
  };

  return {
    curve, label: curveLabel[curve], score,
    desc: curveDesc[curve], bestGoal, repStyle,
  };
}

// Regression / progression pairs for difficulty scaling
interface DifficultyPair { name: string; diff: 'easier' | 'harder'; how: string; reason: string }

function getDifficultyScaler(ex: Exercise): DifficultyPair[] {
  const n = ex.name.toLowerCase();
  const g = ex.group;
  const pairs: DifficultyPair[] = [];

  // Regressions (easier)
  if (n.includes('bench')) { pairs.push({ name: 'Жим гантелей', diff: 'easier', how: 'Замените штангу на гантели на 10-15% легче', reason: 'Большая амплитуда, естественная траектория, меньше нагрузки на плечи' }); }
  if (n.includes('жим штан') && g === 'chest') { pairs.push({ name: 'Жим в машине Смита', diff: 'easier', how: 'Снизьте вес на 10% и работайте в Смите', reason: 'Фиксированная траектория, не требует стабилизации, меньше риск травмы' }); }
  if (n.includes('присед') || n.includes('squat')) { pairs.push({ name: 'Гоблет-присед с гантелью', diff: 'easier', how: 'Одна гантель 10-20 кг перед грудью', reason: 'Естественный центр тяжести, меньшая осевая нагрузка, контроль глубины' }); }
  if (n.includes('станов') || n.includes('deadlift')) { pairs.push({ name: 'Румынская тяга', diff: 'easier', how: 'Снизьте вес на 20%, работайте с прямой спиной', reason: 'Меньше нагрузка на поясницу, акцент на заднюю цепь, безопаснее' }); }
  if (n.includes('подтяг') || n.includes('pull-up') || n.includes('chin-up')) { pairs.push({ name: 'Подтягивания с резиной или гравитрон', diff: 'easier', how: 'Используйте резиновый жгут или противовес 10-20 кг', reason: 'Снижает нагрузку на собственный вес, позволяет делать больше повторений с правильной техникой' }); }
  if (n.includes('отжиман') || n.includes('dip') || n.includes('брусь')) { pairs.push({ name: 'Отжимания от пола с возвышения', diff: 'easier', how: 'Опустите ноги на скамью (наклон вверх)', reason: 'Снижает % собственного веса, меньше нагрузка на плечи' }); }

  // Progressions (harder)
  if (n.includes('bench') || (n.includes('жим штан') && g === 'chest')) { pairs.push({ name: 'Жим с паузой', diff: 'harder', how: 'Добавьте паузу 2с на груди. Вес снизить на 10-15%', reason: 'Убирает рефлекс растяжения, увеличивает TUT, взрыв со дна' }); }
  if ((n.includes('присед') || n.includes('squat')) && !n.includes('front') && !n.includes('гоблет')) { pairs.push({ name: 'Фронтальный присед', diff: 'harder', how: 'Штанга на груди. Вес снизить на 20%', reason: 'Больше акцент на квадрицепс, меньше на спину, вертикальнее корпус' }); }
  if (n.includes('станов') || n.includes('deadlift')) { pairs.push({ name: 'Дефицитная тяга (стоя на плинтах)', diff: 'harder', how: 'Встаньте на плинты 5-10см, вес снизить на 10%', reason: 'Увеличенная амплитуда, больше работы в растянутой позиции' }); }
  if (n.includes('подтяг') || n.includes('pull-up') || n.includes('chin-up')) { pairs.push({ name: 'Подтягивания с отягощением', diff: 'harder', how: 'Добавьте 5-10 кг на поясе', reason: 'Увеличивает сопротивление при сохранении полной амплитуды' }); }
  if (n.includes('тяга штан') || n.includes('barbell row') || n.includes('row')) { pairs.push({ name: 'Pendlay row (тяга с пола)', diff: 'harder', how: 'Каждый повтор начинается с пола. Вес снизить на 10%', reason: 'Убирает инерцию, больше взрывной работы, чище техника' }); }
  if (n.includes('махи сторон') || n.includes('lateral raise')) { pairs.push({ name: 'Махи с паузой 2с вверху', diff: 'harder', how: 'Добавьте 2с паузу в верхней точке, вес снизить на 20%', reason: 'Увеличивает TUT, пиковое сокращение, меньше читинг' }); }

  // Generic regressions/progressions based on type
  if (g !== 'core' && pairs.length < 2) {
    if (ex.type === 'compound') {
      if (!pairs.some(p => p.diff === 'easier')) pairs.push({ name: 'Вариант с гантелями', diff: 'easier', how: 'Используйте гантели вместо штанги, вес -15%', reason: 'Естественная амплитуда, меньше стресс на суставы' });
      if (!pairs.some(p => p.diff === 'harder')) pairs.push({ name: 'Темповая версия', diff: 'harder', how: 'Снизьте вес на 10%, добавьте темп 3-0-1-0', reason: 'Увеличенное TUT, больше метаболического стресса' });
    } else {
      if (!pairs.some(p => p.diff === 'harder')) pairs.push({ name: 'Drop-set версия', diff: 'harder', how: 'Последний подход — дроп: -20% → до отказа → -20% → до отказа', reason: 'Максимальный метаболический стресс и пампинг' });
    }
  }
  return pairs;
}

// CNS vs muscular fatigue analysis
interface FatigueAnalysis {
  cnsLoad: number;
  muscularLoad: number;
  recoveryHours: number;
  cnsLabel: string;
  muscularLabel: string;
  advice: string;
}

function getFatigueAnalysis(ex: Exercise, presc: { sets: number; rir: number }, isDeload: boolean, phase: string): FatigueAnalysis {
  const isCompound = ex.type === 'compound';
  const js = ex.jointStress || 'medium';
  const baseFatigue = ex.fatigueCost || 5;

  // CNS: compound + high joint stress + low reps → high CNS
  const cnsBase = isCompound ? (js === 'high' ? 7 : 5) : 2;
  const cnsSetFactor = Math.min(presc.sets / 3, 1.5);
  const cnsRirPenalty = presc.rir <= 1 ? 1.2 : presc.rir >= 4 ? 0.6 : 1;
  const cnsDeload = isDeload ? 0.3 : 1;
  const cnsLoad = Math.min(10, +(cnsBase * cnsSetFactor * cnsRirPenalty * cnsDeload).toFixed(1));

  // Muscular: higher for isolation + high volume + high fatigue cost
  const muscBase = isCompound ? 4 : 7;
  const muscSetFactor = Math.min(presc.sets / 4, 1.6);
  const muscFatigueMult = baseFatigue / 5;
  const muscDeload = isDeload ? 0.35 : 1;
  const muscularLoad = Math.min(10, +(muscBase * muscSetFactor * muscFatigueMult * muscDeload).toFixed(1));

  // Recovery estimation
  const totalLoad = cnsLoad + muscularLoad;
  const recHours = Math.round(
    (isCompound ? 48 : 24) * (totalLoad / 12) * (isDeload ? 0.5 : 1)
  );

  const cnsLabel = cnsLoad >= 7 ? 'Высокая (ЦНС)' : cnsLoad >= 4 ? 'Умеренная' : 'Низкая';
  const muscularLabel = muscularLoad >= 7 ? 'Высокая (мышцы)' : muscularLoad >= 4 ? 'Умеренная' : 'Низкая';

  let advice = '';
  if (cnsLoad >= 7) { advice = 'Тяжёлое базовое движение. Лимитирующий фактор — ЦНС и периферическая нервная система. Восстановление: 48-72ч до следующей тяжёлой тренировки. Рекомендовано: минимизировать дополнительную работу на синергисты, спать ≥8ч, L-теанин 200мг перед сном.'; }
  else if (muscularLoad >= 7) { advice = 'Высокое мышечное утомление. Метаболический стресс доминирует. Восстановление: 24-48ч. Рекомендовано: лёгкая активность (ходьба), увеличение белка до 2г/кг, через 48ч можно повторить ту же группу с меньшим объёмом.'; }
  else if (cnsLoad + muscularLoad <= 4) { advice = 'Низкое утомление. Можно выполнять ежедневно или через день. Подходит для финишёров, разминки или восстановительных сессий.'; }
  else { advice = 'Умеренная нагрузка. Восстановление: 24-48ч. Контролируйте объём — не увеличивайте более 10% в неделю для этой группы.'; }

  return { cnsLoad, muscularLoad, recoveryHours: recHours, cnsLabel, muscularLabel, advice };
}

export const ExerciseCalcTab: React.FC = () => {
  const { profile } = useDataLink();
  const [group, setGroup] = useState<string>('chest');
  const [exId, setExId] = useState<string>('');
  const [oneRM, setOneRM] = useState<number>(0);
  const [goal, setGoal] = useState<string>('strength');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [week, setWeek] = useState<number>(1);
  const [totalWeeks, setTotalWeeks] = useState<number>(12);
  const [manualTempo, setManualTempo] = useState<string>('');
  const [weakToggle, setWeakToggle] = useState<boolean>(false);
  const [region, setRegion] = useState<string>('all');

  // Comparison mode state
  const [compareMode, setCompareMode] = useState(false);
  const [exId2, setExId2] = useState<string>('');

  const [showSubstitutes, setShowSubstitutes] = useState(false);
  const [substituteList, setSubstituteList] = useState<Array<{id: string; name: string; reason: string}>>([]);
  const [savedCalcs, setSavedCalcs] = useState<Array<{ id: number; name: string; goal: string; level: string; week: number; oneRM: number; reps: string; sets: number; rir: number; rest: number; weight: number; date: string }>>(() => { try { return JSON.parse(localStorage.getItem('he_excalc_saved') || '[]'); } catch { return []; } });
  const saveCalc = () => {
    if (!ex || !presc) return;
    try {
      const item = { id: Date.now(), name: ex.name, goal, level, week, oneRM, reps: presc.reps, sets: presc.sets, rir: presc.rir, rest: presc.rest, weight: workWeight, tempo: manualTempo || presc.tempo, date: new Date().toISOString().slice(0, 10) };
      const arr = JSON.parse(localStorage.getItem('he_excalc_saved') || '[]');
      arr.unshift(item);
      localStorage.setItem('he_excalc_saved', JSON.stringify(arr.slice(0, 30)));
      setSavedCalcs(arr.slice(0, 30));
    } catch { /* ignore */ }
  };
  const deleteCalc = (id: number) => { try { const arr = (JSON.parse(localStorage.getItem('he_excalc_saved') || '[]') as any[]).filter(x => x.id !== id); localStorage.setItem('he_excalc_saved', JSON.stringify(arr)); setSavedCalcs(arr); } catch { /* ignore */ } };

  useEffect(() => {
    if (!profile) return;
    const lvl = profile?.settings.trainingLevel ?? 'intermediate';
    setLevel((lvl === 'enhanced' ? 'advanced' : lvl) as 'beginner' | 'intermediate' | 'advanced');
    setGoal((profile?.settings as any)?.training?.primaryGoal ?? 'strength');
  }, [profile]);

  useEffect(() => {
    if (!exId || !profile) { setOneRM(0); return; }
    const baseline = profile?.settings.strengthBaselines?.[exId];
    setOneRM(baseline && baseline > 0 ? baseline : 100);
  }, [exId, profile]);

  const exList = useMemo(() => {
    let list = group === 'all' ? EXERCISE_CATALOG : EXERCISE_CATALOG.filter(e => e.group === group);
    if (region !== 'all') {
      list = list.filter(e => getExerciseRegion(e.id, e.group) === region);
    }
    return list;
  }, [group, region]);
  const ex: Exercise | undefined = useMemo(() => EXERCISE_CATALOG.find(e => e.id === exId), [exId]);
  const ex2: Exercise | undefined = useMemo(() => compareMode ? EXERCISE_CATALOG.find(e => e.id === exId2) : undefined, [exId2, compareMode]);

  const presc = useMemo(() => {
    if (!ex) return null;
    try { return calcExercisePrescription(ex, goal, level, weakToggle, false, 1, week, totalWeeks); } catch { return null; }
  }, [ex, goal, level, weakToggle, week, totalWeeks]);

  const reps0 = ex && presc ? (parseInt(presc.reps) || 5) : 5;
  const pct = Math.round(100 / (1 + reps0 / 30));
  const workWeight = ex && presc ? +(oneRM * pct / 100).toFixed(1) : 0;

  // Reset region when group changes
  useEffect(() => { setRegion('all'); }, [group]);

  // ---- NEW COMPUTED VALUES ----

  const phase = useMemo(() => mesocyclePhaseForWeek(week, totalWeeks), [week, totalWeeks]);
  const isDeload = phase === 'deload';

  // Volume load: sets × reps × weight
  const volumeLoad = useMemo(() => {
    if (!ex || !presc || !workWeight) return 0;
    const avgReps = parseInt(presc.reps.split('-')[0]) + parseInt(presc.reps.split('-')[1] || presc.reps.split('-')[0]);
    return Math.round(presc.sets * (avgReps / 2) * workWeight);
  }, [ex, presc, workWeight]);

  // TUT
  const tutInfo = useMemo(() => {
    if (!ex || !presc || !workWeight) return null;
    const tempo = parseTempo(manualTempo || presc.tempo);
    if (!tempo) return null;
    const repDuration = calculateRepDuration(tempo);
    const avgReps = parseInt(presc.reps.split('-')[0]) + parseInt(presc.reps.split('-')[1] || presc.reps.split('-')[0]);
    const avgRep = avgReps / 2;
    const perSet = +(avgRep * repDuration).toFixed(0);
    const perSession = +(perSet * presc.sets).toFixed(0);
    return { repDuration, perSet, perSession, eccentric: tempo.eccentric, bottomPause: tempo.bottomPause, concentric: tempo.concentric, topPause: tempo.topPause };
  }, [ex, presc, manualTempo, workWeight]);

  // RPE
  const rpeInfo = useMemo(() => {
    if (!presc) return null;
    const rpe = RIR_TO_RPE[presc.rir] ?? Math.max(1, 10 - presc.rir);
    const label = RPE_LABEL[rpe] || `${rpe}/10`;
    return { rpe, label };
  }, [presc]);

  // AMRAP
  const amrapEstimate = useMemo(() => {
    if (!oneRM || !workWeight || workWeight <= 0) return 0;
    const raw = Math.round(30 * (oneRM / workWeight - 1));
    return Math.max(0, raw);
  }, [oneRM, workWeight]);

  // Fatigue cost
  const fatigueScore = useMemo(() => {
    if (!ex || !presc) return 0;
    const baseCost = ex.fatigueCost || 5;
    const setFactor = Math.min(presc.sets / 3, 2);
    const compoundPenalty = ex.type === 'compound' ? 1.2 : 1;
    const deloadDiscount = isDeload ? 0.5 : 1;
    const out = +(baseCost * setFactor * compoundPenalty * deloadDiscount).toFixed(1);
    return out;
  }, [ex, presc, isDeload]);

  // 1RM projection
  const oneRMProjection = useMemo(() => {
    if (!oneRM || oneRM <= 0) return null;
    const weeklyRate = level === 'beginner' ? 2.5 : level === 'intermediate' ? 1.5 : 1;
    const progressionWeeks = Math.max(0, totalWeeks - week);
    const projected = +(oneRM + weeklyRate * progressionWeeks).toFixed(1);
    const pctGain = +((projected / oneRM - 1) * 100).toFixed(1);
    return { current: oneRM, projected, weeklyRate, pctGain, progressionWeeks };
  }, [oneRM, level, totalWeeks, week]);

  // Metabolic cost estimation
  const metabolicCost = useMemo(() => {
    if (!ex || !presc || !tutInfo || !workWeight) return null;
    const bodyWeight = profile?.settings?.weight ?? 80;
    const isCompound = ex.type === 'compound';
    const met = isCompound ? 6.0 : 3.5;
    const avgReps = (parseInt(presc.reps.split('-')[0]) + parseInt(presc.reps.split('-')[1] || presc.reps.split('-')[0])) / 2;
    const timePerSet = (avgReps * tutInfo.repDuration + 0.5) / 3600; // hours (0.5s transition)
    const totalTimeH = timePerSet * presc.sets;
    const caloriesPerSet = +(met * bodyWeight * timePerSet * 1.05).toFixed(1);
    const totalCalories = +(met * bodyWeight * totalTimeH * 1.05).toFixed(0);
    const glycogenPerSet = isCompound ? 1.5 : 0.8;
    const totalGlycogen = +(glycogenPerSet * presc.sets).toFixed(0);
    const epoc = +(totalCalories * 0.12).toFixed(0);
    const eff = isCompound ? 0.2 : 0.16;
    const mechanicalWork = +(avgReps * presc.sets * workWeight * (ex.group === 'legs' ? 0.5 : 0.35)).toFixed(0);
    return { totalCalories, caloriesPerSet, totalGlycogen, epoc, mechanicalWork, met, bodyWeight, eff, totalTimeH };
  }, [ex, presc, tutInfo, workWeight, profile]);

  // Superset/giant-set builder
  const supersetBuilder = useMemo(() => {
    if (!ex) return null;
    const fv = forceVector(ex.group, ex.type, ex.name);
    const antagonistVectors: Record<string, string[]> = {
      horizontal_push: ['horizontal_pull'],
      horizontal_pull: ['horizontal_push'],
      vertical_push: ['vertical_pull'],
      vertical_pull: ['vertical_push'],
      knee_dominant: ['hip_dominant'],
      hip_dominant: ['knee_dominant'],
      core_anti: [],
      other: [],
    };
    const pairs = antagonistVectors[fv] || [];
    if (pairs.length === 0) return null;
    const catalog = EXERCISE_CATALOG;
    const options: Array<{ name: string; pair: string; type: string; reason: string; scheme: string }> = [];
    const alreadySeen = new Set<string>();
    pairs.forEach(pv => {
      const candidates = catalog.filter(e => {
        const efv = forceVector(e.group, e.type, e.name);
        return efv === pv && e.group === ex.group && e.id !== ex.id;
      }).slice(0, 4);
      candidates.forEach(c => {
        if (alreadySeen.has(c.id)) return;
        alreadySeen.add(c.id);
        const label = pv === 'horizontal_pull' ? 'Горизонтальная тяга' :
          pv === 'horizontal_push' ? 'Горизонтальный жим' :
          pv === 'vertical_pull' ? 'Вертикальная тяга' :
          pv === 'vertical_push' ? 'Вертикальный жим' :
          pv === 'hip_dominant' ? 'Доминанта таза' : 'Доминанта коленей';
        options.push({
          name: c.name, pair: `${ex.name} + ${c.name}`, type: 'antagonist superset',
          reason: `${fv} → ${pv}. Противоположный вектор — 0 отдыха между, 90с после пары. Экономия времени + активное восстановление антигониста.`,
          scheme: '🔁 Чередование: подход A → 0с → подход B → 90с отдых. Повторить 3-4 раунда.',
        });
      });
    });
    // Giant set suggestion
    if (options.length >= 2) {
      const giantNames = options.map(o => o.name).slice(0, 3);
      options.push({
        name: giantNames.join(' + '), pair: giantNames.join(' + '), type: 'giant set (3 упражнения)',
        reason: '3 упражнения по кругу без отдыха. Максимальный метаболический стресс + экономия времени 50%.',
        scheme: '🔁 A → 0с → B → 0с → C → 120с отдых. 3-4 раунда. Только для продвинутых.',
      });
    }
    return options.length > 0 ? options : null;
  }, [ex]);

  // 1RM history trend from saved calculations
  const oneRMHistory = useMemo(() => {
    if (!ex || savedCalcs.length === 0) return null;
    const currentName = ex.name;
    const points = savedCalcs
      .filter(s => s.name === currentName && s.oneRM > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => ({ date: s.date, oneRM: s.oneRM }));
    if (points.length < 2) return null;
    return points;
  }, [ex, savedCalcs]);

  // Scheme alternatives
  const schemeAlts = useMemo(() => {
    if (!ex) return [];
    return getSchemeAlternatives(ex, goal, level, week, totalWeeks);
  }, [ex, goal, level, week, totalWeeks]);

  // Technique suggestion
  const techniqueSuggestion = useMemo(() => {
    if (!ex) return null;
    try {
      return assignIntensityTechnique(ex, goal, level, week % 3, week);
    } catch { return null; }
  }, [ex, goal, level, week]);

  const schemesWithWeight = useMemo(() => schemeAlts.map(s => {
    const rep = parseInt(s.reps.split('-')[0]) || 5;
    const p = 100 / (1 + rep / 30);
    const w = +(oneRM * p / 100).toFixed(1);
    return { ...s, weight: w, pct: Math.round(p) };
  }), [schemeAlts, oneRM]);

  const weakPointAdvice = useMemo(() => {
    if (!ex || !presc) return null;
    const muscle = ex.group;
    const volRef = getVolumeByMuscle(muscle);
    if (!volRef) return null;
    const levelData = (volRef as any)[level];
    if (!levelData) return null;
    const { mev, mav, mrv } = levelData as { mev: number; mav: number; mrv: number; frequency: string };
    const prescribedSets = presc.sets;
    const pct = prescribedSets > 0 && mav > 0 ? Math.round(prescribedSets / mav * 100) : 0;
    let advice = '';
    let color = '#22c55e';
    if (prescribedSets >= mrv + 2) { advice = `Объём ${prescribedSets} подходов > MRV (${mrv}). Высокий риск перетрена. Снизьте!`; color = '#ef4444'; }
    else if (prescribedSets > mrv) { advice = `Объём ${prescribedSets} подходов на MRV (${mrv}). Рекомендуется не превышать.`; color = '#f59e0b'; }
    else if (prescribedSets >= mav) { advice = `Объём ${prescribedSets} подходов: MEV ${mev} → MAV ${mav} ✓ Оптимальный диапазон.`; color = '#22c55e'; }
    else if (prescribedSets >= mev) { advice = `Объём ${prescribedSets} подходов: MEV ${mev} достигнут, но ниже MAV (${mav}). Можно добавить.`; color = '#60a5fa'; }
    else { advice = `Объём ${prescribedSets} подходов < MEV (${mev}). Добавьте до ${mev} подходов для роста.`; color = '#ef4444'; }
    return { advice, color, mev, mav, mrv, prescribedSets, pct };
  }, [ex, presc, level]);

  // Warm-up ramp
  const warmupRamp = useMemo(() => {
    if (!ex || !presc || !workWeight || workWeight <= 0) return null;
    const phaseRu: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', peaking: 'Пик', peak: 'Пик', deload: 'Делоад' };
    const steps: Array<{ pct: number; weight: number; reps: number; label: string }> = [];
    const w = workWeight;
    let pcts: number[];
    if (isDeload) {
      pcts = [0.3, 0.4, 0.5];
    } else if (w >= 150) {
      pcts = [0.3, 0.4, 0.5, 0.6, 0.7];
    } else if (w >= 80) {
      pcts = [0.35, 0.45, 0.55, 0.65];
    } else {
      pcts = [0.4, 0.55, 0.7];
    }
    pcts.forEach((pct, i) => {
      const wStep = +(w * pct).toFixed(1);
      const reps = isDeload ? 5 : Math.max(2, Math.round(pcts.length - i + 2));
      steps.push({ pct: Math.round(pct * 100), weight: wStep, reps, label: i === 0 ? 'Разминка (пустой гриф/лёгкий)' : i === pcts.length - 1 ? 'Подход-разминка' : 'Разминочный' });
    });
    return { steps, w, phase: phaseRu[phase] || phase };
  }, [ex, presc, workWeight, phase, isDeload]);

  // Frequency recommendation
  const freqRecommendation = useMemo(() => {
    if (!ex) return null;
    const g = ex.group;
    const levelFreq: Record<string, Record<string, [number, number]>> = {
      chest: { beginner: [2, 3], intermediate: [1.5, 2.5], advanced: [1, 2] },
      back: { beginner: [2, 3], intermediate: [1.5, 2.5], advanced: [1, 2] },
      legs: { beginner: [2, 2], intermediate: [1.5, 2], advanced: [1, 2] },
      shoulders: { beginner: [2, 3], intermediate: [2, 3], advanced: [2, 3] },
      arms: { beginner: [2, 3], intermediate: [2, 3], advanced: [2, 3] },
      core: { beginner: [3, 4], intermediate: [2, 3], advanced: [2, 3] },
    };
    const range = levelFreq[g]?.[level] ?? [2, 3];
    const goalAdj = goal === 'endurance' ? 0.5 : goal === 'power' ? -0.5 : 0;
    const min = Math.max(1, range[0] + goalAdj);
    const max = Math.max(min + 0.5, range[1] + goalAdj);
    const label = min >= 2 ? `${min.toFixed(0)}-${max.toFixed(0)}×/нед` : min < 1 ? `1×/нед (или 1 раз в 10 дн)` : `${min.toFixed(0)}-${max.toFixed(0)}×/нед`;
    return { min, max, label, group: g, globalFreq: min >= 2.5 ? 'PPL / upper-lower' : min >= 2 ? 'upper-lower / fullbody' : 'fullbody / bro-split' };
  }, [ex, level, goal]);

  // BFR suitability
  const bfrSuitability = useMemo(() => {
    if (!ex) return null;
    const isIsolation = ex.type === 'isolation';
    const lowJointStress = (ex.jointStress ?? 'medium') === 'low';
    const upperExtremity = ['chest', 'shoulders', 'arms', 'back'].includes(ex.group);
    const suitable = isIsolation && (lowJointStress || upperExtremity);
    const score = suitable ? 8 : 4;
    return { suitable, score, note: suitable ? 'Подходит для BFR-тренинга (изоляция + периферия). Используйте на 4-й неделе mesocycle для метаболического стресса без осевой нагрузки.' : 'Не рекомендован для BFR (базовое движение с высокой нагрузкой на ЦНС/суставы).' };
  }, [ex]);

  // Resistance profile (force curve)
  const resistanceProfile = useMemo(() => {
    if (!ex) return null;
    return getResistanceProfile(ex);
  }, [ex]);

  // Difficulty scaler (regressions / progressions)
  const difficultyScaler = useMemo(() => {
    if (!ex) return null;
    return getDifficultyScaler(ex);
  }, [ex]);

  // CNS vs muscular fatigue analysis
  const fatigueAnalysis = useMemo(() => {
    if (!ex || !presc) return null;
    return getFatigueAnalysis(ex, presc, isDeload, phase);
  }, [ex, presc, isDeload, phase]);

  // Weekly auto-progression (4-week mini-plan)
  const autoProgression = useMemo(() => {
    if (!ex || !presc || !workWeight) return null;
    const weeks: Array<{ w: number; sets: number; reps: string; rir: number; rest: number; weight: number; pct: number }> = [];
    for (let i = 0; i < 4; i++) {
      const w = Math.min(week + i, totalWeeks);
      try {
        const p = calcExercisePrescription(ex, goal, level, weakToggle, false, 1, w, totalWeeks);
        const r = parseInt(p.reps) || 5;
        const pc = 100 / (1 + r / 30);
        const wgt = +(oneRM * pc / 100).toFixed(1);
        weeks.push({ w, sets: p.sets, reps: p.reps, rir: p.rir, rest: p.rest, weight: wgt, pct: Math.round(pc) });
      } catch {
        weeks.push({ w, sets: presc.sets, reps: presc.reps, rir: presc.rir + 1, rest: presc.rest, weight: workWeight, pct });
      }
    }
    return weeks;
  }, [ex, presc, workWeight, goal, level, weakToggle, week, totalWeeks, oneRM, pct]);

  // Exercise ranking within group for this goal
  const exerciseRanking = useMemo(() => {
    if (!ex) return null;
    const groupExs = EXERCISE_CATALOG.filter(e => e.group === ex.group && e.id !== ex.id).slice(0, 15);
    const scored = groupExs.map(e => {
      try {
        const p = calcExercisePrescription(e, goal, level, false, false, 1, week, totalWeeks);
        const repsN = parseInt(p.reps) || 5;
        const pctN = 100 / (1 + repsN / 30);
        const wgt = +(oneRM * pctN / 100).toFixed(1);
        const vol = p.sets * repsN * wgt;
        const rp = getResistanceProfile(e);
        const goalBonus = goal === 'hypertrophy' && rp.curve === 'stretch_mediated' ? 3 :
                          goal === 'strength' && rp.curve === 'mid_range' ? 3 :
                          goal === 'power' && e.type === 'compound' ? 2 : 0;
        const typeBonus = goal === 'hypertrophy' ? 0 : e.type === 'compound' ? 2 : 0;
        const score = Math.min(100, Math.round(rp.score * 7 + goalBonus * 3 + typeBonus * 2 + Math.min(vol / 1000, 15)));
        return { id: e.id, name: e.name, score, type: e.type, curve: rp.label, rpScore: rp.score, vol: Math.round(vol / 1000) };
      } catch { return null; }
    }).filter((s): s is NonNullable<typeof s> => s !== null).sort((a, b) => b.score - a.score).slice(0, 10);
    const currentRp = resistanceProfile;
    const currentScore = currentRp ? Math.min(100, Math.round(currentRp.score * 7 + (goal === 'hypertrophy' && currentRp.curve === 'stretch_mediated' ? 9 : 0) + (goal === 'strength' && currentRp.curve === 'mid_range' ? 9 : 0) + Math.min((volumeLoad || 0) / 1000, 15))) : 50;
    const rank = scored.findIndex(s => s.score < currentScore);
    const position = rank === -1 ? scored.length + 1 : rank + 1;
    return { list: scored, currentScore, currentRank: position, total: scored.length + 1 };
  }, [ex, goal, level, week, totalWeeks, oneRM, resistanceProfile, volumeLoad]);

  // Pre-exhaust / post-exhaust pairing
  const prePostPairing = useMemo(() => {
    if (!ex) return null;
    const groupExs = EXERCISE_CATALOG.filter(e => e.group === ex.group && e.id !== ex.id);
    const fv = forceVector(ex.group, ex.type, ex.name);
    const sameVector = groupExs.filter(e => forceVector(e.group, e.type, e.name) === fv && e.type !== ex.type).slice(0, 3);
    const diffVector = groupExs.filter(e => forceVector(e.group, e.type, e.name) !== fv).slice(0, 3);
    const result: Array<{ name: string; role: 'pre_exhaust' | 'post_exhaust' | 'agonist'; type: string; reason: string }> = [];
    // Pre-exhaust: isolation before compound
    if (ex.type === 'compound') {
      const iso = sameVector.filter(e => e.type === 'isolation').slice(0, 2);
      iso.forEach(e => result.push({
        name: e.name, role: 'pre_exhaust', type: 'pre-exhaust (изоляция → база)',
        reason: `Сделайте ${e.name} ПЕРЕД ${ex.name}. ${e.fatigueCost <= 3 ? 'Лёгкая изоляция для предварительного утомления целевой мышцы. После неё базовое движение сильнее загрузит целевые волокна.' : 'Изоляционное движение перед базой — усиление нейромышечной связи и метаболический стресс.'}`,
      }));
    }
    // Post-exhaust: isolation after compound
    if (ex.type === 'compound' || ex.fatigueCost >= 6) {
      const isoEnd = sameVector.filter(e => e.type === 'isolation').slice(0, 2);
      isoEnd.forEach(e => {
        if (!result.some(r => r.name === e.name)) result.push({
          name: e.name, role: 'post_exhaust', type: 'post-exhaust (база → изоляция)',
          reason: `Сделайте ${ex.name} → ${e.name}. После базового движения добиваете целевую мышцу изоляцией, исчерпывая оставшиеся двигательные единицы. Идеально для гипертрофии.`,
        });
      });
    }
    // Agonist compound pair (same force vector, alternating)
    const altCompound = diffVector.filter(e => e.type === 'compound').slice(0, 2);
    altCompound.forEach(e => result.push({
      name: e.name, role: 'agonist', type: 'агонистическая пара',
      reason: `${ex.name} + ${e.name}: разные векторы силы в одной тренировке. Полный охват группы без перекрёстного утомления.`,
    }));
    return result.length > 0 ? result.slice(0, 4) : null;
  }, [ex]);

  const handleSubstituteButton = () => {
    if (!ex) { alert('Сначала выберите упражнение'); return; }
    const subs = getSubstitutesFor(ex.id);
    if (subs.length === 0) { alert('Замены для данного упражнения не найдены'); return; }
    setSubstituteList(subs);
    setShowSubstitutes(true);
  };

  const getSubstitutesFor = (exerciseId: string) => {
    const target = getExerciseById(exerciseId);
    if (!target) return [];
    const sub = getSubstitutes(exerciseId);
    if (!sub) return [];
    return sub.substitutes.filter(s => canReplace(exerciseId, s.id)).map(s => ({ id: s.id, name: getExerciseById(s.id)?.name ?? s.id, reason: s.reason }));
  };

  // Helpers
  const exportText = () => {
    if (!ex || !presc) return;
    const lines: string[] = [];
    lines.push('=== Калькулятор упражнений — Отчёт ===');
    lines.push(`Дата: ${new Date().toLocaleDateString('ru-RU')}`);
    lines.push(`Упражнение: ${ex.name} (${GROUP_RU[ex.group] ?? ex.group}) · Тип: ${ex.type === 'compound' ? 'Базовое' : 'Изолированное'}`);
    lines.push(`Цель: ${goal} · Уровень: ${level} · Фаза: ${phase}${isDeload ? ' (ДЕЛОАД)' : ''} · Неделя ${week}/${totalWeeks}`);
    lines.push(`1ПМ: ${oneRM} кг`);
    lines.push(`Вес: ${workWeight} кг (${pct}% 1ПМ) · Повт: ${presc.reps} · Сеты: ${presc.sets} · RIR: ${presc.rir} · RPE: ${rpeInfo?.rpe ?? '—'}/10 · Отдых: ${presc.rest} с`);
    if (presc.tempo) lines.push(`Темп: ${manualTempo || presc.tempo} | TUT: ${tutInfo ? `${tutInfo.perSession}с за тренировку` : '—'}`);
    lines.push(`Объёмная нагрузка: ${volumeLoad.toLocaleString('ru-RU')} кг (сеты × повт × вес)`);
    lines.push(`Утомление сессии: ${fatigueScore}/20 · AMRAP на этом весе: ~${amrapEstimate} повт`);
    if (weakPointAdvice) lines.push(`Объём: ${weakPointAdvice.advice}`);
    if (oneRMProjection) lines.push(`Прогноз 1ПМ: через ${oneRMProjection.progressionWeeks} нед — ~${oneRMProjection.projected} кг (+${oneRMProjection.pctGain}%)`);
    if (schemeAlts.length > 0) {
      lines.push(''); lines.push('— Альтернативные схемы —');
      schemeAlts.forEach(s => lines.push(`  ${s.name}: ${s.sets}×${s.reps} · RIR ${s.rir} · ${s.desc}`));
    }
    if (warmupRamp) {
      lines.push(''); lines.push('— Разминочная рампа —');
      warmupRamp.steps.forEach(s => lines.push(`  ${s.label}: ${s.weight} кг (${s.pct}%) · ${s.reps} повт`));
    }
    if (freqRecommendation) lines.push(`Частота: ${freqRecommendation.label} · Сплит: ${freqRecommendation.globalFreq}`);
    if (bfrSuitability) lines.push(`BFR: ${bfrSuitability.suitable ? '✅ Подходит' : '❌ Не подходит'} · ${bfrSuitability.note}`);
    if (metabolicCost) lines.push(`Метаболизм: ${metabolicCost.totalCalories} ккал/сессия · гликоген ${metabolicCost.totalGlycogen}г · EPOC +${metabolicCost.epoc} ккал`);
    if (supersetBuilder && supersetBuilder.length > 0) {
      lines.push(''); lines.push('— Суперсеты —');
      supersetBuilder.slice(0, 2).forEach(s => lines.push(`  ${s.pair} [${s.type}]: ${s.reason.slice(0, 60)}`));
    }
    if (oneRMHistory && oneRMHistory.length >= 2) {
      lines.push(''); lines.push('— Тренд 1ПМ —');
      oneRMHistory.forEach(p => lines.push(`  ${p.date}: ${p.oneRM} кг`));
    }
    if (resistanceProfile) {
      lines.push(''); lines.push('— Профиль сопротивления —');
      lines.push(`  Силовая кривая: ${resistanceProfile.label} (${resistanceProfile.score}/10)`);
      lines.push(`  Лучшая цель: ${resistanceProfile.bestGoal} · Стиль повторов: ${resistanceProfile.repStyle}`);
    }
    if (difficultyScaler && difficultyScaler.length > 0) {
      lines.push(''); lines.push('— Шкала сложности —');
      difficultyScaler.forEach(d => lines.push(`  ${d.diff === 'easier' ? '⬇' : '⬆'} ${d.name}: ${d.how}`));
    }
    if (fatigueAnalysis) {
      lines.push(''); lines.push('— Утомление —');
      lines.push(`  ЦНС ${fatigueAnalysis.cnsLoad}/10 · Мышцы ${fatigueAnalysis.muscularLoad}/10 · Восстановление ${fatigueAnalysis.recoveryHours}ч`);
    }
    if (exerciseRanking) {
      lines.push(''); lines.push('— Рейтинг в группе —');
      lines.push(`  Место #${exerciseRanking.currentRank} из ${exerciseRanking.total}`);
      exerciseRanking.list.slice(0, 5).forEach((item, i) => lines.push(`  #${i + 1} ${item.name} (${item.score} pts) · ${item.type} · ${item.curve}`));
    }
    if (autoProgression) {
      lines.push(''); lines.push('— Прогрессия 4 нед —');
      autoProgression.forEach(w => lines.push(`  Нед ${w.w}: ${w.sets}×${w.reps} · ${w.weight} кг · RIR ${w.rir}`));
    }
    if (prePostPairing) {
      lines.push(''); lines.push('— Pre/Post Exhaust —');
      prePostPairing.slice(0, 3).forEach(p => lines.push(`  ${p.role === 'pre_exhaust' ? 'ДО' : p.role === 'post_exhaust' ? 'ПОСЛЕ' : 'В ПАРЕ'}: ${p.name} — ${p.reason.slice(0, 50)}`));
    }
    lines.push(''); lines.push('— PRO-анализ —');
    lines.push(`Force-вектор: ${forceVector(ex.group, ex.type, ex.name)} · Joint-stress: ${ex.jointStress}`);
    if (techniqueSuggestion) lines.push(`Техника: ${techniqueSuggestion.technique}`);
    const text = lines.join('\n');
    navigator.clipboard?.writeText(text).then(() => { /* ok */ }).catch(() => { /* ignore */ });
  };

  // ─── RENDER ───

  const renderExerciseCard = (exercise: Exercise, label: string) => {
    const p = (() => { try { return calcExercisePrescription(exercise, goal, level, weakToggle, false, 1, week, totalWeeks); } catch { return null; } })();
    if (!p) return null;
    const r = parseInt(p.reps) || 5;
    const pc = 100 / (1 + r / 30);
    const w = +(oneRM * pc / 100).toFixed(1);
    return (
      <div style={{ ...CARD, flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700, marginBottom: 4 }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{exercise.name}</div>
        <div style={{ ...SMALL, marginTop: 4 }}>
          {p.sets}×{p.reps} · RIR {p.rir} · RPE {RIR_TO_RPE[p.rir] ?? '—'}· {w} кг ({pc}%)
        </div>
        <div style={{ ...SMALL }}>Отдых {p.rest}с · {exercise.equipment}</div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>
        📦 Калькулятор упражнений
      </div>

      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
        <div>
          <PopupSelect label="Группа мышц" value={group} options={GROUPS.map(g => ({ id: g, label: GROUP_RU[g], desc: '' }))} hint="Группа" onChange={v => { setGroup(v); setExId(''); }} />
        </div>
        {group !== 'all' && REGION_MAP[group] && (
          <div>
            <PopupSelect label="Регион" value={region} options={REGION_MAP[group].map(r => ({ id: r.id, label: r.label, desc: r.desc }))} hint="Регион мышцы" onChange={v => setRegion(v)} />
          </div>
        )}
        <div>
          <PopupSelect label="Упражнение" value={exId} options={exList.map(e => ({ id: e.id, label: e.name, desc: `${e.group} · ${e.type === 'compound' ? 'Базовое' : 'Изол.'}`}))} hint="Поиск" onChange={v => setExId(v)} />
        </div>
        <div>
          <PopupSelect label="Цель" value={goal} options={[
            { id: 'strength', label: 'Сила', desc: '3-5 повторений' },
            { id: 'hypertrophy', label: 'Гипертрофия', desc: '8-12 повторений' },
            { id: 'endurance', label: 'Выносливость', desc: '15-20+ повт' },
            { id: 'power', label: 'Взрывная сила', desc: '2-3 повторения' },
            { id: 'bulk', label: 'Масса', desc: '6-10 повторений' },
            { id: 'cut', label: 'Рельеф', desc: '10-15 повторений' },
          ]} hint="Выберите цель" onChange={v => setGoal(v)} />
        </div>
        <div>
          <PopupNumber label="Неделя" value={week} min={1} max={52} step={1} onChange={v => setWeek(v)} />
        </div>
        <div>
          <PopupNumber label="Всего недель" value={totalWeeks} min={1} max={52} step={1} onChange={v => setTotalWeeks(v)} />
        </div>
        <div>
          <PopupNumber label="1RM (кг)" value={oneRM} min={0} max={500} step={0.5} onChange={v => setOneRM(v)} />
        </div>
        <div>
          <PopupText label="Темп (опц.)" value={manualTempo} placeholder="напр. 3-1-1-0" hint="ECC-BOT-CON-TOP" onChange={(v: string) => setManualTempo(v)} />
        </div>
        <div>
          <PopupSelect label="Уровень" value={level} options={[
            { id: 'beginner', label: 'Новичок' },
            { id: 'intermediate', label: 'Средний' },
            { id: 'advanced', label: 'Продвинутый' },
          ]} onChange={v => setLevel(v as 'beginner' | 'intermediate' | 'advanced')} />
        </div>
      </div>

      {/* Weak point + compare toggles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setWeakToggle(v => !v)}
          style={{ padding: '6px 12px', borderRadius: 6, border: weakToggle ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.15)', background: weakToggle ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.04)', color: weakToggle ? ACCENT : 'var(--text-dim)', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>
          🎯 Слабая группа {weakToggle ? '(вкл)' : '(выкл)'}
        </button>
        <button onClick={() => setCompareMode(v => !v)}
          style={{ padding: '6px 12px', borderRadius: 6, border: compareMode ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.15)', background: compareMode ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.04)', color: compareMode ? ACCENT : 'var(--text-dim)', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>
          ⚖ Сравнить {compareMode ? '(вкл)' : '(выкл)'}
        </button>
        {isDeload && <span style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 11, fontWeight: 700 }}>⚠ ДЕЛОАД (фаза {phase})</span>}
      </div>

      {/* Comparison mode: second exercise selector */}
      {compareMode && (
        <div style={{ marginBottom: 12 }}>
          <PopupSelect label="Упражнение для сравнения" value={exId2} options={exList.map(e => ({ id: e.id, label: e.name, desc: `${e.group} · ${e.type === 'compound' ? 'Базовое' : 'Изол.'}`}))} hint="Выберите второе" onChange={v => setExId2(v)} />
        </div>
      )}

      {!ex ? (
        <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Выберите упражнение выше.</div>
      ) : (
        <>
          {/* Main metric grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6, marginTop: 8 }}>
            <MetricCard title="Вес" icon="🔸" accent={ACCENT}>
              <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{workWeight}</div>
              <div style={{ ...SMALL }}>кг ({pct}% 1ПМ)</div>
            </MetricCard>
            <MetricCard title="Повторения" icon="🔸" accent={ACCENT}>
              <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.reps ?? '-'}</div>
              <div style={{ ...SMALL }}>диапазон</div>
            </MetricCard>
            <MetricCard title="Подходы" icon="🔚" accent={ACCENT}>
              <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.sets ?? '-'}</div>
              <div style={{ ...SMALL }}>рабочих</div>
            </MetricCard>
            <MetricCard title="RIR" icon="🔸" accent={ACCENT}>
              <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.rir ?? '-'}</div>
              <div style={{ ...SMALL }}>повт в запасе</div>
            </MetricCard>
            <MetricCard title="RPE" icon="🔸" accent={ACCENT}>
              <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{rpeInfo?.rpe ?? '-'}/10</div>
              <div style={{ ...SMALL }}>{rpeInfo?.label ?? '—'}</div>
            </MetricCard>
            <MetricCard title="Отдых" icon="⏱" accent={ACCENT}>
              <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.rest ?? '-'}</div>
              <div style={{ ...SMALL }}>сек</div>
            </MetricCard>
            <MetricCard title="Объём" icon="📊" accent="#60a5fa">
              <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{(volumeLoad / 1000).toFixed(1)}k</div>
              <div style={{ ...SMALL }}>кг (с×п×в)</div>
            </MetricCard>
            <MetricCard title="Утомление" icon="⚡" accent="#f59e0b">
              <div style={{ fontSize: 18, fontWeight: 800, color: fatigueScore > 12 ? '#ef4444' : fatigueScore > 8 ? '#f59e0b' : '#22c55e' }}>{fatigueScore}</div>
              <div style={{ ...SMALL }}>из 20</div>
            </MetricCard>
          </div>
          {presc?.dropSet && <div style={{ ...SMALL, marginTop: 4 }}>🔻 Дроп-сет: {presc?.dropSetReps}</div>}
          {presc?.backoffSet && <div style={{ ...SMALL }}>↩️ Backoff-сет (доборный подход после основного)</div>}
          {presc?.progressionNote && <div style={{ ...SMALL }}>{presc.progressionNote}</div>}

          {/* Tempo / TUT info */}
          {tutInfo && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(96,165,250,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>⏱ TUT (Время под нагрузкой)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6 }}>
                <div><span style={{ ...SMALL }}>Темп</span><div style={{ fontSize: 13, fontWeight: 700 }}>{manualTempo || presc?.tempo || '—'}</div></div>
                <div><span style={{ ...SMALL }}>Повторение</span><div style={{ fontSize: 13, fontWeight: 700 }}>{tutInfo.repDuration}с</div></div>
                <div><span style={{ ...SMALL }}>Подход</span><div style={{ fontSize: 13, fontWeight: 700 }}>{tutInfo.perSet}с</div></div>
                <div><span style={{ ...SMALL }}>Сессия</span><div style={{ fontSize: 13, fontWeight: 700 }}>{tutInfo.perSession}с</div></div>
              </div>
              <div style={{ ...SMALL, marginTop: 4, fontSize: 10 }}>
                Эксцентрика: {tutInfo.eccentric}с · Пауза внизу: {tutInfo.bottomPause}с · Концентрика: {tutInfo.concentric}с · Пауза вверху: {tutInfo.topPause}с
              </div>
            </div>
          )}

          {/* AMRAP */}
          {amrapEstimate > 0 && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(168,85,247,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>🔄 AMRAP (макс. повторений)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#a855f7' }}>~{amrapEstimate}</div>
              <div style={{ ...SMALL }}>повторений при {workWeight} кг (расчёт по формуле Эпли) · Рабочие: {presc?.reps ?? '—'} · {presc ? `запас ${amrapEstimate - (parseInt(presc.reps.split('-')[1] || presc.reps.split('-')[0]))} повт` : ''}</div>
            </div>
          )}

          {/* Metabolic cost */}
          {metabolicCost && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(251,146,60,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', marginBottom: 4 }}>⚡ Метаболическая стоимость упражнения</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6 }}>
                <div><span style={{ ...SMALL }}>Калорий за подход</span><div style={{ fontSize: 16, fontWeight: 700 }}>{metabolicCost.caloriesPerSet}</div></div>
                <div><span style={{ ...SMALL }}>Всего за сессию</span><div style={{ fontSize: 16, fontWeight: 700, color: '#fb923c' }}>~{metabolicCost.totalCalories}</div></div>
                <div><span style={{ ...SMALL }}>Гликоген (г)</span><div style={{ fontSize: 16, fontWeight: 700 }}>~{metabolicCost.totalGlycogen}</div></div>
                <div><span style={{ ...SMALL }}>EPOC (доп. ккал)</span><div style={{ fontSize: 16, fontWeight: 700 }}>+{metabolicCost.epoc}</div></div>
                <div><span style={{ ...SMALL }}>Механич. работа (Дж)</span><div style={{ fontSize: 16, fontWeight: 700 }}>{metabolicCost.mechanicalWork}</div></div>
              </div>
              <div style={{ ...SMALL, fontSize: 10, marginTop: 3 }}>
                MET: {metabolicCost.met} · Вес: {metabolicCost.bodyWeight} кг · Время: {(metabolicCost.totalTimeH * 60).toFixed(0)} мин · MET-формула: ккал = MET × кг × часы × 1.05
              </div>
            </div>
          )}

          {/* Resistance Profile / Force Curve */}
          {resistanceProfile && (
            <div style={{ ...CARD, marginTop: 10, border: `1px solid ${resistanceProfile.curve === 'stretch_mediated' ? 'rgba(34,197,94,0.3)' : resistanceProfile.curve === 'mid_range' ? 'rgba(96,165,250,0.3)' : 'rgba(245,158,11,0.3)'}`, background: resistanceProfile.curve === 'stretch_mediated' ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: resistanceProfile.curve === 'stretch_mediated' ? '#22c55e' : resistanceProfile.curve === 'mid_range' ? '#60a5fa' : '#f59e0b', marginBottom: 4 }}>
                📐 Профиль сопротивления (силовая кривая)
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: resistanceProfile.curve === 'stretch_mediated' ? '#22c55e' : resistanceProfile.curve === 'mid_range' ? '#60a5fa' : '#f59e0b' }}>
                  {resistanceProfile.score}/10
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{resistanceProfile.label}</div>
                  <div style={{ ...SMALL, fontSize: 10, marginTop: 2 }}>Лучшая цель: {resistanceProfile.bestGoal === 'hypertrophy' ? 'Гипертрофия' : resistanceProfile.bestGoal === 'strength' ? 'Сила' : 'Насос/пампинг'}</div>
                </div>
              </div>
              <div style={{ ...SMALL, fontSize: 10, marginTop: 6, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)' }}>
                {resistanceProfile.desc}
              </div>
              <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(0,0,0,0.12)', borderRadius: 4, borderLeft: `3px solid ${resistanceProfile.curve === 'stretch_mediated' ? '#22c55e' : resistanceProfile.curve === 'mid_range' ? '#60a5fa' : '#f59e0b'}` }}>
                <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>🎯 Стиль повторений</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>{resistanceProfile.repStyle}</div>
              </div>
              {/* Mini SVG curve visualization */}
              <div style={{ marginTop: 6 }}>
                <svg width="100%" height={24} viewBox="0 0 200 24" style={{ overflow: 'visible' }}>
                  {resistanceProfile.curve === 'stretch_mediated' && (
                    <path d="M 0,22 Q 50,22 100,4 Q 150,22 200,22" fill="none" stroke="#22c55e" strokeWidth={2} opacity={0.7} />
                  )}
                  {resistanceProfile.curve === 'mid_range' && (
                    <path d="M 0,4 Q 50,4 100,22 Q 150,4 200,4" fill="none" stroke="#60a5fa" strokeWidth={2} opacity={0.7} />
                  )}
                  {resistanceProfile.curve === 'peak_contraction' && (
                    <path d="M 0,22 Q 50,22 100,22 Q 150,22 200,4" fill="none" stroke="#f59e0b" strokeWidth={2} opacity={0.7} />
                  )}
                  <line x1={0} y1={22} x2={200} y2={22} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                  <text x={0} y={12} fill="rgba(255,255,255,0.15)" fontSize={5}>РАСТЯНУТА</text>
                  <text x={75} y={12} fill="rgba(255,255,255,0.15)" fontSize={5}>СЕРЕДИНА</text>
                  <text x={155} y={12} fill="rgba(255,255,255,0.15)" fontSize={5}>СОКРАЩЕНА</text>
                </svg>
              </div>
            </div>
          )}

          {/* 1RM projection */}
          {oneRMProjection && oneRMProjection.progressionWeeks > 0 && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>📈 Прогноз 1ПМ (конец мезоцикла)</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{oneRMProjection.projected} кг</div>
                  <div style={{ ...SMALL }}>прогноз через {oneRMProjection.progressionWeeks} нед</div>
                </div>
                <div style={{ ...SMALL }}>
                  Текущий 1ПМ: {oneRMProjection.current} кг · +{oneRMProjection.weeklyRate} кг/нед · +{oneRMProjection.pctGain}%
                </div>
              </div>
            </div>
          )}

          {/* Difficulty Scaler (regression / progression) */}
          {difficultyScaler && difficultyScaler.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(168,85,247,0.04)', borderRadius: 8, border: '1px solid rgba(168,85,247,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>📊 Шкала сложности упражнения</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {difficultyScaler.map((d, i) => (
                  <div key={i} style={{ padding: '8px 10px', borderRadius: 6, background: d.diff === 'easier' ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${d.diff === 'easier' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`, borderLeft: `3px solid ${d.diff === 'easier' ? '#22c55e' : '#f59e0b'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{d.name}</span>
                      <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: d.diff === 'easier' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: d.diff === 'easier' ? '#22c55e' : '#f59e0b' }}>
                        {d.diff === 'easier' ? '⬇ Упрощение' : '⬆ Усложнение'}
                      </span>
                    </div>
                    <div style={{ ...SMALL, fontSize: 10, marginTop: 2 }}>{d.how}</div>
                    <div style={{ ...SMALL, fontSize: 10, marginTop: 1, color: d.diff === 'easier' ? 'rgba(34,197,94,0.7)' : 'rgba(245,158,11,0.7)' }}>{d.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alternative schemes */}
          {schemesWithWeight.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>📋 Альтернативные схемы ({goal === 'strength' ? 'Сила' : goal === 'hypertrophy' ? 'Гипертрофия' : goal})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                {schemesWithWeight.map((s, i) => (
                  <div key={i} style={{ ...CARD, border: `1px solid ${i === 1 ? 'rgba(0,230,138,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>{s.name}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, margin: '4px 0' }}>{s.sets}×{s.reps}</div>
                    <div style={{ ...SMALL, fontSize: 10 }}>
                      RIR {s.rir} · RPE {RIR_TO_RPE[s.rir] ?? '—'}· {s.weight} кг ({s.pct}%) · отдых {s.rest}с
                    </div>
                    <div style={{ ...SMALL, fontSize: 10 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparison */}
          {compareMode && ex2 && (
            <div style={{ marginTop: 12, padding: 10, background: 'rgba(0,230,138,0.04)', borderRadius: 8, border: '1px solid rgba(0,230,138,0.2)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>⚖ Сравнение упражнений</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {renderExerciseCard(ex, 'Основное')}
                {renderExerciseCard(ex2, 'Сравнение')}
              </div>
              <div style={{ ...SMALL, marginTop: 4, fontSize: 10 }}>
                {ex.type === 'compound' && ex2.type === 'isolation' ? '👉 Основное — базовое, сравнение — изолированное. Комбинируйте для максимального эффекта.' :
                 ex.type === ex2.type ? '👉 Оба упражнения одного типа. Выбирайте по биомеханике, оборудованию и ощущениям.' :
                 '👉 Разные типы. Базовое даёт общую стимуляцию, изолированное — целевую мышцу.'}
              </div>
            </div>
          )}

          {/* Exercise Ranking within Group */}
          {exerciseRanking && exerciseRanking.list.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(59,130,246,0.04)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>
                🏅 Рейтинг упражнений для {GROUP_RU[ex.group] || ex.group} (цель: {goal === 'hypertrophy' ? 'гипертрофия' : goal === 'strength' ? 'сила' : goal})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: exerciseRanking.currentRank <= 3 ? '#22c55e' : exerciseRanking.currentRank <= 6 ? '#f59e0b' : '#ef4444' }}>
                  #{exerciseRanking.currentRank}
                </div>
                <div style={{ ...SMALL, fontSize: 10 }}>
                  из {exerciseRanking.total} · Ваше упражнение на {exerciseRanking.currentRank === 1 ? '1-м' : exerciseRanking.currentRank === 2 ? '2-м' : exerciseRanking.currentRank === 3 ? '3-м' : `${exerciseRanking.currentRank}-м`} месте по эффективности для данной цели
                </div>
              </div>
              <div style={{ display: 'grid', gap: 3, marginTop: 4 }}>
                {exerciseRanking.list.slice(0, 8).map((item, i) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: 4, background: i < exerciseRanking.currentRank - 1 ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.02)', borderLeft: i < exerciseRanking.currentRank - 1 ? '2px solid rgba(59,130,246,0.3)' : '2px solid transparent' }}>
                    <div style={{ fontSize: 10 }}>
                      <span style={{ fontWeight: 700 }}>#{i + 1}</span> {item.name}
                      <span style={{ ...SMALL, fontSize: 10, marginLeft: 4 }}>{item.type === 'compound' ? 'база' : 'изол'} · {item.curve.slice(0, 12)}</span>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: item.score >= 70 ? '#22c55e' : item.score >= 50 ? '#f59e0b' : '#ef4444' }}>
                      {item.score}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ ...SMALL, fontSize: 10, marginTop: 4 }}>
                Рейтинг основан на профиле сопротивления, соответствии цели и объёмной нагрузке. Упражнения с растягивающим профилем (stretch-mediated) получают бонус для гипертрофии.
              </div>
            </div>
          )}

          {/* Weekly progression chart */}
          {ex && (() => {
            const weeks: number[] = [];
            for (let w = 1; w <= totalWeeks; w++) weeks.push(w);
            const projections = weeks.map(w => {
              try {
                const p = calcExercisePrescription(ex, goal, level, weakToggle, false, 1, w, totalWeeks);
                const repsN = parseInt(p.reps) || 5;
                const pctN = 100 / (1 + repsN / 30);
                const weight = +(oneRM * pctN / 100).toFixed(1);
                const avgReps = (parseInt(p.reps.split('-')[0]) + parseInt(p.reps.split('-')[1] || p.reps.split('-')[0])) / 2;
                const volLoad = Math.round(p.sets * avgReps * weight);
                return { w, sets: p.sets, reps: repsN, rir: p.rir, weight, volLoad };
              } catch { return { w, sets: 0, reps: 0, rir: 0, weight: 0, volLoad: 0 }; }
            });
            const wMax = Math.max(...projections.map(p => p.weight), 1);
            const vMax = Math.max(...projections.map(p => p.volLoad), 1);
            const svgW = 320, svgH = 140, pad = 32;
            const toX = (i: number) => pad + (i / (projections.length - 1 || 1)) * (svgW - pad * 2);
            const toY = (value: number, max: number) => svgH - pad - (value / max) * (svgH - pad * 2);
            return (
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(59,130,246,0.06)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>📈 Прогрессия по неделям</div>
                <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ overflow: 'visible' }}>
                  {[0, 0.25, 0.5, 0.75, 1].map(t => {
                    const val = Math.round(wMax * t);
                    const y = toY(val, wMax);
                    return (
                      <g key={t}>
                        <line x1={pad} y1={y} x2={svgW - pad} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                        <text x={pad - 4} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={6}>{val}</text>
                      </g>
                    );
                  })}
                  {/* Weight line */}
                  <path d={projections.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.weight, wMax)}`).join(' ')} fill="none" stroke="#60a5fa" strokeWidth={2} strokeLinejoin="round" />
                  {projections.map((p, i) => (
                    <g key={i}>
                      <circle cx={toX(i)} cy={toY(p.weight, wMax)} r={2} fill="#60a5fa" />
                      {i % Math.max(1, Math.ceil(projections.length / 10)) === 0 && (
                        <text x={toX(i)} y={svgH - pad + 10} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={6}>{p.w}</text>
                      )}
                    </g>
                  ))}
                  {/* Volume load line */}
                  <path d={projections.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.volLoad, vMax)}`).join(' ')} fill="none" stroke="#a855f7" strokeWidth={1.5} strokeDasharray="3,2" />
                  {/* RIR line */}
                  <path d={projections.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${svgH - pad - (p.rir / 6) * (svgH - pad * 2)}`).join(' ')} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeDasharray="4,3" />
                  {/* Deload shaded areas */}
                  {projections.filter(p => {
                    const ph = mesocyclePhaseForWeek(p.w, totalWeeks);
                    return ph === 'deload';
                  }).map((p, i) => {
                    const x = toX(p.w) - 8;
                    return <rect key={`dl-${i}`} x={x} y={pad - 4} width={16} height={svgH - pad * 2 + 4} fill="rgba(239,68,68,0.12)" rx={2} />;
                  })}
                  <text x={svgW / 2} y={svgH - 2} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={7}>Неделя</text>
                </svg>
                <div style={{ display: 'flex', gap: 10, fontSize: 10, marginTop: 2, flexWrap: 'wrap' }}>
                  <span style={{ color: '#60a5fa' }}>— Вес (кг)</span>
                  <span style={{ color: '#a855f7' }}>- - Объём (тыс. кг)</span>
                  <span style={{ color: ACCENT }}>--- RIR</span>
                  <span style={{ color: '#ef4444' }}>▨ Делоад</span>
                </div>
              </div>
            );
          })()}

          {/* Auto-progression 4-week plan */}
          {autoProgression && autoProgression.length === 4 && (
            <div style={{ marginTop: 14, padding: 12, background: 'rgba(34,197,94,0.04)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 6 }}>
                📅 Авто-прогрессия на 4 недели
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
                {autoProgression.map((w, i) => {
                  const ph = mesocyclePhaseForWeek(w.w, totalWeeks);
                  const isDl = ph === 'deload';
                  return (
                    <div key={i} style={{ padding: 8, borderRadius: 6, background: isDl ? 'rgba(239,68,68,0.06)' : i === 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isDl ? 'rgba(239,68,68,0.2)' : i === 0 ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
                        Нед {w.w}{isDl ? ' ⚠️' : ''}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: isDl ? '#ef4444' : ACCENT }}>
                        {w.sets}×{w.reps}
                      </div>
                      <div style={{ ...SMALL, fontSize: 10 }}>
                        {w.weight} кг ({w.pct}%) · RIR {w.rir} · отдых {w.rest}с
                      </div>
                      {isDl && <div style={{ ...SMALL, fontSize: 10, color: '#ef4444', marginTop: 2 }}>Делоад — снижение объёма</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ ...SMALL, fontSize: 10, marginTop: 4 }}>
                (тек. неделя {week} + 3 следующие. Изменения по prescript-движку с учётом фазы мезоцикла.)
              </div>
            </div>
          )}

          {/* Substitutes */}
          <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={handleSubstituteButton} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>🔄 Подобрать замену</button>
            <button onClick={saveCalc} disabled={!ex || !presc} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.3)', background: ex && presc ? 'rgba(59,130,246,0.08)' : 'transparent', color: ex && presc ? '#60a5fa' : 'rgba(255,255,255,0.2)', cursor: ex && presc ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 11 }}>💾 Сохранить</button>
            <button onClick={exportText} disabled={!ex || !presc} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)', background: ex && presc ? 'rgba(168,85,247,0.08)' : 'transparent', color: ex && presc ? '#a855f7' : 'rgba(255,255,255,0.2)', cursor: ex && presc ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 11 }}>📋 Экспорт</button>
          </div>

          {showSubstitutes && (
            <div style={{ marginTop: 10, padding: 12, background: 'rgba(0,230,138,0.08)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: ACCENT, marginBottom: 6 }}>🔄 Возможные замены:</div>
              {substituteList.map(opt => (
                <div key={opt.id} style={{ marginBottom: 4, padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{opt.name}</div>
                  <div style={{ ...SMALL, fontSize: 10 }}>{opt.reason}</div>
                </div>
              ))}
              <div style={{ marginTop: 6, textAlign: 'right' }}>
                <button onClick={() => setShowSubstitutes(false)} style={{ padding: '5px 10px', borderRadius: 4, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontSize: 10 }}>Закрыть</button>
              </div>
            </div>
          )}

          {/* Weak point */}
          {weakPointAdvice && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, border: `1px solid ${weakPointAdvice.color}33`, background: `${weakPointAdvice.color}0a` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: weakPointAdvice.color }}>🎯 Объём (MEV/MAV/MRV)</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{weakPointAdvice.advice}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                <div style={{ ...SMALL, fontSize: 10 }}>MEV: {weakPointAdvice.mev}</div>
                <div style={{ ...SMALL, fontSize: 10 }}>MAV: {weakPointAdvice.mav}</div>
                <div style={{ ...SMALL, fontSize: 10 }}>MRV: {weakPointAdvice.mrv}</div>
                <div style={{ ...SMALL, fontSize: 10, color: weakPointAdvice.color }}>Ваш: {weakPointAdvice.prescribedSets} ({weakPointAdvice.pct}% MAV)</div>
              </div>
            </div>
          )}

          {/* 🏆 PRO COACH ANALYSIS */}
          {ex && (() => {
            const fv = forceVector(ex.group, ex.type, ex.name);
            const fvRu: Record<string, string> = { horizontal_push: 'Горизонтальный жим', horizontal_pull: 'Горизонтальная тяга', vertical_push: 'Вертикальный жим', vertical_pull: 'Вертикальная тяга', knee_dominant: 'Доминанта коленей', hip_dominant: 'Доминанта таза', core_anti: 'Анти-ротация кора', other: 'Прочее' };
            const bbRole = ex.type === 'compound' ? (ex.jointStress === 'high' ? '🔴 Основной массанаборщик' : '🟡 Второстепенное базовое') : (ex.fatigueCost <= 3 ? '🔵 Изоляция / финишёр' : '🟣 Акцессорное');
            const pumpQuality = ex.type === 'isolation' && (goal === 'hypertrophy' || goal === 'bulk') ? (ex.fatigueCost <= 4 ? '🔥 Высокий (изоляция + метаболический стресс)' : '🟡 Средний') : ex.type === 'compound' ? (ex.fatigueCost >= 8 ? '🟢 Умеренный (системная усталость)' : '🟢 Хороший') : '🟡 Средний';
            const fvMusclePairs: Record<string, string> = { horizontal_push: 'антагонист: горизонтальная тяга (спина)', horizontal_pull: 'антагонист: горизонтальный жим (грудь)', vertical_push: 'антагонист: вертикальная тяга (широчайшие)', vertical_pull: 'антагонист: вертикальный жим (плечи)', knee_dominant: 'доминанта таза (задняя цепь)', hip_dominant: 'доминанта коленей (квадрицепсы)', core_anti: '—', other: '—' };
            return (
              <div style={{ marginTop: 12, padding: 14, background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(0,230,138,0.04))', borderRadius: 10, border: '1px solid rgba(168,85,247,0.2)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', marginBottom: 10 }}>🏆 Разбор от профессионального тренера</div>

                {/* Role + Muscle + Equipment row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6, marginBottom: 8 }}>
                  <div>
                    <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Роль</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{bbRole}</div>
                  </div>
                  <div>
                    <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Цель</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{ex.targetMuscle || GROUP_RU[ex.group] || ex.group}</div>
                  </div>
                  <div>
                    <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Вектор силы</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{fvRu[fv] || fv}</div>
                  </div>
                  <div>
                    <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Насос</div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{pumpQuality}</div>
                  </div>
                </div>

                {/* Technique from catalog */}
                {ex.technique && (
                  <div style={{ marginBottom: 8, padding: 10, background: 'rgba(0,0,0,0.15)', borderRadius: 6, borderLeft: `3px solid ${ACCENT}` }}>
                    <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>🎯 Техника выполнения</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{ex.technique}</div>
                  </div>
                )}

                {/* Emphasis chips */}
                {(ex.peakContraction || ex.stretchPhase || ex.pauseSeconds) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {ex.peakContraction && <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(255, 183, 77, 0.15)', border: '1px solid rgba(255, 183, 77, 0.2)', color: '#ffb74d', fontSize: 10, fontWeight: 600 }}>💪 Пиковое сокращение</span>}
                    {ex.stretchPhase && <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(129, 140, 248, 0.15)', border: '1px solid rgba(129, 140, 248, 0.2)', color: '#818cf8', fontSize: 10, fontWeight: 600 }}>↕ Растяжение в фазе</span>}
                    {(ex.pauseSeconds ?? 0) > 0 && <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.2)', color: '#34d399', fontSize: 10, fontWeight: 600 }}>⏸ Пауза {ex.pauseSeconds}с</span>}
                  </div>
                )}

                {/* Expert comment */}
                {ex.comments && (
                  <ExpandableCard title="📝 Комментарий эксперта" accent="#818cf8"
                    short={ex.comments.length > 80 ? ex.comments.slice(0, 80) + '…' : ex.comments}
                    full={<div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55 }}>{ex.comments}</div>}
                  />
                )}

                {/* 🔗 Position + Pairing */}
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  <div style={{ padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                    <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>🔗 Позиция в тренировке</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                      {ex.jointStress === 'high' && ex.fatigueCost >= 8 ? '1-е упражнение (самое энергозатратное, требует свежести)' :
                       ex.type === 'compound' ? '1-2-е упражнение (после разминки, до изоляции)' :
                       ex.fatigueCost <= 4 ? 'В конец тренировки (добивка / финишёр)' :
                       '2-3-е упражнение (после основного базового)'}
                    </div>
                  </div>
                  <div style={{ padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                    <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>🤝 Пара для суперсета</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                      {fvMusclePairs[fv] || 'не определена'}
                      {fv !== 'core_anti' && fv !== 'other' ? ' — 0 отдыха между, 60-90с после пары' : ''}
                    </div>
                  </div>
                </div>

                {/* 🔗 Superset Builder */}
                {supersetBuilder && supersetBuilder.length > 0 && (
                  <div style={{ marginTop: 8, padding: 10, background: 'rgba(0,230,138,0.05)', borderRadius: 8, border: '1px solid rgba(0,230,138,0.2)' }}>
                    <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>🤝 Суперсет / Гигант-сет</div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {supersetBuilder.map((opt, i) => (
                        <div key={i} style={{ padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 6, borderLeft: `3px solid ${ACCENT}` }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{opt.pair}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '3px 0' }}>
                            <span style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(0,230,138,0.1)', color: ACCENT, fontSize: 10 }}>{opt.type}</span>
                          </div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 }}>{opt.reason}</div>
                          <div style={{ fontSize: 10, color: '#fb923c', marginTop: 2 }}>{opt.scheme}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 🔗 Pre-exhaust / Post-exhaust Pairing */}
                {prePostPairing && prePostPairing.length > 0 && (
                  <div style={{ marginTop: 8, padding: 10, background: 'rgba(96,165,250,0.04)', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)' }}>
                    <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>🔄 Pre/Post Exhaust — порядок в сессии</div>
                    <div style={{ display: 'grid', gap: 5 }}>
                      {prePostPairing.map((p, i) => (
                        <div key={i} style={{ padding: '7px 9px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.06)`, borderLeft: `3px solid ${p.role === 'pre_exhaust' ? '#f59e0b' : p.role === 'post_exhaust' ? '#22c55e' : '#818cf8'}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: 11 }}>{p.name}</span>
                            <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: p.role === 'pre_exhaust' ? 'rgba(245,158,11,0.12)' : p.role === 'post_exhaust' ? 'rgba(34,197,94,0.12)' : 'rgba(129,140,248,0.12)', color: p.role === 'pre_exhaust' ? '#f59e0b' : p.role === 'post_exhaust' ? '#22c55e' : '#818cf8' }}>
                              {p.role === 'pre_exhaust' ? '→ ДО' : p.role === 'post_exhaust' ? '← ПОСЛЕ' : '↔ В паре'}
                            </span>
                          </div>
                          <div style={{ ...SMALL, fontSize: 10, marginTop: 2 }}>{p.type}</div>
                          <div style={{ ...SMALL, fontSize: 10, marginTop: 1, lineHeight: 1.4 }}>{p.reason.slice(0, 90)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 🔧 Intensity technique */}
                {techniqueSuggestion && (
                  <div style={{ marginTop: 8, padding: 8, background: 'rgba(245,158,11,0.08)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>🔧 Техника интенсивности для этой недели</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginTop: 1 }}>
                      {techniqueSuggestion.technique === 'cluster' ? 'Кластерный сет' :
                       techniqueSuggestion.technique === 'rest_pause' ? 'Рест-пауза' :
                       techniqueSuggestion.technique === 'myo_rep' ? 'Майо-репс' :
                       techniqueSuggestion.technique === 'drop_set' ? 'Дроп-сет' :
                       techniqueSuggestion.technique === 'backoff_set' ? 'Бэкофф-сет' :
                       techniqueSuggestion.technique === 'superset' ? 'Суперсет' : techniqueSuggestion.technique}
                    </div>
                    <div style={{ ...SMALL, fontSize: 10 }}>Фаза: {phase} · подходит для этой недели мезоцикла</div>
                  </div>
                )}

                {/* 🎯 TARGET MUSCLE ANALYSIS (анатомия + нейромышечная связь) */}
                {(() => {
                  const tm = getTargetMuscleForExercise(ex.id);
                  if (!tm) return null;
                  return (
                    <div style={{ marginTop: 8, padding: 10, background: 'linear-gradient(135deg, rgba(0,230,138,0.06), rgba(96,165,250,0.04))', borderRadius: 8, border: '1px solid rgba(0,230,138,0.25)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>
                        🎯 Целевая мышца: {tm.nameRu}
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <ExpandableCard title="🦴 Анатомия и функция" accent="#60a5fa"
                          short={`${tm.anatomy.slice(0, 100)}... · Волокна: ${tm.fiberDominance === 'fast' ? 'быстрые' : tm.fiberDominance === 'slow' ? 'медленные' : 'смешанные'}`}
                          full={
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                              <div>{tm.anatomy}</div>
                              <div style={{ marginTop: 4, color: tm.fiberDominance === 'fast' ? '#f59e0b' : tm.fiberDominance === 'slow' ? '#60a5fa' : '#a855f7' }}>
                                <b>Волокна:</b> {tm.fiberDominance === 'fast' ? 'Быстрые (IIx/IIa) — взрыв, сила, масса. Отвечают на 5-10 повт с тяжёлым весом.' : tm.fiberDominance === 'slow' ? 'Медленные (I) — выносливость. Отвечают на 15-25+ повт, 2-3×/нед.' : 'Смешанные — комбинируйте 5-8 (тяжёлые) и 12-20 (пампинг) повт.'}
                              </div>
                              <div style={{ marginTop: 4 }}><b>Функция:</b> {tm.function}</div>
                            </div>
                          }
                        />
                        <ExpandableCard title="🧠 Нейромышечная связь (как почувствовать)" accent="#a855f7"
                          short={tm.mmc.slice(0, 130) + '...'}
                          full={<div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{tm.mmc}</div>}
                        />
                        <ExpandableCard title="🔧 Подсказки по технике (под эту мышцу)" accent={ACCENT}
                          short={`${tm.techniqueCues[0]} · ${tm.techniqueCues[1] || ''}${tm.techniqueCues.length > 2 ? ` + ещё ${tm.techniqueCues.length - 2}` : ''}`}
                          full={
                            <div style={{ display: 'grid', gap: 4 }}>
                              {tm.techniqueCues.map((cue, i) => (
                                <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', padding: '4px 8px', background: 'rgba(0,230,138,0.05)', borderRadius: 4, lineHeight: 1.45 }}>
                                  <span style={{ color: ACCENT, fontWeight: 700 }}>{i + 1}.</span> {cue}
                                </div>
                              ))}
                              <div style={{ fontSize: 10, marginTop: 4, padding: 5, background: 'rgba(245,158,11,0.08)', borderRadius: 4, borderLeft: '2px solid #f59e0b' }}>
                                <b>Растяжение:</b> {tm.stretchKey}
                              </div>
                              <div style={{ fontSize: 10, padding: 5, background: 'rgba(0,230,138,0.08)', borderRadius: 4, borderLeft: `2px solid ${ACCENT}` }}>
                                <b>Пиковое сокращение:</b> {tm.peakKey}
                              </div>
                              <div style={{ fontSize: 10, padding: 5, background: 'rgba(96,165,250,0.06)', borderRadius: 4, borderLeft: '2px solid #60a5fa' }}>
                                <b>Рекомендованный темп:</b> {tm.tempoRecommendation} · <b>Объём:</b> {tm.volumeRecommendation}
                              </div>
                            </div>
                          }
                        />
                        <ExpandableCard title="⚠ Типичные ошибки" accent="#ef4444"
                          short={`${tm.commonMistakes[0]} · ${tm.commonMistakes[1] || ''}${tm.commonMistakes.length > 2 ? ` + ещё ${tm.commonMistakes.length - 2}` : ''}`}
                          full={
                            <div style={{ display: 'grid', gap: 3 }}>
                              {tm.commonMistakes.map((m, i) => (
                                <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', padding: '3px 8px', background: 'rgba(239,68,68,0.06)', borderRadius: 4, lineHeight: 1.4 }}>
                                  <span style={{ color: '#ef4444', fontWeight: 700 }}>✕</span> {m}
                                </div>
                              ))}
                            </div>
                          }
                        />
                        <div style={{ padding: 8, background: 'rgba(168,85,247,0.06)', borderRadius: 6, border: '1px solid rgba(168,85,247,0.15)' }}>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: '#a855f7', marginBottom: 2 }}>📍 Региональный акцент</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{tm.regionalEmphasis}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 📈 Progression Strategy */}
                <div style={{ marginTop: 8, padding: 10, background: 'rgba(34,197,94,0.06)', borderRadius: 6, border: '1px solid rgba(34,197,94,0.15)' }}>
                  <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>📈 Стратегия прогрессии для {goal === 'hypertrophy' ? 'гипертрофии' : goal === 'strength' ? 'силы' : goal}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                    {goal === 'hypertrophy' || goal === 'bulk' ? (
                      <span>🔹 <b>Двойная прогрессия:</b> сначала доведите повторы до верхней границы ({formatRepsRange(goal, ex.type === 'compound')}), затем повышайте вес на 2.5-5 кг, начиная с нижней границы.
                      <br />🔹 <b>Когда повышать вес:</b> сделали все подходы на верхней границе диапазона с RIR {presc?.rir} → добавляйте 2.5 кг (изоляция) или 5 кг (базовое).
                      <br />🔹 <b>Когда повышать повторы:</b> не можете добавить вес → держите вес, добавляйте 1 повтор в подход каждую неделю.
                      <br />🔹 <b>Сигнал к делоду:</b> вес не растёт 2 недели подряд, или RIR упал до 0 раньше времени, или сон/аппетит ухудшились.</span>
                    ) : goal === 'strength' ? (
                      <span>🔹 <b>Линейная прогрессия (новичок):</b> +2.5 кг каждый тренировочный день.
                      <br />🔹 <b>Wave loading (средний):</b> 3-нед волны: нед1 ×90% ×5, нед2 ×95% ×3, нед3 ×100% ×1+.
                      <br />🔹 <b>Периодизация (продвинутый):</b> 4-нед блоки: объём (5×5) → интенсификация (3×3) → пик (1×1) → делод.
                      <br />🔹 <b>Сигнал к делоду:</b> скорость грифа замедлилась, не можете выполнить запланированные повторы 2 тренировки подряд.</span>
                    ) : goal === 'power' ? (
                      <span>🔹 <b>Динамические усилия:</b> 8×2 с 60-70% с максимальной скоростью. Прогрессия: +2.5 кг при сохранении скорости.
                      <br />🔹 <b>Сигнал к делоду:</b> скорость упала более 10% или не можете держать взрывной характер.</span>
                    ) : (
                      <span>🔹 <b>Стабильная прогрессия:</b> +1-2 повтора в неделю или +1 подход каждые 2 недели.
                      <br />🔹 <b>Сигнал к делоду:</b> жжение не проходит, суставы болят, мотивация упала.</span>
                    )}
                  </div>
                </div>

                {/* 🎯 Weak point tactics */}
                {weakToggle && (
                  <div style={{ marginTop: 8, padding: 10, background: 'rgba(245,158,11,0.06)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>🎯 Тактика для отстающей группы</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                      {ex.group === 'chest' && '🔸 Ставьте это упражнение ПЕРВЫМ в тренировку груди (максимум энергии).\n🔸 После основного подхода — дроп-сет (−20% вес, до отказа) или.myoreps (15 активационных + 3×3 мини-сетов с 5с отдыха).\n🔸 В день ног — изолируйте грудные в начале, а не после жимов.'}
                      {ex.group === 'back' && '🔸 Для широчайших: подтягивания/тяга верхнего блока — первыми. Фокус на сведении лопаток в каждом повторе.\n🔸 Добавьте 1-2 изолирующих подхода после основных (пуловер или тяга прямыми руками).\n🔸 Работайте хватом: узкий → широчайшие, широкий → ромбовидные.'}
                      {ex.group === 'legs' && '🔸 Квадрицепсы отстают: фронтальные приседания или гакк-присед перед классическими.\n🔸 Задняя поверхность: румынская тяга + сгибания ног — обязательная пара.\n🔸 Добавьте 1 подход выпадов в конце тренировки ног для баланса.'}
                      {ex.group === 'shoulders' && '🔸 Средняя дельта — самый слабый пучок у 90% людей. Махи в стороны ПЕРВЫМИ, до жимов.\n🔸 Задняя дельта: face pull — обязательно в конце каждой тренировки.\n🔸 Используйте «правило 3 цветов»: 3 разных упражнения на 3 пучка.'}
                      {ex.group === 'arms' && '🔸 Бицепс: ставьте кросс-сгибания ПЕРВЫМИ (не после спины, когда бицепс уже устал).\n🔸 Трицепс: французский жим в начале, разгибания в конце.\n🔸 Молотки — обязательны для брахиалиса (визуальная толщина руки).'}
                      {ex.group === 'core' && '🔸 Планка и ролл-ауты — база. Добавьте анти-ротационные (Pallof press) для функционала.\n🔸 Пресс качайте в конце тренировки или в отдельный день.'}
                      {!['chest','back','legs','shoulders','arms','core'].includes(ex.group) && '🔸 Увеличьте частоту до 2×/нед. Добавьте 1-2 изолирующих подхода к каждому основному.'}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Warm-up ramp */}
          {warmupRamp && (
            <div style={{ marginTop: 12, padding: 10, background: 'rgba(251,146,60,0.06)', borderRadius: 8, border: '1px solid rgba(251,146,60,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', marginBottom: 6 }}>🔥 Разминочная рампа ({warmupRamp.phase})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 4 }}>
                {warmupRamp.steps.map((s, i) => (
                  <div key={i} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, borderLeft: i === warmupRamp.steps.length - 1 ? `2px solid ${ACCENT}` : '2px solid transparent' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: i === warmupRamp.steps.length - 1 ? ACCENT : '#fb923c' }}>{s.weight} кг</div>
                    <div style={{ ...SMALL, fontSize: 10 }}>{s.reps} повт · {s.pct}% раб. веса</div>
                  </div>
                ))}
              </div>
              <div style={{ ...SMALL, fontSize: 10, marginTop: 4 }}>Между разминочными — 45-60с отдыха. Последний подход-разминка считается как 1-й акклиматизационный.</div>
            </div>
          )}

          {/* Frequency + BFR + Session integration */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 12 }}>
            {freqRecommendation && (
              <div style={{ padding: 10, background: 'rgba(96,165,250,0.06)', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)' }}>
                <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>📅 Частота</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{freqRecommendation.label}</div>
                <div style={{ ...SMALL, fontSize: 10 }}>Рекомендованный сплит: {freqRecommendation.globalFreq}</div>
              </div>
            )}
            {bfrSuitability && (
              <div style={{ padding: 10, background: bfrSuitability.suitable ? 'rgba(168,85,247,0.06)' : 'rgba(239,68,68,0.06)', borderRadius: 8, border: `1px solid ${bfrSuitability.suitable ? 'rgba(168,85,247,0.2)' : 'rgba(239,68,68,0.15)'}` }}>
                <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>🔴 BFR-тренинг</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: bfrSuitability.suitable ? '#a855f7' : 'rgba(255,255,255,0.6)' }}>
                  {bfrSuitability.suitable ? '✅ Подходит' : '❌ Не подходит'}
                </div>
                <div style={{ ...SMALL, fontSize: 10 }}>{bfrSuitability.note.slice(0, 80)}</div>
              </div>
            )}
            <div style={{ padding: 10, background: 'rgba(34,197,94,0.06)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>📍 Интеграция в сессию</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginTop: 2 }}>
                {ex.type === 'compound' && ex.jointStress === 'high'
                  ? '1-е упражнение (базовое, энергоёмкое)'
                  : ex.type === 'compound'
                    ? '1-2-е упражнение (после разминки)'
                    : ex.fatigueCost <= 4
                      ? 'В конец (изоляция/финишёр)'
                      : '2-3-е упражнение (после основного)'}
              </div>
              <div style={{ ...SMALL, fontSize: 10 }}>
                {ex.jointStress === 'high' && ex.fatigueCost >= 8
                  ? 'Делайте ПЕРВЫМ, до утомления синергистов.'
                  : ex.type === 'compound'
                    ? 'ДО изоляции той же группы.'
                    : 'После базовых движений.'}
              </div>
            </div>
          </div>

          {/* 1RM History Chart */}
          {oneRMHistory && (
            <div style={{ marginTop: 14, padding: 12, background: 'rgba(34,197,94,0.06)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 6 }}>📈 Тренд 1ПМ — {ex?.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                {oneRMHistory.length} записей · {oneRMHistory[0].date} → {oneRMHistory[oneRMHistory.length - 1].date}
                · {(() => { const d = oneRMHistory[oneRMHistory.length - 1].oneRM - oneRMHistory[0].oneRM; return `${d >= 0 ? '+' : ''}${d.toFixed(1)} кг`; })()}
              </div>
              {(() => {
                const pts = oneRMHistory;
                const svgW = 300, svgH = 100, pad = 36;
                const maxRM = Math.max(...pts.map(p => p.oneRM), 1) * 1.1;
                const minRM = Math.min(...pts.map(p => p.oneRM), 0) * 0.9;
                const range = maxRM - minRM || 1;
                const toX = (i: number) => pad + (i / (pts.length - 1 || 1)) * (svgW - pad * 2);
                const toY = (v: number) => svgH - pad - ((v - minRM) / range) * (svgH - pad * 2);
                return (
                  <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ overflow: 'visible' }}>
                    {[0, 0.33, 0.67, 1].map(t => {
                      const v = +(minRM + range * t).toFixed(1);
                      return <g key={t}><line x1={pad} y1={toY(v)} x2={svgW - pad} y2={toY(v)} stroke="rgba(255,255,255,0.04)" strokeWidth={1} /><text x={pad - 4} y={toY(v) + 3} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize={6}>{v}</text></g>;
                    })}
                    <path d={pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.oneRM)}`).join(' ')} fill="none" stroke="#22c55e" strokeWidth={2} />
                    {pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 6)) === 0 || i === pts.length - 1).map((p, i) => (
                      <g key={i}>
                        <circle cx={toX(pts.indexOf(p))} cy={toY(p.oneRM)} r={2.5} fill="#22c55e" />
                        <text x={toX(pts.indexOf(p))} y={svgH - pad + 10} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={6}>{p.date.slice(5)}</text>
                      </g>
                    ))}
                  </svg>
                );
              })()}
            </div>
          )}

          {/* CNS vs Muscular Fatigue Analysis */}
          {fatigueAnalysis && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(239,68,68,0.04)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>🧠 Утомление: ЦНС vs Мышцы</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 6 }}>
                <div style={{ padding: 8, background: 'rgba(0,0,0,0.12)', borderRadius: 6 }}>
                  <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>ЦНС</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: fatigueAnalysis.cnsLoad >= 7 ? '#ef4444' : fatigueAnalysis.cnsLoad >= 4 ? '#f59e0b' : '#22c55e' }}>
                    {fatigueAnalysis.cnsLoad}/10
                  </div>
                  <div style={{ ...SMALL, fontSize: 10 }}>{fatigueAnalysis.cnsLabel}</div>
                </div>
                <div style={{ padding: 8, background: 'rgba(0,0,0,0.12)', borderRadius: 6 }}>
                  <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Мышцы (локально)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: fatigueAnalysis.muscularLoad >= 7 ? '#ef4444' : fatigueAnalysis.muscularLoad >= 4 ? '#f59e0b' : '#22c55e' }}>
                    {fatigueAnalysis.muscularLoad}/10
                  </div>
                  <div style={{ ...SMALL, fontSize: 10 }}>{fatigueAnalysis.muscularLabel}</div>
                </div>
                <div style={{ padding: 8, background: 'rgba(0,0,0,0.12)', borderRadius: 6 }}>
                  <div style={{ ...SMALL, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Восстановление</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: fatigueAnalysis.recoveryHours >= 48 ? '#ef4444' : fatigueAnalysis.recoveryHours >= 24 ? '#f59e0b' : '#22c55e' }}>
                    {fatigueAnalysis.recoveryHours}<span style={{ fontSize: 11 }}>ч</span>
                  </div>
                  <div style={{ ...SMALL, fontSize: 10 }}>до следующей сессии</div>
                </div>
              </div>
              <div style={{ padding: 8, background: 'rgba(0,0,0,0.1)', borderRadius: 6, borderLeft: `3px solid ${fatigueAnalysis.cnsLoad >= 7 || fatigueAnalysis.muscularLoad >= 7 ? '#ef4444' : fatigueAnalysis.cnsLoad >= 4 || fatigueAnalysis.muscularLoad >= 4 ? '#f59e0b' : '#22c55e'}` }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{fatigueAnalysis.advice}</div>
              </div>
            </div>
          )}

          {savedCalcs.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>💾 Сохранённые расчёты ({savedCalcs.length})</span>
                <span style={{ ...SMALL, fontSize: 10 }}>самые свежие</span>
              </div>
              {savedCalcs.slice(0, 10).map(s => (
                <div key={s.id} style={{ marginBottom: 4, padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{s.name}</span>
                    <button onClick={() => deleteCalc(s.id)} style={{ padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 10 }}>✕</button>
                  </div>
                  <div style={{ ...SMALL, fontSize: 10, marginTop: 2 }}>{s.sets}×{s.reps} · RIR {s.rir} · RPE {RIR_TO_RPE[s.rir] ?? '—'}· {s.weight} кг ({Math.round(s.weight / (s.oneRM || 1) * 100)}%) · нед {s.week} · {s.date}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExerciseCalcTab;
