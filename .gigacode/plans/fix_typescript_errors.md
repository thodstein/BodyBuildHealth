# TypeScript Error Fix Plan

## Overview
Fix 65 TypeScript errors across 14 files in the BodyBuildHealth project.

## Root Causes

### 1. Function Signature Mismatches
- `calculateRiskFromAnalyses` in `risk-calculator-v2.engine.ts` accepts 1 argument but called with 2
- `calculatePenaltyCoefficients` requires 6 arguments but called with 2

### 2. Type Mismatches
- `RiskCalculationResult` has `{systemContributions, totalRisk}`
- `RiskResult` has `{overallRaw, overallNet, systemBreakdown, mechanismBreakdown, mechanismDetail}`
- Calling code expects `RiskResult` but gets `RiskCalculationResult`

### 3. Missing Module Imports
- `../../core/types` - exists
- `../../core/exercise-catalog` - exists
- `../../core/pharma-database` - exists
- `../../core/constants` - exists
- `../../core/risk-info` - exists
- `../../core/data-link` - exists
- `../../engines/training.engine` - exists
- `../../engines/training-periodization.engine` - exists
- `../../engines/split-selector.engine` - exists
- `../../engines/progression.engine` - exists

### 4. Missing LinkedData Fields
- `pharmaRisks`, `supportRisks`, `trainingRisks`, `nutritionRisks` not in `LinkedData`

## Solution Approach

### Step 1: Fix `calculateRiskFromAnalyses` signature
**File**: `src/engines/risk-calculator-v2.engine.ts`

**Change**: Accept 2 arguments (`RiskResult`, `LabPoint[]`) and return `RiskResult`

```typescript
export function calculateRiskFromAnalyses(
  riskResult: RiskResult, 
  labs: LabPoint[]
): RiskResult {
  // Convert systemContributions to systemBreakdown format
  // Return RiskResult with overallRaw, overallNet, systemBreakdown
}
```

### Step 2: Fix `calculatePenaltyCoefficients` call
**File**: `src/ui/screens/RiskScreen.tsx`

**Change**: Pass all 6 required arguments:
```typescript
calculatePenaltyCoefficients(
  linked.profile?.phase || 'baseline',
  linked.labs || [],
  [], // submittedDiagnostics
  1, // courseWeek
  linked.course,
  forceNoLabs
)
```

### Step 3: Add missing fields to `LinkedData`
**File**: `src/core/data-link.ts`

**Change**: Add fields for aggregated risks:
```typescript
export interface LinkedData {
  // ... existing fields
  pharmaRisks: RiskResult | null;
  supportRisks: RiskResult | null;
  trainingRisks: RiskResult | null;
  nutritionRisks: RiskResult | null;
}
```

### Step 4: Fix all import paths
**Files**: All files with "Cannot find module" errors

**Action**: Verify all import paths are correct relative to `src/ui/screens/`

### Step 5: Fix implicit any types
**Files**: `PlanTraining.tsx`, `PlanUtils.ts`, `RiskDetails.tsx`

**Action**: Add explicit type annotations to map/filter callbacks

### Step 6: Fix NutritionScreen types
**File**: `src/ui/screens/NutritionScreen.tsx`

**Action**: Define `FoodItem` interface with proper fields

### Step 7: Fix ChartJS type mismatch
**File**: `src/ui/screens/NutritionScreen_parts/NutritionCharts.tsx`

**Action**: Use correct type for `legend.position`

## Implementation Order

1. Fix `calculateRiskFromAnalyses` in `risk-calculator-v2.engine.ts`
2. Fix `RiskScreen.tsx` calls and `LinkedData` interface
3. Fix `LabsScreen.tsx` calls
4. Fix all import paths
5. Fix implicit any types
6. Fix NutritionScreen types
7. Fix ChartJS type mismatch
8. Run `npx tsc --noEmit` to verify

## Files to Fix

- `src/engines/risk-calculator-v2.engine.ts`
- `src/core/data-link.ts`
- `src/ui/screens/RiskScreen.tsx`
- `src/ui/screens/LabsScreen.tsx`
- `src/ui/screens/NutritionScreen.tsx`
- `src/ui/screens/NutritionScreen_parts/NutritionCharts.tsx`
- `src/ui/screens/NutritionScreen_parts/NutritionDiary.tsx`
- `src/ui/screens/NutritionScreen_parts/NutritionOverview.tsx`
- `src/ui/screens/PlanScreen_parts/PlanExercises.tsx`
- `src/ui/screens/PlanScreen_parts/PlanTraining.tsx`
- `src/ui/screens/PlanScreen_parts/PlanUtils.ts`
- `src/ui/screens/RiskScreen_parts/RiskDetails.tsx`
- `src/ui/screens/RiskScreen_parts/RiskMatrix.tsx`
- `src/ui/screens/RiskScreen_parts/RiskOverview.tsx`
- `src/ui/screens/LabsScreen_parts/LabsOverview.tsx`
- `src/ui/screens/LabsScreen_parts/LabsResults.tsx`

## Verification

Run after all fixes:
```bash
npx tsc --noEmit
npx vite build
```
