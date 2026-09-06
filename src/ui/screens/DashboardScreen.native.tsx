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
import { getISOWeekNumber, getSessionsByWeek } from '../../engines/workout-logger.engine';
import { loadFoodLog } from '../../engines/nutrition-tracker.engine';

export type DashboardNativeNavId =
  | 'training' | 'nutrition' | 'labs' | 'risks' | 'pharma' | 'support'
  | 'profile' | 'articles' | 'marketplace';

interface Props {
  onNavigate?: (screen: DashboardNativeNavId) => void;
}

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const TRIO_ICONS: Record<DashboardNativeNavId, React.ReactNode> = {
  profile: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  marketplace: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  articles: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  training: null,
  nutrition: null,
  labs: null,
  risks: null,
  pharma: null,
  support: null,
};

const TRIO: { id: DashboardNativeNavId; icon: React.ReactNode; labelRu: string; labelEn: string }[] = [
  { id: 'profile', icon: TRIO_ICONS.profile, labelRu: 'Профиль', labelEn: 'Profile' },
  { id: 'marketplace', icon: TRIO_ICONS.marketplace, labelRu: 'Магазин', labelEn: 'Store' },
  { id: 'articles', icon: TRIO_ICONS.articles, labelRu: 'Статьи', labelEn: 'Articles' },
];

/** Карусель разделов: 6 рабочих табов (трио уже ведёт в профиль/магазин/статьи). */
const RAIL: { id: DashboardNativeNavId; icon: React.ReactNode; labelRu: string; labelEn: string }[] = [
  {
    id: 'training', labelRu: 'Тренинг', labelEn: 'Training',
    icon: (<svg viewBox="0 0 24 24" {...STROKE}><path d="M18 4l3 3-6 6-5-5-6 6-3-3" /><circle cx="8" cy="8" r="2" /><path d="M14 2v4" /><path d="M10 22v-8" /></svg>),
  },
  {
    id: 'nutrition', labelRu: 'Питание', labelEn: 'Food',
    icon: (<svg viewBox="0 0 24 24" {...STROKE}><path d="M12 2v20" /><path d="M2 12h20" /><path d="M4.93 4.93l14.14 14.14" /><path d="M19.07 4.93L4.93 19.07" /></svg>),
  },
  {
    id: 'labs', labelRu: 'Анализы', labelEn: 'Labs',
    icon: (<svg viewBox="0 0 24 24" {...STROKE}><path d="M9 3h6v7l5 8H4l5-8V3z" /><line x1="9" y1="3" x2="15" y2="3" /></svg>),
  },
  {
    id: 'risks', labelRu: 'Риски', labelEn: 'Risks',
    icon: (<svg viewBox="0 0 24 24" {...STROKE}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>),
  },
  {
    id: 'pharma', labelRu: 'Фарма', labelEn: 'Gear',
    icon: (<svg viewBox="0 0 24 24" {...STROKE}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>),
  },
  {
    id: 'support', labelRu: 'БАДы', labelEn: 'Stack',
    icon: (<svg viewBox="0 0 24 24" {...STROKE}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>),
  },
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
