import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

describe('BBDiagnosticsHub', () => {
  beforeEach(() => { localStorage.clear(); });
  it('legacy-стор v1 с удалёнными ключами грузится без краша (миграция спредом)', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({
      weakManual: ['chest_upper'],
      vbtBest: '0.85', vbtLast: '0.62', vbtWeight: '80', csvText: 't,x,y', poseCsvText: 't',
      lvpText: '100 0.6', lvpLift: 'squat', vbtGoal: 'mass', elbowPain: true,
      mmcLoadPct: '60', annualBlockKey: 'b1', posingIso: true, age: '30', cyclePhase: 'luteal',
    }));
    render(<BBDiagnosticsHub />);
    expect(screen.getAllByText(/Движения ББ — диагностика/)[0]).toBeInTheDocument();
    // ручной выбор из легаси-стора подхвачен
    expect(screen.getAllByText('Верх груди')[0].getAttribute('aria-pressed')).toBe('true');
    // удалённые вводы в UI отсутствуют
    expect(screen.queryByLabelText(/LVP-точки/)).toBeNull();
    expect(screen.queryByTestId('bb-vbt-goal')).toBeNull();
  });
  it('renders header and tabs', () => {
    render(<BBDiagnosticsHub />);
    expect(screen.getAllByText(/Движения ББ — диагностика/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Слабые/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Пропорции/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Скрининг/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Стимул-карта/)[0]).toBeInTheDocument();
  });
  it('нагрузка/объём не дублируются: табов восстановления и объёма нет, только ссылки', () => {
    render(<BBDiagnosticsHub />);
    expect(screen.queryByRole('button', { name: /Восстановление/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Объём/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Подвижность/ })).toBeNull();
    expect(screen.getAllByText(/Смежные хабы/)[0]).toBeInTheDocument();
    expect(document.querySelector('[data-bb="recovery-tab"]')).toBeNull();
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
  it('screening OHS toggle and apply to profile', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
    const card = screen.getByRole('switch', { name: /Пятки плоско/ });
    expect(card.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(card);
    expect(screen.getByRole('switch', { name: /Пятки плоско/ }).getAttribute('aria-checked')).toBe('false');
  });
  it('screening driver: подпятка чинит — драйвер голеностоп', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Пятки плоско/ }));
    fireEvent.click(screen.getByText('Стало лучше'));
    expect(screen.getAllByText(/Драйвер: Голеностоп/)[0]).toBeInTheDocument();
  });
  it('screening single-leg: слабее левая + снимок/дельта', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
    fireEvent.click(screen.getByTestId('bb-split-l'));
    fireEvent.click(screen.getAllByText('Гуляет')[0]);
    expect(screen.getAllByText(/слабее левая/)[0]).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Снимок сегодня/ }));
    expect(screen.getAllByText(/Снимок скрининга/)[0]).toBeInTheDocument();
  });
  it('exercise tab renders 5 sections', () => {
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ weeks: [{ sessions: [
      { exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, rir: 2 }] },
      { exercises: [{ exerciseName: 'incline_db', name: 'Жим гантелей на наклонной (30°)', muscle: 'chest', sets: 3, rir: 2 }] },
    ] }] }));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Разбор/ }));
    expect(screen.getAllByText(/упражнение \+ техника/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Аудит портфеля по мышцам/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Диагноз упражнения/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Библиотека упражнений/)[0]).toBeInTheDocument();
  });
  it('exercise tab without plan shows empty-state, no crash', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Разбор/ }));
    expect(screen.getAllByText(/Нет плана ББ/)[0]).toBeInTheDocument();
  });
  it('exercise select and reset do not crash', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Разбор/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /Разбор/ }));
    // выбираем упражнение из портфеля плана
    const chips = Array.from(document.querySelectorAll('[title*="SFR"]'));
    const target = chips.find((el) => /блок/i.test(el.getAttribute('title') || ''));
    expect(target).toBeTruthy();
    fireEvent.click(target!);
    // чипы отклонений из записи стимула (кнопки, не подпись поля)
    const dev = screen.getByRole('button', { name: /локти вперёд/ });
    fireEvent.click(dev);
    expect(dev.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByText(/нагрузку забирают соседи/)[0]).toBeInTheDocument();
    // повторный клик снимает тап и флаг
    fireEvent.click(screen.getByRole('button', { name: /локти вперёд/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /Разбор/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /Разбор/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /Разбор/ }));
    fireEvent.click(screen.getByRole('button', { name: /Худшее в плане/ }));
    // плоский жим мимо верха (wrongHead −14) — хуже блока
    expect(screen.getAllByText(/Худшее в плане: Жим штанги лёжа/)[0]).toBeInTheDocument();
  });
  it('worst-in-plan without plan shows hint, does not crash', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Разбор/ }));
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
  it('P2/P3: восстановление живёт в Интеллекте — в хабе только ссылка-гейт, вставка не блокируется скринингом', () => {
    const saved = JSON.stringify({ plan: { weeks: [
      { sessions: [{ day: 1, exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, rir: 2, role: 'primary' }] }] },
    ] }, date: '2026-01-01' });
    localStorage.setItem('he_bb_plan_saved', saved);
    render(<BBDiagnosticsHub />);
    // ссылок-карточка смежных хабов видна прямо на Слабых
    expect(screen.getAllByText(/Смежные хабы/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Интеллект/)[0]).toBeInTheDocument();
    // острая боль как флаг вставки осталась в гейте инъекции (не табом)
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Вставить коррекции в план/ }));
    const after = JSON.parse(localStorage.getItem('he_bb_plan_saved') || '{}');
    expect(JSON.stringify(after)).toContain('ББ-диагностика');
  });
  it('P4/P5: скрининг без VBT/видео-таблиц — только драйвер и ссылки', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
    expect(screen.getAllByText(/Драйвер:/)[0]).toBeInTheDocument();
    expect(screen.queryByLabelText(/Таблица траектории/)).toBeNull();
    expect(screen.queryByLabelText(/Таблица углов/)).toBeNull();
    expect(screen.queryByLabelText(/LVP-точки/)).toBeNull();
    expect(screen.getAllByText(/Анализ силы/)[0]).toBeInTheDocument();
  });
  it('P6: стимул-карта — по мышцам с починить-строками', () => {
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ weeks: [{ sessions: [{ exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 6, rir: 2 }] }] }] }));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Стимул-карта/ }));
    expect(screen.getAllByText(/Стимул-карта — где теряется рост/)[0]).toBeInTheDocument();
    expect(document.querySelector('[data-bb="stimulus-map"]')).not.toBeNull();
  });
  it('PRO-2: печать несёт L/R + скрининг-драйвер (тост движений)', () => {
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
      expect(screen.getAllByText(/движения/)[0]).toBeInTheDocument();
    } finally {
      (document as any).createElement = origCreate;
    }
  });
  it('нагрузка вынесена: скорости/сухожилий/LVP-калькулятора в хабе нет', () => {
    render(<BBDiagnosticsHub />);
    expect(screen.queryByText(/PRO-3 — скорость/)).toBeNull();
    expect(screen.queryByLabelText(/LVP-точки вес скорость/)).toBeNull();
    expect(screen.queryByTestId('bb-vbt-goal')).toBeNull();
    expect(screen.getAllByText(/Смежные хабы/)[0]).toBeInTheDocument();
  });
  it('спец-блок ICS + годовой план на месте (движения)', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    expect(screen.getByRole('button', { name: /Спец-блок \(.ics\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /в годовой план/ })).toBeInTheDocument();
  });
  it('стоп-флаги вставки: острая боль блочит вставку, план цел', () => {
    const saved = JSON.stringify({ plan: { weeks: [
      { sessions: [{ day: 1, exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, rir: 2, role: 'primary' }] }] },
    ] }, date: '2026-01-01' });
    localStorage.setItem('he_bb_plan_saved', saved);
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    const chip = document.querySelector('[data-bb="stop-flag"][aria-label="Острая боль"]');
    expect(chip).not.toBeNull();
    fireEvent.click(chip!);
    expect(chip!.getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByText(/Стоп:/)[0]).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Вставить коррекции в план/ }));
    expect(localStorage.getItem('he_bb_plan_saved')).toBe(saved);
    expect(localStorage.getItem('he_bb_plan_saved_prev')).toBeNull();
  });
  it('пол и сон берутся из профиля, своих селектов в хабе нет', () => {
    localStorage.setItem('he_profile_v2', JSON.stringify({ settings: { personal: { sex: 'female' }, lifestyle: { sleepHours: 7 } } }));
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ weeks: [{ sessions: [{ exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, rir: 2, role: 'primary' }] }] }] }));
    render(<BBDiagnosticsHub />);
    expect(screen.queryByTestId('bb-sex')).toBeNull();
    expect(screen.queryByLabelText(/Сон, часов/)).toBeNull();
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('button', { name: /В ББ-авто/ }));
    const payload = JSON.parse(localStorage.getItem('he_planner_apply') || '{}');
    expect(payload.kind).toBe('weakpoints');
    expect(payload.data.sleepHours).toBe(7);
  });
  it('флип стороны в истории — добивка не фиксируется (шум измерения)', () => {
    const s = (n: number) => Array.from({ length: n }, () => ({ weightKg: 20, reps: 10 }));
    localStorage.setItem('he_workout_log_v1', JSON.stringify([
      { date: '2026-09-01', exercises: [{ muscleGroup: 'biceps', side: 'left', sets: s(2) }, { muscleGroup: 'biceps', side: 'right', sets: s(5) }] },
    ]));
    localStorage.setItem('he_bb_lr_history', JSON.stringify([
      { date: '2026-08-01', group: 'biceps', weakSide: 'left', asymPct: 15, verdict: 'topup' },
      { date: '2026-08-08', group: 'biceps', weakSide: 'right', asymPct: 14, verdict: 'topup' },
      { date: '2026-08-15', group: 'biceps', weakSide: 'left', asymPct: 16, verdict: 'topup' },
    ]));
    render(<BBDiagnosticsHub />);
    expect(screen.getAllByText(/шум измерения/)[0]).toBeInTheDocument();
    // в мост уехал watch без добивки
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('button', { name: /В ББ-авто/ }));
    const payload = JSON.parse(localStorage.getItem('he_planner_apply') || '{}');
    const bic = (payload.data.lrVerdicts as any[]).find((v) => v.group === 'biceps');
    expect(bic.verdict).toBe('watch');
    expect(bic.topUpSets).toBe(0);
  });
  it('стабильная сторона ≥3 замеров — добивка сохраняется', () => {
    const s = (n: number) => Array.from({ length: n }, () => ({ weightKg: 20, reps: 10 }));
    localStorage.setItem('he_workout_log_v1', JSON.stringify([
      { date: '2026-09-01', exercises: [{ muscleGroup: 'biceps', side: 'left', sets: s(2) }, { muscleGroup: 'biceps', side: 'right', sets: s(5) }] },
    ]));
    localStorage.setItem('he_bb_lr_history', JSON.stringify([
      { date: '2026-08-01', group: 'biceps', weakSide: 'right', asymPct: 15, verdict: 'topup' },
      { date: '2026-08-08', group: 'biceps', weakSide: 'right', asymPct: 14, verdict: 'topup' },
      { date: '2026-08-15', group: 'biceps', weakSide: 'right', asymPct: 16, verdict: 'topup' },
    ]));
    render(<BBDiagnosticsHub />);
    expect(screen.queryByText(/шум измерения/)).toBeNull();
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('button', { name: /В ББ-авто/ }));
    const payload = JSON.parse(localStorage.getItem('he_planner_apply') || '{}');
    const bic = (payload.data.lrVerdicts as any[]).find((v) => v.group === 'biceps');
    expect(bic.verdict).toBe('topup');
    expect(bic.topUpSets).toBeGreaterThan(0);
  });
  it('FPPA tiebreak: чистая качественная + разрыв ≥10° — слабая сторона угломером', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
    fireEvent.click(screen.getByTestId('bb-split-l'));
    fireEvent.click(screen.getAllByText('Чисто')[0]);
    fireEvent.click(screen.getByTestId('bb-split-r'));
    fireEvent.click(screen.getAllByText('Чисто')[0]);
    fireEvent.change(screen.getByTestId('bb-fppa-l'), { target: { value: '18' } });
    fireEvent.change(screen.getByTestId('bb-fppa-r'), { target: { value: '6' } });
    expect(screen.getAllByText(/угломер/)[0]).toBeInTheDocument();
  });
  it('КТС L/R: разрыв ≥2 см — асимметрия в драйвере', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
    fireEvent.change(screen.getByTestId('bb-ktw-l'), { target: { value: '6' } });
    fireEvent.change(screen.getByTestId('bb-ktw-r'), { target: { value: '13' } });
    fireEvent.click(screen.getByRole('switch', { name: /Корпус вертикально/ }));
    expect(document.querySelector('[data-bb="driver-card"]')!.textContent).toMatch(/асимметрия/);
  });
  it('legacy КТС-одиночка мигрирует в обе стороны', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ kneeToWallCm: '7' }));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
    expect((screen.getByTestId('bb-ktw-l') as HTMLInputElement).value).toBe('7');
    expect((screen.getByTestId('bb-ktw-r') as HTMLInputElement).value).toBe('7');
  });
  it('гонометр + наклон корпуса — драйвер голеностоп в карточке', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
    fireEvent.change(screen.getByTestId('bb-ankle-deg'), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('switch', { name: /Корпус вертикально/ }));
    expect(document.querySelector('[data-bb="driver-card"]')).not.toBeNull();
    expect(document.querySelector('[data-bb="driver-card"]')!.textContent).toMatch(/Голеностоп/);
  });
  it('старому снимку >42 дней — бейдж перепроверки', () => {
    const old = new Date(Date.now() - 50 * 86400000).toISOString().slice(0, 10);
    localStorage.setItem('he_bb_screen_history', JSON.stringify([{ date: old, fails: ['heels'] }]));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
    expect(screen.getAllByText(/пора перепроверить/)[0]).toBeInTheDocument();
  });
  it('мост несёт MMC-строку из карточки', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('button', { name: /В ББ-авто/ }));
    const payload = JSON.parse(localStorage.getItem('he_planner_apply') || '{}');
    expect(typeof payload.data.mmc).toBe('string');
    expect(payload.data.mmc).toMatch(/фокус/);
  });
  it('мост несёт движения (movementDriver/singleLeg), без нагрузки', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
    fireEvent.click(screen.getByText('Стало лучше'));
    fireEvent.click(screen.getByRole('button', { name: /Слабые/ }));
    fireEvent.click(screen.getByRole('button', { name: /В ББ-авто/ }));
    const raw = localStorage.getItem('he_planner_apply');
    expect(raw).toBeTruthy();
    const payload = JSON.parse(raw || '{}');
    expect(payload.kind).toBe('weakpoints');
    expect(payload.data.movementDriver).toBeTruthy();
    expect(payload.data.movementDriver.driver).toBe('ankle');
    expect(payload.data.singleLeg).toBeTruthy();
    expect(payload.data.ohs).toBeTruthy();
    expect(payload.data.lrVerdicts).toBeTruthy();
    expect('readiness' in payload.data).toBe(false);
    expect('redFlags' in payload.data).toBe(false);
    expect('lvp' in payload.data).toBe(false);
    expect('tendon' in payload.data).toBe(false);
    expect('returnTo' in payload.data).toBe(false);
    expect('workingRange' in payload.data).toBe(false);
  });
  it('PRO-3 добивка: спец-блок уходит в конфиг BB-блока года', () => {
    localStorage.setItem('he_annual_training_plan_v1', JSON.stringify({
      id: 'y1', version: 1, totalWeeks: 12, direction: 'bb', macroRef: null, status: 'draft',
      createdAt: '2026-01-01', updatedAt: '2026-01-01',
      blocks: [{ ref: { blockKey: 'b1', blockIndex: 0, kind: 'BB', phase: 'hypertrophy', startWeek: 1, weeks: 8 }, config: {}, status: 'unbuilt' }],
    }));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('button', { name: /в годовой план/ }));
    const saved = JSON.parse(localStorage.getItem('he_annual_training_plan_v1') || '{}');
    expect(saved.blocks[0].config.specialization).toBe(true);
    expect(saved.blocks[0].config.weakPoints).toContain('chest');
    expect(screen.getAllByText(/в годовой план/)[0]).toBeInTheDocument();
  });
});
