/**
 * ProfileSettingsTab — вкладка "Настройки" + контакты + экспорт/импорт + сброс.
 */
import React, { useState } from 'react';
import { useProfileRefresh, updateProfile, clearSnapshots } from '../../../core/profile-manager';
import type { UnifiedSettings } from '../../../core/types';
import { AccordionSection, Field, FieldRow, TextInput, SelectInput, BoolChip, colors } from './ui';

const PRIVACY = [
  { id: 'private', label: 'Только я' },
  { id: 'friends', label: 'Друзья' },
  { id: 'public', label: 'Публичные' },
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
    const next = { ...system, ...patch };
    setSystem(next);
    updateProfile({ settings: { ...settings, system: next } });
  };

  const handleExport = () => {
    try {
      const data = JSON.stringify(profile, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profile_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Ошибка экспорта: ' + (e as Error).message);
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
      navigator.clipboard?.writeText(data);
      alert('✅ Профиль скопирован в буфер обмена');
    } catch (e) {
      alert('Ошибка: ' + (e as Error).message);
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
      const DIARY_KEYS = ['he_weight_log', 'he_measurements_log', 'he_bp_diary', 'he_sleep_diary', 'he_injection_diary'];
      for (const k of DIARY_KEYS) localStorage.removeItem(k);
      alert('✅ Дневники очищены');
    } catch (e) {
      alert('Ошибка: ' + (e as Error).message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AccordionSection
        title="4.1 Системные"
        subtitle="Единицы, уведомления, приватность"
        icon="⚙️"
        color={colors.blue}
      >
        <FieldRow cols={2}>
          <Field label="Единицы измерения">
            <SelectInput
              value={system.preferredUnits}
              onChange={v => update({ preferredUnits: v as any })}
              options={[
                { id: 'metric', label: 'Метрические (кг, см)' },
                { id: 'imperial', label: 'Имперские (фунты, дюймы)' },
              ]}
            />
          </Field>
          <Field label="Приватность">
            <SelectInput
              value={system.privacyLevel}
              onChange={v => update({ privacyLevel: v as any })}
              options={PRIVACY}
            />
          </Field>
          <Field label="Monte Carlo прогонов">
            <SelectInput
              value={String(system.mcRuns || 1000)}
              onChange={v => update({ mcRuns: Number(v) })}
              options={[
                { id: '500', label: '500' },
                { id: '1000', label: '1000' },
                { id: '5000', label: '5000' },
                { id: '10000', label: '10000' },
              ]}
            />
          </Field>
          <Field label="Имя пользователя">
            <TextInput
              value={profile.name}
              onChange={v => updateProfile({ name: v })}
              placeholder="Имя"
              maxLength={60}
            />
          </Field>
        </FieldRow>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
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
        icon="💾"
        color={colors.primary}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          <button onClick={handleExport} style={{
            ...btnStyle, borderColor: colors.primary, color: colors.primary, background: colors.primaryDim,
          }}>📥 Экспорт в файл</button>
          <button onClick={handleImport} style={{
            ...btnStyle, borderColor: colors.blue, color: colors.blue, background: colors.blueDim,
          }}>📤 Импорт из файла</button>
          <button onClick={handleCopy} style={{
            ...btnStyle, borderColor: colors.purple, color: colors.purple, background: colors.purpleDim,
          }}>📋 Копировать в буфер</button>
        </div>
      </AccordionSection>

      <AccordionSection
        title="4.3 Сброс"
        subtitle="Очистить кэши, дневники или весь профиль"
        icon="🗑"
        color={colors.danger}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          <button onClick={handleClearDiaries} style={{
            ...btnStyle, borderColor: colors.warning, color: colors.warning, background: colors.warningDim,
          }}>🗑 Очистить дневники</button>
          <button onClick={() => {
            clearSnapshots();
            alert('✅ Снимки истории очищены');
          }} style={{
            ...btnStyle, borderColor: colors.textMuted, color: colors.textMuted, background: 'transparent',
          }}>🧹 Очистить историю</button>
          <button onClick={handleReset} style={{
            ...btnStyle, borderColor: colors.danger, color: colors.danger, background: colors.dangerDim,
          }}>⚠ Сбросить профиль</button>
        </div>
      </AccordionSection>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid',
  minHeight: 44,
  transition: 'all 0.15s',
};
