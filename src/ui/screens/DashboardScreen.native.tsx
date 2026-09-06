/**
 * DashboardScreen.native.tsx — PRO-домашний экран ТОЛЬКО для APK.
 * Telegram Mini App продолжает рендерить классический DashboardScreen без изменений.
 *
 * Дизайн: hero на весь экран + 3 стеклянные кнопки внизу
 * (Профиль / Статьи / Магазин). Больше ничего: ни приветствий, ни плиток,
 * ни статистики — это всё живёт в своих разделах. Плюс FAB из App.
 */

import React, { useEffect, useState } from 'react';
import { HeroImg } from '../HeroImg';
import { consumeWidgetLaunchTarget, queueWidgetSize } from '../../core/widget-bridge';
import { syncAllWidgets } from '../native/widget-sync';
import { usePullToRefresh } from '../native/usePullToRefresh';
import { getLocale } from '../../data/interactions-labels';
import { NativeIcon } from '../native/NativeIcons';
import { getISOWeekNumber, getSessionsByWeek } from '../../engines/workout-logger.engine';
import { loadFoodLog } from '../../engines/nutrition-tracker.engine';

export type DashboardNativeNavId =
  | 'training' | 'nutrition' | 'labs' | 'risks' | 'pharma' | 'support'
  | 'profile' | 'articles' | 'marketplace';

interface Props {
  onNavigate?: (screen: DashboardNativeNavId) => void;
}

const TRIO: { id: DashboardNativeNavId; icon: React.ReactNode; labelRu: string; labelEn: string }[] = [
  { id: 'profile', icon: <NativeIcon name="user" size={34} />, labelRu: 'Профиль', labelEn: 'Profile' },
  { id: 'marketplace', icon: <NativeIcon name="bag" size={34} />, labelRu: 'Магазин', labelEn: 'Store' },
  { id: 'articles', icon: <NativeIcon name="bookOpen" size={34} />, labelRu: 'Статьи', labelEn: 'Articles' },
];

/** Карусель разделов: 6 рабочих табов (трио уже ведёт в профиль/магазин/статьи). */
const RAIL: { id: DashboardNativeNavId; icon: React.ReactNode; labelRu: string; labelEn: string }[] = [
  { id: 'training', icon: <NativeIcon name="dumbbell" size={17} />, labelRu: 'Тренинг', labelEn: 'Training' },
  { id: 'nutrition', icon: <NativeIcon name="bowl" size={17} />, labelRu: 'Питание', labelEn: 'Food' },
  { id: 'labs', icon: <NativeIcon name="flask" size={17} />, labelRu: 'Анализы', labelEn: 'Labs' },
  { id: 'risks', icon: <NativeIcon name="alertTriangle" size={17} />, labelRu: 'Риски', labelEn: 'Risks' },
  { id: 'pharma', icon: <NativeIcon name="pill" size={17} />, labelRu: 'Фарма', labelEn: 'Gear' },
  { id: 'support', icon: <NativeIcon name="shield" size={17} />, labelRu: 'БАДы', labelEn: 'Stack' },
];

export interface HomeToday {
  trained: boolean;
  sessionsToday: number;
  kcalToday: number;
  queue: number;
}

export function readHomeToday(): HomeToday {
  try {
    const d = new Date();
    const iso = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
    let sessionsToday = 0;
    try {
      sessionsToday = getSessionsByWeek(getISOWeekNumber(iso)).filter((s) => s.date === iso).length;
    } catch {
      sessionsToday = 0;
    }
    let kcalToday = 0;
    try {
      kcalToday = Math.round(loadFoodLog().filter((e) => e.date === iso).reduce((a, e) => a + (e.kcal || 0), 0));
    } catch {
      kcalToday = 0;
    }
    return { trained: sessionsToday > 0, sessionsToday, kcalToday, queue: 0 };
  } catch {
    return { trained: false, sessionsToday: 0, kcalToday: 0, queue: 0 };
  }
}

export interface HomeCta {
  id: DashboardNativeNavId | null;
  labelRu: string;
  labelEn: string;
}

/** Умная CTA: первое незакрытое за день (тренировка → очередь → питание). */
export function nextHomeAction(t: HomeToday): HomeCta {
  if (!t.trained) return { id: 'training', labelRu: 'Время тренировки', labelEn: 'Train now' };
  if (t.queue > 0) return { id: null, labelRu: `Отдать очередь (${t.queue})`, labelEn: `Flush queue (${t.queue})` };
  if (t.kcalToday <= 0) return { id: 'nutrition', labelRu: 'Записать питание', labelEn: 'Log food' };
  return { id: 'training', labelRu: 'Дневник тренировок', labelEn: 'Training log' };
}

function isEn(): boolean {
  try {
    return getLocale() === 'en';
  } catch {
    return false;
  }
}

export const DashboardNative: React.FC<Props> = ({ onNavigate }) => {
  const en = isEn();
  // Pull-to-refresh Главной: повторный синк виджетов жестом вниз.
  const ptr = usePullToRefresh({
    onRefresh: async () => {
      try {
        await syncAllWidgets();
      } catch {
        /* тихий no-op — индикатор прячется в любом случае */
      }
    },
  });

  const [today, setToday] = useState<HomeToday>(() => readHomeToday());
  const [flash, setFlash] = useState<string | null>(null);

  // Виджеты: при входе на Главную — отдать очередь в дневники, запушить
  // свежие снапшоты и отработать тап по виджету (one-shot deep link).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const before = await queueWidgetSize();
        if (!alive) return;
        if (before > 0) setToday((t) => ({ ...t, queue: before }));
        await syncAllWidgets();
        if (!alive) return;
        const after = await queueWidgetSize().catch(() => 0);
        setToday((t) => ({ ...readHomeToday(), queue: after }));
        if (before > 0 && after === 0) {
          setFlash(en ? `Queue flushed (${before})` : `Очередь отдана (${before})`);
          window.setTimeout(() => {
            if (alive) setFlash(null);
          }, 3500);
        }
      } catch {
        /* виджеты недоступны — тихий no-op */
      }
      try {
        const target = await consumeWidgetLaunchTarget();
        if (!alive || !target || target === 'home') return;
        if (target === 'training' || target === 'nutrition' || target === 'support') {
          onNavigate?.(target);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [onNavigate]);

  const cta = nextHomeAction(today);

  const onFlushQueue = async () => {
    try {
      await syncAllWidgets();
    } catch {
      /* ignore */
    }
    try {
      const q = await queueWidgetSize().catch(() => 0);
      setToday((t) => ({ ...readHomeToday(), queue: q }));
      if (q === 0) {
        setFlash(en ? 'Queue flushed' : 'Очередь отдана в дневники');
        window.setTimeout(() => setFlash(null), 3000);
      }
    } catch {
      /* ignore */
    }
  };

  const onCta = () => {
    if (cta.id) {
      onNavigate?.(cta.id);
      return;
    }
    void onFlushQueue();
  };

  return (
    <div className="native-home" ref={ptr.containerRef as React.RefObject<HTMLDivElement>}>
      <div className="native-home-bg" aria-hidden="true">
        <HeroImg webp="/hero-main.webp?v=20250827k" src="/hero-main.png?v=20250827k" alt="" draggable={false} />
        <div className="native-home-shade" />
      </div>

      <div className="native-home-landing">
        <div
          ref={ptr.indicatorRef as React.RefObject<HTMLDivElement>}
          className="native-ptr"
          aria-hidden="true"
          style={{ height: 0 }}
        >
          <span className={ptr.refreshing ? 'native-ptr-spin' : ''}>
            {ptr.refreshing ? '◌' : '↓'}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        {flash && (
          <div className="native-home-flash native-fade-up" role="status">
            {flash}
          </div>
        )}
        <div className="native-home-today native-fade-up" aria-label={en ? 'Today' : 'Сегодня'}>
          <button
            type="button"
            className="native-home-stat"
            onClick={() => onNavigate?.('training')}
            aria-label={en ? `Workouts today: ${today.sessionsToday}` : `Тренировок сегодня: ${today.sessionsToday}`}
          >
            <span className="native-home-stat-v">{today.sessionsToday}</span>
            <span className="native-home-stat-l">{en ? 'workouts' : 'тренировки'}</span>
          </button>
          <button
            type="button"
            className="native-home-stat"
            onClick={() => onNavigate?.('nutrition')}
            aria-label={en ? `Calories today: ${today.kcalToday}` : `Ккал сегодня: ${today.kcalToday}`}
          >
            <span className="native-home-stat-v">{today.kcalToday}</span>
            <span className="native-home-stat-l">{en ? 'kcal' : 'ккал'}</span>
          </button>
          <button
            type="button"
            className="native-home-stat"
            onClick={() => void onFlushQueue()}
            aria-label={en ? `Widget queue: ${today.queue}` : `Очередь виджетов: ${today.queue}`}
          >
            <span className="native-home-stat-v">{today.queue}</span>
            <span className="native-home-stat-l">{en ? 'queue' : 'очередь'}</span>
          </button>
        </div>
        <button type="button" className="native-home-cta native-fade-up" onClick={onCta}>
          <span className="native-home-cta-dot" aria-hidden="true" />
          {en ? cta.labelEn : cta.labelRu}
          <span aria-hidden="true"> →</span>
        </button>
        <div className="native-home-rail" aria-label={en ? 'Sections' : 'Разделы'}>
          {RAIL.map((r) => (
            <button
              key={r.id}
              type="button"
              className="native-home-rail-item"
              onClick={() => onNavigate?.(r.id)}
              aria-label={en ? r.labelEn : r.labelRu}
            >
              <span className="native-home-rail-icon" aria-hidden="true">{r.icon}</span>
              <span>{en ? r.labelEn : r.labelRu}</span>
            </button>
          ))}
        </div>
        <div className="native-home-trio native-fade-up">
          {TRIO.map((a, ai) => (
            <button
              key={a.id}
              className="native-home-tile native-fade-up"
              style={{ animationDelay: `${ai * 60}ms` }}
              onClick={() => onNavigate?.(a.id)}
              aria-label={en ? a.labelEn : a.labelRu}
            >
              <span className="native-home-tile-icon" aria-hidden="true">{a.icon}</span>
              <span className="native-home-tile-label">{en ? a.labelEn : a.labelRu}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
