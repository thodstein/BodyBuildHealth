/**
 * lab-delta-bound-view.test.tsx — проход 156: карточка динамики калькулятора.
 *
 * Строка с границей бланка («>1000 → 2000») больше не получает зелёную галочку:
 * записи не доказывают ни сторону, ни величину. Такой тренд называется «?»,
 * попадает в строку «Без вывода (в бланке граница)» и не выдаётся за успех.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { LabDeltaView } from '../screens/Calculator/Calc.result';
import type { LabDelta } from '../../engines/support-plan';

afterEach(() => cleanup());

const deltas: LabDelta[] = [
  { marker: 'Ferritin', trend: 'unproven', sliceValues: ['>1000', '2000'], unit: 'ng/mL' },
  { marker: 'ALT', trend: 'improving', sliceValues: ['>100', '40'] },
  { marker: 'CRP', trend: 'worsening', sliceValues: ['<0.5', '3'] },
];

describe('проход 156: «без вывода» не выглядит как «в норме»', () => {
  it('недоказанная динамика помечена «?» и не печатает галочку', () => {
    const { container } = render(<LabDeltaView deltas={deltas} />);
    const open = container.querySelector('[data-lab-delta-trend="unproven"]')!;
    expect(open.textContent).toContain('>1000→2000');
    expect(open.textContent).toContain('?');
    expect(open.textContent).not.toContain('✓');
    expect(open.getAttribute('title')).toContain('ни сторона, ни величина не доказаны');
  });

  it('строка «Без вывода» называет маркер и причину', () => {
    const { container } = render(<LabDeltaView deltas={deltas} />);
    expect(container.textContent).toContain('Без вывода (в бланке граница): Ferritin');
  });

  it('доказанные строки остаются в своих категориях', () => {
    const { container } = render(<LabDeltaView deltas={deltas} />);
    expect(container.textContent).toContain('⚠ Ухудшение: CRP');
    expect(container.querySelector('[data-lab-delta-trend="improving"]')!.textContent).toContain('✓');
  });
});
