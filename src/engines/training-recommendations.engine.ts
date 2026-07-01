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
    historyWorkouts.forEach(w => {
      const now = new Date(); const s = new Date(now); const day = (s.getDay() + 6) % 7; s.setDate(s.getDate() - day); const e = new Date(s); e.setDate(e.getDate() + 6);
      if (w.date < s.toISOString().slice(0, 10) || w.date > e.toISOString().slice(0, 10)) return;
      (w.exercises || []).forEach(ex => { const cat = getExerciseById(ex.exerciseId); if (!cat) return; const score = cat.jointStress === 'high' ? 3 : cat.jointStress === 'med' ? 2 : 1; jointByGroup[cat.group] = (jointByGroup[cat.group] || 0) + score * (ex.sets?.length || 0); });
    });
    Object.entries(jointByGroup).forEach(([g, score]) => { if (score >= 30) recs.push({ id: `joint-${g}`, severity: 'warn', text: `Высокая суставная нагрузка на «${ru(g)}» за неделю — добавьте предаб-упражнения и mobility в разминку, рассмите изолирующие замены базовых.` }); });
  }

  if (recs.length === 0) recs.push({ id: 'ok', severity: 'info', text: 'Сбалансировано: объём в пределах MEV-MAV, готовность в норме, рисков перетрена не обнаружено.' });
  return recs;
}