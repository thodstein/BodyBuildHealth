import { CONTRA_RULES } from "./contra.rules.js";

/* -------------------------------------------------------
   ПРОВЕРКА ПРОТИВОПОКАЗАНИЙ ДЛЯ СТЕКА
------------------------------------------------------- */

export function applyContraindications(stack, userRisks) {
  const blocked = [];
  const warnings = [];

  Object.entries(userRisks).forEach(([riskCode, riskValue]) => {
    if (riskValue < 40) return; // низкий риск — игнорируем

    CONTRA_RULES.forEach(rule => {
      if (rule.risk !== riskCode) return;

      rule.supplements.forEach(supp => {
        const item = stack.find(s => s.code === supp);
        if (!item) return;

        if (riskValue >= 70 && rule.severity >= 2) {
          // Полный запрет
          blocked.push({
            code: supp,
            reason: rule.comment,
            risk: riskCode
          });
        } else {
          // Только предупреждение
          warnings.push({
            code: supp,
            reason: rule.comment,
            risk: riskCode
          });
        }
      });
    });
  });

  // Удаляем заблокированные из стека
  const filteredStack = stack.filter(
    s => !blocked.some(b => b.code === s.code)
  );

  return {
    stack: filteredStack,
    blocked,
    warnings
  };
}
