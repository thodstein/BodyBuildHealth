/**
 * lms-macro-taper.engine.ts — применение тапера/пика к неделям ГОДОВОГО макроцикла (ПЛ).
 *
 * Закрывает gap: buildSrcMacrocycle раньше просто циклировал недели цикла в
 * peak/competition блоки БЕЗ реального тапера — фаза «пик» ничем не отличалась
 * от обычной тренировочной, неделя соревнований была повторением ближайшей
 * тренировочной недели, mock meet и пост-соревновательное восстановление
 * отсутствовали вовсе.
 *
 * Теперь для КАЖДОГО соревнования (недели с macroPhase='competition'):
 *  - предшествующие недели peak-блока → кривая тапера (канон lms-taper.engine);
 *  - неделя соревнований → meet-неделя: прикиды + разминка, аксессуары ×0.5;
 *  - неделя ЗА (taperWeeks+1) до старта → mock meet (имитация прикидок);
 *  - неделя ПОСЛЕ старта → пост-соревновательное восстановление (объём ×0.5, RIR +3).
 */
import { buildPLTaperCurve, type TaperCurvePoint, type TaperMode, type TaperWeightGoal } from './lms-taper.engine';
import { buildPLPeakBlockLayout, dateWeeksForward } from './lms-peak-block.engine';
import { computeMeetAttemptsFromPmRow, type LMSPlanWeek } from './lms-builder.engine';
import { workWeight } from './lms-progression.engine';
import { calcSessionMetrics, type SRExercise } from './lms-metrics.engine';
import { norm } from '../norm';
import type { MeetAttemptsInfo, MeetStrategy } from './competition-attempts';

export interface MacroTaperOpts {
  /** Раскладка тапера (канон): classic / pl / pro. */
  mode?: TaperMode;
  /** Весовая цель тапера (влияет на объём). */
  weightGoal?: TaperWeightGoal;
  /** Стратегия прикидов. */
  strategy?: MeetStrategy;
  /** Ставить mock meet перед каждым соревнованием. */
  mockMeet?: boolean;
  /** Ставить пост-соревновательную неделю после каждого старта. */
  postMeet?: boolean;
  /** Число тапер-недель перед соревнованием (по умолчанию 2). */
  taperWeeksPerBlock?: number;
  /** ОКНО до старта (weeksToMeet) — кривая блока = вход в пик + глубокий тапер
   *  (lms-peak-block.engine). Если задано, taperWeeksPerBlock = недели глубокого
   *  тапера внутри окна. Иначе — только taperWeeksPerBlock глубокого тапера. */
  windowWeeks?: number;
  /** Весь окно = непрерывный тапер (без отдельного «входа в пик»). */
  wholeWindowAsTaper?: boolean;
}

export interface MacroTaperResult {
  weeks: LMSPlanWeek[];
  notes: string[];
}

const isMain = (e: { load?: string }) => e.load === 'main' || e.load === 'Тяжелая';

/** Пересчёт метрик сессии после трансформации сетов. */
function remeasure(day: LMSPlanWeek['days'][number]): LMSPlanWeek['days'][number] {
  const metricsEx: SRExercise[] = day.exercises.map(pe => ({
    name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
    sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
  }));
  return { ...day, metrics: calcSessionMetrics(metricsEx) };
}

/** Применить одну точку канонической кривой к неделе (макро-контекст). */
function applyCurvePoint(wk: LMSPlanWeek, pt: TaperCurvePoint, strategy: MeetStrategy, isLast: boolean): LMSPlanWeek {
  // Соревновательная неделя ПЛ-протокола (100% ПМ): основные движения — только разминка
  // 50/70/90% × 3/2/1 + прикиды (meetAttempts) отдельно: «разминка → открытие → 2-3 прохода».
  const protocolFinal = isLast && pt.warmupOnly === true;
  const days = wk.days.map(d => {
    const exercises = d.exercises.map(e => {
      if (isMain(e)) {
        if (protocolFinal) {
          const warmup = [
            { sets: 1, reps: 3, weight: Math.round(workWeight(e.pm, 0.5) * 10) / 10, rir: 3, pct: 0.5 },
            { sets: 1, reps: 2, weight: Math.round(workWeight(e.pm, 0.7) * 10) / 10, rir: 2, pct: 0.7 },
            { sets: 1, reps: 1, weight: Math.round(workWeight(e.pm, 0.9) * 10) / 10, rir: 1, pct: 0.9 },
          ];
          return { ...e, rir: pt.rirTarget ?? 0, workSets: warmup };
        }
        const pct = pt.intensityMode === 'set_pct' && pt.intensityPct > 0 ? pt.intensityPct : e.workSets[0]?.pct ?? 1;
        const reps = pt.singles ? 1 : e.workSets[0]?.reps ?? 1;
        const weight = Math.round(workWeight(e.pm, pct) * 10) / 10;
        return {
          ...e,
          rir: pt.rirTarget != null ? pt.rirTarget : e.rir + pt.rirShift,
          workSets: e.workSets.map(ws => ({
            ...ws,
            pct,
            reps,
            weight,
            rir: pt.rirTarget != null ? pt.rirTarget : ws.rir + pt.rirShift,
          })),
        };
      }
      return {
        ...e,
        rir: e.rir + pt.rirShift,
        workSets: e.workSets.map(ws => ({
          ...ws,
          sets: Math.max(1, Math.round(ws.sets * pt.volumePct)),
          rir: ws.rir + pt.rirShift,
        })),
      };
    });
    return remeasure({ ...d, exercises });
  });
  return {
    ...wk,
    days,
    taperWeek: true,
    taperNote: `${pt.label}${pt.focus ? `: ${pt.focus}` : ''} · стратегия ${strategy}`,
  };
}

/** Превратить неделю в неделю прикидов (mock meet или соревнования). */
function toAttemptsWeek(wk: LMSPlanWeek, kind: 'mock' | 'meet', strategy: MeetStrategy): LMSPlanWeek | null {
  const attempts = computeMeetAttemptsFromPmRow(wk.pmRow, strategy);
  if (!attempts) return null;
  const liftByName = new Map(attempts.lifts.map(l => [norm(l.name), l]));
  const matchLift = (name: string) => {
    const exact = liftByName.get(norm(name));
    if (exact) return exact;
    const n = norm(name);
    if (/присед|сквот/.test(n)) return attempts.lifts.find(l => /присед|сквот/.test(norm(l.name)));
    if (/жим.*леж|леж.*жим/.test(n)) return attempts.lifts.find(l => /жим.*леж|леж.*жим/.test(norm(l.name)));
    if (/станов/.test(n)) return attempts.lifts.find(l => /станов/.test(norm(l.name)));
    return undefined;
  };
  const days = wk.days.map(d => {
    const exercises = d.exercises.map(e => {
      const lift = matchLift(e.name);
      if (lift) {
        const mk = (weight: number, rir: number) => ({
          pct: Math.round((weight / Math.max(1, wk.pmRow[e.name] ?? e.pm)) * 1000) / 1000,
          reps: 1, sets: 1, weight, rir,
        });
        // 🔥 Прайминг за 1-2 дня до старта (только в неделе соревнований).
        const priming = kind === 'meet'
          ? [
              { sets: 1, reps: 1, weight: Math.round(workWeight(wk.pmRow[e.name] ?? e.pm, 0.6) * 10) / 10, rir: 3, pct: 0.6 },
              { sets: 1, reps: 1, weight: Math.round(workWeight(wk.pmRow[e.name] ?? e.pm, 0.7) * 10) / 10, rir: 3, pct: 0.7 },
            ]
          : [];
        return { ...e, rir: 1, workSets: [...priming, mk(lift.opener, 2), mk(lift.second, 1), mk(lift.third, 0)] };
      }
      return {
        ...e,
        rir: e.rir + 1,
        workSets: e.workSets.map(ws => ({ ...ws, sets: Math.max(1, Math.round(ws.sets * 0.5)) })),
      };
    });
    return remeasure({ ...d, exercises });
  });
  return {
    ...wk,
    days,
    [kind === 'mock' ? 'mockMeet' : 'meetWeek']: true,
    meetAttempts: attempts,
    taperNote: kind === 'mock'
      ? '🎯 Имитация соревнований (mock meet): прикиды-синглы (опенер RIR2 → вторая RIR1 → третья RIR0), аксессуары ×0.5.'
      : '🏁 Соревнования: прикиды (опенер/вторая/третья ×1) как подходы дня старта + 🔥 прайминг-синглы 60/70% за 1-2 дня, аксессуары ×0.5.',
  };
}

/** Пост-соревновательная неделя: объём ×0.5, RIR +3. */
function toPostMeetWeek(wk: LMSPlanWeek, volumeMult = 0.5): LMSPlanWeek {
  const days = wk.days.map(d => {
    const exercises = d.exercises.map(e => ({
      ...e,
      rir: e.rir + 3,
      workSets: e.workSets.map(ws => ({ ...ws, sets: Math.max(1, Math.round(ws.sets * volumeMult)), rir: ws.rir + 3 })),
    }));
    return remeasure({ ...d, exercises });
  });
  return {
    ...wk,
    days,
    sourcePhase: 'deload',
    macroPhase: 'transition',
    postMeet: true,
    meetAttempts: undefined,
    taperNote: `🔄 Пост-соревновательное восстановление: объём ×${volumeMult}, RIR +3 — полная разгрузка после старта.`,
  };
}

/**
 * Применить тапер/пик к неделям макроцикла ПЛ (идемпотентно: уже размеченные
 * недели не трогаются). Возвращает новый массив недель и заметки.
 */
export function applyMacroTaperToPLWeeks(weeks: LMSPlanWeek[], opts?: MacroTaperOpts): MacroTaperResult {
  const notes: string[] = [];
  const mode: TaperMode = opts?.mode ?? 'classic';
  const weightGoal: TaperWeightGoal = opts?.weightGoal ?? 'maintain';
  const strategy: MeetStrategy = opts?.strategy ?? 'balanced';
  const taperWeeks = Math.max(1, Math.min(3, opts?.taperWeeksPerBlock ?? 2));
  // A1: если задано окно до старта — кривая блока = вход в пик + глубокий тапер
  // (lms-peak-block.engine). Иначе — только taperWeeks глубокого тапера (legacy).
  const layout = opts?.windowWeeks != null ? buildPLPeakBlockLayout({
    windowWeeks: opts.windowWeeks,
    taperWeeks,
    mode,
    weightGoal,
    mockMeet: opts?.mockMeet,
    meetWeek: true,
    postMeet: opts?.postMeet,
    wholeWindowAsTaper: opts?.wholeWindowAsTaper,
  }) : null;
  const curve = layout ? layout.curve : buildPLTaperCurve({ taperWeeks, mode, weightGoal });
  if (!Array.isArray(weeks) || weeks.length === 0) return { weeks, notes };

  const out = weeks.map(w => ({ ...w }));
  const alreadyMarked = (w: LMSPlanWeek) => !!(w.taperWeek || w.mockMeet || w.meetWeek || w.postMeet);

  for (let ci = 0; ci < out.length; ci++) {
    const meetWk = out[ci];
    if (meetWk.macroPhase !== 'competition') continue;
    if (alreadyMarked(meetWk)) continue;

    // ── 1. Meet-неделя: прикиды + разминка, аксессуары ×0.5 ──
    const meet = toAttemptsWeek(meetWk, 'meet', strategy);
    if (!meet) continue;
    out[ci] = meet;
    notes.push(`🏁 Соревнование (нед ${meet.week}): прикиды ${strategy}, аксессуары ×0.5.`);

    // ── 2. Тапер к предыдущим неделям peak-блока (непрерывный диапазон фазы peak) ──
    const peakIdx: number[] = [];
    for (let p = ci - 1; p >= 0 && out[p].macroPhase === 'peak'; p--) peakIdx.unshift(p);
    // Применяем ВСЮ кривую (ramp + taper) к доступным peak-неделям; если peak-недель
    // меньше — берём последние applyCount точек (финал всегда самый глубокий).
    const applyCount = Math.min(curve.length, peakIdx.length);
    for (let t = 0; t < applyCount; t++) {
      const idx = peakIdx[peakIdx.length - applyCount + t];
      if (alreadyMarked(out[idx])) continue;
      out[idx] = applyCurvePoint(out[idx], curve[t], strategy, t === applyCount - 1);
    }
    if (applyCount > 0) notes.push(`📉 Тапер (${mode}): нед ${peakIdx.slice(-applyCount).map(i => out[i].week).join(', ')} — объём ↓, RIR ↑.`);

    // A2-fix: старт ровно после предыдущего соревнования — недель под тапер/пик нет
    // (цикл поиска peak-недель останавливается на предыдущем competition). Это крайний,
    // но реальный кейс спаренных стартов; тапер физически негде разместить — честно
    // предупреждаем, чтобы спортсмен снизил объём вручную.
    if (applyCount === 0 && ci > 0 && out[ci - 1].macroPhase === 'competition') {
      notes.push(`⚠ Старт (нед ${meet.week}) идёт сразу после предыдущего соревнования — нет недель для тапера/пика; при спаренных стартах снизьте объём вручную.`);
    }

    // ── 3. Mock meet: неделя ЗА (applyCount+1) до старта (последняя перед peak-блоком) ──
    if (opts?.mockMeet) {
      const mockIdx = ci - applyCount - 1;
      if (mockIdx >= 0 && !alreadyMarked(out[mockIdx]) && out[mockIdx].macroPhase !== 'competition') {
        const mock = toAttemptsWeek(out[mockIdx], 'mock', strategy);
        if (mock) {
          out[mockIdx] = mock;
          notes.push(`🎯 Mock meet (нед ${mock.week}) — имитация прикидок за 10-14 дней до старта.`);
        }
      }
    }

    // ── 4. Пост-соревновательная неделя ПОСЛЕ старта ──
    if (opts?.postMeet) {
      const afterIdx = ci + 1;
      if (afterIdx < out.length && !alreadyMarked(out[afterIdx]) && out[afterIdx].macroPhase !== 'competition') {
        out[afterIdx] = toPostMeetWeek(out[afterIdx]);
        notes.push(`🔄 Пост-соревновательное восстановление (нед ${out[afterIdx].week}): объём ×0.5, RIR +3.`);
      }
    }
  }

  return { weeks: out, notes };
}

// ═══════════════════════════════════════════════════════════════════════════
// C2 — ТАПЕР ПО ВСЕМУ СЕЗОНУ (несколько соревнований).
// ═══════════════════════════════════════════════════════════════════════════

export interface PLSeasonMeet {
  id: string;
  name: string;
  /** Недель до старта (1-52, от начала сезона). */
  weeksToStart: number;
}

export interface PLSeasonPeaksOpts extends Omit<MacroTaperOpts, 'taperWeeksPerBlock'> {
  /** Окно пик-блока для каждого старта (weeksToMeet). По умолчанию — weeksToStart старта. */
  windowWeeks?: number;
  /** Дата начала сезона (ISO) — календарная разметка всех недель плана вперёд. */
  seasonStart?: string;
}

export interface PLSeasonPeaksResult {
  weeks: LMSPlanWeek[];
  notes: string[];
}

/**
 * Полный план на сезон: базовые недели цикла продлеваются до самого дальнего
 * старта, под каждое соревнование ставится пик-блок (окно → вход в пик + mock +
 * глубокий тапер + соревнования [+ пост]), сдвоенные блоки защищены от наложения.
 */
export function buildPLSeasonPeaks(
  baseWeeks: LMSPlanWeek[],
  meets: PLSeasonMeet[],
  opts?: PLSeasonPeaksOpts,
): PLSeasonPeaksResult {
  const sorted = (meets ?? [])
    .filter(m => Number.isFinite(m.weeksToStart) && m.weeksToStart >= 1)
    .sort((a, b) => a.weeksToStart - b.weeksToStart);
  if (sorted.length === 0) return { weeks: baseWeeks ?? [], notes: ['⚠ Сезон пуст — пик-блоки не построены.'] };
  const base = baseWeeks ?? [];
  if (base.length === 0) return { weeks: [], notes: ['⚠ Нет базового плана — сезон не построен.'] };

  const postW = opts?.postMeet ? 1 : 0;
  const maxWeek = Math.max(...sorted.map(m => m.weeksToStart));
  const total = maxWeek + 1 + postW;

  // Продлеваем базовые недели до длины сезона (повтор последней как наполнитель).
  const out: LMSPlanWeek[] = [];
  for (let i = 0; i < total; i++) {
    const src = base[i] ?? base[base.length - 1];
    const wk: LMSPlanWeek = { ...src, week: i + 1, macroPhase: undefined };
    delete (wk as { meetAttempts?: unknown }).meetAttempts;
    out.push(wk);
  }

  // Отмечаем недели соревнований и их peak-окна.
  for (const m of sorted) {
    const compIdx = m.weeksToStart - 1;
    out[compIdx] = { ...out[compIdx], macroPhase: 'competition' };
    const win = Math.max(1, opts?.windowWeeks ?? m.weeksToStart);
    for (let w = 1; w <= win; w++) {
      const idx = compIdx - w;
      if (idx >= 0 && out[idx].macroPhase !== 'competition') out[idx] = { ...out[idx], macroPhase: 'peak' };
    }
  }

  const res = applyMacroTaperToPLWeeks(out, {
    mode: opts?.mode,
    weightGoal: opts?.weightGoal,
    strategy: opts?.strategy,
    mockMeet: opts?.mockMeet,
    postMeet: opts?.postMeet,
    windowWeeks: opts?.windowWeeks,
    wholeWindowAsTaper: opts?.wholeWindowAsTaper,
  });

  // P2-6: календарная разметка вперёд от начала сезона.
  const weeks = opts?.seasonStart ? dateWeeksForward(res.weeks, opts.seasonStart) : res.weeks;

  const notes = [
    `📅 Сезон: ${sorted.map(m => `«${m.name}» нед ${m.weeksToStart}`).join(' · ')} → план на ${total} нед.`,
    ...res.notes,
  ];
  return { weeks, notes };
}
