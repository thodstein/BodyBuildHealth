import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  findSupplements, findReplacement, buildStack, explainStack,
  findSingleReplacementForStack, autoCompleteStack, saveProfile, loadProfile,
  type FinderMatch, type ReplacementResult, type StackExplanation,
  type FinderProfile, type GoalType, type ReplacementType,
  type HealthCondition, type AASStatus, type BudgetLevel, type ExperienceLevel,
} from '../../engines/supplement-finder.engine';
import { CATEGORY_LABELS } from '../../data/support-database';

/* ─── TYPES ─────────────────────────────────────────────────────────────── */
type FinderTab = 'finder' | 'replacer' | 'stack' | 'profile' | 'saved';
type ResultView = 'cards' | 'compare' | 'report';

/* ─── CONSTANTS ──────────────────────────────────────────────────────────── */
const GOALS: { key: GoalType; label: string; emoji: string }[] = [
  // 🏋️ Физическая форма
  { key:'muscle_gain', label:'Рост мышц', emoji:'💪' },
  { key:'fat_loss', label:'Снижение жира', emoji:'🔥' },
  { key:'endurance', label:'Выносливость', emoji:'🏃' },
  // 🔄 Восстановление
  { key:'sleep', label:'Качество сна', emoji:'😴' },
  { key:'recovery', label:'Восстановление', emoji:'🔄' },
  // ⚡ Энергия и тонус
  { key:'energy', label:'Энергия', emoji:'⚡' },
  { key:'libido', label:'Либидо', emoji:'🔥' },
  // 🧠 Когнитивные
  { key:'concentration', label:'Фокус', emoji:'🎯' },
  { key:'brain', label:'Память и когниция', emoji:'🧠' },
  // 😊 Психоэмоциональное
  { key:'mood', label:'Настроение', emoji:'😊' },
  { key:'stress', label:'Стресс', emoji:'🧘' },
  // ❤️ Системное здоровье
  { key:'cardio_health', label:'ССС', emoji:'❤️' },
  { key:'immunity', label:'Иммунитет', emoji:'🛡️' },
  { key:'hormones', label:'Гормоны', emoji:'⚖️' },
  { key:'joints', label:'Суставы', emoji:'🦴' },
  { key:'digestion', label:'ЖКТ', emoji:'🫃' },
  { key:'detox', label:'Детокс', emoji:'🧹' },
  // ⏳ Долгосрочные
  { key:'longevity', label:'Долголетие', emoji:'⏳' },
  // 🔬 Органы-мишени
  { key:'liver_health', label:'Печень', emoji:'🫁' },
  { key:'skin', label:'Кожа', emoji:'🧴' },
  { key:'hair', label:'Волосы', emoji:'💇' },
  { key:'kidney', label:'Почки', emoji:'🫘' },
];

const ORGANS: { key: string; label: string; emoji: string }[] = [
  { key:'BRAIN', label:'Мозг', emoji:'🧠' }, { key:'LIVER', label:'Печень', emoji:'🫁' },
  { key:'HEART', label:'Сердце', emoji:'❤️' }, { key:'KIDNEYS', label:'Почки', emoji:'🫘' },
  { key:'LUNGS', label:'Лёгкие', emoji:'🫁' }, { key:'MUSCLES', label:'Мышцы', emoji:'💪' },
  { key:'BONES', label:'Кости', emoji:'🦴' }, { key:'JOINTS', label:'Суставы', emoji:'🦴' },
  { key:'SKIN', label:'Кожа', emoji:'🧴' }, { key:'IMMUNE_SYSTEM', label:'Иммунитет', emoji:'🛡️' },
  { key:'NERVES', label:'Нервы', emoji:'⚡' }, { key:'GUT', label:'ЖКТ', emoji:'🫃' },
  { key:'VESSELS', label:'Сосуды', emoji:'🩸' }, { key:'ADRENALS', label:'Надпочечники', emoji:'⚖️' },
  { key:'THYROID', label:'Щитовидная', emoji:'🦋' }, { key:'REPRODUCTIVE', label:'Репродуктивная', emoji:'🧬' },
  { key:'PROSTATE', label:'Простата', emoji:'🔴' }, { key:'BLOOD', label:'Кровь', emoji:'🩸' },
  { key:'EYES', label:'Глаза', emoji:'👁️' }, { key:'PANCREAS', label:'Поджелудочная', emoji:'🫁' },
];

const REPLACEMENT_TYPES: { key: ReplacementType; label: string; desc: string; emoji: string }[] = [
  { key:'direct_analog', label:'Прямой аналог', desc:'Тот же эффект', emoji:'🔄' },
  { key:'functional', label:'Функциональный', desc:'Другой механизм', emoji:'🔀' },
  { key:'safer', label:'Безопаснее', desc:'Меньше побочек', emoji:'🛡️' },
  { key:'stronger', label:'Сильнее', desc:'Выше тир', emoji:'⚡' },
  { key:'cheaper', label:'Дешевле', desc:'Эконом-вариант', emoji:'💰' },
  { key:'stack_to_single', label:'Стек→1', desc:'Вместо комбинации', emoji:'📦' },
  { key:'single_to_stack', label:'1→Стек', desc:'Разделить', emoji:'🧩' },
];

const HEALTH_CONDS: { key: HealthCondition; label: string; emoji: string }[] = [
  { key:'liver', label:'Печень', emoji:'🫁' }, { key:'kidney', label:'Почки', emoji:'🫘' },
  { key:'heart', label:'Сердце', emoji:'❤️' }, { key:'thyroid', label:'Щитовидная', emoji:'🦋' },
  { key:'stomach', label:'Желудок', emoji:'🫃' }, { key:'pressure_high', label:'Давление ↑', emoji:'⬆️' },
  { key:'pressure_low', label:'Давление ↓', emoji:'⬇️' }, { key:'diabetes', label:'Диабет', emoji:'🍬' },
  { key:'autoimmune', label:'Аутоиммунные', emoji:'🛡️' },
];

/* ─── SUB-COMPONENTS ────────────────────────────────────────────────────── */
function Pill({ selected, label, onClick, color, small }: { selected: boolean; label: string; onClick: () => void; color?: string; small?: boolean }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '2px 7px' : '4px 10px', borderRadius: 12, fontSize: small ? 8 : 9, fontWeight: 700,
      cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
      background: selected ? (color || 'var(--accent)') : 'rgba(255,255,255,0.06)',
      color: selected ? '#000' : 'rgba(255,255,255,0.7)',
      border: `1px solid ${selected ? (color || 'var(--accent)') : 'rgba(255,255,255,0.08)'}`,
    }}>{label}</button>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PROFILE SECTION
   ════════════════════════════════════════════════════════════════════════════ */
function ProfileSection({ profile, setProfile }: { profile: FinderProfile; setProfile: (p: FinderProfile) => void }) {
  const u = (patch: Partial<FinderProfile>) => { const n = { ...profile, ...patch }; setProfile(n); saveProfile(n); };
  return (
    <div style={{ background: 'rgba(24,24,27,0.15)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>👤</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-light)' }}>Мой профиль</span>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto', cursor: 'pointer' }}
          onClick={() => { const d = { age:30, weight:80, height:175, sex:'male' as const, experience:'intermediate' as const, goals:['muscle_gain'] as GoalType[], aasStatus:'none' as const, healthConditions:[] as HealthCondition[], budget:'medium' as const, avoidIds:[], maxStackSize:8 }; setProfile(d); saveProfile(d); }}>
          Сбросить</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        {[
          { label:'Возраст', val: profile.age, set: (v: number) => u({ age: v }), unit: 'лет' },
          { label:'Вес', val: profile.weight, set: (v: number) => u({ weight: v }), unit: 'кг' },
          { label:'Рост', val: profile.height, set: (v: number) => u({ height: v }), unit: 'см' },
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 1 }}>{f.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <input type="number" value={f.val} onChange={e => f.set(Math.max(1, parseInt(e.target.value) || 0))}
                style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 11, textAlign: 'center' }} />
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{f.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <Pill selected={profile.sex === 'male'} label="♂ Мужской" onClick={() => u({ sex: 'male' })} color="#60a5fa" />
        <Pill selected={profile.sex === 'female'} label="♀ Женский" onClick={() => u({ sex: 'female' })} color="#f472b6" />
        {(['beginner','intermediate','advanced'] as const).map(lvl => (
          <Pill key={lvl} selected={profile.experience === lvl} label={lvl === 'beginner' ? '🌱 Новичок' : lvl === 'intermediate' ? '💪 Средний' : '🔥 Продвинутый'} onClick={() => u({ experience: lvl })} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {(['none','trt','course','pct','bridge','fertility'] as const).map(aas => (
          <Pill key={aas} selected={profile.aasStatus === aas}
            label={aas === 'none' ? '✖ Без ААС' : aas === 'trt' ? '💉 TRT' : aas === 'course' ? '💊 Курс' : aas === 'pct' ? '🔄 ПКТ' : aas === 'bridge' ? '🌉 Бридж' : '🧬 Фертильность'}
            onClick={() => u({ aasStatus: aas })}
            color={aas === 'course' ? '#f97316' : aas === 'pct' ? '#8b5cf6' : aas === 'none' ? '#22c55e' : undefined} />
        ))}
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>🫀 Состояния здоровья (противопоказания):</div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {HEALTH_CONDS.map(hc => (
            <Pill key={hc.key} small selected={profile.healthConditions.includes(hc.key)}
              label={hc.label} onClick={() => u({ healthConditions: profile.healthConditions.includes(hc.key) ? profile.healthConditions.filter(x => x !== hc.key) : [...profile.healthConditions, hc.key] })} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>💰 Бюджет:</span>
        {(['economy','medium','premium'] as const).map(b => (
          <Pill key={b} small selected={profile.budget === b} label={b === 'economy' ? '💰 Эконом' : b === 'medium' ? '💵 Средний' : '💎 Премиум'} onClick={() => u({ budget: b })} />
        ))}
      </div>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>🎯 Мои цели (можно несколько):</div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {GOALS.map(g => (
            <Pill key={g.key} small selected={profile.goals.includes(g.key)}
              label={`${g.emoji} ${g.label}`}
              onClick={() => u({ goals: profile.goals.includes(g.key) ? profile.goals.filter(x => x !== g.key) : [...profile.goals, g.key] })} />
          ))}
        </div>
      </div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
        ⚡ Профиль сохраняется автоматически
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   FINDER CARD
   ════════════════════════════════════════════════════════════════════════════ */
interface FinderCardProps {
  match: FinderMatch;
  onAdd: (id: string) => void;
  added: boolean;
}
const FinderCard: React.FC<FinderCardProps> = ({ match, onAdd, added }) => {
  const [expanded, setExpanded] = useState(false);
  const bg = match.personalScore >= 6 ? 'rgba(0,230,138,0.04)' : match.personalScore >= 3 ? 'rgba(251,191,36,0.03)' : 'transparent';
  const totalScore = match.relevanceScore + match.personalScore;
  const scoreColor = totalScore >= 20 ? '#00e68a' : totalScore >= 12 ? '#fbbf24' : totalScore >= 6 ? '#f59e0b' : '#94a3b8';
  return (
    <div style={{ background: 'rgba(24,24,27,0.15)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 10px', cursor: 'pointer' }}>
        {/* Score indicator */}
        <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: scoreColor + '18', color: scoreColor, fontWeight: 800, fontSize: 13 }}>{totalScore}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>{match.name}</span>
            {match.bestForCourse && <span style={{ fontSize: 7, padding: '0 4px', borderRadius: 3,
              background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.2)' }}>Курс</span>}
            <span style={{ fontSize: 7, padding: '0 4px', borderRadius: 3,
              background: match.priceEstimate === 'low' ? 'rgba(0,230,138,0.08)' : match.priceEstimate === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)',
              color: match.priceEstimate === 'low' ? '#00e68a' : match.priceEstimate === 'high' ? '#ef4444' : 'rgba(255,255,255,0.5)',
            }}>{match.priceEstimate === 'low' ? '💰' : match.priceEstimate === 'high' ? '💎' : '💵'}</span>
          </div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 2 }}>
            {match.categories.slice(0, 3).map(c => (
              <span key={c} style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3,
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)' }}>{CATEGORY_LABELS[c] || c}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, fontSize: 8, color: 'rgba(255,255,255,0.4)', flexWrap: 'wrap' }}>
            <span>🔄 {match.synergyCount} син.</span>
            <span>⚠️ {match.conflictCount} кон.</span>
            <span>📦 {match.formCount} форм</span>
            {match.estimatedDose && <span style={{ color: '#60a5fa' }}>💊 {match.estimatedDose}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={e => { e.stopPropagation(); onAdd(match.id); }} style={{
            padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            background: added ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.06)',
            color: added ? '#00e68a' : 'rgba(255,255,255,0.6)',
            border: '1px solid ' + (added ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.08)'),
          }}>{added ? '✓' : '+ Стек'}</button>
          <span style={{ fontSize: 9, color: 'var(--text-dim)', cursor: 'pointer', textAlign: 'center', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '6px 10px 10px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.1)' }}>
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
          {match.clinicalEffect && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>✅ {match.clinicalEffect}</div>}
          {match.mechanismOfAction && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', marginBottom: 2, lineHeight: 1.3 }}>🧬 {match.mechanismOfAction}</div>}
          {match.bestForm && <div style={{ fontSize: 8, color: '#00e68a', fontWeight: 600, marginBottom: 2 }}>🏆 {match.bestForm}</div>}
          {match.contraindicationWarnings.length > 0 && (
            <div style={{ marginTop: 2, padding: '4px 6px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
              <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600, marginBottom: 1 }}>⚠ Противопоказания:</div>
              {match.contraindicationWarnings.map((w, i) => <div key={i} style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3 }}>• {w}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   STACK BUILDER PANEL
   ════════════════════════════════════════════════════════════════════════════ */
function StackBuilderPanel({ stackIds, setStackIds, profile }: { stackIds: string[]; setStackIds: (ids: string[]) => void; profile: FinderProfile }) {
  const [targetSize, setTargetSize] = useState(5);
  const [result, setResult] = useState<{ stack: string[]; explanation: StackExplanation } | null>(null);
  const [savedStacks, setSavedStacks] = useState<{ name: string; ids: string[] }[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]'); } catch { return []; }
  });

  const handleBuild = useCallback(() => {
    if (stackIds.length === 0) return;
    const res = buildStack({ baseIds: stackIds, targetSize, autoFill: true, profile });
    setResult(res);
  }, [stackIds, targetSize, profile]);

  const handleSave = useCallback(() => {
    if (!result) return;
    const name = `Стек ${new Date().toLocaleDateString('ru')} (${result.stack.length} шт)`;
    const updated = [...savedStacks, { name, ids: result.stack }];
    setSavedStacks(updated);
    localStorage.setItem('he_finder_saved_stacks', JSON.stringify(updated));
  }, [result, savedStacks]);

  return (
    <div>
      {/* Selected pills */}
      {stackIds.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6, padding: 6, borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
          <span style={{ fontSize: 8, color: '#00e68a', fontWeight: 600, alignSelf: 'center' }}>📋 Стек:</span>
          {stackIds.map(id => (
            <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(0,230,138,0.08)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.15)' }}>
              {id}
              <span style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => setStackIds(stackIds.filter(x => x !== id))}>✕</span>
            </span>
          ))}
          <button onClick={() => setStackIds([])} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>🧹</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Цель:</span>
        <input type="number" min={2} max={20} value={targetSize} onChange={e => setTargetSize(Math.max(2, Math.min(20, parseInt(e.target.value) || 5)))}
          style={{ width: 44, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12, textAlign: 'center' }} />
        <button onClick={handleBuild} style={{
          padding: '5px 14px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
          background: 'var(--accent)', color: '#000', border: 'none',
        }}>🧩 Собрать стек</button>
      </div>

      {result && (
        <div style={{ background: 'rgba(24,24,27,0.15)', borderRadius: 12, padding: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Header stats */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <StatBox label="Компонентов" value={result.stack.length} color="#00e68a" />
            <StatBox label="Синергия" value={result.explanation.totalSynergyScore} color="#60a5fa" />
            <StatBox label="Покрытие" value={`${result.explanation.completeness}%`} color="#a78bfa" />
          </div>
          {/* Substance list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
            {result.explanation.substances.map(s => (
              <div key={s.id} style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-light)' }}>{s.name}</span>
                  <span style={{ fontSize: 8, color: '#00e68a' }}>{s.role}</span>
                </div>
                {s.dose && <div style={{ fontSize: 8, color: '#60a5fa', marginTop: 1 }}>💊 {s.dose}</div>}
                {s.synergiesWith.length > 0 && (
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                    ↻ {s.synergiesWith.map(sy => `${sy.with} (${sy.effect})`).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Warnings */}
          {result.explanation.warnings.length > 0 && (
            <div style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', marginBottom: 6 }}>
              <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>⚠️ Предупреждения ({result.explanation.warnings.length}):</div>
              {result.explanation.warnings.slice(0, 4).map((w, i) => (
                <div key={i} style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3 }}>• {w}</div>
              ))}
              {result.explanation.warnings.length > 4 && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>+ ещё {result.explanation.warnings.length - 4}...</div>}
            </div>
          )}
          {/* Save button */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={handleSave} style={{ flex: 1, padding: '5px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>💾 Сохранить стек</button>
            <button onClick={() => { const txt = result.explanation.substances.map(s => `${s.name} — ${s.dose || s.role}`).join('\n'); navigator.clipboard.writeText(txt); }} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>📋 Копировать</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: color + '08', border: '1px solid ' + color + '20', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>{label}</div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
export const SupplementFinder: React.FC = () => {
  const [tab, setTab] = useState<FinderTab>('finder');
  const [profile, setProfile] = useState<FinderProfile>(() => loadProfile());

  /* ── Finder state ── */
  const [searchText, setSearchText] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<GoalType | null>(null);
  const [selectedOrgans, setSelectedOrgans] = useState<string[]>([]);
  const [results, setResults] = useState<FinderMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [stackIds, setStackIds] = useState<string[]>([]);

  /* ── Replacer state ── */
  const [replaceId, setReplaceId] = useState('');
  const [replaceType, setReplaceType] = useState<ReplacementType>('direct_analog');
  const [replaceResults, setReplaceResults] = useState<ReplacementResult[]>([]);

  /* ── Saved stacks ── */
  const [savedStacks, setSavedStacks] = useState<{ name: string; ids: string[]; date?: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]'); } catch { return []; }
  });

  const toggleOrgan = useCallback((o: string) => setSelectedOrgans(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o]), []);

  /* ── Search ── */
  const handleSearch = useCallback(() => {
    const q = { searchText: searchText || undefined, goal: selectedGoal || undefined, organs: selectedOrgans.length > 0 ? selectedOrgans : undefined, profile };
    const res = findSupplements(q);
    setResults(res);
    setHasSearched(true);
  }, [searchText, selectedGoal, selectedOrgans, profile]);

  /* ── Replace ── */
  const handleReplace = useCallback(() => {
    if (!replaceId.trim()) return;
    const res = findReplacement(replaceId.trim(), replaceType, profile);
    setReplaceResults(res);
  }, [replaceId, replaceType, profile]);

  /* ── Clear ── */
  const clearSearch = useCallback(() => {
    setSearchText(''); setSelectedGoal(null); setSelectedOrgans([]); setResults([]); setHasSearched(false);
  }, []);

  return (
    <div style={{ padding: '0 0 80px' }}>
      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {([
          { id:'finder' as FinderTab, label:'🔍 Поиск' },
          { id:'replacer' as FinderTab, label:'🔄 Замена' },
          { id:'stack' as FinderTab, label:'🧩 Стек' },
          { id:'profile' as FinderTab, label:'👤 Профиль' },
          { id:'saved' as FinderTab, label:'💾 Сохран.' },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '7px 0', borderRadius: 10, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            background: tab === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
            color: tab === t.id ? '#000' : 'rgba(255,255,255,0.7)',
            border: `1px solid ${tab === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}`,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══════════════ PROFILE ══════════════ */}
      {tab === 'profile' && <ProfileSection profile={profile} setProfile={setProfile} />}

      {/* ══════════════ FINDER ══════════════ */}
      {tab === 'finder' && (
        <div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <input value={searchText} onChange={e => setSearchText(e.target.value)}
              placeholder="Название, орган, механизм..."
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }}
            />
            <button onClick={handleSearch} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#000', border: 'none' }}>Найти</button>
            {hasSearched && <button onClick={clearSearch} style={{ padding: '8px 10px', borderRadius: 8, fontSize: 9, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>✕</button>}
          </div>

          {/* Goal pills */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 3, fontWeight: 600, letterSpacing: '0.5px' }}>🎯 ЦЕЛЬ</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {GOALS.map(g => <Pill key={g.key} selected={selectedGoal === g.key} label={`${g.emoji} ${g.label}`} onClick={() => setSelectedGoal(selectedGoal === g.key ? null : g.key)} />)}
            </div>
          </div>

          {/* Organ pills */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 3, fontWeight: 600, letterSpacing: '0.5px' }}>🫀 ОРГАНЫ</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {ORGANS.map(o => <Pill key={o.key} selected={selectedOrgans.includes(o.key)} label={`${o.emoji} ${o.label}`} onClick={() => toggleOrgan(o.key)} />)}
            </div>
          </div>

          {/* Stack builder panel (always visible when items selected) */}
          <StackBuilderPanel stackIds={stackIds} setStackIds={setStackIds} profile={profile} />

          {/* Divider */}
          {hasSearched && results.length > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />}

          {/* Results */}
          {hasSearched && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Найдено: {results.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {results.map(m => (
                  <FinderCard key={m.id} match={m} onAdd={(id) => setStackIds(p => p.includes(id) ? p : [...p, id])} added={stackIds.includes(m.id)} />
                ))}
                {results.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                    Ничего не найдено. Попробуйте другую комбинацию цели/органов.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ REPLACER ══════════════ */}
      {tab === 'replacer' && (
        <div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <input value={replaceId} onChange={e => setReplaceId(e.target.value)}
              placeholder="ID препарата (nap: nac, omega3, tudca)"
              onKeyDown={e => e.key === 'Enter' && handleReplace()}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }}
            />
            <button onClick={handleReplace} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#000', border: 'none' }}>Замена</button>
          </div>

          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>
            {REPLACEMENT_TYPES.map(rt => (
              <Pill key={rt.key} selected={replaceType === rt.key} label={`${rt.emoji} ${rt.label}`} onClick={() => setReplaceType(rt.key)} />
            ))}
          </div>

          {replaceResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {replaceResults.map((r, i) => (
                <div key={i} style={{ background: 'rgba(24,24,27,0.15)', borderRadius: 10, padding: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-light)' }}>{r.replacementName}</span>
                    <span style={{ fontSize: 7, padding: '1px 5px', borderRadius: 3,
                      background: r.tierChange === 'upgrade' ? 'rgba(0,230,138,0.1)' : r.tierChange === 'downgrade' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)',
                      color: r.tierChange === 'upgrade' ? '#00e68a' : r.tierChange === 'downgrade' ? '#ef4444' : 'rgba(255,255,255,0.5)',
                      border: '1px solid ' + (r.tierChange === 'upgrade' ? 'rgba(0,230,138,0.2)' : r.tierChange === 'downgrade' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'),
                    }}>{r.tierChange === 'upgrade' ? '▲' : r.tierChange === 'downgrade' ? '▼' : '◆'}</span>
                    <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3,
                      background: r.priceDelta === 'cheaper' ? 'rgba(0,230,138,0.08)' : r.priceDelta === 'expensive' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)',
                      color: r.priceDelta === 'cheaper' ? '#00e68a' : r.priceDelta === 'expensive' ? '#ef4444' : 'rgba(255,255,255,0.4)',
                    }}>{r.priceDelta === 'cheaper' ? '💰' : r.priceDelta === 'expensive' ? '💎' : '💵'}</span>
                    {r.personalMatch && <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,230,138,0.08)', color: '#00e68a' }}>✓ Подходит</span>}
                  </div>
                  <div style={{ fontSize: 8, color: '#00e68a', fontWeight: 600, marginBottom: 2 }}>{r.reason}</div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3, marginBottom: 2 }}>{r.explanation}</div>
                  {r.bestForm && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>🏆 {r.bestForm}</div>}
                  {r.safetyNote && <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 2 }}>⚠ {r.safetyNote}</div>}
                </div>
              ))}
            </div>
          )}
          {replaceResults.length === 0 && replaceId.trim() && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 30 }}>
              Замен для "{replaceId}" не найдено. Попробуйте другой тип замены.
            </div>
          )}
        </div>
      )}

      {/* ══════════════ STACK ══════════════ */}
      {tab === 'stack' && <StackBuilderPanel stackIds={stackIds} setStackIds={setStackIds} profile={profile} />}

      {/* ══════════════ SAVED STACKS ══════════════ */}
      {tab === 'saved' && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)', marginBottom: 8 }}>💾 Сохранённые стеки</div>
          {savedStacks.length === 0 && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 30 }}>
              Нет сохранённых стеков. Соберите стек в 🔍 Поиск или 🧩 Стек и нажмите "Сохранить".
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...savedStacks].reverse().map((s, i) => (
              <div key={i} style={{ background: 'rgba(24,24,27,0.15)', borderRadius: 10, padding: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-light)' }}>{s.name}</span>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{s.ids.length} шт</span>
                </div>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 4 }}>
                  {s.ids.map(id => (
                    <span key={id} style={{ fontSize: 7, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,230,138,0.06)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.1)' }}>{id}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => { setStackIds(s.ids); setTab('stack'); }} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 8, cursor: 'pointer', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>Загрузить</button>
                  <button onClick={() => { const updated = savedStacks.filter((_, idx) => idx !== i); setSavedStacks(updated); localStorage.setItem('he_finder_saved_stacks', JSON.stringify(updated)); }}
                    style={{ padding: '3px 10px', borderRadius: 6, fontSize: 8, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
