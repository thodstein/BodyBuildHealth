/**
 * lab-blank-mirror.test.ts — E7: бланк доходит до дневника-зеркала и отчёта.
 *
 * `syncLabsToDiary` раньше брал норму только из `getLabNorm` (каталог), поэтому
 * `inRange` в дневнике и статус в комплексном отчёте могли говорить «выше нормы»
 * там, где бланк дал другой интервал. Теперь пара `refLow/refHigh` записи главнее
 * каталога и помечается `normSource: 'blank'`; отчёт предпочитает её.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getLabDiary, syncLabsToDiary } from '../lab-diary.engine';
import { reportRefsForMarker } from '../comprehensive-report.engine';

const lab = (extra: Record<string, unknown> = {}) => ({
  id: 'p1',
  code: 'PROLACTIN',
  name: 'Пролактин',
  value: 400,
  unit: 'мЕд/л',
  date: '2026-11-01',
  ...extra,
});

beforeEach(() => {
  localStorage.clear();
});

describe('дневник-зеркало: норма бланка главнее каталога', () => {
  it('пара бланка 50–600: marker.normSource = blank, inRange доказан', () => {
    syncLabsToDiary([lab({ refLow: 50, refHigh: 600 })], 'male', { complete: true });
    const marker = getLabDiary()[0].markers[0];
    expect(marker.normSource).toBe('blank');
    expect(marker.lln).toBe(50);
    expect(marker.uln).toBe(600);
    expect(marker.inRange).toBe(true);
  });

  it('одна граница — не пара: остаётся каталог', () => {
    syncLabsToDiary([lab({ refLow: 50 })], 'male', { complete: true });
    const marker = getLabDiary()[0].markers[0];
    expect(marker.normSource).toBe('catalog');
    expect(marker.uln).not.toBe(600);
  });

  it('перевёрнутый интервал не применяется', () => {
    syncLabsToDiary([lab({ refLow: 600, refHigh: 50 })], 'male', { complete: true });
    const marker = getLabDiary()[0].markers[0];
    expect(marker.normSource).toBe('catalog');
    expect(marker.lln).not.toBe(600);
  });
});

describe('отчёт: приоритет нормы', () => {
  it('бланк главнее каталога и таблицы группы', () => {
    expect(
      reportRefsForMarker(
        { normSource: 'blank', lln: 50, uln: 600 },
        { refLow: 100, refHigh: 350 },
        { refLow: 0, refHigh: 400 },
      ),
    ).toEqual({ refLow: 50, refHigh: 600 });
  });

  it('каталог главнее таблицы группы', () => {
    expect(
      reportRefsForMarker(
        { normSource: 'catalog', lln: 100, uln: 350 },
        { refLow: 80, refHigh: 300 },
        { refLow: 0, refHigh: 400 },
      ),
    ).toEqual({ refLow: 80, refHigh: 300 });
  });

  it('нет записи в дневнике — таблица группы', () => {
    expect(reportRefsForMarker(null, null, { refLow: 0, refHigh: 400 })).toEqual({ refLow: 0, refHigh: 400 });
  });
});
