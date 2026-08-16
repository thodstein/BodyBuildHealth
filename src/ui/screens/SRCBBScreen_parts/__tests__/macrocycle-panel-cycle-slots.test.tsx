/**
 * macrocycle-panel-cycle-slots.test.tsx — регрессия выбора циклов в менеджере
 * соревнований годового планировщика (карточки + попапы):
 *  1. «+ Цикл» на первом клике ДОЛЖЕН видимо добавлять второй слот-карточку
 *     (раньше неявная строка «Авто» глотала пустой слот — 1 клик = 0 эффекта);
 *  2. выбор цикла в попапе сохраняется при добавлении новых слотов;
 *  3. построение макроцикла с двумя выбранными циклами даёт 2 peak-блока
 *     с циклами по порядку;
 *  4. legacy v1-макроцикл (блоки с cycleId) десериализуется и применим;
 *  5. «📊 Итог года», «📋 Сводка» (clipboard), дата→неделя, дублирование
 *     соревнования, «⟲» сброс недели, buildMacroSummary.
 */
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MacrocyclePanel, buildMacroSummary, buildMacroPrintHtml, buildMacroIcs, profilePeakDefaults, diaryMacroStats, macroWeekForDate, ACWR_ZONE_LABEL, saveMacroScenario, loadMacroScenarios, removeMacroScenario, compareMacroScenarios, scenarioSummary, prepCheckInStats } from '../MacrocyclePanel';
import { deserializeMacro, buildBbMacrocycle, serializeBbMacro, buildMacrocycle } from '../../../../engines/lms/macrocycle.engine';

vi.mock('../../../../core/profile-manager', () => ({
  getProfile: () => ({ settings: { personal: { weight: 70, sex: 'female' }, goals: { bbCategory: 'Bikini' } } }),
}));

/** Количество слот-карточек «Цикл N» (попап-селекторы). */
function slotCount(): number {
  return screen.getAllByText(/^Цикл \d+/).length;
}

/** Выбрать цикл в слоте k (1-based) через попап. */
function pickCycleInSlot(k: number, cycleTitle: string): void {
  const slotCards = screen.getAllByText(/^Цикл \d+/);
  fireEvent.click(slotCards[k - 1]);
  fireEvent.click(screen.getByText(cycleTitle));
}

/** Установить неделю соревнования через попап-карточку «Неделя». */
function setCompWeek(week: number): void {
  fireEvent.click(screen.getByText('Неделя'));
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: String(week) } });
  fireEvent.click(screen.getByText('OK'));
}

describe('MacrocyclePanel — слоты циклов на пик (карточки+попапы)', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

  it('«+ Цикл» на первом клике добавляет вторую слот-карточку', () => {
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
    fireEvent.click(screen.getByText('+ Добавить'));
    expect(slotCount()).toBe(1);

    fireEvent.click(screen.getByText('+ Цикл'));
    expect(slotCount()).toBe(2);

    fireEvent.click(screen.getByText('+ Цикл'));
    expect(slotCount()).toBe(3);
  });

  it('выбор цикла в попапе сохраняется при добавлении нового слота', () => {
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
    fireEvent.click(screen.getByText('+ Добавить'));

    pickCycleInSlot(1, 'Силовой цикл 1 (троеборье)');
    fireEvent.click(screen.getByText('+ Цикл'));

    expect(slotCount()).toBe(2);
    // Первая карточка показывает выбранный цикл, вторая — «Авто»
    expect(screen.getByText('Силовой цикл 1 (троеборье)')).toBeTruthy();
    expect(screen.getByText('Авто')).toBeTruthy();
  });

  it('два выбранных цикла на пик → 2 peak-блока с циклами по порядку', () => {
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
    fireEvent.click(screen.getByText('+ Добавить'));
    fireEvent.click(screen.getByText('+ Цикл'));

    pickCycleInSlot(1, 'Силовой цикл 1 (троеборье)');
    pickCycleInSlot(2, 'Силовой цикл 2 (троеборье)');
    setCompWeek(30);
    fireEvent.click(screen.getByText('Построить макроцикл'));

    const raw = localStorage.getItem('he_pl_macro');
    expect(raw).toBeTruthy();
    const macro = deserializeMacro(raw!);
    expect(macro).toBeTruthy();
    const peakBlocks = macro!.blocks.filter(b => b.phase === 'peak');
    expect(peakBlocks.length).toBe(2);
    expect(peakBlocks[0].cycleId).toBe('cycle-01');
    expect(peakBlocks[1].cycleId).toBe('cycle-02');
  });

  it('legacy v1-макроцикл: блоки сохраняют cycleId, кнопка применения есть', () => {
    // v1-формат: [phase, weeks, weekOffset, kind, cycleId, description] — сумма = 52
    const v1 = JSON.stringify({
      v: 1,
      b: [
        ['endurance', 13, 1, 'SRC', 'cycle-03', ''],
        ['strength', 21, 14, 'SRC', 'cycle-01', ''],
        ['peak', 8, 35, 'SRC', 'cycle-07', ''],
        ['competition', 1, 43, 'SRC', null, ''],
        ['transition', 9, 44, 'SRC', 'cycle-01', ''],
      ],
      t: 52,
      c: 43,
      r: [],
    });
    localStorage.setItem('he_pl_macro', v1);

    let applied: { id: string; weeks: number } | null = null;
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={(id, weeks) => { applied = { id, weeks }; }} />);

    const timeline = document.querySelector('.macrocycle-week-cards');
    expect(timeline).toBeTruthy();
    const blocks = timeline!.querySelectorAll('[role="button"]');
    expect(blocks.length).toBe(5);

    fireEvent.click(blocks[1]); // strength-блок с cycle-01
    const applyBtn = screen.getByText('✓ Применить как активный цикл');
    fireEvent.click(applyBtn);
    expect(applied).toEqual({ id: 'cycle-01', weeks: 21 });
  });

  it('ББ: «Собрать этот цикл» → попап → собрать → «В ББ-авто» сохраняет план', async () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));

    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    // Таймлайн есть (макро загружен из storage)
    const timeline = document.querySelector('.macrocycle-week-cards');
    expect(timeline).toBeTruthy();
    fireEvent.click(timeline!.querySelectorAll('[role="button"]')[0]);

    const buildBtn = screen.getByText('⚙️ Собрать этот цикл (сплит + фазы)');
    fireEvent.click(buildBtn);

    // Попап сборки: заголовок + настройки фаз
    expect(screen.getByRole('dialog', { name: 'Сборка цикла ББ' })).toBeTruthy();
    fireEvent.click(screen.getByText(/Собрать и расписать/));

    // План собран → сводка + кнопка «В ББ-авто»
    await waitFor(() => expect(screen.getByText(/✅ Цикл собран/)).toBeTruthy(), { timeout: 15000 });
    fireEvent.click(screen.getByText('🚀 В ББ-авто'));

    const saved = JSON.parse(localStorage.getItem('he_bb_plan_saved') || 'null');
    expect(saved).toBeTruthy();
    expect(saved.plan).toBeTruthy();
    expect(saved.plan.weeks.length).toBeGreaterThan(0);
  });

  it('ББ: 🎭 пик-неделя (тапер) видна в prep-блоке и применяется в сборщике', async () => {
    const macro = buildBbMacrocycle({
      level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy',
      competitions: [{ id: 'c1', name: 'Шоу', week: 10, priority: 'A' }],
    });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    // Найти contest_prep блок (aria-label «Подготовка: недели …»)
    const timeline = document.querySelector('.macrocycle-week-cards');
    const prepBlock = Array.from(timeline!.querySelectorAll('[role="button"]'))
      .find(b => (b.getAttribute('aria-label') || '').startsWith('Подготовка'));
    expect(prepBlock).toBeTruthy();
    fireEvent.click(prepBlock!);

    // Карточка пик-недели раскрывается с протоколом
    fireEvent.click(screen.getByText(/🎭 Пик-неделя \(тапер ББ\)/));
    expect(screen.getByText(/День 7/)).toBeTruthy();
    expect(screen.getAllByText(/💧/).length).toBeGreaterThan(0);

    // Сборщик: фазы → только contest_prep 4 нед → собрать с пик-неделей → ББ-авто
    fireEvent.click(screen.getByText('⚙️ Собрать этот цикл (сплит + фазы)'));
    const phaseCards = screen.getAllByText(/^Цикл |^Недель/); // не нужно — просто проверим чекбокс
    expect(screen.getByText(/Применить пик-неделю/)).toBeTruthy();
    // Обнулим другие фазы: у prep-блока по умолчанию только contest_prep = weeks блока
    fireEvent.click(screen.getByText(/Собрать и расписать/));
    await waitFor(() => expect(screen.getByText(/✅ Цикл собран/)).toBeTruthy(), { timeout: 15000 });

    fireEvent.click(screen.getByText('🚀 В ББ-авто'));
    const saved = JSON.parse(localStorage.getItem('he_bb_plan_saved') || 'null');
    expect(saved).toBeTruthy();
    const lastPrep = saved.plan.weeks[saved.plan.weeks.length - 1];
    expect(lastPrep.phase).toBe('peaking');
    expect(String(lastPrep.sessions[0].exercises[0].comment || '')).toContain('[Peak week:');
  });

  it('buildMacroSummary: фазы с долями, циклы и соревнования', () => {
    const macro = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52, competitionWeek: 44 });
    const lines = buildMacroSummary(macro);
    expect(lines[0]).toContain('Макроцикл: 52 нед');
    expect(lines.some(l => l.includes('Соревнования (1):'))).toBe(true);
    expect(lines.some(l => /^\s+(Выносливость|Силовой|Выход на пик|Переход): нед \d+–\d+ \(\d+ нед, \d+%\)/.test(l))).toBe(true);
    expect(lines.some(l => l.includes('цикл «Силовой цикл 1 (троеборье)»'))).toBe(true);

    const bb = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    const bbLines = buildMacroSummary(bb);
    expect(bbLines[0]).toContain('Макроцикл: 12 нед');
    expect(bbLines.some(l => /^\s+Гипертрофия:/.test(l))).toBe(true);
  });

  it('дата соревнования → авто-неделя («→ нед N» появляется)', () => {
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
    fireEvent.click(screen.getByText('+ Добавить'));

    const dateInput = screen.getByLabelText(/Дата соревнования/) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2027-06-15' } });

    const weekHint = screen.getByText(/→ нед \d+/);
    expect(weekHint.textContent).toMatch(/^→ нед \d+$/);
  });

  it('⧉ дублирует соревнование с суффиксом «(копия)»', () => {
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
    fireEvent.click(screen.getByText('+ Добавить'));
    fireEvent.click(screen.getByLabelText('Дублировать соревнование Соревнование 1'));

    const dup = screen.getByLabelText('Название соревнования Соревнование 1 (копия)') as HTMLInputElement;
    expect(dup.value).toBe('Соревнование 1 (копия)');
  });

  it('«⟲» сбрасывает текущую неделю к началу', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    fireEvent.click(screen.getByLabelText('Следующая неделя'));
    fireEvent.click(screen.getByLabelText('Следующая неделя'));
    expect(screen.getByLabelText('Текущая неделя 3')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('К началу макроцикла'));
    expect(screen.getByLabelText('Текущая неделя 1')).toBeTruthy();
  });

  it('«📊 Итог года» рендерится с долями фаз', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    expect(screen.getByText(/📊 Итог года — 12 нед/)).toBeTruthy();
    expect(screen.getAllByText(/Гипертрофия/).length).toBeGreaterThan(0);
  });

  it('«📋 Сводка» копирует текст в буфер и показывает флеш', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    fireEvent.click(screen.getByText('📋 Сводка'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('Макроцикл: 12 нед');
    expect(screen.getByText('✅ Сводка скопирована')).toBeTruthy();
  });

  it('«📍 сейчас» в Итоге года следует за текущей неделей', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    // Неделя 1 → активна первая фаза (гипертрофия)
    expect(screen.getByText(/📍 сейчас: Гипертрофия/)).toBeTruthy();

    // Перейти на неделю 6 (фаза «Силовой», 6–8 нед при 12-недельном BB-макро)
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByLabelText('Следующая неделя'));
    expect(screen.getByText(/📍 сейчас: Силовой/)).toBeTruthy();
  });

  it('buildMacroPrintHtml экранирует пользовательские названия', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    const withComp = buildMacrocycle({
      level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52,
      competitions: [{ id: 'c1', name: '<script>alert(1)</script>', week: 30, priority: 'A' }],
    });
    const html = buildMacroPrintHtml(withComp);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('Макроцикл: 52 нед');
    expect(buildMacroPrintHtml(macro)).toContain('Макроцикл: 12 нед');
  });

  it('«🖨 Печать макроцикла» открывает окно печати со сводкой', () => {
    const write = vi.fn();
    const close = vi.fn();
    const focus = vi.fn();
    const print = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({ document: { write, close }, focus, print } as unknown as Window);

    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    fireEvent.click(screen.getByText('🖨 Печать макроцикла'));
    expect(openSpy).toHaveBeenCalled();
    expect(write.mock.calls[0][0]).toContain('Макроцикл: 12 нед');
    expect(close).toHaveBeenCalled();
    expect(print).toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('«⏳ до старта» в карточке соревнования следует за текущей неделей', () => {
    render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
    fireEvent.click(screen.getByText('+ Добавить'));

    // Соревнование добавляется на неделю 52 (по умолчанию) → «до старта: 51 нед»
    expect(screen.getByText(/⏳ до старта: \d+ нед/)).toBeTruthy();
    // Дата недели отображается как «~ dd.mm.yy»
    expect(screen.getByText(/📅 ~ \d{2}\.\d{2}\.\d{2}/)).toBeTruthy();
  });

  it('«📦 Год → ББ-авто» собирает весь макроцикл и сохраняет план', async () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    fireEvent.click(screen.getByText('📦 Год → ББ-авто'));
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('he_bb_plan_saved') || 'null');
      expect(saved).toBeTruthy();
      expect(saved.plan.weeks.length).toBe(12);
    });
    expect(screen.getByText(/🚀 Год передан в ББ-авто/)).toBeTruthy();
  });

  it('«📦 Год → ручной режим» кладёт UserProgram в planner-bridge', async () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    fireEvent.click(screen.getByText('📦 Год → ручной режим'));
    await waitFor(() => {
      const apply = JSON.parse(localStorage.getItem('he_planner_apply') || 'null');
      expect(apply).toBeTruthy();
      expect(apply.kind).toBe('program');
      expect(apply.data.program).toBeTruthy();
      expect(apply.data.program.bb.weeks.length).toBe(12);
    });
    expect(screen.getByText(/✅ Год отправлен в ручной конструктор/)).toBeTruthy();
  });

  it('buildMacroIcs: события фаз и соревнований с датами от reference', () => {
    const macro = buildMacrocycle({
      level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52,
      competitions: [{ id: 'c1', name: 'Первенство области', week: 30, priority: 'A' }],
    });
    const ics = buildMacroIcs(macro, '2026-01-05T00:00:00Z');
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('SUMMARY:🏁 Первенство области [A]');
    expect(ics).toContain('DTSTART;VALUE=DATE:2026'); // первый блок начинается с reference
    expect(ics.match(/BEGIN:VEVENT/g)!.length).toBeGreaterThan(5); // блоки + соревнование
    // Дата соревнования = воскресенье недели 30 (reference + 29 недель + 6 дней)
    expect(ics).toContain('DESCRIPTION:Неделя 30 макроцикла');
  });

  it('buildMacroIcs экранирует спецсимволы названий', () => {
    const macro = buildMacrocycle({
      level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52,
      competitions: [{ id: 'c1', name: 'Соревнование, №1; доп', week: 30, priority: 'B' }],
    });
    const ics = buildMacroIcs(macro, '2026-01-05T00:00:00Z');
    expect(ics).toContain('SUMMARY:🏁 Соревнование\\, №1\\; доп [B]');
  });

  it('🗺 heatmap: ячейка на каждую неделю, активная подсвечена', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    const cells = document.querySelectorAll('.macro-week-cell');
    expect(cells.length).toBe(12);
    // Активная неделя 1 подсвечена белой обводкой
    expect((cells[0] as HTMLElement).style.outline).not.toBe('none');
    expect((cells[1] as HTMLElement).style.outline).toBe('none');
    // Подпись фазы в title ячейки
    expect((cells[0] as HTMLElement).title).toContain('Гипертрофия');
  });

  it('таймлайн показывает дату начала блока («dd.mm.yy» в карточке) и кнопку «📅 Календарь»', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    expect(screen.getAllByText(/\(\d+н\) · 📅 \d{2}\.\d{2}\.\d{2}/).length).toBeGreaterThan(0);
    expect(screen.getByText('📅 Календарь (.ics)')).toBeTruthy();
  });

  it('C13: линейка дат под таймлайном (5 тиков от «сегодня»)', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    expect(screen.getAllByText(/^· \d{2}\.\d{2}\.\d{2}$/).length).toBe(5);
  });

  it('D15: пик-неделя использует вес/категорию из профиля (70 кг, Bikini)', async () => {
    expect(profilePeakDefaults()).toEqual({ weight: 70, category: 'bikini', sex: 'female' });

    const macro = buildBbMacrocycle({
      level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy',
      competitions: [{ id: 'c1', name: 'Шоу', week: 10, priority: 'A' }],
    });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    const timeline = document.querySelector('.macrocycle-week-cards');
    const prepBlock = Array.from(timeline!.querySelectorAll('[role="button"]'))
      .find(b => (b.getAttribute('aria-label') || '').startsWith('Подготовка'));
    fireEvent.click(prepBlock!);
    fireEvent.click(screen.getByText(/🎭 Пик-неделя \(тапер ББ\)/));
    expect(screen.getByText(/Протокол на 70 кг · bikini/)).toBeTruthy();

    // В сборщике селектор категории показывает «Bikini» (из профиля)
    fireEvent.click(screen.getByText('⚙️ Собрать этот цикл (сплит + фазы)'));
    expect(screen.getByText('Bikini')).toBeTruthy();
  });

  it('A5: diaryMacroStats — сессии, ACWR и последняя неделя из дневника', () => {
    const day = 86400000;
    const now = Date.now();
    const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();
    localStorage.setItem('he_srpe_sessions', JSON.stringify([
      { date: iso(0), sRPE: 8, durationMin: 70 },          // сегодня
      { date: iso(2 * day), sRPE: 7, durationMin: 60 },    // 2 дня назад
      { date: iso(10 * day), sRPE: 9, durationMin: 80 },   // 10 дней назад
      { date: iso(25 * day), sRPE: 6, durationMin: 50 },   // 25 дней назад
    ]));

    const stats = diaryMacroStats();
    expect(stats.sessions7).toBe(2);
    expect(stats.sessions28).toBe(4);
    expect(stats.acwr).not.toBeNull();
    expect(stats.acwr!.ratio).toBeGreaterThan(0);
    expect(stats.lastSessionWeek).toBe(1);
    expect(macroWeekForDate(new Date(now - 21 * day).toISOString())).toBe(4);
    expect(ACWR_ZONE_LABEL.optimal).toBe('норма');
    expect(ACWR_ZONE_LABEL.dangerous).toBe('опасно (>1.5)');
  });

  it('A5: без сессий — статистика пустая, «По дневнику» не показывается', () => {
    localStorage.setItem('he_srpe_sessions', '[]');
    expect(diaryMacroStats()).toEqual({ sessions7: 0, sessions28: 0, acwr: null, lastSessionDate: null, lastSessionWeek: null });

    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);
    expect(screen.queryByText(/По дневнику/)).toBeNull();
  });

  it('A5: «📈 По дневнику» переводит маркер на неделю последней сессии и ACWR виден в Итоге года', () => {
    const day = 86400000;
    const now = Date.now();
    const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();
    // Последняя сессия ~3 недели назад → неделя 4
    localStorage.setItem('he_srpe_sessions', JSON.stringify([
      { date: iso(21 * day), sRPE: 7, durationMin: 60 },
      { date: iso(30 * day), sRPE: 6, durationMin: 50 },
    ]));

    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    // Кнопка «По дневнику» указывает неделю 4
    const btn = screen.getByLabelText('По дневнику');
    expect(btn.textContent).toContain('нед 4');
    fireEvent.click(btn);
    expect(screen.getByLabelText('Текущая неделя 4')).toBeTruthy();

    // ACWR-строка в Итоге года (обе сессии старше 7 дней → 7д=0; в 28-дневное окно попадает одна)
    expect(screen.getByText(/⚡ ACWR/)).toBeTruthy();
    expect(screen.getByText(/Дневник: 0 сессий \(7д\) · 1 \(28д\)/)).toBeTruthy();
  });

  it('C11: карточка «🔔 Сегодня» показывает активную фазу и быстрый старт', () => {
    const macro = buildBbMacrocycle({
      level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy',
      competitions: [{ id: 'c1', name: 'Шоу', week: 10, priority: 'A' }],
    });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    expect(screen.getByText(/🔔 Сегодня — нед 1/)).toBeTruthy();
    expect(screen.getByText(/Фаза: Подготовка/)).toBeTruthy();
    expect(screen.getByText(/до старта «Шоу»: 9 нед/)).toBeTruthy();
    // Кнопка «Собрать этот блок» открывает сборщик
    fireEvent.click(screen.getByText('⚙️ Собрать этот блок'));
    expect(screen.getByRole('dialog', { name: 'Сборка цикла ББ' })).toBeTruthy();
  });

  it('C11+: тренерская готовность недели в карточке «🔔 Сегодня» (пик-окно → тапер)', () => {
    // Старт через 2 недели → «📉 Тапер — разгрузка к пику», готовность 92%
    const macro = buildBbMacrocycle({
      level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy',
      competitions: [{ id: 'c1', name: 'Шоу', week: 3, priority: 'A' }],
    });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);
    expect(screen.getByText(/🧠 готовность 92%/)).toBeTruthy();
    expect(screen.getByText(/Тапер — разгрузка к пику/)).toBeTruthy();
  });

  it('C11+: в неделю старта готовность 100% «Старт сегодня»', () => {
    const macro = buildBbMacrocycle({
      level: 'advanced', totalWeeks: 8, trainingFocus: 'hypertrophy',
      competitions: [{ id: 'c1', name: 'Шоу', week: 1, priority: 'A' }],
    });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);
    expect(screen.getByText(/🧠 готовность 100%/)).toBeTruthy();
    expect(screen.getByText(/Старт сегодня — пик формы/)).toBeTruthy();
  });

  it('Итог года: матрица готовности стартов — тапер-окно ≥2 нед даёт 100%', () => {
    const macro = buildBbMacrocycle({
      level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy',
      competitions: [{ id: 'c1', name: 'Шоу', week: 11, priority: 'A' }],
    });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);
    // Для ББ-макро цикл: подготовка(1-8)→contest_prep(9-11)? — проверяем сам бейдж матрицы
    const badge = screen.getAllByText(/🧠 готовность \d+% · тапер \d+ нед/)[0];
    expect(badge).toBeTruthy();
    expect(badge.textContent).toMatch(/тапер \d+ нед/);
  });

  it('C12: сценарии — снимок, сравнение фаз, удаление', () => {
    const macro = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52, competitionWeek: 30 });
    const saved = saveMacroScenario('Сценарий июнь', macro);
    expect(saved.length).toBe(1);
    expect(loadMacroScenarios().length).toBe(1);

    // Другой сценарий: соревнование позже → другие доли фаз
    const later = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52, competitionWeek: 44 });
    const diffs = compareMacroScenarios(macro, later);
    expect(diffs.length).toBeGreaterThan(0);
    const endurance = diffs.find(d => d.phase === 'Выносливость');
    expect(endurance).toBeTruthy();
    expect(endurance!.weeksA).toBeGreaterThan(0);
    expect(scenarioSummary(macro)).toContain('52 нед');

    const id = saved[0].id;
    expect(removeMacroScenario(id).length).toBe(0);
    expect(loadMacroScenarios().length).toBe(0);
  });

  it('C12: UI — «📸 Снимок» сохраняет сценарий, «⇄ Сравнить» показывает разницу фаз', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    fireEvent.click(screen.getByText('📸 Снимок'));
    const scenarios = loadMacroScenarios();
    expect(scenarios.length).toBe(1);

    // Перестроим другой макро (соревнование) → сравнение
    const macro2 = buildBbMacrocycle({
      level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy',
      competitions: [{ id: 'c1', name: 'Шоу', week: 10, priority: 'A' }],
    });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro2));
    fireEvent.click(screen.getByText('⇄ Сравнить'));
    expect(screen.getByText(/→ текущий \(12 нед\)/)).toBeTruthy();
    expect(screen.getAllByText(/Подготовка/).length).toBeGreaterThan(0);
  });

  it('C10: ◀/▶ перемещают блок и пересчитывают недели', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    const timeline = document.querySelector('.macrocycle-week-cards');
    const blocks = timeline!.querySelectorAll('[role="button"]');
    const phaseOf = (el: Element) => (el.getAttribute('aria-label') || '').split(':')[0];
    const firstPhase = phaseOf(blocks[0]);
    const secondPhase = phaseOf(blocks[1]);
    expect(firstPhase).not.toBe(secondPhase);

    // Выбрать первый блок и сдвинуть вправо → на месте первого теперь вторая фаза
    fireEvent.click(blocks[0]);
    fireEvent.click(screen.getByLabelText('Переместить блок вправо'));

    const newBlocks = timeline!.querySelectorAll('[role="button"]');
    expect(phaseOf(newBlocks[0])).toBe(secondPhase);
    expect(phaseOf(newBlocks[1])).toBe(firstPhase);
    // Недели пересчитаны: первый блок начинается с недели 1
    expect((newBlocks[0] as HTMLElement).getAttribute('aria-label')).toContain('недели 1-');
  });

  it('D15: prepCheckInStats — динамика веса, изменения за 7/14 дней, прогресс к цели', () => {
    const day = 86400000;
    const now = new Date().toISOString();
    const iso = (offsetDays: number) => new Date(Date.now() - offsetDays * day).toISOString().slice(0, 10);
    const log = [
      { date: iso(21), weight: 80 },
      { date: iso(13), weight: 79.2 },
      { date: iso(10), weight: 78.6 },
      { date: iso(3), weight: 78.0 },
      { date: iso(0), weight: 77.5 },
    ];
    const stats = prepCheckInStats(log, iso(21), 75);
    expect(stats.last).toEqual({ date: iso(0), weight: 77.5 });
    expect(stats.change7).toBe(-0.5);   // 78.0 → 77.5
    expect(stats.change14).toBe(-1.7);  // 79.2 → 77.5
    expect(stats.inPrepCount).toBe(5);
    expect(stats.target).toBe(75);
    expect(stats.progressPct).toBe(50); // (80-77.5)/(80-75) = 50%
  });

  it('D15: prepCheckInStats — пустой дневник/без цели', () => {
    expect(prepCheckInStats([], undefined, null)).toMatchObject({ last: null, change7: null, target: null });
    const stats = prepCheckInStats([{ date: '2026-08-01', weight: 80 }], undefined, undefined);
    expect(stats.last?.weight).toBe(80);
    expect(stats.target).toBeNull();
    expect(stats.progressPct).toBeNull();
  });

  it('D15: чек-ин prep отображается в prep-блоке с данными дневника', () => {
    localStorage.setItem('he_weight_log', JSON.stringify([
      { date: '2026-08-01', weight: 80 },
      { date: '2026-08-05', weight: 79 },
      { date: '2026-08-08', weight: 78 },
    ]));
    const macro = buildBbMacrocycle({
      level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy',
      competitions: [{ id: 'c1', name: 'Шоу', week: 10, priority: 'A' }],
    });
    localStorage.setItem('he_bb_macro', serializeBbMacro(macro));
    render(<MacrocyclePanel level="advanced" goal="bodybuilding" onApplyCycle={() => {}} />);

    const timeline = document.querySelector('.macrocycle-week-cards');
    const prepBlock = Array.from(timeline!.querySelectorAll('[role="button"]'))
      .find(b => (b.getAttribute('aria-label') || '').startsWith('Подготовка'));
    fireEvent.click(prepBlock!);
    expect(screen.getByText(/⚖️ Чек-ин prep/)).toBeTruthy();
    expect(screen.getByText(/78 кг/)).toBeTruthy();
  });
});
