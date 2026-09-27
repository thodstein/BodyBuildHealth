import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { StrongmanDiagnosticsHub } from '../StrongmanDiagnosticsHub';

beforeEach(() => {
  localStorage.clear();
  (HTMLCanvasElement.prototype as any).getContext = vi.fn(() => null);
});

describe('StrongmanDiagnosticsHub corrective + top nav', () => {
  it('верхняя навигация: 7 табов + применить, дубль шапки внизу удалён', () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    expect(container.querySelector('[data-sm="bottom-nav"]')).toBeNull();
    const top = container.querySelector('[data-sm="top-nav"]');
    expect(top).toBeTruthy();
    expect((top as HTMLElement).style.position).not.toBe('sticky');
    for (const id of ['press', 'carry', 'load', 'grip', 'mobility', 'video', 'correction']) {
      expect(top!.querySelector(`[data-sm="top-tab-${id}"]`)).toBeTruthy();
    }
    expect(top!.querySelector('[data-sm="top-apply"]')).toBeTruthy();
  });
  it('таб Коррекция: пустое состояние без фаз', () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    expect(document.body.textContent).toContain('Выбери 1–4 слабые фазы');
  });
  it('таб Коррекция: фаза → причина → топ с дозой/кью/прогрессией + сессия + волна', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-card"]')).toBeTruthy());
    const card = document.body.textContent || '';
    expect(card).toContain('Доза:');
    expect(card).toContain('Кью:');
    expect(card).toContain('Прогрессия:');
    expect(card).toContain('Источник:');
    expect(document.body.querySelector('[data-sm="corr-session"]')).toBeTruthy();
    expect(document.body.querySelector('[data-sm="corr-block"]')).toBeTruthy();
  });
  it('карточка упражнения: без плана Δ-симуляции нет (не выдумываем) — доза/кью/прогрессия/регресс есть', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(container.querySelector('[data-sm="corr-row"]')).toBeTruthy());
    expect(container.textContent).toContain('Доза:');
    expect(container.textContent).toContain('Регресс:');
    expect(container.querySelector('[data-sm="corr-sim"]')).toBeNull();
  });

  it('карточка упражнения: при реальном плане показывает Δ-симуляцию (вес/тоннаж/покрытие) из движка', async () => {
    localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify({
      workMax: { deadlift: 180, front_squat: 140, press: 90 },
      weeksData: [
        { deload: false, sessions: [{ exercises: [{ name: 'log_press', sets: 4, reps: 5 }] }] },
        { deload: false, sessions: [{ exercises: [{ name: 'log_press', sets: 4, reps: 5 }] }] },
      ],
    }));
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(container.querySelector('[data-sm="corr-sim"]')).toBeTruthy());
    const sim = (container.querySelector('[data-sm="corr-sim"]') as HTMLElement).textContent || '';
    expect(sim).toContain('Симуляция:');
    expect(sim).toContain('покрытие');
    // честная привязка к движку: симуляция не выдумывает — без плана её нет (проверено тестом выше)
    expect(sim).not.toContain('NaN');
  });
  it('кнопка коррекции пишет мост с smCorrections', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    const btn = await screen.findByText(/Коррекцию в Стронг/);
    fireEvent.click(btn);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    expect(localStorage.getItem('he_planner_apply')).toContain('smCorrections');
  });
  it('хинт Видео: sway 4см → топ-упражнение + переход в Коррекцию', async () => {
    localStorage.setItem('he_strongman_diagnostics_hub_v1', JSON.stringify({ swayCm: '4' }));
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(container.querySelector('[data-sm="top-tab-video"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-video"]')).toBeTruthy());
    expect(document.body.textContent).toContain('yoke_walk →');
    fireEvent.click(screen.getByText(/Открыть Коррекцию/));
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-tab"]')).toBeTruthy());
  });
  it('хинт асимметрии: L/R 100/90 → слабее справа + добивка', async () => {
    localStorage.setItem('he_strongman_diagnostics_hub_v1', JSON.stringify({ leftMax: '100', rightMax: '90' }));
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(container.querySelector('[data-sm="top-tab-mobility"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-split"]')).toBeTruthy());
    expect(document.body.textContent).toContain('Слабее справа');
  });
  it('хинт мобильности: OHS 2 провала → щадящие дозы + переход', async () => {
    localStorage.setItem('he_strongman_diagnostics_hub_v1', JSON.stringify({ ohsKneeValgus: true, ohsHipBelowParallel: false }));
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(container.querySelector('[data-sm="top-tab-mobility"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-mobility"]')).toBeTruthy());
    expect(document.body.textContent).toContain('щадящие дозы');
  });
  it('⭐: клик ставит предпочитаемую, персист и мост несут smPreferredCorr', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    const stars = await screen.findAllByText('☆');
    expect(stars.length).toBeGreaterThan(0);
    fireEvent.click(stars[0]);
    await waitFor(() => expect(screen.getAllByText('⭐').length).toBeGreaterThan(0));
    expect(localStorage.getItem('he_sm_preferred_corr_v1')).toContain('sm_log');
    const btn = await screen.findByText(/Коррекцию в Стронг/);
    fireEvent.click(btn);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    expect(localStorage.getItem('he_planner_apply')).toContain('smPreferredCorr');
    expect(localStorage.getItem('he_planner_apply')).toContain('smCorrectiveDetail');
  });
  it('P1: замер sway 6см → RU-теги ошибок в Коррекции', async () => {
    localStorage.setItem('he_strongman_diagnostics_hub_v1', JSON.stringify({ swayCm: '6' }));
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-errtags"]')).toBeTruthy());
    expect(document.body.textContent).toContain('Качание');
  });
  it('P4/P6: волна с дозой причины — строки с sm_ id и @%', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-block-lines"]')).toBeTruthy());
    const txt = document.body.querySelector('[data-sm="corr-block-lines"]')?.textContent || '';
    expect(txt).toMatch(/sm_log/);
    expect(txt).toMatch(/@/);
  });
  it('D2: фильтры подбора — уровень персистится, зал режет топ (ROUND-9: 5→3)', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-filters"]')).toBeTruthy());
    // было: 3 (в фазе было ровно 3 записи) → стало 5: ROUND-9 добил пул фазы до 5 вариантов
    expect(document.body.querySelectorAll('[data-sm="corr-row"]').length).toBe(5);
    fireEvent.click(screen.getByText('Штанга'));
    // было: 2 → стало 3: из 5 кандидатов под штангу проходят 3 (выбор шире)
    await waitFor(() => expect(document.body.querySelectorAll('[data-sm="corr-row"]').length).toBe(3));
    fireEvent.click(screen.getByText('Новичок'));
    expect(screen.getByText('Новичок').getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('he_strongman_diagnostics_hub_v1')).toContain('corrLevel');
    const applyBtn = await screen.findByText(/Коррекцию в Стронг/);
    fireEvent.click(applyBtn);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    expect(localStorage.getItem('he_planner_apply')).toContain('smCorrEquipment');
  });
  it('ROUND-10: превью моста — что уедет в конструктор (фазы/⭐/сессия/блок)', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="bridge-preview"]')).not.toBeNull());
    expect(document.body.querySelector('[data-sm="bridge-preview"]')!.textContent).toContain('Что уедет в конструктор');
    await waitFor(() => expect(document.body.querySelector('[data-sm="bridge-preview"]')!.textContent).toMatch(/Фазы: /));
    const t = document.body.querySelector('[data-sm="bridge-preview"]')!.textContent || '';
    expect(t).toMatch(/Предпочтения \(⭐\): /);
    expect(t).toMatch(/Сессия: /);
    expect(t).toMatch(/Блок: \d+ нед/);
  });
  it('O1: фильтр без совпадений — честная нота вместо пустой карточки', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-row"]')).toBeTruthy());
    fireEvent.click(screen.getByText('Свой вес'));
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-empty-phase"]')).toBeTruthy());
    expect(document.body.textContent).toContain('ослабь фильтры');
  });
  it('ROUND-10: слабые по дневнику читаются из ЖИВОГО ключа he_workout_log_v2', () => {
    const ago = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const sess = (date: string, sessionId: string, w: number) => ({
      sessionId, date, focus: 'strongman',
      exercises: [{ exerciseId: 'yoke_walk', exerciseName: 'Yoke Walk', sets: [{ weightKg: w, reps: 5, rpe: 9 }] }],
    });
    localStorage.setItem('he_workout_log_v2', JSON.stringify([sess(ago(40), 'a', 200), sess(ago(3), 'b', 150)]));
    const { container } = render(<StrongmanDiagnosticsHub />);
    expect(container.textContent).toContain('📓 Дневник:');
  });
  it('ROUND-10: превью моста честно помечает фазу без вариантов под фильтр зала', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="bridge-preview"]')).toBeTruthy());
    await waitFor(() => expect(document.body.querySelector('[data-sm="bridge-preview"]')!.textContent).toMatch(/Фаза → упражнение: /));
    fireEvent.click(screen.getByText('Свой вес'));
    await waitFor(() => expect(document.body.querySelector('[data-sm="bridge-preview"]')!.textContent).toMatch(/⊘ нет вариантов под фильтр/));
  });
  it('C5: асимметрия + grip-фаза → мост несёт smUnilateral', async () => {
    localStorage.setItem('he_strongman_diagnostics_hub_v1', JSON.stringify({ gripWeak: ['grip'], leftMax: '100', rightMax: '90' }));
    render(<StrongmanDiagnosticsHub />);
    const btns = screen.getAllByText(/Применить в Стронг/);
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    const raw = localStorage.getItem('he_planner_apply') || '';
    expect(raw).toContain('smUnilateral');
    expect(raw).toContain('farmers_grip');
  });
  it('C6: мост несёт smWaveSets волны', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    const btns = screen.getAllByText(/Применить в Стронг/);
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    const raw = localStorage.getItem('he_planner_apply') || '';
    expect(raw).toContain('smWaveSets');
  });
});

/** Каркас и визуал стронг-хаба должны совпадать с ТА-хабом (тот же порядок секций и та же палитра). */
describe('хаб стронга: каркас и визуал 1-в-1 с ТА', () => {
  const HUB_SRC = (): string => fs.readFileSync(
    path.join(process.cwd(), 'src', 'ui', 'screens', 'TrainingScreen_parts', 'StrongmanDiagnosticsHub.tsx'),
    'utf-8',
  );

  it('каркас 1-в-1 с ТА: герой → ряд табов + «Применить» → контент → настройки недели/года → нижний ряд (без своего фона)', () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    // 1 — герой (счёт + чипы + как пользоваться) — в ТА это верхняя карточка
    expect(container.querySelector('[data-sm="hero"]')).toBeTruthy();
    // 2 — ряд табов, «Применить» В ТОМ ЖЕ ряду (marginLeft:auto — как в ТА)
    const nav = container.querySelector('[data-sm="top-nav"]')!;
    expect(nav.querySelector('[data-sm="top-apply"]')).toBeTruthy();
    expect(HUB_SRC()).toMatch(/data-sm="top-apply"[\s\S]{0,220}marginLeft: 'auto'/);
    // 3 — в ТА НЕТ отдельного заголовка «Итог»: настройки недели/года идут своей секцией
    expect(container.querySelector('[data-sm="year-settings"]')).toBeTruthy();
    expect(container.querySelector('[data-sm="result-head"]')).toBeNull();
    // 4 — нижний ряд действий: применить + весь экспорт В ОДНОМ ряду
    const bar = container.querySelector('[data-sm="action-bar"]')!;
    expect(bar).toBeTruthy();
    expect(bar.querySelector('[data-sm="apply-bottom"]')).toBeTruthy();
    for (const hook of ['export-html', 'export-csv', 'export-ics', 'export-annual', 'export-backup', 'export-restore']) {
      expect(bar.querySelector(`[data-sm="${hook}"]`), hook).toBeTruthy();
    }
    // НИЗ = обычный flex-ряд: в ТА у него НЕТ своего фона/кромки (паритет, а не «своя панель»)
    const barSrc = HUB_SRC().slice(HUB_SRC().indexOf('data-sm="action-bar"'), HUB_SRC().indexOf('data-sm="apply-bottom"'));
    expect(barSrc).not.toMatch(/background/);
    expect(barSrc).not.toMatch(/border:/);
    // панель — последняя значимая секция (ниже только счётчик хранилища и закрытие корня)
    expect(bar.nextElementSibling?.getAttribute('data-sm')).toBeNull();
  });

  it('визуал ТА: синий акцент #3b82f6 + градиент 135° #3b82f6→#a855f7, без янтарного в хроме', () => {
    const src = HUB_SRC();
    // фокус-поля/кнопки — синий (ТА), не янтарный
    expect(src).toContain('border-color:rgba(59,130,246,0.65)');
    expect(src).toContain('outline:2px solid rgba(59,130,246,0.70)');
    // герой — сине-фиолетовый (ТА), не красно-янтарный
    expect(src).toContain("background: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(168,85,247,0.08))'");
    expect(src).toContain("background: 'linear-gradient(135deg,#3b82f6,#a855f7)'");
    // активный таб — ПЛОСКИЙ синий (как в ТА: rgba(59,130,246,0.14) + #3b82f6 + 600), не градиент
    expect(src).toMatch(/borderColor: tab === t\.id \? '#3b82f6'/);
    expect(src).toContain("background: tab === t.id ? 'rgba(59,130,246,0.14)' : '#0a1629'");
    expect(src).toContain("color: tab === t.id ? '#3b82f6' : '#fff'");
    expect(src).toContain("fontWeight: tab === t.id ? 600 : 700");
    // оба «Применить» — градиент ТА; верхний radius 10 (как в ТА), нижний flex:1
    expect(src).toMatch(/background: 'linear-gradient\(135deg,#3b82f6,#a855f7\)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 12/);
    expect(src).toMatch(/data-sm="apply-bottom"[\s\S]{0,400}linear-gradient\(135deg,#3b82f6,#a855f7\)/);
    expect(src).toMatch(/data-sm="apply-bottom"[\s\S]{0,300}borderRadius:10, background:'linear-gradient\(135deg,#3b82f6,#a855f7\)', color:'#fff', border:'none', fontWeight:800, fontSize:13/);
    // выбор упражнения (⭐) — индиго, не янтарный
    expect(src).toContain('linear-gradient(135deg, rgba(59,130,246,0.18), rgba(168,85,247,0.08))');
    expect(src).toContain('2px solid rgba(59,130,246,0.7)');
    expect(src).toContain("color: sel ? '#93c5fd' : '#fff'");
    // ghost-экспорт = ТА-стиль (0.06 фон / 0.12 кромка), не янтарный/прозрачный
    expect(src).toContain("background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)'");
    // хрома ТА (таб/кнопки/экспорт/герой) не должна вернуться в янтарный/красный
    for (const hook of ['top-tab-', 'top-apply', 'apply-bottom', 'export-', 'year-settings']) {
      const i = src.indexOf(hook);
      expect(i, hook).toBeGreaterThan(-1);
    }
    expect(src).not.toMatch(/data-sm="top-apply"[\s\S]{0,200}#f59e0b/);
    expect(src).not.toMatch(/data-sm="apply-bottom"[\s\S]{0,300}239,68,68/);
    // нижний ряд — как в ТА: без своей подложки/кромки (кнопки несут стили сами)
    const barTail = src.slice(src.indexOf('data-sm="action-bar"'), src.indexOf('data-sm="apply-bottom"'));
    expect(barTail).not.toMatch(/background/);
    expect(barTail).not.toMatch(/border:/);
  });

  it('полный хром ТА: ни одного не-TA цвета вне семантики (янтарь/красный/зелёный/фиолет = только статус)', () => {
    const src = HUB_SRC();
    // 1) старые navy-поверхности вымерли полностью
    expect(src).not.toMatch(/rgba\(22,30,52/);
    // #0f1c33 — не токен ТА (TA-карточка #0a1629): в прошлом раунде я сам называл его «блоком ТА»
    expect(src).not.toMatch(/#0f1c33/);
    // rgba(140,190,255) остался только как ручка шита — и это значение ТА (arm-design.css .ad-sheet-handle)
    expect(src).not.toMatch(/rgba\(140,190,255,0\.(1[0-9]|2[0-9])/);
    expect((src.match(/rgba\(140,190,255,0\.30\)/g) || []).length).toBe(2);
    const taSheet = fs.readFileSync(
      path.join(process.cwd(), 'src', 'ui', 'screens', 'TrainingScreen_parts', 'arm-design.css'),
      'utf-8',
    );
    expect(taSheet).toContain('rgba(140, 190, 255, 0.3)');
    // 2) не-TA градиенты кнопок вымерли, остался только TA 135° #3b82f6→#a855f7
    for (const g of ['#f59e0b,#ef4444', '#a855f7,#6366f1', '#16a34a,#30d158', '#0a84ff,#30d158']) {
      expect(src, g).not.toContain(g);
    }
    expect((src.match(/linear-gradient\(135deg,#3b82f6,#a855f7\)/g) || []).length).toBeGreaterThanOrEqual(12);
    // 3) янтарный фокус/рамка возврата в хром не вернулись
    expect(src).not.toMatch(/border-color:rgba\(245,158,11/);
    expect(src).not.toMatch(/outline:2px solid rgba\(245,158,11/);
    expect(src).not.toMatch(/checked \? 'rgba\(245,158,11/);
    // 4) все 4 селектора слабых фаз — синяя TA-гамма (не красный/янтарный/зелёный/фиолетовый)
    for (const g of ['#ef4444\', \'#1f3a5f', '#f59e0b\', \'#1f3a5f', '#22c55e\', \'#1f3a5f', '#a855f7\', \'#1f3a5f']) {
      expect(src, g).not.toContain(`borderColor: on ? '${g}`);
    }
    expect((src.match(/borderColor: on \? '#3b82f6' : '#1f3a5f'/g) || []).length).toBeGreaterThanOrEqual(4);
    // 5) все акценты секционных заголовков и полосы карточек — синие
    const accents = [...src.matchAll(/smSectionHeader\('[^']*',\s*'(#[0-9a-fA-F]{6})'\)/g)].map((m) => m[1]);
    expect(accents.length).toBeGreaterThanOrEqual(14);
    for (const a of accents) expect(a, a).toBe('#3b82f6');
    for (const b of [...src.matchAll(/borderLeft:'3px solid (#[0-9a-fA-F]{6})'/g)].map((m) => m[1])) {
      expect(b, b).toBe('#3b82f6');
    }
    // 6) filter-чипы и звёздочка выбора упражнения — синий TA (не #f5b04c)
    expect(src).not.toContain('#f5b04c');
    expect(src).toMatch(/borderColor: smPrefCorr\[wp as string\] === c\.id \? '#3b82f6'/);
  });

  it('видео в стронге: ручные замеры остались, Kinovea-импорт удалён (2026-09-27)', () => {
    const src = HUB_SRC();
    // CSV-разбор и его состояния убраны из хаба
    expect(src).not.toMatch(/parseKinoveaCSV/);
    expect(src).not.toMatch(/analyzeBarTracking/);
    expect(src).not.toMatch(/handleCsvParse/);
    expect(src).not.toMatch(/csvText/);
    expect(src).not.toMatch(/Разобрать Kinovea CSV/);
    // но ручной контур на месте: качание, скорость, Энод, гониометр
    expect(src).toMatch(/swayCm/);
    expect(src).toMatch(/correctEnodeByVariable/);
    expect(src).toMatch(/diagnoseCarrySway/);
    expect(src).toMatch(/StrongmanVideoGoniometer/);
    // таб «Видео» остаётся в навигации (id через шаблон `top-tab-${t.id}`)
    const { container } = render(<StrongmanDiagnosticsHub />);
    expect(container.querySelector('[data-sm="top-tab-video"]')).toBeTruthy();
    // и сам движок CSV не тронут (инструмент остаётся доступен внешним потребителям)
    const eng = fs.readFileSync(
      path.join(process.cwd(), 'src', 'engines', 'strength-sport', 'strength-sport-video.engine.ts'),
      'utf-8',
    );
    expect(eng.length).toBeGreaterThan(500);
  });
});
