import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { UnifiedIntelligenceHub } from '../UnifiedIntelligenceHub';

const SRC = readFileSync(
  resolve(__dirname, '../UnifiedIntelligenceHub.tsx'), 'utf8');
const CSS = readFileSync(
  resolve(__dirname, '../../../../styles-native.css'), 'utf8');

describe('E10 мобильный/АПК/a11y слой хаба Интеллекта', () => {
  beforeEach(() => { cleanup(); localStorage.clear(); });

  it('нет шрифтов меньше 11px в хабе (E10: читаемо на телефоне)', () => {
    const sizes = [...SRC.matchAll(/fontSize:\s*(\d+)/g)].map(m => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(20);
    const tiny = sizes.filter(v => v < 11);
    expect(tiny).toEqual([]);
  });

  it('нет инлайн-контролов ниже 44px (тач-норма)', () => {
    const small = [...SRC.matchAll(/minHeight:\s*(\d+)/g)]
      .map(m => Number(m[1]))
      .filter(v => v < 44);
    expect(small).toEqual([]);
  });

  it('3/4-колоночные сетки помечены data-intel-grid (схлопывание на 380px)', () => {
    const g3 = (SRC.match(/data-intel-grid="3"/g) || []).length;
    const g4 = (SRC.match(/data-intel-grid="4"/g) || []).length;
    expect(g3).toBeGreaterThan(8);
    expect(g4).toBeGreaterThanOrEqual(2);
    // каждая «сырая» 3/4-колоночная сетка должна иметь хук — иначе она не схлопнется
    const raw3 = (SRC.match(/gridTemplateColumns:'1fr 1fr 1fr',/g) || []).length;
    const raw4 = (SRC.match(/gridTemplateColumns:'1fr 1fr 1fr 1fr',/g) || []).length;
    expect(raw3).toBe(g3);
    expect(raw4).toBe(g4);
  });

  it('native-секция §119 покрывает 44px, focus-visible, 380px, reduced-motion', () => {
    const i = CSS.indexOf('§119');
    expect(i).toBeGreaterThan(0);
    const sec = CSS.slice(i);
    expect(sec).toContain('.hub-intel button');
    expect(sec).toContain('min-height: 44px');
    expect(sec).toContain(':focus-visible');
    expect(sec).toContain('@media (max-width: 380px)');
    expect(sec).toContain('@media (prefers-reduced-motion: reduce)');
    expect(sec).toContain('[data-intel-grid="4"]');
    // в native-секции не должно быть литеральных цветов (только var)
    expect(sec).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(sec).not.toContain('rgb(');
  });

  it('навигационные плитки — role=button + tabIndex + Enter (живой маунт)', () => {
    render(<UnifiedIntelligenceHub />);
    const tile = screen.getByLabelText('Раздел: нагрузка') as HTMLElement;
    expect(tile.getAttribute('role')).toBe('button');
    expect(tile.getAttribute('tabindex')).toBe('0');
    for (const label of ['Раздел: нагрузка', 'Раздел: восстановление',
                         'Раздел: авторегуляция', 'Раздел: прогноз нагрузки']) {
      const el = screen.getByLabelText(label) as HTMLElement;
      expect(el.getAttribute('role')).toBe('button');
      expect(el.getAttribute('tabindex')).toBe('0');
    }
    // Enter не должен падать и должен вести себя как клик (страница не прыгает, ошибок нет)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.keyDown(tile, { key: 'Enter' });
    fireEvent.click(tile);
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('живой маунт: секции хаба доступны по data-intel (E9/E10 контракт)', () => {
    const { container } = render(<UnifiedIntelligenceHub />);
    for (const id of ['load', 'recovery', 'autoreg', 'forecast', 'recommendations', 'coach']) {
      const el = container.querySelector(`[data-intel="${id}"]`);
      expect(el).toBeTruthy();
    }
  });
});
