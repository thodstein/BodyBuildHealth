import React, { useState, useEffect } from 'react';
import { PHARMA_DB, SUBSTANCES_BY_CLASS } from '../../core/pharma-database';
import { validateCourse } from '../../engines/pharmacology.engine';
import { checkDrugInteractions } from '../../engines/interactions-calculator';
import { db } from '../../core/db';
import { notifyDataChange } from '../../core/data-link';
import type { CourseEntry } from '../../core/types';

const CLASS_LABELS: Record<string, string> = {
  testosterone: 'Тестостерон', trenbolone: 'Тренболон', nandrolone: 'Нандролон',
  boldenone: 'Болденон', primobolan: 'Примоболан', oral_17aa: 'Оральные 17-α',
  sarm: 'SARM', peptide_ghrh: 'GHRH', peptide_ghrp: 'GHRP',
  igf1: 'IGF-1', mgf: 'МГФ', insulin: 'Инсулин',
  drostanolone: 'Дростанолон',
  peptide_gnrh: 'GnRH', peptide_fat_loss: 'Жиросжигающие', peptide_other: 'Прочие',
};

const CLASS_COLORS: Record<string, string> = {
  testosterone: '#00e68a', trenbolone: '#ef4444', nandrolone: '#3b82f6',
  boldenone: '#a855f7', primobolan: '#06b6d4', oral_17aa: '#f97316',
  sarm: '#8b5cf6', peptide_ghrh: '#14b8a6', peptide_ghrp: '#14b8a6',
  igf1: '#ec4899', mgf: '#ec4899', insulin: '#f59e0b',
  drostanolone: '#f97316',
  peptide_gnrh: '#14b8a6', peptide_fat_loss: '#f97316', peptide_other: '#6b7280',
};

const FREQ_OPTIONS = [
  { value: '1x/wk', label: '1×/нед' },
  { value: '2x/wk', label: '2×/нед' },
  { value: '3x/wk', label: '3×/нед' },
  { value: 'eod', label: 'Ч/день' },
  { value: 'daily', label: 'Ежедн.' },
];

const FREQ_SHORT: Record<string, string> = {
  '1x/wk': '1р/нед', '2x/wk': '2р/нед', '3x/wk': '3р/нед',
  'eod': 'ч/д', 'daily': 'ежедн',
};

const UNIT_OPTIONS = ['mg/wk', 'mg', 'mcg', 'IU', 'ml'];

const pillStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '2px 8px', borderRadius: 10, fontSize: 10,
  fontWeight: 600, whiteSpace: 'nowrap',
};

export const PharmaCourseScreen: React.FC = () => {
  const [course, setCourse] = useState<CourseEntry[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerClass, setPickerClass] = useState('testosterone');
  const [dose, setDose] = useState('');
  const [unit, setUnit] = useState('mg/wk');
  const [freq, setFreq] = useState('2x/wk');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 4]);
  const [startWeek, setStartWeek] = useState(0);
  const [endWeek, setEndWeek] = useState(12);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CourseEntry | null>(null);
  const [interactions, setInteractions] = useState<ReturnType<typeof checkDrugInteractions>>([]);
  const [validation, setValidation] = useState<{ valid: boolean; warnings: string[] }>({ valid: true, warnings: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        await db.init();
        const entries = await db.getAll<CourseEntry>('course_log');
        // Filter out support-class substances (keep only pharma AAS/PCT/peptides)
        const pharmaEntries = entries.filter(e => {
          // Try direct PHARMA_DB lookup by id
          const subById = PHARMA_DB[e.substanceId];
          if (subById) return subById.class !== 'support';
          // Try by name match across all PHARMA_DB entries
          const subByName = Object.values(PHARMA_DB).find(s => 
            s.id === e.substanceId || s.name === e.substanceId || (e.substanceId||'').toLowerCase().includes((s.id||'').toLowerCase())
          );
          if (subByName) return subByName.class !== 'support';
          // If not found in PHARMA_DB at all, keep it (custom drug)
          return true;
        });
        setCourse(pharmaEntries);
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

  const addEntry = async (substanceId: string, doseVal?: number) => {
    const d = doseVal ?? parseFloat(dose);
    if (!substanceId || isNaN(d) || d <= 0) return;
    const entry: CourseEntry = {
      id: crypto.randomUUID(),
      substanceId,
      doseValue: d,
      doseUnit: unit,
      frequency: selectedDays.length >= 7 ? 'daily' : selectedDays.length <= 1 ? '1x/wk' : `${selectedDays.length}x/wk`,
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

  const updateEntry = async (id: string, changes: Partial<CourseEntry>) => {
    try {
      const entry = course.find(e => e.id === id);
      if (!entry) return;
      const updated = { ...entry, ...changes };
      await db.put('course_log', updated);
      setCourse(prev => prev.map(e => e.id === id ? updated : e));
      notifyDataChange();
    } catch (e) { console.error(e); }
  };

  const subName = (id: string) => PHARMA_DB[id]?.name ?? id;
  const subClass = (id: string) => PHARMA_DB[id]?.class ?? '';

  const startEdit = (e: CourseEntry) => {
    setEditId(e.id);
    setEditDraft({ ...e });
  };

  const saveEdit = async () => {
    if (!editId || !editDraft) return;
    const d = Number(editDraft.doseValue);
    if (isNaN(d) || d <= 0) return;
    await updateEntry(editId, {
      doseValue: d,
      doseUnit: editDraft.doseUnit,
      frequency: editDraft.frequency,
      startWeek: editDraft.startWeek,
      endWeek: editDraft.endWeek,
    });
    setEditId(null);
    setEditDraft(null);
  };

  const freqDisplay = (entry: CourseEntry) => {
    if (typeof entry.frequency === 'number') return `${entry.frequency}×/нед`;
    return FREQ_SHORT[entry.frequency] || entry.frequency;
  };

  const classColor = (cls: string) => CLASS_COLORS[cls] || 'var(--accent)';

  const totalWeeks = course.reduce((max, e) => Math.max(max, e.endWeek || 0), 0);
  const currentWeek = 0;

  const weekBar = (entry: CourseEntry) => {
    const w = totalWeeks || 16;
    const s = ((entry.startWeek || 0) / w) * 100;
    const e = (((entry.endWeek || w) - (entry.startWeek || 0)) / w) * 100;
    return { left: `${s}%`, width: `${e}%` };
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 12 }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: '#00e68a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Загрузка курса...</span>
    </div>
  );

  const subsForClass = SUBSTANCES_BY_CLASS[pickerClass] ?? [];

  return (
    <div style={{ padding: '0 0 16px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pc-card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; transition: all 0.2s; }
        .pc-card:hover { border-color: #3f3f46; }
        .pc-btn { cursor: pointer; transition: all 0.15s; user-select: none; }
        .pc-btn:active { background: rgba(0,230,138,0.15) !important; transform: scale(0.97); }
        .pc-sub-btn { cursor: pointer; transition: all 0.15s; }
        .pc-sub-btn:hover { transform: translateY(-2px); border-color: rgba(0,230,138,0.3) !important; }
        .pc-sub-btn:active { background: rgba(0,230,138,0.08) !important; transform: scale(0.96); }
        .pc-input { transition: border-color 0.15s; }
        .pc-input:focus { border-color: #00e68a !important; outline: none; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>💊</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>Мой курс</span>
          {course.length > 0 && (
            <span style={{ background: 'rgba(0,230,138,0.15)', color: '#00e68a', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>
              {course.length}
            </span>
          )}
        </div>
        <button onClick={() => setShowPicker(true)} className="pc-btn" style={{
          background: 'linear-gradient(135deg, #00e68a, #00b368)', color: '#000',
          border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700,
          fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 2px 12px rgba(0,230,138,0.25)',
        }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Добавить
        </button>
      </div>

      {/* Course entries */}
      {course.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {course.map((entry, idx) => {
            const cls = subClass(entry.substanceId);
            const color = classColor(cls);
            const sub = PHARMA_DB[entry.substanceId];
            const bar = weekBar(entry);
            return (
              <div key={entry.id} className="pc-card" style={{
                overflow: 'hidden', position: 'relative',
                borderLeft: `3px solid ${color}`,
              }}>
                {/* Week bar background */}
                {totalWeeks > 0 && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: 'rgba(255,255,255,0.04)',
                  }}>
                    <div style={{
                      position: 'absolute', top: 0, left: bar.left, width: bar.width, height: '100%',
                      background: `${color}60`, borderRadius: '0 2px 2px 0',
                    }} />
                  </div>
                )}

                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {/* Class icon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${color}18`, border: `1px solid ${color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, flexShrink: 0,
                  }}>
                    {cls === 'testosterone' || cls === 'trenbolone' || cls === 'nandrolone' || cls === 'boldenone' || cls === 'primobolan' || cls === 'drostanolone' ? '💉'
                    : cls === 'oral_17aa' ? '💊'
                    : cls === 'sarm' ? '🧬'
                    : cls === 'peptide_ghrh' || cls === 'peptide_ghrp' || cls === 'peptide_fat_loss' || cls === 'peptide_gnrh' || cls === 'peptide_other' ? '🧪'
                    : cls === 'igf1' || cls === 'mgf' ? '🔬'
                    : cls === 'insulin' ? '🩸'
                    : '💊'}
                  </div>

                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{subName(entry.substanceId)}</span>
                      <span style={{ ...pillStyle, background: `${color}20`, color, border: `1px solid ${color}40` }}>
                        {CLASS_LABELS[cls] || cls}
                      </span>
                    </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                       {editId === entry.id && editDraft ? (
                         <>
                           <input type="number" value={editDraft.doseValue || ''} onChange={e => setEditDraft({ ...editDraft, doseValue: parseFloat(e.target.value) || 0 })}
                             className="pc-input" style={{ width: 64, padding: '4px 6px', background: '#202023', border: '1px solid #00e68a', borderRadius: 6, color: '#fff', fontSize: 12, boxSizing: 'border-box' }} />
                           <select value={editDraft.doseUnit} onChange={e => setEditDraft({ ...editDraft, doseUnit: e.target.value })}
                             className="pc-input" style={{ padding: '4px 4px', background: '#202023', border: '1px solid #00e68a', borderRadius: 6, color: '#fff', fontSize: 10, boxSizing: 'border-box' }}>
                             {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                           </select>
                           <select value={typeof editDraft.frequency === 'string' ? editDraft.frequency : '2x/wk'} onChange={e => setEditDraft({ ...editDraft, frequency: e.target.value })}
                             className="pc-input" style={{ padding: '4px 4px', background: '#202023', border: '1px solid #00e68a', borderRadius: 6, color: '#fff', fontSize: 10, boxSizing: 'border-box' }}>
                             {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                           </select>
                           <input type="number" value={editDraft.startWeek} onChange={e => setEditDraft({ ...editDraft, startWeek: parseFloat(e.target.value) || 0 })}
                             className="pc-input" style={{ width: 40, padding: '4px 4px', background: '#202023', border: '1px solid #00e68a', borderRadius: 6, color: '#fff', fontSize: 11, boxSizing: 'border-box' }} title="неделя с" />
                           <span style={{ color: 'rgba(255,255,255,0.4)' }}>–</span>
                           <input type="number" value={editDraft.endWeek} onChange={e => setEditDraft({ ...editDraft, endWeek: parseFloat(e.target.value) || 0 })}
                             className="pc-input" style={{ width: 40, padding: '4px 4px', background: '#202023', border: '1px solid #00e68a', borderRadius: 6, color: '#fff', fontSize: 11, boxSizing: 'border-box' }} title="неделя по" />
                           <button onClick={saveEdit} className="pc-btn" style={{ background: 'rgba(0,230,138,0.18)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700 }}>
                             Сохранить
                           </button>
                           <button onClick={() => { setEditId(null); setEditDraft(null); }} className="pc-btn" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}>
                             ✕
                           </button>
                         </>
                       ) : (
                         <>
                           <span style={{ color: '#fff', fontWeight: 600 }}>{entry.doseValue}</span>
                           <span style={{ color: 'rgba(255,255,255,0.4)' }}>{entry.doseUnit}</span>
                           <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                           <span>{freqDisplay(entry)}</span>
                           <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                           <span>нед {entry.startWeek}–{entry.endWeek}</span>
                           {sub?.pk?.halfLifeHours && (
                             <>
                               <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                               <span>T½ {sub.pk.halfLifeHours >= 168 ? `${(sub.pk.halfLifeHours / 168).toFixed(1)} нед` : `${(sub.pk.halfLifeHours / 24).toFixed(1)} дн`}</span>
                             </>
                           )}
                         </>
                       )}
                     </div>
                    {/* Week bar visual */}
                    {totalWeeks > 0 && (
                      <div style={{ marginTop: 6, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', top: 0, left: bar.left, width: bar.width, height: '100%',
                          background: `linear-gradient(90deg, ${color}60, ${color})`,
                          borderRadius: 2,
                        }} />
                      </div>
                    )}
                  </div>

                   {/* Actions */}
                   <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                     <button onClick={() => startEdit(entry)} className="pc-btn" style={{
                       background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.25)',
                       color: '#00e68a', borderRadius: 8, padding: '6px 8px', fontSize: 12, lineHeight: 1,
                     }}
                       title="Изменить дозу">
                       ✎
                     </button>
                     <button onClick={() => removeEntry(entry.id)} className="pc-btn" style={{
                       background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                       color: '#ef4444', borderRadius: 8, padding: '6px 8px', fontSize: 12, lineHeight: 1,
                     }}
                       title="Удалить">
                       ✕
                     </button>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="pc-card" style={{ textAlign: 'center', padding: '28px 16px' }}>
          <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.6 }}>💊</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }}>Курс пуст</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Нажмите «Добавить», чтобы начать</div>
        </div>
      )}

      {/* Validation warnings */}
      {validation.warnings.length > 0 && (
        <div style={{
          marginTop: 10, background: 'rgba(255,165,2,0.08)', border: '1px solid rgba(255,165,2,0.25)',
          borderRadius: 10, padding: '8px 12px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', marginBottom: 4 }}>⚠️ Предупреждения</div>
          {validation.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 11, color: 'rgba(255,165,2,0.8)', padding: '2px 0' }}>{w}</div>
          ))}
        </div>
      )}

      {/* Interactions */}
      {interactions.length > 0 && (
        <div className="pc-card" style={{ marginTop: 10, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚡</span>
            <span style={{ fontWeight: 700, fontSize: 12 }}>Взаимодействия</span>
            <span style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '0 6px', fontSize: 10, color: 'var(--text-dim)' }}>{interactions.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {interactions.map((alert: any, i: number) => {
              const isCrit = alert.type === 'critical';
              return (
                <div key={i} style={{
                  padding: '8px 12px',
                  borderBottom: i < interactions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  borderLeft: `3px solid ${isCrit ? '#ef4444' : '#eab308'}`,
                  background: isCrit ? 'rgba(239,68,68,0.06)' : 'rgba(255,165,2,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{
                      ...pillStyle, fontSize: 9,
                      background: isCrit ? 'rgba(239,68,68,0.15)' : 'rgba(255,165,2,0.15)',
                      color: isCrit ? '#ef4444' : '#f59e0b',
                    }}>
                      {isCrit ? 'Критично' : 'Внимание'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{alert.drugs?.join(' + ')}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>{alert.mechanism}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary stats */}
      {course.length > 1 && (
        <div className="pc-card" style={{ marginTop: 10, padding: '10px 12px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Всего препаратов: <span style={{ color: '#fff', fontWeight: 700 }}>{course.length}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Длительность: <span style={{ color: '#fff', fontWeight: 700 }}>нед 0–{totalWeeks}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Классы: <span style={{ color: '#fff', fontWeight: 700 }}>
              {[...new Set(course.map(e => subClass(e.substanceId)).filter(Boolean))].length}
            </span>
          </div>
        </div>
      )}

      {/* ========= DRUG PICKER MODAL ========= */}
      {showPicker && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          alignItems: 'center',
        }} onClick={() => setShowPicker(false)}>
          <div style={{
            width: '92%', maxWidth: 420,
            maxHeight: '88vh',
            background: '#0a0a0f',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20,
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }} onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{
              padding: '14px 16px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>💊 Добавить препарат</span>
              </div>
              <button onClick={() => setShowPicker(false)} className="pc-btn" style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '5px 10px',
                fontSize: 12, lineHeight: 1,
              }}>
                ✕
              </button>
            </div>

            {/* Class selector — scrollable pills */}
            <div style={{
              padding: '8px 10px 6px',
              display: 'flex', gap: 5, flexWrap: 'wrap',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              maxHeight: 300, overflowY: 'auto',
            }}>
              {Object.entries(CLASS_LABELS).map(([cls, label]) => {
                const hasSubs = SUBSTANCES_BY_CLASS[cls]?.length > 0;
                if (!hasSubs) return null;
                const isActive = pickerClass === cls;
                const color = CLASS_COLORS[cls] || '#00e68a';
                return (
                  <button key={cls} onClick={() => setPickerClass(cls)} className="pc-btn" style={{
                    background: isActive ? `${color}30` : '#202023',
                    border: `1px solid ${isActive ? color : '#3f3f46'}`,
                    color: isActive ? color : 'rgba(255,255,255,0.6)',
                    borderRadius: 20, padding: '6px 12px', fontSize: 11,
                    fontWeight: isActive ? 700 : 500,
                    whiteSpace: 'nowrap',
                  }}>
                    {label}
                    <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.6 }}>{SUBSTANCES_BY_CLASS[cls]?.length || 0}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
              {/* Substance grid — one-click add */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                {subsForClass.map(sub => {
                  const color = CLASS_COLORS[sub.class] || '#00e68a';
                  const defDose = sub.dosageRange?.min ? Math.round((sub.dosageRange.min + sub.dosageRange.max) / 2) : 250;
                  const customDose = (dose && parseFloat(dose) > 0) ? parseFloat(dose) : null;
                  const hl = sub.pk?.halfLifeHours;
                  return (
                    <div key={sub.id} onClick={() => {
                      const doseVal = (dose && parseFloat(dose) > 0) ? parseFloat(dose) : defDose;
                      addEntry(sub.id, doseVal);
                    }} className="pc-sub-btn" style={{
                      background: '#202023',
                      border: `1px solid ${customDose ? color : '#3f3f46'}`,
                      borderRadius: 10, padding: '10px 8px',
                      cursor: 'pointer', textAlign: 'center',
                      position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
                      <div style={{ fontWeight: 700, fontSize: 11, color, marginBottom: 3, lineHeight: 1.3 }}>{sub.name}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                        {hl ? (hl >= 168 ? `T½ ${(hl / 168).toFixed(1)} нед` : `T½ ${(hl / 24).toFixed(1)} дн`) : ''}
                        {sub.dosageRange ? ` · ${sub.dosageRange.min}–${sub.dosageRange.max} ${sub.dosageRange.unit}` : ''}
                      </div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        background: customDose ? `${color}35` : `${color}25`, color, borderRadius: 6,
                        padding: '3px 10px', fontSize: 10, fontWeight: 700, marginTop: 3,
                      }}>
                        + {customDose ?? defDose} {unit}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom dose settings */}
              <div style={{
                background: '#18181b', borderRadius: 10, padding: '10px 12px',
                border: '1px solid #27272a',
              }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 8, lineHeight: 1.3 }}>
                  Задайте свою дозировку, затем нажмите на препарат выше:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input type="number" value={dose || ''} onChange={e => setDose(e.target.value)} placeholder="200"
                      className="pc-input" style={{
                        flex: 2, padding: '7px 8px', background: '#202023',
                        border: '1px solid #3f3f46', borderRadius: 8,
                        color: '#fff', fontSize: 12, boxSizing: 'border-box', minWidth: 0,
                      }} />
                    <select value={unit} onChange={e => setUnit(e.target.value)}
                      style={{
                        flex: 1, padding: '7px 6px', background: '#202023',
                        border: '1px solid #3f3f46', borderRadius: 8,
                        color: '#fff', fontSize: 10, boxSizing: 'border-box', minWidth: 56,
                      }}>
                      {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent:'center', gap:3, flexWrap:'wrap' }}>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)', whiteSpace:'nowrap', minWidth:40 }}>Дни:</span>
                    {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((day, idx) => (
                      <button key={idx} onClick={() => {
                        setSelectedDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx].sort());
                      }} style={{
                        width:28, height:28, borderRadius:'50%', fontSize:9, fontWeight:600,
                        cursor:'pointer', border:`1px solid ${selectedDays.includes(idx) ? '#00e68a' : '#3f3f46'}`,
                        background: selectedDays.includes(idx) ? 'rgba(0,230,138,0.25)' : '#202023',
                        color: selectedDays.includes(idx) ? '#00e68a' : 'rgba(255,255,255,0.5)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>{day}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>c нед</span>
                    <input type="number" value={startWeek} onChange={e => setStartWeek(parseFloat(e.target.value) || 0 || 0)} min={0} placeholder="0"
                      className="pc-input" style={{
                        flex: 1, padding: '7px 8px', background: '#202023',
                        border: '1px solid #3f3f46', borderRadius: 8,
                        color: '#fff', fontSize: 12, boxSizing: 'border-box', minWidth: 0, width: '100%',
                      }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>по нед</span>
                    <input type="number" value={endWeek} onChange={e => setEndWeek(parseFloat(e.target.value) || 0 || 12)} min={1} placeholder="12"
                      className="pc-input" style={{
                        flex: 1, padding: '7px 8px', background: '#202023',
                        border: '1px solid #3f3f46', borderRadius: 8,
                        color: '#fff', fontSize: 12, boxSizing: 'border-box', minWidth: 0, width: '100%',
                      }} />
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
