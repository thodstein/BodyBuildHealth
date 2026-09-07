/**
 * lab-diary-dedup.test.ts — P0: импорт дублировал код на одну дату →×2
 * До: day.markers.push без проверки → 2×ALT на 2026-09-01 → abnormal 2
 * После: дедуп по коду, последняя побеждает → 1×ALT
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { importLabsToDiary, getLabDiary } from '../lab-diary.engine';

beforeEach(() => {
  try { localStorage.clear(); } catch {}
  try { localStorage.removeItem('he_lab_diary'); } catch {}
});

describe('LabDiary dedup P0', () => {
  it('дубль ALT на одну дату → 1 маркер (последний побеждает)', () => {
    const labs = [
      { id: '1', code: 'ALT', name: 'АЛТ', value: 30, unit: 'U/L', date: '2026-09-01' },
      { id: '2', code: 'ALT', name: 'АЛТ', value: 120, unit: 'U/L', date: '2026-09-01' },
    ] as any[];
    importLabsToDiary(labs, { ALT: { lln: 7, uln: 40 } });
    const diary = getLabDiary();
    expect(diary.length).toBe(1);
    expect(diary[0].markers.length).toBe(1);
    expect(diary[0].markers[0].value).toBe(120);
    expect(diary[0].abnormalCount).toBe(1);
  });

  it('разные коды на одну дату → 2 маркера, разные даты → 2 дня', () => {
    const labs = [
      { id: '1', code: 'ALT', name: 'АЛТ', value: 30, unit: 'U/L', date: '2026-09-01' },
      { id: '2', code: 'HCT', name: 'Гематокрит', value: 45, unit: '%', date: '2026-09-01' },
      { id: '3', code: 'ALT', name: 'АЛТ', value: 30, unit: 'U/L', date: '2026-09-02' },
    ] as any[];
    importLabsToDiary(labs, { ALT: { lln: 7, uln: 40 }, HCT: { lln: 36, uln: 52 } });
    const diary = getLabDiary();
    expect(diary.length).toBe(2);
    expect(diary.find(d => d.date === '2026-09-01')!.markers.length).toBe(2);
    expect(diary.find(d => d.date === '2026-09-02')!.markers.length).toBe(1);
  });

  it('пустые нормы → все inRange, но дедуп всё равно работает', () => {
    const labs = [
      { id: '1', code: 'ALT', name: 'АЛТ', value: 30, unit: 'U/L', date: '2026-09-01' },
      { id: '2', code: 'ALT', name: 'АЛТ', value: 40, unit: 'U/L', date: '2026-09-01' },
    ] as any[];
    importLabsToDiary(labs, {});
    const diary = getLabDiary();
    expect(diary[0].markers.length).toBe(1);
    expect(diary[0].markers[0].value).toBe(40);
  });
});
