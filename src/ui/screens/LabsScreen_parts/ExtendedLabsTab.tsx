import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { UCUM_MAP } from '../../../core/constants';
import type { LabPoint } from '../../../core/types';
import { db } from '../../../core/db';
import { notifyDataChange } from '../../../core/data-link';
const uid = () => { try { return crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`; } catch { return `${Date.now()}_${Math.random().toString(36).slice(2)}`; } };

const PANELS: { id: string; icon: string; label: string; codes: string[] }[] = [
  { id: 'hormones', icon: '🧬', label: 'Гормональная панель', codes: ['TT','FT','E2','LH','FSH','PRL','SHBG','DHT','PROG','PROGESTERONE','CORTISOL','DHEA_S','ANDROSTENEDIONE','AMH','INHB','INHIBIN_B','GH','IGF1','IGFBP3'] },
  { id: 'biochem', icon: '🫁', label: 'Биохимия', codes: ['ALT','AST','GGT','ALP','BIL','DBIL','DIRECT_BIL','BILIRUBIN_TOTAL','BILIRUBIN_DIRECT','BILIRUBIN_INDIRECT','LDH','CK','CK_MB','AMYLASE','LIPASE','CHOLINESTERASE','UREA','UA','URIC_ACID','CREATININE','EGFR','GLU','HbA1c','TP','TOTAL_PROTEIN','ALB','PREALBUMIN','GLOBULIN','A_G_RATIO','BILE_ACIDS'] },
  { id: 'hematology', icon: '🩸', label: 'Гематология', codes: ['HGB','HCT','RBC','MCV','MCH','MCHC','RDW','PLT','WBC','RETICULOCYTES','FERRITIN','IRON','TIBC','TRANSFERRIN','IRON_SAT','HAPTOGLOBIN','ERYTHROPOIETIN'] },
  { id: 'lipids', icon: '❤️', label: 'Липиды', codes: ['LDL','HDL','TG','APO_A1','APO_B','LP_A','NON_HDL'] },
  { id: 'thyroid', icon: '🦋', label: 'Щитовидная железа', codes: ['TSH','FT3','FT4'] },
  { id: 'metabolism', icon: '⚡', label: 'Метаболизм', codes: ['INS','HOMA','HOMAIR','C_PEPTIDE','PROINSULIN','FRUCTOSAMINE','VITD','B12','FOL','VITAMIN_A','VITAMIN_E','VITAMIN_D','VITAMIN_B12','CALCIDIOL'] },
  { id: 'inflammation', icon: '🔥', label: 'Воспаление', codes: ['CRP','hsCRP','ESR','HOMOCYSTEINE','FIBRINOGEN','TNF_ALPHA','IL6','IL1B','LACTATE','AMMONIA'] },
  { id: 'cardiac', icon: '💓', label: 'Кардиомаркеры', codes: ['TROPONIN','TROPONIN_I','TROPONIN_T','NT_PROBNP','BNP','D_DIMER','ENDOTHELIN1','NO_MARKER','INR','APTT'] },
  { id: 'electrolytes', icon: '💧', label: 'Электролиты и минералы', codes: ['K','NA','CA','P','MG','SODIUM','POTASSIUM','CHLORIDE','CALCIUM','PHOSPHORUS','MAGNESIUM','COPPER','ZINC','SELENIUM'] },
  { id: 'extra', icon: '📋', label: 'Дополнительные', codes: ['PSA','PARATHYROID','CALCITONIN','OSTEOCALCIN','CYSTATIN_C','NGAL','KIM1','PROTEIN_URINE','MICROALB','OSMOLALITY','ANION_GAP','LIPASE','AMYLASE','PREALBUMIN','LP_A','TRANSFERRIN','IRON'] },
];

const PHASE_LABELS: Record<string, string> = {
  baseline: 'Базовый', on_cycle: 'На курсе', bridge: 'Мост',
  pct: 'ПКТ', post_pct: 'После ПКТ',
};

const LAB_SOURCES: { id: string; label: string; adjust: number }[] = [
  { id: 'standard', label: 'Стандарт', adjust: 1 },
  { id: 'invitro', label: 'Инвитро', adjust: 0.95 },
  { id: 'helix', label: 'Хеликс', adjust: 1.02 },
  { id: 'cmd', label: 'CMD', adjust: 0.98 },
  { id: 'other', label: 'Другая', adjust: 1 },
];

const ALL_UCUM_CODES = new Set(Object.keys(UCUM_MAP));

function getUniquePanelCodes(panelCodes: string[]): string[] {
  const seen = new Set<string>();
  return panelCodes.filter(c => {
    const upper = c.toUpperCase();
    if (seen.has(upper)) return false;
    if (!ALL_UCUM_CODES.has(upper)) return false;
    seen.add(upper);
    return true;
  });
}

function deviationColor(value: number, info: { uln: number; lln: number }): string {
  if (value > info.uln) return '#ef4444';
  if (value < info.lln) return '#f97316';
  return 'var(--accent)';
}

export default function ExtendedLabsTab({
  labs,
  selectedPhase,
  onPhaseChange,
  tick,
}: {
  labs: LabPoint[];
  selectedPhase: string;
  onPhaseChange: (phase: string) => void;
  tick: number;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    PANELS.forEach(p => { init[p.id] = true; });
    return init;
  });

  const phaseLabs = useMemo(() => {
    return labs.filter(l => !l.archived && (!l.phase || l.phase === selectedPhase));
  }, [labs, selectedPhase]);

  const existingCodes = useMemo(() => {
    const map: Record<string, LabPoint> = {};
    for (const l of phaseLabs) {
      const code = l.code.toUpperCase();
      if (!map[code]) map[code] = l;
    }
    return map;
  }, [phaseLabs]);

  useEffect(() => {
    const prefill: Record<string, string> = {};
    for (const panel of PANELS) {
      for (const code of panel.codes) {
        const upper = code.toUpperCase();
        const existing = existingCodes[upper];
        if (existing) {
          prefill[upper] = String(existing.value);
        }
      }
    }
    setValues(prev => {
      const merged = { ...prefill };
      for (const k of Object.keys(prev)) {
        if (prev[k] !== '' && !merged[k]) merged[k] = prev[k];
      }
      return merged;
    });
  }, [selectedPhase, tick]);

  const handleValueChange = useCallback((code: string, val: string) => {
    setValues(prev => ({ ...prev, [code]: val }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      await db.init();
      let count = 0;
      const toArchive = labs.filter(l => !l.archived && (!l.phase || l.phase === selectedPhase));
      for (const lab of toArchive) {
        await db.put('labs_log', { ...lab, archived: true });
      }
      for (const [code, valStr] of Object.entries(values)) {
        const val = parseFloat(valStr);
        if (!valStr || isNaN(val)) continue;
        const info = UCUM_MAP[code.toUpperCase()];
        const lab: LabPoint = {
          id: uid(),
          code: code.toUpperCase(),
          name: info?.name || code,
          value: val,
          unit: info?.prefUnit || '',
          date: new Date().toISOString().split('T')[0],
          phase: selectedPhase,
        };
        await db.put('labs_log', lab);
        count++;
      }
      if (count > 0) notifyDataChange();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error('Save failed', e);
    }
    setSaving(false);
  }, [values, selectedPhase, labs]);

  const filledCount = useMemo(() => {
    return Object.values(values).filter(v => v.trim() !== '').length;
  }, [values]);

  return (
    <div className="labs-extended">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>🔬</span>
        <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>Расширенная панель анализов</span>
        <span style={{ fontSize: 10, color: '#fff' }}>{Object.keys(UCUM_MAP).length} маркеров</span>
      </div>

      <div style={{ fontSize:11, color:'#fff', marginBottom:10, lineHeight:1.5 }}>
        Все маркеры из каталога UCUM, сгруппированные по панелям. Ввод с авто-заполнением из существующих анализов для выбранной фазы. Коррекция референсов под разные лаборатории.
      </div>

      <div className="labs-filter-row" style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:10, scrollbarWidth:'none', padding:'2px 2px 4px' }}>
        {Object.entries(PHASE_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => onPhaseChange(key)} aria-pressed={selectedPhase===key} style={{
            padding:'10px 16px', borderRadius:999, fontSize:12, fontWeight:800,
            whiteSpace:'nowrap', cursor:'pointer', minHeight:44, flexShrink:0,
            background: selectedPhase === key ? 'linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))' : 'rgba(21,38,66,0.60)',
            color: selectedPhase === key ? '#0a1a08' : '#fff',
            border: selectedPhase === key ? '1px solid transparent' : '1px solid rgba(140,190,255,0.14)',
            boxShadow: selectedPhase===key ? '0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : 'none',
          }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: '#fff' }}>
          {filledCount} / {Object.keys(UCUM_MAP).length} заполнено
        </span>
        <button onClick={handleSave} disabled={saving || filledCount === 0} style={{
          padding: '8px 16px', borderRadius: 10, border: 'none', cursor: (saving || filledCount === 0) ? 'not-allowed' : 'pointer',
          background: saved ? '#22c55e' : filledCount > 0 ? 'var(--accent)' : 'var(--bg-secondary)',
          color: saved ? '#fff' : filledCount > 0 ? '#000' : '#fff',
          fontWeight: 700, fontSize: 11, transition: 'all 0.2s',
        }}>
          {saving ? '⏳' : saved ? '✓ Сохранено' : `💾 Сохранить (${filledCount})`}
        </button>
      </div>

      {PANELS.map(panel => {
        const uniqueCodes = getUniquePanelCodes(panel.codes);
        if (uniqueCodes.length === 0) return null;
        const isOpen = openPanels[panel.id];
        const panelFilled = uniqueCodes.filter(c => values[c] && values[c].trim() !== '').length;
        return (
          <div key={panel.id} style={{ marginBottom:8, borderRadius:14, overflow:'hidden', border:'1px solid rgba(140,190,255,0.12)', background:'rgba(21,38,66,0.45)', borderLeft:'3px solid var(--labs-accent, #00e68a)' }}>
            <button onClick={() => setOpenPanels(prev => ({ ...prev, [panel.id]: !prev[panel.id] }))} style={{
              display:'flex', alignItems:'center', gap:8, width:'100%', padding:'12px 12px', cursor:'pointer', minHeight:52,
              background:'transparent', border:'none', color:'#fff', fontSize:13, fontWeight:800, textAlign:'left',
            }}>
              <span style={{ fontSize:12, transition:'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink:0 }}>▶</span>
              <span style={{ flexShrink:0 }}>{panel.icon}</span>
              <span style={{ flex:1, minWidth:0 }}>{panel.label}</span>
              <span style={{ fontSize:11, color: panelFilled === uniqueCodes.length ? 'var(--accent)' : '#fff', fontWeight:800, flexShrink:0 }}>
                {panelFilled}/{uniqueCodes.length}
              </span>
            </button>
            {isOpen && (
              <div style={{ padding:'0 10px 10px' }}>
                <div style={{ display:'grid', gap:6 }}>
                  {uniqueCodes.map(code => {
                    const info = UCUM_MAP[code];
                    if (!info) return null;
                    const existing = existingCodes[code];
                    const val = values[code] ?? '';
                    const numVal = parseFloat(val);
                    const hasVal = val.trim() !== '' && !isNaN(numVal);
                    return (
                      <div key={code} style={{
                        display:'flex', alignItems:'center', gap:6, padding:'10px 10px', borderRadius:12, minHeight:48,
                        background: hasVal ? 'rgba(var(--labs-accent-rgb, 0,230,138),0.08)' : existing ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                        border:`1px solid ${hasVal ? 'rgba(var(--labs-accent-rgb, 0,230,138),0.18)' : existing ? 'rgba(59,130,246,0.16)' : 'rgba(140,190,255,0.10)'}`,
                      }}>
                        <span style={{ fontSize:11, fontWeight:700, minWidth:80, color:'#fff', flexShrink:0 }}>
                          {info.name}
                        </span>
                        <input
                          value={val}
                          onChange={e => handleValueChange(code, e.target.value)}
                          placeholder={existing ? String(existing.value) : '—'}
                          type="number"
                          step="any" aria-label={info.name}
                          style={{
                            width:64, padding:'8px 8px', background:'rgba(0,0,0,0.30)', border:'1px solid rgba(140,190,255,0.16)', minHeight:40,
                            borderRadius:10, color: hasVal ? deviationColor(numVal, info) : '#fff',
                            fontSize:12, fontWeight:700, textAlign:'right',
                          }}
                        />
                        <span style={{ fontSize:10, color:'#fff', minWidth:32, fontWeight:600 }}>{info.prefUnit}</span>
                        <span style={{ fontSize:10, color:'#fff', minWidth:56, fontWeight:600 }}>
                          {info.lln}–{info.uln}
                        </span>
                        {existing && !hasVal && (
                          <span style={{ fontSize:10, padding:'2px 6px', borderRadius:999, background:'rgba(59,130,246,0.15)', color:'#3b82f6', fontWeight:700 }}>
                            {existing.value} {info.prefUnit}
                          </span>
                        )}
                        {hasVal && (
                          <span style={{ fontSize:10, padding:'3px 7px', borderRadius:999, fontWeight:800,
                            background: numVal > info.uln ? 'rgba(239,68,68,0.15)' : numVal < info.lln ? 'rgba(249,115,22,0.15)' : 'rgba(0,230,138,0.15)',
                            color: numVal > info.uln ? '#ef4444' : numVal < info.lln ? '#f97316' : 'var(--accent)',
                          }}>
                            {numVal > info.uln ? '↑' : numVal < info.lln ? '↓' : '✓'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ height: 16 }} />
    </div>
  );
}
