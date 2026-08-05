/**
 * UserLifestyleSection — секция "Образ жизни" вкладки Пользователь.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, Field, FieldRow, NumberInput, TextInput, SelectInput, BoolChip, SliderInput, colors } from '../ui';

const CHRONOTYPES = [
  { id: 'lark', label: 'Жаворонок' },
  { id: 'owl', label: 'Сова' },
  { id: 'mixed', label: 'Смешанный' },
];
const SLEEP_QUALITY = [
  { id: 'good', label: 'Хорошее' },
  { id: 'fair', label: 'Среднее' },
  { id: 'poor', label: 'Плохое' },
];

export const UserLifestyleSection: React.FC = () => {
  const [lifestyle, updateLifestyle] = useSectionState('lifestyle');

  return (
    <AccordionSection
      id="profile-section-1-4"
      title="1.4 Образ жизни"
      subtitle="Сон, стресс, активность, вода, восстановление"
      icon="🌿"
      color={colors.purple}
    >
      <FieldRow cols={3}>
        <Field label="Сон" hint="часов">
          <NumberInput
            value={lifestyle.sleepHours}
            onChange={v => updateLifestyle({ sleepHours: v ?? 7 })}
            min={3} max={12} step={0.5}
          />
        </Field>
        <Field label="Качество сна">
          <SelectInput
            value={lifestyle.sleepQuality}
            onChange={v => updateLifestyle({ sleepQuality: v as any })}
            options={SLEEP_QUALITY}
          />
        </Field>
        <Field label="Пробуждений за ночь">
          <NumberInput
            value={lifestyle.nightAwakenings}
            onChange={v => updateLifestyle({ nightAwakenings: v ?? 0 })}
            min={0} max={10}
          />
        </Field>
        <Field label="Хронотип">
          <SelectInput
            value={lifestyle.chronotype}
            onChange={v => updateLifestyle({ chronotype: v as any })}
            options={CHRONOTYPES}
          />
        </Field>
        <Field label="Ложусь" hint="HH:MM">
          <TextInput
            value={lifestyle.bedtime}
            onChange={v => updateLifestyle({ bedtime: v })}
            placeholder="23:00"
            maxLength={5}
          />
        </Field>
        <Field label="Встаю" hint="HH:MM">
          <TextInput
            value={lifestyle.wakeTime}
            onChange={v => updateLifestyle({ wakeTime: v })}
            placeholder="07:00"
            maxLength={5}
          />
        </Field>
      </FieldRow>

      <div style={{ height: 1, background: colors.border, margin: '12px 0' }} />

      <FieldRow cols={2}>
        <Field label="Стресс" hint="1-10 (10 = максимум)">
          <SliderInput value={lifestyle.stressLevel} onChange={v => updateLifestyle({ stressLevel: v })} min={1} max={10} color={colors.danger} />
        </Field>
        <Field label="Усталость" hint="1-10 (10 = полное истощение)">
          <SliderInput value={lifestyle.fatigueLevel} onChange={v => updateLifestyle({ fatigueLevel: v })} min={1} max={10} color={colors.warning} />
        </Field>
        <Field label="Активность" hint="1-10 (10 = очень активный)">
          <SliderInput value={lifestyle.activityLevel} onChange={v => updateLifestyle({ activityLevel: v })} min={1} max={10} color={colors.primary} />
        </Field>
        <Field label="HRV baseline" hint="коэффициент (0.5-1.5)">
          <NumberInput
            value={lifestyle.baselineHrvRatio}
            onChange={v => updateLifestyle({ baselineHrvRatio: v ?? 1 })}
            min={0.5} max={1.5} step={0.05}
          />
        </Field>
      </FieldRow>

      <FieldRow cols={3}>
        <Field label="Шаги/день">
          <NumberInput
            value={lifestyle.dailySteps}
            onChange={v => updateLifestyle({ dailySteps: v ?? 0 })}
            min={0} max={50000} step={500}
          />
        </Field>
        <Field label="Вода/день" hint="литров">
          <NumberInput
            value={lifestyle.dailyWaterLiters}
            onChange={v => updateLifestyle({ dailyWaterLiters: v ?? 2 })}
            min={0} max={10} step={0.1}
          />
        </Field>
        <Field label="HRV" hint="мс (утренний)">
          <NumberInput
            value={lifestyle.morningHRV}
            onChange={v => updateLifestyle({ morningHRV: v ?? 0 })}
            min={0} max={200}
          />
        </Field>
      </FieldRow>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <BoolChip
          label="Курение"
          checked={lifestyle.smoke}
          onChange={v => updateLifestyle({ smoke: v })}
          color={colors.danger}
        />
      </div>
    </AccordionSection>
  );
};
