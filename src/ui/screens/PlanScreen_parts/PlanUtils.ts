import { RIR_TABLE, SPLIT_LABELS, GROUP_LABELS } from './PlanConstants';
import { EXERCISE_CATALOG, getExercisesByGroup, getExerciseById } from '../../core/exercise-catalog';
import { calcExercisePrescription } from '../../engines/training.engine';
import type { TrainingOutput, Exercise } from '../../core/types';

export function getRIR(goal: string, level: string, isDeload: boolean): string {
  if (isDeload) return '3-5';
  const goalMap = RIR_TABLE[goal] || RIR_TABLE.maintenance;
  const range = goalMap[level] || goalMap.intermediate;
  return `${range[0]}-${range[1]}`;
}

export function getSplitRationale(goal: string, level: string, daysPerWeek: number, recovery: number, weakPoints: string[]): string[] {
  const reasons: string[] = [];
  if (daysPerWeek <= 3) reasons.push(`${daysPerWeek} дня/дня для полноценного восстановления/или по 1 упражнению на мышечную группу`);
  else if (daysPerWeek === 4) reasons.push(`${daysPerWeek} дня для полной тренировки сплит/или 2 упражнения на мышечную группу (оптимальный баланс)`);
  else if (daysPerWeek === 5) reasons.push(`${daysPerWeek} дня для PPL + добавленный день для слабых мест/или 3 упражнения на мышечную группу`);
  else reasons.push(`${daysPerWeek} дня для PPL с дублированием или 4 упражнения на мышечную группу`);

  if (weakPoints.length > 0) reasons.push(`С акцентом на слабые места (${weakPoints.map(g => GROUP_LABELS[g] || g).join(', ')}): +20% объема, больше подходов для развития`);
  if (recovery < 55) reasons.push(`Восстановление ${recovery}% < 55 требуется снижение объема тренировок и увеличение отдыха 30-50%`);
  if (goal === 'strength') reasons.push('Для силы RIR 1-3, прогрессивная нагрузка, веса 2.5-5% в неделю');
  if (goal === 'cut') reasons.push('Для сушки MV-MEV, умеренный RIR от 2, белок 2.2 г/кг');
  if (level === 'enhanced') reasons.push('Для элитных RIR MAV-MRV, продвинутые техники фазирования');
  return reasons;
}

export function formatSplitGroups(groupsPerDay: string[][]): string {
  return groupsPerDay.map(day => day.map(g => SPLIT_LABELS[g] || g).join('+')).join(' / ');
}

export function buildDayPlan(result: TrainingOutput, daysPerWeek: number, weakPoints: string[] = [], splitGroups?: string[][], weekNum: number = 0): { day: number; name: string; exercises: Exercise[] }[] {
  const days: { day: number; name: string; exercises: Exercise[] }[] = [];
  const groups = Object.keys(result.volumePerGroup);
  const isDeload = result.isDeload;

  for (let d = 0; d < daysPerWeek; d++) {
    const dayGroups: string[] = [];
    if (splitGroups && splitGroups[d]) {
      dayGroups.push(...splitGroups[d]);
    } else if (daysPerWeek <= 3) {
      dayGroups.push(...groups);
    } else if (daysPerWeek === 4) {
      dayGroups.push(...(d % 2 === 0 ? ['chest', 'shoulders', 'arms'] : ['back', 'legs', 'core']));
    } else if (daysPerWeek === 5) {
      const map5: string[][] = [['chest'], ['back'], ['legs'], ['shoulders', 'arms'], ['core', 'arms']];
      dayGroups.push(...(map5[d] || groups));
    } else {
      const map6: string[][] = [['chest', 'triceps'], ['back', 'biceps'], ['legs'], ['shoulders', 'arms'], ['chest', 'back'], ['legs', 'core']];
      dayGroups.push(...(map6[d] || groups));
    }

    const exercises: Exercise[] = [];
    for (const g of dayGroups) {
      const vol = result.volumePerGroup[g] || 0;
      if (vol <= 0) continue;
      const sets = Math.max(2, Math.round(vol / 3));
      const avail = getExercisesByGroup(g);
      const filtered = avail.filter(e => !(isDeload && e.fatigueCost > 5));
      const maxPicks = Math.min(3, Math.ceil(sets / 3));
      const rotationOffset = (weekNum * 2 + d) % Math.max(1, filtered.length - maxPicks + 1);
      const picked = filtered.slice(rotationOffset, rotationOffset + maxPicks).sort((a, b) => (a.order ?? 2) - (b.order ?? 2));
      for (const ex of picked) {
        const setsForEx = picked.length === 1 ? sets : Math.max(2, Math.round(sets / picked.length));
        const rirStr = result.rir;
        const rirVal = parseInt(rirStr.split('-')[0], 10) || 2;
        const presc = calcExercisePrescription(ex, result.splitName.includes('Продвинутый') ? 'strength' : 'hypertrophy', 'intermediate', weakPoints.includes(g), isDeload, 1.0);
        exercises.push({ ...ex, sets: setsForEx, reps: parseInt(presc.reps.split('-')[0], 10) || 10, rir: rirVal, rest: ex.type === 'compound' ? 120 : 60, targetMuscle: ex.targetMuscle, technique: ex.technique, comments: ex.comments });
      }
    }

    const dayNames = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
    days.push({ day: d + 1, name: dayNames[d] || `День ${d + 1}`, exercises });
  }

  const restDays = 7 - daysPerWeek;
  for (let r = 0; r < restDays; r++) {
    if (!days.find(dd => dd.day === daysPerWeek + r + 1)) {
      days.push({ day: daysPerWeek + r + 1, name: 'Отдых', exercises: [] });
    }
  }

  return days;
}
