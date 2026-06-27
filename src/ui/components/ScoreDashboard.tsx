import React from 'react';

interface ModuleData {
  icon: string;
  label: string;
  risk: number;
  systemCount: number;
  totalSystems: number;
}

interface ScoreDashboardProps {
  modules: ModuleData[];
  overallRisk?: number;
}

const G: React.CSSProperties = {
  background: 'rgba(24,24,27,0.15)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: 12,
  padding: 10,
};

const getColor = (v: number) => v >= 60 ? '#ef4444' : v >= 30 ? '#fbbf24' : '#22c55e';

const ScoreDashboard: React.FC<ScoreDashboardProps> = ({ modules, overallRisk }) => {
  const sorted = [...modules].sort((a, b) => b.risk - a.risk);

  return (
    <div style={G}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        📊 Сквозная оценка рисков (TZ)
        {overallRisk !== undefined && (
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 8,
            background: `rgba(${overallRisk >= 60 ? '239,68,68' : overallRisk >= 30 ? '251,191,36' : '34,197,94'},0.15)`,
            color: getColor(overallRisk),
          }}>Total {overallRisk}%</span>
        )}
      </div>

      {sorted.map(m => {
        const color = getColor(m.risk);
        return (
          <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{m.icon}</span>
            <span style={{ fontSize: 9, color: 'var(--text)', width: 52, fontWeight: 500 }}>{m.label}</span>
            <div style={{ flex: 1, height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
              <div style={{ height: '100%', width: `${Math.min(m.risk, 100)}%`, background: color, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color, width: 32, textAlign: 'right' }}>{m.risk}%</span>
            <span style={{ fontSize: 8, color: 'var(--text-dim)', width: 20, textAlign: 'right' }}>{m.systemCount}/{m.totalSystems}</span>
          </div>
        );
      })}

      {modules.some(m => m.risk >= 60) && (
        <div style={{ fontSize: 8, color: '#ef4444', marginTop: 4 }}>
          🔴 Внимание: {modules.filter(m => m.risk >= 60).map(m => m.label).join(', ')} — критический уровень риска
        </div>
      )}
    </div>
  );
};

export default ScoreDashboard;
