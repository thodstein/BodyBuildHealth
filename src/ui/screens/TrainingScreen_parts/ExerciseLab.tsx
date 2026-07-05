import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { EXERCISE_CATALOG, getExerciseById, getSubstitutes } from '../../../core/exercise-catalog';
import { calcExercisePrescription } from '../../../engines/training.engine';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { getTechnique, getCues, getErrorsForExercise, getProgression } from '../../../engines/genetic-deload-technique.engine';
import { classifyMovement, estimateDifficulty, getMuscleSynergy, getJointStress, assessSafety } from '../../../engines/movement-engines';
import { generateRepTempo } from '../../../engines/rep-tempo-engine';
import { forceVector, lengthenedPartials } from '../../../engines/pro/exercise-prescription.engine';
import { calculateRepDuration, parseTempo } from '../../../engines/rep-tempo.engine';
import { mesocyclePhaseForWeek } from '../../../engines/rir-matrix.engine';
import { getTargetMuscleForExercise } from '../../../data/target-muscle-db';
import { getMappedIds } from '../../../data/exercise-id-mapping';
import { PopupSelect, PopupNumber, PopupText, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';
import { useDataLink } from '../../../core/data-link';
import type { Exercise } from '../../../core/types';

// ════════════════════ SHARED CONSTANTS ════════════════════
const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const BG = 'rgba(24,24,27,0.15)';
const BORDER = 'rgba(255,255,255,0.05)';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const CARD: React.CSSProperties = { padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' };
const pill: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 600, marginRight: 6, marginBottom: 4 };
const secTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: ACCENT, margin: '12px 0 6px', borderBottom: '1px solid rgba(0,230,138,0.15)', paddingBottom: 4 };
const chipRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 };

const GROUPS = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
const GROUP_RU: Record<string, string> = { all: 'Все группы', chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор' };
const GROUP_ICON: Record<string, string> = { chest: '🏋️', back: '🔙', legs: '🦵', shoulders: '💪', arms: '💪', core: '🎯' };
const TYPE_RU: Record<string, string> = { compound: 'Базовое', isolation: 'Изолированное' };
const EQUIP_RU: Record<string, string> = { barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блок', bodyweight: 'Вес тела', band: 'Резинка', kettlebell: 'Гиря', smith: 'Смит', plate: 'Блин', suspension: 'Петли' };
const JOINT_RU: Record<string, string> = { knee: 'Колено', hip: 'Таз', spine: 'Позвоночник', shoulder: 'Плечо', elbow: 'Локоть', ankle: 'Голеностоп' };
const RIR_TO_RPE: Record<number, number> = { 0: 10, 1: 9, 2: 8, 3: 7, 4: 6, 5: 5, 6: 4, 7: 3, 8: 2 };
const RPE_LABEL: Record<number, string> = { 10: 'Максимально', 9: 'Тяжело', 8: 'Умеренно тяжело', 7: 'Средне', 6: 'Легко', 5: 'Очень легко', 4: 'Разминка' };

type LabMode = 'prescription' | 'technique' | 'compare' | 'pro';

// ════════════════ SUB-REGION DEFINITIONS ════════════════
const SUBREGION_DEFS: Record<string, { id: string; name: string; keywords: string[]; description: string }[]> = {
  chest: [
    { id: 'chest_upper', name: 'Верхняя часть груди', keywords: ['верх', 'верхняя', 'upper'], description: 'Клавикулярная порция. Жимы на наклонной (30°), сведения снизу.' },
    { id: 'chest_mid', name: 'Центр / середина груди', keywords: ['центр', 'средн', 'середин', 'большая грудная'], description: 'Стернальная порция. Жим лёжа, кроссовер, баттерфляй.' },
    { id: 'chest_lower', name: 'Нижняя часть груди', keywords: ['низ', 'нижн', 'lower', 'decline'], description: 'Абдоминальная порция. Брусья грудным стилем, жим с отриц. уклоном.' },
    { id: 'chest_inner', name: 'Внутренняя / внешняя часть', keywords: ['внутрен', 'внешн', 'inner', 'outer'], description: 'Сведение рук, кроссовер. Жимы широким хватом — внешний.' },
    { id: 'chest_stretch', name: 'Растяжение / изоляция', keywords: ['растяж', 'stretch', 'изол'], description: 'Разводка гантелей, кроссовер — растяжение фасции и пиковое сокращение.' },
  ],
  back: [
    { id: 'back_lats', name: 'Широчайшие', keywords: ['широчайш', 'lats'], description: 'Тяги вертикальные и горизонтальные. V-образный силуэт.' },
    { id: 'back_mid', name: 'Центр / ромбовидные', keywords: ['центр спин', 'ромбовид', 'mid back', 'rhomboid'], description: 'Тяги с локтями в стороны. Т-гриф, тяга к животу.' },
    { id: 'back_traps', name: 'Трапеции', keywords: ['трапец', 'trap'], description: 'Шраги, становая, тяга к подбородку.' },
    { id: 'back_erectors', name: 'Разгибатели позвоночника', keywords: ['разгибател', 'erector', 'позвоночник', 'поясниц'], description: 'Становая, гиперэкстензия, гудморнинг.' },
    { id: 'back_rear_delt', name: 'Задняя дельта / верх спины', keywords: ['задн', 'rear delt', 'верх спин'], description: 'Тяга к лицу, махи в наклоне.' },
  ],
  legs: [
    { id: 'legs_quads', name: 'Квадрицепсы', keywords: ['квадрицепс', 'quad'], description: 'Приседания, жим ногами, разгибания.' },
    { id: 'legs_hams', name: 'Бицепс бедра', keywords: ['бицепс бедр', 'задн', 'hamstring', 'румын'], description: 'Румынская тяга, сгибания ног, гудморнинг.' },
    { id: 'legs_glutes', name: 'Ягодичные', keywords: ['ягодиц', 'glute', 'hip thrust'], description: 'Ягодичный мост, выпады, румынская тяга.' },
    { id: 'legs_calves', name: 'Голень', keywords: ['икронож', 'камбаловид', 'calf'], description: 'Подъёмы на носки стоя/сидя.' },
    { id: 'legs_adductors', name: 'Приводящие', keywords: ['приводящ', 'adductor'], description: 'Сумо-тяга, сведения ног.' },
  ],
  shoulders: [
    { id: 'sh_front', name: 'Передняя дельта', keywords: ['передн', 'front', 'передняя'], description: 'Жимы над головой, фронтальные подъёмы.' },
    { id: 'sh_side', name: 'Средняя дельта', keywords: ['средн', 'side', 'lateral'], description: 'Махи в стороны. Ширина плеч.' },
    { id: 'sh_rear', name: 'Задняя дельта', keywords: ['задн', 'rear', 'задняя дельт'], description: 'Махи в наклоне, тяга к лицу.' },
    { id: 'sh_cuff', name: 'Ротаторная манжета', keywords: ['ротатор', 'cuff', 'rotator'], description: 'Внешняя/внутренняя ротация. Профилактика травм.' },
  ],
  arms: [
    { id: 'arms_biceps', name: 'Бицепс', keywords: ['бицепс', 'bicep'], description: 'Подъёмы штанги/гантелей, молотки, скамья Скотта.' },
    { id: 'arms_triceps', name: 'Трицепс', keywords: ['трицепс', 'tricep'], description: 'Французский жим, разгибания в блоке, брусья.' },
    { id: 'arms_brachialis', name: 'Брахиалис', keywords: ['брахиалис', 'брахирадиал', 'brachial'], description: 'Молотки нейтральным хватом, обратные подъёмы.' },
    { id: 'arms_forearms', name: 'Предплечья / хват', keywords: ['предплеч', 'forearm', 'хват', 'grip'], description: 'Сгибания/разгибания запястий, удержание.' },
  ],
  core: [
    { id: 'core_rectus', name: 'Прямая мышца живота', keywords: ['прям', 'пресс', 'rectus'], description: 'Скручивания, подъёмы ног, планка.' },
    { id: 'core_obliques', name: 'Косые', keywords: ['кос', 'oblique'], description: 'Боковые скручивания, повороты, «дровосек».' },
    { id: 'core_deep', name: 'Глубокие стабилизаторы', keywords: ['глубок', 'стабил', 'трансверс', 'deep'], description: 'Вакуум, «мёртвый жук», анти-ротация.' },
    { id: 'core_erectors', name: 'Разгибатели спины', keywords: ['разгибател', 'erector', 'спин'], description: 'Гиперэкстензия, «супермен».' },
  ],
};
const SUB_REGION_COLORS = ['#00e68a', '#60a5fa', '#c084fc', '#f59e0b', '#f87171', '#34d399', '#fbbf24', '#818cf8'];

// ════════════════ REGION MAP (for prescription mode) ════════════════
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
  triceps_long: 'triceps', triceps_lateral: 'triceps', triceps_medial: 'triceps',
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

// ════════════════ RESISTANCE / DIFFICULTY UTILITIES ════════════════
type ForceCurveType = 'stretch_mediated' | 'mid_range' | 'peak_contraction' | 'variable';
interface ForceCurveProfile { curve: ForceCurveType; label: string; score: number; desc: string; bestGoal: string; repStyle: string; }

function getResistanceProfile(ex: Exercise): ForceCurveProfile {
  const g = ex.group; const t = ex.type; const n = ex.name.toLowerCase();
  const stretchKeywords = ['fly', 'развод', 'pullover', 'пуловер', 'romanian', 'румын', 'rdl', 'good morning', 'гуд', 'dip', 'брусь', 'deep squat', 'front squat', 'фронт', 'lunge', 'выпад', 'bulgarian', 'болгар', 'overhead triceps', 'француз', 'incline curl', 'скотт', 'concentration', 'концентра', 'leg curl', 'сгибани', 'hyperextension', 'гиперэкстен', 'pull-up', 'подтяг', 'chin-up', 'cable crossover', 'кроссовер', 'pec deck', 'бабоч'];
  const midKeywords = ['bench press', 'жим штан', 'deadlift', 'станов', 'squat', 'присед', 'row', 'тяга гант', 'military press', 'арме', 'press machine', 'shoulder press', 'triceps pushdown', 'разгибани', 'barbell curl', 'подъем на биц', 'standing calf', 'leg press', 'hack squat', 'гантеля'];
  const peakKeywords = ['kickback', 'kick-back', 'отведени', 'lateral raise', 'махи сторон', 'front raise', 'перед собой', 'bent-over raise', 'face pull', 'pull face', 'cable curl', 'triceps extension', 'leg extension', 'calf raise', 'подъем на нос'];
  const isStretch = stretchKeywords.some(k => n.includes(k));
  const isMid = midKeywords.some(k => n.includes(k));
  const isPeak = peakKeywords.some(k => n.includes(k));
  let curve: ForceCurveType; let score: number; let bestGoal: string; let repStyle: string;
  if (isStretch) { curve = 'stretch_mediated'; score = t === 'compound' ? 9 : 10; bestGoal = 'hypertrophy'; repStyle = 'Медленная эксцентрика 3-4с, пауза в растянутой позиции 1-2с'; }
  else if (isPeak) { curve = 'peak_contraction'; score = t === 'compound' ? 4 : 6; bestGoal = 'pump'; repStyle = 'Быстрая концентрика с пиковым удержанием 2с, короткая амплитуда'; }
  else if (isMid) { curve = 'mid_range'; score = t === 'compound' ? 5 : 6; bestGoal = 'strength'; repStyle = 'Взрывная концентрика, контролируемая эксцентрика, без пауз в крайних точках'; }
  else if (t === 'compound' && g === 'legs') { curve = 'stretch_mediated'; score = 8; bestGoal = 'hypertrophy'; repStyle = 'Полная амплитуда, пауза в нижней точке, медленный подъём'; }
  else if (t === 'compound') { curve = 'mid_range'; score = 5; bestGoal = 'strength'; repStyle = 'Стандартный темп, избегайте пауз в крайних точках'; }
  else { curve = 'peak_contraction'; score = 5; bestGoal = 'pump'; repStyle = 'Пиковое сокращение 1-2с, контролируемая эксцентрика'; }
  const curveLabel: Record<ForceCurveType, string> = { stretch_mediated: 'Растяжение (длинная позиция)', mid_range: 'Середина амплитуды', peak_contraction: 'Пиковое сокращение', variable: 'Переменная' };
  const curveDesc: Record<ForceCurveType, string> = {
    stretch_mediated: 'Максимальное сопротивление приходится на растянутую позицию. Идеально для гипертрофии — создаёт наибольшее механическое напряжение в саркомерах, активирует mTOR и факторы роста.',
    mid_range: 'Основное усилие в середине амплитуды. Эффективно для силы и миофибриллярной гипертрофии, но уступает stretch-mediated в общем росте мышц.',
    peak_contraction: 'Пик нагрузки в сокращённой позиции. Хорошо для насоса и метаболического стресса, минимальное механическое растяжение.',
    variable: 'Профиль сопротивления меняется в зависимости от угла и оборудования.',
  };
  return { curve, label: curveLabel[curve], score, desc: curveDesc[curve], bestGoal, repStyle };
}

interface DifficultyPair { name: string; diff: 'easier' | 'harder'; how: string; reason: string; }
function getDifficultyScaler(ex: Exercise): DifficultyPair[] {
  const n = ex.name.toLowerCase(); const g = ex.group;
  const pairs: DifficultyPair[] = [];
  if (n.includes('bench')) pairs.push({ name: 'Жим гантелей', diff: 'easier', how: 'Замените штангу на гантели на 10-15% легче', reason: 'Большая амплитуда, естественная траектория, меньше нагрузки на плечи' });
  if (n.includes('жим штан') && g === 'chest') pairs.push({ name: 'Жим в машине Смита', diff: 'easier', how: 'Снизьте вес на 10% и работайте в Смите', reason: 'Фиксированная траектория, не требует стабилизации' });
  if (n.includes('присед') || n.includes('squat')) pairs.push({ name: 'Гоблет-присед с гантелью', diff: 'easier', how: 'Одна гантель 10-20 кг перед грудью', reason: 'Естественный центр тяжести, меньшая осевая нагрузка' });
  if (n.includes('станов') || n.includes('deadlift')) pairs.push({ name: 'Румынская тяга', diff: 'easier', how: 'Снизьте вес на 20%, работайте с прямой спиной', reason: 'Меньше нагрузка на поясницу, безопаснее' });
  if (n.includes('подтяг') || n.includes('pull-up') || n.includes('chin-up')) pairs.push({ name: 'Подтягивания с резиной', diff: 'easier', how: 'Используйте резиновый жгут или противовес', reason: 'Позволяет делать больше повторений с правильной техникой' });
  if (n.includes('bench') || (n.includes('жим штан') && g === 'chest')) pairs.push({ name: 'Жим с паузой', diff: 'harder', how: 'Добавьте паузу 2с на груди, вес -15%', reason: 'Убирает рефлекс растяжения, увеличивает TUT' });
  if ((n.includes('присед') || n.includes('squat')) && !n.includes('front') && !n.includes('гоблет')) pairs.push({ name: 'Фронтальный присед', diff: 'harder', how: 'Штанга на груди, вес снизить на 20%', reason: 'Больше акцент на квадрицепс, вертикальнее корпус' });
  if (n.includes('станов') || n.includes('deadlift')) pairs.push({ name: 'Дефицитная тяга', diff: 'harder', how: 'Встаньте на плинты 5-10см, вес -10%', reason: 'Увеличенная амплитуда, больше работы в растянутой позиции' });
  if (n.includes('подтяг') || n.includes('pull-up') || n.includes('chin-up')) pairs.push({ name: 'С отягощением', diff: 'harder', how: 'Добавьте 5-10 кг на поясе', reason: 'Увеличивает сопротивление при сохранении полной амплитуды' });
  if (n.includes('махи сторон') || n.includes('lateral raise')) pairs.push({ name: 'С паузой 2с вверху', diff: 'harder', how: 'Пауза 2с в верхней точке, вес -20%', reason: 'Увеличивает TUT, пиковое сокращение' });
  if (g !== 'core' && pairs.length < 2) {
    if (ex.type === 'compound') {
      if (!pairs.some(p => p.diff === 'easier')) pairs.push({ name: 'Вариант с гантелями', diff: 'easier', how: 'Гантели вместо штанги, вес -15%', reason: 'Естественная амплитуда, меньше стресс на суставы' });
      if (!pairs.some(p => p.diff === 'harder')) pairs.push({ name: 'Темповая версия', diff: 'harder', how: 'Темп 3-0-1-0, вес -10%', reason: 'Увеличенное TUT, больше метаболического стресса' });
    } else {
      if (!pairs.some(p => p.diff === 'harder')) pairs.push({ name: 'Drop-set версия', diff: 'harder', how: '-20% → до отказа → -20% → до отказа', reason: 'Максимальный метаболический стресс и пампинг' });
    }
  }
  return pairs;
}

// ════════════════ SHARED UTILITY FUNCTIONS ════════════════
interface TechniqueScore { total: number; breakdown: { label: string; value: number; max: number }[]; level: 'low' | 'medium' | 'high'; label: string; }

function calcTechniqueScore(ex: Exercise): TechniqueScore {
  const map = getMappedIds(ex.id);
  const lookupId = map.bio || map.movement || ex.id;
  const bio = getExerciseBio(lookupId);
  const difficulty = estimateDifficulty(lookupId);
  const stress = getJointStress(map.joint || lookupId);
  const cls = classifyMovement(map.movement || lookupId);
  const jointScore = Object.values(stress).reduce((s: number, j: any) => {
    const vals = typeof j === 'object' ? Object.values(j).filter((v: any) => typeof v === 'number') as number[] : [];
    return s + vals.reduce((a: number, b: number) => a + b, 0);
  }, 0);
  const jointMax = Math.min(25, jointScore / 2);
  const complexityScore = cls.complexity === 'high' ? 25 : cls.complexity === 'medium' ? 15 : 8;
  const cnsScore = bio ? Math.min(25, bio.cnsDemand * 5) : Math.min(25, difficulty.cnsDemand * 5);
  const stabilityScore = bio ? Math.min(15, bio.difficulty * 3) : 8;
  const mobilityScore = bio ? Math.min(10, bio.difficulty * 2) : 5;
  const total = Math.min(100, Math.round(jointMax + complexityScore + cnsScore + stabilityScore + mobilityScore));
  return {
    total,
    breakdown: [
      { label: 'Суставная нагрузка', value: Math.round(jointMax), max: 25 },
      { label: 'Сложность движения', value: Math.round(complexityScore), max: 25 },
      { label: 'ЦНС-нагрузка', value: Math.round(cnsScore), max: 25 },
      { label: 'Стабильность', value: Math.round(stabilityScore), max: 15 },
      { label: 'Мобильность', value: Math.round(mobilityScore), max: 10 },
    ],
    level: total >= 60 ? 'high' : total >= 30 ? 'medium' : 'low',
    label: total >= 60 ? 'Сложное' : total >= 30 ? 'Среднее' : 'Простое',
  };
}

function getRiskColor(level: string): string { if (level === 'high') return '#ef4444'; if (level === 'medium' || level === 'med') return '#f59e0b'; return '#22c55e'; }
function getJointEmoji(level: string): string { if (level === 'high') return '🔴'; if (level === 'medium' || level === 'med') return '🟡'; return '🟢'; }
function lvl(v: number, max: number): string { const p = v / max; if (p >= 0.7) return '#ef4444'; if (p >= 0.4) return '#f59e0b'; return '#22c55e'; }
const filterBtn = (active: boolean): React.CSSProperties => ({
  padding: '4px 12px', borderRadius: 14, border: `1px solid ${active ? 'rgba(0,230,138,0.4)' : 'rgba(255,255,255,0.08)'}`,
  background: active ? 'rgba(0,230,138,0.1)' : 'transparent', color: active ? ACCENT : DIM, cursor: 'pointer', fontSize: 10, fontWeight: 600,
});

// ════════════════ REUSABLE: Technique Detail Card ════════════════
const TechniqueDetail: React.FC<{
  ex: Exercise; technique: any; score: TechniqueScore; cues: any[]; errors: any[];
  progression: string[]; synergy: any; jointStress: any; classification: any;
  fVector: string; lengthened: any[]; safety: any; bio: any; cssScale?: number;
}> = ({ ex, technique, score, cues, errors, progression, synergy, jointStress, classification, fVector, lengthened, safety, bio, cssScale = 1 }) => {
  const s = cssScale;
  const tempoRes = generateRepTempo({ goal: ex.type === 'compound' ? 'strength' : 'hypertrophy', riskLevel: score.level, difficultyLevel: score.level, techniqueIssues: [], isMainLift: ex.type === 'compound' });
  const subs = getSubstitutes(ex.id);
  const subList = subs ? subs.substitutes.filter((s: any) => getExerciseById(s.id)) : [];
  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ ...secTitle, fontSize: 10 * s }}>📊 Технический счёт ({score.total}/100)</div>
      {score.breakdown.map((b, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: 9 * s }}>
          <div style={{ width: 110 * s, color: DIM, textAlign: 'right', flexShrink: 0 }}>{b.label}</div>
          <div style={{ flex: 1, height: 6 * s, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(b.value / b.max) * 100}%`, borderRadius: 3, background: lvl(b.value, b.max) }} />
          </div>
          <div style={{ width: 28, textAlign: 'right', fontWeight: 700, color: lvl(b.value, b.max) }}>{b.value}</div>
          <div style={{ width: 16, color: 'rgba(255,255,255,0.2)', fontSize: 8 * s }}>/ {b.max}</div>
        </div>
      ))}
      {technique ? (
        <>
          <div style={{ ...secTitle, fontSize: 10 * s }}>🎯 Полный разбор техники</div>
          <div style={{ fontSize: 9 * s, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700, color: ACCENT }}>Исходное положение:</p>
            {technique.setup.map((t: string, i: number) => <div key={i} style={{ marginBottom: 2 }}>{i + 1}. {t}</div>)}
            <p style={{ margin: '8px 0 6px', fontWeight: 700, color: ACCENT }}>Выполнение:</p>
            {technique.execution.map((t: string, i: number) => <div key={i} style={{ marginBottom: 2 }}>{i + 1}. {t}</div>)}
            <p style={{ margin: '8px 0 6px', fontWeight: 700, color: ACCENT }}>Дыхание:</p>
            {technique.breathing.map((t: string, i: number) => <div key={i} style={{ marginBottom: 2, fontStyle: 'italic' }}>{t}</div>)}
            {technique.preRequisites?.length > 0 && (
              <>
                <p style={{ margin: '8px 0 6px', fontWeight: 700, color: ACCENT }}>Пререквизиты:</p>
                {technique.preRequisites.map((t: string, i: number) => <div key={i} style={{ marginBottom: 2 }}>{i + 1}. {t}</div>)}
              </>
            )}
          </div>
        </>
      ) : ex.technique ? (
        <>
          <div style={{ ...secTitle, fontSize: 10 * s }}>🎯 Техника выполнения</div>
          <div style={{ fontSize: 9 * s, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ex.technique}</div>
        </>
      ) : null}
      {cues.length > 0 && (
        <>
          <div style={{ ...secTitle, fontSize: 10 * s }}>💡 Ключевые подсказки (cues)</div>
          <div style={chipRow}>
            {cues.map((c: any, i: number) => (
              <span key={i} style={{ ...pill, background: c.priority === 'critical' ? 'rgba(239,68,68,0.12)' : c.priority === 'important' ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)', color: c.priority === 'critical' ? '#f87171' : c.priority === 'important' ? '#fbbf24' : DIM, fontSize: 8 * s }}>
                {c.priority === 'critical' ? '⚡' : c.priority === 'important' ? '📌' : '💬'} {c.cue}
              </span>
            ))}
          </div>
        </>
      )}
      {errors.length > 0 && (
        <>
          <div style={{ ...secTitle, fontSize: 10 * s }}>⚠️ Частые ошибки</div>
          {errors.map((e: any, i: number) => (
            <div key={i} style={{ marginBottom: 4, padding: '6px 8px', background: 'rgba(239,68,68,0.05)', borderRadius: 5, border: '1px solid rgba(239,68,68,0.1)' }}>
              <div style={{ fontSize: 9 * s, fontWeight: 700, color: '#f87171' }}>{e.error}</div>
              <div style={{ fontSize: 8 * s, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>Причина: {e.cause}</div>
              <div style={{ fontSize: 8 * s, color: '#22c55e', marginTop: 1 }}>Исправление: {e.fix}</div>
            </div>
          ))}
        </>
      )}
      {progression.length > 0 && (
        <>
          <div style={{ ...secTitle, fontSize: 10 * s }}>📈 Прогрессия</div>
          <div style={{ fontSize: 9 * s, color: '#22c55e', background: 'rgba(34,197,94,0.06)', padding: '6px 8px', borderRadius: 5 }}>{progression.join(' → ')}</div>
        </>
      )}
      {(technique?.regression?.length ?? 0) > 0 && (
        <>
          <div style={{ ...secTitle, fontSize: 10 * s }}>📉 Регрессия</div>
          <div style={{ fontSize: 9 * s, color: '#f59e0b', background: 'rgba(245,158,11,0.06)', padding: '6px 8px', borderRadius: 5 }}>{technique.regression.join(' → ')}</div>
        </>
      )}
      {subList.length > 0 && (
        <>
          <div style={{ ...secTitle, fontSize: 10 * s }}>🔄 Цепочка замен</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 9 * s }}>
            {subList.map((ss: any) => (
              <div key={ss.id} style={{ background: 'rgba(168,85,247,0.06)', borderRadius: 5, padding: '3px 6px', border: '1px solid rgba(168,85,247,0.1)' }}>
                <span style={{ color: '#c084fc', fontWeight: 600 }}>{getExerciseById(ss.id)?.name || ss.id}</span>
                {ss.reason && <span style={{ color: DIM, marginLeft: 3, fontSize: 8 * s }}>— {ss.reason}</span>}
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ ...secTitle, fontSize: 10 * s }}>💪 Мышечная синергия</div>
      {synergy && synergy.primary.length > 0 && (
        <div style={{ fontSize: 9 * s, lineHeight: 1.5 }}>
          <div><span style={{ color: ACCENT }}>Основные:</span> {synergy.primary.join(', ')}</div>
          {synergy.secondary.length > 0 && <div><span style={{ color: '#60a5fa' }}>Вспом.:</span> {synergy.secondary.join(', ')}</div>}
          {synergy.stabilizers.length > 0 && <div><span style={{ color: '#a855f7' }}>Стаб.:</span> {synergy.stabilizers.join(', ')}</div>}
          {synergy.synergists.length > 0 && <div><span style={{ color: '#f59e0b' }}>Синерг.:</span> {synergy.synergists.join(', ')}</div>}
          {synergy.antagonists.length > 0 && <div><span style={{ color: '#ef4444' }}>Антаг.:</span> {synergy.antagonists.join(', ')}</div>}
        </div>
      )}
      {lengthened.length > 0 && (
        <>
          <div style={{ ...secTitle, fontSize: 10 * s }}>🎯 Региональная гипертрофия</div>
          <div style={{ fontSize: 9 * s, color: DIM, lineHeight: 1.4 }}>{lengthened.map((l: any, i: number) => <div key={i} style={{ marginBottom: 2 }}>• {l.name}: {l.emphasis}</div>)}</div>
        </>
      )}
      <div style={{ ...secTitle, fontSize: 10 * s }}>⏱ Темпо-прескрипция</div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 4 }}>
        {[tempoRes.tempo.eccentric, tempoRes.tempo.pauseBottom, tempoRes.tempo.concentric, tempoRes.tempo.pauseTop].map((sec, i) => {
          const labels = ['Эксц.', 'Пауза↓', 'Конц.', 'Пауза↑'];
          const colors = ['#60a5fa', '#f59e0b', '#22c55e', '#a855f7'];
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center', background: `${colors[i]}14`, borderRadius: 6, padding: '4px 2px', border: `1px solid ${colors[i]}22` }}>
              <div style={{ fontSize: 16 * s, fontWeight: 800, color: colors[i] }}>{sec === 0 ? 'X' : sec}</div>
              <div style={{ fontSize: 7 * s, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{labels[i]}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 8 * s, color: DIM, fontStyle: 'italic' }}>{tempoRes.rationale}</div>
      <div style={{ ...secTitle, fontSize: 10 * s }}>🛡 Безопасность ({safety.score}/100)</div>
      {safety.requiresSpotter && <div style={{ fontSize: 9 * s, color: '#f59e0b' }}>⚠ Требуется страхующий (споттер)</div>}
      {safety.contraindications.length > 0 && <div style={{ fontSize: 9 * s, color: '#f87171' }}><b>Противопоказания:</b> {safety.contraindications.join('; ')}</div>}
      {safety.precautions.length > 0 && <div style={{ fontSize: 9 * s, color: '#fbbf24' }}><b>Предосторожности:</b> {safety.precautions.join('; ')}</div>}
      {safety.highRiskPopulation.length > 0 && <div style={{ fontSize: 9 * s, color: DIM }}><b>Группы риска:</b> {safety.highRiskPopulation.join(', ')}</div>}
      <div style={{ ...secTitle, fontSize: 10 * s }}>📐 Классификация движения</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 9 * s, color: DIM }}>
        <div>Плоскость: <b style={{ color: '#fff' }}>{classification.plane}</b></div>
        <div>Нагрузка: <b style={{ color: '#fff' }}>{classification.loadType}</b></div>
        <div>Стойка: <b style={{ color: '#fff' }}>{classification.groundingPattern}</b></div>
        <div>Force-вектор: <b style={{ color: '#c084fc' }}>{fVector}</b></div>
        {ex.targetMuscle && <div>Целевая: <b style={{ color: ACCENT }}>{ex.targetMuscle}</b></div>}
      </div>
    </div>
  );
};

// ════════════════ PRESCRIPTION SUB-TAB ════════════════
const PrescriptionTab: React.FC = () => {
  const { profile } = useDataLink();
  const [group, setGroup] = useState('chest');
  const [exId, setExId] = useState('');
  const [oneRM, setOneRM] = useState(0);
  const [goal, setGoal] = useState('strength');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [week, setWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(12);
  const [manualTempo, setManualTempo] = useState('');
  const [weakToggle, setWeakToggle] = useState(false);
  const [region, setRegion] = useState('all');
  const [showGenerator, setShowGenerator] = useState(true);

  // Generator states
  const [genGroup, setGenGroup] = useState('chest');
  const [genGoal, setGenGoal] = useState('bulk');
  const [genLevel, setGenLevel] = useState('intermediate');
  const [genCount, setGenCount] = useState(5);
  const [genResult, setGenResult] = useState<Array<{ name: string; group: string; type: string; equipment: string; sets: number; reps: string; rir: number; rest: number; weight: number; pct: number }> | null>(null);

  useEffect(() => {
    if (!profile) return;
    const lvl = profile?.settings.trainingLevel ?? 'intermediate';
    setLevel((lvl === 'enhanced' ? 'advanced' : lvl) as 'beginner' | 'intermediate' | 'advanced');
    setGoal(profile?.settings.primaryGoal ?? 'strength');
  }, [profile]);

  useEffect(() => {
    if (!exId || !profile) { setOneRM(0); return; }
    const baseline = profile?.settings.strengthBaselines?.[exId];
    setOneRM(baseline && baseline > 0 ? baseline : 100);
  }, [exId, profile]);

  const exList = useMemo(() => {
    let list = group === 'all' ? EXERCISE_CATALOG : EXERCISE_CATALOG.filter(e => e.group === group);
    if (region !== 'all') list = list.filter(e => getExerciseRegion(e.id, e.group) === region);
    return list;
  }, [group, region]);

  const ex = useMemo(() => EXERCISE_CATALOG.find(e => e.id === exId), [exId]);
  const presc = useMemo(() => {
    if (!ex) return null;
    try { return calcExercisePrescription(ex, goal, level, weakToggle, false, 1, week, totalWeeks); } catch { return null; }
  }, [ex, goal, level, weakToggle, week, totalWeeks]);

  const reps0 = ex && presc ? (parseInt(presc.reps) || 5) : 5;
  const pct = Math.round(100 / (1 + reps0 / 30));
  const workWeight = ex && presc ? +(oneRM * pct / 100).toFixed(1) : 0;
  const phase = useMemo(() => mesocyclePhaseForWeek(week, totalWeeks), [week, totalWeeks]);
  const isDeload = phase === 'deload';

  useEffect(() => { setRegion('all'); }, [group]);

  // Generator logic
  useEffect(() => {
    const exs = EXERCISE_CATALOG.filter(e => e.group === genGroup).slice(0, genCount * 2);
    const scored = exs.map((e: any) => {
      const p = calcExercisePrescription(e, genGoal, genLevel, false, false, 1);
      let score = 0;
      if (e.type === 'compound') score += 10;
      if (e.type === 'isolation') score += 3;
      return { ex: e, p, score };
    });
    scored.sort((a: any, b: any) => b.score - a.score);
    const genLevelNumber = genLevel === 'beginner' ? 1 : genLevel === 'intermediate' ? 2 : genLevel === 'advanced' ? 3 : 4;
    const fakeRM = 80 + genLevelNumber * 20;
    setGenResult(scored.slice(0, genCount).map((s: any) => {
      const repsN = parseInt(s.p.reps) || 5;
      const pcN = Math.round(100 / (1 + repsN / 30));
      return {
        name: s.ex.name, group: s.ex.group, type: s.ex.type,
        equipment: s.ex.equipment || '—', sets: s.p.sets, reps: s.p.reps,
        rir: s.p.rir, rest: s.p.rest, weight: +((fakeRM) * pcN / 100).toFixed(1), pct: pcN,
      };
    }));
  }, [genGroup, genGoal, genLevel, genCount]);

  // Volume load
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
    const avgReps = (parseInt(presc.reps.split('-')[0]) + parseInt(presc.reps.split('-')[1] || presc.reps.split('-')[0])) / 2;
    const perSet = +(avgReps * repDuration).toFixed(0);
    const perSession = +(perSet * presc.sets).toFixed(0);
    return { repDuration, perSet, perSession, eccentric: tempo.eccentric, bottomPause: tempo.bottomPause, concentric: tempo.concentric, topPause: tempo.topPause };
  }, [ex, presc, manualTempo, workWeight]);

  const rpeInfo = useMemo(() => {
    if (!presc) return null;
    const rpe = RIR_TO_RPE[presc.rir] ?? Math.max(1, 10 - presc.rir);
    return { rpe, label: RPE_LABEL[rpe] || `${rpe}/10` };
  }, [presc]);

  const amrapEstimate = useMemo(() => {
    if (!oneRM || !workWeight || workWeight <= 0) return 0;
    return Math.max(0, Math.round(30 * (oneRM / workWeight - 1)));
  }, [oneRM, workWeight]);

  const fatigueScore = useMemo(() => {
    if (!ex || !presc) return 0;
    const baseCost = ex.fatigueCost || 5;
    const setFactor = Math.min(presc.sets / 3, 2);
    const compoundPenalty = ex.type === 'compound' ? 1.2 : 1;
    const deloadDiscount = isDeload ? 0.5 : 1;
    return +(baseCost * setFactor * compoundPenalty * deloadDiscount).toFixed(1);
  }, [ex, presc, isDeload]);

  const oneRMProjection = useMemo(() => {
    if (!oneRM || oneRM <= 0) return null;
    const weeklyRate = level === 'beginner' ? 2.5 : level === 'intermediate' ? 1.5 : 1;
    const progressionWeeks = Math.max(0, totalWeeks - week);
    const projected = +(oneRM + weeklyRate * progressionWeeks).toFixed(1);
    const pctGain = +((projected / oneRM - 1) * 100).toFixed(1);
    return { current: oneRM, projected, weeklyRate, pctGain, progressionWeeks };
  }, [oneRM, level, totalWeeks, week]);

  const resistanceProfile = useMemo(() => { if (!ex) return null; return getResistanceProfile(ex); }, [ex]);
  const difficultyScaler = useMemo(() => { if (!ex) return null; return getDifficultyScaler(ex); }, [ex]);

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
    const min = Math.max(1, range[0]); const max = Math.max(min + 0.5, range[1]);
    const label = min >= 2 ? `${min.toFixed(0)}-${max.toFixed(0)}×/нед` : `${min.toFixed(0)}-${max.toFixed(0)}×/нед`;
    return { min, max, label, group: g, globalFreq: min >= 2.5 ? 'PPL / upper-lower' : 'upper-lower / fullbody' };
  }, [ex, level]);

  // Auto-progression
  const autoProgression = useMemo(() => {
    if (!ex || !presc || !workWeight) return null;
    const weeks: Array<{ w: number; sets: number; reps: string; rir: number; rest: number; weight: number; pct: number }> = [];
    for (let i = 0; i < 4; i++) {
      const w = Math.min(week + i, totalWeeks);
      try {
        const p = calcExercisePrescription(ex, goal, level, weakToggle, false, 1, w, totalWeeks);
        const r = parseInt(p.reps) || 5;
        const pc = 100 / (1 + r / 30);
        weeks.push({ w, sets: p.sets, reps: p.reps, rir: p.rir, rest: p.rest, weight: +(oneRM * pc / 100).toFixed(1), pct: Math.round(pc) });
      } catch { weeks.push({ w, sets: presc.sets, reps: presc.reps, rir: presc.rir + 1, rest: presc.rest, weight: workWeight, pct }); }
    }
    return weeks;
  }, [ex, presc, workWeight, goal, level, week, totalWeeks, oneRM]);

  // Fatigue analysis
  const fatigueAnalysis = useMemo(() => {
    if (!ex || !presc) return null;
    const isCompound = ex.type === 'compound';
    const js = ex.jointStress || 'medium';
    const baseFatigue = ex.fatigueCost || 5;
    const cnsBase = isCompound ? (js === 'high' ? 7 : 5) : 2;
    const cnsSetFactor = Math.min(presc.sets / 3, 1.5);
    const cnsRirPenalty = presc.rir <= 1 ? 1.2 : presc.rir >= 4 ? 0.6 : 1;
    const cnsDeload = isDeload ? 0.3 : 1;
    const cnsLoad = Math.min(10, +(cnsBase * cnsSetFactor * cnsRirPenalty * cnsDeload).toFixed(1));
    const muscBase = isCompound ? 4 : 7;
    const muscSetFactor = Math.min(presc.sets / 4, 1.6);
    const muscFatigueMult = baseFatigue / 5;
    const muscDeload = isDeload ? 0.35 : 1;
    const muscularLoad = Math.min(10, +(muscBase * muscSetFactor * muscFatigueMult * muscDeload).toFixed(1));
    const totalLoad = cnsLoad + muscularLoad;
    const recHours = Math.round((isCompound ? 48 : 24) * (totalLoad / 12) * (isDeload ? 0.5 : 1));
    let advice = '';
    if (cnsLoad >= 7) advice = 'Лимит — ЦНС. Восст. 48-72ч. Сон ≥8ч, минимизировать доп. работу на синергисты.';
    else if (muscularLoad >= 7) advice = 'Метаболический стресс. Восст. 24-48ч. Лёгкая ходьба, белок 2г/кг.';
    else if (totalLoad <= 4) advice = 'Низкое утомление. Можно ежедневно. Подходит для разминки/восстановления.';
    else advice = 'Умеренная нагрузка. Восст. 24-48ч. Не прибавляйте >10%/нед.';
    return { cnsLoad, muscularLoad, recoveryHours: recHours, cnsLabel: cnsLoad >= 7 ? 'Высокая (ЦНС)' : 'Умеренная', muscularLabel: muscularLoad >= 7 ? 'Высокая (мышцы)' : 'Умеренная', advice };
  }, [ex, presc, isDeload]);

  // Warm-up ramp
  const warmupRamp = useMemo(() => {
    if (!ex || !presc || !workWeight || workWeight <= 0) return null;
    const w = workWeight;
    const pcts = w >= 150 ? [0.3, 0.4, 0.5, 0.6, 0.7] : w >= 80 ? [0.35, 0.45, 0.55, 0.65] : [0.4, 0.55, 0.7];
    const steps = pcts.map((pct, i) => ({ pct: Math.round(pct * 100), weight: +(w * pct).toFixed(1), reps: isDeload ? 5 : Math.max(2, pcts.length - i + 2), label: i === 0 ? 'Пустой гриф / лёгкий' : i === pcts.length - 1 ? 'Подход-разминка' : 'Разминочный' }));
    return { steps, w };
  }, [ex, presc, workWeight, isDeload]);

  // Metabolic cost
  const metabolicCost = useMemo(() => {
    if (!ex || !presc || !tutInfo || !workWeight) return null;
    const bodyWeight = profile?.settings?.weight ?? 80;
    const isCompound = ex.type === 'compound';
    const met = isCompound ? 6.0 : 3.5;
    const avgReps = (parseInt(presc.reps.split('-')[0]) + parseInt(presc.reps.split('-')[1] || presc.reps.split('-')[0])) / 2;
    const timePerSetH = (avgReps * tutInfo.repDuration + 0.5) / 3600;
    const totalTimeH = timePerSetH * presc.sets;
    const totalCal = Math.round(met * bodyWeight * totalTimeH * 1.05);
    const glycogen = Math.round((isCompound ? 1.5 : 0.8) * presc.sets);
    const epoc = Math.round(totalCal * 0.12);
    return { totalCal, glycogen, epoc, met, totalTimeMin: Math.round(totalTimeH * 60) };
  }, [ex, presc, tutInfo, workWeight, profile]);

  // Exercise ranking
  const exerciseRanking = useMemo(() => {
    if (!ex) return null;
    const groupExs = EXERCISE_CATALOG.filter(e => e.group === ex.group && e.id !== ex.id).slice(0, 15);
    const scored = groupExs.map(e => {
      try {
        const p = calcExercisePrescription(e, goal, level, false, false, 1, week, totalWeeks);
        const rp = getResistanceProfile(e);
        const goalBonus = goal === 'hypertrophy' && rp.curve === 'stretch_mediated' ? 3 : goal === 'strength' && rp.curve === 'mid_range' ? 3 : 0;
        return { id: e.id, name: e.name, score: Math.min(100, Math.round(rp.score * 7 + goalBonus * 3 + (e.type === 'compound' ? 5 : 0))), type: e.type };
      } catch { return null; }
    }).filter((s): s is NonNullable<typeof s> => s !== null).sort((a, b) => b.score - a.score).slice(0, 8);
    const currentRp = resistanceProfile;
    const currentScore = currentRp ? Math.min(100, Math.round(currentRp.score * 7 + (ex.type === 'compound' ? 5 : 0))) : 50;
    const rank = scored.findIndex(s => s.score < currentScore);
    return { list: scored, currentScore, currentRank: rank === -1 ? scored.length + 1 : rank + 1, total: scored.length + 1 };
  }, [ex, goal, level, week, totalWeeks, resistanceProfile]);

  // Saved history
  const [savedCalcs, setSavedCalcs] = useState<Array<{ id: number; name: string; goal: string; level: string; week: number; oneRM: number; reps: string; sets: number; rir: number; rest: number; weight: number; date: string }>>(() => { try { return JSON.parse(localStorage.getItem('he_excalc_saved') || '[]'); } catch { return []; } });
  const [historyOpen, setHistoryOpen] = useState(false);
  const saveCalc = () => {
    if (!ex || !presc) return;
    const item = { id: Date.now(), name: ex.name, goal, level, week, oneRM, reps: presc.reps, sets: presc.sets, rir: presc.rir, rest: presc.rest, weight: workWeight, date: new Date().toISOString().slice(0, 10) };
    const arr: any[] = [item, ...(JSON.parse(localStorage.getItem('he_excalc_saved') || '[]'))];
    localStorage.setItem('he_excalc_saved', JSON.stringify(arr.slice(0, 30)));
    setSavedCalcs(arr.slice(0, 30));
  };

  const exportText = () => {
    if (!ex || !presc) return;
    const lines = [
      `=== Калькулятор: ${ex.name} ===`, `${GROUP_RU[ex.group]} · ${TYPE_RU[ex.type]} · ${level} · ${goal}`,
      `1ПМ: ${oneRM} кг · Вес: ${workWeight} кг (${pct}%) · ${presc.sets}×${presc.reps} · RIR ${presc.rir} · RPE ${rpeInfo?.rpe}/10 · Отдых ${presc.rest}с`,
      `Объём: ${(volumeLoad / 1000).toFixed(1)}k кг · Утомление: ${fatigueScore}/20 · AMRAP: ~${amrapEstimate}`,
    ];
    if (resistanceProfile) lines.push(`Профиль: ${resistanceProfile.label} (${resistanceProfile.score}/10) · ${resistanceProfile.bestGoal}`);
    if (fatigueAnalysis) lines.push(`ЦНС: ${fatigueAnalysis.cnsLoad}/10 · Мышцы: ${fatigueAnalysis.muscularLoad}/10 · Восст.: ${fatigueAnalysis.recoveryHours}ч`);
    if (metabolicCost) lines.push(`Метаболизм: ${metabolicCost.totalCal} ккал · Гликоген: ${metabolicCost.glycogen}г · EPOC: +${metabolicCost.epoc} ккал`);
    if (oneRMProjection) lines.push(`Прогноз 1ПМ: ${oneRMProjection.projected} кг (+${oneRMProjection.pctGain}%) через ${oneRMProjection.progressionWeeks} нед`);
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => {});
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#fff' }}>
      {/* ── QUICK GENERATOR ── */}
      <div onClick={() => setShowGenerator(v => !v)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 700, color: ACCENT }}>
        <span>{showGenerator ? '▲' : '▼'}</span> ⚡ Быстрый генератор упражнений
      </div>
      {showGenerator && (
        <div style={{ ...CARD, marginBottom: 12, border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 9, color: DIM, marginBottom: 2 }}>Группа мышц</div>
              <select value={genGroup} onChange={e => setGenGroup(e.target.value)}
                style={{ width: '100%', padding: '5px', borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11 }}>
                {['chest', 'back', 'legs', 'shoulders', 'arms', 'core'].map(g => <option key={g} value={g}>{GROUP_RU[g]}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: DIM, marginBottom: 2 }}>Цель</div>
              <select value={genGoal} onChange={e => setGenGoal(e.target.value)}
                style={{ width: '100%', padding: '5px', borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11 }}>
                <option value="bulk">Масса</option><option value="strength">Сила</option><option value="cut">Сушка</option>
                <option value="maintenance">Поддержание</option><option value="recomp">Рекомп</option>
                <option value="hypertrophy">Гипертрофия</option><option value="power">Взрывная</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: DIM, marginBottom: 2 }}>Уровень</div>
              <select value={genLevel} onChange={e => setGenLevel(e.target.value)}
                style={{ width: '100%', padding: '5px', borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11 }}>
                <option value="beginner">Новичок</option><option value="intermediate">Средний</option><option value="advanced">Опытный</option><option value="enhanced">Enhanced</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: DIM, marginBottom: 2 }}>Кол-во</div>
              <select value={genCount} onChange={e => setGenCount(parseInt(e.target.value))}
                style={{ width: '100%', padding: '5px', borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11 }}>
                {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          {genResult && genResult.length > 0 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 4, marginBottom: 4, fontSize: 8, color: DIM, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ flex: 1 }}>Упражнение</span>
                <span style={{ width: 30, textAlign: 'center' }}>Тип</span>
                <span style={{ width: 45, textAlign: 'center' }}>Сеты</span>
                <span style={{ width: 50, textAlign: 'center' }}>Повторы</span>
                <span style={{ width: 28, textAlign: 'center' }}>RIR</span>
                <span style={{ width: 45, textAlign: 'center' }}>Вес</span>
              </div>
              {genResult.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 4, marginBottom: 2, background: 'rgba(255,255,255,0.02)', fontSize: 9, cursor: 'pointer' }}
                  onClick={() => { setGroup(r.group); setExId(EXERCISE_CATALOG.find(e => e.name === r.name)?.id || ''); setGoal(r.rir <= 2 ? 'strength' : r.rir <= 4 ? 'hypertrophy' : 'endurance'); }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>{r.name}</span>
                  <span style={{ width: 30, textAlign: 'center', fontSize: 7, color: DIM }}>{r.type === 'compound' ? 'Базовое' : 'Изол.'}</span>
                  <span style={{ width: 45, textAlign: 'center', color: ACCENT, fontWeight: 700 }}>{r.sets}</span>
                  <span style={{ width: 50, textAlign: 'center', color: ACCENT, fontWeight: 600 }}>{r.reps}</span>
                  <span style={{ width: 28, textAlign: 'center', color: DIM }}>{r.rir}</span>
                  <span style={{ width: 45, textAlign: 'center', color: '#60a5fa' }}>{r.weight} кг</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 10, color: DIM, fontSize: 10 }}>Нет упражнений для выбранной группы</div>
          )}
        </div>
      )}

      {/* ── DETAILED CALCULATOR ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 10 }}>
        <PopupSelect label="Группа мышц" value={group} options={GROUPS.map(g => ({ id: g, label: GROUP_RU[g], desc: '' }))} hint="Группа" onChange={v => { setGroup(v); setExId(''); }} />
        {group !== 'all' && REGION_MAP[group] && (
          <PopupSelect label="Регион" value={region} options={REGION_MAP[group].map(r => ({ id: r.id, label: r.label, desc: r.desc }))} hint="Регион" onChange={v => setRegion(v)} />
        )}
        <PopupSelect label="Упражнение" value={exId} options={exList.map(e => ({ id: e.id, label: e.name, desc: `${e.group} · ${TYPE_RU[e.type] || e.type}` }))} hint="Поиск" onChange={v => setExId(v)} />
        <PopupSelect label="Цель" value={goal} options={[
          { id: 'strength', label: 'Сила', desc: '3-5 повт' }, { id: 'hypertrophy', label: 'Гипертрофия', desc: '8-12 повт' },
          { id: 'endurance', label: 'Выносливость', desc: '15-20+ повт' }, { id: 'power', label: 'Взрывная', desc: '2-3 повт' },
        ]} onChange={v => setGoal(v)} />
        <PopupNumber label="Неделя" value={week} min={1} max={52} step={1} onChange={v => setWeek(v)} />
        <PopupNumber label="Всего недель" value={totalWeeks} min={1} max={52} step={1} onChange={v => setTotalWeeks(v)} />
        <PopupNumber label="1RM (кг)" value={oneRM} min={0} max={500} step={0.5} onChange={v => setOneRM(v)} />
        <PopupText label="Темп (опц.)" value={manualTempo} placeholder="3-1-1-0" hint="ECC-BOT-CON-TOP" onChange={(v: string) => setManualTempo(v)} />
        <PopupSelect label="Уровень" value={level} options={[
          { id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' }, { id: 'advanced', label: 'Продвинутый' },
        ]} onChange={v => setLevel(v as any)} />
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setWeakToggle(v => !v)}
          style={{ padding: '6px 12px', borderRadius: 6, border: weakToggle ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.15)', background: weakToggle ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.04)', color: weakToggle ? ACCENT : DIM, cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>
          🎯 Слабая группа {weakToggle ? '(вкл)' : '(выкл)'}
        </button>
        {isDeload && <span style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 11, fontWeight: 700 }}>⚠ ДЕЛОАД (фаза {phase})</span>}
      </div>

      {!ex ? (
        <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Выберите упражнение выше или используйте быстрый генератор.</div>
      ) : (
        <>
          {/* Metric grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6 }}>
            <MetricCard title="Вес" icon="🔸" accent={ACCENT}><div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{workWeight}</div><div style={{ ...SMALL }}>кг ({pct}% 1ПМ)</div></MetricCard>
            <MetricCard title="Повторения" icon="🔸" accent={ACCENT}><div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.reps ?? '-'}</div><div style={{ ...SMALL }}>диапазон</div></MetricCard>
            <MetricCard title="Подходы" icon="🔚" accent={ACCENT}><div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.sets ?? '-'}</div><div style={{ ...SMALL }}>рабочих</div></MetricCard>
            <MetricCard title="RIR" icon="🔸" accent={ACCENT}><div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.rir ?? '-'}</div><div style={{ ...SMALL }}>повт в запасе</div></MetricCard>
            <MetricCard title="RPE" icon="🔸" accent={ACCENT}><div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{rpeInfo?.rpe ?? '-'}/10</div><div style={{ ...SMALL }}>{rpeInfo?.label ?? '—'}</div></MetricCard>
            <MetricCard title="Отдых" icon="⏱" accent={ACCENT}><div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.rest ?? '-'}</div><div style={{ ...SMALL }}>сек</div></MetricCard>
            <MetricCard title="Объём" icon="📊" accent="#60a5fa"><div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{(volumeLoad / 1000).toFixed(1)}k</div><div style={{ ...SMALL }}>кг (с×п×в)</div></MetricCard>
            <MetricCard title="Утомление" icon="⚡" accent="#f59e0b"><div style={{ fontSize: 18, fontWeight: 800, color: fatigueScore > 12 ? '#ef4444' : fatigueScore > 8 ? '#f59e0b' : '#22c55e' }}>{fatigueScore}</div><div style={{ ...SMALL }}>из 20</div></MetricCard>
          </div>

          {/* TUT */}
          {tutInfo && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(96,165,250,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>⏱ TUT (Время под нагрузкой)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6 }}>
                <div><span style={{ ...SMALL }}>Темп</span><div style={{ fontSize: 13, fontWeight: 700 }}>{manualTempo || presc?.tempo || '—'}</div></div>
                <div><span style={{ ...SMALL }}>Повторение</span><div style={{ fontSize: 13, fontWeight: 700 }}>{tutInfo.repDuration}с</div></div>
                <div><span style={{ ...SMALL }}>Подход</span><div style={{ fontSize: 13, fontWeight: 700 }}>{tutInfo.perSet}с</div></div>
                <div><span style={{ ...SMALL }}>Сессия</span><div style={{ fontSize: 13, fontWeight: 700 }}>{tutInfo.perSession}с</div></div>
              </div>
            </div>
          )}

          {/* AMRAP */}
          {amrapEstimate > 0 && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(168,85,247,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>🔄 AMRAP (макс. повторений)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#a855f7' }}>~{amrapEstimate}</div>
              <div style={{ ...SMALL }}>повторений при {workWeight} кг · Рабочие: {presc?.reps ?? '—'}</div>
            </div>
          )}

          {/* 1RM projection */}
          {oneRMProjection && oneRMProjection.progressionWeeks > 0 && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>📈 Прогноз 1ПМ</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <div><div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{oneRMProjection.projected} кг</div><div style={{ ...SMALL }}>через {oneRMProjection.progressionWeeks} нед</div></div>
                <div style={{ ...SMALL }}>Текущий: {oneRMProjection.current} кг · +{oneRMProjection.weeklyRate} кг/нед · +{oneRMProjection.pctGain}%</div>
              </div>
            </div>
          )}

          {/* Resistance profile */}
          {resistanceProfile && (
            <div style={{ ...CARD, marginTop: 10, border: `1px solid ${resistanceProfile.curve === 'stretch_mediated' ? 'rgba(34,197,94,0.3)' : 'rgba(96,165,250,0.3)'}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: resistanceProfile.curve === 'stretch_mediated' ? '#22c55e' : '#60a5fa', marginBottom: 4 }}>📐 Профиль сопротивления</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: resistanceProfile.curve === 'stretch_mediated' ? '#22c55e' : '#60a5fa' }}>{resistanceProfile.score}/10</div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 12 }}>{resistanceProfile.label}</div><div style={{ ...SMALL, fontSize: 9 }}>{resistanceProfile.desc}</div></div>
              </div>
            </div>
          )}

          {/* Difficulty scaler */}
          {difficultyScaler && difficultyScaler.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(168,85,247,0.04)', borderRadius: 8, border: '1px solid rgba(168,85,247,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>📊 Шкала сложности</div>
              {difficultyScaler.map((d: any, i: number) => (
                <div key={i} style={{ padding: '8px 10px', borderRadius: 6, marginBottom: 4, background: d.diff === 'easier' ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${d.diff === 'easier' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`, borderLeft: `3px solid ${d.diff === 'easier' ? '#22c55e' : '#f59e0b'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>{d.name}</span>
                    <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 600, background: d.diff === 'easier' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: d.diff === 'easier' ? '#22c55e' : '#f59e0b' }}>{d.diff === 'easier' ? '⬇ Упрощение' : '⬆ Усложнение'}</span>
                  </div>
                  <div style={{ ...SMALL, fontSize: 9, marginTop: 2 }}>{d.how}</div>
                </div>
              ))}
            </div>
          )}

          {/* Frequency */}
          {freqRecommendation && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>📅 Рекомендация частоты</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{freqRecommendation.label}</div>
              <div style={{ ...SMALL }}>Сплит: {freqRecommendation.globalFreq}</div>
            </div>
          )}

          {/* Auto-progression */}
          {autoProgression && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 6 }}>📈 Прогрессия на 4 недели</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
                {autoProgression.map((w, i) => (
                  <div key={i} style={{ textAlign: 'center', padding: 8, background: 'rgba(0,0,0,0.12)', borderRadius: 6, border: i === 0 ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 9, color: DIM }}>Нед {w.w}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, margin: '2px 0' }}>{w.sets}×{w.reps}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>{w.weight} кг</div>
                    <div style={{ fontSize: 9, color: DIM }}>RIR {w.rir} · {(w.pct)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Fatigue analysis */}
          {fatigueAnalysis && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>⚡ Анализ утомления</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6 }}>
                <div><span style={{ ...SMALL }}>ЦНС</span><div style={{ fontSize: 16, fontWeight: 700, color: fatigueAnalysis.cnsLoad >= 7 ? '#ef4444' : fatigueAnalysis.cnsLoad >= 4 ? '#f59e0b' : '#22c55e' }}>{fatigueAnalysis.cnsLoad}/10</div><div style={{ ...SMALL, fontSize: 9 }}>{fatigueAnalysis.cnsLabel}</div></div>
                <div><span style={{ ...SMALL }}>Мышцы</span><div style={{ fontSize: 16, fontWeight: 700, color: fatigueAnalysis.muscularLoad >= 7 ? '#ef4444' : fatigueAnalysis.muscularLoad >= 4 ? '#f59e0b' : '#22c55e' }}>{fatigueAnalysis.muscularLoad}/10</div><div style={{ ...SMALL, fontSize: 9 }}>{fatigueAnalysis.muscularLabel}</div></div>
                <div><span style={{ ...SMALL }}>Восст.</span><div style={{ fontSize: 16, fontWeight: 700, color: '#60a5fa' }}>{fatigueAnalysis.recoveryHours}ч</div><div style={{ ...SMALL, fontSize: 9 }}>до след. тяжёлой</div></div>
              </div>
              <div style={{ ...SMALL, fontSize: 9, marginTop: 4, lineHeight: 1.3 }}>{fatigueAnalysis.advice}</div>
            </div>
          )}

          {/* Warm-up ramp */}
          {warmupRamp && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(251,146,60,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', marginBottom: 4 }}>🔥 Разминочная рампа</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {warmupRamp.steps.map((s, i) => (
                  <div key={i} style={{ flex: '1 0 60px', textAlign: 'center', padding: 6, background: 'rgba(0,0,0,0.15)', borderRadius: 6, border: `1px solid ${i === warmupRamp.steps.length - 1 ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.04)'}` }}>
                    <div style={{ fontSize: 8, color: DIM }}>{s.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{s.weight} кг</div>
                    <div style={{ fontSize: 9, color: DIM }}>{s.pct}% · {s.reps} повт</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metabolic cost */}
          {metabolicCost && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(251,146,60,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', marginBottom: 4 }}>⚡ Метаболическая стоимость</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6 }}>
                <div><span style={{ ...SMALL }}>Калорий</span><div style={{ fontSize: 14, fontWeight: 700, color: '#fb923c' }}>~{metabolicCost.totalCal}</div></div>
                <div><span style={{ ...SMALL }}>Гликоген</span><div style={{ fontSize: 14, fontWeight: 700 }}>~{metabolicCost.glycogen}г</div></div>
                <div><span style={{ ...SMALL }}>EPOC</span><div style={{ fontSize: 14, fontWeight: 700 }}>+{metabolicCost.epoc} ккал</div></div>
                <div><span style={{ ...SMALL }}>MET</span><div style={{ fontSize: 14, fontWeight: 700, color: DIM }}>{metabolicCost.met}</div></div>
                <div><span style={{ ...SMALL }}>Время</span><div style={{ fontSize: 14, fontWeight: 700, color: DIM }}>~{metabolicCost.totalTimeMin}м</div></div>
              </div>
            </div>
          )}

          {/* Exercise ranking */}
          {exerciseRanking && exerciseRanking.list.length > 0 && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>🏅 Рейтинг в группе «{GROUP_RU[ex!.group]}» (цель: {goal === 'hypertrophy' ? 'гипертрофия' : goal})</div>
              <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Позиция: <b style={{ color: ACCENT }}>#{exerciseRanking.currentRank}</b> из {exerciseRanking.total} · score: {exerciseRanking.currentScore}</div>
              {exerciseRanking.list.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', borderRadius: 4, marginBottom: 2, background: item.id === ex!.id ? 'rgba(0,230,138,0.08)' : 'transparent', fontSize: 9 }}>
                  <span style={{ color: item.id === ex!.id ? ACCENT : DIM }}>#{i + 1} {item.name}</span>
                  <span style={{ color: DIM }}>{item.type === 'compound' ? 'База' : 'Изол.'} · {item.score} pts</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions: save / export */}
          {ex && presc && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button onClick={saveCalc} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>💾 Сохранить расчёт</button>
              <button onClick={exportText} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)', color: '#60a5fa', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>📋 Копировать отчёт</button>
              <button onClick={() => setHistoryOpen(v => !v)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.06)', color: '#a855f7', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>📂 История ({savedCalcs.length})</button>
            </div>
          )}

          {/* Saved history */}
          {historyOpen && savedCalcs.length > 0 && (
            <div style={{ ...CARD, marginTop: 10, border: '1px solid rgba(168,85,247,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>📂 Сохранённые расчёты (последние {savedCalcs.length})</div>
              {savedCalcs.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderRadius: 4, marginBottom: 2, background: 'rgba(255,255,255,0.02)', fontSize: 9, cursor: 'pointer' }}
                  onClick={() => { const found = EXERCISE_CATALOG.find(e => e.name === s.name); if (found) { setGroup(found.group); setExId(found.id); setGoal(s.goal); setWeek(s.week); setOneRM(s.oneRM); } }}>
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span style={{ color: DIM }}>{s.date} · {s.sets}×{s.reps} · RIR {s.rir} · {s.weight} кг</span>
                  <button onClick={e => { e.stopPropagation(); try { const arr = (JSON.parse(localStorage.getItem('he_excalc_saved') || '[]') as any[]).filter((x: any) => x.id !== s.id); localStorage.setItem('he_excalc_saved', JSON.stringify(arr)); setSavedCalcs(arr); } catch {} }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ════════════════ TECHNIQUE SUB-TAB ════════════════
const TechniqueTab: React.FC<{ onSelectForCompare: (id: string) => void }> = ({ onSelectForCompare }) => {
  const [group, setGroup] = useState('chest');
  const [viewMode, setViewMode] = useState<'subregion' | 'list'>('subregion');
  const [expandedEx, setExpandedEx] = useState<string | null>(null);
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('he_elab_fav') || '[]'); } catch { return []; } });
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'compound' | 'isolation'>('all');
  const [filterDiff, setFilterDiff] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [filterEquip, setFilterEquip] = useState('all');
  const [filterJoint, setFilterJoint] = useState('all');

  const equipmentOptions = useMemo(() => { const set = new Set(EXERCISE_CATALOG.map(e => e.equipment)); return ['all', ...Array.from(set).sort()]; }, []);
  useEffect(() => { try { localStorage.setItem('he_elab_fav', JSON.stringify(favorites)); } catch {} }, [favorites]);

  const toggleFav = (id: string) => setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleExpandEx = (id: string) => setExpandedEx(prev => prev === id ? null : id);
  const toggleRegion = (id: string) => setExpandedRegion(prev => prev === id ? null : id);

  const subregions = SUBREGION_DEFS[group] || [];
  const groupedExercises = useMemo(() => {
    const allGroupExs = EXERCISE_CATALOG.filter(e => e.group === group);
    return subregions.map(sr => ({
      ...sr,
      exercises: allGroupExs.filter(ex => {
        const tm = (ex.targetMuscle || '').toLowerCase();
        return sr.keywords.some(kw => tm.includes(kw.toLowerCase()));
      }).map(ex => {
        const map = getMappedIds(ex.id);
        const lookupId = map.bio || map.movement || ex.id;
        return {
          exercise: ex,
          bio: getExerciseBio(lookupId),
          technique: getTechnique(ex.name),
          score: calcTechniqueScore(ex),
          cues: getCues(ex.name),
          errors: getErrorsForExercise(ex.name),
          progression: getProgression(ex.name),
          synergy: getMuscleSynergy(map.synergy || lookupId),
          jointStress: getJointStress(map.joint || lookupId),
          difficultyProfile: estimateDifficulty(lookupId),
          classification: classifyMovement(map.movement || lookupId),
          fVector: forceVector(ex.group, ex.type, ex.name),
          lengthened: lengthenedPartials(ex.group),
        };
      }),
    })).filter(sr => sr.exercises.length > 0);
  }, [group, subregions]);

  // Flat list mode
  const flatList = useMemo(() => {
    let list = EXERCISE_CATALOG.filter(e => e.group === group);
    if (search.trim()) { const s = search.toLowerCase(); list = list.filter(e => e.name.toLowerCase().includes(s) || (e.targetMuscle || '').toLowerCase().includes(s)); }
    if (filterType !== 'all') list = list.filter(e => e.type === filterType);
    if (filterDiff !== 'all') list = list.filter(e => e.difficulty === filterDiff);
    if (filterEquip !== 'all') list = list.filter(e => e.equipment === filterEquip);
    if (filterJoint !== 'all') list = list.filter(e => { const bio = getExerciseBio(e.id); return bio ? (bio.jointStress as any)[filterJoint] <= 4 : e.jointStress !== 'high' || filterJoint !== 'spine'; });
    if (showFavOnly) list = list.filter(e => favorites.includes(e.id));
    return list.map(ex => {
      const map = getMappedIds(ex.id);
      const lookupId = map.bio || map.movement || ex.id;
      return {
        exercise: ex,
        bio: getExerciseBio(lookupId),
        technique: getTechnique(ex.name),
        score: calcTechniqueScore(ex),
        cues: getCues(ex.name),
        errors: getErrorsForExercise(ex.name),
        progression: getProgression(ex.name),
        synergy: getMuscleSynergy(map.synergy || lookupId),
        jointStress: getJointStress(map.joint || lookupId),
        difficultyProfile: estimateDifficulty(lookupId),
        classification: classifyMovement(map.movement || lookupId),
        fVector: forceVector(ex.group, ex.type, ex.name),
        lengthened: lengthenedPartials(ex.group),
      };
    });
  }, [group, search, filterType, filterDiff, filterEquip, filterJoint, showFavOnly, favorites]);

  const totalInGroup = EXERCISE_CATALOG.filter(e => e.group === group).length;
  const totalCategorized = groupedExercises.reduce((s, sr) => s + sr.exercises.length, 0);

  const renderExHeader = (ex: Exercise, score: TechniqueScore, bio: any, isFav: boolean, safety: any) => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{ex.name}</span>
            <button onClick={e => { e.stopPropagation(); toggleFav(ex.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, color: isFav ? '#f59e0b' : DIM }}>{isFav ? '★' : '☆'}</button>
            <button onClick={e => { e.stopPropagation(); onSelectForCompare(ex.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '2px 4px', color: DIM, fontWeight: 700 }} title="Добавить к сравнению">⇆</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3 }}>
            <span style={{ ...pill, background: ex.type === 'compound' ? 'rgba(0,230,138,0.15)' : 'rgba(59,130,246,0.15)', color: ex.type === 'compound' ? ACCENT : '#60a5fa' }}>{TYPE_RU[ex.type] || ex.type}</span>
            <span style={{ ...pill, background: 'rgba(168,85,247,0.12)', color: '#c084fc' }}>{EQUIP_RU[ex.equipment] || ex.equipment}</span>
            <span style={{ ...pill, background: ex.difficulty === 'beginner' ? 'rgba(34,197,94,0.12)' : ex.difficulty === 'advanced' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: ex.difficulty === 'beginner' ? '#22c55e' : ex.difficulty === 'advanced' ? '#ef4444' : '#f59e0b' }}>{ex.difficulty === 'beginner' ? 'Новичок' : ex.difficulty === 'advanced' ? 'Продв.' : 'Средний'}</span>
            {ex.targetMuscle && <span style={{ ...pill, background: 'rgba(255,255,255,0.04)', color: DIM, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.targetMuscle}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 50 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `conic-gradient(${getRiskColor(score.level)} ${score.total * 3.6}deg, rgba(255,255,255,0.06) 0)`, margin: '0 auto' }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -1 }}>{score.total}</div>
          </div>
          <div style={{ fontSize: 7, color: getRiskColor(score.level), marginTop: 1, fontWeight: 700 }}>{score.label}</div>
        </div>
      </div>
      {ex.technique && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginTop: 6, fontStyle: 'italic' }}>
          {ex.technique.length > 140 ? ex.technique.slice(0, 140) + '…' : ex.technique}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 9 }}>
        <span>{getJointEmoji(ex.jointStress)} Суставы: {ex.jointStress === 'high' ? 'высокая' : ex.jointStress === 'med' ? 'средняя' : 'низкая'}</span>
        {bio && <span>🧠 ЦНС: {bio.cnsDemand}/5</span>}
        <span style={{ color: getRiskColor(safety.level) }}>{safety.level === 'safe' ? '✅ Безоп.' : safety.level === 'moderate' ? '⚠️ Вним.' : '🚫 Риск.'}</span>
        {ex.fatigueCost > 0 && <span style={{ color: DIM }}>⚡ Усталость: {ex.fatigueCost}/10</span>}
      </div>
    </>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#fff' }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={() => setViewMode('subregion')} style={filterBtn(viewMode === 'subregion')}>📐 По подрегионам</button>
        <button onClick={() => setViewMode('list')} style={filterBtn(viewMode === 'list')}>📋 Списком</button>
        <button onClick={() => setShowFavOnly(v => !v)} style={filterBtn(showFavOnly)}>⭐ Избранное ({favorites.length})</button>
      </div>

      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 10 }}>
        <PopupSelect label="Целевая группа" value={group} options={GROUPS.filter(g => g !== 'all').map(g => ({ id: g, label: `${GROUP_ICON[g] || ''} ${GROUP_RU[g]}`, desc: '' }))} hint="Группа" onChange={v => { setGroup(v); setExpandedEx(null); setExpandedRegion(null); }} />
        {viewMode === 'list' && (
          <>
            <div>
              <div style={{ fontSize: 9, color: DIM, fontWeight: 600, marginBottom: 2 }}>Поиск</div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Название…" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 11, boxSizing: 'border-box', width: '100%' }} />
            </div>
          </>
        )}
      </div>

      {viewMode === 'list' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: DIM, fontWeight: 600, marginRight: 2 }}>Тип:</span>
          {(['all', 'compound', 'isolation'] as const).map(t => <button key={t} onClick={() => setFilterType(t)} style={filterBtn(filterType === t)}>{t === 'all' ? 'Все' : TYPE_RU[t]}</button>)}
          <span style={{ fontSize: 9, color: DIM, fontWeight: 600, marginLeft: 8, marginRight: 2 }}>Уровень:</span>
          {(['all', 'beginner', 'intermediate', 'advanced'] as const).map(d => <button key={d} onClick={() => setFilterDiff(d)} style={filterBtn(filterDiff === d)}>{d === 'all' ? 'Все' : d === 'beginner' ? 'Новичок' : d === 'advanced' ? 'Продв.' : 'Средний'}</button>)}
          <span style={{ fontSize: 9, color: DIM, fontWeight: 600, marginLeft: 8, marginRight: 2 }}>Оборуд.:</span>
          <select value={filterEquip} onChange={e => setFilterEquip(e.target.value)} style={{ padding: '3px 8px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: DIM, fontSize: 10 }}>
            {equipmentOptions.map(eq => <option key={eq} value={eq}>{eq === 'all' ? 'Всё' : EQUIP_RU[eq] || eq}</option>)}
          </select>
          <span style={{ fontSize: 9, color: DIM, fontWeight: 600, marginLeft: 8, marginRight: 2 }}>Щадящий:</span>
          <select value={filterJoint} onChange={e => setFilterJoint(e.target.value)} style={{ padding: '3px 8px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: DIM, fontSize: 10 }}>
            <option value="all">Все</option><option value="spine">Позвоночник</option><option value="knee">Колени</option><option value="shoulder">Плечи</option><option value="elbow">Локти</option><option value="hip">Таз</option>
          </select>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>
        {viewMode === 'list' ? <>{flatList.length} из {totalInGroup} упражнений · {GROUP_RU[group]}{search ? ` · «${search}»` : ''}</> : <>{totalCategorized} из {totalInGroup} упражнений · {groupedExercises.length} подрегионов</>}
      </div>

      {/* SUB-REGION VIEW */}
      {viewMode === 'subregion' && groupedExercises.map((sr, srIdx) => {
        const filteredExs = showFavOnly ? sr.exercises.filter(e => favorites.includes(e.exercise.id)) : sr.exercises;
        if (filteredExs.length === 0) return null;
        const isRegionExpanded = expandedRegion === sr.id;
        return (
          <div key={sr.id} style={{ marginBottom: 16 }}>
            <div onClick={() => toggleRegion(sr.id)} style={{ ...CARD, cursor: 'pointer', border: `2px solid ${SUB_REGION_COLORS[srIdx % SUB_REGION_COLORS.length]}33`, borderLeft: `4px solid ${SUB_REGION_COLORS[srIdx % SUB_REGION_COLORS.length]}`, marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: SUB_REGION_COLORS[srIdx % SUB_REGION_COLORS.length], marginBottom: 4 }}>{sr.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{sr.description}</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 70 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: SUB_REGION_COLORS[srIdx % SUB_REGION_COLORS.length] }}>{filteredExs.length}</div>
                  <div style={{ fontSize: 9, color: DIM }}>упражнений</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button style={{ padding: '3px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>{isRegionExpanded ? '▲ Свернуть' : '▼ Развернуть'}</button>
              </div>
            </div>
            {isRegionExpanded && (
              <div style={{ paddingLeft: 8, marginTop: 4 }}>
                {filteredExs.map(({ exercise: ex, bio, technique, score, cues, errors, progression, synergy, jointStress, classification, fVector, lengthened }) => {
                  const isExpanded = expandedEx === ex.id;
                  const safety = assessSafety(ex.id, [], score.total / 100);
                  const isFav = favorites.includes(ex.id);
                  return (
                    <div key={ex.id} style={{ ...CARD, border: isExpanded ? '1px solid rgba(0,230,138,0.2)' : CARD.border, marginLeft: 4 }}>
                      <div onClick={() => toggleExpandEx(ex.id)} style={{ cursor: 'pointer' }}>
                        {renderExHeader(ex, score, bio, isFav, safety)}
                      </div>
                      {isExpanded && <TechniqueDetail ex={ex} technique={technique} score={score} cues={cues} errors={errors} progression={progression} synergy={synergy} jointStress={jointStress} classification={classification} fVector={fVector} lengthened={lengthened} safety={safety} bio={bio} cssScale={0.9} />}
                      <div style={{ marginTop: isExpanded ? 10 : 4, textAlign: 'center', display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => toggleExpandEx(ex.id)} style={{ padding: '3px 14px', borderRadius: 14, border: '1px solid rgba(0,230,138,0.15)', background: isExpanded ? 'rgba(0,230,138,0.06)' : 'transparent', color: isExpanded ? ACCENT : DIM, cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>{isExpanded ? '▲ Свернуть' : '▼ Разбор'}</button>
                        {isExpanded && <>
                          <button onClick={() => { const el = document.getElementById(`elab-t-${ex.id}`); if (el) { const w = window.open('', '_blank', 'width=800,height=600'); if (w) { w.document.write(`<html><head><title>${ex.name} - Техника</title><style>body{font-family:sans-serif;font-size:12px;line-height:1.6;padding:20px;color:#000;background:#fff}h2{color:#333}</style></head><body>${el.innerHTML}</body></html>`); w.document.close(); setTimeout(() => w.print(), 300); } } }} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 600, fontSize: 9 }}>🖨 Печать</button>
                          <button onClick={() => { navigator.clipboard.writeText(document.getElementById(`elab-t-${ex.id}`)?.innerText || ''); }} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)', color: '#60a5fa', cursor: 'pointer', fontWeight: 600, fontSize: 9 }}>📋 Копировать</button>
                        </>}
                      </div>
                      {isExpanded && <div id={`elab-t-${ex.id}`} style={{ display: 'none' }}>
                        <h2>{ex.name}</h2><p>Тип: {TYPE_RU[ex.type]} · Оборудование: {EQUIP_RU[ex.equipment]} · Сложность: {score.label} ({score.total}/100)</p>
                        {technique && <><p><b>Исходное положение:</b></p><ul>{technique.setup.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul><p><b>Выполнение:</b></p><ul>{technique.execution.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul><p><b>Дыхание:</b></p><ul>{technique.breathing.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></>}
                        {errors.length > 0 && <><p><b>Ошибки:</b></p><ul>{errors.map((e: any, i: number) => <li key={i}><b>{e.error}</b> — {e.fix}</li>)}</ul></>}
                        <p>Безопасность: {safety.score}/100 {safety.requiresSpotter ? '(требуется споттер)' : ''}</p>
                      </div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* LIST VIEW */}
      {viewMode === 'list' && [...flatList].sort((a, b) => b.score.total - a.score.total).map(({ exercise: ex, bio, technique, score, cues, errors, progression, synergy, jointStress, classification, fVector, lengthened }) => {
        const isExpanded = expandedEx === ex.id;
        const safety = assessSafety(ex.id, [], score.total / 100);
        const isFav = favorites.includes(ex.id);
        return (
          <div key={ex.id} style={{ ...CARD, border: isExpanded ? '1px solid rgba(0,230,138,0.25)' : CARD.border, boxShadow: isExpanded ? '0 0 12px rgba(0,230,138,0.06)' : undefined, marginBottom: 8 }}>
            <div onClick={() => toggleExpandEx(ex.id)} style={{ cursor: 'pointer' }}>
              {renderExHeader(ex, score, bio, isFav, safety)}
            </div>
            {isExpanded && <TechniqueDetail ex={ex} technique={technique} score={score} cues={cues} errors={errors} progression={progression} synergy={synergy} jointStress={jointStress} classification={classification} fVector={fVector} lengthened={lengthened} safety={safety} bio={bio} />}
            <div style={{ marginTop: isExpanded ? 10 : 4, textAlign: 'center', display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => toggleExpandEx(ex.id)} style={{ padding: '3px 14px', borderRadius: 14, border: '1px solid rgba(0,230,138,0.15)', background: isExpanded ? 'rgba(0,230,138,0.06)' : 'transparent', color: isExpanded ? ACCENT : DIM, cursor: 'pointer', fontSize: 9, fontWeight: 600 }}>{isExpanded ? '▲ Свернуть разбор' : '▼ Развернуть разбор'}</button>
              {isExpanded && <>
                <button onClick={() => { const el = document.getElementById(`elab-l-${ex.id}`); if (el) { const w = window.open('', '_blank', 'width=800,height=600'); if (w) { w.document.write(`<html><head><title>${ex.name} - Техника</title><style>body{font-family:sans-serif;font-size:12px;line-height:1.6;padding:20px}</style></head><body>${el.innerHTML}</body></html>`); w.document.close(); setTimeout(() => w.print(), 300); } } }} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 600, fontSize: 9 }}>🖨 Печать</button>
                <button onClick={() => { navigator.clipboard.writeText(document.getElementById(`elab-l-${ex.id}`)?.innerText || ''); }} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)', color: '#60a5fa', cursor: 'pointer', fontWeight: 600, fontSize: 9 }}>📋 Копировать</button>
              </>}
            </div>
            {isExpanded && <div id={`elab-l-${ex.id}`} style={{ display: 'none' }}>
              <h2>{ex.name}</h2><p>Тип: {TYPE_RU[ex.type]} · Сложность: {score.label} ({score.total}/100)</p>
              {technique && <><p><b>Техника:</b></p><ul>{technique.setup.map((s: string, i: number) => <li key={i}>{s}</li>)}{technique.execution.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></>}
              <p>Безопасность: {safety.score}/100</p>
            </div>}
          </div>
        );
      })}

      {groupedExercises.length === 0 && flatList.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: DIM, fontSize: 12 }}>В этой группе нет упражнений с указанной целевой мышцей.</div>
      )}
    </div>
  );
};

// ════════════════ COMPARE SUB-TAB ════════════════
const CompareTab: React.FC<{ initialId1: string; initialId2: string }> = ({ initialId1, initialId2 }) => {
  const [id1, setId1] = useState(initialId1);
  const [id2, setId2] = useState(initialId2 || '');
  const { profile } = useDataLink();
  const [goal, setGoal] = useState('hypertrophy');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');

  const ex1 = useMemo(() => EXERCISE_CATALOG.find(e => e.id === id1), [id1]);
  const ex2 = useMemo(() => EXERCISE_CATALOG.find(e => e.id === id2), [id2]);
  const allExs = EXERCISE_CATALOG;

  useEffect(() => {
    if (!profile) return;
    const lvl = profile?.settings.trainingLevel ?? 'intermediate';
    setLevel((lvl === 'enhanced' ? 'advanced' : lvl) as any);
    setGoal(profile?.settings.primaryGoal ?? 'hypertrophy');
  }, [profile]);

  const getExData = (ex: Exercise | undefined) => {
    if (!ex) return null;
    const presc = calcExercisePrescription(ex, goal, level, false, false, 1);
    const map = getMappedIds(ex.id);
    const lookupId = map.bio || map.movement || ex.id;
    const score = calcTechniqueScore(ex);
    const safety = assessSafety(ex.id, [], score.total / 100);
    return {
      exercise: ex,
      presc,
      bio: getExerciseBio(lookupId),
      technique: getTechnique(ex.name),
      score,
      cues: getCues(ex.name),
      errors: getErrorsForExercise(ex.name),
      progression: getProgression(ex.name),
      synergy: getMuscleSynergy(map.synergy || lookupId),
      jointStress: getJointStress(map.joint || lookupId),
      classification: classifyMovement(map.movement || lookupId),
      fVector: forceVector(ex.group, ex.type, ex.name),
      lengthened: lengthenedPartials(ex.group),
      safety,
    };
  };

  const d1 = useMemo(() => getExData(ex1), [ex1, goal, level]);
  const d2 = useMemo(() => getExData(ex2), [ex2, goal, level]);

  const renderColumn = (d: any, color: string) => {
    if (!d) return <div style={{ flex: 1, textAlign: 'center', color: DIM, padding: 20 }}>Выберите упражнение</div>;
    const { exercise: ex, presc, score, safety } = d;
    return (
      <div style={{ flex: 1, minWidth: 200, ...CARD, border: `1px solid ${color}33` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 6 }}>{ex.name}</div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>
          {TYPE_RU[ex.type]} · {EQUIP_RU[ex.equipment]} · {ex.difficulty === 'beginner' ? 'Новичок' : ex.difficulty === 'advanced' ? 'Продвинутый' : 'Средний'}
        </div>
        {/* Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `conic-gradient(${getRiskColor(score.level)} ${score.total * 3.6}deg, rgba(255,255,255,0.06) 0)` }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{score.total}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{score.label}</div>
            <div style={{ fontSize: 9, color: DIM }}>технический счёт</div>
          </div>
        </div>
        {/* Prescription */}
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
          <div>📐 Сеты: <b>{presc.sets}</b> · Повторы: <b>{presc.reps}</b></div>
          <div>🎯 RIR: <b>{presc.rir}</b> · Отдых: <b>{presc.rest}с</b></div>
          <div>⚡ ЦНС: <b>{d.bio?.cnsDemand || '—'}/5</b> · Суставы: <b>{ex.jointStress === 'high' ? 'высокая' : ex.jointStress === 'med' ? 'средняя' : 'низкая'}</b></div>
          <div>🛡 Безоп.: <b style={{ color: getRiskColor(safety.level) }}>{safety.score}/100</b> · {safety.level === 'safe' ? '✅' : safety.level === 'moderate' ? '⚠️' : '🚫'}</div>
        </div>
        {/* Comparison highlight */}
        {d1 && d2 && d === d1 && (
          <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', fontSize: 9, lineHeight: 1.4 }}>
            {ex1!.type !== ex2!.type && <div>📌 Разные типы: {TYPE_RU[ex1!.type]} vs {TYPE_RU[ex2!.type]} — {ex1!.type === 'compound' ? 'база для общей стимуляции' : 'изоляция для целевой мышцы'}</div>}
            {ex1!.jointStress !== ex2!.jointStress && <div>🦴 Нагрузка на суставы: {ex1!.jointStress} vs {ex2!.jointStress} — {ex1!.jointStress === 'high' ? 'выше у 1-го' : 'выше у 2-го'}</div>}
            {d1.bio?.cnsDemand !== d2.bio?.cnsDemand && <div>🧠 ЦНС-нагрузка: {d1.bio?.cnsDemand} vs {d2.bio?.cnsDemand}</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#fff' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <PopupSelect label="Упражнение A" value={id1} options={allExs.map(e => ({ id: e.id, label: e.name, desc: `${GROUP_RU[e.group] || e.group} · ${TYPE_RU[e.type] || e.type}` }))} hint="Первое" onChange={v => setId1(v)} />
        <PopupSelect label="Упражнение B" value={id2} options={allExs.map(e => ({ id: e.id, label: e.name, desc: `${GROUP_RU[e.group] || e.group} · ${TYPE_RU[e.type] || e.type}` }))} hint="Второе" onChange={v => setId2(v)} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <PopupSelect label="" value={goal} options={[
            { id: 'strength', label: 'Сила' }, { id: 'hypertrophy', label: 'Гипертрофия' }, { id: 'endurance', label: 'Выносливость' }, { id: 'power', label: 'Взрывная' },
          ]} onChange={v => setGoal(v)} />
          <PopupSelect label="" value={level} options={[
            { id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' }, { id: 'advanced', label: 'Продвинутый' },
          ]} onChange={v => setLevel(v as any)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {renderColumn(d1, ACCENT)}
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 20, color: DIM, fontWeight: 800, padding: '0 6px' }}>vs</div>
        {renderColumn(d2, '#60a5fa')}
      </div>

      {/* Full technique comparison */}
      {d1 && d2 && (
        <>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 10 }}>🔬 Сравнение техники</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ ...CARD, border: `1px solid ${ACCENT}22` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>{ex1!.name}</div>
              <TechniqueDetail ex={ex1!} technique={d1.technique} score={d1.score} cues={d1.cues} errors={d1.errors} progression={d1.progression} synergy={d1.synergy} jointStress={d1.jointStress} classification={d1.classification} fVector={d1.fVector} lengthened={d1.lengthened} safety={d1.safety} bio={d1.bio} cssScale={0.85} />
            </div>
            <div style={{ ...CARD, border: `1px solid #60a5fa22` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>{ex2!.name}</div>
              <TechniqueDetail ex={ex2!} technique={d2.technique} score={d2.score} cues={d2.cues} errors={d2.errors} progression={d2.progression} synergy={d2.synergy} jointStress={d2.jointStress} classification={d2.classification} fVector={d2.fVector} lengthened={d2.lengthened} safety={d2.safety} bio={d2.bio} cssScale={0.85} />
            </div>
          </div>
        </div>

        {/* Winner recommendation */}
        <div style={{ ...CARD, marginTop: 12, border: `1px solid ${ACCENT}33`, background: 'rgba(0,230,138,0.04)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>🏆 Итоговая рекомендация</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>
            <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.12)' }}>
              <div style={{ fontWeight: 700, color: ACCENT, marginBottom: 4 }}>{ex1!.name}</div>
              <div>Тех. счёт: <b>{d1.score.total}/100</b></div>
              <div>Безопасность: <b style={{ color: getRiskColor(d1.safety.level) }}>{d1.safety.score}/100</b></div>
              <div>ЦНС: <b>{d1.bio?.cnsDemand || '?'}/5</b></div>
              <div>Объём: <b>{d1.presc.sets}×{d1.presc.reps}</b></div>
              <div>Профиль: <b>{getResistanceProfile(ex1!).curve.replace('_', ' ')}</b></div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.12)' }}>
              <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>{ex2!.name}</div>
              <div>Тех. счёт: <b>{d2.score.total}/100</b></div>
              <div>Безопасность: <b style={{ color: getRiskColor(d2.safety.level) }}>{d2.safety.score}/100</b></div>
              <div>ЦНС: <b>{d2.bio?.cnsDemand || '?'}/5</b></div>
              <div>Объём: <b>{d2.presc.sets}×{d2.presc.reps}</b></div>
              <div>Профиль: <b>{getResistanceProfile(ex2!).curve.replace('_', ' ')}</b></div>
            </div>
          </div>
          {(() => {
            const rp1 = getResistanceProfile(ex1!);
            const rp2 = getResistanceProfile(ex2!);
            let winner: 1 | 2 = 1; let reason = '';
            if (goal === 'hypertrophy') {
              if (rp1.curve === 'stretch_mediated' && rp2.curve !== 'stretch_mediated') { winner = 1; reason = 'stretch-mediated профиль лучше для гипертрофии'; }
              else if (rp2.curve === 'stretch_mediated' && rp1.curve !== 'stretch_mediated') { winner = 2; reason = 'stretch-mediated профиль лучше для гипертрофии'; }
              else if (rp1.score > rp2.score) { winner = 1; reason = 'выше resistance-оценка'; }
              else if (rp2.score > rp1.score) { winner = 2; reason = 'выше resistance-оценка'; }
              else { winner = d1.score.total > d2.score.total ? 1 : 2; reason = 'выше технический счёт'; }
            } else if (goal === 'strength') {
              if (ex1!.type === 'compound' && ex2!.type !== 'compound') { winner = 1; reason = 'базовое движение для силы'; }
              else if (ex2!.type === 'compound' && ex1!.type !== 'compound') { winner = 2; reason = 'базовое движение для силы'; }
              else { winner = d1.score.total > d2.score.total ? 1 : 2; reason = 'выше технический счёт'; }
            } else {
              if (d1.safety.score > d2.safety.score) { winner = 1; reason = 'безопаснее'; }
              else if (d2.safety.score > d1.safety.score) { winner = 2; reason = 'безопаснее'; }
              else { winner = d1.score.total > d2.score.total ? 1 : 2; reason = 'выше тех. счёт'; }
            }
            const wName = winner === 1 ? ex1!.name : ex2!.name;
            const wColor = winner === 1 ? ACCENT : '#60a5fa';
            return (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: wColor }}>🏅 Рекомендовано: {wName}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Причина: {reason}. Цель: {goal === 'hypertrophy' ? 'гипертрофия' : goal}.</div>
              </div>
            );
          })()}
        </div>
        </>
      )}
    </div>
  );
};

// ════════════════ PRO-ANALYSIS SUB-TAB ════════════════
const ProAnalysisTab: React.FC = () => {
  const [proGroup, setProGroup] = useState('chest');

  const groupExercises = useMemo(() =>
    EXERCISE_CATALOG.filter(e => e.group === proGroup).map(ex => ({
      exercise: ex,
      rp: getResistanceProfile(ex),
      fv: forceVector(ex.group, ex.type, ex.name),
      score: calcTechniqueScore(ex),
      safety: assessSafety(ex.id, [], calcTechniqueScore(ex).total / 100),
      lp: lengthenedPartials(ex.group),
    })).sort((a, b) => b.rp.score - a.rp.score),
  [proGroup]);

  // Force-vector distribution
  const fvDist = useMemo(() => {
    const map: Record<string, number> = {};
    groupExercises.forEach(g => { map[g.fv] = (map[g.fv] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [groupExercises]);

  // Stretch-mediated leaders
  const stretchLeaders = useMemo(() => groupExercises.filter(g => g.rp.curve === 'stretch_mediated').slice(0, 5), [groupExercises]);

  // Synergy pairs: find exercises that use different force vectors (superset potential)
  const synergyPairs = useMemo(() => {
    const pairs: Array<{ a: string; b: string; type: string; reason: string }> = [];
    const seen = new Set<string>();
    const antagonistMap: Record<string, string[]> = {
      horizontal_push: ['horizontal_pull'], horizontal_pull: ['horizontal_push'],
      vertical_push: ['vertical_pull'], vertical_pull: ['vertical_push'],
      knee_dominant: ['hip_dominant'], hip_dominant: ['knee_dominant'],
      core_anti: [], other: [],
    };
    groupExercises.forEach(a => {
      groupExercises.forEach(b => {
        if (a.exercise.id === b.exercise.id) return;
        const key = [a.exercise.id, b.exercise.id].sort().join('|');
        if (seen.has(key)) return;
        const agn = antagonistMap[a.fv] || [];
        if (agn.includes(b.fv)) {
          seen.add(key);
          pairs.push({ a: a.exercise.name, b: b.exercise.name, type: 'антагонист', reason: `${a.fv} ↔ ${b.fv} — суперсет без перекрёстного утомления` });
        }
        if (a.fv === b.fv && a.rp.curve !== b.rp.curve) {
          seen.add(key);
          pairs.push({ a: a.exercise.name, b: b.exercise.name, type: 'вариация', reason: `один вектор (${a.fv}), разные кривые: ${a.rp.label} vs ${b.rp.label}` });
        }
      });
    });
    return pairs.slice(0, 10);
  }, [groupExercises]);

  // Regional coverage assessment
  const regionalCoverage = useMemo(() => {
    const regions = SUBREGION_DEFS[proGroup] || [];
    const covered: string[] = [];
    const uncovered: string[] = [];
    regions.forEach(r => {
      const has = groupExercises.some(g => {
        const tm = (g.exercise.targetMuscle || '').toLowerCase();
        return r.keywords.some(kw => tm.includes(kw.toLowerCase()));
      });
      if (has) covered.push(r.name);
      else uncovered.push(r.name);
    });
    return { covered, uncovered, total: regions.length };
  }, [proGroup, groupExercises]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#fff' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
        <PopupSelect label="Группа мышц" value={proGroup} options={GROUPS.filter(g => g !== 'all').map(g => ({ id: g, label: `${GROUP_ICON[g] || ''} ${GROUP_RU[g]}`, desc: '' }))} hint="Группа для анализа" onChange={v => setProGroup(v)} />
      </div>

      {/* Force-vector distribution */}
      <div style={{ ...CARD, marginBottom: 12, border: '1px solid rgba(168,85,247,0.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', marginBottom: 8 }}>📐 Распределение force-векторов</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {fvDist.map(([fv, count]) => (
            <div key={fv} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#c084fc' }}>{fv.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#c084fc' }}>{count}</div>
              <div style={{ fontSize: 8, color: DIM }}>упражнений</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stretch-mediated leaders */}
      <div style={{ ...CARD, marginBottom: 12, border: '1px solid rgba(34,197,94,0.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>🏆 Stretch-mediated лидеры (топ-5)</div>
        {stretchLeaders.length > 0 ? (
          stretchLeaders.map((g, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: 4, marginBottom: 3, background: i === 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)', fontSize: 10 }}>
              <span style={{ fontWeight: 600 }}>#{i + 1} {g.exercise.name}</span>
              <span style={{ color: '#22c55e' }}>{g.rp.score}/10</span>
              <span style={{ color: DIM, fontSize: 8 }}>{g.exercise.type === 'compound' ? 'База' : 'Изол.'}</span>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 10, color: DIM, padding: 8 }}>Нет stretch-mediated упражнений в этой группе.</div>
        )}
      </div>

      {/* Regional coverage */}
      <div style={{ ...CARD, marginBottom: 12, border: '1px solid rgba(59,130,246,0.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>📍 Покрытие подрегионов: {regionalCoverage.covered.length}/{regionalCoverage.total}</div>
        {regionalCoverage.covered.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 600, marginBottom: 2 }}>✅ Покрыты:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {regionalCoverage.covered.map(r => <span key={r} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 8, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>{r}</span>)}
            </div>
          </div>
        )}
        {regionalCoverage.uncovered.length > 0 && (
          <div>
            <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>❌ Не покрыты:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {regionalCoverage.uncovered.map(r => <span key={r} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{r}</span>)}
            </div>
          </div>
        )}
      </div>

      {/* Synergy/conflict pairs */}
      <div style={{ ...CARD, marginBottom: 12, border: '1px solid rgba(251,146,60,0.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fb923c', marginBottom: 8 }}>🔗 Сила синергии: лучшие пары</div>
        {synergyPairs.length > 0 ? (
          synergyPairs.map((p, i) => (
            <div key={i} style={{ padding: '6px 8px', borderRadius: 6, marginBottom: 4, background: 'rgba(251,146,60,0.04)', border: '1px solid rgba(251,146,60,0.1)', fontSize: 9 }}>
              <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>{p.a} + {p.b}</div>
              <div style={{ color: DIM }}>{p.type}: {p.reason}</div>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 10, color: DIM, padding: 8 }}>Нет явных синергетических пар в этой группе.</div>
        )}
      </div>

      {/* Full table */}
      <div style={{ ...CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: DIM, marginBottom: 8 }}>📋 Полная таблица анализа</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '2px 4px', fontSize: 8, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 4, marginBottom: 4 }}>
          <span style={{ color: DIM }}>Упражнение</span>
          <span style={{ color: DIM, textAlign: 'center' }}>Профиль</span>
          <span style={{ color: DIM, textAlign: 'center' }}>Force-вектор</span>
          <span style={{ color: DIM, textAlign: 'center' }}>Тех. счёт</span>
          <span style={{ color: DIM, textAlign: 'center' }}>Безоп.</span>
        </div>
        {groupExercises.map((g, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '2px 4px', padding: '3px 0', fontSize: 8, borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
            <span style={{ fontWeight: 600 }}>{g.exercise.name}</span>
            <span style={{ textAlign: 'center', color: g.rp.curve === 'stretch_mediated' ? '#22c55e' : g.rp.curve === 'mid_range' ? '#60a5fa' : '#f59e0b' }}>{g.rp.score}/10</span>
            <span style={{ textAlign: 'center', color: '#c084fc' }}>{g.fv.replace(/_/g, ' ')}</span>
            <span style={{ textAlign: 'center', color: getRiskColor(g.score.level) }}>{g.score.total}</span>
            <span style={{ textAlign: 'center', color: getRiskColor(g.safety.level) }}>{g.safety.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ════════════════ MAIN COMPONENT ════════════════
const ExerciseLab: React.FC = () => {
  const [mode, setMode] = useState<LabMode>('prescription');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const handleSelectForCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  const modeBtn = (m: LabMode, label: string, icon: string) => (
    <button
      onClick={() => setMode(m)}
      style={{
        padding: '8px 16px', borderRadius: 8, border: mode === m ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
        background: mode === m ? 'rgba(0,230,138,0.1)' : 'rgba(0,0,0,0.3)', color: mode === m ? ACCENT : DIM,
        cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      {icon} {label}
      {m === 'compare' && compareIds.length > 0 && (
        <span style={{ background: ACCENT, color: '#000', borderRadius: 10, fontSize: 9, padding: '1px 6px', fontWeight: 800 }}>{compareIds.length}</span>
      )}
    </button>
  );

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      {/* Header */}
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🧬 Лаборатория упражнений</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 12 }}>
        Подбор нагрузки, анализ техники, сравнение, ПРО-анализ force-векторов и синергии — всё в одном инструменте.
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {modeBtn('prescription', 'Подбор', '📐')}
        {modeBtn('technique', 'Техника', '🔬')}
        {modeBtn('compare', 'Сравнение', '⚖️')}
        {modeBtn('pro', 'ПРО-анализ', '🔮')}
      </div>

      {/* Content */}
      {mode === 'prescription' && <PrescriptionTab />}
      {mode === 'technique' && <TechniqueTab onSelectForCompare={handleSelectForCompare} />}
      {mode === 'compare' && <CompareTab initialId1={compareIds[0] || ''} initialId2={compareIds[1] || ''} />}
      {mode === 'pro' && <ProAnalysisTab />}
    </div>
  );
};

export default ExerciseLab;
export { ExerciseLab };
