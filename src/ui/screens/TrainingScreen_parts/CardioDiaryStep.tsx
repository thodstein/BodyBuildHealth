/**
 * CardioDiaryStep.tsx — шаг 5 мастера кардио: быстрый старт сессии (таймер),
 * прогресс цикла, старт-контроль, авто-режим (подстройка по дневнику),
 * дневник выполнения, график план vs факт.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  saveCardioCycleVersion, saveCardioCycle, setActiveCardioCycle,
  cardioWeekForDate, CARDIO_PHASE_LABELS,
  type CardioCycle,
} from '../../../engines/lms/cardio.engine';
import { loadCardioLog, type CardioLogEntry } from '../../../engines/lms/cardio-diary.engine';
import { loadSRPESessions, type SRPESession } from '../../../engines/pro/srpe-store';
import { getWeightLog } from '../../../engines/profile-store';
import { CardioDiaryPanel } from './CardioDiaryPanel';
import { CardioAutoTunePanel } from './CardioAutoTunePanel';
import { CardioSessionTimer } from './CardioSessionTimer';
import { CardioProgressCard } from './CardioProgressCard';
import { CardioVolumeChart } from './CardioVolumeChart';
import { CardioDayCard } from './CardioDayCard';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CardioDiaryStep: React.FC<{
  cycle: CardioCycle | null;
  acwr?: number | null;
  recoveryLow: boolean;
  onChanged: () => void;
  onApplyWeightAdjust?: () => void;
}> = ({ cycle, acwr, recoveryLow, onChanged, onApplyWeightAdjust }) => {
  // Локальная копия цикла: перенос сессии (↗) меняет план здесь же, без пересборки.
  const [localCycle, setLocalCycle] = useState<CardioCycle | null>(cycle);
  useEffect(() => { setLocalCycle(cycle); }, [cycle]);
  const [log, setLog] = useState<CardioLogEntry[]>(() => loadCardioLog());
  const [srpe, setSrpe] = useState<SRPESession[]>(() => loadSRPESessions());
  const reloadLog = useCallback(() => { setLog(loadCardioLog()); setSrpe(loadSRPESessions()); onChanged(); }, [onChanged]);

  const handleReschedule = useCallback((next: CardioCycle) => {
    saveCardioCycleVersion(localCycle ?? next, '↗ перенос сессии');
    saveCardioCycle(next);
    setActiveCardioCycle(next);
    setLocalCycle(next);
    reloadLog();
  }, [localCycle, reloadLog]);

  // Старт-контроль (5C): ближайший taper/peak впереди + последний вес.
  const startInfo = useMemo(() => {
    if (!localCycle) return null;
    const w = cardioWeekForDate(localCycle, todayIso(), localCycle.startDate);
    const current = w?.week ?? 1;
    const start = localCycle.weeks.find(x => x.week >= current && (x.phase === 'taper' || x.phase === 'peak'));
    if (!start) return null;
    let lastWeight: number | null = null;
    try {
      const weights = getWeightLog();
      const sorted = Array.isArray(weights) ? [...weights].filter(e => Number.isFinite(e.weight)).sort((a, b) => (a.date < b.date ? 1 : -1)) : [];
      if (sorted.length > 0) lastWeight = sorted[0].weight;
    } catch { /* ignore */ }
    return { week: start.week, left: Math.max(0, start.week - current), phase: start.phase, lastWeight };
  }, [localCycle]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <CardioDayCard cycle={localCycle} log={log} srpe={srpe} />
      <CardioProgressCard cycle={localCycle} log={log} />
      {startInfo && (
        <div className="ck-week" style={{ fontSize: 11, color: startInfo.left === 0 ? '#f87171' : '#fbbf24', background: 'linear-gradient(180deg, rgba(245,158,11,0.10), rgba(245,158,11,0.03))', border: '1px solid rgba(245,158,11,0.3)', borderLeft: `3px solid ${startInfo.left === 0 ? '#ef4444' : '#f59e0b'}`, borderRadius: 12, padding: '8px 10px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
          {startInfo.left === 0
            ? `🏁 Эта неделя — старт (${CARDIO_PHASE_LABELS[startInfo.phase]}): только лёгкое кардио (recovery), без HIIT.`
            : `🏁 Старт через ${startInfo.left} нед (нед ${startInfo.week}, ${CARDIO_PHASE_LABELS[startInfo.phase]}): taper снижает объём — HIIT уже убран; контролируйте вес (темп 0.5-1%/нед) и сон.${startInfo.lastWeight != null ? ` Последний вес: ${startInfo.lastWeight} кг.` : ''}`}
        </div>
      )}
      <CardioSessionTimer cycle={localCycle} onSaved={reloadLog} onReschedule={handleReschedule} />
      <CardioAutoTunePanel cycle={localCycle} acwr={acwr} onChanged={reloadLog} />
      <CardioVolumeChart cycle={localCycle} log={log} />
      <CardioDiaryPanel cycle={localCycle} acwr={acwr} recoveryLow={recoveryLow} onApplyWeightAdjust={onApplyWeightAdjust} log={log} onLogChanged={reloadLog} />
    </div>
  );
};
