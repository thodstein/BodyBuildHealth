import React, { useState } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { autoFillFromMainProfile, saveBioStackProfile, loadBioStackProfile } from '../../engines/biostack-ai.engine';
import { buildStack } from '../../engines/supplement-finder.engine';
import { PillBtn, Slider, toFinderProfile, PURE_GOALS, ORGANS, SYSTEMS, HEALTH_CONDS, TOP_MECHANISMS } from './BioStackAIConstants';
import { type GoalType, type GutSensitivity, type AlcoholLevel, type AASStatus, type CognitiveTask, type StimSensitivity, type CaffeineLevel, type ADClass, type DietType, type Chronotype, type BudgetLevel, type StackComplexity, type ExperienceLevel, type HealthCondition, type BioStackProfile as BSP } from '../../engines/biostack-ai.engine';

/* ─── Popup Overlay ─── */
function PopupOverlay({ title, icon, color, children, onClose }: { title: string; icon: string; color: string; children: React.ReactNode; onClose: () => void }) {
  return <div style={{ position:'fixed', inset:0, zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.87)' }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:400, maxHeight:'80vh', borderRadius:18, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
      <div style={{ height:4, background:`linear-gradient(90deg, ${color}, ${color}66, transparent)` }} />
      <div style={{ padding:'16px 18px', maxHeight:'calc(80vh - 4px)', overflowY:'auto' }}>
        <div style={{ fontSize:15, fontWeight:700, color, marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
          <span>{icon}</span>{title}
        </div>
        {children}
        <button onClick={onClose} style={{ width:'100%', padding:'10px 0', borderRadius:10, marginTop:12, cursor:'pointer', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:600 }}>
          Закрыть
        </button>
      </div>
    </div>
  </div>;
}

/* ─── Card Button ─── */
function CardBtn({ icon, title, subtitle, color, onClick, count }: { icon: string; title: string; subtitle?: string; color: string; onClick: () => void; count?: number }) {
  return <button onClick={onClick} style={{
    width:'100%', padding:'14px 16px', borderRadius:14, cursor:'pointer', textAlign:'left',
    background:'rgba(24,24,27,0.7)', border:'1px solid rgba(255,255,255,0.06)', marginBottom:8,
    transition:'all 0.15s',
    display:'flex', alignItems:'center', gap:12,
  }}>
    <div style={{ width:40, height:40, borderRadius:12, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
      {icon}
    </div>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:2 }}>{title}</div>
      {subtitle && <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{subtitle}</div>}
    </div>
    {count !== undefined && <div style={{ padding:'2px 8px', borderRadius:10, background:`${color}20`, color, fontSize:9, fontWeight:700 }}>{count}</div>}
    <div style={{ fontSize:10, color:'rgba(255,255,255,0.2)' }}>›</div>
  </button>;
}

function SmallBtn({ icon, title, subtitle, color, onClick, count }: { icon: string; title: string; subtitle?: string; color: string; onClick: () => void; count?: number }) {
  return <button onClick={onClick} style={{
    flex:1, padding:'10px 8px', borderRadius:12, cursor:'pointer', textAlign:'center',
    background:'rgba(24,24,27,0.7)', border:'1px solid rgba(255,255,255,0.06)',
    transition:'all 0.15s',
  }}>
    <div style={{ fontSize:16, marginBottom:4 }}>{icon}</div>
    <div style={{ fontSize:9, fontWeight:700, color:'#fff', marginBottom:2 }}>{title}</div>
    {subtitle && <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)' }}>{subtitle}</div>}
    {count !== undefined && <div style={{ marginTop:2, padding:'1px 6px', borderRadius:8, background:`${color}20`, color, fontSize:8, fontWeight:700, display:'inline-block' }}>{count}</div>}
  </button>;
}

/* ─── Popup: Личные данные ─── */
function PopupPersonal({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const [age, setAge] = useState(profile.age);
  const [weight, setWeight] = useState(profile.weight);
  const [height, setHeight] = useState(profile.height);
  const [sex, setSex] = useState(profile.sex);
  const [exp, setExp] = useState(profile.experience);
  const save = () => { u({ age, weight, height, sex, experience: exp }); onClose(); };
  return <PopupOverlay title="Личные данные" icon="👤" color="#60a5fa" onClose={onClose}>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:10 }}>
      <div><label style={{fontSize:8,color:'rgba(255,255,255,0.5)',marginBottom:2,display:'block'}}>Возраст</label>
        <input type="number" value={age} onChange={e => setAge(+e.target.value||0)}
          style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:13,textAlign:'center',boxSizing:'border-box'}} /></div>
      <div><label style={{fontSize:8,color:'rgba(255,255,255,0.5)',marginBottom:2,display:'block'}}>Вес (кг)</label>
        <input type="number" value={weight} onChange={e => setWeight(+e.target.value||0)}
          style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:13,textAlign:'center',boxSizing:'border-box'}} /></div>
      <div><label style={{fontSize:8,color:'rgba(255,255,255,0.5)',marginBottom:2,display:'block'}}>Рост (см)</label>
        <input type="number" value={height} onChange={e => setHeight(+e.target.value||0)}
          style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:13,textAlign:'center',boxSizing:'border-box'}} /></div>
    </div>
    <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
      <PillBtn active={sex === 'male'} onClick={() => setSex('male')} color="#60a5fa">♂ Мужской</PillBtn>
      <PillBtn active={sex === 'female'} onClick={() => setSex('female')} color="#f472b6">♀ Женский</PillBtn>
      <span style={{fontSize:8,color:'rgba(255,255,255,0.2)',alignSelf:'center',margin:'0 4px'}}>|</span>
      {(['beginner','intermediate','advanced'] as const).map(l => (
        <PillBtn key={l} active={exp === l} onClick={() => setExp(l)}>
          {l==='beginner'?'🌱 Новичок':l==='intermediate'?'💪 Средний':'🔥 Продвинутый'}
        </PillBtn>
      ))}
    </div>
    <button onClick={save} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#60a5fa,#3b82f6)',color:'#fff',fontWeight:700,fontSize:12}}>✅ Применить</button>
  </PopupOverlay>;
}

/* ─── Popup: Здоровье ─── */
function PopupHealth({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const [bpSys, setBpSys] = useState(profile.bpSystolic);
  const [bpDia, setBpDia] = useState(profile.bpDiastolic);
  const [gut, setGut] = useState(profile.gutSensitivity);
  const [smoke, setSmoke] = useState(profile.smoke);
  const [alcohol, setAlcohol] = useState(profile.alcoholLevel);
  const [aas, setAas] = useState(profile.aasStatus);
  const [conds, setConds] = useState<typeof profile.healthConditions>([...profile.healthConditions]);
  const save = () => { u({ bpSystolic: bpSys, bpDiastolic: bpDia, gutSensitivity: gut, smoke, alcoholLevel: alcohol, aasStatus: aas, healthConditions: conds }); onClose(); };
  return <PopupOverlay title="Здоровье" icon="🫀" color="#ef4444" onClose={onClose}>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
      <div><label style={{fontSize:8,color:'rgba(255,255,255,0.5)',marginBottom:2,display:'block'}}>Систолическое</label>
        <input type="number" value={bpSys} onChange={e => setBpSys(+e.target.value||120)}
          style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:13,textAlign:'center',boxSizing:'border-box'}} /></div>
      <div><label style={{fontSize:8,color:'rgba(255,255,255,0.5)',marginBottom:2,display:'block'}}>Диастолическое</label>
        <input type="number" value={bpDia} onChange={e => setBpDia(+e.target.value||80)}
          style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:13,textAlign:'center',boxSizing:'border-box'}} /></div>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
      <select value={gut} onChange={e => setGut(e.target.value as GutSensitivity)}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="normal">🟢 ЖКТ — норма</option><option value="sensitive">🟡 Чувствительный</option><option value="problematic">🔴 Проблемный</option>
      </select>
      <select value={smoke ? 'yes' : 'no'} onChange={e => setSmoke(e.target.value === 'yes')}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="no">🚭 Не курю</option><option value="yes">🚬 Курю</option>
      </select>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
      <select value={alcohol} onChange={e => setAlcohol(e.target.value as AlcoholLevel)}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="none">✖ Не пью</option><option value="rare">🍷 Редко</option><option value="moderate">🍺 1-3/нед</option><option value="daily">🔴 Ежедневно</option>
      </select>
      <select value={aas} onChange={e => setAas(e.target.value as AASStatus)}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="none">✖ Без ААС</option><option value="trt">💉 TRT</option><option value="course">💊 Курс</option><option value="pct">🔄 ПКТ</option>
        <option value="bridge">🌉 Бридж</option><option value="fertility">🧬 Фертильность</option>
      </select>
    </div>
    <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',marginBottom:4}}>🩺 Состояния здоровья:</div>
    <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:4 }}>
      {HEALTH_CONDS.map(h => (
        <PillBtn key={h.key} small active={conds.includes(h.key)}
          onClick={() => setConds(conds.includes(h.key) ? conds.filter(x => x !== h.key) : [...conds, h.key])}>
          {h.label}
        </PillBtn>
      ))}
    </div>
    <button onClick={save} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#ef4444,#dc2626)',color:'#fff',fontWeight:700,fontSize:12}}>✅ Применить</button>
  </PopupOverlay>;
}

/* ─── Popup: Нейро статус ─── */
function PopupNeuro({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const [ct, setCt] = useState(profile.cognitiveTask);
  const [ss, setSs] = useState(profile.stimSensitivity);
  const [caf, setCaf] = useState(profile.caffeineLevel);
  const [ad, setAd] = useState(profile.adClass);
  const [anx, setAnx] = useState(profile.anxietyLevel);
  const [sleep, setSleep] = useState(profile.sleepQuality);
  const [stress, setStress] = useState(profile.stressLevel);
  const save = () => { u({ cognitiveTask: ct, stimSensitivity: ss, caffeineLevel: caf, adClass: ad, anxietyLevel: anx, sleepQuality: sleep, stressLevel: stress }); onClose(); };
  return <PopupOverlay title="Нейро статус" icon="🧠" color="#a78bfa" onClose={onClose}>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
      <select value={ct} onChange={e => setCt(e.target.value as CognitiveTask)}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="memory">🧠 Память</option><option value="focus">🎯 Фокус</option><option value="creativity">💡 Креативность</option>
        <option value="reaction_speed">⚡ Быстрота реакции</option><option value="learning">📚 Учёба</option>
      </select>
      <select value={ss} onChange={e => setSs(e.target.value as StimSensitivity)}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="low">🟢 Низкая чувствительность</option><option value="medium">🟡 Средняя</option><option value="high">🔴 Высокая</option>
      </select>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
      <select value={caf} onChange={e => setCaf(e.target.value as CaffeineLevel)}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="none">✖ Не пью кофе</option><option value="low">☕ 1-2 чашки</option><option value="moderate">☕☕ 3-5 чашек</option><option value="high">☕☕☕ 5+ чашек</option>
      </select>
      <select value={ad} onChange={e => setAd(e.target.value as ADClass)}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="none">✖ Нет</option><option value="ssri">💊 СИОЗС</option><option value="snri">💊 СИОЗСиН</option>
        <option value="maoi">💊 ИМАО</option><option value="tca">💊 ТЦА</option><option value="other">💊 Другие</option>
      </select>
    </div>
    <div style={{ marginBottom:4 }}>
      <Slider value={anx} onChange={setAnx} label="Тревожность" emoji="😰" />
      <Slider value={sleep} onChange={setSleep} label="Качество сна" emoji="😴" />
      <Slider value={stress} onChange={setStress} label="Уровень стресса" emoji="⚡" />
    </div>
    <button onClick={save} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#a78bfa,#7c3aed)',color:'#fff',fontWeight:700,fontSize:12}}>✅ Применить</button>
  </PopupOverlay>;
}

/* ─── Popup: Образ жизни ─── */
function PopupLifestyle({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const [diet, setDiet] = useState(profile.dietType);
  const [chr, setChr] = useState(profile.chronotype);
  const [budget, setBudget] = useState(profile.budget);
  const [compl, setCompl] = useState(profile.stackComplexity);
  const save = () => { u({ dietType: diet, chronotype: chr, budget, stackComplexity: compl }); onClose(); };
  return <PopupOverlay title="Образ жизни" icon="🌍" color="#22c55e" onClose={onClose}>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
      <select value={diet} onChange={e => setDiet(e.target.value as DietType)}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="mixed">🍖 Смешанное</option><option value="vegetarian">🥦 Вегетарианское</option>
        <option value="vegan">🌱 Веганское</option><option value="keto">🥑 Кето</option>
        <option value="paleo">🥩 Палео</option><option value="mediterranean">🫒 Средиземноморское</option>
      </select>
      <select value={chr} onChange={e => setChr(e.target.value as Chronotype)}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="lark">🌅 Жаворонок</option><option value="owl">🦉 Сова</option><option value="mixed">🐦 Смешанный</option>
      </select>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
      <select value={budget} onChange={e => setBudget(e.target.value as BudgetLevel)}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="economy">💰 Эконом</option><option value="medium">💵 Средний</option><option value="premium">💎 Премиум</option>
      </select>
      <select value={compl} onChange={e => setCompl(e.target.value as StackComplexity)}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="minimal">🔵 Минимальный (3-5)</option><option value="balanced">🟢 Средний (5-10)</option><option value="maximum">🔴 Максимальный (10-20)</option>
      </select>
    </div>
    <button onClick={save} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#22c55e,#16a34a)',color:'#fff',fontWeight:700,fontSize:12}}>✅ Применить</button>
  </PopupOverlay>;
}

const GOAL_GROUPS: { title: string; keys: GoalType[] }[] = [
  { title:'🏋️ Физическая форма', keys:['muscle_gain','fat_loss','endurance'] },
  { title:'🔄 Восстановление', keys:['sleep','recovery'] },
  { title:'⚡ Энергия и тонус', keys:['energy','libido'] },
  { title:'🧠 Когнитивные функции', keys:['concentration','brain'] },
  { title:'😊 Психоэмоциональное состояние', keys:['mood','stress'] },
  { title:'❤️ Системное здоровье', keys:['cardio_health','immunity','hormones','joints','digestion','detox'] },
  { title:'⏳ Долгосрочные', keys:['longevity'] },
];
const GOAL_LABEL: Record<string,string> = {};
PURE_GOALS.forEach(g => { GOAL_LABEL[g.key] = g.label; });

/* ─── Popup: Цели ─── */
function PopupGoals({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const [goals, setGoals] = useState([...profile.goals]);
  const toggle = (k: GoalType) => setGoals(goals.includes(k) ? goals.filter(x => x !== k) : [...goals, k]);
  const save = () => { u({ goals }); onClose(); };
  return <PopupOverlay title="Цели" icon="🎯" color="#f59e0b" onClose={onClose}>
    <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',marginBottom:8,lineHeight:1.3}}>
      Выберите, чего хотите достичь. Цели влияют на подбор БАДов и приоритеты поддержки. Органы и системы настраиваются отдельно.
    </div>
    {GOAL_GROUPS.map(group => (
      <div key={group.title} style={{marginBottom:8}}>
        <div style={{fontSize:8,color:'rgba(255,255,255,0.3)',marginBottom:4,letterSpacing:0.5}}>{group.title}</div>
        <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
          {group.keys.map(k => {
            const label = GOAL_LABEL[k] || k;
            return (
              <PillBtn key={k} small active={goals.includes(k)} onClick={() => toggle(k)}>
                {label}
              </PillBtn>
            );
          })}
        </div>
      </div>
    ))}
    <button onClick={save} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#f59e0b,#d97706)',color:'#fff',fontWeight:700,fontSize:12}}>✅ Применить ({goals.length})</button>
  </PopupOverlay>;
}

/* ─── Popup: Органы ─── */
function PopupOrgans({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const [organs, setOrgans] = useState([...profile.targetOrgans]);
  const save = () => { u({ targetOrgans: organs }); onClose(); };
  return <PopupOverlay title="Органы-мишени" icon="🫀" color="#60a5fa" onClose={onClose}>
    <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',marginBottom:6,lineHeight:1.3}}>
      Анатомические органы, на которые хотите воздействовать. Выбор органа фокусирует подбор БАДов на ткань-мишень.
    </div>
    <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:10 }}>
      {ORGANS.map(o => (
        <PillBtn key={o.key} small active={organs.includes(o.key)}
          onClick={() => setOrgans(organs.includes(o.key) ? organs.filter(x => x !== o.key) : [...organs, o.key])}>
          {o.label}
        </PillBtn>
      ))}
    </div>
    <button onClick={save} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#60a5fa,#3b82f6)',color:'#fff',fontWeight:700,fontSize:12}}>✅ Применить ({organs.length})</button>
  </PopupOverlay>;
}

/* ─── Popup: Системы ─── */
function PopupSystems({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const [systems, setSystems] = useState([...profile.targetSystems]);
  const save = () => { u({ targetSystems: systems }); onClose(); };
  return <PopupOverlay title="Системы-мишени" icon="⚙️" color="#8b5cf6" onClose={onClose}>
    <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',marginBottom:6,lineHeight:1.3}}>
      Физиологические системы организма. Выбор системы задаёт направление поддержки (сердечно-сосудистая, эндокринная, иммунная и т.д.).
    </div>
    <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:10 }}>
      {SYSTEMS.map(s => (
        <PillBtn key={s.key} small active={systems.includes(s.key)}
          onClick={() => setSystems(systems.includes(s.key) ? systems.filter(x => x !== s.key) : [...systems, s.key])}>
          {s.label}
        </PillBtn>
      ))}
    </div>
    <button onClick={save} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#8b5cf6,#7c3aed)',color:'#fff',fontWeight:700,fontSize:12}}>✅ Применить ({systems.length})</button>
  </PopupOverlay>;
}

/* ─── Popup: Механизмы ─── */
function PopupMechanisms({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const [mechs, setMechs] = useState<string[]>([]);
  const save = () => { u({ targetSystems: [...profile.targetSystems, ...mechs] }); onClose(); };
  return <PopupOverlay title="Механизмы действия" icon="🔬" color="#22c55e" onClose={onClose}>
    <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',marginBottom:6,lineHeight:1.3}}>
      Молекулярные механизмы. Выбор механизма позволяет точечно подобрать БАДы по биохимическому принципу действия (антиоксидант, дофамин, AMPK и т.д.).
    </div>
    <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:10 }}>
      {TOP_MECHANISMS.map(m => (
        <PillBtn key={m.key} small active={mechs.includes(m.key)}
          onClick={() => setMechs(mechs.includes(m.key) ? mechs.filter(x => x !== m.key) : [...mechs, m.key])}>
          {m.label}
        </PillBtn>
      ))}
    </div>
    <button onClick={save} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#22c55e,#16a34a)',color:'#fff',fontWeight:700,fontSize:12}}>✅ Применить ({mechs.length})</button>
  </PopupOverlay>;
}

/* ─── Popup: Текущие БАДы ─── */
function PopupSupplements({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const [supps, setSupps] = useState(profile.currentSupplements.join(', '));
  const [avoid, setAvoid] = useState(profile.avoidIds.join(', '));
  const save = () => { u({ currentSupplements: supps.split(',').map(s=>s.trim()).filter(Boolean), avoidIds: avoid.split(',').map(s=>s.trim()).filter(Boolean) }); onClose(); };
  return <PopupOverlay title="Текущие БАДы / Избегать" icon="💊" color="#8b5cf6" onClose={onClose}>
    <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',marginBottom:6,lineHeight:1.3}}>
      Укажите, какие БАДы уже принимаете, и какие хотите исключить из подбора (по id).
    </div>
    <div style={{marginBottom:8}}>
      <label style={{fontSize:8,color:'rgba(255,255,255,0.5)',marginBottom:2,display:'block'}}>🟢 Текущие БАДы (id через запятую):</label>
      <input value={supps} onChange={e => setSupps(e.target.value)} placeholder="nap: nac, omega3, tudca, витамин D"
        style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:11,boxSizing:'border-box'}} />
    </div>
    <div style={{marginBottom:8}}>
      <label style={{fontSize:8,color:'rgba(255,255,255,0.5)',marginBottom:2,display:'block'}}>🔴 Избегать (id через запятую):</label>
      <input value={avoid} onChange={e => setAvoid(e.target.value)} placeholder="nap: yohimbine, huperzine_a, dmaa"
        style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:11,boxSizing:'border-box'}} />
    </div>
    <button onClick={save} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#8b5cf6,#7c3aed)',color:'#fff',fontWeight:700,fontSize:12}}>✅ Применить</button>
  </PopupOverlay>;
}

/* ─── Popup: Клинические данные ─── */
function PopupClinical({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const [meds, setMeds] = useState(profile.currentMeds.join(', '));
  const [allergies, setAllergies] = useState(profile.drugAllergies.join(', '));
  const [cyp, setCyp] = useState(profile.cyp450Status);
  const [preg, setPreg] = useState(profile.isPregnant);
  const [lact, setLact] = useState(profile.lactating);
  const [surgery, setSurgery] = useState(profile.surgeryHistory.join(', '));
  const [family, setFamily] = useState(profile.familyHistory.join(', '));
  const save = () => {
    u({
      currentMeds: meds.split(',').map(s=>s.trim()).filter(Boolean),
      drugAllergies: allergies.split(',').map(s=>s.trim()).filter(Boolean),
      cyp450Status: cyp,
      isPregnant: preg, lactating: lact,
      surgeryHistory: surgery.split(',').map(s=>s.trim()).filter(Boolean),
      familyHistory: family.split(',').map(s=>s.trim()).filter(Boolean),
    });
    onClose();
  };
  return <PopupOverlay title="Клинические данные" icon="🏥" color="#ef4444" onClose={onClose}>
    <div style={{marginBottom:6}}>
      <label style={{fontSize:8,color:'rgba(255,255,255,0.5)',display:'block',marginBottom:2}}>💊 Лекарства (МНН, через запятую):</label>
      <input value={meds} onChange={e=>setMeds(e.target.value)} placeholder="варфарин, метформин, аторвастатин..."
        style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,boxSizing:'border-box'}} />
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:6}}>
      <div>
        <label style={{fontSize:8,color:'rgba(255,255,255,0.5)',display:'block',marginBottom:2}}>⚠ Аллергии:</label>
        <input value={allergies} onChange={e=>setAllergies(e.target.value)} placeholder="пенициллин..."
          style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,boxSizing:'border-box'}} />
      </div>
      <div>
        <label style={{fontSize:8,color:'rgba(255,255,255,0.5)',display:'block',marginBottom:2}}>🧬 CYP450:</label>
        <select value={cyp} onChange={e=>setCyp(e.target.value)}
          style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
          <option value="unknown">❓ Неизвестен</option><option value="normal">🟢 Нормальный (EM)</option>
          <option value="poor">🔴 Медленный (PM)</option><option value="intermediate">🟡 Промежуточный (IM)</option>
          <option value="rapid">🔵 Быстрый (RM)</option>
        </select>
      </div>
    </div>
    {profile.sex === 'female' && <div style={{display:'flex',gap:6,marginBottom:6}}>
      <PillBtn active={preg} onClick={()=>setPreg(!preg)} color="#f472b6">{preg?'🤰 Беременность ✓':'🤰 Беременность'}</PillBtn>
      <PillBtn active={lact} onClick={()=>setLact(!lact)} color="#f472b6">{lact?'🍼 Лактация ✓':'🍼 Лактация'}</PillBtn>
    </div>}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:6}}>
      <div>
        <label style={{fontSize:8,color:'rgba(255,255,255,0.5)',display:'block',marginBottom:2}}>🩺 Операции (через запятую):</label>
        <input value={surgery} onChange={e=>setSurgery(e.target.value)} placeholder="холецистэктомия, аппендэктомия..."
          style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,boxSizing:'border-box'}} />
      </div>
      <div>
        <label style={{fontSize:8,color:'rgba(255,255,255,0.5)',display:'block',marginBottom:2}}>🧬 Сем. анамнез (через запятую):</label>
        <input value={family} onChange={e=>setFamily(e.target.value)} placeholder="гипертония, диабет 2 типа, онкология..."
          style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,boxSizing:'border-box'}} />
      </div>
    </div>
    <button onClick={save} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#ef4444,#dc2626)',color:'#fff',fontWeight:700,fontSize:12}}>✅ Применить</button>
  </PopupOverlay>;
}

/* ─── Пресет: тип ─── */
type PresetEntry = {
  id: string; icon: string; name: string; desc: string;
  category: 'male' | 'female' | 'goal' | 'aas';
  p: Partial<BioStackProfile>;
};

/* ─── Popup: Пресеты (расширенные) ─── */
function PopupPresets({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const presets: PresetEntry[] = [
    // ── ♂ Мужские ──
    { id:'male_bodybuilder', icon:'🏋️', name:'Бодибилдер', desc:'Рост массы и силы. Полный стек поддержки для тяжёлых тренировок',
      category:'male',
      p: { goals:['muscle_gain','recovery','joints'] as GoalType[], experience:'advanced' as ExperienceLevel, budget:'premium' as BudgetLevel, stackComplexity:'maximum' as StackComplexity, targetSystems:['musculoskeletal','endocrine','cardio'] as string[], targetOrgans:['MUSCLES','BONES','JOINTS','HEART','LIVER'] as string[], maxStackSize: 20 }},
    { id:'male_athlete', icon:'🏃', name:'Спортсмен', desc:'Выносливость, кардио, восстановление между тренировками',
      category:'male',
      p: { goals:['endurance','recovery','energy','cardio_health'] as GoalType[], experience:'advanced' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['cardio','musculoskeletal','metabolic'] as string[], targetOrgans:['HEART','VESSELS','MUSCLES','LUNGS'] as string[], maxStackSize: 12 }},
    { id:'male_hormonal', icon:'⚖️', name:'Гормональный баланс', desc:'Поддержка тестостерона, либидо, щитовидной железы',
      category:'male',
      p: { goals:['hormones','libido','energy','sleep'] as GoalType[], experience:'intermediate' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['endocrine','reproductive','neuro'] as string[], targetOrgans:['ENDOCRINE','REPRODUCTIVE','THYROID','ADRENALS'] as string[], maxStackSize: 8 }},
    { id:'male_antiage', icon:'⏳', name:'Антивозрастной', desc:'Долголетие, энергия, когнитивные функции, митохондрии',
      category:'male',
      p: { goals:['longevity','energy','brain','cardio_health'] as GoalType[], experience:'intermediate' as ExperienceLevel, budget:'premium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['neuro','cardio','metabolic','immune'] as string[], targetOrgans:['BRAIN','HEART','MITOCHONDRIA','CELLS'] as string[], maxStackSize: 10 }},
    // ── ♀ Женские ──
    { id:'female_fitness', icon:'💪', name:'Фитнес / Тонус', desc:'Жиросжигание, энергия, подтянутое тело, здоровье кожи',
      category:'female',
      p: { goals:['fat_loss','energy','skin','muscle_gain'] as GoalType[], sex:'female', experience:'intermediate' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['musculoskeletal','endocrine','metabolic'] as string[], targetOrgans:['MUSCLES','SKIN','THYROID'] as string[], maxStackSize: 8 }},
    { id:'female_health', icon:'🧘', name:'ЗОЖ / Иммунитет', desc:'Профилактика, детокс, иммунитет, общее здоровье',
      category:'female',
      p: { goals:['immunity','detox','digestion','energy'] as GoalType[], sex:'female', experience:'beginner' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['immune','gastrointestinal','metabolic'] as string[], targetOrgans:['IMMUNE_SYSTEM','GUT','LIVER'] as string[], maxStackSize: 8 }},
    { id:'female_hormonal', icon:'🌸', name:'Гормональный женский', desc:'Цикл, ПМС, кожа, волосы, настроение',
      category:'female',
      p: { goals:['hormones','mood','skin','hair','stress'] as GoalType[], sex:'female', experience:'intermediate' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['endocrine','reproductive','neuro'] as string[], targetOrgans:['ENDOCRINE','REPRODUCTIVE','SKIN','BRAIN'] as string[], maxStackSize: 8 }},
    { id:'female_antistress', icon:'😌', name:'Антистресс / Сон', desc:'Снижение тревожности, улучшение сна, восстановление нервной системы',
      category:'female',
      p: { goals:['stress','sleep','mood','recovery'] as GoalType[], sex:'female', experience:'beginner' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'minimal' as StackComplexity, targetSystems:['neuro','endocrine'] as string[], targetOrgans:['BRAIN','NERVES','ADRENALS'] as string[], maxStackSize: 6 }},
    // ── 🎯 По целям ──
    { id:'goal_nootropic', icon:'🧠', name:'Ноотроп / Фокус', desc:'Память, концентрация, креативность, нейропластичность',
      category:'goal',
      p: { goals:['brain','concentration','mood','energy'] as GoalType[], cognitiveTask:'focus' as CognitiveTask, experience:'beginner' as ExperienceLevel, budget:'premium' as BudgetLevel, stackComplexity:'minimal' as StackComplexity, targetSystems:['neuro'] as string[], targetOrgans:['BRAIN','NERVES'] as string[], maxStackSize: 6 }},
    { id:'goal_immunity', icon:'🛡️', name:'Иммунитет', desc:'Укрепление защитных сил, профилактика, адаптогены',
      category:'goal',
      p: { goals:['immunity','recovery','energy'] as GoalType[], experience:'beginner' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['immune','metabolic'] as string[], targetOrgans:['IMMUNE_SYSTEM','BLOOD','GUT'] as string[], maxStackSize: 8 }},
    { id:'goal_detox', icon:'🧪', name:'Детокс + Печень', desc:'Очищение организма, поддержка печени, антиоксиданты',
      category:'goal',
      p: { goals:['detox','liver_health','digestion'] as GoalType[], experience:'intermediate' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['hepatic','gastrointestinal','immune'] as string[], targetOrgans:['LIVER','GUT','KIDNEYS'] as string[], maxStackSize: 8, healthConditions:['liver'] as HealthCondition[] }},
    { id:'goal_longevity', icon:'⏳', name:'Долголетие', desc:'Митохондрии, омега-3, антиоксиданты, кардиопротекция',
      category:'goal',
      p: { goals:['longevity','cardio_health','brain','energy'] as GoalType[], experience:'intermediate' as ExperienceLevel, budget:'premium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['cardio','neuro','metabolic','immune'] as string[], targetOrgans:['HEART','BRAIN','MITOCHONDRIA','CELLS','VESSELS'] as string[], maxStackSize: 10 }},
    // ── 💉 По AAS ──
    { id:'aas_course', icon:'💉', name:'Курс ААС', desc:'Максимальная поддержка на курсе: печень, сердце,давление, липиды',
      category:'aas',
      p: { goals:['liver_health','cardio_health','detox','kidney'] as GoalType[], aasStatus:'course' as AASStatus, experience:'advanced' as ExperienceLevel, budget:'premium' as BudgetLevel, stackComplexity:'maximum' as StackComplexity, targetSystems:['hepatic','cardio','renal','hematologic','endocrine'] as string[], targetOrgans:['LIVER','HEART','KIDNEYS','BLOOD','ENDOCRINE'] as string[], maxStackSize: 16, healthConditions:[] as HealthCondition[] }},
    { id:'aas_pct', icon:'🔄', name:'ПКТ', desc:'Восстановление HPTA, антиэстрогены, гонадотропины, печень',
      category:'aas',
      p: { goals:['hormones','recovery','detox','mood'] as GoalType[], aasStatus:'pct' as AASStatus, experience:'advanced' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'maximum' as StackComplexity, targetSystems:['endocrine','reproductive','hepatic','neuro'] as string[], targetOrgans:['ENDOCRINE','REPRODUCTIVE','LIVER','BRAIN','PITUITARY'] as string[], maxStackSize: 12, healthConditions:[] as HealthCondition[] }},
    { id:'aas_trt', icon:'♾️', name:'TRT', desc:'Долгосрочная поддержка на TRT: кардио, гематокрит, эстрадиол, простата',
      category:'aas',
      p: { goals:['cardio_health','hormones','liver_health','kidney'] as GoalType[], aasStatus:'trt' as AASStatus, experience:'advanced' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['cardio','hematologic','endocrine','reproductive'] as string[], targetOrgans:['HEART','BLOOD','ENDOCRINE','PROSTATE','KIDNEYS'] as string[], maxStackSize: 10, healthConditions:[] as HealthCondition[] }},
    { id:'aas_fertility', icon:'🧬', name:'Фертильность', desc:'Подготовка к зачатию: сперматогенез, антиоксиданты, гормоны',
      category:'aas',
      p: { goals:['hormones','recovery','immunity','energy'] as GoalType[], aasStatus:'fertility' as AASStatus, experience:'beginner' as ExperienceLevel, budget:'premium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['reproductive','endocrine','immune'] as string[], targetOrgans:['REPRODUCTIVE','ENDOCRINE','TESTES','PITUITARY'] as string[], maxStackSize: 10, healthConditions:[] as HealthCondition[] }},
    { id:'aas_bridge', icon:'🌉', name:'Бридж / Off-сезон', desc:'Поддержка между курсами: печень, кардио, общее здоровье',
      category:'aas',
      p: { goals:['recovery','liver_health','cardio_health','immunity'] as GoalType[], aasStatus:'bridge' as AASStatus, experience:'intermediate' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['hepatic','cardio','immune','metabolic'] as string[], targetOrgans:['LIVER','HEART','IMMUNE_SYSTEM','KIDNEYS'] as string[], maxStackSize: 8, healthConditions:[] as HealthCondition[] }},
  ];

  const catLabels: Record<string, { label: string; color: string }> = {
    male: { label: '🏋️ ♂ Мужские', color: '#60a5fa' },
    female: { label: '🌸 ♀ Женские', color: '#f472b6' },
    goal: { label: '🎯 По целям', color: '#f59e0b' },
    aas: { label: '💉 По статусу ААС', color: '#ef4444' },
  };
  const catOrder = ['male', 'female', 'goal', 'aas'];

  return <PopupOverlay title="🚀 Быстрые пресеты" icon="🚀" color="#00e68a" onClose={onClose}>
    <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',marginBottom:8,lineHeight:1.3}}>
      Выберите пресет — цели, уровень, системы-мишени и органы заполнятся автоматически. 16 шаблонов в 4 категориях.
    </div>
    <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
      {catOrder.map(cat => {
        const items = presets.filter(p => p.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: catLabels[cat].color, marginBottom: 4, padding: '4px 0', borderBottom: `1px solid ${catLabels[cat].color}15` }}>
              {catLabels[cat].label}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {items.map(pre => (
                <button key={pre.id} onClick={() => { u(pre.p); onClose(); }}
                  style={{ padding:'10px 12px', borderRadius:10, cursor:'pointer', textAlign:'left',
                    background:'rgba(255,255,255,0.015)', border:'1px solid rgba(255,255,255,0.04)',
                    transition:'all 0.15s', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ fontSize:18, flexShrink:0 }}>{pre.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:1 }}>{pre.name}</div>
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', lineHeight:1.3 }}>{pre.desc}</div>
                    <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:2 }}>
                      {(pre.p.goals as GoalType[] || []).slice(0,3).map(g => {
                        const gl = PURE_GOALS.find(x => x.key === g);
                        return gl ? <span key={g} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.06)', color:'#00e68a', whiteSpace:'nowrap' }}>{gl.label.replace(/^.{1,2}\s/, '')}</span> : null;
                      })}
                      {((pre.p.goals as GoalType[])?.length || 0) > 3 && <span style={{ fontSize:6, color:'rgba(255,255,255,0.25)' }}>+{(pre.p.goals as GoalType[]).length - 3}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  </PopupOverlay>;
}

/* ─── Main ProfileTab ─── */
export function ProfileTab({ profile, setProfile, setStackIds }: { profile: BioStackProfile; setProfile: (p: BioStackProfile) => void; setStackIds?: (ids: string[]) => void }) {
  const u = (patch: Partial<BioStackProfile>) => { const n = { ...profile, ...patch }; setProfile(n); saveBioStackProfile(n); };
  const [popup, setPopup] = useState<string | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickDone, setQuickDone] = useState(false);

  const handleQuickStack = () => {
    setQuickLoading(true); setQuickDone(false);
    setTimeout(() => {
      const fp = toFinderProfile(profile);
      const result = buildStack({ baseIds: [], targetSize: 10, goal: profile.goals[0] || undefined, autoFill: true, profile: fp });
      if (setStackIds) setStackIds(result.stack);
      setQuickLoading(false); setQuickDone(true);
      setTimeout(() => setQuickDone(false), 2500);
    }, 400);
  };

  const goalLabel = (g: string) => PURE_GOALS.find(x => x.key === g)?.label || g;
  const organLabel = (o: string) => ORGANS.find(x => x.key === o)?.label || o;
  const systemLabel = (s: string) => SYSTEMS.find(x => x.key === s)?.label || s;

  return (
    <div style={{ paddingBottom: 80 }}>
      <CardBtn icon="👤" title="Личные данные" color="#60a5fa"
        subtitle={`${profile.age} лет · ${profile.weight} кг · ${profile.height} см · ${profile.sex === 'male' ? '♂' : '♀'} · ${profile.experience === 'beginner' ? 'Новичок' : profile.experience === 'intermediate' ? 'Средний' : 'Продвинутый'}`}
        onClick={() => setPopup('personal')} />

      <CardBtn icon="🫀" title="Здоровье" color="#ef4444"
        subtitle={`${profile.bpSystolic}/${profile.bpDiastolic} · ${profile.gutSensitivity === 'normal' ? 'ЖКТ: норма' : profile.gutSensitivity === 'sensitive' ? 'ЖКТ: чувствит.' : 'ЖКТ: проблемный'}${profile.healthConditions.length ? ` · +${profile.healthConditions.length} состояний` : ''}`}
        count={profile.healthConditions.length}
        onClick={() => setPopup('health')} />

      <CardBtn icon="🧠" title="Нейро статус" color="#a78bfa"
        subtitle={`${profile.cognitiveTask === 'memory' ? 'Память' : profile.cognitiveTask === 'focus' ? 'Фокус' : profile.cognitiveTask === 'creativity' ? 'Креативность' : profile.cognitiveTask === 'reaction_speed' ? 'Быстрота реакции' : 'Учёба'} · стресс ${profile.stressLevel}/10 · сон ${profile.sleepQuality}/10`}
        onClick={() => setPopup('neuro')} />

      <CardBtn icon="🌍" title="Образ жизни" color="#22c55e"
        subtitle={`${profile.dietType === 'mixed' ? 'Смешанное' : profile.dietType === 'vegetarian' ? 'Вегетарианство' : profile.dietType === 'vegan' ? 'Веганство' : profile.dietType === 'keto' ? 'Кето' : profile.dietType === 'paleo' ? 'Палео' : 'Средиземноморское'} · ${profile.budget === 'economy' ? 'Эконом' : profile.budget === 'medium' ? 'Средний' : 'Премиум'}`}
        onClick={() => setPopup('lifestyle')} />

      <CardBtn icon="🎯" title="Цели" color="#f59e0b"
        subtitle={profile.goals.length ? profile.goals.map(g => goalLabel(g)).join(', ') : 'Не выбраны'}
        count={profile.goals.length}
        onClick={() => setPopup('goals')} />

      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        <SmallBtn icon="🫀" title="Органы" color="#60a5fa"
          subtitle={`${profile.targetOrgans.length} выбрано`}
          count={profile.targetOrgans.length}
          onClick={() => setPopup('organs')} />
        <SmallBtn icon="⚙️" title="Системы" color="#8b5cf6"
          subtitle={`${profile.targetSystems.length} выбрано`}
          count={profile.targetSystems.length}
          onClick={() => setPopup('systems')} />
        <SmallBtn icon="🔬" title="Механизмы" color="#22c55e"
          subtitle="Топ-15"
          onClick={() => setPopup('mechanisms')} />
      </div>

      <CardBtn icon="💊" title="Текущие БАДы / Избегать" color="#8b5cf6"
        subtitle={profile.currentSupplements.length ? `${profile.currentSupplements.length} БАДов` : 'Не указаны'}
        count={profile.currentSupplements.length}
        onClick={() => setPopup('supplements')} />

      <CardBtn icon="🏥" title="Клинические данные" color="#ef4444"
        subtitle={`${profile.currentMeds.length ? profile.currentMeds.join(', ').slice(0,30)+'...' : 'Нет лекарств'} · CYP: ${profile.cyp450Status === 'unknown' ? '?' : profile.cyp450Status}`}
        count={profile.currentMeds.length}
        onClick={() => setPopup('clinical')} />

      <CardBtn icon="🚀" title="Быстрые пресеты" color="#00e68a"
        subtitle="Заполнить профиль по шаблону: Бодибилдер, ЗОЖ, Ноотроп, Спортсмен..."
        onClick={() => setPopup('presets')} />

      <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
        <button onClick={() => { const filled = autoFillFromMainProfile(); if (Object.keys(filled).length > 0) u(filled); }}
          style={{ width:'100%', padding:'12px 0', borderRadius:14, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:700, fontSize:12,
            boxShadow:'0 4px 20px rgba(0,230,138,0.2)' }}>
          📥 Заполнить из профиля
        </button>
        <button onClick={handleQuickStack} disabled={quickLoading} style={{
          width:'100%', padding:'12px 0', borderRadius:14, cursor: quickLoading ? 'wait' : 'pointer',
          background: quickDone ? 'rgba(0,230,138,0.1)' : 'rgba(139,92,246,0.1)',
          border: `1px solid ${quickDone ? 'rgba(0,230,138,0.2)' : 'rgba(139,92,246,0.2)'}`,
          color: quickDone ? '#00e68a' : '#8b5cf6', fontWeight:700, fontSize:12,
        }}>
          {quickLoading ? '⏳ Собираем стек...' : quickDone ? '✅ Стек собран! Откройте 📋 Мой стек' : '⚡ Быстрый стек по профилю'}
        </button>
      </div>
      <div style={{ textAlign:'center', fontSize:8, color:'rgba(255,255,255,0.25)', marginTop:4 }}>
        ⚡ Профиль сохраняется автоматически
      </div>

      {/* Popups */}
      {popup === 'personal' && <PopupPersonal profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'health' && <PopupHealth profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'neuro' && <PopupNeuro profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'lifestyle' && <PopupLifestyle profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'goals' && <PopupGoals profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'organs' && <PopupOrgans profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'systems' && <PopupSystems profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'mechanisms' && <PopupMechanisms profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'supplements' && <PopupSupplements profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'clinical' && <PopupClinical profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'presets' && <PopupPresets profile={profile} u={u} onClose={() => setPopup(null)} />}
    </div>
  );
}

/* ─── BioStackAISettings — упрощённая версия ProfileTab для ProfileScreen (без пресетов и кнопки быстрого стека) ─── */
export function BioStackAISettings({ onProfileChange }: { onProfileChange?: (p: BioStackProfile) => void }) {
  const [profile, setProfile] = useState<BioStackProfile>(() => loadBioStackProfile());
  const u = (patch: Partial<BioStackProfile>) => {
    const n = { ...profile, ...patch };
    setProfile(n);
    saveBioStackProfile(n);
    if (onProfileChange) onProfileChange(n);
  };
  const [popup, setPopup] = useState<string | null>(null);

  const goalLabel = (g: string) => PURE_GOALS.find(x => x.key === g)?.label || g;

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 8, lineHeight: 1.4 }}>
        🧬 Настройки профиля для BioStack AI. Данные сохраняются автоматически и используются при подборе БАДов.
      </div>
      <CardBtn icon="👤" title="Личные данные" color="#60a5fa"
        subtitle={`${profile.age} лет · ${profile.weight} кг · ${profile.height} см · ${profile.sex === 'male' ? '♂' : '♀'} · ${profile.experience === 'beginner' ? 'Новичок' : profile.experience === 'intermediate' ? 'Средний' : 'Продвинутый'}`}
        onClick={() => setPopup('personal')} />
      <CardBtn icon="🫀" title="Здоровье" color="#ef4444"
        subtitle={`${profile.bpSystolic}/${profile.bpDiastolic} · ${profile.gutSensitivity === 'normal' ? 'ЖКТ: норма' : profile.gutSensitivity === 'sensitive' ? 'ЖКТ: чувствит.' : 'ЖКТ: проблемный'}${profile.healthConditions.length ? ` · +${profile.healthConditions.length} состояний` : ''}`}
        count={profile.healthConditions.length}
        onClick={() => setPopup('health')} />
      <CardBtn icon="🧠" title="Нейро статус" color="#a78bfa"
        subtitle={`${profile.cognitiveTask === 'memory' ? 'Память' : profile.cognitiveTask === 'focus' ? 'Фокус' : profile.cognitiveTask === 'creativity' ? 'Креативность' : profile.cognitiveTask === 'reaction_speed' ? 'Быстрота реакции' : 'Учёба'} · стресс ${profile.stressLevel}/10 · сон ${profile.sleepQuality}/10`}
        onClick={() => setPopup('neuro')} />
      <CardBtn icon="🌍" title="Образ жизни" color="#22c55e"
        subtitle={`${profile.dietType === 'mixed' ? 'Смешанное' : profile.dietType === 'vegetarian' ? 'Вегетарианство' : profile.dietType === 'vegan' ? 'Веганство' : profile.dietType === 'keto' ? 'Кето' : profile.dietType === 'paleo' ? 'Палео' : 'Средиземноморское'} · ${profile.budget === 'economy' ? 'Эконом' : profile.budget === 'medium' ? 'Средний' : 'Премиум'}`}
        onClick={() => setPopup('lifestyle')} />
      <CardBtn icon="🎯" title="Цели" color="#f59e0b"
        subtitle={profile.goals.length ? profile.goals.map(g => goalLabel(g)).join(', ') : 'Не выбраны'}
        count={profile.goals.length}
        onClick={() => setPopup('goals')} />
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        <SmallBtn icon="🫀" title="Органы" color="#60a5fa"
          subtitle={`${profile.targetOrgans.length} выбрано`}
          count={profile.targetOrgans.length}
          onClick={() => setPopup('organs')} />
        <SmallBtn icon="⚙️" title="Системы" color="#8b5cf6"
          subtitle={`${profile.targetSystems.length} выбрано`}
          count={profile.targetSystems.length}
          onClick={() => setPopup('systems')} />
        <SmallBtn icon="🔬" title="Механизмы" color="#22c55e"
          subtitle="Топ-15"
          onClick={() => setPopup('mechanisms')} />
      </div>
      <CardBtn icon="💊" title="Текущие БАДы / Избегать" color="#8b5cf6"
        subtitle={profile.currentSupplements.length ? `${profile.currentSupplements.length} БАДов` : 'Не указаны'}
        count={profile.currentSupplements.length}
        onClick={() => setPopup('supplements')} />
      <CardBtn icon="🏥" title="Клинические данные" color="#ef4444"
        subtitle={`${profile.currentMeds.length ? profile.currentMeds.join(', ').slice(0,30)+'...' : 'Нет лекарств'} · CYP: ${profile.cyp450Status === 'unknown' ? '?' : profile.cyp450Status}`}
        count={profile.currentMeds.length}
        onClick={() => setPopup('clinical')} />
      <div style={{ textAlign:'center', fontSize:8, color:'rgba(255,255,255,0.25)', marginTop:4 }}>
        ⚡ Профиль BioStack сохраняется автоматически
      </div>
      {popup === 'personal' && <PopupPersonal profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'health' && <PopupHealth profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'neuro' && <PopupNeuro profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'lifestyle' && <PopupLifestyle profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'goals' && <PopupGoals profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'organs' && <PopupOrgans profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'systems' && <PopupSystems profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'mechanisms' && <PopupMechanisms profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'supplements' && <PopupSupplements profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'clinical' && <PopupClinical profile={profile} u={u} onClose={() => setPopup(null)} />}
    </div>
  );
}
