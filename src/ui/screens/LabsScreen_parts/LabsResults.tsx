import React, { useState, useMemo } from 'react';
import type { LabPoint } from '../../../core/types';
import { UCUM_MAP } from '../../../core/constants';
import { LABS_ACCENT, LABS_CARD, LABS_CARD_FLAT, LABS_SYS_COLOR, LABS_SYS_LABEL, LABS_SYS_ICON, LabsBadge, LabsEmpty, sysPillStyle, labsWithAlpha } from './LabsUI';
import { NativeIcon, type NativeIconName } from '../../native/NativeIcons';

const LAB_SYSTEM_MAP: Record<string, string> = {
  'ALT': 'hepatic', 'AST': 'hepatic', 'GGT': 'hepatic', 'ALP': 'hepatic',
  'BILIRUBIN_TOTAL': 'hepatic', 'BIL_T': 'hepatic', 'BIL': 'hepatic', 'ALB': 'hepatic',
  'CREATININE': 'renal', 'BUN': 'renal', 'EGFR': 'renal', 'PROTEIN_TOTAL': 'renal', 'UA': 'renal',
  'TSH': 'endocrine', 'FT3': 'endocrine', 'FT4': 'endocrine',
  'TESTOSTERONE': 'endocrine', 'TT': 'endocrine', 'E2': 'endocrine', 'ESTRADIOL': 'endocrine',
  'PRL': 'endocrine', 'PROLACTIN': 'endocrine', 'CORTISOL': 'endocrine',
  'INSULIN': 'metabolic', 'INS': 'metabolic', 'HOMA': 'metabolic',
  'LH': 'endocrine', 'FSH': 'endocrine', 'SHBG': 'endocrine', 'IGF1': 'endocrine',
  'HGB': 'hematologic', 'HCT': 'hematologic', 'PLT': 'hematologic', 'WBC': 'hematologic',
  'LDL': 'cardio', 'HDL': 'cardio', 'TG': 'cardio', 'GLU': 'metabolic', 'GLUCOSE': 'metabolic',
  'HBA1C': 'metabolic', 'HOMOCYSTEINE': 'neuro', 'FERRITIN': 'hematologic',
  'CRP': 'cardio', 'VITD': 'metabolic', 'CALCIDIOL': 'metabolic',
};

const sysLabels: Record<string, string> = LABS_SYS_LABEL;
const sysColors: Record<string, string> = LABS_SYS_COLOR;
const sysIcons: Record<string, NativeIconName> = LABS_SYS_ICON;

function getLabStatus(lab: LabPoint): 'normal' | 'high' | 'low' | 'unknown' {
  if (lab.refLow !== undefined && lab.refHigh !== undefined) {
    if (lab.value > lab.refHigh) return 'high';
    if (lab.value < lab.refLow) return 'low';
    return 'normal';
  }
  const info = UCUM_MAP[lab.code] || UCUM_MAP[lab.code.toUpperCase()];
  if (!info) return 'unknown';
  if (lab.value > info.uln) return 'high';
  if (lab.value < info.lln) return 'low';
  return 'normal';
}

export const LabsResults: React.FC<{ labs: LabPoint[] }> = ({ labs }) => {
  const [filterSystem, setFilterSystem] = useState<string>('all');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set([labs[0]?.date].filter(Boolean) as string[]));

  const sortedLabs = useMemo(() => [...labs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [labs]);
  const uniqueDates = useMemo(() => [...new Set(sortedLabs.map(l => l.date))].sort().reverse(), [sortedLabs]);
  const systems = useMemo(() => [...new Set(labs.map(l => LAB_SYSTEM_MAP[l.code.toUpperCase()] || ''))].filter(Boolean).sort(), [labs]);
  const filteredLabs = filterSystem === 'all' ? sortedLabs : sortedLabs.filter(l => (LAB_SYSTEM_MAP[l.code.toUpperCase()] || '') === filterSystem);
  const groupedByDate = uniqueDates.reduce<Record<string, LabPoint[]>>((acc, date) => { const dl = filteredLabs.filter(l=>l.date===date); if(dl.length) acc[date]=dl; return acc; }, {});

  const toggleDate = (date: string) => setExpandedDates(prev=>{ const n=new Set(prev); if(n.has(date)) n.delete(date); else n.add(date); return n; });

  // summary for filter bar
  const abnormalCount = useMemo(()=> filteredLabs.filter(l=> { const s=getLabStatus(l); return s==='high'||s==='low'; }).length, [filteredLabs]);

  return (
    <div className="labs-results">
      {/* Filters — TOP APK pills 44px, скролл-лента */}
      <div className="labs-filter-row" style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center', overflowX:'auto', padding:'2px 2px 6px', scrollbarWidth:'none' }}>
        <button onClick={()=>setFilterSystem('all')} style={filterSystem==='all' ? sysPillStyle(true, LABS_ACCENT) : { padding:'10px 14px', borderRadius:999, border:'1px solid rgba(140,190,255,0.14)', background:'rgba(21,38,66,0.60)', color:'#fff', fontSize:11, fontWeight:800, cursor:'pointer', minHeight:44, whiteSpace:'nowrap', flexShrink:0 }}>
          Все системы
        </button>
        {systems.map(sys=>(
          <button key={sys} onClick={()=>setFilterSystem(sys)} style={filterSystem===sys? sysPillStyle(true, sysColors[sys]||'#6b7280') : { padding:'10px 14px', borderRadius:999, border:'1px solid rgba(140,190,255,0.14)', background:'rgba(21,38,66,0.60)', color:'#fff', fontSize:11, fontWeight:800, cursor:'pointer', minHeight:44, whiteSpace:'nowrap', flexShrink:0 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><NativeIcon name={sysIcons[sys] || 'file'} size={12} /> {sysLabels[sys]||sys}</span>
          </button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:11, color:'#fff', display:'flex', alignItems:'center', gap:6, flexShrink:0, paddingLeft:8 }}>
          {filteredLabs.length} маркеров {abnormalCount>0 && <LabsBadge color="#ef4444" small>{abnormalCount} вне</LabsBadge>}
        </span>
      </div>

      {labs.length===0 ? (
        <LabsEmpty icon={<NativeIcon name="flask" size={26} />} title="Нет данных анализов" desc="Введите маркеры во вкладке «Текущие» — выберите фазу, заполните пакет или используйте импорт PDF/фото. Данные группируются по датам и системам." />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {Object.entries(groupedByDate).map(([date, dateLabs])=>{
            const isOpen = expandedDates.has(date);
            const dateAbn = dateLabs.filter(l=>{ const s=getLabStatus(l); return s==='high'||s==='low'; }).length;
            const dateStr = new Date(date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
            return (
              <div key={date} style={{ ...LABS_CARD, padding:0, overflow:'hidden', background:'rgba(20,22,30,0.40)', backdropFilter:'blur(10px)' }}>
                <button onClick={()=>toggleDate(date)} style={{
                  display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 12px', cursor:'pointer', textAlign:'left', minHeight:52,
                  background: isOpen? 'rgba(255,255,255,0.02)' : 'transparent', border:'none', color:'#fff', borderBottom: isOpen? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <span style={{ width:28, height:28, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background: isOpen? 'rgba(var(--labs-accent-rgb, 0,230,138),0.14)' : 'rgba(255,255,255,0.06)', border:`1px solid ${isOpen?'rgba(var(--labs-accent-rgb, 0,230,138),0.18)':'rgba(255,255,255,0.08)'}`, color: isOpen ? LABS_ACCENT : '#fff', transition:'transform 0.2s', transform: isOpen? 'rotate(90deg)' : 'rotate(0deg)', flexShrink:0 }}><NativeIcon name="chevronRight" size={12} /></span>
                  <span style={{ display:'inline-flex', color:'#fff' }}><NativeIcon name="clock" size={13} /></span>
                  <span style={{ fontSize:14, fontWeight:800, color: isOpen? LABS_ACCENT : '#fff' }}>{dateStr}</span>
                  <span style={{ fontSize:10, color:'#fff', marginLeft:6, display:'none' }}>{date}</span>
                  <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:999, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff' }}>{dateLabs.length}</span>
                    {dateAbn>0 ? <LabsBadge color="#ef4444" small>⚠ {dateAbn}</LabsBadge> : <LabsBadge color={LABS_ACCENT} small>✓</LabsBadge>}
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding:'10px 10px 10px', display:'grid', gap:6, background:'rgba(0,0,0,0.08)' }}>
                    {dateLabs.map(lab=>{
                      const status=getLabStatus(lab);
                      const info=UCUM_MAP[lab.code.toUpperCase()];
                      const sys=LAB_SYSTEM_MAP[lab.code.toUpperCase()]||'other';
                      const sysColor=sysColors[sys]||'#6b7280';
                      const isAbn=status==='high'||status==='low';
                      const statusColor=status==='high'? '#ef4444' : status==='low'? '#f97316' : status==='unknown'? '#6b7280' : LABS_ACCENT;
                      const statusText=status==='high'? 'выше' : status==='low'? 'ниже' : status==='unknown'? '—' : 'норма';
                      return (
                        <div key={lab.code+lab.date} style={{
                          display:'flex', alignItems:'center', gap:10, padding:'12px 12px', borderRadius:14,
                          background: isAbn? labsWithAlpha(statusColor, '12') : 'rgba(255,255,255,0.03)', border:`1px solid ${isAbn? labsWithAlpha(statusColor, '22') : 'rgba(140,190,255,0.12)'}`,
                          borderLeft:`3px solid ${statusColor}`, minHeight:64,
                        }}>
                          <div style={{ width:36, height:36, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: sysColor+'1A', color: sysColor, fontWeight:800, fontSize:11, border:`1px solid ${sysColor}30` }}>{lab.code.slice(0,2).toUpperCase()}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:800, fontSize:13, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{lab.name || lab.code}</div>
                            <div style={{ fontSize:11, color:'#fff', marginTop:2, display:'flex', gap:6, alignItems:'center' }}>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><NativeIcon name={sysIcons[sys] || 'file'} size={11} /> {sysLabels[sys]||sys}</span>
                              {info && <span style={{ padding:'2px 7px', borderRadius:999, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)' }}>{info.lln}–{info.uln} {info.prefUnit||''}</span>}
                            </div>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0, minWidth:92 }}>
                            <div style={{ fontWeight:900, fontSize:16, color: statusColor, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{lab.value}<span style={{ fontSize:10, color:'#fff', marginLeft:3, fontWeight:700 }}>{lab.unit||''}</span></div>
                            <div style={{ marginTop:4, fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:999, background: labsWithAlpha(statusColor, '1E'), border:`1px solid ${labsWithAlpha(statusColor, '30')}`, color: statusColor, display:'inline-flex', gap:3 }}>{isAbn? (status==='high'?'↗':'↘') : '✓'} {statusText}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {Object.keys(groupedByDate).length===0 && (
            <LabsEmpty icon={<NativeIcon name="search" size={26} />} title="Нет маркеров для фильтра" desc="Смените систему фильтра или сбросьте на «Все системы»." />
          )}
        </div>
      )}
    </div>
  );
};
