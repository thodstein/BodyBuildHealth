/**
 * ArmGripCard.tsx — карточка хвата (Rolling Thunder / Axle / Pinch).
 * Редизайн на arm-design-system; логика и строки 1-в-1.
 */
import React, { useState } from 'react';
import { diagnoseArmWeakPoint } from '../../../engines/arm/arm-weakpoint.engine';
import { gripVolumeFor } from '../../../engines/arm/arm-grip.engine';
import { AdCard, AdGrid, AdField, AdBtn } from './arm-design-system';

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
    <div className="train-armgrip" data-arm="grip-card">
      <AdCard>
        <div className="ad-sec-t">✊ Хват — диагностика</div>
        <p className="ad-muted">Введи максимумы — увидишь слабые зоны хвата. Support (RT/Axle) · pinch · crush — объёмы и PRO-гейты подтянутся сами.</p>
        <AdGrid cols="auto-sm">
          <AdField label="Rolling Thunder (кг)">
            <input value={rt} onChange={e=>setRt(e.target.value)} placeholder="60" inputMode="decimal" />
          </AdField>
          <AdField label="Apollon Axle (кг)">
            <input value={axle} onChange={e=>setAxle(e.target.value)} placeholder="100" inputMode="decimal" />
          </AdField>
          <AdField label="Pinch hold (с)">
            <input value={pinch} onChange={e=>setPinch(e.target.value)} placeholder="15" inputMode="decimal" />
          </AdField>
          <AdField label="Side кг (блок)">
            <input value={side} onChange={e=>setSide(e.target.value)} placeholder="30" inputMode="decimal" />
          </AdField>
          <AdField label="Back кг (тяга)">
            <input value={back} onChange={e=>setBack(e.target.value)} placeholder="50" inputMode="decimal" />
          </AdField>
        </AdGrid>
        <p className="ad-muted">Рекоменд объём: RT {volRT.sets}×{volRT.reps} · Axle {volAxle.sets}×{volAxle.reps} · Pinch/Side/Back — см. PRO-гейты (4 слоя)</p>
        {diag.priorities.length > 0 ? (
          <div className="ad-list" data-arm="grip-results">
            {diag.priorities.map((p,i)=> (
              <div key={i} className="ad-sec ad-bio" data-valid="warn" data-arm="grip-result">
                <div className="ad-row">
                  <span><b>{p.muscle}</b></span>
                  <span className="ad-tag ad-angle">приоритет {i + 1}</span>
                </div>
                <div className="ad-muted">— {p.reason}</div>
              </div>
            ))}
            <AdBtn variant="primary" onClick={apply}>➕ В слабые зоны</AdBtn>
          </div>
        ) : <div className="ad-muted">Введи данные для диагностики.</div>}
      </AdCard>
    </div>
  );
}
