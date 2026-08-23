/** DiagnosticsHub.tsx — ДИАГНОСТИКА ДВИЖЕНИЯ.
 *  Полный вариант как в ПЛ-авто (PlDeadpointsBarPathCard — корректор движений):
 *  слабые мышцы (BB granular) → слабые точки → мёртвые точки → движение штанги
 *  + срывы (рус), + RIR-калибровка (исправлена), + добавление упражнения.
 *  Карточки — скрываемые (кнопка-карточка). */
import React, { useMemo } from 'react';
import { PlDeadpointsBarPathCard } from './PlDeadpointsBarPathCard';
import type { WorkoutLog } from '../../../core/types';
import type { TrainingProfile } from './training-profile';
import { getCycleById } from '../../../data/lms-cycles/lms-cycle-index';

const ACCENT = '#00e68a';
const DIM = '#fff';
const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', borderRadius:14, padding:12, marginBottom:10 } as any;

export interface DiagnosticsHubProps {
  sessions: WorkoutLog[];
  tprofile: TrainingProfile;
  readinessRecovery: number;
  readinessFatigue: number;
  mesoWeeks: number;
  missedSessions: number;
  currentVolume: number;
  currentRir: number;
}

export const DiagnosticsHub: React.FC<DiagnosticsHubProps> = ({
  sessions,
}) => {
  const template = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_pl_session');
      if (raw) {
        const j = JSON.parse(raw);
        const id = j?.selectedCycleId || j?.plSelectedCycleId || j?.cycleId;
        if (id) {
          const t = getCycleById(id);
          if (t) return t;
        }
      }
    } catch {}
    return null;
  }, []);
  const dayCount = useMemo(() => {
    try {
      const t: any = template as any;
      return t?.week1?.length || 4;
    } catch { return 4; }
  }, [template]);

  return (
    <div style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ ...CARD, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(96,165,250,0.10),rgba(0,230,138,0.07))', border:'1px solid rgba(96,165,250,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(96,165,250,0.14),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#60a5fa,#a78bfa)', color:'#fff', fontWeight:900, fontSize:16 }}>🔬</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Диагностика движения — полный корректор</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>Слабые мышцы (BB granular) → слабые точки → мёртвые точки → траектория → срывы (рус) → RIR — один инструмент, без дублей</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background:'rgba(96,165,250,0.12)', border:'1px solid rgba(96,165,250,0.22)', color:'#60a5fa', fontWeight:800, whiteSpace:'nowrap' }}>9 движений</span>
        </div>
        <div style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.45 }}>
          Полный вариант как в <b style={{ color:'#a78bfa' }}>ПЛ-авто → 2 Корректор</b>: все 9 лифтов, BB granular (верх/низ груди → incline/dip), срывы на русском, добавление упражнения «➕ Своё», RIR-калибровка с план RIR (не константа 2). Карточки скрываются по клику на заголовок-кнопку.
        </div>
      </div>
      <PlDeadpointsBarPathCard dayCount={dayCount} template={template as any} sessions={sessions as any} />
    </div>
  );
};

export default DiagnosticsHub;
