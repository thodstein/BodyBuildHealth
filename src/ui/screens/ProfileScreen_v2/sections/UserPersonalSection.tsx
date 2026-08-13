/**
 * UserPersonalSection — секция "Основное" вкладки Пользователь.
 * Личные данные + антропометрия + контакты.
 * Использует PopupValueEditor для ввода значений через попап.
 */
import React from 'react';
import { useProfileSection } from '../../../../core/profile-manager';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, FieldRow, PopupValueEditor, colors } from '../ui';

const BLOOD_TYPES: { id: string; label: string }[] = [
  { id: 'I+', label: 'I (резус +)' }, { id: 'I-', label: 'I (резус −)' },
  { id: 'II+', label: 'II (резус +)' }, { id: 'II-', label: 'II (резус −)' },
  { id: 'III+', label: 'III (резус +)' }, { id: 'III-', label: 'III (резус −)' },
  { id: 'IV+', label: 'IV (резус +)' }, { id: 'IV-', label: 'IV (резус −)' },
];
const SEX_OPTIONS = [
  { id: 'male', label: '♂ Мужской' },
  { id: 'female', label: '♀ Женский' },
];

export const UserPersonalSection: React.FC = React.memo(function UserPersonalSection() {
  const [personal, updatePersonal] = useSectionState('personal');
  const [system, setSystem] = useProfileSection('system');

  const filled = [
    personal.age, personal.sex, personal.height, personal.weight, personal.bodyFat,
  ].filter(v => v !== undefined && v !== null && v !== 0).length;

  return (
    <AccordionSection
      id="profile-section-1-1"
      title="1.1 Основное"
      subtitle="Личные данные, антропометрия, контакты"
      icon="👤"
      color={colors.primary}
      defaultOpen
      badge={`${filled}/5 заполнено`}
    >
      <FieldRow cols={3}>
        <PopupValueEditor
          label="Возраст"
          value={personal.age}
          unit="лет"
          type="number"
          min={10} max={120}
          onChange={v => updatePersonal({ age: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Пол"
          value={personal.sex}
          type="select"
          options={SEX_OPTIONS}
          onChange={v => updatePersonal({ sex: v as 'male' | 'female' })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Группа крови"
          value={personal.bloodType}
          type="select"
          options={BLOOD_TYPES}
          onChange={v => updatePersonal({ bloodType: v })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Рост"
          value={personal.height}
          unit="см"
          type="number"
          min={100} max={250}
          onChange={v => updatePersonal({ height: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Вес"
          value={personal.weight}
          unit="кг"
          type="number"
          min={30} max={250} step={0.1}
          onChange={v => updatePersonal({ weight: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="% жира"
          value={personal.bodyFat}
          unit="%"
          type="number"
          min={3} max={60} step={0.1}
          onChange={v => updatePersonal({ bodyFat: v ?? 0 })}
          placeholder="—"
        />
      </FieldRow>

      <div style={{ height: 1, background: colors.border, margin: '12px 0' }} />

      <FieldRow cols={3}>
        <PopupValueEditor
          label="Электронная почта"
          value={system.email}
          type="text"
          onChange={v => setSystem({ email: v })}
          placeholder="example@mail.com"
        />
        <PopupValueEditor
          label="Экстренный контакт (имя)"
          value={personal.emergencyName}
          type="text"
          onChange={v => updatePersonal({ emergencyName: v })}
          placeholder="Имя"
        />
        <PopupValueEditor
          label="Экстренный контакт (телефон)"
          value={personal.emergencyPhone}
          type="text"
          onChange={v => updatePersonal({ emergencyPhone: v })}
          placeholder="+7..."
        />
      </FieldRow>

      {personal.weight && personal.height && personal.weight > 0 && personal.height > 0 && (
        <div style={{
          marginTop: 12, padding: 14, borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(0,230,138,0.03))',
          border: `1px solid ${colors.primaryDim}`,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: colors.primary, marginBottom: 8, letterSpacing: 0.5,
          }}>📊 Композиция тела</div>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: colors.textMuted, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span>ИМТ</span>
              <b style={{ color: colors.primary, fontSize: 15 }}>{((personal.weight / Math.pow(personal.height / 100, 2))).toFixed(1)}</b>
            </span>
            {(() => {
              // Тощая масса = LBM — формула Mattila et al. 2001
              const bodyFat = personal.bodyFat ?? 0;
              if (bodyFat <= 0) return null;
              const lbm = personal.weight * (1 - bodyFat / 100);
              const ffmi = lbm / Math.pow(personal.height / 100, 2);
              return (
                <>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span>Тощая масса</span>
                    <b style={{ color: colors.primary, fontSize: 15 }}>{lbm.toFixed(1)} кг</b>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span>FFMI</span>
                    <b style={{ color: colors.primary, fontSize: 15 }}>{ffmi.toFixed(1)}</b>
                  </span>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </AccordionSection>
  );
});
