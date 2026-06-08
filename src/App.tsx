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

// Bottom nav: 4 primary tabs
const PRIMARY_NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Главная', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'labs', label: 'Анализы', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v7l5 8H4l5-8V3z"/><line x1="9" y1="3" x2="15" y2="3"/></svg> },
  { id: 'risks', label: 'Риски', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  { id: 'pharma', label: 'Фармакология', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
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
  const [initialized, setInitialized] = useState(false);
  // touchRef removed
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
      'calculators': 'calculators',
      'course': 'training',
      'plan': 'training',
      'substances': 'pharma',
      'peptides': 'pharma',
      'predictive': 'home',
      'marketplace': 'home',
      'articles': 'home',
      'assistant': 'home',
      'gamification': 'home',
      'fertility-pct': 'home',
      'reports': 'home',
      'integrations': 'home',
      'role-management': 'profile',
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
      case 'training': return <PlanScreen goal="energy" />;
      case 'labs': return <LabsScreen />;
      case 'risks': return <RiskScreen />;
      case 'nutrition': return <NutritionScreen />;
      case 'profile': return <ProfileScreen />;
      case 'calculators': return <CalculatorsScreen />;
      default: return <DashboardScreen onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="app" >
      <HulkBg />
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
