/**
 * CardioDiary.tsx — встроенный «❤️ Кардио-дневник» Профиля (вкладка Дневники).
 * Журнал кардио-сессий (he_cardio_sessions) из cardio-diary.engine:
 * запись сессии (тип/минуты/ЧСС/RPE), статистика 7/28 дней, журнал с удалением,
 * план vs факт активного кардио-цикла (adherence текущей недели).
 * Единый источник с кардио-конструктором — записи видны и там, и здесь.
 */
import React, { useCallback, useMemo, useState, useRef } from 'react';
import { colors, glassCard, inputStyle, labelStyle, selectStyle } from '../../ui';
import { btnBase, btnPrimary, chip, chipActive, diaryShell, header as diaryHeaderStyle, glassSection, heroCard, main as pageMain, sectionTitle, statCard, tableTh, tableTd } from '../diary-page-styles';
import { DiaryHeader } from '../DiaryHeader';
import {
  loadCardioLog, saveCardioLogEntry, removeCardioLogEntry,
  cardioLogStats, cardioWeekAdherence, estimateCardioEntryKcal, cardioPaceMinPerKm,
  validateCardioLogFields, cardioHrCompliance,
  type CardioLogEntry,
} from '../../../../../engines/lms/cardio-diary.engine';
import { loadActiveCardioCycle, cardioWeekForDate, cardioCoachHints, cardioLegDayForDate, CARDIO_PHASE_LABELS, type CardioType } from '../../../../../engines/lms/cardio.engine';
import { getWeightLog } from '../../../../../engines/profile-store';
import { buildWeeklyHistogram, computeDistribution, computeExtremes, computeStreak, escapeHtml } from '../../diary-helpers';
import type { DiaryWindowProps } from '../../DiaryWindow';
import { parseCardioImport, CARDIO_IMPORT_INSTRUCTIONS } from '../../../../../engines/cardio-import.engine';

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

export const CardioDiary: React.FC<DiaryWindowProps> = ({ open, onClose, onDataChange }) => {
  const [log, setLog] = useState<CardioLogEntry[]>(() => loadCardioLog());
  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState<CardioType>('zone2');
  const [minutes, setMinutes] = useState('30');
  const [rpe, setRpe] = useState('');
  const [hr, setHr] = useState('');
  const [km, setKm] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [undo, setUndo] = useState<CardioLogEntry[] | null>(null);
  const [range, setRange] = useState<'all' | '7' | '30' | '90'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [importPreview, setImportPreview] = useState<{ entries: CardioLogEntry[]; warnings: string[]; format: string; fileName: string } | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  const reload = useCallback(() => { setLog(loadCardioLog()); onDataChange?.(); }, [onDataChange]);

  const handleImportFile = async (file: File) => {
    const lowName = file.name.toLowerCase();
    const isBinary = lowName.endsWith('.zip') || lowName.endsWith('.fit');
    setImportBusy(true);
    try {
      let parsed: ReturnType<typeof parseCardioImport>;
      if (isBinary) {
        const buf = await file.arrayBuffer();
        parsed = parseCardioImport(file.name, buf);
      } else {
        const text = await file.text();
        parsed = parseCardioImport(file.name, text);
      }
      if (parsed.entries.length === 0) {
        flashMsg(`⚠️ Импорт не удался: ${parsed.warnings[0] || 'нет записей'}`);
        setImportPreview({ entries: [], warnings: parsed.warnings, format: parsed.format, fileName: file.name });
      } else {
        setImportPreview({ entries: parsed.entries, warnings: parsed.warnings, format: parsed.format, fileName: file.name });
        flashMsg(`📥 Распознано ${parsed.entries.length} тренировок (${parsed.format}) — проверьте превью`);
      }
    } catch (e) {
      flashMsg(`⚠️ Ошибка чтения файла: ${(e as Error).message}`);
    } finally {
      setImportBusy(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };
  const confirmImport = () => {
    if (!importPreview || importPreview.entries.length === 0) return;
    const prev = loadCardioLog();
    setUndo(prev);
    for (const e of importPreview.entries) saveCardioLogEntry(e);
    reload();
    flashMsg(`✅ Импортировано ${importPreview.entries.length} тренировок`);
    setImportPreview(null);
  };

  // Загрузить запись в форму для редактирования (та же id — save заменяет).
  const startEdit = (e: CardioLogEntry) => {
    setEditingId(e.id);
    setDate(e.date);
    setType(e.type);
    setMinutes(String(e.durationMin));
    setRpe(e.rpe != null ? String(e.rpe) : '');
    setHr(e.avgHr != null ? String(e.avgHr) : '');
    setKm(e.distanceKm != null ? String(e.distanceKm) : '');
    setNotes(e.notes ?? '');
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

  // Дни тяжёлых ног активного цикла: Set дат журнала-дней ног + «сегодня».
  const activeCycle = useMemo(() => { try { return loadActiveCardioCycle(); } catch { return null; } }, []);
  const legDayDates = useMemo(() => {
    const s = new Set<string>();
    if (!activeCycle) return s;
    for (const e of log) { const info = cardioLegDayForDate(activeCycle, e.date); if (info?.isLegDay) s.add(e.date); }
    return s;
  }, [activeCycle, log]);
  const todayLegDay = useMemo(() => (activeCycle ? cardioLegDayForDate(activeCycle, todayIso()) : null), [activeCycle]);

  const warnings = useMemo(() => validateCardioLogFields({ rpe, hr, km, minutes }), [rpe, hr, km, minutes]);

  // Фильтр по периоду/поиску + пагинация (консистентно с остальными дневниками)
  const filteredLog = useMemo(() => {
    let out = log;
    if (range !== 'all') {
      const days = Number(range);
      const cutoff = new Date();
      cutoff.setHours(0, 0, 0, 0);
      cutoff.setDate(cutoff.getDate() - (days - 1));
      const cutoffIso = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
      out = out.filter(e => e.date >= cutoffIso);
    }
    const q = query.trim().toLowerCase();
    if (q) out = out.filter(e => e.date.includes(q) || e.type.toLowerCase().includes(q) || String(e.notes ?? '').toLowerCase().includes(q));
    return out;
  }, [log, range, query]);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredLog.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredLog.slice((safePage - 1) * pageSize, safePage * pageSize);

  const hrCompliance = useMemo(() => {
    if (!activeCycle) return null;
    try { return cardioHrCompliance(activeCycle, log, { days: 28 }); } catch { return null; }
  }, [activeCycle, log]);

  const weeklyHistogram = useMemo(() => buildWeeklyHistogram(log.map(e => ({ date: e.date, value: e.durationMin }))), [log]);
  const distribution = useMemo(() => computeDistribution(log.filter(e => e.completed).map(e => e.durationMin)), [log]);
  const extremes = useMemo(() => {
    if (log.length === 0) return { min: null, max: null } as { min: { date: string; value: number } | null; max: { date: string; value: number } | null };
    let min: { date: string; value: number } | null = null;
    let max: { date: string; value: number } | null = null;
    for (const e of log) {
      const v = e.durationMin;
      if (!Number.isFinite(v)) continue;
      if (!min || v < min.value) min = { date: e.date, value: v };
      if (!max || v > max.value) max = { date: e.date, value: v };
    }
    return { min, max };
  }, [log]);
  const streak = useMemo(() => computeStreak(log.filter(e => e.completed).map(e => ({ date: e.date }))), [log]);

  const add = () => {
    const w = validateCardioLogFields({ rpe, hr, km, minutes, notes });
    if (Object.keys(w).length) {
      const msg = Object.values(w).join(' · ');
      flashMsg(`⚠ ${msg}`);
      // не блокируем — сохраняем клампнутые значения, но подсвечиваем проблему
    }
    // Унифицированный кламп 1–600 мин (как в validateCardioLogFields), было 5–180
    const rawDur = Number(String(minutes).replace(',', '.'));
    const dur = Number.isFinite(rawDur) ? Math.max(1, Math.min(600, Math.round(rawDur))) : 30;
    if (dur < 1 || dur > 600) {
      flashMsg('⚠ Длительность 1–600 мин');
      return;
    }
    let weight: number | null = null;
    try {
      const weights = getWeightLog();
      const sorted = Array.isArray(weights) ? [...weights].filter(e => Number.isFinite(e.weight)).sort((a, b) => (a.date < b.date ? 1 : -1)) : [];
      if (sorted.length > 0) weight = sorted[0].weight;
    } catch { /* ignore */ }
    const entry: CardioLogEntry = {
      id: editingId ?? newId(), date, type, durationMin: dur, completed: true,
      rpe: Number(String(rpe).replace(',', '.')) > 0 ? Math.max(1, Math.min(10, Math.round(Number(String(rpe).replace(',', '.'))))) : undefined,
      avgHr: Number(String(hr).replace(',', '.')) > 0 ? Math.max(20, Math.min(260, Math.round(Number(String(hr).replace(',', '.'))))) : undefined,
      calories: estimateCardioEntryKcal(type, dur, weight ?? undefined),
      distanceKm: Number(String(km).replace(',', '.')) > 0 ? Math.max(0, Math.min(200, Math.round(Number(String(km).replace(',', '.')) * 10) / 10)) : undefined,
      notes: notes.trim() ? notes.trim().slice(0, 300) : undefined,
    };
    setUndo(log);
    saveCardioLogEntry(entry);
    setEditingId(null);
    setNotes('');
    reload();
    flashMsg(editingId ? '✏️ Сессия обновлена' : '💾 Сессия записана');
  };

  const remove = (id: string) => {
    setUndo(log);
    removeCardioLogEntry(id);
    reload();
  };

  // Откат последнего изменения (добавление/обновление/удаление).
  const restoreUndo = () => {
    if (!undo) return;
    try { localStorage.setItem('he_cardio_sessions', JSON.stringify(undo)); } catch { /* ignore */ }
    setUndo(null);
    reload();
    flashMsg('↩ Изменение отменено');
  };

  const csvCell = (v: unknown) => {
    const s = String(v ?? '');
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const exportCsv = () => {
    const head = 'Дата,Тип,Минуты,Км,Темп,Ккал,ЧСС ср.,RPE,День ног,Заметка,Завершено\n';
    const body = log.map(e =>
      [e.date, TYPES.find(t => t.id === e.type)?.label ?? e.type, e.durationMin,
        e.distanceKm ?? '', cardioPaceMinPerKm(e.distanceKm, e.durationMin) ?? '', e.calories ?? '', e.avgHr ?? '', e.rpe ?? '',
        legDayDates.has(e.date) ? 'да' : '', e.notes ?? '', e.completed ? 'да' : 'нет'].map(csvCell).join(','),
    ).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + head + body], { type: 'text/csv' }));
    a.download = `cardio-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const printPdf = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const typeLabel = (id: CardioType) => TYPES.find(t => t.id === id)?.label ?? id;
    const rows = log.map(e =>
      `<tr><td>${escapeHtml(e.date)}</td><td>${escapeHtml(typeLabel(e.type))}</td><td>${e.durationMin}</td>` +
      `<td>${e.distanceKm != null ? e.distanceKm : ''}</td><td>${cardioPaceMinPerKm(e.distanceKm, e.durationMin) ?? ''}</td><td>${e.calories != null ? e.calories : ''}</td>` +
      `<td>${e.avgHr ?? ''}</td><td>${e.rpe ?? ''}</td><td>${legDayDates.has(e.date) ? '🦵' : ''}</td><td>${escapeHtml(e.notes ?? '')}</td></tr>`,
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
  <tr><th>Дата</th><th>Тип</th><th>Минуты</th><th>Км</th><th>Темп</th><th>Ккал</th><th>ЧСС ср.</th><th>RPE</th><th>День ног</th><th>Заметка</th></tr>
  ${rows}
</table>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const totalMinutes = log.reduce((s, e) => s + e.durationMin, 0);
  const doneSessions = log.filter(e => e.completed).length;

  if (open === false) return null;

  return (
    <div className="cardio-window diary-scrollbar" style={{ ...diaryShell(ACCENT), background: `radial-gradient(1000px 560px at 14% -12%, rgba(74,222,128,0.14), transparent 64%), radial-gradient(760px 460px at 100% -6%, rgba(74,222,128,0.08), transparent 58%), radial-gradient(900px 520px at 50% 118%, rgba(255,255,255,0.04), transparent 62%), #08080a` }}>
      <style>{`
        .cardio-window button { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; }
        .cardio-window::-webkit-scrollbar { width: 10px; height: 10px; }
        .cardio-window::-webkit-scrollbar-track { background: transparent; }
        .cardio-window::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
        .cardio-window::-webkit-scrollbar-thumb:hover { background: rgba(74,222,128,0.38); background-clip: content-box; }
        .diary-card { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
        .diary-card:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.06); }
      `}</style>
      <DiaryHeader
        accent={ACCENT}
        title="❤️ Кардио-дневник"
        count={log.length}
        countLabel="сессий"
        onClose={onClose}
        onAdd={add}
        addLabel="+ Записать сессию"
        onToday={() => { setDate(todayIso()); setEditingId(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        todayLabel="⚡ Сегодня"
        exportActions={[
          { label: '📥 CSV-файл', onClick: exportCsv },
          { label: '🖨 Печать / PDF', onClick: printPdf },
          { label: '🗑 Очистить дневник', onClick: () => { if (log.length && window.confirm('Очистить весь кардио-дневник?')) { log.forEach(e => removeCardioLogEntry(e.id)); reload(); } }, danger: true },
        ]}
        badge={adherence ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, background: `${ACCENT}14`, border: `1px solid ${ACCENT}30`, borderRadius: 999, padding: '3px 10px', letterSpacing: '0.2px' }}>
            {adherence.cycle.name}: {adherence.doneSessions}/{adherence.plannedSessions} · нед {adherence.week}
          </span>
        ) : undefined}
        undoActive={!!undo}
        onUndo={restoreUndo}
        undoLabel="↩ Отменить запись"
      />
      <div style={{ ...pageMain, paddingBottom: 72 }}>

      {flash && <div style={{ color: ACCENT, fontSize: 13, fontWeight: 700, padding: '8px 10px', marginTop: 6, background: `${ACCENT}10`, border: `1px solid ${ACCENT}22`, borderRadius: 10 }} role="status">{flash}</div>}

      {weekHint && (
        <div style={{ fontSize: 12, fontWeight: 600, color: HINT_COLOR[weekHint.kind] ?? 'rgba(255,255,255,0.78)', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, padding: '10px 12px', marginTop: 12, marginBottom: 12, boxShadow: '0 4px 18px rgba(0,0,0,0.18)' }}>
          {HINT_ICON[weekHint.kind] ?? '💡'} Нед {weekHint.week}: {weekHint.text}
        </div>
      )}

      {adherence && (
        <div className="diary-card" style={{ ...heroCard(ACCENT), padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>📈 Активный цикл — план vs факт · нед {adherence.week}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>
            {adherence.doneSessions}/{adherence.plannedSessions} сессий · {adherence.doneMinutes}/{adherence.plannedMinutes} мин <span style={{ fontWeight: 600, color: ACCENT, fontSize: 14 }}>· {adherence.pctMinutes}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginTop: 8 }}>
            <div style={{ height: '100%', width: `${Math.max(6, Math.min(100, adherence.pctMinutes))}%`, background: ACCENT, borderRadius: 999, boxShadow: `0 0 10px ${ACCENT}66`, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
            Фаза: {adherence.weekPhase ? CARDIO_PHASE_LABELS[adherence.weekPhase] : '—'} · прогресс цикла {Math.round((adherence.week / adherence.cycle.totalWeeks) * 100)}%
          </div>
        </div>
      )}
      {hrCompliance && hrCompliance.checks.length > 0 && hrCompliance.advice && (
        <div style={{ ...glassCard, padding: 12, marginBottom: 12, borderColor: 'rgba(74,222,128,0.35)' }}>
          <div style={{ ...labelStyle, marginBottom: 6 }}>🎯 Пульс по факту (28д, n={hrCompliance.checks.length}, в зоне {hrCompliance.inZonePct}%)</div>
          <div style={{ fontSize: 12, color: colors.textMuted }}>{hrCompliance.advice}</div>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>Среднее отклонение: {hrCompliance.avgDelta != null ? `${hrCompliance.avgDelta > 0 ? '+' : ''}${hrCompliance.avgDelta} уд` : '—'}</div>
        </div>
      )}

      {/* Статистика — премиум */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
        {[
          { label: '7 дней', val: `${stats7.sessions} сесс.`, sub: `${stats7.minutes} мин${stats7.km > 0 ? ` · ${stats7.km} км` : ''}${stats7.avgPace ? ` · ${stats7.avgPace}` : ''}${stats7.kcal > 0 ? ` · ${stats7.kcal} ккал` : ''}${stats7.avgRpe != null ? ` · RPE ${stats7.avgRpe}` : ''}${stats7.avgHr != null ? ` · ЧСС ${stats7.avgHr}` : ''}` },
          { label: '28 дней', val: `${stats28.sessions} сесс.`, sub: `${stats28.minutes} мин${stats28.km > 0 ? ` · ${stats28.km} км` : ''}${stats28.avgPace ? ` · ${stats28.avgPace}` : ''}${stats28.kcal > 0 ? ` · ${stats28.kcal} ккал` : ''}` },
          { label: 'Всего', val: `${doneSessions} сесс.`, sub: `${totalMinutes} мин` },
        ].map((c) => (
          <div key={c.label} className="diary-card" style={{ ...statCard, background: `linear-gradient(135deg, ${ACCENT}12, transparent 68%), rgba(28,28,32,0.74)`, borderLeft: `2px solid ${ACCENT}88`, position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `radial-gradient(420px 90px at 14% 0%, ${ACCENT}12, transparent 62%)`, pointerEvents: 'none' }} />
            <div style={{ ...labelStyle, position: 'relative', color: 'rgba(255,255,255,0.44)', fontWeight: 700 }}>{c.label}</div>
            <strong style={{ fontSize: 20, color: ACCENT, position: 'relative', letterSpacing: '-0.3px' }}>{c.val}</strong>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', position: 'relative', marginTop: 2, lineHeight: 1.35 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {weeklyHistogram.length > 0 && (() => {
        const maxMean = Math.max(...weeklyHistogram.map(x => x.mean), 1);
        return (
          <div style={{ ...glassCard, padding: 12, marginBottom: 12 }}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>📊 Недельная гистограмма (мин/нед)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {weeklyHistogram.slice(-8).map(w => (
                <div key={w.weekStart} title={`${w.weekStart}: ${w.mean.toFixed(0)} мин, ${w.count} сесс`} style={{ flex: '1 1 80px', textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 62 }}>
                  <div style={{ height: `${Math.max(8, (w.mean / maxMean) * 30)}px`, background: `linear-gradient(180deg, ${ACCENT}, #16a34a)`, borderRadius: 4, marginBottom: 4, opacity: 0.9 }} />
                  <div style={{ fontSize: 10, color: colors.textMuted }}>{w.weekStart.slice(5)}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>{w.mean.toFixed(0)}</div>
                  <div style={{ fontSize: 10, color: colors.textMuted }}>{w.count} сесс</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {(distribution || streak.current > 0) && (
        <div style={{ ...glassCard, padding: 12, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {distribution && (
            <div style={{ flex: '1 1 140px' }}>
              <div style={labelStyle}>Распределение (мин)</div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>ср {distribution.mean.toFixed(0)} · мед {distribution.median.toFixed(0)} · σ {distribution.stdDev.toFixed(1)}</div>
              <div style={{ fontSize: 11, color: colors.textMuted }}>мин {distribution.min} · макс {distribution.max}</div>
            </div>
          )}
          <div style={{ flex: '1 1 100px' }}>
            <div style={labelStyle}>Серия</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: streak.current >= 3 ? ACCENT : colors.textMuted }}>{streak.current} дн. подряд</div>
            <div style={{ fontSize: 11, color: colors.textMuted }}>лучшая {streak.best} · всего {streak.totalDays}д</div>
          </div>
          {extremes && extremes.min && extremes.max && (
            <div style={{ flex: '1 1 140px' }}>
              <div style={labelStyle}>Экстремумы</div>
              <div style={{ fontSize: 11, color: colors.textMuted }}>мин {extremes.min.value} ({extremes.min.date.slice(5)})</div>
              <div style={{ fontSize: 11, color: colors.textMuted }}>макс {extremes.max.value} ({extremes.max.date.slice(5)})</div>
            </div>
          )}
        </div>
      )}

      {/* Форма записи — премиум */}
      <div className="diary-card" style={{ ...glassCard, padding: 15, marginBottom: 14, border: `1px solid ${ACCENT}22`, background: `linear-gradient(135deg, ${ACCENT}0f, transparent 68%), rgba(28,28,32,0.74)` }}>
        <div style={{ ...sectionTitle, color: ACCENT, marginBottom: 10 }}>✍️ Записать сессию</div>
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
            <input value={minutes} onChange={e => setMinutes(e.target.value)} inputMode="numeric" style={{ ...inputStyle, width: 70, borderColor: warnings.minutes ? '#f87171' : undefined }} aria-label="Минуты сессии" />
          </label>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>ЧСС ср.</span>
            <input value={hr} onChange={e => setHr(e.target.value)} inputMode="numeric" style={{ ...inputStyle, width: 70, borderColor: warnings.hr ? '#f87171' : undefined }} aria-label="ЧСС сессии" />
          </label>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>RPE 1-10</span>
            <input value={rpe} onChange={e => setRpe(e.target.value)} inputMode="numeric" style={{ ...inputStyle, width: 70, borderColor: warnings.rpe ? '#f87171' : undefined }} aria-label="RPE сессии" />
          </label>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>км</span>
            <input value={km} onChange={e => setKm(e.target.value)} inputMode="decimal" style={{ ...inputStyle, width: 70, borderColor: warnings.km ? '#f87171' : undefined }} aria-label="Км сессии" title="Дистанция (для бега/езды)" />
          </label>
          <label style={{ display: 'block', flex: '1 1 180px', minWidth: 160 }}>
            <span style={labelStyle}>Заметка</span>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Самочувствие, погода, интервалы…" style={{ ...inputStyle, width: '100%' }} aria-label="Заметка сессии" maxLength={300} />
          </label>
          <button style={btnPrimary(ACCENT)} onClick={add}>{editingId ? '💾 Обновить' : '💾 Записать'}</button>
          {editingId && (
            <button style={{ ...btnBase(ACCENT), background: 'rgba(255,255,255,0.06)' }} onClick={() => { setEditingId(null); setNotes(''); }}>
              ✕ Отмена
            </button>
          )}
        </div>
        {Object.keys(warnings).length > 0 && (
          <div role="alert" style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5', fontSize: 12 }}>
            {Object.entries(warnings).map(([k, v]) => <div key={k}>⚠ {v}</div>)}
          </div>
        )}
        {todayLegDay?.isLegDay && (
          <div role="status" style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#fcd34d', fontSize: 12 }}>
            🦵 Сегодня день тяжёлых ног — интенсивное кардио лучше перенести (recovery — можно)
          </div>
        )}
      </div>

      {/* Импорт с часов — Apple / Huawei / Samsung / Garmin / Polar / Xiaomi */}
      <div className="diary-card" style={{ ...glassCard, padding: 15, marginBottom: 14, border: `1px solid ${ACCENT}18`, background: `linear-gradient(135deg, ${ACCENT}08, transparent 70%), rgba(28,28,32,0.74)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ ...sectionTitle, color: ACCENT, marginBottom: 0 }}>⌚ Импорт с часов</div>
          <span style={{ fontSize: 11, color: colors.textMuted }}>Apple Watch · Huawei · Samsung · Garmin · Polar · Suunto · Fitbit · Xiaomi</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: colors.textMuted }}>CSV · TCX · GPX · Apple export.xml · JSON · FIT</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input ref={importInputRef} type="file" accept=".csv,.tcx,.gpx,.xml,.json,.fit,.zip" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }} />
          <button style={btnPrimary(ACCENT)} disabled={importBusy} onClick={() => importInputRef.current?.click()}>
            {importBusy ? '⏳ Чтение…' : '📥 Выбрать файл'}
          </button>
          <button style={btnBase(ACCENT)} onClick={() => setShowImportHelp(v => !v)}>{showImportHelp ? 'Скрыть справку' : 'ℹ️ Как экспортировать'}</button>
          {importPreview && importPreview.entries.length > 0 && (
            <button style={{ ...btnBase(ACCENT), background: ACCENT, color: '#07130e', fontWeight: 800 }} onClick={confirmImport}>
              ✅ Импортировать {importPreview.entries.length} тренировок
            </button>
          )}
          {importPreview && (
            <button style={btnBase(ACCENT)} onClick={() => setImportPreview(null)}>✕ Очистить превью</button>
          )}
        </div>
        {importPreview && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: importPreview.entries.length ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${importPreview.entries.length ? 'rgba(74,222,128,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: importPreview.entries.length ? '#4ade80' : '#f87171', marginBottom: 6 }}>
              {importPreview.fileName} → {importPreview.format} · найдено {importPreview.entries.length} тренировок
            </div>
            {importPreview.warnings.length > 0 && (
              <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 6 }}>
                {importPreview.warnings.slice(0, 4).map((w, i) => <div key={i}>⚠ {w}</div>)}
                {importPreview.warnings.length > 4 && <div>… и ещё {importPreview.warnings.length - 4}</div>}
              </div>
            )}
            {importPreview.entries.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                {importPreview.entries.slice(0, 5).map(e => (
                  <div key={e.id} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: colors.textMuted }}>{e.date}</span>
                    <span style={{ fontWeight: 700, color: TYPES.find(t=>t.id===e.type)?.color || ACCENT }}>{TYPES.find(t=>t.id===e.type)?.label || e.type}</span>
                    <span>{e.durationMin} мин</span>
                    {e.distanceKm && <span>{e.distanceKm} км</span>}
                    {e.avgHr && <span>{e.avgHr} уд</span>}
                    {e.calories && <span>{e.calories} ккал</span>}
                    {e.notes && <span style={{ color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{e.notes}</span>}
                  </div>
                ))}
                {importPreview.entries.length > 5 && <div style={{ fontSize: 11, color: colors.textMuted }}>… и ещё {importPreview.entries.length - 5} тренировок</div>}
              </div>
            )}
          </div>
        )}
        {showImportHelp && (
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {CARDIO_IMPORT_INSTRUCTIONS.map(b => (
              <details key={b.brand} style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13, color: ACCENT }}>{b.brand} — {b.formats.join(', ')}</summary>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: colors.textMuted, lineHeight: 1.5 }}>
                  {b.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </details>
            ))}
            <div style={{ fontSize: 11, color: colors.textMuted, padding: 8, borderRadius: 8, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
              💡 CSV — самый надёжный: экспортируйте таблицу из приложения часов (Huawei Health / Samsung Health / Fitbit / Zepp) и загрузите её. TCX/GPX — для треков с GPS, Apple export.xml — весь архив Здоровья.
            </div>
          </div>
        )}
      </div>

      {/* Журнал — фильтры как в остальных дневниках */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        {(['all', '7', '30', '90'] as const).map(r => (
          <button key={r} style={range === r ? chipActive(ACCENT) : chip(ACCENT)} onClick={() => { setRange(r); setPage(1); }}>{r === 'all' ? 'Всё' : `${r}д`}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input style={{ ...inputStyle, width: 180, paddingRight: query ? 30 : undefined }} placeholder="🔍 Поиск" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />
          {query && (
            <button onClick={() => { setQuery(''); setPage(1); }} aria-label="Очистить поиск" style={{ position: 'absolute', right: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: colors.textMuted, cursor: 'pointer', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✕</button>
          )}
        </div>
      </div>
      <div className="diary-card" style={{ ...glassCard, padding: 15 }}>
        <div style={{ ...sectionTitle, marginBottom: 10 }}>📓 Журнал <span style={{ color: ACCENT, fontWeight: 800 }}>{filteredLog.length}</span><span style={{ color: 'rgba(255,255,255,0.38)', fontWeight: 500 }}>/{log.length}</span></div>
        {filteredLog.length === 0 && <div style={{ fontSize: 13, color: colors.textMuted }}>{log.length === 0 ? 'Пока пусто — запишите первую кардио-сессию.' : 'Нет записей по фильтру.'}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pageItems.map(e => {
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
                {e.notes && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.notes}>{e.notes}</span>}
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
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
            <button style={btnBase(ACCENT)} disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>←</button>
            <span style={{ fontSize: 12, color: colors.textMuted }}>{safePage} / {totalPages} · {filteredLog.length} зап.</span>
            <button style={btnBase(ACCENT)} disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>→</button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
