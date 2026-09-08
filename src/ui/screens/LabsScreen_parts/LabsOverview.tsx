import React from 'react';
import type { LabPoint } from '../../../core/types';
import { UCUM_MAP } from '../../../core/constants';
import { LABS_ACCENT, LABS_CARD, LABS_CARD_FLAT, LABS_SYS_COLOR, LABS_SYS_LABEL, LABS_SYS_ICON, LabsSectionHeader, LabsKpiCard, LabsBadge, LabsEmpty, getLabsSystem } from './LabsUI';
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
  labs.forEach(lab => {
    const system = getLabsSystem(lab.code) || 'other';
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
            <div style={{ fontSize:12, color:'#fff', marginTop:2, lineHeight:1.5 }}>Добавьте маркеры во вкладке «Текущие» или импортируйте PDF/фото — тогда появятся статистика, риски и графики.</div>
          </div>
          <LabsBadge color="#eab308">старт</LabsBadge>
        </div>
      )}

      {forceNoLabs && (
        <div style={{ ...LABS_CARD, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.18)', display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ width:30, height:30, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.14)', border:'1px solid rgba(239,68,68,0.18)', fontSize:14 }}>🚫</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#fecaca' }}>Применён штраф за отсутствие анализов</div>
            <div style={{ fontSize:11, color:'#fff', marginTop:2, lineHeight:1.5 }}>Риски рассчитываются с повышающим коэффициентом. Снимите штраф после ввода данных.</div>
          </div>
          <button onClick={()=>setForceNoLabs(false)} style={{ padding:'10px 14px', borderRadius:999, border:'1px solid rgba(255,255,255,0.10)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer', minHeight:44 }}>Снять</button>
        </div>
      )}

      {/* KPI — 4 карточки: mobile-first auto-fit, на 360px 2 колонки */}
      <div style={{ ...LABS_CARD, padding:14 }}>
        <LabsSectionHeader icon={<NativeIcon name="file" size={16} />} title="Сводка по фазе" subtitle={`${labs.length} маркеров • ${pctNormal}% в норме • ${abnormalCount} вне нормы`} right={<LabsBadge color={abnormalCount? '#ef4444' : LABS_ACCENT}>{abnormalCount? `${abnormalCount} откл.` : '✓ стабильно'}</LabsBadge>} />
        <div className="labs-kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
          <LabsKpiCard icon={<NativeIcon name="flask" size={14} />} label="Всего" value={labs.length} color="#38bdf8" sub="маркеров" />
          <LabsKpiCard icon={<NativeIcon name="check" size={14} />} label="Норма" value={normalCount} color="#22c55e" sub={`${pctNormal}%`} />
          <LabsKpiCard icon={<NativeIcon name="arrowUp" size={14} />} label="Выше" value={highCount} color="#ef4444" sub="нормы" />
          <LabsKpiCard icon={<NativeIcon name="arrowDown" size={14} />} label="Ниже" value={lowCount} color="#f97316" sub="нормы" />
        </div>
        {labs.length>0 && (
          <div style={{ marginTop:12, height:8, background:'rgba(255,255,255,0.08)', borderRadius:999, overflow:'hidden', display:'flex', boxShadow:'inset 0 1px 2px rgba(0,0,0,0.2)' }}>
            <div style={{ width:`${pctNormal}%`, background:'linear-gradient(90deg, #22c55e, #16a34a)', transition:'width 0.4s' }} />
            <div style={{ width:`${labs.length? Math.round(highCount/labs.length*100):0}%`, background:'linear-gradient(90deg, #ef4444, #dc2626)' }} />
            <div style={{ width:`${labs.length? Math.round(lowCount/labs.length*100):0}%`, background:'linear-gradient(90deg, #f97316, #ea580c)' }} />
          </div>
        )}
        {abnormalCount>0 && (
          <div style={{ marginTop:10, padding:'12px 12px', borderRadius:14, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.22)', borderLeft:'3px solid #ef4444', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ display:'inline-flex', color:'#f97316', flexShrink:0 }}><NativeIcon name="alertTriangle" size={14} /></span>
            <span style={{ fontSize:12, color:'#fff', flex:1, lineHeight:1.5 }}><b>{abnormalCount}</b> из {labs.length} вне нормы — <b>{highCount} ↑</b> и <b>{lowCount} ↓</b>. Проверьте «Риски и индексы» и тренды.</span>
            <span style={{ fontSize:12, padding:'4px 10px', borderRadius:999, background:'rgba(239,68,68,0.16)', border:'1px solid rgba(239,68,68,0.25)', color:'#fecaca', fontWeight:800, flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{Math.round(abnormalCount/labs.length*100)}%</span>
          </div>
        )}
      </div>

      {/* Системные группы — цветная левая кромка по системам */}
      {labs.length > 0 ? (
        <div style={{ ...LABS_CARD }}>
          <LabsSectionHeader icon={<NativeIcon name="layers" size={16} />} title="Показатели по системам" subtitle="Сортировка — сначала отклонения, затем норма. Клик по строке — детали." />
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
                    <span style={{ fontSize:11, color:'#fff', fontWeight:700 }}>{systemLabs.length} маркеров</span>
                    {sysAbn>0 ? <LabsBadge color="#ef4444" small>{sysAbn} вне</LabsBadge> : <LabsBadge color={LABS_ACCENT} small>в норме</LabsBadge>}
                  </div>
                  <div className="labs-sys-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8, padding:10 }}>
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
                          display:'flex', alignItems:'center', gap:10, padding:'12px 12px', borderRadius:14,
                          background: isAbn? statusColor+'12' : 'rgba(255,255,255,0.03)', border:`1px solid ${isAbn? statusColor+'22' : 'rgba(140,190,255,0.12)'}`,
                          borderLeft:`3px solid ${statusColor}`, minWidth:0, minHeight:64,
                        }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:800, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{lab.name || lab.code}</div>
                            <div style={{ fontSize:11, color:'#fff', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{lab.code} • {refInfo || '—'}</div>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontSize:16, fontWeight:900, color: statusColor, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{lab.value}<span style={{ fontSize:10, color:'#fff', marginLeft:3, fontWeight:700 }}>{lab.unit||''}</span></div>
                            <div style={{ marginTop:4, display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:999, background: statusColor+'1E', border:`1px solid ${statusColor}30`, color: statusColor }}>{statusIcon} {status==='high'?'выше': status==='low'?'ниже': status==='unknown'?'—':'норма'}</div>
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
          <LabsEmpty
            icon={<NativeIcon name="flask" size={32} />}
            title="Нет маркеров в этой фазе"
            desc="Введите анализы во вкладке «Текущие» или импортируйте PDF/фото. Данные группируются по системам автоматически."
            action={<span style={{ fontSize:12, fontWeight:800, padding:'10px 18px', borderRadius:999, background:'linear-gradient(135deg, var(--labs-accent, #00e68a), var(--accent-2, #00e68a))', color:'#0a1a08', display:'inline-flex', alignItems:'center', gap:6 }}>＋ Перейти к вводу</span>}
          />
      )}
    </div>
  );
};
