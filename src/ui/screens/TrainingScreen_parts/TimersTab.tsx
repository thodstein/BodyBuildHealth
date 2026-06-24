import React from 'react';

export const TimersTab: React.FC = () => {
  const [totalSec, setTotalSec] = React.useState(60);
  const [restSec, setRestSec] = React.useState(30);
  const [rounds, setRounds] = React.useState(3);
  const [isRunning, setIsRunning] = React.useState(false);
  const [currentRound, setCurrentRound] = React.useState(0);
  const [phase, setPhase] = React.useState<'work' | 'rest'>('work');
  const [timeLeft, setTimeLeft] = React.useState(0);
  const intervalRef = React.useRef<number | null>(null);

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

  React.useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (phase === 'work') {
            if (currentRound >= rounds) { stop(); return 0; }
            setPhase('rest');
            return restSec;
          } else {
            setPhase('work');
            setCurrentRound(r => r + 1);
            return totalSec;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [isRunning, phase, currentRound, rounds, totalSec, restSec]);

  const pct = phase === 'work' ? (timeLeft / totalSec) * 100 : (timeLeft / restSec) * 100;

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

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
      <div>
        <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Работа (с)</label>
        <input type="number" min={5} max={600} value={totalSec || ''} onChange={e => setTotalSec(parseInt(e.target.value) || 60)} disabled={isRunning}
          style={{ width: '100%', padding: '8px', borderRadius: 8, textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Отдых (с)</label>
        <input type="number" min={5} max={600} value={restSec || ''} onChange={e => setRestSec(parseInt(e.target.value) || 30)} disabled={isRunning}
          style={{ width: '100%', padding: '8px', borderRadius: 8, textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Раунды</label>
        <input type="number" min={1} max={20} value={rounds || ''} onChange={e => setRounds(parseInt(e.target.value) || 3)} disabled={isRunning}
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
      <button onClick={reset}
        style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer',
          background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 14 }}>
        ↺ Сброс
      </button>
    </div>
  </div>);
};
