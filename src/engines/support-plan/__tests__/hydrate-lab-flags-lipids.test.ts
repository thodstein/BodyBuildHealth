/**
 * hydrate-lab-flags-lipids.test.ts — проход 102: липидные и билирубиновые флаги
 * из анализов — из одного ряда, а «низкий ЛПВП» — по полу.
 *
 * Было: в `hydrateState` стояли литералы `ldl < 3.0 / 4.0 / 5.0`,
 * `hdl < 1.0`, `tg < 1.7 / 2.3`, `bilirubin < 21 / 40 / 60`. Ни один из них не был
 * нигде объявлен, поэтому поменять ступень можно было только в одном месте — в
 * этом же файле — и проверить нечем. Хуже с ЛПВП: порог `1.0` один для всех, хотя
 * кардио-цель у женщины выше (1.2) — и `recommendation-engine` уже считал её по
 * 1.2. То есть приложение само себе противоречило: женщине с ЛПВП 1.1 таблица
 * рекомендаций говорила «низко», а карточка анализов — «норма».
 *
 * Стало: ряд живёт в резолвере — `LDL_FLAG_STEPS` (3.0/4.0/5.0),
 * `TG_FLAG_STEPS` (1.7/2.3), `BILIRUBIN_FLAG_STEPS` (от ВГН 17.1: 17.1/39.3/59.9)
 * и `HDL_LOW = { male: 1.0, female: 1.2 }`; им пользуются и `hydrateState`, и
 * `recommendation-engine`. Мужские цифры не изменились.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hydrateState } from '../index';
import { LDL_FLAG_STEPS, TG_FLAG_STEPS, BILIRUBIN_FLAG_STEPS, HDL_LOW } from '../../lab-norms.engine';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal('localStorage', localStorageMock);

type Panels = { panelLipid?: Record<string, string>; panelBiochem?: Record<string, string> };

const flags = (sex: 'male' | 'female', panels: Panels) => {
  localStorageMock.clear();
  store['he_profile_v2'] = JSON.stringify({ settings: { personal: { sex } } });
  store['he_labs_history'] = JSON.stringify([{ date: '2026-11-01', ...panels }]);
  const h = hydrateState();
  return { cardio: h.cardio, hep: h.hepatobiliary } as any;
};

describe('проход 102: липидные флаги из анализов — один ряд на приложение', () => {
  it('ряд объявлен в резолвере и не сдвинут', () => {
    expect(LDL_FLAG_STEPS).toEqual({ mild: 3.0, moderate: 4.0, severe: 5.0 });
    expect(TG_FLAG_STEPS).toEqual({ elevated: 1.7, high: 2.3 });
    // Билирубин собран от ВГН 17.1: mild = ВГН, moderate ×2.3, severe ×3.5.
    expect(BILIRUBIN_FLAG_STEPS).toEqual({ mild: 17.1, moderate: 39.3, severe: 59.9 });
    expect(HDL_LOW).toEqual({ male: 1.0, female: 1.2 });
  });

  it('ЛПВП: 1.1 у женщины — «низко» (её цель 1.2), у мужчины — норма', () => {
    expect(flags('female', { panelLipid: { HDL: '1.1' } }).cardio.hdlLow).toBe(true);
    expect(flags('male', { panelLipid: { HDL: '1.1' } }).cardio.hdlLow).toBe(false);
  });

  it('ЛПВП: 1.25 — норма обоим; 0.95 — «низко» обоим', () => {
    for (const sex of ['male', 'female'] as const) {
      expect(flags(sex, { panelLipid: { HDL: '1.25' } }).cardio.hdlLow).toBe(false);
      expect(flags(sex, { panelLipid: { HDL: '0.95' } }).cardio.hdlLow).toBe(true);
    }
  });

  it('ЛПНП: 2.9 «none», 3.0 «mild», 4.0 «moderate», 5.0 «severe»', () => {
    const ldl = (v: string) => flags('male', { panelLipid: { LDL: v } }).cardio.ldlElevation;
    expect(ldl('2.9')).toBe('none');
    expect(ldl('3.0')).toBe('mild');
    expect(ldl('4.0')).toBe('moderate');
    expect(ldl('5.0')).toBe('severe');
  });

  it('ТГ: 1.6 «normal», 1.7 «elevated», 2.3 «high»', () => {
    const tg = (v: string) => flags('male', { panelLipid: { Triglycerides: v } }).cardio.triglycerides;
    expect(tg('1.6')).toBe('normal');
    expect(tg('1.7')).toBe('elevated');
    expect(tg('2.3')).toBe('high');
  });

  it('билирубин: 17 «none», 18 «mild», 39 «mild», 40 «moderate», 60 «severe»', () => {
    const bil = (v: string) => flags('male', { panelBiochem: { Bilirubin: v } }).hep.bilirubinElevation;
    expect(bil('17')).toBe('none');
    expect(bil('18')).toBe('mild');
    expect(bil('39')).toBe('mild');
    expect(bil('40')).toBe('moderate');
    expect(bil('59')).toBe('moderate');
    expect(bil('60')).toBe('severe');
  });
});

describe('проход 102: источник липидных порогов', () => {
  it('hydrateState читает ряд из резолвера, литералов не осталось', () => {
    const engine = readFileSync(resolve(process.cwd(), 'src/engines/support-plan/engine.ts'), 'utf8');
    expect(engine).toContain('LDL_FLAG_STEPS.mild');
    expect(engine).toContain('TG_FLAG_STEPS.elevated');
    expect(engine).toContain('BILIRUBIN_FLAG_STEPS.mild');
    expect(engine).toContain('card.hdlLow = hdl < HDL_LOW[sexKey];');
    expect(engine).not.toContain('hdl < 1.0');
    expect(engine).not.toContain('ldl < 3.0 ?');
    expect(engine).not.toContain('tg < 1.7 ?');
    expect(engine).not.toContain('bilirubin < 21 ?');
  });

  it('recommendation-engine берёт ту же пару ЛПВП и тот же порог ТГ', () => {
    const rec = readFileSync(resolve(process.cwd(), 'src/engines/recommendation-engine.ts'), 'utf8');
    expect(rec).toContain('value: HDL_LOW[sexT]');
    expect(rec).toContain('value: TG_FLAG_STEPS.elevated');
    expect(rec).not.toContain("sex === 'female' ? 1.2 : 1.0");
  });
});
