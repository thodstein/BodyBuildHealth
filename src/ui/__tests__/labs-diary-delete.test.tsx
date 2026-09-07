/**
 * labs-diary-delete.test.tsx — P0: удаление из дневника не удаляло лабы → пересоздавалось
 * До: removeLabDiaryDay только localStorage, labs в IndexedDB оставались → mount с labs=[ALT] → import пересоздавал
 * После: handleDeleteEntry удаляет и labs_log по date
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as diaryEngine from '../../engines/lab-diary.engine';

// mock db
const mockGetByIndex = vi.fn(async () => [{ id: '1', date: '2026-09-01', code: 'ALT' }]);
const mockDelete = vi.fn(async () => {});
const mockInit = vi.fn(async () => {});
vi.mock('../../core/db', () => ({
  db: {
    init: (...a: any[]) => mockInit(...a),
    getByIndex: (...a: any[]) => mockGetByIndex(...a),
    delete: (...a: any[]) => mockDelete(...a),
  },
}));
vi.mock('../../core/data-link', async () => {
  const actual = await vi.importActual<typeof import('../../core/data-link')>('../../core/data-link');
  return { ...actual, notifyDataChange: vi.fn(), useDataLink: () => ({ labs: [], profile: { settings: {} }, course: [] }) };
});

import { LabDiaryTab } from '../screens/LabsScreen_parts/LabDiaryTab';

beforeEach(() => {
  try { localStorage.clear(); } catch {}
  mockGetByIndex.mockClear();
  mockDelete.mockClear();
  mockInit.mockClear();
  // seed diary with one entry
  const entry = {
    date: '2026-09-01',
    markers: [{ code: 'ALT', name: 'АЛТ', value: 120, unit: 'U/L', lln: 7, uln: 40, inRange: false }],
    totalMarkers: 1,
    abnormalCount: 1,
  };
  localStorage.setItem('he_lab_diary', JSON.stringify([entry]));
});

describe('LabDiary delete P0', () => {
  it('engine: remove + import с теми же лабами пересоздаёт (демонстрация бага)', () => {
    const labs = [{ id: '1', code: 'ALT', name: 'АЛТ', value: 120, unit: 'U/L', date: '2026-09-01' }] as any[];
    // simulate old behavior: only remove diary
    diaryEngine.removeLabDiaryDay('2026-09-01');
    expect(diaryEngine.getLabDiary().length).toBe(0);
    // re-import with same labs (old code would do this on mount) → пересоздаёт
    diaryEngine.importLabsToDiary(labs, { ALT: { lln: 7, uln: 40 } });
    expect(diaryEngine.getLabDiary().length).toBe(1);
  });

  it('component: handleDelete удаляет и labs_log (проверка вызова db)', async () => {
    const labs = [{ id: '1', code: 'ALT', name: 'АЛТ', value: 120, unit: 'U/L', date: '2026-09-01' }] as any[];
    render(<LabDiaryTab labs={labs} />);
    // switch to timeline to see delete button
    const timelineBtn = screen.getByText('📋 История');
    fireEvent.click(timelineBtn);
    await waitFor(() => expect(screen.getByText('2026-09-01')).not.toBeNull());
    const del = screen.getByLabelText('Удалить 2026-09-01') as HTMLButtonElement;
    fireEvent.click(del);
    await waitFor(() => {
      expect(mockInit).toHaveBeenCalled();
      expect(mockGetByIndex).toHaveBeenCalledWith('labs_log', 'date', '2026-09-01');
      expect(mockDelete).toHaveBeenCalledWith('labs_log', '1');
    });
  });
});
