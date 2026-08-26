import React, { useState, useMemo } from 'react';
import type { LabPoint } from '../../../core/types';
import { UCUM_MAP } from '../../../core/constants';
import { LABS_ACCENT, LABS_CARD, LABS_CARD_FLAT, LABS_SYS_COLOR, LABS_SYS_LABEL, LABS_SYS_ICON, LabsBadge, LabsEmpty, sysPillStyle } from './LabsUI';

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
const sysIcons: Record<string, string> = LABS_SYS_ICON;

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
    <div>
      {/* Filters — premium pills */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10, alignItems:'center' }}>
        <button onClick={()=>setFilterSystem('all')} style={filterSystem==='all' ? { ...sysPillStyle(true, LABS_ACCENT), padding:'6px 12px' } : { padding:'6px 12px', borderRadius:999, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.68)', fontSize:10, fontWeight:700, cursor:'pointer' }}>
          Все системы
        </button>
        {systems.map(sys=>(
          <button key={sys} onClick={()=>setFilterSystem(sys)} style={filterSystem===sys? sysPillStyle(true, sysColors[sys]||'#6b7280') : { padding:'6px 12px', borderRadius:999, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.62)', fontSize:10, fontWeight:700, cursor:'pointer' }}>
            {sysIcons[sys]||''} {sysLabels[sys]||sys}
          </button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:9, color:'rgba(255,255,255,0.38)', display:'flex', alignItems:'center', gap:6 }}>
          {filteredLabs.length} маркеров {abnormalCount>0 && <LabsBadge color="#ef4444" small>{abnormalCount} вне</LabsBadge>}
        </span>
      </div>

      {labs.length===0 ? (
        <LabsEmpty icon="🧪" title="Нет данных анализов" desc="Введите маркеры во вкладке «Текущие» — выберите фазу, заполните пакет или используйте импорт PDF/фото. Данные группируются по датам и системам." />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {Object.entries(groupedByDate).map(([date, dateLabs])=>{
            const isOpen = expandedDates.has(date);
            const dateAbn = dateLabs.filter(l=>{ const s=getLabStatus(l); return s==='high'||s==='low'; }).length;
            const dateStr = new Date(date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
            return (
              <div key={date} style={{ ...LABS_CARD, padding:0, overflow:'hidden', background:'rgba(20,22,30,0.40)', backdropFilter:'blur(10px)' }}>
                <button onClick={()=>toggleDate(date)} style={{
                  display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 12px', cursor:'pointer', textAlign:'left',
                  background: isOpen? 'rgba(255,255,255,0.02)' : 'transparent', border:'none', color:'#fff', borderBottom: isOpen? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <span style={{ width:22, height:22, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background: isOpen? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.06)', border:`1px solid ${isOpen?'rgba(0,230,138,0.18)':'rgba(255,255,255,0.08)'}`, fontSize:10, transition:'transform 0.2s', transform: isOpen? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  <span style={{ fontSize:13 }}>📅</span>
                  <span style={{ fontSize:12, fontWeight:800, color: isOpen? LABS_ACCENT : '#fff' }}>{dateStr}</span>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.38)', marginLeft:6, display:'none' }}>{date}</span>
                  <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:999, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.72)' }}>{dateLabs.length}</span>
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
                          display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:12,
                          background: isAbn? statusColor+'10' : 'rgba(255,255,255,0.03)', border:`1px solid ${isAbn? statusColor+'1E' : 'rgba(255,255,255,0.06)'}`,
                          borderLeft:`3px solid ${statusColor}`,
                        }}>
                          <div style={{ width:30, height:30, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: sysColor+'16', color: sysColor, fontWeight:800, fontSize:10, border:`1px solid ${sysColor}22` }}>{lab.code.slice(0,2).toUpperCase()}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:11, color: isAbn?'#fff':'rgba(255,255,255,0.92)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{lab.name || lab.code}</div>
                            <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginTop:1, display:'flex', gap:6, alignItems:'center' }}>
                              <span>{sysIcons[sys]||''} {sysLabels[sys]||sys}</span>
                              {info && <span style={{ padding:'1px 5px', borderRadius:999, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)' }}>{info.lln}–{info.uln} {info.prefUnit||''}</span>}
                            </div>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0, minWidth:86 }}>
                            <div style={{ fontWeight:800, fontSize:14, color: statusColor, lineHeight:1 }}>{lab.value}<span style={{ fontSize:9, color:'rgba(255,255,255,0.45)', marginLeft:3, fontWeight:600 }}>{lab.unit||''}</span></div>
                            <div style={{ marginTop:3, fontSize:9, fontWeight:800, padding:'1px 6px', borderRadius:999, background: statusColor+'18', border:`1px solid ${statusColor}22`, color: statusColor, display:'inline-flex', gap:3 }}>{isAbn? (status==='high'?'↗':'↘') : '✓'} {statusText}</div>
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
            <LabsEmpty icon="🔎" title="Нет маркеров для фильтра" desc="Смените систему фильтра или сбросьте на «Все системы»." />
          )}
        </div>
      )}
    </div>
  );
};
