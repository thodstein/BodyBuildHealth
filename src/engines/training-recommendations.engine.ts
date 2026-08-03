import { getExerciseById, EXERCISE_CATALOG, canReplace } from '../core/exercise-catalog';
import { getVolumeByMuscle } from './training-methodology.engine';
import type { WorkoutLog } from '../core/types';

export interface TrainingRecommendation {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  text: string;
}

export interface RecommendationInput {
  historyWorkouts: WorkoutLog[];
  level: string;
  weakPoints: string[];
  readinessHistory?: { date: string; recovery: number }[];
  acwr?: number;
  bodyWeight?: number;
  nutrition?: { kcal: number; protein: number; fat: number; carbs: number };
  labAnalysis?: { liverStress: number; cardioRisk: number; inflammation: number; kidneyStress: number; hormoneScore: number; homaIR: number | null };
  onCourse?: boolean;
  courseIntensity?: string;
  supportCoverage?: Record<string, number>;
}

const GRP_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы', calves: 'Икры', triceps: 'Трицепс', biceps: 'Бицепс', quads: 'Квадрицепсы' };
const ru = (g: string) => GRP_RU[g] || g;

const weekStart = (d: Date) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; };

/** Недельные сеты по группам за последние N недель (старая→новая). */
export function weeklySetsByGroup(workouts: WorkoutLog[], weeks = 3): Record<string, number[]> {
  const now = new Date();
  const starts: Date[] = [];
  for (let i = weeks - 1; i >= 0; i--) { const s = weekStart(now); s.setDate(s.getDate() - i * 7); starts.push(s); }
  const res: Record<string, number[]> = {};
  starts.forEach((s, wi) => {
    const e = new Date(s); e.setDate(e.getDate() + 6);
    const ss = s.toISOString().slice(0, 10), ee = e.toISOString().slice(0, 10);
    workouts.forEach(w => {
      if (w.date < ss || w.date > ee) return;
      (w.exercises || []).forEach(ex => {
        const cat = getExerciseById(ex.exerciseId);
        if (!cat) return;
        if (!res[cat.group]) res[cat.group] = new Array(weeks).fill(0);
        res[cat.group][wi] += (ex.sets?.length || 0);
      });
    });
  });
  return res;
}

/** Движок рекомендаций: правила поверх истории тренировок, готовности и ACWR. */
export function generateTrainingRecommendations(input: RecommendationInput): TrainingRecommendation[] {
  const { historyWorkouts, level, weakPoints, readinessHistory, acwr } = input;
  const recs: TrainingRecommendation[] = [];
  const lvlKey = (level === 'enhanced' ? 'advanced' : level) as 'beginner' | 'intermediate' | 'advanced';
  const wsg = weeklySetsByGroup(historyWorkouts, 3);

  Object.entries(wsg).forEach(([g, arr]) => {
    const v = getVolumeByMuscle(g);
    const ld = v ? v[lvlKey] : undefined;
    const mev = ld?.mev ?? 0;
    const mrv = ld?.mrv ?? 0;
    const last = arr[arr.length - 1] || 0;
    const prev = arr[arr.length - 2] || 0;
    // недотрен: 2+ недели ниже MEV (и есть объём >0, иначе это «нет группы» — отдельное правило)
    const underWeeks = arr.filter(s => s > 0 && s < mev).length;
    if (underWeeks >= 2) recs.push({ id: `under-${g}`, severity: 'warn', text: `Группа «${ru(g)}» недотрен ${underWeeks} нед (ниже MEV ${mev}) — добавьте +1 день/нед или +2 подхода.` });
    // перетрен: 2 недели подряд > MRV
    if (last > mrv && prev > mrv && mrv > 0) recs.push({ id: `over-${g}`, severity: 'critical', text: `Группа «${ru(g)}» >MRV (${mrv}) 2 недели подряд — запланируйте делод (−20-30% объём).` });
  });

  // слабые группы без объёма на последней неделе
  weakPoints.forEach(w => {
    const arr = wsg[w];
    const last = arr ? arr[arr.length - 1] || 0 : 0;
    if (last === 0) recs.push({ id: `weak-${w}`, severity: 'warn', text: `Слабая группа «${ru(w)}» без объёма на последней неделе — добавьте специализированное упражнение для акцента.` });
  });

  // готовность
  if (readinessHistory && readinessHistory.length) {
    const lastR = readinessHistory[readinessHistory.length - 1].recovery;
    if (lastR < 60) recs.push({ id: 'readiness-low', severity: 'warn', text: `Готовность ${Math.round(lastR)}% (<60) — сегодня снизить объём на 10-15%, увеличить отдых.` });
    const low3 = readinessHistory.slice(-3).filter(r => r.recovery < 60).length;
    if (low3 >= 3) recs.push({ id: 'readiness-deload', severity: 'critical', text: 'Готовность <60% 3 дня подряд — рассмотрите делод-неделю.' });
  }

  // ACWR
  if (acwr !== undefined && acwr > 1.5) recs.push({ id: 'acwr-high', severity: 'critical', text: `ACWR ${acwr.toFixed(2)} (>1.5) — высокий риск перетренированности, снизить нагрузку.` });
  else if (acwr !== undefined && acwr < 0.8) recs.push({ id: 'acwr-low', severity: 'info', text: `ACWR ${acwr.toFixed(2)} (<0.8) — недотрен, можно повысить объём.` });

  // 5.2: усталость от однообразия — упражнение повторяется 6+ недель
  const exWeeks: Record<string, number> = {};
  const weekBuckets: Record<number, Set<string>> = {};
  for (let i = 0; i < 8; i++) weekBuckets[i] = new Set();
  {
    const now = new Date();
    for (let i = 0; i < 8; i++) { const s = new Date(now); const day = (s.getDay() + 6) % 7; s.setDate(s.getDate() - day - i * 7); const e = new Date(s); e.setDate(e.getDate() + 6); const ss = s.toISOString().slice(0, 10), ee = e.toISOString().slice(0, 10); historyWorkouts.forEach(w => { if (w.date >= ss && w.date <= ee) (w.exercises || []).forEach(ex => weekBuckets[i].add(ex.exerciseId)); }); }
  }
  Object.values(weekBuckets).forEach(set => set.forEach(id => { exWeeks[id] = (exWeeks[id] || 0) + 1; }));
  Object.entries(exWeeks).forEach(([id, w]) => {
    if (w >= 6) {
      const cat = getExerciseById(id);
      const alt = EXERCISE_CATALOG.find(e => e.group === cat?.group && e.id !== id && canReplace(id, e.id));
      recs.push({ id: `stale-${id}`, severity: 'warn', text: `«${cat?.name || id}» повторяется ${w} нед подряд — смените вариацию${alt ? ` (например, ${alt.name})` : ''} для обновления стимула (анти-стейл).` });
    }
  });

  // 5.3: накопленная суставная нагрузка за последнюю неделю
  {
    const jointByGroup: Record<string, number> = {};
    const latestWorkoutDate = historyWorkouts
      .map(workout => workout.date)
      .filter(Boolean)
      .sort()
      .at(-1);
    const latestWorkout = latestWorkoutDate ? new Date(`${latestWorkoutDate}T00:00:00Z`) : new Date();
    const day = latestWorkout.getUTCDay();
    const start = new Date(latestWorkout);
    start.setUTCDate(start.getUTCDate() - ((day + 6) % 7));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const weekStartKey = start.toISOString().slice(0, 10);
    const weekEndKey = end.toISOString().slice(0, 10);
    historyWorkouts.forEach(w => {
      if (w.date < weekStartKey || w.date > weekEndKey) return;
      (w.exercises || []).forEach(ex => { const cat = getExerciseById(ex.exerciseId); if (!cat) return; const score = cat.jointStress === 'high' ? 3 : cat.jointStress === 'med' ? 2 : 1; jointByGroup[cat.group] = (jointByGroup[cat.group] || 0) + score * (ex.sets?.length || 0); });
    });
    Object.entries(jointByGroup).forEach(([g, score]) => { if (score >= 30) recs.push({ id: `joint-${g}`, severity: 'warn', text: `Высокая суставная нагрузка на «${ru(g)}» за неделю — добавьте предаб-упражнения и mobility в разминку, рассмите изолирующие замены базовых.` }); });
  }

  // 6.1/Nutrition→Training: питание учитывается в тренировочных рекомендациях
  if (input.nutrition && input.bodyWeight && input.bodyWeight > 0) {
    const bw = input.bodyWeight;
    const carbG = input.nutrition.carbs / bw;
    const protG = input.nutrition.protein / bw;
    const kcalG = input.nutrition.kcal / bw;
    if (carbG > 0 && carbG < 3) recs.push({ id: 'nutr-carbs-low', severity: 'warn', text: `Низкое потребление углеводов (${carbG.toFixed(1)} г/кг) — снизить тренировочный объём на 10-15%, риск низкой работоспособности и гликогена.` });
    if (protG > 0 && protG < 1.6) recs.push({ id: 'nutr-protein-low', severity: 'warn', text: `Недостаток белка (${protG.toFixed(1)} г/кг <1.6) — риск восстановления/синтеза, повысьте до 1.6-2.2 г/кг.` });
    if (kcalG > 0 && kcalG < 25) recs.push({ id: 'nutr-kcal-low', severity: 'info', text: `Дефицит калорий (${kcalG.toFixed(0)} ккал/кг) — работоспособность может снижаться; учтите при прогрессии нагрузки (фаза жиросжигания).` });
  }

  // 6.3: Labs → Training: лабораторные показатели влияют на рекомендации
  if (input.labAnalysis) {
    const la = input.labAnalysis;
    if (la.liverStress >= 7) recs.push({ id: 'lab-liver', severity: 'warn', text: `Высокий стресс печени (${la.liverStress}/10) — снизить объём на 10%, избегать жимовых перегрузок и стимуляторов.` });
    if (la.cardioRisk >= 7) recs.push({ id: 'lab-cardio', severity: 'warn', text: `Высокий кардиориск (${la.cardioRisk}/10) — ограничить тяжёлые сеты с задержкой дыхания, добавить кардио 150 мин/нед.` });
    if (la.inflammation >= 7) recs.push({ id: 'lab-inflam', severity: 'warn', text: `Высокое воспаление (${la.inflammation}/10) — увеличить отдых между сессиями, рассмотреть делод.` });
    if (la.kidneyStress >= 7) recs.push({ id: 'lab-kidney', severity: 'warn', text: `Стресс почек (${la.kidneyStress}/10) — контролировать гидратацию (≥35 мл/кг), избегать экстремального объёма.` });
    if (la.hormoneScore <= 3) recs.push({ id: 'lab-hormone', severity: 'warn', text: `Низкий гормональный профиль (${la.hormoneScore}/10) — восстановление хуже, снизить частоту на 1 сессию или объём на 15%.` });
    if (la.homaIR !== null && la.homaIR >= 2.5) recs.push({ id: 'lab-insulin', severity: 'info', text: `Инсулинорезистентность (HOMA-IR ${la.homaIR.toFixed(1)}) — углеводы вокруг тренировки, добавить кардио.` });
  }

  // 6.4: Pharma → Training: AAS-курс влияет на рекомендации
  if (input.onCourse) {
    const intensity = input.courseIntensity || 'moderate';
    if (intensity === 'heavy') recs.push({ id: 'pharma-heavy', severity: 'info', text: 'Тяжёлый курс — объём повышен (MRV ×1.3), но следите за суставами, ЦНС и восстановлением. Делод каждые 4-5 нед.' });
    else if (intensity === 'mild') recs.push({ id: 'pharma-mild', severity: 'info', text: 'Лёгкий курс — объём повышен умеренно (MRV ×1.15). Стандартная прогрессия, делод по самочувствию.' });
    else recs.push({ id: 'pharma-moderate', severity: 'info', text: 'Курс — объём повышен (MRV ×1.2). Усиленное восстановление: сон 8+, белок 2+ г/кг.' });
  }

  // 6.2: Support -> Training: низкое покрытие поддержки при нагрузке -> рекомендация
  if (input.supportCoverage) {
    const sc = input.supportCoverage;
    const liverStress = input.labAnalysis?.liverStress ?? 0;
    const cardioRisk = input.labAnalysis?.cardioRisk ?? 0;
    const kidneyStress = input.labAnalysis?.kidneyStress ?? 0;
    if ((sc.hepatic ?? 1) < 0.3 && (input.onCourse || liverStress >= 5)) recs.push({ id: 'supp-hepatic', severity: 'warn', text: 'Низкое покрытие поддержки печени при тренировочной/курсовой нагрузке — добавьте гепатопротекторы (UDCA, NAC, TUDCA, расторопша).' });
    if ((sc.cardio ?? 1) < 0.3 && cardioRisk >= 5) recs.push({ id: 'supp-cardio', severity: 'warn', text: 'Низкое кардио-покрытие при кардиориске — добавьте омега-3, CoQ10, экстракт чеснока, витамин K2.' });
    if ((sc.neuro ?? 1) < 0.3 && input.onCourse) recs.push({ id: 'supp-neuro', severity: 'warn', text: 'Низкое покрытие ЦНС на курсе — адаптогены (родиола, ашваганда), магний, холин, витамин B-комплекс.' });
    if ((sc.renal ?? 1) < 0.3 && (input.onCourse || kidneyStress >= 5)) recs.push({ id: 'supp-renal', severity: 'warn', text: 'Низкое покрытие почек при нагрузке — антиоксиданты (NAC), контроль гидратации (35+ мл/кг), экстракт клюквы.' });
  }

  if (recs.length === 0) recs.push({ id: 'ok', severity: 'info', text: 'Сбалансировано: объём, готовность, питание, лаборатория и поддержка в норме, рисков перетрена не обнаружено.' });
  return recs;
}
