/**
 * PlanOutput.tsx — Единая библиотека карточек вывода тренировочных программ.
 * Используется ПЛ-авто (SRCBBScreen), ББ-авто (BbAutoConstructor) и ручным
 * конструктором (PlanDisplay) для консистентного, мобильного, frosted-glass вывода.
 *
 * Дизайн-токены: тёмный фон + зелёный акцент #00e68a, цвета фаз.
 */
import React from 'react';

export const ACCENT = '#00e68a';

export type PhaseKey = 'accumulation' | 'intensification' | 'peaking' | 'deload';

export const PHASE_COLORS: Record<PhaseKey, string> = {
  accumulation: '#22c55e',
  intensification: '#f59e0b',
  deload: '#60a5fa',
  peaking: '#ef4444',
};

export const PHASE_LABELS: Record<PhaseKey, string> = {
  accumulation: 'Аккумуляция',
  intensification: 'Интенсификация',
  deload: 'Разгрузка',
  peaking: 'Пик',
};

export interface PlanExerciseView {
  key: string;
  name: string;
  /** Роль для бейджа: compound/main, isolation/additional, accessory, прочее */
  role?: 'compound' | 'isolation' | 'accessory' | 'main' | 'additional' | string;
  /** Основная строка: "3×5 · 100 кг · 80%" */
  detail?: string;
  rir?: number | string;
  tempo?: string;
  rest?: string;
  /** Примечание (weak-point, замена по травме и т.п.) */
  note?: string;
  /** Подсветить левой акцентной рамкой (акцентная группа) */
  highlighted?: boolean;
  /** Кастомные действия справа/под упражнением (кнопки редактирования) */
  actions?: React.ReactNode;
  /** BB-характер: тяж/памп/лёг */
  character?: string;
  /** Целевая мышца */
  muscleTarget?: string;
  /** Инвентарь */
  equipment?: string;
  /** Обоснование выбора */
  rationale?: string;
  /** Подходов разминки */
  warmupSets?: number;
}

export interface PlanDayView {
  key: string;
  /** Заголовок дня: "День 1 · Грудь/Трицепс" */
  title: string;
  phase?: PhaseKey;
  /** Подзаголовок: "RIR 2-3 · 6-10 повт · темп 2-0-1" */
  metaLine?: string;
  /** Тег объёма: "18 сетов" / "12.4т · 142КПШ" */
  volumeTag?: string;
  exercises?: PlanExerciseView[];
  /** Кастомное тело (режим редактирования) — заменяет список упражнений */
  renderBody?: React.ReactNode;
  /** Действия в шапке дня (кнопки правки/добавления) */
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
}

function roleStyle(role?: string): { bg: string; fg: string } {
  switch (role) {
    case 'compound':
    case 'main':
      return { bg: 'rgba(0,230,138,0.12)', fg: '#00e68a' };
    case 'isolation':
    case 'additional':
      return { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' };
    case 'accessory':
      return { bg: 'rgba(168,85,247,0.12)', fg: '#a855f7' };
    default:
      return { bg: 'rgba(255,255,255,0.08)', fg: 'rgba(255,255,255,0.6)' };
  }
}

function roleLabel(role?: string): string {
  switch (role) {
    case 'compound': return 'БАЗ';
    case 'isolation': return 'ИЗО';
    case 'accessory': return 'АКС';
    case 'main': return 'ОСН';
    case 'additional': return 'ДОП';
    default: return '';
  }
}

const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span style={{
    fontSize: 11, fontWeight: 700, color, background: color + '22',
    padding: '3px 8px', borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap',
    minHeight: 28,
  }}>{label}</span>
);

const charColor = (c?: string): string => c === 'тяж' ? '#ef4444' : c === 'памп' ? '#3b82f6' : c === 'лёг' ? '#6b7280' : 'rgba(255,255,255,0.5)';

export const ExerciseRow: React.FC<{ ex: PlanExerciseView }> = ({ ex }) => {
  const rc = roleStyle(ex.role);
  const rl = roleLabel(ex.role);
  const hasMeta = ex.detail || ex.rir !== undefined && ex.rir !== '' || ex.tempo || ex.rest;
  const hasExtra = ex.character || ex.muscleTarget || ex.equipment;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 10px',
      border: '1px solid rgba(255,255,255,0.05)', marginBottom: 6,
      borderLeft: ex.highlighted ? `3px solid ${ACCENT}` : '3px solid transparent',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{ex.name}</span>
        <span style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap' }}>
          {ex.character && <Badge label={ex.character} color={charColor(ex.character)} />}
          {rl && <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, color: rc.fg, background: rc.bg, padding: '3px 8px', borderRadius: 6, minHeight: 28 }}>{rl}</span>}
        </span>
      </div>
      {hasExtra && (
        <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
          {ex.muscleTarget && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>🎯 {ex.muscleTarget}</span>}
          {ex.equipment && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>🏋️ {ex.equipment}</span>}
        </div>
      )}
      {hasMeta && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>{ex.detail}</span>
          <span style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap' }}>
            {ex.rir !== undefined && ex.rir !== '' && <Badge label={'RIR ' + ex.rir} color="#a855f7" />}
            {ex.tempo && <Badge label={ex.tempo} color="#a855f7" />}
            {ex.rest && <Badge label={ex.rest} color="rgba(255,255,255,0.5)" />}
          </span>
        </div>
      )}
      {ex.rationale && <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 3, lineHeight: 1.4 }}>📝 {ex.rationale}</div>}
      {ex.warmupSets && ex.warmupSets > 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>🔥 Разминка: {ex.warmupSets} подх.</div>}
      {ex.note && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4, lineHeight: 1.4 }}>{ex.note}</div>}
      {ex.actions && <div style={{ marginTop: 6 }}>{ex.actions}</div>}
    </div>
  );
};

export const DayCard: React.FC<{ day: PlanDayView }> = ({ day }) => {
  const phaseColor = day.phase ? PHASE_COLORS[day.phase] : ACCENT;
  return (
    <div style={{
      marginTop: 10, marginBottom: 4,
      background: 'rgba(20,22,28,0.55)',
      backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderLeft: `4px solid ${phaseColor}`,
      padding: 12,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{day.title}</span>
        {day.volumeTag && <span style={{ fontSize: 11, fontWeight: 700, color: phaseColor, background: phaseColor + '22', padding: '4px 10px', borderRadius: 10, flexShrink: 0, minHeight: 28 }}>{day.volumeTag}</span>}
      </div>
      {day.metaLine && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 8, lineHeight: 1.4 }}>{day.metaLine}</div>}
      {day.headerActions && <div style={{ marginBottom: 8 }}>{day.headerActions}</div>}
      {day.renderBody
        ? day.renderBody
        : <div>{day.exercises?.map(ex => <ExerciseRow key={ex.key} ex={ex} />)}</div>}
      {day.footer && <div style={{ marginTop: 8 }}>{day.footer}</div>}
    </div>
  );
};

/** Полоса фазы с цветом и подсказкой */
export const PhaseBanner: React.FC<{ phase: PhaseKey; desc?: string }> = ({ phase, desc }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10,
    background: PHASE_COLORS[phase] + '14', border: `1px solid ${PHASE_COLORS[phase]}33`, marginBottom: 8,
  }}>
    <span style={{ width: 10, height: 10, borderRadius: 5, background: PHASE_COLORS[phase], flexShrink: 0 }} />
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
      <b style={{ color: PHASE_COLORS[phase] }}>{PHASE_LABELS[phase]}</b>{desc ? ' — ' + desc : ''}
    </div>
  </div>
);

/** Сетка выбора недель (кликабельные номера) */
export const WeekStrip: React.FC<{
  weeks: number; phaseForWeek: (w: number) => PhaseKey; activeWeek: number; onPick: (w: number) => void;
}> = ({ weeks, phaseForWeek, activeWeek, onPick }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))', gap: 4 }}>
    {Array.from({ length: weeks }, (_, i) => {
      const w = i + 1; const ph = phaseForWeek(w); const active = w === activeWeek;
      return (
        <button key={w} onClick={() => onPick(w)} title={'Неделя ' + w}
          style={{
            padding: '8px 0', borderRadius: 8, cursor: 'pointer', minHeight: 38, fontSize: 11, fontWeight: 700,
            border: active ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
            background: active ? PHASE_COLORS[ph] : PHASE_COLORS[ph] + '1a',
            color: active ? '#000' : '#fff',
          }}>{w}</button>
      );
    })}
  </div>
);
