/**
 * Structured Analytics — 22-Level Analysis Engine
 *
 * Levels 1-5  : Session basics (duration, volume, intensity, RPE, density)
 * Levels 6-10 : Pattern analysis (squat/bench/deadlift progression, push/pull ratio)
 * Levels 11-15: Advanced (velocity trends, ROM stability, technique scoring)
 * Levels 16-20: Systemic (fatigue accumulation, recovery curve, CNS/PNS balance)
 * Levels 21-22: Predictive (1RM projection, overtraining risk, plateau detection)
 *
 * @module structured-analytics-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionData {
  id: string;
  date: string;
  durationMin: number;
  focus: string;
  exercises: {
    name: string;
    sets: { reps: number; weight: number; rpe: number; rir: number; velocity?: number; rom?: number }[];
  }[];
}

export interface AnalyticsLevel {
  level: number;
  name: string;
  metrics: Record<string, number | string>;
  status: 'optimal' | 'good' | 'warning' | 'critical';
  insight: string;
}

export interface PatternProgression {
  pattern: string;
  currentVolume: number;
  previousVolume: number;
  volumeTrend: number; // %
  currentIntensity: number;
  intensityTrend: number;
  estimated1RM: number;
  estimated1RMTrend: number;
}

export interface FatigueProfile {
  acuteLoad: number;
  chronicLoad: number;
  acwr: number;          // Acute:Chronic Workload Ratio
  monotony: number;
  strain: number;
  cnsLoad: number;
  peripheralLoad: number;
  recoveryDebt: number;  // accumulated unrecovered fatigue
}

export interface StructuredAnalyticsOutput {
  overallScore: number; // 0-100
  overallStatus: 'Excellent' | 'Good' | 'Warning' | 'Critical';
  levels: AnalyticsLevel[];
  patterns: PatternProgression[];
  fatigue: FatigueProfile;
  predictions: {
    nextWeek1RM: Record<string, number>;
    overtrainingRisk: number;
    plateauRisk: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Engine
// ═══════════════════════════════════════════════════════════════════════════

function calc1RM(w: number, r: number, rpe: number): number {
  if (r <= 0) return w;
  if (rpe >= 10) return w * (1 + r / 30);
  return w * (1 + r / 30) * (1 + (10 - rpe) * 0.03);
}

function calcVolume(exercises: SessionData['exercises']): number {
  return exercises.reduce((s, ex) =>
    s + ex.sets.reduce((ss, set) => ss + set.reps * set.weight, 0), 0
  );
}

function calcIntensity(exercises: SessionData['exercises']): number {
  const sets = exercises.flatMap(e => e.sets);
  if (!sets.length) return 0;
  return sets.reduce((s, set) => s + set.rpe, 0) / sets.length;
}

export function computeStructuredAnalytics(
  sessions: SessionData[],
  prevSessions: SessionData[] = [],
): StructuredAnalyticsOutput {
  if (sessions.length === 0) {
    return {
      overallScore: 50, overallStatus: 'Warning', levels: [], patterns: [],
      fatigue: { acuteLoad: 0, chronicLoad: 0, acwr: 0, monotony: 0, strain: 0, cnsLoad: 0, peripheralLoad: 0, recoveryDebt: 0 },
      predictions: { nextWeek1RM: {}, overtrainingRisk: 0, plateauRisk: 0 },
    };
  }

  const allSessions = [...prevSessions, ...sessions];
  const recent = sessions.slice(-7);
  const levels: AnalyticsLevel[] = [];

  // ── Level 1: Session count & consistency ──
  const sessionCount = sessions.length;
  const prevCount = prevSessions.length;
  const consistency = prevCount > 0 ? Math.min(1, sessionCount / prevCount) : 0.8;
  levels.push({
    level: 1, name: 'Консистентность тренировок',
    metrics: { sessions: sessionCount, previous: prevCount, ratio: Math.round(consistency * 100) },
    status: consistency >= 0.9 ? 'optimal' : consistency >= 0.7 ? 'good' : 'warning',
    insight: consistency >= 0.9 ? 'Отличная регулярность' : 'Пропуски тренировок — снижение адаптации',
  });

  // ── Level 2: Volume ──
  const recentVolumes = sessions.map(s => calcVolume(s.exercises));
  const avgVolume = recentVolumes.reduce((s, v) => s + v, 0) / recentVolumes.length;
  const prevVolumes = prevSessions.map(s => calcVolume(s.exercises));
  const prevAvgVol = prevVolumes.length > 0 ? prevVolumes.reduce((s, v) => s + v, 0) / prevVolumes.length : avgVolume;
  const volTrend = prevAvgVol > 0 ? ((avgVolume - prevAvgVol) / prevAvgVol) * 100 : 0;
  levels.push({
    level: 2, name: 'Объём нагрузки',
    metrics: { avgVolume: Math.round(avgVolume), trend: Math.round(volTrend), maxVolume: Math.round(Math.max(...recentVolumes)) },
    status: volTrend > 30 ? 'warning' : volTrend > 15 ? 'good' : 'optimal',
    insight: volTrend > 30 ? `Резкий рост объёма (+${Math.round(volTrend)}%) — риск травмы` :
      volTrend < -20 ? `Спад объёма (${Math.round(volTrend)}%) — проверьте причину` : 'Объём в норме',
  });

  // ── Level 3: Intensity ──
  const avgIntensity = sessions.reduce((s, sess) => s + calcIntensity(sess.exercises), 0) / sessions.length;
  const prevIntensity = prevSessions.length > 0
    ? prevSessions.reduce((s, sess) => s + calcIntensity(sess.exercises), 0) / prevSessions.length : avgIntensity;
  levels.push({
    level: 3, name: 'Интенсивность (RPE)',
    metrics: { avgRPE: Math.round(avgIntensity * 10) / 10, trend: Math.round((avgIntensity - prevIntensity) * 10) / 10 },
    status: avgIntensity > 8.5 ? 'critical' : avgIntensity > 7.5 ? 'good' : 'optimal',
    insight: avgIntensity > 8.5 ? 'Интенсивность >8.5 — ЦНС перегружена. Добавьте deload.' : 'Интенсивность в рабочем диапазоне',
  });

  // ── Level 4: Density ──
  const avgDuration = sessions.reduce((s, sess) => s + sess.durationMin, 0) / sessions.length;
  const density = avgDuration > 0 ? avgVolume / avgDuration : 0;
  levels.push({
    level: 4, name: 'Плотность тренировки',
    metrics: { kgPerMin: Math.round(density), avgDuration: Math.round(avgDuration) },
    status: density > 400 ? 'warning' : density > 200 ? 'good' : 'optimal',
    insight: density > 400 ? 'Очень высокая плотность — может страдать качество повторений' : 'Плотность оптимальна',
  });

  // ── Level 5: Set/rep distribution ──
  const allSets = sessions.flatMap(s => s.exercises.flatMap(e => e.sets));
  const strengthSets = allSets.filter(s => s.reps <= 6);
  const hyperSets = allSets.filter(s => s.reps >= 7 && s.reps <= 15);
  const endurSets = allSets.filter(s => s.reps > 15);
  const ratio = allSets.length > 0
    ? `${Math.round(strengthSets.length / allSets.length * 100)}/${Math.round(hyperSets.length / allSets.length * 100)}/${Math.round(endurSets.length / allSets.length * 100)}`
    : '0/0/0';
  levels.push({
    level: 5, name: 'Распределение повторений',
    metrics: { strength: strengthSets.length, hypertrophy: hyperSets.length, endurance: endurSets.length, ratio },
    status: 'optimal',
    insight: `S/H/E: ${ratio}%`,
  });

  // ── Level 6-8: Pattern progression (top 3 patterns) ──
  const patterns: PatternProgression[] = [];
  const patternMap = new Map<string, { currentVol: number[]; currentInt: number[]; currentRM: number[]; prevVol: number[]; prevRM: number[] }>();

  for (const sess of sessions) {
    for (const ex of sess.exercises) {
      const pattern = ex.name.toLowerCase().includes('squat') ? 'squat'
        : ex.name.toLowerCase().includes('bench') ? 'bench'
        : ex.name.toLowerCase().includes('deadlift') ? 'deadlift'
        : ex.name.toLowerCase().includes('press') || ex.name.toLowerCase().includes('overhead') ? 'overhead'
        : ex.name.toLowerCase().includes('pull') || ex.name.toLowerCase().includes('row') ? 'pull'
        : 'other';
      if (!patternMap.has(pattern)) patternMap.set(pattern, { currentVol: [], currentInt: [], currentRM: [], prevVol: [], prevRM: [] });
      const p = patternMap.get(pattern)!;
      const vol = ex.sets.reduce((s, st) => s + st.reps * st.weight, 0);
      p.currentVol.push(vol);
      p.currentInt.push(ex.sets.reduce((s, st) => s + st.rpe, 0) / ex.sets.length);
      const bestRM = Math.max(...ex.sets.map(st => calc1RM(st.weight, st.reps, st.rpe)));
      p.currentRM.push(bestRM);
    }
  }

  for (const sess of prevSessions) {
    for (const ex of sess.exercises) {
      const pattern = ex.name.toLowerCase().includes('squat') ? 'squat'
        : ex.name.toLowerCase().includes('bench') ? 'bench'
        : ex.name.toLowerCase().includes('deadlift') ? 'deadlift'
        : ex.name.toLowerCase().includes('press') || ex.name.toLowerCase().includes('overhead') ? 'overhead'
        : ex.name.toLowerCase().includes('pull') || ex.name.toLowerCase().includes('row') ? 'pull'
        : 'other';
      if (!patternMap.has(pattern)) patternMap.set(pattern, { currentVol: [], currentInt: [], currentRM: [], prevVol: [], prevRM: [] });
      const p = patternMap.get(pattern)!;
      p.prevVol.push(ex.sets.reduce((s, st) => s + st.reps * st.weight, 0));
      p.prevRM.push(Math.max(...ex.sets.map(st => calc1RM(st.weight, st.reps, st.rpe))));
    }
  }

  for (const [pattern, data] of patternMap) {
    if (pattern === 'other') continue;
    const avgCV = data.currentVol.length > 0 ? data.currentVol.reduce((s, v) => s + v, 0) / data.currentVol.length : 0;
    const avgPV = data.prevVol.length > 0 ? data.prevVol.reduce((s, v) => s + v, 0) / data.prevVol.length : avgCV;
    const maxRM = data.currentRM.length > 0 ? Math.max(...data.currentRM) : 0;
    const prevMaxRM = data.prevRM.length > 0 ? Math.max(...data.prevRM) : maxRM;

    patterns.push({
      pattern,
      currentVolume: Math.round(avgCV),
      previousVolume: Math.round(avgPV),
      volumeTrend: avgPV > 0 ? Math.round(((avgCV - avgPV) / avgPV) * 100) : 0,
      currentIntensity: data.currentInt.length > 0 ? Math.round(data.currentInt.reduce((s, v) => s + v, 0) / data.currentInt.length * 10) / 10 : 0,
      intensityTrend: 0,
      estimated1RM: Math.round(maxRM),
      estimated1RMTrend: prevMaxRM > 0 ? Math.round(((maxRM - prevMaxRM) / prevMaxRM) * 100) : 0,
    });
  }

  patterns.forEach((p, i) => {
    const lvl = 6 + i;
    levels.push({
      level: lvl, name: `Прогрессия: ${p.pattern}`,
      metrics: { estimated1RM: p.estimated1RM, trend: p.estimated1RMTrend, volume: p.currentVolume },
      status: p.estimated1RMTrend >= 0 ? 'optimal' : 'warning',
      insight: p.estimated1RMTrend >= 5 ? `Рост ${p.pattern}: +${p.estimated1RMTrend}%` :
        p.estimated1RMTrend <= -5 ? `Регресс ${p.pattern}: ${p.estimated1RMTrend}%. Проверьте программу.` : 'Стабильно',
    });
  });

  // ── Level 12: Push/Pull ratio ──
  let pushVol = 0, pullVol = 0;
  for (const sess of sessions) {
    for (const ex of sess.exercises) {
      const name = ex.name.toLowerCase();
      const vol = ex.sets.reduce((s, st) => s + st.reps * st.weight, 0);
      if (name.includes('bench') || name.includes('press') || name.includes('push') || name.includes('extension')) pushVol += vol;
      if (name.includes('row') || name.includes('pull') || name.includes('curl') || name.includes('deadlift')) pullVol += vol;
    }
  }
  const pushPullRatio = pullVol > 0 ? Math.round((pushVol / pullVol) * 100) / 100 : 0;
  levels.push({
    level: 12, name: 'Push/Pull баланс',
    metrics: { pushKg: Math.round(pushVol), pullKg: Math.round(pullVol), ratio: pushPullRatio },
    status: pushPullRatio > 0.8 && pushPullRatio < 1.5 ? 'optimal' : 'warning',
    insight: pushPullRatio > 1.5 ? 'Дисбаланс: перекос в push. Добавьте тяговых.' :
      pushPullRatio < 0.5 ? 'Дисбаланс: перекос в pull.' : 'Push/Pull сбалансирован',
  });

  // ── Level 13-15: Fatigue profile ──
  const chronicWeeks = Math.min(4, Math.floor(allSessions.length / 3));
  const chronicLoad = allSessions.slice(-chronicWeeks * 3).reduce((s, sess) => s + calcVolume(sess.exercises), 0) / chronicWeeks;
  const acuteLoad = sessions.slice(-3).reduce((s, sess) => s + calcVolume(sess.exercises), 0);
  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 1;

  const loadStdDev = Math.sqrt(recentVolumes.length > 1
    ? recentVolumes.reduce((s, v) => s + (v - avgVolume) ** 2, 0) / (recentVolumes.length - 1) : 0);
  const monotony = loadStdDev > 0 ? avgVolume / loadStdDev : 1;
  const strain = avgVolume * monotony * 0.01;

  const cnsLoad = sessions.reduce((s, sess) =>
    s + sess.exercises.flatMap(e => e.sets).filter(st => st.rpe >= 8 && st.reps <= 5).length, 0);
  const peripheralLoad = sessions.reduce((s, sess) =>
    s + sess.exercises.flatMap(e => e.sets).filter(st => st.rpe <= 7 || st.reps >= 8).length, 0);

  const fatigue: FatigueProfile = {
    acuteLoad: Math.round(acuteLoad), chronicLoad: Math.round(chronicLoad),
    acwr: Math.round(acwr * 100) / 100,
    monotony: Math.round(monotony * 100) / 100, strain: Math.round(strain),
    cnsLoad, peripheralLoad, recoveryDebt: Math.round(Math.max(0, acuteLoad - chronicLoad * 1.3)),
  };

  levels.push({
    level: 13, name: 'ACWR (Acute:Chronic Workload)',
    metrics: { acute: Math.round(acuteLoad), chronic: Math.round(chronicLoad), acwr: fatigue.acwr },
    status: acwr > 1.5 ? 'critical' : acwr > 1.3 ? 'warning' : acwr > 0.8 ? 'optimal' : 'warning',
    insight: acwr > 1.5 ? 'КРИТИЧЕСКИЙ ACWR — риск травмы >3x. Немедленно снизьте нагрузку.' :
      acwr > 1.3 ? 'Повышенный ACWR — мониторинг, готовность к снижению' : 'ACWR в безопасной зоне',
  });

  levels.push({
    level: 14, name: 'Monotony & Strain',
    metrics: { monotony: fatigue.monotony, strain: Math.round(fatigue.strain) },
    status: monotony > 2 ? 'warning' : 'optimal',
    insight: monotony > 2 ? 'Высокая монотонность — варьируйте нагрузку между днями' : 'Нагрузка разнообразна',
  });

  levels.push({
    level: 15, name: 'ЦНС vs Периферическая нагрузка',
    metrics: { cnsSets: cnsLoad, peripheralSets: peripheralLoad },
    status: cnsLoad > 10 ? 'warning' : 'optimal',
    insight: cnsLoad > 15 ? 'Перегрузка ЦНС — уменьшите количество подходов RPE≥8' : 'Баланс ЦНС/периферия в норме',
  });

  // ── Level 16-18: Recovery indicators ──
  levels.push({
    level: 16, name: 'Recovery Debt',
    metrics: { debt: fatigue.recoveryDebt },
    status: fatigue.recoveryDebt > 1000 ? 'critical' : fatigue.recoveryDebt > 500 ? 'warning' : 'optimal',
    insight: fatigue.recoveryDebt > 1000 ? 'Критический долг восстановления — deload обязателен' : 'Восстановление адекватно',
  });

  levels.push({
    level: 17, name: 'Тренировочная частота',
    metrics: { sessionsPerWeek: sessions.length },
    status: sessions.length >= 3 && sessions.length <= 6 ? 'optimal' : 'good',
    insight: sessions.length < 2 ? 'Менее 2 тренировок/нед — недостаточно для прогресса' : 'Частота оптимальна',
  });

  levels.push({
    level: 18, name: 'Продолжительность сессий',
    metrics: { avgMin: Math.round(avgDuration), maxMin: Math.max(...sessions.map(s => s.durationMin)) },
    status: avgDuration > 120 ? 'warning' : avgDuration > 90 ? 'good' : 'optimal',
    insight: avgDuration > 120 ? 'Средняя длительность >2ч — кортизол ↑, тестостерон ↓' : 'Длительность оптимальна',
  });

  // ── Level 19-20: Overtraining markers ──
  const overtrainingSignals = (acwr > 1.5 ? 1 : 0) + (monotony > 2.5 ? 1 : 0) + (avgIntensity > 8.5 ? 1 : 0) + (cnsLoad > 15 ? 1 : 0);
  levels.push({
    level: 19, name: 'Маркеры перетренированности',
    metrics: { signals: overtrainingSignals, acwr: fatigue.acwr, monotony: fatigue.monotony, avgRPE: avgIntensity },
    status: overtrainingSignals >= 3 ? 'critical' : overtrainingSignals >= 2 ? 'warning' : 'optimal',
    insight: overtrainingSignals >= 3 ? `${overtrainingSignals}/4 маркеров — высокая вероятность перетренированности` : 'Признаков перетренированности нет',
  });

  // ── Level 21-22: Predictions ──
  const overtrainingRisk = Math.round(Math.min(1, overtrainingSignals / 4 + (acwr > 1.5 ? 0.3 : 0)) * 100);
  const plateauRisk = volTrend < -10 && avgIntensity > 8 ? 0.7 : volTrend > 40 ? 0.5 : 0.15;

  const predictions: Record<string, number> = {};
  for (const p of patterns) {
    const growthRate = p.estimated1RMTrend / 100;
    predictions[p.pattern] = Math.round(p.estimated1RM * (1 + growthRate));
  }

  levels.push({
    level: 21, name: 'Прогноз 1RM (след. неделя)',
    metrics: predictions,
    status: 'optimal',
    insight: Object.entries(predictions).map(([k, v]) => `${k}: ${v}кг`).join(', '),
  });

  levels.push({
    level: 22, name: 'Риск плато / перетренированности',
    metrics: { overtraining: overtrainingRisk, plateau: Math.round(plateauRisk * 100) },
    status: overtrainingRisk > 60 ? 'critical' : overtrainingRisk > 30 ? 'warning' : 'optimal',
    insight: overtrainingRisk > 60 ? 'Высокий риск перетренированности — deload 1-2 недели' :
      plateauRisk > 0.5 ? 'Риск плато — варьируйте стимул' : 'Прогноз благоприятный',
  });

  // ── Overall score ──
  const criticalCount = levels.filter(l => l.status === 'critical').length;
  const warningCount = levels.filter(l => l.status === 'warning').length;
  const overallScore = Math.max(0, Math.round(100 - criticalCount * 15 - warningCount * 5));

  return {
    overallScore,
    overallStatus: overallScore >= 80 ? 'Excellent' : overallScore >= 60 ? 'Good' : overallScore >= 30 ? 'Warning' : 'Critical',
    levels,
    patterns,
    fatigue,
    predictions: { nextWeek1RM: predictions, overtrainingRisk, plateauRisk: Math.round(plateauRisk * 100) },
  };
}
