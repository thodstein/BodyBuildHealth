import React from "react";
import { usePlanCtx } from "./IndividualPlanContext";
import { FOOD_DB } from "../../../../core/nutrition-database";

export const MealComposer: React.FC = () => {
  const {
    dayPlan, threeDayPlan, weekPlan, generatePlan,
    DAY_LABELS, trainingDays, planDays, setPlanDays,
    selectedDayIndex, setSelectedDayIndex,
    generated, setGenerated,
    effectiveKcal, effectiveP, effectiveF, effectiveC,
    renderMealList, resultsRef,
    showRecipeCreator, setShowRecipeCreator,
    userRecipes, setUserRecipes,
    removeFoodItem, replaceFoodItem, findSimilarFoods, updateItemAmount,
    editItem, setEditItem, editAmount, setEditAmount, replacingItem, setReplacingItem,
    shoppingList, cyclingMode,
  } = usePlanCtx();

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {!generated && (
        <div style={{ padding:16, textAlign:'center', background:'rgba(0,230,138,0.03)', borderRadius:12, border:'1px solid rgba(0,230,138,0.1)' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.85)', marginBottom:10 }}>Сначала сгенерируйте план в разделе «План»</div>
          <button onClick={() => { setGenerated(true); generatePlan(1); }} style={{
            padding:'8px 20px', borderRadius:8, cursor:'pointer', fontSize:10, fontWeight:700,
            background:'linear-gradient(135deg,#00e68a,#00c8a0)', border:'none', color:'#000',
          }}>✨ Сгенерировать план на 1 день</button>
        </div>
      )}

      {generated && (
        <>
          <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
            {DAY_LABELS.map((label, idx) => (
              <button key={idx} onClick={() => { setPlanDays(1); setSelectedDayIndex(idx); generatePlan(1, undefined, idx); }} style={{
                width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:9,
                border: planDays===1 && selectedDayIndex===idx ? '2px solid #00e68a' : '2px solid #3f3f46',
                background: planDays===1 && selectedDayIndex===idx ? 'rgba(0,230,138,0.2)' : '#202023',
                color: planDays===1 && selectedDayIndex===idx ? '#00e68a' : 'rgba(255,255,255,0.85)',
                fontWeight: planDays===1 && selectedDayIndex===idx ? 800 : 500,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>{label}</button>
            ))}
          </div>

          {renderMealList ? (
            renderMealList(dayPlan || threeDayPlan?.[selectedDayIndex] || null, true)
          ) : (
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', textAlign:'center', padding:20 }}>
              Выберите день для просмотра состава приёмов пищи
            </div>
          )}
        </>
      )}
    </div>
  );
};
