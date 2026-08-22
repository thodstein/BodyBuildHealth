import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { type OFFProduct, productToFoodItem } from '../../../engines/openfoodfacts.engine';
import { fillMissingMicros, parseNutritionText, quantityToGrams, findFood } from '../../../engines/nutrition-ocr-parser';
import { processUploadedFile } from '../../../core/ocr-engine';
import { FOOD_DB } from '../../../core/nutrition-database';
import { CAT_MAP_EMOJI } from '../../../core/nutrition-utils';
import { formatDate } from '../../../core/utils/date-utils';
import { type DiaryItem } from './types';
import { aggregateDiaryMicros } from './diary-storage';
import { readDiaryV2, writeDiaryV2, exportDiaryJSON, exportDiaryCSV, importDiaryJSON, getStorageInfo, onDiaryChangeV2 } from './diary-storage-v2';
import { calcMealQuality, getQualityLabel } from '../../../engines/nutrition-quality.engine';
import { NutritionDiaryCharts } from './NutritionDiaryCharts';
import { NutritionQualityCard } from '../../components/NutritionQualityCard';
import { useRecentFoods } from './useNutritionDiary';

// Extracted components
import { WeekDaySelector } from './diary/WeekDaySelector';
import { MacroSummary } from './diary/MacroSummary';
import { MealCard } from './diary/MealCard';
import { AddFoodPanel } from './diary/AddFoodPanel';
import { DayMealsList } from './diary/DayMealsList';
import { QualityInsights } from './diary/QualityInsights';
import { WeekView } from './diary/WeekView';
import { FrequentFoodsPanel } from './diary/FrequentFoodsPanel';

type FoodItemLike = { id: string; name: string; kcal: number; protein: number; fat: number; carbs: number; fiber?: number; category?: string; tier?: string; description?: string; isVegetarian?: boolean; isGlutenFree?: boolean; isDairyFree?: boolean };
export type { FoodItemLike };

const MEAL_PRESETS = ['Завтрак', 'Второй завтрак', 'Обед', 'Полдник', 'Ужин', 'Перекус', 'До тренировки', 'После тренировки', 'Поздний перекус'];

interface NutritionTargets { kcal: number; protein: number; fats: number; carbs: number; }

export const NutritionDiary: React.FC<{ foodEntries: { name: string; kcal: number; p: number; f: number; c: number }[]; targets?: NutritionTargets; weight?: number; age?: number; sex?: 'male' | 'female'; onDiaryChange?: () => void }> = ({ foodEntries, targets, weight: w, age: a, sex: s, onDiaryChange }) => {
  const weight = w || 80;
  const age = a || 30;
  const sex = s || 'male';
  const [tab, setTab] = useState<'add' | 'day' | 'week'>('add');
  const [showOCR, setShowOCR] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(foodSearch), 250);
    return () => clearTimeout(t);
  }, [foodSearch]);

  const [mealType, setMealType] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [parsedItems, setParsedItems] = useState<DiaryItem[]>([]);
  const [ocrError, setOcrError] = useState('');
  const [ocrHint, setOcrHint] = useState('');
  const [ocrFileLoading, setOcrFileLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [showCustomFood, setShowCustomFood] = useState(false);
  const [customFoodName, setCustomFoodName] = useState('');
  const [customFoodKcal, setCustomFoodKcal] = useState('100');
  const [customFoodP, setCustomFoodP] = useState('10');
  const [customFoodF, setCustomFoodF] = useState('5');
  const [customFoodC, setCustomFoodC] = useState('10');
  const [customMealInput, setCustomMealInput] = useState('');
  const [editItem, setEditItem] = useState<{ meal: string; idx: number; item: any } | null>(null);
  const [editQty, setEditQty] = useState(100);
  const [copySource, setCopySource] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [customMeals, setCustomMeals] = useState<string[]>(() => { try { const value = JSON.parse(localStorage.getItem('he_custom_meals') || '[]'); return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []; } catch { return []; } });
  const [mealPresets, setMealPresets] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('he_meal_presets') || '[]'); } catch { return []; } });
  const [foodPatterns, setFoodPatterns] = useState<Record<string, string[]>>(() => { try { return JSON.parse(localStorage.getItem('he_food_patterns') || '{}'); } catch { return {}; } });
  const [foodTriggers, setFoodTriggers] = useState<Record<string, string[]>>(() => { try { return JSON.parse(localStorage.getItem('he_food_triggers') || '{}'); } catch { return {}; } });
  const [mealMood, setMealMood] = useState<Record<string, { satiety: number; enjoyment: number; note: string }>>(() => { try { return JSON.parse(localStorage.getItem('he_meal_mood') || '{}'); } catch { return {}; } });
  const [usdaFoods, setUsdaFoods] = useState<FoodItemLike[]>([]);
  const [diaryData, setDiaryData] = useState<Record<string, any>>(() => readDiaryV2());
  const [refreshKey, setRefreshKey] = useState(0);

  const ocrFileRef = useRef<HTMLInputElement>(null);
  const ocrCameraRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); }, []);
  const safeSet = useCallback((key: string, data: any) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} }, []);

  // Lazy-load USDA
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      import('../../../data/usda-foods').then(m => {
        if (!cancelled && m.USDA_FOODS) {
          try { setUsdaFoods(m.USDA_FOODS.slice(0, 5000)); } catch { setUsdaFoods([]); }
        }
      }).catch(() => { setUsdaFoods([]); });
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // Diary storage listener
  useEffect(() => {
    return onDiaryChangeV2(setDiaryData);
  }, []);

  const saveDiary = useCallback((data: any) => { 
    try {
      writeDiaryV2(data); 
      setDiaryData(data); 
      setRefreshKey(k => k + 1); 
      onDiaryChange?.(); 
      setStorageError(null);
    } catch (e) {
      console.error('Diary save error:', e);
      const errorMsg = e instanceof Error ? e.message : 'неизвестная ошибка';
      setStorageError('Ошибка сохранения дневника: ' + errorMsg);
    }
  }, [onDiaryChange]);

  const allMealTypes = useMemo(() => [...MEAL_PRESETS, ...customMeals], [customMeals]);

  // Auto-select first meal type
  useEffect(() => { if (!mealType && allMealTypes.length > 0) setMealType(allMealTypes[0]); }, [tab, allMealTypes, mealType]);

  const weekStart = useMemo(() => { const d = new Date(selectedDate); const day = d.getDay(); d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); return d; }, [selectedDate]);
  const weekDays = useMemo(() => Array.from({length:7}, (_,i) => { const d = new Date(weekStart); d.setDate(d.getDate()+i); return formatDate(d); }), [weekStart]);

  const dayMeals = diaryData[selectedDate]?.meals || {};

  const dayTotals = useMemo(() => {
    try {
      const items = Object.values(dayMeals).filter(Array.isArray).flat().filter((i:any) => i && typeof i === 'object');
      return {
        kcal: items.reduce((s: number, i: any) => s + (i.kcal || 0), 0),
        p: items.reduce((s: number, i: any) => s + (i.p || 0), 0),
        f: items.reduce((s: number, i: any) => s + (i.f || 0), 0),
        c: items.reduce((s: number, i: any) => s + (i.c || 0), 0),
      };
    } catch { return { kcal:0, p:0, f:0, c:0 }; }
  }, [dayMeals, diaryData, refreshKey]);

  const dayMicros = useMemo(() => aggregateDiaryMicros(diaryData[selectedDate]), [diaryData, selectedDate, refreshKey]);
  const microLabels: Record<string, { name: string; unit: string; target: number }> = {
    sodium_mg: { name: 'Натрий', unit: 'мг', target: 2300 }, potassium_mg: { name: 'Калий', unit: 'мг', target: 3500 }, magnesium_mg: { name: 'Магний', unit: 'мг', target: 400 }, calcium_mg: { name: 'Кальций', unit: 'мг', target: 1000 }, iron_mg: { name: 'Железо', unit: 'мг', target: sex === 'female' ? 18 : 8 }, zinc_mg: { name: 'Цинк', unit: 'мг', target: sex === 'female' ? 8 : 11 }, vitamin_c_mg: { name: 'Витамин C', unit: 'мг', target: sex === 'female' ? 75 : 90 }, vitamin_d_mcg: { name: 'Витамин D', unit: 'мкг', target: 15 }, vitamin_b12_mcg: { name: 'Витамин B12', unit: 'мкг', target: 2.4 }, fiber_g: { name: 'Клетчатка', unit: 'г', target: 30 },
  };

  const mealQuality = useMemo(() => {
    try {
      const items = Object.values(dayMeals).flat() as any[];
      if (items.length === 0) return null;
      return calcMealQuality(items);
    } catch { return null; }
  }, [dayMeals, refreshKey]);

  // Per-product usefulness from bb_quality_score stored in diary entries
  const dayQuality = useMemo(() => {
    try {
      const items = Object.values(dayMeals).flat().filter((i: any) => i && typeof i === 'object') as any[];
      if (items.length === 0) return null;
      let totalScore = 0;
      let scoredCount = 0;
      const perProduct: Array<{ name: string; score?: number; label: string; color: string }> = [];
      items.forEach((item: any) => {
        let score: number | undefined = item.qualityScore;
        if (score == null && item.foodId) {
          const food = FOOD_DB.find(f => f.id === item.foodId);
          score = food?.bb_quality_score;
        }
        if (score == null && item.name) {
          const food = FOOD_DB.find(f => f.name.toLowerCase() === (item.name || '').toLowerCase());
          score = food?.bb_quality_score;
        }
        if (score != null && Number.isFinite(score)) {
          totalScore += score;
          scoredCount++;
          const { label, color } = getQualityLabel(score * 10); // scale 1-10 → 0-100
          perProduct.push({ name: item.name, score, label, color });
        }
      });
      const avg = scoredCount > 0 ? Math.round(totalScore / scoredCount * 10) / 10 : null;
      return { avg, scoredCount, total: items.length, perProduct };
    } catch { return null; }
  }, [dayMeals, refreshKey]);

  const favoriteFoods = useMemo(() => { 
    try { 
      const favs: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); 
      return favs.map(id => FOOD_DB.find(f => f.id === id)).filter(Boolean) as typeof FOOD_DB; 
    } catch { return []; } 
  }, [refreshKey]);

  const recentFoods = useRecentFoods(diaryData as any, 10);

  // Handlers
  const addFoodFromDB = useCallback((food: FoodItemLike) => {
    setParsedItems(prev => [...prev, { name: food.name, kcal: food.kcal, p: food.protein, f: food.fat, c: food.carbs, qty: 100, category: food.category || 'other' }]);
    setFoodSearch('');
    try { 
      const favs = JSON.parse(localStorage.getItem('he_food_favs') || '[]'); 
      const updated = [food.id, ...favs.filter((f: string) => f !== food.id)].slice(0, 12); 
      localStorage.setItem('he_food_favs', JSON.stringify(updated)); 
      setRefreshKey(k => k + 1);
    } catch {}
  }, []);

  const handleDirectAdd = useCallback((food: FoodItemLike) => {
    const data = { ...diaryData };
    if (!data[selectedDate]) data[selectedDate] = { meals: {} };
    const mt = mealType || 'Перекус';
    if (!data[selectedDate].meals[mt]) data[selectedDate].meals[mt] = [];
    (data[selectedDate].meals[mt] as any).push({ name: food.name, qty: '100 г', kcal: food.kcal, p: food.protein, f: food.fat, c: food.carbs, category: food.category, foodId: (food as any).id });
    saveDiary(data);
    showToast(`⚡ ${food.name} → ${mt} 100г`);
  }, [diaryData, selectedDate, mealType, saveDiary, showToast]);

  const handleBarcodeProduct = useCallback((product: OFFProduct) => { 
    setShowBarcode(false); 
    const item = productToFoodItem(product); 
    setParsedItems(prev => [...prev, { name: item.name, kcal: item.kcal, p: item.protein, f: item.fat, c: item.carbs, qty: 100 }]); 
  }, []);

  const convertOCRItems = useCallback((meals: { mealType: string; items: Array<{ name: string; qty: string; qtyGrams?: number; kcal: number; p: number; f: number; c: number; category?: string; foodId?: string; micros?: Record<string, number> }> }[], usdaFallback?: FoodItemLike[]) => {
    return meals.flatMap(m => m.items.map(item => {
      const qtyMatch = item.qty?.match(/[\d]+(?:[.,]\d+)?/);
      const parsedQty = qtyMatch ? Number.parseFloat(qtyMatch[0].replace(',', '.')) : 100;
      const qty = Math.max(10, Math.round(item.qtyGrams ?? parsedQty));
      let result: DiaryItem = { name: item.name || m.mealType || 'Блюдо', kcal: Math.round(item.kcal) || 0, p: Math.round((item.p || 0) * 10) / 10, f: Math.round((item.f || 0) * 10) / 10, c: Math.round((item.c || 0) * 10) / 10, qty, category: item.category, foodId: item.foodId, micros: item.micros };
      // USDA fallback: if food not in FOOD_DB, try external catalog
      if (!result.foodId && usdaFallback?.length) {
        const usdaMatch = findFood(item.name, usdaFallback as any);
        if (usdaMatch) {
          result.foodId = (usdaMatch as any).id || result.foodId;
          result.category = (usdaMatch as any).category || result.category;
          // Enrich with USDA kcal/macros if parsed data is sparse
          if (result.kcal === 0 && (usdaMatch as any).kcal) result.kcal = (usdaMatch as any).kcal;
          if (result.p === 0 && (usdaMatch as any).protein) result.p = (usdaMatch as any).protein;
          if (result.f === 0 && (usdaMatch as any).fat) result.f = (usdaMatch as any).fat;
          if (result.c === 0 && (usdaMatch as any).carbs) result.c = (usdaMatch as any).carbs;
        }
      }
      return result;
    }));
  }, []);

  const fillQueuedMicros = useCallback(() => setParsedItems(prev => prev.map(item => ({ ...item, micros: fillMissingMicros(item.name, Number(item.qty) || 100, item.micros) }))), []);

  const fillDayMicros = useCallback(() => {
    const data = { ...diaryData };
    const day = data[selectedDate];
    if (!day?.meals) return;
    (Object.values(day.meals) as any[][]).forEach(items => items.forEach((item: any) => {
      const food = FOOD_DB.find(f => f.id === item.foodId) || FOOD_DB.find(f => f.name === item.name);
      const grams = quantityToGrams(String(item.qty || '100 г'), food);
      item.micros = fillMissingMicros(item.name, grams, item.micros);
    }));
    saveDiary(data);
    showToast('✨ Микронутриенты дополнены');
  }, [diaryData, selectedDate, saveDiary, showToast]);

  const handleOcrFileUpload = useCallback(async (file: File) => { 
    setOcrFileLoading(true); setOcrError(''); 
    try { 
      const result = await processUploadedFile(file); 
      if (result.meals.length > 0) setParsedItems(prev => [...prev, ...convertOCRItems(result.meals, usdaFoods)]); 
      if (result.meals.length === 0 && result.labs.length === 0) setOcrError(result.warnings[0] || 'Не удалось распознать данные питания.'); 
    } catch (e) { setOcrError('Ошибка: ' + (e instanceof Error ? e.message : String(e))); } 
    finally { setOcrFileLoading(false); } 
  }, [convertOCRItems, usdaFoods]);

  const handleOCR = useCallback(() => { 
    if (!ocrText.trim()) return; 
    setOcrError(''); 
    setOcrHint(''); 
    try { 
      const converted = convertOCRItems(parseNutritionText(ocrText)); 
      if (converted.length === 0) setOcrError('Не удалось найти продукты. Пример: «Курица 200 г» или «Курица 200 г 330 ккал Б:35 Ж:7 У:0».'); 
      else {
        setParsedItems(converted); 
        if (converted.length <= 2 && ocrText.split(/\r?\n/).filter(l => l.trim().length > 2).length > 4) {
          setOcrHint('💡 Распознано мало позиций для такого объёма текста. Проверьте, весь ли скриншот был распознан, или добавьте недостающие продукты вручную.');
        }
      }
    } catch (e) { setOcrError('' + (e instanceof Error ? e.message : String(e))); } 
  }, [ocrText, convertOCRItems]);

  const saveItemsToDiary = useCallback((items: DiaryItem[]) => {
    if (items.length === 0) return;
    const data = { ...diaryData };
    if (!data[selectedDate]) data[selectedDate] = { meals: {} };
    const mt = mealType || 'Приём пищи';
    if (!data[selectedDate].meals[mt]) data[selectedDate].meals[mt] = [];
    items.forEach(item => {
      const q = Number(item.qty) || 100;
      if (q <= 0) return;
      // Pull bb_quality_score from FOOD_DB for usefulness tracking
      let qualityScore: number | undefined;
      const food = item.foodId
        ? FOOD_DB.find(f => f.id === item.foodId)
        : FOOD_DB.find(f => f.name.toLowerCase() === (item.name || '').toLowerCase());
      if (food?.bb_quality_score != null) qualityScore = food.bb_quality_score;
      data[selectedDate].meals[mt].push({
        name: item.name, qty: `${q} г`, kcal: Math.round(item.kcal * q / 100),
        p: Math.round((item.p * q / 100) * 10) / 10, f: Math.round((item.f * q / 100) * 10) / 10, c: Math.round((item.c * q / 100) * 10) / 10,
        category: item.category, foodId: item.foodId, micros: item.micros,
        qualityScore,
      });
    });
    saveDiary(data);
    setParsedItems([]);
    setOcrText('');
    showToast(`✅ ${items.length} позиций → ${mt}`);
  }, [diaryData, selectedDate, mealType, saveDiary, showToast]);

  const deleteItem = useCallback((meal: string, idx: number) => {
    const data = { ...diaryData };
    if (!data[selectedDate]?.meals?.[meal]) return;
    data[selectedDate].meals[meal] = data[selectedDate].meals[meal].filter((_: any, i: number) => i !== idx);
    if (data[selectedDate].meals[meal].length === 0) delete data[selectedDate].meals[meal];
    if (Object.keys(data[selectedDate].meals).length === 0) delete data[selectedDate];
    saveDiary(data);
    showToast('🗑 Удалено');
  }, [diaryData, selectedDate, saveDiary, showToast]);

  const clearDay = useCallback(() => { 
    if (!diaryData[selectedDate]) return; 
    const data = { ...diaryData }; 
    delete data[selectedDate]; 
    saveDiary(data); 
    showToast('🗑 День очищен'); 
  }, [diaryData, selectedDate, saveDiary, showToast]);

  const openEdit = useCallback((meal: string, idx: number, item: any) => { 
    setEditItem({ meal, idx, item }); 
    const match = item.qty?.match(/(\d+)/); 
    setEditQty(match ? +match[1] : 100); 
  }, []);

  const saveEdit = useCallback(() => {
    if (!editItem) return;
    const data = { ...diaryData };
    if (!data[selectedDate]?.meals?.[editItem.meal]) return;
    const day = data[selectedDate];
    const items = [...day.meals[editItem.meal]];
    const current = items[editItem.idx];
    if (!current) return;
    const savedQty = Number.parseFloat(String(current.qty || '100').replace(',', '.')) || 100;
    const per100 = (value: number) => Number(value || 0) / savedQty * 100;
    const portion = (value: number, decimals = 1) => {
      const factor = 10 ** decimals;
      return Math.round(per100(value) * editQty / 100 * factor) / factor;
    };
    items[editItem.idx] = {
      ...current,
      qty: `${editQty} г`,
      kcal: Math.round(portion(current.kcal, 0)),
      p: portion(current.p),
      f: portion(current.f),
      c: portion(current.c),
      micros: current.micros
        ? Object.fromEntries(Object.entries(current.micros).map(([key, value]) => [key, portion(Number(value), 2)]))
        : current.micros,
    };
    data[selectedDate] = { ...day, meals: { ...day.meals, [editItem.meal]: items } };
    saveDiary(data); 
    setEditItem(null); 
    showToast('✅ Количество обновлено');
  }, [editItem, diaryData, selectedDate, editQty, saveDiary, showToast]);

  const copyMeal = useCallback((meal: string) => { 
    setCopySource(meal); 
    showToast(`📋 «${meal}» скопирован. Выберите день.`); 
  }, [showToast]);

  const pasteMeal = useCallback((targetDate: string) => {
    if (!copySource || !diaryData[selectedDate]?.meals?.[copySource]) return;
    const data = { ...diaryData };
    if (!data[targetDate]) data[targetDate] = { meals: {} };
    data[targetDate].meals[copySource] = JSON.parse(JSON.stringify(diaryData[selectedDate].meals[copySource]));
    saveDiary(data); 
    setCopySource(null); 
    showToast(`✅ Вставлено в ${targetDate}`);
  }, [copySource, diaryData, selectedDate, saveDiary, showToast]);

  const addCustomMeal = useCallback(() => { 
    const name = customMealInput.trim();
    if (!name || customMeals.includes(name)) return; 
    const updated = [...customMeals, name]; 
    setCustomMeals(updated); 
    safeSet('he_custom_meals', updated); 
    setCustomMealInput(''); 
    showToast('✅ Приём добавлен'); 
  }, [customMealInput, customMeals, safeSet, showToast]);

  const saveMealMood = useCallback((date: string, mood: { satiety: number; enjoyment: number; note: string }) => {
    const upd = { ...mealMood, [date]: mood };
    setMealMood(upd);
    safeSet('he_meal_mood', upd);
  }, [mealMood, safeSet]);

  const savePatterns = useCallback((date: string, patterns: string[]) => {
    const upd = { ...foodPatterns, [date]: patterns };
    setFoodPatterns(upd);
    safeSet('he_food_patterns', upd);
  }, [foodPatterns, safeSet]);

  const saveTriggers = useCallback((date: string, triggers: string[]) => {
    const upd = { ...foodTriggers, [date]: triggers };
    setFoodTriggers(upd);
    safeSet('he_food_triggers', upd);
  }, [foodTriggers, safeSet]);

  const importFromPlan = useCallback(() => {
    try {
      const plans = JSON.parse(localStorage.getItem('he_saved_nutrition_plans') || '[]');
      if (plans.length === 0) { showToast('❌ Нет сохранённых планов'); return; }
      const latest = plans[0];
      const meals = latest.dayPlan?.meals || [];
      if (meals.length === 0) { showToast('❌ План пуст — нет приёмов'); return; }
      const data = { ...diaryData };
      if (!data[selectedDate]) data[selectedDate] = { meals: {} };
      meals.forEach((m: any) => {
        const label = m.label || 'Приём пищи';
        if (!data[selectedDate].meals[label]) data[selectedDate].meals[label] = [];
        (Array.isArray(m.items) ? m.items : []).forEach((it: any) => {
          data[selectedDate].meals[label].push({ name: it.name, qty: `${it.amount || 100} г`, kcal: it.kcal || 0, p: it.p || 0, f: it.f || 0, c: it.c || 0, category: it.category, foodId: it.id || it.foodId, micros: it.micros });
        });
      });
      saveDiary(data);
      showToast('✅ Импортировано из плана');
    } catch { showToast('❌ Ошибка импорта плана'); }
  }, [diaryData, selectedDate, saveDiary, showToast]);

  const addCustomFood = useCallback(() => {
    const name = customFoodName.trim();
    if (!name) return;
    setParsedItems(prev => [...prev, { 
      name, kcal: Math.round(+customFoodKcal || 0), 
      p: Math.round((+customFoodP || 0) * 10) / 10, 
      f: Math.round((+customFoodF || 0) * 10) / 10, 
      c: Math.round((+customFoodC || 0) * 10) / 10, 
      qty: 100 
    }]);
    setCustomFoodName(''); setCustomFoodKcal('100'); setCustomFoodP('10'); setCustomFoodF('5'); setCustomFoodC('10'); setShowCustomFood(false);
  }, [customFoodName, customFoodKcal, customFoodP, customFoodF, customFoodC]);

  const updateParsedItemQty = useCallback((idx: number, qty: number) => {
    setParsedItems(prev => prev.map((x, j) => j === idx ? { ...x, qty: Math.max(10, Math.min(1000, qty)) } : x));
  }, []);

  const addPresetItems = useCallback((items: any[]) => {
    setParsedItems(prev => [...prev, ...items.map((it: any) => ({ name: it.name, kcal: it.kcal || 0, p: it.p || 0, f: it.f || 0, c: it.c || 0, qty: it.qty || 100 }))]);
  }, []);

  const savePreset = useCallback((meal: string, items: any[]) => {
    const name = prompt('Название пресета:', `${meal} (пресет)`);
    if (!name?.trim()) return;
    const preset = { name: name.trim(), items: items.map((i: any) => ({ name: i.name, kcal: i.kcal, p: i.p, f: i.f, c: i.c })) };
    const upd = [...mealPresets, preset];
    setMealPresets(upd);
    safeSet('he_meal_presets', upd);
    showToast('✅ Пресет сохранён');
  }, [mealPresets, safeSet, showToast]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 999,
          padding: '10px 24px', borderRadius: 14, background: '#202023', border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: '-0.1px' }}>
          {toast}
        </div>
      )}
      
      {storageError && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 12, fontWeight: 500 }}>
          ⚠️ {storageError}
          <button onClick={() => setStorageError(null)} style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontSize: 10 }}>
            ✕
          </button>
        </div>
      )}
      
      
      {/* Week day selector */}
      <WeekDaySelector weekDays={weekDays} selectedDate={selectedDate} onSelectDate={setSelectedDate} diaryData={diaryData} />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 3, padding: '2px 0' }}>
        {([
          { key: 'add', label: '➕ Добавить', icon: true },
          { key: 'day', label: '📋 День', icon: true },
          { key: 'week', label: '📊 Неделя', icon: true },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} aria-label={t.label} style={{
            flex: 1, padding: '10px', borderRadius: 12, cursor: 'pointer', fontSize: 11, fontWeight: tab === t.key ? 800 : 500,
            border: tab === t.key ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
            background: tab === t.key ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023',
            color: tab === t.key ? '#000' : 'rgba(255,255,255,0.6)', minHeight: 44, transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Macro summary — always visible */}
      <MacroSummary dayTotals={dayTotals} targets={targets} />
      
      
      
      
      
      {/* Tab content */}
      {tab === 'add' && (
        <>
        <AddFoodPanel
          foodSearch={foodSearch} onFoodSearchChange={setFoodSearch} debouncedSearch={debouncedSearch}
          usdaFoods={usdaFoods} mealType={mealType} onMealTypeChange={setMealType}
          allMealTypes={allMealTypes} onAddFoodFromDB={addFoodFromDB} onDirectAdd={handleDirectAdd}
          customMealInput={customMealInput} onCustomMealInputChange={setCustomMealInput} onAddCustomMeal={addCustomMeal}
          onShowBarcode={() => setShowBarcode(true)} showBarcode={showBarcode} onBarcodeProduct={handleBarcodeProduct}
          onOcrFile={handleOcrFileUpload} ocrFileLoading={ocrFileLoading}
          onShowOCR={() => setShowOCR(!showOCR)} showOCR={showOCR}
          ocrText={ocrText} onOcrTextChange={setOcrText} onOcrSubmit={handleOCR}
          ocrError={ocrError} onOcrClose={() => { setShowOCR(false); setOcrText(''); }}
          parsedItems={parsedItems} onRemoveParsedItem={(i) => setParsedItems(prev => prev.filter((_, j) => j !== i))}
          onUpdateParsedItemQty={updateParsedItemQty} onFillMicros={fillQueuedMicros}
          onSaveItems={() => saveItemsToDiary(parsedItems)}
          onEditParsedItem={(idx, updated) => setParsedItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updated } : item))}
          onFixAllLowConfidence={() => setParsedItems(prev => prev.map(item => {
            if (typeof item.confidence === 'number' && item.confidence < 0.5) {
              const food = findFood(item.name);
              if (food) {
                const qty = Math.max(1, item.qtyGrams || quantityToGrams(String(item.qty ?? '100 г'), food));
                const mult = qty / 100;
                return {
                  ...item,
                  name: food.name,
                  qty: qty + ' г',
                  qtyGrams: qty,
                  kcal: Math.round(food.kcal * mult),
                  p: Math.round(food.protein * mult * 10) / 10,
                  f: Math.round(food.fat * mult * 10) / 10,
                  c: Math.round(food.carbs * mult * 10) / 10,
                  foodId: food.id,
                  category: food.category,
                  confidence: 0.9,
                };
              }
            }
            return item;
          }))}
          favoriteFoods={favoriteFoods} mealPresets={mealPresets} onAddPreset={addPresetItems}
          showCustomFood={showCustomFood} onToggleCustomFood={() => setShowCustomFood(!showCustomFood)}
          customFoodName={customFoodName} onCustomFoodNameChange={setCustomFoodName}
          customFoodKcal={customFoodKcal} customFoodP={customFoodP} customFoodF={customFoodF} customFoodC={customFoodC}
          onCustomFoodFieldChange={(f, v) => {
            if (f === 'customFoodKcal') setCustomFoodKcal(v);
            else if (f === 'customFoodP') setCustomFoodP(v);
            else if (f === 'customFoodF') setCustomFoodF(v);
            else if (f === 'customFoodC') setCustomFoodC(v);
          }}
          onAddCustomFood={addCustomFood}
          ocrFileRef={ocrFileRef} ocrCameraRef={ocrCameraRef}
        />
        {/* FatSecret-уровень: частые продукты 1-клик */}
        <FrequentFoodsPanel diary={diaryData} onAddFood={(food, mealType) => {
          const data = { ...diaryData };
          if (!data[selectedDate]) data[selectedDate] = { meals: {} };
          if (!data[selectedDate].meals[mealType]) data[selectedDate].meals[mealType] = [];
          data[selectedDate].meals[mealType].push({ ...food });
          saveDiary(data);
          showToast(`⚡ ${food.name} → ${mealType}`);
        }} />
        {recentFoods.length > 0 && (
          <div style={{ padding:'10px 14px', borderRadius:14, background:'#18181b', border:'1px solid rgba(255,255,255,0.06)', marginTop:6 }}>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)', fontWeight:600, marginBottom:6 }}>🕒 Недавние (1-клик)</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {recentFoods.slice(0,8).map(f => (
                <button key={f.name} onClick={() => {
                  const data = { ...diaryData };
                  if (!data[selectedDate]) data[selectedDate] = { meals: {} };
                  const mt = mealType || 'Перекус';
                  if (!data[selectedDate].meals[mt]) data[selectedDate].meals[mt] = [];
                  data[selectedDate].meals[mt].push({ ...f });
                  saveDiary(data);
                  showToast(`🕒 ${f.name} → ${mt}`);
                }} style={{ padding:'6px 10px', borderRadius:10, fontSize:10, cursor:'pointer', background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.2)', color:'#60a5fa', whiteSpace:'nowrap' }}>
                  {f.name.length>14 ? f.name.slice(0,13)+'…' : f.name} · {Math.round(f.kcal)}ккал
                </button>
              ))}
            </div>
          </div>
        )}
        </>
       )}

      {tab === 'day' && (
        <>
          {/* Product usefulness summary */}
          {dayQuality && dayQuality.scoredCount > 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.06))', border: '1px solid rgba(139,92,246,0.15)', marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>⭐ Полезность продуктов</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                  {dayQuality.scoredCount}/{dayQuality.total} оценено · средний {dayQuality.avg}/10
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {dayQuality.perProduct.slice(0, 12).map((p, i) => (
                  <span key={i} title={`${p.name}: ${p.score}/10`} style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 600,
                    background: `${p.color}18`, border: `1px solid ${p.color}30`,
                    color: p.color, whiteSpace: 'nowrap',
                  }}>{p.name.length > 16 ? p.name.slice(0, 15) + '…' : p.name} {p.score}</span>
                ))}
                {dayQuality.perProduct.length > 12 && (
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', padding: '3px 6px' }}>
                    +{dayQuality.perProduct.length - 12} ещё
                  </span>
                )}
              </div>
            </div>
          )}

          {Object.keys(dayMicros).length > 0 && <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', marginBottom: 6 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#86efac' }}>🧪 Микронутриенты за день</div><button onClick={() => { const txt = Object.entries(dayMicros).filter(([k]) => microLabels[k]).map(([k, v]) => { const info = microLabels[k]; return `${info.name}: ${Math.round(v * 10) / 10} ${info.unit} (${Math.round(v / info.target * 100)}%)`; }).join('\n'); try { void navigator.clipboard?.writeText(`Микро ${selectedDate}\n${txt}`); showToast('📋 Микро скопированы'); } catch { showToast('❌ Не удалось скопировать'); } }} aria-label="Копировать микронутриенты" style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 600, cursor: 'pointer', minHeight: 28 }}>📋</button></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>{Object.entries(dayMicros).filter(([key]) => microLabels[key]).map(([key, value]) => { const info = microLabels[key]; const pct = Math.round(value / info.target * 100); return <div key={key} style={{ padding: '4px 6px', borderRadius: 7, background: 'rgba(255,255,255,0.04)' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8 }}><span style={{ color: 'rgba(255,255,255,0.75)' }}>{info.name}</span><span style={{ color: pct >= 80 ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{Math.round(value * 10) / 10} {info.unit}</span></div><div style={{ marginTop: 3, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}><div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 2, background: pct >= 80 ? '#22c55e' : '#f59e0b' }} /></div><div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{pct}% от ориентира</div></div>; })}</div></div>}
          <DayMealsList
            dayMeals={dayMeals}
            onEditItem={openEdit} onDeleteItem={deleteItem}
            onCopyMeal={copyMeal} onSavePreset={savePreset}
            onImportFromPlan={importFromPlan} onClearDay={clearDay}
            onFillMicros={fillDayMicros}
            selectedDate={selectedDate} copySource={copySource}
            onPasteMeal={pasteMeal} onCancelCopy={() => setCopySource(null)}
          />

          <QualityInsights
            mealQuality={mealQuality} selectedDate={selectedDate} dayMeals={dayMeals}
            foodPatterns={foodPatterns} foodTriggers={foodTriggers}
            onSavePattern={savePatterns} onSaveTrigger={saveTriggers}
            mealMood={mealMood} onSaveMealMood={saveMealMood}
          />

          <NutritionDiaryCharts
            dayMeals={dayMeals} dayTotals={dayTotals} targets={targets}
            diaryData={diaryData} selectedDate={selectedDate} refreshKey={refreshKey}
          />

          <NutritionQualityCard
            meals={Object.entries(dayMeals).map(([mealName, raw]: [string, any]) => {
              const items = Array.isArray(raw) ? raw : [];
              return {
                foods: items.map((i: any) => ({
                  id: i.name || 'unknown', name: i.name || '', grams: parseInt(i.qty) || 100,
                  protein: i.p || 0, fat: i.f || 0, carbs: i.c || 0, kcal: i.kcal || 0, fiber: 0,
                })),
              };
            })}
            weight={weight} age={age} sex={sex} goal={sex === 'male' ? 'maintain' : 'maintain'} activityLevel="moderate"
          />
        </>
      )}

      {tab === 'week' && (
        <WeekView diaryData={diaryData} targets={targets || { kcal: 2500, protein: 160, fats: 70, carbs: 300 }} selectedDate={selectedDate} />
      )}

      {/* Edit modal */}
      {editItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: '12px' }}
          onClick={() => setEditItem(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, padding: '16px 20px 28px', borderRadius: '20px', background: '#18181b', boxShadow: '0 18px 54px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2, letterSpacing: -0.3 }}>✎ {editItem.item.name}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Изменить количество</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <button onClick={() => setEditQty(Math.max(10, editQty - 10))} style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: '#202023', color: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <input type="number" value={editQty} onChange={e => { const raw = parseFloat(e.target.value); setEditQty(Number.isFinite(raw) && raw >= 10 ? Math.round(raw) : 10); }} style={{ width: 80, padding: '8px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 20, fontWeight: 700, textAlign: 'center', outline: 'none' }} />
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>грамм</div>
              </div>
              <button onClick={() => setEditQty(Math.min(1000, editQty + 10))} aria-label="Увеличить количество" style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: '#202023', color: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 10 }}>
              {[50, 100, 150, 200, 300].map(v => (
                <button key={v} onClick={() => setEditQty(v)} aria-label={`${v} грамм`} style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: editQty === v ? 'rgba(0,230,138,0.12)' : '#202023', color: editQty === v ? '#00e68a' : 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 10, fontWeight: editQty === v ? 600 : 400, minHeight: 36 }}>
                  {v}г
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 12, textAlign: 'center' }}>
              → <span style={{ color: '#00e68a', fontWeight: 700 }}>{Math.round(editQty * (editItem.item.kcal || 0) / 100)} ккал</span> · 
              <span style={{ color: '#60a5fa' }}> {Math.round(((editItem.item.p || 0) * editQty / 100) * 10) / 10}г Б</span> · 
              <span style={{ color: '#fbbf24' }}> {Math.round(((editItem.item.f || 0) * editQty / 100) * 10) / 10}г Ж</span> · 
              <span style={{ color: '#fb923c' }}> {Math.round(((editItem.item.c || 0) * editQty / 100) * 10) / 10}г У</span>
            </div>
            <button onClick={saveEdit} aria-label="Сохранить изменения" style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700, fontSize: 13, minHeight: 48, boxShadow: '0 4px 20px rgba(0,230,138,0.2)' }}>
              ✓ Сохранить
            </button>
          </div>
        </div>
      )}
      
      {/* Export/Import actions */}
      <div style={{ marginTop: 20, padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            const json = exportDiaryJSON();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diary_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
          }}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: '#202023', color: '#00e68a', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
        >
          📥 Экспорт JSON
        </button>
        
        <button
          onClick={() => {
            const csv = exportDiaryCSV();
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diary_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
          }}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: '#202023', color: '#60a5fa', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
        >
          📥 Экспорт CSV
        </button>
        
        <label style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: '#202023', color: '#fbbf24', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          📤 Импорт JSON
          <input
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const json = ev.target?.result as string;
                  const result = importDiaryJSON(json);
                  if (result.success) {
                    setDiaryData(readDiaryV2());
                    setRefreshKey(k => k + 1);
                  } else {
                    setStorageError('Ошибка импорта: ' + result.error);
                  }
                };
                reader.readAsText(file);
              }
            }}
          />
        </label>
        
        <button
          onClick={() => {
            if (confirm('Очистить весь дневник? Это действие нельзя отменить.')) {
              writeDiaryV2({});
            }
          }}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: '#202023', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600, marginLeft: 'auto' }}
        >
          🗑 Очистить всё
        </button>
        
        {process.env.NODE_ENV === 'development' && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>
            {getStorageInfo().daysStored} дн. · {getStorageInfo().estimatedSizeKB.toFixed(1)} KB
          </span>
        )}
      </div>
    </div>
  );
};
