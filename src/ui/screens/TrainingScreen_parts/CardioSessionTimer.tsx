/**
 * CardioSessionTimer.tsx — «рабочий» режим кардио: быстрый старт сессии
 * с таймером (пауза/завершение), ввод RPE/ЧСС и запись в дневник
 * (he_cardio_sessions) одним действием.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cardioSessionsForDate, cardioSessionProtocol,
  type CardioCycle, type CardioType,
} from '../../../engines/lms/cardio.engine';
import { saveCardioLogEntry } from '../../../engines/lms/cardio-diary.engine';

const BTN: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  color: '#fff', minHeight: 40, whiteSpace: 'nowrap',
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'rgba(0,230,138,0.18)', border: '1px solid rgba(0,230,138,0.5)', color: '#00e68a' };
const BTN_DANGER: React.CSSProperties = { ...BTN, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' };
const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 };
const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12, width: 76,
};

const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Recovery' };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface ActiveSession {
  type: CardioType;
  durationMin: number;
  remainingSec: number;
  paused: boolean;
}

export const CardioSessionTimer: React.FC<{ cycle: CardioCycle | null; onSaved?: () => void }> = ({ cycle, onSaved }) => {
  const [todaySessions, setTodaySessions] = useState<{ type: CardioType; durationMin: number }[]>(() => {
    if (!cycle) return [];
    const t = cardioSessionsForDate(cycle, todayIso());
    return t ? t.sessions.map(s => ({ type: s.type, durationMin: s.durationMin })) : [];
  });
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [finished, setFinished] = useState<{ type: CardioType; durationMin: number } | null>(null);
  const [rpe, setRpe] = useState('');
  const [hr, setHr] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!cycle) { setTodaySessions([]); return; }
    const t = cardioSessionsForDate(cycle, todayIso());
    setTodaySessions(t ? t.sessions.map(s => ({ type: s.type, durationMin: s.durationMin })) : []);
  }, [cycle]);

  useEffect(() => {
    if (!active || active.paused) return;
    timerRef.current = window.setInterval(() => {
      setActive(prev => {
        if (!prev) return null;
        if (prev.remainingSec <= 1) {
          if (timerRef.current != null) window.clearInterval(timerRef.current);
          setFinished({ type: prev.type, durationMin: prev.durationMin });
          return null;
        }
        return { ...prev, remainingSec: prev.remainingSec - 1 };
      });
    }, 1000);
    return () => { if (timerRef.current != null) window.clearInterval(timerRef.current); };
  }, [active?.paused, active?.type]);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  const start = (type: CardioType, durationMin: number) => {
    setActive({ type, durationMin, remainingSec: durationMin * 60, paused: false });
    setFinished(null);
  };

  const finishNow = () => {
    if (!active) return;
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    setFinished({ type: active.type, durationMin: active.durationMin });
    setActive(null);
  };

  const save = () => {
    if (!finished) return;
    saveCardioLogEntry({
      id: 'c-' + Date.now(),
      date: todayIso(),
      type: finished.type,
      durationMin: finished.durationMin,
      completed: true,
      rpe: Number(rpe) > 0 ? Number(rpe) : undefined,
      avgHr: Number(hr) > 0 ? Number(hr) : undefined,
    });
    onSaved?.();
    setFinished(null);
    setRpe('');
    setHr('');
    flashMsg('💾 Сессия записана в дневник');
  };

  const skip = (type: CardioType, durationMin: number) => {
    saveCardioLogEntry({
      id: 'c-' + Date.now(),
      date: todayIso(),
      type,
      durationMin,
      completed: false,
      notes: 'пропущена',
    });
    if (active) {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      setActive(null);
    }
    onSaved?.();
    flashMsg('⏭ Сессия отмечена пропущенной (учитывается в рекомендациях)');
  };

  return (
    <div style={CARD}>
      <div style={LABEL}>⚡ Быстрый старт сессии</div>
      {flash && <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 600 }} role="status">{flash}</div>}

      {active && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{TYPE_LABEL[active.type]} · {active.durationMin} мин</div>
          <div style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: active.remainingSec < 60 ? '#ef4444' : '#00e68a' }}>{fmt(active.remainingSec)}</div>
          {(() => {
            const protocol = cardioSessionProtocol({ type: active.type, durationMin: active.durationMin });
            const elapsed = active.durationMin * 60 - active.remainingSec;
            let acc = 0;
            const currentIdx = protocol.findIndex(p => { acc += p.minutes * 60; return elapsed < acc; });
            const activeIdx = currentIdx >= 0 ? currentIdx : protocol.length - 1;
            return (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                {protocol.map((p, i) => (
                  <div key={p.name} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 8, border: i === activeIdx ? '1px solid rgba(0,230,138,0.5)' : '1px solid rgba(255,255,255,0.08)', background: i === activeIdx ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: i === activeIdx ? '#4ade80' : 'rgba(255,255,255,0.55)' }}>
                    {i === activeIdx ? '▶ ' : ''}{p.name} {p.minutes}м
                  </div>
                ))}
              </div>
            );
          })()}
          <div style={ROW}>
            <button style={BTN} onClick={() => setActive(prev => prev ? { ...prev, paused: !prev.paused } : null)} aria-label="Пауза">
              {active.paused ? '▶️ Продолжить' : '⏸ Пауза'}
            </button>
            <button style={BTN_DANGER} onClick={finishNow}>⏹ Завершить</button>
            <button style={BTN} onClick={() => skip(active.type, active.durationMin)} title="Отметить сессию пропущенной">⏭ Пропустить</button>
          </div>
        </div>
      )}

      {finished && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            ✅ {TYPE_LABEL[finished.type]} {finished.durationMin} мин завершена — оцените сессию:
          </div>
          <div style={ROW}>
            <input value={rpe} onChange={e => setRpe(e.target.value)} placeholder="RPE 1-10" inputMode="numeric" style={INPUT} aria-label="RPE" />
            <input value={hr} onChange={e => setHr(e.target.value)} placeholder="ЧСС ср." inputMode="numeric" style={INPUT} aria-label="ЧСС" />
            <button style={BTN_PRIMARY} onClick={save}>💾 Сохранить в дневник</button>
          </div>
        </div>
      )}

      {!active && !finished && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {todaySessions.length === 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>По плану на сегодня кардио нет.</div>}
          {todaySessions.map((s, i) => (
            <div key={i} style={ROW}>
              <span style={{ fontSize: 12, flex: 1 }}>{TYPE_LABEL[s.type]} · {s.durationMin} мин</span>
              <button style={BTN_PRIMARY} onClick={() => start(s.type, s.durationMin)} aria-label={`Старт ${TYPE_LABEL[s.type]}`}>▶️ Старт</button>
              <button style={BTN} onClick={() => skip(s.type, s.durationMin)} aria-label={`Пропустить ${TYPE_LABEL[s.type]}`}>⏭</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
