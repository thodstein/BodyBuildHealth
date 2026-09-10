/**
 * strength-sport-sm-format-attempts.engine.ts — ПОПЫТКИ ПОД ФОРМАТ ИВЕНТА (SM PRO P6)
 *
 * Реальность контестов (WSM 2024/2025, Arnold 2025): макс (аксель 210 кг, становая
 * 500+ кг, нарастающая штанга, обратный порядок), повторы (жим 60 с AMRAP), медли
 * (йок 454 кг/20 м + рама 330 кг; жимовое; каменные), высота (кега 7.76 м — мировой
 * рекорд). Заявки 85/92/98 — только для макса; медли — темп/подборы без «попыток кг»;
 * высота — шаги высоты; повторы — рабочий вес 85% + цель повторов.
 *
 * Чистый движок, без UI/storage.
 */

import { smAttemptsFor, type SMStrategy } from './strength-sport-strongman-attempts.engine';

export type SMEventFormat = 'max' | 'reps' | 'medley' | 'height';

export const SM_EVENT_FORMAT_LABEL: Record<SMEventFormat, string> = {
  max: 'Макс (1ПМ)',
  reps: 'Повторы (60 с)',
  medley: 'Медли (эстафета)',
  height: 'Высота (бросок)',
};

export interface SMFormatPlan {
  valid: boolean;
  format: SMEventFormat;
  attemptsKg: number[] | null; // только для max
  lines: string[];
}

const round25 = (v: number): number => Math.round(v / 2.5) * 2.5;

export function buildSMFormatPlan(opts: {
  format: SMEventFormat;
  pmKg?: number | null;
  strategy?: SMStrategy;
  heightFromM?: number | null;
}): SMFormatPlan | null {
  const { format } = opts;
  const strategy = opts.strategy || 'balanced';
  const pm = opts.pmKg != null && Number.isFinite(opts.pmKg) && (opts.pmKg as number) > 0 ? (opts.pmKg as number) : null;
  if (format === 'max') {
    if (pm == null) return null;
    const a = smAttemptsFor(pm, strategy, 2.5);
    return {
      valid: true,
      format,
      attemptsKg: [a.opener, a.second, a.third],
      lines: [`Макс: ${a.opener}/${a.second}/${a.third} кг (ПМ ${pm} кг, ${strategy})`],
    };
  }
  if (format === 'reps') {
    if (pm == null) return null;
    const work = round25(pm * 0.85);
    return {
      valid: true,
      format,
      attemptsKg: null,
      lines: [`Повторы: рабочий ${work} кг (85% ПМ) — макс повторов за 60 с, без отказа на 1-м отрезке`],
    };
  }
  if (format === 'medley') {
    return {
      valid: true,
      format,
      attemptsKg: null,
      lines: ['Медли: килограммовых попыток нет — темп 90% ПМ на отрезок, подбор за 5 с, разворот без остановки'],
    };
  }
  const from = opts.heightFromM != null && Number.isFinite(opts.heightFromM) && (opts.heightFromM as number) > 0
    ? (opts.heightFromM as number)
    : 3.5;
  const steps: number[] = [];
  for (let h = from; h <= from + 3.0 + 1e-9; h = Math.round((h + 0.5) * 10) / 10) steps.push(h);
  return {
    valid: true,
    format,
    attemptsKg: null,
    lines: [`Высота: шаги ${steps.map((s) => `${s} м`).join(' → ')} (старт ${from} м, +0.5 м)`],
  };
}
