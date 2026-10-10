import { describe, it, expect } from 'vitest';
import {
  isoDateOrToday,
  labsStatusForCount,
  isNewerLabDate,
  mergeLabsSummary,
  applyLabsSummaryToProfile,
} from '../labs-profile-sync';

const TODAY = '2026-10-10';

describe('labs-profile-sync: isoDateOrToday', () => {
  it('accepts a valid ISO date as-is', () => {
    expect(isoDateOrToday('2026-03-05', TODAY)).toBe('2026-03-05');
  });

  it('falls back to today for garbage / missing dates', () => {
    expect(isoDateOrToday(undefined, TODAY)).toBe(TODAY);
    expect(isoDateOrToday('', TODAY)).toBe(TODAY);
    expect(isoDateOrToday('10.03.2026', TODAY)).toBe(TODAY);
    expect(isoDateOrToday(null, TODAY)).toBe(TODAY);
  });
});

describe('labs-profile-sync: labsStatusForCount', () => {
  it('none / partial / complete', () => {
    expect(labsStatusForCount(0)).toBe('none');
    expect(labsStatusForCount(-1)).toBe('none');
    expect(labsStatusForCount(Number.NaN)).toBe('none');
    expect(labsStatusForCount(1)).toBe('partial');
    expect(labsStatusForCount(7)).toBe('partial');
    expect(labsStatusForCount(8)).toBe('complete');
    expect(labsStatusForCount(20)).toBe('complete');
  });
});

describe('labs-profile-sync: isNewerLabDate', () => {
  it('дата из будущего относительно записи побеждает, обратное — нет', () => {
    expect(isNewerLabDate('2026-05-01', '2026-01-01')).toBe(true);
    expect(isNewerLabDate('2026-01-01', '2026-05-01')).toBe(false);
    expect(isNewerLabDate('2026-05-01', '2026-05-01')).toBe(false);
  });

  it('невалидная дата не побеждает', () => {
    expect(isNewerLabDate(undefined, '2026-01-01')).toBe(false);
    expect(isNewerLabDate('10.05.2026', undefined)).toBe(false);
    expect(isNewerLabDate(undefined, undefined)).toBe(false);
  });
});

describe('labs-profile-sync: mergeLabsSummary', () => {
  it('сохраняет чужие коды и добавляет новые', () => {
    const out = mergeLabsSummary(
      { ALT: { value: 20, date: '2026-01-01' } },
      [{ code: 'CRP', value: 3.1, date: '2026-02-01' }],
      undefined,
      TODAY,
    );
    expect(Object.keys(out.summary).sort()).toEqual(['ALT', 'CRP']);
    expect(out.enteredCount).toBe(2);
    expect(out.status).toBe('partial');
    expect(out.lastEnteredDate).toBe('2026-02-01');
  });

  it('свежая запись заменяет старую по тому же коду', () => {
    const out = mergeLabsSummary(
      { ALT: { value: 20, date: '2026-01-01', unit: 'U/L' } },
      [{ code: 'ALT', value: 55, date: '2026-06-01', unit: 'U/L' }],
      undefined,
      TODAY,
    );
    expect(out.summary.ALT).toEqual({ value: 55, date: '2026-06-01', unit: 'U/L' });
  });

  it('импорт СТАРОГО бланка не затирает свежие значения', () => {
    const out = mergeLabsSummary(
      { ALT: { value: 55, date: '2026-06-01' } },
      [{ code: 'ALT', value: 20, date: '2026-01-01' }],
      undefined,
      TODAY,
    );
    expect(out.summary.ALT.value).toBe(55);
    expect(out.summary.ALT.date).toBe('2026-06-01');
  });

  it('общая дата бланка используется, если у записи своей даты нет', () => {
    const out = mergeLabsSummary(
      {},
      [{ code: 'ALT', value: 30 }],
      '2026-04-04',
      TODAY,
    );
    expect(out.summary.ALT).toEqual({ value: 30, date: '2026-04-04', unit: undefined });
    expect(out.lastEnteredDate).toBe('2026-04-04');
  });

  it('нормализует код к верхнему регистру', () => {
    const out = mergeLabsSummary({}, [{ code: ' alt ', value: 12, date: '2026-01-01' }], undefined, TODAY);
    expect(out.summary.ALT.value).toBe(12);
  });

  it('мусорные значения пропускаются, пустой вход не пишет профиль', () => {
    const out = mergeLabsSummary(
      {},
      [
        { code: '', value: 10, date: '2026-01-01' },
        { code: 'ALT', value: Number.NaN, date: '2026-01-01' },
      ],
      undefined,
      TODAY,
    );
    expect(out.summary).toEqual({});
    expect(out.status).toBe('none');
    expect(out.lastEnteredDate).toBeUndefined();
  });

  it('битые существующие записи не роняют слияние', () => {
    const out = mergeLabsSummary(
      { ALT: null as any, X: 'нет' as any, GOOD: { value: 5, date: '2026-01-01' } },
      [{ code: 'NEW', value: 7, date: '2026-01-01' }],
      undefined,
      TODAY,
    );
    expect(out.summary.GOOD.value).toBe(5);
    expect(out.summary.NEW.value).toBe(7);
    expect(Object.keys(out.summary)).toHaveLength(2);
  });

  it('lastEnteredDate = самая свежая из сводки', () => {
    const out = mergeLabsSummary(
      { A: { value: 1, date: '2026-09-09' }, B: { value: 2, date: '2026-01-01' } },
      [{ code: 'C', value: 3, date: '2026-05-05' }],
      undefined,
      TODAY,
    );
    expect(out.lastEnteredDate).toBe('2026-09-09');
  });
});

describe('labs-profile-sync: applyLabsSummaryToProfile', () => {
  it('пишет merged-сводку в настройки профиля, сохраняя остальные разделы', () => {
    let written: any = null;
    const ok = applyLabsSummaryToProfile(
      [{ code: 'ALT', value: 40, date: '2026-03-03', unit: 'U/L' }],
      undefined,
      TODAY,
      () => ({ settings: { personal: { weight: 80 }, labs: { status: 'none', summary: {} } } }),
      (patch) => { written = patch; },
    );
    expect(ok).toBe(true);
    expect(written.settings.personal).toEqual({ weight: 80 });
    expect(written.settings.labs.summary.ALT).toEqual({ value: 40, date: '2026-03-03', unit: 'U/L' });
    expect(written.settings.labs.status).toBe('partial');
    expect(written.settings.labs.lastEnteredDate).toBe('2026-03-03');
  });

  it('пустой/битый вход ничего не пишет', () => {
    let called = false;
    const ok = applyLabsSummaryToProfile(
      [] as any,
      undefined,
      TODAY,
      () => ({ settings: {} }),
      () => { called = true; },
    );
    expect(ok).toBe(false);
    expect(called).toBe(false);
  });

  it('ошибка доступа к профилю не бросается', () => {
    const ok = applyLabsSummaryToProfile(
      [{ code: 'ALT', value: 40 }],
      undefined,
      TODAY,
      () => { throw new Error('no profile'); },
      () => {},
    );
    expect(ok).toBe(false);
  });
});
