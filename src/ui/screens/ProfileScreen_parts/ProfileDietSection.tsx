import React from 'react';
import type { UserProfile } from '../../../core/types';
import { theme, glassCardStyle, sectionLabelStyle, ExpandableCard, HealthBool, HealthNumber } from './ProfileComponents';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: Partial<UserProfile['settings']>) => void;
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
  return (
    <div>
      <ExpandableCard icon="🥗" title="Тип питания" color="#34d399" open={false}
        summary={DIET_TYPES.find(d => d.id === settings.dietType)?.label || 'Не выбран'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 4 }}>
          {DIET_TYPES.map(dt => {
            const active = settings.dietType === dt.id;
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
      </ExpandableCard>

      <ExpandableCard icon="⚠️" title="Пищевые аллергии" color="#ef4444" open={false}
        summary={(() => { const a = settings.foodAllergies ?? []; return a.length ? a.map((id: string) => ALLERGEN_OPTIONS.find(o => o.id === id)?.label || id).join(', ') : 'Нет'; })()}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {ALLERGEN_OPTIONS.map(a => {
            const active = (settings.foodAllergies ?? []).includes(a.id);
            return <HealthBool key={a.id} label={a.label} active={active}
              onClick={() => { const cur = settings.foodAllergies ?? []; save({ foodAllergies: active ? cur.filter((x: string) => x !== a.id) : [...cur, a.id] }); }} />;
          })}
        </div>
      </ExpandableCard>

      <ExpandableCard icon="🤢" title="Непереносимости" color="#f97316" open={false}
        summary={(() => { const a = settings.foodIntolerances ?? []; return a.length ? a.map((id: string) => INTOLERANCE_OPTIONS.find(o => o.id === id)?.label || id).join(', ') : 'Нет'; })()}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {INTOLERANCE_OPTIONS.map(it => {
            const active = (settings.foodIntolerances ?? []).includes(it.id);
            return <HealthBool key={it.id} label={it.label} active={active}
              onClick={() => { const cur = settings.foodIntolerances ?? []; save({ foodIntolerances: active ? cur.filter((x: string) => x !== it.id) : [...cur, it.id] }); }} />;
          })}
        </div>
      </ExpandableCard>

      <ExpandableCard icon="👨‍🍳" title="Навыки готовки" color="#fbbf24" open={false}
        summary={COOKING_SKILLS.find(cs => cs.id === (settings.cookingSkill || ''))?.label || 'Не указан'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {COOKING_SKILLS.map(cs => (
            <HealthBool key={cs.id} label={cs.label} active={settings.cookingSkill === cs.id}
              onClick={() => save({ cookingSkill: cs.id as any })} />
          ))}
        </div>
      </ExpandableCard>

      <ExpandableCard icon="🍽️" title="Приёмов пищи в день" color="#60a5fa" open={false}
        summary={`${settings.mealsPerDay ?? 4} раз/день`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="range" min={2} max={7} value={settings.mealsPerDay ?? 4}
            onChange={e => save({ mealsPerDay: parseFloat(e.target.value) || 0 })}
            style={{ flex: 1, accentColor: theme.accent }} />
          <span style={{ fontSize: 18, fontWeight: 700, minWidth: 24, textAlign: 'center', color: theme.accent }}>
            {settings.mealsPerDay ?? 4}
          </span>
        </div>
      </ExpandableCard>

      {/* Active restrictions summary */}
      <ActiveRestrictions settings={settings} />
    </div>
  );
};

const ActiveRestrictions: React.FC<{ settings: UserProfile['settings'] }> = ({ settings }) => {
  const total = (settings.foodAllergies ?? []).length + (settings.foodIntolerances ?? []).length;
  if (total === 0 && !settings.dietType) return null;
  return (
    <div style={{ ...glassCardStyle, borderColor: 'rgba(0,230,138,0.2)' }}>
      <div style={{ fontSize: 11, color: theme.accent, fontWeight: 600, marginBottom: 6 }}>Активные ограничения</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {settings.dietType && (
          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 12, background: 'rgba(0,230,138,0.1)', color: theme.accent }}>
            {DIET_TYPES.find(d => d.id === settings.dietType)?.label}
          </span>
        )}
        {(settings.foodAllergies ?? []).map(a => (
          <span key={a} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {ALLERGEN_OPTIONS.find(o => o.id === a)?.label || a}
          </span>
        ))}
        {(settings.foodIntolerances ?? []).map(it => (
          <span key={it} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 12, background: 'rgba(249,115,22,0.1)', color: '#f97316' }}>
            {INTOLERANCE_OPTIONS.find(o => o.id === it)?.label || it}
          </span>
        ))}
      </div>
    </div>
  );
};
