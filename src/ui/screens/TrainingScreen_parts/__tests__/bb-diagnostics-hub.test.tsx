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
    fireEvent.click(screen.getAllByText(/Подвижность/)[0]);
    const card = screen.getByRole('switch', { name: /Пятки плоско/ });
    expect(card.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(card);
    expect(screen.getByRole('switch', { name: /Пятки плоско/ }).getAttribute('aria-checked')).toBe('false');
  });
  it('exercise tab renders 5 sections', () => {
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ weeks: [{ sessions: [
      { exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, rir: 2 }] },
      { exercises: [{ exerciseName: 'incline_db', name: 'Жим гантелей на наклонной (30°)', muscle: 'chest', sets: 3, rir: 2 }] },
    ] }] }));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Упражнения/ }));
    expect(screen.getAllByText(/разбор \+ техника/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Аудит портфеля по мышцам/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Диагноз упражнения/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Библиотека упражнений/)[0]).toBeInTheDocument();
  });
  it('exercise tab without plan shows empty-state, no crash', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Упражнения/ }));
    expect(screen.getAllByText(/Нет плана ББ/)[0]).toBeInTheDocument();
  });
  it('exercise select and reset do not crash', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Упражнения/ }));
    const trig = screen.getByTestId('bb-exercise');
    expect(trig).toBeInTheDocument();
    expect(trig.textContent).toMatch(/не выбрано/i);
    fireEvent.click(screen.getAllByText(/Сброс/)[0]);
    expect(screen.getByTestId('bb-exercise').textContent).toMatch(/не выбрано/i);
  });
  it('header shows SFR/len chips when plan present', () => {
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ weeks: [{ sessions: [{ exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 3, rir: 2 }] }] }] }));
    render(<BBDiagnosticsHub />);
    expect(screen.getAllByText(/SFR/)[0]).toBeInTheDocument();
  });
  it('deviation chip fills setup note and raises synergistTakeover', () => {
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ weeks: [{ sessions: [{ exercises: [{ exerciseName: 'tricep_pushdown_rope', name: 'Разгибание на блоке', muscle: 'triceps', sets: 3, rir: 2 }] }] }] }));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Упражнения/ }));
    // выбираем упражнение из портфеля плана
    const chips = Array.from(document.querySelectorAll('[title*="SFR"]'));
    const target = chips.find((el) => /блок/i.test(el.getAttribute('title') || ''));
    expect(target).toBeTruthy();
    fireEvent.click(target!);
    // чипы отклонений из записи стимула
    const dev = screen.getAllByText(/локти вперёд/)[0];
    fireEvent.click(dev);
    expect(dev.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByText(/нагрузку забирают соседи/)[0]).toBeInTheDocument();
    // повторный клик снимает тап и флаг
    fireEvent.click(screen.getAllByText(/локти вперёд/)[0]);
    expect(screen.queryByText(/нагрузку забирают соседи/)).toBeNull();
  });
  it('weak zone card shows e1RM trend chip from diary', () => {
    localStorage.setItem('he_workout_log_v1', JSON.stringify([
      { date: '2026-07-20', exercises: [{ muscleGroup: 'chest', sets: [{ weightKg: 100, reps: 8 }] }] },
      { date: '2026-08-21', exercises: [{ muscleGroup: 'chest', sets: [{ weightKg: 90, reps: 8 }] }] },
      { date: '2026-08-22', exercises: [{ muscleGroup: 'chest', sets: [{ weightKg: 90, reps: 8 }] }] },
      { date: '2026-08-22', exercises: [{ muscleGroup: 'back', sets: [{ weightKg: 80, reps: 8 }] }] },
    ]));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    expect(screen.getAllByText(/Дневник e1RM \(28д\)/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/-10/)[0]).toBeInTheDocument();
  });
  it('library marks weak-head hitters with target chip', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Упражнения/ }));
    // тултипы библиотеки теперь несут головки
    const withHeads = document.querySelector('[title*="бьёт:"]');
    expect(withHeads).not.toBeNull();
    // incline бьёт в chest_upper → маркер цели
    expect(screen.getAllByText(/🎯/)[0]).toBeInTheDocument();
  });
  it('setup taps reset when exercise changes (no leak into next diagnosis)', () => {
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ weeks: [{ sessions: [{ exercises: [
      { exerciseName: 'tricep_pushdown_rope', name: 'Разгибание на блоке', muscle: 'triceps', sets: 3, rir: 2 },
      { exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 3, rir: 2 },
    ] }] }] }));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Упражнения/ }));
    const chips = Array.from(document.querySelectorAll('[title*="SFR"]'));
    fireEvent.click(chips.find((el) => /блок/i.test(el.getAttribute('title') || ''))!);
    fireEvent.click(screen.getByRole('switch', { name: /Читинг \/ раскачка/ }));
    expect(screen.getByRole('switch', { name: /Читинг \/ раскачка/ }).getAttribute('aria-checked')).toBe('true');
    // переключаемся на другое упражнение — тапы сброшены
    fireEvent.click(chips.find((el) => /Жим штанги лёжа/i.test(el.getAttribute('title') || ''))!);
    expect(screen.getByRole('switch', { name: /Читинг \/ раскачка/ }).getAttribute('aria-checked')).toBe('false');
  });
  it('past analysis from BB-auto can be restored with one click', () => {
    localStorage.setItem('he_bb_last_weak_heads', JSON.stringify(['chest_upper']));
    render(<BBDiagnosticsHub />);
    expect(screen.getAllByText(/Прошлый разбор/)[0]).toBeInTheDocument();
    fireEvent.click(screen.getAllByText(/Вернуть в работу/)[0]);
    expect(screen.getAllByText('Верх груди')[0].getAttribute('aria-pressed')).toBe('true');
  });
  it('inject inserts corrections into saved plan and rollback restores it', () => {
    const saved = JSON.stringify({ plan: { weeks: [
      { sessions: [{ day: 1, exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, rir: 2, role: 'primary' }] }] },
      { sessions: [{ day: 1, exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, rir: 2, role: 'primary' }] }] },
    ] }, date: '2026-01-01' });
    localStorage.setItem('he_bb_plan_saved', saved);
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Вставить коррекции в план/ }));
    const after = JSON.parse(localStorage.getItem('he_bb_plan_saved') || '{}');
    const injected = (after.plan.weeks || []).flatMap((w: any) => w.sessions || []).flatMap((s: any) => s.exercises || [])
      .filter((e: any) => String(e.comment || '').includes('ББ-диагностика'));
    expect(injected.length).toBeGreaterThan(0);
    expect(localStorage.getItem('he_bb_plan_saved_prev')).toBe(saved);
    // аудит перечитал план: покрытие головок обновилось без remount
    expect(screen.getAllByText(/Покрытие головок планом/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/✓ chest_upper/)[0]).toBeInTheDocument();
    // откат возвращает исходник
    fireEvent.click(screen.getByRole('button', { name: /Откатить вставку/ }));
    expect(localStorage.getItem('he_bb_plan_saved')).toBe(saved);
    expect(localStorage.getItem('he_bb_plan_saved_prev')).toBeNull();
  });
  it('inject writes plan history and snapshot restore works', () => {
    const saved = JSON.stringify({ plan: { weeks: [
      { sessions: [{ day: 1, exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, rir: 2, role: 'primary' }] }] },
    ] }, date: '2026-01-01' });
    localStorage.setItem('he_bb_plan_saved', saved);
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Вставить коррекции в план/ }));
    const hist = JSON.parse(localStorage.getItem('he_bb_plan_history') || '[]');
    expect(hist.length).toBe(1);
    expect(hist[0].label).toMatch(/до вставки/);
    expect(screen.getAllByText(/Журнал плана/)[0]).toBeInTheDocument();
    // правим план вручную, затем восстанавливаем снимок
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: { weeks: [] } }));
    fireEvent.click(screen.getAllByText(/Восстановить/)[0]);
    const restored = JSON.parse(localStorage.getItem('he_bb_plan_saved') || '{}');
    expect(restored.plan.weeks.length).toBe(1);
    expect(restored.plan.weeks[0].sessions[0].exercises[0].exerciseName).toBe('bench_bar');
  });
  it('inject without plan shows hint, does not crash', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Вставить коррекции в план/ }));
    expect(screen.getAllByText(/Нет плана ББ/)[0]).toBeInTheDocument();
  });
  it('worst-in-plan button selects lowest-scored exercise', () => {
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ weeks: [{ sessions: [{ exercises: [
      { exerciseName: 'tricep_pushdown_rope', name: 'Разгибание на блоке', muscle: 'triceps', sets: 3, rir: 2 },
      { exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 3, rir: 2 },
    ] }] }] }));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Упражнения/ }));
    fireEvent.click(screen.getByRole('button', { name: /Худшее в плане/ }));
    // плоский жим мимо верха (wrongHead −14) — хуже блока
    expect(screen.getAllByText(/Худшее в плане: Жим штанги лёжа/)[0]).toBeInTheDocument();
  });
  it('worst-in-plan without plan shows hint, does not crash', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Упражнения/ }));
    fireEvent.click(screen.getByRole('button', { name: /Худшее в плане/ }));
    expect(screen.getAllByText(/Нет плана ББ/)[0]).toBeInTheDocument();
  });
  it('weak zone without old diary shows low-data badge instead of silence', () => {
    localStorage.setItem('he_workout_log_v1', JSON.stringify([
      { date: '2026-08-21', exercises: [{ muscleGroup: 'chest', sets: [{ weightKg: 100, reps: 8 }] }] },
      { date: '2026-08-22', exercises: [{ muscleGroup: 'chest', sets: [{ weightKg: 100, reps: 8 }] }] },
    ]));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    expect(screen.getAllByText(/мало данных/)[0]).toBeInTheDocument();
  });
  it('HTML export runs unified batch without throwing', () => {
    const now = new Date().toISOString().slice(0, 10);
    localStorage.setItem('he_workout_log_v1', JSON.stringify([
      { date: now, exercises: [{ muscleGroup: 'chest', sets: [{ weightKg: 50, reps: 10 }] }] },
    ]));
    (URL as any).createObjectURL = () => 'blob:mock';
    (URL as any).revokeObjectURL = () => {};
    const clickSpy = (..._a: any[]) => {};
    const origCreate = document.createElement.bind(document);
    (document as any).createElement = ((tag: string, ...rest: any[]) => {
      const el = origCreate(tag, ...rest) as any;
      if (tag === 'a') el.click = clickSpy;
      return el;
    }) as any;
    try {
      render(<BBDiagnosticsHub />);
      fireEvent.click(screen.getAllByText('Верх груди')[0]);
      fireEvent.click(screen.getByRole('button', { name: /Печать/ }));
      expect(screen.getAllByText(/HTML экспорт/)[0]).toBeInTheDocument();
    } finally {
      (document as any).createElement = origCreate;
    }
  });
  it('P1: L/R-карточка показывает слабую сторону из унилатерального дневника', () => {
    const s = (n: number) => Array.from({ length: n }, () => ({ weightKg: 20, reps: 10 }));
    localStorage.setItem('he_workout_log_v1', JSON.stringify([
      { date: '2026-09-01', exercises: [{ muscleGroup: 'biceps', side: 'left', sets: s(5) }, { muscleGroup: 'biceps', side: 'right', sets: s(2) }] },
    ]));
    render(<BBDiagnosticsHub />);
    expect(screen.getAllByText(/Слабее: правая/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/добивка \+25%/)[0]).toBeInTheDocument();
  });
  it('P2/P3: готовность и красные флаги; стоп блокирует вставку', () => {
    const saved = JSON.stringify({ plan: { weeks: [
      { sessions: [{ day: 1, exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, rir: 2, role: 'primary' }] }] },
    ] }, date: '2026-01-01' });
    localStorage.setItem('he_bb_plan_saved', saved);
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Восстановление/ }));
    expect(screen.getAllByText(/Готовность: зелёный/)[0]).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Боль сегодня/), { target: { value: '8' } });
    expect(screen.getAllByText(/Готовность: красный/)[0]).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: /Острая боль/ }));
    expect(screen.getAllByText(/вставка объёма заблокирована/)[0]).toBeInTheDocument();
    // вставка заблокирована: план не меняется, снимка нет (возврат на таб Слабых — зоны живут там)
    fireEvent.click(screen.getByRole('button', { name: /Слабые/ }));
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Вставить коррекции в план/ }));
    expect(screen.getAllByText(/Стоп:/)[0]).toBeInTheDocument();
    expect(localStorage.getItem('he_bb_plan_saved')).toBe(saved);
    expect(localStorage.getItem('he_bb_plan_saved_prev')).toBeNull();
  });
  it('P4/P5: петля SRD-бейдж из таблицы траектории + живые углы из таблицы', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Подвижность/)[0]);
    fireEvent.change(screen.getByLabelText(/Таблица траектории/), { target: { value: 't,x,y\n0,0,0\n0.1,5,10\n0.2,8,20' } });
    expect(screen.getAllByText(/Петля 8 см/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/порог 4\/6 см/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/черновик.*таз/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Таблица углов/), { target: { value: 't,hip,knee,ankle,shoulder\n0,90,80,40,170\n0.1,92,82,42,172' } });
    expect(screen.getAllByText(/Средние:/)[0]).toBeInTheDocument();
  });
  it('P6: стимул без дубля углов — ссылка на Упражнения', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Стимул/ }));
    expect(screen.getAllByText(/Детали углов и строгих групп/)[0]).toBeInTheDocument();
  });
  it('PRO-2: печать несёт L/R + готовность + флаги (тост с PRO-2)', () => {
    const s = (n: number) => Array.from({ length: n }, () => ({ weightKg: 20, reps: 10 }));
    localStorage.setItem('he_workout_log_v1', JSON.stringify([
      { date: '2026-09-01', exercises: [{ muscleGroup: 'biceps', side: 'left', sets: s(5) }, { muscleGroup: 'biceps', side: 'right', sets: s(2) }] },
    ]));
    (URL as any).createObjectURL = () => 'blob:mock';
    (URL as any).revokeObjectURL = () => {};
    const origCreate = document.createElement.bind(document);
    (document as any).createElement = ((tag: string, ...rest: any[]) => {
      const el = origCreate(tag, ...rest) as any;
      if (tag === 'a') el.click = () => {};
      return el;
    }) as any;
    try {
      render(<BBDiagnosticsHub />);
      fireEvent.click(screen.getAllByText('Верх груди')[0]);
      fireEvent.click(screen.getByRole('button', { name: /Печать/ }));
      expect(screen.getAllByText(/PRO-2/)[0]).toBeInTheDocument();
    } finally {
      (document as any).createElement = origCreate;
    }
  });
  it('PRO-3: карточка скорости/сухожилий видна, LVP пустой — честная строка', () => {
    render(<BBDiagnosticsHub />);
    expect(screen.getAllByText(/PRO-3 — скорость/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/LVP пуст/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Плечо: порядок/)[0]).toBeInTheDocument();
  });
  it('PRO-3: LVP-точки дают валидный профиль в карточке', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/LVP-точки вес скорость/), { target: { value: '100 0.62\n110 0.55\n120 0.47' } });
    expect(screen.getAllByText(/e1RM ≈/)[0]).toBeInTheDocument();
  });
  it('PRO-3: цель VBT меняет совет + ICS-кнопка на месте', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByTestId('bb-vbt-goal'));
    fireEvent.click(screen.getAllByText('Сила')[0]);
    expect(screen.getByTestId('bb-vbt-goal').textContent).toMatch(/Сила/);
    expect(screen.getByRole('button', { name: /Спец-блок \(.ics\)/ })).toBeInTheDocument();
  });
});
