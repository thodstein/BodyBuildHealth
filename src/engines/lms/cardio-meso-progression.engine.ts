/**
 * cardio-meso-progression.engine.ts — cross-meso прогрессия (P2-1).
 * Следующий цикл стартует не с нуля, а от факта прошлого:
 * отношение среднего объёма последних 2 недель к первым 2-м,
 * кламп ×1.0-1.15 (консервативно: +0-15%). Чистые функции.
 */
import { cycleBodyWeight, recalcSessionKcal, type CardioCycle } from './cardio.engine';

export interface CardioMesoProgression {
  /** Множитель стартового объёма следующего цикла. */
  startMult: number;
  /** Средний мин/нед первых 2 недель прошлого цикла. */
  firstAvg: number;
  /** Средний мин/нед последних 2 рабочих недель прошлого цикла. */
  lastAvg: number;
  reason: string;
}

/** Извлечь прогрессию из завершённого цикла (null — данных нет). */
export function extractCardioProgression(prev: CardioCycle | null | undefined): CardioMesoProgression | null {
  if (!prev || !Array.isArray(prev.weeks) || prev.weeks.length < 4) return null;
  const work = prev.weeks.filter(w => !w.deload && !w.taper);
  if (work.length < 4) return null;
  const avg = (ws: typeof work): number => ws.reduce((s, w) => s + w.totalMinutes, 0) / Math.max(1, ws.length);
  const firstAvg = Math.round(avg(work.slice(0, 2)));
  const lastAvg = Math.round(avg(work.slice(-2)));
  if (firstAvg <= 0 || lastAvg <= 0) return null;
  const raw = lastAvg / firstAvg;
  const startMult = Math.round(Math.max(1, Math.min(1.15, raw)) * 100) / 100;
  return {
    startMult,
    firstAvg,
    lastAvg,
    reason: startMult > 1
      ? `Прошлый цикл: ${firstAvg} → ${lastAvg} мин/нед — следующий стартует ×${startMult}.`
      : 'Прошлый цикл без роста — следующий стартует с того же объёма.',
  };
}

/**
 * Применить прогрессию к входу сборки: масштабирует ТОЛЬКО стартовую
 * точку через level/объём? Честно: возвращаем скорректированный
 * daysAvailable/totalWeeks без изменения + рекомендацию стартового
 * объёма текстом (движок стартует от level — множитель отдаём наружу).
 */
export function cardioProgressionAdvice(prev: CardioCycle | null | undefined): string {
  const p = extractCardioProgression(prev);
  if (!p) return 'Прошлого цикла нет — старт с базового объёма уровня.';
  return `🔗 Cross-meso: ${p.reason}`;
}

/**
 * Применить множитель к собранному циклу: длительности сессий ×mult
 * (мин 10), ккал пересчитаны тем же движком, итоги недель/цикла и
 * rationale обновлены. Возвращает новый цикл (вход не мутируется).
 * No-op при mult ≤ 1 (тот же объект).
 */
export function applyMesoMult(cycle: CardioCycle, mult: number): CardioCycle {
  if (!(mult > 1)) return cycle;
  const bw = cycleBodyWeight(cycle);
  const sex = cycle.config?.sex;
  const weeks = cycle.weeks.map(w => {
    const sessions = w.sessions.map(s => {
      const next = { ...s, durationMin: Math.max(10, Math.round(s.durationMin * mult)) };
      return recalcSessionKcal(next, bw, sex);
    });
    return {
      ...w,
      sessions,
      totalMinutes: sessions.reduce((sum, x) => sum + x.durationMin * x.weeklyFrequency, 0),
      totalKcal: sessions.reduce((sum, x) => sum + x.kcalPerSession * x.weeklyFrequency, 0),
    };
  });
  return {
    ...cycle,
    weeks,
    totalKcal: weeks.reduce((sum, w) => sum + w.totalKcal, 0),
    rationale: [...cycle.rationale, `🔗 Cross-meso: стартовый объём ×${mult} от прошлого цикла.`],
  };
}
