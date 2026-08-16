/**
 * CardioDayCard.tsx — карточка «📅 Кардио и нагрузка дня»: план на сегодня из
 * активного цикла, факт из кардио-журнала и суммарная нагрузка дня
 * (кардио + силовые sRPE). Является кардио-слоем в дневнике/конструкторах.
 */
import React, { useMemo } from 'react';
import { cardioEquipmentLabel, loadActiveCardioCycle, type CardioCycle, type CardioType } from '../../../engines/lms/cardio.engine';
import { cardioDayLoad, loadCardioLog } from '../../../engines/lms/cardio-diary.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const BTN: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(0,230,138,0.4)', background: 'rgba(0,230,138,0.12)',
  color: '#00e68a', minHeight: 32, whiteSpace: 'nowrap',
};

const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Recovery' };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CardioDayCard: React.FC<{ cycle?: CardioCycle | null; onOpen?: () => void }> = ({ cycle: cycleProp, onOpen }) => {
  const cycle = cycleProp !== undefined ? cycleProp : loadActiveCardioCycle();
  const log = useMemo(() => loadCardioLog(), []);
  const srpe = useMemo(() => loadSRPESessions(), []);

  const today = todayIso();
  const load = useMemo(() => cardioDayLoad(cycle, log, srpe, today, cycle?.startDate), [cycle, log, srpe, today]);

  return (
    <div style={CARD}>
      <div style={ROW}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>📅 Кардио и нагрузка дня</span>
        <button
          style={BTN}
          onClick={() => { if (onOpen) onOpen(); else { try { localStorage.setItem('he_training_planning_track', 'cardio'); } catch { /* ignore */ } window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'cardio' })); } }}
          aria-label="Открыть кардио-дневник"
        >
          ▶ Дневник
        </button>
      </div>

      {cycle && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
          {load.planned.length === 0
            ? 'План: кардио на сегодня нет.'
            : 'План: ' + load.planned.map(s => `${TYPE_LABEL[s.type]} ${s.durationMin} мин${s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}${s.targetHr?.max ? ' · ЧСС ' + s.targetHr.min + '-' + s.targetHr.max : ''}`).join(' · ')}
        </div>
      )}
      <div style={{ fontSize: 11, color: load.done.length > 0 ? '#4ade80' : 'rgba(255,255,255,0.45)' }}>
        Факт: {load.done.length === 0
          ? 'кардио не записано.'
          : `${load.done.length} сессий · ${load.cardioMinutes} мин${load.done.some(e => e.rpe != null) ? ' · RPE ' + (load.done.filter(e => e.rpe != null).reduce((s, e) => s + (e.rpe ?? 0), 0) / load.done.filter(e => e.rpe != null).length).toFixed(1) : ''}`}
      </div>
      {(load.cardioMinutes > 0 || load.strengthSessions > 0) && (
        <div style={{ fontSize: 11, color: '#fbbf24' }}>
          🔥 Нагрузка дня: кардио {load.cardioMinutes} мин (нагр. {load.cardioLoad}) · сила {load.strengthSessions} сесс. (нагр. {load.strengthLoad}) · итого {load.totalLoad}
        </div>
      )}
    </div>
  );
};
