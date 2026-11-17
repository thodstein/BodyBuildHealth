/**
 * safety-lab-findings-summary.test.tsx — проход 116: итог по находкам не
 * обещает больше, чем перечисляет. Строка «всего N» считала все находки, а
 * рядом стояли только три тяжести, поэтому мягкие (low/info) попадали в итог,
 * не попадая ни в одну цифру.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { SafetyLabFindings } from '../CalcSafetyLayer';

afterEach(cleanup);

const finding = (severity: string, title: string) => ({
  id: title, severity, system: 'other', systemLabel: 'Прочее', title,
  status: '', substances: [], escalation: '', monitoring: '', conflicts: [],
});

describe('проход 116: итог по находкам честный', () => {
  it('мягкие находки названы «прочими», а не растворяются в итоге', () => {
    const { container } = render(
      <SafetyLabFindings
        planResult={{ labFindings: [finding('high', 'A'), finding('low', 'B'), finding('info', 'C')] } as never}
      />,
    );
    const text = container.textContent || '';
    expect(text).toContain('всего 3');
    expect(text).toContain('2 прочих');
  });

  it('когда мягких нет — слова «прочих» нет', () => {
    const { container } = render(
      <SafetyLabFindings planResult={{ labFindings: [finding('critical', 'A')] } as never} />,
    );
    expect(container.textContent || '').not.toContain('прочих');
  });
});
