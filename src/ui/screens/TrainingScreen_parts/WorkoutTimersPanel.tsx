/**
 * WorkoutTimersPanel.tsx — 3 варианта таймера для АПК (in-app).
 * B1 пилюля отдыха · B2 интервальный (табата/EMOM) · B3 часы сессии.
 * Звук+вибро как в CardioSessionTimer, кнопки ≥44px, текст белый.
 */
import React, { useEffect, useRef, useState } from 'react';

const WHITE = '#fff';
const ACCENT = '#00e68a';
const CARD: React.CSSProperties = {
  background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 18, padding: 12, margin: '8px 0',
};
const BIG: React.CSSProperties = {
  minHeight: 52, borderRadius: 14, border: 'none', fontWeight: 800, fontSize: 15,
  background: ACCENT, color: '#0a0a0a', padding: '12px 16px',
};
const GHOST: React.CSSProperties = { ...BIG, background: 'transparent', color: WHITE, border: '1px solid rgba(255,255,255,0.14)' };
const TABULAR: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export function formatTimer(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function beep(freq = 880, ms = 180): void {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    o.start();
    window.setTimeout(() => { try { o.stop(); ctx.close(); } catch { /* noop */ } }, ms);
  } catch { /* noop */ }
}
function buzz(p: number | number[]): void {
  try { if ('vibrate' in navigator) (navigator as any).vibrate(p); } catch { /* noop */ }
}

/* ── B1: пилюля отдыха 30/60/90/120/180 ───────────────────────────────── */
export const RestTimerPill: React.FC<{ defaultSec?: number }> = ({ defaultSec = 90 }) => {
  const [total, setTotal] = useState(defaultSec);
  const [left, setLeft] = useState(defaultSec);
  const [run, setRun] = useState(false);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    if (!run) return;
    ref.current = window.setInterval(() => {
      setLeft(v => {
        if (v <= 1) {
          if (ref.current) window.clearInterval(ref.current);
          setRun(false); beep(880, 300); buzz([120, 80, 120]);
          return 0;
        }
        if (v <= 4) beep(660, 90);
        return v - 1;
      });
    }, 1000);
    return () => { if (ref.current) window.clearInterval(ref.current); };
  }, [run]);
  const start = (s: number) => { setTotal(s); setLeft(s); setRun(true); };
  return (
    <div data-timer="rest" style={CARD} role="timer" aria-label={`Отдых ${formatTimer(left)}`}>
      <div style={{ color: WHITE, fontSize: 13, fontWeight: 800 }}>⏳ Отдых · <span style={TABULAR}>{formatTimer(left)}</span></div>
      <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.10)', margin: '8px 0' }}>
        <div style={{ width: `${total ? Math.round(((total - left) / total) * 100) : 0}%`, height: '100%', borderRadius: 4, background: ACCENT }} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[30, 60, 90, 120, 180].map(s => (
          <button key={s} type="button" data-sec={s} aria-pressed={total === s} onClick={() => start(s)}
            style={{ ...GHOST, minWidth: 56, minHeight: 44, padding: '8px 10px', fontSize: 13, borderColor: total === s ? ACCENT : 'rgba(255,255,255,0.14)' }}>{s}с</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" data-act="rest-toggle" onClick={() => setRun(v => !v)} style={{ ...BIG, flex: 1 }} aria-label={run ? 'Пауза отдыха' : 'Старт отдыха'}>{run ? '⏸ Пауза' : '▶ Старт'}</button>
        <button type="button" data-act="rest-plus" onClick={() => setLeft(v => v + 15)} style={{ ...GHOST, minWidth: 64 }} aria-label="Плюс 15 секунд">+15</button>
      </div>
    </div>
  );
};

/* ── B2: интервальный (раунды × работа/отдых) ──────────────────────────── */
export const IntervalTimer: React.FC<{ rounds?: number; workSec?: number; restSec?: number }> = ({ rounds = 8, workSec = 20, restSec = 10 }) => {
  const [r, setR] = useState(1);
  const [phase, setPhase] = useState<'work' | 'rest'>('work');
  const [left, setLeft] = useState(workSec);
  const [run, setRun] = useState(false);
  const cfg = useRef({ rounds, workSec, restSec });
  useEffect(() => { cfg.current = { rounds, workSec, restSec }; }, [rounds, workSec, restSec]);
  useEffect(() => {
    if (!run) return;
    const id = window.setInterval(() => {
      setLeft(v => {
        if (v > 1) return v - 1;
        const { rounds: R, workSec: W, restSec: RS } = cfg.current;
        if (phase === 'work') { beep(990, 150); setPhase('rest'); return RS; }
        if (r >= R) { window.clearInterval(id); setRun(false); beep(880, 400); buzz([200, 100, 200]); return 0; }
        beep(740, 150); setR(x => x + 1); setPhase('work'); return W;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [run, phase, r]);
  return (
    <div data-timer="interval" style={CARD} role="timer" aria-label={`Интервалы раунд ${r} из ${cfg.current.rounds}, фаза ${phase}`}>
      <div style={{ color: WHITE, fontSize: 13, fontWeight: 800 }}>
        🔁 Раунд <span style={TABULAR}>{r}/{cfg.current.rounds}</span> · {phase === 'work' ? '💪 Работа' : '😮‍💨 Отдых'}
      </div>
      <div style={{ color: WHITE, fontSize: 34, fontWeight: 800, textAlign: 'center', margin: '6px 0', ...TABULAR }}>{formatTimer(left)}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" data-act="int-toggle" onClick={() => setRun(v => !v)} style={{ ...BIG, flex: 1 }} aria-label={run ? 'Пауза интервалов' : 'Старт интервалов'}>{run ? '⏸ Пауза' : '▶ Старт'}</button>
        <button type="button" data-act="int-reset" onClick={() => { setRun(false); setR(1); setPhase('work'); setLeft(cfg.current.workSec); }} style={{ ...GHOST, minWidth: 72 }} aria-label="Сбросить интервалы">↩</button>
      </div>
    </div>
  );
};

/* ── B3: часы сессии (count-up + цель) ─────────────────────────────────── */
export const SessionClock: React.FC<{ targetMin?: number }> = ({ targetMin = 60 }) => {
  const [sec, setSec] = useState(0);
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (!run) return;
    const id = window.setInterval(() => setSec(v => v + 1), 1000);
    return () => window.clearInterval(id);
  }, [run]);
  const pct = Math.min(100, Math.round((sec / (targetMin * 60)) * 100));
  return (
    <div data-timer="session" style={CARD} role="timer" aria-label={`Сессия ${formatTimer(sec)} из ${targetMin} минут`}>
      <div style={{ color: WHITE, fontSize: 13, fontWeight: 800 }}>⏱ Сессия · цель {targetMin} мин</div>
      <div style={{ color: WHITE, fontSize: 34, fontWeight: 800, textAlign: 'center', margin: '6px 0', ...TABULAR }}>{formatTimer(sec)}</div>
      <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.10)', marginBottom: 8 }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: ACCENT }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" data-act="sess-toggle" onClick={() => setRun(v => !v)} style={{ ...BIG, flex: 1 }} aria-label={run ? 'Пауза сессии' : 'Старт сессии'}>{run ? '⏸ Пауза' : '▶ Старт'}</button>
        <button type="button" data-act="sess-reset" onClick={() => { setRun(false); setSec(0); }} style={{ ...GHOST, minWidth: 72 }} aria-label="Сбросить часы сессии">↩</button>
      </div>
    </div>
  );
};

export const WorkoutTimersPanel: React.FC = () => {
  const [tab, setTab] = useState<'rest' | 'interval' | 'session'>('rest');
  return (
    <section data-widget="timers-panel" aria-label="Таймеры тренировки" style={CARD}>
      <div role="tablist" aria-label="Вариант таймера" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {([['rest', '⏳ Отдых'], ['interval', '🔁 Интервалы'], ['session', '⏱ Сессия']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} data-tab={k} onClick={() => setTab(k)}
            style={{ flex: 1, minHeight: 44, borderRadius: 12, border: tab === k ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.12)', background: tab === k ? 'rgba(0,230,138,0.12)' : 'transparent', color: WHITE, fontWeight: 800, fontSize: 13 }}>{label}</button>
        ))}
      </div>
      {tab === 'rest' && <RestTimerPill />}
      {tab === 'interval' && <IntervalTimer />}
      {tab === 'session' && <SessionClock />}
    </section>
  );
};
