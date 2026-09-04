import React, { useState, useCallback } from 'react';
import { PEAKING_PROTOCOLS, getPeakingProtocol } from '../../../engines/peaking-protocols.engine';
import type { PeakingProtocol, PeakingWeek } from '../../../engines/peaking-protocols.engine';
import { getRecoveryProtocols, getMentalRoutines } from '../../../engines/gym-competition.engine';
import type { RecoveryProtocol, MentalRoutine } from '../../../engines/gym-competition.engine';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = '#fff';
const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.5)', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.05)', marginBottom: 10 };

const PROTOCOL_COLORS: Record<string, string> = { pl: '#3b82f6', bb: '#a855f7', classic: '#f59e0b' };
const PROTOCOL_ICONS: Record<string, string> = { pl: '🏋️', bb: '💪', classic: '🔄' };

const weekChip = (w: PeakingWeek, accent: string): React.ReactNode => (
  <div key={w.week} style={{
    display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, alignItems: 'start',
    padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 10,
  }}>
    <div>
      <span style={{ fontWeight: 700, color: accent, marginRight: 6 }}>Н{w.week}</span>
      <span style={{ color: '#fff' }}>{w.label}</span>
      {w.deloadBefore && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>разгрузка перед</span>}
      <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{w.focus}</div>
    </div>
    <div style={{ textAlign: 'right', fontSize: 10 }}>
      <div>Объём: <b style={{ color: accent }}>{Math.round(w.volumePct * 100)}%</b></div>
      <div>Инт: <b style={{ color: accent }}>{Math.round(w.intensityPct * 100)}%</b></div>
      <div>RIR: <b style={{ color: accent }}>{w.rirMin}-{w.rirMax}</b></div>
    </div>
  </div>
);

export const PeakingProtocolsTab: React.FC = () => {
  const [appliedProtocol, setAppliedProtocol] = useState<PeakingProtocol | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showMental, setShowMental] = useState(false);

  const recoveryProtocols = getRecoveryProtocols();
  const mentalRoutines = getMentalRoutines();

  const applyProtocol = useCallback((type: PeakingProtocol) => {
    const p = getPeakingProtocol(type);
    const fw = p.weeks[p.weeks.length - 1];
    applyToPlanner({
      kind: 'peak',
      label: `Пик-протокол: ${p.name}`,
      data: { protocol: type, weeks: p.weeks, volumeMult: fw.volumePct, rirTarget: fw.rirMin },
    });
    setAppliedProtocol(type);
    setTimeout(() => setAppliedProtocol(null), 2000);
  }, []);

  return (
    <div className="train-peakproto" style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>📈 Пик-протоколы</div>
      <div style={{ fontSize: 11, color: DIM, marginBottom: 12 }}>
        Три проверенных протокола пиковой фазы для соревнований. Выберите протокол, соответствующий вашей цели, и примените к планировщику.
      </div>

      {/* ── 3 Peaking Protocols ── */}
      {(Object.entries(PEAKING_PROTOCOLS) as [PeakingProtocol, typeof PEAKING_PROTOCOLS[PeakingProtocol]][]).map(([key, proto]) => {
        const color = PROTOCOL_COLORS[key] || ACCENT;
        const icon = PROTOCOL_ICONS[key] || '📈';
        const isApplied = appliedProtocol === key;
        return (
          <div key={key} style={{
            ...CARD, borderLeft: `3px solid ${color}`,
            background: `linear-gradient(135deg, ${color}08, rgba(24,24,27,0.5))`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color }}>
                  {icon} {proto.name} <span style={{ fontSize: 10, fontWeight: 400, color: DIM }}>({proto.durationWeeks} нед)</span>
                </div>
                <div style={{ fontSize: 10, color: '#fff', marginTop: 4, lineHeight: 1.5 }}>
                  {proto.description}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              {proto.weeks.map(w => weekChip(w, color))}
            </div>

            <button
              onClick={() => applyProtocol(key)}
              style={{
                width: '100%', padding: 10, borderRadius: 8, cursor: 'pointer',
                border: isApplied ? '1px solid #22c55e' : `1px solid ${color}40`,
                background: isApplied ? 'rgba(34,197,94,0.12)' : `${color}10`,
                color: isApplied ? '#22c55e' : color, fontWeight: 700, fontSize: 12,
                transition: 'all 0.2s',
              }}>
              {isApplied ? '✓ Применено к планировщику' : '🛠 Применить к планировщику'}
            </button>
          </div>
        );
      })}

      {/* ── Recovery Protocols ── */}
      <div style={CARD}>
        <button onClick={() => setShowRecovery(v => !v)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700 }}>
          <span>{showRecovery ? '▼' : '▶'}</span>
          <span>🔄</span>
          <span style={{ color: '#60a5fa' }}>Протоколы восстановления ({recoveryProtocols.length})</span>
        </button>
        {showRecovery && (
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {recoveryProtocols.map(r => (
              <div key={r.name} style={{
                padding: 10, borderRadius: 8, fontSize: 10,
                background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.12)',
              }}>
                <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>
                  {r.name} <span style={{ fontSize: 10, color: DIM, fontWeight: 400 }}>({r.durationMin} мин)</span>
                </div>
                <ol style={{ margin: '0 0 6px 14px', padding: 0, color: '#fff', fontSize: 10 }}>
                  {r.instructions.slice(0, 3).map((s, i) => <li key={i} style={{ marginBottom: 1 }}>{s}</li>)}
                  {r.instructions.length > 3 && <li style={{ color: DIM }}>…</li>}
                </ol>
                <div style={{ fontSize: 10, color: DIM }}>{r.whenToUse}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Mental Routines ── */}
      <div style={CARD}>
        <button onClick={() => setShowMental(v => !v)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700 }}>
          <span>{showMental ? '▼' : '▶'}</span>
          <span>🧠</span>
          <span style={{ color: '#a78bfa' }}>Ментальные рутины ({mentalRoutines.length})</span>
        </button>
        {showMental && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mentalRoutines.map(r => (
              <div key={r.name} style={{
                padding: 10, borderRadius: 8,
                background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.12)',
              }}>
                <div style={{ fontWeight: 700, color: '#a78bfa', marginBottom: 4, fontSize: 11 }}>{r.name}</div>
                <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>{r.whenToUse}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {r.steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 10, minWidth: 45, textAlign: 'right' }}>{s.duration}</span>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{s.action}</div>
                        <div style={{ fontSize: 10, color: DIM }}>{s.notes}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PeakingProtocolsTab;
