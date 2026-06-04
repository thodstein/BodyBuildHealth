# Phase 5.9 — Penalty per System + "Без анализов" Button — SUMMARY

## ✅ Completed

### 1. RiskScreen.tsx - Penalty Application Logic

**Added State Variables:**
```typescript
const [applyPenalty, setApplyPenalty] = useState<boolean>(false);
const [forceNoLabs, setForceNoLabs] = useState<boolean>(false);
```

**Implementation Details:**
- `applyPenalty` - tracks whether penalty should be applied (existing)
- `forceNoLabs` - manual toggle for applying penalty without lab data

**Penalty Application Logic:**
```typescript
const shouldApplyPenalty = forceNoLabs || pen.noLabsPenalty;
if (shouldApplyPenalty && finalResult.systemBreakdown) {
  for (const sys of RISK_SYSTEMS) {
    if (finalResult.systemBreakdown[sys]) {
      finalResult.systemBreakdown[sys].raw = Math.min(100, finalResult.systemBreakdown[sys].raw * pen.totalMultiplier);
      finalResult.systemBreakdown[sys].net = Math.min(100, finalResult.systemBreakdown[sys].net * pen.totalMultiplier);
    }
  }
  finalResult.overallRaw = Math.min(100, finalResult.overallRaw * pen.totalMultiplier);
  finalResult.overallNet = Math.min(100, finalResult.overallNet * pen.totalMultiplier);
}
```

**UI Changes:**
- Added "🚫 БЕЗ АНАЛИЗОВ (Штраф)" button in overview tab
- Button shows current state: "✅ Применён штраф" or "🚫 БЕЗ АНАЛИЗОВ (Штраф)"
- Penalties block displays detailed breakdown with missing labs list
- Fallback warning shows when no lab data available

### 2. LabsScreen.tsx - Risks Tab Enhancement

**Updated Risks Tab:**
- When no labs: Shows clear message about applying penalty
- Provides link to "Input" tab for entering lab data
- Button提示 (hint) to apply penalty in RiskScreen overview

### 3. Penalty Coefficients System

**From `src/engines/labs-penalty.engine.ts`:**
```typescript
export interface PenaltyCoefficients {
  labPenalty: number;              // labRatio * 0.40 (or 0.50 if >=90% missing)
  diagnosticPenalty: number;       // diagRatio * 0.25 (or 0.35 if >=90% missing)
  totalMultiplier: number;         // 1.0 + labPenalty + diagnosticPenalty (max 2.0)
  missingLabsForPhase: string[];
  missingDiagnosticsForPhase: string[];
  noLabsPenalty: boolean;
  noDiagnosticsPenalty: boolean;
}
```

**Penalty Calculation:**
- `labPenalty = labRatio * 0.40` (max 0.50 when >=90% missing)
- `diagnosticPenalty = diagRatio * 0.25` (max 0.35 when >=90% missing)
- `totalMultiplier = 1.0 + labPenalty + diagnosticPenalty` (capped at 2.0)

### 4. Risk Aggregation

**All Risk Sources:**
- Pharma (Medications)
- Support (Supplements)
- Labs (Laboratory Analyses)
- Training (Workout Load)
- Nutrition (Dietary Intake)

**Aggregation Method:**
- `Math.max()` for combining pharma risks with lab risks
- Penalty applied to ALL systems via `totalMultiplier`
- Per-system breakdown visible in penalty block

## Build Status

```bash
✓ TypeScript compilation: PASS (`npx tsc --noEmit`)
✓ Vite build: SUCCESS (`npx vite build`)
```

## Files Modified

### Core Files:
- `src/ui/screens/RiskScreen.tsx` - Added `forceNoLabs` state, penalty toggle button
- `src/ui/screens/LabsScreen.tsx` - Updated risks tab with penalty hint

### Documentation:
- `AGENTS.md` - Phase 5.9 summary added
- `PHASE_59_SUMMARY.md` - This file

### Plan Files:
- `.gigacode/plans/1780535048793-hidden-knight.plan.md` - Phase 5.9 statistics updated

## User Requirements Met

### Original Issue:
> "кнопка без анализов должна назначать штраф" - the button should APPLY the penalty, not reset it

### Resolution:
- ✅ Button applies penalty when clicked (sets `forceNoLabs = true`)
- ✅ Penalty is applied to all systems (hepatic, cardio, endocrine, neuro, hematologic, reproductive, renal, musculoskeletal)
- ✅ Works without lab data being entered
- ✅ Clear UI feedback showing current state
- ✅ Detailed breakdown of which labs are missing

### Additional Requirements:
- ✅ All risks aggregated from all sources
- ✅ Buttons work without lab data
- ✅ Dark theme with green accent #00e68a
- ✅ All UI text in Russian

## Testing Checklist

- [x] RiskScreen shows "🚫 БЕЗ АНАЛИЗОВ (Штраф)" button
- [x] Button toggles state correctly
- [x] Penalty applied when button clicked
- [x] Risk values increase by `totalMultiplier`
- [x] All 8 systems affected equally
- [x] Works with no lab data entered
- [x] Shows missing labs list in penalty block
- [x] LabsScreen risks tab shows penalty hint

## Deploy Status

- [x] Build successful
- [x] TypeScript compilation pass
- [x] Ready for Vercel deployment

---

**Phase Complete:** Phase 5.9 (Penalty per system + "Без анализов" button)
**Total Progress:** 52/52 days (100%)
**Status:** READY FOR DEPLOY
