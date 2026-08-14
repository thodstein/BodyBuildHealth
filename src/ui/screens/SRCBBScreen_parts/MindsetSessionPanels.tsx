/**
 * MindsetSessionPanels.tsx — психо-панели экрана выполнения сессии (SessionPlayer).
 *
 * 1. MindsetPreSessionCard — фаза 'ready': протокол дня (по типу дня) с чекбоксами.
 *    Прогресс дня хранится в he_mindset_day_progress (движок).
 * 2. MindsetApproachHint — фаза 'main': подсказка ритуала «перед подходом»
 *    для упражнения, к которому ещё не приступали.
 * 3. MindsetCheckinCard — фаза 'done': чек-ин уверенность/активация/фокус +
 *    выполнение протокола → he_mindset_checks.
 *
 * Отображение-онли: панели не влияют на план/авторегуляцию.
 */
import React, { useMemo, useState } from 'react';
import {
  loadActiveProtocol, detectDayType, itemsForDay,
  loadDayProgress, saveDayProgress,
  upsertCheckin, latestCheckin,
  KIND_LABELS, DAYTYPE_LABELS,
  type MindsetDayType,
} from '../../../engines/mindset-protocol.engine';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.55)';
const KIND_ICON: Record<string, string> = { pre: '🌅', approach: '🎯', post: '🌙' };

function runtimeTrack(): string | undefined {
  try {
    const raw = JSON.parse(localStorage.getItem('he_pl_runtime') || 'null');
    return raw && typeof raw.track === 'string' ? raw.track : undefined;
  } catch { return undefined; }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ═══════════ 1. Pre-session протокол дня ═══════════ */

export const MindsetPreSessionCard: React.FC<{ focus: string; dayLabel: string }> = ({ focus, dayLabel }) => {
  const [tick, setTick] = useState(0);
  const dayType: MindsetDayType = useMemo(() => detectDayType(focus, runtimeTrack()), [focus, tick]);
  const protocol = useMemo(() => loadActiveProtocol(), [tick]);
  const items = useMemo(() => itemsForDay(protocol, dayType), [protocol, dayType, tick]);
  const progress = useMemo(() => loadDayProgress(todayKey()), [tick]);

  if (!protocol || items.length === 0) return null;

  const toggle = (itemId: string) => {
    const done = progress.doneItems.includes(itemId)
      ? progress.doneItems.filter(x => x !== itemId)
      : [...progress.doneItems, itemId];
    saveDayProgress({ date: todayKey(), doneItems: done });
    setTick(t => t + 1);
  };

  const doneCount = items.filter(it => progress.doneItems.includes(it.id)).length;
  const pct = items.length > 0 ? Math.round(doneCount / items.length * 100) : 0;

  return (
    <div style={{ ...CARD, border: '1px solid rgba(167,139,250,0.35)', background: 'rgba(167,139,250,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>🧠 Психология: {protocol.name}</div>
        <span style={{ fontSize: 9, color: pct === 100 ? '#22c55e' : DIM }}>{doneCount}/{items.length} шагов · {pct}%</span>
      </div>
      <div style={{ fontSize: 9, color: DIM, margin: '4px 0 8px' }}>
        {dayLabel} · тип дня: {DAYTYPE_LABELS[dayType]}
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: pct === 100 ? '#22c55e' : '#a78bfa', transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(it => {
          const done = progress.doneItems.includes(it.id);
          return (
            <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input type="checkbox" checked={done} onChange={() => toggle(it.id)} aria-label={`Шаг: ${it.title}`}
                style={{ marginTop: 2, width: 15, height: 15, cursor: 'pointer' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: done ? 'rgba(255,255,255,0.4)' : '#fff', textDecoration: done ? 'line-through' : 'none' }}>
                  {KIND_ICON[it.kind]} {it.title} <span style={{ fontSize: 9, color: DIM, fontWeight: 400 }}>({KIND_LABELS[it.kind]} · {it.durationMin} мин)</span>
                </div>
                {!done && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45, marginTop: 2 }}>{it.script}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════ 2. Подсказка ритуала перед подходом ═══════════ */

export const MindsetApproachHint: React.FC<{ focus: string; exerciseStarted: boolean }> = ({ focus, exerciseStarted }) => {
  const dayType: MindsetDayType = useMemo(() => detectDayType(focus, runtimeTrack()), [focus]);
  const protocol = useMemo(() => loadActiveProtocol(), []);
  const items = useMemo(() => itemsForDay(protocol, dayType).filter(it => it.kind === 'approach'), [protocol, dayType]);

  if (exerciseStarted || items.length === 0) return null;
  const hint = items[0];
  return (
    <div style={{ margin: '6px 0', padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b' }}>🎯 Перед первым подходом: {hint.title} (~{hint.durationMin} мин)</span>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginLeft: 6 }}>{hint.script.length > 140 ? hint.script.slice(0, 140) + '…' : hint.script}</span>
    </div>
  );
};

/* ═══════════ 3. Пост-сессия: психо-чек-ин ═══════════ */

export const MindsetCheckinCard: React.FC<{ sessionId?: string }> = ({ sessionId }) => {
  const [confidence, setConfidence] = useState(4);
  const [arousal, setArousal] = useState(3);
  const [focus, setFocus] = useState(4);
  const [followed, setFollowed] = useState<boolean | null>(true);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const save = () => {
    upsertCheckin({
      date: todayKey(),
      sessionId,
      confidence, arousal, focus,
      protocolFollowed: followed,
      note: note.trim() || undefined,
    });
    setSaved(true);
  };

  const Scale = ({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: number) => void }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{label}</span>
        <span style={{ fontSize: 8, color: DIM }}>{hint}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 3 }} role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map(v => (
          <button key={v} type="button" role="radio" aria-checked={value === v} aria-label={`${label} ${v}`} onClick={() => onChange(v)}
            style={{
              flex: 1, minHeight: 32, borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
              border: value === v ? '1px solid rgba(0,230,138,0.5)' : '1px solid rgba(255,255,255,0.08)',
              background: value === v ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)',
              color: value === v ? ACCENT : 'rgba(255,255,255,0.5)',
            }}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ ...CARD, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>🧠 Психо-чек-ин сессии</div>
        {saved && <span style={{ fontSize: 9, color: ACCENT }}>✓ сохранено</span>}
      </div>
      <div style={{ fontSize: 9, color: DIM, margin: '4px 0 8px' }}>Три шкалы после сессии — тренды и связь с e1RM появятся во вкладке «Психология» дневника.</div>
      <Scale label="Уверенность" hint="вера в план и веса" value={confidence} onChange={setConfidence} />
      <Scale label="Активация" hint="1 = вялость, 5 = перевозбуждение" value={arousal} onChange={setArousal} />
      <Scale label="Фокус" hint="концентрация на подходах" value={focus} onChange={setFocus} />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {([true, false, null] as const).map(v => (
          <button key={String(v)} type="button" onClick={() => setFollowed(v)}
            style={{
              padding: '3px 10px', borderRadius: 20, cursor: 'pointer', fontSize: 9, fontWeight: 600, minHeight: 28,
              border: followed === v ? (v === false ? '1px solid #ef4444' : '1px solid #a78bfa') : '1px solid rgba(255,255,255,0.1)',
              background: followed === v ? (v === false ? 'rgba(239,68,68,0.12)' : 'rgba(167,139,250,0.15)') : 'rgba(255,255,255,0.02)',
              color: followed === v ? (v === false ? '#ef4444' : '#a78bfa') : 'rgba(255,255,255,0.5)',
            }}>
            {v === true ? '✓ Протокол выполнен' : v === false ? '✕ Не выполнен' : '— Не отмечать'}
          </button>
        ))}
      </div>
      <input type="text" aria-label="Заметка чек-ина" placeholder="заметка: что сработало…" value={note}
        onChange={e => setNote(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: '#fff', fontSize: 11 }} />
      <button type="button" onClick={save} disabled={saved}
        style={{ width: '100%', marginTop: 8, padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', minHeight: 40,
          background: saved ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#a78bfa,#8b5cf6)', color: saved ? DIM : '#000', fontWeight: 700, fontSize: 11 }}>
        {saved ? '✓ Чек-ин сохранён' : '💾 Сохранить чек-ин'}
      </button>
    </div>
  );
};

/* ═══════════ 4. Компактный психо-чек-ин (формы записи/редактирования) ═══════════ */

/**
 * Компактная строка чек-ина для DiaryRecordingForm / SessionEditorModal.
 * Три выпадающих шкалы 1-5 + выполнение протокола + сохранение.
 * Записывается через upsertCheckin (замена по дате+sessionId).
 */
export const MindsetCheckinInline: React.FC<{ date: string; sessionId?: string; onSaved?: () => void }> = ({ date, sessionId, onSaved }) => {
  const last = latestCheckin();
  const [confidence, setConfidence] = useState(last?.confidence || 4);
  const [arousal, setArousal] = useState(last?.arousal || 3);
  const [focus, setFocus] = useState(last?.focus || 4);
  const [followed, setFollowed] = useState<boolean | null>(last?.protocolFollowed ?? true);
  const [saved, setSaved] = useState(false);

  const save = () => {
    upsertCheckin({
      date: (date || todayKey()).slice(0, 10),
      sessionId,
      confidence, arousal, focus,
      protocolFollowed: followed,
    });
    setSaved(true);
    try { onSaved?.(); } catch { /* ignore */ }
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '5px 6px', borderRadius: 6, background: '#18181b',
    border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, minHeight: 32, boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 3 };

  return (
    <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa' }}>🧠 Психо-чек-ин</span>
        {saved && <span style={{ fontSize: 9, color: ACCENT }}>✓ сохранено</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 90 }}>
          <div style={labelStyle}>Уверенность</div>
          <select aria-label="Уверенность" value={confidence} onChange={e => { setConfidence(+e.target.value); setSaved(false); }} style={selectStyle}>
            {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 90 }}>
          <div style={labelStyle}>Активация</div>
          <select aria-label="Активация" value={arousal} onChange={e => { setArousal(+e.target.value); setSaved(false); }} style={selectStyle}>
            {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 90 }}>
          <div style={labelStyle}>Фокус</div>
          <select aria-label="Фокус" value={focus} onChange={e => { setFocus(+e.target.value); setSaved(false); }} style={selectStyle}>
            {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div style={{ flex: 1.4, minWidth: 150 }}>
          <div style={labelStyle}>Протокол</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {([true, false, null] as const).map(v => (
              <button key={String(v)} type="button" onClick={() => { setFollowed(v); setSaved(false); }}
                style={{
                  flex: 1, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 600, minHeight: 32,
                  border: followed === v ? (v === false ? '1px solid #ef4444' : '1px solid #a78bfa') : '1px solid rgba(255,255,255,0.08)',
                  background: followed === v ? (v === false ? 'rgba(239,68,68,0.12)' : 'rgba(167,139,250,0.15)') : 'rgba(255,255,255,0.03)',
                  color: followed === v ? (v === false ? '#ef4444' : '#a78bfa') : 'rgba(255,255,255,0.5)',
                }}>
                {v === true ? '✓ да' : v === false ? '✕ нет' : '—'}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={save} disabled={saved} aria-label="Сохранить психо-чек-ин"
          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', minHeight: 32, fontSize: 10, fontWeight: 700,
            background: saved ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#a78bfa,#8b5cf6)', color: saved ? DIM : '#000' }}>
          {saved ? '✓' : '💾'}
        </button>
      </div>
    </div>
  );
};
