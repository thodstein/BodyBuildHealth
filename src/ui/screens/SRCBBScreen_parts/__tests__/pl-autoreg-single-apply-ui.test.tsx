/**
 * pl-autoreg-single-apply-ui.test.tsx — P0-4 (аудит 2026-11): авторегуляция
 * применяется к плану ТОЛЬКО по кнопке «Применить» и ровно один раз.
 *
 * Что проверяем:
 *  1. режим «Авто» = предпросмотр: карточка честно пишет «к плану НЕ применено»;
 *  2. кнопка «✅ Применить к плану» вызывает ровно один обработчик (не сборку на лету);
 *  3. после фиксации конфига карточка пишет «применено» и даёт «Снять»;
 *  4. слой правок (`effectiveSrc`) больше не применяет авторегуляцию — иначе ×m²;
 *  5. оба экрана (план и соревнования) прокидывают подтверждённый конфиг в тапер.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';
import { PLPlanView, type PLPlanViewApi } from '../PLPlanView';

const dir = 'src/ui/screens/SRCBBScreen_parts';
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const view = read(`${dir}/PLPlanView.tsx`);
const compTab = read(`${dir}/PLCompetitionTab.tsx`);
const screenSrc = read('src/ui/screens/SRCBBScreen.tsx');

const mkEx = (name: string, pct: number) => ({
  name,
  group: 'Грудь',
  coef: 1,
  mnosz: 1,
  pm: 200,
  rir: 2,
  workSets: [{ pct, reps: 3, sets: 3, weight: 160, rir: 2 }],
});

const mkDay = (taper = false) => ({
  exercises: [mkEx('Присед', taper ? 0.8 : 0.85), mkEx('Жим лежа', taper ? 0.8 : 0.85), mkEx('Тяга к поясу', 0.7)],
  metrics: { tonnage: 1000, kpsh: 20, avgWeight: 50, relIntensity: 0.7, intFB: 0, uoi: 0 } as never,
});

const api = (): PLPlanViewApi => ({
  builtSrc: {
    template: { meta: { title: 'Тестовый цикл', correctionPct: 0.005 } } as never,
    progressionRationale: '',
    cycleMetrics: {
      tonnage: 0,
      kpsh: 0,
      avgWeight: 0,
      relIntensity: 0,
      intFB: 0,
      uoi: 0,
      sessions: 0,
      perSession: [],
    } as never,
    weeks: [
      { week: 1, pmRow: { Присед: 200, 'Жим лежа': 140 }, days: [mkDay(false)], sourcePhase: 'base' },
      { week: 2, pmRow: { Присед: 200, 'Жим лежа': 140 }, days: [mkDay(false)], sourcePhase: 'base' },
      { week: 7, pmRow: { Присед: 200, 'Жим лежа': 140 }, days: [mkDay(true)], taperWeek: true, sourcePhase: 'peak' },
      {
        week: 8,
        pmRow: { Присед: 200, 'Жим лежа': 140 },
        days: [mkDay(true)],
        taperWeek: true,
        sourcePhase: 'peak',
        meetAttempts: {
          strategy: 'balanced',
          lifts: [
            {
              name: 'Присед',
              opener: 180,
              second: 192.5,
              third: 202.5,
              target: 202.5,
              warmup: [{ pct: 0.4, weight: 75, reps: 5 }],
            },
          ],
        },
      },
    ] as never,
  } as never,
  srcWeek: 1,
  setSrcWeek: () => {},
  srcEdits: {},
  setSrcEdits: () => {},
  srcAdditions: {},
  setSrcAdditions: () => {},
  editMode: false,
  setEditMode: () => {},
  setKey: () => '',
  effSet: (_w, _d, _e, _s, ws) => ws,
  dayKey: () => '',
  addExToDay: () => {},
  pickerDay: null,
  setPickerDay: () => {},
  pickerGroup: 'chest',
  setPickerGroup: () => {},
  pickerExName: '',
  setPickerExName: () => {},
  pickerScheme: { sets: 3, reps: 8, weight: 40 },
  setPickerScheme: () => {},
  days: 3,
  calendarView: 'tapered',
  setCalendarView: () => {},
  onNote: () => {},
  selectedCycleId: 'cycle-01',
  cycleWeeks: 8,
  goal: 'strength',
  level: 'II-KMS',
  peds: [],
  pedDoses: {},
  pedAuto: false,
  courseIntensity: 'moderate',
  autoRegMode: 'auto',
  setAutoRegMode: () => {},
  autoRegResult: { topSetPctMultiplier: 0.9, volumeMultiplier: 1, rirShift: 1, deload: false, decisions: [] } as never,
  pmAutoRegMode: 'off',
  setPmAutoRegMode: () => {},
  periodizationMode: 'linear',
  setPeriodizationMode: () => {},
  pmDiary: null,
  bridgeRir: 0,
  pmSquat: 180,
  pmBench: 120,
  pmDead: 220,
  best: {
    cycle: {
      meta: {
        id: 'cycle-01',
        title: 'Тестовый цикл',
        direction: 'powerlifting',
        period: 'силовой',
        level: 'II-KMS',
        weeks: 8,
        sessionsPerWeek: 3,
        correctionPct: 0.005,
      },
    },
    score: 0,
    rationale: [],
    warnings: [],
  } as never,
  plWeakPoints: [],
  linked: { readiness: { recovery: 80, fatigue: 30, sleep: 70 } } as never,
  runFocus: null,
  diaryAutoreg: null,
  calibratePmFromDiary: () => {},
  applyPmFromCycle: () => {},
  e1rmSeries: [],
  exerciseE1rm: [],
  exTrendSeries: [],
  playerDays: [],
  selectedTrendEx: null,
  setSelectedTrendEx: () => {},
  tempoStr: '',
  getTempo: () => ({ tempo: '', restSec: 90 }) as never,
  methodHints: { volumeMult: 1, technique: null, label: '' },
});

describe('P0-4: режим «Авто» — предпросмотр, применение по кнопке', () => {
  it('без конфига карточка пишет «к плану НЕ применено» и зовёт обработчик один раз', () => {
    const onApply = vi.fn();
    const a = api();
    a.onApplyAutoReg = onApply;
    a.autoRegCfg = null;
    render(<PLPlanView api={a} />);
    expect(screen.getByText(/Предпросмотр: к плану НЕ применено/)).toBeTruthy();
    const btn = document.querySelector('[data-pl="autoreg-apply"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onApply).toHaveBeenCalledTimes(1);
    // Кнопки «Снять» нет — снимать нечего.
    expect(document.querySelector('[data-pl="autoreg-reset"]')).toBeNull();
  });

  it('с подтверждённым конфигом карточка пишет «Применено к плану» и даёт «Снять»', () => {
    const onReset = vi.fn();
    const a = api();
    a.onResetAutoReg = onReset;
    a.autoRegCfg = {
      topSetPctMultiplier: 0.9,
      volumeMultiplier: 1,
      rirShift: 1,
      deload: false,
      appliedAt: '2026-11-22T10:00:00.000Z',
    };
    render(<PLPlanView api={a} />);
    expect(screen.getByText(/Применено к плану: вес ×0\.90 · объём ×1\.00 · RIR \+1/)).toBeTruthy();
    // Множители совпадают с предпросмотром — UI не предлагает применить то же ещё раз.
    expect(screen.getByText(/множители актуальны/)).toBeTruthy();
    const reset = document.querySelector('[data-pl="autoreg-reset"]') as HTMLButtonElement;
    expect(reset).toBeTruthy();
    fireEvent.click(reset);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('применённый конфиг не даёт ×m² в подписи прикидов', () => {
    const a = api();
    const cfg = {
      topSetPctMultiplier: 0.9,
      volumeMultiplier: 1,
      rirShift: 1,
      deload: false,
      appliedAt: '',
    };
    a.autoRegCfg = cfg;
    const Harness = () => {
      const [mode] = useState<'off' | 'auto' | 'diary'>('auto');
      return <PLPlanView api={{ ...a, autoRegMode: mode }} />;
    };
    render(<Harness />);
    // множитель в плане уже 0.9 — предпросмотр не докручивает его второй раз
    expect(screen.getByText(/\(применено\)/)).toBeTruthy();
    expect(screen.queryByText(/×0\.81/)).toBeNull();
  });
});

describe('P0-4: оверлей правок не применяет авторегуляцию повторно', () => {
  it('effectiveSrc передаёт autoReg: null с объяснением', () => {
    expect(screenSrc).toMatch(/autoReg: null,/);
    expect(screenSrc).toMatch(/одна точка применения/i);
  });

  it('в effSet больше нет autoVol/autoWeight/autoRir', () => {
    const effSetBody = screenSrc.slice(screenSrc.indexOf('const effSet = ('), screenSrc.indexOf('const buildSrc = ('));
    expect(effSetBody).not.toContain('autoVol');
    expect(effSetBody).not.toContain('autoWeight');
    expect(effSetBody).not.toContain('autoRir');
  });

  it('buildSrc принимает явный оверрайд конфига (кнопка применяет ровно один раз)', () => {
    expect(screenSrc).toMatch(/autoRegOverride\?: PLAutoRegCfg \| null/);
    expect(screenSrc).toContain('const effAutoReg = autoRegOverride === undefined ? autoRegCfg : autoRegOverride;');
    expect(screenSrc).toContain('autoReg: plAutoRegPayload(effAutoReg),');
  });

  it('конфиг персистится в he_pl_session и гидрация читает его', () => {
    expect(screenSrc).toContain('plAutoRegCfg: autoRegCfg,');
    expect(screenSrc).toMatch(/parsePLAutoRegCfg\(\(_plSaved/);
  });
});

describe('P0-4: оба экрана получают подтверждённый конфиг', () => {
  it('PLPlanView/PLCompetitionTab подключены к onApply/onReset', () => {
    const wiring = screenSrc.match(/onApplyAutoReg: applyAutoRegConfig/g) ?? [];
    expect(wiring.length).toBe(2);
    expect((screenSrc.match(/onResetAutoReg: resetAutoRegConfig/g) ?? []).length).toBe(2);
    expect((screenSrc.match(/setAutoRegMode: changeAutoRegMode/g) ?? []).length).toBe(2);
  });

  it('выключение режима снимает зафиксированный конфиг (план пересобирается)', () => {
    expect(screenSrc).toMatch(/mode === 'off' && autoRegCfg/);
    expect(screenSrc).toContain('resetAutoRegConfig(true)');
  });

  it('тапер-недели получают тот же конфиг, а не «живой» предпросмотр', () => {
    expect(compTab).toContain('autoReg: autoRegPayloadForTaper,');
    expect(compTab).not.toMatch(/autoReg:\s*autoRegMode === 'auto' && autoRegResult/);
    // сезон: попытки соревнований сохраняют множитель
    expect(compTab).toMatch(/autoRegMult: autoRegCfg\?\.topSetPctMultiplier/);
  });

  it('карточка прикидов недели читает meetAttempts движка и attemptAutoRegMult', () => {
    expect(view).toContain('const base = wk.meetAttempts;');
    expect(view).toContain('const appliedMult = wk.attemptAutoRegMult ?? 1;');
    expect(view).toContain(
      "const previewMult = autoRegMode === 'auto' && !autoRegCfg ? autoRegResult.topSetPctMultiplier : 1;",
    );
  });
});
