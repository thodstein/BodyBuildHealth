import React, { useRef } from 'react';

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

const NAV_CARDS: { id: ScreenId; label: string; desc: string; nr: string }[] = [
  { id: 'profile', label: 'Профиль', desc: 'Настройки, антропометрия, цели', nr: '01' },
  { id: 'training', label: 'Тренировки', desc: 'План, дневник, упражнения', nr: '02' },
  { id: 'nutrition', label: 'Питание', desc: 'Дневник, КБЖУ, графики', nr: '03' },
  { id: 'articles', label: 'Статьи', desc: 'База знаний и руководства', nr: '04' },
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
          height: '40%',
          background: 'linear-gradient(to top, var(--bg) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 40%)',
          pointerEvents: 'none',
        }} />
      </div>

      <div style={{
        marginTop: -48,
        padding: '0 16px 24px',
        position: 'relative',
        zIndex: 2,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}>
          {NAV_CARDS.map((card, idx) => (
            <Card key={card.id} card={card} idx={idx} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
};

const Card: React.FC<{ card: typeof NAV_CARDS[number]; idx: number; onNavigate: Props['onNavigate'] }> = ({ card, idx, onNavigate }) => {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onClick={onNavigate ? () => onNavigate(card.id) : undefined}
      style={{
        position: 'relative',
        borderRadius: 20,
        padding: '22px 18px',
        cursor: 'pointer',
        transition: 'all 0.4s cubic-bezier(0.22, 0.68, 0, 1)',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.background = 'rgba(200, 245, 96, 0.04)';
        el.style.borderColor = 'rgba(200, 245, 96, 0.15)';
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.background = 'rgba(255, 255, 255, 0.02)';
        el.style.borderColor = 'rgba(255, 255, 255, 0.04)';
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = 'none';
      }}
    >
      {/* Decorative large number */}
      <div style={{
        position: 'absolute',
        right: 10,
        bottom: 4,
        fontSize: 56,
        fontWeight: 900,
        color: 'rgba(255, 255, 255, 0.02)',
        lineHeight: 1,
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        {card.nr}
      </div>

      {/* Accent line */}
      <div style={{
        width: 22,
        height: 2.5,
        background: 'var(--accent)',
        borderRadius: 2,
        marginBottom: 14,
        transition: 'width 0.3s ease',
      }}
        onMouseEnter={e => { e.currentTarget.style.width = '36px'; }}
        onMouseLeave={e => { e.currentTarget.style.width = '22px'; }}
      />

      {/* Label */}
      <div style={{
        fontWeight: 700,
        fontSize: 17,
        color: '#FFFFFF',
        letterSpacing: '-0.4px',
        marginBottom: 4,
        transition: 'color 0.3s ease',
        position: 'relative',
        zIndex: 1,
      }}>
        {card.label}
      </div>

      {/* Description */}
      <div style={{
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.35)',
        lineHeight: 1.4,
        letterSpacing: '0.1px',
        fontWeight: 400,
        position: 'relative',
        zIndex: 1,
      }}>
        {card.desc}
      </div>
    </div>
  );
};
