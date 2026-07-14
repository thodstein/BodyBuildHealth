/**
 * muscle-group.ts — единый источник классификации упражнений по МЫШЕЧНОЙ ГРУППЕ.
 *
 * Вынесено, чтобы устранить расхождение между тремя дублирующимися
 * эвристиками (types.ts detectGroup, macrocycle-sources.ts detectGroup).
 * Здесь — ОДНА fine-grained логика; coarse-потребители используют coarsen().
 *
 * Важно: сохраняем fine-grained гранулярность (quads/biceps/triceps/...),
 * т.к. TrainingConstructor завязан на per-muscle workMax / MRV.
 * sessionMetrics.ts (LMS lift-codes: ЖМ/ПР/ТГ/СР) — отдельный домен, НЕ объединяется.
 */

/** Точный fine-grained детектор группы по названию упражнения. */
export function detectMuscleGroup(name: string): string {
  const n = (name || '').toLowerCase();

  if (isCarryName(n)) return 'full';
  if (/(подъём|подъем).*(ног|бедр)|leg\s*raise|купание/i.test(n)) return 'core';

  // ── Плечи ДО груди: вертикальный/надголовый жим (сидя, OHP, армейский) ──
  // НЕ ловим голый «жим» (== жим лёжа/горизонтальный → грудь).
  if (/ohp|shoulder|плеч|армейск|военн|жим.*сид|дельт|delt|overhead|из-?за голов|мах.*сторон|разводк.*сторон|мах.*в сторон/i.test(n)) return 'shoulders';

  // ── Руки: трицепс (изоляция-жимы ДО широкого «жим» груди) ──
  if (/tricep|трицеп|разгибани.*рук|француз|kick\s*back|жим.*узк|скулл|skull/i.test(n)) return 'triceps';

  // ── Грудь (горизонтальный жим + изоляция) ──
  if (/bench|жим|chest|груд|pec|отжим|dip|дип|fly|разводк|пек-?дек|сведен|кроссовер|пулловер/i.test(n)) return 'chest';

  // ── Спина ──
  if (/deadlift|станов|тяга|row|pull|спин|back|chin|lat|наклон|подтяг|гиперэкст|hyperext|шраг|trap|трап/i.test(n)) return 'back';

  // ── Ноги: квадрицепс ──
  if (/squat|присед|leg press|жим.*ног|выпад|lunge|квад|разгибани|выпрям.*ног|quad/i.test(n)) return 'quads';

  // ── Ноги: бицепс бедра ──
  if (/hamstring|сгиб.*ног|бицепс.*бедр|рум.*dead|glute|ягод|hip.*thrust|таз/i.test(n)) return 'hamstrings';

  // ── Ноги: икры ──
  if (/calf|икр|носоч|подъём.*нос|подъем.*нос/i.test(n)) return 'calves';

  // ── Руки: бицепс ──
  if (/curl|бицеп|bicep|молот/i.test(n)) return 'biceps';

  // ── Предплечье ──
  if (/forearm|предплеч|запясть|кистев/i.test(n)) return 'forearms';

  // ── Кор / пресс ──
  if (/пресс|ab|core|скручив|crunch|sit.*up|планк|side.*bend|corp/i.test(n)) return 'abs';

  return 'full';
}

/** Переносит fine-grained группу в coarse-каталожную (chest/back/legs/shoulders/arms/core). */
export function coarsen(group: string): string {
  switch (group) {
    case 'quads':
    case 'hamstrings':
    case 'glutes':
    case 'calves':
      return 'legs';
    case 'biceps':
    case 'triceps':
    case 'forearms':
      return 'arms';
    case 'traps':
      return 'back';
    case 'abs':
      return 'core';
    case 'chest':
    case 'back':
    case 'legs':
    case 'shoulders':
    case 'core':
    case 'full':
      return group;
    default:
      return 'full';
  }
}

function isCarryName(n: string): boolean {
  return /прогулк|carry|фермер|farmers|walk.*нос|носил/i.test(n);
}
