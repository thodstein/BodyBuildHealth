/**
 * program-editor-context-panels.tsx — контекстные панели прямо в ProgramEditor.
 *
 * В отличие от калькуляторов-в-зоне "⚡ Интеллект" (BbToolsCard, PlWeakpointsCard,
 * VolumeOptimizerTab и т.п.), эти панели работают НА ТЕКУЩЕЙ редактируемой
 * программе: они не задают вопросы пользователю, а ВЫВОДЯТ её состояние:
 * текущий объём по группам, MRV-баланс, отсутствующие слабые группы.
 *
 * Это превращает "общие калькуляторы" в "панели для конструирования программ".
 */
import React, { useMemo } from 'react';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { GROUP_RU, ACCENT, DIM, SET_TEMPLATES } from './program-types';
import { getVolumeLandmarks } from '../../../engines/volume-landmarks.engine';

const DIM_STRONG = 'rgba(255,255,255,0.85)';
const CARD: React.CSSProperties = {
  background: 'rgba(24,24,27,0.5)',
  borderRadius: 12,
  padding: 10,
  border: '1px solid rgba(255,255,255,0.05)',
};

const MUSCLE_ORDER = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;

/** Сравнить текущие сеты с MRV/MAV по уровню. */
function compareWithLandmarks(level: string, current: number, muscle: string): { status: 'over' | 'high' | 'ok' | 'low' | 'u_meaning'; label: string; pct: number } {
  try {
    const lm = getVolumeLandmarks(level, muscle);
    if (!lm) return { status: 'u_meaning', label: 'нет ландмарок', pct: 0 };
    if (current > lm.mrv) return { status: 'over', label: `⚠ > MRV (${lm.mrv})`, pct: Math.round((current / lm.mrv) * 100) };
    if (current >= lm.mav) return { status: 'high', label: `🔶 MAV→${lm.mav} (MRV ${lm.mrv})`, pct: Math.round((current / lm.mav) * 100) };
    if (current >= lm.mev) return { status: 'ok', label: `✅ в MEV→MAV`, pct: Math.round((current / lm.mev) * 100) };
    return { status: 'low', label: `⬇ ниже MEV (${lm.mev})`, pct: Math.round((current / lm.mev) * 100) };
  } catch { return { status: 'u_meaning', label: 'ошибка ландмарок', pct: 0 }; }
}

/** ────────────────────────────────────────────────────────────────────────
 *  BBContextPanel: текущее состояние ББ-программы внутри ProgramEditor.
 *  Показывает: распределение MRV по группам, статус нагрузки, weak-point покрытие.
 *  Использует те же движки (calcBBPlanMetrics-style вычисления), но без UI-ввода.
 *  ──────────────────────────────────────────────────────────────────────── */
export const BbContextPanel: React.FC<{ program: UserProgram; level: string }> = ({ program, level }) => {
  const bb = program.bb;

  const weeklySetsByMuscle = useMemo(() => {
    if (!bb) return {};
    const out: Record<string, number> = {};
    for (const w of bb.weeks) {
      for (const s of w.sessions) {
        for (const b of s.blocks) {
          if (b.muscle) out[b.muscle] = (out[b.muscle] || 0) + b.sets.reduce((sum, set) => sum + (set.reps ? 1 : 0), 0);
        }
      }
    }
    return out;
  }, [bb]);

  const statusByMuscle = useMemo(() => {
    return MUSCLE_ORDER.map((g) => {
      const cur = weeklySetsByMuscle[g] || 0;
      const cmp = compareWithLandmarks(level, cur, g);
      return { muscle: g, current: cur, ...cmp, missing: 'weak' };
    }).filter((row) => row.current > 0 || ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'].includes(row.muscle));
  }, [weeklySetsByMuscle, level]);

  if (!bb) return null;

  const totalSets = Object.values(weeklySetsByMuscle).reduce((a, b) => a + b, 0);
  const ungrouped = Object.keys(weeklySetsByMuscle).filter((k) => !MUSCLE_ORDER.includes(k as any));

  const totalWeeks = bb.weeks.length;
  const totalSessions = bb.weeks.reduce((sum, w) => sum + w.sessions.length, 0);
  const compoundBlocks = bb.weeks.reduce((sum, w) => sum + w.sessions.reduce((s2, s) => s2 + s.blocks.filter((b) => b.type === 'compound').length, 0), 0);

  if (totalSessions === 0) {
    return (
      <div style={{ ...CARD, padding: 10, borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>📋 Текущая программа</div>
        <div style={{ fontSize: 11, color: DIM, marginTop: 4 }}>
          Нет ни одной сессии. Добавьте первую сессию и упражнения — панель покажет MRV-баланс и ссылки на инструменты.
        </div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 6, lineHeight: 1.5 }}>
          💡 Используйте кнопку <b>«⚡ Заполнить автоматически»</b> выше, чтобы получить черновик с подобранными упражнениями.
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '2px solid rgba(0,230,138,0.2)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>📋 Состояние ББ-программы</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6, marginBottom: 8 }}>
        <Mini label="Недели" value={totalWeeks} />
        <Mini label="Сессии" value={totalSessions} />
        <Mini label="Базовых" value={compoundBlocks} />
        <Mini label="Сетов/нед" value={totalSets} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {statusByMuscle.map((row) => (
          <div key={row.muscle} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
            <span style={{ fontSize: 10, color: DIM_STRONG, flex: '0 0 90px' }}>{GROUP_RU[row.muscle] ?? row.muscle}</span>
            <span style={{ flex: 1, fontSize: 10, color: row.status === 'over' ? '#ef4444' : row.status === 'low' ? '#3b82f6' : DIM_STRONG }}>{row.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: row.status === 'over' ? '#ef4444' : row.status === 'low' ? '#3b82f6' : ACCENT, minWidth: 28, textAlign: 'right' }}>{row.current} с</span>
          </div>
        ))}
        {ungrouped.length > 0 && (
          <div style={{ fontSize: 10, color: DIM, padding: '2px 6px', fontStyle: 'italic' }}>
            ⚠ Не сгруппированы: {ungrouped.map((u) => GROUP_RU[u] ?? u).join(', ')}
          </div>
        )}
      </div>

    </div>
  );
};

const Mini: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, textAlign: 'center' }}>
    <div style={{ fontSize: 11, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 800, color: DIM_STRONG }}>{value}</div>
  </div>
);
