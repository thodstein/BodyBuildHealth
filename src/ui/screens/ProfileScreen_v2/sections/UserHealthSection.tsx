/**
 * UserHealthSection — секция "Здоровье" вкладки Пользователь.
 * Хронические заболевания, генетика, травмы + 8 системных подкарточек.
 * Использует PopupValueEditor для ввода значений через попап.
 */
import React from 'react';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, FieldRow, PopupValueEditor, BoolChip, SliderInput, GroupHeader, colors } from '../ui';
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

const LDL_OPTIONS = [
  { id: 'low', label: 'Низкий' },
  { id: 'normal', label: 'Норма' },
  { id: 'high', label: 'Высокий' },
  { id: 'very_high', label: 'Очень высокий' },
];
const HDL_OPTIONS = [
  { id: 'normal', label: 'Норма' },
  { id: 'low', label: 'Низкий' },
];

const COMMON_INJURIES = [
  'Поясница', 'Колено', 'Плечо', 'Локоть', 'Запястье',
  'Шея', 'Бедро', 'Голеностоп', 'Бицепс', 'Трицепс',
];

export const UserHealthSection: React.FC = () => {
  const [health, updateHealth] = useSectionState('health');

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
        <GroupHeader icon="⚠" title="Хронические заболевания" color={colors.danger} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CHRONIC_CONDITIONS_LIST.map(c => (
            <BoolChip
              key={c.id}
              label={c.label}
              checked={(Array.isArray(health.chronicConditions) ? health.chronicConditions : []).includes(c.id)}
              onChange={() => {
                const arr = Array.isArray(health.chronicConditions) ? health.chronicConditions : [];
                updateHealth({
                  chronicConditions: arr.includes(c.id)
                    ? arr.filter(x => x !== c.id)
                    : [...arr, c.id],
                });
              }}
              color={colors.danger}
            />
          ))}
        </div>
      </div>

      {/* Генетика */}
      <div style={{ marginBottom: 16 }}>
        <GroupHeader icon="🧬" title="Генетика (SNP)" color={colors.purple} />
        <FieldRow cols={2}>
          {SNP_LIST.map(snp => (
            <PopupValueEditor
              key={snp.id}
              label={snp.label}
              value={health.genetics?.[snp.id]}
              type="select"
              options={SNP_GENOTYPES}
              onChange={v => updateHealth({ genetics: { ...(health.genetics || {}), [snp.id]: v } })}
              placeholder="—"
            />
          ))}
        </FieldRow>
      </div>

      {/* Кардио */}
      <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: 'rgba(239,68,68,0.05)', border: `1px solid ${colors.dangerDim}` }}>
        <GroupHeader icon="❤️" title="Кардио" color={colors.danger} style={{ marginBottom: 10 }} />
        <FieldRow cols={3}>
          <PopupValueEditor
            label="Стадия АД"
            value={health.bpStage}
            type="select"
            options={BP_STAGES}
            onChange={v => updateHealth({ bpStage: v as any })}
            placeholder="—"
          />
          <PopupValueEditor
            label="Гематокрит"
            value={health.hctElevation}
            type="select"
            options={HCT_LEVELS}
            onChange={v => updateHealth({ hctElevation: v as any })}
            placeholder="—"
          />
          <PopupValueEditor
            label="ЧСС покоя"
            value={health.heartRate}
            unit="уд/мин"
            type="number"
            min={30} max={150}
            onChange={v => updateHealth({ heartRate: v ?? 0 })}
            placeholder="—"
          />
          <PopupValueEditor
            label="LDL"
            value={health.ldlElevation}
            type="select"
            options={LDL_OPTIONS}
            onChange={v => updateHealth({ ldlElevation: v })}
            placeholder="—"
          />
          <PopupValueEditor
            label="HDL"
            value={health.hdlLow ? 'low' : 'normal'}
            type="select"
            options={HDL_OPTIONS}
            onChange={v => updateHealth({ hdlLow: v === 'low' })}
            placeholder="—"
          />
          <PopupValueEditor
            label="Триглицериды"
            value={health.triglycerides}
            type="select"
            options={TRIGL}
            onChange={v => updateHealth({ triglycerides: v as any })}
            placeholder="—"
          />
        </FieldRow>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <BoolChip
            label="Сердечно-сосудистые в анамнезе"
            checked={health.previousCVD}
            onChange={v => updateHealth({ previousCVD: v })}
            color={colors.danger}
          />
          <BoolChip
            label="ССЗ в семье"
            checked={health.familyCVD}
            onChange={v => updateHealth({ familyCVD: v })}
            color={colors.danger}
          />
        </div>
      </div>

      {/* Неврология */}
      <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: 'rgba(139,92,246,0.05)', border: `1px solid ${colors.purpleDim}` }}>
        <GroupHeader icon="🧠" title="Неврология" color={colors.purple} style={{ marginBottom: 10 }} />
        <FieldRow cols={3}>
          <SliderInput label="Дофамин (1-5)" value={health.dopamineScore} onChange={v => updateHealth({ dopamineScore: v })} min={1} max={5} color={colors.purple} />
          <SliderInput label="Серотонин (1-5)" value={health.serotoninScore} onChange={v => updateHealth({ serotoninScore: v })} min={1} max={5} color={colors.purple} />
          <SliderInput label="Агрессия (1-5)" value={health.aggressionScore} onChange={v => updateHealth({ aggressionScore: v })} min={1} max={5} color={colors.purple} />
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
      <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: 'rgba(34,197,94,0.05)', border: `1px solid ${colors.greenDim}` }}>
        <GroupHeader icon="🍽" title="ЖКТ" color={colors.green} style={{ marginBottom: 10 }} />
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
      <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: 'rgba(236,72,153,0.05)', border: `1px solid ${colors.pinkDim}` }}>
        <GroupHeader icon="💭" title="Психология" color={colors.pink} style={{ marginBottom: 10 }} />
        <FieldRow cols={3}>
          <SliderInput label="Страх потери (1-5)" value={health.fearOfLoss} onChange={v => updateHealth({ fearOfLoss: v })} min={1} max={5} color={colors.pink} />
          <SliderInput label="Одержимость зеркалом (1-5)" value={health.mirrorObsession} onChange={v => updateHealth({ mirrorObsession: v })} min={1} max={5} color={colors.pink} />
          <SliderInput label="Апатия off-cycle (1-5)" value={health.apathyOffCycle} onChange={v => updateHealth({ apathyOffCycle: v })} min={1} max={5} color={colors.pink} />
        </FieldRow>
      </div>

      {/* ОДА */}
      <div style={{ marginBottom: 16 }}>
        <GroupHeader icon="🦴" title="Опорно-двигательный аппарат" color={colors.orange} />
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
          {(Array.isArray(health.injuries) ? health.injuries : []).filter(Boolean).map((inj, i) => (
            <span key={i} style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 11,
              background: `${colors.warning}22`, color: colors.warning,
              border: `1px solid ${colors.warning}44`, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {inj?.location || '—'}
              <span
                onClick={() => updateHealth({ injuries: (Array.isArray(health.injuries) ? health.injuries : []).filter((_, j) => j !== i) })}
                style={{ cursor: 'pointer', opacity: 0.7 }}>✕</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {COMMON_INJURIES.filter(loc => !(Array.isArray(health.injuries) ? health.injuries : []).some(i => i?.location === loc)).map(loc => (
            <button
              key={loc}
              onClick={() => updateHealth({ injuries: [...(Array.isArray(health.injuries) ? health.injuries : []), { id: 'inj_' + Date.now(), location: loc, type: 'muscle', painLevel: 3, movementLimit: 'mild', side: 'both', chronic: false, date: new Date().toISOString().slice(0, 10) }] })}
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
        <GroupHeader icon="📋" title="Эпикриз" color={colors.teal} />
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
        <GroupHeader icon="🦷" title="Стоматология" color={colors.blue} />
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
        <GroupHeader icon="☣️" title="Токсическая нагрузка" color={colors.warning} />
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
        <GroupHeader icon="💊" title="Аллергии на лекарства и исключения" color={colors.pink} />
        <FieldRow cols={2}>
          <PopupValueEditor
            label="Аллергия на лекарства"
            value={health.drugAllergies}
            type="text"
            onChange={v => updateHealth({ drugAllergies: v })}
            placeholder="пенициллин, аспирин..."
          />
          <PopupValueEditor
            label="Исключить БАДы (код)"
            value={(health.excludedSupplements || []).join(', ')}
            type="text"
            onChange={v => updateHealth({ excludedSupplements: String(v).split(',').map(x => x.trim()).filter(Boolean) })}
            placeholder="коды через запятую"
          />
        </FieldRow>
        <div style={{ marginTop: 12 }}>
          <PopupValueEditor
            label="Исключить лекарства (код)"
            value={(health.excludedMeds || []).join(', ')}
            type="text"
            onChange={v => updateHealth({ excludedMeds: String(v).split(',').map(x => x.trim()).filter(Boolean) })}
            placeholder="коды через запятую"
          />
        </div>
      </div>
    </AccordionSection>
  );
};
