/**
 * LabCompareLabel.tsx — «было → стало» в предпросмотре импорта анализов.
 *
 * Проход 144: подпись считала разность и процент прямо из чисел. «Ферритин:
 * >800 → >1000» превращалось в «↑ >800 → >1000 (+25%)»: обрезанные числа
 * выдавались за измерение, а процент — за доказанное изменение. Теперь правило
 * одно (`core/lab-bound`): у двух точных чисел есть стрелка и процент, у любой
 * границы — только сами записи со знаком, без вывода.
 */
import React from 'react';
import { labValueLabel } from '../../../core/lab-value-label';
import { labDelta, type LabBound } from '../../../core/lab-bound';

export interface LabCompareValue {
  value: number;
  bound?: LabBound;
}

export function LabCompareLabel({ existing, next }: { existing: LabCompareValue; next: LabCompareValue }) {
  const { arrow, pct } = labDelta(existing, next);
  const color = arrow === '↑' ? '#ef4444' : arrow === '↓' ? '#22c55e' : '#fff';
  return (
    <span
      data-lab-compare={arrow || 'unknown'}
      style={{ fontSize: 11, color, fontWeight: 700, marginLeft: 6, whiteSpace: 'nowrap' }}
    >
      {arrow ? `${arrow} ` : ''}
      {labValueLabel(existing.value, existing.bound)} → {labValueLabel(next.value, next.bound)}
      {pct !== null ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}
    </span>
  );
}
