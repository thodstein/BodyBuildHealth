import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateLinkCode,
  normalizeLinkCode,
  isValidLinkCodeFormat,
  isLinkCodeExpired,
  LINK_CODE_TTL_MS,
} from '../../core/link-code';
import {
  LINKED_TG_TOKEN_KEY,
  isKvExcludedKey,
  getLinkedTgToken,
  saveLinkedTgToken,
  clearLinkedTgToken,
  initKvSync,
  getKvSyncState,
  _resetKvForTests,
  type KvTransport,
} from '../../core/cloud-kv';

class FakeTransport implements KvTransport {
  async pull(_token: string, onRows: (rows: any[]) => void, onServerNow?: (ms: number) => void): Promise<void> {
    if (onServerNow) onServerNow(Date.now());
    onRows([]);
  }
  async replaceKey(): Promise<void> {}
  async removeKey(): Promise<void> {}
  keepAlivePush(): void {}
}

beforeEach(() => {
  _resetKvForTests();
  localStorage.clear();
});

describe('link-code формат', () => {
  it('генерация: XXX-XXX из 6 цифр', () => {
    const c = generateLinkCode();
    expect(c).toMatch(/^\d{3}-\d{3}$/);
    expect(isValidLinkCodeFormat(c)).toBe(true);
  });

  it('нормализация: мусор режется, дефис ставится', () => {
    expect(normalizeLinkCode('482913')).toBe('482-913');
    expect(normalizeLinkCode('482-913')).toBe('482-913');
    expect(normalizeLinkCode('ab4x8 2-9!13')).toBe('482-913');
    expect(normalizeLinkCode('48')).toBe('48');
  });

  it('валидация: ровно 6 цифр', () => {
    expect(isValidLinkCodeFormat('482-913')).toBe(true);
    expect(isValidLinkCodeFormat('48291')).toBe(false);
    expect(isValidLinkCodeFormat('')).toBe(false);
    expect(isValidLinkCodeFormat('482-9139')).toBe(false);
  });

  it('TTL 10 минут', () => {
    expect(LINK_CODE_TTL_MS).toBe(10 * 60 * 1000);
  });

  it('expiry: прошлое — истёк, будущее — жив', () => {
    expect(isLinkCodeExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isLinkCodeExpired(new Date(Date.now() + 60_000).toISOString())).toBe(false);
    expect(isLinkCodeExpired('мусор')).toBe(true);
  });
});

describe('привязка АПК кодом', () => {
  it('токен привязки не синкается (EXCLUDED)', () => {
    expect(isKvExcludedKey(LINKED_TG_TOKEN_KEY)).toBe(true);
  });

  it('save/get/clear roundtrip', () => {
    expect(getLinkedTgToken()).toBe(null);
    saveLinkedTgToken('tk_abc');
    expect(getLinkedTgToken()).toBe('tk_abc');
    saveLinkedTgToken('мусор');
    expect(getLinkedTgToken()).toBe('tk_abc');
    clearLinkedTgToken();
    expect(getLinkedTgToken()).toBe(null);
  });

  it('dev_* с явным токеном — синк включается (не off)', async () => {
    const t = new FakeTransport();
    const s = await initKvSync('dev_xxx', { transport: t, token: 'tk_test' });
    expect(s.status).not.toBe('off');
    expect(getKvSyncState().status).not.toBe('off');
  });

  it('dev_* без токена и без транспорта — off', async () => {
    const s = await initKvSync('dev_xxx', { token: '' } as any);
    expect(s.status).toBe('off');
  });
});
