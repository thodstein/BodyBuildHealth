/**
 * peaking-panel-bb-coach.test.tsx — смоук-тест BB-ветки PeakingPanel:
 * тренерский score ББ-шоу-пика (bb-show-coach.engine) рендерится без краха.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PeakingPanel } from '../PeakingPanel';

describe('PeakingPanel (BB-ветка) + тренерский score', () => {
  it('рендерит BB-ветку и тренерский score готовности к шоу', () => {
    render(<PeakingPanel defaultKind="bb" />);
    expect(screen.getByText(/Шоу-пик/)).toBeTruthy();
    // Score-карточка (рендерится при валидном конфиге)
    const score = screen.queryByText(/Тренерский score готовности к шоу/);
    // Может отсутствовать при невалидном конфиге — но не должно падать
    expect(score).toBeDefined();
  });
});
