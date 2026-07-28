/**
 * editor-panels/summary.tsx — сводная таблица плана (мобильная).
 * F4.6: вынесено из ProgramEditorPanels.tsx.
 */
import React, { useState } from 'react';
import { CARD, DIM, DIM_STRONG, ACCENT } from '../training-ui';
import { GROUP_RU } from '../program-types';
import type { UserProgram } from '../../../../engines/user-program/user-program.types';
import { PHASE_LABELS } from './shared';

const PHASE_LABELS_SP = PHASE_LABELS;
const CHAR_MAP: Record<string, string> = { 'тяж': '#ef4444', 'памп': '#3b82f6', 'лёг': '#6b7280' };

export const PlanSummaryTable: React.FC<{
  program: UserProgram;
  showWeek?: number;
  onShowWeekChange?: (w: number) => void;
}> = ({ program, showWeek = 1, onShowWeekChange }) => {
  const [expandedEx, setExpandedEx] = useState<string | null>(null);
  const body = program.bb;
  if (!body || !body.weeks || body.weeks.length === 0) return null;

  const week = body.weeks.find(w => w.week === showWeek) || body.weeks[0];
  const totalWeeks = body.weeks.length;
  const DAY_NAMES = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
  const phaseColors: Record<string, string> = { accumulation: '#22c55e', intensification: '#f59e0b', deload: '#ef4444', peaking: '#a78bfa' };

  return (
    <div style={{ ...CARD, padding: 12, borderLeft: '3px solid #00e68a' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>📋 План: {program.meta.title}</span>
          <span style={{ fontSize: 11, color: DIM, marginLeft: 8 }}>{totalWeeks} нед · {program.meta.daysPerWeek} дн/нед</span>
        </div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {body.weeks.map((w, i) => {
            const pc = phaseColors[w.phase] || '#666';
            return (
              <button key={i} onClick={() => onShowWeekChange?.(w.week)}
                style={{
                  padding: '5px 9px', borderRadius: 10, fontSize: 11, cursor: 'pointer', minHeight: 34, minWidth: 36,
                  background: showWeek === w.week ? pc + '20' : 'rgba(255,255,255,0.04)',
                  border: showWeek === w.week ? '1px solid ' + pc : '1px solid rgba(255,255,255,0.06)',
                  color: showWeek === w.week ? pc : DIM,
                  fontWeight: showWeek === w.week ? 700 : 400,
                }}>
                Н{w.week}{w.deload ? '🟢' : ''}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ fontSize: 11, color: DIM, marginBottom: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
        Фаза: <b style={{ color: phaseColors[week.phase] || '#fff' }}>{PHASE_LABELS_SP[week.phase] || week.phase}</b>
        {week.deload && <span style={{ color: '#22c55e', marginLeft: 6 }}>🟢 Разгрузка</span>}
      </div>
      {week.sessions.map((session, si) => {
        const totalSets = session.blocks.reduce((s, b) => s + b.sets.length, 0);
        return (
          <div key={si} style={{ marginBottom: 8, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(24,24,27,0.3)' }}>
            <div style={{ padding: '8px 12px', background: 'rgba(0,230,138,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>{DAY_NAMES[(session.dayOfWeek ?? si) % 7]} — {session.name || `День ${si + 1}`}</span>
              <span style={{ fontSize: 11, color: DIM }}>{session.focus || ''} · {totalSets} подх.{session.estimatedMin ? ` · ~${session.estimatedMin}м` : ''}</span>
            </div>
            {session.warmup && <div style={{ padding: '3px 12px', fontSize: 11, color: DIM, fontStyle: 'italic', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>🔥 {session.warmup}</div>}
            {session.cooldown && <div style={{ padding: '3px 12px', fontSize: 11, color: DIM, fontStyle: 'italic', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>🧊 {session.cooldown}</div>}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: DIM, fontWeight: 700 }}>
                <span style={{ flex: 1, minWidth: 100 }}>Упражнение</span>
                <span style={{ width: 52, textAlign: 'center' }}>Схема</span>
                <span style={{ width: 44, textAlign: 'center' }}>RIR</span>
                <span style={{ width: 52, textAlign: 'center' }}>Вес</span>
                <span style={{ width: 48, textAlign: 'center' }}>Темп</span>
                <span style={{ width: 44, textAlign: 'center' }}>Отдых</span>
                <span style={{ width: 44, textAlign: 'center' }}>Режим</span>
              </div>
              {session.blocks.map((block, bi) => {
                const exId = `${si}-${bi}`;
                const isExpanded = expandedEx === exId;
                const chars = (block.character || (block.role === 'primary' ? 'тяж' : 'памп'));
                const bs = block.sets;
                const reps = bs[0]?.reps ?? '—';
                const rir = bs[0]?.rir ?? '—';
                const wgt = bs[0]?.weight ? `${bs[0].weight}кг` : bs[0]?.pctOf1RM ? `${bs[0].pctOf1RM}%` : '—';
                const tmp = bs[0]?.tempo || block.tempoSpec || '—';
                const rst = bs[0]?.restSec ? `${bs[0].restSec}с` : '—';
                return (
                  <div key={exId}>
                    <div onClick={() => setExpandedEx(isExpanded ? null : exId)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', background: isExpanded ? 'rgba(0,230,138,0.06)' : 'transparent', fontSize: 12, transition: 'background 0.15s' }}>
                      <span style={{ flex: 1, minWidth: 100, fontWeight: 600, color: 'var(--text, #fff)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {block.exerciseName || <span style={{ color: DIM, fontStyle: 'italic' }}>Пусто</span>}
                        {block.role && block.role !== 'primary' && <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: DIM }}>{block.role === 'accessory' ? 'АКС' : block.role}</span>}
                      </span>
                      <span style={{ width: 52, textAlign: 'center', color: ACCENT }}>{bs.length}×{reps}</span>
                      <span style={{ width: 44, textAlign: 'center', color: (typeof rir === 'number' && rir <= 1) ? '#ef4444' : DIM_STRONG }}>R{rir}</span>
                      <span style={{ width: 52, textAlign: 'center', color: DIM_STRONG }}>{wgt}</span>
                      <span style={{ width: 48, textAlign: 'center', color: DIM }}>{tmp}</span>
                      <span style={{ width: 44, textAlign: 'center', color: DIM }}>{rst}</span>
                      <span style={{ width: 44, textAlign: 'center', fontSize: 11, fontWeight: 700, color: CHAR_MAP[chars] || DIM }}>{chars || block.type}</span>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,230,138,0.03)' }}>
                        {block.muscle && <div style={{ fontSize: 11, color: DIM }}>Мышца: <b style={{ color: DIM_STRONG }}>{GROUP_RU[block.muscle] || block.muscle}</b></div>}
                        {block.rationale && <div style={{ fontSize: 11, color: '#60a5fa' }}>📝 {block.rationale}</div>}
                        {block.note && <div style={{ fontSize: 11, color: '#f59e0b' }}>💬 {block.note}</div>}
                        {block.comment && <div style={{ fontSize: 11, color: DIM, fontStyle: 'italic' }}>{block.comment}</div>}
                        {block.repsRange && <div style={{ fontSize: 11, color: DIM }}>Диапазон: {block.repsRange}</div>}
                        {block.warmupSets && block.warmupSets.length > 0 && <div style={{ fontSize: 11, color: DIM }}>Разминка: {block.warmupSets.length} подх.</div>}
                        {bs.length > 1 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>{bs.map((set, si2) => <span key={si2} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM_STRONG }}>{set.reps}×R{set.rir}{set.weight ? `@${set.weight}кг` : ''}{set.note ? ` — ${set.note}` : ''}</span>)}</div>}
                        {(block as any).techniques && (block as any).techniques.length > 0 && (block as any).techniques[0] !== 'none' && <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 4 }}>🔧 {(block as any).techniques.map((t: string) => t.replace(/_/g, ' ')).join(', ')}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
