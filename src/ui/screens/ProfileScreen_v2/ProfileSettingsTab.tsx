/**
 * ProfileSettingsTab — вкладка "Настройки" + контакты + экспорт/импорт + сброс.
 * Использует PopupValueEditor для ввода значений через попап.
 */
import React, { useState } from 'react';
import { useProfileRefresh, updateProfile, clearSnapshots } from '../../../core/profile-manager';
import type { UnifiedSettings } from '../../../core/types';
import { AccordionSection, FieldRow, PopupValueEditor, BoolChip, colors } from './ui';
import { NativeIcon } from '../../native/NativeIcons';
import { isNativeApp } from '../../../core/app-platform';
import { WidgetsSetupCard } from '../../../ui/native/WidgetsSetupCard';
import { AppearanceSetupCard } from '../../../ui/native/AppearanceSetupCard';
import { BiometrySetupCard } from '../../../ui/native/BiometrySetupCard';
import { NativeFeaturesCard } from '../../../ui/native/NativeFeaturesCard';
import { copyOrShareText, saveTextFileApk, shareOutcomeLabel } from '../../../core/apk-share';

const PRIVACY = [
  { id: 'private', label: 'Только я' },
  { id: 'friends', label: 'Друзья' },
  { id: 'public', label: 'Публичные' },
];
const UNITS = [
  { id: 'metric', label: 'Метрические (кг, см)' },
  { id: 'imperial', label: 'Имперские (фунты, дюймы)' },
];
const MC_RUNS = [
  { id: '500', label: '500' },
  { id: '1000', label: '1000' },
  { id: '5000', label: '5000' },
  { id: '10000', label: '10000' },
];

export const ProfileSettingsTab: React.FC<{ onNavigate?: (screen: string) => void }> = ({ onNavigate }) => {
  const profile = useProfileRefresh();
  const settings = (profile.settings || {}) as any;
  const [system, setSystem] = useState<UnifiedSettings['system']>(settings.system || {
    mcRuns: 0, forceNoLabsPenalty: false, preferredUnits: 'metric', notificationsEnabled: false,
    privacyLevel: 'private', nutritionFactor: 1, trainingFactor: 1,
    hasHIIT: false, volumeTonnes: 0, lissMinutesPerWeek: 0,
  });

  React.useEffect(() => {
    setSystem(prev => ({ ...prev, ...(settings.system || {}) }));
  }, [settings.system]);

  const update = (patch: Partial<UnifiedSettings['system']>) => {
    // Берём свежие настройки из useProfileRefresh, чтобы избежать stale closure
    const cur = (profile.settings || {}) as any;
    const next = { ...(cur.system || {}), ...patch };
    setSystem(next);
    updateProfile({ settings: { ...cur, system: next } });
  };

  const toast = (msg: string) => {
    try { (window as any).showToast?.(msg); } catch {}
  };

  const handleExport = () => {
    try {
      const data = JSON.stringify(profile, null, 2);
      // АПК: <a download> в WebView не сохраняет — Documents + Share.
      void saveTextFileApk(`profile_backup_${new Date().toISOString().slice(0, 10)}.json`, data, 'application/json;charset=utf-8').then(o => toast(shareOutcomeLabel(o)));
    } catch (e) {
      toast('Ошибка экспорта: ' + (e as Error).message);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(String(ev.target?.result || '{}'));
          if (!data.settings) {
            alert('Файл не содержит профиль');
            return;
          }
          if (!confirm('Импортировать профиль? Текущие данные будут заменены.')) return;
          updateProfile(data);
          clearSnapshots();
          alert('✅ Профиль импортирован');
        } catch (err: any) {
          alert('Ошибка импорта: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleCopy = () => {
    try {
      const data = JSON.stringify(profile, null, 2);
      // АПК: clipboard в WebView ненадёжен — Share-диалог как основной путь.
      void copyOrShareText(data, 'Профиль').then(o => toast(shareOutcomeLabel(o)));
    } catch (e) {
      toast('Ошибка: ' + (e as Error).message);
    }
  };

  const handleReset = () => {
    if (!confirm('⚠ Сбросить профиль до дефолтных значений? Это действие необратимо.')) return;
    if (!confirm('Точно сбросить? Все данные будут потеряны.')) return;
    try {
      localStorage.removeItem('he_profile_v2');
      localStorage.removeItem('he_profile_snapshots_v1');
      window.location.reload();
    } catch (e) {
      alert('Ошибка: ' + (e as Error).message);
    }
  };

  const handleClearDiaries = () => {
    if (!confirm('Удалить все дневниковые записи (сон, АД, инъекции, замеры)?')) return;
    try {
      const DIARY_KEYS = ['he_weight_log', 'he_bp_diary', 'he_sleep_diary', 'he_injection_diary'];
      for (const k of DIARY_KEYS) localStorage.removeItem(k);
      alert('✅ Дневники очищены');
    } catch (e) {
      alert('Ошибка: ' + (e as Error).message);
    }
  };

  return (
    <div className="profile-settings" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AccordionSection
        title="4.1 Системные"
        subtitle="Единицы, уведомления, приватность"
        icon={<NativeIcon name="sliders" size={20} />}
        color={colors.blue}
      >
        <FieldRow cols={2}>
          <PopupValueEditor
            label="Единицы измерения"
            value={system.preferredUnits}
            type="select"
            options={UNITS}
            onChange={v => update({ preferredUnits: v as any })}
            placeholder="—"
          />
          <PopupValueEditor
            label="Приватность"
            value={system.privacyLevel}
            type="select"
            options={PRIVACY}
            onChange={v => update({ privacyLevel: v as any })}
            placeholder="—"
          />
          <PopupValueEditor
            label="Monte Carlo прогонов"
            value={system.mcRuns ? String(system.mcRuns) : undefined}
            type="select"
            options={MC_RUNS}
            onChange={v => update({ mcRuns: Number(v) })}
            placeholder="—"
          />
          <PopupValueEditor
            label="Имя пользователя"
            value={profile.name}
            type="text"
            onChange={v => updateProfile({ name: v })}
            placeholder="Имя"
          />
        </FieldRow>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <BoolChip
            label="Уведомления"
            checked={system.notificationsEnabled}
            onChange={v => update({ notificationsEnabled: v })}
            color={colors.primary}
          />
          <BoolChip
            label="Игнорировать штраф без анализов"
            checked={system.forceNoLabsPenalty}
            onChange={v => update({ forceNoLabsPenalty: v })}
            color={colors.warning}
          />
        </div>
      </AccordionSection>

      <AccordionSection
        title="4.2 Экспорт / Импорт"
        subtitle="Сохранить профиль в файл или восстановить из бэкапа"
        icon={<NativeIcon name="inbox" size={20} />}
        color={colors.primary}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <button onClick={handleExport} className="pf-set-btn" style={{
            ...btnStyle, borderColor: 'rgba(52,211,153,0.4)', color: '#fff', background: 'linear-gradient(135deg, rgba(52,211,153,0.22), rgba(52,211,153,0.07))',
          }}><span style={{ display:'inline-flex', width:30, height:30, borderRadius:10, alignItems:'center', justifyContent:'center', background:'rgba(52,211,153,0.18)', border:'1px solid rgba(52,211,153,0.35)', flexShrink:0 }}><NativeIcon name="share" size={14} /></span>Экспорт в файл</button>
          <button onClick={handleImport} className="pf-set-btn" style={{
            ...btnStyle, borderColor: 'rgba(59,130,246,0.4)', color: '#fff', background: 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(59,130,246,0.07))',
          }}><span style={{ display:'inline-flex', width:30, height:30, borderRadius:10, alignItems:'center', justifyContent:'center', background:'rgba(59,130,246,0.18)', border:'1px solid rgba(59,130,246,0.35)', flexShrink:0 }}><NativeIcon name="inbox" size={14} /></span>Импорт из файла</button>
          <button onClick={handleCopy} className="pf-set-btn" style={{
            ...btnStyle, borderColor: 'rgba(139,92,246,0.4)', color: '#fff', background: 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(139,92,246,0.07))',
          }}><span style={{ display:'inline-flex', width:30, height:30, borderRadius:10, alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.18)', border:'1px solid rgba(139,92,246,0.35)', flexShrink:0 }}><NativeIcon name="file" size={14} /></span>Копировать в буфер</button>
        </div>
      </AccordionSection>

      <AccordionSection
        title="4.3 Сброс"
        subtitle="Очистить кэши, дневники или весь профиль"
        icon={<NativeIcon name="trash" size={20} />}
        color={colors.danger}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <button onClick={handleClearDiaries} className="pf-set-btn" style={{
            ...btnStyle, borderColor: 'rgba(245,158,11,0.4)', color: '#fff', background: 'linear-gradient(135deg, rgba(245,158,11,0.20), rgba(245,158,11,0.06))',
          }}><span style={{ display:'inline-flex', width:30, height:30, borderRadius:10, alignItems:'center', justifyContent:'center', background:'rgba(245,158,11,0.16)', border:'1px solid rgba(245,158,11,0.35)', flexShrink:0 }}><NativeIcon name="trash" size={14} /></span>Очистить дневники</button>
          <button onClick={() => {
            clearSnapshots();
            alert('✅ Снимки истории очищены');
          }} className="pf-set-btn" style={{
            ...btnStyle, borderColor: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.04)',
          }}><span style={{ display:'inline-flex', width:30, height:30, borderRadius:10, alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', flexShrink:0 }}><NativeIcon name="clock" size={14} /></span>Очистить историю</button>
          <button onClick={handleReset} className="pf-set-btn pf-set-danger" style={{
            ...btnStyle, borderColor: 'rgba(239,68,68,0.45)', color: '#fff', background: 'linear-gradient(135deg, rgba(239,68,68,0.22), rgba(239,68,68,0.07))',
          }}><span style={{ display:'inline-flex', width:30, height:30, borderRadius:10, alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.16)', border:'1px solid rgba(239,68,68,0.4)', flexShrink:0 }}><NativeIcon name="alertTriangle" size={14} /></span>Сбросить профиль</button>
        </div>
      </AccordionSection>

      {/* 4.4 — только APK: виджеты, биометрия, возможности телефона.
          В Telegram Mini App этот раздел не рендерится вообще. */}
      {isNativeApp() && (
        <AccordionSection
          title="4.4 Телефон · APK"
          subtitle="Виджеты рабочего стола, биометрия, уведомления и камера"
          icon={<NativeIcon name="phone" size={20} />}
          color={colors.primary}
          id="phone-apk"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <AppearanceSetupCard />
            <WidgetsSetupCard />
            <BiometrySetupCard />
            <NativeFeaturesCard />
          </div>
        </AccordionSection>
      )}
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 15px',
  borderRadius: 16,
  fontSize: 13.5,
  fontWeight: 800,
  cursor: 'pointer',
  border: '1px solid',
  minHeight: 56,
  transition: 'all 0.2s',
  textAlign: 'left',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
};
