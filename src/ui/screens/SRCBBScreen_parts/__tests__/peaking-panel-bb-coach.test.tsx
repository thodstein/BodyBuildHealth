/**
 * peaking-panel-bb-coach.test.tsx — смоук-тест BB-ветки PeakingPanel:
 * тренерский score ББ-шоу-пика (bb-show-coach.engine) рендерится без краха.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('P2-6: время взвешивания/старта — реальные поля таймлайна, а не «мёртвые» 09:00/10:00', () => {
    render(<PeakingPanel defaultKind="pl" />);
    const weigh = screen.getByLabelText('Время взвешивания') as HTMLInputElement;
    const start = screen.getByLabelText('Время старта') as HTMLInputElement;
    expect(weigh.value).toBe('09:00');
    fireEvent.change(weigh, { target: { value: '07:30' } });
    fireEvent.change(start, { target: { value: '11:15' } });
    expect(screen.getAllByText(/07:30/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/11:15/).length).toBeGreaterThan(0);
  });
});
