import type { SymptomEntry } from './symptom-solver.types';
import { DB_PART1 } from './symptom-solver.data-part1';
import { DB_PART2 } from './symptom-solver.data-part2';
import { DB_PART3 } from './symptom-solver.data-part3';

export const SYMPTOM_DB: SymptomEntry[] = [...DB_PART1, ...DB_PART2, ...DB_PART3];

export { DB_PART1, DB_PART2, DB_PART3 };
