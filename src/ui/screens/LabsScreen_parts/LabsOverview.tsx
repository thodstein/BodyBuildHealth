import React from 'react';
import type { LabPoint } from '../../../core/types';
import { UCUM_MAP } from '../../../core/constants';
import { LABS_ACCENT, LABS_CARD, LABS_CARD_FLAT, LABS_SYS_COLOR, LABS_SYS_LABEL, LABS_SYS_ICON, LabsSectionHeader, LabsKpiCard, LabsBadge, LabsEmpty } from './LabsUI';
import { NativeIcon, type NativeIconName } from '../../native/NativeIcons';

const LAB_RANGES: Record<string, { min: number; max: number; name: string; unit: string }> = {};
Object.entries(UCUM_MAP).forEach(([code, info]) => {
  LAB_RANGES[code] = { min: info.lln, max: info.uln, name: info.name, unit: info.prefUnit };
});

function getLabStatus(lab: LabPoint): 'normal' | 'high' | 'low' | 'unknown' {
  if (lab.refLow !== undefined && lab.refHigh !== undefined) {
    if (lab.value > lab.refHigh) return 'high';
    if (lab.value < lab.refLow) return 'low';
    return 'normal';
  }
  const range = LAB_RANGES[lab.code] || LAB_RANGES[lab.code.toUpperCase()];
  if (!range) return 'unknown';
  if (lab.value > range.max) return 'high';
  if (lab.value < range.min) return 'low';
  return 'normal';
}

function getLabRefInfo(lab: LabPoint): string {
  if (lab.refLow !== undefined && lab.refHigh !== undefined) return `${lab.refLow}–${lab.refHigh} ${lab.unit || ''}`;
  const range = LAB_RANGES[lab.code] || LAB_RANGES[lab.code.toUpperCase()];
  if (!range) return '';
  return `${range.min}–${range.max} ${range.unit}`;
}

export const LabsOverview: React.FC<{
  labs: LabPoint[];
  hasLabs: boolean;
  forceNoLabs: boolean;
  setForceNoLabs: (v: boolean) => void;
}> = ({ labs, hasLabs, forceNoLabs, setForceNoLabs }) => {
  const normalCount = labs.filter(l => getLabStatus(l) === 'normal').length;
  const highCount = labs.filter(l => getLabStatus(l) === 'high').length;
  const lowCount = labs.filter(l => getLabStatus(l) === 'low').length;
  const abnormalCount = highCount + lowCount;

  const systemGroups: Record<string, LabPoint[]> = {};
  const labSystemMap: Record<string, string> = {
    'LDL': 'cardio', 'HDL': 'cardio', 'TG': 'cardio', 'CHOL': 'cardio', 'GLU': 'metabolic', 'HBA1C': 'metabolic', 'HbA1c': 'metabolic', 'HOMOCYSTEINE': 'cardio',
    'ALT': 'hepatic', 'AST': 'hepatic', 'GGT': 'hepatic', 'ALP': 'hepatic', 'BILIRUBIN_TOTAL': 'hepatic', 'BIL_T': 'hepatic', 'BIL': 'hepatic', 'DBIL': 'hepatic', 'ALB': 'hepatic',
    'CREATININE': 'renal', 'BUN': 'renal', 'EGFR': 'renal', 'UREA': 'renal', 'PROTEIN_TOTAL': '', 'TP': '', 'UA': 'renal',
    'TSH': 'endocrine', 'FT3': 'endocrine', 'FT4': 'endocrine', 'TESTOSTERONE': 'endocrine', 'TT': 'endocrine', 'E2': 'endocrine', 'ESTRADIOL': 'endocrine', 'PRL': 'endocrine', 'PROLACTIN': 'endocrine', 'CORTISOL': 'endocrine', 'INSULIN': 'metabolic', 'INS': 'metabolic', 'HOMA': 'metabolic', 'LH': 'endocrine', 'FSH': 'endocrine', 'SHBG': 'endocrine',
    'HGB': 'hematologic', 'HCT': 'hematologic', 'PLT': 'hematologic', 'WBC': 'hematologic', 'RBC': 'hematologic', 'MCV': 'hematologic', 'MCH': 'hematologic', 'MCHC': 'hematologic',
    'CRP': 'cardio', 'FERRITIN': 'hematologic', 'VITD': 'metabolic', 'CALCIDIOL': 'metabolic', 'IGF1': 'endocrine', 'DHEA_S': 'endocrine', 'PSA': 'reproductive', 'PROGESTERONE': 'reproductive', 'AMH': 'reproductive', 'INHB': 'reproductive',
    'K': 'metabolic', 'NA': 'metabolic', 'CA': 'metabolic', 'MG': 'metabolic', 'P': 'metabolic', 'IRON': 'hematologic', 'TIBC': 'hematologic',
  };

  labs.forEach(lab => {
    const system = labSystemMap[lab.code.toUpperCase()] || 'other';
    if (!systemGroups[system]) systemGroups[system] = [];
    systemGroups[system].push(lab);
  });

  const sortedSystems = Object.entries(systemGroups).sort(([a], [b]) => a.localeCompare(b));
  const pctNormal = labs.length ? Math.round(normalCount / labs.length * 100) : 0;

  return (
    <div className="labs-overview" style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {!hasLabs && !forceNoLabs && (
        <div style={{ ...LABS_CARD, background:'rgba(234,179,8,0.08)', border:'1px solid rgba(234,179,8,0.16)', display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ width:30, height:30, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(234,179,8,0.14)', border:'1px solid rgba(234,179,8,0.18)', fontSize:14 }}>💡</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#fde68a' }}>Нет данных анализов</div>
            <div style={{ fontSize:10, color:'#fff', marginTop:1, lineHeight:1.35 }}>Добавьте маркеры во вкладке «Текущие» или импортируйте PDF/фото — тогда появятся статистика, риски и графики.</div>
          </div>
          <LabsBadge color="#eab308">старт</LabsBadge>
        </div>
      )}

      {forceNoLabs && (
        <div style={{ ...LABS_CARD, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.18)', display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ width:30, height:30, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.14)', border:'1px solid rgba(239,68,68,0.18)', fontSize:14 }}>🚫</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#fecaca' }}>Применён штраф за отсутствие анализов</div>
            <div style={{ fontSize:9, color:'#fff', marginTop:1 }}>Риски рассчитываются с повышающим коэффициентом. Снимите штраф после ввода данных.</div>
          </div>
          <button onClick={()=>setForceNoLabs(false)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>Снять</button>
        </div>
      )}

      {/* KPI — 4 карточки */}
      <div style={{ ...LABS_CARD, background:'rgba(20,22,30,0.42)', backdropFilter:'blur(10px)', padding:12 }}>
        <LabsSectionHeader icon={<NativeIcon name="file" size={15} />} title="Сводка по фазе" subtitle={`${labs.length} маркеров • ${pctNormal}% в норме • ${abnormalCount} вне нормы`} right={<LabsBadge color={abnormalCount? '#ef4444' : LABS_ACCENT}>{abnormalCount? `${abnormalCount} откл.` : '✓ стабильно'}</LabsBadge>} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          <LabsKpiCard icon={<NativeIcon name="flask" size={13} />} label="Всего" value={labs.length} color="#38bdf8" sub="маркеров" />
          <LabsKpiCard icon={<NativeIcon name="check" size={13} />} label="Норма" value={normalCount} color="#22c55e" sub={`${pctNormal}%`} />
          <LabsKpiCard icon={<NativeIcon name="arrowUp" size={13} />} label="Выше" value={highCount} color="#ef4444" sub="нормы" />
          <LabsKpiCard icon={<NativeIcon name="arrowDown" size={13} />} label="Ниже" value={lowCount} color="#f97316" sub="нормы" />
        </div>
        {labs.length>0 && (
          <div style={{ marginTop:10, height:6, background:'rgba(255,255,255,0.06)', borderRadius:999, overflow:'hidden', display:'flex' }}>
            <div style={{ width:`${pctNormal}%`, background:'#22c55e', transition:'width 0.4s' }} />
            <div style={{ width:`${labs.length? Math.round(highCount/labs.length*100):0}%`, background:'#ef4444' }} />
            <div style={{ width:`${labs.length? Math.round(lowCount/labs.length*100):0}%`, background:'#f97316' }} />
          </div>
        )}
        {abnormalCount>0 && (
          <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.14)', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ display: 'inline-flex', color: '#f97316' }}><NativeIcon name="alertTriangle" size={12} /></span>
            <span style={{ fontSize:10, color:'#fecaca', flex:1 }}><b>{abnormalCount}</b> из {labs.length} вне нормы — <b>{highCount} ↑</b> и <b>{lowCount} ↓</b>. Проверьте «Риски и индексы» и тренды.</span>
            <span style={{ fontSize:9, padding:'3px 7px', borderRadius:999, background:'rgba(239,68,68,0.14)', border:'1px solid rgba(239,68,68,0.18)', color:'#fecaca', fontWeight:800 }}>{Math.round(abnormalCount/labs.length*100)}%</span>
          </div>
        )}
      </div>

      {/* Системные группы */}
      {labs.length > 0 ? (
        <div style={{ ...LABS_CARD, background:'rgba(20,22,30,0.38)', backdropFilter:'blur(10px)' }}>
          <LabsSectionHeader icon={<NativeIcon name="layers" size={15} />} title="Показатели по системам" subtitle="Сортировка — сначала отклонения, затем норма. Клик по строке — детали." />
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {sortedSystems.map(([system, systemLabs]) => {
              const color = LABS_SYS_COLOR[system] || '#6b7280';
              const icon: NativeIconName = LABS_SYS_ICON[system] || 'file';
              const label = LABS_SYS_LABEL[system] || system;
              const sysAbn = systemLabs.filter(l=> { const s=getLabStatus(l); return s==='high'||s==='low'; }).length;
              return (
                <div key={system} style={{ borderRadius:14, overflow:'hidden', border:`1px solid ${color}18`, background:'rgba(255,255,255,0.02)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 11px', background: color+'10', borderBottom:`1px solid ${color}14` }}>
                    <span style={{ width:28, height:28, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', background: color+'18', border:`1px solid ${color}22`, color }}><NativeIcon name={icon} size={14} /></span>
                    <span style={{ fontSize:12, fontWeight:800, color:'#fff', flex:1 }}>{label}</span>
                    <span style={{ fontSize:9, color:'#fff' }}>{systemLabs.length} маркеров</span>
                    {sysAbn>0 ? <LabsBadge color="#ef4444" small>{sysAbn} вне</LabsBadge> : <LabsBadge color={LABS_ACCENT} small>в норме</LabsBadge>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, padding:8 }}>
                    {systemLabs.sort((a,b)=> {
                      const pa: Record<string,number> = { high:0, low:1, unknown:2, normal:3 };
                      return (pa[getLabStatus(a)]??2) - (pa[getLabStatus(b)]??2);
                    }).map(lab=>{
                      const status = getLabStatus(lab);
                      const refInfo = getLabRefInfo(lab);
                      const statusColor = status==='high'? '#ef4444' : status==='low'? '#f97316' : status==='unknown'? '#6b7280' : LABS_ACCENT;
                      const statusIcon = status==='high'?'↑': status==='low'?'↓': status==='unknown'?'•':'✓';
                      const isAbn = status==='high'||status==='low';
                      return (
                        <div key={lab.code+'-'+lab.date} style={{
                          display:'flex', alignItems:'center', gap:8, padding:'8px 9px', borderRadius:11,
                          background: isAbn? statusColor+'10' : 'rgba(255,255,255,0.03)', border:`1px solid ${isAbn? statusColor+'1E' : 'rgba(255,255,255,0.06)'}`,
                          borderLeft:`3px solid ${statusColor}`, minWidth:0,
                        }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, fontWeight:700, color: isAbn? '#fff':'rgba(255,255,255,0.9)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{lab.name || lab.code}</div>
                            <div style={{ fontSize:9, color:'#fff', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{lab.code} • {refInfo || '—'}</div>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontSize:13, fontWeight:800, color: statusColor, lineHeight:1 }}>{lab.value}<span style={{ fontSize:9, color:'#fff', marginLeft:2, fontWeight:600 }}>{lab.unit||''}</span></div>
                            <div style={{ marginTop:2, display:'inline-flex', alignItems:'center', gap:3, fontSize:9, fontWeight:800, padding:'1px 6px', borderRadius:999, background: statusColor+'18', border:`1px solid ${statusColor}22`, color: statusColor }}>{statusIcon} {status==='high'?'выше': status==='low'?'ниже': status==='unknown'?'—':'норма'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
          <LabsEmpty icon={<NativeIcon name="flask" size={26} />} title="Нет маркеров в этой фазе" desc="Введите анализы во вкладке «Текущие» или импортируйте PDF/фото. Данные группируются по системам автоматически." />
      )}
    </div>
  );
};
