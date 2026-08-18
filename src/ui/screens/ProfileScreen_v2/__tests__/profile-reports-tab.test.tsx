/**
 * profile-reports-tab.test.tsx — «📊 Отчёты» Профиля (hero-вкладка):
 * подвкладки «Комплексный отчёт» / «Отчёты по блокам» / «Архив отчётов»;
 * переходы ведут на страницы отчётов модулей (onNavigate), архив читается из localStorage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileReportsTab, REPORT_SOURCES, readReportEntries } from '../ProfileReportsTab';

vi.mock('../../../../engines/comprehensive-report.engine', () => ({
  generateComprehensiveReport: vi.fn(async () => ({
    meta: { userName: 'Тест', age: 30, sex: 'male', dateFrom: '2026-08-01', dateTo: '2026-08-07' },
    sections: [],
    support: {
      course: { isActive: false, startDate: '', weekCurrent: 0, weekTotal: 0, phase: '', substances: [] },
      supplements: [],
      monitoring: [],
      pillBurden: { totalSubstances: 0, pillsPerDay: 0, feasibility: 'Низкая' },
    },
    recommendations: [],
    userNotes: '',
    photos: [],
  })),
}));

beforeEach(() => {
  localStorage.clear();
});

describe('ProfileReportsTab — структура вкладки', () => {
  it('по умолчанию — комплексный отчёт', async () => {
    const { container } = render(<ProfileReportsTab />);
    expect(container.textContent).toContain('Комплексный отчёт');
  });

  it('вкладка «Отчёты по блокам» показывает список источников', () => {
    render(<ProfileReportsTab initialView="blocks" />);
    expect(screen.getAllByText(/Отчёты по блокам/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Тренер-отчёт/)).toBeTruthy();
    expect(screen.getByText(/Фарма-отчёт/)).toBeTruthy();
    expect(screen.getByText(/Отчёт по рискам/)).toBeTruthy();
    expect(screen.getByText(/Отчёт по питанию/)).toBeTruthy();
    expect(screen.getByText(/Врач-отчёт/)).toBeTruthy();
    expect(screen.getByText(/Отчёт поддержки/)).toBeTruthy();
  });

  it('клик по отчёту блока вызывает onNavigate с целевым экраном', () => {
    const spy = vi.fn();
    render(<ProfileReportsTab initialView="blocks" onNavigate={spy} />);
    fireEvent.click(screen.getByRole('listitem', { name: /Открыть .*Фарма-отчёт/ }));
    expect(spy).toHaveBeenCalledWith('pharma-reports');
    fireEvent.click(screen.getByRole('listitem', { name: /Открыть .*Отчёт по рискам/ }));
    expect(spy).toHaveBeenCalledWith('risk-reports');
  });

  it('архив пуст — сообщение', () => {
    render(<ProfileReportsTab initialView="archive" />);
    expect(screen.getByText('Архив отчётов пуст.')).toBeTruthy();
  });

  it('архив показывает сохранённые отчёты из localStorage', () => {
    localStorage.setItem('he_training_report_current', JSON.stringify({ date: '2026-08-17', overallNet: 12 }));
    localStorage.setItem('he_risk_reports', JSON.stringify([{ date: '2026-08-16', overallNet: 45 }]));
    render(<ProfileReportsTab initialView="archive" />);
    expect(screen.getByText(/Тренер-отчёт/)).toBeTruthy();
    expect(screen.getByText(/Отчёт по рискам/)).toBeTruthy();
    expect(screen.getByText(/17\.08\.2026/)).toBeTruthy();
  });

  it('переключение подвкладок переключает контент', () => {
    render(<ProfileReportsTab />);
    fireEvent.click(screen.getByRole('tab', { name: /Отчёты по блокам/ }));
    expect(screen.getByText(/Тренер-отчёт/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Архив отчётов/ }));
    expect(screen.getByText('Архив отчётов пуст.')).toBeTruthy();
  });
});

describe('readReportEntries', () => {
  it('читает текущий отчёт и архивные ключи', () => {
    localStorage.setItem('he_risk_report_current', JSON.stringify({ date: '2026-08-17' }));
    localStorage.setItem('he_risk_reports', JSON.stringify([{ date: '2026-08-10' }, { date: '2026-08-01' }]));
    const src = REPORT_SOURCES.find((s) => s.target === 'risk-reports')!;
    expect(readReportEntries(src)).toHaveLength(3);
    expect(readReportEntries(src)[0].date).toBe('2026-08-17');
  });

  it('битые данные не роняют чтение', () => {
    localStorage.setItem('he_training_report_current', '{bad json');
    const src = REPORT_SOURCES.find((s) => s.target === 'training-analytics')!;
    expect(readReportEntries(src)).toEqual([]);
  });
});