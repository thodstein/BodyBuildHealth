/**
 * lms-taper-coach.engine.ts — ТРЕНЕРСКИЙ СЛОЙ тапера/пика ПЛ-авто.
 *
 * «Умная тренерская работа» поверх канонической кривой (lms-taper.engine):
 *  - pmFeasibility        — достижимость плана ПМ к дате старта (темп прогрессии);
 *  - recommendTaperConfig — авто-подбор конфигурации тапера под данные спортсмена
 *                           (усталость, ACWR, вес к категории, цель ПМ федерации);
 *  - coachPLPeakPlan      — тренерский вердикт по готовности плана к старту:
 *                           score 0-100 + заметки + конкретные рекомендации.
 *
 * Все функции чистые и покрыты тестами (lms-taper-coach.test.ts).
 */
import type { LMSBuildOutput, LMSPlanWeek } from './lms-builder.engine';
import { buildPLTaperCurve, taperWeeksByFatigue, type TaperCurvePoint, type TaperMode, type TaperWeightGoal } from './lms-taper.engine';
import { LAST_HEAVY_DAYS, type Lift } from '../pro/taper.engine';
import { norm } from '../norm';
import { toDailyLoads, type TrainingSession } from '../pro/training-load.engine';
import type { ACWRZone } from '../pro/training-load.engine';
import type { MeetAttemptsInfo, MeetStrategy } from './competition-attempts';

export interface TaperCoachAcwr { ratio: number; zone: ACWRZone }

export interface TaperCoachCtx {
  /** Усталость 0-100 (readiness.fatigue). */
  fatigue?: number;
  /** ACWR из дневника sRPE. */
  acwr?: TaperCoachAcwr;
  /** sRPE-сессии дневника (последние ~4 недели) — тренд нагрузки для коррекции тапера. */
  recentSessions?: TrainingSession[];
  /** Дата старта (ISO) — тайминг последних тяжёлых по календарю. */
  meetDate?: string;
  /** Текущий вес тела (кг). */
  currentWeight?: number;
  /** Целевой вес категории (кг). */
  targetWeight?: number;
  /** Реально поднятые ПМ после цикла (ключи — имена упражнений). */
  actualPm?: Record<string, number>;
  /** План ПМ в федерации (целевые веса старта). */
  plannedPm?: Record<string, number>;
  /** Прогноз ПМ к финалу цикла (последняя неделя pmRow). */
  forecastPm?: Record<string, number>;
  /** Недель до старта. */
  weeksToMeet?: number;
  /** Темп прогрессии ПМ в неделю (0.005 = 0.5%). */
  weeklyK?: number;
}

export interface PmFeasibilityLift {
  name: string;
  forecast: number;
  planned: number;
  gapKg: number;
  weeksNeeded: number;
  feasible: boolean;
}

export interface PmFeasibility {
  status: 'realistic' | 'tight' | 'unrealistic';
  lifts: PmFeasibilityLift[];
  summary: string;
}

/** Достижимость плана ПМ к старту: forecast × (1+k)^weeks vs план федерации. */
export function pmFeasibility(ctx: TaperCoachCtx): PmFeasibility {
  // Кламп темпа: 0/NaN/отрицательные → минимальный прогресс (guard от Infinity/NaN).
  const rawK = Number.isFinite(ctx.weeklyK) ? (ctx.weeklyK ?? 0.01) : 0.01;
  const k = Math.max(0.001, Math.min(0.1, rawK));
  const weeks = Math.max(1, ctx.weeksToMeet ?? 1);
  const planned = ctx.plannedPm ?? {};
  const forecastBase = ctx.forecastPm ?? {};
  const actual = ctx.actualPm ?? {};
  const names = Object.keys(planned);
  if (names.length === 0) {
    return { status: 'realistic', lifts: [], summary: 'План ПМ федерации не задан — достижимость не оценивается.' };
  }
  const lifts: PmFeasibilityLift[] = names.map(name => {
    const plan = planned[name];
    if (!(plan > 0)) return { name, forecast: 0, planned: 0, gapKg: 0, weeksNeeded: 0, feasible: true };
    // База прогноза: фактический ПМ (реально поднятый) или прогноз цикла.
    const base = (actual[name] > 0 ? actual[name] : forecastBase[name]) || 0;
    const forecast = base > 0 ? base * Math.pow(1 + k, weeks) : 0;
    const gapKg = forecast > 0 ? plan - forecast : plan - base;
    const weeksNeeded = forecast > 0 && gapKg > 0 ? Math.ceil(Math.log(plan / forecast) / Math.log(1 + k)) : 0;
    return { name, forecast: Math.round(forecast * 10) / 10, planned: plan, gapKg: Math.round(gapKg * 10) / 10, weeksNeeded, feasible: gapKg <= 0 };
  });
  const needsMore = lifts.filter(l => !l.feasible);
  const status: PmFeasibility['status'] = needsMore.length === 0 ? 'realistic'
    : needsMore.every(l => l.weeksNeeded <= weeks) ? 'tight'
    : 'unrealistic';
  const gapText = lifts.filter(l => !l.feasible).map(l => `${l.name}: +${l.gapKg} кг (нужно ещё ${l.weeksNeeded} нед)`).join('; ');
  const summary = status === 'realistic'
    ? 'План ПМ в федерации достижим к старту при текущем темпе прогрессии.'
    : status === 'tight'
      ? `План на грани: ${gapText}. Увеличьте темп прогрессии в финальных неделях или скорректируйте план.`
      : `План нереалистичен: ${gapText}. Пересмотрите целевые веса или перенесите старт.`;
  return { status, lifts, summary };
}

export interface TaperConfigRecommendation {
  mode: TaperMode;
  taperWeeks: number;
  weightGoal: TaperWeightGoal;
  mockMeet: boolean;
  postMeet: boolean;
  strategy: MeetStrategy;
  /** Человекочитаемое обоснование (почему такой подбор). */
  rationale: string[];
}

/**
 * Авто-подбор конфигурации тапера под спортсмена. Тренерские правила:
 *  - перегруз (ACWR caution/dangerous, усталость ≥ 70) → глубокая разгрузка classic, длиннее, консервативные прикиды;
 *  - цель PR (план федерации выше прогноза) при нормальном восстановлении → ПЛ-пик-протокол (интенсификация к 100%);
 *  - низкая усталость и есть время → про-тапер (прайминг, динамический усилийный день);
 *  - недогруз (undertrained) → тапер короче (нет глубокой усталости, которую нужно разгружать);
 *  - вес: сгонка к категории → 'lose' (объём ×0.9), набор → 'gain';
 *  - mock meet и пост-старт неделя — всегда рекомендуются при наличии времени/плана.
 */
export function recommendTaperConfig(ctx: TaperCoachCtx): TaperConfigRecommendation {
  const rationale: string[] = [];
  const fatigue = ctx.fatigue != null && Number.isFinite(ctx.fatigue) ? Math.max(0, Math.min(100, ctx.fatigue)) : undefined;
  const zone = ctx.acwr?.zone;
  // 📈 Дневник-интеграция: тренд sRPE-нагрузки последних 14 дней vs предыдущих.
  const sRpe = sRPEAdjustment(ctx.recentSessions);
  if (sRpe.note) rationale.push(sRpe.note);

  // ── Длительность: по усталости, коррекция по ACWR и тренду нагрузки ──
  let taperWeeks = taperWeeksByFatigue(fatigue) ?? 2;
  if (zone === 'dangerous') { taperWeeks = Math.min(4, taperWeeks + 1); rationale.push('⛔ ACWR в опасной зоне — тапер длиннее (глубокая разгрузка).'); }
  else if (zone === 'caution') { rationale.push('⚠ ACWR осторожная зона — разгрузка обязательна.'); }
  else if (zone === 'undertrained') { taperWeeks = Math.max(1, taperWeeks - 1); rationale.push('🔵 Недогруз (ACWR < 0.8) — тапер короче, глубокой усталости нет.'); }
  taperWeeks = Math.max(1, Math.min(4, taperWeeks + sRpe.taperWeeksDelta));
  if (fatigue != null && fatigue >= 70) rationale.push(`🔥 Усталость ${Math.round(fatigue)}/100 — длинный тапер ${taperWeeks} нед.`);

  // ── Режим: перегруз → classic; цель PR → pl; низкая усталость → pro ──
  let mode: TaperMode = 'classic';
  const planned = ctx.plannedPm ?? {};
  const plannedMax = Math.max(0, ...Object.values(planned).filter(v => v > 0));
  const forecastMax = Math.max(0, ...Object.values(ctx.forecastPm ?? {}).filter(v => v > 0));
  const actualMax = Math.max(0, ...Object.values(ctx.actualPm ?? {}).filter(v => v > 0));
  const baseMax = actualMax > 0 ? actualMax : forecastMax;
  const chasingPR = plannedMax > 0 && baseMax > 0 && plannedMax > baseMax * 1.02;
  if (zone === 'dangerous' || zone === 'caution' || (fatigue != null && fatigue >= 70) || sRpe.taperWeeksDelta > 0) {
    mode = 'classic';
  } else if (chasingPR) {
    mode = 'pl';
    rationale.push(`🎯 Цель — PR (план ${plannedMax} кг > прогноз ${Math.round(baseMax)} кг): ПЛ-пик-протокол (интенсивность 90/95/100% ПМ).`);
  } else if (fatigue != null && fatigue < 45) {
    mode = 'pro';
    rationale.push('🎯 Усталость низкая — про-тапер с праймингом (сохранить свежесть ЦНС без глубокой разгрузки).');
  }
  if (mode === 'classic' && !rationale.some(r => r.startsWith('📉'))) rationale.push('📉 Классическая разгрузка (Bosquet): объём ↓, интенсивность сохранена.');

  // ── Весовая цель ──
  let weightGoal: TaperWeightGoal = 'maintain';
  if (ctx.currentWeight != null && ctx.targetWeight != null && ctx.targetWeight > 0) {
    const diff = ctx.currentWeight - ctx.targetWeight;
    if (diff > 1) { weightGoal = 'lose'; rationale.push(`⬇ Сгонка ${diff.toFixed(1)} кг к категории — объём тапера ×0.9 (дефицит → MRV ниже).`); }
    else if (diff < -1) { weightGoal = 'gain'; rationale.push(`⬆ Набор ${(-diff).toFixed(1)} кг к категории — полный объём тапера.`); }
  }

  // ── Mock meet / пост-старт ──
  const weeksToMeet = ctx.weeksToMeet;
  const mockMeet = weeksToMeet == null || weeksToMeet >= taperWeeks + 2;
  const postMeet = true;
  if (mockMeet) rationale.push('🎯 Mock meet за 10-14 дней до старта — проверка стратегии прикидов на практике.');
  rationale.push('🔄 Пост-старт неделя (×0.5, RIR +3) — восстановление после прикидок.');

  // ── Стратегия прикидов ──
  let strategy: MeetStrategy = 'balanced';
  if (zone === 'caution' || zone === 'dangerous' || (fatigue != null && fatigue >= 70)) {
    strategy = 'conservative';
    rationale.push('🛡 Консервативные прикиды (90/95.5/100%) — восстановление неполное.');
  } else if (chasingPR && (fatigue == null || fatigue < 45)) {
    strategy = 'aggressive';
    rationale.push('🏁 Агрессивные прикиды (93/97/105%) — цель PR при хорошем восстановлении.');
  }

  return { mode, taperWeeks, weightGoal, mockMeet, postMeet, strategy, rationale };
}

export type CoachNoteSeverity = 'ok' | 'info' | 'warn' | 'danger';

export interface CoachNote {
  severity: CoachNoteSeverity;
  icon: string;
  text: string;
}

export interface TaperCoachVerdict {
  /** 0-100 готовность плана к старту. */
  score: number;
  label: string;
  notes: CoachNote[];
  /** Конкретные действия (применяются кнопкой в UI). */
  actions: TaperConfigRecommendation | null;
}

const weekVolume = (w: LMSPlanWeek): number => {
  let v = 0;
  for (const d of w.days ?? []) for (const e of d.exercises ?? []) for (const ws of e.workSets ?? []) v += ws.sets ?? 0;
  return v;
};

const isMain = (e: { load?: string }) => e.load === 'main' || e.load === 'Тяжелая';

/** Тренерский вердикт по готовности плана к старту. */
export function coachPLPeakPlan(plan: LMSBuildOutput, ctx?: TaperCoachCtx): TaperCoachVerdict {
  const notes: CoachNote[] = [];
  let score = 100;
  const weeks = plan?.weeks ?? [];
  if (weeks.length === 0) return { score: 0, label: 'Нет плана', notes: [{ severity: 'danger', icon: '⛔', text: 'План не построен — сгенерируйте план и примените тапер.' }], actions: null };

  const meetWeeks = weeks.filter(w => w.meetWeek);
  const taperWeeksList = weeks.filter(w => w.taperWeek);
  const peakVol = Math.max(1, ...weeks.map(weekVolume));

  // ── Тапер не применён вовсе ──
  if (taperWeeksList.length === 0 && meetWeeks.length === 0) {
    score -= 30;
    notes.push({ severity: 'danger', icon: '⛔', text: 'Тапер не применён к плану — добавьте тапер-недели («📉 Добавить тапер к плану») и неделю соревнований, иначе к старту придёте с полным объёмом и накопленной усталостью.' });
  }

  // ── Финальная тапер-неделя: объём и RIR ──
  const finalTaper = taperWeeksList[taperWeeksList.length - 1]
    ?? (meetWeeks[0] ? weeks[weeks.indexOf(meetWeeks[0]) - 1] : undefined);
  if (finalTaper) {
    const volPct = weekVolume(finalTaper) / peakVol;
    if (volPct > 0.62) { score -= 12; notes.push({ severity: 'warn', icon: '📉', text: `Финальная тапер-неделя ${finalTaper.week}: объём ${Math.round(volPct * 100)}% от пикового — разгрузка недостаточна (цель 40-60%).` }); }
    else if (volPct < 0.35) { score -= 8; notes.push({ severity: 'info', icon: '📉', text: `Финальная тапер-неделя: объём ${Math.round(volPct * 100)}% — глубокая разгрузка; следите за сохранением интенсивности (не теряйте стимул).` }); }
    else notes.push({ severity: 'ok', icon: '✅', text: `Финальная тапер-неделя: объём ${Math.round(volPct * 100)}% от пика — в целевом диапазоне разгрузки 40-60%.` });

    // Тяжёлые рабочие сеты (≥85%, ≥2 сетов) в финале — только для разгрузочных режимов;
    // соревновательная неделя ПЛ-протокола (разминка 50/70/90) — норма.
    const heavySets = finalTaper.days.flatMap(d => d.exercises.filter(e => isMain(e)).flatMap(e => e.workSets ?? []))
      .filter(ws => (ws.pct ?? 0) >= 0.85 && (ws.sets ?? 0) >= 2);
    if (heavySets.length > 0) {
      score -= 25;
      notes.push({ severity: 'danger', icon: '🚨', text: `В финальную тапер-неделю ${finalTaper.week} остались тяжёлые рабочие сеты (${heavySets.length} шт ≥85%) — перегруз ЦНС перед стартом. Последние тяжёлые: присед за ${LAST_HEAVY_DAYS.squat} дн, жим за ${LAST_HEAVY_DAYS.bench} дн, тяга за ${LAST_HEAVY_DAYS.deadlift} дн до старта.` });
    } else {
      notes.push({ severity: 'ok', icon: '✅', text: 'Тяжёлых рабочих сетов в финальной неделе нет — ЦНС успеет восстановиться к старту.' });
    }

    // Рабочие сеты выше 100% ПМ (multi-rep) — арифметическая ошибка планирования:
    // выше ПМ допустимы ТОЛЬКО прикиды-синглы дня соревнований (reps=1, sets=1).
    const overPm = finalTaper.days.flatMap(d => d.exercises.flatMap(e => e.workSets ?? []))
      .filter(ws => (ws.pct ?? 0) > 1.0 && (ws.reps ?? 1) > 1 && (ws.sets ?? 0) >= 1);
    if (overPm.length > 0) {
      score -= 20;
      notes.push({ severity: 'danger', icon: '⚖️', text: `В финальной неделе ${overPm.length} рабочих сетов выше 100% ПМ (${overPm.map(ws => Math.round((ws.pct ?? 0) * 100)).join('/')}%) — выше ПМ допустимы только прикиды-синглы дня соревнований.` });
    }
  }

  // ── Дубль разгрузки: тапер поверх deload ──
  const deloadTaper = taperWeeksList.find(w => w.sourcePhase === 'deload');
  if (deloadTaper) { score -= 12; notes.push({ severity: 'warn', icon: '⚠', text: `Неделя ${deloadTaper.week} — и тапер, и фаза deload одновременно: двойная разгрузка снижает стимул, объём некуда снижать.` }); }

  // ── Mock meet и пост-старт ──
  if (meetWeeks.length > 0) {
    if (!weeks.some(w => w.mockMeet)) { score -= 5; notes.push({ severity: 'info', icon: '🎯', text: 'Mock meet отсутствует — имитация прикидок за 10-14 дней до старта проверяет стратегию на практике.' }); }
    if (!weeks.some(w => w.postMeet)) { score -= 5; notes.push({ severity: 'info', icon: '🔄', text: 'Пост-соревновательная неделя отсутствует — восстановление после прикидок (×0.5, RIR +3) снижает риск перетренированности.' }); }
    notes.push({ severity: 'info', icon: '⏱', text: `Последние тяжёлые перед стартом: присед за ${LAST_HEAVY_DAYS.squat} дн, жим за ${LAST_HEAVY_DAYS.bench} дн, тяга за ${LAST_HEAVY_DAYS.deadlift} дн до старта; за 1-2 дня — только лёгкий прайминг 60-75% (синглы), ЦНС должна прийти свежей.` });
    // 📅 Тайминг по календарю: конкретные даты (если известна дата старта).
    if (ctx?.meetDate) {
      notes.push({ severity: 'info', icon: '📅', text: `По календарю (старт ${ctx.meetDate}): последний тяжёлый присед — не позднее ${isoAddDays(ctx.meetDate, -LAST_HEAVY_DAYS.squat)}, жим — ${isoAddDays(ctx.meetDate, -LAST_HEAVY_DAYS.bench)}, тяга — ${isoAddDays(ctx.meetDate, -LAST_HEAVY_DAYS.deadlift)}. Прайминг-синглы 60-75% — ${isoAddDays(ctx.meetDate, -2)}.` });
    }
  } else if (taperWeeksList.length > 0) {
    notes.push({ severity: 'info', icon: '🏁', text: 'Тапер применён, но недели соревнований нет — добавьте «🏁 Неделю соревнований в конце», чтобы получить прикиды дня старта.' });
  }

  // ── Усталость vs длительность тапера (с учётом тренда нагрузки) ──
  if (ctx?.fatigue != null && taperWeeksList.length > 0) {
    const sRpe = sRPEAdjustment(ctx.recentSessions);
    const recommended = Math.max(1, Math.min(4, (taperWeeksByFatigue(ctx.fatigue) ?? 2) + sRpe.taperWeeksDelta));
    if (taperWeeksList.length < recommended) {
      score -= 10;
      notes.push({ severity: 'warn', icon: '🔥', text: `Усталость ${Math.round(ctx.fatigue)}/100 (с учётом тренда нагрузки) требует тапера ${recommended} нед, в плане ${taperWeeksList.length} — удлините тапер.` });
    }
  }

  // ── ACWR ──
  if (ctx?.acwr) {
    if (ctx.acwr.zone === 'dangerous') { score -= 25; notes.push({ severity: 'danger', icon: '⛔', text: `ACWR ${ctx.acwr.ratio.toFixed(2)} — опасная зона: перед пиком обязателен глубокий тапер (объём ×0.45-0.5, RIR +2).` }); }
    else if (ctx.acwr.zone === 'caution') { score -= 10; notes.push({ severity: 'warn', icon: '⚠', text: `ACWR ${ctx.acwr.ratio.toFixed(2)} — осторожная зона: снизьте объём финальных недель, добавьте RIR.` }); }
    else if (ctx.acwr.zone === 'undertrained') { score -= 4; notes.push({ severity: 'info', icon: '🔵', text: 'ACWR < 0.8 — недогруз: тапер можно короче, добавьте прайминг-интенсивность.' }); }
  }

  // ── Тренд нагрузки по дневнику (sRPE) ──
  const sRpeNote = sRPEAdjustment(ctx?.recentSessions).note;
  if (sRpeNote && taperWeeksList.length > 0) {
    const overload = sRpeNote.startsWith('📈');
    score -= overload ? 10 : 4;
    notes.push({ severity: overload ? 'warn' : 'info', icon: overload ? '📈' : '📉', text: sRpeNote });
  }

  // ── Достижимость плана ПМ ──
  if (ctx && (ctx.plannedPm && Object.keys(ctx.plannedPm).length > 0)) {
    const feas = pmFeasibility(ctx);
    if (feas.status === 'unrealistic') { score -= 20; notes.push({ severity: 'danger', icon: '🎯', text: feas.summary }); }
    else if (feas.status === 'tight') { score -= 8; notes.push({ severity: 'warn', icon: '🎯', text: feas.summary }); }
  }

  // ── Вес к категории ──
  if (ctx?.currentWeight != null && ctx?.targetWeight != null && ctx.targetWeight > 0) {
    const diff = ctx.currentWeight - ctx.targetWeight;
    if (diff > 2) { score -= 6; notes.push({ severity: 'info', icon: '⚖️', text: `Сгонка ${diff.toFixed(1)} кг к категории — при дефиците объём тапера ×0.9 (весовая цель «lose»).` }); }
    else if (diff < -2) { score -= 3; notes.push({ severity: 'info', icon: '⚖️', text: `Набор ${(-diff).toFixed(1)} кг к категории — весовая цель «gain», полный объём.` }); }
  }

  score = Math.max(0, Math.min(100, score));
  const label = score >= 85 ? 'Готов к старту — план сбалансирован' : score >= 65 ? 'Небольшие правки перед стартом' : score >= 40 ? 'Требует корректировки тапера' : 'Пересмотрите подготовку к старту';
  const actions = recommendTaperConfig(ctx ?? {});
  return { score, label, notes: notes.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : b.severity === 'danger' ? 1 : a.severity === 'warn' ? -1 : 1)), actions };
}

/** Реалистичный прогноз ПМ к старту (для отображения в UI): {name → кг}. */
export function projectPmToMeet(forecastPm: Record<string, number>, weeklyK: number, weeksToMeet: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, pm] of Object.entries(forecastPm)) {
    out[name] = Math.round(pm * Math.pow(1 + weeklyK, Math.max(0, weeksToMeet)) * 10) / 10;
  }
  return out;
}

/** Нормализованное имя лифта для LAST_HEAVY_DAYS (squat/bench/deadlift). */
export function liftKeyOf(name: string): Lift | null {
  const n = norm(name);
  if (/присед|сквот/.test(n)) return 'squat';
  if (/жим/.test(n) && !/ногами|стоя|армейск/.test(n)) return 'bench';
  if (/станов/.test(n)) return 'deadlift';
  return null;
}

const isoAddDays = (iso: string, days: number): string => {
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// ═══════════════════════════════════════════════════════════════════════════
// ПУНКТ 1 — Дневник-интеграция: тренд sRPE-нагрузки последних недель
// ═══════════════════════════════════════════════════════════════════════════

export interface SRpeAdjustment {
  /** Сдвиг длительности тапера: -1 (короче) / 0 / +1 (длиннее). */
  taperWeeksDelta: number;
  /** Множитель объёма тапера: перегруз → 0.9, недогруз → 1.05. */
  volumeMult: number;
  /** Человекочитаемое пояснение (null — данных мало). */
  note: string | null;
}

/**
 * Тренд нагрузки по sRPE-дневнику: сумма за последние 14 дней vs предыдущие 14.
 * Перегруз (> +30%) → тапер длиннее и глубже; недогруз (< -30%) → короче и чуть
 * интенсивнее (усталость не накоплена — нечего разгружать).
 */
export function sRPEAdjustment(sessions?: TrainingSession[]): SRpeAdjustment {
  const out: SRpeAdjustment = { taperWeeksDelta: 0, volumeMult: 1, note: null };
  if (!sessions || sessions.length < 3) return out;
  const loads = toDailyLoads(sessions);
  const dates = loads.map(l => l.date).sort();
  const today = dates[dates.length - 1];
  const cutoff = (d: string, days: number) => isoAddDays(d, -days);
  let recent = 0, prev = 0;
  for (const l of loads) {
    if (l.date > cutoff(today, 14)) recent += l.load;
    else if (l.date > cutoff(today, 28)) prev += l.load;
  }
  if (prev <= 0) return out;
  const ratio = recent / prev;
  if (ratio > 1.3) {
    out.taperWeeksDelta = 1;
    out.volumeMult = 0.9;
    out.note = `📈 Нагрузка последних 14 дней +${Math.round((ratio - 1) * 100)}% к предыдущим — перегруз: тапер длиннее и глубже (объём ×0.9).`;
  } else if (ratio < 0.7) {
    out.taperWeeksDelta = -1;
    out.volumeMult = 1.05;
    out.note = `📉 Нагрузка последних 14 дней −${Math.round((1 - ratio) * 100)}% — недогруз: тапер короче, добавьте интенсивности (объём ×1.05).`;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// ПУНКТ 4 — Сравнение сценариев тапера («что если classic 3 нед vs pl 2 нед»)
// ═══════════════════════════════════════════════════════════════════════════

export interface TaperScenario {
  id: string;
  mode: TaperMode;
  taperWeeks: number;
}

export interface ScenarioScore {
  scenario: TaperScenario;
  score: number;
  summary: string;
  notes: string[];
}

/** Оценка одного сценария: профиль кривой + соответствие усталости/ACWR/нагрузке. */
export function scoreTaperScenario(scenario: TaperScenario, ctx?: TaperCoachCtx): ScenarioScore {
  const notes: string[] = [];
  let score = 100;
  const curve = buildPLTaperCurve({ taperWeeks: scenario.taperWeeks, mode: scenario.mode });
  const final = curve[curve.length - 1];
  const sRpe = sRPEAdjustment(ctx?.recentSessions);

  // Объём финальной недели (цель 40-60% — суперкомпенсация без потери стимула).
  const finalVol = final.volumePct;
  if (finalVol > 0.75) { score -= 25; notes.push(`Объём финала ${Math.round(finalVol * 100)}% — разгрузка недостаточна (цель 40-60%).`); }
  else if (finalVol > 0.62) { score -= 15; notes.push(`Объём финала ${Math.round(finalVol * 100)}% — на грани, следите за RIR.`); }
  else if (finalVol < 0.4) { score -= 5; notes.push(`Объём финала ${Math.round(finalVol * 100)}% — глубокая разгрузка, не теряйте интенсивность.`); }
  else notes.push(`Объём финала ${Math.round(finalVol * 100)}% — целевой диапазон разгрузки.`);

  // Длительность vs рекомендуемая (усталость + тренд нагрузки).
  const recommended = Math.max(1, Math.min(4, (taperWeeksByFatigue(ctx?.fatigue) ?? 2) + sRpe.taperWeeksDelta));
  if (scenario.taperWeeks < recommended) { score -= 20; notes.push(`Короче рекомендации (${recommended} нед) — усталость не успеет разгрузиться.`); }
  else if (scenario.taperWeeks > recommended + 1) { score -= 5; notes.push(`Длиннее рекомендации — риск потери стимула на длинной разгрузке.`); }

  // ACWR-риск при коротких сценариях.
  if (ctx?.acwr?.zone === 'dangerous' && scenario.taperWeeks <= 1) { score -= 20; notes.push('Опасная зона ACWR при 1-недельном тапере — разгрузка недостаточна.'); }
  else if (ctx?.acwr?.zone === 'caution' && scenario.taperWeeks <= 1) { score -= 10; notes.push('Осторожная зона ACWR — минимум 2 недели тапера.'); }
  else if (ctx?.acwr?.zone === 'undertrained' && scenario.taperWeeks >= 3) { score -= 10; notes.push('Недогруз: длинный тапер избыточен — короче + прайминг.'); }

  // Сгонка веса при высоком объёме.
  const cutting = ctx?.currentWeight != null && ctx?.targetWeight != null && (ctx.currentWeight - ctx.targetWeight) > 1;
  if (cutting && finalVol > 0.6) { score -= 10; notes.push('Сгонка + высокий объём финала — дефицит тормозит восстановление, режьте объём сильнее.'); }

  // sRPE-тренд.
  if (sRpe.note) {
    if (sRpe.taperWeeksDelta > 0 && scenario.taperWeeks < recommended) { score -= 15; notes.push('Перегруз по дневнику — нужен более длинный тапер.'); }
    if (sRpe.taperWeeksDelta < 0 && scenario.taperWeeks > recommended) { score -= 10; notes.push('Недогруз по дневнику — длинный тапер избыточен.'); }
  }

  score = Math.max(0, Math.min(100, score));
  const modeLabel = scenario.mode === 'pl' ? 'ПЛ-пик' : scenario.mode === 'pro' ? 'про-тапер' : scenario.mode === 'wf' ? 'Classic WF' : 'классика';
  return {
    scenario,
    score,
    summary: `${modeLabel} ${scenario.taperWeeks} нед: финал объём ${Math.round(finalVol * 100)}%, RIR ${final.rirTarget != null ? `→${final.rirTarget}` : `+${final.rirShift}`}`,
    notes,
  };
}

/** Сравнение сценариев тапера (по умолчанию — практичный набор). */
export function compareTaperScenarios(ctx?: TaperCoachCtx, scenarios?: TaperScenario[]): { results: ScenarioScore[]; best: ScenarioScore } {
  const list: TaperScenario[] = scenarios ?? [
    { id: 'classic-1', mode: 'classic', taperWeeks: 1 },
    { id: 'classic-2', mode: 'classic', taperWeeks: 2 },
    { id: 'classic-3', mode: 'classic', taperWeeks: 3 },
    { id: 'pl-3', mode: 'pl', taperWeeks: 3 },
    { id: 'pro-2', mode: 'pro', taperWeeks: 2 },
    { id: 'pro-3', mode: 'pro', taperWeeks: 3 },
    { id: 'wf-4', mode: 'wf', taperWeeks: 4 },
  ];
  const results = list.map(s => scoreTaperScenario(s, ctx));
  results.sort((a, b) => b.score - a.score);
  return { results, best: results[0] };
}

// ═══════════════════════════════════════════════════════════════════════════
// ПУНКТ 5 — Оценка прикидов из дневника (после mock meet / соревнований)
// ═══════════════════════════════════════════════════════════════════════════

export interface DiaryLiftSession {
  date?: string;
  exercises: { name: string; sets: { weightKg: number; reps: number }[] }[];
}

export interface MeetEvaluationLift {
  name: string;
  plannedOpener: number;
  plannedSecond: number;
  plannedThird: number;
  actualBest: number;
  made: 'third' | 'second' | 'opener' | 'none';
  verdict: 'conservative' | 'optimal' | 'aggressive';
}

export interface MeetEvaluation {
  lifts: MeetEvaluationLift[];
  summary: string;
  nextStrategy: MeetStrategy;
}

const matchLiftName = (name: string, lifts: { name: string }[]) => {
  const n = norm(name);
  const exact = lifts.find(l => norm(l.name) === n);
  if (exact) return exact;
  if (/присед|сквот/.test(n)) return lifts.find(l => /присед|сквот/.test(norm(l.name)));
  if (/жим/.test(n) && !/ногами|стоя|армейск/.test(n)) return lifts.find(l => /жим/.test(norm(l.name)) && !/ногами|стоя|армейск/.test(norm(l.name)));
  if (/станов/.test(n)) return lifts.find(l => /станов/.test(norm(l.name)));
  return undefined;
};

/**
 * Сверка плана прикидов с ФАКТИЧЕСКИМИ подходами дневника: лучший сингл по
 * каждому лифту против опенера/второй/третьей → вердикт и рекомендация
 * стратегии для следующего старта.
 */
export function evaluateMeetAttemptsFromDiary(attempts: MeetAttemptsInfo | null | undefined, sessions: DiaryLiftSession[]): MeetEvaluation | null {
  if (!attempts || !attempts.lifts || attempts.lifts.length === 0) return null;
  const lifts: MeetEvaluationLift[] = attempts.lifts.map(planned => {
    let actualBest = 0;
    for (const s of sessions ?? []) {
      for (const ex of s.exercises ?? []) {
        const target = matchLiftName(ex.name, attempts.lifts);
        if (!target || target.name !== planned.name) continue;
        for (const set of ex.sets ?? []) {
          if ((set.reps ?? 0) === 1 && (set.weightKg ?? 0) > actualBest) actualBest = set.weightKg;
        }
      }
    }
    const made: MeetEvaluationLift['made'] = actualBest >= planned.third ? 'third' : actualBest >= planned.second ? 'second' : actualBest >= planned.opener ? 'opener' : 'none';
    const verdict: MeetEvaluationLift['verdict'] = made === 'third' ? 'conservative' : made === 'second' ? 'optimal' : 'aggressive';
    return { name: planned.name, plannedOpener: planned.opener, plannedSecond: planned.second, plannedThird: planned.third, actualBest, made, verdict };
  });
  const counters = { conservative: 0, optimal: 0, aggressive: 0 };
  for (const l of lifts) counters[l.verdict]++;
  // Строгое большинство: только если один вердикт доминирует над остальными.
  const maxCount = Math.max(counters.conservative, counters.optimal, counters.aggressive);
  const nextStrategy: MeetStrategy = maxCount === counters.conservative && counters.conservative > counters.aggressive && counters.conservative > counters.optimal
    ? 'aggressive'
    : maxCount === counters.aggressive && counters.aggressive > counters.conservative && counters.aggressive > counters.optimal
      ? 'conservative'
      : 'balanced';
  const parts = lifts.map(l => {
    const madeLabel = l.made === 'third' ? 'третья взята' : l.made === 'second' ? 'вторая взята' : l.made === 'opener' ? 'только опенер' : 'не взята';
    return `${l.name}: план ${l.plannedOpener}/${l.plannedSecond}/${l.plannedThird} — факт ${l.actualBest > 0 ? l.actualBest + ' кг' : 'нет синглов'} (${madeLabel})`;
  });
  const verdictLabel = nextStrategy === 'aggressive' ? 'можно агрессивнее' : nextStrategy === 'conservative' ? 'снизьте проценты' : 'стратегия оправдана';
  return {
    lifts,
    summary: `🩺 Оценка прикидов: ${parts.join('; ')}. Для следующего старта: ${verdictLabel}.`,
    nextStrategy,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Печать тренерской сводки (PDF через window.print)
// ═══════════════════════════════════════════════════════════════════════════

const escHtml = (s: string): string => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SEVERITY_COLOR: Record<CoachNoteSeverity, string> = {
  ok: '#22c55e', info: '#93c5fd', warn: '#f59e0b', danger: '#ef4444',
};

/**
 * Полная HTML-сводка тренерского вердикта для печати (XSS-экранирование
 * пользовательских строк: заметки, рекомендации, summary).
 */
export function buildTaperCoachPrintHtml(verdict: TaperCoachVerdict, ctx?: TaperCoachCtx): string {
  const feas = ctx ? pmFeasibility(ctx) : null;
  const cmp = ctx ? compareTaperScenarios(ctx) : null;
  const lines: string[] = [];
  lines.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Тренерская сводка тапера</title>');
  lines.push('<style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;max-width:800px;margin:0 auto;padding:20px}h1{font-size:18px;color:#0a7d45}.score{font-size:34px;font-weight:800;color:#0a7d45}.note{padding:6px 10px;border-left:4px solid #ccc;margin:4px 0;background:#f7f7f7}table{border-collapse:collapse;width:100%;margin-top:8px}td,th{border:1px solid #ddd;padding:5px 8px;text-align:left;font-size:11px}th{background:#f0f0f0}</style></head><body>');
  lines.push(`<h1>🧠 Тренерская сводка тапера/пика (ПЛ)</h1>`);
  lines.push(`<div class="score">${verdict.score}/100</div>`);
  lines.push(`<div style="font-weight:700;margin-bottom:8px">${escHtml(verdict.label)}</div>`);
  if (verdict.notes.length > 0) {
    lines.push('<h3>Заметки</h3>');
    for (const n of verdict.notes) {
      lines.push(`<div class="note" style="border-left-color:${SEVERITY_COLOR[n.severity]}">${escHtml(n.icon + ' ' + n.text)}</div>`);
    }
  }
  if (verdict.actions) {
    lines.push('<h3>Рекомендации тренера (авто-подбор)</h3>');
    lines.push(`<div style="font-size:11px">Схема: <b>${escHtml(verdict.actions.mode)}</b> · ${verdict.actions.taperWeeks} нед · весовая цель: ${escHtml(verdict.actions.weightGoal)} · mock meet: ${verdict.actions.mockMeet ? 'да' : 'нет'} · пост-старт: ${verdict.actions.postMeet ? 'да' : 'нет'} · стратегия: ${escHtml(verdict.actions.strategy)}</div>`);
    if (verdict.actions.rationale.length > 0) {
      lines.push('<ul style="font-size:11px">' + verdict.actions.rationale.map(r => `<li>${escHtml(r)}</li>`).join('') + '</ul>');
    }
  }
  if (feas && feas.lifts.length > 0) {
    lines.push('<h3>Достижимость плана ПМ к старту</h3>');
    lines.push(`<div style="font-size:11px;margin-bottom:4px">${escHtml(feas.summary)}</div>`);
    lines.push('<table><tr><th>Движение</th><th>Прогноз</th><th>План</th><th>Разрыв, кг</th><th>Нужно нед</th><th>Достижимо</th></tr>');
    for (const l of feas.lifts) {
      lines.push(`<tr><td>${escHtml(l.name)}</td><td>${l.forecast}</td><td>${l.planned}</td><td>${l.gapKg}</td><td>${l.weeksNeeded}</td><td>${l.feasible ? '✅' : '❌'}</td></tr>`);
    }
    lines.push('</table>');
  }
  if (cmp) {
    lines.push('<h3>Сравнение сценариев тапера</h3>');
    lines.push('<table><tr><th>Сценарий</th><th>Score</th><th>Сводка</th></tr>');
    for (const r of cmp.results.slice(0, 6)) {
      lines.push(`<tr><td><b>${escHtml(r.summary.split(':')[0] ?? r.scenario.id)}</b>${r.scenario.id === cmp.best.scenario.id ? ' ⭐ лучший' : ''}</td><td>${r.score}</td><td>${escHtml(r.summary)}</td></tr>`);
    }
    lines.push('</table>');
  }
  lines.push('</body></html>');
  return lines.join('\n');
}

/**
 * Печать ТАПЕР-ПЛАНА (пик-блока) — PDF через window.print (XSS-экранирование).
 * Показывает только хвост блока (вход в пик / mock / тапер / соревнования / пост):
 * неделя, даты, объём (сетов), средняя интенсивность (% ПМ), прикиды.
 */
export function buildPLTaperPrintHtml(plan: LMSBuildOutput): string {
  const esc = escHtml;
  const tail = (plan?.weeks ?? []).filter(w => w.taperWeek || w.mockMeet || w.meetWeek || w.postMeet);
  const lines: string[] = [];
  lines.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Тапер-план (ПЛ)</title>');
  lines.push('<style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;max-width:820px;margin:0 auto;padding:20px}h1{font-size:18px;color:#b45309}table{border-collapse:collapse;width:100%;margin-top:10px}td,th{border:1px solid #ddd;padding:5px 8px;text-align:left;font-size:11px;vertical-align:top}th{background:#f6e7cf}.flag{font-weight:700;white-space:nowrap}.warn{color:#b45309;font-weight:700}.date{color:#666;font-size:10px}.att{font-size:10px;color:#333}</style></head><body>');
  lines.push('<h1>🏁 Тапер-план (пик-блок ПЛ)</h1>');
  lines.push(`<div style="font-size:11px;margin-bottom:6px">Цикл: <b>${esc(plan?.template?.meta?.title ?? '—')}</b> · недель блока: <b>${tail.length}</b></div>`);
  if (tail.length === 0) {
    lines.push('<p style="color:#b45309">Тапер-блок не сгенерирован.</p>');
  } else {
    lines.push('<table><tr><th>Нед</th><th>Тип</th><th>Даты</th><th>Сетов</th><th>Инт. %</th><th>Прикиды</th><th>Заметка</th></tr>');
    for (const w of tail) {
      let sets = 0, pctSum = 0, pctN = 0;
      for (const d of w.days) for (const e of d.exercises) for (const ws of e.workSets) {
        const s = ws.sets ?? 0; sets += s; pctSum += (ws.pct ?? 0) * s; pctN += s;
      }
      const avgPct = pctN > 0 ? Math.round((pctSum / pctN) * 100) : 0;
      let flag = '';
      if (w.meetWeek) flag = '🏁 Соревнования';
      else if (w.mockMeet) flag = '🎯 Mock meet';
      else if (w.postMeet) flag = '🔄 Пост-старт';
      else if (w.rampWeek) flag = '📈 Вход в пик';
      else if (w.taperWeek) flag = '📉 Тапер';
      const date = w.weekStart && w.weekEnd ? `${w.weekStart} – ${w.weekEnd}` : '';
      const att = (w.meetAttempts?.lifts ?? [])
        .map(l => `${esc(l.name)}: ${l.opener}/${l.second}/${l.third}`).join(' · ');
      lines.push(`<tr><td>${w.week}</td><td class="flag">${flag}</td><td class="date">${esc(date)}</td><td>${sets}</td><td>${avgPct}%</td><td class="att">${esc(att)}</td><td>${esc(w.taperNote ?? '')}</td></tr>`);
    }
    lines.push('</table>');
  }
  lines.push('</body></html>');
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// P2-5 — СГОНКА ВЕСА К КАТЕГОРИИ: пик-неделя (вода/натрий/карбы) для ПЛ.
// ═══════════════════════════════════════════════════════════════════════════

export interface PLPeakDayCut {
  /** День перед стартом: 1 = за 7 дней, 7 = день старта. */
  day: number;
  label: string;
  waterMl: string;
  sodiumMg: string;
  carbsG: string;
  note: string;
}

export interface PLPeakWeekCutProtocol {
  /** Требуется ли сгонка (diff > 0). */
  needed: boolean;
  /** Сколько нужно согнать, кг. */
  toCutKg: number;
  /** Что реально даёт пик-неделя (вода/гликоген), кг. */
  peakWeekCapKg: number;
  days: PLPeakDayCut[];
  summary: string;
  warnings: string[];
}

const PW = (label: string, waterMl: string, sodiumMg: string, carbsG: string, note: string): PLPeakDayCut =>
  ({ day: 0, label, waterMl, sodiumMg, carbsG, note });

/**
 * Консервативный 7-дневный протокол сгонки к категории (вода/натрий/карбы).
 * Пик-неделя даёт ~1-2% массы (вода+гликоген). Если нужно согнать больше —
 * предупреждение: нужна более ранняя сгонка (питание/вода за 2-4 недели).
 */
export function buildPLPeakWeekCutProtocol(
  currentWeight: number,
  targetWeight: number,
): PLPeakWeekCutProtocol {
  const toCutKg = Math.max(0, (currentWeight || 0) - (targetWeight || 0));
  const capPct = 0.02; // пик-неделя = до 2% массы (вода+гликоген)
  const capKg = (currentWeight || 80) * capPct;
  const warnings: string[] = [];
  if (toCutKg > capKg) {
    warnings.push(`Нужно согнать ${toCutKg.toFixed(1)} кг, но пик-неделя даёт ~${capKg.toFixed(1)} кг (вода+гликоген). Остальное — только ранней сгонкой (калории/вода за 2-4 недели) или не получится.`);
  }
  if (toCutKg > 0 && toCutKg < 0.3) {
    warnings.push('Дифферент меньше 0.3 кг — манипуляция водой может не понадобиться; достаточно лёгкой сушки натрия в день старта.');
  }

  const base: PLPeakDayCut[] = [
    PW('За 7 дней', '6 л', '4 г', '4 г/кг', 'Водная загрузка, натрий на базу, карбы на базу.'),
    PW('За 6 дней', '6 л', '3.5 г', '4 г/кг', 'Водная загрузка продолжается.'),
    PW('За 5 дней', '5 л', '3 г', '3 г/кг', 'Натрий ↓, карбы ↓ — начало деплеции.'),
    PW('За 4 дня', '4 л', '2.5 г', '2.5 г/кг', 'Вода ↓, натрий ↓, карбы ↓.'),
    PW('За 3 дня', '3 л', '2 г', '1.5 г/кг', 'Деплеция карбов; тренировка лёгкая.'),
    PW('За 2 дня', '2 л', '1.5 г', '1 г/кг', 'Максимальная деплеция; лёгкая нагрузка.'),
    PW('День старта', 'по жажде', '0.5 г', 'загрузка к старту', 'Малыми глотками; натрий минимальный; карбы к взвешиванию.'),
  ].map((p, i) => ({ ...p, day: i + 1 }));

  const needed = toCutKg > 0;
  const summary = needed
    ? `Сгонка ${toCutKg.toFixed(1)} кг к категории (пик-неделя ≈${capKg.toFixed(1)} кг вода+гликоген): вода ↓ 6→2 л, натрий ↓ 4→0.5 г, карбы ↓ 4→1 г/кг, взвешивание утром старта.`
    : 'Вес уже в категории — манипуляция водой/натрием не требуется (опционально лёгкий протокол).';

  // A1-fix: при needed=false (вес уже в категории) НЕ отдаём агрессивный протокол деплеции
  // (вода 6→2 л, натрий 4→0.5 г) — показывать манипуляцию, когда она не нужна, вводит
  // в заблуждение и опасно (риск дегидратации без необходимости). Дни протокола пусты;
  // UI и так скрывает карточку сгонки при !needed.
  return { needed, toCutKg, peakWeekCapKg: capKg, days: needed ? base : [], summary, warnings };
}

export { buildPLTaperCurve };