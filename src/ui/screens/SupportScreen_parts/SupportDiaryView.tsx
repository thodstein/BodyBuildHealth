import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-database';
import { getSubstanceName } from '../../../engines/stack-optimizer.engine';

const DIARY_KEY = 'he_support_diary';

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
    for (const subId of planSubs) {
      total++;
      if (entry.substances[subId]?.taken) taken++;
    }
  }
  if (total === 0) return 0;
  // fallback: if no plan, count what was taken
  return Math.round((taken / total) * 100);
}

/** SVG круглый прогресс-бар */
function CircularGauge({ pct, size = 80, stroke = 6 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? '#00e68a' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.4s' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={color}
        fontSize={size * 0.22} fontWeight={800}>{pct}%</text>
    </svg>
  );
}

// ─── Стили ───
const sx = {
  card: {
    background: 'rgba(24,24,27,0.15)', borderRadius: 12, padding: '12px 14px',
    border: '1px solid rgba(255,255,255,0.04)',
  } as React.CSSProperties,
  pill: (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
    cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
    background: active ? 'rgba(0,230,138,0.1)' : 'var(--bg-secondary, rgba(255,255,255,0.04))',
    color: active ? '#00e68a' : 'var(--text-dim, rgba(255,255,255,0.4))',
    border: active ? '1px solid rgba(0,230,138,0.25)' : '1px solid var(--border, rgba(255,255,255,0.08))',
  }),
  input: {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)',
    color: '#fff', fontSize: 11, boxSizing: 'border-box', fontFamily: 'inherit',
  } as React.CSSProperties,
  accentBtn: {
    padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #00e68a, #00c771)', color: '#000',
    fontWeight: 700, fontSize: 11, fontFamily: 'inherit', width: '100%',
  } as React.CSSProperties,
};

export const SupportDiaryView: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const { SUPPORT_LEVELS, supportLevel } = s;
  const [entries, setEntries] = useState<DiaryEntry[]>(loadDiary);
  const [notes, setNotes] = useState('');
  const [mood, setMood] = useState<MoodLevel>(3);
  const [viewDate, setViewDate] = useState(todayStr);
  const [tab, setTab] = useState<'today' | 'week' | 'history' | 'stats'>('today');
  const [customSubInput, setCustomSubInput] = useState('');
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [showSideEffects, setShowSideEffects] = useState<Record<string, boolean>>({});

  const today = todayStr();
  const todayEntry = entries.find(e => e.date === today);

  useEffect(() => {
    const prevNotes = todayEntry?.notes || '';
    setNotes(prevNotes);
    if (todayEntry?.mood) setMood(todayEntry.mood);
  }, [todayEntry?.notes, todayEntry?.mood]);

  const planSubs: string[] = SUPPORT_LEVELS?.[supportLevel]?.subs || [];

  // ─── Получить entry для редактирования ───
  const editingEntry = editingDate ? entries.find(e => e.date === editingDate) : null;

  // ─── Substance details ───
  const getCat = useCallback((subId: string) => SUPPORT_CATALOG_DATA[subId], []);
  const getName = useCallback((subId: string) => {
    const cat = getCat(subId);
    return cat?.nameRu || cat?.name || subId;
  }, [getCat]);

  // ─── Toggle taken for a sub on a specific date ───
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

  // ─── Mood ───
  const setMoodForToday = (m: MoodLevel) => {
    setMood(m);
    setEntries(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(e => e.date === today);
      if (idx < 0) {
        updated.unshift({ date: today, substances: {}, mood: m });
      } else {
        updated[idx] = { ...updated[idx], mood: m };
      }
      saveDiary(updated);
      return updated;
    });
  };

  // ─── Notes ───
  const saveNotes = () => {
    setEntries(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(e => e.date === today);
      if (idx < 0) {
        updated.unshift({ date: today, substances: {}, notes, mood });
      } else {
        updated[idx] = { ...updated[idx], notes, mood };
      }
      saveDiary(updated);
      return updated;
    });
  };

  // ─── Clear today ───
  const clearToday = () => {
    setEntries(prev => {
      const updated = prev.filter(e => e.date !== today);
      saveDiary(updated);
      return updated;
    });
    setNotes('');
    setMood(3);
  };

  // ─── Edit past entry ───
  const saveEditedEntry = (dateStr: string, newNotes: string, newMood: MoodLevel, newSubs: Record<string, SubstanceIntake>) => {
    setEntries(prev => {
      const updated = prev.map(e => e.date === dateStr ? { ...e, notes: newNotes, mood: newMood, substances: newSubs } : e);
      saveDiary(updated);
      return updated;
    });
    setEditingDate(null);
  };

  // ─── Batch ───
  const markAllTaken = () => {
    setEntries(prev => {
      const updated = [...prev];
      let idx = updated.findIndex(e => e.date === today);
      if (idx < 0) {
        updated.unshift({ date: today, substances: {} });
        idx = 0;
      }
      const subs = { ...updated[idx].substances };
      for (const subId of planSubs) {
        subs[subId] = { ...(subs[subId] || { taken: false }), taken: true };
      }
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
      for (const subId of planSubs) {
        subs[subId] = { taken: false };
      }
      updated[idx] = { ...updated[idx], substances: subs };
      saveDiary(updated);
      return updated;
    });
  };

  // ─── Custom substance ───
  const addCustomSubstance = () => {
    const name = customSubInput.trim();
    if (!name) return;
    setSubState(today, `custom_${name}`, { taken: true });
    setCustomSubInput('');
  };

  // ─── Add side effect to a substance ───
  const toggleSideEffect = (subId: string, effect: string) => {
    const curr = todayEntry?.substances[subId]?.sideEffects || [];
    const next = curr.includes(effect) ? curr.filter(e => e !== effect) : [...curr, effect];
    setSubState(today, subId, { sideEffects: next });
  };

  // ─── Stats ───
  const streak = useMemo(() => calcStreak(entries, today), [entries, today]);
  const weekCompliance = useMemo(() => calcWeekCompliance(entries, planSubs), [entries, planSubs]);

  const stats = useMemo(() => {
    const last7 = getLastNDays(7);
    const daysWithData = last7.filter(d => entries.find(e => e.date === d));
    return {
      totalDays: daysWithData.length,
      avgCompliance: weekCompliance,
      bestDay: '',
      worstDay: '',
      totalSubstances: planSubs.length,
    };
  }, [entries, planSubs, weekCompliance]);

  // ─── Last 7 days for chart ───
  const last7Days = getLastNDays(7);
  const historyDays = last7Days.map(dateStr => {
    const entry = entries.find(e => e.date === dateStr);
    let takenCount = 0;
    let total = planSubs.length || 1;
    if (entry) {
      takenCount = Object.entries(entry.substances).filter(([, v]) => v.taken).length;
      // include custom substances
      const customCount = Object.keys(entry.substances).filter(k => k.startsWith('custom_')).length;
      if (customCount > 0) total += customCount;
    }
    return { date: dateStr, takenCount, total, pct: total > 0 ? Math.round((takenCount / total) * 100) : 0 };
  });

  // ─── Side effects today ───
  const todaySideEffects = useMemo(() => {
    const effects = new Set<string>();
    if (!todayEntry) return [];
    for (const [, v] of Object.entries(todayEntry.substances)) {
      if (v.sideEffects) v.sideEffects.forEach(e => effects.add(e));
    }
    return Array.from(effects);
  }, [todayEntry]);

  // ─── Filter history ───
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

  // ─── Week view data ───
  const weekViewData = useMemo(() => {
    return last7Days.map(dateStr => {
      const entry = entries.find(e => e.date === dateStr);
      return { date: dateStr, entry };
    });
  }, [entries]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 80 }}>
      {/* HEADER: Streak + Gauge */}
      <div style={{ ...sx.card, display: 'flex', alignItems: 'center', gap: 14 }}>
        <CircularGauge pct={weekCompliance} size={68} stroke={5} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>
            Комплаентность за 7 дней
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: streak >= 3 ? '#00e68a' : 'rgba(255,255,255,0.4)' }}>
              {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} 🔥
            </span>
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
            непрерывного приёма · {planSubs.length} веществ в плане
          </div>
        </div>
      </div>

      {/* Tab pills */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {[
          ['today', '📋 Сегодня'],
          ['week', '📅 Неделя'],
          ['history', '📊 История'],
          ['stats', '📈 Статистика'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)} style={sx.pill(tab === id)}>{label}</button>
        ))}
      </div>

      {/* ═══════════════ TODAY TAB ═══════════════ */}
      {tab === 'today' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Date + Mood */}
          <div style={{ ...sx.card }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
              {dayName(today)}, {formatDate(today)}
            </div>
            {/* Mood selector */}
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Самочувствие</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {MOOD_OPTIONS.map(m => (
                <button key={m.level} onClick={() => setMoodForToday(m.level)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                    border: mood === m.level ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
                    background: mood === m.level ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)',
                    textAlign: 'center', transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 16 }}>{m.icon}</div>
                  <div style={{ fontSize: 7, color: mood === m.level ? '#00e68a' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{m.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Batch buttons */}
          {planSubs.length > 0 && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={markAllTaken} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.06)', color: '#00e68a',
                fontWeight: 600, fontSize: 10,
              }}>✅ Все приняты</button>
              <button onClick={markAllNotTaken} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.05)', color: '#ef4444',
                fontWeight: 600, fontSize: 10,
              }}>✕ Сбросить все</button>
            </div>
          )}

          {/* Substance list */}
          {planSubs.length === 0 && !customSubInput ? (
            <div style={{ padding: 24, textAlign: 'center', ...sx.card }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>📋</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Нет активного плана поддержки</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                Перейдите в 🧮 Калькулятор и выполните расчёт
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {planSubs.map((subId: string) => {
                const cat = getCat(subId);
                const name = getName(subId);
                const dose = cat?.dosage?.mg ? `${cat.dosage.mg} мг` : '';
                const timing = cat?.dosage?.timing || '';
                const si = todayEntry?.substances[subId] || { taken: false };
                const taken = si.taken;
                const showSE = showSideEffects[subId] || false;

                const timeSlotIcons = (ts?: TimeSlot) => {
                  const slot = TIME_SLOTS.find(t => t.id === (ts || timing.toLowerCase() as TimeSlot));
                  return slot ? slot.icon : '';
                };

                return (
                  <div key={subId} style={{
                    borderRadius: 10,
                    background: taken ? 'rgba(0,230,138,0.04)' : 'var(--bg-secondary, rgba(255,255,255,0.02))',
                    border: '1px solid ' + (taken ? 'rgba(0,230,138,0.15)' : 'var(--border, rgba(255,255,255,0.06))'),
                    overflow: 'hidden', transition: 'all 0.15s',
                  }}>
                    {/* Main row */}
                    <div onClick={() => toggleTaken(subId)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer' }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                        background: taken ? '#00e68a' : 'rgba(255,255,255,0.06)',
                        color: taken ? '#000' : 'rgba(255,255,255,0.4)',
                        transition: 'all 0.15s',
                      }}>
                        {taken ? '✓' : '○'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: taken ? '#00e68a' : 'rgba(255,255,255,0.8)' }}>
                          {name}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                          {(dose || timing) && (
                            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
                              {dose}{dose && timing ? ' · ' : ''}{timeSlotIcons()} {timing}
                            </span>
                          )}
                        </div>
                      </div>
                      {taken && <span style={{ fontSize: 9, color: '#00e68a', fontWeight: 700, whiteSpace: 'nowrap' }}>принято</span>}
                    </div>

                    {/* Expand: time slot, dose, side effects */}
                    {taken && (
                      <div style={{ padding: '0 12px 10px 44px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {/* Time slot */}
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {TIME_SLOTS.map(ts => (
                            <button key={ts.id} onClick={() => setSubState(today, subId, { timeSlot: si.timeSlot === ts.id ? undefined : ts.id })}
                              style={{
                                padding: '3px 8px', borderRadius: 12, fontSize: 8, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                                background: si.timeSlot === ts.id ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
                                color: si.timeSlot === ts.id ? '#00e68a' : 'rgba(255,255,255,0.5)',
                                fontWeight: si.timeSlot === ts.id ? 700 : 400,
                              }}>
                              {ts.icon} {ts.label}
                            </button>
                          ))}
                        </div>

                        {/* Dose */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>Доза:</span>
                          <input type="text" value={si.dose || dose || ''} onChange={e => setSubState(today, subId, { dose: e.target.value })}
                            placeholder="факт. доза"
                            style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', color: '#fff', fontSize: 9, fontFamily: 'inherit' }} />
                        </div>

                        {/* Side effects toggle */}
                        <button onClick={() => setShowSideEffects({ ...showSideEffects, [subId]: !showSE })}
                          style={{ alignSelf: 'flex-start', padding: '3px 8px', borderRadius: 12, fontSize: 8, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: showSE ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)', color: showSE ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>
                          {showSE ? '✕ Скрыть побочки' : '⚠ Побочные эффекты'}
                        </button>
                        {showSE && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {SIDE_EFFECTS.map(eff => {
                              const active = si.sideEffects?.includes(eff) || false;
                              return (
                                <button key={eff} onClick={() => toggleSideEffect(subId, eff)}
                                  style={{
                                    padding: '3px 8px', borderRadius: 12, fontSize: 8, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                                    background: active ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                                    color: active ? '#ef4444' : 'rgba(255,255,255,0.5)',
                                    fontWeight: active ? 700 : 400,
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

              {/* Side effects summary for today */}
              {todaySideEffects.length > 0 && (
                <div style={{ ...sx.card, padding: '8px 12px', marginTop: 2 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: '#ef4444', marginBottom: 3 }}>
                    ⚠ Побочные эффекты ({todaySideEffects.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {todaySideEffects.map(eff => (
                      <span key={eff} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                        {eff}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom substance */}
          <div style={{ ...sx.card, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>➕ Добавить вещество (не из плана)</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input type="text" value={customSubInput} onChange={e => setCustomSubInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomSubstance()}
                placeholder="Название…" style={{ flex: 1, ...sx.input, fontSize: 10, padding: '6px 8px' }} />
              <button onClick={addCustomSubstance}
                style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: '#00e68a', color: '#000', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap' }}>
                ➕
              </button>
            </div>
          </div>

          {/* Notes */}
          <div style={sx.card}>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Заметки: самочувствие, побочные эффекты, особенности приёма…"
              style={{ width: '100%', minHeight: 55, padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', color: 'rgba(255,255,255,0.8)', fontSize: 10, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <button onClick={saveNotes} style={sx.accentBtn}>💾 Сохранить заметки</button>
              <button onClick={clearToday} style={{
                padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)',
                cursor: 'pointer', background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontWeight: 600, fontSize: 9, whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}>✕ Очистить день</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ WEEK TAB ═══════════════ */}
      {tab === 'week' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ ...sx.card }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
              📅 Последние 7 дней
            </div>
            {/* Bars */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', minHeight: 60, padding: '6px 0' }}>
              {historyDays.map((day, i) => (
                <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: '100%', borderRadius: '4px 4px 0 0',
                    height: Math.max(3, (day.pct / 100) * 44),
                    background: day.pct >= 80 ? '#00e68a' : day.pct >= 50 ? '#f59e0b' : '#ef4444',
                    opacity: day.date === today ? 1 : 0.6,
                    transition: 'height 0.2s',
                  }} />
                  <div style={{ fontSize: 8, fontWeight: 700, color: day.pct >= 80 ? '#00e68a' : 'rgba(255,255,255,0.5)' }}>
                    {day.pct}%
                  </div>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                    {dayOfWeek(day.date)}<br />{formatDate(day.date)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Per-substance week grid */}
          {planSubs.length > 0 && (
            <div style={sx.card}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                🧬 Приём по веществам
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '4px 6px', color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Вещество</th>
                      {weekViewData.map(d => (
                        <th key={d.date} style={{ textAlign: 'center', padding: '4px 2px', color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 7 }}>
                          {dayOfWeek(d.date)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {planSubs.map(subId => (
                      <tr key={subId}>
                        <td style={{ padding: '4px 6px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          {getName(subId)}
                        </td>
                        {weekViewData.map(d => {
                          const taken = d.entry?.substances[subId]?.taken || false;
                          const ts = d.entry?.substances[subId]?.timeSlot;
                          return (
                            <td key={d.date} style={{
                              textAlign: 'center', padding: '4px 2px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                              color: taken ? '#00e68a' : 'rgba(255,255,255,0.15)',
                            }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Search/filter */}
          <div style={sx.card}>
            <input type="text" value={filterText} onChange={e => setFilterText(e.target.value)}
              placeholder="🔍 Фильтр по веществу…"
              style={{ width: '100%', ...sx.input, fontSize: 10 }} />
          </div>

          {/* Past entries */}
          {editingDate ? (
            <PastDayEditor
              entry={editingEntry!}
              dateStr={editingDate}
              getName={getName}
              onSave={(notes, mood, subs) => saveEditedEntry(editingDate, notes, mood, subs)}
              onCancel={() => setEditingDate(null)}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredEntries.map(entry => {
                const takenSubs = Object.entries(entry.substances).filter(([, v]) => v.taken);
                const totalSubs = Object.keys(entry.substances).length;
                const moodIcon = entry.mood ? MOOD_OPTIONS.find(m => m.level === entry.mood)?.icon || '' : '';
                const entrySideEffects = new Set<string>();
                for (const [, v] of Object.entries(entry.substances)) {
                  if (v.sideEffects) v.sideEffects.forEach(e => entrySideEffects.add(e));
                }
                return (
                  <div key={entry.date} style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                          {formatDate(entry.date)} · {dayOfWeek(entry.date)} {moodIcon}
                        </div>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                          принято {takenSubs.length}/{totalSubs || planSubs.length}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button onClick={() => setEditingDate(entry.date)}
                          style={{ padding: '3px 6px', borderRadius: 6, fontSize: 8, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}>✎</button>
                        <button onClick={() => {
                          setEntries(prev => {
                            const updated = prev.filter(e => e.date !== entry.date);
                            saveDiary(updated);
                            return updated;
                          });
                        }}
                          style={{ padding: '3px 6px', borderRadius: 6, fontSize: 8, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>🗑</button>
                      </div>
                    </div>
                    {/* Taken substances chips */}
                    {takenSubs.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 4 }}>
                        {takenSubs.map(([subId, v]) => (
                          <span key={subId} style={{
                            padding: '2px 6px', borderRadius: 8, fontSize: 7, background: 'rgba(0,230,138,0.08)', color: '#00e68a',
                            border: '1px solid rgba(0,230,138,0.12)',
                          }}>
                            {getName(subId)}{v.dose ? ` ${v.dose}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Side effects */}
                    {entrySideEffects.size > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                        {Array.from(entrySideEffects).map(eff => (
                          <span key={eff} style={{ padding: '1px 6px', borderRadius: 6, fontSize: 7, background: 'rgba(239,68,68,0.06)', color: '#ef4444' }}>
                            ⚠ {eff}
                          </span>
                        ))}
                      </div>
                    )}
                    {entry.notes && (
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginTop: 3, fontStyle: 'italic' }}>
                        {entry.notes}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredEntries.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', ...sx.card }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <MiniStat label="🔥 Streak" value={`${streak}д`} color={streak >= 3 ? '#00e68a' : '#94a3b8'} />
            <MiniStat label="📊 7д компл." value={`${weekCompliance}%`} color={weekCompliance >= 80 ? '#00e68a' : weekCompliance >= 50 ? '#f59e0b' : '#ef4444'} />
            <MiniStat label="🧪 Веществ" value={`${planSubs.length}`} color="#3b82f6" />
          </div>

          {/* Weekly breakdown */}
          <div style={sx.card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
              📊 Комплаентность по дням
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', minHeight: 50, padding: '4px 0' }}>
              {historyDays.map((day, i) => (
                <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <div style={{
                    width: '100%', borderRadius: '3px 3px 0 0',
                    height: Math.max(2, (day.pct / 100) * 38),
                    background: day.pct >= 80 ? '#00e68a' : day.pct >= 50 ? '#f59e0b' : '#ef4444',
                    opacity: day.date === today ? 1 : 0.5,
                  }} />
                  <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                    {dayOfWeek(day.date)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Side effects summary */}
          <div style={sx.card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
              ⚠ Побочные эффекты (за 7 дней)
            </div>
            {(() => {
              const effectCount = new Map<string, number>();
              for (const entry of entries) {
                for (const [, v] of Object.entries(entry.substances)) {
                  if (v.sideEffects) {
                    v.sideEffects.forEach(e => effectCount.set(e, (effectCount.get(e) || 0) + 1));
                  }
                }
              }
              const sorted = Array.from(effectCount.entries()).sort((a, b) => b[1] - a[1]);
              if (sorted.length === 0) {
                return <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Нет зафиксированных побочных эффектов</div>;
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {sorted.slice(0, 8).map(([eff, count]) => (
                    <div key={eff} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, padding: '2px 0' }}>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{eff}</span>
                      <span style={{ color: count > 3 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>{count}×</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Mood trend */}
          <div style={sx.card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
              😊 Настроение (за 7 дней)
            </div>
            {(() => {
              const moodEntries = entries
                .filter(e => e.mood && last7Days.includes(e.date))
                .sort((a, b) => a.date.localeCompare(b.date));
              if (moodEntries.length === 0) {
                return <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Нет данных о настроении</div>;
              }
              return (
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', minHeight: 36, padding: '4px 0' }}>
                  {moodEntries.map(e => {
                    const m = MOOD_OPTIONS.find(m => m.level === e.mood);
                    const h = ((e.mood || 3) / 5) * 30;
                    return (
                      <div key={e.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <div style={{
                          width: '100%', borderRadius: '3px 3px 0 0',
                          height: Math.max(2, h),
                          background: (e.mood || 3) >= 4 ? '#00e68a' : (e.mood || 3) >= 3 ? '#f59e0b' : '#ef4444',
                        }} />
                        <div style={{ fontSize: 10 }}>{m?.icon || '😐'}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Extra stats */}
          <div style={sx.card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
              📈 Дополнительно
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
              <span>Всего записей: <strong style={{ color: '#fff' }}>{entries.length}</strong></span>
              <span>Дней с приёмом: <strong style={{ color: '#fff' }}>{entries.filter(e => Object.values(e.substances).some(s => s.taken)).length}</strong></span>
              <span>Побочных эффектов: <strong style={{ color: '#fff' }}>{new Set(entries.flatMap(e => Object.values(e.substances).flatMap(s => s.sideEffects || []))).size}</strong></span>
              <span>Кастомных веществ: <strong style={{ color: '#fff' }}>{entries.filter(e => Object.keys(e.substances).some(k => k.startsWith('custom_'))).length} дн.</strong></span>
            </div>
          </div>

          {/* Export button */}
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
                ${e.notes ? `<p><em>${e.notes}</em></p>` : ''}
                ${effs.size > 0 ? `<p>${Array.from(effs).map(x => `<span class="effect">⚠ ${x}</span>`).join(' ')}</p>` : ''}`;
              }).join('')}
              <div class="footer">Сгенерировано BodyBuildHealth · he_support_diary</div>
              </body></html>
            `);
            w.document.close();
            setTimeout(() => w.print(), 500);
          }} style={{
            width: '100%', padding: '10px', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
          }}>
            🖨 Экспорт дневника (PDF / печать)
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ───

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 4px', textAlign: 'center',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{label}</div>
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
    setSubs(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { taken: false }), taken: !(prev[id]?.taken || false) },
    }));
  };

  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
        ✎ Редактирование: {dateStr}
      </div>

      {/* Mood */}
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Настроение</div>
      <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
        {MOOD_OPTIONS.map(m => (
          <button key={m.level} onClick={() => setMood(m.level)}
            style={{
              flex: 1, padding: '4px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              border: mood === m.level ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
              background: mood === m.level ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)',
              textAlign: 'center', fontSize: 14,
            }}>{m.icon}</button>
        ))}
      </div>

      {/* Substances */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
        {Object.entries(subs).map(([id, v]) => {
          const name = getName(id);
          const displayName = id.startsWith('custom_') ? id.replace('custom_', '') : name;
          return (
            <div key={id} onClick={() => toggleSub(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                background: v.taken ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)',
                border: '1px solid ' + (v.taken ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)'),
              }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700,
                background: v.taken ? '#00e68a' : 'rgba(255,255,255,0.06)',
                color: v.taken ? '#000' : 'rgba(255,255,255,0.3)',
              }}>{v.taken ? '✓' : ''}</div>
              <span style={{ fontSize: 10, color: v.taken ? '#00e68a' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{displayName}</span>
              {v.dose && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>{v.dose}</span>}
            </div>
          );
        })}
      </div>

      {/* Notes */}
      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Заметки…"
        style={{ width: '100%', minHeight: 40, padding: 6, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', color: '#fff', fontSize: 9, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 6 }} />

      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => onSave(notes, mood, subs)} style={{
          flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: '#00e68a', color: '#000', fontWeight: 700, fontSize: 10, fontFamily: 'inherit',
        }}>💾 Сохранить</button>
        <button onClick={onCancel} style={{
          padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
          border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', fontSize: 10,
        }}>Отмена</button>
      </div>
    </div>
  );
}
