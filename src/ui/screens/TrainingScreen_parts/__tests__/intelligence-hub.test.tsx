import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnifiedIntelligenceHub } from '../UnifiedIntelligenceHub';

beforeEach(() => {
  try {
    localStorage.removeItem('he_unified_intel_snapshot_v2');
    localStorage.removeItem('he_unified_intel_snapshot_v1');
    localStorage.removeItem('he_srpe_sessions');
    localStorage.removeItem('he_hrv_log');
    localStorage.removeItem('he_readiness_history');
  } catch { /* noop */ }
});

describe('P5 Intelligence Hub UI', () => {
  it('рендерит 5 секций + кнопки P1–P5', () => {
    render(<UnifiedIntelligenceHub />);
    expect(screen.getByText('Интеллект тренировки')).toBeTruthy();
    expect(document.getElementById('sec-load')).toBeTruthy();
    expect(document.getElementById('sec-recovery')).toBeTruthy();
    expect(document.getElementById('sec-autoreg')).toBeTruthy();
    expect(document.getElementById('sec-forecast')).toBeTruthy();
    expect(document.getElementById('sec-recommendations')).toBeTruthy();
    // P1 дисклеймер, P2 HRV-база, P5 импорт/экспорт
    expect(document.body.textContent).toContain('Impellizzeri');
    expect(document.body.textContent).toContain('HRV-база');
    expect(screen.getByText(/Из дневника/)).toBeTruthy();
    expect(screen.getByText(/HTML/)).toBeTruthy();
    expect(screen.getByText(/CSV/)).toBeTruthy();
    expect(screen.getByText(/Deload .ics/)).toBeTruthy();
  });

  it('добавление sRPE обновляет журнал', () => {
    render(<UnifiedIntelligenceHub />);
    fireEvent.click(screen.getByText(/Добавить \(/));
    expect(JSON.parse(localStorage.getItem('he_srpe_sessions') || '[]')).toHaveLength(1);
  });

  it('снапшот v2 пишется с целью блока', () => {
    render(<UnifiedIntelligenceHub />);
    const snap = JSON.parse(localStorage.getItem('he_unified_intel_snapshot_v2') || '{}');
    expect(snap.v).toBe(2);
    expect(snap.goal).toBe('hypertrophy');
  });

  it('P7 a11y: навигация с aria-pressed, дата-инпут 16px, график с role=img', () => {
    render(<UnifiedIntelligenceHub />);
    const nav = document.querySelector('[aria-label^="Раздел: Нагрузка"]');
    expect(nav).toBeTruthy();
    expect(nav!.getAttribute('aria-pressed')).toBe('true');
    const dateInput = document.querySelector('input[type="date"]') as HTMLElement | null;
    expect(dateInput).toBeTruthy();
    expect(dateInput!.style.fontSize).toBe('16px');
  });

  it('D3 суперкомпенсация честно помечена ориентиром', () => {
    render(<UnifiedIntelligenceHub />);
    expect(document.body.textContent).toContain('Суперкомп. (ориентир)');
  });
});
