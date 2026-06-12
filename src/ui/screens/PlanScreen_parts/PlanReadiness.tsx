import React, { useState } from 'react';

export const PlanReadiness: React.FC<{
  goalState: string;
  level: string;
}> = ({ goalState, level }) => {
  const [sleepHours, setSleepHours] = useState(7.5);
  const [sleepQuality, setSleepQuality] = useState(7);
  const [nightAwakenings, setNightAwakenings] = useState(0);
  const [hrvRatio, setHrvRatio] = useState(1.0);
  const [doms, setDoms] = useState(3);
  const [stress, setStress] = useState(3);

  return (
    <div className="plan-readiness">
      <div className="card readiness-inputs">
        <h3>РџРѕРєР°Р·Р°С‚РµР»Рё РіРѕС‚РѕРІРЅРѕСЃС‚Рё</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label>РЎРѕРЅ: {sleepHours}С‡</label>
            <input type="range" min={0} max={12} step={0.5} value={sleepHours} onChange={(e) => setSleepHours(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>РљР°С‡РµСЃС‚РІРѕ: {sleepQuality}/10</label>
            <input type="range" min={1} max={10} value={sleepQuality} onChange={(e) => setSleepQuality(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Р‘РµСЃСЃРѕРЅРЅРёС†Р°: {nightAwakenings}</label>
            <input type="range" min={0} max={5} value={nightAwakenings} onChange={(e) => setNightAwakenings(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>HRV: {hrvRatio}</label>
            <input type="range" min={0.5} max={1.5} step={0.05} value={hrvRatio} onChange={(e) => setHrvRatio(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>DOMS: {doms}/10</label>
            <input type="range" min={0} max={10} value={doms} onChange={(e) => setDoms(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>РЎС‚СЂРµСЃСЃ: {stress}/10</label>
            <input type="range" min={0} max={10} value={stress} onChange={(e) => setStress(Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="card readiness-scores">
        <h3>РћС†РµРЅРєР° РіРѕС‚РѕРІРЅРѕСЃС‚Рё</h3>
        <div className="score-grid">
          <div className="score-item">
            <span className="label">Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ</span>
            <span className="value" style={{ color: sleepHours > 6 && sleepQuality > 6 ? 'var(--success)' : 'var(--danger)' }}>
              {sleepHours > 6 && sleepQuality > 6 ? '' : ''}
            </span>
          </div>
          <div className="score-item">
            <span className="label">РЈСЃС‚Р°Р»РѕСЃС‚СЊ</span>
            <span className="value" style={{ color: stress < 5 ? 'var(--success)' : 'var(--danger)' }}>
              {stress < 5 ? '' : ''}
            </span>
          </div>
          <div className="score-item">
            <span className="label">РЎРѕРЅ</span>
            <span className="value" style={{ color: sleepHours > 7 ? 'var(--success)' : 'var(--warning)' }}>
              {sleepHours > 7 ? '' : ''}
            </span>
          </div>
          <div className="score-item">
            <span className="label">HRV</span>
            <span className="value" style={{ color: hrvRatio > 0.9 ? 'var(--success)' : 'var(--warning)' }}>
              {hrvRatio > 0.9 ? '' : ''}
            </span>
          </div>
        </div>

        <div className="card volume-adjustment" style={{ marginTop: 12 }}>
          <h4>РљРѕСЂСЂРµРєС‚РёСЂРѕРІРєР° РѕР±СЉРµРјР°</h4>
          {sleepHours < 6 || sleepQuality < 5 ? (
            <div>РЎРЅРёР·РёС‚СЊ РѕР±СЉРµРј РЅР° 20% (РЅРµРґРѕСЃС‚Р°С‚РѕС‡РЅС‹Р№ СЃРѕРЅ)</div>
          ) : stress > 7 ? (
            <div>РЎРЅРёР·РёС‚СЊ РѕР±СЉРµРј РЅР° 10% (РІС‹СЃРѕРєРёР№ СЃС‚СЂРµСЃСЃ)</div>
          ) : (
            <div>РўСЂРµРЅРёСЂРѕРІР°С‚СЊСЃСЏ Р±РµР· РёР·РјРµРЅРµРЅРёР№</div>
          )}
        </div>
      </div>
    </div>
  );
};
