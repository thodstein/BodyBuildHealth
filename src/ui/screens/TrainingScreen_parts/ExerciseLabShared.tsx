import React from 'react';
import { EXERCISE_CATALOG, getExerciseById, getSubstitutes } from '../../../core/exercise-catalog';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { getTechnique, getCues, getErrorsForExercise, getProgression } from '../../../engines/genetic-deload-technique.engine';
import { classifyMovement, estimateDifficulty, getMuscleSynergy, getJointStress, assessSafety } from '../../../engines/movement-engines';
import { generateRepTempo } from '../../../engines/rep-tempo-engine';
import { forceVector, lengthenedPartials } from '../../../engines/pro/exercise-prescription.engine';
import { getTargetMuscleForExercise } from '../../../data/target-muscle-db';
import { getMappedIds } from '../../../data/exercise-id-mapping';
import type { Exercise } from '../../../core/types';

// ════════════════════ SHARED CONSTANTS ════════════════════
export const ACCENT = '#00e68a';
export const DIM = 'rgba(255,255,255,0.5)';
export const BG = 'rgba(24,24,27,0.15)';
export const BORDER = 'rgba(255,255,255,0.05)';
export const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
export const CARD: React.CSSProperties = { padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' };
export const pill: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 600, marginRight: 6, marginBottom: 4 };
export const secTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: ACCENT, margin: '12px 0 6px', borderBottom: '1px solid rgba(0,230,138,0.15)', paddingBottom: 4 };
export const chipRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 };

export const GROUPS = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
export const GROUP_RU: Record<string, string> = { all: 'Все группы', chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор' };
export const GROUP_ICON: Record<string, string> = { chest: '🏋️', back: '🔙', legs: '🦵', shoulders: '💪', arms: '💪', core: '🎯' };
export const TYPE_RU: Record<string, string> = { compound: 'Базовое', isolation: 'Изолированное' };
export const EQUIP_RU: Record<string, string> = { barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блок', bodyweight: 'Вес тела', band: 'Резинка', kettlebell: 'Гиря', smith: 'Смит', plate: 'Блин', suspension: 'Петли' };
export const JOINT_RU: Record<string, string> = { knee: 'Колено', hip: 'Таз', spine: 'Позвоночник', shoulder: 'Плечо', elbow: 'Локоть', ankle: 'Голеностоп' };
export const RIR_TO_RPE: Record<number, number> = { 0: 10, 1: 9, 2: 8, 3: 7, 4: 6, 5: 5, 6: 4, 7: 3, 8: 2 };
export const RPE_LABEL: Record<number, string> = { 10: 'Максимально', 9: 'Тяжело', 8: 'Умеренно тяжело', 7: 'Средне', 6: 'Легко', 5: 'Очень легко', 4: 'Разминка' };

export type LabMode = 'prescription' | 'technique' | 'compare' | 'pro' | 'substitute' | 'catalog';

// ════════════════ SUB-REGION DEFINITIONS ════════════════
export const SUBREGION_DEFS: Record<string, { id: string; name: string; keywords: string[]; description: string }[]> = {
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

export const SUB_REGION_COLORS = ['#00e68a', '#60a5fa', '#c084fc', '#f59e0b', '#f87171', '#34d399', '#fbbf24', '#818cf8'];

// ════════════════ REGION MAP ════════════════
export const REGION_MAP: Record<string, Array<{ id: string; label: string; desc: string }>> = {
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

export function getExerciseRegion(exId: string, group: string): string {
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
export type ForceCurveType = 'stretch_mediated' | 'mid_range' | 'peak_contraction' | 'variable';
export interface ForceCurveProfile { curve: ForceCurveType; label: string; score: number; desc: string; bestGoal: string; repStyle: string; }

export function getResistanceProfile(ex: Exercise): ForceCurveProfile {
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

export interface DifficultyPair { name: string; diff: 'easier' | 'harder'; how: string; reason: string; }
export function getDifficultyScaler(ex: Exercise): DifficultyPair[] {
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
export interface TechniqueScore { total: number; breakdown: { label: string; value: number; max: number }[]; level: 'low' | 'medium' | 'high'; label: string; }

export function calcTechniqueScore(ex: Exercise): TechniqueScore {
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

export function getRiskColor(level: string): string { if (level === 'high') return '#ef4444'; if (level === 'medium' || level === 'med') return '#f59e0b'; return '#22c55e'; }
export function getJointEmoji(level: string): string { if (level === 'high') return '🔴'; if (level === 'medium' || level === 'med') return '🟡'; return '🟢'; }
export function lvl(v: number, max: number): string { const p = v / max; if (p >= 0.7) return '#ef4444'; if (p >= 0.4) return '#f59e0b'; return '#22c55e'; }
export const filterBtn = (active: boolean): React.CSSProperties => ({
  padding: '4px 12px', borderRadius: 14, border: `1px solid ${active ? 'rgba(0,230,138,0.4)' : 'rgba(255,255,255,0.08)'}`,
  background: active ? 'rgba(0,230,138,0.1)' : 'transparent', color: active ? ACCENT : DIM, cursor: 'pointer', fontSize: 10, fontWeight: 600,
});

// ════════════════ REUSABLE: Technique Detail Card ════════════════
export const TechniqueDetail: React.FC<{
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
              <div style={{ fontSize: 9 * s, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{labels[i]}</div>
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
