/**
 * editor-panels/diagnostics.tsx — панель диагностики и рекомендаций.
 * F4.6: вынесено из ProgramEditorPanels.tsx.
 */
import React from 'react';
import { CARD, DIM_STRONG, ACCENT } from '../training-ui';
import { GROUP_RU } from '../program-types';
import type { UserBlock } from '../../../../engines/user-program/user-program.types';
import { newId } from '../../../../engines/user-program/user-program.types';
import { computePlanQualityFor, muscleAwareSets, makeSetsFromTemplate, suggestExercisesForGroup } from '../../../../engines/manual-constructor';
import { loadTrainingProfile } from '../training-profile';
import type { PanelProps } from './shared';

export const PlanDiagnosticsPanel: React.FC<PanelProps> = ({ program, dir, onChange, showToast, labMrvMult }) => {
  if (!(dir === 'bb' && program.bb || dir === 'pl' && program.pl?.customWeeks)) return null;
  const prof = loadTrainingProfile();
  let q: ReturnType<typeof computePlanQualityFor> | null = null;
  try {
    q = computePlanQualityFor(program, program.meta.level, { onCourse: prof.onCourse ?? false, courseIntensity: prof.courseIntensity ?? 'moderate', labMult: labMrvMult });
  } catch { return null; }
  if (!q || q.perMuscle.length === 0) return null;

  const weak = q.perMuscle.filter(m => m.status === 'low');
  const overloaded = q.perMuscle.filter(m => m.status === 'over');
  const high = q.perMuscle.filter(m => m.status === 'high');
  const ok = q.perMuscle.filter(m => m.status === 'ok');
  const pctCalc = q.perMuscle.length >= 2 ? (() => {
    const pcts = q.perMuscle.map(p => ({ m: p.muscle, p: p.mrv > 0 ? (p.sets / p.mrv) * 100 : 0 }));
    return Math.max(...pcts.map(p => p.p)) - Math.min(...pcts.map(p => p.p));
  })() : 0;
  const barColor = q.score >= 75 ? '#22c55e' : q.score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid ' + barColor, background: 'linear-gradient(135deg, ' + barColor + '08, rgba(167,139,250,0.04))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🔬 Диагностика программы</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: barColor }}>{q.score}/100 {q.grade}</span>
        <div style={{ flex: 1, minWidth: 80, maxWidth: 120, background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
          <div style={{ width: q.score + '%', height: '100%', background: barColor, borderRadius: 6, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>{weak.length} недобор · {overloaded.length} перегруз · {high.length} зона · {ok.length} ок</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {q.perMuscle.map(pm => {
          const c = pm.status === 'over' ? '#ef4444' : pm.status === 'low' ? '#3b82f6' : pm.status === 'high' ? '#f59e0b' : '#22c55e';
          const icon = pm.status === 'over' ? '⚠' : pm.status === 'low' ? '⬇' : pm.status === 'high' ? '📈' : '✅';
          const pct = pm.mrv > 0 ? Math.round((pm.sets / pm.mrv) * 100) : 0;
          return <span key={pm.muscle} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: c + '18', border: '1px solid ' + c + '30', color: c }}>{icon} {GROUP_RU[pm.muscle] ?? pm.muscle} {pm.sets}/{pm.mrv}с ({pct}%)</span>;
        })}
      </div>

      {weak.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 6 }}>⬇ Недобор — добавить упражнения:</div>
          {weak.map(w => {
            const exs = suggestExercisesForGroup(w.muscle, program.meta.level, 3, (prof.equipment ?? []) as string[], [], [], prof.avoidAxialLoad ?? false, (prof.favoriteExercises ?? []) as string[], (prof.excludedExercises ?? []) as string[]);
            if (exs.length === 0) return null;
            return (
              <div key={w.muscle} style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: DIM_STRONG }}>{GROUP_RU[w.muscle] ?? w.muscle}: +{w.mev - Math.max(0, w.sets)} сетов до MEV={w.mev}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                  {exs.slice(0, 3).map((ex, i) => (
                    <button key={i} onClick={() => {
                      if (!program.bb?.weeks[0]?.sessions[0]) return;
                      const nb: UserBlock = { id: newId('blk'), type: 'accessory' as const, exerciseName: ex.name, muscle: w.muscle, role: 'accessory' as const, sets: makeSetsFromTemplate(muscleAwareSets(w.muscle, program.meta.level), (prof.workMax ?? {})[w.muscle] ?? 40) };
                      const upd = { ...program, bb: { ...program.bb!, weeks: program.bb!.weeks.map((wk, wi: number) => wi === 0 ? { ...wk, sessions: wk.sessions.map((s, si: number) => si === 0 ? { ...s, blocks: [...s.blocks, nb] } : s) } : wk) } };
                      onChange(upd);
                      showToast('✅ ' + ex.name + ' → ' + (GROUP_RU[w.muscle] ?? w.muscle));
                    }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6', fontWeight: 700, minHeight: 34 }}>+ {ex.name}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {overloaded.length > 0 && (
        <div style={{ marginBottom: 8, padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>⚠ Превышение MRV — снизьте объём:</div>
          {overloaded.map(o => (
            <div key={o.muscle} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{GROUP_RU[o.muscle] ?? o.muscle}: {o.sets} сетов {'>'} MRV {o.mrv} (−{o.sets - o.mrv} сетов)</div>
          ))}
        </div>
      )}

      {pctCalc >= 30 && (
        <div style={{ padding: 8, borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>⚖ Дисбаланс нагрузки ({Math.round(pctCalc)}%) — выровняйте объём между группами</div>
        </div>
      )}

      {q.issues.length > 0 && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4 }}>
          {q.issues.slice(0, 4).map((iss, i) => <div key={i} style={{ marginBottom: 2 }}>• {iss}</div>)}
        </div>
      )}
    </div>
  );
};
