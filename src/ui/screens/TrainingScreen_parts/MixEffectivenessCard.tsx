/** MixEffectivenessCard.tsx — карточка «🎯 Эффективность миксов» в аналитике дневника тренировок.
 *  Сравнивает качество сессий (RPE, объём, длительность) в дни с приёмом микса/пресета
 *  против дней без — корреляция «принял микс → качество тренировки» (analyzeMixEffectiveness). */
import React, { useMemo } from 'react';
import { analyzeMixEffectiveness, type MixEffectiveness } from '../../../engines/training-plan-save.engine';

const CARD: React.CSSProperties = {
  padding: 10, borderRadius: 12,
  background: 'rgba(24,24,27,0.35)', border: '1px solid rgba(139,92,246,0.2)',
  marginBottom: 8,
};

function fmtVolume(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}т` : `${Math.round(v)}кг`;
}

export const MixEffectivenessCard: React.FC<{ workouts: { date: string; overallRPE?: number; duration?: number; exercises?: { totalVolume?: number }[] }[] }> = ({ workouts }) => {
  const data = useMemo<MixEffectiveness | null>(() => {
    try {
      return analyzeMixEffectiveness((workouts || []).map(w => ({
        date: w.date,
        overallRPE: w.overallRPE,
        duration: w.duration,
        totalVolume: (w.exercises || []).reduce((s, e) => s + (e.totalVolume || 0), 0),
      })));
    } catch {
      return null;
    }
  }, [workouts]);

  if (!data) return null;

  const volPct = data.withoutMix.avgVolume > 0 ? Math.round((data.volumeDelta / data.withoutMix.avgVolume) * 100) : 0;
  const volumeBetter = data.volumeDelta > 0;
  const rpeNote = data.rpeDelta === 0 ? 'RPE без изменений' : (data.rpeDelta > 0 ? `RPE выше на ${Math.abs(data.rpeDelta)} (интенсивнее)` : `RPE ниже на ${Math.abs(data.rpeDelta)} (легче)`);

  const Cell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: '#fff' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginTop: 2 }}>{value}</div>
    </div>
  );

  return (
    <div style={CARD}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 2 }}>🎯 Эффективность миксов</div>
      <div style={{ fontSize: 9, color: '#fff', marginBottom: 8 }}>
        Сравнение сессий в дни с приёмом микса/пресета и без него (RPE, объём, длительность).
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
        <Cell label={`С миксом (${data.withMix.sessions})`} value={`RPE ${data.withMix.avgRpe}`} />
        <Cell label={`Без микса (${data.withoutMix.sessions})`} value={`RPE ${data.withoutMix.avgRpe}`} />
        <Cell label="Объём с миксом" value={fmtVolume(data.withMix.avgVolume)} />
        <Cell label="Объём без микса" value={fmtVolume(data.withoutMix.avgVolume)} />
        <Cell label="Длительность с" value={`${data.withMix.avgDuration} мин`} />
        <Cell label="Длительность без" value={`${data.withoutMix.avgDuration} мин`} />
      </div>
      <div style={{ fontSize: 10, color: volumeBetter ? '#00e68a' : '#f59e0b', fontWeight: 600, marginBottom: 3 }}>
        {data.volumeDelta === 0 ? 'Объём без изменений' : (volumeBetter ? `📈 В дни с миксом объём выше на ${fmtVolume(Math.abs(data.volumeDelta))} (${volPct}%)` : `📉 В дни с миксом объём ниже на ${fmtVolume(Math.abs(data.volumeDelta))} (${Math.abs(volPct)}%)`)}
      </div>
      <div style={{ fontSize: 9, color: '#fff' }}>
        • {rpeNote} · сессий с миксом: {data.withMix.sessions}, без: {data.withoutMix.sessions}
      </div>
      <div style={{ fontSize: 8, color: '#fff', marginTop: 4 }}>
        ⚠️ Корреляция, не причинность: на качество сессии влияют сон, нагрузка и план. Отмечайте фазы приёма в секции «💊 Миксы и пресеты».
      </div>
    </div>
  );
};

export default MixEffectivenessCard;
