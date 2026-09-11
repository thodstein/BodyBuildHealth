/**
 * strength-sport-ta-jerk-safety.engine.ts — DIP-ACL ГАРД ТОЛЧКА (V4 PRO-v4)
 *
 * Ye et al. 2024 Heliyon (кейс ACL в dip): внутр. ротация колена 46.9° +
 * передний сдвиг tibia +0.76 м/с; квадрицепс/икроножная переактивны,
 * hamstring/soleus недостаточны. Скрининг, не диагноз.
 * Чистый движок, без UI/storage.
 */

export interface JerkAclInput {
  kneeValgus?: boolean | null;
  kneeRotation?: boolean | null; // внутр. ротация / «колено уходит внутрь»
  hamDeficit?: boolean | null; // strength_deficit из IMTP или слабые хамсы
  deepDip?: boolean | null; // глубокий dip (>15 см или «проваливается»)
}

export interface JerkAclResult {
  level: 'ok' | 'warn' | 'stop';
  flags: string[];
  text: string;
}

export function jerkAclFlags(input: JerkAclInput): JerkAclResult | null {
  const v = !!input.kneeValgus;
  const r = !!input.kneeRotation;
  const h = !!input.hamDeficit;
  const d = !!input.deepDip;
  const n = [v, r, h, d].filter(Boolean).length;
  if (n === 0) return null;
  const flags: string[] = [];
  if (v) flags.push('вальгус колена в dip');
  if (r) flags.push('внутр. ротация колена');
  if (h) flags.push('hamstring-дефицит (сила сзади бедра)');
  if (d) flags.push('глубокий/проваленный dip');
  if (n >= 2 || (v && r)) {
    return { level: 'stop', flags, text: `⛔ Dip-риск ACL: ${flags.join(' + ')} — снизить вес, проверить технику ножниц/dip у тренера (Ye 2024, скрининг, не диагноз)` };
  }
  return { level: 'warn', flags, text: `⚠ Dip-флаг: ${flags.join(' + ')} — наблюдение, укрепить хамсы/ягодицы, не форсировать вес` };
}
