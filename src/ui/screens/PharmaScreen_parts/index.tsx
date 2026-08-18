import React, { useState, useMemo, useEffect } from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';
import { PharmaScoreCard } from '../../components/PharmaScoreCard';
import { PharmaCourseScreen } from '../PharmaCourseScreen';
import { useDataLink } from '../../../core/data-link';
import { PHARMA_CLASSES, type PharmaClass } from './constants';
import { CatalogTab } from './CatalogTab';
import { PKPDSimulationTab } from './PKPDSimulationTab';
import { DosageCalculatorTab } from './DosageCalculatorTab';
import { InteractionCheckerTab } from './InteractionCheckerTab';
import { MapperTab } from './MapperTab';
import { DiagnosticsTab } from './DiagnosticsTab';
import { PharmaPeptideCalc } from './PharmaPeptideCalc';
import { PharmaReportsTab } from './PharmaReportsTab';

type PharmaPage = 'main' | 'course' | 'calculators' | 'info' | 'reports';
type SubTab = 'catalog' | 'pkpd' | 'dosage' | 'peptides' | 'mapper' | 'diagnostics' | 'interactions';

export const PharmaScreen: React.FC<{ initialSubTab?: string }> = ({ initialSubTab }) => {
  const [page, setPage] = useState<PharmaPage>('main');
  const [subTab, setSubTab] = useState<SubTab>('catalog');
  const linked = useDataLink();

  // Прямой переход из Профиля/других блоков: «Мой курс» → страница курса,
  // «Фарма-отчёт» → страница отчёта (а не hero).
  useEffect(() => {
    if (initialSubTab === 'course') setPage('course');
    else if (initialSubTab === 'reports') setPage('reports');
  }, [initialSubTab]);

  useEffect(() => {
    try {
      if (localStorage.getItem('he_nav_pharma_diary') === '1') {
        localStorage.removeItem('he_nav_pharma_diary');
        setPage('course');
      }
    } catch {}
  }, []);

  const pharmaSubstances = useMemo(() => {
    return Object.values(PHARMA_DB).filter(s =>
      PHARMA_CLASSES.includes(s.class as PharmaClass)
    );
  }, []);

  const scoreCourse = useMemo(() =>
    (linked.course || []).map((c: any) => ({ substanceId: c.substanceId || '', dose: c.doseValue || 0, unit: c.doseUnit || 'мг', weeks: (c.endWeek || 12) - (c.startWeek || 0) })),
    [linked.course]
  );

  if (page === 'main') {
    const cards = [
      { key:'course' as const, icon:'📋', title:'Курс', desc:'Управление курсом, препараты, дозировки, фазы', color:'#8b5cf6' },
      { key:'reports' as const, icon:'📄', title:'Фарма-отчёт', desc:'Состав, валидация, взаимодействия, риск', color:'#f59e0b' },
      { key:'calculators' as const, icon:'⚙️', title:'Калькуляторы', desc:'PK/PD · Дозировки · Пептиды · Маппер · Диагностика', color:'#3b82f6' },
      { key:'info' as const, icon:'📖', title:'Общая информация', desc:'Каталог веществ и проверка взаимодействий', color:'#22c55e' },
    ];
    return (
      <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
        <img src="/pharma-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
        <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 2px', textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Фармакология</h1>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.9)', margin:'0 0 16px', lineHeight:1.3, textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
            Курс, PK/PD симуляция, каталог веществ и проверка взаимодействий
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {cards.map(c => (
              <button key={c.key} onClick={() => setPage(c.key)} style={{
                display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:14,
                cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)', color:'var(--text)',
              }}>
                <div style={{ width:44, height:44, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0, background:c.color+'18', fontSize:22 }}>{c.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, marginBottom:2, color:c.color }}>{c.title}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.85)', lineHeight:1.3 }}>{c.desc}</div>
                </div>
                <span style={{ color:c.color, fontSize:18, opacity:0.6 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen pharma">
      <button onClick={() => setPage('main')} style={{
        padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer', flexShrink:0, marginBottom:6,
        background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-dim)', fontWeight:600,
      }}>← Назад</button>

      {page === 'info' && (
        <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:12,
          background:'var(--glass-bg)', border:'1px solid var(--glass-border)',
        }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:8 }}>📊 Сводка расчётов</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            <div style={{ flex:'1 1 45%', minWidth:90, padding:'8px 6px', borderRadius:8, textAlign:'center',
              background:'rgba(0,230,138,0.08)',
            }}>
              <div style={{ fontSize:8, color:'var(--text-dim)' }}>Препаратов в курсе</div>
              <div style={{ fontSize:18, fontWeight:800 }}>{linked.course.length}</div>
            </div>
            <div style={{ flex:'1 1 45%', minWidth:90, padding:'8px 6px', borderRadius:8, textAlign:'center',
              background:'rgba(0,230,138,0.08)',
            }}>
              <div style={{ fontSize:8, color:'var(--text-dim)' }}>Общий риск</div>
              <div style={{ fontSize:18, fontWeight:800, color: (linked.risk?.overallNet ?? 0) >= 60 ? '#ef4444' : (linked.risk?.overallNet ?? 0) >= 30 ? '#f59e0b' : '#00e68a' }}>
                {linked.risk ? `${Math.round(linked.risk.overallNet)}%` : '—'}
              </div>
            </div>
          </div>
          {Object.keys(linked.activeDrugs).length > 0 && (
            <div style={{ marginTop:6, fontSize:10, color:'var(--text-dim)' }}>
              Активные вещества: {Object.keys(linked.activeDrugs).map(d => PHARMA_DB[d]?.name || d).join(', ')}
            </div>
          )}
          <PharmaScoreCard
            course={scoreCourse}
            weight={linked.profile?.settings?.weight || 80}
            age={linked.profile?.settings?.age || 30}
            sex={linked.profile?.settings?.sex || 'male'}
          />
        </div>
      )}
      <div style={{ display:'flex', gap:4, overflowX:'auto', marginBottom:8, scrollbarWidth:'none' }}>
{page === 'course' && (
  <button style={{
    padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap', cursor:'default', flexShrink:0,
    background:'var(--accent)', color:'#000', border:'1px solid var(--accent)',
  }}>📋 Курс</button>
)}
{page === 'reports' && (
  <button style={{
    padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap', cursor:'default', flexShrink:0,
    background:'var(--accent)', color:'#000', border:'1px solid var(--accent)',
  }}>📄 Фарма-отчёт</button>
)}
{page === 'calculators' && (['pkpd','dosage','peptides','mapper','diagnostics'] as const).map(t => (
  <button key={t} onClick={() => setSubTab(t)} style={{
    padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
    cursor:'pointer', flexShrink:0,
    background: subTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
    color: subTab === t ? '#000' : 'var(--text-dim)',
    border: `1px solid ${subTab === t ? 'var(--accent)' : 'var(--border)'}`,
  }}>{t === 'pkpd' ? '⚙️ PK/PD' : t === 'dosage' ? '💊 Дозировки' : t === 'peptides' ? '🧪 Пептиды' : t === 'mapper' ? '🗺 Маппер' : '🩺 Диагностика'}</button>
))}
        {page === 'info' && (['catalog','interactions'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
            cursor:'pointer', flexShrink:0,
            background: subTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
            color: subTab === t ? '#000' : 'var(--text-dim)',
            border: `1px solid ${subTab === t ? 'var(--accent)' : 'var(--border)'}`,
          }}>{t === 'catalog' ? '📖 Каталог' : '⚡ Взаимодействия'}</button>
        ))}
      </div>
      {page === 'course' && <PharmaCourseScreen />}
      {page === 'reports' && <PharmaReportsTab />}
      {page === 'calculators' && subTab === 'pkpd' && <PKPDSimulationTab />}
      {page === 'calculators' && subTab === 'dosage' && <DosageCalculatorTab />}
      {page === 'calculators' && subTab === 'peptides' && <PharmaPeptideCalc />}
      {page === 'calculators' && subTab === 'mapper' && <MapperTab />}
      {page === 'calculators' && subTab === 'diagnostics' && <DiagnosticsTab />}
      {page === 'info' && subTab === 'catalog' && <CatalogTab />}
      {page === 'info' && subTab === 'interactions' && <InteractionCheckerTab />}
    </div>
  );
};