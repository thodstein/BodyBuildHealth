import React from 'react';
import type { UserProfile, UnifiedSettings } from '../../../core/types';
import { theme, glassCardStyle, sectionLabelStyle, HealthBool, NumberPc, TextPc, PopupCard } from './ProfileComponents';
import { ProfileGeneticsSection } from './ProfileGeneticsSection';
import { ProfileInjuriesSection } from './ProfileInjuriesSection';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: any) => void;
  calcData?: any;
  upCalc?: (k: string, v: any) => void;
  onNavigate?: (screen: string) => void;
}

const CHRONIC_CONDITIONS: { id: string; label: string }[] = [
  { id: 'hypertension', label: 'Гипертония' }, { id: 'diabetes', label: 'Диабет' },
  { id: 'hypothyroidism', label: 'Гипотиреоз' }, { id: 'gout', label: 'Подагра' },
  { id: 'asthma', label: 'Астма' }, { id: 'IBS', label: 'СРК' },
  { id: 'gerd', label: 'ГЭРБ' }, { id: 'hepatitis', label: 'Гепатит' },
  { id: 'CKD', label: 'ХБП' }, { id: 'anemia', label: 'Анемия' },
  { id: 'thrombophilia', label: 'Тромбофилия' }, { id: 'varicose', label: 'Варикоз' },
  { id: 'prostatitis', label: 'Простатит' }, { id: 'epilepsy', label: 'Эпилепсия' },
  { id: 'migraine', label: 'Мигрень' }, { id: 'psoriasis', label: 'Псориаз' },
  { id: 'autoimmune', label: 'Аутоиммунное' },
];

const systemCards = [
  {
    id: 'neuro', icon: '🧠', title: 'Неврология', color: '#a78bfa',
    summary: (d: any) => [d?.sleepQuality==='poor'?'Плохой сон':'',d?.sleepQuality==='fair'?'Средний сон':'',d?.tinnitus?'Шум в ушах':'',d?.dizziness?'Головокружение':'',d?.memoryIssues?'Память':'',d?.focusIssues?'Концентрация':'',d?.slowThinking?'Туман':'',d?.headaches?'Головные боли':'',d?.weatherDependent?'Метео':''].filter(Boolean).join(', ')||'Нет жалоб',
    popupContent: (d: any, u: Function) => <div>
      <div style={{ display:'flex', gap:3, marginBottom:6 }}>
        {[{v:'good',l:'Хор.'},{v:'fair',l:'Сред.'},{v:'poor',l:'Плох.'}].map(opt => (
          <button key={opt.v} onClick={() => u('neuro',{...d,sleepQuality:opt.v})}
            style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:10, fontWeight:600,
              background:(d?.sleepQuality||'good')===opt.v ? '#a78bfa' : 'rgba(255,255,255,0.06)',
              color:(d?.sleepQuality||'good')===opt.v ? '#000' : 'rgba(255,255,255,0.5)',
            }}>{opt.l}</button>
        ))}
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
        <HealthBool label="Память" active={!!d?.memoryIssues} onClick={() => u('neuro',{...d,memoryIssues:!d?.memoryIssues})} />
        <HealthBool label="Концентрация" active={!!d?.focusIssues} onClick={() => u('neuro',{...d,focusIssues:!d?.focusIssues})} />
        <HealthBool label="Замедл. мышление" active={!!d?.slowThinking} onClick={() => u('neuro',{...d,slowThinking:!d?.slowThinking})} />
        <HealthBool label="Головные боли" active={!!d?.headaches} onClick={() => u('neuro',{...d,headaches:!d?.headaches})} />
        <HealthBool label="Метеозависимость" active={!!d?.weatherDependent} onClick={() => u('neuro',{...d,weatherDependent:!d?.weatherDependent})} />
        <HealthBool label="Шум в ушах" active={!!d?.tinnitus} onClick={() => u('neuro',{...d,tinnitus:!d?.tinnitus})} />
        <HealthBool label="Головокружение" active={!!d?.dizziness} onClick={() => u('neuro',{...d,dizziness:!d?.dizziness})} />
      </div>
    </div>,
  },
  {
    id: 'psych', icon: '🧘', title: 'Психология', color: '#e879f9',
    summary: (d: any) => `Страх:${d?.fearOfLoss||1} Зеркало:${d?.mirrorObsession||1} Апатия:${d?.apathyOffCycle||1}`,
    popupContent: (d: any, u: Function) => <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
      <NumberPc icon="😨" label="Страх потери" value={d?.fearOfLoss || 1} onChange={v => u('psych',{...d,fearOfLoss:parseInt(v)||1})} suffix="/5" min={1} max={5} />
      <NumberPc icon="🪞" label="Зеркало" value={d?.mirrorObsession || 1} onChange={v => u('psych',{...d,mirrorObsession:parseInt(v)||1})} suffix="/5" min={1} max={5} />
      <NumberPc icon="😑" label="Апатия" value={d?.apathyOffCycle || 1} onChange={v => u('psych',{...d,apathyOffCycle:parseInt(v)||1})} suffix="/5" min={1} max={5} />
    </div>,
  },
  {
    id: 'cardio', icon: '❤️', title: 'ССС', color: '#f87171',
    summary: (d: any) => {
      const bp:{[k:string]:string}={normal:'Норма',prehypertension:'Предгиперт.',hypertension1:'Гиперт.I',hypertension2:'Гиперт.II'};
      return `АД:${bp[d?.bpStage]||'—'} ЧСС:${d?.heartRate||'—'} ${d?.hctElevation&&d.hctElevation!=='none'?'↑HCT ':''}${d?.previousCVD?'ССЗ ':''}`;
    },
    popupContent: (d: any, u: Function) => <div>
      <div style={{ marginBottom:6 }}>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginBottom:3 }}>Стадия АД</div>
        <div style={{ display:'flex', gap:3 }}>
          {[{v:'normal',l:'Норма'},{v:'prehypertension',l:'Предгиперт.'},{v:'hypertension1',l:'Гиперт.I'},{v:'hypertension2',l:'Гиперт.II'}].map(opt => (
            <button key={opt.v} onClick={() => u('cardio',{...d,bpStage:opt.v})}
              style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:9, fontWeight:600,
                background:(d?.bpStage||'normal')===opt.v ? '#f87171' : 'rgba(255,255,255,0.06)',
                color:(d?.bpStage||'normal')===opt.v ? '#000' : 'rgba(255,255,255,0.5)',
              }}>{opt.l}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom:6 }}>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginBottom:3 }}>Гематокрит</div>
        <div style={{ display:'flex', gap:3 }}>
          {[{v:'none',l:'Норма'},{v:'mild',l:'Сл.↑'},{v:'moderate',l:'Умер.'},{v:'severe',l:'Сильно'}].map(opt => (
            <button key={opt.v} onClick={() => u('cardio',{...d,hctElevation:opt.v})}
              style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:9, fontWeight:600,
                background:(d?.hctElevation||'none')===opt.v ? '#f87171' : 'rgba(255,255,255,0.06)',
                color:(d?.hctElevation||'none')===opt.v ? '#000' : 'rgba(255,255,255,0.5)',
              }}>{opt.l}</button>
          ))}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        <NumberPc icon="💓" label="ЧСС" value={d?.heartRate || 72} min={40} max={200} onChange={v => u('cardio',{...d,heartRate:parseInt(v)||72})} suffix="уд/мин" />
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
        <HealthBool label="ССЗ ранее" active={!!d?.previousCVD} onClick={() => u('cardio',{...d,previousCVD:!d?.previousCVD})} />
        <HealthBool label="Сем. анамнез ССЗ" active={!!d?.familyCVD} onClick={() => u('cardio',{...d,familyCVD:!d?.familyCVD})} />
        <HealthBool label="Высокие TG" active={d?.triglycerides==='high'} onClick={() => u('cardio',{...d,triglycerides:d?.triglycerides==='high'?'normal':'high'})} />
        <HealthBool label="Низкий ЛПВП" active={!!d?.hdlLow} onClick={() => u('cardio',{...d,hdlLow:!d?.hdlLow})} />
      </div>
    </div>,
  },
  {
    id: 'oda', icon: '🦴', title: 'ОДА', color: '#f97316',
    summary: (d: any) => [d?.jointPain==='mild'?'Боль в суставах':'',d?.ligamentIssues?'Связки':'',d?.backPain?'Боль в спине':''].filter(Boolean).join(', ')||'Нет жалоб',
    popupContent: (d: any, u: Function) => <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
      <HealthBool label="Боль в суставах" active={d?.jointPain==='mild'} onClick={() => u('oda',{...d,jointPain:d?.jointPain==='mild'?'none':'mild'})} />
      <HealthBool label="Связки (слабые)" active={!!d?.ligamentIssues} onClick={() => u('oda',{...d,ligamentIssues:!d?.ligamentIssues})} />
      <HealthBool label="Боль в спине" active={!!d?.backPain} onClick={() => u('oda',{...d,backPain:!d?.backPain})} />
    </div>,
  },
  {
    id: 'gi', icon: '🫀', title: 'ЖКТ', color: '#fbbf24',
    summary: (d: any) => [d?.bloating?'Вздутие':'',d?.heartburn?'Изжога':'',d?.constipation?'Запор':'',d?.diarrhea?'Диарея':'',d?.diagnosedIBS?'СРК':''].filter(Boolean).join(', ')||'Нет жалоб',
    popupContent: (d: any, u: Function) => <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
      <HealthBool label="Вздутие" active={!!d?.bloating} onClick={() => u('gi',{...d,bloating:!d?.bloating})} />
      <HealthBool label="Изжога" active={!!d?.heartburn} onClick={() => u('gi',{...d,heartburn:!d?.heartburn})} />
      <HealthBool label="Запор" active={!!d?.constipation} onClick={() => u('gi',{...d,constipation:!d?.constipation})} />
      <HealthBool label="Диарея" active={!!d?.diarrhea} onClick={() => u('gi',{...d,diarrhea:!d?.diarrhea})} />
      <HealthBool label="СРК (диагн.)" active={!!d?.diagnosedIBS} onClick={() => u('gi',{...d,diagnosedIBS:!d?.diagnosedIBS})} />
      <HealthBool label="Ферменты" active={!!d?.enzymeSupport} onClick={() => u('gi',{...d,enzymeSupport:!d?.enzymeSupport})} />
      <HealthBool label="Пробиотики" active={!!d?.probioticUse} onClick={() => u('gi',{...d,probioticUse:!d?.probioticUse})} />
    </div>,
  },
  {
    id: 'dental', icon: '🦷', title: 'Стоматология', color: '#94a3b8',
    summary: (d: any) => [d?.bleedingGums?'Кровоточивость':'',d?.looseTeeth?'Подв.зубов':'',d?.cramps?'Судороги':''].filter(Boolean).join(', ')||'Нет жалоб',
    popupContent: (d: any, u: Function) => <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
      <HealthBool label="Кровоточивость" active={!!d?.bleedingGums} onClick={() => u('dental',{...d,bleedingGums:!d?.bleedingGums})} />
      <HealthBool label="Подвижность зубов" active={!!d?.looseTeeth} onClick={() => u('dental',{...d,looseTeeth:!d?.looseTeeth})} />
      <HealthBool label="Судороги" active={!!d?.cramps} onClick={() => u('dental',{...d,cramps:!d?.cramps})} />
    </div>,
  },
  {
    id: 'toxicLoad', icon: '☣️', title: 'Токсическая нагрузка', color: '#ef4444',
    summary: (d: any) => [d?.hazardousWork?'Вредное пр-во':'',d?.regularNSAIDs?'НПВС':'',d?.hasDiabetes?'Диабет':'',d?.hasCVD?'ССЗ':'',d?.hasThrombophilia?'Тромбофилия':'',d?.hasLiverDisease?'Печень':'',d?.hasKidneyDisease?'Почки':'',d?.allergies?'Аллергии':''].filter(Boolean).join(', ')||'Нет',
    popupContent: (d: any, u: Function) => <div>
      <TextPc icon="💊" label="Аллергии (вещества/препараты)" value={d?.allergies||''} onChange={v => u('contraindications',{...d,allergies:v})} placeholder="Нет аллергий" multiline />
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
        <HealthBool label="Вредное производство" active={!!d?.hazardousWork} onClick={() => u('toxicLoad',{...d,hazardousWork:!d?.hazardousWork})} />
        <HealthBool label="НПВС регулярно" active={!!d?.regularNSAIDs} onClick={() => u('toxicLoad',{...d,regularNSAIDs:!d?.regularNSAIDs})} />
        <HealthBool label="Диабет" active={!!d?.hasDiabetes} onClick={() => u('contraindications',{...d,hasDiabetes:!d?.hasDiabetes})} />
        <HealthBool label="ССЗ" active={!!d?.hasCVD} onClick={() => u('contraindications',{...d,hasCVD:!d?.hasCVD})} />
        <HealthBool label="Тромбофилия" active={!!d?.hasThrombophilia} onClick={() => u('contraindications',{...d,hasThrombophilia:!d?.hasThrombophilia})} />
        <HealthBool label="Заб. печени" active={!!d?.hasLiverDisease} onClick={() => u('contraindications',{...d,hasLiverDisease:!d?.hasLiverDisease})} />
        <HealthBool label="Заб. почек" active={!!d?.hasKidneyDisease} onClick={() => u('contraindications',{...d,hasKidneyDisease:!d?.hasKidneyDisease})} />
        <HealthBool label="Заб. ЖКТ" active={!!d?.hasGI} onClick={() => u('contraindications',{...d,hasGI:!d?.hasGI})} />
        <HealthBool label="Простата" active={!!d?.hasProstateIssues} onClick={() => u('contraindications',{...d,hasProstateIssues:!d?.hasProstateIssues})} />
        <HealthBool label="Эпилепсия" active={!!d?.hasEpilepsy} onClick={() => u('contraindications',{...d,hasEpilepsy:!d?.hasEpilepsy})} />
        <HealthBool label="Психические" active={!!d?.hasMentalIllness} onClick={() => u('contraindications',{...d,hasMentalIllness:!d?.hasMentalIllness})} />
      </div>
    </div>,
  },
  {
    id: 'epicrisis', icon: '📋', title: 'Эпикриз (история)', color: '#c084fc',
    summary: (d: any) => [d?.pastGyno?'Гинекомастия':'',d?.pastLibidoDrop?'↓Либидо':'',d?.pastHctSpike?'↑HCT':'',d?.pastLiverIssues?'Печень':'',d?.pastKidneyIssues?'Почки':''].filter(Boolean).join(', ')||'Нет отмеченных',
    popupContent: (d: any, u: Function) => <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
      <HealthBool label="Гинекомастия" active={!!d?.pastGyno} onClick={() => u('epicrisis',{...d,pastGyno:!d?.pastGyno})} />
      <HealthBool label="↓ Либидо" active={!!d?.pastLibidoDrop} onClick={() => u('epicrisis',{...d,pastLibidoDrop:!d?.pastLibidoDrop})} />
      <HealthBool label="↑ HCT" active={!!d?.pastHctSpike} onClick={() => u('epicrisis',{...d,pastHctSpike:!d?.pastHctSpike})} />
      <HealthBool label="Печень" active={!!d?.pastLiverIssues} onClick={() => u('epicrisis',{...d,pastLiverIssues:!d?.pastLiverIssues})} />
      <HealthBool label="Почки" active={!!d?.pastKidneyIssues} onClick={() => u('epicrisis',{...d,pastKidneyIssues:!d?.pastKidneyIssues})} />
    </div>,
  },
  {
    id: 'goals', icon: '🎯', title: 'Цели курса', color: '#fb923c',
    summary: (d: any) => [d?.healthMaintenance?'Здоровье':'',d?.competitionPrep?'Соревн.':'',d?.sleepRecovery?'Сон':'',d?.cycleWeeks?`${d.cycleWeeks}нед`:''].filter(Boolean).join(', ')||'—',
    popupContent: (d: any, u: Function) => <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
        <HealthBool label="Здоровье" active={!!d?.healthMaintenance} onClick={() => u('goals',{...d,healthMaintenance:!d?.healthMaintenance})} />
        <HealthBool label="Соревнования" active={!!d?.competitionPrep} onClick={() => u('goals',{...d,competitionPrep:!d?.competitionPrep})} />
        <HealthBool label="Сон" active={!!d?.sleepRecovery} onClick={() => u('goals',{...d,sleepRecovery:!d?.sleepRecovery})} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:6 }}>
        <NumberPc icon="📅" label="Длина цикла" value={d?.cycleWeeks || 12} onChange={v => u('goals',{...d,cycleWeeks:parseInt(v)||12})} suffix="нед" />
        <NumberPc icon="🔄" label="Предыдущих курсов" value={d?.previousCycles || 0} onChange={v => u('goals',{...d,previousCycles:parseInt(v)||0})} />
      </div>
    </div>,
  },
  {
    id: 'injection', icon: '💉', title: 'Инъекции', color: '#38bdf8',
    summary: (d: any) => {
      const z=['glutes','quads','delts'].map(zn => {const v=(d||{})[zn]; return v&&v!=='ok'?(zn==='glutes'?'Ягодицы':zn==='quads'?'Бёдра':'Дельты')+': '+(v==='painful'?'больно':'уплотн.'):'';}).filter(Boolean);
      return z.length ? z.join(', ') : 'Норма';
    },
    popupContent: (d: any, u: Function) => <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
      {['glutes','quads','delts'].map(zone => (
        <div key={zone} style={{ flex:1, minWidth:100 }}>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginBottom:2 }}>{zone==='glutes'?'Ягодицы':zone==='quads'?'Бёдра':'Дельты'}</div>
          {(['ok','painful','lumps'] as const).map(opt => {
            const cur=(d||{})[zone]||'ok';
            return <button key={opt} onClick={() => u('injection',{...d,[zone]:opt})}
              style={{ display:'block', width:'100%', padding:'6px 8px', marginBottom:2, borderRadius:6, border:'none', cursor:'pointer', fontSize:10, fontWeight:600,
                background:cur===opt?'#38bdf8':'rgba(255,255,255,0.06)', color:cur===opt?'#000':'rgba(255,255,255,0.5)',
              }}>{opt==='ok'?'Норма':opt==='painful'?'Болезненно':'Уплотнения'}</button>;
          })}
        </div>
      ))}
    </div>,
  },
];

export const ProfileHealthSection: React.FC<Props> = ({ settings, save, calcData, upCalc, onNavigate }) => {
  const s = settings as any as UnifiedSettings;
  const hl = s.health || {} as any;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      <PopupCard icon="🧪" label="Лабораторные анализы" value="Ввод маркеров крови (70+ показателей)">
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:10 }}>Отслеживание маркеров крови, динамика, коррекция плана</div>
          <button onClick={() => onNavigate?.('labs')}
            style={{ padding:'10px 24px', borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
              background:'rgba(59,130,246,0.2)', color:'#93c5fd' }}>
            Перейти к анализам
          </button>
        </div>
      </PopupCard>
      <PopupCard icon="🏥" label="Хронические заболевания" value={(hl.chronicConditions??[]).length ? (hl.chronicConditions??[]).map((c:string)=>CHRONIC_CONDITIONS.find(cc=>cc.id===c)?.label||c).join(', ') : 'Нет'}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {CHRONIC_CONDITIONS.map(c => {
            const active = (hl.chronicConditions??[]).includes(c.id);
            return <HealthBool key={c.id} label={c.label} active={active}
              onClick={() => {const cur=hl.chronicConditions??[]; save({chronicConditions:active?cur.filter((x:string)=>x!==c.id):[...cur,c.id]});}} />;
          })}
        </div>
      </PopupCard>
      <PopupCard icon="🧬" label="Генетика (SNP)" value={(()=>{const g=hl.genetics??{}; const set=Object.entries(g).filter(([,v])=>v); return set.length ? set.map(([k,v])=>`${k}:${v}`).join(', ') : 'Не указано';})()}>
        <ProfileGeneticsSection settings={settings} save={save} />
      </PopupCard>
      {systemCards.map(sys => {
        const d = (calcData || {})[sys.id];
        return (
          <PopupCard key={sys.id} icon={sys.icon} label={sys.title} value={sys.summary(d)}>
            {sys.popupContent(d, upCalc || (() => {}))}
          </PopupCard>
        );
      })}
      <PopupCard icon="🩼" label="Травмы" value={(()=>{const inj=hl.injuries??[]; return inj.length ? inj.map((i:any)=>`${i.location||'?'}(${i.painLevel}/10)`).join(', ') : 'Нет записей';})()}>
        <ProfileInjuriesSection settings={settings} save={save} />
      </PopupCard>
      <TextPc icon="🔴" label="Исключить БАДы (id)" value={(hl.excludedSupplements||[]).join(', ')} onChange={v => save({excludedSupplements:v.split(',').map((s:string)=>s.trim()).filter(Boolean)})} placeholder="yohimbine, huperzine_a, dmaa" />
      <TextPc icon="💊" label="Исключить лекарства (id)" value={(hl.excludedMeds||[]).join(', ')} onChange={v => save({excludedMeds:v.split(',').map((s:string)=>s.trim()).filter(Boolean)})} placeholder="telmisartan, nebivolol, anastrozole" />
    </div>
  );
};
