/** PlannerBbAuto.tsx — dedicated ББ-панель с пошаговым конструктором BbAutoConstructor.
 *  Полный поток: Параметры → PED+WorkMax → Сплит → План с комментариями → Качество → Коррекция.
 *  Все PRO-фичи: PED-адаптация, MRV-guard, auto-reg, ACWR, inline editing. */
import React from 'react';
import { BbAutoConstructor } from './BbAutoConstructor';

export const PlannerBbAuto: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 0, maxWidth: '100%' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#00e68a' }}>
        💪 Бодибилдинг — авто-конструктор
      </div>
      <BbAutoConstructor />
    </div>
  );
};
