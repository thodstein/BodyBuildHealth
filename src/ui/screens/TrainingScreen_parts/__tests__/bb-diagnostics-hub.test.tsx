import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

describe('BBDiagnosticsHub', () => {
  beforeEach(() => { localStorage.clear(); });
  it('renders header and tabs', () => {
    render(<BBDiagnosticsHub />);
    expect(screen.getAllByText(/ББ-диагностика — хаб PRO/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Слабые/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Симметрия/)[0]).toBeInTheDocument();
  });
  it('toggles weak manual 1-2 and conflict shoulders+delt_mid', () => {
    render(<BBDiagnosticsHub />);
    const btnMid = screen.getAllByText('Средняя дельта')[0];
    fireEvent.click(btnMid);
    expect(btnMid.getAttribute('aria-pressed')).toBe('true');
    // second zone same muscle allowed
    const btnRear = screen.getAllByText('Задняя дельта')[0];
    fireEvent.click(btnRear);
    expect(btnRear.getAttribute('aria-pressed')).toBe('true');
  });
  it('apply without weak does not crash', () => {
    render(<BBDiagnosticsHub />);
    const apply = screen.getAllByText(/Применить в ББ-авто/)[0];
    expect(() => fireEvent.click(apply)).not.toThrow();
    expect(screen.getAllByText(/Применить в ББ-авто/)[0]).toBeInTheDocument();
  });
  it('mobility OHS toggle and apply to profile', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Мобильность\/VBT/)[0]);
    const chk = screen.getByLabelText(/Пятки плоско/);
    fireEvent.click(chk);
    expect(chk).not.toBeChecked();
  });
  it('exercise tab renders 5 sections', () => {
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ weeks: [{ sessions: [
      { exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, rir: 2 }] },
      { exercises: [{ exerciseName: 'incline_db', name: 'Жим гантелей на наклонной (30°)', muscle: 'chest', sets: 3, rir: 2 }] },
    ] }] }));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Упражнения/ }));
    expect(screen.getAllByText(/диагностика \+ PROF-коррекция/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Аудит портфеля по мышцам/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Диагноз упражнения/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Библиотека SFR/)[0]).toBeInTheDocument();
  });
  it('exercise tab without plan shows empty-state, no crash', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Упражнения/ }));
    expect(screen.getAllByText(/Нет плана ББ/)[0]).toBeInTheDocument();
  });
  it('exercise select and reset do not crash', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Упражнения/ }));
    const sel = document.querySelector('select') as HTMLSelectElement;
    expect(sel).not.toBeNull();
    fireEvent.click(screen.getAllByText(/Сброс/)[0]);
    expect(sel.value).toBe('');
  });
  it('header shows SFR/len chips when plan present', () => {
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ weeks: [{ sessions: [{ exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 3, rir: 2 }] }] }] }));
    render(<BBDiagnosticsHub />);
    expect(screen.getAllByText(/SFR/)[0]).toBeInTheDocument();
  });
});
