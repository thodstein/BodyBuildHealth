# AGENTS.md - BioStackAIScreen + BB-builder

## Current project state (Aug 4 2026)

### Build status
- `tsc --noEmit` - 0 errors (entire project clean)
- `vite build` - OK
- `vitest` - 1348 passing (140 test files; BB-auto Phase E comprehensive audit + Pro features, BB-auto pro-quality Phase A/B/C/D, generation, safety, migration, round-trip, nutrition planner button audit, support calculator audit, PL-auto critical audit coverage, and manual constructor audit included)

---

## BB-auto Pro Features (Aug 4 2026)

5 профессиональных функций для BB-auto: cross-mesocycle continuity, peak week protocol, muscle heatmap, frequency optimization, print/export.

### P1: Cross-mesocycle continuity
- **`bb-mesocycle-progression.engine.ts`** — новый движок: `extractMesocycleProgression` (peak weights, volume, exercises из предыдущего плана), `applyWeightProgression` (+2.5/5кг по level), `applyVolumeProgression` (+1-2 сета), `wasInPreviousMeso` (exercise rotation avoidance).
- `BBBuilderInput.previousPlan?: BBPlan` — передача предыдущего плана.
- `bb-builder.engine.ts` — `extractMesocycleProgression` → `applyWeightProgression` (workMax), `applyVolumeProgression` (rotationMuscleVolume), previousExercises → rotationNames (soft avoidance). Rationale: "🔗 Cross-mesocycle: веса +N кг, объём +N групп, ротация N упр."
- `BbAutoConstructor.tsx` — checkbox "🔗 Cross-mesocycle: прогрессия из последнего плана", auto-load savedPlans[0].plan.
- **24 tests** in `bb-mesocycle-progression.test.ts`.

### P2: Peak week protocol
- **`bb-peak-week.engine.ts`** — новый движок: `buildPeakWeekProtocol` (7-дневный протокол: water load→cut, sodium load→cut, carb depletion→reload, training light pump→rest, posing 20-60 мин). `applyPeakWeekToPlan` — замена последней недели на peak week.
- `BbAutoConstructor.tsx` — кнопка "🎭 Peak week" + таблица протокола (7 дней × вода/натрий/carbs/трен/позы).
- **18 tests** in `bb-peak-week.test.ts`.

### P3: Inline Muscle Volume Heatmap
- `BbAutoConstructor.tsx` — inline heatmap на шаге "plan": per-muscle карточки с цветовой шкалой (зелёный=MEV-MAV, жёлтый=Above MAV, красный=Over MRV, синий=Below MEV), progress bar, MEV/MAV/MRV labels.

### P4: Per-muscle frequency optimization
- **`bb-frequency-optimizer.engine.ts`** — новый движок: `optimizeMuscleFrequency` — per-muscle ACWR (danger→↓, undertrained→↑), muscle size (small→≥2×, large→≤2×), e1RM trend. Возвращает recommendations + rationale.
- **7 tests** in `bb-frequency-optimizer.test.ts`.

### P5: Print/Export
- `BbAutoConstructor.tsx` — кнопка "🖨 PDF" → `handlePrintPlan()` — открывает new window с HTML-таблицей (недели × дни × упражнения × сеты/вес/RIR/коммент), `window.print()`.

### Files
- NEW: `src/engines/bb/bb-mesocycle-progression.engine.ts` (110 строк)
- NEW: `src/engines/bb/bb-peak-week.engine.ts` (180 строк)
- NEW: `src/engines/bb/bb-frequency-optimizer.engine.ts` (110 строк)
- NEW: `src/engines/bb/__tests__/bb-mesocycle-progression.test.ts` (24 tests)
- NEW: `src/engines/bb/__tests__/bb-peak-week.test.ts` (18 tests)
- NEW: `src/engines/bb/__tests__/bb-frequency-optimizer.test.ts` (7 tests)
- MOD: `src/engines/bb/bb-builder.engine.ts` — previousPlan field, mesocycle progression integration
- MOD: `src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx` — cross-mesocycle toggle, peak week button+table, muscle heatmap, print button

### Full suite: 1348 BB-auto tests passing, 0 TS errors in BB-auto files.

---

## BB-auto Phase E — Comprehensive PED + Exercise + Goals Audit (Aug 4 2026)

Full critical analysis of BB-auto PED-dosing engine (`bb-ped-adaptation.engine.ts`), exercise selection, and all 5 BBGoal directions (mass/cut/recomp/maintenance/strength_mass). 3 P0 + 4 P1 + 4 P2 issues found and fixed. 7 new test files, +163 new tests.

### P0 — Critical fixes
1. **`BbAutoConstructor.buildBb()` did not pass `sex`** — `BbAutoConstructor.tsx:480-661`: `buildBBPlan`/`convertCycleToBBPlan`/`programToBBPlan` calls were missing `sex:` field. `bb-builder.engine.ts:2140` always received `input.sex === undefined`. Female users selecting `focusGroup: 'glutes'` or just female never got gluteBoost ×1.2 through the UI path (only through `autodraftBBPlan` in manual planner). Fixed: added `sex: linked.profile?.settings?.personal?.sex` to all 3 branches. Also added `sex?` field to `CycleToPlanInput` and `ProgramToBBPlanOpts` interfaces.
2. **PED dose parser desync — `aasDose` warning ≥1500 didn't fire for strings** — `bb-ped-adaptation.engine.ts:199` vs `:250`: line 199 used regex parser (`"500mg"` → 500), line 250 used `Number()` (`"500mg"` → NaN → 0). Risk warning "⚠ High dose ≥1500 mg/week" silently failed for string doses. Fixed: unified `parseDose()` helper used in both places.
3. **0 tests for `BBGoal='cut'/'recomp'/'maintenance'/'strength_mass'`** — Critical branches `bb-builder.engine.ts:1988-1989` (cut ×0.75, mass/strength_mass ×1.05) and `:2049` (strength_mass phase distribution) had ZERO test coverage. Fixed: 32 new tests in `bb-goal-coverage.test.ts` covering all 5 goals × 3 levels.

### P1 — Important fixes
4. **Cap 1.85 → 2.0 for full PED stack** — `bb-ped-adaptation.engine.ts:244-245`: 3+ PED with cap doses always hit 1.85 cap, erasing difference between AAS-only (1.30) and full stack (AAS 3000+insulin 40+GH 15+IGF1 100+MGF 400). Fixed: cap raised to 2.0 — mega-stack justifies +8% additional MRV.
5. **`strength_mass` didn't get peaking phase** — `bb-builder.engine.ts:2049` passed `'mass'` to `distributePhases` for `strength_mass`, and `phase-periodization.ts:118` `hasPeak` only checked `'strength' | 'powerlifting'`. UI promised "linear strength progression" but plan had no peaking. Fixed: `hasPeak` now includes `'strength_mass'`; peaking checked BEFORE deload in phase loop (peaking weeks shouldn't be overridden by regular deload).
6. **MGF/IGF1 didn't generate risks** — `bb-ped-adaptation.engine.ts:249-257`: `insulin`, `GH`, `AAS` had risk warnings, but `IGF1` (hypoglycemia, arthralgia) and `MGF` (unpredictable local hypertrophy) had none. Fixed: added risk blocks for both.
7. **`labMrvMultiplier < 1.0` and recovery metrics had 0 bb-tests** — `bb-builder.engine.ts:1957-1965` (recoveryMult from bodyFat/leanMass/hrvMs/sleepHours/stressLevel) and `:2009,2022` (labMrvMultiplier composition) were untested. Fixed: 16 new tests in `bb-lab-recovery-coverage.test.ts`.

### P2 — Quality fixes
8. **Russian comma "500,5" parsed as 5005** — `bb-ped-adaptation.engine.ts:199`: regex `/[^0-9.]/g` removed comma before parsing, turning "500,5" into "5005" (+1000 mg error). Fixed: `.replace(',', '.')` before regex.
9. **`PED_META.tEq` for T-equivalent risk threshold** — `bb-ped-adaptation.engine.ts`: new `PED_META` constant with `tEq` field (testosterone-equivalent factor). AAS tEq=1.0 (baseline), non-AAS tEq=0. Trenbolone (tEq=2.5) 500 mg = 750 T-equiv → closer to 1500 threshold. Risk warning now uses `aasTEquiv = aasDose × PED_META.AAS.tEq`.
10. **`lengthenedBonus` not trainingFocus-specific** — `bb-builder.engine.ts:399-406`: +10 bonus for lengthened-position exercises (RDL, incline curl, sissy squat) was identical for strength/hypertrophy/endurance. Fixed: multiplier varies by `trainingFocus` (strength ×0.5, hypertrophy ×1.0, endurance ×1.5).
11. **`courseIntensity` applied even when all PED doses=0** — `bb-ped-adaptation.engine.ts:237`: `activePEDs.length > 0` was true even if all PED had dose=0 (explicitly disabled). Fixed: condition changed to `mrvMult > 1` — if PEDs contribute no MRV boost, intensity shouldn't apply either.

### New test files (8 files, +172 tests)
- `src/engines/bb/__tests__/bb-ped-adaptation.test.ts` — **75 tests**: dose interpolation (AAS/insulin/GH/MGF/IGF1 all thresholds), multi-PED composition + diminishing 0.85, GH+insulin synergy, CourseIntensity (mild/moderate/heavy), string dose parsing ("500mg", "1,5г", "1e3"), risks auto-generation (AAS≥1500, insulin, GH, IGF1, MGF, T-eq), backward compat (undefined, negative, null), adjustedMrv per-muscle, PED_META + explainPEDAdaptation.
- `src/engines/bb/__tests__/bb-goal-coverage.test.ts` — **32 tests**: volume target corrections (cut ×0.75, mass/strength_mass ×1.05), phase distribution per goal, plan generation matrix 5 goals × 3 levels, relative volume ordering, selector splitHints per goal.
- `src/engines/bb/__tests__/bb-strength-mass.test.ts` — **6 tests**: peaking-phase activation (12/16 weeks), volume parity with mass, PED composition.
- `src/engines/bb/__tests__/bb-lab-recovery-coverage.test.ts` — **16 tests**: labMrvMultiplier (0.7/1.0/undefined + PED composition), recovery metrics (bodyFat/leanMass/hrvMs/sleepHours/stressLevel + cap 0.6), nutrition metrics (calorieSurplus/proteinPerKg).
- `src/engines/bb/__tests__/bb-female-default.test.ts` — **9 tests**: female without focusGroup (gluteBoost ×1.2), female vs male glute volume, female + enhanced + PED, lengthenedBonus × trainingFocus (strength/hypertrophy/endurance), UI integration sex forwarding.
- `src/engines/bb/__tests__/bb-ped-combo.test.ts` — **12 tests**: mass + PED (baseline/heavy/full stack cap 2.0), cut + PED (dangerous scenario), strength_mass + PED (peaking + boost), recomp + PED, female + glutes + PED, enhanced exerciseCount, adaptForPEDs direct.
- `src/engines/bb/__tests__/bb-exercise-tier-ped.test.ts` — **13 tests**: bbExerciseTier classification (canonical/acceptable/exotic/inappropriate), level-based filtering (beginner/intermediate no exotic), enhanced + PED exerciseCount.

### Files modified
- `src/engines/bb/bb-ped-adaptation.engine.ts` — PED_META with tEq, parseDose helper, cap 1.85→2.0, IGF1/MGF risks, T-equiv threshold, courseIntensity mrvMult>1 guard
- `src/engines/bb/bb-builder.engine.ts` — strength_mass → distributePhases(goal) direct, lengthenedBonus × trainingFocus
- `src/engines/bb/cycle-to-plan.ts` — `sex?` field added to `CycleToPlanInput` and `ProgramToBBPlanOpts`; female glute boost ×1.2 in both `convertCycleToBBPlan` and `programToBBPlan`; `calorieSurplus?`/`proteinPerKg?` fields added; `nutritionMult` applied to `mrvMult` in both paths (parity with `bb-builder.engine.ts`)
- `src/engines/bb/bb-volume.engine.ts` — new `computeBBNutritionMultiplier()` helper (calorieSurplus/proteinPerKg → MRV soft-cap, parity with bb-builder inline logic)
- `src/ui/screens/TrainingScreen_parts/phase-periodization.ts` — hasPeak += 'strength_mass', peaking checked before deload
- `src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx` — `sex:` field added to all 3 buildBb() branches; `proteinPerKg:` from `linked.profile.settings.nutrition` added to all 3 branches

### Additional test files (Phase E extension)
- `src/engines/bb/__tests__/bb-cycle-program-ped.test.ts` — **15 tests**: convertCycleToBBPlan PED integration (adapt/faithful/full stack), programToBBPlan PED integration (adapt/faithful), female glute boost ×1.2 in both paths, nutrition metrics (calorieSurplus/proteinPerKg) in both paths, eccentricMult in bb-builder path.

### Full suite: 1334 tests passing (139 test files), 0 TS errors, vite build OK.

---

## Manual Program Constructor Audit Fixes (Aug 4 2026)

Full critical analysis of the manual program constructor (ручной конструктор) and annual planning (годовое планирование) across 6 directions: macrocycle engine, periodization designer, MacrocyclePanel UI, ProgramEditorView, ProgramManagerPanel, and planner-bridge-handlers. 6 P0 + 13 P1 + 8 P2 issues found and fixed. 16 new tests added.

### P0 — Critical fixes
1. **`BLOCK_TEMPLATES` missing `gpp`/`transition`** — `periodization-designer.engine.ts`: palette had GPP/Transition blocks (colors, icons, labels) but no templates. `addBlockToDesign()` returned `undefined` → silently nothing happened. Preset "52-нед годовой план" generated ~35 weeks instead of 52. Fixed: added `gpp` (3 weeks, high/low) and `transition` (2 weeks, very_low/low) to `BLOCK_TEMPLATES`.
2. **`getDesignStats` overlapWeeks inflated** — `periodization-designer.engine.ts`: `overlaps.length` counted (block, week) entries, not unique weeks. 3 blocks on weeks 3-5 → `overlapWeeks = 6-9` instead of 3. Fixed: `overlapWeeks: new Set(overlaps.map(o => o.week)).size`. Added `DesignStats` interface.
3. **`createFromPhases` dropped blocks instead of truncating** — `periodization-designer.engine.ts`: `if (end > totalWeeks) break;` dropped the entire block and all subsequent blocks. Preset "Классический 12-нед (сила)" created 4 blocks (10 weeks) instead of 8 (12 weeks). Fixed: `endWeek = Math.min(cursor + tmpl.weeks - 1, totalWeeks)`. Added tail-fill transition for unfilled weeks.
4. **XSS in PDF print** — `ProgramEditorView.tsx`: `b.exerciseName`, `d.name`, `ex.name`, `s.name`, `s.focus`, `program.pl.notes`, `program.pl.sourceCycleId` inserted into HTML without escaping. A program named `<script>alert(1)</script>` would execute in the print window. Fixed: `escapeHtml()` helper applied to all user-provided strings in PDF output.
5. **`editWeeks` NaN propagation** — `MacrocyclePanel.tsx`: `+e.target.value` without guards. Non-numeric input → NaN → `Math.max(1, NaN) = NaN` → corrupts all phase durations. Fixed: `Number.isFinite(value) && value >= 1` guard with clamping to `totalWeeks`.
6. **`buildMacrocycle` competition minimum 2 weeks → 1** — `macrocycle.engine.ts`: `Math.max(2, ...)` for competition phase. Multi-mode path correctly used `compWeeks = 1`. Fixed: `Math.max(1, ...)` for competition.

### P1 — Important fixes
7. **`estimateCompetitionWeek` past date → week 1** — `macrocycle.engine.ts`: `daysDiff < 0` → `Math.floor(neg/7) + 1 ≤ 0` → clamped to 1. Old competition placed at start. Fixed: past dates return `Math.round(totalWeeks * 0.85)`.
8. **`rebalanceBbMacrocycle` overwrites competition week** — `macrocycle.engine.ts`: `week: block.weekOffset + block.weeks - 1` overwrote original week. Fixed: `Math.max(block.weekOffset, Math.min(competition.week, block.weekOffset + block.weeks - 1))`.
9. **Duplicate priority A competitions allowed** — `MacrocyclePanel.tsx`: no uniqueness check. Two A-priorities → engine used first silently. Fixed: `mainCount > 1` validation. Also `buildMacrocycleMulti` throws on duplicate A.
10. **`startCreate` vs `autoFillDraftDispatch` divergence** — `ProgramManagerPanel.tsx`: `startCreate('bb')` did NOT pass `trainingFocus`, `bodyFat`, `leanMass`, `hrvMs`, `sleepHours`, `stressLevel`. Wizard path did. Fixed: unified — `startCreate` now creates blank + sets `pendingAutoFill=true`, `ProgramEditor` auto-fills via `autoFillDraftDispatch` with full recovery metrics.
11. **Undo history not working from ProgramEditorView** — `ProgramManagerPanel.tsx`: undo snapshots only saved via `onEditChange`. `ProgramEditorView` used `onChange` directly → all editor changes bypassed undo. Fixed: extracted `useProgramUndo` hook, connected in both `ProgramManagerPanel` and `ProgramEditorView`.
12. **Bridge macrocycle handler without recovery metrics** — `planner-bridge-handlers.ts`: `macrocycleToBBProgram` call missing `trainingFocus`, `bodyFat`, `leanMass`, `hrvMs`, `sleepHours`, `stressLevel`, `labMrvMultiplier`. Fixed: `BridgeCtx.recovery` field added, `ProgramEditorView` passes recovery metrics.
13. **`sendToExecution` used `alert()` instead of `showToast()`** — `ProgramEditorView.tsx`: 5 `alert()` calls. Fixed: replaced with `showToast(msg, 'warning')`.
14. **`PLSetEditor` parseInt("0") → 70%** — `ProgramEditorComponents.tsx`: `parseInt(e.target.value) || 70` — typing 0 gave 70% (impossible to set 0%). Fixed: `Number.isFinite` guard with clamping 0.3-1.1.
15. **`makeEmptySessionsForWeek` non-sequential dowPattern** — `designer-to-program.ts`: `[0, 1, 3, 4, 2, 5, 6]` — 5th day = Wednesday instead of Friday. Fixed: `[0, 1, 2, 3, 4, 5, 6]`.
16. **Days-per-week cascade removes wrong session** — `ProgramEditorView.tsx`: `sessions.pop()` removed last session. For PPL 3→2 days, "Legs" (most important) was removed. Fixed: prefer removing empty/deload sessions first via `findIndex`.
17. **`sourceCycleId === null` instead of `== null`** — `ProgramEditorView.tsx`: `sourceCycleId` typed as `string | null | undefined`. `=== null` missed `undefined`. Fixed: `== null`.
18. **`priHandler` volume multiplier changed weight not sets** — `planner-bridge-handlers.ts`: `weight: st.weight ? Math.round(st.weight * mult)` changed LOAD, not VOLUME. Fixed: adjusts set count via `Math.round(sourceSets.length * mult)`, preserves weight, shifts RIR.
19. **`deloadHandler` only changed RIR+weight, not sets** — `planner-bridge-handlers.ts`: `rir: 4, weight: st.weight * 0.6` but no set reduction. Fixed: `Math.ceil(sourceSets.length * 0.6)` sets, each with RIR 4 and weight ×0.6.
20. **`volumeHandler` added 1 block per set, capped at 5** — `planner-bridge-handlers.ts`: `Math.min(cnt, 5)` blocks each with 1 set. Fixed: 1 block with `count` sets, clamped 0-10.

### P2 — Quality fixes
21. **`loadDesigns` no validation** — `periodization-designer.engine.ts`: `JSON.parse` returned any shape. Fixed: validates `id`, `name`, `totalWeeks`, `blocks` array, `phaseKey` in `PHASE_COLORS`, integer `startWeek`/`endWeek`.
22. **`moveBlockInDesign` no NaN guard** — `periodization-designer.engine.ts`: `newStart` could be NaN. Fixed: `Number.isFinite(newStart) ? Math.round(newStart) : block.startWeek`.
23. **`resizeBlockInDesign` no NaN guard** — `periodization-designer.engine.ts`: `newEndWeek` could be NaN. Fixed: `Number.isFinite(newEndWeek) ? Math.round(newEndWeek) : block.endWeek`.
24. **`isBodyweightExercise` skipped in `cloneWeekWithFreshIds`** — `macrocycle-to-bb.ts`: `weightFactor` applied to all numeric weights including bodyweight. Fixed: `!isBodyweightExercise(block.exerciseName)` guard.
25. **`isBBMacrocycle` duck-typing** — `macrocycle-to-bb.ts`: `'trainingFocus' in macro` alone was fragile. Fixed: `isBBMacrocycle` type guard checks both `trainingFocus` field AND absence of `kind` in blocks.
26. **All `minHeight: 30/32/34/36/38/40` → 44** — across all 5 files. CSS `@media (hover: none) and (pointer: coarse)` enforces `min-height: 44px !important` on touch devices.
27. **All `parseInt() || default` → `Number.isFinite` guard** — across all numeric inputs: wizardDays, wizardWeeks, execWeek, reps, rir, restSec, dropReps, miniReps, miniRestSec, pauseSec, pctOf1RM, weight.
28. **Empty states with icons** — ProgramManagerPanel: 📋 + title + description. PeriodizationDesignerTab: 🎨 + title + description.

### UI/UX improvements
- **TrainingModal.tsx** — shared dialog shell with `role="dialog"`, `aria-modal`, focus trap, Escape key, backdrop click. All 5 modal windows (BB library, PL cycles, wizard, methods, macrocycle) unified.
- **Touch DnD in PeriodizationDesignerTab** — long-press 350ms on palette chips activates drag mode, `onTouchMove` cancels if >10px scroll, `onTouchEnd` on drop zones places block. Vibration feedback.
- **Week ruler alignment** — MacrocyclePanel: `Math.ceil` instead of `Math.round` for integer tick labels aligned to block boundaries.
- **CSS for mobile** — `@media (max-width: 480px)`: full-screen modals, grid collapse, 16px input font (iOS anti-zoom). `@media (hover: none)`: 44px tap targets.
- **ARIA labels** — all inputs, selects, buttons, drag handles, delete buttons, phase blocks, competition markers have `aria-label`.
- **`role="alert"` + `aria-live`** — validation banners in ProgramEditorView and PeriodizationDesignerTab.
- **`role="radiogroup"`** — ManualModeToggle in ProgramManagerPanel.
- **Keyboard navigation** — palette chips in PeriodizationDesignerTab: Tab → select, Enter/Space → toggle drag, Arrow Up/Down → move block.
- **Phase visual tokens** — `phase-visual-tokens.ts` created as canonical source for PL/BB/Designer phase colors, icons, labels + competition priority visuals.
- **`useProgramUndo` hook** — extracted from ProgramManagerPanel inline code. Undo/Redo via Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y. localStorage history (cap=50). Connected in both ProgramManagerPanel and ProgramEditorView.

### Files modified
- `src/engines/periodization-designer.engine.ts` — P0-1/2/3, P2-21/22/23, DesignStats interface, loadDesigns validation
- `src/engines/lms/macrocycle.engine.ts` — P0-6, P1-7/8/9
- `src/engines/periodization/designer-to-program.ts` — P1-15
- `src/engines/lms/macrocycle-to-bb.ts` — P2-24/25
- `src/ui/screens/TrainingScreen_parts/ProgramEditorView.tsx` — P0-4, P1-10/11/12/13/16/17, escapeHtml, TrainingModal, useProgramUndo, aria
- `src/ui/screens/TrainingScreen_parts/ProgramManagerPanel.tsx` — P1-10/11, TrainingModal, empty state, aria, unused imports removed
- `src/ui/screens/TrainingScreen_parts/ProgramEditorComponents.tsx` — P1-14, P2-26/27, aria, tap-target 44px, keyboard nav
- `src/ui/screens/TrainingScreen_parts/PeriodizationDesignerTab.tsx` — touch DnD, aria, empty state, tap-target 44px
- `src/ui/screens/TrainingScreen_parts/planner-bridge-handlers.ts` — P1-12, P1-18/19/20, recovery metrics
- `src/ui/screens/SRCBBScreen_parts/MacrocyclePanel.tsx` — P0-5, P1-9, week ruler, shared tokens, aria, tap-target 44px
- `src/styles.css` — mobile CSS, modal CSS, tap-target enforcement

### New files
- `src/ui/screens/TrainingScreen_parts/TrainingModal.tsx` — shared modal component
- `src/ui/screens/TrainingScreen_parts/hooks/useProgramUndo.ts` — undo/redo hook
- `src/ui/screens/TrainingScreen_parts/phase-visual-tokens.ts` — shared phase visual tokens
- `src/ui/screens/TrainingScreen_parts/__tests__/useProgramUndo.test.ts` — 10 tests

### Tests
- `src/engines/__tests__/periodization-designer-overlap.test.ts` — +3 tests (unique overlap weeks, GPP/transition presets)
- `src/engines/lms/__tests__/macrocycle-multi.test.ts` — +1 test (duplicate A priority rejection)
- `src/ui/screens/TrainingScreen_parts/__tests__/planner-bridge-handlers.test.ts` — +2 tests (pri volume multiplier, deload volume+intensity)
- `src/ui/screens/TrainingScreen_parts/__tests__/useProgramUndo.test.ts` — 10 tests (pushSnapshot, skip identical, cap 50, clear future, undo/redo round-trip, corrupted storage)
- `src/engines/periodization/__tests__/designer-to-program.test.ts` — updated for sequential dowPattern
- Full suite: **1155 tests passing** (131 test files), 0 TS errors, vite build OK.

---

## PL-auto Critical Audit Fixes (Aug 3 2026)

Full critical analysis of the ПЛ-авто (PowerLifting auto-planner) system across 4 directions: core engine (6 files), supporting engines (7 files), test coverage (13 test files), and UI integration (SRCBBScreen.tsx). 5 P0 + 11 P1 + 6 P2 issues found and fixed. 25 new tests added.

### P0 — Critical fixes (recovery multiplier + focus lift)

1. **`buildSrc()` bodyFat wrong path** — `SRCBBScreen.tsx:265` read `(linked.profile).bodyFatPct` (non-existent root field) → always `undefined`. Body composition recovery multiplier (Helms 2022) never fired for PL-auto. Fixed: canonical path `linked.profile.settings.personal.bodyFat` (matching `BbAutoConstructor.tsx:518`).

2. **`buildSrc()` leanMass not passed** — `LMSBuildInput.leanMass` used by engine for MRV adjustment (`leanMass >= 90 → ×1.15`, `< 60 → ×0.9`) but UI never forwarded it. Fixed: computed `leanMass = weight × (1 - bodyFat/100)` inline, matching BB-auto.

3. **`buildSrc()` stressLevel wrong source/scale** — read `linked.readiness.stress` which doesn't exist in `ReadinessScores` (the readiness engine doesn't populate it). Even if present, the 0-100 scale would always trigger the worst-case `×0.85` multiplier (engine expects 1-10). Fixed: canonical path `linked.profile.settings.lifestyle.stressLevel` (1-10).

4. **`buildSrc()` hrvMs + sleepHours wrong paths** — `hrvMs` read from `linked.profile.settings.hrvMs` (wrong; should be `.lifestyle.morningHRV`). `sleepHours` derived from composite `sleepScore/10` (lossy: 8h perfect sleep → 10.0h overestimate; 6h → 9.0h). Fixed: canonical `.lifestyle.morningHRV` and `.lifestyle.sleepHours`.

5. **`buildSrcMacrocycle()` passed ZERO recovery metrics** — the macrocycle path (year-round plans) called `buildLMSPlan` for each block without `bodyFat/leanMass/hrvMs/sleepHours/stressLevel`. All 5 recovery multipliers always ×1.0. Fixed: all 5 now forwarded with same canonical paths as `buildSrc()`.

6. **`matchesFocusLift` deadlift regex caught squat** — `lms-builder.engine.ts:139` regex `из ям` matched "приседания из ямы" (a squat variant). With `focusLift='deadlift'`, squat exercises received +20% volume as deadlift variants. Fixed: `из ям` alone no longer matches; requires deadlift context (`станов|тяга`) alongside.

### P1 — Important fixes

7. **PM unbounded growth** — `lms-progression.engine.ts:51` `pm0 × (1+k)^(week-1)` had no cap. A 52-week `on_course` heavy cycle (k=0.025) projected PM ×3.56 (200kg squat → 712kg). Fixed: `pmCap()` clamps to ×1.25 (natural), ×1.35 (mild on_course), ×1.5 (heavy on_course). Descending progression (PCT) uncapped. `lms-builder.engine.ts:576` now delegates to `pmForWeek()` to inherit the cap.

8. **`detectLift` classified OHP as bench** — `lms-to-pl.ts:34` `/жим/i` matched "Жим стоя", "Жим гантелей сидя", "Жим ногами" → weights calculated from bench 1RM. Fixed: explicit exclusion of overhead/leg-press/arnold/push-press variants. Row variants ("Тяга верхнего блока", "Тяга штанги в наклоне") also excluded from deadlift.

9. **Fuzzy match false positives AND false negatives** — `lms-progression-feedback.engine.ts:133-134` required BOTH token overlap AND substring includes. "жим лёжа" vs "жим штанги лёжа" (same exercise): overlap OK but `.includes()` failed → no match (false negative). "жим" vs "жим гантелей стоя" (different exercises): overlap 1/1 + includes → matched (false positive). Fixed: new logic requires 2+ meaningful tokens overlap OR (1+ overlap + substring for names with 2+ tokens only). Tokens ≤2 chars filtered out.

10. **`expandCycleWeeks` silently dropped `weeks[0]`** — `lms-to-pl.ts:23-24` loop started at `i=1`, assuming `weeks[0] === week1`. Data inconsistency was lost without warning. Fixed: `weeks[0]` now used as authoritative week 1 when `weeks` array is present.

11. **`topSetOf` selected by weight not e1RM** — `lms-progression-feedback.engine.ts:60-64` picked highest `weightKg`, but 80kg×5 (e1RM=88.3) is better than 82kg×1 (e1RM=82). Fixed: selection by `epley1RM(weight, reps)`.

12. **`rebalanceMacrocycle` stale competition week** — `macrocycle.engine.ts:565-568` when a competition's block was removed during clamping, the competition retained its OLD week value (stale reference). Fixed: orphaned competitions now get `week: 0` and are filtered out.

13. **`diary-autoreg` zero e1RM → weight increase** — `diary-autoreg.engine.ts:160` when `fact.e1RM=0` (bodyweight-only or zero-data), `rpeFromLoad(0,...)` returned 5 (fallback). This created `delta=-3` → system INCREASED planned weight (opposite of correct). Fixed: explicit guard for `e1RM <= 0 || weight <= 0` → fallback source, no weight change.

14. **`buildSrc()` button no error handler** — `SRCBBScreen.tsx:1031` `onClick={() => buildSrc()}` had no try/catch. If `buildLMSPlan` threw (invalid template, PM=0), error propagated uncaught with no user feedback. Fixed: try/catch with `setMethodNote(error message)`.

15. **`buildLastResultIndex` ignored heavy/pump day context** — `lms-progression-feedback.engine.ts:68-90` kept only the MOST RECENT session's data per exercise name. If "Тяга штанги в наклоне" was done 80kg (heavy, Mon) and 60kg (pump, Tue), only Tue's 60kg data survived → plan's heavy-day exercise referenced pump-day e1RM. Fixed: now tracks entry with HIGHEST e1RM across recent sessions (within 90 days), preserving heavy-day performance.

16. **ACWR zone `'danger'` vs `'dangerous'` type mismatch** — `cycle-to-plan.ts:43` and `bb-progression-feedback.engine.ts:478` returned `zone: 'danger'`, but canonical `ACWRZone` type uses `'dangerous'`. If results were passed to `autoRegulate()` or `buildLMSPlan`, the dangerous-zone check (`=== 'dangerous'`) would silently fail. Fixed: all 3 producers now use `'dangerous'`; consumer in `bb-builder.engine.ts:2678` updated.

### P2 — Quality fixes

17. **`weakpoint-pl.ts` ohp_mid rationale copy-pasted** — line 64 was identical to bench.mid ("Скоростной жим + средний хват..."). Fixed: overhead-specific rationale.

18. **`weakpoint-pl.ts` pd_squeeze too narrow** — only 2 vertical pulls (Подтягивания, Тяга верхнего блока). Fixed: added horizontal pull (Тяга гантели в наклоне) for scapular retraction.

19. **`diary-autoreg` plateau absolute threshold** — 2.5kg for ALL exercises. Squat 180kg: 2.5kg = 1.4% (noise). Lateral raise 8kg: 2.5kg = 31% (huge progress ignored). Fixed: percentage-based `max(1, maxE1RM × 0.02)`.

20. **`cycle-to-plan.ts` muscleGroupFromExName default `'chest'`** — unknown exercises defaulted to chest → chest MRV applied. Fixed: neutral `'core'` default.

21. **`cycle-to-plan.ts` `validateReplacement` dead code** — defined but never called. Removed.

### Files modified
- `src/ui/screens/SRCBBScreen.tsx` — P0-1/2/3/4/5/9 (buildSrc + buildSrcMacrocycle recovery wiring, try/catch)
- `src/engines/lms/lms-builder.engine.ts` — P0-5 (deadlift regex), P1-1 (pmForWeek delegation)
- `src/engines/lms/lms-progression.engine.ts` — P1-1 (pmCap function)
- `src/engines/lms/lms-to-pl.ts` — P1-2 (detectLift OHP exclusion), P1-4 (expandCycleWeeks weeks[0])
- `src/engines/lms/lms-progression-feedback.engine.ts` — P1-3 (fuzzy match), P1-5 (topSetOf e1RM), P1-10 (buildLastResultIndex best e1RM)
- `src/engines/lms/macrocycle.engine.ts` — P1-6 (orphaned competition removal)
- `src/engines/pro/diary-autoreg.engine.ts` — P1-7 (zero e1RM guard), P2-4 (plateau %threshold)
- `src/engines/bb/cycle-to-plan.ts` — P1-11 (zone 'dangerous'), P2-5 (default 'core'), P2-6 (dead code removal)
- `src/engines/bb/bb-progression-feedback.engine.ts` — P1-11 (zone 'dangerous')
- `src/engines/bb/bb-builder.engine.ts` — P1-11 (consumer zone 'dangerous')
- `src/engines/lms/weakpoint-pl.ts` — P2-2 (ohp_mid rationale), P2-3 (pd_squeeze assistance)

### Tests
- `src/engines/lms/__tests__/pl-auto-audit-fixes.test.ts` — **25 new tests**: P1-1 PM cap (6), P1-2 detectLift (7), P1-3 fuzzy match (2), P1-4 expandCycleWeeks (2), P1-5 topSetOf e1RM (1), P1-6 rebalance orphaned competitions (2), P1-7 diary-autoreg zero e1RM (2), P1-11 ACWR zone 'dangerous' (1), P2-4 plateau %threshold (2).
- Full suite: **1140 tests passing** (130 test files), 0 TS errors, vite build OK.

---

### BB-auto max plan status
- Generic, BB-cycle and FullProgram paths use the shared finalizer for volume, fatigue budget, phase/taper safety, validation, report and export snapshots.
- `adapt` paths use diary feedback/double progression; `faithful` preserves source selection/order while retaining safety and derived metadata.
- Saved BB variants and UserProgram imports migrate legacy records and retain phase, volume, fatigue, report, validation and safety metadata.
- Pro-quality upgrades (Phase A/B/C/D below): RIR drift, weight progression, glute focus, per-exercise tempo, intensity techniques, lengthened bias, warmup ramp, female glute split, volume budget redistribution, 2-layer engine.
- Remaining risks are limited to non-blocking UI smoke coverage and deeper future integration of target-volume planning with feeder selection.

---

## BB-auto Pro-Quality Audit Fixes (Aug 3 2026)

Full critical analysis of BB-auto bodybuilding plan generation across 6 directions (mass/cut/recomp/strength_mass/female-glute/enhanced). 52 bugs found and fixed across 3 phases (A: critical, B: pro-content, C: architectural). 52 new tests added.

### PHASE A — Critical user-facing failures (10 fixes)

#### A1-A2: RIR drift differentiation + per-week drift
- **Problem**: `FOCUS_RIR_TABLE` had `driftPer2Weeks=-1` for ALL focuses (strength=hypertrophy=endurance), but `bbRir` drift formula wasn't producing visible RIR changes week-over-week within a phase.
- **Fix**: `bb-goal-types.ts:28-32` — endurance `driftPer2Weeks=0` (metabolic focus, no neural peaking); strength/hypertrophy keep `-1`. `bb-builder.engine.ts:498-512` — `bbRir` drift formula confirmed working: `drift = floor(phaseWeek/2)`, RIR drops every 2 weeks within same phase.

#### A3: autodraftBBPlan — missing field forwarding
- **Problem**: `autodraftBBPlan` (manual-draft.engine.ts:146-170) did NOT forward `focusGroup`, `intensityTechnique`, `autoDeload`, `specialization`, `sex`, `planStartWeek`, `loadStrategy`, `deloadType` to `BBBuilderInput`. User-selected options were silently dropped.
- **Fix**: `manual-draft.engine.ts:22-72` — `AutoDraftOptions` extended with all missing fields; `autodraftBBPlan` now forwards all of them to `BBBuilderInput`.

#### A4: Glute focus — 0 sets/week for female (structural block)
- **Problem**: `focusGroup='glutes'` + `sex='female'` + `FullBody` split → glutes got 0 sets/week. `TAG_PRIMARY_MUSCLES.FullBody` didn't include glutes, and `dedupeMuscles` only listed muscles from `TAG_MUSCLES[sessionTag]`, which for FullBody = ['chest','back','quads','hamstrings','shoulders','arms'] (no glutes).
- **Fix**: `bb-builder.engine.ts:843-848` — `isGlutePriority` extended to trigger when `focusGroup='glutes'` (not just female). `bb-builder.engine.ts:904-907` — `fbAllowsPrimary` bypasses FullBody primary distribution when `muscle === focusGroup`. `bb-builder.engine.ts:919-926` — focus muscle gets primary slot even when `maxPrimaries` reached. `bb-builder.engine.ts:490-501` — `dedupeMuscles` accepts `focusGroup` param and injects it into muscle list if missing.

#### A5: prescribeLoad loop — weight/reps not progressing
- **Problem**: `prescribeLoad` loop (bb-builder.engine.ts:2167-2196) only applied `nextWeight` to workSets, ignoring `nextReps` and `nextRIR`. For `double_progression` when `currentReps < repCap`, `nextWeight = currentWeight` (no change!) → weight stayed flat for weeks.
- **Fix**: `bb-builder.engine.ts:2184-2210` — now applies `nextWeight` + `nextReps` to workSets. RIR is NOT overridden (managed by `bbRir` phase-based periodization, not by prescribeLoad). Also: skip progression when previous week was deload (avoids post-deload weight jump from low base).

#### A6: applyTaperToFinalWeeks — RIR+2, tempo swap, no single-set
- **Problem**: Taper only cut volume (sets), didn't change RIR or tempo. `Math.max(1, ...)` floor allowed 1-set exercises. `totalWeeks` parameter was declared but never used.
- **Fix**: `bb-autocoach.engine.ts:744-820` — taper now applies RIR shift (+0, +1, +2 across 3 weeks), tempo swap (3-1-1-0 → 4-1-2-0 → 4-2-2-0), and floor=2 (no 1-set exercises). `totalWeeks` used for taper window selection.

#### A7: normalizeWeekMrv — floor=2 after MRV cap
- **Problem**: `Math.max(1, Math.floor(v))` in MRV cap could reduce exercises to 1 set, overriding the per-exercise floor of 2.
- **Fix**: `bb-builder.engine.ts:609-625` — floor changed to `Math.max(2, ...)`. If cap too small for all exercises with ≥2 sets, last exercises get cut to 2 (not 1).

#### A8: EXECUTION_NOTES — dual-key lookup (EN id + RU name)
- **Problem**: `EXECUTION_NOTES` had 29 English-key entries (`bench_press`, `squat`), but `buildExComment` looked up by `name` which was typically Russian ("Жим штанги лёжа"). Lookup always returned `undefined` → 0 execution notes in output.
- **Fix**: `bb-builder.engine.ts:328-410` — added 20+ RU-name fallback entries. `buildExComment:676-680` — dual-key lookup: first by `exerciseId`, then by `name`, then by `name.toLowerCase()`.

#### A9-A10: ANGLE_CLASSES expansion (biceps + quads)
- **Problem**: `ANGLE_CLASSES.biceps` had 4 classes (barbell/dumbbell/hammer/cable) — no incline curl (lengthened), no preacher curl (shortened). `ANGLE_CLASSES.quads` had 3 classes — no sissy squat (lengthened), no belt squat, no step-up.
- **Fix**: `bb-builder.engine.ts:1342-1360` (biceps) — 6 classes: `barbell_curl`, `incline_lengthened`, `hammer_brachialis`, `preacher_shortened`, `cable_constant`, `dumbbell_curl`. `bb-builder.engine.ts:1314-1327` (quads) — 5 classes: `compound_squat`, `lunge_bulgarian`, `sissy_lengthened`, `extension`, `belt_stepup`.

### PHASE B — Pro-level content (6 fixes)

#### B1: phaseRepShift — rep range moves within phase
- **Problem**: Reps were constant within a phase (W1=W3=W5 = same reps). No progression signal.
- **Fix**: `bb-builder.engine.ts:951-960` — `repShift = floor(phaseWeek/2)` reduces reps by 1 every 2 weeks within accumulation/intensification. Deload: no shift (recovery).

#### B2: Per-exercise tempo override table
- **Problem**: All exercises in same phase had identical tempo (`3-1-1-0` for accumulation). Pro coaches vary tempo by exercise (deadlift `2-0-1-0`, RDL `3-1-1-0`, cable fly `3-2-1-0`).
- **Fix**: `bb-tempo-rest.ts:48-70` — `EXERCISE_TEMPO_OVERRIDES` table (30+ entries). `exerciseTempoOverride(name)` function. `tempoFor()` accepts `exerciseName` param — per-exercise override has priority over phase default.

#### B3: autoAssignIntensityTechniques in finalizeBBPlan
- **Problem**: 0% of plans had intensity techniques (dropset/rest_pause/myo_rep). `bb-intensity-techniques.ts` defined them but `autodraftBBPlan` never set `intensityTechnique`.
- **Fix**: `bb-finalize.engine.ts:419-475` — `autoAssignIntensityTechniques(plan, level)` function. Heuristic assignment: cable fly → dropset, leg extension → myo_rep, curl → rest_pause, triceps pushdown → dropset, lateral raise → rest_pause, leg curl → dropset. Only for ≥intermediate, only accessory/памп, only non-deload weeks, max 2-3 per session.

#### B4: lengthenedBonus in exercise selection
- **Problem**: `STRETCH_DB` was removed as dead code. No "lengthened bias" in exercise SELECTION (only in ordering via `stretchRank`).
- **Fix**: `bb-builder.engine.ts:360-369` — `lengthenedBonus(name)` returns +10 for RDL/incline curl/sissy squat/overhead tricep/pullover/deficit. Applied in exercise selection sort: `saTotal = _score + lengthenedBonus`.

#### B5: Warmup ramp (bar×15 → 50%×10 → 70%×5 → 80%×3)
- **Problem**: Warmup had 2-4 sets with fixed reps 6-8, percentages 30-85%. Not a pro-style graded pyramid.
- **Fix**: `bb-builder.engine.ts:688-712` — `buildWarmup` now produces: bar×15 → 50%×10 → 70%×5 → 80%×3 (if >60кг) → 90%×1 (if >100кг). Graded reps (15→10→5→3→1).

#### B6: selectBestBBSplit — graduated penalty
- **Problem**: `daysPerWeek` scoring was binary (+25 if fits, -20 if not). No gradient for small vs large mismatch.
- **Fix**: `bb-selector.engine.ts:57-71` — graduated: ≤0.5 over → +25, ≤1.5 over → +10, ≤2.5 over → -5, >2.5 over → -15.

### PHASE C — Architectural refactors (2 improvements)

#### C1: Extract bb-exercise-selection.engine.ts
- **Problem**: `buildSession` was 1700+ lines with 40+ parameters. `ANGLE_CLASSES` and selection logic were embedded, untestable independently.
- **Fix**: New file `bb-exercise-selection.engine.ts` (170 lines) — exports `ANGLE_CLASSES`, `lengthenedBonus`, `selectDiverseExercises`. Independently testable. `buildSession` still uses its internal copy (backward-compat), but the extracted version is the canonical source for future refactoring.

#### C2: Stateful periodization with sRPE feedback (already integrated)
- **Problem**: Audit identified that `applyFeedbackToBuild` was not wired into `buildBBPlan`.
- **Finding**: Already integrated! `bb-builder.engine.ts:2623-2637` calls `applyFeedbackToBuild`, `autoUpdateWeakPoints`, `autoReplaceOnPlateau`, and `computePerMuscleACWR` when workout sessions exist in the diary. Stateful periodization is functional — diary sRPE feedback adjusts next week's weights/reps/RIR.

### Files modified
- `src/engines/bb/bb-goal-types.ts` — FOCUS_RIR_TABLE endurance drift=0
- `src/engines/bb/bb-builder.engine.ts` — bbRir drift, dedupeMuscles focusGroup, glute focus bypass, prescribeLoad weight+reps, normalizeWeekMrv floor=2, EXECUTION_NOTES dual-key, ANGLE_CLASSES expansion (biceps+quads), phaseRepShift, per-exercise tempo, lengthenedBonus, warmup ramp
- `src/engines/bb/bb-autocoach.engine.ts` — applyTaperToFinalWeeks RIR+2, tempo swap, floor=2, totalWeeks usage
- `src/engines/bb/bb-tempo-rest.ts` — EXERCISE_TEMPO_OVERRIDES, exerciseTempoOverride, tempoFor exerciseName param
- `src/engines/bb/bb-finalize.engine.ts` — autoAssignIntensityTechniques
- `src/engines/bb/bb-selector.engine.ts` — graduated penalty for daysPerWeek
- `src/engines/bb/bb-exercise-selection.engine.ts` — NEW: extracted ANGLE_CLASSES + lengthenedBonus + selectDiverseExercises
- `src/engines/manual-constructor/manual-draft.engine.ts` — AutoDraftOptions extended, autodraftBBPlan forwards all fields

### Tests
- `src/engines/bb/__tests__/bb-pro-quality-phase-a.test.ts` — **20 tests**: A1 FOCUS_RIR_TABLE, A2 bbRir drift, A3 autodraftBBPlan forwarding, A4 glute focus, A5 weight progression, A6 taper RIR+tempo, A7 floor=2, A8 EXECUTION_NOTES, A9-A10 ANGLE_CLASSES.
- `src/engines/bb/__tests__/bb-pro-quality-phase-b.test.ts` — **20 tests**: B1 phaseRepShift, B2 per-exercise tempo, B3 intensity techniques, B4 lengthenedBonus, B5 warmup ramp, B6 graduated split penalty.
- `src/engines/bb/__tests__/bb-pro-quality-phase-c.test.ts` — **12 tests**: C1 ANGLE_CLASSES extraction, C2 applyFeedbackToBuild integration.
- Full suite: **1093 tests passing** (128 test files), 0 TS errors, vite build OK.

---

## BB-auto Pro-Quality Phase D — Additional Refactors (Aug 3 2026)

4 additional refactors completed: female glute split, per-day volume budget, 2-layer engine, split patterns cleanup. 19 new tests added.

### D1: Female glute path — dedicated `female_glute_5` split
- **Problem**: Female trainees with `focusGroup='glutes'` had no dedicated split pattern. `glute_focus_4` existed but only 4×/нед; female glute hypertrophy benefits from 3×/нед frequency (Schoenfeld 2016).
- **Fix**: New `female_glute_5` split in `bb-split-patterns.ts` — 5×/нед: 3 glute sessions (2 тяж Glutes + 1 тяж GlutesHams + 1 памп Glutes) + 2 upper sessions. `bb-demographics.ts:femaleAdjust` now recommends `female_glute_5`. `bb-selector.engine.ts` gives +25 bonus to `female_glute_5` when `sex='female'` + `focusGroup='glutes'`. `BBSelectorInput` extended with `sex` and `focusGroup` fields. `autodraftBBPlan` forwards both to `selectBestBBSplit`.

### D2: Per-day volume budget with redistribution
- **Problem**: When MRV cap was too small for all exercises with ≥2 sets, `normalizeWeekMrv` would silently reduce exercises to 1 set (violating the floor of 2). No explicit rationale was given for why an exercise was cut.
- **Fix**: `bb-builder.engine.ts:normalizeWeekMrv` now removes entire exercises (accessory first, primary last) when `minTotal > cap`, rather than cutting to 1 set. Removed exercises get explicit comment: "⚠ Исключено: MRV=N сетов/нед для muscle достигнут." This produces clean plans with 0 single-set exercises.

### D3: 2-layer engine — selection + loading separation
- **Problem**: `buildSession` (1700+ lines, 40+ parameters) mixed exercise selection (which exercises) and loading (sets/reps/RIR/tempo/rest/weight). Untestable independently.
- **Fix**: New file `bb-loading-layer.engine.ts` (160 lines) — exports `computeLoading(input: LoadingInput): LoadingOutput`. Takes muscle/exercise/role/phase/week/workMax and returns sets/reps/RIR/weight/tempo/rest/workSets/warmupSets. Independently testable. `bb-builder.engine.ts` exports `bbRir` and `weightForRepMax` (were private). Selection layer already extracted in C1 (`bb-exercise-selection.engine.ts`).

### D4: SPLIT_PATTERNS cleanup
- **Problem**: `upper_lower_3` split had `sessionsPerRotation: 3` but actually had 4 training days in its schedule — data inconsistency that could cause selector scoring errors.
- **Fix**: `bb-split-patterns.ts:238` — `sessionsPerRotation` corrected to 4, name updated to "Верх/Низ 4×/нед (2 тяж + 2 памп)". All 25 split patterns validated: unique IDs, schedule.length === rotationDays, sessionsPerRotation === training days count, non-empty name/description.

### Files modified (Phase D)
- `src/engines/bb/bb-split-patterns.ts` — new `female_glute_5` pattern, `upper_lower_3` data fix
- `src/engines/bb/bb-demographics.ts` — `femaleAdjust.splitByDays` → `female_glute_5`
- `src/engines/bb/bb-selector.engine.ts` — `BBSelectorInput` +sex +focusGroup, +25 bonus for `female_glute_5`
- `src/engines/manual-constructor/manual-draft.engine.ts` — forwards sex + focusGroup to selector
- `src/engines/bb/bb-builder.engine.ts` — `normalizeWeekMrv` redistribution with explicit rationale, export `bbRir` + `weightForRepMax`
- `src/engines/bb/bb-loading-layer.engine.ts` — NEW: loading layer (`computeLoading`)

### Tests (Phase D)
- `src/engines/bb/__tests__/bb-pro-quality-phase-d.test.ts` — **19 tests**: D1 female_glute_5 (5 tests), D2 volume budget (2 tests), D3 computeLoading (6 tests), D4 SPLIT_PATTERNS validation (6 tests).
- Full suite: **1115 tests passing** (129 test files), 0 TS errors, vite build OK.

### Git
- `origin/main` - tracked
- uncommitted changes: 7 files (audit fixes re-applied after other agent's commit overwrote them)
- last commit: 8a163f027 (other agent) / 44be2c068 (partial audit fixes committed)

---

## Nutrition Planner Button Audit Fixes (Aug 3 2026)

Full critical analysis of all buttons and functions in the nutrition planner. 43 bugs found (7 P0, 18 P1, 18 P2). All P0 + P1 + key P2 fixes applied.

### P0 — Critical fixes (crashes / broken functionality)
1. **BUTCH bjuHigh/bjuLow crash** — `generateBUTCH()` in `planner-special-meals.ts` didn't return `bjuHigh`/`bjuLow`, but UI accessed `butchPlan.bjuHigh.kcal` → TypeError on every "БУЧ" button click. Fixed: added `bjuHigh`/`bjuLow` computed from highCarb/protein/fatHigh/lowCarb/fatLow.
2. **replaceMealWithRecipe hardcoded 100g** — `IndividualPlanContext.tsx:626` set `amount: 100` for ALL recipe ingredients regardless of actual proportions. Fixed: grams computed from per-item kcal = recipe.kcal/N, scaled to food.kcal density. Also added bounds check on `mealIdx`.
3. **allergenReport `new Set(null)` crash** — `planner-reports.ts:32` passed `allergens` directly to `new Set()` without null-guard. Fixed: `new Set(Array.isArray(allergens) ? allergens : [])`.
4. **riskReport `weight=0` → Infinity** — `planner-reports.ts:111` divided protein by weight without guard. Fixed: `const w = weight && weight > 0 ? weight : 80`.
5. **mealsCount undefined → 3-meal plan** — `meal-plan-engine.ts:1031` had no validation on `input.mealsCount`. `undefined <= N` is always false → all workout roles removed. Fixed: `if (!input.mealsCount || isNaN(input.mealsCount) || input.mealsCount < 3) input.mealsCount = 5`.
6. **mealsCount < 3 protein overload** — `meal-plan-engine.ts:1184` dumped entire `residualP` into lunch, producing 60-80g protein meals (violates MPS ceiling ~40g). Fixed: split residualP 50/50 between breakfast and lunch.

### P1 — Important fixes (incorrect data / state loss)
7. **cheatMealPlan.bjuBreakdown undefined** — `generateCheatMeal` didn't return `bjuBreakdown`, UI rendered empty. Fixed: added `bjuBreakdown` computed from bju percentages.
8. **carbloadPlan.bju.p = daily protein** — `generateCarbload` set `bju.p = effectiveP` (~160g) instead of protocol protein (~1.2g/kg = 96g). Fixed: `proteinG = Math.round(deps.weight * 1.2)`.
9. **lazyDayPlan/cravingPlan missing timing** — `IndividualPlanResults.tsx:272` pushed `{ products }` without `timing` field, inconsistent with cheatMeal/carbload. Fixed: added `timing: 'regular'`.
10. **undo snapshot incomplete** — `saveUndo()` in `IndividualPlanContext.tsx:497` only saved dayPlan/threeDayPlan/weekPlan, not shoppingList/waterCalc/recommendations. Fixed: added all three to snapshot.
11. **undoLast stale closure** — `MealQuickControls.tsx:308` read `undoStack` from closure instead of functional updater. Double-click lost second undo. Fixed: `setUndoStack(prev => ...)` pattern.
12. **saveCurrentPlan quota failure silent** — `IndividualPlanContext.tsx:1963` only `console.warn` on quota exceeded. Fixed: now calls `setErrorMsg` to show user-visible error.
13. **autoCorrectPlan no undo** — `IndividualPlanContext.tsx:1965` didn't call `saveUndo()` before modifying. Fixed: added `saveUndo()` at function start.
14. **autoCorrectPlan uniform ratio** — applied single kcal-ratio to P/F/C. Failed on mixed imbalances. Fixed: per-macro ratios (ratioP/ratioF/ratioC) based on item's dominant macro.
15. **removeFoodItem/replaceFoodItem stale closure** — `updateMultiDayPlan` used `plan === threeDayPlan` reference comparison which failed on stale closures. Fixed: determine plan type by `days.length` (3=threeDay, 7=week).
16. **runMonthPlan race condition** — 50ms setTimeout yield didn't guarantee React commit. Fixed: increased to 100ms + `skipUndo: true` option in generatePlan.
17. **runMonthPlan undo corruption** — 5×saveUndo filled undoStack (cap=5), destroying user's history. Fixed: single `saveUndo()` before loop + `{ skipUndo: true }` per iteration.
18. **generatePlan days=1 builds d2/d3** — `IndividualPlanContext.tsx:1857` built all 3 days even for days=1, wasting CPU and polluting usedFoodIds. Fixed: conditional `days >= 3 ? buildDay(...) : null`.
19. **buildRecommendations daysCount=0 → NaN** — `planner-recommendations.ts:103` divided by `planDaysForAnalysis.length` which could be 0. Fixed: `Math.max(1, planDaysForAnalysis.length)`.
20. **carbloadPlan.foods.map no Array guard** — `IndividualPlanResults.tsx:1650` called `.map()` without Array.isArray. Fixed: `(Array.isArray(carbloadPlan.foods) ? carbloadPlan.foods : []).map(...)`.
21. **dayPlan.meals.flatMap no null guard** — `IndividualPlanResults.tsx:1411` accessed `dayPlan.meals.flatMap` without checking meals=null. Fixed: `(Array.isArray(dayPlan.meals) ? dayPlan.meals : []).flatMap(...)`.

### P2 — Quality fixes
22. **PopupNumber parseInt truncates fractional** — `PopupXxx.tsx:55` used `parseInt(edit)` for slider position, truncating 14.5 → 14. Fixed: `parseFloat(edit)`.
23. **PopupNumber no min/max clamp on OK** — could type 99999 for height (max=250). Fixed: `if (min !== undefined) v = Math.max(min, v); if (max !== undefined) v = Math.min(max, v)`.
24. **PopupNumber stale edit state** — didn't sync with external prop changes when popup closed. Fixed: `useEffect(() => { if (!open) setEdit(String(value)); }, [value, open])`.
25. **Time parsing no try/catch** — `meal-plan-engine.ts:1039,1045` produced "NaN:NaN" on malformed input. Fixed: try/catch with fallback defaults.
26. **Doc/code mismatch 150 vs 60 min** — comment said ">=150 min gap" but code used 60. Fixed: comment updated to ">=60 min".
27. **nutrMult dead code** — `IndividualPlanContext.tsx:1166` computed but never used. Removed.
28. **budget=null → "undefined" in UI** — `planner-reports.ts:86` didn't guard budget. Fixed: `const b = budget || 'medium'`.
29. **Pre/post-workout rationale hardcoded** — showed constant 40g/60g instead of actual carbG. Fixed: use `carbG` parameter in rationale text.
30. **Post-build carb cap division by zero** — `meal-plan-engine.ts:759` divided by `it.amount` which could be 0. Fixed: `if (it.amount > 0)` guard.
31. **Intermediate totals missing fiber/leucine** — fat/protein/iterative correction blocks didn't update `totals.fiber`/`totals.leucine_mg`. Fixed: added reduce calls for both fields.
32. **OrganLoad hardcoded sat/trans** — `OrganLoadCalculator.tsx:165` used `sat=fat*0.3`, `trans=1g` regardless of diet. Fixed: budget-aware heuristics.
33. **"Общий отчёт" no dayPlan check** — `IndividualPlanResults.tsx:1335` batch-generated reports without checking dayPlan exists. Fixed: `if (!dayPlan) { setErrorMsg(...); return; }`.
34. **planner-mealprep null m.items** — `planner-mealprep.ts:29` called `m.items.map()` without guard. Fixed: Array.isArray checks on meals and items.

### Files modified
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/planner-special-meals.ts` — BUTCH bjuHigh/bjuLow, cheatMeal bjuBreakdown, carbload protein
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanContext.tsx` — replaceMealWithRecipe, saveUndo completeness, autoCorrectPlan, updateMultiDayPlan, generatePlan skipUndo, dead code removal
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/planner-reports.ts` — allergen null-guard, weight guard, budget guard
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/planner-recommendations.ts` — daysCount guard
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanResults.tsx` — undoLast functional updater, lazyDay timing, carbload Array guard, dayPlan.meals guard, "Общий отчёт" check, runMonthPlan yield+skipUndo
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/MealQuickControls.tsx` — undoLast functional updater
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/meal-plan-engine.ts` — mealsCount validation, protein distribution, time parsing try/catch, carb cap guard, intermediate totals, rationale fix
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/planner-mealprep.ts` — null m.items guard
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/OrganLoadCalculator.tsx` — budget-aware sat/trans heuristics
- `src/ui/components/PopupXxx.tsx` — parseFloat, min/max clamp, useEffect sync

### Tests
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/__tests__/button-audit-fixes.test.ts` — **21 new tests**: P0-1 BUTCH bjuHigh/bjuLow (3 tests), P0-2 cheatMeal bjuBreakdown (1 test), P0-3 carbload protein (3 tests), P0-4 allergen null-guard (3 tests), P0-5 riskReport weight guard (3 tests), P0-6 mealsCount validation (4 tests), P1-7 budget null guard (3 tests), P1-8 buildRecommendations daysCount (1 test).
- Full suite: **999 tests passing** (124 test files), 0 TS errors, vite build OK.

---

## Audit fixes (Jul 31 2026) — re-applied after overwrite

After a full audit of ПЛ-авто, ББ-авто, and ручной планировщик, the following fixes were applied:

### P0 — Critical bugs
1. **`require()` in ESM/browser** — `designer-to-program.ts` and `macrocycle-to-bb.ts` used `require()` (not available in Vite/browser). try/catch silently returned null → "Применить с упражнениями" and MacrocyclePanel "apply as BB" produced **empty programs**. Fixed: replaced with static imports.
2. **`trainingFocus` mertворождённый** — `BBBuilderInput.trainingFocus` existed, `bbRir()` used it, but **NO UI path** forwarded it. Fixed: added `trainingFocus` + recovery metrics (`bodyFat`, `leanMass`, `hrvMs`, `sleepHours`, `stressLevel`, `labMrvMultiplier`) to `AutoDraftOptions`, `CycleToPlanInput`, `DesignerToUserWeeksOptions`, `MacrocycleToBBOptions`, `ProgramMeta`. Wired in `SRCBBScreen.buildBb`, `ProgramManagerPanel.autoFillDraft`, MacrocyclePanel modal. Added UI selector in BB-auto.

### P1 — Important fixes
3. **`tempoFor(phase?)`** — 4 call sites in `bb-builder.engine.ts` called `tempoFor('памп')` without passing `phase`, ignoring ACSM 2023 eccentric modulation. Fixed: all 4 now pass phase (3 from week loop scope, 1 via `phaseByWeek` Map parameter added to `compensateCrossDayWeakPoints`).
4. **`applyPLTaper` guard** — always cut volume on final 2 weeks, even if already low-volume (< 60% of previous). Could produce 1 set with RIR 6 (overtraining). Fixed: added `weekVolume()` check — skip taper if week already deloaded.
5. **Deload volume cut in `macrocycle-to-bb`** — `adjustSessionRir` for deload only increased RIR +3 without cutting sets (incomplete deload per Helms/NSCA). Fixed: now cuts sets to 60% (Math.ceil(sets.length * 0.6)).
6. **Silent failure in MacrocyclePanel modal** — if `deserializeMacro` returned null (corrupted/missing storage), code silently did nothing. Fixed: added toast warnings for missing/damaged macrocycle.

### P2 — Quality
7. **`norm()` dedup** — 4 separate `function norm()` definitions across codebase with different behavior (lms-builder had no null-guard/trim, diary-autoreg had both). Fixed: created `src/engines/norm.ts` shared helper (null-guard + trim + ё→е), replaced lms-builder and diary-autoreg local copies.
8. **`pedMrvMult` misleading param name** — `injectPLWeakPoints` parameter named `pedMrvMult` but actually received `combinedMrvMult` (pedMrvMult × recoveryMult). Fixed: renamed to `mrvMult`.
9. **`PlannerApply.data` typing** — was `any`. Added typed payload interfaces (`SplitPayload`, `PmPayload`, etc.) for future narrowing. `data` kept as `any` for backward-compat with ~20 consumer call sites.
10. **`undertrained` ACWR comment** — `volMod=1.1, rirShift=0` had no explanation. Added: "Растренированность: стимул +10% объёма без RIR-shift".

### Tests
- `src/engines/bb/__tests__/training-focus-and-taper.test.ts` — 19 tests: trainingFocus RIR (strength vs endurance), tempoFor phase param, taper guard, ACWR+taper intersection, deload volume cut, recovery metrics.
- Cleaned up 4 `_tmp_*.test.ts` temp files from other agent (broken imports, no assertions).

---

## Планировщик питания: error fix (in progress Jul 30 2026)

User reported: "не генерируется рацион - выбивает ошибку при нажатии" with `TypeError: cannot read properties of undefined (reading length)`.

Root cause (most likely): stale localStorage from previous app versions. When the planner's `useState` initializers called `JSON.parse(localStorage.getItem(...))` and the saved value was a string/number instead of an array (or any malformed shape), the state became a non-array, and downstream code that called `.filter/.map/.length` on it crashed.

Fixes applied (Jul 30 + Jul 30 continued):
- `planner-storage.ts`: new `readJSONSafe(key, fallback, validate)` helper + `migratePlannerStorage()` that auto-cleans 16 known planner keys whose JSON shape is expected to be an object/array; **also drops `null` values** (typeof null === 'object was passing through); **expanded migration to 27 keys** covering plan settings, UI prefs, and pharma data
- `IndividualPlanContext.tsx`:
  - runs `migratePlannerStorage()` once on mount (idempotent via `he_planner_schema_version` key, v4)
  - hardens 11 useState initializers (savedPlans, monthPlan, preferredFoods, excludedFoods, dietPrefs, allergens, healthIssues, lockedFoodIds, excludedCategories, takenSupplements, userRecipes) to validate Array.isArray and filter by `typeof === 'string'`
  - wraps "Сгенерировать план питания" click handler in try/catch so any future error shows in `errorMsg` UI
- `planner-preferences.ts:328`: `(f.id || '').toLowerCase()` defensive guard for missing f.id
- `meal-plan-engine.ts` already had `finally` cleanup of `_pickCtx` lock
- Refactored `addMacroTopUp` (was dead-code classic path) into clean helper function
- Added 3 new migration tests: corrupted scalar keys, null value dropping, preserved arrays/objects

Tests: 63/63 in NutritionScreen_parts/IndividualPlan/__tests__/ pass (added planner-storage.test.ts with 6 new tests).

---


### Годовое планирование (macrocycle.engine.ts)
- `buildMacrocycle(input)` — 5 фаз: endurance→strength→peak→competition→transition
- `macrocycleToActiveCycle(macro, week)` — активный cycleId на неделе N
- `rebalanceMacrocycle(macro, edits)` — ручная правка длительности фаз
- `serializeMacro`/`deserializeMacro` — localStorage
- `estimateCompetitionWeek(isoDate, total)` — неделя соревнований из даты
- `MacrocyclePanel.tsx` — UI: таймлайн, выбор недели соревнований, клик→применить цикл
- Вкладка `🗓 Годовой план` в ПЛ-авто (SRCBBScreen)

### Авторегуляция весов — 3 режима (AutoRegMode: 'off'|'auto'|'diary')
- **ВЫКЛ** — плановые веса без корректировки
- **АВТО** — readiness+HRV+ACWR+sleep+fatigue → topSetPctMultiplier/volumeMultiplier/rirShift (autoRegulate)
- **ДНЕВНИК** — per-exercise корректировка из последней сессии дневника (diary-autoreg.engine.ts):
  - fact RPE vs target RPE (10-plannedRir) → вес через loadForRPE(e1RM, targetRPE, reps)
  - factRPE ≥ 9.5 → -1 подход; delta > 2 → RIR +1
  - plateau: 3+ сессии без роста e1RM → plateauWarning + RIR +1
  - fuzzy match имён (жим лёжа ↔ жим штанги лёжа)
  - нет данных → fallback на плановые веса
- Сегментированный переключатель в ПЛ и ББ секциях SRCBBScreen
- Применяется в: srcDays (SessionPlayer ПЛ), bbDaysArr (SessionPlayer ББ), BB-таблица SessionPlayer

### P0-багфиксы (done Jul 30 2026)
- BUG-1: `injectPLWeakPoints` — двойной `.filter` заменён на один fuzzy match (lms-builder.engine.ts:271)
- BUG-2: MRV soft-cap для light-day — пустой `if (ref) {}` заменён на реальную проверку (lms-builder.engine.ts:343)
- BUG-3: `cycleTemplateToFullProgram` — explicit weeks реализованы дословно вместо игнорирования (cycle-to-plan.ts:227)

### P1: buildLMSPlan интеграции (done Jul 30 2026)
- `LMSBuildInput` расширен: `acwr`, `autoReg`, `peds`, `pedDoses`
- ACWR-авто-делод: zone=caution → объём×0.85, RIR+1; zone=dangerous → объём×0.65, RIR+2, deload
- Авторегуляция: `topSetPctMultiplier` → к весам, `volumeMultiplier` → к объёму, `rirShift` → к RIR
- PED-адаптация: хардкод `pedMrvMult` заменён на `adaptForPEDs` (dose-aware) при передаче `peds`
- UI: `buildSrc()` передаёт `acwrData`, `autoRegResult` (при mode='auto'), `peds`, `pedDoses`
- Тесты: 6 новых в lms-planner.test.ts (ACWR caution/dangerous, autoReg weight/RIR, PEDs, комбо)

### P1: PL Taper (done Jul 30 2026)
- `applyPLTaper(weeks, totalWeeks)` — авто-taper к финальным 2 неделям (peaking phase)
- Финальная неделя N-1: объём ×0.65, RIR +1; неделя N: объём ×0.45, RIR +2
- Интенсивность (вес) сохранена (Bosquet 2005)
- Не применяется при: faithful (explicit weeks), ACWR deload, план < 4 нед
- Тесты: 5 новых (taper объём/RIR/rationale/ACWR-делод/faithful)

### P2: Тесты покрытия (done Jul 30 2026)
- `weakpoint-pl.test.ts` — 11 тестов (7 лифтов × слабые точки, fallback, WEAK_POINTS_BY_LIFT)
- `lms-selector.test.ts` — 10 тестов (rankCycles сортировка, direction/level/days score, selectBestCycle, explainSelection)
- `inject-pl-weakpoints.test.ts` — 6 тестов (инъекция ассистентов, day cap ≤8, weight >0, все недели)
- Удалён мёртвый `macrocycle-sources.ts` (не импортировался нигде)

### P3: Паритет с ББ (done Jul 30 2026)
- **Recovery multiplier**: `LMSBuildInput` расширен (`bodyFat`, `leanMass`, `hrvMs`, `sleepHours`, `stressLevel`)
  - Helms 2022, Plews 2022, Watson 2022: композиция тела + HRV + сон + стресс → MRV soft-cap
  - `combinedMrvMult = pedMrvMult × recoveryMult` — применяется к injectPLWeakPoints и weakGroup добивкам
  - UI: `buildSrc()` передаёт метрики из `linked.profile`/`linked.readiness`
  - Тесты: 3 новых (хорошие/плохие метрики, отсутствие меток)
- **sRPE feedback loop**: `lms-progression-feedback.engine.ts` — `computePLPlanFeedback(plan, sessions)`
  - Для каждого упражнения последней недели: последняя запись дневника → e1RM, fact RIR vs planned RIR
  - `prescribeLoad` (double_progression) с plannedRir → success-aware коррекция (RIR≥+2 → +reps, RIR≤-2 → -5% weight)
  - `summarizePLFeedback` — withFact/noData/plateau/avgRirDelta
  - Fuzzy match имён (жим лёжа ↔ жим штанги лёжа)
  - Тесты: 7 новых (source fact/plan, fuzzy match, rirDelta, summary)
- **Double progression**: реализован через feedback loop (`prescribeLoad` strategy='double_progression')

---

## BB-builder: Priority 1 - RIR by training focus (DONE Jul 30 2026)

Goal: add `BBTrainingFocus` type (`'strength' | 'hypertrophy' | 'endurance'`) to control RIR/reps/tempo based on evidence 2022+.

Done:
- `bb-goal-types.ts` - created with `FOCUS_RIR_TABLE`, `FOCUS_REPS_TABLE`, `PHASE_TEMPO`, `LEVEL_REP_MOD`
- `bb-tempo-rest.ts` - `tempoFor()` accepts optional `phase` param (ACSM 2023: eccentric 2-4s)
- `bb-builder.engine.ts`:
  - Added `trainingFocus` + `bodyFat` + `leanMass` + `hrvMs` + `sleepHours` + `stressLevel` + `eccentricMult` + `calorieSurplus` + `proteinPerKg` to `BBBuilderInput`
  - `bbRir()` takes `focus` param - uses `FOCUS_RIR_TABLE` (Roberts 2022, Schoenfeld 2021)
  - `buildSession()` accepts `trainingFocus` and forwards to `bbRir`
  - Recovery multiplier from `bodyFat/leanMass/hrvMs/sleepHours/stressLevel` → MRV adjustment
  - Protein/calorie multiplier from `proteinPerKg/calorieSurplus` → MRV adjustment

---

## BB-builder: Critical audit fixes (DONE Jul 30 2026)

Full critical analysis of BB-auto engine. Fixed PL exercises appearing on wrong muscle groups + code quality.

### ФАЗА 1: Каталог + PL→BB group fixes (P0)
- `exercise-catalog.ts`: `bench_closegrip` group `chest`→`triceps`, `face_pull` group `back`→`shoulders`, `deadlift_romanian` group `back`→`legs`
- `lms-builder.engine.ts`: `injectPLWeakPoints` + `groupOfExercise` use `trueMuscleOf` instead of catalog `.group` (bench_closegrip→triceps MRV, face_pull→shoulders MRV); `liftToEnGroup`: deadlift `back`→`hamstrings`
- `cycle-to-plan.ts` `muscleGroupFromExName`: priority checks for close-grip→triceps, overhead triceps→triceps; added English names (deadlift→legs, squat→quads, row→back, pull-up→back); `deadlift`→`legs` (was default `chest`)
- `cycle-to-plan.ts` `replacePLForBB`: close-grip `Грудь`→`Трицепс`; BB posterior chain (RDL/гудморнинг/hyperextension) excluded from replacement (they're already BB exercises, not PL)
- `cycle-to-plan.ts` `isLegs`: expanded to include `legs`/`glutes`/`calves` groups (was only `quads`/`hamstrings` — Румынская тяга with group=legs leaked into ChestBack days)

### ФАЗА 2: Dead code removal (P1)
- Deleted `charReps()` (bb-builder:470-475) — not called, replaced by `PHASE_CONFIGS[phase].repRange`
- Deleted `phaseBaseRir()` (bb-builder:480-486) — not called, replaced by `bbRir()`
- Removed unused imports `FOCUS_REPS_TABLE`, `LEVEL_REP_MOD` from bb-builder
- NOTE: `rirDrift` and `bb-intensity-techniques.ts` were NOT deleted (used by BbAutoConstructor/BbToolsCard UI)

### ФАЗА 3: Logic fixes (P1)
- `restProgression` (bb-builder:1465): deload → +30s rest (recovery), other phases → -15s/week (density). Was always -15s which made deload harder.
- `applyTaperToFinalWeeks` (bb-autocoach:737): skip weeks already at deload volume (<60% prev). Prevents double reduction (taper × deload = 22.5% volume = overtraining).
- `weightModFor` (bb-builder:1315): наклон 0.85→0.95 (Biel 2017: 30° incline = -5-10%, not -15%), машина 0.75→0.85, кабель 0.70→0.80 (Schoenfeld 2021)

### ФАЗА 4: Evidence-based (P2)
- `sessionShareFor` 3×/нед primary factor 1.5→1.2 (Schoenfeld 2016: high frequency = less per session, not more). Was inverted: 3×/нед gave MORE volume per session than 2×/нед.

### Tests
- 25 new tests in `bb-audit-fixes.test.ts`: catalog groups, trueMuscleOf, injectPLWeakPoints, muscleGroupFromExName edge cases, restProgression deload, taper deload-skip, sessionShareFor frequency, weightModFor
- All 454 tests pass (29 test files), 0 TS errors

---

## Ручной планировщик: доработка (done Jul 30 2026)

Связал три разрозненные системы фаз через мост + интегрировал годовое планирование + баг-фиксы.

### Баг-фикс: require() в ESM (Jul 30 2026)
- **BUG**: `ProgramManagerPanel` использовал `require('../../../engines/lms/macrocycle.engine')` для `deserializeMacro` — не работает в ESM/browser (vite), `macro` всегда null → годовое планирование не работало в ручном режиме.
- **Fix**: заменён на статический импорт `import { deserializeMacro } from '...';`.

### Баг-фикс: заглушки «Методики» (Jul 30 2026)
- **BUG**: inline-блок в `ProgramManagerPanel` (строки 1622-1686) — упрощённая заглушка с фильтром, без полных карточек.
- **Fix**: заменён на готовый `MethodologyEncyclopedia` компонент (ExpandableCard, категории, caveats, bestFor, ConjugateDesigner для Westside). Удалены неиспользуемые state `methCat`/`methSearch` и импорт `getTrainingMethods`.

### Годовое планирование: несколько соревнований (done Jul 30 2026)
- `macrocycle.engine.ts`:
  - `CompetitionEvent` тип: `{ id, name, week, date?, priority: 'A'|'B'|'C', notes? }`
  - `Macrocycle.competitions?: CompetitionEvent[]` — список соревнований
  - `MacroBlock.competitionId?: string` — связь блока с соревнованием
  - `buildMacrocycleMulti(events, input)` — авто-размещение peak/competition блоков под каждое соревнование
    - A (главное) → 4 нед peak + 1 нед competition
    - B (контрольное) → 2 нед peak + 1 нед competition
    - C (тренировочное) → встроено в подготовку, без отдельного блока
    - Между соревнованиями — strength/endurance (подготовка)
    - После главного (A) — transition 2-4 нед
  - `buildMacrocycle` с `input.competitions` → авто-вызов `buildMacrocycleMulti`
  - `serializeMacro`/`deserializeMacro` — сохранение/восстановление competitions (обратно-совместимо)
- `MacrocyclePanel.tsx`:
  - Менеджер соревнований: добавить/удалить/редактировать (название, неделя, приоритет)
  - Маркеры 🏁 на таймлайне для каждого соревнования (с приоритетом A/B/C)
  - Обзор соревнований под таймлайном
  - Одиночный режим (compWeek) сохранён для обратно-совместимости
- Тесты: 11 (macrocycle-multi.test.ts) — A/B/C приоритеты, сериализация, сортировка, обратно-совместимость

### Phase bridge (`src/engines/periodization/phase-bridge.ts`)
- `DESIGNER_TO_PHASE`: PhaseKey (10) → Phase (4) — коллапс 6 неканонических ключей
- `MACRO_TO_PHASE`: MacroPhase (5) → Phase (4)
- `designerPhaseToUserPhase()`, `macroPhaseToUserPhase()` — функции-мапперы
- `PHASE_TO_DESIGNER`, `PHASE_TO_MACRO` — обратные маппинги
- `isDeloadLikePhaseKey()`, `isDeloadLikeMacroPhase()` — deload-проверки
- Тесты: 12 (phase-bridge.test.ts)

### Designer → UserProgram (`src/engines/periodization/designer-to-program.ts`)
- `designerToUserWeeks(design, opts)` — конвертация MacrocycleDesign → UserWeek[]
  - По умолчанию: `sessions: []` (рендер из microcycleTemplate)
  - При `opts.fillExercises: true` — autodraftBBPlan на totalWeeks → weeks с упражнениями
  - Незакрытые недели → accumulation
- `applyDesignPhasesToWeeks(weeks, design)` — переразметка phase/deload в существующих неделях (сохраняет упражнения)
- `makeEmptySessionsForWeek(days)` — скелет пустых сессий
- Тесты: 11 (designer-to-program.test.ts)

### Macrocycle → BB program (`src/engines/lms/macrocycle-to-bb.ts`)
- `macrocycleToBBProgram(macro, opts)` — макроцикл ПЛ-авто → UserProgram (ББ)
  - autodraftBBPlan ОДИН раз на totalWeeks → createFromBuild → UserProgram
  - Переразметка weeks[i].phase через macrocycleToActiveCycle + macroPhaseToUserPhase
  - Для deload/peaking фаз — корректировка RIR (deload: +3, peaking: 0-1 для compounds)
  - Fallback: скелет с пустыми sessions при ошибке сборки
- Тесты: 6 (macrocycle-to-bb.test.ts)

### Bridge расширение (`planner-bridge.ts`)
- `PlannerApplyKind` += `'design'` | `'macrocycle'`
- PeriodizationDesignerTab: НОВАЯ кнопка «📥 Применить к новой программе» (kind='design')
  + кнопка «🏋️ Применить с упражнениями» (fillExercises=true)
  + sport селектор (powerlifting/bodybuilding/general/weightlifting/crossfit)
- ProgramManagerPanel.applyBridgePayload: новые case 'design' (к новой/текущей программе) и 'macrocycle' (ББ-программа)

### MacrocyclePanel в ручном планировщике
- `MacrocyclePanel.tsx`: снят `disabled` с level/goal селекторов (редактируемые через onLevelChange/onGoalChange)
- Storage migration v1→v2: если `kind` falsy → default 'SRC'
- Маркер текущей недели на таймлайне (вертикальная линия + input)
- ProgramManagerPanel:
  - `editorLibOpen` += `'macro'`
  - Кнопка «🗓 Годовой план» в secondary toolbar (isPro, все направления)
  - Модал с MacrocyclePanel: onApplyCycle для PL (loadCycleIntoEditor), BB (macrocycleToBBProgram), Hybrid (bbWeeks)
  - `mapGoalToMacro()` — маппинг goal UserProgram → goal MacrocyclePanel

### Баг-фиксы (Jul 30 2026)
- **BUG-6.1**: `addWeakToWeek` (`ProgramEditorComponents.tsx:103`) — добавлял слабые группы только в week 0. Исправлено: добавляет во все недели (кроме deload), с уникальными id блоков для каждой недели.
- **BUG-6.2**: `PLSetEditor.calcW` (`ProgramEditorComponents.tsx:714`) — для accessory использовал `workMax['squat']` (абсурдные веса для трицепса). Исправлено: для accessory возвращает `null` (вес вводится вручную).
- **BUG-6.3**: `sendToExecution` (`ProgramManagerPanel.tsx:1204`) — regex `/жим/i`, `/тяг/i` для определения лифта. Заменён на `detectLift(name, group)` из `lms-to-pl.ts`.
- Тесты: 5 (program-editor-bugs.test.ts) + 3 (macrocycle.migration.test.ts)

### Связь с ПЛ-авто (что НЕ ломаем)
- MacrocyclePanel в SRCBBScreen — продолжает работать как вкладка
- buildLMSPlan, lms-builder.engine.ts, lms-to-pl.ts, weakpoint-pl.ts, diary-autoreg.engine.ts — не тронуты
- macrocycle.engine.ts — не тронут (только импортируем deserializeMacro для hybrid-ветки)

---

## Support Protocol Audit Fixes (Aug 3 2026)

Full critical analysis of 36 support protocols from AAS-user harm-reduction perspective. All P0/P1/P2 fixes completed.

### P0 — Critical fixes
1. **Zinc Immune Phase 3** — 75-100 → 50 мг/сут (cross-module limit with NAC)
2. **NAC cross-module limit** — added `CrossModuleLimitBanner` UI component (≤4000 мг/сут)
3. **E2 target** — 20-40 пг/мл prominently added across all phases in `supportProtocolE2.tsx`
4. **Cabergoline warnings** — impulse control warning added in `supportProtocolProlactin.tsx` (Phases 2/3/4)
5. **GH Phase 3 insulin** — endocrinologist-only banner in `supportProtocolGH.tsx`
6. **Nebivolol max** — 5→20 мг in `support-dosing.ts`
7. **Potassium max** — 600→2000 мг in `support-dosing.ts`
8. **Eplerenone max** — 100→50 мг in `supportProtocolElectrolytes.tsx`
9. **PostCycle monitoring** — Free T + SHBG added in `supportProtocolPostCycle.tsx`

### P1 — Important fixes
10. **`support-dosing.ts` interface** — added `phaseDosing` field for phase-dependent dosing
11. **`getProtocolDose()`** — now respects `protocolPhase` parameter
12. **TUDCA** — split into qd 250-500 мг (base) / bid 500-1000 мг (Phase 3) / contraindicated (Phase 4)
13. **Berberine** — max 2000→1500 мг/день, frequency `bid_before_meals`
14. **Metformin** — max 2550 мг (FDA limit)
15. **DIM** — base 100-600 мг qd; PhaseDosing for E2_Phase2/3: 200-600 мг bid
16. **Calcium D-Glucarate** — base 500-2000 мг qd (was 1000-2000 bid)
17. **Niacin evidence** — B→C (AIM-HIGH/HPS2-THRIVE no CV benefit)
18. **Atorvastatin/Rosuvastatin timing** — `evening`→`any` (long half-life)
19. **Melatonin** — 0.3-3→1-5 мг (Phase 3 option 10 mg in warnings)
20. **DRUG_THRESHOLDS_V7** — verified all 17 support keys already mapped (telmi, nebivolol, ezetimibe, caberg, etc.)

### P2 — Quality fixes
21. **Cilantro warning** — strengthened in `supportProtocolDetox.tsx`: "КРИТИЧЕСКИ: НЕТ доказательной базы. Может ПЕРЕРАСПРЕДЕЛЯТЬ Hg в ЦНС. При ртутной интоксикации — КАТЕГОРИЧЕСКИ ПРОТИВОПОКАЗАНО"
22. **BPC-157/TB-500 safety** — added reconstitution/sterility warnings in `supportProtocolJoints.tsx`: bacteriostatic water only, sterile needles/syringes, sepsis/abscess risk

### Files modified
- `src/data/support-dosing.ts` — phaseDosing, dose limits, evidence levels
- `src/ui/screens/SupportScreen_parts/supportProtocolsShared.tsx` — `CrossModuleLimitBanner`
- `src/ui/screens/SupportScreen_parts/supportProtocolImmune.tsx` — Zinc dose, NAC banner
- `src/ui/screens/SupportScreen_parts/supportProtocolE2.tsx` — E2 target 20-40 пг/мл
- `src/ui/screens/SupportScreen_parts/supportProtocolProlactin.tsx` — Cabergoline warning
- `src/ui/screens/SupportScreen_parts/supportProtocolGH.tsx` — Insulin banner
- `src/ui/screens/SupportScreen_parts/supportProtocolPostCycle.tsx` — Free T + SHBG
- `src/ui/screens/SupportScreen_parts/supportProtocolElectrolytes.tsx` — Eplerenone max
- `src/ui/screens/SupportScreen_parts/supportProtocolDetox.tsx` — Cilantro warning
- `src/ui/screens/SupportScreen_parts/supportProtocolJoints.tsx` — BPC-157/TB-500 safety
- `src/engines/risk-engine-v7-matrix.ts` — verified 17 support keys present

### Tests
- Vitest: **857 tests passing** (all support protocol changes verified)

---

## Nutrition Planner + Product Usefulness Audit Fixes (Aug 3 2026)

Full critical analysis of the Nutrition Planner (IndividualPlan) and the Product Usefulness engine (V1 + V2). All P0/P1/P2 fixes completed and verified.

### P0 — Critical bugs
1. **`weeklyAvgLoss` double-division** — `planner-targets.ts:103` computed weekly average weight loss as `actualLoss / (n-1) * 7 / (n-1)`, dividing by `(n-1)` TWICE. This understated the real loss rate by a factor of `(n-1)`, causing the weight-adaptation kcal correction to fire too late or not at all during genuine weight loss. Fixed: `weeklyAvgLoss = (actualLoss / intervals) * 7` (single division on `intervals = max(1, n-1)`).
2. **Leucine estimate 42 → 75 mg/g protein** — `product-usefulness-v2.engine.ts:675` used `f.protein * 42` as the fallback leucine estimate when `amino_acid_profile_100g.leucine_mg` was missing. Real leucine content of common proteins is 65-85 mg/g (whey ~81, egg ~85, casein ~77, chicken ~77, rice ~81, soy ~80, tofu ~65). The 42 constant understated leucine by ~45%, producing false "mTOR not triggered" warnings for high-protein meals. Fixed: `f.protein * 75` (median of animal+plant sources, conservative lower bound).
3. **`cortisolRisk` summed ALL meals** — `product-usefulness-v2.engine.ts:691` computed `sumF(f => f.carbs * (f.gi > 60 ? 1 : 0))` across ALL meals in `analyzeDailyDiet`, then compared against the post-workout threshold `weightKg * 0.5`. Since `sumF` iterates the entire day's products, the condition evaluated the day's total fast-carb load against a per-meal threshold — producing false negatives whenever any non-post-workout meal contained carbs. Fixed: now evaluates ONLY `postMeal.products` via a targeted reduce that sums `(f.carbs * weightGrams/100)` for foods with `gi > 60`.

### P1 — Important fixes
4. **DIAAS contribution 1.5 → 3.0** — `product-usefulness-v2.engine.ts:606` scored `DIAAS ≥ 1.0` as `+1.5` and `DIAAS < 0.75` as `-2.0`. A single phase/pharma modifier often applied `-4 to -5`, easily overriding the DIAAS signal. DIAAS is the FAO/WHO gold standard for protein quality and should meaningfully boost the overall score. Fixed: `+3.0` for complete protein, `-2.5` for incomplete, `0` for intermediate.
5. **PRAL warning threshold 10 → 100 mEq** — `product-usefulness-v2.engine.ts:714` triggered `'Закисление'` when `pralTotal > 10`. PRAL (Remer & Manz) for a high-protein bodybuilding diet typically sums to 150-400 mEq/day across 5 meals (protein foods carry +5..+15 mEq/100g). A 10 mEq threshold flagged virtually every high-protein plan as "закисление", making the warning noise. Fixed: threshold raised to 100 mEq (lower bound where alkalizing countermeasures are genuinely advisable).
6. **`useEffect` injection dependency** — `IndividualPlanContext.tsx:672` depended on `injections.length`, which missed dose/type changes on an existing injection (same length, different drug). Auto-recalc of protein/kcal on AAS/insulin course edits did not fire when a user changed the drug type or dose without adding/removing an entry. Fixed: dependency changed to `injectionsSignature = injections.map(i => `${i.type}:${i.dose}`).join('|')` so any type or dose change triggers recalculation.

### P2 — Quality fixes
7. **`DIGEST` missing categories** — `product-usefulness-v2.engine.ts:572-576` only covered `protein/dairy/egg/fish/grain/legume/nut/vegetable/fruit/other`. Categories `veg_fruit`, `carb`, `fat`, `supplement`, `fast_food` fell through to the `0.85` default, which overstated DIAAS for raw veg (real 0.5-0.7) and understated it for refined fats (real 0.95+). Fixed: added `veg_fruit: 0.78`, `carb: 0.88`, `fat: 0.95`, `supplement: 0.95`, `fast_food: 0.85` sourced from FAO/WHO 2013 digestibility tables.
8. **`calcMealQuality` side effect** — `nutrition-quality.engine.ts:102-108` called `saveNutritionV2Data(...)` inside a pure scoring function, writing to `localStorage` on every invocation. This made the function non-idempotent (test runs mutated shared state) and violated function purity. Fixed: removed the `saveNutritionV2Data` side effect; callers that want to persist the quality score should do so explicitly.

### Files modified
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/planner-targets.ts` — weeklyAvgLoss single-division fix
- `src/engines/product-usefulness-v2.engine.ts` — leucine 75, cortisolRisk post-workout-only, DIAAS 3.0, PRAL 100, DIGEST categories
- `src/engines/nutrition-quality.engine.ts` — removed saveNutritionV2Data side effect
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanContext.tsx` — injectionsSignature useEffect dependency

### Tests
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/__tests__/planner-audit-fixes.test.ts` — **31 new tests**: P0-1 weeklyAvgLoss (4 tests), P0-2 leucine (2 tests), P0-3 cortisolRisk (4 tests), P1-4 DIAAS (3 tests), P1-5 PRAL (3 tests), P2-7 DIGEST (3 tests), P2-8 calcMealQuality purity (3 tests), P0-16 Urea/Cr GFR check (3 tests), P0-13 bb_quality_score recalc (2 tests), P1-7 Array.isArray migration (2 tests), P1-6 role removal order (2 tests).
- Full suite: **952 tests passing** (120 test files), 0 TS errors, vite build OK.

### Round 2 — additional audit fixes (Aug 3 2026)

After re-reviewing the original analysis, 6 additional bugs were identified and fixed:

9. **Urea/Creatinine protein penalty without GFR check** — `product-usefulness-v2.engine.ts:284` penalized ALL protein foods by -3.5 when urea > 8.5 or creatinine > 115, regardless of GFR. Elevated creatinine is normal in bodybuilding (high-protein diet, creatine supplementation, GFR > 60), but the penalty fired unconditionally. Fixed: protein penalty now requires `L.gfr < 60` (real renal impairment); the alkalinizing bonus (pral < -3) remains unconditional.
10. **`bb_quality_score` frozen at load time** — `product-usefulness-v2.engine.ts:417` used `product.bb_quality_score ?? calcBBQualityScore(product)`, which kept a potentially stale pre-computed value. If metabolic_flags or other inputs changed after FOOD_DB load, the score would not update. Fixed: always recalculate via `calcBBQualityScore(product)`, falling back to stored value only if calc returns 0.
11. **`profileTargets` duplicate TDEE calculation** — `IndividualPlanContext.tsx:361-373` computed a second TDEE via legacy `calcNutrition` (ignoring phase/course/weight-adapt), diverging from `calcTargets` which uses `computePlannerTargets`. The "profile" KBJU mode showed different numbers than "auto" mode for the same profile. Fixed: `profileTargets` now uses `computePlannerTargets` with neutral settings (maintenance phase, no injections, no adaptations). Removed unused `calcNutrition` and `calcNutritionV2` imports.
12. **Migration missing `Array.isArray` check** — `planner-storage.ts:85` only checked `typeof parsed !== 'object'`, which let plain objects `{}` pass through for keys that should be arrays. A stored `{foo: 'bar'}` for `he_excluded_foods` (expected array) would crash downstream `.filter/.map` calls. Fixed: added `arrayKeys` set and `!Array.isArray(parsed)` check for keys that must be arrays.
13. **`mealsCount` role removal order** — `meal-plan-engine.ts:1127` removed roles in order `['intra','snack','preSleep','prew']`, dropping intra first. For a 7-meal training day (8 roles: core3 + prew + postw + preSleep + intra + snack2), intra was lost while snack2 (less important) stayed. Fixed: order changed to `['snack2','intra','snack','preSleep','prew']` so snack2 is dropped first, preserving intra for long sessions.
14. **`isMeatId` hardcoded 200+ keywords** — `meal-plan-engine.ts:176` relied on a 200+ string keyword array to identify meat/fish foods, which is fragile and can't adapt to new products. Fixed: `isMeatId` now checks `FOOD_ALLERGEN_DIET` first (canonical source with `isVegetarian` flag), falling back to the keyword heuristic only for unlabeled foods.

### Files modified (round 2)
- `src/engines/product-usefulness-v2.engine.ts` — Urea/Cr GFR check (P0-16), bb_quality_score always recalc (P0-13)
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanContext.tsx` — profileTargets via computePlannerTargets (P1-23), removed unused imports
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/planner-storage.ts` — Array.isArray check for array keys (P1-7)
- `src/ui/screens/NutritionScreen_parts/IndividualPlan/meal-plan-engine.ts` — role removal order snack2→intra (P1-6), isMeatId via FOOD_ALLERGEN_DIET (P2-10)

### Identified but deferred (non-blocking)
- God-Component `IndividualPlanContext.tsx` (2084 lines, 120+ useState) — split into sub-contexts (future refactor).
- Classic `buildDay` path (~500 lines in context) duplicates V2 engine — remove after confirming V2 stability.
- Module-level mutable state `_pickCtx` in `meal-plan-engine.ts` — pass via parameters (future refactor for concurrent safety).
- No dedicated tests for `product-usefulness.engine.ts` (V1) — V2 is covered now.

---

## Manual Program Constructor Audit Fixes (Aug 3 2026)

Critical analysis of the manual program constructor (ручной планировщик) in the training block. All real bugs fixed; analysis items that turned out to be intended behavior were cancelled.

### P0 — Critical fixes
1. **Periodization Designer overlap detection** — `addBlockToDesign` and `moveBlockInDesign` now mark overlapping blocks in `notes` via new `checkBlockOverlap()` helper. `getDesignStats()` returns `overlapWeeks` count and `gapRanges` array. UI shows red warning banner when overlaps or gaps exist.
   - `periodization-designer.engine.ts`: added `checkBlockOverlap()`, overlap marking in `addBlockToDesign`/`moveBlockInDesign`, gap/overlap detection in `getDesignStats()`.
   - `PeriodizationDesignerTab.tsx`: warning banner after phase distribution overview.

### P1 — Important fixes
2. **`handleResize` slider overflow** — slider `max` was hardcoded to 12, allowing `endWeek` to exceed `totalWeeks`. Fixed: `max={Math.min(12, current!.totalWeeks - editBlock.startWeek + 1)}`. Engine `resizeBlockInDesign` already clamped, but UI now prevents the invalid state.
3. **`sendToExecution` PL accessory fallback** — `wmVal` returned `wm.squat` for accessory exercises (null lift from `detectLift`), producing absurd weights (e.g., 98 kg for triceps work at 70% of squat 1RM). Fixed: returns `0` for accessory (consistent with `PLSetEditor.calcW` which returns `null` for accessory). Users enter accessory weights manually.

### P2 — Quality fixes
4. **PDF title XSS** — `program.meta.title` was not HTML-escaped in `printProgram()`, unlike `notes`. A program named `<script>alert(1)</script>` would execute on print. Fixed: added `const safeTitle = (program.meta.title || '').replace(/</g, '&lt;')` used in both `<title>` and `<h1>`.
5. **Touch DnD scroll interference** — long-press timer (350ms) was not cancelled when user scrolled vertically/horizontally >10px, causing accidental drag activation during scroll. Fixed: `onTouchMove` now tracks `touchStartPosRef` and cancels `longPressTimer` if movement exceeds 10px threshold before arming.

### Cancelled (analysis was incorrect)
- **P1-4 floating point progression** — the `Math.round(weight * progression / 2.5) * 2.5` formula is intentional rounding to nearest 2.5 kg (plate step), not a bug. The "0.6 kg error" in the analysis is the expected rounding behavior.
- **P1-1 `data: any` in planner-bridge** — deliberate trade-off documented in code comment. 30+ call sites pass fields not in the typed interfaces (e.g., `techniques` in `VolumePayload`, `SRCycleTemplate` in `ProgramPayload`). Changing to discriminated union would require updating 30+ files — refactor, not bugfix.

### Refactoring (structural improvements)
6. **P0-1 Extract ProgramEditor** — ProgramEditor (1443 lines, inline in ProgramManagerPanel.tsx) extracted to `ProgramEditorView.tsx` as a separate, independently-testable component. ProgramManagerPanel reduced from 2454 to 1011 lines.
7. **P0-3 Dispatch table for applyBridgePayload** — 155-line if/else chain (14 kinds) replaced with dispatch table in `planner-bridge-handlers.ts`. Each `PlannerApplyKind` has its own handler function; adding a new kind requires no modification of existing handlers.
8. **P0-4 Per-direction autoFillDraft** — 143-line `autoFillDraft` (3 direction branches: BB/PL/Hybrid) extracted to `auto-fill-draft.ts` with 3 standalone functions: `autoFillBBDraft`, `autoFillPLDraft`, `autoFillHybridDraft`. Each is independently testable.

### Files modified
- `src/engines/periodization-designer.engine.ts` — `checkBlockOverlap()`, overlap marking, gap/overlap stats
- `src/ui/screens/TrainingScreen_parts/PeriodizationDesignerTab.tsx` — slider max fix, warning banner
- `src/ui/screens/TrainingScreen_parts/ProgramManagerPanel.tsx` — PDF XSS fix, PL accessory fallback fix
- `src/ui/screens/TrainingScreen_parts/ProgramEditorComponents.tsx` — touch DnD scroll cancellation

### Tests
- `src/engines/__tests__/periodization-designer-overlap.test.ts` — 10 new tests: overlap detection (add/move), gap reporting, gap consolidation, resize clamping.
- Full suite: **962 tests passing** (121 test files), 0 TS errors, vite build OK.

---

## Architecture

### BB engine files
| File | Role |
|------|------|
| `bb-builder.engine.ts` | Main BB plan generator |
| `bb-split-patterns.ts` | 16 split definitions |
| `bb-day-types.ts` | Day character, TAG_MUSCLES, ROTATION_PAIRS |
| `bb-tempo-rest.ts` | Tempo/rest specs |
| `bb-autocoach.engine.ts` | Post-phase processing, feeders, deload protocols |
| `bb-metrics.engine.ts` | Plan metrics (heavy%, pump%, MRV checks) |
| `bb-goal-types.ts` | BBTrainingFocus + evidence RIR/reps tables |
| `bb-ped-adaptation.engine.ts` | PED MRV boost |
| `bb-session-order.engine.ts` | Exercise ordering by layer |
| `bb-weakpoint.ts` | Weak-point diagnostics |
| `bb-progression-feedback.engine.ts` | sRPE feedback loop |
| `cycle-to-plan.ts` | Cycle template → BB plan converter |

### ПЛ-авто engine files
| File | Role |
|------|------|
| `lms/macrocycle.engine.ts` | Годовое планирование (5 фаз, СРЦ-циклы) |
| `lms/lms-selector.engine.ts` | Скоринг-подбор СРЦ-цикла |
| `lms/lms-builder.engine.ts` | Генерация плана из шаблона недели 1 + PM-прогрессия |
| `lms/lms-progression.engine.ts` | PM_нед = PM0×(1+k)^нед |
| `lms/weakpoint-pl.ts` | Диагностика слабых точек СРЦ-движений |
| `pro/autoregulation-pro.engine.ts` | Проф-авторегуляция (readiness+HRV+ACWR) |
| `pro/diary-autoreg.engine.ts` | Per-exercise авторегуляция из дневника |
| `lms/lms-progression-feedback.engine.ts` | sRPE feedback loop (дневник → план) |

### SPLIT_PATTERNS (16)
- 3 fullbody variants (2×/3×/4× per week)
- 3 upper/lower variants (3×/4× per week + PHUL)
- PPL 6×, Arnold 6×, Bro 5×, PRO 8-day
- 3 rolling patterns (3/1/3/1, 4/1, ТПТ-О-ТТП)
- Push/Pull 4×, Torso/Limb 4×, Glute Focus 4×

---

## Support Calculator Audit Fixes (Aug 3 2026)

Full critical analysis of the support calculator (`калькулятор поддержки`) — dosing engine, protocol generation, and UI state management. 7 bugs fixed (1 P0, 3 P1, 3 P2), 42 new tests added.

### P0 — Critical fixes
1. **Vitamin D3 toxic dose (20× UL)** — `engine-helpers.ts:650` passed `2000` (interpreted as mcg) to `normalizeDoseByWeight`, then `doseStr` multiplied by 40 (mcg→IU) → 80,000 IU at 70kg. UL = 4,000 IU (100 mcg). Fixed: base dose changed to `50` mcg (= 2,000 IU at reference weight). Additionally added a universal UL-cap loop in `applyTitration` that clamps all substances to their `NUTRIENT_UL` values after weight normalization — protects magnesium, NAC, zinc, selenium, vitamin C, ALA at extreme body weights (200kg+).

### P1 — Important fixes
2. **`classifyPed` missing `'eq'` ID** — `ped-potency-table.ts:152` used `k.includes('eq'+'_')` which produced `'eq_'`, but the common boldenone abbreviation `'eq'` doesn't contain `'eq_'`. The ID `'eq'` fell through to `'other'` → `derivePEDFlags().hasBold = false` → boldenone protocol (cabergoline, hesperidin, serrapeptase) never activated. Fixed: `k === 'eq' || k.startsWith('eq_')`.
3. **Dead `'anastro'`/`'caberg'` checks in `applyTitration`** — `engine-helpers.ts:636,641` checked `s === 'anastro'` and `s === 'caberg'` — no substance in the system has these IDs. Replaced with `substances.includes('anastrozole')` / `substances.includes('cabergoline')` for clarity.
4. **10 missing substance defaults in `generateSchedule`** — `computeProtocol` in `tz-mapper-engine.ts` adds tadalafil, agmatine, pycnogenol, astaxanthin, hesperidin, dandelion, serrapeptase, garlic, metformin, chromium — but `doseStr` defs didn't have entries → displayed "по инструкции" instead of actual doses. Fixed: added all 10 to `defs`, `SUB_NAMES`, morning/afternoon/evening groups, and `chromium` to the mcg-unit list.

### P2 — Quality fixes
5. **Dual `CalcView` type definitions** — `SupportScreen.tsx:61` defined a local `CalcView` without `'mixcalc'`, while `SupportShared.tsx:13` exported it with `'mixcalc'`. Child components calling `setCalcView('mixcalc')` worked only due to `any` typing in the state bag. Fixed: added `'mixcalc'` to the local type.
6. **Dead code removal (~40 lines)** — Removed orphan state variables `stackCalcSize`, `stackCalcOrgans`, `stackCalcMech`, `stackCalcMode`, `generatedStack`, `generatedStacks` and the `availableMechs` useMemo from `SupportScreen.tsx` — none were read by any child component. Removed `useCalculatorState` hook (never imported/called by any component) and deleted `Calc.state.ts`. Removed unused `ORGAN_MECHANISMS` import. Cleaned barrel export in `Calculator/index.ts`.
7. **`getMinDose`/`getMaxDose` unused `unit` parameter** — `support-dosing.ts:663,668` accepted a `unit` parameter but never used it. Fixed: removed the dead parameter.

### Files modified
- `src/engines/support-plan/engine-helpers.ts` — D3 dose fix, UL-cap loop, dead check removal, new substance defaults/names/groups
- `src/data/ped-potency-table.ts` — `eq` classification fix
- `src/data/support-dosing.ts` — `getMinDose`/`getMaxDose` signature cleanup
- `src/ui/screens/SupportScreen.tsx` — CalcView type, dead code removal, unused import cleanup
- `src/ui/screens/Calculator/index.ts` — barrel export cleanup
- `src/ui/screens/Calculator/Calc.state.ts` — deleted (dead code)

### Tests
- `src/engines/__tests__/support-calc-audit.test.ts` — **42 new tests**: P0-1 vitamin D3 UL (4 tests), P0-1b UL cap for all substances (6 tests), normalizeDoseByWeight (3 tests), P1 classifyPed boldenone (6 tests), P1 applyTitration anastrozole/cabergoline guardrail-aware (4 tests), P1 generateSchedule new substances (13 tests), P2 getMinDose/getMaxDose (5 tests), P2 CalcView type (1 test).
- Full suite: **1041 tests passing** (125 test files), 0 TS errors, vite build OK.
