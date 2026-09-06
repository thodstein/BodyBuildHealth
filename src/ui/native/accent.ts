/**
 * accent.ts — единый мост «hex + alpha-суффикс → валидный CSS при var()-акценте».
 * Проблема: `${color}44` работает для hex, но `var(--x)44` — невалидный CSS.
 * Решение одно на всех: совпал с var() акцента → rgba() через rgb-триплет,
 * иначе — та же строка что раньше (TG/web 1-в-1, байт-в-байт).
 */

/** Ядро: c — проверяемый цвет, accentVar/rgbVar — пара моста блока. */
export const alphaWith = (
  accentVar: string,
  rgbVar: string,
  c: string,
  hexAlpha: string,
): string => {
  if (c !== accentVar) return `${c}${hexAlpha}`;
  const a = Math.round((parseInt(hexAlpha, 16) / 255) * 1000) / 1000;
  return `rgba(${rgbVar}, ${a})`;
};

/** Фабрика хелпера под конкретный мост блока (возвращает (c, hexAlpha) => string). */
export const makeAlpha = (
  accentVar: string,
  rgbVar: string,
): ((c: string, hexAlpha: string) => string) => {
  return (c: string, hexAlpha: string): string => alphaWith(accentVar, rgbVar, c, hexAlpha);
};

/** Фабрика заливки «только альфа» для фиксированного акцента блока ((alpha01) => string). */
export const makeFill = (
  rgbVar: string,
): ((alpha: number) => string) => {
  return (alpha: number): string => `rgba(${rgbVar}, ${alpha})`;
};
