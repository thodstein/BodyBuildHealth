import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { searchByBarcode, searchByName, type OFFProduct } from '../../engines/openfoodfacts.engine';

interface Props {
  onProductFound: (product: OFFProduct) => void;
  onClose: () => void;
}

const SCANNER_ID = 'barcode-scanner-region';

export const BarcodeScanner: React.FC<Props> = ({ onProductFound, onClose }) => {
  const [mode, setMode] = useState<'scan' | 'manual' | 'search'>('manual');
  const [barcode, setBarcode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState<OFFProduct[]>([]);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);

  const handleBarcodeLookup = useCallback(async (code?: string) => {
    const bc = code || barcode.trim();
    if (!bc) return;
    setLoading(true);
    setError('');
    try {
      const product = await searchByBarcode(bc);
      if (product) {
        onProductFound(product);
      } else {
        setError('Продукт не найден. Проверьте штрихкод или введите название вручную.');
      }
    } catch {
      setError('Ошибка сети. Проверьте подключение к интернету.');
    } finally {
      setLoading(false);
    }
  }, [barcode, onProductFound]);

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

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && scannerActive) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
      setScannerActive(false);
    }
  }, [scannerActive]);

  const startScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
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
          handleBarcodeLookup(decodedText);
        },
        () => {}
      );
      setScannerActive(true);
    } catch (err) {
      setError('Не удалось запустить камеру. Введите штрихкод вручную.');
      setMode('manual');
    }
  }, [stopScanner, handleBarcodeLookup]);

  useEffect(() => {
    if (mode === 'scan') startScanner();
    else stopScanner();
    return () => { stopScanner(); };
  }, [mode, startScanner, stopScanner]);

  const handleSelectProduct = useCallback((product: OFFProduct) => {
    onProductFound(product);
  }, [onProductFound]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box',
  };
  const btnStyle: React.CSSProperties = {
    background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 600,
  };
  const btnSecondary: React.CSSProperties = {
    ...btnStyle, background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column', padding: 16, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: 18 }}>📷 Сканировать продукт</h3>
        <button onClick={() => { stopScanner(); onClose(); }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginBottom:8, lineHeight:1.4 }}>Без ключа • Работает в РФ через ru.openfoodfacts.org • Кэш 7 дней + оффлайн из FOOD_DB</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setMode('manual')} style={mode === 'manual' ? btnStyle : btnSecondary}>Штрихкод</button>
        <button onClick={() => setMode('search')} style={mode === 'search' ? btnStyle : btnSecondary}>Поиск</button>
        <button onClick={() => setMode('scan')} style={mode === 'scan' ? btnStyle : btnSecondary}>Камера</button>
      </div>

      {mode === 'manual' && (
        <div>
          <label style={{ color: 'var(--text-light)', fontSize: 12, marginBottom: 4, display: 'block' }}>Штрихкод (EAN-13)</label>
          <input value={barcode} onChange={e => setBarcode(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleBarcodeLookup()} placeholder="4600494400795" style={inputStyle} autoFocus />
          <button onClick={() => handleBarcodeLookup()} disabled={loading || !barcode.trim()} style={{ ...btnStyle, width: '100%', marginTop: 10, opacity: loading || !barcode.trim() ? 0.5 : 1 }}>
            {loading ? 'Поиск...' : 'Найти по штрихкоду'}
          </button>
        </div>
      )}

      {mode === 'search' && (
        <div>
          <label style={{ color: 'var(--text-light)', fontSize: 12, marginBottom: 4, display: 'block' }}>Название продукта</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNameSearch()} placeholder="Молоко 3.2%" style={{ ...inputStyle, flex: 1 }} autoFocus />
            <button onClick={handleNameSearch} disabled={loading || !searchQuery.trim()} style={{ ...btnStyle, opacity: loading || !searchQuery.trim() ? 0.5 : 1 }}>
              {loading ? '...' : '🔍'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ marginTop: 12, maxHeight: '50vh', overflowY: 'auto' }}>
              {searchResults.map(p => (
                <button key={p.barcode || p.id} onClick={() => handleSelectProduct(p)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 6, cursor: 'pointer', color: 'var(--text-primary)' }}>
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
          <div id={SCANNER_ID} style={{ width: '100%', minHeight: 240, borderRadius: 12, overflow: 'hidden', background: '#000' }} />
          <p style={{ color: 'var(--text-light)', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
            Наведите камеру на штрихкод. Автоматическое распознавание EAN-13/EAN-8.
          </p>
        </div>
      )}

      {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 10 }}>{error}</div>}
    </div>
  );
};