/**
 * lab-flag-overrides.test.ts — проход 105: анализы главнее анкеты, но перекрытие
 * не молчит.
 *
 * Было: `hydrateState` безусловно перезаписывал флаг из анкеты значением из бланка
 * (`hep.altAstElevation = ...`), и ответ пользователя исчезал бесследно. В интерфейсе
 * оставалась только цифра из анализов, а объяснить «куда делся мой ответ» было нечем;
 * калькулятор и вовсе отделывался счётчиком «Авто-вывод: N полей».
 *
 * Стало: анализы по-прежнему главнее (решение прохода 105) — флаг считается из
 * бланка, — но каждое перекрытие записывается. `LabFlagOverride` хранит поле, имя
 * флага, оба значения (`manual`/`lab`), маркер, значение из бланка и предел, с
 * которым сравнивали. `hydrateState` кладёт список в `labFlagOverrides` (его печатают
 * карточка калькулятора, план «Поддержки» и экспорт) и сохраняет исходные ответы в
 * `labFlagBaseline`: при смене бланка перекрытие пересчитывается от ответа анкеты, а
 * не от предыдущего значения из анализов. Дефолты (никогда не отвеченная анкета) за
 * ответ не считаются — иначе «в анкете было «норма»» было бы выдумкой.
 */
import { describe, it, expect, vi } from 'vitest';
import { hydrateState, runSupportUnified, flagLevelRu } from '../index';
import { deriveStateFromLabs } from '../../../ui/screens/Calculator/Calc.labs-derived';
import { DEFAULT_STATE, normalizeCalculatorState } from '../../../ui/screens/Calculator/Calc.types';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal('localStorage', localStorageMock);

const bio = (v: Record<string, string>) => ({ panelBiochem: v } as any);
const lipid = (v: Record<string, string>) => ({ panelLipid: v } as any);
const hep = (alt: string) => ({
  altAstElevation: alt, ggtElevation: 'none', bilirubinElevation: 'none',
  fattyLiver: false, cholecystitis: false, alcoholHistory: 'none',
});

describe('проход 105: перекрытие ответа анкеты анализами — оба значения', () => {
  it('АЛТ 85 при ответе «норма»: флаг из бланка «умеренно», в перекрытии оба значения', () => {
    const r = deriveStateFromLabs(bio({ ALT: '85' }), 'male', { hepatobiliary: { altAstElevation: 'none' } } as any);
    expect(r.hepatobiliary.altAstElevation).toBe('moderate');
    expect(r.overrides).toContainEqual({
      field: 'hepatobiliary.altAstElevation', title: 'АЛТ/АСТ',
      manual: 'none', lab: 'moderate', marker: 'ALT', value: 85, limit: '<40',
    });
  });

  it('анкета не отвечена — перекрывать нечего, записей нет', () => {
    expect(deriveStateFromLabs(bio({ ALT: '85' }), 'male').overrides).toEqual([]);
  });

  it('ответ совпал с бланком — перекрытия нет', () => {
    const r = deriveStateFromLabs(bio({ ALT: '85' }), 'male', { hepatobiliary: { altAstElevation: 'moderate' } } as any);
    expect(r.overrides).toEqual([]);
  });

  it('ЛПВП: «норма» в анкете, 0.95 в бланке — «низко» и оба значения рядом', () => {
    const r = deriveStateFromLabs(lipid({ HDL: '0.95' }), 'male', { cardio: { hdlLow: false } } as any);
    expect(r.cardio.hdlLow).toBe(true);
    expect(r.overrides).toContainEqual({
      field: 'cardio.hdlLow', title: 'ЛПВП',
      manual: 'норма', lab: 'низко', marker: 'HDL', value: 0.95, limit: '≥1',
    });
  });

  it('один флаг — одна строка (ключ перекрытия = поле состояния)', () => {
    const r = deriveStateFromLabs(bio({ ALT: '85', GGT: '200' }), 'male', {
      hepatobiliary: { altAstElevation: 'none', ggtElevation: 'none' },
    } as any);
    const fields = r.overrides.map(o => o.field);
    expect(new Set(fields).size).toBe(fields.length);
    expect(fields).toEqual(['hepatobiliary.altAstElevation', 'hepatobiliary.ggtElevation']);
  });
});

describe('проход 105: hydrateState — анализы главнее, ответ сохранён', () => {
  it('ответ «выраженно», бланк 45 → флаг «незначительно» из бланка, оба значения в перекрытии', () => {
    localStorageMock.clear();
    store['he_autocalc_state'] = JSON.stringify({ hepatobiliary: hep('severe') });
    store['he_labs_history'] = JSON.stringify([{ date: '2026-11-01', panelBiochem: { ALT: '45' } }]);
    const h = hydrateState();
    expect(h.hepatobiliary!.altAstElevation).toBe('mild');
    expect(h.labFlagOverrides).toContainEqual({
      field: 'hepatobiliary.altAstElevation', title: 'АЛТ/АСТ',
      manual: 'severe', lab: 'mild', marker: 'ALT', value: 45, limit: '<40',
    });
    // Базовая линия помнит именно ответ пользователя — от неё считаются перекрытия
    // при следующей смене бланка.
    expect(h.labFlagBaseline!.hepatobiliary!.altAstElevation).toBe('severe');
  });

  it('нет сохранённой анкеты — нет ни перекрытий, ни базовой линии', () => {
    localStorageMock.clear();
    store['he_labs_history'] = JSON.stringify([{ date: '2026-11-01', panelBiochem: { ALT: '85' } }]);
    const h = hydrateState();
    expect(h.hepatobiliary!.altAstElevation).toBe('moderate');
    expect(h.labFlagOverrides ?? []).toEqual([]);
    expect(h.labFlagBaseline).toBeUndefined();
  });

  it('«Поддержка» несёт перекрытия в результате плана', () => {
    localStorageMock.clear();
    store['he_profile_v2'] = JSON.stringify({ settings: { personal: { sex: 'male' } } });
    store['he_autocalc_state'] = JSON.stringify({ hepatobiliary: hep('severe') });
    store['he_labs_history'] = JSON.stringify([{ date: '2026-11-01', panelBiochem: { ALT: '45' } }]);
    const h = hydrateState();
    const state = normalizeCalculatorState({ ...DEFAULT_STATE, ...h });
    const plan = runSupportUnified(state);
    expect(plan.error).toBeUndefined();
    expect(plan.labFlagOverrides.length).toBe(1);
    expect(plan.labFlagOverrides[0]).toMatchObject({
      field: 'hepatobiliary.altAstElevation', manual: 'severe', lab: 'mild', value: 45,
    });
  });
});

describe('проход 105: подписи уровней — один словарь на калькулятор и протокол', () => {
  it('enum-уровни читаются по-русски, незнакомое значение печатается как есть', () => {
    expect(flagLevelRu('none')).toBe('норма');
    expect(flagLevelRu('mild')).toBe('незначительно');
    expect(flagLevelRu('moderate')).toBe('умеренно');
    expect(flagLevelRu('severe')).toBe('выраженно');
    expect(flagLevelRu('elevated')).toBe('повышено');
    expect(flagLevelRu('weird')).toBe('weird');
  });
});
