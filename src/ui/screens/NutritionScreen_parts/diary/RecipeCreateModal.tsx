import React, { useEffect, useState } from 'react';
import { createUserRecipe, type UserRecipeRecord } from './user-recipes';

interface RecipeCreateModalProps {
  open: boolean;
  onClose: () => void;
  /** Созданный рецепт уже сохранён в обе базы пользовательских рецептов. */
  onSaved?: (recipe: UserRecipeRecord) => void;
  /** Куда попадёт рецепт по умолчанию (breakfast/lunch/dinner/snack). */
  defaultMeal?: string;
  /** Подставить название, например из строки поиска. */
  initialName?: string;
}

const MEALS: Array<{ id: string; label: string; icon: string }> = [
  { id: 'breakfast', label: 'Завтрак', icon: '🌅' },
  { id: 'lunch', label: 'Обед', icon: '☀️' },
  { id: 'dinner', label: 'Ужин', icon: '🌙' },
  { id: 'snack', label: 'Перекус', icon: '🍿' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, background: '#202023',
  border: '1px solid rgba(255,255,255,0.07)', color: '#fff', fontSize: 14,
  boxSizing: 'border-box', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 4,
  letterSpacing: 0.4, textTransform: 'uppercase',
};

/**
 * Создание своего рецепта — та же функция, что в «Кухне», но доступная прямо
 * из дневника: заполнил название/состав/КБЖУ и сразу добавляешь блюдо в приём.
 * Рецепт сохраняется в оба пользовательских хранилища (Кухня + планировщик).
 */
export const RecipeCreateModal: React.FC<RecipeCreateModalProps> = ({
  open, onClose, onSaved, defaultMeal = 'lunch', initialName = '',
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [meal, setMeal] = useState(defaultMeal);
  const [prepTime, setPrepTime] = useState(10);
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [kcal, setKcal] = useState(0);
  const [protein, setProtein] = useState(0);
  const [fat, setFat] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');

  // Каждое открытие — чистая форма (с подставленным названием из поиска).
  useEffect(() => {
    if (!open) return;
    setName(initialName || '');
    setDescription('');
    setMeal(defaultMeal || 'lunch');
    setPrepTime(10);
    setIngredients('');
    setInstructions('');
    setKcal(0); setProtein(0); setFat(0); setCarbs(0);
    setTags('');
    setError('');
  }, [open, defaultMeal, initialName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const macro = (label: string, value: string, set: (v: number) => void) => (
    <input type="number" inputMode="decimal" value={value === '0' ? '' : value}
      onChange={e => set(Math.max(0, Number.parseFloat(e.target.value) || 0))}
      aria-label={label}
      placeholder="0" style={{ ...inputStyle, textAlign: 'center', padding: '10px 6px' }} />
  );

  const save = () => {
    if (!name.trim()) { setError('Укажите название рецепта'); return; }
    if (!(kcal > 0)) { setError('Укажите калорийность больше 0 — иначе блюдо не попадёт в расчёт'); return; }
    const recipe = createUserRecipe({
      name,
      description,
      meal,
      prepTimeMin: prepTime,
      ingredients,
      instructions,
      kcal,
      protein,
      fat,
      carbs,
      tags,
    });
    onSaved?.(recipe);
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Создать рецепт"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', padding: 12 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 440, maxHeight: '88vh', overflowY: 'auto', padding: 16, borderRadius: 18,
          background: '#18181b', border: '1px solid rgba(0,230,138,0.14)', boxShadow: '0 20px 40px rgba(0,0,0,0.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#00e68a,#00c8a0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🍳</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Создать рецепт</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Сохранится в Кухню и в планировщик</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть создание рецепта"
            style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={labelStyle}>Название</div>
            <input value={name} onChange={e => { setName(e.target.value); setError(''); }}
              aria-label="Название рецепта" placeholder="Например: Овсяноблин Power" style={inputStyle} />
          </div>

          <div>
            <div style={labelStyle}>Описание (необязательно)</div>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              aria-label="Описание рецепта" placeholder="Чем полезен, когда есть, на что заменить…"
              rows={2} style={{ ...inputStyle, resize: 'vertical', minHeight: 50, fontSize: 12 }} />
          </div>

          <div>
            <div style={labelStyle}>Приём</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {MEALS.map((m, i) => (
                <button key={m.id} type="button" onClick={() => setMeal(m.id)} aria-pressed={meal === m.id}
                  style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    border: meal === m.id ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.07)',
                    background: meal === m.id ? 'rgba(0,230,138,0.14)' : '#202023',
                    color: meal === m.id ? '#00e68a' : 'rgba(255,255,255,0.65)' }}>
                  {m.icon} {m.label}
                </button>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
                <input type="number" min={0} value={prepTime}
                  onChange={e => setPrepTime(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
                  aria-label="Время готовки"
                  style={{ ...inputStyle, width: 64, padding: '8px 6px', textAlign: 'center' }} />
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>мин</span>
              </div>
            </div>
          </div>

          <div>
            <div style={labelStyle}>КБЖУ на порцию</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              {[
                { l: 'Ккал', v: String(kcal), s: setKcal, c: '#00e68a' },
                { l: 'Белки', v: String(protein), s: setProtein, c: '#60a5fa' },
                { l: 'Жиры', v: String(fat), s: setFat, c: '#fbbf24' },
                { l: 'Углеводы', v: String(carbs), s: setCarbs, c: '#fb923c' },
              ].map(m => (
                <div key={m.l} style={{ textAlign: 'center', background: '#202023', borderRadius: 12, padding: '8px 4px',
                  border: `1px solid ${m.c}18` }}>
                  {macro(m.l, m.v, m.s)}
                  <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginTop: 4,
                    letterSpacing: 0.4, textTransform: 'uppercase' }}>{m.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={labelStyle}>Ингредиенты (по одному на строку)</div>
            <textarea value={ingredients} onChange={e => setIngredients(e.target.value)}
              aria-label="Ингредиенты рецепта" placeholder={'Яйца 2 шт\nОвсянка 30 г\nТворог 50 г'}
              rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 72, fontSize: 12 }} />
          </div>

          <div>
            <div style={labelStyle}>Приготовление</div>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
              aria-label="Приготовление" placeholder="Коротко шаги..."
              rows={2} style={{ ...inputStyle, resize: 'vertical', minHeight: 54, fontSize: 12 }} />
          </div>

          <div>
            <div style={labelStyle}>Теги (через запятую)</div>
            <input value={tags} onChange={e => setTags(e.target.value)} aria-label="Теги"
              placeholder="высокий белок, сушка, быстро" style={{ ...inputStyle, fontSize: 12 }} />
          </div>

          {error && (
            <div role="alert" style={{ fontSize: 11, color: '#fca5a5', padding: '8px 10px', borderRadius: 9,
              background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}>{error}</div>
          )}

          <button type="button" onClick={save} aria-label="Сохранить рецепт"
            style={{ width: '100%', padding: '13px', borderRadius: 12, cursor: 'pointer', border: 'none', minHeight: 48,
              background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontSize: 13, fontWeight: 800,
              boxShadow: '0 6px 16px rgba(0,230,138,0.25)' }}>✓ Сохранить рецепт</button>
        </div>
      </div>
    </div>
  );
};
