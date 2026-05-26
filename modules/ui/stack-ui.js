/* -------------------------------------------------------
   UI МОДЕЛЬ ДЛЯ ВЫВОДА СТЕКА
------------------------------------------------------- */

export function buildStackUI(result) {
  const {
    stack,
    synergyIndex,
    conflicts,
    blocked,
    warnings,
    mechanisms
  } = result;

  return {
    header: {
      title: "Ваш персональный стек",
      synergyIndex,
      conflictsCount: conflicts.length,
      blockedCount: blocked.length,
      warningsCount: warnings.length
    },

    mechanisms: Object.entries(mechanisms)
      .sort((a, b) => b[1] - a[1])
      .map(([mech, load]) => ({
        mechanism: mech,
        load: Math.round(load)
      })),

    stack: stack.map(item => ({
      code: item.code,
      name: item.name,
      priority: item.priority,
      tags: item.tags,
      mechanisms: item.mechanisms,
      axes: item.axes,
      risks: item.risks,
      text: item.text
    })),

    conflicts: conflicts.map(c => ({
      pair: c.pair,
      severity: c.severity,
      comment: c.comment
    })),

    blocked: blocked.map(b => ({
      code: b.code,
      reason: b.reason,
      risk: b.risk
    })),

    warnings: warnings.map(w => ({
      code: w.code,
      reason: w.reason,
      risk: w.risk
    }))
  };
}