import React, { useState, useMemo, useCallback } from 'react';
import {
  type BioStackProfile, type CognitiveTask, type StimSensitivity,
  type GutSensitivity, type DietType, type Chronotype, type AlcoholLevel,
  type CaffeineLevel, type ADClass, type StackComplexity,
  type GoalType, type HealthCondition, type AASStatus, type BudgetLevel,
  type ExperienceLevel,
  getDefaultBioStackProfile, autoFillFromMainProfile,
  saveBioStackProfile, loadBioStackProfile,
} from '../../engines/biostack-ai.engine';
import {
  findSupplements, findReplacement, buildStack, explainStack,
  type FinderMatch, type FinderQuery, type FinderProfile,
  type StackExplanation, type ReplacementResult,
  type GoalType as FinderGoal,
} from '../../engines/supplement-finder.engine';
import { SYSTEM_LABELS_CATALOG, MECHANISM_LABELS, CATEGORY_LABELS, SUPPORT_CATALOG_DATA, ALL_INTERACTIONS, type SupportInteraction } from '../../data/support-database';

type BSTab = 'profile' | 'search' | 'build' | 'stack' | 'risks' | 'compare' | 'reports' | 'ai';

const SUB_TABS: { id: BSTab; label: string }[] = [
  { id: 'profile', label: '👤 Профиль' },
  { id: 'search', label: '🔍 Поиск' },
  { id: 'build', label: '🧩 Сборка' },
  { id: 'stack', label: '📋 Мой стек' },
  { id: 'risks', label: '⚠ Риски' },
  { id: 'compare', label: '⚖ Сравнение' },
  { id: 'reports', label: '📊 Отчёты' },
  { id: 'ai', label: '🧠 AI' },
];

const GOALS: { key: GoalType; label: string }[] = [
  { key:'sleep', label:'😴 Сон' }, { key:'energy', label:'⚡ Энергия' },
  { key:'concentration', label:'🎯 Фокус' }, { key:'muscle_gain', label:'💪 Мышцы' },
  { key:'fat_loss', label:'🔥 Жиросжигание' }, { key:'endurance', label:'🏃 Выносливость' },
  { key:'recovery', label:'🔄 Восстановление' }, { key:'immunity', label:'🛡️ Иммунитет' },
  { key:'liver_health', label:'🫁 Печень' }, { key:'cardio_health', label:'❤️ Сердце' },
  { key:'joints', label:'🦴 Суставы' }, { key:'skin', label:'🧴 Кожа' },
  { key:'hair', label:'💇 Волосы' }, { key:'hormones', label:'⚖️ Гормоны' },
  { key:'stress', label:'🧘 Стресс' }, { key:'longevity', label:'⏳ Долголетие' },
  { key:'detox', label:'🧹 Детокс' }, { key:'libido', label:'🔥 Либидо' },
  { key:'mood', label:'😊 Настроение' }, { key:'brain', label:'🧠 Мозг' },
  { key:'digestion', label:'🫃 ЖКТ' }, { key:'kidney', label:'🫘 Почки' },
];

const HEALTH_CONDS: { key: HealthCondition; label: string }[] = [
  { key:'liver', label:'🫁 Печень' }, { key:'kidney', label:'🫘 Почки' },
  { key:'heart', label:'❤️ Сердце' }, { key:'thyroid', label:'🦋 Щитовидная' },
  { key:'stomach', label:'🫃 Желудок' }, { key:'pressure_high', label:'⬆️ Давление ↑' },
  { key:'pressure_low', label:'⬇️ Давление ↓' }, { key:'diabetes', label:'🍬 Диабет' },
  { key:'autoimmune', label:'🛡️ Аутоиммунные' },
];

const ORGANS: { key: string; label: string }[] = [
  { key:'BRAIN', label:'🧠 Мозг' }, { key:'LIVER', label:'🫁 Печень' },
  { key:'HEART', label:'❤️ Сердце' }, { key:'KIDNEYS', label:'🫘 Почки' },
  { key:'LUNGS', label:'🫁 Лёгкие' }, { key:'MUSCLES', label:'💪 Мышцы' },
  { key:'BONES', label:'🦴 Кости' }, { key:'JOINTS', label:'🦴 Суставы' },
  { key:'SKIN', label:'🧴 Кожа' }, { key:'IMMUNE_SYSTEM', label:'🛡️ Иммунитет' },
  { key:'NERVES', label:'⚡ Нервы' }, { key:'GUT', label:'🫃 ЖКТ' },
  { key:'VESSELS', label:'🩸 Сосуды' }, { key:'ADRENALS', label:'⚖️ Надпочечники' },
  { key:'THYROID', label:'🦋 Щитовидная' }, { key:'REPRODUCTIVE', label:'🧬 Репродуктивная' },
  { key:'PROSTATE', label:'🔴 Простата' }, { key:'BLOOD', label:'🩸 Кровь' },
  { key:'EYES', label:'👁️ Глаза' }, { key:'PANCREAS', label:'🫁 Поджелудочная' },
  { key:'CELLS', label:'🔬 Клетки' }, { key:'MITOCHONDRIA', label:'🔋 Митохондрии' },
  { key:'ENDOCRINE', label:'⚖️ Эндокринная' }, { key:'PITUITARY', label:'🧠 Гипофиз' },
];

const SYSTEMS: { key: string; label: string }[] = [
  { key:'hepatic', label:'🫁 Печень' }, { key:'cardio', label:'❤️ ССС' },
  { key:'renal', label:'🫘 Почки' }, { key:'neuro', label:'🧠 Нервная' },
  { key:'endocrine', label:'⚖️ Эндокринная' }, { key:'hematologic', label:'🩸 Кровь' },
  { key:'reproductive', label:'🧬 Репродуктивная' }, { key:'musculoskeletal', label:'💪 Опорно-двиг.' },
  { key:'immune', label:'🛡️ Иммунитет' }, { key:'metabolic', label:'⚡ Метаболизм' },
  { key:'gastrointestinal', label:'🫃 ЖКТ' },
];

const TOP_MECHANISMS: { key: string; label: string }[] = [
  { key:'ANTIOXIDANT', label:'🛡️ Антиоксидант' },
  { key:'GABAERGIC', label:'😌 GABA' },
  { key:'DOPAMINE', label:'💎 Дофамин' },
  { key:'SEROTONIN', label:'😊 Серотонин' },
  { key:'CORTISOL', label:'⚡ Кортизол' },
  { key:'ANTI_INFLAMMATORY', label:'🔥 Противовоспал.' },
  { key:'MITOCHONDRIAL', label:'🔋 Митохондрии' },
  { key:'NITRIC_OXIDE', label:'🩸 NO' },
  { key:'AMPK_ACTIVATION', label:'⚡ AMPK' },
  { key:'BDNF', label:'🧠 BDNF' },
  { key:'TESTOSTERONE', label:'💪 Тестостерон' },
  { key:'GLUTATHIONE', label:'🛡️ Глутатион' },
  { key:'COLLAGEN', label:'🦴 Коллаген' },
  { key:'LIVER_DETOX', label:'🫁 Детокс печени' },
  { key:'NEUROPROTECTION', label:'🧠 Нейропротекция' },
];

const SYMPTOMS: { label: string; goal: GoalType }[] = [
  { label:'😰 Тревожность', goal:'stress' },
  { label:'😴 Бессонница', goal:'sleep' },
  { label:'⚡ Усталость', goal:'energy' },
  { label:'😐 Апатия', goal:'mood' },
  { label:'🤯 Перегруз', goal:'stress' },
  { label:'🤔 Забывчивость', goal:'brain' },
  { label:'😡 Раздражительность', goal:'stress' },
  { label:'🍔 Тяга к еде', goal:'digestion' },
  { label:'💪 Мышечная слабость', goal:'recovery' },
  { label:'🤕 Частые болезни', goal:'immunity' },
];

const inputS: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 12,
  background: '#202023', border: '1px solid rgba(255,255,255,0.06)',
  color: '#fff', fontSize: 13, boxSizing: 'border-box', outline: 'none',
};

const selectS: React.CSSProperties = { ...inputS, appearance: 'none' };

const GlassCard: React.FC<{ title?: string; icon?: string; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, icon, color, children, style }) => (
  <div style={{ borderRadius: 18, overflow: 'hidden', background: '#18181b', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 2px 20px rgba(0,0,0,0.3)', marginBottom: 10, ...style }}>
    {color && <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}66, transparent)` }} />}
    {title && <div style={{ padding: '14px 18px 0', fontSize: 14, color: color || 'rgba(255,255,255,0.75)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>{icon && <span>{icon}</span>}{title}</div>}
    <div style={{ padding: title ? '12px 18px 18px' : 18 }}>{children}</div>
  </div>
);

const PillBtn: React.FC<{ active?: boolean; onClick: () => void; color?: string; children: React.ReactNode; small?: boolean }> = ({ active, onClick, color, children, small }) => (
  <button onClick={onClick} style={{
    padding: small ? '4px 10px' : '6px 14px', borderRadius: 20, fontSize: small ? 8 : 10, cursor: 'pointer', fontWeight: 600,
    whiteSpace: 'nowrap', letterSpacing: '-0.1px', transition: 'all 0.2s',
    background: active ? (color ? `${color}18` : 'rgba(0,230,138,0.12)') : '#202023',
    border: active ? `1px solid ${color || '#00e68a'}` : '1px solid rgba(255,255,255,0.06)',
    color: active ? (color || '#00e68a') : '#fff',
    boxShadow: active ? `0 0 12px ${(color || '#00e68a')}22` : 'none',
  }}>{children}</button>
);

const Slider: React.FC<{ value: number; onChange: (v: number) => void; label: string; emoji?: string }> = ({ value, onChange, label, emoji }) => (
  <div style={{ marginBottom: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>
      <span>{emoji} {label}</span><span style={{ fontWeight: 700, color: '#00e68a' }}>{value}/10</span>
    </div>
    <input type="range" min={0} max={10} value={value} onChange={e => onChange(+e.target.value)}
      style={{ width: '100%', height: 4, borderRadius: 2, background: '#202023', accentColor: '#00e68a', outline: 'none' }} />
  </div>
);

/* ─── Bridge: BioStackProfile → FinderProfile ─── */
function toFinderProfile(bp: BioStackProfile): FinderProfile {
  return {
    age: bp.age, weight: bp.weight, height: bp.height, sex: bp.sex,
    experience: bp.experience,
    goals: bp.goals.filter(g => g !== undefined) as FinderGoal[],
    aasStatus: bp.aasStatus as any,
    healthConditions: bp.healthConditions as any,
    budget: bp.budget, avoidIds: bp.avoidIds, maxStackSize: bp.maxStackSize,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   PROFILE TAB
   ═══════════════════════════════════════════════════════════════════ */
function ProfileTab({ profile, setProfile }: { profile: BioStackProfile; setProfile: (p: BioStackProfile) => void }) {
  const u = (patch: Partial<BioStackProfile>) => { const n = { ...profile, ...patch }; setProfile(n); saveBioStackProfile(n); };

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="Личные данные" icon="👤" color="#60a5fa">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Возраст</label>
            <input type="number" value={profile.age} onChange={e => u({ age: +e.target.value || 0 })} style={inputS} /></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Вес (кг)</label>
            <input type="number" value={profile.weight} onChange={e => u({ weight: +e.target.value || 0 })} style={inputS} /></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Рост (см)</label>
            <input type="number" value={profile.height} onChange={e => u({ height: +e.target.value || 0 })} style={inputS} /></div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <PillBtn active={profile.sex === 'male'} onClick={() => u({ sex: 'male' })} color="#60a5fa">♂ Мужской</PillBtn>
          <PillBtn active={profile.sex === 'female'} onClick={() => u({ sex: 'female' })} color="#f472b6">♀ Женский</PillBtn>
          {(['beginner','intermediate','advanced'] as const).map(l => (
            <PillBtn key={l} active={profile.experience === l} onClick={() => u({ experience: l })}>
              {l === 'beginner' ? '🌱 Новичок' : l === 'intermediate' ? '💪 Средний' : '🔥 Продвинутый'}
            </PillBtn>
          ))}
        </div>
      </GlassCard>

      <GlassCard title="Здоровье" icon="🫀" color="#ef4444">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Систолическое</label>
            <input type="number" value={profile.bpSystolic} onChange={e => u({ bpSystolic: +e.target.value || 120 })} style={inputS} /></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Диастолическое</label>
            <input type="number" value={profile.bpDiastolic} onChange={e => u({ bpDiastolic: +e.target.value || 80 })} style={inputS} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>ЖКТ</label>
            <select value={profile.gutSensitivity} onChange={e => u({ gutSensitivity: e.target.value as GutSensitivity })} style={selectS}>
              <option value="normal">🟢 Норма</option><option value="sensitive">🟡 Чувствительный</option><option value="problematic">🔴 Проблемный</option>
            </select></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Курение</label>
            <select value={profile.smoke ? 'yes' : 'no'} onChange={e => u({ smoke: e.target.value === 'yes' })} style={selectS}>
              <option value="no">🚭 Нет</option><option value="yes">🚬 Да</option>
            </select></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Алкоголь</label>
            <select value={profile.alcoholLevel} onChange={e => u({ alcoholLevel: e.target.value as AlcoholLevel })} style={selectS}>
              <option value="none">✖ Не пью</option><option value="rare">🍷 Редко</option><option value="moderate">🍺 1-3/нед</option><option value="daily">🔴 Ежедневно</option>
            </select></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>ААС-статус</label>
            <select value={profile.aasStatus} onChange={e => u({ aasStatus: e.target.value as AASStatus })} style={selectS}>
              <option value="none">✖ Без ААС</option><option value="trt">💉 TRT</option><option value="course">💊 Курс</option><option value="pct">🔄 ПКТ</option>
              <option value="bridge">🌉 Бридж</option><option value="fertility">🧬 Фертильность</option>
            </select></div>
        </div>
        <div style={{ marginBottom: 4 }}>
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Состояния здоровья:</label>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {HEALTH_CONDS.map(h => (
              <PillBtn key={h.key} active={profile.healthConditions.includes(h.key)}
                onClick={() => u({ healthConditions: profile.healthConditions.includes(h.key) ? profile.healthConditions.filter(x => x !== h.key) : [...profile.healthConditions, h.key] })}>
                {h.label}
              </PillBtn>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Нейро-статус" icon="🧠" color="#a78bfa">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Тип задачи</label>
            <select value={profile.cognitiveTask} onChange={e => u({ cognitiveTask: e.target.value as CognitiveTask })} style={selectS}>
              <option value="memory">🧠 Память</option><option value="focus">🎯 Фокус</option><option value="creativity">💡 Креативность</option>
              <option value="reaction_speed">⚡ Скорость реакции</option><option value="learning">📚 Учёба</option>
            </select></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Чувствит. к стимуляторам</label>
            <select value={profile.stimSensitivity} onChange={e => u({ stimSensitivity: e.target.value as StimSensitivity })} style={selectS}>
              <option value="low">🟢 Низкая</option><option value="medium">🟡 Средняя</option><option value="high">🔴 Высокая</option>
            </select></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Кофеин</label>
            <select value={profile.caffeineLevel} onChange={e => u({ caffeineLevel: e.target.value as CaffeineLevel })} style={selectS}>
              <option value="none">✖ Не пью</option><option value="low">☕ 1-2 чашки</option><option value="moderate">☕☕ 3-5 чашек</option><option value="high">☕☕☕ 5+ чашек</option>
            </select></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Антидепрессанты</label>
            <select value={profile.adClass} onChange={e => u({ adClass: e.target.value as ADClass })} style={selectS}>
              <option value="none">✖ Нет</option><option value="ssri">💊 СИОЗС</option><option value="snri">💊 СИОЗСиН</option>
              <option value="maoi">💊 ИМАО</option><option value="tca">💊 ТЦА</option><option value="other">💊 Другие</option>
            </select></div>
        </div>
        <Slider value={profile.anxietyLevel} onChange={v => u({ anxietyLevel: v })} label="Тревожность" emoji="😰" />
        <Slider value={profile.sleepQuality} onChange={v => u({ sleepQuality: v })} label="Качество сна" emoji="😴" />
        <Slider value={profile.stressLevel} onChange={v => u({ stressLevel: v })} label="Уровень стресса" emoji="⚡" />
      </GlassCard>

      <GlassCard title="Образ жизни" icon="🌍" color="#22c55e">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Питание</label>
            <select value={profile.dietType} onChange={e => u({ dietType: e.target.value as DietType })} style={selectS}>
              <option value="mixed">🍖 Смешанное</option><option value="vegetarian">🥦 Вегетарианское</option>
              <option value="vegan">🌱 Веганское</option><option value="keto">🥑 Кето</option>
              <option value="paleo">🥩 Палео</option><option value="mediterranean">🫒 Средиземноморское</option>
            </select></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Хронотип</label>
            <select value={profile.chronotype} onChange={e => u({ chronotype: e.target.value as Chronotype })} style={selectS}>
              <option value="lark">🌅 Жаворонок</option><option value="owl">🦉 Сова</option><option value="mixed">🐦 Смешанный</option>
            </select></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Бюджет</label>
            <select value={profile.budget} onChange={e => u({ budget: e.target.value as BudgetLevel })} style={selectS}>
              <option value="economy">💰 Эконом</option><option value="medium">💵 Средний</option><option value="premium">💎 Премиум</option>
            </select></div>
          <div><label style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 3, display: 'block' }}>Сложность стека</label>
            <select value={profile.stackComplexity} onChange={e => u({ stackComplexity: e.target.value as StackComplexity })} style={selectS}>
              <option value="minimal">🔵 Минимальный (3-5)</option><option value="balanced">🟢 Сбалансированный (5-10)</option><option value="maximum">🔴 Максимальный (10-20)</option>
            </select></div>
        </div>
      </GlassCard>

      <GlassCard title="Цели" icon="🎯" color="#f59e0b">
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {GOALS.map(g => (
            <PillBtn key={g.key} active={profile.goals.includes(g.key)}
              onClick={() => u({ goals: profile.goals.includes(g.key) ? profile.goals.filter(x => x !== g.key) : [...profile.goals, g.key] })}>
              {g.label}
            </PillBtn>
          ))}
        </div>
      </GlassCard>

      <GlassCard title="Текущие БАДы" icon="💊" color="#8b5cf6">
        <input value={profile.currentSupplements.join(', ')} onChange={e => u({ currentSupplements: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={inputS} placeholder="nap: nac, omega3, tudca" />
      </GlassCard>

      <button onClick={() => { const filled = autoFillFromMainProfile(); if (Object.keys(filled).length > 0) setProfile({ ...profile, ...filled }); }}
        style={{ width: '100%', padding: 12, borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700, fontSize: 13,
          boxShadow: '0 4px 20px rgba(0,230,138,0.2)', marginBottom: 10 }}>
        📥 Заполнить из профиля
      </button>
      <div style={{ textAlign: 'center', fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
        ⚡ Профиль сохраняется автоматически
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SEARCH TAB
   ═══════════════════════════════════════════════════════════════════ */
type FilterGroup = 'goals' | 'organs' | 'systems' | 'mechanisms' | 'symptoms';

function SearchTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [searchText, setSearchText] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<GoalType | null>(null);
  const [selectedOrgans, setSelectedOrgans] = useState<string[]>([]);
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [selectedMechs, setSelectedMechs] = useState<string[]>([]);
  const [results, setResults] = useState<FinderMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [openGroup, setOpenGroup] = useState<FilterGroup | null>(null);

  const clearSearch = useCallback(() => {
    setSearchText(''); setSelectedGoal(null); setSelectedOrgans([]);
    setSelectedSystems([]); setSelectedMechs([]); setResults([]); setHasSearched(false);
  }, []);

  const hasAnyFilter = searchText || selectedGoal || selectedOrgans.length > 0 || selectedSystems.length > 0 || selectedMechs.length > 0;

  const handleSearch = useCallback(() => {
    const organs = selectedOrgans.length > 0 ? selectedOrgans : undefined;
    const systems = selectedSystems.length > 0 ? selectedSystems : undefined;
    const query: FinderQuery = {
      searchText: searchText || undefined,
      goal: selectedGoal || undefined,
      organs,
      profile: toFinderProfile(profile),
    };
    if (selectedMechs.length > 0) {
      query.mechanisms = selectedMechs;
      if (!query.searchText && !query.goal && !query.organs) {
        query.organs = [];
      }
    }
    const res = findSupplements(query)
      .filter(m => {
        if (systems && systems.length > 0) {
          const entry = SUPPORT_CATALOG_DATA[m.id];
          if (!entry || !entry.systems) return false;
          return systems.some(s => (entry.systems || []).includes(s));
        }
        return true;
      })
      .sort((a, b) => (b.relevanceScore + b.personalScore) - (a.relevanceScore + a.personalScore));
    setResults(res);
    setHasSearched(true);
  }, [searchText, selectedGoal, selectedOrgans, selectedSystems, selectedMechs, profile]);

  const toggleOrgan = (o: string) => setSelectedOrgans(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o]);
  const toggleSystem = (s: string) => setSelectedSystems(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const toggleMech = (m: string) => setSelectedMechs(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard icon="🔍" color="#60a5fa" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <input value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder="Название, орган, механизм..."
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: '#202023', color: '#fff', fontSize: 13, outline: 'none' }}
          />
          <button onClick={handleSearch} style={{
            padding: '10px 18px', borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', border: 'none',
          }}>Найти</button>
          {hasSearched && <button onClick={clearSearch} style={{ padding: '10px 12px', borderRadius: 12, fontSize: 10, cursor: 'pointer', background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>✕</button>}
        </div>

        {/* Filter pills row */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <PillBtn active={openGroup === 'goals'} onClick={() => setOpenGroup(openGroup === 'goals' ? null : 'goals')} color="#f59e0b" small>🎯 Цели</PillBtn>
          <PillBtn active={openGroup === 'organs'} onClick={() => setOpenGroup(openGroup === 'organs' ? null : 'organs')} color="#ef4444" small>🫀 Органы</PillBtn>
          <PillBtn active={openGroup === 'systems'} onClick={() => setOpenGroup(openGroup === 'systems' ? null : 'systems')} color="#8b5cf6" small>🧬 Системы</PillBtn>
          <PillBtn active={openGroup === 'mechanisms'} onClick={() => setOpenGroup(openGroup === 'mechanisms' ? null : 'mechanisms')} color="#06b6d4" small>⚙ Механизмы</PillBtn>
          <PillBtn active={openGroup === 'symptoms'} onClick={() => setOpenGroup(openGroup === 'symptoms' ? null : 'symptoms')} color="#f43f5e" small>⚠ Симптомы</PillBtn>
        </div>

        {/* GOALS */}
        {openGroup === 'goals' && (
          <div style={{ marginTop: 6, padding: 8, borderRadius: 12, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {GOALS.map(g => (
                <PillBtn key={g.key} active={selectedGoal === g.key} onClick={() => setSelectedGoal(selectedGoal === g.key ? null : g.key)} small>{g.label}</PillBtn>
              ))}
            </div>
          </div>
        )}

        {/* ORGANS */}
        {openGroup === 'organs' && (
          <div style={{ marginTop: 6, padding: 8, borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {ORGANS.map(o => (
                <PillBtn key={o.key} active={selectedOrgans.includes(o.key)} onClick={() => toggleOrgan(o.key)} small>{o.label}</PillBtn>
              ))}
            </div>
          </div>
        )}

        {/* SYSTEMS */}
        {openGroup === 'systems' && (
          <div style={{ marginTop: 6, padding: 8, borderRadius: 12, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)' }}>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {SYSTEMS.map(s => (
                <PillBtn key={s.key} active={selectedSystems.includes(s.key)} onClick={() => toggleSystem(s.key)} small>{s.label}</PillBtn>
              ))}
            </div>
          </div>
        )}

        {/* MECHANISMS */}
        {openGroup === 'mechanisms' && (
          <div style={{ marginTop: 6, padding: 8, borderRadius: 12, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.1)' }}>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {TOP_MECHANISMS.map(m => (
                <PillBtn key={m.key} active={selectedMechs.includes(m.key)} onClick={() => toggleMech(m.key)} small>{m.label}</PillBtn>
              ))}
            </div>
          </div>
        )}

        {/* SYMPTOMS */}
        {openGroup === 'symptoms' && (
          <div style={{ marginTop: 6, padding: 8, borderRadius: 12, background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.1)' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Выберите симптом → автоматически подберёт цель и препараты</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {SYMPTOMS.map(s => (
                <PillBtn key={s.label} active={selectedGoal === s.goal} onClick={() => { setSelectedGoal(selectedGoal === s.goal ? null : s.goal); setOpenGroup(null); }} small>{s.label}</PillBtn>
              ))}
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {(selectedGoal || selectedOrgans.length > 0 || selectedSystems.length > 0 || selectedMechs.length > 0) && (
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 6 }}>
            {selectedGoal && <span style={{ fontSize: 8, padding: '2px 7px', borderRadius: 6, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.15)' }}>🎯 {GOALS.find(g => g.key === selectedGoal)?.label}</span>}
            {selectedOrgans.map(o => <span key={o} style={{ fontSize: 8, padding: '2px 7px', borderRadius: 6, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>🫀 {ORGANS.find(x => x.key === o)?.label}</span>)}
            {selectedSystems.map(s => <span key={s} style={{ fontSize: 8, padding: '2px 7px', borderRadius: 6, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.15)' }}>🧬 {SYSTEMS.find(x => x.key === s)?.label}</span>)}
            {selectedMechs.map(m => <span key={m} style={{ fontSize: 8, padding: '2px 7px', borderRadius: 6, background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.15)' }}>⚙ {TOP_MECHANISMS.find(x => x.key === m)?.label || MECHANISM_LABELS[m] || m}</span>)}
          </div>
        )}
      </GlassCard>

      {/* Stack pills */}
      {stackIds.length > 0 && (
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 6, padding: 8, borderRadius: 12, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
          <span style={{ fontSize: 8, color: '#00e68a', fontWeight: 600, alignSelf: 'center' }}>📋 Стек:</span>
          {stackIds.map(id => (
            <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 7px', borderRadius: 6, fontSize: 8, background: 'rgba(0,230,138,0.08)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.15)' }}>
              {id}
              <span style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => setStackIds(stackIds.filter(x => x !== id))}>✕</span>
            </span>
          ))}
          <button onClick={() => setStackIds([])} style={{ padding: '2px 7px', borderRadius: 6, fontSize: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>🧹</button>
        </div>
      )}

      {/* Results */}
      {hasSearched && (
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Найдено: {results.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {results.map(m => (
              <SearchCard key={m.id} match={m} onAdd={(id) => setStackIds(stackIds.includes(id) ? stackIds : [...stackIds, id])} added={stackIds.includes(m.id)} />
            ))}
            {results.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.25)', fontSize: 11, lineHeight: 1.6 }}>
                Ничего не найдено.<br />Попробуйте другую комбинацию цели, органа или системы.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchCard({ match, onAdd, added }: { match: FinderMatch; onAdd: (id: string) => void; added: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const totalScore = match.relevanceScore + match.personalScore;
  const scoreColor = totalScore >= 20 ? '#00e68a' : totalScore >= 12 ? '#fbbf24' : totalScore >= 6 ? '#f59e0b' : '#94a3b8';

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', background: '#18181b', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', cursor: 'pointer' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: scoreColor + '18', color: scoreColor, fontWeight: 800, fontSize: 14 }}>{totalScore}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{match.name}</span>
            {match.bestForCourse && <span style={{ fontSize: 7, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,230,138,0.12)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.2)' }}>Курс</span>}
            <span style={{ fontSize: 7, padding: '1px 5px', borderRadius: 3,
              background: match.priceEstimate === 'low' ? 'rgba(0,230,138,0.08)' : match.priceEstimate === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)',
              color: match.priceEstimate === 'low' ? '#00e68a' : match.priceEstimate === 'high' ? '#ef4444' : 'rgba(255,255,255,0.5)',
            }}>{match.priceEstimate === 'low' ? '💰' : match.priceEstimate === 'high' ? '💎' : '💵'}</span>
          </div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 2 }}>
            {match.categories.slice(0, 3).map(c => (
              <span key={c} style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)' }}>{CATEGORY_LABELS[c] || c}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, fontSize: 8, color: 'rgba(255,255,255,0.4)', flexWrap: 'wrap' }}>
            <span>🔄 {match.synergyCount} син.</span>
            <span>⚠️ {match.conflictCount} конф.</span>
            <span>📦 {match.formCount} форм</span>
            {match.estimatedDose && <span style={{ color: '#60a5fa' }}>💊 {match.estimatedDose}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
          <button onClick={e => { e.stopPropagation(); onAdd(match.id); }} style={{
            padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            background: added ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.06)',
            color: added ? '#00e68a' : 'rgba(255,255,255,0.6)',
            border: '1px solid ' + (added ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.08)'),
          }}>{added ? '✓' : '+ Стек'}</button>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '8px 12px 12px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)' }}>
          {match.matchReasons.length > 0 && (
            <div style={{ marginBottom: 3 }}>
              <div style={{ fontSize: 7, color: '#00e68a', fontWeight: 600, marginBottom: 1 }}>✅ Совпадения:</div>
              {match.matchReasons.map((r, i) => <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>• {r}</div>)}
            </div>
          )}
          {match.personalNotes.length > 0 && (
            <div style={{ marginBottom: 3 }}>
              <div style={{ fontSize: 7, color: '#60a5fa', fontWeight: 600, marginBottom: 1 }}>👤 Персонально:</div>
              {match.personalNotes.map((n, i) => <div key={i} style={{ fontSize: 8, color: '#60a5fa', lineHeight: 1.3 }}>• {n}</div>)}
            </div>
          )}
          {match.clinicalEffect && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', marginBottom: 2 }}>✅ {match.clinicalEffect}</div>}
          {match.mechanismOfAction && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', marginBottom: 2, lineHeight: 1.3 }}>🧬 {match.mechanismOfAction}</div>}
          {match.bestForm && <div style={{ fontSize: 8, color: '#00e68a', fontWeight: 600, marginBottom: 2 }}>🏆 {match.bestForm}</div>}

          {/* Organs & systems */}
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 2 }}>
            {match.organs.map(o => <span key={o} style={{ fontSize: 7, padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.1)' }}>🫀 {o}</span>)}
          </div>

          {match.contraindicationWarnings.length > 0 && (
            <div style={{ marginTop: 3, padding: '5px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
              <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600, marginBottom: 1 }}>⚠ Противопоказания:</div>
              {match.contraindicationWarnings.map((w, i) => <div key={i} style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3 }}>• {w}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── LAB MARKERS MAP ──────────────────────────────────────────── */
interface LabMarker { id: string; label: string; group: string; organs: string[]; mechanisms: string[]; }
const LAB_MARKERS: LabMarker[] = [
  { id:'alt_ast', label:'АЛТ / АСТ', group:'🫁 Печень', organs:['LIVER'], mechanisms:['ANTIOXIDANT','LIVER_DETOX','GLUTATHIONE'] },
  { id:'ggt', label:'ГГТ', group:'🫁 Печень', organs:['LIVER','GALLBLADDER'], mechanisms:['CHOLERETIC','ANTIOXIDANT'] },
  { id:'homocysteine', label:'Гомоцистеин', group:'🧬 Метилирование', organs:['BLOOD','VESSELS'], mechanisms:['METHYLATION','ANTIOXIDANT'] },
  { id:'bp', label:'Давление (сист/диаст)', group:'❤️ ССС', organs:['HEART','VESSELS'], mechanisms:['BLOOD_PRESSURE','VASODILATION'] },
  { id:'hr', label:'ЧСС', group:'❤️ ССС', organs:['HEART'], mechanisms:['BLOOD_PRESSURE','COQ10'] },
  { id:'ldl_hdl_tg', label:'LDL / HDL / ТГ', group:'❤️ ССС', organs:['HEART','VESSELS','LIVER'], mechanisms:['LIPID','ANTIOXIDANT','FAT_OXIDATION'] },
  { id:'glucose_hba1c', label:'Глюкоза / HbA1c', group:'⚡ Метаболизм', organs:['PANCREAS','LIVER'], mechanisms:['AMPK_ACTIVATION','METABOLIC'] },
  { id:'creatinine_urea', label:'Креатинин / Мочевина', group:'🫘 Почки', organs:['KIDNEYS'], mechanisms:['RENAL_PROTECTION'] },
  { id:'tsh_ft3_ft4', label:'ТТГ / Т3св / Т4св', group:'⚖️ Эндокринная', organs:['THYROID','PITUITARY'], mechanisms:['THYROID_HORMONE'] },
  { id:'t_e2', label:'Тестостерон / Эстрадиол', group:'⚖️ Эндокринная', organs:['ENDOCRINE','REPRODUCTIVE'], mechanisms:['TESTOSTERONE','AROMATASE'] },
  { id:'prolactin', label:'Пролактин', group:'⚖️ Эндокринная', organs:['PITUITARY','BRAIN'], mechanisms:['DOPAMINE'] },
  { id:'cortisol', label:'Кортизол', group:'⚖️ Эндокринная', organs:['ADRENALS','BRAIN'], mechanisms:['CORTISOL','ADAPTOGENIC'] },
  { id:'ferritin_iron', label:'Ферритин / Железо', group:'🩸 Кровь', organs:['BLOOD','LIVER'], mechanisms:['ANTIOXIDANT'] },
  { id:'b12_folate', label:'B12 / Фолат', group:'🩸 Кровь', organs:['BLOOD','NERVES'], mechanisms:['METHYLATION','ENERGY_PRODUCTION'] },
  { id:'crp', label:'СРБ (воспаление)', group:'🛡️ Иммунитет', organs:['IMMUNE_SYSTEM','LIVER'], mechanisms:['ANTI_INFLAMMATORY','ANTIOXIDANT'] },
  { id:'vitamin_d', label:'Витамин D', group:'🛡️ Иммунитет', organs:['IMMUNE_SYSTEM','BONES'], mechanisms:['VITAMIN_D_RECEPTOR'] },
  { id:'prostate_psa', label:'ПСА', group:'🔴 Простата', organs:['PROSTATE'], mechanisms:['5AR_INHIBITION','ANTI_ANDROGENIC'] },
  { id:'dht', label:'DHT', group:'🔴 Простата', organs:['PROSTATE','HAIR','SKIN'], mechanisms:['5AR_INHIBITION'] },
  { id:'uric_acid', label:'Мочевая кислота', group:'🫘 Почки', organs:['KIDNEYS','JOINTS'], mechanisms:['URIC_ACID','ANTIOXIDANT'] },
];

const GROUP_LABELS = ['🫁 Печень','🧬 Метилирование','❤️ ССС','⚡ Метаболизм','🫘 Почки','⚖️ Эндокринная','🩸 Кровь','🛡️ Иммунитет','🔴 Простата'];

/* ═══════════════════════════════════════════════════════════════════
   BUILD TAB
   ═══════════════════════════════════════════════════════════════════ */
function BuildTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [goals, setGoals] = useState<GoalType[]>(profile.goals);
  const [organs, setOrgans] = useState<string[]>([]);
  const [systems, setSystems] = useState<string[]>([]);
  const [targetSize, setTargetSize] = useState(() => profile.stackComplexity === 'minimal' ? 5 : profile.stackComplexity === 'balanced' ? 10 : 18);
  const [labMarkers, setLabMarkers] = useState<Record<string, 'off' | 'maintain' | 'correct'>>({});
  const [result, setResult] = useState<{ stack: string[]; explanation: StackExplanation } | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

  const SIZE_LABELS = [
    { max: 3, label:'🔵 Минимальный (1-3)' }, { max: 5, label:'🟢 Лёгкий (3-5)' },
    { max: 7, label:'🟡 Стандарт (5-7)' }, { max: 10, label:'🟠 Расширенный (7-10)' },
    { max: 15, label:'🔴 Терапевт. (10-15)' }, { max: 20, label:'🟣 Глубокий (15-20)' },
    { max: 30, label:'⚫ Системный (20-30)' }, { max: 40, label:'💎 Мах (30-40)' },
  ];
  const sizeLabel = SIZE_LABELS.find(s => targetSize <= s.max)?.label || `📏 ${targetSize}`;

  const toggleMarker = (id: string) => {
    setLabMarkers(prev => {
      const cur = prev[id] || 'off';
      const next = cur === 'off' ? 'maintain' : cur === 'maintain' ? 'correct' : 'off';
      return { ...prev, [id]: next };
    });
  };

  const handleBuild = () => {
    setBuildError(null);
    try {
      const collectedOrgans = [...organs];
      const collectedMechs: string[] = [];
      for (const [mid, state] of Object.entries(labMarkers)) {
        if (state === 'off') continue;
        const marker = LAB_MARKERS.find(m => m.id === mid);
        if (!marker) continue;
        for (const o of marker.organs) if (!collectedOrgans.includes(o)) collectedOrgans.push(o);
        for (const m of marker.mechanisms) if (!collectedMechs.includes(m)) collectedMechs.push(m);
      }

      const query = {
        baseIds: stackIds,
        targetSize: Math.max(2, targetSize),
        autoFill: true,
        goal: goals.length > 0 ? goals[0] as any : undefined,
        organs: collectedOrgans.length > 0 ? collectedOrgans : undefined,
        mechanisms: collectedMechs.length > 0 ? collectedMechs : undefined,
        profile: toFinderProfile(profile),
      };
      const res = buildStack(query);
      setResult(res);
    } catch (e) {
      setBuildError(String(e));
    }
  };

  const handleSaveStack = () => {
    if (!result) return;
    const name = `🧬 BioStack ${new Date().toLocaleDateString('ru')} (${result.stack.length} шт)`;
    const saved = JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]');
    saved.unshift({ name, ids: result.stack, date: new Date().toISOString() });
    localStorage.setItem('he_finder_saved_stacks', JSON.stringify(saved.slice(0, 50)));
    setStackIds(result.stack);
  };

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Goals from profile */}
      <GlassCard title="Цели (из профиля)" icon="🎯" color="#f59e0b">
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {GOALS.filter(g => goals.includes(g.key)).map(g => (
            <PillBtn key={g.key} active onClick={() => setGoals(goals.filter(x => x !== g.key))} small color="#f59e0b">{g.label} ✕</PillBtn>
          ))}
          {goals.length === 0 && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Не выбраны</span>}
        </div>
      </GlassCard>

      {/* Organs / Systems quick pick */}
      <GlassCard title="Органы и системы" icon="🫀" color="#ef4444">
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Органы-мишени:</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {ORGANS.map(o => (
              <PillBtn key={o.key} active={organs.includes(o.key)} onClick={() => setOrgans(p => p.includes(o.key) ? p.filter(x => x !== o.key) : [...p, o.key])} small>{o.label}</PillBtn>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Системы организма:</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {SYSTEMS.map(s => (
              <PillBtn key={s.key} active={systems.includes(s.key)} onClick={() => setSystems(p => p.includes(s.key) ? p.filter(x => x !== s.key) : [...p, s.key])} small>{s.label}</PillBtn>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* ═══ LAB MARKERS CARD ═══ */}
      <GlassCard title="🧪 По анализам" icon="🧪" color="#06b6d4">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 4, lineHeight: 1.3 }}>
          Выберите маркеры: <b>удержание</b> — сохранить текущий уровень, <b>коррекция</b> — улучшить показатели.
        </div>
        {GROUP_LABELS.map(group => {
          const markers = LAB_MARKERS.filter(m => m.group === group);
          const hasActive = markers.some(m => (labMarkers[m.id] || 'off') !== 'off');
          if (!hasActive) return null;
          return (
            <div key={group} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 8, color: '#06b6d4', fontWeight: 600, marginBottom: 2 }}>{group}</div>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {markers.map(m => {
                  const state = labMarkers[m.id] || 'off';
                  return (
                    <button key={m.id} onClick={() => toggleMarker(m.id)} style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 8, cursor: 'pointer', fontWeight: 600,
                      whiteSpace: 'nowrap', transition: 'all 0.15s',
                      background: state === 'off' ? '#202023' : state === 'maintain' ? 'rgba(0,230,138,0.12)' : 'rgba(239,68,68,0.12)',
                      border: state === 'off' ? '1px solid rgba(255,255,255,0.06)' : state === 'maintain' ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(239,68,68,0.2)',
                      color: state === 'off' ? 'rgba(255,255,255,0.5)' : state === 'maintain' ? '#00e68a' : '#ef4444',
                    }}>
                      {m.label}
                      <span style={{ marginLeft: 3, fontSize: 7 }}>
                        {state === 'off' ? '' : state === 'maintain' ? '🟢' : '🔴'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* All markers rows */}
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {GROUP_LABELS.map(group => {
            const markers = LAB_MARKERS.filter(m => m.group === group);
            return (
              <div key={group} style={{ marginBottom: 5, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 4 }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginBottom: 2 }}>{group}</div>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {markers.map(m => {
                    const state = labMarkers[m.id] || 'off';
                    return (
                      <button key={m.id} onClick={() => toggleMarker(m.id)} style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 8, cursor: 'pointer', fontWeight: 600,
                        whiteSpace: 'nowrap', transition: 'all 0.15s',
                        background: state === 'off' ? '#202023' : state === 'maintain' ? 'rgba(0,230,138,0.12)' : 'rgba(239,68,68,0.12)',
                        border: state === 'off' ? '1px solid rgba(255,255,255,0.06)' : state === 'maintain' ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(239,68,68,0.2)',
                        color: state === 'off' ? 'rgba(255,255,255,0.5)' : state === 'maintain' ? '#00e68a' : '#ef4444',
                      }}>
                        {m.label}
                        <span style={{ marginLeft: 3, fontSize: 7 }}>
                          {state === 'off' ? '' : state === 'maintain' ? ' 🟢' : ' 🔴'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Stack size */}
      <GlassCard title="Размер стека" icon="📏" color="#8b5cf6">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
          <span>{sizeLabel}</span>
          <span style={{ fontWeight: 700, color: '#00e68a' }}>{targetSize}</span>
        </div>
        <input type="range" min={1} max={40} value={targetSize} onChange={e => setTargetSize(+e.target.value)}
          style={{ width: '100%', height: 4, borderRadius: 2, background: '#202023', accentColor: '#00e68a', outline: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>
          <span>1</span><span>5</span><span>10</span><span>20</span><span>30</span><span>40</span>
        </div>
      </GlassCard>

      {/* Build button */}
      <button onClick={handleBuild} style={{
        width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000',
        fontWeight: 700, fontSize: 14, marginBottom: 10,
        boxShadow: '0 4px 20px rgba(0,230,138,0.2)',
      }}>
        🧩 Собрать стек
      </button>

      {buildError && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.1)', color: '#f87171', fontSize: 9, marginBottom: 8 }}>
          {buildError}
        </div>
      )}

      {/* Results */}
      {result && (
        <GlassCard title={`Готовый стек: ${result.stack.length} компонентов`} icon="🧩" color="#00e68a">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
            <StatBox label="Синергия" value={result.explanation.totalSynergyScore} color="#00e68a" />
            <StatBox label="Покрытие" value={`${result.explanation.completeness}%`} color="#8b5cf6" />
            <StatBox label="С дозировкой" value={`${result.explanation.totalDoseCount}/${result.stack.length}`} color="#60a5fa" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
            {result.explanation.substances.map(s => (
              <div key={s.id} style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{s.name}</span>
                  <span style={{ fontSize: 8, color: '#00e68a' }}>{s.role}</span>
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>🧬 {s.mechanism}</div>
                {s.dose && <div style={{ fontSize: 8, color: '#60a5fa' }}>💊 {s.dose}</div>}
              </div>
            ))}
          </div>
          {result.explanation.warnings.length > 0 && (
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', marginBottom: 6 }}>
              <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>⚠ Предупреждения:</div>
              {result.explanation.warnings.slice(0, 5).map((w, i) => (
                <div key={i} style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3 }}>• {w}</div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={handleSaveStack} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
            }}>💾 Сохранить стек</button>
            <button onClick={() => {
              const txt = result.explanation.substances.map(s => `${s.name} — ${s.dose || s.role}`).join('\n');
              navigator.clipboard.writeText(txt);
            }} style={{
              padding: '8px 14px', borderRadius: 10, fontSize: 9, fontWeight: 700, cursor: 'pointer',
              background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            }}>📋</button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 10, background: color + '08', border: '1px solid ' + color + '20', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STACK TAB — Active stack viewer with inline replacement
   ═══════════════════════════════════════════════════════════════════ */
function StackTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const explanation = useMemo(() => {
    if (stackIds.length === 0) return null;
    const fp = toFinderProfile(profile);
    return explainStack(stackIds, fp);
  }, [stackIds, profile]);

  const [replaceState, setReplaceState] = useState<Record<string, { open: boolean; results: ReplacementResult[]; loading: boolean }>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [savedStacks, setSavedStacks] = useState<string[][]>(() => {
    try { return JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]'); } catch { return []; }
  });

  const handleRemove = useCallback((id: string) => {
    setStackIds(stackIds.filter(s => s !== id));
  }, [stackIds, setStackIds]);

  const handleOpenReplace = useCallback((id: string) => {
    if (replaceState[id]?.open) { setReplaceState(prev => ({ ...prev, [id]: { ...prev[id], open: false } })); return; }
    setReplaceState(prev => ({ ...prev, [id]: { open: true, results: [], loading: true } }));
    const fp = toFinderProfile(profile);
    const results = findReplacement(id, 'functional', fp);
    setReplaceState(prev => ({ ...prev, [id]: { open: true, results, loading: false } }));
  }, [profile, replaceState]);

  const handleReplace = useCallback((oldId: string, newId: string) => {
    setStackIds(stackIds.map(s => s === oldId ? newId : s));
    setReplaceState(prev => ({ ...prev, [oldId]: { open: false, results: [], loading: false } }));
  }, [stackIds, setStackIds]);

  const handleSaveStack = useCallback(() => {
    if (stackIds.length === 0) return;
    const existing: string[][] = JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]');
    const updated = [stackIds, ...existing].slice(0, 10);
    localStorage.setItem('he_finder_saved_stacks', JSON.stringify(updated));
    setSavedStacks(updated);
  }, [stackIds]);

  const handleClear = useCallback(() => {
    setStackIds([]);
  }, [setStackIds]);

  const catLabel = (c: string) => CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] || c;

  const cardHeaderS: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
    padding: '12px 14px', borderRadius: 12,
    background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)',
  };
  const cardBodyS: React.CSSProperties = {
    padding: '0 14px 14px', marginTop: -6, borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    background: 'rgba(24,24,27,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderTop: 'none',
  };

  if (stackIds.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Стек пуст</div>
        <div style={{ fontSize: 10, maxWidth: 280, margin: '0 auto', lineHeight: 1.5, marginBottom: 16 }}>
          Добавьте препараты через 🔍 Поиск или 🧩 Сборка
        </div>
        {savedStacks.length > 0 && (
          <GlassCard title="💾 Сохранённые стеки" icon="📂" color="#8b5cf6">
            {savedStacks.map((stk, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Стек #{i + 1} ({stk.length} шт)</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setStackIds(stk)}
                    style={{ padding: '4px 10px', borderRadius: 8, fontSize: 8, cursor: 'pointer', fontWeight: 600,
                      background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>
                    📥 Загрузить
                  </button>
                  <button onClick={() => {
                    const updated = savedStacks.filter((_, j) => j !== i);
                    localStorage.setItem('he_finder_saved_stacks', JSON.stringify(updated));
                    setSavedStacks(updated);
                  }}
                    style={{ padding: '4px 8px', borderRadius: 8, fontSize: 8, cursor: 'pointer', fontWeight: 600,
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </GlassCard>
        )}
      </div>
    );
  }

  const containerS: React.CSSProperties = { paddingBottom: 80 };

  return (
    <div style={containerS}>
      {/* Summary bar */}
      <GlassCard title={`📋 Стек • ${stackIds.length} компонентов`} icon="📊" color="#00e68a">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
          <StatBox label="Компонентов" value={stackIds.length} color="#00e68a" />
          <StatBox label="Синергия" value={explanation?.totalSynergyScore ?? 0} color="#8b5cf6" />
          <StatBox label="Покрытие" value={`${explanation?.completeness ?? 0}%`} color="#60a5fa" />
          <StatBox label="С дозой" value={`${explanation?.totalDoseCount ?? 0}/${stackIds.length}`} color="#f59e0b" />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={handleSaveStack} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a',
          }}>💾 Сохранить стек</button>
          <button onClick={handleClear} style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444',
          }}>🗑 Очистить</button>
        </div>
      </GlassCard>

      {/* Warnings */}
      {explanation?.warnings && explanation.warnings.length > 0 && (
        <GlassCard title="⚠ Предупреждения" icon="⚠" color="#ef4444">
          {explanation.warnings.slice(0, 6).map((w, i) => (
            <div key={i} style={{ fontSize: 9, color: '#f87171', lineHeight: 1.4, padding: '2px 0' }}>• {w}</div>
          ))}
        </GlassCard>
      )}

      {/* Substance cards */}
      {explanation?.substances.map(entry => {
        const cat = SUPPORT_CATALOG_DATA[entry.id];
        if (!cat) return null;
        const isExpanded = expanded[entry.id];
        const replace = replaceState[entry.id];
        const synergiesInStack = explanation.substances
          .filter(s => s.id !== entry.id)
          .map(s => {
            const found = entry.synergiesWith.find(x => x.with === s.id);
            return found ? { name: s.name || '', effect: found.effect } : null;
          })
          .filter((x): x is { name: string; effect: string } => x !== null);

        return (
          <GlassCard key={entry.id} style={{ marginBottom: 8 }}>
            {/* Header — clickable expand */}
            <div onClick={() => setExpanded(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))} style={cardHeaderS}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                  {cat.nameRu || cat.name}
                  <span style={{ fontSize: 8, color: '#00e68a', marginLeft: 6, fontWeight: 600 }}>({entry.role})</span>
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[cat.tier, ...(cat.category?.slice(0, 2) || [])].filter(Boolean).map((c, i) => (
                    <span key={i} style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(0,230,138,0.08)', color: '#00e68a', fontSize: 7 }}>{catLabel(c)}</span>
                  ))}
                  <span style={{ color: '#60a5fa', fontSize: 7 }}>{cat.bestForm || (cat.forms?.find(f => f.best)?.nameRu || cat.forms?.[0]?.nameRu || '')}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div style={cardBodyS}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 8 }}>
                  🧬 <strong style={{ color: '#a78bfa' }}>Механизм:</strong> {entry.mechanism}
                </div>

                {cat.description && (
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, marginBottom: 6 }}>
                    📝 {cat.description}
                  </div>
                )}

                {entry.dose && (
                  <div style={{ fontSize: 9, color: '#60a5fa', marginBottom: 6 }}>
                    💊 <strong>Дозировка:</strong> {entry.dose}
                  </div>
                )}
                {cat.dosage && (
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                    ⏱ {cat.dosage.timing ? `Приём: ${cat.dosage.timing}` : ''} {cat.dosage.mg ? `• ${cat.dosage.mg} мг${cat.dosage.form ? ' (' + cat.dosage.form + ')' : ''}` : ''}
                  </div>
                )}

                {/* Synergies within stack */}
                {synergiesInStack.length > 0 && (
                  <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)', marginBottom: 6 }}>
                    <div style={{ fontSize: 7, color: '#8b5cf6', fontWeight: 600, marginBottom: 2 }}>🤝 Синергии в стеке:</div>
                    {synergiesInStack.map((s, i) => (
                      <div key={i} style={{ fontSize: 8, color: '#a78bfa', lineHeight: 1.3 }}>• {s.name} → {s.effect}</div>
                    ))}
                  </div>
                )}

                {/* Organs */}
                {cat.organs && cat.organs.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                    {cat.organs.map((o: string, i: number) => (
                      <span key={i} style={{ padding: '2px 6px', borderRadius: 6, background: 'rgba(96,165,250,0.08)', color: '#60a5fa', fontSize: 7 }}>
                        {ORGANS.find(x => x.key === o)?.label || o}
                      </span>
                    ))}
                  </div>
                )}

                {/* Contraindications */}
                {cat.contraindications && cat.contraindications.length > 0 && (
                  <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.06)', marginBottom: 6 }}>
                    <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>⚠ Противопоказания:</div>
                    <div style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3 }}>{cat.contraindications.slice(0, 3).join(', ')}</div>
                  </div>
                )}

                {/* Side effects */}
                {cat.sideEffects && cat.sideEffects.length > 0 && (
                  <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.06)', marginBottom: 6 }}>
                    <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 2 }}>⚡ Побочные:</div>
                    <div style={{ fontSize: 8, color: '#fbbf24', lineHeight: 1.3 }}>{cat.sideEffects.slice(0, 3).join(', ')}</div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button onClick={() => handleOpenReplace(entry.id)} style={{
                    flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                    background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', color: '#8b5cf6',
                  }}>
                    {replace?.open ? '✕ Закрыть замены' : '🔄 Заменить'}
                  </button>
                  <button onClick={() => handleRemove(entry.id)} style={{
                    padding: '6px 10px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444',
                  }}>✕ Удалить</button>
                </div>

                {/* Inline replacement results */}
                {replace?.open && (
                  <div style={{ marginTop: 8 }}>
                    {replace.loading ? (
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 12 }}>Загрузка замен...</div>
                    ) : replace.results.length > 0 ? (
                      <>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>🔁 Рекомендуемые замены:</div>
                        {replace.results.slice(0, 6).map((r, i) => (
                          <div key={i} onClick={() => handleReplace(entry.id, r.replacementId)}
                            style={{
                              padding: '8px 10px', marginBottom: 4, borderRadius: 8, cursor: 'pointer',
                              background: r.personalMatch ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${r.personalMatch ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)'}`,
                              transition: 'all 0.15s',
                            }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{r.replacementName}</span>
                              <div style={{ display: 'flex', gap: 3 }}>
                                <span style={{ padding: '1px 5px', borderRadius: 4, fontSize: 7, fontWeight: 600,
                                  background: r.tierChange === 'upgrade' ? 'rgba(0,230,138,0.1)' : r.tierChange === 'downgrade' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                                  color: r.tierChange === 'upgrade' ? '#00e68a' : r.tierChange === 'downgrade' ? '#ef4444' : 'rgba(255,255,255,0.3)',
                                }}>
                                  {r.tierChange === 'upgrade' ? '↑ UPGRADE' : r.tierChange === 'downgrade' ? '↓ DOWNGRADE' : '∼ SAME'}
                                </span>
                                <span style={{ padding: '1px 5px', borderRadius: 4, fontSize: 7, fontWeight: 600,
                                  background: r.priceDelta === 'cheaper' ? 'rgba(0,230,138,0.1)' : r.priceDelta === 'expensive' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                                  color: r.priceDelta === 'cheaper' ? '#00e68a' : r.priceDelta === 'expensive' ? '#ef4444' : 'rgba(255,255,255,0.3)',
                                }}>
                                  {r.priceDelta === 'cheaper' ? '💰 Дешевле' : r.priceDelta === 'expensive' ? '💰 Дороже' : '💰 ∼'}
                                </span>
                              </div>
                            </div>
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{r.reason}</div>
                            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', lineHeight: 1.3 }}>
                              {r.explanation}
                              {r.bestForm && <span style={{ color: '#60a5fa' }}> • 💊 {r.bestForm}</span>}
                            </div>
                            {r.safetyNote && (
                              <div style={{ fontSize: 7, color: '#f59e0b', marginTop: 2 }}>🛡️ {r.safetyNote}</div>
                            )}
                            {r.personalMatch && (
                              <div style={{ fontSize: 7, color: '#00e68a', marginTop: 2 }}>🎯 Персональная рекомендация</div>
                            )}
                          </div>
                        ))}
                      </>
                    ) : (
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 8 }}>Нет подходящих замен</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   RISKS TAB — Three-tier interaction analysis for active stack
   ═══════════════════════════════════════════════════════════════════ */
function RisksTab({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const analysis = useMemo(() => {
    if (stackIds.length < 2) return null;
    const catData = SUPPORT_CATALOG_DATA;
    const pairs: {
      a: string; b: string; nameA: string; nameB: string;
      type: string; effect: string; severity: string; mechanisms: string[]; notes: string;
    }[] = [];
    for (let i = 0; i < stackIds.length; i++) {
      for (let j = i + 1; j < stackIds.length; j++) {
        const idA = stackIds[i], idB = stackIds[j];
        const pairKey1 = `${idA}|${idB}`, pairKey2 = `${idB}|${idA}`;
        const all = ALL_INTERACTIONS;
        const direct = all.filter(inx =>
          (inx.substanceA === idA && inx.substanceB === idB) ||
          (inx.substanceA === idB && inx.substanceB === idA));
        if (direct.length > 0) {
          direct.forEach(inx => {
            pairs.push({
              a: idA, b: idB,
              nameA: catData[idA]?.nameRu || catData[idA]?.name || idA,
              nameB: catData[idB]?.nameRu || catData[idB]?.name || idB,
              type: inx.type,
              effect: inx.effect,
              severity: inx.severity,
              mechanisms: inx.mechanisms || [],
              notes: inx.notes || '',
            });
          });
        } else {
          pairs.push({
            a: idA, b: idB,
            nameA: catData[idA]?.nameRu || catData[idA]?.name || idA,
            nameB: catData[idB]?.nameRu || catData[idB]?.name || idB,
            type: 'no_interaction', effect: 'Взаимодействий не найдено',
            severity: 'LOW', mechanisms: [], notes: '',
          });
        }
      }
    }
    const critical = pairs.filter(p => p.severity === 'HIGH' && (p.type === 'conflict' || p.type === 'caution'));
    const moderate = pairs.filter(p => p.severity === 'MEDIUM' && (p.type === 'conflict' || p.type === 'caution'));
    const cumulative = pairs.filter(p => (p.severity === 'LOW' || p.type === 'synergy' || p.type === 'no_interaction'));
    return { pairs, critical, moderate, cumulative, total: pairs.length };
  }, [stackIds]);

  const [expandedPair, setExpandedPair] = useState<Record<string, boolean>>({});
  const [showSafe, setShowSafe] = useState(false);

  if (stackIds.length < 2) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Нет пар для анализа</div>
        <div style={{ fontSize: 10, maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>Добавьте минимум 2 препарата в стек для расчёта взаимодействий</div>
      </div>
    );
  }

  if (!analysis) return null;

  const severityColor = (s: string) => s === 'HIGH' ? '#ef4444' : s === 'MEDIUM' ? '#f59e0b' : '#22c55e';
  const severityLabel = (s: string) => s === 'HIGH' ? '🔴 Высокий' : s === 'MEDIUM' ? '🟡 Средний' : '🟢 Низкий';

  const typeIcon = (t: string) =>
    t === 'conflict' ? '🚫' : t === 'caution' ? '⚡' : t === 'synergy' ? '🤝' : '➖';

  const SectionCard: React.FC<{ title: string; icon: string; color: string; items: typeof analysis.critical; defaultOpen?: boolean }> =
    ({ title, icon, color, items, defaultOpen }) => (
    <GlassCard title={`${icon} ${title} (${items.length})`} color={color}>
      {items.length === 0 ? (
        <div style={{ fontSize: 10, color: '#22c55e', textAlign: 'center', padding: 8 }}>
          ✅ Не обнаружено
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((p, idx) => {
            const key = `${p.a}|${p.b}|${p.type}|${idx}`;
            const open = expandedPair[key] ?? (defaultOpen ?? true);
            return (
              <div key={key} style={{
                padding: '8px 10px', borderRadius: 10,
                background: `${severityColor(p.severity)}06`,
                border: `1px solid ${severityColor(p.severity)}12`,
              }}>
                <div onClick={() => setExpandedPair(prev => ({ ...prev, [key]: !open }))}
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{typeIcon(p.type)}</span>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{p.nameA}</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', margin: '0 4px' }}>↔</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{p.nameB}</span>
                    </div>
                    <span style={{ padding: '2px 5px', borderRadius: 4, fontSize: 7, fontWeight: 600,
                      background: `${severityColor(p.severity)}18`, color: severityColor(p.severity) }}>
                      {severityLabel(p.severity)}
                    </span>
                  </div>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{open ? '▲' : '▼'}</span>
                </div>
                {open && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, marginBottom: 4 }}>
                      {typeIcon(p.type)} {p.effect}
                    </div>
                    {p.mechanisms.length > 0 && (
                      <div style={{ fontSize: 7, color: '#a78bfa', marginBottom: 2 }}>
                        🧬 Механизмы: {p.mechanisms.join(', ')}
                      </div>
                    )}
                    {p.notes && (
                      <div style={{ fontSize: 7, color: '#f59e0b', lineHeight: 1.3 }}>
                        📝 {p.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Summary bar */}
      <GlassCard title={`⚠ Анализ взаимодействий`} icon="📊" color="#f59e0b">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
          <StatBox label="Всего пар" value={analysis.total} color="#60a5fa" />
          <StatBox label="Критических" value={analysis.critical.length} color="#ef4444" />
          <StatBox label="Умеренных" value={analysis.moderate.length} color="#f59e0b" />
          <StatBox label="Безопасных" value={analysis.cumulative.length} color="#22c55e" />
        </div>
      </GlassCard>

      <SectionCard title="🔴 Критические" icon="🚫" color="#ef4444" items={analysis.critical} defaultOpen={true} />
      <SectionCard title="🟡 Умеренные" icon="⚡" color="#f59e0b" items={analysis.moderate} defaultOpen={true} />
      <SectionCard title="🟢 Безопасные / Нет данных" icon="➖" color="#22c55e" items={analysis.cumulative} defaultOpen={false} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPARE TAB — Current vs Optimized stack
   ═══════════════════════════════════════════════════════════════════ */
function CompareTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [optimized, setOptimized] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const currentExplanation = useMemo(() => {
    if (stackIds.length === 0) return null;
    return explainStack(stackIds, toFinderProfile(profile));
  }, [stackIds, profile]);

  const optimizedExplanation = useMemo(() => {
    if (!optimized) return null;
    return explainStack(optimized, toFinderProfile(profile));
  }, [optimized, profile]);

  const handleOptimize = useCallback(() => {
    if (stackIds.length === 0) return;
    setLoading(true);
    setTimeout(() => {
      const fp = toFinderProfile(profile);
      const result = buildStack({
        baseIds: stackIds, targetSize: Math.max(stackIds.length, 8),
        goal: profile.goals[0] || undefined,
        autoFill: true, profile: fp,
      });
      setOptimized(result.stack);
      setLoading(false);
    }, 300);
  }, [stackIds, profile]);

  const handleReplace = useCallback(() => {
    if (optimized) setStackIds(optimized);
  }, [optimized, setStackIds]);

  if (stackIds.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚖</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Стек пуст</div>
        <div style={{ fontSize: 10, maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>Сначала соберите стек в 🔍 Поиск или 🧩 Сборка</div>
      </div>
    );
  }

  const MetricRow: React.FC<{ label: string; current: string | number; optimized: string | number; color: string; better: 'up' | 'down' | 'same' }> =
    ({ label, current, optimized, color, better }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Текущий: {current}</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>→</span>
        <span style={{ fontSize: 10, color, fontWeight: 700 }}>{optimized}</span>
        <span style={{ fontSize: 7 }}>
          {better === 'up' ? '▲' : better === 'down' ? '▼' : '—'}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="⚖ Сравнение стеков" icon="📊" color="#8b5cf6">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 8, lineHeight: 1.4 }}>
          Текущий стек: <strong style={{ color: '#fff' }}>{stackIds.length} компонентов</strong>
          {optimized ? ` → Оптимизированный: ${optimized.length} компонентов` : ''}
        </div>
        {!optimized && (
          <button onClick={handleOptimize} disabled={loading} style={{
            width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
            background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6',
          }}>
            {loading ? '⏳ Оптимизация...' : '⚡ Оптимизировать стек'}
          </button>
        )}
      </GlassCard>

      {optimized && (
        <>
          {/* Stats comparison */}
          <GlassCard title="📊 Метрики" icon="📈" color="#60a5fa">
            <MetricRow label="Синергия" color="#8b5cf6"
              current={currentExplanation?.totalSynergyScore ?? 0}
              optimized={optimizedExplanation?.totalSynergyScore ?? 0}
              better={(optimizedExplanation?.totalSynergyScore ?? 0) >= (currentExplanation?.totalSynergyScore ?? 0) ? 'up' : 'down'} />
            <MetricRow label="Покрытие целей" color="#60a5fa"
              current={`${currentExplanation?.completeness ?? 0}%`}
              optimized={`${optimizedExplanation?.completeness ?? 0}%`}
              better={(optimizedExplanation?.completeness ?? 0) >= (currentExplanation?.completeness ?? 0) ? 'up' : 'down'} />
            <MetricRow label="Компонентов" color="#00e68a"
              current={stackIds.length}
              optimized={optimized.length}
              better={optimized.length !== stackIds.length ? 'up' : 'same'} />
            <MetricRow label="С дозировкой" color="#f59e0b"
              current={`${currentExplanation?.totalDoseCount ?? 0}/${stackIds.length}`}
              optimized={`${optimizedExplanation?.totalDoseCount ?? 0}/${optimized.length}`}
              better={(optimizedExplanation?.totalDoseCount ?? 0) >= (currentExplanation?.totalDoseCount ?? 0) ? 'up' : 'down'} />
            <MetricRow label="Предупреждений" color="#ef4444"
              current={currentExplanation?.warnings.length ?? 0}
              optimized={optimizedExplanation?.warnings.length ?? 0}
              better={(optimizedExplanation?.warnings.length ?? 0) <= (currentExplanation?.warnings.length ?? 0) ? 'up' : 'down'} />
          </GlassCard>

          {/* Visual diff */}
          <GlassCard title="🔍 Состав: текущий vs оптимизированный" icon="📋" color="#00e68a">
            <button onClick={() => setShowDetails(!showDetails)}
              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 8, cursor: 'pointer', fontWeight: 600, marginBottom: 6,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
              {showDetails ? '▲ Скрыть детали' : '▼ Показать детали'}
            </button>
            {showDetails && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 4 }}>Текущий стек:</div>
                  {currentExplanation?.substances.map(s => (
                    <div key={s.id} style={{ fontSize: 8, color: '#fff', padding: '2px 0' }}>• {s.name}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 8, color: '#00e68a', fontWeight: 600, marginBottom: 4 }}>Оптимизированный:</div>
                  {optimizedExplanation?.substances.map(s => (
                    <div key={s.id} style={{ fontSize: 8, color: '#00e68a', padding: '2px 0' }}>• {s.name}</div>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>

          {/* Replace button */}
          <button onClick={handleReplace} style={{
            width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 8,
            background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
          }}>
            📥 Заменить текущий стек оптимизированным
          </button>

          {/* Optimized warnings */}
          {optimizedExplanation?.warnings && optimizedExplanation.warnings.length > 0 && (
            <GlassCard title="⚠ Предупреждения оптимизированного" icon="⚠" color="#ef4444">
              {optimizedExplanation.warnings.slice(0, 5).map((w, i) => (
                <div key={i} style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3, padding: '2px 0' }}>• {w}</div>
              ))}
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   REPORTS TAB — Generate and archive stack reports
   ═══════════════════════════════════════════════════════════════════ */
function ReportsTab({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const [reports, setReports] = useState<{ date: string; text: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_biostack_reports') || '[]'); } catch { return []; }
  });
  const [currentReport, setCurrentReport] = useState<string>('');

  const explanation = useMemo(() => {
    if (stackIds.length === 0) return null;
    return explainStack(stackIds, toFinderProfile(profile));
  }, [stackIds, profile]);

  const handleGenerate = useCallback(() => {
    if (!explanation || stackIds.length === 0) { setCurrentReport('❌ Стек пуст. Добавьте препараты через 🔍 Поиск или 🧩 Сборка.'); return; }
    const catData = SUPPORT_CATALOG_DATA;
    const date = new Date().toLocaleString('ru-RU');
    const lines: string[] = [];
    lines.push('═══════════════════════════════════════════');
    lines.push(`  🧬 BioStack AI — Отчёт стека`);
    lines.push(`  📅 ${date}`);
    lines.push(`  📋 Компонентов: ${stackIds.length}`);
    lines.push(`  🎯 Синергия: ${explanation.totalSynergyScore}`);
    lines.push(`  📊 Покрытие: ${explanation.completeness}%`);
    lines.push(`  💊 С дозировкой: ${explanation.totalDoseCount}/${stackIds.length}`);
    lines.push('═══════════════════════════════════════════');
    lines.push('');
    lines.push('📋 СОСТАВ СТЕКА:');
    explanation.substances.forEach(s => {
      const cat = catData[s.id];
      const name = cat?.nameRu || cat?.name || s.name;
      const dose = s.dose || cat?.dosage?.mg ? `${cat.dosage.mg} мг${cat.dosage.timing ? ' — ' + cat.dosage.timing : ''}` : '—';
      lines.push(`  • ${name} (${s.role})`);
      lines.push(`    🧬 ${s.mechanism}`);
      lines.push(`    💊 ${dose}`);
      if (s.synergiesWith.length > 0) {
        lines.push(`    🤝 Синергии: ${s.synergiesWith.map(x => x.with + ' → ' + x.effect).join(', ')}`);
      }
    });
    if (explanation.pairwiseSynergies.length > 0) {
      lines.push('');
      lines.push('🤝 ПАРНЫЕ СИНЕРГИИ:');
      explanation.pairwiseSynergies.forEach(p => {
        const na = catData[p.a]?.nameRu || catData[p.a]?.name || p.a;
        const nb = catData[p.b]?.nameRu || catData[p.b]?.name || p.b;
        lines.push(`  • ${na} + ${nb}: ${p.effect} (${p.severity})`);
      });
    }
    if (explanation.warnings.length > 0) {
      lines.push('');
      lines.push('⚠ ПРЕДУПРЕЖДЕНИЯ:');
      explanation.warnings.forEach(w => lines.push(`  • ${w}`));
    }
    lines.push('');
    lines.push('═══════════════════════════════════════════');
    const text = lines.join('\n');
    setCurrentReport(text);
  }, [explanation, stackIds]);

  const handleSave = useCallback(() => {
    if (!currentReport || currentReport.startsWith('❌')) return;
    const date = new Date().toLocaleString('ru-RU');
    const updated = [{ date, text: currentReport }, ...reports].slice(0, 20);
    localStorage.setItem('he_biostack_reports', JSON.stringify(updated));
    setReports(updated);
  }, [currentReport, reports]);

  const handleCopy = useCallback(() => {
    if (currentReport) navigator.clipboard.writeText(currentReport);
  }, [currentReport]);

  const handleDeleteReport = useCallback((idx: number) => {
    const updated = reports.filter((_, i) => i !== idx);
    localStorage.setItem('he_biostack_reports', JSON.stringify(updated));
    setReports(updated);
  }, [reports]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="📊 Генерация отчёта" icon="📄" color="#60a5fa">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
          Стек: <strong>{stackIds.length} компонентов</strong>
          {explanation && ` • Синергия: ${explanation.totalSynergyScore} • Покрытие: ${explanation.completeness}%`}
        </div>
        <button onClick={handleGenerate} style={{
          width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer', marginBottom: 6,
          background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa',
        }}>📄 Сгенерировать отчёт</button>
        {currentReport && (
          <>
            <div style={{
              padding: 10, borderRadius: 8, background: '#202023', border: '1px solid rgba(255,255,255,0.04)',
              fontSize: 8, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, whiteSpace: 'pre-wrap',
              fontFamily: 'monospace', maxHeight: 300, overflowY: 'auto', marginBottom: 6,
            }}>{currentReport}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={handleSave} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
              }}>💾 Сохранить</button>
              <button onClick={handleCopy} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
              }}>📋</button>
            </div>
          </>
        )}
      </GlassCard>

      {reports.length > 0 && (
        <GlassCard title={`📂 Архив отчётов (${reports.length})`} icon="🗂" color="#8b5cf6">
          {reports.map((r, i) => (
            <div key={i} style={{
              padding: '8px 10px', marginBottom: 4, borderRadius: 8, cursor: 'pointer',
              background: currentReport === r.text ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${currentReport === r.text ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)'}`,
            }}
              onClick={() => setCurrentReport(r.text)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: '#fff' }}>📄 {r.date}</span>
                <button onClick={e => { e.stopPropagation(); handleDeleteReport(i); }}
                  style={{ padding: '2px 6px', borderRadius: 4, fontSize: 7, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                  ✕
                </button>
              </div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.text.split('\n').slice(2, 5).join(' • ')}
              </div>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AI TAB — Rule-based assistant actions
   ═══════════════════════════════════════════════════════════════════ */
function AITab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const explanation = useMemo(() => {
    if (stackIds.length === 0) return null;
    return explainStack(stackIds, toFinderProfile(profile));
  }, [stackIds, profile]);

  const actions: { id: string; icon: string; label: string; desc: string; color: string }[] = [
    { id: 'why_worse', icon: '🤔', label: 'Почему мне хуже?', desc: 'Анализ возможных причин ухудшения самочувствия на текущем стеке', color: '#ef4444' },
    { id: 'optimize', icon: '⚡', label: 'Оптимизировать стек', desc: 'Улучшить синергию, покрытие целей и убрать лишние компоненты', color: '#8b5cf6' },
    { id: 'best_stack', icon: '🏆', label: 'Собрать лучший стек', desc: 'Построить оптимальный стек с нуля под ваш профиль и цели', color: '#00e68a' },
    { id: 'cheaper', icon: '💰', label: 'Сделать дешевле', desc: 'Заменить дорогие компоненты на более бюджетные аналоги', color: '#f59e0b' },
    { id: 'remove_risks', icon: '🛡️', label: 'Убрать риски', desc: 'Выявить и предложить замены для опасных комбинаций', color: '#60a5fa' },
  ];

  const handleAction = useCallback((actionId: string) => {
    setLoading(actionId);
    setResult(null);
    setTimeout(() => {
      const catData = SUPPORT_CATALOG_DATA;
      switch (actionId) {
        case 'why_worse': {
          if (!explanation || stackIds.length === 0) {
            setResult('❌ Стек пуст. Добавьте препараты.');
            break;
          }
          const lines: string[] = ['🤔 Анализ ухудшения самочувствия', ''];

          // Check interactions
          const conflicts: string[] = [];
          for (let i = 0; i < stackIds.length; i++) {
            for (let j = i + 1; j < stackIds.length; j++) {
              const idA = stackIds[i], idB = stackIds[j];
              const pair = ALL_INTERACTIONS.filter(inx =>
                (inx.substanceA === idA && inx.substanceB === idB) ||
                (inx.substanceA === idB && inx.substanceB === idA));
              pair.forEach(p => {
                if (p.type === 'conflict' || p.type === 'caution') {
                  const na = catData[idA]?.nameRu || catData[idA]?.name || idA;
                  const nb = catData[idB]?.nameRu || catData[idB]?.name || idB;
                  conflicts.push(`• ${na} + ${nb}: ${p.effect} (${p.severity === 'HIGH' ? '🔴' : '🟡'} ${p.severity})`);
                }
              });
            }
          }
          if (conflicts.length > 0) {
            lines.push('🚫 Конфликты в стеке:');
            lines.push(...conflicts);
          } else {
            lines.push('✅ Конфликтов не обнаружено');
          }

          // Check warnings
          if (explanation.warnings.length > 0) {
            lines.push('');
            lines.push('⚠ Системные предупреждения:');
            explanation.warnings.slice(0, 5).forEach(w => lines.push(`• ${w}`));
          }

          // Stack size
          if (stackIds.length > 12) {
            lines.push('');
            lines.push(`📏 Стек большой (${stackIds.length} шт). Возможна перегрузка ЖКТ и печени.`);
          }

          lines.push('');
          lines.push('💡 Рекомендация: используйте ⚡ Оптимизировать стек для уменьшения нагрузки.');
          setResult(lines.join('\n'));
          break;
        }
        case 'optimize': {
          if (stackIds.length === 0) { setResult('❌ Стек пуст'); break; }
          const fp = toFinderProfile(profile);
          const opt = buildStack({
            baseIds: stackIds, targetSize: Math.max(stackIds.length, 8),
            goal: profile.goals[0] || undefined,
            autoFill: true, profile: fp,
          });
          const optExp = explainStack(opt.stack, fp);
          const lines: string[] = [
            '⚡ Оптимизированный стек',
            `📊 ${stackIds.length} → ${opt.stack.length} компонентов`,
            `🤝 Синергия: ${explanation?.totalSynergyScore ?? 0} → ${optExp.totalSynergyScore}`,
            `📊 Покрытие: ${explanation?.completeness ?? 0}% → ${optExp.completeness}%`,
            '',
            '📋 Состав:',
          ];
          optExp.substances.forEach(s => lines.push(`• ${s.name} — ${s.role}`));
          if (optExp.warnings.length > 0) {
            lines.push('', '⚠ Предупреждения:');
            optExp.warnings.slice(0, 3).forEach(w => lines.push(`• ${w}`));
          }
          lines.push('', '💾 Нажмите «Заменить стек» ниже, чтобы применить.');
          setResult(lines.join('\n'));
          break;
        }
        case 'best_stack': {
          const fp = toFinderProfile(profile);
          const best = buildStack({
            baseIds: stackIds, targetSize: 10,
            goal: profile.goals[0] || undefined,
            autoFill: true, profile: fp,
          });
          const bestExp = explainStack(best.stack, fp);
          const lines: string[] = [
            '🏆 Лучший стек для вашего профиля',
            `📊 ${best.stack.length} компонентов | 🤝 Синергия: ${bestExp.totalSynergyScore} | 📊 Покрытие: ${bestExp.completeness}%`,
            '',
            '📋 Состав:',
          ];
          bestExp.substances.forEach(s => {
            const cat = catData[s.id];
            const dose = s.dose || cat?.dosage?.mg ? `${cat.dosage.mg} мг` : '';
            lines.push(`• ${s.name} — ${s.role}${dose ? ' | 💊 ' + dose : ''}`);
          });
          bestExp.substances.forEach(s => {
            const syns = s.synergiesWith.slice(0, 3);
            if (syns.length > 0) {
              lines.push(`  🤝 ${syns.map(x => x.with + ' → ' + x.effect).join(', ')}`);
            }
          });
          if (bestExp.warnings.length > 0) {
            lines.push('', '⚠ Предупреждения:');
            bestExp.warnings.slice(0, 3).forEach(w => lines.push(`• ${w}`));
          }
          setResult(lines.join('\n'));
          break;
        }
        case 'cheaper': {
          if (stackIds.length === 0) { setResult('❌ Стек пуст'); break; }
          const lines: string[] = ['💰 Оптимизация бюджета', ''];
          let found = false;
          stackIds.forEach(id => {
            const replacements = findReplacement(id, 'cheaper', toFinderProfile(profile));
            if (replacements.length > 0) {
              const r = replacements[0];
              const cat = catData[id];
              const name = cat?.nameRu || cat?.name || id;
              lines.push(`• ${name} → ${r.replacementName} (${r.priceDelta === 'cheaper' ? '💰 Дешевле' : '💰 ∼'})`);
              lines.push(`  ${r.reason}`);
              found = true;
            }
          });
          if (!found) lines.push('✅ Нет доступных бюджетных замен');
          lines.push('', '💡 Замены можно применить в 📋 Мой стек через 🔄 Заменить.');
          setResult(lines.join('\n'));
          break;
        }
        case 'remove_risks': {
          if (stackIds.length < 2) { setResult('❌ В стеке менее 2 препаратов, нет пар для анализа.'); break; }
          const lines: string[] = ['🛡️ Анализ и устранение рисков', ''];
          let riskCount = 0;
          for (let i = 0; i < stackIds.length; i++) {
            for (let j = i + 1; j < stackIds.length; j++) {
              const idA = stackIds[i], idB = stackIds[j];
              const pair = ALL_INTERACTIONS.filter(inx =>
                (inx.substanceA === idA && inx.substanceB === idB) ||
                (inx.substanceA === idB && inx.substanceB === idA));
              pair.forEach(p => {
                if (p.severity === 'HIGH' && p.type !== 'synergy') {
                  const na = catData[idA]?.nameRu || catData[idA]?.name || idA;
                  const nb = catData[idB]?.nameRu || catData[idB]?.name || idB;
                  lines.push(`🔴 ${na} + ${nb}: ${p.effect}`);
                  const replace = findReplacement(idA, 'safer', toFinderProfile(profile));
                  if (replace.length > 0) {
                    lines.push(`   → Замена: ${replace[0].replacementName}`);
                  }
                  riskCount++;
                }
              });
            }
          }
          if (riskCount === 0) lines.push('✅ Критических рисков не обнаружено');
          lines.push('', '💡 Для замен используйте 🔄 в 📋 Мой стек.');
          setResult(lines.join('\n'));
          break;
        }
        default: setResult('Неизвестное действие');
      }
      setLoading(null);
    }, 400);
  }, [explanation, stackIds, profile]);

  const handleApplyStack = useCallback(() => {
    if (!result) return;
    const optLine = result.split('\n').find(l => l.startsWith('📊'));
    if (!optLine) return;
    try {
      const catData = SUPPORT_CATALOG_DATA;
      const substLines = result.split('\n').filter(l => l.startsWith('• '));
      const ids: string[] = [];
      substLines.forEach(l => {
        const name = l.replace('• ', '').split(' — ')[0].trim();
        const entry = Object.entries(catData).find(([_, v]) => v.nameRu === name || v.name === name);
        if (entry) ids.push(entry[0]);
      });
      if (ids.length > 0) setStackIds(ids);
    } catch { /* ignore */ }
  }, [result, setStackIds]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="🧠 AI-ассистент стека" icon="🤖" color="#8b5cf6">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
          Стек: <strong>{stackIds.length} компонентов</strong>
          {explanation && ` • Синергия: ${explanation.totalSynergyScore}`}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {actions.map(a => (
            <button key={a.id} onClick={() => handleAction(a.id)} disabled={loading !== null} style={{
              padding: '10px 8px', borderRadius: 10, cursor: loading === a.id ? 'wait' : 'pointer',
              background: loading === a.id ? `${a.color}12` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${loading === a.id ? `${a.color}30` : 'rgba(255,255,255,0.06)'}`,
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{loading === a.id ? '⏳' : a.icon}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>{a.label}</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', lineHeight: 1.2, marginTop: 2 }}>{a.desc}</div>
            </button>
          ))}
        </div>
      </GlassCard>

      {loading && (
        <div style={{ textAlign: 'center', padding: 12 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>⏳ Анализ...</div>
        </div>
      )}

      {result && !loading && (
        <GlassCard title="📋 Результат" icon="💡" color="#00e68a">
          <div style={{
            padding: 10, borderRadius: 8, background: '#202023', border: '1px solid rgba(255,255,255,0.04)',
            fontSize: 8, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, whiteSpace: 'pre-wrap',
            fontFamily: 'monospace', maxHeight: 350, overflowY: 'auto', marginBottom: 6,
          }}>{result}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => navigator.clipboard.writeText(result)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
              background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            }}>📋 Копировать</button>
            {(result.includes('Оптимизированный') || result.includes('Лучший стек')) && (
              <button onClick={handleApplyStack} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
              }}>📥 Применить стек</button>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export const BioStackAIScreen: React.FC = () => {
  const [tab, setTab] = useState<BSTab>('profile');
  const [profile, setProfile] = useState<BioStackProfile>(() => loadBioStackProfile());
  const [stackIds, setStackIds] = useState<string[]>([]);

  return (
    <div style={{ padding: '0 0 80px' }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginBottom: 6 }}>
        🧬 BioStack AI — Операционная система управления БАДами
      </div>

      {/* ── Sub tab bar ── */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flexShrink: 0, padding: '7px 12px', borderRadius: 16, fontSize: 9, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
            background: tab === t.id ? 'var(--accent)' : '#202023',
            color: tab === t.id ? '#000' : 'rgba(255,255,255,0.7)',
            border: `1px solid ${tab === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)'}`,
            boxShadow: tab === t.id ? '0 0 12px rgba(0,230,138,0.2)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab profile={profile} setProfile={setProfile} />}
      {tab === 'search' && <SearchTab profile={profile} stackIds={stackIds} setStackIds={setStackIds} />}
      {tab === 'build' && <BuildTab profile={profile} stackIds={stackIds} setStackIds={setStackIds} />}
      {tab === 'stack' && <StackTab profile={profile} stackIds={stackIds} setStackIds={setStackIds} />}
      {tab === 'risks' && <RisksTab profile={profile} stackIds={stackIds} />}
      {tab === 'compare' && <CompareTab profile={profile} stackIds={stackIds} setStackIds={setStackIds} />}
      {tab === 'reports' && <ReportsTab profile={profile} stackIds={stackIds} />}
      {tab === 'ai' && <AITab profile={profile} stackIds={stackIds} setStackIds={setStackIds} />}
    </div>
  );
};
