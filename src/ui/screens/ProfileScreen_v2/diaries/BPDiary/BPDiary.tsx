import React, { useEffect, useMemo, useRef, useState } from 'react';
import { colors } from '../../ui';
import {
  buildWeeklyHistogram,
  compareWithLastWeek,
  crossCorrelation,
  computeDistribution,
  computeExtremes,
  computeStreak,
  detectAnomalies,
  exportSvgAsFile,
  exportSvgAsPng,
  filterByRange,
  getNormalRange,
  laggedCorrelation,
  paginate,
  sortEntries,
  todayIso,
  type DiaryEntryLike,
  type SortState,
} from '../../diary-helpers';
import type { DiaryWindowProps } from '../../DiaryWindow';
import {
  BPEntry,
  classifyBP,
  getBpClassificationLabel,
  getBpClassificationColor,
  calcMAP,
  calcPulsePressure,
  calcBPLoad,
  calcVariability,
  checkOrthostatic,
  getCircadianPattern,
  compareMedsVsNoMeds,
  calculateGoalAchievement,
  getDefaultGoals,
} from '../../../../../core/bp-hr-data';
import { BPChart } from './BPChart';
import { useBPAlerts } from './useBPAlerts';
import { calculateTrend } from './bp-trend-prediction';
import { AnimatedCounter } from '@/ui/components/AnimatedCounter';

const KEY = 'he_bp_diary';
type BPForm = {
  date: string;
  systolic: string;
  diastolic: string;
  pulse: string;
  position?: BPEntry['position'];
  arm?: BPEntry['arm'];
  timeOfDay?: BPEntry['timeOfDay'];
  medicationTaken?: boolean;
  symptomsText: string;
  notes?: string;
};

const btn: React.CSSProperties = {
  minHeight: 36, padding: '6px 10px', borderRadius: 7,
  background: '#27272a', border: '1px solid #3f3f46', color: '#fff', cursor: 'pointer',
};
const input: React.CSSProperties = { ...btn, width: '100%', background: '#18181b', boxSizing: 'border-box' };
const card: React.CSSProperties = {
  padding: 12, borderRadius: 10,
  background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.2)',
};
const infoCard: React.CSSProperties = {
  padding: 12, borderRadius: 10,
  background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.2)',
};
const goodCard: React.CSSProperties = {
  padding: 12, borderRadius: 10,
  background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.2)',
};
const warnCard: React.CSSProperties = {
  padding: 12, borderRadius: 10,
  background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.2)',
};
const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);

function readEntries(): BPEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x: any) => x && typeof x.date === 'string')
      .map((x: any) => ({
        date: x.date,
        systolic: Number(x.systolic), diastolic: Number(x.diastolic),
        hr: Number(x.hr ?? x.pulse),
        notes: x.notes, position: x.position, arm: x.arm,
        timeOfDay: x.timeOfDay, medicationTaken: x.medicationTaken,
        symptoms: Array.isArray(x.symptoms) ? x.symptoms : [],
      }))
      .filter((x: BPEntry) =>
        Number.isFinite(x.systolic) && Number.isFinite(x.diastolic) && Number.isFinite(x.hr)
      );
  } catch { return []; }
}

function commitEntries(entries: BPEntry[]): BPEntry[] {
  const ordered = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem(KEY, JSON.stringify(ordered.slice(0, 365)));
  return ordered;
}

const defaultDraft = (): BPForm => ({
  date: todayIso(), systolic: '120', diastolic: '80', pulse: '70',
  position: 'sitting', arm: 'left', timeOfDay: 'morning',
  medicationTaken: false, symptomsText: '',
});

export const BPDiary: React.FC<DiaryWindowProps> = ({ open, onClose, goals, onDataChange }) => {
  const [rows, setRows] = useState<BPEntry[]>([]);
  const [draft, setDraft] = useState<BPForm>(defaultDraft());
  const [editing, setEditing] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [undo, setUndo] = useState<BPEntry[] | null>(null);
  const [range, setRange] = useState<'all' | '7' | '30' | '90'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'journal' | 'stats' | 'analysis'>('journal');
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => { if (open) setRows(readEntries()); }, [open]);

  const [alerts, dismissAlert] = useBPAlerts({
    entries: rows,
    medicationTaken: rows[0]?.medicationTaken,
    lastMeasurementDate: rows[0]?.date,
  });

  const commit = (next: BPEntry[], remember = true) => {
    const ordered = commitEntries(next);
    setRows(ordered);
    if (remember) setUndo(rows);
    onDataChange?.();
  };

  const openNew = () => { setEditing(null); setDraft(defaultDraft()); setModal(true); };

  const save = () => {
    const s = Number(draft.systolic), d = Number(draft.diastolic), p = Number(draft.pulse);
    if (!draft.date || ![s, d, p].every(Number.isFinite) ||
      s < 50 || s > 250 || d < 30 || d > 180 || p < 20 || p > 250 || d >= s) return;
    const entry: BPEntry = {
      date: draft.date, systolic: Math.round(s), diastolic: Math.round(d), hr: Math.round(p),
      position: draft.position, arm: draft.arm, timeOfDay: draft.timeOfDay,
      medicationTaken: draft.medicationTaken,
       symptoms: (draft.symptomsText || '').split(',').map((x: string) => x.trim()).filter(Boolean),
      notes: draft.notes?.trim() || undefined,
    };
    commit(editing
      ? rows.map(x => x.date === editing ? entry : x)
      : [entry, ...rows.filter(x => x.date !== entry.date)]);
    setModal(false); setEditing(null);
  };

  const editRow = (x: BPEntry) => {
    setEditing(x.date);
    setDraft({ ...defaultDraft(), ...x, systolic: String(x.systolic), diastolic: String(x.diastolic), pulse: String(x.hr), symptomsText: (x.symptoms || []).join(', ') });
    setModal(true);
  };

  // --- computed values ---
  const entries: DiaryEntryLike[] = useMemo(() =>
    rows.map(x => ({
      date: x.date,
      fields: [
        { label: 'Систола', value: String(x.systolic), unit: 'мм рт.ст.' },
        { label: 'Диастола', value: String(x.diastolic), unit: 'мм рт.ст.' },
        { label: 'Пульс', value: String(x.hr), unit: 'уд/мин' },
        ...(x.notes ? [{ label: 'Заметка', value: x.notes, unit: '' }] : []),
      ],
    })), [rows]);

  const visible = useMemo(() => {
    let x = filterByRange(entries, range);
    if (query.trim()) {
      const q = query.toLowerCase();
      x = x.filter(e => e.date.includes(q) || e.fields.some(f => f.value.toLowerCase().includes(q)));
    }
    return sortEntries(x, sort);
  }, [entries, range, query, sort]);

  const pageData = paginate(visible, page, 8);
  const points = visible.map(e => ({ date: e.date, value: Number(e.fields[0].value) })).filter(x => Number.isFinite(x.value));
  const dist = computeDistribution(points.map(x => x.value));
  const extremes = computeExtremes('bp', visible);
  const streak = computeStreak(visible);
  const anomalies = detectAnomalies('bp', visible);
  const comparison = compareWithLastWeek(points);
  const weekly = buildWeeklyHistogram(points);
  const normal = getNormalRange('bp');

  const latest = rows[0];
  const recentRows = rows.filter(x => visible.some(v => v.date === x.date));
  const bpGoal = goals?.systolicTarget > 0 ? goals.systolicTarget : 120;
  const bpClass = latest ? classifyBP(latest.systolic, latest.diastolic) : 'normal';
  const bpColor = getBpClassificationColor(bpClass);
  const bpLabel = getBpClassificationLabel(bpClass);

  // Averages
  const avgS = recentRows.length ? Math.round(recentRows.reduce((n, x) => n + x.systolic, 0) / recentRows.length) : 0;
  const avgD = recentRows.length ? Math.round(recentRows.reduce((n, x) => n + x.diastolic, 0) / recentRows.length) : 0;
  const avgP = recentRows.length ? Math.round(recentRows.reduce((n, x) => n + x.hr, 0) / recentRows.length) : 0;
  const normalPct = recentRows.length
    ? Math.round(recentRows.filter(x => x.systolic < 130 && x.diastolic < 80).length / recentRows.length * 100) : 0;

  // Advanced metrics from bp-hr-data.ts
  const bpLoad = calcBPLoad(recentRows);
  const variability = calcVariability(recentRows);
  const mapAvg = recentRows.length ? Math.round(recentRows.reduce((n, x) => n + calcMAP(x.systolic, x.diastolic), 0) / recentRows.length) : 0;
  const ppAvg = recentRows.length ? Math.round(recentRows.reduce((n, x) => n + calcPulsePressure(x.systolic, x.diastolic), 0) / recentRows.length) : 0;
  const orthostatic = checkOrthostatic(recentRows);
  const circadian = getCircadianPattern(recentRows);
  const medsCompare = compareMedsVsNoMeds(recentRows);
  const goalAchievement = calculateGoalAchievement(recentRows, { systolicTarget: bpGoal, diastolicTarget: 80, hrTarget: 72 });
  const defaultGoals = getDefaultGoals(bpClass);
  const trendSystolic = useMemo(() => calculateTrend(recentRows, 'systolic'), [recentRows]);
  const trendDiastolic = useMemo(() => calculateTrend(recentRows, 'diastolic'), [recentRows]);

  // Correlations
  const bpCorrelations = useMemo(() => {
    const read = (key: string, value: (entry: any) => number) => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(raw)
          ? raw.map((entry: any) => ({ date: entry.date, value: value(entry) })).filter((x: any) => Number.isFinite(x.value))
          : [];
      } catch { return []; }
    };
    return [
      ['Сон', read('he_sleep_diary', (e) => Number(e.hours))],
      ['Вес', read('he_weight_log', (e) => Number(e.weight))],
      ['Боль', read('he_health_diary', (e) => Number(e.pain?.totalScore ?? e.totalScore))],
    ]
      .flatMap(([label, data]) => {
        const same = crossCorrelation(points, data as { date: string; value: number }[]);
        const lagged = laggedCorrelation(points, data as { date: string; value: number }[], 1);
        return [same && { label, ...same, lag: 0 }, lagged && { label, ...lagged, lag: 1 }].filter(Boolean) as Array<{ label: string; r: number; n: number; lag: number }>;
      })
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, 6);
  }, [points]);

  const exportCsv = () => {
    const head = 'Дата,Систола,Диастола,Пульс,MAP,ПД,Положение,Рука,Время,Лекарство,Симптомы,Заметки\n';
    const body = rows.map(x =>
      [x.date, x.systolic, x.diastolic, x.hr,
        calcMAP(x.systolic, x.diastolic), calcPulsePressure(x.systolic, x.diastolic),
        x.position || '', x.arm || '', x.timeOfDay || '',
        x.medicationTaken ? 'да' : 'нет',
        (x.symptoms || []).join('; '), x.notes || '',
      ].map(esc).join(','),
    ).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + head + body], { type: 'text/csv' }));
    a.download = `bp-${todayIso()}.csv`; a.click();
  };

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const classOf = (s: number, d: number) => {
      const c = classifyBP(s, d);
      return { cls: c, label: getBpClassificationLabel(c), color: getBpClassificationColor(c) };
    };

    const interpretation = bpClass === 'crisis' ? 'КРИЗИС — немедленно к врачу!' :
      bpClass === 'stage2' ? 'Гипертензия 2 ст. — консультация кардиолога' :
      bpClass === 'stage1' ? 'Гипертензия 1 ст. — изменения образа жизни' :
      bpClass === 'elevated' ? 'Повышенное АД — соль <5г, ДД' : 'АД в норме';

    const html =
      `<!doctype html>
<meta charset="utf-8">
<title>Медицинский отчёт: Дневник АД</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #333; }
  h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 8px; }
  .section { margin: 16px 0; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin: 12px 0; }
  .card { padding: 8px 12px; border-radius: 6px; border-left: 4px solid #ccc; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #1e40af; color: #fff; padding: 6px; }
  td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
  .normal { color: #16a34a; } .elevated { color: #f59e0b; } .high { color: #ef4444; } .crisis { color: #b91c1c; font-weight: bold; }
  .interpretation { padding: 10px; border-radius: 6px; margin: 12px 0; font-weight: 600; }
  .interpretation.normal { background: #dcfce7; border: 1px solid #16a34a; }
  .interpretation.elevated { background: #fef3c7; border: 1px solid #f59e0b; }
  .interpretation.high { background: #fee2e2; border: 1px solid #ef4444; }
  .interpretation.crisis { background: #fecaca; border: 2px solid #b91c1c; }
  @media print { body { margin: 0; } }
</style>
<h1>Медицинский отчёт: Дневник артериального давления</h1>
<p>Дата отчёта: ${todayIso()} | Записей: ${rows.length} | Период: ${rows.length > 0 ? rows[rows.length - 1]?.date + ' — ' + rows[0]?.date : 'нет данных'}</p>

<div class="section">
  <h2>Сводка</h2>
  <div class="summary">
    <div class="card" style="border-left-color: ${bpColor}">
      <div>Среднее АД</div><strong>${avgS}/${avgD}</strong>
    </div>
    <div class="card"><div>Пульс</div><strong>${avgP} уд/мин</strong></div>
    <div class="card"><div>MAP</div><strong>${mapAvg} мм рт.ст.</strong></div>
    <div class="card"><div>Пульсовое</div><strong>${ppAvg} мм рт.ст.</strong></div>
    <div class="card"><div>BP Load</div><strong>${bpLoad}%</strong></div>
    <div class="card"><div>В норме</div><strong>${normalPct}%</strong></div>
  </div>
</div>

<div class="interpretation ${bpClass}">
  Классификация: ${bpLabel} | ${interpretation}
</div>

<div class="section">
  <h2>Таблица измерений</h2>
  <table>
    <tr><th>Дата</th><th>АД</th><th>Пульс</th><th>MAP</th><th>ПД</th><th>Класс</th><th>Лекарство</th><th>Примечания</th></tr>` +
      rows.map(x => {
        const info = classOf(x.systolic, x.diastolic);
        return `<tr>
          <td>${esc(x.date)}</td>
          <td style="color:${info.color}"><b>${x.systolic}/${x.diastolic}</b></td>
          <td>${x.hr}</td>
          <td>${calcMAP(x.systolic, x.diastolic)}</td>
          <td>${calcPulsePressure(x.systolic, x.diastolic)}</td>
          <td style="color:${info.color}">${info.label}</td>
          <td>${x.medicationTaken ? 'да' : 'нет'}</td>
          <td>${esc(x.notes || '')}</td>
        </tr>`;
      }).join('') +
    `</table>
</div>

<div class="section">
  <h2>Анализ</h2>
  <p><b>Вариабельность (SD):</b> систола ${variability.sysSD.toFixed(1)}, диастола ${variability.diaSD.toFixed(1)}</p>
  <p><b>Достижение целей:</b> систола ≤${bpGoal} — ${goalAchievement.systolicAchieved}%, диастола ≤80 — ${goalAchievement.diastolicAchieved}%</p>
  ${orthostatic.detected ? `<p><b>Ортостатический тест:</b> сидя→стоя ${orthostatic.dropS >= 20 ? '⚠ падение систолы на ' + orthostatic.dropS : 'норма'}</p>` : ''}
  ${circadian.isNonDipper ? '<p><b>⚠ Non-dipper паттерн:</b> ночное АД не снижается</p>' : ''}
</div>

<div class="section">
  <p style="font-size:11px;color:#666;">Дневник сформирован автоматически. Данные не заменяют консультацию врача.</p>
</div>`;

    w.document.write(html);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 100);
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, height: '100dvh', maxHeight: '100dvh', background: '#09090b', color: colors.text, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 2, padding: 12, display: 'flex', gap: 7, flexWrap: 'wrap', background: '#18181b' }}>
        <button style={btn} onClick={onClose}>← Дневники</button>
        <b>❤️ Давление и пульс</b>
        <span>{rows.length} записей</span>
        <button style={btn} onClick={openNew}>+ Добавить</button>
        <button style={btn} onClick={openNew}>⚡ Сегодня</button>
        <button style={btn} onClick={exportCsv}>CSV</button>
        <button style={btn} onClick={print}>PDF/Печать</button>
        <button style={btn} onClick={() => svg.current && exportSvgAsFile(svg.current!, `bp-${todayIso()}.svg`)}>SVG</button>
        <button style={btn} onClick={() => svg.current && exportSvgAsPng(svg.current!, `bp-${todayIso()}.png`)}>PNG</button>
        <button style={btn} onClick={() => { if (window.confirm('Очистить дневник давления?')) commit([]); }}>Очистить</button>
        {undo && (
          <button style={btn} onClick={() => { commit(undo, false); setUndo(null); }}>↩ Отменить</button>
        )}
      </header>

      {/* Alerts */}
      {alerts.filter(a => !a.dismissed).length > 0 && (
        <div style={{ padding: '0 16px', maxWidth: 1100, margin: 'auto' }}>
          {alerts.filter(a => !a.dismissed).map(alert => (
            <div
              key={alert.id}
              style={{
                padding: 12, borderRadius: 8, marginBottom: 8,
                border: `1px solid ${alert.severity === 'critical' ? '#b91c1c' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6'}`,
                background: `${alert.severity === 'critical' ? 'rgba(185,28,28,.1)' : alert.severity === 'warning' ? 'rgba(245,158,11,.1)' : 'rgba(59,130,246,.1)'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <strong>{alert.title}</strong>
                <div style={{ fontSize: 13, marginTop: 4 }}>{alert.message}</div>
              </div>
              <button
                style={{ ...btn, padding: '4px 8px', fontSize: 12 }}
                onClick={() => dismissAlert(alert.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <main style={{ padding: 16, maxWidth: 1100, margin: 'auto' }}>
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', '7', '30', '90'] as const).map(x => (
            <button key={x} style={btn} onClick={() => { setRange(x); setPage(1); }}>
              {x === 'all' ? 'Всё' : `${x} дней`}
            </button>
          ))}
          <input style={{ ...input, width: 180 }} placeholder="Поиск" value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }} />
          <button style={btn} onClick={() => setSort({ key: 'date', dir: sort.dir === 'asc' ? 'desc' : 'asc' })}>↕ Сортировать</button>
          {(['journal', 'stats', 'analysis'] as const).map(t => (
            <button key={t} style={btn} onClick={() => setTab(t)}>
              {t === 'journal' ? '📋 Журнал' : t === 'stats' ? '📊 Статистика' : '🔬 Анализ'}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, margin: '12px 0' }}>
          {[
            ['Среднее АД', avgS && avgD ? { s: avgS, d: avgD } : null, bpColor],
            ['Пульс', avgP || null, undefined],
            ['MAP', mapAvg || null, undefined],
            ['Пульсовое', ppAvg || null, undefined],
            ['Последнее', latest ? { s: latest.systolic, d: latest.diastolic } : null, latest ? bpColor : undefined],
            ['Класс', bpLabel, bpColor],
            ['В норме', normalPct || null, normalPct >= 70 ? '#22c55e' : normalPct >= 40 ? '#f59e0b' : '#ef4444'],
            ['Серия', streak.current || null, undefined],
            ['Цель', bpGoal ? `≤${bpGoal}` : null, undefined],
          ].map(([l, v, color]) => {
            let content: React.ReactNode = '—';
            if (typeof v === 'string') {
              content = v;
            } else if (v && typeof v === 'object' && 's' in v) {
              content = `${v.s}/${v.d}`;
            } else if (typeof v === 'number') {
              content = <AnimatedCounter value={v} decimals={0} duration={500} style={{ fontSize: 18, fontWeight: 700 }} />;
            }
            return (
              <div key={String(l)} style={{ ...card, borderLeft: color ? `4px solid ${color}` : undefined }}>
                <small>{String(l)}</small>
                <strong style={{ display: 'block', fontSize: 18, color: typeof color === 'string' ? color : undefined }}>{content}</strong>
              </div>
            );
          })}
        </section>

        {/* Latest reading banner */}
        {latest && (
          <div style={{ marginBottom: 10, color: bpColor, fontWeight: 600 }}>
            Последняя запись:{' '}
            <b>{latest.date} · {latest.systolic}/{latest.diastolic} · {latest.hr} уд/мин</b>
            {' · '}{bpLabel}
            {latest.medicationTaken ? ' · 💊 Лекарство принято' : ''}
          </div>
        )}

        {/* ========== JOURNAL TAB ========== */}
        {tab === 'journal' && (
          <>
            {/* Chart using BPChart component */}
            {recentRows.length > 0 && (
              <section style={{ marginTop: 12 }}>
                <BPChart ref={svg} data={recentRows.map(r => ({ date: r.date, systolic: r.systolic, diastolic: r.diastolic, pulse: r.hr }))}
                  goalSystolic={bpGoal} goalDiastolic={80}
                  normalRange={normal ? { low: normal.low, high: normal.high } : { low: 120, high: 80 }} />
              </section>
            )}

            {/* Weekly histogram */}
            <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
              {weekly.map(x => (
                <div key={x.weekStart} style={{ ...card, flex: '1 1 100px' }}>
                  <small>{x.weekStart}</small>
                  <strong style={{ display: 'block' }}>{x.mean.toFixed(0)}</strong>
                  <small>{x.count} зап. · {x.min}/{x.max}</small>
                </div>
              ))}
            </section>

            {/* Anomalies */}
            {anomalies.slice(0, 8).map((x, i) => (
              <div key={i} style={{ color: x.severity === 'danger' ? '#ef4444' : '#f59e0b', margin: '4px 0' }}>
                ⚠ {x.date}: {x.message}
              </div>
            ))}

            {/* Correlations */}
            {bpCorrelations.length > 0 && (
              <section style={{ ...card, margin: '12px 0' }}>
                <h3>🔗 Корреляции и лаги</h3>
                {bpCorrelations.map((item, index) => (
                  <div key={`${item.label}-${item.lag}-${index}`}>
                    {item.label}: <b style={{ color: item.r >= 0 ? '#ef4444' : '#22c55e' }}>r={item.r.toFixed(2)}</b> ·{' '}
                    {item.lag ? 'лаг 1 день' : 'тот же день'} · n={item.n}
                  </div>
                ))}
              </section>
            )}

            {/* Data table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Дата</th><th>АД</th><th>Пульс</th><th>MAP</th><th>Класс</th><th>Контекст</th><th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {pageData.pageItems.map(e => {
                  const x = rows.find(r => r.date === e.date)!;
                  const cls = classifyBP(x.systolic, x.diastolic);
                  const clr = getBpClassificationColor(cls);
                  return (
                    <tr key={x.date} style={{ borderBottom: '1px solid #29292f' }}>
                      <td>{x.date}</td>
                      <td style={{ color: clr }}>{x.systolic}/{x.diastolic}</td>
                      <td>{x.hr}</td>
                      <td>{calcMAP(x.systolic, x.diastolic)}</td>
                      <td style={{ color: clr }}>{getBpClassificationLabel(cls)}</td>
                      <td>{x.position || '—'} · {x.timeOfDay || '—'}{x.medicationTaken ? ' · 💊' : ''}</td>
                      <td>
                        <button style={btn} onClick={() => editRow(x)}>Изменить</button>{' '}
                        <button style={btn} onClick={() => commit(rows.filter(r => r.date !== x.date))}>Удалить</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: 10 }}>
              <button style={btn} disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>{' '}
              Страница {page}/{pageData.totalPages}{' '}
              <button style={btn} disabled={page >= pageData.totalPages} onClick={() => setPage(page + 1)}>→</button>
            </div>
          </>
        )}

        {/* ========== STATS TAB ========== */}
        {tab === 'stats' && (
          <>
            <section style={{ ...card, marginTop: 12 }}>
              <h3>📊 Распределение и экстремумы</h3>
              <div>Среднее: <b>{dist?.mean.toFixed(1) || '—'}</b> · медиана: <b>{dist?.median.toFixed(1) || '—'}</b> · SD:{' '}
                <b>{dist?.stdDev.toFixed(1) || '—'}</b> · P25/P75:{' '}
                <b>{dist ? `${dist.p25.toFixed(1)}/${dist.p75.toFixed(1)}` : '—'}</b></div>
              <div>Минимум: {extremes.min ? `${extremes.min.value} (${extremes.min.date})` : '—'} · Максимум:{' '}
                {extremes.max ? `${extremes.max.value} (${extremes.max.date})` : '—'}</div>
              <div>Неделя к неделе:{' '}
                {comparison.delta == null ? '—' : <AnimatedCounter value={Math.abs(comparison.delta)} decimals={1} duration={500} prefix={comparison.delta > 0 ? '+' : '-'} style={{ fontSize: 14, fontWeight: 700 }} />}
              </div>
            </section>

            <section style={{ ...warnCard, marginTop: 12 }}>
              <h3>⚡ BP Load и вариабельность</h3>
              <div>BP Load: <b>{bpLoad}%</b> измерений выше цели (130/80)
                {bpLoad > 50 && <span style={{ color: '#ef4444' }}> — высокая нагрузка</span>}
                {bpLoad <= 25 && <span style={{ color: '#22c55e' }}> — хорошо</span>}
              </div>
              <div>Вариабельность (SD): систола <b>{variability.sysSD.toFixed(1)}</b>, диастола <b>{variability.diaSD.toFixed(1)}</b>
                {(variability.sysSD > 15 || variability.diaSD > 10) &&
                  <span style={{ color: '#f59e0b' }}> — повышенная (риск сердечно-сосудистых событий)</span>}
              </div>
            </section>

            <section style={{ ...goodCard, marginTop: 12 }}>
              <h3>🎯 Достижение целей</h3>
              <div>Цель: систола ≤{bpGoal}, диастола ≤80, пульс ≤72</div>
              <div>Систола в цели: <b>{goalAchievement.systolicAchieved}%</b></div>
              <div>Диастола в цели: <b>{goalAchievement.diastolicAchieved}%</b></div>
              <div>Пульс в цели: <b>{goalAchievement.hrAchieved}%</b></div>
            </section>

            <section style={{ ...infoCard, marginTop: 12 }}>
              <h3>💊 Эффект лекарств</h3>
              {medsCompare.onMeds.count > 0 || medsCompare.offMeds.count > 0 ? (
                <>
                  <div>На лекарствах: <b>{medsCompare.onMeds.count}</b> изм. · ср. {medsCompare.onMeds.avgS}/{medsCompare.onMeds.avgD}</div>
                  <div>Без лекарств: <b>{medsCompare.offMeds.count}</b> изм. · ср. {medsCompare.offMeds.avgS}/{medsCompare.offMeds.avgD}</div>
                  <div>Разница: систола <b style={{ color: medsCompare.diffS > 0 ? '#22c55e' : '#ef4444' }}>{medsCompare.diffS > 0 ? '−' : '+'}{Math.abs(medsCompare.diffS)}</b>, диастола <b style={{ color: medsCompare.diffD > 0 ? '#22c55e' : '#ef4444' }}>{medsCompare.diffD > 0 ? '−' : '+'}{Math.abs(medsCompare.diffD)}</b></div>
                </>
              ) : (
                <div>Недосточно данных с отметками о лекарствах.</div>
              )}
            </section>
          </>
        )}

        {/* ========== ANALYSIS TAB ========== */}
        {tab === 'analysis' && (
          <>
            <section style={{ ...card, marginTop: 12 }}>
              <h3>🩺 Ортостатический тест</h3>
              {orthostatic.detected || recentRows.some(r => r.position === 'standing') ? (
                <>
                  <div>Сидя → Стоя</div>
                  <div>Систола: <b>{orthostatic.dropS > 0 ? '−' : '+'}{Math.abs(orthostatic.dropS)}</b> мм рт.ст.
                    {orthostatic.dropS >= 20 && <span style={{ color: '#ef4444' }}> — ортостатическая гипотензия!</span>}
                  </div>
                  <div>Диастола: <b>{orthostatic.dropD > 0 ? '−' : '+'}{Math.abs(orthostatic.dropD)}</b> мм рт.ст.
                    {orthostatic.dropD >= 10 && <span style={{ color: '#ef4444' }}> — ортостатическая гипотензия!</span>}
                  </div>
                  {!(orthostatic.dropS >= 20 || orthostatic.dropD >= 10) && <div style={{ color: '#22c55e' }}>В норме</div>}
                </>
              ) : (
                <div>Нет парных измерений (сидя и стоя в одном дне). Добавьте измерение стоя для проверки.</div>
              )}
            </section>

            <section style={{ ...card, marginTop: 12 }}>
              <h3>🌙 Циркадный паттерн</h3>
              {(['morning', 'afternoon', 'evening', 'night'] as const).map(tod => {
                const g = circadian[tod];
                if (g.count === 0) return null;
                return (
                  <div key={tod} style={{ margin: '4px 0' }}>
                    {tod === 'morning' ? '🌅 Утро' : tod === 'afternoon' ? '☀️ День' : tod === 'evening' ? '🌆 Вечер' : '🌙 Ночь'}:{' '}
                    <b>{g.avgS}/{g.avgD}</b> ({g.count} изм.)
                  </div>
                );
              })}
              {circadian.isNonDipper && (
                <div style={{ color: '#f59e0b', marginTop: 6 }}>⚠ Non-dipper паттерн: ночное АД не снижается (риск поражения органов-мишеней)</div>
              )}
              {!circadian.isNonDipper && circadian.morning.avgS > 0 && (
                <div style={{ color: '#22c55e', marginTop: 6 }}>✓ Dipper паттерн: нормальное ночное снижение АД</div>
              )}
            </section>

            <section style={{ ...card, marginTop: 12 }}>
              <h3>📈 Тренд и прогноз</h3>
              <div>Систола: <b>{trendSystolic.trend === 'rising' ? '📈 рост' : trendSystolic.trend === 'falling' ? '📉 снижение' : '➡️ стабильно'}</b> ({trendSystolic.slope > 0 ? '+' : ''}{trendSystolic.slope.toFixed(1)} в день)</div>
              <div>Диастола: <b>{trendDiastolic.trend === 'rising' ? '📈 рост' : trendDiastolic.trend === 'falling' ? '📉 снижение' : '➡️ стабильно'}</b> ({trendDiastolic.slope > 0 ? '+' : ''}{trendDiastolic.slope.toFixed(1)} в день)</div>
              <div>R² (достоверность): систола {trendSystolic.r2.toFixed(2)}, диастола {trendDiastolic.r2.toFixed(2)}</div>
              {trendSystolic.r2 > 0.5 && (
                <div style={{ marginTop: 8, padding: 8, background: 'rgba(59,130,246,.1)', borderRadius: 6 }}>
                  <div>Прогноз через 7 дней: <b>{trendSystolic.prediction7d}/{trendDiastolic.prediction7d}</b></div>
                  <div>Прогноз через 14 дней: <b>{trendSystolic.prediction14d}/{trendDiastolic.prediction14d}</b></div>
                  {(trendSystolic.prediction14d >= 140 || trendDiastolic.prediction14d >= 90) && (
                    <div style={{ color: '#ef4444', marginTop: 4 }}>⚠ Прогноз: АД может достичь гипертензии через 2 недели</div>
                  )}
                </div>
              )}
            </section>

            <section style={{ ...card, marginTop: 12 }}>
              <h3>📋 Рекомендации на основе классификации</h3>
              <div>Текущая классификация: <b style={{ color: bpColor }}>{bpLabel}</b></div>
              <div>Рекомендованная цель: ≤{defaultGoals.systolicTarget}/{defaultGoals.diastolicTarget} мм рт.ст.</div>
              {bpClass === 'crisis' && (
                <div style={{ color: '#ef4444', marginTop: 6 }}>🚨 КРИЗИС: немедленно обратитесь к врачу!</div>
              )}
              {bpClass === 'stage2' && (
                <div style={{ color: '#ef4444', marginTop: 6 }}>⚠ Гипертензия 2 ст.: рекомендована консультация кардиолога и медикаментозная терапия.</div>
              )}
              {bpClass === 'stage1' && (
                <div style={{ color: '#f59e0b', marginTop: 6 }}>⚠ Гипертензия 1 ст.: рекомендованы изменения образа жизни + рассмотреть медикаменты.</div>
              )}
              {bpClass === 'elevated' && (
                <div style={{ color: '#f59e0b', marginTop: 6 }}>Повышенное АД: рекомендованы изменения образа жизни (соль &lt;5г, ДД, стресс).</div>
              )}
              {bpClass === 'normal' && (
                <div style={{ color: '#22c55e', marginTop: 6 }}>✓ АД в норме. Продолжайте в том же духе!</div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Latest entries footer */}
      {rows.length > 0 && (
        <section style={{ padding: '0 16px 16px', maxWidth: 1100, margin: 'auto' }}>
          <div style={{ ...card, background: '#18181b' }}>
            <h3 style={{ marginTop: 0 }}>Последние записи</h3>
            {rows.slice(0, 3).map(row => {
              const cls = classifyBP(row.systolic, row.diastolic);
              return (
                <div key={`latest-${row.date}`} style={{ padding: 8, borderBottom: '1px solid #29292f', borderLeft: `3px solid ${getBpClassificationColor(cls)}`, paddingLeft: 8 }}>
                  <b>{row.date}</b> · {row.systolic}/{row.diastolic} · {row.hr} уд/мин · MAP {calcMAP(row.systolic, row.diastolic)}
                  {row.position ? ` · ${row.position}` : ''}
                  {row.notes ? ` · ${row.notes}` : ''}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Add/Edit modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2100, background: '#000b', display: 'grid', placeItems: 'center', padding: 16 }}>
          <form onSubmit={e => { e.preventDefault(); save(); }}
            style={{ background: '#18181b', padding: 18, borderRadius: 12, width: 'min(560px,100%)' }}>
            <h3>{editing ? 'Редактирование АД' : 'Добавить запись АД'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
              {[
                ['Дата', 'date'],
                ['Систола', 'systolic'],
                ['Диастола', 'diastolic'],
                ['Пульс', 'pulse'],
              ].map(([label, key]) => (
                <label key={key}>
                  {label}
                  <input style={input} type={key === 'date' ? 'date' : 'number'}
                    value={draft[key as 'date' | 'systolic' | 'diastolic' | 'pulse']}
                    onChange={e => setDraft({ ...draft, [key]: e.target.value } as BPForm)} />
                </label>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
              <label>Положение
                <select style={input} value={draft.position as string} onChange={e => setDraft({ ...draft, position: e.target.value })}>
                  <option value="sitting">Сидя</option>
                  <option value="standing">Стоя</option>
                  <option value="lying">Лёжа</option>
                </select>
              </label>
              <label>Рука
                <select style={input} value={draft.arm as string} onChange={e => setDraft({ ...draft, arm: e.target.value })}>
                  <option value="left">Левая</option>
                  <option value="right">Правая</option>
                </select>
              </label>
              <label>Время
                <select style={input} value={draft.timeOfDay as string} onChange={e => setDraft({ ...draft, timeOfDay: e.target.value })}>
                  <option value="morning">Утро</option>
                  <option value="afternoon">День</option>
                  <option value="evening">Вечер</option>
                  <option value="night">Ночь</option>
                </select>
              </label>
            </div>
            <label style={{ display: 'block', marginTop: 8 }}>
              <input type="checkbox" checked={!!draft.medicationTaken} onChange={e => setDraft({ ...draft, medicationTaken: e.target.checked })} />{' '}
              Лекарство принято
            </label>
            <label style={{ display: 'block', marginTop: 8 }}>
              Симптомы (через запятую)
              <input style={input} value={draft.symptomsText || ''} onChange={e => setDraft({ ...draft, symptomsText: e.target.value })} />
            </label>
            <label style={{ display: 'block', marginTop: 8 }}>
              Заметки
              <textarea style={{ ...input, minHeight: 60 }} value={draft.notes || ''} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" style={btn} onClick={() => setModal(false)}>Отмена</button>
              <button type="submit" style={{ ...btn, background: '#ef4444' }}>{editing ? 'Сохранить' : 'Добавить'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
