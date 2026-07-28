/**
 * editor-panels/periodization.tsx — периодизация и тренер прогрессии.
 * F4.6: вынесено из ProgramEditorPanels.tsx.
 */
import React from 'react';
import { CARD, DIM, DIM_STRONG, ACCENT } from '../training-ui';
import { distributePhases } from '../../../../engines/periodization';
import { prescribeLoad } from '../../../../engines/bb/bb-autocoach.engine';
import { loadTrainingProfile } from '../training-profile';
import { PHASE_LABELS } from './shared';
import type { PanelProps } from './shared';

const PHASE_LABELS_SP = PHASE_LABELS;
const pc: Record<string, string> = { accumulation: '#22c55e', intensification: '#f59e0b', deload: '#ef4444', peaking: '#a78bfa' };

export const AutoPeriodizationPanel: React.FC<{
  weeks: number; goal: string; level: string;
  onApply?: (phases: Array<{ weeks: number[]; phase: string }>) => void;
}> = ({ weeks, goal, level, onApply }) => {
  if (weeks < 2) return null;
  let phases: Array<{ phase: string; weeks: number[] }> = [];
  try {
    const dist = distributePhases(weeks, 0, goal === 'powerlifting' ? 'strength' : 'bulk') || [];
    phases = dist.map((d) => ({ phase: d.phase, weeks: d.weeks || [] }));
  } catch { return null; }
  if (!phases.length) return null;
  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #60a5fa' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', marginBottom: 8 }}>📈 Авто-периодизация</div>
      <div style={{ display: 'flex', height: 20, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
        {phases.map((p, i) => {
          const c = pc[p.phase] || '#666';
          const w = p.weeks.length;
          return <div key={i} style={{ width: `${(w / weeks) * 100}%`, height: '100%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#000' }}>{w}н</div>;
        })}
      </div>
      {phases.map((p, i) => {
        const c = pc[p.phase] || '#666';
        const ws = Array.isArray(p.weeks) ? p.weeks : [];
        const range = ws.length > 0 ? `${ws[0]}–${ws[ws.length - 1]}` : '—';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', fontSize: 11 }}>
            <div style={{ width: 8, height: 8, borderRadius: 10, background: c, flexShrink: 0 }} />
            <span style={{ color: c, fontWeight: 700, minWidth: 100 }}>{PHASE_LABELS_SP[p.phase] || p.phase}</span>
            <span style={{ color: DIM }}>нед {range} ({ws.length} нед)</span>
          </div>
        );
      })}
      {onApply && (
        <button onClick={() => onApply(phases)} style={{ marginTop: 8, padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', fontWeight: 700, minHeight: 38, width: '100%' }}>
          🔧 Применить периодизацию
        </button>
      )}
    </div>
  );
};

export const ProgressionCoach: React.FC<PanelProps & { onCourse: boolean; courseIntensity: string }> = ({ program, dir, onCourse, courseIntensity }) => {
  if (dir !== 'bb' || !program.bb || program.bb.weeks.length < 2) return null;
  const prof = loadTrainingProfile();
  const strat = (program.bb.progression?.loadStrategy ?? 'double_progression') as 'double_progression' | 'linear' | 'wave' | 'rpe_based';
  const lastW = program.bb.weeks[program.bb.weeks.length - 1];
  if (!lastW) return null;
  const preds: Array<{ name: string; muscle: string; curW: number; curR: number; curRIR: number; nextW: number; nextR: number; nextRIR: number; label: string }> = [];
  try {
    for (const s of lastW.sessions) {
      for (const b of s.blocks) {
        if (!b.exerciseName || !b.sets[0]?.weight) continue;
        const c = b.sets[0];
        const cw = c.weight!;
        const cr = typeof c.reps === 'number' ? c.reps : 10;
        const crir = c.rir ?? 2;
        const wm = (prof.workMax ?? {})[b.muscle] ?? cw * 1.5;
        const pred = prescribeLoad(strat, cw, cr, crir, wm, lastW.week, program.bb.weeks.length, lastW.phase, b.type, b.role as 'primary' | 'accessory' | undefined);
        if (pred.nextWeight !== cw || pred.nextReps !== cr) preds.push({ name: b.exerciseName, muscle: b.muscle, curW: cw, curR: cr, curRIR: crir, nextW: pred.nextWeight, nextR: pred.nextReps, nextRIR: pred.nextRIR, label: pred.label });
      }
    }
  } catch { return null; }
  if (preds.length === 0) return null;
  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #22c55e' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', marginBottom: 6 }}>🧠 Тренер прогрессии ({strat})</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Предсказание недели {lastW.week + 1}:</div>
      {preds.slice(0, 8).map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', fontSize: 10, flexWrap: 'wrap' }}>
          <span style={{ color: DIM_STRONG, fontWeight: 700, minWidth: 100 }}>{p.name}</span>
          <span style={{ color: DIM }}>{p.curW}кг×{p.curR} RIR{p.curRIR}</span>
          <span style={{ color: '#22c55e', fontWeight: 700 }}>→</span>
          <span style={{ color: '#22c55e', fontWeight: 700 }}>{p.nextW}кг×{p.nextR} RIR{p.nextRIR}</span>
          <span style={{ fontSize: 11, color: DIM }}>{p.label}</span>
        </div>
      ))}
    </div>
  );
};
