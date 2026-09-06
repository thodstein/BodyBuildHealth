/**
 * TrainingProfileSection — секция "Профиль тренировок" вкладки Тренировки.
 * Использует PopupValueEditor для ввода значений через попап.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, FieldRow, PopupValueEditor, SliderInput, colors } from '../ui';
import { NativeIcon } from '../../../native/NativeIcons';
import { PopupExerciseList } from '../../SRCBBScreen_parts/TrainingPopups';

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
const GOAL_OPTIONS = [
  { id: 'bulk', label: 'Масса' },
  { id: 'cut', label: 'Сушка' },
  { id: 'maintenance', label: 'Поддержание' },
  { id: 'strength', label: 'Сила' },
  { id: 'hypertrophy', label: 'Гипертрофия' },
  { id: 'rehab', label: 'Реабилитация' },
  { id: 'recomposition', label: 'Рекомпозиция' },
  { id: 'health', label: 'Здоровье' },
];

export const TrainingProfileSection: React.FC = React.memo(function TrainingProfileSection() {
  const [training, updateTraining] = useSectionState('training');

  return (
    <AccordionSection
      id="profile-section-1-7"
      title="2.1 Профиль"
      subtitle="Цель, уровень, спорт, стаж, расписание"
      icon={<NativeIcon name="dumbbell" size={20} />}
      color={colors.blue}
    >
      <FieldRow cols={3}>
        <PopupValueEditor
          label="Цель"
          value={training.primaryGoal}
          type="select"
          options={GOAL_OPTIONS}
          onChange={v => updateTraining({ primaryGoal: v as any })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Уровень"
          value={training.level}
          type="select"
          options={LEVELS}
          onChange={v => updateTraining({ level: v as any })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Спорт"
          value={training.sportType}
          type="select"
          options={SPORT_TYPES}
          onChange={v => updateTraining({ sportType: v as any })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Стаж"
          value={training.experience}
          unit="лет"
          type="number"
          min={0} max={50} step={0.5}
          onChange={v => updateTraining({ experience: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Дней в неделю"
          value={training.daysPerWeek}
          type="number"
          min={1} max={7}
          onChange={v => updateTraining({ daysPerWeek: v ?? 3 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Минут за тренировку"
          value={training.minutesPerSession}
          unit="мин"
          type="number"
          min={15} max={240} step={5}
          onChange={v => updateTraining({ minutesPerSession: v ?? 60 })}
          placeholder="—"
        />
      </FieldRow>

      <div style={{ height: 1, background: colors.border, margin: '12px 0' }} />

      <FieldRow cols={3}>
        <div>
          <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, marginBottom: 4 }}>Восстановление (1-10)</div>
          <SliderInput
            value={training.recovery}
            onChange={v => updateTraining({ recovery: v })}
            min={1} max={10}
            color={colors.green}
            minLabel="разбит, мышцы не восстановились"
            maxLabel="полностью восстановлен, готов к нагрузке"
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, marginBottom: 4 }}>Мотивация (1-10)</div>
          <SliderInput
            value={training.motivation}
            onChange={v => updateTraining({ motivation: v })}
            min={1} max={10}
            color={colors.purple}
            minLabel="нет желания тренироваться"
            maxLabel="максимальный энтузиазм, хочется в зал"
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, marginBottom: 4 }}>DOMS (1-10)</div>
          <SliderInput
            value={training.doms}
            onChange={v => updateTraining({ doms: v })}
            min={1} max={10}
            color={colors.warning}
            minLabel="нет мышечной боли"
            maxLabel="сильная крепатура, тяжело двигаться"
          />
        </div>
      </FieldRow>

      <div style={{ height: 1, background: colors.border, margin: '12px 0' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <PopupExerciseList
          label="⭐ Любимые упражнения"
          ids={training.favoriteExercises || []}
          onChange={ids => updateTraining({ favoriteExercises: ids })}
          accent="#34d399"
        />
        <PopupExerciseList
          label="✕ Не любимые упражнения"
          ids={training.excludedExercises || []}
          onChange={ids => updateTraining({ excludedExercises: ids })}
          accent="#ef4444"
        />
      </div>
      <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 6 }}>
        Любимые получают приоритет при отборе упражнений в ББ-авто. Не любимые полностью исключаются из генерации плана.
      </div>
    </AccordionSection>
  );
});
