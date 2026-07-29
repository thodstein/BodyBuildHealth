# BB-AUTO-IMPROVEMENT-PLAN.md  
*Jul 29 2026*

## Priority 1: RIR/tempo/reps by training focus ✅ DONE
- `bb-goal-types.ts` created (BBTrainingFocus, FOCUS_RIR_TABLE, FOCUS_REPS_TABLE)
- `bb-builder.engine.ts`: charReps/bbRir use FOCUS tables; 9 new BBBuilderInput fields; recovery/nutrition multipliers
- `bb-tempo-rest.ts`: tempoFor(phase) per ACSM 2023
- `tsc --noEmit` 0 errors, `vite build` OK

## Priority 2: 8 new split patterns (to do)
Add to bb-split-patterns.ts:
- `upper_lower_5` - Upper/Lower 5×/week (2.5× per muscle)
- `fullbody_5` - Fullbody 5×/week (max frequency)
- `upper_lower_6` - Upper/Lower 6×/week (3× per muscle)
- `ppl_3` - PPL 3×/week (full body per session)
- `bro_6` - Bro split 6×/week (1 day rest)
- `ppl_rest_ppl` - PPL×2 6×/week (rest mid-week)
- `push_pull_legs_4` - Push/Pull/Legs 4×/week (lower frequency)
- `upper_lower_rest_3` - U/L 3×/week with rest after each session

## Priority 3: Level-based sets (to do)
- accessoryBase/accessoryBoost/exerciseCount/primaryBase - make level-aware

## Priority 4: Eccentric overload (to do)
- BBBuilderInput.eccentricMult (1.0/1.1/1.2)
- Apply to weight calculation in buildSession

## Priority 5: Volume/RIR/reps/rest progression (to do)
- Weekly progression MEV→MAV→MRV in buildBBPlan
- RIR drift -0.5/week, rest -15s/week

## Priority 6: Commit (to do)
- git add + git commit after all priorities
