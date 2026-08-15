/**
 * bb-contest-prep-card.test.tsx — smoke-тесты контракт-карточки годового планировщика.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BBContestPrepCard } from '../BBContestPrepCard';
import { buildBBContestPrepPlan, serializeBBContestPrepPlan, isoAddDays, isoToday } from '../../../../engines/bb/bb-contest-prep.engine';

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

  it('с единым планом (goals.bbContestPrepPlan): фаза «📍» и недели подготовки', () => {
    const plan = buildBBContestPrepPlan({
      sex: 'male', category: 'mens_physique', weightKg: 80,
      experienceLevel: 'intermediate', enhanced: false, prepCount: 0,
      showDate: isoAddDays(isoToday(), 60), weeksOut: 2, trainingProtocol: 'bb',
      carbLoadStrategy: 'moderate', waterStrategy: 'minimal', sodiumStrategy: 'constant',
    }, { prepWeeks: 8, taperWeeks: 2 });
    localStorage.setItem('he_profile_v2', JSON.stringify({
      settings: {
        goals: { bbContestPrepPlan: serializeBBContestPrepPlan(plan) },
        personal: { weight: 80, sex: 'male' },
        health: { chronicConditions: [] },
        nutrition: {}, lifestyle: {}, training: {}, pharma: {}, labs: { status: 'none', summary: {} }, symptoms: { recent: {} },
      },
    }));
    const { container } = render(<BBContestPrepCard />);
    const text = container.textContent || '';
    expect(text).toContain('нед подготовки');
    expect(text).toContain('📍');
    expect(text).toContain('активен');
    expect(text).toContain(plan.showDate);
  });
});
