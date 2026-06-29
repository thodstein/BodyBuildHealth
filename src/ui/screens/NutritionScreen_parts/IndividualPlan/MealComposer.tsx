import React from "react";
import { usePlanCtx } from "./IndividualPlanContext";
import { FOOD_DB } from "../../../../core/nutrition-database";
import { getRecipesByMeal } from "../../../../engines/nutrition-periodization.engine";

export const MealComposer: React.FC = () => {
  const {
    dayPlan, threeDayPlan, generatePlan,
    DAY_LABELS, planDays, setPlanDays,
    selectedDayIndex, setSelectedDayIndex,
    generated, setGenerated,
    renderMealList,
    removeFoodItem, replaceFoodItem, findSimilarFoods,
    editItem, setEditItem, editAmount, setEditAmount, replacingItem, setReplacingItem,
    recipePickerMeal, setRecipePickerMeal, replaceMealWithRecipe,
    undoStack, setUndoStack, setDayPlan,
  } = usePlanCtx();

  const plan = dayPlan || (threeDayPlan ? threeDayPlan[selectedDayIndex] : null);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ padding:10, borderRadius:10, background:'rgba(0,230,138,0.03)', border:'1px solid rgba(0,230,138,0.08)' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>🍳 Компоновщик приёмов</div>
        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
          🔄 <b>Заменить</b> — выберите продукт и найдите лучшую замену.
          ✏️ <b>Кол-во</b> — измените граммовку продукта.
          🍳 <b>Рецепт</b> — замените весь приём готовым рецептом.
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

      {generated && plan && (
        <>
          <div style={{ display:'flex', gap:4, justifyContent:'center', flexWrap:'wrap' }}>
            {DAY_LABELS.map((label, idx) => (
              <button key={idx} onClick={() => { setPlanDays(1); setSelectedDayIndex(idx); generatePlan(1, undefined, idx); }} style={{
                padding:'6px 10px', borderRadius:20, cursor:'pointer', fontSize:10,
                border: planDays===1 && selectedDayIndex===idx ? '2px solid #00e68a' : '1px solid #3f3f46',
                background: planDays===1 && selectedDayIndex===idx ? 'rgba(0,230,138,0.15)' : '#202023',
                color: planDays===1 && selectedDayIndex===idx ? '#00e68a' : 'rgba(255,255,255,0.7)',
                fontWeight: planDays===1 && selectedDayIndex===idx ? 700 : 500,
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
            <button onClick={() => { setPlanDays(3); generatePlan(3, undefined, 0); }} style={{
              padding:'4px 10px', borderRadius:12, cursor:'pointer', fontSize:8, fontWeight:600,
              background: planDays===3?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.03)',
              border: planDays===3?'1px solid rgba(0,230,138,0.25)':'1px solid rgba(255,255,255,0.06)',
              color: planDays===3?'#00e68a':'rgba(255,255,255,0.6)',
            }}>📅 3 дня</button>
            <button onClick={() => { setPlanDays(7); generatePlan(7, undefined, 0); }} style={{
              padding:'4px 10px', borderRadius:12, cursor:'pointer', fontSize:8, fontWeight:600,
              background: planDays===7?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.03)',
              border: planDays===7?'1px solid rgba(0,230,138,0.25)':'1px solid rgba(255,255,255,0.06)',
              color: planDays===7?'#00e68a':'rgba(255,255,255,0.6)',
            }}>📅 Неделя</button>
            {undoStack.length > 0 && (
              <button onClick={() => { setDayPlan(undoStack[0]); setUndoStack(undoStack.slice(1)); }} style={{
                padding:'4px 10px', borderRadius:12, cursor:'pointer', fontSize:8, fontWeight:600,
                background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.2)', color:'#60a5fa',
              }}>↩ Отменить</button>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(plan.meals || []).map((meal: any, mi: number) => {
              const mealTotals = meal.totals || { kcal:0, p:0, f:0, c:0 };
              return (
                <div key={mi} style={{ borderRadius:12, overflow:'hidden', background:'rgba(24,24,27,0.3)', border:'1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', background:'rgba(255,255,255,0.02)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{meal.label || `Приём ${mi+1}`}</div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)' }}>
                        {mealTotals.kcal} ккал · Б{mealTotals.p}г Ж{mealTotals.f}г У{mealTotals.c}г
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => setRecipePickerMeal({ dayIdx:0, mealIdx:mi, label:meal.label })} style={{
                        padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:7, fontWeight:600,
                        background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.15)', color:'#a78bfa',
                      }}>🍳 Рецепт</button>
                    </div>
                  </div>

                  <div style={{ padding:'6px 10px' }}>
                    {(meal.items || []).map((item: any, ii: number) => {
                      const isEditing = editItem?.mealIdx===mi && editItem?.itemIdx===ii;
                      const isReplacing = replacingItem?.mealIdx===mi && replacingItem?.itemIdx===ii;
                      const food = FOOD_DB.find(f => f.id === item.id || f.name === item.name);
                      const displayName = food?.name || item.name || item.id;
                      const displayKcal = item.kcal || 0;
                      const amount = item.amount || 100;

                      if (isEditing) return (
                        <div key={ii} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', marginBottom:3, borderRadius:8, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.12)' }}>
                          <span style={{ fontSize:9, fontWeight:600, color:'#fff', flex:1 }}>{displayName}</span>
                          <input type="number" value={editAmount} onChange={e => setEditAmount(parseInt(e.target.value)||0)} style={{
                            width:50, padding:'4px', borderRadius:4, fontSize:9, background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', textAlign:'center', boxSizing:'border-box',
                          }} />
                          <span style={{ fontSize:7, color:'rgba(255,255,255,0.5)' }}>г</span>
                          <button onClick={() => {
                            const newItems = [...plan.meals[mi].items];
                            newItems[ii] = { ...newItems[ii], amount: editAmount, kcal: food ? Math.round((food.kcal||0) * editAmount / 100) : 0, p: food ? Math.round((food.protein||0) * editAmount / 100) : 0, f: food ? Math.round((food.fat||0) * editAmount / 100) : 0, c: food ? Math.round((food.carbs||0) * editAmount / 100) : 0 };
                            const newMeals = [...plan.meals];
                            newMeals[mi] = { ...newMeals[mi], items: newItems };
                            setDayPlan({ ...plan, meals: newMeals });
                            setEditItem(null);
                          }} style={{ padding:'3px 8px', borderRadius:4, fontSize:7, fontWeight:700, background:'#3b82f6', border:'none', color:'#fff', cursor:'pointer' }}>OK</button>
                          <button onClick={() => setEditItem(null)} style={{ padding:'3px 6px', borderRadius:4, fontSize:7, background:'rgba(255,255,255,0.04)', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer' }}>✕</button>
                        </div>
                      );

                      if (isReplacing) return (
                        <div key={ii} style={{ padding:'6px 8px', marginBottom:3, borderRadius:8, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.12)' }}>
                          <div style={{ fontSize:9, fontWeight:600, color:'#f59e0b', marginBottom:4 }}>🔄 Замена: {displayName}</div>
                          <div style={{ maxHeight:120, overflowY:'auto' }}>
                            {findSimilarFoods(item).slice(0, 10).map((s: any) => (
                              <button key={s.id} onClick={() => replaceFoodItem(0, mi, ii, s)} style={{
                                display:'block', width:'100%', padding:'6px 8px', marginBottom:2, borderRadius:6, cursor:'pointer',
                                background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.08)', color:'#fff',
                                fontSize:8, textAlign:'left',
                              }}>
                                {s.name} — {s.kcal}ккал Б{s.protein} Ж{s.fat} У{s.carbs}
                              </button>
                            ))}
                          </div>
                          <button onClick={() => setReplacingItem(null)} style={{ marginTop:4, padding:'3px 10px', borderRadius:4, fontSize:7, background:'rgba(255,255,255,0.04)', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer' }}>Отмена</button>
                        </div>
                      );

                      return (
                        <div key={ii} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.02)' }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:9, fontWeight:600, color:'#fff' }}>{displayName}</div>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)' }}>
                              {amount}г · {displayKcal}ккал · Б{item.p||0}г Ж{item.f||0}г У{item.c||0}г
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:2 }}>
                            <button onClick={() => { setEditItem({ dayIdx:0, mealIdx:mi, itemIdx:ii }); setEditAmount(amount); }} style={{
                              width:22, height:22, borderRadius:4, cursor:'pointer', fontSize:9,
                              background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.12)', color:'#60a5fa',
                              display:'flex', alignItems:'center', justifyContent:'center',
                            }} title="Изменить количество">✏️</button>
                            <button onClick={() => setReplacingItem({ dayIdx:0, mealIdx:mi, itemIdx:ii })} style={{
                              width:22, height:22, borderRadius:4, cursor:'pointer', fontSize:9,
                              background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.12)', color:'#f59e0b',
                              display:'flex', alignItems:'center', justifyContent:'center',
                            }} title="Заменить продукт">🔄</button>
                            <button onClick={() => removeFoodItem(0, mi, ii)} style={{
                              width:22, height:22, borderRadius:4, cursor:'pointer', fontSize:9,
                              background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.12)', color:'#ef4444',
                              display:'flex', alignItems:'center', justifyContent:'center',
                            }} title="Удалить продукт">✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {plan && (!plan.meals || plan.meals.length === 0) && (
            <div style={{ textAlign:'center', padding:30, color:'rgba(255,255,255,0.5)', fontSize:9 }}>
              План пуст. Сгенерируйте план или выберите другой день.
            </div>
          )}
        </>
      )}

      {generated && !plan && (
        <div style={{ textAlign:'center', padding:30, color:'rgba(255,255,255,0.5)', fontSize:9 }}>
          Выберите день для просмотра приёмов
        </div>
      )}

      {recipePickerMeal && generated && plan && (
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
                  <div style={{ color:'rgba(255,255,255,0.85)', marginBottom:4 }}>⏱{r.prepTimeMin}мин · {r.kcal}ккал · Б{r.protein}/Ж{r.fat}/У{r.carbs}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setRecipePickerMeal(null)} style={{ width:'100%', marginTop:8, padding:'6px', borderRadius:8, cursor:'pointer', border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'rgba(255,255,255,0.85)', fontSize:8, fontWeight:600 }}>✕ Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealComposer;
