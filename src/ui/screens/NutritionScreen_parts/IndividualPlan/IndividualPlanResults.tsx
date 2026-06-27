import React, { useState } from "react";
import { addToCart } from "../../../../core/nutrition-utils";
import { FOOD_DB } from "../../../../core/nutrition-database";
import { getRecipesByMeal } from "../../../../engines/nutrition-periodization.engine";
import { generateNutritionReport } from "../../../../engines/nutrition-report.engine";
import { ALLERGEN_LIST, HEALTH_ISSUES } from "./types";
import type { DrugInjection } from "./types";
import { GlassCard, greenBtn, reportPillStyle } from "./ui";
import { usePlanCtx } from "./IndividualPlanContext";
import { DailyDietDashboard } from "../DailyDietDashboard";
import { calcMealScoreV2, calcMealDIAAS, analyzeDailyDiet, getDefaultProfile, type MealTiming, type DailyDietReport, type MealScoreV2 } from '../../../../engines/product-usefulness-v2.engine';

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
    v2Phase, v2Pharma, v2Labs, histamineSensitive,
  } = usePlanCtx();

  const [showCalcPopup, setShowCalcPopup] = useState(false);
  const [calcTab, setCalcTab] = useState<'day' | 'week'>('day');
  const [calcSelections, setCalcSelections] = useState<Set<string>>(new Set());
  const [calcResults, setCalcResults] = useState<{ id: string; name: string; score: MealScoreV2; diaas: { diaas: number; limitingAA: string } }[] | null>(null);
  const [calcDailyReport, setCalcDailyReport] = useState<DailyDietReport | null>(null);

  const [showCorrectPopup, setShowCorrectPopup] = useState(false);
  const [correctIssues, setCorrectIssues] = useState<{ mealIdx: number; mealName: string; issues: { type: string; text: string; severity: 'low' | 'medium' | 'high'; suggestion?: { foodId: string; name: string; reason: string }[] }[] }[] | null>(null);

  const analyzePlanIssues = () => {
    if (!dayPlan || !dayPlan.meals) return;
    const profile = getDefaultProfile();
    profile.phase = (v2Phase as any) || 'LEAN_MASS';
    profile.pharma.AAS_ORAL = v2Pharma.AAS_ORAL || false;
    profile.pharma.AAS_INJECTABLE = v2Pharma.AAS_INJECTABLE || false;
    profile.pharma.HGH = v2Pharma.HGH || false;
    profile.pharma.DIURETICS = v2Pharma.DIURETICS || false;
    profile.pharma.STIMULATORS = v2Pharma.STIMULATORS || false;
    profile.pharma.INSULIN_USE = v2Pharma.INSULIN_USE || false;
    profile.pharma.LIVER_SUPPORT = v2Pharma.LIVER_SUPPORT || false;
    profile.pharma.GUT_SUPPORT = v2Pharma.GUT_SUPPORT || false;
    profile.histamineSensitive = histamineSensitive;
    profile.labs.hematocrit = v2Labs.hematocrit ? parseFloat(v2Labs.hematocrit) : undefined;
    profile.labs.ldl = v2Labs.ldl ? parseFloat(v2Labs.ldl) : undefined;
    profile.labs.alt = v2Labs.alt ? parseFloat(v2Labs.alt) : undefined;
    profile.labs.ast = v2Labs.ast ? parseFloat(v2Labs.ast) : undefined;
    profile.weightKg = weight || 80;
    profile.lbm = profile.weightKg * 0.85;

    const result: { mealIdx: number; mealName: string; issues: { type: string; text: string; severity: 'low' | 'medium' | 'high'; suggestion?: { foodId: string; name: string; reason: string }[] }[] }[] = [];

    dayPlan.meals.forEach((m: any, mi: number) => {
      const issues: { type: string; text: string; severity: 'low' | 'medium' | 'high'; suggestion?: { foodId: string; name: string; reason: string }[] }[] = [];
      const products = (m.items || []).map((it: any) => {
        const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
        return { ...it, food };
      });
      const totalKcal = m.totals?.kcal || 0;
      const totalP = m.totals?.p || 0;
      const totalF = m.totals?.f || 0;
      const totalC = m.totals?.c || 0;

      // Low protein
      if (totalP < 25) {
        const highProteinFoods = FOOD_DB.filter(f => f.protein > 25 && f.category !== 'protein').slice(0, 3).map(f => ({ foodId: f.id, name: f.name, reason: `${f.protein}Рі Р±РµР»РєР°/100Рі` }));
        issues.push({ type: 'low_protein', text: `рџҐ© РњР°Р»Рѕ Р±РµР»РєР° (${totalP}Рі) вЂ” <25Рі Р·Р° РїСЂРёС‘Рј`, severity: 'high', suggestion: highProteinFoods });
      }
      // High fat
      if (totalF > 30) {
        const lowFatFoods = FOOD_DB.filter(f => f.fat < 5 && f.protein > 15).slice(0, 3).map(f => ({ foodId: f.id, name: f.name, reason: `Р–РёСЂС‹ ${f.fat}Рі/100Рі, Р±РµР»РѕРє ${f.protein}Рі/100Рі` }));
        issues.push({ type: 'high_fat', text: `рџ§€ РњРЅРѕРіРѕ Р¶РёСЂРѕРІ (${totalF}Рі) вЂ” >30Рі Р·Р° РїСЂРёС‘Рј`, severity: 'medium', suggestion: lowFatFoods });
      }
      // High carb
      if (totalC > 100 && profile.phase === 'EXTREME_CUT') {
        const lowCarbFoods = FOOD_DB.filter(f => f.carbs < 10 && f.protein > 15).slice(0, 3).map(f => ({ foodId: f.id, name: f.name, reason: `РЈРіР»РµРІРѕРґС‹ ${f.carbs}Рі/100Рі, Р±РµР»РѕРє ${f.protein}Рі/100Рі` }));
        issues.push({ type: 'high_carb', text: `рџЌљ РњРЅРѕРіРѕ СѓРіР»РµРІРѕРґРѕРІ (${totalC}Рі) РЅР° СЃСѓС€РєРµ`, severity: 'high', suggestion: lowCarbFoods });
      }
      // Missing mTOR trigger
      const totalLeucine = products.reduce((s: number, p: any) => {
        const leucineMg = p.food?.amino_acid_profile_100g?.leucine_mg;
        const fallbackLeucine = p.food?.protein ? p.food.protein * 42 : 0;
        return s + (leucineMg ?? fallbackLeucine) * (p.amount || 100) / 100;
      }, 0);
      if (totalLeucine < 3000 && totalLeucine > 0) {
        const getLeucine = (f: any) => f.amino_acid_profile_100g?.leucine_mg ?? (f.protein ? f.protein * 42 : 0);
        const leucineFoods = FOOD_DB.filter(f => getLeucine(f) > 250).sort((a, b) => getLeucine(b) - getLeucine(a)).slice(0, 3).map(f => ({ foodId: f.id, name: f.name, reason: `Р›РµР№С†РёРЅ ${Math.round(getLeucine(f))}РјРі/100Рі` }));
        issues.push({ type: 'low_leucine', text: `рџ§¬ РќРµС‚ Р»РµР№С†РёРЅРѕРІРѕРіРѕ С‚СЂРёРіРіРµСЂР° (${Math.round(totalLeucine)}РјРі)`, severity: 'high', suggestion: leucineFoods });
      }
      // Low fiber
      const totalFiber = products.reduce((s: number, p: any) => s + (p.food?.fiber || 0) * (p.amount || 100) / 100, 0);
      if (totalFiber < 3) {
        const fiberFoods = FOOD_DB.filter(f => f.fiber > 4).slice(0, 3).map(f => ({ foodId: f.id, name: f.name, reason: `РљР»РµС‚С‡Р°С‚РєР° ${f.fiber}Рі/100Рі` }));
        issues.push({ type: 'low_fiber', text: `рџЊѕ РњР°Р»Рѕ РєР»РµС‚С‡Р°С‚РєРё (${totalFiber.toFixed(0)}Рі)`, severity: 'medium', suggestion: fiberFoods });
      }
      // DIAAS per meal
      const v2Products = products.filter((p: any) => p.food).map((p: any) => ({ foodId: p.food.id, weightGrams: p.amount || 100 }));
      if (v2Products.length > 0) {
        const diaas = calcMealDIAAS(v2Products);
        if (diaas.diaas < 0.75 && diaas.diaas > 0) {
          const aaFoods = FOOD_DB.filter(f => f.protein > 15 && f.category === 'protein').slice(0, 3).map(f => ({ foodId: f.id, name: f.name, reason: `РџРѕР»РЅРѕС†РµРЅРЅС‹Р№ Р±РµР»РѕРє, ${f.protein}Рі/100Рі` }));
          issues.push({ type: 'low_diaas', text: `рџ’Є РќРёР·РєРёР№ DIAAS (${diaas.diaas.toFixed(2)}) вЂ” Р»РёРјРёС‚: ${diaas.limitingAA}`, severity: 'high', suggestion: aaFoods });
        }
      }

      if (issues.length > 0) result.push({ mealIdx: mi, mealName: m.label || `РџСЂРёС‘Рј ${mi + 1}`, issues });
    });

    setCorrectIssues(result);
  };

  const toggleCalcSelection = (id: string) => {
    const next = new Set(calcSelections);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCalcSelections(next);
  };

  const itemToProduct = (it: any) => {
    const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
    return { foodId: food?.id || it.name || 'unknown', weightGrams: it.amount || 100 };
  };

  const handleCalcUsefulness = () => {
    const profile = getDefaultProfile();
    profile.phase = (v2Phase as any) || 'LEAN_MASS';
    profile.pharma.AAS_ORAL = v2Pharma.AAS_ORAL || false;
    profile.pharma.AAS_INJECTABLE = v2Pharma.AAS_INJECTABLE || false;
    profile.pharma.HGH = v2Pharma.HGH || false;
    profile.pharma.DIURETICS = v2Pharma.DIURETICS || false;
    profile.pharma.STIMULATORS = v2Pharma.STIMULATORS || false;
    profile.pharma.INSULIN_USE = v2Pharma.INSULIN_USE || false;
    profile.pharma.LIVER_SUPPORT = v2Pharma.LIVER_SUPPORT || false;
    profile.pharma.GUT_SUPPORT = v2Pharma.GUT_SUPPORT || false;
    profile.histamineSensitive = histamineSensitive;
    profile.labs.hematocrit = v2Labs.hematocrit ? parseFloat(v2Labs.hematocrit) : undefined;
    profile.labs.ldl = v2Labs.ldl ? parseFloat(v2Labs.ldl) : undefined;
    profile.labs.hdl = v2Labs.hdl ? parseFloat(v2Labs.hdl) : undefined;
    profile.labs.alt = v2Labs.alt ? parseFloat(v2Labs.alt) : undefined;
    profile.labs.ast = v2Labs.ast ? parseFloat(v2Labs.ast) : undefined;
    profile.labs.crp = v2Labs.crp ? parseFloat(v2Labs.crp) : undefined;
    profile.labs.estradiol = v2Labs.estradiol ? parseFloat(v2Labs.estradiol) : undefined;
    profile.labs.prolactin = v2Labs.prolactin ? parseFloat(v2Labs.prolactin) : undefined;
    profile.labs.testosterone = v2Labs.testosterone ? parseFloat(v2Labs.testosterone) : undefined;
    profile.labs.glucose_fasting = v2Labs.glucose ? parseFloat(v2Labs.glucose) : undefined;
    profile.labs.insulin_fasting = v2Labs.insulin ? parseFloat(v2Labs.insulin) : undefined;
    profile.weightKg = weight || 80;
    profile.lbm = profile.weightKg * 0.85;

    const allMeals: { timing?: MealTiming; products: { foodId: string; weightGrams: number }[] }[] = [];
    const results: { id: string; name: string; score: MealScoreV2; diaas: { diaas: number; limitingAA: string } }[] = [];

    if (dayPlan) {
      calcSelections.forEach(id => {
        if (id.startsWith('meal_')) {
          const idx = parseInt(id.replace('meal_', ''));
          const meal = dayPlan.meals[idx];
          if (!meal) return;
          const products = (meal.items || []).map(itemToProduct).filter((p: any) => p.weightGrams > 0);
          if (products.length === 0) return;
          const timing = (meal.timing || 'regular') as MealTiming;
          const score = calcMealScoreV2(products, profile, timing);
          const diaas = calcMealDIAAS(products);
          allMeals.push({ timing, products });
          results.push({ id, name: meal.label || `РџСЂРёС‘Рј ${idx + 1}`, score, diaas });
        }
        if (id === 'special_cheatmeal' && cheatMealPlan) {
          const products = (cheatMealPlan.items || []).map(itemToProduct).filter((p: any) => p.weightGrams > 0);
          if (products.length > 0) {
            const score = calcMealScoreV2(products, profile, 'cheat_meal');
            const diaas = calcMealDIAAS(products);
            allMeals.push({ timing: 'cheat_meal', products });
            results.push({ id, name: 'рџЌ” Р§РёС‚РјРёР»', score, diaas });
          }
        }
        if (id === 'special_carbload' && carbloadPlan) {
          const products = (carbloadPlan.foods || []).map(itemToProduct).filter((p: any) => p.weightGrams > 0);
          if (products.length > 0) {
            const score = calcMealScoreV2(products, profile, 'carb_load');
            const diaas = calcMealDIAAS(products);
            allMeals.push({ timing: 'carb_load', products });
            results.push({ id, name: 'рџЌљ РЈРіР»РµРІ. Р·Р°РіСЂСѓР·РєР°', score, diaas });
          }
        }
        if (id === 'special_lazy' && lazyDayPlan) {
          const products = (lazyDayPlan.items || []).map(itemToProduct).filter((p: any) => p.weightGrams > 0);
          if (products.length > 0) {
            const score = calcMealScoreV2(products, profile, 'regular');
            const diaas = calcMealDIAAS(products);
            allMeals.push({ products });
            results.push({ id, name: 'рџґ Р›РµРЅРёРІС‹Р№ РґРµРЅСЊ', score, diaas });
          }
        }
        if (id === 'special_craving' && cravingPlan) {
          const products = (cravingPlan.items || []).map(itemToProduct).filter((p: any) => p.weightGrams > 0);
          if (products.length > 0) {
            const score = calcMealScoreV2(products, profile, 'regular');
            const diaas = calcMealDIAAS(products);
            allMeals.push({ products });
            results.push({ id, name: 'рџЌ¬ РҐРѕС‡Сѓ СЃР»Р°РґРєРѕРµ', score, diaas });
          }
        }
      });
    }

    const dailyReport = allMeals.length > 0 ? analyzeDailyDiet(allMeals, profile) : null;
    setCalcResults(results);
    setCalcDailyReport(dailyReport);
  };


  return (
    <>
      <button onClick={() => generatePlan(1)} style={{
        ...greenBtn, fontSize: 14, padding: 14,
        boxShadow: '0 4px 20px rgba(0,230,138,0.2)',
      }}>
        вњЁ РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ РїР»Р°РЅ РїРёС‚Р°РЅРёСЏ
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
        рџ“… РџР»Р°РЅ РЅР° РјРµСЃСЏС† (4 РЅРµРґРµР»Рё)
      </button>

      <div ref={resultsRef as any} />
      {generated && (
        <GlassCard title="Р’С‹Р±РѕСЂ РґРЅРµР№" icon="рџ“…" color="#00e68a">
          <div style={{ color:'rgba(255,255,255,0.8)', fontSize:7, marginBottom:4, textAlign:'center' }}>РќР°Р¶РјРёС‚Рµ РЅР° РґРµРЅСЊ РґР»СЏ РїР»Р°РЅР° РЅР° 1 РґРµРЅСЊ</div>
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
                  <span style={{ fontSize:10 }}>{isTrain ? 'рџЏ‹пёЏ' : 'рџ›Њ'}</span>
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
            }}>рџ“… РќР° 3 РґРЅСЏ</button>
            <button onClick={() => { setPlanDays(7); setPlanView('calendar'); if (!weekPlan) generatePlan(7); }} style={{
              padding:'10px', borderRadius:10, cursor:'pointer', textAlign:'center',
              background: planDays === 7 ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : '#202023',
              border: planDays === 7 ? 'none' : '1px solid rgba(255,255,255,0.06)',
              color: planDays === 7 ? '#fff' : 'rgba(255,255,255,0.85)',
              fontWeight:700, fontSize:10,
            }}>рџ“† РќРµРґРµР»СЏ</button>
          </div>
          {planDays === 7 && (
            <button onClick={() => setPlanView(planView === 'list' ? 'calendar' : 'list')} style={{
              marginTop: 0, marginBottom:6, padding: '6px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600, width: '100%',
              background: planView === 'calendar' ? 'rgba(139,92,246,0.15)' : '#202023',
              border: planView === 'calendar' ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: planView === 'calendar' ? '#a78bfa' : 'rgba(255,255,255,0.85)',
            }}>рџ“… {planView === 'calendar' ? 'РЎРїРёСЃРѕРє' : 'РљР°Р»РµРЅРґР°СЂСЊ'}</button>
          )}
          {planDays !== 1 && (
            <button onClick={() => generatePlan(planDays)} style={{ marginTop: 0, marginBottom:6, padding: '8px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)', color: '#00e68a', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>
              рџ”„ РџРµСЂРµРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ {planDays === 3 ? '3 РґРЅСЏ' : 'РЅРµРґРµР»СЋ'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button onClick={() => {
              const txt = dayPlan ? `рџЌЅ РџР»Р°РЅ РїРёС‚Р°РЅРёСЏ\n${dayPlan.meals.map((m: any) => `${m.time} ${m.label}: ${m.items.map((it: any) => `${it.name} ${it.amount}Рі`).join(', ')}  [${Math.round(m.totals?.kcal || 0)}РєРєР°Р»]`).join('\n')}\n\nрџ“Љ РС‚РѕРіРѕ: ${Math.round(dayPlan.totals.kcal)} РєРєР°Р», Р‘${Math.round(dayPlan.totals.p)}/Р–${Math.round(dayPlan.totals.f)}/РЈ${Math.round(dayPlan.totals.c)}` : '';
              navigator.clipboard?.writeText(txt);
            }} style={{ flex:1, padding:'5px', borderRadius:6, cursor:'pointer', border:'1px solid rgba(96,165,250,0.2)', background:'rgba(96,165,250,0.06)', color:'#60a5fa', fontSize:7, fontWeight:600 }}>рџ“¤ РљРѕРїРёСЂРѕРІР°С‚СЊ</button>
            <button onClick={() => {
              const input = prompt('Р’СЃС‚Р°РІСЊС‚Рµ РїР»Р°РЅ РёР· Р±СѓС„РµСЂР°:');
              if (!input) return;
              try {
                const parsed = JSON.parse(input);
                if (parsed.meals) { setDayPlan(parsed); setGenerated(true); }
              } catch { alert('РќРµРІРµСЂРЅС‹Р№ С„РѕСЂРјР°С‚. РЎРєРѕРїРёСЂСѓР№С‚Рµ РїР»Р°РЅ С‡РµСЂРµР· РєРЅРѕРїРєСѓ "РљРѕРїРёСЂРѕРІР°С‚СЊ РїР»Р°РЅ".'); }
            }} style={{ flex:1, padding:'5px', borderRadius:6, cursor:'pointer', border:'1px solid rgba(249,115,22,0.2)', background:'rgba(249,115,22,0.06)', color:'#f97316', fontSize:7, fontWeight:600 }}>рџ“Ґ РРјРїРѕСЂС‚</button>
          </div>
        </GlassCard>
      )}
      {generated && dayPlan && <DailyDietDashboard />}
      {generated && allergens.length > 0 && (
        <GlassCard title="РђР»Р»РµСЂРіРµРЅС‹" icon="вљ пёЏ" color="#f97316" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
            {allergenExcludedCount > 0 ? (
              <>рџљ« РСЃРєР»СЋС‡РµРЅРѕ <strong style={{ color: '#f97316' }}>{allergenExcludedCount}</strong> РїСЂРѕРґСѓРєС‚РѕРІ РёР· {FOOD_DB.length} РїРѕ РІР°С€РёРј Р°Р»Р»РµСЂРіРµРЅР°Рј: <span style={{ color: '#fb923c' }}>{allergens.map(a => ALLERGEN_LIST.find(al => al.id === a)?.label || a).join(', ')}</span></>
            ) : (
              <>вљ пёЏ РђР»Р»РµСЂРіРµРЅС‹ РІС‹Р±СЂР°РЅС‹ ({allergens.map(a => ALLERGEN_LIST.find(al => al.id === a)?.label || a).join(', ')}), РЅРѕ РЅРё РѕРґРёРЅ РїСЂРѕРґСѓРєС‚ РЅРµ Р±С‹Р» РёСЃРєР»СЋС‡С‘РЅ вЂ” РїСЂРѕРІРµСЂСЊС‚Рµ СЃРїРёСЃРѕРє РїСЂРѕРґСѓРєС‚РѕРІ РІ Р±Р°Р·Рµ</>
            )}
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>Р§С‚РѕР±С‹ РїСЂРёРјРµРЅРёС‚СЊ РёР·РјРµРЅРµРЅРёСЏ Р°Р»Р»РµСЂРіРµРЅРѕРІ, РЅР°Р¶РјРёС‚Рµ В«РџРµСЂРµРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊВ»</div>
        </GlassCard>
      )}

      {generated && planDays === 1 && dayPlan && (
        <GlassCard title={`РџР»Р°РЅ РЅР° РґРµРЅСЊ${cyclingMode !== 'none' ? (dayPlan.isTrainingDay ? ' рџЏ‹пёЏ РўСЂРµРЅРёСЂРѕРІРѕС‡РЅС‹Р№' : ' рџ›Њ РћС‚РґС‹С…') : ''}`} icon="рџ“‹" color={dayPlan.isTrainingDay ? '#00e68a' : '#8b5cf6'} style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          {dayPlan.isTrainingDay !== undefined && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{dayPlan.isTrainingDay ? 'РўСЂРµРЅРёСЂРѕРІРѕС‡РЅС‹Р№ РґРµРЅСЊ' : 'Р”РµРЅСЊ РѕС‚РґС‹С…Р°'}{cyclingMode !== 'none' && ` В· С†РёРєР»РёСЂРѕРІР°РЅРёРµ: ${{macro:'РјР°РєСЂРѕСЃС‹',butch:'Р‘РЈР§',cheatmeal:'С‡РёС‚РјРёР»',carbload:'СѓРіР».Р·Р°РіСЂСѓР·РєР°'}[cyclingMode] || ''}`}{workScheduleEnabled && ` В· рџ’ј${dayPlan.isWorkDay ? ' Р Р°Р±РѕС‡РёР№' : ' Р’С‹С…РѕРґРЅРѕР№'}${dayPlan.isWorkDay && workStartTime ? ` ${workStartTime}-${workEndTime}` : ''}`}</div>}
          {renderMealList(dayPlan)}
          <textarea value={dayPlanNotes} onChange={e => { setDayPlanNotes(e.target.value); localStorage.setItem('he_day_notes', e.target.value); }} placeholder="Р—Р°РјРµС‚РєРё РЅР° СЃРµРіРѕРґРЅСЏ..." style={{ width:'100%', marginTop:6, padding:'6px 10px', borderRadius:8, fontSize:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.85)', resize:'vertical', minHeight:30, boxSizing:'border-box' }} rows={1} />
          {(() => {
            const dayTotal = dayPlan.totals;
            const devKcal = Math.round(dayTotal?.kcal - effectiveKcal);
            const devP = Math.round(dayTotal?.p - effectiveP);
            if (Math.abs(devKcal) < 50 && Math.abs(devP) < 5) return null;
            return (
              <button onClick={autoCorrectPlan} style={{ marginTop: 6, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 8, fontWeight: 600, width: '100%', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                рџ“Љ РђРІС‚РѕРєРѕСЂСЂРµРєС†РёСЏ: РѕС‚РєР». РѕС‚ С†РµР»Рё {devKcal > 0 ? '+' : ''}{devKcal} РєРєР°Р» / {devP > 0 ? '+' : ''}{devP}Рі Р‘ вЂ” РїРѕРґРѕРіРЅР°С‚СЊ РѕСЃС‚Р°РІС€РёРµСЃСЏ РїСЂРёС‘РјС‹
              </button>
            );
          })()}
        </GlassCard>
      )}

      {generated && planDays === 3 && threeDayPlan && (
        <GlassCard title="РџР»Р°РЅ РЅР° 3 РґРЅСЏ" icon="рџ“‹" color="#00e68a" style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <span style={{ color: '#00e68a', fontWeight: 700 }}>рџ“Љ Р’СЃРµРіРѕ: {Math.round(threeDayPlan.totals.kcal)} РєРєР°Р»</span>
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>РЎСЂРµРґРЅРµРµ: {Math.round(threeDayPlan.totals.kcal / 3)} РєРєР°Р»/РґРµРЅСЊ</span>
          </div>
          {threeDayPlan.days.map((d: any, di: number) => (
            <div key={di} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#00e68a', marginBottom: 6, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.04)', display: 'inline-block' }}>
                Р”РµРЅСЊ {di + 1}
              </div>
              {renderMealList(d)}
            </div>
          ))}
        </GlassCard>
      )}

      {generated && planDays === 7 && weekPlan && (
        <GlassCard title={monthPlanMode ? `РњРµСЃСЏС‡РЅС‹Р№ РїР»Р°РЅ вЂ” РќРµРґРµР»СЏ ${selectedWeek + 1} / 4` : 'РќРµРґРµР»СЊРЅС‹Р№ РїР»Р°РЅ'} icon="рџ“‹" color="#00e68a" style={{ border: '1px solid rgba(0,230,138,0.15)' }}>
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
                }}>Рќ{wi + 1}</button>
              ))}
              <button onClick={() => { setMonthPlanMode(false); setMonthPlan([]); }} style={{
                padding:'5px 8px', borderRadius:8, fontSize:8, cursor:'pointer',
                background:'transparent', color:'rgba(255,255,255,0.8)', border:'1px solid rgba(255,255,255,0.06)',
              }}>вњ•</button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <span style={{ color: '#00e68a', fontWeight: 700 }}>рџ“Љ Р—Р° РЅРµРґРµР»СЋ: {Math.round(weekPlan.totals.kcal)} РєРєР°Р»</span>
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>РЎСЂРµРґРЅРµРµ: {Math.round(weekPlan.totals.kcal / 7)} РєРєР°Р»/РґРµРЅСЊ</span>
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 6, display: 'flex', gap: 6, justifyContent: 'center' }}>
            <span style={{ color: '#3b82f6' }}>в—Џ Р‘: {Math.round(weekPlan.totals.p)}Рі</span>
            <span style={{ color: '#f59e0b' }}>в—Џ Р–: {Math.round(weekPlan.totals.f)}Рі</span>
            <span style={{ color: '#f97316' }}>в—Џ РЈ: {Math.round(weekPlan.totals.c)}Рі</span>
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
                      <span style={{ fontSize: 14 }}>{wIsTraining ? 'рџЏ‹пёЏ' : 'рџґ'}</span>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: wIsTraining ? '#00e68a' : 'rgba(255,255,255,0.85)' }}>
                          {DAY_LABELS[di]} В· Р”РµРЅСЊ {di + 1}
                        </span>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', display: 'flex', gap: 4 }}>
                          <span style={{ color: '#3b82f6' }}>Р‘ {wP}</span>
                          <span style={{ color: '#f59e0b' }}>Р– {wF}</span>
                          <span style={{ color: '#f97316' }}>РЈ {wC}</span>
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{wKcal} РєРєР°Р»</span>
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>
                    {d.meals.map((m: any, mi: number) => (
                      <div key={mi} style={{ padding: '2px 0', display: 'flex', gap: 4 }}>
                        <span style={{ color: '#00e68a', fontWeight: 600, minWidth: 50 }}>{m.time}</span>
                        <span style={{ color: '#00e68a', minWidth: 55 }}>{m.label}</span>
                        <span style={{ flex: 1 }}>{m.items?.map((it: any) => it.name)?.join(', ') || ''}</span>
                        <span style={{ color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}>{Math.round(m.totals?.kcal || 0)} РєРєР°Р»</span>
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
        <GlassCard title="рџ“… РљР°Р»РµРЅРґР°СЂСЊ РїРёС‚Р°РЅРёСЏ РЅР° РЅРµРґРµР»СЋ" icon="рџ“…" color="#a78bfa">
          {(() => {
            const allMealLabels = Array.from(new Set(weekPlan.days.flatMap((d: any) => d.meals.map((m: any) => m.label))));
            return <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 7 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '4px 6px', textAlign: 'center', background: '#202023', borderRadius: 6, fontSize: 7, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>РџСЂРёС‘Рј</th>
                    {weekPlan.days.map((d: any, di: number) => (
                      <th key={di} style={{ padding: '4px 6px', textAlign: 'center', background: d.isTrainingDay ? 'rgba(0,230,138,0.12)' : '#202023', borderRadius: 6, fontSize: 7, color: d.isTrainingDay ? '#00e68a' : 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
                        {DAY_LABELS[di]}
                        <div style={{ fontWeight: 400, color: 'rgba(255,255,255,0.85)' }}>{Math.round(d.totals.kcal)} РєРєР°Р»</div>
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
                        if (!meal) return <td key={di} style={{ padding: '4px', textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 6 }}>вЂ”</td>;
                        const kcal = Math.round(meal.totals?.kcal || 0);
                        return (
                          <td key={di} style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 6, verticalAlign: 'top' }}>
                            <div style={{ color: '#00e68a', fontWeight: 700, fontSize: 7, marginBottom: 2 }}>{kcal} РєРєР°Р»</div>
                            {(meal.items || []).slice(0, 2).map((it: any, ii: number) => (
                              <div key={ii} style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, fontSize: 6 }}>{it.name} {it.amount}Рі</div>
                            ))}
                            {meal.items.length > 2 && <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 5 }}>+{meal.items.length - 2} РµС‰С‘</div>}
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
        <GlassCard title="вЏі РўР°Р№РјР»Р°Р№РЅ РґРЅСЏ" icon="вЏі" color="#06b6d4">
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
                    <span style={{ fontSize: 8, color: '#00e68a', fontWeight: 700 }}>{k} РєРєР°Р»</span>
                    <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Р‘ {Math.round(m.totals?.p || 0)} Р– {Math.round(m.totals?.f || 0)} РЈ {Math.round(m.totals?.c || 0)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#202023', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${w}%`, background: 'linear-gradient(90deg, #06b6d4, #00e68a)', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(m.items || []).map((it: any, ii: number) => (
                      <span key={ii} style={{ background: '#202023', padding: '1px 5px', borderRadius: 4 }}>{it.name} {it.amount}Рі</span>
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
            <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:4, letterSpacing:'-0.3px' }}>рџЌі Р—Р°РјРµРЅРёС‚СЊ В«{recipePickerMeal.label}В» СЂРµС†РµРїС‚РѕРј</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', marginBottom:12 }}>РџРѕРґС…РѕРґСЏС‰РёРµ СЂРµС†РµРїС‚С‹</div>
            <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
              {getRecipesByMeal(recipePickerMeal.label === 'Р—Р°РІС‚СЂР°Рє' ? 'breakfast' : recipePickerMeal.label === 'РћР±РµРґ' || recipePickerMeal.label === 'Р’С‚РѕСЂРѕР№ Р·Р°РІС‚СЂР°Рє' ? 'lunch' : recipePickerMeal.label === 'РЈР¶РёРЅ' ? 'dinner' : 'snack').length === 0 ? (
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.85)', textAlign:'center', padding:10 }}>РќРµС‚ СЂРµС†РµРїС‚РѕРІ РґР»СЏ СЌС‚РѕРіРѕ РїСЂРёС‘РјР°.</div>
              ) : getRecipesByMeal(recipePickerMeal.label === 'Р—Р°РІС‚СЂР°Рє' ? 'breakfast' : recipePickerMeal.label === 'РћР±РµРґ' || recipePickerMeal.label === 'Р’С‚РѕСЂРѕР№ Р·Р°РІС‚СЂР°Рє' ? 'lunch' : recipePickerMeal.label === 'РЈР¶РёРЅ' ? 'dinner' : 'snack').map((r, i) => (
                <button key={i} onClick={() => replaceMealWithRecipe(r, recipePickerMeal.mealIdx)} style={{ width:'100%', padding:'10px 12px', borderRadius:12, cursor:'pointer', textAlign:'left', background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:9, transition:'all 0.15s' }}
                  onMouseEnter={e => (e.target as HTMLElement).style.borderColor = 'rgba(139,92,246,0.3)'}
                  onMouseLeave={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'}>
                  <div style={{ fontWeight:700, color:'#a78bfa', fontSize:10, marginBottom:2 }}>{r.name}</div>
                  <div style={{ color:'rgba(255,255,255,0.85)', marginBottom:4 }}>вЏ±{r.prepTimeMin}РјРёРЅ В· {r.kcal}РєРєР°Р» В· Р‘{r.protein}/Р–{r.fat}/РЈ{r.carbs}</div>
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)', display:'flex', gap:2, flexWrap:'wrap' }}>{(r.tags || []).map(t => <span key={t} style={{ padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.08)', color:'rgba(167,139,250,0.5)' }}>{t}</span>)}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setRecipePickerMeal(null)} style={{ width:'100%', marginTop:8, padding:'6px', borderRadius:8, cursor:'pointer', border:'1px solid rgba(255,255,255,0.06)', background:'#202023', color:'rgba(255,255,255,0.85)', fontSize:8, fontWeight:600 }}>вњ• РћС‚РјРµРЅР°</button>
          </div>
        </div>
      )}

      {generated && undoStack.length > 0 && (
        <button onClick={() => { setDayPlan(undoStack[0]); setUndoStack(undoStack.slice(1)); }} style={{ width:'100%', padding:'8px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(96,165,250,0.2)', background:'rgba(96,165,250,0.06)', color:'#60a5fa', fontSize:10, fontWeight:600 }}>
          в†© РћС‚РјРµРЅРёС‚СЊ ({undoStack.length})
        </button>
      )}

      {generated && (
        <button onClick={saveCurrentPlan} style={{
          ...greenBtn, background: 'linear-gradient(135deg,#8b5cf6,#a78bfa)',
          fontSize: 13, padding: 12,
          boxShadow: '0 4px 16px rgba(139,92,246,0.2)',
        }}>
          рџ’ѕ РЎРѕС…СЂР°РЅРёС‚СЊ РІ РјРѕРё РїР»Р°РЅС‹
        </button>
      )}

      {generated && (
        <GlassCard title="рџЏ† Р”РѕСЃС‚РёР¶РµРЅРёСЏ Рё СЃРµР·РѕРЅ" icon="рџЏ†" color="#f472b6">
          {(() => {
            const ach: { label: string; earned: boolean; icon: string }[] = [];
            try {
              const diaryRaw = localStorage.getItem('nutrition_diary');
              const diary = diaryRaw ? JSON.parse(diaryRaw) : {};
              const daysLogged = Object.keys(diary).length;
              if (daysLogged >= 1) ach.push({ label: 'РџРµСЂРІС‹Р№ РґРµРЅСЊ РІ РґРЅРµРІРЅРёРєРµ', earned: true, icon: 'рџ“ќ' });
              if (daysLogged >= 7) ach.push({ label: 'РќРµРґРµР»СЏ РґРЅРµРІРЅРёРєР°', earned: true, icon: 'рџ“†' });
              if (daysLogged >= 30) ach.push({ label: 'РњРµСЃСЏС† РґРЅРµРІРЅРёРєР°', earned: true, icon: 'рџ“…' });
              const plansRaw = localStorage.getItem('he_saved_nutrition_plans');
              const plans = plansRaw ? JSON.parse(plansRaw) : [];
              if (plans.length >= 1) ach.push({ label: 'РџРµСЂРІС‹Р№ СЃРѕС…СЂР°РЅС‘РЅРЅС‹Р№ РїР»Р°РЅ', earned: true, icon: 'рџ’ѕ' });
              if (plans.length >= 5) ach.push({ label: '5 РїР»Р°РЅРѕРІ', earned: true, icon: 'рџ“љ' });
              if (localStorage.getItem('he_off_cache')) ach.push({ label: 'РЎРєР°РЅРёСЂРѕРІР°Р» С€С‚СЂРёС…-РєРѕРґ', earned: true, icon: 'рџ“·' });
            } catch {}
            const month = new Date().getMonth();
            const seasonal = [
              { months: [5,6,7,8], label: 'рџҐ’ РћРіСѓСЂС†С‹, РїРѕРјРёРґРѕСЂС‹, СЏРіРѕРґС‹, Р·РµР»РµРЅСЊ' },
              { months: [9,10], label: 'рџЌ‚ РўС‹РєРІР°, РєР°Р±Р°С‡РєРё, СЏР±Р»РѕРєРё, РІРёРЅРѕРіСЂР°Рґ' },
              { months: [11,12,1,2], label: 'рџҐ¬ Р¦РёС‚СЂСѓСЃРѕРІС‹Рµ, С…СѓСЂРјР°, РіСЂР°РЅР°С‚С‹, СЃРІС‘РєР»Р°' },
              { months: [3,4], label: 'рџЊ± РЎРїР°СЂР¶Р°, СЂРµРґРёСЃ, С€РїРёРЅР°С‚, РїРµСЂРІР°СЏ Р·РµР»РµРЅСЊ' },
            ].find(s => s.months.includes(month));
            return <>
              {ach.length > 0 && <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                {ach.map(a => <span key={a.label} style={{ padding:'3px 8px', borderRadius:6, fontSize:8, background:'rgba(244,114,182,0.08)', border:'1px solid rgba(244,114,182,0.15)', color:'#f472b6' }}>{a.icon} {a.label}</span>)}
              </div>}
              {seasonal && <div style={{ fontSize:8, color:'rgba(255,255,255,0.85)', padding:'4px 8px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.1)' }}>рџЊї РЎРµР·РѕРЅРЅС‹Рµ РїСЂРѕРґСѓРєС‚С‹: {seasonal.label}</div>}
              {ach.length === 0 && <div style={{ fontSize:8, color:'rgba(255,255,255,0.8)' }}>РќР°С‡РЅРёС‚Рµ РІРµСЃС‚Рё РґРЅРµРІРЅРёРє РїРёС‚Р°РЅРёСЏ, С‡С‚РѕР±С‹ РїРѕР»СѓС‡Р°С‚СЊ РґРѕСЃС‚РёР¶РµРЅРёСЏ.</div>}
            </>;
          })()}
        </GlassCard>
      )}

      <button onClick={() => setShowRecipeCreator(true)} style={{ width:'100%', padding:'8px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(249,115,22,0.2)', background:'rgba(249,115,22,0.06)', color:'#f97316', fontSize:9, fontWeight:600, marginTop:4 }}>
        рџЌі РЎРѕР·РґР°С‚СЊ СЃРІРѕР№ СЂРµС†РµРїС‚
      </button>
      {showRecipeCreator && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)' }}
          onClick={() => setShowRecipeCreator(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'88%', maxWidth:380, maxHeight:'85vh', overflowY:'auto', padding:0, borderRadius:20, background:'#1c1c1e', boxShadow:'0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' }}>
            <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:17, fontWeight:700, color:'#fff', letterSpacing:-0.3 }}>рџЌі РЎРѕР·РґР°С‚СЊ СЂРµС†РµРїС‚</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginTop:2 }}>Р—Р°РїРѕР»РЅРёС‚Рµ РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ Р±Р»СЋРґРµ</div>
            </div>
            <div style={{ padding:'12px 20px 20px', display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>РќР°Р·РІР°РЅРёРµ</div>
              <input value={newRecipe.name} onChange={e => setNewRecipe({...newRecipe, name: e.target.value})} placeholder="РќР°Р·РІР°РЅРёРµ СЂРµС†РµРїС‚Р°" style={{ width:'100%', padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:15, boxSizing:'border-box', outline:'none', fontWeight:500 }} />
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>РџСЂРёС‘Рј Рё РІСЂРµРјСЏ</div>
              <div style={{ display:'flex', gap:6 }}>
                <select value={newRecipe.meal} onChange={e => setNewRecipe({...newRecipe, meal: e.target.value})} style={{ flex:1, padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:15, boxSizing:'border-box', outline:'none', appearance:'none', fontWeight:500 }}>
                  <option value="breakfast">Р—Р°РІС‚СЂР°Рє</option><option value="lunch">РћР±РµРґ</option>
                  <option value="dinner">РЈР¶РёРЅ</option><option value="snack">РџРµСЂРµРєСѓСЃ</option>
                </select>
                <input type="number" value={newRecipe.prepTime} onChange={e => setNewRecipe({...newRecipe, prepTime: +e.target.value || 10})} placeholder="РњРёРЅ" style={{ width:80, padding:'12px 10px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:15, boxSizing:'border-box', outline:'none', textAlign:'center', fontWeight:500 }} />
              </div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>РљР‘Р–РЈ (РЅР° РїРѕСЂС†РёСЋ)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:5 }}>
                {[{k:'kcal',l:'РљРєР°Р»',c:'#22c55e'},{k:'protein',l:'Р‘РµР»РєРё',c:'#3b82f6'},{k:'fat',l:'Р–РёСЂС‹',c:'#f59e0b'},{k:'carbs',l:'РЈРіР»',c:'#f97316'}].map(f => <div key={f.k}><input type="number" value={(newRecipe as Record<string,number|string>)[f.k] as number} onChange={e => setNewRecipe({...newRecipe, [f.k]: +e.target.value || 0})} placeholder={f.l} style={{ width:'100%', padding:'14px 6px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:f.c, fontSize:15, boxSizing:'border-box', outline:'none', textAlign:'center', fontWeight:700 }} /></div>)}
              </div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>РРЅРіСЂРµРґРёРµРЅС‚С‹</div>
              <textarea value={newRecipe.ingredients} onChange={e => setNewRecipe({...newRecipe, ingredients: e.target.value})} placeholder="РРЅРіСЂРµРґРёРµРЅС‚С‹ (РєР°Р¶РґС‹Р№ СЃ РЅРѕРІРѕР№ СЃС‚СЂРѕРєРё)" style={{ width:'100%', padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', boxSizing:'border-box', outline:'none', minHeight:64, resize:'vertical', fontSize:13, lineHeight:1.4 }} rows={3} />
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>РџСЂРёРіРѕС‚РѕРІР»РµРЅРёРµ</div>
              <textarea value={newRecipe.instructions} onChange={e => setNewRecipe({...newRecipe, instructions: e.target.value})} placeholder="РРЅСЃС‚СЂСѓРєС†РёСЏ (РєР°Р¶РґС‹Р№ С€Р°Рі СЃ РЅРѕРІРѕР№ СЃС‚СЂРѕРєРё)" style={{ width:'100%', padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', boxSizing:'border-box', outline:'none', minHeight:64, resize:'vertical', fontSize:13, lineHeight:1.4 }} rows={3} />
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:3 }}>РўРµРіРё</div>
              <input value={newRecipe.tags} onChange={e => setNewRecipe({...newRecipe, tags: e.target.value})} placeholder="РўРµРіРё (С‡РµСЂРµР· Р·Р°РїСЏС‚СѓСЋ)" style={{ width:'100%', padding:'12px 14px', borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', boxSizing:'border-box', outline:'none', fontSize:13 }} />
              <button onClick={() => {
                const recipe = { ...newRecipe, ingredients: newRecipe.ingredients.split('\n').filter(Boolean), instructions: newRecipe.instructions.split('\n').filter(Boolean), tags: newRecipe.tags.split(',').map((t: string) => t.trim()).filter(Boolean), userCreated: true };
                const updated = [...userRecipes, recipe];
                setUserRecipes(updated);
                try { localStorage.setItem('he_user_recipes', JSON.stringify(updated)); } catch {}
                setShowRecipeCreator(false);
                setNewRecipe({ name: '', meal: 'lunch', prepTime: 10, kcal: 400, protein: 30, fat: 10, carbs: 40, ingredients: '', instructions: '', tags: '' });
              }} style={{ width:'100%', padding:'13px', borderRadius:14, cursor:'pointer', border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontSize:15, fontWeight:700, letterSpacing:0.2 }}>вњ“ РЎРѕС…СЂР°РЅРёС‚СЊ СЂРµС†РµРїС‚</button>
            </div>
          </div>
        </div>
      )}

      {generated && shoppingList && (
        <GlassCard title="РЎРїРёСЃРѕРє РїРѕРєСѓРїРѕРє" icon="рџ›’" color="#f97316" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          {(() => {
            const groups: Record<string, any[]> = {};
            shoppingList.forEach((item: any) => {
              const cat = item.catLabel || item.category || 'рџ“¦ РџСЂРѕС‡РµРµ';
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push(item);
            });
            const totalItems = shoppingList.length;
            const totalGrams = shoppingList.reduce((s: number, i: any) => s + (i.amount || 0), 0);
            const pricePerKg: Record<string, number> = { low: 4, medium: 7, max: 12, enhanced: 18 };
            const estCost = Math.round(totalGrams / 1000 * (pricePerKg[budget] || 7));
            const exportText = shoppingList.map((i: any) => `${i.name} вЂ” ${i.amount >= 1000 ? `${(i.amount/1000).toFixed(1)} РєРі` : `${Math.round(i.amount)} Рі`}`).join('\n');
            return (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button onClick={() => { shoppingList.forEach((i: any) => addToCart({ name: i.name, kcal: i.kcal || 0, amount: i.amount, category: i.catLabel || i.category })); }} style={{ flex:1, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.06)', color: '#f97316', cursor: 'pointer', fontSize: 8, fontWeight: 600 }}>
                    рџ›’ Р’ РєРѕСЂР·РёРЅСѓ ({totalItems})
                  </button>
                  <div style={{ padding: '5px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a', fontSize: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    рџ’° ~{estCost}в‚¬
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(exportText); }} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.06)', color: '#60a5fa', cursor: 'pointer', fontSize: 8, fontWeight: 600 }}>
                    рџ“‹
                  </button>
                </div>
                {Object.entries(groups).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#f97316', marginBottom: 2, padding: '2px 0 2px 4px', borderLeft: '2px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {cat}
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)', marginLeft: 'auto' }}>{items.length} С€С‚</span>
                    </div>
                    {items.map((data: any, i: number) => (
                      <div key={data.name + i} style={{ fontSize: 9, padding: '3px 0 3px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.85)' }}>
                        <span>{data.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {data.amount >= 1000 ? `${(data.amount / 1000).toFixed(1)} РєРі` : `${Math.round(data.amount)} Рі`}
                          </span>
                          <button onClick={() => addToCart({ name: data.name, kcal: data.kcal || 0, amount: data.amount, category: data.catLabel || data.category })} style={{ padding: '2px 4px', borderRadius: 4, border: 'none', background: 'rgba(249,115,22,0.12)', color: '#f97316', cursor: 'pointer', fontSize: 7 }}>рџ›’</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            );
          })()}
          <button onClick={saveCurrentPlan} style={{ marginTop: 6, padding: '8px', borderRadius: 8, border: '1px solid rgba(249,115,22,0.25)', background: 'rgba(249,115,22,0.06)', color: '#f97316', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>рџ’ѕ РЎРѕС…СЂР°РЅРёС‚СЊ РїР»Р°РЅ</button>
        </GlassCard>
      )}

      {generated && injections.length > 0 && (
        <GlassCard title="РўР°Р№РјРёРЅРі РїСЂРµРїР°СЂР°С‚РѕРІ Рё РїСЂРёС‘РјРѕРІ РїРёС‰Рё" icon="рџ’Љ" color="#8b5cf6" style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
          {injections.map((inj: DrugInjection) => {
            const isInsulin = inj.type === 'РёРЅСЃСѓР»РёРЅ';
            const isIGF = inj.type === 'РР¤Р -1';
            const isGH = inj.type === 'Р“Р ';
            const isPeptide = inj.type === 'РїРµРїС‚РёРґ';
            const isAAS = inj.type === 'РђРђРЎ';
            return (
              <div key={inj.id} style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
                <div style={{ fontWeight: 700, fontSize: 10, color: '#a78bfa', marginBottom: 3 }}>
                  рџ’‰ {inj.name} ({inj.dose}{inj.unit}) вЂ” {inj.time}
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginLeft: 4 }}>
                    TВЅ {inj.halfLifeHours}С‡
                    {inj.trainLinked && <span style={{ color: '#00e68a', marginLeft: 4 }}>рџЏ‹пёЏ {inj.trainTiming === 'before' ? 'Р”Рѕ С‚СЂРµРЅРёСЂРѕРІРєРё' : inj.trainTiming === 'after' ? 'РџРѕСЃР»Рµ С‚СЂРµРЅРёСЂРѕРІРєРё' : 'Р”Рѕ+РџРѕСЃР»Рµ'}</span>}
                  </span>
                </div>
                {isInsulin && inj.esterType === 'rapid' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    вљЎ <strong>Р‘С‹СЃС‚СЂС‹Р№ РёРЅСЃСѓР»РёРЅ (Р°РЅР°Р»РѕРі)</strong> вЂ” РїРёРє 30-90 РјРёРЅ, РґР»РёС‚РµР»СЊРЅРѕСЃС‚СЊ 3-4С‡.<br />
                    рџЌљ РќР° <strong>{Math.round(inj.dose * 10)}Рі СѓРіР»РµРІРѕРґРѕРІ</strong> (10Рі/РµРґ). РџСЂРёРЅСЏС‚СЊ СЃСЂР°Р·Сѓ РїРµСЂРµРґ РµРґРѕР№ РёР»Рё РїРѕСЃР»Рµ. <strong>РџР РћРџРЈРЎРљ Р•Р”Р« = Р“РРџРћР“Р›РРљР•РњРРЇ!</strong><br />
                    {inj.trainLinked ? `рџЏ‹пёЏ РџСЂРёРІСЏР·Р°РЅ Рє С‚СЂРµРЅРёСЂРѕРІРєРµ (${inj.trainTiming === 'before' ? 'РґРѕ' : inj.trainTiming === 'after' ? 'РїРѕСЃР»Рµ' : 'РґРѕ Рё РїРѕСЃР»Рµ'}). Р’ РїСЂРёС‘РјРµ: РёР·РѕР»СЏС‚ СЃС‹РІРѕСЂРѕС‚РѕС‡РЅРѕРіРѕ Р±РµР»РєР° + ${inj.trainTiming === 'before' ? 'Р°РјРёР»РѕРїРµРєС‚РёРЅ' : 'РґРµРєСЃС‚СЂРѕР·Р°'}.` : ''}
                    {inj.trainLinked && inj.trainTiming !== 'after' ? ' рџљЁ РќР° С‚СЂРµРЅРёСЂРѕРІРєРµ РћР‘РЇР—РђРўР•Р›Р¬РќРћ СѓРіР»РµРІРѕРґС‹ (РёР·РѕС‚РѕРЅРёРє/РіРµР№РЅРµСЂ/Р±Р°РЅР°РЅС‹) РєР°Р¶РґС‹Рµ 20 РјРёРЅ!' : ''}
                    {!inj.trainLinked ? ' вЏ° РќРµ РµС€СЊ Р±РµР· СѓРіР»РµРІРѕРґРѕРІ вЂ” СЂРёСЃРє РіРёРїРѕРіР»РёРєРµРјРёРё!' : ''}<br />
                    рџҐ‘ <strong>Р–РёСЂС‹ РњРРќРРњРЈРњ</strong> РІ РѕРєРЅРµ РґРµР№СЃС‚РІРёСЏ (РїРµСЂРІС‹Рµ 90 РјРёРЅ) вЂ” РЅРµ Р±РѕР»РµРµ 3-5Рі. Р–РёСЂС‹ Р·Р°РјРµРґР»СЏСЋС‚ РѕРїРѕСЂРѕР¶РЅРµРЅРёРµ Р¶РµР»СѓРґРєР° Рё Р±Р»РѕРєРёСЂСѓСЋС‚ РїРѕСЃС‚СѓРїР»РµРЅРёРµ РіР»СЋРєРѕР·С‹.<br />
                    рџ©ё <strong>Р“Р»СЋРєРѕР·Р°:</strong> Р·Р°РјРµСЂС‹ С‡РµСЂРµР· 15, 30, 60, 90, 120 РјРёРЅ. Р¦РµР»СЊ РЅРµ РЅРёР¶Рµ 4.0 РјРјРѕР»СЊ/Р».<br />
                    рџЌ¬ <strong>Р­РєСЃС‚СЂРµРЅРЅРѕ:</strong> 200РјР» СЃРѕРєР° + 4 С‚Р°Р±Р»РµС‚РєРё РіР»СЋРєРѕР·С‹ РїСЂРё СѓСЂРѕРІРЅРµ &lt;3.5 РјРјРѕР»СЊ/Р». 
                  </div>
                )}
                {isInsulin && inj.esterType === 'short' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    рџ•ђ <strong>РљРѕСЂРѕС‚РєРёР№ РёРЅСЃСѓР»РёРЅ (С‡РµР»РѕРІРµС‡РµСЃРєРёР№)</strong> вЂ” РїРёРє 2-4С‡, РґР»РёС‚РµР»СЊРЅРѕСЃС‚СЊ 5-8С‡.<br />
                    рџЌљ РќР° <strong>{Math.round(inj.dose * 10)}Рі СѓРіР»РµРІРѕРґРѕРІ</strong> (10Рі/РµРґ). Р’РІРµСЃС‚Рё Р·Р° 20-30 РјРёРЅ РґРѕ РµРґС‹. <strong>РџР РћРџРЈРЎРљ Р•Р”Р« РћРџРђРЎР•Рќ!</strong><br />
                    {inj.trainLinked ? `рџЏ‹пёЏ РџСЂРёРІСЏР·Р°РЅ Рє С‚СЂРµРЅРёСЂРѕРІРєРµ (${inj.trainTiming === 'before' ? 'РґРѕ' : inj.trainTiming === 'after' ? 'РїРѕСЃР»Рµ' : 'РґРѕ+РїРѕСЃР»Рµ'}). Р’ РїСЂРёС‘РјРµ: РёР·РѕР»СЏС‚ + ${inj.trainTiming === 'before' ? 'Р°РјРёР»РѕРїРµРєС‚РёРЅ' : 'РґРµРєСЃС‚СЂРѕР·Р°'}.` : ''}
                    {inj.trainLinked && inj.trainTiming !== 'after' ? ' рџљЁ РќР° С‚СЂРµРЅРёСЂРѕРІРєРµ РћР‘РЇР—РђРўР•Р›Р¬РќРћ СѓРіР»РµРІРѕРґС‹ РєР°Р¶РґС‹Рµ 20 РјРёРЅ!' : ''}<br />
                    рџҐ‘ <strong>Р–РёСЂС‹ &lt;5Рі</strong> РІ РѕРєРЅРµ 90 РјРёРЅ вЂ” РёРЅР°С‡Рµ РіРёРїРѕРіР»РёРєРµРјРёСЏ РЅР° С„РѕРЅРµ СѓР¶Рµ РїСЂРёРЅСЏС‚С‹С… СѓРіР»РµРІРѕРґРѕРІ.<br />
                    рџ©ё <strong>РџСЂР°РІРёР»Рѕ 4 С‡Р°СЃРѕРІ:</strong> РєР°Р¶РґС‹Р№ С‡Р°СЃ РїРѕСЃР»Рµ СѓРєРѕР»Р° вЂ” РјРёРЅРёРјСѓРј 10-15Рі СѓРіР»РµРІРѕРґРѕРІ РЅР° РїРѕРґРµСЂР¶Р°РЅРёРµ.
                  </div>
                )}
                {isInsulin && inj.esterType === 'long' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    рџЊ™ <strong>Р”Р»РёРЅРЅС‹Р№ РёРЅСЃСѓР»РёРЅ (Р±Р°Р·Р°Р»СЊРЅС‹Р№)</strong> вЂ” РїРѕРєСЂС‹РІР°РµС‚ СЃСѓС‚РѕС‡РЅСѓСЋ РїРѕС‚СЂРµР±РЅРѕСЃС‚СЊ.<br />
                    рџЌљ РџСЂРёРІСЏР·РєР° Рє РµРґРµ <strong>РЅРµ С‚СЂРµР±СѓРµС‚СЃСЏ</strong>. РџСЂРёРЅРёРјР°Р№ РІ РѕРґРЅРѕ Рё С‚Рѕ Р¶Рµ РІСЂРµРјСЏ РµР¶РµРґРЅРµРІРЅРѕ.<br />
                    рџ“Љ РљРѕСЂРѕС‚РєРёР№ РёРЅСЃСѓР»РёРЅ СЃС‡РёС‚Р°Р№ РѕС‚РґРµР»СЊРЅРѕ РѕС‚ РґР»РёРЅРЅРѕРіРѕ (СЃСѓС‚РѕС‡РЅР°СЏ РЅРѕСЂРјР° + РµРґР°).<br />
                    рџ“‹ РљРѕРЅС‚СЂРѕР»СЊ РіР»СЋРєРѕР·С‹ РЅР°С‚РѕС‰Р°Рє РєР°Р¶РґРѕРµ СѓС‚СЂРѕ вЂ” С†РµР»СЊ 4.0-6.0 РјРјРѕР»СЊ/Р».
                  </div>
                )}
                {isIGF && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    рџ§¬ <strong>РР¤Р -1/MGF</strong> вЂ” Р°РЅР°Р±РѕР»РёС‡РµСЃРєРёР№ РїРµРїС‚РёРґ, СЂР°Р±РѕС‚Р°РµС‚ СЃРёРЅРµСЂРіРёС‡РЅРѕ СЃ РёРЅСЃСѓР»РёРЅРѕРј.<br />
                    {inj.trainLinked ? `рџЏ‹пёЏ РџСЂРёРІСЏР·Р°РЅ Рє С‚СЂРµРЅРёСЂРѕРІРєРµ (${inj.trainTiming === 'before' ? 'РґРѕ' : inj.trainTiming === 'after' ? 'РїРѕСЃР»Рµ' : 'РґРѕ Рё РїРѕСЃР»Рµ'}). РџСЂРёРЅРёРјР°С‚СЊ РќРђРўРћР©РђРљ Р·Р° 30-45 РјРёРЅ РґРѕ РµРґС‹. Р•РґР° РїРѕСЃР»Рµ вЂ” РёР·РѕР»СЏС‚ + РґРµРєСЃС‚СЂРѕР·Р° (РњGF вЂ” РЅР°С‚РѕС‰Р°Рє, Р»РѕРєР°Р»СЊРЅРѕ РІ РјРµСЃС‚Рµ РЅР°РіСЂСѓР·РєРё).` : 'вЏ° РџСЂРёРЅРёРјР°С‚СЊ РЅР°С‚РѕС‰Р°Рє, Р·Р° 30-45 РјРёРЅ РґРѕ РµРґС‹ РёР»Рё СЃРѕРіР»Р°СЃРЅРѕ РїСЂРѕС‚РѕРєРѕР»Сѓ.'}<br />
                    рџҐ‘ <strong>Р–РёСЂС‹ РњРРќРРњРЈРњ</strong> вЂ” РІ РєРѕРјР±РёРЅР°С†РёРё СЃ РёРЅСЃСѓР»РёРЅРѕРј Р¶РёСЂС‹ РєСЂРёС‚РёС‡РµСЃРєРё Р·Р°РјРµРґР»СЏСЋС‚ Р°РЅР°Р±РѕР»РёС‡РµСЃРєРёР№ РѕС‚РІРµС‚.<br />
                    рџ©ё <strong>Р“РёРїРѕРіР»РёРєРµРјРёСЏ:</strong> РР¤Р -1 + РёРЅСЃСѓР»РёРЅ вЂ” СЂРёСЃРє РіРёРїРѕ РІРґРІРѕР№РЅРµ. Р“Р»СЋРєРѕРјРµС‚СЂ РѕР±СЏР·Р°С‚РµР»РµРЅ!<br />
                    рџ”¬ <strong>MGF:</strong> Р°РєС‚РёРІРёСЂСѓРµС‚ СЃР°С‚РµР»Р»РёС‚РЅС‹Рµ РєР»РµС‚РєРё Р»РѕРєР°Р»СЊРЅРѕ (С‚РѕР»СЊРєРѕ РЅР°РіСЂСѓР¶Р°РµРјР°СЏ РјС‹С€С†Р°). Р’ РєРѕРјР±РёРЅР°С†РёРё СЃ РР¤Р -1 вЂ” РєР°СЃРєР°Рґ РіРёРїРµСЂРїР»Р°Р·РёРё. РџРёС‚Р°РЅРёРµ: РіР»СЋРєРѕР·Р° + Р°РјРёРЅРѕРєРёСЃР»РѕС‚С‹ (BCAA/РёР·РѕР»СЏС‚) РІ РѕРєРЅРµ 30 РјРёРЅ РїРѕСЃР»Рµ.
                  </div>
                )}
                {isGH && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    рџ§¬ <strong>Р“Р /РџРµРїС‚РёРґС‹</strong> вЂ” РІР»РёСЏРЅРёРµ РЅР° РёРЅСЃСѓР»РёРЅ Рё РіР»СЋРєРѕР·Сѓ.<br />
                    вЏ° РќР°С‚РѕС‰Р°Рє, Р·Р° 30-60 РјРёРЅ РґРѕ РµРґС‹. РќРµ РµСЃС‚СЊ СѓРіР»РµРІРѕРґС‹ 30 РјРёРЅ РїРѕСЃР»Рµ.<br />
                    рџ“Љ РљРѕРЅС‚СЂРѕР»РёСЂСѓР№ РіР»СЋРєРѕР·Сѓ вЂ” Р“Р  СЃРЅРёР¶Р°РµС‚ С‡СѓРІСЃС‚РІРёС‚РµР»СЊРЅРѕСЃС‚СЊ Рє РёРЅСЃСѓР»РёРЅСѓ.
                  </div>
                )}
                {isAAS && inj.esterType === 'short' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    рџ’‰ <strong>РљРѕСЂРѕС‚РєРёР№ СЌС„РёСЂ</strong> вЂ” С‡Р°СЃС‚Р°СЏ РёРЅСЉРµРєС†РёСЏ (EOD/РµР¶РµРґРЅРµРІРЅРѕ).<br />
                    вЏ° РџСЂРёРІСЏР·РєР° Рє РµРґРµ РјРёРЅРёРјР°Р»СЊРЅР°. РЎР»РµРґРё Р·Р° СѓСЂРѕРІРЅРµРј РІРѕРґС‹: +0.5Р» Рє РЅРѕСЂРјРµ.
                  </div>
                )}
                {isAAS && inj.esterType === 'long' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    рџ’‰ <strong>Р”Р»РёРЅРЅС‹Р№ СЌС„РёСЂ</strong> вЂ” СЂРµРґРєР°СЏ РёРЅСЉРµРєС†РёСЏ (1-2СЂ/РЅРµРґ).<br />
                    вЏ° РџРµР№ 40РјР»/РєРі РІРѕРґС‹. РљРѕРЅС‚СЂРѕР»РёСЂСѓР№ РђР” Рё Р»РёРїРёРґС‹.
                  </div>
                )}
                {(inj.type === 'СЃРµРјР°РіР»СѓС‚РёРґ' || inj.type === 'С‚РёСЂР·РµРїР°С‚РёРґ') && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    рџ’Љ <strong>GLP-1 Р°РіРѕРЅРёСЃС‚</strong> вЂ” Р·Р°РјРµРґР»СЏРµС‚ РѕРїРѕСЂРѕР¶РЅРµРЅРёРµ Р¶РµР»СѓРґРєР°, РїРѕРґР°РІР»СЏРµС‚ Р°РїРїРµС‚РёС‚.<br />
                    рџ“Џ <strong>РџРёС‚Р°РЅРёРµ РґСЂРѕР±РЅРѕРµ:</strong> 5-6 СЂР°Р·/РґРµРЅСЊ РїРѕ 100-200Рі. РќРµ РїРµСЂРµРµРґР°С‚СЊ вЂ” С‚РѕС€РЅРѕС‚Р°, СЂРІРѕС‚Р°.<br />
                    рџҐ‘ <strong>Р–РёСЂС‹ &lt;5Рі/РїСЂРёС‘Рј</strong> вЂ” Р¶РёСЂРЅР°СЏ РїРёС‰Р° Р·Р°РґРµСЂР¶РёРІР°РµС‚СЃСЏ РІ Р¶РµР»СѓРґРєРµ РЅР° 4-6С‡, РІС‹Р·С‹РІР°СЏ С‚РѕС€РЅРѕС‚Сѓ Рё СЂРёСЃРє РїР°РЅРєСЂРµР°С‚РёС‚Р°.<br />
                    рџ’§ <strong>Р’РѕРґР° 30-40РјР»/РєРі</strong> вЂ” GLP-1 СЃРЅРёР¶Р°РµС‚ РјРѕС‚РѕСЂРёРєСѓ Р–РљРў, СЂРёСЃРє Р·Р°РїРѕСЂР°. РљР»РµС‚С‡Р°С‚РєР° 25-30Рі/РґРµРЅСЊ.<br />
                    вЏ° <strong>Р”РЅРё РїРёРє С‚РѕС€РЅРѕС‚С‹:</strong> РїРµСЂРІС‹Рµ 24-72С‡ РїРѕСЃР»Рµ РµР¶РµРЅРµРґРµР»СЊРЅРѕР№ РёРЅСЉРµРєС†РёРё вЂ” СЃР°РјС‹Рµ Р»С‘РіРєРёРµ РїСЂРёС‘РјС‹, Р¶РёСЂС‹ &lt;20Рі/РґРµРЅСЊ.<br />
                    рџ©ё <strong>B12 Рё СЌР»РµРєС‚СЂРѕР»РёС‚С‹:</strong> РґРѕР±Р°РІРєРё РѕР±СЏР·Р°С‚РµР»СЊРЅС‹ вЂ” GLP-1 СЃРЅРёР¶Р°РµС‚ РІСЃР°СЃС‹РІР°РЅРёРµ С‡РµСЂРµР· IF-С„Р°РєС‚РѕСЂ.<br />
                    рџљ« <strong>РђР»РєРѕРіРѕР»СЊ</strong> вЂ” РёСЃРєР»СЋС‡РёС‚СЊ РїРѕР»РЅРѕСЃС‚СЊСЋ (РїР°РЅРєСЂРµР°С‚РёС‚, РіРёРїРѕРіР»РёРєРµРјРёСЏ).<br />
                    рџ† <strong>Р‘РѕР»Рё РІ Р¶РёРІРѕС‚Рµ/РїРѕРґСЂРµР±РµСЂСЊРµ:</strong> РЅРµРјРµРґР»РµРЅРЅРѕ Рє РІСЂР°С‡Сѓ вЂ” РёСЃРєР»СЋС‡РёС‚СЊ РїР°РЅРєСЂРµР°С‚РёС‚.
                  </div>
                )}
                {inj.type === 'РґСЂСѓРіРѕРµ' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    в„№пёЏ РЎР»РµРґСѓР№ РёРЅСЃС‚СЂСѓРєС†РёРё РїРѕ РїСЂРµРїР°СЂР°С‚Сѓ. РџСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё СѓС‚РѕС‡РЅРё С‚РёРї.
                  </div>
                )}
              </div>
            );
          })}
          {injections.some((i: DrugInjection) => i.type === 'РёРЅСЃСѓР»РёРЅ' && i.esterType !== 'long') && (
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>рџљЁ Р§РµРєР»РёСЃС‚ РіРёРїРѕРіР»РёРєРµРјРёРё (РћРџРђРЎРќРћРЎРўР¬)</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                рџ©ё <strong>Р“Р»СЋРєРѕРјРµС‚СЂ РѕР±СЏР·Р°С‚РµР»РµРЅ!</strong> Р—Р°РјРµСЂС‹: РґРѕ, С‡РµСЂРµР· 15, 30, 60, 90, 120 РјРёРЅ<br />
                рџ§ѓ <strong>Р­РєСЃС‚СЂРµРЅРЅС‹Р№ РЅР°Р±РѕСЂ:</strong> 200РјР» СЃРѕРєР° + 3-4 С‚Р°Р±Р»РµС‚РєРё РіР»СЋРєРѕР·С‹ (15-20Рі) Р’РЎР•Р“Р”Рђ РЎ РЎРћР‘РћР™<br />
                рџ›Њ <strong>РќРµ РїСЂРёРЅРёРјР°С‚СЊ РєРѕСЂРѕС‚РєРёР№ РёРЅСЃСѓР»РёРЅ РїРѕСЃР»Рµ 18:00</strong> вЂ” СЂРёСЃРє РЅРѕС‡РЅРѕР№ РіРёРїРѕРіР»РёРєРµРјРёРё<br />
                вЏ° <strong>РљР°Р¶РґС‹Р№ С‡Р°СЃ РїРѕСЃР»Рµ РёРЅСЉРµРєС†РёРё</strong> вЂ” РјРёРЅРёРјСѓРј 10-15Рі СѓРіР»РµРІРѕРґРѕРІ (4-С‡Р°СЃРѕРІРѕРµ РѕРєРЅРѕ РґРµР№СЃС‚РІРёСЏ)<br />
                рџЏ‹пёЏ <strong>РќР° С‚СЂРµРЅРёСЂРѕРІРєРµ:</strong> РёР·РѕС‚РѕРЅРёРє 6-8% (500-1000РјР») + Р±Р°РЅР°РЅ РєР°Р¶РґС‹Рµ 20 РјРёРЅ<br />
                рџ”ґ <strong>Р•СЃР»Рё РіР»СЋРєРѕР·Р° &lt;3.5 РјРјРѕР»СЊ/Р»:</strong> РЅРµРјРµРґР»РµРЅРЅРѕ 15-20Рі Р±С‹СЃС‚СЂС‹С… СѓРіР»РµРІРѕРґРѕРІ, Р·Р°РјРµСЂ С‡РµСЂРµР· 15 РјРёРЅ<br />
                рџљ‘ <strong>Р•СЃР»Рё &lt;2.5 РјРјРѕР»СЊ/Р» РёР»Рё РїРѕС‚РµСЂСЏ СЃРѕР·РЅР°РЅРёСЏ:</strong> Р’Р«Р—РћР’ 103! Р“Р»СЋРєР°РіРѕРЅ 1РјРі РІ/Рј РёР»Рё РІ/РІ РіР»СЋРєРѕР·Р° 40%<br />
                рџ“‹ <strong>РЎРёРјРїС‚РѕРјС‹:</strong> РїРѕС‚Р»РёРІРѕСЃС‚СЊ, РґСЂРѕР¶СЊ, РіРѕР»РѕРґ в†’ СЃРїСѓС‚Р°РЅРЅРѕСЃС‚СЊ, Р°РіСЂРµСЃСЃРёСЏ в†’ РїРѕС‚РµСЂСЏ СЃРѕР·РЅР°РЅРёСЏ, СЃСѓРґРѕСЂРѕРіРё<br />
                рџҐ‘ <strong>Р–РёСЂС‹ РњРРќРРњРЈРњ:</strong> РІ РѕРєРЅРµ РґРµР№СЃС‚РІРёСЏ РёРЅСЃСѓР»РёРЅР° вЂ” РЅРµ Р±РѕР»РµРµ 5Рі Р¶РёСЂРѕРІ Р·Р° РїСЂРёС‘Рј (Р¶РёСЂС‹ Р·Р°РјРµРґР»СЏСЋС‚ РІСЃР°СЃС‹РІР°РЅРёРµ СѓРіР»РµРІРѕРґРѕРІ!)
              </div>
            </div>
          )}
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: 1.5 }}>
            рџ’Ў <strong>Р‘РђР—РћР’Р«Р• РџР РђР’РР›Рђ РРќРЎРЈР›РРќРђ:</strong><br />
            рџ§® 1 Р•Р” РєРѕСЂРѕС‚РєРѕРіРѕ/Р±С‹СЃС‚СЂРѕРіРѕ в‰€ 10Рі СѓРіР»РµРІРѕРґРѕРІ (С‡СѓРІСЃС‚РІРёС‚РµР»СЊРЅРѕСЃС‚СЊ РёРЅРґРёРІРёРґСѓР°Р»СЊРЅР° вЂ” РїРѕСЃР»Рµ РєСѓСЂСЃР° Р“Р /РђРђРЎ РјРѕР¶РµС‚ С‚СЂРµР±РѕРІР°С‚СЊСЃСЏ РЅР° 20-30% Р±РѕР»СЊС€Рµ).<br />
            рџҐ‘ <strong>Р–РР Р« РњРРќРРњРђР›Р¬РќР«</strong> РІ РѕРєРЅРµ РґРµР№СЃС‚РІРёСЏ РёРЅСЃСѓР»РёРЅР° (РїРµСЂРІС‹Рµ 2С‡) вЂ” РЅРµ Р±РѕР»РµРµ 5Рі. Р–РёСЂС‹ Р±Р»РѕРєРёСЂСѓСЋС‚ РІС‹С…РѕРґ РіР»СЋРєРѕР·С‹ РёР· Р¶РµР»СѓРґРєР° РІ РєСЂРѕРІСЊ, РІС‹Р·С‹РІР°СЏ РіРёРїРѕРіР»РёРєРµРјРёСЋ РїСЂРё СѓР¶Рµ РїСЂРёРЅСЏС‚С‹С… СѓРіР»РµРІРѕРґР°С…!<br />
            рџљ« <strong>РќР• РџР РћРџРЈРЎРљРђР™ РџР РРЃРњР« РџРР©Р</strong> вЂ” РіРёРїРѕРіР»РёРєРµРјРёСЏ СЂР°Р·РІРёРІР°РµС‚СЃСЏ Р·Р° 15-30 РјРёРЅСѓС‚!<br />
            рџ©ё <strong>Р“Р»СЋРєРѕРјРµС‚СЂ вЂ” С‚РІРѕР№ Р»СѓС‡С€РёР№ РґСЂСѓРі.</strong> Р¦РµР»СЊ: 4.0-6.0 РјРјРѕР»СЊ/Р» С‡РµСЂРµР· 2С‡ РїРѕСЃР»Рµ РёРЅСЉРµРєС†РёРё. РќРµ РІС‹С€Рµ 7.8, РЅРµ РЅРёР¶Рµ 3.9.<br />
            рџ§¬ MGF Р°РєС‚РёРІРёСЂСѓРµС‚ СЃР°С‚РµР»Р»РёС‚РЅС‹Рµ РєР»РµС‚РєРё Р»РѕРєР°Р»СЊРЅРѕ (РјРµСЃС‚Рѕ РёРЅСЉРµРєС†РёРё/С‚СЂРµРЅРёСЂРѕРІРєРё). РР¤Р -1 вЂ” СЃРёСЃС‚РµРјРЅРѕ. РћР±Р° С‚СЂРµР±СѓСЋС‚ РіР»СЋРєРѕР·Сѓ Рё Р°РјРёРЅРѕРєРёСЃР»РѕС‚С‹. Р‘РµР· РµРґС‹ РІ РѕРєРЅРµ вЂ” РЅСѓР»РµРІРѕР№ СЌС„С„РµРєС‚. 
          </div>
          {injections.some((i: DrugInjection) => i.type === 'СЃРµРјР°РіР»СѓС‚РёРґ' || i.type === 'С‚РёСЂР·РµРїР°С‚РёРґ') && (
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>рџ’Љ GLP-1 вЂ” СЃРїСЂР°РІРѕС‡РЅРёРє РїРёС‚Р°РЅРёСЏ</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                рџ“Џ <strong>Р”СЂРѕР±РЅРѕРµ РїРёС‚Р°РЅРёРµ:</strong> 5-6 СЂР°Р·/РґРµРЅСЊ РїРѕ 100-200Рі Р·Р° РїСЂРёС‘Рј. РќРµ РїРµСЂРµРїРѕР»РЅСЏС‚СЊ Р¶РµР»СѓРґРѕРє вЂ” СЂРёСЃРє СЂРІРѕС‚С‹.<br />
                рџҐ‘ <strong>Р–РёСЂС‹ &lt;5Рі/РїСЂРёС‘Рј:</strong> GLP-1 Р·Р°РјРµРґР»СЏРµС‚ РѕРїРѕСЂРѕР¶РЅРµРЅРёРµ Р¶РµР»СѓРґРєР° вЂ” Р¶РёСЂС‹ Р·Р°РґРµСЂР¶РёРІР°СЋС‚СЃСЏ Рё РІС‹Р·С‹РІР°СЋС‚ С‚РѕС€РЅРѕС‚Сѓ, РёР·Р¶РѕРіСѓ, СЂРёСЃРє РїР°РЅРєСЂРµР°С‚РёС‚Р°.<br />
                рџ’§ <strong>Р’РѕРґР° 30-40 РјР»/РєРі:</strong> GLP-1 СЃРЅРёР¶Р°РµС‚ РјРѕС‚РѕСЂРёРєСѓ Р–РљРў вЂ” СЂРёСЃРє Р·Р°РїРѕСЂРѕРІ. РљР»РµС‚С‡Р°С‚РєР° 25-30Рі/РґРµРЅСЊ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ.<br />
                вЏ° <strong>Р“СЂР°С„РёРє РёРЅСЉРµРєС†РёР№:</strong> РїРёРє С‚РѕС€РЅРѕС‚С‹ вЂ” РїРµСЂРІС‹Рµ 24-72С‡ РїРѕСЃР»Рµ РёРЅСЉРµРєС†РёРё. РџР»Р°РЅРёСЂСѓР№ СЃР°РјС‹Рµ Р»С‘РіРєРёРµ РїСЂРёС‘РјС‹ РЅР° СЌС‚Рё РґРЅРё. Р–РёСЂС‹ РІ СЌС‚Рё РґРЅРё &lt;20Рі/РґРµРЅСЊ.<br />
                рџ©ё <strong>РљРѕРЅС‚СЂРѕР»СЊ B12 Рё СЌР»РµРєС‚СЂРѕР»РёС‚РѕРІ:</strong> GLP-1 СЃРЅРёР¶Р°РµС‚ РІСЃР°СЃС‹РІР°РЅРёРµ B12 (С‡РµСЂРµР· IF-С„Р°РєС‚РѕСЂ) Рё РєР°Р»РёСЏ/РјР°РіРЅРёСЏ вЂ” РґРѕР±Р°РІРєРё РѕР±СЏР·Р°С‚РµР»СЊРЅС‹.<br />
                рџ† <strong>Р‘РѕР»Рё РІ Р»РµРІРѕРј РїРѕРґСЂРµР±РµСЂСЊРµ/Р¶РёРІРѕС‚Рµ:</strong> РїСЂРµРєСЂР°С‚РёС‚СЊ РїСЂРёС‘Рј, СЃСЂРѕС‡РЅРѕ Рє РІСЂР°С‡Сѓ вЂ” РёСЃРєР»СЋС‡РёС‚СЊ РѕСЃС‚СЂС‹Р№ РїР°РЅРєСЂРµР°С‚РёС‚.<br />
                рџљ« <strong>РђР»РєРѕРіРѕР»СЊ:</strong> РёСЃРєР»СЋС‡РёС‚СЊ РїРѕР»РЅРѕСЃС‚СЊСЋ вЂ” СѓСЃРёР»РёРІР°РµС‚ С‚РѕС€РЅРѕС‚Сѓ, СЂРёСЃРє РіРёРїРѕРіР»РёРєРµРјРёРё, РїР°РЅРєСЂРµР°С‚РёС‚.<br />
                рџЌ¬ <strong>Р“РёРїРѕРіР»РёРєРµРјРёСЏ:</strong> РІ РєРѕРјР±РёРЅР°С†РёРё СЃ РёРЅСЃСѓР»РёРЅРѕРј вЂ” СЂРёСЃРє РІРѕР·СЂР°СЃС‚Р°РµС‚ РІРґРІРѕРµ. Р“Р»СЋРєРѕРјРµС‚СЂ РѕР±СЏР·Р°С‚РµР»РµРЅ!
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {injections.some((i: DrugInjection) => i.type === 'РёРЅСЃСѓР»РёРЅ') && (
        <GlassCard title="рџ“– РЎРїСЂР°РІРѕС‡РЅРёРє: РРЅСЃСѓР»РёРЅ" icon="рџ“–" color="#ef4444" style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>рџ§® РџСЂР°РІРёР»Рѕ 10Рі/1Р•Р”:</strong> 1 РµРґРёРЅРёС†Р° РєРѕСЂРѕС‚РєРѕРіРѕ/Р±С‹СЃС‚СЂРѕРіРѕ РёРЅСЃСѓР»РёРЅР° РїРѕРєСЂС‹РІР°РµС‚ ~10Рі СѓРіР»РµРІРѕРґРѕРІ. Р”РѕР·Р° Г— 10 = РЅРµРѕР±С…РѕРґРёРјС‹Рµ СѓРіР»РµРІРѕРґС‹.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>рџҐ‘ Р–РёСЂС‹ РњРРќРРњРЈРњ:</strong> РІ РѕРєРЅРµ 90 РјРёРЅСѓС‚ РїРѕСЃР»Рµ РёРЅСЉРµРєС†РёРё вЂ” РЅРµ Р±РѕР»РµРµ 5Рі Р¶РёСЂРѕРІ. Р–РёСЂС‹ Р·Р°РјРµРґР»СЏСЋС‚ РѕРїРѕСЂРѕР¶РЅРµРЅРёРµ Р¶РµР»СѓРґРєР°, РІС‹Р·С‹РІР°СЏ РіРёРїРѕРіР»РёРєРµРјРёСЋ РїСЂРё СѓР¶Рµ РїСЂРёРЅСЏС‚С‹С… СѓРіР»РµРІРѕРґР°С….
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>рџљ« РџР РћРџРЈРЎРљ Р•Р”Р« РљР РРўРР§Р•Рќ:</strong> РіРёРїРѕРіР»РёРєРµРјРёСЏ СЂР°Р·РІРёРІР°РµС‚СЃСЏ Р·Р° 15-30 РјРёРЅСѓС‚. РљР°Р¶РґС‹Р№ С‡Р°СЃ РїРѕСЃР»Рµ СѓРєРѕР»Р° вЂ” РјРёРЅРёРјСѓРј 10-15Рі СѓРіР»РµРІРѕРґРѕРІ.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>рџ©ё Р“Р»СЋРєРѕРјРµС‚СЂ:</strong> Р·Р°РјРµСЂС‹ С‡РµСЂРµР· 15, 30, 60, 90, 120 РјРёРЅ. Р¦РµР»СЊ вЂ” РЅРµ РЅРёР¶Рµ 4.0 РјРјРѕР»СЊ/Р». РџСЂРё &lt;3.5 вЂ” 15-20Рі Р±С‹СЃС‚СЂС‹С… СѓРіР»РµРІРѕРґРѕРІ.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>рџЏ‹пёЏ РўСЂРµРЅРёСЂРѕРІРєР° + РёРЅСЃСѓР»РёРЅ:</strong> РїСЂРµРґС‚СЂРµРЅ вЂ” РёР·РѕР»СЏС‚ (40-50Рі) + Р°РјРёР»РѕРїРµРєС‚РёРЅ (80-100Рі). РџРѕСЃС‚-С‚СЂРµРЅ вЂ” РёР·РѕР»СЏС‚ + РґРµРєСЃС‚СЂРѕР·Р° (10Рі/1Р•Р”). РќР° С‚СЂРµРЅРёСЂРѕРІРєРµ РёР·РѕС‚РѕРЅРёРє РєР°Р¶РґС‹Рµ 20 РјРёРЅ.
            </div>
            <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
              <strong style={{ color:'#ef4444' }}>рџ›‘ РќРµ РЅР° РЅРѕС‡СЊ:</strong> РєРѕСЂРѕС‚РєРёР№ РёРЅСЃСѓР»РёРЅ РїРѕСЃР»Рµ 18:00 вЂ” СЂРёСЃРє РЅРѕС‡РЅРѕР№ РіРёРїРѕРіР»РёРєРµРјРёРё. Р”Р»РёРЅРЅС‹Р№ (Р›Р°РЅС‚СѓСЃ/Р›РµРІРµРјРёСЂ) вЂ” Р±Р°Р·Р°Р»СЊРЅС‹Р№, РјРѕР¶РЅРѕ.
            </div>
          </div>
        </GlassCard>
      )}

      {generated && waterCalc && (
        <GlassCard title="Р’РѕРґРЅС‹Р№ Р±Р°Р»Р°РЅСЃ" icon="рџ’§" color="#06b6d4" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
              <span>Р‘Р°Р·Р°: {waterCalc.hasPharma ? (waterCalc.pharmaBaseMl || 40) : '30'} РјР» Г— {weight} РєРі</span>
              <span>{waterCalc.baseWater} Р»</span>
            </div>
            {waterCalc.hasPharma && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
                <span>+ Р¤Р°СЂРјР°РєРѕР»РѕРіРёСЏ (РїРѕРІС‹С€РµРЅРЅС‹Р№ РјРµС‚Р°Р±РѕР»РёР·Рј)</span>
                <span>+{waterCalc.pharmaBonus.toFixed(1)} Р»</span>
              </div>
            )}
            {waterCalc.trainBonus > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
                <span>+ РўСЂРµРЅРёСЂРѕРІРєР°</span>
                <span>+{waterCalc.trainBonus} Р»</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>
              <span>+ РљР»РµС‚С‡Р°С‚РєР°</span>
              <span>+{waterCalc.fiberFactor} Р»</span>
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#06b6d4', textAlign: 'center', marginTop: 6 }}>
            {waterCalc.total} Р»/РґРµРЅСЊ
          </div>
        </GlassCard>
      )}

      {generated && healthIssues.length > 0 && (
        <GlassCard title="рџ©є Р—РґРѕСЂРѕРІСЊРµ вЂ” Р°РєС‚РёРІРЅС‹Рµ РѕРіСЂР°РЅРёС‡РµРЅРёСЏ" icon="" color="#06b6d4" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          {HEALTH_ISSUES.filter(h => healthIssues.includes(h.id)).map(h => (
            <div key={h.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', marginBottom:4, borderRadius:10, background:'rgba(6,182,212,0.06)', border:'1px solid rgba(6,182,212,0.1)' }}>
              <div style={{ fontSize:16, width:28, textAlign:'center' }}>{h.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#06b6d4' }}>{h.label}</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{h.desc} вЂ” РёСЃРєР»СЋС‡РµРЅРѕ {h.foodIds.length} РїСЂРѕРґСѓРєС‚РѕРІ</div>
              </div>
              <div style={{ fontSize:8, color:'rgba(6,182,212,0.6)', background:'rgba(6,182,212,0.1)', padding:'2px 6px', borderRadius:6 }}>{h.foodIds.length}</div>
            </div>
          ))}
        </GlassCard>
      )}

      {generated && (
        <GlassCard title="РћС‚С‡С‘С‚С‹ РїРѕ СЂР°С†РёРѕРЅСѓ" icon="рџ“Љ" color="#3b82f6" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
            <button onClick={generateAllergenReport} style={reportPillStyle('#ef4444', activeReports.includes('allergen') && !!allergenReport)}>вљ пёЏ РђР»Р»РµСЂРіРµРЅС‹</button>
            <button onClick={generateNutrientReport} style={reportPillStyle('#22c55e', activeReports.includes('nutrient') && !!nutrientReport)}>рџ§¬ РќСѓС‚СЂРёРµРЅС‚С‹</button>
            <button onClick={generateQualityReport} style={reportPillStyle('#f59e0b', activeReports.includes('quality') && !!qualityReport)}>в­ђ РљР°С‡РµСЃС‚РІРѕ</button>
            <button onClick={generateRiskReport} style={reportPillStyle('#ef4444', activeReports.includes('risk') && !!riskReport)}>рџ©є Р РёСЃРєРё Р·РґРѕСЂРѕРІСЊСЏ</button>
            {injections.length > 0 && <button onClick={generateDrugCompatReport} style={reportPillStyle('#8b5cf6', activeReports.includes('drug') && !!drugCompatReport)}>рџ’‰ РЎРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ</button>}
            <button onClick={generateFullNutritionReport} style={reportPillStyle('#3b82f6', activeReports.includes('nutrition') && !!nutritionReport)}>рџ“‹ РџРѕР»РЅС‹Р№ РѕС‚С‡С‘С‚</button>
            <button onClick={() => {
              generateAllergenReport();
              generateNutrientReport();
              generateQualityReport();
              generateRiskReport();
              if (injections.length > 0) generateDrugCompatReport();
              generateRecommendations();
            }} style={reportPillStyle('#3b82f6', activeReports.length >= 3)}>рџ“‹ РћР±С‰РёР№ РѕС‚С‡С‘С‚</button>
          </div>
          {allergenReport && activeReports.includes('allergen') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: allergenReport.riskLevel === 'high' ? 'rgba(239,68,68,0.06)' : allergenReport.riskLevel === 'medium' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)', border: `1px solid ${allergenReport.riskLevel === 'high' ? '#ef4444' : allergenReport.riskLevel === 'medium' ? '#f59e0b' : '#22c55e'}20` }}>
              <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3, color: allergenReport.riskLevel === 'high' ? '#ef4444' : allergenReport.riskLevel === 'medium' ? '#f59e0b' : '#22c55e' }}>
                {allergenReport.summary}
              </div>
              {allergenReport.conflicts.map((c: any, i: number) => (
                <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', padding: '1px 0' }}>
                  вЂў {c.food}: {c.allergens.join(', ')}
                </div>
              ))}
            </div>
          )}
          {nutrientReport && activeReports.includes('nutrient') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>рџ§¬ РњРёРєСЂРѕРЅСѓС‚СЂРёРµРЅС‚С‹</div>
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
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: qualityReport.budgetOk ? '#22c55e' : '#f59e0b' }}>
                  в­ђ РљР°С‡РµСЃС‚РІРѕ: {qualityReport.avgScore}/10
                </div>
                <div style={{ fontSize:7, padding:'1px 5px', borderRadius:4, background: qualityReport.budgetOk ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: qualityReport.budgetOk ? '#22c55e' : '#f59e0b' }}>
                  {qualityReport.budgetRange} В· bb_quality {qualityReport.bbsAvg}
                </div>
              </div>
              {qualityReport.bestItems.length > 0 && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>Р›СѓС‡С€РёРµ: {qualityReport.bestItems.join(', ')}</div>}
              {qualityReport.weakItems.length > 0 && <div style={{ fontSize: 8, color: '#ef4444' }}>РЎР»Р°Р±С‹Рµ: {qualityReport.weakItems.join(', ')}</div>}
              {qualityReport.recommendations.map((r: string, i: number) => <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', padding: '1px 0' }}>вЂў {r}</div>)}
            </div>
          )}
          {riskReport && activeReports.includes('risk') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3, color: riskReport.totalRisk === 'РќРёР·РєРёР№' ? '#22c55e' : riskReport.totalRisk === 'РЎСЂРµРґРЅРёР№' ? '#f59e0b' : '#ef4444' }}>
                рџ©є РћР±С‰РёР№ СЂРёСЃРє: {riskReport.totalRisk}
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{riskReport.summary}</div>
              {Object.entries(riskReport.systems).map(([sys, data]: [string, any]) => (
                <div key={sys} style={{ fontSize: 8, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: data.score >= 5 ? '#ef4444' : data.score >= 3 ? '#f59e0b' : '#22c55e' }}>
                      {sys === 'hepatic' ? 'РџРµС‡РµРЅСЊ' : sys === 'renal' ? 'РџРѕС‡РєРё' : sys === 'inflammatory' ? 'Р’РѕСЃРїР°Р»РµРЅРёРµ' : sys === 'insulin' ? 'РРЅСЃСѓР»РёРЅ' : 'Р­Р»РµРєС‚СЂРѕР»РёС‚С‹'}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.85)' }}>вљ  {data.score}/7</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.85)' }}>{data.impact}</div>
                  {data.score >= 3 && <div style={{ color: '#f59e0b' }}>в†’ {data.recommendation}</div>}
                </div>
              ))}
            </div>
          )}
          {dayPlan && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', marginBottom: 3 }}>рџЌ¬ Р“Р»РёРєРµРјРёС‡РµСЃРєР°СЏ РЅР°РіСЂСѓР·РєР°</div>
              {(() => {
                const totalCarbs = dayPlan.totals?.c || 0;
                const avgGI = planType === 'keto' ? 30 : planType === 'highcarb' ? 65 : 55;
                const gl = Math.round(totalCarbs * avgGI / 100);
                const glPerMeal = dayPlan.meals?.length > 0 ? Math.round(gl / dayPlan.meals.length) : 0;
                const glLabel = gl <= 80 ? 'РќРёР·РєР°СЏ' : gl <= 120 ? 'РЎСЂРµРґРЅСЏСЏ' : 'Р’С‹СЃРѕРєР°СЏ';
                const glColor = gl <= 80 ? '#22c55e' : gl <= 120 ? '#f59e0b' : '#ef4444';
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>РћР±С‰РёР№ Р“Рќ (СЂР°СЃС‡С‘С‚РЅС‹Р№):</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: glColor }}>{gl} <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>({glLabel})</span></span>
                    </div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>
                      РЎСЂРµРґРЅРёР№ Р“Р СЂР°С†РёРѕРЅР°: ~{avgGI} В· Р“Рќ РЅР° РїСЂРёС‘Рј: ~{glPerMeal} В· РЈРіР»РµРІРѕРґС‹: {Math.round(totalCarbs)}Рі
                    </div>
                    {gl > 120 && <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 2 }}>рџ’Ў Р’С‹СЃРѕРєР°СЏ РЅР°РіСЂСѓР·РєР° вЂ” СЂРµРєРѕРјРµРЅРґСѓРµС‚СЃСЏ СѓРІРµР»РёС‡РёС‚СЊ РґРѕР»СЋ РЅРёР·РєРѕ-Р“Р РїСЂРѕРґСѓРєС‚РѕРІ (Р±РѕР±РѕРІС‹Рµ, С†РµР»СЊРЅРѕР·РµСЂРЅРѕРІС‹Рµ, РѕРІРѕС‰Рё)</div>}
                  </div>
                );
              })()}
            </div>
          )}
          {drugCompatReport && activeReports.includes('drug') && (
            <div style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#8b5cf6', marginBottom: 4 }}>рџ’‰ РЎРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ СЃ РїСЂРµРїР°СЂР°С‚Р°РјРё</div>
              {drugCompatReport.interactions.map((int: any, i: number) => (
                <div key={i} style={{ fontSize: 8, padding: '2px 0', color: int.severity === 'high' ? '#ef4444' : '#f59e0b' }}>
                  вЂў {int.drug} + {int.food}: {int.effect}
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
                <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6' }}>рџ“‹ РџРѕР»РЅС‹Р№ РѕС‚С‡С‘С‚ Рѕ РїРёС‚Р°РЅРёРё</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: nutritionReport.overallGrade === 'A' ? '#22c55e' : nutritionReport.overallGrade === 'B' ? '#8b5cf6' : nutritionReport.overallGrade === 'C' ? '#f59e0b' : '#ef4444' }}>{nutritionReport.overallGrade}</span>
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 3 }}>{nutritionReport.overallGradeLabel}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 3, marginBottom: 4 }}>
                {[{l:'РљРєР°Р»',v:nutritionReport.kbjuPct.kcal},{l:'Р‘РµР»РєРё',v:nutritionReport.kbjuPct.p},{l:'Р–РёСЂС‹',v:nutritionReport.kbjuPct.f},{l:'РЈРіР».',v:nutritionReport.kbjuPct.c}].map((s: any) => (
                  <div key={s.l} style={{ background:'rgba(0,0,0,0.2)', borderRadius:4, padding:'3px', textAlign:'center' }}>
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.7)' }}>{s.l}</div>
                    <div style={{ fontSize:11, fontWeight:700, color: s.v >= 85 && s.v <= 115 ? '#22c55e' : s.v >= 70 ? '#f59e0b' : '#ef4444' }}>{s.v}%</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <div style={{ flex: 1, background: 'rgba(59,130,246,0.06)', borderRadius: 4, padding: '3px 5px' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)' }}>Р’РµСЃ/РЅРµРґ</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: nutritionReport.weightDynamicsBasic.direction === 'loss' ? '#22c55e' : nutritionReport.weightDynamicsBasic.direction === 'gain' ? '#f59e0b' : '#fff' }}>
                    {nutritionReport.weightDynamicsBasic.direction === 'loss' ? 'в€’' : nutritionReport.weightDynamicsBasic.direction === 'gain' ? '+' : 'в€ј'}{nutritionReport.weightDynamicsBasic.weeklyKg} РєРі
                  </div>
                </div>
                <div style={{ flex: 1, background: 'rgba(139,92,246,0.06)', borderRadius: 4, padding: '3px 5px' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)' }}>РљР°С‡РµСЃС‚РІРѕ</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: nutritionReport.foodQualityScore >= 7 ? '#22c55e' : '#f59e0b' }}>{nutritionReport.foodQualityScore}/10</div>
                </div>
              </div>
              {nutritionReport.microDeficiencies.length > 0 && <div style={{ fontSize: 7, color: '#f59e0b', marginBottom: 2 }}>вљ  {nutritionReport.microDeficiencies.length} РґРµС„РёС†РёС‚РѕРІ: {nutritionReport.microDeficiencies.slice(0, 3).join('; ')}</div>}
              {nutritionReport.recommendations.length > 0 && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>рџ’Ў {nutritionReport.recommendations.slice(0, 2).join(' вЂў ')}</div>}
            </div>
          )}
        </GlassCard>
      )}

      <div style={{ marginTop:4, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ fontSize:9, fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:2 }}>вљЎ РЎРїРµС†РёР°Р»СЊРЅС‹Рµ СЂРµР¶РёРјС‹</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateCheatMeal()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', color:'#f59e0b', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              рџЌ” Р§РёС‚РјРёР»
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>РћРґРёРЅ РїСЂРёС‘Рј РїРёС‰Рё СЃ РїРѕРІС‹С€РµРЅРЅРѕР№ РєР°Р»РѕСЂРёР№РЅРѕСЃС‚СЊСЋ</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateCarbload()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)', color:'#f97316', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              рџЌљ РЈРіР»РµРІ. Р·Р°РіСЂСѓР·РєР°
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>РџРѕРІС‹С€РµРЅРёРµ СѓРіР»РµРІРѕРґРѕРІ РЅР° 1-2 РґРЅСЏ</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateBUTCH()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)', color:'#3b82f6', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              в¤ґпёЏв¤µпёЏ Р‘РЈР§
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>Р‘РµР»РєРѕРІРѕ-СѓРіР»РµРІРѕРґРЅРѕРµ С‡РµСЂРµРґРѕРІР°РЅРёРµ</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateCravingPlan()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background: cravingMode ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)', border: cravingMode ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)', color: cravingMode ? '#ef4444' : 'rgba(255,255,255,0.8)', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              рџЌ¬ РҐРѕС‡Сѓ СЃР»Р°РґРєРѕРµ
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>РЎР»Р°РґРєРёР№ РїРµСЂРµРєСѓСЃ РЅР° {cravingDays} {cravingDays === 1 ? 'РґРµРЅСЊ' : 'РґРЅСЏ'}</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => generateLazyDayPlan()} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background: lazyDayMode ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)', border: lazyDayMode ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)', color: lazyDayMode ? '#f59e0b' : 'rgba(255,255,255,0.8)', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              рџґ Р›РµРЅРёРІС‹Р№ РґРµРЅСЊ
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>РњРёРЅРёРјСѓРј РіРѕС‚РѕРІРєРё, {lazyDayDays} {lazyDayDays === 1 ? 'РґРµРЅСЊ' : 'РґРЅРµР№'}</div>
          </div>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={() => setSpecialMealMode(!specialMealMode)} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background: specialMealMode ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.02)', border: specialMealMode ? '1px solid rgba(249,115,22,0.2)' : '1px solid rgba(255,255,255,0.06)', color: specialMealMode ? '#f97316' : 'rgba(255,255,255,0.8)', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              рџЌЅпёЏ РЎРїРµС†РїСЂРёС‘Рј
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>РџСЂРёС‘Рј СЃ Р·Р°РґР°РЅРЅС‹РјРё РјР°РєСЂРѕСЃР°РјРё</div>
          </div>
        </div>
      </div>

      {cravingPlan && (
        <GlassCard title="РҐРѕС‡Сѓ СЃР»Р°РґРєРѕРµ" icon="рџЌ¬" color="#ef4444" style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>~{cravingPlan.kcal} РєРєР°Р» ({cravingPlan.days} {cravingPlan.days === 1 ? 'РґРµРЅСЊ' : 'РґРЅСЏ'})</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Р‘РµР»РєРё</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{cravingPlan.bju.p}Рі</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Р–РёСЂС‹</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{cravingPlan.bju.f}Рі</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>РЈРіР»РµРІРѕРґС‹</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>{cravingPlan.bju.c}Рі</div>
            </div>
          </div>
          {cravingPlan.items.map((it: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>вЂў {it.name || it}</span>
              <span onClick={() => addToCart({ name: it.name || it, kcal: it.kcal || 100, amount: 100 })} style={{ cursor:'pointer', fontSize:8, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="Р’ РєРѕСЂР·РёРЅСѓ">рџ›’</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#ef4444', marginTop: 6, marginBottom: 4 }}>рџ“‹ РћСЃРЅРѕРІРЅС‹Рµ РїСЂРёРЅС†РёРїС‹:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
            {cravingPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#ef4444', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)' }}>{cravingPlan.recommendation}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)' }}>{cravingPlan.note}</div>
        </GlassCard>
      )}

      {lazyDayPlan && (
        <GlassCard title="Р›РµРЅРёРІС‹Р№ РґРµРЅСЊ" icon="рџґ" color="#f59e0b" style={{ border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>~{lazyDayPlan.kcal} РєРєР°Р» (85% РѕС‚ РЅРѕСЂРјС‹, {lazyDayPlan.days} {lazyDayPlan.days === 1 ? 'РґРµРЅСЊ' : 'РґРЅРµР№'})</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Р‘РµР»РєРё</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{lazyDayPlan.bju.p}Рі</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Р–РёСЂС‹</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{lazyDayPlan.bju.f}Рі</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>РЈРіР»РµРІРѕРґС‹</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{lazyDayPlan.bju.c}Рі</div>
            </div>
          </div>
          {lazyDayPlan.items.map((it: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>вЂў {it.name || it}</span>
              <span onClick={() => addToCart({ name: it.name || it, kcal: it.kcal || 100, amount: 100 })} style={{ cursor:'pointer', fontSize:8, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="Р’ РєРѕСЂР·РёРЅСѓ">рџ›’</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#f59e0b', marginTop: 6, marginBottom: 4 }}>рџ“‹ РћСЃРЅРѕРІРЅС‹Рµ РїСЂРёРЅС†РёРїС‹:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
            {lazyDayPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{lazyDayPlan.recommendation}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{lazyDayPlan.note}</div>
        </GlassCard>
      )}

      {cheatMealPlan && (
        <GlassCard title="Р§РёС‚РјРёР»" icon="рџЌ”" color="#f59e0b" style={{ border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>~{cheatMealPlan.cals} РєРєР°Р» (35% РѕС‚ РЅРѕСЂРјС‹)</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Р‘РµР»РєРё</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{cheatMealPlan.bju.p}Рі</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Р–РёСЂС‹</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{cheatMealPlan.bju.f}Рі</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>РЈРіР»РµРІРѕРґС‹</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316' }}>{cheatMealPlan.bju.c}Рі</div>
            </div>
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginBottom: 6, textAlign: 'center' }}>{cheatMealPlan.bjuBreakdown}</div>
          {cheatMealPlan.items.map((it: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>вЂў {it.name || it}</span>
              <span onClick={() => addToCart({ name: it.name || it, kcal: it.kcal || (cheatMealPlan.cals / cheatMealPlan.items.length), amount: 100 })} style={{ cursor:'pointer', fontSize:8, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="Р’ РєРѕСЂР·РёРЅСѓ">рџ›’</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#f59e0b', marginTop: 6, marginBottom: 4 }}>рџ“‹ РћСЃРЅРѕРІРЅС‹Рµ РїСЂРёРЅС†РёРїС‹:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
            {cheatMealPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
          <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{cheatMealPlan.recommendation}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)' }}>{cheatMealPlan.note}</div>
        </GlassCard>
      )}

      {carbloadPlan && (
        <GlassCard title="РЈРіР»РµРІРѕРґРЅР°СЏ Р·Р°РіСЂСѓР·РєР°" icon="рџЌљ" color="#f97316" style={{ border: '1px solid rgba(249,115,22,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316', marginBottom: 4 }}>Р’СЃРµРіРѕ: {carbloadPlan.totalCarbs} Рі ({Math.round(carbloadPlan.totalCarbs / weight)} Рі/РєРі)</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Р‘РµР»РєРё</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>{carbloadPlan.bju.p}Рі</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Р–РёСЂС‹</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{carbloadPlan.bju.f}Рі</div>
            </div>
            <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>РЈРіР»РµРІРѕРґС‹</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316' }}>{carbloadPlan.bju.c}Рі</div>
            </div>
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', marginBottom: 6, textAlign: 'center' }}>~{carbloadPlan.bju.kcal} РєРєР°Р» РІСЃРµРіРѕ</div>
          {carbloadPlan.foods.map((f: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize: 9, padding: '4px 0', alignItems:'center', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#fff' }}>вЂў {f.name || f}</span>
              <span onClick={() => addToCart({ name: f.name || f, kcal: f.kcal || 100, amount: 100 })} style={{ cursor:'pointer', fontSize:8, color:'#00e68a', opacity:0.5, padding:'2px 4px' }} title="Р’ РєРѕСЂР·РёРЅСѓ">рџ›’</span>
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 600, color: '#f97316', marginTop: 6, marginBottom: 4 }}>рџ“‹ РћСЃРЅРѕРІРЅС‹Рµ РїСЂРёРЅС†РёРїС‹:</div>
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
            return { id: pk.id, name: food?.name || pk.id, amount: pk.g + 'Рі' };
          });
        };
        const suggested = suggestFoods();
        return (
        <div style={{ borderRadius: 12, padding: 12, background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.15)', marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>рџЌЅпёЏ РЎРїРµС†РїСЂРёС‘Рј{specialMealReplaceMode ? ` (Р·Р°РјРµРЅР°: ${specialMealReplaceTarget})` : ' (РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ)'}</span>
            <span onClick={() => setSpecialMealMode(false)} style={{ cursor: 'pointer', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>вњ•</span>
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>
            {specialMealGoal === 'pre_workout' ? 'рџЏ‹пёЏ РџСЂРµРґС‚СЂРµРЅРёСЂРѕРІРѕС‡РЅС‹Р№ РїСЂРёС‘Рј' :
             specialMealGoal === 'post_workout' ? 'рџ’Є РџРѕСЃР»РµС‚СЂРµРЅРёСЂРѕРІРѕС‡РЅС‹Р№ РїСЂРёС‘Рј' :
             specialMealGoal === 'before_bed' ? 'рџЊ™ РџСЂРёС‘Рј РЅР° РЅРѕС‡СЊ (РјРµРґР»РµРЅРЅС‹Р№ Р±РµР»РѕРє)' :
             specialMealGoal === 'high_protein' ? 'рџҐ© Р’С‹СЃРѕРєРѕР±РµР»РєРѕРІС‹Р№ РїСЂРёС‘Рј' :
             specialMealGoal === 'keto' ? 'рџҐ‘ РљРµС‚Рѕ-РїСЂРёС‘Рј' :
             specialMealGoal === 'low_cal_day' ? 'рџ“‰ РќРёР·РєРѕРєР°Р»РѕСЂРёР№РЅС‹Р№ РїСЂРёС‘Рј' : 'вљ™пёЏ РЎРІРѕР№ РїСЂРёС‘Рј'}
            В· {specialMealTiming === 'breakfast' ? 'рџЊ… Р—Р°РІС‚СЂР°Рє' : specialMealTiming === 'lunch' ? 'вЂпёЏ РћР±РµРґ' : specialMealTiming === 'dinner' ? 'рџЊ† РЈР¶РёРЅ' : specialMealTiming === 'snack' ? 'рџЌЄ РџРµСЂРµРєСѓСЃ' : 'рџЊ™ РџРµСЂРµРґ СЃРЅРѕРј'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>рџҐ© Р‘РµР»РѕРє</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>{p}Рі</div>
            </div>
            <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>рџ§€ Р–РёСЂС‹</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{f}Рі</div>
            </div>
            <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>рџЌљ РЈРіР»РµРІРѕРґС‹</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>{c}Рі</div>
            </div>
            <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(249,115,22,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>рџ”Ґ РљРєР°Р»</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>{kcal}</div>
            </div>
          </div>
          {suggested.length > 0 && (
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.1)' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>рџЌЅпёЏ Р РµРєРѕРјРµРЅРґСѓРµРјС‹Рµ РїСЂРѕРґСѓРєС‚С‹:</div>
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
        <GlassCard title="Р‘РЈР§ (Р±РµР»РєРѕРІРѕ-СѓРіР»РµРІРѕРґРЅРѕРµ С‡РµСЂРµРґРѕРІР°РЅРёРµ)" icon="в¤ґпёЏв¤µпёЏ" color="#3b82f6" style={{ border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ padding: '10px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>рџ“‹ {butchPlan.pattern}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: '#22c55e', fontWeight: 600 }}>Р’РЈ (С‚СЂРµРЅРёСЂРѕРІРєР°)</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#22c55e' }}>{butchPlan.highCarb}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Рі СѓРіР»РµРІРѕРґРѕРІ</div>
                <div style={{ fontSize: 7, color: '#3b82f6', marginTop: 2 }}>в†‘ Р±РµР»РѕРє {butchPlan.protein}Рі</div>
                <div style={{ fontSize: 7, color: '#f59e0b' }}>в†“ Р¶РёСЂС‹ {butchPlan.fatHigh}Рі</div>
              </div>
              <div style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600 }}>РќРЈ (РѕС‚РґС‹С…)</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#ef4444' }}>{butchPlan.lowCarb}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Рі СѓРіР»РµРІРѕРґРѕРІ</div>
                <div style={{ fontSize: 7, color: '#3b82f6', marginTop: 2 }}>в†‘ Р±РµР»РѕРє {butchPlan.protein}Рі</div>
                <div style={{ fontSize: 7, color: '#f59e0b' }}>в†‘ Р¶РёСЂС‹ {butchPlan.fatLow}Рі</div>
              </div>
            </div>
            <div style={{ fontSize: 8, color: '#22c55e', textAlign: 'center', marginBottom: 4 }}>
              Р’РЈ: {butchPlan.bjuHigh.kcal} РєРєР°Р» В· РќРЈ: {butchPlan.bjuLow.kcal} РєРєР°Р»
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#3b82f6', marginTop: 6, marginBottom: 4 }}>рџ“‹ РћСЃРЅРѕРІРЅС‹Рµ РїСЂРёРЅС†РёРїС‹:</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 4 }}>
              {butchPlan.principles.map((p: string, i: number) => <div key={i}>{p}</div>)}
            </div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.06)' }}>{butchPlan.note}</div>
          </div>
        </GlassCard>
      )}

      <div style={{ marginTop:4, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ fontSize:9, fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:2 }}>рџЋЇ Р Р°СЃС€РёСЂРµРЅРЅС‹Рµ РёРЅСЃС‚СЂСѓРјРµРЅС‚С‹</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
          <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(255,255,255,0.04)', padding:'8px 6px', textAlign:'center' }}>
            <button onClick={generateRecommendations} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.2)', color:'#a855f7', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
              рџ’Ў Р’С‹РґР°С‚СЊ СЂРµРєРѕРјРµРЅРґР°С†РёРё
            </button>
            <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>РџРµСЂСЃРѕРЅР°Р»СЊРЅС‹Рµ СЃРѕРІРµС‚С‹ РїРѕ РїРёС‚Р°РЅРёСЋ</div>
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
                    {n === 1 ? '1 РґРµРЅСЊ' : n === 3 ? '3 РґРЅСЏ' : 'РќРµРґРµР»СЏ'}
                  </button>
                ))}
              </div>
              <button onClick={generateMealPrep} style={{ width:'100%', padding:'10px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'rgba(6,182,212,0.08)', border:'1px solid rgba(6,182,212,0.2)', color:'#06b6d4', fontWeight:700, fontSize:10, transition:'all 0.15s' }}>
                рџ‘ЁвЂЌрџЌі Meal Prep
              </button>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>РџР»Р°РЅ РїСЂРёРіРѕС‚РѕРІР»РµРЅРёСЏ РЅР° РЅРµСЃРєРѕР»СЊРєРѕ РґРЅРµР№</div>
            </div>
          )}
          {generated && (
            <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(0,230,138,0.05)', padding:'8px 6px', textAlign:'center' }}>
              <button onClick={() => { setShowCalcPopup(true); setCalcResults(null); setCalcDailyReport(null); }} style={{ width:'100%', padding:'12px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'linear-gradient(135deg,rgba(0,230,138,0.12),rgba(0,200,160,0.12))', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', fontWeight:800, fontSize:11, transition:'all 0.15s' }}>
                рџ§¬ Р Р°СЃСЃС‡РёС‚Р°С‚СЊ РїРѕР»РµР·РЅРѕСЃС‚СЊ
              </button>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>v2 СЃРєРѕСЂРёРЅРі РІС‹Р±СЂР°РЅРЅС‹С… РїСЂРёС‘РјРѕРІ + СЃРїРµС†РїСЂРёС‘РјРѕРІ</div>
            </div>
          )}
          {generated && (
            <div style={{ background:'rgba(24,24,27,0.5)', borderRadius:12, border:'1px solid rgba(249,115,22,0.05)', padding:'8px 6px', textAlign:'center' }}>
              <button onClick={() => { setShowCorrectPopup(true); analyzePlanIssues(); }} style={{ width:'100%', padding:'12px 6px', borderRadius:10, cursor:'pointer', textAlign:'center', background:'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(245,158,11,0.12))', border:'1px solid rgba(249,115,22,0.3)', color:'#f97316', fontWeight:800, fontSize:11, transition:'all 0.15s' }}>
                рџ”Ђ РљРѕСЂСЂРµРєС‚РёСЂРѕРІРєР° СЂР°С†РёРѕРЅР°
              </button>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginTop:4, lineHeight:1.2 }}>РђРЅР°Р»РёР· РЅРµРґРѕС‡С‘С‚РѕРІ + Р·Р°РјРµРЅР° РїСЂРѕРґСѓРєС‚РѕРІ + РїРµСЂРµРіРµРЅРµСЂР°С†РёСЏ</div>
            </div>
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <GlassCard title="Р РµРєРѕРјРµРЅРґР°С†РёРё" icon="рџ’Ў" color="#a855f7" style={{ border: '1px solid rgba(168,85,247,0.15)' }}>
          {recommendations.map((r: string, i: number) => (
            <div key={i} style={{ fontSize: 9, color: '#fff', padding: '4px 0', borderBottom: i < recommendations.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', lineHeight: 1.4 }}>
              вЂў {r}
            </div>
          ))}
        </GlassCard>
      )}

      {mealPrepPlan && (
        <GlassCard title="РџР»Р°РЅ РіРѕС‚РѕРІРєРё" icon="рџ‘ЁвЂЌрџЌі" color="#06b6d4" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#06b6d4', marginBottom: 6 }}>
            <span>вЏ± {mealPrepPlan.totalTime} РјРёРЅ</span>
            <span>рџ“¦ {mealPrepPlan.containers} РєРѕРЅС‚РµР№РЅРµСЂРѕРІ</span>
          </div>
          {mealPrepPlan.steps.map((st: any, i: number) => (
            <div key={i} style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#06b6d4' }}>РЁР°Рі {st.step}: {st.action}</span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>{st.duration} РјРёРЅ</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {st.items.map((item: string, j: number) => <span key={j} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.1)', color: 'rgba(255,255,255,0.85)' }}>{item}</span>)}
              </div>
            </div>
          ))}
          <button onClick={saveCurrentPlan} style={{ marginTop: 6, padding: '8px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.25)', background: 'rgba(6,182,212,0.06)', color: '#06b6d4', cursor: 'pointer', fontSize: 9, fontWeight: 600, width: '100%' }}>рџ’ѕ РЎРѕС…СЂР°РЅРёС‚СЊ РїР»Р°РЅ</button>
        </GlassCard>
      )}

      {savedPlans.length > 0 && (
        <GlassCard title="РЎРѕС…СЂР°РЅС‘РЅРЅС‹Рµ РїР»Р°РЅС‹" icon="рџ“‚" color="#8b5cf6">
          {savedPlans.slice(0, 10).map((p: any, pi: number) => {
            const isExpanded = p.id === (expandedSavedId as any);
            return (
              <div key={p.id} style={{ marginBottom: 6, borderRadius: 10, overflow: 'hidden', border: isExpanded ? '1px solid rgba(139,92,246,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', cursor: 'pointer', background: isExpanded ? 'rgba(139,92,246,0.04)' : '#202023' }}
                  onClick={() => setExpandedSavedId(isExpanded ? null : p.id)}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{p.name || p.date}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 8, color: '#00e68a', fontWeight: 600 }}>{p.dayPlan ? `${Math.round(p.dayPlan.totals.kcal)} РєРєР°Р»` : ''}</span>
                    <button onClick={(e) => { e.stopPropagation(); loadSavedPlan(p); }} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a', fontWeight: 600 }}>рџ“‹</button>
                    <button onClick={(e) => { e.stopPropagation(); const txt = `рџЌЅ РџР»Р°РЅ РїРёС‚Р°РЅРёСЏ ${p.name || p.date}\n${p.dayPlan?.meals?.map((m: any) => `${m.time} ${m.label}: ${m.items?.map((it: any) => `${it.name} ${it.amount}Рі`).join(', ')}`).join('\n') || ''}`; navigator.clipboard?.writeText(txt); }} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', fontWeight: 600 }}>рџ“¤</button>
                    <button onClick={(e) => { e.stopPropagation(); const updated = savedPlans.filter((_: any, j: number) => j !== pi); setSavedPlans(updated); localStorage.setItem('he_saved_nutrition_plans', JSON.stringify(updated)); }} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 7, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 600 }}>вњ•</button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: '6px 10px 8px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>
                    {p.dayPlan && (
                      <div>
                        <div style={{ fontWeight: 700, color: '#00e68a', marginBottom: 4, fontSize: 9 }}>рџЌЅ РџР»Р°РЅ РЅР° РґРµРЅСЊ: {Math.round(p.dayPlan.totals.kcal)} РєРєР°Р»</div>
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
                        <span style={{ color: '#f97316', fontWeight: 600 }}>рџ›’ {p.shoppingList.length} РїСЂРѕРґСѓРєС‚РѕРІ</span>
                      </div>
                    )}
                    {p.waterCalc && <div style={{ marginTop: 2, color: '#06b6d4', fontWeight: 600 }}>рџ’§ {p.waterCalc.total} Р»/РґРµРЅСЊ</div>}
                  </div>
                )}
              </div>
            );
          })}
        </GlassCard>
      )}

      {showCalcPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', background:'rgba(0,0,0,0.9)' }}
          onClick={() => { setShowCalcPopup(false); setCalcResults(null); setCalcDailyReport(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#18181b', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 12px 0' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#00e68a' }}>рџ§¬ РљР°Р»СЊРєСѓР»СЏС‚РѕСЂ РїРѕР»РµР·РЅРѕСЃС‚Рё</div>
              <span onClick={() => { setShowCalcPopup(false); setCalcResults(null); setCalcDailyReport(null); }} style={{ cursor:'pointer', fontSize:10, color:'rgba(255,255,255,0.6)', padding:'2px 6px' }}>вњ•</span>
            </div>
            <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'0 12px 80px' }}>

            {/* Tabs */}
            <div style={{ display:'flex', gap:4, marginBottom:10 }}>
              {['day','week','month'].map(t => (
                <button key={t} onClick={() => setCalcTab(t as any)} style={{
                  flex:1, padding:'8px', borderRadius:10, cursor:'pointer', textAlign:'center', fontSize:9, fontWeight:700,
                  background: calcTab === t ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)',
                  border: calcTab === t ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
                  color: calcTab === t ? '#00e68a' : 'rgba(255,255,255,0.7)',
                }}>{t === 'day' ? 'рџ“… Р”РµРЅСЊ' : t === 'week' ? 'рџ“† РќРµРґРµР»СЏ' : 'рџ—“ РњРµСЃСЏС†'}</button>
              ))}
            </div>

            {/* Day view */}
            {calcTab === 'day' && (
              <>
                {planDays !== 1 ? (
                  <div style={{ textAlign:'center', padding:16, fontSize:9, color:'rgba(255,255,255,0.75)' }}>Р’С‹Р±РµСЂРёС‚Рµ РґРµРЅСЊ (РЅР°Р¶РјРёС‚Рµ РЅР° РґРµРЅСЊ РЅРµРґРµР»Рё СЃРІРµСЂС…Сѓ) Рё СЃРіРµРЅРµСЂРёСЂСѓР№С‚Рµ РїР»Р°РЅ РЅР° 1 РґРµРЅСЊ</div>
                ) : dayPlan ? (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:4, display:'flex', justifyContent:'space-between' }}>
                      <span>рџЌЅ РџСЂРёС‘РјС‹ РїРёС‰Рё</span>
                      <span onClick={() => { const all: string[] = dayPlan.meals.map((_: any, i: number) => `meal_${i}`); const next = new Set(calcSelections); all.forEach((id: string) => next.add(id)); setCalcSelections(next); }} style={{ cursor:'pointer', fontSize:7, color:'#00e68a', fontWeight:600 }}>Р’С‹Р±СЂР°С‚СЊ РІСЃРµ</span>
                    </div>
                    {dayPlan.meals.map((m: any, i: number) => {
                      const id = `meal_${i}`;
                      const sel = calcSelections.has(id);
                      return (
                        <div key={id} onClick={() => toggleCalcSelection(id)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 9px', borderRadius:8, marginBottom:3, background: sel ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)', border: sel ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
                          <div style={{ width:20, height:20, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', background: sel ? '#00e68a' : 'rgba(255,255,255,0.06)', color: sel ? '#000' : 'transparent', fontSize:11, fontWeight:800, border: sel ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>{sel ? 'вњ“' : ''}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:9, fontWeight:600, color:'#fff' }}>{m.label || `РџСЂРёС‘Рј ${i+1}`} {m.time && <span style={{ color:'rgba(255,255,255,0.6)', fontWeight:400, marginLeft:3 }}>{m.time}</span>}</div>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)' }}>{Math.round(m.totals?.kcal || 0)} РєРєР°Р» В· Р‘{m.totals?.p||0}/Р–{m.totals?.f||0}/РЈ{m.totals?.c||0} В· {m.items?.length || 0} РїСЂРѕРґСѓРєС‚РѕРІ</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign:'center', padding:16, fontSize:9, color:'rgba(255,255,255,0.75)' }}>РЎРЅР°С‡Р°Р»Р° СЃРіРµРЅРµСЂРёСЂСѓР№С‚Рµ РїР»Р°РЅ РїРёС‚Р°РЅРёСЏ</div>
                )}

                {/* Special meals */}
                {(cheatMealPlan || carbloadPlan || lazyDayPlan || cravingPlan) && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:4 }}>вљЎ РЎРїРµС†РїСЂРёС‘РјС‹</div>
                    {[
                      { id:'special_cheatmeal', label:'рџЌ” Р§РёС‚РјРёР»', desc: cheatMealPlan ? `~${cheatMealPlan.cals} РєРєР°Р»` : '', plan: cheatMealPlan },
                      { id:'special_carbload', label:'рџЌљ РЈРіР»РµРІ. Р·Р°РіСЂСѓР·РєР°', desc: carbloadPlan ? `${carbloadPlan.totalCarbs}Рі СѓРіР»РµР№` : '', plan: carbloadPlan },
                      { id:'special_lazy', label:'рџґ Р›РµРЅРёРІС‹Р№ РґРµРЅСЊ', desc: lazyDayPlan ? `~${lazyDayPlan.kcal} РєРєР°Р»` : '', plan: lazyDayPlan },
                      { id:'special_craving', label:'рџЌ¬ РҐРѕС‡Сѓ СЃР»Р°РґРєРѕРµ', desc: cravingPlan ? `~${cravingPlan.kcal} РєРєР°Р»` : '', plan: cravingPlan },
                    ].filter(s => s.plan).map(s => {
                      const sel = calcSelections.has(s.id);
                      return (
                        <div key={s.id} onClick={() => toggleCalcSelection(s.id)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 9px', borderRadius:8, marginBottom:3, background: sel ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)', border: sel ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
                          <div style={{ width:20, height:20, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', background: sel ? '#00e68a' : 'rgba(255,255,255,0.06)', color: sel ? '#000' : 'transparent', fontSize:11, fontWeight:800, border: sel ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>{sel ? 'вњ“' : ''}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:9, fontWeight:600, color:'#fff' }}>{s.label}</div>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)' }}>{s.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Week/Month view */}
            {calcTab !== 'day' && (
              <div style={{ textAlign:'center', padding:16, fontSize:9, color:'rgba(255,255,255,0.75)' }}>
                {calcTab === 'week' ? 'рџ“† Р’С‹Р±РµСЂРёС‚Рµ РґРµРЅСЊ РЅР° РІРєР»Р°РґРєРµ "Р”РµРЅСЊ" РґР»СЏ РїРѕРёРјС‘РЅРЅРѕРіРѕ РІС‹Р±РѕСЂР° РїСЂРёС‘РјРѕРІ' : 'рџ—“ Р’С‹Р±РµСЂРёС‚Рµ РґРµРЅСЊ РЅР° РІРєР»Р°РґРєРµ "Р”РµРЅСЊ"'}
                <div style={{ fontSize:7, marginTop:4, color:'rgba(255,255,255,0.2)' }}>РќРµРґРµР»СЊРЅС‹Р№/РјРµСЃСЏС‡РЅС‹Р№ СЂР°СЃС‡С‘С‚ РґРѕСЃС‚СѓРїРµРЅ С‡РµСЂРµР· РІС‹Р±РѕСЂ РєР°Р¶РґРѕРіРѕ РґРЅСЏ РѕС‚РґРµР»СЊРЅРѕ</div>
              </div>
            )}

            {/* Calculate button */}
            <button onClick={handleCalcUsefulness} disabled={calcSelections.size === 0} style={{
              width:'100%', padding:'12px', borderRadius:12, cursor: calcSelections.size === 0 ? 'default' : 'pointer', textAlign:'center',
              background: calcSelections.size === 0 ? 'rgba(0,230,138,0.05)' : 'linear-gradient(135deg,#00e68a,#00c8a0)',
              border: calcSelections.size === 0 ? '1px solid rgba(0,230,138,0.1)' : 'none',
              color: calcSelections.size === 0 ? 'rgba(0,230,138,0.4)' : '#000',
              fontSize:11, fontWeight:800, opacity: calcSelections.size === 0 ? 0.4 : 1, transition:'all 0.15s',
            }}>
              рџ”¬ Р Р°СЃСЃС‡РёС‚Р°С‚СЊ РІС‹Р±СЂР°РЅРЅРѕРµ ({calcSelections.size})
            </button>

            {/* Results */}
            {calcResults && calcResults.length > 0 && (
              <div style={{ marginTop:12, borderTop:'1px solid rgba(0,230,138,0.1)', paddingTop:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', marginBottom:6 }}>рџ“Љ Р РµР·СѓР»СЊС‚Р°С‚С‹</div>
                {/* Summary row */}
                <div style={{ display:'flex', gap:4, marginBottom:6 }}>
                  <div style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(0,230,138,0.06)', textAlign:'center' }}>
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)' }}>РџСЂРёС‘РјРѕРІ</div>
                    <div style={{ fontSize:14, fontWeight:800, color:'#00e68a' }}>{calcResults.length}</div>
                  </div>
                  <div style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(139,92,246,0.06)', textAlign:'center' }}>
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)' }}>РЎСЂ. СЃРєРѕСЂ</div>
                    <div style={{ fontSize:14, fontWeight:800, color:'#8b5cf6' }}>{(calcResults.reduce((s, r) => s + r.score.compositeScore, 0) / calcResults.length).toFixed(1)}</div>
                  </div>
                  <div style={{ flex:1, padding:'8px', borderRadius:8, background:'rgba(245,158,11,0.06)', textAlign:'center' }}>
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.8)' }}>Р’СЃРµРіРѕ РєРєР°Р»</div>
                    <div style={{ fontSize:14, fontWeight:800, color:'#f59e0b' }}>{calcResults.reduce((s, r) => s + r.score.macros.kcal, 0)}</div>
                  </div>
                </div>

                {/* Per-meal results */}
                {calcResults.map((r, i) => {
                  const sc = r.score;
                  const color = sc.compositeScore >= 8 ? '#22c55e' : sc.compositeScore >= 5 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={r.id} style={{ marginBottom:6, borderRadius:10, padding:10, background:'rgba(24,24,27,0.8)', border:`1px solid ${color}20` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <span style={{ fontSize:9, fontWeight:700, color:'#fff' }}>{r.name}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:11, fontWeight:800, color }}>{sc.compositeScore.toFixed(1)}</span>
                          <span style={{ fontSize:6, color, opacity:0.6 }}>{sc.label}</span>
                        </div>
                      </div>
                      {/* Macros bar */}
                      <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                        {[
                          { label:'Р‘', val:sc.macros.protein, color:'#3b82f6' },
                          { label:'Р–', val:sc.macros.fat, color:'#f59e0b' },
                          { label:'РЈ', val:sc.macros.carbs, color:'#ef4444' },
                          { label:'РљР»', val:sc.macros.fiber, color:'#22c55e' },
                        ].map(m => (
                          <div key={m.label} style={{ flex:1, padding:'3px 4px', borderRadius:5, background:`${m.color}0a`, textAlign:'center' }}>
                            <div style={{ fontSize:6, color:`${m.color}aa` }}>{m.label}</div>
                            <div style={{ fontSize:8, fontWeight:700, color:m.color }}>{m.val}Рі</div>
                          </div>
                        ))}
                        <div style={{ flex:1, padding:'3px 4px', borderRadius:5, background:'rgba(139,92,246,0.08)', textAlign:'center' }}>
                          <div style={{ fontSize:6, color:'#8b5cf6aa' }}>DIAAS</div>
                          <div style={{ fontSize:8, fontWeight:700, color: r.diaas.diaas >= 1 ? '#22c55e' : r.diaas.diaas >= 0.75 ? '#f59e0b' : '#ef4444' }}>{r.diaas.diaas.toFixed(2)}</div>
                        </div>
                      </div>
                      {/* Quality breakdown */}
                      <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:2 }}>
                        <span style={{ fontSize:6, color:'rgba(255,255,255,0.6)' }}>в­ђ РљР°С‡РµСЃС‚РІРѕ: {sc.compositeScore.toFixed(1)}</span>
                        {sc.productScores.slice(0,3).map((p,pi) => (
                          <span key={pi} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background: p.score >= 7 ? 'rgba(0,230,138,0.08)' : p.score >= 4 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)', color: p.score >= 7 ? '#22c55e' : p.score >= 4 ? '#f59e0b' : '#ef4444' }}>
                            {p.name} ({p.score.toFixed(1)})
                          </span>
                        ))}
                      </div>
                      {/* Modifiers */}
                      {sc.modifiers.length > 0 && (
                        <div style={{ marginTop:4 }}>
                          <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginBottom:2 }}>рџ§¬ Р¤Р°РєС‚РѕСЂС‹:</div>
                          {sc.modifiers.map((m, mi) => (
                            <div key={mi} style={{ fontSize:7, padding:'2px 5px', marginBottom:1, borderRadius:4, background: m.value > 0 ? 'rgba(0,230,138,0.04)' : 'rgba(239,68,68,0.04)', color: m.value > 0 ? '#22c55e' : '#ef4444' }}>
                              {m.name} <b>({m.value > 0 ? '+' : ''}{m.value.toFixed(1)})</b>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Weak links */}
                      {sc.weakLinks.length > 0 && (
                        <div style={{ marginTop:3, fontSize:7, color:'#f59e0b' }}>
                          вљ пёЏ CР»Р°Р±С‹Рµ Р·РІРµРЅСЊСЏ: {sc.weakLinks.join(', ')}
                        </div>
                      )}
                      {/* Products */}
                      <div style={{ marginTop:4, fontSize:7, color:'rgba(255,255,255,0.6)' }}>
                        РџСЂРѕРґСѓРєС‚С‹: {sc.productScores.map(p => `${p.name} (${p.weightG}Рі)`).join(', ')}
                      </div>
                    </div>
                  );
                })}

                {/* Combined daily report */}
                {calcDailyReport && calcResults.length > 1 && (
                  <div style={{ marginTop:8, borderRadius:10, padding:10, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.12)' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>рџ“€ РЎРѕРІРѕРєСѓРїРЅС‹Р№ Р°РЅР°Р»РёР· ({calcResults.length} РїСЂРёС‘РјР°)</div>
                    <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginBottom:4 }}>РљРєР°Р»: {Math.round(calcDailyReport.totalKcal)} | DIAAS: {calcDailyReport.diaas.toFixed(2)} | Р›РёРјРёС‚.РђРљ: {calcDailyReport.diaasLimitingAA} {calcDailyReport.histamineSensitive ? '| вљ пёЏ Р§СѓРІСЃС‚РІРёС‚РµР»РµРЅ Рє РіРёСЃС‚Р°РјРёРЅСѓ' : ''}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3, fontSize:7, color:'rgba(255,255,255,0.85)' }}>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.mtorTriggered ? 'rgba(0,230,138,0.06)' : 'rgba(239,68,68,0.06)', color: calcDailyReport.mtorTriggered ? '#22c55e' : '#ef4444' }}>
                        рџ§¬ mTOR: {calcDailyReport.mtorTriggered ? 'вњ… Р—Р°РїСѓС‰РµРЅ' : `вќЊ Р”РµС„РёС†РёС‚ ${calcDailyReport.mtorDeficitMg}РјРі Р»РµР№С†РёРЅР°`}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.giLoadWarning ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.giLoadWarning ? '#ef4444' : '#22c55e' }}>
                        рџ«ѓ РќР°РіСЂ. Р–РљРў: {calcDailyReport.giLoad.toFixed(0)} {calcDailyReport.giLoadWarning ? 'вљ пёЏ' : 'вњ…'}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.pralWarning ? 'rgba(245,158,11,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.pralWarning ? '#f59e0b' : '#22c55e' }}>
                        рџ§‚ PRAL: {calcDailyReport.pralTotal.toFixed(0)} {calcDailyReport.pralWarning || 'вњ…'}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.ammoniaRisk ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.ammoniaRisk ? '#ef4444' : '#22c55e' }}>
                        рџ’Ё РђРјРјРёР°Рє: {calcDailyReport.ammoniaScore.toFixed(1)} {calcDailyReport.ammoniaRisk ? 'вљ пёЏ' : 'вњ…'}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.omegaWarning ? 'rgba(245,158,11,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.omegaWarning ? '#f59e0b' : '#22c55e' }}>
                        рџђџ РћРјРµРіР°: {calcDailyReport.omegaRatio.toFixed(1)}:1 {calcDailyReport.omegaWarning ? 'вљ пёЏ' : 'вњ…'}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.electrolyteRisk ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.electrolyteRisk ? '#ef4444' : '#22c55e' }}>
                        рџ’§ K/Mg: {calcDailyReport.potassiumMg}/{calcDailyReport.magnesiumMg}РјРі {calcDailyReport.electrolyteRisk ? 'вљ пёЏ' : 'вњ…'}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.cortisolRisk ? 'rgba(245,158,11,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.cortisolRisk ? '#f59e0b' : '#22c55e' }}>
                        рџ§  РљРѕСЂС‚РёР·РѕР»: {calcDailyReport.cortisolRisk ? 'вљ пёЏ Р РёСЃРє' : 'вњ… РќРѕСЂРјР°'}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: calcDailyReport.insulinRicohet ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.06)', color: calcDailyReport.insulinRicohet ? '#ef4444' : '#22c55e' }}>
                        рџ’‰ РРЅСЃСѓР»РёРЅ: {calcDailyReport.insulinRicohet ? 'рџљЁ Р РёРєС€РµС‚' : 'вњ… РќРѕСЂРјР°'}
                      </div>
                      <div style={{ padding:'3px 6px', borderRadius:4, background: (calcDailyReport.homaIr !== null && calcDailyReport.homaIr > 2.5) ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.06)', color: (calcDailyReport.homaIr !== null && calcDailyReport.homaIr > 2.5) ? '#ef4444' : '#22c55e' }}>
                        рџ”¬ HOMA-IR: {calcDailyReport.homaIr !== null ? calcDailyReport.homaIr.toFixed(1) : 'вЂ”'} {(calcDailyReport.homaIr !== null && calcDailyReport.homaIr > 2.5) ? 'рџљЁ' : 'вњ…'}
                      </div>
                    </div>
                    {calcDailyReport.diaasWarning && (
                      <div style={{ marginTop:4, fontSize:7, padding:'4px 8px', borderRadius:6, background: 'rgba(139,92,246,0.06)', color: '#8b5cf6' }}>
                        рџ’Є DIAAS: {calcDailyReport.diaasWarning}
                      </div>
                    )}
                    {calcDailyReport.antinutrientWarning && (
                      <div style={{ marginTop:3, fontSize:7, padding:'4px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', color:'#f59e0b' }}>
                        {calcDailyReport.antinutrientWarning}
                      </div>
                    )}
                    {calcDailyReport.glutathioneWarning && (
                      <div style={{ marginTop:3, fontSize:7, padding:'4px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', color:'#f59e0b' }}>
                        {calcDailyReport.glutathioneWarning}
                      </div>
                    )}
                    {calcDailyReport.histamineWarning && (
                      <div style={{ marginTop:3, fontSize:7, padding:'4px 8px', borderRadius:6, background:'rgba(239,68,68,0.06)', color:'#ef4444' }}>
                        {calcDailyReport.histamineWarning}
                      </div>
                    )}
                    {/* Micro deficits */}
                    {calcDailyReport.microDeficits.length > 0 && (
                      <div style={{ marginTop:3, fontSize:7, padding:'4px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', color:'#f59e0b' }}>
                        вљ пёЏ Р”РµС„РёС†РёС‚С‹: {calcDailyReport.microDeficits.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {showCorrectPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }}
          onClick={() => { setShowCorrectPopup(false); setCorrectIssues(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ width:'96%', maxWidth:440, maxHeight:'92vh', overflowY:'auto', padding:16, borderRadius:16, background:'#18181b', border:'1px solid rgba(249,115,22,0.12)', boxShadow:'0 8px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#f97316' }}>рџ”Ђ РљРѕСЂСЂРµРєС‚РёСЂРѕРІРєР° СЂР°С†РёРѕРЅР°</div>
              <span onClick={() => { setShowCorrectPopup(false); setCorrectIssues(null); }} style={{ cursor:'pointer', fontSize:10, color:'rgba(255,255,255,0.6)', padding:'2px 6px' }}>вњ•</span>
            </div>

            {!correctIssues ? (
              <div style={{ textAlign:'center', padding:20, fontSize:9, color:'rgba(255,255,255,0.75)' }}>РђРЅР°Р»РёР· СЂР°С†РёРѕРЅР°...</div>
            ) : correctIssues.length === 0 ? (
              <div style={{ textAlign:'center', padding:20 }}>
                <div style={{ fontSize:24, marginBottom:8 }}>вњ…</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:4 }}>Р Р°С†РёРѕРЅ СЃР±Р°Р»Р°РЅСЃРёСЂРѕРІР°РЅ</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.75)' }}>РќРµ РЅР°Р№РґРµРЅРѕ РєСЂРёС‚РёС‡РµСЃРєРёС… РЅРµРґРѕС‡С‘С‚РѕРІ</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginBottom:8 }}>
                  РќР°Р№РґРµРЅРѕ <strong style={{ color:'#f97316' }}>{correctIssues.reduce((s, m) => s + m.issues.length, 0)}</strong> РЅРµРґРѕС‡С‘С‚Р°(РѕРІ) РІ <strong style={{ color:'#f97316' }}>{correctIssues.length}</strong> РїСЂРёС‘РјР°С…
                </div>

                {correctIssues.map((meal, mi) => (
                  <div key={mi} style={{ marginBottom:8, borderRadius:10, background:'rgba(24,24,27,0.8)', border:'1px solid rgba(249,115,22,0.1)', overflow:'hidden' }}>
                    <div style={{ padding:'7px 10px', background:'rgba(249,115,22,0.06)', borderBottom:'1px solid rgba(249,115,22,0.08)' }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#f97316' }}>{meal.mealName}</span>
                      <span style={{ fontSize:8, color:'rgba(255,255,255,0.75)', marginLeft:6 }}>({meal.issues.length})</span>
                    </div>
                    <div style={{ padding:'6px 10px' }}>
                      {meal.issues.map((issue, ii) => (
                        <div key={ii} style={{ marginBottom:6, padding:'6px 8px', borderRadius:8, background: issue.severity === 'high' ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)', border:`1px solid ${issue.severity === 'high' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}` }}>
                          <div style={{ fontSize:8, fontWeight:600, color: issue.severity === 'high' ? '#ef4444' : '#f59e0b', marginBottom:3 }}>{issue.text}</div>
                          {issue.suggestion && issue.suggestion.length > 0 && (
                            <div>
                              <div style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginBottom:2 }}>рџ”Ђ Р—Р°РјРµРЅРёС‚СЊ РЅР°:</div>
                              <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                                {issue.suggestion.map((s, si) => (
                                  <button key={si} onClick={() => {
                                    const itemIdx = dayPlan?.meals?.[meal.mealIdx]?.items?.findIndex((it: any) => {
                                      const food = FOOD_DB.find(f => f.id === it.id || f.name === it.name);
                                      return food?.id === s.foodId || it.name === s.name;
                                    });
                                    if (itemIdx !== undefined && itemIdx >= 0) {
                                      saveUndo();
                                      replaceFoodItem(0, meal.mealIdx, itemIdx, FOOD_DB.find(f => f.id === s.foodId));
                                      analyzePlanIssues();
                                    }
                                  }} style={{ padding:'3px 8px', borderRadius:6, fontSize:7, cursor:'pointer', background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a', fontWeight:600 }}>
                                    {s.name} <span style={{ fontWeight:400, color:'rgba(255,255,255,0.75)' }}>({s.reason})</span>
                                  </button>
                                ))}
                                <button onClick={() => {
                                  const allItems = dayPlan?.meals?.[meal.mealIdx]?.items || [];
                                  allItems.forEach((it: any, i: number) => {
                                    const similar = findSimilarFoods(it);
                                    if (similar.length > 0) {
                                      const targetFood = similar.find(f => issue.suggestion?.some(s => s.foodId === f.id));
                                      if (targetFood) {
                                        saveUndo();
                                        replaceFoodItem(0, meal.mealIdx, i, targetFood);
                                      }
                                    }
                                  });
                                  analyzePlanIssues();
                                }} style={{ padding:'3px 8px', borderRadius:6, fontSize:7, cursor:'pointer', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', color:'#a78bfa', fontWeight:600 }}>
                                  рџ”„ Р’СЃРµ
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{ display:'flex', gap:4, marginTop:8 }}>
                  <button onClick={() => {
                    setShowCorrectPopup(false);
                    setCorrectIssues(null);
                    generatePlan(1, undefined, selectedDayIndex);
                  }} style={{ flex:1, padding:'10px', borderRadius:10, cursor:'pointer', border:'none', background:'linear-gradient(135deg,#f97316,#fb923c)', color:'#fff', fontSize:10, fontWeight:800 }}>
                    в™»пёЏ РџРµСЂРµРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ СЂР°С†РёРѕРЅ
                  </button>
                  <button onClick={() => { setShowCorrectPopup(false); setCorrectIssues(null); }} style={{ flex:1, padding:'10px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(255,255,255,0.15)', background:'#202023', color:'#fff', fontSize:10, fontWeight:600 }}>
                    вњ• Р—Р°РєСЂС‹С‚СЊ
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

