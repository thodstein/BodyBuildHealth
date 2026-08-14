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
    // Все 7 движений — кнопками
    expect(html).toContain('Становая тяга');
    expect(html).toContain('Жим стоя');
    expect(html).toContain('Тяга в наклоне');
    expect(html).toContain('Тяга верхнего блока');
    expect(html).toContain('Жим на наклонной');
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

  it('секции пронумерованы 1 · Слабые точки, 2 · Мёртвые точки, 3 · Движение штанги с движением сверху', () => {
    render(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    expect(screen.getByText('1 · Слабые точки')).toBeTruthy();
    expect(screen.getByText(/2 · Мёртвые точки/)).toBeTruthy();
    // В заголовке секции 3 — выбранное движение (жим лёжа → «3 · Движение штанги (bar-path) · жим лёжа»)
    fireEvent.click(screen.getByText('Жим лёжа'));
    expect(screen.getByText('3 · Движение штанги (bar-path) · Жим лёжа')).toBeTruthy();
  });

  it('упражнения имеют тег источника (⚡ Слабая точка / 🩻 Мёртвая точка / 📈 Bar-path)', () => {
    render(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    // Для squat/bottom в списке фазы есть и ассистенты слабой точки, и PL-пул мёртвой точки
    fireEvent.click(screen.getAllByRole('button', { name: 'Дожим' })[0]);
    expect(screen.getAllByText('🩻 Мёртвая точка').length).toBeGreaterThan(0);
    // Bar-path: включим отклонение — появится тег 📈
    fireEvent.click(screen.getByText('Уход штанги вперёд'));
    expect(screen.getAllByText('📈 Bar-path').length).toBeGreaterThan(0);
  });

  it('выбор фазы работает: клик по чипу обновляет секцию диагностики и упражнения', () => {
    render(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    // Клик по чипу «Дожим» (lockout) — только кнопка (в SVG-зоне текст не кнопка)
    fireEvent.click(screen.getAllByRole('button', { name: 'Дожим' })[0]);
    // «Дожим» встречается в чипах и в заголовке диагноза
    expect(screen.getAllByText('Дожим').length).toBeGreaterThanOrEqual(2);
    // Секция диагноза обновилась: для lockout приседа показывается причина фазы
    expect(screen.getAllByText(/слабые мышцы/i).length).toBeGreaterThan(0);
    // Секция упражнений присутствует
    expect(screen.getByText(/Упражнения \(из раскладки цикла/)).toBeTruthy();
  });

  it('выбор движения работает: смена движения меняет чипы фаз', () => {
    render(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    fireEvent.click(screen.getByText('Жим лёжа'));
    // Для bench авто-фаза — «Сход со груди» (в чипах и в заголовке диагноза)
    expect(screen.getAllByText('Сход со груди').length).toBeGreaterThanOrEqual(2);
  });

  it('для движений без угловой диагностики (ohp/row/pulldown/incline) фазы дают упражнения', () => {
    render(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    fireEvent.click(screen.getByText('Жим стоя'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Середина' })[0]);
    expect(screen.getByText(/Упражнения \(из раскладки цикла/)).toBeTruthy();
    // Переключимся на тягу в наклоне — фаза «Сведение лопаток» тоже даёт упражнения
    fireEvent.click(screen.getByText('Тяга в наклоне'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Сведение лопаток' })[0]);
    expect(screen.getByText(/Упражнения \(из раскладки цикла/)).toBeTruthy();
  });

  it('мёртвые точки дают выбираемые упражнения-коррекции (секция 2)', () => {
    render(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    // squat/bottom — есть угловая диагностика → блок коррекций с кнопками
    expect(screen.getByText(/Упражнения-коррекции \(выберите и добавьте в план\)/)).toBeTruthy();
    expect(screen.getAllByText('➕ Рекомендуемые').length).toBeGreaterThanOrEqual(1);
    // Клик «➕ Все» в коррекциях — счётчик на кнопке отправки растёт
    const allBtns = screen.getAllByText('➕ Все');
    fireEvent.click(allBtns[0]);
    expect(screen.getByText(/Добавить выбранные упражнения в ПЛ-авто \(\d+\)/)).toBeTruthy();
    // Для движений без угловой диагностики — пояснение вместо коррекций
    fireEvent.click(screen.getByText('Жим стоя'));
    expect(screen.getByText(/Угловая диагностика мёртвых точек есть для приседа/)).toBeTruthy();
  });

  it('bar-path отклонение даёт полный набор упражнений (кандидаты групп + пул)', () => {
    render(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    fireEvent.click(screen.getByText('Уход штанги вперёд'));
    expect(screen.getAllByText('📈 Bar-path').length).toBeGreaterThanOrEqual(3);
    // Рекомендуемые/Все для bar-path
    expect(screen.getAllByText('➕ Рекомендуемые').length).toBeGreaterThanOrEqual(1);
  });

  it('блок «Дни добавления» виден сразу (Авто по умолчанию)', () => {
    render(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    expect(screen.getByText('📅 Дни добавления')).toBeTruthy();
    expect(screen.getAllByText(/тяжёлый \+ памп-день/).length).toBeGreaterThanOrEqual(1);
    // Дни Д1..Д3 появляются после выбора упражнения
    fireEvent.click(screen.getAllByRole('button', { name: 'Дожим' })[0]);
    const addButtons = screen.getAllByText('➕');
    expect(addButtons.length).toBeGreaterThan(0);
    fireEvent.click(addButtons[0]);
    expect(screen.getByText('Д1')).toBeTruthy();
    expect(screen.getByText('Д3')).toBeTruthy();
    // Счётчик на кнопке добавления в ПЛ-авто увеличился
    expect(screen.getByText(/Добавить выбранные упражнения в ПЛ-авто \(\d+\)/)).toBeTruthy();
  });

  it('«➕ Слабая точка в план» добавляет точку с днями и счётчик в кнопке отправки', () => {
    render(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    // По умолчанию squat/bottom — добавляем в план
    fireEvent.click(screen.getByText(/Добавить слабую точку в план ПЛ/));
    expect(screen.getByText('🎯 Слабые точки плана (СРЦ)')).toBeTruthy();
    expect(screen.getByText(/Присед · Низ \(выход из ямы\)/)).toBeTruthy();
    // Дни для точки: Д2 + Авто
    fireEvent.click(screen.getByText('Д2'));
    expect(screen.getByText('Д2')).toBeTruthy();
    // Кнопка «убрать» есть
    expect(screen.getByText('✕ убрать')).toBeTruthy();
    // Повторный клик на той же фазе убирает
    fireEvent.click(screen.getByText(/Слабая точка в плане ПЛ — убрать/));
    expect(screen.queryByText('🎯 Слабые точки плана (СРЦ)')).toBeNull();
  });

  it('отправляет plWeakPoints и группы в applyToPlanner', () => {
    const dispatched: any[] = [];
    const origDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = (e: Event) => { if (e instanceof CustomEvent && e.type === 'planner-apply') dispatched.push(e.detail); return origDispatch(e); };
    try {
      render(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
      fireEvent.click(screen.getByText(/Добавить слабую точку в план ПЛ/));
      fireEvent.click(screen.getByText('Д2'));
      fireEvent.click(screen.getByText(/Добавить выбранные упражнения в ПЛ-авто/));
      const payload = dispatched.find((d: any) => d?.kind === 'weakpoints');
      expect(payload).toBeTruthy();
      expect(payload.data.plWeakPoints).toEqual([{ lift: 'squat', weakPoint: 'bottom', days: [2] }]);
      expect(payload.data.groups).toEqual(['legs']);
    } finally {
      window.dispatchEvent = origDispatch;
    }
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
