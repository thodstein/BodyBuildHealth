import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../core/db';
import { getProfile } from '../../core/profile-manager';
import { calculateRisks } from '../../engines/risk.engine';
import { calcReadiness } from '../../engines/readiness.engine';
import { calculateIndices } from '../../engines/clinical-indices.engine';
import { UCUM_MAP } from '../../core/constants';
import type { UserProfile, LabPoint, CourseEntry, GamificationState, RiskResult, ReadinessInput, ReadinessScores } from '../../core/types';

const EXPORT_VERSION = '1.0';

type ReportTab = 'summary' | 'labs' | 'nutrition' | 'pharma' | 'print';

interface DayDiary {
  date: string;
  meals: Record<string, Array<{ foodId: string; name: string; weight: number; kcal: number; p: number; f: number; c: number; fiber: number }>>;
  water: number;
}

function loadFromLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function escapeCSV(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    normal: 'Норма', high: 'Повышено', low: 'Понижено',
    slightlyHigh: 'Небольшое повышение', slightlyLow: 'Небольшое понижение',
    deficient: 'Дефицит', optimal: 'Оптимально', moderate: 'Умеренное',
    ir: 'Инсулинорезистентность', severe_ir: 'Выраженная ИР',
    g2: 'Стадия G2', g3a: 'Стадия G3a', g3b: 'Стадия G3b', g4: 'Стадия G4', g5: 'Стадия G5',
    alcohol: 'Алкогольный', viral: 'Вирусный',
  };
  return map[status] || status;
}

function MiniSVGLineChart({ data, width = 320, height = 120 }: { data: Array<{ label: string; value: number }>; width?: number; height?: number }) {
  if (data.length < 2) return <div style={{ color: '#888', fontSize: 12 }}>Недостаточно данных для графика</div>;
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padY = 8;
  const padX = 40;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;
  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * chartW,
    y: padY + chartH - ((d.value - min) / range) * chartH,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  return (
    <svg width={width} height={height} style={{ background: '#1a1a2e', borderRadius: 8, display: 'block' }}>
      {(() => {
        const lines: React.ReactElement[] = [];
        for (let i = 0; i <= 4; i++) {
          const y = padY + (chartH * i) / 4;
          const val = max - (range * i) / 4;
          lines.push(<line key={`l${i}`} x1={padX} y1={y} x2={width - padX} y2={y} stroke="#333" strokeWidth={0.5} />);
          lines.push(<text key={`t${i}`} x={padX - 4} y={y + 3} textAnchor="end" fill="#888" fontSize={9}>{val.toFixed(1)}</text>);
        }
        return lines;
      })()}
      <path d={pathD} fill="none" stroke="#4fc3f7" strokeWidth={2} />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="#4fc3f7" />)}
      {data.filter((_, i) => data.length <= 8 || i % Math.ceil(data.length / 8) === 0).map((d, idx) => {
        const p = points[data.indexOf(d)];
        return <text key={`lb${idx}`} x={p.x} y={height - 2} textAnchor="middle" fill="#888" fontSize={8}>{d.label.slice(5)}</text>;
      })}
    </svg>
  );
}

export const ReportsScreen: React.FC = () => {
  const [tab, setTab] = useState<ReportTab>('summary');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [labs, setLabs] = useState<LabPoint[]>([]);
  const [course, setCourse] = useState<CourseEntry[]>([]);
  const [diary, setDiary] = useState<Record<string, DayDiary>>({});
  const [gamState, setGamState] = useState<GamificationState | null>(null);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [readiness, setReadiness] = useState<ReadinessScores | null>(null);
  const [indices, setIndices] = useState<ReturnType<typeof calculateIndices> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        await db.init();
        const prof = getProfile();
        setProfile(prof);
        const labEntries = await db.getAll<LabPoint & { patientId?: string }>('labs_log');
        setLabs(labEntries.map(l => { const { patientId, ...rest } = l; return rest; }));
        const courseEntries = await db.getAll<CourseEntry>('course_log');
        setCourse(courseEntries);
        const diaryData = loadFromLS<Record<string, DayDiary>>('nutrition_diary', {});
        setDiary(diaryData);
        const gam = loadFromLS<GamificationState | null>('he_gamification', null);
        setGamState(gam);
        if (prof) {
          const genetics: Record<string, string> = prof.settings?.genetics ?? {};
          const nutritionFactor = prof.settings?.nutritionFactor ?? 1.0;
          const trainingFactor = prof.settings?.trainingFactor ?? 1.0;
          const drugs: Record<string, { dosePerWeek: number }> = {};
          courseEntries.forEach(entry => {
            const freq = typeof entry.frequency === 'number' ? entry.frequency : entry.frequency === 'daily' ? 7 : entry.frequency === 'eod' ? 3.5 : 1;
            drugs[entry.substanceId] = { dosePerWeek: entry.doseValue * freq };
          });
          const risk = calculateRisks({ genetics, nutritionFactor, trainingFactor, activeDrugs: drugs, supportCoverage: {} });
          setRiskResult(risk);
          const ri: ReadinessInput = {
            sleepHours: prof.settings?.baselineSleepHours ?? 7,
            sleepQuality: prof.settings?.baselineSleepQuality ?? 0.7,
            nightAwakenings: 1,
            hrvRatio: prof.settings?.baselineHrvRatio ?? 1.0,
            doms: 3,
            stress: prof.settings?.baselineStressLevel ?? 3,
            riskCoverageMap: {},
            calRatio: 0.9,
            proteinRatio: 0.85,
            waterRatio: 0.8,
            fiberRatio: 0.7,
            omega3Flag: false,
            trainingLoadRatio: 0.8,
            subjFatigue: 3,
            hrIncrease: 0.1,
          };
          setReadiness(calcReadiness(ri));
          const sex = prof.settings?.sex ?? 'male';
          const age = prof.settings?.age ?? 30;
          setIndices(calculateIndices(labEntries.map(l => { const { patientId, ...rest } = l; return rest; }), sex, age));
        }
      } catch (e) {
        setError('Не удалось загрузить данные');
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const collectAllData = () => {
    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      profile,
      labs,
      course,
      nutritionDiary: diary,
      gamification: gamState,
      riskSummary: riskResult ? { overallRaw: riskResult.overallRaw, overallNet: riskResult.overallNet } : null,
      readiness: readiness,
      clinicalIndices: indices,
    };
  };

  const handleExportJSON = () => {
    const data = collectAllData();
    triggerDownload(JSON.stringify(data, null, 2), `health-engine-export-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  const handleExportDiaryCSV = () => {
    const entries: Array<{ date: string; meal: string; food: string; weight_g: number; kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number }> = [];
    for (const [date, day] of Object.entries(diary)) {
      for (const [meal, items] of Object.entries(day.meals)) {
        for (const item of items) {
          entries.push({ date, meal, food: item.name, weight_g: item.weight, kcal: item.kcal, protein_g: item.p, fat_g: item.f, carbs_g: item.c, fiber_g: item.fiber });
        }
      }
    }
    if (!entries.length) { setError('Нет данных дневника питания'); return; }
    const headers = ['date', 'meal', 'food', 'weight_g', 'kcal', 'protein_g', 'fat_g', 'carbs_g', 'fiber_g'];
    const csv = [headers.join(','), ...entries.map(e => headers.map(h => escapeCSV(e[h as keyof typeof e])).join(','))].join('\n');
    triggerDownload(csv, `nutrition-diary-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };

  const handleExportLabsCSV = () => {
    if (!labs.length) { setError('Нет данных анализов'); return; }
    const headers = ['date', 'code', 'name', 'value', 'unit', 'phase', 'ref_low', 'ref_high'];
    const rows = labs.map(l => {
      const ref = UCUM_MAP[l.code];
      return [l.date, l.code, l.name || '', l.value, l.unit, l.phase, ref?.lln ?? '', ref?.uln ?? ''].map(escapeCSV).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    triggerDownload(csv, `labs-export-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        if (data.version !== EXPORT_VERSION) {
          setImportMsg('Версия файла не совпадает. Возможны проблемы совместимости.');
        }
        if (data.profile) {
          localStorage.setItem('he_profile_v2', JSON.stringify(data.profile));
        }
        if (data.labs && Array.isArray(data.labs)) {
          await db.init();
          for (const lab of data.labs) {
            await db.put('labs_log', { ...lab, patientId: 'current-user' });
          }
        }
        if (data.course && Array.isArray(data.course)) {
          await db.init();
          for (const entry of data.course) {
            await db.put('course_log', entry);
          }
        }
        if (data.nutritionDiary) {
          localStorage.setItem('nutrition_diary', JSON.stringify(data.nutritionDiary));
        }
        if (data.gamification) {
          localStorage.setItem('he_gamification', JSON.stringify(data.gamification));
        }
        setImportMsg('Импорт выполнен успешно. Перезагрузите страницу для применения.');
      } catch (err) {
        setImportMsg('Ошибка импорта: файл повреждён или неверный формат.');
        console.error(err);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const labTrendData = (() => {
    const grouped: Record<string, Array<{ label: string; value: number }>> = {};
    for (const l of labs) {
      if (!grouped[l.code]) grouped[l.code] = [];
      grouped[l.code].push({ label: l.date, value: l.value });
    }
    for (const code of Object.keys(grouped)) {
      grouped[code].sort((a, b) => a.label.localeCompare(b.label));
    }
    return grouped;
  })();

  const diaryDates = Object.keys(diary).sort();
  const latestDiaryDay = diaryDates.length > 0 ? diary[diaryDates[diaryDates.length - 1]] : null;
  const latestDiaryTotals = latestDiaryDay ? (() => {
    let kcal = 0, p = 0, f = 0, c = 0;
    for (const items of Object.values(latestDiaryDay.meals)) {
      for (const item of items) { kcal += item.kcal; p += item.p; f += item.f; c += item.c; }
    }
    return { kcal: Math.round(kcal), p: Math.round(p), f: Math.round(f), c: Math.round(c) };
  })() : null;

  const latestLabsByCode: Record<string, LabPoint> = {};
  for (const l of labs) {
    if (!latestLabsByCode[l.code] || l.date > latestLabsByCode[l.code].date) {
      latestLabsByCode[l.code] = l;
    }
  }

  const systemLabels: Record<string, string> = {
    cardio: 'Сердечно-сосудистая', hepatic: 'Печень', renal: 'Почки',
    neuro: 'Нервная', endocrine: 'Эндокринная', hematologic: 'Кроветворная', reproductive: 'Репродуктивная'
  };

  if (loading) return <div className="screen reports">Загрузка данных...</div>;

  const printSection = (
    <div id="printable-report" style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ borderBottom: '2px solid #007aff', paddingBottom: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Health Engine — Отчёт</h1>
        <span style={{ color: '#888', fontSize: 12 }}>Дата: {new Date().toISOString().slice(0, 10)}</span>
      </div>

      {profile && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, borderLeft: '3px solid #007aff', paddingLeft: 8, margin: '0 0 8px' }}>Профиль</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr><td style={{ padding: 4, borderBottom: '1px solid #eee', fontWeight: 600, width: 160 }}>Имя</td><td style={{ padding: 4, borderBottom: '1px solid #eee' }}>{profile.name || '—'}</td></tr>
              <tr><td style={{ padding: 4, borderBottom: '1px solid #eee', fontWeight: 600 }}>Возраст</td><td style={{ padding: 4, borderBottom: '1px solid #eee' }}>{profile.settings?.age ?? '—'}</td></tr>
              <tr><td style={{ padding: 4, borderBottom: '1px solid #eee', fontWeight: 600 }}>Пол</td><td style={{ padding: 4, borderBottom: '1px solid #eee' }}>{profile.settings?.sex === 'male' ? 'Мужской' : 'Женский'}</td></tr>
              <tr><td style={{ padding: 4, borderBottom: '1px solid #eee', fontWeight: 600 }}>Вес</td><td style={{ padding: 4, borderBottom: '1px solid #eee' }}>{profile.settings?.weight ?? '—'} кг</td></tr>
              <tr><td style={{ padding: 4, borderBottom: '1px solid #eee', fontWeight: 600 }}>Цель</td><td style={{ padding: 4, borderBottom: '1px solid #eee' }}>{profile.settings?.primaryGoal || profile.settings?.goal || '—'}</td></tr>
              <tr><td style={{ padding: 4, borderBottom: '1px solid #eee', fontWeight: 600 }}>Фаза</td><td style={{ padding: 4, borderBottom: '1px solid #eee' }}>{profile.settings?.phase || '—'}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {riskResult && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, borderLeft: '3px solid #ef4444', paddingLeft: 8, margin: '0 0 8px' }}>Риски</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f3f4f6' }}><th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #ccc' }}>Система</th><th style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #ccc' }}>Сырой</th><th style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #ccc' }}>Чистый</th></tr></thead>
            <tbody>
              {riskResult.systemBreakdown && Object.entries(riskResult.systemBreakdown).map(([sys, data]) => (
                <tr key={sys}><td style={{ padding: 6, borderBottom: '1px solid #eee' }}>{systemLabels[sys] || sys}</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #eee' }}>{data.raw.toFixed(1)}%</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #eee' }}>{data.net.toFixed(1)}%</td></tr>
              ))}
              <tr style={{ fontWeight: 700 }}><td style={{ padding: 6 }}>Общий</td><td style={{ padding: 6, textAlign: 'right' }}>{riskResult.overallRaw.toFixed(1)}%</td><td style={{ padding: 6, textAlign: 'right' }}>{riskResult.overallNet.toFixed(1)}%</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {readiness && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, borderLeft: '3px solid #30d158', paddingLeft: 8, margin: '0 0 8px' }}>Готовность</h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div><strong>Восстановление:</strong> {readiness.recovery}%</div>
            <div><strong>Питание:</strong> {readiness.nutrition}%</div>
            <div><strong>Поддержка:</strong> {readiness.support}%</div>
            <div><strong>Усталость:</strong> {readiness.fatigue}%</div>
            {readiness.isConservative && <div style={{ color: '#ef4444' }}>Консервативный режим: {readiness.conservativeReason}</div>}
          </div>
        </div>
      )}

      {labs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, borderLeft: '3px solid #f59e0b', paddingLeft: 8, margin: '0 0 8px' }}>Лабораторные анализы</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: '#f3f4f6' }}><th style={{ padding: 4, textAlign: 'left', borderBottom: '1px solid #ccc' }}>Показатель</th><th style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid #ccc' }}>Значение</th><th style={{ padding: 4, textAlign: 'left', borderBottom: '1px solid #ccc' }}>Ед.</th><th style={{ padding: 4, textAlign: 'center', borderBottom: '1px solid #ccc' }}>Реф.</th><th style={{ padding: 4, textAlign: 'center', borderBottom: '1px solid #ccc' }}>Дата</th></tr></thead>
            <tbody>
              {Object.entries(latestLabsByCode).sort((a, b) => a[0].localeCompare(b[0])).map(([, l]) => {
                const ref = UCUM_MAP[l.code];
                return (
                  <tr key={l.code}>
                    <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>{l.name || l.code}</td>
                    <td style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid #eee' }}>{l.value}</td>
                    <td style={{ padding: 4, borderBottom: '1px solid #eee' }}>{l.unit}</td>
                    <td style={{ padding: 4, textAlign: 'center', borderBottom: '1px solid #eee' }}>{ref ? `${ref.lln}–${ref.uln}` : '—'}</td>
                    <td style={{ padding: 4, textAlign: 'center', borderBottom: '1px solid #eee' }}>{l.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {indices && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, borderLeft: '3px solid #8b5cf6', paddingLeft: 8, margin: '0 0 8px' }}>Клинические индексы</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f3f4f6' }}><th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #ccc' }}>Индекс</th><th style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #ccc' }}>Значение</th><th style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #ccc' }}>Реф.</th><th style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #ccc' }}>Статус</th></tr></thead>
            <tbody>
              <tr><td style={{ padding: 6, borderBottom: '1px solid #eee' }}>HOMA-IR</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #eee' }}>{indices.homaIR.value}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{indices.homaIR.ref[0]}–{indices.homaIR.ref[1]}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{statusLabel(indices.homaIR.status)}</td></tr>
              <tr><td style={{ padding: 6, borderBottom: '1px solid #eee' }}>FAI</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #eee' }}>{indices.fai.value}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{indices.fai.ref[0]}–{indices.fai.ref[1]}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{statusLabel(indices.fai.status)}</td></tr>
              <tr><td style={{ padding: 6, borderBottom: '1px solid #eee' }}>Своб. тестостерон</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #eee' }}>{indices.freeTestosterone.value} {indices.freeTestosterone.unit}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{indices.freeTestosterone.ref[0]}–{indices.freeTestosterone.ref[1]}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{statusLabel(indices.freeTestosterone.status)}</td></tr>
              <tr><td style={{ padding: 6, borderBottom: '1px solid #eee' }}>eGFR</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #eee' }}>{indices.egfr.value}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{indices.egfr.ref[0]}–{indices.egfr.ref[1]}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{statusLabel(indices.egfr.status)}</td></tr>
              <tr><td style={{ padding: 6, borderBottom: '1px solid #eee' }}>De Ritis (АСТ/АЛТ)</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #eee' }}>{indices.deritis.value}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{indices.deritis.ref[0]}–{indices.deritis.ref[1]}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{statusLabel(indices.deritis.status)}</td></tr>
              <tr><td style={{ padding: 6, borderBottom: '1px solid #eee' }}>LDL/HDL</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #eee' }}>{indices.ldlHdlRatio.value}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{indices.ldlHdlRatio.ref[0]}–{indices.ldlHdlRatio.ref[1]}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{statusLabel(indices.ldlHdlRatio.status)}</td></tr>
              <tr><td style={{ padding: 6, borderBottom: '1px solid #eee' }}>TG/HDL</td><td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #eee' }}>{indices.tgHdlRatio.value}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{indices.tgHdlRatio.ref[0]}–{indices.tgHdlRatio.ref[1]}</td><td style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid #eee' }}>{statusLabel(indices.tgHdlRatio.status)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 32, paddingTop: 12, borderTop: '1px solid #000', fontSize: 11, color: '#666', textAlign: 'center' }}>
        Отчёт сформирован автоматически. Информация носит справочный характер и не является медицинской рекомендацией.
      </div>
    </div>
  );

  return (
    <div className="screen reports">
      <style>{`
        @media print {
          body > *:not(#printable-report-wrap) { display: none !important; }
          #printable-report-wrap { display: block !important; }
        }
      `}</style>
      <div className="reports-header">
        <h2>Отчёты и аналитика</h2>
        <p>Детальная аналитика показателей здоровья, тренировок и питания</p>
      </div>

      <div className="reports-controls" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {(['summary', 'labs', 'nutrition', 'pharma', 'print'] as ReportTab[]).map(t => (
          <button key={t} className={`btn${tab === t ? '-primary' : '-secondary'}`} onClick={() => setTab(t)} style={{ fontSize: 13 }}>
            {t === 'summary' ? 'Обзор' : t === 'labs' ? 'Анализы' : t === 'nutrition' ? 'Питание' : t === 'pharma' ? 'Курс' : 'Печать'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button className="btn" onClick={handleExportJSON}>Экспорт всех данных (JSON)</button>
        <button className="btn secondary" onClick={handleExportDiaryCSV}>Экспорт дневника (CSV)</button>
        <button className="btn secondary" onClick={handleExportLabsCSV}>Экспорт анализов (CSV)</button>
        <button className="btn secondary" onClick={() => window.print()}>Печать отчёта (PDF)</button>
        <button className="btn secondary" onClick={() => fileInputRef.current?.click()}>Импорт JSON</button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJSON} />
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      {importMsg && <div className="alert alert-info" style={{ marginBottom: 12, background: '#e0f2fe', padding: 8, borderRadius: 6 }}>{importMsg}</div>}

      <div id="printable-report-wrap" style={tab === 'print' ? {} : { display: 'none' }}>
        {printSection}
      </div>

      {tab === 'summary' && (
        <div className="report-content">
          <h3>Общий обзор</h3>

          {profile && (
            <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div className="metric-item" style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 13 }}>Имя</h4><p className="value" style={{ margin: 0, fontSize: 18 }}>{profile.name || '—'}</p></div>
              <div className="metric-item" style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 13 }}>Возраст</h4><p className="value" style={{ margin: 0, fontSize: 18 }}>{profile.settings?.age ?? '—'}</p></div>
              <div className="metric-item" style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 13 }}>Пол</h4><p className="value" style={{ margin: 0, fontSize: 18 }}>{profile.settings?.sex === 'male' ? 'Мужской' : 'Женский'}</p></div>
              <div className="metric-item" style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 13 }}>Вес</h4><p className="value" style={{ margin: 0, fontSize: 18 }}>{profile.settings?.weight ?? '—'} кг</p></div>
              <div className="metric-item" style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 13 }}>Цель</h4><p className="value" style={{ margin: 0, fontSize: 18 }}>{profile.settings?.primaryGoal || profile.settings?.goal || '—'}</p></div>
            </div>
          )}

          {riskResult && (
            <div style={{ marginBottom: 20 }}>
              <h4>Риски</h4>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div className="metric-item" style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 13 }}>Общий сырой</h4><p style={{ margin: 0, fontSize: 18, color: riskResult.overallRaw > 50 ? '#ef4444' : riskResult.overallRaw > 25 ? '#eab308' : '#22c55e' }}>{riskResult.overallRaw.toFixed(1)}%</p></div>
                <div className="metric-item" style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><h4 style={{ margin: '0 0 4px', fontSize: 13 }}>Общий чистый</h4><p style={{ margin: 0, fontSize: 18, color: riskResult.overallNet > 50 ? '#ef4444' : riskResult.overallNet > 25 ? '#eab308' : '#22c55e' }}>{riskResult.overallNet.toFixed(1)}%</p></div>
              </div>
            </div>
          )}

          {readiness && (
            <div style={{ marginBottom: 20 }}>
              <h4>Готовность</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                <div style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><div style={{ fontSize: 11, color: '#888' }}>Восстановление</div><div style={{ fontSize: 22, fontWeight: 700 }}>{readiness.recovery}%</div></div>
                <div style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><div style={{ fontSize: 11, color: '#888' }}>Питание</div><div style={{ fontSize: 22, fontWeight: 700 }}>{readiness.nutrition}%</div></div>
                <div style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><div style={{ fontSize: 11, color: '#888' }}>Поддержка</div><div style={{ fontSize: 22, fontWeight: 700 }}>{readiness.support}%</div></div>
                <div style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><div style={{ fontSize: 11, color: '#888' }}>Усталость</div><div style={{ fontSize: 22, fontWeight: 700 }}>{readiness.fatigue}%</div></div>
              </div>
              {readiness.isConservative && <div style={{ color: '#ef4444', marginTop: 8, fontSize: 13 }}>Консервативный режим: {readiness.conservativeReason}</div>}
            </div>
          )}

          {indices && (
            <div style={{ marginBottom: 20 }}>
              <h4>Клинические индексы</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {([
                  { key: 'homaIR', label: 'HOMA-IR', data: indices.homaIR },
                  { key: 'fai', label: 'FAI', data: indices.fai },
                  { key: 'ft', label: 'Своб. тестостерон', data: indices.freeTestosterone },
                  { key: 'egfr', label: 'eGFR', data: indices.egfr },
                  { key: 'deritis', label: 'De Ritis', data: indices.deritis },
                  { key: 'ldlHdl', label: 'LDL/HDL', data: indices.ldlHdlRatio },
                  { key: 'tgHdl', label: 'TG/HDL', data: indices.tgHdlRatio },
                ] as const).map(item => {
                  const statusColor = item.data.status === 'normal' || item.data.status === 'optimal' ? '#22c55e' : item.data.status === 'high' || item.data.status === 'severe_ir' ? '#ef4444' : '#eab308';
                  return (
                    <div key={item.key} style={{ background: '#1e1e2e', padding: 10, borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: '#888' }}>{item.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{item.data.value} <span style={{ fontSize: 11 }}>{item.key === 'ft' ? indices.freeTestosterone.unit : ''}</span></div>
                      <div style={{ fontSize: 11, color: statusColor }}>{statusLabel(item.data.status)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'labs' && (
        <div className="report-content">
          <h3>Лабораторные анализы</h3>
          {labs.length === 0 ? (
            <p style={{ color: '#888' }}>Нет данных анализов. Добавьте анализы на экране лабораторий.</p>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
                <thead><tr style={{ background: '#1e1e2e' }}>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #333' }}>Показатель</th>
                  <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #333' }}>Значение</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #333' }}>Ед.</th>
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #333' }}>Референс</th>
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #333' }}>Дата</th>
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #333' }}>Фаза</th>
                </tr></thead>
                <tbody>
                  {Object.entries(latestLabsByCode).sort((a, b) => a[0].localeCompare(b[0])).map(([, l]) => {
                    const ref = UCUM_MAP[l.code];
                    const isAbnormal = ref && (l.value < ref.lln || l.value > ref.uln);
                    return (
                      <tr key={l.code} style={{ background: isAbnormal ? 'rgba(239,68,68,0.1)' : 'transparent' }}>
                        <td style={{ padding: 8, borderBottom: '1px solid #222' }}>{l.name || l.code}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #222', textAlign: 'right', fontWeight: isAbnormal ? 700 : 400, color: isAbnormal ? '#ef4444' : 'inherit' }}>{l.value}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #222' }}>{l.unit}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #222', textAlign: 'center' }}>{ref ? `${ref.lln}–${ref.uln}` : '—'}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #222', textAlign: 'center' }}>{l.date}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #222', textAlign: 'center' }}>{l.phase || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <h4>Тренды анализов</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                {Object.entries(labTrendData).filter(([, pts]) => pts.length >= 2).sort((a, b) => a[0].localeCompare(b[0])).map(([code, pts]) => {
                  const ref = UCUM_MAP[code];
                  return (
                    <div key={code} style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{ref?.name || code} {ref ? `(${ref.lln}–${ref.uln} ${ref.prefUnit})` : ''}</div>
                      <MiniSVGLineChart data={pts} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'nutrition' && (
        <div className="report-content">
          <h3>Питание</h3>
          {Object.keys(diary).length === 0 ? (
            <p style={{ color: '#888' }}>Нет данных дневника питания. Заполняйте дневник на экране питания.</p>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <h4>Последний день ({diaryDates[diaryDates.length - 1]})</h4>
                {latestDiaryTotals ? (
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><div style={{ fontSize: 11, color: '#888' }}>Калории</div><div style={{ fontSize: 20, fontWeight: 700 }}>{latestDiaryTotals.kcal} ккал</div></div>
                    <div style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><div style={{ fontSize: 11, color: '#888' }}>Белки</div><div style={{ fontSize: 20, fontWeight: 700 }}>{latestDiaryTotals.p} г</div></div>
                    <div style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><div style={{ fontSize: 11, color: '#888' }}>Жиры</div><div style={{ fontSize: 20, fontWeight: 700 }}>{latestDiaryTotals.f} г</div></div>
                    <div style={{ background: '#1e1e2e', padding: 12, borderRadius: 8 }}><div style={{ fontSize: 11, color: '#888' }}>Углеводы</div><div style={{ fontSize: 20, fontWeight: 700 }}>{latestDiaryTotals.c} г</div></div>
                  </div>
                ) : <p>Нет данных</p>}
              </div>
              <h4>Записей в дневнике: {Object.keys(diary).length}</h4>
              <p style={{ color: '#888', fontSize: 13 }}>Детальные данные доступны через экспорт CSV</p>
            </>
          )}
        </div>
      )}

      {tab === 'pharma' && (
        <div className="report-content">
          <h3>Фармакологический курс</h3>
          {course.length === 0 ? (
            <p style={{ color: '#888' }}>Нет данных о курсе. Настройте курс на экране фармакологии.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#1e1e2e' }}>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #333' }}>Вещество</th>
                <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #333' }}>Доза</th>
                <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #333' }}>Частота</th>
                <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #333' }}>Недели</th>
              </tr></thead>
              <tbody>
                {course.map((c, i) => (
                  <tr key={c.id || i}>
                    <td style={{ padding: 8, borderBottom: '1px solid #222' }}>{c.substanceId}</td>
                    <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #222' }}>{c.doseValue} {c.doseUnit}</td>
                    <td style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #222' }}>{c.frequency}</td>
                    <td style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #222' }}>{c.startWeek}–{c.endWeek}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}


    </div>
  );
};