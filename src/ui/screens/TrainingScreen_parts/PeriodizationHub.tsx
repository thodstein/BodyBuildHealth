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

  const [heroOpen, setHeroOpen] = useState(false);
  return (
    <div className="train-periodhub" style={{ padding: '8px 8px 18px', color: '#fff', maxWidth: 760, margin: '0 auto', scrollMarginTop: 8 }}>
      <style>{`
        @media (max-width: 560px) { .ph-hub-nav { flex-wrap: nowrap !important; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; } .ph-hub-nav::-webkit-scrollbar { display: none; } .ph-hub-nav button { flex: 0 0 auto; } }
        .train-periodhub .ph-hub-body { scroll-margin-top: 64px; }
        .train-periodhub .ph-hub-nav button:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 1px; }
      `}</style>
      {/* Компактная плавающая шапка: одна строка, не закрывает контент */}
      <div className="ph-hub-nav" style={{ position:'sticky', top:0, zIndex:20, background:'rgba(10,10,14,0.88)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'6px', margin:'0 0 10px', display:'flex', gap:6, alignItems:'center', overflowX:'auto', scrollbarWidth:'none', boxShadow:'0 6px 20px rgba(0,0,0,0.35)' }}>
        <button onClick={() => setHeroOpen(v => !v)} title="О хабе" aria-label="О хабе периодизации" style={{ flex:'0 0 auto', width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#a855f7,#7c3aed)', color:'#fff', fontWeight:900, fontSize:15, border:'none', cursor:'pointer' }}>📈</button>
        <div style={{ flex:'0 0 auto', minWidth:0, lineHeight:1.15, marginRight:2 }}>
          <div style={{ fontSize:12, fontWeight:900, color:'#fff', whiteSpace:'nowrap' }}>Периодизация</div>
          <div style={{ fontSize:9, color:DIM, whiteSpace:'nowrap' }}>Макро · Микро · Тапер</div>
        </div>
        <div style={{ width:1, alignSelf:'stretch', background:'rgba(255,255,255,0.08)', flex:'0 0 auto' }} />
        {MODE_DEFS.map(({ m, label, icon, desc }) => (
          <button key={m} onClick={() => setMode(m)} title={desc} aria-pressed={mode === m} style={{
            padding: '6px 10px', borderRadius: 9, minHeight: 36, whiteSpace:'nowrap',
            border: mode === m ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
            background: mode === m ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
            color: mode === m ? ACCENT : DIM, cursor: 'pointer', fontSize: 11, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {icon} {label}
          </button>
        ))}
      </div>
      {heroOpen && (
        <div style={{ ...CARD, padding:'10px 12px', background:'linear-gradient(135deg,rgba(168,85,247,0.10),rgba(0,230,138,0.07))', border:'1px solid rgba(168,85,247,0.18)', position:'relative', overflow:'hidden', marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:900, color:'#fff', marginBottom:4 }}>📈 Периодизация — Макро · Микро · Тапер/Пик <span style={{ fontSize:9, padding:'2px 7px', borderRadius:20, background:'rgba(168,85,247,0.12)', border:'1px solid rgba(168,85,247,0.22)', color:'#a78bfa', fontWeight:800 }}>актуальная</span></div>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.45 }}>Блочная модель (Issurin/Bompa): собери дизайн на таймлайне → переключай <b>🗓️ Микро</b> / <b>🧘 Делод</b> / <b>📈 Прогрессия</b> / <b>📊 Трекер</b> / <b>🔻 Тейпер</b> — всё на одних данных.</div>
          <button onClick={() => setHeroOpen(false)} style={{ marginTop:8, padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:DIM, fontSize:10, fontWeight:700, cursor:'pointer', minHeight:32 }}>Скрыть</button>
        </div>
      )}

      <div className="ph-hub-body">
      {mode === 'designer' && <PeriodizationDesignerTab />}
      {mode === 'progression' && <PeriodizationDesignerTab initialUnifiedMode="progression" />}
      {mode === 'tracker' && <PeriodizationDesignerTab initialUnifiedMode="tracker" />}
      {mode === 'micro' && <PeriodizationDesignerTab initialUnifiedMode="micro" />}
      {mode === 'deload' && <PeriodizationDesignerTab initialUnifiedMode="deload" />}
      {mode === 'taper' && <PeriodizationDesignerTab initialUnifiedMode="taper" />}
      {mode === 'splits' && <PeriodizationDesignerTab initialActivePanel="splits" />}
      {mode === 'history' && <CompetitionPlansView />}
      </div>
    </div>
  );
};

/** Алиас для нового id — периодзационный тейпер-хаб (аналог VolumeHub) */
export const PeriodizationTaperHub = PeriodizationHub;

export default PeriodizationHub;
