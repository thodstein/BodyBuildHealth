/**
 * TrainingWeakPointsSection — секция "Слабые стороны и оборудование" вкладки Тренировки.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, BoolChip, GroupHeader, colors } from '../ui';
import { NativeIcon } from '../../../native/NativeIcons';

const WEAK_GROUPS = [
  { id: 'chest', label: 'Грудь' },
  { id: 'back', label: 'Спина' },
  { id: 'quads', label: 'Квадрицепсы' },
  { id: 'hamstrings', label: 'Бицепс бедра' },
  { id: 'glutes', label: 'Ягодицы' },
  { id: 'shoulders', label: 'Плечи' },
  { id: 'biceps', label: 'Бицепс' },
  { id: 'triceps', label: 'Трицепс' },
  { id: 'calves', label: 'Икры' },
  { id: 'forearms', label: 'Предплечья' },
  { id: 'core', label: 'Кор' },
];

const EQUIPMENT = [
  { id: 'barbell', label: 'Штанга' },
  { id: 'dumbbell', label: 'Гантели' },
  { id: 'machine', label: 'Тренажёр' },
  { id: 'cable', label: 'Блок' },
  { id: 'bodyweight', label: 'Свой вес' },
  { id: 'band', label: 'Резинка' },
  { id: 'kettlebell', label: 'Гиря' },
];

export const TrainingWeakPointsSection: React.FC = React.memo(function TrainingWeakPointsSection() {
  const [training, updateTraining] = useSectionState('training');

  const toggle = (key: 'weakPoints' | 'equipment', id: string) => {
    const arr = (Array.isArray(training[key]) ? training[key] : []) as string[];
    const next = arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
    updateTraining({ [key]: next } as any);
  };

  return (
    <AccordionSection
      id="profile-section-1-9"
      title="2.3 Слабые стороны и оборудование"
      subtitle="Отстающие группы, доступный инвентарь"
      icon={<NativeIcon name="trendingDown" size={20} />}
      color={colors.pink}
    >
      <GroupHeader icon={<NativeIcon name="trendingDown" size={14} />} title="Слабые группы мышц" color={colors.pink} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {WEAK_GROUPS.map(g => (
          <BoolChip
            key={g.id}
            label={g.label}
            checked={(Array.isArray(training.weakPoints) ? training.weakPoints : []).includes(g.id)}
            onChange={() => toggle('weakPoints', g.id)}
            color={colors.pink}
          />
        ))}
      </div>

      <GroupHeader icon={<NativeIcon name="dumbbell" size={14} />} title="Доступное оборудование" color={colors.primary} style={{ marginTop: 12 }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {EQUIPMENT.map(e => (
          <BoolChip
            key={e.id}
            label={e.label}
            checked={(Array.isArray(training.equipment) ? training.equipment : []).includes(e.id)}
            onChange={() => toggle('equipment', e.id)}
            color={colors.primary}
          />
        ))}
      </div>
    </AccordionSection>
  );
});
