import React, { useState, useEffect } from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';

interface CourseItem { substanceId: string; doseValue: number; doseUnit: string; frequency: string; startWeek: number; endWeek: number; }

const readCourse = (): CourseItem[] => {
  try { return JSON.parse(localStorage.getItem('he_course_stack') || '[]'); } catch { return []; }
};
const readRisk = () => {
  try { return JSON.parse(localStorage.getItem('he_last_risk') || 'null'); } catch { return null; }
};

export const PharmaBlockReports: React.FC = () => {
  const [reportGenerated, setReportGenerated] = useState(false);
  const [archive, setArchive] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_pharma_reports') || '[]'); } catch { return []; }
  });
  const [course, setCourse] = useState<CourseItem[]>(readCourse);

  useEffect(() => {
    try { if (localStorage.getItem('he_pharma_report_current')) setReportGenerated(true); } catch {}
    const interval = setInterval(() => setCourse(readCourse()), 2000);
    return () => clearInterval(interval);
  }, []);

  const saveArchive = (report: any) => {
    const updated = [report, ...archive].slice(0, 20);
    setArchive(updated);
    try { localStorage.setItem('he_pharma_reports', JSON.stringify(updated)); } catch {}
  };

  const generateReport = () => {
    const cur = readCourse();
    setCourse(cur);
    const risk = readRisk();
    const compounds = cur.map((c: any) => {
      const ph = PHARMA_DB[c.substanceId];
      return { id: c.substanceId, name: ph?.name || c.substanceId, cls: ph?.class || 'other', dose: c.doseValue, freq: c.frequency, start: c.startWeek, end: c.endWeek, unit: c.doseUnit };
    });
    const report = {
      id: Date.now().toString(), date: new Date().toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(), compounds,
      compoundCount: compounds.length,
      totalWeeks: compounds.length ? Math.max(...compounds.map((c: any) => c.end || c.endWeek || 0)) : 0,
      totalDoseMg: compounds.reduce((s: number, c: any) => s + (c.dose || 0) * ((c.end || c.endWeek || 0) - (c.start || c.startWeek || 0) + 1), 0),
      risk: risk?.overallRaw || 0,
      pctPlanned: compounds.some((c: any) => c.cls === 'serm' || c.cls === 'pct_gonadotropin'),
      timestamp: Date.now(),
    };
    saveArchive(report);
    try { localStorage.setItem('he_pharma_report_current', JSON.stringify(report)); } catch {}
    setReportGenerated(true);
  };

  const currentReport = (() => {
    try { return JSON.parse(localStorage.getItem('he_pharma_report_current') || 'null'); } catch { return null; }
  })();

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize:15, fontWeight:800, color:'#fff', margin:'0 0 4px' }}>📄 Отчёты по курсу</h3>
        <p style={{ fontSize:10, color:'rgba(255,255,255,0.7)', margin:'0 0 12px' }}>Полный отчёт по препаратам, дозам, фазам и рискам</p>
        <div style={{ display:'flex', gap:6, marginBottom:12 }}>
          <button onClick={generateReport} style={{
            padding:'8px 16px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:12,
            background:'var(--accent)', color:'#000', border:'none', flex:1,
          }}>📄 Сгенерировать отчёт ({course.length} преп.)</button>
          <button onClick={() => {
            try { localStorage.removeItem('he_pharma_reports'); localStorage.removeItem('he_pharma_report_current'); setArchive([]); setReportGenerated(false); } catch {}
          }} style={{
            padding:'8px 12px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:11,
            background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)',
          }}>🗑 Очистить архив</button>
        </div>
      </div>

      {reportGenerated && currentReport && (
        <div style={{
          borderRadius:12, padding:14, marginBottom:10,
          background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <h4 style={{ margin:0, fontSize:12, fontWeight:700, color:'#00e68a' }}>✅ Отчёт сгенерирован</h4>
            <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{new Date(currentReport.generatedAt).toLocaleString()}</span>
          </div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.5 }}>
            {course.map((c: any, i: number) => {
              const ph = PHARMA_DB[c.substanceId];
              return (
                <div key={i} style={{
                  display:'flex', justifyContent:'space-between', padding:'3px 8px', borderRadius:4,
                  background:i%2===0?'rgba(255,255,255,0.03)':'transparent', fontSize:9,
                }}>
                  <span style={{ fontWeight:600 }}>{ph?.name || c.substanceId}</span>
                  <span style={{ color:'rgba(255,255,255,0.6)' }}>
                    {c.doseValue}{c.doseUnit} · {c.frequency} · нед {c.startWeek}-{c.endWeek}
                  </span>
                </div>
              );
            })}
            <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
              <b>Всего препаратов:</b> {course.length} · <b>Риск:</b> {Math.round(currentReport.risk || 0)}%
            </div>
          </div>
        </div>
      )}

      {!reportGenerated && course.length === 0 && (
        <div style={{ textAlign:'center', padding:40, fontSize:11, color:'rgba(255,255,255,0.5)' }}>
          Курс пуст. Добавьте препараты в разделе «Фарма → Курс» и вернитесь для генерации отчёта.
        </div>
      )}

      {!reportGenerated && course.length > 0 && (
        <div style={{ textAlign:'center', padding:20, fontSize:11, color:'rgba(255,255,255,0.5)' }}>
          Нажмите «Сгенерировать отчёт» для создания отчёта по курсу ({course.length} преп.)
        </div>
      )}

      {archive.length > 0 && (
        <div>
          <h4 style={{ fontSize:12, fontWeight:700, color:'#fff', margin:'12px 0 8px' }}>
            📦 Архив отчётов ({archive.length})
          </h4>
          {archive.map((r: any) => (
            <div key={r.id} style={{
              borderRadius:10, padding:10, marginBottom:4,
              background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.03)',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:11, fontWeight:700, color:'#00e68a' }}>Отчёт от {r.date}</span>
                <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{r.compoundCount} препаратов</span>
              </div>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginTop:2 }}>
                нед: {r.totalWeeks} · риск: {Math.round(r.risk)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
