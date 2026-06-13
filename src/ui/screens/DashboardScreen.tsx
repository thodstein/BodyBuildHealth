import React, { useState } from 'react';

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

const ICONS: Record<string, string> = {
  profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  training: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4v12"/><path d="M6 20V4"/><path d="M2 20h20"/></svg>`,
  nutrition: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>`,
  articles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`,
};

const NAV_CARDS: { id: ScreenId; label: string; desc: string }[] = [
  { id: 'profile', label: 'Профиль', desc: 'Управляйте своими данными, целями и настройками' },
  { id: 'training', label: 'Тренировки', desc: 'Планируйте занятия, отслеживайте прогресс' },
  { id: 'nutrition', label: 'Питание', desc: 'Ведите дневник питания, контролируйте КБЖУ' },
  { id: 'articles', label: 'Статьи', desc: 'База знаний по фармакологии и здоровью' },
];

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
      <img src="/main-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
        <div style={{ marginBottom:16 }}>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#fff', margin:0, textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Главная</h1>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.85)', margin:'4px 0 0', textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
            Управляйте здоровьем, тренировками, питанием и фармакологией
          </p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {NAV_CARDS.map(card => (
            <Card key={card.id} card={card} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
};

const Card: React.FC<{ card: typeof NAV_CARDS[number]; onNavigate: Props['onNavigate'] }> = ({ card, onNavigate }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onNavigate ? () => onNavigate(card.id) : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: 18,
        padding: '18px 14px',
        cursor: 'pointer',
        transition: 'all 0.35s cubic-bezier(0.22, 0.68, 0, 1)',
        background: hovered
          ? 'rgba(30,32,40,0.45)'
          : 'rgba(20,22,30,0.35)',
        border: hovered ? '1px solid rgba(200,245,96,0.3)' : '1px solid rgba(255,255,255,0.08)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? '0 12px 40px rgba(0,0,0,0.4)' : 'none',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Icon */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: hovered ? 'rgba(200,245,96,0.12)' : 'rgba(200,245,96,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: hovered ? '#C8F560' : 'rgba(200,245,96,0.7)',
        flexShrink: 0,
        transition: 'all 0.3s ease',
      }}
        dangerouslySetInnerHTML={{ __html: ICONS[card.id] }}
      />

      {/* Label */}
      <div style={{
        fontWeight: 700,
        fontSize: 15,
        color: hovered ? '#C8F560' : 'rgba(255,255,255,0.95)',
        letterSpacing: '-0.3px',
        lineHeight: 1.2,
        transition: 'color 0.3s ease',
      }}>
        {card.label}
      </div>

      {/* Description */}
      <div style={{
        fontSize: 11,
        color: hovered ? 'rgba(255,255,255,0.75)' : 'rgba(255, 255, 255, 0.55)',
        lineHeight: 1.4,
        fontWeight: 400,
        transition: 'color 0.3s ease',
      }}>
        {card.desc}
      </div>

      {/* Hover arrow */}
      <div style={{
        position: 'absolute',
        right: hovered ? 10 : 12,
        bottom: 12,
        color: 'var(--accent)',
        fontSize: 16,
        fontWeight: 300,
        transition: 'all 0.3s ease',
        opacity: hovered ? 0.6 : 0,
      }}>
        →
      </div>
    </div>
  );
};
