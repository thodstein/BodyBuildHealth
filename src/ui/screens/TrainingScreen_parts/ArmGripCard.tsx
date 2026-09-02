/**
 * ArmGripCard.tsx — карточка хвата (Rolling Thunder / Axle / Pinch).
 */
import React, { useState } from 'react';
import { diagnoseArmWeakPoint } from '../../../engines/arm/arm-weakpoint.engine';
import { gripVolumeFor } from '../../../engines/arm/arm-grip.engine';

export function ArmGripCard({ onApplyWeak }: { onApplyWeak?: (weak: string[]) => void }) {
  const [rt, setRt] = useState<string>('');
  const [axle, setAxle] = useState<string>('');
  const [pinch, setPinch] = useState<string>('');
  const [side, setSide] = useState<string>('');
  const [back, setBack] = useState<string>('');

  const rtKg = parseFloat(rt);
  const axleKg = parseFloat(axle);
  const pinchSec = parseFloat(pinch);
  const sideKg = parseFloat(side);
  const backKg = parseFloat(back);

  const diag = diagnoseArmWeakPoint({
    weakTest: {
      gripSupportMaxKg: Number.isFinite(rtKg) ? rtKg : undefined,
      gripAxleMaxKg: Number.isFinite(axleKg) ? axleKg : undefined,
      pinchHoldSec: Number.isFinite(pinchSec) ? pinchSec : undefined,
      sidePressureFails: Number.isFinite(sideKg) ? sideKg < 30 : undefined,
      backPressureFails: Number.isFinite(backKg) ? backKg < 40 : undefined,
    },
  });

  const volRT = gripVolumeFor('rolling_thunder', 'intermediate');
  const volAxle = gripVolumeFor('apollon_axle', 'intermediate');

  const apply = () => { if (onApplyWeak) onApplyWeak(diag.weakMuscles.slice(0,2)); };

  return (
    <div style={{ border: '1px solid #1f3a5f', borderRadius: 12, padding: 12, background: '#0f1e35' }}>
      <h3 style={{ margin: '0 0 8px', color: '#fff' }}>✊ Хват — диагностика</h3>
      <p style={{ color: '#9ab', fontSize: 13, margin: '0 0 8px' }}>Введи максимумы — увидишь слабые зоны хвата.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <label style={{ color: '#fff', fontSize: 12 }}>Rolling Thunder (кг)<input value={rt} onChange={e=>setRt(e.target.value)} placeholder="60" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px' }} /></label>
        <label style={{ color: '#fff', fontSize: 12 }}>Apollon Axle (кг)<input value={axle} onChange={e=>setAxle(e.target.value)} placeholder="100" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px' }} /></label>
        <label style={{ color: '#fff', fontSize: 12 }}>Pinch hold (с)<input value={pinch} onChange={e=>setPinch(e.target.value)} placeholder="15" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px' }} /></label>
        <label style={{ color: '#fff', fontSize: 12 }}>Side кг (блок)<input value={side} onChange={e=>setSide(e.target.value)} placeholder="30" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px' }} /></label>
        <label style={{ color: '#fff', fontSize: 12 }}>Back кг (тяга)<input value={back} onChange={e=>setBack(e.target.value)} placeholder="50" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px' }} /></label>
      </div>
      <div style={{ color: '#6a8a9a', fontSize: 12, marginBottom: 8 }}>Рекоменд объём: RT {volRT.sets}×{volRT.reps} · Axle {volAxle.sets}×{volAxle.reps} · Pinch/Side/Back — см. PRO-гейты (4 слоя)</div>
      {diag.priorities.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {diag.priorities.map((p,i)=> (
            <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f' }}>
              <b style={{ color: '#fff' }}>{p.muscle}</b> — <span style={{ color: '#9ab' }}>{p.reason}</span>
            </div>
          ))}
          <button onClick={apply} style={{ marginTop: 6, background: '#00e68a', color: '#001', border: 0, borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}>➕ В слабые зоны</button>
        </div>
      ) : <div style={{ color: '#6a8a9a', fontSize: 13 }}>Введи данные для диагностики.</div>}
    </div>
  );
}
