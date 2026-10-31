import React, { useMemo } from 'react';
import { analyzeMesoCycle, loadRirCalibrationStats, type MesoCorrectionInput } from '../../../engines/meso-correction.engine';
import type { TrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, marginBottom: 10 };

interface Props {
  profile: TrainingProfile;
  /** Не передано — нет sRPE-логов: считаем нейтральным и честно пишем об этом. */
  acwr?: number;
  monotony?: number;
  avgReadiness: number;
  mesoWeeks: number;
  missedSessions: number;
  exercises: Array<{ name: string; e1rmBefore: number; e1rmAfter: number }>;
  currentVolume: number;
  currentRir: number;
}

const MesoCorrectionCard: React.FC<Props> = ({
  profile, acwr, monotony, avgReadiness, mesoWeeks, missedSessions,
  exercises, currentVolume, currentRir,
}) => {
  const acwrInputMissing = !(typeof acwr === 'number' && Number.isFinite(acwr) && acwr > 0);
  const monotonyInputMissing = !(typeof monotony === 'number' && Number.isFinite(monotony) && monotony > 0);
  const acwrVal = acwrInputMissing ? 1 : (acwr as number);
  const monotonyVal = monotonyInputMissing ? 1 : (monotony as number);
  const input: MesoCorrectionInput = useMemo(() => {
    const rirStats = loadRirCalibrationStats();
    return {
      exercises,
      rirBias: rirStats.bias,
      rirConsistency: rirStats.consistency,
      mesoWeeks,
      avgAcwr: acwrVal,
      monotony: monotonyVal,
      avgReadiness,
      missedSessions,
      profile,
      currentVolume,
      currentRir,
    };
  }, [exercises, mesoWeeks, acwrVal, monotonyVal, avgReadiness, missedSessions, profile, currentVolume, currentRir]);

  const output = useMemo(() => analyzeMesoCycle(input), [input]);

  const severityColor = (s: string) => {
    if (s === 'critical') return '#ff4444';
    if (s === 'warning') return '#ffaa00';
    return ACCENT;
  };

  // Объём → множитель к текущим сетам, RIR → сдвиг. Делод-первым при критике объёма.
  const volumeKnown = currentVolume > 0;
  const rawMult = volumeKnown ? output.recommendedVolume / currentVolume : 1;
  const mult = Math.min(1.5, Math.max(0.5, output.needsDeloadFirst ? Math.min(rawMult, 0.6) : rawMult));
  const rirShift = output.recommendedRir - currentRir;
  const meaningful = (volumeKnown && Math.abs(mult - 1) >= 0.01) || rirShift !== 0;
  const dataNote = [
    acwrInputMissing ? 'ACWR: нет sRPE-логов (взят нейтральный 1.0)' : `ACWR ${acwrVal.toFixed(2)}`,
    monotonyInputMissing ? 'монотонность: нет данных' : `монотонность ${monotonyVal.toFixed(2)}`,
    `готовность ${Math.round(avgReadiness)}`,
    missedSessions > 0 ? `пропусков ${missedSessions}` : null,
    exercises.length ? `упражнений в динамике ${exercises.length}` : 'динамики e1RM пока нет',
  ].filter(Boolean).join(' · ');

  return (
    <div className="train-mesocorr" style={GLASS}>
      <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>🔄 Анализ и коррекция мезоцикла</div>
      <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>{output.comment}</div>

      {/* Итоговые параметры */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Объём</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: volumeKnown && output.recommendedVolume > currentVolume ? ACCENT : volumeKnown ? '#ff4444' : '#fff' }}>
            {volumeKnown ? output.recommendedVolume : '—'} <span style={{ fontSize: 10, color: '#fff' }}>сетов</span>
          </div>
          <div style={{ fontSize: 10, color: '#fff' }}>{volumeKnown ? `было ${currentVolume}` : 'нет данных'}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>RIR</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: output.recommendedRir !== currentRir ? '#ffaa00' : ACCENT }}>
            {output.recommendedRir}
          </div>
          <div style={{ fontSize: 10, color: '#fff' }}>было {currentRir}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Делоад</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: output.needsDeloadFirst ? '#ff4444' : ACCENT }}>
            {output.needsDeloadFirst ? '⚠ Нужен' : output.recommendedDeloadFreq + ' нед'}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Прогрессия</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>
            +{output.recommendedProgressionPct}%
          </div>
        </div>
      </div>

      {/* Список корректировок */}
      {output.adjustments.map((a, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0', fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ color: severityColor(a.severity), flexShrink: 0 }}>
            {a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : '🟢'}
          </span>
          <span style={{ color: '#fff' }}>{a.reason}</span>
        </div>
      ))}
<div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>🔗 Применить коррекцию мезоцикла к планировщику — рекомендуемый объём {output.recommendedVolume} сет/нед, RIR→{output.recommendedRir}, делод каждые {output.recommendedDeloadFreq} нед.</div>
        {/* Мост: kind 'pri' (объём × множитель + сдвиг RIR) работает и для ББ, и для ПЛ.
            Раньше здесь был kind 'mrv' — чисто ББ-канал: в ПЛ-плане кнопка молча ничего не делала. */}
        <button
          data-lift="meso-apply"
          disabled={!meaningful}
          aria-disabled={!meaningful}
          onClick={() => {
            if (!meaningful) return;
            applyToPlanner({
              kind: 'pri',
              label: `Мезо-коррекция: объём ×${mult.toFixed(2)}${rirShift !== 0 ? `, RIR ${rirShift > 0 ? '+' : ''}${rirShift}` : ''}`,
              data: { volumeMult: Number(mult.toFixed(2)), rirShift },
            });
          }}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: meaningful ? 'pointer' : 'not-allowed', opacity: meaningful ? 1 : 0.55, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}
        >
          {meaningful
            ? `🛠 Применить: объём ×${mult.toFixed(2)}${rirShift !== 0 ? `, RIR ${rirShift > 0 ? '+' : ''}${rirShift}` : ''}`
            : '🛠 Изменений нет — план уже соответствует рекомендации'}
        </button>
        <div style={{ fontSize: 9, color: '#fff', opacity: 0.7, marginTop: 6, lineHeight: 1.4 }}>
          {dataNote}
        </div>
      </div>
    </div>
  );
};

export default MesoCorrectionCard;
