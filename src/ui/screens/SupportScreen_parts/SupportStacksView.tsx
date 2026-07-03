// @ts-nocheck
import React from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';

export const SupportStacksView: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    stackName, setStackName,
    SUPPORT_LEVELS, supportLevel,
    savedStacks, setSavedStacks,
    expandedStack, setExpandedStack,
    getStackDisplayName,
    catalogSubstances,
  } = s;

  return (
    <div style={{ padding:'0 0 80px' }}>
      <div className="card" style={{ marginBottom:10, padding:10, background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>💾 Сохранить текущий стек</div>
        <div style={{ display:'flex', gap:6 }}>
          <input value={stackName} onChange={e=>setStackName(e.target.value)} placeholder="Название стека..."
            style={{ flex:1, padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:10 }} />
          <button onClick={() => {
            if (!stackName.trim()) { alert('Введите название'); return; }
            const level = SUPPORT_LEVELS[supportLevel];
            if (!level?.subs || level.subs.length === 0) { alert('Нет препаратов в калькуляторе'); return; }
            const newStack = { id: 'stack_'+Date.now(), name: stackName.trim(), date: new Date().toISOString(), subs: [...level.subs], dosages: { ...(level.dosages||{}) }, notes: '' };
            const updated = [...savedStacks, newStack];
            setSavedStacks(updated);
            localStorage.setItem('savedStacks', JSON.stringify(updated));
            setStackName('');
          }} style={{ padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:10 }}>Сохранить</button>
        </div>
      </div>
      {savedStacks.length === 0 ? (
        <div style={{ textAlign:'center', padding:24, background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)' }}>
          <div style={{ fontSize:28, marginBottom:6 }}>📂</div>
          <div style={{ fontSize:12, color:'var(--text-dim)' }}>Нет сохранённых стеков</div>
        </div>
      ) : (
        savedStacks.map((stack: any) => {
          const isExpanded = expandedStack === stack.id;
          return (
            <div key={stack.id} style={{ marginBottom:8, background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)', overflow:'hidden' }}>
              <div onClick={() => setExpandedStack(isExpanded ? null : stack.id)} style={{ padding:'10px 12px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>{getStackDisplayName(stack)}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>{stack.date ? new Date(stack.date).toLocaleDateString('ru') : ''} · {stack.subs.length} добавок</div>
                  {(stack as any).notes && <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{(stack as any).notes}</div>}
                </div>
                <span style={{ fontSize:12, color:'var(--text-dim)', flexShrink:0 }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
              {isExpanded && (
                <div style={{ padding:'0 12px 10px' }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:8 }}>
                    {(stack.subs || []).map((id: string) => {
                      const sub = catalogSubstances.find((s: any) => s.id === id);
                      const pharma = PHARMA_DB[id];
                      const name = sub?.name || pharma?.name || id.replace(/_/g, ' ');
                      const dosage = stack.dosages?.[id];
                      const desc = sub?.description || pharma?.description || '';
                      return (
                        <div key={id} style={{ padding:'5px 8px', borderRadius:6, background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.1)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{name}</span>
                            {dosage && <span style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>{dosage.timing || ''} {dosage.mg ? `${dosage.mg}мг` : ''}</span>}
                          </div>
                          {desc && <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{desc}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => {
                      try { localStorage.setItem('savedStacks', JSON.stringify(savedStacks.filter((s: any) => s.id !== stack.id))); setSavedStacks((prev: any[]) => prev.filter((s: any) => s.id !== stack.id)); } catch {}
                    }} style={{ padding:'4px 8px', borderRadius:6, fontSize:8, cursor:'pointer', background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444', fontWeight:600 }}>✕ Удалить</button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};