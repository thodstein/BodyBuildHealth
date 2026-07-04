import React, { useState, useEffect, useCallback } from 'react';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-database';
import { getSubstanceName } from '../../../engines/stack-optimizer.engine';

const DIARY_KEY = 'he_support_diary';

interface DiaryEntry {
  date: string;
  substances: Record<string, { taken: boolean; dose?: string; timing?: string }>;
  notes?: string;
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

export const SupportDiaryView: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const { SUPPORT_LEVELS, supportLevel } = s;
  const [entries, setEntries] = useState<DiaryEntry[]>(loadDiary);
  const [notes, setNotes] = useState('');
  const [viewDate, setViewDate] = useState(todayStr);
  const [tab, setTab] = useState<'today' | 'history'>('today');

  const today = todayStr();
  const todayEntry = entries.find(e => e.date === today);

  useEffect(() => {
    const prevNotes = todayEntry?.notes || '';
    setNotes(prevNotes);
  }, [todayEntry?.notes]);

  const planSubs = SUPPORT_LEVELS?.[supportLevel]?.subs || [];

  const toggleTaken = useCallback((subId: string) => {
    setEntries(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(e => e.date === today);
      if (idx < 0) {
        updated.unshift({ date: today, substances: { [subId]: { taken: true } } });
      } else {
        updated[idx] = {
          ...updated[idx],
          substances: {
            ...updated[idx].substances,
            [subId]: { taken: !updated[idx].substances[subId]?.taken },
          },
        };
      }
      saveDiary(updated);
      return updated;
    });
  }, [today]);

  const saveNotes = () => {
    setEntries(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(e => e.date === today);
      if (idx < 0) {
        updated.unshift({ date: today, substances: {}, notes });
      } else {
        updated[idx] = { ...updated[idx], notes };
      }
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
    setNotes('');
  };

  const streak = calcStreak(entries, today);

  const last7Days = getLastNDays(7);
  const historyDays = last7Days.map(dateStr => {
    const entry = entries.find(e => e.date === dateStr);
    const takenCount = entry ? Object.values(entry.substances).filter(s => s.taken).length : 0;
    const total = planSubs.length || 1;
    return { date: dateStr, takenCount, total, pct: total > 0 ? Math.round((takenCount / total) * 100) : 0 };
  });

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Streak */}
      <div style={{
        padding: '12px 14px', borderRadius: 10, marginBottom: 8,
        background: streak >= 3 ? 'linear-gradient(135deg,rgba(0,230,138,0.08),rgba(0,200,83,0.04))' : 'var(--bg-secondary)',
        border: streak >= 3 ? '1px solid rgba(0,230,138,0.2)' : '1px solid var(--border)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: streak >= 3 ? 'var(--accent)' : 'var(--text-dim)' }}>
          {streak} {streak === 1 ? 'день' : 'дня'} 🔥
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
          непрерывного приёма
        </div>
      </div>

      {/* Tab pills */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[['today', '📋 Сегодня'], ['history', '📊 История']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
            background: tab === id ? 'var(--accent)' : 'var(--bg-secondary)',
            color: tab === id ? '#000' : 'var(--text-dim)',
            border: '1px solid ' + (tab === id ? 'var(--accent)' : 'var(--border)'),
          }}>{label}</button>
        ))}
      </div>

      {/* TODAY TAB */}
      {tab === 'today' && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)', marginBottom: 6 }}>
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>

          {planSubs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📋</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Нет активного плана поддержки</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                Перейдите в 🧮 Калькулятор и выполните расчёт
              </div>
            </div>
          ) : (
            <div>
              {planSubs.map((subId: string) => {
                const cat = SUPPORT_CATALOG_DATA[subId];
                const name = cat?.nameRu || cat?.name || subId;
                const dose = cat?.dosage?.mg ? `${cat.dosage.mg} мг` : '';
                const timing = cat?.dosage?.timing || '';
                const taken = todayEntry?.substances[subId]?.taken || false;
                return (
                  <div key={subId} onClick={() => toggleTaken(subId)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                    marginBottom: 4, borderRadius: 8, cursor: 'pointer',
                    background: taken ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)',
                    border: '1px solid ' + (taken ? 'rgba(0,230,138,0.25)' : 'var(--border)'),
                    transition: 'all 0.15s',
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                      background: taken ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                      color: taken ? '#000' : 'var(--text-dim)',
                    }}>
                      {taken ? '✓' : '○'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: taken ? 'var(--accent)' : 'var(--text-light)' }}>
                        {name}
                      </div>
                      {(dose || timing) && (
                        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 1 }}>
                          {dose}{dose && timing ? ' · ' : ''}{timing}
                        </div>
                      )}
                    </div>
                    {taken && <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700 }}>принято</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          <div style={{ marginTop: 8 }}>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Заметки: самочувствие, побочные эффекты, особенности приёма…"
              style={{ width: '100%', minHeight: 60, padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 10, resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <button onClick={saveNotes} style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(0,230,138,0.1)', color: 'var(--accent)', fontWeight: 700, fontSize: 10 }}>💾 Сохранить заметки</button>
              <button onClick={clearToday} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600, fontSize: 9, whiteSpace: 'nowrap' }}>✕ Очистить</button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Последние 7 дней</div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', minHeight: 70, padding: 8, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            {historyDays.map((day, i) => (
              <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: 7, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                  {dayOfWeek(day.date)}
                </div>
                <div style={{
                  width: '100%', borderRadius: '4px 4px 0 0',
                  height: Math.max(4, (day.pct / 100) * 50),
                  background: day.pct >= 80 ? 'var(--accent)' : day.pct >= 50 ? '#f59e0b' : '#ef4444',
                  opacity: day.date === today ? 1 : 0.6,
                  transition: 'height 0.2s',
                }} />
                <div style={{
                  fontSize: 7, fontWeight: 700, color: day.pct >= 80 ? 'var(--accent)' : 'var(--text-dim)',
                }}>
                  {day.takenCount}/{day.total}
                </div>
                <div style={{ fontSize: 6, color: 'var(--text-dim)' }}>
                  {formatDate(day.date)}
                </div>
              </div>
            ))}
          </div>

          {/* Past entries list */}
          <div style={{ marginTop: 8 }}>
            {entries.filter(e => e.date !== today).slice(0, 10).map(entry => {
              const takenSubs = Object.entries(entry.substances).filter(([, v]) => v.taken).length;
              const totalSubs = Object.keys(entry.substances).length;
              return (
                <div key={entry.date} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', marginBottom: 4, borderRadius: 6,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-light)' }}>
                      {formatDate(entry.date)} · {dayOfWeek(entry.date)}
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 1 }}>
                      принято {takenSubs}/{totalSubs || planSubs.length}
                    </div>
                    {entry.notes && (
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontStyle: 'italic' }}>
                        {entry.notes}
                      </div>
                    )}
                  </div>
                  <button onClick={() => {
                    setEntries(prev => {
                      const updated = prev.filter(e => e.date !== entry.date);
                      saveDiary(updated);
                      return updated;
                    });
                  }} style={{ padding: '3px 6px', borderRadius: 4, fontSize: 8, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>🗑</button>
                </div>
              );
            })}
            {entries.filter(e => e.date !== today).length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 9, color: 'var(--text-dim)' }}>
                Нет записей за прошлые дни. Отмечайте приём каждый день.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
