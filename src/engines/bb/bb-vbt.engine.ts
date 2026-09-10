/**
 * bb-vbt.engine.ts — P1: VBT-интеграция в ББ (обёртка над pro/vbt.engine.diagnoseVelocity).
 *
 * Скорость штанги (м/с) — объективный сигнал готовности/отказа, дополняющий RIR.
 * Здесь — ББ-фасад: ввод лучшего/последнего повтора (или потеря скорости %) →
 * рекомендация по нагрузке/RIR для следующей сессии. Не мутирует план — рекомендация.
 *
 * Капы не меняются.
 */

import { diagnoseVelocity, velocityLossZone } from '../pro/vbt.engine';

export interface BBVbtRecommendation {
  lossPct: number;
  zone: string;
  exceeded: boolean;
  recommendation: string;
  suggestedRirShift: number;
  /** e1RM по скорости последнего повтора (канон pro/vbt, популяционный LVP) — null без веса. */
  e1RMByVelocity: number | null;
}

export interface BBVbtGoalOpts {
  /** Цель меняет акцент совета (наука: ≤20–25% — сила/скорость, 20–40% — гипертрофия ценой RFD). */
  goal?: 'mass' | 'strength';
}

/**
 * Рекомендация по нагрузке из VBT-скорости.
 * - потеря <10%: скорость стабильна → можно добавить повторов (RIR ниже на 0.5);
 * - 10-20%: зона силы → стандарт;
 * - 20-25%: гипертрофия → держать объём;
 * - 25-40%: метаболический стресс → снизить вес (RIR+1);
 * - >40%: отказ близко → стоп/снизить (RIR+2).
 */
export function bbVbtRecommendation(lift: string, bestVelocity: number, lastVelocity: number, weightKg?: number, opts?: BBVbtGoalOpts): BBVbtRecommendation {
  const d = diagnoseVelocity(lift as never, bestVelocity, lastVelocity, weightKg);
  const loss = d.lossPct;
  let rirShift = 0;
  let rec: string;
  if (loss < 10) {
    rirShift = -0.5;
    rec = `Скорость стабильна (потеря ${loss.toFixed(0)}%) — нагрузку можно добавить (повторы/вес), RIR−0.5.`;
  } else if (loss < 20) {
    rec = `Зона силы (${loss.toFixed(0)}%) — ЦНС готова, придерживайтесь плана.`;
  } else if (loss < 25) {
    rec = `Зона гипертрофии (${loss.toFixed(0)}%) — метаболический стресс, держите объём.`;
  } else if (loss < 40) {
    rirShift = 1;
    rec = `Потеря ${loss.toFixed(0)}% — метаболический стресс высок, снизьте вес на 5%, RIR+1.`;
  } else {
    rirShift = 2;
    rec = `Потеря ${loss.toFixed(0)}% — отказ близко (${d.zone}), остановитесь/снизьте вес, RIR+2.`;
  }
  if (d.exceeded && d.suggestedPhase) rec += ` Вероятная фаза срыва: «${d.suggestedPhase}».`;
  if (d.e1RMByVelocity) rec += ` e1RM по скорости ≈ ${d.e1RMByVelocity} кг (популяционный LVP).`;
  // PRO-3 R5: акцент под цель (базовые зоны не меняются — только строка)
  const goal = opts?.goal;
  if (goal === 'strength' && loss >= 20) {
    rec += ' Для силы держите потерю ≤20–25% — дальше только усталость без прибавки.';
  } else if (goal === 'mass' && loss >= 10 && loss < 20) {
    rec += ' Для массы можно допустить потерю 20–30% в последних сетах.';
  }
  return { lossPct: loss, zone: d.zone, exceeded: d.exceeded, recommendation: rec, suggestedRirShift: rirShift, e1RMByVelocity: d.e1RMByVelocity };
}

/** Зона VBT для бейджа. */
export function bbVbtZoneLabel(lossPct: number): { label: string; color: string } {
  if (lossPct < 10) return { label: '🟢 стабильна', color: '#00e68a' };
  if (lossPct < 20) return { label: '🔵 сила', color: '#38bdf8' };
  if (lossPct < 25) return { label: '🟣 гипертрофия', color: '#a78bfa' };
  if (lossPct < 40) return { label: '🟡 метабол. стресс', color: '#fbbf24' };
  return { label: '🔴 отказ близко', color: '#f87171' };
}

export { velocityLossZone };
