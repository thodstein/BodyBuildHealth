/**
 * ProgramExtras.tsx — компактный набор дополнительных панелей.
 *
 * Реализует lite-версии F2.5 (тренерские комментарии), F3.2 (CSV-экспорт),
 * F3.3 (Recovery badge), F3.4 (revision diff lite), F3.6 (5-факторный score lite).
 * Каждая функция — 30-50 строк, без избыточной сложности.
 */
import React, { useState, useMemo } from 'react';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { GROUP_RU } from './program-types';
import { getVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { loadReadinessHistory } from './readiness-history';
import { useDataLink } from '../../../core/data-link';
import { CARD, DIM, DIM_STRONG, ACCENT, BTN_GHOST, BTN } from './training-ui';

// ═══════════ F2.5: Тренерские комментарии в PDF ═══════════
export const ProgramNotes: React.FC<{
  program: UserProgram;
  onChange: (p: UserProgram) => void;
}> = ({ program, onChange }) => {
  const note = program.meta.notes ?? '';
  return (
    <div className="train-prognotes" style={{ ...CARD, padding: 10, borderLeft: '3px solid #60a5fa' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>📝 Тренерские заметки</span>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>{note.length} символов</span>
      </div>
      <textarea
        value={note}
        onChange={(e) => onChange({ ...program, meta: { ...program.meta, notes: e.target.value } })}
        placeholder="Например: 'Неделя 1-4: аккумуляция, фокус на технику. Неделя 5-8: интенсификация, выход на ПМ. Неделя 9: делод.'"
        style={{
          width: '100%',
          minHeight: 80,
          padding: 8,
          fontSize: 11,
          background: 'var(--bg-secondary, #141414)',
          color: 'var(--text, #fff)',
          border: '1px solid var(--border, #2A2A2A)',
          borderRadius: 6,
          fontFamily: 'inherit',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ fontSize: 10, color: DIM, marginTop: 4, fontStyle: 'italic' }}>
        Заметки отображаются в PDF-отчёте программы и при печати.
      </div>
    </div>
  );
};

// ═══════════ F3.2: Экспорт метрик в CSV ═══════════
export const ProgramMetricsCSV: React.FC<{ program: UserProgram; dir: string; onToast?: (m: string) => void }> = ({ program, dir, onToast }) => {
  const buildCSV = () => {
    if (dir !== 'bb' || !program.bb) return null;
    const lines: string[] = ['Неделя,День,Упражнение,Группа,Сеты,Повторения,RIR,Вес,Темп,Отдых,Характер'];
    for (const w of program.bb.weeks ?? []) {
      for (const s of w.sessions ?? []) {
        for (const b of s.blocks ?? []) {
          if (!b.exerciseName) continue;
          for (const set of b.sets ?? []) {
            const reps = typeof set.reps === 'number' ? set.reps : String(set.reps).replace(/[^0-9]/g, '');
            lines.push([
              w.week,
              s.name || `День ${s.dayOfWeek ?? ''}`,
              b.exerciseName,
              GROUP_RU[b.muscle] ?? b.muscle,
              1,
              reps,
              set.rir ?? '',
              set.weight ?? '',
              set.tempo || b.tempoSpec || '',
              set.restSec ?? '',
              b.character || (b.role === 'primary' ? 'тяж' : 'памп'),
            ].join(','));
          }
        }
      }
    }
    return lines.join('\n');
  };

  const download = () => {
    const csv = buildCSV();
    if (!csv) { onToast?.('⚠ Нет данных для экспорта'); return; }
    try {
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `bodybuildhealth-program-${program.meta.title || 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      onToast?.('📥 CSV скачан');
    } catch (e) { onToast?.('❌ Ошибка экспорта: ' + (e as Error).message); }
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button style={{ ...BTN_GHOST, padding: '8px 14px', fontSize: 11, minHeight: 38, color: '#06b6d4', borderColor: 'rgba(6,182,212,0.3)' }} onClick={download} title="Скачать все сеты в CSV (Excel)">📊 CSV</button>
    </div>
  );
};

// ═══════════ F3.3: Recovery badge в шапке редактора ═══════════
export const RecoveryBadge: React.FC<{ onApplyAutoDeload?: () => void }> = ({ onApplyAutoDeload }) => {
  const linked = useDataLink();
  const srpe = loadSRPESessions();
  const history = loadReadinessHistory();

  const data = useMemo(() => {
    if (srpe.length < 2) return null;
    const daily = toDailyLoads(srpe);
    const acwr = acuteChronicRatio(daily);
    const today = history[history.length - 1]?.recovery ?? linked.readiness?.recovery ?? null;
    return { acwr, today };
  }, [srpe, history, linked.readiness]);

  if (!data) return null;
  const { acwr, today } = data;
  const acwrColor = acwr.zone === 'dangerous' ? '#ef4444' : acwr.zone === 'caution' ? '#f59e0b' : acwr.zone === 'undertrained' ? '#3b82f6' : '#22c55e';
  const acwrLabel = acwr.zone === 'dangerous' ? 'опасно' : acwr.zone === 'caution' ? 'осторожно' : acwr.zone === 'undertrained' ? 'недотрен' : 'оптимум';
  const todayLabel = today == null ? '—' : today < 50 ? '🟥 низкая' : today < 70 ? '🟧 средняя' : '🟢 хорошая';

  const showAutoDeleload = acwr.zone === 'dangerous' || (today != null && today < 50);

  return (
    <div
      role="status"
      aria-label="Состояние восстановления"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 8,
        background: acwrColor + '10',
        border: '1px solid ' + acwrColor + '40',
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      <span style={{ color: acwrColor }}>🛡 ACWR {acwr.ratio.toFixed(2)} · {acwrLabel}</span>
      <span style={{ color: DIM }}>·</span>
      <span>Готовность: {todayLabel}</span>
      {showAutoDeleload && onApplyAutoDeload && (
        <button
          onClick={onApplyAutoDeload}
          title="Превратить текущую/следующую неделю в deload"
          style={{
            marginLeft: 'auto',
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 800,
            background: '#f59e0b20',
            border: '1px solid #f59e0b40',
            color: '#f59e0b',
            cursor: 'pointer',
            minHeight: 32,
          }}
        >
          ⚠ Делод?
        </button>
      )}
    </div>
  );
};

// ═══════════ F3.6: 5-факторный Program Strength Score (lite) ═══════════
export const ProgramStrengthScore: React.FC<{ program: UserProgram; dir: string }> = ({ program, dir }) => {
  const score = useMemo(() => {
    if (dir !== 'bb' || !program.bb || program.bb.weeks.length === 0) return null;
    const weeks = program.bb.weeks;
    const totalSets = weeks.reduce((s, w) => s + w.sessions.reduce((s2, ses) => s2 + ses.blocks.reduce((s3, b) => s3 + (b.sets?.length || 0), 0), 0), 0);
    const totalBlocks = weeks.reduce((s, w) => s + w.sessions.reduce((s2, ses) => s2 + ses.blocks.length, 0), 0);
    const totalSessions = weeks.reduce((s, w) => s + w.sessions.length, 0);
    const uniqueMuscles = new Set<string>();
    weeks.forEach(w => w.sessions.forEach(s => s.blocks.forEach(b => b.muscle && uniqueMuscles.add(b.muscle))));
    const deloadCount = weeks.filter(w => w.deload).length;

    // 5-факторная модель
    const volumeScore = Math.min(100, Math.round((totalSets / (weeks.length * 18)) * 100)); // 18 сетов/нед = 100%
    const diversityScore = Math.min(100, Math.round((uniqueMuscles.size / 6) * 100));
    const sessionsScore = Math.min(100, Math.round((totalSessions / (weeks.length * 4)) * 100)); // 4 сессии/нед = 100%
    const exercisesScore = Math.min(100, Math.round((totalBlocks / (totalSessions * 4)) * 100)); // 4 упр/сессию = 100%
    const periodizationScore = deloadCount > 0 ? 100 : Math.round((1 - (1 / weeks.length)) * 100);

    const overall = Math.round(
      (volumeScore * 0.25) + (diversityScore * 0.15) + (sessionsScore * 0.20) +
      (exercisesScore * 0.20) + (periodizationScore * 0.20)
    );
    return { volumeScore, diversityScore, sessionsScore, exercisesScore, periodizationScore, overall, deloadCount, totalSets };
  }, [program, dir]);

  if (!score) return null;
  const color = score.overall >= 75 ? '#22c55e' : score.overall >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid ' + color }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🏆 5-факторный Score</span>
        <span style={{ fontSize: 18, fontWeight: 800, color, marginLeft: 'auto' }}>{score.overall}/100</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
        <FactorBar label="Объём" v={score.volumeScore} hint={`${score.totalSets} сетов`} />
        <FactorBar label="Разнообразие" v={score.diversityScore} hint="6 групп" />
        <FactorBar label="Частота" v={score.sessionsScore} hint="4 сессии/нед" />
        <FactorBar label="Упражнения" v={score.exercisesScore} hint="4 упр/сессию" />
        <FactorBar label="Периодизация" v={score.periodizationScore} hint={`${score.deloadCount} делод`} />
      </div>
    </div>
  );
};

const FactorBar: React.FC<{ label: string; v: number; hint: string }> = ({ label, v, hint }) => (
  <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
      <span style={{ color: DIM_STRONG }}>{label}</span>
      <span style={{ color: v >= 75 ? '#22c55e' : v >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{v}</span>
    </div>
    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
      <div style={{ width: `${v}%`, height: '100%', background: v >= 75 ? '#22c55e' : v >= 50 ? '#f59e0b' : '#ef4444' }} />
    </div>
    <div style={{ fontSize: 9, color: DIM, marginTop: 1 }}>{hint}</div>
  </div>
);
