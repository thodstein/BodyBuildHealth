/**
 * UserGoalsSection — секция "Цели" вкладки Пользователь.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { useProfileSection } from '../../../../core/profile-manager';
import { AccordionSection, Field, FieldRow, NumberInput, TextInput, SelectInput, colors } from '../ui';

const PRIMARY_GOALS = [
  { id: 'bulk', label: 'Набор массы' },
  { id: 'cut', label: 'Сушка' },
  { id: 'maintenance', label: 'Поддержание' },
  { id: 'strength', label: 'Сила' },
  { id: 'hypertrophy', label: 'Гипертрофия' },
  { id: 'rehab', label: 'Реабилитация' },
  { id: 'recomposition', label: 'Рекомпозиция' },
  { id: 'health', label: 'Здоровье' },
];
const CYCLE_GOALS = [
  { id: 'mass', label: 'Масса' },
  { id: 'cut', label: 'Сушка' },
  { id: 'strength', label: 'Сила' },
  { id: 'definition', label: 'Рельеф' },
  { id: 'recomp', label: 'Рекомпозиция' },
];
const BB_CATEGORIES = [
  { id: "Men's Physique", label: "Men's Physique" },
  { id: "Classic Physique", label: "Classic Physique" },
  { id: "Bodybuilding", label: "Bodybuilding" },
  { id: "Bikini", label: "Bikini" },
  { id: "Figure", label: "Figure" },
  { id: "Wellness", label: "Wellness" },
  { id: "Crossfit", label: "Crossfit" },
  { id: "Powerlifting", label: "Powerlifting" },
];
const LIFE_STAGES = [
  { id: 'cut', label: 'Сушка' },
  { id: 'mass', label: 'Набор' },
  { id: 'maintenance', label: 'Поддержание' },
  { id: 'detox', label: 'Детокс' },
  { id: 'recovery', label: 'Восстановление' },
];

export const UserGoalsSection: React.FC = () => {
  const [goals, updateGoals] = useSectionState('goals');
  const [training, updateTraining] = useProfileSection('training');

  return (
    <AccordionSection
      id="profile-section-1-6"
      title="1.6 Цели"
      subtitle="Тренировочная цель, цели курса, таргеты"
      icon="🎯"
      color={colors.orange}
    >
      <FieldRow cols={2}>
        <Field label="Основная цель">
          <SelectInput
            value={goals.primaryGoal || training.primaryGoal}
            onChange={v => {
              updateGoals({ primaryGoal: v as any });
              updateTraining({ primaryGoal: v as any });
            }}
            options={PRIMARY_GOALS}
          />
        </Field>
        <Field label="Цель курса">
          <SelectInput
            value={goals.cycleGoal}
            onChange={v => updateGoals({ cycleGoal: v })}
            options={CYCLE_GOALS}
            placeholder="—"
          />
        </Field>
        <Field label="Длительность курса" hint="нед">
          <NumberInput
            value={goals.cycleWeeks}
            onChange={v => updateGoals({ cycleWeeks: v })}
            min={1} max={52}
          />
        </Field>
        <Field label="Срок достижения" hint="нед">
          <NumberInput
            value={goals.goalTimelineWeeks}
            onChange={v => updateGoals({ goalTimelineWeeks: v })}
            min={1} max={104}
          />
        </Field>
        <Field label="Целевой вес" hint="кг">
          <NumberInput
            value={goals.targetWeight}
            onChange={v => updateGoals({ targetWeight: v })}
            min={30} max={250} step={0.5}
          />
        </Field>
        <Field label="Целевой % жира" hint="%">
          <NumberInput
            value={goals.targetBodyFat}
            onChange={v => updateGoals({ targetBodyFat: v })}
            min={3} max={50} step={0.5}
          />
        </Field>
        <Field label="BB-категория">
          <SelectInput
            value={goals.bbCategory}
            onChange={v => updateGoals({ bbCategory: v })}
            options={BB_CATEGORIES}
            placeholder="—"
          />
        </Field>
        <Field label="Этап жизни">
          <SelectInput
            value={goals.lifeStage}
            onChange={v => updateGoals({ lifeStage: v })}
            options={LIFE_STAGES}
            placeholder="—"
          />
        </Field>
        <Field label="Дата шоу" hint="YYYY-MM-DD (для peak week)">
          <TextInput
            value={goals.peakShowDay}
            onChange={v => updateGoals({ peakShowDay: v })}
            placeholder="—"
            maxLength={10}
          />
        </Field>
      </FieldRow>
    </AccordionSection>
  );
};
