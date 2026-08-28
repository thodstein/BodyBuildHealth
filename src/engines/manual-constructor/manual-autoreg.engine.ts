/**
 * manual-autoreg.engine.ts — PRO-авторегуляция для ручного конструктора.
 *
 * Фаза 4: ACWR/readiness/HRV/sleep/fatigue → topSet/volume/RIR, diary-feedback per-exercise,
 * shouldTrainToday gate, deload suggestions по ACWR/monotony/plateau.
 *
 * Обёртка над training-load + autoregulation-pro + diary-autoreg для UserProgram.
 */

import type { UserProgram, UserWeek } from '../user-program/user-program.types';
import type { WorkoutLog } from '../../core/types';
import { toDailyLoads, acuteChronicRatio, weeklyMonotony, fitnessFatigue, type TrainingSession, type ACWRResult, type MonotonyResult } from '../pro/training-load.engine';
import { autoRegulate, sessionAutoRegulate, shouldTrainToday, type AutoRegInput, type AutoRegOutput } from '../pro/autoregulation-pro.engine';
import { buildDiaryAutoreg, type DiaryAutoregResult } from '../pro/diary-autoreg.engine';

/** Готовность из профиля: 0-100, HRV ratio, sleepScore. */
export interface ReadinessSignals {
  readiness: number; // 0-100
  hrvMs?: number;
  hrvBaseline?: number;
  sleepHours?: number;
  sleepQuality?: number; // 1-10
  stressLevel?: number; // 1-10
  fatigue?: number; // 0-100
  lastSessionRPE?: number;
  lastVelocityLossPct?: number;
}

/** Вычислить ACWR/monotony/banister по истории sRPE сессий. */
export function analyzeTrainingLoad(
  sessions: TrainingSession[],
  referenceDate?: string,
): { dailyLoads: ReturnType<typeof toDailyLoads>; acwr: ACWRResult; monotony: MonotonyResult; banister: ReturnType<typeof fitnessFatigue> } {
  const dailyLoads = toDailyLoads(sessions);
  const acwr = acuteChronicRatio(dailyLoads, referenceDate);
  const monotony = weeklyMonotony(dailyLoads, referenceDate);
  const banister = fitnessFatigue(dailyLoads);
  return { dailyLoads, acwr, monotony, banister };
}

/** Построить AutoRegInput из сигналов готовности + ACWR. */
export function buildAutoRegInput(
  signals: ReadinessSignals,
  acwr: ACWRResult,
  opts?: { plannedTopSetPct?: number; plannedRIR?: number },
): AutoRegInput {
  const hrvRatio = signals.hrvMs && signals.hrvBaseline ? signals.hrvMs / signals.hrvBaseline : undefined;
  const sleepScore = signals.sleepQuality != null ? Math.round((signals.sleepQuality / 10) * 100) : (signals.sleepHours != null ? (signals.sleepHours >= 7 ? 80 : signals.sleepHours >= 6 ? 60 : 40) : undefined);
  return {
    readiness: signals.readiness ?? 70,
    acwr,
    fatigue: signals.fatigue,
    hrvRatio,
    sleepScore,
    lastSessionRPE: signals.lastSessionRPE,
    lastVelocityLossPct: signals.lastVelocityLossPct,
    plannedTopSetPct: opts?.plannedTopSetPct,
    plannedRIR: opts?.plannedRIR,
  };
}

/** Запустить авторегуляцию и вернуть вывод. */
export function runManualAutoreg(
  signals: ReadinessSignals,
  acwr: ACWRResult,
  opts?: { plannedTopSetPct?: number; plannedRIR?: number },
): AutoRegOutput {
  const input = buildAutoRegInput(signals, acwr, opts);
  return autoRegulate(input);
}

/** Применить авторегуляцию к выбранным неделям программы (volume/topSet/RIR). */
export function applyAutoregToManualProgram(
  program: UserProgram,
  fromWeek: number,
  toWeek: number,
  autoreg: AutoRegOutput,
): UserProgram {
  const weeks = (program.bb?.weeks ?? (program.hybrid?.bbWeeks as UserWeek[] | undefined));
  if (!weeks) return program;
  const clonedWeeks = JSON.parse(JSON.stringify(weeks)) as UserWeek[];
  for (const w of clonedWeeks) {
    if (w.week < fromWeek || w.week > toWeek) continue;
    const isDeload = !!w.deload || w.phase === 'deload';
    if (autoreg.deload && !isDeload) {
      // Если deload триггер — помечаем неделю как deload (но не меняем фазу насильно, только объём)
    }
    for (const s of w.sessions) {
      for (const b of s.blocks) {
        // Объём: корректируем кол-во сетов
        if (autoreg.volumeMultiplier !== 1 && b.sets.length > 0) {
          const origLen = b.sets.length;
          const newLen = Math.max(1, Math.round(origLen * autoreg.volumeMultiplier));
          if (newLen < origLen) b.sets = b.sets.slice(0, newLen);
          else if (newLen > origLen) {
            const tmpl = b.sets[b.sets.length - 1];
            while (b.sets.length < newLen) b.sets.push({ ...tmpl });
          }
        }
        // Топ-сет вес + RIR
        for (const st of b.sets) {
          if (typeof st.weight === 'number' && st.weight > 0) {
            st.weight = Math.round(st.weight * autoreg.topSetPctMultiplier * 10) / 10;
          }
          if (typeof st.rir === 'number') {
            st.rir = Math.max(0, Math.min(5, st.rir + autoreg.rirShift));
          }
        }
        // Помечаем причину в comment
        if (autoreg.decisions.length) {
          const tag = autoreg.deload ? '⭐ Deload' : autoreg.rirShift ? `🧠 RIR+${autoreg.rirShift}` : '🧠 Autoreg';
          if (!b.comment?.includes(tag)) b.comment = b.comment ? `${b.comment} · ${tag}` : tag;
        }
      }
    }
    // Deload неделя: снижаем RIR дополнительно если deload=true
    if (autoreg.deload && !isDeload) {
      w.deload = true;
      if (w.note) w.note += ' · Deload по ACWR/усталости';
      else w.note = 'Deload по ACWR/усталости — объём снижен';
    }
  }
  const newProg: UserProgram = JSON.parse(JSON.stringify(program));
  if (newProg.bb) newProg.bb.weeks = clonedWeeks as UserWeek[];
  else if (newProg.hybrid) (newProg.hybrid as any).bbWeeks = clonedWeeks;
  return newProg;
}

/** Diary-feedback: per-exercise корректировки из истории. */
export function buildManualDiaryFeedback(
  program: UserProgram,
  historyWorkouts: WorkoutLog[],
): DiaryAutoregResult | null {
  const weeks = (program.bb?.weeks ?? (program.hybrid?.bbWeeks as any[]) ?? []);
  if (weeks.length === 0) return null;
  // Собираем план-упражнения из первой недели (для matching)
  const firstWeek = weeks[0] as UserWeek;
  const planned = firstWeek.sessions.flatMap(s => s.blocks.map(b => ({
    name: b.exerciseName,
    plannedWeight: (b.sets[0]?.weight as number) || 0,
    plannedReps: typeof b.sets[0]?.reps === 'number' ? b.sets[0].reps as number : 8,
    plannedSets: b.sets.length,
    plannedRir: (b.sets[0]?.rir as number) ?? 2,
    isMain: b.type === 'compound',
  })));
  return buildDiaryAutoreg({ historyWorkouts, plannedExercises: planned });
}

/** Применить diary feedback к программе (выбранные недели). */
export function applyDiaryFeedbackToProgram(
  program: UserProgram,
  feedback: DiaryAutoregResult,
  fromWeek: number,
  toWeek: number,
): UserProgram {
  const weeks = (program.bb?.weeks ?? (program.hybrid?.bbWeeks as any[]) ?? []);
  if (weeks.length === 0) return program;
  const clonedWeeks = JSON.parse(JSON.stringify(weeks)) as UserWeek[];
  for (const w of clonedWeeks) {
    if (w.week < fromWeek || w.week > toWeek) continue;
    for (const s of w.sessions) {
      for (const b of s.blocks) {
        const adj = feedback.perExercise.get(b.exerciseName);
        if (!adj || adj.source === 'fallback') continue;
        // Корректируем веса
        for (const st of b.sets) {
          if (typeof st.weight === 'number') st.weight = adj.adjustedWeight;
          if (typeof st.rir === 'number') st.rir = adj.adjustedRir;
        }
        // Подходы
        if (adj.adjustedSets !== b.sets.length) {
          if (adj.adjustedSets < b.sets.length) b.sets = b.sets.slice(0, adj.adjustedSets);
          else {
            const tmpl = b.sets[b.sets.length - 1];
            while (b.sets.length < adj.adjustedSets) b.sets.push({ ...tmpl });
          }
        }
        if (adj.note && !b.comment?.includes('Diary')) b.comment = b.comment ? `${b.comment} · 📓 ${adj.note}` : `📓 ${adj.note}`;
      }
    }
  }
  const newProg: UserProgram = JSON.parse(JSON.stringify(program));
  if (newProg.bb) newProg.bb.weeks = clonedWeeks as UserWeek[];
  else if (newProg.hybrid) (newProg.hybrid as any).bbWeeks = clonedWeeks;
  return newProg;
}

/** Gate shouldTrainToday для ручной программы (по readiness/HRV/ACWR). */
export function gateShouldTrainToday(signals: ReadinessSignals, acwr: ACWRResult): ReturnType<typeof shouldTrainToday> {
  const input = buildAutoRegInput(signals, acwr);
  return shouldTrainToday(input);
}

/** Предложение делода по сигналам (ACWR dangerous/caution, monotony>2, fatigue>75, VBT>40). */
export function suggestDeload(
  acwr: ACWRResult,
  monotony: MonotonyResult,
  signals: ReadinessSignals,
  plateauWarnings: string[] = [],
): { shouldDeload: boolean; reason: string; severity: 'info'|'warning'|'error' } {
  const reasons: string[] = [];
  let severity: 'info'|'warning'|'error' = 'info';
  if (acwr.zone === 'dangerous') { reasons.push(`ACWR ${acwr.ratio} dangerous`); severity = 'error'; }
  else if (acwr.zone === 'caution') { reasons.push(`ACWR ${acwr.ratio} caution`); severity = severity === 'error' ? 'error' : 'warning'; }
  if (monotony.monotony > 2) { reasons.push(`Monotony ${monotony.monotony} >2`); severity = severity === 'info' ? 'warning' : severity; }
  if ((signals.fatigue ?? 0) > 75) { reasons.push(`Fatigue ${signals.fatigue}>75`); severity = 'error'; }
  if ((signals.lastVelocityLossPct ?? 0) > 40) { reasons.push(`VLoss ${signals.lastVelocityLossPct}% >40`); severity = 'error'; }
  if (plateauWarnings.length > 0) { reasons.push(`${plateauWarnings.length} плато`); severity = severity === 'info' ? 'warning' : severity; }
  const shouldDeload = reasons.length > 0 && (severity !== 'info' || reasons.length >= 2);
  const reason = shouldDeload ? reasons.join(' · ') : 'Сигналов к делоду нет (ACWR optimal, monotony норма)';
  return { shouldDeload, reason, severity };
}

/** Вставить deload неделю после указанной недели (клонирует предыдущую с volume×0.5/RIR+2). */
export function insertDeloadWeek(program: UserProgram, afterWeek: number): UserProgram {
  const weeks = (program.bb?.weeks ?? (program.hybrid?.bbWeeks as any[]) ?? []);
  const clonedWeeks = JSON.parse(JSON.stringify(weeks)) as UserWeek[];
  const idx = clonedWeeks.findIndex(w => w.week === afterWeek);
  if (idx < 0) return program;
  const src = clonedWeeks[idx];
  const deloadWeek: UserWeek = JSON.parse(JSON.stringify(src));
  deloadWeek.week = afterWeek + 1;
  deloadWeek.phase = 'deload';
  deloadWeek.deload = true;
  deloadWeek.note = 'Deload (авто-рекомендация)';
  for (const s of deloadWeek.sessions) {
    for (const b of s.blocks) {
      const origLen = b.sets.length;
      const newLen = Math.max(1, Math.round(origLen * 0.5));
      b.sets = b.sets.slice(0, newLen);
      while (b.sets.length < newLen) b.sets.push({ ...b.sets[0] });
      for (const st of b.sets) {
        if (typeof st.rir === 'number') st.rir = Math.min(5, st.rir + 2);
        if (typeof st.weight === 'number') st.weight = Math.round(st.weight * 0.6 * 10) / 10;
      }
      b.comment = b.comment ? `${b.comment} · Deload` : 'Deload';
    }
  }
  // Сдвинуть последующие недели
  for (let i = idx + 1; i < clonedWeeks.length; i++) clonedWeeks[i].week += 1;
  clonedWeeks.splice(idx + 1, 0, deloadWeek);
  const newProg: UserProgram = JSON.parse(JSON.stringify(program));
  if (newProg.bb) {
    newProg.bb.weeks = clonedWeeks as UserWeek[];
    newProg.meta.weeks = clonedWeeks.length;
  } else if (newProg.hybrid) {
    (newProg.hybrid as any).bbWeeks = clonedWeeks;
    newProg.meta.weeks = clonedWeeks.length;
  }
  return newProg;
}
