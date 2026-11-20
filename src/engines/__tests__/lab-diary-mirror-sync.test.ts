/**
 * lab-diary-mirror-sync.test.ts — проход 161: зеркало дневника обновляется из
 * склада без открытия вкладки «Дневник».
 *
 * Отчёт (`comprehensive-report.engine`) и опции калькулятора читают именно зеркало
 * `he_lab_diary`, а писалось оно только на вкладке «Дневник»: бланк, введённый в
 * этой сессии, до отчёта не доезжал. Теперь зеркало приводит `data-link` при каждом
 * чтении склада, а нормы для вердикта берутся из единственного резолвера.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLabDiary, syncLabsToDiary } from '../lab-diary.engine';
import { getLabNorm } from '../lab-norms.engine';

const lab = (value: number, date = '2026-09-20') =>
  ({ id: 'l1', code: 'ALT', name: 'АЛТ', value, unit: 'U/L', date });

beforeEach(() => localStorage.clear());

describe('проход 161: syncLabsToDiary', () => {
  it('пишет день с нормой из резолвера и вердиктом', () => {
    syncLabsToDiary([lab(30)], 'male');
    const day = getLabDiary().find(d => d.date === '2026-09-20')!;
    expect(day).toBeTruthy();
    const norm = getLabNorm('ALT', 'male')!;
    expect(day.markers[0]).toMatchObject({ code: 'ALT', value: 30, lln: norm.lln, uln: norm.uln, inRange: true });
    expect(day.abnormalCount).toBe(0);
  });

  it('правка значения того же дня доезжает до зеркала (число дней не меняется)', () => {
    syncLabsToDiary([lab(30)], 'male');
    syncLabsToDiary([lab(45)], 'male');
    const diary = getLabDiary();
    expect(diary).toHaveLength(1);
    expect(diary[0].markers[0].value).toBe(45);
    expect(diary[0].markers[0].inRange).toBe(false);
  });

  it('пустой склад не стирает зеркало (данные приходят асинхронно)', () => {
    syncLabsToDiary([lab(30)], 'male');
    syncLabsToDiary([], 'male');
    expect(getLabDiary()).toHaveLength(1);
  });

  it('без изменений зеркало не перезаписывается', () => {
    syncLabsToDiary([lab(30)], 'male');
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    try {
      syncLabsToDiary([lab(30)], 'male');
      const writes = spy.mock.calls.filter(c => String(c[0]) === 'he_lab_diary');
      expect(writes).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('проход 161: одно правило записи зеркала', () => {
  const src = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

  it('data-link приводит зеркало к прочитанному складу', () => {
    expect(src('src/core/data-link.ts')).toMatch(/syncLabsToDiary\(userLabs/);
  });

  it('вкладка дневника не собирает нормы своей копией', () => {
    const tab = src('src/ui/screens/LabsScreen_parts/LabDiaryTab.tsx');
    expect(tab).toContain('syncLabsToDiary(labs, sex)');
    expect(tab).not.toContain('markerNorms');
    expect(tab).not.toContain('importLabsToDiary(');
  });
});
