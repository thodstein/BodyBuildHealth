import React from "react";
import { usePlanCtx } from "./IndividualPlanContext";
import { FOOD_DB } from "../../../../core/nutrition-database";
import { getRecipesByMeal } from "../../../../engines/nutrition-periodization.engine";
import { MealQuickControls } from "./MealQuickControls";

export const MealComposer: React.FC = () => {
  const {
    dayPlan, threeDayPlan, generatePlan,
    DAY_LABELS, planDays, setPlanDays,
    selectedDayIndex, setSelectedDayIndex,
    generated, setGenerated,
    renderMealList,
    recipePickerMeal, setRecipePickerMeal, replaceMealWithRecipe,
  } = usePlanCtx();

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ padding:10, borderRadius:10, background:'rgba(0,230,138,0.03)', border:'1px solid rgba(0,230,138,0.08)' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>🍳 Компоновщик приёмов</div>
        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
          🔄 <b>Заменить</b> — выберите продукт и найдите замену.
          ✏️ <b>Кол-во</b> — измените граммовку.
          🍳 <b>Рецепт</b> — замените приём готовым рецептом.
          ↩ <b>Отменить</b> — вернуть последнее изменение.
        </div>
      </div>

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
          <MealQuickControls />

          <div style={{ display:'flex', gap:4, justifyContent:'center', flexWrap:'wrap' }}>
            {DAY_LABELS.map((label: string, idx: number) => (
              <button key={idx} onClick={() => { setPlanDays(1); setSelectedDayIndex(idx); generatePlan(1, undefined, idx); }} style={{
                padding:'6px 10px', borderRadius:20, cursor:'pointer', fontSize:10,
                border: planDays===1 && selectedDayIndex===idx ? '2px solid #00e68a' : '1px solid #3f3f46',
                background: planDays===1 && selectedDayIndex===idx ? 'rgba(0,230,138,0.15)' : '#202023',
                color: planDays===1 && selectedDayIndex===idx ? '#00e68a' : 'rgba(255,255,255,0.7)',
                fontWeight: planDays===1 && selectedDayIndex===idx ? 700 : 500,
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:6 }}>
            <button onClick={() => { setPlanDays(3); generatePlan(3); }} style={{
              padding:'4px 10px', borderRadius:12, cursor:'pointer', fontSize:8, fontWeight:600,
              background: planDays===3?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.03)',
              border: planDays===3?'1px solid rgba(0,230,138,0.25)':'1px solid rgba(255,255,255,0.06)',
              color: planDays===3?'#00e68a':'rgba(255,255,255,0.6)',
            }}>📅 3 дня</button>
            <button onClick={() => { setPlanDays(7); generatePlan(7); }} style={{
              padding:'4px 10px', borderRadius:12, cursor:'pointer', fontSize:8, fontWeight:600,
              background: planDays===7?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.03)',
              border: planDays===7?'1px solid rgba(0,230,138,0.25)':'1px solid rgba(255,255,255,0.06)',
              color: planDays===7?'#00e68a':'rgba(255,255,255,0.6)',
            }}>📅 Неделя</button>
          </div>

          {renderMealList ? (
            renderMealList(dayPlan || (threeDayPlan ? threeDayPlan[selectedDayIndex] : null), true)
          ) : (
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', textAlign:'center', padding:20 }}>
              Выберите день для просмотра состава приёмов
            </div>
          )}

          {recipePickerMeal && generated && dayPlan && (
            <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center', background:'rgba(0,0,0,0.7)' }}
              onClick={() => setRecipePickerMeal(null)}>
              <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:400, padding:'14px 20px 28px', borderRadius:'20px 20px 0 0', background:'#18181b', boxShadow:'0 -4px 30px rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.06)', borderBottom:'none' }}>
                <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'0 auto 16px' }} />
                <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:4 }}>🍳 Заменить «{recipePickerMeal.label}» рецептом</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:12 }}>Подходящие рецепты</div>
                <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                  {getRecipesByMeal(recipePickerMeal.label === 'Завтрак' ? 'breakfast' : recipePickerMeal.label === 'Обед' || recipePickerMeal.label === 'Второй завтрак' ? 'lunch' : recipePickerMeal.label === 'Ужин' ? 'dinner' : 'snack').length === 0 ? (
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', textAlign:'center', padding:10 }}>Нет рецептов для этого приёма.</div>
                  ) : getRecipesByMeal(recipePickerMeal.label === 'Завтрак' ? 'breakfast' : recipePickerMeal.label === 'Обед' || recipePickerMeal.label === 'Второй завтрак' ? 'lunch' : recipePickerMeal.label === 'Ужин' ? 'dinner' : 'snack').map((r: any, i: number) => (
                    <button key={i} onClick={() => replaceMealWithRecipe(r, recipePickerMeal.mealIdx)} style={{ width:'100%', padding:'10px 12px', borderRadius:12, cursor:'pointer', textAlign:'left', background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:9 }}>
                      <div style={{ fontWeight:700, color:'#a78bfa', fontSize:10, marginBottom:2 }}>{r.name}</div>
                      <div style={{ color:'rgba(255,255,255,0.85)' }}>⏱{r.prepTimeMin}мин · {r.kcal}ккал · Б{r.protein}/Ж{r.fat}/У{r.carbs}</div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setRecipePickerMeal(null)} style={{ width:'100%', marginTop:8, padding:'6px', borderRadius:8, cursor:'pointer', border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'rgba(255,255,255,0.85)', fontSize:8, fontWeight:600 }}>✕ Отмена</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MealComposer;
