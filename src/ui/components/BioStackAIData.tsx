import React, { useState } from 'react';
import {
  type BioStackProfile,
  loadBioStackProfile,
  saveBioStackProfile,
  autoFillFromMainProfile,
  getProfileCompleteness,
} from '../../engines/biostack-ai.engine';
import {
  GlassCard, PillBtn, PURE_GOALS, HEALTH_CONDS, ORGANS, SYSTEMS,
} from './BioStackAIConstants';

interface Props {
  profile: BioStackProfile;
  onChange: (p: BioStackProfile) => void;
}

const AAS_STATES = [
  { key: 'none', label: 'Нет' },
  { key: 'trt', label: 'TRT' },
  { key: 'course', label: 'Курс ААС' },
  { key: 'pct', label: 'PCT' },
  { key: 'bridge', label: 'Мост' },
  { key: 'fertility', label: 'Фертильность' },
];
const BUDGETS = [
  { key: 'economy', label: 'Эконом' },
  { key: 'medium', label: 'Средний' },
  { key: 'premium', label: 'Премиум' },
];
const COMPLEX = [
  { key: 'minimal', label: 'Минимум' },
  { key: 'balanced', label: 'Сбаланс' },
  { key: 'maximum', label: 'Максимум' },
];
const EXPERIENCE = [
  { key: 'beginner', label: 'Новичок' },
  { key: 'intermediate', label: 'Средний' },
  { key: 'advanced', label: 'Продвинутый' },
];

function Num({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div style={{ flex: '1 1 120px', minWidth: 120 }}>
      <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.5)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(118,118,128,0.12)', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.1)' }}>
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value) || 0)}
          style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }}
        />
        {suffix && <span style={{ paddingRight: 10, fontSize: 11, color: 'rgba(235,235,245,0.5)' }}>{suffix}</span>}
      </div>
    </div>
  );
}

function Seg({ label, options, value, onChange }: { label: string; options: { key: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.5)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(o => {
          const active = value === o.key;
          return (
            <button
              key={o.key}
              onClick={() => onChange(o.key)}
              style={{
                padding: '6px 10px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: active ? 'rgba(0,230,138,0.12)' : 'rgba(118,118,128,0.12)',
                border: active ? '1px solid rgba(0,230,138,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: active ? '#00e68a' : 'rgba(235,235,245,0.6)',
              }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Multi({ label, options, selected, onChange }: { label: string; options: { key: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (k: string) => onChange(selected.includes(k) ? selected.filter(x => x !== k) : [...selected, k]);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.5)', marginBottom: 4 }}>{label} {selected.length > 0 && <span style={{ color: '#00e68a' }}>({selected.length})</span>}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(o => {
          const active = selected.includes(o.key);
          return (
            <button
              key={o.key}
              onClick={() => toggle(o.key)}
              style={{
                padding: '6px 10px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: active ? 'rgba(0,230,138,0.12)' : 'rgba(118,118,128,0.12)',
                border: active ? '1px solid rgba(0,230,138,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: active ? '#00e68a' : 'rgba(235,235,245,0.6)',
              }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TagsInput({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState('');
  const commit = () => {
    const parts = text.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) { onChange([...value, ...parts]); setText(''); }
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.5)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={text}
          placeholder={placeholder || 'через запятую'}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          style={{ flex: 1, background: 'rgba(118,118,128,0.12)', border: '0.5px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 10px', fontSize: 12, borderRadius: 12, outline: 'none' }}
        />
        <button onClick={commit} style={{ padding: '8px 12px', borderRadius: 12, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.3)', color: '#00e68a', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Добавить</button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {value.map((t, i) => (
          <span key={i} onClick={() => onChange(value.filter((_, j) => j !== i))} style={{ padding: '4px 8px', borderRadius: 8, background: 'rgba(255,77,68,0.12)', border: '1px solid rgba(255,77,68,0.3)', color: '#ff7d68', fontSize: 11, cursor: 'pointer' }}>
            {t} ✕
          </span>
        ))}
      </div>
    </div>
  );
}

export default function BioStackAIData({ profile, onChange }: Props) {
  const [justFilled, setJustFilled] = useState<string[]>([]);

  const set = (patch: Partial<BioStackProfile>) => onChange({ ...profile, ...patch });

  const onAutoFill = () => {
    const { patch, autoKeys } = autoFillFromMainProfile();
    if (!Object.keys(patch).length) {
      onChange({ ...profile, autoFilledFields: [] });
      setJustFilled([]);
      return;
    }
    const merged: BioStackProfile = { ...profile, ...patch, autoFilledFields: [...new Set([...(profile.autoFilledFields || []), ...autoKeys])] };
    onChange(merged);
    setJustFilled(autoKeys);
  };

  const cp = getProfileCompleteness(profile);

  return (
    <div style={{ padding: '12px 12px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <GlassCard style={{ border: '1px solid rgba(0,230,138,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>🩺 Данные профиля BioStack</div>
            <div style={{ fontSize: 11, color: 'rgba(235,235,245,0.5)', marginTop: 2 }}>
              Заполнено {cp.percent}% · авто {cp.autoFilledCount} · вручную {cp.manualFilledCount}
            </div>
          </div>
          <button
            onClick={onAutoFill}
            style={{ padding: '10px 14px', borderRadius: 12, background: 'linear-gradient(90deg,#00e68a,#00c853)', border: 'none', color: '#04210f', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            🪄 Автозаполнение
          </button>
        </div>
        <div style={{ height: 6, borderRadius: 6, background: 'rgba(118,118,128,0.15)', overflow: 'hidden' }}>
          <div style={{ width: `${cp.percent}%`, height: '100%', background: 'linear-gradient(90deg,#00e68a,#00c853)' }} />
        </div>
        {justFilled.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#00e68a' }}>✅ Подтянуто из основного профиля: {justFilled.join(', ')}</div>
        )}
        <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(235,235,245,0.45)' }}>
          Кнопка «Автозаполнение» подтягивает данные из основного профиля (возраст, вес, рост, пол, опыт, цели, хронические заболевания, препараты, аллергии). Все поля можно также заполнить вручную ниже.
        </div>
      </GlassCard>

      <GlassCard>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10, color: '#00e68a' }}>👤 Личные данные</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Num label="Возраст" value={profile.age} onChange={v => set({ age: v })} suffix="лет" />
          <Num label="Вес" value={profile.weight} onChange={v => set({ weight: v })} suffix="кг" />
          <Num label="Рост" value={profile.height} onChange={v => set({ height: v })} suffix="см" />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          <div style={{ flex: '1 1 140px' }}><Seg label="Пол" options={[{ key: 'male', label: 'Муж' }, { key: 'female', label: 'Жен' }]} value={profile.sex} onChange={v => set({ sex: v as any })} /></div>
          <div style={{ flex: '1 1 140px' }}><Seg label="Опыт" options={EXPERIENCE} value={profile.experience} onChange={v => set({ experience: v as any })} /></div>
        </div>
      </GlassCard>

      <GlassCard>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10, color: '#00e68a' }}>🎯 Цели и статус</div>
        <Multi label="Цели (что хотим достичь)" options={PURE_GOALS} selected={profile.goals} onChange={v => set({ goals: v as any })} />
        <Seg label="Статус ААС" options={AAS_STATES} value={profile.aasStatus} onChange={v => set({ aasStatus: v as any })} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px' }}><Seg label="Бюджет" options={BUDGETS} value={profile.budget} onChange={v => set({ budget: v as any })} /></div>
          <div style={{ flex: '1 1 140px' }}><Seg label="Сложность стека" options={COMPLEX} value={profile.stackComplexity} onChange={v => set({ stackComplexity: v as any })} /></div>
        </div>
        <Num label="Макс. размер стека" value={profile.maxStackSize} onChange={v => set({ maxStackSize: v })} suffix="в-в" />
      </GlassCard>

      <GlassCard>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10, color: '#00e68a' }}>⚕️ Здоровье и клиника</div>
        <Multi label="Хронические состояния" options={HEALTH_CONDS} selected={profile.healthConditions} onChange={v => set({ healthConditions: v as any })} />
        <TagsInput label="Текущие препараты" value={profile.currentMeds} onChange={v => set({ currentMeds: v })} placeholder="напр. варфарин, метформин" />
        <TagsInput label="Аллергии (лекарства/компоненты)" value={profile.drugAllergies} onChange={v => set({ drugAllergies: v })} placeholder="напр. пенициллин, рыба, глютен" />
        <TagsInput label="Исключить вещества (ID через запятую)" value={profile.avoidIds} onChange={v => set({ avoidIds: v })} placeholder="напр. caffeine, yohimbine" />
      </GlassCard>

      <GlassCard>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10, color: '#00e68a' }}>🎯 Органы и системы-мишени</div>
        <Multi label="Органы" options={ORGANS} selected={profile.targetOrgans} onChange={v => set({ targetOrgans: v })} />
        <Multi label="Системы" options={SYSTEMS} selected={profile.targetSystems} onChange={v => set({ targetSystems: v })} />
      </GlassCard>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => { saveBioStackProfile(profile); }}
          style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'linear-gradient(90deg,#00e68a,#00c853)', border: 'none', color: '#04210f', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
          💾 Сохранить профиль
        </button>
        <button
          onClick={() => { const fresh = loadBioStackProfile(); onChange(fresh); setJustFilled([]); }}
          style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(118,118,128,0.12)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(235,235,245,0.7)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          ↺ Сбросить
        </button>
      </div>
    </div>
  );
}
