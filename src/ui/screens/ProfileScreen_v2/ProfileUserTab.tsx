/**
 * ProfileUserTab — вкладка "Пользователь" с 6 секциями.
 * Содержит sticky quick-jump для быстрой навигации по длинной форме.
 */
import React from 'react';
import { UserPersonalSection } from './sections/UserPersonalSection';
import { UserHealthSection } from './sections/UserHealthSection';
import { UserDietSection } from './sections/UserDietSection';
import { UserLifestyleSection } from './sections/UserLifestyleSection';
import { UserPharmaSection } from './sections/UserPharmaSection';
import { UserGoalsSection } from './sections/UserGoalsSection';
import { TrainingProfileSection } from './sections/TrainingProfileSection';
import { TrainingPMSection } from './sections/TrainingPMSection';
import { TrainingWeakPointsSection } from './sections/TrainingWeakPointsSection';
import { colors } from './ui';

const JUMP_LINKS = [
  { id: '1-1', icon: '👤', label: 'Основное' },
  { id: '1-2', icon: '🩺', label: 'Здоровье' },
  { id: '1-3', icon: '🥗', label: 'Питание' },
  { id: '1-4', icon: '🌿', label: 'Образ жизни' },
  { id: '1-5', icon: '💉', label: 'Курс' },
  { id: '1-6', icon: '🎯', label: 'Цели' },
  { id: '1-7', icon: '🏋️', label: 'Тренировки' },
  { id: '1-8', icon: '🎖️', label: 'Рекорды' },
  { id: '1-9', icon: '📉', label: 'Слабые стороны' },
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
  const handleJump = (id: string) => {
    const el = document.getElementById(`profile-section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      {/* Sticky quick-jump */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(24,24,27,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '8px 0',
          marginBottom: 12,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            padding: '0 4px',
          }}
        >
          {JUMP_LINKS.map(link => {
            const c = JUMP_COLORS[link.id] || colors.primary;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleJump(link.id)}
                aria-label={`Перейти к разделу ${link.label}`}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 16,
                  fontSize: 11,
                  fontWeight: 600,
                  border: `1px solid ${c}55`,
                  background: `${c}12`,
                  color: c,
                  cursor: 'pointer',
                  minHeight: 32,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${c}26`;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${c}12`;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 12 }}>{link.icon}</span>
                {link.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
