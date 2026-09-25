import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseArmResultJson,
  parseArmResultCsv,
  applyArmResultImport,
  normalizeArmImplement,
} from '../arm-result-import.engine';
import { loadPlatformLog } from '../arm-platform.engine';

describe('arm-result-import', () => {
  beforeEach(() => { localStorage.clear(); });

  it('normalizeArmImplement: алиасы и мусор', () => {
    expect(normalizeArmImplement('RT')).toBe('rolling_thunder');
    expect(normalizeArmImplement('rolling thunder')).toBe('rolling_thunder');
    expect(normalizeArmImplement('Axle')).toBe('apollon_axle');
    expect(normalizeArmImplement('Saxon')).toBe('saxon_bar');
    expect(normalizeArmImplement('CoC')).toBe('coc_gripper');
    expect(normalizeArmImplement('канат')).toBeNull();
    expect(normalizeArmImplement('')).toBeNull();
  });

  it('JSON: полная запись даёт попытки/лучший/%WR', () => {
    const raw = JSON.stringify({
      date: '2026-09-20',
      implement: 'rolling_thunder',
      attempts: [
        { attempt: 1, weightKg: 100, success: false },
        { attempt: 2, weightKg: 110, success: true },
        { attempt: 3, weightKg: 112.5, success: true },
      ],
    });
    const res = parseArmResultJson(raw);
    expect(res.errors).toEqual([]);
    expect(res.entries).toHaveLength(3);
    expect(res.bestKg).toBe(112.5);
    expect(res.wrPct).toBe(Math.round((112.5 / 130.5) * 1000) / 10);
    expect(res.dateIso).toBe('2026-09-20');
    expect(res.implement).toBe('rolling_thunder');
  });

  it('JSON: битый файл / нет попыток / неизвестный снаряд — честные ошибки', () => {
    expect(parseArmResultJson('{oops').errors[0]).toMatch(/не читается как JSON/);
    const noAttempts = parseArmResultJson(JSON.stringify({ implement: 'saxon_bar' }));
    expect(noAttempts.errors.some(e => /нет списка попыток/.test(e))).toBe(true);
    const badImpl = parseArmResultJson(JSON.stringify({ implement: 'канат', attempts: [{ weightKg: 100, success: true }] }));
    expect(badImpl.errors.some(e => /не распознан/.test(e))).toBe(true);
    expect(badImpl.entries).toEqual([]);
  });

  it('JSON: мусорные веса/результаты отбрасываются с предупреждением', () => {
    const raw = JSON.stringify({
      implement: 'hub',
      attempts: [
        { attempt: 1, weightKg: 'abc', success: true },
        { attempt: 2, weightKg: 40, success: 'maybe' },
        { attempt: 3, weightKg: 41.5, success: true },
        { attempt: 4, weightKg: 900, success: true },
      ],
    });
    const res = parseArmResultJson(raw);
    expect(res.entries).toEqual([{ attempt: 3, weightKg: 41.5, success: true }]);
    expect(res.warnings.length).toBe(3);
  });

  it('CSV: четыре колонки со снарядом и три без; промахи распознаются', () => {
    const raw = [
      'снаряд,попытка,вес,результат',
      'RT,1,100,промах',
      'RT,2,107.5,1',
      '3,110,0',
    ].join('\n');
    const res = parseArmResultCsv(raw, '');
    expect(res.implement).toBe('rolling_thunder');
    expect(res.entries).toEqual([
      { attempt: 1, weightKg: 100, success: false },
      { attempt: 2, weightKg: 107.5, success: true },
      { attempt: 3, weightKg: 110, success: false },
    ]);
    expect(res.bestKg).toBe(107.5);
  });

  it('CSV: запятая как десятичный разделитель при «;» + fallback-снаряд', () => {
    const raw = 'попытка,вес,результат\n1;55,5;1\n2;60;0';
    const res = parseArmResultCsv(raw, 'hub');
    expect(res.implement).toBe('hub');
    expect(res.entries[0]).toEqual({ attempt: 1, weightKg: 55.5, success: true });
    expect(res.entries[1].weightKg).toBe(60);
    expect(res.errors).toEqual([]);
  });

  it('CSV: пустой/мусорный файл — ошибка, ничего не импортируется', () => {
    const res = parseArmResultCsv('мусор\nещё мусор', 'hub');
    expect(res.entries).toEqual([]);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(loadPlatformLog()).toEqual([]);
    applyArmResultImport(res);
    expect(loadPlatformLog()).toEqual([]);
  });

  it('applyArmResultImport: попытки попадают в журнал помоста с датой соревнования', () => {
    const res = parseArmResultJson(JSON.stringify({
      date: '2026-09-20',
      implement: 'rolling_thunder',
      attempts: [{ attempt: 1, weightKg: 100, success: false }, { attempt: 2, weightKg: 110, success: true }],
    }));
    const log = applyArmResultImport(res);
    expect(log).toHaveLength(2);
    expect(log[0].date).toBe('2026-09-20');
    expect(log[0].implement).toBe('rolling_thunder');
    expect(log[0].success).toBe(false);
    expect(log[1].weightKg).toBe(110);
    expect(log[1].wrPct).toBe(Math.round((110 / 130.5) * 1000) / 10);
    expect(loadPlatformLog()).toHaveLength(2);
  });
});
