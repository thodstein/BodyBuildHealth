/**
 * UserPharmaSection — секция "Курс / Фарма" вкладки Пользователь.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, Field, FieldRow, NumberInput, TextInput, SelectInput, BoolChip, colors } from '../ui';

const PHASES = [
  { id: 'baseline', label: 'База (без курса)' },
  { id: 'course', label: 'Курс' },
  { id: 'bridge', label: 'Бридж' },
  { id: 'pct', label: 'ПКТ' },
  { id: 'post_pct', label: 'После ПКТ' },
  { id: 'fertility', label: 'Фертильность' },
];
const EXPERIENCE = [
  { id: 'none', label: 'Нет' },
  { id: 'beginner', label: 'Начинающий' },
  { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Продвинутый' },
];
const CYCLE_TYPES = [
  { id: 'mass', label: 'Масса' },
  { id: 'cut', label: 'Сушка' },
  { id: 'maintenance', label: 'Поддержание' },
  { id: 'endurance', label: 'Выносливость' },
];
const TIME_SINCE = [
  { id: 'none', label: 'Нет' },
  { id: '1-3mo', label: '1-3 мес' },
  { id: '3-6mo', label: '3-6 мес' },
  { id: '6-12mo', label: '6-12 мес' },
  { id: '1y+', label: '>1 года' },
];

export const UserPharmaSection: React.FC = () => {
  const [pharma, updatePharma] = useSectionState('pharma');

  return (
    <AccordionSection
      id="profile-section-1-5"
      title="1.5 Курс / Фарма"
      subtitle="Фаза, препараты, опыт"
      icon="💉"
      color={colors.warning}
      badge={pharma.phase === 'course' ? 'КУРС' : ''}
    >
      <FieldRow cols={3}>
        <Field label="Фаза">
          <SelectInput
            value={pharma.phase}
            onChange={v => updatePharma({ phase: v as any })}
            options={PHASES}
          />
        </Field>
        <Field label="Дата старта курса">
          <TextInput
            value={pharma.courseStartDate}
            onChange={v => updatePharma({ courseStartDate: v })}
            placeholder="YYYY-MM-DD"
            maxLength={10}
          />
        </Field>
        <Field label="Опыт">
          <SelectInput
            value={pharma.experience}
            onChange={v => updatePharma({ experience: v as any })}
            options={EXPERIENCE}
          />
        </Field>
        <Field label="Всего курсов">
          <NumberInput
            value={pharma.totalCycles}
            onChange={v => updatePharma({ totalCycles: v ?? 0 })}
            min={0} max={50}
          />
        </Field>
        <Field label="Лет на фарме">
          <NumberInput
            value={pharma.yearsOnGear}
            onChange={v => updatePharma({ yearsOnGear: v ?? 0 })}
            min={0} max={30} step={0.5}
          />
        </Field>
        <Field label="Месяцев с последнего">
          <NumberInput
            value={pharma.monthsSinceLastCourse}
            onChange={v => updatePharma({ monthsSinceLastCourse: v ?? 0 })}
            min={0} max={120}
          />
        </Field>
        <Field label="Время с последнего">
          <SelectInput
            value={pharma.timeSinceLastCycle}
            onChange={v => updatePharma({ timeSinceLastCycle: v as any })}
            options={TIME_SINCE}
          />
        </Field>
        <Field label="Тип цикла">
          <SelectInput
            value={pharma.trainingCycleType}
            onChange={v => updatePharma({ trainingCycleType: v as any })}
            options={CYCLE_TYPES}
          />
        </Field>
        <Field label="Длительность цикла" hint="недель">
          <NumberInput
            value={pharma.trainingCycleWeeks}
            onChange={v => updatePharma({ trainingCycleWeeks: v ?? 12 })}
            min={1} max={52}
          />
        </Field>
      </FieldRow>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <BoolChip
          label="Использую ХГЧ"
          checked={pharma.hcgEnabled}
          onChange={v => updatePharma({ hcgEnabled: v })}
          color={colors.warning}
        />
        <BoolChip
          label="Использую ИА"
          checked={pharma.aiEnabled}
          onChange={v => updatePharma({ aiEnabled: v })}
          color={colors.warning}
        />
      </div>

      <Field label="Прошлых курсов">
        <NumberInput
          value={pharma.previousCycles}
          onChange={v => updatePharma({ previousCycles: v ?? 0 })}
          min={0} max={50}
        />
      </Field>

      <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
        💡 Конкретные препараты с дозами управляются на экране <b>💊 Мой курс</b> (PharmaScreen).
        Список currentSubstances в этом профиле является зеркалом.
      </div>
    </AccordionSection>
  );
};
