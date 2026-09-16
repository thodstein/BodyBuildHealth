import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';
import { getPlannerApply } from '../planner-bridge';

describe('PRO-6 M9: движение в мосте', () => {
  it('пусто — новых полей нет (байт-в-байт)', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '100' } });
    fireEvent.click(screen.getByText(/В Арм-конструктор/));
    const p = getPlannerApply();
    const lift = (p?.data as any)?.armLifting;
    expect(lift?.weakest).toBeTruthy();
    expect(lift?.diagTimelinePhase).toBeUndefined();
    expect(lift?.diagHandNote).toBeUndefined();
    expect(lift?.diagPainNote).toBeUndefined();
  });
  it('заполненное движение едет в payload', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '100' } });
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.click(screen.getByText('Срыв с пола'));
    fireEvent.click(screen.getByText('Палец (большой)'));
    fireEvent.change(screen.getByLabelText(/Размах кисти см/), { target: { value: '19' } });
    fireEvent.click(screen.getByText(/В Арм-конструктор/));
    const p = getPlannerApply();
    const lift = (p?.data as any)?.armLifting;
    expect(lift?.diagTimelinePhase?.id).toBe('off_floor');
    expect(lift?.diagAttemptPlan?.opener).toBeGreaterThan(0);
    expect(lift?.diagHandNote).toContain('дорогие');
    expect(lift?.diagPainNote).toContain('щипок стоп');
    expect(lift?.diagConditionsNote).toContain('тренировочный');
  });
});
