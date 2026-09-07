import React, { useState, useMemo, useEffect } from 'react';
import { HeroImg } from '../../HeroImg';
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
import { NativeIcon, type NativeIconName } from '../../native/NativeIcons';

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

  const scoreCourse = useMemo(() => {
    // Use weekly dose (frequency-aware) for risk scoring
    const toWeekly = (c: any) => {
      const v = c.doseValue || 0;
      const u = c.doseUnit || 'мг';
      const f = c.frequency;
      // Simple weekly conversion: if unit already /wk keep, otherwise * perWeek
      const s = String(f ?? '').toLowerCase();
      let perWeek = 2;
      if (typeof f === 'number' && Number.isFinite(f)) perWeek = f as number;
      else if (s === 'daily') perWeek = 7;
      else if (s === 'eod') perWeek = 3.5;
      else {
        const m = s.match(/(\d+(?:\.\d+)?)\s*x\s*\/\s*w/);
        if (m) perWeek = parseFloat(m[1]);
        else if (s.includes(',')) perWeek = s.split(',').filter(Boolean).length || 2;
      }
      const isWeekly = String(u).includes('/wk') || String(u).includes('/week');
      return isWeekly ? v : v * perWeek;
    };
    return (linked.course || []).map((c: any) => ({ substanceId: c.substanceId || '', dose: toWeekly(c), unit: c.doseUnit || 'мг', weeks: (c.endWeek || 12) - (c.startWeek || 0) }));
  }, [linked.course]);

  if (page === 'main') {
    const cards: { key: 'course' | 'reports' | 'calculators' | 'info'; icon: NativeIconName; title: string; desc: string; color: string; accent: string; border: string }[] = [
      { key:'course', icon:'pill', title:'Курс', desc:'Препараты, дозировки, фазы цикла', color:'#8b5cf6', accent:'rgba(139,92,246,0.18)', border:'rgba(139,92,246,0.28)' },
      { key:'reports', icon:'chart', title:'Фарма-отчёт', desc:'Состав · валидация · взаимодействия · риск', color:'#f59e0b', accent:'rgba(245,158,11,0.18)', border:'rgba(245,158,11,0.28)' },
      { key:'calculators', icon:'cpu', title:'Калькуляторы', desc:'PK/PD · Дозировки · Пептиды · Маппер', color:'#3b82f6', accent:'rgba(59,130,246,0.18)', border:'rgba(59,130,246,0.28)' },
      { key:'info', icon:'bookOpen', title:'Каталог и знания', desc:'Вещества, взаимодействия, синергии', color:'#22c55e', accent:'rgba(34,197,94,0.18)', border:'rgba(34,197,94,0.28)' },
    ];
    const courseLen = linked.course?.length ?? 0;
    const risk = linked.risk?.overallNet;
    return (
      <div className="pharma-hero" style={{ position:'fixed', inset:0, zIndex:5, display:'flex', flexDirection:'column', overflow:'hidden', background:'#050508' }}>
        <HeroImg webp="/pharma-hero.webp" src="/pharma-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', opacity:1 }} />
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
                <span style={{ display:'inline-flex', color:'#c4b5fd' }}><NativeIcon name="pill" size={11} /></span>
                <span style={{ fontSize:11, color:'#fff', fontWeight:700 }}>В курсе <b>{courseLen}</b></span>
              </div>
              <div style={{ width:1, height:14, background:'rgba(255,255,255,0.15)', alignSelf:'center' }} />
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background: (risk ?? 0) >=60 ? '#ef4444' : (risk ?? 0) >=30 ? '#f59e0b' : '#22c55e', display:'inline-block' }} />
                <span style={{ fontSize:11, color:'#fff', fontWeight:700 }}>Риск <b style={{ color: (risk ?? 0) >=60 ? '#ef4444' : (risk ?? 0) >=30 ? '#f59e0b' : '#00e68a' }}>{risk != null ? `${Math.round(risk)}%` : '—'}</b></span>
              </div>
              <div style={{ width:1, height:14, background:'rgba(255,255,255,0.15)', alignSelf:'center' }} />
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ display:'inline-flex', color:'#c4b5fd' }}><NativeIcon name="flask" size={11} /></span>
                <span style={{ fontSize:11, color:'#fff', fontWeight:700 }}>Каталог <b>{pharmaSubstances.length}</b></span>
              </div>
            </div>
          </div>

          <div className="pharma-hero-cards native-fade-up" style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {cards.map((c, ci) => (
              <button key={c.key} onClick={() => setPage(c.key)} className="pharma-hero-card native-fade-up" data-key={c.key} style={{
                animationDelay: `${ci * 55}ms`,
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
                  flexShrink:0, background:`${c.color}18`, border:`1px solid ${c.color}22`, color: c.color }}><NativeIcon name={c.icon} size={19} /></div>
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
  const pageIcon: Record<PharmaPage, NativeIconName> = { main:'pill', course:'syringe', calculators:'cpu', info:'bookOpen', reports:'chart' };

  return (
    <div className="screen pharma pharma-inner" style={{ padding:'0 12px 0', display:'flex', flexDirection:'column', height:'100%', minHeight:0, overflow:'hidden' }}>
      {/* topbar — 56px, sticky, safe-area, стекло */}
      <div className="pharma-head" style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0, minHeight:56, padding:'10px 12px', margin:'0 -12px 0', background:'linear-gradient(180deg, rgba(9,18,34,0.92), rgba(9,18,34,0.78))', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(140,190,255,0.12)', position:'sticky', top:0, zIndex:20 }}>
        <button onClick={() => setPage('main')} aria-label="Назад" style={{
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, minWidth:44, minHeight:44, padding:'0 14px', borderRadius:14, fontSize:13, cursor:'pointer', fontWeight:800,
          background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff', flexShrink:0,
        }}>← Назад</button>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <span style={{ width:36, height:36, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(124,58,237,0.14))', border:'1px solid rgba(139,92,246,0.22)', color:'#c4b5fd', flexShrink:0 }}><NativeIcon name={pageIcon[page]} size={16} /></span>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize:14, fontWeight:900, color:'#fff', lineHeight:1, letterSpacing:-0.2 }}>{pageTitle[page]}</div>
            <div style={{ fontSize:11, color:'#fff', lineHeight:1.2, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {page==='course' ? `${linked.course.length} преп. • ${Math.max(1, linked.course.reduce((m,c)=>Math.max(m,(c.endWeek||12)-(c.startWeek||0)),4))} нед` : page==='calculators' ? 'PK/PD · Дозировки · Пептиды · Маппер · Диагностика' : page==='info' ? `${pharmaSubstances.length} веществ • каталог` : page==='reports' ? 'Состав · валидация · взаимодействия · риск' : ''}
            </div>
          </div>
        </div>
        {(page==='course' || page==='reports' || page==='info') && (
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <span style={{ fontSize:11, color:'#fff', display: 'inline-flex', alignItems: 'center', gap: 5, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', padding:'5px 9px', borderRadius:20, fontWeight:700 }}><NativeIcon name="syringe" size={12} /> {linked.course.length}</span>
            <span style={{ fontSize:12, fontWeight:900, color: (linked.risk?.overallNet ?? 0) >=60 ? '#ef4444' : (linked.risk?.overallNet ?? 0) >=30 ? '#f59e0b' : '#00e68a', background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.06)', padding:'5px 9px', borderRadius:20, minWidth:36, textAlign:'center' }}>{linked.risk ? `${Math.round(linked.risk.overallNet)}%` : '—'}</span>
          </div>
        )}
      </div>

      {page === 'info' && (
        <div className="pharma-info-summary" style={{ marginBottom:10, padding:'14px', borderRadius:18,
          background:'linear-gradient(180deg, rgba(21,38,66,0.78), rgba(12,23,40,0.78))', border:'1px solid rgba(140,190,255,0.14)', flexShrink:0,
          backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', boxShadow:'0 10px 28px rgba(0,0,0,0.38)',
        }}>
          <div style={{ fontSize:12, fontWeight:900, color:'#fff', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}><span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.18)', color:'#a78bfa' }}><NativeIcon name="chart" size={14} /></span> Сводка расчётов <span style={{ marginLeft:'auto', fontSize:11, color:'#fff', fontWeight:800, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 8px', borderRadius:20 }}>{pharmaSubstances.length} веществ</span></div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8 }}>
            <div style={{ padding:'12px 10px', borderRadius:14, textAlign:'center',
              background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize:11, color:'#fff', letterSpacing:0.4, fontWeight:800, textTransform:'uppercase' as const }}>Препаратов в курсе</div>
              <div style={{ fontSize:22, fontWeight:900, color:'#fff', marginTop:4 }}>{linked.course.length}</div>
            </div>
            <div style={{ padding:'12px 10px', borderRadius:14, textAlign:'center',
              background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize:11, color:'#fff', letterSpacing:0.4, fontWeight:800, textTransform:'uppercase' as const }}>Общий риск</div>
              <div style={{ fontSize:22, fontWeight:900, color: (linked.risk?.overallNet ?? 0) >= 60 ? '#ef4444' : (linked.risk?.overallNet ?? 0) >= 30 ? '#f59e0b' : '#00e68a', marginTop:4 }}>
                {linked.risk ? `${Math.round(linked.risk.overallNet)}%` : '—'}
              </div>
            </div>
          </div>
          {Object.keys(linked.activeDrugs).length > 0 && (
            <div style={{ marginTop:10, fontSize:11, color:'#fff', lineHeight:1.5, background:'rgba(0,0,0,0.18)', padding:'8px 10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color:'#fff', fontWeight:800 }}>Активные:</span> {Object.keys(linked.activeDrugs).map(d => PHARMA_DB[d]?.name || d).join(' • ')}
            </div>
          )}
          <div style={{ marginTop:10 }}>
            <PharmaScoreCard
              course={scoreCourse}
              weight={linked.profile?.settings?.weight || 80}
              age={linked.profile?.settings?.age || 30}
              sex={linked.profile?.settings?.sex || 'male'}
            />
          </div>
        </div>
      )}

      {/* subtabs — липкие пилюли 44px, скролл-лента, glow активной */}
      <div className="pharma-subtabs" style={{ display:'flex', gap:8, overflowX:'auto', overflowY:'hidden', scrollbarWidth:'none', WebkitOverflowScrolling:'touch' as any, flexWrap:'nowrap', flexShrink:0, padding:'10px 12px 10px', margin:'0 -12px 8px', background:'linear-gradient(180deg, rgba(5,11,22,0.92), rgba(5,11,22,0.75))', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderBottom:'1px solid rgba(255,255,255,0.04)', position:'sticky', top:56, zIndex:15, scrollSnapType:'x proximity' as any }}>
      {page === 'course' && (
        <span style={{
          display:'inline-flex', alignItems:'center', gap:7, padding:'9px 14px', fontSize:12, fontWeight:900, whiteSpace:'nowrap', flexShrink:0,
          color:'#fff', background:'linear-gradient(135deg, #8b5cf6, #7c3aed)', border:'1px solid rgba(139,92,246,0.35)', borderRadius:999, boxShadow:'0 6px 18px rgba(139,92,246,0.28)', minHeight:44, scrollSnapAlign:'start' as any,
        }}><span style={{ display:'inline-flex' }}><NativeIcon name="syringe" size={12} /></span>Курс <span style={{ background:'rgba(255,255,255,0.16)', padding:'2px 7px', borderRadius:20, fontSize:11 }}>{linked.course.length}</span></span>
      )}
      {page === 'reports' && (
        <span style={{
          display:'inline-flex', alignItems:'center', gap:7, padding:'9px 14px', fontSize:12, fontWeight:900, whiteSpace:'nowrap', flexShrink:0,
          color:'#fff', background:'linear-gradient(135deg, #f59e0b, #e07b00)', border:'1px solid rgba(245,158,11,0.35)', borderRadius:999, boxShadow:'0 6px 18px rgba(245,158,11,0.22)', minHeight:44, scrollSnapAlign:'start' as any,
        }}><span style={{ display:'inline-flex' }}><NativeIcon name="chart" size={12} /></span>Фарма-отчёт</span>
      )}
      {page === 'calculators' && (['pkpd','dosage','peptides','mapper','diagnostics'] as const).map(t => (
        <button key={t} onClick={() => setSubTab(t)} style={{
          padding:'9px 14px', fontSize:12, fontWeight:800, whiteSpace:'nowrap', minHeight:44,
          cursor:'pointer', flexShrink:0, transition:'all 0.18s ease', borderRadius:999, scrollSnapAlign:'start' as any,
          background: subTab===t ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(255,255,255,0.06)',
          color: '#fff',
          border:`1px solid ${subTab===t ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.07)'}`,
          boxShadow: subTab===t ? '0 6px 18px rgba(59,130,246,0.22)' : 'none',
        }}>{t === 'pkpd' ? 'PK/PD' : t === 'dosage' ? 'Дозировки' : t === 'peptides' ? 'Пептиды' : t === 'mapper' ? 'Маппер' : 'Диагностика'}</button>
      ))}
      {page === 'info' && (['catalog','interactions'] as const).map(t => (
        <button key={t} onClick={() => setSubTab(t)} style={{
          padding:'9px 14px', fontSize:12, fontWeight:800, whiteSpace:'nowrap', minHeight:44,
          cursor:'pointer', flexShrink:0, transition:'all 0.18s ease', borderRadius:999, scrollSnapAlign:'start' as any,
          background: subTab===t ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.06)',
          color: '#fff',
          border:`1px solid ${subTab===t ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.07)'}`,
          boxShadow: subTab===t ? '0 6px 18px rgba(34,197,94,0.18)' : 'none',
        }}>{t === 'catalog' ? 'Каталог' : 'Взаимодействия'}</button>
      ))}
      </div>

      <div className="pharma-body" style={{ flex:1, overflowY:'auto', overflowX:'hidden', WebkitOverflowScrolling:'touch' as any, paddingBottom:'calc(var(--nav-height,68px) + 28px + env(safe-area-inset-bottom))', minHeight:0, display:'flex', flexDirection:'column', gap:10 }}>
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
