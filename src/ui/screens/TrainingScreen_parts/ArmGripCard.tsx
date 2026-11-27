/**
 * ArmGripCard.tsx — карточка хвата (Rolling Thunder / Pinch / Side / Back).
 * Редизайн на arm-design-system; логика и строки 1-в-1.
 */
import React, { useEffect, useState } from 'react';
import { diagnoseArmWeakPoint } from '../../../engines/arm/arm-weakpoint.engine';
import { gripVolumeFor } from '../../../engines/arm/arm-grip.engine';
import { AdCard, AdGrid, AdField, AdBtn, AdSec } from './arm-design-system';

/** Аудит 2026-11: карточка размонтируется при уходе с шага (ArmAutoConstructor — чужая зона),
 *  поэтому ввод переживает ремаунт через localStorage. Пустой ввод не затирает сохранённое. */
const GRIP_KEY = 'he_arm_grip_card_v1';
type GripValues = { rt: string; pinch: string; side: string; back: string };
const EMPTY_GRIP: GripValues = { rt: '', pinch: '', side: '', back: '' };
function loadGripValues(): GripValues {
  try {
    if (typeof localStorage === 'undefined') return EMPTY_GRIP;
    const j = JSON.parse(localStorage.getItem(GRIP_KEY) || '{}');
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    return { rt: str(j?.rt), pinch: str(j?.pinch), side: str(j?.side), back: str(j?.back) };
  } catch { return EMPTY_GRIP; }
}

export function ArmGripCard({ onApplyWeak }: { onApplyWeak?: (weak: string[]) => void }) {
  const [vals, setVals] = useState<GripValues>(loadGripValues);
  const { rt, pinch, side, back } = vals;
  const setField = (k: keyof GripValues) => (e: React.ChangeEvent<HTMLInputElement>) => setVals((v) => ({ ...v, [k]: e.target.value }));

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (typeof localStorage === 'undefined') return;
        const prevRaw = localStorage.getItem(GRIP_KEY);
        const prev = prevRaw ? JSON.parse(prevRaw) : {};
        const next: Record<string, string> = prev && typeof prev === 'object' ? { ...prev } : {};
        // было→стало: пустая строка не стирает уже сохранённый замер.
        for (const k of ['rt', 'pinch', 'side', 'back'] as const) {
          if (vals[k].trim() !== '') next[k] = vals[k];
        }
        if (Object.keys(next).length > 0) localStorage.setItem(GRIP_KEY, JSON.stringify(next));
      } catch { /* noop */ }
    }, 400);
    return () => clearTimeout(t);
  }, [vals.rt, vals.pinch, vals.side, vals.back]);

  const rtKg = parseFloat(rt);
  const pinchSec = parseFloat(pinch);
  const sideKg = parseFloat(side);
  const backKg = parseFloat(back);

  const diag = diagnoseArmWeakPoint({
    weakTest: {
      gripSupportMaxKg: Number.isFinite(rtKg) ? rtKg : undefined,
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
        <p className="ad-muted">Введи максимумы — увидишь слабые зоны хвата. Support (RT) · pinch · crush — объёмы и PRO-гейты подтянутся сами.</p>
        <AdGrid cols="auto-sm">
          <AdField label="Rolling Thunder (кг)">
            <input value={rt} onChange={setField('rt')} placeholder="60" inputMode="decimal" />
          </AdField>
          <AdField label="Pinch hold (с)">
            <input value={pinch} onChange={setField('pinch')} placeholder="15" inputMode="decimal" />
          </AdField>
          <AdField label="Side кг (блок)">
            <input value={side} onChange={setField('side')} placeholder="30" inputMode="decimal" />
          </AdField>
          <AdField label="Back кг (тяга)">
            <input value={back} onChange={setField('back')} placeholder="50" inputMode="decimal" />
          </AdField>
        </AdGrid>
        <p className="ad-muted">Рекоменд объём: RT {volRT.sets}×{volRT.reps} · Axle {volAxle.sets}×{volAxle.reps} · Pinch/Side/Back — см. PRO-гейты (4 слоя)</p>
        {diag.priorities.length > 0 ? (
          <AdSec title="🎯 Найденные зоны" collapsible summary={`${diag.priorities.length} зон`}>
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
            <AdBtn variant="primary" block onClick={apply}>➕ В слабые зоны</AdBtn>
          </div>
          </AdSec>
        ) : <div className="ad-muted">Введи данные для диагностики.</div>}
      </AdCard>
    </div>
  );
}
