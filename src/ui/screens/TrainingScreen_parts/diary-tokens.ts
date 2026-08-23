/** diary-tokens.ts — общие визуальные токены тренировочного дневника.
 *  Единый источник для GRP_RU/GROUP_COLORS и базовых стилей хаба дневника. */
import React from 'react';

export const ACCENT = '#00e68a';
export const DIM = 'rgba(255,255,255,0.85)';

export const GRP_RU: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки',
  core: 'Кор', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы', calves: 'Икры',
  triceps: 'Трицепс', biceps: 'Бицепс', quads: 'Квадрицепсы',
};

export const GROUP_COLORS: Record<string, string> = {
  chest: '#00e68a', back: '#60a5fa', legs: '#f59e0b', shoulders: '#a855f7',
  arms: '#ef4444', core: '#22c55e', hamstrings: '#3b82f6', glutes: '#ec4899',
  calves: '#eab308', triceps: '#fb923c', biceps: '#f472b6', quads: '#facc15',
};

export const diaryCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: 'rgba(24,24,27,0.12)',
  border: '1px solid rgba(255,255,255,0.04)',
  marginBottom: 8,
};

export const diaryLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#fff',
  fontWeight: 500,
  letterSpacing: '0.3px',
  textTransform: 'uppercase',
  marginBottom: 8,
};

export const diaryInput: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  fontSize: 12,
  boxSizing: 'border-box' as any,
  outline: 'none',
};

export const diaryBtn: React.CSSProperties = {
  width: '100%',
  padding: 9,
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  background: 'linear-gradient(135deg,var(--accent),#00cc7a)',
  color: '#000',
  fontWeight: 700,
  fontSize: 12,
};

/** Общий объект стилей карточек дневника (канон для вынесенных компонентов). */
export const diaryStyles: Record<string, React.CSSProperties> = {
  card: { padding: 12, borderRadius: 14, background: 'rgba(24,24,27,0.12)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 },
  label: { fontSize: 10, color: '#fff', fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 8 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 12, boxSizing: 'border-box' as any, outline: 'none', transition: 'border-color .15s, box-shadow .15s' },
  btn: { width: '100%', padding: 9, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--accent),#00cc7a)', color: '#000', fontWeight: 700, fontSize: 12 },
};
