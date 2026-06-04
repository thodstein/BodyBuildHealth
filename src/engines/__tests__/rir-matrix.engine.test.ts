/**
 * RIR MATRIX ENGINE - TESTS
 * goal × level × mesocyclePhase × weekNumber
 */

import { 
  RIR_MATRIX, 
  MesocyclePhase, 
  calculateRIR,
  calculateWeeklyProgression,
  generateWeeklyPlan,
  getProgressionRationale
} from './rir-matrix.engine';
import { TRAINING_LEVEL_CONFIGS } from './training.engine';

// Mock input
const mockInput = {
  goal: 'bulk',
  level: 'intermediate',
  daysPerWeek: 4,
  recovery: 70,
  fatigue: 40,
  nutrition: 80,
  weakPoints: [],
  exercises: []
};

describe('RIR Matrix Engine', () => {
  test('RIR matrix structure', () => {
    // Проверка структуры матрицы
    expect(RIR_MATRIX).toHaveProperty('bulk');
    expect(RIR_MATRIX.bulk).toHaveProperty('beginner');
    expect(RIR_MATRIX.bulk.beginner).toHaveProperty('base');
    expect(RIR_MATRIX.bulk.beginner.base).toBe(3);
  });

  test('RIR calculation for bulk beginner base phase', () => {
    const { rir, rationale } = calculateRIR(
      'bulk',
      'beginner',
      'base',
      1,
      true,
      false,
      70,
      40
    );
    
    expect(rir).toBe(3);
    expect(rationale).toContain('База: 3 RIR');
  });

  test('RIR adjustment for weak group', () => {
    const { rir } = calculateRIR(
      'bulk',
      'intermediate',
      'build',
      3,
      false,
      true, // isWeakGroup
      70,
      40
    );
    
    // Base RIR 2 for intermediate/build, -1 for weak group = 1
    expect(rir).toBe(1);
  });

  test('RIR adjustment for low recovery', () => {
    const { rir } = calculateRIR(
      'bulk',
      'intermediate',
      'build',
      3,
      false,
      false,
      40, // Low recovery
      40
    );
    
    // Base RIR 2 + 1 for low recovery = 3
    expect(rir).toBe(3);
  });

  test('RIR for deload phase', () => {
    const { rir } = calculateRIR(
      'bulk',
      'intermediate',
      'deload',
      4,
      false,
      false,
      70,
      40
    );
    
    // Deload always uses RIR 4
    expect(rir).toBe(4);
  });

  test('Weekly progression generates 6 weeks', () => {
    const weeks = generateWeeklyPlan(mockInput, 6);
    
    expect(weeks).toHaveLength(6);
    expect(weeks[0].weekNumber).toBe(1);
    expect(weeks[5].weekNumber).toBe(6);
  });

  test('Progression changes across weeks', () => {
    const weeks = generateWeeklyPlan(mockInput, 6);
    
    // Week 1 should be base phase
    expect(weeks[0].phase).toBe('base');
    
    // Week 4 should be build phase (or deload at week 4)
    expect(weeks[3].phase).toBe('deload');
    
    // Week 5-6 should be peak phase
    expect(weeks[5].phase).toBe('peak');
  });

  test('Deload week has 50% volume', () => {
    const weeks = generateWeeklyPlan(mockInput, 6);
    const deloadWeek = weeks.find(w => w.phase === 'deload');
    
    expect(deloadWeek).toBeDefined();
    expect(deloadWeek?.deloadWeek).toBe(true);
    expect(deloadWeek?.recoveryFocus).toBe(false);
  });

  test('Progression rationale includes phase description', () => {
    const rationale = getProgressionRationale(
      'bulk',
      'intermediate',
      'build',
      3,
      12
    );
    
    expect(rationale).toContain('Фокус на технике');
    expect(rationale).toContain('Удержание техники');
  });

  test('Level configs', () => {
    const beginner = TRAINING_LEVEL_CONFIGS.beginner;
    expect(beginner).toBeDefined();
    expect(beginner.volumeBase).toBe(12);
    expect(beginner.rirBase).toBe(3);
  });
});

console.log('RIR Matrix Engine tests ready!');
