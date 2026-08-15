import { describe, expect, it } from "vitest";
import { getPLWeakGroupExerciseCandidates } from "../../lms/lms-builder.engine";
import { CYCLE_01 } from "../../../data/lms-cycles/cycle-01";
import { CYCLE_02 } from "../../../data/lms-cycles/cycle-02";
import { CYCLE_03 } from "../../../data/lms-cycles/cycle-03";
import { CYCLE_04 } from "../../../data/lms-cycles/cycle-04";
import { CYCLE_05 } from "../../../data/lms-cycles/cycle-05";
import { CYCLE_06 } from "../../../data/lms-cycles/cycle-06";
import { CYCLE_07 } from "../../../data/lms-cycles/cycle-07";
import { CYCLE_08 } from "../../../data/lms-cycles/cycle-08";
import { CYCLE_09K } from "../../../data/lms-cycles/cycle-09k";
import { CYCLE_09S } from "../../../data/lms-cycles/cycle-09s";
import { CYCLE_10 } from "../../../data/lms-cycles/cycle-10";
import { CYCLE_11 } from "../../../data/lms-cycles/cycle-11";
import { CYCLE_12K } from "../../../data/lms-cycles/cycle-12k";
import { CYCLE_12S } from "../../../data/lms-cycles/cycle-12s";
import { CYCLE_13 } from "../../../data/lms-cycles/cycle-13";

const SUBS: Record<string, { label: string; patterns: string[]; nameRe?: RegExp }[]> = {
  chest: [
    { label: "верх", patterns: ["incline_push"] },
    { label: "низ", patterns: ["dip_push", "decline_push"] },
    { label: "изоляция", patterns: ["isolation_chest"] },
  ],
  back: [
    { label: "широчайшие", patterns: ["vertical_pull"] },
    { label: "толщина", patterns: ["horizontal_pull"] },
    { label: "изоляция", patterns: ["isolation_back"] },
    { label: "задние дельты", patterns: ["isolation_shoulders"] },
  ],
  legs: [
    { label: "квадры", patterns: ["lunge", "isolation_legs_quad"] },
    { label: "бицепс бедра", patterns: ["isolation_legs_ham", "hinge"] },
    { label: "ягодицы", patterns: ["glute_squat", "hinge"] },
    { label: "икры", patterns: ["isolation_calves"] },
  ],
  shoulders: [
    { label: "передние", patterns: ["isolation_shoulders"], nameRe: /передн|фронт|жим стоя|армейск/i },
    { label: "средние", patterns: ["isolation_shoulders"], nameRe: /средн|в сторону|в стороны|махи|подбородку/i },
    { label: "задние", patterns: ["isolation_shoulders"], nameRe: /задн|в наклоне|к лицу|разведен/i },
  ],
  arms: [
    { label: "бицепс", patterns: ["isolation_arms"], nameRe: /бицепс|сгибан|молот|скотт|брахи|curl/i },
    { label: "трицепс", patterns: ["isolation_arms"], nameRe: /трицепс|разгибан|француз|узким хватом|tricep/i },
  ],
  core: [
    { label: "пресс", patterns: ["core"] },
    { label: "косые", patterns: ["rotation", "anti_rotation"] },
  ],
};

describe("подгруппы слабых мышц: покрытие на всех циклах", () => {
  it("ни одна подгруппа ни на одном цикле не пуста", () => {
    const cycles: Record<string, any> = { C01: CYCLE_01, C02: CYCLE_02, C03: CYCLE_03, C04: CYCLE_04, C05: CYCLE_05, C06: CYCLE_06, C07: CYCLE_07, C08: CYCLE_08, C09K: CYCLE_09K, C09S: CYCLE_09S, C10: CYCLE_10, C11: CYCLE_11, C12K: CYCLE_12K, C12S: CYCLE_12S, C13: CYCLE_13 };
    const empty: string[] = [];
    for (const [cname, cycle] of Object.entries(cycles)) {
      for (const [group, subs] of Object.entries(SUBS)) {
        const all = getPLWeakGroupExerciseCandidates(cycle as any, group);
        for (const sub of subs) {
          const filtered = all.filter(e => sub.patterns.includes(e.movementPattern || ""))
            .filter(e => !sub.nameRe || sub.nameRe.test(`${e.name} ${e.targetMuscle || ""}`));
          if (filtered.length === 0) empty.push(`${cname}/${group}/${sub.label}`);
        }
      }
    }
    expect(empty, "пустые подгруппы: " + empty.join(" | ")).toEqual([]);
  });
});