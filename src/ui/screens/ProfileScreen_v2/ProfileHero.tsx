/**
 * ProfileHero — главный экран Профиля.
 * Компактная сводка + 4 крупные карточки вкладок.
 */
import React, { useState, useEffect } from 'react';
import { useProfileRefresh, getProfile, getSnapshots, undoLastSnapshot } from '../../../core/profile-manager';
import { colors, glassCard } from './ui';

interface TabDef {
  id: 'user' | 'training' | 'diaries' | 'settings';
  icon: string;
  title: string;
  short: string;
  color: string;
}

const TABS: TabDef[] = [
  { id: 'user', icon: '👤', title: 'Пользователь', short: 'Личные, здоровье, питание, образ жизни, курс, цели', color: colors.primary },
  { id: 'training', icon: '🏋️', title: 'Тренировки', short: 'Профиль, ПМ, workMax, слабые группы, оборудование', color: colors.blue },
  { id: 'diaries', icon: '📓', title: 'Дневники', short: 'Все дневники + быстрый доступ к отчётам из других блоков', color: colors.orange },
  { id: 'settings', icon: '⚙️', title: 'Настройки', short: 'Системные, контакты, экспорт/импорт, сброс', color: colors.purple },
];

function calcCompleteness(s: any): number {
  if (!s) return 0;
  const checks = [
    s.personal?.age, s.personal?.sex, s.personal?.height, s.personal?.weight,
    s.training?.primaryGoal, s.training?.level, s.training?.daysPerWeek,
    s.lifestyle?.sleepHours, s.lifestyle?.stressLevel,
    s.health?.bpStage,
    s.nutrition?.dietType, s.nutrition?.proteinPerKg,
    s.goals?.primaryGoal,
  ];
  const filled = checks.filter(v => v !== undefined && v !== null && v !== '').length;
  return Math.round((filled / checks.length) * 100);
}

export const ProfileHero: React.FC<{ onSelectTab: (id: TabDef['id']) => void }> = ({ onSelectTab }) => {
  const profile = useProfileRefresh();
  const settings = (profile.settings || {}) as any;
  const p = settings.personal || {};
  const tr = settings.training || {};
  const ls = settings.lifestyle || {};
  const goals = settings.goals || {};
  const ph = settings.pharma || {};

  const [completeness, setCompleteness] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [undoAvailable, setUndoAvailable] = useState(false);

  useEffect(() => {
    setCompleteness(calcCompleteness(settings));
  }, [settings]);

  useEffect(() => {
    const onChange = () => {
      setLastSaved(new Date());
      setUndoAvailable(getSnapshots().length > 0);
    };
    window.addEventListener('storage', onChange);
    const interval = setInterval(() => {
      setUndoAvailable(getSnapshots().length > 0);
    }, 1000);
    return () => {
      window.removeEventListener('storage', onChange);
      clearInterval(interval);
    };
  }, []);

  const initials = (profile.name || 'П').charAt(0).toUpperCase();
  const sexIcon = p.sex === 'female' ? '♀' : '♂';
  const ageStr = p.age ? `${p.age} лет` : '—';
  const weightStr = p.weight ? `${p.weight}кг / ${p.bodyFat || '—'}%` : '';
  const goalLabel = ({
    bulk: 'Набор', cut: 'Сушка', maintenance: 'Поддержка',
    strength: 'Сила', hypertrophy: 'Гипертрофия', rehab: 'Реабилитация',
    recomposition: 'Рекомпозиция', health: 'Здоровье',
  } as Record<string, string>)[tr.primaryGoal] || '—';

  const phaseBadge = ph.phase === 'course' ? { label: 'КУРС', color: colors.warning } : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '60vh' }}>
      {/* Шапка с краткой сводкой */}
      <div style={{
        ...glassCard,
        background: 'rgba(0,230,138,0.06)',
        border: `1px solid ${colors.primary}33`,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
        padding: 20,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.blue})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 800, color: '#0a0a0a',
        }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>
              {profile.name || 'Профиль'}
            </span>
            {p.sex && <span style={{ fontSize: 16 }}>{sexIcon}</span>}
            {phaseBadge && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                background: `${phaseBadge.color}22`, color: phaseBadge.color,
              }}>{phaseBadge.label}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ageStr && <span>{ageStr}</span>}
            {weightStr && <span>· {weightStr}</span>}
            <span>· {goalLabel}</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              flex: 1, height: 6, borderRadius: 3,
              background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${completeness}%`, height: '100%',
                background: completeness < 30 ? colors.danger : completeness < 70 ? colors.warning : colors.primary,
                transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
              {completeness}%
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 10, color: colors.textSubtle }}>
            {lastSaved && <span>✓ Сохранено: {lastSaved.toLocaleTimeString('ru')}</span>}
            {undoAvailable && (
              <button
                onClick={() => { undoLastSnapshot(); setUndoAvailable(getSnapshots().length > 0); }}
                style={{
                  background: 'transparent', border: 'none', color: colors.blue,
                  cursor: 'pointer', padding: 0, fontSize: 10, textDecoration: 'underline',
                }}
              >↩ Отменить</button>
            )}
          </div>
          <div style={{ fontSize: 10, color: colors.textSubtle, marginTop: 6, textAlign: 'center' }}>
            {completeness < 50 && (
              <span style={{ color: colors.warning }}>⚠ Заполните профиль для точных расчётов ({completeness}%)</span>
            )}
            {completeness >= 50 && completeness < 80 && (
              <span style={{ color: colors.textMuted }}>Можно дополнить: {completeness}%</span>
            )}
            {completeness >= 80 && (
              <span style={{ color: colors.primary }}>✓ Профиль заполнен ({completeness}%)</span>
            )}
          </div>
        </div>
      </div>

      {/* Растягиваемый спейсер чтобы прижать карточки вниз */}
      <div style={{ flex: 1 }} />

      {/* 4 карточки вкладок — горизонтально внизу */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        padding: '12px 0 0 0',
        position: 'sticky',
        bottom: 0,
        background: 'rgba(28,28,32,0.95)',
        backdropFilter: 'blur(8px)',
        paddingTop: 12,
        paddingBottom: 8,
        zIndex: 10,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onSelectTab(t.id)}
            style={{
              ...glassCard,
              cursor: 'pointer',
              border: `1px solid ${t.color}33`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              minHeight: 100,
              textAlign: 'center',
              color: colors.text,
              transition: 'all 0.2s',
              padding: 12,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLElement).style.borderColor = t.color;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLElement).style.borderColor = `${t.color}33`;
            }}
          >
            <span style={{ fontSize: 28, lineHeight: 1 }}>{t.icon}</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.color }}>{t.title}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
