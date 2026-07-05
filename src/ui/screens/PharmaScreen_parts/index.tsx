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

type PharmaPage = 'main' | 'course' | 'calculators' | 'info';
type SubTab = 'catalog' | 'pkpd' | 'dosage' | 'peptides' | 'interactions';

export const PharmaScreen: React.FC = () => {
  const [page, setPage] = useState<PharmaPage>('main');
  const [subTab, setSubTab] = useState<SubTab>('catalog');
  const [courseSub, setCourseSub] = useState<'course' | 'mapper' | 'diagnostics' | 'reports'>('course');
  const linked = useDataLink();
  const [courseReportGenerated, setCourseReportGenerated] = useState(false);
  useEffect(() => { try { if (localStorage.getItem('he_pharma_report_current')) setCourseReportGenerated(true); } catch {} }, []);
  const [courseArchive, setCourseArchive] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_pharma_reports') || '[]'); } catch { return []; }
  });

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
      { key:'course' as const, icon:'📋', title:'Курс', desc:'Управление курсом, маппинг препаратов, диагностика', color:'#8b5cf6' },
      { key:'calculators' as const, icon:'⚙️', title:'Калькуляторы', desc:'PK/PD симуляция, расчёт дозировок, пептиды', color:'#3b82f6' },
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
{page === 'course' && (['course','mapper','diagnostics','reports'] as const).map(t => (
  <button key={t} onClick={() => setCourseSub(t)} style={{
    padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
    cursor:'pointer', flexShrink:0,
    background: courseSub === t ? 'var(--accent)' : 'var(--bg-secondary)',
    color: courseSub === t ? '#000' : 'var(--text-dim)',
    border: `1px solid ${courseSub === t ? 'var(--accent)' : 'var(--border)'}`,
  }}>{t === 'course' ? '📋 Курс' : t === 'mapper' ? '🗺 Маппер' : t === 'diagnostics' ? '🩺 Диагностика' : '📄 Отчёты'}</button>
))}
        {page === 'calculators' && (['pkpd','dosage','peptides'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
            cursor:'pointer', flexShrink:0,
            background: subTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
            color: subTab === t ? '#000' : 'var(--text-dim)',
            border: `1px solid ${subTab === t ? 'var(--accent)' : 'var(--border)'}`,
          }}>{t === 'pkpd' ? '⚙️ PK/PD' : t === 'dosage' ? '💊 Дозировки' : '🧪 Пептиды'}</button>
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
      {page === 'course' && courseSub === 'course' && <PharmaCourseScreen />}
      {page === 'course' && courseSub === 'mapper' && <MapperTab />}
      {page === 'course' && courseSub === 'diagnostics' && <DiagnosticsTab />}
      {page === 'course' && courseSub === 'reports' && (() => {
        const saveArchive = (report: any) => {
          const updated = [report, ...courseArchive].slice(0, 20);
          setCourseArchive(updated);
          try { localStorage.setItem('he_pharma_reports', JSON.stringify(updated)); } catch {}
        };
        const generateReport = () => {
          const course = linked.course || [];
          const compounds = course.map((c: any) => {
            const ph = PHARMA_DB[c.substanceId];
            return { id: c.substanceId, name: ph?.name || c.substanceId, cls: ph?.class || 'other', dose: c.doseValue, freq: c.frequency, start: c.startWeek, end: c.endWeek, unit: c.doseUnit };
          });
          const report = { id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), generatedAt: new Date().toISOString(), compounds, compoundCount: compounds.length, totalWeeks: compounds.length ? Math.max(...compounds.map((c:any) => c.end || c.endWeek || 0)) : 0, totalDoseMg: compounds.reduce((s: number, c: any) => s + (c.dose || 0) * ((c.end || c.endWeek || 0) - (c.start || c.startWeek || 0) + 1), 0), risk: linked.risk?.overallRaw || 0, pctPlanned: compounds.some((c: any) => c.cls === 'serm' || c.cls === 'pct_gonadotropin'), timestamp: Date.now() };
          saveArchive(report);
          try { localStorage.setItem('he_pharma_report_current', JSON.stringify(report)); } catch {}
          setCourseReportGenerated(true);
        };
        return (
          <div style={{ padding:'0 12px 80px' }}>
            <h3 style={{ fontSize:15, fontWeight:800, color:'#fff', margin:'0 0 4px' }}>📄 Отчёты по курсу</h3>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.7)', margin:'0 0 12px' }}>Полный отчёт по препаратам, дозам, фазам и рискам</p>
            <div style={{ display:'flex', gap:6, marginBottom:12 }}>
              <button onClick={generateReport} style={{ padding:'8px 16px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:12, background:'var(--accent)', color:'#000', border:'none', flex:1 }}>📄 Сгенерировать отчёт</button>
              <button onClick={() => { try { localStorage.removeItem('he_pharma_reports'); localStorage.removeItem('he_pharma_report_current'); setCourseArchive([]); setCourseReportGenerated(false); } catch {} }} style={{ padding:'8px 12px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:11, background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)' }}>🗑 Очистить архив</button>
            </div>
            {courseReportGenerated && (
              <div style={{ borderRadius:12, padding:14, marginBottom:10, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <h4 style={{ margin:0, fontSize:12, fontWeight:700, color:'#00e68a' }}>✅ Отчёт сгенерирован</h4>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{new Date().toLocaleString()}</span>
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.5 }}>
                  {(linked.course || []).map((c: any, i: number) => {
                    const ph = PHARMA_DB[c.substanceId];
                    return <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'3px 8px', borderRadius:4, background:i%2===0?'rgba(255,255,255,0.03)':'transparent', fontSize:9 }}>
                      <span style={{ fontWeight:600 }}>{ph?.name || c.substanceId}</span>
                      <span style={{ color:'rgba(255,255,255,0.6)' }}>{c.doseValue}{c.doseUnit} · {c.frequency} · нед {c.startWeek}-{c.endWeek}</span>
                    </div>;
                  })}
                  <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                    <b>Всего препаратов:</b> {(linked.course||[]).length} · <b>Риск:</b> {Math.round(linked.risk?.overallRaw||0)}%
                  </div>
                </div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)', textAlign:'center', marginTop:8 }}>Отчёт сохранён в архив. Доступен в Профиле → Отчёты.</div>
              </div>
            )}
            {courseArchive.length > 0 && (
              <div>
                <h4 style={{ fontSize:12, fontWeight:700, color:'#fff', margin:'0 0 8px' }}>📦 Архив отчётов ({courseArchive.length})</h4>
                {courseArchive.map((r: any) => (
                  <div key={r.id} style={{ borderRadius:10, padding:10, marginBottom:4, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#00e68a' }}>Отчёт от {r.date}</span>
                      <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{r.compoundCount} препаратов</span>
                    </div>
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginTop:2 }}>нед: {r.totalWeeks} · риск: {Math.round(r.risk)}%</div>
                  </div>
                ))}
              </div>
            )}
            {!courseReportGenerated && courseArchive.length === 0 && (
              <div style={{ textAlign:'center', padding:40, fontSize:11, color:'rgba(255,255,255,0.5)' }}>Нажмите «Сгенерировать отчёт» для создания отчёта по курсу</div>
            )}
          </div>
        );
      })()}
      {page === 'calculators' && subTab === 'pkpd' && <PKPDSimulationTab />}
      {page === 'calculators' && subTab === 'dosage' && <DosageCalculatorTab />}
      {page === 'calculators' && subTab === 'peptides' && <PharmaPeptideCalc />}
      {page === 'info' && subTab === 'catalog' && <CatalogTab />}
      {page === 'info' && subTab === 'interactions' && <InteractionCheckerTab />}
    </div>
  );
};