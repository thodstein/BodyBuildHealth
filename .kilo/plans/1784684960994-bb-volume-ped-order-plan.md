# BB-auto: PED volume + chest-primary order + deload swap

## Goal
Make BB-auto generator produce PRO-level volume for AAS/insulin/GH/IGF users (10-12 exercises/session on enhanced), fix chest-primary ordering on push days, deload not just reducing load but swapping exercises, and ensure PED dose-aware adaptation is actually wired into plan generation in BOTH UI shells (BbAutoConstructor + SRCBBScreen PL-mode).

## Constraints
- Do NOT modify `src/engines/bb/bb-ped-adaptation.engine.ts` multiplier math (already dose-aware, correct).
- Do NOT modify `bb-autocoach.engine.ts` DELOAD_PROTOCOLS definitions.
- Do NOT delete any existing code — only add/amend specs.
- All edits must pass `tsc --noEmit` and `vite build`.

---

## 1. PED volume: `exerciseCount` cap is too conservative on PED (HIGH)

### Root cause confirmed (from code inspection)
In `bb-builder.engine.ts`:

```text
line 624:  const primaryBase = ['back','quads','chest','shoulders'].includes(muscle)
               ? (isMultiDay ? 3 : (isSingleFreq ? 3 : 4)) : 2;
line 627:  let exerciseCount = role === 'primary'
               ? Math.min(isMultiDay ? 3 : (isSingleFreq ? 3 : 4),
                          primaryBase + Math.max(0, levelBase-2) + pedBoost)
               : Math.min(3, accessoryCount + Math.floor(pedBoost/2) + accessoryBoost);
line 1093: const exCap = pedAdapt && pedAdapt.combinedRecoveryMultiplier >= 1.3 ? 12 : 8;
```

**Bugs:**
1. `Math.min(isMultiDay ? 3 : ...)` — hard caps at **3** for primary muscles on ANY multi-day split (PPL 6×, UL 4×, etc.). With pedBoost=2 (enhanced) and levelBase=4, inner sum = 4+2+2 = 8 → but outer Math.min=3 kills it. Realistically on enhancement you want 4-6 compounds per primary muscle group per session.
2. Accessory cap `Math.min(3, ...)` caps at 3 maximum on any split. On AAS/insulin/GH/IGF (combined recovery 1.5-1.85), arms/shoulders should get 3-4 accessories, not 2-3.
3. `exCap` 12 on PED is fine, but the per-muscle cap at line 624-629 prevents hitting it.

### Implementation

**File:** `src/engines/bb/bb-builder.engine.ts`

Replace the per-muscle exerciseCount block (lines 621-634) with:

```typescript
    const levelBase = level === 'beginner' ? 1 : level === 'intermediate' ? 2 : level === 'enhanced' ? 4 : 3;
    const isSingleFreq = (muscleSessionCount[muscle] || 1) === 1;
    const isArm = ['triceps','biceps','shoulders','forearms','arms'].includes(muscle);
    const isLeg = ['quads','hamstrings','glutes','calves'].includes(muscle);

    // PED-порог для повышения объёма: combinedMrvMultiplier ≥ 1.3 → не натурал.
    const onPED = pedAdapt ? pedAdapt.combinedMrvMultiplier >= 1.3 : false;

    // Base compounds per primary session: на PED主题教育起重 compound-объём.
    const primaryBase = ['back','quads','chest','shoulders'].includes(muscle)
      ? (isMultiDay ? (onPED ? 4 : 3) : (isSingleFreq ? 3 : (onPED ? 5 : 4)))
      : (isArm && onPED ? 3 : 2);
    const accessoryBase = isArm && onPED ? 3 : (isArm ? 2 : 1);
    const accessoryBoost = isSingleFreq ? 0 : (isArm ? 1 : 0);
    let exerciseCount = role === 'primary'
      ? Math.min(isMultiDay ? (onPED ? 5 : 3) : (isSingleFreq ? 4 : (onPED ? 6 : 4)),
                 primaryBase + Math.max(0, levelBase - 2) + pedBoost)
      : Math.min(isArm && onPED ? 4 : 3,
                 accessoryBase + Math.floor(pedBoost / 2) + accessoryBoost);
```

Update the per-session `exCap` (line 1093) to:
```typescript
  const exCap = pedAdapt && pedAdapt.combinedRecoveryMultiplier >= 1.3 ? 15 : 9;
```
(Push days on full PED stack: 3 primary × 4-5 + 3 arm accessories + pump finishers = 12-15 realistic.)

---

## 2. Primary muscle ordering on chest push day (HIGH)

### Root cause confirmed
`bb-session-order.engine.ts` rankKey does not receive `TAG_PRIMARY_MUSCLES`. For Push day `TAG_PRIMARY_MUSCLES['Push'] = {chest, shoulders, triceps}` — all three are "primary", but within them, chest must always rank first (it's the push-day nomenclature anchor). Currently both OHP and bench can sort arbitrarily depending on load/equipment rank.

**File:** `src/engines/bb/bb-session-order.engine.ts`

In `rankKey` (line 125), add a primary-muscle priority sub-rank BEFORE tier:

```typescript
function rankKey(ex: BBExercise, primaryMuscle: string, tagMuscleSet: Set<string>, methodology: SessionMethodology = 'compound_first'): number[] {
  const exMuscle = collapseMuscle(ex.muscle || '');
  const isPrimaryMuscle = exMuscle === collapseMuscle(primaryMuscle);
  // tagPriority: первая мышца в tagMuscleSet — главная мышца дня (для Push = chest, Pull = back).
  const tagArray = Array.from(tagMuscleSet);
  const primaryIndex = tagArray.indexOf(exMuscle);
  const tagPriority = primaryIndex >= 0 ? primaryIndex : 99;
  ...
  return [tier, primaryMuscleFlag, muscP, tagPriority, subOrder, load];
}
```

Update return tuple and sort loop accordingly (1 extra element). This guarantees: on Push day all chest exercises sort before all shoulder exercises, which sort before all triceps exercises — regardless of load.

Also update docstring at top of file: "4. Основная мышца дня (первая в TAG_MUSCLES[tag]) — раньше остальных primary в том же тире."

---

## 3. Deload exercise swap, not just RIR/weight change (HIGH)

### Root cause
`applyDeloadToWeek` (`bb-autocoach.engine.ts:205`) only lowers sets/weight/RIR on the same exercises. The session still opens with the same compound lift. PRO deload practice: swap heavy compounds → machine/cable/bodyweight equivalents to unload CNS + joints while keeping movement pattern.

**File:** `src/engines/bb/bb-autocoach.engine.ts`

Add swap maps + fallback selector in `applyDeloadToWeek`:

```typescript
const DELOAD_SWAP_MAP: Record<string, string> = {
  'жим штанги лёжа': 'жим гантелей лёжа',
  'жим гантелей лёжа': 'жим в тренажёре',
  'жим стоя': 'жим гантелей сидя',
  'присед со штангой': 'жим ногами',
  'становой тяга': 'румынская тяга с гантелями',
  'тяга в наклоне': 'тяга верхнего блока',
  'подтягивания': 'тяга верхнего блока',
  'армейский жим': 'жим гантелей сидя',
};

function findDeloadSwap(exName: string): string | null {
  const n = (exName || '').toLowerCase();
  for (const [heavy, light] of Object.entries(DELOAD_SWAP_MAP)) {
    if (n.includes(heavy.toLowerCase()) || heavy.toLowerCase().includes(n)) return light;
  }
  // Fallback: заменить на cable/машину версию той же мышцы
  return null;
}
```

In `applyDeloadToWeek`, before the inner loop, try swap first:

```typescript
export function applyDeloadToWeek(week: BBWeek, protocol: DeloadProtocol): BBWeek {
  const w2 = JSON.parse(JSON.stringify(week)) as BBWeek;
  for (const s of w2.sessions) {
    for (const e of s.exercises) {
      const swapName = findDeloadSwap(e.exerciseName || e.name || '');
      if (swapName) {
        const swapEx = (EXERCISE_CATALOG as any).find((ex: any) =>
          (ex.name || '').toLowerCase().includes(swapName.toLowerCase()) ||
          swapName.toLowerCase().includes((ex.name || '').toLowerCase())
        );
        if (swapEx) {
          e.name = swapEx.name;
          e.exerciseName = swapEx.name;
          e.muscle = swapEx.targetMuscle || e.muscle;
          if (!protocol.keepOriginalReps) e.repsRange = [protocol.repRange[0], protocol.repRange[1]];
          for (const ws of e.workSets) {
            if (!protocol.keepOriginalReps) ws.reps = Math.round((protocol.repRange[0]+protocol.repRange[1])/2);
            ws.weight = Math.round((e.workSets?.[0]?.weight || ws.weight) * protocol.intensityMultiplier * 10) / 10;
            ws.restSeconds = protocol.restSeconds;
          }
          continue;
        }
      }
      // existing reduction logic (unchanged) ...
      e.sets = Math.max(1, Math.round(e.sets * protocol.volumeMultiplier));
      ...
```

Add `import { EXERCISE_CATALOG } from '../../core/exercise-catalog';` at top if not present.

---

## 4. loadStrategy + deload double-modify fix (HIGH — REQUIRES USER DECISION)

### Current bug
`loadStrategy` sets week-over-week weight progression (linear +2.5kg/нед). Deload week also applies `weight × 0.55`. Those two multipliers stack → deload becomes 30% of week N-1 instead of 55% of planned. Need to decide: either loadStrategy is **skipped on deload weeks**, or deload multiplier is applied to the **pre-progression** weight.

**Question to user:** Should `prescribeLoad` / weight progression be suppressed during deload weeks?

**Recommended answer:** Yes. Deload is a reset week — no progression. Implementation: in `applyDeloadToWeek` or `bb-builder.engine.ts` deload loop, set `e.comment += ' · [deload: прогрессия暂停]'` and skip applying `prescribeLoad` output for deload-phase weeks.

If you agree, add a guard in `BbAutoConstructor.tsx` where `prescribeLoad` is called:

```typescript
const applyStrategy = phase !== 'deload' && strategy !== 'none';
if (applyStrategy) { ... prescribeLoad ... }
```

---

## 5. Phase equipment hard filter (MEDIUM)

### Root cause
`PHASE_EQUIPMENT_PREF[phase]` (line 936) is currently passed as `preferEquipment` soft-score to `selectExercisesSmart`. For accumulation phases that are meant to be cable/machine-heavy (e.g., 4/6 weeks), the pool still produces heavy barbell compounds. Convert to a post-select filter: after `selectExercisesSmart`, if the chosen exercise's equipment doesn't match phase pref, downgrade rank and pick the next candidate.

**File:** `src/engines/bb/bb-builder.engine.ts` around line 936

After `selectExercisesSmart` returns, add:
```typescript
    const phaseEquip = PHASE_EQUIPMENT_PREF[phase] || ['barbell','dumbbell','machine','cable'];
    if (phaseEquip.length > 0 && exDatas.length > 1) {
      const firstEq = String((exDatas[0] as any)?.equipment || '').toLowerCase();
      if (!phaseEquip.some(eq => firstEq.includes(eq))) {
        // Первое упражнение не соответствует фазе — ищем подходящее в уже выбранных
        const better = exDatas.find((d: any) => phaseEquip.some(eq => String(d.equipment||'').toLowerCase().includes(eq)));
        if (better) {
          const idx = exDatas.indexOf(better);
          if (idx > 0) { const [moved] = exDatas.splice(idx, 1); exDatas.unshift(moved); }
        }
      }
    }
```

---

## 6. Rear delt filter expansion (MEDIUM)

### Root cause
`pushDay`-only rear delt exclusion (line 660, 730) excludes rear delt in Push/Chest/Shoulders days BUT `TAG_MUSCLES['ShouldersArms']` includes `delt_rear` — a ShouldersArms session tag gets rear delt blocked because `pushDay` check matches 'shoulders' in the tag string. Additionally, `ChestBack` tag (chest+back+delt_front+delt_rear+traps) has rear delt implicitly via back muscles but the tag check doesn't cover it.

**Fix:** Expand `allowRear` to include `tag === 'back'` (already) AND allow rear delt in sessions where `delt_rear` appears as an explicit primary (Pull, Back, ShouldersArms where rear is paired with back work). Inline fix in both filters at lines 660 and 730:

```typescript
// было:
const pushDay = isPushDayTag(sched.sessionTag || '');
// После:
const tag = (sched.sessionTag || '').toLowerCase();
const isPushDay = /push|chest|shoulders/.test(tag) && !/pull|back|crossover/.test(tag);
const isPurePull = /pull|back/.test(tag) && !/push|chest/.test(tag);
// Rear delt разрешён только на pure-pull/back-днях, исключён на чистых push/chest/shoulders
if (isPurePull ? false : (isPushDay || tag === 'chest' || tag === 'shoulders')) { filter rear }
```

---

## 7. Movement-pattern diversity guard per session (LOW)

**File:** `src/engines/bb/bb-builder.engine.ts`

After the exercise selection loop and before `orderSessionExercises`, verify each session has ≥2 distinct `derivePattern()` values among `exDatas`. If all exercises share the same pattern (e.g., all horizontal_push in chest day), re-run `selectExercisesSmart` for the muscle with `type:'any'` to force different pattern. Log to `rationale`.

---

## 8. Exercise freshness prevention (LOW)

**File:** `src/engines/bb/bb-builder.engine.ts`

`rotationUsedByMuscle` already prevents same exercise across weeks. Add per-session guard: in `buildSession`, before adding to `exDatas`, also check `sessionUsedInWeek[muscle].has(exId)` (reset each week) to prevent repeating the same exercise twice in the same week on different days.

---

## Validation plan (after edits)

1. `tsc --noEmit` → 0 errors
2. `vite build` → 0 errors
3. Runtime check (manual npx tsx against bb-builder.engine.ts OR reading built plan):
   - `upper_lower_4, enhanced, on AAS 500/ins 10/GH 4/IGF1 50`:
     - Push day ≥ 10 exercises
     - chest first exercise is a flat barbell bench (or DB bench) → verified by `orderSessionExercises`
     - deload week: session swaps barbell → dumbbell/machine -> verified by `applyDeloadToWeek`
4. `upper_lower_4, enhanced, on AAS 1000/ins 20/GH 8/IGF1 75`:
     - exCap = 15, no plan should be >15 exercises per session
5. Chest day on `bro_5` split (1×/нед chest):
     - chest exerciseCount ≥ 4 (was 3) on enhanced
6. Rear delt:
     - Push/Chest/Shoulders day: rear delt absent
     - Pull/Back day: rear delt present

## Files modified (summary)
- `src/engines/bb/bb-builder.engine.ts` — lines 621-629 (exerciseCount PED), 936+ (equipment hard filter), +freshness guard
- `src/engines/bb/bb-session-order.engine.ts` — rankKey +1 tagPriority parameter
- `src/engines/bb/bb-autocoach.engine.ts` — applyDeloadToWeek swap logic + EXERCISE_CATALOG import
