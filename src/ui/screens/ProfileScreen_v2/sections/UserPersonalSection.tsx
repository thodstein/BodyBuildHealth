/**
 * UserPersonalSection — секция "Основное" вкладки Пользователь.
 * Личные данные + антропометрия + контакты.
 */
import React from 'react';
import { useProfileSection } from '../../../../core/profile-manager';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, Field, FieldRow, NumberInput, TextInput, SelectInput, colors } from '../ui';

const BLOOD_TYPES: { id: string; label: string }[] = [
  { id: 'I+', label: 'I (Rh+)' }, { id: 'I-', label: 'I (Rh−)' },
  { id: 'II+', label: 'II (Rh+)' }, { id: 'II-', label: 'II (Rh−)' },
  { id: 'III+', label: 'III (Rh+)' }, { id: 'III-', label: 'III (Rh−)' },
  { id: 'IV+', label: 'IV (Rh+)' }, { id: 'IV-', label: 'IV (Rh−)' },
];

export const UserPersonalSection: React.FC = () => {
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
        <Field label="Возраст">
          <NumberInput
            value={personal.age}
            onChange={v => updatePersonal({ age: v ?? 0 })}
            min={10} max={120} unit="лет"
          />
        </Field>
        <Field label="Пол">
          <SelectInput
            value={personal.sex}
            onChange={v => updatePersonal({ sex: v as 'male' | 'female' })}
            options={[
              { id: 'male', label: '♂ Мужской' },
              { id: 'female', label: '♀ Женский' },
            ]}
          />
        </Field>
        <Field label="Группа крови">
          <SelectInput
            value={personal.bloodType}
            onChange={v => updatePersonal({ bloodType: v })}
            options={BLOOD_TYPES}
            placeholder="—"
          />
        </Field>
        <Field label="Рост" hint="см">
          <NumberInput
            value={personal.height}
            onChange={v => updatePersonal({ height: v ?? 0 })}
            min={100} max={250}
          />
        </Field>
        <Field label="Вес" hint="кг">
          <NumberInput
            value={personal.weight}
            onChange={v => updatePersonal({ weight: v ?? 0 })}
            min={30} max={250} step={0.1}
          />
        </Field>
        <Field label="% жира" hint="процент">
          <NumberInput
            value={personal.bodyFat}
            onChange={v => updatePersonal({ bodyFat: v ?? 0 })}
            min={3} max={60} step={0.1} unit="%"
          />
        </Field>
      </FieldRow>

      <div style={{ height: 1, background: colors.border, margin: '12px 0' }} />

      <FieldRow cols={3}>
        <Field label="Email">
          <TextInput
            value={system.email}
            onChange={v => setSystem({ email: v })}
            placeholder="example@mail.com"
            maxLength={100}
          />
        </Field>
        <Field label="Экстренный контакт (имя)">
          <TextInput
            value={personal.emergencyName}
            onChange={v => updatePersonal({ emergencyName: v })}
            placeholder="Имя"
            maxLength={100}
          />
        </Field>
        <Field label="Экстренный контакт (телефон)">
          <TextInput
            value={personal.emergencyPhone}
            onChange={v => updatePersonal({ emergencyPhone: v })}
            placeholder="+7..."
            maxLength={30}
          />
        </Field>
      </FieldRow>

      {personal.weight && personal.height && personal.weight > 0 && personal.height > 0 && (
        <div style={{
          marginTop: 12, padding: 12, borderRadius: 10,
          background: 'rgba(0,230,138,0.08)', border: `1px solid ${colors.primaryDim}`,
        }}>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: colors.textMuted, flexWrap: 'wrap' }}>
            <span>BMI: <b style={{ color: colors.primary }}>{((personal.weight / Math.pow(personal.height / 100, 2))).toFixed(1)}</b></span>
            {personal.bodyFat > 0 && (
              <>
                <span>LBM: <b style={{ color: colors.primary }}>{(personal.weight * (1 - personal.bodyFat / 100)).toFixed(1)} кг</b></span>
                <span>FFMI: <b style={{ color: colors.primary }}>(((LBM)/(h²)))</b> = <b style={{ color: colors.primary }}>{(((personal.weight * (1 - personal.bodyFat / 100)) / Math.pow(personal.height / 100, 2))).toFixed(1)}</b></span>
              </>
            )}
          </div>
        </div>
      )}
    </AccordionSection>
  );
};
