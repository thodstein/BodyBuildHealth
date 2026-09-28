/**
 * lms-deload.engine.ts — корректная вставка делода в собранный PL-план
 * по явному действию пользователя (мост kind 'deload': DeloadSchedulerTab,
 * PeriodizationDesignerTab, UnifiedIntelligenceHub, Quality Hub).
 *
 * Отличие от runtime-оверлея `deloadAdjust` (SRCBBScreen): делод применяется
 * НЕ к показу SessionPlayer, а к самому плану — объём/RIR меняются в неделях
 * (таблица, heatmap, метрики, печать/экспорт видят одно и то же), действие
 * идемпотентно и переживает пересборку (конфиг персистится в сессии и
 * переприменяется в buildSrc).
 *
 * Правила корректности:
 *  - не трогаем соревновательные недели (meetWeek/mockMeet/postMeet/taperWeek) —
 *    у них своя разгрузка/пик (перенос разгрузки «перед стартом» сломал бы тапер);
 *  - не трогаем неделю дважды (идемпотентность: повторный клик — только заметка);
 *  - объём: sets × volumeMult с флором 1; pct/вес сохраняем (Bosquet 2005:
 *    интенсивность в разгрузке сохраняется, объём −40…60%);
 *  - RIR: +rirShift, кламп 0…6;
 *  - метрики дня и цикла пересчитываются (тоннаж/КПШ/УОИ — печать и графики честные);
 *  - пустой список недель → ближайшая подходящая неделя от текущей (вперёд, затем назад);
 *  - входной план НЕ мутируется (клон только изменённых недель).
 */
import { calcCycleMetrics, calcSessionMetrics, type SRExercise } from './lms-metrics.engine';
import { getPLVolumeLandmarks, type LMSBuildOutput, type LMSPlanWeek } from './lms-builder.engine';

export interface PLDeloadRequest {
  /** Запрошенные недели (1-based). Пусто → ближайшая подходящая неделя. */
  weeks?: number[];
  /** Множитель объёма (сеты). Дефолт 0.5. */
  volumeMult?: number;
  /** Прибавка к RIR. Дефолт 3. */
  rirShift?: number;
  /** Текущая неделя (для выбора при пустом списке недель). */
  currentWeek?: number;
  /** Уровень для пересчёта plVolumeLandmarks (если они были в плане). */
  level?: string;
  /** PED-множитель MRV для пересчёта plVolumeLandmarks. */
  pedMrvMult?: number;
}

export interface PLDeloadSkip {
  week: number;
  reason: string;
}

export interface PLDeloadResult {
  plan: LMSBuildOutput;
  /** Реально изменённые недели. */
  applied: number[];
  /** Пропуски с честной причиной (соревновательная неделя/тапер/уже делод). */
  skipped: PLDeloadSkip[];
  /** Готовые строки для rationale/тоста. */
  notes: string[];
}

const MAX_RIR = 6;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Защищённая неделя (своя разгрузка/пик) — причина пропуска или null. */
function protectedReason(w: LMSPlanWeek): string | null {
  if (w.meetWeek) return 'неделя соревнований';
  if (w.mockMeet) return 'mock meet';
  if (w.postMeet) return 'пост-старт';
  if (w.taperWeek) return 'тапер';
  return null;
}

/**
 * Выбор недель делода: явные (валидные) или ближайшая подходящая от текущей.
 * Чистая (используется и UI для превью).
 */
export function pickDeloadWeeks(
  plan: LMSBuildOutput,
  weeks: number[] | undefined,
  currentWeek?: number,
): { weeks: number[]; skipped: PLDeloadSkip[] } {
  const byNum = new Map(plan.weeks.map(w => [w.week, w]));
  const out: number[] = [];
  const skipped: PLDeloadSkip[] = [];
  const requested = (weeks || [])
    .filter(n => Number.isFinite(n))
    .map(n => Math.round(n));
  if (requested.length > 0) {
    for (const n of [...new Set(requested)]) {
      const w = byNum.get(n);
      if (!w) { skipped.push({ week: n, reason: 'нет такой недели в плане' }); continue; }
      const prot = protectedReason(w);
      if (prot) { skipped.push({ week: n, reason: prot }); continue; }
      if (w.deload) { skipped.push({ week: n, reason: 'уже делод' }); continue; }
      out.push(n);
    }
    return { weeks: out, skipped };
  }
  // Пусто: ближайшая подходящая неделя от текущей — сначала вперёд, затем назад.
  const nums = plan.weeks.map(w => w.week);
  if (nums.length === 0) return { weeks: out, skipped };
  const from = clamp(Math.round(currentWeek ?? 1), 1, Math.max(1, plan.weeks.length));
  const ordered = [...nums.filter(n => n >= from), ...nums.filter(n => n < from).reverse()];
  const pick = ordered.find(n => {
    const w = byNum.get(n) as LMSPlanWeek;
    return !w.deload && !protectedReason(w);
  });
  if (pick != null) out.push(pick);
  else skipped.push({ week: from, reason: 'нет подходящей недели (все защищённые/уже делод)' });
  return { weeks: out, skipped };
}

/**
 * Применить делод к плану (чистая функция: вход не мутируется).
 * Возвращает новый план + честный отчёт, что применено и что пропущено.
 */
export function applyPLDeload(plan: LMSBuildOutput, req: PLDeloadRequest = {}): PLDeloadResult {
  const volumeMult = clamp(req.volumeMult ?? 0.5, 0.2, 1);
  const rirShift = Math.round(clamp(req.rirShift ?? 3, 0, MAX_RIR));
  const { weeks: targets, skipped } = pickDeloadWeeks(plan, req.weeks, req.currentWeek);
  const applied: number[] = [];
  const notes: string[] = [];
  const targetSet = new Set(targets);

  const weeks: LMSPlanWeek[] = plan.weeks.map(wk => {
    if (!targetSet.has(wk.week)) return wk;
    const days = wk.days.map(d => {
      const exercises = d.exercises.map(ex => {
        const workSets = ex.workSets.map(ws => ({
          ...ws,
          sets: Math.max(1, Math.round(ws.sets * volumeMult)),
          rir: Math.min(MAX_RIR, (ws.rir ?? ex.rir ?? 2) + rirShift),
        }));
        return { ...ex, rir: Math.min(MAX_RIR, (ex.rir ?? 2) + rirShift), workSets };
      });
      const metricsEx: SRExercise[] = exercises.map(pe => ({
        name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
        sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
      }));
      return { ...d, exercises, metrics: calcSessionMetrics(metricsEx) };
    });
    applied.push(wk.week);
    return { ...wk, days, deload: true };
  });

  if (applied.length === 0) {
    const why = skipped.length
      ? skipped.map(s => `нед ${s.week} — ${s.reason}`).join('; ')
      : 'нет подходящей недели';
    notes.push(`🔋 Делод не добавлен: ${why}.`);
    return { plan, applied, skipped, notes };
  }

  const sessions = weeks.flatMap(wk => wk.days.map(d => d.exercises.map(pe => ({
    name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
    sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
  } as SRExercise))));
  const cycleMetrics = calcCycleMetrics(sessions);

  const deloadLine = `🔋 Делод: нед ${applied.join(', ')} — объём ×${volumeMult}, RIR +${rirShift} (интенсивность сохранена, Bosquet 2005)`;
  const skipLine = skipped.length
    ? ` Пропущено: ${skipped.map(s => `нед ${s.week} — ${s.reason}`).join('; ')}.`
    : '';
  notes.push(deloadLine + '.' + skipLine);

  const next: LMSBuildOutput = {
    ...plan,
    weeks,
    cycleMetrics,
    progressionRationale: (plan.progressionRationale ? plan.progressionRationale + ' ' : '') + deloadLine + '.',
  };
  if (plan.plVolumeLandmarks && plan.plVolumeLandmarks.length > 0 && req.level) {
    next.plVolumeLandmarks = getPLVolumeLandmarks(weeks, req.level, req.pedMrvMult ?? 1);
  }
  return { plan: next, applied, skipped, notes };
}

/** Есть ли в плане хотя бы одна делод-неделя. */
export function planHasDeload(plan: LMSBuildOutput | null | undefined): boolean {
  return !!plan && Array.isArray(plan.weeks) && plan.weeks.some(w => w.deload === true);
}
