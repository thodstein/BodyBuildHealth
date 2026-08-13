import { describe, expect, it, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { PlDeadpointsBarPathCard } from '../PlDeadpointsBarPathCard';
import { CYCLE_01 } from '../../../../data/lms-cycles/cycle-01';

afterEach(cleanup);

describe('PlDeadpointsBarPathCard (единый калькулятор движения)', () => {
  it('рендерится с 7 движениями и заголовком', () => {
    const html = renderToStaticMarkup(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    expect(html).toContain('Мёртвые точки');
    expect(html).toContain('Слабые точки');
    expect(html).toContain('Движение штанги');
    expect(html).toContain('Присед');
    expect(html).toContain('Жим лёжа');
  });

  it('рендерится без template (дефолтный протокол)', () => {
    const html = renderToStaticMarkup(<PlDeadpointsBarPathCard dayCount={3} />);
    expect(html).toContain('Мёртвые точки');
  });

  it('авто-выбирает первую фазу движения и сразу показывает секцию упражнений', () => {
    const html = renderToStaticMarkup(<PlDeadpointsBarPathCard />);
    // Для squat первая фаза — «Низ (выход из ямы)» (авто-выбор, русская подпись)
    expect(html).toContain('Низ (выход из ямы)');
    expect(html).toContain('Средняя точка');
    expect(html).toContain('Упражнения (из раскладки цикла');
  });

  it('выбор фазы работает: смена фазы обновляет секцию диагностики', () => {
    render(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    const select = screen.getByText('Фаза (срыв / слабое место)').parentElement?.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    // Выбираем «Дожим» (lockout)
    fireEvent.change(select, { target: { value: 'lockout' } });
    expect(select.value).toBe('lockout');
    // «Дожим» встречается в select и в заголовке диагноза — проверяем блок диагноза
    expect(screen.getAllByText('Дожим').length).toBeGreaterThanOrEqual(2);
    // Секция диагноза обновилась: для lockout приседа показывается причина фазы
    expect(screen.getByText(/слабые мышцы/i)).toBeTruthy();
  });

  it('выбор движения работает: смена движения меняет доступные фазы', () => {
    render(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    fireEvent.click(screen.getByText('Жим лёжа'));
    const select = screen.getByText('Фаза (срыв / слабое место)').parentElement?.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('off_chest');
    expect(screen.getAllByText('Сход со груди').length).toBeGreaterThanOrEqual(2);
  });

  it('показывает подсказку из дневника о частых срывах в фазе', () => {
    const sessions = [{
      sessionId: 's1', date: '2026-08-10', exercises: [{
        exerciseId: 'squat_1', exerciseName: 'Приседания со штангой', pattern: 'squat', muscleGroup: 'legs', order: 0,
        sets: [
          { setNumber: 1, weightKg: 100, reps: 3, rpe: 9, rir: 1, isPR: false, notes: '' },
          { setNumber: 2, weightKg: 100, reps: 2, rpe: 9.5, rir: 0.5, isPR: false, notes: '' },
        ], totalVolume: 500, best1RM: 110, avgRPE: 9.2,
      }], totalVolume: 500, totalSets: 2, totalReps: 5, avgIntensity: 90, prCount: 0, notes: '',
    }];
    render(<PlDeadpointsBarPathCard sessions={sessions as any} />);
    // Тяжёлые подходы (RPE≥8) по 2-3 повтора → фаза «Дожим» (lockout)
    expect(screen.getByText(/2 из 2 тяжёлых подходов/)).toBeTruthy();
    expect(screen.getByText(/срываются в фазе «Дожим»/)).toBeTruthy();
  });

  it('SVG-схема отображается для движения с отклонениями', () => {
    render(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    expect(document.querySelector('svg')).toBeTruthy();
  });

  it('содержит кнопки добавления в ПЛ-авто и фокус-группу', () => {
    render(<PlDeadpointsBarPathCard />);
    expect(screen.getByText(/Добавить выбранные упражнения в ПЛ-авто/)).toBeTruthy();
    expect(screen.getByText(/Сохранить фокус-группу/)).toBeTruthy();
  });
});
