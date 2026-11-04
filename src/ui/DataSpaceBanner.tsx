/**
 * DataSpaceBanner — «вы сейчас работаете в данных атлета».
 *
 * Зачем отдельная полоса на весь экран, а не строчка в профиле: после
 * переключения пространства меняется ВСЁ приложение (профиль, дневники, планы,
 * анализы). Если тренер об этом забудет, он будет править чужой профиль, думая,
 * что это его собственный. Поэтому предупреждение висит везде и всегда, пока
 * пространство не домашнее, и убирается одним нажатием.
 *
 * В домашнем пространстве баннер не рисуется вообще (обычный пользователь его
 * никогда не увидит).
 */
import React, { useMemo } from 'react';
import { NativeIcon } from './native/NativeIcons';
import { activeSpaceRecord, activateHomeSpace, isAthleteDataActive, reloadToApplySpace } from '../core/data-space';

const VIOLET = '#a78bfa';

export const DataSpaceBanner: React.FC = () => {
  const space = useMemo(() => activeSpaceRecord(), []);
  if (!isAthleteDataActive()) return null;

  const back = () => {
    activateHomeSpace();
    reloadToApplySpace();
  };

  return (
    <div
      data-space="banner"
      role="status"
      style={{
        position: 'relative',
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        margin: '6px 8px 0',
        borderRadius: 12,
        background: `linear-gradient(135deg, ${VIOLET}26, rgba(139,92,246,0.10))`,
        border: `1px solid ${VIOLET}59`,
        color: '#fff',
        fontSize: 12,
        lineHeight: 1.35,
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', color: VIOLET, flexShrink: 0 }}>
        <NativeIcon name="user" size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Данные атлета: {space.label}
        </div>
        <div style={{ opacity: 0.72, fontSize: 11 }}>
          Профиль, дневники и планы сейчас — этого атлета. Заметки и планер тренера общие.
        </div>
      </div>
      <button
        type="button"
        data-space="return"
        onClick={back}
        style={{
          flexShrink: 0,
          minHeight: 36,
          padding: '6px 12px',
          borderRadius: 10,
          fontSize: 11.5,
          fontWeight: 800,
          cursor: 'pointer',
          color: '#1b1033',
          background: VIOLET,
          border: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        К своим данным
      </button>
    </div>
  );
};
