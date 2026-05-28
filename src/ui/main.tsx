import React from 'react';
import { createRoot } from 'react-dom/client';
import { PharmaCourseModule } from './ui/pharma-course';
import { LabsDiagnosticsModule } from './ui/labs-diagnostics';

function App() {
  const [activeTab, setActiveTab] = React.useState<'pharma' | 'labs'>('pharma');

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>🧬 Health Engine TZ</h1>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setActiveTab('pharma')} style={{ marginRight: 10 }}>Фарма</button>
        <button onClick={() => setActiveTab('labs')}>Лаборатория</button>
      </div>
      
      {activeTab === 'pharma' && <PharmaCourseModule />}
      {activeTab === 'labs' && <LabsDiagnosticsModule />}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);