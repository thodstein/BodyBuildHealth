import { PHARMA_DB } from '../core/constants';
import type { PCTSchedule } from '../core/types';

export function generatePCTPlan(lastSubstance: string, courseWeeks: number): PCTSchedule {
  const startWeek = courseWeeks;
  
  return {
    startWeek,
    drugs: [
      { name: 'Clomiphene', dose: '50mg/day', durationWeeks: 4 },
      { name: 'Tamoxifen', dose: '20mg/day', durationWeeks: 4 }
    ],
    support: [
      { name: 'HCG', dose: '500IU EOD', durationWeeks: 2 },
      { name: 'Zinc', dose: '30mg/day', durationWeeks: 8 }
    ]
  };
}
