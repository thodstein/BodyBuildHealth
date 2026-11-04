/**
 * DataSpaceBanner — «вы сейчас работаете в данных атлета».
 *
 * Зачем отдельная полоса на весь экран, а не строчка в профиле: после
 * переключения пространства меняется ВСЁ приложение (профиль, дневники, планы,
 * анализы). Если тренер об этом забудет, он будет править чужой профиль, думая,
 * что это его собственный. Поэтому предупреждение висит везде и всегда, пока
 * пространство не домашнее, и убирается одним нажатием.
 *
 * Второе назначение — смена атлета без похода в профиль: реальный рабочий день
 * тренера это «отработал с одним, перешёл к следующему». Без этого каждый
 * переход стоил бы четырёх шагов (к своим → профиль → карточка → войти в данные).
 *
 * В домашнем пространстве баннер не рисуется вообще (обычный пользователь его
 * никогда не увидит).
 */
import React, { useMemo, useState } from 'react';
import { NativeIcon } from './native/NativeIcons';
import {
  HOME_SPACE_ID,
  activateSpaceById,
  activeSpaceRecord,
  athleteSpacesByRecent,
  isAthleteDataActive,
  readRegistryFromStorage,
  reloadToApplySpace,
} from '../core/data-space';

const VIOLET = '#a78bfa';

export const DataSpaceBanner: React.FC = () => {
  const active = useMemo(() => activeSpaceRecord(), []);
  // Список пространств тоже читаем на монтировании: баннер живёт до перезагрузки,
  // а переключение всегда перезагружает приложение.
  const spaces = useMemo(() => readRegistryFromStorage(), []);
  const [open, setOpen] = useState(false);
  if (!isAthleteDataActive()) return null;

  const go = (id: string) => {
    const res = activateSpaceById(id);
    if (res.error) return;
    reloadToApplySpace();
  };

  // В списке «Сменить» — только атлеты, последние открытые первыми: рабочий день
  // тренера почти всегда «тот же, что и вчера». Возврат к своим данным уже есть
  // отдельной кнопкой, дублировать его плиткой «Мои данные» незачем.
  const others = athleteSpacesByRecent(spaces).filter(s => s.id !== active.id);

  return (
    <div
      data-space="banner"
      role="status"
      style={{
        position: 'relative',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', color: VIOLET, flexShrink: 0, marginTop: 2 }}>
          <NativeIcon name="user" size={15} />
        </span>
        {/* Справа зарезервировано место под плавающие кнопки синка/языка
            (`App.tsx`: absolute top-8 right-8). Без запаса они ложились бы
            поверх текста полосы. */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: 84 }}>
          <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Данные атлета: {active.label}
          </div>
          <div style={{ opacity: 0.72, fontSize: 11 }}>
            Профиль, дневники и планы сейчас — этого атлета. Заметки и планер тренера общие.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        {others.length > 0 && (
          <button
            type="button"
            data-space="switch"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            style={{
              minHeight: 32,
              padding: '5px 10px',
              borderRadius: 10,
              fontSize: 11.5,
              fontWeight: 800,
              cursor: 'pointer',
              color: VIOLET,
              background: 'transparent',
              border: `1px solid ${VIOLET}80`,
              whiteSpace: 'nowrap',
            }}
          >
            {open ? 'Скрыть' : 'Сменить'}
          </button>
        )}
        <button
          type="button"
          data-space="return"
          onClick={() => go(HOME_SPACE_ID)}
          style={{
            minHeight: 32,
            padding: '5px 12px',
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

      {open && (
        <div data-space="switch-list" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {others.map(s => (
            <button
              key={s.id}
              type="button"
              data-space="switch-to"
              data-space-id={s.id}
              onClick={() => go(s.id)}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                color: '#fff',
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.22)',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
