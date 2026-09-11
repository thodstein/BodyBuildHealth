import { describe, expect, it } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { QualityActions } from '../QualityActions';
import { composeQualityScoreV2 } from '../../../../engines/quality-score-v2.engine';

const BASE = {
  score: 78,
  grade: '🟡 Хорошо',
  perMuscle: [
    { muscle: 'chest', peakSets: 12, avgSets: 10, mev: 8, mav: 14, mrv: 20, status: 'ok' },
    { muscle: 'back', peakSets: 30, avgSets: 28, mev: 10, mav: 16, mrv: 24, status: 'over' },
  ],
};

const V2 = composeQualityScoreV2({
  level: 'intermediate',
  weeklySets: { chest: 12, back: 30 },
  frequency: { chest: 2, back: 2 },
  mev: { chest: 8, back: 10 },
  mav: { chest: 14, back: 16 },
  mrv: { chest: 20, back: 24 },
  deload: { hasDeload: true, totalWeeks: 8, deloadWeeks: [] },
});

const PROPS = {
  programId: 'p1',
  title: 'Тест-программа',
  division: 'bb' as const,
  level: 'intermediate',
  pedLabel: 'Натурал',
  base: BASE,
  overloadFix: { back: 16 },
  weakGroups: [] as string[],
  needsDeload: false,
};

describe('QualityActions — P6 smoke', () => {
  it('рендер с V2: скор, breakdown, фиксы, история, экспорт', () => {
    const { container } = render(<QualityActions {...PROPS} v2={V2} />);
    expect(container.querySelector('[data-q="quality-actions"]')).not.toBeNull();
    expect(container.querySelector('[data-q="v2-score"]')?.textContent).toContain(String(V2.score));
    expect(container.querySelector('[data-q="v2-issues"]')).not.toBeNull();
    expect(container.querySelector('[data-q="fix-volume"]')).not.toBeNull();
    expect(container.querySelector('[data-q="fix-deload"]')).not.toBeNull();
    expect(container.querySelector('[data-q="fix-weakpoints"]')).not.toBeNull();
    expect(container.querySelector('[data-q="q-history"]')).not.toBeNull();
    expect(container.querySelector('[data-q="export-csv"]')).not.toBeNull();
    expect(container.querySelector('[data-q="export-html"]')).not.toBeNull();
    expect(container.querySelector('[data-q="export-print"]')).not.toBeNull();
  });

  it('без V2 — честное «нет данных»', () => {
    const { container } = render(<QualityActions {...PROPS} v2={null} />);
    expect(container.querySelector('[data-q="v2-score"]')?.textContent).toContain('нет данных');
  });

  it('кнопки без целей — disabled', () => {
    const { container } = render(
      <QualityActions {...PROPS} v2={V2} overloadFix={{}} weakGroups={[]} needsDeload={false} />,
    );
    expect((container.querySelector('[data-q="fix-volume"]') as HTMLButtonElement)?.disabled).toBe(true);
    expect((container.querySelector('[data-q="fix-deload"]') as HTMLButtonElement)?.disabled).toBe(true);
    expect((container.querySelector('[data-q="fix-weakpoints"]') as HTMLButtonElement)?.disabled).toBe(true);
  });

  it('сохранение снапшота показывает статус и строку истории', () => {
    const { container } = render(<QualityActions {...PROPS} v2={V2} />);
    fireEvent.click(container.querySelector('[data-q="q-save"]')!);
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain('Снапшот сохранён');
    expect(container.querySelector('[data-q="q-history"]')?.textContent).toContain('Тест-программа');
  });

  it('фикс объёма пишет мост и флеш', () => {
    const { container } = render(<QualityActions {...PROPS} v2={V2} />);
    fireEvent.click(container.querySelector('[data-q="fix-volume"]')!);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('планировщик');
  });

  it('сводка S3+S4+V2 и split-кнопка', () => {
    const { container } = render(
      <QualityActions
        {...PROPS} v2={V2} proDelta={-4}
        splitCandidates={[{ muscle: 'chest', weeklySets: 18, frequency: 1 }]}
      />,
    );
    expect(container.querySelector('[data-q="combined"]')?.textContent).toContain('База 78');
    expect(container.querySelector('[data-q="combined"]')?.textContent).toContain('V2');
    const split = container.querySelector('[data-q="fix-split"]') as HTMLButtonElement;
    expect(split?.disabled).toBe(false);
    fireEvent.click(split!);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('План разбиения скопирован');
  });

  it('split без кандидатов — disabled', () => {
    const { container } = render(<QualityActions {...PROPS} v2={V2} splitCandidates={[]} />);
    expect((container.querySelector('[data-q="fix-split"]') as HTMLButtonElement)?.disabled).toBe(true);
  });
});
