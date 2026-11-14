import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { registry } from './core/data/registry';
import { DashboardScreen } from './ui/screens/DashboardScreen';
import { InfoErrorBoundary } from './ui/components/InfoErrorBoundary';

import { ToastContainer } from './ui/ToastContainer';
import { KvUpdateBanner } from './ui/KvUpdateBanner';
import { KvErrorBanner } from './ui/KvErrorBanner';
import { DataSpaceBanner } from './ui/DataSpaceBanner';
import { rememberScreen, restoreScreen } from './core/space-return';
import { KvSyncButton } from './ui/KvSyncButton';
import { setLocale, getLocale } from './data/interactions-labels';
import { isNativeApp } from './core/app-platform';
import { setupNativeBackButton, haptics, isBiometricAvailable, authenticateWithBiometrics } from './core/native-bridge';
import { useSwipeTabs } from './ui/native/useSwipeTabs';
import { NativeFab } from './ui/native/NativeFab';
import { NativeOfflinePill } from './ui/native/NativeOfflinePill';
import { getNavBadges } from './ui/native/nav-badges';
import { HeroImg } from './ui/HeroImg';

/* ── Экраны — по требованию ───────────────────────────────────────────────
 * Раньше все экраны и их движки лежали в главном бандле и разбирались при
 * старте: пользователь видел один экран, а грузился весь апп. Теперь каждый
 * экран — отдельный чанк. «Домашний» остаётся в главном бандле (он первым
 * показывается), остальные подтягиваются при первом открытии.
 * В АПК ассеты локальные — после старта чанки прогреваются в простое, чтобы
 * переключение вкладок было мгновенным. В веб/TG прогреваем только при
 * наведении/тапе на вкладку (не тянем мегабайты на мобильном трафике). */
function lazyScreen(loader: () => Promise<any>, name: string) {
  return React.lazy(() => loader().then(m => ({ default: (m as Record<string, React.ComponentType<any>>)[name] })));
}

const SCREEN_LOADERS = {
  pharma: () => import('./ui/screens/PharmaScreen'),
  support: () => import('./ui/screens/SupportScreen'),
  training: () => import('./ui/screens/TrainingScreen'),
  labs: () => import('./ui/screens/LabsScreen'),
  risks: () => import('./ui/screens/RiskScreen'),
  nutrition: () => import('./ui/screens/NutritionScreen'),
  marketplace: () => import('./ui/screens/MarketplaceScreen'),
  profile: () => import('./ui/screens/ProfileScreen_v2/ProfileScreen_v2'),
  articles: () => import('./ui/screens/ArticlesScreen'),
} as const;

type LazyTab = keyof typeof SCREEN_LOADERS;

const PharmaScreen = lazyScreen(SCREEN_LOADERS.pharma, 'PharmaScreen');
const SupportScreen = lazyScreen(SCREEN_LOADERS.support, 'SupportScreen');
const TrainingScreen = lazyScreen(SCREEN_LOADERS.training, 'TrainingScreen');
const LabsScreen = lazyScreen(SCREEN_LOADERS.labs, 'LabsScreen');
const RiskScreen = lazyScreen(SCREEN_LOADERS.risks, 'RiskScreen');
const NutritionScreen = lazyScreen(SCREEN_LOADERS.nutrition, 'NutritionScreen');
const MarketplaceScreen = lazyScreen(SCREEN_LOADERS.marketplace, 'MarketplaceScreen');
const ProfileScreen_v2 = lazyScreen(SCREEN_LOADERS.profile, 'ProfileScreen_v2');
const ArticlesScreen = lazyScreen(SCREEN_LOADERS.articles, 'ArticlesScreen');

const prefetchScreen = (tab: string) => {
  const loader = (SCREEN_LOADERS as Record<string, (() => Promise<any>) | undefined>)[tab];
  if (!loader) return;
  try {
    void loader();
  } catch {
    /* предзагрузка — необязательная оптимизация */
  }
};

/** Заглушка на время загрузки чанка экрана — тот же скелет, что на старте. */
const ScreenLoading = () => (
  <div className="screen-loading native-boot">
    <div className="loading-spinner" />
    <span>Загрузка...</span>
    <div className="native-boot-skeleton" aria-hidden="true">
      <div className="native-skeleton" />
      <div className="native-skeleton" />
      <div className="native-skeleton" />
    </div>
  </div>
);

/** Экран блокировки входа. Рендерится ТОЛЬКО в APK при включённом блоке. */
function NativeAppLock({ onUnlocked }: { onUnlocked: () => void }) {
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(false);
  const unlock = async () => {
    setBusy(true);
    setFail(false);
    try {
      const ok = await authenticateWithBiometrics('Разблокировка Health Engine');
      if (ok) onUnlocked();
      else setFail(true);
    } catch {
      setFail(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      role="alertdialog"
      aria-label="Приложение заблокировано"
      style={{ position: 'fixed', inset: 0, zIndex: 5000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, background: '#050b16', textAlign: 'center' }}
    >
      <div style={{ fontSize: 52 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>Health Engine заблокирован</div>
      <div style={{ fontSize: 12, color: 'rgba(226,236,255,0.65)', maxWidth: 300, lineHeight: 1.5 }}>
        Подтвердите личность отпечатком или лицом, чтобы продолжить
      </div>
      <button
        onClick={unlock}
        disabled={busy}
        style={{ padding: '14px 28px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 800, color: 'var(--accent-contrast, #0a1a08)', background: 'var(--accent-gradient)', minHeight: 52, minWidth: 220 }}
      >
        {busy ? 'Ждите…' : '🖐️ Разблокировать'}
      </button>
      {fail && <div style={{ fontSize: 12, color: '#f87171' }}>Не распознано — попробуйте ещё раз</div>}
    </div>
  );
}

type Tab = 'home' | 'pharma' | 'training' | 'labs' | 'risks' | 'support' | 'nutrition' | 'profile' | 'articles' | 'marketplace';

const KNOWN_TABS: readonly Tab[] = [
  'home',
  'pharma',
  'training',
  'labs',
  'risks',
  'support',
  'nutrition',
  'profile',
  'articles',
  'marketplace',
];

/** Возврат после смены пространства: только настоящая вкладка, иначе главная. */
function restoredStart(): { tab: Tab; subTab: string | null } {
  try {
    const target = restoreScreen(KNOWN_TABS);
    if (target) return { tab: target.tab as Tab, subTab: target.subTab };
  } catch {
    /* возврат — удобство: любая ошибка = обычный старт */
  }
  return { tab: 'home', subTab: null };
}

// NavTarget — куда переходить внутри блока.
// subTab — конкретный раздел/дневник внутри блока (например, 'diary' в NutritionScreen).
interface NavTarget { tab: Tab; subTab?: string; }

// Bottom nav: 7 primary tabs
const PRIMARY_NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Главная', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'training', label: 'Тренинг', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 4l3 3-6 6-5-5-6 6-3-3"/><circle cx="8" cy="8" r="2"/><path d="M14 2v4"/><path d="M10 22v-8"/></svg> },
  { id: 'nutrition', label: 'Питание', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/><path d="M4.93 4.93l14.14 14.14"/><path d="M19.07 4.93L4.93 19.07"/></svg> },
  { id: 'labs', label: 'Анализы', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v7l5 8H4l5-8V3z"/><line x1="9" y1="3" x2="15" y2="3"/></svg> },
  { id: 'risks', label: 'Риски', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  { id: 'pharma', label: 'Фарма', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
  { id: 'support', label: 'БАДы', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> },
];

function DarkBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 50%, rgba(0,230,138,0.04) 0%, transparent 60%)' }} />
    </div>
  );
}

// Карта глубоких переходов (профиль → дневник/отчёт блока).
// Экспортирована для тестов диплинков: каждая цель кнопок профиля обязана
// указывать tab + subTab конкретного раздела, а не главную страницу блока.
export const NAV_TARGETS: Record<string, NavTarget> = {
  'dashboard': { tab: 'home' },
  'pharma': { tab: 'pharma' },
  'support': { tab: 'support' },
  'support-women': { tab: 'support', subTab: 'women' },
  'training': { tab: 'training' },
  'labs': { tab: 'labs' },
  'risks': { tab: 'risks' },
  'nutrition': { tab: 'nutrition' },
  'calendar': { tab: 'profile', subTab: 'planner' },
  'profile': { tab: 'profile' },
  'course': { tab: 'training' },
  'plan': { tab: 'training' },
  'substances': { tab: 'support' },
  'peptides': { tab: 'support' },
  'predictive': { tab: 'home' },
  'marketplace': { tab: 'marketplace' },
  'articles': { tab: 'articles' },
  'assistant': { tab: 'home' },
  'gamification': { tab: 'home' },
  'fertility-pct': { tab: 'support' },
  'role-management': { tab: 'profile' },
  'recovery': { tab: 'training' },
  'wellness': { tab: 'training' },
  'performance': { tab: 'pharma' },
  'bloodwork': { tab: 'labs' },
  'toolkit': { tab: 'training' },
  'training-tools': { tab: 'training' },

  // Дневники в других блоках — открываем конкретный sub-раздел
  'nutrition-diary': { tab: 'nutrition', subTab: 'diary' },
  'workout-log': { tab: 'training', subTab: 'diary' },
  'pharma-course': { tab: 'pharma', subTab: 'course' },
  'support-diary': { tab: 'support', subTab: 'diary' },
  'symptoms': { tab: 'support', subTab: 'symptoms' },
  'labs-diary': { tab: 'labs', subTab: 'diary' },

  // Отчёты
  'training-analytics': { tab: 'training', subTab: 'analytics' },
  'pharma-reports': { tab: 'pharma', subTab: 'reports' },
  'risk-reports': { tab: 'risks', subTab: 'reports' },
  'labs-reports': { tab: 'labs', subTab: 'reports' },
  'nutrition-reports': { tab: 'nutrition', subTab: 'reports' },
  'support-reports': { tab: 'support', subTab: 'reports' },
  'custom-report': { tab: 'profile', subTab: 'custom-report' },
  'profile-reports': { tab: 'profile', subTab: 'reports' },
  // Режим тренера и его инструменты (общий слой профиля)
  'coach': { tab: 'profile', subTab: 'coach' },
  'coach-mode': { tab: 'profile', subTab: 'coach' },
  'notes': { tab: 'profile', subTab: 'notes' },
  'planner': { tab: 'profile', subTab: 'planner' },
  'athlete-log': { tab: 'profile', subTab: 'log' },
  'coach-log': { tab: 'profile', subTab: 'log' },

  // Встроенные дневники — открываем профильный дневник
  'profile-diary-sleep': { tab: 'profile', subTab: 'sleep' },
  'profile-diary-bp': { tab: 'profile', subTab: 'bp' },
  'profile-diary-weight': { tab: 'profile', subTab: 'weight' },
  'profile-diary-measurements': { tab: 'profile', subTab: 'measurements' },
};

/**
 * Точка старта читается ОДИН раз при загрузке модуля, а не в инициализаторе
 * состояния: в dev-StrictMode инициализатор вызывается дважды, а `takeSpaceReturn`
 * забирает запись одноразово — второй вызов вернул бы главную и возврат
 * «сломался» бы только в разработке.
 */
const BOOT_START = restoredStart();

export default function App() {
  const [tab, setTab] = useState<Tab>(BOOT_START.tab);
  const [subTab, setSubTab] = useState<string | null>(BOOT_START.subTab);
  const [initialized, setInitialized] = useState(false);
  const [screenKey, setScreenKey] = useState(0);
  // Блок входа по биометрии — ТОЛЬКО APK (флаги he_biometry_* из BiometrySetupCard).
  const [appLocked, setAppLocked] = useState(false);
  // Живые бейджи навбара — только APK: в TG data-badge не выставляется вообще.
  const [navBadges, setNavBadges] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isNativeApp()) return;
    const refresh = () => {
      try {
        setNavBadges(getNavBadges());
      } catch {
        /* ignore */
      }
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [tab, screenKey]);
  // touchRef removed
  const mainRef = useRef<HTMLElement>(null);

  // App сообщает модулю возврата, где он: в момент перезагрузки (смена
  // пространства) этот экран станет точкой возврата.
  useEffect(() => {
    rememberScreen(tab, subTab);
  }, [tab, subTab]);

  useEffect(() => { registry.init().then(() => setInitialized(true)); }, []);

  // АПК: ассеты локальные — в простое прогреваем чанки экранов, чтобы
  // переключение вкладок не показывало «Загрузка...». В веб/TG не греем
  // (не тянем мегабайты на мобильном трафике) — там предзагрузка по
  // наведению/тапу на вкладку.
  useEffect(() => {
    if (!initialized || !isNativeApp()) return;
    // Самое тяжёлое (каталог БАДов 2.7 МБ, питание 2.5 МБ) в простое не
    // разбираем: исполнение такого чанка на слабом телефоне — это рывок на
    // секунды посреди чужой вкладки. Они грузятся по тапу (там ожидание
    // пользователь ждёт осознанно). «Тренинг» после сплита — 106 КБ, его греем.
    const skip: LazyTab[] = ['support', 'nutrition'];
    const order = (Object.keys(SCREEN_LOADERS) as LazyTab[]).filter(t => t !== tab && skip.indexOf(t) < 0);
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const next = order[i++];
      if (!next) return;
      prefetchScreen(next);
      timer = setTimeout(tick, 500);
    };
    timer = setTimeout(tick, 1200);
    return () => { if (timer) clearTimeout(timer); };
  }, [initialized, tab]);

  useEffect(() => {
    if (!isNativeApp()) return;
    let alive = true;
    const check = async () => {
      try {
        if (localStorage.getItem('he_biometry_lock') !== '1') return;
        if (localStorage.getItem('he_biometry_enabled') !== '1') return;
        if (!(await isBiometricAvailable())) return;
        if (alive) setAppLocked(true);
      } catch {
        /* без блокировки при любой ошибке */
      }
    };
    void check();
    const onVis = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        if (typeof tg.expand === 'function') tg.expand();
        if (typeof tg.enableClosingConfirmation === 'function') tg.enableClosingConfirmation();
        document.documentElement.style.setProperty('--tg-safe-top', (tg.safeAreaInsetTop || 0) + 'px');
        document.documentElement.style.setProperty('--tg-safe-bottom', (tg.safeAreaInsetBottom || 0) + 'px');
        if (tg.colorScheme === 'dark') {
          document.documentElement.style.setProperty('--tg-bg', tg.themeParams.bg_color || '#050508');
          document.documentElement.style.setProperty('--tg-text', tg.themeParams.text_color || '#e8e8f0');
        }
      }
    } catch (e) {
      console.warn('[App] TG viewport init failed:', e);
    }
  }, []);

  // Telegram back button integration
  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.BackButton) {
        if (typeof tg.BackButton.show === 'function') tg.BackButton.show();
        const handler = () => {
          if (tab !== 'home') {
            setTab('home');
          } else if (typeof tg.close === 'function') {
            tg.close();
          }
        };
        if (typeof tg.BackButton.onClick === 'function') tg.BackButton.onClick(handler);
        return () => { try { if (typeof tg.BackButton.offClick === 'function') tg.BackButton.offClick(handler); } catch {} };
      }
    } catch (e) {
      console.warn('[App] BackButton init failed:', e);
    }
  }, [tab]);

  // Native APK: системная кнопка «назад» Android.
  // В Telegram Mini App эта ветка не выполняется — там свой BackButton выше.
  // Подписка ОДНА (по initialized), текущий таб читается через ref:
  // раньше эффект зависел от [tab] и переподписывался при каждой смене вкладки,
  // а off назначался асинхронно — при быстрых переходах старые слушатели
  // не успевали сняться и дублировали setTab('home') (лишний «вылет назад»).
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    if (!isNativeApp() || !initialized) return;
    let off: (() => void) | undefined;
    let cancelled = false;
    void setupNativeBackButton(() => {
      if (tabRef.current !== 'home') {
        setTab('home');
        return true;
      }
      return false; // на главной — свернуть приложение штатно
    }).then((fn) => {
      if (cancelled) {
        try { fn(); } catch { /* ignore */ }
        return;
      }
      off = fn;
    });
    return () => {
      cancelled = true;
      try { off?.(); } catch { /* ignore */ }
    };
  }, [initialized]);

  const go = useCallback((t: Tab, st: string | null = null) => {
    // Чанк экрана тянем заранее: к моменту рендера он уже в памяти.
    prefetchScreen(t);
    // Нижний дашборд: тап по разделу без subTab — всегда возврат на главную
    // раздела. SupportScreen персистит позицию в he_sup_nav_v1 и при ремаунте
    // восстанавливает глубокий каталог — чистим ключ, иначе кнопка «БАДы»
    // никогда не возвращает на hero.
    if (t === 'support' && st == null) {
      try { localStorage.removeItem('he_sup_nav_v1'); } catch { /* ignore */ }
    }
    // Тактильный отклик — ТОЛЬКО APK. В Telegram ветка не выполняется вообще.
    if (isNativeApp() && tab !== t) {
      try {
        void haptics('light');
      } catch {
        /* ignore */
      }
    }
    // Повторный переход в тот же экран (в т.ч. из профиля в уже открытый блок)
    // тоже пересобирает экран: screenKey в key гарантирует remount и отработку
    // initialSubTab (дневник/отчёт откроются сразу, а не останутся на hero).
    if (tab === t) {
      setScreenKey(k => k + 1);
    } else {
      setTab(t);
    }
    setSubTab(st);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [tab]);

  // Свайпы между вкладками — ТОЛЬКО APK (порядок PRIMARY_NAV, с анимацией).
  // В Telegram ветка не монтируется вообще.
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  useEffect(() => {
    if (!slideDir) return;
    const t = window.setTimeout(() => setSlideDir(null), 380);
    return () => window.clearTimeout(t);
  }, [slideDir, tab, screenKey]);
  const swipeTo = (dir: 'left' | 'right') => {
    const ids = PRIMARY_NAV.map(i => i.id);
    const idx = ids.indexOf(tab);
    if (idx < 0) return;
    const next = dir === 'left' ? ids[(idx + 1) % ids.length] : ids[(idx - 1 + ids.length) % ids.length];
    if (next === tab) return;
    setSlideDir(dir);
    go(next);
  };
  useSwipeTabs(mainRef, isNativeApp() && !appLocked && initialized, {
    onSwipeLeft: () => swipeTo('left'),
    onSwipeRight: () => swipeTo('right'),
  });

  // handleNavigate: каждая цель указывает tab + subTab (конкретный дневник/отчёт).
  // subTab пробрасывается в конкретный экран через props.
  const handleNavigate = useCallback((screen: string) => {
    const target = NAV_TARGETS[screen] || { tab: 'home' as Tab };
    go(target.tab, target.subTab ?? null);
  }, [go]);

  // APK: виджеты должны получать свежие данные при любом возврате в приложение,
  // а не только когда открыта Главная. Иначе тап по виджету «просто открывает
  // приложение» со старым/пустым снапшотом. Синк — фоновый, без блокировки UI.
  useEffect(() => {
    if (!isNativeApp()) return;
    let alive = true;
    let lastAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      if (!alive) return;
      const now = Date.now();
      // focus + visibilitychange часто приходят парой — не дублируем работу.
      if (now - lastAt < 8000) return;
      lastAt = now;
      void import('./ui/native/widget-sync')
        .then((m) => m.syncAllWidgets())
        .catch(() => {
          /* виджеты — необязательный слой */
        });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (timer) clearTimeout(timer);
        // Даём WebView восстановиться после фона, затем отдаём данные.
        timer = setTimeout(sync, 350);
      }
    };
    timer = setTimeout(sync, 1200);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  // APK: one-shot deep-link из виджета обрабатываем на уровне App, а не только
  // на Главной. Приложение может восстановиться на последней вкладке — тогда
  // DashboardNative не смонтирован и target раньше «залипал» до возврата на
  // Главную (тап по виджету выглядел как обычный запуск приложения).
  useEffect(() => {
    if (!isNativeApp() || !initialized) return;
    let alive = true;
    const applyTarget = async () => {
      try {
        const { consumeWidgetLaunchTarget } = await import('./core/widget-bridge');
        const target = await consumeWidgetLaunchTarget();
        if (!alive || !target || target === 'home') return;
        if (target === 'training_run') {
          go('training', 'runtime');
          window.dispatchEvent(new CustomEvent('training-open-tab', { detail: 'runtime' }));
          return;
        }
        if (target === 'training_quick') {
          go('training', 'runtime');
          window.dispatchEvent(new CustomEvent('training-open-tab', { detail: 'runtime' }));
          window.setTimeout(() => {
            if (alive) window.dispatchEvent(new Event('he-workout-quick-set'));
          }, 700);
          return;
        }
        if (
          target === 'training' ||
          target === 'nutrition' ||
          target === 'support' ||
          target === 'calendar' ||
          target === 'notes'
        ) {
          handleNavigate(target);
        }
      } catch {
        /* deep-link — необязательный слой */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void applyTarget();
    };
    void applyTarget();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [initialized, go, handleNavigate]);

  // Deep-link: #pl-plan-<cycleId> или Telegram startapp=pl-plan-<cycleId>.
  // Маркер в sessionStorage читает SRCBBScreen и выбирает нужный цикл.
  useEffect(() => {
    const applyHash = () => {
      try {
        const hash = window.location.hash.match(/^#pl-plan-(.+)$/);
        const tgParam = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
        const param = typeof tgParam === 'string' && tgParam ? tgParam : hash?.[1];
        if (!param) return;
        const cycleId = decodeURIComponent(param.replace(/^pl-plan-/, ''));
        try { sessionStorage.setItem('he_pl_deeplink_cycle', cycleId); } catch { /* ignore */ }
        go('training', `pl-plan:${cycleId}`);
      } catch (e) {
        console.warn('[App] deep-link failed:', e);
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [go]);

  // Авто-скачивание на телефоне: страница открыта в браузере (не в WebView
  // Telegram) с хэшем #pl-download-<ext>-<base64> — скачиваем файл и чистим хэш.
  useEffect(() => {
    const applyDownload = () => {
      try {
        const m = window.location.hash.match(/^#pl-download-(xlsx|pdf|csv|json|txt)-([A-Za-z0-9+/=]+)$/);
        if (!m) return;
        const ext = m[1];
        const b64 = m[2];
        const mime: Record<string, string> = {
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          pdf: 'application/pdf', csv: 'text/csv', json: 'application/json', txt: 'text/plain',
        };
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime[ext] || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pl-plan-${new Date().toISOString().slice(0, 10)}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* ignore */ } }, 500);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (e) {
        console.warn('[App] auto-download failed:', e);
      }
    };
    applyDownload();
    window.addEventListener('hashchange', applyDownload);
    return () => window.removeEventListener('hashchange', applyDownload);
  }, []);

  // Свайпы между вкладками — хук useSwipeTabs выше (только APK).

  const renderContent = () => {
    if (!initialized) return <ScreenLoading />;

    const key = `screen-${tab}-${subTab || 'main'}-${screenKey}`;
    const content = (() => {
      switch (tab) {
        case 'home': return <DashboardScreen key={key} onNavigate={handleNavigate} />;
        case 'pharma': return <PharmaScreen key={key} initialSubTab={subTab || undefined} />;
        case 'support': return <SupportScreen key={key} onNavigate={handleNavigate} initialSubTab={subTab || undefined} />;
        case 'training': return <TrainingScreen key={key} initialSubTab={subTab || undefined} />;
        case 'labs': return <InfoErrorBoundary label="Лаборатория"><LabsScreen key={key} initialSubTab={subTab || undefined} /></InfoErrorBoundary>;
        case 'risks': return <RiskScreen key={key} onNavigate={handleNavigate} initialSubTab={subTab || undefined} />;
        case 'nutrition': return <NutritionScreen key={key} initialSubTab={subTab || undefined} />;
        case 'marketplace': return <MarketplaceScreen key={key} />;
        case 'profile': return <ProfileScreen_v2 key={key} onNavigate={handleNavigate} initialSubTab={subTab || undefined} />;
        case 'articles': return <ArticlesScreen key={key} />;
        default: return <DashboardScreen key={key} onNavigate={handleNavigate} />;
      }
    })();
    // Ленивый экран может отдать чанк не сразу — показываем тот же скелет,
    // что и на старте, а не пустоту.
    return <Suspense fallback={<ScreenLoading />}>{content}</Suspense>;
  };

  return (
    <div className="app" >
      <DarkBg />
      <main ref={mainRef} style={{ position: 'relative', zIndex: 1, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <HeroImg webp="/bg-profile.webp" src="/bg-profile.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'fill', zIndex:0, pointerEvents:'none', opacity:0.3 }} />
<div className={slideDir ? `tab-slide-${slideDir}` : undefined} style={{ position:'relative', zIndex:1, flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Sync + locale toggles (top-right) */}
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1000, display: 'flex', gap: 6 }}>
            <KvSyncButton />
            <button
              onClick={() => setLocale(getLocale() === 'ru' ? 'en' : 'ru')}
              style={{
                padding: '6px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(96,165,250,0.12)',
                border: '1px solid rgba(96,165,250,0.25)',
                color: '#60a5fa',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                whiteSpace: 'nowrap',
              }}
              title={getLocale() === 'ru' ? 'Switch to English' : 'Переключить на русский'}
            >
              {getLocale() === 'ru' ? 'EN' : 'RU'}
            </button>
          </div>
          {/* Пока открыто пространство атлета — полоса предупреждения сверху. */}
          <DataSpaceBanner />
          <KvErrorBanner />
          {renderContent()}
        </div>
      </main>
      <ToastContainer />
      <KvUpdateBanner />
      {appLocked && <NativeAppLock onUnlocked={() => setAppLocked(false)} />}
      {/* FAB быстрой записи — ТОЛЬКО APK (в TG/web ветка не монтируется). */}
      {isNativeApp() && !appLocked && initialized && (
        <NativeFab onQuickLog={() => go('training', 'diary')} />
      )}
      {/* Офлайн-пилюля — ТОЛЬКО APK (в TG/web ветка не монтируется). */}
      {isNativeApp() && !appLocked && initialized && <NativeOfflinePill />}
      <nav className="tabs" aria-label="Основная навигация">
        {PRIMARY_NAV.map(item => (
          <button
            key={item.id}
            data-tab={item.id}
            data-badge={navBadges[item.id] ?? ''}
            aria-label={item.label}
            aria-current={tab === item.id ? 'page' : undefined}
            className={'nav-btn' + (tab === item.id ? ' active' : '')}
            onClick={() => go(item.id)}
            onMouseEnter={() => prefetchScreen(item.id)}
            onTouchStart={() => prefetchScreen(item.id)}
            onFocus={() => prefetchScreen(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
