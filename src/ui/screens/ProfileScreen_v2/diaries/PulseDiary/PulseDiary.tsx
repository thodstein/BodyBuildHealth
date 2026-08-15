/**
 * PulseDiary.tsx — окно дневника ЧСС (утро/вечер).
 * Компактный просмотр: статистика, таблица, добавление/редактирование/удаление, undo, CSV.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { colors, glassCard, inputStyle } from '../../ui';
import { btnBase, btnPrimary, chip, chipActive, main as pageMain } from '../diary-page-styles';
import { DiaryHeader } from '../DiaryHeader';
import { AddPulseModal } from '../../pulse-diary-modal';
import type { DiaryWindowProps } from '../../DiaryWindow';
import {
  getHREntries,
  saveHREntry,
  updateHREntry,
  deleteHREntry,
  clearHRDiary,
  replaceHRDiary,
  getHRAverages,
  detectHRAnomalies,
  getHRTrend,
  todayLocalStr,
  type HREntry,
} from '../../../../../engines/hr-diary.engine';
import { todayIso } from '../../diary-helpers';

const ACCENT = '#ec4899';

const button: React.CSSProperties = { ...btnBase(ACCENT) };
const card: React.CSSProperties = { ...glassCard, padding: 14 };

const Metric: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({
  label,
  value,
  tone = ACCENT,
}) => (
  <div style={{ ...card, minWidth: 130, flex: '1 1 130px' }}>
    <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
    <strong style={{ fontSize: 20, color: tone }}>{value}</strong>
  </div>
);

const bpmTone = (bpm: number) =>
  bpm >= 100 ? colors.danger : bpm < 50 ? colors.warning : bpm >= 90 ? colors.warning : colors.green;

export const PulseDiary: React.FC<DiaryWindowProps> = ({ open, onClose, onDataChange }) => {
  const [rows, setRows] = useState<HREntry[]>([]);
  const [modal, setModal] = useState<{ open: boolean; entry?: HREntry }>({ open: false });
  const [undo, setUndo] = useState<HREntry[] | null>(null);
  const [range, setRange] = useState<'all' | '7' | '30' | '90'>('all');

  useEffect(() => {
    if (open) {
      setRows(getHREntries());
      setModal({ open: false });
    }
  }, [open]);

  const commit = (next: HREntry[], remember = true) => {
    if (remember) setUndo(rows);
    setRows([...next].sort((a, b) => b.date.localeCompare(a.date) || (a.timeOfDay === 'morning' ? -1 : 1)));
    onDataChange?.();
  };
  const save = (draft: any, id?: string) => commit(id ? updateHREntry(id, draft) : saveHREntry(draft));
  const remove = (entry: HREntry) => {
    if (window.confirm(`Удалить запись ЧСС от ${entry.date} (${entry.timeOfDay === 'morning' ? 'утро' : 'вечер'})?`)) {
      commit(deleteHREntry(entry.id));
    }
  };
  const clear = () => {
    if (!rows.length || !window.confirm('Удалить весь дневник ЧСС?')) return;
    const previous = rows;
    clearHRDiary();
    commit([], false);
    setUndo(previous);
  };
  const restore = () => {
    if (!undo) return;
    setRows(replaceHRDiary(undo));
    setUndo(null);
    onDataChange?.();
  };

  const visible = useMemo(() => {
    if (range === 'all') return rows;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(range));
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    return rows.filter((e) => e.date >= cutoffStr);
  }, [rows, range]);

  const averages = useMemo(() => getHRAverages(rows, 7), [rows]);
  const averages30 = useMemo(() => getHRAverages(rows, 30), [rows]);
  const anomalies = useMemo(() => detectHRAnomalies(rows), [rows]);
  const trend = useMemo(() => getHRTrend(rows), [rows]);
  const latest = rows[0];

  const exportCsv = () => {
    const head = 'Дата,Время суток,ЧСС,Заметки\n';
    const body = rows
      .map((r) => [r.date, r.timeOfDay === 'morning' ? 'утро' : 'вечер', r.bpm, r.notes || ''])
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + head + body], { type: 'text/csv;charset=utf-8' }));
    a.download = `hr-${todayIso()}.csv`;
    a.click();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background:
          'radial-gradient(900px 480px at 15% -10%, rgba(236,72,153,0.10), transparent 60%), radial-gradient(700px 420px at 100% 0%, rgba(56,189,248,0.06), transparent 55%), #0a0a0d',
        color: colors.text, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}
    >
      <style>{`
        .pulse-window button { font-family: inherit; }
        .pulse-window::-webkit-scrollbar { width: 10px; }
        .pulse-window::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 5px; }
        @media (hover: none) and (pointer: coarse) {
          .pulse-window button { min-height: 44px; }
        }
      `}</style>
      <div className="pulse-window">
        <DiaryHeader
          accent={ACCENT}
          title="💓 ЧСС (утро/вечер)"
          count={rows.length}
          onClose={onClose}
          onAdd={() => setModal({ open: true })}
          addLabel="＋ Записать"
          onToday={latest
            ? () => setModal({ open: true })
            : undefined}
          todayLabel="↻ Повторить"
          undoActive={!!undo}
          onUndo={restore}
          exportActions={[
            { label: '📥 CSV-файл', onClick: exportCsv },
            { label: '🗑 Очистить дневник', onClick: clear, danger: true },
          ]}
        />
        <main style={{ ...pageMain, maxWidth: 980, paddingBottom: 72 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {(['all', '7', '30', '90'] as const).map((r) => (
              <button key={r} style={range === r ? chipActive(ACCENT) : chip(ACCENT)} onClick={() => setRange(r)}>
                {r === 'all' ? 'Всё время' : `${r} дней`}
              </button>
            ))}
          </div>

          <section style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
            <Metric label="Утро (7д)" value={averages.morning.avg !== null ? `${averages.morning.avg} уд/мин` : '—'} tone={averages.morning.avg !== null ? bpmTone(averages.morning.avg) : ACCENT} />
            <Metric label="Вечер (7д)" value={averages.evening.avg !== null ? `${averages.evening.avg} уд/мин` : '—'} tone={averages.evening.avg !== null ? bpmTone(averages.evening.avg) : ACCENT} />
            <Metric label="Среднее (30д)" value={averages30.resting.avg !== null ? `${averages30.resting.avg} уд/мин` : '—'} tone={averages30.resting.avg !== null ? bpmTone(averages30.resting.avg) : ACCENT} />
            <Metric
              label="Тренд утреннего"
              value={trend ? (trend.direction === 'up' ? '↑ растёт' : trend.direction === 'down' ? '↓ падает' : '→ стабилен') : '—'}
              tone={trend?.direction === 'up' ? colors.danger : trend?.direction === 'down' ? colors.green : colors.textMuted}
            />
            <Metric label="Аномалии" value={String(anomalies.length)} tone={anomalies.length ? colors.danger : colors.green} />
          </section>

          {anomalies.length > 0 && (
            <div style={{ ...card, marginBottom: 12, border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.06)' }}>
              {anomalies.slice(0, 5).map((a) => (
                <div key={`${a.date}-${a.message}`} style={{ color: a.severity === 'danger' ? '#fca5a5' : '#fcd34d', fontSize: 12, padding: '4px 0' }}>
                  ⚠ <b>{a.date}</b> · {a.message}
                </div>
              ))}
            </div>
          )}

          <section style={card}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Дата', 'Время суток', 'ЧСС', 'Заметки', ''].map((t) => (
                      <th key={t} style={{ textAlign: 'left', padding: 8, color: colors.textMuted, borderBottom: `1px solid ${colors.border}` }}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr key={e.id}>
                      <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{e.date}</td>
                      <td style={{ padding: 8 }}>{e.timeOfDay === 'morning' ? '🌅 Утро' : '🌆 Вечер'}</td>
                      <td style={{ padding: 8 }}>
                        <b style={{ color: bpmTone(e.bpm) }}>{e.bpm}</b> <span style={{ color: colors.textMuted }}>уд/мин</span>
                      </td>
                      <td style={{ padding: 8, color: colors.textMuted }}>{e.notes || '—'}</td>
                      <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                        <button style={{ ...button, minHeight: 34, padding: '5px 8px' }} onClick={() => setModal({ open: true, entry: e })}>✎</button>{' '}
                        <button style={{ ...button, minHeight: 34, padding: '5px 8px', color: '#fecaca', borderColor: 'rgba(239,68,68,.35)' }} onClick={() => remove(e)}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visible.length && (
              <div style={{ textAlign: 'center', padding: 40, color: colors.textMuted }}>
                Нет записей. Добавьте ЧСС утром или вечером.
              </div>
            )}
          </section>
        </main>
        <AddPulseModal
          open={modal.open}
          onClose={() => setModal({ open: false })}
          onSave={(e) => {
            save(e, modal.entry?.id);
            setModal({ open: false });
          }}
        />
      </div>
    </div>
  );
};
