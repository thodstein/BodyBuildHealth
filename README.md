# BodyBuildHealth — Powerlifting / BB Planner

94 цикла (42 LMS + 50 новых: Smolov 13/Jr, Sheiko 29-32/37/CMS/MS/AML20, Candito 6, GZCLP/UHF, Juggernaut 16, Texas/Madcow, Westside Conjugate, Korte 8, Calgary 16/8, RTS 9, Golovinsky 8, Wendler 5/3/1/BBB, Cube 10, Bulgarian, Lilliebridge 8, Russian Squat 6, Hatch 12, PHUL/PHAT 12, Coan Deadlift 10, Kizen Sheiko 12, TenTwentyLife 12, Base Building 8, TSA 9, Bridge 8, PHUL/PHAT)

Движки: `fitCycleToWeeks` с `needsConsent` (любое изменение раскладки — только по согласию), `PLSeasonBuilder` (4 слота + дубль + пролёты между стартами), VBT MVT/readiness/VBL, Frequency Planner (MEV/MRV), Attempt Calculator (velocity 0.37/0.30/MVT), Block View, Traffic Light (HRV+ACWR+RPE), OPL import.

# Synopsis


# Description

Пороги анализов (ВГН, ступени печени, женские зоны) живут в одном месте —
`src/engines/lab-norms.engine.ts`; правила правки и список потребителей —
`docs/LAB-NORMS-SINGLE-SOURCE.md`. Аудит калькулятора поддержки по проходам —
`docs/SUPPORT-CALC-FULL-AUDIT-PLAN.md`.

# Example

# Install:
`npm install health-engine-tz`

# Test:
`npm test`

#License:

