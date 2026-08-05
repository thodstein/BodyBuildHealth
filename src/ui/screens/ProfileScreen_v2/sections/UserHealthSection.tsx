/**
 * UserHealthSection — секция "Здоровье" вкладки Пользователь.
 * Хронические заболевания, генетика, травмы + 8 системных подкарточек.
 */
import React, { useState } from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { useProfileSection } from '../../../../core/profile-manager';
import { AccordionSection, Field, FieldRow, NumberInput, TextInput, SelectInput, BoolChip, SliderInput, colors } from '../ui';
import {
  CHRONIC_CONDITIONS_LIST, ALLERGEN_LIST, ORGAN_WEAKNESSES, GENETIC_POLYMORPHISMS,
} from '../../../../core/contraindications';

const BP_STAGES = [
  { id: 'normal', label: 'Нормальное' },
  { id: 'prehypertension', label: 'Прегипертония' },
  { id: 'hypertension1', label: 'Гипертония I' },
  { id: 'hypertension2', label: 'Гипертония II' },
];
const HCT_LEVELS = [
  { id: 'none', label: 'Норма' }, { id: 'mild', label: 'Лёгкое' },
  { id: 'moderate', label: 'Умеренное' }, { id: 'severe', label: 'Выраженное' },
];
const TRIGL = [
  { id: 'normal', label: 'Норма' }, { id: 'high', label: 'Высокие' },
];

const SNP_LIST = [
  { id: 'COMT', label: 'COMT Val158Met' },
  { id: 'MTHFR', label: 'MTHFR C677T' },
  { id: 'ESR1', label: 'ESR1 PvuII' },
  { id: 'AGTR1', label: 'AGTR1 A1166C' },
  { id: 'NOS3', label: 'NOS3 G894T' },
  { id: 'SRD5A2', label: 'SRD5A2' },
  { id: 'CYP3A4', label: 'CYP3A4' },
];
const SNP_GENOTYPES = [
  { id: '++', label: '++ (гомозигота)' },
  { id: '+-', label: '+− (гетерозигота)' },
  { id: '--', label: '−− (гомозигота)' },
];

const COMMON_INJURIES = [
  'Поясница', 'Колено', 'Плечо', 'Локоть', 'Запястье',
  'Шея', 'Бедро', 'Голеностоп', 'Бицепс', 'Трицепс',
];

export const UserHealthSection: React.FC = () => {
  const [health, updateHealth] = useSectionState('health');
  const [nutrition, updateNutrition] = useSectionState('nutrition');

  const toggle = (key: 'chronicConditions' | 'foodAllergies' | 'foodIntolerances' | 'excludedFoods', id: string) => {
    const arr = (nutrition as any)[key] || (health as any)[key] || [];
    const next = arr.includes(id) ? arr.filter((x: string) => x !== id) : [...arr, id];
    if (key === 'foodAllergies' || key === 'foodIntolerances' || key === 'excludedFoods') {
      updateNutrition({ [key]: next } as any);
    } else {
      updateHealth({ [key]: next } as any);
    }
  };

  return (
    <AccordionSection
      id="profile-section-1-2"
      title="1.2 Здоровье"
      subtitle="Хроника, аллергии, генетика, риски, системные показатели"
      icon="🩺"
      color={colors.danger}
      badge={`${(health.chronicConditions?.length || 0) + (health.injuries?.length || 0)} записей`}
    >
      {/* Хронические заболевания */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
          ⚠ Хронические заболевания
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CHRONIC_CONDITIONS_LIST.map(c => (
            <BoolChip
              key={c.id}
              label={c.label}
              checked={(health.chronicConditions || []).includes(c.id)}
              onChange={() => updateHealth({
                chronicConditions: (health.chronicConditions || []).includes(c.id)
                  ? health.chronicConditions.filter(x => x !== c.id)
                  : [...(health.chronicConditions || []), c.id],
              })}
              color={colors.danger}
            />
          ))}
        </div>
      </div>

      {/* Генетика */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
          🧬 Генетика (SNP)
        </div>
        <FieldRow cols={2}>
          {SNP_LIST.map(snp => (
            <Field key={snp.id} label={snp.label}>
              <SelectInput
                value={health.genetics?.[snp.id] || ''}
                onChange={v => updateHealth({ genetics: { ...(health.genetics || {}), [snp.id]: v } })}
                options={SNP_GENOTYPES}
                placeholder="—"
              />
            </Field>
          ))}
        </FieldRow>
      </div>

      {/* Кардио */}
      <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.05)', border: `1px solid ${colors.dangerDim}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.danger, marginBottom: 10 }}>❤️ Кардио</div>
        <FieldRow cols={3}>
          <Field label="Стадия АД">
            <SelectInput
              value={health.bpStage}
              onChange={v => updateHealth({ bpStage: v as any })}
              options={BP_STAGES}
            />
          </Field>
          <Field label="Гематокрит">
            <SelectInput
              value={health.hctElevation}
              onChange={v => updateHealth({ hctElevation: v as any })}
              options={HCT_LEVELS}
            />
          </Field>
          <Field label="ЧСС покоя" hint="уд/мин">
            <NumberInput
              value={health.heartRate}
              onChange={v => updateHealth({ heartRate: v ?? 0 })}
              min={30} max={150}
            />
          </Field>
          <Field label="LDL">
            <SelectInput
              value={health.ldlElevation || ''}
              onChange={v => updateHealth({ ldlElevation: v })}
              options={[
                { id: 'low', label: 'Низкий' },
                { id: 'normal', label: 'Норма' },
                { id: 'high', label: 'Высокий' },
                { id: 'very_high', label: 'Очень высокий' },
              ]}
              placeholder="—"
            />
          </Field>
          <Field label="HDL">
            <SelectInput
              value={health.hdlLow ? 'low' : 'normal'}
              onChange={v => updateHealth({ hdlLow: v === 'low' })}
              options={[
                { id: 'normal', label: 'Норма' },
                { id: 'low', label: 'Низкий' },
              ]}
            />
          </Field>
          <Field label="Триглицериды">
            <SelectInput
              value={health.triglycerides}
              onChange={v => updateHealth({ triglycerides: v as any })}
              options={TRIGL}
            />
          </Field>
        </FieldRow>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <BoolChip
            label="Сердечно-сосудистые в анамнезе"
            checked={health.previousCVD}
            onChange={v => updateHealth({ previousCVD: v })}
            color={colors.danger}
          />
          <BoolChip
            label="Семейная ССЗ"
            checked={health.familyCVD}
            onChange={v => updateHealth({ familyCVD: v })}
            color={colors.danger}
          />
        </div>
      </div>

      {/* Неврология */}
      <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: 'rgba(139,92,246,0.05)', border: `1px solid ${colors.purpleDim}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.purple, marginBottom: 10 }}>🧠 Неврология</div>
        <FieldRow cols={3}>
          <Field label="Дофамин" hint="1-5">
            <SliderInput value={health.dopamineScore} onChange={v => updateHealth({ dopamineScore: v })} min={1} max={5} color={colors.purple} />
          </Field>
          <Field label="Серотонин" hint="1-5">
            <SliderInput value={health.serotoninScore} onChange={v => updateHealth({ serotoninScore: v })} min={1} max={5} color={colors.purple} />
          </Field>
          <Field label="Агрессия" hint="1-5">
            <SliderInput value={health.aggressionScore} onChange={v => updateHealth({ aggressionScore: v })} min={1} max={5} color={colors.purple} />
          </Field>
        </FieldRow>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {[
            { k: 'memoryIssues', l: 'Память' },
            { k: 'focusIssues', l: 'Концентрация' },
            { k: 'slowThinking', l: 'Замедленное мышление' },
            { k: 'headaches', l: 'Головные боли' },
            { k: 'weatherDependent', l: 'Метеозависимость' },
          ].map(o => (
            <BoolChip
              key={o.k}
              label={o.l}
              checked={!!(health as any)[o.k]}
              onChange={v => updateHealth({ [o.k]: v } as any)}
              color={colors.purple}
            />
          ))}
        </div>
      </div>

      {/* ЖКТ */}
      <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.05)', border: `1px solid ${colors.greenDim}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.green, marginBottom: 10 }}>🍽 ЖКТ</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { k: 'bloating', l: 'Вздутие' },
            { k: 'heartburn', l: 'Изжога' },
            { k: 'constipation', l: 'Запоры' },
            { k: 'diarrhea', l: 'Диарея' },
            { k: 'diagnosedIBS', l: 'СРК' },
            { k: 'enzymeSupport', l: 'Ферменты' },
            { k: 'probioticUse', l: 'Пробиотики' },
          ].map(o => (
            <BoolChip
              key={o.k}
              label={o.l}
              checked={!!(health as any)[o.k]}
              onChange={v => updateHealth({ [o.k]: v } as any)}
              color={colors.green}
            />
          ))}
        </div>
      </div>

      {/* Психология */}
      <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: 'rgba(236,72,153,0.05)', border: `1px solid ${colors.pinkDim}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.pink, marginBottom: 10 }}>💭 Психология</div>
        <FieldRow cols={3}>
          <Field label="Страх потери" hint="1-5">
            <SliderInput value={health.fearOfLoss} onChange={v => updateHealth({ fearOfLoss: v })} min={1} max={5} color={colors.pink} />
          </Field>
          <Field label="Одержимость зеркалом" hint="1-5">
            <SliderInput value={health.mirrorObsession} onChange={v => updateHealth({ mirrorObsession: v })} min={1} max={5} color={colors.pink} />
          </Field>
          <Field label="Апатия off-cycle" hint="1-5">
            <SliderInput value={health.apathyOffCycle} onChange={v => updateHealth({ apathyOffCycle: v })} min={1} max={5} color={colors.pink} />
          </Field>
        </FieldRow>
      </div>

      {/* ОДА */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, marginBottom: 8 }}>🦴 Опорно-двигательный аппарат</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {[
            { k: 'jointPain', l: 'Суставы' },
            { k: 'ligamentIssues', l: 'Связки' },
            { k: 'backPain', l: 'Поясница' },
          ].map(o => (
            <BoolChip
              key={o.k}
              label={o.l}
              checked={!!(health as any)[o.k]}
              onChange={v => updateHealth({ [o.k]: v } as any)}
            />
          ))}
        </div>
        <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Травмы:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {(health.injuries || []).map((inj, i) => (
            <span key={i} style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 11,
              background: `${colors.warning}22`, color: colors.warning,
              border: `1px solid ${colors.warning}44`, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {inj.location}
              <span
                onClick={() => updateHealth({ injuries: (health.injuries || []).filter((_, j) => j !== i) })}
                style={{ cursor: 'pointer', opacity: 0.7 }}>✕</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {COMMON_INJURIES.filter(loc => !(health.injuries || []).some(i => i.location === loc)).map(loc => (
            <button
              key={loc}
              onClick={() => updateHealth({ injuries: [...(health.injuries || []), { id: 'inj_' + Date.now(), location: loc, type: 'muscle', painLevel: 3, movementLimit: 'mild', side: 'both', chronic: false, date: new Date().toISOString().slice(0, 10) }] })}
              style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 10,
                background: 'transparent', color: colors.textMuted,
                border: `1px solid ${colors.border}`, cursor: 'pointer',
              }}
            >+ {loc}</button>
          ))}
        </div>
      </div>

      {/* Эпикриз */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, marginBottom: 8 }}>📋 Эпикриз</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { k: 'pastGyno', l: 'Гинекомастия' },
            { k: 'pastLibidoDrop', l: 'Падение либидо' },
            { k: 'pastHctSpike', l: 'Скачок гематокрита' },
            { k: 'pastLiverIssues', l: 'Проблемы с печенью' },
            { k: 'pastKidneyIssues', l: 'Проблемы с почками' },
          ].map(o => (
            <BoolChip
              key={o.k}
              label={o.l}
              checked={!!(health as any)[o.k]}
              onChange={v => updateHealth({ [o.k]: v } as any)}
            />
          ))}
        </div>
      </div>

      {/* Стоматология */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, marginBottom: 8 }}>🦷 Стоматология</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { k: 'bleedingGums', l: 'Кровоточат дёсны' },
            { k: 'looseTeeth', l: 'Шатаются зубы' },
            { k: 'cramps', l: 'Судороги' },
          ].map(o => (
            <BoolChip
              key={o.k}
              label={o.l}
              checked={!!(health as any)[o.k]}
              onChange={v => updateHealth({ [o.k]: v } as any)}
            />
          ))}
        </div>
      </div>

      {/* Токсическая нагрузка */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, marginBottom: 8 }}>☣️ Токсическая нагрузка</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <BoolChip
            label="Вредная работа"
            checked={health.hazardousWork}
            onChange={v => updateHealth({ hazardousWork: v })}
          />
          <BoolChip
            label="Регулярный приём НПВС"
            checked={health.regularNSAIDs}
            onChange={v => updateHealth({ regularNSAIDs: v })}
          />
        </div>
      </div>

      {/* Аллергии и исключения */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, marginBottom: 8 }}>💊 Аллергии на лекарства и исключения</div>
        <Field label="Аллергия на лекарства">
          <TextInput
            value={health.drugAllergies}
            onChange={v => updateHealth({ drugAllergies: v })}
            placeholder="Например: пенициллин, аспирин..."
            maxLength={200}
          />
        </Field>
        <Field label="Исключить БАДы (id)">
          <TextInput
            value={(health.excludedSupplements || []).join(', ')}
            onChange={v => updateHealth({ excludedSupplements: v.split(',').map(x => x.trim()).filter(Boolean) })}
            placeholder="через запятую"
          />
        </Field>
        <Field label="Исключить лекарства (id)">
          <TextInput
            value={(health.excludedMeds || []).join(', ')}
            onChange={v => updateHealth({ excludedMeds: v.split(',').map(x => x.trim()).filter(Boolean) })}
            placeholder="через запятую"
          />
        </Field>
      </div>
    </AccordionSection>
  );
};
