/**
 * bb-step-split.tsx — шаг 3 ББ-авто («🏆 Выбор сплита»), вынесен из
 * god-component `BbAutoConstructor.tsx` (этап 2 §4.3). Перенос 1-в-1:
 * логика/тексты/стили не менялись, все state-ссылки переданы явными props.
 */
import React from 'react';
import { SPLIT_PATTERNS } from '../../../engines/bb/bb-split-patterns';
import { getMuscleFrequencies, type BBRankedPattern } from '../../../engines/bb/bb-selector.engine';
import { PHASE_COLORS, PHASE_LABELS } from './PlanOutput';
import { ACCENT, BTN, BTN_GHOST, H, SMALL } from './training-ui';
import { TAG_LABELS_RU, type BBPhase } from './bb-auto-constructor-shared';

export interface BbSplitStepProps {
  selectedSplitId: string;
  /** Ручной выбор: помечает выбор пользователя (splitTouched) и обновляет сплит. */
  onSelectSplit: (id: string) => void;
  bestSplit: BBRankedPattern | undefined;
  phases: { week: number; phase: BBPhase }[];
  ranked: BBRankedPattern[];
  suggestSplitIds: Set<string>;
  goal: string;
  level: string;
  weeks: number;
  isBuilding: boolean;
  onBuild: () => void;
  onBack: () => void;
}

export const BbSplitStep: React.FC<BbSplitStepProps> = ({
  selectedSplitId, onSelectSplit, bestSplit, phases, ranked, suggestSplitIds,
  goal, level, weeks, isBuilding, onBuild, onBack,
}) => (
  <div>
    <div style={H}>🏆 Шаг 3: Выбор сплита</div>
    <div style={{ marginBottom:8, padding:'6px 10px', borderRadius:10, background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.22)', fontSize:12, color:'#00e68a', fontWeight:800 }}>
      ✅ Будет собран: {SPLIT_PATTERNS.find(p => p.id === selectedSplitId)?.name || '— выберите сплит ниже —'}
    </div>
    <div style={{ marginBottom:8, padding:'6px 10px', borderRadius:10, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.12)', fontSize:11, color:'#fff' }}>
      📅 Фазы: {phases.filter((p,i,a) => p.phase !== a[i-1]?.phase).map((p,i) => <span key={i} style={{ color:PHASE_COLORS[p.phase], fontWeight:700 }}>{PHASE_LABELS[p.phase]}{i < phases.length - 1 ? ' → ' : ''}</span>)}
    </div>
    <div style={{ marginBottom:10, padding:'6px 10px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)', fontSize:11, color:'#fff' }}>
      💡 Частота каждой группы — ключевой фактор роста. 2×/нед = оптимум для синтеза белка (Schoenfeld 2016, JSF 2019).
      Чипсы <span style={{ color:'#00e68a' }}>зелёные</span> = 2+×/нед (рекомендуемая частота), <span style={{ color:'#fff' }}>серые</span> = 1×/нед.
    </div>
    {bestSplit && (
      <div style={{ marginBottom:10, padding:12, borderRadius:12, background:'linear-gradient(135deg,rgba(250,204,21,0.08),rgba(250,204,21,0.02))', border:'1px solid rgba(250,204,21,0.25)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <span style={{ fontWeight:800, fontSize:13, color:'#facc15' }}>🏆 Рекомендованный сплит: {bestSplit.pattern.name}</span>
          <span style={{ fontSize:12, color:'#facc15', fontWeight:700, background:'rgba(250,204,21,0.15)', padding:'2px 10px', borderRadius:8 }}>скор {bestSplit.score}</span>
        </div>
        <div style={{ fontSize:11, color:'#fff', marginBottom:6 }}>{bestSplit.pattern.description}</div>
        {bestSplit.rationale.slice(0, 3).map((x,i) => <div key={i} style={{ fontSize:11, color:'#fff' }}>✓ {x}</div>)}
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button onClick={() => onSelectSplit(bestSplit.pattern.id)} style={{ padding:'6px 16px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', background:'rgba(250,204,21,0.15)', border:'1px solid rgba(250,204,21,0.3)', color:'#facc15' }}>✅ Применить</button>
          <button onClick={onBuild} disabled={isBuilding} style={{ padding:'6px 16px', borderRadius:10, fontSize:11, fontWeight:700, cursor: isBuilding ? 'default' : 'pointer', opacity: isBuilding ? 0.6 : 1, background:'rgba(0,230,138,0.15)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a' }}>{isBuilding ? '⏳ Сборка…' : '⚡ Собрать план'}</button>
        </div>
      </div>
    )}
    <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
      {ranked.map(r => {
        const sel = selectedSplitId === r.pattern.id;
        const mf = getMuscleFrequencies(r.pattern);
        const isSugSplit = suggestSplitIds.has(r.pattern.id);
        return <div key={r.pattern.id}
          style={{ padding:'10px 12px', borderRadius:10, border:sel?'1px solid #00e68a':isSugSplit?'1px solid rgba(245,158,11,0.25)':'1px solid rgba(255,255,255,0.06)', background:sel?'rgba(0,230,138,0.08)':isSugSplit?'rgba(245,158,11,0.04)':'rgba(255,255,255,0.02)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:700, fontSize:12, color:sel?'#00e68a':isSugSplit?'#f59e0b':'#fff' }}>{isSugSplit ? '★ ' : ''}{r.pattern.name}</span>
            <span style={{ fontSize:11, color:ACCENT, fontWeight:700, background:'rgba(0,230,138,0.12)', padding:'2px 8px', borderRadius:8 }}>скор {r.score}</span>
          </div>
          <div style={{ ...SMALL, marginTop:4 }}>{r.pattern.description}</div>
          {isSugSplit && <div style={{ fontSize:10, color:'#f59e0b', marginTop:2 }}>★ Совместим с целью «{goal}» + уровнем «{level}» — рекомендован, но можно выбрать любой</div>}
          {sel && <div style={{ marginTop:6, fontSize:11, color:'#fff' }}>{r.rationale.map((x,i) => <div key={i}>✓ {x}</div>)}</div>}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
            {mf.map(f => (
              <span key={f.tag} style={{ fontSize:11, padding:'1px 6px', borderRadius:4, background:f.freq >= 2 ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)', color:f.freq >= 2 ? '#00e68a' : '#fff' }}>{TAG_LABELS_RU[f.tag] || f.tag} ~ {f.freq}×/нед</span>
            ))}
          </div>
          <button onClick={() => onSelectSplit(r.pattern.id)} style={{ marginTop:8, padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', background:sel?'#00e68a':'rgba(255,255,255,0.06)', color:sel?'#000':'#fff', border:'1px solid '+(sel?'#00e68a':'rgba(255,255,255,0.1)'), width:'100%' }}>{sel ? '✓ Выбран' : 'Выбрать этот сплит'}</button>
        </div>;
      })}
    </div>
    <div style={{ display:'flex', gap:8, marginTop:12 }}>
      <button style={{ ...BTN, flex:1, opacity: isBuilding ? 0.6 : 1 }} disabled={isBuilding} onClick={onBuild}>{isBuilding ? '⏳ Сборка…' : `✅ Собрать план (${weeks} нед, фазовая периодизация)`}</button>
      <button style={BTN_GHOST} onClick={onBack}>← Назад</button>
    </div>
  </div>
);
