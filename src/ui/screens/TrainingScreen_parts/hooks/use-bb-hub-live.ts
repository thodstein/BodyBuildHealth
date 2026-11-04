/**
 * use-bb-hub-live.ts — живые источники ББ-диагностики: дневник, факт-объём, ACWR, план.
 *
 * Второй срез волны 3 плана хабов. Раньше эти пять мемо жили в `BBDiagnosticsHub.tsx`
 * вместе с обработчиками. Контракт 1:1:
 *  - дневник перечитывается при `storage`/`focus`/`visibilitychange` (AUDIT 2026-11:
 *    раньше читался один раз при монтировании и правка в другой вкладке не доезжала);
 *  - факт-объём — канонический `aggregateBBVolume` (direct + EMG-indirect), окно
 *    календарное (`localIsoDateOffset`), а не UTC-сутки;
 *  - сохранённый план читается ОДИН раз на рендер и перечитывается по `planNonce`
 *    (инъекция/откат меняют хранилище мимо мемо);
 *  - отсутствие данных — `null`/`{}`, а не нули: хаб печатает «нет данных».
 */
import { useEffect, useMemo, useState } from 'react';
import { localIsoDateOffset } from '../../../../core/local-date';
import { loadHubDiarySessions } from '../../../../engines/hub-diary.engine';
import { aggregateBBVolume } from '../../../../engines/bb/bb-volume.engine';
import { analyzeBBBalance } from '../../../../engines/bb/bb-balance.engine';
import { computePerMuscleACWR } from '../../../../engines/bb/bb-progression-feedback.engine';
import { readSavedBbPlan } from '../bb-hub-state';

export type BbHubLive = {
  /** Тик перечитывания дневника (storage/focus/visibility). */
  diaryNonce: number;
  diarySessions: any[];
  factVolume: any;
  perMuscleAcwr: any;
  savedPlan: any;
  balance: any;
};

/**
 * @param planNonce тик перечитывания плана из хранилища (владелец — хаб: инъекция/откат).
 */
export function useBbHubLive(planNonce: number): BbHubLive {
  /**
   * AUDIT 2026-11: дневник читался ОДИН раз при монтировании (deps=[]), поэтому
   * тренировка, записанная в другой вкладке/экране, не попадала в диагностику до
   * перезагрузки. Обновляем при возврате к приложению и при storage-событии.
   */
  const [diaryNonce, setDiaryNonce] = useState(0);
  useEffect(() => {
    const bump = () => setDiaryNonce(n => n + 1);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || /he_workout_log|he_bb_diagnostics_hub/.test(e.key)) bump();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') bump(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', bump);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', bump);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const diarySessions: any[] = useMemo(() => {
    // ROUND-10: единый адаптер (живой he_workout_log_v2; цепочка `||` с `'[]'` глушила v2)
    try { return loadHubDiarySessions(); } catch { return []; }
  }, [diaryNonce]);

  const factVolume = useMemo(() => {
    try {
      // последние 7 дней факт (effective). Окно — КАЛЕНДАРНОЕ (localIsoDateOffset):
      // `new Date('YYYY-MM-DD')` — полночь UTC, и в зонах UTC− окно съезжало на сутки
      // (сессия 6-дневной давности выпадала/заезжала).
      const from = localIsoDateOffset(-7);
      const recent = diarySessions.filter((s: any) => {
        const d = String(s.date || '').slice(0, 10);
        return d && d >= from;
      });
      if (recent.length === 0) return null;
      // 3.11: факт-объём через канонический aggregateBBVolume (direct + EMG-indirect),
      // а не своя сумма «direct = effective» без косвенной нагрузки.
      const exercises = recent.flatMap((s: any) => ((s.exercises || []) as any[]).map((ex) => ({
        name: String(ex.exerciseName || ex.name || ''),
        muscle: String(ex.muscleGroup || ex.muscle || '').toLowerCase(),
        sets: Array.isArray(ex.sets) ? ex.sets.length : Math.max(0, Number(ex.sets) || 0),
        rir: Number(ex.rir) || 2,
        role: 'accessory' as const,
      })).filter((e) => e.muscle && e.sets > 0));
      if (exercises.length === 0) return null;
      return aggregateBBVolume([{ exercises }]);
    } catch { return null; }
  }, [diarySessions]);

  const perMuscleAcwr = useMemo(() => {
    try { return computePerMuscleACWR(diarySessions as any); } catch { return {}; }
  }, [diarySessions]);

  // Э5-доводка (R6): сохранённый план читается ОДИН раз на рендер (было 3 точки readSavedBbPlan)
  const savedPlan = useMemo(() => {
    try { return readSavedBbPlan(); } catch { return null; }
  }, [planNonce, diarySessions]);

  const balance = useMemo(() => {
    try {
      if (savedPlan?.weeks) return analyzeBBBalance(savedPlan);
      return null;
    } catch { return null; }
  }, [savedPlan]);

  return { diaryNonce, diarySessions, factVolume, perMuscleAcwr, savedPlan, balance };
}
