/**
 * UserGoalsSection — секция "Цели" вкладки Пользователь.
 * Использует PopupValueEditor для ввода значений через попап.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { useProfileSection } from '../../../../core/profile-manager';
import { AccordionSection, FieldRow, PopupValueEditor, colors } from '../ui';

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
  { id: "Men's Physique", label: "Менс Физик" },
  { id: "Classic Physique", label: "Классик Физик" },
  { id: "Bodybuilding", label: "Бодибилдинг" },
  { id: "Bikini", label: "Бикини" },
  { id: "Figure", label: "Фигура" },
  { id: "Wellness", label: "Уэлнес" },
  { id: "Crossfit", label: "Кроссфит" },
  { id: "Powerlifting", label: "Пауэрлифтинг" },
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
        <PopupValueEditor
          label="Основная цель"
          value={goals.primaryGoal || training.primaryGoal}
          type="select"
          options={PRIMARY_GOALS}
          onChange={v => {
            updateGoals({ primaryGoal: v as any });
            updateTraining({ primaryGoal: v as any });
          }}
          placeholder="—"
        />
        <PopupValueEditor
          label="Цель курса"
          value={goals.cycleGoal}
          type="select"
          options={CYCLE_GOALS}
          onChange={v => updateGoals({ cycleGoal: v })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Длительность курса"
          value={goals.cycleWeeks}
          unit="нед"
          type="number"
          min={1} max={52}
          onChange={v => updateGoals({ cycleWeeks: v })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Срок достижения"
          value={goals.goalTimelineWeeks}
          unit="нед"
          type="number"
          min={1} max={104}
          onChange={v => updateGoals({ goalTimelineWeeks: v })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Целевой вес"
          value={goals.targetWeight}
          unit="кг"
          type="number"
          min={30} max={250} step={0.5}
          onChange={v => updateGoals({ targetWeight: v })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Целевой % жира"
          value={goals.targetBodyFat}
          unit="%"
          type="number"
          min={3} max={50} step={0.5}
          onChange={v => updateGoals({ targetBodyFat: v })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Категория ББ"
          value={goals.bbCategory}
          type="select"
          options={BB_CATEGORIES}
          onChange={v => updateGoals({ bbCategory: v })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Этап жизни"
          value={goals.lifeStage}
          type="select"
          options={LIFE_STAGES}
          onChange={v => updateGoals({ lifeStage: v })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Дата шоу"
          value={goals.peakShowDay}
          type="text"
          onChange={v => updateGoals({ peakShowDay: v })}
          placeholder="YYYY-MM-DD (peak week)"
        />
      </FieldRow>
    </AccordionSection>
  );
};
