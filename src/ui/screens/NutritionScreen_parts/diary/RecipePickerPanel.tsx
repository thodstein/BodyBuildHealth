import React, { useEffect, useMemo, useState } from 'react';
import { RECIPE_DB } from '../../../../data/recipe-db';
import type { Recipe } from '../../../../engines/nutrition-periodization.engine';
import { customRecipeToRecipe } from './recipe-to-diary';
import { RecipeCreateModal } from './RecipeCreateModal';
import {
  readUserRecipes,
  readFavoriteRecipeNames,
  toggleRecipeFavorite,
  recipeKey,
  type UserRecipeRecord,
} from './user-recipes';

interface RecipePickerPanelProps {
  open: boolean;
  onClose: () => void;
  /** Приём, в который попадёт рецепт (для подписи и для формы создания). */
  mealType?: string;
  /** Что уже введено в поиске продуктов — чтобы не искать рецепт заново. */
  initialQuery?: string;
  onAdd: (recipe: Recipe, servings: number, custom?: boolean) => void;
}

const PORTIONS = [0.5, 1, 1.5, 2];

const round1 = (v: number) => Math.round((Number(v) || 0) * 10) / 10;

function mealLabel(meal?: string): string {
  if (meal === 'breakfast') return 'Завтрак';
  if (meal === 'lunch') return 'Обед';
  if (meal === 'dinner') return 'Ужин';
  if (meal === 'snack') return 'Перекус';
  return meal || 'Приём пищи';
}

function mealIcon(meal?: string): string {
  if (meal === 'breakfast') return '🌅';
  if (meal === 'lunch') return '☀️';
  if (meal === 'dinner') return '🌙';
  if (meal === 'snack') return '🍿';
  return '🍽';
}

/** Русская подпись приёма из дневника → ключ планировщика. */
function mealKeyFromLabel(label?: string): string {
  const text = String(label || '').toLowerCase();
  if (text.includes('завтрак')) return 'breakfast';
  if (text.includes('обед')) return 'lunch';
  if (text.includes('ужин')) return 'dinner';
  if (text.includes('перекус') || text.includes('полдник')) return 'snack';
  return 'lunch';
}

interface PickerEntry {
  recipe: Recipe;
  custom: boolean;
}

/**
 * Выбор рецепта для дневника: избранное, свои рецепты (Кухня + планировщик)
 * и встроенная база. Здесь же — создание рецепта на месте: заполнил → он
 * сразу сохранён в обе базы и добавлен в приём.
 */
export const RecipePickerPanel: React.FC<RecipePickerPanelProps> = ({ open, onClose, mealType, initialQuery, onAdd }) => {
  const [search, setSearch] = useState('');
  const [myRecipes, setMyRecipes] = useState<UserRecipeRecord[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [portions, setPortions] = useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch(initialQuery ? String(initialQuery) : '');
    setMyRecipes(readUserRecipes());
    setFavorites(readFavoriteRecipeNames());
    setCreateOpen(false);
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (createOpen) { setCreateOpen(false); return; }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, createOpen]);

  const query = search.trim().toLowerCase().replace(/ё/g, 'е');
  const matches = (fields: Array<string | undefined>) => {
    if (!query) return true;
    const tokens = query.split(/\s+/).filter(t => t.length > 1);
    const text = fields.filter(Boolean).join(' ').toLowerCase().replace(/ё/g, 'е');
    return tokens.every(t => text.includes(t));
  };

  // Избранное показываем отдельной секцией сверху — из нижних списков те же
  // карточки убираем, иначе один рецепт занимает два места и дублирует ключи.
  const favoriteKeys = useMemo(() => new Set(favorites.map(recipeKey)), [favorites]);

  const customEntries = useMemo<PickerEntry[]>(() => myRecipes
    .map(record => ({ recipe: customRecipeToRecipe(record), custom: true }))
    .filter(entry => !favoriteKeys.has(recipeKey(entry.recipe.name)))
    .filter(entry => matches([entry.recipe.name, entry.recipe.description, ...(entry.recipe.ingredients || []), ...(entry.recipe.tags || [])])),
  [myRecipes, query, favoriteKeys]);

  const builtinEntries = useMemo<PickerEntry[]>(() => RECIPE_DB
    .filter(r => !favoriteKeys.has(recipeKey(r.name)))
    .filter(r => matches([r.name, r.description, ...(r.ingredients || []), ...(r.tags || [])]))
    .slice(0, query ? 60 : 40)
    .map(recipe => ({ recipe, custom: false })), [query, favoriteKeys]);

  // Избранное: имена → рецепты из «Моих» или базы (записи из планировщика тоже
  // находятся, т.к. readUserRecipes объединяет обе пользовательские базы).
  const favoriteEntries = useMemo<PickerEntry[]>(() => {
    if (favorites.length === 0) return [];
    const byName = new Map<string, PickerEntry>();
    for (const record of myRecipes) {
      const recipe = customRecipeToRecipe(record);
      byName.set(recipeKey(recipe.name), { recipe, custom: true });
    }
    for (const recipe of RECIPE_DB) {
      const key = recipeKey(recipe.name);
      if (!byName.has(key)) byName.set(key, { recipe, custom: false });
    }
    return favorites
      .map(name => byName.get(recipeKey(name)))
      .filter((entry): entry is PickerEntry => Boolean(entry))
      .filter(entry => matches([entry.recipe.name, entry.recipe.description, ...(entry.recipe.ingredients || []), ...(entry.recipe.tags || [])]));
  }, [favorites, myRecipes, query]);

  if (!open) return null;

  const portionOf = (r: Recipe) => portions[r.name] ?? 1;
  const isFavorite = (name: string) => favorites.some(favorite => recipeKey(favorite) === recipeKey(name));

  const toggleFavorite = (name: string) => {
    toggleRecipeFavorite(name);
    setFavorites(readFavoriteRecipeNames());
  };

  const renderCard = ({ recipe, custom }: PickerEntry, index = 0) => {
    const portion = portionOf(recipe);
    const kcal = Math.round((recipe.kcal || 0) * portion);
    const p = round1((recipe.protein || 0) * portion);
    const f = round1((recipe.fat || 0) * portion);
    const c = round1((recipe.carbs || 0) * portion);
    const favorite = isFavorite(recipe.name);
    return (
      <div key={`${custom ? 'my' : 'db'}-${recipeKey(recipe.name)}-${index}`} className="nd-recipe-card"
        style={{ padding: 12, borderRadius: 14, background: custom ? 'rgba(139,92,246,0.05)' : '#202023',
          border: `1px solid ${custom ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.06)'}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            background: custom ? 'rgba(139,92,246,0.12)' : 'rgba(245,158,11,0.10)' }}>{mealIcon(recipe.meal)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{recipe.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', marginTop: 3, fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>
              <span>{custom ? 'Мой рецепт' : mealLabel(recipe.meal)}</span>
              <span style={{ color: '#fbbf24', fontWeight: 800 }}>{kcal} ккал</span>
              <span style={{ color: '#60a5fa' }}>Б {p}г</span>
              <span style={{ color: '#fbbf24' }}>Ж {f}г</span>
              <span style={{ color: '#fb923c' }}>У {c}г</span>
            </div>
          </div>
          <button type="button" onClick={() => toggleFavorite(recipe.name)}
            aria-label={favorite ? `Убрать из избранного: ${recipe.name}` : `В избранное: ${recipe.name}`}
            aria-pressed={favorite} title={favorite ? 'Убрать из избранного' : 'В избранное'}
            style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 11, cursor: 'pointer', fontSize: 17, lineHeight: 1,
              border: favorite ? '1px solid rgba(251,191,36,0.45)' : '1px solid rgba(255,255,255,0.08)',
              background: favorite ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.03)',
              color: favorite ? '#fbbf24' : 'rgba(255,255,255,0.45)' }}>
            {favorite ? '★' : '☆'}
          </button>
        </div>

        {recipe.description ? (
          <div style={{ fontSize: 9, lineHeight: 1.4, color: 'rgba(255,255,255,0.55)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {recipe.description}
          </div>
        ) : null}

        {Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {recipe.ingredients.slice(0, 5).map((ing, j) => (
              <span key={`${ing}-${j}`} style={{ padding: '3px 7px', borderRadius: 999, fontSize: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>{ing}</span>
            ))}
            {recipe.ingredients.length > 5 && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>+{recipe.ingredients.length - 5}</span>}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>Порция:</span>
          {PORTIONS.map(v => (
            <button key={v} type="button" onClick={() => setPortions(prev => ({ ...prev, [recipe.name]: v }))}
              aria-label={`Порция ${v}`} aria-pressed={portion === v}
              style={{ minWidth: 44, minHeight: 44, padding: '6px 8px', borderRadius: 9, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                border: portion === v ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.07)',
                background: portion === v ? 'rgba(0,230,138,0.14)' : '#18181b',
                color: portion === v ? '#00e68a' : 'rgba(255,255,255,0.6)' }}>×{v}</button>
          ))}
          <button type="button" onClick={() => onAdd(recipe, portion, custom)}
            aria-label={`Добавить рецепт ${recipe.name} в дневник`}
            style={{ marginLeft: 'auto', padding: '10px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', minHeight: 44,
              background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
            ＋ В дневник
          </button>
        </div>
      </div>
    );
  };

  const sectionTitle = (color: string, text: string, count: number) => (
    <div style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: 0.3, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
      {text}
      <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 999, background: `${color}1f`, color, border: `1px solid ${color}33` }}>{count}</span>
    </div>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Добавить рецепт в дневник" className="nd-recipe-picker"
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'linear-gradient(180deg,#0b0b0d 0%, #141417 100%)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#141417' }}>
        <button type="button" onClick={onClose} aria-label="Закрыть выбор рецепта"
          style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)', background: '#202023', color: '#fff', cursor: 'pointer', fontSize: 17, flexShrink: 0 }}>✕</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>🍲 Добавить рецепт</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', overflowWrap: 'anywhere' }}>
            Избранное, свои рецепты и база · {mealType || 'приём не выбран'}
          </div>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} aria-label="Создать свой рецепт"
          title="Создать свой рецепт"
          style={{ flexShrink: 0, minWidth: 44, height: 44, padding: '0 12px', borderRadius: 12, cursor: 'pointer', fontSize: 12, fontWeight: 800,
            border: '1px solid rgba(0,230,138,0.35)', background: 'rgba(0,230,138,0.12)', color: '#00e68a', whiteSpace: 'nowrap' }}>
          ＋ Рецепт
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px 12px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          aria-label="Поиск рецепта" placeholder="🔍 Рецепт или продукт: борщ, курица, овсянка…"
          autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: '#202023', border: '1px solid rgba(255,255,255,0.07)', color: '#fff', fontSize: 16, boxSizing: 'border-box', outline: 'none', minHeight: 48 }} />

        {favoriteEntries.length === 0 && favorites.length === 0 && !query && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.42)', lineHeight: 1.4 }}>
            ⭐ Звёздочка — в избранное, «＋ Рецепт» — создать свой и сразу добавить в приём.
          </div>
        )}

        {favoriteEntries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sectionTitle('#fbbf24', '⭐ Избранное', favoriteEntries.length)}
            {favoriteEntries.map(renderCard)}
          </div>
        )}

        {customEntries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sectionTitle('#c4b5fd', '📝 Мои рецепты', customEntries.length)}
            {customEntries.map(renderCard)}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sectionTitle('#fbbf24', '🍳 База рецептов', builtinEntries.length)}
          {builtinEntries.length === 0 && customEntries.length === 0 && favoriteEntries.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <span>Рецепт не найден. Создайте свой — он сразу уйдёт в приём.</span>
              <button type="button" onClick={() => setCreateOpen(true)} aria-label="Создать рецепт из поиска"
                style={{ minHeight: 44, padding: '10px 14px', borderRadius: 11, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.12)', color: '#00e68a', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                ＋ Создать «{search.trim() || 'рецепт'}»
              </button>
            </div>
          ) : builtinEntries.map(renderCard)}
        </div>
      </div>

      <RecipeCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultMeal={mealKeyFromLabel(mealType)}
        initialName={search.trim()}
        onSaved={(recipe) => {
          setCreateOpen(false);
          setMyRecipes(readUserRecipes());
          // Создание «на месте»: блюдо сразу уходит в очередь/дневник.
          onAdd(customRecipeToRecipe(recipe), 1, true);
        }}
      />
    </div>
  );
};
