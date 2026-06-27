/**
 * exercise-prescription.engine.ts — P8: прескрипция упражнений по биомеханике (проф. уровень).
 * REUSE exercise-catalog (group/type/equipment/jointStress) + movement-engines (joint stress) +
 * weakpoint-pl. Расширение: региональная гипертрофия (lengthened partials / stretch-mediated),
 * force-vector классификация, фильтр по суставным ограничениям, слабое место → ассистентные.
 */
import { EXERCISE_CATALOG, getExercisesByGroup } from "../../core/exercise-catalog";
import { diagnoseWeakPoint } from "../lms/weakpoint-pl";
import type { Lift, WeakPoint } from "../lms/weakpoint-pl";

export type ForceVector = "horizontal_push" | "horizontal_pull" | "vertical_push" | "vertical_pull" | "knee_dominant" | "hip_dominant" | "core_anti" | "other";

/** Force-vector по группе + типу (упрощённая карта). */
export function forceVector(group: string, type: string, name?: string): ForceVector {
  const n = (name || "").toLowerCase();
  if (group === "chest") return "horizontal_push";
  if (group === "back") return /подтяг|pullup|верх|up|chin/.test(n) ? "vertical_pull" : "horizontal_pull";
  if (group === "shoulders") return "vertical_push";
  if (group === "legs") return /наклон|rdl|становая|ягодиц|hip|glute|hamstring|бицепс бедр|румынская|римская|мёртвая/.test(n) ? "hip_dominant" : "knee_dominant";
  if (group === "core") return "core_anti";
  if (group === "arms") return "other";
  return "other";
}

/** Суставы, нагружаемые группой (для фильтра ограничений). */
export const MUSCLE_TO_JOINTS: Record<string, string[]> = {
  chest: ["shoulder"], back: ["shoulder", "spine"], legs: ["knee", "hip", "spine"],
  shoulders: ["shoulder"], arms: ["elbow"], core: ["spine"],
};

/** Региональная гипертрофия: упражнения с акцентом на растянутую/удлинённую позицию (stretch-mediated).
 *  Curated список по мышцам (lengthened-partial / глубокое растяжение). */
export const REGIONAL_HYPERTROPHY: Record<string, { name: string; emphasis: string }[]> = {
  chest: [
    { name: "Разводка гантелей лёжа", emphasis: "lengthened partials в нижней точке (глубокое растяжение)" },
    { name: "Сведение в кроссовере снизу", emphasis: "растянутая позиция в верхней амплитуде" },
    { name: "Отжимания на брусьях (грудной стиль)", emphasis: "глубокое растяжение низа груди" },
  ],
  back: [
    { name: "Тяга штанги в наклоне", emphasis: "растянутая широчайшая в нижней точке" },
    { name: "Подтягивания", emphasis: "полное растяжение в висе" },
  ],
  legs: [
    { name: "Румынская тяга", emphasis: "lengthened hamstring в нижней точке (stretch-mediated)" },
    { name: "Болгарские сплит-приседы", emphasis: "глубокое растяжение квадрицепса" },
    { name: "Выпады", emphasis: "растянутая позиция бедра" },
  ],
  shoulders: [
    { name: "Махи гантелей в стороны", emphasis: "lengthened partials в нижней точке дельты" },
  ],
  arms: [
    { name: "Сгибание рук с гантелями на наклонной скамье", emphasis: "растянутый бицепс за спиной" },
    { name: "Французский жим", emphasis: "растянутый трицепс в нижней точке" },
  ],
};

export interface PrescriptionInput {
  muscle: string;
  goal: "strength" | "hypertrophy" | "power";
  weakPoint?: { lift: Lift; point: WeakPoint };
  constraints?: string[];       // повреждённые суставы для исключения
  equipment?: string[];        // доступное оборудование
  limit?: number;
}

export interface PrescribedExercise {
  id: string; name: string; group: string; type: string; equipment: string;
  jointStress: string; forceVector: ForceVector;
  score: number; rationale: string;
  lengthenedEmphasis?: string;   // если упражнение из региональной гипертрофии
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Подобрать упражнения под мышцу/цель/слабое-место/ограничения/оборудование. */
export function prescribeExercises(input: PrescriptionInput): PrescribedExercise[] {
  const { muscle, goal, weakPoint, constraints = [], equipment, limit = 6 } = input;
  const candidates = getExercisesByGroup(muscle);
  const injuredJoints = new Set(constraints.map(c => c.toLowerCase()));
  const regional = REGIONAL_HYPERTROPHY[muscle] || [];
  const regionalNames = new Map(regional.map(r => [r.name.toLowerCase(), r.emphasis]));
  const muscleJoints = MUSCLE_TO_JOINTS[muscle] || [];

  const ranked: PrescribedExercise[] = candidates.map(ex => {
    let score = 10;
    const rationale: string[] = [];
    // цель
    if (goal === "strength" && ex.type === "compound") { score += 30; rationale.push("compound для силы"); }
    if (goal === "hypertrophy") { score += ex.type === "compound" ? 12 : 18; rationale.push(ex.type === "isolation" ? "изоляция для гипертрофии" : "compound объём"); }
    if (goal === "power" && ex.type === "compound") { score += 25; rationale.push("compound для мощности"); }
    // региональная гипертрофия
    const emphasis = regionalNames.get(ex.name.toLowerCase());
    if (emphasis) { score += 20; rationale.push("stretch-mediated: " + emphasis); }
    // ограничения: исключаем high-stress на повреждённом суставе
    const stressedJoint = muscleJoints.find(j => injuredJoints.has(j));
    if (stressedJoint && ex.jointStress === "high") { score -= 100; rationale.push(`исключено: high-stress на ${stressedJoint}`); }
    // оборудование
    if (equipment && equipment.length > 0 && !equipment.includes(ex.equipment)) { score -= 15; rationale.push(`нет оборудования (${ex.equipment})`); }
    // низкая усталость предпочтительнее для гипертрофии-объёма
    if (goal === "hypertrophy" && ex.fatigueCost <= 5) { score += 5; }
    return {
      id: ex.id, name: ex.name, group: ex.group, type: ex.type, equipment: ex.equipment,
      jointStress: ex.jointStress, forceVector: forceVector(ex.group, ex.type, ex.name),
      score, rationale: rationale.join("; "),
      lengthenedEmphasis: emphasis,
    };
  });
  // слабое место → добавить ассистентные (из weakpoint-pl)
  let assistance: PrescribedExercise[] = [];
  if (weakPoint) {
    const diag = diagnoseWeakPoint(weakPoint.lift, weakPoint.point);
    assistance = diag.assistance.map((name, i) => {
      const cat = EXERCISE_CATALOG.find(e => e.name === name);
      return {
        id: cat?.id || "assist_" + i, name, group: cat?.group || muscle, type: cat?.type || "compound",
        equipment: cat?.equipment || "barbell", jointStress: cat?.jointStress || "med",
        forceVector: cat ? forceVector(cat.group, cat.type, cat.name) : "other",
        score: 80 - i * 5, rationale: `Слабое место (${diag.label}): ${diag.rationale.slice(0, 60)}`,
      };
    });
  }
  const main = ranked.filter(e => e.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  return [...assistance.slice(0, 3), ...main].slice(0, limit + 3);
}

/** Топ lengthened-partial упражнений для мышц (для региональной гипертрофии). */
export function lengthenedPartials(muscle: string): { name: string; emphasis: string }[] {
  return REGIONAL_HYPERTROPHY[muscle] || [];
}
