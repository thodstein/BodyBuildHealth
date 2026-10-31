import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { LiftMasterCard, exerciseMatchesLift } from '../LiftMasterCard';
import { getPlannerApply, subscribePlannerApply, clearPlannerApply, type PlannerApply } from '../planner-bridge';

const openAll = () => localStorage.setItem('he_lift_master_collapsed_v1', '{}');
const MASTER_KEY = 'he_lift_master_v1';

beforeEach(() => {
  localStorage.clear();
  openAll();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const click = (el: Element | null) => {
  expect(el, 'элемент для клика').toBeTruthy();
  act(() => { fireEvent.click(el as Element); });
};

/**
 * Kinovea-CSV с N повторами (низ→верх→низ). Каждый следующий подъём медленнее —
 * так vmax честно падает от первого повтора к последнему.
 */
function buildRepCsv(upDur: number[], opts?: { amp?: number; downDur?: number; fps?: number }): string {
  const amp = opts?.amp ?? 40;
  const downDur = opts?.downDur ?? 0.8;
  const dt = 1 / (opts?.fps ?? 30);
  const rows: string[] = ['time,x,y'];
  let t = 0;
  const push = (y: number, x: number) => {
    rows.push(`${t.toFixed(3)},${x.toFixed(2)},${y.toFixed(2)}`);
    t += dt;
  };
  push(0, 0);
  for (let i = 0; i < upDur.length; i++) {
    const nUp = Math.max(2, Math.round(upDur[i] / dt));
    for (let k = 1; k <= nUp; k++) push((amp * k) / nUp, (3 * k) / nUp);
    const nDown = Math.max(2, Math.round(downDur / dt));
    for (let k = 1; k <= nDown; k++) push(amp * (1 - k / nDown), 3 * (1 - k / nDown));
  }
  return rows.join('\n');
}

describe('LiftMasterCard — поведение (не только смоук)', () => {
  it('applyAll отправляет в план только упражнения ТЕКУЩЕГО движения', () => {
    localStorage.setItem(MASTER_KEY, JSON.stringify({
      lift: 'bench',
      phase: '',
      issues: [],
      selectedGeom: {
        'bench|technique_geometry|grip': ['Узкий хват'],
        'squat|technique_geometry|stance': ['Низкая стойка', 'Широкая стойка'],
      },
      daysGeom: { 'bench|technique_geometry|grip': [1], 'squat|technique_geometry|stance': [2] },
      selectedDiag: {
        'bench|phase|off_chest': ['Жим с паузой'],
        'squat|phase|bottom': ['Присед с паузой'],
        'chest|upper': ['Жим гантелей на наклонной'],
      },
      daysDiag: { 'squat|phase|bottom': [3] },
    }));

    const seen: PlannerApply[] = [];
    const unsub = subscribePlannerApply((p) => { if (p) seen.push(p); });
    const { container } = render(<LiftMasterCard sessions={[]} />);
    click(container.querySelector('[data-lift="apply-all"]'));
    unsub();

    const limiter = seen.filter(p => p.kind === 'limiter').pop();
    const weak = seen.filter(p => p.kind === 'weakpoints').pop();
    expect(limiter, 'limiter-payload').toBeTruthy();
    expect(weak, 'weakpoints-payload').toBeTruthy();

    const limKeys = Object.keys(limiter!.data.limiterExerciseMap ?? {});
    expect(limKeys).toEqual(['bench|technique_geometry|grip']);
    expect(Object.values(limiter!.data.limiterExerciseMap).flat()).not.toContain('Низкая стойка');

    const diagKeys = Object.keys(weak!.data.diagnosticExerciseMap ?? {});
    expect(diagKeys).toContain('bench|phase|off_chest');
    // Слабая мышца (группа|подгруппа) — безусловная, не привязана к лифту.
    expect(diagKeys).toContain('chest|upper');
    // Чужая фаза приседа в жимовой план не едет.
    expect(diagKeys).not.toContain('squat|phase|bottom');
    expect(weak!.data.diagnosticDayMap).not.toHaveProperty('squat|phase|bottom');

    // Счётчик в футере показывает только текущее движение (1 геометрия + 2 диагностики:
    // фаза жима и слабая мышца груди — они не привязаны к лифту).
    expect(container.textContent).toContain('всего 3');
    expect(container.textContent).toContain('Учтено 3 из 6');
  });

  it('red-flag блокирует вставку: баннер виден, кнопка disabled, payload не пишется', () => {
    clearPlannerApply();
    const { container } = render(<LiftMasterCard sessions={[]} />);
    expect(container.querySelector('[data-lift="red-block-banner"]')).toBeNull();

    const flags = container.querySelectorAll('[data-lift="red-flag"]');
    expect(flags.length).toBeGreaterThan(0);
    click(flags[0]);

    const banner = container.querySelector('[data-lift="red-block-banner"]');
    expect(banner, 'баннер red-flag').toBeTruthy();
    expect(banner!.textContent).toContain('Вставка заблокирована');

    const apply = container.querySelector('[data-lift="apply-all"]') as HTMLButtonElement;
    expect(apply.disabled).toBe(true);

    click(apply);
    expect(getPlannerApply()).toBeNull();
  });

  it('Kinovea CSV: разбор сохраняет результат и рисует траекторию', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const area = container.querySelector('[data-lift="kinovea-text"]') as HTMLTextAreaElement;
    expect(area).toBeTruthy();
    act(() => {
      fireEvent.change(area, { target: { value: 'time,x,y\n0,100,50\n0.05,102,70\n0.1,101,95\n0.15,98,120\n0.2,97,140' } });
    });
    click(container.querySelector('[data-lift="parse-kinovea"]'));

    expect(container.querySelector('polyline'), 'график траектории').toBeTruthy();
    expect(container.textContent).toContain('Наклон штанги из Kinovea');
  });

  it('Kinovea: overlay повторов = первый vs последний, честная потеря скорости', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const area = container.querySelector('[data-lift="kinovea-text"]') as HTMLTextAreaElement;
    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([0.8, 0.9, 1.0]) } }); });
    click(container.querySelector('[data-lift="parse-kinovea"]'));

    const overlay = container.querySelector('[data-lift="rep-overlay"]');
    expect(overlay, 'карточка overlay повторов').toBeTruthy();
    const text = overlay!.textContent || '';
    expect(text).toContain('Повторы: 3');
    expect(text).toContain('первый повтор');
    expect(text).toContain('последний повтор');
    expect(text).toMatch(/заметная потеря скорости|критическая потеря скорости|скорость держится/);
    expect(container.querySelectorAll('polyline').length).toBeGreaterThanOrEqual(3);
  });

  it('Kinovea: один повтор — overlay не выдумывается, а честно поясняется', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const area = container.querySelector('[data-lift="kinovea-text"]') as HTMLTextAreaElement;
    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([0.8]) } }); });
    click(container.querySelector('[data-lift="parse-kinovea"]'));

    expect(container.querySelector('[data-lift="rep-overlay"]')).toBeNull();
    const hint = container.querySelector('[data-lift="rep-overlay-none"]');
    expect(hint, 'пояснение про один повтор').toBeTruthy();
    expect(hint!.textContent).toContain('один повтор');
  });

  it('фаза срыва запоминается по каждому движению при переключении', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const benchPhase = container.querySelector('[data-lift="phase-option"][data-phase="off_chest"]');
    click(benchPhase);
    expect(container.querySelector('[data-lift="phase-option"][data-phase="off_chest"]')!.getAttribute('aria-pressed')).toBe('true');

    // Переключились на присед — фаза жима не должна «протечь».
    click(container.querySelector('[data-lift-nav="squat"]'));
    expect(container.querySelector('[data-lift="phase-option"][data-phase="off_chest"]')).toBeNull();
    click(container.querySelector('[data-lift="phase-option"][data-phase="bottom"]'));
    expect(container.querySelector('[data-lift="phase-option"][data-phase="bottom"]')!.getAttribute('aria-pressed')).toBe('true');

    // Вернулись в жим — выбор восстановлен.
    click(container.querySelector('[data-lift-nav="bench"]'));
    expect(container.querySelector('[data-lift="phase-option"][data-phase="off_chest"]')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('навигация не только скроллит, но и раскрывает свёрнутый блок', () => {
    localStorage.setItem('he_lift_master_collapsed_v1', JSON.stringify({ secAnthro: true, sec6: true }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    expect(container.querySelector('[data-lift="vbt-metric"]')).toBeNull();
    const navVbt = Array.from(container.querySelectorAll('[data-lift="nav-jump"]'))
      .find(b => (b.textContent || '').startsWith('7 '));
    click(navVbt ?? null);
    expect(container.querySelector('[data-lift="vbt-metric"]'), 'тело VBT раскрыто').toBeTruthy();
  });

  it('подсказка из дневника работает для НЕ-жимовых движений (регрессия B3)', () => {
    const sessions = [{
      sessionId: 's1', date: '2026-08-10', exercises: [{
        exerciseId: 'squat_1', exerciseName: 'Приседания со штангой', sets: [
          { weightKg: 140, reps: 2, rpe: 9, rir: 1 },
          { weightKg: 140, reps: 2, rpe: 9.5, rir: 0.5 },
        ],
      }],
    }] as any;
    const { container } = render(<LiftMasterCard sessions={sessions} />);
    click(container.querySelector('[data-lift-nav="squat"]'));
    const text = container.textContent || '';
    expect(text).toContain('Дневник: 2 из 2');
    expect(text).toContain('Низ (выход из ямы)');
    // Сумо-вариант не должен учитываться как классический присед/тяга.
    click(container.querySelector('[data-lift-nav="sumo"]'));
    expect(container.textContent || '').not.toContain('Дневник: 2 из 2');
  });

  it('демо-разбор видео НЕ записывается в VBT, ручной замер — записывается', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    // Демо: скорость есть, но это оценка → VBT пуст, появляется пояснение.
    click(container.querySelector('[data-vc="demo"]'));
    expect(container.querySelector('[data-lift="video-not-measured"]'), 'пояснение про оценку').toBeTruthy();
    let saved = JSON.parse(localStorage.getItem(MASTER_KEY) || '{}');
    expect(saved.vbtLast).toBe('');
    expect(saved.vbtBest).toBe('');

    // Ручной ввод скорости человека — это замер: пишется в VBT, пояснение убирается.
    const velInput = container.querySelector('[data-vc="manual-apply"]')!.parentElement!
      .querySelector('input') as HTMLInputElement;
    act(() => { fireEvent.change(velInput, { target: { value: '0.72' } }); });
    click(container.querySelector('[data-vc="manual-apply"]'));
    saved = JSON.parse(localStorage.getItem(MASTER_KEY) || '{}');
    expect(saved.vbtLast).toBe('0.72');
    expect(saved.vbtBest).toBe('0.72');
    expect(container.querySelector('[data-lift="video-not-measured"]')).toBeNull();
  });

  it('LVP сбрасывается при смене движения (не тащим калибровку чужого лифта)', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const pct = container.querySelectorAll('input[type="number"]');
    // вводим точку LVP через кнопку «+ точка» после заполнения полей
    const labels = Array.from(container.querySelectorAll('label')) as HTMLLabelElement[];
    const pctLabel = labels.find(l => l.textContent?.includes('%1RM'));
    const velLabel = labels.find(l => l.textContent?.includes('Скорость:'));
    expect(pctLabel && velLabel).toBeTruthy();
    const pctInput = pctLabel!.querySelector('input')!;
    const velInput = velLabel!.querySelector('input')!;
    act(() => { fireEvent.change(pctInput, { target: { value: '80' } }); });
    act(() => { fireEvent.change(velInput, { target: { value: '0.6' } }); });
    click(container.querySelector('[data-lift="lvp-add"]'));
    expect(container.textContent).toContain('Точки: 1');

    click(container.querySelector('[data-lift-nav="squat"]'));
    expect(container.textContent).not.toContain('Точки: 1');
    expect(pct).toBeTruthy();
  });
});

describe('exerciseMatchesLift — варианты не смешиваются', () => {
  it('сумо — не классическая тяга, наклонный жим — не жим лёжа', () => {
    expect(exerciseMatchesLift('Становая тяга сумо', 'sumo')).toBe(true);
    expect(exerciseMatchesLift('Становая тяга сумо', 'deadlift')).toBe(false);
    expect(exerciseMatchesLift('Становая тяга классическая', 'deadlift')).toBe(true);
    expect(exerciseMatchesLift('Румынская тяга', 'deadlift')).toBe(false);
    expect(exerciseMatchesLift('Жим лёжа на наклонной скамье', 'incline_press')).toBe(true);
    expect(exerciseMatchesLift('Жим лёжа на наклонной скамье', 'bench')).toBe(false);
    expect(exerciseMatchesLift('Жим лёжа', 'bench')).toBe(true);
    expect(exerciseMatchesLift('Жим штанги стоя', 'ohp')).toBe(true);
    expect(exerciseMatchesLift('Жим штанги стоя', 'bench')).toBe(false);
    expect(exerciseMatchesLift('Фронтальный присед', 'squat')).toBe(false);
    expect(exerciseMatchesLift('Присед со штангой', 'squat')).toBe(true);
    expect(exerciseMatchesLift('Тяга верхнего блока', 'pulldown')).toBe(true);
    expect(exerciseMatchesLift('Тяга верхнего блока', 'row')).toBe(false);
  });
});
