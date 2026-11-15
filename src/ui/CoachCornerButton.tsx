/**
 * CoachCornerButton — явная угловая кнопка «в свой профиль» в режиме тренера.
 *
 * Зачем: включив режим, тренер уходит в тренировки/питание/анализы атлета, и
 * вернуться к карточкам можно было только через нижнее меню → профиль → вкладка.
 * Четыре шага на каждый переход — это не рабочий день тренера. Кнопка живёт в
 * углу экрана (слева, над нижней навигацией) ровно пока режим включён:
 *
 *  • в домашнем пространстве — «Режим тренера»: открывает карточки атлетов;
 *  • в данных атлета — «Мой профиль»: СНАЧАЛА возвращает свои данные (иначе
 *    профиль открылся бы в чужом пространстве), и после перезагрузки App
 *    возвращает в «Режим тренера» (`core/space-return`).
 *
 * Кнопка не дублирует полосу «Данные атлета»: полоса предупреждает, кнопка —
 * быстрый выход и один понятный вход обратно.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { NativeIcon } from './native/NativeIcons';
import {
  coachActiveAthlete,
  readCoachState,
  type CoachState,
} from '../engines/coach/coach-mode.engine';
import {
  HOME_SPACE_ID,
  activateHomeSpace,
  activeSpaceRecord,
  reloadToApplySpace,
} from '../core/data-space';
import { rememberScreen } from '../core/space-return';

const ls = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

export const CoachCornerButton: React.FC<{
  /** Перейти в профиль → «Режим тренера» (домашнее пространство). */
  onOpenCoach: () => void;
  /** Скрыть: например, тренер уже на вкладке тренера. */
  hidden?: boolean;
}> = ({ onOpenCoach, hidden = false }) => {
  const [state, setState] = useState<CoachState>(() => readCoachState(ls()));
  const [space, setSpace] = useState(() => activeSpaceRecord());

  useEffect(() => {
    const refresh = () => {
      setState(readCoachState(ls()));
      setSpace(activeSpaceRecord());
    };
    window.addEventListener('he-coach-mode', refresh);
    window.addEventListener('storage', refresh);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('he-coach-mode', refresh);
      window.removeEventListener('storage', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const inAthleteSpace = space.id !== HOME_SPACE_ID;
  const activeAthlete = useMemo(() => coachActiveAthlete(state), [state]);

  if (hidden || !state.enabled) return null;

  const label = inAthleteSpace ? 'Мой профиль' : 'Режим тренера';
  const detail = inAthleteSpace
    ? `Выйти из данных: ${space.label || 'атлет'}`
    : activeAthlete
      ? `Активный: ${activeAthlete.name}`
      : state.athletes.length > 0
        ? `Атлетов: ${state.athletes.length}`
        : 'Добавить первого атлета';
  const aria = inAthleteSpace
    ? `Вернуться в свой профиль — режим тренера. Сейчас открыты данные атлета: ${space.label || 'без имени'}.`
    : 'Открыть свой профиль в режиме тренера';

  const open = () => {
    if (inAthleteSpace) {
      // Возврат точки после reload: профиль → режим тренера. Порядок важен:
      // activateHomeSpace сам фиксирует текущий экран как точку возврата.
      rememberScreen('profile', 'coach');
      activateHomeSpace();
      reloadToApplySpace();
      return;
    }
    onOpenCoach();
  };

  return (
    <button
      type="button"
      data-coach="corner"
      data-mode={inAthleteSpace ? 'space' : 'profile'}
      aria-label={aria}
      title={aria}
      onClick={open}
      style={{
        position: 'fixed',
        left: 12,
        bottom: 'calc(var(--nav-height, 68px) + env(safe-area-inset-bottom, 0px) + 10px)',
        zIndex: 1180,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: 'calc(100vw - 96px)',
        minHeight: 44,
        padding: '7px 12px 7px 9px',
        borderRadius: 999,
        cursor: 'pointer',
        textAlign: 'left',
        color: '#fff',
        background: inAthleteSpace
          ? 'linear-gradient(135deg, rgba(167,139,250,0.92), rgba(124,58,237,0.92))'
          : 'linear-gradient(135deg, rgba(34,211,238,0.92), rgba(14,165,233,0.92))',
        border: '1px solid rgba(255,255,255,0.28)',
        boxShadow: '0 10px 26px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.28)',
        backdropFilter: 'blur(14px) saturate(150%)',
        WebkitBackdropFilter: 'blur(14px) saturate(150%)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: inAthleteSpace ? '#2e1065' : '#04222a',
          background: 'rgba(255,255,255,0.9)',
        }}
      >
        <NativeIcon name={inAthleteSpace ? 'user' : 'award'} size={16} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.15, color: '#fff' }}>{label}</span>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            lineHeight: 1.2,
            color: 'rgba(255,255,255,0.9)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {detail}
        </span>
      </span>
    </button>
  );
};
