/**
 * pl-consent-gates.test.tsx — Фаза 0: ОРИГИНАЛ ЦИКЛА меняется только по согласию.
 *
 *  1. MacrocyclePanel: применение макроцикла с растяжением/сжатием цикла под
 *     блок заблокировано до явного согласия; в списке — реальные «N нед цикла →
 *     M нед блока»; после согласия кнопка работает; отзыв снова блокирует.
 *  2. PLSeasonBuilder: диалог показывает РЕАЛЬНУЮ длину цикла (было N→N из-за
 *     чтения meta у производной копии); кнопка отказа честная — «Пропустить слот
 *     (цикл не меняем)», а не лживое «1:1».
 */
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MacrocyclePanel } from '../MacrocyclePanel';
import { PLSeasonBuilder } from '../PLSeasonBuilder';

vi.mock('../../../../core/profile-manager', () => ({
  getProfile: () => ({ settings: { personal: { weight: 70, sex: 'female' }, goals: { bbCategory: 'Bikini' } } }),
}));

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('MacrocyclePanel — согласие на адаптацию циклов под блоки', () => {
  /** Legacy v1-макро: cycle-01 (12 нед, троеборье) растянут в 21-недельный блок. */
  function seedLegacyMacro(): void {
    const v1 = JSON.stringify({
      v: 1,
      b: [
        ['endurance', 10, 1, 'SRC', 'cycle-03', ''],
        ['strength', 21, 11, 'SRC', 'cycle-01', ''],
        ['peak', 8, 32, 'SRC', 'cycle-02', ''],
        ['competition', 1, 40, 'SRC', null, ''],
        ['transition', 4, 41, 'SRC', 'cycle-01', ''],
      ],
      t: 44,
      c: 40,
      r: [],
    });
    localStorage.setItem('he_pl_macro', v1);
  }

  it('растяжение цикла: применение заблокировано до согласия, в списке реальные длины', () => {
    seedLegacyMacro();
    let applied = 0;
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} onApplyMacrocycle={() => { applied++; }} />);

    const panel = document.querySelector('[data-pl="macro-fit-consent"]');
    expect(panel).toBeTruthy();
    expect(panel!.textContent).toContain('12 нед цикла → 21 нед блока');
    expect(panel!.textContent).toContain('Оригинал цикла не изменяется');

    const applyBtn = document.querySelector('[data-pl="apply-macro"]') as HTMLButtonElement;
    expect(applyBtn).toBeTruthy();
    expect(applyBtn.disabled).toBe(true);
    fireEvent.click(applyBtn);
    expect(applied).toBe(0);

    fireEvent.click(document.querySelector('[data-pl="macro-fit-consent-ok"]')!);
    expect(document.querySelector('[data-pl="apply-macro"]')!.hasAttribute('disabled')).toBe(false);
    fireEvent.click(document.querySelector('[data-pl="apply-macro"]')!);
    expect(applied).toBe(1);
  });

  it('отзыв согласия снова блокирует применение', () => {
    seedLegacyMacro();
    let applied = 0;
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} onApplyMacrocycle={() => { applied++; }} />);
    fireEvent.click(document.querySelector('[data-pl="macro-fit-consent-ok"]')!);
    fireEvent.click(document.querySelector('[data-pl="macro-fit-consent-revoke"]')!);
    const applyBtn = document.querySelector('[data-pl="apply-macro"]') as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);
    fireEvent.click(applyBtn);
    expect(applied).toBe(0);
  });

  it('без расхождений длин (короткий макро из cycle-01 12 нед в блок 12) панель согласия не появляется', () => {
    const v1 = JSON.stringify({
      v: 1,
      b: [
        ['strength', 12, 1, 'SRC', 'cycle-01', ''],
      ],
      t: 12,
      c: 12,
      r: [],
    });
    localStorage.setItem('he_pl_macro', v1);
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} onApplyMacrocycle={() => {}} />);
    expect(document.querySelector('[data-pl="macro-fit-consent"]')).toBeNull();
    const applyBtn = document.querySelector('[data-pl="apply-macro"]') as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(false);
  });
});

describe('PLSeasonBuilder — честный диалог согласия', () => {
  const selector = { goal: 'strength', level: 'II-KMS', bodyWeight: 90, daysPerWeek: 4, direction: 'powerlifting', mode: 'natural' } as never;
  const buildOpts = { pmMap: { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 }, fallbackPm: 80 } as never;

  function props() {
    return {
      selector,
      meets: [],
      taper: { mode: 'classic' as const, mockMeet: false, postMeet: false },
      buildOpts,
      onBuilt: () => {},
      onNavigatePlan: () => {},
    };
  }

  it('«Согласен, применить X→Y» показывает реальную длину цикла (X ≠ Y), кнопка отказа — «Пропустить слот»', () => {
    localStorage.setItem('he_pl_session', JSON.stringify({ season: { mode: 'season' } }));
    render(<PLSeasonBuilder {...props()} />);

    const consentBtns = screen.queryAllByText(/Согласен, применить/);
    expect(consentBtns.length).toBeGreaterThan(0);
    for (const btn of consentBtns) {
      const m = (btn.textContent || '').match(/(\d+)→(\d+)/);
      expect(m, `в кнопке нет пары N→M: ${btn.textContent}`).toBeTruthy();
      // Регрессия «сжать 20→20»: X всегда реальная длина цикла, Y — окно слота.
      expect(m![1]).not.toBe(m![2]);
    }
    expect(screen.queryAllByText(/Пропустить слот \(цикл не меняем\)/).length).toBeGreaterThan(0);
  });
});
