import { describe, expect, it } from "vitest";
import { analyzePhaseAssistance, analyzeBarPathAssistance } from "../lift-assistance.engine";
import { barPathIssuesForLift, diagnoseMovement } from "../lift-diagnostics.engine";
import { WEAK_POINTS_BY_LIFT } from "../../lms/weakpoint-pl";

const LIFTS = ["bench", "squat", "deadlift", "ohp", "row", "pulldown", "incline_press"] as const;

describe("diagnostics coverage audit", () => {
  it("все движения имеют bar-path issues", () => {
    for (const l of LIFTS) {
      const issues = barPathIssuesForLift(l);
      expect(issues.length, `${l} без bar-path issues`).toBeGreaterThan(0);
    }
  });
  it("все фазы всех движений дают упражнения (analyzePhaseAssistance)", () => {
    const empty: string[] = [];
    for (const l of LIFTS) {
      for (const wp of WEAK_POINTS_BY_LIFT[l] ?? []) {
        const r = analyzePhaseAssistance(l, wp);
        if (r.items.length === 0) empty.push(`${l}/${wp}`);
      }
    }
    expect(empty, "пустые фазы: " + empty.join(", ")).toEqual([]);
  });
  it("diagnoseMovement не падает для всех фаз", () => {
    for (const l of LIFTS) {
      for (const wp of WEAK_POINTS_BY_LIFT[l] ?? []) {
        const d = diagnoseMovement(l, wp);
        expect(d, `${l}/${wp}`).toBeTruthy();
      }
    }
  });
});

