/**
 * CardioDiaryStep.tsx — шаг 5 мастера кардио: быстрый старт сессии (таймер),
 * прогресс цикла, авто-режим (подстройка по дневнику), дневник выполнения.
 */
import React from 'react';
import type { CardioCycle } from '../../../engines/lms/cardio.engine';
import { CardioDiaryPanel } from './CardioDiaryPanel';
import { CardioAutoTunePanel } from './CardioAutoTunePanel';
import { CardioSessionTimer } from './CardioSessionTimer';
import { CardioProgressCard } from './CardioProgressCard';

export const CardioDiaryStep: React.FC<{
  cycle: CardioCycle | null;
  acwr?: number | null;
  recoveryLow: boolean;
  onChanged: () => void;
}> = ({ cycle, acwr, recoveryLow, onChanged }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <CardioProgressCard cycle={cycle} />
      <CardioSessionTimer cycle={cycle} onSaved={onChanged} />
      <CardioAutoTunePanel cycle={cycle} acwr={acwr} onChanged={onChanged} />
      <CardioDiaryPanel cycle={cycle} acwr={acwr} recoveryLow={recoveryLow} />
    </div>
  );
};
