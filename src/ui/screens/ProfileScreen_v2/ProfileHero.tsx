/**
 * ProfileHero — главный экран Профиля.
 * Hero на весь экран, без стекла: картинка полностью видна, градиент только снизу 30%.
 * Вкладки внизу как в БАД-поддержке — с небольшой тенью 0 3px 12px.
 */
import React, { useEffect, useState } from 'react';
import { useProfileRefresh, getSnapshotsCount, undoLastSnapshot } from '../../../core/profile-manager';
import { onAnyProfileChange } from '../../../core/profile-events';
import { colors } from './ui';

interface TabDef {
  id: 'user' | 'diaries' | 'settings' | 'reports';
  icon: string;
  label: string;
  desc: string;
  color: string;
}

const TABS: TabDef[] = [
  { id: 'user', icon: '👤', label: 'Пользователь', desc: 'Имя, параметры, образ жизни, курс, цели', color: colors.primary },
  { id: 'diaries', icon: '📓', label: 'Дневники', desc: 'Сон, давление, вес, замеры', color: colors.orange },
  { id: 'reports', icon: '📊', label: 'Отчёты', desc: 'Комплексный отчёт для врача/тренера', color: colors.blue },
  { id: 'settings', icon: '⚙️', label: 'Настройки', desc: 'Единицы, уведомления, экспорт данных', color: colors.purple },
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

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
      <img
        src="/profile-hero.png"
        alt="Profile"
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 62%, rgba(0,0,0,0.18) 76%, rgba(0,0,0,0.58) 88%, rgba(0,0,0,0.78) 100%)' }} />
      <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'12px 12px calc(64px + env(safe-area-inset-bottom,0px))', gap:10, overflowY:'auto' }}>
        <div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 8px', borderRadius:20, background:'rgba(0,230,138,0.14)', border:'1px solid rgba(0,230,138,0.22)', color:'#00e68a', fontSize:9, fontWeight:800, letterSpacing:'0.4px' }}>
            <span style={{ width:5, height:5, borderRadius:5, background:'#00e68a', boxShadow:'0 0 8px rgba(0,230,138,0.6)', display:'inline-block' }} /> ПРОФИЛЬ
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:22, fontWeight:900, color:'#fff', textShadow:'0 2px 12px rgba(0,0,0,0.9)', letterSpacing:'-0.6px', lineHeight:1 }}>{profile.name || 'Профиль'}</span>
            {sexIcon && <span style={{ fontSize:16, color:colors.primary }}>{sexIcon}</span>}
            {phaseBadge && (
              <span style={{ fontSize:9, fontWeight:800, padding:'3px 7px', borderRadius:20, background:phaseBadge.color+'cc', color:'#0a0a0a' }}>{phaseBadge.label}</span>
            )}
            {undoAvailable && (
              <button
                onClick={() => { undoLastSnapshot(); setUndoAvailable(getSnapshotsCount() > 0); }}
                title="Отменить последнее изменение"
                aria-label="Отменить последнее изменение"
                style={{ marginLeft:'auto', background:'rgba(59,130,246,0.18)', border:'1px solid rgba(59,130,246,0.28)', color:'#fff', padding:'4px 10px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', minHeight:28, flexShrink:0 }}
              >↩</button>
            )}
          </div>
          {(parts.length > 0 || goalLabel) && (
            <div style={{ fontSize:11, color:'#fff', marginTop:4, textShadow:'0 1px 6px rgba(0,0,0,0.8)', lineHeight:1.3 }}>
              {parts.join(' · ')}{parts.length > 0 && goalLabel ? ' · ' : ''}{goalLabel}
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
            <div
              role="progressbar"
              aria-valuenow={completeness}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Профиль заполнен на ${completeness}%`}
              style={{ flex:1, height:6, borderRadius:3, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}
            >
              <div style={{ width:`${completeness}%`, height:'100%', background: completeness < 50 ? colors.danger : completeness < 80 ? colors.warning : colors.primary, transition:'width 0.3s' }} />
            </div>
            <span style={{ fontSize:11, color:'#fff', fontWeight:600, minWidth:32, textAlign:'right' }}>{completeness}%</span>
          </div>
          {filled < 8 && (
            <div style={{ fontSize:11, color:'#fff', textAlign:'center', marginTop:6, lineHeight:1.3 }}>
              {filled === 0 ? '👇 Заполните основное в карточке "Пользователь"' : `Заполнено ${filled}/12 ключевых полей. Можно дополнить ниже.`}
            </div>
          )}
        </div>

        <div role="navigation" aria-label="Разделы профиля" style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {TABS.map(t => (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectTab(t.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectTab(t.id); }}}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform='translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.borderColor=`${t.color}40`; (e.currentTarget as HTMLDivElement).style.boxShadow=`0 6px 18px rgba(0,0,0,0.32), 0 0 0 1px ${t.color}18 inset`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform='translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor='rgba(255,255,255,0.12)'; (e.currentTarget as HTMLDivElement).style.boxShadow='0 3px 12px rgba(0,0,0,0.30)'; }}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 3px 12px rgba(0,0,0,0.30)', background:'rgba(18,18,20,0.62)', transition:'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease' }}
            >
              <div aria-hidden="true" style={{ width:38, height:38, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:`linear-gradient(135deg, ${t.color}22, ${t.color}10)`, border:`1px solid ${t.color}28`, fontSize:18, boxShadow:`0 3px 10px ${t.color}20`, position:'relative' }}>{t.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:800, marginBottom:2, color:'#fff', letterSpacing:'-0.2px', lineHeight:1.2 }}>{t.label}</div>
                <div style={{ fontSize:10.5, color:'#fff', lineHeight:1.3 }}>{t.desc}</div>
              </div>
              <span aria-hidden="true" style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:`${t.color}12`, border:`1px solid ${t.color}18`, color:t.color, fontSize:13, flexShrink:0, fontWeight:700 }}>→</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize:9, color:'#fff', textAlign:'center', lineHeight:1.3 }}>Авто-сохранение · профиль</div>
      </div>
    </div>
  );
};
