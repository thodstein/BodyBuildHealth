import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * PortionSheet — всплывающее окно «сколько грамм?» при добавлении продукта
 * из поиска. Раньше «＋» молча клал 100 г, и чтобы получить 180 г нужно было
 * потом искать позицию в очереди и править её вручную.
 *
 * Сделано по мотивам MyFitnessPal/FatSecret: продукт → порция → добавить.
 * КБЖУ пересчитывается на лету, поэтому видно, что именно попадёт в дневник.
 */

export interface PortionFoodLike {
  id?: string | number;
  name?: string;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  category?: string;
  brand?: string;
  barcode?: string;
  servingSize?: string;
}

interface Props {
  open: boolean;
  food: PortionFoodLike | null;
  onClose: () => void;
  onAddToQueue: (food: PortionFoodLike, grams: number) => void;
  onAddDirect?: (food: PortionFoodLike, grams: number) => void;
  onAddToBase: (food: PortionFoodLike) => void;
}

const QUICK_GRAMS = [50, 100, 150, 200, 250];
const clampGrams = (v: number) => Math.max(10, Math.min(2000, Math.round(v || 100)));
const round1 = (v: number) => Math.round(v * 10) / 10;

export const PortionSheet: React.FC<Props> = ({ open, food, onClose, onAddToQueue, onAddDirect, onAddToBase }) => {
  const [gramsRaw, setGramsRaw] = useState('100');

  // Каждый новый продукт начинается со 100 г — привычная порция по умолчанию.
  useEffect(() => {
    if (open) setGramsRaw('100');
  }, [open, food?.id, food?.name]);

  const grams = clampGrams(Number.parseFloat(gramsRaw.replace(',', '.')) || 100);
  // Порция с упаковки («60 г», «1 шт = 45 г») — как в MFP: быстрый чип рядом
  // с 50/100/150. Если порция совпадает с обычной — не дублируем.
  const servingGrams = useMemo(() => {
    const m = String(food?.servingSize || '').match(/(\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    const g = clampGrams(Number.parseFloat(m[1].replace(',', '.')));
    return g !== 100 ? g : null;
  }, [food]);
  const quickChips = useMemo(
    () => (servingGrams ? Array.from(new Set([servingGrams, ...QUICK_GRAMS])).sort((a, b) => a - b) : QUICK_GRAMS),
    [servingGrams],
  );
  const totals = useMemo(() => {
    const f = grams / 100;
    return {
      kcal: Math.round((food?.kcal || 0) * f),
      p: round1((food?.protein || 0) * f),
      f: round1((food?.fat || 0) * f),
      c: round1((food?.carbs || 0) * f),
    };
  }, [food, grams]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !food) return null;

  const action = (fn: () => void) => {
    fn();
    onClose();
  };

  const sheet = (
    <div
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Порция: ${food.name || 'продукт'}`}
        className="nd-portion-sheet"
        style={{
          width: '100%', maxWidth: 560, maxHeight: '90dvh', overflowY: 'auto',
          background: 'linear-gradient(180deg,#1d1d21,#161619)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none',
          boxShadow: '0 -18px 50px rgba(0,0,0,0.55)',
          padding: '14px 14px calc(14px + max(env(safe-area-inset-bottom, 0px), 12px))',
          color: '#fff',
        }}
      >
        {/* Ручка-хват */}
        <div style={{ width: 42, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.2)', margin: '0 auto 12px' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{food.name || 'Продукт'}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
              {food.brand ? `${food.brand} · ` : ''}КБЖУ на 100 г: {Math.round(food.kcal || 0)} ккал · Б {round1(food.protein || 0)} · Ж {round1(food.fat || 0)} · У {round1(food.carbs || 0)}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть выбор порции"
            style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        {/* Крупный ввод граммов */}
        <label htmlFor="nd-portion-grams" style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Порция</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 10 }}>
          <input
            id="nd-portion-grams"
            type="number"
            inputMode="decimal"
            min={10}
            max={2000}
            step={10}
            value={gramsRaw}
            aria-label="Порция в граммах"
            onChange={e => setGramsRaw(e.target.value)}
            onBlur={() => setGramsRaw(String(grams))}
            style={{
              flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 14, fontSize: 24, fontWeight: 800,
              textAlign: 'center', color: '#fff', fontVariantNumeric: 'tabular-nums',
              background: '#242428', border: '1px solid rgba(0,230,138,0.35)', outline: 'none', minHeight: 56,
              boxSizing: 'border-box',
            }}
          />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>г</span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {quickChips.map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setGramsRaw(String(v))}
              aria-pressed={grams === v}
              aria-label={`${v} грамм`}
              style={{
                flex: '1 1 56px', minHeight: 44, borderRadius: 12, cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                background: grams === v ? 'rgba(0,230,138,0.16)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${grams === v ? 'rgba(0,230,138,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: grams === v ? '#00e68a' : 'rgba(255,255,255,0.72)',
              }}
            >{v} г{v === servingGrams ? ' · порция' : ''}</button>
          ))}
        </div>

        {/* Итог на выбранную порцию */}
        <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(0,230,138,0.07)', border: '1px solid rgba(0,230,138,0.18)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>Сколько добавится</span>
            <span style={{ fontSize: 19, fontWeight: 900, color: '#00e68a', fontVariantNumeric: 'tabular-nums' }}>{totals.kcal} ккал</span>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 700, flexWrap: 'wrap' }}>
            <span style={{ color: '#60a5fa' }}>Б {totals.p} г</span>
            <span style={{ color: '#fbbf24' }}>Ж {totals.f} г</span>
            <span style={{ color: '#fb923c' }}>У {totals.c} г</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>{grams} г</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => action(() => onAddToQueue(food, grams))}
            aria-label="Добавить в очередь"
            className="nd-portion-add"
            style={{ flex: 1.5, minHeight: 52, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 900, fontSize: 13 }}
          >＋ В очередь</button>
          {onAddDirect && (
            <button
              type="button"
              onClick={() => action(() => onAddDirect(food, grams))}
              aria-label="Сразу в дневник"
              className="nd-portion-direct"
              style={{ flex: 1, minHeight: 52, borderRadius: 14, border: '1px solid rgba(96,165,250,0.35)', background: 'rgba(96,165,250,0.12)', color: '#93c5fd', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
            >⚡ В дневник</button>
          )}
        </div>

        <button
          type="button"
          onClick={() => action(() => onAddToBase(food))}
          aria-label="Добавить в мою базу продуктов"
          className="nd-portion-base"
          style={{ width: '100%', marginTop: 8, minHeight: 46, borderRadius: 14, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.10)', color: '#c4b5fd', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >🏷 Добавить в мою базу продуктов</button>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
};
