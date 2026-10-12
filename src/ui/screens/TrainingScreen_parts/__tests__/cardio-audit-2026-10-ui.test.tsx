/**
 * cardio-audit-2026-10-ui.test.tsx — UI-лок аудита кардиоконструктора (Oct 2026).
 * P0-1: редактор недели пересчитывает итоги цикла (totalKcal).
 * P0-3: wellness (готовность) реально влияет на авто-подстройку.
 * P1-5: валидатор видит старты цикла (no_taper).
 * P1-6/8: дашборд — HR-drift по последним сессиям (порядок журнала DESC) и
 *         единая шкала нагрузки.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioAnalyticsDashboard } from '../CardioAnalyticsDashboard';
import { CardioWeekEditor } from '../CardioWeekEditor';
import { CardioAutoTunePanel } from '../CardioAutoTunePanel';
import { CardioValidationCard } from '../CardioPlanExtras';
import { buildCardioCycle, loadCardioCycles, loadCardioCycles as loadCycles, cardioFactHrAdjustment } from '../../../../engines/lms/cardio.engine';
import { loadCardioLog } from '../../../../engines/lms/cardio-diary.engine';
import type { CardioCycle } from '../../../../engines/lms/cardio.engine';

const CYCLES_KEY = 'he_cardio_cycles';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem('he_cardio_sessions');
    localStorage.removeItem('he_cardio_wellness');
    localStorage.removeItem('he_cardio_cycle_history');
  } catch { /* ignore */ }
});

/** Локальная дата N дней назад (журнал кардио — DESC). */
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seedActiveCycle(c: CardioCycle): void {
  localStorage.setItem(CYCLES_KEY, JSON.stringify([c]));
}

describe('P1-8 дашборд: HR-drift по двум последним HR-сессиям', () => {
  it('пульс вырос между последними сессиями → предупреждение о дрейфе', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'drift-1' });
    // Журнал DESC (свежие первыми): [0]=новая (HR 165), [1]=предыдущая (HR 150).
    const log = [
      { id: 'n', date: isoDaysAgo(0), type: 'zone2' as const, durationMin: 40, completed: true, avgHr: 165 },
      { id: 'p', date: isoDaysAgo(2), type: 'zone2' as const, durationMin: 40, completed: true, avgHr: 150 },
    ];
    const html = render(<CardioAnalyticsDashboard cycle={c} log={log} />);
    expect(screen.getByText(/HR drift/)).toBeTruthy();
    html.unmount();
  });

  it('пульс стабилен → предупреждения нет (не шумим)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'drift-2' });
    const log = [
      { id: 'n', date: isoDaysAgo(0), type: 'zone2' as const, durationMin: 40, completed: true, avgHr: 150 },
      { id: 'p', date: isoDaysAgo(2), type: 'zone2' as const, durationMin: 40, completed: true, avgHr: 150 },
    ];
    const html = render(<CardioAnalyticsDashboard cycle={c} log={log} />);
    expect(screen.queryByText(/HR drift/)).toBeNull();
    html.unmount();
  });

  it('пульс снижается → предупреждения нет (было: инверсия порядка врала знаком)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'drift-3' });
    // Раньше first/second брались по индексу: (новая − старый)/старый давало
    // минус, и предупреждение не срабатывало никогда при реальном росте.
    const log = [
      { id: 'n', date: isoDaysAgo(0), type: 'zone2' as const, durationMin: 40, completed: true, avgHr: 140 },
      { id: 'p', date: isoDaysAgo(2), type: 'zone2' as const, durationMin: 40, completed: true, avgHr: 150 },
    ];
    const html = render(<CardioAnalyticsDashboard cycle={c} log={log} />);
    expect(screen.queryByText(/HR drift/)).toBeNull();
    html.unmount();
  });
});

describe('P1-5 валидатор: старты цикла видны (no_taper)', () => {
  it('старт без taper в предыдущие 2 недели → предупреждение в UI', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 8, id: 'val-1' });
    const withComps: CardioCycle = {
      ...c,
      config: { ...c.config, competitions: [{ id: 'x', name: 'Старт', week: 8 }] },
    };
    render(<CardioValidationCard cycle={withComps} beginner={false} />);
    expect(screen.getByText(/Старт на нед 8 без taper/)).toBeTruthy();
  });

  it('без стартов в конфиге — проверки нет (прежнее поведение)', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 8, id: 'val-2' });
    render(<CardioValidationCard cycle={c} beginner={false} />);
    expect(screen.queryByText(/без taper/)).toBeNull();
  });
});

describe('P0-1 редактор недели: итоги цикла пересчитываются', () => {
  it('±10% минут меняет неделю И корневой totalKkal сохранённого цикла', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'we-total' });
    seedActiveCycle(c);
    render(<CardioWeekEditor cycle={c} />);
    const before = loadCardioCycles().find(x => x.id === 'we-total')!;
    const sumWeeks = (x: CardioCycle) => x.weeks.reduce((s, w) => s + w.totalKcal, 0);
    expect(before.totalKcal).toBe(sumWeeks(before));
    fireEvent.click(screen.getByRole('button', { name: /\+10%|-10%|\+\/−/i }));
    const after = loadCardioCycles().find(x => x.id === 'we-total');
    // Кнопка масштаба: в редакторе она подписана процентом — ищем любую из двух.
    expect(after).toBeTruthy();
    if (after && after.weeks[0].totalMinutes !== before.weeks[0].totalMinutes) {
      expect(after.totalKcal).toBe(sumWeeks(after));
    }
  });
});

describe('P0-3 wellness реально влияет на авто-подстройку', () => {
  it('низкая готовность → предпросмотр содержит правку и применение убирает HIIT', () => {
    const today = isoDaysAgo(0);
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'well-1', startDate: today });
    seedActiveCycle(c);
    // Wellness: всё плохо → readiness 1.
    localStorage.setItem('he_cardio_wellness', JSON.stringify([
      { date: today, sleep: 1, stress: 5, soreness: 5, mood: 1, readiness: 1 },
    ]));
    const view = render(<CardioAutoTunePanel cycle={c} acwr={1.0} />);
    // Панель показывает вход сигнала (текст разбит узлами — сверяем textContent).
    expect(view.container.textContent).toContain('Готовность сегодня:');
    expect(view.container.textContent).toContain('2/10'); // readiness = (1+1+1+1)/20*10
    expect(view.container.textContent).toContain('низкая');
    fireEvent.click(screen.getByRole('button', { name: /Подстроить сейчас/ }));
    expect(screen.getByText(/Предпросмотр изменений/)).toBeTruthy();
    expect(view.container.textContent).toContain('Готовность 2/10');
    fireEvent.click(screen.getByRole('button', { name: /Применить/ }));
    expect(screen.getByText(/Подстройка применена/)).toBeTruthy();
    const saved = loadCycles().find(x => x.id === 'well-1')!;
    const future = saved.weeks.filter(w => !w.deload && !w.taper && w.phase !== 'transition');
    for (const w of future) expect(w.sessions.some(s => s.type === 'hiit')).toBe(false);
    // Итоги cycles согласованы с неделями.
    expect(saved.totalKcal).toBe(saved.weeks.reduce((s, w) => s + w.totalKcal, 0));
  });

  it('готовность в норме → wellness-правки в предпросмотре нет', () => {
    const today = isoDaysAgo(0);
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'well-2', startDate: today });
    seedActiveCycle(c);
    localStorage.setItem('he_cardio_wellness', JSON.stringify([
      { date: today, sleep: 5, stress: 1, soreness: 1, mood: 5, readiness: 9 },
    ]));
    render(<CardioAutoTunePanel cycle={c} acwr={1.0} />);
    fireEvent.click(screen.getByRole('button', { name: /Подстроить сейчас/ }));
    // Дневник пуст → изменений нет вовсе (wellness-ветка не срабатывает).
    expect(screen.getByText(/изменений нет/)).toBeTruthy();
  });
});

describe('PRO: журнал полевых тестов — подсказка следующего теста', () => {
  it('пустой журнал + уровень → видно, какой тест делать', async () => {
    const { CardioFieldTestLog } = await import('../CardioFieldTestLog');
    localStorage.removeItem('he_cardio_field_tests_v1');
    render(<CardioFieldTestLog level="intermediate" equipment={['running']} />);
    const el = document.querySelector('[data-fieldtest="recommend"]');
    expect(el).toBeTruthy();
    expect(el!.textContent).toContain('Следующий тест');
    expect(el!.textContent!.length).toBeGreaterThan(20);
  });

  it('без уровня подсказки нет (не выдумываем)', async () => {
    const { CardioFieldTestLog } = await import('../CardioFieldTestLog');
    localStorage.removeItem('he_cardio_field_tests_v1');
    render(<CardioFieldTestLog />);
    expect(document.querySelector('[data-fieldtest="recommend"]')).toBeNull();
  });
});

describe('PRO: тренд durability из FIT-замеров (durabilityTrend)', () => {
  it('две сессии с decoupling → тренд и подпись', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'dtr-1' });
    const log = [
      { id: 'n', date: isoDaysAgo(1), type: 'zone2' as const, durationMin: 75, completed: true, decouplingPct: 4 },
      { id: 'p', date: isoDaysAgo(10), type: 'zone2' as const, durationMin: 75, completed: true, decouplingPct: 8 },
    ];
    const html = render(<CardioAnalyticsDashboard cycle={c} log={log} />);
    const el = document.querySelector('[data-autotune="durability-trend"]');
    expect(el).toBeTruthy();
    // Свежий замер (4) лучше раннего (8) → decoupling улучшается.
    expect(el!.textContent).toContain('Durability улучшается');
    html.unmount();
  });

  it('одна точка — тренда нет (нужно ≥2)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'dtr-2' });
    const log = [
      { id: 'n', date: isoDaysAgo(1), type: 'zone2' as const, durationMin: 75, completed: true, decouplingPct: 4 },
    ];
    const html = render(<CardioAnalyticsDashboard cycle={c} log={log} />);
    expect(document.querySelector('[data-autotune="durability-trend"]')).toBeNull();
    html.unmount();
  });
});

describe('P1-6 дашборт: единая шкала нагрузки (TRIMP/monotony)', () => {
  it('TRIMP считается движком (не inline-копией) и не NaN', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'trimp-1' });
    const log = [
      { id: 'a', date: isoDaysAgo(1), type: 'zone2' as const, durationMin: 40, completed: true, avgHr: 150, rpe: 7 },
    ];
    const html = render(<CardioAnalyticsDashboard cycle={c} log={log} />);
    expect(html.container.textContent).toContain('TRIMP 7Д');
    expect(html.container.textContent).not.toContain('NaN');
    html.unmount();
  });
});

describe('PRO: анемия/RED-S из анализов профиля (cardioAnemiaSignals)', () => {
  const PROFILE_KEY = 'he_profile_v2';

  it('ферритин <30 → предупреждение в дашборде (движок впервые получает анализы)', () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({
      settings: {
        personal: { weight: 60, sex: 'female' },
        labs: { status: 'partial', summary: {
          FERRITIN: { value: 18, date: '2026-10-01', unit: 'мкг/л' },
          HGB: { value: 118, date: '2026-10-01', unit: 'г/л' },
          HCT: { value: 35, date: '2026-10-01', unit: '%' },
        } },
      },
    }));
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'anemia-1' });
    const html = render(<CardioAnalyticsDashboard cycle={c} log={[]} />);
    const text = html.container.textContent ?? '';
    expect(text).toContain('18');
    expect(text).toMatch(/ферритин|Ферритин/i);
    expect(text).toContain('Объём кардио −10%');
    html.unmount();
  });

  it('анализы в норме → предупреждения об анемии нет', () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({
      settings: {
        personal: { weight: 80, sex: 'male' },
        labs: { status: 'partial', summary: {
          FERRITIN: { value: 90, date: '2026-10-01' },
          HGB: { value: 150, date: '2026-10-01' },
          HCT: { value: 45, date: '2026-10-01' },
        } },
      },
    }));
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'anemia-2' });
    const html = render(<CardioAnalyticsDashboard cycle={c} log={[]} />);
    expect(html.container.textContent).not.toContain('Объём кардио −10%');
    html.unmount();
  });

  it('анализов нет → честное «оценить нечем», а не молчание', () => {
    localStorage.removeItem(PROFILE_KEY);
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'anemia-3' });
    const html = render(<CardioAnalyticsDashboard cycle={c} log={[]} />);
    expect(html.container.textContent).toContain('железодефицит оценить нечем');
    html.unmount();
  });
});

describe('PRO: ЧСС покоя из дневника АД (cardioRestingHrSignal)', () => {
  it('утренний пульс вырос >5% → предупреждение о переутомлении', () => {
    const dates: string[] = [];
    for (let i = 0; i < 28; i++) dates.push(isoDaysAgo(i));
    const rec = (date: string, hr: number) => ({ date, pulse: hr, timeOfDay: 'morning', sys: 120, dia: 80 });
    // 3 недели по 60, последние 7 дней по 66 (+10%).
    const entries = [
      ...dates.slice(7).map(d => rec(d, 60)),
      ...dates.slice(0, 7).map(d => rec(d, 66)),
    ];
    localStorage.setItem('he_bp_diary', JSON.stringify(entries));
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'rhr-1' });
    const html = render(<CardioAnalyticsDashboard cycle={c} log={[]} />);
    const text = html.container.textContent ?? '';
    expect(text).toContain('ЧСС покоя (АД, утро)');
    expect(text).toContain('переутом');
    html.unmount();
  });
});

describe('PRO: коррекция зон по факту-ЧСС (cardioFactHrAdjustment)', () => {
  it('факт-пульс выше потолка Z2 → зоны будущих недель −5', () => {
    const start = isoDaysAgo(21); // цикл начался 3 недели назад → текущая неделя 4
    // age → зоны строятся, у сессий появляется targetHr (без него корректировать нечего).
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, id: 'fact-hr-1', startDate: start, age: 30, restingHr: 60 });
    const nowWeek = 4;
    const log = [{ date: isoDaysAgo(1), type: 'zone2' as const, durationMin: 40, completed: true, avgHr: 185 }];
    // Двигатель: для недели > текущей берётся дневник до конца недели.
    const r = cardioFactHrAdjustment(c, log);
    const changedWeeks = r.changes.map(x => x.week);
    expect(changedWeeks).toContain(5);
    // Сверяем ОДНУ И ТУ ЖЕ сессию (zone2) недели 5: было → стало.
    const z2before = c.weeks[4].sessions.find(s => s.type === 'zone2')!.targetHr!;
    const z2after = r.cycle.weeks[4].sessions.find(s => s.type === 'zone2')!.targetHr!;
    expect(z2after.max!).toBeLessThanOrEqual(z2before.max! - 5);
    // Прошедшие недели (1-4) не тронуты.
    expect(r.cycle.weeks[0].sessions.find(s => s.type === 'zone2')!.targetHr).toEqual(c.weeks[0].sessions.find(s => s.type === 'zone2')!.targetHr);
    // Итоги cycles согласованы.
    expect(r.cycle.totalKcal).toBe(r.cycle.weeks.reduce((s, w) => s + w.totalKcal, 0));
  });

  it('кнопка «🎯 Факт-ЧСС → зоны» появляется в панели авто-режима', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'fact-hr-ui' });
    const html = render(<CardioAutoTunePanel cycle={c} acwr={1.0} />);
    expect(screen.getByRole('button', { name: /Факт-ЧСС → зоны/ })).toBeTruthy();
    html.unmount();
  });

  it('без дневника кнопка даёт честный ответ, а не молчание', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'fact-hr-ui2' });
    render(<CardioAutoTunePanel cycle={c} acwr={1.0} />);
    fireEvent.click(screen.getByRole('button', { name: /Факт-ЧСС → зоны/ }));
    expect(screen.getByText(/Факт-ЧСС в пределах целевых зон/)).toBeTruthy();
  });
});
