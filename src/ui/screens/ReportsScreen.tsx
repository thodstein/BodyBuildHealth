import React, { useState, useRef } from 'react';
import { useDataLink } from '../../core/data-link';
import { db } from '../../core/db';
import { calculateIndices } from '../../engines/clinical-indices.engine';
import { UCUM_MAP } from '../../core/constants';
import type { LabPoint, CourseEntry, GamificationState } from '../../core/types';

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
    if (!entries.length) { setImportMsg('Нет данных дневника'); return; }
    const headers = ['date', 'meal', 'food', 'weight_g', 'kcal', 'protein_g', 'fat_g', 'carbs_g', 'fiber_g'];
    triggerDownload([headers.join(','), ...entries.map(e => headers.map(h => escapeCSV(e[h])).join(','))].join('\n'), `nutrition-diary-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };

  const handleExportLabsCSV = () => {
    if (!labs.length) { setImportMsg('Нет данных анализов'); return; }
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
        setImportMsg('Импорт выполнен. Перезагрузите страницу.');
      } catch { setImportMsg('Ошибка импорта: файл повреждён.'); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const systemLabels: Record<string, string> = {
    cardio: 'Сердечно-сосудистая', hepatic: 'Печень', renal: 'Почки',
    neuro: 'Нервная', endocrine: 'Эндокринная', hematologic: 'Кроветворная', reproductive: 'Репродуктивная'
  };

  const btn: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12, cursor: 'pointer' };

  return (
    <div className="screen reports">
      <h2>Отчёты</h2>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {(['summary', 'labs', 'nutrition', 'pharma', 'print'] as ReportTab[]).map(t => (
          <button key={t} className={`tab-button ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'summary' ? 'Сводка' : t === 'labs' ? 'Анализы' : t === 'nutrition' ? 'Питание' : t === 'pharma' ? 'Фарма' : 'Печать'}
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
          <h4 style={{ margin: '0 0 8px' }}>Сводка — {period === 'day' ? 'день' : period === 'week' ? 'неделя' : 'месяц'}</h4>
          {readiness && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, textAlign: 'center', marginBottom: 12 }}>
              {[{ l: 'Восст.', v: readiness.recovery, g: 60 }, { l: 'Питание', v: readiness.nutrition, g: 60 }, { l: 'Поддержка', v: readiness.support, g: 60 }, { l: 'Усталость', v: readiness.fatigue, g: 40, inv: true }].map(m => (
                <div key={m.l}><div style={{ fontSize: 20, fontWeight: 700, color: m.inv ? (m.v <= m.g ? '#00e68a' : '#ff9800') : (m.v >= m.g ? '#00e68a' : '#ff9800') }}>{m.v}</div><div style={{ fontSize: 11 }}>{m.l}</div></div>
              ))}
            </div>
          )}
          {risk && <div style={{ marginBottom: 12 }}><h5 style={{ margin: '0 0 4px' }}>Риск</h5><div style={{ fontSize: 18, fontWeight: 700, color: risk.overallNet > 50 ? '#f44336' : risk.overallNet > 25 ? '#ff9800' : '#00e68a' }}>{risk.overallNet.toFixed(1)}% чистый</div></div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.08)' }}><div style={{ fontSize: 11, opacity: 0.6 }}>Ср. ккал/{period === 'day' ? 'день' : 'нед'}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgWeeklyKcal}</div></div>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.08)' }}><div style={{ fontSize: 11, opacity: 0.6 }}>Ср. белок/{period === 'day' ? 'день' : 'нед'}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgWeeklyProtein}г</div></div>
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

      {tab === 'nutrition' && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 8px' }}>Питание</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, textAlign: 'center', marginBottom: 12 }}>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgWeeklyKcal}</div><div style={{ fontSize: 11, opacity: 0.6 }}>ккал</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgWeeklyProtein}г</div><div style={{ fontSize: 11, opacity: 0.6 }}>Белок</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgWeeklyFat}г</div><div style={{ fontSize: 11, opacity: 0.6 }}>Жиры</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgWeeklyCarbs}г</div><div style={{ fontSize: 11, opacity: 0.6 }}>Углеводы</div></div>
          </div>
          <button style={btn} onClick={handleExportDiaryCSV}>Экспорт дневника CSV</button>
        </div>
      )}

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
            <span style={{ opacity: 0.6, fontSize: 12 }}>Дата: {new Date().toISOString().slice(0, 10)} | Период: {period === 'day' ? 'День' : period === 'week' ? 'Неделя' : 'Месяц'}</span>
          </div>
          {profile && (
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, borderLeft: '3px solid #00e68a', paddingLeft: 8, margin: '0 0 8px' }}>Профиль</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  <tr><td style={{ padding: 4, borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Имя</td><td style={{ padding: 4, borderBottom: '1px solid var(--border)' }}>{profile.name || '—'}</td></tr>
                  <tr><td style={{ padding: 4, borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Возраст/Пол</td><td style={{ padding: 4, borderBottom: '1px solid var(--border)' }}>{profile.settings?.age ?? '—'} / {profile.settings?.sex === 'male' ? 'М' : 'Ж'}</td></tr>
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
        <button style={btn} onClick={() => window.print()}>Печать PDF</button>
        <button style={btn} onClick={() => fileInputRef.current?.click()}>Импорт</button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJSON} />
      </div>
      {importMsg && <div style={{ background: 'rgba(0,230,138,0.12)', padding: 8, borderRadius: 8, fontSize: 12 }}>{importMsg}</div>}
    </div>
  );
};