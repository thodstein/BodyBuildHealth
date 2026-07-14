/** PlWeakpointsCard.tsx — диагностика слабых точек силовых движений (ПЛ).
 * REUSE lms/weakpoint-pl (diagnoseWeakPoint + WEAK_POINTS_BY_LIFT) — ранее 0% в UI. */
import React, { useState, useMemo } from 'react';
import { diagnoseWeakPoint, WEAK_POINTS_BY_LIFT, type Lift, type WeakPoint } from '../../../engines/lms/weakpoint-pl';
import { loadTrainingProfile, saveTrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };

const LIFT_RU: Record<Lift, string> = { bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая тяга' };
const WP_RU: Record<WeakPoint, string> = { off_chest: 'Сход со груди', mid: 'Средняя точка', lockout: 'Дожим', start: 'Старт', bottom: 'Низ (выход из ямы)', sticking_mid: 'Зависание в середине' };

export const PlWeakpointsCard: React.FC = () => {
  const [lift, setLift] = useState<Lift>('bench');
  const wps = WEAK_POINTS_BY_LIFT[lift];
  const [wp, setWp] = useState<WeakPoint>(wps[0]);
  const diag = useMemo(() => diagnoseWeakPoint(lift, wp), [lift, wp]);
  const [saved, setSaved] = useState(false);
  // маппинг движение → слабая группа профиля (используется ПЛ/ББ/ручным для приоритета объёма)
  const LIFT_TO_GROUP: Record<Lift, string> = { bench: 'chest', squat: 'legs', deadlift: 'back' };
  const saveFocus = () => { const p = loadTrainingProfile(); const g = LIFT_TO_GROUP[lift]; if (g && !p.weakPoints.includes(g)) saveTrainingProfile({ ...p, weakPoints: [...p.weakPoints, g] }); applyToPlanner({ kind: 'weakpoints', label: 'Слабая группа (ПЛ): ' + LIFT_RU[lift] + ' → ' + g, data: { groups: [g], lift } }); setSaved(true); setTimeout(() => setSaved(false), 2500); };

  const changeLift = (l: Lift) => { setLift(l); setWp(WEAK_POINTS_BY_LIFT[l][0]); };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🎯 Диагностика слабых точек (ПЛ)</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        Выберите движение и участок, где «зависает» вес — подберутся ассистентные упражнения и %ПМ. Ранее движок weakpoint-pl не использовался в UI.
      </div>

      <div style={CARD}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <PopupSelect label="Движение" value={lift} options={(Object.keys(LIFT_RU) as Lift[]).map(l => ({ id: l, label: LIFT_RU[l] }))} onChange={v => changeLift(v as Lift)} />
          <PopupSelect label="Слабая точка" value={wp} options={wps.map(w => ({ id: w, label: WP_RU[w] || w }))} onChange={v => setWp(v as WeakPoint)} />
        </div>

        <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 8, padding: 10, border: '1px solid rgba(239,68,68,0.2)', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>⚠ {diag.label}</div>
          <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{diag.description}</div>
        </div>

        <div style={H}>💪 Ассистентные упражнения</div>
        {diag.assistance.length === 0
          ? <div style={{ fontSize: 10, color: DIM }}>Нет данных.</div>
          : diag.assistance.map((a, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', marginBottom: 4, borderRadius: 6, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.15)' }}>
              <span style={{ fontSize: 11, color: '#fff' }}>{a}</span>
              <span style={{ fontSize: 10, color: ACCENT }}>≈ {Math.round(diag.intensityPct * 100)}% ПМ</span>
            </div>
          ))}

        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700, marginBottom: 2 }}>📋 Обоснование</div>
          <div style={{ fontSize: 10, color: DIM }}>{diag.rationale}</div>
        </div>

        <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>🔗 Сохранить слабое движение ({LIFT_TO_GROUP[lift]}) как отстающую группу в профиль — ПЛ/ББ/ручной планеры дадут ей приоритет (+MAV, ↓RIR).</div>
          <button onClick={saveFocus} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>{saved ? '✓ Фокус сохранён в профиль' : '💾 Сохранить фокус-группу в профиль'}</button>
        </div>
      </div>
    </div>
  );
};
