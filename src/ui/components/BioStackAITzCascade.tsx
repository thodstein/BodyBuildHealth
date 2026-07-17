import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  MARKER_TO_TZ_MECH,
  ALL_TZ_ORGANS,
  ALL_TZ_MECH_IDS,
  type TzOrganId,
  type TzMechId,
  type MarkerMechLink,
} from '../../engines/tz-bridge-marker';
import { TZ_MECH_LABELS, TZ_SYSTEM_LABELS } from '../../data/support-db';
import { showToast } from './BioStackAIConstants';

/* ─── Local icons/labels for the 6 TZ organs (TZ_SYSTEM_ICONS is mojibake) ─── */
const TZ_ORGAN_META: Record<TzOrganId, { icon: string; short: string; tone: string; accent: string }> = {
  cardio:       { icon: '❤️', short: 'Сердечно-сосудистая',  tone: 'rgba(244, 63, 94, 0.10)',  accent: '#f43f5e' },
  hepatic:      { icon: '🫁', short: 'Печень',               tone: 'rgba(245, 158, 11, 0.10)', accent: '#f59e0b' },
  renal:        { icon: '🫘', short: 'Почки',                tone: 'rgba(96, 165, 250, 0.10)', accent: '#60a5fa' },
  cns:          { icon: '🧠', short: 'ЦНС',                  tone: 'rgba(139, 92, 246, 0.10)', accent: '#8b5cf6' },
  reproductive: { icon: '🧬', short: 'Репродуктивная / HPG', tone: 'rgba(236, 72, 153, 0.10)', accent: '#ec4899' },
  hematologic:  { icon: '🩸', short: 'Гематолого-метаболический', tone: 'rgba(34, 197, 94, 0.10)', accent: '#22c55e' },
};

/* ─── Russian marker labels (sourced from MARKER_ALIASES, fallback to code) ─── */
const MARKER_RU: Record<string, string> = {
  ALT: 'АЛТ (аланинаминотрансфераза)',
  AST: 'АСТ (аспартатаминотрансфераза)',
  GGT: 'ГГТ (γ-глутамилтрансфераза)',
  BILIRUBIN: 'Билирубин общий',
  DIRECT_BIL: 'Билирубин прямой',
  ALP: 'Щелочная фосфатаза',
  BILE_ACIDS: 'Желчные кислоты',
  AMMONIA: 'Аммиак',
  LACTATE: 'Лактат',
  AFP: 'Альфа-фетопротеин',
  TOTAL_PROTEIN: 'Общий белок',
  ALB: 'Альбумин',
  CHOLINESTERASE: 'Холинэстераза',
  LDL: 'ЛПНП (липопротеины низкой плотности)',
  HDL: 'ЛПВП (липопротеины высокой плотности)',
  TG: 'Триглицериды',
  CHOL: 'Общий холестерин',
  ApoB: 'Аполипопротеин B',
  Lpa: 'Липопротеин (а)',
  HsCRP: 'hs-CRP (высокочувствительный СРБ)',
  HSTNI: 'hs-TnI (тропонин I высокочувствительный)',
  NTproBNP: 'NT-proBNP',
  D_DIMER: 'D-димер',
  FIBRINOGEN: 'Фибриноген',
  BLOOD_PRESSURE_SYS: 'АД систолическое',
  BLOOD_PRESSURE_DIA: 'АД диастолическое',
  HEART_RATE: 'ЧСС',
  QT_INTERVAL: 'Интервал QT',
  ECHO_LV_MASS: 'Масса миокарда ЛЖ (ЭхоКГ)',
  ECHO_EF: 'Фракция выброса (ЭхоКГ)',
  ECHO_LA: 'Левое предсердие (ЭхоКГ)',
  CK: 'Креатинкиназа',
  ESR: 'СОЭ',
  TROPONIN: 'Тропонин',
  PROCALCITONIN: 'Прокальцитонин',
  IL_6: 'Интерлейкин-6',
  TNF_ALPHA: 'ФНО-альфа',
  CREATININE: 'Креатинин',
  UREA: 'Мочевина',
  CYSTATIN_C: 'Цистатин C',
  EGFR: 'СКФ (eGFR)',
  UACR: 'Альбумин/креатинин в моче (UACR)',
  PROTEIN_URINE: 'Белок в моче (суточная)',
  URIC_ACID: 'Мочевая кислота',
  K: 'Калий',
  NA: 'Натрий',
  CA: 'Кальций общий',
  CALCIUM: 'Кальций',
  CALCIUM_ION: 'Кальций ионизированный',
  PHOSPHORUS: 'Фосфор',
  PHOSPHATASE: 'Фосфатаза',
  PTH: 'Паратгормон',
  MG: 'Магний',
  MAGNESIUM: 'Магний',
  MAGNESIUM_H: 'Магний',
  PROLACTIN: 'Пролактин',
  CORTISOL: 'Кортизол',
  CORTISOL_H: 'Кортизол',
  DOPAMINE: 'Дофамин',
  SEROTONIN: 'Серотонин',
  MELATONIN: 'Мелатонин',
  GABA: 'ГАМК',
  GLUTAMATE: 'Глутамат',
  MDA: 'Малоновый диальдегид (MDA)',
  HOMOCYSTEINE: 'Гомоцистеин',
  MOXI: 'Специфические антитела к нейронам',
  NEURON_SPECIFIC_ENOLASE: 'Нейрон-специфическая енолаза',
  TSH: 'ТТГ',
  T3_FREE: 'Св. Т3',
  T4_FREE: 'Св. Т4',
  ANTI_TPO: 'Антитела к ТПО',
  GLUCOSE: 'Глюкоза',
  GLUCOSE_FAST: 'Глюкоза натощак',
  GLUCOSE_LOW: 'Глюкоза (низкая)',
  INSULIN: 'Инсулин',
  INSULIN_FAST: 'Инсулин натощак',
  HBA1C: 'Гликированный гемоглобин',
  HOMA_IR: 'HOMA-IR',
  HOMA_IR_H: 'HOMA-IR',
  PROINSULIN: 'Проинсулин',
  CPEPTIDE: 'С-пептид',
  CPEPTIDE_LOW: 'С-пептид (низкий)',
  GLUCAGRONS: 'Глюкагон',
  PROLACTINOMA: 'Маркеры пролактиномы',
  TESTOSTERONE: 'Тестостерон общий',
  TESTOSTERONE_FREE: 'Тестостерон свободный',
  FREE_TESTO: 'Свободный тестостерон',
  EPI_TESTO: 'Эпитестостерон',
  LH: 'ЛГ',
  FSH: 'ФСГ',
  INTRATEST_T: 'Интратестикулярный тестостерон',
  SPERM_COUNT: 'Спермограмма (концентрация)',
  SPERM_MOTILITY: 'Подвижность сперматозоидов',
  SPERM_MORPHOLOGY: 'Морфология сперматозоидов',
  ESTRADIOL: 'Эстрадиол',
  E2_LH_RATIO: 'Соотношение E2/ЛГ',
  SHBG: 'ГСПГ',
  INHIBIN_B: 'Ингибин B',
  AMH: 'АМГ',
  PROGESTERONE: 'Прогестерон',
  PROLAC_REP: 'Пролактин (репродуктивный профиль)',
  DHT: 'ДГТ (дигидротестостерон)',
  DHEA_S: 'ДГЭА-С',
  PSA: 'ПСА общий',
  PSA_TOTAL: 'ПСА общий',
  PSA_FREE: 'ПСА свободный',
  HEMOGLOBIN: 'Гемоглобин',
  HEMATOCRIT: 'Гематокрит',
  RBC: 'Эритроциты',
  FERRITIN: 'Ферритин',
  IRON: 'Сывороточное железо',
  TSAT: 'Трансферрин (%)',
  VITAMIN_D: 'Витамин D (25-OH)',
  ZINC: 'Цинк',
  SELENIUM: 'Селен',
  B12: 'Витамин B12',
  IGF1: 'ИФР-1',
  GH: 'Гормон роста',
  INSULIN_GENE: 'Инсулин (генный)',
  POTASSIUM: 'Калий',
  POTASSIUM_HIGH: 'Калий (высокий)',
  SODIUM: 'Натрий',
  CHLORIDE: 'Хлор',
  RENIN: 'Ренин',
  ALDOSTERONE: 'Альдостерон',
  COPEPTIN: 'Копептин',
  PLT: 'Тромбоциты',
};

type Step = 'organ' | 'mech' | 'marker';

export interface TzCascadeResult {
  organ: TzOrganId;
  mech: TzMechId;
  marker: string;
}

export const TzCascadePopup: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: (r: TzCascadeResult) => void;
}> = ({ open, onClose, onConfirm }) => {
  const [step, setStep] = useState<Step>('organ');
  const [organ, setOrgan] = useState<TzOrganId | null>(null);
  const [mech, setMech] = useState<TzMechId | null>(null);
  const [marker, setMarker] = useState<string | null>(null);

  /* Reset when reopened */
  React.useEffect(() => {
    if (open) { setStep('organ'); setOrgan(null); setMech(null); setMarker(null); }
  }, [open]);

  const mechsForOrgan = useMemo(() => {
    if (!organ) return [] as TzMechId[];
    return ALL_TZ_MECH_IDS.filter(m => m.startsWith(organToPrefix(organ)));
  }, [organ]);

  const markersForMech = useMemo(() => {
    if (!mech) return [] as MarkerMechLink[];
    return MARKER_TO_TZ_MECH.filter(m => m.mechId === mech);
  }, [mech]);

  if (!open) return null;

  const node = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.85)', padding: 12,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, maxHeight: '88vh',
          borderRadius: 20, background: '#18181b',
          border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
              🧪 {step === 'organ' && 'Шаг 1: Выберите орган'}
              {step === 'mech' && 'Шаг 2: Выберите механизм'}
              {step === 'marker' && 'Шаг 3: Выберите анализ'}
            </span>
            <button onClick={onClose} style={{
              width: 28, height: 28, borderRadius: 14, cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 700,
            }}>✕</button>
          </div>
          {/* Stepper */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['organ', 'mech', 'marker'] as Step[]).map((s, i) => {
              const idx = ['organ', 'mech', 'marker'].indexOf(step);
              const done = i < idx;
              const active = i === idx;
              const labels = ['Орган', 'Механизм', 'Анализ'];
              const c = done ? '#00e68a' : active ? '#a78bfa' : 'rgba(255,255,255,0.2)';
              return (
                <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 9,
                    background: c, color: done || active ? '#000' : 'rgba(255,255,255,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, flexShrink: 0,
                  }}>{done ? '✓' : i + 1}</div>
                  <span style={{ fontSize: 8, fontWeight: 700, color: c, letterSpacing: 0.3 }}>{labels[i]}</span>
                </div>
              );
            })}
          </div>
          {/* Crumb */}
          {(organ || mech) && (
            <div style={{ marginTop: 8, fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
              {organ && <span>🫀 {TZ_SYSTEM_LABELS[organ] || organ}</span>}
              {mech && <span> → 🧬 {TZ_MECH_LABELS[mech] || mech}</span>}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {step === 'organ' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {ALL_TZ_ORGANS.map(o => {
                const meta = TZ_ORGAN_META[o];
                const selected = organ === o;
                return (
                  <button
                    key={o}
                    onClick={() => { setOrgan(o); setStep('mech'); }}
                    style={{
                      padding: '14px 12px', borderRadius: 14, cursor: 'pointer',
                      textAlign: 'left', minHeight: 88,
                      background: selected ? meta.tone : 'rgba(255,255,255,0.03)',
                      border: selected ? '2px solid ' + meta.accent : '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', flexDirection: 'column', gap: 4,
                      transition: 'all 0.15s',
                    }}>
                    <span style={{ fontSize: 26 }}>{meta.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: meta.accent, lineHeight: 1.2 }}>
                      {meta.short}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 'mech' && organ && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                Доступно {mechsForOrgan.length} механизмов ТЗ из 28
              </div>
              {mechsForOrgan.map(m => (
                <button
                  key={m}
                  onClick={() => { setMech(m); setStep('marker'); }}
                  style={{
                    padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    background: mech === m ? TZ_ORGAN_META[organ].tone : 'rgba(255,255,255,0.03)',
                    border: mech === m
                      ? '2px solid ' + TZ_ORGAN_META[organ].accent
                      : '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                        background: TZ_ORGAN_META[organ].accent + '22',
                      color: TZ_ORGAN_META[organ!].accent,
                      }}>{m}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                        {TZ_MECH_LABELS[m] || m}
                      </span>
                    </div>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>→</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 'marker' && mech && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                Найдено {markersForMech.length} маркёр{markersForMech.length === 1 ? '' : markersForMech.length < 5 ? 'а' : 'ов'} для этого механизма
              </div>
              {markersForMech.map(mk => (
                <button
                  key={mk.marker}
                  onClick={() => {
                    if (!organ) return;
                    setMarker(mk.marker);
                    onConfirm({ organ, mech, marker: mk.marker });
                  }}
                  style={{
                    padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    background: marker === mk.marker
                      ? TZ_ORGAN_META[organ!].tone
                      : 'rgba(255,255,255,0.03)',
                    border: marker === mk.marker
                      ? '2px solid ' + TZ_ORGAN_META[organ!].accent
                      : '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                        {MARKER_RU[mk.marker] || mk.marker}
                      </div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2, display: 'flex', gap: 6 }}>
                        <span style={{ fontFamily: 'monospace' }}>{mk.marker}</span>
                        <span>·</span>
                        <span>{mk.direction === 'up' ? '↑ повышение' : '↓ снижение'}</span>
                        {mk.uln != null && <><span>·</span><span>норма ≤ {mk.uln}</span></>}
                        {mk.lln != null && <><span>·</span><span>норма ≥ {mk.lln}</span></>}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 16,
                      color: TZ_ORGAN_META[organ!].accent,
                    }}>→</span>
                  </div>
                </button>
              ))}
              {markersForMech.length === 0 && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 20 }}>
                  Нет маркёров для этого механизма
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
          {step !== 'organ' && (
            <button
              onClick={() => {
                if (step === 'mech') { setStep('organ'); setOrgan(null); }
                else if (step === 'marker') { setStep('mech'); setMech(null); }
              }}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.7)',
              }}>← Назад</button>
          )}
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
              color: '#ef4444',
            }}>Отмена</button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(node, document.body);
};

/* ─── Helpers ─── */
function organToPrefix(o: TzOrganId): string {
  switch (o) {
    case 'cardio': return 'cv';
    case 'hepatic': return 'liv';
    case 'renal': return 'ren';
    case 'cns': return 'cns';
    case 'reproductive': return 'rep';
    case 'hematologic': return 'hem';
  }
}
