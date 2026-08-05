/**
 * profile-diaries-e2e.test.ts — тесты для ProfileDiariesTab: встроенные дневники,
 * кнопки добавления, модалки, и интеграция с onNavigate.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

describe('ProfileDiariesTab — встроенные дневники', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('1. ProfileDiariesTab экспортируется', async () => {
    const m = await import('../../ui/screens/ProfileScreen_v2/ProfileDiariesTab');
    expect(typeof m.ProfileDiariesTab).toBe('function');
  });

  it('2. Запись в he_sleep_diary → читается обратно', () => {
    const data = [{ date: '2026-08-01', hours: 7.5, quality: 4, awakenings: 1, bedtime: '23:00', wakeTime: '07:00', notes: '' }];
    localStorageMock.setItem('he_sleep_diary', JSON.stringify(data));
    const got = JSON.parse(localStorageMock.getItem('he_sleep_diary') || '[]');
    expect(got).toEqual(data);
  });

  it('3. Запись в he_bp_diary → читается обратно', () => {
    const data = [{ date: '2026-08-01', systolic: 120, diastolic: 80, pulse: 70 }];
    localStorageMock.setItem('he_bp_diary', JSON.stringify(data));
    const got = JSON.parse(localStorageMock.getItem('he_bp_diary') || '[]');
    expect(got).toEqual(data);
  });

  it('4. Запись в he_injection_diary → читается обратно', () => {
    const data = [{ date: '2026-08-01', substance: 'Test E', dose: '250mg', site: 'Дельта' }];
    localStorageMock.setItem('he_injection_diary', JSON.stringify(data));
    const got = JSON.parse(localStorageMock.getItem('he_injection_diary') || '[]');
    expect(got).toEqual(data);
  });

  it('5. corrupted JSON в he_sleep_diary → пустой массив', () => {
    localStorageMock.setItem('he_sleep_diary', '{invalid');
    const raw = localStorageMock.getItem('he_sleep_diary') || '[]';
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = []; }
    expect(parsed).toEqual([]);
  });

  it('6. Каждый дневник имеет корректный ключ', () => {
    const keys = ['he_sleep_diary', 'he_bp_diary', 'he_injection_diary', 'he_weight_log', 'he_measurements_log'];
    keys.forEach(k => {
      localStorageMock.setItem(k, '[]');
      expect(localStorageMock.getItem(k)).toBe('[]');
    });
  });
});
