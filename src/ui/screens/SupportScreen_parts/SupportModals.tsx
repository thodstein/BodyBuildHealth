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
  calcSupport: (level?: any) => void;
  catalogSupport: any[];
  allSupport: any[];
  catalogSubstances: any[];
  BOOST_SUBS: string[];
  getStackDisplayName: (stack: any) => string;
  savedStacks: any[];
  MECH_TRANSLATIONS_RU: Record<string, string>;
  SUPPORT_LEVELS: Record<string, { label: string; desc: string; subs: string[]; dosages: Record<string, { mg: number; timing: string }> }>;
  // Week select
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
  calcSupport,
  catalogSupport,
  allSupport,
  catalogSubstances,
  BOOST_SUBS,
  getStackDisplayName,
  savedStacks,
  MECH_TRANSLATIONS_RU,
  SUPPORT_LEVELS,
  courseWeekState, setCourseWeekState, maxCourseWeek, onWeekChange,
}) => {
  return (<div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
    <div style={{ background:'var(--bg-primary)', borderRadius:16, maxWidth:400, width:'100%', maxHeight:'85vh', overflowY:'auto', padding:16 }}>
      {showModal === 'intel' && !modalLevel && (
        <>
          <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800 }}>Выберите уровень поддержки</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {[
              { v:'basic', l:'База', c:'#22c55e', d:() => (SUPPORT_LEVELS.basic?.subs?.length || 0) + ' препаратов, обязательный минимум' },
              { v:'mid', l:'Средний', c:'#eab308', d:() => (SUPPORT_LEVELS.mid?.subs?.length || 0) + ' препарата, расширенная защита' },
              { v:'max', l:'Максимум', c:'#f97316', d:() => (SUPPORT_LEVELS.max?.subs?.length || 0) + ' препаратов, полное покрытие' },
              { v:'boost', l:'Усиление', c:'#ef4444', d:() => (SUPPORT_LEVELS.boost?.subs?.length || 0) + ' препаратов, максимальная поддержка' },
            ].map(btn => (
              <button key={btn.v} onClick={() => setModalLevel(btn.v)} style={{
                padding:'12px 14px', borderRadius:10, cursor:'pointer', textAlign:'left',
                background: btn.c + '12', border: '1px solid ' + btn.c + '33',
                color:'var(--text-light)', fontWeight:700, fontSize:12,
              }}>
                <span style={{ color:btn.c, fontWeight:800 }}>{btn.l}</span>
                <span style={{ color:'var(--text-dim)', fontWeight:400, marginLeft:6 }}>— {btn.d()}</span>
              </button>
            ))}
          </div>
          <button onClick={() => { setShowModal(null); setModalLevel(null); }} style={{ width:'100%', marginTop:10, padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-dim)', cursor:'pointer', fontSize:10 }}>Отмена</button>
        </>
      )}
      {showModal === 'intel' && modalLevel && (
        <>
          <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800 }}>Рекомендуемые препараты</h3>
          <p style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8 }}>Уровень: <b style={{ color:'#00e68a' }}>{modalLevel}</b> — <b style={{ color:'var(--text-light)' }}>{(SUPPORT_LEVELS[modalLevel]?.subs || []).length}</b> препаратов</p>
          <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:'50vh', overflowY:'auto', marginBottom:8 }}>
            {(SUPPORT_LEVELS[modalLevel]?.subs || []).map((id: string) => {
              const sub = allSupport.find((s: any) => s.id === id);
              if (!sub) return null;
              return (
                <div key={id} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', fontSize:10 }}>
                  <div style={{ fontWeight:600, color:'var(--text-light)' }}>{sub.name}</div>
                  {sub.description && <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>{cleanDesc(sub)}</div>}
                  {sub.mechanisms && sub.mechanisms.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                      {sub.mechanisms.slice(0,3).map((m: string, mi: number) => (
                        <span key={mi} style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:'rgba(139,92,246,0.08)', color:'#a78bfa' }}>{(MECH_TRANSLATIONS_RU)[m] || m.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={() => { setSupportLevel(modalLevel); if (setManualLevelSelected) setManualLevelSelected(true); calcSupport(modalLevel); setShowModal(null); setModalLevel(null); }} style={{
            width:'100%', padding:'10px', borderRadius:8, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:12, marginBottom:6,
          }}>Применить уровень</button>
          <button onClick={() => setModalLevel(null)} style={{ width:'100%', padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-dim)', cursor:'pointer', fontSize:10 }}>Назад</button>
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
          <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:800, color:'#ef4444' }}>Усиление стека</h3>
          <p style={{ fontSize:9, color:'var(--text-dim)', marginBottom:8 }}>Бустер-препараты для максимального покрытия рисков. +20 веществ к текущему стеку.</p>
          <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:'40vh', overflowY:'auto', marginBottom:8 }}>
            {(BOOST_SUBS || []).map((id: string) => {
              const sub = allSupport.find((s: any) => s.id === id);
              if (!sub) return null;
              return (
                <div key={id} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:10 }}>
                  <div style={{ fontWeight:600, color:'var(--text-light)' }}>{sub.name}</div>
                  {sub.description && <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{sub.description}</div>}
                </div>
              );
            })}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
            <button style={{ flex:1, padding:'6px', borderRadius:6, border:'1px dashed var(--accent)', cursor:'pointer', background:'transparent', color:'var(--accent)', fontSize:9, fontWeight:600, minWidth:0 }} onClick={() => { setShowModal('manual'); setModalAddMode(false); }}>Заменить на аналог</button>
            <button style={{ flex:1, padding:'6px', borderRadius:6, border:'1px dashed var(--accent)', cursor:'pointer', background:'transparent', color:'var(--accent)', fontSize:9, fontWeight:600, minWidth:0 }} onClick={() => setShowSavedPicker(true)}>Из сохранённых</button>
            <button style={{ flex:1, padding:'6px', borderRadius:6, border:'1px dashed var(--accent)', cursor:'pointer', background:'transparent', color:'var(--accent)', fontSize:9, fontWeight:600, minWidth:0 }} onClick={() => { setShowModal('manual'); setModalAddMode(false); }}>Из каталога</button>
          </div>
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
