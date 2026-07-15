// SupplementClinicScreen_parts/ClinicalPanel.tsx — клинический контроль (BioStack v2)
import React, { useMemo } from 'react';
import { selectStack } from '../../../engines/biostack-clinical-v2.engine';
import type { LabCompositeResult } from '../../../engines/lab-analysis.engine';
import { loadProfile, entryName } from './shared';
import { ClinicalResultCard } from '../../components/BioStackAIClinicalCard';

export const ClinicalPanel: React.FC<{
  stackIds: string[];
  labAnalysis?: LabCompositeResult | null;
  onClearStops: () => void;
  onReplace?: (originalId: string, replacementId: string) => void;
}> = ({ stackIds, onClearStops, labAnalysis, onReplace }) => {
  const profile = useMemo(() => loadProfile(), []);
  const result = useMemo(() => {
    if (stackIds.length === 0) return null;
    try { return selectStack(stackIds, profile, 'comprehensive', (labAnalysis as any) || null); }
    catch { return null; }
  }, [stackIds, labAnalysis, profile]);

  if (stackIds.length === 0 || !result) {
    return (
      <div style={{
        padding:'28px 24px',borderRadius:16,marginBottom:8,
        background:'rgba(24,24,27,0.5)',border:'1px solid rgba(255,255,255,0.06)',
        backdropFilter:'blur(18px)',WebkitBackdropFilter:'blur(18px)',
      }}>
        <div style={{ fontSize:18,fontWeight:800,color:'rgba(255,255,255,0.5)',marginBottom:6 }}>🩺 Клинический контроль</div>
        <div style={{ fontSize:12,color:'rgba(255,255,255,0.35)',lineHeight:1.5 }}>
          Соберите стек — движок проверит абсолютные противопоказания, предельные дозы (UL),
          лекарственные конфликты, лабораторные коррекции и избыточность путей.
        </div>
      </div>
    );
  }

  const hardCount = result.hardStops?.length ?? 0;
  const exclCount = result.drugExclusions?.length ?? 0;
  const ulCount = result.ulWarnings?.length ?? 0;
  const labCount = result.labAdjustments?.length ?? 0;
  const titCount = result.drugTitrations?.length ?? 0;
  const hasStop = hardCount > 0 || exclCount > 0;
  const totalIssues = hardCount + exclCount + ulCount + labCount + titCount;
  const safetyPct = totalIssues === 0 ? 100 : Math.max(0, 100 - hardCount * 25 - exclCount * 15 - ulCount * 8 - titCount * 5);

  return (
    <div>
      {/* ── Verdict card ── */}
      <div style={{
        padding:'18px 20px',borderRadius:16,marginBottom:8,
        background: hasStop ? 'rgba(239,68,68,0.07)' : 'rgba(34,197,94,0.06)',
        border:`1px solid ${hasStop ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.2)'}`,
        backdropFilter:'blur(18px)',WebkitBackdropFilter:'blur(18px)',
      }}>
        {/* Verdict header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8 }}>
          <div>
            <div style={{ fontSize:20,fontWeight:800,color:hasStop?'#f87171':'#00e68a' }}>
              {hasStop ? '🛑 ЕСТЬ СТОП-ФАКТОРЫ' : '✅ ДОПУСТИМО'}
            </div>
            <div style={{ fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:2 }}>
              Стратегия: comprehensive · {result.ids?.length||stackIds.length} веществ в анализе
            </div>
          </div>

          {/* Safety gauge */}
          <div style={{
            width:64,height:64,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
            background:`conic-gradient(${safetyPct>=80?'#22c55e':safetyPct>=50?'#f59e0b':'#ef4444'} ${safetyPct}%, rgba(255,255,255,0.06) ${safetyPct}%)`,
          }}>
            <div style={{ width:52,height:52,borderRadius:'50%',background:'#18181b',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <span style={{ fontSize:18,fontWeight:800,color:safetyPct>=80?'#22c55e':safetyPct>=50?'#f59e0b':'#ef4444' }}>{safetyPct}</span>
            </div>
          </div>
        </div>

        {/* Issue counters */}
        <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginTop:12 }}>
          {[
            { v:hardCount,label:'Стоп',color:'#ef4444' },
            { v:exclCount,label:'ЛС конф.',color:'#f59e0b' },
            { v:ulCount,label:'UL',color:'#fbbf24' },
            { v:labCount,label:'Лаб.',color:'#60a5fa' },
            { v:titCount,label:'Титр.',color:'#f59e0b' },
          ].map(({v,label,color}) => (
            <div key={label} style={{
              padding:'6px 12px',borderRadius:8,textAlign:'center',
              background:v>0?`${color}14`:'rgba(255,255,255,0.03)',
              border:`1px solid ${v>0?`${color}25`:'rgba(255,255,255,0.05)'}`,
              minWidth:52,
            }}>
              <div style={{ fontSize:18,fontWeight:800,color:v>0?color:'rgba(255,255,255,0.25)' }}>{v}</div>
              <div style={{ fontSize:9,color:'rgba(255,255,255,0.35)',marginTop:1 }}>{label}</div>
            </div>
          ))}
        </div>

        {hasStop && (
          <button onClick={onClearStops} style={{
            marginTop:12,width:'100%',minHeight:42,padding:'9px 0',borderRadius:10,cursor:'pointer',
            fontSize:12,fontWeight:700,
            background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.25)',color:'#ef4444',
          }}>🗑 Исключить все стоп-позиции</button>
        )}

        {!result.labAdjustments?.length && (
          <div style={{ marginTop:8,fontSize:10,color:'#60a5fa',lineHeight:1.3 }}>
            💡 Лабораторные коррекции недоступны — заполните профиль и введите анализы для точной настройки доз
          </div>
        )}
      </div>

      <ClinicalResultCard result={result} nameOf={entryName} profile={profile as any} onReplace={onReplace} />
    </div>
  );
};
