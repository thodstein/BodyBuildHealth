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
      <div style={{ position:'fixed', inset:0, zIndex:5, display:'flex', flexDirection:'column', overflow:'hidden', background:'#050508' }}>
        <img src="/pharma-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', opacity:0.92 }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.18) 32%, rgba(5,5,12,0.62) 58%, rgba(5,5,12,0.92) 82%, #050508 100%)' }} />
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 820px 420px at 50% 18%, rgba(139,92,246,0.14), transparent 62%), radial-gradient(ellipse 560px 360px at 92% 42%, rgba(0,230,138,0.07), transparent 62%)', pointerEvents:'none' }} />

        {/* header badge + stats */}
        <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px calc(20px + var(--nav-height,68px) + env(safe-area-inset-bottom))', maxWidth:560, width:'100%', margin:'0 auto' }}>
          <div style={{ marginBottom:14 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:20, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', marginBottom:10 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#00e68a', boxShadow:'0 0 8px rgba(0,230,138,0.7)' }} />
              <span style={{ fontSize:9, fontWeight:800, letterSpacing:0.7, color:'rgba(255,255,255,0.92)', textTransform:'uppercase' as const }}>Pharma · BioStack</span>
              <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)' }}>• {pharmaSubstances.length} веществ</span>
            </div>
            <h1 style={{ fontSize:26, fontWeight:900, color:'#fff', margin:'0 0 6px', letterSpacing:-0.8, lineHeight:1, textShadow:'0 2px 18px rgba(0,0,0,0.85), 0 0 24px rgba(139,92,246,0.18)' }}>
              Фармакология
            </h1>
            <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.82)', margin:'0 0 12px', lineHeight:1.45, textShadow:'0 1px 10px rgba(0,0,0,0.75)', maxWidth:360 }}>
              Курс, PK/PD симуляция, каталог веществ и проверка взаимодействий — всё в одном хабе
            </p>
            {/* quick stats */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 10px', borderRadius:12, background:'rgba(0,0,0,0.42)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)' }}>
                <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.18)', fontSize:11 }}>💊</span>
                <div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', lineHeight:1 }}>В курсе</div>
                  <div style={{ fontSize:13, fontWeight:800, color:'#fff', lineHeight:1 }}>{courseLen}</div>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 10px', borderRadius:12, background:'rgba(0,0,0,0.42)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)' }}>
                <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background: (risk ?? 0) >=60 ? 'rgba(239,68,68,0.18)' : (risk ?? 0) >=30 ? 'rgba(245,158,11,0.18)' : 'rgba(0,230,138,0.18)', fontSize:11 }}>{(risk ?? 0) >=60 ? '🔴' : (risk ?? 0) >=30 ? '🟡' : '🟢'}</span>
                <div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', lineHeight:1 }}>Риск</div>
                  <div style={{ fontSize:13, fontWeight:800, color: (risk ?? 0) >=60 ? '#ef4444' : (risk ?? 0) >=30 ? '#f59e0b' : '#00e68a', lineHeight:1 }}>{risk != null ? `${Math.round(risk)}%` : '—'}</div>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 10px', borderRadius:12, background:'rgba(0,0,0,0.42)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)' }}>
                <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(59,130,246,0.18)', fontSize:11 }}>🧬</span>
                <div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', lineHeight:1 }}>Каталог</div>
                  <div style={{ fontSize:13, fontWeight:800, color:'#fff', lineHeight:1 }}>{pharmaSubstances.length}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {cards.map(c => (
              <button key={c.key} onClick={() => setPage(c.key)} style={{
                display:'flex', alignItems:'center', gap:13, padding:'13px 14px', borderRadius:16,
                cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(18,18,22,0.58)', border:'1px solid rgba(255,255,255,0.07)',
                backdropFilter:'blur(18px) saturate(140%)', WebkitBackdropFilter:'blur(18px) saturate(140%)',
                boxShadow:'0 8px 32px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.06)',
                transition:'transform 0.18s ease, border-color 0.18s ease, background 0.18s ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.borderColor=c.border; (e.currentTarget as HTMLButtonElement).style.background='rgba(22,22,28,0.72)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform='translateY(0)'; (e.currentTarget as HTMLButtonElement).style.borderColor='rgba(255,255,255,0.07)'; (e.currentTarget as HTMLButtonElement).style.background='rgba(18,18,22,0.58)'; }}
              >
                <div style={{ width:46, height:46, borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0, background:`linear-gradient(135deg, ${c.color}28, ${c.color}10)`, border:`1px solid ${c.color}22`, fontSize:20, boxShadow:`0 4px 16px ${c.color}18` }}>{c.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:800, marginBottom:2, color:'#fff', letterSpacing:-0.2, display:'flex', alignItems:'center', gap:6 }}>
                    {c.title}
                    <span style={{ width:5, height:5, borderRadius:'50%', background:c.color, boxShadow:`0 0 8px ${c.color}` }} />
                  </div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.62)', lineHeight:1.35, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.desc}</div>
                </div>
                <span style={{ width:30, height:30, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:c.color, fontSize:14, flexShrink:0 }}>→</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop:10, textAlign:'center', fontSize:10, color:'rgba(255,255,255,0.38)' }}>Нажми на раздел — откроются инструменты и данные</div>
        </div>
      </div>
    );
  }

  const pageTitle: Record<PharmaPage, string> = { main:'Фармакология', course:'Курс', calculators:'Калькуляторы', info:'Каталог', reports:'Фарма-отчёт' };
  const pageIcon: Record<PharmaPage, string> = { main:'💊', course:'💊', calculators:'🧬', info:'📚', reports:'📊' };

  return (
    <div className="screen pharma" style={{ padding:'12px 12px 0', display:'flex', flexDirection:'column', height:'100%', minHeight:0, overflow:'hidden' }}>
      {/* header bar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexShrink:0 }}>
        <button onClick={() => setPage('main')} style={{
          display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:20, fontSize:11, cursor:'pointer', fontWeight:700,
          background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'rgba(255,255,255,0.92)', backdropFilter:'blur(8px)',
        }}>← Назад</button>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
          <span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.22)', fontSize:13 }}>{pageIcon[page]}</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#fff', lineHeight:1 }}>{pageTitle[page]}</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', lineHeight:1 }}>
              {page==='course' ? `${linked.course.length} преп. • ${Math.max(1, linked.course.reduce((m,c)=>Math.max(m,(c.endWeek||12)-(c.startWeek||0)),4))} нед` : page==='calculators' ? 'PK/PD · Дозировки · Пептиды' : page==='info' ? `${pharmaSubstances.length} веществ • взаимодействия` : page==='reports' ? 'Состав · валидация · риск' : ''}
            </div>
          </div>
        </div>
        {(page==='course' || page==='reports' || page==='info') && (
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>{linked.course.length}💊</span>
            <span style={{ fontSize:10, fontWeight:700, color: (linked.risk?.overallNet ?? 0) >=60 ? '#ef4444' : (linked.risk?.overallNet ?? 0) >=30 ? '#f59e0b' : '#00e68a' }}>{linked.risk ? `${Math.round(linked.risk.overallNet)}%` : '—'}</span>
          </div>
        )}
      </div>

      {page === 'info' && (
        <div style={{ marginBottom:10, padding:'12px 14px', borderRadius:14,
          background:'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(59,130,246,0.06))', border:'1px solid rgba(139,92,246,0.16)', flexShrink:0,
          backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
        }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#a78bfa', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>📊 Сводка расчётов <span style={{ marginLeft:'auto', fontSize:10, color:'rgba(255,255,255,0.5)', fontWeight:600 }}>{pharmaSubstances.length} веществ</span></div>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1, padding:'10px 8px', borderRadius:12, textAlign:'center',
              background:'rgba(0,0,0,0.22)', border:'1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', letterSpacing:0.4, fontWeight:700, textTransform:'uppercase' as const }}>Препаратов в курсе</div>
              <div style={{ fontSize:20, fontWeight:900, color:'#fff', marginTop:2 }}>{linked.course.length}</div>
            </div>
            <div style={{ flex:1, padding:'10px 8px', borderRadius:12, textAlign:'center',
              background:'rgba(0,0,0,0.22)', border:'1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', letterSpacing:0.4, fontWeight:700, textTransform:'uppercase' as const }}>Общий риск</div>
              <div style={{ fontSize:20, fontWeight:900, color: (linked.risk?.overallNet ?? 0) >= 60 ? '#ef4444' : (linked.risk?.overallNet ?? 0) >= 30 ? '#f59e0b' : '#00e68a', marginTop:2 }}>
                {linked.risk ? `${Math.round(linked.risk.overallNet)}%` : '—'}
              </div>
            </div>
          </div>
          {Object.keys(linked.activeDrugs).length > 0 && (
            <div style={{ marginTop:8, fontSize:10, color:'rgba(255,255,255,0.62)', lineHeight:1.4, background:'rgba(0,0,0,0.18)', padding:'6px 8px', borderRadius:8, border:'1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color:'rgba(255,255,255,0.45)', fontWeight:700 }}>Активные:</span> {Object.keys(linked.activeDrugs).map(d => PHARMA_DB[d]?.name || d).join(' • ')}
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

      {/* pill nav */}
      <div style={{ display:'flex', gap:6, overflowX:'auto', overflowY:'hidden', marginBottom:10, scrollbarWidth:'none', WebkitOverflowScrolling:'touch' as any, flexWrap:'nowrap', paddingBottom:2, flexShrink:0, paddingRight:4 }}>
      {page === 'course' && (
        <span style={{
          display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:20, fontSize:11, fontWeight:800, whiteSpace:'nowrap', flexShrink:0,
          background:'linear-gradient(135deg, #8b5cf6, #7c3aed)', color:'#fff', border:'1px solid rgba(139,92,246,0.35)', boxShadow:'0 4px 16px rgba(139,92,246,0.28)',
        }}>📋 Курс <span style={{ background:'rgba(255,255,255,0.18)', padding:'1px 6px', borderRadius:10, fontSize:10 }}>{linked.course.length}</span></span>
      )}
      {page === 'reports' && (
        <span style={{
          display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:20, fontSize:11, fontWeight:800, whiteSpace:'nowrap', flexShrink:0,
          background:'linear-gradient(135deg, #f59e0b, #e07b00)', color:'#fff', border:'1px solid rgba(245,158,11,0.35)', boxShadow:'0 4px 16px rgba(245,158,11,0.22)',
        }}>📊 Фарма-отчёт</span>
      )}
      {page === 'calculators' && (['pkpd','dosage','peptides','mapper','diagnostics'] as const).map(t => (
        <button key={t} onClick={() => setSubTab(t)} style={{
          padding:'7px 13px', borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:'nowrap',
          cursor:'pointer', flexShrink:0, transition:'all 0.18s ease',
          background: subTab === t ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(255,255,255,0.06)',
          color: subTab === t ? '#fff' : 'rgba(255,255,255,0.72)',
          border: `1px solid ${subTab === t ? 'rgba(59,130,246,0.45)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: subTab===t ? '0 4px 14px rgba(59,130,246,0.28)' : 'none',
        }}>{t === 'pkpd' ? '⚗️ PK/PD' : t === 'dosage' ? '💉 Дозировки' : t === 'peptides' ? '🧬 Пептиды' : t === 'mapper' ? '🗺 Маппер' : '🩺 Диагностика'}</button>
      ))}
      {page === 'info' && (['catalog','interactions'] as const).map(t => (
        <button key={t} onClick={() => setSubTab(t)} style={{
          padding:'7px 13px', borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:'nowrap',
          cursor:'pointer', flexShrink:0, transition:'all 0.18s ease',
          background: subTab === t ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.06)',
          color: subTab === t ? '#fff' : 'rgba(255,255,255,0.72)',
          border: `1px solid ${subTab === t ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: subTab===t ? '0 4px 14px rgba(34,197,94,0.22)' : 'none',
        }}>{t === 'catalog' ? '📚 Каталог' : '⚡ Взаимодействия'}</button>
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
