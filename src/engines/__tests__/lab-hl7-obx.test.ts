/**
 * lab-hl7-obx.test.ts — проход 142: выгрузка HL7 не теряет знак границы и не
 * выдумывает «норму».
 *
 * OBX печатал только число: «Ферритин >1000 нг/мл» уезжал как `1000`, а флаг
 * отклонения (OBX-8) оставался пустым. Получатель видел точное измерение и не
 * знал, что оно за пределами метода. Хуже: единица приклеивалась к значению
 * через «^» (OBX-5), а собственное поле единиц OBX-6 было пустым.
 *
 * Теперь:
 *  - при границе тип значения ST и знак стоит перед числом («>1000»), потому что
 *    в NM знак не выразить;
 *  - единица — в OBX-6, референс — в OBX-7;
 *  - флаг H/L только для доказанной стороны. «>5» при верхней границе 400 — не
 *    «N»: «isAbnormal: false» у импорта значит «не доказано», а не «в норме».
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../core/db', () => ({
  db: {
    init: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getByIndex: vi.fn().mockResolvedValue([]),
    getByDateRange: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn().mockResolvedValue(undefined),
  },
}));

import { toHL7v2OBX } from '../labs.engine';

const point = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  code: 'FERRITIN',
  name: 'Ферритин',
  value: 1000,
  unit: 'ng/mL',
  date: '2026-11-01',
  phase: 'baseline',
  ...over,
} as any);

/** Поле OBX-n (OBX-1 — первый после «OBX»). */
const f = (segment: string, n: number) => segment.split('|')[n];

describe('проход 142: знак границы в HL7 OBX', () => {
  it('«>1000» едет со знаком, тип ST, флаг H', () => {
    const seg = toHL7v2OBX(point({ bound: '>', refLow: 30, refHigh: 400 }));
    expect(f(seg, 2)).toBe('ST');
    expect(f(seg, 5)).toBe('>1000');
    expect(f(seg, 6)).toBe('ng/mL');
    expect(f(seg, 7)).toBe('30-400');
    expect(f(seg, 8)).toBe('H');
    expect(f(seg, 11)).toBe('F');
    expect(f(seg, 14)).toBe('p1');
  });

  it('«<0.5» при нижней границе 3 — низкое, флаг L', () => {
    const seg = toHL7v2OBX(point({ code: 'CRP', name: 'СРБ', value: 0.5, unit: 'mg/L', bound: '<', refLow: 3, refHigh: 10 }));
    expect(f(seg, 2)).toBe('ST');
    expect(f(seg, 5)).toBe('<0.5');
    expect(f(seg, 8)).toBe('L');
  });

  it('сторона не доказана — флаг пуст, а не «норма»', () => {
    const seg = toHL7v2OBX(point({ bound: '>', value: 5, refLow: 30, refHigh: 400, isAbnormal: false }));
    expect(f(seg, 5)).toBe('>5');
    expect(f(seg, 8)).toBe('');
  });

  it('граница без референса: знак есть, флага нет', () => {
    const seg = toHL7v2OBX(point({ bound: '<', value: 0.5, unit: 'mg/L', isAbnormal: false }));
    expect(f(seg, 5)).toBe('<0.5');
    expect(f(seg, 7)).toBe('');
    expect(f(seg, 8)).toBe('');
  });

  it('обычное число остаётся NM, флаг — по референсу', () => {
    const inNorm = toHL7v2OBX(point({ code: 'ALT', name: 'АЛТ', value: 30, unit: 'Ед/л', refLow: 0, refHigh: 41, isAbnormal: false }));
    expect(f(inNorm, 2)).toBe('NM');
    expect(f(inNorm, 5)).toBe('30');
    expect(f(inNorm, 8)).toBe('N');

    const high = toHL7v2OBX(point({ code: 'ALT', name: 'АЛТ', value: 120, unit: 'Ед/л', refLow: 0, refHigh: 41, isAbnormal: true }));
    expect(f(high, 2)).toBe('NM');
    expect(f(high, 8)).toBe('H');
  });

  it('нет референса, но запись помечена отклонённой — флаг A (сторона неизвестна)', () => {
    const seg = toHL7v2OBX(point({ code: 'CEA', name: 'РЭА', value: 12, unit: 'ng/mL', isAbnormal: true }));
    expect(f(seg, 8)).toBe('A');
  });

  it('пустая единица не оставляет пустой кусок в OBX-6', () => {
    const seg = toHL7v2OBX(point({ unit: '', refLow: undefined, refHigh: undefined, isAbnormal: undefined, bound: undefined, value: 5 }));
    expect(f(seg, 6)).toBe('');
    expect(seg.split('|')).toHaveLength(15);
  });
});
