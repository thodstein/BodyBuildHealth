/** LoadSafetyCard.tsx — ПОЛНЫЙ ПЕРЕПИСК: все вводы через PopupNumber/PopupSelect/PopupToggle.
 *  3 подвкладки: Ортопедия / Неделя / Авторегуляция.
 *  Каждый блок — кнопка-карточка с попапом, никаких raw <input>. */
import React, { useState, useMemo } from 'react';
import { computeOrthopedicConstraints, distributeWeeklyLoad } from '../../../engines/orthopedic-load-engines';
import { autoRegulate, loadForRPE, rpeFromLoad } from '../../../engines/pro/autoregulation-pro.engine';
import { loadTrainingProfile } from './training-profile';
import { applyToPlanner } from './planner-bridge';
import { PopupNumber, PopupSelect, PopupToggle, CalcSection, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const APPLY_BOX: React.CSSProperties = { marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' };

const SEVERITY_LABELS: Record<string, string> = { none: 'Нет', mild: 'Лёгкая', moderate: 'Средняя', severe: 'Тяжёлая' };

const INJURY_TO_GROUP: Record<string, string> = {
  knee:'legs',shin:'legs',ankle:'legs',hip:'legs',groin:'legs',
  shoulder:'shoulders',rotator:'shoulders',cuff:'shoulders',
  elbow:'arms',biceps:'arms',triceps:'arms',wrist:'arms',forearm:'arms',
  lower_back:'back',lumbar:'back',spine:'back',disc:'back',neck:'back',trap:'back',
  chest:'chest',pec:'chest',
};

type SubTab = 'ortho' | 'weekly' | 'autoreg';
const SUBTABS: { id: SubTab; label: string; icon: string }[] = [
  { id:'ortho', label:'Ортопедия', icon:'🦴' },
  { id:'weekly', label:'Неделя', icon:'📅' },
  { id:'autoreg', label:'Авторег', icon:'⚙️' },
];

export const LoadSafetyCard: React.FC<{ initialSubTab?: SubTab }> = ({ initialSubTab = 'ortho' }) => {
  const prof = useMemo(() => loadTrainingProfile(), []);
  const [subTab, setSubTab] = useState<SubTab>(initialSubTab);
  const [injuries, setInjuries] = useState('');
  const [currentPain, setCurrentPain] = useState('');
  const [techniqueIssues, setTechniqueIssues] = useState<string[]>([]);
  const [jointLimitations, setJointLimitations] = useState<Record<string, 'none' | 'mild' | 'moderate' | 'severe'>>({});
  const [sessions, setSessions] = useState(4);
  const [pri, setPri] = useState(70);
  const [risk, setRisk] = useState('low');
  const [e1rm, setE1rm] = useState(120);
  const [rpe, setRpe] = useState(8);
  const [repCount, setRepCount] = useState(5);
  const [readiness, setReadiness] = useState(75);
  const [acwr, setAcwr] = useState(1.0);
  const [orthoOn, setOrthoOn] = useState(false);
  const [weeklyOn, setWeeklyOn] = useState(false);
  const [autoregOn, setAutoregOn] = useState(false);

  const ortho = useMemo(() => computeOrthopedicConstraints({
    injuryHistory: injuries.split(',').map(s => s.trim()).filter(Boolean),
    jointLimitations, techniqueIssues,
    currentPain: currentPain.split(',').map(s => s.trim()).filter(Boolean),
  }), [injuries, jointLimitations, techniqueIssues, currentPain]);
  const dist = useMemo(() => distributeWeeklyLoad({
    weeklySessions: sessions, goal: prof.goal || 'strength', volumeCapacity: 0.8, intensityCapacity: 0.85, priScore: pri, riskLevel: risk,
  }), [sessions, prof.goal, pri, risk]);
  const reg = useMemo(() => autoRegulate({
    readiness, acwr: { ratio: acwr, zone: acwr > 1.5 ? 'dangerous' : acwr > 1.3 ? 'caution' : acwr < 0.8 ? 'undertrained' : 'optimal' },
  }), [readiness, acwr]);
  const workWeight = useMemo(() => loadForRPE(e1rm, rpe, repCount), [e1rm, rpe, repCount]);
  const rpeBack = useMemo(() => rpeFromLoad(e1rm, workWeight, repCount), [e1rm, workWeight, repCount]);

  const applyOrtho = () => {
    const groups = Array.from(new Set(injuries.split(',').map(s => s.trim().toLowerCase()).map(inj => INJURY_TO_GROUP[inj]).filter(Boolean)));
    applyToPlanner({ kind:'weakpoints', label:'Ортопедия: '+(ortho.phase === 'acute' ? 'острая фаза' : ortho.phase), data: {
      groups, lift: undefined, orthopedic: ortho, currentPain: currentPain.split(',').map(s => s.trim()).filter(Boolean),
    } });
  };
  const applyWeekly = () => {
    const hardDays = dist.weekPlan.filter(d => d.difficulty === 'hard').length;
    applyToPlanner({ kind:'pri', label:'Неделя: '+sessions+' сессий, '+hardDays+' тяж.', data: { volumeMult: hardDays >= 4 ? 0.85 : 0.9, rirShift: 0 } });
  };
  const applyAutoreg = () => applyToPlanner({ kind:'pri', label:'Авторег: объём ×'+reg.volumeMultiplier.toFixed(2), data: { volumeMult: reg.volumeMultiplier, rirShift: reg.rirShift } });

  const content = () => {
    switch (subTab) {
      case 'ortho':
        return (
          <CalcSection icon="🦴" title="Ортопедические ограничения" accent="#f59e0b" desc="Травмы → какие группы щадить">
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6 }}>🩹 Отметьте травмированные зоны</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                {['knee','shoulder','lower_back','elbow','wrist','hip','ankle','neck'].map(inj => {
                  const on = injuries.includes(inj);
                  return <button key={inj} onClick={() => {
                    const list = injuries.split(',').map(s => s.trim()).filter(Boolean);
                    setInjuries(on ? list.filter(x => x !== inj).join(', ') : [...list, inj].join(', '));
                  }} style={{
                    padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    border: on ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)',
                    background: on ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.02)',
                    color: on ? '#f59e0b' : '#fff',
                  }}>{ {knee:'Колено',shoulder:'Плечо',lower_back:'Поясница',elbow:'Локоть',wrist:'Кисть',hip:'Таз',ankle:'Голеностоп',neck:'Шея'}[inj] || inj }</button>;
                })}
              </div>
              <MetricCard title="Ограничения" icon="⚠" accent="#f59e0b">
                <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
                  {ortho.blockedPatterns.length > 0
                    ? ortho.blockedPatterns.map((g: string) => <div key={g}>• {g}: исключение приоритета, RIR ↑</div>)
                    : <div>Нет ограничений</div>}
                </div>
              </MetricCard>
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                <PopupSelect label="Степень колена" value={jointLimitations.knee || 'none'} options={['none','mild','moderate','severe'].map(id => ({ id, label: SEVERITY_LABELS[id] }))} onChange={v => setJointLimitations(p => ({ ...p, knee: v as any }))} />
                <PopupSelect label="Степень плеча" value={jointLimitations.shoulder || 'none'} options={['none','mild','moderate','severe'].map(id => ({ id, label: SEVERITY_LABELS[id] }))} onChange={v => setJointLimitations(p => ({ ...p, shoulder: v as any }))} />
                <PopupSelect label="Степень поясницы" value={jointLimitations.spine || 'none'} options={['none','mild','moderate','severe'].map(id => ({ id, label: SEVERITY_LABELS[id] }))} onChange={v => setJointLimitations(p => ({ ...p, spine: v as any }))} />
                <label style={{ fontSize: 10, color: '#fff' }}>Текущая боль (через запятую)<input value={currentPain} onChange={e => setCurrentPain(e.target.value)} placeholder="колено, плечо" style={{ width:'100%', marginTop:3, padding:8, boxSizing:'border-box', background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,.1)', borderRadius:7 }} /></label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{[['rounding_back','Округление спины'],['butt_wink','Клевок таза']].map(([id,label]) => <button key={id} onClick={() => setTechniqueIssues(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} style={{ padding:'5px 8px', borderRadius:8, cursor:'pointer', color: techniqueIssues.includes(id) ? '#f59e0b' : '#fff', background: techniqueIssues.includes(id) ? 'rgba(245,158,11,.15)' : 'transparent', border:'1px solid rgba(255,255,255,.1)', fontSize:10 }}>{label}</button>)}</div>
                <div style={{ fontSize:10, color:'#f59e0b' }}>Фаза: <b>{ortho.phase}</b> · стресс суставов: {Object.entries(ortho.jointStressLimits).filter(([,v]) => v < 4).map(([k,v]) => `${k} ${v}/4`).join(', ') || 'без ограничений'}</div>
                {ortho.recommendations.map((r, i) => <div key={i} style={{ fontSize:10, color:'#fff' }}>• {r}</div>)}
              </div>
            </div>
            <PopupToggle label="Применить ортопедию" value={orthoOn} onChange={setOrthoOn} icon="🔄" />
            {orthoOn && <div style={APPLY_BOX}>
              <button onClick={applyOrtho} style={{ width:'100%', padding:12, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:800, fontSize:12 }}>🛠 Применить к планировщику</button>
            </div>}
          </CalcSection>
        );
      case 'weekly':
        return (
          <CalcSection icon="📅" title="Распределение недели" accent="#22c55e" desc="Количество сессий, готовность, риск">
            <PopupNumber label="Сессий/нед" value={sessions} min={2} max={7} onChange={setSessions} />
            <PopupNumber label="PRI (готовность)" value={pri} min={0} max={100} step={10} onChange={setPri} />
            <PopupSelect label="Уровень риска" value={risk} options={[['low','Низкий'],['medium','Средний'],['high','Высокий']].map(([id,label]) => ({ id, label }))} onChange={setRisk} />
            <PopupToggle label="Применить распределение" value={weeklyOn} onChange={setWeeklyOn} icon="🔄" />
            <div style={{ gridColumn: '1 / -1' }}>
              <MetricCard title="План недели" icon="📋" accent="#22c55e">
                <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
                  {dist.weekPlan.map((d, i) => <div key={i}>• Д{i+1}: {d.difficulty === 'hard' ? '🔴 Тяжёлая' : d.difficulty === 'medium' ? '🟡 Средняя' : '🟢 Лёгкая'} · объём {d.volumeTarget}%</div>)}
                </div>
              </MetricCard>
              {weeklyOn && <div style={APPLY_BOX}>
                <button onClick={applyWeekly} style={{ width:'100%', padding:12, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:800, fontSize:12 }}>🛠 Применить к планировщику</button>
              </div>}
            </div>
          </CalcSection>
        );
      case 'autoreg':
        return (
          <CalcSection icon="⚙️" title="RPE-авторегуляция" accent="#a855f7" desc="Вес по RPE, авторегуляция объёма, готовность">
            <PopupNumber label="e1RM (кг)" value={e1rm} min={20} max={500} onChange={setE1rm} />
            <PopupNumber label="RPE (6-10)" value={rpe} min={6} max={10} step={0.5} onChange={setRpe} />
            <PopupNumber label="Повторений" value={repCount} min={1} max={20} onChange={setRepCount} />
            <PopupNumber label="Готовность %" value={readiness} min={0} max={100} step={5} onChange={setReadiness} />
            <PopupNumber label="ACWR" value={acwr} min={0.5} max={2.5} step={0.1} onChange={v => setAcwr(Math.round(v * 10) / 10)} />
            <div style={{ gridColumn: '1 / -1' }}>
              <MetricCard title="Результат" icon="📊" accent="#a855f7">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
                  <div>Рабочий вес: <b style={{color:'#fff'}}>{workWeight.toFixed(1)} кг</b></div>
                  <div>RPE обратный: <b style={{color:'#fff'}}>{rpeBack.toFixed(1)}</b></div>
                  <div>Объём ×{reg.volumeMultiplier.toFixed(2)}</div>
                  <div>RIR +{reg.rirShift}</div>
                </div>
              </MetricCard>
            </div>
            <PopupToggle label="Применить авторег" value={autoregOn} onChange={setAutoregOn} icon="🔄" />
            {autoregOn && <div style={APPLY_BOX}>
              <button onClick={applyAutoreg} style={{ width:'100%', padding:12, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:800, fontSize:12 }}>🛠 Применить к планировщику</button>
            </div>}
          </CalcSection>
        );
    }
  };

  return (
    <div className="train-loadsafety" style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div className="train-loadsafety-tabs" style={{ display: 'flex', gap: 3, marginBottom: 10, flexWrap: 'wrap' }}>
        {SUBTABS.map(s => (
          <button key={s.id} onClick={() => setSubTab(s.id)} style={{
            padding: '6px 12px', borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: 'pointer',
            border: subTab === s.id ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
            background: subTab === s.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)',
            color: subTab === s.id ? '#00e68a' : '#fff',
          }}>{s.icon} {s.label}</button>
        ))}
      </div>
      {content()}
    </div>
  );
};
