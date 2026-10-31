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

    // Точки с временем → не одна линия, а heatmap по скорости.
    expect(container.querySelector('[data-lift="bar-heat"]'), 'heatmap скорости').toBeTruthy();
    expect(container.querySelectorAll('[data-lift="bar-heat"] line').length).toBeGreaterThan(1);
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
    // overlay двух повторов = 2 полилинии; основная серия теперь heatmap (line).
    expect(container.querySelectorAll('polyline').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('[data-lift="bar-heat"]')).toBeTruthy();
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

  it('склейка повторов: два одиночных файла дают overlay «первый vs последний»', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const area = container.querySelector('[data-lift="kinovea-text"]') as HTMLTextAreaElement;
    const addToSeries = () => click(container.querySelector('[data-lift="rep-series-add"]'));

    // Файл №1 — один повтор: серия из 1, overlay ещё не строится.
    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([0.8]) } }); });
    addToSeries();
    expect(container.querySelector('[data-lift="rep-series"]'), 'блок серии').toBeTruthy();
    expect(container.querySelectorAll('[data-lift="rep-series-item"]').length).toBe(1);
    expect(container.querySelector('[data-lift="rep-overlay"]')).toBeNull();
    expect(container.textContent).toContain('Серия повторов: 1');

    // Файл №2 — ещё один повтор: серия из 2 → overlay появляется.
    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([1.0]) } }); });
    addToSeries();
    expect(container.querySelectorAll('[data-lift="rep-series-item"]').length).toBe(2);
    const overlay = container.querySelector('[data-lift="rep-overlay"]');
    expect(overlay, 'overlay из склеенной серии').toBeTruthy();
    expect(overlay!.textContent).toContain('Повторы: 2');
    // Перенумерация: чипы идут П1, П2.
    const chips = Array.from(container.querySelectorAll('[data-lift="rep-series-item"]')).map(c => c.textContent || '');
    expect(chips[0].startsWith('П1')).toBe(true);
    expect(chips[1].startsWith('П2')).toBe(true);
  });

  it('склейка повторов: удаление одного и очистка серии убирают overlay', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const area = container.querySelector('[data-lift="kinovea-text"]') as HTMLTextAreaElement;
    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([0.8]) } }); });
    click(container.querySelector('[data-lift="rep-series-add"]'));
    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([1.0]) } }); });
    click(container.querySelector('[data-lift="rep-series-add"]'));
    expect(container.querySelector('[data-lift="rep-overlay"]')).toBeTruthy();

    // Удалили повтор №1 → остался один, overlay честно пропадает.
    click(container.querySelector('[aria-label="Удалить повтор 1"]'));
    expect(container.querySelectorAll('[data-lift="rep-series-item"]').length).toBe(1);
    expect(container.querySelector('[data-lift="rep-overlay"]')).toBeNull();

    click(container.querySelector('[data-lift="rep-series-clear"]'));
    expect(container.querySelector('[data-lift="rep-series"]')).toBeNull();
  });

  it('склейка повторов: файл без полного повтора не попадает в серию', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const area = container.querySelector('[data-lift="kinovea-text"]') as HTMLTextAreaElement;
    // Монотонный подъём без спуска — повтора нет.
    act(() => { fireEvent.change(area, { target: { value: 'time,x,y\n0,0,0\n0.1,1,10\n0.2,2,20\n0.3,3,30' } }); });
    click(container.querySelector('[data-lift="rep-series-add"]'));
    expect(container.querySelector('[data-lift="rep-series"]')).toBeNull();
    expect(container.textContent).toContain('не нашёл полный повтор');
  });

  it('качество съёмки: бейдж честно меняется по метаданным и персистится', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const badge = () => container.querySelector('[data-lift="capture-quality"]')!.textContent || '';
    // Без метаданных — unknown.
    expect(badge()).toContain('Нет метаданных');

    click(container.querySelector('[data-lift="capture-side-front"]'));
    expect(badge()).toContain('Вид спереди');

    // Сбоку + высота 3 м → камера высоко.
    click(container.querySelector('[data-lift="capture-side-left"]'));
    const height = container.querySelector('[data-lift="capture-height"]') as HTMLInputElement;
    act(() => { fireEvent.change(height, { target: { value: '3' } }); });
    expect(badge()).toContain('Камера высоко');

    // Допустимая геометрия → ok.
    act(() => { fireEvent.change(height, { target: { value: '1.2' } }); });
    const dist = container.querySelector('[data-lift="capture-dist"]') as HTMLInputElement;
    act(() => { fireEvent.change(dist, { target: { value: '3' } }); });
    expect(badge()).toContain('в допуске');

    const saved = JSON.parse(localStorage.getItem(MASTER_KEY) || '{}');
    expect(saved.capture).toEqual({ heightM: '1.2', distM: '3', side: 'left', device: '' });
  });

  it('экспорт траектории (SVG) доступен рядом с HTML/CSV/поделиться', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const svgBtn = container.querySelector('[data-lift="export-svg"]') as HTMLButtonElement;
    expect(svgBtn, 'кнопка SVG').toBeTruthy();
    expect(svgBtn.getAttribute('aria-label')).toContain('SVG');
    expect(svgBtn.disabled).toBe(false);
  });

  it('быстрый старт виден, пока ничего не заполнено, и скрывается навсегда', () => {
    const { container, unmount } = render(<LiftMasterCard sessions={[]} />);
    const quick = container.querySelector('[data-lift="quick-start"]');
    expect(quick, 'панель быстрого старта').toBeTruthy();
    expect(quick!.textContent).toContain('3 шага');
    expect(container.querySelectorAll('[data-lift="quick-start"] button').length).toBeGreaterThanOrEqual(3);

    click(container.querySelector('[data-lift="quick-start-hide"]'));
    expect(container.querySelector('[data-lift="quick-start"]')).toBeNull();
    expect(localStorage.getItem('he_lift_master_onboard_v1')).toBe('1');

    // Повторный заход — панель больше не мозолит глаза.
    unmount();
    const second = render(<LiftMasterCard sessions={[]} />);
    expect(second.container.querySelector('[data-lift="quick-start"]')).toBeNull();
  });

  it('быстрый старт не показывается, если данные уже есть (фаза / VBT / видео)', () => {
    localStorage.setItem(MASTER_KEY, JSON.stringify({ lift: 'bench', phase: 'off_chest' }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    expect(container.querySelector('[data-lift="quick-start"]')).toBeNull();
  });

  it('шаг «VBT» из быстрого старта раскрывает блок и показывает поле замера', () => {
    localStorage.setItem('he_lift_master_collapsed_v1', JSON.stringify({ sec6: true }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    expect(container.querySelector('[data-lift="vbt-metric"]')).toBeNull();
    click(container.querySelector('[data-lift="quick-start-2"]'));
    expect(container.querySelector('[data-lift="vbt-metric"]'), 'VBT раскрыт шагом').toBeTruthy();
  });

  it('серия повторов запоминается и даёт сравнение с прошлой сессией', () => {
    const { container, unmount } = render(<LiftMasterCard sessions={[]} />);
    const area = container.querySelector('[data-lift="kinovea-text"]') as HTMLTextAreaElement;
    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([0.8, 0.9]) } }); });
    click(container.querySelector('[data-lift="parse-kinovea"]'));

    expect(container.querySelector('[data-lift="session-compare"]'), 'до сохранения сравнения нет').toBeNull();
    click(container.querySelector('[data-lift="series-save"]'));

    const saved = JSON.parse(localStorage.getItem(MASTER_KEY) || '{}');
    expect(saved.series?.bench).toBeTruthy();
    const store = saved.series.bench;
    expect(store.reps.length).toBe(2);
    expect(store.reps[0].points.length).toBeLessThanOrEqual(24);
    expect(typeof store.savedAt).toBe('number');

    const cmp = container.querySelector('[data-lift="session-compare"]');
    expect(cmp, 'блок сравнения сессий').toBeTruthy();
    expect(cmp!.textContent).toContain('Прошлая сессия');

    // Наложение прошлой и текущей траектории.
    click(container.querySelector('[data-lift="session-overlay-toggle"]'));
    expect(container.querySelector('[data-lift="session-overlay"]')).toBeTruthy();

    // «Забыть прошлую» удаляет серию из персиста.
    click(container.querySelector('[data-lift="series-forget"]'));
    expect(container.querySelector('[data-lift="session-compare"]')).toBeNull();
    const after = JSON.parse(localStorage.getItem(MASTER_KEY) || '{}');
    expect(after.series?.bench).toBeUndefined();
    unmount();
  });

  it('сравнение сессий переживает перезаход (серия в MasterState)', () => {
    const snapshot = {
      savedAt: Date.now() - 86_400_000,
      reps: [{
        index: 1, vmax: 0.6, xLoop: 2, amplitude: 40,
        points: [[0, 0], [0, 20], [0.5, 40], [6, 20], [0, 0]],
      }],
    };
    localStorage.setItem(MASTER_KEY, JSON.stringify({ lift: 'bench', series: { bench: snapshot } }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const cmp = container.querySelector('[data-lift="session-compare"]');
    expect(cmp, 'прошлая сессия восстановлена').toBeTruthy();
    expect(cmp!.textContent).toContain('1 повт.');
  });

  it('битый персист серии не ломает хаб (мусор отбрасывается)', () => {
    localStorage.setItem(MASTER_KEY, JSON.stringify({
      lift: 'bench',
      series: { bench: { savedAt: 'oops', reps: [{ vmax: 'x' }, null] }, squat: { savedAt: 1, reps: [] } },
    }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    expect(container.querySelector('[data-lift="session-compare"]')).toBeNull();
    expect(container.querySelector('[data-lift="quick-start"]') || container.textContent).toBeTruthy();
  });

  it('экспорт PNG и видео-оверлея присутствуют и честно отключены без canvas', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    expect(container.querySelector('[data-lift="export-overlay-png"]')).toBeTruthy();
    expect(container.querySelector('[data-lift="export-overlay-video"]')).toBeTruthy();
    expect(container.querySelector('[data-lift="video-overlay-file"]'), 'видео подхода с траекторией').toBeTruthy();
  });

  it('heat-сводка под графиком: цифры, а не только цвет', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const area = container.querySelector('[data-lift="kinovea-text"]') as HTMLTextAreaElement;
    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([0.8]) } }); });
    click(container.querySelector('[data-lift="parse-kinovea"]'));

    const summary = container.querySelector('[data-lift="heat-summary"]');
    expect(summary, 'heat-сводка').toBeTruthy();
    const text = summary!.textContent || '';
    expect(text).toContain('медленных отрезков');
    expect(text).toMatch(/\d+%/);
    expect(text).toContain('минимум скорости на');
  });

  it('поиск по блокам находит и раскрывает нужную секцию', () => {
    // всё свёрнуто — «8 Видео» пуст и по ленте его не найти
    localStorage.setItem('he_lift_master_collapsed_v1', JSON.stringify({ secVideo: true }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    expect(container.querySelector('[data-lift="kinovea-text"]')).toBeNull();

    const input = container.querySelector('[data-lift="hub-search"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    act(() => { fireEvent.change(input, { target: { value: 'видео' } }); });

    const hits = Array.from(container.querySelectorAll('[data-lift="hub-search-hit"]'));
    expect(hits.length, 'результаты поиска').toBeGreaterThan(0);
    const videoHit = hits.find(h => (h.textContent || '').includes('8 Видео'));
    expect(videoHit, 'блок «Видео» в результатах').toBeTruthy();
    click(videoHit!);
    expect(container.querySelector('[data-lift="kinovea-text"]'), 'секция раскрыта поиском').toBeTruthy();
    expect((input as HTMLInputElement).value, 'запрос очищен после перехода').toBe('');
  });

  it('поиск не выдумывает результаты и понимает синонимы', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const input = container.querySelector('[data-lift="hub-search"]') as HTMLInputElement;
    act(() => { fireEvent.change(input, { target: { value: 'kinovea' } }); });
    const hit = container.querySelector('[data-lift="hub-search-hit"]');
    expect(hit!.textContent).toContain('Видео');

    act(() => { fireEvent.change(input, { target: { value: 'zzzz' } }); });
    expect(container.querySelector('[data-lift="hub-search-hit"]')).toBeNull();
    expect(container.textContent).toContain('Ничего не нашлось');
  });

  it('подходы: «Новый подход» и сравнение «подход vs подход»', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const area = container.querySelector('[data-lift="kinovea-text"]') as HTMLTextAreaElement;
    const add = () => click(container.querySelector('[data-lift="rep-series-add"]'));

    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([0.8]) } }); });
    add();
    click(container.querySelector('[data-lift="rep-set-next"]'));
    expect(container.textContent).toContain('подход 2');

    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([1.2]) } }); });
    add();

    expect(container.querySelectorAll('[data-lift="rep-series-item"]').length).toBe(2);
    const series = container.querySelector('[data-lift="rep-series"]')!.textContent || '';
    expect(series).toContain('Подход 1 · 1 повт.');
    expect(series).toContain('Подход 2 · 1 повт.');

    const cmp = container.querySelector('[data-lift="set-compare"]');
    expect(cmp, 'сравнение подходов').toBeTruthy();
    expect(cmp!.textContent).toContain('Подходы 2');
    expect(cmp!.textContent).toMatch(/растёт|падает|держится/);
  });

  it('лимит серии 12 повторов соблюдается и честно сообщается', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const area = container.querySelector('[data-lift="kinovea-text"]') as HTMLTextAreaElement;
    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([0.8, 0.9, 1.0]) } }); });
    for (let i = 0; i < 5; i++) click(container.querySelector('[data-lift="rep-series-add"]'));

    expect(container.querySelectorAll('[data-lift="rep-series-item"]').length).toBe(12);
    expect(container.querySelector('[data-lift="kinovea-msg"]')!.textContent).toContain('лимит');
    expect(container.textContent).toContain('Серия повторов: 12/12');
  });

  it('серия переносится как эталон на другое движение', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const area = container.querySelector('[data-lift="kinovea-text"]') as HTMLTextAreaElement;
    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([0.8, 0.9]) } }); });
    click(container.querySelector('[data-lift="rep-series-add"]'));

    click(container.querySelector('[data-lift="series-copy-squat"]'));
    const saved = JSON.parse(localStorage.getItem(MASTER_KEY) || '{}');
    expect(saved.series?.squat?.reps?.length).toBe(2);

    click(container.querySelector('[data-lift-nav="squat"]'));
    const cmp = container.querySelector('[data-lift="session-compare"]');
    expect(cmp, 'эталон виден в приседе').toBeTruthy();
    expect(cmp!.textContent).toContain('2 повт.');
  });

  it('вес в сохранённой серии пишется и предупреждает о разнице', () => {
    localStorage.setItem(MASTER_KEY, JSON.stringify({
      lift: 'bench',
      vbtWeight: '100',
      series: { bench: { savedAt: Date.now() - 86_400_000, weightKg: 110, reps: [{ index: 1, vmax: 0.6, xLoop: 2, amplitude: 40, points: [[0, 0], [0, 40]] }] } },
    }));
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const warn = container.querySelector('[data-lift="weight-mismatch"]');
    expect(warn, 'предупреждение о разнице веса').toBeTruthy();
    expect(warn!.textContent).toContain('110');
    expect(warn!.textContent).toContain('100');

    // При том же весе предупреждения нет и вес попадает в персист.
    act(() => { fireEvent.change(container.querySelector('[data-lift="kinovea-text"]')!, { target: { value: buildRepCsv([0.8]) } }); });
    click(container.querySelector('[data-lift="rep-series-add"]'));
    expect(container.querySelector('[data-lift="weight-mismatch"]')).toBeTruthy();
    click(container.querySelector('[data-lift="series-save"]'));
    const saved = JSON.parse(localStorage.getItem(MASTER_KEY) || '{}');
    expect(saved.series.bench.weightKg).toBe(100);
  });

  it('масштаб CSV «см на единицу» реально меняет метрики', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    const area = container.querySelector('[data-lift="kinovea-text"]') as HTMLTextAreaElement;
    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([0.8]) } }); });
    click(container.querySelector('[data-lift="parse-kinovea"]'));
    const xLoop1 = Number(/xLoop ([\d.]+) см/.exec(container.querySelector('[data-lift="kinovea-msg"]')!.textContent || '')![1]);

    const scale = container.querySelector('[data-lift="kinovea-scale"]') as HTMLInputElement;
    act(() => { fireEvent.change(scale, { target: { value: '2' } }); });
    click(container.querySelector('[data-lift="parse-kinovea"]'));
    const xLoop2 = Number(/xLoop ([\d.]+) см/.exec(container.querySelector('[data-lift="kinovea-msg"]')!.textContent || '')![1]);
    expect(xLoop2).toBeCloseTo(xLoop1 * 2, 0);
  });

  it('интерактивные элементы хаба не меньше 44 px', () => {
    const { container } = render(<LiftMasterCard sessions={[]} />);
    // «Быстрый старт» исчезает после первых данных — проверяем до заполнения.
    const quickHide = container.querySelector('[data-lift="quick-start-hide"]') as HTMLElement;
    expect(quickHide).toBeTruthy();
    expect(parseFloat(quickHide.style.minHeight || '0')).toBeGreaterThanOrEqual(44);

    const area = container.querySelector('[data-lift="kinovea-text"]') as HTMLTextAreaElement;
    act(() => { fireEvent.change(area, { target: { value: buildRepCsv([0.8, 0.9]) } }); });
    click(container.querySelector('[data-lift="rep-series-add"]'));
    // «Наложить прошлую» появляется только после сохранения серии.
    click(container.querySelector('[data-lift="series-save"]'));

    const selectors = [
      'hub-search', 'kinovea-scale', 'rep-series-add', 'rep-set-next', 'rep-series-clear',
      'series-save', 'session-overlay-toggle', 'capture-side-left',
      'capture-device-phone', 'export-csv', 'export-overlay-video', 'video-overlay-file',
    ];
    for (const sel of selectors) {
      const el = container.querySelector(`[data-lift="${sel}"]`);
      expect(el, sel).toBeTruthy();
      const h = parseFloat((el as HTMLElement).style.minHeight || '0');
      expect(h, `${sel}: minHeight`).toBeGreaterThanOrEqual(44);
    }
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
