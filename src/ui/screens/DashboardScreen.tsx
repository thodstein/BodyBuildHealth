import React from 'react';

type ScreenId =
  | 'dashboard' | 'pharma' | 'course' | 'peptides'
  | 'nutrition' | 'plan' | 'substances' | 'labs'
  | 'risks' | 'profile' | 'predictive' | 'marketplace'
  | 'articles' | 'assistant' | 'gamification'
  | 'fertility-pct' | 'reports' | 'integrations'
  | 'role-management' | 'support' | 'training';

interface Props {
  onNavigate?: (screen: ScreenId) => void;
}

const NAV_CARDS: { id: ScreenId; icon: string; label: string; desc: string }[] = [
  { id: 'profile', icon: '👤', label: 'Профиль', desc: 'Настройки, антропометрия, цели' },
  { id: 'training', icon: '🏋️', label: 'Тренировки', desc: 'План, дневник, упражнения' },
  { id: 'nutrition', icon: '🍎', label: 'Питание', desc: 'Дневник, КБЖУ, графики' },
  { id: 'articles', icon: '📚', label: 'Статьи', desc: 'База знаний и руководства' },
];

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  return (
    <div className="screen" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        position: 'relative',
        width: '100%',
        height: '60vh',
        overflow: 'hidden',
      }}>
        <img
          src="/hero-image.jpg"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 120,
          background: 'linear-gradient(to top, var(--bg) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />
      </div>

      <div style={{
        marginTop: -40,
        padding: '0 16px 24px',
        position: 'relative',
        zIndex: 2,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}>
          {NAV_CARDS.map(card => (
            <div
              key={card.id}
              onClick={onNavigate ? () => onNavigate(card.id) : undefined}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '20px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.boxShadow = '0 0 20px var(--accent-dim)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{
                fontSize: 32,
                lineHeight: 1,
                filter: 'drop-shadow(0 0 8px var(--accent-dim))',
              }}>
                {card.icon}
              </div>
              <div style={{
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--accent)',
                textShadow: '0 0 12px var(--accent-glow)',
              }}>
                {card.label}
              </div>
              <div style={{
                fontSize: 11,
                color: 'var(--text-dim)',
                textAlign: 'center',
                lineHeight: 1.4,
              }}>
                {card.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
