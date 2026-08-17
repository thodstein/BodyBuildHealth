/**
 * injury-select-card.test.tsx — UI-тесты выбора режима травм в BB-авто.
 *
 * Жалоба: «щадящий режим не выбирается — мышца нажимается один раз и
 * исключается». Фикс: чипы «⛔ Исключить» / «⚡ Щадящая» в шапке модалки
 * стали кликабельными — задают режим для НОВЫХ травм.
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InjurySelectCard, gradedDefaults, type InjurySelectEntry } from '../InjurySelectCard';

function Harness({ initial }: { initial?: InjurySelectEntry[] }) {
  const [injuries, setInjuries] = React.useState<InjurySelectEntry[]>(initial || []);
  return (
    <div>
      <InjurySelectCard injuries={injuries} onChange={setInjuries} />
      <div data-testid="state">{JSON.stringify(injuries)}</div>
    </div>
  );
}

describe('InjurySelectCard — режимы травм', () => {
  it('gradedDefaults: exclude=false + градация 0.6/0.6/15', () => {
    expect(gradedDefaults()).toEqual({ exclude: false, weightPct: 0.6, volumePct: 0.6, repsCap: 15 });
  });

  it('по умолчанию новые травмы добавляются в режиме исключения (exclude=true)', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('🤕 Травмы / ограничения'));
    fireEvent.click(screen.getByText('Колено'));
    const state = JSON.parse(screen.getByTestId('state').textContent || '[]');
    expect(state).toHaveLength(1);
    expect(state[0].muscle).toBe('legs');
    expect(state[0].exclude).toBe(true);
  });

  it('клик по «⚡ Щадящая» → новая травма добавляется с exclude=false и градацией', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('🤕 Травмы / ограничения'));
    fireEvent.click(screen.getByText(/⚡ Щадящая/));
    fireEvent.click(screen.getByText('Колено'));
    const state = JSON.parse(screen.getByTestId('state').textContent || '[]');
    expect(state).toHaveLength(1);
    expect(state[0].muscle).toBe('legs');
    expect(state[0].exclude).toBe(false);
    expect(state[0].weightPct).toBe(0.6);
    expect(state[0].volumePct).toBe(0.6);
    expect(state[0].repsCap).toBe(15);
  });

  it('режим можно переключить обратно на «⛔ Исключить»', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('🤕 Травмы / ограничения'));
    fireEvent.click(screen.getByText(/⚡ Щадящая/));
    fireEvent.click(screen.getByText(/⛔ Исключить/));
    fireEvent.click(screen.getByText('Колено'));
    const state = JSON.parse(screen.getByTestId('state').textContent || '[]');
    expect(state[0].exclude).toBe(true);
  });

  it('тумблер в списке переключает существующую травму исключение → щадящая', () => {
    render(<Harness initial={[{ muscle: 'shoulders', from: '2026-08-17', exclude: true }]} />);
    fireEvent.click(screen.getByText('🤕 Травмы / ограничения'));
    // В шапке чип «⛔ Исключить» + тумблер в списке — берём тумблер (последний).
    const toggles = screen.getAllByText('⛔ Исключить');
    fireEvent.click(toggles[toggles.length - 1]);
    const state = JSON.parse(screen.getByTestId('state').textContent || '[]');
    expect(state[0].exclude).toBe(false);
    expect(state[0].weightPct).toBe(0.6);
    expect(state[0].repsCap).toBe(15);
  });

  it('тумблер в списке переключает щадящая → исключение (градация сбрасывается)', () => {
    render(<Harness initial={[{ muscle: 'shoulders', from: '2026-08-17', exclude: false, weightPct: 0.5, volumePct: 0.5, repsCap: 12 }]} />);
    fireEvent.click(screen.getByText('🤕 Травмы / ограничения'));
    const toggles = screen.getAllByText('⚡ Щадящая');
    fireEvent.click(toggles[toggles.length - 1]);
    const state = JSON.parse(screen.getByTestId('state').textContent || '[]');
    expect(state[0].exclude).toBe(true);
    expect(state[0].weightPct).toBeUndefined();
    expect(state[0].repsCap).toBeUndefined();
  });
});
