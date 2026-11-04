/**
 * metabolic-hub-modes.test.tsx — «все 16 калькуляторов действительно считают».
 *
 * Зачем: структура хаба проверена отдельно (metabolic-hub-structure.test.tsx), но
 * можно случайно сломать один режим (уронить `?? 0`, потерять вход, поделить на 0) —
 * пилюля переключится, а в блоке окажется пустота, `NaN` или `undefined`.
 * Этот тест кликает по всем 16 пилюлям и требует непустой результат без мусора.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MetabolicHub } from '../MetabolicHub';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => { cleanup(); });

/** Ожидаемые подписи 16 режимов — список фиксирует полноту хаба. */
const MODE_LABELS = [
  'Вода', 'Шаги', 'КБЖУ', 'Жир', 'Stress', 'Кровь', 'EA', 'Алко',
  'Белок', 'Поиск нормы', 'NEAT', 'AT', 'Щитовидка', 'Пот', 'MetS', 'Diet break',
];

describe('MetabolicHub: 16 калькуляторов выдают результат', () => {
  it('в DOM ровно 16 пилюль с ожидаемыми подписями', () => {
    const { container } = render(<MetabolicHub />);
    const pills = Array.from(container.querySelectorAll('.mh-mode')) as HTMLElement[];
    expect(pills).toHaveLength(16);
    const labels = pills.map(p => (p.textContent || '').replace(/^[^\p{L}]+/u, '').trim());
    for (const expected of MODE_LABELS) {
      expect(labels.some(l => l.startsWith(expected)), `нет пилюли «${expected}»`).toBe(true);
    }
  });

  it('каждый режим показывает непустой результат без NaN/undefined', () => {
    const { container } = render(<MetabolicHub />);
    const pills = Array.from(container.querySelectorAll('.mh-mode')) as HTMLElement[];
    const results = container.querySelector('#mh-results') as HTMLElement;
    expect(results).toBeTruthy();

    for (const pill of pills) {
      fireEvent.click(pill);
      expect(pill.getAttribute('aria-pressed'), `${pill.textContent} не активировался`).toBe('true');

      const text = (results.textContent || '').replace(/\s+/g, ' ');
      const name = (pill.textContent || '').trim();
      expect(text, `${name}: в результате NaN`).not.toMatch(/\bNaN\b/);
      expect(text, `${name}: в результате undefined`).not.toMatch(/\bundefined\b/);
      expect(text, `${name}: результат пустой`).not.toMatch(/\bnull\b/);
      expect(text.trim().length, `${name}: слишком короткий результат`).toBeGreaterThan(120);
    }
  });

  it('переключение режима не сбрасывает мастер ввода (шаг остаётся)', () => {
    render(<MetabolicHub />);
    fireEvent.click(screen.getByRole('button', { name: /Шаг 3:/ }));
    fireEvent.click(screen.getByRole('button', { name: /NEAT/ }));
    expect(screen.getByRole('button', { name: /Шаг 3:/ }).getAttribute('aria-current')).toBe('true');
  });
});
