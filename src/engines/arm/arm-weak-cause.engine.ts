/**
 * arm-weak-cause.engine.ts — диагностика ПРИЧИНЫ отставания мёртвой точки (E2 P0).
 * Parity: bb `diagnoseWeakCause` (volume/activation/recovery/technique/genetics),
 * арм-специфика: mobility через E10-тест фазы, strength через side/back vs bw-ref,
 * fatigue через tendon-ACWR + VBT пороги точки.
 * Чистые функции, без мутаций.
 */
import type { ArmWeakPoint } from './arm-biomechanics.engine';

export type ArmWeakCause = 'volume' | 'technique' | 'mobility' | 'fatigue' | 'strength';

export interface ArmWeakCauseInput {
  point: ArmWeakPoint;
  factSets7d?: number | null;
  hist28?: number[];
  e1rmDeltaPct?: number | null;
  e1rmSessions?: number;
  acwrZone?: string | null;
  tendonAcwrZone?: string | null;
  mobilityFail?: boolean;
  vbtLossPct?: number | null;
  vbtWarnPct?: number | null;
  benchLevel?: string | null;
  sleepHours?: number | null;
  sideBackRefRatio?: number | null; // факт side/back vs bw-ref 0..1+ (null = нет данных)
}

export interface ArmWeakCauseResult {
  cause: ArmWeakCause;
  confidence: number;
  evidence: string[];
  fix: string;
}

const CLAMP01 = (v: number): number => Math.max(0, Math.min(1, Math.round(v * 100) / 100));

const FIX_TEXT: Record<ArmWeakCause, string> = {
  volume: 'Добрать объём точки до MAV: +1 сессия/нед, топ-1 коррекция 3×8-12 @60-70%',
  technique: 'Техника первой: угол в диапазон точки, РН-направление, статика 10с + динамика 6-10',
  mobility: 'Мобильность: ROM-тест провален — high-rep 12-20, RIR≥2, ретест через 2 нед',
  fatigue: 'Усталость: снизить tendon-нагрузку, Side→изометрия, Pron heavy→pulses, +1 день отдыха',
  strength: 'Сила: тяжёлые 5×5 @70% + high-torque ремень, прогрессия ≤10%/нед',
};

export function diagnoseArmWeakCause(input: ArmWeakCauseInput): ArmWeakCauseResult {
  const ev: string[] = [];
  const scores: Record<ArmWeakCause, number> = { volume: 0, technique: 0, mobility: 0, fatigue: 0, strength: 0 };
  const hist = Array.isArray(input.hist28) ? input.hist28.filter((n) => Number.isFinite(n)) : [];
  const last = input.factSets7d != null && Number.isFinite(input.factSets7d) ? Number(input.factSets7d) : hist.length ? hist[hist.length - 1] : null;

  // VOLUME: факт 0-2 при норме 3+ или падающая история
  if (last != null && last <= 0) {
    scores.volume += 0.6;
    ev.push('Точка не покрыта планом (0 сетов)');
  } else if (last != null && last < 3) {
    scores.volume += 0.4;
    ev.push(`Покрытие ${last} < 3 сетов`);
  }
  if (hist.length >= 3 && hist.slice(-3).every((v) => v < 3)) {
    scores.volume += 0.2;
    ev.push('3 нед подряд <3 сетов');
  }

  // FATIGUE: ACWR danger/caution (общий или tendon), сон, VBT сверх warn-точки
  if (input.acwrZone === 'danger' || input.acwrZone === 'dangerous') {
    scores.fatigue += 0.55;
    ev.push('ACWR danger — перегруз');
  } else if (input.acwrZone === 'caution') {
    scores.fatigue += 0.3;
    ev.push('ACWR caution');
  }
  if (input.tendonAcwrZone === 'danger' || input.tendonAcwrZone === 'dangerous') {
    scores.fatigue += 0.35;
    ev.push('Tendon ACWR danger');
  } else if (input.tendonAcwrZone === 'caution') {
    scores.fatigue += 0.2;
    ev.push('Tendon ACWR caution');
  }
  if (input.sleepHours != null && input.sleepHours < 6.5) {
    scores.fatigue += 0.25;
    ev.push(`Сон ${input.sleepHours}ч < 6.5`);
  }
  const warn = input.vbtWarnPct ?? 15;
  if (input.vbtLossPct != null && input.vbtLossPct >= warn + 10) {
    scores.fatigue += 0.3;
    ev.push(`VBT ${input.vbtLossPct}% ≥ stop (~${warn + 10}%)`);
  } else if (input.vbtLossPct != null && input.vbtLossPct >= warn) {
    scores.fatigue += 0.15;
    ev.push(`VBT ${input.vbtLossPct}% ≥ warn ${warn}%`);
  }

  // MOBILITY: явный провал ROM-теста фазы
  if (input.mobilityFail) {
    scores.mobility += 0.65;
    ev.push('ROM-тест фазы провален');
  }

  // TECHNIQUE: e1RM стоит при объёме (классика PL/BB activation→technique)
  if (input.e1rmDeltaPct != null && (input.e1rmSessions || 0) >= 2 && input.e1rmDeltaPct <= 1 && (last || 0) >= 3) {
    scores.technique += 0.45;
    ev.push(`e1RM ${input.e1rmDeltaPct}% при объёме — техника/угол`);
  }

  // STRENGTH: бенч beginner/intermediate + низкий side/back vs ref
  if (input.sideBackRefRatio != null && input.sideBackRefRatio < 0.6) {
    scores.strength += 0.4;
    ev.push(`Side/Back ${Math.round(input.sideBackRefRatio * 100)}% ref <60%`);
  }
  if (input.benchLevel && ['beginner', 'intermediate'].includes(input.benchLevel) && (last || 0) >= 3) {
    scores.strength += 0.2;
    ev.push(`Бенч ${input.benchLevel} при объёме — нужна база силы`);
  }

  let cause: ArmWeakCause = 'volume';
  let best = -1;
  for (const k of Object.keys(scores) as ArmWeakCause[]) {
    if (scores[k] > best) {
      best = scores[k];
      cause = k;
    }
  }
  const confidence = CLAMP01(best > 0 ? Math.min(0.9, 0.35 + best) : 0.35);
  if (ev.length === 0) ev.push('Данных мало — старт с объёма и техники');
  return { cause, confidence, evidence: ev.slice(0, 4), fix: FIX_TEXT[cause] };
}
