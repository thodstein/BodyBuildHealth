# Training Block Architecture — Proposal

## Background
Current training architecture has 4 engines working together:
- `training.engine.ts` — coordinator (volume, RIR, split)
- `training-periodization.engine.ts` — mesocycle/microcycle generator
- `rir-matrix.engine.ts` — 3D RIR matrix (goal×level×phase)
- `progression.engine.ts` — weight progression rules (linear/double/undulating/conjugate)
- `split-selector.engine.ts` — scoring split selector (18 splits)

The existing periodization has `periodizationType: 'auto' | 'linear' | 'undulating' | 'block'` and `cycleType` in `TrainingInput`/`MacrocycleInput`. The `block` type exists but is not fully implemented — it falls through to default behavior.

## What Block Periodization Means

Block periodization (В. А. Issurin) divides training into specialized blocks of 2-4 weeks, each focusing on a specific quality:
1. **Accumulation block** (2-4 wk) — high volume, low intensity, GPP, aerobic base
2. **Transmutation block** (2-4 wk) — moderate volume, high intensity, sport-specific
3. **Realization block** (1-2 wk) — low volume, peak intensity, competition prep

Blocks run sequentially, and residual training effects carry over. Unlike concurrent (undulating) where all qualities are trained weekly, block trains ONE quality per block.

## Proposed Architecture

### 1. New `BlockDefinition` Type (in `types.ts`)

```typescript
interface BlockDefinition {
  id: string;                         // 'accumulation' | 'transmutation' | 'realization'
  name: string;                       // 'Аккумуляция' | 'Трансмутация' | 'Реализация'
  durationWeeks: number;              // 2-4
  primaryQuality: string;             // 'volume' | 'intensity' | 'peak'
  volumeMultiplier: number;           // 1.0-1.3 for accum, 0.7-1.0 for transm, 0.4-0.7 for real
  intensityMultiplier: number;        // 0.6-0.8 for accum, 0.85-1.0 for transm, 1.0-1.1 for real
  rirTarget: string;                  // '2-3' | '1-2' | '0-1'
  frequencyMod: number;               // days/week modifier (±1)
  exerciseRotation: boolean;          // rotate exercises each block?
  deconditioningRisk: string;         // 'low' | 'medium' | 'high' — what quality degrades
}
```

### 2. Block Sequences (in `training-periodization.engine.ts`)

Add block sequence definitions:

```typescript
const BLOCK_SEQUENCES = {
  beginner: [
    { id: 'accumulation', weeks: 3 },
    { id: 'transmutation', weeks: 3 },
  ],
  intermediate: [
    { id: 'accumulation', weeks: 3 },
    { id: 'transmutation', weeks: 2 },
    { id: 'realization', weeks: 1 },
  ],
  advanced: [
    { id: 'accumulation', weeks: 4 },
    { id: 'transmutation', weeks: 3 },
    { id: 'realization', weeks: 1 },
  ],
  enhanced: [
    { id: 'accumulation', weeks: 4 },
    { id: 'transmutation', weeks: 3 },
    { id: 'realization', weeks: 1 },
    { id: 'active_rest', weeks: 1 },   // active recovery block between macrocycles
  ],
};
```

### 3. `generateBlockPlan()` Function

```typescript
function generateBlockPlan(input: TrainingInput): MacrocyclePlan {
  // 1. Select block sequence based on level
  // 2. For each block, generate 2-4 microcycles with block-specific parameters
  // 3. Each microcycle inherits: volumeMultiplier, intensityMultiplier, rirTarget
  // 4. Accumulation → high frequency, PPL/upper-lower, 8-12 reps, RIR 2-3
  // 5. Transmutation → moderate frequency, conjugate cluster sets, 3-6 reps, RIR 1-2
  // 6. Realization → low frequency, peaking singles/competition, 1-3 reps, RIR 0-1
  // 7. Output: MacrocyclePlan (same type as existing)
}
```

### 4. `selectExercisesForBlock()` Function

Each block selects exercises differently:
- Accumulation: main lifts + 2-3 accessories per session, high variety
- Transmutation: main lifts + 1 accessory, conjugate max-effort/dynamic-effort
- Realization: competition lifts only, peaking wave

### 5. UI Integration

In `TrainingScreen.tsx`:
- When `periodizationType === 'block'`, show block sequence editor:
  - Drag-reorder blocks
  - Adjust weeks per block
  - Preview: "Аккумуляция (3 нед) → Трансмутация (3 нед) → Реализация (1 нед)"
- `generatePlan()` routes to `generateBlockPlan()` when block type selected
- RIR matrix and progression engine adjust for current block phase

### 6. Changes to Existing Files

| File | Change |
|------|--------|
| `src/core/types.ts` | Add `BlockDefinition` type; add `blockSequence` optional field to `TrainingInput`/`MacrocycleInput` |
| `src/engines/training-periodization.engine.ts` | Add `generateBlockPlan()`, `BLOCK_SEQUENCES`, `selectExercisesForBlock()`, `generateBlockMicrocycle()` |
| `src/engines/training.engine.ts` | Route `periodizationType === 'block'` → `generateBlockPlan()`; adjust `calcTraining()` to accept block phase override |
| `src/engines/rir-matrix.engine.ts` | No changes needed — RIR lookup already phase-aware; map block phases to mesocycle phases (accum→base, transm→build, realization→peak) |
| `src/engines/progression.engine.ts` | Add block-aware deload trigger: automatic 1-week deload between blocks |
| `src/engines/split-selector.engine.ts` | No changes needed — split selection is goal/level/days-based, block just modifies execution |
| `src/ui/screens/TrainingScreen.tsx` | Add block sequence UI in plan tab + cycles tab; show block phase in weekly calendar |

### 7. Estimated Effort

- Types: 30 min
- Block plan generator: 3-4 hours
- UI: 2-3 hours
- Integration + tests: 1-2 hours
- **Total: ~7-10 hours**

## Alternatives Considered

1. **Manual block entry** (user defines each block) — rejected for UX complexity vs auto-generation
2. **Extend mesocycle types** to include accumulation/transmutation/realization as subtypes — viable but would complicate existing periodization logic
3. **Keep as separate engine file** (`training-block.engine.ts`) — recommended for modularity if block logic grows beyond 300 lines
