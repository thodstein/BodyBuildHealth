import React, { useState } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { autoFillFromMainProfile, saveBioStackProfile, loadBioStackProfile, getProfileCompleteness, type ProfileCompleteness } from '../../engines/biostack-ai.engine';
import { buildStack } from '../../engines/supplement-finder.engine';
import { PillBtn, Slider, toFinderProfile, PURE_GOALS, ORGANS, SYSTEMS, HEALTH_CONDS, TOP_MECHANISMS } from './BioStackAIConstants';
import { type GoalType, type AASStatus, type BudgetLevel, type StackComplexity, type ExperienceLevel, type HealthCondition, type ADClass, type BioStackProfile as BSP } from '../../engines/biostack-ai.engine';
import { OnboardingWizard } from './BioStackAIOnboarding';

/* ─── Popup Overlay ─── */
function PopupOverlay({ title, icon, color, children, onClose }: { title: string; icon: string; color: string; children: React.ReactNode; onClose: () => void }) {
  return <div style={{ position:'fixed', inset:0, zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.87)' }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, maxHeight:'80vh', borderRadius:14, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
      <div style={{ height:3, background:`linear-gradient(90deg, ${color}, ${color}66, transparent)` }} />
      <div style={{ padding:'12px 14px', maxHeight:'calc(80vh - 3px)', overflowY:'auto' }}>
        <div style={{ fontSize:13, fontWeight:700, color, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
          <span>{icon}</span>{title}
        </div>
        {children}
        <button onClick={onClose} style={{ width:'100%', padding:'8px 0', borderRadius:8, marginTop:8, cursor:'pointer', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.4)', fontSize:9, fontWeight:600 }}>
          Закрыть
        </button>
      </div>
    </div>
  </div>;
}

/* ─── Source Badge ─── */
function SourceBadge({ source }: { source: 'auto' | 'manual' | 'empty' }) {
  if (source === 'empty') return null;
  return <span style={{
    fontSize: 6.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
    background: source === 'auto' ? 'rgba(0,230,138,0.1)' : 'rgba(139,92,246,0.1)',
    color: source === 'auto' ? '#00e68a' : '#8b5cf6',
    border: `1px solid ${source === 'auto' ? 'rgba(0,230,138,0.2)' : 'rgba(139,92,246,0.2)'}`,
  }}>{source === 'auto' ? '🔄 Авто' : '✋ Вручную'}</span>;
}

/* ─── Data Chip ─── */
function DataChip({ children, color, dim }: { children: React.ReactNode; color?: string; dim?: boolean }) {
  return <span style={{
    fontSize: 8.5, padding: '3px 8px', borderRadius: 6, fontWeight: 600,
    background: dim ? 'rgba(255,255,255,0.04)' : `${color || '#60a5fa'}15`,
    color: dim ? 'rgba(255,255,255,0.5)' : (color || '#fff'),
    border: `1px solid ${dim ? 'rgba(255,255,255,0.06)' : `${color || '#60a5fa'}22`}`,
    whiteSpace: 'nowrap',
  }}>{children}</span>;
}

/* ─── Summary Card (read-only display for filled groups) ─── */
function SummaryCard({ icon, title, color, source, children, onEdit }: {
  icon: string; title: string; color: string; source: 'auto' | 'manual' | 'empty';
  children: React.ReactNode; onEdit: () => void;
}) {
  const stripeColor = source === 'auto' ? '#00e68a' : '#8b5cf6';
  return <div style={{
    padding: '10px 12px', borderRadius: 10, marginBottom: 5,
    background: 'rgba(24,24,27,0.7)', border: `1px solid rgba(255,255,255,0.05)`,
    borderLeft: `3px solid ${stripeColor}`,
  }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: children ? 6 : 0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{title}</span>
        <SourceBadge source={source} />
      </div>
      <button onClick={onEdit} style={{
        padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
        background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', fontSize: 8,
        fontWeight: 600,
      }}>✏️ Изменить</button>
    </div>
    {children ? <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:4 }}>{children}</div> : null}
  </div>;
}

/* ─── Completeness Bar ─── */
function ProfileCompletenessBar({ comp }: { comp: ProfileCompleteness }) {
  const barColor = comp.percent >= 80 ? '#00e68a' : comp.percent >= 50 ? '#f59e0b' : '#ef4444';
  return <div style={{
    padding: '10px 12px', borderRadius: 10, marginBottom: 6,
    background: 'rgba(24,24,27,0.7)', border: '1px solid rgba(255,255,255,0.05)',
  }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 4 }}>
      <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>🧬</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>Профиль BioStack</span>
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color: barColor }}>{comp.percent}%</span>
    </div>
    <div style={{
      height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.05)', marginBottom: 4,
      overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', borderRadius: 3, width: `${comp.percent}%`,
        background: `linear-gradient(90deg, ${barColor}, ${barColor}88)`,
        transition: 'width 0.3s',
      }} />
    </div>
    <div style={{ display:'flex', gap: 8, fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>
      <span style={{ display:'flex', alignItems:'center', gap: 3 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: '#00e68a', display:'inline-block' }} />
        🔄 {comp.autoFilledCount} из профиля
      </span>
      <span style={{ display:'flex', alignItems:'center', gap: 3 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: '#8b5cf6', display:'inline-block' }} />
        ✋ {comp.manualFilledCount} вручную
      </span>
      <span style={{ display:'flex', alignItems:'center', gap: 3 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: '#f59e0b', display:'inline-block' }} />
        ⚠ {comp.totalFields - comp.filledFields} не заполнено
      </span>
    </div>
  </div>;
}

/* ─── Card Button ─── */
function CardBtn({ icon, title, subtitle, color, onClick, count, badge }: {
  icon: string; title: string; subtitle?: string; color: string; onClick: () => void; count?: number;
  badge?: { text: string; source: 'auto' | 'manual' | 'empty' };
}) {
  const badgeColor = badge?.source === 'auto' ? '#00e68a' : badge?.source === 'manual' ? '#8b5cf6' : '#f59e0b';
  return <button onClick={onClick} style={{
    width:'100%', padding:'10px 12px', borderRadius:10, cursor:'pointer', textAlign:'left',
    background:'rgba(24,24,27,0.7)', border:'1px solid rgba(255,255,255,0.06)', marginBottom:5,
    transition:'all 0.15s',
    display:'flex', alignItems:'center', gap:8,
  }}>
    <div style={{ width:32, height:32, borderRadius:10, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>
      {icon}
    </div>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:1, display:'flex', alignItems:'center', gap:6 }}>
        {title}
        {badge && <span style={{ fontSize: 6.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}28` }}>{badge.text}</span>}
      </div>
      {subtitle && <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{subtitle}</div>}
    </div>
    {count !== undefined && count > 0 && <div style={{ padding:'2px 6px', borderRadius:8, background:`${color}20`, color, fontSize:8, fontWeight:700 }}>{count}</div>}
    <div style={{ fontSize:9, color:'rgba(255,255,255,0.2)' }}>›</div>
  </button>;
}

function SmallBtn({ icon, title, subtitle, color, onClick, count }: { icon: string; title: string; subtitle?: string; color: string; onClick: () => void; count?: number }) {
  return <button onClick={onClick} style={{
    flex:1, padding:'8px 6px', borderRadius:10, cursor:'pointer', textAlign:'center',
    background:'rgba(24,24,27,0.7)', border:'1px solid rgba(255,255,255,0.06)',
    transition:'all 0.15s',
  }}>
    <div style={{ fontSize:14, marginBottom:2 }}>{icon}</div>
    <div style={{ fontSize:8, fontWeight:700, color:'#fff', marginBottom:1 }}>{title}</div>
    {subtitle && <div style={{ fontSize:6, color:'rgba(255,255,255,0.35)' }}>{subtitle}</div>}
    {count !== undefined && <div style={{ marginTop:1, padding:'1px 5px', borderRadius:6, background:`${color}20`, color, fontSize:7, fontWeight:700, display:'inline-block' }}>{count}</div>}
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

/* ─── Popup: Здоровье (aasStatus + healthConditions + budget + stackComplexity) ─── */
function PopupHealth({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const [aas, setAas] = useState(profile.aasStatus);
  const [budget, setBudget] = useState(profile.budget);
  const [compl, setCompl] = useState(profile.stackComplexity);
  const [conds, setConds] = useState<typeof profile.healthConditions>([...profile.healthConditions]);
  const save = () => { u({ aasStatus: aas, healthConditions: conds, budget, stackComplexity: compl }); onClose(); };
  return <PopupOverlay title="Здоровье и режим" icon="🫀" color="#ef4444" onClose={onClose}>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:6 }}>
      <select value={aas} onChange={e => setAas(e.target.value as AASStatus)}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="none">✖ Без ААС</option><option value="trt">💉 TRT</option><option value="course">💊 Курс</option><option value="pct">🔄 ПКТ</option>
        <option value="bridge">🌉 Бридж</option><option value="fertility">🧬 Фертильность</option>
      </select>
      <select value={budget} onChange={e => setBudget(e.target.value as BudgetLevel)}
        style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="economy">💰 Эконом</option><option value="medium">💵 Средний</option><option value="premium">💎 Премиум</option>
      </select>
    </div>
    <div style={{marginBottom:6}}>
      <select value={compl} onChange={e => setCompl(e.target.value as StackComplexity)}
        style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
        <option value="minimal">🔵 Минимальный стек (3-5 БАДов)</option><option value="balanced">🟢 Средний стек (5-10)</option><option value="maximum">🔴 Максимальный (10-20)</option>
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

/* ─── Popup: Текущие БАДы / Избегать ─── */
function PopupSupplements({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const [avoid, setAvoid] = useState(profile.avoidIds.join(', '));
  const save = () => { u({ avoidIds: avoid.split(',').map(s=>s.trim()).filter(Boolean) }); onClose(); };
  return <PopupOverlay title="Избегать препараты" icon="💊" color="#8b5cf6" onClose={onClose}>
    <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',marginBottom:8,lineHeight:1.3}}>
      Укажите id БАДов (через запятую), которые нужно исключить из подбора. Например: yohimbine, huperzine_a, dmaa
    </div>
    <div style={{marginBottom:8}}>
      <label style={{fontSize:8,color:'rgba(255,255,255,0.5)',marginBottom:2,display:'block'}}>🔴 Исключить из подбора:</label>
      <input value={avoid} onChange={e => setAvoid(e.target.value)} placeholder="yohimbine, huperzine_a, dmaa"
        style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:11,boxSizing:'border-box'}} />
    </div>
    <button onClick={save} style={{width:'100%',padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#8b5cf6,#7c3aed)',color:'#fff',fontWeight:700,fontSize:12}}>✅ Применить</button>
  </PopupOverlay>;
}

/* ─── Popup: Клинические данные (currentMeds + drugAllergies + adClass) ─── */
function PopupClinical({ profile, u, onClose }: { profile: BioStackProfile; u: (p: Partial<BioStackProfile>) => void; onClose: () => void }) {
  const [meds, setMeds] = useState(profile.currentMeds.join(', '));
  const [allergies, setAllergies] = useState(profile.drugAllergies.join(', '));
  const [ad, setAd] = useState(profile.adClass);
  const save = () => {
    u({
      currentMeds: meds.split(',').map(s=>s.trim()).filter(Boolean),
      drugAllergies: allergies.split(',').map(s=>s.trim()).filter(Boolean),
      adClass: ad,
    });
    onClose();
  };
  return <PopupOverlay title="Клинические данные" icon="🏥" color="#ef4444" onClose={onClose}>
    <div style={{marginBottom:6}}>
      <label style={{fontSize:8,color:'rgba(255,255,255,0.5)',display:'block',marginBottom:2}}>💊 Лекарства (МНН, через запятую):</label>
      <input value={meds} onChange={e=>setMeds(e.target.value)} placeholder="варфарин, метформин, аторвастатин..."
        style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,boxSizing:'border-box'}} />
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:6}}>
      <div>
        <label style={{fontSize:8,color:'rgba(255,255,255,0.5)',display:'block',marginBottom:2}}>⚠ Аллергии:</label>
        <input value={allergies} onChange={e=>setAllergies(e.target.value)} placeholder="пенициллин..."
          style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,boxSizing:'border-box'}} />
      </div>
      <div>
        <label style={{fontSize:8,color:'rgba(255,255,255,0.5)',display:'block',marginBottom:2}}>💊 Антидепрессанты:</label>
        <select value={ad} onChange={e=>setAd(e.target.value as ADClass)}
          style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none'}}>
          <option value="none">✖ Нет</option><option value="ssri">💊 СИОЗС</option><option value="snri">💊 СИОЗСиН</option>
          <option value="maoi">💊 ИМАО</option><option value="tca">💊 ТЦА</option><option value="other">💊 Другие</option>
        </select>
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
    { id:'male_bodybuilder', icon:'🏋️', name:'Бодибилдер', desc:'Рост массы и силы. Полный стек поддержки для тяжёлых тренировок',
      category:'male',
      p: { goals:['muscle_gain','recovery','joints'] as GoalType[], experience:'advanced' as ExperienceLevel, budget:'premium' as BudgetLevel, stackComplexity:'maximum' as StackComplexity, targetSystems:['musculoskeletal','endocrine','cardio'] as string[], targetOrgans:['MUSCLES','BONES','JOINTS','HEART','LIVER'] as string[], maxStackSize: 20 }},
    { id:'male_athlete', icon:'🏃', name:'Спортсмен', desc:'Выносливость, кардио, восстановление между тренировками',
      category:'male',
      p: { goals:['endurance','recovery','energy','cardio_health'] as GoalType[], experience:'advanced' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['cardio','musculoskeletal','metabolic'] as string[], targetOrgans:['HEART','VESSELS','MUSCLES','LUNGS'] as string[], maxStackSize: 12 }},
    { id:'male_hormonal', icon:'⚖️', name:'Гормональный баланс', desc:'Поддержка тестостерона, либидо, щитовидной железы',
      category:'male',
      p: { goals:['hormones','libido','energy','sleep'] as GoalType[], experience:'intermediate' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['endocrine','reproductive','neuro'] as string[], targetOrgans:['ENDOCRINE','REPRODUCTIVE','THYROID','ADRENALS'] as string[], maxStackSize: 8 }},
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
    { id:'goal_nootropic', icon:'🧠', name:'Ноотроп / Фокус', desc:'Память, концентрация, креативность, нейропластичность',
      category:'goal',
      p: { goals:['brain','concentration','mood','energy'] as GoalType[], experience:'beginner' as ExperienceLevel, budget:'premium' as BudgetLevel, stackComplexity:'minimal' as StackComplexity, targetSystems:['neuro'] as string[], targetOrgans:['BRAIN','NERVES'] as string[], maxStackSize: 6 }},
    { id:'goal_immunity', icon:'🛡️', name:'Иммунитет', desc:'Укрепление защитных сил, профилактика, адаптогены',
      category:'goal',
      p: { goals:['immunity','recovery','energy'] as GoalType[], experience:'beginner' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['immune','metabolic'] as string[], targetOrgans:['IMMUNE_SYSTEM','BLOOD','GUT'] as string[], maxStackSize: 8 }},
    { id:'goal_detox', icon:'🧪', name:'Детокс + Печень', desc:'Очищение организма, поддержка печени, антиоксиданты',
      category:'goal',
      p: { goals:['detox','liver_health','digestion'] as GoalType[], experience:'intermediate' as ExperienceLevel, budget:'medium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['hepatic','gastrointestinal','immune'] as string[], targetOrgans:['LIVER','GUT','KIDNEYS'] as string[], maxStackSize: 8, healthConditions:['liver'] as HealthCondition[] }},
    { id:'goal_longevity', icon:'⏳', name:'Долголетие', desc:'Митохондрии, омега-3, антиоксиданты, кардиопротекция',
      category:'goal',
      p: { goals:['longevity','cardio_health','brain','energy'] as GoalType[], experience:'intermediate' as ExperienceLevel, budget:'premium' as BudgetLevel, stackComplexity:'balanced' as StackComplexity, targetSystems:['cardio','neuro','metabolic','immune'] as string[], targetOrgans:['HEART','BRAIN','MITOCHONDRIA','CELLS','VESSELS'] as string[], maxStackSize: 10 }},
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
      Выберите пресет — цели, уровень, системы-мишени и органы заполнятся автоматически. 15 шаблонов в 4 категориях.
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

/* ─── Helpers for display ─── */
function aasLabel(s: AASStatus): string {
  return s === 'none' ? 'Без ААС' : s === 'trt' ? 'TRT' : s === 'course' ? 'Курс' : s === 'pct' ? 'ПКТ' : s === 'bridge' ? 'Бридж' : 'Фертильность';
}
function budgetLabel(b: BudgetLevel): string {
  return b === 'economy' ? 'Эконом' : b === 'medium' ? 'Средний' : 'Премиум';
}
function complLabel(c: StackComplexity): string {
  return c === 'minimal' ? 'Мин' : c === 'balanced' ? 'Средний' : 'Макс';
}
function expLabel(e: ExperienceLevel): string {
  return e === 'beginner' ? 'Новичок' : e === 'intermediate' ? 'Средний' : 'Продвинутый';
}
function adLabel(a: ADClass): string {
  return a === 'none' ? 'Нет' : a.toUpperCase();
}

/* ─── Main ProfileTab ─── */
export function ProfileTab({ profile, setProfile, setStackIds }: { profile: BioStackProfile; setProfile: (p: BioStackProfile) => void; setStackIds?: (ids: string[]) => void }) {
  const u = (patch: Partial<BioStackProfile>) => {
    const editedKeys = Object.keys(patch).filter(k => k !== 'autoFilledFields');
    const newAuto = (profile.autoFilledFields || []).filter(k => !editedKeys.includes(k));
    const n = { ...profile, ...patch, autoFilledFields: newAuto };
    setProfile(n); saveBioStackProfile(n);
  };
  const [popup, setPopup] = useState<string | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickDone, setQuickDone] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const comp = getProfileCompleteness(profile);
  const goalLabel = (g: string) => PURE_GOALS.find(x => x.key === g)?.label || g;
  const organLabel = (o: string) => ORGANS.find(x => x.key === o)?.label || o;
  const systemLabel = (s: string) => SYSTEMS.find(x => x.key === s)?.label || s;
  const condLabel = (h: string) => HEALTH_CONDS.find(x => x.key === h)?.label || h;

  const handleAutoFill = () => {
    const { patch, autoKeys } = autoFillFromMainProfile();
    if (Object.keys(patch).length > 0) {
      const n = { ...profile, ...patch, autoFilledFields: [...new Set([...(profile.autoFilledFields || []), ...autoKeys])] };
      setProfile(n); saveBioStackProfile(n);
    }
  };

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

  return (
    <div style={{ paddingBottom: 80 }}>
      <button onClick={() => setShowOnboarding(true)} style={{
        width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 6,
        background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 800, fontSize: 11,
        boxShadow: '0 2px 12px rgba(0,230,138,0.15)',
      }}>🧭 Быстрый старт — заполнить профиль за 3 шага</button>

      {showOnboarding && (
        <OnboardingWizard profile={profile}
          onComplete={(patch, autoBuild) => {
            u(patch);
            if (autoBuild && setStackIds) {
              setTimeout(() => {
                const fp = toFinderProfile({ ...profile, ...patch });
                const result = buildStack({ baseIds: [], targetSize: 8, autoFill: true, profile: fp });
                setStackIds(result.stack);
              }, 300);
            }
            setShowOnboarding(false);
          }}
          onSkip={() => setShowOnboarding(false)}
        />
      )}

      {!showOnboarding && (<>
      {/* ── Progress bar ── */}
      <ProfileCompletenessBar comp={comp} />

      {/* ── Personal ── */}
      {comp.groupStatus.personal?.filled ? (
        <SummaryCard icon="👤" title="Личные данные" color="#60a5fa" source={comp.groupStatus.personal.source} onEdit={() => setPopup('personal')}>
          <DataChip color="#60a5fa">{profile.age} лет</DataChip>
          <DataChip color="#60a5fa">{profile.weight} кг</DataChip>
          <DataChip color="#60a5fa">{profile.height} см</DataChip>
          <DataChip color={profile.sex === 'male' ? '#60a5fa' : '#f472b6'}>{profile.sex === 'male' ? '♂' : '♀'}</DataChip>
          <DataChip color="#60a5fa">{expLabel(profile.experience)}</DataChip>
        </SummaryCard>
      ) : (
        <CardBtn icon="👤" title="Личные данные" color="#60a5fa"
          subtitle={`${profile.age} лет · ${profile.weight} кг · ${profile.height} см · ${profile.sex === 'male' ? '♂' : '♀'} · ${expLabel(profile.experience)}`}
          onClick={() => setPopup('personal')}
          badge={{ text: '⚠ Заполнить', source: 'empty' }} />
      )}

      {/* ── Health ── */}
      {comp.groupStatus.health?.filled ? (
        <SummaryCard icon="🫀" title="Здоровье и режим" color="#ef4444" source={comp.groupStatus.health.source} onEdit={() => setPopup('health')}>
          <DataChip color="#ef4444">{aasLabel(profile.aasStatus)}</DataChip>
          <DataChip color="#ef4444">{budgetLabel(profile.budget)}</DataChip>
          <DataChip color="#ef4444">{complLabel(profile.stackComplexity)} стек</DataChip>
          {profile.healthConditions.map(h => (
            <DataChip key={h} color="#f87171">{condLabel(h)}</DataChip>
          ))}
        </SummaryCard>
      ) : (
        <CardBtn icon="🫀" title="Здоровье и режим" color="#ef4444"
          subtitle={`${aasLabel(profile.aasStatus)} · ${budgetLabel(profile.budget)} · ${complLabel(profile.stackComplexity)} стек`}
          count={profile.healthConditions.length}
          onClick={() => setPopup('health')}
          badge={{ text: '⚠ Заполнить', source: 'empty' }} />
      )}

      {/* ── Goals ── */}
      {comp.groupStatus.goals?.filled ? (
        <SummaryCard icon="🎯" title="Цели" color="#f59e0b" source={comp.groupStatus.goals.source} onEdit={() => setPopup('goals')}>
          {profile.goals.map(g => (
            <DataChip key={g} color="#f59e0b">{goalLabel(g)}</DataChip>
          ))}
        </SummaryCard>
      ) : (
        <CardBtn icon="🎯" title="Цели" color="#f59e0b"
          subtitle={profile.goals.length ? profile.goals.map(g => goalLabel(g)).join(', ') : 'Не выбраны'}
          count={profile.goals.length}
          onClick={() => setPopup('goals')}
          badge={{ text: '⚠ Заполнить', source: 'empty' }} />
      )}

      {/* ── Organs + Systems row ── */}
      {comp.groupStatus.organs?.filled && comp.groupStatus.systems?.filled ? (
        <div style={{ display:'flex', gap:4, marginBottom:5 }}>
          <div style={{ flex:1 }}>
            <div style={{
              padding: '8px 10px', borderRadius: 10,
              background: 'rgba(24,24,27,0.7)', border: `1px solid rgba(255,255,255,0.05)`,
              borderLeft: `3px solid ${comp.groupStatus.organs.source === 'auto' ? '#00e68a' : '#8b5cf6'}`,
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>🫀 Органы</span>
                <div style={{ display:'flex', gap: 3, alignItems:'center' }}>
                  <SourceBadge source={comp.groupStatus.organs.source} />
                  <button onClick={() => setPopup('organs')} style={{ padding:'2px 6px', borderRadius: 4, border:'none', cursor:'pointer', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.35)', fontSize:7 }}>✏️</button>
                </div>
              </div>
              <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                {profile.targetOrgans.map(o => <DataChip key={o} color="#60a5fa">{organLabel(o)}</DataChip>)}
              </div>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{
              padding: '8px 10px', borderRadius: 10,
              background: 'rgba(24,24,27,0.7)', border: `1px solid rgba(255,255,255,0.05)`,
              borderLeft: `3px solid ${comp.groupStatus.systems.source === 'auto' ? '#00e68a' : '#8b5cf6'}`,
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>⚙️ Системы</span>
                <div style={{ display:'flex', gap: 3, alignItems:'center' }}>
                  <SourceBadge source={comp.groupStatus.systems.source} />
                  <button onClick={() => setPopup('systems')} style={{ padding:'2px 6px', borderRadius: 4, border:'none', cursor:'pointer', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.35)', fontSize:7 }}>✏️</button>
                </div>
              </div>
              <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                {profile.targetSystems.map(s => <DataChip key={s} color="#8b5cf6">{systemLabel(s)}</DataChip>)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', gap:4, marginBottom:5 }}>
          <SmallBtn icon="🫀" title="Органы" color="#60a5fa"
            subtitle={`${profile.targetOrgans.length} выбрано`}
            count={profile.targetOrgans.length}
            onClick={() => setPopup('organs')} />
          <SmallBtn icon="⚙️" title="Системы" color="#8b5cf6"
            subtitle={`${profile.targetSystems.length} выбрано`}
            count={profile.targetSystems.length}
            onClick={() => setPopup('systems')} />
        </div>
      )}

      {/* ── Avoid ── */}
      {comp.groupStatus.avoid?.filled ? (
        <SummaryCard icon="💊" title="Исключить БАДы" color="#8b5cf6" source={comp.groupStatus.avoid.source} onEdit={() => setPopup('supplements')}>
          {profile.avoidIds.map(a => (
            <DataChip key={a} color="#a78bfa" dim>{a}</DataChip>
          ))}
        </SummaryCard>
      ) : (
        <CardBtn icon="💊" title="Исключить БАДы" color="#8b5cf6"
          subtitle={profile.avoidIds.length ? `${profile.avoidIds.length} исключено` : 'Не заданы'}
          count={profile.avoidIds.length}
          onClick={() => setPopup('supplements')}
          badge={profile.avoidIds.length === 0 ? { text: 'Не заданы', source: 'empty' } : undefined} />
      )}

      {/* ── Clinical ── */}
      {comp.groupStatus.clinical?.filled ? (
        <SummaryCard icon="🏥" title="Клинические данные" color="#ef4444" source={comp.groupStatus.clinical.source} onEdit={() => setPopup('clinical')}>
          {profile.currentMeds.map(m => <DataChip key={m} color="#f87171">💊 {m}</DataChip>)}
          {profile.drugAllergies.map(a => <DataChip key={a} color="#fca5a5" dim>⚠ {a}</DataChip>)}
          {profile.adClass !== 'none' && <DataChip color="#ef4444">АД: {adLabel(profile.adClass)}</DataChip>}
        </SummaryCard>
      ) : (
        <CardBtn icon="🏥" title="Клинические данные" color="#ef4444"
          subtitle={`${profile.currentMeds.length ? profile.currentMeds.join(', ').slice(0,30)+(profile.currentMeds.length>1?'...':'') : 'Нет лекарств'}${profile.adClass !== 'none' ? ` · ${adLabel(profile.adClass)}` : ''}`}
          count={profile.currentMeds.length}
          onClick={() => setPopup('clinical')}
          badge={{ text: 'Не заполнено', source: 'empty' }} />
      )}

      <CardBtn icon="🚀" title="Быстрые пресеты" color="#00e68a"
        subtitle="Заполнить профиль по шаблону: Бодибилдер, ЗОЖ, Ноотроп, Спортсмен..."
        onClick={() => setPopup('presets')} />

      <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:4 }}>
        <button onClick={handleAutoFill}
          style={{ width:'100%', padding:'10px 0', borderRadius:10, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:700, fontSize:11,
            boxShadow:'0 2px 12px rgba(0,230,138,0.15)' }}>
          📥 Заполнить из профиля
        </button>
        <button onClick={handleQuickStack} disabled={quickLoading} style={{
          width:'100%', padding:'10px 0', borderRadius:10, cursor: quickLoading ? 'wait' : 'pointer',
          background: quickDone ? 'rgba(0,230,138,0.1)' : 'rgba(139,92,246,0.1)',
          border: `1px solid ${quickDone ? 'rgba(0,230,138,0.2)' : 'rgba(139,92,246,0.2)'}`,
          color: quickDone ? '#00e68a' : '#8b5cf6', fontWeight:700, fontSize:11,
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
      {popup === 'goals' && <PopupGoals profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'organs' && <PopupOrgans profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'systems' && <PopupSystems profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'supplements' && <PopupSupplements profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'clinical' && <PopupClinical profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'presets' && <PopupPresets profile={profile} u={u} onClose={() => setPopup(null)} />}
      </>)}
    </div>
  );
}

/* ─── BioStackAISettings — упрощённая версия ProfileTab для ProfileScreen (без пресетов и кнопки быстрого стека) ─── */
export function BioStackAISettings({ onProfileChange }: { onProfileChange?: (p: BioStackProfile) => void }) {
  const [profile, setProfile] = useState<BioStackProfile>(() => loadBioStackProfile());
  const u = (patch: Partial<BioStackProfile>) => {
    const editedKeys = Object.keys(patch).filter(k => k !== 'autoFilledFields');
    const newAuto = (profile.autoFilledFields || []).filter(k => !editedKeys.includes(k));
    const n = { ...profile, ...patch, autoFilledFields: newAuto };
    setProfile(n);
    saveBioStackProfile(n);
    if (onProfileChange) onProfileChange(n);
  };
  const [popup, setPopup] = useState<string | null>(null);

  const comp = getProfileCompleteness(profile);
  const goalLabel = (g: string) => PURE_GOALS.find(x => x.key === g)?.label || g;
  const organLabel = (o: string) => ORGANS.find(x => x.key === o)?.label || o;
  const systemLabel = (s: string) => SYSTEMS.find(x => x.key === s)?.label || s;
  const condLabel = (h: string) => HEALTH_CONDS.find(x => x.key === h)?.label || h;

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 8, lineHeight: 1.4 }}>
        🧬 Настройки профиля для BioStack AI. Данные сохраняются автоматически и используются при подборе БАДов.
      </div>

      {/* ── Progress bar ── */}
      <ProfileCompletenessBar comp={comp} />

      {/* ── Personal ── */}
      {comp.groupStatus.personal?.filled ? (
        <SummaryCard icon="👤" title="Личные данные" color="#60a5fa" source={comp.groupStatus.personal.source} onEdit={() => setPopup('personal')}>
          <DataChip color="#60a5fa">{profile.age} лет</DataChip>
          <DataChip color="#60a5fa">{profile.weight} кг</DataChip>
          <DataChip color="#60a5fa">{profile.height} см</DataChip>
          <DataChip color={profile.sex === 'male' ? '#60a5fa' : '#f472b6'}>{profile.sex === 'male' ? '♂' : '♀'}</DataChip>
          <DataChip color="#60a5fa">{expLabel(profile.experience)}</DataChip>
        </SummaryCard>
      ) : (
        <CardBtn icon="👤" title="Личные данные" color="#60a5fa"
          subtitle={`${profile.age} лет · ${profile.weight} кг · ${profile.height} см · ${profile.sex === 'male' ? '♂' : '♀'} · ${expLabel(profile.experience)}`}
          onClick={() => setPopup('personal')}
          badge={{ text: '⚠ Заполнить', source: 'empty' }} />
      )}

      {/* ── Health ── */}
      {comp.groupStatus.health?.filled ? (
        <SummaryCard icon="🫀" title="Здоровье и режим" color="#ef4444" source={comp.groupStatus.health.source} onEdit={() => setPopup('health')}>
          <DataChip color="#ef4444">{aasLabel(profile.aasStatus)}</DataChip>
          <DataChip color="#ef4444">{budgetLabel(profile.budget)}</DataChip>
          <DataChip color="#ef4444">{complLabel(profile.stackComplexity)} стек</DataChip>
          {profile.healthConditions.map(h => (
            <DataChip key={h} color="#f87171">{condLabel(h)}</DataChip>
          ))}
        </SummaryCard>
      ) : (
        <CardBtn icon="🫀" title="Здоровье и режим" color="#ef4444"
          subtitle={`${aasLabel(profile.aasStatus)} · ${budgetLabel(profile.budget)} · ${complLabel(profile.stackComplexity)} стек`}
          count={profile.healthConditions.length}
          onClick={() => setPopup('health')}
          badge={{ text: '⚠ Заполнить', source: 'empty' }} />
      )}

      {/* ── Goals ── */}
      {comp.groupStatus.goals?.filled ? (
        <SummaryCard icon="🎯" title="Цели" color="#f59e0b" source={comp.groupStatus.goals.source} onEdit={() => setPopup('goals')}>
          {profile.goals.map(g => (
            <DataChip key={g} color="#f59e0b">{goalLabel(g)}</DataChip>
          ))}
        </SummaryCard>
      ) : (
        <CardBtn icon="🎯" title="Цели" color="#f59e0b"
          subtitle={profile.goals.length ? profile.goals.map(g => goalLabel(g)).join(', ') : 'Не выбраны'}
          count={profile.goals.length}
          onClick={() => setPopup('goals')}
          badge={{ text: '⚠ Заполнить', source: 'empty' }} />
      )}

      {/* ── Organs + Systems row ── */}
      {comp.groupStatus.organs?.filled && comp.groupStatus.systems?.filled ? (
        <div style={{ display:'flex', gap:4, marginBottom:5 }}>
          <div style={{ flex:1 }}>
            <div style={{
              padding: '8px 10px', borderRadius: 10,
              background: 'rgba(24,24,27,0.7)', border: `1px solid rgba(255,255,255,0.05)`,
              borderLeft: `3px solid ${comp.groupStatus.organs.source === 'auto' ? '#00e68a' : '#8b5cf6'}`,
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>🫀 Органы</span>
                <div style={{ display:'flex', gap: 3, alignItems:'center' }}>
                  <SourceBadge source={comp.groupStatus.organs.source} />
                  <button onClick={() => setPopup('organs')} style={{ padding:'2px 6px', borderRadius: 4, border:'none', cursor:'pointer', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.35)', fontSize:7 }}>✏️</button>
                </div>
              </div>
              <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                {profile.targetOrgans.map(o => <DataChip key={o} color="#60a5fa">{organLabel(o)}</DataChip>)}
              </div>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{
              padding: '8px 10px', borderRadius: 10,
              background: 'rgba(24,24,27,0.7)', border: `1px solid rgba(255,255,255,0.05)`,
              borderLeft: `3px solid ${comp.groupStatus.systems.source === 'auto' ? '#00e68a' : '#8b5cf6'}`,
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>⚙️ Системы</span>
                <div style={{ display:'flex', gap: 3, alignItems:'center' }}>
                  <SourceBadge source={comp.groupStatus.systems.source} />
                  <button onClick={() => setPopup('systems')} style={{ padding:'2px 6px', borderRadius: 4, border:'none', cursor:'pointer', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.35)', fontSize:7 }}>✏️</button>
                </div>
              </div>
              <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                {profile.targetSystems.map(s => <DataChip key={s} color="#8b5cf6">{systemLabel(s)}</DataChip>)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', gap:4, marginBottom:5 }}>
          <SmallBtn icon="🫀" title="Органы" color="#60a5fa"
            subtitle={`${profile.targetOrgans.length} выбрано`}
            count={profile.targetOrgans.length}
            onClick={() => setPopup('organs')} />
          <SmallBtn icon="⚙️" title="Системы" color="#8b5cf6"
            subtitle={`${profile.targetSystems.length} выбрано`}
            count={profile.targetSystems.length}
            onClick={() => setPopup('systems')} />
        </div>
      )}

      {/* ── Avoid ── */}
      {comp.groupStatus.avoid?.filled ? (
        <SummaryCard icon="💊" title="Исключить БАДы" color="#8b5cf6" source={comp.groupStatus.avoid.source} onEdit={() => setPopup('supplements')}>
          {profile.avoidIds.map(a => (
            <DataChip key={a} color="#a78bfa" dim>{a}</DataChip>
          ))}
        </SummaryCard>
      ) : (
        <CardBtn icon="💊" title="Исключить БАДы" color="#8b5cf6"
          subtitle={profile.avoidIds.length ? `${profile.avoidIds.length} исключено` : 'Не заданы'}
          count={profile.avoidIds.length}
          onClick={() => setPopup('supplements')}
          badge={profile.avoidIds.length === 0 ? { text: 'Не заданы', source: 'empty' } : undefined} />
      )}

      {/* ── Clinical ── */}
      {comp.groupStatus.clinical?.filled ? (
        <SummaryCard icon="🏥" title="Клинические данные" color="#ef4444" source={comp.groupStatus.clinical.source} onEdit={() => setPopup('clinical')}>
          {profile.currentMeds.map(m => <DataChip key={m} color="#f87171">💊 {m}</DataChip>)}
          {profile.drugAllergies.map(a => <DataChip key={a} color="#fca5a5" dim>⚠ {a}</DataChip>)}
          {profile.adClass !== 'none' && <DataChip color="#ef4444">АД: {adLabel(profile.adClass)}</DataChip>}
        </SummaryCard>
      ) : (
        <CardBtn icon="🏥" title="Клинические данные" color="#ef4444"
          subtitle={`${profile.currentMeds.length ? profile.currentMeds.join(', ').slice(0,30)+(profile.currentMeds.length>1?'...':'') : 'Нет лекарств'}${profile.adClass !== 'none' ? ` · ${adLabel(profile.adClass)}` : ''}`}
          count={profile.currentMeds.length}
          onClick={() => setPopup('clinical')}
          badge={{ text: 'Не заполнено', source: 'empty' }} />
      )}

      <div style={{ textAlign:'center', fontSize:8, color:'rgba(255,255,255,0.25)', marginTop:4 }}>
        ⚡ Профиль BioStack сохраняется автоматически
      </div>
      {popup === 'personal' && <PopupPersonal profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'health' && <PopupHealth profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'goals' && <PopupGoals profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'organs' && <PopupOrgans profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'systems' && <PopupSystems profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'supplements' && <PopupSupplements profile={profile} u={u} onClose={() => setPopup(null)} />}
      {popup === 'clinical' && <PopupClinical profile={profile} u={u} onClose={() => setPopup(null)} />}
    </div>
  );
}
