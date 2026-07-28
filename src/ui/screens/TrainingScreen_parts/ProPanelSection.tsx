/**
 * ProPanelSection.tsx — collapsible обёртки для группировки pro-панелей.
 *
 * F2.1: 17 pro-панелей были плоским списком — тренер не понимал, какая
 * для чего. Теперь — 4 категории с раскрывающимися секциями (по умолчанию
 * раскрыты, состояние персистится в localStorage).
 *
 * UI: современное оформление — Apple-style glass-карточки, focus-ring для
 * accessibility, плавные transitions, light/dark theme через CSS-переменные.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface ProPanelSection {
  /** Уникальный id секции (для localStorage). */
  id: string;
  /** Заголовок секции (иконка + текст). */
  title: string;
  /** Краткое описание (для collapsed-state). */
  hint: string;
  /** Цвет акцента (borderLeft, заголовок). */
  color: string;
  /** Контент секции (рендерится при expanded). */
  content: React.ReactNode;
  /** Флаг: true если есть данные для показа. Если false — секция показывается как "пустая" с подсказкой. */
  hasData?: boolean;
}

const STORAGE_KEY = 'he_pro_sections_collapsed';
const STORAGE_THEME = 'he_app_theme';

function loadCollapsed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveCollapsed(state: Record<string, boolean>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

/** Применить тему к documentElement (для CSS variables в styles.css). */
function applyTheme(theme: 'dark' | 'light') {
  try {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch {}
}

export const ProPanelCollapsible: React.FC<{
  section: ProPanelSection;
  defaultExpanded?: boolean;
}> = ({ section, defaultExpanded = true }) => {
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(loadCollapsed);
  const collapsed = collapsedMap[section.id] ?? !defaultExpanded;
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | 'auto'>(collapsed ? 0 : 'auto');

  // Плавная анимация раскрытия
  useEffect(() => {
    if (collapsed) {
      setHeight(contentRef.current?.scrollHeight ?? 0);
      requestAnimationFrame(() => setHeight(0));
    } else {
      setHeight(contentRef.current?.scrollHeight ?? 0);
      const timer = setTimeout(() => setHeight('auto'), 220);
      return () => clearTimeout(timer);
    }
  }, [collapsed]);

  const toggle = useCallback(() => {
    setCollapsedMap(prev => {
      const next = { ...prev, [section.id]: !collapsed };
      saveCollapsed(next);
      return next;
    });
  }, [collapsed, section.id]);

  return (
    <div
      className="pro-panel-section"
      style={{
        marginBottom: 8,
        borderRadius: 14,
        border: '1px solid var(--card-border, rgba(255,255,255,0.06))',
        background: 'var(--card-bg, rgba(24,24,27,0.35))',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        overflow: 'hidden',
        boxShadow: 'var(--card-shadow, 0 4px 16px rgba(0,0,0,0.18))',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
    >
      <button
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-controls={`section-${section.id}-content`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'inherit',
          minHeight: 44, // WCAG AAA tap target
          transition: 'background 0.15s',
        }}
        onMouseDown={(e) => e.currentTarget.style.background = 'var(--hover-bg, rgba(255,255,255,0.04))'}
        onMouseUp={(e) => e.currentTarget.style.background = 'transparent'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 4,
            height: 18,
            borderRadius: 2,
            background: section.color,
            flexShrink: 0,
            boxShadow: `0 0 8px ${section.color}40`,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 800, color: section.color, flex: 1, letterSpacing: 0.1 }}>
          {section.title}
        </span>
        {section.hasData === false && (
          <span style={{ fontSize: 10, color: 'var(--text-faint, rgba(255,255,255,0.35))', padding: '2px 6px', borderRadius: 4, background: 'var(--hover-bg, rgba(255,255,255,0.04))' }}>нет данных</span>
        )}
        <span
          aria-hidden
          style={{
            fontSize: 10,
            color: 'var(--text-dim, rgba(255,255,255,0.5))',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'inline-block',
          }}
        >
          ▼
        </span>
      </button>
      <div
        ref={contentRef}
        id={`section-${section.id}-content`}
        style={{
          overflow: 'hidden',
          height: height === 'auto' ? 'auto' : `${height}px`,
          transition: 'height 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div style={{ padding: '4px 10px 10px' }}>
          {section.content}
        </div>
      </div>
    </div>
  );
};

/**
 * Группирует 17 pro-панелей в 4 категории:
 *  - Анализ плана: PlanDiagnostics, InteractiveVolume, AutoPeriodization, ProgressionCoach, TonnageEstimate
 *  - Обратная связь: LoadGuard, RIRCalibration, RealMRV, ReadinessForecast, CheckinGuard, WhatIfGuard
 *  - Техника: StickingPoint, Biomechanics, PlateAuto, ExerciseInfo
 *  - Инструменты: SplitConsultant, SubstitutionPanel
 */
export const ProPanelsGroup: React.FC<{ sections: ProPanelSection[] }> = ({ sections }) => {
  return (
    <div role="region" aria-label="Профессиональные панели" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {sections.map((s, i) => (
        <ProPanelCollapsible key={s.id} section={s} defaultExpanded={i === 0} />
      ))}
    </div>
  );
};

/** Кнопка переключения темы (light/dark) с accessibility. */
export const ThemeToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem(STORAGE_THEME) as 'dark' | 'light') || 'dark'; } catch { return 'dark'; }
  });

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(STORAGE_THEME, theme); } catch {}
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  return (
    <button
      onClick={toggle}
      aria-label={`Переключить тему (текущая: ${theme === 'dark' ? 'тёмная' : 'светлая'})`}
      title={`Тема: ${theme === 'dark' ? 'тёмная' : 'светлая'}`}
      style={{
        padding: compact ? '4px 8px' : '6px 12px',
        borderRadius: 8,
        fontSize: compact ? 11 : 12,
        fontWeight: 700,
        cursor: 'pointer',
        background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        border: '1px solid var(--card-border, rgba(255,255,255,0.12))',
        color: 'var(--text, #fff)',
        minHeight: 36,
        transition: 'background 0.15s, color 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span aria-hidden>{theme === 'dark' ? '🌙' : '☀️'}</span>
      <span>{theme === 'dark' ? 'Тёмная' : 'Светлая'}</span>
    </button>
  );
};
