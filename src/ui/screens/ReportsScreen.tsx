import React, { useState, useRef } from 'react';
import { useDataLink } from '../../core/data-link';
import { db } from '../../core/db';
import { calculateIndices } from '../../engines/clinical-indices.engine';
import { generateWeeklyReportHTML, type WeeklyReportData } from '../../engines/weekly-report.engine';
import { generateMedicalReportHTML } from '../../engines/pdf-report.engine';
import { UCUM_MAP } from '../../core/constants';
import type { LabPoint, CourseEntry, GamificationState, UserContext } from '../../core/types';
import type { NutritionReport } from '../../engines/nutrition-report.engine';

const EXPORT_VERSION = '1.1';

type ReportTab = 'summary' | 'labs' | 'nutrition' | 'pharma' | 'print';
type ReportPeriod = 'day' | 'week' | 'month';

interface DayDiary {
  date: string;
  meals: Record<string, Array<{ foodId: string; name: string; weight: number; kcal: number; p: number; f: number; c: number; fiber: number }>>;
  water: number;
}

function loadFromLS<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function escapeCSV(val: unknown): string {
  const s = String(val ?? '');
  return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const ReportsScreen: React.FC = () => {
  const [tab, setTab] = useState<ReportTab>('summary');
  const [period, setPeriod] = useState<ReportPeriod>('week');
  const linked = useDataLink();
  const { profile, labs, course, readiness, risk, avgWeeklyKcal, avgWeeklyProtein, avgWeeklyFat, avgWeeklyCarbs } = linked;
  const [diary] = useState<Record<string, DayDiary>>(loadFromLS('nutrition_diary', {}));
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const indices = labs.length > 0 ? calculateIndices(labs, profile.settings.sex, profile.settings.age ?? 30) : null;

  const getPeriodDays = () => period === 'day' ? 1 : period === 'week' ? 7 : 30;
  const filterByPeriod = <T extends { date?: string }>(items: T[]): T[] => {
    const days = getPeriodDays();
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return items.filter(i => !i.date || i.date >= cutoff);
  };
  const periodLabs = filterByPeriod(labs);

  const collectAllData = () => ({
    version: EXPORT_VERSION, period,
    exportedAt: new Date().toISOString(),
    profile, labs: periodLabs, course, nutritionDiary: diary,
    avgWeeklyKcal, avgWeeklyProtein, avgWeeklyFat, avgWeeklyCarbs,
    readiness,
    riskSummary: risk ? { overallRaw: risk.overallRaw, overallNet: risk.overallNet } : null,
    clinicalIndices: indices,
  });

  const handleExportJSON = () => {
    triggerDownload(JSON.stringify(collectAllData(), null, 2), `health-engine-export-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  const handleExportDiaryCSV = () => {
    const entries: any[] = [];
    for (const [date, day] of Object.entries(diary))
      for (const [meal, items] of Object.entries(day.meals))
        for (const item of items)
          entries.push({ date, meal, food: item.name, weight_g: item.weight, kcal: item.kcal, protein_g: item.p, fat_g: item.f, carbs_g: item.c, fiber_g: item.fiber });
    if (!entries.length) { setImportMsg(''); return; }
    const headers = ['date', 'meal', 'food', 'weight_g', 'kcal', 'protein_g', 'fat_g', 'carbs_g', 'fiber_g'];
    triggerDownload([headers.join(','), ...entries.map(e => headers.map(h => escapeCSV(e[h])).join(','))].join('\n'), `nutrition-diary-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };

  const handleExportLabsCSV = () => {
    if (!labs.length) { setImportMsg(''); return; }
    const headers = ['date', 'code', 'name', 'value', 'unit', 'phase', 'ref_low', 'ref_high'];
    const rows = labs.map(l => { const ref = UCUM_MAP[l.code]; return [l.date, l.code, l.name || '', l.value, l.unit, l.phase, ref?.lln ?? '', ref?.uln ?? ''].map(escapeCSV).join(','); });
    triggerDownload([headers.join(','), ...rows].join('\n'), `labs-export-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        if (data.profile) localStorage.setItem('he_profile_v2', JSON.stringify(data.profile));
        if (data.labs && Array.isArray(data.labs)) { await db.init(); for (const lab of data.labs) await db.put('labs_log', { ...lab, patientId: 'current-user' }); }
        if (data.course && Array.isArray(data.course)) { await db.init(); for (const entry of data.course) await db.put('course_log', entry); }
        if (data.nutritionDiary) localStorage.setItem('nutrition_diary', JSON.stringify(data.nutritionDiary));
        setImportMsg('');
      } catch { setImportMsg(''); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const systemLabels: Record<string, string> = {
    cardio: '', hepatic: '', renal: '',
    neuro: '', endocrine: '', hematologic: '', reproductive: ''
  };

  const btn: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12, cursor: 'pointer' };

  return (
    <div className="screen reports">
      <h2>Отчёты</h2>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {(['summary', 'labs', 'nutrition', 'pharma', 'print'] as ReportTab[]).map(t => (
          <button key={t} className={`tab-button ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'summary' ? '📊 Сводка' : t === 'labs' ? '🔬 Анализы' : t === 'nutrition' ? '🍎 Питание' : t === 'pharma' ? '💊 Фарма' : '🖨 Печать'}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['day', 'week', 'month'] as ReportPeriod[]).map(p => (
          <button key={p} className={`tab-button ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)} style={{ fontSize: 11, padding: '4px 10px' }}>
            {p === 'day' ? 'День' : p === 'week' ? 'Неделя' : 'Месяц'}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 8px' }}>Сводка — {period === 'day' ? 'День' : period === 'week' ? 'Неделя' : 'Месяц'}</h4>
          {readiness && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, textAlign: 'center', marginBottom: 12 }}>
              {[{ l: '', v: readiness.recovery, g: 60 }, { l: '', v: readiness.nutrition, g: 60 }, { l: '', v: readiness.support, g: 60 }, { l: '', v: readiness.fatigue, g: 40, inv: true }].map(m => (
                <div key={m.l}><div style={{ fontSize: 20, fontWeight: 700, color: m.inv ? (m.v <= m.g ? '#00e68a' : '#ff9800') : (m.v >= m.g ? '#00e68a' : '#ff9800') }}>{m.v}</div><div style={{ fontSize: 11 }}>{m.l}</div></div>
              ))}
            </div>
          )}
          {risk && <div style={{ marginBottom: 12 }}><h5 style={{ margin: '0 0 4px' }}>Риск</h5><div style={{ fontSize: 18, fontWeight: 700, color: risk.overallNet > 50 ? '#f44336' : risk.overallNet > 25 ? '#ff9800' : '#00e68a' }}>{risk.overallNet.toFixed(1)}% чистый</div></div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.08)' }}><div style={{ fontSize: 11, opacity: 0.6 }}>Ср. ккал/{period === 'day' ? '' : ''}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgWeeklyKcal}</div></div>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.08)' }}><div style={{ fontSize: 11, opacity: 0.6 }}>Ср. белок/{period === 'day' ? '' : ''}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgWeeklyProtein}г</div></div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Анализов: {periodLabs.length} | Препаратов: {course.length} | Травм: {profile.settings.injuries?.length ?? 0}</div>
        </div>
      )}

      {tab === 'labs' && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 8px' }}>Анализы за период</h4>
          {periodLabs.length === 0 ? <p style={{ fontSize: 13, opacity: 0.6 }}>Нет данных</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr><th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Показатель</th><th style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Значение</th><th style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>Ед.</th><th style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Дата</th></tr></thead>
              <tbody>{periodLabs.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(l => {
                const ref = UCUM_MAP[l.code]; const abn = ref && (l.value < ref.lln || l.value > ref.uln);
                return <tr key={l.id} style={{ color: abn ? '#ff9800' : 'inherit' }}><td style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>{l.name || l.code}</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{l.value}</td><td style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>{l.unit}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{l.date}</td></tr>;
              })}</tbody>
            </table>
          )}
          <button style={{ ...btn, marginTop: 8 }} onClick={handleExportLabsCSV}>Экспорт CSV</button>
        </div>
      )}

      {tab === 'nutrition' && (() => {
        const nutritionReports = loadFromLS<NutritionReport[]>('he_nutrition_report_archive', []);
        const currentReport = nutritionReports[0] || null;
        const profileReports = loadFromLS<{ date: string; summary: { grade: string; kcalPct: number; pPct: number; deficits: number } }[]>('he_profile_nutrition_reports', []);
        return (<div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 8px' }}>🍎 Питание</h4>

          {/* Current averages */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, textAlign: 'center', marginBottom: 12 }}>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgWeeklyKcal}</div><div style={{ fontSize: 11, opacity: 0.6 }}>ккал</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgWeeklyProtein}г</div><div style={{ fontSize: 11, opacity: 0.6 }}>Белок</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgWeeklyFat}г</div><div style={{ fontSize: 11, opacity: 0.6 }}>Жиры</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgWeeklyCarbs}г</div><div style={{ fontSize: 11, opacity: 0.6 }}>Углеводы</div></div>
          </div>

          {/* Full report from archive */}
          {currentReport && (
            <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>📋 Последний отчёт о питании</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: currentReport.overallGrade === 'A' ? '#22c55e' : currentReport.overallGrade === 'B' ? '#8b5cf6' : currentReport.overallGrade === 'C' ? '#f59e0b' : '#ef4444' }}>{currentReport.overallGrade}</span>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>{currentReport.overallGradeLabel}</div>

              {/* KBJU % */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 8 }}>
                {[{l:'Ккал',v:currentReport.kbjuPct.kcal},{l:'Белки',v:currentReport.kbjuPct.p},{l:'Жиры',v:currentReport.kbjuPct.f},{l:'Угл.',v:currentReport.kbjuPct.c}].map(s => (
                  <div key={s.l} style={{ background:'rgba(0,0,0,0.2)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)' }}>{s.l}</div>
                    <div style={{ fontSize:14, fontWeight:700, color: s.v >= 85 && s.v <= 115 ? '#22c55e' : s.v >= 70 ? '#f59e0b' : '#ef4444' }}>{s.v}%</div>
                  </div>
                ))}
              </div>

              {/* Weight + Quality */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(59,130,246,0.06)' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>⚖️ Динамика</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: currentReport.weightDynamicsBasic.direction === 'loss' ? '#22c55e' : currentReport.weightDynamicsBasic.direction === 'gain' ? '#f59e0b' : '#fff' }}>
                    {currentReport.weightDynamicsBasic.direction === 'loss' ? '−' : currentReport.weightDynamicsBasic.direction === 'gain' ? '+' : '∼'}{currentReport.weightDynamicsBasic.weeklyKg} кг/нед
                  </div>
                </div>
                <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(139,92,246,0.06)' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>⭐ Качество</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: currentReport.foodQualityScore >= 7 ? '#22c55e' : '#f59e0b' }}>{currentReport.foodQualityScore}/10</div>
                </div>
              </div>

              {/* Micros */}
              {currentReport.microDeficiencies.length > 0 && <div style={{ fontSize: 9, color: '#f59e0b', marginBottom: 4 }}>⚠ {currentReport.microDeficiencies.length} дефицитов: {currentReport.microDeficiencies.slice(0, 4).join('; ')}</div>}

              {/* Risk */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                {currentReport.riskAnalysis.slice(0, 4).map(r => (
                  <span key={r.system} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: r.score > 4 ? 'rgba(239,68,68,0.1)' : r.score > 2 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', color: r.score > 4 ? '#ef4444' : r.score > 2 ? '#f59e0b' : '#22c55e' }}>
                    {r.system}: {r.score}/{r.maxScore}
                  </span>
                ))}
              </div>

              {/* Recs */}
              {currentReport.recommendations.length > 0 && (
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
                  💡 {currentReport.recommendations.slice(0, 3).map((r, i) => <div key={i}>• {r}</div>)}
                </div>
              )}
            </div>
          )}

          {/* History */}
          {profileReports.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>История оценок</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {profileReports.slice(0, 10).map((r, i) => (
                  <span key={i} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {r.date?.slice(5, 10)}: <strong style={{ color: r.summary.grade === 'A' ? '#22c55e' : r.summary.grade === 'B' ? '#8b5cf6' : r.summary.grade === 'C' ? '#f59e0b' : '#ef4444' }}>{r.summary.grade}</strong> {r.summary.kcalPct}% {r.summary.deficits > 0 ? `⚠${r.summary.deficits}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!currentReport && profileReports.length === 0 && <p style={{ fontSize: 13, opacity: 0.6 }}>Нет сохранённых отчётов. Сгенерируйте полный отчёт в разделе «Питание → Отчёты».</p>}
          <button style={btn} onClick={handleExportDiaryCSV}>Экспорт дневника CSV</button>
        </div>);
      })()}

      {tab === 'pharma' && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 8px' }}>Курс</h4>
          {course.length === 0 ? <p style={{ fontSize: 13, opacity: 0.6 }}>Нет записей</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr><th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Препарат</th><th style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Доза</th><th style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Частота</th><th style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Недели</th></tr></thead>
              <tbody>{course.map(c => <tr key={c.id}><td style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>{c.substanceId}</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{c.doseValue} {c.doseUnit}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{c.frequency}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{c.startWeek}–{c.endWeek}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'print' && (
        <div id="printable-report" style={{ fontSize: 13, lineHeight: 1.5 }}>
          <div style={{ borderBottom: '2px solid #00e68a', paddingBottom: 12, marginBottom: 16 }}>
            <h1 style={{ margin: 0, fontSize: 20 }}>Health Engine — Отчёт</h1>
            <span style={{ opacity: 0.6, fontSize: 12 }}>Дата: {new Date().toISOString().slice(0, 10)} | Период: {period === 'day' ? '' : period === 'week' ? '' : ''}</span>
          </div>
          {profile && (
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, borderLeft: '3px solid #00e68a', paddingLeft: 8, margin: '0 0 8px' }}>Профиль</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  <tr><td style={{ padding: 4, borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Имя</td><td style={{ padding: 4, borderBottom: '1px solid var(--border)' }}>{profile.name || '—'}</td></tr>
                  <tr><td style={{ padding: 4, borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Возраст/Пол</td><td style={{ padding: 4, borderBottom: '1px solid var(--border)' }}>{profile.settings?.age ?? '—'} / {profile.settings?.sex === 'male' ? '' : ''}</td></tr>
                  <tr><td style={{ padding: 4, borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Вес/Цель</td><td style={{ padding: 4, borderBottom: '1px solid var(--border)' }}>{profile.settings?.weight ?? '—'} кг / {profile.settings?.primaryGoal || profile.settings?.goal || '—'}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {risk && (
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, borderLeft: '3px solid #f44336', paddingLeft: 8, margin: '0 0 8px' }}>Риски</h2>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Общий чистый: {risk.overallNet.toFixed(1)}%</div>
              {risk.systemBreakdown && <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><tbody>{Object.entries(risk.systemBreakdown).map(([sys, data]) => <tr key={sys}><td style={{ padding: 4, borderBottom: '1px solid var(--border)' }}>{systemLabels[sys] || sys}</td><td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{data.net.toFixed(1)}%</td></tr>)}</tbody></table>}
            </div>
          )}
          {readiness && (
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, borderLeft: '3px solid #00e68a', paddingLeft: 8, margin: '0 0 8px' }}>Готовность</h2>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div><strong>Восстановление:</strong> {readiness.recovery}%</div>
                <div><strong>Питание:</strong> {readiness.nutrition}%</div>
                <div><strong>Поддержка:</strong> {readiness.support}%</div>
                <div><strong>Усталость:</strong> {readiness.fatigue}%</div>
              </div>
            </div>
          )}
          <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', fontSize: 11, opacity: 0.5, textAlign: 'center', paddingTop: 8 }}>
            Отчёт сформирован автоматически. Информация носит справочный характер.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, marginBottom: 12 }}>
        <button style={btn} onClick={handleExportJSON}>Экспорт JSON</button>
        <button style={btn} onClick={handleExportDiaryCSV}>Дневник CSV</button>
        <button style={btn} onClick={handleExportLabsCSV}>Анализы CSV</button>
        <button style={btn} onClick={() => {
          const reportData: WeeklyReportData = {
            ctx: { role: 'user', phase: profile?.settings?.phase ?? 'baseline', courseStartDate: profile?.settings?.courseStartDate },
            labs: linked.labs, course,
            weightCurrent: profile?.settings?.weight ?? 0, weightPrev: profile?.settings?.weight ?? 0,
            measurements: {}, goal: profile?.settings?.primaryGoal ?? 'maintenance',
            macros: { p: linked.avgWeeklyProtein, f: linked.avgWeeklyFat, c: linked.avgWeeklyCarbs },
            stepsAvg: 0, bpAvg: { sys: 120, dia: 80 }, bpNotes: '',
            trainingFeel: readiness ? `` : '—',
            generalFeel: readiness && readiness.recovery > 60 ? '' : readiness && readiness.recovery > 40 ? '' : '',
            meds: course.map(c => c.substanceId).join(', '),
            supplements: (profile?.settings?.currentSupplements as any[] ?? []).map((s: any) => s.name ?? s).join(', '),
            lastLabDate: linked.labs.length > 0 ? linked.labs.sort((a, b) => b.date.localeCompare(a.date))[0].date : '',
            nextLabDate: '', notes: ''
          };
          const html = generateWeeklyReportHTML(reportData);
          const w = window.open('', '_blank');
          if (w) { w.document.write(html); w.document.close(); }
        }}>Недельный отчёт</button>
        <button style={btn} onClick={() => {
          const ctx: UserContext = { role: 'doctor', phase: profile?.settings?.phase ?? 'baseline' };
          const risks: any = { overallRaw: risk?.overallRaw ?? 0, overallNet: risk?.overallNet ?? 0, systemBreakdown: risk?.systemBreakdown ?? {} };
          const pct: any = course.length > 0 ? { pctProtocol: [], pctStartWeek: 0, pctEndDate: '', supportStack: [], warnings: [], startDate: new Date().toISOString().slice(0, 10), endDate: '', totalWeeks: Math.max(...course.map(c => c.endWeek)), substances: course } : null;
          const html = generateMedicalReportHTML(ctx, linked.labs, risks, pct, '');
          const w = window.open('', '_blank');
          if (w) { w.document.write(html); w.document.close(); }
        }}>Медицинский отчёт</button>
        <button style={btn} onClick={() => window.print()}>Печать PDF</button>
        <button style={btn} onClick={() => fileInputRef.current?.click()}>Импорт</button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJSON} />
      </div>
      {importMsg && <div style={{ background: 'rgba(0,230,138,0.12)', padding: 8, borderRadius: 8, fontSize: 12 }}>{importMsg}</div>}
    </div>
  );
};