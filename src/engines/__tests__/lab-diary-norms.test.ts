/**
 * lab-diary-norms.test.ts — P0: LabDiaryTab передавал пустые нормы → все inRange=true
 * До фикса: markerNorms = {ALT:{}} → inRange true даже при ALT 120 (норма 7-40)
 * После: markerNorms из UCUM_MAP → abnormalCount считается
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { UCUM_MAP } from '../../core/constants';
import { importLabsToDiary, getLabDiary, getRecentAbnormalMarkers } from '../lab-diary.engine';

beforeEach(() => {
  try { localStorage.clear(); } catch {}
  try { localStorage.removeItem('he_lab_diary'); } catch {}
});

describe('LabDiary P0 fix: нормы из UCUM_MAP', () => {
  const labs = [
    { id: '1', code: 'ALT', name: 'АЛТ', value: 120, unit: 'U/L', date: '2026-09-01' },
    { id: '2', code: 'HCT', name: 'Гематокрит', value: 55, unit: '%', date: '2026-09-01' },
    { id: '3', code: 'LDL', name: 'ЛПНП', value: 2.0, unit: 'mmol/L', date: '2026-09-01' },
  ] as any[];

  function emptyNorms(labs: any[]) {
    const m: Record<string, any> = {};
    for (const lab of labs) {
      const key = (lab.code || '').toUpperCase();
      if (!m[key]) m[key] = {};
    }
    return m;
  }

  function fixedNorms(labs: any[]) {
    const m: Record<string, any> = {};
    for (const lab of labs) {
      const key = (lab.code || '').toUpperCase();
      if (!m[key]) {
        const info = (UCUM_MAP as any)[key] || (UCUM_MAP as any)[key.toLowerCase()];
        m[key] = { lln: info?.lln, uln: info?.uln };
      }
    }
    return m;
  }

  it('баг: пустые нормы → все inRange, abnormal 0', () => {
    importLabsToDiary(labs, emptyNorms(labs));
    const diary = getLabDiary();
    expect(diary.length).toBe(1);
    expect(diary[0].abnormalCount).toBe(0);
    expect(getRecentAbnormalMarkers(diary, 365).length).toBe(0);
  });

  it('фикс: нормы из UCUM_MAP → ALT 120 и HCT 55 вне нормы, LDL 2.0 в норме', () => {
    localStorage.clear();
    importLabsToDiary(labs, fixedNorms(labs));
    const diary = getLabDiary();
    expect(diary.length).toBe(1);
    // ALT 120 >40, HCT 55 >52 → 2 аномалии, LDL 2.0 <3 → норма
    expect(diary[0].abnormalCount).toBe(2);
    const abn = getRecentAbnormalMarkers(diary, 365);
    expect(abn.length).toBe(2);
    expect(abn.map((m) => m.code).sort()).toEqual(['ALT', 'HCT']);
  });

  it('UCUM_MAP содержит нормы для базовых маркеров', () => {
    expect((UCUM_MAP as any)['ALT'].uln).toBe(40);
    expect((UCUM_MAP as any)['HCT'].uln).toBe(52);
    expect((UCUM_MAP as any)['LDL'].uln).toBe(3);
  });
});
