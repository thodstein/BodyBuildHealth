/** StrengthAnalyticsCard.tsx — аналитика силы (ранее неиспользуемые движки).
 * REUSE performance-analytics.engine: getStrengthPercentile, calculateRatios,
 * analyzeRatios, getStrengthLevel, getAllVolumeLandmarks, checkVolumeStatus,
 * trainingAgeLevel, projectedTimeline. ПМ берутся из профиля тренированности. */
import React, { useState, useMemo } from 'react';
import {
  getStrengthPercentile, getStrengthLevel, calculateRatios, analyzeRatios,
  getAllVolumeLandmarks, checkVolumeStatus, trainingAgeLevel, projectedTimeline,
} from '../../../engines/performance-analytics.engine';
import { loadTrainingProfile, saveTrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };
const LABEL: React.CSSProperties = { fontSize: 10, color: DIM, margin: '6px 0 3px', fontWeight: 700 };

const EXS = [
  { id: 'squat', label: 'Присед' },
  { id: 'bench', label: 'Жим лёжа' },
  { id: 'deadlift', label: 'Становая' },
  { id: 'overhead_press', label: 'Жим стоя' },
];

export const StrengthAnalyticsCard: React.FC = () => {
  const prof = useMemo(() => loadTrainingProfile(), []);
  const [squat, setSquat] = useState<number>(prof.pmSquat || 100);
  const [bench, setBench] = useState<number>(prof.pmBench || 70);
  const [dead, setDead] = useState<number>(prof.pmDead || 130);
  const [ohp, setOhp] = useState<number>(Math.round((prof.workMax.shoulders || 50) * 1.3) || 40);
  const [bw, setBw] = useState<number>(prof.bodyWeight || 80);
  const [years, setYears] = useState<number>(2);
  const [weeklyVol, setWeeklyVol] = useState<number>(12);
  const [saved, setSaved] = useState(false);
  const savePM = () => { saveTrainingProfile({ ...loadTrainingProfile(), pmSquat: squat, pmBench: bench, pmDead: dead, bodyWeight: bw }); applyToPlanner({ kind: 'pm', label: 'ПМ: присед ' + squat + ' / жим ' + bench + ' / тяга ' + dead + ' кг', data: { squat, bench, dead } }); setSaved(true); setTimeout(() => setSaved(false), 2500); };

  const pcts = useMemo(() => ({
    squat: getStrengthPercentile('squat', bw, squat),
    bench: getStrengthPercentile('bench', bw, bench),
    deadlift: getStrengthPercentile('deadlift', bw, dead),
    overhead_press: getStrengthPercentile('overhead_press', bw, ohp),
  }), [squat, bench, dead, ohp, bw]);

  const levels = useMemo(() => ({
    squat: getStrengthLevel('squat', bw, squat),
    bench: getStrengthLevel('bench', bw, bench),
    deadlift: getStrengthLevel('deadlift', bw, dead),
  }), [squat, bench, dead, bw]);

  const ratios = useMemo(() => calculateRatios(squat, bench, dead, ohp), [squat, bench, dead, ohp]);
  const issues = useMemo(() => analyzeRatios(ratios), [ratios]);
  const landmarks = useMemo(() => getAllVolumeLandmarks(prof.level || 'intermediate'), [prof.level]);
  const age = useMemo(() => trainingAgeLevel(years), [years]);

  const target1RM = Math.round(squat * 1.1);
  const weeks = projectedTimeline(squat, target1RM, age.expectedWeeklyGain);

  const LEVEL_RU: Record<string, string> = { untrained: 'Нетренир.', novice: 'Новичок', intermediate: 'Средний', advanced: 'Продвинутый', elite: 'Элита', world_class: 'Мировой' };
  const Row = ({ label, pct, level }: { label: string; pct: number; level?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 11, color: '#fff', width: 90 }}>{label}</span>
      <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: Math.min(100, pct) + '%', height: '100%', background: pct >= 70 ? '#00e68a' : pct >= 40 ? '#eab308' : '#ef4444', borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 70 ? '#00e68a' : pct >= 40 ? '#eab308' : '#ef4444', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
      {level && <span style={{ fontSize: 10, color: DIM, minWidth: 70 }}>{LEVEL_RU[level] || level}</span>}
    </div>
  );

  const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>💪 Аналитика силы</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        Процентиль силы, уровень, соотношения присед/жим/тяга, дисбалансы и объёмные ориентиры (MEV/MAV/MRV). ПМ — из профиля.
      </div>

      <div style={CARD}>
        <div style={H}>⚙️ Ввод</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div><div style={LABEL}>Присед, кг</div><input type="number" style={IN} value={squat} onChange={e => setSquat(parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Жим, кг</div><input type="number" style={IN} value={bench} onChange={e => setBench(parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Тяга, кг</div><input type="number" style={IN} value={dead} onChange={e => setDead(parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Жим стоя, кг</div><input type="number" style={IN} value={ohp} onChange={e => setOhp(parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Вес тела, кг</div><input type="number" style={IN} value={bw} onChange={e => setBw(parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Стаж, лет</div><input type="number" style={IN} value={years} onChange={e => setYears(parseFloat(e.target.value) || 0)} /></div>
        </div>
      </div>

      <div style={CARD}>
        <div style={H}>📊 Процентиль силы (по весу тела)</div>
        <Row label="Присед" pct={pcts.squat} level={levels.squat} />
        <Row label="Жим лёжа" pct={pcts.bench} level={levels.bench} />
        <Row label="Тяга" pct={pcts.deadlift} level={levels.deadlift} />
        <Row label="Жим стоя" pct={pcts.overhead_press} />
      </div>

      <div style={CARD}>
        <div style={H}>⚖️ Соотношения</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><span style={{ color: DIM, fontSize: 10 }}>Присед/Тяга</span><div style={{ fontWeight: 700 }}>{ratios.squatToDeadlift}%</div></div>
          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><span style={{ color: DIM, fontSize: 10 }}>Жим/Присед</span><div style={{ fontWeight: 700 }}>{ratios.benchToSquat}%</div></div>
          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><span style={{ color: DIM, fontSize: 10 }}>Жим стоя/Жим</span><div style={{ fontWeight: 700 }}>{ratios.overheadToBench || 0}%</div></div>
          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}><span style={{ color: DIM, fontSize: 10 }}>Push/Pull</span><div style={{ fontWeight: 700 }}>{ratios.pushPullRatio}%</div></div>
        </div>
        {issues.length === 0
          ? <div style={{ fontSize: 10, color: '#22c55e', marginTop: 8 }}>✓ Дисбалансов не обнаружено — пропорции в норме.</div>
          : <div style={{ marginTop: 8 }}>
              {issues.map((iss, i) => (
                <div key={i} style={{ fontSize: 10, padding: '6px 8px', marginBottom: 4, borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ color: '#ef4444', fontWeight: 700 }}>⚠ {iss.issue}</div>
                  <div style={{ color: DIM }}>{iss.recommendation}</div>
                </div>
              ))}
            </div>}
      </div>

      <div style={CARD}>
        <div style={H}>📈 Прогноз и стаж</div>
        <div style={{ fontSize: 11, color: '#fff', marginBottom: 6 }}>
          Уровень стажа: <b>{LEVEL_RU[age.level] || age.level}</b> · ожидаемый прирост <b>{age.expectedWeeklyGain} кг/нед</b>
        </div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>
          Прогноз: +10% к приседу ({target1RM} кг) ≈ <b style={{ color: ACCENT }}>{weeks} нед</b> при текущем темпе.
        </div>
      </div>

      <div style={CARD}>
        <div style={H}>📐 Объёмные ориентиры (MEV/MAV/MRV)</div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Уровень: {LEVEL_RU[prof.level || 'intermediate'] || prof.level}. Статус для текущего объёма:</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <input type="number" style={{ ...IN, width: 120 }} value={weeklyVol} onChange={e => setWeeklyVol(parseFloat(e.target.value) || 0)} aria-label="объём подходов/нед" />
          <span style={{ fontSize: 10, color: DIM, alignSelf: 'center' }}>подходов/нед (по грудь)</span>
        </div>
        {landmarks.slice(0, 6).map(l => {
          const chest = l.muscle === 'chest' ? checkVolumeStatus(weeklyVol, l) : null;
          return (
            <div key={l.muscle} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10 }}>
              <span style={{ color: '#fff', textTransform: 'capitalize' }}>{l.muscle}</span>
              <span style={{ color: DIM }}>MEV {l.mev}</span>
              <span style={{ color: DIM }}>MAV {l.mav}</span>
              <span style={{ color: DIM }}>MRV {l.mrv}</span>
              {chest && <span style={{ color: chest === 'optimal' ? '#22c55e' : chest === 'below_mev' ? '#3b82f6' : '#ef4444', gridColumn: '1 / -1' }}>Грудь: {chest === 'optimal' ? 'оптимально' : chest === 'below_mev' ? 'ниже MEV' : 'близко к MRV'}</span>}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 6, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>🔗 ПМ из этого расчёта используются ПЛ-планировщиком. Сохраните текущие значения в профиль — ПЛ-планер пересчитает веса автоматически.</div>
        <button onClick={savePM} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>{saved ? '✓ ПМ сохранены в профиль' : '💾 Сохранить ПМ в профиль'}</button>
      </div>
    </div>
  );
};
