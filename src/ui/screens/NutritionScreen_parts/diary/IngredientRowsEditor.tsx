import React, { useState } from 'react';
import { findFood } from '../../../../engines/nutrition-ocr-parser';
import type { DiaryRecipeComponent } from '../diary-storage';
import { componentsFromIngredientLines } from './recipe-to-diary';

/**
 * Строка ингредиента в форме рецепта. Числа держим строками: так поле можно
 * очистить и ввести «12,5» по-русски, а не получить 0 посреди набора.
 */
export interface IngredientRowDraft {
  name: string;
  grams: string;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
}

export interface IngredientTotals {
  kcal: number;
  p: number;
  f: number;
  c: number;
  weight: number;
}

export const emptyIngredientRow = (): IngredientRowDraft => ({
  name: '', grams: '', kcal: '', protein: '', fat: '', carbs: '',
});

const toNum = (value: unknown): number => {
  const n = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const round1 = (value: number): number => Math.round((Number.isFinite(value) ? value : 0) * 10) / 10;

/** Есть ли в строках хотя бы один названный ингредиент. */
export function ingredientRowsHasData(rows: IngredientRowDraft[]): boolean {
  return (rows || []).some(row => String(row?.name || '').trim().length > 0);
}

/**
 * Черновики → компоненты. Строки без названия пропускаем. Если вес не указан,
 * считаем порцией 100 г — как это делает разбор текстовых строк.
 */
export function rowsToComponents(rows: IngredientRowDraft[]): DiaryRecipeComponent[] {
  return (rows || [])
    .filter(row => String(row?.name || '').trim())
    .map(row => ({
      name: String(row.name).trim(),
      qty: Math.max(1, Math.round(toNum(row.grams) || 100)),
      kcal: Math.round(toNum(row.kcal)),
      p: round1(toNum(row.protein)),
      f: round1(toNum(row.fat)),
      c: round1(toNum(row.carbs)),
    }));
}

/** Черновики → строки «Курица 200 г» для совместимости со старым хранилищем. */
export function rowsToIngredientLines(rows: IngredientRowDraft[]): string[] {
  return (rows || [])
    .filter(row => String(row?.name || '').trim())
    .map(row => {
      const name = String(row.name).trim();
      const grams = toNum(row.grams);
      return grams > 0 ? `${name} ${Math.round(grams)} г` : name;
    });
}

/** Компоненты → черновики (для правки и для переноса в форму планировщика). */
export function componentsToIngredientRows(components: DiaryRecipeComponent[]): IngredientRowDraft[] {
  return (components || []).map(component => ({
    name: String(component?.name || ''),
    grams: String(Math.max(1, Math.round(Number(component?.qty) || 100))),
    kcal: component?.kcal ? String(Math.round(component.kcal)) : '',
    protein: component?.p ? String(round1(component.p)) : '',
    fat: component?.f ? String(round1(component.f)) : '',
    carbs: component?.c ? String(round1(component.c)) : '',
  }));
}

export function sumIngredientComponents(components: DiaryRecipeComponent[]): IngredientTotals {
  return (components || []).reduce<IngredientTotals>((acc, component) => ({
    kcal: acc.kcal + (Number(component?.kcal) || 0),
    p: acc.p + (Number(component?.p) || 0),
    f: acc.f + (Number(component?.f) || 0),
    c: acc.c + (Number(component?.c) || 0),
    weight: acc.weight + (Number(component?.qty) || 0),
  }), { kcal: 0, p: 0, f: 0, c: 0, weight: 0 });
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '10px 8px', borderRadius: 10, background: '#202023',
  border: '1px solid rgba(255,255,255,0.07)', color: '#fff', fontSize: 12,
  boxSizing: 'border-box', outline: 'none', minHeight: 44, textAlign: 'center',
};

const MACROS: Array<{ key: 'kcal' | 'protein' | 'fat' | 'carbs'; label: string; short: string; color: string }> = [
  { key: 'kcal', label: 'ккал', short: 'Ккал', color: '#00e68a' },
  { key: 'protein', label: 'белки', short: 'Б', color: '#60a5fa' },
  { key: 'fat', label: 'жиры', short: 'Ж', color: '#fbbf24' },
  { key: 'carbs', label: 'углеводы', short: 'У', color: '#fb923c' },
];

interface IngredientRowsEditorProps {
  rows: IngredientRowDraft[];
  onChange: (rows: IngredientRowDraft[]) => void;
  /** Заполнить КБЖУ рецепта суммой по ингредиентам. */
  onUseTotals?: (totals: IngredientTotals) => void;
  /** Компактный режим (узкая форма планировщика). */
  compact?: boolean;
}

/**
 * Интерактивный состав рецепта: название, вес и КБЖУ каждого продукта.
 * КБЖУ можно вписать руками — это нужно для продуктов, которых нет в каталоге
 * (раньше такие строки оставались с нулями и блюдо недосчитывало калории).
 * Если поля пустые, значения подставляются из FOOD_DB по названию.
 */
export const IngredientRowsEditor: React.FC<IngredientRowsEditorProps> = ({
  rows, onChange, onUseTotals, compact = false,
}) => {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const list = Array.isArray(rows) ? rows : [];

  const update = (index: number, patch: Partial<IngredientRowDraft>) => {
    onChange(list.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const remove = (index: number) => {
    const next = list.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [emptyIngredientRow()]);
  };

  // Пустое КБЖУ — подставляем из каталога на указанный вес. Введённые руками
  // значения не трогаем никогда.
  const autoFill = (index: number) => {
    const row = list[index];
    if (!row || !String(row.name || '').trim()) return;
    const hasNutrition = MACROS.some(macro => toNum(row[macro.key]) > 0);
    if (hasNutrition) return;
    const food = findFood(row.name);
    if (!food) return;
    const grams = Math.max(1, Math.round(toNum(row.grams) || 100));
    const factor = grams / 100;
    onChange(list.map((item, i) => (i === index ? {
      ...item,
      grams: item.grams.trim() ? item.grams : String(grams),
      kcal: String(Math.round((food.kcal || 0) * factor)),
      protein: String(round1((food.protein || 0) * factor)),
      fat: String(round1((food.fat || 0) * factor)),
      carbs: String(round1((food.carbs || 0) * factor)),
    } : item)));
  };

  const parseBulk = () => {
    const lines = bulkText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) { setBulkOpen(false); return; }
    const parsed = componentsFromIngredientLines(lines);
    const named = list.filter(row => String(row.name || '').trim());
    onChange([...named, ...componentsToIngredientRows(parsed), emptyIngredientRow()]);
    setBulkText('');
    setBulkOpen(false);
  };

  const components = rowsToComponents(list);
  const totals = sumIngredientComponents(components);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {list.map((row, index) => (
        <div key={index} style={{ padding: compact ? 6 : 8, borderRadius: 12, background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <input value={row.name} onChange={e => update(index, { name: e.target.value })}
              onBlur={() => autoFill(index)}
              aria-label={`Ингредиент ${index + 1}: название`} placeholder="Продукт"
              style={{ ...fieldStyle, flex: 1, minWidth: 0, textAlign: 'left', fontSize: 13 }} />
            <input value={row.grams} onChange={e => update(index, { grams: e.target.value })}
              onBlur={() => autoFill(index)}
              inputMode="decimal" aria-label={`Ингредиент ${index + 1}: граммы`} placeholder="г"
              style={{ ...fieldStyle, width: 68, flexShrink: 0, padding: '10px 4px' }} />
            <button type="button" onClick={() => remove(index)}
              aria-label={`Удалить ингредиент ${index + 1}`} title="Удалить ингредиент"
              style={{ flexShrink: 0, width: 40, height: 44, borderRadius: 10, cursor: 'pointer', fontSize: 12,
                border: '1px solid rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.08)', color: '#fca5a5' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
            {MACROS.map(macro => (
              <div key={macro.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <input value={row[macro.key]} onChange={e => update(index, { [macro.key]: e.target.value } as Partial<IngredientRowDraft>)}
                  inputMode="decimal" aria-label={`Ингредиент ${index + 1}: ${macro.label}`}
                  placeholder={macro.short}
                  style={{ ...fieldStyle, minHeight: 40, padding: '8px 4px', fontSize: 12, color: macro.color,
                    border: `1px solid ${macro.color}22` }} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onChange([...list, emptyIngredientRow()])}
          aria-label="Добавить ингредиент"
          style={{ flex: '1 1 auto', minHeight: 44, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
            fontSize: 11, fontWeight: 700, border: '1px dashed rgba(0,230,138,0.35)',
            background: 'rgba(0,230,138,0.07)', color: '#00e68a' }}>＋ Ингредиент</button>
        <button type="button" onClick={() => setBulkOpen(open => !open)} aria-expanded={bulkOpen}
          aria-label="Вставить ингредиенты списком"
          style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700,
            border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.65)' }}>📋 Списком</button>
      </div>

      {bulkOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
            aria-label="Ингредиенты рецепта" placeholder={'По одному в строке:\nКурица 200 г\nРис 80 г\nСоус 30 г — без КБЖУ'}
            rows={3} style={{ ...fieldStyle, textAlign: 'left', fontSize: 12, resize: 'vertical', minHeight: 64 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={parseBulk} aria-label="Добавить разобранные ингредиенты"
              style={{ flex: 1, minHeight: 44, borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 800,
                border: '1px solid rgba(0,230,138,0.30)', background: 'rgba(0,230,138,0.12)', color: '#00e68a' }}>
              Добавить в состав
            </button>
            <button type="button" onClick={() => { setBulkText(''); setBulkOpen(false); }}
              aria-label="Отменить вставку списком"
              style={{ minHeight: 44, padding: '0 14px', borderRadius: 10, cursor: 'pointer', fontSize: 11,
                border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.6)' }}>Отмена</button>
          </div>
        </div>
      )}

      {(totals.kcal > 0 || totals.weight > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 10,
          background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.14)' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
            Состав: <b style={{ color: '#00e68a' }}>{Math.round(totals.kcal)} ккал</b>
            {' · '}Б{round1(totals.p)} Ж{round1(totals.f)} У{round1(totals.c)}
            {' · '}{Math.round(totals.weight)} г
          </span>
          {onUseTotals && totals.kcal > 0 && (
            <button type="button" onClick={() => onUseTotals(totals)}
              aria-label="Подставить сумму ингредиентов в КБЖУ рецепта"
              style={{ marginLeft: 'auto', minHeight: 36, padding: '6px 10px', borderRadius: 9, cursor: 'pointer',
                fontSize: 10, fontWeight: 800, border: '1px solid rgba(0,230,138,0.30)',
                background: 'rgba(0,230,138,0.12)', color: '#00e68a' }}>→ в КБЖУ</button>
          )}
        </div>
      )}
      {components.length > 0 && totals.kcal === 0 && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
          Продуктов нет в каталоге — впишите КБЖУ руками, иначе блюдо недосчитает калории.
        </div>
      )}
    </div>
  );
};
