/**
 * combat-hard-block.test.tsx — №1: errors блочат сборку де-факто.
 * Заблокированный план показывается (красный блок), но НЕ сохраняется,
 * НЕ рассылается в питание/кардио, годовой НЕ трогается. Контроль — чистый план сохраняется.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { CombatConstructor } from '../CombatConstructor';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  cleanup();
});

function go(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

function setPopupNumber(labelRe: RegExp, value: string) {
  fireEvent.click(screen.getByRole('button', { name: labelRe }));
  const dlg = screen.getByRole('dialog', { name: labelRe });
  fireEvent.change(dlg.querySelector('.cb-pop-input')!, { target: { value } });
  fireEvent.click(dlg.querySelector('.cb-pop-ok')!);
}

describe('Combat hard-block сборки', () => {
  it('concussion×2: план показан красным, но НЕ сохранён и НЕ разослан', async () => {
    render(<CombatConstructor />);
    go('2 Атлет');
    setPopupNumber(/Сотрясения за 12 мес/, '2');
    go('4 Сплит');
    fireEvent.click(screen.getByRole('button', { name: /Собрать PRO-план/ }));
    await screen.findAllByText(/Сборка заблокирована/, {}, { timeout: 12000 });
    // красный блок на шаге плана — из PlanView (.cb-plan-errors); свой .cb-errors — на шаге quality
    expect(document.querySelector('.cb-plan-errors')?.textContent).toContain('Сборка заблокирована');
    expect(localStorage.getItem('he_combat_plan_v1')).toBeNull();
    expect(localStorage.getItem('he_combat_nutrition_payload')).toBeNull();
    expect(localStorage.getItem('he_combat_cardio_payload')).toBeNull();
    expect(localStorage.getItem('he_combat_annual_v1')).toBeNull();
  }, 20000);

  it('контроль: чистый план сохраняется и рассылается', async () => {
    render(<CombatConstructor />);
    go('4 Сплит');
    fireEvent.click(screen.getByRole('button', { name: /Собрать PRO-план/ }));
    await screen.findByText('Сводка плана', {}, { timeout: 12000 });
    expect(localStorage.getItem('he_combat_plan_v1')).not.toBeNull();
    expect(localStorage.getItem('he_combat_nutrition_payload')).not.toBeNull();
  }, 20000);

  it('redflags-скринер живёт в шаге Атлет: тихо по умолчанию, мед-блок при concussion×2', () => {
    render(<CombatConstructor />);
    go('2 Атлет');
    expect(document.querySelector('.cb-redflags')).toBeNull();
    setPopupNumber(/Сотрясения за 12 мес/, '2');
    const box = document.querySelector('.cb-redflags');
    expect(box).not.toBeNull();
    expect(box?.textContent).toContain('до врача');
  }, 20000);
});
