import React from 'react';
import type { LabSlice } from '../../../engines/support-plan';
import { labFieldNumber } from '../../../engines/support-plan';
import { LAB_UNIT_CHOICES } from '../../../core/constants';
import { LAB_MARKER_MAP } from '../../../data/lab-marker-map';
import { markerReadUnit, ruUnit } from './Calc.lab-units';
import { GLASS, PILL, INPUT } from './Calc.types';

export const FULL_PANELS: { key: keyof LabSlice; label: string; color: string; markers: string[] }[] = [
  { key:'panelSex', label:'Половые гормоны', color:'#818cf8', markers:['LH','FSH','Total T','Free T','E2','Prolactin','SHBG','DHT','Progesterone','Cortisol'] },
  { key:'panelBiochem', label:'Биохимия', color:'#22c55e', markers:['ALT','AST','GGT','Bilirubin','Glucose','Insulin','Creatinine','Urea','Uric acid','CRP','Homocysteine'] },
  { key:'panelHematology', label:'Гематология', color:'#fbbf24', markers:['HCT','Hemoglobin','RBC','WBC','Platelets','Neutrophils','Lymphocytes','Reticulocytes'] },
  { key:'panelThyroid', label:'Тиреоидные', color:'#a855f7', markers:['TSH','T3 free','T4 free','Anti-TPO','Anti-TG'] },
  { key:'panelLipid', label:'Липидный профиль', color:'#f97316', markers:['Total Cholesterol','LDL','HDL','Triglycerides','VLDL','ApoB','ApoA1','Lp(a)'] },
  { key:'panelIron', label:'Железо / Анемия', color:'#dc2626', markers:['Ferritin','Iron','TIBC','Transferrin Sat','Transferrin'] },
  { key:'panelVitamin', label:'Витамины', color:'#eab308', markers:['B12','Folate','Vitamin D (25-OH)','Vitamin A','Vitamin E','Vitamin K'] },
  { key:'panelCardiac', label:'Кардиомаркеры', color:'#ef4444', markers:['CK','CK-MB','Troponin I','Troponin T','NT-proBNP'] },
  { key:'panelCoagulation', label:'Гемостаз', color:'#ec4899', markers:['D-dimer','Fibrinogen','PT','APTT','INR'] },
  { key:'panelInflammatory', label:'Воспаление', color:'#f59e0b', markers:['IL-6','TNF-alpha','hsCRP'] },
  { key:'panelAdrenal', label:'Надпочечники / Андрогены', color:'#8b5cf6', markers:['DHEA-S','Androstenedione','3a-ADG','Aldosterone','Renin','PTH'] },
  { key:'panelMineral', label:'Минералы / Электролиты', color:'#06b6d4', markers:['Calcium','Phosphorus','Magnesium','Sodium','Potassium','Chloride'] },
  { key:'panelTumor', label:'Онкомаркеры', color:'#be123c', markers:['PSA total','PSA free','CA-125','CEA','AFP'] },
  { key:'panelUrinalysis', label:'Общий анализ мочи', color:'#65a30d', markers:['pH','Protein','Glucose','Ketones','Leukocytes','Nitrite'] },
];

export const LAB_MARKER_RU: Record<string, string> = {
  LH:'ЛГ', FSH:'ФСГ', 'Total T':'Общий тестостерон', 'Free T':'Своб. тестостерон', E2:'Эстрадиол',
  Prolactin:'Пролактин', SHBG:'ГСПГ', DHT:'ДГТ', Progesterone:'Прогестерон', Cortisol:'Кортизол',
  ALT:'АЛТ', AST:'АСТ', GGT:'ГГТ', Bilirubin:'Билирубин', Glucose:'Глюкоза', Insulin:'Инсулин',
  Creatinine:'Креатинин', Urea:'Мочевина', 'Uric acid':'Моч. кислота', CRP:'СРБ', Homocysteine:'Гомоцистеин',
  HCT:'Гематокрит', Hemoglobin:'Гемоглобин', RBC:'Эритроциты', WBC:'Лейкоциты',
  Platelets:'Тромбоциты', Neutrophils:'Нейтрофилы', Lymphocytes:'Лимфоциты',
  // 196: поле есть у процентов и промилле; абсолютное число сюда не вводится.
  Reticulocytes:'Ретикулоциты',
  TSH:'ТТГ', 'T3 free':'Т3 своб.', 'T4 free':'Т4 своб.', 'Anti-TPO':'Анти-ТПО', 'Anti-TG':'Анти-ТГ',
  'Total Cholesterol':'Общий холестерин', LDL:'ЛПНП', HDL:'ЛПВП', Triglycerides:'Триглицериды',
  VLDL:'ЛПОНП', ApoB:'АпоВ', ApoA1:'АпоА1', 'Lp(a)':'Лп(а)',
  Ferritin:'Ферритин', Iron:'Железо', TIBC:'ОЖСС', 'Transferrin Sat':'Насыщ. трансферрина', Transferrin:'Трансферрин',
  B12:'В12', Folate:'Фолат', 'Vitamin D (25-OH)':'Вит. D', 'Vitamin A':'Вит. A', 'Vitamin E':'Вит. E', 'Vitamin K':'Вит. K',
  CK:'КФК', 'CK-MB':'КФК-МВ', 'Troponin I':'Тропонин I', 'Troponin T':'Тропонин T', 'NT-proBNP':'NT-proBNP',
  'D-dimer':'Д-димер', Fibrinogen:'Фибриноген', PT:'ПВ', APTT:'АЧТВ', INR:'МНО',
  'IL-6':'ИЛ-6', 'TNF-alpha':'ФНО-α', hsCRP:'вчСРБ',
  'DHEA-S':'ДГЭА-С', Androstenedione:'Андростендион', '3a-ADG':'3α-АДГ', Aldosterone:'Альдостерон', Renin:'Ренин', PTH:'ПТГ',
  Calcium:'Кальций', Phosphorus:'Фосфор', Magnesium:'Магний', Sodium:'Натрий', Potassium:'Калий', Chloride:'Хлориды',
  'PSA total':'ПСА общий', 'PSA free':'ПСА своб.', 'CA-125':'CA-125', CEA:'РЭА', AFP:'АФП',
  pH:'pH', Protein:'Белок', Ketones:'Кетоны', Leukocytes:'Лейкоциты', Nitrite:'Нитриты',
};
export const ruMarker = (m: string) => LAB_MARKER_RU[m] || m;

/**
 * Ключ сравнения для каталога маркеров (проход 129). Каталог держит коды
 * (`APO_B`, `LP_A`, `CK_MB`, `NT_PROBNP`, `TNF_ALPHA`), а поле формы подписано
 * человеческим именем (`ApoB`, `Lp(a)`, `CK-MB`, `NT-proBNP`, `TNF-alpha`).
 * Прямое сравнение строк в нижнем регистре такую пару не находило, и поле
 * просило число без единицы: 95 ApoB в мг/дл и 0.95 г/л — одно и то же, но
 * форма об этом молчала.
 */
const unitKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9а-яё]/g, '');

/** Единица, в которой калькулятор ждёт число: общий каталог маркеров — единственный источник. */
const MARKER_UNIT: Record<string, string> = {};
for (const e of LAB_MARKER_MAP) {
  const key = unitKey(String(e.marker || ''));
  if (e.unit && key && !MARKER_UNIT[key]) MARKER_UNIT[key] = e.unit;
}

/**
 * Качественные поля общего анализа мочи (проход 130): полоска даёт «следы/+/++»,
 * а не концентрацию, поэтому единицы у них нет.
 */
const URINE_QUALITATIVE = new Set(['pH', 'Glucose', 'Ketones', 'Leukocytes', 'Nitrite']);

/**
 * Подсказка единицы в поле ввода (проход 114). У маркеров с выбором единицы
 * подсказку не печатаем — рядом стоит `UnitPicker`. Для остальных показываем
 * единицу, в которой движок сравнивает число: иначе человек вписывает 15 г/дл
 * гемоглобина в поле, где норма 130–170, и «анемия» берётся из воздуха.
 */
export function labUnitHint(marker: string, panel?: string): string | undefined {
  if (LAB_UNIT_CHOICES[marker]) return undefined;
  // Проход 130: общий анализ мочи — полоски, а не концентрация. Подсказка
  // «ммоль/л» у глюкозы мочи заставляла искать число там, где бланк пишет
  // «следы/+». Белок мочи сюда не входит — у него свой выбор единицы (г/л/мг/л).
  if (panel === 'panelUrinalysis' && URINE_QUALITATIVE.has(marker)) return undefined;
  // Сначала каталог UCUM — это та единица, к которой импорт приводит значение;
  // каталог маркеров (`LAB_MARKER_MAP`) остаётся для маркеров без пересчёта.
  const hint = markerReadUnit(marker) ?? MARKER_UNIT[unitKey(marker)];
  return hint ? ruUnit(hint) : undefined;
}

/**
 * Граница вместо числа (проход 131). Бланки печатают «>1000» ферритина и «<0.5» СРБ:
 * `parseFloat` на такой строке даёт NaN, и анализ пропадал целиком — перегрузка
 * железом не давала ни находки, ни вклада в риск. Движок читает границу как её
 * число (иначе данные теряются), поэтому интерфейс обязан назвать это вслух.
 */
export function labBoundNotes(slice?: LabSlice | null): { marker: string; text: string }[] {
  if (!slice) return [];
  const out: { marker: string; text: string }[] = [];
  for (const panel of Object.keys(slice)) {
    if (panel === 'units' || panel === 'date') continue;
    const markers = (slice as any)[panel] as Record<string, string> | undefined;
    if (!markers) continue;
    for (const [marker, raw] of Object.entries(markers)) {
      const text = String(raw ?? '').trim();
      if (!/^[<>≤≥]/.test(text)) continue;
      // Проход 141: число в скобках печатает то же правило чтения, что и движок
      // (`labFieldNumber`). Раньше здесь был свой `parseFloat`, и «>1 000» движок
      // читал как 1000, а баннер показывал 1 — два числа на одну запись.
      const value = labFieldNumber(text);
      out.push({
        marker,
        text: value !== undefined ? `${ruMarker(marker)} «${text}» → ${value}` : `${ruMarker(marker)} «${text}»`,
      });
    }
  }
  return out;
}

/**
 * Единица бланка (проход 106). Бланки дают E2 и в пг/мл, и в пмоль/л, пролактин — в
 * нг/мл и мМЕ/л, и «угадать» по величине можно только там, где значение невозможно в
 * обеих единицах. Поэтому единица выбирается здесь и едет вместе с числом: чтение
 * идёт по ней, а не по догадке. Пусто — «не указана», прежняя догадка с пометкой.
 */
function UnitPicker({ panel, marker, slice, onChange }: {
  panel: string; marker: string; slice: LabSlice; onChange: (v: any) => void;
}) {
  const choices = LAB_UNIT_CHOICES[marker];
  if (!choices) return null;
  const value = slice.units?.[panel]?.[marker] ?? '';
  return (
    <select
      value={value}
      aria-label={`Единица: ${ruMarker(marker)}`}
      title="Единица из бланка. Без неё значение читается по величине — и это может соврать."
      onChange={e => {
        const unit = e.target.value;
        const panelUnits = { ...(slice.units?.[panel] || {}) };
        if (unit) panelUnits[marker] = unit; else delete panelUnits[marker];
        onChange({ ...slice, units: { ...(slice.units || {}), [panel]: panelUnits } });
      }}
      style={{ ...INPUT, padding: '1px 3px', fontSize: 7, height: 17, marginTop: 1 }}
    >
      <option value="">ед.?</option>
      {choices.map(u => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

/**
 * Запись значения маркера (проход 117). Единица — часть данных о числе, а не
 * настройка поля. Если человек очистил значение, оставленная единица начнёт
 * пересчитывать следующее число, вписанное из другого бланка: 1800 пмоль/л →
 * очистка → 500 (это уже пг/мл) читалось бы как 500 пмоль/л, то есть 136 пг/мл.
 * Поэтому пустое значение уносит с собой и свою единицу.
 */
export function withLabValue(slice: LabSlice, panel: string, marker: string, value: string): LabSlice {
  const anySlice = slice as any;
  const next: any = { ...anySlice, [panel]: { ...(anySlice[panel] || {}), [marker]: value } };
  if (value !== '') return next as LabSlice;
  const bucket = anySlice.units?.[panel];
  if (!bucket || bucket[marker] === undefined) return next as LabSlice;
  const rest = { ...bucket };
  delete rest[marker];
  next.units = { ...(anySlice.units || {}), [panel]: rest };
  return next as LabSlice;
}

export function LabSliceInput({ label, slice, onChange }: { label: string; slice: LabSlice | null; onChange: (v: any) => void; fullSpectrum?: boolean }) {
  return <div className="calc-labslice" style={{ marginBottom: 6 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
      <input type="date" value={slice?.date || ''} onChange={e => {
        // Проход 110: дата — это не новый бланк. Раньше выбор (или исправление) даты
        // пересоздавал срез с пустыми панелями и стирал уже введённые анализы вместе
        // с выбранными единицами — молча, без возможности отменить. Теперь меняется
        // только дата; пустая дата значения не удаляет (для этого есть ✕).
        const v = e.target.value;
        if (!v) { onChange(slice ? { ...slice, date: '' } : null); return; }
        onChange({
          ...(slice || {}),
          date: v,
          panelSex: slice?.panelSex || {},
          panelBiochem: slice?.panelBiochem || {},
          panelHematology: slice?.panelHematology || {},
          panelThyroid: slice?.panelThyroid || {},
          ...(slice?.units ? { units: slice.units } : {}),
        });
      }} style={{ ...INPUT, width: 130, fontSize: 9 }} />
      <button onClick={() => onChange(null)} style={{ ...PILL, fontSize: 8, background: '#ef4444', color: '#fff', padding: '3px 8px' }}>✕</button>
    </div>
    {slice && <>
      <div style={{ fontSize: 8, fontWeight: 600, color: '#818cf8', marginBottom: 2 }}>Половые гормоны</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, marginBottom: 4 }}>
        {['LH','FSH','Total T','Free T','E2','Prolactin','SHBG','DHT','Progesterone','Cortisol'].map(m =>
          <div key={m}><span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{ruMarker(m)}</span>
            <input value={slice.panelSex?.[m] || ''} onChange={e => onChange(withLabValue(slice, 'panelSex', m, e.target.value))} placeholder={labUnitHint(m)} style={{ ...INPUT, padding: '3px 6px', fontSize: 9 }} />
            <UnitPicker panel="panelSex" marker={m} slice={slice} onChange={onChange} />
          </div>)}
      </div>
      <div style={{ fontSize: 8, fontWeight: 600, color: '#22c55e', marginBottom: 2 }}>Биохимия</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, marginBottom: 4 }}>
        {['ALT','AST','GGT','Bilirubin','Glucose','Creatinine','Urea','Uric acid','CRP','Homocysteine'].map(m =>
          <div key={m}><span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{ruMarker(m)}</span>
            <input value={slice.panelBiochem?.[m] || ''} onChange={e => onChange(withLabValue(slice, 'panelBiochem', m, e.target.value))} placeholder={labUnitHint(m)} style={{ ...INPUT, padding: '3px 6px', fontSize: 9 }} />
          </div>)}
      </div>
      <div style={{ fontSize: 8, fontWeight: 600, color: '#fbbf24', marginBottom: 2 }}>Гематология</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, marginBottom: 4 }}>
        {['HCT','Hemoglobin','RBC','WBC','Platelets','Neutrophils','Lymphocytes'].map(m =>
          <div key={m}><span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{ruMarker(m)}</span>
            <input value={slice.panelHematology?.[m] || ''} onChange={e => onChange(withLabValue(slice, 'panelHematology', m, e.target.value))} placeholder={labUnitHint(m)} style={{ ...INPUT, padding: '3px 6px', fontSize: 9 }} />
          </div>)}
      </div>
      <div style={{ fontSize: 8, fontWeight: 600, color: '#a855f7', marginBottom: 2 }}>Тиреоидные</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
        {['TSH','T3 free','T4 free','Anti-TPO','Anti-TG'].map(m =>
          <div key={m}><span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{ruMarker(m)}</span>
            <input value={slice.panelThyroid?.[m] || ''} onChange={e => onChange(withLabValue(slice, 'panelThyroid', m, e.target.value))} placeholder={labUnitHint(m)} style={{ ...INPUT, padding: '3px 6px', fontSize: 9 }} />
          </div>)}
      </div>
    </>}
  </div>;
}

export function FullLabInput({ values, onChange }: { values: LabSlice | null; onChange: (v: LabSlice) => void }) {
  const s = values || { date:'', panelSex:{}, panelBiochem:{}, panelHematology:{}, panelThyroid:{}, panelLipid:{}, panelIron:{}, panelVitamin:{}, panelCardiac:{}, panelCoagulation:{}, panelInflammatory:{}, panelAdrenal:{}, panelMineral:{}, panelTumor:{}, panelUrinalysis:{} };
  const upd = (panel: keyof LabSlice, marker: string, val: string) => {
    // Проход 117: пустая ячейка уносит свою единицу — иначе следующее число,
    // вписанное из другого бланка, прочитается по чужой единице.
    onChange(withLabValue(s, String(panel), marker, val));
  };
  return <div className="calc-fulllab">
    {FULL_PANELS.map(pan => <div key={pan.key} style={{ marginBottom:6 }}>
      <div style={{ fontSize:8, fontWeight:600, color:pan.color, marginBottom:2 }}>{pan.label}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:3 }}>
        {pan.markers.map(m => <div key={m}><span style={{ fontSize:7, color:'var(--text-dim)' }}>{ruMarker(m)}</span>
          <input value={(s[pan.key] as Record<string,string>)?.[m] || ''} onChange={e => upd(pan.key, m, e.target.value)} placeholder={labUnitHint(m, String(pan.key))} style={{ ...INPUT, padding:'3px 6px', fontSize:9 }} />
          <UnitPicker panel={String(pan.key)} marker={m} slice={s} onChange={onChange} />
        </div>)}
      </div>
    </div>)}
  </div>;
}