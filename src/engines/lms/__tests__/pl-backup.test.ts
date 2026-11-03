/**
 * pl-backup.test.ts — Фаза 6, п.8: бэкап/восстановление только PL-данных.
 *
 * Контракт безопасности: чужие/неизвестные ключи не восстанавливаются,
 * битый JSON и чужая версия дают ошибку, а не частичную запись.
 */
import { describe, expect, it } from 'vitest';
import {
  collectPLBackup,
  parsePLBackup,
  restorePLBackup,
  PL_BACKUP_VERSION,
  PL_BACKUP_VALUE_MAX_CHARS,
} from '../pl-backup.engine';

const mkStorage = (init: Record<string, string> = {}) => {
  const map = new Map(Object.entries(init));
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
};

describe('PL-бэкап сессии', () => {
  it('собирает только существующие ключи белого списка', () => {
    const s = mkStorage({ he_pl_session: '{"a":1}', he_pl_meet_log: '{"1:Присед":[]}', 'чужой': 'x' });
    const b = collectPLBackup(s, () => '2026-11-03T10:00:00.000Z');
    expect(b).not.toBeNull();
    expect(b!.version).toBe(PL_BACKUP_VERSION);
    expect(b!.createdAt).toBe('2026-11-03T10:00:00.000Z');
    expect(Object.keys(b!.keys).sort()).toEqual(['he_pl_meet_log', 'he_pl_session']);
  });

  it('нет PL-данных → null (пустой файл не создаём)', () => {
    expect(collectPLBackup(mkStorage())).toBeNull();
  });

  it('слишком большое значение не попадает в бэкап (защита квоты)', () => {
    const s = mkStorage({ he_pl_session: 'x'.repeat(PL_BACKUP_VALUE_MAX_CHARS + 1), he_pl_macro: '{"m":1}' });
    const b = collectPLBackup(s);
    expect(Object.keys(b!.keys)).toEqual(['he_pl_macro']);
  });

  it('round-trip: собрали → разобрали → восстановили', () => {
    const src = mkStorage({ he_pl_session: '{"plan":1}', he_pl_meet_log: '{"1:Присед":[]}' });
    const backup = collectPLBackup(src)!;
    const parsed = parsePLBackup(JSON.stringify(backup));
    expect(parsed.error).toBeNull();
    const dst = mkStorage();
    const res = restorePLBackup(parsed.backup!, dst);
    expect(res.error).toBeNull();
    expect(res.restored.sort()).toEqual(['he_pl_meet_log', 'he_pl_session']);
    expect(dst.getItem('he_pl_session')).toBe('{"plan":1}');
  });

  it('битый JSON → ошибка, ничего не пишем', () => {
    const r = parsePLBackup('{не json');
    expect(r.backup).toBeNull();
    expect(r.error).toMatch(/не JSON/i);
  });

  it('чужой файл → ошибка', () => {
    const r = parsePLBackup(JSON.stringify({ app: 'other', kind: 'x', version: 1, keys: {} }));
    expect(r.backup).toBeNull();
    expect(r.error).toMatch(/не бэкап PL/);
  });

  it('неподдерживаемая версия → ошибка', () => {
    const r = parsePLBackup(JSON.stringify({ app: 'bodybuildhealth', kind: 'pl-backup', version: 99, keys: { he_pl_session: '{}' } }));
    expect(r.backup).toBeNull();
    expect(r.error).toMatch(/Версия/);
  });

  it('неизвестные ключи в файле игнорируются, а не пишутся в приложение', () => {
    const r = parsePLBackup(JSON.stringify({
      app: 'bodybuildhealth', kind: 'pl-backup', version: PL_BACKUP_VERSION, createdAt: 'x',
      keys: { he_pl_session: '{"a":1}', auth_token: 'hack' },
    }));
    expect(r.error).toBeNull();
    expect(Object.keys(r.backup!.keys)).toEqual(['he_pl_session']);
    const dst = mkStorage();
    const res = restorePLBackup(r.backup!, dst);
    expect(res.restored).toEqual(['he_pl_session']);
    expect(dst.getItem('auth_token')).toBeNull();
  });

  it('переполнение хранилища → ошибка и список пропущенного', () => {
    const backup = {
      app: 'bodybuildhealth' as const, kind: 'pl-backup' as const, version: PL_BACKUP_VERSION, createdAt: '',
      keys: { he_pl_session: '{}', he_pl_macro: '{}' },
    };
    const dst = {
      setItem: (k: string) => { if (k === 'he_pl_macro') throw new Error('quota'); },
    };
    const res = restorePLBackup(backup, dst);
    expect(res.restored).toEqual(['he_pl_session']);
    expect(res.skipped).toEqual(['he_pl_macro']);
    expect(res.error).toMatch(/места/);
  });
});
