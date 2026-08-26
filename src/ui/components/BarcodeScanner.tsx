import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { searchByBarcode, searchByName, saveToCache, type OFFProduct } from '../../engines/openfoodfacts.engine';
import { guessRetailCategory, searchRetailProductByBarcode } from '../../engines/retail-search.engine';

interface Props {
  onProductFound: (product: OFFProduct) => void;
  onClose: () => void;
}

const SCANNER_ID = 'barcode-scanner-region';

const ModernCreateFood: React.FC<{ error: string; barcode: string; onProductFound: (p: OFFProduct)=>void; btnStyle: React.CSSProperties }> = ({ error, barcode, onProductFound }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('100');
  const [p, setP] = useState('5');
  const [f, setF] = useState('5');
  const [c, setC] = useState('10');
  const [saving, setSaving] = useState(false);
  const canSave = name.trim().length >=2;
  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const kc = Number(kcal) || 100, pp = Number(p)||0, ff=Number(f)||0, cc=Number(c)||0;
    const bc = (barcode || 'custom_' + Date.now()).replace(/\D/g,'') || 'custom_' + Date.now();
    const prod: OFFProduct = { id: bc, barcode: bc, name: name.trim(), kcal: isNaN(kc)?100:kc, protein: isNaN(pp)?0:pp, fat: isNaN(ff)?0:ff, carbs: isNaN(cc)?0:cc, fiber:0, servingSize:'100 г', cachedAt: Date.now() } as any;
    try { await saveToCache(prod); } catch {}
    onProductFound(prod);
  };
  if (!open) {
    return (
      <div style={{ marginTop:12, padding:12, borderRadius:14, background:'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))', border:'1px solid rgba(239,68,68,0.18)', backdropFilter:'blur(8px)' }}>
        <div style={{ color: '#fca5a5', fontSize: 12, marginBottom:10, lineHeight:1.4 }}>{error}</div>
        <button type="button" onClick={()=>setOpen(true)} style={{ width:'100%', padding:'11px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:700, fontSize:12, cursor:'pointer', boxShadow:'0 4px 12px rgba(0,230,138,0.2)' }}>➕ Создать свою еду (оффлайн)</button>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', textAlign:'center', marginTop:6 }}>Без сети — сохранится в кэш и найдётся при след. сканировании</div>
      </div>
    );
  }
  return (
    <div style={{ marginTop:12, padding:14, borderRadius:16, background:'linear-gradient(135deg, #1a1c26 0%, #18181b 100%)', border:'1px solid rgba(0,230,138,0.18)', boxShadow:'0 8px 24px rgba(0,0,0,0.3)', backdropFilter:'blur(12px)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00e68a,#00c8a0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>📝</span>
        <div style={{ fontSize:12, fontWeight:800, color:'#00e68a' }}>Новая еда</div>
        <span style={{ marginLeft:'auto', fontSize:8, padding:'3px 7px', borderRadius:999, background:'rgba(0,230,138,0.10)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.18)' }}>оффлайн</span>
      </div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginBottom:8, lineHeight:1.4 }}>{error}</div>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Название с этикетки, например: Йогурт 2%" autoFocus style={{ width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius:10, background:'#202023', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:13, outline:'none', marginBottom:8 }} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, marginBottom:10 }}>
        {[
          { l:'Ккал', v:kcal, s:setKcal, ph:'100' },
          { l:'Б', v:p, s:setP, ph:'5' },
          { l:'Ж', v:f, s:setF, ph:'5' },
          { l:'У', v:c, s:setC, ph:'10' },
        ].map(x=>(
          <div key={x.l}>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginBottom:3, fontWeight:600, textAlign:'center' }}>{x.l}</div>
            <input type="number" value={x.v} onChange={e=>x.s(e.target.value)} placeholder={x.ph} style={{ width:'100%', boxSizing:'border-box', padding:'8px 6px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:12, textAlign:'center', outline:'none' }} />
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button type="button" onClick={()=>setOpen(false)} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)', fontWeight:600, cursor:'pointer' }}>Отмена</button>
        <button type="button" onClick={handleSave} disabled={!canSave || saving} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', background: canSave ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : 'rgba(255,255,255,0.06)', color: canSave ? '#000' : 'rgba(255,255,255,0.3)', fontWeight:700, cursor: canSave ? 'pointer' : 'not-allowed', opacity: saving?0.7:1 }}>{saving ? '⏳ Сохранение…' : '✓ Создать'}</button>
      </div>
      <div style={{ fontSize:8, color:'rgba(255,255,255,0.35)', textAlign:'center', marginTop:6 }}>Сохранится локально • 100г база • потом можно менять граммы</div>
    </div>
  );
};

export const BarcodeScanner: React.FC<Props> = ({ onProductFound, onClose }) => {
  const [mode, setMode] = useState<'scan' | 'manual' | 'search'>('manual');
  const [barcode, setBarcode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState<OFFProduct[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);
  const barcodeRef = useRef('');
  const onProductFoundRef = useRef(onProductFound);
  const onCloseRef = useRef(onClose);
  onProductFoundRef.current = onProductFound;
  onCloseRef.current = onClose;

  const handleBarcodeLookup = useCallback(async (code?: string) => {
    const raw = code || barcodeRef.current.trim();
    const bc = raw.replace(/\D/g, '');
    if (!bc) return;
    if (bc.length < 8) { setError('Штрихкод слишком короткий. EAN-13 — 13 цифр.'); return; }
    barcodeRef.current = bc;
    setBarcode(bc);
    setLoading(true);
    setError('');
    try {
      const product = await searchByBarcode(bc);
      if (product) {
        onProductFoundRef.current(product);
        onCloseRef.current();
        return;
      }
      const retail = await searchRetailProductByBarcode(bc);
      if (retail) {
        onProductFoundRef.current({
          id: bc,
          barcode: bc,
          name: retail.name,
          brand: retail.brand || 'ВкусВилл',
          category: guessRetailCategory(retail.name),
          kcal: retail.kcal,
          protein: retail.protein,
          fat: retail.fat,
          carbs: retail.carbs,
          fiber: 0,
          servingSize: '100 г',
          cachedAt: Date.now(),
        } as OFFProduct);
        onCloseRef.current();
        return;
      }
      const isRu = /^46/.test(bc);
      setError(isRu
        ? `Продукт 46… (РФ) не найден в ru.openfoodfacts.org и каталогах сетей. Попробуйте Поиск по названию или создайте свою еду — сохранится оффлайн.`
        : 'Продукт не найден (OFF ru/world/us + каталоги сетей). Проверьте штрихкод или введите название вручную / создайте свою еду.');
    } catch {
      setError('Ошибка сети. OFF недоступен — создайте свою еду оффлайн, она сохранится в кэш и найдётся при след. сканировании.');
    } finally {
      setLoading(false);
    }
  }, []);

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
        () => {}
      );
      // start() can resolve after the component switched modes. Do not mark
      // a stale scanner as active in that case.
      if (scannerRef.current !== scanner) {
        try { await scanner.stop(); } catch {}
        return;
      }
    } catch (err) {
      if (scannerRef.current === scanner) {
        scannerRef.current = null;
      }
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
    onProductFoundRef.current(product);
    onCloseRef.current();
  }, []);

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
        <button type="button" onClick={() => { void stopScanner(); onCloseRef.current(); }} aria-label="Закрыть сканер" style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginBottom:8, lineHeight:1.4 }}>Без ключа • Работает в РФ через ru.openfoodfacts.org • Кэш 7 дней + оффлайн из FOOD_DB</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setMode('manual')} style={mode === 'manual' ? btnStyle : btnSecondary}>Штрихкод</button>
        <button type="button" onClick={() => setMode('search')} style={mode === 'search' ? btnStyle : btnSecondary}>Поиск</button>
        <button type="button" onClick={() => setMode('scan')} style={mode === 'scan' ? btnStyle : btnSecondary}>Камера</button>
      </div>

      {mode === 'manual' && (
        <div>
          <label style={{ color: 'var(--text-light)', fontSize: 12, marginBottom: 4, display: 'block' }}>Штрихкод (EAN-13)</label>
           <input value={barcode} onChange={e => { barcodeRef.current = e.target.value; setBarcode(e.target.value); }} onKeyDown={e => e.key === 'Enter' && handleBarcodeLookup()} placeholder="4600494400795 (РФ 460…)" style={inputStyle} autoFocus />
          {barcode.replace(/\D/g,'').startsWith('46') && <div style={{ fontSize:10, color:'#00e68a', marginTop:4 }}>🇷🇺 Российский штрихкод 460… — ищем в RU-базе первым</div>}
           <button type="button" onClick={() => void handleBarcodeLookup()} disabled={loading || !barcode.trim()} style={{ ...btnStyle, width: '100%', marginTop: 10, opacity: loading || !barcode.trim() ? 0.5 : 1 }}>
            {loading ? 'Поиск...' : 'Найти по штрихкоду'}
          </button>
        </div>
      )}

      {mode === 'search' && (
        <div>
          <label style={{ color: 'var(--text-light)', fontSize: 12, marginBottom: 4, display: 'block' }}>Название продукта</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNameSearch()} placeholder="Молоко 3.2%" style={{ ...inputStyle, flex: 1 }} autoFocus />
             <button type="button" onClick={() => void handleNameSearch()} disabled={loading || !searchQuery.trim()} style={{ ...btnStyle, opacity: loading || !searchQuery.trim() ? 0.5 : 1 }}>
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

      {error && (
        <ModernCreateFood error={error} barcode={barcode} onProductFound={onProductFound} btnStyle={btnStyle} />
      )}
    </div>
  );
};
