/**
 * planner-settings-audit.test.tsx — аудит кнопок настроек (план NUTRITION-VARIETY-PLAN):
 * работоспособность/дубли (B1/B3/B6/C5 + P1-6 HV-стиль + P1-9 «Снять потолок»).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';

const hasText = (re: RegExp) => !!(document.body.textContent || '').match(re);
const clickBtn = (re: RegExp) => {
  const btns = Array.from(document.querySelectorAll('button')).filter(b => re.test(b.textContent || ''));
  if (btns.length === 0) throw new Error(`button not found: ${re}`);
  fireEvent.click(btns[btns.length - 1]);
};
// точный клик по тексту чипа (чтобы не задеть карточку-пресет с тем же префиксом)
const clickExact = (text: string) => {
  const btns = Array.from(document.querySelectorAll('button')).filter(b => (b.textContent || '').trim() === text);
  if (btns.length === 0) throw new Error(`button not found (exact): ${text}`);
  fireEvent.click(btns[0]);
};

describe('Настройки: аудит кнопок (фиксы B1/B6/C5/C8 + P1-6/P1-9)', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
    try {
      localStorage.setItem('he_planner_mode', 'pro');
      localStorage.setItem('he_profile_v2', JSON.stringify({
        settings: {
          personal: { weight: 85, height: 180, age: 30, sex: 'male', bodyFat: 18 },
          training: { primaryGoal: 'mass' },
          pharma: { phase: 'course' },
          nutrition: {},
        },
      }));
    } catch {}
  });

  it('P1-6: карточка «Стиль High-Volume» видна и персистит he_planner_hv_style', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    expect(hasText(/Стиль High-Volume/)).toBe(true);
    clickBtn(/⚡ Практичный/);
    expect(localStorage.getItem('he_planner_hv_style')).toBe('practical');
  });

  it('B6: фаза v2-скоринга персистится (he_planner_v2_phase)', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    clickExact('🔥 Сушка');
    expect(localStorage.getItem('he_planner_v2_phase')).toBe('EXTREME_CUT');
  });

  it('B1: в ручном КБЖУ нет no-op кнопки «✓ Применить» (авто-сейв честно подписан)', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    clickBtn(/Ручной ввод/); // ВКЛ (сегмент КБЖУ-карточки)
    expect(hasText(/применяются автоматически/)).toBe(true);
    const applyBtns = Array.from(document.querySelectorAll('button')).filter(b => (b.textContent || '').includes('✓ Применить'));
    expect(applyBtns.length).toBe(0);
  });

  it('C5: чип «Гистамин» синхронизирует histamineSensitive (he_planner_histamine)', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    clickBtn(/Гистамин/);
    expect(localStorage.getItem('he_planner_histamine')).toBe('true');
  });

  it('C1: «Заполнить анализы» импортирует коды лаборатории через единый helper', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[{ code: 'ALT', value: 42 }, { code: 'HEMATOCRIT', value: 48 }]} labAnalysis={null} />);
    clickBtn(/🩸 Заполнить анализы/);
    const saved = JSON.parse(localStorage.getItem('he_planner_labs') || '{}');
    expect(saved.alt).toBe('42');
    expect(saved.hematocrit).toBe('48');
    expect(saved.potassium).toBeUndefined(); // электролиты не импортируются (units-fix)
  });

  it('P1-1: генерация пишет ledger разнообразия (he_planner_variety_ledger_v1) с food-ids', async () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    clickBtn(/Сгенерировать план питания/);
    await waitFor(() => {
      const raw = localStorage.getItem('he_planner_variety_ledger_v1');
      expect(raw).toBeTruthy();
      const l = JSON.parse(raw!);
      expect(Array.isArray(l.foods) && l.foods.length > 0).toBe(true);
      expect(Array.isArray(l.weekFamilies)).toBe(true);
    }, { timeout: 30000 });
  });
});
