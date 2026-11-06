/**
 * space-invite.ts — «подключить телефон атлета по коду тренера».
 *
 * Отдельный маленький модуль (без `cloud-kv`): экран профиля не должен тянуть
 * сеть только для того, чтобы показать/принять код. Здесь только:
 *  1) принять код → добавить пространство в реестр и токен, сделать его активным;
 *  2) отключиться → убрать пространство и токен С ЭТОГО устройства.
 *
 * Отключение НЕ удаляет данные у тренера: это «выйти», а не «стереть чужое».
 * Удаление данных атлета — отдельное действие тренера, оно уносит и облачную
 * копию (см. `space-purge` + `cloud-kv.purgeSpacesFromCloud`).
 */
import {
  HOME_SPACE_ID,
  clearSessionSpaceData,
  clearSpaceData,
  deviceRawOrFallback,
  readRegistryFromStorage,
  removeSpace,
  upsertSpace,
  writeRegistryToStorage,
} from './data-space';
import {
  decodeSpaceInvite,
  ensureSpaceToken,
  inviteErrorText,
  listLiveSpaceTokens,
  removeSpaceToken,
  spaceTokenRecord,
  type InviteError,
} from './space-tokens';

export type JoinSpaceResult =
  | { ok: true; spaceId: string; label: string; joinedAt: string }
  | { ok: false; error: InviteError | 'storage' };

export interface JoinSpaceOptions {
  /** ISO-время подключения (тесты и повторяемость). */
  now?: string;
}

/**
 * Принять код приглашения.
 *
 * `migratedAt` ставится сразу: данные этого пространства уже лежат под токеном
 * из кода (тренер перенёс их до выдачи), поэтому телефон атлета обязан тянуть
 * именно этот токен, а не «свой».
 */
export function joinSpaceByInvite(code: string, opts: JoinSpaceOptions = {}): JoinSpaceResult {
  const parsed = decodeSpaceInvite(code);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { spaceId, token, label } = parsed.invite;
  if (spaceId === HOME_SPACE_ID) return { ok: false, error: 'space' };

  const reg = readRegistryFromStorage();
  const up = upsertSpace(reg, {
    id: spaceId,
    athleteId: null,
    label: label || 'Данные тренера',
  });
  if (up.error) return { ok: false, error: 'space' };

  const now = opts.now ?? new Date().toISOString();
  const ensured = ensureSpaceToken(spaceId, {
    token,
    role: 'athlete',
    label,
    migratedAt: now,
  });
  if (!ensured.record) return { ok: false, error: 'storage' };

  try {
    writeRegistryToStorage(up.registry);
  } catch {
    return { ok: false, error: 'storage' };
  }
  // Активность ставит вызывающий через `activateSpaceById` (он же бьёт точку
  // возврата и проверяет, что пространство известно). Но если пространство уже
  // было известно, включаем сразу — экран просто перезагрузится.
  return { ok: true, spaceId, label: ensured.record.label || label || 'Данные тренера', joinedAt: now };
}

export function joinErrorText(error: InviteError | 'storage'): string {
  if (error === 'storage') return 'Не удалось сохранить подключение: на устройстве нет места.';
  return inviteErrorText(error);
}

/** Подключён ли этот телефон к тренеру по этому пространству. */
export function isJoinedSpace(spaceId: string): boolean {
  const rec = spaceTokenRecord(spaceId);
  return !!rec && rec.role === 'athlete' && !rec.revokedAt;
}

/** Пространства, подключённые по коду тренера (роль `athlete`). */
export function joinedSpaceIds(): string[] {
  return listLiveSpaceTokens()
    .filter(r => r.role === 'athlete')
    .map(r => r.spaceId);
}

/**
 * Отключиться от тренера на ЭТОМ устройстве: убрать пространство, его ключи,
 * черновики и токен. Данные в облаке у тренера остаются его.
 *
 * Возвращает `true`, если это пространство было активным (нужна перезагрузка).
 */
export function leaveJoinedSpace(spaceId: string): boolean {
  if (!spaceId || spaceId === HOME_SPACE_ID) return false;
  const wasActive = readRegistryFromStorage().active === spaceId;
  try {
    if (typeof localStorage !== 'undefined') clearSpaceData(deviceRawOrFallback(localStorage), spaceId);
  } catch {
    /* ключи уже недоступны — реестр всё равно чистим */
  }
  clearSessionSpaceData(spaceId);
  removeSpaceToken(spaceId);
  writeRegistryToStorage(removeSpace(readRegistryFromStorage(), spaceId));
  return wasActive;
}
