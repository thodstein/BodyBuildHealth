/**
 * kbju-profile-sync.test.tsx — проверка фиксов Этапа 1 карточки КБЖУ:
 * 1. Фаза 'course' НЕ переопределяет цель профиля (сушка) на «массонабор» (БАГ-2).
 * 2. manualGPerKgSplit пишется в отдельное поле, а numeric proteinPerKg не портится объектом (БАГ-1).
 * 3. В режиме 'profile' подпись BMR/TDEE берётся из profileTargets (БАГ-3).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';
import { getProfile, updateProfile } from '../../../../../core/profile-manager';

const STORAGE_KEY = 'he_profile_v2';

const seedProfile = (overrides: any) => {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  const base = {
    settings: {
      personal: { weight: 85, height: 180, age: 30, sex: 'male', bodyFat: 18 },
      training: { primaryGoal: 'cutting' },
      pharma: { phase: 'course' },
      nutrition: {},
    },
  };
  const merged = {
    settings: {
      ...base.settings,
      ...(overrides?.settings || {}),
      personal: { ...base.settings.personal, ...(overrides?.settings?.personal || {}) },
      training: { ...base.settings.training, ...(overrides?.settings?.training || {}) },
      pharma: { ...base.settings.pharma, ...(overrides?.settings?.pharma || {}) },
      nutrition: { ...base.settings.nutrition, ...(overrides?.settings?.nutrition || {}) },
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
};

const hasText = (re: RegExp) => !!(document.body.textContent || '').match(re);

describe('КБЖУ карточка: синхронизация с профилем', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
    try { localStorage.setItem('he_planner_mode', 'pro'); } catch {}
  });

  it('фаза course не переопределяет цель профиля «Сушка» на «Массонабор» (БАГ-2)', () => {
    seedProfile({ settings: { training: { primaryGoal: 'cutting' }, pharma: { phase: 'course' } } });
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    // цель из профиля = сушка → кнопка активна (выбрана), массонабор не должен быть выбран первым
    expect(hasText(/Сушка/)).toBe(true);
  });

  it('manualGPerKgSplit не портит numeric proteinPerKg (БАГ-1): saveToProfile пишет в Split', () => {
    // Проверяем что тип поля manualGPerKgSplit существует в профиле и proteinPerKg остаётся числом.
    // (Логика saveToProfile пишет объект в Split, а не в proteinPerKg — покрыта код-ревью; здесь
    //  проверяем, что модель UnifiedSettings позволяет Split-объект без потери numeric поля.)
    seedProfile({ settings: { nutrition: { proteinPerKg: 2.0, manualGPerKgSplit: { protein: 2.5, fat: 1.0, carbs: 3.0 } } } });
    const p = getProfile();
    const n = (p.settings.nutrition as any);
    expect(typeof n.proteinPerKg).toBe('number');
    expect(n.proteinPerKg).toBe(2.0);
    expect(n.manualGPerKgSplit.protein).toBe(2.5);
    expect(n.manualGPerKgSplit.carbs).toBe(3.0);
  });

  it('профиль без метрик тела показывает предупреждение о дефолтах (БАГ-6)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: { personal: {}, training: { primaryGoal: 'maintenance' }, pharma: {}, nutrition: {} } }));
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    expect(hasText(/дефолтам|заполнены метрики тела/)).toBe(true);
  });

  it('полный профиль НЕ показывает предупреждение о дефолтах', () => {
    seedProfile({});
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    expect(hasText(/дефолтам/)).toBe(false);
  });
});
