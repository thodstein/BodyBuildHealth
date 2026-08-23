/**
 * CardioSessionTimer.tsx — «рабочий» режим кардио: быстрый старт сессии
 * с таймером (пауза/завершение), ввод RPE/ЧСС и запись в дневник
 * (he_cardio_sessions) одним действием.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cardioSessionsForDate, cardioSessionProtocol, rescheduleCardioSession,
  cardioEquipmentLabel,
  type CardioCycle, type CardioType, type CardioEquipment,
} from '../../../engines/lms/cardio.engine';
import { saveCardioLogEntry, loadCardioLog, estimateCardioEntryKcal, cardioExpectedDistanceHint, validateCardioLogFields, type CardioLogFieldWarnings } from '../../../engines/lms/cardio-diary.engine';
import { getWeightLog } from '../../../engines/profile-store';
import { CARD, ROW, LABEL, HINT_SM, BTN, BTN_PRIMARY, BTN_DANGER, ProgressBar } from './CardioUI';

const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
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
function beep(freq = 880, ms = 180) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    o.start();
    window.setTimeout(() => { try { o.stop(); ctx.close(); } catch { /* ignore */ } }, ms);
  } catch { /* ignore */ }
}
function vibrate(pattern: number | number[]) {
  try { if ('vibrate' in navigator) (navigator as unknown as { vibrate: (p: number | number[]) => void }).vibrate(pattern); } catch { /* ignore */ }
}

interface ActiveSession {
  type: CardioType;
  durationMin: number;
  remainingSec: number;
  paused: boolean;
  targetHr?: { min?: number; max?: number };
}

interface TodaySession {
  type: CardioType;
  durationMin: number;
  targetHr?: { min?: number; max?: number };
  equipment?: CardioEquipment;
}

export const CardioSessionTimer: React.FC<{ cycle: CardioCycle | null; onSaved?: () => void; onReschedule?: (next: CardioCycle) => void }> = ({ cycle, onSaved, onReschedule }) => {
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>(() => {
    if (!cycle) return [];
    const t = cardioSessionsForDate(cycle, todayIso(), cycle.startDate);
    return t ? t.sessions.map(s => ({ type: s.type, durationMin: s.durationMin, targetHr: s.targetHr, equipment: s.equipment })) : [];
  });
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [finished, setFinished] = useState<{ type: CardioType; durationMin: number } | null>(null);
  const [rpe, setRpe] = useState('');
  const [hr, setHr] = useState('');
  const [km, setKm] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<CardioLogFieldWarnings | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!cycle) { setTodaySessions([]); return; }
    const t = cardioSessionsForDate(cycle, todayIso(), cycle.startDate);
    setTodaySessions(t ? t.sessions.map(s => ({ type: s.type, durationMin: s.durationMin, targetHr: s.targetHr, equipment: s.equipment })) : []);
  }, [cycle]);

  useEffect(() => {
    if (!active || active.paused) return;
    timerRef.current = window.setInterval(() => {
      setActive(prev => {
        if (!prev) return null;
        if (prev.remainingSec <= 1) {
          return null;
        }
        return { ...prev, remainingSec: prev.remainingSec - 1 };
      });
    }, 1000);
    return () => { if (timerRef.current != null) window.clearInterval(timerRef.current); };
  }, [active?.paused, active?.type, active?.durationMin]);

  useEffect(() => {
    if (!active) return;
    if (active.remainingSec <= 1) {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      beep(880, 300);
      vibrate([120, 80, 120]);
      setFinished({ type: active.type, durationMin: active.durationMin });
    } else if (active.remainingSec <= 3 && active.remainingSec > 0 && !active.paused) {
      beep(660, 120);
      if (active.remainingSec === 1) vibrate(120);
    }
  }, [active]);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  const start = (type: CardioType, durationMin: number, targetHr?: { min?: number; max?: number }) => {
    setActive({ type, durationMin, remainingSec: durationMin * 60, paused: false, targetHr });
    setFinished(null);
  };

  const finishNow = () => {
    if (!active) return;
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    beep(880, 220);
    vibrate(140);
    setFinished({ type: active.type, durationMin: active.durationMin });
    setActive(null);
  };

  const save = () => {
    if (!finished) return;
    const w = validateCardioLogFields({ rpe, hr, km });
    if (w.rpe || w.hr || w.km) {
      setWarnings(w);
      flashMsg('⚠ Проверьте значения: ' + [w.rpe, w.hr, w.km].filter(Boolean).join('; '));
      return;
    }
    setWarnings(null);
    let weight: number | null = null;
    try {
      const weights = getWeightLog();
      const sorted = Array.isArray(weights) ? [...weights].filter(e => Number.isFinite(e.weight)).sort((a, b) => (a.date < b.date ? 1 : -1)) : [];
      if (sorted.length > 0) weight = sorted[0].weight;
    } catch { /* ignore */ }
    saveCardioLogEntry({
      id: 'c-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
      date: todayIso(),
      type: finished.type,
      durationMin: finished.durationMin,
      completed: true,
      rpe: Number(rpe) > 0 ? Number(rpe) : undefined,
      avgHr: Number(hr) > 0 ? Number(hr) : undefined,
      calories: estimateCardioEntryKcal(finished.type, finished.durationMin, weight ?? undefined),
      distanceKm: Number(km) > 0 ? Math.round(Number(km) * 10) / 10 : undefined,
    });
    onSaved?.();
    setFinished(null);
    setRpe('');
    setHr('');
    setKm('');
    flashMsg('💾 Сессия записана в дневник');
  };

  const skip = (type: CardioType, durationMin: number) => {
    // Не дублировать пропуск: если сегодня уже есть пропущенная сессия того же
    // типа — не пишем вторую запись (иначе рекомендации считают «2 пропуска»).
    let alreadySkipped = false;
    try {
      const log = loadCardioLog();
      alreadySkipped = log.some(e => e.date === todayIso() && e.type === type && e.completed === false);
    } catch { /* ignore */ }
    if (alreadySkipped) {
      flashMsg('⏭ Сессия уже отмечена пропущенной сегодня');
      return;
    }
    saveCardioLogEntry({
      id: 'c-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
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

  const reschedule = () => {
    if (!cycle) return;
    const r = rescheduleCardioSession(cycle, todayIso(), { referenceIso: cycle.startDate });
    if (r.changes.length === 0) { flashMsg('⚠ Сессию некуда перенести (нет свободного дня недели)'); return; }
    onReschedule?.(r.cycle);
    flashMsg(`↗ Сессия перенесена на ${r.changes[0].to} (нед ${r.changes[0].week})`);
  };

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={LABEL}>⚡ Быстрый старт сессии</span>
        <span style={HINT_SM}>таймер · фазы · ЧСС-зона · аудио</span>
      </div>
      {flash && <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 700 }} role="status">{flash}</div>}

      {active && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'center', padding: '8px 0' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{TYPE_LABEL[active.type]} · {active.durationMin} мин</span>
            {active.targetHr?.max && <span style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', background: 'rgba(96,165,250,0.14)', border: '1px solid rgba(96,165,250,0.28)', borderRadius: 20, padding: '2px 8px' }}>🎯 ЧСС {active.targetHr.min}-{active.targetHr.max}</span>}
          </div>
          <div role="timer" aria-live="polite" aria-atomic="true" style={{ fontSize: 44, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: active.remainingSec < 60 ? '#ef4444' : '#00e68a', lineHeight: 1, letterSpacing: -1 }}>{fmt(active.remainingSec)}</div>
          <div style={{ width: '100%', maxWidth: 340 }} role="progressbar" aria-valuenow={active.durationMin * 60 - active.remainingSec} aria-valuemin={0} aria-valuemax={active.durationMin * 60} aria-label="Прогресс сессии">
            <ProgressBar value={active.durationMin * 60 - active.remainingSec} max={active.durationMin * 60} color={active.remainingSec < 60 ? '#ef4444' : '#00e68a'} height={8} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 4 }}>
              <span>прошло {fmt(active.durationMin * 60 - active.remainingSec)}</span>
              <span>{active.paused ? '⏸ пауза' : '▶ в процессе'}</span>
              <span>осталось {fmt(active.remainingSec)}</span>
            </div>
          </div>
          {(() => {
            const protocol = cardioSessionProtocol({ type: active.type, durationMin: active.durationMin });
            const elapsed = active.durationMin * 60 - active.remainingSec;
            let acc = 0;
            const currentIdx = protocol.findIndex(p => { acc += p.minutes * 60; return elapsed < acc; });
            const activeIdx = currentIdx >= 0 ? currentIdx : protocol.length - 1;
            return (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                {protocol.map((p, i) => (
                  <div key={p.name} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 8, border: i === activeIdx ? '1px solid rgba(0,230,138,0.5)' : '1px solid rgba(255,255,255,0.08)', background: i === activeIdx ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: i === activeIdx ? '#4ade80' : '#fff' }}>
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
          <div style={{ fontSize: 11, color: '#fff' }}>
            ✅ {TYPE_LABEL[finished.type]} {finished.durationMin} мин завершена — оцените сессию:
          </div>
          <div style={ROW}>
            <input value={rpe} onChange={e => setRpe(e.target.value)} placeholder="RPE 1-10" inputMode="numeric" style={INPUT} aria-label="RPE" />
            <input value={hr} onChange={e => setHr(e.target.value)} placeholder="ЧСС ср." inputMode="numeric" style={INPUT} aria-label="ЧСС" />
            <input value={km} onChange={e => setKm(e.target.value)} placeholder="км" inputMode="decimal" style={{ ...INPUT, width: 60 }} aria-label="Км" title="Дистанция (для бега/езды)" />
            <button style={BTN_PRIMARY} onClick={save}>💾 Сохранить в дневник</button>
          </div>
          {warnings && (
            <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 8px' }} role="alert">
              ⚠ {[warnings.rpe, warnings.hr, warnings.km].filter(Boolean).join(' · ')}
            </div>
          )}
          {(() => {
            const hint = cardioExpectedDistanceHint(finished.type, finished.durationMin);
            return hint ? (
              <div style={{ fontSize: 10, color: 'rgba(96,165,250,0.85)', lineHeight: 1.4 }}>💡 Ориентир: {hint} — темп покажется в журнале после сохранения.</div>
            ) : null;
          })()}
        </div>
      )}

      {!active && !finished && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {todaySessions.length === 0 && <div style={{ fontSize: 11, color: '#fff' }}>По плану на сегодня кардио нет.</div>}
          {todaySessions.map((s, i) => (
            <div key={i} style={ROW}>
              <span style={{ fontSize: 12, flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span>{TYPE_LABEL[s.type]} · {s.durationMin} мин{s.equipment ? ` · ${cardioEquipmentLabel(s.equipment as CardioEquipment)}` : ''}</span>
                {s.targetHr?.max && (
                  <span style={{ fontSize: 10, color: 'rgba(96,165,250,0.85)' }}>🎯 ЧСС {s.targetHr.min}-{s.targetHr.max} уд/мин</span>
                )}
              </span>
              <button style={BTN_PRIMARY} onClick={() => start(s.type, s.durationMin, s.targetHr)} aria-label={`Старт ${TYPE_LABEL[s.type]}`}>▶️ Старт</button>
              <button style={BTN} onClick={reschedule} aria-label="Перенести на другой день">↗</button>
              <button style={BTN} onClick={() => skip(s.type, s.durationMin)} aria-label={`Пропустить ${TYPE_LABEL[s.type]}`}>⏭</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
