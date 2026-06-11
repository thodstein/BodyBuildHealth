import React, { useState, useEffect } from 'react';
import { PHARMA_DB, SUBSTANCES_BY_CLASS } from '../../core/pharma-database';
import { validateCourse } from '../../engines/pharmacology.engine';
import { checkDrugInteractions } from '../../engines/pharma-interactions.engine';
import { db } from '../../core/db';
import { notifyDataChange } from '../../core/data-link';
import type { CourseEntry } from '../../core/types';

const CLASS_LABELS: Record<string, string> = {
  testosterone: '💉 Тестостерон', trenbolone: '⚡ Тренболон', nandrolone: '💊 Нандролон',
  boldenone: '🐴 Болденон', primobolan: '💎 Примоболан', oral_17aa: '☠️ Оральные 17-α',
  sarm: '🧬 SARMs', peptide_ghrh: '🧪 GHRH', peptide_ghrp: '🧪 GHRP',
  igf1: '🔬 IGF-1', mgf: '🔬 MGF', insulin: '💉 Инсулины',
  pct_serm: '🟢 СЕРМ', pct_aromatase: '🔴 АИ', pct_dopamine: '🟡 ДА',
  pct_gonadotropin: '🔵 ХГЧ', drostanolone: '💪 Мастерон',
  peptide_gnrh: '🧪 GnRH', peptide_fat_loss: '🔥 Жиросжигатели', peptide_other: '🧪 Пептиды',
};

const CLASS_COLORS: Record<string, string> = {
  testosterone: '#00e68a', trenbolone: '#ef4444', nandrolone: '#3b82f6',
  boldenone: '#a855f7', primobolan: '#06b6d4', oral_17aa: '#f97316',
  sarm: '#8b5cf6', peptide_ghrh: '#14b8a6', peptide_ghrp: '#14b8a6',
  igf1: '#ec4899', mgf: '#ec4899', insulin: '#f59e0b',
  pct_serm: '#22c55e', pct_aromatase: '#ef4444', pct_dopamine: '#eab308',
  pct_gonadotropin: '#3b82f6', drostanolone: '#f97316',
  peptide_gnrh: '#14b8a6', peptide_fat_loss: '#f97316', peptide_other: '#6b7280',
};

const FREQ_OPTIONS = [
  { value: '1x/wk', label: '1×/нед' },
  { value: '2x/wk', label: '2×/нед' },
  { value: '3x/wk', label: '3×/нед' },
  { value: 'eod', label: 'Через день' },
  { value: 'daily', label: 'Ежедневно' },
];

const UNIT_OPTIONS = ['mg/wk', 'mg', 'mcg', 'IU', 'ml'];

export const PharmaCourseScreen: React.FC = () => {
  const [course, setCourse] = useState<CourseEntry[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerClass, setPickerClass] = useState('testosterone');
  const [dose, setDose] = useState('');
  const [unit, setUnit] = useState('mg/wk');
  const [freq, setFreq] = useState('2x/wk');
  const [startWeek, setStartWeek] = useState(0);
  const [endWeek, setEndWeek] = useState(12);
  const [interactions, setInteractions] = useState<ReturnType<typeof checkDrugInteractions>>([]);
  const [validation, setValidation] = useState<{ valid: boolean; warnings: string[] }>({ valid: true, warnings: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        await db.init();
        const entries = await db.getAll<CourseEntry>('course_log');
        setCourse(entries);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (course.length) {
      setValidation(validateCourse(course));
      setInteractions(checkDrugInteractions(course));
    } else {
      setValidation({ valid: true, warnings: [] });
      setInteractions([]);
    }
  }, [course]);

  const addEntry = async (substanceId: string) => {
    const d = parseFloat(dose);
    if (!substanceId || isNaN(d) || d <= 0) return;
    const entry: CourseEntry = {
      id: crypto.randomUUID(),
      substanceId,
      doseValue: d,
      doseUnit: unit,
      frequency: freq,
      startWeek,
      endWeek
    };
    try {
      await db.put('course_log', entry);
      setCourse(prev => [...prev, entry]);
      setDose('');
      setShowPicker(false);
      notifyDataChange();
    } catch (e) { console.error(e); }
  };

  const removeEntry = async (id: string) => {
    try {
      await db.delete('course_log', id);
      setCourse(prev => prev.filter(e => e.id !== id));
      notifyDataChange();
    } catch (e) { console.error(e); }
  };

  const subName = (id: string) => PHARMA_DB[id]?.name ?? id;
  const subClass = (id: string) => PHARMA_DB[id]?.class ?? '';

  if (loading) return <div className="screen-loading"><div className="loading-spinner"/><span>Загрузка...</span></div>;

  const subsForClass = SUBSTANCES_BY_CLASS[pickerClass] ?? [];

  return (
    <div className="screen pharma-course">
      <h2>💊 Мой курс</h2>

      {/* Course entries */}
      {course.length > 0 ? (
        <div className="card" style={{ marginBottom: 8 }}>
          <h3>📋 Текущий курс</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {course.map(entry => {
              const cls = subClass(entry.substanceId);
              const color = CLASS_COLORS[cls] || 'var(--accent)';
              return (
                <div key={entry.id} style={{
                  background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px',
                  borderLeft: `3px solid ${color}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{subName(entry.substanceId)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                      {entry.doseValue} {entry.doseUnit} • {typeof entry.frequency === 'number' ? `${entry.frequency}×/нед` : entry.frequency} • нед {entry.startWeek}–{entry.endWeek}
                    </div>
                  </div>
                  <button onClick={() => removeEntry(entry.id)} style={{
                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#ef4444', borderRadius: 6, padding: '4px 8px', fontSize: 10, cursor: 'pointer',
                  }}>
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 8 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>💊</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Курс пуст. Добавьте препараты.</div>
        </div>
      )}

      {/* Add button — always visible at top */}
      <button onClick={() => setShowPicker(true)} style={{
        width: '100%', padding: 12, background: 'linear-gradient(135deg, var(--accent), #00b368)', color: '#000',
        border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700,
        fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        marginBottom: 10, position: 'sticky', top: 0, zIndex: 5, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <span style={{ fontSize: 20 }}>+</span> Добавить препарат
      </button>

      {/* Validation warnings */}
      {validation.warnings.length > 0 && (
        <div style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: 8, padding: 8, marginTop: 8 }}>
          {validation.warnings.map((w, i) => <div key={i} style={{ fontSize: 11, color: 'var(--warning)' }}>⚠️ {w}</div>)}
        </div>
      )}

      {/* Interactions */}
      {interactions.length > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <h3>⚡ Взаимодействия</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {interactions.map((alert: any, i: number) => (
              <div key={i} style={{
                background: alert.type === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(255,165,2,0.1)',
                borderRadius: 6, padding: '8px 10px',
                borderLeft: `3px solid ${alert.type === 'critical' ? '#ef4444' : '#eab308'}`,
              }}>
                <div style={{ fontWeight: 600, fontSize: 11 }}>{alert.type}: {alert.drugs?.join(' + ')}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{alert.mechanism}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto protocol — moved to Support tab */}

      {/* ========= DRUG PICKER MODAL ========= */}
      {showPicker && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column',
        }} onClick={() => setShowPicker(false)}>
          <div style={{
            position: 'fixed', top: '8%', left: '4%', right: '4%', zIndex: 201,
            background: 'var(--bg, #050508)',
            borderTop: '1px solid var(--border)',
            borderRadius: '20px',
            maxHeight: '82vh',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{
              padding: '12px 16px 8px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>💊 Добавить препарат</div>
              <button onClick={() => setShowPicker(false)} style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                color: 'var(--text-dim)', borderRadius: 8, padding: '4px 10px',
                fontSize: 12, cursor: 'pointer',
              }}>
                ✕ Закрыть
              </button>
            </div>

            {/* Class selector - horizontal scroll */}
            <div style={{
              padding: '8px 12px',
              display: 'flex', gap: 4, overflowX: 'auto',
              scrollbarWidth: 'none',
              borderBottom: '1px solid var(--border)',
            }}>
              {Object.entries(CLASS_LABELS).map(([cls, label]) => {
                const hasSubs = SUBSTANCES_BY_CLASS[cls]?.length > 0;
                if (!hasSubs) return null;
                const isActive = pickerClass === cls;
                const color = CLASS_COLORS[cls] || 'var(--accent)';
                return (
                  <button key={cls} onClick={() => setPickerClass(cls)} style={{
                    background: isActive ? `${color}20` : 'transparent',
                    border: `1px solid ${isActive ? color : 'var(--border)'}`,
                    color: isActive ? color : 'var(--text-dim)',
                    borderRadius: 20, padding: '5px 10px', fontSize: 11,
                    fontWeight: isActive ? 700 : 500, cursor: 'pointer',
                    whiteSpace: 'nowrap', transition: 'all 0.15s',
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
              {/* Substance grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                {subsForClass.map(sub => {
                  const color = CLASS_COLORS[sub.class] || 'var(--accent)';
                  return (
                    <button key={sub.id} onClick={() => addEntry(sub.id)} style={{
                      background: 'var(--bg-secondary)',
                      border: `1px solid var(--border)`,
                      borderRadius: 10, padding: '10px 8px',
                      cursor: 'pointer', textAlign: 'center',
                      transition: 'border-color 0.15s',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 11, color: color, marginBottom: 2 }}>{sub.name}</div>
                      {sub.tHalfHours && (
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>T½ {sub.tHalfHours >= 168 ? `${(sub.tHalfHours/168).toFixed(1)} нед` : sub.tHalfHours >= 24 ? `${(sub.tHalfHours/24).toFixed(1)} дн` : `${sub.tHalfHours.toFixed(0)} ч`}</div>
                      )}
                      {sub.dosageRange && (
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{sub.dosageRange.min}–{sub.dosageRange.max} {sub.dosageRange.unit}</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Dose settings */}
              <div style={{
                background: 'var(--bg-secondary)', borderRadius: 10, padding: 10,
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>⚙️ Параметры дозировки</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {/* Dose */}
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Доза</label>
                    <input type="number" value={dose} onChange={e => setDose(e.target.value)} placeholder="200"
                      style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, outline: 'none' }} />
                  </div>
                  {/* Unit */}
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Единица</label>
                    <select value={unit} onChange={e => setUnit(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, outline: 'none' }}>
                      {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  {/* Freq */}
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Частота</label>
                    <select value={freq} onChange={e => setFreq(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, outline: 'none' }}>
                      {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  {/* Weeks */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>С нед.</label>
                      <input type="number" value={startWeek} onChange={e => setStartWeek(parseInt(e.target.value) || 0)} min={0}
                        style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>По нед.</label>
                      <input type="number" value={endWeek} onChange={e => setEndWeek(parseInt(e.target.value) || 12)} min={1}
                        style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, outline: 'none' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
