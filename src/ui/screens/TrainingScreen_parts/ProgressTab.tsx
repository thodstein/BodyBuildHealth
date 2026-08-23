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

  React.useEffect(() => {
    const m = loadMeasurements();
    setMeasurements(m);
    if (m.length > 0) {
      const last = m[m.length - 1];
      setMWeight(last.weightKg || 80);
      setMWaist(last.waistCm || 85);
      setMChest(last.chestCm || 100);
      setMArm(last.armLeftCm || last.armRightCm || 38);
      setMThigh(last.thighLeftCm || last.thighRightCm || 60);
    }
  }, []);
  const analytics = React.useMemo(() => analyzeMeasurements(175), [measurements]);

  const save = () => {
    const last = measurements.length > 0 ? measurements[measurements.length - 1] : null;
    const updated = saveMeasurement({
      date: mDate, weightKg: mWeight, waistCm: mWaist, chestCm: mChest,
      armLeftCm: mArm || last?.armLeftCm || 0, armRightCm: mArm || last?.armRightCm || 0,
      thighLeftCm: mThigh || last?.thighLeftCm || 0, thighRightCm: mThigh || last?.thighRightCm || 0,
      calfLeftCm: last?.calfLeftCm || 0, calfRightCm: last?.calfRightCm || 0,
      neckCm: last?.neckCm || 0, hipCm: last?.hipCm || 0, shoulderCm: last?.shoulderCm || 0,
      forearmLeftCm: last?.forearmLeftCm || 0, forearmRightCm: last?.forearmRightCm || 0,
      bodyFatPercent: last?.bodyFatPercent || 0, notes: '',
    });
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
        <div><label style={{ fontSize:10 }}>Вес</label><input type="number" value={mWeight} onChange={e=>setMWeight(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#fff',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:10 }}>Талия</label><input type="number" value={mWaist} onChange={e=>setMWaist(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#fff',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:10 }}>Грудь</label><input type="number" value={mChest} onChange={e=>setMChest(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#fff',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:10 }}>Бицепс</label><input type="number" value={mArm} onChange={e=>setMArm(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#fff',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:10 }}>Бедро</label><input type="number" value={mThigh} onChange={e=>setMThigh(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#fff',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:10 }}>Дата</label><input type="date" value={mDate || ''} onChange={e=>setMDate(e.target.value)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#fff',fontSize:11,boxSizing:'border-box' }} /></div>
      </div>
      <button onClick={save} style={{ width:'100%',marginTop:6,padding:8,borderRadius:6,border:'none',cursor:'pointer',background:'var(--accent)',color:'#000',fontWeight:600,fontSize:12 }}>Сохранить замер</button>
    </div>

    {measurements.length > 0 && <div className="card" style={{ marginBottom:8, padding:10 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📊 История ({measurements.length})</h4>
        {measurements.slice(-5).reverse().map((m:any,i)=><div key={i} style={{ fontSize:10,padding:'2px 0',borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
        {m.date}: Вес {m.weightKg}кг | Талия {m.waistCm}см | Грудь {m.chestCm}см | Бицепс {m.armLeftCm || m.armRightCm}см | Бедро {m.thighLeftCm || m.thighRightCm}см
      </div>)}
    </div>}

    {analytics && <div className="card" style={{ padding:10 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📈 Аналитика</h4>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2px 8px',fontSize:10 }}>
        <span>FFMI:</span><span style={{ fontWeight:600 }}>{analytics.ffmi?.toFixed(1)}</span>
        <span>LBM:</span><span style={{ fontWeight:600 }}>{analytics.lbm?.toFixed(1)} кг</span>
        <span>BMI:</span><span style={{ fontWeight:600 }}>{analytics.bmi?.toFixed(1)}</span>
        <span>Жир:</span><span style={{ fontWeight:600 }}>{analytics.fatMass?.toFixed(1)} кг</span>
      </div>
    </div>}

    {repData && <div className="card" style={{ padding:10, marginTop:8 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📋 Недельный отчёт</h4>
      <div style={{ fontSize:10,color:'#fff' }}>{repData.insights?.slice(0,3).map((r:any,i:number)=><div key={i}>• {r}</div>)}</div>
    </div>}

    {/* Графики прогресса из дневника: ПМ (e1RM) по топ-упражнениям и тоннаж по неделям */}
    {historyWorkouts.length > 0 && (() => {
      // e1RM по упражнению по датам
      const byEx: Record<string, { date: string; e1rm: number }[]> = {};
      historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
        const best = (e.sets || []).reduce((m: number, s: any) => Math.max(m, s.weight * (1 + (s.reps || 0) / 30)), 0);
        if (best <= 0) return;
        const name = e.exerciseName || e.exerciseId || '—';
        (byEx[name] = byEx[name] || []).push({ date: w.date, e1rm: Math.round(best) });
      }));
      const top = Object.entries(byEx).map(([n, arr]) => ({ n, arr: arr.sort((a, b) => a.date.localeCompare(b.date)) }))
        .sort((a, b) => b.arr.length - a.arr.length).slice(0, 3).filter(x => x.arr.length >= 2);
      // тоннаж по неделям
      const wkMap: Record<string, number> = {};
      historyWorkouts.forEach((w: any) => { const wn = w.date.slice(0, 10).slice(0, 7) + '-' + Math.floor(new Date(w.date).getDate() / 7); const vol = (w.exercises || []).reduce((s: number, e: any) => s + (e.totalVolume || (e.sets || []).reduce((ss: number, st: any) => ss + (st.weight || 0) * (st.reps || 0), 0)), 0); wkMap[wn] = (wkMap[wn] || 0) + vol; });
      const wkArr = Object.entries(wkMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
      const renderLine = (series: { date: string; e1rm: number }[], color: string, x0: number, allMin: number, allMax: number, W: number, H: number) => {
        if (series.length < 2) return null;
        const px = (i: number) => 6 + (i / Math.max(1, series.length - 1)) * (W - 12);
        const py = (v: number) => H - 8 - ((v - allMin) / Math.max(1, allMax - allMin)) * (H - 16);
        return <polyline points={series.map((p, i) => `${px(i)},${py(p.e1rm)}`).join(' ')} fill="none" stroke={color} strokeWidth={1.6} />;
      };
      const colors = ['#00e68a', '#60a5fa', '#a855f7'];
      const W = 320, H = 70;
      const allVals = top.flatMap(t => t.arr.map(a => a.e1rm));
      const minV = Math.min(...allVals, 0), maxV = Math.max(...allVals, 1);
      const maxWk = Math.max(1, ...wkArr.map(([, v]) => v));
      return <div className="card" style={{ padding: 10, marginTop: 8 }}>
        <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>📈 Прогресс из дневника</h4>
        {top.length === 0 ? <div style={{ fontSize: 10, color: '#fff' }}>Недостаточно данных (нужно ≥2 тренировок на упражнение с весами).</div> : <>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>ПМ (e1RM) по топ-упражнениям:</div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 360, margin: '0 auto', display: 'block' }}>
            {top.map((t, i) => renderLine(t.arr, colors[i % colors.length], 0, minV, maxV, W, H))}
            {top.flatMap((t, i) => t.arr.map((p, j) => <circle key={t.n + j} cx={6 + (j / Math.max(1, t.arr.length - 1)) * (W - 12)} cy={H - 8 - ((p.e1rm - minV) / Math.max(1, maxV - minV)) * (H - 16)} r={2} fill={colors[i % colors.length]} />))}
          </svg>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 4 }}>{top.map((t, i) => <span key={t.n} style={{ fontSize: 10, color: colors[i % colors.length] }}>● {t.n.slice(0, 18)}</span>)}</div>
        </>}
        {wkArr.length >= 2 && <>
          <div style={{ fontSize: 10, color: '#fff', marginTop: 8, marginBottom: 4 }}>Тоннаж по неделям:</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
            {wkArr.map(([wk, v], i) => <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}><div style={{ width: '100%', maxWidth: 28, height: Math.max(2, (v / maxWk) * 48), borderRadius: 3, background: 'linear-gradient(180deg,#00e68a,#00c853)' }} /><span style={{ fontSize: 10, color: '#fff' }}>{wk.slice(5)}</span></div>)}
          </div>
        </>}
      </div>;
    })()}
  </div>);
};
