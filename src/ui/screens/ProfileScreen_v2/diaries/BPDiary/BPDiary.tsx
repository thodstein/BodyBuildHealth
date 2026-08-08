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

const KEY = 'he_bp_diary';
type Position = 'sitting' | 'standing' | 'lying';
type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
type Row = {
  date: string;
  systolic: number;
  diastolic: number;
  pulse: number;
  hr?: number;
  notes?: string;
  position?: Position;
  arm?: 'left' | 'right';
  timeOfDay?: TimeOfDay;
  medicationTaken?: boolean;
  symptoms?: string[];
};
type Draft = Omit<Row, 'systolic' | 'diastolic' | 'pulse'> & {
  systolic: string;
  diastolic: string;
  pulse: string;
  symptomsText: string;
};

const btn: React.CSSProperties = {
  minHeight: 36,
  padding: '6px 10px',
  borderRadius: 7,
  background: '#27272a',
  border: '1px solid #3f3f46',
  color: '#fff',
  cursor: 'pointer',
};
const input: React.CSSProperties = { ...btn, width: '100%', background: '#18181b', boxSizing: 'border-box' };
const card: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: 'rgba(239,68,68,.12)',
  border: '1px solid rgba(239,68,68,.2)',
};
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c,
  );

const read = (): Row[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x) => x && typeof x.date === 'string')
      .map((x) => ({ ...x, pulse: Number(x.pulse ?? x.hr), hr: Number(x.hr ?? x.pulse) }))
      .filter((x) => [x.systolic, x.diastolic, x.pulse].every(Number.isFinite));
  } catch {
    return [];
  }
};
const asFields = (x: Row): DiaryEntryLike => ({
  date: x.date,
  fields: [
    { label: 'Систола', value: String(x.systolic), unit: 'мм рт.ст.' },
    { label: 'Диастола', value: String(x.diastolic), unit: 'мм рт.ст.' },
    { label: 'Пульс', value: String(x.pulse), unit: 'уд/мин' },
    ...(x.notes ? [{ label: 'Заметка', value: x.notes, unit: '' }] : []),
  ],
});
const classify = (s: number, d: number) =>
  s >= 180 || d >= 120
    ? ['Криз', '#b91c1c']
    : s >= 140 || d >= 90
      ? ['Гипертензия 2', '#ef4444']
      : s >= 130 || d >= 80
        ? ['Гипертензия 1', '#f59e0b']
        : s >= 120
          ? ['Повышено', '#fbbf24']
          : ['Норма', '#22c55e'];
const pearson = (a: { date: string; value: number }[], b: { date: string; value: number }[]) => {
  const bm = new Map(b.map((x) => [x.date, x.value]));
  const p = a
    .map((x) => [x.value, bm.get(x.date)] as const)
    .filter((x): x is [number, number] => Number.isFinite(x[0]) && Number.isFinite(x[1]));
  if (p.length < 3) return null;
  const am = p.reduce((n, x) => n + x[0], 0) / p.length;
  const bm2 = p.reduce((n, x) => n + x[1], 0) / p.length;
  const n = p.reduce((z, x) => z + (x[0] - am) * (x[1] - bm2), 0);
  const da = p.reduce((z, x) => z + (x[0] - am) ** 2, 0);
  const db = p.reduce((z, x) => z + (x[1] - bm2) ** 2, 0);
  return da && db ? n / Math.sqrt(da * db) : null;
};
const defaultDraft = (): Draft => ({
  date: todayIso(),
  systolic: '120',
  diastolic: '80',
  pulse: '70',
  position: 'sitting',
  arm: 'left',
  timeOfDay: 'morning',
  medicationTaken: false,
  symptomsText: '',
});

export const BPDiary: React.FC<DiaryWindowProps> = ({ open, onClose, goals, onDataChange }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Draft>(defaultDraft());
  const [editing, setEditing] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [undo, setUndo] = useState<Row[] | null>(null);
  const [range, setRange] = useState<'all' | '7' | '30' | '90'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'journal' | 'stats'>('journal');
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (open) setRows(read());
  }, [open]);
  const commit = (next: Row[], remember = true) => {
    const ordered = [...next].sort((a, b) => b.date.localeCompare(a.date));
    localStorage.setItem(KEY, JSON.stringify(ordered.slice(0, 365)));
    setRows(ordered);
    if (remember) setUndo(rows);
    onDataChange?.();
  };
  const openNew = () => {
    setEditing(null);
    setDraft(defaultDraft());
    setModal(true);
  };
  const save = () => {
    const s = Number(draft.systolic),
      d = Number(draft.diastolic),
      p = Number(draft.pulse);
    if (
      !draft.date ||
      ![s, d, p].every(Number.isFinite) ||
      s < 50 ||
      s > 250 ||
      d < 30 ||
      d > 180 ||
      p < 20 ||
      p > 250 ||
      d >= s
    )
      return;
    const row: Row = {
      date: draft.date,
      systolic: Math.round(s),
      diastolic: Math.round(d),
      pulse: Math.round(p),
      hr: Math.round(p),
      position: draft.position,
      arm: draft.arm,
      timeOfDay: draft.timeOfDay,
      medicationTaken: draft.medicationTaken,
      symptoms: draft.symptomsText
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      notes: draft.notes?.trim() || undefined,
    };
    commit(
      editing ? rows.map((x) => (x.date === editing ? row : x)) : [row, ...rows.filter((x) => x.date !== row.date)],
    );
    setModal(false);
    setEditing(null);
  };
  const editRow = (x: Row) => {
    setEditing(x.date);
    setDraft({
      ...defaultDraft(),
      ...x,
      systolic: String(x.systolic),
      diastolic: String(x.diastolic),
      pulse: String(x.pulse),
      symptomsText: (x.symptoms || []).join(', '),
    });
    setModal(true);
  };
  const entries = useMemo(() => rows.map(asFields), [rows]);
  const visible = useMemo(() => {
    let x = filterByRange(entries, range);
    if (query.trim()) {
      const q = query.toLowerCase();
      x = x.filter((e) => e.date.includes(q) || e.fields.some((f) => f.value.toLowerCase().includes(q)));
    }
    return sortEntries(x, sort);
  }, [entries, range, query, sort]);
  const pageData = paginate(visible, page, 8);
  const points = visible
    .map((e) => ({ date: e.date, value: Number(e.fields[0].value) }))
    .filter((x) => Number.isFinite(x.value));
  const dist = computeDistribution(points.map((x) => x.value));
  const extremes = computeExtremes('bp', visible);
  const streak = computeStreak(visible);
  const anomalies = detectAnomalies('bp', visible);
  const comparison = compareWithLastWeek(points);
  const weekly = buildWeeklyHistogram(points);
  const normal = getNormalRange('bp');
  const bpCorrelations = useMemo(() => {
    const read = (key: string, value: (entry: any) => number) => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(raw)
          ? raw.map((entry) => ({ date: entry.date, value: value(entry) })).filter((x) => Number.isFinite(x.value))
          : [];
      } catch {
        return [];
      }
    };
    return [
      ['Сон', read('he_sleep_diary', (e) => Number(e.hours))],
      ['Вес', read('he_weight_log', (e) => Number(e.weight))],
      ['Боль', read('he_health_diary', (e) => Number(e.pain?.totalScore ?? e.totalScore))],
    ]
      .flatMap(([label, data]) => {
        const same = crossCorrelation(points, data as { date: string; value: number }[]);
        const lagged = laggedCorrelation(points, data as { date: string; value: number }[], 1);
        return [same && { label, ...same, lag: 0 }, lagged && { label, ...lagged, lag: 1 }].filter(Boolean) as Array<{
          label: string;
          r: number;
          n: number;
          lag: number;
        }>;
      })
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, 6);
  }, [points]);
  const latest = rows[0];
  const avg = (key: 'systolic' | 'diastolic' | 'pulse') =>
    points.length
      ? Math.round(
          rows.filter((x) => visible.some((v) => v.date === x.date)).reduce((n, x) => n + x[key], 0) / points.length,
        )
      : 0;
  const recentRows = rows.filter((x) => visible.some((v) => v.date === x.date));
  const normalPct = recentRows.length
    ? Math.round((recentRows.filter((x) => x.systolic < 130 && x.diastolic < 80).length / recentRows.length) * 100)
    : 0;
  const bpGoal = goals?.systolicTarget > 0 ? goals.systolicTarget : 120;
  const correlations = useMemo(() => {
    const sleep = (() => {
      try {
        const x = JSON.parse(localStorage.getItem('he_sleep_diary') || '[]');
        return Array.isArray(x) ? x.map((e) => ({ date: e.date, value: Number(e.hours) })) : [];
      } catch {
        return [];
      }
    })();
    const weight = (() => {
      try {
        const x = JSON.parse(localStorage.getItem('he_weight_diary') || '[]');
        return Array.isArray(x) ? x.map((e) => ({ date: e.date, value: Number(e.weight) })) : [];
      } catch {
        return [];
      }
    })();
    const health = (() => {
      try {
        const x = JSON.parse(localStorage.getItem('he_health_diary') || '[]');
        return Array.isArray(x)
          ? x.map((e) => ({ date: e.date, value: Number(e.totalScore ?? e.pain?.totalScore) }))
          : [];
      } catch {
        return [];
      }
    })();
    return [
      { label: 'Сон', r: pearson(points, sleep) },
      { label: 'Вес', r: pearson(points, weight) },
      { label: 'Здоровье', r: pearson(points, health) },
    ].filter((x) => x.r !== null) as { label: string; r: number }[];
  }, [points]);
  const line = (key: 'systolic' | 'diastolic' | 'pulse', min: number, max: number) => {
    const data = recentRows.slice().sort((a, b) => a.date.localeCompare(b.date));
    return data
      .map((x, i) => `${40 + (i * 520) / Math.max(1, data.length - 1)},${190 - ((x[key] - min) * 150) / (max - min)}`)
      .join(' ');
  };
  const exportCsv = () => {
    const head = 'Дата,Систола,Диастола,Пульс,Положение,Рука,Время,Лекарство,Симптомы,Заметки\n';
    const body = rows
      .map((x) =>
        [
          x.date,
          x.systolic,
          x.diastolic,
          x.pulse,
          x.position || '',
          x.arm || '',
          x.timeOfDay || '',
          x.medicationTaken ? 'да' : 'нет',
          (x.symptoms || []).join('; '),
          x.notes || '',
        ]
          .map(esc)
          .join(','),
      )
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + head + body], { type: 'text/csv' }));
    a.download = `bp-${todayIso()}.csv`;
    a.click();
  };
  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<!doctype html><meta charset="utf-8"><title>Дневник АД</title><h1>Дневник артериального давления</h1><p>Записей: ${rows.length}; среднее: ${avg('systolic')}/${avg('diastolic')}, пульс ${avg('pulse')}</p><table border="1" cellspacing="0" cellpadding="5"><tr><th>Дата</th><th>АД</th><th>Пульс</th><th>Положение</th><th>Заметки</th></tr>${rows.map((x) => `<tr><td>${esc(x.date)}</td><td>${x.systolic}/${x.diastolic}</td><td>${x.pulse}</td><td>${esc(x.position || '')}</td><td>${esc(x.notes || '')}</td></tr>`).join('')}</table>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 100);
  };
  if (!open) return null;
  const axis = [60, 90, 120, 150, 180];
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
        }}
      >
        <button style={btn} onClick={onClose}>
          ← Дневники
        </button>
        <b>❤️ Давление и пульс</b>
        <span>{rows.length} записей</span>
        <button style={btn} onClick={openNew}>
          + Добавить
        </button>
        <button style={btn} onClick={openNew}>
          ⚡ Сегодня
        </button>
        <button style={btn} onClick={exportCsv}>
          CSV
        </button>
        <button style={btn} onClick={print}>
          PDF/Печать
        </button>
        <button style={btn} onClick={() => svg.current && exportSvgAsFile(svg.current, `bp-${todayIso()}.svg`)}>
          SVG
        </button>
        <button style={btn} onClick={() => svg.current && exportSvgAsPng(svg.current, `bp-${todayIso()}.png`)}>
          PNG
        </button>
        <button
          style={btn}
          onClick={() => {
            if (window.confirm('Очистить дневник давления?')) commit([]);
          }}
        >
          Очистить
        </button>
        {undo && (
          <button
            style={btn}
            onClick={() => {
              commit(undo, false);
              setUndo(null);
            }}
          >
            ↩ Отменить
          </button>
        )}
      </header>
      <main style={{ padding: 16, maxWidth: 1100, margin: 'auto' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', '7', '30', '90'] as const).map((x) => (
            <button
              key={x}
              style={btn}
              onClick={() => {
                setRange(x);
                setPage(1);
              }}
            >
              {x === 'all' ? 'Всё' : `${x} дней`}
            </button>
          ))}
          <input
            style={{ ...input, width: 180 }}
            placeholder="Поиск"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <button style={btn} onClick={() => setSort({ key: 'date', dir: sort.dir === 'asc' ? 'desc' : 'asc' })}>
            ↕ Сортировать
          </button>
          <button style={btn} onClick={() => setTab(tab === 'journal' ? 'stats' : 'journal')}>
            {tab === 'journal' ? '📊 Статистика' : '📋 Журнал'}
          </button>
        </div>
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
            gap: 8,
            margin: '12px 0',
          }}
        >
          {[
            ['Среднее АД', `${avg('systolic') || '—'}/${avg('diastolic') || '—'}`],
            ['Пульс', avg('pulse') || '—'],
            ['Последнее', latest ? `${latest.systolic}/${latest.diastolic}` : '—'],
            ['Норма', `${normalPct}%`],
            ['Серия', `${streak.current} дн.`],
            ['Цель', `≤${bpGoal}`],
          ].map(([l, v]) => (
            <div style={card} key={String(l)}>
              <small>{l}</small>
              <strong style={{ display: 'block', fontSize: 18 }}>{v}</strong>
            </div>
          ))}
        </section>
        {latest && (
          <div style={{ marginBottom: 10, color: classify(latest.systolic, latest.diastolic)[1] as string }}>
            Последняя запись:{' '}
            <b>
              {latest.date} · {latest.systolic}/{latest.diastolic} · {latest.pulse} уд/мин
            </b>{' '}
            · {classify(latest.systolic, latest.diastolic)[0]}
          </div>
        )}
        {tab === 'journal' ? (
          <>
            {recentRows.length > 0 && (
              <section style={{ background: '#121216', padding: 10, borderRadius: 10, marginTop: 12 }}>
                <svg ref={svg} viewBox="0 0 600 235" width="100%" aria-label="График давления и пульса">
                  <line x1="40" y1="190" x2="560" y2="190" stroke="#555" />
                  <line x1="40" y1="40" x2="40" y2="190" stroke="#555" />
                  {normal && (
                    <rect
                      x="40"
                      y={190 - (normal.high - 40)}
                      width="520"
                      height={normal.high - normal.low}
                      fill="#22c55e12"
                    />
                  )}
                  <line
                    x1="40"
                    y1={190 - (bpGoal - 40)}
                    x2="560"
                    y2={190 - (bpGoal - 40)}
                    stroke="#22c55e"
                    strokeDasharray="5 4"
                  />
                  {axis.map((v) => (
                    <g key={v}>
                      <line
                        x1="40"
                        y1={190 - ((v - 40) * 150) / 150}
                        x2="560"
                        y2={190 - ((v - 40) * 150) / 150}
                        stroke="#29292f"
                      />
                      <text x="35" y={194 - ((v - 40) * 150) / 150} textAnchor="end" fill="#777" fontSize="9">
                        {v}
                      </text>
                    </g>
                  ))}
                  <polyline points={line('systolic', 40, 190)} fill="none" stroke="#ef4444" strokeWidth="3" />
                  <polyline points={line('diastolic', 40, 190)} fill="none" stroke="#f59e0b" strokeWidth="2" />
                  <polyline
                    points={line('pulse', 40, 190)}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    strokeDasharray="5 3"
                  />
                  {recentRows.length <= 14 &&
                    recentRows.map((x, i) => (
                      <text
                        key={x.date + i}
                        x={40 + (i * 520) / Math.max(1, recentRows.length - 1)}
                        y="213"
                        textAnchor="middle"
                        fill="#777"
                        fontSize="8"
                      >
                        {x.date.slice(5)}
                      </text>
                    ))}
                </svg>
                <div style={{ fontSize: 10, color: '#aaa' }}>
                  🔴 Систолическое · 🟠 Диастолическое · 🟣 Пульс · норма систолы: 90–120 мм рт.ст.
                </div>
              </section>
            )}
            <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
              {weekly.map((x) => (
                <div key={x.weekStart} style={{ ...card, flex: '1 1 100px' }}>
                  <small>{x.weekStart}</small>
                  <strong style={{ display: 'block' }}>{x.mean.toFixed(0)}</strong>
                  <small>
                    {x.count} зап. · {x.min}/{x.max}
                  </small>
                </div>
              ))}
            </section>
            {anomalies.slice(0, 8).map((x, i) => (
              <div key={i} style={{ color: x.severity === 'danger' ? '#ef4444' : '#f59e0b', margin: '4px 0' }}>
                ⚠ {x.date}: {x.message}
              </div>
            ))}
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
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>АД</th>
                  <th>Пульс</th>
                  <th>Класс</th>
                  <th>Контекст</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {pageData.pageItems.map((e) => {
                  const x = rows.find((r) => r.date === e.date)!;
                  const [label, color] = classify(x.systolic, x.diastolic);
                  return (
                    <tr key={x.date} style={{ borderBottom: '1px solid #29292f' }}>
                      <td>{x.date}</td>
                      <td style={{ color }}>
                        {x.systolic}/{x.diastolic}
                      </td>
                      <td>{x.pulse}</td>
                      <td style={{ color }}>{label}</td>
                      <td>
                        {x.position || '—'} · {x.timeOfDay || '—'}
                        {x.medicationTaken ? ' · 💊' : ''}
                      </td>
                      <td>
                        <button style={btn} onClick={() => editRow(x)}>
                          Изменить
                        </button>{' '}
                        <button style={btn} onClick={() => commit(rows.filter((r) => r.date !== x.date))}>
                          Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: 10 }}>
              <button style={btn} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ←
              </button>{' '}
              Страница {page}/{pageData.totalPages}{' '}
              <button style={btn} disabled={page >= pageData.totalPages} onClick={() => setPage(page + 1)}>
                →
              </button>
            </div>
          </>
        ) : (
          <>
            <section style={{ ...card, marginTop: 12 }}>
              <h3>📊 Распределение и экстремумы</h3>
              <div>
                Среднее: <b>{dist?.mean.toFixed(1) || '—'}</b> · медиана: <b>{dist?.median.toFixed(1) || '—'}</b> · SD:{' '}
                <b>{dist?.stdDev.toFixed(1) || '—'}</b> · P25/P75:{' '}
                <b>{dist ? `${dist.p25.toFixed(1)}/${dist.p75.toFixed(1)}` : '—'}</b>
              </div>
              <div>
                Минимум: {extremes.min ? `${extremes.min.value} (${extremes.min.date})` : '—'} · Максимум:{' '}
                {extremes.max ? `${extremes.max.value} (${extremes.max.date})` : '—'}
              </div>
              <div>
                Неделя к неделе:{' '}
                {comparison.delta == null ? '—' : `${comparison.delta > 0 ? '+' : ''}${comparison.delta.toFixed(1)}`}
              </div>
            </section>
            <section style={{ ...card, marginTop: 12 }}>
              <h3>🔗 Корреляции по совпадающим датам</h3>
              {correlations.length ? (
                correlations.map((x) => (
                  <div key={x.label}>
                    {x.label}: <b style={{ color: x.r > 0 ? '#ef4444' : '#22c55e' }}>{x.r.toFixed(2)}</b> (
                    {Math.abs(x.r) >= 0.7 ? 'сильная' : Math.abs(x.r) >= 0.4 ? 'умеренная' : 'слабая'})
                  </div>
                ))
              ) : (
                <div>Недостаточно совпадающих данных сна, веса или здоровья.</div>
              )}
            </section>
          </>
        )}
      </main>
      {rows.length > 0 && (
        <section style={{ padding: '0 16px 16px', maxWidth: 1100, margin: 'auto' }}>
          <div style={{ ...card, background: '#18181b' }}>
            <h3 style={{ marginTop: 0 }}>Последние записи</h3>
            {rows.slice(0, 3).map((row) => (
              <div key={`latest-${row.date}`} style={{ padding: 8, borderBottom: '1px solid #29292f' }}>
                <b>{row.date}</b> · {row.systolic}/{row.diastolic} · {row.pulse} уд/мин ·{' '}
                {row.position || 'положение не указано'}
                {row.notes ? ` · ${row.notes}` : ''}
              </div>
            ))}
          </div>
        </section>
      )}
      {modal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2100,
            background: '#000b',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            style={{ background: '#18181b', padding: 18, borderRadius: 12, width: 'min(560px,100%)' }}
          >
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
                  <input
                    style={input}
                    type={key === 'date' ? 'date' : 'number'}
                    value={String(draft[key as keyof Draft] ?? '')}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
              <label>
                Положение
                <select
                  style={input}
                  value={draft.position}
                  onChange={(e) => setDraft({ ...draft, position: e.target.value as Position })}
                >
                  <option value="sitting">Сидя</option>
                  <option value="standing">Стоя</option>
                  <option value="lying">Лёжа</option>
                </select>
              </label>
              <label>
                Рука
                <select
                  style={input}
                  value={draft.arm}
                  onChange={(e) => setDraft({ ...draft, arm: e.target.value as 'left' | 'right' })}
                >
                  <option value="left">Левая</option>
                  <option value="right">Правая</option>
                </select>
              </label>
              <label>
                Время
                <select
                  style={input}
                  value={draft.timeOfDay}
                  onChange={(e) => setDraft({ ...draft, timeOfDay: e.target.value as TimeOfDay })}
                >
                  <option value="morning">Утро</option>
                  <option value="afternoon">День</option>
                  <option value="evening">Вечер</option>
                  <option value="night">Ночь</option>
                </select>
              </label>
            </div>
            <label style={{ display: 'block', marginTop: 8 }}>
              <input
                type="checkbox"
                checked={!!draft.medicationTaken}
                onChange={(e) => setDraft({ ...draft, medicationTaken: e.target.checked })}
              />{' '}
              Лекарство принято
            </label>
            <label style={{ display: 'block', marginTop: 8 }}>
              Симптомы (через запятую)
              <input
                style={input}
                value={draft.symptomsText}
                onChange={(e) => setDraft({ ...draft, symptomsText: e.target.value })}
              />
            </label>
            <label style={{ display: 'block', marginTop: 8 }}>
              Заметки
              <textarea
                style={{ ...input, minHeight: 60 }}
                value={draft.notes || ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" style={btn} onClick={() => setModal(false)}>
                Отмена
              </button>
              <button type="submit" style={{ ...btn, background: '#ef4444' }}>
                {editing ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
