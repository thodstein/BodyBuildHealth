/**
 * lab-trend-visuals.ts — как нарисовать точку тренда, если число обрезано.
 *
 * Проход 146: знак границы доехал до строки тренда, подписи графика и CSV, но
 * сама линия рисовала все точки одинаково — «>1000» выглядел точкой измерения
 * 1000. На графике обрезанная точка теперь кольцо с пунктиром, а спарклайн,
 * в истории которого есть граница, рисуется пунктирной линией: линия условная,
 * значения — со знаком.
 */
import type { LabBound } from '../../../core/lab-bound';

/** Атрибуты точки тренда: обычная — заливка, обрезанная — пунктирное кольцо. */
export function trendPointStyle(bound: LabBound | undefined, color: string) {
  return bound
    ? {
        fill: 'none',
        stroke: color,
        strokeWidth: 2,
        strokeDasharray: '2 2',
        'data-lab-bound': 'yes' as const,
      }
    : {
        fill: color,
        stroke: 'rgba(0,0,0,0.4)',
        strokeWidth: 1,
        strokeDasharray: undefined,
        'data-lab-bound': undefined,
      };
}

/** Пунктир для спарклайна, если в истории есть хотя бы одно обрезанное значение. */
export function trendSparklineDash(bounds: Array<LabBound | undefined>): string | undefined {
  return bounds.some(b => b) ? '3 3' : undefined;
}
