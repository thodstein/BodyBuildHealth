/**
 * TrainingPMSection — секция "Личные рекорды (ПМ)" вкладки Тренировки.
 * Использует PopupValueEditor для ввода значений через попап.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, FieldRow, PopupValueEditor, GroupHeader, colors } from '../ui';

const WORK_MAX_GROUPS = [
  { id: 'chest', label: 'Грудь' },
  { id: 'back', label: 'Спина' },
  { id: 'quads', label: 'Квадрицепсы' },
  { id: 'hamstrings', label: 'Бицепс бедра' },
  { id: 'glutes', label: 'Ягодицы' },
  { id: 'shoulders', label: 'Плечи' },
  { id: 'biceps', label: 'Бицепс' },
  { id: 'triceps', label: 'Трицепс' },
  { id: 'calves', label: 'Икры' },
  { id: 'abs', label: 'Пресс' },
];

export const TrainingPMSection: React.FC = () => {
  const [training, updateTraining] = useSectionState('training');
  const workMax = training.workMax || {};

  const updateWorkMax = (group: string, val: number | undefined) => {
    const next = { ...workMax };
    if (val === undefined || val === 0) {
      delete next[group];
    } else {
      next[group] = val;
    }
    updateTraining({ workMax: next });
  };

  return (
    <AccordionSection
      id="profile-section-1-8"
      title="2.2 Личные рекорды (ПМ)"
      subtitle="Главные лифты + рабочие максимумы по группам мышц"
      icon="🏆"
      color={colors.orange}
    >
      <GroupHeader icon="🏋️" title="Главные лифты (1RM)" color={colors.orange} />
      <FieldRow cols={3}>
        <PopupValueEditor
          label="Присед"
          value={training.pmSquat}
          unit="кг"
          type="number"
          min={0} max={500} step={2.5}
          onChange={v => updateTraining({ pmSquat: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Жим лёжа"
          value={training.pmBench}
          unit="кг"
          type="number"
          min={0} max={300} step={2.5}
          onChange={v => updateTraining({ pmBench: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Становая тяга"
          value={training.pmDeadlift}
          unit="кг"
          type="number"
          min={0} max={400} step={2.5}
          onChange={v => updateTraining({ pmDeadlift: v ?? 0 })}
          placeholder="—"
        />
      </FieldRow>

      <GroupHeader icon="📈" title="Рабочие максимумы (workMax) по группам мышц" color={colors.orange} style={{ marginTop: 12 }} />
      <FieldRow cols={3}>
        {WORK_MAX_GROUPS.map(g => (
          <PopupValueEditor
            key={g.id}
            label={g.label}
            value={workMax[g.id]}
            unit="кг"
            type="number"
            min={0} max={300} step={2.5}
            onChange={v => updateWorkMax(g.id, v)}
            placeholder="—"
          />
        ))}
      </FieldRow>
    </AccordionSection>
  );
};
