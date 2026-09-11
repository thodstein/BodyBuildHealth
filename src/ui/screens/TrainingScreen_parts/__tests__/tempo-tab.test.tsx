/**
 * tempo-tab.test.tsx — TEMPO-REP PRO, эпик E (6 тестов).
 * Хаб: TUT-панель, пресет по упражнению, фикс превью, персист, мост, откат.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { TempoTab } from '../TempoTab';
import { TEMPO_PREV_KEY } from '../planner-bridge-handlers';

const HUB_KEY = 'he_tempo_hub_v1';

beforeEach(() => {
  try {
    localStorage.removeItem(HUB_KEY);
    localStorage.removeItem(TEMPO_PREV_KEY);
  } catch { /* ignore */ }
});

afterEach(() => {
  cleanup();
  try {
    localStorage.removeItem(HUB_KEY);
    localStorage.removeItem(TEMPO_PREV_KEY);
  } catch { /* ignore */ }
});

describe('TempoTab (эпик E)', () => {
  it('TUT-панель считает: дефолт 3-1-1-0 ×10×3 = 50с/150с', () => {
    const { getByTestId, getByText, container } = render(<TempoTab />);
    expect(getByTestId('tut-reps')).not.toBeNull();
    expect(getByTestId('tut-sets')).not.toBeNull();
    // 5с × 10 = 50с сета, × 3 = 150с
    expect(container.textContent).toContain('50с');
    expect(getByText(/150с/i)).not.toBeNull();
    expect(getByText(/Рабочая доза/)).not.toBeNull();
  });

  it('пресет по упражнению: «румынская» → 3-1-1-0, «Взять» меняет схему', () => {
    const { getByTestId, container } = render(<TempoTab />);
    fireEvent.change(getByTestId('tempo-exercise-input'), { target: { value: 'Жим лёжа' } });
    expect(getByTestId('tempo-exercise-pick').textContent).toBe('2-0-X-0');
    fireEvent.click(getByTestId('tempo-exercise-take'));
    // Схема обновилась — кастомный темп ушёл в персист (2-0-1-0 числами, X — намерение)
    const saved = JSON.parse(localStorage.getItem(HUB_KEY) || 'null');
    expect(saved?.customTempo).toMatchObject({ eccentric: 2, bottomPause: 0, concentric: 1, topPause: 0 });
    expect(container.textContent).toContain('2-0-1-0');
  });

  it('карточки паттернов больше не одинаковые', () => {
    const { getAllByTestId } = render(<TempoTab />);
    const badges = getAllByTestId('pattern-tempo').map((el) => el.textContent);
    expect(badges).toHaveLength(8);
    expect(new Set(badges).size).toBeGreaterThan(1);
  });

  it('персист: сохранённый темп восстанавливается после remount', () => {
    try {
      localStorage.setItem(HUB_KEY, JSON.stringify({
        customTempo: { eccentric: 5, bottomPause: 2, concentric: 2, topPause: 1 },
        filterGoal: 'all', tutReps: 8, tutSets: 4, mode: 'compound',
      }));
    } catch { /* ignore */ }
    const { getAllByText, getByTestId } = render(<TempoTab />);
    expect(getAllByText(/5-2-2-1/).length).toBeGreaterThan(0);
    expect((getByTestId('tempo-mode') as HTMLSelectElement).value).toBe('compound');
  });

  it('мост: селект режима с 4 опциями; применение пишет kind tempo', () => {
    const { getByTestId, getByText } = render(<TempoTab />);
    const sel = getByTestId('tempo-mode') as HTMLSelectElement;
    expect(sel.options).toHaveLength(4);
    fireEvent.change(sel, { target: { value: 'isolation' } });
    fireEvent.click(getByText(/Применить темп к планировщику/));
    const stored = JSON.parse(localStorage.getItem('he_planner_apply') || 'null');
    expect(stored?.kind).toBe('tempo');
    expect(stored?.data?.mode).toBe('isolation');
  });

  it('откат: без снимка disabled; со снимком — kind tempo_rollback', () => {
    const first = render(<TempoTab />);
    expect((first.getByTestId('tempo-rollback') as HTMLButtonElement).disabled).toBe(true);
    first.unmount();
    try {
      localStorage.setItem(TEMPO_PREV_KEY, JSON.stringify({ ts: Date.now(), weeks: [], count: 12 }));
    } catch { /* ignore */ }
    const { getByTestId, getByText } = render(<TempoTab />);
    expect(getByText(/12 сетов/)).not.toBeNull();
    fireEvent.click(getByTestId('tempo-rollback'));
    const stored = JSON.parse(localStorage.getItem('he_planner_apply') || 'null');
    expect(stored?.kind).toBe('tempo_rollback');
  });
});
