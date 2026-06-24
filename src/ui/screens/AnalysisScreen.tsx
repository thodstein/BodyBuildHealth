import React, { useState } from 'react';
import { CalculatorsScreen } from './CalculatorsScreen';
import { SubstancesScreen } from './SubstancesScreen';
import { PeptidesScreen } from './PeptidesScreen';
import { SmartAssistantScreen } from './SmartAssistantScreen';
import { RoleManagementScreen } from './RoleManagementScreen';

const TABS = [
  { id: 'calculators', label: 'Калькуляторы' },
  { id: 'substances', label: 'Вещества' },
  { id: 'peptides', label: 'Пептиды' },
  { id: 'assistant', label: 'Ассистент' },
  { id: 'roles', label: 'Управление' },
];

export const AnalysisScreen: React.FC = () => {
  const [subTab, setSubTab] = useState('calculators');

  return (
    <div className="screen" style={{ padding: '0 8px 70px' }}>
      <div style={{
        display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto',
        scrollbarWidth: 'none', paddingBottom: 4,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: subTab === t.id ? 700 : 400, whiteSpace: 'nowrap',
              background: subTab === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: subTab === t.id ? '#000' : 'rgba(255,255,255,0.7)',
            }}
          >{t.label}</button>
        ))}
      </div>

      {subTab === 'calculators' && <CalculatorsScreen />}
      {subTab === 'substances' && <SubstancesScreen />}
      {subTab === 'peptides' && <PeptidesScreen />}
      {subTab === 'assistant' && <SmartAssistantScreen />}
      {subTab === 'roles' && <RoleManagementScreen />}
    </div>
  );
};
