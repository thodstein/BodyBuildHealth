/**
 * DeloadProtocolCard.tsx — отображает выбранный протокол делода с расписанием по дням.
 */
import React, { useState } from 'react';
import {
  type StructuredDeload,
  type DeloadDay,
  DELOAD_PROTOCOLS,
  selectDeloadProtocol,
} from '../../../engines/deload-engine';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';

const DAY_ICONS: Record<string, string> = {
  rest: '🛌',
  cardio_light: '🚶',
  mobility: '🤸',
  light_weights: '🏋️',
  technique: '🎯',
  pump: '💪',
  stretching: '🧘',
  massage: '💆',
};

const DAY_LABELS: Record<string, string> = {
  rest: 'Отдых',
  cardio_light: 'Лёгкое кардио',
  mobility: 'Мобильность',
  light_weights: 'Лёгкие веса',
  technique: 'Техника',
  pump: 'Пампинг',
  stretching: 'Растяжка',
  massage: 'Восстановление',
};

interface Props {
  ctx: {
    acwr: number;
    weeksSinceDeload: number;
    fatigue: number;
    recovery: number;
    hasCompetitionSoon: boolean;
    jointPain: boolean;
    cnsFatigue: boolean;
    goal: string;
  };
  overrideProtocol?: string;
}

export const DeloadProtocolCard: React.FC<Props> = ({ ctx, overrideProtocol }) => {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const protocol: StructuredDeload = overrideProtocol
    ? DELOAD_PROTOCOLS[overrideProtocol] || selectDeloadProtocol(ctx)
    : selectDeloadProtocol(ctx);

  const urgencyColor = protocol.protocolType === 'full' ? '#ef4444'
    : protocol.protocolType === 'active' ? '#f59e0b'
    : protocol.protocolType === 'backoff' ? '#3b82f6'
    : ACCENT;

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
            📋 {protocol.protocolName}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>
            {protocol.days} дней · объём −{protocol.volumeReductionPct}% · RIR {protocol.rirTarget}
          </div>
        </div>
      </div>

      {/* Протоколы переключения */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {Object.entries(DELOAD_PROTOCOLS).map(([key, p]) => (
          <button key={key}
            style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
              border: `1px solid ${protocol.protocolType === p.protocolType ? '#00e68a' : 'rgba(255,255,255,0.1)'}`,
              background: protocol.protocolType === p.protocolType ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.02)',
              color: protocol.protocolType === p.protocolType ? '#00e68a' : 'rgba(255,255,255,0.85)',
            }}
            onClick={() => setExpandedDay(null)} // just visual, actual switching via parent
          >
            {p.protocolName.split('(')[0].trim()}
          </button>
        ))}
      </div>

      {/* Расписание по дням */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {protocol.weeklySchedule.map((day) => (
          <div key={day.day}>
            <button
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                background: expandedDay === day.day ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${expandedDay === day.day ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
                color: '#fff', fontSize: 11, textAlign: 'left', minHeight: 36,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
            >
              <span>{DAY_ICONS[day.type] || '📌'}</span>
              <span style={{ fontWeight: 600, minWidth: 20 }}>Д{day.day}</span>
              <span style={{ color:'rgba(255,255,255,0.9)', flex: 1 }}>{day.description}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>{expandedDay === day.day ? '▲' : '▼'}</span>
            </button>

            {expandedDay === day.day && (
              <div style={{ padding: '6px 10px 6px 36px', fontSize: 10, color:'rgba(255,255,255,0.9)' }}>
                {day.notes && <div style={{ marginBottom: 4, fontStyle: 'italic' }}>{day.notes}</div>}
                {day.exercises && day.exercises.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {day.exercises.map((ex, i) => (
                      <div key={i} style={{ padding: '2px 0', fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                        • {ex.name}: {ex.sets}×{ex.reps}{ex.intensityPct ? ` @${ex.intensityPct}%` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Предупреждения */}
      {protocol.warnings.length > 0 && (
        <div style={{ marginTop: 6, padding: 8, borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>⚠️</div>
          {protocol.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 10, color:'rgba(255,255,255,0.9)', marginBottom: 2 }}>{w}</div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
        Ожидаемое восстановление: {protocol.expectedRecovery}
      </div>
    </div>
  );
};

export default DeloadProtocolCard;
