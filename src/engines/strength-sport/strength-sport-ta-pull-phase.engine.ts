/**
 * strength-sport-ta-pull-phase.engine.ts — ПОФАЗНАЯ ТЯГА (W9 PRO-v3)
 *
 * Sports Biomech 2025 (max isometric force по подфазам тяги):
 * - первая тяга ≈ изометрия (близка к ISPP/IMTP на force-velocity спектре);
 * - вторая тяга — скоростная (1.7–2 м/с, далека от IMTP);
 * - просадка скорости с нагрузкой чаще в первой тяге, у части — в transition/second.
 * Профиль: какой конец тяги проседает первым — по уже имеющимся сигналам хаба
 * (ISPP/IMTP = изометрия первой тяги; VBT-loss/RFD = скорость второй).
 * Оба конца слабы → страдает передача (transition). Чистый движок.
 */

import type { WLWeakPoint } from './strength-sport-weakpoint';

export type PullSubPhase = 'first' | 'transition' | 'second' | 'unknown';

export interface PullPhaseInput {
  lift?: 'snatch' | 'clean';
  /** ISPP/IMTP <0.85 — изометрия первой тяги слаба. */
  isppRatio?: number | null;
  imtpStrengthDeficit?: boolean | null;
  /** VBT-просадка ≥10% — скорость второй тяги слаба. */
  vbtLossPct?: number | null;
  imtpExplosiveDeficit?: boolean | null;
}

export interface PullPhaseResult {
  weakestSubPhase: PullSubPhase;
  confidence: 'high' | 'med' | 'low';
  /** Weak-фаза хаба для разбора (по движению). */
  linkWeak: WLWeakPoint | null;
  text: string;
}

export function diagnosePullPhaseProfile(input: PullPhaseInput): PullPhaseResult {
  const lift = input.lift === 'clean' ? 'clean' : 'snatch';
  const firstWeak =
    (input.isppRatio != null && input.isppRatio < 0.85) || input.imtpStrengthDeficit === true;
  const secondWeak =
    (input.vbtLossPct != null && input.vbtLossPct >= 10) || input.imtpExplosiveDeficit === true;
  const linkWeak: Record<PullSubPhase, WLWeakPoint | null> = {
    first: (lift === 'clean' ? 'clean_off_floor' : 'snatch_off_floor') as WLWeakPoint,
    transition: (lift === 'clean' ? 'clean_mid' : 'snatch_mid') as WLWeakPoint,
    second: (lift === 'clean' ? 'clean_mid' : 'snatch_mid') as WLWeakPoint,
    unknown: null,
  };
  if (firstWeak && secondWeak) {
    return {
      weakestSubPhase: 'transition',
      confidence: 'med',
      linkWeak: linkWeak.transition,
      text: 'Слабы оба конца тяги — передача (transition) страдает первой: приоритет тяги с паузой у колена.',
    };
  }
  if (firstWeak) {
    return {
      weakestSubPhase: 'first',
      confidence: 'high',
      linkWeak: linkWeak.first,
      text: 'Первая тяга — изометрия (ISPP/IMTP): приоритет сила отрыва, ISPP к ≥85% IMTP.',
    };
  }
  if (secondWeak) {
    return {
      weakestSubPhase: 'second',
      confidence: 'high',
      linkWeak: linkWeak.second,
      text: 'Вторая тяга — скорость (1.7–2 м/с): приоритет взрыв (вис/прыжки), IMTP тут не показатель.',
    };
  }
  return {
    weakestSubPhase: 'unknown',
    confidence: 'low',
    linkWeak: null,
    text: 'Сигналов просадки подфаз нет — тяга сбалансирована.',
  };
}
