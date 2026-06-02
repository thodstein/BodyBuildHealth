import React, { useState, useRef, useEffect, useCallback } from 'react';
import { registry } from './core/data/registry';
import { DashboardScreen } from './ui/screens/DashboardScreen';
import { PharmaScreen } from './ui/screens/PharmaScreen';
import { PeptidesScreen } from './ui/screens/PeptidesScreen';
import { PharmaCourseScreen } from './ui/screens/PharmaCourseScreen';
import { SubstancesScreen } from './ui/screens/SubstancesScreen';
import { NutritionScreen } from './ui/screens/NutritionScreen';
import { LabsScreen } from './ui/screens/LabsScreen';
import { RiskScreen } from './ui/screens/RiskScreen';
import { PlanScreen } from './ui/screens/PlanScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { PredictiveAnalyticsScreen } from './ui/screens/PredictiveAnalyticsScreen';
import { CalculatorsScreen } from './ui/screens/CalculatorsScreen';
import { MarketplaceScreen } from './ui/screens/MarketplaceScreen';
import { ArticlesScreen } from './ui/screens/ArticlesScreen';
import { SmartAssistantScreen } from './ui/screens/SmartAssistantScreen';
import { GamificationScreen } from './ui/screens/GamificationScreen';
import { FertilityPCTScreen } from './ui/screens/FertilityPCTScreen';
import { ReportsScreen } from './ui/screens/ReportsScreen';
import { IntegrationsScreen } from './ui/screens/IntegrationsScreen';
import { RoleManagementScreen } from './ui/screens/RoleManagementScreen';
import { ToastContainer } from './ui/ToastContainer';

type Tab = 'home' | 'pharma' | 'training' | 'nutrition' | 'labs' | 'risks' | 'profile';
type SubPage = string;

const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Главная', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'pharma', label: 'Фарма', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
  { id: 'training', label: 'Тренировки', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11v11h-11z"/><path d="M3 12h3M18 12h3M12 3v3M12 18v3"/><circle cx="12" cy="12" r="2"/></svg> },
  { id: 'nutrition', label: 'Питание', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> },
  { id: 'labs', label: 'Анализы', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v7l5 8H4l5-8V3z"/><line x1="9" y1="3" x2="15" y2="3"/></svg> },
  { id: 'risks', label: 'Риски', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  { id: 'profile', label: 'Профиль', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
];

function HulkBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <svg viewBox="0 0 400 800" style={{ position: 'absolute', right: '-60px', bottom: '60px', width: '420px', height: '840px', opacity: 0.07 }}>
        <defs>
          <linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e68a" stopOpacity="0.8"/>
            <stop offset="50%" stopColor="#00cc7a" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#009960" stopOpacity="0.2"/>
          </linearGradient>
          <filter id="hglow"><feGaussianBlur stdDeviation="12" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <radialGradient id="hchest" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#00ff99" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#00994d" stopOpacity="0.1"/>
          </radialGradient>
        </defs>
        <g transform="translate(200,420) scale(1.8)" filter="url(#hglow)">
          <ellipse cx="0" cy="-40" rx="55" ry="70" fill="url(#hg)"/>
          <path d="M-55,-70 C-65,-30 -80,20 -75,60 L-50,70 C-40,30 -20,0 -15,-40 Z" fill="#00cc7a" opacity="0.5"/>
          <path d="M55,-70 C65,-30 80,20 75,60 L50,70 C40,30 20,0 15,-40 Z" fill="#00cc7a" opacity="0.5"/>
          <ellipse cx="-42" cy="-80" rx="22" ry="16" fill="#00e68a" opacity="0.4"/>
          <ellipse cx="42" cy="-80" rx="22" ry="16" fill="#00e68a" opacity="0.4"/>
          <path d="M-30,-90 Q-10,-110 10,-90" fill="none" stroke="#00ff99" strokeWidth="4" opacity="0.3"/>
          <path d="M0,-50 L-15,20 M0,-50 L15,20 M-15,20 L-40,50 M-15,20 L0,80 M15,20 L40,50 M15,20 L0,80" stroke="#00e68a" strokeWidth="6" opacity="0.35" strokeLinecap="round"/>
          <rect x="-20" y="-100" width="40" height="10" rx="5" fill="#00ff99" opacity="0.3"/>
          <ellipse cx="0" cy="-10" rx="30" ry="45" fill="url(#hchest)"/>
          <path d="M-30,-30 Q-60,-60 -55,-100" fill="none" stroke="#00e68a" strokeWidth="10" opacity="0.25" strokeLinecap="round"/>
          <path d="M30,-30 Q60,-60 55,-100" fill="none" stroke="#00e68a" strokeWidth="10" opacity="0.25" strokeLinecap="round"/>
          <path d="M0,70 Q0,120 -20,180 M0,70 Q0,120 20,180" fill="none" stroke="#00cc7a" strokeWidth="14" opacity="0.2" strokeLinecap="round"/>
        </g>
      </svg>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 50%, rgba(0,230,138,0.06) 0%, transparent 60%)' }} />
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [sub, setSub] = useState<SubPage>('');
  const [initialized, setInitialized] = useState(false);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => { registry.init().then(() => setInitialized(true)); }, []);

  const go = (t: Tab, s?: SubPage) => {
    setTab(t);
    setSub(s || '');
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
    const tabs: Tab[] = ['home', 'pharma', 'training', 'nutrition', 'labs', 'risks', 'profile'];
    const idx = tabs.indexOf(tab);
    const next = dx < 0 && idx < tabs.length - 1 ? tabs[idx + 1] : dx > 0 && idx > 0 ? tabs[idx - 1] : null;
    if (next) { go(next); }
    touchRef.current = null;
  }, [tab]);

  const subItems = (() => {
    switch (tab) {
      case 'pharma': return [
        { id: 'drugs', label: 'Препараты' },
        { id: 'course', label: 'Мой курс' },
        { id: 'calc-pharma', label: 'Калькулятор' },
        { id: 'peptides', label: 'Пептиды' },
        { id: 'substances', label: 'Справочник' },
        { id: 'marketplace', label: 'Маркетплейс' },
      ];
      case 'training': return [
        { id: 'plan', label: 'План' },
        { id: 'readiness', label: 'Восстановление' },
        { id: 'whatif', label: 'What-If анализ' },
      ];
      case 'nutrition': return [
        { id: 'diary', label: 'Дневник' },
        { id: 'calc', label: 'Калькуляторы' },
        { id: 'bady', label: 'БАДы' },
      ];
      case 'labs': return [
        { id: 'results', label: 'Ввод анализов' },
        { id: 'panels', label: 'Панели' },
        { id: 'history', label: 'История' },
        { id: 'indices', label: 'Индексы' },
        { id: 'risks-labs', label: 'Риски' },
      ];
      case 'risks': return [
        { id: 'matrix', label: 'Матрица рисков' },
        { id: 'fertility', label: 'Фертильность' },
      ];
      case 'profile': return [
        { id: 'settings', label: 'Настройки' },
        { id: 'gamification', label: 'Достижения' },
        { id: 'reports', label: 'Отчёты' },
        { id: 'integrations', label: 'Интеграции' },
        { id: 'assistant', label: 'Ассистент' },
        { id: 'articles', label: 'Статьи' },
      ];
      default: return [];
    }
  })();

  const renderContent = () => {
    if (!initialized) return (
      <div className="loading-screen">
        <HulkBg />
        <div className="loading-spinner"/>
        <span style={{ position: 'relative', zIndex: 1 }}>Загрузка Health Engine...</span>
      </div>
    );

    if (sub) {
      switch (sub) {
        case 'drugs': return <PharmaScreen />;
        case 'course': return <PharmaCourseScreen />;
        case 'calc-pharma': return <CalculatorsScreen />;
        case 'peptides': return <PeptidesScreen />;
        case 'substances': return <SubstancesScreen />;
        case 'marketplace': return <MarketplaceScreen />;
        case 'plan': return <PlanScreen goal="energy" />;
        case 'readiness': return <DashboardScreen />;
        case 'whatif': return <PredictiveAnalyticsScreen />;
        case 'diary': return <NutritionScreen />;
        case 'calc': return <CalculatorsScreen />;
        case 'bady': return <CalculatorsScreen initialTab="support" />;
        case 'results': return <LabsScreen initialTab="input" />;
        case 'panels': return <LabsScreen initialTab="panels" />;
        case 'history': return <LabsScreen initialTab="history" />;
        case 'indices': return <LabsScreen initialTab="indices" />;
        case 'risks-labs': return <LabsScreen initialTab="risks" />;
        case 'matrix': return <RiskScreen />;
        case 'fertility': return <FertilityPCTScreen />;
        case 'settings': return <ProfileScreen />;
        case 'gamification': return <GamificationScreen />;
        case 'reports': return <ReportsScreen />;
        case 'integrations': return <IntegrationsScreen />;
        case 'roles': return <RoleManagementScreen />;
        case 'assistant': return <SmartAssistantScreen />;
        case 'articles': return <ArticlesScreen />;
        default: return <DashboardScreen />;
      }
    }

    switch (tab) {
      case 'home': return <DashboardScreen />;
      case 'pharma': return <PharmaScreen />;
      case 'training': return <PlanScreen goal="energy" />;
      case 'nutrition': return <NutritionScreen />;
      case 'labs': return <LabsScreen />;
      case 'risks': return <RiskScreen />;
      case 'profile': return <ProfileScreen />;
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
      {subItems.length > 0 && (
        <div className="sub-nav">
          {subItems.map(item => (
            <button
              key={item.id}
              className={'sub-nav-btn' + (sub === item.id ? ' active' : '')}
              onClick={() => { setSub(item.id); if (mainRef.current) mainRef.current.scrollTop = 0; window.scrollTo(0, 0); }}
            >
              {item.label}
            </button>
          ))}
          <button className="sub-nav-btn back" onClick={() => setSub('')}>&#8592; Назад</button>
        </div>
      )}
      <nav className="tabs">
        {NAV.map(item => (
          <button
            key={item.id}
            className={'nav-btn' + (tab === item.id && !sub ? ' active' : (subItems.length > 0 && tab === item.id ? ' active-parent' : ''))}
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