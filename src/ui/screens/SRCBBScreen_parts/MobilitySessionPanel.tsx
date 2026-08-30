/**
 * MobilitySessionPanel.tsx — панель мобильности экрана выполнения сессии (SessionPlayer).
 *
 * 1. MobilitySessionPanel (фаза 'ready'): ежедневная рутина (daily) + подготовка
 *    проблемных зон (pre) с чекбоксами. Прогресс дня — he_mobility_day_progress.
 * 2. MobilityPostPanel (фаза 'done'): блоки «после тренировки» (статика/PNF/
 *    нагруженная) с чекбоксами + компактный чек-ин (выполнено + ROM) →
 *    he_mobility_checks.
 *
 * Панели НЕ дублируют warmup/cooldown (те генерируются отдельно) и не влияют
 * на план/авторегуляцию.
 */
import React, { useMemo, useState } from 'react';
import {
  loadActiveMobility, itemsForSlot,
  loadMobilityDayProgress, saveMobilityDayProgress,
  upsertMobilityCheckin,
  SLOT_LABELS,
  type MobilitySlot,
} from '../../../engines/mobility-protocol.engine';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const DIM = '#fff';
const SLOT_ICON: Record<string, string> = { daily: '🌅', pre: '🏋️', post: '🧘', rest_day: '🛌' };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function CheckboxList({ items, progress, onToggle }: {
  items: ReturnType<typeof itemsForSlot>;
  progress: { date: string; doneItems: string[] };
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map(it => {
        const done = progress.doneItems.includes(it.id);
        return (
          <button key={it.id} type="button" role="checkbox" aria-checked={done} aria-label={`Шаг мобильности: ${it.title}`}
            onClick={() => onToggle(it.id)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 11, cursor: 'pointer',
              background: done ? 'linear-gradient(135deg, rgba(96,165,250,0.13), rgba(59,130,246,0.07))' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${done ? 'rgba(96,165,250,0.28)' : 'rgba(255,255,255,0.07)'}`,
              borderLeft: `3px solid ${done ? '#60a5fa' : 'rgba(96,165,250,0.45)'}`,
              opacity: done ? 0.90 : 1, transition: 'all 0.2s',
            }}>
            <span style={{
              width: 24, height: 24, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
              background: done ? 'linear-gradient(135deg,#60a5fa,#3b82f6)' : 'rgba(255,255,255,0.07)',
              color: done ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 800,
            }}>{done ? '✓' : '•'}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 10.5, fontWeight: done ? 600 : 700, color: done ? 'rgba(255,255,255,0.78)' : '#fff', textDecoration: done ? 'line-through' : 'none', lineHeight: 1.3, display: 'block' }}>
                {it.title} <span style={{ fontSize: 9, color: done ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.60)', fontWeight: 400 }}>({it.durationMin} мин)</span>
              </span>
              <span style={{ fontSize: 9, color: done ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.72)', lineHeight: 1.45, marginTop: 2, display: done ? 'none' : 'block' }}>{it.script}</span>
            </span>
            <span style={{
              width: 24, height: 24, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
              background: done ? '#60a5fa' : 'rgba(255,255,255,0.06)', color: done ? '#fff' : 'rgba(255,255,255,0.38)',
              border: `1px solid ${done ? '#60a5fa' : 'rgba(255,255,255,0.08)'}`, fontSize: 10, fontWeight: 800,
            }}>{done ? '✓' : '○'}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════ 1. Ready-фаза: ежедневная рутина + подготовка ═══════════ */

export const MobilitySessionPanel: React.FC = () => {
  const [tick, setTick] = useState(0);
  const protocol = useMemo(() => loadActiveMobility(), [tick]);
  const daily = useMemo(() => itemsForSlot(protocol, 'daily'), [protocol, tick]);
  const pre = useMemo(() => itemsForSlot(protocol, 'pre'), [protocol, tick]);
  const progress = useMemo(() => loadMobilityDayProgress(todayKey()), [tick]);

  if (!protocol || (daily.length === 0 && pre.length === 0)) return null;

  const toggle = (id: string) => {
    const done = progress.doneItems.includes(id)
      ? progress.doneItems.filter(x => x !== id)
      : [...progress.doneItems, id];
    saveMobilityDayProgress({ date: todayKey(), doneItems: done });
    setTick(t => t + 1);
  };

  const total = daily.length + pre.length;
  const doneCount = [...daily, ...pre].filter(it => progress.doneItems.includes(it.id)).length;
  const pct = total > 0 ? Math.round(doneCount / total * 100) : 0;

  return (
    <div style={{ ...CARD, border: '1px solid rgba(96,165,250,0.35)', background: 'rgba(96,165,250,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>🧘 Мобильность: {protocol.name}</div>
        <span style={{ fontSize: 9, color: pct === 100 ? '#22c55e' : DIM }}>{doneCount}/{total} шагов · {pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', margin: '6px 0 8px' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: pct === 100 ? '#22c55e' : '#60a5fa', transition: 'width 0.3s ease' }} />
      </div>
      {daily.length > 0 && <div style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa', margin: '4px 0' }}>🌅 {SLOT_LABELS.daily}</div>}
      <CheckboxList items={daily} progress={progress} onToggle={toggle} />
      {pre.length > 0 && <div style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', margin: '6px 0 4px' }}>🏋️ {SLOT_LABELS.pre}</div>}
      <CheckboxList items={pre} progress={progress} onToggle={toggle} />
      <div style={{ fontSize: 8, color: 'var(--text-faint)', marginTop: 6 }}>
        Разминка/заминка тренировки генерируются отдельно — здесь только рутина и подготовка проблемных зон.
      </div>
    </div>
  );
};

/* ═══════════ 2. Done-фаза: растяжка после + чек-ин ═══════════ */

export const MobilityPostPanel: React.FC<{ sessionId?: string }> = ({ sessionId }) => {
  const [tick, setTick] = useState(0);
  const protocol = useMemo(() => loadActiveMobility(), [tick]);
  const post = useMemo(() => itemsForSlot(protocol, 'post'), [protocol, tick]);
  const progress = useMemo(() => loadMobilityDayProgress(todayKey()), [tick]);
  const [romScore, setRomScore] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  if (!protocol || post.length === 0) return null;

  const toggle = (id: string) => {
    const done = progress.doneItems.includes(id)
      ? progress.doneItems.filter(x => x !== id)
      : [...progress.doneItems, id];
    saveMobilityDayProgress({ date: todayKey(), doneItems: done });
    setTick(t => t + 1);
  };

  const save = () => {
    const allDone = post.every(it => progress.doneItems.includes(it.id));
    upsertMobilityCheckin({
      date: todayKey(),
      sessionId,
      done: allDone,
      romScore,
      note: undefined,
    });
    setSaved(true);
  };

  return (
    <div style={{ ...CARD, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>🧘 Растяжка после тренировки</div>
        {saved && <span style={{ fontSize: 9, color: ACCENT }}>✓ сохранено</span>}
      </div>
      <div style={{ fontSize: 9, color: DIM, margin: '4px 0 8px' }}>Статика/PNF/нагруженная — после сессии, до ухода из зала.</div>
      <CheckboxList items={post} progress={progress} onToggle={toggle} />
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 9, color: '#fff', marginBottom: 4 }}>ROM / ощущения в суставах (1-5):</div>
        <div style={{ display: 'flex', gap: 4 }} role="radiogroup" aria-label="ROM">
          {[1, 2, 3, 4, 5].map(v => (
            <button key={v} type="button" role="radio" aria-checked={romScore === v} aria-label={`ROM ${v}`} onClick={() => setRomScore(v)}
              style={{
                flex: 1, minHeight: 32, borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                border: romScore === v ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.08)',
                background: romScore === v ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                color: romScore === v ? '#60a5fa' : '#fff',
              }}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={save} disabled={saved}
        style={{ width: '100%', marginTop: 8, padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', minHeight: 40,
          background: saved ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: saved ? DIM : '#000', fontWeight: 700, fontSize: 11 }}>
        {saved ? '✓ Чек-ин мобильности сохранён' : '💾 Сохранить чек-ин мобильности'}
      </button>
    </div>
  );
};

/* ═══════════ 3. Компактный чек-ин для форм записи ═══════════ */

export const MobilityCheckinInline: React.FC<{ date: string; sessionId?: string }> = ({ date, sessionId }) => {
  const [done, setDone] = useState<boolean>(true);
  const [romScore, setRomScore] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const save = () => {
    upsertMobilityCheckin({
      date: (date || todayKey()).slice(0, 10),
      sessionId,
      done,
      romScore,
      note: undefined,
    });
    setSaved(true);
  };

  return (
    <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa' }}>🧘 Чек-ин мобильности</span>
        {saved && <span style={{ fontSize: 9, color: ACCENT }}>✓ сохранено</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 9, color: '#fff', marginBottom: 3 }}>Рутина/сессия</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {([true, false] as const).map(v => (
              <button key={String(v)} type="button" onClick={() => { setDone(v); setSaved(false); }}
                style={{
                  flex: 1, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 600, minHeight: 32,
                  border: done === v ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.08)',
                  background: done === v ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                  color: done === v ? '#60a5fa' : '#fff',
                }}>
                {v ? '✓ выполнено' : '✕ нет'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 9, color: '#fff', marginBottom: 3 }}>ROM (1-5)</div>
          <select aria-label="ROM" value={romScore ?? ''} onChange={e => { setRomScore(e.target.value ? +e.target.value : null); setSaved(false); }}
            style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--input-bg)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, minHeight: 32 }}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <button type="button" onClick={save} disabled={saved} aria-label="Сохранить чек-ин мобильности"
          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', minHeight: 32, fontSize: 10, fontWeight: 700,
            background: saved ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: saved ? DIM : '#000' }}>
          {saved ? '✓' : '💾'}
        </button>
      </div>
    </div>
  );
};
