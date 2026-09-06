/**
 * profile-diaries-tab-reset.test.tsx — «Сбросить всё» очищает ВСЕ встроенные дневники,
 * включая unified-здоровье (he_health_diary) и вес (he_weight_log), и undo восстанавливает их.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileDiariesTab } from '../ProfileDiariesTab';

const TODAY = new Date();
const todayIso = () =>
  `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-${String(TODAY.getDate()).padStart(2, '0')}`;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  window.confirm = vi.fn(() => true);
});

describe('ProfileDiariesTab — «Сбросить всё»', () => {
  it('очищает unified-здоровье и вес вместе с остальными дневниками', async () => {
    const today = todayIso();
    localStorage.setItem('he_sleep_diary', JSON.stringify([{ date: today, hours: 7.5, quality: 4 }]));
    localStorage.setItem('he_bp_diary', JSON.stringify([{ date: today, systolic: 120, diastolic: 80, hr: 70 }]));
    localStorage.setItem('he_injection_diary', JSON.stringify([{ date: today, substance: 'Тестостерон энантат', dose: '250 мг', zone: 'glute_dorsal' }]));
    localStorage.setItem('he_health_diary', JSON.stringify([{ date: today, pain: { totalScore: 5 }, symptoms: [], neuro: null, acne: null, hemato: null }]));
    localStorage.setItem('he_weight_log', JSON.stringify([{ date: today, weight: 82.5 }]));

    render(<ProfileDiariesTab />);

    // Раскрыть секцию «Данные» (заголовок без эмодзи — иконка SVG рядом)
    const dataSection = screen.getByText('Данные');
    fireEvent.click(dataSection);

    fireEvent.click(screen.getByRole('button', { name: /Сбросить всё/ }));

    await waitFor(() => {
      expect(localStorage.getItem('he_health_diary')).toBe('[]');
      expect(localStorage.getItem('he_weight_log')).toBe('[]');
      expect(localStorage.getItem('he_sleep_diary')).toBe('[]');
      expect(localStorage.getItem('he_bp_diary')).toBe('[]');
      expect(localStorage.getItem('he_injection_diary')).toBe('[]');
    });
  });

  it('undo после сброса восстанавливает здоровье и вес', async () => {
    const today = todayIso();
    localStorage.setItem('he_health_diary', JSON.stringify([{ date: today, pain: { totalScore: 5 }, symptoms: [], neuro: null, acne: null, hemato: null }]));
    localStorage.setItem('he_weight_log', JSON.stringify([{ date: today, weight: 82.5 }]));

    render(<ProfileDiariesTab />);
    fireEvent.click(screen.getByText('Данные'));
    fireEvent.click(screen.getByRole('button', { name: /Сбросить всё/ }));

    const undoBtn = screen.getByRole('button', { name: /Отменить/ });
    fireEvent.click(undoBtn);

    await waitFor(() => {
      const health = JSON.parse(localStorage.getItem('he_health_diary') || '[]');
      const weights = JSON.parse(localStorage.getItem('he_weight_log') || '[]');
      expect(health.length).toBe(1);
      expect(weights.length).toBe(1);
      expect(weights[0].weight).toBe(82.5);
    });
  });
});
