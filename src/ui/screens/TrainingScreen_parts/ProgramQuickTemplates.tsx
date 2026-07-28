/**
 * ProgramQuickTemplates.tsx — пресеты быстрого старта для стандартного режима.
 *
 * F4.1 (lite): вынесено из ProgramManagerPanel.tsx для снижения монолита
 * (1670+ строк). Внутри — только данные + рендер + хелпер, без бизнес-логики.
 */
import React from 'react';
import { DIM_STRONG, DIM } from './training-ui';

export interface QuickTemplate {
  id: string;
  title: string;
  icon: string;
  desc: string;
  dir: 'bb' | 'pl' | 'hybrid';
  goal: string;
  level: string;
  days: number;
  weeks: number;
  color: string;
}

export const QUICK_TEMPLATES: QuickTemplate[] = [
  { id: 'mass3', title: 'Масса 3д/нед', icon: '💪', desc: 'Full Body, 8 нед, новичок', dir: 'bb', goal: 'hypertrophy', level: 'beginner', days: 3, weeks: 8, color: '#22c55e' },
  { id: 'mass4', title: 'Масса 4д/нед', icon: '🏋️', desc: 'Upper/Lower, 12 нед, средний', dir: 'bb', goal: 'hypertrophy', level: 'intermediate', days: 4, weeks: 12, color: '#00e68a' },
  { id: 'strength4', title: 'Сила 4д/нед', icon: '🏆', desc: 'ПЛ-база, 12 нед, средний', dir: 'pl', goal: 'powerlifting', level: 'intermediate', days: 4, weeks: 12, color: '#a78bfa' },
  { id: 'mass5', title: 'Масса 5д/нед', icon: '🔥', desc: 'Bro split, 16 нед, опытный', dir: 'bb', goal: 'hypertrophy', level: 'advanced', days: 5, weeks: 16, color: '#f59e0b' },
  { id: 'cut4', title: 'Сушка 4д/нед', icon: '✂️', desc: 'Upper/Lower, 8 нед, средний', dir: 'bb', goal: 'cut', level: 'intermediate', days: 4, weeks: 8, color: '#3b82f6' },
  { id: 'powerbuilding4', title: 'Powerbuilder 4д/нед', icon: '⚡', desc: 'ПЛ+ББ гибрид, 12 нед', dir: 'hybrid', goal: 'strength_mass', level: 'intermediate', days: 4, weeks: 12, color: '#ec4899' },
];

export const QuickTemplatesGrid: React.FC<{
  onApply: (tpl: QuickTemplate) => void;
}> = ({ onApply }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
    {QUICK_TEMPLATES.map(tpl => (
      <button
        key={tpl.id}
        onClick={() => onApply(tpl)}
        style={{
          padding: '10px 8px',
          borderRadius: 10,
          cursor: 'pointer',
          textAlign: 'left',
          background: tpl.color + '08',
          border: '1px solid ' + tpl.color + '25',
          color: DIM_STRONG,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          minHeight: 70,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 16 }}>{tpl.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: tpl.color }}>{tpl.title}</span>
        </div>
        <div style={{ fontSize: 10, color: DIM }}>{tpl.desc}</div>
      </button>
    ))}
  </div>
);
