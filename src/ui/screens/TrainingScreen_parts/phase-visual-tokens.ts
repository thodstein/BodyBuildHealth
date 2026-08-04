/**
 * phase-visual-tokens.ts — общие визуальные токены фаз для
 * MacrocyclePanel и PeriodizationDesignerTab.
 *
 * Раньше каждый файл определял свои цвета/иконки/лейблы фаз
 * независимо, что приводило к расхождениям. Теперь оба экрана
 * используют единый источник.
 */

// PL-макроцикл (5 фаз)
export const PL_PHASE_VISUAL = {
  endurance:   { color: '#22c55e', icon: '🏃', label: 'Выносливость' },
  strength:    { color: '#3b82f6', icon: '🏋️', label: 'Силовой' },
  peak:        { color: '#f59e0b', icon: '⛰️', label: 'Выход на пик' },
  competition: { color: '#ef4444', icon: '🏁', label: 'Соревнования' },
  transition:  { color: '#71717a', icon: '🧘', label: 'Переход' },
} as const;

// BB-макроцикл (4 фазы)
export const BB_PHASE_VISUAL = {
  hypertrophy:   { color: '#22c55e', icon: '💪', label: 'Гипертрофия' },
  strength:      { color: '#3b82f6', icon: '🏋️', label: 'Сила' },
  contest_prep:  { color: '#f59e0b', icon: '🎯', label: 'Подготовка' },
  transition:    { color: '#71717a', icon: '🧘', label: 'Переход' },
} as const;

// Designer фазы (10 ключей)
export const DESIGNER_PHASE_VISUAL = {
  accumulation_hypertrophy: { color: '#3b82f6', icon: '💪', label: 'Накопление (гипертрофия)' },
  accumulation_strength:   { color: '#2563eb', icon: '🏋️', label: 'Накопление (сила)' },
  intensification:         { color: '#ef4444', icon: '🔥', label: 'Интенсификация' },
  peaking:                 { color: '#f59e0b', icon: '⚡', label: 'Пик' },
  deload:                  { color: '#00e68a', icon: '🧘', label: 'Разгрузка' },
  technique:               { color: '#a855f7', icon: '🎯', label: 'Технический блок' },
  conditioning:            { color: '#ec4899', icon: '🏃', label: 'Кондиционный блок' },
  power:                   { color: '#f97316', icon: '💥', label: 'Мощностной блок' },
  gpp:                     { color: '#6366f1', icon: '🔄', label: 'GPP (общая подготовка)' },
  transition:              { color: '#6b7280', icon: '⏸', label: 'Переходный период' },
} as const;

/** Приоритет соревнования → визуальный токен */
export const COMPETITION_PRIORITY_VISUAL = {
  A: { color: '#ef4444', icon: '🔴', label: 'Главное' },
  B: { color: '#f59e0b', icon: '🟡', label: 'Контрольное' },
  C: { color: '#a78bfa', icon: '🟣', label: 'Тренировочное' },
} as const;