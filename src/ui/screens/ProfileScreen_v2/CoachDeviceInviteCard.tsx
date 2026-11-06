/**
 * CoachDeviceInviteCard — «телефон атлета»: код доступа и подключение.
 *
 * Две роли на одном экране:
 *  • тренер создаёт код для пространства атлета и отзывает старый;
 *  • атлет (или второе устройство) вставляет код и получает ТОЛЬКО это
 *    пространство.
 *
 * Почему это отдельный экран, а не кнопка в карточке: тут есть необратимые
 * действия (смена кода выкидывает уже подключённый телефон), и человек должен
 * видеть границы, а не нажимать «поделиться» в списке атлетов.
 *
 * Честные границы:
 *  • код — это ключ доступа, а не «приглашение посмотреть»: кто его знает, тот
 *    видит данные пространства;
 *  • фото веса в облако не уходят (ограничение синхронизации);
 *  • телефон получает изменения при открытии приложения/возврате в него;
 *  • PIN защищает этот телефон, но не заменяет код.
 */
import React, { useMemo, useState } from 'react';
import { colors } from './ui';
import type { DataSpaceRecord } from '../../../core/data-space';
import { HOME_SPACE_ID, activateSpaceById, readRegistryFromStorage, reloadToApplySpace } from '../../../core/data-space';
import {
  encodeSpaceInvite,
  ensureSpaceToken,
  listLiveSpaceTokens,
  spaceTokenRecord,
} from '../../../core/space-tokens';
import {
  joinErrorText,
  joinSpaceByInvite,
  joinedSpaceIds,
  leaveJoinedSpace,
} from '../../../core/space-invite';
import type { CoachAuditKind } from '../../../engines/coach/coach-audit.engine';

const ACCENT = '#22d3ee';

/**
 * Настроено ли облако в этой сборке. Считаем по env, а не импортом `cloud-kv`:
 * вкладка профиля не должна тянуть движок синхронизации в статический граф.
 * Реальный статус (запущен ли синк) проверяется в момент действия.
 */
const CLOUD_CONFIGURED = !!(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Props {
  /** Пространства-атлеты из реестра (home не передаётся). */
  spaces: DataSpaceRecord[];
  onAudit: (kind: CoachAuditKind, athleteId?: string | null) => void;
  /** Перечитать реестр после подключения/отключения. */
  onChanged?: () => void;
  /**
   * Включён ли режим тренера на этом телефоне.
   *
   * `false` — режим выключен, но телефон всё ещё подключён к данным тренера.
   * Тогда карточка не предлагает выдавать коды (их выдаёт тренер), а показывает
   * только подключение/отключение: иначе у атлета, выключившего режим, не
   * осталось бы способа выйти из чужих данных, кроме сброса приложения.
   */
  coachEnabled?: boolean;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 13,
  color: '#fff',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  outline: 'none',
  boxSizing: 'border-box',
};

const btn = (tone: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
  minHeight: 40,
  padding: '8px 12px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  border:
    tone === 'primary'
      ? '1px solid transparent'
      : `1px solid ${tone === 'danger' ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.14)'}`,
  color: tone === 'primary' ? '#04222a' : tone === 'danger' ? '#fca5a5' : 'rgba(255,255,255,0.82)',
  background:
    tone === 'primary'
      ? `linear-gradient(135deg, ${ACCENT}, #0ea5e9)`
      : tone === 'danger'
        ? 'rgba(239,68,68,0.14)'
        : 'rgba(255,255,255,0.05)',
});

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  padding: 14,
};

const codeStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 64,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 10.5,
  lineHeight: 1.5,
  letterSpacing: 0,
  resize: 'vertical',
  color: 'rgba(255,255,255,0.9)',
};

const sectionTitle: React.CSSProperties = { fontSize: 13.5, fontWeight: 800, color: '#fff' };
const hint: React.CSSProperties = { fontSize: 11, color: colors.textSubtle, lineHeight: 1.5 };

export function CoachDeviceInviteCard({ spaces, onAudit, onChanged, coachEnabled = true }: Props) {
  const [selected, setSelected] = useState<string>('');
  const [rev, setRev] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);

  const athleteSpaces = useMemo(() => {
    void rev;
    return spaces.filter(s => {
      if (s.id === HOME_SPACE_ID) return false;
      const rec = spaceTokenRecord(s.id);
      // Пространство, к которому ЭТОТ телефон подключился по чужому коду, — не
      // «наш атлет»: выдавать на него код (и тем более менять его) нельзя, это
      // доступ к данным тренера, а не к своим. Такие пространства — в блоке ниже.
      return !rec || rec.role === 'coach';
    });
  }, [spaces, rev]);

  const spaceId = selected || athleteSpaces[0]?.id || '';
  const space = athleteSpaces.find(s => s.id === spaceId) ?? null;
  const tokens = useMemo(() => {
    // `rev` — чтобы перечитать после create/rotate/revoke.
    void rev;
    return listLiveSpaceTokens();
  }, [rev]);
  const joined = useMemo(() => {
    void rev;
    // Читаем реестр, а не prop: после подключения родитель может ещё не успеть
    // перерисоваться, а карточка обязана сразу показать «вы подключены».
    const ids = new Set(joinedSpaceIds());
    return readRegistryFromStorage().spaces.filter(s => ids.has(s.id) && s.id !== HOME_SPACE_ID);
  }, [rev]);
  const rawRecord = athleteSpaces.length ? spaceTokenRecord(spaceId) : null;
  // Отозванный токен — то же, что отсутствие: код по нему больше не работает.
  const record = rawRecord && !rawRecord.revokedAt ? rawRecord : null;
  const code = record ? encodeSpaceInvite(record) : '';
  const migrated = !!record?.migratedAt;
  const hasTokenCount = tokens.length;

  const bump = () => setRev(v => v + 1);
  const clearMessages = () => {
    setError(null);
    setNotice(null);
    setConfirmRotate(false);
    setConfirmRevoke(false);
  };

  const copy = async (text: string) => {
    try {
      const mod = await import('../../../core/apk-share');
      const res = await mod.copyOrShareText(text, 'Код доступа к данным');
      setNotice(res === 'failed' ? 'Не удалось скопировать — выделите код в поле и скопируйте вручную.' : null);
    } catch {
      setNotice('Не удалось скопировать — выделите код в поле и скопируйте вручную.');
    }
  };

  /** Создать код (и перенести уже накопленные данные под токен пространства). */
  const createCode = async () => {
    if (!space || busy) return;
    clearMessages();
    if (spaceTokenRecord(space.id)?.role === 'athlete') {
      setError('Это пространство принадлежит тренеру: код на него выдаёт он, а не вы.');
      return;
    }
    if (!CLOUD_CONFIGURED) {
      setError('Облако не настроено — телефон атлета не получит данные. Код имеет смысл только с синхронизацией.');
      return;
    }
    setBusy(true);
    try {
      const kv = await import('../../../core/cloud-kv');
      if (!kv.isKvCloudConfigured() || kv.getKvSyncState().status === 'off') {
        setError('Синхронизация не запущена на этом устройстве — код не сработает. Войдите в аккаунт и повторите.');
        return;
      }
      const ensured = ensureSpaceToken(space.id, {
        label: space.label,
        role: 'coach',
      });
      if (!ensured.record) {
        setError('Не удалось создать код для этого пространства.');
        return;
      }
      const ok = await kv.migrateSpaceToToken(space.id);
      if (!ok) {
        setError(
          'Не удалось перенести данные пространства в облако. Проверьте связь и попробуйте ещё раз — код пока не выдавайте.',
        );
        bump();
        return;
      }
      onAudit('invite-created', space.athleteId);
      setNotice('Код создан. Данные этого пространства перенесены в облако — телефон атлета получит их целиком.');
      bump();
    } finally {
      setBusy(false);
    }
  };

  const rotate = async () => {
    if (!space || busy) return;
    if (spaceTokenRecord(space.id)?.role === 'athlete') {
      setError('Сменить код может только тренер: это его пространство.');
      return;
    }
    if (!confirmRotate) {
      setConfirmRotate(true);
      setConfirmRevoke(false);
      return;
    }
    clearMessages();
    setBusy(true);
    try {
      const kv = await import('../../../core/cloud-kv');
      const next = await kv.rotateSpaceToken(space.id);
      if (!next) {
        setError('Не удалось сменить код — старый продолжает работать. Проверьте связь.');
        return;
      }
      onAudit('invite-rotated', space.athleteId);
      setNotice('Код сменён. Телефон, который был подключён по старому коду, при следующем открытии очистит эти данные.');
      bump();
    } finally {
      setBusy(false);
    }
  };

  /**
   * Отключить телефон атлета: убрать облачные строки пространства и оставить
   * маркер отзыва. Данные на этом устройстве и в карточке атлета остаются.
   */
  const revokePhone = async () => {
    if (!space || busy) return;
    if (spaceTokenRecord(space.id)?.role === 'athlete') {
      setError('Отключить доступ может только тренер. Чтобы уйти от него — «Отключиться» ниже.');
      return;
    }
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      setConfirmRotate(false);
      return;
    }
    clearMessages();
    setBusy(true);
    try {
      const kv = await import('../../../core/cloud-kv');
      const n = await kv.purgeSpacesFromCloud([space.id]);
      if (!n) {
        setError('Не удалось отключить телефон: синхронизация сейчас недоступна.');
        return;
      }
      onAudit('invite-revoked', space.athleteId);
      setNotice('Телефон отключён. Его данные этого пространства удалены и на телефоне при следующем открытии. У вас данные остаются.');
      bump();
    } finally {
      setBusy(false);
    }
  };

  const join = () => {
    clearMessages();
    setJoinError(null);
    setJoinBusy(true);
    try {
      const res = joinSpaceByInvite(joinCode);
      if (!res.ok) {
        setJoinError(joinErrorText(res.error));
        return;
      }
      onAudit('space-joined');
      const switched = activateSpaceById(res.spaceId);
      if (switched.error) {
        setJoinError('Код принят, но пространство не найдено. Попробуйте ещё раз.');
        return;
      }
      setJoinCode('');
      bump();
      reloadToApplySpace();
    } finally {
      setJoinBusy(false);
    }
  };

  const leave = async (id: string) => {
    const wasActive = leaveJoinedSpace(id);
    onAudit('space-left');
    bump();
    onChanged?.();
    // Ключи уже стёрты, но база IndexedDB — тоже копия данных тренера (дневник,
    // анализы, тренировки). Без этого «удалено с этого телефона» было бы
    // неправдой, а база висела бы на диске невидимой.
    try {
      const mod = await import('../../../core/db');
      await mod.deleteSpaceDatabases([id]);
    } catch {
      /* базу удалить не вышло: настройки уже чисты, повторная попытка — при следующем «отключиться» */
    }
    if (wasActive) reloadToApplySpace();
    else setNotice('Отключено. Данные тренера удалены с этого телефона.');
  };

  return (
    <div data-coach="device-invite" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={sectionTitle}>{coachEnabled ? 'Телефон атлета' : 'Данные тренера'}</div>
          <div style={{ ...hint, marginTop: 2 }}>
            {coachEnabled
              ? 'Отдельный код на одно пространство. Атлет видит только свои данные, вы — все.'
              : 'Режим тренера выключен, но телефон подключён к данным тренера: отсюда можно отключиться.'}
          </div>
        </div>
        <span
          data-coach="device-invite-status"
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: CLOUD_CONFIGURED ? ACCENT : colors.warning,
            border: `1px solid ${CLOUD_CONFIGURED ? 'rgba(34,211,238,0.35)' : 'rgba(245,158,11,0.4)'}`,
            borderRadius: 999,
            padding: '3px 8px',
          }}
        >
          {CLOUD_CONFIGURED ? 'облако настроено' : 'облако не настроено'}
        </span>
      </div>

      {coachEnabled && (athleteSpaces.length === 0 ? (
        <div data-coach="device-invite-empty" style={{ ...hint, marginTop: 10 }}>
          {joined.length > 0
            ? 'Этот телефон подключён к данным тренера — кодов вы не выдаёте. Управление доступом у тренера.'
            : 'Пока нет ни одного пространства атлета. Добавьте атлета и откройте его данные — после этого можно выдать код.'}
        </div>
      ) : (
        <>
          <div style={{ marginTop: 10 }}>
            <label htmlFor="coach-invite-space" style={{ ...hint, display: 'block', marginBottom: 4 }}>
              Пространство атлета
            </label>
            <select
              id="coach-invite-space"
              data-coach="device-invite-space"
              value={spaceId}
              onChange={e => {
                setSelected(e.target.value);
                clearMessages();
              }}
              style={{ ...inputStyle, fontSize: 12.5, appearance: 'none' }}
            >
              {athleteSpaces.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.lastOpenedAt ? ' · открывался' : ' · ещё не открывался'}
                </option>
              ))}
            </select>
          </div>

          {!record || !migrated ? (
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-coach="device-invite-create"
                  onClick={() => void createCode()}
                  disabled={busy || !CLOUD_CONFIGURED}
                  style={{ ...btn('primary'), opacity: busy || !CLOUD_CONFIGURED ? 0.6 : 1 }}
                >
                  {busy ? 'Готовим…' : record ? 'Повторить перенос' : 'Создать код'}
                </button>
              </div>
              {record && !migrated && (
                // Код НЕ показываем, пока данные не перенесены: иначе телефон
                // атлета подключится к пустому пространству и решит, что данных нет.
                <div data-coach="device-invite-migrated" style={{ ...hint, color: colors.warning }}>
                  Данные ещё не перенесены в облако: нажмите «Повторить перенос» после восстановления связи. Код
                  пока не выдавайте.
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              <textarea
                readOnly
                data-coach="device-invite-code"
                value={code}
                spellCheck={false}
                aria-label="Код для телефона атлета"
                onFocus={e => e.currentTarget.select()}
                style={codeStyle}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" data-coach="device-invite-copy" onClick={() => void copy(code)} style={btn('primary')}>
                  Скопировать
                </button>
                <button
                  type="button"
                  data-coach="device-invite-rotate"
                  onClick={() => void rotate()}
                  disabled={busy}
                  style={{ ...btn(confirmRotate ? 'danger' : 'ghost'), opacity: busy ? 0.6 : 1 }}
                >
                  {confirmRotate ? 'Точно сменить код?' : 'Новый код'}
                </button>
                <button
                  type="button"
                  data-coach="device-invite-revoke"
                  onClick={() => void revokePhone()}
                  disabled={busy}
                  style={{ ...btn(confirmRevoke ? 'danger' : 'ghost'), opacity: busy ? 0.6 : 1 }}
                >
                  {confirmRevoke ? 'Точно отключить?' : 'Отключить телефон'}
                </button>
              </div>
              <div data-coach="device-invite-migrated" style={{ ...hint, color: colors.textSubtle }}>
                {`Данные перенесены в облако${record?.createdAt ? ` · код от ${record.createdAt.slice(8, 10)}.${record.createdAt.slice(5, 7)}.${record.createdAt.slice(2, 4)}` : ''}`}
              </div>
            </div>
          )}
        </>
      ))}

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={sectionTitle}>Подключиться к тренеру</div>
        <div style={{ ...hint, marginTop: 2 }}>
          Для атлета: вставьте код, который прислал тренер. Этот телефон получит только своё пространство.
        </div>
        <div data-coach="device-join-home-hint" style={{ ...hint, marginTop: 4, color: colors.textSubtle }}>
          Записи, сделанные на этом телефоне раньше, никуда не денутся и в пространство тренера не
          переедут: они остаются в домашнем профиле, и вернуться к ним можно в любой момент — кнопкой
          возврата к своим данным.
        </div>

        {joined.length > 0 && (
          <div data-coach="device-joined" style={{ marginTop: 8, display: 'grid', gap: 6 }}>
            {joined.map(s => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(34,211,238,0.25)',
                  background: 'rgba(34,211,238,0.06)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'rgba(255,255,255,0.88)' }}>
                  {s.label}
                </div>
                <button
                  type="button"
                  data-coach="device-leave"
                  onClick={() => leave(s.id)}
                  style={{ ...btn('ghost'), minHeight: 34, fontSize: 11 }}
                >
                  Отключиться
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          <textarea
            data-coach="device-join-code"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            placeholder="BBA1.asp_… .tk_… .a.Имя"
            spellCheck={false}
            aria-label="Код приглашения от тренера"
            style={{ ...codeStyle, minHeight: 54 }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              data-coach="device-join"
              onClick={join}
              disabled={joinBusy || !joinCode.trim()}
              style={{ ...btn('primary'), opacity: joinBusy || !joinCode.trim() ? 0.6 : 1 }}
            >
              {joinBusy ? 'Подключаем…' : 'Подключиться'}
            </button>
            {!CLOUD_CONFIGURED && <span style={{ ...hint, color: colors.warning }}>Синхронизация выключена — код не сработает.</span>}
          </div>
          {joinError && (
            <div data-coach="device-join-error" role="alert" style={{ fontSize: 11.5, color: colors.danger, lineHeight: 1.45 }}>
              {joinError}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div data-coach="device-invite-error" role="alert" style={{ marginTop: 8, fontSize: 11.5, color: colors.danger, lineHeight: 1.45 }}>
          {error}
        </div>
      )}
      {notice && (
        <div data-coach="device-invite-notice" style={{ marginTop: 8, fontSize: 11, color: colors.textMuted, lineHeight: 1.45 }}>
          {notice}
        </div>
      )}

      <div style={{ marginTop: 10, ...hint, fontSize: 10.5 }}>
        {coachEnabled ? (
          <>
            Код — это ключ доступа к данным выбранного пространства: кто его знает, тот их видит. Новый код
            отключает старый телефон. Фото веса в облако не уходят. Телефон получает изменения, когда приложение
            открыто или снова на экране.
            {hasTokenCount === 0 ? ' Пока ни одному устройству доступ не выдан.' : ''}
          </>
        ) : (
          <>
            Телефон получает изменения от тренера, когда приложение открыто или снова на экране. Фото
            веса в облако не уходят. «Отключиться» убирает данные тренера с этого телефона — у самого
            тренера они остаются.
          </>
        )}
      </div>
    </div>
  );
}
