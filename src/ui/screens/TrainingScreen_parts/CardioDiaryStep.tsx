/**
 * CardioDiaryStep.tsx — шаг 5 v3: таб-эксклюзив.
 * Сессия (сегодня+таймер) | Аналитика (график+нагрузка+HR) | Журнал (импорт+дневник)
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
import { Tabs } from './CardioUI';
import { CardioImportPanel } from './CardioImportPanel';
import { CardioAnalyticsDashboard } from './CardioAnalyticsDashboard';
import { CardioFieldTestLog } from './CardioFieldTestLog';

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

  const [tab, setTab] = useState<'session' | 'analytics' | 'log'>('session');
  const TABS = [
    { id: 'session', label: 'Сегодня', icon: '⚡' },
    { id: 'analytics', label: 'Аналитика', icon: '📈' },
    { id: 'log', label: 'Журнал', icon: '📓' },
  ] as const;

  return (
    <div className="train-cardiodiarystep" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Tabs tabs={TABS as unknown as { id: string; label: string; icon?: string }[]} active={tab} onChange={v => setTab(v as typeof tab)} />

      {tab === 'session' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
            <CardioDayCard cycle={localCycle} log={log} srpe={srpe} />
            <CardioProgressCard cycle={localCycle} log={log} />
          </div>
          {startInfo && (
            <div style={{ fontSize: 11, color: startInfo.left === 0 ? '#f87171' : '#fbbf24', background: 'linear-gradient(180deg, rgba(245,158,11,0.10), rgba(245,158,11,0.03))', border: '1px solid rgba(245,158,11,0.3)', borderLeft: `3px solid ${startInfo.left === 0 ? '#ef4444' : '#f59e0b'}`, borderRadius: 12, padding: '10px 12px' }}>
              {startInfo.left === 0
                ? `🏁 Эта неделя — старт (${CARDIO_PHASE_LABELS[startInfo.phase]}): только лёгкое кардио (recovery), без HIIT.`
                : `🏁 Старт через ${startInfo.left} нед (нед ${startInfo.week}, ${CARDIO_PHASE_LABELS[startInfo.phase]}): taper снижает объём — HIIT уже убран; контролируйте вес (0.5-1%/нед) и сон.${startInfo.lastWeight != null ? ` Последний вес: ${startInfo.lastWeight} кг.` : ''}`}
            </div>
          )}
          <CardioSessionTimer cycle={localCycle} onSaved={reloadLog} onReschedule={handleReschedule} />
        </div>
      )}
      {tab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <CardioVolumeChart cycle={localCycle} log={log} />
          <CardioAnalyticsDashboard cycle={localCycle} log={log} />
          <CardioAutoTunePanel cycle={localCycle} acwr={acwr} onChanged={reloadLog} />
        </div>
      )}
      {tab === 'log' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <CardioImportPanel onImported={reloadLog} />
          <CardioDiaryPanel cycle={localCycle} acwr={acwr} recoveryLow={recoveryLow} onApplyWeightAdjust={onApplyWeightAdjust} log={log} onLogChanged={reloadLog} />
          <CardioFieldTestLog />
        </div>
      )}
    </div>
  );
};
