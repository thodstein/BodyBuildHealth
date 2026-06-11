import React, { useState, useRef, useMemo } from 'react';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { type OFFProduct } from '../../../engines/openfoodfacts.engine';
import { parseFatSecretText, parseNutritionScreenshot } from '../../../engines/nutrition-ocr-parser';
import { processUploadedFile, saveParsedMeals } from '../../../core/ocr-engine';
import { FOOD_DB } from '../../../core/nutrition-database';

export const NutritionDiary: React.FC<{
  foodEntries: { name: string; kcal: number; p: number; f: number; c: number }[];
}> = ({ foodEntries }) => {
  const [showOCR, setShowOCR] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [mealType, setMealType] = useState('Перекус');
  const [ocrText, setOcrText] = useState('');
  const [parsedItems, setParsedItems] = useState<{ name: string; kcal: number; p: number; f: number; c: number }[]>([]);
  const [ocrError, setOcrError] = useState('');
  const [ocrFileLoading, setOcrFileLoading] = useState(false);
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const ocrCameraRef = useRef<HTMLInputElement>(null);

  const foodSearchResults = useMemo(() => {
    if (!foodSearch.trim()) return [];
    const q = foodSearch.toLowerCase();
    return FOOD_DB.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [foodSearch]);

  const addFoodFromDB = (food: typeof FOOD_DB[number]) => {
    setParsedItems(prev => [...prev, {
      name: food.name,
      kcal: food.kcal,
      p: food.protein,
      f: food.fat,
      c: food.carbs,
    }]);
    setFoodSearch('');
    // Save as favorite
    try {
      const favs = JSON.parse(localStorage.getItem('he_food_favs') || '[]');
      const updated = [food.id, ...favs.filter((f: string) => f !== food.id)].slice(0, 8);
      localStorage.setItem('he_food_favs', JSON.stringify(updated));
    } catch {}
  };

  const favoriteFoods = useMemo(() => {
    try {
      const favs: string[] = JSON.parse(localStorage.getItem('he_food_favs') || '[]');
      return favs.map(id => FOOD_DB.find(f => f.id === id)).filter(Boolean) as typeof FOOD_DB;
    } catch { return []; }
  }, []);

  const handleBarcodeProduct = (product: OFFProduct) => {
    setShowBarcode(false);
    setParsedItems(prev => [...prev, {
      name: product.nameRu || product.name || product.brand || 'Скан-продукт',
      kcal: product.kcal,
      p: product.protein,
      f: product.fat,
      c: product.carbs,
    }]);
  };  const handleOcrFileUpload = async (file: File) => {
    setOcrFileLoading(true);
    setOcrError('');
    try {
      const result = await processUploadedFile(file);
      if (result.meals.length > 0) {
        const converted = result.meals.flatMap(m =>
          m.items.map(item => ({
            name: item.name || m.mealType || '\u0411\u043B\u044E\u0434\u043E',
            kcal: Math.round(item.kcal) || 0,
            p: Math.round((item.p || 0) * 10) / 10,
            f: Math.round((item.f || 0) * 10) / 10,
            c: Math.round((item.c || 0) * 10) / 10,
          }))
        );
        setParsedItems(prev => [...prev, ...converted]);
      }
      if (result.meals.length === 0 && result.labs.length === 0) {
        setOcrError('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u043F\u0438\u0442\u0430\u043D\u0438\u044F.');
      }
    } catch (e) {
      setOcrError('\u041E\u0448\u0438\u0431\u043A\u0430: ' + (e instanceof Error ? e.message : String(e)));
    }
    setOcrFileLoading(false);
  };

  const handleOCR = () => {
    if (!ocrText.trim()) return;
    setOcrError('');
    try {
      // Try FatSecret parser first
      let items = parseFatSecretText(ocrText);
      // Fallback to generic parser
      if (items.length === 0) {
        items = parseNutritionScreenshot(ocrText);
      }
      const converted = items.flatMap(m =>
        m.items.map(item => ({
          name: item.name || m.mealType || 'Блюдо',
          kcal: Math.round(item.kcal) || 0,
          p: Math.round((item.p || 0) * 10) / 10,
          f: Math.round((item.f || 0) * 10) / 10,
          c: Math.round((item.c || 0) * 10) / 10,
        }))
      );
      setParsedItems(converted);
      if (converted.length === 0) {
        setOcrError('Не удалось распознать данные. Попробуйте вставить текст из FatSecret, MyFitnessPal или другого трекера.');
      }
    } catch (e) {
      setOcrError('Ошибка парсинга: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="nutrition-diary">
      <div className="card" style={{ marginBottom: 12 }}>
        <h3>📝 Дневник питания</h3>

        {/* Quick food search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input type="text" value={foodSearch} onChange={e => setFoodSearch(e.target.value)}
            placeholder="🔍 Найти продукт в базе..."
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
            {['Завтрак', 'Обед', 'Ужин', 'Перекус', 'До трени', 'После трени'].map(mt => (
              <button key={mt} onClick={() => setMealType(mt)} style={{
                padding: '2px 6px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                background: mealType === mt ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                border: mealType === mt ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: mealType === mt ? '#00e68a' : 'var(--text-dim)', fontWeight: mealType === mt ? 600 : 400,
              }}>{mt}</button>
            ))}
          </div>
          {foodSearchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', marginTop: 2 }}>
              {foodSearchResults.map(f => (
                <div key={f.id} onClick={() => addFoodFromDB(f)} style={{
                  padding: '6px 10px', cursor: 'pointer', fontSize: 11, borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', color: 'var(--text)',
                }}>
                  <span>{f.name}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>{f.kcal}ккал Б{f.protein} Ж{f.fat} У{f.carbs}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Favorites quick-add */}
        {favoriteFoods.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>⭐ Избранное</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {favoriteFoods.map(f => (
                <button key={f.id} onClick={() => addFoodFromDB(f)} style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                  background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6',
                  fontWeight: 500, whiteSpace: 'nowrap',
                }}>⭐ {f.name.slice(0, 15)}</button>
              ))}
            </div>
          </div>
        )}

        {/* Barcode Scanner */}
        <button onClick={() => setShowBarcode(!showBarcode)} style={{
          width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border)',
          background: showBarcode ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
          color: showBarcode ? '#00e68a' : 'var(--text-dim)', fontWeight: 600, cursor: 'pointer', marginBottom: 12,
        }}>
          {showBarcode ? '📷 Сканер штрих-кода (открыто) ▲' : '📷 Сканер штрих-кода — найти продукт ▼'}
        </button>
        {showBarcode && (
                    <BarcodeScanner onProductFound={handleBarcodeProduct} onClose={() => setShowBarcode(false)} />
        )}

        {/* File/Camera upload for nutrition OCR */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button onClick={() => ocrFileRef.current?.click()} disabled={ocrFileLoading} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: ocrFileLoading ? 0.5 : 1 }}>
            {ocrFileLoading ? '⏳' : '📄'} {ocrFileLoading ? 'Загрузка...' : 'Файл PDF/фото'}
          </button>
          <button onClick={() => { if (ocrCameraRef.current) ocrCameraRef.current.click(); }} disabled={ocrFileLoading} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: ocrFileLoading ? 0.5 : 1 }}>
            📸 Снимок
          </button>
        </div>
        <input ref={ocrFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleOcrFileUpload(f); }} />
        <input ref={ocrCameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleOcrFileUpload(f); }} />

        {/* OCR Paste Section */}
        <button onClick={() => setShowOCR(!showOCR)} style={{
          width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border)',
          background: showOCR ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
          color: showOCR ? '#00e68a' : 'var(--text-dim)', fontWeight: 600, cursor: 'pointer', marginBottom: 12,
        }}>
          {showOCR ? '📱 Импорт из трекера (открыто) ▲' : '📱 Импорт из трекера — вставить текст ▼'}
        </button>

        {showOCR && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 8px 0' }}>
              Скопируйте текст из FatSecret, MyFitnessPal или другого трекера питания и вставьте его ниже.
              Поддерживаются форматы: «Название 100г 250 ккал Б: 15 Ж: 10 У: 20» и таблицы.
            </p>
            <textarea
              value={ocrText}
              onChange={e => setOcrText(e.target.value)}
              placeholder="Вставьте данные из трекера питания..."
              style={{
                width: '100%', minHeight: 120, padding: 10, borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-primary)',
                color: 'inherit', fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <button onClick={handleOCR} style={{
              marginTop: 8, padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#00e68a', color: '#000', fontWeight: 600, cursor: 'pointer',
            }}>
              Распознать
            </button>
            {ocrError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{ocrError}</div>}
            {parsedItems.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ margin: '0 0 8px 0' }}>Распознано: {parsedItems.length} позиций</h4>
                <div style={{ display: 'grid', gap: 4 }}>
                  {parsedItems.map((item, i) => (
                    <div key={i} style={{ background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{item.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{item.kcal} ккал | Б:{item.p} Ж:{item.f} У:{item.c}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => {
                  saveParsedMeals(parsedItems.map(item => ({
                    date: new Date().toISOString().split('T')[0],
                    mealType: mealType,
                    items: [{ name: item.name, kcal: item.kcal, p: item.p, f: item.f, c: item.c, qty: '100 г' }],
                  })));
                  setParsedItems([]);
                  setOcrText('');
                }} style={{
                  width: '100%', marginTop: 8, padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 13,
                }}>💾 Сохранить в дневник</button>
              </div>
            )}
          </div>
        )}

        {/* Existing diary entries */}
        {foodEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)' }}>
            Нет записей в дневнике
          </div>
        ) : (
          <div className="list">
            {foodEntries.slice(-10).map((entry, i) => (
              <div key={i} style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600 }}>{entry.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {entry.kcal} ккал | {entry.p}г белки | {entry.f}г жиры | {entry.c}г углеводы
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
