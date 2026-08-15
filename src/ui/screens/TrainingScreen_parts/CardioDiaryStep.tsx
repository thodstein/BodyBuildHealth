/**
 * CardioDiaryStep.tsx — шаг 5 мастера кардио: дневник выполнения,
 * авто-режим (подстройка по дневнику с подтверждением), пульс-зоны, «Сегодня».
 */
import React from 'react';
import type { CardioCycle } from '../../../engines/lms/cardio.engine';
import { CardioDiaryPanel } from './CardioDiaryPanel';
import { CardioAutoTunePanel } from './CardioAutoTunePanel';

export const CardioDiaryStep: React.FC<{
  cycle: CardioCycle | null;
  acwr?: number | null;
  recoveryLow: boolean;
  onChanged: () => void;
}> = ({ cycle, acwr, recoveryLow, onChanged }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <CardioAutoTunePanel cycle={cycle} acwr={acwr} onChanged={onChanged} />
      <CardioDiaryPanel cycle={cycle} acwr={acwr} recoveryLow={recoveryLow} />
    </div>
  );
};
