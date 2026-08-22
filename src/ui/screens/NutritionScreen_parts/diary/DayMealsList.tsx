import React from 'react';
import { MealCard } from './MealCard';

interface DayMealsListProps {
  dayMeals: Record<string, any[]>;
  onEditItem: (meal: string, idx: number, item: any) => void;
  onDeleteItem: (meal: string, idx: number) => void;
  onCopyMeal: (meal: string) => void;
  onSavePreset: (meal: string, items: any[]) => void;
  onImportFromPlan: () => void;
  onClearDay: () => void;
  onFillMicros: () => void;
  selectedDate: string;
  copySource: string | null;
  onPasteMeal: (date: string) => void;
  onCancelCopy: () => void;
}

export const DayMealsList: React.FC<DayMealsListProps> = ({
  dayMeals, onEditItem, onDeleteItem, onCopyMeal, onSavePreset,
  onImportFromPlan, onClearDay, onFillMicros, selectedDate, copySource, onPasteMeal, onCancelCopy,
}) => {
  const mealNames = Object.keys(dayMeals);
  const hasData = mealNames.length > 0;

  if (!hasData) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 20px 28px', borderRadius: 16, background: 'linear-gradient(135deg, rgba(0,230,138,0.06), rgba(24,24,27,0.9))', border: '1px solid rgba(0,230,138,0.12)', boxShadow:'0 4px 16px rgba(0,0,0,0.15)' }}>
        <div style={{ width:56, height:56, borderRadius:16, background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:28 }}>🍽</div>
        <div style={{ fontSize: 13, color: '#fff', marginBottom: 6, fontWeight: 700 }}>Пока пусто — начните день</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom:14, lineHeight:1.5 }}>Добавьте завтрак, обед или перекус — поиск, штрихкод, фото чека или план</div>
        <div style={{ display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.6)' }}>🔍 Поиск</span>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.6)' }}>📱 Штрихкод</span>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.6)' }}>📸 Фото</span>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:8, background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a', fontWeight:600 }}>📥 Из плана</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Actions bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button onClick={onImportFromPlan} aria-label="Импорт из плана"
          style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(0,230,138,0.2)',
            background: 'rgba(0,230,138,0.06)', color: '#00e68a', fontSize: 10, fontWeight: 600, cursor: 'pointer', minHeight: 36 }}>
          📥 Из плана
        </button>
        <button onClick={onFillMicros} aria-label="Дорисовать микронутриенты"
          style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.06)', color: '#86efac', fontSize: 10, fontWeight: 600, cursor: 'pointer', minHeight: 36 }}>
          ✨ Микро
        </button>
        <button onClick={onClearDay} aria-label="Очистить день"
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)',
            background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: 10, fontWeight: 600, cursor: 'pointer', minHeight: 36 }}>
          🗑 Очистить
        </button>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
          {mealNames.length} приёмов
        </span>
      </div>

      {/* Copy paste banner */}
      {copySource && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 12,
          background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>📋 Вставить «{copySource}»?</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onPasteMeal(selectedDate)} aria-label="Вставить"
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'rgba(139,92,246,0.2)', color: '#8b5cf6', fontSize: 10, fontWeight: 600, minHeight: 32 }}>
              Сюда
            </button>
            <button onClick={onCancelCopy} aria-label="Отмена"
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontSize: 10, minHeight: 32 }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Meal cards */}
      {mealNames.map(meal => (
        <MealCard key={meal} mealName={meal} items={dayMeals[meal]} 
          onEditItem={onEditItem} onDeleteItem={onDeleteItem} onCopyMeal={onCopyMeal} onSavePreset={onSavePreset} />
      ))}
    </div>
  );
};
