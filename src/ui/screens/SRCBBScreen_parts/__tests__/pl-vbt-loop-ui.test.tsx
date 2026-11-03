/**
 * pl-vbt-loop-ui.test.tsx — Фаза 6, п.7: VBT-контур в плеере.
 *
 * Проверяем пользовательский путь: ввёл скорости → увидел рекомендацию →
 * нажал «Применить» → следующий подход получил новый вес (и это видно).
 * Плюс обещание «молча ничего не меняется»: без нажатия вес остаётся плановым.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SessionPlayer, type PlayerDay } from '../SessionPlayer';

const day = (weights: number[] = [100, 100, 100]): PlayerDay => ({
  label: 'День 1 · присед',
  exercises: [{
    name: 'Присед',
    group: 'legs',
    load: 'Тяжелая',
    restSec: 180,
    targetSets: weights.map(w => ({ weight: w, reps: 5, rir: 2 })),
  } as never],
});

const setVel = (idx: number, value: string) => {
  const inputs = screen.getAllByLabelText('скорость м/с') as HTMLInputElement[];
  fireEvent.change(inputs[idx], { target: { value } });
};

/** Плеер стартует с выбора дня: начать → пропустить разминку → основная часть. */
const openMain = () => {
  fireEvent.click(screen.getByText('Начать тренировку'));
  fireEvent.click(screen.getByText('🚀 К основной части'));
};

describe('SessionPlayer — VBT-замкнутый контур (п.7)', () => {
  it('скорость упала на 24 % → рекомендация легче на 5 % и кнопка применения', () => {
    render(<SessionPlayer days={[day()]} weekNumber={1} focus="PL" />);
    openMain();
    setVel(0, '0.5');
    setVel(1, '0.38');
    const advice = document.querySelector('[data-pl="vbt-advice"]');
    expect(advice).toBeTruthy();
    expect(advice!.textContent).toMatch(/порог 20% пробит/);
    const btn = document.querySelector('[data-pl="vbt-apply"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toMatch(/Применить к сету 3: 95 кг/);
  });

  it('«Применить» пишет 95 кг третьему подходу и помечает применение', () => {
    render(<SessionPlayer days={[day([100, 100, 100])]} weekNumber={1} focus="PL" />);
    openMain();
    setVel(0, '0.5');
    setVel(1, '0.38');
    fireEvent.click(document.querySelector('[data-pl="vbt-apply"]') as HTMLElement);
    const applied = document.querySelector('[data-pl="vbt-applied"]');
    expect(applied).toBeTruthy();
    expect(applied!.textContent).toMatch(/сету 3: 95 кг/);
    // Вес третьего подхода в поле «вес» действительно стал 95.
    const weightInputs = screen.getAllByLabelText('вес') as HTMLInputElement[];
    expect(weightInputs[2].value).toBe('95');
    // Кнопка применения исчезает — второй раз то же решение не применяется.
    expect(document.querySelector('[data-pl="vbt-apply"]')).toBeNull();
  });

  it('без нажатия «Применить» вес остаётся плановым (молча ничего не меняется)', () => {
    render(<SessionPlayer days={[day([100, 100, 100])]} weekNumber={1} focus="PL" />);
    openMain();
    setVel(0, '0.5');
    setVel(1, '0.38');
    const weightInputs = screen.getAllByLabelText('вес') as HTMLInputElement[];
    expect(weightInputs[2].value).toBe('100');
    expect(document.querySelector('[data-pl="vbt-applied"]')).toBeNull();
  });

  it('один подход со скоростью → «нужен второй подход», применения нет', () => {
    render(<SessionPlayer days={[day()]} weekNumber={1} focus="PL" />);
    openMain();
    setVel(0, '0.45');
    const advice = document.querySelector('[data-pl="vbt-advice"]');
    expect(advice!.textContent).toMatch(/Нужен второй подход/);
    expect(document.querySelector('[data-pl="vbt-apply"]')).toBeNull();
  });

  it('стабильная скорость в зоне → «держим план», применения нет', () => {
    render(<SessionPlayer days={[day()]} weekNumber={1} focus="PL" />);
    openMain();
    setVel(0, '0.42');
    setVel(1, '0.42');
    const advice = document.querySelector('[data-pl="vbt-advice"]');
    expect(advice!.textContent).toMatch(/держим 100 кг/);
    expect(document.querySelector('[data-pl="vbt-apply"]')).toBeNull();
  });
});
