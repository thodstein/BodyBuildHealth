import React, { useState } from 'react';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { type OFFProduct } from '../../../engines/openfoodfacts.engine';
import { parseFatSecretText, parseNutritionScreenshot } from '../../../engines/nutrition-ocr-parser';

export const NutritionDiary: React.FC<{
  foodEntries: { name: string; kcal: number; p: number; f: number; c: number }[];
}> = ({ foodEntries }) => {
  const [showOCR, setShowOCR] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [parsedItems, setParsedItems] = useState<{ name: string; kcal: number; p: number; f: number; c: number }[]>([]);
  const [ocrError, setOcrError] = useState('');

  const handleBarcodeProduct = (product: OFFProduct) => {
    setShowBarcode(false);
    setParsedItems(prev => [...prev, {
      name: product.nameRu || product.name || product.brand || 'Скан-продукт',
      kcal: product.kcal,
      p: product.protein,
      f: product.fat,
      c: product.carbs,
    }]);
  };  const handleOCR = () => {
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
