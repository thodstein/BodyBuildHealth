// SupplementClinicScreen_parts/InteractionPanel.tsx — взаимодействия и синергии стека.
import React, { useMemo } from 'react';
import { SynergyEngine } from '../../../engines/synergy-score.engine';
import { buildMasterDB, entryName, getEntry, card, sectionTitle } from './shared';

const LEVEL_COLOR: Record<string, string> = {
  STRONG_SYNERGY: '#22c55e', GOOD_SYNERGY: '#4ade80',
  NEUTRAL: '#94a3b8', WEAK_CONFLICT: '#f59e0b', DANGEROUS_CONFLICT: '#ef4444',
};

export const InteractionPanel: React.FC<{ stackIds: string[] }> = ({ stackIds }) => {
  const pairs = useMemo(() => {
    if (stackIds.length < 2) return [];
    const { db, subById } = buildMasterDB(stackIds);
    const out: { a:string; b:string; score:number; level:string; sharedMech:number; type:string; desc:string; mechanism:string }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < stackIds.length; i++) {
      for (let j = i + 1; j < stackIds.length; j++) {
        const a = subById[stackIds[i]], b = subById[stackIds[j]];
        if (!a || !b) continue;
        const key = [a.id, b.id].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const r = SynergyEngine.calculatePair(a, b, db);
        const ea = getEntry(a.id), eb = getEntry(b.id);
        let type = 'computed', desc = '', mechanism = '';
        // Ищем описание из каталога — сначала synergy, потом conflict
        const synA = (ea?.synergies||[]).find((s:any)=>s.with===b.id);
        const conA = (ea?.conflicts||[]).find((c:any)=>c.with===b.id);
        const synB = (eb?.synergies||[]).find((s:any)=>s.with===a.id);
        const conB = (eb?.conflicts||[]).find((c:any)=>c.with===a.id);
        if (synA || synB) {
          type = 'synergy';
          desc = (synA||synB)?.effect || '';
          mechanism = (synA||synB)?.mechanism || '';
        } else if (conA || conB) {
          type = 'conflict';
          desc = (conA||conB)?.effect || '';
          mechanism = (conA||conB)?.mechanism || '';
        }
        out.push({ a:a.id, b:b.id, score:r.score, level:r.level, sharedMech:(a.mechanisms||[]).filter(m=>(b.mechanisms||[]).includes(m)).length, type, desc, mechanism });
      }
    }
    return out.sort((x,y)=>x.score-y.score);
  }, [stackIds]);

  const organLoad = useMemo(() => {
    const load: Record<string,number> = {};
    for (const id of stackIds) {
      const e = getEntry(id);
      for (const o of [...(e?.organs||[]),...(e?.systems||[])]) load[o]=(load[o]||0)+1;
    }
    return Object.entries(load).filter(([,n])=>n>=2).sort(([,a],[,b])=>b-a).slice(0,8);
  }, [stackIds]);

  if (stackIds.length < 2) {
    return <div style={card}><div style={sectionTitle}>Взаимодействия</div><div style={{color:'var(--text-dim)',fontSize:14}}>Добавьте минимум 2 вещества в стек.</div></div>;
  }

  const conflicts = pairs.filter(p => p.level==='DANGEROUS_CONFLICT'||p.level==='WEAK_CONFLICT'||p.type==='conflict'||p.score<0);
  const synergies = pairs.filter(p => p.level==='STRONG_SYNERGY'||p.level==='GOOD_SYNERGY'||p.type==='synergy');
  const neutral = pairs.filter(p => !conflicts.includes(p) && !synergies.includes(p));

  return (
    <div>
      <div style={{...sectionTitle,marginBottom:8}}>
        {conflicts.length} конфликтов · {synergies.length} синергий · {pairs.length} пар
      </div>

      {organLoad.length>0&&(
        <div style={card}>
          <div style={sectionTitle}>Нагрузка по органам (≥2 веществ)</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {organLoad.map(([o,n])=>(<span key={o} style={{padding:'5px 10px',borderRadius:10,fontSize:13,background:n>=4?'rgba(245,158,11,0.16)':'rgba(255,255,255,0.04)',border:'1px solid '+(n>=4?'rgba(245,158,11,0.4)':'rgba(255,255,255,0.1)'),color:'var(--text)'}}>{o}:<b>{n}</b></span>))}
          </div>
        </div>
      )}

      {conflicts.length>0&&(
        <div style={card}>
          <div style={{...sectionTitle,color:'#ef4444',fontSize:14}}>🔴 Конфликты ({conflicts.length})</div>
          {conflicts.map((p,i)=>(
            <div key={i} style={{padding:'10px 12px',marginBottom:4,borderRadius:12,background:'rgba(239,68,68,0.04)',border:'1px solid rgba(239,68,68,0.12)'}}>
              <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>{entryName(p.a)} × {entryName(p.b)}</div>
              {p.desc&&<div style={{fontSize:12,color:'#ff8a9b',marginTop:4,lineHeight:1.4}}>{p.desc}</div>}
              {p.mechanism&&<div style={{fontSize:11,color:'rgba(235,235,245,0.6)',marginTop:4,lineHeight:1.4}}>{p.mechanism}</div>}
              {!p.desc&&!p.mechanism&&p.sharedMech>0&&<div style={{fontSize:11,color:'rgba(235,235,245,0.5)',marginTop:4}}>Конфликт по {p.sharedMech} общим механизмам</div>}
              <div style={{display:'flex',gap:6,alignItems:'center',marginTop:6}}>
                <span style={{fontSize:10,padding:'2px 8px',borderRadius:6,background:'rgba(239,68,68,0.15)',color:'#f87171',fontWeight:700}}>{p.level==='DANGEROUS_CONFLICT'?'Критический':'Конфликт'}</span>
                <span style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>score: {p.score}</span>
                {p.sharedMech>0&&<span style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>· {p.sharedMech} общ. мех.</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {synergies.length>0&&(
        <div style={card}>
          <div style={{...sectionTitle,color:'#22c55e',fontSize:14}}>🟢 Синергии ({synergies.length})</div>
          {synergies.map((p,i)=>(
            <div key={i} style={{padding:'10px 12px',marginBottom:4,borderRadius:12,background:'rgba(34,197,94,0.04)',border:'1px solid rgba(34,197,94,0.12)'}}>
              <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>{entryName(p.a)} × {entryName(p.b)}</div>
              {p.desc&&<div style={{fontSize:12,color:'#4ade80',marginTop:4,lineHeight:1.4}}>{p.desc}</div>}
              {p.mechanism&&<div style={{fontSize:11,color:'rgba(235,235,245,0.6)',marginTop:4,lineHeight:1.4}}>{p.mechanism}</div>}
              <div style={{display:'flex',gap:6,alignItems:'center',marginTop:6}}>
                <span style={{fontSize:10,padding:'2px 8px',borderRadius:6,background:'rgba(34,197,94,0.15)',color:'#22c55e',fontWeight:700}}>{p.level==='STRONG_SYNERGY'?'Сильная':'Синергия'}</span>
                <span style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>score: +{p.score}</span>
                {p.sharedMech>0&&<span style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>· {p.sharedMech} общ. мех.</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {neutral.length>0&&(
        <div style={card}>
          <div style={{...sectionTitle,color:'rgba(255,255,255,0.5)',fontSize:13,cursor:'pointer'}} onClick={()=>{const el=document.getElementById('ip-neutral-list');if(el)el.style.display=el.style.display==='none'?'flex':'none';}}>
            🟦 Прочие пары ({neutral.length}) — кликните чтобы раскрыть
          </div>
          <div id="ip-neutral-list" style={{display:'none',flexDirection:'column',gap:4,marginTop:6}}>
            {neutral.map((p,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',borderRadius:8,background:'rgba(255,255,255,0.03)'}}>
                <span style={{fontSize:12}}>{entryName(p.a)} × {entryName(p.b)}</span>
                <span style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>{p.score>0?'+':''}{p.score} · {p.sharedMech} мех</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
