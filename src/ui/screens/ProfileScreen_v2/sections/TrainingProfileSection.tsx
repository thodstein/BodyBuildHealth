/**
 * TrainingProfileSection — секция "Профиль тренировок" вкладки Тренировки.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, Field, FieldRow, NumberInput, SelectInput, SliderInput, colors } from '../ui';

const SPORT_TYPES = [
  { id: 'bodybuilding', label: 'Бодибилдинг' },
  { id: 'powerlifting', label: 'Пауэрлифтинг' },
  { id: 'crossfit', label: 'Кроссфит' },
  { id: 'fitness', label: 'Фитнес' },
  { id: 'other', label: 'Другое' },
];
const LEVELS = [
  { id: 'beginner', label: 'Новичок' },
  { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Продвинутый' },
  { id: 'enhanced', label: 'Enhanced' },
];

export const TrainingProfileSection: React.FC = () => {
  const [training, updateTraining] = useSectionState('training');

  return (
    <AccordionSection
      title="2.1 Профиль"
      subtitle="Цель, уровень, спорт, стаж, расписание"
      icon="🎯"
      color={colors.blue}
    >
      <FieldRow cols={3}>
        <Field label="Цель">
          <SelectInput
            value={training.primaryGoal}
            onChange={v => updateTraining({ primaryGoal: v as any })}
            options={[
              { id: 'bulk', label: 'Масса' },
              { id: 'cut', label: 'Сушка' },
              { id: 'maintenance', label: 'Поддержание' },
              { id: 'strength', label: 'Сила' },
              { id: 'hypertrophy', label: 'Гипертрофия' },
              { id: 'rehab', label: 'Реабилитация' },
              { id: 'recomposition', label: 'Рекомпозиция' },
              { id: 'health', label: 'Здоровье' },
            ]}
          />
        </Field>
        <Field label="Уровень">
          <SelectInput
            value={training.level}
            onChange={v => updateTraining({ level: v as any })}
            options={LEVELS}
          />
        </Field>
        <Field label="Спорт">
          <SelectInput
            value={training.sportType}
            onChange={v => updateTraining({ sportType: v as any })}
            options={SPORT_TYPES}
          />
        </Field>
        <Field label="Стаж" hint="лет">
          <NumberInput
            value={training.experience}
            onChange={v => updateTraining({ experience: v ?? 0 })}
            min={0} max={50} step={0.5}
          />
        </Field>
        <Field label="Дней в неделю">
          <NumberInput
            value={training.daysPerWeek}
            onChange={v => updateTraining({ daysPerWeek: v ?? 3 })}
            min={1} max={7}
          />
        </Field>
        <Field label="Минут за тренировку">
          <NumberInput
            value={training.minutesPerSession}
            onChange={v => updateTraining({ minutesPerSession: v ?? 60 })}
            min={15} max={240} step={5}
          />
        </Field>
      </FieldRow>

      <div style={{ height: 1, background: colors.border, margin: '12px 0' }} />

      <FieldRow cols={3}>
        <Field label="Восстановление" hint="1-10">
          <SliderInput
            value={training.recovery}
            onChange={v => updateTraining({ recovery: v })}
            min={1} max={10}
            color={colors.green}
          />
        </Field>
        <Field label="Мотивация" hint="1-10">
          <SliderInput
            value={training.motivation}
            onChange={v => updateTraining({ motivation: v })}
            min={1} max={10}
            color={colors.purple}
          />
        </Field>
        <Field label="DOMS" hint="1-10">
          <SliderInput
            value={training.doms}
            onChange={v => updateTraining({ doms: v })}
            min={1} max={10}
            color={colors.warning}
          />
        </Field>
      </FieldRow>
    </AccordionSection>
  );
};
