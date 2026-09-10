/**
 * bb-red-flags.engine.ts — P3 PRO-2: красные флаги (скрининг, не диагноз).
 * При активных флагах вставка объёма блокируется честным текстом;
 * разрешены только техника/разгрузка. Гейт проверяется хабом перед вставкой.
 */

export interface BbRedFlags {
  acutePain: boolean; // острая боль в суставе/мышце
  swelling: boolean; // отёк
  numbness: boolean; // онемение/покалывание
  jointClickPain: boolean; // щелчки С болью
}

export const BB_RED_FLAGS_EMPTY: BbRedFlags = {
  acutePain: false,
  swelling: false,
  numbness: false,
  jointClickPain: false,
};

export interface BbRedFlagResult {
  active: boolean;
  blocked: boolean; // вставка объёма запрещена
  items: string[];
  text: string;
}

const LABELS: Record<keyof BbRedFlags, string> = {
  acutePain: 'острая боль',
  swelling: 'отёк',
  numbness: 'онемение/покалывание',
  jointClickPain: 'щелчки с болью',
};

export function assessBbRedFlags(flags: BbRedFlags): BbRedFlagResult {
  const items = (Object.keys(LABELS) as Array<keyof BbRedFlags>)
    .filter((k) => (flags as any)?.[k] === true)
    .map((k) => LABELS[k]);
  if (!items.length) {
    return { active: false, blocked: false, items, text: 'Красных флагов нет — вставка разрешена' };
  }
  const hard = !!(flags.acutePain || flags.swelling || flags.numbness);
  return {
    active: true,
    blocked: hard,
    items,
    text: hard
      ? `Стоп: ${items.join(', ')} — сначала врач, вставка объёма заблокирована`
      : `Осторожно: ${items.join(', ')} — только техника без нагрузки, объём не вставляем`,
  };
}
