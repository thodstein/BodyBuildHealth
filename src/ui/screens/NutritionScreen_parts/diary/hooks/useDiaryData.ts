import { useState, useEffect, useCallback } from 'react';
import { readDiaryV2, writeDiaryV2, onDiaryChangeV2 } from '../../diary-storage-v2';

export function useDiaryData({ onDiaryChange }: { onDiaryChange?: () => void }) {
  const [diaryData, setDiaryData] = useState<Record<string, any>>(() => readDiaryV2());
  const [refreshKey, setRefreshKey] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Diary storage listener
  useEffect(() => {
    return onDiaryChangeV2(setDiaryData);
  }, []);

  const bumpRefresh = useCallback(() => { setRefreshKey(k => k + 1); }, []);

  const saveDiary = useCallback((data: any) => {
    try {
      writeDiaryV2(data);
      setDiaryData(data);
      setRefreshKey(k => k + 1);
      onDiaryChange?.();
      setStorageError(null);
    } catch (e) {
      console.error('Diary save error:', e);
      const errorMsg = e instanceof Error ? e.message : 'неизвестная ошибка';
      setStorageError('Ошибка сохранения дневника: ' + errorMsg);
    }
  }, [onDiaryChange]);

  return { diaryData, setDiaryData, refreshKey, bumpRefresh, saveDiary, storageError, setStorageError };
}
