import React from 'react';
import { computeStructuredAnalytics } from '../../../engines/structured-analytics.engine';

export const StructuredAnalyticsCard: React.FC<{ sessions: any[] }> = ({ sessions }) => {
  const result = React.useMemo(() => {
    try {
      return sessions.length > 0 ? computeStructuredAnalytics(sessions) : null;
    } catch { return null; }
  }, [sessions]);
  if (!result) return null;
  return (<div className="card" style={{ marginTop:8, padding:10 }}>
    <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📊 Структурная</h4>
    <div style={{ fontSize:10 }}>Сессий: <b>{(result as any).sessionCount || sessions.length}</b> | Объём: <b>{(result as any).totalVolume || '—'}</b></div>
    {(result as any).insights?.slice(0,3).map((r:any,i:number)=><div key={i} style={{ fontSize:9,color:'var(--text-dim)',marginTop:2 }}>• {r}</div>)}
  </div>);
};
