import { useState, useCallback, useRef } from 'react';
import { type OFFProduct, productToFoodItem } from '../../../../../engines/openfoodfacts.engine';
import { fillMissingMicros, parseNutritionText, quantityToGrams, findFood } from '../../../../../engines/nutrition-ocr-parser';
import { processUploadedFile } from '../../../../../core/ocr-engine';
import { isFoodVisionAvailable, recognizeFoodOrLabel } from '../../../../../engines/food-vision.engine';
import { isCapacitorNative } from '../../../../../core/app-platform';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { type DiaryItem, type FoodItemLike } from '../../types';
import { readProgramRestrictions, summarizeImportChecks } from '../diary-import-guards';
import { touchFavorite } from '../food-favorites';
import { useLabelScan } from './useLabelScan';
import { buildRecipeDiaryEntry, recipeMicros, scaleDiaryRecipeMeta } from '../recipe-to-diary';
import { clampItemGrams } from '../portion-limits';
import type { Recipe } from '../../../../../engines/nutrition-periodization.engine';
import type { CustomFoodEntry } from '../../../../../engines/meal-custom-food';

export function useDiaryQueue({ diaryData, selectedDate, mealType, usdaFoods, saveDiary, showToast, bumpRefresh, setShowBarcode }: {
  diaryData: Record<string, any>;
  selectedDate: string;
  mealType: string;
  usdaFoods: FoodItemLike[];
  saveDiary: (data: any) => void;
  showToast: (msg: string) => void;
  bumpRefresh: () => void;
  setShowBarcode: (v: boolean) => void;
}) {
  const [ocrText, setOcrText] = useState('');
  const [parsedItems, setParsedItems] = useState<DiaryItem[]>([]);
  const [ocrError, setOcrError] = useState('');
  const [ocrHint, setOcrHint] = useState('');
  const [ocrFileLoading, setOcrFileLoading] = useState(false);
  /** 0..1 — прогресс распознавания скриншота (как у анализов), не «бегущий» текст. */
  const [ocrProgress, setOcrProgress] = useState(0);
  // Счётчик запросов распознавания: пока пользователь грузит второе фото,
  // ответ по первому не должен перетирать очередь (AI-путь идёт до 2 минут).
  const ocrRequestRef = useRef(0);
  const [showCustomFood, setShowCustomFood] = useState(false);
  const [customFoodName, setCustomFoodName] = useState('');
  const [customFoodKcal, setCustomFoodKcal] = useState('100');
  const [customFoodP, setCustomFoodP] = useState('10');
  const [customFoodF, setCustomFoodF] = useState('5');
  const [customFoodC, setCustomFoodC] = useState('10');

  const addFoodFromDB = useCallback((food: FoodItemLike, qty = 100) => {
    const grams = Math.max(10, Math.min(2000, Math.round(Number(qty) || 100)));
    setParsedItems(prev => [...prev, { name: food.name, kcal: food.kcal, p: food.protein, f: food.fat, c: food.carbs, qty: grams, category: food.category || 'other' }]);
    // Поиск НЕ сбрасываем: иначе после каждого «＋» список результатов
    // схлопывается и приходится искать заново — добавить несколько
    // продуктов подряд становится невозможно.
    try {
      // Снимок продукта кладём рядом с id: продукты сетей есть только в
      // выдаче, и без снимка они пропадали из «Избранного»/«Частого».
      touchFavorite({
        id: String(food.id || food.name),
        name: food.name,
        kcal: food.kcal,
        protein: food.protein,
        fat: food.fat,
        carbs: food.carbs,
        category: food.category,
      }, 12);
      bumpRefresh();
    } catch {}
  }, [bumpRefresh]);

  /**
   * Рецепт → очередь дневника. Одна позиция «блюдо целиком» с составом:
   * название, общее КБЖУ и КБЖУ каждого продукта (recipe.components).
   */
  const addRecipeToQueue = useCallback((recipe: Recipe, servings = 1, custom = false) => {
    const entry = buildRecipeDiaryEntry(recipe, { servings, custom });
    setParsedItems(prev => [...prev, entry]);
    bumpRefresh();
    showToast(`🍲 ${entry.name} → очередь (${entry.recipe?.components.length || 0} прод.)`);
  }, [bumpRefresh, showToast]);

  /** Продукт, распознанный с упаковки, — в очередь дневника (100 г). */
  const addCustomEntryToQueue = useCallback((entry: CustomFoodEntry) => {
    const micros: Record<string, number> = {};
    const microMap: Array<[string, number | undefined]> = [
      ['sodium_mg', entry.sodium_mg], ['potassium_mg', entry.potassium_mg],
      ['magnesium_mg', entry.magnesium_mg], ['calcium_mg', entry.calcium_mg],
      ['phosphorus_mg', entry.phosphorus_mg], ['zinc_mg', entry.zinc_mg],
      ['iron_mg', entry.iron_mg], ['selenium_mcg', entry.selenium_mcg],
      ['vitamin_a_mcg', entry.vitamin_a_mcg], ['vitamin_c_mg', entry.vitamin_c_mg],
      ['vitamin_d_mcg', entry.vitamin_d_mcg], ['vitamin_e_mg', entry.vitamin_e_mg],
      ['vitamin_k_mcg', entry.vitamin_k_mcg], ['vitamin_b12_mcg', entry.vitamin_b12_mcg],
    ];
    for (const [key, value] of microMap) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) micros[key] = value;
    }
    setParsedItems(prev => [...prev, {
      name: entry.name,
      kcal: entry.kcal,
      p: entry.protein,
      f: entry.fat,
      c: entry.carbs,
      qty: 100,
      category: entry.category,
      foodId: entry.id,
      barcode: entry.barcode,
      micros: Object.keys(micros).length > 0 ? micros : undefined,
      confidence: 0.95,
    }]);
    bumpRefresh();
  }, [bumpRefresh]);

  const labelScan = useLabelScan({ showToast, onAddToQueue: addCustomEntryToQueue });

  const handleDirectAdd = useCallback((food: FoodItemLike, qty = 100) => {
    const grams = Math.max(10, Math.min(2000, Math.round(Number(qty) || 100)));
    const factor = grams / 100;
    const data = { ...diaryData };
    if (!data[selectedDate]) data[selectedDate] = { meals: {} };
    const mt = mealType || 'Перекус';
    if (!data[selectedDate].meals[mt]) data[selectedDate].meals[mt] = [];
    (data[selectedDate].meals[mt] as any).push({
      name: food.name, qty: grams,
      kcal: Math.round((food.kcal || 0) * factor),
      p: Math.round((food.protein || 0) * factor * 10) / 10,
      f: Math.round((food.fat || 0) * factor * 10) / 10,
      c: Math.round((food.carbs || 0) * factor * 10) / 10,
      category: food.category, foodId: (food as any).id,
    });
    saveDiary(data);
    // Сверка с действующими ограничениями программы: дневник — факт, поэтому
    // предупреждаем, а не отказываем (тихий отказ съел бы реальную еду).
    const summary = summarizeImportChecks([{ name: food.name, foodId: (food as any).id, category: food.category }], readProgramRestrictions());
    showToast(summary.text || `⚡ ${food.name} → ${mt} ${grams}г`);
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
    // Штрихкод — единственный стабильный идентификатор товара из сети: в FOOD_DB
    // его нет, а имя меняется («Творог 5%» / «Творог 5%, 200г»). Без него запись
    // нельзя было ни найти, ни дедуплицировать при повторном сканировании.
    setParsedItems(prev => [...prev, { name: item.name, kcal: item.kcal, p: item.protein, f: item.fat, c: item.carbs, qty: 100, category: (item as any).category || 'other', foodId: (item as any).id, barcode: product.barcode, confidence: 1 }]);
    // Товар из сети почти всегда без id в FOOD_DB → сверка идёт по названию.
    const summary = summarizeImportChecks([{ name: item.name, foodId: (item as any).id, category: (item as any).category }], readProgramRestrictions());
    showToast(summary.text || `📷 ${item.name} → очередь (на 100 г)`);
  }, [setShowBarcode, showToast]);

  const convertOCRItems = useCallback((meals: { mealType: string; items: Array<{ name: string; qty: string; qtyGrams?: number; kcal: number; p: number; f: number; c: number; category?: string; foodId?: string; micros?: Record<string, number>; confidence?: number }> }[], usdaFallback?: FoodItemLike[]) => {
    return meals.flatMap(m => m.items.map(item => {
      // Русская упаковка/меню пишут порцию словом: «1 стакан», «2 шт», «1 ст. л.».
      // Наивный парсинг первого числа давал 1 шт → флор 10 г вместо ~240 г:
      // позиция молча уезжала в КБЖУ на порядок. Канон порций — тот же,
      // что у nutrition-ocr-parser при разборе текста.
      const catalogFood = findFood(item.name) as any;
      const grams = item.qtyGrams ?? (item.qty ? quantityToGrams(item.qty, catalogFood) : 100);
      const qty = Math.max(10, Math.round(grams || 100));
      let result: DiaryItem = { name: item.name || m.mealType || 'Блюдо', kcal: Math.round(item.kcal) || 0, p: Math.round((item.p || 0) * 10) / 10, f: Math.round((item.f || 0) * 10) / 10, c: Math.round((item.c || 0) * 10) / 10, qty, category: item.category, foodId: item.foodId, micros: item.micros, confidence: item.confidence };
      if (result.foodId == null && catalogFood?.id) result.foodId = catalogFood.id;
      if (!result.category && catalogFood?.category) result.category = catalogFood.category;
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
    const requestId = ++ocrRequestRef.current;
    setOcrFileLoading(true); setOcrError(''); setOcrProgress(0); setOcrHint(`⏳ Файл выбран: ${((file as any)?.size ? ((file.size/1024/1024).toFixed(2)+' МБ') : '…')} — загружаем…`);
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
      if (requestId !== ocrRequestRef.current) return;
      setOcrFileLoading(false);
      setOcrError(prev => (prev as any) || (nativeOcr ? 'Зависло на телефоне. Попробуйте фото при хорошем свете или вставьте текст вручную через «Текст».' : 'Зависло на телефоне. Попробуйте кнопку «Фото/файл» → выберите скриншот из галереи (не «Камера»).'));
    }, hardMs) as any;
    let lastPct = -1;
    let sawProgress = false;
    const onOcrProgress = (fraction: number) => {
      sawProgress = true;
      const safe = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
      setOcrProgress(safe);
      const pct = Math.round(safe * 100);
      if (pct >= lastPct + 10 || pct >= 100) {
        lastPct = pct;
        setOcrHint(`⏳ Распознаём скриншот… ${pct}% (текст+цифры КБЖУ)`);
      }
    };
    // Первый запуск оффлайн-движка (ядро + rus/eng traineddata) на телефоне
    // занимает 10-30с ДО первого процента прогресса. Без этой подсказки
    // экран выглядит как «зависло на загрузке».
    let stageTimer: number | undefined;
    // PDF/текст AI-зрение не касается: у них свой путь (лабы/парсер текста).
    // Всё остальное processUploadedFile считает изображением — тем же правилом
    // пользуемся здесь, чтобы fallback не срабатывал на .txt.
    const fileNameLower = typeof (file as any)?.name === 'string' ? (file as any).name : '';
    const isPdfLike = (file as any)?.type === 'application/pdf' || /\.pdf$/i.test(fileNameLower);
    const isTextLike = String((file as any)?.type || '').includes('text') || /\.(txt|csv)$/i.test(fileNameLower);
    const isImageFile = !isPdfLike && !isTextLike;
    try {
      stageTimer = window.setTimeout(() => {
        if (!sawProgress) setOcrHint('⏳ Готовим движок OCR (первый запуск дольше обычного)…');
      }, 12_000) as any;
      const result: any = await Promise.race([
        processUploadedFile(file, { onProgress: onOcrProgress }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(nativeOcr ? 'Оффлайн-распознавание не ответило за 120 секунд.' : 'Мобильный OCR не ответил за 45 секунд. Проверьте интернет и попробуйте скриншот меньшего размера.')), raceMs)),
        backupPromise,
      ]);
      // OCR уже ответил: гонки-таймеры сворачиваем здесь, а не в finally.
      // Иначе `backupPromise` отклоняется уже после того, как Promise.race
      // осел (необработанный rejection), а AI-fallback получает чужой бюджет.
      if (stageTimer) { clearTimeout(stageTimer); stageTimer = undefined; }
      if (backup) { clearTimeout(backup); backup = undefined; }
      if (hard) { clearTimeout(hard); hard = undefined; }
      if (requestId !== ocrRequestRef.current) return;
      setOcrText(result.text || '');
      setOcrProgress(1);
      if (result.meals.length > 0) {
        const converted = convertOCRItems(result.meals, usdaFoods);
        if (converted.length > 0) {
          setParsedItems(converted);
          setOcrError('');
          setOcrHint(`Распознано позиций: ${converted.length}. Проверьте очередь — тап по названию для правки. Сырой текст ниже.` );
        } else {
          setOcrError('Строки распознаны, но пищевые позиции не найдены. Попробуйте более чёткий снимок экрана MyFitnessPal/FatSecret или вставьте текст через «Текст».');
        }
      } else if (result.meals.length === 0 && result.labs.length === 0 && isImageFile && isFoodVisionAvailable()) {
        // OCR не нашёл позиций. Два случая: фото тарелки (текста нет) и фото
        // упаковки (текст есть, но таблица не разобрана). recognizeFoodOrLabel
        // сам выбирает порядок режимов, а КБЖУ раскладывает по контракту очереди.
        setOcrProgress(0);
        setOcrHint(result.text?.trim()
          ? '🏷 Текст есть, таблица не разобрана — AI читает упаковку…'
          : '🍽 Текст на фото не найден — AI определяет блюдо и порции…');
        const vision = await recognizeFoodOrLabel(file, { ocrText: result.text || '' });
        if (requestId !== ocrRequestRef.current) return;
        if (vision.ok && vision.meals.length > 0) {
          const converted = convertOCRItems(vision.meals, usdaFoods);
          if (converted.length > 0) {
            setParsedItems(converted);
            setOcrError('');
            setOcrHint((vision.mode === 'label'
              ? `🏷 AI прочитал упаковку: ${converted.length} поз. на 100 г — укажите съеденную граммовку.`
              : `🍽 AI-распознавание: ${converted.length} поз. Проверьте очередь — вес и состав правятся тапом.`)
              + (vision.warnings.length ? ` ${vision.warnings[0]}` : ''));
            return;
          }
        }
        // Причина отказа AI важнее общего warning от OCR: иначе «нет ключа»
        // или «провайдер перегружен» выглядит как «ничего не нашли».
        setOcrError(
          vision.error ||
            result.warnings?.[0] ||
            'Не удалось распознать данные питания. Попробуйте более чёткий скриншот.',
        );
      } else if (result.meals.length === 0 && result.labs.length === 0) {
        setOcrError(result.warnings?.[0] || 'Не удалось распознать данные питания. Попробуйте более чёткий скриншот.');
      }
    } catch (e) {
      // Ошибка устаревшего запроса не должна появляться поверх нового фото.
      if (requestId === ocrRequestRef.current) {
        setOcrError('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
      }
    }
    finally {
      if (stageTimer) clearTimeout(stageTimer);
      if (backup) clearTimeout(backup);
      if (hard) clearTimeout(hard);
      // Спиннер гасит только актуальный запрос: устаревший не должен снять
      // загрузку с нового фото.
      if (requestId === ocrRequestRef.current) setOcrFileLoading(false);
    }
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
      // Рецепт: сохраняем состав; если в очереди поменяли общий вес —
      // продукты пересчитываются пропорционально, чтобы итог и раскладка сходились.
      const recipeMeta = item.recipe
        ? scaleDiaryRecipeMeta(
            { ...item.recipe, name: item.name, totalWeight: item.recipe.totalWeight },
            item.recipe.totalWeight > 0 ? q / item.recipe.totalWeight : 1,
          )
        : undefined;
      // У блюда нет foodId — витамины/минералы берём из состава (иначе целый
      // приём выпадает из отчёта). Состав уже пересчитан на итоговый вес.
      const recipeMicrosValue = recipeMeta ? recipeMicros(recipeMeta.components) : undefined;
      data[selectedDate].meals[mt].push({
      // qty — число граммов (как у полей типа DiaryMealItem.qty). Строки «250 г»
      // остаются только в старых записях: читатели понимают оба формата.
        name: item.name, qty: q, kcal: Math.round(item.kcal * q / 100),
        p: Math.round((item.p * q / 100) * 10) / 10, f: Math.round((item.f * q / 100) * 10) / 10, c: Math.round((item.c * q / 100) * 10) / 10,
        category: item.category, foodId: item.foodId, barcode: item.barcode,
        micros: recipeMicrosValue ?? item.micros,
        qualityScore,
        ...(recipeMeta ? { recipe: recipeMeta } : {}),
      });
    });
    saveDiary(data);
    setParsedItems([]);
    setOcrText('');
    // Сверка очереди с действующими ограничениями программы. Пишем как факт
    // (еда реально съедена), но явно говорим, что позиция противоречит
    // настройкам рациона — иначе пользователь узнаёт об этом из отчёта.
    const summary = summarizeImportChecks(
      items.map(it => ({ name: it.name, foodId: it.foodId, category: it.category })),
      readProgramRestrictions(),
    );
    if (summary.text) {
      setOcrHint(summary.text);
      showToast(summary.text);
    } else {
      showToast(`✅ ${items.length} позиций → ${mt}`);
    }
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
    setParsedItems(prev => prev.map((x, j) => {
      if (j !== idx) return x;
      const next = clampItemGrams(qty);
      const prevQty = Number(x.qty) || 0;
      // Микронутриенты в очереди — на текущий вес позиции (так их считает
      // fillMissingMicros). Меняя граммовку, пересчитываем и их, иначе итог
      // по витаминам расходится с КБЖУ. У рецепта микро берутся из состава.
      const micros = x.micros && !x.recipe && prevQty > 0 && next !== prevQty
        ? Object.fromEntries(Object.entries(x.micros).map(([key, value]) => [
            key, Math.round(Number(value) * next / prevQty * 100) / 100,
          ]))
        : x.micros;
      return { ...x, qty: next, micros };
    }));
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
    // Items in presets are stored per 100g; queue expects per-100 values + qty in grams.
    // Состав рецепта и микронутриенты переносим как есть: иначе блюдо из набора
    // приходит одной строкой без продуктов и выпадает из отчёта по витаминам.
    const presetQty = (qty: any): number => {
      if (typeof qty === 'number' && Number.isFinite(qty)) return clampItemGrams(qty);
      const match = String(qty ?? '').match(/(\d+(?:[.,]\d+)?)/);
      return clampItemGrams(match ? Number(match[1].replace(',', '.')) : 100);
    };
    setParsedItems(prev => [...prev, ...items.map((it: any) => ({
      ...it,
      name: it.name, kcal: it.kcal || 0, p: it.p || 0, f: it.f || 0, c: it.c || 0,
      qty: presetQty(it.qty),
    }))]);
    showToast(`📦 Набор "${items.length} поз." → очередь`);
  }, [showToast]);

  return {
    ocrText, setOcrText, parsedItems, setParsedItems, ocrError, ocrHint, ocrFileLoading, ocrProgress,
    showCustomFood, setShowCustomFood,
    customFoodName, setCustomFoodName, customFoodKcal, setCustomFoodKcal, customFoodP, setCustomFoodP,
    customFoodF, setCustomFoodF, customFoodC, setCustomFoodC,
    addFoodFromDB, addRecipeToQueue, handleDirectAdd, handleBarcodeProduct,
    fillQueuedMicros, handleOcrFileUpload, handleOCR, saveItemsToDiary,
    addCustomFood, updateParsedItemQty, extractQty, addPresetItems,
    ...labelScan,
  };
}
