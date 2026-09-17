// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, StopBanner, ContraBanner, ProtocolDisclaimer, ItemRow } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';
import {
  FEMALE_INJECT_DOSES, FEMALE_ORAL_DOSES, FEMALE_PEPTIDE_DOSES, FEMALE_SARM_DOSES, DECA_125_NOTE,
  FEMALE_SUPPORT_PROTOCOLS, FEMALE_LAB_GROUPS, FEMALE_STOP_THRESHOLDS, FEMALE_STOP_SYMPTOMS,
  FEMALE_TIMELINE, FEMALE_GOALS, FEMALE_AGE_GROUPS, FEMALE_SAFE_COMBOS, FEMALE_DANGER_COMBOS,
  FEMALE_FORBIDDEN_COMBOS, FEMALE_LIBIDO_EFFECTS, FEMALE_EMERGENCY_CRITICAL, FEMALE_EMERGENCY_URGENT,
  FEMALE_FERTILITY_PLAN, FEMALE_PSYCHE_EFFECTS,
  FEMALE_VIRILIZATION_CALC, femaleVirilizationScore,
  FEMALE_IRON_THRESHOLDS, FEMALE_IRON_SCHEME, FEMALE_IRON_DIAGNOSTICS, FEMALE_IRON_GATES,
  FEMALE_AMENORRHEA_ALGO, FEMALE_BONE_HONESTY, FEMALE_REDS_SIGNS, redsTrafficLight,
  FEMALE_UROGENITAL_SUPPORT, FERRIMAN_GALLWEY_ZONES, ferrimanGallweyTotal, ferrimanGallweyBand,
} from './supportProtocolWomenData';

const wInput: React.CSSProperties = {
  background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  padding: '9px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', minHeight: 40,
};

const bandColor = (band: string): string =>
  band === 'critical' || band === 'high' ? '#ef4444' : band === 'risk' ? '#f97316' : band === 'caution' ? '#f59e0b' : '#22c55e';

/** Живой калькулятор Virilization Score: Σ (доза/красный порог × андрогенный индекс × недели/4 × 3.0 × 10). */
const VirilizationScoreCalculator: React.FC = () => {
  const [subId, setSubId] = useState('nand_deca');
  const [dose, setDose] = useState('50');
  const [weeks, setWeeks] = useState('8');
  const [age, setAge] = useState('30');
  const [genetic, setGenetic] = useState(false);
  const [prev, setPrev] = useState(false);
  const item = FEMALE_VIRILIZATION_CALC.find((x: any) => x.id === subId) || FEMALE_VIRILIZATION_CALC[0];
  const res = femaleVirilizationScore(
    [{ id: item.id, dose: parseFloat(dose) || 0 }],
    parseFloat(weeks) || 0,
    { age: parseFloat(age) || 30, geneticSensitivity: genetic, previousCycles: prev },
  );
  const color = bandColor(res.band);
  const toggle = (on: boolean): React.CSSProperties => ({
    flex: '1 1 140px', padding: '9px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', minHeight: 40,
    background: on ? 'rgba(244,114,182,0.16)' : 'rgba(255,255,255,0.05)',
    color: on ? '#f9a8d4' : '#fff',
    border: `1px solid ${on ? 'rgba(244,114,182,0.4)' : 'rgba(255,255,255,0.08)'}`,
  });
  return (
    <div style={cardBg} data-vircalc="root">
      <div style={{ fontSize:11, fontWeight:800, color:'#f472b6', marginBottom:4 }}>🧮 Калькулятор Virilization Score</div>
      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:8, lineHeight:1.35 }}>Справочная оценка риска вирилизации (0–100): доза против красного порога × андрогенный индекс × длительность × чувствительность 3.0. Не диагноз и не гарантия — решение принимает врач.</div>
      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:8, lineHeight:1.4 }}>Множители чувствительности: база 3.0 · генетическая ×1.5 · прошлые циклы ×1.2 · до 25 лет ×1.3 · после 45 лет ×0.8. Андрогенный индекс: тестостерон 1.0 · тренболон 1.5 · нор-группа (нандролон) 0.35 · примоболан 0.2.</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <select value={subId} onChange={(e) => setSubId(e.target.value)} aria-label="Вещество" style={wInput}>
          {FEMALE_VIRILIZATION_CALC.map((x: any) => (
            <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>
          ))}
        </select>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <input type="number" inputMode="decimal" min={0} value={dose} onChange={(e)=>setDose(e.target.value)}
            aria-label={`Доза, ${item.unit}`} placeholder={`Доза, ${item.unit}`} style={{ ...wInput, flex:'1 1 130px', width:'auto' }} />
          <input type="number" inputMode="numeric" min={1} max={52} value={weeks} onChange={(e)=>setWeeks(e.target.value)}
            aria-label="Длительность, недель" placeholder="Недель" style={{ ...wInput, flex:'1 1 90px', width:'auto' }} />
          <input type="number" inputMode="numeric" min={14} max={70} value={age} onChange={(e)=>setAge(e.target.value)}
            aria-label="Возраст" placeholder="Возраст" style={{ ...wInput, flex:'1 1 90px', width:'auto' }} />
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button type="button" aria-pressed={genetic} onClick={() => setGenetic((v) => !v)} style={toggle(genetic)}>Генет. чувствительность (акне/гирсутизм до курса)</button>
          <button type="button" aria-pressed={prev} onClick={() => setPrev((v) => !v)} style={toggle(prev)}>Предыдущие циклы</button>
        </div>
      </div>
      <div data-vircalc="result" style={{ marginTop:8, padding:'10px 12px', borderRadius:10, background: color + '12', border: `1px solid ${color}30` }}>
        <div style={{ fontSize:15, fontWeight:850, color }}>{res.score} / 100 — {res.bandLabel}</div>
        {res.breakdown.length > 0 && (
          <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:4 }}>
            {res.breakdown.map((b: any, i: number) => (
              <div key={i}>• {b.name}: вклад {b.contribution.toFixed(1)}</div>
            ))}
          </div>
        )}
        <div style={{ fontSize:10, color:'#fca5a5', marginTop:4, lineHeight:1.4 }}>
          {res.recommendations.map((r: any, i: number) => (<div key={i}>→ {r}</div>))}
        </div>
      </div>
    </div>
  );
};

/** FG-шкала Ферримана–Голлвея: 9 зон по 0–4, живой итог, порог гирсутизма >8. Динамика, не диагноз. */
const HirsutismScale: React.FC = () => {
  const [vals, setVals] = useState<number[]>(() => FERRIMAN_GALLWEY_ZONES.map(() => 0));
  const total = ferrimanGallweyTotal(vals);
  const band = ferrimanGallweyBand(total);
  const color = band.level === 'hirsutism' ? '#ef4444' : band.level === 'borderline' ? '#f59e0b' : '#22c55e';
  const cell = (active: boolean): React.CSSProperties => ({
    minWidth: 34, minHeight: 34, borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
    background: active ? 'rgba(244,114,182,0.2)' : 'rgba(255,255,255,0.05)',
    color: active ? '#f9a8d4' : '#fff',
    border: `1px solid ${active ? 'rgba(244,114,182,0.5)' : 'rgba(255,255,255,0.08)'}`,
  });
  return (
    <div style={cardBg} data-fg="root">
      <div style={{ fontSize:11, fontWeight:800, color:'#f472b6', marginBottom:4 }}>📏 Шкала Ферримана–Голлвея (гирсутизм, 9 зон)</div>
      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:8, lineHeight:1.35 }}>Каждая зона 0–4 (0 — нет терминальных волос, 4 — выраженный мужской тип). Итог &gt;8 — гирсутизм (у части этнических групп порог ниже). Это динамика для врача и фото-локусов, а не диагноз; отмечайте раз в 2–4 нед на курсе.</div>
      {FERRIMAN_GALLWEY_ZONES.map((z: any, zi: number) => (
        <div key={z.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize:9, color:'#fff', flex:'1 1 auto' }}>{z.label}</span>
          {[0, 1, 2, 3, 4].map((n) => (
            <button key={n} type="button" aria-pressed={vals[zi] === n} aria-label={`${z.label}: ${n}`}
              onClick={() => setVals((prev) => prev.map((v, i) => (i === zi ? n : v)))}
              style={cell(vals[zi] === n)}>{n}</button>
          ))}
        </div>
      ))}
      <div data-fg="result" style={{ marginTop:8, padding:'9px 11px', borderRadius:10, background: color + '12', border: `1px solid ${color}30` }}>
        <div style={{ fontSize:13, fontWeight:850, color }}>Итог: {total} — {band.label}</div>
        <div style={{ fontSize:8, color:'#fff', marginTop:3, lineHeight:1.4 }}>→ {band.advice}</div>
      </div>
    </div>
  );
};

/** RED-S светофор по признакам (Triad-2025: без EA-порогов, primary indicators). */
const RedsTrafficLight: React.FC = () => {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const res = redsTrafficLight(flags as any);
  const color = res.level === 'red' ? '#ef4444' : res.level === 'yellow' ? '#f59e0b' : '#22c55e';
  const toggle = (on: boolean): React.CSSProperties => ({
    width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 9, fontSize: 9, fontWeight: 700, cursor: 'pointer',
    minHeight: 40, lineHeight: 1.3,
    background: on ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
    color: on ? '#fca5a5' : '#fff',
    border: `1px solid ${on ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
  });
  return (
    <div style={cardBg} data-reds="root">
      <div style={{ fontSize:11, fontWeight:800, color:'#f472b6', marginBottom:4 }}>🚦 RED-S — светофор по признакам</div>
      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:8, lineHeight:1.35 }}>Отметьте, что есть сейчас. Оценка честная: обновление Triad-2025 ушло от порогов энергодоступности — считаются клинические признаки (менструальные нарушения, BSI, РПП). Не диагноз — решение врача.</div>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {FEMALE_REDS_SIGNS.map((sg: any) => (
          <button key={sg.id} type="button" aria-pressed={!!flags[sg.id]} aria-label={sg.label}
            onClick={() => setFlags((prev) => ({ ...prev, [sg.id]: !prev[sg.id] }))}
            style={toggle(!!flags[sg.id])}>
            {flags[sg.id] ? '☑' : '☐'} {sg.label}
            <span style={{ display:'block', fontSize:7, color:'var(--text-dim)', fontWeight:400, marginTop:1 }}>{sg.detail}</span>
          </button>
        ))}
      </div>
      <div data-reds="result" style={{ marginTop:8, padding:'9px 11px', borderRadius:10, background: color + '12', border: `1px solid ${color}30` }}>
        <div style={{ fontSize:13, fontWeight:850, color }}>{res.label}</div>
        {res.positive.length > 0 && (
          <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:3 }}>Признаки: {res.positive.join(' · ')}</div>
        )}
        <div style={{ fontSize:8, color:'#fff', marginTop:3, lineHeight:1.4 }}>→ {res.advice}</div>
      </div>
    </div>
  );
};

export const SupportProtocolWomen: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [womenTab, setWomenTab] = useState('virilization');
  return (
    <InfoErrorBoundary label="Женщины и ААС">
      <div className="sup-proto-women" style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
        <div style={cardBg}>
          <div style={{ fontSize:13, fontWeight:800, color:'#f472b6', marginBottom:2 }}>♀️ Женский цикл и ААС</div>
          <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Абсолютные противопоказания, необратимые риски вирилизации, пороги андрогенов для женщин, беременность и контрацепция на ААС. Расширено: дозы веществ (ААС/пептиды/SARMs), примерные протоколы поддержки с дозировками, женские лабораторные референсы, таймлайн цикла, либидо, взаимодействия, цели/возраст, экстренные ситуации.</p>
          <p style={{ fontSize:9, color:'#f9a8d4', margin:'4px 0 0', lineHeight:1.3, fontWeight:700 }}>🧮 Калькулятор Virilization Score, примеры и андрогенные индексы — в табе «⚖️ Дозы веществ».</p>
        </div>

        <ProtocolDisclaimer />

        <StopBanner title="АБСОЛЮТНЫЕ ПРОТИВОПОКАЗАНИЯ ДЛЯ ЖЕНЩИН" thresholds={[
          'Беременность (категория X для всех ААС — тератогенность, особенно для плода женского пола)',
          'Лактация (ААС проникают в грудное молоко)',
          'Планирование беременности в ближайшие 6-12 мес',
          'Рак молочной железы / яичников / эндометрия в анамнезе (гормонозависимые)',
          'Неконтролируемая артериальная гипертензия',
        ]} />

        <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
          {[
            { id:'virilization', label:'⚠️ Вирилизация' },
            { id:'hormones', label:'🔬 Пороги гормонов' },
            { id:'doses', label:'⚖️ Дозы веществ' },
            { id:'support', label:'🧪 Поддержка' },
            { id:'labs', label:'🧬 Лабы и СТОП' },
            { id:'iron', label:'🩸 Железо и ферритин' },
            { id:'cycle', label:'🦴 Цикл, кости, RED-S' },
            { id:'libido', label:'❤️ Либидо' },
            { id:'timeline', label:'🗓 Таймлайн цикла' },
            { id:'goals', label:'🏆 Цели и возраст' },
            { id:'interactions', label:'⚡ Взаимодействия' },
            { id:'emergency', label:'🚑 Экстренно' },
            { id:'contraception', label:'💊 Контрацепция' },
            { id:'pregnancy', label:'🤰 Беременность' },
            { id:'drugs', label:'💊 Препараты' },
          ].map((t: any) => (
            <button key={t.id} onClick={() => setWomenTab(t.id)}
              style={womenTab === t.id ? pillActive('#f472b6') : pillInactive()}>{t.label}</button>
          ))}
        </div>

        {/* Вирилизация */}
        {womenTab === 'virilization' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>⚠️ Вирилизация — НЕОБРАТИМЫЕ изменения</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Андрогены у женщин вызывают маскулинизацию. Некоторые изменения необратимы даже после отмены ААС. Порог зависит от дозы и длительности приёма. Ведите virilism-дневник (голос/волосы/цикл/кожа/либидо) + запись голоса до старта и еженедельно: первая хрипота = немедленная отмена.</p>
              {[
                { symptom:'Огрубение голоса (необратимо!)', timeframe:'4-12 нед', mechanism:'Утолщение голосовых связок (андроген-индуцированная гипертрофия). Необратимо после 6-8 нед. Первый признак — ломка голоса → немедленная отмена.', action:'При появлении — немедленная отмена всех андрогенов. Фониатр. Хирургическая коррекция связок малоэффективна.' },
                { symptom:'Гипертрофия клитора (клиторомегалия, необратимо)', timeframe:'4-12 нед', mechanism:'AR-опосредованный рост. >2 см — клиторомегалия. Необратимо.', action:'Немедленная отмена. Хирургическая редукция — при выраженном дискомфорте (редко).' },
                { symptom:'Андрогенетическая алопеция (частично обратима)', timeframe:'8-16 нед', mechanism:'DHT-опосредованная миниатюризация фолликулов. По мужскому типу (виски, темя).', action:'Финастерид/дутастерид (НЕ для женщин репродуктивного возраста!). Миноксидил 2% топически. Спиронолактон 50-100 мг.' },
                { symptom:'Гирсутизм (рост волос по мужскому типу)', timeframe:'6-12 нед', mechanism:'Андроген-стимуляция волосяных фолликулов на лице, груди, спине. Частично обратим.', action:'Лазерная эпиляция (после нормализации гормонов). Эфлорнитин крем. Спиронолактон.' },
                { symptom:'Акне (AAS-индуцированное, тяжелее чем у мужчин)', timeframe:'4-8 нед', mechanism:'↑ себума через AR сальных желёз. У женщин кожа чувствительнее к андрогенам.', action:'См. протокол Акне. Изотретиноин — категория X при беременности! Двойная контрацепция.' },
                { symptom:'Нарушение менструального цикла / аменорея', timeframe:'4-8 нед', mechanism:'Подавление ГнРГ → ↓ ЛГ/ФСГ → ановуляция. Обратимо через 2-6 мес после отмены.', action:'Отмена ААС. При отсутствии цикла >6 мес после отмены — гинеколог-эндокринолог. Исключить СПКЯ.' },
                { symptom:'Увеличение мышечной массы / изменение фигуры', timeframe:'8-16 нед', mechanism:'Анаболический эффект. Перераспределение жира по мужскому типу (↓ бёдер, ↑ талии). Частично обратимо.', action:'Необратимо при длине курса >6 мес. Женщинам с эстетическими целями — НЕ рекомендованы ААС.' },
              ].map((x: any, i: any) => (
                <div key={i} style={{ padding:'10px 12px', borderRadius:10, marginBottom:6, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ fontSize:9, fontWeight:800, color:'#ef4444', marginBottom:2 }}>{x.symptom} — {x.timeframe}</div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:3, lineHeight:1.3 }}>Механизм: {x.mechanism}</div>
                  <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.3, padding:'5px 8px', borderRadius:5, background:'rgba(239,68,68,0.08)' }}>💡 Тактика: {x.action}</div>
                </div>
              ))}
            </div>
            <HirsutismScale />
          </div>
        )}

        {/* Пороги гормонов */}
        {womenTab === 'hormones' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>🔬 Пороги андрогенов для женщин</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Женские референсы значительно ниже мужских. Даже верхняя граница нормы — уже риск вирилизации.</p>
              {[
                { marker:'Тестостерон общий', femaleRange:'0.5-2.5 нмоль/л (15-70 нг/дл)', dangerThreshold:'>2.5 нмоль/л — stop AAS', note:'Мужской диапазон 10-35 нмоль/л. Для женщин верхняя граница в 10× ниже. >5 нмоль/л — вирилизация в течение 4-8 нед.' },
                { marker:'Тестостерон свободный', femaleRange:'0.5-5 пг/мл', dangerThreshold:'>5 пг/мл', note:'Более чувствительный маркер, чем общий T. Повышение — первый признак андрогенизации.' },
                { marker:'DHT (дигидротестостерон)', femaleRange:'25-250 пг/мл', dangerThreshold:'>250 пг/мл', note:'Основной медиатор алопеции и акне. Контроль при приёме DHT-производных (станозолол, оксандролон).' },
                { marker:'DHEA-S', femaleRange:'50-400 мкг/дл', dangerThreshold:'>400 мкг/дл', note:'Надпочечниковый андроген. Повышается при приёме DHEA-добавок. Контроль при ГЗТ.' },
                { marker:'Эстрадиол (E2)', femaleRange:'30-400 пг/мл (фаза-зависимо)', dangerThreshold:'{'<'}30 пг/мл — дефицит (аменорея)', note:'ААС подавляют яичниковую продукцию E2 через ↓ ГнРГ. Дефицит E2 → остеопороз, сухость, диспареуния.' },
                { marker:'ЛГ/ФСГ', femaleRange:'ЛГ 2-10, ФСГ 3-12 МЕ/л', dangerThreshold:'ЛГ/ФСГ {'<'}1 — подавление оси', note:'Подавление гонадотропинов — основной механизм аменореи. Восстановление 2-6 мес после отмены.' },
                { marker:'SHBG (глобулин связывающий половые гормоны)', femaleRange:'40-120 нмоль/л', dangerThreshold:'{'<'}40 — избыток свободных андрогенов', note:'ААС ↓ SHBG → ↑ свободного T. Низкий SHBG = высокий риск вирилизации даже при «нормальном» общем T.' },
              ].map((x: any, i: any) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#f9a8d4', marginBottom:2 }}>{x.marker}</div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:2 }}>♀ Норма: <b style={{color:'#f9a8d4'}}>{x.femaleRange}</b></div>
                  <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(239,68,68,0.06)' }}>🛑 {x.dangerThreshold}</div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2 }}>💡 {x.note}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Дозы веществ */}
        {womenTab === 'doses' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>⚖️ Дозы веществ: женские пороги</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Справочные ориентиры для обсуждения с врачом. Женские пороги в 4–10 раз ниже мужских. Это НЕ назначение — официальные рекомендации «что можно / что нельзя» в табе «Препараты».</p>
              <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.4, padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>🛑 {DECA_125_NOTE}</div>
            </div>
            <VirilizationScoreCalculator />
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>🔬 Андрогенные индексы (используются калькулятором)</div>
              {FEMALE_VIRILIZATION_CALC.map((x: any) => (
                <div key={x.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize:9, color:'#fff' }}>{x.name}</span>
                  <span style={{ fontSize:8, color:'var(--text-dim)' }}>{x.unit}</span>
                  <span style={{ fontSize:9, fontWeight:800, color:'#f9a8d4', minWidth:30, textAlign:'right' }}>{x.androgenIndex}</span>
                </div>
              ))}
              <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:6, lineHeight:1.35 }}>Шкала: тестостерон = 1.0 (эталон) · тренболон 1.5 · нор-группа (нандролон) 0.35 · примоболан 0.2. Чем выше индекс — тем сильнее андрогенный сигнал на той же дозе.</div>
            </div>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>📐 Примеры расчёта (формула с ×10)</div>
              {[
                'Дека 50 мг/нед, 8 нед → 14/100 🟢 безопасно',
                'Оксандролон 15 мг/день, 6 нед → 8/100 🟢 безопасно',
                'Дека 100 мг/нед + оксандролон 20 мг/день, 12 нед → 64/100 🟠 риск',
                'Тестостерон 25 мг/нед, 8 нед → 75/100 🔴 высокий риск',
                'Тренболон — любая доза → 100/100 🔴 критично (абсолютное противопоказание)',
              ].map((t: string, i: number) => (
                <div key={i} style={{ fontSize:8, color:'#fff', lineHeight:1.45, marginBottom:3 }}>• {t}</div>
              ))}
              <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:4, lineHeight:1.35 }}>Оценка справочная: решение по схеме принимает врач; калькулятор учитывает возраст и чувствительность, но не заменяет осмотр.</div>
            </div>
            {[
              { title:'💉 Инъекционные ААС', rows:FEMALE_INJECT_DOSES },
              { title:'💊 Пероральные ААС (17α-алкилы)', rows:FEMALE_ORAL_DOSES },
              { title:'🧬 Пептиды и гормоны (GH/IGF-1/MGF/инсулин)', rows:FEMALE_PEPTIDE_DOSES },
              { title:'⚗️ SARMs', rows:FEMALE_SARM_DOSES },
            ].map((g: any) => (
              <div key={g.title} style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>{g.title}</div>
                {g.rows.map((x: any, i: number) => (
                  <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:9, fontWeight:700, color:'#f9a8d4' }}>{x.name}</span>
                      <span style={{ fontSize:9, fontWeight:800 }}>{x.overall}</span>
                    </div>
                    <div style={{ fontSize:8, color:'#fff', marginTop:2 }}>🟢 {x.green} · 🟡 {x.yellow} · 🔴 {x.red}</div>
                    <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>Вирилизация: {x.vir} · Либидо: {x.libido}</div>
                    <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3 }}>{x.risks}</div>
                    {x.note ? <div style={{ fontSize:7, color:'#fca5a5', marginTop:2, lineHeight:1.3 }}>💡 {x.note}</div> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Примерные протоколы поддержки */}
        {womenTab === 'support' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:4 }}>🧪 Примерные протоколы поддержки (женщины на ААС)</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.35 }}>Ориентиры доз для обсуждения с врачом. Рецептурные позиции (каберголин, спиронолактон, метформин) — только врач. Кросс-капы NAC/Mg/Zn/D3 суммируйте калькулятором в меню протоколов.</p>
            </div>
            {FEMALE_SUPPORT_PROTOCOLS.map((p: any) => (
              <div key={p.id} style={cardBg}>
                <div style={{ fontSize:11, fontWeight:800, color:'#f9a8d4', marginBottom:2 }}>{p.icon} {p.title}</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, lineHeight:1.3 }}>Показания: {p.indication}</div>
                {p.rows.map((r: any, i: number) => (
                  <ItemRow key={i} name={r.name} dose={r.dose} timing={r.timing} note={r.note} color="#f472b6" />
                ))}
                {p.footer ? (
                  <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.35, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>⚠ {p.footer}</div>
                ) : null}
              </div>
            ))}
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>🧠 Психические эффекты — диагностика и тактика</div>
              {FEMALE_PSYCHE_EFFECTS.map((x: any, i: number) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#f9a8d4' }}>{x.problem}</div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2 }}>Триггеры: {x.trigger}</div>
                  <div style={{ fontSize:8, color:'#fca5a5', marginTop:2, lineHeight:1.35 }}>→ {x.action}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Лабы и СТОП */}
        {womenTab === 'labs' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>🧬 Женские лабораторные референсы</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.35 }}>Референсы отличаются от мужских (Hct, липиды, половые гормоны). Забор гормонов — 3–5 день цикла (фолликулярная фаза), пролактин — утро/покой 30 мин.</p>
            </div>
            {FEMALE_LAB_GROUPS.map((grp: any) => (
              <div key={grp.id} style={cardBg}>
                <div style={{ fontSize:11, fontWeight:800, color:'#60a5fa', marginBottom:6 }}>{grp.icon} {grp.title}</div>
                {grp.rows.map((x: any, i: number) => (
                  <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(59,130,246,0.05)', border:'1px solid rgba(59,130,246,0.10)' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#93c5fd' }}>{x.marker}</div>
                    <div style={{ fontSize:7, color:'var(--text-dim)' }}>Норма: {x.normal}</div>
                    <div style={{ fontSize:8, color:'#fff', marginTop:2 }}>🟢 {x.green} · 🟡 {x.yellow} · 🔴 {x.red}</div>
                    {x.symptom ? <div style={{ fontSize:7, color:'#fca5a5', marginTop:2 }}>🛑 {x.symptom}</div> : null}
                  </div>
                ))}
              </div>
            ))}
            <StopBanner title="КРИТИЧЕСКИЕ ПОРОГИ — СТОП ДЛЯ ЖЕНЩИН" thresholds={FEMALE_STOP_THRESHOLDS.map((x: any) => `${x.marker} ${x.threshold} — ${x.action}`)} />
          </div>
        )}

        {/* Железо и ферритин */}
        {womenTab === 'iron' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:4 }}>🩸 Железо и ферритин — атлетические пороги</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.35 }}>Женщины-атлетки теряют железо с менструацией + гемолизом нагрузки; на курсе ААС стимулируют эритропоэз — железо можно грузить <b style={{ color:'#fca5a5' }}>только при подтверждённом дефиците и HCT &lt;48%</b>. Ориентиры: AAFP 2025, Stoffel/Moretti (Blood 2015/AJCN 2017), BJSM 2025.</p>
              <div style={{ fontSize:8, color:'#fca5a5', marginTop:6, lineHeight:1.4, padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>⛔ Железо — не «витамин на всякий случай»: при ферритине &gt;100 нг/мл добавление на курсе повышает вязкость крови и окислительный стресс.</div>
            </div>
            <StopBanner title="ГЕЙТЫ ЖЕЛЕЗА НА КУРСЕ" thresholds={FEMALE_IRON_GATES.filter((g: any) => g.level === 'stop').map((g: any) => g.text)} />
            {FEMALE_IRON_GATES.filter((g: any) => g.level === 'doctor').map((g: any, i: number) => (
              <div key={i} style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.18)' }}>
                <div style={{ fontSize:8, color:'#fcd34d', lineHeight:1.4 }}>🩺 {g.text}</div>
              </div>
            ))}
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>📊 Пороги и трактовка</div>
              {FEMALE_IRON_THRESHOLDS.map((x: any, i: number) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:9, fontWeight:700, color:'#f9a8d4' }}>{x.band}</span>
                    <span style={{ fontSize:9, fontWeight:800, color:'#fff' }}>{x.value}</span>
                  </div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{x.meaning}</div>
                  <div style={{ fontSize:8, color:'#fca5a5', marginTop:2, lineHeight:1.35 }}>→ {x.action}</div>
                </div>
              ))}
            </div>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>💊 Схема (при подтверждённом дефиците)</div>
              {FEMALE_IRON_SCHEME.map((r: any, i: number) => (
                <ItemRow key={i} name={r.name} dose={r.dose} timing={r.timing} note={r.note} color="#f472b6" />
              ))}
            </div>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>🧪 Диагностика и контроль</div>
              {FEMALE_IRON_DIAGNOSTICS.map((d: any, i: number) => (
                <div key={i} style={{ padding:'7px 9px', borderRadius:8, marginBottom:4, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#fff' }}>{d.what}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2, lineHeight:1.35 }}>{d.action}</div>
                </div>
              ))}
              <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:4, lineHeight:1.35 }}>Смежные протоколы: «Гематокрит / кровь» (при HCT↑ железо исключить) · «Печёночная защита» · «Женское восстановление». Авто-слой поддержки добавляет железо только по анализам (ферритин &lt;30 и HCT &lt;48).</div>
            </div>
          </div>
        )}

        {/* Цикл, кости, RED-S */}
        {womenTab === 'cycle' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:4 }}>🦴 Цикл, кости, RED-S</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.35 }}>Дефицит E2 (ААС-супрессия + энергодефицит) бьёт по костям и циклу. Аменорея — не «побочка», а алгоритм: беременности-тест → панель → врач; при длительной — DXA по z-score. Источники: Triad-2025 update (Sports Med 2026), IOC REDs 2023, AFP 2026, ACOG.</p>
            </div>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>🩺 Аменорея — алгоритм (не одна строка)</div>
              {FEMALE_AMENORRHEA_ALGO.map((x: any, i: number) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                  <div style={{ fontSize:9, fontWeight:800, color:'#f9a8d4' }}>{x.step}</div>
                  <div style={{ fontSize:8, color:'#fff', marginTop:2, lineHeight:1.35 }}>{x.action}</div>
                </div>
              ))}
            </div>
            <RedsTrafficLight />
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>🦴 Костная защита (профилактика)</div>
              {FEMALE_BONE_HONESTY.map((t: string, i: number) => (
                <div key={i} style={{ fontSize:8, color:'#fca5a5', lineHeight:1.4, marginBottom:3 }}>⚠ {t}</div>
              ))}
              <div style={{ marginTop:6 }}>
                {(FEMALE_SUPPORT_PROTOCOLS.find((p: any) => p.id === 'bones')?.rows || []).map((r: any, i: number) => (
                  <ItemRow key={`b${i}`} name={r.name} dose={r.dose} timing={r.timing} note={r.note} color="#f472b6" />
                ))}
              </div>
              <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:4, lineHeight:1.35 }}>Полный протокол — таб «🧪 Поддержка» → «Кости (Ca/D3/K2/Mg)».</div>
            </div>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>🚺 Урогенитальное на низком E2</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 6px', lineHeight:1.35 }}>Сухость/диспареуния и рецидивирующие ИМП — типичны при подавлении E2. Рецептурные позиции (локальный эстроген) — только гинеколог.</p>
              {FEMALE_UROGENITAL_SUPPORT.map((r: any, i: number) => (
                <ItemRow key={`u${i}`} name={r.name} dose={r.dose} timing={r.timing} note={r.note} color="#f472b6" />
              ))}
            </div>
          </div>
        )}

        {/* Либидо */}
        {womenTab === 'libido' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:4 }}>❤️ Либидо на ААС — критический фактор</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.35 }}>У женщин либидо зависит от обоих драйверов: андрогенов и эстрадиола. Станозолол/тренболон/AI часто дают «нулевое» либидо; тестостерон/мастерон — иногда чрезмерное. Не обнулять E2 ингибиторами ароматазы.</p>
            </div>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>⚖️ Эффекты веществ</div>
              {FEMALE_LIBIDO_EFFECTS.map((x: any, i: number) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:9, fontWeight:700, color:'#f9a8d4' }}>{x.substance}</span>
                    <span style={{ fontSize:8, fontWeight:800, color:'#fff' }}>{x.effect}</span>
                  </div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{x.mechanism}</div>
                </div>
              ))}
            </div>
            {FEMALE_SUPPORT_PROTOCOLS.filter((p: any) => p.id === 'libidoLow' || p.id === 'libidoHigh').map((p: any) => (
              <div key={p.id} style={cardBg}>
                <div style={{ fontSize:11, fontWeight:800, color:'#f9a8d4', marginBottom:2 }}>{p.icon} {p.title}</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, lineHeight:1.3 }}>Показания: {p.indication}</div>
                {p.rows.map((r: any, i: number) => (
                  <ItemRow key={i} name={r.name} dose={r.dose} timing={r.timing} note={r.note} color="#f472b6" />
                ))}
                {p.footer ? (
                  <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.35, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>⚠ {p.footer}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Таймлайн цикла */}
        {womenTab === 'timeline' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:4 }}>🗓 Таймлайн женского цикла ААС</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.35 }}>Женский протокол строже мужского: чаще лабы, обязательная запись голоса, обязательная контрацепция. Короче цикл — меньше необратимого.</p>
            </div>
            {FEMALE_TIMELINE.map((ph: any) => (
              <div key={ph.id} style={{ borderRadius:14, background:'rgba(244,114,182,0.05)', border:'1px solid rgba(244,114,182,0.14)', padding:12 }}>
                <div style={{ fontSize:11, fontWeight:850, color:'#f9a8d4' }}>{ph.icon} {ph.title}</div>
                <div style={{ fontSize:8, fontWeight:700, color:'#f472b6', marginBottom:6 }}>{ph.when}</div>
                {ph.rows.map((r: any, i: number) => (
                  <div key={i} style={{ padding:'7px 9px', borderRadius:8, marginBottom:4, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#fff' }}>{r.what}</div>
                    <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2, lineHeight:1.35 }}>{r.action}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Цели и возраст */}
        {womenTab === 'goals' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:4 }}>🏆 Специфика по цели/спорту</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.35 }}>Практика по категориям: от «мягких» составов до отказа от ААС вовсе (бег/циклические). Все схемы — справочные, с контролем вирилизации.</p>
            </div>
            {FEMALE_GOALS.map((g: any, i: number) => (
              <div key={i} style={cardBg}>
                <div style={{ fontSize:10, fontWeight:800, color:'#f9a8d4', marginBottom:4 }}>{g.icon} {g.title}</div>
                <div style={{ fontSize:8, color:'#fff', lineHeight:1.4 }}>Схема: {g.scheme}</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2 }}>Длительность: {g.weeks} · Support: {g.support}</div>
                <div style={{ fontSize:7, color:'#fca5a5', marginTop:3, lineHeight:1.3 }}>💡 {g.note}</div>
              </div>
            ))}
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>👤 Возрастная специфика</div>
              {FEMALE_AGE_GROUPS.map((a: any, i: number) => (
                <div key={i} style={{ padding:'9px 10px', borderRadius:8, marginBottom:5, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:'#f9a8d4', marginBottom:3 }}>{a.age} лет</div>
                  {a.rows.map((row: any, ri: number) => (
                    <div key={ri} style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
                      <b style={{ color:'#fff' }}>{row[0]}:</b> {row[1]}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Взаимодействия */}
        {womenTab === 'interactions' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>✅ Практичные сочетания (с мониторингом)</div>
              {FEMALE_SAFE_COMBOS.map((x: any, i: number) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(34,197,94,0.05)', border:'1px solid rgba(34,197,94,0.12)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:9, fontWeight:700, color:'#fff' }}>{x.combo}</span>
                    <span style={{ fontSize:9 }}>{x.level}</span>
                  </div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{x.note}</div>
                </div>
              ))}
            </div>
            <ContraBanner items={FEMALE_DANGER_COMBOS.map((x: any) => `${x.combo} — ${x.why}`)} />
            <StopBanner title="ЗАПРЕЩЁННЫЕ КОМБИНАЦИИ (женщина + препарат)" thresholds={FEMALE_FORBIDDEN_COMBOS.map((x: any) => `${x.combo} → ${x.action}`)} />
          </div>
        )}

        {/* Экстренно */}
        {womenTab === 'emergency' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <StopBanner title="КРИТИЧНО — НЕМЕДЛЕННАЯ ОТМЕНА" thresholds={FEMALE_EMERGENCY_CRITICAL.map((x: any) => `${x.situation} → ${x.action}`)} />
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>⚡ Срочно (24–48 ч)</div>
              {FEMALE_EMERGENCY_URGENT.map((x: any, i: number) => (
                <div key={i} style={{ fontSize:9, color:'#fcd34d', lineHeight:1.45, marginBottom:3, paddingLeft:8, borderLeft:'2px solid rgba(245,158,11,0.25)' }}>
                  • <b>{x.situation}</b> → {x.action}
                </div>
              ))}
            </div>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🚨 Критические симптомы — немедленная отмена</div>
              {FEMALE_STOP_SYMPTOMS.map((x: any, i: number) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#fca5a5' }}>{x.symptom}</div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2 }}>Причина: {x.cause}</div>
                  <div style={{ fontSize:8, color:'#fca5a5', marginTop:2, lineHeight:1.35 }}>→ {x.action}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Контрацепция */}
        {womenTab === 'contraception' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>💊 Контрацепция на ААС — КРИТИЧНО</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>ААС НЕ являются контрацептивами, но подавляют овуляцию непредсказуемо. Возможна овуляция на фоне аменореи → незапланированная беременность на тератогенных препаратах.</p>
              {[
                { method:'ВМС (внутриматочная спираль) — медь или левоноргестрел', safety:'✅ Безопасно', note:'Предпочтительный метод. Нет системного гормонального влияния. Медь-ВМС не влияет на коагуляцию (важно при Hct >50%). Левоноргестрел-ВМС — локальный прогестин, минимальный системный эффект.' },
                { method:'Барьерные методы (презерватив)', safety:'✅ Безопасно', note:'Обязательно дополнительно к любому методу. Снижение риска ИППП. Единственный метод, защищающий от инфекций.' },
                { method:'КОК (комбинированные оральные контрацептивы)', safety:'⚠️ Осторожно', note:'Этинилэстрадиол + ААС → риск тромбоза ↑ в 3-5×. При Hct >50% — абсолютное противопоказание. При мигрени с аурой — противопоказание (инсульт). Без Hct-проблем — допустимо под контролем коагулограммы каждые 3 мес.' },
                { method:'Гестагенные контрацептивы (мини-пили, имплант)', safety:'✅ Условно безопасно', note:'Нет эстрогенного компонента → меньше тромбо-риск. Имплант (этоногестрел) — 3 года. Депо-провера — не рекомендован (↓ плотности костной ткани, уже сниженной при дефиците E2).' },
                { method:'Экстренная контрацепция', safety:'✅ Допустимо', note:'Левоноргестрел 1.5 мг или улипристал ацетат 30 мг. Однократно. Не влияет на ААС-курс.' },
              ].map((x: any, i: any) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:9, fontWeight:700, color:'#f9a8d4' }}>{x.method}</span>
                    <span style={{ fontSize:8, fontWeight:600, color:x.safety.includes('✅')?'#22c55e':'#f59e0b' }}>{x.safety}</span>
                  </div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{x.note}</div>
                </div>
              ))}
            </div>

            <ContraBanner items={[
              'КОК (эстроген-содержащие) + Hct >50% = риск ТГВ/ТЭЛА ↑ в 5×',
              'Изотретиноин (акне) + беременность = тяжёлые пороки развития плода → двойная контрацепция обязательна',
              'Финастерид/дутастерид + беременность = феминизация плода мужского пола → женщинам репродуктивного возраста НЕ назначать',
            ]} />

            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>👶 Фертильность: планирование</div>
              {FEMALE_FERTILITY_PLAN.map((x: any, i: number) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#f9a8d4' }}>{x.when}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2, lineHeight:1.35 }}>{x.action}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Беременность */}
        {womenTab === 'pregnancy' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🤰 Беременность и ААС — абсолютное противопоказание</div>
              {[
                { risk:'Тератогенность (категория X)', detail:'Все ААС — категория X FDA. Вирилизация плода женского пола (сращение половых губ, гипертрофия клитора). Пороки развития мочеполовой системы. Аномалии ЦНС.' },
                { risk:'Спонтанный аборт', detail:'ААС нарушают эндометриальную поддержку лютеиновой фазы. Риск выкидыша в 1 триместре ↑ на 40-60%.' },
                { risk:'Задержка внутриутробного развития', detail:'Андрогены нарушают плацентарный кровоток. Низкий вес при рождении.' },
                { risk:'Маскулинизация матери (обратимо частично)', detail:'Акне, гирсутизм, алопеция, огрубение голоса. При длине курса >4 нед — риск необратимых изменений.' },
              ].map((x: any, i: any) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#fca5a5', marginBottom:2 }}>{x.risk}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.3 }}>{x.detail}</div>
                </div>
              ))}
            </div>

            <StopBanner title="ЕСЛИ БЕРЕМЕННОСТЬ НАСТУПИЛА НА КУРСЕ" thresholds={[
              'Немедленная отмена ВСЕХ ААС и гормональных препаратов',
              'Явка к акушеру-гинекологу в течение 24-48 часов',
              'УЗИ плода для оценки анатомии (особенно урогенитальной)',
              'Консультация генетика при сроке >6 нед',
              'НЕ пытаться сохранить беременность любой ценой — риск необратимых пороков плода',
            ]} />

            <ContraBanner items={[
              'Статины — категория X при беременности (нарушение синтеза холестерина плода)',
              'Изотретиноин — категория X (тяжёлые пороки ЦНС и ССС плода). Отмена за 1 мес до зачатия',
              'Финастерид/дутастерид — категория X (феминизация плода мужского пола). Отмена за 3 мес до зачатия (T½ дутастерида — 5 нед)',
              'Ингибиторы АПФ/сартаны (телмисартан) — категория D во 2-3 триместре (олигогидрамнион, почечная недостаточность плода)',
            ]} />
          </div>
        )}

        {/* Препараты */}
        {womenTab === 'drugs' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:6 }}>💊 Препараты: что можно и что нельзя женщинам</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Официальные позиции безопасности; ниже — согласование с движком женского слоя (пороги/флаги). Дозовые таблицы (41 вещество), андрогенные индексы, примеры и калькулятор Virilization Score — в табе «⚖️ Дозы веществ»; эффекты на либидо — в табе «❤️ Либидо»; протоколы усиления — в табе «🧪 Поддержка». В калькуляторе поддержки женский профиль автоматически: пороги HCT/АЛТ/TT, флаги вирилизации и добавление витекс/инозитол поверх мужского набора.</p>
              {[
                { drug:'Оксандролон (Anavar) 5-10 мг/день', safety:'🟡 Только под гинекологом-эндокринологом', note:'Наименее андрогенный ААС (клиника: ожоги/ВИЧ-кахексия у женщин), но вирилизация уже на 10 мг/8 нед — «условно» не значит «безопасно» [A — вирилизация по лейблу; точные % — только наблюдения, РКИ нет]. База: запись голоса до старта + еженедельно; при первой хрипоте — отмена. Менструальный дневник + общ.T/св.T/SHBG каждые 4 нед. ♀ Порог движка: до 10 мг/день — жёлтый, >20 — красный; либидо ⬆ мягко.' },
                { drug:'Тестостерон (любая форма)', safety:'🔴 Опасно', note:'Даже 10 мг/нед (TRT-доза для женщин) → риск вирилизации при длине >3 мес. Только под контролем гинеколога-эндокринолога при подтверждённом гипогонадизме. ♀ Пороги движка: 10–20 мг/нед жёлтый, >20 — красный; репро-риск эскалируется при общем T >6 нмоль/л; либидо ⬆⬆.' },
                { drug:'Нандролон (деканоат) 25-50 мг/нед', safety:'🔴 Опасно', note:'Выраженный вирилизующий эффект. Огрубение голоса в 80% случаев при длине курса >6 нед. НЕ рекомендован женщинам. ♀ Если применяется — пороги движка: 50–75 мг/нед жёлтый, >75 — красный (125 мг/нед — верхняя красная граница); контроль пролактина (каберголин только по анализам); либидо ⬆ умеренно.' },
                { drug:'Станозолол (Винстрол)', safety:'🛑 Запрещено', note:'DHT-производное. Максимальная вирилизация. Необратимое огрубение голоса за 2-3 нед. Категорически не рекомендован. ♀ Либидо ⬇ (частые жалобы на «нулевое»); оральный — АЛТ/АСТ каждые 2 нед.' },
                { drug:'Оксиметолон (Анадрол)', safety:'🛑 Запрещено', note:'Мощный андроген + гепатотоксичность. Вирилизация + риск аденом печени. ♀ Движок: абсолютное противопоказание.' },
                { drug:'Метенолон (Примоболан)', safety:'🔴 Опасно', note:'«Мягкий» — миф для женщин: вирилизация дозо- и стажезависима, часть необратима. Самый подделываемый препарат (во флаконе часто мастерон/болденон с другим профилем риска). ♀ Пороги движка: 50–75 мг/нед жёлтый; либидо ⬆ умеренно.' },
                { drug:'Метандростенолон (Дианабол)', safety:'🛑 Запрещено', note:'17α-алкил + сильная ароматизация: вирилизм + задержка воды + печень + АГ/психика. «Женским» не бывает. ♀ Порог движка: 5–10 мг/день жёлтый, >10 — красный.' },
                { drug:'Болденон', safety:'🛑 Запрещено', note:'Ветеринарный препарат. Вирилизация + эритроцитоз/Hct-риск + долгая детекция. «Мягкий» — миф. ♀ Движок: гемато-риск (женский HCT 48/52); либидо → нейтрально.' },
                { drug:'Дростанолон (Мастерон)', safety:'🛑 Запрещено', note:'Исторически — рак молочной железы, сейчас снят везде. «Сушка/сухость» без РКИ. Вирилизм высокий, необратимый. ♀ Если применяется — harm-reduction пороги 75–100 мг/нед (>100 красный); либидо ⬆⬆ (риск гиперсексуальности); финастерид не снижает эффект (уже 5α-восстановлен).' },
                { drug:'Дигидроболденон (DHB, 1-тестостерон)', safety:'🟡 Только врач', note:'5α-восстановленный болденон: не ароматизируется, вирилизация ниже тестостерона, но реальная. Редкий на рынке, частые подделки. ♀ Пороги движка: 50–75 мг/нед жёлтый, >75 — красный; либидо ⬆ умеренно; липиды + HCT; оральная форма — 17α (АЛТ/АСТ).' },
                { drug:'Тренболон', safety:'🛑 Запрещено', note:'Ветеринария, прогестаген. Женщинам по сути противопоказан: стремительная вирилизация, психика, Hct/АД/липиды/почки. Финастерид не работает (не субстрат 5α-редуктазы). ♀ Движок: абсолютное противопоказание (любая доза); либидо ⬇⬇ (прогестагенный + тревожность).' },
                { drug:'SARMs: S23 / YK-11', safety:'🛑 Запрещено', note:'Движок: абсолютные противопоказания женщинам (любая доза) — вирилизация + крайняя супрессия оси. RAD-140/лигандрол/остарин — harm-reduction пороги в табе «Дозы», но РКИ у женщин нет.' },
                { drug:'Флуоксиместерон (Галотестин)', safety:'🛑 Запрещено', note:'Самый андрогенный «силовой» + отёки (Na/вода) + печень. Женщинам — категорически нет. ♀ Движок: абсолютное противопоказание.' },
                { drug:'Гестринон-имплант («чип красоты») ', safety:'🛑 Запрещено', note:'SBEM/Febrasgo/ANVISA RDC 4353/2024 — запрет для эстетики/спорта: нет РКИ/регистрации/доз, вариабельность pellets. Вес растёт у ~40% (0.9–8 кг) — «для похудения» ложь. WADA-список.' },
                { drug:'GH / IGF-1 / инсулин / T3-T4', safety:'🔴 Только врач', note:'GH: отёки/туннель/ИР — IGF-1 «выше = лучше» запретить. Инсулин вне СД — смертельная гипогликемия (только стационар/врач). T3 при норме ТТГ — тиреотоксикоз (ФП/кость). hCG у женщин тестостерон консистентно не растит — «ПКТ по-мужски» неприменима; AI/SERM женщинам — только врач (кость/липиды/цикл/ВТЭО).' },
                { drug:'GH 0.5-1 МЕ/день', safety:'🟡 Условно безопасно', note:'GH не является андрогеном. Используется в anti-age медицине у женщин. Контроль IGF-1, глюкозы. НЕ комбинировать с ААС.' },
                 { drug:'Кленбутерол 20-40 мкг/день', safety:'🔴 Опасно', note:'β2-агонист. Не андроген (голос/клитор не трогает — этим и маскируется). 🔴 Опасно — не одобрен FDA/EMA для человека. Женский QT-риск ×2 (~2/3 torsades — женщины): клен + гипокалиемия (K+ в клетки) + диета/рвота/диуретики = аритмия; уменьшение дозы по массе риск не снимает. Кардиотоксичность (тахикардия, миокардит), тремор. Не рекомендуется.' },
                 { drug:'Анастрозол 0.25 мг 2×/нед', safety:'🟡 Только врач', note:'Ингибитор ароматазы. При ААС-индуцированной гиперэстрогении — только врач: ↓ E2 → остеопороз, сухость, крах липидов. Без врача не применять. Контроль E2 (цель 30-50 пг/мл). ♀ Либидо ⬇⬇⬇ при обнулении E2 — не обнулять (таб «Либидо»).' },
                  { drug:'Каберголин 0.125-0.25 мг 2×/нед', safety:'🟡 Только врач', note:'Дофаминовый агонист. При пролактине >25 — только врач: титрация под контроль ПРЛ (0.125-0.25 мг 1-2р/нед), ЭхоКГ при длительном приёме. ⚠ Риск дофаминовой дисрегуляции (импульсивные расстройства: азартные игры, гиперсексуальность). Без врача не применять.' },
                 { drug:'Финастерид / дутастерид', safety:'🛑 Женщинам запрещены', note:'Ингибиторы 5α-редуктазы: тератогенны (феминизация плода мужского пола) — женщинам репродуктивного возраста НЕ назначать, капсулы не делить при беременной партнёрше дома. На тренболоне/станозололе/болденоне не работают (не субстраты 5α-редуктазы) — для волос только топический миноксидил + врач.' },
              ].map((x: any, i: any) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:9, fontWeight:700, color:'#f9a8d4' }}>{x.drug}</span>
                    <span style={{ fontSize:8, fontWeight:600, color:x.safety.includes('🛑')?'#ef4444':x.safety.includes('🔴')?'#f97316':'#f59e0b' }}>{x.safety}</span>
                  </div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{x.note}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </InfoErrorBoundary>
  );
};
