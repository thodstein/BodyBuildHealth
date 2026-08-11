import React, { useState, useRef, useEffect, useCallback } from 'react';
import { registry } from './core/data/registry';
import { DashboardScreen } from './ui/screens/DashboardScreen';
import { MarketplaceScreen } from './ui/screens/MarketplaceScreen';
import { PharmaScreen } from './ui/screens/PharmaScreen';
import { SupportScreen } from './ui/screens/SupportScreen';
import { TrainingScreen } from './ui/screens/TrainingScreen';
import { LabsScreen } from './ui/screens/LabsScreen';
import { InfoErrorBoundary } from './ui/screens/SupportScreen_parts/SupportScreenData';
import { RiskScreen } from './ui/screens/RiskScreen';
import { NutritionScreen } from './ui/screens/NutritionScreen';
import { ProfileScreen_v2 } from './ui/screens/ProfileScreen_v2/ProfileScreen_v2';
import { ArticlesScreen } from './ui/screens/ArticlesScreen';

import { ToastContainer } from './ui/ToastContainer';
import { setLocale, getLocale } from './data/interactions-labels';

type Tab = 'home' | 'pharma' | 'training' | 'labs' | 'risks' | 'support' | 'nutrition' | 'profile' | 'articles' | 'marketplace';

// NavTarget — куда переходить внутри блока.
// subTab — конкретный раздел/дневник внутри блока (например, 'diary' в NutritionScreen).
interface NavTarget { tab: Tab; subTab?: string; }

// Bottom nav: 7 primary tabs
const PRIMARY_NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Главная', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'training', label: 'Тренинг', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 4l3 3-6 6-5-5-6 6-3-3"/><circle cx="8" cy="8" r="2"/><path d="M14 2v4"/><path d="M10 22v-8"/></svg> },
  { id: 'nutrition', label: 'Питание', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/><path d="M4.93 4.93l14.14 14.14"/><path d="M19.07 4.93L4.93 19.07"/></svg> },
  { id: 'labs', label: 'Анализы', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v7l5 8H4l5-8V3z"/><line x1="9" y1="3" x2="15" y2="3"/></svg> },
  { id: 'risks', label: 'Риски', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  { id: 'pharma', label: 'Фарма', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
  { id: 'support', label: 'БАДы', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> },
];

function DarkBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 50%, rgba(0,230,138,0.04) 0%, transparent 60%)' }} />
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [subTab, setSubTab] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [screenKey, setScreenKey] = useState(0);
  // touchRef removed
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => { registry.init().then(() => setInitialized(true)); }, []);

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

  const go = (t: Tab, st: string | null = null) => {
    if (tab === t) {
      setScreenKey(k => k + 1);
    } else {
      setTab(t);
    }
    setSubTab(st);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  };

  // handleNavigate: каждая цель указывает tab + subTab (конкретный дневник/отчёт).
  // subTab пробрасывается в конкретный экран через props.
  const handleNavigate = useCallback((screen: string) => {
    const tabMap: Record<string, NavTarget> = {
      'dashboard': { tab: 'home' },
      'pharma': { tab: 'pharma' },
      'support': { tab: 'support' },
      'training': { tab: 'training' },
      'labs': { tab: 'labs' },
      'risks': { tab: 'risks' },
      'nutrition': { tab: 'nutrition' },
      'profile': { tab: 'profile' },
      'course': { tab: 'training' },
      'plan': { tab: 'training' },
      'substances': { tab: 'support' },
      'peptides': { tab: 'support' },
      'predictive': { tab: 'home' },
      'marketplace': { tab: 'marketplace' },
      'articles': { tab: 'articles' },
      'assistant': { tab: 'home' },
      'gamification': { tab: 'home' },
      'fertility-pct': { tab: 'support' },
      'role-management': { tab: 'profile' },
      'recovery': { tab: 'training' },
      'wellness': { tab: 'training' },
      'performance': { tab: 'pharma' },
      'bloodwork': { tab: 'labs' },
      'toolkit': { tab: 'training' },
      'training-tools': { tab: 'training' },

      // Дневники в других блоках — открываем конкретный sub-раздел
      'nutrition-diary': { tab: 'nutrition', subTab: 'diary' },
      'workout-log': { tab: 'training', subTab: 'diary' },
      'pharma-course': { tab: 'pharma', subTab: 'course' },
      'support-diary': { tab: 'support', subTab: 'diary' },
      'symptoms': { tab: 'support', subTab: 'symptoms' },
      'labs-diary': { tab: 'labs', subTab: 'diary' },

      // Отчёты
      'training-analytics': { tab: 'training', subTab: 'analytics' },
      'pharma-reports': { tab: 'pharma', subTab: 'reports' },
      'risk-reports': { tab: 'risks', subTab: 'reports' },
      'labs-reports': { tab: 'labs', subTab: 'reports' },
      'nutrition-reports': { tab: 'nutrition', subTab: 'reports' },
      'support-reports': { tab: 'support', subTab: 'reports' },
      'custom-report': { tab: 'profile', subTab: 'custom-report' },
      'profile-reports': { tab: 'profile', subTab: 'reports' },

      // Встроенные дневники — открываем профильный дневник
      'profile-diary-sleep': { tab: 'profile', subTab: 'sleep' },
      'profile-diary-bp': { tab: 'profile', subTab: 'bp' },
      'profile-diary-weight': { tab: 'profile', subTab: 'weight' },
      'profile-diary-measurements': { tab: 'profile', subTab: 'measurements' },
    };
    const target = tabMap[screen] || { tab: 'home' as Tab };
    go(target.tab, target.subTab ?? null);
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

    const key = `screen-${tab}-${subTab || 'main'}-${screenKey}`;
    switch (tab) {
      case 'home': return <DashboardScreen key={key} onNavigate={handleNavigate} />;
      case 'pharma': return <PharmaScreen key={key} initialSubTab={subTab || undefined} />;
      case 'support': return <SupportScreen key={key} onNavigate={handleNavigate} initialSubTab={subTab || undefined} />;
      case 'training': return <TrainingScreen key={key} initialSubTab={subTab || undefined} />;
      case 'labs': return <InfoErrorBoundary label="Лаборатория"><LabsScreen key={key} initialSubTab={subTab || undefined} /></InfoErrorBoundary>;
      case 'risks': return <RiskScreen key={key} />;
      case 'nutrition': return <NutritionScreen key={key} initialSubTab={subTab || undefined} />;
      case 'marketplace': return <MarketplaceScreen key={key} />;
      case 'profile': return <ProfileScreen_v2 key={key} onNavigate={handleNavigate} initialSubTab={subTab || undefined} />;
      case 'articles': return <ArticlesScreen key={key} />;
      default: return <DashboardScreen key={key} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="app" >
      <DarkBg />
      <main ref={mainRef} style={{ position: 'relative', zIndex: 1, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <img src="/bg-profile.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'fill', zIndex:0, pointerEvents:'none', opacity:0.3 }} />
<div style={{ position:'relative', zIndex:1, flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Locale toggle button (top-right) */}
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1000 }}>
            <button
              onClick={() => setLocale(getLocale() === 'ru' ? 'en' : 'ru')}
              style={{
                padding: '6px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(96,165,250,0.12)',
                border: '1px solid rgba(96,165,250,0.25)',
                color: '#60a5fa',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                whiteSpace: 'nowrap',
              }}
              title={getLocale() === 'ru' ? 'Switch to English' : 'Переключить на русский'}
            >
              {getLocale() === 'ru' ? 'EN' : 'RU'}
            </button>
          </div>
          {renderContent()}
        </div>
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
