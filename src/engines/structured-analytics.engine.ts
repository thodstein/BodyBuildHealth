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
  /** Метрика не посчитана: данных нет (это не «проблема» и не «оптимально»). */
  dataMissing?: boolean;
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
  /** Тренд 1RM считается: в обоих периодах есть данные одного метода оценки. */
  rmComparable?: boolean;
}

export interface FatigueProfile {
  acuteLoad: number;
  chronicLoad: number;
  /** null — хронической базы нет, ACWR не считается. */
  acwr: number | null;
  /** null — меньше двух тренировок в периоде, разброс не посчитан. */
  monotony: number | null;
  strain: number | null;
  cnsLoad: number;
  peripheralLoad: number;
  /** null — нет хронической базы, долг восстановления не считается. */
  recoveryDebt: number | null;
}

export interface StructuredAnalyticsOutput {
  overallScore: number; // 0-100
  overallStatus: 'Excellent' | 'Good' | 'Warning' | 'Critical';
  /** Сколько уровней реально оценено: остальные — «нет данных» и не влияют на балл. */
  evaluatedLevels: number;
  /** Сколько уровней осталось без данных для метрики. */
  dataGapLevels: number;
  levels: AnalyticsLevel[];
  patterns: PatternProgression[];
  fatigue: FatigueProfile;
  predictions: {
    nextWeek1RM: Record<string, number>;
    /** null — ни одного маркера не измерено. */
    overtrainingRisk: number | null;
    /** null — нет динамики объёма, риск плато не оценивается. */
    plateauRisk: number | null;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Engine
// ═══════════════════════════════════════════════════════════════════════════

function calc1RM(w: number, r: number, rpe: number): number {
  if (r <= 0) return w;
  // RPE 0 — «оценку не вводили», а не «работал в запасе»: поправка на запас
  // (10 − rpe)·3 % давала +30 % к Epley на каждом сете из виджета без RIR.
  if (rpe <= 0 || rpe >= 10) return w * (1 + r / 30);
  return w * (1 + r / 30) * (1 + (10 - rpe) * 0.03);
}

function calcVolume(exercises: SessionData['exercises']): number {
  return exercises.reduce((s, ex) =>
    s + ex.sets.reduce((ss, set) => ss + set.reps * set.weight, 0), 0
  );
}

function calcIntensity(exercises: SessionData['exercises']): number {
  const sets = exercises.flatMap(e => e.sets);
  // Только измеренный RPE: ноль — «оценку не вводили», и деление на все сеты
  // занижало интенсивность (analytics-engine те же сеты фильтрует по rpe > 0).
  const measured = sets.filter(set => set.rpe > 0);
  if (!measured.length) return 0;
  return measured.reduce((s, set) => s + set.rpe, 0) / measured.length;
}

export function computeStructuredAnalytics(
  sessions: SessionData[],
  prevSessions: SessionData[] = [],
): StructuredAnalyticsOutput {
  if (sessions.length === 0) {
    return {
      overallScore: 50, overallStatus: 'Warning', evaluatedLevels: 0, dataGapLevels: 0, levels: [], patterns: [],
      // Непосчитанное — null и здесь: «нагрузка 0, риск 0» читались бы как измеренные.
      fatigue: { acuteLoad: 0, chronicLoad: 0, acwr: null, monotony: null, strain: null, cnsLoad: 0, peripheralLoad: 0, recoveryDebt: null },
      predictions: { nextWeek1RM: {}, overtrainingRisk: null, plateauRisk: null },
    };
  }

  // Карточка передаёт всю историю одним списком, поэтому `prevSessions` почти всегда
  // пуст. Без второго периода тренд сравнивает период сам с собой, а прогноз 1RM
  // показывает «рост +0 %» — фикция. Авто-сплит: сортируем историю по дате и делим
  // пополам — первая половина прошлый период, вторая текущий. Явно переданный
  // `prevSessions` сильнее авто-сплита; одна сессия остаётся текущим периодом
  // без прошлого.
  let currentSessions = sessions;
  let previousSessions = prevSessions;
  if (prevSessions.length === 0 && sessions.length >= 2) {
    const sorted = [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    // Граница периодов — только между РАЗНЫМИ датами: две тренировки одного дня
    // не дают тренда («+10 % за день» и прогноз 1RM из утренней сессии).
    const dayOf = (idx: number) => String(sorted[idx]?.date || '');
    const isBoundary = (idx: number) => idx > 0 && idx < sorted.length && dayOf(idx - 1) < dayOf(idx);
    let splitAt = Math.floor(sorted.length / 2);
    if (!isBoundary(splitAt)) {
      // Ищем ближайшую границу дат вперёд, затем назад.
      const forward = sorted.findIndex((_, idx) => idx >= splitAt && isBoundary(idx));
      const backward = sorted.reduce((found, _, idx) => (idx <= splitAt && isBoundary(idx) ? idx : found), -1);
      splitAt = forward >= 0 ? forward : backward;
    }
    if (isBoundary(splitAt)) {
      previousSessions = sorted.slice(0, splitAt);
      currentSessions = sorted.slice(splitAt);
    }
  }

  const allSessions = [...previousSessions, ...currentSessions];
  const recent = currentSessions.slice(-7);
  const levels: AnalyticsLevel[] = [];

  // ── Level 1: Session count & consistency ──
  const sessionCount = currentSessions.length;
  const prevCount = previousSessions.length;
  // Без прошлого периода сравнивать не с чем: прежние 0.8 по умолчанию выдавали
  // единственную тренировку за «регулярность 80 %» и статус good.
  const consistencyKnown = prevCount > 0;
  const consistency = consistencyKnown ? Math.min(1, sessionCount / prevCount) : 0;
  levels.push({
    level: 1, name: 'Консистентность тренировок',
    metrics: {
      sessions: sessionCount,
      previous: prevCount,
      ratio: consistencyKnown ? Math.round(consistency * 100) : '—',
    },
    status: !consistencyKnown ? 'warning' : consistency >= 0.9 ? 'optimal' : consistency >= 0.7 ? 'good' : 'warning',
    dataMissing: !consistencyKnown || undefined,
    insight: !consistencyKnown
      ? 'Нет прошлого периода — регулярность не с чем сравнить'
      : consistency >= 0.9 ? 'Отличная регулярность' : 'Пропуски тренировок — снижение адаптации',
  });

  // ── Level 2: Volume ──
  const recentVolumes = currentSessions.map(s => calcVolume(s.exercises));
  const avgVolume = recentVolumes.reduce((s, v) => s + v, 0) / recentVolumes.length;
  const prevVolumes = previousSessions.map(s => calcVolume(s.exercises));
  // Нулевой объём (подходы без веса, только кардио) — не «объём в норме»:
  // ни среднее, ни тренд не определены.
  const volumeKnown = avgVolume > 0;
  const prevAvgVol = prevVolumes.length > 0
    ? prevVolumes.reduce((s, v) => s + v, 0) / prevVolumes.length
    : 0;
  const volTrendKnown = volumeKnown && prevAvgVol > 0;
  const volTrend = volTrendKnown ? ((avgVolume - prevAvgVol) / prevAvgVol) * 100 : 0;
  levels.push({
    level: 2, name: 'Объём нагрузки',
    metrics: {
      avgVolume: Math.round(avgVolume),
      trend: volTrendKnown ? Math.round(volTrend) : '—',
      maxVolume: Math.round(Math.max(...recentVolumes)),
    },
    // Ноль тренда без прошлого периода — не «объём в норме», а отсутствие сравнения.
    status: !volTrendKnown ? 'warning' : volTrend > 30 || volTrend < -20 ? 'warning' : volTrend > 15 ? 'good' : 'optimal',
    dataMissing: !volTrendKnown || undefined,
    insight: !volumeKnown ? 'Объём нулевой — динамику оценить нельзя' :
      !volTrendKnown ? 'Нет прошлого периода — динамика объёма не считается' :
      volTrend > 30 ? `Резкий рост объёма (+${Math.round(volTrend)}%) — риск травмы` :
      volTrend < -20 ? `Спад объёма (${Math.round(volTrend)}%) — проверьте причину` : 'Объём в норме',
  });

  // ── Level 3: Intensity ──
  // Сессии без измеренного RPE (все подходы `rpe: 0`) в среднее не входят: жёсткий
  // ноль занижал интенсивность недели и переключал статус на «optimal».
  const measuredIntensity = currentSessions.map(sess => calcIntensity(sess.exercises)).filter(v => v > 0);
  const prevMeasuredIntensity = previousSessions.map(sess => calcIntensity(sess.exercises)).filter(v => v > 0);
  const avgIntensity = measuredIntensity.length > 0
    ? measuredIntensity.reduce((s, v) => s + v, 0) / measuredIntensity.length : 0;
  const prevIntensity = prevMeasuredIntensity.length > 0
    ? prevMeasuredIntensity.reduce((s, v) => s + v, 0) / prevMeasuredIntensity.length : 0;
  // Тренд требует измерений в ОБОИХ периодах: без прошлого RPE «0.0» — не стабильность.
  const intensityTrendKnown = measuredIntensity.length > 0 && prevMeasuredIntensity.length > 0;
  levels.push({
    level: 3, name: 'Интенсивность (RPE)',
    metrics: {
      avgRPE: Math.round(avgIntensity * 10) / 10,
      trend: intensityTrendKnown ? Math.round((avgIntensity - prevIntensity) * 10) / 10 : '—',
    },
    // Ноль здесь — «RPE не вводили», а не «работал легко»: без измерений статус не
    // должен читаться как «оптимально», иначе честные данные выглядят хорошим результатом.
    status: measuredIntensity.length === 0 ? 'warning' : avgIntensity > 8.5 ? 'critical' : avgIntensity > 7.5 ? 'good' : 'optimal',
    dataMissing: measuredIntensity.length === 0 || undefined,
    insight: measuredIntensity.length === 0 ? 'RPE не измерялся — интенсивность не оценивается' :
      avgIntensity > 8.5 ? 'Интенсивность >8.5 — ЦНС перегружена. Добавьте deload.' : 'Интенсивность в рабочем диапазоне',
  });

  // ── Level 4: Density ──
  // Усредняем только сессии с измеренной длительностью: 0 — «неизвестно».
  const timedSessions = currentSessions.filter(sess => (Number(sess.durationMin) || 0) > 0);
  const avgDuration = timedSessions.length > 0
    ? timedSessions.reduce((s, sess) => s + (Number(sess.durationMin) || 0), 0) / timedSessions.length
    : 0;
  const density = avgDuration > 0 ? avgVolume / avgDuration : 0;
  // Плотность — кг/мин: без длительности ИЛИ без тоннажа она не определена.
  const densityKnown = timedSessions.length > 0 && avgVolume > 0;
  levels.push({
    level: 4, name: 'Плотность тренировки',
    metrics: {
      kgPerMin: densityKnown ? Math.round(density) : '—',
      avgDuration: timedSessions.length > 0 ? Math.round(avgDuration) : '—',
    },
    status: !densityKnown ? 'warning' : density > 400 ? 'warning' : density > 200 ? 'good' : 'optimal',
    dataMissing: !densityKnown || undefined,
    insight: timedSessions.length === 0 ? 'Длительность не записана — плотность не считается' :
      !volumeKnown ? 'Объём нулевой — плотность не считается' :
      density > 400 ? 'Очень высокая плотность — может страдать качество повторений' : 'Плотность оптимальна',
  });

  // ── Level 5: Set/rep distribution ──
  const allSets = currentSessions.flatMap(s => s.exercises.flatMap(e => e.sets));
  const strengthSets = allSets.filter(s => s.reps <= 6);
  const hyperSets = allSets.filter(s => s.reps >= 7 && s.reps <= 15);
  const endurSets = allSets.filter(s => s.reps > 15);
  const ratio = allSets.length > 0
    ? `${Math.round(strengthSets.length / allSets.length * 100)}/${Math.round(hyperSets.length / allSets.length * 100)}/${Math.round(endurSets.length / allSets.length * 100)}`
    : '—';
  levels.push({
    level: 5, name: 'Распределение повторений',
    metrics: { strength: strengthSets.length, hypertrophy: hyperSets.length, endurance: endurSets.length, ratio },
    status: allSets.length === 0 ? 'warning' : 'optimal',
    dataMissing: allSets.length === 0 || undefined,
    insight: allSets.length === 0 ? 'Подходов нет — распределение повторений не оценивается' : `S/H/E: ${ratio}%`,
  });

  // ── Level 6-8: Pattern progression (top 3 patterns) ──
  const patterns: PatternProgression[] = [];
  const patternMap = new Map<string, { currentVol: number[]; currentInt: number[]; currentRM: number[]; currentRmMeasured: boolean[]; prevVol: number[]; prevRM: number[]; prevRmMeasured: boolean[] }>();

  for (const sess of currentSessions) {
    for (const ex of sess.exercises) {
      // Подходов нет — и «лучшего 1RM» нет: Math.max() по пустому массиву даёт -Infinity.
      if (ex.sets.length === 0) continue;
      const pattern = ex.name.toLowerCase().includes('squat') ? 'squat'
        : ex.name.toLowerCase().includes('bench') ? 'bench'
        : ex.name.toLowerCase().includes('deadlift') ? 'deadlift'
        : ex.name.toLowerCase().includes('press') || ex.name.toLowerCase().includes('overhead') ? 'overhead'
        : ex.name.toLowerCase().includes('pull') || ex.name.toLowerCase().includes('row') ? 'pull'
        : 'other';
      if (!patternMap.has(pattern)) patternMap.set(pattern, { currentVol: [], currentInt: [], currentRM: [], currentRmMeasured: [], prevVol: [], prevRM: [], prevRmMeasured: [] });
      const p = patternMap.get(pattern)!;
      const vol = ex.sets.reduce((s, st) => s + st.reps * st.weight, 0);
      p.currentVol.push(vol);
      // Ноль — «оценку не вводили»: такой подход не должен тянуть среднюю вниз.
      const measuredSets = ex.sets.filter(st => st.rpe > 0);
      if (measuredSets.length) {
        p.currentInt.push(measuredSets.reduce((s, st) => s + st.rpe, 0) / measuredSets.length);
      }
      // Если RPE измерен хотя бы в одном подходе, лучший 1RM берём только из них:
      // незаполненный rpe не делает подход «отказным», но и рекордом периода быть не должен.
      const rmSets = measuredSets.length ? measuredSets : ex.sets;
      const bestRM = Math.max(...rmSets.map(st => calc1RM(st.weight, st.reps, st.rpe)));
      p.currentRM.push(bestRM);
      // Метод оценки: поправка на RPE применяется только там, где RPE измерен.
      p.currentRmMeasured.push(measuredSets.length > 0);
    }
  }

  for (const sess of previousSessions) {
    for (const ex of sess.exercises) {
      if (ex.sets.length === 0) continue;
      const pattern = ex.name.toLowerCase().includes('squat') ? 'squat'
        : ex.name.toLowerCase().includes('bench') ? 'bench'
        : ex.name.toLowerCase().includes('deadlift') ? 'deadlift'
        : ex.name.toLowerCase().includes('press') || ex.name.toLowerCase().includes('overhead') ? 'overhead'
        : ex.name.toLowerCase().includes('pull') || ex.name.toLowerCase().includes('row') ? 'pull'
        : 'other';
      if (!patternMap.has(pattern)) patternMap.set(pattern, { currentVol: [], currentInt: [], currentRM: [], currentRmMeasured: [], prevVol: [], prevRM: [], prevRmMeasured: [] });
      const p = patternMap.get(pattern)!;
      p.prevVol.push(ex.sets.reduce((s, st) => s + st.reps * st.weight, 0));
      const prevMeasured = ex.sets.filter(st => st.rpe > 0);
      const prevRmSets = prevMeasured.length ? prevMeasured : ex.sets;
      p.prevRM.push(Math.max(...prevRmSets.map(st => calc1RM(st.weight, st.reps, st.rpe))));
      p.prevRmMeasured.push(prevMeasured.length > 0);
    }
  }

  for (const [pattern, data] of patternMap) {
    if (pattern === 'other') continue;
    const avgCV = data.currentVol.length > 0 ? data.currentVol.reduce((s, v) => s + v, 0) / data.currentVol.length : 0;
    const avgPV = data.prevVol.length > 0 ? data.prevVol.reduce((s, v) => s + v, 0) / data.prevVol.length : avgCV;
    // Если в периоде есть измеренные подходы, незаполненные в «лучший 1RM» не идут:
    // иначе 20-повторный сет без RPE перебивал измеренный рекорд. Тренд сравниваем
    // только внутри одного метода — иначе честный отказ от RPE читался как регресс.
    const anyCurrentMeasured = data.currentRmMeasured.some(Boolean);
    const anyPrevMeasured = data.prevRmMeasured.some(Boolean);
    const currentRm = anyCurrentMeasured
      ? data.currentRM.filter((_, i) => data.currentRmMeasured[i])
      : data.currentRM;
    const prevRm = anyPrevMeasured ? data.prevRM.filter((_, i) => data.prevRmMeasured[i]) : data.prevRM;
    const maxRM = currentRm.length > 0 ? Math.max(...currentRm) : 0;
    const prevMaxRM = prevRm.length > 0 ? Math.max(...prevRm) : maxRM;
    // Сравнивать нечего, если один из периодов пуст: иначе «упражнение убрали из
    // программы» читалось как регресс −100 % и прогноз 0 кг.
    const rmComparable =
      data.currentRM.length > 0 &&
      data.prevRM.length > 0 &&
      (data.prevRmMeasured.length === 0 || anyCurrentMeasured === anyPrevMeasured);

    patterns.push({
      pattern,
      currentVolume: Math.round(avgCV),
      previousVolume: Math.round(avgPV),
      volumeTrend: avgPV > 0 ? Math.round(((avgCV - avgPV) / avgPV) * 100) : 0,
      currentIntensity: data.currentInt.length > 0 ? Math.round(data.currentInt.reduce((s, v) => s + v, 0) / data.currentInt.length * 10) / 10 : 0,
      intensityTrend: 0,
      estimated1RM: Math.round(maxRM),
      estimated1RMTrend: rmComparable && prevMaxRM > 0 ? Math.round(((maxRM - prevMaxRM) / prevMaxRM) * 100) : 0,
      // Ноль тренда при несравнимых периодах — не «стабильно»: экран обязан отличать
      // «нет сравнимых данных» от настоящего нуля.
      rmComparable,
    });
  }

  patterns.forEach((p, i) => {
    const lvl = 6 + i;
    levels.push({
      level: lvl, name: `Прогрессия: ${p.pattern}`,
      metrics: { estimated1RM: p.estimated1RM, trend: p.estimated1RMTrend, volume: p.currentVolume },
      status: p.rmComparable === false ? 'warning' : p.estimated1RMTrend >= 0 ? 'optimal' : 'warning',
      dataMissing: p.rmComparable === false || undefined,
      insight: p.rmComparable === false ? 'Нет сравнимых данных за период — тренд 1RM не считается' :
        p.estimated1RMTrend >= 5 ? `Рост ${p.pattern}: +${p.estimated1RMTrend}%` :
        p.estimated1RMTrend <= -5 ? `Регресс ${p.pattern}: ${p.estimated1RMTrend}%. Проверьте программу.` : 'Стабильно',
    });
  });

  // ── Level 12: Push/Pull ratio ──
  let pushVol = 0, pullVol = 0;
  for (const sess of currentSessions) {
    for (const ex of sess.exercises) {
      const name = ex.name.toLowerCase();
      const vol = ex.sets.reduce((s, st) => s + st.reps * st.weight, 0);
      if (name.includes('bench') || name.includes('press') || name.includes('push') || name.includes('extension')) pushVol += vol;
      if (name.includes('row') || name.includes('pull') || name.includes('curl') || name.includes('deadlift')) pullVol += vol;
    }
  }
  const pushPullKnown = pushVol > 0 || pullVol > 0;
  const pushPullRatio = pullVol > 0 ? Math.round((pushVol / pullVol) * 100) / 100 : 0;
  levels.push({
    level: 12, name: 'Push/Pull баланс',
    metrics: {
      pushKg: Math.round(pushVol),
      pullKg: Math.round(pullVol),
      ratio: pullVol > 0 ? pushPullRatio : '—',
    },
    // Ноль в знаменателе — не дисбаланс «в pull»: без тяги перекос в push, а без
    // обеих категорий сравнивать нечего (например, только присед).
    status: !pushPullKnown ? 'warning' : pushPullRatio > 0.8 && pushPullRatio < 1.5 ? 'optimal' : 'warning',
    dataMissing: !pushPullKnown || undefined,
    insight: !pushPullKnown ? 'Нет данных push/pull — сравнивать нечего' :
      pullVol === 0 ? 'Тяговых упражнений нет — перекос в push.' :
      pushVol === 0 ? 'Жимовых упражнений нет — перекос в pull.' :
      pushPullRatio > 1.5 ? 'Дисбаланс: перекос в push. Добавьте тяговых.' :
      pushPullRatio < 0.5 ? 'Дисбаланс: перекос в pull.' : 'Push/Pull сбалансирован',
  });

  // ── Level 13-15: Fatigue profile ──
  // Хроническая база — минимум 3 тренировки. При `chronicWeeks = 0` прежняя формула
  // делила на ноль: chronicLoad становился Infinity, ACWR — 0, а уровень 13 печатал
  // «ACWR в безопасной зоне» для метрики, которой нет.
  const chronicWeeks = Math.min(4, Math.floor(allSessions.length / 3));
  const chronicLoad = chronicWeeks > 0
    ? allSessions.slice(-chronicWeeks * 3).reduce((s, sess) => s + calcVolume(sess.exercises), 0) / chronicWeeks
    : 0;
  const acuteLoad = currentSessions.slice(-3).reduce((s, sess) => s + calcVolume(sess.exercises), 0);
  const acwrComputed = chronicWeeks > 0 && chronicLoad > 0;
  const acwr = acwrComputed ? acuteLoad / chronicLoad : 0;

  const loadStdDev = Math.sqrt(recentVolumes.length > 1
    ? recentVolumes.reduce((s, v) => s + (v - avgVolume) ** 2, 0) / (recentVolumes.length - 1) : 0);
  // Монотонность — разброс объёма МЕЖДУ тренировками: по одной тренировке его нет,
  // и прежний «monotony 1» означал лишь нулевой разброс выборки из одного значения.
  const monotonyKnown = recentVolumes.length > 1 && avgVolume > 0;
  const monotony = monotonyKnown ? (loadStdDev > 0 ? avgVolume / loadStdDev : 1) : 0;
  const strain = monotonyKnown ? avgVolume * monotony * 0.01 : 0;

  const cnsLoad = currentSessions.reduce((s, sess) =>
    s + sess.exercises.flatMap(e => e.sets).filter(st => st.rpe >= 8 && st.reps <= 5).length, 0);
  // Подход без RPE — не «периферическая работа»: он просто не измерен.
  const peripheralLoad = currentSessions.reduce((s, sess) =>
    s + sess.exercises.flatMap(e => e.sets).filter(st => st.rpe > 0 && (st.rpe <= 7 || st.reps >= 8)).length, 0);
  // Измерен ли ЦНС-вход вообще: без единого RPE «баланс в норме» — не вывод.
  const cnsKnown = allSets.some(st => st.rpe > 0);

  // Непосчитанные показатели — null, а не 0/1: иначе API отдаёт «нагрузка сбалансирована»
  // там, где базы для расчёта нет.
  const acwrRounded = acwrComputed ? Math.round(acwr * 100) / 100 : null;
  const monotonyRounded = monotonyKnown ? Math.round(monotony * 100) / 100 : null;
  const recoveryDebt = acwrComputed ? Math.round(Math.max(0, acuteLoad - chronicLoad * 1.3)) : null;
  const fatigue: FatigueProfile = {
    acuteLoad: Math.round(acuteLoad), chronicLoad: Math.round(chronicLoad),
    acwr: acwrRounded,
    monotony: monotonyRounded, strain: monotonyKnown ? Math.round(strain) : null,
    cnsLoad, peripheralLoad, recoveryDebt,
  };

  levels.push({
    level: 13, name: 'ACWR (Acute:Chronic Workload)',
    metrics: {
      acute: Math.round(acuteLoad),
      chronic: Math.round(chronicLoad),
      acwr: acwrRounded ?? '—',
    },
    status: !acwrComputed ? 'warning' : acwr > 1.5 ? 'critical' : acwr > 1.3 ? 'warning' : acwr > 0.8 ? 'optimal' : 'warning',
    dataMissing: !acwrComputed || undefined,
    insight: !acwrComputed ? 'Меньше 3 тренировок в истории — ACWR не считается' :
      acwr > 1.5 ? 'КРИТИЧЕСКИЙ ACWR — риск травмы >3x. Немедленно снизьте нагрузку.' :
      acwr > 1.3 ? 'Повышенный ACWR — мониторинг, готовность к снижению' :
      acwr <= 0.8 ? 'ACWR 0.8 и ниже — нагрузка ниже базы, риск детренированности' : 'ACWR в безопасной зоне',
  });

  levels.push({
    level: 14, name: 'Monotony & Strain',
    metrics: monotonyRounded !== null
      ? { monotony: monotonyRounded, strain: Math.round(strain) }
      : { monotony: '—', strain: '—' },
    status: !monotonyKnown ? 'warning' : monotony > 2 ? 'warning' : 'optimal',
    dataMissing: !monotonyKnown || undefined,
    insight: !monotonyKnown ? 'Меньше 2 тренировок в периоде — монотонность не считается' :
      monotony > 2 ? 'Высокая монотонность — варьируйте нагрузку между днями' : 'Нагрузка разнообразна',
  });

  levels.push({
    level: 15, name: 'ЦНС vs Периферическая нагрузка',
    metrics: cnsKnown ? { cnsSets: cnsLoad, peripheralSets: peripheralLoad } : { cnsSets: '—', peripheralSets: '—' },
    status: !cnsKnown ? 'warning' : cnsLoad > 10 ? 'warning' : 'optimal',
    dataMissing: !cnsKnown || undefined,
    insight: allSets.length === 0 ? 'Подходов нет — баланс ЦНС/периферия не оценивается' :
      !cnsKnown ? 'RPE не измерялся — баланс ЦНС/периферия не оценивается' :
      cnsLoad > 10 ? 'Много подходов RPE≥8 на малые повторы — следите за ЦНС' : 'Баланс ЦНС/периферия в норме',
  });

  // ── Level 16-18: Recovery indicators ──
  const debtValue = recoveryDebt ?? 0;
  levels.push({
    level: 16, name: 'Recovery Debt',
    metrics: { debt: recoveryDebt ?? '—' },
    status: recoveryDebt === null ? 'warning' : debtValue > 1000 ? 'critical' : debtValue > 500 ? 'warning' : 'optimal',
    dataMissing: recoveryDebt === null || undefined,
    insight: recoveryDebt === null ? 'Нет хронической базы — долг восстановления не считается' :
      debtValue > 1000 ? 'Критический долг восстановления — deload обязателен' : 'Восстановление адекватно',
  });

  // Частота — тренировок в неделю за длину окна периода, а не длина массива: после
  // деления истории пополам 40 записей читались как «40 тренировок/нед».
  const levelDates = currentSessions
    .map((sess) => Date.parse(`${String(sess.date || '')}T00:00:00Z`))
    .filter((t) => Number.isFinite(t));
  const spanDays =
    levelDates.length >= 2 ? Math.max(1, (Math.max(...levelDates) - Math.min(...levelDates)) / 86400000 + 1) : 0;
  const sessionsPerWeek =
    spanDays > 0 ? Math.round((currentSessions.length / (spanDays / 7)) * 10) / 10 : currentSessions.length;
  const frequencyKnown = spanDays > 0;
  levels.push({
    level: 17, name: 'Тренировочная частота',
    metrics: { sessionsPerWeek: frequencyKnown ? sessionsPerWeek : '—' },
    status: !frequencyKnown || sessionsPerWeek < 2 ? 'warning' : sessionsPerWeek >= 3 && sessionsPerWeek <= 6 ? 'optimal' : 'good',
    dataMissing: !frequencyKnown || undefined,
    insight: !frequencyKnown ? 'Одна тренировка — частоту в неделю не определить' :
      sessionsPerWeek < 2 ? 'Менее 2 тренировок/нед — недостаточно для прогресса' : 'Частота оптимальна',
  });

  levels.push({
    level: 18, name: 'Продолжительность сессий',
    metrics: timedSessions.length > 0
      ? { avgMin: Math.round(avgDuration), maxMin: Math.max(...timedSessions.map(s => Number(s.durationMin) || 0)) }
      : { avgMin: '—', maxMin: '—' },
    status: timedSessions.length === 0 ? 'warning' : avgDuration > 120 ? 'warning' : avgDuration > 90 ? 'good' : 'optimal',
    dataMissing: timedSessions.length === 0 || undefined,
    insight: timedSessions.length === 0 ? 'Длительность не записана — средняя не считается' :
      avgDuration > 120 ? 'Средняя длительность >2ч — кортизол ↑, тестостерон ↓' : 'Длительность оптимальна',
  });

  // ── Level 19-20: Overtraining markers ──
  // Маркер считается только из измеренного входа: ACWR без хронической базы и
  // монотонность по одной тренировке не могут «не сработать» — их просто нет.
  const intensityKnown = measuredIntensity.length > 0;
  const overtrainingSignals =
    (acwrComputed && acwr > 1.5 ? 1 : 0) +
    (monotonyKnown && monotony > 2.5 ? 1 : 0) +
    (intensityKnown && avgIntensity > 8.5 ? 1 : 0) +
    (cnsKnown && cnsLoad > 15 ? 1 : 0);
  const measuredMarkers = [acwrComputed, monotonyKnown, intensityKnown, cnsKnown].filter(Boolean).length;
  // Хотя бы один маркер должен быть измерен: иначе «признаков нет» — не вывод,
  // а отсутствие входных данных.
  const signalsKnown = measuredMarkers > 0;
  levels.push({
    level: 19, name: 'Маркеры перетренированности',
    metrics: signalsKnown
      ? {
          signals: overtrainingSignals,
          measured: measuredMarkers,
          acwr: acwrRounded ?? '—',
          monotony: monotonyRounded ?? '—',
          avgRPE: intensityKnown ? Math.round(avgIntensity * 100) / 100 : '—',
        }
      : { signals: '—' },
    status: !signalsKnown ? 'warning' : overtrainingSignals >= 3 ? 'critical' : overtrainingSignals >= 2 ? 'warning' : 'optimal',
    dataMissing: !signalsKnown || undefined,
    insight: !signalsKnown ? 'Нет измеренных маркеров — риск перетренированности не оценивается' :
      overtrainingSignals >= 3 ? `${overtrainingSignals}/4 маркеров — высокая вероятность перетренированности` :
      `Признаков перетренированности нет (проверено ${measuredMarkers} из 4 маркеров)`,
  });

  // ── Level 21-22: Predictions ──
  const overtrainingRisk = signalsKnown
    ? Math.round(Math.min(1, overtrainingSignals / 4 + (acwrComputed && acwr > 1.5 ? 0.3 : 0)) * 100)
    : null;
  // Плато — про динамику объёма при известной интенсивности: без тренда объёма
  // это не «низкий риск», а отсутствие оценки.
  const plateauRisk = volTrendKnown
    ? (volTrend < -10 && intensityKnown && avgIntensity > 8 ? 0.7 : volTrend > 40 ? 0.5 : 0.15)
    : null;
  const plateauRiskPct = plateauRisk === null ? null : Math.round(plateauRisk * 100);

  // Прогноз строится только по измеренному 1RM и только против сравнимого прошлого
  // периода: у паттерна без текущего периода `estimated1RM` — 0 («squat: 0 кг»),
  // а без прошлого рост считался от самого себя (+0 %) — это не прогноз, а эхо.
  const predictions: Record<string, number> = {};
  const predictionParts: string[] = [];
  for (const p of patterns) {
    if (p.estimated1RM <= 0 || p.rmComparable !== true) continue;
    const growthRate = p.estimated1RMTrend / 100;
    const nextWeek = Math.round(p.estimated1RM * (1 + growthRate));
    predictions[p.pattern] = nextWeek;
    const sign = p.estimated1RMTrend > 0 ? '+' : '';
    predictionParts.push(`${p.pattern}: ${nextWeek}кг (${sign}${p.estimated1RMTrend}%)`);
  }

  const predictionsKnown = Object.keys(predictions).length > 0;
  levels.push({
    level: 21, name: 'Прогноз 1RM (след. неделя)',
    metrics: predictionsKnown ? predictions : { forecast: '—' },
    status: predictionsKnown ? 'optimal' : 'warning',
    dataMissing: !predictionsKnown || undefined,
    insight: predictionParts.length > 0
      ? predictionParts.join(', ')
      : 'Нет сравнимых периодов для прогноза 1RM',
  });

  // «Прогноз благоприятный» возможен только при измеримых входах: отсутствие
  // данных об объёме и интенсивности — не хорошая новость, а отсутствие оценки.
  const riskKnown = overtrainingRisk !== null || plateauRisk !== null;
  const otRisk = overtrainingRisk ?? 0;
  const plateauValue = plateauRisk ?? 0;
  levels.push({
    level: 22, name: 'Риск плато / перетренированности',
    metrics: riskKnown
      ? { overtraining: overtrainingRisk ?? '—', plateau: plateauRiskPct ?? '—' }
      : { overtraining: '—', plateau: '—' },
    status: !riskKnown ? 'warning' : otRisk > 60 ? 'critical' : otRisk > 30 || plateauValue > 0.5 ? 'warning' : 'optimal',
    dataMissing: !riskKnown || undefined,
    insight: !riskKnown ? 'Нет данных об объёме и интенсивности — риск не оценивается' :
      otRisk > 60 ? 'Высокий риск перетренированности — deload 1-2 недели' :
      plateauValue > 0.5 ? 'Риск плато — варьируйте стимул' :
      plateauRisk === null ? 'Признаков перетренированности нет; риск плато не оценивается — нет динамики объёма' :
      'Прогноз благоприятный',
  });

  // ── Overall score ──
  // Уровни без данных не штрафуют оценку: иначе «RPE не вводили» и «нет длительности»
  // роняли балл так же, как реальные проблемы, и оценка мерила полноту дневника,
  // а не качество тренировочного процесса.
  const evaluated = levels.filter(l => l.dataMissing !== true);
  const criticalCount = evaluated.filter(l => l.status === 'critical').length;
  const warningCount = evaluated.filter(l => l.status === 'warning').length;
  const overallScore = Math.max(0, Math.round(100 - criticalCount * 15 - warningCount * 5));

  return {
    overallScore,
    evaluatedLevels: evaluated.length,
    dataGapLevels: levels.length - evaluated.length,
    overallStatus: overallScore >= 80 ? 'Excellent' : overallScore >= 60 ? 'Good' : overallScore >= 30 ? 'Warning' : 'Critical',
    levels,
    patterns,
    fatigue,
    predictions: { nextWeek1RM: predictions, overtrainingRisk, plateauRisk: plateauRiskPct },
  };
}
