/**
 * ProfileScreen_v2 — новый экран Профиля.
 * Hero (4 карточки) + 4 вкладки (Пользователь / Тренировки / Дневники / Настройки / Отчёты).
 * Auto-save внутри вкладок через debounce 500мс.
 */
import React, { useState, useEffect } from 'react';
import { ProfileHero } from './ProfileHero';
import { ProfileUserTab } from './ProfileUserTab';
import { ProfileDiariesTab } from './ProfileDiariesTab';
import { ProfileReportsTab } from './ProfileReportsTab';
import { ProfileSettingsTab } from './ProfileSettingsTab';
import { useProfileRefresh, getSnapshotsCount, undoLastSnapshot } from '../../../core/profile-manager';
import { onAnyProfileChange } from '../../../core/profile-events';
import { colors } from './ui';
import { NativeIcon, type NativeIconName } from '../../native/NativeIcons';

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

const TAB_META: Record<Tab, { icon: NativeIconName; title: string; color: string }> = {
  user: { icon: 'user', title: 'Пользователь', color: colors.primary },
  diaries: { icon: 'notebook', title: 'Дневники', color: colors.orange },
  settings: { icon: 'sliders', title: 'Настройки', color: colors.purple },
  reports: { icon: 'chart', title: 'Отчёты', color: colors.blue },
};

export const ProfileScreen_v2: React.FC<{ onNavigate?: (screen: string) => void; initialSubTab?: string }> = ({ onNavigate, initialSubTab }) => {
  useProfileRefresh();
  const [tab, setTab] = useState<Tab | null>(null);
  const [undoAvailable, setUndoAvailable] = useState(false);

  // P1-fix (Aug 5 2026): при переходе из App — открываем конкретную вкладку дневника
  useEffect(() => {
    if (initialSubTab === 'reports' || initialSubTab === 'custom-report' || initialSubTab === 'archive') {
      setTab('reports');
    } else if (
      initialSubTab &&
      (['diaries', 'sleep', 'bp', 'weight', 'injection', 'measurements', 'cardio'].includes(initialSubTab) ||
        initialSubTab.endsWith('-reports'))
    ) {
      setTab('diaries');
    }
  }, [initialSubTab]);

  // Подписка на event-bus вместо polling
  useEffect(() => {
    setUndoAvailable(getSnapshotsCount() > 0);
    const unsub = onAnyProfileChange(() => {
      setUndoAvailable(getSnapshotsCount() > 0);
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
  const tabs = (Object.keys(TAB_META) as Tab[]);

  return (
    <div className="profile-inner pf-inner" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 120px)', minHeight: 0 }}>
      {/* Sticky-хедер вкладки — современный APK */}
      <div className="profile-head pf-head" style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', flexShrink: 0,
        background: 'rgba(16,16,18,0.85)',
        backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <button
          onClick={() => setTab(null)}
          aria-label="Назад к hero"
          className="pf-head-back"
          style={{
            padding: 0, cursor: 'pointer', fontSize: 17, color: '#fff',
            border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 44, minWidth: 44, borderRadius: 13,
          }}
        >←</button>
        <span aria-hidden="true" style={{ width:36, height:36, borderRadius:12, display:'inline-flex', alignItems:'center', justifyContent:'center', color:meta.color, background:`linear-gradient(135deg, ${meta.color}2e, ${meta.color}0d)`, border:`1px solid ${meta.color}44`, flexShrink:0 }}><NativeIcon name={meta.icon} size={18} /></span>
        <div style={{ flex: 1, minWidth:0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: -0.3, lineHeight:1.15 }}>
            {meta.title}
          </div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', fontWeight:600, letterSpacing:'0.4px', marginTop:1 }}>АВТО-СОХРАНЕНИЕ ВКЛЮЧЕНО</div>
        </div>
        <UndoButton undoAvailable={undoAvailable} setUndoAvailable={setUndoAvailable} />
      </div>
      {/* Поднавигация по разделам профиля — без возврата в hero */}
      <div className="pf-subnav" role="navigation" aria-label="Разделы профиля" style={{
        display: 'flex', gap: 8, padding: '10px 12px', flexShrink: 0,
        overflowX: 'auto', scrollbarWidth: 'none',
        background: 'rgba(16,16,18,0.85)', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {tabs.map(t => {
          const m = TAB_META[t];
          const active = t === tab;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-label={`Раздел ${m.title}`}
              aria-current={active ? 'page' : undefined}
              data-active={active}
              className="pf-subnav-btn"
              style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 15px', borderRadius: 999, cursor: 'pointer',
                fontSize: 12.5, fontWeight: 800, minHeight: 44, whiteSpace: 'nowrap',
                border: `1px solid ${active ? m.color : 'rgba(255,255,255,0.10)'}`,
                background: active ? `linear-gradient(135deg, ${m.color}30, ${m.color}12)` : 'rgba(255,255,255,0.04)',
                color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                boxShadow: active ? `0 4px 16px ${m.color}33, inset 0 1px 0 rgba(255,255,255,0.12)` : 'none',
              }}
            >
              <span aria-hidden="true" style={{ display: 'inline-flex', color: active ? m.color : 'rgba(255,255,255,0.6)' }}>
                <NativeIcon name={m.icon} size={14} />
              </span>
              {m.title}
            </button>
          );
        })}
      </div>

      {/* Содержимое вкладки с прокруткой */}
      <div className="profile-body" style={{
        flex: '1 1 0',
        height: 0,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '12px 12px 96px',
        scrollbarWidth: 'thin',
        scrollbarColor: `${colors.border} transparent`,
        WebkitOverflowScrolling: 'touch',
        background: 'radial-gradient(120% 40% at 50% 0%, rgba(52,211,153,0.06), transparent 70%)',
      }}>
         {tab === 'user' && <ProfileErrorBoundary tabName="Пользователь"><ProfileUserTab /></ProfileErrorBoundary>}
          {tab === 'diaries' && <ProfileErrorBoundary tabName="Дневники"><ProfileDiariesTab
            onNavigate={onNavigate}
            initialView={initialSubTab === 'sleep' || initialSubTab === 'bp' || initialSubTab === 'weight' || initialSubTab === 'measurements' ? (initialSubTab as 'sleep' | 'bp' | 'weight' | 'measurements') : 'diary'}
          /></ProfileErrorBoundary>}
         {tab === 'settings' && <ProfileErrorBoundary tabName="Настройки"><ProfileSettingsTab onNavigate={onNavigate} /></ProfileErrorBoundary>}
         {tab === 'reports' && <ProfileErrorBoundary tabName="Отчёты"><ProfileReportsTab
            onNavigate={onNavigate}
            initialView={initialSubTab === 'archive' ? 'archive' : initialSubTab === 'custom-report' ? 'comprehensive' : initialSubTab === 'reports' ? 'blocks' : undefined}
          /></ProfileErrorBoundary>}
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
        className="pf-undo"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(59,130,246,0.10))',
          border: '1px solid rgba(59,130,246,0.4)',
          color: '#fff',
          padding: '8px 14px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 800,
          cursor: 'pointer',
          minHeight: 44,
          flexShrink: 0,
        }}
      >↩ Отменить</button>
  );
};