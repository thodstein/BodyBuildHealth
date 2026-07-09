import React from 'react';
import type { UserProfile, UnifiedSettings } from '../../../core/types';
import { theme, HealthBool, PopupCard, SliderPc } from './ProfileComponents';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: any) => void;
}

const DIET_TYPES: { id: string; label: string; icon: string }[] = [
  { id: 'omnivore', label: 'Всеядное', icon: '🍖' }, { id: 'vegetarian', label: 'Вегетарианское', icon: '🥦' },
  { id: 'vegan', label: 'Веганское', icon: '🌱' }, { id: 'pescatarian', label: 'Пескатарианское', icon: '🐟' },
  { id: 'keto', label: 'Кето', icon: '🥑' }, { id: 'paleo', label: 'Палео', icon: '🍗' },
  { id: 'mediterranean', label: 'Средиземноморское', icon: '🫒' },
];
const ALLERGEN_OPTIONS: { id: string; label: string }[] = [
  { id: 'dairy', label: 'Молочные' }, { id: 'gluten', label: 'Глютен' }, { id: 'soy', label: 'Соя' },
  { id: 'eggs', label: 'Яйца' }, { id: 'fish', label: 'Рыба' }, { id: 'shellfish', label: 'Морепродукты' },
  { id: 'tree_nuts', label: 'Орехи' }, { id: 'peanuts', label: 'Арахис' },
];
const INTOLERANCE_OPTIONS: { id: string; label: string }[] = [
  { id: 'lactose', label: 'Лактоза' }, { id: 'fructose', label: 'Фруктоза' },
  { id: 'histamine', label: 'Гистамин' }, { id: 'sorbitol', label: 'Сорбитол' },
];
const COOKING_SKILLS: { id: string; label: string }[] = [
  { id: 'none', label: 'Не умею' }, { id: 'basic', label: 'Базовые' },
  { id: 'intermediate', label: 'Средние' }, { id: 'advanced', label: 'Продвинутые' },
];

export const ProfileDietSection: React.FC<Props> = ({ settings, save }) => {
  const s = settings as any as UnifiedSettings; const nu = s.nutrition || {} as any;
  const total = (nu.foodAllergies ?? []).length + (nu.foodIntolerances ?? []).length;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      <PopupCard icon="🥗" label="Тип питания" value={DIET_TYPES.find(d => d.id === nu.dietType)?.label || 'Не выбран'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 4 }}>
          {DIET_TYPES.map(dt => {
            const active = nu.dietType === dt.id;
            return (
              <button key={dt.id} onClick={() => save({ dietType: dt.id as any })}
                style={{
                  padding: '8px 4px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                  background: active ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.06)',
                  color: active ? '#34d399' : 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: active ? 700 : 400,
                }}>
                <div style={{ fontSize: 16 }}>{dt.icon}</div>
                <div style={{ marginTop: 1 }}>{dt.label}</div>
              </button>
            );
          })}
        </div>
      </PopupCard>
      <PopupCard icon="⚠️" label="Пищевые аллергии" value={(()=>{const a=nu.foodAllergies??[]; return a.length ? a.map((id:string)=>ALLERGEN_OPTIONS.find(o=>o.id===id)?.label||id).join(', ') : 'Нет';})()}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {ALLERGEN_OPTIONS.map(a => {
            const active = (nu.foodAllergies ?? []).includes(a.id);
            return <HealthBool key={a.id} label={a.label} active={active}
              onClick={() => { const cur = nu.foodAllergies ?? []; save({ foodAllergies: active ? cur.filter((x: string) => x !== a.id) : [...cur, a.id] }); }} />;
          })}
        </div>
      </PopupCard>
      <PopupCard icon="🤢" label="Непереносимости" value={(()=>{const a=nu.foodIntolerances??[]; return a.length ? a.map((id:string)=>INTOLERANCE_OPTIONS.find(o=>o.id===id)?.label||id).join(', ') : 'Нет';})()}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {INTOLERANCE_OPTIONS.map(it => {
            const active = (nu.foodIntolerances ?? []).includes(it.id);
            return <HealthBool key={it.id} label={it.label} active={active}
              onClick={() => { const cur = nu.foodIntolerances ?? []; save({ foodIntolerances: active ? cur.filter((x: string) => x !== it.id) : [...cur, it.id] }); }} />;
          })}
        </div>
      </PopupCard>
      <PopupCard icon="👨‍🍳" label="Навыки готовки" value={COOKING_SKILLS.find(cs => cs.id === (nu.cookingSkill || ''))?.label || 'Не указан'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {COOKING_SKILLS.map(cs => (
            <HealthBool key={cs.id} label={cs.label} active={nu.cookingSkill === cs.id}
              onClick={() => save({ cookingSkill: cs.id as any })} />
          ))}
        </div>
      </PopupCard>
      <SliderPc icon="🍽️" label="Приёмов пищи в день" value={nu.mealsPerDay ?? 4} min={2} max={7} step={1} onChange={v => save({ mealsPerDay: v })} color="#60a5fa" />
      {total > 0 || nu.dietType ? (
        <PopupCard icon="📋" label="Активные ограничения" value={`${total} ограничений · ${nu.dietType ? 'диета' : ''}`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {nu.dietType && <span style={{ fontSize:10, padding:'3px 8px', borderRadius:12, background:'rgba(0,230,138,0.1)', color:theme.accent }}>{DIET_TYPES.find(d=>d.id===nu.dietType)?.label}</span>}
            {(nu.foodAllergies ?? []).map(a => <span key={a} style={{ fontSize:10, padding:'3px 8px', borderRadius:12, background:'rgba(239,68,68,0.1)', color:'#ef4444' }}>{ALLERGEN_OPTIONS.find(o=>o.id===a)?.label || a}</span>)}
            {(nu.foodIntolerances ?? []).map(it => <span key={it} style={{ fontSize:10, padding:'3px 8px', borderRadius:12, background:'rgba(249,115,22,0.1)', color:'#f97316' }}>{INTOLERANCE_OPTIONS.find(o=>o.id===it)?.label || it}</span>)}
          </div>
        </PopupCard>
      ) : null}
    </div>
  );
};
