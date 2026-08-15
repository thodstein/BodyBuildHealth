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
import { buildPLTaperCurve, taperWeeksByFatigue, type TaperMode, type TaperWeightGoal } from './lms-taper.engine';
import { LAST_HEAVY_DAYS, type Lift } from '../pro/taper.engine';
import { norm } from '../norm';
import type { ACWRZone } from '../pro/training-load.engine';
import type { MeetStrategy } from './competition-attempts';

export interface TaperCoachAcwr { ratio: number; zone: ACWRZone }

export interface TaperCoachCtx {
  /** Усталость 0-100 (readiness.fatigue). */
  fatigue?: number;
  /** ACWR из дневника sRPE. */
  acwr?: TaperCoachAcwr;
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
  const k = Number.isFinite(ctx.weeklyK) ? (ctx.weeklyK ?? 0.01) : 0.01;
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

  // ── Длительность: по усталости, коррекция по ACWR ──
  let taperWeeks = taperWeeksByFatigue(fatigue) ?? 2;
  if (zone === 'dangerous') { taperWeeks = Math.min(4, taperWeeks + 1); rationale.push('⛔ ACWR в опасной зоне — тапер длиннее (глубокая разгрузка).'); }
  else if (zone === 'caution') { rationale.push('⚠ ACWR осторожная зона — разгрузка обязательна.'); }
  else if (zone === 'undertrained') { taperWeeks = Math.max(1, taperWeeks - 1); rationale.push('🔵 Недогруз (ACWR < 0.8) — тапер короче, глубокой усталости нет.'); }
  if (fatigue != null && fatigue >= 70) rationale.push(`🔥 Усталость ${Math.round(fatigue)}/100 — длинный тапер ${taperWeeks} нед.`);

  // ── Режим: перегруз → classic; цель PR → pl; низкая усталость → pro ──
  let mode: TaperMode = 'classic';
  const planned = ctx.plannedPm ?? {};
  const plannedMax = Math.max(0, ...Object.values(planned).filter(v => v > 0));
  const forecastMax = Math.max(0, ...Object.values(ctx.forecastPm ?? {}).filter(v => v > 0));
  const actualMax = Math.max(0, ...Object.values(ctx.actualPm ?? {}).filter(v => v > 0));
  const baseMax = actualMax > 0 ? actualMax : forecastMax;
  const chasingPR = plannedMax > 0 && baseMax > 0 && plannedMax > baseMax * 1.02;
  if (zone === 'dangerous' || zone === 'caution' || (fatigue != null && fatigue >= 70)) {
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
  for (const d of w.days) for (const e of d.exercises) for (const ws of e.workSets) v += ws.sets;
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
    const heavySets = finalTaper.days.flatMap(d => d.exercises.filter(e => isMain(e)).flatMap(e => e.workSets))
      .filter(ws => ws.pct >= 0.85 && ws.sets >= 2);
    if (heavySets.length > 0) {
      score -= 25;
      notes.push({ severity: 'danger', icon: '🚨', text: `В финальную тапер-неделю ${finalTaper.week} остались тяжёлые рабочие сеты (${heavySets.length} шт ≥85%) — перегруз ЦНС перед стартом. Последние тяжёлые: присед за ${LAST_HEAVY_DAYS.squat} дн, жим за ${LAST_HEAVY_DAYS.bench} дн, тяга за ${LAST_HEAVY_DAYS.deadlift} дн до старта.` });
    } else {
      notes.push({ severity: 'ok', icon: '✅', text: 'Тяжёлых рабочих сетов в финальной неделе нет — ЦНС успеет восстановиться к старту.' });
    }
  }

  // ── Дубль разгрузки: тапер поверх deload ──
  const deloadTaper = taperWeeksList.find(w => w.sourcePhase === 'deload');
  if (deloadTaper) { score -= 12; notes.push({ severity: 'warn', icon: '⚠', text: `Неделя ${deloadTaper.week} — и тапер, и фаза deload одновременно: двойная разгрузка снижает стимул, объём некуда снижать.` }); }

  // ── Mock meet и пост-старт ──
  if (meetWeeks.length > 0) {
    if (!weeks.some(w => w.mockMeet)) { score -= 5; notes.push({ severity: 'info', icon: '🎯', text: 'Mock meet отсутствует — имитация прикидок за 10-14 дней до старта проверяет стратегию на практике.' }); }
    if (!weeks.some(w => w.postMeet)) { score -= 5; notes.push({ severity: 'info', icon: '🔄', text: 'Пост-соревновательная неделя отсутствует — восстановление после прикидок (×0.5, RIR +3) снижает риск перетренированности.' }); }
  } else if (taperWeeksList.length > 0) {
    notes.push({ severity: 'info', icon: '🏁', text: 'Тапер применён, но недели соревнований нет — добавьте «🏁 Неделю соревнований в конце», чтобы получить прикиды дня старта.' });
  }

  // ── Усталость vs длительность тапера ──
  if (ctx?.fatigue != null && taperWeeksList.length > 0) {
    const recommended = taperWeeksByFatigue(ctx.fatigue) ?? 2;
    if (taperWeeksList.length < recommended) {
      score -= 10;
      notes.push({ severity: 'warn', icon: '🔥', text: `Усталость ${Math.round(ctx.fatigue)}/100 требует тапера ${recommended} нед, в плане ${taperWeeksList.length} — удлините тапер.` });
    }
  }

  // ── ACWR ──
  if (ctx?.acwr) {
    if (ctx.acwr.zone === 'dangerous') { score -= 25; notes.push({ severity: 'danger', icon: '⛔', text: `ACWR ${ctx.acwr.ratio.toFixed(2)} — опасная зона: перед пиком обязателен глубокий тапер (объём ×0.45-0.5, RIR +2).` }); }
    else if (ctx.acwr.zone === 'caution') { score -= 10; notes.push({ severity: 'warn', icon: '⚠', text: `ACWR ${ctx.acwr.ratio.toFixed(2)} — осторожная зона: снизьте объём финальных недель, добавьте RIR.` }); }
    else if (ctx.acwr.zone === 'undertrained') { score -= 4; notes.push({ severity: 'info', icon: '🔵', text: 'ACWR < 0.8 — недогруз: тапер можно короче, добавьте прайминг-интенсивность.' }); }
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

export { buildPLTaperCurve };
