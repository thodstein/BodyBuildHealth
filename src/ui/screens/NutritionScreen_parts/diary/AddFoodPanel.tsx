import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FOOD_DB } from '../../../../core/nutrition-database';
import { CAT_MAP_EMOJI } from '../../../../core/nutrition-utils';
import { type FoodItemLike } from '../types';
import { BarcodeScanner } from '../../../components/BarcodeScanner';
import { type OFFProduct, productToFoodItem, searchByBarcode, searchByName as searchOFF } from '../../../../engines/openfoodfacts.engine';
import { RETAIL_CHAINS, RETAIL_RESULT_LIMIT, retailToFoodItem, searchRetailProducts, type RetailProduct } from '../../../../engines/retail-search.engine';
import { isCapacitorNative } from '../../../../core/app-platform';
import { parseNutritionText, findFood } from '../../../../engines/nutrition-ocr-parser';
import { readDiaryV2 } from '../diary-storage-v2';
import { LabelNutritionPanel, type LabelDraftView } from './LabelNutritionPanel';
import { customFoodToFoodItem } from '../../../../engines/meal-custom-food';
import { useCustomFoods } from './hooks/useCustomFoods';
import { readFavIds, toggleFavorite } from './food-favorites';

interface AddFoodPanelProps {
  foodSearch: string;
  onFoodSearchChange: (v: string) => void;
  debouncedSearch: string;
  usdaFoods: FoodItemLike[];
  mealType: string;
  onMealTypeChange: (v: string) => void;
  allMealTypes: string[];
  onAddFoodFromDB: (food: FoodItemLike) => void;
  onDirectAdd?: (food: FoodItemLike) => void;
  customMealInput: string;
  onCustomMealInputChange: (value: string) => void;
  onAddCustomMeal: () => void;
  onShowBarcode: () => void;
  onCloseBarcode: () => void;
  showBarcode: boolean;
  onBarcodeProduct: (product: OFFProduct) => void;
  labelOpen: boolean;
  labelLoading: boolean;
  labelProgress: number;
  labelHint: string;
  labelError: string;
  labelDraft: LabelDraftView | null;
  labelRawText: string;
  labelBarcodeLoading: boolean;
  onOpenLabelScan: () => void;
  onCloseLabelScan: () => void;
  onLabelCamera: () => void;
  onLabelGallery: () => void;
  onLabelFieldChange: (field: 'name' | 'kcal' | 'p' | 'f' | 'c' | 'fiber' | 'barcode', value: string) => void;
  onLabelSaveToBase: () => void;
  onLabelAddToDiary: () => void;
  onLabelBarcodeScan: () => void;
  onOcrFile: (file: File) => void;
  ocrFileLoading: boolean;
  /** 0..1 — прогресс распознавания скриншота (проценты как у анализов). */
  ocrProgress?: number;
  onShowOCR: () => void;
  showOCR: boolean;
  ocrText: string;
  onOcrTextChange: (v: string) => void;
  onOcrSubmit: () => void;
  ocrError: string;
  ocrHint?: string;
  onOcrClose: () => void;
  parsedItems: any[];
  onRemoveParsedItem: (idx: number) => void;
  onUpdateParsedItemQty: (idx: number, qty: number) => void;
  onFillMicros: () => void;
  onSaveItems: () => void;
  onEditParsedItem?: (idx: number, item: any) => void;
  onFixAllLowConfidence?: () => void;
  favoriteFoods: any[];
  mealPresets: any[];
  onAddPreset: (items: any[]) => void;
  showCustomFood: boolean;
  onToggleCustomFood: () => void;
  customFoodName: string;
  onCustomFoodNameChange: (v: string) => void;
  customFoodKcal: string;
  customFoodP: string;
  customFoodF: string;
  customFoodC: string;
  onCustomFoodFieldChange: (field: string, v: string) => void;
  onAddCustomFood: () => void;
  ocrFileRef: React.RefObject<HTMLInputElement>;
  ocrCameraRef: React.RefObject<HTMLInputElement>;
  /** Очистить всю очередь (кнопка в шапке очереди). */
  onClearQueue?: () => void;
  /** Дополнительные блоки под поиском (частые продукты, недавние). */
  below?: React.ReactNode;
  /** Избранное изменилось — попросить дневник перечитать список. */
  onFavoritesChanged?: () => void;
}

const fmt = (v: number) => Math.round((v || 0) * 10) / 10;

/** Быстрые запросы для пустого поиска: то, что ищут чаще всего. */
const POPULAR_QUERIES = ['творог', 'куриная грудка', 'гречка', 'кефир', 'яйца', 'овсянка', 'банан', 'рис'];

/** 8–14 цифр — это штрихкод (EAN-8/13, UPC, ITF-14), а не название продукта. */
const isBarcodeQuery = (q: string) => /^\d{8,14}$/.test((q || '').trim());

export const AddFoodPanel: React.FC<AddFoodPanelProps> = ({
  foodSearch, onFoodSearchChange, debouncedSearch, usdaFoods, mealType, onMealTypeChange,
  allMealTypes, onAddFoodFromDB, onDirectAdd, customMealInput, onCustomMealInputChange, onAddCustomMeal, onShowBarcode, onCloseBarcode, showBarcode, onBarcodeProduct,
  labelOpen, labelLoading, labelProgress, labelHint, labelError, labelDraft, labelRawText, labelBarcodeLoading,
  onOpenLabelScan, onCloseLabelScan, onLabelCamera, onLabelGallery, onLabelFieldChange, onLabelSaveToBase, onLabelAddToDiary, onLabelBarcodeScan,
  onOcrFile,
  ocrFileLoading, ocrProgress = 0, onShowOCR, showOCR, ocrText, onOcrTextChange, onOcrSubmit, ocrError, ocrHint, onOcrClose,
  parsedItems, onRemoveParsedItem, onUpdateParsedItemQty, onFillMicros, onSaveItems, onEditParsedItem,
  onFixAllLowConfidence,
  favoriteFoods, mealPresets, onAddPreset, showCustomFood, onToggleCustomFood,
  customFoodName, onCustomFoodNameChange, customFoodKcal, customFoodP, customFoodF, customFoodC,
  onCustomFoodFieldChange, onAddCustomFood, ocrFileRef, ocrCameraRef, onClearQueue, below, onFavoritesChanged,
}) => {
  // АПК: системная камера/галерея вместо сырого file-input (в WebView он
  // открывается через раз). Перехват клика по плитке «Фото».
  // Свои продукты (в т.ч. распознанные с упаковки) ищем в той же строке, что
  // и FOOD_DB: иначе сохранённый продукт есть в базе, но найти его нельзя.
  const customFoods = useCustomFoods();
  const handlePhotoTile = async (e: React.MouseEvent) => {
    if (!isCapacitorNative()) return;
    e.preventDefault();
    if (ocrFileLoading) return;
    try {
      const { pickPhoto } = await import('../../../../core/native-bridge');
      const photo = await pickPhoto();
      if (!photo) return;
      // data: URL напрямую в Blob: fetch(data:) в части WebView режется CSP.
      let blob: Blob | null = null;
      try {
        const { dataUrlToBlob } = await import('../../../../engines/ocr-preprocess');
        blob = dataUrlToBlob(photo.uri);
      } catch { /* fallback ниже */ }
      if (!blob) blob = await (await fetch(photo.uri)).blob();
      const file = new File([blob], `food.${photo.format || 'jpg'}`, { type: blob.type || 'image/jpeg' });
      onOcrFile(file);
    } catch {
      try { ocrFileRef.current?.click(); } catch { /* ignore */ }
    }
  };

  const query = debouncedSearch.trim();
  const hasQuery = query.length > 0;

  // ── Мгновенная обратная связь: продукт попал в очередь ───────────────────
  const [lastQueued, setLastQueued] = useState('');
  const lastQueuedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (lastQueuedTimer.current) clearTimeout(lastQueuedTimer.current); }, []);
  /** Что именно добавили — чтобы «Отменить» снимало нужную позицию. */
  const lastQueuedRef = useRef<{ name: string; idx: number } | null>(null);
  const queueFood = (food: any) => {
    lastQueuedRef.current = { name: String(food?.name || ''), idx: parsedItems.length };
    onAddFoodFromDB(food);
    setLastQueued(String(food?.name || ''));
    if (lastQueuedTimer.current) clearTimeout(lastQueuedTimer.current);
    lastQueuedTimer.current = setTimeout(() => setLastQueued(''), 3500);
  };
  /** «＋» нажали случайно — один тап возвращает как было. */
  const undoLastQueued = () => {
    const rec = lastQueuedRef.current;
    if (rec) {
      let idx = rec.idx;
      const at = parsedItems[idx];
      if (!at || String(at.name) !== rec.name) {
        const same = parsedItems
          .map((it, i) => ({ name: String(it?.name || ''), i }))
          .filter(x => x.name === rec.name)
          .map(x => x.i);
        idx = same.length ? same[same.length - 1] : -1;
      }
      if (idx >= 0) onRemoveParsedItem(idx);
    }
    lastQueuedRef.current = null;
    setLastQueued('');
    if (lastQueuedTimer.current) clearTimeout(lastQueuedTimer.current);
  };

  // ── ⭐ в результатах поиска ──────────────────────────────────────────────
  // Подсказка «добавляйте ⭐ из поиска» раньше была неправдой: звезды в этом
  // листе не было. Теперь любимый продукт (в т.ч. из сети) попадает в
  // «Избранное» и «Частое» одним тапом.
  const [favIds, setFavIds] = useState<string[]>(() => readFavIds());
  const toggleFav = (food: any) => {
    const id = String(food?.id || food?.name || '');
    if (!id) return;
    toggleFavorite({
      id,
      name: String(food.name || 'Продукт'),
      kcal: food.kcal, protein: food.protein, fat: food.fat, carbs: food.carbs,
      category: food.category,
    });
    setFavIds(readFavIds());
    try { onFavoritesChanged?.(); } catch { /* ignore */ }
  };
  const favButton = (food: any) => {
    const on = favIds.includes(String(food?.id || food?.name || ''));
    return (
      <button
        onClick={(e) => { e.stopPropagation(); toggleFav(food); }}
        aria-label={on ? 'Убрать из избранного' : 'В избранное'}
        aria-pressed={on}
        title={on ? 'Убрать из избранного' : 'В избранное'}
        className="nd-fav-toggle"
        data-fav={on ? 'true' : undefined}
        style={{
          width: 36, height: 44, flexShrink: 0,
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontSize: 15, lineHeight: 1, padding: 0,
          color: on ? '#fbbf24' : 'rgba(255,255,255,0.32)',
        }}
      >
        {on ? '★' : '☆'}
      </button>
    );
  };
  const queueKcal = parsedItems.reduce(
    (sum, it) => sum + Math.round(((it.kcal || 0) * (it.qty || 100)) / 100), 0,
  );

  const foodSearchResults = useMemo(() => {
    if (query.length < 2) return [];
    const norm = (s: unknown) => String(s || '').toLowerCase().replace(/ё/g, 'е').trim();
    const q = norm(query);
    const tokens = q.split(/\s+/).filter(t => t.length > 1);
    if (tokens.length === 0) tokens.push(q);
    const hasAll = (text: unknown) => {
      const t = norm(text);
      return tokens.every(tok => t.includes(tok));
    };
    /** 0 — точное имя, 1 — имя с этого слова, 2 — все слова есть в имени,
     *  3 — имя содержит запрос, 4 — совпадение по бренду/описанию, -1 — не подходит.
     *  Без ранжирования «Творог 5%» тонул под «Сырниками творожными». */
    const score = (f: any): number => {
      const n = norm(f.name);
      const words = n.split(/[\s,()/–—-]+/);
      if (n === q) return 0;
      if (n.startsWith(q)) return 1;
      if (tokens.every(tok => words.some(w => w.startsWith(tok)))) return 2;
      if (tokens.every(tok => n.includes(tok))) return 3;
      if (hasAll(f.brand) || hasAll(f.description)) return 4;
      return -1;
    };
    const take = (list: any[], cap: number) => list
      .map(f => ({ f, s: score(f) }))
      .filter(x => x.s >= 0)
      .sort((a, b) => a.s - b.s)
      .slice(0, cap)
      .map(x => x.f);
    const custom = take(customFoods.map(customFoodToFoodItem), 8);
    const internal = take(FOOD_DB as any[], 24);
    const usda = take(usdaFoods, 24);
    const seen = new Set<string>();
    const out: any[] = [];
    for (const f of [...custom, ...internal, ...usda]) {
      const key = String(f.id || f.name || '').toLowerCase();
      if (key && seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
    return out.slice(0, 40);
  }, [query, usdaFoods, customFoods]);

  const [history, setHistory] = useState<string[]>(() => { try { const v = JSON.parse(localStorage.getItem('he_search_history') || '[]'); return Array.isArray(v) ? v.filter((x: any) => typeof x === 'string').slice(0, 5) : []; } catch { return []; } });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [customMealOpen, setCustomMealOpen] = useState(false);
  /**
   * Карточка сырого текста: раскрыта, когда распознавать больше нечего
   * (позиций нет) — там же кнопки «Разобрать» и «Добавить».
   * null = пользователь ещё не трогал, берём значение по умолчанию.
   */
  const [rawTextOpen, setRawTextOpen] = useState<boolean | null>(null);
  const [quickTab, setQuickTab] = useState<'fav' | 'recent' | 'last' | 'presets'>('fav');
  const [lastAdded, setLastAdded] = useState<any[]>(() => {
    try {
      const diary = readDiaryV2();
      const all: any[] = [];
      Object.values(diary as any).forEach((day: any) => {
        Object.values(day.meals || {}).forEach((items: any) => (items as any[]).forEach(it => all.push(it)));
      });
      const seen = new Map<string, any>();
      for (let i = all.length - 1; i >= 0 && seen.size < 8; i--) {
        const it = all[i];
        const key = (it.foodId || it.name || '').toLowerCase();
        if (key && !seen.has(key)) seen.set(key, it);
      }
      return [...seen.values()];
    } catch { return []; }
  });
  const [internetResults, setInternetResults] = useState<any[]>([]);
  const [isSearchingNet, setIsSearchingNet] = useState(false);
  const [retailResults, setRetailResults] = useState<RetailProduct[]>([]);
  const [isSearchingRetail, setIsSearchingRetail] = useState(false);
  /** null — ещё не спрашивали; false — бэкенд/сети не отвечают. */
  const [retailAvailable, setRetailAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (query && !isBarcodeQuery(query) && foodSearchResults.length > 0) {
      setHistory(prev => {
        if (prev[0] === query) return prev;
        const next = [query, ...prev.filter(x => x !== query)].slice(0, 5);
        try { localStorage.setItem('he_search_history', JSON.stringify(next)); } catch {}
        return next;
      });
    }
  }, [query, foodSearchResults.length]);

  useEffect(() => {
    if (!showQuickAdd) return;
    try {
      const diary = readDiaryV2();
      const all: any[] = [];
      Object.values(diary as any).forEach((day: any) => {
        Object.values(day.meals || {}).forEach((items: any) => (items as any[]).forEach(it => all.push(it)));
      });
      const seen = new Map<string, any>();
      for (let i = all.length - 1; i >= 0 && seen.size < 8; i--) {
        const it = all[i];
        const key = (it.foodId || it.name || '').toLowerCase();
        if (key && !seen.has(key)) seen.set(key, it);
      }
      setLastAdded([...seen.values()]);
    } catch {}
  }, [showQuickAdd, parsedItems.length]);

  useEffect(() => {
    const q = query;
    if (!q || q.length < 3 || isBarcodeQuery(q)) { setInternetResults([]); return; }
    let cancelled = false;
    setIsSearchingNet(true);
    searchOFF(q, 16).then(res => {
      if (cancelled) return;
      const mapped = res.map(productToFoodItem as any).filter((f: any) => f && f.kcal > 0).slice(0, 16);
      setInternetResults(mapped);
    }).catch(() => { if (!cancelled) setInternetResults([]); }).finally(() => { if (!cancelled) setIsSearchingNet(false); });
    return () => { cancelled = true; };
  }, [query]);

  // ── Штрихкод, вставленный в поиск («4600…») — ищем сразу по нему ─────────
  const barcodeQuery = isBarcodeQuery(query) ? query : '';
  const [barcodeFood, setBarcodeFood] = useState<any>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  useEffect(() => {
    if (!barcodeQuery) { setBarcodeFood(null); setBarcodeLoading(false); return; }
    let cancelled = false;
    setBarcodeLoading(true);
    searchByBarcode(barcodeQuery)
      .then(p => { if (!cancelled) setBarcodeFood(p ? productToFoodItem(p) : null); })
      .catch(() => { if (!cancelled) setBarcodeFood(null); })
      .finally(() => { if (!cancelled) setBarcodeLoading(false); });
    return () => { cancelled = true; };
  }, [barcodeQuery]);

  useEffect(() => {
    const q = query;
    if (!q || q.length < 2 || isBarcodeQuery(q)) { setRetailResults([]); return; }
    let cancelled = false;
    setIsSearchingRetail(true);
    // 24 = 3 сети × 8 позиций: раньше забирали 9 суммарно, поэтому
    // «супермаркеты» выглядели почти пустыми.
    searchRetailProducts(q, RETAIL_RESULT_LIMIT).then(res => {
      if (cancelled) return;
      setRetailAvailable(res.available);
      setRetailResults(res.available ? res.items.slice(0, RETAIL_RESULT_LIMIT) : []);
    }).catch(() => { if (!cancelled) { setRetailAvailable(false); setRetailResults([]); } }).finally(() => { if (!cancelled) setIsSearchingRetail(false); });
    return () => { cancelled = true; };
  }, [query]);

  // После распознавания очередь продуктов должна быть видна сразу.
  // При активном поиске НЕ скроллим: иначе выдача «улетает» из-под пальца.
  const queueRef = useRef<HTMLDivElement>(null);
  const ocrPanelRef = useRef<HTMLDivElement>(null);
  const prevParsedCount = useRef(parsedItems.length);
  useEffect(() => {
    const prev = prevParsedCount.current;
    prevParsedCount.current = parsedItems.length;
    if (prev === 0 && parsedItems.length > 0 && !hasQuery) {
      const el = queueRef.current;
      if (el && typeof el.scrollIntoView === 'function') {
        try { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch { /* WebView без options */ }
      }
    }
  }, [parsedItems.length, hasQuery]);

  // Открыли «Текст» — сразу показываем панель вставки.
  useEffect(() => {
    if (!showOCR) return;
    const el = ocrPanelRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      try { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch { /* WebView без options */ }
    }
  }, [showOCR]);

  const [editingIdx, setEditingIdx] = useState<number>(-1);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState(100);
  const [editKcal, setEditKcal] = useState(0);
  const [editP, setEditP] = useState(0);
  const [editF, setEditF] = useState(0);
  const [editC, setEditC] = useState(0);

  const startEdit = (idx: number, item: any) => {
    setEditingIdx(idx);
    setEditName(item.name || '');
    setEditQty(item.qty || 100);
    setEditKcal(Math.round(item.kcal || 0));
    setEditP(Math.round((item.p || 0) * 10) / 10);
    setEditF(Math.round((item.f || 0) * 10) / 10);
    setEditC(Math.round((item.c || 0) * 10) / 10);
  };

  const saveEdit = () => {
    if (editingIdx < 0 || !onEditParsedItem) return;
    onEditParsedItem(editingIdx, {
      name: editName || 'Блюдо',
      qty: Math.max(10, editQty),
      kcal: Math.max(0, editKcal),
      p: Math.max(0, editP),
      f: Math.max(0, editF),
      c: Math.max(0, editC),
    });
    setEditingIdx(-1);
  };

  // Дубли между источниками: «Творог 5%» есть и в базе, и в интернете — не
  // показываем одну и ту же позицию дважды (в интернете прячем совпадения по имени).
  const internetUnique = useMemo(() => {
    const taken = new Set<string>();
    for (const f of foodSearchResults) taken.add(String(f.name || '').toLowerCase().replace(/ё/g, 'е').trim());
    for (const p of retailResults) taken.add(String(p.name || '').toLowerCase().replace(/ё/g, 'е').trim());
    return internetResults.filter(f => {
      const key = String(f.name || '').toLowerCase().replace(/ё/g, 'е').trim();
      return key ? !taken.has(key) : true;
    });
  }, [foodSearchResults, retailResults, internetResults]);

  const totalFound = foodSearchResults.length + retailResults.length + internetUnique.length;
  const showEmpty = hasQuery && query.length >= 2 && !barcodeQuery && totalFound === 0 && !isSearchingNet && !isSearchingRetail;

  // ── Общие стили строк результата ─────────────────────────────────────────
  const rowStyle: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 12, color: '#fff', display: 'flex',
    alignItems: 'center', gap: 8, minHeight: 56, background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.04)',
  };
  const nameStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, lineHeight: 1.3,
    whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word',
  };
  const metaStyle: React.CSSProperties = {
    display: 'flex', flexWrap: 'wrap', gap: '2px 8px', fontSize: 9,
    color: 'rgba(255,255,255,0.65)', marginTop: 3, fontVariantNumeric: 'tabular-nums',
  };
  const addBtnStyle: React.CSSProperties = {
    padding: '5px 8px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13,
    cursor: 'pointer', minHeight: 44, minWidth: 44, flexShrink: 0,
  };
  const nowBtnStyle: React.CSSProperties = {
    padding: '5px 9px', borderRadius: 9, border: 'none',
    background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000',
    fontSize: 11, fontWeight: 800, cursor: 'pointer', minHeight: 44, flexShrink: 0,
  };
  const sectionHead = (color: string): React.CSSProperties => ({
    fontSize: 11, fontWeight: 800, color, marginBottom: 6, display: 'flex',
    alignItems: 'center', gap: 6, flexWrap: 'wrap',
  });

  const macros = (kcal: number, p: number, f: number, c: number) => (
    <div style={metaStyle}>
      <span style={{ color: '#00e68a', fontWeight: 800 }}>{Math.round(kcal)} ккал</span>
      <span style={{ color: '#60a5fa' }}>Б {fmt(p)}</span>
      <span style={{ color: '#fbbf24' }}>Ж {fmt(f)}</span>
      <span style={{ color: '#fb923c' }}>У {fmt(c)}</span>
    </div>
  );

  return (
    <div className="nd-add" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Верх: поиск и приём пищи. Не скроллится — всегда под рукой. ── */}
      <div className="nd-add-top" style={{ flexShrink: 0, padding: '10px 12px 8px', background: '#141417', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="text" value={foodSearch} onChange={e => onFoodSearchChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); } }}
            aria-label="Поиск продуктов" placeholder="🔍 Продукт или бренд: Простоквашино, ВкусВилл…"
            className="nd-search-input" inputMode="search" enterKeyHint="search"
            autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
            style={{ flex: 1, padding: '12px 14px', borderRadius: 12, background: '#202023',
              border: '1px solid rgba(255,255,255,0.07)', color: '#fff', fontSize: 16, boxSizing: 'border-box',
              outline: 'none', minHeight: 48 }} />
          {foodSearch && <button onClick={() => onFoodSearchChange('')} aria-label="Очистить поиск" className="nd-search-clear" style={{ width: 44, height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</button>}
        </div>

        <div className="nd-mealchips" style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', marginTop: 8, paddingBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', alignSelf: 'center', flexShrink: 0 }}>Приём:</span>
          {allMealTypes.map(mt => {
            const isActive = mealType === mt;
            const icon = mt.toLowerCase().includes('завтрак') ? '🌅' : mt.toLowerCase().includes('обед') ? '☀️' : mt.toLowerCase().includes('ужин') ? '🌙' : mt.toLowerCase().includes('перекус') ? '🍿' : mt.toLowerCase().includes('трениров') ? '💪' : '🍽';
            return (
              <button key={mt} onClick={() => onMealTypeChange(isActive ? '' : mt)}
                aria-label={`Приём: ${mt}`} aria-pressed={isActive} data-active={isActive} className="nd-mealchip"
                style={{ padding: '9px 13px', borderRadius: 999, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  background: isActive ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023',
                  border: isActive ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.07)',
                  color: isActive ? '#000' : '#fff', fontWeight: isActive ? 800 : 500,
                  minHeight: 40 }}>
                <span style={{ fontSize: 11 }}>{icon}</span> {mt}
              </button>
            );
          })}
          <button onClick={() => setCustomMealOpen(v => !v)} aria-label={customMealOpen ? 'Скрыть новый приём' : 'Новый приём пищи'}
            className="nd-mealchip"
            style={{ padding: '9px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer', flexShrink: 0, minHeight: 40,
              background: customMealOpen ? 'rgba(139,92,246,0.16)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${customMealOpen ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
              color: customMealOpen ? '#a78bfa' : 'rgba(255,255,255,0.75)' }}>
            {customMealOpen ? '✕' : '＋ свой'}
          </button>
        </div>

        {customMealOpen && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input value={customMealInput} onChange={e => onCustomMealInputChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onAddCustomMeal(); }}
              placeholder="Название приёма (например: Перед сном)" aria-label="Новый тип приёма пищи"
              className="nd-custommeal-input"
              style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.07)', color: '#fff', fontSize: 16, minHeight: 44 }} />
            <button onClick={onAddCustomMeal} aria-label="Добавить тип приёма пищи" className="nd-custommeal-add"
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.10)', color: '#00e68a', fontSize: 13, minHeight: 44, minWidth: 44 }}>＋</button>
          </div>
        )}
      </div>

      {/* ── Скроллируемое тело: результаты/инструменты/очередь ── */}
      <div className={`nd-add-body${hasQuery ? ' nd-add-body--search' : ''}`} style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', padding: '10px 12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Статус фото-распознавания, когда панель «Текст» закрыта:
            иначе ошибка/подсказка просто не видна. */}
        {!showOCR && ocrError && (
          <div role="alert" className="nd-ocr-err nd-ocr-err-bar"
            style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: '#fca5a5', fontSize: 11, lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0 }}>{ocrError}</span>
            <button onClick={onShowOCR} aria-label="Открыть текст" style={{ flexShrink: 0, padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.30)', background: 'rgba(239,68,68,0.12)', color: '#fecaca', fontSize: 10, fontWeight: 700, cursor: 'pointer', minHeight: 36 }}>Текст</button>
          </div>
        )}
        {!showOCR && ocrHint && !ocrError && !ocrFileLoading && (
          <div role="status" className="nd-ocr-hint nd-ocr-hint-bar"
            style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.16)', color: '#86efac', fontSize: 11, lineHeight: 1.35 }}>
            {ocrHint}
          </div>
        )}

        {/* Тост «добавлено» — чтобы «＋» ощущалось как действие, а не «ничего» */}
        {lastQueued && (
          <div role="status" aria-live="polite" className="nd-queued-toast"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 12,
              background: 'rgba(0,230,138,0.10)', border: '1px solid rgba(0,230,138,0.25)', color: '#86efac', fontSize: 11, fontWeight: 700 }}>
            <span aria-hidden>✓</span>
            <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>В очереди: {lastQueued}</span>
            <button type="button" onClick={undoLastQueued} aria-label="Отменить добавление" title="Убрать из очереди"
              className="nd-queued-undo"
              style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              ↩
            </button>
            <button type="button" onClick={() => {
              const el = queueRef.current;
              if (el && typeof el.scrollIntoView === 'function') {
                try { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch { /* noop */ }
              }
            }} aria-label="Показать очередь" className="nd-queued-open"
              style={{ flexShrink: 0, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.25)',
                background: 'rgba(0,230,138,0.12)', color: '#00e68a', fontSize: 10, fontWeight: 800, cursor: 'pointer', minHeight: 32 }}>
              {parsedItems.length} поз. ↓
            </button>
          </div>
        )}

        {/* Очередь: при пустом поиске — первой (сразу видно, что добавлено),
            при активном поиске — ниже результатов (CSS order), чтобы выдача
            не «прыгала» после каждого «＋». */}
        {parsedItems.length > 0 && (
          <div ref={queueRef} className="nd-queue" style={{ padding: 12, borderRadius: 16, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.18)', scrollMarginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#00e68a', fontWeight: 800 }}>📋 На очереди ({parsedItems.length})</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }}>{queueKcal} ккал</span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'rgba(0,230,138,0.10)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.18)' }}>{mealType || 'Приём пищи'}</span>
              {onClearQueue && (
                <button onClick={() => { setEditingIdx(-1); onClearQueue(); }} aria-label="Очистить очередь" title="Очистить очередь"
                  style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.10)', color: '#f87171', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>🗑</button>
              )}
            </div>

            {parsedItems.map((item, i) => {
              const q = item.qty || 100;
              const kcal = Math.round(item.kcal * q / 100);
              const p = fmt((item.p || 0) * q / 100);
              const f = fmt((item.f || 0) * q / 100);
              const c = fmt((item.c || 0) * q / 100);
              const isLowConf = typeof item.confidence === 'number' && item.confidence < 0.5;
              const isEditing = editingIdx === i;

              return (
                <div key={i} className="nd-queueitem" style={{ padding: '10px 12px', borderRadius: 12, background: isEditing ? 'rgba(245,158,11,0.06)' : '#202023', border: `1px solid ${isEditing ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.06)'}`, marginBottom: 6 }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Название"
                        aria-label="Название блюда" className="nd-qedit-name"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 16, minHeight: 44 }} />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                        {[
                          { l: 'г', v: editQty, f: setEditQty },
                          { l: 'ккал', v: editKcal, f: setEditKcal },
                          { l: 'Б', v: editP, f: setEditP },
                          { l: 'Ж', v: editF, f: setEditF },
                          { l: 'У', v: editC, f: setEditC },
                        ].map((x, xi) => (
                          <div key={xi}>
                            <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginBottom: 1, display: 'block' }}>{x.l}</label>
                            <input type="number" value={x.v} onChange={e => x.f(Number.parseFloat(e.target.value) || 0)}
                              aria-label={x.l} className="nd-qedit-num"
                              style={{ width: '100%', padding: '6px', borderRadius: 6, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 16, minHeight: 44, boxSizing: 'border-box' }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button onClick={saveEdit} aria-label="Сохранить правку" className="nd-qedit-save" style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700, fontSize: 12, minHeight: 44 }}>✓</button>
                        <button onClick={() => setEditingIdx(-1)} aria-label="Отменить правку" className="nd-qedit-cancel" style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#18181b', color: 'rgba(255,255,255,0.7)', fontSize: 12, minHeight: 44 }}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.3, overflowWrap: 'anywhere', cursor: isLowConf ? 'pointer' : 'default', textDecoration: isLowConf ? 'underline dotted' : 'none' }} onClick={() => isLowConf && startEdit(i, item)}>{item.name}</span>
                          {isLowConf && (
                            <span onClick={() => startEdit(i, item)} style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, background: 'rgba(245,158,11,0.12)', padding: '2px 6px', borderRadius: 6, cursor: 'pointer' }}>⚠ проверьте</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          {!isLowConf && (
                            <button onClick={() => startEdit(i, item)} aria-label="Изменить"
                              style={{ padding: '4px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontSize: 12, minHeight: 44, minWidth: 44 }}>
                              ✎
                            </button>
                          )}
                          <button onClick={() => onRemoveParsedItem(i)} aria-label="Удалить"
                            style={{ padding: '4px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 12, minHeight: 44, minWidth: 44 }}>
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className="nd-qtyrow" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#18181b', borderRadius: 10, padding: '2px 4px' }}>
                          <button onClick={() => onUpdateParsedItemQty(i, Math.max(10, q - 10))} aria-label="Уменьшить"
                            className="nd-qtybtn"
                            style={{ width: 44, height: 44, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.06)',
                              color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            −
                          </button>
                          <button onClick={() => startEdit(i, item)} aria-label={`Изменить количество: ${q} г`}
                            className="nd-qtyval"
                            style={{ minWidth: 52, height: 44, borderRadius: 10, border: 'none', background: 'transparent',
                              color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', padding: 0 }}>
                            {q}г
                          </button>
                          <button onClick={() => onUpdateParsedItemQty(i, Math.min(1000, q + 10))} aria-label="Увеличить"
                            className="nd-qtybtn"
                            style={{ width: 44, height: 44, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.06)',
                              color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            +
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
                          {[50, 100, 200, 300].map(v => (
                            <button key={v} onClick={() => onUpdateParsedItemQty(i, v)} aria-label={`${v} грамм`} aria-pressed={q === v} className="nd-qpreset"
                              style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
                                background: q === v ? 'rgba(0,230,138,0.12)' : '#18181b',
                                color: q === v ? '#00e68a' : 'rgba(255,255,255,0.7)', cursor: 'pointer',
                                fontSize: 11, fontWeight: q === v ? 700 : 400, minHeight: 44 }}>
                              {v}г
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10 }}>
                        <span style={{ color: '#00e68a', fontWeight: 700 }}>{kcal} ккал</span>
                        <span style={{ color: '#60a5fa' }}>Б {p}г</span>
                        <span style={{ color: '#fbbf24' }}>Ж {f}г</span>
                        <span style={{ color: '#fb923c' }}>У {c}г</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {parsedItems.some(item => typeof item.confidence === 'number' && item.confidence < 0.5) && onFixAllLowConfidence && (
                <button onClick={onFixAllLowConfidence} aria-label="Исправить все"
                  style={{ flex: 1, minWidth: 130, padding: '10px', borderRadius: 10, border: '1px solid rgba(245,158,11,0.25)',
                    background: 'rgba(245,158,11,0.06)', color: '#fbbf24', cursor: 'pointer', fontSize: 12, fontWeight: 700, minHeight: 44 }}>
                  ⚡ Исправить все ({parsedItems.filter(item => typeof item.confidence === 'number' && item.confidence < 0.5).length})
                </button>
              )}
              <button onClick={onFillMicros} aria-label="Микронутриенты"
                style={{ flex: 1, minWidth: 130, padding: '10px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.2)',
                  background: 'rgba(34,197,94,0.06)', color: '#86efac', cursor: 'pointer', fontSize: 12, fontWeight: 700, minHeight: 44 }}>
                ✨ Микронутриенты
              </button>
            </div>
            {/* Второй «зелёный» CTA под очередью спорил с нижней строкой
                листа: оставляем спокойную вторичную кнопку. */}
            <button onClick={onSaveItems} aria-label="Добавить позиции в дневник" className="nd-ocr-add-inline"
              style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 10, cursor: 'pointer',
                background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.25)', color: '#00e68a',
                fontWeight: 700, fontSize: 11, minHeight: 44 }}>
              💾 Добавить {parsedItems.length} поз. в дневник
            </button>
          </div>
        )}

        {/* OCR-панель */}
        {showOCR && (
          <div ref={ocrPanelRef} className="nd-ocr" style={{ padding: 14, borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.06)', scrollMarginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Скриншот из приложения калорий</span>
              <button onClick={onOcrClose} aria-label="Закрыть OCR"
                style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 10, minHeight: 32 }}>
                ✕
              </button>
            </div>
            <textarea aria-label="Текст для распознавания" value={ocrText} onChange={e => onOcrTextChange(e.target.value)}
              placeholder="Курица 200 г 330 ккал Б:35 Ж:7 У:0"
              className="nd-ocr-text"
              style={{ width: '100%', minHeight: 88, padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
                background: '#202023', color: '#fff', fontSize: 16, resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }} />
            <button onClick={onOcrSubmit} aria-label="Распознать"
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700,
                fontSize: 12, cursor: 'pointer', minHeight: 44 }}>
              ✨ Распознать
            </button>

            {ocrFileLoading && (
              <div role="status" aria-live="polite" className="nd-ocr-progress"
                style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.18)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11, fontWeight: 700, color: '#86efac' }}>
                  <span>Распознаю скриншот…</span>
                  <span aria-label="Прогресс распознавания" style={{ fontVariantNumeric: 'tabular-nums', color: '#00e68a' }}>{ocrProgress > 0 ? `${Math.round(ocrProgress * 100)}%` : '—'}</span>
                </div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(4, Math.min(100, Math.round(ocrProgress * 100)))}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#00e68a,#00c8a0)', transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
                  {ocrProgress > 0 ? 'Распознавание на устройстве…' : 'Отправляю скриншот… (первый запуск дольше обычного)'}
                </div>
              </div>
            )}

            {ocrError && (
              <div role="alert" className="nd-ocr-err" style={{ marginTop: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 11, lineHeight: 1.35 }}>
                {ocrError}
              </div>
            )}
            {ocrHint && !ocrError && !ocrFileLoading && (
              <div className="nd-ocr-hint" style={{ marginTop: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: '#86efac', fontSize: 11, lineHeight: 1.35 }}>
                {ocrHint}
              </div>
            )}
          </div>
        )}

        {/* ── Результаты поиска (полноэкранно, без обрезки названий) ── */}
        {hasQuery && (
          <div className="nd-results" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>
              <span role="status" aria-live="polite">🔎 Найдено: <b style={{ color: '#fff' }}>{totalFound}</b></span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>· КБЖУ на 100 г</span>
              {(isSearchingRetail || isSearchingNet) && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#00e68a' }}>
                  <span style={{ width: 11, height: 11, border: '2px solid rgba(0,230,138,0.3)', borderTop: '2px solid #00e68a', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  ищем ещё…
                </span>
              )}
            </div>

            {barcodeQuery && (
              <div className="nd-barcode-result" style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.16)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>🔢</span>
                {barcodeLoading ? (
                  <span role="status" aria-live="polite" style={{ fontSize: 11, color: '#60a5fa' }}>Ищем штрихкод {barcodeQuery}…</span>
                ) : barcodeFood ? (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={nameStyle}>{barcodeFood.name}</div>
                      <div style={{ ...metaStyle, color: 'rgba(96,165,250,0.85)' }}>штрихкод {barcodeQuery}</div>
                      {macros(barcodeFood.kcal, barcodeFood.protein, barcodeFood.fat, barcodeFood.carbs)}
                    </div>
                    <button onClick={() => queueFood(barcodeFood)} aria-label="В очередь" className="nd-addq"
                      style={{ ...addBtnStyle, border: '1px solid rgba(59,130,246,0.18)', background: 'rgba(59,130,246,0.08)', color: '#60a5fa' }}>＋</button>
                    {onDirectAdd && <button onClick={() => onDirectAdd(barcodeFood)} aria-label="Сразу в дневник" className="nd-addnow"
                      style={{ ...nowBtnStyle, background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: '#fff' }}>⚡ 100г</button>}
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                    Штрихкод {barcodeQuery} не найден в базе — попробуйте отсканировать камерой (кнопка «Штрих-код»).
                  </span>
                )}
              </div>
            )}

            {foodSearchResults.length > 0 && (
              <div>
                <div className="nd-nethead" style={sectionHead('#00e68a')}>
                  <span>🥗 База продуктов</span>
                  <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 999, background: 'rgba(0,230,138,0.12)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.18)' }}>{foodSearchResults.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {foodSearchResults.map(f => (
                    <div key={f.id} className="nd-result" style={rowStyle}>
                      <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{CAT_MAP_EMOJI[f.category || 'other'] || '📦'}</span>
                      <button onClick={() => queueFood(f)} role="button" aria-label={`Добавить ${f.name}`}
                        style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: '#fff' }}>
                        <div style={nameStyle}>{f.name}</div>
                        {macros(f.kcal, f.protein, f.fat, f.carbs)}
                        {f.description ? <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 2, overflowWrap: 'anywhere' }}>{f.description}</div> : null}
                      </button>
                      <button onClick={() => queueFood(f)} title="В очередь (потом Сохранить)" aria-label="В очередь" className="nd-addq" style={addBtnStyle}>＋</button>
                      {onDirectAdd && <button onClick={() => onDirectAdd(f)} title={`Сразу в ${mealType || 'дневник'} 100г`} aria-label="Сразу в дневник" className="nd-addnow" style={nowBtnStyle}>⚡ 100г</button>}
                      {favButton(f)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(isSearchingRetail || retailResults.length > 0) && (
              <div>
                <div className="nd-nethead" style={sectionHead('#00e68a')}>
                  <span>🏪 Супермаркеты РФ</span>
                  {retailResults.length > 0 && (
                    <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 999, background: 'rgba(0,230,138,0.12)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.18)' }}>{retailResults.length}</span>
                  )}
                  {Array.from(new Set(retailResults.map(p => RETAIL_CHAINS[p.source]?.label).filter(Boolean))).map(label => (
                    <span key={label} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>{label}</span>
                  ))}
                </div>
                {isSearchingRetail && retailResults.length === 0 && (
                  <div style={{ fontSize: 10, color: 'rgba(0,230,138,0.85)', padding: '10px 12px', background: 'rgba(0,230,138,0.05)', borderRadius: 10, border: '1px solid rgba(0,230,138,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 12, border: '2px solid rgba(0,230,138,0.3)', borderTop: '2px solid #00e68a', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    🏪 Ищем в каталогах сетей…
                  </div>
                )}
                {retailResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {retailResults.map(p => {
                      const meta = RETAIL_CHAINS[p.source];
                      if (!meta) return null;
                      return (
                        <div key={`${p.source}-${p.id}`} className="nd-netrow" style={{ ...rowStyle, background: 'rgba(0,230,138,0.03)', border: '1px solid rgba(0,230,138,0.10)' }}>
                          <button onClick={() => queueFood(retailToFoodItem(p) as any)} role="button" aria-label={`Добавить ${p.name} из ${meta.label}`}
                            style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: `${meta.color}1c`, color: meta.color, border: `1px solid ${meta.color}35`, whiteSpace: 'nowrap' }}>{meta.emoji} {meta.label}</span>
                              <span style={nameStyle}>{p.name}</span>
                            </div>
                            <div style={{ ...metaStyle, color: 'rgba(255,255,255,0.55)' }}>
                              {p.brand ? <span>• {p.brand}</span> : null}
                              {p.weight ? <span>{p.weight}</span> : null}
                              <span style={{ color: '#00e68a', fontWeight: 800 }}>{p.kcal} ккал</span>
                              <span style={{ color: '#60a5fa' }}>Б {p.protein}</span>
                              <span style={{ color: '#fbbf24' }}>Ж {p.fat}</span>
                              <span style={{ color: '#fb923c' }}>У {p.carbs}</span>
                            </div>
                          </button>
                          <button onClick={() => queueFood(retailToFoodItem(p) as any)} title="В очередь (потом Сохранить)" aria-label="В очередь" className="nd-addq" style={{ ...addBtnStyle, border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.08)', color: '#00e68a' }}>＋</button>
                          {onDirectAdd && <button onClick={() => onDirectAdd(retailToFoodItem(p) as any)} title={`Сразу в ${mealType || 'дневник'} 100г`} aria-label="Сразу в дневник" className="nd-addnow" style={nowBtnStyle}>⚡ 100г</button>}
                          {favButton(retailToFoodItem(p) as any)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Сети реально недоступны (бэкенд/403) — говорим об этом прямо,
                иначе пустой раздел «супермаркеты» выглядит как баг. */}
            {hasQuery && !isSearchingRetail && retailAvailable === false && (
              <div className="nd-retail-off" style={{ fontSize: 10, lineHeight: 1.35, color: 'rgba(255,255,255,0.5)', padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                🏪 Каталоги сетей сейчас недоступны — показаны база продуктов и бренды РФ.
              </div>
            )}

            {(isSearchingNet || internetUnique.length > 0) && (
              <div>
                <div className="nd-nethead" style={sectionHead('#60a5fa')}>
                  <span>🌐 Бренды РФ и интернет</span>
                  {internetUnique.length > 0 && (
                    <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 999, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.18)' }}>{internetUnique.length}</span>
                  )}
                </div>
                {isSearchingNet && internetUnique.length === 0 && (
                  <div style={{ fontSize: 10, color: 'rgba(96,165,250,0.85)', padding: '10px 12px', background: 'rgba(59,130,246,0.06)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 12, border: '2px solid rgba(96,165,250,0.3)', borderTop: '2px solid #60a5fa', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    🌐 Ищем российские бренды…
                  </div>
                )}
                {internetUnique.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {internetUnique.map(f => (
                      <div key={f.id} className="nd-netrow" style={{ ...rowStyle, background: 'rgba(59,130,246,0.03)', border: '1px solid rgba(59,130,246,0.10)' }}>
                        <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>🌐</span>
                        <button onClick={() => queueFood(f)} role="button" aria-label={`Добавить ${f.name}`}
                          style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: '#fff' }}>
                          <div style={nameStyle}>{f.name}</div>
                          {f.brand ? <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 2, overflowWrap: 'anywhere' }}>🏷 {f.brand}</div> : null}
                          {macros(f.kcal, f.protein, f.fat, f.carbs)}
                        </button>
                        <button onClick={() => queueFood(f)} aria-label="В очередь" className="nd-addq" style={{ ...addBtnStyle, border: '1px solid rgba(59,130,246,0.18)', background: 'rgba(59,130,246,0.08)', color: '#60a5fa' }}>＋</button>
                        {onDirectAdd && <button onClick={() => onDirectAdd(f)} aria-label="Сразу в дневник" className="nd-addnow" style={{ ...nowBtnStyle, background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: '#fff' }}>⚡ 100г</button>}
                        {favButton(f)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showEmpty && (
              <div className="nd-noresult" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', padding: '16px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>Ничего не найдено по «{query}».</div>
                <div style={{ fontSize: 10, marginTop: 4, color: 'rgba(255,255,255,0.45)' }}>Попробуйте другое написание или создайте продукт вручную.</div>
                <button onClick={() => { if (query && !customFoodName) onCustomFoodNameChange(query); onToggleCustomFood(); }} style={{ marginTop: 10, padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.10)', color: '#a78bfa', fontWeight: 700, fontSize: 12, cursor: 'pointer', minHeight: 44 }}>🍎 Своя еда</button>
              </div>
            )}
          </div>
        )}

        {/* ── Инструменты и быстрые действия (когда поиск пуст) ── */}
        {!hasQuery && (
          <>
            <div className="nd-tools" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              <button type="button" onClick={onShowBarcode} aria-label="Штрих-код"
                style={{ padding: '10px 4px', borderRadius: 12, fontSize: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: showBarcode ? 'linear-gradient(135deg, rgba(0,230,138,0.18), rgba(0,200,160,0.08))' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${showBarcode ? 'rgba(0,230,138,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  color: showBarcode ? '#00e68a' : 'rgba(255,255,255,0.85)', minHeight: 58, fontWeight: 700 }}>
                <span style={{ fontSize: 18 }}>📱</span>
                <span>Штрих-код</span>
              </button>
              <label onClick={handlePhotoTile} style={{ padding: '10px 4px', borderRadius: 12, fontSize: 10, cursor: ocrFileLoading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: ocrFileLoading ? 'linear-gradient(135deg, rgba(0,230,138,0.18), rgba(0,200,160,0.08))' : 'rgba(139,92,246,0.06)',
                border: `1px solid ${ocrFileLoading ? 'rgba(0,230,138,0.3)' : 'rgba(139,92,246,0.14)'}`,
                color: ocrFileLoading ? '#00e68a' : 'rgba(255,255,255,0.9)', minHeight: 58, fontWeight: 700, justifyContent: 'center', pointerEvents: ocrFileLoading ? 'none' : 'auto' }}>
                <input ref={ocrFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0] as File | undefined; e.currentTarget.value = ''; onOcrFile(f as any); }} />
                <span style={{ fontSize: 18 }}>{ocrFileLoading ? '⏳' : '📸'}</span>
                <span>{ocrFileLoading ? 'Сканируем…' : 'Фото'}</span>
              </label>
              <button onClick={onShowOCR} aria-label="Текст"
                style={{ padding: '10px 4px', borderRadius: 12, fontSize: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: showOCR ? 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(59,130,246,0.08))' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${showOCR ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  color: showOCR ? '#60a5fa' : 'rgba(255,255,255,0.85)', minHeight: 58, fontWeight: 700 }}>
                <span style={{ fontSize: 18 }}>📋</span>
                <span>Текст</span>
              </button>
              <button type="button" onClick={labelOpen ? onCloseLabelScan : onOpenLabelScan} aria-label="КБЖУ с упаковки камерой"
                aria-expanded={labelOpen} className="nd-label-open"
                style={{ padding: '10px 4px', borderRadius: 12, fontSize: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: labelOpen ? 'rgba(0,230,138,0.16)' : 'rgba(0,230,138,0.05)',
                  border: `1px solid ${labelOpen ? 'rgba(0,230,138,0.35)' : 'rgba(0,230,138,0.16)'}`,
                  color: labelOpen ? '#00e68a' : 'rgba(255,255,255,0.9)', minHeight: 58, fontWeight: 700 }}>
                <span style={{ fontSize: 18 }}>🏷</span>
                <span>С упаковки</span>
              </button>
            </div>

            <LabelNutritionPanel
              open={labelOpen} loading={labelLoading} progress={labelProgress} hint={labelHint}
              error={labelError} draft={labelDraft} rawText={labelRawText} barcodeLoading={labelBarcodeLoading}
              onCamera={onLabelCamera} onGallery={onLabelGallery} onClose={onCloseLabelScan}
              onFieldChange={onLabelFieldChange} onSaveToBase={onLabelSaveToBase}
              onAddToDiary={onLabelAddToDiary} onScanBarcode={onLabelBarcodeScan}
            />

            {/* Популярные запросы — чтобы пустой поиск не был пустым экраном */}
            {history.length === 0 && (
              <div className="nd-popular" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>Часто ищут:</span>
                {POPULAR_QUERIES.map(q => (
                  <button key={q} onClick={() => onFoodSearchChange(q)} aria-label={`Искать ${q}`} className="nd-hist"
                    style={{ padding: '9px 13px', borderRadius: 999, fontSize: 11, minHeight: 40, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.14)', color: '#86efac', cursor: 'pointer' }}>{q}</button>
                ))}
              </div>
            )}

            {history.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>История:</span>
                {history.map(h => (
                  <button key={h} onClick={() => onFoodSearchChange(h)} className="nd-hist" style={{ padding: '10px 14px', borderRadius: 999, fontSize: 11, minHeight: 40, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)', cursor: 'pointer' }}>{h}</button>
                ))}
                <button onClick={() => { setHistory([]); try { localStorage.removeItem('he_search_history'); } catch {} }} aria-label="Очистить историю" style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            )}

            <button onClick={() => setShowQuickAdd(v => !v)} style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: `1px solid ${showQuickAdd ? 'rgba(0,230,138,0.25)' : 'rgba(255,255,255,0.06)'}`, background: showQuickAdd ? 'rgba(0,230,138,0.10)' : 'rgba(255,255,255,0.03)', color: showQuickAdd ? '#00e68a' : 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>⚡</span>
              <span>Быстрое добавление</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.7 }}>{showQuickAdd ? '▲' : '▼'}</span>
            </button>
            {showQuickAdd && (
              <div style={{ padding: 10, borderRadius: 14, background: 'rgba(18,18,20,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="nd-qtabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {[
                    { id: 'fav', label: '⭐ Избранное', count: favoriteFoods.length },
                    { id: 'recent', label: '🔍 Запросы', count: history.length },
                    { id: 'last', label: '🆕 Последние', count: lastAdded.length },
                    { id: 'presets', label: '📦 Наборы', count: mealPresets.length },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setQuickTab(tab.id as any)} aria-pressed={quickTab === tab.id} data-active={quickTab === tab.id} className="nd-qtab" style={{ flex: '1 1 auto', padding: '9px 6px', borderRadius: 10, fontSize: 10, fontWeight: quickTab === tab.id ? 700 : 500, cursor: 'pointer', minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, background: quickTab === tab.id ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.03)', border: `1px solid ${quickTab === tab.id ? 'rgba(0,230,138,0.3)' : 'rgba(255,255,255,0.06)'}`, color: quickTab === tab.id ? '#00e68a' : 'rgba(255,255,255,0.65)' }}>
                      {tab.label}
                      {tab.count > 0 && <span style={{ background: quickTab === tab.id ? '#00e68a' : 'rgba(255,255,255,0.08)', color: quickTab === tab.id ? '#000' : 'rgba(255,255,255,0.65)', padding: '1px 5px', borderRadius: 999, fontSize: 9, fontWeight: 700 }}>{tab.count}</span>}
                    </button>
                  ))}
                </div>
                {quickTab === 'fav' && (
                  favoriteFoods.length > 0 ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {favoriteFoods.slice(0, 8).map(f => (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
                          <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{CAT_MAP_EMOJI[f.category || 'other'] || '📦'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', overflowWrap: 'anywhere' }}>{f.name}</div>
                            <div style={{ display: 'flex', gap: 6, fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 2, flexWrap: 'wrap' }}>
                              <span style={{ color: '#00e68a', fontWeight: 700 }}>{f.kcal} ккал</span>
                              <span>Б{fmt(f.protein)}</span><span>Ж{fmt(f.fat)}</span><span>У{fmt(f.carbs)}</span>
                            </div>
                          </div>
                          <button onClick={() => queueFood(f)} aria-label="В очередь" className="nd-favadd" style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 44, minWidth: 44 }}>＋</button>
                          {onDirectAdd && <button onClick={() => onDirectAdd(f)} aria-label="Сразу в дневник" className="nd-favnow" style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.08)', color: '#00e68a', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 44, minWidth: 44 }}>⚡</button>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '14px', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Нет избранного — добавляйте ⭐ из поиска</div>
                  )
                )}
                {quickTab === 'recent' && (
                  history.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {history.map(h => {
                          const food = findFood(h);
                          return (
                            <button key={h} onClick={() => onFoodSearchChange(h)} style={{ padding: '7px 12px', borderRadius: 999, fontSize: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>🕒</span> {h}
                              {food && <span style={{ background: 'rgba(0,230,138,0.12)', color: '#00e68a', padding: '1px 6px', borderRadius: 999, fontSize: 9 }}>＋</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                      <div style={{ display: 'grid', gap: 6 }}>
                        {history.slice(0, 4).map(h => {
                          const f = findFood(h);
                          if (!f) return null;
                          return (
                            <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                              <span style={{ fontSize: 14 }}>{CAT_MAP_EMOJI[f.category || 'other'] || '📦'}</span>
                              <span style={{ flex: 1, fontSize: 11, color: '#fff', fontWeight: 500, overflowWrap: 'anywhere' }}>{f.name}</span>
                              <button onClick={() => queueFood(f)} aria-label="В очередь" className="nd-histadd" style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, cursor: 'pointer', minHeight: 44 }}>＋ В очередь</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '14px', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>История пуста — ваши поисковые запросы появятся здесь</div>
                  )
                )}
                {quickTab === 'last' && (
                  lastAdded.length > 0 ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {lastAdded.map((it: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.12)' }}>
                          <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{CAT_MAP_EMOJI[it.category || 'other'] || '📦'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', overflowWrap: 'anywhere' }}>{it.name}</div>
                            <div style={{ display: 'flex', gap: 6, fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                              <span style={{ color: '#00e68a', fontWeight: 700 }}>{it.kcal} ккал</span>
                              <span>{it.qty || '100г'}</span>
                            </div>
                          </div>
                          <button onClick={() => queueFood({ id: it.foodId || it.name, name: it.name, kcal: it.kcal, protein: it.p || 0, fat: it.f || 0, carbs: it.c || 0, category: it.category } as any)} aria-label="Добавить последнее" className="nd-lastadd" style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 44, minWidth: 44 }}>＋</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '14px', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Нет последних — добавь еду в дневник</div>
                  )
                )}
                {quickTab === 'presets' && (
                  mealPresets.length > 0 ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {mealPresets.map((p, i) => (
                        <div key={i} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg,#00e68a,#00c8a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>📦</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', overflowWrap: 'anywhere' }}>{p.name}</div>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>{p.items?.length || 0} продуктов • {p.items?.reduce((s: any, it: any) => s + (it.kcal || 0), 0) || 0} ккал</div>
                          </div>
                          <button onClick={() => onAddPreset(p.items)} aria-label="Добавить набор" className="nd-presetadd" style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', minHeight: 44 }}>Добавить</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '14px', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Нет сохранённых наборов — собери продукты и сохрани как пресет</div>
                  )
                )}
              </div>
            )}

            {below}
          </>
        )}

        {/* Сырой текст — отдельная карточка, действие добавления прямо в ней */}
        {ocrText && !hasQuery && (
          <details className="nd-ocr-raw"
            open={rawTextOpen ?? parsedItems.length === 0}
            onToggle={(e) => setRawTextOpen((e.currentTarget as HTMLDetailsElement).open)}
            style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.16)', fontSize: 12 }}>
            <summary style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              🧾 Текст со скриншота
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(59,130,246,0.14)', color: '#93c5fd' }}>
                {ocrText.split(/\r?\n/).filter(l => l.trim()).length} стр. · {ocrText.length} симв.
              </span>
            </summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8, marginBottom: 8, padding: 10, borderRadius: 10, background: '#141417', color: 'rgba(255,255,255,0.72)', fontSize: 11, lineHeight: 1.45, maxHeight: 160, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)' }}>{ocrText.slice(0, 1500)}</pre>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => { try { void navigator.clipboard?.writeText(ocrText); } catch { /* нет буфера */ } }} aria-label="Копировать текст"
                style={{ flex: 1, minWidth: 100, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 700, cursor: 'pointer', minHeight: 44 }}>
                📋 Копировать
              </button>
              <button onClick={onOcrSubmit} aria-label="Разобрать заново"
                style={{ flex: 1, minWidth: 100, padding: '10px', borderRadius: 10, border: '1px solid rgba(59,130,246,0.22)', background: 'rgba(59,130,246,0.08)', color: '#93c5fd', fontSize: 11, fontWeight: 700, cursor: 'pointer', minHeight: 44 }}>
                🔁 Разобрать
              </button>
              <button onClick={onSaveItems} disabled={parsedItems.length === 0} aria-label="Добавить в дневник"
                style={{ flex: 1.4, minWidth: 110, padding: '10px', borderRadius: 10, border: 'none', background: parsedItems.length ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : 'rgba(255,255,255,0.06)', color: parsedItems.length ? '#000' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 800, cursor: parsedItems.length ? 'pointer' : 'not-allowed', minHeight: 44 }}>
                ➕ Добавить
              </button>
            </div>
          </details>
        )}

        {/* Своя еда — всегда доступна внизу */}
        <button onClick={onToggleCustomFood} aria-label="Своя еда" className="nd-cfood-toggle"
          style={{ width: '100%', padding: '11px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
            background: showCustomFood ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${showCustomFood ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.06)'}`,
            color: showCustomFood ? '#a78bfa' : 'rgba(255,255,255,0.85)', minHeight: 46, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ width: 22, height: 22, borderRadius: 8, background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>🍎</span>
          {showCustomFood ? '✕ Скрыть' : 'Своя еда (ввести вручную)'}
        </button>

        {showCustomFood && (
          <div className="nd-cfood-panel" style={{ padding: 12, borderRadius: 14, background: '#202023', border: '1px solid rgba(139,92,246,0.15)' }}>
            <input value={customFoodName} onChange={e => onCustomFoodNameChange(e.target.value)} placeholder="Название"
              aria-label="Название своей еды" className="nd-cfood-name"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: '#18181b',
                border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 16, marginBottom: 8, boxSizing: 'border-box', minHeight: 48 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { l: 'Ккал', v: customFoodKcal, f: 'customFoodKcal' },
                { l: 'Белки', v: customFoodP, f: 'customFoodP' },
                { l: 'Жиры', v: customFoodF, f: 'customFoodF' },
                { l: 'Угл.', v: customFoodC, f: 'customFoodC' },
              ].map((x, i) => (
                <div key={i}>
                  <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 2, display: 'block' }}>{x.l}</label>
                  <input type="number" value={x.v} onChange={e => onCustomFoodFieldChange(x.f, e.target.value)}
                    aria-label={x.l} className="nd-cfood-num"
                    style={{ width: '100%', padding: '8px', borderRadius: 8, background: '#18181b',
                      border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 16, boxSizing: 'border-box', minHeight: 44 }} />
                </div>
              ))}
            </div>
            <button onClick={onAddCustomFood} aria-label="Добавить свою еду" className="nd-cfood-add" style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 10,
              border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c8a0)',
              color: '#000', fontWeight: 700, fontSize: 12, minHeight: 48 }}>
              + Добавить
            </button>
          </div>
        )}
      </div>

      {showBarcode && (
        <BarcodeScanner
          onProductFound={onBarcodeProduct}
          onClose={onCloseBarcode}
          onLabelScan={() => { onCloseBarcode(); onOpenLabelScan(); }}
        />
      )}
      <input ref={ocrCameraRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={() => {}} />

      {/* ── Нижняя строка добавления: один раз и навсегда внизу листа ── */}
      {parsedItems.length > 0 && (
        <div className="nd-ocr-actions" style={{ position: 'sticky', bottom: 'var(--tabbar-lift, calc(var(--nav-height, 76px) + max(env(safe-area-inset-bottom, 0px), 28px) + 18px))', zIndex: 22, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px calc(8px + max(env(safe-area-inset-bottom, 0px), 12px))', background: 'linear-gradient(180deg, rgba(24,24,27,0.98), #18181b)', borderTop: '1px solid rgba(0,230,138,0.18)', boxShadow: '0 -6px 20px rgba(0,0,0,0.35)' }}>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#00e68a', fontVariantNumeric: 'tabular-nums' }}>{queueKcal} ккал</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>{parsedItems.length} поз. · {mealType || 'без приёма'}</span>
          </div>
          <button onClick={onSaveItems} aria-label="Сохранить" className="nd-ocr-add"
            style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#00e68a,#00c8a0)',
              color: '#000', fontWeight: 800, fontSize: 13, minHeight: 48,
              boxShadow: '0 4px 16px rgba(0,230,138,0.22)' }}>
            💾 Добавить {parsedItems.length} поз. в дневник
          </button>
        </div>
      )}
    </div>
  );
};
