// ════════════════════════════════════════════════════════════════════
//  CalcLabsCard — карточка анализов с попапом ввода + кнопка из лаборатории
// ════════════════════════════════════════════════════════════════════
import React, { useState, useCallback } from 'react';
import type { LabSlice } from '../../../engines/support-plan';
import { GLASS } from './Calc.types';

interface Props {
  state: any;
  onStateChange: (next: any) => void;
  onOpenLabs?: () => void;
}

const REQUIRED_MARKERS: Array<{ key: string; label: string; category: string }> = [
  { key: 'ALT', label: 'АЛТ', category: 'Биохимия' },
  { key: 'AST', label: 'АСТ', category: 'Биохимия' },
  { key: 'GGT', label: 'ГГТ', category: 'Биохимия' },
  { key: 'Bilirubin', label: 'Билирубин', category: 'Биохимия' },
  { key: 'HCT', label: 'Гематокрит', category: 'Гематология' },
  { key: 'Hemoglobin', label: 'Гемоглобин', category: 'Гематология' },
  { key: 'LDL', label: 'ЛПНП', category: 'Липиды' },
  { key: 'HDL', label: 'ЛПВП', category: 'Липиды' },
  { key: 'Triglycerides', label: 'ТГ', category: 'Липиды' },
  { key: 'Total T', label: 'Тестостерон', category: 'Гормоны' },
  { key: 'E2', label: 'Эстрадиол', category: 'Гормоны' },
  { key: 'Prolactin', label: 'Пролактин', category: 'Гормоны' },
  { key: 'TSH', label: 'ТТГ', category: 'Гормоны' },
  { key: 'Creatinine', label: 'Креатинин', category: 'Биохимия' },
  { key: 'Glucose', label: 'Глюкоза', category: 'Метаболизм' },
  { key: 'CRP', label: 'СРБ', category: 'Воспаление' },
  { key: 'Vitamin D (25-OH)', label: 'Вит. D', category: 'Витамины' },
  { key: 'D-dimer', label: 'Д-димер', category: 'Коагуляция' },
];

export const CalcLabsCard: React.FC<Props> = ({ state, onStateChange, onOpenLabs }) => {
  const [open, setOpen] = useState(false);
  const [labPopup, setLabPopup] = useState(false);
  const [editingMarker, setEditingMarker] = useState<{ key: string; label: string } | null>(null);
  const [tempVal, setTempVal] = useState('');

  const labs = state.labs?.fullPanel || {};

  const getMarkerValue = (key: string): string => {
    for (const pk of ['panelBiochem', 'panelSex', 'panelHematology', 'panelLipid', 'panelIron', 'panelVitamin', 'panelCoagulation', 'panelInflammatory', 'panelThyroid']) {
      const panel = labs[pk] as Record<string, string> | undefined;
      if (panel && panel[key]) return panel[key];
    }
    return '';
  };

  const setMarkerValue = (key: string, val: string) => {
    const fp = { ...labs };
    if (!fp.panelBiochem) fp.panelBiochem = {};
    fp.panelBiochem[key] = val;
    onStateChange({ ...state, labs: { ...state.labs, fullPanel: fp } });
  };

  const autofillFromLabs = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('he_lab_values') || '{}');
      const panels = stored.panels || {};
      const fp = { ...labs };
      for (const pk of Object.keys(panels)) {
        if (!fp[pk]) fp[pk] = {};
        for (const [k, v] of Object.entries(panels[pk])) {
          (fp[pk] as any)[k] = v as any;
        }
      }
      onStateChange({ ...state, labs: { ...state.labs, fullPanel: fp } });
    } catch { /* онсайд*/ }
  }, [state, labs, onStateChange]);

  const filledCount = REQUIRED_MARKERS.filter(m => getMarkerValue(m.key)).length;

  return (
    <div className="calc-labscard" style={{ ...GLASS, padding: 10, marginBottom: 8 }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>🧪 Анализы</span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
          {filledCount}/{REQUIRED_MARKERS.length} · {open ? '▲' : '▼'}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 7, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.4 }}>
            Для корректного расчёта нужны результаты анализов. Введите вручную или загрузите из лаборатории.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
            {REQUIRED_MARKERS.map(m => {
              const val = getMarkerValue(m.key);
              const has = !!val;
              return (
                <button key={m.key}
                  onClick={() => { setEditingMarker({ key: m.key, label: m.label }); setTempVal(val || ''); setLabPopup(true); }}
                  style={{
                    padding: '5px 3px', borderRadius: 6, fontSize: 7, fontWeight: 600, cursor: 'pointer',
                    border: has ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.06)',
                    background: has ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.03)',
                    color: has ? '#00e68a' : 'var(--text-dim)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 0,
                  }}>
                  <span style={{ fontSize: 7, opacity: 0.7 }}>{m.label}</span>
                  <span style={{ fontSize: 8, fontWeight: 700 }}>{has ? val : '—'}</span>
                </button>
              );
            })}
          </div>

          <button onClick={autofillFromLabs} style={{ width: '100%', padding: '6px', borderRadius: 8, fontSize: 8, fontWeight: 600, cursor: 'pointer', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span style={{fontSize:11}}>📥</span>
            <span>Загрузить из лаборатории</span>
          </button>
          {onOpenLabs && (
            <button onClick={onOpenLabs} style={{ width: '100%', padding: '6px', borderRadius: 8, fontSize: 8, fontWeight: 600, cursor: 'pointer', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={{fontSize:11}}>🧬</span>
              <span>Открыть лабораторию</span>
            </button>
          )}

          {labPopup && editingMarker && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }} onClick={() => setLabPopup(false)}>
              <div onClick={e => e.stopPropagation()} style={{ width: '80%', maxWidth: 240, borderRadius: 12, background: '#1a1a1d', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div style={{ height: 2, background: 'linear-gradient(90deg,#60a5fa,#3b82f6)' }} />
                <div style={{ padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>{editingMarker.label}</div>
                  <input type="text" autoFocus value={tempVal} onChange={e => setTempVal(e.target.value)} placeholder="значение..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', boxSizing: 'border-box' }} />
                  <button onClick={() => { setMarkerValue(editingMarker.key, tempVal); setLabPopup(false); }} style={{ width: '100%', marginTop: 6, padding: '7px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: '#60a5fa', border: 'none', color: '#000' }}>OK</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};