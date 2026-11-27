import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { searchByName, saveToCache, type OFFProduct } from '../../engines/openfoodfacts.engine';
import { saveSharedBarcode } from '../../engines/food-barcode-catalog.engine';
import {
  customFoodToOFFProduct,
  lookupBarcode,
  normalizeScannedBarcode,
  rememberScannedProduct,
  type BarcodeLookupHit,
} from '../../engines/barcode-lookup.engine';
import { isCapacitorNative } from '../../core/app-platform';

interface Props {
  /** `grams` — порция из карточки (по умолчанию 100 г), чтобы вызывающий её не угадывал. */
  onProductFound: (product: OFFProduct, grams?: number) => void;
  onClose: () => void;
  /** Не нашли товар — открыть распознавание КБЖУ с фото упаковки. */
  onLabelScan?: () => void;
  /**
   * «＋ В очередь» без закрытия сканера: несколько товаров за один подход к
   * полке. Без пропа карточка добавляет через onProductFound и честно
   * называется «Добавить в дневник».
   */
  onQuickAdd?: (product: OFFProduct, grams?: number) => void;
  /**
   * «Указать вес…»: родитель открывает свой выбор порции. Без пропа карточка
   * использует граммы из поля порции — молчаливые 100 г не подставляются.
   */
  onPortionRequest?: (product: OFFProduct, grams?: number) => void;
}

const SCANNER_ID = 'barcode-scanner-region';
/** Реальные длины GTIN: EAN-8, UPC-A, EAN-13, ITF-14. */
const GTIN_LENGTHS = new Set([8, 12, 13, 14]);
const RECENT_KEY = 'he_barcode_recent_v1';
const RECENT_CAP = 8;

interface RecentScan {
  barcode: string;
  name: string;
  kcal: number;
  ts: number;
}

function readRecent(): RecentScan[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r: any) => r && typeof r.barcode === 'string' && typeof r.name === 'string')
      .slice(0, RECENT_CAP);
  } catch {
    return [];
  }
}

function pushRecent(barcode: string, name: string, kcal: number): RecentScan[] {
  try {
    const prev = readRecent().filter((r) => r.barcode !== barcode);
    const next = [
      { barcode, name: name.slice(0, 80), kcal: Math.max(0, Math.round(kcal || 0)), ts: Date.now() },
      ...prev,
    ].slice(0, RECENT_CAP);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    return next;
  } catch {
    return readRecent();
  }
}

function parseNumberField(value: string, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Своя еда из формы сканера. Без настоящего штрихкода `barcode` остаётся
 * пустым, а id локальный: раньше вместо него подставлялся Date.now() —
 * 13-значный «штрихкод», который уходил в общую базу сканирований и мог
 * совпасть с настоящим GTIN другого товара.
 */
export function buildCustomBarcodeProduct(input: {
  barcode: string;
  name: string;
  kcal: string;
  p: string;
  f: string;
  c: string;
}): OFFProduct {
  const digits = String(input.barcode || '').replace(/\D/g, '');
  return {
    id: digits || `custom_${Date.now()}`,
    barcode: digits,
    name: input.name.trim(),
    kcal: Math.round(parseNumberField(input.kcal, 0)),
    protein: parseNumberField(input.p, 0),
    fat: parseNumberField(input.f, 0),
    carbs: parseNumberField(input.c, 0),
    fiber: 0,
    servingSize: '100 г',
    cachedAt: Date.now(),
  } as OFFProduct;
}

const ModernCreateFood: React.FC<{
  error: string;
  barcode: string;
  onProductFound: (p: OFFProduct) => void;
  btnStyle: React.CSSProperties;
  onLabelScan?: () => void;
  createLabel?: string;
}> = ({ error, barcode, onProductFound, onLabelScan, createLabel }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [f, setF] = useState('');
  const [c, setC] = useState('');
  const [saving, setSaving] = useState(false);
  // Публиковать продукт без КБЖУ нельзя: прежние дефолты 100/5/5/10 навсегда
  // клали в общую базу выдуманные цифры, и корректные данные OFF уже не
  // перезаписывали запись (ignore-duplicates).
  const kcalValue = parseNumberField(kcal, 0);
  const canSave = name.trim().length >= 2 && kcalValue > 0;
  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const prod = buildCustomBarcodeProduct({ barcode, name, kcal, p, f, c });
    // Без калорийности в общую базу и кэш не пишем: нули там навсегда заслонят
    // настоящие данные из OFF.
    if (prod.barcode && prod.kcal > 0) {
      try {
        await saveToCache(prod);
      } catch {}
      try {
        await saveSharedBarcode(prod);
      } catch {}
    }
    onProductFound(prod);
  };
  if (!open) {
    return (
      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))',
          border: '1px solid rgba(239,68,68,0.18)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>{error}</div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="nd-scancreate"
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg,#00e68a,#00c8a0)',
            color: '#000',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            minHeight: 48,
            boxShadow: '0 4px 12px rgba(0,230,138,0.2)',
          }}
        >
          {createLabel || '➕ Создать свою еду (оффлайн)'}
        </button>
        {onLabelScan && (
          <button
            type="button"
            onClick={onLabelScan}
            className="nd-scanlabel"
            aria-label="Распознать КБЖУ с фото упаковки"
            style={{
              width: '100%',
              marginTop: 8,
              padding: '11px',
              borderRadius: 12,
              border: '1px solid rgba(0,230,138,0.22)',
              background: 'rgba(0,230,138,0.08)',
              color: '#00e68a',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              minHeight: 48,
            }}
          >
            🏷 Снять КБЖУ с упаковки
          </button>
        )}
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 6 }}>
          Без сети — сохранится в кэш и найдётся при след. сканировании
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 16,
        background: 'linear-gradient(135deg, #1a1c26 0%, #18181b 100%)',
        border: '1px solid rgba(0,230,138,0.18)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(135deg,#00e68a,#00c8a0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
          }}
        >
          📝
        </span>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#00e68a' }}>Новая еда</div>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 8,
            padding: '3px 7px',
            borderRadius: 999,
            background: 'rgba(0,230,138,0.10)',
            color: '#00e68a',
            border: '1px solid rgba(0,230,138,0.18)',
          }}
        >
          оффлайн
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8, lineHeight: 1.4 }}>{error}</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название с этикетки, например: Йогурт 2%"
        autoFocus
        aria-label="Название продукта"
        className="nd-scanname"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 12px',
          borderRadius: 10,
          background: '#202023',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#fff',
          fontSize: 16,
          outline: 'none',
          marginBottom: 8,
          minHeight: 48,
        }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        {[
          { l: 'Ккал', v: kcal, s: setKcal, ph: '100' },
          { l: 'Б', v: p, s: setP, ph: '5' },
          { l: 'Ж', v: f, s: setF, ph: '5' },
          { l: 'У', v: c, s: setC, ph: '10' },
        ].map((x) => (
          <div key={x.l}>
            <div
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.5)',
                marginBottom: 3,
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              {x.l}
            </div>
            <input
              type="number"
              value={x.v}
              onChange={(e) => x.s(e.target.value)}
              placeholder={x.ph}
              aria-label={x.l}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 6px',
                borderRadius: 8,
                background: '#202023',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#fff',
                fontSize: 16,
                textAlign: 'center',
                outline: 'none',
                minHeight: 44,
              }}
            />
          </div>
        ))}
      </div>
      <div
        className="nd-scankbju-hint"
        style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.45)',
          textAlign: 'center',
          marginTop: -4,
          marginBottom: 10,
          lineHeight: 1.4,
        }}
      >
        Без КБЖУ продукт не попадёт в общую базу
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: 10,
            border: 'none',
            background: canSave ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : 'rgba(255,255,255,0.06)',
            color: canSave ? '#000' : 'rgba(255,255,255,0.3)',
            fontWeight: 700,
            cursor: canSave ? 'pointer' : 'not-allowed',
            opacity: saving ? 0.7 : 1,
            minHeight: 44,
          }}
        >
          {saving ? '⏳ Сохранение…' : '✓ Создать'}
        </button>
      </div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 6 }}>
        Сохранится локально + в общую базу при указанных КБЖУ • 100 г база • потом можно менять граммы
      </div>
    </div>
  );
};

export const BarcodeScanner: React.FC<Props> = ({
  onProductFound,
  onClose,
  onLabelScan,
  onQuickAdd,
  onPortionRequest,
}) => {
  const [mode, setMode] = useState<'scan' | 'manual' | 'search'>(() => (isCapacitorNative() ? 'scan' : 'manual'));
  const [barcode, setBarcode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [nativeLoading, setNativeLoading] = useState(false);
  const [lookupStep, setLookupStep] = useState('');
  const [scanNotice, setScanNotice] = useState('');
  const [searchResults, setSearchResults] = useState<OFFProduct[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [recent, setRecent] = useState<RecentScan[]>(() => readRecent());
  /** Найденный товар: карточка с действиями вместо мгновенного закрытия. */
  const [found, setFound] = useState<{ hit: BarcodeLookupHit; barcode: string } | null>(null);
  /** Подтверждение «＋ В очередь»: модалка остаётся открытой. */
  const [quickAdded, setQuickAdded] = useState<{ name: string; grams: number } | null>(null);
  /**
   * Порция из карточки. Раньше оба действия молча брали 100 г, поэтому
   * «Указать вес…» без своего sheet'а и «＋ 100 г» записывали не то, что
   * человек держал в руках. Теперь граммы видны и правятся до добавления.
   */
  const [portionGrams, setPortionGrams] = useState('100');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);
  const barcodeRef = useRef('');
  /** Пока идёт lookupBarcode, повторный запуск игнорируется: тот же код в
   * кадре/двойной тап запускали вторую цепочку OFF. */
  const lookupBusyRef = useRef(false);
  /** «＋ 100 г в очередь» срабатывает один раз — до появления новой карточки. */
  const quickAddBusyRef = useRef(false);
  const onProductFoundRef = useRef(onProductFound);
  const onCloseRef = useRef(onClose);
  const onQuickAddRef = useRef(onQuickAdd);
  const onPortionRequestRef = useRef(onPortionRequest);
  onProductFoundRef.current = onProductFound;
  onCloseRef.current = onClose;
  onQuickAddRef.current = onQuickAdd;
  onPortionRequestRef.current = onPortionRequest;

  /**
   * Найденное показываем карточкой, а не уводим сразу в дневник: иначе второй
   * товар требует заново открывать сканер — главная жалоба «неудобно
   * добавлять второе».
   */
  const deliverHit = useCallback((hit: BarcodeLookupHit, bc: string) => {
    try {
      setRecent(pushRecent(bc, hit.product.name, hit.product.kcal));
    } catch {
      /* ignore */
    }
    // Найденное с КБЖУ — в общую базу (fire-and-forget: следующий телефон
    // найдёт без OFF). Товар без КБЖУ не публикуем: в общей базе не нужны нули.
    rememberScannedProduct(hit.product);
    quickAddBusyRef.current = false;
    setFound({ hit, barcode: bc });
    setError('');
    setQuickAdded(null);
    // Новый товар — новая порция: оставлять 60 г от прошлой пачки нельзя.
    setPortionGrams('100');
  }, []);

  const handleBarcodeLookup = useCallback(
    async (code?: string) => {
      if (lookupBusyRef.current) return;
      const raw = code || barcodeRef.current.trim();
      const bc = normalizeScannedBarcode(raw);
      // Раньше пустой/буквенный код молча игнорировался — нажатие «Найти» ничего
      // не делало и выглядело как зависший сканер.
      if (!bc) {
        setError('В штрихкоде нет цифр. Введите 8–13 цифр EAN/UPC или отсканируйте код камерой.');
        return;
      }
      // GTIN бывает 8 (EAN-8), 12 (UPC-A), 13 (EAN-13) и 14 (ITF-14) цифр.
      // 9–11 цифр — почти всегда опечатка или битый декод, а полная цепочка
      // (2 хоста × v2 + v0 с таймаутами и ретраями) держала спиннер ~30–40 с.
      if (!GTIN_LENGTHS.has(bc.length)) {
        setError('Штрихкод должен быть 8, 12, 13 или 14 цифр (EAN-8 / UPC-A / EAN-13 / ITF-14).');
        return;
      }
      lookupBusyRef.current = true;
      barcodeRef.current = bc;
      setBarcode(bc);
      setLoading(true);
      setError('');
      setFound(null);
      setQuickAdded(null);
      setShowSettings(false);
      try {
        // Одна цепочка для всех входов (свои продукты → OFF ru/world →
        // общая база сканирований → каталоги сетей) живёт в движке.
        const result = await lookupBarcode(bc, { onStep: setLookupStep });
        if (result.hit) {
          deliverHit(result.hit, result.barcode || bc);
          return;
        }
        const isRu = /^(?:46|48)/.test(bc);
        setError(
          isRu
            ? `Продукт ${bc.slice(0, 2)}… (РФ) не найден в ru.openfoodfacts.org, общей базе и каталоге ВкусВилл. Создайте свою еду или снимите КБЖУ с упаковки — сохранится оффлайн.`
            : 'Продукт не найден (OFF ru/world + общая база + каталоги сетей). Проверьте штрихкод или введите название вручную / создайте свою еду.',
        );
      } catch {
        setError(
          'Ошибка сети. OFF недоступен — создайте свою еду оффлайн, она сохранится в кэш и найдётся при след. сканировании.',
        );
      } finally {
        lookupBusyRef.current = false;
        setLoading(false);
        setLookupStep('');
      }
    },
    [deliverHit],
  );

  const handleNameSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    try {
      const results = await searchByName(searchQuery.trim());
      setSearchResults(results);
      if (results.length === 0) {
        setError('Ничего не найдено. Попробуйте другое название.');
      }
    } catch {
      setError('Ошибка сети. Проверьте подключение к интернету.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // АПК: нативный MLKit-сканер (системный UI Google) — работает там, где
  // html5-стрим в WebView упирается в разрешения/secure-context.
  // Ленивый dynamic import — web/TG-бандл не раздувается.
  const handleNativeScan = useCallback(async () => {
    if (!isCapacitorNative()) return;
    setNativeLoading(true);
    setError('');
    setScanNotice('');
    setShowSettings(false);
    try {
      const { scanNativeBarcode } = await import('../../core/native-bridge');
      const outcome = await scanNativeBarcode();
      if (outcome.status === 'scanned') {
        setMode('manual');
        await handleBarcodeLookup(outcome.code);
        return;
      }
      if (outcome.status === 'denied') {
        setShowSettings(true);
        setError('Нет доступа к камере. Разрешите камеру для приложения — иначе сканер не запустится.');
        return;
      }
      if (outcome.status === 'unavailable') {
        const hint = (outcome as { hint?: string }).hint;
        if (hint === 'installing-module') {
          setScanNotice('Загружается модуль Google-сканера. После установки нажмите кнопку сканирования ещё раз.');
          return;
        }
        if (hint === 'no-gms') {
          // Huawei/Honor без Google-сервисов: модуль сканера не поставится
          // никогда. Раньше UI предлагал «подождать» — вечный тупик.
          setScanNotice(
            'На этом устройстве нет Google-сервисов, поэтому камера-сканер не запустится. Сфотографируйте штрихкод кнопкой ниже или введите цифры — это работает везде.',
          );
          return;
        }
      }
      // cancelled — молча, без ошибки (пользователь сам закрыл сканер).
    } catch {
      setError('Нативный сканер недоступен. Используйте «Снять камерой» (фото) или введите цифры вручную.');
    } finally {
      setNativeLoading(false);
    }
  }, [handleBarcodeLookup]);

  const handleOpenSettings = useCallback(async () => {
    try {
      const { openNativeAppSettings } = await import('../../core/native-bridge');
      await openNativeAppSettings();
    } catch {
      /* ignore */
    }
  }, []);

  // АПК: системная камера (Capacitor Camera → системный диалог) + декод фото
  // через scanFile. Запасной путь, когда нативный MLKit недоступен
  // (нет Play Services / отказано в фоне). Кода 1-в-1 дальше.
  const handlePhotoScan = useCallback(async () => {
    if (!isCapacitorNative()) return;
    setPhotoLoading(true);
    setError('');
    setScanNotice('');
    setShowSettings(false);
    try {
      const { pickBarcodePhoto, scanNativeBarcodeImage, persistBarcodePhoto, deleteTemporaryBarcodePhoto } =
        await import('../../core/native-bridge');
      const photo = await pickBarcodePhoto();
      if (!photo) return;
      const pickedNativePath = photo.nativePath || (/^(?:file|content):\/\//i.test(photo.uri) ? photo.uri : null);
      const nativePath = pickedNativePath || (await persistBarcodePhoto(photo.uri, photo.format));
      const temporaryPath = pickedNativePath ? null : nativePath;
      if (nativePath) {
        let nativeCode: string | null = null;
        try {
          nativeCode = await scanNativeBarcodeImage(nativePath);
        } finally {
          if (temporaryPath) await deleteTemporaryBarcodePhoto(temporaryPath);
        }
        if (nativeCode) {
          setBarcode(nativeCode);
          setMode('manual');
          await handleBarcodeLookup(nativeCode);
          return;
        }
      }
      let blob: Blob | null = null;
      try {
        const { dataUrlToBlob } = await import('../../engines/ocr-preprocess');
        blob = dataUrlToBlob(photo.uri);
      } catch {
        /* fallback ниже */
      }
      if (!blob) blob = await (await fetch(photo.uri)).blob();
      const file = new File([blob], `barcode.${photo.format || 'jpg'}`, { type: blob.type || 'image/jpeg' });
      const holder = document.createElement('div');
      const holderId = `barcode-photo-decode-${Date.now()}`;
      holder.id = holderId;
      holder.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
      document.body.appendChild(holder);
      try {
        const decoder = new Html5Qrcode(holderId);
        try {
          const decoded = await decoder.scanFile(file, false);
          await decoder.clear();
          if (decoded) {
            setBarcode(String(decoded));
            setMode('manual');
            await handleBarcodeLookup(String(decoded));
            return;
          }
        } catch {
          try {
            await decoder.clear();
          } catch {
            /* ignore */
          }
        }
        setError(
          'Штрихкод на фото не распознан. Попробуйте нативный сканер выше (точнее) или поднесите ближе при хорошем свете, или введите цифры вручную.',
        );
      } finally {
        holder.remove();
      }
    } catch {
      setError('Не удалось открыть камеру. Введите штрихкод вручную.');
    } finally {
      setPhotoLoading(false);
    }
  }, [handleBarcodeLookup]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      // stop() must be called even when React has not committed scannerActive
      // yet. This matters when a barcode is decoded immediately after start().
      await scanner.stop();
    } catch {
      // The scanner may already be stopped by the camera permission error path.
    }
  }, []);

  const startScanner = useCallback(async () => {
    await stopScanner();
    scannedRef.current = false;
    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.5 },
        async (decodedText: string) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          await stopScanner();
          setBarcode(decodedText);
          setMode('manual');
          void handleBarcodeLookup(decodedText);
        },
        () => {},
      );
      // start() can resolve after the component switched modes. Do not mark
      // a stale scanner as active in that case.
      if (scannerRef.current !== scanner) {
        try {
          await scanner.stop();
        } catch {}
        return;
      }
    } catch (err) {
      if (scannerRef.current === scanner) {
        scannerRef.current = null;
      }
      setError(
        isCapacitorNative()
          ? 'Живой видеопоток недоступен в WebView. Используйте нативный сканер выше — он работает всегда.'
          : 'Не удалось запустить камеру. Введите штрихкод вручную.',
      );
      // АПК: остаёмся в режиме камеры — там нативный сканер и фото-запасной.
      // На web/TG живого стрима нет вовсе — уводим на ручной ввод.
      if (!isCapacitorNative()) setMode('manual');
    }
  }, [stopScanner, handleBarcodeLookup]);

  useEffect(() => {
    if (mode === 'scan') startScanner();
    else stopScanner();
    return () => {
      stopScanner();
    };
  }, [mode, startScanner, stopScanner]);

  const handleSelectProduct = useCallback((product: OFFProduct) => {
    onProductFoundRef.current(product);
    onCloseRef.current();
  }, []);

  /** КБЖУ ввели руками по найденному коду → та же карточка с действиями. */
  const handleManualProduct = useCallback((product: OFFProduct) => {
    const bc = product.barcode || normalizeScannedBarcode(barcodeRef.current);
    if (bc) {
      try {
        setRecent(pushRecent(bc, product.name, product.kcal));
      } catch {
        /* ignore */
      }
    }
    rememberScannedProduct(product);
    quickAddBusyRef.current = false;
    setFound({ hit: { product, source: 'custom', incomplete: false }, barcode: bc || product.id });
    setError('');
  }, []);

  /**
   * Снова к сканированию, не закрывая модалку.
   * `next='manual'` — после quick-add: на АПК живой html5-стрим в WebView не
   * нужен, а перезапуск показывал тот же кадр и та же карточка добавляла ещё
   * 100 г; вместо этого ручной режим с пустым полем.
   */
  const resumeScanning = useCallback(
    (next: 'scan' | 'manual' = 'scan') => {
      setFound(null);
      setError('');
      setScanNotice('');
      scannedRef.current = false;
      if (next === 'manual') {
        // После quick-add камеру не перезапускаем — ни html5-стрим, ни кадр:
        // тот же код сразу показал бы ту же карточку, и второе нажатие
        // добавило бы ещё 100 г. Ручное поле сбрасываем под следующий код.
        void stopScanner();
        barcodeRef.current = '';
        setBarcode('');
        setMode('manual');
        return;
      }
      if (isCapacitorNative()) {
        if (mode === 'scan') void startScanner();
        else setMode('scan');
      } else if (mode === 'scan') {
        void startScanner();
      }
    },
    [mode, startScanner, stopScanner],
  );

  /** Граммы из поля порции: 1..2000, пусто/мусор → 100. */
  const gramsValue = useCallback(() => {
    const n = Math.round(Number(String(portionGrams).replace(',', '.')));
    if (!Number.isFinite(n) || n <= 0) return 100;
    return Math.max(1, Math.min(2000, n));
  }, [portionGrams]);

  /** «＋ В очередь»: продукт уходит родителю с граммами, модалка НЕ закрывается. */
  const handleQuickAdd = useCallback(
    (product: OFFProduct) => {
      if (quickAddBusyRef.current) return;
      const grams = gramsValue();
      const quickAdd = onQuickAddRef.current;
      if (!quickAdd) {
        // Родитель без быстрого добавления — прежний сценарий, но с порцией из поля.
        onProductFoundRef.current(product, grams);
        return;
      }
      quickAddBusyRef.current = true;
      try {
        quickAdd(product, grams);
      } catch {
        /* ignore */
      }
      setQuickAdded({ name: product.name, grams });
      resumeScanning('manual');
    },
    [gramsValue, resumeScanning],
  );

  const handleRepeatRecent = useCallback(
    (r: RecentScan) => {
      barcodeRef.current = r.barcode;
      setBarcode(r.barcode);
      void handleBarcodeLookup(r.barcode);
    },
    [handleBarcodeLookup],
  );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: 16,
    boxSizing: 'border-box',
    minHeight: 48,
  };
  const btnStyle: React.CSSProperties = {
    background: 'var(--accent-blue)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: 600,
    minHeight: 44,
  };
  const btnSecondary: React.CSSProperties = {
    ...btnStyle,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Сканировать продукт"
      className="nd-scan"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        // Выше FAB/шторок (1200): сканер — модальное действие, и кнопка «＋»
        // приложения не должна перекрывать его кнопки.
        zIndex: 1400,
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        overflowY: 'auto',
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          void stopScanner();
          onCloseRef.current();
        }
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: 18 }}>📷 Сканировать продукт</h3>
        <button
          type="button"
          onClick={() => {
            void stopScanner();
            onCloseRef.current();
          }}
          aria-label="Закрыть сканер"
          className="nd-scanclose"
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: 24,
            cursor: 'pointer',
            minWidth: 44,
            minHeight: 44,
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8, lineHeight: 1.4 }}>
        Без ключа • Работает в РФ через ru.openfoodfacts.org • Кэш 7 дней + общая база + оффлайн из FOOD_DB
      </div>

      <div className="nd-scanmodes" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setMode('manual')}
          aria-pressed={mode === 'manual'}
          data-active={mode === 'manual'}
          className="nd-scanmode"
          style={mode === 'manual' ? btnStyle : btnSecondary}
        >
          Штрихкод
        </button>
        <button
          type="button"
          onClick={() => setMode('search')}
          aria-pressed={mode === 'search'}
          data-active={mode === 'search'}
          className="nd-scanmode"
          style={mode === 'search' ? btnStyle : btnSecondary}
        >
          Поиск
        </button>
        <button
          type="button"
          onClick={() => setMode('scan')}
          aria-pressed={mode === 'scan'}
          data-active={mode === 'scan'}
          className="nd-scanmode"
          style={mode === 'scan' ? btnStyle : btnSecondary}
        >
          Камера
        </button>
      </div>

      {quickAdded && (
        <div
          role="status"
          aria-live="polite"
          className="nd-scanadded"
          style={{
            marginBottom: 10,
            padding: '9px 12px',
            borderRadius: 12,
            background: 'rgba(0,230,138,0.10)',
            border: '1px solid rgba(0,230,138,0.25)',
            color: '#86efac',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          ✓ {quickAdded.name} → очередь ({quickAdded.grams} г). Можно добавлять следующий продукт.
        </div>
      )}

      {found && !found.hit.incomplete && (
        <div
          role="status"
          aria-live="polite"
          className="nd-scanfound"
          style={{
            marginBottom: 12,
            padding: 14,
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(0,200,160,0.04))',
            border: '1px solid rgba(0,230,138,0.28)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflowWrap: 'anywhere' }}>
                {found.hit.product.name}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                {found.hit.product.brand ? `${found.hit.product.brand} • ` : ''}штрихкод {found.barcode}
              </div>
              <div style={{ fontSize: 11, color: '#00e68a', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(found.hit.product.kcal || 0)} ккал • Б{' '}
                {Math.round((found.hit.product.protein || 0) * 10) / 10} • Ж{' '}
                {Math.round((found.hit.product.fat || 0) * 10) / 10} • У{' '}
                {Math.round((found.hit.product.carbs || 0) * 10) / 10} / 100 г
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>Порция</span>
            <input
              className="nd-scangrams"
              type="number"
              inputMode="numeric"
              min={1}
              max={2000}
              step={10}
              value={portionGrams}
              onChange={(e) => setPortionGrams(e.target.value)}
              aria-label="Граммы порции"
              style={{
                width: 72,
                padding: '9px 10px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.16)',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 800,
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>г</span>
            {[50, 100, 150, 200].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setPortionGrams(String(g))}
                className="nd-scanchip"
                aria-pressed={gramsValue() === g}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 9,
                  border: gramsValue() === g ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.10)',
                  background: gramsValue() === g ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)',
                  color: gramsValue() === g ? '#00e68a' : 'rgba(255,255,255,0.65)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {g}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => handleQuickAdd(found.hit.product)}
            className="nd-scanquick"
            aria-label={
              onQuickAdd
                ? `Добавить ${found.hit.product.name}, ${gramsValue()} грамм в очередь`
                : `Добавить ${found.hit.product.name} в дневник, ${gramsValue()} грамм`
            }
            style={{
              width: '100%',
              marginTop: 10,
              padding: '12px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg,#00e68a,#00c8a0)',
              color: '#000',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              minHeight: 48,
            }}
          >
            {onQuickAdd ? `＋ В очередь · ${gramsValue()} г` : `✓ Добавить в дневник · ${gramsValue()} г`}
          </button>
          <button
            type="button"
            onClick={() => {
              // Родитель с выбором порции открывает PortionSheet; иначе — прежний путь.
              const portion = onPortionRequestRef.current;
              const grams = gramsValue();
              if (portion) portion(found.hit.product, grams);
              else onProductFoundRef.current(found.hit.product, grams);
            }}
            className="nd-scanportion"
            aria-label="Указать вес продукта"
            style={{
              width: '100%',
              marginTop: 8,
              padding: '11px',
              borderRadius: 12,
              border: '1px solid rgba(0,230,138,0.28)',
              background: 'rgba(0,230,138,0.08)',
              color: '#00e68a',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              minHeight: 48,
            }}
          >
            ⚖️ Указать вес…
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => resumeScanning()}
              className="nd-scanagain"
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              📷 Сканировать ещё
            </button>
            <button
              type="button"
              onClick={() => {
                void stopScanner();
                onCloseRef.current();
              }}
              className="nd-scandone"
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.8)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              ✓ Готово
            </button>
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <div>
          <label style={{ color: 'var(--text-light)', fontSize: 12, marginBottom: 4, display: 'block' }}>
            Штрихкод (EAN-13)
          </label>
          <input
            value={barcode}
            onChange={(e) => {
              barcodeRef.current = e.target.value;
              setBarcode(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup()}
            placeholder="4600494400795 (РФ 460…)"
            aria-label="Штрихкод"
            style={inputStyle}
            autoFocus
          />
          {barcode.replace(/\D/g, '').startsWith('46') && (
            <div style={{ fontSize: 10, color: '#00e68a', marginTop: 4 }}>
              🇷🇺 Российский штрихкод 460… — ищем в RU-базе первым
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleBarcodeLookup()}
            disabled={loading || !barcode.trim()}
            style={{ ...btnStyle, width: '100%', marginTop: 10, opacity: loading || !barcode.trim() ? 0.5 : 1 }}
          >
            {loading ? 'Поиск...' : 'Найти по штрихкоду'}
          </button>
          {loading && (
            <div
              role="status"
              className="nd-scanprogress"
              style={{ marginTop: 8, textAlign: 'center', color: '#fff', fontSize: 12 }}
            >
              {lookupStep || 'Ищем продукт…'}
            </div>
          )}
          {recent.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
                🕒 Недавние сканы
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recent.map((r) => (
                  <button
                    key={r.barcode}
                    type="button"
                    onClick={() => handleRepeatRecent(r)}
                    className="nd-scanrecent"
                    aria-label={`Повторить ${r.name}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      textAlign: 'left',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      minHeight: 48,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>🔁</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.name}
                      </span>
                      <span style={{ display: 'block', fontSize: 10, color: 'var(--text-light)' }}>
                        {r.barcode} • {r.kcal} ккал
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'search' && (
        <div>
          <label style={{ color: 'var(--text-light)', fontSize: 12, marginBottom: 4, display: 'block' }}>
            Название продукта
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSearch()}
              placeholder="Молоко 3.2%"
              aria-label="Поиск продукта по названию"
              style={{ ...inputStyle, flex: 1 }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => void handleNameSearch()}
              disabled={loading || !searchQuery.trim()}
              style={{ ...btnStyle, opacity: loading || !searchQuery.trim() ? 0.5 : 1 }}
            >
              {loading ? '...' : '🔍'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ marginTop: 12, maxHeight: '50vh', overflowY: 'auto' }}>
              {searchResults.map((p) => (
                <button
                  key={p.barcode || p.id}
                  onClick={() => handleSelectProduct(p)}
                  className="nd-scanrow"
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 6,
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    minHeight: 56,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                    {p.brand && <span>{p.brand} • </span>}
                    {p.kcal} ккал • Б {p.protein} • Ж {p.fat} • У {p.carbs}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'scan' && (
        <div>
          {isCapacitorNative() && (
            <div
              style={{
                marginBottom: 10,
                padding: 12,
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(0,200,160,0.05))',
                border: '1px solid rgba(0,230,138,0.25)',
              }}
            >
              <button
                type="button"
                onClick={() => void handleNativeScan()}
                disabled={nativeLoading}
                className="nd-scannative"
                aria-label="Сканировать нативным сканером"
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg,#00e68a,#00c8a0)',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: nativeLoading ? 'wait' : 'pointer',
                  minHeight: 52,
                  opacity: nativeLoading ? 0.7 : 1,
                  boxShadow: '0 4px 16px rgba(0,230,138,0.25)',
                }}
              >
                {nativeLoading ? '⏳ Открываем сканер…' : '📷 Сканировать (нативный сканер)'}
              </button>
              <div
                style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.5)',
                  textAlign: 'center',
                  marginTop: 6,
                  lineHeight: 1.4,
                }}
              >
                Системный сканер Google — быстрее и точнее в темноте. EAN-13/8, UPC, Code-128.
              </div>
              {showSettings && (
                <button
                  type="button"
                  onClick={() => void handleOpenSettings()}
                  className="nd-scansettings"
                  aria-label="Открыть настройки приложения"
                  style={{
                    width: '100%',
                    marginTop: 8,
                    padding: '10px',
                    borderRadius: 10,
                    border: '1px solid rgba(245,158,11,0.35)',
                    background: 'rgba(245,158,11,0.10)',
                    color: '#fbbf24',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    minHeight: 44,
                  }}
                >
                  ⚙️ Открыть настройки → разрешить камеру
                </button>
              )}
            </div>
          )}
          <div
            id={SCANNER_ID}
            style={{ width: '100%', minHeight: 240, borderRadius: 12, overflow: 'hidden', background: '#000' }}
          />
          <p style={{ color: 'var(--text-light)', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
            Наведите камеру на штрихкод. Автоматическое распознавание EAN-13/EAN-8.
          </p>
          {isCapacitorNative() && (
            <button
              type="button"
              onClick={() => void handlePhotoScan()}
              disabled={photoLoading}
              className="nd-scanphoto"
              aria-label="Снять штрихкод камерой"
              style={{ ...btnStyle, width: '100%', marginTop: 4, opacity: photoLoading ? 0.6 : 1 }}
            >
              {photoLoading ? '⏳ Распознаём фото…' : '📷 Снять камерой (фото-запасной)'}
            </button>
          )}
        </div>
      )}

      {scanNotice && (
        <div
          role="status"
          className="nd-scannotice"
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            background: 'rgba(245,158,11,0.08)',
            color: '#fff',
            fontSize: 12,
          }}
        >
          {scanNotice}
        </div>
      )}
      {found && found.hit.incomplete && (
        <ModernCreateFood
          error={`«${found.hit.product.name}» найден в базе, но в нём нет КБЖУ — в дневник попали бы нули. Снимите этикетку (кнопка ниже) или введите значения вручную: штрихкод ${found.barcode} сохранится.`}
          barcode={found.barcode}
          onProductFound={handleManualProduct}
          btnStyle={btnStyle}
          createLabel="✎ Ввести вручную (штрихкод сохранится)"
          onLabelScan={
            onLabelScan
              ? () => {
                  onCloseRef.current();
                  onLabelScan();
                }
              : undefined
          }
        />
      )}
      {error && (
        <ModernCreateFood
          error={error}
          barcode={barcode}
          onProductFound={handleManualProduct}
          btnStyle={btnStyle}
          onLabelScan={
            onLabelScan
              ? () => {
                  onCloseRef.current();
                  onLabelScan();
                }
              : undefined
          }
        />
      )}
      {(error || (found && found.hit.incomplete)) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => resumeScanning()}
            className="nd-scanagain"
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            📷 Сканировать ещё
          </button>
          <button
            type="button"
            onClick={() => {
              void stopScanner();
              onCloseRef.current();
            }}
            className="nd-scandone"
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.8)',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            ✓ Готово
          </button>
        </div>
      )}
    </div>
  );
};
