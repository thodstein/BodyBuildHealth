/**
 * UserDietSection — секция "Питание" вкладки Пользователь.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, Field, FieldRow, NumberInput, SelectInput, BoolChip, colors } from '../ui';
import { ALLERGEN_LIST } from '../../../../core/contraindications';

const DIET_TYPES = [
  { id: 'omnivore', label: 'Омнивор' },
  { id: 'vegetarian', label: 'Вегетарианец' },
  { id: 'vegan', label: 'Веган' },
  { id: 'pescatarian', label: 'Пескетарианец' },
  { id: 'keto', label: 'Кето' },
  { id: 'paleo', label: 'Палео' },
  { id: 'mediterranean', label: 'Средиземноморская' },
];
const COOKING_SKILLS = [
  { id: 'none', label: 'Не готовлю' },
  { id: 'basic', label: 'Базовый' },
  { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Продвинутый' },
];

export const UserDietSection: React.FC = () => {
  const [nutrition, updateNutrition] = useSectionState('nutrition');

  const toggle = (key: 'foodAllergies' | 'foodIntolerances' | 'excludedFoods' | 'preferredFoods' | 'tasteProfile' | 'excludedCategories', id: string) => {
    const arr = (nutrition as any)[key] || [];
    const next = arr.includes(id) ? arr.filter((x: string) => x !== id) : [...arr, id];
    updateNutrition({ [key]: next } as any);
  };

  return (
    <AccordionSection
      id="profile-section-1-3"
      title="1.3 Питание"
      subtitle="Диета, аллергии, макронутриенты, БАДы, лекарства"
      icon="🥗"
      color={colors.green}
    >
      <FieldRow cols={3}>
        <Field label="Тип питания">
          <SelectInput
            value={nutrition.dietType}
            onChange={v => updateNutrition({ dietType: v as any })}
            options={DIET_TYPES}
          />
        </Field>
        <Field label="Приёмов пищи в день">
          <NumberInput
            value={nutrition.mealsPerDay}
            onChange={v => updateNutrition({ mealsPerDay: v ?? 3 })}
            min={2} max={8}
          />
        </Field>
        <Field label="Навык готовки">
          <SelectInput
            value={nutrition.cookingSkill}
            onChange={v => updateNutrition({ cookingSkill: v as any })}
            options={COOKING_SKILLS}
          />
        </Field>
      </FieldRow>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, marginBottom: 8 }}>⚠ Аллергии</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALLERGEN_LIST.map(a => (
            <BoolChip
              key={a.id}
              label={a.label}
              checked={(nutrition.foodAllergies || []).includes(a.id)}
              onChange={() => toggle('foodAllergies', a.id)}
              color={colors.danger}
            />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, marginBottom: 8 }}>Непереносимости</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALLERGEN_LIST.map(a => (
            <BoolChip
              key={a.id}
              label={a.label}
              checked={(nutrition.foodIntolerances || []).includes(a.id)}
              onChange={() => toggle('foodIntolerances', a.id)}
              color={colors.warning}
            />
          ))}
        </div>
      </div>

      <FieldRow cols={3}>
        <Field label="Белок/кг" hint="г на кг массы">
          <NumberInput
            value={nutrition.proteinPerKg}
            onChange={v => updateNutrition({ proteinPerKg: v ?? 1.8 })}
            min={0.8} max={4} step={0.1}
          />
        </Field>
        <Field label="Клетчатка" hint="г/день">
          <NumberInput
            value={nutrition.fiberG}
            onChange={v => updateNutrition({ fiberG: v ?? 25 })}
            min={10} max={80}
          />
        </Field>
        <Field label="Омега-3" hint="г/день">
          <NumberInput
            value={nutrition.omega3G}
            onChange={v => updateNutrition({ omega3G: v ?? 1.5 })}
            min={0} max={10} step={0.1}
          />
        </Field>
        <Field label="Натрий" hint="г/день">
          <NumberInput
            value={nutrition.sodiumG}
            onChange={v => updateNutrition({ sodiumG: v ?? 3 })}
            min={0.5} max={10} step={0.1}
          />
        </Field>
        <Field label="Калий" hint="г/день">
          <NumberInput
            value={nutrition.potassiumG}
            onChange={v => updateNutrition({ potassiumG: v ?? 3 })}
            min={0.5} max={10} step={0.1}
          />
        </Field>
        <Field label="Алкоголь/нед" hint="дринков">
          <NumberInput
            value={nutrition.alcoholPerWeek}
            onChange={v => updateNutrition({ alcoholPerWeek: v ?? 0 })}
            min={0} max={30}
          />
        </Field>
      </FieldRow>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <BoolChip
          label="Гистамин-чувствительность"
          checked={nutrition.histamineSensitive}
          onChange={v => updateNutrition({ histamineSensitive: v })}
          color={colors.warning}
        />
        <BoolChip
          label="Низкоуглеводный вечер"
          checked={!!nutrition.eveningLowCarb}
          onChange={v => updateNutrition({ eveningLowCarb: v })}
        />
      </div>

      <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
        💡 БАДы и лекарства управляются в <b>Калькуляторе поддержки</b> (через <code>nutrition.currentSupplements/Medications</code>). Здесь хранятся общие предпочтения.
      </div>
    </AccordionSection>
  );
};
