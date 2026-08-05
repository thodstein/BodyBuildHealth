/**
 * UserDietSection — секция "Питание" вкладки Пользователь.
 * Использует PopupValueEditor для ввода значений через попап.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, FieldRow, PopupValueEditor, BoolChip, colors } from '../ui';
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
        <PopupValueEditor
          label="Тип питания"
          value={nutrition.dietType}
          type="select"
          options={DIET_TYPES}
          onChange={v => updateNutrition({ dietType: v as any })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Приёмов пищи в день"
          value={nutrition.mealsPerDay}
          type="number"
          min={2} max={8}
          onChange={v => updateNutrition({ mealsPerDay: v ?? 3 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Навык готовки"
          value={nutrition.cookingSkill}
          type="select"
          options={COOKING_SKILLS}
          onChange={v => updateNutrition({ cookingSkill: v as any })}
          placeholder="—"
        />
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
        <PopupValueEditor
          label="Белок/кг"
          value={nutrition.proteinPerKg}
          unit="г/кг"
          type="number"
          min={0.8} max={4} step={0.1}
          onChange={v => updateNutrition({ proteinPerKg: v ?? 1.8 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Клетчатка"
          value={nutrition.fiberG}
          unit="г/день"
          type="number"
          min={10} max={80}
          onChange={v => updateNutrition({ fiberG: v ?? 25 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Омега-3"
          value={nutrition.omega3G}
          unit="г/день"
          type="number"
          min={0} max={10} step={0.1}
          onChange={v => updateNutrition({ omega3G: v ?? 1.5 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Натрий"
          value={nutrition.sodiumG}
          unit="г/день"
          type="number"
          min={0.5} max={10} step={0.1}
          onChange={v => updateNutrition({ sodiumG: v ?? 3 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Калий"
          value={nutrition.potassiumG}
          unit="г/день"
          type="number"
          min={0.5} max={10} step={0.1}
          onChange={v => updateNutrition({ potassiumG: v ?? 3 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Алкоголь/нед"
          value={nutrition.alcoholPerWeek}
          unit="дринков"
          type="number"
          min={0} max={30}
          onChange={v => updateNutrition({ alcoholPerWeek: v ?? 0 })}
          placeholder="—"
        />
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
