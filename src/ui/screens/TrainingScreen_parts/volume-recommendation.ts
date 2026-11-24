/**
 * volume-recommendation.ts — одна подпись «что делать с объёмом» по мышце.
 *
 * Раньше каждый экран заново сравнивал effectiveSets с mev/mav/mrv, и на границах
 * статус («оптимум») расходился с текстом («Ниже оптимума: +0.0 effective…»).
 * Здесь единственный источник подписи: ветка выбирается по `m.status` (канон —
 * `checkVolumeStatus` в volume-landmarks.engine.ts), а число — только размер разрыва
 * до границы. Для optimal при effectiveSets < mav разрыв строго > 0, на самой MAV
 * работает первая ветка, для остальных статусов разрыв > 0 по определению статуса.
 */
import type { BBMuscleVolume } from '../../../engines/bb/bb-metrics.engine';
import { CANONICAL_STATUS_COLOR } from '../../../engines/volume-canonical.engine';

/** Подпись и цвет статуса объёма — один источник для всех таблиц объёма.
 *  Цвет берётся из канона `CANONICAL_STATUS_COLOR`: локальные карты красили
 *  «недотрен» синим (#60a5fa), но в каноне синий — это maintenance, поэтому
 *  один и тот же статус на «Бюджете объёма», в «Качестве» и в оптимизаторе
 *  читался как разные состояния. */
export const VOLUME_STATUS_META: Record<BBMuscleVolume['status'], { label: string; color: string }> = {
  below_mev: { label: 'недотрен', color: CANONICAL_STATUS_COLOR.below_mev },
  optimal: { label: 'оптимум', color: CANONICAL_STATUS_COLOR.optimal },
  approaching_mrv: { label: 'около MRV', color: CANONICAL_STATUS_COLOR.approaching_mrv },
  exceeding_mrv: { label: 'перегруз', color: CANONICAL_STATUS_COLOR.exceeding_mrv },
};

export function volumeRecommendation(m: BBMuscleVolume, unit: 'effective' | 'эфф' = 'эфф'): string {
  // Число нормализуем до 0.1: у вручную собранных метрик бывает float-хвост
  // (6.9999999) или NaN, и toFixed(1) печатал «+0.0» / «−NaN» при статусе «оптимум».
  const eff = Number.isFinite(m.effectiveSets) ? Math.round(m.effectiveSets * 10) / 10 : 0;
  const gap = (boundary: number): string => Math.abs(boundary - eff).toFixed(1);
  switch (m.status) {
    case 'below_mev':
      return `Недотрен: +${gap(m.mev)} ${unit} до MEV ${m.mev}`;
    case 'exceeding_mrv':
      return `Перегруз: −${gap(m.mrv)} ${unit} — выше MRV ${m.mrv}`;
    case 'approaching_mrv':
      return `Выше оптимума: ${m.mav}–${m.mrv}, можно держать или −${gap(m.mav)} ${unit} до MAV`;
    case 'optimal':
      if (eff >= m.mav) return `Оптимум — в точке MAV ${m.mav}`;
      return `В оптимуме: до MAV ещё +${gap(m.mav)} ${unit}`;
  }
}
