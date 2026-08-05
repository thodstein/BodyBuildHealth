/**
 * TrainingPMSection — секция "Личные рекорды (ПМ)" вкладки Тренировки.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, Field, FieldRow, NumberInput, colors } from '../ui';

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
      title="2.2 Личные рекорды (ПМ)"
      subtitle="Главные лифты + рабочие максимумы по группам мышц"
      icon="🏆"
      color={colors.orange}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 8 }}>
        Главные лифты (1RM)
      </div>
      <FieldRow cols={3}>
        <Field label="Присед" hint="кг">
          <NumberInput
            value={training.pmSquat}
            onChange={v => updateTraining({ pmSquat: v ?? 0 })}
            min={0} max={500} step={2.5}
          />
        </Field>
        <Field label="Жим лёжа" hint="кг">
          <NumberInput
            value={training.pmBench}
            onChange={v => updateTraining({ pmBench: v ?? 0 })}
            min={0} max={300} step={2.5}
          />
        </Field>
        <Field label="Становая тяга" hint="кг">
          <NumberInput
            value={training.pmDeadlift}
            onChange={v => updateTraining({ pmDeadlift: v ?? 0 })}
            min={0} max={400} step={2.5}
          />
        </Field>
      </FieldRow>

      <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, margin: '12px 0 8px' }}>
        Рабочие максимумы (workMax) по группам мышц
      </div>
      <FieldRow cols={3}>
        {WORK_MAX_GROUPS.map(g => (
          <Field key={g.id} label={g.label} hint="кг">
            <NumberInput
              value={workMax[g.id]}
              onChange={v => updateWorkMax(g.id, v)}
              min={0} max={300} step={2.5}
            />
          </Field>
        ))}
      </FieldRow>
    </AccordionSection>
  );
};
