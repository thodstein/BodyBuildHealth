/**
 * pl-competition-tab.test.tsx — смоук-тест PLCompetitionTab (мастерская тапера ПЛ,
 * вынесена из SRCBBScreen в отдельную вкладку): рендер панели соревнований,
 * параметров и тренерской карточки.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PLCompetitionTab, type PLCompetitionTabApi } from '../PLCompetitionTab';
import { PLTaperProvider } from '../taper-state';

const api = (): PLCompetitionTabApi => ({
  builtSrc: null,
  setBuiltSrc: () => {},
  onNote: () => {},
  autoRegMode: 'off',
  setAutoRegMode: () => {},
  cycle: {
    peds: [], pedDoses: {}, courseIntensity: 'moderate', pedAuto: false,
    autoRegMode: 'off', autoRegResult: { topSetPctMultiplier: 1, volumeMultiplier: 1, rirShift: 0, deload: false, decisions: [] } as never,
    plCalorieSurplus: 0, plProteinPerKg: 1.8, selectedCycleId: 'c1', pmSquat: 180, pmBench: 120, pmDead: 220,
  },
  coach: {
    buildCtx: () => ({ fatigue: 55, acwr: { ratio: 1.2, zone: 'optimal' as const }, currentWeight: 82, targetWeight: 80, weeksToMeet: 8, weeklyK: 0.01 }),
    applyRecommendation: () => {},
    diarySessions: [],
  },
});

describe('PLCompetitionTab', () => {
  // Факты попыток старта переживают перезагрузку (localStorage) — между тестами их надо чистить.
  beforeEach(() => { try { localStorage.removeItem('he_pl_meet_log'); } catch { /* ignore */ } });

  it('рендерит сезон, параметры и тренерскую карточку', () => {
    render(<PLCompetitionTab api={api()} />);
    expect(screen.getByText(/Соревнования сезона \+ тапер/)).toBeTruthy();
    expect(screen.getByDisplayValue('Соревнование 1')).toBeTruthy();
    expect(screen.getByText(/Стратегия прикидов/)).toBeTruthy();
    expect(screen.getByText(/Подобрать тапер автоматически/)).toBeTruthy();
    expect(screen.getAllByText(/Сгенерировать тапер-план/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Пик-блок на окно/).length).toBeGreaterThan(0);
  });

  it('бейдж готовности старта в сезоне (weeksToStart=8 → 🧠 75%)', () => {
    render(<PLCompetitionTab api={api()} />);
    expect(screen.getByText(/🧠 75%/)).toBeTruthy();
  });

  it('бейдж готовности: старт через 1 нед → 🧠 92% (тапер-окно)', () => {
    const saved = { plMeetList: [{ id: 'm1', name: 'Старт', weeksToStart: 1, fed: 'ipf', plannedPm: {}, strategy: 'balanced' }], plMainMeetId: 'm1' };
    render(<PLTaperProvider saved={saved}><PLCompetitionTab api={api()} /></PLTaperProvider>);
    expect(screen.getByText(/🧠 92%/)).toBeTruthy();
  });

  it('клик по «🎯 Имитация соревнований» реально включает mock meet (P0-1)', () => {
    render(<PLTaperProvider><PLCompetitionTab api={api()} /></PLTaperProvider>);
    const btn = document.querySelector('[data-pl="mock-meet-toggle"]') as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    // До аудита 2026-11 кнопка рисовалась БЕЗ onClick: состояние нельзя было включить из UI.
    expect(btn!.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn!);
    expect(btn!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn!);
    expect(btn!.getAttribute('aria-pressed')).toBe('false');
  });

  it('клик по «🤖 Авто» вызывает api.setAutoRegMode + заметку (реальный переключатель)', () => {
    const calls: string[] = [];
    const notes: string[] = [];
    const a = api();
    a.setAutoRegMode = m => { calls.push(m); };
    a.onNote = m => { notes.push(m); };
    render(<PLCompetitionTab api={a} />);
    fireEvent.click(screen.getByText('🤖 Авто'));
    expect(calls).toEqual(['auto']);
    expect(notes).toEqual(['🔄 Режим авторегуляции: 🤖 Авто']);
  });

  it('активный режим подсвечен: auto → «🤖 Авто» активна, «ВЫКЛ» нет', () => {
    const a = api();
    a.cycle.autoRegMode = 'auto';
    render(<PLCompetitionTab api={a} />);
    const autoBtn = screen.getByText('🤖 Авто');
    expect(autoBtn.style.background).toBe('rgb(96, 165, 250)');
    expect(autoBtn.style.color).toBe('rgb(0, 0, 0)');
    const offBtn = screen.getByText('ВЫКЛ');
    expect(offBtn.style.color).not.toBe('rgb(0, 0, 0)');
  });

  it('активный режим «ВЫКЛ» тоже подсвечен (фон #71717a, текст чёрный)', () => {
    render(<PLCompetitionTab api={api()} />);
    const offBtn = screen.getByText('ВЫКЛ');
    expect(offBtn.style.background).toBe('rgb(113, 113, 122)');
    expect(offBtn.style.color).toBe('rgb(0, 0, 0)');
  });

  it('тумблер «🏋 С тренировками» включает опцию ICS сессий (§5-bis п.4)', () => {
    const a = api();
    // Без плана кнопки выгрузки disabled, но тумблер доступен — он про сессию.
    render(<PLCompetitionTab api={a} />);
    const toggle = screen.getByText(/🏋 С тренировками \(выкл\)/);
    expect((toggle as HTMLButtonElement).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByText(/🏋 С тренировками \(вкл\)/).getAttribute('aria-pressed')).toBe('true');
  });

  it('карточка «Разряд и тотал» (Фаза 6, п.2): без целевых ПМ — честная подсказка', () => {
    render(<PLCompetitionTab api={api()} />);
    const card = document.querySelector('[data-pl="norms-bridge"]');
    expect(card).toBeTruthy();
    expect(card!.textContent).toMatch(/Заполните целевые ПМ/);
  });

  it('карточка «Разряд и тотал»: целевые ПМ → тотал из 3 движений и разряд из справочника', () => {
    const saved = { plTaperPlannedPm: { 'Присед': 200, 'Жим лежа': 140, 'Становая тяга': 240 } };
    render(<PLTaperProvider saved={saved as never}><PLCompetitionTab api={api()} /></PLTaperProvider>);
    const card = document.querySelector('[data-pl="norms-bridge"]');
    expect(card).toBeTruthy();
    const text = card!.textContent || '';
    expect(text).toMatch(/проект 580 кг/);
    expect(text).toMatch(/IPF GL/);
    expect(text).toMatch(/Сверяйте с официальной таблицей/);
  });

  it('селектор «Экипировка» (Фаза 6, п.3) присутствует и меняет таблицу нормативов', () => {
    const saved = { plTaperPlannedPm: { 'Присед': 200, 'Жим лежа': 140, 'Становая тяга': 240 }, plTaperGear: 'single-ply' };
    render(<PLTaperProvider saved={saved as never}><PLCompetitionTab api={api()} /></PLTaperProvider>);
    expect(screen.getAllByText(/Экипировка/).length).toBeGreaterThan(0);
    const card = document.querySelector('[data-pl="norms-bridge"]');
    expect(card).toBeTruthy();
    expect(card!.textContent).toMatch(/Однослой/);
    expect(card!.textContent).toMatch(/экипировка/i);
  });

  it('кнопка «Тапер по сезону» рендерится с числом стартов и disabled без плана', () => {
    render(<PLCompetitionTab api={api()} />);
    const btn = screen.getByText(/Тапер по сезону/);
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('импорт протокола (Фаза 6, п.4): текст → факты попыток → пересчёт 2-й/3-й', () => {
    const plan = {
      template: { meta: { id: 'tp', title: 'Тапер', direction: 'powerlifting', level: 'intermediate', period: 'peak', sessionsPerWeek: 3, weeks: 1, correctionPct: 0.005 } },
      weeks: [{
        week: 1,
        pmRow: { 'Присед': 200 },
        days: [{ exercises: [] }],
        meetWeek: true,
        meetAttempts: {
          strategy: 'balanced',
          lifts: [{ name: 'Присед', opener: 185, second: 192.5, third: 205, target: 205, warmup: [] }],
        },
      }],
    };
    render(<PLTaperProvider saved={{ plTaperPlan: plan } as never}><PLCompetitionTab api={api()} /></PLTaperProvider>);
    const head = [...document.querySelectorAll('button[aria-expanded]')]
      .find(b => /Тапер-план/.test(b.textContent || '')) as HTMLButtonElement | undefined;
    fireEvent.click(head!);
    fireEvent.click(document.querySelector('[data-pl="protocol-import-toggle"]') as HTMLElement);
    const ta = document.querySelector('[aria-label="Текст протокола соревнования"]') as HTMLTextAreaElement;
    expect(ta).toBeTruthy();
    fireEvent.change(ta, { target: { value: 'Присед 1 185 ❌\nПрисед 2 185 ✅' } });
    fireEvent.click(document.querySelector('[data-pl="protocol-import-apply"]') as HTMLElement);
    const log = document.querySelector('[data-pl="protocol-import-log"]');
    expect(log!.textContent).toMatch(/Внесено/);
    // Факт опенера попал в чипы → рекомендация по 3-й (2-я не зачтена? нет: 1-я баранка)
    const advice = document.querySelector('[data-pl="meet-advice"]');
    expect(advice?.textContent).toMatch(/не зачтена/);
  });

  it('сгонка (Фаза 6, п.5): карточка даёт план регидрации, окно переключается 2 ч / 24 ч', () => {
    const saved = { plBw: 82, plTargetBw: 80 };
    render(<PLTaperProvider saved={saved as never}><PLCompetitionTab api={api()} /></PLTaperProvider>);
    const head = [...document.querySelectorAll('button[aria-expanded]')]
      .find(b => /Сгонка на пик-неделе/.test(b.textContent || '')) as HTMLButtonElement | undefined;
    expect(head).toBeTruthy();
    fireEvent.click(head!);
    const rec = document.querySelector('[data-pl="weighin-recovery"]');
    expect(rec).toBeTruthy();
    expect(rec!.textContent).toMatch(/электролит/);
    // Окно по умолчанию — 2 ч (IPF): шаг «за N ч до подхода».
    expect(rec!.textContent).toMatch(/до подхода/);
    // Переключение на 24 ч меняет шаги восстановления.
    const w24 = [...document.querySelectorAll('[data-pl="weighin-window"]')].find(b => /24/.test(b.textContent || '')) as HTMLButtonElement;
    expect(w24).toBeTruthy();
    fireEvent.click(w24);
    const rec24 = document.querySelector('[data-pl="weighin-recovery"]');
    expect(rec24!.textContent).toMatch(/3–8 ч/);
  });

  it('адаптивные попытки (Фаза 6, п.1): факт опенера пересчитывает 2-ю/3-ю и вносится в план', () => {
    const plan = {
      template: { meta: { id: 'tp', title: 'Тапер', direction: 'powerlifting', level: 'intermediate', period: 'peak', sessionsPerWeek: 3, weeks: 1, correctionPct: 0.005 } },
      weeks: [{
        week: 1,
        pmRow: { 'Присед': 200, 'Жим лежа': 140 },
        days: [{ exercises: [] }],
        meetWeek: true,
        meetAttempts: {
          strategy: 'balanced',
          lifts: [{ name: 'Присед', opener: 185, second: 192.5, third: 205, target: 205, warmup: [{ pct: 0.4, weight: 75, reps: 5 }] }],
        },
      }],
    };
    render(<PLTaperProvider saved={{ plTaperPlan: plan } as never}><PLCompetitionTab api={api()} /></PLTaperProvider>);
    const head = [...document.querySelectorAll('button[aria-expanded]')]
      .find(b => /Тапер-план/.test(b.textContent || '')) as HTMLButtonElement | undefined;
    expect(head).toBeTruthy();
    fireEvent.click(head!);
    // Чипы факта есть только на неделе старта/mock.
    expect(document.querySelector('[data-pl="meet-made"]')).toBeTruthy();
    expect(document.querySelector('[data-pl="meet-advice"]')).toBeNull();
    // 1-я попытка не зачтена → 2-я повторяет вес опенера (185), «сброс» запрещён правилами.
    const miss = document.querySelectorAll('[data-pl="meet-miss"]')[0] as HTMLButtonElement;
    fireEvent.click(miss);
    const advice = document.querySelector('[data-pl="meet-advice"]');
    expect(advice?.textContent).toMatch(/не зачтена/);
    expect(advice?.textContent).toMatch(/2-я 185 кг/);
    // Принять рекомендацию → свои прикиды попадают в taperAttemptOverride (печать/экспорт).
    const apply = document.querySelector('[data-pl="meet-apply"]') as HTMLButtonElement | null;
    expect(apply).toBeTruthy();
    fireEvent.click(apply!);
    expect(document.querySelector('[data-pl="attempt-override"]')).toBeTruthy();
  });
});
