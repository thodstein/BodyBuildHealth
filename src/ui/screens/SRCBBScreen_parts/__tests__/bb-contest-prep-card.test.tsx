/**
 * bb-contest-prep-card.test.tsx — smoke-тесты контракт-карточки годового планировщика.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BBContestPrepCard } from '../BBContestPrepCard';

describe('BBContestPrepCard smoke', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
  });

  it('без конфига: статус «не настроен» + кнопка «Создать тапер ББ»', () => {
    render(<BBContestPrepCard competition={{ name: 'Тест-шоу', week: 40 }} />);
    expect(screen.getAllByText(/Тапер ББ/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Не настроен/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Создать тапер ББ/).length).toBeGreaterThan(0);
  });

  it('дефолтная кнопка переключает активную вкладку планировщика на peak', () => {
    render(<BBContestPrepCard />);
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Создать тапер ББ'));
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    expect(localStorage.getItem('he_plan_active_tab')).toBe('peak');
  });

  it('onOpenConfig переопределяет дефолт', () => {
    let called = 0;
    render(<BBContestPrepCard onOpenConfig={() => { called += 1; }} />);
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Создать тапер ББ'));
    fireEvent.click(btn!);
    expect(called).toBe(1);
  });
});
