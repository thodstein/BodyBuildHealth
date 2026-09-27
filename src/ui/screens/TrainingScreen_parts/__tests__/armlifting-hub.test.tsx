import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

const HUB_SRC = (): string => fs.readFileSync(
  path.join(process.cwd(), 'src', 'ui', 'screens', 'TrainingScreen_parts', 'ArmliftingDiagnosticsHub.tsx'),
  'utf-8',
);

describe('W-AL UI: хаб армлифтинга', () => {
  it('рендер: замеры + вердикт-хинт без данных', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect(screen.getByLabelText(/RT кг/)).toBeTruthy();
    expect(screen.getByLabelText(/CoC уровень/)).toBeTruthy();
    expect(screen.getByLabelText(/Excalibur кг/)).toBeTruthy();
    expect(document.body.textContent).toContain('Введи замеры');
  });
  it('ROUND-10: годовой overlay спец-блока — кнопка есть, клик кладёт недели года или честно пусто', async () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    const annual = document.body.querySelector('[data-arm="lift-annual"]');
    expect(annual).not.toBeNull();
    const btn = Array.from(annual!.querySelectorAll('button')).find((b) => /В годовой план/.test(b.textContent || ''))!;
    fireEvent.click(btn);
    await waitFor(() => expect(document.body.textContent).toMatch(/Годовой overlay|Спец-блок пуст/));
  });
  it('ROUND-10: ICS спец-блока — кнопка есть, клик даёт честный ответ (календарь/пусто)', async () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    const btn = document.body.querySelector('[data-arm="lift-export-ics"]');
    expect(btn).not.toBeNull();
    fireEvent.click(btn!);
    await waitFor(() => expect(document.body.textContent).toMatch(/Календарь \.ics|Спец-блок пуст/));
  });
  it('ROUND-10: чипы покрытия снарядов — 0/7 без замеров, RT отмечается после ввода', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    const cov = document.querySelector('[data-arm="lift-coverage"]');
    expect(cov).not.toBeNull();
    expect(cov!.textContent).toContain('Покрытие снарядов: 0/7');
    const chips = cov!.querySelectorAll('[data-covered]');
    expect(chips.length).toBe(7);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '100' } });
    const cov2 = document.querySelector('[data-arm="lift-coverage"]')!;
    expect(cov2.textContent).toContain('Покрытие снарядов: 1/7');
    const rt = Array.from(cov2.querySelectorAll('[data-covered]')).find((c) => (c.textContent || '').includes('RT'));
    expect(rt!.getAttribute('data-covered')).toBe('true');
  });
  it('ROUND-10: аудит плана — пусто без плана, покрытие звена с планом + метка дыры', async () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect(document.querySelector('[data-arm="lift-plan-empty"]')).not.toBeNull();
    // apollon_axle — только пул «пальцы» (rolling_thunder закрыл бы и выносливость)
    window.localStorage.setItem('he_arm_plan_saved', JSON.stringify({ plan: { weeks: [{ week: 1, sessions: [{ day: 1, sessionTag: 'GripHeavy', exercises: [{ exerciseId: 'apollon_axle', sets: 4 }] }] }] } }));
    fireEvent(window, new Event('he-arm-plan-saved'));
    await waitFor(() => expect(document.querySelector('[data-arm="lift-plan-empty"]')).toBeNull());
    const card = document.querySelector('[data-arm="lift-plan-audit"]')!;
    expect(card.textContent).toMatch(/покрытие звеньев 1\/5 \(20%\)/);
    const chips = Array.from(card.querySelectorAll('[data-covered]'));
    expect(chips.length).toBe(5);
    expect(chips.filter((c) => c.getAttribute('data-covered') === 'true').length).toBe(1);
    expect(card.querySelectorAll('[data-worst="true"]').length).toBe(1);
  });
  it('паритет с ТА: слабейшая связка закрыта планом → кнопка «разобрать» открывает коррекции', async () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    // Без плана кнопки нет (как data-wl="worst" за planAudit.hasPlan)
    expect(document.querySelector('[data-arm="lift-worst"]')).toBeNull();
    // Все 5 звеньев закрыты (реальные id пулов), у crush — 1 сет: худшая связка покрыта,
    // поэтому показывается «разобрать», а не «дыра»
    window.localStorage.setItem('he_arm_plan_saved', JSON.stringify({ plan: { weeks: [{ week: 1, sessions: [{ day: 1, sessionTag: 'GripHeavy', exercises: [
      { exerciseId: 'plate_pinch_hold', sets: 4 },
      { exerciseId: 'rolling_thunder', sets: 3 },
      { exerciseId: 'wrist_ext_bb', sets: 3 },
      { exerciseId: 'farmer_walk_fat', sets: 2 },
      { exerciseId: 'coc_trainer', sets: 1 },
    ] }] }] } }));
    fireEvent(window, new Event('he-arm-plan-saved'));
    await waitFor(() => expect(document.querySelector('[data-arm="lift-worst"]')).not.toBeNull());
    // «дыра» (0 сетов) остаётся отдельной кнопкой — дубля нет
    expect(document.querySelector('[data-arm="lift-audit-go"]')).toBeNull();
    fireEvent.click(document.querySelector('[data-arm="lift-worst"]')!);
    await waitFor(() => expect(screen.getByText(/Слабейшая связка:.*открыта на разбор/)).not.toBeNull());
  });
  it('RT 65.25 → 50% и вердикт многоборья', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '65.25' } });
    expect(document.body.textContent).toContain('50%');
    expect(document.body.textContent).toContain('Многоборье');
  });
  it('пустой мост — честный тост, без отправки', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText(/В Арм-конструктор/));
    expect(document.body.textContent).toContain('Нечего отправлять');
  });
  it('W5c: кнопки экспорта рендерятся', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect(screen.getByText('🖨 HTML')).toBeTruthy();
    expect(screen.getByText('📥 CSV')).toBeTruthy();
    expect(screen.getByText('🖨 Печать')).toBeTruthy();
  });
  it('W6: сид из арм-хаба при первом входе (своего ключа нет)', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    try {
      localStorage.setItem('he_arm_diagnostics_hub_v4', JSON.stringify({ rtKg: '77', axleKg: '', pinchSec: '', excalKg: '', sex: 'male', bwKg: '90' }));
    } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect((screen.getByLabelText(/RT кг/) as HTMLInputElement).value).toBe('77');
  });
  it('W6: свой ввод приоритетнее сида (свой ключ есть — чужое не затирает)', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    try {
      localStorage.setItem('he_arm_diagnostics_hub_v4', JSON.stringify({ rtKg: '77', sex: 'male', bwKg: '90' }));
      localStorage.setItem('he_armlifting_diag_v1', JSON.stringify({ rtKg: '60', sex: 'male' }));
    } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect((screen.getByLabelText(/RT кг/) as HTMLInputElement).value).toBe('60');
  });
  it('превью плана: что встанет (упражнения + волна) после диагноза', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '100' } });
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.click(screen.getByText('Срыв с пола'));
    const prev = document.querySelector('[data-arm="lift-bridge-preview"]');
    expect(prev).toBeTruthy();
    expect(prev!.textContent).toContain('Что встанет в план');
    expect(prev!.textContent).toContain('Волна');
  });
  it('мост с RT — тост про армлифтинг + трек arm', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '80' } });
    fireEvent.click(screen.getByText(/В Арм-конструктор/));
    expect(document.body.textContent).toContain('армлифтинг');
    expect(localStorage.getItem('he_training_planning_track')).toBe('arm');
  });
});

describe('хаб армлифтинга: каркас и визуал 1-в-1 с ТА', () => {
  it('каркас: герой → ряд табов + «Применить» → итог → нижняя панель (применить + весь экспорт)', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    const { container } = render(<ArmliftingDiagnosticsHub />);
    // 1 — герой (замеры/покрытие/аудит плана/как пользоваться — всё в шапке)
    expect(container.querySelector('[data-arm="lift-head"]')).toBeTruthy();
    expect(container.querySelector('[data-arm="lift-coverage"]')).toBeTruthy();
    expect(container.querySelector('[data-arm="lift-plan-audit"]')).toBeTruthy();
    // 2 — ряд табов с «Применить» В ТОМ ЖЕ ряду (как в ТА-хабе, не отдельной карточкой снизу)
    const tabs = container.querySelector('[data-arm="lift-tabs"]')!;
    expect(tabs).toBeTruthy();
    expect(tabs.querySelector('[data-arm="lift-apply-top"]')).toBeTruthy();
    expect(HUB_SRC()).toMatch(/\[data-arm="lift-tabs"\] \.ad-btn \{ margin-left: auto; \}/);
    // 3 — в ТА НЕТ отдельного заголовка «Итог»: мост-превью идёт своей карточкой «📦 Что уедет»
    expect(container.querySelector('[data-arm="lift-result-head"]')).toBeNull();
    expect(container.querySelector('[data-arm="lift-bridge-preview"]')).toBeTruthy();
    // 4 — нижняя панель действий: применить + весь экспорт
    const bar = container.querySelector('[data-arm="lift-export"]')!;
    expect(bar).toBeTruthy();
    expect(bar.querySelector('[data-arm="lift-apply-bottom"]')).toBeTruthy();
    for (const hook of ['export-html', 'export-csv', 'lift-export-ics', 'export-print', 'lift-annual']) {
      expect(bar.querySelector(`[data-arm="${hook}"]`), hook).toBeTruthy();
    }
    // низ — последняя секция хаба (ниже только закрывающий тег корня)
    expect(bar.nextElementSibling).toBeNull();
  });

  it('визуал ТА: общий root .train-armdiag + синий вместо янтарного в выборе упражнений', () => {
    const src = HUB_SRC();
    // корень тот же, что у арм-хаба → блок §WL-VISUAL-PARITY из arm-design.css применяется автоматически
    expect(src).toContain('rootClass="train-armdiag"');
    // выбор упражнения/коррекции — индиго ТА, не янтарный
    expect(src).toContain('linear-gradient(135deg, rgba(59,130,246,0.18), rgba(168,85,247,0.08))');
    expect(src).toContain("2px solid rgba(59,130,246,0.7)");
    expect(src).toContain('color: sel ? \'#93c5fd\' : \'#fff\'');
    // CTA «Дыра → Коррекция» — градиент ТА
    expect(src).toContain("background: 'linear-gradient(135deg,#3b82f6,#a855f7)'");
    // янтарных остатков в выборе/коррекции быть не должно
    expect(src).not.toMatch(/lift-(corr-row|corr-star|diag-top3|audit-go)[\s\S]{0,600}245,158,11/);
    // поля/треки/тайлы — токены ТА: кромка #1f3a5f, блок #0a1629, поле rgba(255,255,255,0.05)
    expect(src).toMatch(/\[data-arm="lift-tiles"\] \.ad-stat \{[^}]*border: 1px solid #1f3a5f/);
    expect(src).toMatch(/\[data-arm="lift-tiles"\] \.ad-stat \{[^}]*background: #0a1629/);
    expect(src).toMatch(/\.lift-bar \{[^}]*background: #1f3a5f/);
    expect(src).toMatch(/\.lift-num \{[^}]*background: rgba\(255,255,255,0\.05\)/);
    // нижняя панель — та же кромка/тень, что у арм-хаба
    expect(src).toMatch(/\.lift-action-bar \{[^}]*background: none;[^}]*border: 0;[^}]*box-shadow: none/);
    // карточка упражнения показывает поля движка: источник (+разминка, если есть) — как matchReason·source в ТА
    expect(src).toContain('data-arm="lift-corr-source"');
    expect(src).toContain('Источник: {c.source}');
    expect(src).toContain('data-arm="lift-corr-warmup"');
    // 380px: кнопки табов/панели не разъезжаются
    expect(src).toContain('@media (max-width: 380px)');
  });

  it('полный хром ТА: ни одного не-TA цвета поверхности вне семантики', () => {
    const src = HUB_SRC();
    // старые navy/stroke-поверхности вымерли (TA-поля остались как rgba(255,255,255,0.05))
    expect(src).not.toMatch(/rgba\(22,30,52/);
    expect(src).not.toMatch(/rgba\(140,190,255/);
    // не-TA градиенты вымерли
    for (const g of ['#f59e0b,#ef4444', '#a855f7,#6366f1', '#16a34a,#30d158', '#0a84ff,#30d158']) {
      expect(src, g).not.toContain(g);
    }
    // янтарный фокус/рамка в хром не вернулись
    expect(src).not.toMatch(/border-color:rgba\(245,158,11/);
    expect(src).not.toMatch(/outline:2px solid rgba\(245,158,11/);
    // невыбранные чипы покрытия/связности — TA-поверхность + TA-кромка (не стекло 0.04/0.08)
    expect(src).not.toMatch(/'rgba\(255,255,255,0\.04\)'/);
    expect(src).toMatch(/hit \? 'rgba\(34,197,94,0\.12\)' : '#0a1629'/);
    expect(src).toMatch(/border: sel \? '2px solid rgba\(59,130,246,0\.7\)' : '1px solid #1f3a5f'/);
    // ВАЖНО: #0f1c33 — не токен ТА (TA-карточка #0a1629, TA-поле rgba(255,255,255,0.05)).
    // В прошлом раунде я сам назвал его «блоком ТА» и закрепил этим же guard'ом — теперь запрещён.
    expect(src).not.toMatch(/#0f1c33/);
    const taCss = fs.readFileSync(
      path.join(process.cwd(), 'src', 'ui', 'screens', 'TrainingScreen_parts', 'arm-design.css'),
      'utf-8',
    );
    expect(taCss).toContain('--ad-bg: #0a1629;');
    expect(taCss).toContain('--ad-field: rgba(255, 255, 255, 0.05);');
  });

  it('видео в армлифтинге: ручные замеры остались, Kinovea-CSV импорт убран (2026-09-27)', () => {
    const src = HUB_SRC();
    // Флаги по ручным полям (угол/параллельность) остались
    expect(src).toContain('lift-video-flags');
    expect(src).toContain('videoWristDeg');
    expect(src).toContain('videoParallelBad');
    // Kinovea-поверхность в хабе убрана (гард — на интерфейс, а не на слово:
    // честный комментарий «импорт убран» в источнике остаться может)
    expect(src).not.toMatch(/Kinovea CSV/);
    expect(src).not.toMatch(/videoCsv/);
    expect(src).not.toMatch(/<textarea/);
    // и движок разбора CSV не тронут (инструмент остаётся внешним потребителям)
    const eng = fs.readFileSync(
      path.join(process.cwd(), 'src', 'engines', 'arm', 'arm-video-analysis.engine.ts'),
      'utf-8',
    );
    expect(eng.length).toBeGreaterThan(500);
  });
});
