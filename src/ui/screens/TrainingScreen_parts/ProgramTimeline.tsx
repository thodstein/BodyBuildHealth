/**
 * ProgramTimeline.tsx — F1: Compact horizontal timeline heatmap for program overview.
 *
 * Rows = muscle groups, columns = weeks, cell color = volume (sets per week).
 * Gives instant visual overview of volume distribution and progression.
 */
import React, { useMemo } from 'react';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { GROUP_RU } from './program-types';
import { ACCENT, DIM, DIM_STRONG } from './training-ui';

interface Props {
  program: UserProgram;
  selectedWeek?: number;
  onSelectWeek?: (wi: number) => void;
}

const MUSCLE_ORDER = ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'biceps', 'triceps', 'calves', 'core', 'glutes', 'traps', 'forearms'];

function volumeColor(sets: number, max: number): string {
  if (sets === 0) return 'rgba(255,255,255,0.02)';
  const ratio = Math.min(1, sets / Math.max(1, max));
  if (ratio < 0.25) return `rgba(59,130,246,${0.15 + ratio * 0.3})`;
  if (ratio < 0.5) return `rgba(0,230,138,${0.15 + ratio * 0.4})`;
  if (ratio < 0.75) return `rgba(245,158,11,${0.15 + ratio * 0.4})`;
  return `rgba(239,68,68,${0.2 + ratio * 0.4})`;
}

export const ProgramTimeline: React.FC<Props> = ({ program, selectedWeek, onSelectWeek }) => {
  const data = useMemo(() => {
    const weeks = program.bb?.weeks ?? [];
    if (weeks.length === 0) return null;

    const muscleSet = new Set<string>();
    weeks.forEach(w => w.sessions.forEach(s => s.blocks.forEach(b => { if (b.muscle) muscleSet.add(b.muscle); })));
    const muscles = MUSCLE_ORDER.filter(m => muscleSet.has(m));
    if (muscles.length === 0) return null;

    const grid: Record<string, number[]> = {};
    muscles.forEach(m => { grid[m] = new Array(weeks.length).fill(0); });

    let maxSets = 0;
    weeks.forEach((w, wi) => {
      const perMuscle: Record<string, number> = {};
      w.sessions.forEach(s => s.blocks.forEach(b => {
        if (b.muscle && b.sets) {
          perMuscle[b.muscle] = (perMuscle[b.muscle] ?? 0) + b.sets.length;
        }
      }));
      muscles.forEach(m => {
        grid[m][wi] = perMuscle[m] ?? 0;
        if (perMuscle[m] > maxSets) maxSets = perMuscle[m];
      });
    });

    return { weeks, muscles, grid, maxSets: Math.max(1, maxSets) };
  }, [program]);

  if (!data) return null;

  const { weeks, muscles, grid, maxSets } = data;
  const cellW = Math.max(20, Math.min(48, 320 / weeks.length));
  const labelW = 70;

  return (
    <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(26,28,38,0.4)', border: '1px solid rgba(255,255,255,0.06)', margin: '8px 0' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        📊 Timeline объёма
        <span style={{ fontSize: 10, color: DIM, fontWeight: 500 }}>({weeks.length} нед · {muscles.length} групп)</span>
      </div>

      {/* Неделя headers */}
      <div style={{ display: 'flex', marginBottom: 4 }}>
        <div style={{ width: labelW, flexShrink: 0 }} />
        {weeks.map((w, wi) => (
          <div
            key={wi}
            onClick={() => onSelectWeek?.(wi)}
            style={{
              width: cellW, flexShrink: 0, textAlign: 'center',
              fontSize: 9, color: selectedWeek === wi ? ACCENT : DIM,
              fontWeight: selectedWeek === wi ? 800 : 500,
              cursor: onSelectWeek ? 'pointer' : 'default',
              padding: '2px 0',
            }}
          >
            {w.week}
            {w.deload && <span style={{ color: '#f59e0b' }}>•</span>}
          </div>
        ))}
      </div>

      {/* Muscle rows */}
      {muscles.map(m => (
        <div key={m} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
          <div style={{ width: labelW, flexShrink: 0, fontSize: 9, color: DIM_STRONG, fontWeight: 600, textAlign: 'right', paddingRight: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {GROUP_RU[m] ?? m}
          </div>
          {weeks.map((_, wi) => {
            const sets = grid[m][wi];
            return (
              <div
                key={wi}
                onClick={() => onSelectWeek?.(wi)}
                style={{
                  width: cellW, height: 18, flexShrink: 0,
                  background: volumeColor(sets, maxSets),
                  borderRadius: 3, margin: '0 1px',
                  cursor: onSelectWeek ? 'pointer' : 'default',
                  border: selectedWeek === wi ? `1.5px solid ${ACCENT}` : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 700,
                  color: sets > 0 ? (sets / maxSets > 0.5 ? '#fff' : DIM_STRONG) : 'transparent',
                  transition: 'background 0.15s',
                }}
                title={`${GROUP_RU[m] ?? m}, нед ${weeks[wi].week}: ${sets} сетов`}
              >
                {sets > 0 ? sets : ''}
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 9, color: DIM }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: volumeColor(1, 4), display: 'inline-block' }} /> низкий
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: volumeColor(3, 4), display: 'inline-block' }} /> средний
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: volumeColor(4, 4), display: 'inline-block' }} /> высокий
        </span>
        <span style={{ color: '#f59e0b' }}>• = deload</span>
      </div>
    </div>
  );
};