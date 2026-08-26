import React, { useState, useEffect, useMemo } from 'react';
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

const CLASS_ICONS: Record<string, string> = {
  testosterone: '💉', trenbolone: '💉', nandrolone: '💉', boldenone: '💉',
  primobolan: '💉', drostanolone: '💉', oral_17aa: '💊', sarm: '🧬',
  peptide_ghrh: '🧪', peptide_ghrp: '🧪', peptide_gnrh: '🧪',
  peptide_fat_loss: '🧪', peptide_other: '🧪', igf1: '🔬', mgf: '🔬', insulin: '🩸',
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

const subClassOf = (id: string) => PHARMA_DB[id]?.class ?? '';
const classColorOf = (cls: string) => CLASS_COLORS[cls] || 'var(--accent)';

const pillStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 8px', borderRadius: 10, fontSize: 10,
  fontWeight: 700, whiteSpace: 'nowrap',
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
  const [viewTab, setViewTab] = useState<'current' | 'schedule' | 'graph' | 'history'>('current');
  const [courseStartDate, setCourseStartDate] = useState(() => {
    const saved = localStorage.getItem('he_course_start_date');
    return saved || new Date().toISOString().slice(0, 10);
  });
  const [historyCourses, setHistoryCourses] = useState<{ name: string; date: string; entries: CourseEntry[] }[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_course_history') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        await db.init();
        const entries = await db.getAll<CourseEntry>('course_log');
        const pharmaEntries = entries.filter(e => {
          const subById = PHARMA_DB[e.substanceId];
          if (subById) return subById.class !== 'support';
          const subByName = Object.values(PHARMA_DB).find(s => 
            s.id === e.substanceId || s.name === e.substanceId || (e.substanceId||'').toLowerCase().includes((s.id||'').toLowerCase())
          );
          if (subByName) return subByName.class !== 'support';
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
  const subClass = subClassOf;

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

  const classColor = classColorOf;

  const totalWeeks = course.reduce((max, e) => Math.max(max, e.endWeek || 0), 0);

  const currentWeek = useMemo(() => {
    if (!courseStartDate) return 0;
    const start = new Date(courseStartDate);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - start.getTime()) / 86400000);
    return Math.max(0, Math.floor(diffDays / 7));
  }, [courseStartDate]);

  const saveCourseHistory = async () => {
    if (course.length === 0) return;
    const name = prompt('Название курса (например "Массонабор 16 недель"):');
    if (!name) return;
    const entry = { name, date: new Date().toISOString().slice(0, 10), entries: [...course] };
    const newHistory = [...historyCourses, entry];
    setHistoryCourses(newHistory);
    localStorage.setItem('he_course_history', JSON.stringify(newHistory));
    for (const e of course) { try { await db.delete('course_log', e.id); } catch {} }
    setCourse([]);
    notifyDataChange();
    if ((window as any).showToast) (window as any).showToast('📦 Курс сохранён в историю');
  };

  const weekBar = (entry: CourseEntry) => {
    const w = totalWeeks || 16;
    const s = ((entry.startWeek || 0) / w) * 100;
    const e = (((entry.endWeek || w) - (entry.startWeek || 0)) / w) * 100;
    return { left: `${s}%`, width: `${e}%` };
  };

  const getDaysFromFreq = (freq: string): number[] => {
    const s = String(freq||'').trim();
    if (s === 'daily') return [0,1,2,3,4,5,6];
    if (s === 'eod') return [0,2,4,6];
    if (s === '3x/wk') return [0,2,4];
    if (s === '2x/wk') return [1,4];
    if (s === '1x/wk') return [3];
    if (s.includes(',')) return s.split(',').map(v=>parseInt(v.trim(),10)).filter(n=>!isNaN(n)&&n>=0&&n<7);
    const m = s.match(/(\d+)/);
    if (m) { const n=Math.min(7,parseInt(m[1],10)); if(n<=0) return []; if(n>=7) return [0,1,2,3,4,5,6]; return Array.from({length:n},(_,i)=> (i*2)%7).slice(0,n).sort((a,b)=>a-b); }
    return [];
  };
  const freqFromDays = (days: number[]): string => {
    if (days.length===7) return 'daily';
    if (days.length===4 && days.join(',')==='0,2,4,6') return 'eod';
    if (days.length===3 && days.join(',')==='0,2,4') return '3x/wk';
    if (days.length===2 && days.join(',')==='1,4') return '2x/wk';
    if (days.length===1 && days[0]===3) return '1x/wk';
    if (days.length===0) return '1x/wk';
    return days.slice().sort((a,b)=>a-b).join(',');
  };
  const scheduleData = useMemo(() => {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const grid: { day: string; entries: { entry: CourseEntry; color: string }[] }[] = days.map(day => ({ day, entries: [] }));
    for (const entry of course) {
      const cls = subClass(entry.substanceId);
      const color = classColor(cls);
      const freq = typeof entry.frequency === 'string' ? entry.frequency : `${entry.frequency}x/wk`;
      const dayIndices = getDaysFromFreq(freq);
      for (const idx of dayIndices) { if(grid[idx]) grid[idx].entries.push({ entry, color }); }
    }
    return grid;
  }, [course, subClass, classColor]);

  const graphData = useMemo(() => {
    if (course.length === 0 || totalWeeks === 0) return null;
    const weeks: { week: number; entries: { entry: CourseEntry; color: string }[] }[] = [];
    for (let w = 0; w <= totalWeeks; w++) {
      const active = course.filter(e => w >= (e.startWeek || 0) && w < (e.endWeek || totalWeeks));
      weeks.push({ week: w, entries: active.map(e => ({ entry: e, color: classColor(subClass(e.substanceId)) })) });
    }
    return weeks;
  }, [course, totalWeeks, subClass, classColor]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 12 }}>
      <div style={{ width: 34, height: 34, border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 12, color:'#fff', fontWeight:600 }}>Загрузка курса...</span>
    </div>
  );

  const subsForClass = SUBSTANCES_BY_CLASS[pickerClass] ?? [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pc-glass { background: rgba(20,20,24,0.62); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; backdrop-filter: blur(16px) saturate(140%); -webkit-backdrop-filter: blur(16px) saturate(140%); box-shadow: 0 8px 24px rgba(0,0,0,0.28); }
        .pc-card2 { background: rgba(22,22,26,0.68); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); transition: all 0.2s ease; }
        .pc-card2:hover { border-color: rgba(255,255,255,0.12); transform: translateY(-1px); box-shadow: 0 10px 28px rgba(0,0,0,0.32); }
        .pc-btn2 { cursor: pointer; transition: all 0.18s ease; user-select: none; }
        .pc-btn2:active { transform: scale(0.97); }
        .pc-sub-btn2 { cursor: pointer; transition: all 0.18s ease; }
        .pc-sub-btn2:hover { transform: translateY(-2px); border-color: rgba(139,92,246,0.35) !important; box-shadow: 0 8px 20px rgba(0,0,0,0.22); }
        .pc-sub-btn2:active { transform: scale(0.98); }
        .pc-input2 { transition: border-color 0.15s, box-shadow 0.15s; }
        .pc-input2:focus { border-color: #8b5cf6 !important; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); outline: none; }
      `}</style>

      {/* Header — фикс наложения: перенос, белый текст, не перекрывает инфу */}
      <div className="pc-glass" style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', background:'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(59,130,246,0.06))' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:'1 1 200px' }}>
          <div style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #8b5cf6, #6d28d9)', color:'#fff', fontSize:16, boxShadow:'0 4px 14px rgba(139,92,246,0.35)', flexShrink:0 }}>💊</div>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
              <span style={{ fontWeight:800, fontSize:14, color:'#fff', letterSpacing:-0.3 }}>Мой курс</span>
              <span style={{ background:'rgba(139,92,246,0.16)', color:'#fff', border:'1px solid rgba(139,92,246,0.22)', borderRadius:10, padding:'1px 7px', fontSize:11, fontWeight:800 }}>{course.length}</span>
              {course.length>0 && <span style={{ fontSize:10, color:'#fff' }}>· {totalWeeks} нед · {[...new Set(course.map(e=>subClass(e.substanceId)).filter(Boolean))].length} классов</span>}
            </div>
            <div style={{ fontSize:10, color:'#fff', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {course.length===0 ? 'Добавь препараты и настрой недели • PK/PD учтётся автоматически' : `Неделя ${currentWeek} • ${course.length} преп. • длительность 0–${totalWeeks}`}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:7, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
          {course.length > 0 && (
            <button onClick={saveCourseHistory} className="pc-btn2" style={{
              background: 'rgba(245,158,11,0.12)', color: '#fff',
              border: '1px solid rgba(245,158,11,0.22)', borderRadius: 12, padding: '8px 11px', fontWeight:700,
              fontSize:11, backdropFilter:'blur(8px)',
            }}>
              📦 Завершить
            </button>
          )}
          <button onClick={() => setShowPicker(true)} className="pc-btn2" style={{
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff',
            border: '1px solid rgba(139,92,246,0.35)', borderRadius: 12, padding: '9px 14px', fontWeight:800,
            fontSize:12, display:'flex', alignItems:'center', gap:6,
            boxShadow: '0 6px 18px rgba(139,92,246,0.28)',
          }}>
            <span style={{ fontSize:14, lineHeight:1, background:'rgba(255,255,255,0.16)', width:18, height:18, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>+</span> Добавить
          </button>
        </div>
      </div>

      {/* Course start date */}
      <div className="pc-glass" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', flexWrap:'wrap' }}>
        <span style={{ fontSize:11, color:'#fff', fontWeight:700, display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>📅 Старт курса</span>
        <input type="date" value={courseStartDate} onChange={e => {
          setCourseStartDate(e.target.value);
          localStorage.setItem('he_course_start_date', e.target.value);
        }} style={{ background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'7px 10px', color:'#fff', fontSize:12, fontWeight:600, outline:'none' }} />
        {currentWeek > 0 && (
          <span style={{ fontSize:11, color:'#fff', fontWeight:800, background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.18)', padding:'5px 9px', borderRadius:20 }}>▶ Неделя {currentWeek}</span>
        )}
        <span style={{ marginLeft:'auto', fontSize:10, color:'#fff' }}>{course.length>0 ? 'Прогресс бара = окно приёма' : 'Выбери дату — подсветим активные препараты'}</span>
      </div>

      {/* View tabs */}
      <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
        {([['current', '📋 Текущий'], ['schedule', '📅 Расписание'], ['graph', '📊 График'], ['history', '📚 История']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setViewTab(key)} style={{
            padding:'7px 13px', borderRadius:20, cursor:'pointer', fontSize:11, fontWeight:700, whiteSpace:'nowrap',
            border:`1px solid ${viewTab === key ? 'rgba(139,92,246,0.38)' : 'rgba(255,255,255,0.07)'}`,
            background: viewTab === key ? 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(124,58,237,0.18))' : 'rgba(255,255,255,0.05)',
            color: viewTab === key ? '#fff' : '#fff',
            boxShadow: viewTab===key ? '0 4px 14px rgba(139,92,246,0.18)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      {/* ---- CURRENT TAB ---- */}
      {viewTab === 'current' && (
        <>
          {course.length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
              {course.map((entry) => {
                const cls = subClass(entry.substanceId);
                const color = classColor(cls);
                const sub = PHARMA_DB[entry.substanceId];
                const bar = weekBar(entry);
                const isActive = (entry.startWeek || 0) <= currentWeek && currentWeek < entry.endWeek;
                return (
                  <div key={entry.id} className="pc-card2" style={{
                    overflow:'hidden', position:'relative',
                    borderLeft:`3px solid ${color}`,
                    background: isActive ? `linear-gradient(90deg, ${color}0d, rgba(22,22,26,0.68))` : undefined,
                  }}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'rgba(255,255,255,0.05)' }}>
                      <div style={{ position:'absolute', top:0, left:bar.left, width:bar.width, height:'100%', background:`linear-gradient(90deg, ${color}55, ${color})`, borderRadius:'0 2px 2px 0' }} />
                    </div>
                    <div style={{ padding:'11px 12px', display:'flex', alignItems:'flex-start', gap:11 }}>
                      <div style={{
                        width:38, height:38, borderRadius:11,
                        background:`linear-gradient(135deg, ${color}22, ${color}0d)`, border:`1px solid ${color}2a`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:16, flexShrink:0, boxShadow:`0 4px 12px ${color}18`,
                      }}>
                        {CLASS_ICONS[cls] || '💊'}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:3 }}>
                          <span style={{ fontWeight:800, fontSize:13, color:'#fff', letterSpacing:-0.2 }}>{subName(entry.substanceId)}</span>
                          <span style={{ ...pillStyle, background:`${color}18`, color, border:`1px solid ${color}30`, borderRadius:20, padding:'2px 8px' }}>{CLASS_LABELS[cls] || cls}</span>
                          {isActive && <span style={{ ...pillStyle, fontSize:9, color:'#00e68a', background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.18)', borderRadius:20 }}>● Активен</span>}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', fontSize:11, color:'#fff' }}>
                          {editId === entry.id && editDraft ? (
                            <>
                              <input type="number" value={editDraft.doseValue || ''} onChange={e => setEditDraft({ ...editDraft, doseValue: parseFloat(e.target.value) || 0 })}
                                className="pc-input2" style={{ width:72, padding:'6px 8px', background:'rgba(0,0,0,0.32)', border:'1px solid rgba(139,92,246,0.35)', borderRadius:9, color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box' }} />
                              <select value={editDraft.doseUnit} onChange={e => setEditDraft({ ...editDraft, doseUnit: e.target.value })}
                                className="pc-input2" style={{ padding:'6px 6px', background:'rgba(0,0,0,0.32)', border:'1px solid rgba(139,92,246,0.35)', borderRadius:9, color:'#fff', fontSize:11, boxSizing:'border-box' }}>
                                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                              <select value={typeof editDraft.frequency === 'string' ? editDraft.frequency : '2x/wk'} onChange={e => setEditDraft({ ...editDraft, frequency: e.target.value })}
                                className="pc-input2" style={{ padding:'6px 6px', background:'rgba(0,0,0,0.32)', border:'1px solid rgba(139,92,246,0.35)', borderRadius:9, color:'#fff', fontSize:11 }}>
                                {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                              </select>
                              <input type="number" value={editDraft.startWeek} onChange={e => setEditDraft({ ...editDraft, startWeek: parseFloat(e.target.value) || 0 })}
                                className="pc-input2" style={{ width:52, padding:'6px 6px', background:'rgba(0,0,0,0.32)', border:'1px solid rgba(139,92,246,0.35)', borderRadius:9, color:'#fff', fontSize:11, boxSizing:'border-box' }} />
                              <span style={{ color:'#fff' }}>–</span>
                              <input type="number" value={editDraft.endWeek} onChange={e => setEditDraft({ ...editDraft, endWeek: parseFloat(e.target.value) || 0 })}
                                className="pc-input2" style={{ width:52, padding:'6px 6px', background:'rgba(0,0,0,0.32)', border:'1px solid rgba(139,92,246,0.35)', borderRadius:9, color:'#fff', fontSize:11 }} />
                              <button onClick={saveEdit} className="pc-btn2" style={{ background:'linear-gradient(135deg, #00e68a, #00b368)', color:'#000', border:'none', borderRadius:9, padding:'6px 10px', fontSize:11, fontWeight:800 }}>Сохранить</button>
                              <button onClick={() => { setEditId(null); setEditDraft(null); }} className="pc-btn2" style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', borderRadius:9, padding:'6px 10px', fontSize:11, fontWeight:700 }}>✕</button>
                            </>
                          ) : (
                            <>
                              <span style={{ color:'#fff', fontWeight:800, fontSize:12 }}>{entry.doseValue}</span>
                              <span style={{ color:'#fff', fontWeight:600 }}>{entry.doseUnit}</span>
                              <span style={{ width:3, height:3, borderRadius:'50%', background:'rgba(255,255,255,0.22)' }} />
                              <span style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20, fontSize:10, fontWeight:700 }}>{freqDisplay(entry)}</span>
                              <span style={{ color:'#fff' }}>нед {entry.startWeek}–{entry.endWeek}</span>
                              {sub?.pk?.halfLifeHours && (
                                <>
                                  <span style={{ width:3, height:3, borderRadius:'50%', background:'rgba(255,255,255,0.22)' }} />
                                  <span style={{ fontSize:10, color:'#fff' }}>T½ {sub.pk.halfLifeHours >= 168 ? `${(sub.pk.halfLifeHours / 168).toFixed(1)} нед` : `${(sub.pk.halfLifeHours / 24).toFixed(1)} дн`}</span>
                                </>
                              )}
                            </>
                          )}
                        </div>
                        <div style={{ marginTop:7, height:4, background:'rgba(255,255,255,0.07)', borderRadius:20, position:'relative', overflow:'hidden' }}>
                          <div style={{ position:'absolute', top:0, left:bar.left, width:bar.width, height:'100%', background:`linear-gradient(90deg, ${color}55, ${color})`, borderRadius:20, boxShadow:`0 0 8px ${color}55` }} />
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        <button onClick={() => startEdit(entry)} className="pc-btn2" style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.22)', color:'#a78bfa', fontSize:12, fontWeight:800 }} title="Изменить">✎</button>
                        <button onClick={() => removeEntry(entry.id)} className="pc-btn2" style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.18)', color:'#f87171', fontSize:13 }} title="Удалить">✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pc-glass" style={{ textAlign:'center', padding:'30px 18px', borderStyle:'dashed', background:'rgba(20,20,24,0.42)' }}>
              <div style={{ width:52, height:52, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px', background:'linear-gradient(135deg, rgba(139,92,246,0.16), rgba(59,130,246,0.12))', border:'1px solid rgba(139,92,246,0.18)', fontSize:24 }}>💊</div>
              <div style={{ fontSize:13, color:'#fff', fontWeight:800, marginBottom:4 }}>Курс пуст</div>
              <div style={{ fontSize:11, color:'#fff', lineHeight:1.45, maxWidth:320, margin:'0 auto 10px' }}>Нажми «Добавить» — выбери класс и препарат, доза и недели настроятся автоматически</div>
              <button onClick={()=>setShowPicker(true)} className="pc-btn2" style={{ background:'linear-gradient(135deg, #8b5cf6, #7c3aed)', color:'#fff', border:'none', borderRadius:12, padding:'9px 16px', fontWeight:800, fontSize:12 }}>+ Добавить первый препарат</button>
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="pc-glass" style={{ background:'linear-gradient(135deg, rgba(245,158,11,0.09), rgba(245,158,11,0.04))', borderColor:'rgba(245,158,11,0.20)', padding:'10px 12px' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#fbbf24', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>⚠️ Предупреждения <span style={{ marginLeft:'auto', background:'rgba(245,158,11,0.16)', padding:'2px 7px', borderRadius:20, fontSize:10 }}>{validation.warnings.length}</span></div>
              {validation.warnings.map((w, i) => (
                <div key={i} style={{ fontSize:11, color:'#fff', padding:'4px 0 4px 14px', position:'relative', lineHeight:1.4 }}><span style={{ position:'absolute', left:0, color:'#f59e0b' }}>•</span>{w}</div>
              ))}
            </div>
          )}
          {interactions.length > 0 && (
            <div className="pc-glass" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:7, background:'linear-gradient(90deg, rgba(239,68,68,0.08), transparent)' }}>
                <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.14)', fontSize:11 }}>⚡</span>
                <span style={{ fontWeight:800, fontSize:12, color:'#fff' }}>Взаимодействия</span>
                <span style={{ background:'rgba(255,255,255,0.06)', borderRadius:20, padding:'2px 8px', fontSize:10, color:'#fff', fontWeight:700 }}>{interactions.length}</span>
                <span style={{ marginLeft:'auto', fontSize:10, color:'#fff' }}>проверь перед стартом</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column' }}>
                {interactions.map((alert: any, i: number) => {
                  const isCrit = alert.type === 'critical';
                  return (
                    <div key={i} style={{
                      padding:'10px 12px',
                      borderBottom: i < interactions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      borderLeft:`3px solid ${isCrit ? '#ef4444' : '#f59e0b'}`,
                      background: isCrit ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.05)',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                        <span style={{ fontSize:9, fontWeight:800, padding:'3px 7px', borderRadius:20, letterSpacing:0.4, background: isCrit ? 'rgba(239,68,68,0.16)' : 'rgba(245,158,11,0.16)', color: isCrit ? '#f87171' : '#fbbf24', border:`1px solid ${isCrit ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.22)'}` }}>
                          {isCrit ? 'КРИТИЧНО' : 'ВНИМАНИЕ'}
                        </span>
                        <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{alert.drugs?.join(' + ')}</span>
                      </div>
                      <div style={{ fontSize:11, color:'#fff', lineHeight:1.45 }}>{alert.mechanism}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {course.length > 1 && (
            <div className="pc-glass" style={{ padding:'10px 12px', display:'flex', gap:10, flexWrap:'wrap', background:'rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize:11, color:'#fff' }}>Всего <b style={{ color:'#fff' }}>{course.length}</b></div>
              <div style={{ width:1, height:14, background:'rgba(255,255,255,0.08)', alignSelf:'center' }} />
              <div style={{ fontSize:11, color:'#fff' }}>Длительность <b style={{ color:'#fff' }}>0–{totalWeeks} нед</b></div>
              <div style={{ width:1, height:14, background:'rgba(255,255,255,0.08)', alignSelf:'center' }} />
              <div style={{ fontSize:11, color:'#fff' }}>Классов <b style={{ color:'#fff' }}>{[...new Set(course.map(e => subClass(e.substanceId)).filter(Boolean))].length}</b></div>
            </div>
          )}
        </>
      )}

      {viewTab === 'schedule' && (
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          {course.length === 0 ? (
            <div className="pc-glass" style={{ textAlign:'center', padding:'30px 16px', borderStyle:'dashed' }}>
              <div style={{ fontSize:28, marginBottom:8, opacity:0.7 }}>📅</div>
              <div style={{ fontSize:13, color:'#fff', fontWeight:700, marginBottom:4 }}>Нет препаратов</div>
              <div style={{ fontSize:11, color:'#fff' }}>Добавь препараты на вкладке «Текущий»</div>
            </div>
          ) : (
            <>
              <div className="pc-glass" style={{ padding:'12px' }}>
                <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:10, display:'flex', alignItems:'center', gap:7 }}>📅 Недельное расписание <span style={{ marginLeft:'auto', fontSize:10, color:'#fff', fontWeight:600 }}>по дням частоты</span></div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6 }}>
                  {scheduleData.map(day => (
                    <div key={day.day} style={{
                      background: day.entries.length>0 ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.03)', borderRadius:12, padding:'7px 5px', textAlign:'center',
                      border: day.entries.length > 0 ? '1px solid rgba(139,92,246,0.18)' : '1px solid rgba(255,255,255,0.06)',
                      minHeight:84,
                    }}>
                      <div style={{ fontSize:10, fontWeight:800, color: day.entries.length > 0 ? '#a78bfa' : 'rgba(255,255,255,0.32)', marginBottom:6, letterSpacing:0.3 }}>{day.day}</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        {day.entries.length===0 && <span style={{ fontSize:9, color:'#fff' }}>—</span>}
                        {day.entries.map((item, i) => (
                          <div key={i} style={{
                            fontSize:8, color:'#fff', background:`${item.color}18`,
                            borderRadius:7, padding:'3px 4px', lineHeight:1.25, fontWeight:700,
                            borderLeft:`2px solid ${item.color}`, textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                          }}>
                            {PHARMA_DB[item.entry.substanceId]?.name || item.entry.substanceId}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pc-glass" style={{ padding:'12px' }}>
                <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:9, display:'flex', alignItems:'center', gap:7 }}>💊 Дозировки по препаратам — редактируй дни <span style={{ marginLeft:'auto', fontSize:10, color:'#fff', opacity:0.7 }}>{course.length} позиций · тапни день</span></div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {course.map(entry => {
                    const cls = subClass(entry.substanceId);
                    const color = classColor(cls);
                    const isAct = (entry.startWeek || 0) <= currentWeek && currentWeek < entry.endWeek;
                    const selected = getDaysFromFreq(String(entry.frequency||''));
                    return (
                      <div key={entry.id} style={{
                        display:'flex', flexDirection:'column', gap:6, padding:'8px 9px',
                        background: isAct ? `${color}10` : 'rgba(255,255,255,0.03)', borderRadius:12,
                        border:`1px solid ${isAct ? color+'22' : 'rgba(255,255,255,0.06)'}`,
                        borderLeft:`3px solid ${color}`,
                      }}>
                        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                          <div style={{ width:26, height:26, borderRadius:8, background:`${color}16`, border:`1px solid ${color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0 }}>
                            {CLASS_ICONS[cls] || '💊'}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, fontWeight:800, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{subName(entry.substanceId)}</div>
                            <div style={{ fontSize:10, color:'#fff' }}>{CLASS_LABELS[cls] || cls}</div>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontSize:12, fontWeight:800, color: isAct ? '#a78bfa' : '#fff' }}>{entry.doseValue} <span style={{ fontSize:10, color:'#fff', fontWeight:600 }}>{entry.doseUnit}</span></div>
                            <div style={{ fontSize:10, color:'#fff' }}>{freqDisplay(entry)} · нед {entry.startWeek || 0}–{entry.endWeek}</div>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d,i)=>{
                            const active = selected.includes(i);
                            return (
                              <button key={i} onClick={()=>{ const cur=getDaysFromFreq(String(entry.frequency||'')); const next=cur.includes(i)?cur.filter(x=>x!==i):[...cur,i].sort((a,b)=>a-b); const nf=freqFromDays(next.length?next:[i]); updateEntry(entry.id,{frequency:nf}); }} style={{ flex:1, minWidth:30, height:26, borderRadius:7, fontSize:9, fontWeight:700, cursor:'pointer', border:`1px solid ${active?'#8b5cf6':'rgba(255,255,255,0.08)'}`, background: active?'rgba(139,92,246,0.18)':'rgba(255,255,255,0.04)', color:'#fff' }}>{d}</button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {viewTab === 'graph' && (
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          {course.length === 0 || !graphData ? (
            <div className="pc-glass" style={{ textAlign:'center', padding:'30px 16px', borderStyle:'dashed' }}>
              <div style={{ fontSize:28, marginBottom:8, opacity:0.6 }}>📊</div>
              <div style={{ fontSize:13, color:'#fff', fontWeight:700, marginBottom:4 }}>Нет данных для графика</div>
              <div style={{ fontSize:11, color:'#fff' }}>Добавь хотя бы один препарат</div>
            </div>
          ) : (
            <>
              <div className="pc-glass" style={{ padding:'12px' }}>
                <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:10, display:'flex', alignItems:'center', gap:7 }}>📊 График курса <span style={{ marginLeft:'auto', fontSize:11, background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.18)', color:'#a78bfa', padding:'3px 8px', borderRadius:20, fontWeight:800 }}>{totalWeeks} нед</span></div>
                <div style={{ display:'flex', gap:0, marginBottom:6, paddingLeft:84 }}>
                  {graphData.map(w => (
                    <div key={w.week} style={{
                      flex:1, textAlign:'center', fontSize:8, fontWeight:700,
                      color: w.week === currentWeek ? '#a78bfa' : 'rgba(255,255,255,0.32)',
                      background: w.week === currentWeek ? 'rgba(139,92,246,0.12)' : 'transparent',
                      padding:'3px 0', borderRadius:6,
                    }}>{w.week}</div>
                  ))}
                </div>
                {course.map(entry => {
                  const cls = subClass(entry.substanceId);
                  const color = classColor(cls);
                  const sw = entry.startWeek || 0;
                  const ew = entry.endWeek || totalWeeks;
                  return (
                    <div key={entry.id} style={{ display:'flex', alignItems:'center', marginBottom:6, gap:6 }}>
                      <div style={{ width:78, fontSize:9, color:'#fff', textAlign:'right', paddingRight:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:700 }}>
                        {subName(entry.substanceId)}
                      </div>
                      <div style={{ flex:1, display:'flex', position:'relative', height:18, background:'rgba(255,255,255,0.04)', borderRadius:8, overflow:'hidden', border:'1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ position:'absolute', inset:0, display:'flex' }}>
                          {graphData.map(w => (
                            <div key={w.week} style={{
                              flex:1, height:'100%', borderRight:'1px solid rgba(255,255,255,0.03)',
                              background: w.week === currentWeek ? 'rgba(139,92,246,0.08)' : 'transparent',
                            }} />
                          ))}
                        </div>
                        <div style={{
                          position:'absolute', top:3, bottom:3, left:`${(sw / totalWeeks) * 100}%`,
                          width:`${((ew - sw) / totalWeeks) * 100}%`,
                          borderRadius:7, background:`linear-gradient(90deg, ${color}66, ${color})`,
                          border:`1px solid ${color}66`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 2px 8px ${color}33`,
                        }}>
                          <span style={{ fontSize:7, fontWeight:800, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,0.45)' }}>{entry.doseValue}{entry.doseUnit}</span>
                        </div>
                        {currentWeek >= sw && currentWeek < ew && (
                          <div style={{ position:'absolute', top:0, bottom:0, left:`${(currentWeek / totalWeeks) * 100}%`, width:2, background:'#a78bfa', borderRadius:1, boxShadow:'0 0 8px rgba(139,92,246,0.7)' }} />
                        )}
                      </div>
                    </div>
                  );
                })}
                {currentWeek>=0 && <div style={{ fontSize:10, color:'#fff', marginTop:4, textAlign:'center' }}>● Текущая неделя подсвечена фиолетовым</div>}
              </div>
              <div className="pc-glass" style={{ padding:'9px 12px', display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:800, color:'#fff' }}>Легенда:</span>
                {[...new Set(course.map(e => subClass(e.substanceId)))].map(cls => {
                  const color = classColor(cls);
                  return (
                    <div key={cls} style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <div style={{ width:10, height:10, borderRadius:3, background:`${color}66`, border:`1px solid ${color}55` }} />
                      <span style={{ fontSize:10, color:'#fff', fontWeight:600 }}>{CLASS_LABELS[cls] || cls}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {viewTab === 'history' && (
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          {historyCourses.length === 0 ? (
            <div className="pc-glass" style={{ textAlign:'center', padding:'30px 16px', borderStyle:'dashed' }}>
              <div style={{ width:48, height:48, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px', background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.14)', fontSize:22 }}>📚</div>
              <div style={{ fontSize:13, color:'#fff', fontWeight:800, marginBottom:4 }}>Нет сохранённых курсов</div>
              <div style={{ fontSize:11, color:'#fff', lineHeight:1.5 }}>
                Нажми «📦 Завершить курс» на вкладке «Текущий»<br />чтобы сохранить курс в историю
              </div>
            </div>
          ) : (
            historyCourses.map((cr, i) => (
              <div key={i} className="pc-card2" style={{ padding:'12px', borderLeft:'3px solid #f59e0b' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, gap:8 }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{cr.name}</div>
                    <div style={{ fontSize:10, color:'#fff' }}>{cr.date} • {cr.entries.length} преп.</div>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                    <span style={{ ...pillStyle, fontSize:10, color:'#fbbf24', background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.18)', borderRadius:20 }}>{cr.entries.length} пр.</span>
                    <button onClick={() => {
                      if (!confirm(`Восстановить курс "${cr.name}"?`)) return;
                      setCourse(cr.entries);
                      cr.entries.forEach(async (e) => { try { await db.put('course_log', e); } catch {} });
                      const newHistory = historyCourses.filter((_, j) => j !== i);
                      setHistoryCourses(newHistory);
                      localStorage.setItem('he_course_history', JSON.stringify(newHistory));
                      notifyDataChange();
                      setViewTab('current');
                    }} className="pc-btn2" style={{
                      background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.22)',
                      color:'#00e68a', borderRadius:9, padding:'6px 10px', fontSize:11, fontWeight:800,
                    }}>↺ Восстановить</button>
                    <button onClick={() => {
                      if (!confirm(`Удалить "${cr.name}" из истории?`)) return;
                      const newHistory = historyCourses.filter((_, j) => j !== i);
                      setHistoryCourses(newHistory);
                      localStorage.setItem('he_course_history', JSON.stringify(newHistory));
                    }} className="pc-btn2" style={{
                      background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.18)',
                      color:'#f87171', borderRadius:9, padding:'6px 9px', fontSize:11, fontWeight:800,
                    }}>✕</button>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {cr.entries.map((entry: CourseEntry, j: number) => {
                    const cls = subClass(entry.substanceId);
                    const color = classColor(cls);
                    return (
                      <div key={j} style={{
                        display:'flex', alignItems:'center', gap:7, padding:'6px 8px',
                        background:'rgba(0,0,0,0.22)', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)', borderLeft:`2px solid ${color}`,
                      }}>
                        <span style={{ fontSize:11 }}>{CLASS_ICONS[cls] || '💊'}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:'#fff', flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{subName(entry.substanceId)}</span>
                        <span style={{ fontSize:11, color:'#a78bfa', fontWeight:800 }}>{entry.doseValue}{entry.doseUnit}</span>
                        <span style={{ fontSize:10, color:'#fff' }}>{freqDisplay(entry)}</span>
                        <span style={{ fontSize:9, color:'#fff', whiteSpace:'nowrap' }}>{entry.startWeek || 0}–{entry.endWeek} нед</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showPicker && (
        <div style={{
          position:'fixed', inset:0, zIndex:200,
          background:'rgba(0,0,0,0.72)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
          display:'flex', flexDirection:'column', justifyContent:'center',
          alignItems:'center', padding:'12px',
        }} onClick={() => setShowPicker(false)}>
          <div style={{
            width:'100%', maxWidth:440,
            maxHeight:'90vh',
            background:'linear-gradient(180deg, #111113, #0a0a0f)',
            border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:20,
            overflow:'hidden',
            display:'flex', flexDirection:'column',
            boxShadow:'0 24px 64px rgba(0,0,0,0.6)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding:'14px 16px 12px',
              borderBottom:'1px solid rgba(255,255,255,0.06)',
              display:'flex', justifyContent:'space-between', alignItems:'center',
              background:'linear-gradient(90deg, rgba(139,92,246,0.10), transparent)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <span style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.18)', fontSize:13 }}>💊</span>
                <span style={{ fontWeight:800, fontSize:14, color:'#fff' }}>Добавить препарат</span>
                <span style={{ fontSize:10, color:'#fff', border:'1px solid rgba(255,255,255,0.08)', padding:'2px 7px', borderRadius:20, background:'rgba(255,255,255,0.04)' }}>{subsForClass.length} в классе</span>
              </div>
              <button onClick={() => setShowPicker(false)} className="pc-btn2" style={{
                background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)',
                color:'#fff', borderRadius:10, padding:'6px 10px',
                fontSize:12, fontWeight:700,
              }}>
                ✕
              </button>
            </div>

            <div style={{
              padding:'8px 10px 6px',
              display:'flex', gap:5, flexWrap:'wrap',
              borderBottom:'1px solid rgba(255,255,255,0.06)',
              maxHeight:120, overflowY:'auto',
              background:'rgba(0,0,0,0.14)',
            }}>
              {Object.entries(CLASS_LABELS).map(([cls, label]) => {
                const hasSubs = SUBSTANCES_BY_CLASS[cls]?.length > 0;
                if (!hasSubs) return null;
                const isActive = pickerClass === cls;
                const color = CLASS_COLORS[cls] || '#8b5cf6';
                return (
                  <button key={cls} onClick={() => setPickerClass(cls)} className="pc-btn2" style={{
                    background: isActive ? `${color}22` : 'rgba(255,255,255,0.04)',
                    border:`1px solid ${isActive ? color+'55' : 'rgba(255,255,255,0.07)'}`,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.62)',
                    borderRadius:20, padding:'6px 11px', fontSize:11,
                    fontWeight: isActive ? 800 : 600,
                    whiteSpace:'nowrap', boxShadow: isActive ? `0 4px 12px ${color}22` : 'none',
                  }}>
                    {label}
                    <span style={{ marginLeft:5, fontSize:9, opacity:0.6, background:isActive? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)', padding:'1px 5px', borderRadius:10 }}>{SUBSTANCES_BY_CLASS[cls]?.length || 0}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'10px 10px 12px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:12 }}>
                {subsForClass.map(sub => {
                  const color = CLASS_COLORS[sub.class] || '#8b5cf6';
                  const defDose = sub.dosageRange?.min ? Math.round((sub.dosageRange.min + sub.dosageRange.max) / 2) : 250;
                  const customDose = (dose && parseFloat(dose) > 0) ? parseFloat(dose) : null;
                  const hl = sub.pk?.halfLifeHours;
                  return (
                    <div key={sub.id} onClick={() => {
                      const doseVal = (dose && parseFloat(dose) > 0) ? parseFloat(dose) : defDose;
                      addEntry(sub.id, doseVal);
                    }} className="pc-sub-btn2" style={{
                      background:'rgba(255,255,255,0.04)',
                      border:`1px solid ${customDose ? color+'55' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius:14, padding:'11px 9px',
                      cursor:'pointer', textAlign:'center',
                      position:'relative', overflow:'hidden',
                    }}>
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background: color, opacity: customDose ? 1 : 0.85 }} />
                      <div style={{ fontWeight:800, fontSize:11, color:'#fff', marginBottom:3, lineHeight:1.3 }}>{sub.name}</div>
                      <div style={{ fontSize:9, color:'#fff', marginBottom:6, lineHeight:1.3 }}>
                        {hl ? (hl >= 168 ? `T½ ${(hl / 168).toFixed(1)} нед` : `T½ ${(hl / 24).toFixed(1)} дн`) : ''}
                        {sub.dosageRange ? ` · ${sub.dosageRange.min}–${sub.dosageRange.max} ${sub.dosageRange.unit}` : ''}
                      </div>
                      <div style={{
                        display:'inline-flex', alignItems:'center', gap:3,
                        background: customDose ? `${color}2a` : 'rgba(255,255,255,0.06)', color: customDose ? '#fff' : 'rgba(255,255,255,0.72)', border:`1px solid ${customDose ? color+'40' : 'rgba(255,255,255,0.06)'}`, borderRadius:20,
                        padding:'4px 10px', fontSize:10, fontWeight:800,
                      }}>
                        + {customDose ?? defDose} {unit}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{
                background:'rgba(139,92,246,0.07)', borderRadius:14, padding:'11px 12px',
                border:'1px solid rgba(139,92,246,0.14)',
              }}>
                <div style={{ fontSize:10, color:'#fff', marginBottom:8, lineHeight:1.4, fontWeight:700 }}>
                  ⚙️ Настрой дозировку и недели, затем тапни на препарат выше
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div style={{ display:'flex', gap:6 }}>
                    <input type="number" value={dose || ''} onChange={e => setDose(e.target.value)} placeholder="250"
                      className="pc-input2" style={{
                        flex:2, padding:'8px 9px', background:'rgba(0,0,0,0.32)',
                        border:'1px solid rgba(255,255,255,0.08)', borderRadius:10,
                        color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', minWidth:0,
                      }} />
                    <select value={unit} onChange={e => setUnit(e.target.value)}
                      style={{
                        flex:1, padding:'8px 6px', background:'rgba(0,0,0,0.32)',
                        border:'1px solid rgba(255,255,255,0.08)', borderRadius:10,
                        color:'#fff', fontSize:10, fontWeight:700, boxSizing:'border-box', minWidth:56,
                      }}>
                      {UNIT_OPTIONS.map(u => <option key={u} value={u} style={{ background:'#1a1a1f' }}>{u}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:3, flexWrap:'wrap' }}>
                    <span style={{ fontSize:9, color:'#fff', fontWeight:700, whiteSpace:'nowrap' }}>Дни:</span>
                    {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((day, idx) => (
                      <button key={idx} onClick={() => {
                        setSelectedDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx].sort());
                      }} style={{
                        width:28, height:28, borderRadius:9, fontSize:9, fontWeight:800,
                        cursor:'pointer', border:`1px solid ${selectedDays.includes(idx) ? '#8b5cf6' : 'rgba(255,255,255,0.08)'}`,
                        background: selectedDays.includes(idx) ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                        color: selectedDays.includes(idx) ? '#fff' : 'rgba(255,255,255,0.52)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>{day}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(0,0,0,0.18)', padding:'6px 8px', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize:10, color:'#fff', fontWeight:700, whiteSpace:'nowrap' }}>с нед</span>
                    <input type="number" value={startWeek} onChange={e => setStartWeek(parseFloat(e.target.value) || 0 || 0)} min={0} placeholder="0"
                      className="pc-input2" style={{
                        flex:1, padding:'7px 8px', background:'rgba(255,255,255,0.06)',
                        border:'1px solid rgba(255,255,255,0.08)', borderRadius:9,
                        color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', minWidth:0, width:'100%',
                      }} />
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(0,0,0,0.18)', padding:'6px 8px', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize:10, color:'#fff', fontWeight:700, whiteSpace:'nowrap' }}>по нед</span>
                    <input type="number" value={endWeek} onChange={e => setEndWeek(parseFloat(e.target.value) || 0 || 12)} min={1} placeholder="12"
                      className="pc-input2" style={{
                        flex:1, padding:'7px 8px', background:'rgba(255,255,255,0.06)',
                        border:'1px solid rgba(255,255,255,0.08)', borderRadius:9,
                        color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', minWidth:0, width:'100%',
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
