import React, { useMemo, useRef, useState } from 'react';
import { colors } from '../../ui';
import {
  analyzeAllSleepCorrelations,
  generateCorrelationRecommendations,
  type SleepEntry,
} from '../../../../../engines/sleep-correlation.engine';
import {
  analyzePEDImpactOnSleep,
  generateSleepHygieneNotifications,
  generateSleepReport,
  getSupplementIntakeFromStorage,
  getTrainingDatesFromStorage,
} from '../../../../../engines/sleep-integration.engine';
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

const KEY = 'he_sleep_diary';
const GOALS_KEY = 'he_sleep_goals';
type RichSleepEntry = SleepEntry & {
  latency?: number;
  caffeineCutoff?: string;
  alcohol?: boolean;
  screenTime?: number;
  stressLevel?: number;
  exerciseTiming?: string;
};
type SleepGoals = {
  targetHours: number;
  targetQuality: number;
  targetLatency: number;
  targetAwakenings: number;
  maxStressLevel: number;
  alcoholDaysPerWeek: number;
};
const defaultGoals: SleepGoals = {
  targetHours: 8,
  targetQuality: 4,
  targetLatency: 20,
  targetAwakenings: 1,
  maxStressLevel: 5,
  alcoholDaysPerWeek: 2,
};
const button: React.CSSProperties = {
  minHeight: 38,
  padding: '7px 11px',
  borderRadius: 8,
  border: '1px solid #3f3f46',
  background: '#27272a',
  color: '#fff',
  cursor: 'pointer',
};
const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 38,
  padding: '8px 10px',
  borderRadius: 7,
  border: '1px solid #3f3f46',
  background: '#18181b',
  color: '#fff',
};
const card: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: 'rgba(167,139,250,.12)',
  border: '1px solid rgba(167,139,250,.2)',
};
const read = <T,>(key: string, fallback: T): T => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (entries: RichSleepEntry[]) =>
  localStorage.setItem(KEY, JSON.stringify([...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 365)));
const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c,
  );
const fieldsOf = (e: RichSleepEntry): DiaryEntryLike => ({
  date: e.date,
  fields: [
    ['Часы', e.hours, 'ч'],
    ['Качество', e.quality, '/5'],
    ['Пробуждений', e.awakenings, 'раз'],
    ['Легли', e.bedtime, ''],
    ['Подъём', e.wakeTime, ''],
    ['Латентность', e.latency ?? '', 'мин'],
    ['Кофеин до', e.caffeineCutoff || '', ''],
    ['Алкоголь', e.alcohol ? 'да' : 'нет', ''],
    ['Экран', e.screenTime ?? '', 'мин'],
    ['Стресс', e.stressLevel ?? '', '/10'],
    ['Тренировка', e.exerciseTiming || '', ''],
    ['Заметка', e.notes || '', ''],
  ].map(([label, value, unit]) => ({ label: String(label), value: String(value), unit: String(unit) })),
});

const blankEntry = (source?: Partial<RichSleepEntry>): RichSleepEntry => ({
  date: todayIso(),
  hours: 7.5,
  quality: 4,
  awakenings: 1,
  bedtime: '23:00',
  wakeTime: '07:00',
  notes: '',
  latency: 20,
  caffeineCutoff: '14:00',
  alcohol: false,
  screenTime: 30,
  stressLevel: 5,
  exerciseTiming: '',
  ...source,
});

const SleepForm: React.FC<{ value: RichSleepEntry; onCancel: () => void; onSave: (entry: RichSleepEntry) => void }> = ({
  value,
  onCancel,
  onSave,
}) => {
  const [draft, setDraft] = useState(value);
  const set = (key: keyof RichSleepEntry, val: string | number | boolean) =>
    setDraft((prev) => ({ ...prev, [key]: val }));
  const submit = () => {
    if (
      !draft.date ||
      !Number.isFinite(Number(draft.hours)) ||
      draft.hours < 0 ||
      draft.hours > 24 ||
      draft.quality < 1 ||
      draft.quality > 5
    )
      return;
    onSave({
      ...draft,
      hours: Number(draft.hours),
      quality: Number(draft.quality),
      awakenings: Math.max(0, Number(draft.awakenings) || 0),
      latency: Math.max(0, Number(draft.latency) || 0),
      screenTime: Math.max(0, Number(draft.screenTime) || 0),
      stressLevel: Math.min(10, Math.max(1, Number(draft.stressLevel) || 5)),
      notes: draft.notes?.trim() || '',
    });
  };
  const field = (label: string, key: keyof RichSleepEntry, type = 'number', extra: Record<string, string> = {}) => (
    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: '#a1a1aa' }}>
      {label}
      <input
        style={input}
        type={type}
        value={String(draft[key] ?? '')}
        onChange={(e) => set(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        {...extra}
      />
    </label>
  );
  return (
    <section style={{ ...card, margin: '12px 0' }}>
      <h3 style={{ marginTop: 0 }}>{value.date ? 'Запись сна' : 'Новая запись'}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 8 }}>
        {field('Дата', 'date', 'date')}
        {field('Часы сна', 'hours', 'number', { min: '0', max: '24', step: '0.5' })}
        {field('Качество (1–5)', 'quality', 'number', { min: '1', max: '5' })}
        {field('Пробуждений', 'awakenings', 'number', { min: '0' })}
        {field('Легли', 'bedtime', 'time')}
        {field('Подъём', 'wakeTime', 'time')}
        {field('Засыпание, мин', 'latency', 'number', { min: '0', max: '120' })}
        {field('Кофеин до', 'caffeineCutoff', 'time')}
        {field('Экран перед сном, мин', 'screenTime', 'number', { min: '0' })}
        {field('Стресс (1–10)', 'stressLevel', 'number', { min: '1', max: '10' })}
        {field('Время тренировки', 'exerciseTiming', 'text')}
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a1a1aa', fontSize: 11, paddingTop: 20 }}
        >
          <input type="checkbox" checked={!!draft.alcohol} onChange={(e) => set('alcohol', e.target.checked)} />{' '}
          Алкоголь
        </label>
      </div>
      <label style={{ display: 'grid', gap: 4, marginTop: 8, fontSize: 11, color: '#a1a1aa' }}>
        Заметки
        <textarea
          style={{ ...input, minHeight: 70 }}
          value={draft.notes || ''}
          onChange={(e) => set('notes', e.target.value)}
        />
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button style={{ ...button, background: colors.primary, color: '#000' }} onClick={submit}>
          Сохранить
        </button>
        <button style={button} onClick={onCancel}>
          Отмена
        </button>
      </div>
    </section>
  );
};

export const SleepDiary: React.FC<DiaryWindowProps> = ({ open, onClose, goals: profileGoals, onDataChange }) => {
  const [rows, setRows] = useState<RichSleepEntry[]>(() => read(KEY, []).map(blankEntry));
  const [goals, setGoals] = useState<SleepGoals>(() => ({
    ...defaultGoals,
    targetHours: profileGoals.sleepHours || defaultGoals.targetHours,
    ...read(GOALS_KEY, {}),
  }));
  const [form, setForm] = useState<RichSleepEntry | null>(null);
  const [undo, setUndo] = useState<RichSleepEntry[] | null>(null);
  const [range, setRange] = useState<'all' | '7' | '30' | '90'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [showGoals, setShowGoals] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const commit = (next: RichSleepEntry[], remember = true) => {
    if (remember) setUndo(rows);
    save(next);
    setRows([...next].sort((a, b) => b.date.localeCompare(a.date)));
    onDataChange?.();
  };
  const add = (entry: RichSleepEntry) => {
    commit([entry, ...rows.filter((r) => r.date !== entry.date)]);
    setForm(null);
  };
  const entries = useMemo(() => rows.map(fieldsOf), [rows]);
  const active = useMemo(() => {
    let result = filterByRange(entries, range);
    const q = query.trim().toLowerCase();
    if (q) result = result.filter((e) => e.date.includes(q) || e.fields.some((f) => f.value.toLowerCase().includes(q)));
    return sortEntries(result, sort);
  }, [entries, range, query, sort]);
  const pageData = paginate(active, page, 8);
  const points = rows
    .filter((r) => active.some((e) => e.date === r.date))
    .map((r) => ({ date: r.date, value: r.hours }));
  const dist = computeDistribution(points.map((p) => p.value));
  const extremes = computeExtremes('sleep', active);
  const streak = computeStreak(entries);
  const anomalies = detectAnomalies('sleep', active);
  const weeks = buildWeeklyHistogram(points);
  const comparison = compareWithLastWeek(points);
  const normal = getNormalRange('sleep');
  const diaryCorrelations = useMemo(() => {
    const readPoints = (key: string, valueKey: string) => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(raw)
          ? raw
              .map((entry) => ({ date: String(entry.date || ''), value: Number(entry[valueKey]) }))
              .filter((p) => p.date && Number.isFinite(p.value))
          : [];
      } catch {
        return [];
      }
    };
    const candidates = [
      ['Вес', readPoints('he_weight_log', 'weight')],
      ['Систолическое АД', readPoints('he_bp_diary', 'systolic')],
      ['Боль', readPoints('he_health_diary', 'totalScore')],
    ] as const;
    return candidates
      .flatMap(([label, data]) => {
        const same = crossCorrelation(points, data);
        const lagged = laggedCorrelation(points, data, 1);
        return [same && { label, ...same, lag: 0 }, lagged && { label, ...lagged, lag: 1 }].filter(Boolean) as Array<{
          label: string;
          r: number;
          n: number;
          strength: string;
          lag: number;
        }>;
      })
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, 6);
  }, [points]);
  const recent = rows.slice(0, 7);
  const debt = recent.reduce((n, r) => n + Math.max(0, goals.targetHours - r.hours), 0);
  const avgQuality = recent.length ? recent.reduce((n, r) => n + r.quality, 0) / recent.length : 0;
  const avgLatency =
    recent.filter((r) => Number.isFinite(r.latency)).reduce((n, r) => n + (r.latency || 0), 0) /
    Math.max(1, recent.filter((r) => Number.isFinite(r.latency)).length);
  const goalScore = recent.length
    ? Math.round(
        ([
          recent.reduce((n, r) => n + Math.min(1, r.hours / goals.targetHours), 0) / recent.length,
          avgQuality / goals.targetQuality,
          goals.targetLatency / Math.max(1, avgLatency),
          goals.targetAwakenings / Math.max(0.1, recent.reduce((n, r) => n + r.awakenings, 0) / recent.length),
        ]
          .map((v) => Math.min(1, v))
          .reduce((n, v) => n + v, 0) /
          4) *
          100,
      )
    : 0;
  const correlations = analyzeAllSleepCorrelations({
    sleepDiary: rows,
    trainingDates: getTrainingDatesFromStorage(90),
    supplementIntake: getSupplementIntakeFromStorage(90),
  });
  const recommendations = generateCorrelationRecommendations(correlations);
  const hygiene = generateSleepHygieneNotifications(rows);
  const ped = analyzePEDImpactOnSleep(rows, getSupplementIntakeFromStorage(90));
  const exportCsv = () => {
    const headers = [
      'Дата',
      'Часы',
      'Качество',
      'Пробуждений',
      'Легли',
      'Подъём',
      'Латентность',
      'Кофеин',
      'Алкоголь',
      'Экран',
      'Стресс',
      'Тренировка',
      'Заметки',
    ];
    const csv = [
      headers,
      ...rows.map((r) => [
        r.date,
        r.hours,
        r.quality,
        r.awakenings,
        r.bedtime,
        r.wakeTime,
        r.latency ?? '',
        r.caffeineCutoff || '',
        r.alcohol ? 'да' : 'нет',
        r.screenTime ?? '',
        r.stressLevel ?? '',
        r.exerciseTiming || '',
        r.notes || '',
      ]),
    ]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `sleep-${todayIso()}.csv`;
    a.click();
  };
  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const report = generateSleepReport(rows, { targetHours: goals.targetHours, targetQuality: goals.targetQuality });
    w.document.write(
      `<html><head><title>Дневник сна</title><style>body{font-family:Arial;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:5px;text-align:left}</style></head><body><h1>💤 Дневник сна</h1><pre>${escapeHtml(report)}</pre><table><tr><th>Дата</th><th>Часы</th><th>Качество</th><th>Проб.</th><th>Латентность</th><th>Стресс</th><th>Заметки</th></tr>${rows.map((r) => `<tr><td>${escapeHtml(r.date)}</td><td>${r.hours}</td><td>${r.quality}</td><td>${r.awakenings}</td><td>${r.latency ?? ''}</td><td>${r.stressLevel ?? ''}</td><td>${escapeHtml(r.notes)}</td></tr>`).join('')}</table></body></html>`,
    );
    w.document.close();
    w.print();
  };
  if (!open) return null;
  const line = points
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p, i, all) => `${20 + (i * 560) / Math.max(1, all.length - 1)},${180 - p.value * 16}`)
    .join(' ');
  const changeSort = (key: string) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#09090b', color: colors.text, overflow: 'auto' }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          padding: 12,
          display: 'flex',
          gap: 7,
          flexWrap: 'wrap',
          background: '#18181b',
          alignItems: 'center',
        }}
      >
        <button style={button} onClick={onClose}>
          ← Дневники
        </button>
        <b style={{ fontSize: 18 }}>💤 Сон</b>
        <span>{rows.length} записей</span>
        <button style={button} onClick={() => setForm(blankEntry())}>
          + Записать
        </button>
        <button style={button} onClick={() => setForm(blankEntry())}>
          ⚡ Сегодня
        </button>
        <button style={button} onClick={exportCsv}>
          📥 CSV
        </button>
        <button style={button} onClick={print}>
          📄 PDF
        </button>
        <button
          style={button}
          onClick={() => svgRef.current && exportSvgAsFile(svgRef.current, `sleep-${todayIso()}.svg`)}
        >
          SVG
        </button>
        <button
          style={button}
          onClick={() => svgRef.current && exportSvgAsPng(svgRef.current, `sleep-${todayIso()}.png`)}
        >
          PNG
        </button>
        <button
          style={button}
          onClick={() => {
            if (window.confirm('Очистить дневник сна?')) commit([]);
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
            ↩ Undo
          </button>
        )}
      </header>
      <main style={{ padding: 16, maxWidth: 1100, margin: 'auto' }}>
        {form && <SleepForm value={form} onCancel={() => setForm(null)} onSave={add} />}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', '7', '30', '90'] as const).map((r) => (
            <button
              key={r}
              style={{ ...button, borderColor: range === r ? '#a78bfa' : undefined }}
              onClick={() => {
                setRange(r);
                setPage(1);
              }}
            >
              {r === 'all' ? 'Всё время' : `${r} дней`}
            </button>
          ))}
          <input
            style={{ ...input, width: 220 }}
            placeholder="🔍 Поиск"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <button style={button} onClick={() => changeSort('date')}>
            ↕ Дата
          </button>
        </div>
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(125px,1fr))',
            gap: 8,
            margin: '12px 0',
          }}
        >
          {[
            ['Среднее', dist ? `${dist.mean.toFixed(1)} ч` : '—'],
            ['Медиана', dist ? `${dist.median.toFixed(1)} ч` : '—'],
            ['Мин/макс', extremes.min && extremes.max ? `${extremes.min.value}/${extremes.max.value} ч` : '—'],
            ['Серия', `${streak.current} дн.`],
            ['Долг за 7д', `${debt.toFixed(1)} ч`],
            ['Цели', `${goalScore}%`],
            ['Аномалии', anomalies.length],
          ].map(([label, value]) => (
            <div style={card} key={label}>
              <small>{label}</small>
              <strong style={{ display: 'block', fontSize: 18 }}>{value}</strong>
            </div>
          ))}
        </section>
        <section style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <b>🎯 Цели сна</b>
            <button style={button} onClick={() => setShowGoals(!showGoals)}>
              {showGoals ? 'Скрыть' : 'Настроить'}
            </button>
          </div>
          {showGoals && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
                gap: 8,
                marginTop: 8,
              }}
            >
              {[
                ['Часы', 'targetHours'],
                ['Качество', 'targetQuality'],
                ['Латентность', 'targetLatency'],
                ['Пробуждения', 'targetAwakenings'],
                ['Макс стресс', 'maxStressLevel'],
                ['Алкоголь дней', 'alcoholDaysPerWeek'],
              ].map(([label, key]) => (
                <label key={key} style={{ fontSize: 11 }}>
                  {label}
                  <input
                    style={input}
                    type="number"
                    value={goals[key as keyof SleepGoals]}
                    onChange={(e) => {
                      const next = { ...goals, [key]: Number(e.target.value) };
                      setGoals(next);
                      localStorage.setItem(GOALS_KEY, JSON.stringify(next));
                    }}
                  />
                </label>
              ))}
            </div>
          )}
        </section>
        <section style={{ ...card, background: '#121216', marginBottom: 12 }}>
          <svg ref={svgRef} viewBox="0 0 600 230" width="100%" aria-label="График часов сна">
            {[0, 2, 4, 6, 8, 10].map((value) => (
              <g key={value}>
                <line x1="40" y1={190 - value * 16} x2="580" y2={190 - value * 16} stroke="#ffffff12" />
                <text x="34" y={194 - value * 16} textAnchor="end" fill="#71717a" fontSize="9">
                  {value}
                </text>
              </g>
            ))}
            <line x1="40" y1="30" x2="40" y2="190" stroke="#52525b" />
            <rect
              x="20"
              y={180 - (normal?.high || 9) * 16}
              width="560"
              height={((normal?.high || 9) - (normal?.low || 7)) * 16}
              fill="rgba(34,197,94,.1)"
            />
            <line
              x1="20"
              y1={180 - goals.targetHours * 16}
              x2="580"
              y2={180 - goals.targetHours * 16}
              stroke="#22c55e"
              strokeDasharray="5 4"
            />
            <polyline points={line} fill="none" stroke="#a78bfa" strokeWidth="3" />
            {points.length <= 31 &&
              points
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((point, index, all) => (
                  <g key={`${point.date}-${index}`}>
                    <circle
                      cx={20 + (index * 560) / Math.max(1, all.length - 1)}
                      cy={180 - point.value * 16}
                      r="3"
                      fill="#a78bfa"
                    />
                    <text
                      x={20 + (index * 560) / Math.max(1, all.length - 1)}
                      y="211"
                      textAnchor="middle"
                      fill="#71717a"
                      fontSize="8"
                    >
                      {point.date.slice(5)}
                    </text>
                  </g>
                ))}
          </svg>
          <small>Зелёная зона: норма 7–9 ч · пунктир: цель {goals.targetHours} ч</small>
          {weeks.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {weeks.map((w) => (
                <span key={w.weekStart}>
                  {w.weekStart}: <b>{w.mean.toFixed(1)}ч</b> ({w.count})
                </span>
              ))}
            </div>
          )}
        </section>
        {diaryCorrelations.length > 0 && (
          <section style={{ ...card, margin: '12px 0' }}>
            <h3 style={{ marginTop: 0 }}>🔗 Совпадающие и лагированные связи</h3>
            {diaryCorrelations.map((item, index) => (
              <div key={`${item.label}-${item.lag}-${index}`} style={{ padding: 7 }}>
                {item.label}: <b style={{ color: item.r >= 0 ? '#22c55e' : '#ef4444' }}>r={item.r.toFixed(2)}</b> ·{' '}
                {item.lag ? 'лаг 1 день' : 'тот же день'} · n={item.n}
              </div>
            ))}
          </section>
        )}
        {comparison.thisWeek && comparison.lastWeek && (
          <section style={card}>
            📆 Неделя: <b>{comparison.thisWeek.mean.toFixed(1)} ч</b> vs {comparison.lastWeek.mean.toFixed(1)} ч ранее (
            {comparison.delta !== null && comparison.delta >= 0 ? '+' : ''}
            {comparison.delta?.toFixed(1)} ч)
          </section>
        )}
        {(hygiene.length || recommendations.length || ped.length) > 0 && (
          <section style={{ ...card, margin: '12px 0' }}>
            <h3>🧠 Гигиена, корреляции и engine insights</h3>
            {[
              ...hygiene,
              ...recommendations,
              ...ped.map(
                (x) =>
                  `${x.substance}: качество ${x.avgQualityChange >= 0 ? '+' : ''}${x.avgQualityChange}, латентность ${x.avgLatencyChange >= 0 ? '+' : ''}${x.avgLatencyChange} мин`,
              ),
            ].map((x, i) => (
              <div key={i} style={{ margin: '5px 0', color: '#fbbf24' }}>
                • {x}
              </div>
            ))}
            {correlations.map((c) => (
              <div key={c.factor} style={{ fontSize: 12, marginTop: 5 }}>
                {c.factor}: {c.description} · {c.strength}
              </div>
            ))}
          </section>
        )}
        {anomalies.length > 0 && (
          <section style={{ ...card, borderColor: '#ef4444', color: '#fca5a5' }}>
            <b>⚠️ Аномалии ({anomalies.length})</b>
            {anomalies.slice(0, 5).map((a, i) => (
              <div key={i}>
                {a.date}: {a.message}
              </div>
            ))}
          </section>
        )}
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Дата', 'Часы', 'Качество', 'Пробуждений', 'Латентность', 'Стресс', 'Алкоголь', 'Заметки'].map(
                  (h) => (
                    <th
                      key={h}
                      onClick={() => changeSort(h === 'Дата' ? 'date' : h)}
                      style={{ textAlign: 'left', padding: 7, cursor: 'pointer', borderBottom: '1px solid #52525b' }}
                    >
                      {h}
                    </th>
                  ),
                )}
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {pageData.pageItems.map((e) => {
                const r = rows.find((x) => x.date === e.date)!;
                return (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    <td>{r.hours} ч</td>
                    <td>{r.quality}/5</td>
                    <td>{r.awakenings}</td>
                    <td>{r.latency ?? '—'} мин</td>
                    <td>{r.stressLevel ?? '—'}</td>
                    <td>{r.alcohol ? 'да' : 'нет'}</td>
                    <td>{r.notes || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button style={button} onClick={() => setForm(r)}>
                        ✏️
                      </button>{' '}
                      <button style={button} onClick={() => commit(rows.filter((x) => x.date !== r.date))}>
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '10px 0' }}>
          <button style={button} disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ←
          </button>{' '}
          Страница {page}/{pageData.totalPages}{' '}
          <button style={button} disabled={page >= pageData.totalPages} onClick={() => setPage(page + 1)}>
            →
          </button>
        </div>
        <h3>Последние записи</h3>
        {rows.slice(0, 3).map((r) => (
          <div key={r.date} style={{ ...card, marginBottom: 6 }}>
            <b>{r.date}</b> · {r.hours} ч · качество {r.quality}/5 · {r.bedtime}–{r.wakeTime}
            {r.notes ? ` · ${r.notes}` : ''}
          </div>
        ))}
        {!rows.length && <div style={card}>Записей пока нет.</div>}
      </main>
    </div>
  );
};
