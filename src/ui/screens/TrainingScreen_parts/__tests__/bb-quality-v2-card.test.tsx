import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BbQualityV2Card } from '../BbQualityV2Card';
import { bbPlanQualityV2 } from '../../../../engines/bb/bb-quality-v2.engine';

const PLAN: any = {
  pattern: {},
  weeks: [
    {
      week: 1, sessions: [{
        day: 1, weekOffset: 1, character: 'тяж',
        exercises: [
          { muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', sets: 14, repsRange: [6, 8], rir: 2, workSets: [] },
          { muscle: 'chest', name: 'Разводка гантелей', role: 'accessory', sets: 12, repsRange: [10, 12], rir: 2, workSets: [] },
          { muscle: 'back', name: 'Тяга штанги в наклоне', role: 'primary', sets: 10, repsRange: [6, 8], rir: 2, workSets: [] },
        ],
      }],
    },
  ],
};

describe('BbQualityV2Card', () => {
  it('null — не рендерится', () => {
    const { container } = render(<BbQualityV2Card v2={null} />);
    expect(container.querySelector('[data-bb="quality-v2"]')).toBeNull();
  });
  it('V2-панель: скор, breakdown и только новый сигнал', () => {
    const v2 = bbPlanQualityV2(PLAN, { level: 'intermediate' })!;
    const { container } = render(<BbQualityV2Card v2={v2} />);
    const root = container.querySelector('[data-bb="quality-v2"]');
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('V2-качество');
    expect(root?.textContent).toContain(String(v2.score));
    // session-кап нового сигнала виден…
    expect(root?.textContent).toContain('одной сессии');
    // …а дубли объёма S5 — нет (текст vol_over_ «риск перетренированности»)
    expect(root?.textContent).not.toContain('риск перетренированности');
  });
  it('без дневника — честная плашка ACWR', () => {
    const v2 = bbPlanQualityV2(PLAN, { level: 'intermediate' })!;
    const { container } = render(<BbQualityV2Card v2={v2} />);
    expect(container.querySelector('[data-bb="quality-v2"]')?.textContent).toContain('нет дневника');
  });
});
