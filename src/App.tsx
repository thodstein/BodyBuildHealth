import React, { useState, useMemo } from 'react';
import { registry } from './core/data/registry';
import { generateStack } from './engines/stack-generator.engine';
import { analyzeInteractions } from './engines/interactions-engine';
import { calculatePK } from './engines/pk-pd.engine';

// Импорт экранов (предполагается, что они созданы в Блоке 5)
import { DashboardScreen } from './ui/screens/DashboardScreen';
import { PharmaScreen } from './ui/screens/PharmaScreen';
import { PlanScreen } from './ui/screens/PlanScreen';
import { SubstancesScreen } from './ui/screens/SubstancesScreen';

type Tab = 'dashboard' | 'pharma' | 'plan' | 'substances';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [userProfile, setUserProfile] = useState({
    goal: 'energy',
    weight: 80,
    age: 30,
    substances: [],
    symptoms: [],
    lifestyle: { stress_level: 5 }
  });

  // Вычисления на лету
  const analysis = useMemo(() => {
    const db = registry.getDB();
    if (!db.substances.length) return null;

    const stack = generateStack(userProfile.goal, 'balanced', []);
    const interactions = analyzeInteractions(stack.substances.map(s => s.id));
    
    return {
      stack,
      interactions,
      riskScore: Math.min(100, Math.max(0, 100 - (interactions.conflicts.length * 15) - (stack.errors.length * 20))),
      synergyScore: stack.synergy
    };
  }, [userProfile]);

  const renderScreen = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardScreen profile={userProfile} analysis={analysis} />;
      case 'pharma': return <PharmaScreen profile={userProfile} />;
      case 'plan': return <PlanScreen stack={analysis?.stack} />;
      case 'substances': return <SubstancesScreen substances={registry.getDB().substances} />;
      default: return <div>Select a tab</div>;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1 style={{ margin: 0 }}>🧬 Health Engine 3.0</h1>
        <div style={{ fontSize: 14, opacity: 0.7 }}>База: {registry.getDB().substances.length} веществ</div>
      </header>

      <nav className="nav">
        <button className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>📊 Дашборд</button>
        <button className={`nav-btn ${activeTab === 'pharma' ? 'active' : ''}`} onClick={() => setActiveTab('pharma')}>💊 Фарма/Курс</button>
        <button className={`nav-btn ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')}>📅 План</button>
        <button className={`nav-btn ${activeTab === 'substances' ? 'active' : ''}`} onClick={() => setActiveTab('substances')}>📚 База</button>
      </nav>

      <main>
        {analysis ? renderScreen() : <div style={{ textAlign: 'center', padding: 40 }}>⏳ Загрузка ядра системы...</div>}
      </main>
    </div>
  );
}