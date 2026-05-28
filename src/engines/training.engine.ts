import type { Exercise } from '../core/types';

export interface TrainingPlan {
  day: number;
  exercises: Exercise[];
  duration: number;
}

export function generateTrainingPlan(goal: string, availableExercises: Exercise[]): TrainingPlan[] {
  const plans: TrainingPlan[] = [];
  
  // Простая заглушка для демонстрации
  plans.push({
    day: 1,
    exercises: availableExercises.slice(0, 5),
    duration: 60
  });
  
  return plans;
}

export function filterExercisesByMuscle(exercises: Exercise[], muscle: string): Exercise[] {
  return exercises.filter(e => e.targetMuscles.includes(muscle));
}
