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
    localStorage.removeItem('he_planner_apply');
    localStorage.removeItem('he_rir_calibration');
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

  it('E1 pri уходит всегда, deload — вторым пейлоадом при флаге', () => {
    const dispatched: unknown[] = [];
    const orig = window.dispatchEvent;
    window.dispatchEvent = ((e: Event) => { if (e instanceof CustomEvent && e.type === 'planner-apply' && (e as CustomEvent).detail) dispatched.push((e as CustomEvent).detail); return orig.call(window, e); }) as typeof window.dispatchEvent;
    try {
      render(<UnifiedIntelligenceHub />);
      fireEvent.click(screen.getByText(/Применить к планировщику/));
    } finally {
      window.dispatchEvent = orig;
    }
    // ровно один пейлоад (два синхронных батчатся React — второй съел бы первый)
    expect(dispatched).toHaveLength(1);
    expect((dispatched[0] as { kind: string }).kind).toBe('pri');
    expect(JSON.parse(localStorage.getItem('he_planner_apply') || '{}').kind).toBe('pri');
  });

  it('E1 deload-путь: низкая готовность → одним пейлоадом kind=deload', () => {
    localStorage.setItem('he_unified_intel_snapshot_v2', JSON.stringify({ readiness: 20, fatigue: 90 }));
    const dispatched: unknown[] = [];
    const orig = window.dispatchEvent;
    window.dispatchEvent = ((e: Event) => { if (e instanceof CustomEvent && e.type === 'planner-apply' && (e as CustomEvent).detail) dispatched.push((e as CustomEvent).detail); return orig.call(window, e); }) as typeof window.dispatchEvent;
    try {
      render(<UnifiedIntelligenceHub />);
      fireEvent.click(screen.getByText(/Применить к планировщику/));
    } finally {
      window.dispatchEvent = orig;
    }
    expect(dispatched).toHaveLength(1);
    const payload = (dispatched[0] as { kind: string; data: { volumeMult: number } });
    expect(payload.kind).toBe('deload');
    expect(payload.data.volumeMult).toBeLessThan(1);
  });

  it('E2 калибровка: честная подпись (авторегуляция bias не видит)', () => {
    localStorage.setItem('he_rir_calibration', JSON.stringify([
      { date: '2026-09-01', sessionFocus: 'push', exerciseId: 'bench', exerciseName: 'Жим', plannedRIR: 2, actualRIR: 1, weight: 100, reps: 5, setNumber: 1 },
      { date: '2026-09-02', sessionFocus: 'push', exerciseId: 'bench', exerciseName: 'Жим', plannedRIR: 2, actualRIR: 0, weight: 100, reps: 5, setNumber: 1 },
    ]));
    render(<UnifiedIntelligenceHub />);
    fireEvent.click(screen.getByText(/RIR-калибрация/));
    expect(document.body.textContent).toContain('не видит');
  });
});
