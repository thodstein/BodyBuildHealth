/**
 * UserLifestyleSection — секция "Образ жизни" вкладки Пользователь.
 * Использует PopupValueEditor для ввода значений через попап.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, FieldRow, PopupValueEditor, BoolChip, SliderInput, colors } from '../ui';
import { NativeIcon } from '../../../native/NativeIcons';
import { cycleState } from '../../../../engines/female-cycle-phase.engine';

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

export const UserLifestyleSection: React.FC = React.memo(function UserLifestyleSection() {
  const [lifestyle, updateLifestyle] = useSectionState('lifestyle');
  const [personal] = useSectionState('personal');
  // Проход 77: дата последней менструации — единственный вход фазовой модели.
  // Считаю фазу здесь же, чтобы женщина видела, что поле реально работает.
  const cycle = cycleState({
    sex: personal?.sex,
    lastPeriodStart: lifestyle.lastPeriodStart,
    cycleLengthDays: lifestyle.cycleLengthDays,
  });
  const cycleDateRaw = String(lifestyle.lastPeriodStart ?? '').trim();

  return (
    <AccordionSection
      id="profile-section-1-4"
      title="1.4 Образ жизни"
      subtitle="Сон, стресс, активность, вода, восстановление"
      icon={<NativeIcon name="wind" size={20} />}
      color={colors.purple}
    >
      <FieldRow cols={3}>
        <PopupValueEditor
          label="Сон"
          value={lifestyle.sleepHours}
          unit="часов"
          type="number"
          min={3} max={12} step={0.5}
          onChange={v => updateLifestyle({ sleepHours: v ?? 7 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Качество сна"
          value={lifestyle.sleepQuality}
          type="select"
          options={SLEEP_QUALITY}
          onChange={v => updateLifestyle({ sleepQuality: v as any })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Пробуждений за ночь"
          value={lifestyle.nightAwakenings}
          type="number"
          min={0} max={10}
          onChange={v => updateLifestyle({ nightAwakenings: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Хронотип"
          value={lifestyle.chronotype}
          type="select"
          options={CHRONOTYPES}
          onChange={v => updateLifestyle({ chronotype: v as any })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Ложусь"
          value={lifestyle.bedtime}
          type="text"
          onChange={v => updateLifestyle({ bedtime: v })}
          placeholder="23:00"
        />
        <PopupValueEditor
          label="Встаю"
          value={lifestyle.wakeTime}
          type="text"
          onChange={v => updateLifestyle({ wakeTime: v })}
          placeholder="07:00"
        />
      </FieldRow>

      <div style={{ height: 1, background: colors.border, margin: '12px 0' }} />

      <FieldRow cols={2}>
        <SliderInput label="Стресс (1-10)" value={lifestyle.stressLevel} onChange={v => updateLifestyle({ stressLevel: v })} min={1} max={10} color={colors.danger} direction="bad" minLabel="полное спокойствие, расслаблен" maxLabel="сильный стресс, на пределе" />
        <SliderInput label="Усталость (1-10)" value={lifestyle.fatigueLevel} onChange={v => updateLifestyle({ fatigueLevel: v })} min={1} max={10} color={colors.warning} direction="bad" minLabel="бодр, энергии полно" maxLabel="истощён, нет сил" />
        <SliderInput label="Активность (1-10)" value={lifestyle.activityLevel} onChange={v => updateLifestyle({ activityLevel: v })} min={1} max={10} color={colors.primary} direction="good" minLabel="малоподвижный, офисная работа" maxLabel="тренировки почти каждый день" />
        <PopupValueEditor
          label="Базовый HRV (коэф.)"
          value={lifestyle.baselineHrvRatio}
          unit="коэф."
          type="number"
          min={0.5} max={1.5} step={0.05}
          onChange={v => updateLifestyle({ baselineHrvRatio: v ?? 1 })}
          placeholder="—"
        />
      </FieldRow>

      <FieldRow cols={3}>
        <PopupValueEditor
          label="Шаги/день"
          value={lifestyle.dailySteps}
          type="number"
          min={0} max={50000} step={500}
          onChange={v => updateLifestyle({ dailySteps: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Вода/день"
          value={lifestyle.dailyWaterLiters}
          unit="литров"
          type="number"
          min={0} max={10} step={0.1}
          onChange={v => updateLifestyle({ dailyWaterLiters: v ?? 2 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Утренний HRV"
          value={lifestyle.morningHRV}
          unit="мс"
          type="number"
          min={0} max={200}
          onChange={v => updateLifestyle({ morningHRV: v ?? 0 })}
          placeholder="—"
        />
      </FieldRow>

      {personal?.sex === 'female' && (
        <>
          <div style={{ height: 1, background: colors.border, margin: '12px 0' }} />
          <FieldRow cols={2}>
            <PopupValueEditor
              label="Последняя менструация"
              value={lifestyle.lastPeriodStart}
              type="text"
              onChange={v => updateLifestyle({ lastPeriodStart: String(v ?? '').trim() })}
              placeholder="ГГГГ-ММ-ДД"
            />
            <PopupValueEditor
              label="Длина цикла"
              value={lifestyle.cycleLengthDays}
              unit="дн"
              type="number"
              min={21} max={35} step={1}
              onChange={v => updateLifestyle({ cycleLengthDays: v ?? 28 })}
              placeholder="28"
            />
          </FieldRow>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6, lineHeight: 1.5 }}>
            {cycle
              ? `Сейчас: ${cycle.label.toLowerCase()} фаза, ${cycle.cycleDay}-й день из ${cycle.cycleLength}. По ней считаются женские E2/ЛГ/ФСГ — в анализе лабораторий и в отчёте.`
              : cycleDateRaw
                ? 'Дату не удалось разобрать — нужен формат ГГГГ-ММ-ДД (например 2026-11-01). Пока дата не читается, женские гормоны оцениваются по объединению фаз.'
                : 'Укажите дату — женские E2/ЛГ/ФСГ будут сравниваться с коридором текущей фазы, а не «по фазе» вообще.'}
          </div>
        </>
      )}

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
});
