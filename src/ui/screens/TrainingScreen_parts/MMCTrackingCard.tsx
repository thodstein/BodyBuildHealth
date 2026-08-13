import React, { useMemo } from 'react';
import { loadMMCLog, aggregateMMC, getMMCRecommendations, type MMCAggregate } from '../../../engines/mmc-tracking.engine';

const ACCENT = '#00e68a';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, marginBottom: 10 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 8 };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 10, margin: '6px 0 4px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.3 };

const TREND_ICON: Record<string, string> = { improving: '📈', declining: '📉', stable: '➡️' };

const MMCTrackingCard: React.FC = () => {
  const log = useMemo(() => loadMMCLog(), []);
  const aggregates = useMemo(() => aggregateMMC() as MMCAggregate[], [log]);
  const recommendations = useMemo(() => getMMCRecommendations(aggregates), [aggregates]);

  const bar = (val: number, max: number = 10, color: string = ACCENT): React.ReactNode => (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${(val / max) * 100}%`, background: color, borderRadius: 2 }} />
    </div>
  );

  if (log.length === 0) {
    return (
      <div style={GLASS}>
        <div style={H}>🔄 MMC/Пампинг/Суставы</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          Нет данных MMC. Заполняйте поля MMC/Пампинг/Суставы/Энергия (кнопка 🧠 у подхода) в дневнике тренировок или в окне выполнения тренировки.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={GLASS}>
        <div style={H}>🔄 MMC/Пампинг/Суставы ({log.length} записей)</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          Статистика по каждому упражнению: связь мозг-мышцы, пампинг, дискомфорт в суставах, энергия.
        </div>
      </div>

      <div style={GLASS}>
        <div style={H}>📊 Агрегация по упражнениям</div>
        {aggregates.map((a, i) => (
          <div key={i} style={{ marginBottom: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
              <span>{a.exerciseName} {TREND_ICON[a.trend]}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{a.totalSets} сетов</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
              <div style={LABEL}>MMC: {a.avgMmc.toFixed(1)}/10{bar(a.avgMmc)}</div>
              <div style={LABEL}>Пампинг: {a.avgPump.toFixed(1)}/10{bar(a.avgPump)}</div>
              <div style={LABEL}>Суставы: {a.avgJointDiscomfort.toFixed(1)}/10{bar(10 - a.avgJointDiscomfort, 10, '#f59e0b')}</div>
              <div style={LABEL}>Энергия: {a.avgEnergy.toFixed(1)}/10{bar(a.avgEnergy)}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={GLASS}>
        <div style={H}>💡 Рекомендации</div>
        {recommendations.map((r, i) => (
          <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>• {r}</div>
        ))}
      </div>
    </div>
  );
};

export default MMCTrackingCard;
