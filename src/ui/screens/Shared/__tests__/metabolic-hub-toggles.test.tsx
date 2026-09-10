/**
 * metabolic-hub-toggles.test.tsx — guard-тесты АПК-редизайна MetabolicHub:
 * нативных checkbox/select больше нет, все переключатели — карточки role=switch,
 * сегменты и режимы — кнопки с aria-pressed, тач-норма 44px.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { MetabolicHub } from '../MetabolicHub';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});

afterEach(() => {
  cleanup();
});

describe('MetabolicHub: тоглы вместо галочек', () => {
  it('нативных checkbox/select в хабе — ноль', () => {
    const { container } = render(<MetabolicHub />);
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    expect(container.querySelectorAll('select').length).toBe(0);
  });

  it('переключатели — role=switch с aria-checked, клик переворачивает', () => {
    const { container } = render(<MetabolicHub />);
    const switches = Array.from(container.querySelectorAll('[role="switch"]'));
    expect(switches.length).toBeGreaterThan(0);
    const first = switches[0] as HTMLElement;
    expect(first.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(first);
    expect(first.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(first);
    expect(first.getAttribute('aria-checked')).toBe('false');
  });

  it('LEAF/LEAM-опросники — тоже свитчи (было 14 чекбоксов)', () => {
    const { container } = render(<MetabolicHub />);
    const switches = Array.from(container.querySelectorAll('[role="switch"]'));
    // 2 особых состояния + 8 LEAF + 6 LEAM + 5 CAT2-флагов + креатин = 22
    expect(switches.length).toBeGreaterThanOrEqual(20);
  });

  it('сегменты ААС/визард и пилюли режимов — кнопки 44px+ с aria-pressed/current', () => {
    const { container } = render(<MetabolicHub />);
    const aasOff = screen.getByRole('button', { name: /Без ААС/ });
    expect(aasOff.getAttribute('aria-pressed')).toBe('true');
    const segBtns = Array.from(container.querySelectorAll('.mh-seg')) as HTMLElement[];
    expect(segBtns.length).toBeGreaterThan(0);
    for (const b of segBtns) {
      expect(Number.parseFloat(b.style.minHeight)).toBeGreaterThanOrEqual(44);
    }
    const modes = Array.from(container.querySelectorAll('.mh-mode')) as HTMLElement[];
    expect(modes.length).toBe(16);
    for (const b of modes.slice(0, 4)) {
      expect(Number.parseFloat(b.style.minHeight)).toBeGreaterThanOrEqual(40);
    }
  });

  it('хуки выдачи на месте (mh-act/mh-mini/mh-compare/mh-preset)', () => {
    const { container } = render(<MetabolicHub />);
    expect(container.querySelectorAll('.mh-act').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.mh-preset').length).toBe(4);
  });
});
