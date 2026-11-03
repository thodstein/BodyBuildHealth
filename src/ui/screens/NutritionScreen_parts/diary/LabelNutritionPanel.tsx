import React from 'react';

export interface LabelDraftView {
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  fiber: number;
  barcode: string;
  confidence: number;
  basis: '100g' | 'serving' | 'unknown';
  warnings: string[];
  savedToBase: boolean;
}

interface Props {
  open: boolean;
  loading: boolean;
  progress: number;
  hint: string;
  error: string;
  draft: LabelDraftView | null;
  rawText: string;
  barcodeLoading: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onClose: () => void;
  onFieldChange: (field: 'name' | 'kcal' | 'p' | 'f' | 'c' | 'fiber' | 'barcode', value: string) => void;
  onSaveToBase: () => void;
  onAddToDiary: () => void;
  onScanBarcode: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
  background: '#202023', border: '1px solid rgba(255,255,255,0.08)', color: '#fff',
  fontSize: 16, outline: 'none', minHeight: 44,
};

const primaryBtn: React.CSSProperties = {
  flex: 1, padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000',
  fontWeight: 800, fontSize: 12, minHeight: 48,
};

const secondaryBtn: React.CSSProperties = {
  flex: 1, padding: '11px', borderRadius: 12, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.82)', fontWeight: 700, fontSize: 12, minHeight: 46,
};

export const LabelNutritionPanel: React.FC<Props> = ({
  open, loading, progress, hint, error, draft, rawText, barcodeLoading,
  onCamera, onGallery, onClose, onFieldChange, onSaveToBase, onAddToDiary, onScanBarcode,
}) => {
  if (!open) return null;
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="nd-label-panel" style={{ padding: 14, borderRadius: 16, background: 'linear-gradient(135deg, rgba(0,230,138,0.07), rgba(0,200,160,0.02))', border: '1px solid rgba(0,230,138,0.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,138,0.14)', fontSize: 15 }}>🏷</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#00e68a' }}>КБЖУ с упаковки</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>камера → распознавание → база продуктов</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Закрыть распознавание упаковки" className="nd-label-close" style={{ minWidth: 44, minHeight: 44, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontSize: 16, cursor: 'pointer' }}>✕</button>
      </div>

      {!draft && (
        <>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', lineHeight: 1.45, marginBottom: 10 }}>
            Сфотографируйте блок «Пищевая ценность» на упаковке. Значения распознаются на 100 г и сразу сохраняются в вашу базу продуктов.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onCamera} disabled={loading} aria-label="Снять упаковку камерой" className="nd-label-camera" style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }}>
              {loading ? '⏳ Распознаём…' : '📷 Снять камерой'}
            </button>
            <button type="button" onClick={onGallery} disabled={loading} aria-label="Выбрать фото упаковки из галереи" className="nd-label-gallery" style={{ ...secondaryBtn, opacity: loading ? 0.6 : 1 }}>
              🖼 Галерея
            </button>
          </div>
          {loading && (
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(4, pct)}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#00e68a,#00c8a0)', transition: 'width 0.25s ease' }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                {hint || 'Готовим распознавание…'}
              </div>
            </div>
          )}
          {error && (
            <div role="alert" className="nd-label-err" style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5', fontSize: 11, lineHeight: 1.4 }}>
              {error}
            </div>
          )}
        </>
      )}

      {draft && (
        <div className="nd-label-draft">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: 'rgba(0,230,138,0.12)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.22)' }}>
              {draft.savedToBase ? '✓ сохранено в базу' : 'готово к сохранению'}
            </span>
            <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)' }}>
              точность {Math.round(draft.confidence * 100)}%
            </span>
            {draft.basis === 'serving' && <span style={{ fontSize: 9, color: '#fbbf24' }}>пересчитано с порции</span>}
          </div>

          <input value={draft.name} onChange={e => onFieldChange('name', e.target.value)} aria-label="Название продукта с упаковки" className="nd-label-name" style={{ ...inputStyle, marginBottom: 8 }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 5, marginBottom: 8 }}>
            {([
              { key: 'kcal', label: 'Ккал', value: draft.kcal },
              { key: 'p', label: 'Б', value: draft.p },
              { key: 'f', label: 'Ж', value: draft.f },
              { key: 'c', label: 'У', value: draft.c },
              { key: 'fiber', label: 'Клетч.', value: draft.fiber },
            ] as const).map(field => (
              <div key={field.key}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 3, textAlign: 'center', fontWeight: 600 }}>{field.label}</div>
                <input type="number" inputMode="decimal" value={field.value} onChange={e => onFieldChange(field.key, e.target.value)} aria-label={field.label} className={`nd-label-${field.key}`} style={{ ...inputStyle, padding: '8px 4px', textAlign: 'center', fontSize: 14 }} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input value={draft.barcode} onChange={e => onFieldChange('barcode', e.target.value)} inputMode="numeric" placeholder="Штрихкод упаковки (необязательно)" aria-label="Штрихкод упаковки" className="nd-label-barcode" style={{ ...inputStyle, flex: 1, fontSize: 13 }} />
            <button type="button" onClick={onScanBarcode} disabled={barcodeLoading} aria-label="Сканировать штрихкод упаковки" className="nd-label-scan" style={{ minWidth: 48, minHeight: 44, borderRadius: 10, border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.08)', color: '#00e68a', fontSize: 16, cursor: barcodeLoading ? 'wait' : 'pointer' }}>
              {barcodeLoading ? '⏳' : '📷'}
            </button>
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: -3, marginBottom: 8 }}>
            Со штрихкодом продукт сразу находится сканером — даже без интернета.
          </div>

          {draft.warnings.length > 0 && (
            <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.20)', color: '#fbbf24', fontSize: 10, lineHeight: 1.45 }}>
              {draft.warnings.map((warning, index) => <div key={index}>⚠ {warning}</div>)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button type="button" onClick={onSaveToBase} aria-label="Сохранить продукт в базу" className="nd-label-save" style={primaryBtn}>
              💾 {draft.savedToBase ? 'Обновить в базе' : 'Сохранить в базу'}
            </button>
            <button type="button" onClick={onAddToDiary} aria-label="Добавить продукт в дневник" className="nd-label-add" style={secondaryBtn}>
              ➕ В дневник
            </button>
          </div>

          <button type="button" onClick={onCamera} disabled={loading} aria-label="Переснять упаковку" className="nd-label-retake" style={{ width: '100%', ...secondaryBtn, opacity: loading ? 0.6 : 1 }}>
            {loading ? '⏳ Распознаём…' : '📷 Переснять упаковку'}
          </button>

          {rawText && (
            <details className="nd-label-raw" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
              <summary style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>Распознанный текст (для проверки)</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 6, maxHeight: 140, overflowY: 'auto' }}>{rawText.slice(0, 1800)}</pre>
            </details>
          )}
        </div>
      )}

      {error && draft && (
        <div role="alert" className="nd-label-err" style={{ marginTop: 8, padding: '9px 11px', borderRadius: 10, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5', fontSize: 11 }}>{error}</div>
      )}
    </div>
  );
};
