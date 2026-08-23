/**
 * VBTCalcTab.tsx — ВПТ-калькулятор (тренировка по скорости): целевая скорость по цели →
 * прогнозируемый %1RM и вес. Также: e1RM по скорости штанги, анализ потери скорости,
 * пороги потери по цели. Источники: Gonzalez-Badillo, Jovanovic — без выдумок.
 * Использует pro/vbt.engine.
 */
import React, { useMemo, useState } from 'react';
import {
  LOAD_VELOCITY_PROFILE,
  INTENT_ZONES,
  velocityForPct,
  pctForVelocity,
  targetVelocity,
  targetPct,
  loadForPct,
  estimate1RMFromVelocity,
  velocityLoss,
  thresholdForIntent,
  velocityLossZone,
  diagnoseVelocity,
  type VBTLift,
  type VBTIntent,
  type VelocityLossThreshold,
} from '../../../engines/pro/vbt.engine';
import { analyzeStickingCorrections, type AssistanceAnalysis } from '../../../engines/pro/lift-assistance.engine';
import type { Lift } from '../../../engines/lms/weakpoint-pl';
import { PopupNumber, PopupSelect, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = '#fff';
const SMALL: React.CSSProperties = { color: '#fff', fontSize: 11, lineHeight: 1.45 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 10, minHeight: 40, width: '100%', boxSizing: 'border-box' as const, fontSize: 13, textAlign: 'center' as const };

const LIFT_RU: Record<VBTLift, string> = { squat: 'Присед', bench: 'Жим лёжа', deadlift: 'Тяга', ohp: 'Армейский жим', row: 'Тяга штанги в наклоне' };
const INTENT_RU: Record<VBTIntent, string> = {
  absolute_strength: 'Абсолютная сила (≥90%)',
  strength: 'Сила (85-95%)',
  power_heavy: 'Мощность тяжёлая (70-85%)',
  power_light: 'Мощность лёгкая (40-60%)',
  hypertrophy: 'Гипертрофия (60-80%)',
  speed: 'Скорость (30-50%)',
};

const liftOpts: { id: VBTLift; label: string; desc: string }[] = (Object.keys(LOAD_VELOCITY_PROFILE) as VBTLift[]).map(k => ({ id: k, label: LIFT_RU[k], desc: `Профиль: ${LOAD_VELOCITY_PROFILE[k].length} точек %[1RM]→скорость (м/с)` }));
const intentOpts: { id: VBTIntent; label: string; desc: string }[] = (Object.keys(INTENT_ZONES) as VBTIntent[]).map(k => ({ id: k, label: INTENT_RU[k], desc: `Целевые %1RM: ${(INTENT_ZONES[k].pct[0] * 100).toFixed(0)}–${(INTENT_ZONES[k].pct[1] * 100).toFixed(0)}%` }));

export const VBTCalcTab: React.FC = () => {
  const [lift, setLift] = useState<VBTLift>('squat');
  const [intent, setIntent] = useState<VBTIntent>('strength');
  const [e1RM, setE1RM] = useState(180);
  const [measuredVelocity, setMeasuredVelocity] = useState(0);
  const [measuredWeight, setMeasuredWeight] = useState(0);
  const [velocitiesStr, setVelocitiesStr] = useState('1.0,0.94,0.9,0.86,0.82');

  // Расчёт intent → цель
  const tgt = useMemo(() => {
    const tv = targetVelocity(intent);
    const tp = targetPct(intent);
    const workWeight = loadForPct(e1RM, tp);
    const predictedVel = velocityForPct(lift, tp);
    return { tv, tp, workWeight, predictedVel };
  }, [lift, intent, e1RM]);

  // e1RM по скорости и весу
  const velEst = useMemo(() => {
    if (measuredVelocity <= 0 || measuredWeight <= 0) return null;
    return estimate1RMFromVelocity(lift, measuredVelocity, measuredWeight);
  }, [lift, measuredVelocity, measuredWeight]);

  // velocity-loss анализ
  const vlRes = useMemo(() => {
    const vs = velocitiesStr.split(/[\s,]+/).map(Number).filter(n => n > 0);
    if (vs.length === 0) return null;
    const thr = thresholdForIntent(intent);
    return velocityLoss(vs, thr);
  }, [velocitiesStr, intent]);

  // Корректирующие упражнения фазы срыва (VBT): при превышении порога потери
  // скорости → вероятная слабая фаза (максимальный момент) → корректировки.
  const vbtCorrections = useMemo<AssistanceAnalysis | null>(() => {
    const vs = velocitiesStr.split(/[\s,]+/).map(Number).filter(n => n > 0);
    if (vs.length < 2) return null;
    const best = Math.max(...vs);
    const last = vs[vs.length - 1];
    const liftAsLift = lift as Lift;
    const d = diagnoseVelocity(liftAsLift, best, last, measuredWeight > 0 ? measuredWeight : undefined);
    if (!d.exceeded || !d.suggestedPhase) return null;
    return analyzeStickingCorrections(liftAsLift, d.suggestedPhase);
  }, [velocitiesStr, lift, measuredWeight]);

  // LVP-таблица для выбранного движения
  const lvpTable = LOAD_VELOCITY_PROFILE[lift];
  const vlThreshold = thresholdForIntent(intent);

  // Цвет скорости по интенту (в зоне?)
  const velColor = (v: number) => {
    const z = INTENT_ZONES[intent];
    return v >= z.velocity[0] && v <= z.velocity[1] ? ACCENT : '#fff';
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>⚡ ВПТ / Калькулятор скорости штанги (тренировка по скорости, VBT)</div>
      <div style={{ ...SMALL, color: '#fff', marginBottom: 10 }}>
        Тренировка по скорости штанги: нагрузка связана с %1RM через профиль «нагрузка–скорость» (load-velocity profile, Gonzalez-Badillo / Jovanovic).
        <b>1.</b> Целевая установка (цель) → прогнозируемый %1RM, скорость, рабочий вес.<br />
        <b>2.</b> e1RM по измеренной скорости и поднятому весу (через профиль нагрузка–скорость).<br />
        <b>3.</b> Анализ потери скорости: порог по цели для авторегулируемого окончания сета.
      </div>

      {/* Параметры */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>⚙️ Параметры</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <PopupSelect label="Движение" value={lift} options={liftOpts} onChange={v => setLift(v as VBTLift)} />
          <PopupSelect label="Цель (намерение)" value={intent} options={intentOpts} onChange={v => setIntent(v as VBTIntent)} />
          <PopupNumber label="Оценочный 1RM" value={e1RM} min={20} max={600} suffix=" кг" onChange={setE1RM} />
        </div>
      </div>

      {/* Целевые значения по цели */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <MetricCard title="Целевой %1RM" icon="🎯" accent={ACCENT}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{Math.round(tgt.tp * 100)}%</div>
          <div style={SMALL}>по цели</div>
        </MetricCard>
        <MetricCard title="Рабочий вес" icon="🏋️" accent={ACCENT}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{tgt.workWeight}</div>
          <div style={SMALL}>кг (при 1RM {e1RM})</div>
        </MetricCard>
        <MetricCard title="Целевая скорость" icon="⚡" accent="#3b82f6">
          <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>{tgt.tv.ideal}</div>
          <div style={SMALL}>м/с (диапазон {tgt.tv.min}–{tgt.tv.max})</div>
        </MetricCard>
        <MetricCard title="Прогноз скорости" icon="📈" accent={ACCENT}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{tgt.predictedVel}</div>
          <div style={SMALL}>м/с из профиля для {Math.round(tgt.tp * 100)}%</div>
        </MetricCard>
      </div>

      {/* e1RM по измеренной скорости */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📏 Расчёт e1RM по скорости штанги (измеренной)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <PopupNumber label="Скорость штанги (м/с)" value={measuredVelocity} min={0} max={2} step={0.01} suffix=" м/с" onChange={v => setMeasuredVelocity(v || 0)} />
          <PopupNumber label="Поднятый вес (кг)" value={measuredWeight} min={0} max={600} suffix=" кг" onChange={v => setMeasuredWeight(v || 0)} />
        </div>
        {velEst ? (
          <div style={ROWStyle(ACCENT)}>
            <span style={{ color: '#fff' }}>Прогноз <b style={{ color: ACCENT }}>e1RM</b> (из профиля):</span>
            <span><b style={{ color: ACCENT }}>{velEst.e1RM} кг</b> · %1RM = <b>{Math.round(velEst.pct1RM * 100)}%</b></span>
          </div>
        ) : (
          <div style={SMALL}>Введите скорость и вес → прогноз e1RM (через профиль «нагрузка–скорость» для {LIFT_RU[lift]}).</div>
        )}
      </div>

      {/* Анализ потери скорости */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📉 Потеря скорости в сете</div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>Скорости повторов через запятую: стоп сета при превышении порога {vlThreshold}% (для цели «{INTENT_RU[intent]}»).</div>
        <input type="text" value={velocitiesStr} onChange={e => setVelocitiesStr(e.target.value)} style={{ ...IN, textAlign: 'left' as const, marginBottom: 8 }} placeholder="1.0, 0.94, 0.9, 0.86, 0.82" />
        {vlRes ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
              <SmallMetric label="Лучш. скорость" value={vlRes.bestVelocity + ' м/с'} color="#3b82f6" />
              <SmallMetric label="Послед. скорость" value={vlRes.lastVelocity + ' м/с'} color="#a855f7" />
              <SmallMetric label="Потеря %" value={vlRes.lossPct + '%'} color={vlRes.exceeded ? '#ef4444' : ACCENT} />
              <SmallMetric label="Порог" value={vlRes.threshold + '%'} color={'#f59e0b'} />
            </div>
            {vlRes.exceeded ? (
              <div style={{ padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 11, fontWeight: 700 }}>⛔ Стоп сет: потеря скорости {vlRes.lossPct}% ≥ порога {vlRes.threshold}%. {velocityLossZone(vlRes.lossPct)}.</div>
            ) : (
              <>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)', color: ACCENT, fontSize: 11, fontWeight: 700 }}>✅ Продолжать: потеря {vlRes.lossPct}% &lt; порога {vlRes.threshold}%. {velocityLossZone(vlRes.lossPct)}.</div>
                {vlRes.remainingReps != null && <div style={{ ...SMALL, marginTop: 6 }}>Осталось повторов до порога (оценка): <b style={{ color: ACCENT }}>{vlRes.remainingReps}</b></div>}
              </>
            )}
          </>
        ) : (
          <div style={SMALL}>Введите скорости повторов в формате «1.0, 0.9, 0.8...».</div>
        )}
      </div>

      {/* Корректирующие упражнения фазы срыва */}
      {vbtCorrections && vbtCorrections.items.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>🏋️ Корректировки фазы срыва (по скорости)</div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>
            Скорость упала за порог {vlThreshold}% — вероятная слабая фаза «{vbtCorrections.phase}» (максимальный момент). Корректирующие упражнения:
          </div>
          {vbtCorrections.items.map((item, i) => (
            <div key={i} style={ROWStyle(ACCENT)}>
              <span style={{ color: '#fff', fontWeight: 700 }}>{item.exercise.name}</span>
              <span style={{ color: DIM, whiteSpace: 'nowrap' }}>{item.protocol.sets}×{item.protocol.reps} @{Math.round(item.protocol.pct * 100)}% RIR {item.protocol.rir}{item.optimal ? ' · ⭐' : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Таблица профиля нагрузка-скорость */}
      <ExpandableCard title={`📊 Профиль нагрузка–скорость: ${LIFT_RU[lift]}`} accent={ACCENT} short="Скорость по %1RM (Gonzalez-Badillo / Jovanovic)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: 4 }}>
          {lvpTable.map(([pct, v], i) => (
            <div key={i} style={{ padding: 6, borderRadius: 6, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: velColor(v) }}>{Math.round(pct * 100)}%</div>
              <div style={{ fontSize: 10, color: '#fff' }}>{v} м/с</div>
            </div>
          ))}
        </div>
      </ExpandableCard>

      {/* Зоны по цели */}
      <ExpandableCard title="🎯 Зоны по цели" accent={ACCENT} short="Целевые %1RM, скорость, повторы по цели">
        {Object.entries(INTENT_ZONES).map(([k, z]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(64px,1.2fr) 1fr 1fr 1fr 0.8fr 0.8fr', gap: 4, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 10, color: '#fff', minWidth: 340 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 11, overflowWrap: 'anywhere' }}>{INTENT_RU[k as VBTIntent]}</span>
            <span>{(z.pct[0] * 100).toFixed(0)}–{(z.pct[1] * 100).toFixed(0)}%</span>
            <span>{z.velocity[0]}–{z.velocity[1]} м/с</span>
            <span>повт: {z.reps[0]}–{z.reps[1]}</span>
            <span style={{ color: ACCENT }}>цел. {z.idealPct * 100}%</span>
            <span style={{ color: '#3b82f6' }}>{z.idealVelocity} м/с</span>
          </div>
        ))}
      </ExpandableCard>

      <div style={{ fontSize: 10, color: DIM, marginTop: 12, lineHeight: 1.4 }}>
        Источники: Gonzalez-Badillo & Sanchez-Medina (2010) для приседа/жима; Jovanovic M. (2017) VBT-методология.
        Пороги потери скорости: power 10%, strength 20%, hypertrophy 25%, metabolic 40%.
      </div>
{(lift === 'squat' || lift === 'bench' || lift === 'deadlift') && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>🔗 Применить e1RM ({LIFT_RU[lift]} = {e1RM} кг) как ПМ движения к планировщику — план пересчитает веса.</div>
          <button onClick={() => applyToPlanner({ kind: 'pm', label: 'e1RM ' + LIFT_RU[lift] + ' ' + e1RM + ' кг', data: { lift: lift === 'deadlift' ? 'dead' : lift, value: e1RM } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить e1RM к ПМ планировщика</button>
        </div>
      )}
    </div>
  );
};

// local helpers
function ROWStyle(c: string): React.CSSProperties { return { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: '#fff' }; }
function SmallMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: 8, borderRadius: 8, textAlign: 'center', background: `${color}0f`, border: `1px solid ${color}33` }}>
      <div style={{ fontSize: 10, color: '#fff' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

export default VBTCalcTab;