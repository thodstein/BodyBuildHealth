/**
 * ProfileHero — главный экран Профиля.
 * Hero на весь экран, без стекла: картинка полностью видна, градиент только снизу 30%.
 * Вкладки внизу как в БАД-поддержке — с небольшой тенью 0 3px 12px.
 */
import React, { useEffect, useState } from 'react';
import { HeroImg } from '../../HeroImg';
import { useProfileRefresh, getSnapshotsCount, undoLastSnapshot } from '../../../core/profile-manager';
import { onAnyProfileChange } from '../../../core/profile-events';
import { isNativeApp } from '../../../core/app-platform';
import { NativeIcon, type NativeIconName } from '../../native/NativeIcons';
import { colors, withAlpha } from './ui';

interface TabDef {
  id: 'user' | 'diaries' | 'settings' | 'reports';
  icon: NativeIconName;
  label: string;
  desc: string;
  color: string;
}

const TABS: TabDef[] = [
  { id: 'user', icon: 'user', label: 'Пользователь', desc: 'Имя, параметры, образ жизни, курс, цели', color: colors.primary },
  { id: 'diaries', icon: 'notebook', label: 'Дневники', desc: 'Сон, давление, вес, замеры', color: colors.orange },
  { id: 'reports', icon: 'chart', label: 'Отчёты', desc: 'Комплексный отчёт для врача/тренера', color: colors.blue },
  { id: 'settings', icon: 'sliders', label: 'Настройки', desc: 'Единицы, уведомления, экспорт данных', color: colors.purple },
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

const GOAL_LABELS: Record<string, string> = {
  bulk: 'Набор', cut: 'Сушка', maintenance: 'Поддержка',
  strength: 'Сила', hypertrophy: 'Гипертрофия', rehab: 'Реабилитация',
  recomposition: 'Рекомпозиция', health: 'Здоровье',
};

export const ProfileHero: React.FC<{ onSelectTab: (id: TabDef['id']) => void }> = ({ onSelectTab }) => {
  const profile = useProfileRefresh();
  const settings = (profile.settings || {}) as any;
  const p = settings.personal || {};
  const tr = settings.training || {};
  const ph = settings.pharma || {};

  const [completeness, setCompleteness] = useState(0);
  const [undoAvailable, setUndoAvailable] = useState(false);

  useEffect(() => {
    setCompleteness(calcCompleteness(settings));
  }, [settings]);

  useEffect(() => {
    const refresh = () => setUndoAvailable(getSnapshotsCount() > 0);
    refresh();
    const unsub = onAnyProfileChange(refresh);
    return unsub;
  }, []);

  const sexIcon = p.sex === 'female' ? '♀' : (p.sex === 'male' ? '♂' : '');

  const parts: string[] = [];
  if (p.age) parts.push(`${p.age} лет`);
  if (p.weight) parts.push(`${p.weight} кг`);
  if (p.bodyFat) parts.push(`${p.bodyFat}% жира`);
  const goalLabel = tr.primaryGoal ? GOAL_LABELS[tr.primaryGoal] : '';

  const phaseBadge = ph.phase === 'course' ? { label: 'КУРС', color: colors.warning } : null;
  const filled = Math.round((completeness / 100) * 12);
  const initials = (profile.name || 'П')
    .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || 'П';
  const bmi = p.weight && p.height && p.height > 0
    ? (p.weight / Math.pow(p.height / 100, 2)).toFixed(1) : null;
  const barColor = completeness < 50 ? colors.danger : completeness < 80 ? colors.warning : 'var(--profile-accent, #34d399)';

  return (
    <div className="profile-hero pf-hero" data-complete={filled} style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
      <HeroImg
        webp="/profile-hero.webp"
        src="/profile-hero.png"
        alt="Profile"
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
      <div className="pf-hero-shade" style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 52%, rgba(0,0,0,0.22) 68%, rgba(0,0,0,0.62) 84%, rgba(0,0,0,0.86) 100%)' }} />
      <div className="pf-hero-body" style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'calc(12px + env(safe-area-inset-top,0px)) 14px calc(64px + env(safe-area-inset-bottom,0px))', gap:12, overflowY:'auto' }}>
        {/* ── Профиль-карта: аватар + имя + бейджи ── */}
        <div className="pf-hero-profile" style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div aria-hidden="true" style={{ width:56, height:56, borderRadius:18, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:900, letterSpacing:'-0.5px', color:'#06231a', background:'linear-gradient(135deg, var(--profile-accent, #34d399), #22c55e)', border:'1px solid rgba(255,255,255,0.25)', boxShadow:'0 8px 24px rgba(52,211,153,0.35), inset 0 1px 0 rgba(255,255,255,0.4)' }}>{initials}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 9px', borderRadius:20, background:'rgba(0,0,0,0.45)', border:'1px solid rgba(52,211,153,0.3)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', color:'var(--profile-accent, #34d399)', fontSize:9, fontWeight:800, letterSpacing:'1.2px' }}>
              <span style={{ width:6, height:6, borderRadius:6, background:'var(--profile-accent, #34d399)', boxShadow:'0 0 10px rgba(52,211,153,0.8)', display:'inline-block' }} /> ПРОФИЛЬ
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6, flexWrap:'wrap' }}>
              <span className="profile-hero-name" style={{ fontSize:24, fontWeight:900, color:'#fff', textShadow:'0 2px 14px rgba(0,0,0,0.9)', letterSpacing:'-0.6px', lineHeight:1 }}>{profile.name || 'Профиль'}</span>
              {sexIcon && <span style={{ fontSize:16, color:'var(--profile-accent, #34d399)' }}>{sexIcon}</span>}
              {phaseBadge && (
                <span style={{ fontSize:9, fontWeight:800, padding:'4px 9px', borderRadius:20, background:'linear-gradient(135deg,#f59e0b,#f97316)', color:'#0a0a0a', boxShadow:'0 4px 14px rgba(245,158,11,0.4)' }}>{phaseBadge.label}</span>
              )}
              {undoAvailable && (
                <button
                  onClick={() => { undoLastSnapshot(); setUndoAvailable(getSnapshotsCount() > 0); }}
                  title="Отменить последнее изменение"
                  aria-label="Отменить последнее изменение"
                  style={{ marginLeft:'auto', background:'rgba(0,0,0,0.45)', border:'1px solid rgba(59,130,246,0.4)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', color:'#fff', padding:'10px 14px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', minHeight:44, minWidth:44, flexShrink:0 }}
                >↩</button>
              )}
            </div>
            {(parts.length > 0 || goalLabel) && (
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.92)', marginTop:5, textShadow:'0 1px 8px rgba(0,0,0,0.8)', lineHeight:1.4, fontWeight:500 }}>
                {parts.join(' · ')}{parts.length > 0 && goalLabel ? ' · ' : ''}{goalLabel}
              </div>
            )}
          </div>
        </div>
        {/* ── Стекло: прогресс + быстрые статы ── */}
        <div className="pf-hero-glass" style={{ borderRadius:18, padding:'12px 14px', background:'rgba(14,14,16,0.62)', border:'1px solid rgba(255,255,255,0.12)', backdropFilter:'blur(20px) saturate(160%)', WebkitBackdropFilter:'blur(20px) saturate(160%)', boxShadow:'0 12px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:10, fontWeight:800, letterSpacing:'1px', color:'rgba(255,255,255,0.6)' }}>ЗАПОЛНЕНИЕ</span>
                <span style={{ fontSize:13, color:'#fff', fontWeight:800, fontVariantNumeric:'tabular-nums' }}>{completeness}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={completeness}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Профиль заполнен на ${completeness}%`}
                className="profile-hero-progress"
                style={{ height:8, borderRadius:99, background:'rgba(255,255,255,0.08)', overflow:'hidden', boxShadow:'inset 0 1px 3px rgba(0,0,0,0.4)' }}
              >
                <div style={{ width:`${completeness}%`, height:'100%', borderRadius:99, background:`linear-gradient(90deg, ${barColor}, ${barColor}cc)`, boxShadow:`0 0 12px ${barColor}66`, transition:'width 0.4s cubic-bezier(0.2,0.9,0.3,1)' }} />
              </div>
            </div>
            {(bmi || p.bodyFat) && (
              <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                {bmi && (
                  <div style={{ textAlign:'center', padding:'6px 12px', borderRadius:12, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize:15, fontWeight:800, color:'#fff', fontVariantNumeric:'tabular-nums' }}>{bmi}</div>
                    <div style={{ fontSize:8.5, fontWeight:700, letterSpacing:'0.8px', color:'rgba(255,255,255,0.55)' }}>ИМТ</div>
                  </div>
                )}
                {typeof p.bodyFat === 'number' && p.bodyFat > 0 && (
                  <div style={{ textAlign:'center', padding:'6px 12px', borderRadius:12, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize:15, fontWeight:800, color:'#fff', fontVariantNumeric:'tabular-nums' }}>{p.bodyFat}%</div>
                    <div style={{ fontSize:8.5, fontWeight:700, letterSpacing:'0.8px', color:'rgba(255,255,255,0.55)' }}>ЖИР</div>
                  </div>
                )}
              </div>
            )}
          </div>
          {filled < 8 && (
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.85)', textAlign:'left', marginTop:8, lineHeight:1.4 }}>
              {filled === 0 ? '👋 Заполните основное в карточке «Пользователь»' : `Заполнено ${filled}/12 ключевых полей — продолжите ниже.`}
            </div>
          )}
          {isNativeApp() && filled < 12 && (
            <div className="pf-hero-cta-row" style={{ display:'flex', justifyContent:'stretch', marginTop:10 }}>
              <button
                type="button"
                onClick={() => onSelectTab('user')}
                className="profile-hero-cta pf-hero-cta"
                style={{
                  flex:1, padding:'12px 18px', borderRadius:16, border:'1px solid rgba(255,255,255,0.2)', cursor:'pointer',
                  fontSize:13, fontWeight:900, letterSpacing:'-0.1px',
                  color:'#06231a',
                  background:'linear-gradient(135deg, var(--accent, #c9f73a), var(--accent-2, #00e68a))',
                  boxShadow:'0 10px 28px rgba(201,247,58,0.35), inset 0 1px 0 rgba(255,255,255,0.5)',
                  minHeight:52,
                }}
              >✨ Дозаполнить профиль →</button>
            </div>
          )}
        </div>

        <div role="navigation" aria-label="Разделы профиля" className="profile-hero-nav pf-hero-nav" style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {TABS.map(t => (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectTab(t.id)}
              className="profile-hero-card pf-hero-card"
              data-id={t.id}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectTab(t.id); }}}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 14px', borderRadius:18, cursor:'pointer', textAlign:'left', width:'100%', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07)', background:'rgba(14,14,16,0.66)', backdropFilter:'blur(20px) saturate(160%)', WebkitBackdropFilter:'blur(20px) saturate(160%)', transition:'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease' }}
            >
              <div aria-hidden="true" style={{ width:46, height:46, borderRadius:15, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:`linear-gradient(135deg, ${withAlpha(t.color, '30')}, ${withAlpha(t.color, '10')})`, border:`1px solid ${withAlpha(t.color, '35')}`, fontSize:18, boxShadow:`0 4px 14px ${withAlpha(t.color, '25')}, inset 0 1px 0 rgba(255,255,255,0.15)`, position:'relative', color:t.color }}><NativeIcon name={t.icon} size={21} /></div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:800, marginBottom:3, color:'#fff', letterSpacing:'-0.2px', lineHeight:1.2 }}>{t.label}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', lineHeight:1.35 }}>{t.desc}</div>
              </div>
              <span aria-hidden="true" style={{ width:32, height:32, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', background:`linear-gradient(135deg, ${withAlpha(t.color, '22')}, ${withAlpha(t.color, '08')})`, border:`1px solid ${withAlpha(t.color, '25')}`, color:t.color, fontSize:14, flexShrink:0, fontWeight:800 }}>→</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize:9.5, color:'rgba(255,255,255,0.6)', textAlign:'center', lineHeight:1.3, letterSpacing:'0.3px' }}>Авто-сохранение включено · данные только на устройстве</div>
      </div>
    </div>
  );
};
