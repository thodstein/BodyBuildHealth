/**
 * cycle-catalog-bridge.test.tsx — мост «Библиотека → конструкторы»:
 *  - кнопки каталога пишут kind arm_cycle/ss_cycle + трек + событие + баннер;
 *  - арм-конструктор ставит cycId из моста (неизвестный id — честная ошибка);
 *  - SS-конструктор ставит cycleId+режим+сроки из моста (неизвестный id — ошибка).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { CycleCatalog } from '../CycleCatalog';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { StrengthSportConstructor } from '../../strength-sport/StrengthSportConstructor';
import { applyToPlanner, clearPlannerApply } from '../planner-bridge';

const PROPS = { goal: 'strength', level: 'II-KMS', daysPerWeek: 3 };

function seedBridge(kind: string, cycleId: string) {
  localStorage.setItem(
    'he_planner_apply',
    JSON.stringify({ kind, label: 't', data: { cycleId }, ts: Date.now() }),
  );
}

describe('Мост Библиотека → конструкторы', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    cleanup();
  });

  it('арм-карточка отправляет arm_cycle + трек + событие + баннер', () => {
    let detail: unknown = null;
    const h = (e: Event) => { detail = (e as CustomEvent).detail; };
    window.addEventListener('planning-track-open', h);
    try {
      render(<CycleCatalog {...PROPS} />);
      fireEvent.click(screen.getByText('Арм'));
      fireEvent.click(screen.getByText('KTA singles (Kinney/Horne, 6д/нед)'));
      fireEvent.click(screen.getByText('💪 Собрать в арм-конструкторе →'));
      const saved = JSON.parse(localStorage.getItem('he_planner_apply') || 'null');
      expect(saved.kind).toBe('arm_cycle');
      expect(saved.data.cycleId).toBe('kta_singles');
      expect(localStorage.getItem('he_training_planning_track')).toBe('arm');
      expect(detail).toBe('arm');
      expect(screen.getByRole('status').textContent).toContain('арм-конструктор');
    } finally {
      window.removeEventListener('planning-track-open', h);
    }
  });

  it('SS-карточка отправляет ss_cycle + трек + событие + баннер', () => {
    let detail: unknown = null;
    const h = (e: Event) => { detail = (e as CustomEvent).detail; };
    window.addEventListener('planning-track-open', h);
    try {
      render(<CycleCatalog {...PROPS} />);
      fireEvent.click(screen.getByText('ТА·Стронг'));
      fireEvent.click(screen.getByText('ТА общая база — 8 недель (5 д/нед)'));
      fireEvent.click(screen.getByText('🏋️ Собрать в ТА/стронг-конструкторе →'));
      const saved = JSON.parse(localStorage.getItem('he_planner_apply') || 'null');
      expect(saved.kind).toBe('ss_cycle');
      expect(saved.data.cycleId).toBe('ss-ta-general-8');
      expect(localStorage.getItem('he_training_planning_track')).toBe('strength');
      expect(detail).toBe('strength');
      expect(screen.getByRole('status').textContent).toContain('конструктор ТА/стронга');
    } finally {
      window.removeEventListener('planning-track-open', h);
    }
  });

  it('арм-конструктор подхватывает цикл из моста при монтировании', () => {
    seedBridge('arm_cycle', 'kta_singles');
    const { container } = render(<ArmAutoConstructor />);
    expect(container.querySelector('[data-arm="msg"]')?.textContent).toContain('KTA singles');
  });

  it('арм-конструктор честно ругается на неизвестный id', () => {
    seedBridge('arm_cycle', 'nope');
    render(<ArmAutoConstructor />);
    expect(screen.getByText(/не найден в библиотеке/)).toBeTruthy();
  });

  it('SS-конструктор подхватывает цикл из моста (id+сообщение)', () => {
    seedBridge('ss_cycle', 'ss-ta-general-8');
    const { container } = render(<StrengthSportConstructor />);
    expect(localStorage.getItem('he_ss_cycle_v1')).toBe('ss-ta-general-8');
    expect(container.querySelector('[data-ss="msg"]')?.textContent).toContain('ТА общая база');
  });

  it('SS-конструктор честно ругается на неизвестный id', () => {
    seedBridge('ss_cycle', 'nope');
    render(<StrengthSportConstructor />);
    expect(screen.getByText(/не найден в библиотеке/)).toBeTruthy();
  });

  it('арм-конструктор подхватывает цикл живьём (уже открыт)', () => {
    try { localStorage.removeItem('he_planner_apply'); } catch { /* ignore */ }
    const { container } = render(<ArmAutoConstructor />);
    expect(container.querySelector('[data-arm="msg"]')).toBeNull();
    act(() => { applyToPlanner({ kind: 'arm_cycle', label: 'Toproll', data: { cycleId: 'toproll_6' } }); });
    expect(container.querySelector('[data-arm="msg"]')?.textContent).toContain('Toproll 6-week');
    clearPlannerApply();
  });

  it('SS-конструктор подхватывает цикл живьём (уже открыт)', () => {
    try { localStorage.removeItem('he_planner_apply'); } catch { /* ignore */ }
    const { container } = render(<StrengthSportConstructor />);
    act(() => { applyToPlanner({ kind: 'ss_cycle', label: 'Peak', data: { cycleId: 'ss-sm-peak-4' } }); });
    expect(localStorage.getItem('he_ss_cycle_v1')).toBe('ss-sm-peak-4');
    expect(container.querySelector('[data-ss="msg"]')?.textContent).toContain('Стронг пик');
    clearPlannerApply();
  });
});
