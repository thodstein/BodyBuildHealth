import React from 'react';
import type { DiaryRecipeComponent } from '../diary-storage';

interface RecipeComponentsListProps {
  components: DiaryRecipeComponent[];
  /** Множитель отображения (в очереди пользователь может менять общий вес). */
  scale?: number;
  /** Компактные строки для дневника. */
  compact?: boolean;
  /** Заголовок списка. */
  title?: string;
}

const fmt1 = (v: number) => Math.round((Number.isFinite(v) ? v : 0) * 10) / 10;

/**
 * Раскладка рецепта по продуктам: название, порция и КБЖУ каждого ингредиента.
 * Один компонент используют и очередь добавления, и карточка приёма пищи.
 */
export const RecipeComponentsList: React.FC<RecipeComponentsListProps> = ({
  components, scale = 1, compact = false, title = 'Состав рецепта',
}) => {
  const list = Array.isArray(components) ? components : [];
  if (list.length === 0) return null;
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;

  return (
    <div className={compact ? 'nd-recipe-components nd-recipe-components--compact' : 'nd-recipe-components'}
      style={{ marginTop: compact ? 4 : 8, padding: compact ? '6px 8px' : '8px 10px', borderRadius: 10,
        background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.14)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: compact ? 9 : 10, fontWeight: 800, color: '#fbbf24', letterSpacing: 0.2 }}>
          🍲 {title}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>
          {list.length} прод.
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {list.map((c, i) => {
          const qty = Math.max(1, Math.round((c.qty || 0) * factor));
          const kcal = Math.round((c.kcal || 0) * factor);
          const p = fmt1((c.p || 0) * factor);
          const f = fmt1((c.f || 0) * factor);
          const cc = fmt1((c.c || 0) * factor);
          const unknown = kcal === 0 && p === 0 && f === 0 && cc === 0;
          return (
            <div key={`${c.name}-${i}`} className="nd-recipe-component"
              style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: compact ? 10 : 11, minWidth: 0 }}>
              <span style={{ flex: 1, minWidth: 0, color: 'rgba(255,255,255,0.82)', overflowWrap: 'anywhere', lineHeight: 1.3 }}>
                {c.name || 'Продукт'}
              </span>
              <span style={{ flexShrink: 0, color: 'rgba(255,255,255,0.42)', fontSize: compact ? 9 : 10, fontVariantNumeric: 'tabular-nums' }}>
                {qty} г
              </span>
              {unknown ? (
                <span style={{ flexShrink: 0, color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>КБЖУ н/д</span>
              ) : (
                <span style={{ flexShrink: 0, display: 'flex', gap: 5, fontSize: compact ? 9 : 10, fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>{kcal} ккал</span>
                  <span style={{ color: '#60a5fa' }}>Б{p}</span>
                  <span style={{ color: '#fbbf24' }}>Ж{f}</span>
                  <span style={{ color: '#fb923c' }}>У{cc}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
