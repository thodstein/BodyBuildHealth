/** ToolsHub.tsx — инструмент PRI/паттерн (ПРИ-готовность → объём/RIR + схема повторов).
 * Блины перенесены в Объём-хаб, «Основа ББ» удалена — без дублей. */
import React from 'react';
import { PriRepPatternCard } from './PriRepPatternCard';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.85)';

export const ToolsHub: React.FC = () => {
  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🧠 PRI / схема повторов</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
        PRI готовность → целевой объём/RIR + схема повторов (ПРИ-тест Masuda). Источник: PRI (Masuda), Helms/RPE/RIR — без выдумок.
      </div>
      <PriRepPatternCard />
    </div>
  );
};

export default ToolsHub;
