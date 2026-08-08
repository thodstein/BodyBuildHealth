import React from 'react';
import { hapticNotify, hapticImpact } from '../../../core/telegram';

type Preset = { name: string; work: number; rest: number; rounds: number };

const PRESETS: Preset[] = [
  { name: 'Силовой', work: 180, rest: 180, rounds: 5 },
  { name: 'Гипертрофия', work: 60, rest: 90, rounds: 8 },
  { name: 'Кардио', work: 45, rest: 15, rounds: 12 },
  { name: 'Tabata', work: 20, rest: 10, rounds: 8 },
  { name: 'EMOM', work: 40, rest: 20, rounds: 10 },
  { name: 'AMRAP', work: 300, rest: 0, rounds: 1 },
  { name: 'Drop Set', work: 45, rest: 10, rounds: 6 },
  { name: 'Эндurance', work: 300, rest: 60, rounds: 4 },
];

interface TimersTabProps {
  initialSettings?: { work: number; rest: number; rounds: number };
}

export const TimersTab: React.FC<TimersTabProps> = ({ initialSettings }) => {
  const [totalSec, setTotalSec] = React.useState(initialSettings?.work || 60);
  const [restSec, setRestSec] = React.useState(initialSettings?.rest || 30);
  const [rounds, setRounds] = React.useState(initialSettings?.rounds || 3);
  const [isRunning, setIsRunning] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [soundOn, setSoundOn] = React.useState(true);
  const [currentRound, setCurrentRound] = React.useState(0);
  const [phase, setPhase] = React.useState<'work' | 'rest'>('work');
  const [timeLeft, setTimeLeft] = React.useState(0);
  const [settings, setSettings] = React.useState<{ work: number; rest: number; rounds: number }>(() => {
    try {
      const preset = localStorage.getItem('he_timer_presets');
      if (preset) return JSON.parse(preset);
    } catch {}
    try {
      const last = localStorage.getItem('he_timer_last');
      if (last) return JSON.parse(last);
    } catch {}
    return { work: initialSettings?.work || 60, rest: initialSettings?.rest || 30, rounds: initialSettings?.rounds || 3 };
  });
  const intervalRef = React.useRef<number | null>(null);
  const [roundHistory, setRoundHistory] = React.useState<{ round: number; phase: 'work' | 'rest'; duration: number; timestamp: string }[]>([]);

  React.useEffect(() => {
    try {
      localStorage.setItem('he_timer_presets', JSON.stringify(settings));
      localStorage.setItem('he_timer_last', JSON.stringify(settings));
    } catch {}
  }, [settings, soundOn]);

  const start = () => {
    if (isRunning) return;
    setIsRunning(true);
    setCurrentRound(1);
    setPhase('work');
    setTimeLeft(totalSec);
  };

  const stop = () => {
    setIsRunning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const reset = () => {
    stop();
    setCurrentRound(0);
    setPhase('work');
    setTimeLeft(0);
  };

  const skipPhase = () => {
    if (!isRunning) return;
    if (phase === 'work') {
      if (currentRound >= rounds) { stop(); setTimeLeft(0); return; }
      setPhase('rest');
      setTimeLeft(restSec);
    } else {
      setPhase('work');
      setCurrentRound(r => r + 1);
      setTimeLeft(totalSec);
    }
  };

  const notify = (type: 'complete' | 'warning' | 'phase') => {
    if (type === 'complete') {
      hapticNotify('success');
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => {});
      } catch {}
    } else if (type === 'phase') {
      hapticNotify('success');
      if (navigator.vibrate) navigator.vibrate([150, 50, 150]);
    } else if (type === 'warning' && timeLeft <= 3) {
      hapticImpact('light');
    }
  };

  React.useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (phase === 'work') {
            setRoundHistory(h => [...h, { round: currentRound, phase: 'work', duration: totalSec, timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }]);
            notify('phase');
            if (currentRound >= rounds) { notify('complete'); setRoundHistory(h => [...h, { round: currentRound, phase: 'rest', duration: 0, timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }]); stop(); return 0; }
            setPhase('rest');
            return restSec;
          } else {
            setRoundHistory(h => [...h, { round: currentRound, phase: 'rest', duration: restSec, timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }]);
            notify('phase');
            setPhase('work');
            setCurrentRound(r => r + 1);
            return totalSec;
          }
        }
        if (prev <= 3) notify('warning');
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [isRunning, phase, currentRound, rounds, totalSec, restSec, timeLeft]);

  const pct = phase === 'work' ? (timeLeft / totalSec) * 100 : (timeLeft / restSec) * 100;

  const applyPreset = (preset: Preset) => {
    if (isRunning) return;
    setTotalSec(preset.work);
    setRestSec(preset.rest);
    setRounds(preset.rounds);
    setSettings({ work: preset.work, rest: preset.rest, rounds: preset.rounds });
    setTimeLeft(preset.work);
  };

  React.useEffect(() => {
    if (initialSettings && !isRunning) {
      setTotalSec(initialSettings.work);
      setRestSec(initialSettings.rest);
      setRounds(initialSettings.rounds);
      setSettings({ work: initialSettings.work, rest: initialSettings.rest, rounds: initialSettings.rounds });
      setTimeLeft(initialSettings.work);
    }
  }, [initialSettings, isRunning]);

  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{
      padding: 16, borderRadius: 16, textAlign: 'center',
      background: 'rgba(24,24,27,0.12)', border: '1px solid var(--glass-border)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
        {phase === 'work' ? 'РАБОТА' : 'ОТДЫХ'} · Раунд {currentRound}/{rounds}
      </div>
      <div style={{
        fontSize: 64, fontWeight: 800, lineHeight: 1,
        background: 'linear-gradient(135deg, #00e68a, #00c853)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
      </div>
      <div style={{
        marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 3,
          background: phase === 'work' ? 'var(--accent)' : '#3b82f6',
          transition: 'width 1s linear',
        }} />
      </div>
    </div>

    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {PRESETS.map(preset => (
        <button key={preset.name} onClick={() => applyPreset(preset)} disabled={isRunning}
          style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-dim)' }}>
          {preset.name}
        </button>
      ))}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
      <div>
        <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Работа (с)</label>
        <input type="number" min={5} max={600} value={totalSec || ''} onChange={e => { const v = parseInt(e.target.value) || 60; setTotalSec(v); setSettings(s => ({ ...s, work: v })); }} disabled={isRunning}
          style={{ width: '100%', padding: '8px', borderRadius: 8, textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Отдых (с)</label>
        <input type="number" min={5} max={600} value={restSec || ''} onChange={e => { const v = parseInt(e.target.value) || 30; setRestSec(v); setSettings(s => ({ ...s, rest: v })); }} disabled={isRunning}
          style={{ width: '100%', padding: '8px', borderRadius: 8, textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Раунды</label>
        <input type="number" min={1} max={20} value={rounds || ''} onChange={e => { const v = parseInt(e.target.value) || 3; setRounds(v); setSettings(s => ({ ...s, rounds: v })); }} disabled={isRunning}
          style={{ width: '100%', padding: '8px', borderRadius: 8, textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
      </div>
    </div>

    <div style={{ display: 'flex', gap: 8 }}>
      {!isRunning ? (
        <button onClick={start}
          style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 14 }}>
          ▶ Старт
        </button>
      ) : (
        <button onClick={stop}
          style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14 }}>
          ⏸ Стоп
        </button>
      )}
      <button onClick={skipPhase} disabled={!isRunning}
        style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer',
          background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 14, opacity: isRunning ? 1 : 0.5 }}>
        ⏭ След.
      </button>
      <button onClick={reset}
        style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer',
          background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 14 }}>
        ↺ Сброс
      </button>
    </div>

    {roundHistory.length > 0 && (
      <div style={{ padding: 10, borderRadius: 12, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>🕓 История раундов</div>
          <button onClick={() => setRoundHistory([])} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>Очистить</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
          {roundHistory.map((r, i) => (
            <div key={i} style={{ padding: 6, borderRadius: 8, background: r.phase === 'work' ? 'rgba(0,230,138,0.08)' : 'rgba(59,130,246,0.08)', border: '1px solid ' + (r.phase === 'work' ? 'rgba(0,230,138,0.18)' : 'rgba(59,130,246,0.18)') }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: r.phase === 'work' ? 'var(--accent)' : '#60a5fa' }}>Раунд {r.round}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{r.phase === 'work' ? 'РАБОТА' : 'ОТДЫХ'} · {r.duration}с</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{r.timestamp}</div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>);
};
