/** PlannerPlAuto.tsx — dedicated цельная ПЛ-панель (авто-планировщик пауэрлифтинга).
 * Обёртывает SRCBBScreen track="pl": каталог силовых циклов, ПМ-прогрессия, недельный план,
 * мост план→сессия, блины, авторегуляция, пиковая фаза, восстановление, безопасность. */
import React from 'react';
import { SRCBBScreen } from '../SRCBBScreen';

export const PlannerPlAuto: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 0, maxWidth: '100%' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
        🏆 Пауэрлифтинг — авто-планировщик
      </div>
      <SRCBBScreen track="pl" />
    </div>
  );
};
