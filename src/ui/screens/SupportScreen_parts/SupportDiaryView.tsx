import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-catalog-data';
import { getSubstanceName } from '../../../engines/stack-optimizer.engine';
import { ComplaintsTab } from './ComplaintsTab';

const DIARY_KEY = 'he_support_diary';

// ── Журнал негативного опыта: хранится в he_autocalc_state.journal.negative ──
interface NegEntry { substanceId: string; symptom: string; comment: string; }
function loadNegJournal(): NegEntry[] {
  try {
    const raw = localStorage.getItem('he_autocalc_state');
    if (!raw) return [];
    const s = JSON.parse(raw);
    return Array.isArray(s?.journal?.negative) ? s.journal.negative : [];
  } catch { return []; }
}
function saveNegJournal(list: NegEntry[]) {
  try {
    const raw = localStorage.getItem('he_autocalc_state');
    const s = raw ? JSON.parse(raw) : {};
    s.journal = { ...(s.journal || {}), negative: list };
    localStorage.setItem('he_autocalc_state', JSON.stringify(s));
  } catch {}
}

const NEG_SYMPTOMS = [
  'Аллергия / сыпь', 'Тошнота', 'Головная боль', 'Бессонница',
  'Повышение давления', 'Расстройство ЖКТ', 'Боль в суставах',
  'Аритмия', 'Усталость / упадок сил', 'Приливы / потливость', 'Другое',
];

type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';
type MoodLevel = 1 | 2 | 3 | 4 | 5;

const TIME_SLOTS: { id: TimeSlot; label: string; icon: string }[] = [
  { id: 'morning', label: 'Утро', icon: '🌅' },
  { id: 'afternoon', label: 'День', icon: '☀️' },
  { id: 'evening', label: 'Вечер', icon: '🌆' },
  { id: 'night', label: 'Ночь', icon: '🌙' },
];

const MOOD_OPTIONS: { level: MoodLevel; icon: string; label: string }[] = [
  { level: 1, icon: '😫', label: 'Ужасно' },
  { level: 2, icon: '😔', label: 'Плохо' },
  { level: 3, icon: '😐', label: 'Нормально' },
  { level: 4, icon: '🙂', label: 'Хорошо' },
  { level: 5, icon: '😊', label: 'Отлично' },
];

const SIDE_EFFECTS = [
  'Тошнота', 'Головная боль', 'Головокружение', 'Сонливость',
  'Бессонница', 'Сухость во рту', 'Диарея', 'Запор',
  'Изжога', 'Вздутие', 'Сыпь', 'Усталость',
];

interface SubstanceIntake {
  taken: boolean;
  dose?: string;
  timeSlot?: TimeSlot;
  sideEffects?: string[];
}

interface DiaryEntry {
  date: string;
  substances: Record<string, SubstanceIntake>;
  notes?: string;
  complianceNotes?: string;
  mood?: MoodLevel;
}

function loadDiary(): DiaryEntry[] {
  try { return JSON.parse(localStorage.getItem(DIARY_KEY) || '[]'); } catch { return []; }
}

function saveDiary(entries: DiaryEntry[]) {
  try { localStorage.setItem(DIARY_KEY, JSON.stringify(entries)); } catch {}
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function dayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { weekday: 'short' });
}

function dayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { weekday: 'long' });
}

function getLastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function calcStreak(entries: DiaryEntry[], today: string): number {
  let streak = 0;
  const d = new Date(today + 'T00:00:00');
  for (let i = 0; ; i++) {
    const dateStr = new Date(d.getTime() - i * 86400000).toISOString().slice(0, 10);
    const entry = entries.find(e => e.date === dateStr);
    if (!entry) break;
    const taken = Object.values(entry.substances).filter(s => s.taken).length;
    if (taken === 0) break;
    streak++;
  }
  return streak;
}

function calcWeekCompliance(entries: DiaryEntry[], planSubs: string[]): number {
  const last7 = getLastNDays(7);
  let total = 0;
  let taken = 0;
  for (const dateStr of last7) {
    const entry = entries.find(e => e.date === dateStr);
    if (!entry) continue;
    const subs = planSubs.length > 0 ? planSubs : Object.keys(entry.substances);
    for (const subId of subs) {
      total++;
      if (entry.substances[subId]?.taken) taken++;
    }
  }
  if (total === 0) return 0;
  return Math.round((taken / total) * 100);
}

/** SVG круглый прогресс-бар */
function CircularGauge({ pct, size = 84, stroke = 7 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? '#00e68a' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.4s' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={color}
        fontSize={size * 0.22} fontWeight={800}>{pct}%</text>
    </svg>
  );
}

// ─── Общие стили (Apple-like frosted glass) ───
const sx = {
  card: {
    background: 'rgba(24,24,27,0.15)', borderRadius: 14, padding: '12px 14px',
    border: '1px solid rgba(255,255,255,0.04)',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)', marginBottom: 8,
  } as React.CSSProperties,
  pill: (active: boolean): React.CSSProperties => ({
    padding: '8px 14px', borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
    cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', minHeight: 38,
    background: active ? 'rgba(0,230,138,0.1)' : 'var(--bg-secondary, rgba(255,255,255,0.04))',
    color: active ? '#00e68a' : 'var(--text-dim, rgba(255,255,255,0.4))',
    border: active ? '1px solid rgba(0,230,138,0.25)' : '1px solid var(--border, rgba(255,255,255,0.08))',
  }),
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)',
    color: '#fff', fontSize: 12, boxSizing: 'border-box', fontFamily: 'inherit',
  } as React.CSSProperties,
  accentBtn: {
    padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #00e68a, #00c771)', color: '#000',
    fontWeight: 700, fontSize: 12, fontFamily: 'inherit', width: '100%', minHeight: 40,
  } as React.CSSProperties,
};

const ACCENT = '#00e68a';
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  background: 'rgba(0,0,0,0.85)',
};
const sheetStyle: React.CSSProperties = {
  width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto',
  borderRadius: '18px 18px 0 0', background: '#18181b', border: '1px solid rgba(255,255,255,0.1)',
};
const sheetPad = { padding: '16px 16px 28px' } as React.CSSProperties;
const sheetTitle = { fontSize: 15, fontWeight: 700, color: ACCENT, marginBottom: 12 } as React.CSSProperties;

// ── Модалка выбора вещества из каталога ──
function AddSubstanceModal({ onPick, onClose }: { onPick: (id: string, name: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [custom, setCustom] = useState('');
  const options = useMemo(() => Object.entries(SUPPORT_CATALOG_DATA).map(([id, e]) => ({
    id, name: (e.nameRu || e.name || id) as string,
  })).sort((a, b) => a.name.localeCompare(b.name, 'ru')), []);
  const filtered = q
    ? options.filter(o => o.name.toLowerCase().includes(q.toLowerCase()) || o.id.toLowerCase().includes(q.toLowerCase()))
    : options;
  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={sheetStyle}>
        <div style={{ height: 3, width: 36, background: 'rgba(255,255,255,0.2)', borderRadius: 3, margin: '0 auto 12px' }} />
        <div style={sheetPad}>
          <div style={sheetTitle}>➕ Добавить вещество</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Поиск по каталогу БАД…"
            style={{ ...sx.input, marginBottom: 8 }} autoFocus />
          {/* Кастомное вещество */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Своё название…"
              style={{ ...sx.input, flex: 1 }} />
            <button disabled={!custom.trim()} onClick={() => custom.trim() && onPick(`custom_${custom.trim()}`, custom.trim())}
              style={{ padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: custom.trim() ? ACCENT : 'rgba(255,255,255,0.08)', color: custom.trim() ? '#000' : 'rgba(255,255,255,0.4)',
                fontWeight: 700, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              ＋
            </button>
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Или выберите из каталога ({filtered.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.slice(0, 200).map(o => (
              <button key={o.id} onClick={() => onPick(o.id, o.name)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                  padding: '11px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                <span>{o.name}</span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>{o.id}</span>
              </button>
            ))}
            {filtered.length === 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 16 }}>Ничего не найдено</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Журнал негативного опыта (переоформлен) ──
function NegativeJournalCard() {
  const [list, setList] = useState<NegEntry[]>(loadNegJournal);
  const [open, setOpen] = useState(false);
  const [subQ, setSubQ] = useState('');
  const [subName, setSubName] = useState('');
  const [symptom, setSymptom] = useState(NEG_SYMPTOMS[0]);
  const [comment, setComment] = useState('');

  const catalog = useMemo(() => Object.entries(SUPPORT_CATALOG_DATA).map(([id, e]) => ({
    id, name: (e.nameRu || e.name || id) as string,
  })).sort((a, b) => a.name.localeCompare(b.name, 'ru')), []);
  const suggestions = subQ
    ? catalog.filter(o => o.name.toLowerCase().includes(subQ.toLowerCase()) || o.id.toLowerCase().includes(subQ.toLowerCase())).slice(0, 12)
    : [];

  const reset = () => { setSubName(''); setSubQ(''); setSymptom(NEG_SYMPTOMS[0]); setComment(''); };
  const add = (id: string, name: string) => {
    const next = [...list, { substanceId: id, symptom, comment: comment.trim() }];
    setList(next); saveNegJournal(next);
    reset(); setOpen(false);
  };
  const remove = (i: number) => {
    const next = list.filter((_, j) => j !== i);
    setList(next); saveNegJournal(next);
  };
  const resolveName = (id: string) => {
    if (id.startsWith('custom_')) return id.replace('custom_', '');
    const c = catalog.find(o => o.id === id);
    return c ? c.name : id;
  };

  return (
    <div style={{ ...sx.card, border: '1px solid rgba(239,68,68,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>📕 Журнал негативного опыта</div>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{list.length}</span>
      </div>
      <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 8, marginTop: 2 }}>
        Вещества с негативной реакцией. Автоматически исключаются из подбора поддержки.
      </div>

      {list.length === 0 && !open && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '8px 0' }}>Записей нет</div>
      )}

      {list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {list.map((n, i) => (
            <div key={i} style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444' }}>🚫 {resolveName(n.substanceId)}</div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{n.symptom}</div>
                </div>
                <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 4 }}>✕</button>
              </div>
              {n.comment && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', marginTop: 3, fontStyle: 'italic' }}>{n.comment}</div>}
            </div>
          ))}
        </div>
      )}

      {!open && (
        <button onClick={() => setOpen(true)} style={{
          width: '100%', padding: '10px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
          border: '1px dashed rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: '#ef4444', fontWeight: 700, fontSize: 11,
        }}>+ Добавить негативный опыт</button>
      )}

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Вещество</div>
          <input value={subQ} onChange={e => { setSubQ(e.target.value); setSubName(''); }} placeholder="🔍 Поиск в каталоге…"
            style={{ ...sx.input }} autoFocus />
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 96, overflowY: 'auto' }}>
              {suggestions.map(o => (
                <button key={o.id} onClick={() => { setSubName(o.id); setSubQ(o.name); }}
                  style={{ padding: '5px 10px', borderRadius: 12, fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                    background: subName === o.id ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                    color: subName === o.id ? '#ef4444' : 'rgba(255,255,255,0.7)' }}>{o.name}</button>
              ))}
            </div>
          )}
          {!subName && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={subQ} onChange={e => setSubName(e.target.value)} placeholder="или введите название вручную"
                style={{ ...sx.input, flex: 1 }} />
            </div>
          )}

          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Симптом реакции</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {NEG_SYMPTOMS.map(s => (
              <button key={s} onClick={() => setSymptom(s)}
                style={{ padding: '5px 10px', borderRadius: 12, fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                  background: symptom === s ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                  color: symptom === s ? '#ef4444' : 'rgba(255,255,255,0.6)', fontWeight: symptom === s ? 700 : 400 }}>{s}</button>
            ))}
          </div>

          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Комментарий (необязательно)</div>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Опишите реакцию, дозировку, длительность…"
            style={{ width: '100%', minHeight: 50, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', color: '#fff', fontSize: 10, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />

          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled={!subName.trim()} onClick={() => subName.trim() && add(subName.trim(), resolveName(subName.trim()))}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: subName.trim() ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>
              🚫 Сохранить
            </button>
            <button onClick={() => { reset(); setOpen(false); }} style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const SupportDiaryView: React.FC<{ s: Record<string, any>; onOpenSolver?: () => void }> = ({ s, onOpenSolver }) => {
  const { SUPPORT_LEVELS, supportLevel } = s;
  const [entries, setEntries] = useState<DiaryEntry[]>(loadDiary);
  const [notes, setNotes] = useState('');
  const [complianceNotes, setComplianceNotes] = useState('');
  const [mood, setMood] = useState<MoodLevel>(3);
  const [viewDate, setViewDate] = useState(todayStr);
  const [tab, setTab] = useState<'today' | 'week' | 'history' | 'stats' | 'complaints'>('today');
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [showSideEffects, setShowSideEffects] = useState<Record<string, boolean>>({});
  const [addModal, setAddModal] = useState(false);

  const today = todayStr();
  const todayEntry = entries.find(e => e.date === today);

  useEffect(() => {
    setNotes(todayEntry?.notes || '');
    setComplianceNotes(todayEntry?.complianceNotes || '');
    if (todayEntry?.mood) setMood(todayEntry.mood);
  }, [todayEntry?.notes, todayEntry?.complianceNotes, todayEntry?.mood]);

  const planSubs: string[] = SUPPORT_LEVELS?.[supportLevel]?.subs || [];

  const editingEntry = editingDate ? entries.find(e => e.date === editingDate) : null;

  const getCat = useCallback((subId: string) => SUPPORT_CATALOG_DATA[subId], []);
  const getName = useCallback((subId: string) => {
    if (subId.startsWith('custom_')) return subId.replace('custom_', '');
    const cat = getCat(subId);
    return cat?.nameRu || cat?.name || subId;
  }, [getCat]);

  const setSubState = useCallback((dateStr: string, subId: string, updates: Partial<SubstanceIntake>) => {
    setEntries(prev => {
      const updated = [...prev];
      let idx = updated.findIndex(e => e.date === dateStr);
      if (idx < 0) {
        updated.unshift({ date: dateStr, substances: {} });
        idx = 0;
      }
      const prevSub = updated[idx].substances[subId] || { taken: false };
      updated[idx] = {
        ...updated[idx],
        substances: {
          ...updated[idx].substances,
          [subId]: { ...prevSub, ...updates },
        },
      };
      saveDiary(updated);
      return updated;
    });
  }, []);

  const toggleTaken = (subId: string) => {
    const curr = todayEntry?.substances[subId]?.taken || false;
    setSubState(today, subId, { taken: !curr });
  };

  const setMoodForToday = (m: MoodLevel) => {
    setMood(m);
    setEntries(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(e => e.date === today);
      if (idx < 0) updated.unshift({ date: today, substances: {}, mood: m });
      else updated[idx] = { ...updated[idx], mood: m };
      saveDiary(updated);
      return updated;
    });
  };

  const saveNotes = () => {
    setEntries(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(e => e.date === today);
      if (idx < 0) updated.unshift({ date: today, substances: {}, notes, complianceNotes, mood });
      else updated[idx] = { ...updated[idx], notes, complianceNotes, mood };
      saveDiary(updated);
      return updated;
    });
  };

  const clearToday = () => {
    setEntries(prev => {
      const updated = prev.filter(e => e.date !== today);
      saveDiary(updated);
      return updated;
    });
    setNotes(''); setComplianceNotes(''); setMood(3);
  };

  const saveEditedEntry = (dateStr: string, newNotes: string, newMood: MoodLevel, newSubs: Record<string, SubstanceIntake>) => {
    setEntries(prev => {
      const updated = prev.map(e => e.date === dateStr ? { ...e, notes: newNotes, mood: newMood, substances: newSubs } : e);
      saveDiary(updated);
      return updated;
    });
    setEditingDate(null);
  };

  const markAllTaken = () => {
    setEntries(prev => {
      const updated = [...prev];
      let idx = updated.findIndex(e => e.date === today);
      if (idx < 0) { updated.unshift({ date: today, substances: {} }); idx = 0; }
      const subs = { ...updated[idx].substances };
      for (const subId of planSubs) subs[subId] = { ...(subs[subId] || { taken: false }), taken: true };
      updated[idx] = { ...updated[idx], substances: subs };
      saveDiary(updated);
      return updated;
    });
  };

  const markAllNotTaken = () => {
    setEntries(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(e => e.date === today);
      if (idx < 0) return prev;
      const subs: Record<string, SubstanceIntake> = {};
      for (const subId of planSubs) subs[subId] = { taken: false };
      updated[idx] = { ...updated[idx], substances: subs };
      saveDiary(updated);
      return updated;
    });
  };

  const addSubstance = (id: string, name: string) => {
    const cat = getCat(id);
    const dose = cat?.dosage?.mg ? `${cat.dosage.mg} мг` : undefined;
    setSubState(today, id, { taken: true, dose });
    setAddModal(false);
  };

  const toggleSideEffect = (subId: string, effect: string) => {
    const curr = todayEntry?.substances[subId]?.sideEffects || [];
    const next = curr.includes(effect) ? curr.filter(e => e !== effect) : [...curr, effect];
    setSubState(today, subId, { sideEffects: next });
  };

  const streak = useMemo(() => calcStreak(entries, today), [entries, today]);
  const weekCompliance = useMemo(() => calcWeekCompliance(entries, planSubs), [entries, planSubs]);

  const last7Days = getLastNDays(7);
  const historyDays = last7Days.map(dateStr => {
    const entry = entries.find(e => e.date === dateStr);
    let takenCount = 0;
    let total = planSubs.length || 1;
    if (entry) {
      takenCount = Object.entries(entry.substances).filter(([, v]) => v.taken).length;
      const customCount = Object.keys(entry.substances).filter(k => k.startsWith('custom_')).length;
      if (customCount > 0) total += customCount;
    }
    return { date: dateStr, takenCount, total, pct: total > 0 ? Math.round((takenCount / total) * 100) : 0 };
  });

  const todaySideEffects = useMemo(() => {
    const effects = new Set<string>();
    if (!todayEntry) return [];
    for (const [, v] of Object.entries(todayEntry.substances)) {
      if (v.sideEffects) v.sideEffects.forEach(e => effects.add(e));
    }
    return Array.from(effects);
  }, [todayEntry]);

  const filteredEntries = useMemo(() => {
    let list = entries.filter(e => e.date !== today);
    if (filterText) {
      const f = filterText.toLowerCase();
      list = list.filter(e => {
        for (const subId of Object.keys(e.substances)) {
          if (getName(subId).toLowerCase().includes(f)) return true;
        }
        return false;
      });
    }
    return list.slice(0, 20);
  }, [entries, filterText, getName]);

  const weekViewData = useMemo(() => last7Days.map(dateStr => ({ date: dateStr, entry: entries.find(e => e.date === dateStr) })), [entries]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 80 }}>
      {/* HEADER: Streak + Gauge */}
      <div style={{ ...sx.card, display: 'flex', alignItems: 'center', gap: 16 }}>
        <CircularGauge pct={weekCompliance} size={84} stroke={7} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Комплаентность за 7 дней</div>
          <span style={{ fontSize: 24, fontWeight: 800, color: streak >= 3 ? '#00e68a' : 'rgba(255,255,255,0.4)' }}>
            {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} 🔥
          </span>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            непрерывного приёма · {planSubs.length} веществ в плане
          </div>
        </div>
      </div>

      <NegativeJournalCard />

      {/* Tab pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          ['today', '📋 Сегодня'],
          ['week', '📅 Неделя'],
          ['history', '📊 История'],
          ['stats', '📈 Статистика'],
          ['complaints', '🩺 Жалобы'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)} style={sx.pill(tab === id)}>{label}</button>
        ))}
      </div>

      {/* ═══════════════ TODAY TAB ═══════════════ */}
      {tab === 'today' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Date + Mood */}
          <div style={sx.card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              {dayName(today)}, {formatDate(today)}
            </div>
            <div style={sx.sectionTitle}>Самочувствие</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {MOOD_OPTIONS.map(m => (
                <button key={m.level} onClick={() => setMoodForToday(m.level)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', minHeight: 48,
                    border: mood === m.level ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
                    background: mood === m.level ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)',
                    textAlign: 'center', transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 18 }}>{m.icon}</div>
                  <div style={{ fontSize: 8, color: mood === m.level ? '#00e68a' : 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 2 }}>{m.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Batch buttons */}
          {planSubs.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={markAllTaken} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', minHeight: 40,
                border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.06)', color: '#00e68a', fontWeight: 700, fontSize: 11,
              }}>✅ Все приняты</button>
              <button onClick={markAllNotTaken} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', minHeight: 40,
                border: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.05)', color: '#ef4444', fontWeight: 700, fontSize: 11,
              }}>✕ Сбросить все</button>
            </div>
          )}

          {/* Substance list */}
          {planSubs.length === 0 ? (
            <div style={{ padding: 26, textAlign: 'center', ...sx.card }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Нет активного плана поддержки</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                Перейдите в 🧮 Калькулятор и выполните расчёт
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {planSubs.map((subId: string) => {
                const cat = getCat(subId);
                const name = getName(subId);
                const dose = cat?.dosage?.mg ? `${cat.dosage.mg} мг` : '';
                const timing = cat?.dosage?.timing || '';
                const si = todayEntry?.substances[subId] || { taken: false };
                const taken = si.taken;
                const showSE = showSideEffects[subId] || false;
                const slotIcon = (ts?: TimeSlot) => {
                  const slot = TIME_SLOTS.find(t => t.id === (ts || (timing ? timing.toLowerCase() : '')));
                  return slot ? slot.icon : '';
                };

                return (
                  <div key={subId} style={{
                    borderRadius: 12, overflow: 'hidden', transition: 'all 0.15s',
                    background: taken ? 'rgba(0,230,138,0.05)' : 'rgba(24,24,27,0.15)',
                    border: '1px solid ' + (taken ? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.06)'),
                  }}>
                    {/* Main row — only the row toggles */}
                    <div onClick={() => toggleTaken(subId)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, flexShrink: 0, transition: 'all 0.15s',
                        background: taken ? '#00e68a' : 'rgba(255,255,255,0.06)',
                        color: taken ? '#000' : 'rgba(255,255,255,0.4)',
                      }}>
                        {taken ? '✓' : '○'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: taken ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>{name}</div>
                        {(dose || timing) && (
                          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                            {dose}{dose && timing ? ' · ' : ''}{slotIcon()} {timing}
                          </div>
                        )}
                      </div>
                      {taken && <span style={{ fontSize: 9, color: '#00e68a', fontWeight: 700, whiteSpace: 'nowrap' }}>принято</span>}
                    </div>

                    {/* Expand: time slot, dose, side effects — clicks here do NOT toggle */}
                    {taken && (
                      <div onClick={e => e.stopPropagation()} style={{ padding: '0 14px 12px 50px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {TIME_SLOTS.map(ts => (
                            <button key={ts.id} onClick={() => setSubState(today, subId, { timeSlot: si.timeSlot === ts.id ? undefined : ts.id })}
                              style={{
                                padding: '5px 10px', borderRadius: 12, fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                                background: si.timeSlot === ts.id ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.05)',
                                color: si.timeSlot === ts.id ? '#00e68a' : 'rgba(255,255,255,0.5)', fontWeight: si.timeSlot === ts.id ? 700 : 400,
                              }}>
                              {ts.icon} {ts.label}
                            </button>
                          ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>Факт. доза:</span>
                          <input type="text" value={si.dose || dose || ''} onChange={e => setSubState(today, subId, { dose: e.target.value })}
                            placeholder="напр. 600 мг"
                            style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: 10, fontFamily: 'inherit' }} />
                        </div>

                        <button onClick={() => setShowSideEffects({ ...showSideEffects, [subId]: !showSE })}
                          style={{ alignSelf: 'flex-start', padding: '5px 10px', borderRadius: 12, fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: showSE ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)', color: showSE ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>
                          {showSE ? '✕ Скрыть побочки' : '⚠ Побочные эффекты'}
                        </button>
                        {showSE && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {SIDE_EFFECTS.map(eff => {
                              const active = si.sideEffects?.includes(eff) || false;
                              return (
                                <button key={eff} onClick={() => toggleSideEffect(subId, eff)}
                                  style={{
                                    padding: '5px 10px', borderRadius: 12, fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                                    background: active ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                                    color: active ? '#ef4444' : 'rgba(255,255,255,0.5)', fontWeight: active ? 700 : 400,
                                  }}>
                                  {active ? '✓ ' : ''}{eff}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {todaySideEffects.length > 0 && (
                <div style={{ ...sx.card, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>
                    ⚠ Побочные эффекты ({todaySideEffects.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {todaySideEffects.map(eff => (
                      <span key={eff} style={{ padding: '3px 8px', borderRadius: 10, fontSize: 9, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{eff}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add substance (popup card) */}
          <button onClick={() => setAddModal(true)} style={{
            width: '100%', padding: '13px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
            border: '1px dashed rgba(0,230,138,0.35)', background: 'rgba(0,230,138,0.04)', color: '#00e68a', fontWeight: 700, fontSize: 12,
          }}>+ Добавить вещество (не из плана)</button>

          {/* Compliance notes */}
          <div style={sx.card}>
            <div style={sx.sectionTitle}>📝 Заметки комплаенса</div>
            <textarea value={complianceNotes} onChange={e => setComplianceNotes(e.target.value)}
              placeholder="Причины пропусков, сложности с режимом приёма, на что обратить внимание…"
              style={{ width: '100%', minHeight: 50, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', color: 'rgba(255,255,255,0.85)', fontSize: 10, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>

          {/* General notes */}
          <div style={sx.card}>
            <div style={sx.sectionTitle}>📔 Заметки дня</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Самочувствие, особенности приёма, наблюдения…"
              style={{ width: '100%', minHeight: 50, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', color: 'rgba(255,255,255,0.85)', fontSize: 10, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={saveNotes} style={sx.accentBtn}>💾 Сохранить заметки</button>
            <button onClick={clearToday} style={{
              padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
              background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap', fontFamily: 'inherit', minHeight: 40,
            }}>✕ Очистить день</button>
          </div>
        </div>
      )}

      {/* ═══════════════ WEEK TAB ═══════════════ */}
      {tab === 'week' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={sx.card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>📅 Последние 7 дней</div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', minHeight: 64, padding: '8px 0' }}>
              {historyDays.map(day => (
                <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{
                    width: '100%', borderRadius: '5px 5px 0 0', height: Math.max(4, (day.pct / 100) * 48),
                    background: day.pct >= 80 ? '#00e68a' : day.pct >= 50 ? '#f59e0b' : '#ef4444',
                    opacity: day.date === today ? 1 : 0.6, transition: 'height 0.2s',
                  }} />
                  <div style={{ fontSize: 9, fontWeight: 700, color: day.pct >= 80 ? '#00e68a' : 'rgba(255,255,255,0.5)' }}>{day.pct}%</div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{dayOfWeek(day.date)}<br />{formatDate(day.date)}</div>
                </div>
              ))}
            </div>
          </div>

          {planSubs.length > 0 && (
            <div style={sx.card}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>🧬 Приём по веществам</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '5px 6px', color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Вещество</th>
                      {weekViewData.map(d => (
                        <th key={d.date} style={{ textAlign: 'center', padding: '5px 3px', color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 8 }}>{dayOfWeek(d.date)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {planSubs.map(subId => (
                      <tr key={subId}>
                        <td style={{ padding: '5px 6px', color: 'rgba(255,255,255,0.75)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{getName(subId)}</td>
                        {weekViewData.map(d => {
                          const taken = d.entry?.substances[subId]?.taken || false;
                          const ts = d.entry?.substances[subId]?.timeSlot;
                          return (
                            <td key={d.date} style={{ textAlign: 'center', padding: '5px 3px', borderBottom: '1px solid rgba(255,255,255,0.03)', color: taken ? '#00e68a' : 'rgba(255,255,255,0.15)' }}>
                              {taken ? (ts ? TIME_SLOTS.find(t => t.id === ts)?.icon || '✓' : '✓') : '·'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ HISTORY TAB ═══════════════ */}
      {tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={sx.card}>
            <input type="text" value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="🔍 Фильтр по веществу…"
              style={{ width: '100%', ...sx.input }} />
          </div>

          {editingDate ? (
            <PastDayEditor
              entry={editingEntry!}
              dateStr={editingDate}
              getName={getName}
              onSave={(n, m, subs) => saveEditedEntry(editingDate, n, m, subs)}
              onCancel={() => setEditingDate(null)}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredEntries.map(entry => {
                const takenSubs = Object.entries(entry.substances).filter(([, v]) => v.taken);
                const totalSubs = Object.keys(entry.substances).length;
                const moodIcon = entry.mood ? MOOD_OPTIONS.find(m => m.level === entry.mood)?.icon || '' : '';
                const entrySideEffects = new Set<string>();
                for (const [, v] of Object.entries(entry.substances)) if (v.sideEffects) v.sideEffects.forEach(e => entrySideEffects.add(e));
                return (
                  <div key={entry.date} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                          {formatDate(entry.date)} · {dayOfWeek(entry.date)} {moodIcon}
                        </div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                          принято {takenSubs.length}/{totalSubs || planSubs.length}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setEditingDate(entry.date)} style={{ padding: '5px 8px', borderRadius: 8, fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}>✎</button>
                        <button onClick={() => setEntries(prev => { const u = prev.filter(e => e.date !== entry.date); saveDiary(u); return u; })}
                          style={{ padding: '5px 8px', borderRadius: 8, fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>🗑</button>
                      </div>
                    </div>
                    {takenSubs.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
                        {takenSubs.map(([subId, v]) => (
                          <span key={subId} style={{ padding: '3px 8px', borderRadius: 9, fontSize: 8, background: 'rgba(0,230,138,0.08)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.12)' }}>
                            {getName(subId)}{v.dose ? ` ${v.dose}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {entrySideEffects.size > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                        {Array.from(entrySideEffects).map(eff => (
                          <span key={eff} style={{ padding: '2px 7px', borderRadius: 7, fontSize: 8, background: 'rgba(239,68,68,0.06)', color: '#ef4444' }}>⚠ {eff}</span>
                        ))}
                      </div>
                    )}
                    {entry.complianceNotes && (
                      <div style={{ fontSize: 8, color: 'rgba(245,158,11,0.8)', marginTop: 4 }}>📝 {entry.complianceNotes}</div>
                    )}
                    {entry.notes && (
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 3, fontStyle: 'italic' }}>{entry.notes}</div>
                    )}
                  </div>
                );
              })}
              {filteredEntries.length === 0 && (
                <div style={{ padding: 18, textAlign: 'center', ...sx.card }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    {filterText ? 'Нет записей по фильтру' : 'Нет записей за прошлые дни. Отмечайте приём каждый день.'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ STATS TAB ═══════════════ */}
      {tab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <MiniStat label="🔥 Streak" value={`${streak}д`} color={streak >= 3 ? '#00e68a' : '#94a3b8'} />
            <MiniStat label="📊 7д компл." value={`${weekCompliance}%`} color={weekCompliance >= 80 ? '#00e68a' : weekCompliance >= 50 ? '#f59e0b' : '#ef4444'} />
            <MiniStat label="🧪 Веществ" value={`${planSubs.length}`} color="#3b82f6" />
          </div>

          <div style={sx.card}>
            <div style={sx.sectionTitle}>📊 Комплаентность по дням</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', minHeight: 54, padding: '6px 0' }}>
              {historyDays.map(day => (
                <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: Math.max(3, (day.pct / 100) * 42), background: day.pct >= 80 ? '#00e68a' : day.pct >= 50 ? '#f59e0b' : '#ef4444', opacity: day.date === today ? 1 : 0.5 }} />
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{dayOfWeek(day.date)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={sx.card}>
            <div style={sx.sectionTitle}>⚠ Побочные эффекты (за 7 дней)</div>
            {(() => {
              const effectCount = new Map<string, number>();
              for (const entry of entries) for (const [, v] of Object.entries(entry.substances)) if (v.sideEffects) v.sideEffects.forEach(e => effectCount.set(e, (effectCount.get(e) || 0) + 1));
              const sorted = Array.from(effectCount.entries()).sort((a, b) => b[1] - a[1]);
              if (sorted.length === 0) return <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Нет зафиксированных побочных эффектов</div>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sorted.slice(0, 8).map(([eff, count]) => (
                    <div key={eff} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, padding: '3px 0' }}>
                      <span style={{ color: 'rgba(255,255,255,0.65)' }}>{eff}</span>
                      <span style={{ color: count > 3 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>{count}×</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div style={sx.card}>
            <div style={sx.sectionTitle}>😊 Настроение (за 7 дней)</div>
            {(() => {
              const moodEntries = entries.filter(e => e.mood && last7Days.includes(e.date)).sort((a, b) => a.date.localeCompare(b.date));
              if (moodEntries.length === 0) return <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Нет данных о настроении</div>;
              return (
                <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', minHeight: 40, padding: '6px 0' }}>
                  {moodEntries.map(e => {
                    const h = ((e.mood || 3) / 5) * 34;
                    return (
                      <div key={e.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: Math.max(3, h), background: (e.mood || 3) >= 4 ? '#00e68a' : (e.mood || 3) >= 3 ? '#f59e0b' : '#ef4444' }} />
                        <div style={{ fontSize: 11 }}>{MOOD_OPTIONS.find(m => m.level === e.mood)?.icon || '😐'}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div style={sx.card}>
            <div style={sx.sectionTitle}>📈 Дополнительно</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
              <span>Всего записей: <strong style={{ color: '#fff' }}>{entries.length}</strong></span>
              <span>Дней с приёмом: <strong style={{ color: '#fff' }}>{entries.filter(e => Object.values(e.substances).some(s => s.taken)).length}</strong></span>
              <span>Побочных эффектов: <strong style={{ color: '#fff' }}>{new Set(entries.flatMap(e => Object.values(e.substances).flatMap(s => s.sideEffects || []))).size}</strong></span>
              <span>Кастомных веществ: <strong style={{ color: '#fff' }}>{entries.filter(e => Object.keys(e.substances).some(k => k.startsWith('custom_'))).length} дн.</strong></span>
            </div>
          </div>

          <button onClick={() => {
            const w = window.open('', '_blank');
            if (!w) return;
            const allEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
            w.document.write(`
              <html><head><title>Дневник приёма БАД</title>
              <style>
                body { font-family: 'Segoe UI', sans-serif; font-size: 12px; padding: 20px; color: #222; max-width: 800px; margin: 0 auto; }
                h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 6px; }
                h2 { font-size: 14px; margin-top: 16px; color: #444; }
                table { width: 100%; border-collapse: collapse; margin-top: 6px; }
                th, td { padding: 5px 8px; border: 1px solid #ddd; text-align: left; font-size: 10px; }
                th { background: #f5f5f5; font-weight: 700; }
                .taken { color: #2e7d32; font-weight: 600; }
                .missed { color: #c62828; }
                .footer { margin-top: 20px; font-size: 9px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
                .effect { background: #ffebee; padding: 1px 4px; border-radius: 3px; font-size: 9px; }
                .mood { font-size: 16px; }
              </style></head><body>
              <h1>📋 Дневник приёма БАД</h1>
              <p>Период: ${allEntries[0]?.date || '—'} — ${allEntries[allEntries.length - 1]?.date || '—'}</p>
              <p>Всего записей: ${allEntries.length} · Streak: ${streak} дней · Комплаентность 7д: ${weekCompliance}%</p>
              ${allEntries.slice().reverse().map(e => {
                const taken = Object.entries(e.substances).filter(([,v]) => v.taken);
                const moodIcon = e.mood ? MOOD_OPTIONS.find(m => m.level === e.mood)?.icon || '' : '';
                const effs = new Set<string>();
                for (const [, v] of Object.entries(e.substances)) { if (v.sideEffects) v.sideEffects.forEach(x => effs.add(x)); }
                return `<h2>${e.date} ${moodIcon}</h2>
                <table><tr><th>Вещество</th><th>Статус</th><th>Время</th><th>Доза</th></tr>
                ${Object.entries(e.substances).map(([id, v]) => {
                  const name = getName(id);
                  const ts = v.timeSlot ? TIME_SLOTS.find(t => t.id === v.timeSlot)?.icon || '' : '';
                  return `<tr><td>${name}</td><td class="${v.taken ? 'taken' : 'missed'}">${v.taken ? '✓ принято' : '—'}</td><td>${ts}</td><td>${v.dose || '—'}</td></tr>`;
                }).join('')}
                </table>
                ${e.complianceNotes ? `<p><strong>Комплаенс:</strong> ${e.complianceNotes}</p>` : ''}
                ${e.notes ? `<p><em>${e.notes}</em></p>` : ''}
                ${effs.size > 0 ? `<p>${Array.from(effs).map(x => `<span class="effect">⚠ ${x}</span>`).join(' ')}</p>` : ''}`;
              }).join('')}
              <div class="footer">Сгенерировано BodyBuildHealth · he_support_diary</div>
              </body></html>
            `);
            w.document.close();
            setTimeout(() => w.print(), 500);
          }} style={{
            width: '100%', padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}>
            🖨 Экспорт дневника (PDF / печать)
          </button>
        </div>
      )}

      {/* ═══════════════ COMPLAINTS TAB ═══════════════ */}
      {tab === 'complaints' && <ComplaintsTab onOpenSolver={onOpenSolver} />}

      {addModal && <AddSubstanceModal onPick={addSubstance} onClose={() => setAddModal(false)} />}
    </div>
  );
};

// ─── Sub-components ───

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '10px 6px', textAlign: 'center', borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function PastDayEditor({ entry, dateStr, getName, onSave, onCancel }: {
  entry: DiaryEntry;
  dateStr: string;
  getName: (id: string) => string;
  onSave: (notes: string, mood: MoodLevel, subs: Record<string, SubstanceIntake>) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState(entry?.notes || '');
  const [mood, setMood] = useState<MoodLevel>(entry?.mood || 3);
  const [subs, setSubs] = useState<Record<string, SubstanceIntake>>(entry?.substances || {});

  const toggleSub = (id: string) => {
    setSubs(prev => ({ ...prev, [id]: { ...(prev[id] || { taken: false }), taken: !(prev[id]?.taken || false) } }));
  };

  return (
    <div style={{ padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8 }}>✎ Редактирование: {dateStr}</div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Настроение</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {MOOD_OPTIONS.map(m => (
          <button key={m.level} onClick={() => setMood(m.level)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: mood === m.level ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: mood === m.level ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)', textAlign: 'center', fontSize: 16 }}>{m.icon}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
        {Object.entries(subs).map(([id, v]) => {
          const displayName = id.startsWith('custom_') ? id.replace('custom_', '') : getName(id);
          return (
            <div key={id} onClick={() => toggleSub(id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: v.taken ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)', border: '1px solid ' + (v.taken ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)') }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: v.taken ? '#00e68a' : 'rgba(255,255,255,0.06)', color: v.taken ? '#000' : 'rgba(255,255,255,0.3)' }}>{v.taken ? '✓' : ''}</div>
              <span style={{ fontSize: 11, color: v.taken ? '#00e68a' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{displayName}</span>
              {v.dose && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>{v.dose}</span>}
            </div>
          );
        })}
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Заметки…"
        style={{ width: '100%', minHeight: 44, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', color: '#fff', fontSize: 10, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onSave(notes, mood, subs)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#00e68a', color: '#000', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>💾 Сохранить</button>
        <button onClick={onCancel} style={{ padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Отмена</button>
      </div>
    </div>
  );
}
