import React, { useMemo, useState } from 'react';
import {
  loadBioStackProfile, saveBioStackProfile, autoFillFromMainProfile,
  getProfileCompleteness, getDefaultBioStackProfile,
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
const cardBtn: React.CSSProperties = {
  ...GLASS, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
  justifyContent: 'space-between', cursor: 'pointer', minHeight: 88, width: '100%',
  transition: 'transform 0.12s ease, box-shadow 0.12s ease', textAlign: 'left',
};
const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 14,
};
const modalBox: React.CSSProperties = {
  ...GLASS, width: '100%', maxWidth: 460, maxHeight: '88vh', overflowY: 'auto', padding: 20,
};
const dim = { color: 'rgba(235,235,245,0.6)', fontSize: 13 };
const sel = (on: boolean): React.CSSProperties => ({
  ...GLASS, padding: '9px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 13,
  border: on ? '1.5px solid #00e68a' : '0.5px solid rgba(255,255,255,0.1)',
  background: on ? 'rgba(0,230,138,0.12)' : 'rgba(118,118,128,0.12)', flex: '1 1 calc(50% - 6px)',
});

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
          <div style={{ ...cardBtn, minHeight: 0, width: 'auto', padding: '6px 12px', fontSize: 13, background: 'rgba(118,118,128,0.18)' }} onClick={onClose}>Готово</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...dim, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
    </div>
  );
}

function Tags({ options, selected, onToggle }: { options: { v: string; l: string }[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <>
      {options.map(o => (
        <div key={o.v} style={sel(selected.includes(o.v))} onClick={() => onToggle(o.v)}>{o.l}</div>
      ))}
    </>
  );
}

function Checklist({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <>
      {options.map(o => (
        <div key={o} style={sel(selected.includes(o))} onClick={() => onToggle(o)}>{o}</div>
      ))}
    </>
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
        style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: 'none', background: 'rgba(118,118,128,0.12)', color: '#fff', fontSize: 14, outline: 'none' }}
      />
      <div style={{ ...dim, fontSize: 12, marginTop: 5 }}>Нажмите Enter для добавления</div>
    </div>
  );
}

/* ============================ Карточки данных ============================ */

type Patch = Partial<ReturnType<typeof getDefaultBioStackProfile>>;

function ProfileTab(props: {
  onAppliedToRun?: () => void; onToRun?: () => void;
  onShowToast?: (msg: string) => void; onToast?: (msg: string) => void;
  // Optional controlled-mode props (BioStackAIScreen passes these). When provided, the parent owns
  // the profile state and ProfileTab keeps it in sync (other tabs read the parent's profile).
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
  const [open, setOpen] = useState<string | null>(null);
  const [lab, setLab] = useState(getLabDiary());

  const u = (patch: Patch) => { const np = { ...p, ...patch } as typeof p; setP(np); };
  const autoFill = () => {
    const { patch, autoKeys } = autoFillFromMainProfile();
    const np = { ...p, ...patch } as typeof p; setP(np);
    showToast(`Автозаполнено из профиля: ${autoKeys.length} полей`);
  };
  const quickStart = () => {
    const d = getDefaultBioStackProfile();
    const np = { ...p, experience: d.experience, goals: d.goals, aasStatus: d.aasStatus,
      budget: d.budget, stackComplexity: d.stackComplexity, healthConditions: d.healthConditions,
      targetOrgans: d.targetOrgans, targetSystems: d.targetSystems, sex: p.sex || 'male',
      age: p.age || 30, weight: p.weight || 80, height: p.height || 175 } as typeof p;
    setP(np); showToast('Быстрый старт применён');
  };

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

  const card = (id: string, icon: string, title: string, preview: string, filled: boolean) => (
    <div key={id} style={cardBtn} onClick={() => setOpen(id)}>
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{icon} {title}</div>
        <div style={{ width: 9, height: 9, borderRadius: 9, background: filled ? '#00e68a' : 'rgba(235,235,245,0.25)' }} />
      </div>
      <div style={{ ...dim, fontSize: 12.5, marginTop: 6, lineHeight: 1.35 }}>{preview}</div>
    </div>
  );

  return (
    <div style={{ padding: '14px 12px 40px' }}>
      {/* HERO — Профиль */}
      <div style={{ ...GLASS, marginBottom: 14, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>🧬 Профиль</div>
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
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ ...cardBtn, minHeight: 0, flex: 1, padding: '10px 12px', background: 'linear-gradient(135deg,#00e68a,#00b8ff)', color: '#06281c', fontWeight: 700, fontSize: 13, justifyContent: 'center', alignItems: 'center' }}
            onClick={autoFill}>⟳ Автозаполнить из профиля</div>
          <div style={{ ...cardBtn, minHeight: 0, flex: 1, padding: '10px 12px', background: 'rgba(118,118,128,0.18)', justifyContent: 'center', alignItems: 'center', fontSize: 13, fontWeight: 600 }}
            onClick={quickStart}>⚡ Быстрый старт</div>
        </div>
      </div>

      {/* Сетка 10 карточек */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {card('labs', '🧪', 'Анализы', labCount ? `${labCount} записей в дневнике` : 'Нет данных', labCount > 0)}
        {card('joint', '🦵', 'Симптомы суставов', jointCount ? `${jointCount} отмечено` : 'Боль, скованность…', jointCount > 0)}
        {card('neuro', '🧠', 'Нейротоксичность', neuroCount ? `${neuroCount} отмечено` : 'Тревога, бессонница…', neuroCount > 0)}
        {card('cns', '⚡', 'Симптомы ЦНС', cnsCount ? `${cnsCount} отмечено` : 'Головокружение, судороги…', cnsCount > 0)}
        {card('injuries', '🚑', 'Травмы', injuryCount ? `${injuryCount} записано` : 'Локации травм', injuryCount > 0)}
        {card('supps', '💊', 'Принимаю БАД', supCount ? `${supCount} позиций` : 'Текущие добавки', supCount > 0)}
        {card('meds', '🏥', 'Принимаю аптеку', medCount ? `${medCount} позиций` : 'Лекарства', medCount > 0)}
        {card('avoidSup', '🚫', 'Исключить БАД', avoidSup ? `${avoidSup} исключено` : 'Нежелательные', avoidSup > 0)}
        {card('avoidMed', '⛔', 'Исключить аптеку', avoidMed ? `${avoidMed} исключено` : 'Нежелательные', avoidMed > 0)}
        {card('params', '🎯', 'Цели и курс', (p.goals?.length ? 'Цели заданы' : 'Цели, PED, бюджет…'), !!p.goals?.length)}
      </div>

      {open === 'labs' && <LabsPopup lab={lab} onClose={() => { setLab(getLabDiary()); setOpen(null); }} onAuto={autoFill} />}
      {open === 'joint' && <SymptomPopup title="Симптомы суставов / связок" options={JOINT_SYMPTOMS} value={p.jointSymptoms} onSave={v => u({ jointSymptoms: v })} onClose={() => setOpen(null)} onAuto={autoFill} />}
      {open === 'neuro' && <SymptomPopup title="Симптомы нейротоксичности" options={NEURO_SYMPTOMS} value={p.neuroSymptoms} onSave={v => u({ neuroSymptoms: v })} onClose={() => setOpen(null)} onAuto={autoFill} />}
      {open === 'cns' && <SymptomPopup title="Симптомы ЦНС" options={CNS_SYMPTOMS} value={p.cnsSymptoms} onSave={v => u({ cnsSymptoms: v })} onClose={() => setOpen(null)} onAuto={autoFill} />}
      {open === 'injuries' && <TagPopup title="Травмы" value={p.injuries} placeholder="Локация (напр. Плечо)" onSave={v => u({ injuries: v })} onClose={() => setOpen(null)} onAuto={autoFill} />}
      {open === 'supps' && <SuppPopup title="Принимаю БАД" value={p.currentSupplements} onSave={v => u({ currentSupplements: v })} onClose={() => setOpen(null)} onAuto={autoFill} />}
      {open === 'meds' && <TagPopup title="Принимаю аптеку" value={p.currentMeds} placeholder="Название препарата" onSave={v => u({ currentMeds: v })} onClose={() => setOpen(null)} onAuto={autoFill} />}
      {open === 'avoidSup' && <SuppPopup title="Исключить БАД" value={p.avoidIds} onSave={v => u({ avoidIds: v })} onClose={() => setOpen(null)} onAuto={autoFill} />}
      {open === 'avoidMed' && <TagPopup title="Исключить аптеку" value={p.avoidMeds} placeholder="Название препарата" onSave={v => u({ avoidMeds: v })} onClose={() => setOpen(null)} onAuto={autoFill} />}
      {open === 'params' && <ParamsPopup p={p} u={u} onClose={() => setOpen(null)} onAuto={autoFill} />}
    </div>
  );
}

/* ============================ Попапы ============================ */

function AutoBtn({ onAuto }: { onAuto: () => void }) {
  return (
    <div style={{ ...cardBtn, minHeight: 0, width: '100%', padding: '9px 12px', background: 'rgba(0,230,138,0.1)', border: '0.5px solid rgba(0,230,138,0.3)', color: '#00e68a', fontSize: 13, fontWeight: 600, justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}
      onClick={onAuto}>⟳ Заполнить из профиля</div>
  );
}

function LabsPopup({ lab, onClose, onAuto }: { lab: any[]; onClose: () => void; onAuto: () => void }) {
  return (
    <Modal title="🧪 Анализы" onClose={onClose}>
      <AutoBtn onAuto={onAuto} />
      {!lab || lab.length === 0 && <div style={{ ...dim }}>Данные из дневника анализов отсутствуют. Заполните их на вкладке «Лаборатория».</div>}
      {lab.map((d: any, i: number) => (
        <div key={i} style={{ ...GLASS, marginBottom: 8, padding: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{d.date}</div>
          <div style={{ ...dim, fontSize: 12.5 }}>{d.totalMarkers} маркеров · аномальных: {d.abnormalCount}</div>
          {d.note && <div style={{ ...dim, fontSize: 12.5, marginTop: 4 }}>{d.note}</div>}
        </div>
      ))}
    </Modal>
  );
}

function SymptomPopup({ title, options, value, onSave, onClose, onAuto }: {
  title: string; options: string[]; value: string[]; onSave: (v: string[]) => void;
  onClose: () => void; onAuto: () => void;
}) {
  const [v, setV] = useState<string[]>(value || []);
  return (
    <Modal title={title} onClose={onClose}>
      <AutoBtn onAuto={onAuto} />
      <Checklist options={options} selected={v} onToggle={x => setV(v.includes(x) ? v.filter(y => y !== x) : [...v, x])} />
      <div style={{ ...cardBtn, minHeight: 0, width: '100%', padding: '11px 12px', background: 'linear-gradient(135deg,#00e68a,#00b8ff)', color: '#06281c', fontWeight: 700, fontSize: 14, justifyContent: 'center', alignItems: 'center', marginTop: 14 }}
        onClick={() => onSave(v)}>Сохранить</div>
    </Modal>
  );
}

function TagPopup({ title, value, placeholder, onSave, onClose, onAuto }: {
  title: string; value: string[]; placeholder: string; onSave: (v: string[]) => void;
  onClose: () => void; onAuto: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <AutoBtn onAuto={onAuto} />
      <TagInput values={value || []} placeholder={placeholder} onChange={onSave} />
    </Modal>
  );
}

function SuppPopup({ title, value, onSave, onClose, onAuto }: {
  title: string; value: string[]; onSave: (v: string[]) => void; onClose: () => void; onAuto: () => void;
}) {
  const [v, setV] = useState<string[]>(value || []);
  return (
    <Modal title={title} onClose={onClose}>
      <AutoBtn onAuto={onAuto} />
      <div style={{ ...dim, fontSize: 12.5, marginBottom: 8 }}>Выберите из каталога поддержки:</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Tags options={SUPP_OPTS} selected={v} onToggle={x => setV(v.includes(x) ? v.filter(y => y !== x) : [...v, x])} />
      </div>
      <div style={{ ...cardBtn, minHeight: 0, width: '100%', padding: '11px 12px', background: 'linear-gradient(135deg,#00e68a,#00b8ff)', color: '#06281c', fontWeight: 700, fontSize: 14, justifyContent: 'center', alignItems: 'center', marginTop: 14 }}
        onClick={() => onSave(v)}>Сохранить ({v.length})</div>
    </Modal>
  );
}

function ParamsPopup({ p, u, onClose, onAuto }: {
  p: any; u: (patch: Patch) => void; onClose: () => void; onAuto: () => void;
}) {
  const toggle = (key: keyof Patch, v: string) => {
    const cur = (p[key] as string[]) || [];
    u({ [key]: cur.includes(v) ? cur.filter((x: string) => x !== v) : [...cur, v] } as Patch);
  };
  const setOne = (key: keyof Patch, v: string) => u({ [key]: v } as Patch);
  const setVal = (key: keyof Patch, v: any) => u({ [key]: v } as Patch);

  return (
    <Modal title="🎯 Цели и параметры курса" onClose={onClose}>
      <AutoBtn onAuto={onAuto} />
      <Row label="Пол">
        {SEX_OPTS.map(o => <div key={o.v} style={sel(p.sex === o.v)} onClick={() => setOne('sex', o.v)}>{o.l}</div>)}
      </Row>
      <Row label="Возраст / Вес / Рост">
        <input value={p.age || ''} placeholder="Возраст" inputMode="numeric" onChange={e => setVal('age', Number(e.target.value) || 0)}
          style={inp} />
        <input value={p.weight || ''} placeholder="Вес, кг" inputMode="numeric" onChange={e => setVal('weight', Number(e.target.value) || 0)}
          style={inp} />
        <input value={p.height || ''} placeholder="Рост, см" inputMode="numeric" onChange={e => setVal('height', Number(e.target.value) || 0)}
          style={inp} />
      </Row>
      <Row label="Уровень">
        {EXP_OPTS.map(o => <div key={o.v} style={sel(p.experience === o.v)} onClick={() => setOne('experience', o.v)}>{o.l}</div>)}
      </Row>
      <Row label="Цели">
        {GOAL_OPTS.map(o => <div key={o.v} style={sel((p.goals || []).includes(o.v))} onClick={() => toggle('goals', o.v)}>{o.l}</div>)}
      </Row>
      <Row label="Статус PED">
        {AAS_OPTS.map(o => <div key={o.v} style={sel(p.aasStatus === o.v)} onClick={() => setOne('aasStatus', o.v)}>{o.l}</div>)}
      </Row>
      <Row label="Бюджет">
        {BUDGET_OPTS.map(o => <div key={o.v} style={sel(p.budget === o.v)} onClick={() => setOne('budget', o.v)}>{o.l}</div>)}
      </Row>
      <Row label="Сложность стека">
        {COMPLEXITY_OPTS.map(o => <div key={o.v} style={sel(p.stackComplexity === o.v)} onClick={() => setOne('stackComplexity', o.v)}>{o.l}</div>)}
      </Row>
      <Row label="Класс препаратов">
        {ADCLASS_OPTS.map(o => <div key={o.v} style={sel(p.adClass === o.v)} onClick={() => setOne('adClass', o.v)}>{o.l}</div>)}
      </Row>
      <Row label="Состояния здоровья">
        {HEALTH_OPTS.map(o => <div key={o.v} style={sel((p.healthConditions || []).includes(o.v))} onClick={() => toggle('healthConditions', o.v)}>{o.l}</div>)}
      </Row>
      <Row label="Органы-мишени">
        {ORGAN_OPTS.map(o => <div key={o.v} style={sel((p.targetOrgans || []).includes(o.v))} onClick={() => toggle('targetOrgans', o.v)}>{o.l}</div>)}
      </Row>
      <Row label="Системы">
        {SYSTEM_OPTS.map(o => <div key={o.v} style={sel((p.targetSystems || []).includes(o.v))} onClick={() => toggle('targetSystems', o.v)}>{o.l}</div>)}
      </Row>
    </Modal>
  );
}

const inp: React.CSSProperties = {
  width: 'calc(33% - 6px)', padding: '9px 10px', borderRadius: 10, border: 'none',
  background: 'rgba(118,118,128,0.12)', color: '#fff', fontSize: 13, outline: 'none',
};

export default ProfileTab;
