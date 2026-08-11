/**
 * health-improvement-plan.engine.ts — Генератор персонального плана улучшений здоровья.
 *
 * Чистые функции: анализ дневника (analyzeHealthProfile) → рекомендации с приоритетами
 * (generateHealthPlan) → сводка (summarizeHealthPlan) и текстовый экспорт.
 * Storage-хелперы для UI: saveHealthPlan/loadHealthPlan/savePlanDone/loadPlanDone.
 */

import type { UnifiedHealthEntry } from './health-diary.engine';
import { PAIN_ZONE_LIST } from '../ui/screens/ProfileScreen_v2/diary-helpers';

export type HealthPriority = 'critical' | 'high' | 'medium' | 'low';
export type HealthDomain = 'pain' | 'symptoms' | 'neuro' | 'acne' | 'hemato' | 'adherence';

export interface HealthRecommendation {
  id: string;
  domain: HealthDomain;
  priority: HealthPriority;
  title: string;
  rationale: string;
  action: string;
  zoneIds?: string[];
}

export interface ZoneTrend {
  id: string;
  label: string;
  avg: number;
  last: number;
  trend: 'up' | 'down' | 'same';
}

export interface HealthPlanCtx {
  sleepAvg7?: number | null;        // средние часы сна за 7 дней
  bpSystolicLast?: number | null;   // последняя систола АД
  bpDiastolicLast?: number | null;  // последняя диастола АД
  weightTrendKgWeek?: number | null; // тренд веса, кг/нед
  onCycle?: boolean;                 // активная фарма/курс
}

export interface HealthProfileAnalysis {
  totalEntries: number;
  firstDate: string | null;
  lastDate: string | null;
  daysCovered: number;
  ctx: HealthPlanCtx;
  pain: {
    avg7: number | null;
    avg30: number | null;
    max: number;
    worstZone: { id: string; label: string; avg: number } | null;
    worseningZones: ZoneTrend[];
    topTriggers: { trigger: string; count: number; pct: number }[];
    timeOfDayPeak: { label: string; avgScore: number } | null;
    linkedExercise: { name: string; count: number } | null;
  };
  symptoms: { name: string; count: number; avgSeverity: number }[];
  neuro: { entries: number; lastTotal: number; avg: number };
  acne: { entries: number; lastTotal: number; avg: number };
  hemato: { entries: number; lastTotal: number; avg: number };
  adherence: { entriesLast14: number; pct: number; lastEntryDaysAgo: number | null };
  trend: { weekMean: number | null; prevWeekMean: number | null; deltaPct: number | null };
}

export interface HealthPlan {
  generatedAt: string;
  recommendations: HealthRecommendation[];
  summary: { critical: number; high: number; medium: number; low: number; verdict: string };
}

const PLAN_KEY = 'he_health_plan';
const PLAN_DONE_KEY = 'he_health_plan_done';

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(iso: string, from: string): number | null {
  const a = Date.parse(iso);
  const b = Date.parse(from);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((b - a) / 86400000));
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

// ─── Анализ профиля ──────────────────────────────────────────────────────────

export function analyzeHealthProfile(entries: UnifiedHealthEntry[], ctx: HealthPlanCtx = {}): HealthProfileAnalysis {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const today = todayLocal();
  const lastDate = sorted.length ? sorted[sorted.length - 1].date : null;
  const firstDate = sorted.length ? sorted[0].date : null;
  const daysCovered = firstDate && lastDate ? daysAgo(firstDate, lastDate) ?? 0 : 0;

  const windowAvg = (days: number): number | null => {
    if (sorted.length === 0) return null;
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    const fromIso = localIso(from);
    const inWindow = sorted.filter((e) => e.date >= fromIso && e.date <= today);
    if (inWindow.length === 0) return null;
    return round1(mean(inWindow.map((e) => e.pain?.totalScore || 0)) ?? 0);
  };

  const painEntries = sorted.filter((e) => e.pain && e.pain.totalScore > 0);
  const maxPain = painEntries.length ? Math.max(...painEntries.map((e) => e.pain!.totalScore)) : 0;

  // Зоны: средние, последнее значение и тренд на возрастающих данных
  const zoneStats: ZoneTrend[] = PAIN_ZONE_LIST.map((z) => {
    const values = sorted
      .filter((e) => e.pain && Number.isFinite(e.pain!.zones[z.id]))
      .map((e) => e.pain!.zones[z.id]);
    const last = values.length ? values[values.length - 1] : 0;
    const prev = values.length > 1 ? values[values.length - 2] : last;
    return {
      id: z.id,
      label: z.label,
      avg: round1(values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0),
      last,
      trend: last > prev + 0.3 ? 'up' : last < prev - 0.3 ? 'down' : 'same',
    };
  });
  const worstZoneStats = zoneStats.filter((z) => z.avg > 0).reduce<ZoneTrend | null>(
    (best, cur) => (!best || cur.avg > best.avg ? cur : best),
    null,
  );
  const worseningZones = zoneStats.filter((z) => z.trend === 'up' && z.last >= 4);

  const triggerCounts = new Map<string, number>();
  for (const e of painEntries) for (const t of e.pain!.triggers || []) triggerCounts.set(t, (triggerCounts.get(t) || 0) + 1);
  const topTriggers = [...triggerCounts.entries()]
    .map(([trigger, count]) => ({ trigger, count, pct: painEntries.length ? Math.round((count / painEntries.length) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  const timeOfDayGroups = new Map<string, number[]>();
  for (const e of painEntries) {
    if (!e.pain!.timeOfDay) continue;
    timeOfDayGroups.set(e.pain!.timeOfDay, [...(timeOfDayGroups.get(e.pain!.timeOfDay) || []), e.pain!.totalScore]);
  }
  const timeOfDayPeak = [...timeOfDayGroups.entries()]
    .map(([label, values]) => ({ label, avgScore: round1(mean(values) ?? 0), count: values.length }))
    .sort((a, b) => b.avgScore - a.avgScore)[0] || null;

  const exCounts = new Map<string, number>();
  for (const e of painEntries) {
    const name = (e.pain!.linkedExercise || '').trim();
    if (name) exCounts.set(name, (exCounts.get(name) || 0) + 1);
  }
  const linkedExercise = [...exCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)[0] || null;

  const symMap = new Map<string, { count: number; severity: number }>();
  for (const e of sorted) {
    for (const s of e.symptoms) {
      const cur = symMap.get(s.name) || { count: 0, severity: 0 };
      symMap.set(s.name, { count: cur.count + 1, severity: cur.severity + s.severity });
    }
  }
  const symptoms = [...symMap.entries()]
    .map(([name, d]) => ({ name, count: d.count, avgSeverity: round1(d.severity / d.count) }))
    .sort((a, b) => b.count - a.count);

  const sum = (sel: (e: UnifiedHealthEntry) => number | null, onlyPositive: boolean) => {
    const vals = sorted.map(sel).filter((v): v is number => v !== null && Number.isFinite(v));
    const filtered = onlyPositive ? vals.filter((v) => v > 0) : vals;
    return { entries: filtered.length, lastTotal: vals.length ? vals[vals.length - 1] : 0, avg: round1(mean(filtered) ?? 0) };
  };

  // Уникальные дни за последние 14 дней
  const from14 = new Date();
  from14.setDate(from14.getDate() - 13);
  const from14Iso = localIso(from14);
  const uniqueDays14 = new Set(sorted.filter((e) => e.date >= from14Iso && e.date <= today).map((e) => e.date)).size;
  const adherence = {
    entriesLast14: uniqueDays14,
    pct: Math.min(100, Math.round((uniqueDays14 / 14) * 100)),
    lastEntryDaysAgo: lastDate ? daysAgo(lastDate, today) : null,
  };

  // Неделя vs прошлая неделя (средняя боль)
  const now = Date.now();
  const weekStart = now - 7 * 86400000;
  const twoWeeksStart = now - 14 * 86400000;
  const weekVals: number[] = [];
  const prevVals: number[] = [];
  for (const e of sorted) {
    const t = Date.parse(e.date);
    if (!Number.isFinite(t)) continue;
    if (t >= weekStart) weekVals.push(e.pain?.totalScore || 0);
    else if (t >= twoWeeksStart) prevVals.push(e.pain?.totalScore || 0);
  }
  const weekMean = mean(weekVals);
  const prevWeekMean = mean(prevVals);
  const deltaPct = weekMean !== null && prevWeekMean !== null && prevWeekMean !== 0
    ? round1(((weekMean - prevWeekMean) / prevWeekMean) * 100)
    : null;

  return {
    totalEntries: sorted.length,
    firstDate,
    lastDate,
    daysCovered,
    ctx,
    pain: {
      avg7: windowAvg(7),
      avg30: windowAvg(30),
      max: maxPain,
      worstZone: worstZoneStats ? { id: worstZoneStats.id, label: worstZoneStats.label, avg: worstZoneStats.avg } : null,
      worseningZones,
      topTriggers: topTriggers.slice(0, 5),
      timeOfDayPeak,
      linkedExercise: linkedExercise && linkedExercise.count >= 2 ? linkedExercise : null,
    },
    symptoms: symptoms.slice(0, 10),
    neuro: sum((e) => e.neuro?.totalScore ?? null, true),
    acne: sum((e) => e.acne?.totalScore ?? null, true),
    hemato: sum((e) => e.hemato?.totalScore ?? null, true),
    adherence,
    trend: { weekMean: weekMean !== null ? round1(weekMean) : null, prevWeekMean: prevWeekMean !== null ? round1(prevWeekMean) : null, deltaPct },
  };
}

// ─── Генерация рекомендаций ──────────────────────────────────────────────────

const PRIORITY_ORDER: HealthPriority[] = ['critical', 'high', 'medium', 'low'];

/** Детерминированный hash (djb2) для стабильного id рекомендации: чекбоксы не «плывут» при регенерации. */
function hashId(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function generateHealthPlan(analysis: HealthProfileAnalysis): HealthPlan {
  const recs: HealthRecommendation[] = [];
  const p = analysis.pain;
  const ctx = analysis.ctx;
  const push = (r: Omit<HealthRecommendation, 'id'>) =>
    recs.push({ ...r, id: `${r.domain}_${hashId(`${r.priority}|${r.title}`)}` });

  // CRITICAL
  if (analysis.hemato.lastTotal >= 2) {
    push({
      domain: 'hemato', priority: 'critical',
      title: 'Гематологические симптомы — сдать ОАК',
      rationale: `${analysis.hemato.lastTotal}/8 симптомов в последней записи (кровоточивость дёсен, синяки, носовые кровотечения).`,
      action: 'Сдать общий анализ крови и коагулограмму, показать врачу; при активном кровотечении — немедленно.',
    });
  }
  const criticalZones = p.worseningZones.filter((z) => z.last >= 7);
  if (criticalZones.length > 0) {
    push({
      domain: 'pain', priority: 'critical',
      title: `Критическая боль: ${criticalZones.map((z) => z.label).join(', ')}`,
      rationale: `VAS ${Math.max(...criticalZones.map((z) => z.last))}/10 — боль на уровне «невыносимо», тренировать зону нельзя.`,
      action: 'Полностью исключить нагрузку на эти зоны, применить протокол поддержки суставов, обратиться к специалисту.',
      zoneIds: criticalZones.map((z) => z.id),
    });
  }
  if (analysis.neuro.lastTotal >= 6) {
    push({
      domain: 'neuro', priority: 'critical',
      title: `Тяжёлые нейросимптомы (${analysis.neuro.lastTotal}/10)`,
      rationale: 'Более половины нейросимптомов отмечены в последней записи — риск для ЦНС.',
      action: 'Пересмотреть стёк препаратов, оценить нейропротекцию, консультация невролога.',
    });
  }
  if (p.avg7 !== null && p.avg7 >= 35) {
    push({
      domain: 'pain', priority: 'critical',
      title: `Стабильно высокая боль (ср. ${p.avg7}/70 за неделю)`,
      rationale: `Средний балл боли за 7 дней ${p.avg7}/70 — системная перегрузка опорно-двигательного аппарата.`,
      action: 'Снизить недельный объём тренировок, добавить восстановительные процедуры, рассмотреть полный протокол поддержки.',
    });
  }

  // HIGH
  if (p.worseningZones.length > 0) {
    push({
      domain: 'pain', priority: 'high',
      title: `Боль нарастает: ${p.worseningZones.map((z) => z.label).join(', ')}`,
      rationale: `Тренд «вверх» в ${p.worseningZones.length} зоне, последнее значение ≥4/10.`,
      action: 'Документировать триггеры, снизить интенсивность для этих зон, проверить технику упражнений.',
      zoneIds: p.worseningZones.map((z) => z.id),
    });
  }
  if (p.topTriggers.length > 0 && p.topTriggers[0].count >= 3) {
    push({
      domain: 'pain', priority: 'high',
      title: `Частый триггер: «${p.topTriggers[0].trigger}»`,
      rationale: `Триггер встречается ${p.topTriggers[0].count} раз (${p.topTriggers[0].pct}% записей с болью).`,
      action: `Модифицировать или исключить «${p.topTriggers[0].trigger}», отслеживать эффект 2 недели.`,
    });
  }
  if (p.linkedExercise) {
    push({
      domain: 'pain', priority: 'high',
      title: `Боль связана с упражнением: ${p.linkedExercise.name}`,
      rationale: `Упражнение фигурирует в ${p.linkedExercise.count} записях боли.`,
      action: `Пересмотреть технику, снизить вес или заменить «${p.linkedExercise.name}» на 2-3 недели.`,
    });
  }
  if (analysis.hemato.lastTotal === 1) {
    push({
      domain: 'hemato', priority: 'high',
      title: 'Гематологический симптом — контроль',
      rationale: '1 из 8 гематологических симптомов в последней записи.',
      action: 'Сдать ОАК в ближайшие 2 недели, отслеживать появление новых симптомов.',
    });
  }
  const topSymptom = analysis.symptoms[0];
  if (topSymptom && topSymptom.count >= 3 && topSymptom.avgSeverity >= 3) {
    push({
      domain: 'symptoms', priority: 'high',
      title: `Повторяющийся симптом: ${topSymptom.name}`,
      rationale: `${topSymptom.name}: ${topSymptom.count} раз, средняя тяжесть ${topSymptom.avgSeverity}/5.`,
      action: `Отслеживать динамику симптома, исключить связь с курсом/питанием, при усилении — врач.`,
    });
  }
  if (p.avg7 !== null && p.avg7 >= 20) {
    push({
      domain: 'pain', priority: 'high',
      title: `Боль выше нормы (ср. ${p.avg7}/70 за неделю)`,
      rationale: 'Норма суставной боли — до 20/70.',
      action: 'Усилить восстановление, проверить нагрузку и технику.',
    });
  }

  // MEDIUM
  if (analysis.neuro.lastTotal >= 4) {
    push({
      domain: 'neuro', priority: 'medium',
      title: `Нейросимптомы выражены (${analysis.neuro.lastTotal}/10)`,
      rationale: 'Умеренный нейросимптомный фон — возможна коррекция нейропротекции.',
      action: 'Оценить нейропротективные бустеры, снизить стимуляторы при бессоннице/тревоге.',
    });
  }
  if (analysis.acne.lastTotal >= 7) {
    push({
      domain: 'acne', priority: 'medium',
      title: `Выраженное акне (${analysis.acne.lastTotal}/12)`,
      rationale: 'Суммарная оценка акне ≥7/12 — гормональный фон влияет на кожу.',
      action: 'Оценить эстроген/пролактин (лаборатория), уход за кожей, при стероидах — коррекция курса.',
    });
  }
  if (analysis.adherence.pct < 50) {
    push({
      domain: 'adherence', priority: 'medium',
      title: 'Вести дневник регулярнее',
      rationale: `Заполнено ${analysis.adherence.entriesLast14} из 14 дней (${analysis.adherence.pct}%)${analysis.adherence.lastEntryDaysAgo !== null ? `; последняя запись ${analysis.adherence.lastEntryDaysAgo} дн. назад` : ''}.`,
      action: 'Добавлять запись ежедневно 5-10 минут — дневник с малой выборкой не показывает паттерны.',
    });
  }
  if (p.timeOfDayPeak && p.timeOfDayPeak.avgScore >= 5) {
    push({
      domain: 'pain', priority: 'medium',
      title: `Пик боли: ${p.timeOfDayPeak.label}`,
      rationale: `Боль усиливается в ${p.timeOfDayPeak.label.toLowerCase()} (ср. ${p.timeOfDayPeak.avgScore}/10).`,
      action: `Планировать приём обезболивающих/поддержку перед ${p.timeOfDayPeak.label.toLowerCase()}.`,
    });
  }
  if (analysis.trend.deltaPct !== null && analysis.trend.deltaPct >= 10) {
    push({
      domain: 'pain', priority: 'medium',
      title: `Боль растёт неделя к неделе (+${analysis.trend.deltaPct}%)`,
      rationale: `Средняя боль: ${analysis.trend.prevWeekMean}/70 → ${analysis.trend.weekMean}/70.`,
      action: 'Выяснить причину роста (объём, сон, курс), скорректировать до возврата к норме.',
    });
  }
  const midSymptom = analysis.symptoms.find((s) => s.count >= 2);
  if (midSymptom && !(topSymptom && topSymptom.count >= 3 && topSymptom.avgSeverity >= 3)) {
    push({
      domain: 'symptoms', priority: 'medium',
      title: `Симптом повторяется: ${midSymptom.name}`,
      rationale: `${midSymptom.name} отмечен ${midSymptom.count} раза, средняя тяжесть ${midSymptom.avgSeverity}/5.`,
      action: `Записывать контекст (сон, питание, нагрузка) при появлении ${midSymptom.name.toLowerCase()}.`,
    });
  }

  // ── Контекст других дневников (сон / АД / курс / вес-тренд) ──────────────
  if (ctx.sleepAvg7 !== null && ctx.sleepAvg7 !== undefined && ctx.sleepAvg7 < 6) {
    push({
      domain: 'adherence', priority: 'medium',
      title: `Недостаток сна (ср. ${ctx.sleepAvg7.toFixed(1)} ч)`,
      rationale: `Сон < 6 ч снижает восстановление и усиливает болевой синдром.`,
      action: 'Ложиться на 30-60 мин раньше, убрать кофеин после 14:00, экраны за час до сна.',
    });
  }
  const sys = ctx.bpSystolicLast;
  if (sys !== null && sys !== undefined && sys >= 160) {
    push({
      domain: 'symptoms', priority: 'critical',
      title: `Высокое АД (${Math.round(sys)} мм рт.ст.)`,
      rationale: 'Систола ≥160 — риск гипертонического криза, особенно на фоне курса.',
      action: 'Измерить АД повторно утром и вечером, ограничить стимуляторы и натрий, при сохранении — врач.',
    });
  } else if (sys !== null && sys !== undefined && sys >= 140) {
    push({
      domain: 'symptoms', priority: 'high',
      title: `Повышенное АД (${Math.round(sys)} мм рт.ст.)`,
      rationale: 'Систола 140-159 — выше целевого уровня 120-130.',
      action: 'Ежедневный контроль АД, снизить кофеин/стимуляторы, проверить электролиты.',
    });
  }
  if (ctx.onCycle) {
    push({
      domain: 'symptoms', priority: 'medium',
      title: 'Мониторинг на курсе',
      rationale: 'Активная фарма требует контроля анализов (ОАК, печень, липиды, гормоны) и симптомов.',
      action: 'Сдавать лабораторную панель каждые 4-6 недель курса, вести дневник симптомов.',
    });
  }
  if (ctx.weightTrendKgWeek !== null && ctx.weightTrendKgWeek !== undefined && ctx.weightTrendKgWeek >= 0.5) {
    push({
      domain: 'adherence', priority: 'medium',
      title: `Быстрый набор веса (+${ctx.weightTrendKgWeek.toFixed(1)} кг/нед)`,
      rationale: 'Набор >0.5 кг/нед нагружает суставы и сердечно-сосудистую систему.',
      action: 'Умеренный профицит (+200-300 ккал), контроль АД и объёма суставов.',
    });
  }

  // LOW
  if (p.avg7 !== null && p.avg30 !== null && p.avg7 < p.avg30 - 2 && p.avg7 < 20) {
    push({
      domain: 'pain', priority: 'low',
      title: 'Боль снижается',
      rationale: `Средняя боль: ${p.avg30}/70 за 30 дней → ${p.avg7}/70 за 7 дней.`,
      action: 'Продолжать текущий протокол, зафиксировать неделю закрепления результата.',
    });
  }
  if (analysis.adherence.pct >= 70) {
    push({
      domain: 'adherence', priority: 'low',
      title: 'Отличная регулярность ведения',
      rationale: `Дневник заполнен ${analysis.adherence.pct}% дней за 2 недели — данные репрезентативны.`,
      action: 'Поддерживать темп, анализировать отчёт раз в месяц.',
    });
  }
  if (analysis.hemato.lastTotal === 0 && analysis.neuro.lastTotal === 0 && analysis.acne.lastTotal === 0 && p.worstZone === null) {
    push({
      domain: 'symptoms', priority: 'low',
      title: 'Нет активных жалоб',
      rationale: 'Последняя запись без боли, нейро-, гемато- и акне-симптомов.',
      action: 'Поддерживать режим, вести дневник для раннего выявления изменений.',
    });
  }

  // Сортировка: critical → high → medium → low
  const sorted = [...recs].sort((a, b) => {
    const d = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    return d !== 0 ? d : a.domain.localeCompare(b.domain);
  }).slice(0, 12);

  return {
    generatedAt: new Date().toISOString(),
    recommendations: sorted,
    summary: summarizeHealthPlan(sorted),
  };
}

export function summarizeHealthPlan(recommendations: HealthRecommendation[]): HealthPlan['summary'] {
  const critical = recommendations.filter((r) => r.priority === 'critical').length;
  const high = recommendations.filter((r) => r.priority === 'high').length;
  const medium = recommendations.filter((r) => r.priority === 'medium').length;
  const low = recommendations.filter((r) => r.priority === 'low').length;
  let verdict: string;
  if (critical > 0) verdict = 'Требуется внимание специалиста — есть критические пункты';
  else if (high > 0) verdict = 'Есть зоны для коррекции — сфокусироваться на приоритетных';
  else if (medium > 0) verdict = 'База в порядке — можно улучшить отдельные аспекты';
  else verdict = 'Всё под контролем — продолжайте поддерживать режим';
  return { critical, high, medium, low, verdict };
}

// ─── Экспорт и хранение ──────────────────────────────────────────────────────

const PRIORITY_LABEL: Record<HealthPriority, string> = {
  critical: 'КРИТИЧНО',
  high: 'ВАЖНО',
  medium: 'СРЕДНЕ',
  low: 'ОК',
};

export function exportHealthPlanText(plan: HealthPlan, analysis: HealthProfileAnalysis): string {
  const lines: string[] = [];
  lines.push('ПЛАН УЛУЧШЕНИЙ ЗДОРОВЬЯ');
  lines.push(`Сформирован: ${new Date(plan.generatedAt).toLocaleString('ru-RU')}`);
  lines.push(`Записей в дневнике: ${analysis.totalEntries} · период: ${analysis.firstDate || '—'} — ${analysis.lastDate || '—'}`);
  lines.push('');
  lines.push(`Вердикт: ${plan.summary.verdict}`);
  lines.push(`Критичных: ${plan.summary.critical} · Важных: ${plan.summary.high} · Средних: ${plan.summary.medium} · Низких: ${plan.summary.low}`);
  lines.push('');
  if (plan.recommendations.length === 0) {
    lines.push('Данных недостаточно — добавьте записи в дневник здоровья.');
    return lines.join('\n');
  }
  plan.recommendations.forEach((r, i) => {
    lines.push(`${i + 1}. [${PRIORITY_LABEL[r.priority]}] ${r.title}`);
    lines.push(`   Почему: ${r.rationale}`);
    lines.push(`   Действие: ${r.action}`);
    lines.push('');
  });
  lines.push('— Сгенерировано приложением, не заменяет консультацию врача. —');
  return lines.join('\n');
}

/** Сводный текстовый отчёт по дневнику здоровья: статистика + контекст + план. */
export function exportHealthReportText(analysis: HealthProfileAnalysis, plan: HealthPlan): string {
  const lines: string[] = [];
  const p = analysis.pain;
  const a = analysis.adherence;
  lines.push('ОТЧЁТ ПО ДНЕВНИКУ ЗДОРОВЬЯ');
  lines.push(`Сформирован: ${new Date(plan.generatedAt).toLocaleString('ru-RU')}`);
  lines.push(`Записей: ${analysis.totalEntries} · период: ${analysis.firstDate || '—'} — ${analysis.lastDate || '—'} · заполнено ${a.entriesLast14}/14 дней (${a.pct}%)`);
  lines.push('');
  lines.push('— Боль —');
  lines.push(`Средняя: ${p.avg7 ?? 0}/70 за 7 дней, ${p.avg30 ?? 0}/70 за 30 дней · макс ${p.max}/70`);
  if (p.worstZone) lines.push(`Худшая зона: ${p.worstZone.label} (ср. ${p.worstZone.avg}/10)`);
  if (p.worseningZones.length > 0) lines.push(`Ухудшающиеся зоны: ${p.worseningZones.map((z) => `${z.label} ${z.last}/10`).join(', ')}`);
  if (p.topTriggers.length > 0) lines.push(`Частые триггеры: ${p.topTriggers.slice(0, 3).map((t) => `${t.trigger} (${t.count})`).join(', ')}`);
  if (p.timeOfDayPeak) lines.push(`Пик боли: ${p.timeOfDayPeak.label} (${p.timeOfDayPeak.avgScore}/10)`);
  if (analysis.trend.deltaPct !== null) lines.push(`Неделя к неделе: ${analysis.trend.prevWeekMean}/70 → ${analysis.trend.weekMean}/70 (${analysis.trend.deltaPct > 0 ? '+' : ''}${analysis.trend.deltaPct}%)`);
  lines.push('');
  lines.push('— Симптомы —');
  lines.push(analysis.symptoms.length > 0
    ? analysis.symptoms.slice(0, 5).map((s) => `${s.name} (${s.count}×, ср. ${s.avgSeverity}/5)`).join('; ')
    : 'не зафиксированы');
  lines.push('');
  lines.push('— Нейро / Акне / Гемато —');
  lines.push(`Нейро: ${analysis.neuro.lastTotal}/10 · Акне: ${analysis.acne.lastTotal}/12 · Гемато: ${analysis.hemato.lastTotal}/8`);
  lines.push('');
  lines.push('— Контекст —');
  lines.push(`Сон: ${analysis.ctx.sleepAvg7 !== null && analysis.ctx.sleepAvg7 !== undefined ? `${analysis.ctx.sleepAvg7} ч` : 'нет данных'}`);
  lines.push(`АД: ${analysis.ctx.bpSystolicLast !== null && analysis.ctx.bpSystolicLast !== undefined ? `${Math.round(analysis.ctx.bpSystolicLast)}/${Math.round(analysis.ctx.bpDiastolicLast || 0)}` : 'нет данных'}`);
  lines.push(`Курс: ${analysis.ctx.onCycle ? 'активен' : 'не активен'} · Вес: ${analysis.ctx.weightTrendKgWeek !== null && analysis.ctx.weightTrendKgWeek !== undefined ? `${analysis.ctx.weightTrendKgWeek > 0 ? '+' : ''}${analysis.ctx.weightTrendKgWeek} кг/нед` : 'нет данных'}`);
  lines.push('');
  lines.push(exportHealthPlanText(plan, analysis));
  return lines.join('\n');
}

export function saveHealthPlan(plan: HealthPlan): void {
  try { localStorage.setItem(PLAN_KEY, JSON.stringify(plan)); } catch {}
}

export function loadHealthPlan(): HealthPlan | null {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.recommendations)) return null;
    return parsed as HealthPlan;
  } catch { return null; }
}

export function savePlanDone(ids: string[]): void {
  try { localStorage.setItem(PLAN_DONE_KEY, JSON.stringify(ids)); } catch {}
}

export function loadPlanDone(): string[] {
  try {
    const raw = localStorage.getItem(PLAN_DONE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}
