import React, { useMemo } from 'react';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { computeBBDiaryFeedback, loadActiveBBPlan } from '../../../engines/bb/bb-diary-feedback.engine';
import { diaryCard, diaryLabel } from './diary-tokens';

const barColor = (pct: number | null) => {
  if (pct == null) return 'rgba(255,255,255,0.15)';
  if (pct >= 100) return '#22c55e';
  if (pct >= 80) return '#00e68a';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
};

const zoneColor: Record<string, string> = {
  optimal: '#22c55e',
  caution: '#f59e0b',
  dangerous: '#ef4444',
  undertrained: '#60a5fa',
};

export const BBFeedbackCard: React.FC = () => {
  const sessions = useMemo(() => {
    try { return loadSessions(); } catch { return []; }
  }, []);
  const plan = useMemo(() => {
    try { return loadActiveBBPlan(); } catch { return null; }
  }, []);

  const fb = useMemo(() => computeBBDiaryFeedback(plan as any, sessions as any), [plan, sessions]);

  if (!fb.hasPlan && !fb.hasSessions) {
  return (
    <div className="train-bbfeedback" style={{ ...diaryCard, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ ...diaryLabel, color: '#fff' }}>📊 Фидбек ББ-плана</div>
        <div style={{ fontSize: 11, color: '#fff', marginTop: 4 }}>Нет плана и логов — создайте план в ББ-авто и начните логировать тренировки.</div>
      </div>
    );
  }

  return (
    <div className="train-bbfeedback" style={{ ...diaryCard, border: '1px solid rgba(0,230,138,0.14)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ ...diaryLabel, color: '#00e68a', marginBottom: 0 }}>📊 Фидбек: план vs факт (дневник)</div>
        <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: 'rgba(0,230,138,0.12)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.25)' }}>
          {fb.hasPlan ? `${fb.plannedSessions} запл.` : 'нет плана'} · {fb.completedSessions} вып.
        </div>
      </div>

      {/* Adherence */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 120, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, color: '#fff' }}>Adherence (сессии)</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: barColor(fb.adherencePct) }}>{fb.adherencePct != null ? `${fb.adherencePct}%` : '—'}</div>
          <div style={{ fontSize: 9, color: '#fff' }}>{fb.totalCompletedSets} / {fb.totalPlannedSets} сетов</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, color: '#fff' }}>ACWR (нагрузка)</div>
          {fb.acwr ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 800, color: zoneColor[fb.acwr.zone] || '#fff' }}>{fb.acwr.ratio} · {fb.acwr.zone}</div>
              <div style={{ fontSize: 9, color: '#fff' }}>{fb.acwr.zone === 'optimal' ? 'в норме' : fb.acwr.zone === 'dangerous' ? 'перегруз' : fb.acwr.zone === 'caution' ? 'осторожно' : 'недотрен'}</div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: '#fff' }}>недостаточно sRPE данных (≥14д)</div>
          )}
        </div>
      </div>

      {/* Weekly bars */}
      {fb.weekly.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Недели: план vs факт (сеты)</div>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
            {fb.weekly.slice(0, 12).map(w => (
              <div key={w.week} style={{ minWidth: 48, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 4px', border: `1px solid ${barColor(w.adherencePct)}40` }}>
                <div style={{ fontSize: 9, color: '#fff' }}>Н{w.week}</div>
                <div style={{ fontSize: 9, color: '#fff' }}>{w.phase || ''}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: barColor(w.adherencePct) }}>{w.adherencePct != null ? `${w.adherencePct}%` : '—'}</div>
                <div style={{ fontSize: 8, color: '#fff' }}>{w.completedSets}/{w.plannedSets}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* e1RM alerts */}
      {fb.e1rmAlerts.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 4 }}>e1RM тренды (4+ сессии)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {fb.e1rmAlerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: a.status === 'up' ? 'rgba(34,197,94,0.08)' : a.status === 'down' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${a.status === 'up' ? 'rgba(34,197,94,0.25)' : a.status === 'down' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{a.exercise}</div>
                  <div style={{ fontSize: 9, color: '#fff' }}>{a.muscle} · {a.e1rmBefore}→{a.e1rmAfter} кг</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: a.status === 'up' ? '#22c55e' : a.status === 'down' ? '#ef4444' : '#f59e0b' }}>{a.deltaPct > 0 ? '+' : ''}{a.deltaPct}% · {a.status === 'up' ? '↗' : a.status === 'down' ? '↘' : '→'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {fb.warnings.length > 0 && (
        <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>⚠️ Сигналы</div>
          {fb.warnings.slice(0, 6).map((w, i) => <div key={i} style={{ fontSize: 10, color: '#fff', lineHeight: 1.4 }}>• {w}</div>)}
        </div>
      )}

      {/* Recommendations */}
      {fb.recommendations.length > 0 && (
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>💡 Рекомендации</div>
          {fb.recommendations.slice(0, 5).map((r, i) => <div key={i} style={{ fontSize: 10, color: '#fff', lineHeight: 1.4 }}>• {r}</div>)}
        </div>
      )}

      {!fb.hasPlan && fb.hasSessions && (
        <div style={{ marginTop: 6, fontSize: 9, color: '#fff' }}>Подсказка: создайте ББ-план в Конструкторе → он попадёт в фидбек автоматически.</div>
      )}
    </div>
  );
};

export default BBFeedbackCard;
