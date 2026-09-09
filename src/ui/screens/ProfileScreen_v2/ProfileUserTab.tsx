/**
 * ProfileUserTab — вкладка "Пользователь" с 6 секциями.
 * Содержит sticky quick-jump для быстрой навигации по длинной форме.
 */
import React, { useState } from 'react';
import { UserPersonalSection } from './sections/UserPersonalSection';
import { UserHealthSection } from './sections/UserHealthSection';
import { UserDietSection } from './sections/UserDietSection';
import { UserLifestyleSection } from './sections/UserLifestyleSection';
import { UserPharmaSection } from './sections/UserPharmaSection';
import { UserGoalsSection } from './sections/UserGoalsSection';
import { TrainingProfileSection } from './sections/TrainingProfileSection';
import { TrainingPMSection } from './sections/TrainingPMSection';
import { TrainingWeakPointsSection } from './sections/TrainingWeakPointsSection';
import { colors, withAlpha } from './ui';
import { NativeIcon, type NativeIconName } from '../../native/NativeIcons';

const JUMP_LINKS: { id: string; icon: NativeIconName; label: string }[] = [
  { id: '1-1', icon: 'user', label: 'Основное' },
  { id: '1-2', icon: 'heart', label: 'Здоровье' },
  { id: '1-3', icon: 'leaf', label: 'Питание' },
  { id: '1-4', icon: 'wind', label: 'Образ жизни' },
  { id: '1-5', icon: 'droplet', label: 'Курс' },
  { id: '1-6', icon: 'target', label: 'Цели' },
  { id: '1-7', icon: 'dumbbell', label: 'Тренировки' },
  { id: '1-8', icon: 'award', label: 'Рекорды' },
  { id: '1-9', icon: 'trendingDown', label: 'Слабые стороны' },
];

const JUMP_COLORS: Record<string, string> = {
  '1-1': colors.primary,
  '1-2': colors.danger,
  '1-3': colors.green,
  '1-4': colors.purple,
  '1-5': colors.warning,
  '1-6': colors.orange,
  '1-7': colors.blue,
  '1-8': colors.teal,
  '1-9': colors.pink,
};

export const ProfileUserTab: React.FC = React.memo(function ProfileUserTab() {
  const [activeId, setActiveId] = useState('1-1');
  const handleJump = (id: string, btn?: HTMLElement | null) => {
    setActiveId(id);
    try {
      // Поднавигация обязана раскрывать целевой аккордеон: иначе клик по
      // закрытому разделу только скроллит к 68px-шапке и выглядит «не работает».
      window.dispatchEvent(new CustomEvent('profile-accordion-open', { detail: `profile-section-${id}` }));
      // Активную пилюлю довозим в видимую зону ленты (только горизонтально,
      // чтобы не дёргать вертикальный скролл).
      try {
        if (btn && typeof btn.scrollIntoView === 'function') {
          btn.scrollIntoView({ block: 'nearest', inline: 'center' } as ScrollIntoViewOptions);
        }
      } catch { /* не критично */ }
      // Скролл после раскрытия: аккордеон меняет layout в следующем кадре,
      // поэтому целимся дважды — сразу и после paint.
      const scrollToTarget = () => {
        const el = document.getElementById(`profile-section-${id}`);
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      scrollToTarget();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => window.setTimeout(scrollToTarget, 60));
      } else {
        window.setTimeout(scrollToTarget, 60);
      }
    } catch {
      // Старый WebView без smooth-scroll: активный раздел уже выставлен, скролл не критичен.
    }
  };
  const toggleAll = (open: boolean) => {
    window.dispatchEvent(new CustomEvent('profile-accordion-toggle', { detail: open }));
  };

  return (
    <div className="pf-user">
      {/* Sticky quick-jump — сегментированная лента */}
      <div
        className="profile-jump pf-jump"
        style={{
          position: 'sticky',
          top: -12,
          zIndex: 10,
          background: 'rgba(14,14,16,0.88)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          padding: '10px 12px 10px',
          margin: '-12px -12px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          className="profile-jump-row"
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            padding: '2px',
          }}
        >
          {JUMP_LINKS.map(link => {
            const c = JUMP_COLORS[link.id] || colors.primary;
            const active = activeId === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={e => handleJump(link.id, e.currentTarget)}
                aria-label={`Перейти к разделу ${link.label}`}
                aria-current={active ? 'true' : undefined}
                data-active={active}
                className="profile-jump-link pf-jump-link"
                style={{
                  flexShrink: 0,
                  padding: '8px 14px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: active ? 800 : 600,
                  border: `1px solid ${active ? c : 'rgba(255,255,255,0.10)'}`,
                  background: active ? `linear-gradient(135deg, ${withAlpha(c, '30')}, ${withAlpha(c, '12')})` : 'rgba(255,255,255,0.04)',
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  cursor: 'pointer',
                  minHeight: 40,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                  boxShadow: active ? `0 4px 16px ${withAlpha(c, '30')}, inset 0 1px 0 rgba(255,255,255,0.12)` : 'none',
                }}
              >
                <span aria-hidden="true" style={{ display:'inline-flex', color: active ? c : 'rgba(255,255,255,0.5)' }}><NativeIcon name={link.icon} size={13} /></span>
                {link.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pf-toggle-all" style={{ display: 'flex', gap: 8, marginBottom: 12, padding: 4, borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          type="button"
          onClick={() => toggleAll(true)}
          className="pf-toggle-btn"
          style={{
            flex: 1, minHeight: 44, borderRadius: 12, cursor: 'pointer',
            fontSize: 12.5, fontWeight: 800, color: '#06231a',
            background: 'linear-gradient(135deg, var(--profile-accent, #34d399), #22c55e)',
            border: '1px solid transparent',
            boxShadow: '0 4px 14px rgba(52,211,153,0.3), inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >⤢ Развернуть все</button>
        <button
          type="button"
          onClick={() => toggleAll(false)}
          className="pf-toggle-btn"
          style={{
            flex: 1, minHeight: 44, borderRadius: 12, cursor: 'pointer',
            fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.75)',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
          }}
        >⤡ Свернуть</button>
      </div>

      <div className="profile-user-sections pf-sections" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <UserPersonalSection />
        <UserHealthSection />
        <UserDietSection />
        <UserLifestyleSection />
        <UserPharmaSection />
        <UserGoalsSection />
        <TrainingProfileSection />
        <TrainingPMSection />
        <TrainingWeakPointsSection />
      </div>
    </div>
  );
});
