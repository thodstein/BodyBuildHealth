# Strength Diary Engine v6

## Overview

The Strength Diary Engine is a comprehensive strength tracking system for Health Engine v9. It manages strength logs and workout tracking using IndexedDB for persistent storage.

## Features

- **Strength Log Management**: Track individual strength exercises with sets, reps, weight, and RIR
- **Workout Log Collection**: Group multiple strength logs into complete workout sessions
- **Progress Tracking**: Calculate 1RM estimates, total volume, and weekly progress
- **Progression Alerts**: Detect plateaus, volume peaks, and recommend deloads
- **Exercise Statistics**: Track max weight, max reps, best sets, and workout history

## Architecture

### Class: `StrengthDiary`

Main class for strength diary operations. All methods are async and use IndexedDB for persistence.

```typescript
import { strengthDiary } from '../engines/strength-diary.engine';
```

### Data Models

#### StrengthLogEntry

```typescript
interface StrengthLogEntry {
  id: string;
  date: string;              // ISO date string (YYYY-MM-DD)
  exerciseId: string;
  exerciseName: string;
  sets: {
    weight: number;          // Weight in kg
    reps: number;            // Number of reps
    rir: number;             // Reps in reserve
    rpe?: number;            // Rate of perceived exertion (optional)
  }[];
  totalVolume: number;       // Sum of (weight × reps) for all sets
  estimated1RM: number;      // Estimated one-rep max
  isCompound: boolean;       // True for compound movements
  weekNumber?: number;       // Week of training program
  mesocycleId?: string;      // Related mesocycle ID
  notes?: string;            // Optional notes
}
```

#### WorkoutLog

```typescript
interface WorkoutLog {
  id: string;
  date: string;
  duration: number;          // Duration in minutes
  exercises: StrengthLogEntry[];
  overallRPE: number;        // Overall RPE (1-10)
  recoveryBefore: number;    // Recovery rating (1-10)
  split: string;             // Training split (e.g., "push", "pull", "legs")
  weekNumber?: number;
  mesocycleId?: string;
  notes?: string;
}
```

#### StrengthStats

```typescript
interface StrengthStats {
  exerciseId: string;
  exerciseName: string;
  maxWeight: number;
  maxReps: number;
  max1RM: number;
  totalVolume: number;
  workoutCount: number;
  lastWorkoutDate: string;
  bestSet: { weight: number; reps: number; rir: number };
}
```

#### WeeklyProgress

```typescript
interface WeeklyProgress {
  week: number;
  totalVolume: number;
  workoutCount: number;
  compoundWorkouts: number;
  isolationWorkouts: number;
  total1RM: number;
}
```

#### ProgressionAlert

```typescript
interface ProgressionAlert {
  type: 'plateau' | 'deload' | 'max_reached' | 'volume_peak';
  message: string;
  exerciseId?: string;
  currentWeight?: number;
  weeksAtWeight?: number;
}
```

## Usage Examples

### Saving Strength Logs

```typescript
// Save a single strength log entry
await strengthDiary.saveStrengthLog({
  id: 'squat_workout_1',
  date: '2024-01-15',
  exerciseId: 'barbell_squat',
  exerciseName: 'Barbell Back Squat',
  sets: [
    { weight: 100, reps: 8, rir: 2 },
    { weight: 100, reps: 8, rir: 2 },
    { weight: 100, reps: 6, rir: 4 }
  ],
  totalVolume: 2400,  // 100 × 8 + 100 × 8 + 100 × 6
  estimated1RM: 127,    // Calculated using Epley formula
  isCompound: true,
  weekNumber: 4,
  mesocycleId: 'meso_1',
  notes: 'Good session, felt strong'
});

// Save a complete workout log
await strengthDiary.saveWorkoutLog({
  id: 'workout_1',
  date: '2024-01-15',
  duration: 90,
  exercises: [ /* array of StrengthLogEntry */ ],
  overallRPE: 7,
  recoveryBefore: 8,
  split: 'push',
  weekNumber: 4
});
```

### Retrieving Data

```typescript
// Get all strength logs for an exercise
const squatLogs = await strengthDiary.getStrengthLogs('barbell_squat');

// Get logs by date range
const logsThisMonth = await strengthDiary.getStrengthLogsByDate(
  '2024-01-01',
  '2024-01-31'
);

// Get all workout logs
const allWorkouts = await strengthDiary.getWorkoutLogs();

// Get workout logs by date range
const recentWorkouts = await strengthDiary.getWorkoutLogsByDate(
  '2024-01-01',
  '2024-01-31'
);
```

### Getting Statistics

```typescript
// Get exercise-specific statistics
const stats = await strengthDiary.getExerciseStats('barbell_squat');
// Returns: {
//   exerciseId: 'barbell_squat',
//   exerciseName: 'Barbell Back Squat',
//   maxWeight: 120,
//   maxReps: 8,
//   max1RM: 152,
//   totalVolume: 12400,
//   workoutCount: 15,
//   lastWorkoutDate: '2024-01-15',
//   bestSet: { weight: 120, reps: 5, rir: 3 }
// }

// Get weekly progress summary
const weeklyProgress = await strengthDiary.getWeeklyProgress();
// Returns array of WeeklyProgress for each week
```

### Progression Monitoring

```typescript
// Check for progression alerts
const alerts = await strengthDiary.checkProgressionAlerts();
// Returns array of ProgressionAlert objects

// Check for plateau (same weight for 3+ weeks)
// Returns: { type: 'plateau', message: 'Плато: 100 кг на 3+ неделях' }

// Check for volume peak (high training load)
// Returns: { type: 'volume_peak', message: 'Высокий объём (>XXX): рекомендуется делоад' }
```

### Getting Recent Activity

```typescript
// Get activity for the last 7 days
const recentActivity = await strengthDiary.getRecentActivity(7);
// Returns: [
//   { date: '2024-01-15', volume: 2400, oneRm: 127 },
//   { date: '2024-01-12', volume: 3200, oneRm: 135 },
//   // ...
// ]
```

## Helper Methods

### estimate1RM

Calculates one-rep max using the Epley formula:

```typescript
function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}
```

Example:
```typescript
const oneRm = strengthDiary.estimate1RM(100, 8);  // Returns: 126.7
```

### getWeekNumber

Calculates the week number from a date string:

```typescript
function getWeekNumber(dateStr: string): number {
  // Uses ISO week number calculation
}
```

## Integration with Training System

The Strength Diary integrates with the training engine to provide:

1. **Progression Tracking**: Link strength logs to training programs
2. **RIR Matrix**: Use RIR values for automatic weight progression
3. **Mesocycle Tracking**: Organize logs by mesocycle phase
4. **Training Load Calculation**: Calculate training volume and intensity

## Database Schema

### Stores Used

- `training_log`: Stores individual strength log entries
- `workout_log`: Stores complete workout sessions

### Indexes

- `training_log`: date, exerciseId
- `workout_log`: date

## Best Practices

1. **Log Every Set**: Record all sets with accurate weight, reps, and RIR
2. **Consistent Dates**: Use ISO date format (YYYY-MM-DD) for all dates
3. **Mark Compound Exercises**: Correctly identify compound vs isolation movements
4. **Track Mesocycles**: Link logs to mesocycles for periodized training
5. **Review Alerts**: Check progression alerts weekly to adjust training
6. **Complete Workout Logs**: Group related strength logs into workout sessions

## Notes

- All methods return promises and should be awaited
- The `strengthDiary` instance is exported as a singleton
- Database operations are asynchronous and may throw errors
- Date comparisons are string-based and require proper formatting
- The Epley formula is used for 1RM estimation
