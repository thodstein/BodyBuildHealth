import React, { useState, useRef, useEffect, useCallback } from 'react';
import { registry } from './core/data/registry';
import { DashboardScreen } from './ui/screens/DashboardScreen';
import { PharmaScreen } from './ui/screens/PharmaScreen';
import { SupportScreen } from './ui/screens/SupportScreen';
import { PlanScreen } from './ui/screens/PlanScreen';
import { LabsScreen } from './ui/screens/LabsScreen';
import { RiskScreen } from './ui/screens/RiskScreen';
import { NutritionScreen } from './ui/screens/NutritionScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { CalculatorsScreen } from './ui/screens/CalculatorsScreen';
import { ToastContainer } from './ui/ToastContainer';

type Tab = 'home' | 'pharma' | 'training' | 'labs' | 'risks' | 'support' | 'nutrition' | 'profile' | 'calculators';

// Primary tabs shown in bottom nav (5 max for mobile)
const PRIMARY_NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Главная', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'labs', label: 'Анализы', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v7l5 8H4l5-8V3z"/><line x1="9" y1="3" x2="15" y2="3"/></svg> },
  { id: 'risks', label: 'Риски', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  { id: 'training', label: 'Тренировки', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11v11h-11z"/><path d="M3 12h3M18 12h3M12 3v3M12 18v3"/><circle cx="12" cy="12" r="2"/></svg> },
  { id: 'profile', label: 'Ещё', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg> },
];

function HulkBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 50%, rgba(0,230,138,0.04) 0%, transparent 60%)' }} />
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [showMore, setShowMore] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => { registry.init().then(() => setInitialized(true)); }, []);

  // Telegram back button integration
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.BackButton) {
      tg.BackButton.show();
      const handler = () => {
        if (tab !== 'home') {
          setTab('home');
          setShowMore(false);
        } else {
          tg.close();
        }
      };
      tg.BackButton.onClick(handler);
      return () => tg.BackButton.offClick(handler);
    }
  }, [tab]);

  const go = (t: Tab) => {
    setTab(t);
    setShowMore(false);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx)) return;
    const tabs: Tab[] = ['home', 'pharma', 'support', 'training', 'labs', 'risks', 'nutrition', 'profile'];
    const idx = tabs.indexOf(tab);
    const next = dx < 0 && idx < tabs.length - 1 ? tabs[idx + 1] : dx > 0 && idx > 0 ? tabs[idx - 1] : null;
    if (next) { go(next); }
    touchRef.current = null;
  }, [tab]);

  const renderContent = () => {
    if (!initialized) return (
      <div className="screen-loading">
        <div className="loading-spinner"/>
        <span>Загрузка...</span>
      </div>
    );

    switch (tab) {
      case 'home': return <DashboardScreen />;
      case 'pharma': return <PharmaScreen />;
      case 'support': return <SupportScreen />;
      case 'training': return <PlanScreen goal="energy" />;
      case 'labs': return <LabsScreen />;
      case 'risks': return <RiskScreen />;
      case 'nutrition': return <NutritionScreen />;
      case 'profile': return <ProfileScreen />;
      case 'calculators': return <CalculatorsScreen />;
      default: return <DashboardScreen />;
    }
  };

  return (
    <div className="app" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <HulkBg />
      <main ref={mainRef} style={{ position: 'relative', zIndex: 1 }}>
        {renderContent()}
      </main>
      <ToastContainer />
      <nav className="tabs">
        {PRIMARY_NAV.map(item => (
          <button
            key={item.id}
            className={'nav-btn' + (tab === item.id || (item.id === 'profile' && ['pharma', 'support', 'nutrition', 'calculators', 'profile'].includes(tab)) ? ' active' : '')}
            onClick={() => {
              if (item.id === 'profile') {
                if (tab !== 'profile' && !['pharma', 'support', 'nutrition', 'calculators'].includes(tab)) {
                  setShowMore(!showMore);
                }
                go('profile');
              } else {
                go(item.id);
              }
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {/* More menu overlay */}
      {showMore && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 150,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }} onClick={() => setShowMore(false)}>
          <div style={{
            position: 'fixed', bottom: 'calc(var(--bottom-nav-h, 64px) + env(safe-area-inset-bottom, 0px) + 8px)',
            left: '8px', right: '8px', zIndex: 151,
            background: 'var(--bg-secondary, #0d0d14)',
            borderRadius: '16px', padding: '12px',
            border: '1px solid var(--border, rgba(0,230,138,0.08))',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px',
          }} onClick={e => e.stopPropagation()}>
            {[
              { id: 'pharma' as Tab, label: '💊 Фарма', icon: '💊' },
              { id: 'support' as Tab, label: '🛡 Поддержка', icon: '🛡' },
              { id: 'nutrition' as Tab, label: '🍽 Питание', icon: '🍽' },
              { id: 'calculators' as Tab, label: '🔢 Калькуляторы', icon: '🔢' },
              { id: 'profile' as Tab, label: '👤 Профиль', icon: '👤' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { go(item.id); setShowMore(false); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '14px 8px', background: 'var(--bg-tertiary, #14141f)',
                  border: '1px solid var(--border, rgba(0,230,138,0.08))',
                  borderRadius: '12px', cursor: 'pointer', color: 'var(--text, #e8e8f0)',
                  fontSize: '11px', fontWeight: 600, gap: '4px',
                }}
              >
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <span>{item.label.replace(/^./, '')}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
