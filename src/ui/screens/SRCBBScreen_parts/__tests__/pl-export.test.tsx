/**
 * pl-export.test.tsx — экспорт плана ПЛ: Excel/PDF/ТГ-шеринг.
 * Хелперы (блоки/строки/workbook/html/ссылка) + цепочка UI (формат→объём→блок/неделя→экспорт).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as XLSX from 'xlsx';

import { PLPlanView, type PLPlanViewApi } from '../PLPlanView';
import type { LMSBuildOutput } from '../../../../engines/lms/lms-builder.engine';
import * as plExport from '../pl-export';
import {
  plBlockGroups, plExportRows, buildPLExcelWorkbook, buildPLPrintHtml, plShareLink,
} from '../pl-export';

const mkEx = (name: string, pct: number, sets: number, load?: string) => ({
  name, group: 'Грудь', coef: 1, mnosz: 1, pm: 200, rir: 2,
  ...(load ? { load } : {}),
  workSets: [{ pct, reps: 3, sets, weight: 160, rir: 2 }],
});

const mkDay = (taper = false) => ({
  exercises: [
    mkEx('Присед', taper ? 0.8 : 0.85, taper ? 2 : 3, 'main'),
    mkEx('Жим лежа', taper ? 0.8 : 0.85, taper ? 2 : 3, 'main'),
    mkEx('Тяга к поясу', 0.7, taper ? 2 : 4),
  ],
  metrics: { tonnage: 1000, kpsh: 20, avgWeight: 50, relIntensity: 0.7, intFB: 0, uoi: 0 } as never,
});

const plan = (): LMSBuildOutput => ({
  template: { meta: { title: 'Тестовый цикл', correctionPct: 0.005 } } as never,
  progressionRationale: '',
  cycleMetrics: { tonnage: 0, kpsh: 0, avgWeight: 0, relIntensity: 0, intFB: 0, uoi: 0, sessions: 0, perSession: [] } as never,
  weeks: [
    { week: 1, pmRow: { 'Присед': 200, 'Жим лежа': 140 }, days: [mkDay(false)], sourcePhase: 'base' },
    { week: 2, pmRow: { 'Присед': 200, 'Жим лежа': 140 }, days: [mkDay(false)], sourcePhase: 'base' },
    { week: 7, pmRow: { 'Присед': 200, 'Жим лежа': 140 }, days: [mkDay(true)], taperWeek: true, sourcePhase: 'peak' },
    { week: 8, pmRow: { 'Присед': 200, 'Жим лежа': 140 }, days: [mkDay(true)], taperWeek: true, sourcePhase: 'peak', meetAttempts: { strategy: 'balanced', lifts: [{ name: 'Присед', opener: 185, second: 192.5, third: 202.5, target: 202.5, warmup: [{ pct: 0.4, weight: 75, reps: 5 }] }] } },
  ] as never,
});

const api = (): PLPlanViewApi => ({
  builtSrc: plan() as never,
  setBuiltSrc: () => {}, srcWeek: 1, setSrcWeek: () => {},
  srcEdits: {}, setSrcEdits: () => {}, srcAdditions: {}, setSrcAdditions: () => {},
  editMode: false, setEditMode: () => {},
  setKey: () => '', effSet: (_w, _d, _e, _s, ws) => ws, dayKey: () => '', addExToDay: () => {},
  pickerDay: null, setPickerDay: () => {}, pickerGroup: 'chest', setPickerGroup: () => {},
  pickerExName: '', setPickerExName: () => {}, pickerScheme: { sets: 3, reps: 8, weight: 40 }, setPickerScheme: () => {},
  days: 3, calendarView: 'tapered', setCalendarView: () => {},
  bridgeSessions: [], setBridgeWeek: () => {}, bridgeWeek: 1,
  onNote: () => {}, buildSrc: () => {},
  selectedCycleId: 'cycle-01', cycleWeeks: 8, goal: 'strength', level: 'II-KMS',
  peds: [], pedDoses: {}, pedAuto: false, courseIntensity: 'moderate',
  autoRegMode: 'off', setAutoRegMode: () => {}, autoRegResult: { topSetPctMultiplier: 1, volumeMultiplier: 1, rirShift: 0, deload: false, decisions: [] } as never,
  pmAutoRegMode: 'off', setPmAutoRegMode: () => {}, pmDiary: null,
  bridgeRir: 0, pmSquat: 180, pmBench: 120, pmDead: 220,
  best: { cycle: { meta: { id: 'cycle-01', title: 'Тестовый цикл', direction: 'powerlifting', period: 'силовой', level: 'II-KMS', weeks: 8, sessionsPerWeek: 3, correctionPct: 0.005 } }, score: 0, rationale: [], warnings: [] } as never,
  plWeakPoints: [],
  linked: { readiness: { recovery: 80, fatigue: 30, sleep: 70 } } as never,
  runFocus: null, diaryAutoreg: null, calibratePmFromDiary: () => {}, applyPmFromCycle: () => {},
  e1rmSeries: [], exerciseE1rm: [], exTrendSeries: [], playerDays: [],
  selectedTrendEx: null, setSelectedTrendEx: () => {},
  tempoStr: '', getTempo: () => ({ tempo: '', restSec: 90 } as never), methodHints: { volumeMult: 1, technique: null, label: '' },
});

const W = plan().weeks as LMSBuildOutput['weeks'];

describe('pl-export хелперы', () => {
  it('plBlockGroups: основной цикл/тапер группируются с диапазонами', () => {
    const g = plBlockGroups(W);
    const cycle = g.find(b => b.id === 'cycle');
    const taper = g.find(b => b.id === 'taper');
    expect(cycle?.range).toBe('1–2');
    expect(taper?.range).toBe('7–8');
    expect(taper?.weeks.length).toBe(2);
  });

  it('plExportRows: одна строка на сет с полями неделя/день/нагрузка/вес/%ПМ', () => {
    const rows = plExportRows(W);
    expect(rows.length).toBe(4 * 3); // 4 недели × 3 упражнения × 1 сет
    const first = rows[0];
    expect(first.Неделя).toBe(1); expect(first.День).toBe(1);
    expect(first.Нагрузка).toBe('ОСН'); expect(first.Упражнение).toBe('Присед');
    expect(first['Вес (кг)']).toBe(160); expect(first['% ПМ']).toBe(85);
    expect(rows.find(r => r.Упражнение === 'Тяга к поясу')?.Нагрузка).toBe('АКС');
  });

  it('buildPLExcelWorkbook: лист «План» + сводка (full)', () => {
    const wb = buildPLExcelWorkbook('Тест', plExportRows(W), [{ label: 'Тоннаж', value: '1000 кг·пов' }]);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['План']);
    expect(rows.length).toBe(12);
    const summary = XLSX.utils.sheet_to_json(wb.Sheets['Сводка']);
    expect(summary.length).toBe(1);
  });

  it('buildPLPrintHtml: заголовок/неделя/день/упражнение + XSS-экранирование', () => {
    const html = buildPLPrintHtml('<script>alert(1)</script>', 'Весь план', W);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Неделя 1');
    expect(html).toContain('День 1');
    expect(html).toContain('Присед');
  });

  it('plShareLink: t.me/share + хэш #pl-plan- + закодированный текст', () => {
    const link = plShareLink({ title: 'Тестовый цикл', weeks: 8, pmSquat: 180, pmBench: 120, pmDead: 220, cycleId: 'cycle-01', baseUrl: 'https://app.ru' });
    expect(link).toContain('https://t.me/share/url?url=');
    expect(decodeURIComponent(link)).toContain('https://app.ru#pl-plan-cycle-01');
    expect(decodeURIComponent(link)).toContain('Тестовый цикл');
    expect(decodeURIComponent(link)).toContain('Присед 180');
  });
});

describe('PLPlanView — цепочка экспорта', () => {
  let dlSpy: ReturnType<typeof vi.spyOn>;
  let printSpy: ReturnType<typeof vi.spyOn>;
  let shareSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    dlSpy = vi.spyOn(plExport, 'downloadPLExcel').mockImplementation(() => {});
    printSpy = vi.spyOn(plExport, 'printPLHtml').mockImplementation(() => {});
    shareSpy = vi.spyOn(plExport, 'openPLShare').mockImplementation(() => {});
  });

  it('Excel · Весь план: скачивание workbook со всеми неделями', () => {
    render(<PLPlanView api={api()} />);
    fireEvent.click(screen.getByText('📤 Экспорт'));
    fireEvent.click(screen.getByText('📊 Excel (.xlsx)'));
    fireEvent.click(screen.getByText('📋 Весь план'));
    fireEvent.click(screen.getByText(/Сохранить Excel · Весь план/));
    expect(dlSpy).toHaveBeenCalledTimes(1);
    const [wb, filename] = dlSpy.mock.calls[0];
    expect(filename).toContain('cycle-01');
    expect(XLSX.utils.sheet_to_json(wb.Sheets['План']).length).toBe(12);
  });

  it('PDF · Отдельный блок «Тапер»: печать только тапер-недель', () => {
    render(<PLPlanView api={api()} />);
    fireEvent.click(screen.getByText('📤 Экспорт'));
    fireEvent.click(screen.getByText('🖨 PDF'));
    fireEvent.click(screen.getByText('🧩 Отдельный блок на выбор'));
    fireEvent.click(screen.getByLabelText('Экспорт блок taper'));
    fireEvent.click(screen.getByText(/Сохранить PDF · Блок/));
    expect(printSpy).toHaveBeenCalledTimes(1);
    const [html] = printSpy.mock.calls[0];
    expect(html).toContain('Тестовый цикл');
    expect(html).toContain('Неделя 7');
    expect(html).not.toContain('Неделя 1');
  });

  it('Excel · Одна неделя на выбор: только выбранная неделя', () => {
    render(<PLPlanView api={api()} />);
    fireEvent.click(screen.getByText('📤 Экспорт'));
    fireEvent.click(screen.getByText('📊 Excel (.xlsx)'));
    fireEvent.click(screen.getByText('📅 Одна неделя на выбор'));
    fireEvent.click(screen.getByLabelText('Экспорт неделя 1'));
    fireEvent.click(screen.getByText(/Сохранить Excel · Неделя 1/));
    const [wb] = dlSpy.mock.calls[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['План']) as { Неделя: number }[];
    expect(rows.length).toBe(3);
    expect(rows.every(r => r.Неделя === 1)).toBe(true);
  });

  it('Excel · Всё вместе: лист «Сводка» присутствует', () => {
    render(<PLPlanView api={api()} />);
    fireEvent.click(screen.getByText('📤 Экспорт'));
    fireEvent.click(screen.getByText('📊 Excel (.xlsx)'));
    fireEvent.click(screen.getByText('📦 Всё вместе'));
    fireEvent.click(screen.getByText(/Сохранить Excel · Всё вместе/));
    const [wb] = dlSpy.mock.calls[0];
    expect(wb.Sheets['Сводка']).toBeTruthy();
  });

  it('📲 Поделиться в ТГ: openPLShare вызывается со ссылкой Telegram Mini App', () => {
    render(<PLPlanView api={api()} />);
    fireEvent.click(screen.getByText('📲 Поделиться в ТГ'));
    expect(shareSpy).toHaveBeenCalledTimes(1);
    const [link] = shareSpy.mock.calls[0];
    expect(link).toContain('https://t.me/share/url?url=');
    expect(decodeURIComponent(link)).toContain('https://t.me/BBHealthBot?startapp=pl-plan-cycle-01');
    expect(decodeURIComponent(link)).toContain('Тестовый цикл');
  });

  it('кнопка экспорта не активна, пока цепочка не пройдена', () => {
    render(<PLPlanView api={api()} />);
    fireEvent.click(screen.getByText('📤 Экспорт'));
    const exportBtn = screen.getByText('Выберите формат и объём').closest('button')!;
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
    expect(dlSpy).not.toHaveBeenCalled();
  });
});
