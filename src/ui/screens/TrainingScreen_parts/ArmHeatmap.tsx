/**
 * ArmHeatmap.tsx — тепловая карта для арм-плана (PRO).
 * Зеркало MesoHeatmap.tsx, но для 8 ключевых арм-групп.
 */
import React, { useMemo, useState } from 'react';
import { CARD, DIM, DIM_STRONG, ACCENT } from './training-ui';
import { getArmLandmarks } from '../../../engines/arm/arm-volume-landmarks.engine';
import type { ArmPlan } from '../../../engines/arm/arm-types';
import { ARM_MUSCLE_RU } from '../../../engines/arm/arm-types';

const ARM_MUSCLES = ['wrist_flexors','pronators','supinators','brachialis','risers','grip_support','grip_pinch','grip_crush','thumb','side_pressure','back_pressure','shoulder_stab'] as const;

export const ArmHeatmap: React.FC<{ plan: ArmPlan; onToast?: (msg: string) => void }> = ({ plan, onToast }) => {
  const [hoverCell, setHoverCell] = useState<{ m: string; w: number } | null>(null);

  const data = useMemo(() => {
    if (!plan || !plan.weeks) return null;
    const weeks = plan.weeks.length;
    if (weeks === 0) return null;
    const level = plan.level || 'intermediate';
    const lmByMuscle: Record<string, { mev: number; mav: number; mrv: number }> = {};
    for (const m of ARM_MUSCLES) {
      const lm = getArmLandmarks(level, m);
      lmByMuscle[m] = { mev: lm.mev, mav: lm.mav, mrv: lm.mrv };
    }
    const grid: Record<string, number[]> = {};
    for (const m of ARM_MUSCLES) grid[m] = Array(weeks).fill(0);
    for (let wi = 0; wi < weeks; wi++) {
      const wk = plan.weeks[wi];
      for (const sess of (wk as any).sessions ?? []) {
        for (const ex of sess.exercises ?? []) {
          const mus = ex.muscle as string;
          if ((ARM_MUSCLES as readonly string[]).includes(mus)) {
            grid[mus][wi] = (grid[mus][wi] || 0) + (ex.sets || 0);
          }
        }
      }
    }
    return { weeks, grid, lmByMuscle };
  }, [plan]);

  if (!data) return null;
  const { weeks, grid, lmByMuscle } = data;
  const cellW = 22;
  const cellH = 20;
  const labelW = 110;
  const svgW = labelW + cellW * weeks + 4;
  const svgH = cellH * ARM_MUSCLES.length + 16;

  const colorFor = (sets: number, lm: { mev: number; mav: number; mrv: number } | undefined) => {
    if (!lm || sets === 0) return 'rgba(255,255,255,0.04)';
    if (sets > lm.mrv) return 'rgba(239,68,68,0.7)';
    if (sets >= lm.mav) return 'rgba(245,158,11,0.7)';
    if (sets >= lm.mev) return 'rgba(34,197,94,0.5)';
    return 'rgba(96,165,250,0.4)';
  };

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #00e68a' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🔥 Тепловая карта — арм</span>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>{weeks} нед × {ARM_MUSCLES.length} групп</span>
      </div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>
        🟦 ниже MEV · 🟩 MEV→MAV · 🟧 MAV→MRV · 🟥 выше MRV. Клик — детали. Side_pressure MRV низкий (humerus). Tendon 12/16/18/22.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg width={svgW} height={svgH} style={{ display: 'block' }} viewBox={`0 0 ${svgW} ${svgH}`}>
          {Array.from({ length: weeks }, (_, wi) => (
            <text key={wi} x={labelW + cellW * (wi + 0.5)} y={10} fontSize="9" fill={DIM} textAnchor="middle">{wi + 1}</text>
          ))}
          {ARM_MUSCLES.map((m, mi) => {
            const lm = lmByMuscle[m];
            return (
              <g key={m}>
                <text x={labelW - 4} y={18 + cellH * mi + cellH * 0.6} fontSize="9" fill={DIM_STRONG} textAnchor="end">{ARM_MUSCLE_RU[m] ?? m}</text>
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
                        onClick={() => onToast?.(`${ARM_MUSCLE_RU[m] ?? m}, нед ${wi + 1}: ${sets} сетов${lm ? ` (MRV ${lm.mrv})` : ''}`)}
                        style={{ cursor: 'pointer' }}
                      />
                      <text x={labelW + cellW * (wi + 0.5)} y={14 + cellH * mi + cellH * 0.65} fontSize="8" fill={sets > 0 ? '#fff' : 'rgba(255,255,255,0.25)'} textAnchor="middle" pointerEvents="none">
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
          {ARM_MUSCLE_RU[hoverCell.m] ?? hoverCell.m} · нед {hoverCell.w + 1}: {grid[hoverCell.m]?.[hoverCell.w] ?? 0} сетов
          {lmByMuscle[hoverCell.m] && ` (MEV ${lmByMuscle[hoverCell.m]!.mev} MAV ${lmByMuscle[hoverCell.m]!.mav} MRV ${lmByMuscle[hoverCell.m]!.mrv})`}
        </div>
      )}
    </div>
  );
};
