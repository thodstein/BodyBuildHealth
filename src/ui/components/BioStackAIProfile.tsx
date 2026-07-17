import React, { useMemo, useState } from 'react';
import {
  loadBioStackProfile, saveBioStackProfile, autoFillFromMainProfile,
  getProfileCompleteness, getDefaultBioStackProfile, BioStackProfile,
} from '../../engines/biostack-ai.engine';
import { getLabDiary } from '../../engines/lab-diary.engine';
import { SUPPORT_CATALOG_DATA, SYSTEM_LABELS_CATALOG, ORGAN_LABELS } from '../../data/support-database';
import { showToast } from './BioStackAIConstants';

/* ============================ Справочники ============================ */

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

const SEX_OPTS = [{ v: 'male', l: 'Муж' }, { v: 'female', l: 'Жен' }];
const EXP_OPTS = [{ v: 'beginner', l: 'Новичок' }, { v: 'intermediate', l: 'Средний' }, { v: 'advanced', l: 'Продвинутый' }];
const GOAL_OPTS = [
  { v: 'muscle_gain', l: 'Набор массы' }, { v: 'fat_loss', l: 'Жиросжигание' },
  { v: 'recovery', l: 'Восстановление' }, { v: 'endurance', l: 'Выносливость' },
  { v: 'immunity', l: 'Иммунитет' }, { v: 'cognitive', l: 'Когнитивно' }, { v: 'longevity', l: 'Долголетие' },
];
const AAS_OPTS = [{ v: 'none', l: 'Нет' }, { v: 'trt', l: 'TRT' }, { v: 'cycle', l: 'Курс' }, { v: 'pct', l: 'PCT' }, { v: 'bridge', l: 'Мост' }];
const BUDGET_OPTS = [{ v: 'low', l: 'Низкий' }, { v: 'medium', l: 'Средний' }, { v: 'high', l: 'Высокий' }];
const COMPLEXITY_OPTS = [{ v: 'minimal', l: 'Минимальный' }, { v: 'balanced', l: 'Сбалансированный' }, { v: 'comprehensive', l: 'Полный' }];
const ADCLASS_OPTS = [{ v: 'none', l: 'Нет' }, { v: 'sarm', l: 'SARM' }, { v: 'peptide', l: 'Пептиды' }, { v: 'prohormone', l: 'Прогормоны' }];
const HEALTH_OPTS = [
  { v: 'liver', l: 'Печень' }, { v: 'kidney', l: 'Почки' }, { v: 'heart', l: 'Сердце' },
  { v: 'thyroid', l: 'Щитовидная' }, { v: 'stomach', l: 'ЖКТ' }, { v: 'diabetes', l: 'Диабет' },
  { v: 'autoimmune', l: 'Аутоиммунное' }, { v: 'pressure_high', l: 'Гипертония' },
];

const SUPP_OPTS = Object.keys(SUPPORT_CATALOG_DATA).map(id => ({ v: id, l: ((SUPPORT_CATALOG_DATA as any)[id]?.name) || id }));
const ORGAN_OPTS = Object.entries(ORGAN_LABELS as Record<string, string>).map(([v, l]) => ({ v, l }));
const SYSTEM_OPTS = Object.entries(SYSTEM_LABELS_CATALOG as Record<string, string>).map(([v, l]) => ({ v, l }));

/* ============================ UI-примитивы ============================ */

const GLASS: React.CSSProperties = {
  background: 'rgba(28,28,32,0.55)', backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)', borderRadius: 16,
  border: '0.5px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 24px rgba(0,0,0,0.22)', padding: 16,
};
const dim = { color: 'rgba(235,235,245,0.6)', fontSize: 13 };
const sel = (on: boolean): React.CSSProperties => ({
  ...GLASS, padding: '9px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 13,
  border: on ? '1.5px solid #00e68a' : '0.5px solid rgba(255,255,255,0.1)',
  background: on ? 'rgba(0,230,138,0.12)' : 'rgba(118,118,128,0.12)', flex: '1 1 calc(33% - 6px)',
  minWidth: 90, textAlign: 'center',
});
const rowLabel: React.CSSProperties = {
  color: 'rgba(235,235,245,0.6)', fontSize: 12.5, marginBottom: 7,
  textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600,
};
const autoChip: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.12)',
  border: '0.5px solid rgba(0,230,138,0.3)', color: '#00e68a', fontSize: 12,
  fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};
const btnPrimary: React.CSSProperties = {
  ...GLASS, padding: '12px 14px', background: 'linear-gradient(135deg,#00e68a,#00b8ff)',
  color: '#06281c', fontWeight: 700, fontSize: 14, textAlign: 'center', cursor: 'pointer',
};
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none',
  background: 'rgba(118,118,128,0.14)', color: '#fff', fontSize: 14, outline: 'none',
};

/* ============================ Карточки выбора ============================ */

function Selector({ options, value, onChange }: { options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => (
        <div key={o.v} style={sel(value === o.v)} onClick={() => onChange(o.v)}>{o.l}</div>
      ))}
    </div>
  );
}

function Chips({ options, selected, onToggle }: { options: { v: string; l: string }[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => (
        <div key={o.v} style={sel(selected.includes(o.v))} onClick={() => onToggle(o.v)}>{o.l}</div>
      ))}
    </div>
  );
}

function SuppChips({ options, selected, onToggle }: { options: { v: string; l: string }[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 190, overflowY: 'auto', padding: 6, background: 'rgba(0,0,0,0.16)', borderRadius: 10 }}>
      {options.map(o => (
        <div key={o.v} style={sel(selected.includes(o.v))} onClick={() => onToggle(o.v)}>{o.l}</div>
      ))}
    </div>
  );
}

function Checklist({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => (
        <div key={o} style={sel(selected.includes(o))} onClick={() => onToggle(o)}>{o}</div>
      ))}
    </div>
  );
}

function TagInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [t, setT] = useState('');
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {values.map(v => (
          <div key={v} style={{ ...GLASS, padding: '5px 10px', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{v}</span>
            <span style={{ cursor: 'pointer', color: '#ff1744', fontWeight: 700 }} onClick={() => onChange(values.filter(x => x !== v))}>✕</span>
          </div>
        ))}
      </div>
      <input
        value={t} placeholder={placeholder}
        onChange={e => setT(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && t.trim()) { onChange([...values, t.trim()]); setT(''); } }}
        style={inp}
      />
      <div style={{ ...dim, fontSize: 12, marginTop: 5 }}>Нажмите Enter для добавления</div>
    </div>
  );
}

function Section({ icon, title, filled, onAuto, children }: { icon: string; title: string; filled: boolean; onAuto: () => void; children: React.ReactNode }) {
  return (
    <div style={{ ...GLASS, marginBottom: 14, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{icon} {title}</div>
          <div style={{ width: 9, height: 9, borderRadius: 9, background: filled ? '#00e68a' : 'rgba(235,235,245,0.25)' }} />
        </div>
        <div style={autoChip} onClick={onAuto}>⟳ Авто</div>
      </div>
      {children}
    </div>
  );
}

function NumRow({ label, value, placeholder, onChange }: { label: string; value: number; placeholder: string; onChange: (v: number) => void }) {
  return (
    <div style={{ flex: 1, minWidth: 90 }}>
      <div style={rowLabel}>{label}</div>
      <input
        value={value || ''} placeholder={placeholder} inputMode="numeric"
        onChange={e => onChange(Number(e.target.value) || 0)} style={inp}
      />
    </div>
  );
}

/* ============================ Профиль ============================ */

type Patch = Partial<ReturnType<typeof getDefaultBioStackProfile>>;

function ProfileTab(props: {
  onAppliedToRun?: () => void; onToRun?: () => void;
  onShowToast?: (msg: string) => void; onToast?: (msg: string) => void;
  profile?: ReturnType<typeof getDefaultBioStackProfile>;
  setProfile?: (p: ReturnType<typeof getDefaultBioStackProfile>) => void;
  setStackIds?: (ids: string[]) => void;
}) {
  const [internalP, setInternalP] = useState<ReturnType<typeof getDefaultBioStackProfile>>(loadBioStackProfile());
  const p = props.profile ?? internalP;
  const setP = (np: ReturnType<typeof getDefaultBioStackProfile>) => {
    setInternalP(np);
    saveBioStackProfile(np);
    props.setProfile?.(np);
  };
  const [lab, setLab] = useState(getLabDiary());

  const u = (patch: Patch) => { setP({ ...p, ...patch } as typeof p); };
  const autoFill = () => {
    const { patch, autoKeys } = autoFillFromMainProfile();
    const np = { ...p, ...patch } as typeof p; setP(np);
    showToast(`Автозаполнено из профиля: ${autoKeys.length} полей`);
  };
  const toggle = (key: keyof BioStackProfile, v: string) => {
    const cur = (p[key] as string[]) || [];
    u({ [key]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] } as Patch);
  };
  const setOne = (key: keyof BioStackProfile, v: string) => u({ [key]: v } as Patch);
  const setNum = (key: keyof BioStackProfile, v: number) => u({ [key]: v } as Patch);

  const comp = useMemo(() => getProfileCompleteness(p), [p]);

  const injuryCount = (p.injuries || []).length;
  const supCount = (p.currentSupplements || []).length;
  const medCount = (p.currentMeds || []).length;
  const avoidSup = (p.avoidIds || []).length;
  const avoidMed = (p.avoidMeds || []).length;
  const labCount = (lab || []).length;
  const jointCount = (p.jointSymptoms || []).length;
  const neuroCount = (p.neuroSymptoms || []).length;
  const cnsCount = (p.cnsSymptoms || []).length;

  return (
    <div style={{ padding: '14px 12px 48px' }}>
      {/* HERO */}
      <div style={{ ...GLASS, marginBottom: 14, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>🧬 Профиль BioStack</div>
            <div style={{ ...dim, fontSize: 12.5, marginTop: 3 }}>
              {p.sex === 'female' ? 'Жен' : 'Муж'} · {EXP_OPTS.find(e => e.v === p.experience)?.l || '—'} · {p.age || '?'} лет · {p.weight || '?'} кг · {p.height || '?'} см
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#00e68a' }}>{comp.percent}%</div>
            <div style={{ ...dim, fontSize: 11 }}>заполнено</div>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 6, background: 'rgba(118,118,128,0.18)', overflow: 'hidden', margin: '12px 0' }}>
          <div style={{ height: '100%', width: `${comp.percent}%`, background: 'linear-gradient(90deg,#00e68a,#00b8ff)' }} />
        </div>
        <div style={btnPrimary} onClick={autoFill}>⟳ Автозаполнить из основного профиля</div>
      </div>

      {/* Личные данные */}
      <Section icon="👤" title="Личные данные" filled={!!(p.age && p.weight && p.height && p.sex && p.experience)} onAuto={autoFill}>
        <div style={{ marginBottom: 14 }}>
          <div style={rowLabel}>Пол</div>
          <Selector options={SEX_OPTS} value={p.sex} onChange={v => setOne('sex', v)} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <NumRow label="Возраст" value={p.age} placeholder="30" onChange={v => setNum('age', v)} />
          <NumRow label="Вес, кг" value={p.weight} placeholder="80" onChange={v => setNum('weight', v)} />
          <NumRow label="Рост, см" value={p.height} placeholder="175" onChange={v => setNum('height', v)} />
        </div>
        <div>
          <div style={rowLabel}>Уровень подготовки</div>
          <Selector options={EXP_OPTS} value={p.experience} onChange={v => setOne('experience', v)} />
        </div>
      </Section>

      {/* Цели и курс */}
      <Section icon="🎯" title="Цели и курс" filled={!!(p.goals?.length)} onAuto={autoFill}>
        <div style={{ marginBottom: 14 }}>
          <div style={rowLabel}>Цели{((p.goals || []).length) ? ` · ${(p.goals || []).length}` : ''}</div>
          <Chips options={GOAL_OPTS} selected={p.goals || []} onToggle={v => toggle('goals', v)} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 130 }}>
            <div style={rowLabel}>Статус PED</div>
            <Selector options={AAS_OPTS} value={p.aasStatus} onChange={v => setOne('aasStatus', v)} />
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <div style={rowLabel}>Бюджет</div>
            <Selector options={BUDGET_OPTS} value={p.budget} onChange={v => setOne('budget', v)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
          <div style={{ flex: 1, minWidth: 130 }}>
            <div style={rowLabel}>Сложность стека</div>
            <Selector options={COMPLEXITY_OPTS} value={p.stackComplexity} onChange={v => setOne('stackComplexity', v)} />
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <div style={rowLabel}>Класс препаратов</div>
            <Selector options={ADCLASS_OPTS} value={p.adClass} onChange={v => setOne('adClass', v)} />
          </div>
        </div>
        <div style={{ marginTop: 14, maxWidth: 160 }}>
          <NumRow label="Макс. размер стека" value={p.maxStackSize} placeholder="8" onChange={v => setNum('maxStackSize', v)} />
        </div>
      </Section>

      {/* Здоровье */}
      <Section icon="🩺" title="Здоровье" filled={!!(p.healthConditions?.length || p.drugAllergies?.length)} onAuto={autoFill}>
        <div style={{ marginBottom: 14 }}>
          <div style={rowLabel}>Состояния здоровья{(p.healthConditions || []).length ? ` · ${p.healthConditions.length}` : ''}</div>
          <Chips options={HEALTH_OPTS} selected={p.healthConditions || []} onToggle={v => toggle('healthConditions', v)} />
        </div>
        <div>
          <div style={rowLabel}>Аллергии на препараты{(p.drugAllergies || []).length ? ` · ${p.drugAllergies.length}` : ''}</div>
          <TagInput values={p.drugAllergies || []} onChange={v => u({ drugAllergies: v })} placeholder="Напр. Пенициллин" />
        </div>
      </Section>

      {/* Симптомы и травмы */}
      <Section icon="🤕" title="Симптомы и травмы" filled={!!(jointCount || neuroCount || cnsCount || injuryCount)} onAuto={autoFill}>
        <div style={{ marginBottom: 14 }}>
          <div style={rowLabel}>Симптомы суставов / связок{jointCount ? ` · ${jointCount}` : ''}</div>
          <Checklist options={JOINT_SYMPTOMS} selected={p.jointSymptoms || []} onToggle={v => toggle('jointSymptoms', v)} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={rowLabel}>Нейротоксичность{neuroCount ? ` · ${neuroCount}` : ''}</div>
          <Checklist options={NEURO_SYMPTOMS} selected={p.neuroSymptoms || []} onToggle={v => toggle('neuroSymptoms', v)} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={rowLabel}>Симптомы ЦНС{cnsCount ? ` · ${cnsCount}` : ''}</div>
          <Checklist options={CNS_SYMPTOMS} selected={p.cnsSymptoms || []} onToggle={v => toggle('cnsSymptoms', v)} />
        </div>
        <div>
          <div style={rowLabel}>Травмы{injuryCount ? ` · ${injuryCount}` : ''}</div>
          <TagInput values={p.injuries || []} onChange={v => u({ injuries: v })} placeholder="Локация (напр. Плечо)" />
        </div>
      </Section>

      {/* Органы и системы */}
      <Section icon="🫀" title="Органы и системы" filled={!!(p.targetOrgans?.length || p.targetSystems?.length)} onAuto={autoFill}>
        <div style={{ marginBottom: 14 }}>
          <div style={rowLabel}>Органы-мишени{(p.targetOrgans || []).length ? ` · ${p.targetOrgans.length}` : ''}</div>
          <Chips options={ORGAN_OPTS} selected={p.targetOrgans || []} onToggle={v => toggle('targetOrgans', v)} />
        </div>
        <div>
          <div style={rowLabel}>Системы организма{(p.targetSystems || []).length ? ` · ${p.targetSystems.length}` : ''}</div>
          <Chips options={SYSTEM_OPTS} selected={p.targetSystems || []} onToggle={v => toggle('targetSystems', v)} />
        </div>
      </Section>

      {/* Препараты и ограничения */}
      <Section icon="💊" title="Принимаю и исключаю" filled={!!(supCount || medCount || avoidSup || avoidMed)} onAuto={autoFill}>
        <div style={{ marginBottom: 14 }}>
          <div style={rowLabel}>Принимаю БАД сейчас{supCount ? ` · ${supCount}` : ''}</div>
          <SuppChips options={SUPP_OPTS} selected={p.currentSupplements || []} onToggle={v => toggle('currentSupplements', v)} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={rowLabel}>Принимаю из аптеки{medCount ? ` · ${medCount}` : ''}</div>
          <TagInput values={p.currentMeds || []} onChange={v => u({ currentMeds: v })} placeholder="Название препарата" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={rowLabel}>Исключить БАД (нежелательны){avoidSup ? ` · ${avoidSup}` : ''}</div>
          <SuppChips options={SUPP_OPTS} selected={p.avoidIds || []} onToggle={v => toggle('avoidIds', v)} />
        </div>
        <div>
          <div style={rowLabel}>Исключить аптеку (нежелательна){avoidMed ? ` · ${avoidMed}` : ''}</div>
          <TagInput values={p.avoidMeds || []} onChange={v => u({ avoidMeds: v })} placeholder="Название препарата" />
        </div>
      </Section>

      {/* Лаборатория */}
      <Section icon="🧪" title="Лаборатория" filled={labCount > 0} onAuto={autoFill}>
        {!lab || lab.length === 0
          ? <div style={{ ...dim }}>Данные анализов отсутствуют. Заполните их на вкладке «Лаборатория» — они подтянутся сюда автоматически и будут учтены при подборе.</div>
          : <div>
              {lab.map((d: any, i: number) => (
                <div key={i} style={{ ...GLASS, marginBottom: 8, padding: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{d.date}</div>
                  <div style={{ ...dim, fontSize: 12.5 }}>{d.totalMarkers} маркеров · аномальных: {d.abnormalCount}</div>
                  {d.note && <div style={{ ...dim, fontSize: 12.5, marginTop: 4 }}>{d.note}</div>}
                </div>
              ))}
            </div>}
      </Section>
    </div>
  );
}

export default ProfileTab;
