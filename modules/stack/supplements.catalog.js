import { SUPPLEMENTS } from "./supplements.catalog.js";
import { SYNERGY_MATRIX } from "./synergy.matrix.js";
import { CONFLICT_MATRIX } from "./conflicts.matrix.js";
import { applyContraindications } from "../risk/contra.engine.js";

/* -------------------------------------------------------
   1. АГРЕГАЦИЯ МЕХАНИЗМОВ ПО ОСЯМ
------------------------------------------------------- */

export function calculateMechanismLoad(axes, userScores) {
  const mechLoad = {};

  axes.forEach(axis => {
    const score = userScores[axis.axis_code] || 0;

    axis.mechanisms.forEach(m => {
      if (!mechLoad[m.code]) mechLoad[m.code] = 0;
      mechLoad[m.code] += score * m.weight;
    });
  });

  return mechLoad;
}

/* -------------------------------------------------------
   2. ПОДБОР БАДОВ ПО МЕХАНИЗМАМ
------------------------------------------------------- */

export function generateRawStack(mechLoad) {
  const stack = {};

  Object.entries(mechLoad).forEach(([mech, load]) => {
    if (load < 20) return;

    SUPPLEMENTS.forEach(supp => {
      if (supp.mechanisms.includes(mech)) {
        if (!stack[supp.code]) stack[supp.code] = 0;
        stack[supp.code] += load;
      }
    });
  });

  return stack;
}

/* -------------------------------------------------------
   3. НОРМАЛИЗАЦИЯ ПРИОРИТЕТОВ
------------------------------------------------------- */

export function normalizeStack(rawStack) {
  const max = Math.max(...Object.values(rawStack));

  return Object.entries(rawStack)
    .map(([code, weight]) => {
      const supp = SUPPLEMENTS.find(s => s.code === code);
      return {
        code,
        name: supp.name,
        priority: Math.round((weight / max) * 100),
        mechanisms: supp.mechanisms,
        tags: supp.tags
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

/* -------------------------------------------------------
   4. СИНЕРГИЯ ПО МАТРИЦЕ
------------------------------------------------------- */

export function synergyIndex(stack) {
  const codes = Object.keys(stack);
  let synergy = 0;

  SYNERGY_MATRIX.forEach(rule => {
    const [a, b] = rule.pair;
    if (codes.includes(a) && codes.includes(b)) {
      synergy += rule.synergyScore;
    }
  });

  return synergy;
}

/* -------------------------------------------------------
   5. КОНФЛИКТЫ БАДОВ
------------------------------------------------------- */

export function detectConflicts(stack) {
  const codes = Object.keys(stack);
  const conflicts = [];

  CONFLICT_MATRIX.forEach(rule => {
    const [a, b] = rule.pair;

    if (codes.includes(a) && codes.includes(b)) {
      conflicts.push({
        pair: [a, b],
        type: rule.type,
        severity: rule.severity,
        comment: rule.comment
      });
    }
  });

  return conflicts;
}

/* -------------------------------------------------------
   6. ФИНАЛЬНАЯ СБОРКА СТЕКА (v3)
------------------------------------------------------- */

export function buildStackV3(axes, userScores, userRisks) {
  const mechLoad = calculateMechanismLoad(axes, userScores);
  const rawStack = generateRawStack(mechLoad);
  const normalized = normalizeStack(rawStack);

  const synergy = synergyIndex(rawStack);
  const conflicts = detectConflicts(rawStack);

  const safe = applyContraindications(normalized, userRisks);

  return {
    mechanisms: mechLoad,
    stack: safe.stack,
    synergyIndex: synergy,
    conflicts,
    blocked: safe.blocked,
    warnings: safe.warnings
  };
}
