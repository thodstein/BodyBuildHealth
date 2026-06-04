# RIR Matrix Engine

## Overview

**RIR Matrix Engine** (дни 57-70) — новая система управления интенсивностью тренировок на основе:

1. **RIR MATRIX**: goal × level × mesocyclePhase × weekNumber
2. **Weekly Progression**: автоматическая прогрессия весов и объёма
3. **Phase Logic**: base → build → peak → deload

## Architecture

```
RIR Matrix (4D)
├── goal: bulk | cut | strength | hypertrophy | maintenance | recomp | rehab
├── level: beginner | intermediate | advanced | enhanced
├── phase: base | build | peak | deload
└── weekNumber: 1-12

├── calculateRIR() → RIR for each set
├── calculateWeeklyProgression() → WeeklyProgression plan
├── generateWeeklyPlan() → 4-6 week plan array
└── getProgressionRationale() → UI rationale
```

## RIR Matrix Rules

### Base RIR by Phase

| Phase   | Description                    | Volume Mod | Intensity Mod | RIR Base |
|---------|--------------------------------|------------|---------------|----------|
| base    | Накопление объёма              | 1.0x       | 0.7x          | 3        |
| build   | Баланс объёма и интенсивности | 0.9x       | 0.85x         | 2        |
| peak    | Минимум объёма, максимум силы | 0.6x       | 1.0x          | 1        |
| deload  | Восстановление                 | 0.5x       | 0.6x          | 4        |

### RIR by Goal × Level × Phase

```
RIR_MATRIX[goal][level][phase] = rirBase
```

**Examples:**
- `bulk` + `intermediate` + `build` = RIR 2
- `strength` + `advanced` + `peak` = RIR 1
- `rehab` + `beginner` + `base` = RIR 4

## Weekly Progression Logic

### Phase Detection (12-week plan)

```
Week 1-3:  base   → накопление объёма
Week 4:    deload → восстановление (every 4 weeks)
Week 5-7:  build  → интенсивность
Week 8:    deload → восстановление
Week 9-10: build  → продолжение
Week 11-12:peak   → пиковая интенсивность
```

### Progression Types by Level

| Level     | Progression Type | Weekly Weight Increment | Volume Logic                |
|-----------|------------------|-------------------------|-----------------------------|
| beginner  | linear           | +2.5 kg (compound)      | фиксированное увеличение   |
| intermediate | double        | +0 kg                   | сначала повторы, потом вес |
| advanced  | undulating       | +1.25 kg                | RIR варьируется по неделе  |
| enhanced  | conjugate        | +2.5 kg                 | ротация упражнений + вес   |

## API Reference

### calculateRIR()

```typescript
interface RIRResult {
  rir: number;       // Recommended reps in reserve
  rationale: string; // Explanation for UI
}

function calculateRIR(
  goal: string,
  level: string,
  phase: MesocyclePhase,
  weekNumber: number,
  isCompound: boolean,
  isWeakGroup: boolean,
  recovery: number,
  fatigue: number
): RIRResult
```

**Adjustments:**
- `isWeakGroup`: -1 RIR (акцент на слабой группе)
- `recovery < 50`: +1 RIR (низкое восстановление)
- `fatigue > 70`: +1 RIR (усталость)
- `phase === 'deload'`: RIR = 4 (восстановление)

### calculateWeeklyProgression()

```typescript
interface WeeklyProgression {
  weekNumber: number;
  phase: MesocyclePhase;
  phaseName: string;
  volumeTotal: number;
  volumePerGroup: Record<string, number>;
  rir: number;
  progressionType: 'linear' | 'double' | 'undulating' | 'conjugate';
  weeklyWeightIncrement: number;
  intensityTechnique?: string;
  deloadWeek: boolean;
  recoveryFocus: boolean;
  notes: string[];
}

function calculateWeeklyProgression(
  input: TrainingInput,
  weekNumber: number,
  totalWeeks: number = 12
): WeeklyProgression
```

### generateWeeklyPlan()

```typescript
function generateWeeklyPlan(
  input: TrainingInput,
  totalWeeks: number = 6
): WeeklyProgression[]

// Usage:
const plan = generateWeeklyPlan(mockInput, 6);
plan.forEach(week => {
  console.log(`Week ${week.weekNumber}: ${week.phase} - RIR ${week.rir}`);
});
```

### getProgressionRationale()

```typescript
function getProgressionRationale(
  goal: string,
  level: string,
  phase: MesocyclePhase,
  weekNumber: number,
  totalWeeks: number
): string

// Example output:
// "Неделя 3 из 12. Базовый этап: накопление объёма, низкая интенсивность. 
//  Линейная прогрессия: еженедельное увеличение рабочего веса на фиксированную величину. 
//  → Прогрессия: +2.5 кг/нед (compound) или +0 сет/нед."
```

## Integration

### training.engine.ts

```typescript
import { RIR_MATRIX, MesocyclePhase, calculateWeeklyProgression, generateWeeklyPlan } from './rir-matrix.engine';

// Use RIR matrix in calcExercisePrescription
const rirBase = RIR_MATRIX[goal]?.[level]?.[phase] ?? 2;

// Generate weekly plan
const weeklyPlan = generateWeeklyPlan(input, 6);
```

## Usage Example

```typescript
import { calculateRIR, generateWeeklyPlan } from './engines/rir-matrix.engine';

// RIR calculation for a set
const { rir, rationale } = calculateRIR(
  'bulk',
  'intermediate',
  'build',
  3,
  true,       // compound
  false,      // not weak group
  70,         // recovery
  40          // fatigue
);

// Generate 6-week plan
const plan = generateWeeklyPlan({
  goal: 'bulk',
  level: 'intermediate',
  daysPerWeek: 4,
  recovery: 70,
  fatigue: 40,
  nutrition: 80,
  weakPoints: []
}, 6);

// Plan output:
// Week 1: base - RIR 2 - volume 48
// Week 2: base - RIR 2 - volume 48
// Week 3: base - RIR 2 - volume 48
// Week 4: deload - RIR 4 - volume 24 (50%)
// Week 5: build - RIR 2 - volume 43
// Week 6: build - RIR 1 - volume 43
```

## Tests

```bash
npm test rir-matrix.engine.test.ts
```

### Test Coverage

- ✅ RIR matrix structure validation
- ✅ RIR calculation with adjustments
- ✅ Weak group RIR reduction
- ✅ Recovery/fatigue adjustments
- ✅ Deload phase RIR
- ✅ Weekly progression generation
- ✅ Phase transitions
- ✅ Deload week detection

## Migration Notes

### From Old RIR_MAP

**Old:**
```typescript
const RIR_MAP: Record<string, string> = {
  strength: '2-3', 
  hypertrophy: '1-2', 
  endurance: '3-4', 
  recovery: '4'
};
```

**New:**
```typescript
const rirBase = RIR_MATRIX[goal]?.[level]?.[phase] ?? 2;
```

### Benefits

1. **Dynamic RIR**: теперь зависит от фазы макроксикла
2. **Level-aware**: для каждого уровня свой подход
3. **Progression-aware**: RIR снижается к пiku
4. **Recovery-aware**: адаптация к текущему состоянию
5. **Weak group bonus**: снижение RIR для акцента

## Future Enhancements

- [ ] Add RPE-based RIR adjustment
- [ ] Exercise-specific RIR (compound vs isolation)
- [ ] Muscle group-specific progression
- [ ] Auto-deload trigger based on RPE
- [ ] 3D visualisation (phase × week × volume)

## Files

- `src/engines/rir-matrix.engine.ts` — main engine
- `src/engines/__tests__/rir-matrix.engine.test.ts` — tests
- `src/engines/training.engine.ts` — integration
- `src/engines/progression.engine.ts` — progression rules
