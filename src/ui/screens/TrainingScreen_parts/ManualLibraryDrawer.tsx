import React, { useMemo, useState } from 'react';
import { getAllPrograms } from '../../../engines/complete-program-library.engine';
import type { FullProgram } from '../../../engines/complete-program-library.engine';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './programs-data';
import { useOriginalPrograms } from './useOriginalPrograms';
import { GROUP_RU } from './program-types';
import { DAY_TEMPLATES } from './ProgramEditorComponents';

type TabKey = 'bb' | 'pl' | 'templates' | 'fav';

const TAB_LABELS: Record<TabKey, { label: string; icon: string }> = {
  bb: { label: 'ББ Библиотека', icon: '💪' },
  pl: { label: 'ПЛ Циклы', icon: '🏋️' },
  templates: { label: 'Шаблоны дней', icon: '🗂' },
  fav: { label: '⭐ Избранное', icon: '⭐' },
};

export const ManualLibraryDrawer: React.FC<{
  onSelectBB: (p: FullProgram) => void;
  onSelectPL: (cycleId: string) => void;
  onAddTemplate: (tmplIdx: number) => void;
  favIds?: string[];
}> = ({ onSelectBB, onSelectPL, onAddTemplate, favIds = [] }) => {
  const [tab, setTab] = useState<TabKey>('bb');
  const [search, setSearch] = useState('');
  const originalPrograms = useOriginalPrograms();

  const allBB = useMemo(() => {
    const list = [...getAllPrograms(), ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS, ...originalPrograms];
    const seen = new Set<string>();
    return list.filter(p => p && p.id && !seen.has(p.id) && seen.add(p.id));
  }, [originalPrograms]);

  const filteredBB = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return allBB;
    return allBB.filter(p => `${p.name} ${p.author} ${p.goal} ${p.type}`.toLowerCase().includes(s));
  }, [allBB, search]);

  const filteredPL = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return LMS_CYCLES;
    return LMS_CYCLES.filter(c => `${c.meta.title} ${c.meta.id} ${c.meta.period}`.toLowerCase().includes(s));
  }, [search]);

  const templates = DAY_TEMPLATES;

  const favList = useMemo(() => {
    const s = search.trim().toLowerCase();
    const favSet = new Set(favIds);
    const bbFav = allBB.filter(p => favSet.has(p.id) && (!s || `${p.name} ${p.goal}`.toLowerCase().includes(s)));
    const plFav = LMS_CYCLES.filter(c => favSet.has(c.meta.id) && (!s || c.meta.title.toLowerCase().includes(s)));
    return { bbFav, plFav };
  }, [allBB, favIds, search]);

  return (
    <div className="train-manlibdrawer" style={{ display:'flex', flexDirection:'column', gap: 10 }}>
      {/* Tabs */}
      <div style={{ display:'flex', gap: 4, overflowX:'auto', paddingBottom: 4, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        {(Object.keys(TAB_LABELS) as TabKey[]).map(k => {
          const active = tab===k;
          return (
            <button key={k} onClick={()=> setTab(k)} style={{ flex:'0 0 auto', padding:'6px 12px', borderRadius: 999, fontSize:11, fontWeight:700, cursor:'pointer', background: active?'rgba(0,230,138,0.14)':'rgba(255,255,255,0.04)', border: active?'1px solid rgba(0,230,138,0.35)':'1px solid rgba(255,255,255,0.06)', color: active?'#00e68a':'rgba(255,255,255,0.65)' }}>
              {TAB_LABELS[k].icon} {TAB_LABELS[k].label}
            </button>
          );
        })}
      </div>
      <input value={search} onChange={e=> setSearch(e.target.value)} placeholder="🔍 Поиск: название, автор, цель..." style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(0,0,0,0.25)', color:'#fff', fontSize:11 }} />
      <div style={{ maxHeight:'50vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:6, paddingRight:4 }}>
        {tab==='bb' && (
          <>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>Найдено {filteredBB.length} из {allBB.length} программ</div>
            {filteredBB.slice(0,50).map(p=> (
              <button key={p.id} onClick={()=> onSelectBB(p)} style={{ textAlign:'left', padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer' }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#00e68a' }}>{p.name} <span style={{ fontWeight:400, color:'rgba(255,255,255,0.55)' }}>· {p.durationWeeks}н · {p.daysPerWeek}д · {p.level}</span></div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginTop:2 }}>{p.type} · 🎯 {p.goal} · {p.author}</div>
              </button>
            ))}
            {filteredBB.length===0 && <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', textAlign:'center', padding:12 }}>Ничего не найдено</div>}
          </>
        )}
        {tab==='pl' && (
          <>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>Найдено {filteredPL.length} циклов</div>
            {filteredPL.map(c=> (
              <button key={c.meta.id} onClick={()=> onSelectPL(c.meta.id)} style={{ textAlign:'left', padding:'8px 10px', borderRadius:8, background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.15)', color:'#fff', cursor:'pointer' }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#a78bfa' }}>{c.meta.title} <span style={{ fontWeight:400, color:'rgba(255,255,255,0.55)' }}>· {c.meta.weeks}н · {c.meta.sessionsPerWeek}×</span></div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)' }}>{c.meta.period} · {c.meta.level} · {c.meta.direction}</div>
              </button>
            ))}
          </>
        )}
        {tab==='templates' && (
          <>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)' }}>10 шаблонов — 1 клик добавит день с упражнениями</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:6 }}>
              {templates.map((t,idx)=> (
                <button key={t.label} onClick={()=> onAddTemplate(idx)} style={{ padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer', textAlign:'left', display:'flex', flexDirection:'column', gap:2 }}>
                  <span style={{ fontSize:14 }}>{t.icon}</span>
                  <span style={{ fontSize:11, fontWeight:700 }}>{t.label}</span>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>{t.focus}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {tab==='fav' && (
          <>
            {(favList.bbFav.length===0 && favList.plFav.length===0) ? (
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', textAlign:'center', padding:12 }}>Нет избранного — нажмите ⭐ в списках программ/циклов</div>
            ) : (
              <>
                {favList.bbFav.map(p=> (
                  <button key={p.id} onClick={()=> onSelectBB(p)} style={{ textAlign:'left', padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', color:'#fff', cursor:'pointer' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b' }}>⭐ {p.name}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)' }}>{p.durationWeeks}н · {p.daysPerWeek}д · {p.level}</div>
                  </button>
                ))}
                {favList.plFav.map(c=> (
                  <button key={c.meta.id} onClick={()=> onSelectPL(c.meta.id)} style={{ textAlign:'left', padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', color:'#fff', cursor:'pointer' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b' }}>⭐ {c.meta.title}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)' }}>{c.meta.weeks}н · {c.meta.sessionsPerWeek}×</div>
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
export default ManualLibraryDrawer;
