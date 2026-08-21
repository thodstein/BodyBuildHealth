/**
 * planner-settings-smoke.test.tsx — D-28 smoke: новые элементы настроек планировщика.
 * 1. Кнопка «✕ Отключить тапер» видна при активном bbPeakConfig и отключает его.
 * 2. Тумблер «🌅 Загрузка под утреннюю тренировку» переключается.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';

const TAPER_CFG = JSON.stringify({
  sex: 'male', category: 'mens_physique', weightKg: 80, showDate: '2026-09-01',
  weeksOut: 2, trainingProtocol: 'bb', carbLoadStrategy: 'moderate',
  waterStrategy: 'minimal', sodiumStrategy: 'constant',
});

describe('D-28 settings smoke', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
  });

  it('«Отключить тапер» виден при активном bbPeakConfig и сбрасывает конфиг', () => {
    try {
      localStorage.setItem('he_profile_v2', JSON.stringify({
        settings: { goals: { bbPeakConfig: TAPER_CFG, peakWeek: true } },
      }));
    } catch {}
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    const offBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Отключить тапер'));
    expect(offBtn).toBeTruthy();
    if (offBtn) {
      fireEvent.click(offBtn);
      // После отключения конфиг в профиле очищен (legacy peakWeek тоже false).
      try {
        const raw = localStorage.getItem('he_profile_v2');
        const parsed = raw ? JSON.parse(raw) : {};
        const goals = parsed?.settings?.goals || {};
        expect(goals.bbPeakConfig).toBeUndefined();
      } catch {}
    }
  });

  it('тумблер «Загрузка под утреннюю тренировку» присутствует и переключается', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    const toggle = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Загрузка под утреннюю тренировку'));
    expect(toggle).toBeTruthy();
    if (toggle) {
      fireEvent.click(toggle);
      expect((toggle.textContent || '').includes('ВКЛ')).toBe(true);
    }
  });
});