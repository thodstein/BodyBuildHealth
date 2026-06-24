import React from 'react';
import { getStrengthLevel, getNextLevelTarget } from '../../../engines/performance-analytics.engine';

export const StrengthLevelCard: React.FC = () => {
  const [slEx, setSlEx] = React.useState('squat');
  const [slWt, setSlWt] = React.useState(80);
  const [sl1RM, setSl1RM] = React.useState(140);
  const level = getStrengthLevel(slEx, slWt, sl1RM) as string;
  const next = getNextLevelTarget(slEx, slWt, level as any);
  return (<div className="card" style={{ marginTop:8, padding:10 }}>
    <h4 style={{ margin:'0 0 6px',fontSize:12 }}>📊 Уровень силы</h4>
    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:4 }}>
      <div><label style={{ fontSize:9 }}>Упражнение</label><select value={slEx || ''} onChange={e=>setSlEx(e.target.value)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11 }}><option value="squat">Присед</option><option value="bench">Жим</option><option value="deadlift">Тяга</option></select></div>
      <div><label style={{ fontSize:9 }}>Вес тела (кг)</label><input type="number" value={slWt} onChange={e=>setSlWt(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
      <div><label style={{ fontSize:9 }}>1RM (кг)</label><input type="number" value={sl1RM} onChange={e=>setSl1RM(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
    </div>
    <div style={{ marginTop:6,fontSize:10 }}>Уровень: <b style={{ color:'var(--accent)' }}>{level}</b> | До следующего: <b style={{ color:'#8b5cf6' }}>{next} кг</b></div>
  </div>);
};
