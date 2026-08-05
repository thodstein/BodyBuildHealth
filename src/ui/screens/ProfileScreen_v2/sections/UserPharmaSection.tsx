/**
 * UserPharmaSection — секция "Курс / Фарма" вкладки Пользователь.
 * Использует PopupValueEditor для ввода значений через попап.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, FieldRow, PopupValueEditor, BoolChip, colors } from '../ui';

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
        <PopupValueEditor
          label="Фаза"
          value={pharma.phase}
          type="select"
          options={PHASES}
          onChange={v => updatePharma({ phase: v as any })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Дата старта курса"
          value={pharma.courseStartDate}
          type="text"
          onChange={v => updatePharma({ courseStartDate: v })}
          placeholder="YYYY-MM-DD"
        />
        <PopupValueEditor
          label="Опыт"
          value={pharma.experience}
          type="select"
          options={EXPERIENCE}
          onChange={v => updatePharma({ experience: v as any })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Всего курсов"
          value={pharma.totalCycles}
          type="number"
          min={0} max={50}
          onChange={v => updatePharma({ totalCycles: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Лет на фарме"
          value={pharma.yearsOnGear}
          type="number"
          min={0} max={30} step={0.5}
          onChange={v => updatePharma({ yearsOnGear: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Месяцев с последнего"
          value={pharma.monthsSinceLastCourse}
          type="number"
          min={0} max={120}
          onChange={v => updatePharma({ monthsSinceLastCourse: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Время с последнего"
          value={pharma.timeSinceLastCycle}
          type="select"
          options={TIME_SINCE}
          onChange={v => updatePharma({ timeSinceLastCycle: v as any })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Тип цикла"
          value={pharma.trainingCycleType}
          type="select"
          options={CYCLE_TYPES}
          onChange={v => updatePharma({ trainingCycleType: v as any })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Длительность цикла"
          value={pharma.trainingCycleWeeks}
          unit="недель"
          type="number"
          min={1} max={52}
          onChange={v => updatePharma({ trainingCycleWeeks: v ?? 12 })}
          placeholder="—"
        />
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

      <div style={{ marginBottom: 12 }}>
        <PopupValueEditor
          label="Прошлых курсов"
          value={pharma.previousCycles}
          type="number"
          min={0} max={50}
          onChange={v => updatePharma({ previousCycles: v ?? 0 })}
          placeholder="—"
        />
      </div>

      <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
        💡 Конкретные препараты с дозами управляются на экране <b>💊 Мой курс</b> (PharmaScreen).
        Список currentSubstances в этом профиле является зеркалом.
      </div>
    </AccordionSection>
  );
};
