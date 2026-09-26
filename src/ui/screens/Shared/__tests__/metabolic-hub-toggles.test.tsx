/**
 * metabolic-hub-toggles.test.tsx — guard-тесты АПК-редизайна MetabolicHub:
 * нативных checkbox/select больше нет, все переключатели — карточки role=switch,
 * сегменты и режимы — кнопки с aria-pressed, тач-норма 44px.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
    // 26 сен 2026 (E0.13): БЫЛО `modes.slice(0, 4)` с порогом 40 — то есть
    // проверялись 4 из 16 пилюль, и порог был НИЖЕ сенсорной нормы 44px.
    // Из-за этого реальные 40px у всех 16 режимов проходили как «норма».
    // Стало: ВСЕ 16 режимов и порог 44.
    for (const b of modes) {
      expect(Number.parseFloat(b.style.minHeight)).toBeGreaterThanOrEqual(44);
    }
  });

  it('хуки выдачи на месте (mh-act/mh-mini/mh-compare/mh-preset)', () => {
    const { container } = render(<MetabolicHub />);
    expect(container.querySelectorAll('.mh-act').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.mh-preset').length).toBe(4);
  });
});

/**
 * 26 сен 2026 (E0.13) — сенсорная норма 44px.
 *
 * План: `styles-native.css` в зоне §96 поднимает только press/focus/tabular и НЕ
 * поднимает ни одного `min-height`; сам файл — чужой append-only WIP, поэтому
 * правки сделаны инлайн в TSX (прецедент: «АПК-специфика только под
 * html.app-native, но при append-only WIP — инлайн»).
 *
 * Что было ниже нормы (измерено, а не взято из плана):
 *   .mh-preset   ~26px (только padding, без minHeight) → +minHeight 44
 *   .mh-compare  30×30                                  → тач-область 44×44, видимый кружок 30
 *   .mh-mini     minHeight 40 (2 кнопки)                → 44
 *   .mh-mode     minHeight 40 × ВСЕ 16 режимов          → 44
 *   пот-тумблеры minHeight 32 (2 кнопки)                → 44
 *
 * Ключевой момент: `.mh-mode` проверялся тестом только для 4 из 16 пилюль и с
 * порогом 40 — то есть реальные 40px у всех 16 проходили как «норма». Теперь
 * проверяются все 16 с порогом 44.
 */
describe('MetabolicHub: сенсорная норма 44px (E0.13)', () => {
  const norm44 = (el: HTMLElement) => {
    const min = Number.parseFloat(el.style.minHeight);
    const h = Number.parseFloat(el.style.height);
    const w = Number.parseFloat(el.style.width);
    return Math.max(min || 0, h || 0, w || 0);
  };

  it('все 16 пилюль режима не меньше 44px', () => {
    const { container } = render(<MetabolicHub />);
    const modes = Array.from(container.querySelectorAll('.mh-mode')) as HTMLElement[];
    expect(modes).toHaveLength(16);
    const bad = modes.map(norm44).filter(v => v < 44);
    expect(bad, `пилюли ниже нормы: ${bad.join(', ')}`).toHaveLength(0);
  });

  it('пресеты сценария не меньше 44px (было ~26px на padding)', () => {
    const { container } = render(<MetabolicHub />);
    const presets = Array.from(container.querySelectorAll('.mh-preset')) as HTMLElement[];
    expect(presets).toHaveLength(4);
    for (const p of presets) expect(norm44(p)).toBeGreaterThanOrEqual(44);
  });

  it('все role=switch не меньше 44px по высоте или ширине (пот-тумблеры)', () => {
    const { container } = render(<MetabolicHub />);
    const sw = Array.from(container.querySelectorAll('[role="switch"]')) as HTMLElement[];
    expect(sw.length).toBeGreaterThan(0);
    // У свитчей важен тач-таргет по меньшей стороне: узкий переключатель,
    // у которого высокий ряд, всё равно неудобно нажимать пальцем.
    for (const s of sw) {
      const min = Number.parseFloat(s.style.minHeight);
      const h = Number.parseFloat(s.style.height);
      expect(Math.max(min || 0, h || 0)).toBeGreaterThanOrEqual(44);
    }
  });

  it('.mh-mini (загрузить/удалить сценарий) не меньше 44px', () => {
    // Кнопки появляются только при наличии сценария — проверяем через источник,
    // чтобы тест не зависел от настройки стора.
    const src = readFileSync(
      resolve(process.cwd(), 'src/ui/screens/Shared/MetabolicHub.tsx'),
      'utf8',
    );
    const mini = [...src.matchAll(/className="mh-mini"[\s\S]{0,260}?minHeight:\s*(\d+)/g)].map(m => Number(m[1]));
    expect(mini.length).toBeGreaterThan(0);
    for (const v of mini) expect(v).toBeGreaterThanOrEqual(44);
  });

  it('.mh-compare: тач-область 44×44 при видимом кружке 30', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/ui/screens/Shared/MetabolicHub.tsx'),
      'utf8',
    );
    // окно большое: между хуком и размером лежит поясняющий комментарий
    expect(src).toMatch(/className="mh-compare"[\s\S]{0,700}?width:44, height:44/);
    // Видимая часть осталась компактной — иначе ряд сценариев визуально распух.
    expect(src).toMatch(/width:30, height:30, borderRadius:'50%'/);
  });
});
