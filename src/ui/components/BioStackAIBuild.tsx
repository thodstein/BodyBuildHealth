import React, { useState, useMemo, useCallback } from 'react';
import { type BioStackProfile, type GoalType } from '../../engines/biostack-ai.engine';
import { buildStack, explainStack, type StackExplanation } from '../../engines/supplement-finder.engine';
import { GlassCard, PillBtn, StatBox, inputS, selectS, ORGANS, SYSTEMS, GOALS, LAB_MARKERS, GROUP_LABELS, toFinderProfile } from './BioStackAIConstants';

type LMState = Record<string, 'off' | 'maintain' | 'correct'>;

export function BuildTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [goals, setGoals] = useState<GoalType[]>(profile.goals);
  const [selOrgans, setSelOrgans] = useState<string[]>([]);
  const [selSystems, setSelSystems] = useState<string[]>([]);
  const [targetSize, setTargetSize] = useState(() => profile.stackComplexity === 'minimal' ? 5 : profile.stackComplexity === 'balanced' ? 10 : 18);
  const [lmState, setLmState] = useState<LMState>({});
  const [result, setResult] = useState<{ stack: string[]; explanation: StackExplanation } | null>(null);

  const handleBuild = useCallback(() => {
    const queryOrgans = [...selOrgans];
    const queryMechs: string[] = [];
    Object.entries(lmState).forEach(([id, state]) => {
      if (state === 'maintain' || state === 'correct') {
        const marker = LAB_MARKERS.find(m => m.id === id);
        if (marker) {
          marker.organs.forEach(o => { if (!queryOrgans.includes(o)) queryOrgans.push(o); });
          marker.mechanisms.forEach(m => { if (!queryMechs.includes(m)) queryMechs.push(m); });
        }
      }
    });
    const firstGoal = goals[0] || profile.goals[0] || undefined;
    const fp = toFinderProfile(profile);
    const built = buildStack({
      baseIds: stackIds, targetSize,
      goal: firstGoal || undefined,
      organs: queryOrgans.length > 0 ? queryOrgans : undefined,
      mechanisms: queryMechs.length > 0 ? queryMechs : undefined,
      autoFill: true, profile: fp,
    });
    const exp = explainStack(built.stack, fp);
    setResult({ stack: built.stack, explanation: exp });
  }, [goals, selOrgans, selSystems, targetSize, lmState, stackIds, profile]);

  const handleSaveStack = useCallback(() => {
    if (!result) return;
    const existing: string[][] = JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]');
    const updated = [result.stack, ...existing].slice(0, 10);
    localStorage.setItem('he_finder_saved_stacks', JSON.stringify(updated));
  }, [result]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="🎯 Цели" icon="🎯" color="#f59e0b">
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {GOALS.map(g => (
            <PillBtn key={g.key} small active={goals.includes(g.key)}
              onClick={() => setGoals(goals.includes(g.key) ? goals.filter(x => x !== g.key) : [...goals, g.key])}>
              {g.label}
            </PillBtn>
          ))}
        </div>
      </GlassCard>

      <GlassCard title="🫀 Органы и системы" icon="🫀" color="#60a5fa">
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Органы:</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {ORGANS.map(o => (
              <PillBtn key={o.key} small active={selOrgans.includes(o.key)}
                onClick={() => setSelOrgans(selOrgans.includes(o.key) ? selOrgans.filter(x => x !== o.key) : [...selOrgans, o.key])}>
                {o.label}
              </PillBtn>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Системы:</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {SYSTEMS.map(s => (
              <PillBtn key={s.key} small active={selSystems.includes(s.key)}
                onClick={() => setSelSystems(selSystems.includes(s.key) ? selSystems.filter(x => x !== s.key) : [...selSystems, s.key])}>
                {s.label}
              </PillBtn>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard title="🧪 По анализам" icon="🧪" color="#a78bfa">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {GROUP_LABELS.map(group => {
            const markers = LAB_MARKERS.filter(m => m.group === group);
            if (markers.length === 0) return null;
            return (
              <div key={group} style={{ padding: '4px 0' }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{group}</div>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {markers.map(m => {
                    const st = lmState[m.id] || 'off';
                    return (
                      <button key={m.id} onClick={() => setLmState(prev => ({
                        ...prev, [m.id]: st === 'off' ? 'maintain' : st === 'maintain' ? 'correct' : 'off',
                      }))} style={{
                        padding: '3px 8px', borderRadius: 10, fontSize: 7, cursor: 'pointer', fontWeight: 600,
                        whiteSpace: 'nowrap', transition: 'all 0.15s',
                        background: st === 'correct' ? 'rgba(239,68,68,0.1)' : st === 'maintain' ? 'rgba(0,230,138,0.08)' : '#202023',
                        border: `1px solid ${st === 'correct' ? 'rgba(239,68,68,0.2)' : st === 'maintain' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)'}`,
                        color: st === 'correct' ? '#ef4444' : st === 'maintain' ? '#00e68a' : 'rgba(255,255,255,0.5)',
                      }}>
                        {m.label} {st === 'maintain' ? '🟢' : st === 'correct' ? '🔴' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard title="📏 Размер стека: {targetSize}" icon="📏" color="#00e68a">
        <input type="range" min={1} max={40} value={targetSize} onChange={e => setTargetSize(+e.target.value)}
          style={{ width: '100%', height: 4, borderRadius: 2, background: '#202023', accentColor: '#00e68a', outline: 'none', marginBottom: 4 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
          <span>1 — Минимальный</span>
          <span>10 — Средний</span>
          <span>20+ — Максимальный</span>
        </div>
      </GlassCard>

      <button onClick={handleBuild} style={{
        width: '100%', padding: '14px 0', borderRadius: 14, fontSize: 13, fontWeight: 800, cursor: 'pointer', marginBottom: 10,
        background: 'linear-gradient(135deg,#00e68a,#00c8a0)', border: 'none', color: '#000',
        boxShadow: '0 4px 20px rgba(0,230,138,0.2)',
      }}>
        🧩 Собрать стек
      </button>

      {result && (
        <GlassCard title="📋 Результат сборки" icon="📋" color="#00e68a">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
            <StatBox label="Синергия" value={result.explanation.totalSynergyScore} color="#8b5cf6" />
            <StatBox label="Покрытие" value={`${result.explanation.completeness}%`} color="#8b5cf6" />
            <StatBox label="Компонентов" value={result.stack.length} color="#00e68a" />
            <StatBox label="С дозировкой" value={`${result.explanation.totalDoseCount}/${result.stack.length}`} color="#60a5fa" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
            {result.explanation.substances.map(s => (
              <div key={s.id} style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{s.name}</span>
                  <span style={{ fontSize: 8, color: '#00e68a' }}>{s.role}</span>
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>🧬 {s.mechanism}</div>
                {s.dose && <div style={{ fontSize: 8, color: '#60a5fa' }}>💊 {s.dose}</div>}
              </div>
            ))}
          </div>
          {result.explanation.warnings.length > 0 && (
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', marginBottom: 6 }}>
              <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>⚠ Предупреждения:</div>
              {result.explanation.warnings.slice(0, 5).map((w, i) => (
                <div key={i} style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3 }}>• {w}</div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => { setStackIds(result.stack); handleSaveStack(); }} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
            }}>💾 Сохранить стек</button>
            <button onClick={() => {
              const txt = result.explanation.substances.map(s => `${s.name} — ${s.dose || s.role}`).join('\n');
              navigator.clipboard.writeText(txt);
            }} style={{
              padding: '8px 14px', borderRadius: 10, fontSize: 9, fontWeight: 700, cursor: 'pointer',
              background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            }}>📋</button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
