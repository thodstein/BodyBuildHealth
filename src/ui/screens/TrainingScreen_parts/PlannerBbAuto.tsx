/** PlannerBbAuto.tsx — dedicated цельная ББ-панель (авто-планировщик бодибилдинга).
 * Обёртывает SRCBBScreen track="bb": подбор сплита, объём по группам, прогрессия,
 * мост план→сессия, методики, аналитика, PRO-метрики, графики. */
import React from 'react';
import { SRCBBScreen } from '../SRCBBScreen';

export const PlannerBbAuto: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#00e68a' }}>
        💪 Бодибилдинг — авто-планировщик
      </div>
      <SRCBBScreen track="bb" />
    </div>
  );
};
