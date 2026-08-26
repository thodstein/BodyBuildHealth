/** PeriodizationHub.tsx — унифицированный калькулятор с подвкладками.
 * Объединяет: Дизайнер, Прогрессия, Трекер, Микроциклы, Делод, Пик, Taper + Сплиты.
 * Структура как в Лаборатории упражнений (ExerciseLab). */
import React, { useState } from 'react';
import { PeriodizationDesignerTab } from './PeriodizationDesignerTab';
import { MesocycleProgressionCard } from './MesocycleProgressionCard';
import { MesocycleTrackerTab } from './MesocycleTrackerTab';
import { MicrocyclePlannerCard } from './MicrocyclePlannerCard';
import { DeloadSchedulerTab } from './DeloadSchedulerTab';
import { TaperPlannerTab } from './TaperPlannerTab';
import { SplitGenCard } from './SplitGenCard';
import { CompetitionPlansView } from './CompetitionPlansView';
const ACCENT = '#00e68a';
const DIM = '#fff';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', transition:'all 0.18s ease' } as any;
const CARD: React.CSSProperties = { ...GLASS, borderRadius: 14, padding: 12, marginBottom: 10, transition:'all 0.18s ease' } as any;
type PeriodizationHubMode = 'designer' | 'progression' | 'tracker' | 'micro' | 'deload' | 'taper' | 'splits' | 'history';

const MODE_DEFS: Array<{ m: PeriodizationHubMode; label: string; icon: string; desc: string }> = [
  { m: 'designer', label: 'Дизайнер ★ Единый', icon: '🧠', desc: 'Единый инструмент: блоки + микро + делод + прогрессия + трекер (синхронизированы)' },
  { m: 'progression', label: 'Прогрессия', icon: '📈', desc: 'Отдельно: кривая объёма/интенсивности' },
  { m: 'tracker', label: 'Трекер', icon: '📊', desc: 'Отдельно: факт vs план' },
  { m: 'micro', label: 'Микроциклы', icon: '🗓️', desc: 'Отдельно: недельный план' },
  { m: 'deload', label: 'Делод', icon: '🧘', desc: 'Отдельно: делод-планировщик' },
  { m: 'taper', label: 'Тейпер/Пик', icon: '🔻', desc: 'PL 3 нед / BB 4 нед + шоу-пик' },
  { m: 'splits', label: 'Сплиты', icon: '🧩', desc: 'Отдельно: 9 сплитов' },
  { m: 'history', label: 'История', icon: '🏁', desc: 'Сохранённые соревновательные циклы' },
];

export const PeriodizationHub: React.FC<{ initialMode?: PeriodizationHubMode }> = ({ initialMode }) => {
  const [mode, setMode] = useState<PeriodizationHubMode>(initialMode ?? 'designer');

  return (
    <div style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ ...CARD, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(168,85,247,0.10),rgba(0,230,138,0.07))', border:'1px solid rgba(168,85,247,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(168,85,247,0.14),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#a855f7,#7c3aed)', color:'#fff', fontWeight:900, fontSize:16 }}>📈</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Периодизация — Макро · Микро · Тапер/Пик</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>Актуальная блочная модель (Issurin/Bompa) — дизайн + микро + делод + прогрессия + трекер в одном потоке</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background:'rgba(168,85,247,0.12)', border:'1px solid rgba(168,85,247,0.22)', color:'#a78bfa', fontWeight:800, whiteSpace:'nowrap' }}>актуальная</span>
        </div>
        <div style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.45 }}>
          <b style={{ color:'#fff' }}>Как работает:</b> собери дизайн (ПЛ/ББ) на таймлайне → переключай <b>🗓️ Микро</b> / <b>🧘 Делод</b> / <b>📈 Прогрессия</b> / <b>📊 Трекер</b> / <b>🔻 Тейпер</b> — всё на одних данных, без дублей.
        </div>
      </div>

      <style>{`@media (max-width: 560px) { .ph-hub-nav { flex-wrap: nowrap !important; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; } .ph-hub-nav::-webkit-scrollbar { display: none; } .ph-hub-nav button { flex: 0 0 auto; } }`}</style>
      <div className="ph-hub-nav" style={{ position:'sticky', top:0, zIndex:5, background:'rgba(10,10,12,0.72)', backdropFilter:'blur(10px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'8px 8px', margin:'-2px -8px 12px', display: 'flex', gap: 8, overflowX:'auto', scrollbarWidth:'none' }}>
        {MODE_DEFS.map(({ m, label, icon, desc }) => (
          <button key={m} onClick={() => setMode(m)} title={desc} style={{
            padding: '8px 16px', borderRadius: 8, minHeight: 44,
            border: mode === m ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
            background: mode === m ? 'rgba(0,230,138,0.1)' : 'rgba(0,0,0,0.3)',
            color: mode === m ? ACCENT : DIM, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {mode === 'designer' && <PeriodizationDesignerTab />}
      {mode === 'progression' && <PeriodizationDesignerTab initialUnifiedMode="progression" />}
      {mode === 'tracker' && <PeriodizationDesignerTab initialUnifiedMode="tracker" />}
      {mode === 'micro' && <PeriodizationDesignerTab initialUnifiedMode="micro" />}
      {mode === 'deload' && <PeriodizationDesignerTab initialUnifiedMode="deload" />}
      {mode === 'taper' && <PeriodizationDesignerTab initialUnifiedMode="taper" />}
      {mode === 'splits' && <PeriodizationDesignerTab initialActivePanel="splits" />}
      {mode === 'history' && <CompetitionPlansView />}
    </div>
  );
};

/** Алиас для нового id — периодзационный тейпер-хаб (аналог VolumeHub) */
export const PeriodizationTaperHub = PeriodizationHub;

export default PeriodizationHub;
