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
  { id: '1-1', label: 'Основное' },
  { id: '1-2', label: 'Здоровье' },
  { id: '1-3', label: 'Питание' },
  { id: '1-4', label: 'Образ жизни' },
  { id: '1-5', label: 'Курс' },
  { id: '1-6', label: 'Цели' },
];

export const ProfileUserTab: React.FC = () => {
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
          background: 'rgba(28,28,32,0.95)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
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
          {JUMP_LINKS.map(link => (
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
                border: `1px solid ${colors.border}`,
                background: 'rgba(0,230,138,0.06)',
                color: colors.primary,
                cursor: 'pointer',
                minHeight: 32,
                whiteSpace: 'nowrap',
              }}
            >{link.label}</button>
          ))}
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
};
