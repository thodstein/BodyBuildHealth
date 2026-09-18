/**
 * bb-step-ped.tsx — шаг 2 ББ-авто («💉 Фармакология и рабочие веса»).
 *
 * Рефактор дедупликации (план `docs/BB-AUTO-STEPS-DEDUP-PLAN.md`):
 *  - убрана ДВОЙНАЯ кнопка «Взять: Hyperemia/Mountain Dog» (была скопирована
 *    дважды с одинаковой логикой setMethodology);
 *  - «Pro-пресет» больше не переписывает настройки шага 1 молча: применяет их
 *    явно и сообщает, что изменил (flash + постоянная подпись);
 *  - единый стиль карточек (`BbCard`/`BbFoldCard`), рабочие максимумы — свёрнутая
 *    карточка «необязательно» с честной подписью про профиль и шаг реальных весов.
 */
import React from 'react';
import { PedInputPanel, PedAdaptationCard } from './PedCoursePanel';
import { recommendPEDMethodology, suggestMethodologyForStack } from '../../../engines/bb/bb-ped-methodology.engine';
import type { PED, PEDAdaptation } from '../../../engines/bb/bb-ped-adaptation.engine';
import type { BBTrainingFocus } from '../../../engines/bb/bb-goal-types';
import type { DUPMode } from '../../../engines/bb/bb-dup.engine';
import type { SessionMethodology } from '../../../engines/bb/bb-session-order.engine';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { BTN, BTN_GHOST, H } from './training-ui';
import { BbRowSwitch, BbCard, BbFoldCard, BB_WM_KEYS, BB_WM_RU, type PlanMode } from './bb-auto-constructor-shared';

export interface BbPedWorkMaxStepProps {
  peds: PED[];
  setPeds: React.Dispatch<React.SetStateAction<PED[]>>;
  pedDoses: Record<string, number>;
  setPedDoses: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  courseIntensity: 'mild' | 'moderate' | 'heavy';
  setCourseIntensity: React.Dispatch<React.SetStateAction<'mild' | 'moderate' | 'heavy'>>;
  pedAdapt: PEDAdaptation;
  level: string;
  goal: string;
  trainingFocus: BBTrainingFocus;
  weeks: number;
  pedPhaseOverride: 'auto' | 'proliferation' | 'differentiation';
  setPedPhaseOverride: React.Dispatch<React.SetStateAction<'auto' | 'proliferation' | 'differentiation'>>;
  proPreset: string;
  setProPreset: React.Dispatch<React.SetStateAction<string>>;
  dupMode: DUPMode;
  setDupMode: React.Dispatch<React.SetStateAction<DUPMode>>;
  supersetMode: 'none' | 'antagonist' | 'same_muscle' | 'giant';
  setSupersetMode: React.Dispatch<React.SetStateAction<'none' | 'antagonist' | 'same_muscle' | 'giant'>>;
  volumeScheme: 'standard' | 'gvt' | 'fst7' | 'gironda';
  setVolumeScheme: React.Dispatch<React.SetStateAction<'standard' | 'gvt' | 'fst7' | 'gironda'>>;
  methodology: SessionMethodology;
  setMethodology: React.Dispatch<React.SetStateAction<SessionMethodology>>;
  bfrMode: boolean;
  setBfrMode: React.Dispatch<React.SetStateAction<boolean>>;
  dcMode: boolean;
  setDcMode: React.Dispatch<React.SetStateAction<boolean>>;
  blastCruiseEnabled: boolean;
  setBlastCruiseEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  blastWeeks: number;
  setBlastWeeks: React.Dispatch<React.SetStateAction<number>>;
  cruiseWeeks: number;
  setCruiseWeeks: React.Dispatch<React.SetStateAction<number>>;
  workMax: Record<string, number>;
  setWorkMax: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  planMode: PlanMode;
  onBuild: () => void;
  onNext: () => void;
  onBackToParams: () => void;
  flash: (m: string) => void;
}

const NOTE: React.CSSProperties = { fontSize: 10, color: '#fff', lineHeight: 1.45 };
const GRID3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 };

export const BbPedWorkMaxStep: React.FC<BbPedWorkMaxStepProps> = ({
  peds, setPeds, pedDoses, setPedDoses, courseIntensity, setCourseIntensity, pedAdapt,
  level, goal, trainingFocus, weeks, pedPhaseOverride, setPedPhaseOverride,
  proPreset, setProPreset, dupMode, setDupMode, supersetMode, setSupersetMode,
  volumeScheme, setVolumeScheme, methodology, setMethodology,
  bfrMode, setBfrMode, dcMode, setDcMode, blastCruiseEnabled, setBlastCruiseEnabled, blastWeeks, setBlastWeeks,
  cruiseWeeks, setCruiseWeeks, workMax, setWorkMax, planMode, onBuild, onNext, onBackToParams, flash,
}) => {
  /* Пресет — явная макро-команда над настройками шага 1: применяем и СООБЩАЕМ,
     что изменили (раньше перезапись была тихой, а meadows не делал ничего). */
  const applyProPreset = (v: string) => {
    setProPreset(v);
    const changes: string[] = [];
    if (v === 'dc') {
      if (dupMode === 'none') { setDupMode('strength_hypertrophy' as DUPMode); changes.push('DUP → сила/гипертрофия'); }
      if (!dcMode) { setDcMode(true); changes.push('DC-лайт → вкл'); }
      changes.push('сплит: рекомендация Upper/Lower или PPL');
    } else if (v === 'fortitude') {
      if (supersetMode !== 'giant') { setSupersetMode('giant'); changes.push('суперсеты → гигант'); }
      if (volumeScheme === 'standard') { setVolumeScheme('fst7'); changes.push('схема объёма → FST-7'); }
      changes.push('сплит: рекомендация Upper/Lower 5 или FullBody 4');
    } else if (v === 'meadows') {
      if (methodology !== 'mountain_dog') { setMethodology('mountain_dog'); changes.push('порядок → Mountain Dog'); }
      changes.push('сплит: рекомендация PPL или Arnold');
    }
    if (v === 'none') flash('Пресет снят — настройки шага 1 не меняются');
    else if (changes.length) flash(`🏆 Пресет: ${changes.join(' · ')}`);
  };

  return (
    <div>
      <div style={H}>💉 Шаг 2: Фармакология и рабочие веса</div>

      <PedInputPanel
        peds={peds}
        onToggle={p => setPeds(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
        pedDoses={pedDoses}
        onDose={(p, v) => setPedDoses(d => ({ ...d, [p]: v }))}
        courseIntensity={courseIntensity}
        onIntensity={setCourseIntensity}
      />
      <PedAdaptationCard adaptation={pedAdapt} />

      {peds.length > 0 && (() => {
        try {
          const meth = recommendPEDMethodology({ peds: peds as any, pedDoses, level, goal, focus: trainingFocus, totalWeeks: weeks, phaseOverride: pedPhaseOverride });
          return (
            <BbCard icon="🧬" accent="#a78bfa" title="PED-методика — адаптация плана под курс"
              desc="Тяж/памп не ломаются: план подстраивает порядок, пометки окон и локальные акценты под стек. Пояснения ниже — что именно применено."
            >
              {meth.jointGuard && <div style={{ ...NOTE, marginBottom: 4, padding: '5px 7px', background: 'rgba(59,130,246,0.08)', borderRadius: 6, border: '1px solid rgba(59,130,246,0.15)' }}>🛡️ Защита суставов: тяжёлые базовые остаются тяжёлыми (RIR 1-2), но осевая нагрузка на позвоночник (присед/становая/жим стоя) заменяется на машины/блоки/тросы, темп 4-2-1-0 для контроля. Сухожилия на курсе отстают от мышц — снижаем риск травмы.</div>}
              {meth.insulinPumpWindow && <div style={{ ...NOTE, marginBottom: 4, padding: '5px 7px', background: 'rgba(168,85,247,0.08)', borderRadius: 6, border: '1px solid rgba(168,85,247,0.15)' }}>💉 Окно пампа GH+инсулин: только в памп-дни — внутри тренировки 30-60 г быстрых углеводов + 10 г EAA (незаменимые аминокислоты) для суперкомпенсации гликогена и пампа. Только на курсе GH+инсулин.</div>}
              {meth.bfrAllowed && !meth.insulinPumpWindow && <div style={{ ...NOTE, marginBottom: 4, padding: '5px 7px', background: 'rgba(236,72,153,0.08)', borderRadius: 6, border: '1px solid rgba(236,72,153,0.15)' }}>🩸 BFR доступен: окклюзионный тренинг 20-30% от 1ПМ, схема 30-15-15-15 с паузой 30 сек, только для памп-изоляций (бицепс/трицепс/дельты), не для базы. Усиливает метаболический стресс без высокой механической нагрузки.</div>}
              {(meth.pedPhase === 'proliferation' || meth.pedPhase === 'differentiation') && <div style={{ ...NOTE, marginBottom: 4, padding: '5px 7px', background: 'rgba(34,197,94,0.08)', borderRadius: 6, border: '1px solid rgba(34,197,94,0.15)' }}>🧬 {meth.pedPhase === 'proliferation' ? 'Фаза MGF (пролиферация): цель — повреждение + стретч (эксцентрик 3-4с, lengthened, порядок Mountain Dog)' : 'Фаза IGF1 (дифференцировка): цель — синтез белка (памп 12-20 + углеводное окно 50-80 г)'}</div>}
              {meth.pedPhase === 'both' && <div style={{ ...NOTE, marginBottom: 4, padding: '5px 7px', background: 'rgba(34,197,94,0.08)', borderRadius: 6, border: '1px solid rgba(34,197,94,0.15)' }}>🧬 MGF+IGF1 чередованием по неделям (не одновременно): MGF-недели — повреждение/стретч, IGF1-недели — памп + углеводное окно. Пометки в плане стоят только в свои недели.</div>}
              {meth.insulinSafety && <div style={{ ...NOTE, color: '#fbbf24', marginBottom: 4, padding: '5px 7px', background: 'rgba(251,191,36,0.08)', borderRadius: 6, border: '1px solid rgba(251,191,36,0.2)' }}>🛡 Инсулин {meth.insulinSafety.doseIU} IU: ≥{meth.insulinSafety.requiredCarbsG} г быстрых углеводов + 10-20 г EAA вокруг инъекции, глюкометр и сахара под рукой. Старт 3-5 IU.</div>}
              {meth.periWorkout?.intraNote && <div style={{ fontSize: 10, color: '#fbbf24', marginBottom: 4 }}>🍚 {meth.periWorkout.intraNote}</div>}
              {meth.periWorkout?.warning && <div style={{ fontSize: 10, color: '#f87171', marginBottom: 4 }}>⚠ {meth.periWorkout.warning}</div>}
              <div style={{ ...NOTE, opacity: 0.9 }}>📋 Тяж: {meth.recommendedScheme.heavy} · Памп: {meth.recommendedScheme.pump} {proPreset !== 'none' ? `· Пресет ${proPreset}` : ''}</div>
              <div style={{ ...NOTE, opacity: 0.85, marginTop: 4 }}>🔄 Все сплиты адаптируются под фарму (выбор сохранён, объём ×{(pedAdapt.combinedMrvMultiplier || 1).toFixed(2)})</div>
              {(() => {
                try {
                  const sug = suggestMethodologyForStack({ peds: peds as any, pedDoses });
                  if (!sug || sug === methodology) return null;
                  const sugLabel = sug === 'hyperemia' ? 'Hyperemia (GH+инсулин)' : 'Mountain Dog (MGF)';
                  return (
                    <>
                      <button onClick={() => { setMethodology(sug); flash(`Методика порядка: ${sugLabel} — применено (шаг 1, секция «Методики»)`); }}
                        style={{ marginTop: 6, padding: '8px 12px', borderRadius: 10, minHeight: 44, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }}>
                        Применить методику: {sugLabel} →
                      </button>
                      <div style={{ ...NOTE, opacity: 0.85, marginTop: 4 }}>Меняет «🧩 Методика порядка» в секции «Методики» (шаг 1) — там же можно выбрать вручную.</div>
                    </>
                  );
                } catch { return null; }
              })()}
            </BbCard>
          );
        } catch { return null; }
      })()}

      <BbCard icon="⚙️" accent="#f59e0b" title="Особые режимы"
        desc="Дополнительные схемы поверх базовой сборки. Пресет — макро-команда: меняет настройки шага 1 (DUP / суперсеты / схема объёма / DC / порядок) и рекомендацию сплита, о чём сообщает всплывающим статусом."
      >
        <BbRowSwitch checked={bfrMode} onChange={setBfrMode} icon="🩸" accent="#ec4899"
          title={`BFR окклюзия${bfrMode ? ' (30-15-15-15)' : ''}`} desc="Только памп-изоляции: 20-30% 1ПМ, схема 30-15-15-15, пауза 30 сек. Не для базы." />
        <BbRowSwitch checked={dcMode} onChange={setDcMode} icon="🎯" accent="#ef4444"
          title="DC-лайт (Dante)" desc="Ротация-3 топ-лифтов + widowmaker + круиз каждые 6 нед. Гейт: AAS от 750 + advanced/enhanced." />
        <BbRowSwitch checked={blastCruiseEnabled} onChange={setBlastCruiseEnabled} icon="🔄" accent="#facc15"
          title={`Blast/Cruise${blastCruiseEnabled ? ` (${blastWeeks}н / ${cruiseWeeks}н)` : ''}`} desc="Чередование высокой (объём ×1.15) и низкой (×0.85, RIR +1) нагрузки для долгосрочного курса." />
        {blastCruiseEnabled && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <PopupNumber label='Blast нед' value={blastWeeks} min={4} max={12} onChange={setBlastWeeks} />
            <PopupNumber label='Cruise нед' value={cruiseWeeks} min={2} max={8} onChange={setCruiseWeeks} />
          </div>
        )}
        <PopupSelect label='🏆 Pro-пресет (методики профи)' value={proPreset} onChange={applyProPreset} hint='Готовые связки методик — в коде: none/dc/fortitude/meadows. Применяет настройки шага 1 и сообщает, что изменил.' options={[
          { id: 'none', label: 'Без пресета', desc: 'Стандартная сборка по вашим параметрам без пресета' },
          { id: 'dc', label: 'DC Training (DoggCrapp)', desc: 'Низкообъёмный, высокоинтенсивный: 1 тяжёлый сет Rest-Pause 11-15 повторов, прогрессия каждый раз, для продвинутых (≥3 года). Включает: DC-лайт + DUP сила/гипертрофия' },
          { id: 'fortitude', label: 'Fortitude (Скотт Стивенсон)', desc: '4×6, гигант-сеты, FST-7, волновая нагрузка — объёмный пресет для опытных. Включает: гигант-суперсеты + FST-7' },
          { id: 'meadows', label: 'Meadows (Джон Медоуз)', desc: 'Акцент на растянутой позиции, памп, медленный эксцентрик, проработка слабых мест. Включает: порядок Mountain Dog' },
        ]} />
        {dcMode && <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 2 }}>DC-лайт: ротация-3 топ-лифтов + widowmaker + круиз каждые 6 нед. Гейт: AAS от 750 + advanced/enhanced.</div>}
        {((pedDoses.MGF || 0) > 0 && (pedDoses.IGF1 || 0) > 0) && (
          <div style={{ marginTop: 6 }}>
            <PopupSelect label='Фаза MGF/IGF1' value={pedPhaseOverride} onChange={v => setPedPhaseOverride(v as any)} hint='Вручную поверх авто-фазировки. В режиме источника применяется (адаптировать) — фаза оживлена в обоих путях.' options={[
              { id: 'auto', label: 'Авто (по стеку)', desc: 'Авто.' },
              { id: 'proliferation', label: 'Пролиферация', desc: 'Повреждение + стретч.' },
              { id: 'differentiation', label: 'Дифференцировка', desc: 'Памп + углеводное окно.' },
            ]} />
          </div>
        )}
        {bfrMode && (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.18)', ...NOTE }}>
            <div style={{ fontWeight: 800, color: '#ec4899', marginBottom: 4 }}>🩸 Что такое BFR и как работает</div>
            <div>Окклюзия — жгуты на верхней части конечности, 20-30% от 1ПМ, схема 30 повторов + 15+15+15 с паузой 30 сек. Кровь задерживается, метаболиты копятся, рост без тяжёлых весов. Только для памп-изоляций (бицепс/трицепс/дельты/икры), не для базы. На курсе — усиливает памп, вне курса — для отстающих с малым весом.</div>
            <div style={{ marginTop: 6, opacity: 0.85, padding: '5px 7px', background: 'rgba(236,72,153,0.08)', borderRadius: 6 }}>В плане: памп-изоляции получат пометку <b>BFR 30-15-15-15 @25% 1ПМ, отдых 30 сек, RIR 2</b>. Тяжёлые базовые не трогаются. Не для новичков и при проблемах с сосудами.</div>
          </div>
        )}
        {blastCruiseEnabled && (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.18)', ...NOTE }}>
            <div style={{ fontWeight: 800, color: '#facc15', marginBottom: 4 }}>🔄 Что такое Blast/Cruise и как работает</div>
            <div>Blast — недели высокой дозы (объём ×1.15), Cruise — недели низкой (×0.85, RIR +1), чередование для долгосрочного курса. Позволяет держать высокий объём без перетрена. Настраивается: Blast 4-12 недель, Cruise 2-8 недель.</div>
            <div style={{ marginTop: 6, opacity: 0.85, padding: '5px 7px', background: 'rgba(250,204,21,0.08)', borderRadius: 6 }}>В плане: недели Blast получат <b>+15% сетов</b>, Cruise — <b>−15% и RIR +1</b>. Автоматически применяется к объёму и восстановлению. Для натуралов — выкл.</div>
          </div>
        )}
      </BbCard>

      {/* Рекомендации по питанию — справочные ориентиры под цель */}
      <BbCard icon="🥗" accent="#22c55e" title={`Ориентиры по питанию (${goal})`}
        desc="Справочные ориентиры под цель — питание настраивается в отдельном планировщике (значения не применяются к тренировочному плану)."
      >
        {(() => {
          const nut: Record<string, { cal: string; pro: string; tip: string }> = {
            mass: { cal: 'Профицит 300-500 ккал/день', pro: '1.8-2.2 г/кг (≥160 г/день)', tip: 'Углеводы вокруг тренировки. 4-6 приёмов пищи.' },
            cut: { cal: 'Дефицит 300-500 ккал/день', pro: '2.2-2.8 г/кг (≥180 г/день)', tip: 'Белок повышен для сохранения мышц. Клетчатка 30+ г/день.' },
            recomp: { cal: 'Поддержание ±100 ккал', pro: '2.0-2.4 г/кг', tip: 'Циклирование углеводов: высокие в дни тренировок, низкие в дни отдыха.' },
            maintenance: { cal: 'Поддержание (TDEE)', pro: '1.6-2.0 г/кг', tip: 'Стабильное питание, контроль веса 1 раз/нед.' },
            strength_mass: { cal: 'Профицит 400-600 ккал/день', pro: '2.0-2.5 г/кг (≥180 г/день)', tip: 'Углеводы 5-7 г/кг для силовой производительности.' },
          };
          const n = nut[goal] || nut.mass;
          const calMult = (pedAdapt.combinedMrvMultiplier - 1) * 3 + 1;
          const adjCal = goal === 'cut' ? n.cal : n.cal.replace(/\d+/, m => String(Math.round(Number(m) * calMult)));
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, ...NOTE }}>
              <div><span>Калории: </span><span style={{ fontWeight: 700, color: '#f59e0b' }}>{adjCal}</span></div>
              <div><span>Белок: </span><span style={{ fontWeight: 700, color: '#22c55e' }}>{n.pro}</span></div>
              <div style={{ gridColumn: '1/-1' }}>💡 {n.tip}</div>
              {pedAdapt.combinedMrvMultiplier > 1 && (
                <div style={{ gridColumn: '1/-1', marginTop: 4, fontSize: 10, color: '#f59e0b' }}>💉 PED увеличивают потребность в калориях и белке — значения скорректированы.</div>
              )}
            </div>
          );
        })()}
      </BbCard>

      {/* Рабочие максимумы — необязательная свёрнутая секция */}
      <BbFoldCard icon="💪" accent="#60a5fa" title="Рабочие максимумы (кг)" badge="необязательно"
        desc="Рабочий вес на 5–8 повторений (НЕ 1ПМ) — от него считаются веса по RIR и %1RM. Авто-подтягиваются из профиля (Личные рекорды) и сохраняются в него; реальные веса по упражнениям уточняются на шаге «⚖️ Реальные веса» — они приоритетнее формулы."
      >
        <div style={GRID3}>
          {BB_WM_KEYS.map(k => <PopupNumber key={k} label={BB_WM_RU[k]} value={workMax[k] || 80} min={10} max={500} suffix=' кг' onChange={v => setWorkMax(p => ({ ...p, [k]: v }))} />)}
        </div>
      </BbFoldCard>

      <button style={{ ...BTN, width: '100%' }} onClick={() => planMode === 'programs' ? onBuild() : onNext()}>
        {planMode === 'programs' ? '⚡ Собрать план по программе →' : 'Далее: выбрать сплит →'}
      </button>
      {planMode === 'programs' && (
        <button style={{ ...BTN_GHOST, width: '100%', marginTop: 6 }} onClick={onBackToParams}>
          ← Назад к параметрам
        </button>
      )}
    </div>
  );
};
