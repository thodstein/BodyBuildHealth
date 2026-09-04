/**
 * strength-sport-ta-anthro.engine.ts — АНТРОПОМЕТРИЯ ТА (E9 PRO-v2)
 *
 * Размах рук vs рост → ширина рывкового хвата + риск промаха назад;
 * ширина плеч → ориентиры narrow/wide хвата.
 * Источники: Everett/Catalyst (wide grip + backward momentum = miss behind),
 * мастер LiftMasterCard (anthroHint-паттерн, адаптирован под хват рывка).
 *
 * Чистый движок, без UI/storage.
 */

export interface TAAnthroInput {
  heightCm?: number | null;
  armSpanCm?: number | null;
  shoulderCm?: number | null;
}

export interface TAAnthroResult {
  diffCm: number; // размах − рост
  type: 'long' | 'short' | 'average';
  gripAdvice: string;
  startAdvice: string;
  notes: string[];
}

export function diagnoseTAAnthro(input: TAAnthroInput): TAAnthroResult | null {
  const h = input.heightCm, s = input.armSpanCm;
  if (h == null || s == null || !Number.isFinite(h) || !Number.isFinite(s) || h <= 0 || s <= 0) return null;
  const diffCm = Math.round(s - h);
  const type: TAAnthroResult['type'] = diffCm > 5 ? 'long' : diffCm < -5 ? 'short' : 'average';
  const notes: string[] = [];
  let gripAdvice: string;
  if (type === 'long') {
    gripAdvice = `Длинные руки (+${diffCm}см): рывковый хват уже (1.0× биакромиальный), локти 30–45° tucked. Широкий хват + momentum назад = промах за голову (Everett).`;
  } else if (type === 'short') {
    gripAdvice = `Короткие руки (${diffCm}см): хват шире (до 81см), turnover быстрее — промаха назад меньше, можно шире.`;
  } else {
    gripAdvice = 'Пропорции средние: стандартный хват по меткам грифа, локти 45°.';
  }
  let startAdvice = 'Старт: плечи над грифом, спина удержана — баланс с первой фазы (чистота отрыва важнее хвата).';
  if (input.shoulderCm != null && Number.isFinite(input.shoulderCm) && input.shoulderCm > 0) {
    const sh = Math.round(input.shoulderCm);
    startAdvice += ` Ориентир: narrow ≈ ${sh}см (1.0×), wide ≈ ${Math.round(sh * 1.5)}см (1.5×).`;
  } else {
    notes.push('Ширина плеч не задана — narrow/wide в см не посчитаны.');
  }
  notes.push('Длину бедра не учитываем — высоту старта подбирай по ощущениям баланса.');
  return { diffCm, type, gripAdvice, startAdvice, notes };
}
