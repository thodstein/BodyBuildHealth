import React, { useState } from 'react';
import { loadBioStackProfile, saveBioStackProfile, getDefaultBioStackProfile, BioStackProfile } from '../../engines/biostack-ai.engine';

const JOINT_SYMPTOMS = [
  'Боль в суставах', 'Скованность по утрам', 'Отёк сустава', 'Хруст',
  'Сниженная подвижность', 'Воспаление (артрит)', 'Боль при нагрузке',
];
const NEURO_SYMPTOMS = [
  'Тревожность', 'Бессонница', 'Раздражительность', 'Упадок сил',
  'Трудности с концентрацией', 'Депрессия', 'Эмоциональная нестабильность',
];
const CNS_SYMPTOMS = [
  'Головокружение', 'Спутанность сознания', 'Судороги', 'Тремор',
  'Парестезия (онемение)', 'Нарушение координации', 'Мигрень', 'Помутнение зрения',
];

const btnPrimary: React.CSSProperties = {
  padding: '12px 14px', background: 'linear-gradient(135deg,#00e68a,#00b8ff)',
  color: '#06281c', fontWeight: 700, fontSize: 14, textAlign: 'center', cursor: 'pointer',
  borderRadius: 10, border: 'none',
};
const inputS: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 10, border: 'none',
  background: 'rgba(118,118,128,0.14)', color: '#fff', fontSize: 14, outline: 'none',
};

type Step = 'symptoms' | 'supplements';

export function BioStackOnboardingWizard(props: { onComplete: (p: BioStackProfile) => void }) {
  const [step, setStep] = useState<Step>('symptoms');
  const [symptoms, setSymptoms] = useState({ joint: [] as string[], neuro: [] as string[], cns: [] as string[] });
  const [supplements, setSupplements] = useState({ current: [] as string[], meds: [] as string[] });

  const base = loadBioStackProfile();

  const toggle = (arr: string[], v: string) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  const finish = () => {
    const profile: BioStackProfile = {
      ...base,
      jointSymptoms: symptoms.joint,
      neuroSymptoms: symptoms.neuro,
      cnsSymptoms: symptoms.cns,
      currentSupplements: supplements.current,
      currentMeds: supplements.meds,
      drugAllergies: base.drugAllergies || [],
      avoidIds: base.avoidIds || [],
      avoidMeds: base.avoidMeds || [],
      autoFilledFields: base.autoFilledFields || [],
    };
    saveBioStackProfile(profile);
    props.onComplete(profile);
  };

  const renderSymptoms = () => (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6 }}>СУСТАВЫ / СВЯЗКИ</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {JOINT_SYMPTOMS.map(s => (
            <div key={s} onClick={() => setSymptoms({ ...symptoms, joint: toggle(symptoms.joint, s) })}
              style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                background: symptoms.joint.includes(s) ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
                border: symptoms.joint.includes(s) ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)' }}>
              {s}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6 }}>НЕЙРОТОКСИЧНОСТЬ</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {NEURO_SYMPTOMS.map(s => (
            <div key={s} onClick={() => setSymptoms({ ...symptoms, neuro: toggle(symptoms.neuro, s) })}
              style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                background: symptoms.neuro.includes(s) ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
                border: symptoms.neuro.includes(s) ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)' }}>
              {s}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6 }}>СИМПТОМЫ ЦНС</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CNS_SYMPTOMS.map(s => (
            <div key={s} onClick={() => setSymptoms({ ...symptoms, cns: toggle(symptoms.cns, s) })}
              style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                background: symptoms.cns.includes(s) ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
                border: symptoms.cns.includes(s) ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)' }}>
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSupplements = () => (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6 }}>ПРИНИМАЮ БАДЫ</div>
        <input style={{ ...inputS, marginBottom: 8 }} placeholder="Название БАД, Enter для добавления"
          onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { setSupplements({ ...supplements, current: [...supplements.current, e.currentTarget.value.trim()] }); e.currentTarget.value = ''; }} } />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {supplements.current.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'rgba(0,230,138,0.1)', borderRadius: 6, fontSize: 11 }}>
              {s} <span onClick={() => setSupplements({ ...supplements, current: supplements.current.filter((_, j) => j !== i) })} style={{ cursor: 'pointer', color: '#ff1744' }}>✕</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6 }}>ПРИНИМАЮ ИЗ АПТЕКИ</div>
        <input style={{ ...inputS, marginBottom: 8 }} placeholder="Название препарата, Enter для добавления"
          onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { setSupplements({ ...supplements, meds: [...supplements.meds, e.currentTarget.value.trim()] }); e.currentTarget.value = ''; }} } />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {supplements.meds.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'rgba(0,230,138,0.1)', borderRadius: 6, fontSize: 11 }}>
              {s} <span onClick={() => setSupplements({ ...supplements, meds: supplements.meds.filter((_, j) => j !== i) })} style={{ cursor: 'pointer', color: '#ff1744' }}>✕</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '12px 8px 24px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setStep('symptoms')} style={{ ...btnPrimary, flex: 1, opacity: step === 'symptoms' ? 1 : 0.5 }}>🤕 Симптомы</button>
        <button onClick={() => setStep('supplements')} style={{ ...btnPrimary, flex: 1, opacity: step === 'supplements' ? 1 : 0.5 }}>💊 Приём</button>
      </div>
      {step === 'symptoms' && renderSymptoms()}
      {step === 'supplements' && renderSupplements()}
      <button onClick={finish} style={{ ...btnPrimary, width: '100%', marginTop: 16 }}>Завершить настройку</button>
    </div>
  );
}