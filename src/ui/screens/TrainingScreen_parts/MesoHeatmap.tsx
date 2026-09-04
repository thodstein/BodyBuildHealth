/**
 * MesoHeatmap.tsx — тепловая карта мезоцикла (F2.4).
 *
 * Показывает объём по группам мышц × неделям в виде цветовой сетки.
 * Цвет: зелёный (ок) → жёлтый (высокий) → красный (перегруз).
 * Кликабельная ячейка → toast с деталями.
 */
import React, { useMemo, useState } from 'react';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { GROUP_RU } from './program-types';
import { getVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { CARD, DIM, DIM_STRONG, ACCENT } from './training-ui';

const MUSCLES = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;

export const MesoHeatmap: React.FC<{ program: UserProgram; dir: string; onToast?: (msg: string) => void }> = ({ program, dir, onToast }) => {
  const [hoverCell, setHoverCell] = useState<{ m: string; w: number } | null>(null);

  const data = useMemo(() => {
    if (dir !== 'bb' || !program.bb) return null;
    const level = program.meta.level;
    // Сетов по каждой мышце в каждой неделе
    const weeks = program.bb.weeks;
    if (weeks.length === 0) return null;
    const lmByMuscle: Record<string, { mev: number; mav: number; mrv: number }> = {};
    for (const m of MUSCLES) {
      const lm = getVolumeLandmarks(level, m);
      if (lm) lmByMuscle[m] = { mev: lm.mev, mav: lm.mav, mrv: lm.mrv };
    }
    const grid: Record<string, number[]> = {};
    for (const m of MUSCLES) grid[m] = weeks.map(() => 0);
    for (let wi = 0; wi < weeks.length; wi++) {
      for (const s of weeks[wi].sessions ?? []) {
        for (const b of s.blocks ?? []) {
          if (!b.muscle) continue;
          grid[b.muscle] = grid[b.muscle] || [];
          grid[b.muscle][wi] = (grid[b.muscle][wi] || 0) + (b.sets?.length || 0);
        }
      }
    }
    return { weeks: weeks.length, grid, lmByMuscle };
  }, [program, dir]);

  if (!data) return null;
  const { weeks, grid, lmByMuscle } = data;
  const cellW = 22;
  const cellH = 22;
  const labelW = 70;
  const svgW = labelW + cellW * weeks + 4;
  const svgH = cellH * MUSCLES.length + 8;

  const colorFor = (sets: number, lm: { mev: number; mav: number; mrv: number } | undefined) => {
    if (!lm || sets === 0) return 'rgba(255,255,255,0.04)';
    if (sets > lm.mrv) return 'rgba(239,68,68,0.7)'; // over
    if (sets >= lm.mav) return 'rgba(245,158,11,0.7)'; // high
    if (sets >= lm.mev) return 'rgba(34,197,94,0.5)'; // ok
    return 'rgba(96,165,250,0.4)'; // under
  };

  return (
    <div className="train-mesoheatmap" style={{ ...CARD, padding: 10, borderLeft: '3px solid #f59e0b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🔥 Тепловая карта мезоцикла</span>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>{weeks} нед × 6 мышц</span>
      </div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>
        Цвет: 🟦 недобор (ниже MEV) · 🟩 ок (MEV→MAV) · 🟧 высокий (MAV→MRV) · 🟥 перегруз (выше MRV). Клик — детали.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg width={svgW} height={svgH} style={{ display: 'block' }} viewBox={`0 0 ${svgW} ${svgH}`}>
          {/* Метки недель сверху */}
          {Array.from({ length: weeks }, (_, wi) => (
            <text key={wi} x={labelW + cellW * (wi + 0.5)} y={6} fontSize="9" fill={DIM} textAnchor="middle">{wi + 1}</text>
          ))}
          {/* Строки мышц */}
          {MUSCLES.map((m, mi) => {
            const lm = lmByMuscle[m];
            return (
              <g key={m}>
                <text x={labelW - 4} y={16 + cellH * mi + cellH * 0.7} fontSize="10" fill={DIM_STRONG} textAnchor="end">{GROUP_RU[m] ?? m}</text>
                {Array.from({ length: weeks }, (_, wi) => {
                  const sets = grid[m]?.[wi] ?? 0;
                  const c = colorFor(sets, lm);
                  const isHover = hoverCell?.m === m && hoverCell?.w === wi;
                  return (
                    <g key={wi}>
                      <rect
                        x={labelW + cellW * wi}
                        y={14 + cellH * mi}
                        width={cellW - 1}
                        height={cellH - 1}
                        rx={2}
                        fill={c}
                        stroke={isHover ? '#fff' : 'transparent'}
                        strokeWidth={isHover ? 1.5 : 0}
                        onMouseEnter={() => setHoverCell({ m, w: wi })}
                        onMouseLeave={() => setHoverCell(null)}
                        onClick={() => onToast?.(`${GROUP_RU[m] ?? m}, нед ${wi + 1}: ${sets} сетов${lm ? ` (MRV ${lm.mrv})` : ''}`)}
                        style={{ cursor: 'pointer' }}
                      />
                      <text
                        x={labelW + cellW * (wi + 0.5)}
                        y={14 + cellH * mi + cellH * 0.7}
                        fontSize="8"
                        fill={sets > 0 ? '#fff' : 'rgba(255,255,255,0.25)'}
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        {sets > 0 ? sets : ''}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      {hoverCell && (
        <div style={{ fontSize: 10, color: 'var(--text-light, #fff)', marginTop: 4, fontFamily: 'monospace' }}>
          {GROUP_RU[hoverCell.m] ?? hoverCell.m} · нед {hoverCell.w + 1}: {grid[hoverCell.m]?.[hoverCell.w] ?? 0} сетов
          {lmByMuscle[hoverCell.m] && ` (MRV ${lmByMuscle[hoverCell.m]!.mrv})`}
        </div>
      )}
    </div>
  );
};
