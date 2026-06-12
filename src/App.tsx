import React, { useState, useRef, useEffect, useCallback } from 'react';
import { registry } from './core/data/registry';
import { DashboardScreen } from './ui/screens/DashboardScreen';
import { PharmaScreen } from './ui/screens/PharmaScreen';
import { SupportScreen } from './ui/screens/SupportScreen';
import { TrainingScreen } from './ui/screens/TrainingScreen';
import { LabsScreen } from './ui/screens/LabsScreen';
import { RiskScreen } from './ui/screens/RiskScreen';
import { NutritionScreen } from './ui/screens/NutritionScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { ArticlesScreen } from './ui/screens/ArticlesScreen';

import { ToastContainer } from './ui/ToastContainer';

type Tab = 'home' | 'pharma' | 'training' | 'labs' | 'risks' | 'support' | 'nutrition' | 'profile' | 'articles';

// Bottom nav: 5 primary tabs
const PRIMARY_NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Главная', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'labs', label: 'Анализы', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v7l5 8H4l5-8V3z"/><line x1="9" y1="3" x2="15" y2="3"/></svg> },
  { id: 'risks', label: 'Риски', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  { id: 'pharma', label: 'Фарма', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
  { id: 'support', label: 'Поддержка', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> },
];

function DarkBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 50%, rgba(200,245,96,0.03) 0%, transparent 60%)' }} />
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [initialized, setInitialized] = useState(false);
  // touchRef removed
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => { registry.init().then(() => setInitialized(true)); }, []);

  // Telegram Mini App viewport and theme
  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        if (typeof tg.expand === 'function') tg.expand();
        if (typeof tg.enableClosingConfirmation === 'function') tg.enableClosingConfirmation();
        document.documentElement.style.setProperty('--tg-safe-top', (tg.safeAreaInsetTop || 0) + 'px');
        document.documentElement.style.setProperty('--tg-safe-bottom', (tg.safeAreaInsetBottom || 0) + 'px');
        if (tg.colorScheme === 'dark') {
          document.documentElement.style.setProperty('--tg-bg', tg.themeParams.bg_color || '#050508');
          document.documentElement.style.setProperty('--tg-text', tg.themeParams.text_color || '#e8e8f0');
        }
      }
    } catch (e) {
      console.warn('[App] TG viewport init failed:', e);
    }
  }, []);

  // Telegram back button integration
  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.BackButton) {
        if (typeof tg.BackButton.show === 'function') tg.BackButton.show();
        const handler = () => {
          if (tab !== 'home') {
            setTab('home');
          } else if (typeof tg.close === 'function') {
            tg.close();
          }
        };
        if (typeof tg.BackButton.onClick === 'function') tg.BackButton.onClick(handler);
        return () => { try { if (typeof tg.BackButton.offClick === 'function') tg.BackButton.offClick(handler); } catch {} };
      }
    } catch (e) {
      console.warn('[App] BackButton init failed:', e);
    }
  }, [tab]);

  const go = (t: Tab) => {
    setTab(t);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  };

  // Expose go function for DashboardScreen navigation
  const handleNavigate = useCallback((screen: string) => {
    const tabMap: Record<string, Tab> = {
      'dashboard': 'home',
      'pharma': 'pharma',
      'support': 'support',
      'training': 'training',
      'labs': 'labs',
      'risks': 'risks',
      'nutrition': 'nutrition',
      'profile': 'profile',
      'course': 'training',
      'plan': 'training',
      'substances': 'pharma',
      'peptides': 'pharma',
      'predictive': 'home',
      'marketplace': 'home',
      'articles': 'articles',
      'assistant': 'home',
      'gamification': 'home',
      'fertility-pct': 'support',
      'reports': 'profile',
      'integrations': 'home',
      'role-management': 'profile',
      'recovery': 'training',
      'wellness': 'training',
      'performance': 'pharma',
      'bloodwork': 'labs',
      'toolkit': 'training',
      'training-tools': 'training',
    };
    const target = tabMap[screen] || 'home';
    go(target);
  }, []);

  // Swipe removed — only within-tab swiping allowed

  // Swipe removed

  const renderContent = () => {
    if (!initialized) return (
      <div className="screen-loading">
        <div className="loading-spinner"/>
        <span>Загрузка...</span>
      </div>
    );

    switch (tab) {
      case 'home': return <DashboardScreen onNavigate={handleNavigate} />;
      case 'pharma': return <PharmaScreen />;
      case 'support': return <SupportScreen />;
      case 'training': return <TrainingScreen />;
      case 'labs': return <LabsScreen />;
      case 'risks': return <RiskScreen />;
      case 'nutrition': return <NutritionScreen />;
      case 'profile': return <ProfileScreen />;
      case 'articles': return <ArticlesScreen />;
      default: return <DashboardScreen onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="app" >
      <DarkBg />
      <main ref={mainRef} style={{ position: 'relative', zIndex: 1 }}>
        {renderContent()}
      </main>
      <ToastContainer />
      <nav className="tabs">
        {PRIMARY_NAV.map(item => (
          <button
            key={item.id}
            className={'nav-btn' + (tab === item.id ? ' active' : '')}
            onClick={() => go(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
