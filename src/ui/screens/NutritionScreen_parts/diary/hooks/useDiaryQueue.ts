import { useState, useCallback } from 'react';
import { type OFFProduct, productToFoodItem } from '../../../../../engines/openfoodfacts.engine';
import { fillMissingMicros, parseNutritionText, quantityToGrams, findFood } from '../../../../../engines/nutrition-ocr-parser';
import { processUploadedFile } from '../../../../../core/ocr-engine';
import { isCapacitorNative } from '../../../../../core/app-platform';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { type DiaryItem, type FoodItemLike } from '../../types';
import { readJSONArr } from '../../diary-storage-v2';

export function useDiaryQueue({ diaryData, selectedDate, mealType, usdaFoods, saveDiary, showToast, bumpRefresh, setShowBarcode, setFoodSearch }: {
  diaryData: Record<string, any>;
  selectedDate: string;
  mealType: string;
  usdaFoods: FoodItemLike[];
  saveDiary: (data: any) => void;
  showToast: (msg: string) => void;
  bumpRefresh: () => void;
  setShowBarcode: (v: boolean) => void;
  setFoodSearch: (v: string) => void;
}) {
  const [ocrText, setOcrText] = useState('');
  const [parsedItems, setParsedItems] = useState<DiaryItem[]>([]);
  const [ocrError, setOcrError] = useState('');
  const [ocrHint, setOcrHint] = useState('');
  const [ocrFileLoading, setOcrFileLoading] = useState(false);
  const [showCustomFood, setShowCustomFood] = useState(false);
  const [customFoodName, setCustomFoodName] = useState('');
  const [customFoodKcal, setCustomFoodKcal] = useState('100');
  const [customFoodP, setCustomFoodP] = useState('10');
  const [customFoodF, setCustomFoodF] = useState('5');
  const [customFoodC, setCustomFoodC] = useState('10');

  const addFoodFromDB = useCallback((food: FoodItemLike) => {
    setParsedItems(prev => [...prev, { name: food.name, kcal: food.kcal, p: food.protein, f: food.fat, c: food.carbs, qty: 100, category: food.category || 'other' }]);
    setFoodSearch('');
    try {
      const favs = readJSONArr<string>('he_food_favs');
      const updated = [food.id, ...favs.filter((f: string) => f !== food.id)].slice(0, 12);
      localStorage.setItem('he_food_favs', JSON.stringify(updated));
      bumpRefresh();
    } catch {}
  }, [setFoodSearch, bumpRefresh]);

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
    // Сканер уже кладёт в shared-базу, но очередь — вторая точка входа
    // (страховка: продукт из кэша/поиска тоже должен расходиться по устройствам).
    try {
      import('../../../../../engines/food-barcode-catalog.engine').then(m => {
        try { void m.saveSharedBarcode(product); } catch { /* ignore */ }
      }).catch(() => {});
    } catch { /* ignore */ }
    setParsedItems(prev => [...prev, { name: item.name, kcal: item.kcal, p: item.protein, f: item.fat, c: item.carbs, qty: 100, category: (item as any).category || 'other', foodId: (item as any).id, confidence: 1 }]);
    showToast(`📷 ${item.name} → очередь (на 100 г)`);
  }, [setShowBarcode, showToast]);

  const convertOCRItems = useCallback((meals: { mealType: string; items: Array<{ name: string; qty: string; qtyGrams?: number; kcal: number; p: number; f: number; c: number; category?: string; foodId?: string; micros?: Record<string, number>; confidence?: number }> }[], usdaFallback?: FoodItemLike[]) => {
    return meals.flatMap(m => m.items.map(item => {
      const qtyMatch = item.qty?.match(/[\d]+(?:[.,]\d+)?/);
      const parsedQty = qtyMatch ? Number.parseFloat(qtyMatch[0].replace(',', '.')) : 100;
      const qty = Math.max(10, Math.round(item.qtyGrams ?? parsedQty));
       let result: DiaryItem = { name: item.name || m.mealType || 'Блюдо', kcal: Math.round(item.kcal) || 0, p: Math.round((item.p || 0) * 10) / 10, f: Math.round((item.f || 0) * 10) / 10, c: Math.round((item.c || 0) * 10) / 10, qty, category: item.category, foodId: item.foodId, micros: item.micros, confidence: item.confidence };
      // USDA is only an identity/category fallback. Keep the actual values
      // captured in the screenshot instead of replacing them with another item.
      if (!result.foodId && usdaFallback?.length) {
        const usdaMatch = findFood(item.name, usdaFallback as any);
        if (usdaMatch) {
          result.foodId = (usdaMatch as any).id || result.foodId;
          result.category = (usdaMatch as any).category || result.category;
        }
      }
      return result;
      // Unknown catalogue matches remain editable in the queue. Confidence is
      // a review hint, not a reason to silently discard a recognized food row.
  })).filter(item => Boolean(item.name.trim()) && (item.kcal > 0 || item.p > 0 || item.f > 0 || item.c > 0));
  }, []);

  const fillQueuedMicros = useCallback(() => setParsedItems(prev => prev.map(item => ({ ...item, micros: fillMissingMicros(item.name, Number(item.qty) || 100, item.micros) }))), []);

  const handleOcrFileUpload = useCallback(async (file: File) => {
    if (!file) { setOcrError('Файл не выбран. Попробуйте ещё раз.'); setOcrFileLoading(false); return; }
    setOcrFileLoading(true); setOcrError(''); setOcrHint(`⏳ Файл выбран: ${((file as any)?.size ? ((file.size/1024/1024).toFixed(2)+' МБ') : '…')} — загружаем…`);
    if ((file as any)?.size > 15 * 1024 * 1024) {
      setOcrFileLoading(false);
      setOcrError('Фото больше 15 МБ. Сделайте скриншот экрана или уменьшите изображение и повторите.');
      return;
    }
    let backup: number | undefined;
    let hard: number | undefined;
    // АПК: серверный OCR недоступен, работает оффлайн-tesseract (до ~90с) —
    // таймауты гонки шире, иначе оффлайн-путь внутри processUploadedFile убивается раньше.
    const nativeOcr = isCapacitorNative();
    const raceMs = nativeOcr ? 120_000 : 45_000;
    const backupMs = nativeOcr ? 130_000 : 50_000;
    const hardMs = nativeOcr ? 140_000 : 55_000;
    const backupPromise = new Promise<never>((_, reject) => {
      backup = window.setTimeout(() => reject(new Error(nativeOcr ? 'Превышено время ожидания (120с). Попробуйте фото меньше/чётче.' : 'Превышено время ожидания (50с). Попробуйте скриншот экрана вместо фото камеры.')) as any, backupMs);
    });
    hard = window.setTimeout(() => {
      setOcrFileLoading(false);
      setOcrError(prev => (prev as any) || (nativeOcr ? 'Зависло на телефоне. Попробуйте фото при хорошем свете или вставьте текст вручную через «Текст».' : 'Зависло на телефоне. Попробуйте кнопку «Фото/файл» → выберите скриншот из галереи (не «Камера»).'));
    }, hardMs) as any;
    let lastPct = -1;
    const onOcrProgress = (fraction: number) => {
      const pct = Math.round(fraction * 100);
      if (pct >= lastPct + 10 || pct >= 100) {
        lastPct = pct;
        setOcrHint(`⏳ Распознаём скриншот… ${pct}% (текст+цифры КБЖУ)`);
      }
    };
    try {
      const result: any = await Promise.race([
        processUploadedFile(file, { onProgress: onOcrProgress }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(nativeOcr ? 'Оффлайн-распознавание не ответило за 120 секунд.' : 'Мобильный OCR не ответил за 45 секунд. Проверьте интернет и попробуйте скриншот меньшего размера.')), raceMs)),
        backupPromise,
      ]);
      setOcrText(result.text || '');
      if (result.meals.length > 0) {
        const converted = convertOCRItems(result.meals, usdaFoods);
        if (converted.length > 0) {
          setParsedItems(converted);
          setOcrError('');
          setOcrHint(`Распознано позиций: ${converted.length}. Проверьте очередь — тап по названию для правки. Сырой текст ниже.` );
        } else {
          setOcrError('Строки распознаны, но пищевые позиции не найдены. Попробуйте более чёткий снимок экрана MyFitnessPal/FatSecret или вставьте текст через «Текст».');
        }
      } else if (result.meals.length === 0 && result.labs.length === 0) {
        setOcrError(result.warnings?.[0] || 'Не удалось распознать данные питания. Попробуйте более чёткий скриншот.');
      }
    } catch (e) { setOcrError('Ошибка: ' + (e instanceof Error ? e.message : String(e))); }
    finally { if (backup) clearTimeout(backup); if (hard) clearTimeout(hard); setOcrFileLoading(false); }
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

  const addCustomFood = useCallback(() => {
    const name = customFoodName.trim();
    if (!name) {
      showToast('❌ Введите название продукта');
      return;
    }
    setParsedItems(prev => [...prev, {
      name, kcal: Math.round(+customFoodKcal || 0),
      p: Math.round((+customFoodP || 0) * 10) / 10,
      f: Math.round((+customFoodF || 0) * 10) / 10,
      c: Math.round((+customFoodC || 0) * 10) / 10,
      qty: 100
    }]);
    setCustomFoodName(''); setCustomFoodKcal('100'); setCustomFoodP('10'); setCustomFoodF('5'); setCustomFoodC('10'); setShowCustomFood(false);
    showToast(`✅ ${name} → очередь`);
  }, [customFoodName, customFoodKcal, customFoodP, customFoodF, customFoodC, showToast]);

  const updateParsedItemQty = useCallback((idx: number, qty: number) => {
    setParsedItems(prev => prev.map((x, j) => j === idx ? { ...x, qty: Math.max(10, Math.min(1000, qty)) } : x));
  }, []);

  const extractQty = useCallback((item: any): number => {
    if (typeof item.qty === 'string') {
      const m = String(item.qty).match(/[\d.,]+/);
      if (m) return Math.max(10, Math.round(parseFloat(m[0].replace(',', '.')))) || 100;
    }
    if (typeof item.qty === 'number' && Number.isFinite(item.qty)) return Math.max(10, Math.round(item.qty));
    if (typeof item.qtyGrams === 'number' && Number.isFinite(item.qtyGrams)) return Math.max(10, Math.round(item.qtyGrams));
    return 100;
  }, []);

  const addPresetItems = useCallback((items: any[]) => {
    // Items in presets are stored per 100g; queue expects per-100 values + qty in grams
    setParsedItems(prev => [...prev, ...items.map((it: any) => ({
      name: it.name, kcal: it.kcal || 0, p: it.p || 0, f: it.f || 0, c: it.c || 0,
      qty: it.qty || 100, category: it.category, foodId: it.foodId,
    }))]);
    showToast(`📦 Набор "${items.length} поз." → очередь`);
  }, [showToast]);

  return {
    ocrText, setOcrText, parsedItems, setParsedItems, ocrError, ocrHint, ocrFileLoading,
    showCustomFood, setShowCustomFood,
    customFoodName, setCustomFoodName, customFoodKcal, setCustomFoodKcal, customFoodP, setCustomFoodP,
    customFoodF, setCustomFoodF, customFoodC, setCustomFoodC,
    addFoodFromDB, handleDirectAdd, handleBarcodeProduct,
    fillQueuedMicros, handleOcrFileUpload, handleOCR, saveItemsToDiary,
    addCustomFood, updateParsedItemQty, extractQty, addPresetItems,
  };
}
