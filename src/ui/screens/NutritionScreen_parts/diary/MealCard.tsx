import React from 'react';
import { type DiaryItem } from '../types';

interface MealCardProps {
  mealName: string;
  items: any[];
  onEditItem: (meal: string, idx: number, item: any) => void;
  onDeleteItem: (meal: string, idx: number) => void;
  onCopyMeal: (meal: string) => void;
  onSavePreset: (meal: string, items: any[]) => void;
}

export const MealCard: React.FC<MealCardProps> = ({ mealName, items, onEditItem, onDeleteItem, onCopyMeal, onSavePreset }) => {
  const mealKcal = items.reduce((s: number, i: any) => s + (i.kcal || 0), 0);
  const mealP = items.reduce((s: number, i: any) => s + (i.p || 0), 0);
  const mealF = items.reduce((s: number, i: any) => s + (i.f || 0), 0);
  const mealC = items.reduce((s: number, i: any) => s + (i.c || 0), 0);
  const accent = (() => {
    const n = mealName.toLowerCase();
    if (n.includes('завтрак')) return { bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.15)', color:'#f59e0b', dot:'#f59e0b' };
    if (n.includes('обед')) return { bg:'rgba(0,230,138,0.08)', border:'rgba(0,230,138,0.15)', color:'#00e68a', dot:'#00e68a' };
    if (n.includes('ужин')) return { bg:'rgba(139,92,246,0.08)', border:'rgba(139,92,246,0.15)', color:'#a78bfa', dot:'#a78bfa' };
    if (n.includes('перекус') || n.includes('полдник')) return { bg:'rgba(59,130,246,0.07)', border:'rgba(59,130,246,0.15)', color:'#60a5fa', dot:'#60a5fa' };
    if (n.includes('трениров')) return { bg:'rgba(236,72,153,0.07)', border:'rgba(236,72,153,0.15)', color:'#ec4899', dot:'#ec4899' };
    return { bg:'rgba(0,230,138,0.06)', border:'rgba(0,230,138,0.1)', color:'#00e68a', dot:'#00e68a' };
  })();

  return (
    <div className="nut-mealcard" style={{ 
      marginBottom: 10, borderRadius: 16, background: '#18181b', 
      border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
    }}>
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '10px 12px', background: accent.bg, borderBottom: `1px solid ${accent.border}`,
        borderLeft: `3px solid ${accent.dot}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width:8, height:8, borderRadius:4, background: accent.dot, boxShadow:`0 0 6px ${accent.dot}60` }} />
          <span style={{ fontWeight: 700, fontSize: 12, color: accent.color }}>{mealName}</span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', background:'rgba(255,255,255,0.06)', padding:'1px 6px', borderRadius:6 }}>{items.length} поз.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', marginRight: 2, display:'flex', gap:4 }}>
            <span style={{ color:'#60a5fa' }}>Б{Math.round(mealP)}</span>
            <span style={{ color:'rgba(255,255,255,0.2)' }}>·</span>
            <span style={{ color:'#f59e0b' }}>Ж{Math.round(mealF)}</span>
            <span style={{ color:'rgba(255,255,255,0.2)' }}>·</span>
            <span style={{ color:'#f97316' }}>У{Math.round(mealC)}</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: accent.color }}>{Math.round(mealKcal)}</span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>ккал</span>
        </div>
      </div>
      
      <div style={{ padding: '4px 8px 8px' }}>
        {items.map((item: any, idx: number) => (
          <div key={idx} style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '8px 6px', fontSize: 10, color: 'rgba(255,255,255,0.8)', 
            borderBottom: '1px solid rgba(255,255,255,0.03)', minHeight: 44,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                {typeof item.confidence === 'number' && item.confidence < 0.5 && (
                  <span style={{ fontSize: 8, color: '#f59e0b', fontWeight: 700, background: 'rgba(245,158,11,0.12)', padding: '1px 5px', borderRadius: 4 }}>⚠</span>
                )}
              </div>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{item.qty || '100 г'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
                {Math.round(item.kcal || 0)} ккал
              </span>
              <button onClick={() => onEditItem(mealName, idx, item)} aria-label="Изменить" 
                style={{ padding: '6px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', 
                background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontSize: 11, minWidth: 32, minHeight: 32 }}>
                ✎
              </button>
              <button onClick={() => onDeleteItem(mealName, idx)} aria-label="Удалить"
                style={{ padding: '6px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 11, minWidth: 32, minHeight: 32 }}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', gap: 6, padding: '0 8px 8px' }}>
        <button onClick={() => onCopyMeal(mealName)} aria-label="Копировать приём"
          style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1px solid rgba(139,92,246,0.2)', 
          background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', fontSize: 10, fontWeight: 600, cursor: 'pointer', minHeight: 36 }}>
          📋 Копировать
        </button>
        <button onClick={() => onSavePreset(mealName, items)} aria-label="Сохранить пресет"
          style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1px solid rgba(0,230,138,0.2)',
          background: 'rgba(0,230,138,0.08)', color: '#00e68a', fontSize: 10, fontWeight: 600, cursor: 'pointer', minHeight: 36 }}>
          💾 Пресет
        </button>
      </div>
    </div>
  );
};
