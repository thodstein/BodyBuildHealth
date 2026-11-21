/**
 * natriuretic-name.test.ts — проход 168: у NT-proBNP одно имя во всех контурах.
 *
 * Было три написания одного и того же числа: поле формы «NT-proBNP» уезжало в
 * ключ `BNP` (другой анализ, ВГН 100 пг/мл) при пересчёте единицы и при сборке
 * `labValues` для движка риска. Склад и каталог хранят `NT_PROBNP` (ВГН 125).
 * Цена подмены: на экране «Риск» склад с `NT_PROBNP` не находил значения вовсе —
 * анализ молча не участвовал, — а `BNP` из чужого бланка судился лестницей
 * NT-proBNP (125/450/1800), которой у него нет.
 */
import { describe, expect, it } from 'vitest';
import { getMiFromLab } from '../risk-engine-tz-spec';
import { buildTzInput, normalizeFlatLabs } from '../support-plan/engine-helpers';
import { VERIFICATION_SYSTEMS, buildVerificationReport } from '../risk-verification.engine';
import { MARKER_TO_UCUM, markerReadUnit } from '../../ui/screens/Calculator/Calc.lab-units';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';

const stateWithNtProbnp = () => ({
  ...DEFAULT_STATE,
  labs: {
    ...DEFAULT_STATE.labs,
    fullPanel: { date: '2026-11-20', panelCardiac: { 'NT-proBNP': '500' } },
  },
  pharma: {
    ...DEFAULT_STATE.pharma,
    phase: 'course',
    aas: [{ id: 'test_enan', doseMgWeek: 500, weeks: 12, form: 'inject' }],
  },
}) as any;

describe('проход 168: поле формы пересчитывается как NT-proBNP', () => {
  it('мост единиц ведёт в NT_PROBNP, а не в запись BNP', () => {
    expect(MARKER_TO_UCUM['NT-proBNP']).toBe('NT_PROBNP');
    expect(markerReadUnit('NT-proBNP')).toBe('пг/мл');
  });

  it('ни одно поле формы не подписано кодом BNP', () => {
    expect(Object.values(MARKER_TO_UCUM)).not.toContain('BNP');
  });
});

describe('проход 168: движок риска слышит NT-proBNP из формы и склада', () => {
  it('форма: panelCardiac «NT-proBNP» 500 → labValues.NT_PROBNP, ключа BNP нет', () => {
    const input = buildTzInput(stateWithNtProbnp(), []);
    expect(input?.labValues.NT_PROBNP).toBe(500);
    expect(input?.labValues.BNP).toBeUndefined();
  });

  it('склад: код NT_PROBNP доходит до cv1 (раньше молчал)', () => {
    const flat = normalizeFlatLabs([{ code: 'NT_PROBNP', value: 500 }]);
    expect(flat.NT_PROBNP).toBe(500);
    expect(getMiFromLab('cv1', flat)).toBe(2);
  });

  it('BNP из бланка не судится лестницей NT-proBNP', () => {
    const withBnp = getMiFromLab('cv1', { BNP: 500 });
    expect(withBnp).toBe(getMiFromLab('cv1', {}));
    expect(getMiFromLab('cv1', { NT_PROBNP: 500 })).toBe(2);
  });
});

describe('проход 168: верификация знает анализ по его имени', () => {
  it('строка cv1 подписана NT-proBNP и читает ключ NT_PROBNP', () => {
    const cv1 = VERIFICATION_SYSTEMS.flatMap(s => s.mechanisms).find(m => m.id === 'cv1')!;
    const marker = cv1.markers.find(m => m.name === 'NT-proBNP')!;
    expect(marker.code).toBe('NT_PROBNP');
    expect(marker.unit).toBe('пг/мл');
    expect(marker.thresholds).toEqual([125, 450, 1800]);
    expect(cv1.markers.some(m => m.code === 'BNP')).toBe(false);
  });

  it('значение склада NT_PROBNP отмечается как отклонение, пустой BNP — нет данных', () => {
    const report = buildVerificationReport({ NT_PROBNP: 500 });
    const cv1 = report.systems.flatMap(s => s.mechanisms).find(m => m.id === 'cv1')!;
    const nt = cv1.markers.find(m => m.code === 'NT_PROBNP')!;
    expect(nt.present).toBe(true);
    expect(nt.status).toBe(2);
    const empty = buildVerificationReport({ BNP: 500 });
    const cv1Empty = empty.systems.flatMap(s => s.mechanisms).find(m => m.id === 'cv1')!;
    expect(cv1Empty.markers.find(m => m.code === 'NT_PROBNP')!.present).toBe(false);
  });
});
