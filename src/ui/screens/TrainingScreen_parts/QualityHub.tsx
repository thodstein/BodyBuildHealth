/** QualityHub.tsx — отдельный инструмент «Качество программы» (без диагностики).
 * Ранее был внутри QualityDiagnosticsHub (хаб 2-в-1). Теперь — самостоятельная вкладка.
 * Диагностика — в DiagnosticsHub (отдельный инструмент).
 */
import React from 'react';
import { CalcQualityTab } from './CalcQualityTab';
import BBFeedbackCard from './BBFeedbackCard';

export interface QualityHubProps { onBuildPlan: () => void; }

export const QualityHub: React.FC<QualityHubProps> = ({ onBuildPlan }) => {
  return (
    <div style={{ padding: 4 }}>
      <div style={{ fontSize: 9, color: '#fff', marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.12)', lineHeight: 1.4 }}>
        ⭐ Отдельный инструмент качества: <b>ББ/ПЛ/Гибрид</b> · MEV/MAV/MRV (Israetel) · PED dose-aware · лаборатория · PRO (паттерны/углы/растяжка/техника/цель ~ <b>Schoenfeld/Contreras</b>) · графики tonnage/KPSH/UOI. Диагностика вынесена в <b style={{ color: '#a78bfa' }}>🔬 Диагностика</b>.
      </div>
      <div style={{ marginBottom: 10 }}>
        <BBFeedbackCard />
      </div>
      <CalcQualityTab onBuildPlan={onBuildPlan} />
    </div>
  );
};
export default QualityHub;
