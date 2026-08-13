/**
 * plan-validator.ts — Единая валидация плана (MRV, ACWR, readiness, goal-совместимость).
 *
 * Вызывается в обоих конструкторах (ручном и BB-авто) при сборке плана.
 * Возвращает массив баннеров (warnings + errors) для UI.
 */
import { getAllVolumeLandmarks } from './volume-landmarks.engine';
import { loadSRPESessions } from './pro/srpe-store';
import { toDailyLoads, acuteChronicRatio, type TrainingSession } from './pro/training-load.engine';

export interface ValidationBanner {
  level: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
  /** Категория для фильтрации/приоритета */
  category: 'mrv' | 'acwr' | 'readiness' | 'goal' | 'coverage' | 'balance';
}

export interface ValidateInput {
  /** Недельные сеты по группам мышц { 'chest': 24, 'back': 20, ... } */
  weeklySets: Record<string, number>;
  level: string;
  goal: string;
  daysPerWeek: number;
  weakPoints: string[];
  /** Текущая готовность 0-100 (из профиля) */
  readiness?: number;
  /** Подтверждённый стаж (лет) — для контекстного комментария. */
  trainingYears?: number;
  /** PED-множитель порогов (combinedMrvMultiplier) — расширяет MRV. */
  mrvMultiplier?: number;
  /** Фактические per-muscle MRV-капы плана (после стажевых/PED/recovery множителей).
   *  Приоритетнее landmarks — enhanced-планы не получают ложных overflow. */
  mrvByMuscle?: Record<string, number>;
}

function getAcwr(): { ratio: number; zone: string } | null {
  try {
    const all = loadSRPESessions();
    if (all.length < 5) return null;
    const sessions: TrainingSession[] = all.map(s => ({ date: s.date, sRPE: s.sRPE, durationMin: s.durationMin }));
    const loads = toDailyLoads(sessions);
    const acwr = acuteChronicRatio(loads);
    return { ratio: acwr.ratio, zone: acwr.zone };
  } catch { return null; }
}

/** Главная функция валидации */
export function validatePlan(input: ValidateInput): ValidationBanner[] {
  const banners: ValidationBanner[] = [];
  const { weeklySets, level, goal, daysPerWeek, weakPoints, readiness, trainingYears, mrvMultiplier, mrvByMuscle } = input;
  const landmarks = getAllVolumeLandmarks(level);

  // Контекст: на основе каких параметров пользователя допустим объём.
  const ctx: string[] = [];
  if (trainingYears !== undefined) ctx.push(`стаж ${trainingYears} лет`);
  if ((mrvMultiplier ?? 1) > 1) ctx.push(`PED ×${(mrvMultiplier as number).toFixed(2)}`);
  const ctxSuffix = ctx.length > 0 ? ` (допустимо: ${ctx.join(', ')})` : '';

  // 1. MRV check — объем по каждой группе мышц
  for (const [muscle, sets] of Object.entries(weeklySets)) {
    const lm = landmarks[muscle];
    if (!lm) {
      banners.push({ level: 'info', category: 'coverage', title: muscle + ': нет ориентиров', detail: 'Для группы «' + muscle + '» нет данных MEV/MAV/MRV в базе.' });
      continue;
    }
    // Фактический кап плана (стаж/PED/recovery) приоритетнее базовых landmarks.
    const cap = mrvByMuscle?.[muscle] ?? Math.round(lm.mrv * (mrvMultiplier ?? 1));
    // MAV масштабируется пропорционально факту (соотношение MAV/MRV из landmarks).
    const scaledMav = mrvByMuscle?.[muscle] ? Math.round(lm.mav * cap / lm.mrv) : lm.mav;
    if (sets > cap) {
      banners.push({ level: 'error', category: 'mrv', title: '⚠ ' + muscle + ': превышен MRV (' + sets + ' > ' + cap + ')', detail: 'Снизьте объём на группу «' + muscle + '» до ' + cap + ' сетов/нед (превышение на ' + Math.round((sets - cap) / cap * 100) + '%)' + ctxSuffix + '.' });
    } else if (sets < lm.mev) {
      banners.push({ level: 'info', category: 'mrv', title: muscle + ': ниже MEV (' + sets + ' < ' + lm.mev + ')', detail: 'Объём на «' + muscle + '» ниже стимульного минимума. Добавьте ' + (lm.mev - sets) + ' сета/нед для роста.' });
    } else if (sets > scaledMav) {
      banners.push({ level: 'warning', category: 'mrv', title: muscle + ': выше MAV (' + sets + ' > ' + scaledMav + ')', detail: 'Объём выше зоны адаптации. Контролируйте восстановление.' + (cap > lm.mrv ? ` Фактический MRV ${cap}${ctxSuffix}.` : '') });
    }
  }

  // 2. ACWR check
  const acwrInfo = getAcwr();
  if (acwrInfo) {
    if (acwrInfo.ratio > 1.5) {
      banners.push({ level: 'error', category: 'acwr', title: '⛔ ACWR ' + acwrInfo.ratio.toFixed(2) + ' — опасная зона', detail: 'Острая нагрузка значительно превышает хроническую. Рекомендована разгрузочная неделя (объём –40%).' });
    } else if (acwrInfo.ratio > 1.3) {
      banners.push({ level: 'warning', category: 'acwr', title: '⚠ ACWR ' + acwrInfo.ratio.toFixed(2) + ' — зона риска', detail: 'Нагрузка выше оптимальной. Снизьте объём на 15-20%.' });
    }
  }

  // 3. Readiness check
  if (readiness !== undefined && readiness < 40) {
    banners.push({ level: 'warning', category: 'readiness', title: '🔴 Готовность низкая (' + readiness + '/100)', detail: 'Низкий recovery score. Рассмотрите разгрузку или восстановительную тренировку.' });
  } else if (readiness !== undefined && readiness < 60) {
    banners.push({ level: 'info', category: 'readiness', title: '🟡 Готовность умеренная (' + readiness + '/100)', detail: 'Средний recovery. Контролируйте объём, избегайте высокоинтенсивных сессий подряд.' });
  }

  // 4. Goal compatibility
  const totalSets = Object.values(weeklySets).reduce((a, b) => a + b, 0);
  const groups = Object.keys(weeklySets).length;
  if (goal === 'strength' && totalSets > 20 * daysPerWeek) {
    banners.push({ level: 'warning', category: 'goal', title: 'Объём высок для силы (' + totalSets + ' сетов/нед)', detail: 'Для силы рекомендуемый объём: 10-20 сетов/тренировку. Высокий объём смещает адаптацию в гипертрофию.' });
  }
  if (goal === 'hypertrophy' && totalSets < 15 * daysPerWeek) {
    banners.push({ level: 'info', category: 'goal', title: 'Объём низок для гипертрофии (' + totalSets + ' сетов/нед)', detail: 'Для гипертрофии рекомендуемый объём: 15-25 сетов/тренировку. Добавьте подходы для стимула роста.' });
  }

  // 5. Coverage / balance
  const majorGroups = ['chest', 'back', 'quads', 'shoulders', 'arms', 'hamstrings', 'glutes', 'calves', 'abs', 'traps'];
  const uncovered = majorGroups.filter(g => !(g in weeklySets) || weeklySets[g] === 0);
  if (uncovered.length > 0) {
    banners.push({ level: 'warning', category: 'coverage', title: 'Непокрытые группы: ' + uncovered.join(', '), detail: 'Добавьте упражнения для непокрытых мышечных групп для баланса программы.' });
  }

  // 6. Weak points coverage
  for (const wp of weakPoints) {
    if (!(wp in weeklySets) || weeklySets[wp] < 6) {
      banners.push({ level: 'info', category: 'coverage', title: 'Слабая группа «' + wp + '»: мало объёма', detail: 'Для приоритетной группы рекомендуемый минимум: ' + Math.max(6, Math.round((landmarks[wp]?.mev || 6) * 1.2)) + ' сетов/нед.' });
    }
  }

  return banners;
}

/** Хелпер: вычислить weeklySets из ManualResult */
export function weeklySetsFromManualResult(result: { days: { exercises: { group: string; sets: number }[] }[] }): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const day of result.days) {
    for (const ex of day.exercises) {
      const g = ex.group || 'other';
      acc[g] = (acc[g] || 0) + (ex.sets || 0);
    }
  }
  return acc;
}

/** Хелпер: вычислить weeklySets из BBPlan (BBWeek[]) */
export function weeklySetsFromBBPlan(weeks: Array<{ sessions: Array<{ exercises: Array<{ muscle: string; sets: number }> }> }>): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const week of weeks) {
    for (const session of week.sessions) {
      for (const ex of session.exercises) {
        const g = ex.muscle || 'other';
        acc[g] = (acc[g] || 0) + (ex.sets || 0);
      }
    }
  }
  return acc;
}
