import React, { useState } from "react";
import { addToCart } from "../../../../core/nutrition-utils";
import { FOOD_DB } from "../../../../core/nutrition-database";
import { getRecipesByMeal } from "../../../../engines/nutrition-periodization.engine";
import { generateNutritionReport } from "../../../../engines/nutrition-report.engine";
import { ALLERGEN_LIST } from "./types";
import type { DrugInjection } from "./types";
import { GlassCard, greenBtn, reportPillStyle } from "./ui";
import { usePlanCtx } from "./IndividualPlanContext";
import { DailyDietDashboard } from "../DailyDietDashboard";

export const IndividualPlanResults: React.FC = () => {
  const {
    generatePlan, planDays, setPlanDays, selectedDayIndex, setSelectedDayIndex,
    DAY_LABELS, trainingDays, planView, setPlanView, weekPlan, setWeekPlan,
    monthPlanMode, setMonthPlanMode, monthPlan, setMonthPlan,
    selectedWeek, setSelectedWeek,
    generated, setGenerated, dayPlan, threeDayPlan, resultsRef,
    renderMealList, effectiveKcal, effectiveP, effectiveF, effectiveC,
    dayPlanNotes, setDayPlanNotes,
    autoCorrectPlan, allergens, allergenExcludedCount,
    cyclingMode, waterCalc,
    showRecipeCreator, setShowRecipeCreator, newRecipe, setNewRecipe,
    userRecipes, setUserRecipes,
    shoppingList, injections,
    recipePickerMeal, setRecipePickerMeal,
    replaceMealWithRecipe, undoStack, setUndoStack,
    saveCurrentPlan, savedPlans, setSavedPlans, expandedSavedId, setExpandedSavedId,
    loadSavedPlan, weight, budget,
    generateCheatMeal, cheatMealPlan, setCheatMealPlan,
    generateCarbload, carbloadPlan, setCarbloadPlan,
    generateBUTCH, butchPlan, setButchPlan,
    generateCravingPlan, cravingPlan, setCravingPlan,
    generateLazyDayPlan, lazyDayPlan, setLazyDayPlan,
    generateRecommendations, recommendations, setRecommendations,
    specialMealMode, setSpecialMealMode, specialMealProteinG, specialMealFatG, specialMealCarbsG,
    specialMealGoal, specialMealTiming, specialMealReplaceMode, specialMealReplaceTarget,
    cravingMode, setCravingMode, lazyDayMode, setLazyDayMode, cravingDays, lazyDayDays,
    generateMealPrep, mealPrepPlan, mealPrepDays, setMealPrepDays,
    saveUndo,
    generateAllergenReport, allergenReport,
    generateNutrientReport, nutrientReport,
    generateQualityReport, qualityReport,
    generateRiskReport, riskReport,
    generateDrugCompatReport, drugCompatReport,
    generateFullNutritionReport, nutritionReport, activeReports,
    editItem, setEditItem, editAmount, setEditAmount, replacingItem, setReplacingItem,
    removeFoodItem, replaceFoodItem, findSimilarFoods, updateItemAmount,
    setDayPlan, planTargets, healthIssues, planType, variety,
    linkToTraining, trainStart,
    workScheduleEnabled, workStartTime, workEndTime, workDays, workScheduleType,
  } = usePlanCtx();


  return (
    <>
      <button onClick={() => generatePlan(1)} style={{
        ...greenBtn, fontSize: 14, padding: 14,
        boxShadow: '0 4px 20px rgba(0,230,138,0.2)',
      }}>
        ✨ Сгенерировать план питания
      </button>
      <button onClick={() => {
        setMonthPlanMode(true);
        setMonthPlan([]);
        for (let w = 0; w < 4; w++) {
          setTimeout(() => generatePlan(7, w), w * 500);
        }
      }} style={{
        ...greenBtn, fontSize: 10, padding: 10,
        background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa',
      }}>
        📅 План на месяц (4 недели)
      </button>

      <div ref={resultsRef as any} />
      {generated && (
        <GlassCard title="Выбор дней" icon="📅" color="#00e68a">
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:7, marginBottom:4, textAlign:'center' }}>Нажмите на день для плана на 1 день</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:8 }}>
            {DAY_LABELS.map((label, idx) => {
              const isTrain = trainingDays[idx];
              const isSelected = planDays === 1 && selectedDayIndex === idx;
              return (
                <button key={idx} onClick={() => { setPlanDays(1); setSelectedDayIndex(idx); generatePlan(1, undefined, idx); }} style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                  padding:'6px 2px', borderRadius:10, cursor:'pointer',
                  background: isSelected ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : isTrain ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                  border: isSelected ? 'none' : isTrain ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  color: isSelected ? '#000' : isTrain ? '#22c55e' : 'rgba(255,255,255,0.7)',
                  fontWeight: isSelected ? 800 : isTrain ? 600 : 400,
                  fontSize:9, transition:'all 0.15s',
                }}>
                  <span style={{ fontSize:7, opacity:0.6 }}>{label}</span>
                  <span style={{ fontSize:10 }}>{isTrain ? '🏋️' : '🛌'}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:6 }}>
            <button onClick={() => { setPlanDays(3); generatePlan(3); }} style={{
              padding:'10px', borderRadius:10, cursor:'pointer', textAlign:'center',
              background: planDays === 3 ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023',
              border: planDays === 3 ? 'none' : '1px solid rgba(255,255,255,0.06)',
              color: planDays === 3 ? '#000' : 'rgba(255,255,255,0.85)',
              fontWeight:700, fontSize:10,
            }}>📅 На 3 дня</button>
            <button onClick={() => { setPlanDays(7); setPlanView('calendar'); if (!weekPlan) generatePlan(7); }} style={{
              padding:'10px', borderRadius:10, cursor:'pointer', textAlign:'center',
              background: planDays === 7 ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : '#202023',
              border: planDays === 7 ? 'none' : '1px solid rgba(255,255,255,0.06)',
              color: planDays === 7 ? '#fff' : 'rgba(255,255,255,0.85)',
              fontWeight:700, fontSize:10,
            }}>📆 Неделя</button>
          </div>
          {planDays === 7 && (
            <button onClick={() => setPlanView(planView === 'list' ? 'calendar' : 'list')} style={{
              marginTop: 0, marginBottom:6, padding: '6px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600, width: '100%',
              background: planView === 'calendar' ? 'rgba(139,92,246,0.15)' : '#202023',
              border: planView === 'calendar' ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: planView === 'calendar' ? '#a78bfa' : 'rgba(255,255,255,0.85)',
            }}>📅 {planView === 'calendar' ? 'Список' : 'Календарь'}</button>
          )}
          {planDays !== 1 && (
            <button onClick={() => generatePlan(planDays)} style={{ marginTop: 0, marginBottom:6, padding: '8px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)', color: '#00e68a', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>
              🔄 Перегенерировать {planDays === 3 ? '3 дня' : 'неделю'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button onClick={() => {
              const txt = dayPlan ? `🍽 План питания\n${dayPlan.meals.map((m: any) => `${m.time} ${m.label}: ${m.items.map((it: any) => `${it.name} ${it.amount}г`).join(', ')}  [${Math.round(m.totals?.kcal || 0)}ккал]`).join('\n')}\n\n📊 Итого: ${Math.round(dayPlan.totals.kcal)} ккал, Б${Math.round(dayPlan.totals.p)}/Ж${Math.round(dayPlan.totals.f)}/У${Math.round(dayPlan.totals.c)}` : '';
              navigator.clipboard?.writeText(txt);
            }} style={{ flex:1, padding:'5px', borderRadius:6, cursor:'pointer', border:'1px solid rgba(96,165,250,0.2)', background:'rgba(96,165,250,0.06)', color:'#60a5fa', fontSize:7, fontWeight:600 }}>📤 Копировать</button>
            <button onClick={() => {
              const input = prompt('Вставьте план из буфера:');
              if (!input) return;
              try {
                const parsed = JSON.parse(input);
                if (parsed.meals) { setDayPlan(parsed); setGenerated(true); }
              } catch { alert('Неверный формат. Скопируйте план через кнопку "Копировать план".'); }
            }} style={{ flex:1, padding:'5px', borderRadius:6, cursor:'pointer', border:'1px solid rgba(249,115,22,0.2)', background:'rgba(249,115,22,0.06)', color:'#f97316', fontSize:7, fontWeight:600 }}>📥 Импорт</button>
          </div>
        </GlassCard>
      )}
      {generated && dayPlan && <DailyDietDashboard />}
      {generated && allergens.length > 0 && (
        <GlassCard title="Аллергены" icon="⚠️" color="#f97316" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
            {allergenExcludedCount > 0 ? (
              <>🚫 Исключено <strong style={{ color: '#f97316' }}>{allergenExcludedCount}</strong> продуктов из {FOOD_DB.length} по вашим аллергенам: <span style={{ color: '#fb923c' }}>{allergens.map(a => ALLERGEN_LIST.find(al => al.id === a)?.label || a).join(', ')}</span></>
            ) : (
              <>⚠️ Аллергены выбраны ({allergens.map(a => ALLERGEN_LIST.find(al => al.id === a)?.label || a).join(', ')}), но ни один продукт не был исключён — проверьте список продуктов в базе</>
            )}
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>Чтобы применить изменения аллергенов, нажмите «Перегенерировать»</div>
        </GlassCard>
      )}

      {generated && planDays === 1 && dayPlan && (
        <GlassCard title={`План на день${cyclingMode !== 'none' ? (dayPlan.isTrainingDay ? ' 🏋️ Тренировочный' : ' 🛌 Отдых') : ''}`} icon="📋" color={dayPlan.isTrainingDay ? '#00e68a' : '#8b5cf6'} style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          {dayPlan.isTrainingDay !== undefined && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{dayPlan.isTrainingDay ? 'Тренировочный день' : 'День отдыха'}{cyclingMode !== 'none' && ` · циклирование: ${{macro:'макросы',butch:'БУЧ',cheatmeal:'читмил',carbload:'угл.загрузка'}[cyclingMode] || ''}`}{workScheduleEnabled && ` · 💼${dayPlan.isWorkDay ? ' Рабочий' : ' Выходной'}${dayPlan.isWorkDay && workStartTime ? ` ${workStartTime}-${workEndTime}` : ''}`}</div>}
          {renderMealList(dayPlan)}
          <textarea value={dayPlanNotes} onChange={e => { setDayPlanNotes(e.target.value); localStorage.setItem('he_day_notes', e.target.value); }} placeholder="Заметки на сегодня..." style={{ width:'100%', marginTop:6, padding:'6px 10px', borderRadius:8, fontSize:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.85)', resize:'vertical', minHeight:30, boxSizing:'border-box' }} rows={1} />
          {(() => {
            const dayTotal = dayPlan.totals;
            const devKcal = Math.round(dayTotal?.kcal - effectiveKcal);
            const devP = Math.round(dayTotal?.p - effectiveP);
            if (Math.abs(devKcal) < 50 && Math.abs(devP) < 5) return null;
            return (
              <button onClick={autoCorrectPlan} style={{ marginTop: 6, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600, width: '100%', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                📊 Автокоррекция: откл. от цели {devKcal > 0 ? '+' : ''}{devKcal} ккал / {devP > 0 ? '+' : ''}{devP}г Б — подогнать оставшиеся приёмы
              </button>
            );
          })()}
        </GlassCard>
      )}

      {generated && planDays === 3 && threeDayPlan && (
        <GlassCard title="План на 3 дня" icon="📋" color="#00e68a" style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <span style={{ color: '#00e68a', fontWeight: 700 }}>📊 Всего: {Math.round(threeDayPlan.totals.kcal)} ккал</span>
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>Среднее: {Math.round(threeDayPlan.totals.kcal / 3)} ккал/день</span>
          </div>
          {threeDayPlan.days.map((d: any, di: number) => (
            <div key={di} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#00e68a', marginBottom: 6, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.04)', display: 'inline-block' }}>
                День {di + 1}
              </div>
              {renderMealList(d)}
            </div>
          ))}
        </GlassCard>
      )}

      {generated && planDays === 7 && weekPlan && (
        <GlassCard title={monthPlanMode ? `Месячный план — Неделя ${selectedWeek + 1} / 4` : 'Недельный план'} icon="📋" color="#00e68a" style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          {monthPlanMode && monthPlan.length > 0 && (
            <div style={{ display:'flex', gap:4, marginBottom:8, justifyContent:'center' }}>
              {monthPlan.map((_, wi) => (
                <button key={wi} onClick={() => {
                  setSelectedWeek(wi);
                  if (monthPlan[wi]) setWeekPlan(monthPlan[wi]);
                }} style={{
                  padding:'5px 12px', borderRadius:8, fontSize:9, fontWeight:700, cursor:'pointer',
                  background: selectedWeek === wi ? 'linear-gradient(135deg,#a78bfa,#7c3aed)' : '#202023',
                  color: selectedWeek === wi ? '#fff' : 'rgba(255,255,255,0.85)',
                  border: selectedWeek === wi ? 'none' : '1px solid rgba(255,255,255,0.06)',
                }}>Н{wi + 1}</button>
              ))}
              <button onClick={() => { setMonthPlanMode(false); setMonthPlan([]); }} style={{
                padding:'5px 8px', borderRadius:8, fontSize:8, cursor:'pointer',
                background:'transparent', color:'rgba(255,255,255,0.5)', border:'1px solid rgba(255,255,255,0.06)',
              }}>✕</button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <span style={{ color: '#00e68a', fontWeight: 700 }}>📊 За неделю: {Math.round(weekPlan.totals.kcal)} ккал</span>
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>Среднее: {Math.round(weekPlan.totals.kcal / 7)} ккал/день</span>
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 6, display: 'flex', gap: 6, justifyContent: 'center' }}>
            <span style={{ color: '#3b82f6' }}>● Б: {Math.round(weekPlan.totals.p)}г</span>
            <span style={{ color: '#f59e0b' }}>● Ж: {Math.round(weekPlan.totals.f)}г</span>
            <span style={{ color: '#f97316' }}>● У: {Math.round(weekPlan.totals.c)}г</span>
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {weekPlan.days.map((d: any, di: number) => {
              const wKcal = Math.round(d.totals.kcal);
              const wP = Math.round(d.totals.p);
              const wF = Math.round(d.totals.f);
              const wC = Math.round(d.totals.c);
              const wIsTraining = d.isTrainingDay;
              return (
                <div key={di} style={{
                  padding: 10, borderRadius: 12,
                  background: wIsTraining ? 'rgba(0,230,138,0.03)' : '#202023',
                  border: wIsTraining ? '1px solid rgba(0,230,138,0.15)' : '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{wIsTraining ? '🏋️' : '😴'}</span>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: wIsTraining ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>
                          {DAY_LABELS[di]} · День {di + 1}
                        </span>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', display: 'flex', gap: 4 }}>
                          <span style={{ color: '#3b82f6' }}>Б {wP}</span>
                          <span style={{ color: '#f59e0b' }}>Ж {wF}</span>
                          <span style={{ color: '#f97316' }}>У {wC}</span>
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{wKcal} ккал</span>
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>
                    {d.meals.map((m: any, mi: number) => (
                      <div key={mi} style={{ padding: '2px 0', display: 'flex', gap: 4 }}>
                        <span style={{ color: '#00e68a', fontWeight: 600, minWidth: 50 }}>{m.time}</span>
                        <span style={{ color: '#00e68a', minWidth: 55 }}>{m.label}</span>
                        <span style={{ flex: 1 }}>{m.items?.map((it: any) => it.name)?.join(', ') || ''}</span>
                        <span style={{ color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}>{Math.round(m.totals?.kcal || 0)} ккал</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {generated && planDays === 7 && weekPlan && planView === 'calendar' && (
        <GlassCard title="📅 Календарь питания на неделю" icon="📅" color="#a78bfa">
          {(() => {
            const allMealLabels = Array.from(new Set(weekPlan.days.flatMap((d: any) => d.meals.map((m: any) => m.label))));
            return <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 7 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '4px 6px', textAlign: 'center', background: '#202023', borderRadius: 6, fontSize: 7, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Приём</th>
                    {weekPlan.days.map((d: any, di: number) => (
                      <th key={di} style={{ padding: '4px 6px', textAlign: 'center', background: d.isTrainingDay ? 'rgba(0,230,138,0.12)' : '#202023', borderRadius: 6, fontSize: 7, color: d.isTrainingDay ? '#00e68a' : 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
                        {DAY_LABELS[di]}
                        <div style={{ fontWeight: 400, color: 'rgba(255,255,255,0.85)' }}>{Math.round(d.totals.kcal)} ккал</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allMealLabels.map((label: any) => (
                    <tr key={label}>
                      <td style={{ padding: '4px 6px', background: '#202023', borderRadius: 6, fontSize: 7, color: 'rgba(255,255,255,0.85)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</td>
                      {weekPlan.days.map((d: any, di: number) => {
                        const meal = d.meals.find((m: any) => m.label === label);
                        if (!meal) return <td key={di} style={{ padding: '4px', textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 6 }}>—</td>;
                        const kcal = Math.round(meal.totals?.kcal || 0);
                        return (
                          <td key={di} style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 6, verticalAlign: 'top' }}>
                            <div style={{ color: '#00e68a', fontWeight: 700, fontSize: 7, marginBottom: 2 }}>{kcal} ккал</div>
                            {(meal.items || []).slice(0, 2).map((it: any, ii: number) => (
                              <div key={ii} style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, fontSize: 6 }}>{it.name} {it.amount}г</div>
                            ))}
                            {meal.items.length > 2 && <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 5 }}>+{meal.items.length - 2} ещё</div>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>;
          })()}
        </GlassCard>
      )}

      {generated && planDays === 1 && dayPlan && (
        <GlassCard title="⏳ Таймлайн дня" icon="⏳" color="#06b6d4">
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: 'rgba(6,182,212,0.2)', borderRadius: 1 }} />
            {dayPlan.meals.map((m: any, mi: number) => {
              const k = Math.round(m.totals?.kcal || 0);
              const w = Math.max(10, Math.round(k / Math.max(1, dayPlan.totals?.kcal) * 100));
              return (
                <div key={mi} style={{ position: 'relative', marginBottom: 8, paddingLeft: 16 }}>
                  <div style={{ position: 'absolute', left: -16, top: 4, width: 10, height: 10, borderRadius: '50%', background: '#06b6d4', border: '2px solid #18181b' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 8, fontWeight: 600, color: '#06b6d4', minWidth: 40 }}>{m.time}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{m.label}</span>
                    <span style={{ fontSize: 8, color: '#00e68a', fontWeight: 700 }}>{k} ккал</span>
                    <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Б {Math.round(m.totals?.p || 0)} Ж {Math.round(m.totals?.f || 0)} У {Math.round(m.totals?.c || 0)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#202023', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${w}%`, background: 'linear-gradient(90deg, #06b6d4, #00e68a)', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(m.items || []).map((it: any, ii: number) => (
                      <span key={ii} style={{ background: '#202023', padding: '1px 5px', borderRadius: 4 }}>{it.name} {it.amount}г</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {recipePickerMeal && generated && dayPlan && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center', background:'rgba(0,0,0,0.7)' }}
          onClick={() => setRecipePickerMeal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:400, padding:'14px 20px 28px', borderRadius:'20px 20px 0 0', background:'#18181b', boxShadow:'0 -4px 30px rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.06)', borderBottom:'none' }}>
            <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'0 auto 16px' }} />
            <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:4, letterSpacing:'-0.3px' }}>🍳 Заменить «{recipePickerMeal.label}» рецептом</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:12 }}>Подходящие рецепты</div>
            <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
              {getRecipesByMeal(recipePickerMeal.label === 'Завтрак' ? 'breakfast' : recipePickerMeal.label === 'Обед' || recipePickerMeal.label === 'Второй завтрак' ? 'lunch' : recipePickerMeal.label === 'Ужин' ? 'dinner' : 'snack').length === 0 ? (
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', textAlign:'center', padding:10 }}>Нет рецептов для этого приёма.</div>
              ) : getRecipesByMeal(recipePickerMeal.label === 'Завтрак' ? 'breakfast' : recipePickerMeal.label === 'Обед' || recipePickerMeal.label === 'Второй завтрак' ? 'lunch' : recipePickerMeal.label === 'Ужин' ? 'dinner' : 'snack').map((r, i) => (
                <button key={i} onClick={() => replaceMealWithRecipe(r, recipePickerMeal.mealIdx)} style={{ width:'100%', padding:'10px 12px', borderRadius:12, cursor:'pointer', textAlign:'left', background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:9, transition:'all 0.15s' }}
                  onMouseEnter={e => (e.target as HTMLElement).style.borderColor = 'rgba(139,92,246,0.3)'}
                  onMouseLeave={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'}>
                  <div style={{ fontWeight:700, color:'#a78bfa', fontSize:10, marginBottom:2 }}>{r.name}</div>
                  <div style={{ color:'rgba(255,255,255,0.85)', marginBottom:4 }}>⏱{r.prepTimeMin}мин · {r.kcal}ккал · Б{r.protein}/Ж{r.fat}/У{r.carbs}</div>
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)', display:'flex', gap:2, flexWrap:'wrap' }}>{(r.tags || []).map(t => <span key={t} style={{ padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.08)', color:'rgba(167,139,250,0.5)' }}>{t}</span>)}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setRecipePickerMeal(null)} style={{ width:'100%', marginTop:8, padding:'6px', borderRadius:8, cursor:'pointer', border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'rgba(255,255,255,0.85)', fontSize:8, fontWeight:600 }}>✕ Отмена</button>
          </div>
        </div>
      )}

      {generated && undoStack.length > 0 && (
        <button onClick={() => { setDayPlan(undoStack[0]); setUndoStack(undoStack.slice(1)); }} style={{ width:'100%', padding:'8px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(96,165,250,0.2)', background:'rgba(96,165,250,0.06)', color:'#60a5fa', fontSize:10, fontWeight:600 }}>
          ↩ Отменить ({undoStack.length})
        </button>
      )}

      {generated && (
        <button onClick={saveCurrentPlan} style={{
          ...greenBtn, background: 'linear-gradient(135deg,#8b5cf6,#a78bfa)',
          fontSize: 13, padding: 12,
          boxShadow: '0 4px 16px rgba(139,92,246,0.2)',
        }}>
          💾 Сохранить в мои планы
        </button>
      )}

      {generated && (
        <GlassCard title="🏆 Достижения и сезон" icon="🏆" color="#f472b6">
          {(() => {
            const ach: { label: string; earned: boolean; icon: string }[] = [];
            try {
              const diaryRaw = localStorage.getItem('nutrition_diary');
              const diary = diaryRaw ? JSON.parse(diaryRaw) : {};
              const daysLogged = Object.keys(diary).length;
              if (daysLogged >= 1) ach.push({ label: 'Первый день в дневнике', earned: true, icon: '📝' });
              if (daysLogged >= 7) ach.push({ label: 'Неделя дневника', earned: true, icon: '📆' });
              if (daysLogged >= 30) ach.push({ label: 'Месяц дневника', earned: true, icon: '📅' });
              const plansRaw = localStorage.getItem('he_saved_nutrition_plans');
              const plans = plansRaw ? JSON.parse(plansRaw) : [];
              if (plans.length >= 1) ach.push({ label: 'Первый сохранённый план', earned: true, icon: '💾' });
              if (plans.length >= 5) ach.push({ label: '5 планов', earned: true, icon: '📚' });
              if (localStorage.getItem('he_off_cache')) ach.push({ label: 'Сканировал штрих-код', earned: true, icon: '📷' });
            } catch {}
            const month = new Date().getMonth();
            const seasonal = [
              { months: [5,6,7,8], label: '🥒 Огурцы, помидоры, ягоды, зелень' },
              { months: [9,10], label: '🍂 Тыква, кабачки, яблоки, виноград' },
              { months: [11,12,1,2], label: '🥬 Цитрусовые, хурма, гранаты, свёкла' },
              { months: [3,4], label: '🌱 Спаржа, редис, шпинат, первая зелень' },
            ].find(s => s.months.includes(month));
            return <>
              {ach.length > 0 && <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                {ach.map(a => <span key={a.label} style={{ padding:'3px 8px', borderRadius:6, fontSize:8, background:'rgba(244,114,182,0.08)', border:'1px solid rgba(244,114,182,0.15)', color:'#f472b6' }}>{a.icon} {a.label}</span>)}
              </div>}
              {seasonal && <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', padding:'4px 8px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.1)' }}>🌿 Сезонные продукты: {seasonal.label}</div>}
              {ach.length === 0 && <div style={{ fontSize:8, color:'rgba(255,255,255,0.8)' }}>Начните вести дневник питания, чтобы получать достижения.</div>}
            </>;
          })()}
        </GlassCard>
      )}

      <button onClick={() => setShowRecipeCreator(true)} style={{ width:'100%', padding:'8px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(249,115,22,0.2)', background:'rgba(249,115,22,0.06)', color:'#f97316', fontSize:9, fontWeight:600, marginTop:4 }}>
        🍳 Создать свой рецепт
      </button>
      {showRecipeCreator && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)' }}
          onClick={() => setShowRecipeCreator(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'88%', maxWidth:380, maxHeight:'85vh', overflowY:'auto', padding:0, borderRadius:20, background:'#1c1c1e', boxShadow:'0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' }}>
            <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:17, fontWeight:700, color:'#fff', letterSpacing:-0.3 }}>🍳 Создать рецепт</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Заполните информацию о блюде</div>
            </div>
            <div style={{ padding:'12px 20px 20px', display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginBottom:3 }}>Название</div>
              <input value={newRecipe.name} onChange={e => setNewRecipe({...newRecipe, name: e.target.value})} placeholder="Название рецепта" style={{ width:'100%', padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:15, boxSizing:'border-box', outline:'none', fontWeight:500 }} />
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginBottom:3 }}>Приём и время</div>
              <div style={{ display:'flex', gap:6 }}>
                <select value={newRecipe.meal} onChange={e => setNewRecipe({...newRecipe, meal: e.target.value})} style={{ flex:1, padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:15, boxSizing:'border-box', outline:'none', appearance:'none', fontWeight:500 }}>
                  <option value="breakfast">Завтрак</option><option value="lunch">Обед</option>
                  <option value="dinner">Ужин</option><option value="snack">Перекус</option>
                </select>
                <input type="number" value={newRecipe.prepTime} onChange={e => setNewRecipe({...newRecipe, prepTime: +e.target.value || 10})} placeholder="Мин" style={{ width:80, padding:'12px 10px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:15, boxSizing:'border-box', outline:'none', textAlign:'center', fontWeight:500 }} />
              </div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginBottom:3 }}>КБЖУ (на порцию)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:5 }}>
                {[{k:'kcal',l:'Ккал',c:'#22c55e'},{k:'protein',l:'Белки',c:'#3b82f6'},{k:'fat',l:'Жиры',c:'#f59e0b'},{k:'carbs',l:'Угл',c:'#f97316'}].map(f => <div key={f.k}><input type="number" value={(newRecipe as Record<string,number|string>)[f.k] as number} onChange={e => setNewRecipe({...newRecipe, [f.k]: +e.target.value || 0})} placeholder={f.l} style={{ width:'100%', padding:'14px 6px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:f.c, fontSize:15, boxSizing:'border-box', outline:'none', textAlign:'center', fontWeight:700 }} /></div>)}
              </div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginBottom:3 }}>Ингредиенты</div>
              <textarea value={newRecipe.ingredients} onChange={e => setNewRecipe({...newRecipe, ingredients: e.target.value})} placeholder="Ингредиенты (каждый с новой строки)" style={{ width:'100%', padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', boxSizing:'border-box', outline:'none', minHeight:64, resize:'vertical', fontSize:13, lineHeight:1.4 }} rows={3} />
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginBottom:3 }}>Приготовление</div>
              <textarea value={newRecipe.instructions} onChange={e => setNewRecipe({...newRecipe, instructions: e.target.value})} placeholder="Инструкция (каждый шаг с новой строки)" style={{ width:'100%', padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', boxSizing:'border-box', outline:'none', minHeight:64, resize:'vertical', fontSize:13, lineHeight:1.4 }} rows={3} />
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginBottom:3 }}>Теги</div>
              <input value={newRecipe.tags} onChange={e => setNewRecipe({...newRecipe, tags: e.target.value})} placeholder="Теги (через запятую)" style={{ width:'100%', padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', boxSizing:'border-box', outline:'none', fontSize:13 }} />
              <button onClick={() => {
                const recipe = { ...newRecipe, ingredients: newRecipe.ingredients.split('\n').filter(Boolean), instructions: newRecipe.instructions.split('\n').filter(Boolean), tags: newRecipe.tags.split(',').map((t: string) => t.trim()).filter(Boolean), userCreated: true };
                const updated = [...userRecipes, recipe];
                setUserRecipes(updated);
                try { localStorage.setItem('he_user_recipes', JSON.stringify(updated)); } catch {}
                setShowRecipeCreator(false);
                setNewRecipe({ name: '', meal: 'lunch', prepTime: 10, kcal: 400, protein: 30, fat: 10, carbs: 40, ingredients: '', instructions: '', tags: '' });
              }} style={{ width:'100%', padding:'13px', borderRadius:14, cursor:'pointer', border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontSize:15, fontWeight:700, letterSpacing:0.2 }}>✓ Сохранить рецепт</button>
            </div>
          </div>
        </div>
      )}

      {generated && shoppingList && (
        <GlassCard title="Список покупок" icon="🛒" color="#f97316" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          {(() => {
            const groups: Record<string, any[]> = {};
            shoppingList.forEach((item: any) => {
              const cat = item.catLabel || item.category || '📦 Прочее';
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push(item);
            });
            const totalItems = shoppingList.length;
            const totalGrams = shoppingList.reduce((s: number, i: any) => s + (i.amount || 0), 0);
            const pricePerKg: Record<string, number> = { low: 4, medium: 7, max: 12, enhanced: 18 };
            const estCost = Math.round(totalGrams / 1000 * (pricePerKg[budget] || 7));
            const exportText = shoppingList.map((i: any) => `${i.name} — ${i.amount >= 1000 ? `${(i.amount/1000).toFixed(1)} кг` : `${Math.round(i.amount)} г`}`).join('\n');
            return (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button onClick={() => { shoppingList.forEach((i: any) => addToCart({ name: i.name, kcal: i.kcal || 0, amount: i.amount, category: i.catLabel || i.category })); }} style={{ flex:1, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.06)', color: '#f97316', cursor: 'pointer', fontSize: 8, fontWeight: 600 }}>
                    🛒 В корзину ({totalItems})
                  </button>
                  <div style={{ padding: '5px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a', fontSize: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    💰 ~{estCost}€
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(exportText); }} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.06)', color: '#60a5fa', cursor: 'pointer', fontSize: 8, fontWeight: 600 }}>
                    📋
                  </button>
                </div>
                {Object.entries(groups).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#f97316', marginBottom: 2, padding: '2px 0 2px 4px', borderLeft: '2px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {cat}
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)', marginLeft: 'auto' }}>{items.length} шт</span>
                    </div>
                    {items.map((data: any, i: number) => (
                      <div key={data.name + i} style={{ fontSize: 9, padding: '3px 0 3px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.85)' }}>
                        <span>{data.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {data.amount >= 1000 ? `${(data.amount / 1000).toFixed(1)} кг` : `${Math.round(data.amount)} г`}
                          </span>
                          <button onClick={() => addToCart({ name: data.name, kcal: data.kcal || 0, amount: data.amount, category: data.catLabel || data.category })} style={{ padding: '2px 4px', borderRadius: 4, border: 'none', background: 'rgba(249,115,22,0.12)', color: '#f97316', cursor: 'pointer', fontSize: 7 }}>🛒</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            );
          })()}
          <button onClick={saveCurrentPlan} style={{ marginTop: 6, padding: '8px', borderRadius: 8, border: '1px solid rgba(249,115,22,0.25)', background: 'rgba(249,115,22,0.06)', color: '#f97316', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>💾 Сохранить план</button>
        </GlassCard>
      )}

      {generated && injections.length > 0 && (
        <GlassCard title="Тайминг препаратов и приёмов пищи" icon="💊" color="#8b5cf6" style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
          {injections.map((inj: DrugInjection) => {
            const isInsulin = inj.type === 'инсулин';
            const isIGF = inj.type === 'ИФР-1';
            const isGH = inj.type === 'ГР';
            const isPeptide = inj.type === 'пептид';
            const isAAS = inj.type === 'ААС';
            return (
              <div key={inj.id} style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
                <div style={{ fontWeight: 700, fontSize: 10, color: '#a78bfa', marginBottom: 3 }}>
                  💉 {inj.name} ({inj.dose}{inj.unit}) — {inj.time}
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginLeft: 4 }}>
                    T½ {inj.halfLifeHours}ч
                    {inj.trainLinked && <span style={{ color: '#00e68a', marginLeft: 4 }}>🏋️ {inj.trainTiming === 'before' ? 'До тренировки' : inj.trainTiming === 'after' ? 'После тренировки' : 'До+После'}</span>}
                  </span>
                </div>
                {isInsulin && inj.esterType === 'rapid' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    ⚡ <strong>Быстрый инсулин (аналог)</strong> — пик 30-90 мин, длительность 3-4ч.<br />
                    🍚 На <strong>{Math.round(inj.dose * 10)}г углеводов</strong> (10г/ед). Принять сразу перед едой или после. <strong>ПРОПУСК ЕДЫ = ГИПОГЛИКЕМИЯ!</strong><br />
                    {inj.trainLinked ? `🏋️ Привязан к тренировке (${inj.trainTiming === 'before' ? 'до' : inj.trainTiming === 'after' ? 'после' : 'до и после'}). В приёме: изолят сывороточного белка + ${inj.trainTiming === 'before' ? 'амилопектин' : 'декстроза'}.` : ''}
                    {inj.trainLinked && inj.trainTiming !== 'after' ? ' 🚨 На тренировке ОБЯЗАТЕЛЬНО углеводы (изотоник/гейнер/бананы) каждые 20 мин!' : ''}
                    {!inj.trainLinked ? ' ⏰ Не ешь без углеводов — риск гипогликемии!' : ''}<br />
                    🥑 <strong>Жиры МИНИМУМ</strong> в окне действия (первые 90 мин) — не более 3-5г. Жиры замедляют опорожнение желудка и блокируют поступление глюкозы.<br />
                    🩸 <strong>Глюкоза:</strong> замеры через 15, 30, 60, 90, 120 мин. Цель не ниже 4.0 ммоль/л.<br />
                    🍬 <strong>Экстренно:</strong> 200мл сока + 4 таблетки глюкозы при уровне &lt;3.5 ммоль/л. 
                  </div>
                )}
                {isInsulin && inj.esterType === 'short' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    🕐 <strong>Короткий инсулин (человеческий)</strong> — пик 2-4ч, длительность 5-8ч.<br />
                    🍚 На <strong>{Math.round(inj.dose * 10)}г углеводов</strong> (10г/ед). Ввести за 20-30 мин до еды. <strong>ПРОПУСК ЕДЫ ОПАСЕН!</strong><br />
                    {inj.trainLinked ? `🏋️ Привязан к тренировке (${inj.trainTiming === 'before' ? 'до' : inj.trainTiming === 'after' ? 'после' : 'до+после'}). В приёме: изолят + ${inj.trainTiming === 'before' ? 'амилопектин' : 'декстроза'}.` : ''}
                    {inj.trainLinked && inj.trainTiming !== 'after' ? ' 🚨 На тренировке ОБЯЗАТЕЛЬНО углеводы каждые 20 мин!' : ''}<br />
                    🥑 <strong>Жиры &lt;5г</strong> в окне 90 мин — иначе гипогликемия на фоне уже принятых углеводов.<br />
                    🩸 <strong>Правило 4 часов:</strong> каждый час после укола — минимум 10-15г углеводов на подержание.
                  </div>
                )}
                {isInsulin && inj.esterType === 'long' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    🌙 <strong>Длинный инсулин (базальный)</strong> — покрывает суточную потребность.<br />
                    🍚 Привязка к еде <strong>не требуется</strong>. Принимай в одно и то же время ежедневно.<br />
                    📊 Короткий инсулин считай отдельно от длинного (суточная норма + еда).<br />
                    📋 Контроль глюкозы натощак каждое утро — цель 4.0-6.0 ммоль/л.
                  </div>
                )}
                {isIGF && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    🧬 <strong>ИФР-1/MGF</strong> — анаболический пептид, работает синергично с инсулином.<br />
                    {inj.trainLinked ? `🏋️ Привязан к тренировке (${inj.trainTiming === 'before' ? 'до' : inj.trainTiming === 'after' ? 'после' : 'до и после'}). Принимать НАТОЩАК за 30-45 мин до еды. Еда после — изолят + декстроза (МGF — натощак, локально в месте нагрузки).` : '⏰ Принимать натощак, за 30-45 мин до еды или согласно протоколу.'}<br />
                    🥑 <strong>Жиры МИНИМУМ</strong> — в комбинации с инсулином жиры критически замедляют анаболический ответ.<br />
                    🩸 <strong>Гипогликемия:</strong> ИФР-1 + инсулин — риск гипо вдвойне. Глюкометр обязателен!<br />
                    🔬 <strong>MGF:</strong> активирует сателлитные клетки локально (только нагружаемая мышца). В комбинации с ИФР-1 — каскад гиперплазии. Питание: глюкоза + аминокислоты (BCAA/изолят) в окне 30 мин после.
                  </div>
                )}
                {isGH && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    🧬 <strong>ГР/Пептиды</strong> — влияние на инсулин и глюкозу.<br />
                    ⏰ Натощак, за 30-60 мин до еды. Не есть углеводы 30 мин после.<br />
                    📊 Контролируй глюкозу — ГР снижает чувствительность к инсулину.
                  </div>
                )}
                {isAAS && inj.esterType === 'short' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    💉 <strong>Короткий эфир</strong> — частая инъекция (EOD/ежедневно).<br />
                    ⏰ Привязка к еде минимальна. Следи за уровнем воды: +0.5л к норме.
                  </div>
                )}
                {isAAS && inj.esterType === 'long' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    💉 <strong>Длинный эфир</strong> — редкая инъекция (1-2р/нед).<br />
                    ⏰ Пей 40мл/кг воды. Контролируй АД и липиды.
                  </div>
                )}
                {(inj.type === 'семаглутид' || inj.type === 'тирзепатид') && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    💊 <strong>GLP-1 агонист</strong> — замедляет опорожнение желудка, подавляет аппетит.<br />
                    📏 <strong>Питание дробное:</strong> 5-6 раз/день по 100-200г. Не переедать — тошнота, рвота.<br />
                    🥑 <strong>Жиры &lt;5г/приём</strong> — жирная пища задерживается в желудке на 4-6ч, вызывая тошноту и риск панкреатита.<br />
                    💧 <strong>Вода 30-40мл/кг</strong> — GLP-1 снижает моторику ЖКТ, риск запора. Клетчатка 25-30г/день.<br />
                    ⏰ <strong>Дни пик тошноты:</strong> первые 24-72ч после еженедельной инъекции — самые лёгкие приёмы, жиры &lt;20г/день.<br />
                    🩸 <strong>B12 и электролиты:</strong> добавки обязательны — GLP-1 снижает всасывание через IF-фактор.<br />
                    🚫 <strong>Алкоголь</strong> — исключить полностью (панкреатит, гипогликемия).<br />
                    🆘 <strong>Боли в животе/подреберье:</strong> немедленно к врачу — исключить панкреатит.
                  </div>
                )}
                {inj.type === 'другое' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    ℹ️ Следуй инструкции по препарату. При необходимости уточни тип.
                  </div>
                )}
              </div>
            );
          })}
          {injections.some((i: DrugInjection) => i.type === 'инсулин' && i.esterType !== 'long') && (
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>🚨 Чеклист гипогликемии (ОПАСНОСТЬ)</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                🩸 <strong>Глюкометр обязателен!</strong> Замеры: до, через 15, 30, 60, 90, 120 мин<br />
                🧃 <strong>Экстренный набор:</strong> 200мл сока + 3-4 таблетки глюкозы (15-20г) ВСЕГДА С СОБОЙ<br />
                🛌 <strong>Не принимать короткий инсулин после 18:00</strong> — риск ночной гипогликемии<br />
                ⏰ <strong>Каждый час после инъекции</strong> — минимум 10-15г углеводов (4-часовое окно действия)<br />
                🏋️ <strong>На тренировке:</strong> изотоник 6-8% (500-1000мл) + банан каждые 20 мин<br />
                🔴 <strong>Если глюкоза &lt;3.5 ммоль/л:</strong> немедленно 15-20г быстрых углеводов, замер через 15 мин<br />
                🚑 <strong>Если &lt;2.5 ммоль/л или потеря сознания:</strong> ВЫЗОВ 103! Глюкагон 1мг в/м или в/в глюкоза 40%<br />
                📋 <strong>Симптомы:</strong> потливость, дрожь, голод → спутанность, агрессия → потеря сознания, судороги<br />
                🥑 <strong>Жиры МИНИМУМ:</strong> в окне действия инсулина — не более 5г жиров за приём (жиры замедляют всасывание углеводов!)
              </div>
            </div>
          )}
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: 1.5 }}>
            💡 <strong>БАЗОВЫЕ ПРАВИЛА ИНСУЛИНА:</strong><br />
            🧮 1 ЕД короткого/быстрого ≈ 10г углеводов (чувствительность индивидуальна — после курса ГР/ААС может требоваться на 20-30% больше).<br />
            🥑 <strong>ЖИРЫ МИНИМАЛЬНЫ</strong> в окне действия инсулина (первые 2ч) — не более 5г. Жиры блокируют выход глюкозы из желудка в кровь, вызывая гипогликемию при уже принятых углеводах!<br />
            🚫 <strong>НЕ ПРОПУСКАЙ ПРИЁМЫ ПИЩИ</strong> — гипогликемия развивается за 15-30 минут!<br />
            🩸 <strong>Глюкометр — твой лучший друг.</strong> Цель: 4.0-6.0 ммоль/л через 2ч после инъекции. Не выше 7.8, не ниже 3.9.<br />
            🧬 MGF активирует сателлитные клетки локально (место инъекции/тренировки). ИФР-1 — системно. Оба требуют глюкозу и аминокислоты. Без еды в окне — нулевой эффект. 
          </div>
          {injections.some((i: DrugInjection) => i.type === 'семаглутид' || i.type === 'тирзепатид') && (
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>💊 GLP-1 — справочник питания</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                📏 <strong>Дробное питание:</strong> 5-6 раз/день по 100-200г за приём. Не переполнять желудок — риск рвоты.<br />
                🥑 <strong>Жиры &lt;5г/приём:</strong> GLP-1 замедляет опорожнение желудка — жиры задерживаются и вызывают тошноту, изжогу, риск панкреатита.<br />
                💧 <strong>Вода 30-40 мл/кг:</strong> GLP-1 снижает моторику ЖКТ — риск запоров. Клетчатка 25-30г/день дополнительно.<br />
                ⏰ <strong>График инъекций:</strong> пик тошноты — первые 24-72ч после инъекции. Планируй самые лёгкие приёмы на эти дни. Жиры в эти дни &lt;20г/день.<br />
                🩸 <strong>Контроль B12 и электролитов:</strong> GLP-1 снижает всасывание B12 (через IF-фактор) и калия/магния — добавки обязательны.<br />
                🆘 <strong>Боли в левом подреберье/животе:</strong> прекратить приём, срочно к врачу — исключить острый панкреатит.<br />
                🚫 <strong>Алкоголь:</strong> исключить полностью — усиливает тошноту, риск гипогликемии, панкреатит.<br />
                🍬 <strong>Гипогликемия:</strong> в комбинации с инсулином — риск возрастает вдвое. Глюкометр обязателен!
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {injections.some((i: DrugInjection) => i.type === 'инсулин') && (
        <GlassCard title="📖 Справочник: Инсулин" icon="📖" color="#ef4444" style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🧮 Правило 10г/1ЕД:</strong> 1 единица короткого/быстрого инсулина покрывает ~10г углеводов. Доза × 10 = необходимые углеводы.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🥑 Жиры МИНИМУМ:</strong> в окне 90 минут после инъекции — не более 5г жиров. Жиры замедляют опорожнение желудка, вызывая гипогликемию при уже принятых углеводах.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🚫 ПРОПУСК ЕДЫ КРИТИЧЕН:</strong> гипогликемия развивается за 15-30 минут. Каждый час после укола — минимум 10-15г углеводов.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🩸 Глюкометр:</strong> замеры через 15, 30, 60, 90, 120 мин. Цель — не ниже 4.0 ммоль/л. При &lt;3.5 — 15-20г быстрых углеводов.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🏋️ Тренировка + инсулин:</strong> предтрен — изолят (40-50г) + амилопектин (80-100г). Пост-трен — изолят + декстроза (10г/1ЕД). На тренировке изотоник каждые 20 мин.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>🛑 Не на ночь:</strong> короткий инсулин после 18:00 — риск ночной гипогликемии. Длинный (Лантус/Левемир) — базальный, можно.
            </div>
          </div>
        </GlassCard>
      )}

      {generated && waterCalc && (
        <GlassCard title="Водный баланс" icon="💧" color="#06b6d4" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
              <span>База: {waterCalc.hasPharma ? (waterCalc.pharmaBaseMl || 40) : '30'} мл × {weight} кг</span>
              <span>{waterCalc.baseWater} л</span>
            </div>
            {waterCalc.hasPharma && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
                <span>+ Фармакология (повышенный метаболизм)</span>
                <span>+{waterCalc.pharmaBonus.toFixed(1)} л</span>
              </div>
            )}
            {waterCalc.trainBonus > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
                <span>+ Тренировка</span>
                <span>+{waterCalc.trainBonus} л</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>
              <span>+ Клетчатка</span>
              <span>+{waterCalc.fiberFactor} л</span>
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#06b6d4', textAlign: 'center', marginTop: 6 }}>
            {waterCalc.total} л/день
          </div>
        </GlassCard>
      )}

      {generated && (
        <GlassCard title="Отчёты по рациону" icon="📊" color="#3b82f6" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
            <button onClick={generateAllergenReport} style={reportPillStyle('#ef4444', activeReports.includes('allergen') && !!allergenReport)}>⚠️ Аллергены</button>
            <button onClick={generateNutrientReport} style={reportPillStyle('#22c55e', activeReports.includes('nutrient') && !!nutrientReport)}>🧬 Нутриенты</button>
            <button onClick={generateQualityReport} style={reportPillStyle('#f59e0b', activeReports.includes('quality') && !!qualityReport)}>⭐ Качество</button>
            <button onClick={generateRiskReport} style={reportPillStyle('#ef4444', activeReports.includes('risk') && !!riskReport)}>🩺 Риски здоровья</button>
            {injections.length > 0 && <button onClick={generateDrugCompatReport} style={reportPillStyle('#8b5cf6', activeReports.includes('drug') && !!drugCompatReport)}>💉 Совместимость</button>}
            <button onClick={generateFullNutritionReport} style={reportPillStyle('#3b82f6', activeReports.includes('nutrition') && !!nutritionReport)}>📋 Полный отчёт</button>
            <button onClick={() => {
              generateAllergenReport();
              generateNutrientReport();
              generateQualityReport();
              generateRiskReport();
              if (injections.length > 0) generateDrugCompatReport();
              generateRecommendations();
            }} style={reportPillStyle('#3b82f6', activeReports.length >= 3)}>📋 Общий отчёт</button>
          </div>
          {allergenReport && activeReports.includes('allergen') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: allergenReport.riskLevel === 'high' ? 'rgba(239,68,68,0.06)' : allergenReport.riskLevel === 'medium' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)', border: `1px solid ${allergenReport.riskLevel === 'high' ? '#ef4444' : allergenReport.riskLevel === 'medium' ? '#f59e0b' : '#22c55e'}20` }}>
              <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3, color: allergenReport.riskLevel === 'high' ? '#ef4444' : allergenReport.riskLevel === 'medium' ? '#f59e0b' : '#22c55e' }}>
                {allergenReport.summary}
              </div>
              {allergenReport.conflicts.map((c: any, i: number) => (
                <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', padding: '1px 0' }}>
                  • {c.food}: {c.allergens.join(', ')}
                </div>
              ))}
            </div>
          )}
          {nutrientReport && activeReports.includes('nutrient') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>🧬 Микронутриенты</div>
              {Object.entries(nutrientReport.micros).slice(0, 10).map(([k, v]: [string, any]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, padding: '1px 0', color: 'rgba(255,255,255,0.85)' }}>
                  <span>{k}</span>
                  <span style={{ color: v.status === 'ok' ? '#22c55e' : v.status === 'low' ? '#f59e0b' : '#ef4444' }}>
                    {v.actual} / {v.target} ({v.pct}%)
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                {nutrientReport.gaps.join('; ')}
              </div>
            </div>
          )}
          {qualityReport && activeReports.includes('quality') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: qualityReport.avgScore >= 8 ? '#22c55e' : '#f59e0b', marginBottom: 3 }}>
                ⭐ Среднее качество: {qualityReport.avgScore}/10
              </div>
              {qualityReport.bestItems.length > 0 && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>Лучшие: {qualityReport.bestItems.join(', ')}</div>}
              {qualityReport.weakItems.length > 0 && <div style={{ fontSize: 8, color: '#ef4444' }}>Слабые: {qualityReport.weakItems.join(', ')}</div>}
              {qualityReport.recommendations.map((r: string, i: number) => <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', padding: '1px 0' }}>• {r}</div>)}
            </div>
          )}
          {riskReport && activeReports.includes('risk') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3, color: riskReport.totalRisk === 'Низкий' ? '#22c55e' : riskReport.totalRisk === 'Средний' ? '#f59e0b' : '#ef4444' }}>
                🩺 Общий риск: {riskReport.totalRisk}
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{riskReport.summary}</div>
              {Object.entries(riskReport.systems).map(([sys, data]: [string, any]) => (
                <div key={sys} style={{ fontSize: 8, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: data.score >= 5 ? '#ef4444' : data.score >= 3 ? '#f59e0b' : '#22c55e' }}>
                      {sys === 'hepatic' ? 'Печень' : sys === 'renal' ? 'Почки' : sys === 'inflammatory' ? 'Воспаление' : sys === 'insulin' ? 'Инсулин' : 'Электролиты'}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.85)' }}>⚠ {data.score}/7</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.85)' }}>{data.impact}</div>
                  {data.score >= 3 && <div style={{ color: '#f59e0b' }}>→ {data.recommendation}</div>}
                </div>
              ))}
            </div>
          )}
          {dayPlan && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', marginBottom: 3 }}>🍬 Гликемическая нагрузка</div>
              {(() => {
                const totalCarbs = dayPlan.totals?.c || 0;
                const avgGI = planType === 'keto' ? 30 : planType === 'highcarb' ? 65 : 55;
                const gl = Math.round(totalCarbs * avgGI / 100);
                const glPerMeal = dayPlan.meals?.length > 0 ? Math.round(gl / dayPlan.meals.length) : 0;
                const glLabel = gl <= 80 ? 'Низкая' : gl <= 120 ? 'Средняя' : 'Высокая';
                const glColor = gl <= 80 ? '#22c55e' : gl <= 120 ? '#f59e0b' : '#ef4444';
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>Общий ГН (расчётный):</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: glColor }}>{gl} <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>({glLabel})</span></span>
                    </div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>
                      Средний ГИ рациона: ~{avgGI} · ГН на приём: ~{glPerMeal} · Углеводы: {Math.round(totalCarbs)}г
                    </div>
                    {gl > 120 && <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 2 }}>💡 Высокая нагрузка — рекомендуется увеличить долю низко-ГИ продуктов (бобовые, цельнозерновые, овощи)</div>}
                  </div>
                );
              })()}
            </div>
          )}
          {drugCompatReport && activeReports.includes('drug') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#8b5cf6', marginBottom: 4 }}>💉 Совместимость с препаратами</div>
              {drugCompatReport.interactions.map((int: any, i: number) => (
                <div key={i} style={{ fontSize: 8, padding: '2px 0', color: int.severity === 'high' ? '#ef4444' : '#f59e0b' }}>
                  • {int.drug} + {int.food}: {int.effect}
                </div>
              ))}
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>
                {drugCompatReport.warnings.join('; ')}
              </div>
            </div>
          )}
          {nutritionReport && activeReports.includes('nutrition') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6' }}>📋 Полный отчёт о питании</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: nutritionReport.overallGrade === 'A' ? '#22c55e' : nutritionReport.overallGrade === 'B' ? '#8b5cf6' : nutritionReport.overallGrade === 'C' ? '#f59e0b' : '#ef4444' }}>{nutritionReport.overallGrade}</span>
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 3 }}>{nutritionReport.overallGradeLabel}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 3, marginBottom: 4 }}>
                {[{l:'Ккал',v:nutritionReport.kbjuPct.kcal},{l:'Белки',v:nutritionReport.kbjuPct.p},{l:'Жиры',v:nutritionReport.kbjuPct.f},{l:'Угл.',v:nutritionReport.kbjuPct.c}].map((s: any) => (
                  <div key={s.l} style={{ background:'rgba(0,0,0,0.2)', borderRadius:4, padding:'3px', textAlign:'center' }}>
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>{s.l}</div>
                    <div style={{ fontSize:11, fontWeight:700, color: s.v >= 85 && s.v <= 115 ? '#22c55e' : s.v >= 70 ? '#f59e0b' : '#ef4444' }}>{s.v}%</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <div style={{ flex: 1, background: 'rgba(59,130,246,0.06)', borderRadius: 4, padding: '3px 5px' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)' }}>Вес/нед</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: nutritionReport.weightDynamicsBasic.direction === 'loss' ? '#22c55e' : nutritionReport.weightDynamicsBasic.direction === 'gain' ? '#f59e0b' : '#fff' }}>
                    {nutritionReport.weightDynamicsBasic.direction === 'loss' ? '−' : nutritionReport.weightDynamicsBasic.direction === 'gain' ? '+' : '∼'}{nutritionReport.weightDynamicsBasic.weeklyKg} кг
                  </div>
                </div>
                <div style={{ flex: 1, background: 'rgba(139,92,246,0.06)', borderRadius: 4, padding: '3px 5px' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)' }}>Качество</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: nutritionReport.foodQualityScore >= 7 ? '#22c55e' : '#f59e0b' }}>{nutritionReport.foodQualityScore}/10</div>
                </div>
              </div>
              {nutritionReport.microDeficiencies.length > 0 && <div style={{ fontSize: 7, color: '#f59e0b', marginBottom: 2 }}>⚠ {nutritionReport.microDeficiencies.length} дефицитов: {nutritionReport.microDeficiencies.slice(0, 3).join('; ')}</div>}
              {nutritionReport.recommendations.length > 0 && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>💡 {nutritionReport.recommendations.slice(0, 2).join(' • ')}</div>}
            </div>
          )}
        </GlassCard>
      )}

      <div style={{ marginTop:4, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ fontSize:9, fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:2 }}>⚡ Специальные режимы</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateCheatMeal()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', color:'#f59e0b', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              🍔 Читмил
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:4, lineHeight:1.2 }}>Один приём пищи с повышенной калорийностью</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateCarbload()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)', color:'#f97316', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              🍚 Углев. загрузка
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:4, lineHeight:1.2 }}>Повышение углеводов на 1-2 дня</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateBUTCH()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)', color:'#3b82f6', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              ⤴️⤵️ БУЧ
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:4, lineHeight:1.2 }}>Белково-углеводное чередование</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateCravingPlan()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background: cravingMode ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)', border: cravingMode ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)', color: cravingMode ? '#ef4444' : 'rgba(255,255,255,0.5)', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              🍬 Хочу сладкое
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:4, lineHeight:1.2 }}>Сладкий перекус на {cravingDays} {cravingDays === 1 ? 'день' : 'дня'}</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateLazyDayPlan()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background: lazyDayMode ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)', border: lazyDayMode ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)', color: lazyDayMode ? '#f59e0b' : 'rgba(255,255,255,0.5)', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              😴 Ленивый день
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:4, lineHeight:1.2 }}>Минимум готовки, {lazyDayDays} {lazyDayDays === 1 ? 'день' : 'дней'}</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => setSpecialMealMode(!specialMealMode)} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background: specialMealMode ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.02)', border: specialMealMode ? '1px solid rgba(249,115,22,0.2)' : '1px solid rgba(255,255,255,0.06)', color: specialMealMode ? '#f97316' : 'rgba(255,255,255,0.5)', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              🍽️ Спецприём
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:4, lineHeight:1.2 }}>Приём с заданными макросами</div>
          </div>
        </div>
      </div>

      {cravingPlan && (
        <GlassCard title="Хочу сладкое" icon="🍬" color="#ef4444" style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>~{cravingPlan.kcal} ккал ({cravingPlan.days} {cravingPlan.days === 1 ? 'день' : 'дня'})</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Белки</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{cravingPlan.bju.p}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Жиры</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{cravingPlan.bju.f}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Углеводы</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>{cravingPlan.bju.c}г</div>
            </div>
          </div>
          {cravingPlan.items.map((it: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>• {it.name || it}</span>
              <span onClick={() => addToCart({ name: it.name || it, kcal: it.kcal || 100, amount: 100 })} style={{ cursor:'pointer', fontSize:8, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="В корзину">🛒</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#ef4444', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
            {cravingPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#ef4444', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)' }}>{cravingPlan.recommendation}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)' }}>{cravingPlan.note}</div>
        </GlassCard>
      )}

      {lazyDayPlan && (
        <GlassCard title="Ленивый день" icon="😴" color="#f59e0b" style={{ border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>~{lazyDayPlan.kcal} ккал (85% от нормы, {lazyDayPlan.days} {lazyDayPlan.days === 1 ? 'день' : 'дней'})</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Белки</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{lazyDayPlan.bju.p}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Жиры</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{lazyDayPlan.bju.f}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Углеводы</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{lazyDayPlan.bju.c}г</div>
            </div>
          </div>
          {lazyDayPlan.items.map((it: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>• {it.name || it}</span>
              <span onClick={() => addToCart({ name: it.name || it, kcal: it.kcal || 100, amount: 100 })} style={{ cursor:'pointer', fontSize:8, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="В корзину">🛒</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#f59e0b', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
            {lazyDayPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{lazyDayPlan.recommendation}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{lazyDayPlan.note}</div>
        </GlassCard>
      )}

      {cheatMealPlan && (
        <GlassCard title="Читмил" icon="🍔" color="#f59e0b" style={{ border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>~{cheatMealPlan.cals} ккал (35% от нормы)</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Белки</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{cheatMealPlan.bju.p}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Жиры</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{cheatMealPlan.bju.f}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Углеводы</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316' }}>{cheatMealPlan.bju.c}г</div>
            </div>
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginBottom: 6, textAlign: 'center' }}>{cheatMealPlan.bjuBreakdown}</div>
          {cheatMealPlan.items.map((it: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>• {it.name || it}</span>
              <span onClick={() => addToCart({ name: it.name || it, kcal: it.kcal || (cheatMealPlan.cals / cheatMealPlan.items.length), amount: 100 })} style={{ cursor:'pointer', fontSize:8, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="В корзину">🛒</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#f59e0b', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
            {cheatMealPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{cheatMealPlan.recommendation}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{cheatMealPlan.note}</div>
        </GlassCard>
      )}

      {carbloadPlan && (
        <GlassCard title="Углеводная загрузка" icon="🍚" color="#f97316" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316', marginBottom: 4 }}>Всего: {carbloadPlan.totalCarbs} г ({Math.round(carbloadPlan.totalCarbs / weight)} г/кг)</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Белки</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{carbloadPlan.bju.p}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Жиры</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{carbloadPlan.bju.f}г</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Углеводы</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316' }}>{carbloadPlan.bju.c}г</div>
            </div>
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginBottom: 6, textAlign: 'center' }}>~{carbloadPlan.bju.kcal} ккал всего</div>
          {carbloadPlan.foods.map((f: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>• {f.name || f}</span>
              <span onClick={() => addToCart({ name: f.name || f, kcal: f.kcal || 100, amount: 100 })} style={{ cursor:'pointer', fontSize:8, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="В корзину">🛒</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#f97316', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
            {carbloadPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#f97316', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.06)' }}>{carbloadPlan.note}</div>
        </GlassCard>
      )}

      {specialMealMode && (() => {
        const p = specialMealProteinG; const f = specialMealFatG; const c = specialMealCarbsG;
        const kcal = p * 4 + f * 9 + c * 4;
        const suggestFoods = (): { id: string; name: string; amount: string }[] => {
          const picks: { id: string; g: number }[] = [];
          if (p > 20) picks.push({ id: 'chicken_breast', g: Math.round(p / 31 * 100) });
          else picks.push({ id: 'egg_whole', g: Math.round(p / 13 * 60) });
          if (f > 10) picks.push({ id: 'salmon', g: Math.round(f / 13 * 100) });
          if (c > 30) picks.push({ id: 'rice_white', g: Math.round(c / 28 * 100) });
          else if (c > 10) picks.push({ id: 'buckwheat', g: Math.round(c / 30 * 100) });
          if (specialMealGoal === 'pre_workout' || specialMealGoal === 'post_workout') picks.push({ id: 'whey', g: 30 });
          if (specialMealGoal === 'before_bed') picks.push({ id: 'cottage_cheese', g: Math.round(p / 18 * 100) });
          if (specialMealGoal === 'keto' && f > 20) picks.push({ id: 'avocado', g: Math.round(f / 15 * 100) });
          return picks.map(pk => {
            const food = FOOD_DB.find(x => x.id === pk.id);
            return { id: pk.id, name: food?.name || pk.id, amount: pk.g + 'г' };
          });
        };
        const suggested = suggestFoods();
        return (
        <div style={{ borderRadius: 12, padding: 12, background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.15)', marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>🍽️ Спецприём{specialMealReplaceMode ? ` (замена: ${specialMealReplaceTarget})` : ' (дополнительно)'}</span>
            <span onClick={() => setSpecialMealMode(false)} style={{ cursor: 'pointer', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>✕</span>
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>
            {specialMealGoal === 'pre_workout' ? '🏋️ Предтренировочный приём' :
             specialMealGoal === 'post_workout' ? '💪 Послетренировочный приём' :
             specialMealGoal === 'before_bed' ? '🌙 Приём на ночь (медленный белок)' :
             specialMealGoal === 'high_protein' ? '🥩 Высокобелковый приём' :
             specialMealGoal === 'keto' ? '🥑 Кето-приём' :
             specialMealGoal === 'low_cal_day' ? '📉 Низкокалорийный приём' : '⚙️ Свой приём'}
            · {specialMealTiming === 'breakfast' ? '🌅 Завтрак' : specialMealTiming === 'lunch' ? '☀️ Обед' : specialMealTiming === 'dinner' ? '🌆 Ужин' : specialMealTiming === 'snack' ? '🍪 Перекус' : '🌙 Перед сном'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>🥩 Белок</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>{p}г</div>
            </div>
            <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>🧈 Жиры</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{f}г</div>
            </div>
            <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>🍚 Углеводы</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>{c}г</div>
            </div>
            <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>🔥 Ккал</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>{kcal}</div>
            </div>
          </div>
          {suggested.length > 0 && (
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.1)' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>🍽️ Рекомендуемые продукты:</div>
              {suggested.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'rgba(255,255,255,0.7)', padding: '2px 0' }}>
                  <span>{s.name}</span>
                  <span style={{ color: '#f97316', fontWeight: 600 }}>{s.amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        );
      })()}

      {butchPlan && (
        <GlassCard title="БУЧ (белково-углеводное чередование)" icon="⤴️⤵️" color="#3b82f6" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ padding: '10px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>📋 {butchPlan.pattern}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: '#22c55e', fontWeight: 600 }}>ВУ (тренировка)</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#22c55e' }}>{butchPlan.highCarb}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>г углеводов</div>
                <div style={{ fontSize: 7, color: '#3b82f6', marginTop: 2 }}>↑ белок {butchPlan.protein}г</div>
                <div style={{ fontSize: 7, color: '#f59e0b' }}>↓ жиры {butchPlan.fatHigh}г</div>
              </div>
              <div style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600 }}>НУ (отдых)</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#ef4444' }}>{butchPlan.lowCarb}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>г углеводов</div>
                <div style={{ fontSize: 7, color: '#3b82f6', marginTop: 2 }}>↑ белок {butchPlan.protein}г</div>
                <div style={{ fontSize: 7, color: '#f59e0b' }}>↑ жиры {butchPlan.fatLow}г</div>
              </div>
            </div>
            <div style={{ fontSize: 8, color: '#22c55e', textAlign: 'center', marginBottom: 4 }}>
              ВУ: {butchPlan.bjuHigh.kcal} ккал · НУ: {butchPlan.bjuLow.kcal} ккал
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#3b82f6', marginTop: 6, marginBottom: 4 }}>📋 Основные принципы:</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
              {butchPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
            </div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.06)' }}>{butchPlan.note}</div>
          </div>
        </GlassCard>
      )}

      <div style={{ marginTop:4, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ fontSize:9, fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:2 }}>🎯 Расширенные инструменты</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={generateRecommendations} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.2)', color:'#a855f7', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              💡 Выдать рекомендации
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:4, lineHeight:1.2 }}>Персональные советы по питанию</div>
          </div>
          {generated && dayPlan && (
            <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
              <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                {([1, 3, 7] as const).map(n => (
                  <button key={n} onClick={() => setMealPrepDays(n)} style={{
                    flex:1, padding:'5px', borderRadius:6, cursor:'pointer', textAlign:'center',
                    background: mealPrepDays === n ? 'rgba(6,182,212,0.15)' : 'transparent',
                    border: mealPrepDays === n ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    color: mealPrepDays === n ? '#06b6d4' : 'rgba(255,255,255,0.6)',
                    fontWeight:600, fontSize:8,
                  }}>
                    {n === 1 ? '1 день' : n === 3 ? '3 дня' : 'Неделя'}
                  </button>
                ))}
              </div>
              <button onClick={generateMealPrep} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(6,182,212,0.08)', border:'1px solid rgba(6,182,212,0.2)', color:'#06b6d4', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
                👨‍🍳 Meal Prep
              </button>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:4, lineHeight:1.2 }}>План приготовления на несколько дней</div>
            </div>
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <GlassCard title="Рекомендации" icon="💡" color="#a855f7" style={{ border: '1px solid rgba(168,85,247,0.15)' }}>
          {recommendations.map((r: string, i: number) => (
            <div key={i} style={{ fontSize: 9, color: '#fff', padding: '4px 0', borderBottom: i < recommendations.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', lineHeight: 1.4 }}>
              • {r}
            </div>
          ))}
        </GlassCard>
      )}

      {mealPrepPlan && (
        <GlassCard title="План готовки" icon="👨‍🍳" color="#06b6d4" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#06b6d4', marginBottom: 6 }}>
            <span>⏱ {mealPrepPlan.totalTime} мин</span>
            <span>📦 {mealPrepPlan.containers} контейнеров</span>
          </div>
          {mealPrepPlan.steps.map((st: any, i: number) => (
            <div key={i} style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#06b6d4' }}>Шаг {st.step}: {st.action}</span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>{st.duration} мин</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {st.items.map((item: string, j: number) => <span key={j} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.1)', color: 'rgba(255,255,255,0.85)' }}>{item}</span>)}
              </div>
            </div>
          ))}
          <button onClick={saveCurrentPlan} style={{ marginTop: 6, padding: '8px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.25)', background: 'rgba(6,182,212,0.06)', color: '#06b6d4', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>💾 Сохранить план</button>
        </GlassCard>
      )}

      {savedPlans.length > 0 && (
        <GlassCard title="Сохранённые планы" icon="📂" color="#8b5cf6">
          {savedPlans.slice(0, 10).map((p: any, pi: number) => {
            const isExpanded = p.id === (expandedSavedId as any);
            return (
              <div key={p.id} style={{ marginBottom: 6, borderRadius: 10, overflow: 'hidden', border: isExpanded ? '1px solid rgba(139,92,246,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', cursor: 'pointer', background: isExpanded ? 'rgba(139,92,246,0.04)' : '#202023' }}
                  onClick={() => setExpandedSavedId(isExpanded ? null : p.id)}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{p.name || p.date}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 8, color: '#00e68a', fontWeight: 600 }}>{p.dayPlan ? `${Math.round(p.dayPlan.totals.kcal)} ккал` : ''}</span>
                    <button onClick={(e) => { e.stopPropagation(); loadSavedPlan(p); }} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a', fontWeight: 600 }}>📋</button>
                    <button onClick={(e) => { e.stopPropagation(); const txt = `🍽 План питания ${p.name || p.date}\n${p.dayPlan?.meals?.map((m: any) => `${m.time} ${m.label}: ${m.items?.map((it: any) => `${it.name} ${it.amount}г`).join(', ')}`).join('\n') || ''}`; navigator.clipboard?.writeText(txt); }} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', fontWeight: 600 }}>📤</button>
                    <button onClick={(e) => { e.stopPropagation(); const updated = savedPlans.filter((_: any, j: number) => j !== pi); setSavedPlans(updated); localStorage.setItem('he_saved_nutrition_plans', JSON.stringify(updated)); }} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 600 }}>✕</button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: '6px 10px 8px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>
                    {p.dayPlan && (
                      <div>
                        <div style={{ fontWeight: 700, color: '#00e68a', marginBottom: 4, fontSize: 9 }}>🍽 План на день: {Math.round(p.dayPlan.totals.kcal)} ккал</div>
                        {p.dayPlan.meals?.map((m: any, mi: number) => (
                          <div key={mi} style={{ padding: '2px 0', display: 'flex', gap: 4 }}>
                            <span style={{ color: 'rgba(255,255,255,0.85)' }}>{m.time}</span>
                            <span style={{ fontWeight: 600, color: '#00e68a' }}>{m.label}:</span>
                            <span>{m.items?.map((it: any) => it.name).join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.shoppingList && p.shoppingList.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                        <span style={{ color: '#f97316', fontWeight: 600 }}>🛒 {p.shoppingList.length} продуктов</span>
                      </div>
                    )}
                    {p.waterCalc && <div style={{ marginTop: 2, color: '#06b6d4', fontWeight: 600 }}>💧 {p.waterCalc.total} л/день</div>}
                  </div>
                )}
              </div>
            );
          })}
        </GlassCard>
      )}
    </>
  );
};
