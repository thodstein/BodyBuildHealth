import React from 'react';
import { decodeGarbled, cleanDesc } from '../../../utils/text-sanitizer';

export interface SupportModalsProps {
  showModal: string | null;
  setShowModal: (v: string | null) => void;
  modalLevel: string | null;
  setModalLevel: (v: string | null) => void;
  modalSearch: string;
  setModalSearch: (v: string) => void;
  modalSelected: string[];
  setModalSelected: (v: string[] | ((prev: string[]) => string[])) => void;
  modalAddMode: boolean;
  setModalAddMode: (v: boolean) => void;
  showSavedPicker: boolean;
  setShowSavedPicker: (v: boolean) => void;
  setEnhancedSubs: (v: string[] | ((prev: string[]) => string[])) => void;
  setBoostEnabled: (v: boolean) => void;
  setSupportLevel: (v: any) => void;
  setManualLevelSelected?: (v: boolean) => void;
  setJointMode?: (v: boolean) => void;
  jointMode?: boolean;
  boostEnabled?: boolean;
  calcSupport: (level?: any) => void;
  catalogSupport: any[];
  allSupport: any[];
  catalogSubstances: any[];
  getStackDisplayName: (stack: any) => string;
  savedStacks: any[];
  MECH_TRANSLATIONS_RU: Record<string, string>;
  SUPPORT_LEVELS: Record<string, { label: string; desc: string; subs: string[]; dosages: Record<string, { mg: number; timing: string }> }>;
  courseWeekState?: number;
  setCourseWeekState?: (v: number) => void;
  maxCourseWeek?: number;
  onWeekChange?: (newWeek: number) => void;
}

export const SupportModals: React.FC<SupportModalsProps> = ({
  showModal, setShowModal,
  modalLevel, setModalLevel,
  modalSearch, setModalSearch,
  modalSelected, setModalSelected,
  modalAddMode, setModalAddMode,
  showSavedPicker, setShowSavedPicker,
  setEnhancedSubs,
  setBoostEnabled,
  setSupportLevel,
  setManualLevelSelected,
  setJointMode,
  jointMode,
  boostEnabled,
  calcSupport,
  catalogSupport,
  allSupport,
  catalogSubstances,
  getStackDisplayName,
  savedStacks,
  MECH_TRANSLATIONS_RU,
  SUPPORT_LEVELS,
  courseWeekState, setCourseWeekState, maxCourseWeek, onWeekChange,
}) => {
  const [modalWantJoint, setModalWantJoint] = React.useState(false);
  const [modalWantBoost, setModalWantBoost] = React.useState(false);
  const [modalSubScreen, setModalSubScreen] = React.useState<'result' | 'joint' | 'boost'>('result');

  const handleApply = () => {
    if (setJointMode && modalWantJoint !== jointMode) setJointMode(modalWantJoint);
    if (modalWantBoost !== boostEnabled) setBoostEnabled(modalWantBoost);
    setSupportLevel(modalLevel);
    if (setManualLevelSelected) setManualLevelSelected(true);
    calcSupport(modalLevel);
    setShowModal(null);
    setModalLevel(null);
    setModalSubScreen('result');
    setModalWantJoint(false);
    setModalWantBoost(false);
  };

  return (<div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
    <div style={{ background:'var(--bg-primary)', borderRadius:16, maxWidth:400, width:'100%', maxHeight:'85vh', overflowY:'auto', padding:16 }}>
      {showModal === 'intel' && !modalLevel && (
        <>
          <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800 }}>Выберите уровень поддержки</h3>
          <p style={{ fontSize:8, color:'var(--text-dim)', marginBottom:8 }}>После выбора уровня можно добавить усиление и суставы</p>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {[
              { v:'basic', l:'🟢 База', c:'#22c55e', d:'Нет высокого риска (≤50%)' },
              { v:'mid', l:'🟡 Средний', c:'#eab308', d:'Нет выраженного риска (≤35%)' },
              { v:'max', l:'🟠 Максимум', c:'#f97316', d:'Нижний умеренный (≤25%)' },
              { v:'boost', l:'🔴 Буст', c:'#ef4444', d:'Слабый риск (≤15%)' },
            ].map(btn => (
              <button key={btn.v} onClick={() => setModalLevel(btn.v)} style={{
                padding:'12px 14px', borderRadius:10, cursor:'pointer', textAlign:'left',
                background: btn.c + '12', border: '1px solid ' + btn.c + '33',
                color:'var(--text-light)', fontWeight:700, fontSize:12,
              }}>
                <span style={{ color:btn.c, fontWeight:800 }}>{btn.l}</span>
                <span style={{ color:'var(--text-dim)', fontWeight:400, marginLeft:6 }}>— {btn.d}</span>
              </button>
            ))}
          </div>
          <button onClick={() => { setShowModal(null); setModalLevel(null); }} style={{ width:'100%', marginTop:10, padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-dim)', cursor:'pointer', fontSize:10 }}>Отмена</button>
        </>
      )}
      {showModal === 'intel' && modalLevel && modalSubScreen === 'result' && (
        <>
          <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800 }}>Уровень: {modalLevel}</h3>
          <p style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8 }}>Препараты подбираются динамически по вашим рискам, анализам, синергиям и конфликтам. Нажмите «Применить» для расчёта.</p>
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <button onClick={() => setModalSubScreen('joint')} style={{
              flex:1, padding:'8px', borderRadius:8, fontSize:9, fontWeight:700, cursor:'pointer',
              border: modalWantJoint ? '2px solid #8b5cf6' : '1px solid var(--border)',
              background: modalWantJoint ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
              color: modalWantJoint ? '#c4b5fd' : 'var(--text-dim)',
            }}>
              🦴 {modalWantJoint ? '✅ Суставы (в плане)' : '➕ Суставы'}
            </button>
            <button onClick={() => setModalSubScreen('boost')} style={{
              flex:1, padding:'8px', borderRadius:8, fontSize:9, fontWeight:700, cursor:'pointer',
              border: modalWantBoost ? '2px solid #ef4444' : '1px solid var(--border)',
              background: modalWantBoost ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
              color: modalWantBoost ? '#fca5a5' : 'var(--text-dim)',
            }}>
              🔥 {modalWantBoost ? '✅ Усиление (в плане)' : '➕ Усиление'}
            </button>
          </div>

          <button onClick={handleApply} style={{
            width:'100%', padding:'10px', borderRadius:8, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:12, marginBottom:6,
          }          }>✅ Применить уровень{modalWantJoint ? ' + суставы' : ''}{modalWantBoost ? ' + усиление' : ''}</button>
          <button onClick={() => setModalLevel(null)} style={{ width:'100%', padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-dim)', cursor:'pointer', fontSize:10 }}>Назад</button>
        </>
      )}
      {showModal === 'intel' && modalLevel && modalSubScreen === 'joint' && (
        <>
          <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800, color:'#8b5cf6' }}>🦴 Препараты для суставов</h3>
          <p style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8 }}>Подбираются по механизмам опорно-двигательной системы и вашим данным (травмы, боли) для уровня <b>{modalLevel}</b></p>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => setModalSubScreen('result')} style={{
              flex:1, padding:'10px', borderRadius:8, border:'1px solid var(--border)', cursor:'pointer',
              background:'transparent', color:'var(--text-dim)', fontWeight:600, fontSize:11,
            }}>❌ Отклонить</button>
            <button onClick={() => { setModalWantJoint(true); setModalSubScreen('result'); }} style={{
              flex:1, padding:'10px', borderRadius:8, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#8b5cf6,#7c3aed)', color:'#fff', fontWeight:700, fontSize:11,
            }}>✅ Принять и добавить</button>
          </div>
        </>
      )}
      {showModal === 'intel' && modalLevel && modalSubScreen === 'boost' && (
        <>
          <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800, color:'#ef4444' }}>🔥 Усиление стека (Буст)</h3>
          <p style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8 }}>Буст-препараты подбираются динамически по механизмам и рискам — закрывают оставшиеся пробелы покрытия для уровня <b>{modalLevel}</b></p>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => setModalSubScreen('result')} style={{
              flex:1, padding:'10px', borderRadius:8, border:'1px solid var(--border)', cursor:'pointer',
              background:'transparent', color:'var(--text-dim)', fontWeight:600, fontSize:11,
            }}>❌ Отклонить</button>
            <button onClick={() => { setModalWantBoost(true); setModalSubScreen('result'); }} style={{
              flex:1, padding:'10px', borderRadius:8, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontWeight:700, fontSize:11,
            }}>✅ Принять и усилить</button>
          </div>
        </>
      )}
      {showModal === 'manual' && (
        <>
          <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800 }}>Выбор препаратов</h3>
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <input value={modalSearch} onChange={e => setModalSearch(e.target.value)} placeholder="Поиск..." style={{
              flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11, boxSizing:'border-box',
            }} />
            <button onClick={() => setShowSavedPicker(true)} style={{ padding:'8px 10px', borderRadius:8, border:'1px dashed var(--accent)', background:'transparent', color:'var(--accent)', fontSize:10, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>Из сохранённых (' + savedStacks.length + ')</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'45vh', overflowY:'auto', marginBottom:8 }}>
            {catalogSupport.filter((s: any) => !modalSearch || (s.name||'').toLowerCase().includes(modalSearch.toLowerCase()) || (s.id||'').toLowerCase().includes(modalSearch.toLowerCase())).map((s: any) => {
              const sel = modalSelected.includes(s.id);
              return (
                <div key={s.id} onClick={() => setModalSelected((prev: string[]) => sel ? prev.filter(x => x !== s.id) : [...prev, s.id])} style={{
                  padding:'8px 10px', borderRadius:8, cursor:'pointer',
                  background: sel ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.02)', border: sel ? '1px solid rgba(0,230,138,0.3)' : '1px solid transparent',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:10, minWidth:14, color: sel ? '#00e68a' : 'var(--text-dim)' }}>{sel ? 'V' : 'O'}</span>
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{s.name}</div>
                  </div>
                  {s.description && <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4, marginLeft:20, marginTop:2 }}>{decodeGarbled(s.description)}</div>}
                  {s.mechanisms && s.mechanisms.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginLeft:20, marginTop:2 }}>
                      {s.mechanisms.slice(0,3).map((m: string) => (
                        <span key={m} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.08)', color:'#a78bfa' }}>{(MECH_TRANSLATIONS_RU)[m] || m.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setShowModal(null); setModalSelected([]); }} style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-dim)', cursor:'pointer', fontSize:10 }}>Отмена</button>
            <button onClick={() => {
              if (modalSelected.length > 0) {
                if (modalAddMode) {
                  setEnhancedSubs((prev: string[]) => [...new Set([...prev, ...modalSelected])]);
                } else {
                  setEnhancedSubs(modalSelected);
                }
                setModalSelected([]);
                setShowModal(null);
                setModalAddMode(false);
              }
            }} style={{ flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'var(--accent)', color:'#000', fontWeight:700, fontSize:10 }}>{modalAddMode ? 'Добавить к плану' : 'Применить'} ({modalSelected.length})</button>
          </div>
        </>
      )}
      {showModal === 'boost' && (
        <>
          <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800, color:'#ef4444' }}>🔥 Усиление стека</h3>
          <p style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8 }}>Буст-препараты подбираются динамически по механизмам риска — закрывают пробелы покрытия. Нажмите «Усилить» для активации.</p>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setShowModal(null); }} style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-dim)', cursor:'pointer', fontSize:10 }}>Отмена</button>
            <button onClick={() => { setBoostEnabled(true); calcSupport(); setShowModal(null); }} style={{ flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#000', fontWeight:700, fontSize:10 }}>Усилить стек</button>
          </div>
        </>
      )}
      {showModal === 'weekSelect' && (
        <>
          <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800 }}>📅 Выберите неделю курса</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:'60vh', overflowY:'auto', marginBottom:8 }}>
            {Array.from({ length: maxCourseWeek || 12 }, (_, i) => i + 1).map(w => {
              const isActive = courseWeekState === w;
              const isMid = w === Math.round((maxCourseWeek || 12) / 2);
              const isEnd = w === (maxCourseWeek || 12);
              return (
                <button key={w} onClick={() => {
                  if (setCourseWeekState) setCourseWeekState(w);
                  if (onWeekChange) onWeekChange(w);
                  setShowModal(null);
                }} style={{
                  padding:'12px 14px', borderRadius:10, cursor:'pointer', textAlign:'left',
                  background: isActive ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)',
                  border: isActive ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
                  color:'var(--text-light)', fontWeight: isActive ? 800 : 600, fontSize:12,
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                  <span>Неделя {w} {isActive ? '✓' : ''}</span>
                  <span style={{ fontSize:9, color:'var(--text-dim)' }}>
                    {w === 1 ? 'Старт' : isMid ? 'Пик нагрузки' : isEnd ? 'Финиш' : ''}
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={() => { setShowModal(null); }} style={{ width:'100%', padding:'10px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-dim)', cursor:'pointer', fontSize:10 }}>Закрыть</button>
        </>
      )}
    </div>
  </div>);
};
