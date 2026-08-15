/**
 * MindsetTab.tsx — вкладка «🧠 Психология» дневника тренировок.
 *
 * Пользователь собирает личный ментальный протокол из библиотеки ритуалов
 * (источник — mindset-методики Библиотеки) и кастомных шагов, привязывает шаги
 * к типам дня (тяжёлый/памп/соревнование/делод). Протокол отображается в сессии
 * (SessionPlayer) до/во время/после тренировки; чек-ины копятся и дают тренды
 * уверенности/активации/фокуса + связь с e1RM сессий.
 *
 * Отображение-онли: вкладка НЕ влияет на планирование/авторегуляцию.
 */
import React, { useCallback, useMemo, useState } from 'react';
import type { DiaryHubCtx } from './diary-hub-context';
import { ACCENT, DIM, diaryCard, diaryInput } from './diary-tokens';
import { MiniLineChart } from './DiaryChart';
import {
  RITUAL_LIBRARY, KIND_ORDER, KIND_LABELS, DAYTYPE_LABELS, DIRECTION_LABELS, PRESET_LABELS,
  buildPresetProtocol, ritualToItem, detectDayType, itemsForDay,
  loadProtocols, upsertProtocol, deleteProtocol, duplicateProtocol, createProtocol,
  loadActiveProtocol, setActiveProtocol,
  loadCheckins, upsertCheckin, latestCheckin,
  mindsetTrends, protocolAdherence,
  sessionsBestE1RM, correlateConfidenceWithPerformance, buildMindsetInsights,
  MOOD_TAGS, MOOD_LABELS, loadMoods, upsertMood, latestMood, moodTrends,
  detectMotivationPhase, psychProfileInsights,
  type MindsetProtocol, type ProtocolItem, type ProtocolItemKind, type MindsetDayType, type MindsetDirection,
  type MoodTag,
} from '../../../engines/mindset-protocol.engine';

const CARD = diaryCard;
const IN = diaryInput;

const KIND_ICON: Record<ProtocolItemKind, string> = { pre: '🌅', approach: '🎯', post: '🌙' };
const KIND_COLOR: Record<ProtocolItemKind, string> = { pre: '#60a5fa', approach: '#f59e0b', post: '#a78bfa' };
const DAYTYPE_COLOR: Record<MindsetDayType, string> = {
  all: '#60a5fa', heavy: '#ef4444', pump: '#00e68a', competition: '#f59e0b', deload: '#38bdf8',
};
const DIRECTION_ICON: Record<MindsetDirection, string> = { pl: '🏆', bb: '💪', both: '🌐' };

const SCALE_LABELS: Record<'confidence' | 'arousal' | 'focus', { label: string; hint: string; color: string }> = {
  confidence: { label: 'Уверенность', hint: 'насколько веришь в план и веса сегодня', color: '#00e68a' },
  arousal: { label: 'Активация', hint: '1 = вялость, 5 = перевозбуждение', color: '#f59e0b' },
  focus: { label: 'Фокус', hint: 'концентрация на подходах', color: '#60a5fa' },
};

const ScaleRow: React.FC<{ label: string; hint: string; value: number; onChange: (v: number) => void }> = ({ label, hint, value, onChange }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{label}</span>
      <span style={{ fontSize: 9, color: DIM }}>{hint}</span>
    </div>
    <div style={{ display: 'flex', gap: 4, marginTop: 4 }} role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map(v => (
        <button key={v} type="button" role="radio" aria-checked={value === v}
          aria-label={`${label} ${v}`}
          onClick={() => onChange(v)}
          style={{
            flex: 1, minHeight: 36, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            border: value === v ? '1px solid rgba(0,230,138,0.5)' : '1px solid var(--border)',
            background: value === v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
            color: value === v ? ACCENT : 'var(--text-dim)',
          }}>
          {v}
        </button>
      ))}
    </div>
  </div>
);

export const MindsetTab: React.FC<{ hub: DiaryHubCtx }> = ({ hub }) => {
  const [protocols, setProtocols] = useState<MindsetProtocol[]>(() => loadProtocols());
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveProtocol()?.id || null);
  const [tick, setTick] = useState(0);
  const [previewDay, setPreviewDay] = useState<MindsetDayType>('heavy');
  const [libOpen, setLibOpen] = useState(false);
  const [libSearch, setLibSearch] = useState('');
  const [libKind, setLibKind] = useState<'all' | ProtocolItemKind>('all');
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<{ title: string; script: string; kind: ProtocolItemKind; durationMin: number; targetDays: MindsetDayType[] }>({
    title: '', script: '', kind: 'pre', durationMin: 1, targetDays: ['all'],
  });
  const [checkin, setCheckin] = useState(() => {
    const last = latestCheckin();
    return {
      confidence: last?.confidence || 4,
      arousal: last?.arousal || 3,
      focus: last?.focus || 4,
      protocolFollowed: last?.protocolFollowed ?? true as boolean | null,
      note: '',
    };
  });
  const [checkinSaved, setCheckinSaved] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // ── Настроение (mood-лог) ──
  const [mood, setMood] = useState(() => {
    const last = latestMood();
    return { value: last?.mood || 3, tags: (last?.tags || []) as MoodTag[], note: '' };
  });
  const [moodSaved, setMoodSaved] = useState(false);

  const active = useMemo(() => protocols.find(p => p.id === activeId) || null, [protocols, activeId]);

  const refresh = useCallback(() => {
    setProtocols(loadProtocols());
    setActiveId(loadActiveProtocol()?.id || null);
    setTick(t => t + 1);
  }, []);

  const persist = useCallback((p: MindsetProtocol) => {
    const list = upsertProtocol(p);
    setProtocols(list);
    setActiveId(p.id);
    setActiveProtocol(p.id);
  }, []);

  const selectActive = useCallback((id: string) => {
    setActiveId(id);
    setActiveProtocol(id);
  }, []);

  const applyPreset = useCallback((dir: MindsetDirection) => {
    const p = buildPresetProtocol(dir);
    const list = upsertProtocol(p);
    setProtocols(list);
    setActiveId(p.id);
    setActiveProtocol(p.id);
  }, []);

  const createEmpty = useCallback(() => {
    const p = createProtocol('Мой протокол', 'both');
    const list = upsertProtocol(p);
    setProtocols(list);
    setActiveId(p.id);
    setActiveProtocol(p.id);
  }, []);

  const removeProtocol = useCallback((id: string) => {
    const list = deleteProtocol(id);
    setProtocols(list);
    setActiveId(list.length > 0 ? list[0].id : null);
    if (list.length > 0) setActiveProtocol(list[0].id);
  }, []);

  const dupProtocol = useCallback((id: string) => {
    setProtocols(duplicateProtocol(id));
  }, []);

  // ── Импорт протокола из JSON (бэкап/перенос) ──
  const importProtocol = useCallback(() => {
    setImportError(null);
    try {
      const raw = JSON.parse(importText);
      const list = upsertProtocol({ ...raw, id: `proto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const imported = list[list.length - 1];
      setProtocols(list);
      setActiveId(imported.id);
      setActiveProtocol(imported.id);
      setImportOpen(false);
      setImportText('');
    } catch {
      setImportError('Не удалось разобрать JSON — проверьте содержимое файла');
    }
  }, [importText]);

  // ── Правка активного протокола ──
  const patchProtocol = useCallback((patch: Partial<MindsetProtocol>) => {
    if (!active) return;
    persist({ ...active, ...patch });
  }, [active, persist]);

  const updateItem = useCallback((idx: number, patch: Partial<ProtocolItem>) => {
    if (!active) return;
    const items = active.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    persist({ ...active, items });
  }, [active, persist]);

  const removeItem = useCallback((idx: number) => {
    if (!active) return;
    persist({ ...active, items: active.items.filter((_, i) => i !== idx) });
  }, [active, persist]);

  const moveItem = useCallback((idx: number, dir: -1 | 1) => {
    if (!active) return;
    const to = idx + dir;
    if (to < 0 || to >= active.items.length) return;
    const items = [...active.items];
    const [item] = items.splice(idx, 1);
    items.splice(to, 0, item);
    persist({ ...active, items });
  }, [active, persist]);

  const addRitual = useCallback((ritualId: string) => {
    if (!active) return;
    const ritual = RITUAL_LIBRARY.find(r => r.id === ritualId);
    if (!ritual) return;
    persist({ ...active, items: [...active.items, ritualToItem(ritual)] });
  }, [active, persist]);

  const addCustom = useCallback(() => {
    if (!active || customDraft.title.trim() === '') return;
    const item: ProtocolItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: customDraft.kind,
      title: customDraft.title.trim(),
      script: customDraft.script.trim(),
      durationMin: Math.max(0, Math.round(customDraft.durationMin) || 1),
      targetDays: customDraft.targetDays.length > 0 ? customDraft.targetDays : ['all'],
    };
    persist({ ...active, items: [...active.items, item] });
    setCustomDraft({ title: '', script: '', kind: 'pre', durationMin: 1, targetDays: ['all'] });
    setCustomOpen(false);
  }, [active, customDraft, persist]);

  const toggleDayTarget = useCallback((idx: number, day: MindsetDayType) => {
    if (!active) return;
    const it = active.items[idx];
    if (!it) return;
    const has = it.targetDays.includes(day);
    let targetDays = has ? it.targetDays.filter(d => d !== day) : [...it.targetDays, day];
    if (targetDays.length === 0) targetDays = ['all'];
    if (!has && day !== 'all') targetDays = targetDays.filter(d => d !== 'all');
    updateItem(idx, { targetDays });
  }, [active, updateItem]);

  // ── Чек-ин ──
  const saveCheckin = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10);
    upsertCheckin({
      date,
      sessionId: undefined,
      confidence: checkin.confidence,
      arousal: checkin.arousal,
      focus: checkin.focus,
      protocolFollowed: checkin.protocolFollowed,
      note: checkin.note.trim() || undefined,
    });
    setCheckinSaved(true);
    setTick(t => t + 1);
  }, [checkin]);

  // ── Настроение ──
  const saveMood = useCallback(() => {
    upsertMood({ date: new Date().toISOString().slice(0, 10), mood: mood.value, tags: mood.tags, note: mood.note.trim() || undefined });
    setMoodSaved(true);
    setTick(t => t + 1);
  }, [mood]);

  const toggleMoodTag = useCallback((t: MoodTag) => {
    setMood(p => ({ ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t] }));
    setMoodSaved(false);
  }, []);

  // ── Аналитика ──
  const trends = useMemo(() => mindsetTrends(14), [tick]);
  const adherence = useMemo(() => protocolAdherence(30), [tick]);
  const perfs = useMemo(() => sessionsBestE1RM(hub.historyWorkouts as any[]), [hub.historyWorkouts]);
  const link = useMemo(() => correlateConfidenceWithPerformance(loadCheckins(), perfs), [tick, perfs]);
  const insights = useMemo(() => buildMindsetInsights(active, hub.historyWorkouts as any[]), [active, tick, hub.historyWorkouts]);
  const moodTrend = useMemo(() => moodTrends(14), [tick]);
  const motivation = useMemo(() => detectMotivationPhase(hub.historyWorkouts as any[]), [hub.historyWorkouts, tick]);

  const dayItems = useMemo(() => itemsForDay(active, previewDay), [active, previewDay]);
  const filteredLibrary = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    return RITUAL_LIBRARY.filter(r => {
      if (libKind !== 'all' && r.kind !== libKind) return false;
      if (q && !(r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [libSearch, libKind]);

  // ── Печатный отчёт психики ──
  const printReport = useCallback(() => {
    const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const checks = loadCheckins();
    const adh = protocolAdherence(30);
    const tr = mindsetTrends(14);
    const link2 = correlateConfidenceWithPerformance(checks, perfs);
    const mtr = moodTrends(14);
    const mph = detectMotivationPhase(perfs as any[]);
    const rows = [...checks].reverse().slice(0, 60).map(c => `
      <tr>
        <td>${esc(c.date)}</td><td>${esc(c.sessionId || '—')}</td>
        <td>${c.confidence}</td><td>${c.arousal}</td><td>${c.focus}</td>
        <td>${c.protocolFollowed === null ? '—' : c.protocolFollowed ? 'да' : 'нет'}</td>
        <td>${esc(c.note || '')}</td>
      </tr>`).join('');
    const moodRows = [...loadMoods()].reverse().slice(0, 30).map(m => `
      <tr>
        <td>${esc(m.date)}</td><td>${m.mood}</td>
        <td>${Array.isArray(m.tags) ? esc(m.tags.join(', ')) : '—'}</td>
        <td>${esc(m.note || '')}</td>
      </tr>`).join('');
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Психология тренировок — отчёт</title>
      <style>body{font-family:system-ui;padding:24px;color:#111}table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f5f5f5}h1{font-size:18px}h2{font-size:14px;margin-top:20px}
      .stats{display:flex;gap:20px;font-size:13px;margin:8px 0;flex-wrap:wrap}</style></head><body>
      <h1>🧠 Психология тренировок — отчёт</h1>
      <div style="color:#555;font-size:12px">Сформировано: ${new Date().toLocaleString('ru-RU')}${active ? ` · протокол: ${esc(active.name)} (${active.items.length} шагов)` : ' · протокол не собран'}</div>
      <div class="stats">
        <span>Чек-инов всего: <b>${checks.length}</b></span>
        <span>За 14 дней: <b>${tr.count}</b></span>
        <span>Приверженность (30д): <b>${adh.total > 0 ? adh.pct + '%' : '—'}</b></span>
        <span>Ср. уверенность: <b>${tr.averages.confidence > 0 ? tr.averages.confidence.toFixed(1) : '—'}</b></span>
        <span>Ср. активация: <b>${tr.averages.arousal > 0 ? tr.averages.arousal.toFixed(1) : '—'}</b></span>
        <span>Ср. фокус: <b>${tr.averages.focus > 0 ? tr.averages.focus.toFixed(1) : '—'}</b></span>
        <span>Настроение (14д): <b>${mtr.count > 0 ? mtr.avg.toFixed(1) + '/5' : '—'}</b></span>
      </div>
      ${link2.pearson !== null ? `<div class="stats"><span>Связь уверенности ↔ e1RM: <b>r = ${link2.pearson}</b> (${link2.n} пар)</span></div>` : ''}
      ${mph.inputs.weeksInProgram > 0 ? `<div class="stats"><span>Фаза мотивации: <b>${esc(mph.icon + ' ' + mph.label)}</b> (${mph.inputs.weeksInProgram} нед в программе)</span></div>` : ''}
      <h2>Инсайты</h2>
      <ul>${insights.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      <h2>Чек-ины (последние 60)</h2>
      <table><thead><tr><th>Дата</th><th>Сессия</th><th>Уверенность</th><th>Активация</th><th>Фокус</th><th>Протокол</th><th>Заметка</th></tr></thead><tbody>${rows}</tbody></table>
      <h2>Настроение (последние 30)</h2>
      <table><thead><tr><th>Дата</th><th>Настроение</th><th>Теги</th><th>Заметка</th></tr></thead><tbody>${moodRows}</tbody></table>
      <script>window.print();</script></body></html>`;
    try {
      const win = window.open('', '_blank', 'width=900,height=700');
      if (win) { win.document.write(html); win.document.close(); }
    } catch { /* SSR/блокировка — игнор */ }
  }, [active, insights, perfs]);

  const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--accent),#00cc7a)', color: '#000', fontWeight: 700, fontSize: 11, minHeight: 40 };
  const ghost: React.CSSProperties = { padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontSize: 10, minHeight: 36 };
  const chip = (on: boolean, color = ACCENT): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontSize: 10, fontWeight: 600, minHeight: 30,
    border: on ? `1px solid ${color}` : '1px solid var(--border)',
    background: on ? `${color}22` : 'var(--bg-secondary)',
    color: on ? color : 'var(--text-dim)',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#fff' }}>
      {/* ── Заголовок ── */}
      <div style={{ ...CARD, border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa' }}>🧠 Психология тренировок</div>
          <span style={{ fontSize: 9, color: DIM }}>Собери личный ментальный протокол — он появится в сессии (до/во время/после)</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
          Источник шагов — методики Библиотеки (визуализация, цели, активация, устойчивость, дневник-рефлексия).
          Пресеты: {PRESET_LABELS.pl} · {PRESET_LABELS.bb} · {PRESET_LABELS.both}. Вкладка только отображает — план не меняется.
        </div>
      </div>

      {/* ── Выбор протокола ── */}
      <div style={CARD}>
        <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
          Активный протокол
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <select aria-label="Активный протокол" value={activeId || ''} onChange={e => selectActive(e.target.value)}
            style={{ ...IN, flex: 1, minWidth: 180, width: 'auto' }}>
            {protocols.length === 0 && <option value="">— нет протоколов —</option>}
            {protocols.map(p => (
              <option key={p.id} value={p.id}>{DIRECTION_ICON[p.direction]} {p.name} · {p.items.length} шагов</option>
            ))}
          </select>
          {active && (
            <>
              <button type="button" style={ghost} onClick={() => dupProtocol(active.id)} aria-label="Дублировать протокол">⧉ Копия</button>
              <button type="button" style={{ ...ghost, color: 'rgba(248,113,113,0.9)', border: '1px solid rgba(248,113,113,0.3)' }} onClick={() => removeProtocol(active.id)} aria-label="Удалить протокол">🗑</button>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" style={ghost} onClick={() => applyPreset('pl')} aria-label="Пресет ПЛ">🏆 Пресет ПЛ</button>
          <button type="button" style={ghost} onClick={() => applyPreset('bb')} aria-label="Пресет ББ">💪 Пресет ББ</button>
          <button type="button" style={ghost} onClick={() => applyPreset('both')} aria-label="Универсальный пресет">🌐 Универсал</button>
          <button type="button" style={ghost} onClick={createEmpty} aria-label="Новый пустой протокол">＋ Пустой</button>
          <button type="button" style={ghost} onClick={() => { setImportOpen(v => !v); setImportError(null); }} aria-expanded={importOpen} aria-label="Импорт протокола из JSON">📥 Импорт JSON</button>
        </div>
        {importOpen && (
          <div style={{ marginTop: 8 }}>
            <textarea aria-label="JSON протокола" style={{ ...IN, minHeight: 80, resize: 'vertical', fontFamily: 'monospace', fontSize: 10 }} placeholder='Вставьте JSON протокола (экспорт «⬇ JSON» из этой вкладки)…' value={importText} onChange={e => setImportText(e.target.value)} />
            {importError && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>{importError}</div>}
            <button type="button" style={{ ...btn, width: '100%', marginTop: 6 }} onClick={importProtocol} disabled={importText.trim() === ''}>📥 Импортировать протокол</button>
          </div>
        )}
      </div>

      {!active && (
        <div style={{ ...CARD, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🧠</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Протокол ещё не собран</div>
          <div style={{ fontSize: 10, color: DIM, marginTop: 4, lineHeight: 1.5 }}>
            Начните с пресета под ваше направление: ПЛ (активация, визуализация, ритуалы 1RM)
            или ББ (MMC, фокус, ментальный образ). Шаги можно менять как угодно.
          </div>
        </div>
      )}

      {active && (
        <>
          {/* ── Конструктор ── */}
          <div style={CARD}>
            <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
              Конструктор протокола
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input aria-label="Название протокола" style={{ ...IN, flex: 2, minWidth: 180 }} value={active.name}
                onChange={e => patchProtocol({ name: e.target.value })} />
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {(['pl', 'bb', 'both'] as MindsetDirection[]).map(d => (
                  <button key={d} type="button" style={chip(active.direction === d)}
                    onClick={() => patchProtocol({ direction: d })} aria-label={DIRECTION_LABELS[d]}>
                    {DIRECTION_ICON[d]} {d === 'pl' ? 'ПЛ' : d === 'bb' ? 'ББ' : 'Оба'}
                  </button>
                ))}
              </div>
            </div>

            {/* Шаги протокола */}
            {active.items.length === 0 ? (
              <div style={{ fontSize: 10, color: DIM, padding: 14, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 10, marginTop: 10 }}>
                Шагов нет — добавьте из библиотеки ритуалов ниже или создайте свой шаг.
              </div>
            ) : (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {active.items.map((it, idx) => (
                  <div key={it.id} style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: KIND_COLOR[it.kind], minWidth: 64 }}>
                        {KIND_ICON[it.kind]} {KIND_LABELS[it.kind]}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', flex: 1, minWidth: 140 }}>{it.title}</span>
                      <span style={{ fontSize: 9, color: DIM }}>{it.durationMin} мин</span>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button type="button" style={{ ...ghost, padding: '2px 8px', minHeight: 28 }} onClick={() => moveItem(idx, -1)} disabled={idx === 0} aria-label="Выше">↑</button>
                        <button type="button" style={{ ...ghost, padding: '2px 8px', minHeight: 28 }} onClick={() => moveItem(idx, 1)} disabled={idx === active.items.length - 1} aria-label="Ниже">↓</button>
                        <button type="button" style={{ ...ghost, padding: '2px 8px', minHeight: 28, color: 'rgba(248,113,113,0.9)' }} onClick={() => removeItem(idx)} aria-label="Удалить шаг">✕</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 }}>
                      {it.script.length > 180 ? it.script.slice(0, 180) + '…' : it.script}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {(['all', 'heavy', 'pump', 'competition', 'deload'] as MindsetDayType[]).map(d => (
                        <button key={d} type="button" style={{ ...chip(it.targetDays.includes(d), DAYTYPE_COLOR[d]), padding: '2px 8px', minHeight: 24, fontSize: 9 }}
                          onClick={() => toggleDayTarget(idx, d)} aria-label={`День: ${DAYTYPE_LABELS[d]}`} aria-pressed={it.targetDays.includes(d)}>
                          {DAYTYPE_LABELS[d]}
                        </button>
                      ))}
                    </div>
                    {it.sourceMethod && <div style={{ fontSize: 8, color: 'rgba(167,139,250,0.7)', marginTop: 4 }}>источник: {it.sourceMethod}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Библиотека ритуалов */}
            <div style={{ marginTop: 12 }}>
              <button type="button" style={{ ...ghost, width: '100%' }} onClick={() => setLibOpen(v => !v)} aria-expanded={libOpen}>
                📚 Библиотека ритуалов ({RITUAL_LIBRARY.length}) {libOpen ? '▲' : '▼'}
              </button>
              {libOpen && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <input aria-label="Поиск ритуалов" style={{ ...IN, flex: 1, minWidth: 140 }} placeholder="Поиск…" value={libSearch} onChange={e => setLibSearch(e.target.value)} />
                    {(['all', 'pre', 'approach', 'post'] as const).map(k => (
                      <button key={k} type="button" style={chip(libKind === k)} onClick={() => setLibKind(k)}>
                        {k === 'all' ? 'Все' : KIND_LABELS[k]}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, maxHeight: 320, overflowY: 'auto' }}>
                    {filteredLibrary.length === 0 && <div style={{ fontSize: 10, color: DIM, padding: 10, textAlign: 'center' }}>Ничего не найдено</div>}
                    {filteredLibrary.map(r => {
                      const added = active.items.some(it => it.title === r.title && it.script === r.script);
                      return (
                        <div key={r.id} style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--bg-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: KIND_COLOR[r.kind], minWidth: 64 }}>{KIND_ICON[r.kind]} {KIND_LABELS[r.kind]}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', flex: 1, minWidth: 120 }}>{r.title}</span>
                            <button type="button" disabled={added} style={{ ...ghost, padding: '3px 10px', minHeight: 28, opacity: added ? 0.4 : 1 }}
                              onClick={() => addRitual(r.id)} aria-label={`Добавить ${r.title}`}>
                              {added ? '✓ добавлен' : '＋ добавить'}
                            </button>
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3, lineHeight: 1.45 }}>{r.description}</div>
                          <div style={{ fontSize: 8, color: 'var(--text-faint)', marginTop: 2 }}>
                            {r.durationMin} мин · {r.targetDays.map(d => DAYTYPE_LABELS[d]).join(' · ')} · {DIRECTION_ICON[r.direction]} {DIRECTION_LABELS[r.direction]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Кастомный шаг */}
            <div style={{ marginTop: 10 }}>
              <button type="button" style={{ ...ghost, width: '100%' }} onClick={() => setCustomOpen(v => !v)} aria-expanded={customOpen}>
                ✍️ Свой шаг {customOpen ? '▲' : '▼'}
              </button>
              {customOpen && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input aria-label="Название шага" style={IN} placeholder="Название (напр. «Мой ритуал перед приседом»)" value={customDraft.title}
                    onChange={e => setCustomDraft(p => ({ ...p, title: e.target.value }))} />
                  <textarea aria-label="Скрипт шага" style={{ ...IN, minHeight: 64, resize: 'vertical' }} placeholder="Что делать — пошагово, своими словами"
                    value={customDraft.script} onChange={e => setCustomDraft(p => ({ ...p, script: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {KIND_ORDER.map(k => (
                      <button key={k} type="button" style={chip(customDraft.kind === k, KIND_COLOR[k])} onClick={() => setCustomDraft(p => ({ ...p, kind: k }))}>
                        {KIND_ICON[k]} {KIND_LABELS[k]}
                      </button>
                    ))}
                    <span style={{ fontSize: 9, color: DIM, marginLeft: 4 }}>мин:</span>
                    <input aria-label="Длительность мин" type="number" min={1} max={30} style={{ ...IN, width: 56, padding: '6px 8px' }}
                      value={customDraft.durationMin} onChange={e => setCustomDraft(p => ({ ...p, durationMin: Math.max(1, Math.min(30, +e.target.value || 1)) }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(['all', 'heavy', 'pump', 'competition', 'deload'] as MindsetDayType[]).map(d => (
                      <button key={d} type="button" style={chip(customDraft.targetDays.includes(d), DAYTYPE_COLOR[d])}
                        onClick={() => setCustomDraft(p => {
                          const has = p.targetDays.includes(d);
                          let t = has ? p.targetDays.filter(x => x !== d) : [...p.targetDays, d];
                          if (t.length === 0) t = ['all'];
                          if (!has && d !== 'all') t = t.filter(x => x !== 'all');
                          return { ...p, targetDays: t };
                        })}>
                        {DAYTYPE_LABELS[d]}
                      </button>
                    ))}
                  </div>
                  <button type="button" style={btn} onClick={addCustom} disabled={customDraft.title.trim() === ''}>＋ Добавить шаг в протокол</button>
                </div>
              )}
            </div>
          </div>

          {/* ── Предпросмотр дня ── */}
          <div style={CARD}>
            <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
              Предпросмотр по типу дня
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {(['heavy', 'pump', 'competition', 'deload', 'all'] as MindsetDayType[]).map(d => (
                <button key={d} type="button" style={chip(previewDay === d, DAYTYPE_COLOR[d])} onClick={() => setPreviewDay(d)}>
                  {DAYTYPE_LABELS[d]}
                </button>
              ))}
            </div>
            {dayItems.length === 0 ? (
              <div style={{ fontSize: 10, color: DIM }}>Для этого типа дня шагов нет — добавьте шаги или смените их привязку в конструкторе.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dayItems.map(it => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                    <span style={{ fontSize: 10 }}>{KIND_ICON[it.kind]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{it.title} <span style={{ fontSize: 9, color: DIM, fontWeight: 400 }}>· {it.durationMin} мин</span></div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.45 }}>{it.script}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Чек-ин сегодня ── */}
          <div style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Чек-ин после тренировки</div>
              {checkinSaved && <span style={{ fontSize: 9, color: ACCENT }}>✓ сохранено · сегодня</span>}
            </div>
            <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>Заполняется после сессии: три шкалы + выполнение протокола. Копится в тренды.</div>
            <div style={{ marginTop: 10 }}>
              <ScaleRow label={SCALE_LABELS.confidence.label} hint={SCALE_LABELS.confidence.hint} value={checkin.confidence} onChange={v => setCheckin(p => ({ ...p, confidence: v }))} />
              <ScaleRow label={SCALE_LABELS.arousal.label} hint={SCALE_LABELS.arousal.hint} value={checkin.arousal} onChange={v => setCheckin(p => ({ ...p, arousal: v }))} />
              <ScaleRow label={SCALE_LABELS.focus.label} hint={SCALE_LABELS.focus.hint} value={checkin.focus} onChange={v => setCheckin(p => ({ ...p, focus: v }))} />
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '6px 0 10px' }}>
              <button type="button" style={chip(checkin.protocolFollowed === true)} onClick={() => setCheckin(p => ({ ...p, protocolFollowed: true }))}>✓ Протокол выполнен</button>
              <button type="button" style={chip(checkin.protocolFollowed === false, '#ef4444')} onClick={() => setCheckin(p => ({ ...p, protocolFollowed: false }))}>✕ Не выполнен</button>
              <button type="button" style={chip(checkin.protocolFollowed === null, '#60a5fa')} onClick={() => setCheckin(p => ({ ...p, protocolFollowed: null }))}>— Не отмечать</button>
            </div>
            <input aria-label="Заметка чек-ина" style={IN} placeholder="заметка: что сработало, что нет…" value={checkin.note}
              onChange={e => setCheckin(p => ({ ...p, note: e.target.value }))} />
            <button type="button" style={{ ...btn, width: '100%', marginTop: 10 }} onClick={saveCheckin}>💾 Сохранить чек-ин</button>
          </div>

          {/* ── Настроение дня ── */}
          <div style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>🌤 Настроение дня</div>
              {moodSaved && <span style={{ fontSize: 9, color: ACCENT }}>✓ сохранено · сегодня</span>}
            </div>
            <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>Дневник настроения: одна оценка в день + теги. Копится в тренд и влияет на фазу мотивации.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginTop: 10 }} role="radiogroup" aria-label="Настроение">
              {[1, 2, 3, 4, 5].map(v => (
                <button key={v} type="button" role="radio" aria-checked={mood.value === v} aria-label={`Настроение ${v}: ${MOOD_LABELS[v].label}`}
                  onClick={() => { setMood(p => ({ ...p, value: v })); setMoodSaved(false); }}
                  style={{
                    padding: '8px 4px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    border: mood.value === v ? `1px solid ${MOOD_LABELS[v].color}` : '1px solid var(--border)',
                    background: mood.value === v ? `${MOOD_LABELS[v].color}22` : 'var(--bg-secondary)',
                  }}>
                  <div style={{ fontSize: 18 }}>{MOOD_LABELS[v].emoji}</div>
                  <div style={{ fontSize: 8, color: mood.value === v ? MOOD_LABELS[v].color : 'var(--text-dim)', marginTop: 2 }}>{MOOD_LABELS[v].label}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {MOOD_TAGS.map(t => (
                <button key={t} type="button" style={chip(mood.tags.includes(t), '#a78bfa')} onClick={() => toggleMoodTag(t)} aria-pressed={mood.tags.includes(t)}>
                  {t}
                </button>
              ))}
            </div>
            <input aria-label="Заметка настроения" style={{ ...IN, marginTop: 8 }} placeholder="заметка: почему такое состояние…" value={mood.note}
              onChange={e => setMood(p => ({ ...p, note: e.target.value }))} />
            <button type="button" style={{ ...btn, width: '100%', marginTop: 10 }} onClick={saveMood}>💾 Сохранить настроение</button>
            {moodTrend.count >= 2 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>Тренд настроения · 14 дней</div>
                <MiniLineChart
                  data={moodTrend.series.map(s => s.mood)}
                  labels={moodTrend.series.map(s => s.date.slice(5))}
                  color="#a78bfa"
                  height={50}
                  ySuffix="/5"
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
                  <div style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--bg-secondary)', textAlign: 'center' }}>
                    <div style={{ fontSize: 8, color: DIM }}>Среднее</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>{moodTrend.avg.toFixed(1)}/5</div>
                  </div>
                  <div style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--bg-secondary)', textAlign: 'center' }}>
                    <div style={{ fontSize: 8, color: DIM }}>Дельта 14д</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: moodTrend.delta > 0.05 ? '#22c55e' : moodTrend.delta < -0.05 ? '#ef4444' : 'var(--text-dim)' }}>
                      {moodTrend.delta > 0.05 ? '▲' : moodTrend.delta < -0.05 ? '▼' : '•'} {Math.abs(moodTrend.delta) > 0.05 ? Math.abs(moodTrend.delta).toFixed(1) : ''}
                    </div>
                  </div>
                  <div style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--bg-secondary)', textAlign: 'center' }}>
                    <div style={{ fontSize: 8, color: DIM }}>Низкие (≤2)</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: (moodTrend.distribution[1] || 0) + (moodTrend.distribution[2] || 0) > 0 ? '#f59e0b' : 'var(--text-dim)' }}>
                      {(moodTrend.distribution[1] || 0) + (moodTrend.distribution[2] || 0)} из {moodTrend.count}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Тренды ── */}
          <div style={CARD}>
            <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
              Тренды психики · 14 дней
            </div>
            {trends.count < 2 ? (
              <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>
                Данных мало (чек-инов: {trends.count}). Заполните чек-ин в 2+ сессиях — здесь появятся графики уверенности, активации и фокуса.
              </div>
            ) : (
              <>
                <MiniLineChart
                  data={[]}
                  series={[
                    { name: 'Уверенность', color: '#00e68a', data: trends.series.map(s => s.confidence) },
                    { name: 'Активация', color: '#f59e0b', data: trends.series.map(s => s.arousal) },
                    { name: 'Фокус', color: '#60a5fa', data: trends.series.map(s => s.focus) },
                  ]}
                  labels={trends.series.map(s => s.date.slice(5))}
                  height={70}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
                  {([['confidence', SCALE_LABELS.confidence.label, SCALE_LABELS.confidence.color], ['arousal', SCALE_LABELS.arousal.label, SCALE_LABELS.arousal.color], ['focus', SCALE_LABELS.focus.label, SCALE_LABELS.focus.color]] as const).map(([key, label, color]) => {
                    const avg = trends.averages[key];
                    const delta = trends.deltas[key];
                    return (
                      <div key={key} style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: DIM }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color }}>{avg > 0 ? avg.toFixed(1) : '—'}</div>
                        <div style={{ fontSize: 9, color: delta > 0.05 ? '#22c55e' : delta < -0.05 ? '#ef4444' : DIM }}>
                          {delta > 0.05 ? '▲' : delta < -0.05 ? '▼' : '•'} {Math.abs(delta) > 0.05 ? `${Math.abs(delta).toFixed(1)}` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: 9, color: DIM }}>Приверженность протоколу · 30д</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: adherence.pct >= 80 ? '#22c55e' : adherence.pct >= 40 ? '#f59e0b' : '#ef4444' }}>
                  {adherence.total > 0 ? `${adherence.pct}%` : '—'}
                </div>
                <div style={{ fontSize: 9, color: DIM }}>{adherence.followed}/{adherence.total} сессий</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: 9, color: DIM }}>Связь уверенности и e1RM</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa' }}>{link.pearson !== null ? `r = ${link.pearson}` : '—'}</div>
                <div style={{ fontSize: 9, color: DIM }}>{link.n} пар (чек-ин + сессия)</div>
              </div>
            </div>
            {link.n >= 3 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>Средний e1RM сессии по уровню уверенности:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {link.buckets.map(b => (
                    <div key={b.level} style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--bg-secondary)', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: DIM }}>{b.range}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: b.n > 0 ? '#fff' : DIM }}>{b.n > 0 ? `${b.avgE1RM} кг` : '—'}</div>
                      <div style={{ fontSize: 8, color: DIM }}>{b.n} сессий</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Инсайты ── */}
          <div style={CARD}>
            <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
              💡 Персональные инсайты
            </div>
            {insights.map((s, i) => (
              <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, padding: '6px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', borderLeft: '2px solid rgba(0,230,138,0.4)', marginBottom: 4 }}>
                {s}
              </div>
            ))}
          </div>

          {/* ── Фаза мотивации ── */}
          <div style={CARD}>
            <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
              📈 Фаза мотивации
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 26 }}>{motivation.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{motivation.label}</div>
                <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>
                  {motivation.duration} · {motivation.inputs.weeksInProgram} нед в программе
                  {motivation.inputs.lastPRDaysAgo < 999 ? ` · PR ${motivation.inputs.lastPRDaysAgo} дн. назад` : ''}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginTop: 8 }}>{motivation.description}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>Признаки</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {motivation.signs.map((s, i) => (
                    <span key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)' }}>• {s}</span>
                  ))}
                </div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>Что делать</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {motivation.interventions.map((s, i) => (
                    <span key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)' }}>• {s}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#a78bfa', lineHeight: 1.5, marginTop: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(167,139,250,0.07)', borderLeft: '2px solid rgba(167,139,250,0.4)' }}>
              🏋️ Тренировка: {motivation.trainingAdjustment}
            </div>
            <div style={{ fontSize: 8, color: 'var(--text-faint)', marginTop: 6 }}>
              По данным дневника: {motivation.inputs.motivationScore.toFixed(1)}/5 мотивация · усталость {Math.round(motivation.inputs.fatigueScore * 100)}% · PR {motivation.inputs.lastPRDaysAgo < 999 ? `${motivation.inputs.lastPRDaysAgo} дн. назад` : 'нет данных'}
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={{ ...ghost, flex: 1, marginTop: 2 }} onClick={refresh} aria-label="Обновить данные">🔄 Обновить данные</button>
        <button type="button" style={{ ...ghost, flex: 1, marginTop: 2, border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }} onClick={printReport} aria-label="Печать отчёта психики">🖨 Печать отчёта</button>
        <button type="button" style={{ ...ghost, flex: 1, marginTop: 2 }} onClick={() => {
          if (!active) return;
          try {
            const blob = new Blob([JSON.stringify(active, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mindset_protocol_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          } catch { /* ignore */ }
        }} aria-label="Скачать протокол JSON">⬇ JSON</button>
      </div>
    </div>
  );
};

export default MindsetTab;
