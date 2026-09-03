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
      { key:'course' as const, icon:'💊', title:'Курс', desc:'Препараты, дозировки, фазы цикла', color:'#8b5cf6', accent:'rgba(139,92,246,0.18)', border:'rgba(139,92,246,0.28)' },
      { key:'reports' as const, icon:'📊', title:'Фарма-отчёт', desc:'Состав · валидация · взаимодействия · риск', color:'#f59e0b', accent:'rgba(245,158,11,0.18)', border:'rgba(245,158,11,0.28)' },
      { key:'calculators' as const, icon:'🧬', title:'Калькуляторы', desc:'PK/PD · Дозировки · Пептиды · Маппер', color:'#3b82f6', accent:'rgba(59,130,246,0.18)', border:'rgba(59,130,246,0.28)' },
      { key:'info' as const, icon:'📚', title:'Каталог и знания', desc:'Вещества, взаимодействия, синергии', color:'#22c55e', accent:'rgba(34,197,94,0.18)', border:'rgba(34,197,94,0.28)' },
    ];
    const courseLen = linked.course?.length ?? 0;
    const risk = linked.risk?.overallNet;
    return (
      <div className="pharma-hero" style={{ position:'fixed', inset:0, zIndex:5, display:'flex', flexDirection:'column', overflow:'hidden', background:'#050508' }}>
        <img src="/pharma-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', opacity:1 }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 0%, transparent 62%, rgba(0,0,0,0.10) 88%, rgba(0,0,0,0.18) 100%)' }} />

        {/* header — без стекла, hero открыт */}
        <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px calc(20px + var(--nav-height,68px) + env(safe-area-inset-bottom))', maxWidth:560, width:'100%', margin:'0 auto' }}>
          <div style={{ marginBottom:14 }}>
            <h1 className="pharma-hero-title" style={{ fontSize:26, fontWeight:900, color:'#fff', margin:'0 0 6px', letterSpacing:-0.8, lineHeight:1, textShadow:'0 2px 20px rgba(0,0,0,0.9)' }}>
              Фармакология
            </h1>
            <p className="pharma-hero-sub" style={{ fontSize:12.5, color:'#fff', margin:'0 0 12px', lineHeight:1.45, textShadow:'0 1px 12px rgba(0,0,0,0.85)', maxWidth:360 }}>
              Курс, PK/PD симуляция, каталог веществ и проверка взаимодействий — всё в одном хабе
            </p>
            {/* quick stats — без пилюль, без стекла */}
            <div className="pharma-hero-quickstats" style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:11, opacity:0.9 }}>💊</span>
                <span style={{ fontSize:11, color:'#fff', fontWeight:700 }}>В курсе <b>{courseLen}</b></span>
              </div>
              <div style={{ width:1, height:14, background:'rgba(255,255,255,0.15)', alignSelf:'center' }} />
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:11 }}>{(risk ?? 0) >=60 ? '🔴' : (risk ?? 0) >=30 ? '🟡' : '🟢'}</span>
                <span style={{ fontSize:11, color:'#fff', fontWeight:700 }}>Риск <b style={{ color: (risk ?? 0) >=60 ? '#ef4444' : (risk ?? 0) >=30 ? '#f59e0b' : '#00e68a' }}>{risk != null ? `${Math.round(risk)}%` : '—'}</b></span>
              </div>
              <div style={{ width:1, height:14, background:'rgba(255,255,255,0.15)', alignSelf:'center' }} />
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:11, opacity:0.9 }}>🧬</span>
                <span style={{ fontSize:11, color:'#fff', fontWeight:700 }}>Каталог <b>{pharmaSubstances.length}</b></span>
              </div>
            </div>
          </div>

          <div className="pharma-hero-cards" style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {cards.map(c => (
              <button key={c.key} onClick={() => setPage(c.key)} className="pharma-hero-card" data-key={c.key} style={{
                display:'flex', alignItems:'center', gap:12, padding:'11px 12px', borderRadius:14,
                cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(18,18,20,0.62)', border:'1px solid rgba(255,255,255,0.12)',
                backdropFilter:'none', WebkitBackdropFilter:'none',
                boxShadow:'0 3px 12px rgba(0,0,0,0.30)',
                transition:'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.borderColor=`${c.color}40`; (e.currentTarget as HTMLButtonElement).style.boxShadow=`0 6px 18px rgba(0,0,0,0.32), 0 0 0 1px ${c.color}18 inset`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform='translateY(0)'; (e.currentTarget as HTMLButtonElement).style.borderColor='rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.boxShadow='0 3px 12px rgba(0,0,0,0.30)'; }}
              >
                <div style={{ width:40, height:40, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0, background:`${c.color}18`, border:`1px solid ${c.color}22`, fontSize:18 }}>{c.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:800, marginBottom:1, color:'#fff', letterSpacing:-0.2, display:'flex', alignItems:'center', gap:6, textShadow:'0 1px 10px rgba(0,0,0,0.7)' }}>
                    {c.title}
                    <span style={{ width:5, height:5, borderRadius:'50%', background:c.color }} />
                  </div>
                  <div style={{ fontSize:10.5, color:'#fff', lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textShadow:'0 1px 8px rgba(0,0,0,0.6)' }}>{c.desc}</div>
                </div>
                <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.10)', border:'1px solid rgba(255,255,255,0.14)', color:'#fff', fontSize:12, flexShrink:0 }}>→</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop:10, textAlign:'center', fontSize:10, color:'#fff' }}>Нажми на раздел — откроются инструменты и данные</div>
        </div>
      </div>
    );
  }

  const pageTitle: Record<PharmaPage, string> = { main:'Фармакология', course:'Курс', calculators:'Калькуляторы', info:'Каталог', reports:'Фарма-отчёт' };
  const pageIcon: Record<PharmaPage, string> = { main:'💊', course:'💊', calculators:'🧬', info:'📚', reports:'📊' };

  return (
    <div className="screen pharma pharma-inner" style={{ padding:'12px 12px 0', display:'flex', flexDirection:'column', height:'100%', minHeight:0, overflow:'hidden' }}>
      {/* header bar */}
      <div className="pharma-head" style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexShrink:0 }}>
        <button onClick={() => setPage('main')} style={{
          display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:20, fontSize:11, cursor:'pointer', fontWeight:700,
          background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff', backdropFilter:'blur(8px)',
        }}>← Назад</button>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
          <span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.22)', fontSize:13 }}>{pageIcon[page]}</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#fff', lineHeight:1 }}>{pageTitle[page]}</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1 }}>
              {page==='course' ? `${linked.course.length} преп. • ${Math.max(1, linked.course.reduce((m,c)=>Math.max(m,(c.endWeek||12)-(c.startWeek||0)),4))} нед` : page==='calculators' ? 'PK/PD · Дозировки · Пептиды' : page==='info' ? `${pharmaSubstances.length} веществ • взаимодействия` : page==='reports' ? 'Состав · валидация · риск' : ''}
            </div>
          </div>
        </div>
        {(page==='course' || page==='reports' || page==='info') && (
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            <span style={{ fontSize:10, color:'#fff' }}>{linked.course.length}💊</span>
            <span style={{ fontSize:10, fontWeight:700, color: (linked.risk?.overallNet ?? 0) >=60 ? '#ef4444' : (linked.risk?.overallNet ?? 0) >=30 ? '#f59e0b' : '#00e68a' }}>{linked.risk ? `${Math.round(linked.risk.overallNet)}%` : '—'}</span>
          </div>
        )}
      </div>

      {page === 'info' && (
        <div style={{ marginBottom:10, padding:'12px 14px', borderRadius:14,
          background:'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(59,130,246,0.06))', border:'1px solid rgba(139,92,246,0.16)', flexShrink:0,
          backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
        }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#a78bfa', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>📊 Сводка расчётов <span style={{ marginLeft:'auto', fontSize:10, color:'#fff', fontWeight:600 }}>{pharmaSubstances.length} веществ</span></div>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1, padding:'10px 8px', borderRadius:12, textAlign:'center',
              background:'rgba(0,0,0,0.22)', border:'1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize:8, color:'#fff', letterSpacing:0.4, fontWeight:700, textTransform:'uppercase' as const }}>Препаратов в курсе</div>
              <div style={{ fontSize:20, fontWeight:900, color:'#fff', marginTop:2 }}>{linked.course.length}</div>
            </div>
            <div style={{ flex:1, padding:'10px 8px', borderRadius:12, textAlign:'center',
              background:'rgba(0,0,0,0.22)', border:'1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize:8, color:'#fff', letterSpacing:0.4, fontWeight:700, textTransform:'uppercase' as const }}>Общий риск</div>
              <div style={{ fontSize:20, fontWeight:900, color: (linked.risk?.overallNet ?? 0) >= 60 ? '#ef4444' : (linked.risk?.overallNet ?? 0) >= 30 ? '#f59e0b' : '#00e68a', marginTop:2 }}>
                {linked.risk ? `${Math.round(linked.risk.overallNet)}%` : '—'}
              </div>
            </div>
          </div>
          {Object.keys(linked.activeDrugs).length > 0 && (
            <div style={{ marginTop:8, fontSize:10, color:'#fff', lineHeight:1.4, background:'rgba(0,0,0,0.18)', padding:'6px 8px', borderRadius:8, border:'1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color:'#fff', fontWeight:700 }}>Активные:</span> {Object.keys(linked.activeDrugs).map(d => PHARMA_DB[d]?.name || d).join(' • ')}
            </div>
          )}
          <div style={{ marginTop:8 }}>
            <PharmaScoreCard
              course={scoreCourse}
              weight={linked.profile?.settings?.weight || 80}
              age={linked.profile?.settings?.age || 30}
              sex={linked.profile?.settings?.sex || 'male'}
            />
          </div>
        </div>
      )}

      {/* tabs — компактные, без пилюль */}
      <div style={{ display:'flex', gap:2, overflowX:'auto', overflowY:'hidden', marginBottom:8, scrollbarWidth:'none', WebkitOverflowScrolling:'touch' as any, flexWrap:'nowrap', flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:0 }}>
      {page === 'course' && (
        <span style={{
          display:'inline-flex', alignItems:'center', gap:5, padding:'5px 0 6px', fontSize:10, fontWeight:800, whiteSpace:'nowrap', flexShrink:0,
          color:'#a78bfa', borderBottom:'2px solid #8b5cf6', marginBottom:-1,
        }}>📋 Курс <span style={{ color:'#fff', fontWeight:700 }}>{linked.course.length}</span></span>
      )}
      {page === 'reports' && (
        <span style={{
          display:'inline-flex', alignItems:'center', gap:5, padding:'5px 0 6px', fontSize:10, fontWeight:800, whiteSpace:'nowrap', flexShrink:0,
          color:'#fbbf24', borderBottom:'2px solid #f59e0b', marginBottom:-1,
        }}>📊 Фарма-отчёт</span>
      )}
      {page === 'calculators' && (['pkpd','dosage','peptides','mapper','diagnostics'] as const).map(t => (
        <button key={t} onClick={() => setSubTab(t)} style={{
          padding:'5px 7px 6px', fontSize:10, fontWeight:700, whiteSpace:'nowrap',
          cursor:'pointer', flexShrink:0, transition:'all 0.14s ease', background:'transparent', border:'none', borderBottom: subTab===t ? '2px solid #3b82f6' : '2px solid transparent', borderRadius:0, marginBottom:-1,
          color: subTab === t ? '#fff' : 'rgba(255,255,255,0.52)',
        }}>{t === 'pkpd' ? 'PK/PD' : t === 'dosage' ? 'Дозировки' : t === 'peptides' ? 'Пептиды' : t === 'mapper' ? 'Маппер' : 'Диагностика'}</button>
      ))}
      {page === 'info' && (['catalog','interactions'] as const).map(t => (
        <button key={t} onClick={() => setSubTab(t)} style={{
          padding:'5px 7px 6px', fontSize:10, fontWeight:700, whiteSpace:'nowrap',
          cursor:'pointer', flexShrink:0, transition:'all 0.14s ease', background:'transparent', border:'none', borderBottom: subTab===t ? '2px solid #22c55e' : '2px solid transparent', borderRadius:0, marginBottom:-1,
          color: subTab === t ? '#fff' : 'rgba(255,255,255,0.52)',
        }}>{t === 'catalog' ? 'Каталог' : 'Взаимодействия'}</button>
      ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', WebkitOverflowScrolling:'touch' as any, paddingBottom:'calc(var(--nav-height,68px) + 28px + env(safe-area-inset-bottom))', minHeight:0 }}>
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
    </div>
  );
};
