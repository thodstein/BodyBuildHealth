import React from 'react';
import type { LabSlice } from '../../../engines/support-plan';
import { GLASS, PILL, INPUT } from './Calc.types';

export const FULL_PANELS: { key: keyof LabSlice; label: string; color: string; markers: string[] }[] = [
  { key:'panelSex', label:'Половые гормоны', color:'#818cf8', markers:['LH','FSH','Total T','Free T','E2','Prolactin','SHBG','DHT','Progesterone','Cortisol'] },
  { key:'panelBiochem', label:'Биохимия', color:'#22c55e', markers:['ALT','AST','GGT','Bilirubin','Glucose','Creatinine','Urea','Uric acid','CRP','Homocysteine'] },
  { key:'panelHematology', label:'Гематология', color:'#fbbf24', markers:['HCT','Hemoglobin','RBC','WBC','Platelets','Neutrophils','Lymphocytes'] },
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
  ALT:'АЛТ', AST:'АСТ', GGT:'ГГТ', Bilirubin:'Билирубин', Glucose:'Глюкоза',
  Creatinine:'Креатинин', Urea:'Мочевина', 'Uric acid':'Моч. кислота', CRP:'СРБ', Homocysteine:'Гомоцистеин',
  HCT:'Гематокрит', Hemoglobin:'Гемоглобин', RBC:'Эритроциты', WBC:'Лейкоциты',
  Platelets:'Тромбоциты', Neutrophils:'Нейтрофилы', Lymphocytes:'Лимфоциты',
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

export function LabSliceInput({ label, slice, onChange }: { label: string; slice: LabSlice | null; onChange: (v: any) => void; fullSpectrum?: boolean }) {
  return <div style={{ marginBottom: 6 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
      <input type="date" value={slice?.date || ''} onChange={e => onChange(e.target.value ? { date: e.target.value, panelSex: {}, panelBiochem: {}, panelHematology: {}, panelThyroid: {} } : null)} style={{ ...INPUT, width: 130, fontSize: 9 }} />
      <button onClick={() => onChange(null)} style={{ ...PILL, fontSize: 8, background: '#ef4444', color: '#fff', padding: '3px 8px' }}>✕</button>
    </div>
    {slice && <>
      <div style={{ fontSize: 8, fontWeight: 600, color: '#818cf8', marginBottom: 2 }}>Половые гормоны</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, marginBottom: 4 }}>
        {['LH','FSH','Total T','Free T','E2','Prolactin','SHBG','DHT','Progesterone','Cortisol'].map(m =>
          <div key={m}><span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{ruMarker(m)}</span>
            <input value={slice.panelSex?.[m] || ''} onChange={e => onChange({ ...slice, panelSex: { ...slice.panelSex, [m]: e.target.value } })} style={{ ...INPUT, padding: '3px 6px', fontSize: 9 }} />
          </div>)}
      </div>
      <div style={{ fontSize: 8, fontWeight: 600, color: '#22c55e', marginBottom: 2 }}>Биохимия</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, marginBottom: 4 }}>
        {['ALT','AST','GGT','Bilirubin','Glucose','Creatinine','Urea','Uric acid','CRP','Homocysteine'].map(m =>
          <div key={m}><span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{ruMarker(m)}</span>
            <input value={slice.panelBiochem?.[m] || ''} onChange={e => onChange({ ...slice, panelBiochem: { ...slice.panelBiochem, [m]: e.target.value } })} style={{ ...INPUT, padding: '3px 6px', fontSize: 9 }} />
          </div>)}
      </div>
      <div style={{ fontSize: 8, fontWeight: 600, color: '#fbbf24', marginBottom: 2 }}>Гематология</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, marginBottom: 4 }}>
        {['HCT','Hemoglobin','RBC','WBC','Platelets','Neutrophils','Lymphocytes'].map(m =>
          <div key={m}><span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{ruMarker(m)}</span>
            <input value={slice.panelHematology?.[m] || ''} onChange={e => onChange({ ...slice, panelHematology: { ...slice.panelHematology, [m]: e.target.value } })} style={{ ...INPUT, padding: '3px 6px', fontSize: 9 }} />
          </div>)}
      </div>
      <div style={{ fontSize: 8, fontWeight: 600, color: '#a855f7', marginBottom: 2 }}>Тиреоидные</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
        {['TSH','T3 free','T4 free','Anti-TPO','Anti-TG'].map(m =>
          <div key={m}><span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{ruMarker(m)}</span>
            <input value={slice.panelThyroid?.[m] || ''} onChange={e => onChange({ ...slice, panelThyroid: { ...slice.panelThyroid, [m]: e.target.value } })} style={{ ...INPUT, padding: '3px 6px', fontSize: 9 }} />
          </div>)}
      </div>
    </>}
  </div>;
}

export function FullLabInput({ values, onChange }: { values: LabSlice | null; onChange: (v: LabSlice) => void }) {
  const s = values || { date:'', panelSex:{}, panelBiochem:{}, panelHematology:{}, panelThyroid:{}, panelLipid:{}, panelIron:{}, panelVitamin:{}, panelCardiac:{}, panelCoagulation:{}, panelInflammatory:{}, panelAdrenal:{}, panelMineral:{}, panelTumor:{}, panelUrinalysis:{} };
  const upd = (panel: keyof LabSlice, marker: string, val: string) => {
    const pv = s[panel] as Record<string,string> || {};
    onChange({ ...s, [panel]: { ...pv, [marker]: val } });
  };
  return <div>
    {FULL_PANELS.map(pan => <div key={pan.key} style={{ marginBottom:6 }}>
      <div style={{ fontSize:8, fontWeight:600, color:pan.color, marginBottom:2 }}>{pan.label}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:3 }}>
        {pan.markers.map(m => <div key={m}><span style={{ fontSize:7, color:'var(--text-dim)' }}>{ruMarker(m)}</span>
          <input value={(s[pan.key] as Record<string,string>)?.[m] || ''} onChange={e => upd(pan.key, m, e.target.value)} style={{ ...INPUT, padding:'3px 6px', fontSize:9 }} />
        </div>)}
      </div>
    </div>)}
  </div>;
}