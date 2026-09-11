/**
 * link-code.ts — одноразовые 6-значные коды привязки АПК к Telegram-аккаунту.
 *
 * Формат кода: 'XXX-XXX' (цифры, дефис только для читаемости).
 * TTL кода: 10 минут. Одноразовый: после потребления удаляется/помечается used.
 * Никаких логинов/паролей — код = proof владения ТГ-аккаунтом.
 */

export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
export const LINK_CODE_DIGITS = 6;

/** Нормализовать ввод пользователя: оставить только цифры, вставить дефис после 3-й. */
export function normalizeLinkCode(input: string): string {
  const digits = (input || '').replace(/\D/g, '').slice(0, LINK_CODE_DIGITS);
  if (digits.length <= 3) return digits;
  return digits.slice(0, 3) + '-' + digits.slice(3);
}

/** Формат валиден: ровно 6 цифр (дефис опционален). */
export function isValidLinkCodeFormat(input: string): boolean {
  const digits = (input || '').replace(/\D/g, '');
  return digits.length === LINK_CODE_DIGITS;
}

/** Сгенерировать код через CSPRNG (fallback — Math.random, только для тестов/SSR). */
export function generateLinkCode(): string {
  const digits: number[] = [];
  try {
    const buf = new Uint32Array(LINK_CODE_DIGITS);
    crypto.getRandomValues(buf);
    for (let i = 0; i < LINK_CODE_DIGITS; i++) digits.push(buf[i] % 10);
  } catch {
    for (let i = 0; i < LINK_CODE_DIGITS; i++) digits.push(Math.floor(Math.random() * 10));
  }
  const raw = digits.join('');
  return raw.slice(0, 3) + '-' + raw.slice(3);
}

/** Просрочен ли код (по expires_at ISO). */
export function isLinkCodeExpired(expiresAtIso: string, nowMs = Date.now()): boolean {
  const exp = Date.parse(expiresAtIso);
  if (!Number.isFinite(exp)) return true;
  return exp <= nowMs;
}
