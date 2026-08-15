/**
 * TrainingPMSection — секция "Личные рекорды (ПМ)" вкладки Тренировки.
 * Главные лифты (1RM) + рабочие максимумы по КОНКРЕТНЫМ упражнениям:
 * категория (группа мышц) → выбор упражнения (5-7 из каталога) → вес.
 * Веса упражнений хранятся в training.workMaxByExercise, а для движков (ББ-авто)
 * автоматически вычисляется training.workMax по мышцам (exerciseWorkMaxToMuscle).
 */
import React, { useMemo, useState } from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, FieldRow, PopupValueEditor, GroupHeader, colors } from '../ui';
import {
  WORKMAX_CATEGORIES,
  countFilledWorkMaxExercises,
  exerciseWorkMaxToMuscle,
} from '../../../../engines/workmax-exercises';

export const TrainingPMSection: React.FC = React.memo(function TrainingPMSection() {
  const [training, updateTraining] = useSectionState('training');
  const workMax = training.workMax || {};
  const workMaxByExercise = training.workMaxByExercise || {};
  const [openCategory, setOpenCategory] = useState<string | null>('chest');

  const filledTotal = useMemo(() => countFilledWorkMaxExercises(workMaxByExercise), [workMaxByExercise]);
  const filledByCategory = useMemo(() => {
    const out: Record<string, number> = {};
    for (const cat of WORKMAX_CATEGORIES) {
      out[cat.id] = cat.exercises.filter((ex) => Number.isFinite(workMaxByExercise[ex.id]) && workMaxByExercise[ex.id] > 0).length;
    }
    return out;
  }, [workMaxByExercise]);

  const updateExercise = (exerciseId: string, val: number | undefined) => {
    const next = { ...workMaxByExercise };
    if (val === undefined || val === 0) {
      delete next[exerciseId];
    } else {
      next[exerciseId] = val;
    }
    // Веса мышц пересчитываются автоматически — движки продолжают работать без правок.
    updateTraining({
      workMaxByExercise: next,
      workMax: exerciseWorkMaxToMuscle(next, workMax),
    });
  };

  const resetCategory = (categoryId: string) => {
    const next = { ...workMaxByExercise };
    const cat = WORKMAX_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) return;
    for (const ex of cat.exercises) delete next[ex.id];
    // Явно удаляем и производный workMax мышцы (иначе legacy-значение останется).
    const nextMuscle = { ...workMax };
    delete nextMuscle[categoryId];
    updateTraining({
      workMaxByExercise: next,
      workMax: exerciseWorkMaxToMuscle(next, nextMuscle),
    });
  };

  return (
    <AccordionSection
      id="profile-section-1-8"
      title="2.2 Личные рекорды (ПМ)"
      subtitle="Главные лифты + рабочие максимумы по упражнениям (группа → упражнение → вес)"
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

      <GroupHeader
        icon="📈"
        title={`Рабочие максимумы по упражнениям (${filledTotal} заполнено)`}
        color={colors.orange}
        style={{ marginTop: 12 }}
      />
      <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8, lineHeight: 1.4 }}>
        Нажмите на группу мышц → выберите упражнение → введите рабочий максимум (кг).
        Вес группы для ББ-авто считается автоматически как максимальный среди её упражнений.
      </div>
      {WORKMAX_CATEGORIES.map(cat => {
        const open = openCategory === cat.id;
        const filled = filledByCategory[cat.id] || 0;
        return (
          <div
            key={cat.id}
            style={{
              border: `1px solid ${open ? colors.orange + '66' : colors.border}`,
              borderRadius: 12,
              marginBottom: 8,
              overflow: 'hidden',
              background: open ? 'rgba(249,115,22,0.05)' : 'rgba(255,255,255,0.02)',
            }}
          >
            <button
              type="button"
              onClick={() => setOpenCategory(open ? null : cat.id)}
              aria-expanded={open}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                border: 'none',
                background: 'transparent',
                color: colors.text,
                cursor: 'pointer',
                fontFamily: 'inherit',
                minHeight: 44,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 16 }}>{cat.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{cat.label}</span>
              <span style={{ fontSize: 11, color: colors.textMuted }}>
                {filled}/{cat.exercises.length}
              </span>
              <span style={{ color: colors.textMuted, fontSize: 12 }}>{open ? '▾' : '▸'}</span>
            </button>
            {open && (
              <div style={{ padding: '4px 12px 12px' }}>
                <FieldRow cols={3} gap={8}>
                  {cat.exercises.map(ex => (
                    <PopupValueEditor
                      key={ex.id}
                      label={ex.name}
                      value={workMaxByExercise[ex.id]}
                      unit="кг"
                      type="number"
                      min={0} max={500} step={2.5}
                      onChange={v => updateExercise(ex.id, v ?? undefined)}
                      placeholder="—"
                      color={colors.orange}
                    />
                  ))}
                </FieldRow>
                {filled > 0 && (
                  <button
                    type="button"
                    onClick={() => resetCategory(cat.id)}
                    style={{
                      marginTop: 8,
                      background: 'transparent',
                      border: 'none',
                      color: '#f87171',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      padding: '6px 8px',
                      borderRadius: 8,
                    }}
                  >
                    🗑 Очистить группу «{cat.label}»
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </AccordionSection>
  );
});
