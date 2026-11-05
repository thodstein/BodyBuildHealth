/**
 * data-space-key-guard.test.ts — страж изоляции: ни один ключ данных атлета
 * не должен незаметно стать «устройственным».
 *
 * ПОЧЕМУ ТЕСТ, А НЕ РЕВЬЮ. Изоляция держится на списке `DEVICE_LEVEL_KEYS` в
 * `core/data-space.ts`: всё, что в нём оказалось, перестаёт переключаться вместе
 * с атлетом. Добавить туда ключ дневника/плана/анализов — значит показать данные
 * одного человека другому. Такую ошибку не видно в UI: приложение просто «работает».
 *
 * Страж ловит именно опасное направление:
 *  • если в исходниках есть литеральный ключ, который считается устройственным,
 *    но не входит в известный список и не подпадает под устройственные префиксы —
 *    тест падает и требует осознанного решения;
 *  • если ключ из чувствительных доменов (профиль, дневники, планы, анализы,
 *    питание, фото) вдруг стал устройственным — тест падает отдельной проверкой.
 *
 * Обратное направление (новый ключ по умолчанию попадает в пространство) безопасно
 * и не требует списка.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isDeviceLevelKey } from '../data-space';

const ROOT = join(process.cwd(), 'src');

/** Устройственные литералы, которые НЕ подпадают под префиксы — только осознанно. */
const KNOWN_DEVICE_LITERALS = new Set<string>([
  'health-engine-v2-salt',
  'he_theme',
  'he_app_theme',
  'he_apk_theme_v1',
  'he_apk_accent_v1',
  'he_apk_system_hex_v1',
  'he_app_update_v1',
  'he_timer_sound_settings',
  'he_notification_log',
  'he_crypto_key',
  'he_session_v2',
  'he_webauthn_cred_v1',
  'he_manual_onboarding_done',
  'he_lift_master_onboard_v1',
  'he_biometry_enabled',
  'he_biometry_lock',
]);

/**
 * Ключи, которые обязаны ЖИТЬ В ПРОСТРАНСТВЕ. Если один из них появится в
 * `DEVICE_LEVEL_KEYS`, данные атлетов начнут смешиваться — это блокирующая ошибка.
 * Список — примеры по каждому домену, а не полный перечень.
 */
const MUST_BE_SPACE_KEYS = [
  'he_profile_v2',
  'he_diary_v2',
  'he_weight_diary',
  'he_training_log',
  'he_pl_macro',
  'he_bb_macro',
  'he_macrocycle_designs',
  'he_nutrition_plan',
  'he_labs_log',
  'he_risk_log',
  'he_checkin_latest',
  'he_habits',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

function literalKeysIn(text: string): string[] {
  const keys: string[] = [];
  const re = /(['"])(he_[a-z0-9_]+|health-engine-v2-salt)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) keys.push(m[2]);
  return keys;
}

describe('страж изоляции ключей', () => {
  const files = walk(ROOT);

  it('исходники найдены (иначе страж бессмысленно зелёный)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('нет новых устройственных литералов без осознанного решения', () => {
    const unexpected = new Map<string, string[]>();
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const key of literalKeysIn(text)) {
        if (!isDeviceLevelKey(key)) continue;
        // Префиксные семейства (he_coach_*, he_sync_*, he_data_space_*) — это
        // устройственные данные по замыслу, список вести не нужно.
        if (key.startsWith('he_coach_') || key.startsWith('he_sync_') || key.startsWith('he_data_space_')) continue;
        if (KNOWN_DEVICE_LITERALS.has(key)) continue;
        const list = unexpected.get(key) ?? [];
        list.push(relative(ROOT, file));
        unexpected.set(key, list);
      }
    }
    expect([...unexpected.entries()]).toEqual([]);
  });

  it('ключи данных атлета никогда не устройственные', () => {
    const leaked = MUST_BE_SPACE_KEYS.filter(k => isDeviceLevelKey(k));
    expect(leaked).toEqual([]);
  });
});
