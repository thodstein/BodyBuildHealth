// @ts-nocheck
import React, { useState } from 'react';
import { cardBg, pillActive, pillInactive, StopBanner } from './supportProtocolsShared';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportProtocolEmergency: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [emergencyTab, setEmergencyTab] = useState('chest');
  return (
    <InfoErrorBoundary label="Экстренные состояния">
      <div className="sup-proto-emergency" style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
        <div style={cardBg}>
          <div style={{ fontSize:13, fontWeight:800, color:'#ef4444', marginBottom:2 }}>🚑 Экстренные состояния на курсе ААС</div>
          <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Дифференциальная диагностика критических симптомов. Если сомневаетесь — вызывайте скорую. Ложный вызов лучше несвоевременной помощи.</p>
        </div>

        <StopBanner title="НЕМЕДЛЕННО ВЫЗВАТЬ СКОРУЮ (103/112)" thresholds={[
          'Потеря сознания / коллапс / остановка дыхания',
          'Сильная боль в груди с иррадиацией в руку/челюсть/спину (инфаркт миокарда)',
          'Внезапная сильная головная боль (геморрагический инсульт)',
          'Обильное кровотечение (ЖКТ: мелена, рвота кофейной гущей)',
          'Анафилактический шок: отёк Квинке, стридор, падение АД',
          'Судорожный приступ (особенно первый в жизни)',
        ]} />

        <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
          {[
            { id:'chest', label:'💔 Боль в груди' },
            { id:'breath', label:'🫁 Одышка' },
            { id:'head', label:'🧠 Головная боль' },
            { id:'leg', label:'🦵 Боль в ноге' },
            { id:'gi', label:'🫀 ЖКТ-кровотечение' },
            { id:'neuro', label:'🧠 Неврология' },
            { id:'allergy', label:'⚡ Анафилаксия' },
            { id:'surgery', label:'🏥 Операция' },
          ].map((t: any) => (
            <button key={t.id} onClick={() => setEmergencyTab(t.id)}
              style={emergencyTab === t.id ? pillActive('#ef4444') : pillInactive()}>{t.label}</button>
          ))}
        </div>

        {/* Боль в груди */}
        {emergencyTab === 'chest' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>💔 Боль в груди — дифференциальная диагностика</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>На курсе ААС боль в груди может быть инфарктом, ТЭЛА, расслоением аорты или ГЭРБ. Ошибка в диагностике — летальна.</p>
              {[
                {
                  label:'🛑 Инфаркт миокарда', color:'#ef4444',
                  symptoms:'Давящая/жгучая боль за грудиной >20 мин. Иррадиация в левую руку, челюсть, спину. Холодный пот, страх смерти, тошнота.',
                  riskFactors:'Hct >52%, АД >160/100, ЛПНП >160 мг/дл, курение, возраст >40, тромбоцитоз, семейный анамнез ИБС <55 лет.',
                  whatToDo:'🚑 Немедленно скорую. Аспирин 300 мг разжевать (если нет аллергии). Нитроглицерин под язык (если АД >100 сист.) — ЗАПРЕЩЁН при тадалафиле/силденафиле <48 ч (фатальная гипотония). ЭКГ в первые 10 мин. Тропонин I через 3-6 ч. Не ждать — каждая минута промедления = гибель миокарда.',
                },
                {
                  label:'🛑 ТЭЛА (тромбоэмболия лёгочной артерии)', color:'#ef4444',
                  symptoms:'Внезапная одышка + острая боль в груди (плевральная — усиливается на вдохе). Кровохарканье. Тахикардия, обморок. Фактор риска: Hct >54%, недавний перелёт, иммобилизация.',
                  riskFactors:'Hct >54%, тромбоцитоз, оральные контрацептивы (жен), недавняя операция, перелом, длительный перелёт, COVID-19 в анамнезе.',
                  whatToDo:'🚑 Скорую. D-димер (при низкой вероятности по Wells). КТ-ангиография лёгких (золотой стандарт). НМГ (эноксапарин 1 мг/кг 2×/день п/к) при подтверждении. Тромболизис при массивной ТЭЛА с шоком.',
                },
                {
                  label:'🛑 Расслоение аорты', color:'#ef4444',
                  symptoms:'Внезапная раздирающая боль в груди/спине (мигрирующая). Разница АД на руках >20 мм рт.ст. Асимметрия пульса. Часто у высоких мужчин с синдромом Марфана.',
                  riskFactors:'АД >180/110, приём третиноина/изотретиноина, trauma, синдром Марфана, бикуспидальный аортальный клапан.',
                  whatToDo:'🚑 Скорую немедленно. Снизить АД (β-блокаторы в/в). КТ-аортография. Экстренная консультация кардиохирурга. Летальность 1-2% в час без лечения.',
                },
                {
                  label:'🟡 ГЭРБ / эзофагоспазм', color:'#f59e0b',
                  symptoms:'Жгучая боль за грудиной после еды/лёжа. Изжога, кислый привкус. Усиливается при наклоне. Проходит после антацидов/ИПП.',
                  riskFactors:'Оральные ААС (метандростенолон, оксиметолон), НПВС, кофеин, алкоголь, жирная еда.',
                  whatToDo:'Антацид (Маалокс 2 таб). При отсутствии эффекта за 15 мин — ИПП (омепразол 20 мг) + повторить ЭКГ (исключить инфаркт!). ⚠ ГЭРБ и инфаркт могут сосуществовать — при сомнении: скорая.',
                },
                {
                  label:'🟡 Костно-мышечная боль', color:'#f59e0b',
                  symptoms:'Локализованная боль в области грудины/рёбер. Усиливается при пальпации и движении. После тренировки груди.',
                  riskFactors:'Интенсивная тренировка грудных мышц, травма, костохондрит (синдром Титце).',
                  whatToDo:'НПВС (ибупрофен 400 мг) или парацетамол 1 г. Покой 2-3 дня. ⚠ Исключить инфаркт: при иррадиации в руку/челюсть — скорая независимо от связи с тренировкой.',
                },
              ].map((c: any, i: any) => (
                <div key={i} style={{ padding:'10px 12px', borderRadius:10, marginBottom:8, background:c.color+'08', border:'1px solid '+c.color+'33' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:c.color, marginBottom:6 }}>{c.label}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'var(--text-light)'}}>Симптомы:</b> {c.symptoms}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'#fca5a5'}}>Факторы риска:</b> {c.riskFactors}</div>
                  <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}><b>Что делать:</b> {c.whatToDo}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Одышка */}
        {emergencyTab === 'breath' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🫁 Одышка — дифференциальная диагностика</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Одышка на курсе ААС — не норма. Всегда исключать ТЭЛА и сердечную недостаточность.</p>
              {[
                {
                  label:'🛑 ТЭЛА (тромбоэмболия)', color:'#ef4444',
                  symptoms:'Внезапная одышка (секунды-минуты). Тахипноэ >20/мин. Тахикардия. Боль в груди (плевральная). Кровохарканье.',
                  keyTest:'D-димер (при низкой/средней вероятности по Wells). КТ-ангиография — золотой стандарт.',
                  whatToDo:'🚑 Скорая. Сатурация O₂. НМГ (эноксапарин) при подтверждении. Тромболизис при нестабильности.',
                },
                {
                  label:'🛑 Сердечная недостаточность (отёк лёгких)', color:'#ef4444',
                  symptoms:'Одышка в покое/лёжа (ортопноэ). Влажные хрипы в нижних отделах. Отёки ног. Розовая пенистая мокрота.',
                  keyTest:'NT-proBNP >125 пг/мл. ЭХО-КГ (ФВ <40%?). Рентген грудной клетки (отёк).',
                  whatToDo:'🚑 Скорая. Положение сидя. Фуросемид 40-80 мг в/в. Морфин (при отёке лёгких). Нитраты в/в (при АД >100).',
                },
                {
                  label:'🟡 Анемия', color:'#f59e0b',
                  symptoms:'Постепенная одышка при нагрузке. Бледность. Тахикардия. Слабость.',
                  keyTest:'Общий анализ крови: Hb <120 г/л (ж) / <130 г/л (м). Ферритин, B12, фолат.',
                  whatToDo:'Не экстренно (если Hb >70). Причина: ЖКТ-кровотечение (НПВС?), дефицит Fe/B12, гемолиз. Гематолог.',
                },
                {
                  label:'🟡 Апноэ сна', color:'#f59e0b',
                  symptoms:'Ночная одышка/пробуждения. Храп. Дневная сонливость. Утренняя головная боль.',
                  keyTest:'STOP-BANG ≥5 → полисомнография. ИАГ >15 → CPAP.',
                  whatToDo:'Консультация сомнолога. CPAP-терапия. Снижение веса. См. протокол «Сон».',
                },
              ].map((c: any, i: any) => (
                <div key={i} style={{ padding:'10px 12px', borderRadius:10, marginBottom:8, background:c.color+'08', border:'1px solid '+c.color+'33' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:c.color, marginBottom:6 }}>{c.label}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'var(--text-light)'}}>Симптомы:</b> {c.symptoms}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'#60a5fa'}}>Ключевой тест:</b> {c.keyTest}</div>
                  <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}><b>Тактика:</b> {c.whatToDo}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Головная боль */}
        {emergencyTab === 'head' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🧠 Сильная головная боль — дифференциальная диагностика</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Hct {'>'}54% + АД {'>'}180 → риск геморрагического инсульта. Головная боль на ААС — не списывать на «перетренировался».</p>
              {[
                {
                  label:'🛑 Геморрагический инсульт', color:'#ef4444',
                  symptoms:'Внезапная сильнейшая головная боль («никогда такой не было»). Тошнота/рвота. Ригидность затылочных мышц. Светобоязнь. Потеря сознания.',
                  riskFactors:'Hct >54%, АД >180/110, тромбоцитопения, приём антикоагулянтов (варфарин, ривароксабан), аневризма сосудов в анамнезе.',
                  whatToDo:'🚑 Скорая немедленно. КТ головы без контраста. При отрицательном КТ — люмбальная пункция (исключить САК). Контроль АД (↓ не более 15% за час).',
                },
                {
                  label:'🛑 Ишемический инсульт', color:'#ef4444',
                  symptoms:'Внезапная слабость/онемение лица, руки, ноги (одна сторона). Нарушение речи. Потеря зрения на один глаз. Атаксия.',
                  riskFactors:'Hct >54%, атеросклероз, фибрилляция предсердий, курение, возраст >55.',
                  whatToDo:'🚑 Скорая. FAST-тест (Face, Arm, Speech, Time). КТ/МРТ. Тромболизис в первые 4.5 ч. Время = мозг.',
                },
                {
                  label:'🟡 Гипертонический криз', color:'#f59e0b',
                  symptoms:'Сильная головная боль (пульсирующая, затылок). АД >180/120. Тошнота. Зрительные нарушения (мушки).',
                  riskFactors:'ААС (тестостерон, тренболон), эритропоэтин, GH, НПВС, солодка.',
                  whatToDo:'Каптоприл 25 мг под язык + контроль АД каждые 15 мин. При АД >220/140 или симптомах поражения органов — скорая. НЕ снижать АД >25% за 2 ч (риск ишемии).',
                },
                {
                  label:'🟡 Асептический менингит (от ААС)', color:'#f59e0b',
                  symptoms:'Головная боль + лихорадка + ригидность затылочных мышц. Светобоязнь. Начало через 2-7 дней после инъекции ААС.',
                  riskFactors:'Инъекционные ААС (контаминация?). Иммунный ответ на масляный носитель.',
                  whatToDo:'Люмбальная пункция (цитоз + белок). Исключить инфекционный менингит (бак. посев). Отмена ААС. НПВС. Обычно саморазрешается за 1-2 нед.',
                },
              ].map((c: any, i: any) => (
                <div key={i} style={{ padding:'10px 12px', borderRadius:10, marginBottom:8, background:c.color+'08', border:'1px solid '+c.color+'33' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:c.color, marginBottom:6 }}>{c.label}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'var(--text-light)'}}>Симптомы:</b> {c.symptoms}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'#fca5a5'}}>Факторы риска:</b> {c.riskFactors}</div>
                  <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}><b>Тактика:</b> {c.whatToDo}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Боль в ноге */}
        {emergencyTab === 'leg' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🦵 Боль в ноге — дифференциальная диагностика</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>На фоне Hct {'>'}52% боль в икре — ТГВ пока не доказано обратное. НЕ массировать (оторвётся тромб → ТЭЛА).</p>
              {[
                {
                  label:'🛑 ТГВ (тромбоз глубоких вен)', color:'#ef4444',
                  symptoms:'Односторонний отёк голени/бедра. Боль по ходу вен (симптом Хоманса). Кожа тёплая, покрасневшая. Разница окружности >3 см.',
                  riskFactors:'Hct >52%, недавняя операция/травма/перелом, иммобилизация, перелёт >8 ч, курение.',
                  whatToDo:'🚑 Скорая (риск ТЭЛА в любой момент). УЗДГ вен нижних конечностей. D-димер (при низкой вероятности). НМГ (эноксапарин). НЕ МАССИРОВАТЬ ногу.',
                },
                {
                  label:'🟡 Разрыв икроножной мышцы', color:'#f59e0b',
                  symptoms:'Острая боль в икре во время тренировки (толчок). Локальная боль + гематома. Симптом «мяча» — дефект мышцы пальпируется.',
                  riskFactors:'Интенсивная тренировка ног, недостаточная разминка, обезвоживание.',
                  whatToDo:'Покой, холод (первые 48 ч), эластичный бинт. НПВС (ибупрофен) 3-5 дн. ⚠ Исключить ТГВ (УЗДГ) перед физиотерапией.',
                },
                {
                  label:'🟡 Подагра / артрит', color:'#f59e0b',
                  symptoms:'Острая боль + отёк + покраснение большого пальца ноги / голеностопа. Часто ночью. Повышение мочевой кислоты.',
                  riskFactors:'ААС (↑ мочевой кислоты), диуретики, алкоголь, мясная диета.',
                  whatToDo:'НПВС (индометацин 50 мг ×3/день). Колхицин 0.5 мг ×3/день (только по назначению врача — узкий терапевтический индекс). Аллопуринол — не в острый период!',
                },
              ].map((c: any, i: any) => (
                <div key={i} style={{ padding:'10px 12px', borderRadius:10, marginBottom:8, background:c.color+'08', border:'1px solid '+c.color+'33' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:c.color, marginBottom:6 }}>{c.label}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'var(--text-light)'}}>Симптомы:</b> {c.symptoms}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'#fca5a5'}}>Факторы риска:</b> {c.riskFactors}</div>
                  <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}><b>Тактика:</b> {c.whatToDo}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ЖКТ-кровотечение */}
        {emergencyTab === 'gi' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🫀 ЖКТ-кровотечение — дифференциальная диагностика</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>НПВС + оральные ААС + аспирин = триада риска ЖКТ-кровотечения. Мелена — всегда экстренно.</p>
              {[
                {
                  label:'🛑 Острое ЖКТ-кровотечение', color:'#ef4444',
                  symptoms:'Рвота «кофейной гущей» (кровотечение из верхних отделов). Мелена (чёрный дёгтеобразный стул). Слабость, головокружение, тахикардия, бледность. Ортостатическая гипотензия.',
                  riskFactors:'НПВС (диклофенак, ибупрофен), аспирин, оральные 17α-алкилы, алкоголь, H. pylori, язва в анамнезе.',
                  whatToDo:'🚑 Скорая немедленно. НЕ есть/пить. Оценка кровопотери (Hb, гематокрит). ФГДС в первые 24 ч (эндоскопический гемостаз). ИПП в/в (омепразол 80 мг болюс + 8 мг/ч инфузия). Отмена НПВС/аспирина/оральных ААС.',
                },
                {
                  label:'🟡 НПВС-гастропатия (без кровотечения)', color:'#f59e0b',
                  symptoms:'Боль в эпигастрии после приёма НПВС. Тошнота. Изжога. Стул без мелены, Hb в норме.',
                  riskFactors:'Приём НПВС >5 дн, возраст >60, H. pylori, аспирин.',
                  whatToDo:'Отмена НПВС. ИПП (омепразол 20 мг ×2/день) 7-14 дн. Цинк-карнозин 75 мг ×2/день. Контроль Hb через 1 нед (исключить скрытое кровотечение).',
                },
              ].map((c: any, i: any) => (
                <div key={i} style={{ padding:'10px 12px', borderRadius:10, marginBottom:8, background:c.color+'08', border:'1px solid '+c.color+'33' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:c.color, marginBottom:6 }}>{c.label}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'var(--text-light)'}}>Симптомы:</b> {c.symptoms}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'#fca5a5'}}>Факторы риска:</b> {c.riskFactors}</div>
                  <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}><b>Тактика:</b> {c.whatToDo}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Неврология */}
        {emergencyTab === 'neuro' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🧠 Острые неврологические состояния</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Спутанность сознания, судороги, потеря зрения на ААС — всегда экстренно. Исключить инсульт, гипогликемию, гипертоническую энцефалопатию.</p>
              {[
                {
                  label:'🛑 Судорожный приступ (первый в жизни)', color:'#ef4444',
                  symptoms:'Тонико-клонические судороги. Потеря сознания. Прикус языка. Непроизвольное мочеиспускание. Постприступная спутанность (30-60 мин).',
                  riskFactors:'GH (↑ внутричерепного давления), инсулин (гипогликемия), кленбутерол (нейротоксичность), травма головы, алкогольная абстиненция.',
                  whatToDo:'🚑 Скорая. Обеспечить проходимость дыхательных путей (на бок). НЕ вставлять предметы в рот. После приступа — глюкоза крови, КТ/МРТ головы, ЭЭГ. Запрет вождения на 6-12 мес.',
                },
                {
                  label:'🛑 Гипогликемическая кома', color:'#ef4444',
                  symptoms:'Спутанность, потливость, тремор, тахикардия → потеря сознания. Глюкоза <2.8 ммоль/л. Часто на инсулине + GH без еды.',
                  riskFactors:'Инсулин (особенно короткий перед тренировкой), GH (↓ чувствительности к инсулину), GLP-1 агонисты, пропуск приёма пищи.',
                  whatToDo:'Если в сознании: быстрые углеводы (сок 200 мл, глюкоза 20 г). Без сознания: 🚑 скорая, глюкоза 40% 50 мл в/в или глюкагон 1 мг в/м. НЕ вливать жидкость в рот без сознания (аспирация).',
                },
                {
                  label:'🟡 Паническая атака', color:'#f59e0b',
                  symptoms:'Внезапное сердцебиение, дрожь, чувство удушья, страх смерти. Пик — 10 мин. Проходит за 20-30 мин. В отличие от инфаркта: молодой возраст, связь со стрессом, нет иррадиации.',
                  riskFactors:'Тренболон (нейростероидная модуляция ГАМК), кленбутерол (β2-стимуляция → тахикардия), отмена бензодиазепинов.',
                  whatToDo:'Успокоить. Медленное дыхание (вдох 4 сек, выдох 6 сек). Теанин 200 мг. ⚠ При первом эпизоде — исключить инфаркт (ЭКГ + тропонин). При повторных — психотерапия.',
                },
              ].map((c: any, i: any) => (
                <div key={i} style={{ padding:'10px 12px', borderRadius:10, marginBottom:8, background:c.color+'08', border:'1px solid '+c.color+'33' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:c.color, marginBottom:6 }}>{c.label}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'var(--text-light)'}}>Симптомы:</b> {c.symptoms}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'#fca5a5'}}>Факторы риска:</b> {c.riskFactors}</div>
                  <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}><b>Тактика:</b> {c.whatToDo}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Анафилаксия */}
        {emergencyTab === 'allergy' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>⚡ Анафилаксия и тяжёлые аллергические реакции</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Анафилаксия на препарат/добавку развивается за минуты-часы. Адреналин — единственное жизнеспасающее средство.</p>
              {[
                {
                  label:'🛑 Анафилактический шок', color:'#ef4444',
                  symptoms:'Два и более из: крапивница/отёк Квинке (лицо, губы, язык, гортань), стридор (отёк гортани), бронхоспазм (свистящее дыхание), гипотензия (шок), тахикардия, боль в животе/рвота.',
                  triggers:'Инъекционные препараты (B12, GH, пептиды — реакция на растворитель/примеси). Антибиотики (пенициллин, цефалоспорины). НПВС (аспирин-индуцированная астма). Хелатные формы минералов.',
                  whatToDo:'🚑 Скорая немедленно. Адреналин 0.3-0.5 мг в/м (1:1000) в передне-боковую поверхность бедра (через одежду!). Повторить через 5-15 мин при отсутствии эффекта. Лечь, ноги выше головы. Антигистаминные — НЕ заменяют адреналин (действуют медленно).',
                },
                {
                  label:'🟡 Ангионевротический отёк (изолированный)', color:'#f59e0b',
                  symptoms:'Локальный отёк губ, век, кистей без нарушения дыхания и гипотензии. Зуд. Развитие за часы.',
                  triggers:'Ингибиторы АПФ (эналаприл), аспирин, НПВС, пищевые аллергены.',
                  whatToDo:'Цетиризин 10 мг (или лоратадин 10 мг). Наблюдение 4-6 ч (исключить прогрессию в анафилаксию). При нарастании отёка языка/гортани — 🚑 скорая + адреналин. Отмена триггера.',
                },
              ].map((c: any, i: any) => (
                <div key={i} style={{ padding:'10px 12px', borderRadius:10, marginBottom:8, background:c.color+'08', border:'1px solid '+c.color+'33' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:c.color, marginBottom:6 }}>{c.label}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'var(--text-light)'}}>Симптомы:</b> {c.symptoms}</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4, lineHeight:1.4 }}><b style={{color:'#fca5a5'}}>Триггеры:</b> {c.triggers}</div>
                  <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}><b>Тактика:</b> {c.whatToDo}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Подготовка к операции */}
        {emergencyTab === 'surgery' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={cardBg}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🏥 Подготовка к плановой операции на курсе ААС</div>
              <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Многие препараты на курсе ААС повышают риск кровотечения, гипотензии, тромбоза и аспирации при наркозе. Сообщите анестезиологу о ВСЕХ принимаемых веществах.</p>
              {[
                {
                  label:'🛑 Отменить за 2 недели ДО операции', color:'#ef4444',
                  items:[
                    { drug:'Аспирин', why:'Необратимое ингибирование тромбоцитов (7-10 дн жизни тромбоцита). Риск кровотечения.' },
                    { drug:'НПВС (диклофенак, ибупрофен, индометацин)', why:'Обратимое ингибирование ЦОГ-1. Риск ЖКТ-кровотечения + почечная недостаточность.' },
                    { drug:'Омега-3 высокодозно ( >3 г/день)', why:'Ингибирование агрегации тромбоцитов. Хотя данные противоречивы — хирурги перестраховываются.' },
                    { drug:'Витамин E ( >400 МЕ/день)', why:'Антиагрегантное действие. Отменить за 2 нед.' },
                    { drug:'Чеснок экстракт (аллицин)', why:'Ингибирование агрегации + фибринолиз. Риск кровотечения.' },
                    { drug:'Гинкго билоба', why:'Ингибирование PAF (фактора активации тромбоцитов). Описаны случаи кровотечений.' },
                    { drug:'Серрапептаза / наттокиназа / бромелайн', why:'Фибринолитики. Риск интраоперационного кровотечения.' },
                  ]
                },
                {
                  label:'🛑 Отменить за 24-48 часов', color:'#f97316',
                  items:[
                    { drug:'GLP-1 агонисты (семаглутид, лираглутид)', why:'Замедление опорожнения желудка → полный желудок при индукции → риск аспирации. Рекомендация ASA 2023: отменить за 1 неделю (еженедельные) или за 1 день (ежедневные). При экстренной операции — полный желудок по УЗИ.' },
                    { drug:'Метформин', why:'Риск лактат-ацидоза при контрасте (КТ с контрастом). Отменить за 24-48 ч до операции. Возобновить через 48 ч при нормальной СКФ.' },
                    { drug:'Телмисартан / ингибиторы РААС', why:'Риск рефрактерной гипотензии при индукции анестезии. Большинство центров — отменить за 24 ч. При СН — индивидуально с анестезиологом.' },
                    { drug:'Диуретики (торасемид, фуросемид, ГХТ)', why:'Гиповолемия + электролитный дисбаланс → риск аритмий и гипотензии при индукции.' },
                  ]
                },
                {
                  label:'🟡 Не отменять (продолжить), но сообщить анестезиологу', color:'#f59e0b',
                  items:[
                    { drug:'β-блокаторы (небиволол)', why:'Резкая отмена → rebound-тахикардия и гипертензия. Продолжить в день операции (запить глотком воды).' },
                    { drug:'Статины', why:'Отмена → rebound-воспаление и риск ОКС. Продолжить. Периоперационный приём снижает риск СС-осложнений на 30% (MASH 2021).' },
                    { drug:'Тестостерон (инъекционный)', why:'Не влияет на коагуляцию остро. Продолжить. При экстренной операции — сообщить об Hct и риске тромбоза.' },
                  ]
                },
                {
                  label:'🛑 Специфические риски на курсе ААС при операции', color:'#ef4444',
                  items:[
                    { drug:'Hct >52%', why:'Риск тромбоза (интраоперационная иммобилизация + полицитемия). Рассмотреть предоперационную флеботомию/донацию за 1-2 нед до операции (цель Hct <50%).' },
                    { drug:'Тромбофилия', why:'ААС + операция = риск ТГВ/ТЭЛА ↑ в 3-5 раз. НМГ (эноксапарин) периоперационно по шкале Caprini. Компрессионный трикотаж.' },
                    { drug:'Заживление ран', why:'ААС могут замедлять заживление через ↑ кортизола и ↓ коллагена. Витамин C 1-2 г/день + цинк 50 мг/день за 2 нед до и 4 нед после операции.' },
                  ]
                },
              ].map((s: any, i: any) => (
                <div key={i} style={{ padding:'10px 12px', borderRadius:10, marginBottom:8, background:s.color+'08', border:'1px solid '+s.color+'33' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:s.color, marginBottom:6 }}>{s.label}</div>
                  {s.items.map((x: any, xi: any) => (
                    <div key={xi} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
                      <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.drug}</span>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{x.why}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </InfoErrorBoundary>
  );
};
