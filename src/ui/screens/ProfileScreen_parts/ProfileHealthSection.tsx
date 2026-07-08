import React from 'react';
import type { UserProfile } from '../../../core/types';
import { theme, glassCardStyle, sectionLabelStyle, ExpandableCard, HealthNumber, HealthBool, HealthSlider } from './ProfileComponents';
import { ProfileGeneticsSection } from './ProfileGeneticsSection';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: Partial<UserProfile['settings']>) => void;
  calcData: any;
  upCalc: (k: string, v: any) => void;
  onNavigate?: (screen: string) => void;
}

const CHRONIC_CONDITIONS: { id: string; label: string }[] = [
  { id: 'hypertension', label: 'Гипертония' }, { id: 'diabetes', label: 'Диабет' },
  { id: 'asthma', label: 'Астма' }, { id: 'thyroid', label: 'Щитовидная железа' },
  { id: 'heart', label: 'Сердечно-сосудистые' }, { id: 'liver', label: 'Заболевания печени' },
  { id: 'kidney', label: 'Заболевания почек' }, { id: 'joints', label: 'Заболевания суставов' },
];

export const ProfileHealthSection: React.FC<Props> = ({ settings, save, calcData, upCalc, onNavigate }) => {
  return (
    <div>
      {/* Data sources hub */}
      <div style={{
        ...glassCardStyle, marginBottom: 8, border: '1px solid rgba(59,130,246,0.25)',
        background: 'linear-gradient(135deg,rgba(59,130,246,0.10),rgba(99,102,241,0.05))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>📊</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>Источники данных для расчётов</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Лабораторные маркеры + карточки здоровья → все модули</div>
          </div>
        </div>
        {[
          { icon: '⚠️', label: 'Расчёт рисков (TZ)', info: '38 маркеров + здоровье', nav: 'risks', color: '#f87171' },
          { icon: '🧩', label: 'Калькулятор поддержки', info: '50+ маркеров + здоровье', nav: 'support', color: '#34d399' },
          { icon: '🏋️', label: 'Тренировки (объём/коррекция)', info: 'композиты + здоровье', nav: 'training', color: '#60a5fa' },
          { icon: '🧬', label: 'Фертильность', info: '18 параметров', nav: 'support', color: '#c084fc' },
          { icon: '📊', label: 'Readiness / прогнозы', info: '4 маркера + стресс/сон', nav: 'home', color: '#fbbf24' },
        ].map(m => (
          <div key={m.nav + m.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}
            onClick={() => onNavigate?.(m.nav)}>
            <span style={{ fontSize: 12 }}>{m.icon}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', flex: 1 }}>{m.label}</span>
            <span style={{ fontSize: 9, color: m.color, fontWeight: 600 }}>{m.info}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>→</span>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginTop: 6 }}>
          {[
            { nav: 'labs', label: '🧪 Labs', bg: 'rgba(59,130,246,0.25)', color: '#93c5fd' },
            { nav: 'risks', label: '⚠ Риски', bg: 'rgba(248,113,113,0.2)', color: '#fca5a5' },
            { nav: 'support', label: '🧩 Поддержка', bg: 'rgba(52,211,153,0.2)', color: '#6ee7b7' },
          ].map(b => (
            <button key={b.nav} onClick={() => onNavigate?.(b.nav)}
              style={{ padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: b.bg, color: b.color, fontSize: 10, fontWeight: 700 }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chronic conditions */}
      <ExpandableCard icon="🏥" title="Хронические заболевания" color="#ef4444" open={false}
        summary={(settings.chronicConditions ?? []).map((c: string) => CHRONIC_CONDITIONS.find(cc => cc.id === c)?.label || c).join(', ') || 'Нет'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {CHRONIC_CONDITIONS.map(c => {
            const active = (settings.chronicConditions ?? []).includes(c.id);
            return <HealthBool key={c.id} label={c.label} active={active}
              onClick={() => { const cur = settings.chronicConditions ?? []; save({ chronicConditions: active ? cur.filter((x: string) => x !== c.id) : [...cur, c.id] }); }} />;
          })}
        </div>
      </ExpandableCard>

      {/* Genetics */}
      <ExpandableCard icon="🧬" title="Генетика (SNP)" color="#c084fc" open={false}
        summary={(() => {
          const g = settings.genetics ?? {};
          const set = Object.entries(g).filter(([, v]) => v);
          return set.length ? set.map(([k, v]) => `${k}:${v}`).join(', ') : 'Не указано';
        })()}>
        <ProfileGeneticsSection settings={settings} save={save} />
      </ExpandableCard>

      {/* Health systems from calcData */}
      {[
        {
          id: 'neuro', icon: '🧠', title: 'Неврология', color: '#a78bfa',
          summary: (d: any) => `Дофамин: ${d?.dopamineScore || '—'} | Серотонин: ${d?.serotoninScore || '—'} | Сон: ${d?.sleepQuality === 'good' ? 'хор' : d?.sleepQuality === 'fair' ? 'ср' : d?.sleepQuality === 'poor' ? 'пл' : '—'}` +
            ([d?.memoryIssues ? 'Память' : '', d?.focusIssues ? 'Конц.' : '', d?.headaches ? 'Боли' : '', d?.slowThinking ? 'Мышл.' : ''].filter(Boolean).length
              ? ' | ' + [d?.memoryIssues ? 'Память' : '', d?.focusIssues ? 'Конц.' : '', d?.headaches ? 'Боли' : '', d?.slowThinking ? 'Мышл.' : ''].filter(Boolean).join(',') : ''),
          fields: (d: any, u: Function) => <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <HealthNumber label="Дофамин (1-5)" value={d?.dopamineScore || 1} min={1} max={5} onChange={v => u('neuro', { ...d, dopamineScore: parseInt(v) || 1 })} />
              <HealthNumber label="Серотонин (1-5)" value={d?.serotoninScore || 1} min={1} max={5} onChange={v => u('neuro', { ...d, serotoninScore: parseInt(v) || 1 })} />
              <HealthNumber label="Агрессия (1-5)" value={d?.aggressionScore || 1} min={1} max={5} onChange={v => u('neuro', { ...d, aggressionScore: parseInt(v) || 1 })} />
            </div>
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Качество сна</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ v: 'good', l: 'Хороший' }, { v: 'fair', l: 'Средний' }, { v: 'poor', l: 'Плохой' }].map(opt => (
                  <button key={opt.v} onClick={() => u('neuro', { ...d, sleepQuality: opt.v })}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                      background: (d?.sleepQuality || 'good') === opt.v ? '#a78bfa' : 'rgba(255,255,255,0.06)',
                      color: (d?.sleepQuality || 'good') === opt.v ? '#000' : 'rgba(255,255,255,0.5)',
                    }}>{opt.l}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              <HealthBool label="Память" active={!!d?.memoryIssues} onClick={() => u('neuro', { ...d, memoryIssues: !d?.memoryIssues })} />
              <HealthBool label="Концентрация" active={!!d?.focusIssues} onClick={() => u('neuro', { ...d, focusIssues: !d?.focusIssues })} />
              <HealthBool label="Замедл. мышление" active={!!d?.slowThinking} onClick={() => u('neuro', { ...d, slowThinking: !d?.slowThinking })} />
              <HealthBool label="Головные боли" active={!!d?.headaches} onClick={() => u('neuro', { ...d, headaches: !d?.headaches })} />
              <HealthBool label="Метеозависимость" active={!!d?.weatherDependent} onClick={() => u('neuro', { ...d, weatherDependent: !d?.weatherDependent })} />
            </div>
          </>
        },
        {
          id: 'oda', icon: '🦴', title: 'ОДА', color: '#f97316',
          summary: (d: any) => { const a = [d?.jointPain === 'mild' ? 'Боль в суставах' : '', d?.ligamentIssues ? 'Связки' : '', d?.backPain ? 'Боль в спине' : '']; return a.filter(Boolean).length ? a.filter(Boolean).join(', ') : 'Нет жалоб'; },
          fields: (d: any, u: Function) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <HealthBool label="Боль в суставах" active={d?.jointPain === 'mild'} onClick={() => u('oda', { ...d, jointPain: d?.jointPain === 'mild' ? 'none' : 'mild' })} />
            <HealthBool label="Связки (слабые)" active={!!d?.ligamentIssues} onClick={() => u('oda', { ...d, ligamentIssues: !d?.ligamentIssues })} />
            <HealthBool label="Боль в спине" active={!!d?.backPain} onClick={() => u('oda', { ...d, backPain: !d?.backPain })} />
          </div>
        },
        {
          id: 'epicrisis', icon: '📋', title: 'Эпикриз (история)', color: '#c084fc',
          summary: (d: any) => { const a = [d?.pastGyno ? 'Гинекомастия' : '', d?.pastLibidoDrop ? '↓ Либидо' : '', d?.pastHctSpike ? '↑ HCT' : '', d?.pastLiverIssues ? 'Печень' : '', d?.pastKidneyIssues ? 'Почки' : '']; return a.filter(Boolean).length ? a.filter(Boolean).join(', ') : 'Нет отмеченных'; },
          fields: (d: any, u: Function) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <HealthBool label="Гинекомастия" active={!!d?.pastGyno} onClick={() => u('epicrisis', { ...d, pastGyno: !d?.pastGyno })} />
            <HealthBool label="↓ Либидо" active={!!d?.pastLibidoDrop} onClick={() => u('epicrisis', { ...d, pastLibidoDrop: !d?.pastLibidoDrop })} />
            <HealthBool label="↑ HCT" active={!!d?.pastHctSpike} onClick={() => u('epicrisis', { ...d, pastHctSpike: !d?.pastHctSpike })} />
            <HealthBool label="Печень" active={!!d?.pastLiverIssues} onClick={() => u('epicrisis', { ...d, pastLiverIssues: !d?.pastLiverIssues })} />
            <HealthBool label="Почки" active={!!d?.pastKidneyIssues} onClick={() => u('epicrisis', { ...d, pastKidneyIssues: !d?.pastKidneyIssues })} />
          </div>
        },
        {
          id: 'goals', icon: '🎯', title: 'Цели курса', color: '#fb923c',
          summary: (d: any) => { const a = [d?.healthMaintenance ? 'Здоровье' : '', d?.competitionPrep ? 'Соревн.' : '', d?.sleepRecovery ? 'Сон' : '']; const s = a.filter(Boolean).join(', '); return (s || '—') + (d?.cycleWeeks ? ` | ${d.cycleWeeks} нед` : ''); },
          fields: (d: any, u: Function) => <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <HealthBool label="Здоровье" active={!!d?.healthMaintenance} onClick={() => u('goals', { ...d, healthMaintenance: !d?.healthMaintenance })} />
              <HealthBool label="Соревнования" active={!!d?.competitionPrep} onClick={() => u('goals', { ...d, competitionPrep: !d?.competitionPrep })} />
              <HealthBool label="Сон" active={!!d?.sleepRecovery} onClick={() => u('goals', { ...d, sleepRecovery: !d?.sleepRecovery })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
              <HealthNumber label="Длина цикла (нед)" value={d?.cycleWeeks || 12} onChange={v => u('goals', { ...d, cycleWeeks: parseInt(v) || 12 })} />
              <HealthNumber label="Предыдущих курсов" value={d?.previousCycles || 0} onChange={v => u('goals', { ...d, previousCycles: parseInt(v) || 0 })} />
            </div>
          </>
        },
        {
          id: 'psych', icon: '🧘', title: 'Психология', color: '#e879f9',
          summary: (d: any) => `Страх: ${d?.fearOfLoss || 1} | Зеркало: ${d?.mirrorObsession || 1} | Апатия: ${d?.apathyOffCycle || 1}`,
          fields: (d: any, u: Function) => <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <HealthNumber label="Страх потери (1-5)" value={d?.fearOfLoss || 1} min={1} max={5} onChange={v => u('psych', { ...d, fearOfLoss: parseInt(v) || 1 })} />
            <HealthNumber label="Зеркало (1-5)" value={d?.mirrorObsession || 1} min={1} max={5} onChange={v => u('psych', { ...d, mirrorObsession: parseInt(v) || 1 })} />
            <HealthNumber label="Апатия (1-5)" value={d?.apathyOffCycle || 1} min={1} max={5} onChange={v => u('psych', { ...d, apathyOffCycle: parseInt(v) || 1 })} />
          </div>
        },
        {
          id: 'toxicLoad', icon: '☣️', title: 'Токсическая нагрузка', color: '#ef4444',
          summary: (d: any) => [d?.hazardousWork ? 'Вредное производство' : '', d?.regularNSAIDs ? 'НПВС регулярно' : ''].filter(Boolean).join(', ') || 'Нет',
          fields: (d: any, u: Function) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <HealthBool label="Вредное производство" active={!!d?.hazardousWork} onClick={() => u('toxicLoad', { ...d, hazardousWork: !d?.hazardousWork })} />
            <HealthBool label="НПВС регулярно" active={!!d?.regularNSAIDs} onClick={() => u('toxicLoad', { ...d, regularNSAIDs: !d?.regularNSAIDs })} />
          </div>
        },
        {
          id: 'dental', icon: '🦷', title: 'Стоматология', color: '#94a3b8',
          summary: (d: any) => { const a = [d?.bleedingGums ? 'Кровоточивость' : '', d?.looseTeeth ? 'Подв.зубов' : '', d?.cramps ? 'Судороги' : '']; return a.filter(Boolean).length ? a.filter(Boolean).join(', ') : 'Нет жалоб'; },
          fields: (d: any, u: Function) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <HealthBool label="Кровоточивость" active={!!d?.bleedingGums} onClick={() => u('dental', { ...d, bleedingGums: !d?.bleedingGums })} />
            <HealthBool label="Подвижность зубов" active={!!d?.looseTeeth} onClick={() => u('dental', { ...d, looseTeeth: !d?.looseTeeth })} />
            <HealthBool label="Судороги" active={!!d?.cramps} onClick={() => u('dental', { ...d, cramps: !d?.cramps })} />
          </div>
        },
        {
          id: 'injection', icon: '💉', title: 'Инъекции', color: '#38bdf8',
          summary: (d: any) => { const z = ['glutes', 'quads', 'delts'].map(zn => { const v = (d || {})[zn]; return v && v !== 'ok' ? (zn === 'glutes' ? 'Ягодицы' : zn === 'quads' ? 'Бёдра' : 'Дельты') + ': ' + (v === 'painful' ? 'больно' : 'уплотн.') : ''; }).filter(Boolean); return z.length ? z.join(', ') : 'Норма'; },
          fields: (d: any, u: Function) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['glutes', 'quads', 'delts'].map(zone => (
              <div key={zone} style={{ flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{zone === 'glutes' ? 'Ягодицы' : zone === 'quads' ? 'Бёдра' : 'Дельты'}</div>
                {(['ok', 'painful', 'lumps'] as const).map(opt => {
                  const cur = (d || {})[zone] || 'ok';
                  return <button key={opt} onClick={() => u('injection', { ...d, [zone]: opt })}
                    style={{
                      display: 'block', width: '100%', padding: '6px 8px', marginBottom: 2, borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                      background: cur === opt ? '#38bdf8' : 'rgba(255,255,255,0.06)', color: cur === opt ? '#000' : 'rgba(255,255,255,0.5)',
                    }}>{opt === 'ok' ? 'Норма' : opt === 'painful' ? 'Болезненно' : 'Уплотнения'}</button>;
                })}
              </div>
            ))}
          </div>
        },
        {
          id: 'cardio', icon: '❤️', title: 'ССС (сердечно-сосудистая)', color: '#f87171',
          summary: (d: any) => {
            const bp: Record<string, string> = { normal: 'Норма', prehypertension: 'Предгиперт.', hypertension1: 'Гиперт.I', hypertension2: 'Гиперт.II' };
            const hct: Record<string, string> = { none: '—', mild: '↑сл', moderate: '↑ум', severe: '↑выс' };
            return `АД: ${bp[d?.bpStage] || '—'} | HCT: ${hct[d?.hctElevation] || '—'}` + (d?.heartRate ? ` | ЧСС: ${d.heartRate}` : '');
          },
          fields: (d: any, u: Function) => <>
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Стадия АД</div>
              <div style={{ display: 'flex', gap: 3 }}>
                {[{ v: 'normal', l: 'Норма' }, { v: 'prehypertension', l: 'Предгиперт.' }, { v: 'hypertension1', l: 'Гиперт.I' }, { v: 'hypertension2', l: 'Гиперт.II' }].map(opt => (
                  <button key={opt.v} onClick={() => u('cardio', { ...d, bpStage: opt.v })}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 600,
                      background: (d?.bpStage || 'normal') === opt.v ? '#f87171' : 'rgba(255,255,255,0.06)',
                      color: (d?.bpStage || 'normal') === opt.v ? '#000' : 'rgba(255,255,255,0.5)',
                    }}>{opt.l}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Гематокрит (HCT)</div>
              <div style={{ display: 'flex', gap: 3 }}>
                {[{ v: 'none', l: 'Норма' }, { v: 'mild', l: 'Сл.повышен' }, { v: 'moderate', l: 'Умеренно' }, { v: 'severe', l: 'Сильно' }].map(opt => (
                  <button key={opt.v} onClick={() => u('cardio', { ...d, hctElevation: opt.v })}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 600,
                      background: (d?.hctElevation || 'none') === opt.v ? '#f87171' : 'rgba(255,255,255,0.06)',
                      color: (d?.hctElevation || 'none') === opt.v ? '#000' : 'rgba(255,255,255,0.5)',
                    }}>{opt.l}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <HealthNumber label="ЧСС (уд/мин)" value={d?.heartRate || 72} min={40} max={200} onChange={v => u('cardio', { ...d, heartRate: parseInt(v) || 72 })} />
              <HealthNumber label="ЛПНП" value={d?.ldlElevation || 'none'} onChange={v => u('cardio', { ...d, ldlElevation: v })} />
              <div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Низкий ЛПВП</div>
                <HealthBool label="Да" active={!!d?.hdlLow} onClick={() => u('cardio', { ...d, hdlLow: !d?.hdlLow })} />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              <HealthBool label="ССЗ ранее" active={!!d?.previousCVD} onClick={() => u('cardio', { ...d, previousCVD: !d?.previousCVD })} />
              <HealthBool label="Сем.анамнез ССЗ" active={!!d?.familyCVD} onClick={() => u('cardio', { ...d, familyCVD: !d?.familyCVD })} />
              <HealthBool label="Высокие триглицериды" active={d?.triglycerides === 'high'} onClick={() => u('cardio', { ...d, triglycerides: d?.triglycerides === 'high' ? 'normal' : 'high' })} />
            </div>
          </>
        },
        {
          id: 'gi', icon: '🫀', title: 'ЖКТ (желудочно-кишечный тракт)', color: '#fbbf24',
          summary: (d: any) => {
            const s = [d?.bloating ? 'Вздутие' : '', d?.heartburn ? 'Изжога' : '', d?.constipation ? 'Запор' : '', d?.diarrhea ? 'Диарея' : '', d?.diagnosedIBS ? 'СРК' : ''].filter(Boolean);
            return s.length ? s.join(', ') : 'Нет жалоб';
          },
          fields: (d: any, u: Function) => <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <HealthBool label="Вздутие" active={!!d?.bloating} onClick={() => u('gi', { ...d, bloating: !d?.bloating })} />
              <HealthBool label="Изжога" active={!!d?.heartburn} onClick={() => u('gi', { ...d, heartburn: !d?.heartburn })} />
              <HealthBool label="Запор" active={!!d?.constipation} onClick={() => u('gi', { ...d, constipation: !d?.constipation })} />
              <HealthBool label="Диарея" active={!!d?.diarrhea} onClick={() => u('gi', { ...d, diarrhea: !d?.diarrhea })} />
              <HealthBool label="СРК (диагн.)" active={!!d?.diagnosedIBS} onClick={() => u('gi', { ...d, diagnosedIBS: !d?.diagnosedIBS })} />
              <HealthBool label="Ферменты" active={!!d?.enzymeSupport} onClick={() => u('gi', { ...d, enzymeSupport: !d?.enzymeSupport })} />
              <HealthBool label="Пробиотики" active={!!d?.probioticUse} onClick={() => u('gi', { ...d, probioticUse: !d?.probioticUse })} />
            </div>
          </>
        },
        {
          id: 'contraindications', icon: '🩺', title: 'Противопоказания', color: '#ef4444',
          summary: (d: any) => {
            const s = [d?.hasDiabetes ? 'Диабет' : '', d?.hasCVD ? 'ССЗ' : '', d?.hasThrombophilia ? 'Тромбофилия' : '', d?.hasLiverDisease ? 'Печень' : '', d?.hasKidneyDisease ? 'Почки' : '', d?.hasGI ? 'ЖКТ' : '', d?.hasProstateIssues ? 'Простата' : '', d?.hasEpilepsy ? 'Эпилепсия' : '', d?.allergies ? 'Аллергии' : ''].filter(Boolean);
            return s.length ? s.join(', ') : 'Нет отмеченных';
          },
          fields: (d: any, u: Function) => <>
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Аллергии (вещества/препараты)</div>
              <textarea value={d?.allergies || ''} onChange={e => u('contraindications', { ...d, allergies: e.target.value })}
                placeholder="Нет аллергий"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 11, minHeight: 40, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              <HealthBool label="Диабет" active={!!d?.hasDiabetes} onClick={() => u('contraindications', { ...d, hasDiabetes: !d?.hasDiabetes })} />
              <HealthBool label="ССЗ" active={!!d?.hasCVD} onClick={() => u('contraindications', { ...d, hasCVD: !d?.hasCVD })} />
              <HealthBool label="Тромбофилия" active={!!d?.hasThrombophilia} onClick={() => u('contraindications', { ...d, hasThrombophilia: !d?.hasThrombophilia })} />
              <HealthBool label="Заб. печени" active={!!d?.hasLiverDisease} onClick={() => u('contraindications', { ...d, hasLiverDisease: !d?.hasLiverDisease })} />
              <HealthBool label="Заб. почек" active={!!d?.hasKidneyDisease} onClick={() => u('contraindications', { ...d, hasKidneyDisease: !d?.hasKidneyDisease })} />
              <HealthBool label="Заб. ЖКТ" active={!!d?.hasGI} onClick={() => u('contraindications', { ...d, hasGI: !d?.hasGI })} />
              <HealthBool label="Простата" active={!!d?.hasProstateIssues} onClick={() => u('contraindications', { ...d, hasProstateIssues: !d?.hasProstateIssues })} />
              <HealthBool label="Эпилепсия" active={!!d?.hasEpilepsy} onClick={() => u('contraindications', { ...d, hasEpilepsy: !d?.hasEpilepsy })} />
              <HealthBool label="Психические" active={!!d?.hasMentalIllness} onClick={() => u('contraindications', { ...d, hasMentalIllness: !d?.hasMentalIllness })} />
            </div>
          </>
        },
      ].map(sys => {
        const d = (calcData || {})[sys.id];
        return (
          <ExpandableCard key={sys.id} icon={sys.icon} title={sys.title} color={sys.color} open={false} summary={sys.summary(d)}>
            {sys.fields(d, upCalc)}
          </ExpandableCard>
        );
      })}

      {/* Exclude supplements & meds */}
      <ExpandableCard icon="🚫" title="Исключить БАДы / лекарства" color="#8b5cf6" open={false}
        summary={[settings.excludedSupplements ? `БАДы: ${settings.excludedSupplements}` : '', settings.excludedMeds ? `Лекарства: ${settings.excludedMeds}` : ''].filter(Boolean).join(' | ') || 'Не заданы'}>
        <div style={{marginBottom:8}}>
          <label style={{fontSize:8,color:'rgba(255,255,255,0.5)',marginBottom:2,display:'block'}}>🔴 Исключить БАДы (id через запятую):</label>
          <input value={settings.excludedSupplements || ''} onChange={e => save({ excludedSupplements: e.target.value })}
            placeholder="yohimbine, huperzine_a, dmaa"
            style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:11,boxSizing:'border-box'}} />
        </div>
        <div>
          <label style={{fontSize:8,color:'rgba(255,255,255,0.5)',marginBottom:2,display:'block'}}>💊 Исключить лекарства (id через запятую):</label>
          <input value={settings.excludedMeds || ''} onChange={e => save({ excludedMeds: e.target.value })}
            placeholder="telmisartan, nebivolol, anastrozole"
            style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:11,boxSizing:'border-box'}} />
        </div>
      </ExpandableCard>
    </div>
  );
};
