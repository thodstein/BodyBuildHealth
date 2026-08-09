import React, { useEffect, useMemo, useRef, useState } from 'react';
import { colors } from '../../ui';
import { AddHealthModal } from '../../health-diary-modal';
import {
  addUnifiedHealthEntry,
  deleteUnifiedHealthEntry,
  getUnifiedAcneStats,
  getUnifiedHealthEntries,
  getUnifiedHematoStats,
  getUnifiedNeuroStats,
  getUnifiedPainStats,
  getUnifiedSymptomsStats,
  getUnifiedTodayStatus,
  saveUnifiedHealthEntries,
  updateUnifiedHealthEntry,
  type UnifiedHealthEntry,
} from '../../../../../engines/health-diary.engine';
import { analyzePainEntries } from '../../../../../engines/pain-insights.engine';
import { getSymptomDiaryStats, getSymptomDiarySummary } from '../../../../../engines/symptom-diary.engine';
import { computeHealthScore } from '../../../../../engines/health-score-v2.engine';
import {
  buildWeeklyHistogram,
  compareWithLastWeek,
  computeDistribution,
  computeExtremes,
  computeStreak,
  crossCorrelation,
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
import { PAIN_ZONES, NEURO_SYMPTOMS, ACNE_AREAS, HEMATO_SYMPTOMS, painZoneColor } from '../../diary-modals';
import type { DiaryWindowProps } from '../../DiaryWindow';

const button: React.CSSProperties = {
  minHeight: 40,
  padding: '7px 11px',
  borderRadius: 8,
  background: '#27272a',
  border: '1px solid #3f3f46',
  color: '#fff',
  cursor: 'pointer',
};
const card: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: 'rgba(255,255,255,.035)',
  border: '1px solid rgba(255,255,255,.09)',
};
const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 9px',
  borderRadius: 7,
  border: '1px solid #3f3f46',
  background: '#18181b',
  color: '#fff',
};

type Symptom = UnifiedHealthEntry['symptoms'][number];
type EntryDraft = Omit<UnifiedHealthEntry, 'id' | 'createdAt' | 'updatedAt'>;

const emptyDraft = (): EntryDraft => ({
  date: todayIso(),
  pain: null,
  symptoms: [],
  neuro: null,
  acne: null,
  hemato: null,
  notes: '',
});
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const score = (values: Record<string, number | boolean>): number =>
  Object.values(values).reduce<number>((n, v) => n + (typeof v === 'boolean' ? (v ? 1 : 0) : Number(v) || 0), 0);

function entryFields(entry: UnifiedHealthEntry): DiaryEntryLike {
  const pain = entry.pain?.totalScore || 0;
  const neuro = entry.neuro?.totalScore || 0;
  const acne = entry.acne?.totalScore || 0;
  const hemato = entry.hemato?.totalScore || 0;
  const fields = [
    { label: 'Боль', value: String(pain), unit: '/70' },
    { label: 'Нейро', value: String(neuro), unit: '/10' },
    { label: 'Акне', value: String(acne), unit: '/12' },
    { label: 'Гемат', value: String(hemato), unit: '/8' },
    { label: 'Симптомы', value: String(entry.symptoms.length), unit: 'шт.' },
  ];
  if (entry.pain?.timeOfDay) fields.push({ label: 'Время', value: entry.pain.timeOfDay, unit: '' });
  if (entry.pain?.painType) fields.push({ label: 'Тип', value: entry.pain.painType, unit: '' });
  if (entry.pain?.triggers && entry.pain.triggers.length > 0) fields.push({ label: 'Триггеры', value: String(entry.pain.triggers.length), unit: '' });
  if (entry.pain?.linkedExercise) fields.push({ label: 'Упр.', value: entry.pain.linkedExercise, unit: '' });
  if (entry.notes) fields.push({ label: 'Заметка', value: entry.notes, unit: '' });
  return { date: entry.date, fields };
}

function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

const FieldGroup: React.FC<{ title: string; color?: string; children: React.ReactNode }> = ({
  title,
  color = colors.primary,
  children,
}) => (
  <section style={{ ...card, marginBottom: 10, borderColor: `${color}55` }}>
    <h3 style={{ margin: '0 0 9px', fontSize: 13, color }}>{title}</h3>
    {children}
  </section>
);

const ToggleGrid: React.FC<{
  items: readonly { id: string; label: string }[];
  values: Record<string, boolean>;
  onChange: (id: string) => void;
  color: string;
}> = ({ items, values, onChange, color }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 5 }}>
    {items.map((item) => {
      const active = !!values[item.id];
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          style={{
            ...button,
            minHeight: 44,
            textAlign: 'left',
            borderColor: active ? color : '#3f3f46',
            background: active ? `${color}22` : '#18181b',
            color: active ? color : colors.text,
          }}
        >
          {active ? '✓ ' : ''}
          {item.label}
        </button>
      );
    })}
  </div>
);

const PainBodyMap: React.FC<{ zones: Record<string, number>; onChange?: (zones: Record<string, number>) => void }> = ({ zones, onChange }) => {
  const zonePositions: Record<string, { x: number; y: number; r: number; label: string }> = {
    shoulders: { x: 100, y: 45, r: 18, label: 'Плечи' },
    elbows: { x: 55, y: 95, r: 14, label: 'Локти' },
    wrists: { x: 35, y: 140, r: 12, label: 'Запястья' },
    lower_back: { x: 150, y: 90, r: 16, label: 'Поясница' },
    hips: { x: 150, y: 130, r: 16, label: 'ТБС' },
    knees: { x: 130, y: 180, r: 14, label: 'Колени' },
    ankles: { x: 130, y: 220, r: 12, label: 'Голеностоп' },
  };
  const handleZoneClick = (id: string) => {
    if (!onChange) return;
    const current = zones[id] || 0;
    const next = current >= 10 ? 0 : current + 1;
    onChange({ ...zones, [id]: next });
  };
  return (
    <svg viewBox="0 0 300 260" width="100%" height="260" style={{ maxWidth: 320, margin: '0 auto', display: 'block' }} role="img" aria-label="Карта зон боли">
      <ellipse cx="150" cy="30" rx="25" ry="30" fill="rgba(255,255,255,0.06)" stroke="#52525b" />
      <rect x="125" y="55" width="50" height="70" rx="10" fill="rgba(255,255,255,0.06)" stroke="#52525b" />
      <rect x="110" y="120" width="80" height="90" rx="12" fill="rgba(255,255,255,0.06)" stroke="#52525b" />
      <line x1="150" y1="55" x2="150" y2="210" stroke="#52525b" strokeDasharray="3 3" />
      <line x1="110" y1="90" x2="190" y2="90" stroke="#52525b" strokeDasharray="3 3" />
      {PAIN_ZONES.map((z) => {
        const pos = zonePositions[z.id];
        const v = zones[z.id] || 0;
        const c = painZoneColor(v);
        return (
          <g key={z.id} onClick={() => handleZoneClick(z.id)} style={{ cursor: onChange ? 'pointer' : 'default' }}>
            <circle cx={pos.x} cy={pos.y} r={pos.r} fill={v > 0 ? `${c}44` : 'rgba(255,255,255,0.03)'} stroke={v > 0 ? c : '#3f3f46'} strokeWidth={v > 0 ? 2 : 1} />
            <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" fill={v > 0 ? '#fff' : '#71717a'} fontSize="9" fontWeight={700}>{v}</text>
            <title>{pos.label}: {v}/10</title>
          </g>
        );
      })}
    </svg>
  );
};

const EntryEditor: React.FC<{
  entry?: UnifiedHealthEntry;
  onCancel: () => void;
  onSave: (draft: EntryDraft) => void;
}> = ({ entry, onCancel, onSave }) => {
  const [draft, setDraft] = useState<EntryDraft>(() =>
    entry
      ? clone({
          date: entry.date,
          pain: entry.pain,
          symptoms: entry.symptoms,
          neuro: entry.neuro,
          acne: entry.acne,
          hemato: entry.hemato,
          notes: entry.notes || '',
        })
      : emptyDraft(),
  );
  const [symptomName, setSymptomName] = useState('');
  const [symptomSeverity, setSymptomSeverity] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [symptomDuration, setSymptomDuration] = useState('');
  const painZones = draft.pain?.zones || {};
  const neuroValues = draft.neuro?.symptoms || {};
  const acneAreas = draft.acne?.areas || {};
  const hematoValues = draft.hemato?.symptoms || {};
  const setPain = (patch: Partial<NonNullable<EntryDraft['pain']>>) =>
    setDraft((d) => ({ ...d, pain: { zones: {}, totalScore: 0, ...(d.pain || {}), ...patch } }));
  const updateMap = (kind: 'neuro' | 'hemato', id: string) =>
    setDraft((d) => {
      const current = d[kind] || { symptoms: {}, totalScore: 0 };
      const values = { ...current.symptoms, [id]: !current.symptoms[id] };
      return { ...d, [kind]: { symptoms: values, totalScore: score(values) } };
    });
  const updateAcne = (id: string, value: number) =>
    setDraft((d) => {
      const values = { ...(d.acne?.areas || {}), [id]: value };
      return { ...d, acne: { areas: values, totalScore: score(values) } };
    });
  const addSymptom = () => {
    if (!symptomName.trim()) return;
    const s: Symptom = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: symptomName.trim(),
      severity: symptomSeverity,
      duration: symptomDuration.trim() || undefined,
    };
    setDraft((d) => ({ ...d, symptoms: [...d.symptoms, s] }));
    setSymptomName('');
    setSymptomDuration('');
    setSymptomSeverity(2);
  };
  const valid =
    !!draft.date &&
    (draft.symptoms.length > 0 ||
      !!draft.pain?.totalScore ||
      !!draft.neuro?.totalScore ||
      !!draft.acne?.totalScore ||
      !!draft.hemato?.totalScore ||
      !!draft.notes?.trim());
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2200,
        background: 'rgba(0,0,0,.78)',
        overflow: 'auto',
        padding: 14,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          maxWidth: 650,
          margin: '0 auto',
          background: '#1a1a1d',
          color: colors.text,
          borderRadius: 15,
          padding: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <b>{entry ? '✏️ Изменить запись здоровья' : '🩺 Запись здоровья'}</b>
          <button style={button} onClick={onCancel}>
            ✕
          </button>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, marginBottom: 10 }}>
          <label>
            Дата
            <input
              type="date"
              max={todayIso()}
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              style={input}
            />
          </label>
          <label>
            Заметка
            <input
              value={draft.notes || ''}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Триггеры, лечение, наблюдения"
              style={input}
            />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12, marginBottom: 10 }}>
          <FieldGroup title="🦴 Суставная боль: VAS 0–10 по каждой зоне" color="#22c55e">
            <div style={{ display: 'grid', gap: 6 }}>
              {PAIN_ZONES.map((z) => {
                const value = painZones[z.id] || 0;
                return (
                  <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 80, fontSize: 11 }}>{z.label}</span>
                    <input
                      aria-label={`${z.label}: VAS`}
                      type="range"
                      min="0"
                      max="10"
                      value={value}
                      onChange={(e) => {
                        const zones = { ...painZones, [z.id]: Number(e.target.value) };
                        setPain({ zones, totalScore: score(zones) });
                      }}
                      style={{ flex: 1 }}
                    />
                    <b style={{ color: painZoneColor(value), width: 25 }}>{value}</b>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 8, fontSize: 11 }}>Σ {score(painZones)}/70</div>
          </FieldGroup>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>Нажмите на зону</div>
            <PainBodyMap zones={painZones} onChange={(zones) => setPain({ zones, totalScore: score(zones) })} />
          </div>
        </div>
        {draft.pain && (
          <FieldGroup title="📋 Детали боли" color="#22c55e">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <input
                placeholder="Время (утро/день/вечер)"
                value={draft.pain.timeOfDay || ''}
                onChange={(e) => setPain({ timeOfDay: e.target.value || undefined })}
                style={input}
              />
              <input
                placeholder="Тип боли"
                value={draft.pain.painType || ''}
                onChange={(e) => setPain({ painType: e.target.value || undefined })}
                style={input}
              />
              <input
                placeholder="Триггеры через запятую"
                value={(draft.pain.triggers || []).join(', ')}
                onChange={(e) =>
                  setPain({
                    triggers: e.target.value
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
                style={input}
              />
              <input
                placeholder="Что облегчает через запятую"
                value={(draft.pain.relief || []).join(', ')}
                onChange={(e) =>
                  setPain({
                    relief: e.target.value
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
                style={input}
              />
              <input
                placeholder="Длительность"
                value={draft.pain.duration || ''}
                onChange={(e) => setPain({ duration: e.target.value || undefined })}
                style={input}
              />
              <input
                placeholder="Связанное упражнение"
                value={draft.pain.linkedExercise || ''}
                onChange={(e) => setPain({ linkedExercise: e.target.value || undefined })}
                style={input}
              />
            </div>
          </FieldGroup>
        )}
        <FieldGroup title="🩺 Симптомы" color="#ec4899">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px auto', gap: 5 }}>
            <input
              placeholder="Название симптома"
              value={symptomName}
              onChange={(e) => setSymptomName(e.target.value)}
              style={input}
            />
            <select
              value={symptomSeverity}
              onChange={(e) => setSymptomSeverity(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
              style={input}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}/5
                </option>
              ))}
            </select>
            <input
              placeholder="Длительность"
              value={symptomDuration}
              onChange={(e) => setSymptomDuration(e.target.value)}
              style={input}
            />
            <button style={button} onClick={addSymptom}>
              +
            </button>
          </div>
          {draft.symptoms.map((s) => (
            <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 11 }}>
              <span style={{ flex: 1 }}>{s.name}</span>
              <b>{s.severity}/5</b>
              <span>{s.duration || ''}</span>
              <button
                style={{ ...button, minHeight: 30, padding: '3px 8px', color: '#ef4444' }}
                onClick={() => setDraft((d) => ({ ...d, symptoms: d.symptoms.filter((x) => x.id !== s.id) }))}
              >
                ×
              </button>
            </div>
          ))}
        </FieldGroup>
        <FieldGroup title="🧠 Нейросимптомы" color="#ef4444">
          <ToggleGrid
            items={NEURO_SYMPTOMS}
            values={neuroValues}
            onChange={(id) => updateMap('neuro', id)}
            color="#ef4444"
          />
          <div style={{ marginTop: 7, fontSize: 11 }}>Отмечено: {score(neuroValues)}/10</div>
        </FieldGroup>
        <FieldGroup title="🔴 Акне по зонам" color="#f97316">
          <div style={{ display: 'grid', gap: 6 }}>
            {ACNE_AREAS.map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 80, fontSize: 11 }}>{a.label}</span>
                 {[0, 1, 2, 3].map((n) => (
                   <button
                     key={n}
                     style={{
                       ...button,
                       flex: 1,
                       minHeight: 44,
                       padding: '4px 0',
                       color: (acneAreas[a.id] || 0) === n ? '#f97316' : colors.textMuted,
                     }}
                     onClick={() => updateAcne(a.id, n)}
                   >
                     {n}
                   </button>
                 ))}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 7, fontSize: 11 }}>Σ {score(acneAreas)}/12</div>
        </FieldGroup>
        <FieldGroup title="🩸 Гематологические симптомы" color="#3b82f6">
          <ToggleGrid
            items={HEMATO_SYMPTOMS}
            values={hematoValues}
            onChange={(id) => updateMap('hemato', id)}
            color="#3b82f6"
          />
          <div style={{ marginTop: 7, fontSize: 11 }}>Отмечено: {score(hematoValues)}/8</div>
        </FieldGroup>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...button, flex: 1 }} onClick={onCancel}>
            Отмена
          </button>
          <button
            disabled={!valid}
            style={{
              ...button,
              flex: 1,
              background: valid ? colors.primary : '#3f3f46',
              color: valid ? '#07130d' : '#aaa',
            }}
            onClick={() => valid && onSave(draft)}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

export const HealthDiary: React.FC<DiaryWindowProps> = ({ open, onClose, onDataChange }) => {
  const [rows, setRows] = useState<UnifiedHealthEntry[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<UnifiedHealthEntry | null>(null);
  const [range, setRange] = useState<'all' | '7' | '30' | '90'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [undo, setUndo] = useState<UnifiedHealthEntry[] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (open) setRows(getUnifiedHealthEntries());
  }, [open]);
  const commit = (next: UnifiedHealthEntry[], remember = true) => {
    const ordered = [...next].sort((a, b) => b.date.localeCompare(a.date));
    if (remember) setUndo(clone(rows));
    saveUnifiedHealthEntries(ordered);
    setRows(ordered);
    onDataChange?.();
  };
  const saveNew = (entry: UnifiedHealthEntry) => {
    commit(addUnifiedHealthEntry(entry as EntryDraft), false);
    setAddOpen(false);
  };
  const saveEdit = (draft: EntryDraft) => {
    const result = updateUnifiedHealthEntry(edit!.date, (current) =>
      Object.assign(current, clone(draft), {
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      }),
    );
    commit(result);
    setEdit(null);
  };
  const fields = useMemo(() => rows.map(entryFields), [rows]);
  const visible = useMemo(() => {
    let result = filterByRange(fields, range);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (e) => e.date.includes(q) || e.fields.some((f) => `${f.label} ${f.value}`.toLowerCase().includes(q)),
      );
    }
    return sortEntries(result, sort);
  }, [fields, range, query, sort]);
  const pageData = paginate(visible, page, 8);
  const points = useMemo(
    () => visible.map((e) => ({ date: e.date, value: Number(e.fields[0]?.value) || 0 })).reverse(),
    [visible],
  );
  const visibleDateSet = useMemo(() => new Set(visible.map((v) => v.date)), [visible]);
  const allPoints = useMemo(
    () =>
      rows
        .filter((e) => visibleDateSet.has(e.date))
        .map((e) => ({ date: e.date, value: e.pain?.totalScore || 0 }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [rows, visibleDateSet],
  );
  const distribution = computeDistribution(allPoints.map((x) => x.value));
  const painRows = rows.filter((e) => e.pain).map((e) => ({ ...e.pain!, date: e.date }));
  const painInsights = analyzePainEntries(painRows);
  const symptomStats = getUnifiedSymptomsStats(rows);
  const symptomEngine = getSymptomDiaryStats();
  const symptomSummary = getSymptomDiarySummary(30);
  const stats = {
    pain: getUnifiedPainStats(rows),
    neuro: getUnifiedNeuroStats(rows),
    acne: getUnifiedAcneStats(rows),
    hemato: getUnifiedHematoStats(rows),
  };
  const status = getUnifiedTodayStatus(rows);
  const weekly = buildWeeklyHistogram(allPoints);
  const compare = compareWithLastWeek(allPoints);
  const anomalies = detectAnomalies('pain', fields);
  const extremes = computeExtremes('pain', fields);
  const streak = computeStreak(fields);
  const normal = getNormalRange('pain');
  const line = allPoints
    .map((p, i) => `${20 + (i * 560) / Math.max(1, allPoints.length - 1)},${180 - Math.min(160, p.value * 2.25)}`)
    .join(' ');
  const exportCsv = () => {
    const header = ['Дата', 'Боль', 'Нейро', 'Акне', 'Гемат', 'Симптомы', 'Заметка'];
    const body = rows.map((e) =>
      [
        e.date,
        e.pain?.totalScore || 0,
        e.neuro?.totalScore || 0,
        e.acne?.totalScore || 0,
        e.hemato?.totalScore || 0,
        e.symptoms.length,
        e.notes || '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    downloadText(`health-${todayIso()}.csv`, `\ufeff${header.join(',')}\n${body.join('\n')}`, 'text/csv;charset=utf-8');
  };
  const printPdf = () => {
    const escape = (s: string) =>
      s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Дневник здоровья</title><style>body{font:12px Arial;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:5px;text-align:left}th{background:#eee}@media print{button{display:none}}</style></head><body><h1>Дневник здоровья</h1><p>Сформирован ${new Date().toLocaleString('ru-RU')}</p><table><tr><th>Дата</th><th>Боль</th><th>Нейро</th><th>Акне</th><th>Гемат</th><th>Симптомы</th><th>Заметка</th></tr>${rows.map((e) => `<tr><td>${escape(e.date)}</td><td>${e.pain?.totalScore || 0}/70</td><td>${e.neuro?.totalScore || 0}/10</td><td>${e.acne?.totalScore || 0}/12</td><td>${e.hemato?.totalScore || 0}/8</td><td>${e.symptoms.length}</td><td>${escape(e.notes || '')}</td></tr>`).join('')}</table></body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };
  const correlation = crossCorrelation(
    allPoints,
    rows.map((e) => ({ date: e.date, value: e.symptoms.reduce((s, x) => s + x.severity, 0) })),
  );
  const healthLagCorrelation = laggedCorrelation(
    allPoints,
    rows.map((e) => ({ date: e.date, value: e.symptoms.reduce((s, x) => s + x.severity, 0) })),
    1,
  );
  const recent30 = rows.slice(0, 30);
  const avgPain30 = recent30.length ? recent30.reduce((s, e) => s + (e.pain?.totalScore || 0), 0) / recent30.length : 0;
  const avgNeuro30 = recent30.filter((e) => e.neuro).length ? recent30.filter((e) => e.neuro).reduce((s, e) => s + e.neuro!.totalScore, 0) / recent30.filter((e) => e.neuro).length : 0;
  const avgAcne30 = recent30.filter((e) => e.acne).length ? recent30.filter((e) => e.acne).reduce((s, e) => s + e.acne!.totalScore, 0) / recent30.filter((e) => e.acne).length : 0;
  const avgHemato30 = recent30.filter((e) => e.hemato).length ? recent30.filter((e) => e.hemato).reduce((s, e) => s + e.hemato!.totalScore, 0) / recent30.filter((e) => e.hemato).length : 0;
  const healthScore = computeHealthScore({
    pharmaRisk: 50,
    weeksSinceLab: 4,
    nutritionAdherence: 70,
    trainingConsistency: 70,
    sleepScore: 70,
    hrvScore: 70,
    weightTrend: 0,
    subjectiveEnergy: 3,
    subjectiveStress: 5,
  });
  const diaryScore = Math.round(Math.max(0, 100 - (avgPain30 / 70) * 100 - (avgNeuro30 / 10) * 20 - (avgAcne30 / 12) * 15 - (avgHemato30 / 8) * 15));
  if (!open) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, height: '100dvh', maxHeight: '100dvh', background: '#09090b', color: colors.text, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          display: 'flex',
          gap: 7,
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: 12,
          background: '#18181b',
          borderBottom: '1px solid #27272a',
        }}
      >
        <button style={button} onClick={onClose}>
          ← Дневники
        </button>
        <b style={{ fontSize: 16 }}>🩺 Единый дневник здоровья</b>
        <div style={{
          marginLeft: 'auto',
          padding: '4px 10px',
          borderRadius: 8,
          background: `${healthScore.breakdown.recovery.score > 60 ? colors.greenDim : colors.warningDim}`,
          border: `1px solid ${healthScore.breakdown.recovery.score > 60 ? colors.green : colors.warning}`,
          color: healthScore.breakdown.recovery.score > 60 ? colors.green : colors.warning,
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }} title={`Индекс здоровья: ${diaryScore}/100`}>
          💚 {diaryScore}
        </div>
        <button style={{ ...button, background: colors.primary, color: '#07130d' }} onClick={() => setAddOpen(true)}>
          + Добавить
        </button>
        <button style={button} onClick={() => setAddOpen(true)}>
          ⚡ Сегодня
        </button>
        <button style={button} onClick={exportCsv}>
          CSV
        </button>
        <button style={button} onClick={printPdf}>
          PDF/Печать
        </button>
        <button
          style={button}
          onClick={() => svgRef.current && exportSvgAsFile(svgRef.current, `health-${todayIso()}.svg`)}
        >
          SVG
        </button>
        <button
          style={button}
          onClick={() => svgRef.current && exportSvgAsPng(svgRef.current, `health-${todayIso()}.png`)}
        >
          PNG
        </button>
        <button
          style={button}
          onClick={() => {
            if (confirm('Очистить единый дневник здоровья?')) commit([]);
          }}
        >
          Очистить
        </button>
        {undo && (
          <button
            style={button}
            onClick={() => {
              commit(undo, false);
              setUndo(null);
            }}
          >
            ↩ Отменить
          </button>
        )}
      </header>
      <main style={{ maxWidth: 1150, margin: 'auto', padding: 14 }}>
        {status && (
          <div role="status" style={{ ...card, marginBottom: 10, color: status.color, borderColor: status.color }}>
            ⚠ {status.message}
          </div>
        )}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(105px,1fr))',
            gap: 7,
            marginBottom: 12,
          }}
        >
          {[
            ['Записей', rows.length, '#60a5fa'],
            ['Боль', stats.pain ? `${stats.pain.avg}/70` : '—', '#22c55e'],
            ['Нейро', stats.neuro ? `${stats.neuro.avg}/10` : '—', '#ef4444'],
            ['Акне', stats.acne ? `${stats.acne.avg}/12` : '—', '#f97316'],
            ['Гемат', stats.hemato ? `${stats.hemato.avg}/8` : '—', '#3b82f6'],
            ['Симптомы', symptomStats?.total || 0, '#ec4899'],
            ['Серия', streak.current, '#f59e0b'],
          ].map(([label, value, color]) => (
            <div key={String(label)} style={{ ...card, borderColor: `${color}55` }}>
              <small style={{ color: colors.textMuted }}>{label}</small>
              <strong style={{ display: 'block', color: String(color), fontSize: 18 }}>{value}</strong>
            </div>
          ))}
        </section>
        <section style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <b>🗺 Карта зон боли</b>
            <span style={{ color: colors.textMuted, fontSize: 11 }}>Последняя запись</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <PainBodyMap zones={rows[0]?.pain?.zones || {}} />
          </div>
        </section>
        <section style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <b>📈 Боль по датам</b>
            <span style={{ color: colors.textMuted, fontSize: 11 }}>Норма ≤ {normal?.high}/70</span>
          </div>
          <svg
            ref={svgRef}
            viewBox="0 0 600 230"
            width="100%"
            height="210"
            role="img"
            aria-label="График суставной боли"
          >
            <line x1="40" y1="190" x2="580" y2="190" stroke="#52525b" />
            <line x1="40" y1="30" x2="40" y2="190" stroke="#52525b" />
            {[0, 10, 20, 30, 40, 50, 60, 70].map((value) => (
              <g key={value}>
                <line x1="40" y1={190 - value * 2.25} x2="580" y2={190 - value * 2.25} stroke="#ffffff12" />
                <text x="34" y={194 - value * 2.25} textAnchor="end" fill="#71717a" fontSize="8">
                  {value}
                </text>
              </g>
            ))}
            <rect
              x="40"
              y={190 - (normal?.high || 20) * 2.25}
              width="540"
              height={((normal?.high || 20) - (normal?.low || 0)) * 2.25}
              fill="#22c55e12"
            />
            <line
              x1="40"
              y1={190 - (normal?.high || 20) * 2.25}
              x2="580"
              y2={190 - (normal?.high || 20) * 2.25}
              stroke="#22c55e"
              strokeDasharray="5 4"
            />
            <polyline points={line} fill="none" stroke="#22c55e" strokeWidth="3" />
            {allPoints.map((p, i) => (
              <circle
                key={`${p.date}-${i}`}
                cx={40 + (i * 540) / Math.max(1, allPoints.length - 1)}
                cy={190 - Math.min(160, p.value * 2.25)}
                r="3"
                fill="#22c55e"
              >
                <title>
                  {p.date}: {p.value}/70
                </title>
              </circle>
            ))}
          </svg>
        </section>
        {(() => {
          const renderMiniChart = (title: string, color: string, maxVal: number, points: { date: string; value: number }[], normalHigh?: number) => {
            const visiblePoints = points.filter((p) => visibleDateSet.has(p.date));
            if (visiblePoints.length === 0) return null;
            const sorted = visiblePoints.sort((a, b) => a.date.localeCompare(b.date));
            const line = sorted.map((p, i) => `${20 + (i * 560) / Math.max(1, sorted.length - 1)},${190 - Math.min(160, p.value * (180 / maxVal))}`).join(' ');
            return (
              <section key={title} style={{ ...card, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <b>{title}</b>
                  <span style={{ color: colors.textMuted, fontSize: 11 }}>Норма ≤ {normalHigh ?? maxVal}/{maxVal}</span>
                </div>
                <svg viewBox="0 0 600 230" width="100%" height="210" role="img" aria-label={title}>
                  <line x1="40" y1="190" x2="580" y2="190" stroke="#52525b" />
                  <line x1="40" y1="30" x2="40" y2="190" stroke="#52525b" />
                  {Array.from({ length: 5 }, (_, i) => {
                    const v = Math.round((maxVal / 4) * i);
                    return (
                      <g key={v}>
                        <line x1="40" y1={190 - v * (180 / maxVal)} x2="580" y2={190 - v * (180 / maxVal)} stroke="#ffffff12" />
                        <text x="34" y={194 - v * (180 / maxVal)} textAnchor="end" fill="#71717a" fontSize="8">{v}</text>
                      </g>
                    );
                  })}
                  {normalHigh !== undefined && (
                    <>
                      <rect x="40" y={190 - normalHigh * (180 / maxVal)} width="540" height={normalHigh * (180 / maxVal)} fill={`${color}12`} />
                      <line x1="40" y1={190 - normalHigh * (180 / maxVal)} x2="580" y2={190 - normalHigh * (180 / maxVal)} stroke={color} strokeDasharray="5 4" />
                    </>
                  )}
                  <polyline points={line} fill="none" stroke={color} strokeWidth="3" />
                  {sorted.map((p, i) => (
                    <circle key={`${p.date}-${i}`} cx={40 + (i * 540) / Math.max(1, sorted.length - 1)} cy={190 - Math.min(160, p.value * (180 / maxVal))} r="3" fill={color}>
                      <title>{p.date}: {p.value}/{maxVal}</title>
                    </circle>
                  ))}
                </svg>
              </section>
            );
          };
          const neuroPoints = rows.filter((e) => e.neuro && e.neuro.totalScore > 0).map((e) => ({ date: e.date, value: e.neuro!.totalScore }));
          const acnePoints = rows.filter((e) => e.acne && e.acne.totalScore > 0).map((e) => ({ date: e.date, value: e.acne!.totalScore }));
          const hematoPoints = rows.filter((e) => e.hemato && e.hemato.totalScore > 0).map((e) => ({ date: e.date, value: e.hemato!.totalScore }));
          return (
            <>
              {renderMiniChart('🧠 Нейросимптомы', '#ef4444', 10, neuroPoints, 4)}
              {renderMiniChart('🔴 Акне', '#f97316', 12, acnePoints, 7)}
              {renderMiniChart('🩸 Гематология', '#3b82f6', 8, hematoPoints, 2)}
            </>
          );
        })()}
        {(correlation || healthLagCorrelation) && (
          <section style={{ ...card, marginBottom: 12 }}>
            <b>🔗 Связь боли и симптомов</b>
            <div>
              Тот же день: {correlation ? `r=${correlation.r.toFixed(2)} · n=${correlation.n}` : 'нет данных'} · Лаг 1
              день:{' '}
              {healthLagCorrelation
                ? `r=${healthLagCorrelation.r.toFixed(2)} · n=${healthLagCorrelation.n}`
                : 'нет данных'}
            </div>
          </section>
        )}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div style={card}>
            <b>📊 Распределение</b>
            {distribution ? (
              <div style={{ marginTop: 7, fontSize: 12 }}>
                Среднее {distribution.mean.toFixed(1)} · медиана {distribution.median.toFixed(1)}
                <br />
                SD {distribution.stdDev.toFixed(1)} · P25/P75 {distribution.p25.toFixed(1)}/
                {distribution.p75.toFixed(1)}
                <br />
                Мин/макс {distribution.min.toFixed(0)}/{distribution.max.toFixed(0)}
              </div>
            ) : (
              <p style={{ color: colors.textMuted }}>Нужно минимум 2 записи</p>
            )}
          </div>
          <div style={card}>
            <b>📆 Сравнение недели</b>
            <div style={{ marginTop: 7, fontSize: 12 }}>
              {compare.thisWeek && compare.lastWeek
                ? `Эта ${compare.thisWeek.mean.toFixed(1)} · прошлая ${compare.lastWeek.mean.toFixed(1)} · Δ ${compare.delta?.toFixed(1)}`
                : 'Недостаточно данных'}
            </div>
          </div>
          <div style={card}>
            <b>🔗 Корреляция боли и симптомов</b>
            <div style={{ marginTop: 7, fontSize: 12 }}>
              {correlation
                ? `r=${correlation.r.toFixed(2)} · n=${correlation.n} · ${correlation.strength}`
                : 'Нужно минимум 3 совпадающие даты'}
            </div>
          </div>
        </section>
        {weekly.length > 0 && (
          <section style={{ ...card, marginBottom: 12 }}>
            <b>📅 Недели</b>
            <div style={{ display: 'flex', gap: 5, alignItems: 'end', height: 100, marginTop: 8 }}>
              {weekly.map((w) => (
                <div
                  key={w.weekStart}
                  title={`${w.weekStart}: ${w.mean.toFixed(1)}`}
                  style={{ flex: 1, textAlign: 'center', fontSize: 9 }}
                >
                  <div
                    style={{
                      height: Math.max(8, Math.min(75, w.mean * 2)),
                      background: '#22c55e99',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                  <span>{w.weekStart.slice(5)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        <section style={{ ...card, marginBottom: 12 }}>
          <b>💡 Инсайты и аномалии</b>
          {[
            ...painInsights.insights.map((x) => `${x.title}: ${x.description}`),
            ...symptomSummary.slice(0, 5).map((x) => `${x.symptomName}: ${x.currentSeverity}/10 (${x.trend})`),
            ...anomalies.map((x) => x.message),
          ]
            .slice(0, 12)
            .map((x, i) => (
              <div
                key={i}
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: i < painInsights.insights.length ? '#f59e0b' : colors.textMuted,
                }}
              >
                • {x}
              </div>
            ))}
          {!painInsights.insights.length && !symptomSummary.length && !anomalies.length && (
            <p style={{ color: '#22c55e' }}>Предупреждений нет</p>
          )}
        </section>
        <section style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['all', '7', '30', '90'] as const).map((r) => (
              <button
                key={r}
                style={{ ...button, borderColor: range === r ? colors.primary : '#3f3f46' }}
                onClick={() => {
                  setRange(r);
                  setPage(1);
                }}
              >
                {r === 'all' ? 'Всё время' : `${r} дней`}
              </button>
            ))}
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Поиск по дате/показателю"
              style={{ ...input, flex: 1, minWidth: 180 }}
            />
            <button style={button} onClick={() => setSort({ key: 'date', dir: sort.dir === 'asc' ? 'desc' : 'asc' })}>
              ↕ Дата
            </button>
          </div>
        </section>
        <section style={{ ...card, overflowX: 'auto' }}>
          <h3 style={{ marginTop: 0 }}>Последние записи ({pageData.total})</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Дата', 'Боль', 'Нейро', 'Акне', 'Гемат', 'Симптомы', 'Время', 'Тип', 'Триггеры', 'Упр.', 'Заметка', 'Действия'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: 7, borderBottom: '1px solid #52525b' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.pageItems.map((e) => {
                const row = rows.find((r) => r.date === e.date);
                if (!row) return null;
                return (
                  <tr key={row.id}>
                    <td style={{ padding: 7 }}>{row.date}</td>
                    <td>{row.pain?.totalScore || 0}/70</td>
                    <td>{row.neuro?.totalScore || 0}/10</td>
                    <td>{row.acne?.totalScore || 0}/12</td>
                    <td>{row.hemato?.totalScore || 0}/8</td>
                    <td>{row.symptoms.length}</td>
                    <td>{row.pain?.timeOfDay || ''}</td>
                    <td>{row.pain?.painType || ''}</td>
                    <td>{(row.pain?.triggers || []).join(', ')}</td>
                    <td>{row.pain?.linkedExercise || ''}</td>
                    <td>{row.notes ? (row.notes.length > 20 ? row.notes.slice(0, 20) + '…' : row.notes) : ''}</td>
                    <td>
                      <button style={{ ...button, minHeight: 32, padding: '3px 7px' }} onClick={() => setEdit(row)}>
                        ✏️
                      </button>{' '}
                      <button
                        style={{ ...button, minHeight: 32, padding: '3px 7px', color: '#ef4444' }}
                        onClick={() => {
                          if (confirm(`Удалить запись ${row.date}?`)) commit(deleteUnifiedHealthEntry(row.date));
                        }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 9,
              fontSize: 11,
            }}
          >
            <span>
              {pageData.total ? `${pageData.pageStart + 1}–${pageData.pageEnd} из ${pageData.total}` : 'Нет записей'}
            </span>
            <span>
              <button style={button} onClick={() => setPage(Math.max(1, page - 1))}>
                ‹
              </button>{' '}
              {page}/{pageData.totalPages}{' '}
              <button style={button} onClick={() => setPage(Math.min(pageData.totalPages, page + 1))}>
                ›
              </button>
            </span>
          </div>
        </section>
        {rows.length > 0 && (
          <section style={{ ...card, marginTop: 12 }}>
            <b>🕘 Последние записи</b>
            {rows.slice(0, 3).map((row) => (
              <div key={`latest-${row.id}`} style={{ marginTop: 7, fontSize: 12, color: colors.textMuted }}>
                {row.date}: боль {row.pain?.totalScore || 0}/70 · симптомов {row.symptoms.length} · нейро{' '}
                {row.neuro?.totalScore || 0}/10
              </div>
            ))}
          </section>
        )}
      </main>
      {addOpen && <AddHealthModal open onClose={() => setAddOpen(false)} onSave={saveNew} />}
      {edit && <EntryEditor entry={edit} onCancel={() => setEdit(null)} onSave={saveEdit} />}
    </div>
  );
};
