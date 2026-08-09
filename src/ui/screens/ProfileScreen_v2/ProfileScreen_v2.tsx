/**
 * ProfileScreen_v2 — новый экран Профиля.
 * Hero (4 карточки) + 4 вкладки (Пользователь / Тренировки / Дневники / Настройки / Отчёты).
 * Auto-save внутри вкладок через debounce 500мс.
 */
import React, { useState, useEffect } from 'react';
import { ProfileHero } from './ProfileHero';
import { ProfileUserTab } from './ProfileUserTab';
import { ProfileDiariesTab } from './ProfileDiariesTab';
import { ProfileSettingsTab } from './ProfileSettingsTab';
import { ReportsScreen } from '../ReportsScreen';
import { useProfileRefresh, getSnapshots, undoLastSnapshot } from '../../../core/profile-manager';
import { onAnyProfileChange } from '../../../core/profile-events';
import { colors } from './ui';

class ProfileErrorBoundary extends React.Component<
  { children: React.ReactNode; tabName: string },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('[ProfileErrorBoundary]', this.props.tabName, error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: colors.danger }}>
          <h3>Ошибка в вкладке "{this.props.tabName}"</h3>
          <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>
            {String(this.state.error)}
          </pre>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type Tab = 'user' | 'diaries' | 'settings' | 'reports';

const TAB_META: Record<Tab, { icon: string; title: string; color: string }> = {
  user: { icon: '👤', title: 'Пользователь', color: colors.primary },
  diaries: { icon: '📓', title: 'Дневники', color: colors.orange },
  settings: { icon: '⚙️', title: 'Настройки', color: colors.purple },
  reports: { icon: '📊', title: 'Отчёты', color: colors.blue },
};

export const ProfileScreen_v2: React.FC<{ onNavigate?: (screen: string) => void; initialSubTab?: string }> = ({ onNavigate, initialSubTab }) => {
  useProfileRefresh();
  const [tab, setTab] = useState<Tab | null>(null);
  const [undoAvailable, setUndoAvailable] = useState(false);

  // P1-fix (Aug 5 2026): при переходе из App — открываем конкретную вкладку дневника
  useEffect(() => {
    if (initialSubTab && (
      ['diaries', 'reports', 'archive', 'custom-report', 'sleep', 'bp', 'weight', 'injection'].includes(initialSubTab)
      || initialSubTab.endsWith('-reports')
    )) {
      setTab('diaries');
    }
    if (initialSubTab === 'reports' || initialSubTab === 'custom-report') {
      setTab('reports');
    }
  }, [initialSubTab]);

  // Подписка на event-bus вместо polling
  useEffect(() => {
    setUndoAvailable(getSnapshots().length > 0);
    const unsub = onAnyProfileChange(() => {
      setUndoAvailable(getSnapshots().length > 0);
    });
    return unsub;
  }, []);

  // Глобальный Ctrl+Z для undo (только вне input/textarea/select)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
          return; // Не перехватываем undo в текстовых полях
        }
        e.preventDefault();
        undoLastSnapshot();
        // Snapshots обновятся через onAnyProfileChange listener выше
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (tab === null) {
    return <ProfileHero onSelectTab={setTab} />;
  }

  const meta = TAB_META[tab];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Sticky-хедер вкладки — в стиле NutritionScreen */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexShrink: 0,
        background: '#18181b',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <button
          onClick={() => setTab(null)}
          aria-label="Назад к hero"
          style={{
            padding: '4px 8px', cursor: 'pointer', fontSize: 20, color: 'rgba(255,255,255,0.85)',
            border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', minHeight: 36,
          }}
        >←</button>
        <span aria-hidden="true" style={{ fontSize: 18 }}>{meta.icon}</span>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: -0.3 }}>
          {meta.title}
        </div>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>авто-сохранение</span>
        <UndoButton undoAvailable={undoAvailable} setUndoAvailable={setUndoAvailable} />
      </div>

      {/* Содержимое вкладки с прокруткой */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '0 8px 80px',
        scrollbarWidth: 'thin',
        scrollbarColor: `${colors.border} transparent`,
      }}>
         {tab === 'user' && <ProfileErrorBoundary tabName="Пользователь"><ProfileUserTab /></ProfileErrorBoundary>}
          {tab === 'diaries' && <ProfileErrorBoundary tabName="Дневники"><ProfileDiariesTab
            onNavigate={onNavigate}
            initialView={initialSubTab === 'reports' || initialSubTab === 'custom-report' ? 'reports' : initialSubTab === 'archive' ? 'archive' : 'diary'}
          /></ProfileErrorBoundary>}
         {tab === 'settings' && <ProfileErrorBoundary tabName="Настройки"><ProfileSettingsTab onNavigate={onNavigate} /></ProfileErrorBoundary>}
         {tab === 'reports' && <ProfileErrorBoundary tabName="Отчёты"><ReportsScreen /></ProfileErrorBoundary>}
      </div>
    </div>
  );
};

const UndoButton: React.FC<{ undoAvailable: boolean; setUndoAvailable: (v: boolean) => void }> = ({ undoAvailable, setUndoAvailable }) => {
  if (!undoAvailable) return null;
  return (
    <button
      onClick={() => { undoLastSnapshot(); setUndoAvailable(false); }}
      aria-label="Отменить последнее изменение (Ctrl+Z)"
      title="Отменить (Ctrl+Z)"
      style={{
        background: 'rgba(59,130,246,0.12)',
        border: '1px solid rgba(59,130,246,0.3)',
        color: colors.blue,
        padding: '6px 12px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        minHeight: 36,
        flexShrink: 0,
      }}
    >↩ Отменить</button>
  );
};
