import React from 'react';
import type { WorkoutLog } from '../../../core/types';
import { generateWeeklyReport, analyzeMeasurements, loadMeasurements, saveMeasurement, type BodyMeasurement } from '../../../engines/log-analytics-progression.engine';

export const ProgressTab: React.FC<{ historyWorkouts: WorkoutLog[] }> = ({ historyWorkouts }) => {
  const [measurements, setMeasurements] = React.useState<BodyMeasurement[]>([]);
  const [repData, setRepData] = React.useState<any>(null);
  const [mWeight, setMWeight] = React.useState(80);
  const [mWaist, setMWaist] = React.useState(85);
  const [mChest, setMChest] = React.useState(100);
  const [mArm, setMArm] = React.useState(38);
  const [mThigh, setMThigh] = React.useState(60);
  const [mDate, setMDate] = React.useState(new Date().toISOString().split('T')[0]);

  React.useEffect(() => { setMeasurements(loadMeasurements()); }, []);
  const analytics = React.useMemo(() => analyzeMeasurements(175), [measurements]);

  const save = () => {
    const updated = saveMeasurement({ date: mDate, weightKg: mWeight, waistCm: mWaist, chestCm: mChest, armCm: mArm, thighCm: mThigh, calfCm: 38, neckCm: 38, hipCm: 95, shoulderCm: 120, forearmCm: 32, wristCm: 18, ankleCm: 22, bodyFatPercent: 15 } as any);
    setMeasurements(updated);
  };

  React.useEffect(() => {
    if (historyWorkouts.length > 0) {
      const logs: any[] = [];
      historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
        (e.sets || []).forEach((s: any) => logs.push({ date: w.date, exercise: e.exerciseName || e.exerciseId, weight: s.weight, reps: s.reps, rpe: 7 }));
      }));
      if (logs.length > 0) setRepData(generateWeeklyReport(logs, logs.map((l: any) => ({ date: l.date, durationMin: 60 }))));
    }
  }, [historyWorkouts]);

  return (<div>
    <div className="card" style={{ marginBottom:8, padding:10 }}>
      <h4 style={{ margin:'0 0 6px',fontSize:12 }}>📏 Замеры тела</h4>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
        <div><label style={{ fontSize:9 }}>Вес</label><input type="number" value={mWeight} onChange={e=>setMWeight(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Талия</label><input type="number" value={mWaist} onChange={e=>setMWaist(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Грудь</label><input type="number" value={mChest} onChange={e=>setMChest(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Бицепс</label><input type="number" value={mArm} onChange={e=>setMArm(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Бедро</label><input type="number" value={mThigh} onChange={e=>setMThigh(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Дата</label><input type="date" value={mDate || ''} onChange={e=>setMDate(e.target.value)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
      </div>
      <button onClick={save} style={{ width:'100%',marginTop:6,padding:8,borderRadius:6,border:'none',cursor:'pointer',background:'var(--accent)',color:'#000',fontWeight:600,fontSize:12 }}>Сохранить замер</button>
    </div>

    {measurements.length > 0 && <div className="card" style={{ marginBottom:8, padding:10 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📊 История ({measurements.length})</h4>
        {measurements.slice(-5).reverse().map((m:any,i)=><div key={i} style={{ fontSize:9,padding:'2px 0',borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
        {m.date}: Вес {m.weightKg}кг | Талия {m.waistCm}см | Грудь {m.chestCm}см | Бицепс {m.armCm}см | Бедро {m.thighCm}см
      </div>)}
    </div>}

    {analytics && <div className="card" style={{ padding:10 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📈 Аналитика</h4>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2px 8px',fontSize:10 }}>
        <span>FFMI:</span><span style={{ fontWeight:600 }}>{analytics.ffmi?.toFixed(1)}</span>
        <span>LBM:</span><span style={{ fontWeight:600 }}>{analytics.lbm?.toFixed(1)} кг</span>
        <span>BMI:</span><span style={{ fontWeight:600 }}>{analytics.bmi?.toFixed(1)}</span>
        <span>Fat:</span><span style={{ fontWeight:600 }}>{analytics.fatMass?.toFixed(1)} кг</span>
      </div>
    </div>}

    {repData && <div className="card" style={{ padding:10, marginTop:8 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📋 Недельный отчёт</h4>
      <div style={{ fontSize:9,color:'var(--text-light)' }}>{repData.insights?.slice(0,3).map((r:any,i:number)=><div key={i}>• {r}</div>)}</div>
    </div>}
  </div>);
};
