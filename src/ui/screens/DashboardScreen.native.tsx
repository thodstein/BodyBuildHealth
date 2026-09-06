/**
 * DashboardScreen.native.tsx — PRO-домашний экран ТОЛЬКО для APK.
 * Telegram Mini App продолжает рендерить классический DashboardScreen без изменений.
 *
 * Дизайн: hero на весь экран + 3 стеклянные кнопки внизу
 * (Профиль / Статьи / Магазин). Больше ничего: ни приветствий, ни плиток,
 * ни статистики — это всё живёт в своих разделах. Плюс FAB из App.
 */

import React, { useEffect } from 'react';
import { HeroImg } from '../HeroImg';
import { consumeWidgetLaunchTarget } from '../../core/widget-bridge';
import { syncAllWidgets } from '../native/widget-sync';
import { usePullToRefresh } from '../native/usePullToRefresh';
import { getLocale } from '../../data/interactions-labels';

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

  // Виджеты: при входе на Главную — отдать очередь в дневники, запушить
  // свежие снапшоты и отработать тап по виджету (one-shot deep link).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await syncAllWidgets();
        if (!alive) return;
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
