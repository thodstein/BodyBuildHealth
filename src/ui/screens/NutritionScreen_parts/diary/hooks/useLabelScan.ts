import { useCallback, useRef, useState } from 'react';
import { processUploadedFile } from '../../../../../core/ocr-engine';
import { isCapacitorNative } from '../../../../../core/app-platform';
import { parseNutritionLabel, labelToCustomFood, type ParsedNutritionLabel } from '../../../../../engines/nutrition-label-parser';
import { saveOrUpdateCustomFood, type CustomFoodEntry } from '../../../../../engines/meal-custom-food';
import type { LabelDraftView } from '../LabelNutritionPanel';

interface LabelDraftInternal extends LabelDraftView {
  micros: Record<string, number>;
  brand?: string;
}

interface Options {
  showToast: (message: string) => void;
  onAddToQueue: (entry: CustomFoodEntry) => void;
}

function dataUrlToFile(uri: string, format: string): Promise<File> {
  return (async () => {
    let blob: Blob | null = null;
    try {
      const { dataUrlToBlob } = await import('../../../../../engines/ocr-preprocess');
      blob = dataUrlToBlob(uri);
    } catch { /* fallback ниже */ }
    if (!blob) blob = await (await fetch(uri)).blob();
    return new File([blob], `label.${format || 'jpg'}`, { type: blob.type || 'image/jpeg' });
  })();
}

function buildDraft(parsed: ParsedNutritionLabel): LabelDraftInternal {
  return {
    name: parsed.name,
    kcal: parsed.kcal,
    p: parsed.protein,
    f: parsed.fat,
    c: parsed.carbs,
    fiber: parsed.fiber,
    barcode: '',
    confidence: parsed.confidence,
    basis: parsed.basis,
    warnings: parsed.warnings,
    micros: parsed.micros || {},
    brand: parsed.brand,
    savedToBase: false,
  };
}

export function useLabelScan({ showToast, onAddToQueue }: Options) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<LabelDraftInternal | null>(null);
  const [rawText, setRawText] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const requestRef = useRef(0);

  const persist = useCallback((value: LabelDraftInternal, opts?: { silent?: boolean; keepId?: string | null; rawText?: string }): CustomFoodEntry => {
    // Текст распознавания передаём явно: после setRawText() в том же тике
    // state ещё старый, и в labelText попал бы предыдущий снимок.
    const text = opts?.rawText ?? rawText;
    const entry = labelToCustomFood({
      name: value.name.trim() || 'Продукт с упаковки',
      brand: value.brand,
      kcal: value.kcal,
      protein: value.p,
      fat: value.f,
      carbs: value.c,
      fiber: value.fiber,
      micros: value.micros,
      servingSize: '100 г',
      basis: value.basis,
      confidence: value.confidence,
      rawText: text,
      warnings: value.warnings,
    }, { id: opts?.keepId || undefined, barcode: value.barcode, brand: value.brand });

    const saved = saveOrUpdateCustomFood(entry);
    setSavedId(saved.id);
    setDraft(prev => prev ? { ...prev, savedToBase: true } : prev);

    const barcode = (value.barcode || '').replace(/\D/g, '');
    if (barcode.length >= 8) {
      // Кладём и в локальный кэш OFF, и в общую базу: сканер штрихкодов
      // проверяет кэш первым и находит продукт без сети. Fire-and-forget —
      // отсутствие Supabase/интернета не должно отменять локальное сохранение.
      void (async () => {
        try {
          const off = await import('../../../../../engines/openfoodfacts.engine');
          const product = {
            id: barcode,
            barcode,
            name: saved.name,
            brand: saved.brand,
            category: saved.category,
            kcal: saved.kcal,
            protein: saved.protein,
            fat: saved.fat,
            carbs: saved.carbs,
            fiber: saved.fiber,
            servingSize: saved.servingSize,
            cachedAt: Date.now(),
          } as import('../../../../../engines/openfoodfacts.engine').OFFProduct;
          await off.saveToCache(product);
          const shared = await import('../../../../../engines/food-barcode-catalog.engine');
          await shared.saveSharedBarcode(product);
        } catch { /* оффлайн — локальная запись уже есть */ }
      })();
    }

    if (!opts?.silent) {
      showToast(`🏷 «${saved.name}» сохранён в базу (на 100 г)`);
    }
    return saved;
  }, [rawText, showToast]);

  const handlePick = useCallback(async (source: 'camera' | 'gallery') => {
    if (loading) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError('');
    setHint(source === 'camera' ? 'Открываем камеру…' : 'Открываем галерею…');
    setProgress(0);
    try {
      const bridge = await import('../../../../../core/native-bridge');
      const photo = source === 'camera' ? await bridge.pickCameraPhoto() : await bridge.pickPhoto();
      if (!photo) {
        if (requestId === requestRef.current) {
          setError(source === 'camera'
            ? 'Камера не открылась или снимок отменён. Разрешите камеру в настройках приложения и попробуйте снова.'
            : 'Фото не выбрано. Попробуйте ещё раз.');
        }
        return;
      }
      setHint('Распознаём этикетку…');
      const file = await dataUrlToFile(photo.uri, photo.format);
      const native = isCapacitorNative();
      const timeoutMs = native ? 140_000 : 55_000;
      const result = await Promise.race([
        processUploadedFile(file, {
          purpose: 'nutrition',
          onProgress: (fraction) => {
            if (requestId !== requestRef.current) return;
            setProgress(fraction);
            const pct = Math.round(fraction * 100);
            setHint(`Читаем КБЖУ… ${pct}%`);
          },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(native
          ? 'Распознавание не ответило за 140 секунд. Сфотографируйте только блок «Пищевая ценность» при хорошем свете.'
          : 'Распознавание не ответило за 55 секунд. Попробуйте фото меньшего размера.')), timeoutMs)),
      ]);
      if (requestId !== requestRef.current) return;
      setRawText(result.text || '');
      const parsed = parseNutritionLabel(result.text || '');
      if (!parsed) {
        setError(result.warnings?.[0]
          ? `Не удалось найти КБЖУ: ${result.warnings[0]}`
          : 'На фото не найден блок «Пищевая ценность» с ккал/БЖУ. Сфотографируйте таблицу крупным планом.');
        return;
      }
      const nextDraft = buildDraft(parsed);
      setDraft(nextDraft);
      setSavedId(null);
      setHint('');
      persist(nextDraft, { rawText: result.text || '' });
    } catch (err) {
      if (requestId === requestRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [loading, persist]);

  const handleFieldChange = useCallback((field: 'name' | 'kcal' | 'p' | 'f' | 'c' | 'fiber' | 'barcode', value: string) => {
    setDraft(prev => {
      if (!prev) return prev;
      if (field === 'name' || field === 'barcode') return { ...prev, [field]: value };
      const numericValue = Number.parseFloat(value.replace(',', '.'));
      return { ...prev, [field]: Number.isFinite(numericValue) ? numericValue : 0 };
    });
  }, []);

  const handleSaveToBase = useCallback(() => {
    if (!draft) return;
    persist(draft, { keepId: savedId });
  }, [draft, persist, savedId]);

  const handleAddToDiary = useCallback(() => {
    if (!draft) return;
    const saved = persist(draft, { keepId: savedId, silent: true });
    onAddToQueue(saved);
    showToast(`➕ «${saved.name}» → очередь (${saved.kcal} ккал/100 г)`);
  }, [draft, onAddToQueue, persist, savedId, showToast]);

  const handleScanBarcode = useCallback(async () => {
    if (barcodeLoading) return;
    setBarcodeLoading(true);
    setError('');
    try {
      const { scanNativeBarcode } = await import('../../../../../core/native-bridge');
      const outcome = await scanNativeBarcode();
      if (outcome.status === 'scanned') {
        setDraft(prev => prev ? { ...prev, barcode: outcome.code } : prev);
        showToast('📷 Штрихкод считан — нажмите «Обновить в базе», чтобы привязать его');
      } else if (outcome.status === 'denied') {
        setError('Нет доступа к камере. Разрешите камеру или введите штрихкод цифрами вручную.');
      } else if (outcome.status === 'unavailable') {
        setError('Нативный сканер недоступен. Введите штрихкод цифрами вручную.');
      }
    } catch {
      setError('Сканер не запустился. Введите штрихкод цифрами вручную.');
    } finally {
      setBarcodeLoading(false);
    }
  }, [barcodeLoading, showToast]);

  const handleClose = useCallback(() => {
    requestRef.current += 1;
    setOpen(false);
    setLoading(false);
    setProgress(0);
    setHint('');
    setError('');
  }, []);

  return {
    labelOpen: open,
    labelLoading: loading,
    labelProgress: progress,
    labelHint: hint,
    labelError: error,
    labelDraft: draft,
    labelRawText: rawText,
    labelBarcodeLoading: barcodeLoading,
    openLabelScan: () => { setOpen(true); setError(''); },
    closeLabelScan: handleClose,
    handleLabelCamera: () => { void handlePick('camera'); },
    handleLabelGallery: () => { void handlePick('gallery'); },
    handleLabelFieldChange: handleFieldChange,
    handleLabelSaveToBase: handleSaveToBase,
    handleLabelAddToDiary: handleAddToDiary,
    handleLabelBarcodeScan: () => { void handleScanBarcode(); },
  };
}
