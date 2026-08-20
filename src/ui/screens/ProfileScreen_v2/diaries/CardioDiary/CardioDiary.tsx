/**
 * CardioDiary.tsx — встроенный «❤️ Кардио-дневник» Профиля (вкладка Дневники).
 * Журнал кардио-сессий (he_cardio_sessions) из cardio-diary.engine:
 * запись сессии (тип/минуты/ЧСС/RPE), статистика 7/28 дней, журнал с удалением,
 * план vs факт активного кардио-цикла (adherence текущей недели).
 * Единый источник с кардио-конструктором — записи видны и там, и здесь.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { colors, glassCard, inputStyle, labelStyle, selectStyle } from '../../ui';
import { btnBase, btnPrimary, chip, chipActive, main as pageMain, sectionTitle, statCard } from '../diary-page-styles';
import { DiaryHeader } from '../DiaryHeader';
import {
  loadCardioLog, saveCardioLogEntry, removeCardioLogEntry,
  cardioLogStats, cardioWeekAdherence, estimateCardioEntryKcal, cardioPaceMinPerKm,
  type CardioLogEntry,
} from '../../../../../engines/lms/cardio-diary.engine';
import { loadActiveCardioCycle, cardioWeekForDate, cardioCoachHints, CARDIO_PHASE_LABELS, type CardioType } from '../../../../../engines/lms/cardio.engine';
import { getWeightLog } from '../../../../../engines/profile-store';
import type { DiaryWindowProps } from '../../DiaryWindow';

const ACCENT = '#4ade80';

const HINT_COLOR: Record<string, string> = { test: '#4ade80', deload: '#fbbf24', taper: '#eab308', peak: '#f87171' };
const HINT_ICON: Record<string, string> = { test: '🔬', deload: '🧘', taper: '📉', peak: '🎭' };

const TYPES: { id: CardioType; label: string; color: string }[] = [
  { id: 'zone2', label: 'Zone 2', color: '#4ade80' },
  { id: 'miss', label: 'MISS', color: '#60a5fa' },
  { id: 'hiit', label: 'HIIT', color: '#a78bfa' },
  { id: 'recovery', label: 'Recovery', color: '#94a3b8' },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function newId(): string {
  return 'c-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
}

export const CardioDiary: React.FC<DiaryWindowProps> = ({ onClose, onDataChange }) => {
  const [log, setLog] = useState<CardioLogEntry[]>(() => loadCardioLog());
  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState<CardioType>('zone2');
  const [minutes, setMinutes] = useState('30');
  const [rpe, setRpe] = useState('');
  const [hr, setHr] = useState('');
  const [km, setKm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  const reload = useCallback(() => { setLog(loadCardioLog()); onDataChange?.(); }, [onDataChange]);

  // Загрузить запись в форму для редактирования (та же id — save заменяет).
  const startEdit = (e: CardioLogEntry) => {
    setEditingId(e.id);
    setDate(e.date);
    setType(e.type);
    setMinutes(String(e.durationMin));
    setRpe(e.rpe != null ? String(e.rpe) : '');
    setHr(e.avgHr != null ? String(e.avgHr) : '');
    setKm(e.distanceKm != null ? String(e.distanceKm) : '');
  };

  const stats7 = useMemo(() => cardioLogStats(log, 7), [log]);
  const stats28 = useMemo(() => cardioLogStats(log, 28), [log]);

  // План vs факт активного цикла: текущая неделя по дате (неделя 1 = startDate).
  const adherence = useMemo(() => {
    try {
      const cycle = loadActiveCardioCycle();
      if (!cycle) return null;
      const weekForDate = cardioWeekForDate(cycle, todayIso(), cycle.startDate);
      const currentWeek = Math.min(weekForDate ? weekForDate.week : 1, cycle.totalWeeks);
      const weekPhase = cycle.weeks.find(w => w.week === currentWeek)?.phase ?? null;
      return { cycle, weekPhase, ...cardioWeekAdherence(cycle, currentWeek, log, cycle.startDate) };
    } catch { return null; }
  }, [log]);

  // Тренерская подсказка текущей недели (замер/делод/taper/пик).
  const weekHint = useMemo(() => {
    try {
      const cycle = loadActiveCardioCycle();
      if (!cycle) return null;
      const weekForDate = cardioWeekForDate(cycle, todayIso(), cycle.startDate);
      const currentWeek = Math.min(weekForDate ? weekForDate.week : 1, cycle.totalWeeks);
      return cardioCoachHints(cycle).find(h => h.week === currentWeek && h.kind !== 'work') ?? null;
    } catch { return null; }
  }, []);

  const add = () => {
    const dur = Math.max(5, Math.min(180, Number(minutes) || 30));
    let weight: number | null = null;
    try {
      const weights = getWeightLog();
      const sorted = Array.isArray(weights) ? [...weights].filter(e => Number.isFinite(e.weight)).sort((a, b) => (a.date < b.date ? 1 : -1)) : [];
      if (sorted.length > 0) weight = sorted[0].weight;
    } catch { /* ignore */ }
    const entry: CardioLogEntry = {
      id: editingId ?? newId(), date, type, durationMin: dur, completed: true,
      rpe: Number(rpe) > 0 ? Number(rpe) : undefined,
      avgHr: Number(hr) > 0 ? Number(hr) : undefined,
      calories: estimateCardioEntryKcal(type, dur, weight ?? undefined),
      distanceKm: Number(km) > 0 ? Math.round(Number(km) * 10) / 10 : undefined,
    };
    saveCardioLogEntry(entry);
    setEditingId(null);
    reload();
    flashMsg(editingId ? '✏️ Сессия обновлена' : '💾 Сессия записана');
  };

  const remove = (id: string) => {
    removeCardioLogEntry(id);
    reload();
  };

  const csvCell = (v: unknown) => {
    const s = String(v ?? '');
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const exportCsv = () => {
    const head = 'Дата,Тип,Минуты,Км,Темп,Ккал,ЧСС ср.,RPE,Завершено\n';
    const body = log.map(e =>
      [e.date, TYPES.find(t => t.id === e.type)?.label ?? e.type, e.durationMin,
        e.distanceKm ?? '', cardioPaceMinPerKm(e.distanceKm, e.durationMin) ?? '', e.calories ?? '', e.avgHr ?? '', e.rpe ?? '',
        e.completed ? 'да' : 'нет'].map(csvCell).join(','),
    ).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + head + body], { type: 'text/csv' }));
    a.download = `cardio-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const escHtml = (v: unknown) =>
    String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);

  const printPdf = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const typeLabel = (id: CardioType) => TYPES.find(t => t.id === id)?.label ?? id;
    const rows = log.map(e =>
      `<tr><td>${escHtml(e.date)}</td><td>${escHtml(typeLabel(e.type))}</td><td>${e.durationMin}</td>` +
      `<td>${e.distanceKm != null ? e.distanceKm : ''}</td><td>${cardioPaceMinPerKm(e.distanceKm, e.durationMin) ?? ''}</td><td>${e.calories != null ? e.calories : ''}</td>` +
      `<td>${e.avgHr ?? ''}</td><td>${e.rpe ?? ''}</td></tr>`,
    ).join('');
    const html = `<!doctype html>
<meta charset="utf-8">
<title>Кардио-дневник</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #333; }
  h1 { color: #15803d; border-bottom: 2px solid #15803d; padding-bottom: 8px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin: 12px 0; }
  .card { padding: 8px 12px; border-radius: 6px; border-left: 4px solid #4ade80; background: #f0fdf4; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #15803d; color: #fff; padding: 6px; }
  td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
  @media print { body { margin: 0; } }
</style>
<h1>❤️ Кардио-дневник</h1>
<div class="summary">
  <div class="card"><b>7 дней</b><br>${stats7.sessions} сесс · ${stats7.minutes} мин${stats7.km > 0 ? ` · ${stats7.km} км` : ''}${stats7.avgPace ? ` · ${stats7.avgPace}` : ''}${stats7.kcal > 0 ? ` · ${stats7.kcal} ккал` : ''}</div>
  <div class="card"><b>28 дней</b><br>${stats28.sessions} сесс · ${stats28.minutes} мин${stats28.km > 0 ? ` · ${stats28.km} км` : ''}${stats28.avgPace ? ` · ${stats28.avgPace}` : ''}${stats28.kcal > 0 ? ` · ${stats28.kcal} ккал` : ''}</div>
  <div class="card"><b>Всего</b><br>${doneSessions} сесс · ${totalMinutes} мин</div>
</div>
<table>
  <tr><th>Дата</th><th>Тип</th><th>Минуты</th><th>Км</th><th>Темп</th><th>Ккал</th><th>ЧСС ср.</th><th>RPE</th></tr>
  ${rows}
</table>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const totalMinutes = log.reduce((s, e) => s + e.durationMin, 0);
  const doneSessions = log.filter(e => e.completed).length;

  return (
    <div style={pageMain}>
      <DiaryHeader
        accent={ACCENT}
        title="❤️ Кардио-дневник"
        count={log.length}
        countLabel="сессий"
        onClose={onClose}
        onAdd={add}
        addLabel="+ Записать сессию"
        exportActions={[
          { label: '📥 CSV-файл', onClick: exportCsv },
          { label: '🖨 Печать / PDF', onClick: printPdf },
          { label: '🗑 Очистить дневник', onClick: () => { if (log.length && window.confirm('Очистить весь кардио-дневник?')) { log.forEach(e => removeCardioLogEntry(e.id)); reload(); } }, danger: true },
        ]}
        badge={adherence ? (
          <span style={{ fontSize: 12, color: ACCENT, background: `${ACCENT}1f`, border: `1px solid ${ACCENT}55`, borderRadius: 12, padding: '3px 10px' }}>
            {adherence.cycle.name}: {adherence.doneSessions}/{adherence.plannedSessions} сессий нед {adherence.week}
          </span>
        ) : undefined}
      />

      {flash && <div style={{ color: ACCENT, fontSize: 13, fontWeight: 600, padding: '4px 2px' }} role="status">{flash}</div>}

      {weekHint && (
        <div style={{ fontSize: 12, color: HINT_COLOR[weekHint.kind] ?? 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '8px 10px', marginBottom: 12 }}>
          {HINT_ICON[weekHint.kind] ?? '💡'} Нед {weekHint.week}: {weekHint.text}
        </div>
      )}

      {adherence && (
        <div style={{ ...glassCard, padding: 12, marginBottom: 12 }}>
          <div style={{ ...labelStyle, marginBottom: 6 }}>📈 Активный цикл — план vs факт (нед {adherence.week})</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>
            {adherence.doneSessions}/{adherence.plannedSessions} сессий · {adherence.doneMinutes}/{adherence.plannedMinutes} мин ({adherence.pctMinutes}%)
          </div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
            Фаза недели: {adherence.weekPhase ? CARDIO_PHASE_LABELS[adherence.weekPhase] : '—'} · прогресс цикла: {Math.round((adherence.week / adherence.cycle.totalWeeks) * 100)}%
          </div>
        </div>
      )}

      {/* Статистика */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div style={{ ...statCard, minWidth: 130, flex: '1 1 130px' }}>
          <div style={labelStyle}>7 дней</div>
          <strong style={{ fontSize: 20, color: ACCENT }}>{stats7.sessions} сесс.</strong>
          <div style={{ fontSize: 12, color: colors.textMuted }}>{stats7.minutes} мин{stats7.km > 0 ? ` · ${stats7.km} км` : ''}{stats7.avgPace ? ` · ${stats7.avgPace}` : ''}{stats7.kcal > 0 ? ` · ${stats7.kcal} ккал` : ''}{stats7.avgRpe != null ? ` · RPE ${stats7.avgRpe}` : ''}</div>
          {stats7.avgHr != null && <div style={{ fontSize: 12, color: colors.textMuted }}>ЧСС ср. {stats7.avgHr}</div>}
        </div>
        <div style={{ ...statCard, minWidth: 130, flex: '1 1 130px' }}>
          <div style={labelStyle}>28 дней</div>
          <strong style={{ fontSize: 20, color: ACCENT }}>{stats28.sessions} сесс.</strong>
          <div style={{ fontSize: 12, color: colors.textMuted }}>{stats28.minutes} мин{stats28.km > 0 ? ` · ${stats28.km} км` : ''}{stats28.avgPace ? ` · ${stats28.avgPace}` : ''}{stats28.kcal > 0 ? ` · ${stats28.kcal} ккал` : ''}</div>
        </div>
        <div style={{ ...statCard, minWidth: 130, flex: '1 1 130px' }}>
          <div style={labelStyle}>Всего</div>
          <strong style={{ fontSize: 20, color: ACCENT }}>{doneSessions} сесс.</strong>
          <div style={{ fontSize: 12, color: colors.textMuted }}>{totalMinutes} мин</div>
        </div>
      </div>

      {/* Форма записи */}
      <div style={{ ...glassCard, padding: 14, marginBottom: 14 }}>
        <div style={sectionTitle}>✍️ Записать сессию</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>Дата</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} aria-label="Дата сессии" />
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', paddingBottom: 6 }}>
            {TYPES.map(t => (
              <button
                key={t.id}
                style={type === t.id ? { ...chipActive(ACCENT), color: t.color, borderColor: `${t.color}88` } : chip(ACCENT)}
                onClick={() => setType(t.id)}
                aria-label={`Тип: ${t.label}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>Минуты</span>
            <input value={minutes} onChange={e => setMinutes(e.target.value)} inputMode="numeric" style={{ ...inputStyle, width: 70 }} aria-label="Минуты сессии" />
          </label>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>ЧСС ср.</span>
            <input value={hr} onChange={e => setHr(e.target.value)} inputMode="numeric" style={{ ...inputStyle, width: 70 }} aria-label="ЧСС сессии" />
          </label>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>RPE 1-10</span>
            <input value={rpe} onChange={e => setRpe(e.target.value)} inputMode="numeric" style={{ ...inputStyle, width: 70 }} aria-label="RPE сессии" />
          </label>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>км</span>
            <input value={km} onChange={e => setKm(e.target.value)} inputMode="decimal" style={{ ...inputStyle, width: 70 }} aria-label="Км сессии" title="Дистанция (для бега/езды)" />
          </label>
          <button style={btnPrimary(ACCENT)} onClick={add}>{editingId ? '💾 Обновить' : '💾 Записать'}</button>
        </div>
      </div>

      {/* Журнал */}
      <div style={{ ...glassCard, padding: 14 }}>
        <div style={sectionTitle}>📓 Журнал ({log.length})</div>
        {log.length === 0 && <div style={{ fontSize: 13, color: colors.textMuted }}>Пока пусто — запишите первую кардио-сессию.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {log.slice(0, 40).map(e => {
            const t = TYPES.find(x => x.id === e.type);
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ width: 84, fontSize: 12, color: colors.textMuted }}>{e.date}</span>
                <span style={{ width: 86, fontSize: 13, fontWeight: 700, color: t?.color ?? colors.text }}>{t?.label ?? e.type}</span>
                <span style={{ fontSize: 12, color: colors.text }}>{e.durationMin} мин</span>
                {e.calories != null && e.calories > 0 && <span style={{ fontSize: 12, color: colors.textMuted }}>{e.calories} ккал</span>}
                {e.distanceKm != null && e.distanceKm > 0 && (
                  <>
                    <span style={{ fontSize: 12, color: colors.textMuted }}>{e.distanceKm} км</span>
                    <span style={{ fontSize: 12, color: colors.textMuted }}>{cardioPaceMinPerKm(e.distanceKm, e.durationMin)}</span>
                  </>
                )}
                {e.avgHr != null && <span style={{ fontSize: 12, color: colors.textMuted }}>{e.avgHr} уд</span>}
                {e.rpe != null && <span style={{ fontSize: 12, color: colors.textMuted }}>RPE {e.rpe}</span>}
                {!e.completed && <span style={{ fontSize: 11, color: colors.warning }}>пропущена</span>}
                <span style={{ flex: 1 }} />
                <button
                  onClick={() => startEdit(e)}
                  aria-label={`Редактировать ${e.date}`}
                  style={{ ...btnBase(ACCENT), minHeight: 30, padding: '4px 9px', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)' }}
                >
                  ✎
                </button>
                <button
                  onClick={() => { if (editingId === e.id) setEditingId(null); remove(e.id); }}
                  aria-label={`Удалить ${e.date}`}
                  style={{ ...btnBase(ACCENT), minHeight: 30, padding: '4px 9px', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        {log.length > 40 && <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>Показаны последние 40 записей.</div>}
      </div>
    </div>
  );
};
