import React from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { calcExercisePrescription } from '../../../engines/training.engine';

const EX_GEN_GROUP_LABELS: Record<string, string> = {
  chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор',
};
const EX_GEN_GOALS = ['bulk','strength','cut','maintenance','recomp'];
const EX_GEN_GOAL_LABELS: Record<string, string> = {
  bulk:'Масса', strength:'Сила', cut:'Сушка', maintenance:'Поддержание', recomp:'Рекомп',
};
const EX_GEN_LEVELS = ['beginner','intermediate','advanced','enhanced'];
const EX_GEN_LEVEL_LABELS: Record<string, string> = {
  beginner:'Новичок', intermediate:'Средний', advanced:'Опытный', enhanced:'Enhanced',
};

export const ExerciseGeneratorContent: React.FC = () => {
  const [genGroup, setGenGroup] = React.useState('chest');
  const [genGoal, setGenGoal] = React.useState('bulk');
  const [genLevel, setGenLevel] = React.useState('intermediate');
  const [genCount, setGenCount] = React.useState(5);
  const [genResult, setGenResult] = React.useState<{ name: string; group: string; type: string; equipment: string; sets: number; reps: string; rir: number; rest: number }[] | null>(null);

  const generate = () => {
    const exs = EXERCISE_CATALOG.filter(e => e.group === genGroup).slice(0, genCount * 2);
    const scored = exs.map((ex: any) => {
      const p = calcExercisePrescription(ex, genGoal, genLevel, false, false, 1);
      let score = 0;
      if (ex.type === 'compound') score += 10;
      if (ex.type === 'isolation') score += 3;
      return { ex, p, score };
    });
    scored.sort((a: any, b: any) => b.score - a.score);
    setGenResult(scored.slice(0, genCount).map((s: any) => ({
      name: s.ex.name, group: s.ex.group, type: s.ex.type,
      equipment: s.ex.equipment || '—', sets: s.p.sets, reps: s.p.reps,
      rir: s.p.rir, rest: s.p.rest,
    })));
  };

  React.useEffect(() => { generate(); }, [genGroup, genGoal, genLevel, genCount]);

  return (<>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
      <div>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Группа мышц</div>
        <select value={genGroup} onChange={e => setGenGroup(e.target.value)}
          style={{ width:'100%', padding:'5px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11 }}>
          {['chest','back','legs','shoulders','arms','core'].map(g => (
            <option key={g} value={g}>{EX_GEN_GROUP_LABELS[g]}</option>
          ))}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Цель</div>
        <select value={genGoal} onChange={e => setGenGoal(e.target.value)}
          style={{ width:'100%', padding:'5px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11 }}>
          {EX_GEN_GOALS.map(g => <option key={g} value={g}>{EX_GEN_GOAL_LABELS[g]}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Уровень</div>
        <select value={genLevel} onChange={e => setGenLevel(e.target.value)}
          style={{ width:'100%', padding:'5px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11 }}>
          {EX_GEN_LEVELS.map(l => <option key={l} value={l}>{EX_GEN_LEVEL_LABELS[l]}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>Кол-во</div>
        <select value={genCount} onChange={e => setGenCount(parseInt(e.target.value))}
          style={{ width:'100%', padding:'5px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11 }}>
          {[3,5,8,10].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>

    {genResult && genResult.length > 0 ? (
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 6px', borderRadius:4, marginBottom:4, fontSize:10, color:'#fff', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ flex:1 }}>Упражнение</span>
          <span style={{ width:30, textAlign:'center' }}>Тип</span>
          <span style={{ width:30, textAlign:'center' }}>Инв.</span>
          <span style={{ width:45, textAlign:'center' }}>Сеты</span>
          <span style={{ width:50, textAlign:'center' }}>Повторы</span>
          <span style={{ width:28, textAlign:'center' }}>RIR</span>
          <span style={{ width:35, textAlign:'center' }}>Отдых</span>
        </div>
        {genResult.map((r, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 6px', borderRadius:4, marginBottom:2, background:'rgba(255,255,255,0.02)', fontSize:10 }}>
            <span style={{ flex:1, fontWeight:600 }}>{r.name}</span>
            <span style={{ width:30, textAlign:'center', fontSize:10, color:'#fff' }}>{r.type === 'compound' ? 'Базовое' : 'Изол.'}</span>
            <span style={{ width:30, textAlign:'center', fontSize:10, color:'#fff' }}>{r.equipment}</span>
            <span style={{ width:45, textAlign:'center', color:'var(--accent)', fontWeight:700 }}>{r.sets}</span>
            <span style={{ width:50, textAlign:'center', color:'var(--accent)', fontWeight:600 }}>{r.reps}</span>
            <span style={{ width:28, textAlign:'center', color:'#fff' }}>{r.rir}</span>
            <span style={{ width:35, textAlign:'center', color:'#fff' }}>{r.rest}с</span>
          </div>
        ))}
      </div>
    ) : (
      <div style={{ textAlign:'center', padding:10, color:'#fff', fontSize:10 }}>Нет упражнений для выбранной группы</div>
    )}
  </>);
};

export const ExerciseGenerator: React.FC = () => {
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🏋️ Генератор упражнений</h3>
      <ExerciseGeneratorContent />
    </div>
  );
};
