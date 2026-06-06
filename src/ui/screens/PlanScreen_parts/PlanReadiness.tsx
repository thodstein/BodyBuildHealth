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
        <h3>Показатели готовности</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label>Сон: {sleepHours}ч</label>
            <input type="range" min={0} max={12} step={0.5} value={sleepHours} onChange={(e) => setSleepHours(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Качество: {sleepQuality}/10</label>
            <input type="range" min={1} max={10} value={sleepQuality} onChange={(e) => setSleepQuality(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Бессонница: {nightAwakenings}</label>
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
            <label>Стресс: {stress}/10</label>
            <input type="range" min={0} max={10} value={stress} onChange={(e) => setStress(Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="card readiness-scores">
        <h3>Оценка готовности</h3>
        <div className="score-grid">
          <div className="score-item">
            <span className="label">Восстановление</span>
            <span className="value" style={{ color: sleepHours > 6 && sleepQuality > 6 ? 'var(--success)' : 'var(--danger)' }}>
              {sleepHours > 6 && sleepQuality > 6 ? 'ОК' : 'Недостаточно'}
            </span>
          </div>
          <div className="score-item">
            <span className="label">Усталость</span>
            <span className="value" style={{ color: stress < 5 ? 'var(--success)' : 'var(--danger)' }}>
              {stress < 5 ? 'Низкая' : 'Высокая'}
            </span>
          </div>
          <div className="score-item">
            <span className="label">Сон</span>
            <span className="value" style={{ color: sleepHours > 7 ? 'var(--success)' : 'var(--warning)' }}>
              {sleepHours > 7 ? 'Хороший' : 'Недостаточный'}
            </span>
          </div>
          <div className="score-item">
            <span className="label">HRV</span>
            <span className="value" style={{ color: hrvRatio > 0.9 ? 'var(--success)' : 'var(--warning)' }}>
              {hrvRatio > 0.9 ? 'Хорошая' : 'Пониженная'}
            </span>
          </div>
        </div>

        <div className="card volume-adjustment" style={{ marginTop: 12 }}>
          <h4>Корректировка объема</h4>
          {sleepHours < 6 || sleepQuality < 5 ? (
            <div>Снизить объем на 20% (недостаточный сон)</div>
          ) : stress > 7 ? (
            <div>Снизить объем на 10% (высокий стресс)</div>
          ) : (
            <div>Тренироваться без изменений</div>
          )}
        </div>
      </div>
    </div>
  );
};
