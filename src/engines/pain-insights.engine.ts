/**
 * pain-insights.engine.ts — Анализ паттернов боли + генерация инсайтов.
 * Чистые функции, без React/UI. Импортируются в DashboardScreen и ProfileDiariesTab.
 */

export interface PainEntry {
  date: string;
  zones: Record<string, number>;
  totalScore: number;
  timeOfDay?: string;
  painType?: string;
  triggers?: string[];
  relief?: string[];
  duration?: string;
  linkedExercise?: string;
}

import { PAIN_ZONE_LIST, computeZoneBreakdown, getMostPainfulZone, computePainImprovementStreak, computeTimeOfDayBreakdown, computeTriggerFrequency, computePainTypeDistribution, computeReliefEffectiveness } from '../ui/screens/ProfileScreen_v2/diary-helpers';

export interface PainInsight {
  id: string;
  severity: 'info' | 'warning' | 'alert';
  title: string;
  description: string;
  action?: string;
  zoneIds?: string[];
}

export interface PainAnalysis {
  hasEntries: boolean;
  totalEntries: number;
  lastEntryDate: string | null;
  avgTotalScore: number;
  worstZone: { label: string; score: number } | null;
  zoneStats: ReturnType<typeof computeZoneBreakdown>;
  streak: { streak: number; trend: 'improving' | 'stable' | 'worsening' };
  timeOfDayPeak: { label: string; avgScore: number } | null;
  topTriggers: { trigger: string; count: number; pct: number }[];
  topTypes: { type: string; count: number; avgScore: number }[];
  reliefEffectiveness: { method: string; count: number; avgScore: number; pctWithRelief: number }[];
  insights: PainInsight[];
}

const MAX_ENTRIES = 90;

export function analyzePainEntries(entries: PainEntry[]): PainAnalysis {
  const recent = entries.slice(-MAX_ENTRIES);
  const zoneStats = computeZoneBreakdown(recent);
  const worstZone = getMostPainfulZone(recent);
  const streak = computePainImprovementStreak(recent);
  const timeOfDay = computeTimeOfDayBreakdown(recent);
  const triggers = computeTriggerFrequency(recent);
  const types = computePainTypeDistribution(recent);
  const relief = computeReliefEffectiveness(recent);

  const avgTotalScore = recent.length > 0
    ? recent.reduce((s, e) => s + (e.totalScore || 0), 0) / recent.length
    : 0;

  const lastEntryDate = recent.length > 0 ? recent[recent.length - 1].date : null;

  const timeOfDayPeak = timeOfDay.length > 0
    ? timeOfDay.reduce((a, b) => a.avgScore > b.avgScore ? a : b)
    : null;

  const insights = generateInsights({
    entries: recent,
    zoneStats,
    worstZone,
    streak,
    timeOfDayPeak,
    topTriggers: triggers.slice(0, 5),
    topTypes: types.slice(0, 3),
    reliefEffectiveness: relief.slice(0, 3),
    avgTotalScore,
    lastEntryDate,
  });

  return {
    hasEntries: recent.length > 0,
    totalEntries: recent.length,
    lastEntryDate,
    avgTotalScore: Math.round(avgTotalScore * 10) / 10,
    worstZone,
    zoneStats,
    streak,
    timeOfDayPeak,
    topTriggers: triggers.slice(0, 5),
    topTypes: types.slice(0, 3),
    reliefEffectiveness: relief.slice(0, 3),
    insights,
  };
}

interface InsightContext {
  entries: PainEntry[];
  zoneStats: ReturnType<typeof computeZoneBreakdown>;
  worstZone: { label: string; score: number } | null;
  streak: { streak: number; trend: 'improving' | 'stable' | 'worsening' };
  timeOfDayPeak: { label: string; avgScore: number } | null;
  topTriggers: { trigger: string; count: number; pct: number }[];
  topTypes: { type: string; count: number; avgScore: number }[];
  reliefEffectiveness: { method: string; count: number; avgScore: number; pctWithRelief: number }[];
  avgTotalScore: number;
  lastEntryDate: string | null;
}

function generateInsights(ctx: InsightContext): PainInsight[] {
  const result: PainInsight[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const daysSinceLast = ctx.lastEntryDate
    ? Math.floor((Date.now() - new Date(ctx.lastEntryDate).getTime()) / 86400000)
    : 999;

  // ── Severity alerts ──────────────────────────────────────────────
  const highZones = ctx.zoneStats.filter(z => z.last >= 7);
  if (highZones.length > 0) {
    result.push({
      id: 'high-pain-severity',
      severity: 'alert',
      title: `Высокая боль: ${highZones.map(z => z.label).join(', ')}`,
      description: `Боль ≥7/10 в ${highZones.length} зоне. Рекомендуется снизить нагрузку и обратиться к специалисту.`,
      action: 'Снизить тренировочный объём для этой зоны',
      zoneIds: highZones.map(z => z.zoneId),
    });
  }

  const worseningZones = ctx.zoneStats.filter(z => z.trend === 'up' && z.last >= 4);
  if (worseningZones.length > 0) {
    result.push({
      id: 'worsening-trend',
      severity: 'warning',
      title: `Ухудшение: ${worseningZones.map(z => z.label).join(', ')}`,
      description: `Боль нарастает в ${worseningZones.length} зоне за последние записи.`,
      action: 'Документировать триггеры и рассмотреть протокол поддержки',
      zoneIds: worseningZones.map(z => z.zoneId),
    });
  }

  // ── Streak analysis ─────────────────────────────────────────────
  if (ctx.streak.trend === 'worsening' && ctx.streak.streak >= 3) {
    result.push({
      id: 'worsening-streak',
      severity: 'warning',
      title: `Ухудшение ${ctx.streak.streak} записей подряд`,
      description: 'Боль неуклонно растёт. Требуется коррекция протокола.',
      action: 'Обсудить с тренером/врачом изменение программы',
    });
  }

  if (ctx.streak.trend === 'improving' && ctx.streak.streak >= 3) {
    result.push({
      id: 'improving-streak',
      severity: 'info',
      title: `Улучшение ${ctx.streak.streak} записей подряд`,
      description: 'Боль снижается. Продолжать текущий протокол.',
      action: 'Продолжать текущую поддержку',
    });
  }

  // ── Pattern insights ────────────────────────────────────────────
  if (ctx.timeOfDayPeak && ctx.timeOfDayPeak.avgScore >= 5) {
    result.push({
      id: 'time-of-day-peak',
      severity: 'info',
      title: `Пик боли: ${ctx.timeOfDayPeak.label}`,
      description: `Боль усиливается в ${ctx.timeOfDayPeak.label.toLowerCase()} (ср. ${ctx.timeOfDayPeak.avgScore.toFixed(1)}/10).`,
      action: `Планировать протокол поддержки перед ${ctx.timeOfDayPeak.label.toLowerCase()}`,
    });
  }

  if (ctx.topTriggers.length > 0 && ctx.topTriggers[0].count >= 3) {
    result.push({
      id: 'frequent-trigger',
      severity: 'warning',
      title: `Частый триггер: ${ctx.topTriggers[0].trigger}`,
      description: `Триггер "${ctx.topTriggers[0].trigger}" встречается ${ctx.topTriggers[0].count} раз (${ctx.topTriggers[0].pct}%).`,
      action: `Избегать или модифицировать "${ctx.topTriggers[0].trigger}"`,
    });
  }

  if (ctx.topTypes.length > 0 && ctx.topTypes[0].count >= 3) {
    result.push({
      id: 'pain-type-dominant',
      severity: 'info',
      title: `Доминирующий тип: ${ctx.topTypes[0].type}`,
      description: `${ctx.topTypes[0].type} боль преобладает (${ctx.topTypes[0].count} записей, ср. ${ctx.topTypes[0].avgScore.toFixed(1)}/10).`,
      action: 'Выбрать протокол, соответствующий типу боли',
    });
  }

  if (ctx.reliefEffectiveness.length > 0 && ctx.reliefEffectiveness[0].avgScore >= 6 && ctx.reliefEffectiveness[0].count >= 2) {
    result.push({
      id: 'effective-relief',
      severity: 'info',
      title: `Эффективное облегчение: ${ctx.reliefEffectiveness[0].method}`,
      description: `Метод "${ctx.reliefEffectiveness[0].method}" даёт среднюю боль ${ctx.reliefEffectiveness[0].avgScore.toFixed(1)}/10 (${ctx.reliefEffectiveness[0].count} раз).`,
      action: 'Продолжать использовать этот метод',
    });
  }

  if (ctx.reliefEffectiveness.length > 0 && ctx.reliefEffectiveness[0].avgScore <= 3 && ctx.reliefEffectiveness[0].count >= 2) {
    result.push({
      id: 'ineffective-relief',
      severity: 'warning',
      title: `Неэффективное облегчение: ${ctx.reliefEffectiveness[0].method}`,
      description: `Метод "${ctx.reliefEffectiveness[0].method}" почти не помогает (ср. ${ctx.reliefEffectiveness[0].avgScore.toFixed(1)}/10).`,
      action: 'Рассмотреть альтернативные методы облегчения',
    });
  }

  // ── Stale diary ──────────────────────────────────────────────────
  if (ctx.lastEntryDate && daysSinceLast >= 7) {
    result.push({
      id: 'stale-diary',
      severity: 'info',
      title: 'Дневник боли не ведётся',
      description: `Последняя запись ${daysSinceLast} дн. назад. Регулярный трекинг помогает выявлять паттерны.`,
      action: 'Записать сегодняшнее состояние',
    });
  }

  // ── Exercise-linked pain ────────────────────────────────────────
  const exerciseLinked = ctx.entries.filter(e => e.linkedExercise && e.linkedExercise.trim().length > 0);
  if (exerciseLinked.length >= 3) {
    const exerciseCounts: Record<string, number> = {};
    for (const e of exerciseLinked) {
      const name = e.linkedExercise!.trim();
      exerciseCounts[name] = (exerciseCounts[name] || 0) + 1;
    }
    const topEx = Object.entries(exerciseCounts).sort((a, b) => b[1] - a[1])[0];
    if (topEx && topEx[1] >= 2) {
      result.push({
        id: 'exercise-linked-pain',
        severity: 'warning',
        title: `Боль связана с упражнением: ${topEx[0]}`,
        description: `Упражнение "${topEx[0]}" связано с болью ${topEx[1]} раз.`,
        action: `Пересмотреть технику или заменить "${topEx[0]}"`,
        zoneIds: ctx.zoneStats.filter(z => z.last > 0).map(z => z.zoneId),
      });
    }
  }

  // ── Overall level ───────────────────────────────────────────────
  if (ctx.avgTotalScore >= 35 && ctx.entries.length >= 7) {
    result.push({
      id: 'high-average-pain',
      severity: 'alert',
      title: 'Стабильно высокая боль',
      description: `Средний балл ${ctx.avgTotalScore.toFixed(1)}/70 за ${ctx.entries.length} записей.`,
      action: 'Рассмотреть полный протокол поддержки суставов',
    });
  }

  return result;
}

export function getPainAlerts(entries: PainEntry[]): PainInsight[] {
  if (entries.length === 0) return [];
  return analyzePainEntries(entries).insights.filter(i => i.severity === 'alert' || i.severity === 'warning');
}

export function getTodayPainStatus(entries: PainEntry[]): { status: 'ok' | 'watch' | 'alert'; message: string; color: string } | null {
  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = entries.find(e => e.date === today);
  if (!todayEntry) return null;

  const maxZone = Math.max(...Object.values(todayEntry.zones).filter(v => Number.isFinite(v)));
  if (maxZone >= 7) return { status: 'alert', message: `Боль ${maxZone}/10 — не тренировать зону`, color: '#ef4444' };
  if (maxZone >= 4) return { status: 'watch', message: `Боль ${maxZone}/10 — снизить интенсивность`, color: '#f59e0b' };
  return { status: 'ok', message: `Макс. боль ${maxZone}/10`, color: '#22c55e' };
}
