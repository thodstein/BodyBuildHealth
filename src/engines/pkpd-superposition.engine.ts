import { PHARMA_DB } from '../core/constants';

export interface PKPDSuperposition {
  substanceId: string;
  totalExposure: number;
  peakTime: number;
  steadyState: boolean;
}

export function calculateSuperposition(substanceId: string, doseValue: number, frequency: number, weeks: number): PKPDSuperposition {
  const substance = PHARMA_DB[substanceId];
  
  // Упрощенная модель суперпозиции
  const totalExposure = doseValue * frequency * weeks * 7;
  const peakTime = weeks * 7 / 2;
  const steadyState = weeks >= 4;

  return {
    substanceId,
    totalExposure,
    peakTime,
    steadyState
  };
}
