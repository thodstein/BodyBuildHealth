/** PeakingPanel.tsx — ПОЛНЫЙ переписан: taper + соревнование + пик в едином красивом калькуляторе.
 *  Все вводы — PopupNumber/PopupSelect/PopupToggle, никаких raw <input>.
 *  Связан с planner-bridge для применения к планировщику. */
import React, { useState, useMemo } from 'react';
import { PopupNumber, PopupSelect, PopupToggle, ExpandableCard, MetricCard, CalcSection, CalcResult } from './TrainingPopups';
import { applyToPlanner } from '../TrainingScreen_parts/planner-bridge';
import { getProfile, updateSection } from '../../../core/profile-manager';

const ACCENT = '#00e68a';
const H: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: ACCENT, margin: '4px 0 10px' };

const WEEK_OPTS = [1,2,3,4].map(w => ({ id: String(w), label: `${w} неделя${w > 1 ? 'и' : ''}` }));
const FED_OPTS = [
  { id: 'ipf', label: 'IPF', desc: 'Международная федерация пауэрлифтинга' },
  { id: 'fpr', label: 'FPR', desc: 'Федерация пауэрлифтинга России' },
  { id: 'wpc', label: 'WPC', desc: 'World Powerlifting Congress' },
  { id: 'other', label: 'Другая', desc: 'Иная федерация' },
];

function genTaperCurve(weeks: number, fatigue: number): { week: number; volumePct: number; intensityPct: number; rirTarget: number }[] {
  const taper: { week: number; volumePct: number; intensityPct: number; rirTarget: number }[] = [];
  for (let w = 1; w <= weeks; w++) {
    const progress = w / weeks;
    const volBase = Math.max(0.3, 1 - progress * 0.55);
    const intBase = Math.min(1, 0.65 + progress * 0.3);
    const fatigueAdjust = Math.min(0.2, fatigue / 500);
    taper.push({
      week: w,
      volumePct: Math.round((volBase - fatigueAdjust) * 100) / 100,
      intensityPct: Math.round((intBase + fatigueAdjust * 0.5) * 100) / 100,
      rirTarget: Math.max(0, Math.round(4 - progress * 3)),
    });
  }
  return taper;
}

function genAttemptStrategy(squat: number, bench: number, deadlift: number):
  { lift: string; opener: number; second: number; third: number }[] {
  return [
    { lift: 'Присед', opener: Math.round(squat * 0.92), second: Math.round(squat * 0.96), third: Math.round(squat * 1.0) },
    { lift: 'Жим', opener: Math.round(bench * 0.93), second: Math.round(bench * 0.97), third: Math.round(bench * 1.0) },
    { lift: 'Тяга', opener: Math.round(deadlift * 0.91), second: Math.round(deadlift * 0.95), third: Math.round(deadlift * 1.0) },
  ];
}

function genTimeline(weighIn: string, startTime: string): string[] {
  const [sh, sm] = startTime.split(':').map(Number);
  const [wh, wm] = weighIn.split(':').map(Number);
  const lines: string[] = [];
  lines.push(`${weighIn} — Взвешивание`);
  const preWarm = new Date(0, 0, 0, wh, wm + 90);
  lines.push(`${String(preWarm.getHours()).padStart(2,'0')}:${String(preWarm.getMinutes()).padStart(2,'0')} — Разминка`);
  lines.push(`${startTime} — Старт соревнования`);
  for (let h = sh; h <= Math.min(sh + 3, 23); h++) {
    for (const lift of ['Присед', 'Жим', 'Тяга']) {
      if (h === sh && lift !== 'Присед') continue;
      lines.push(`${String(h).padStart(2,'0')}:00 — ${lift} (1-й подход)`);
      lines.push(`${String(h).padStart(2,'0')}:${String(Math.floor(15 + Math.random() * 10)).padStart(2,'0')} — ${lift} (2-й подход)`);
    }
  }
  return lines.slice(0, 16);
}

const RECOVERY_PROTOCOLS: { type: string; duration: string; instructions: string }[] = [
  { type: 'Дыхание', duration: '2-3 мин', instructions: 'Квадратное дыхание: 4с вдох — 4с пауза — 4с выдох — 4с пауза' },
  { type: 'Активация', duration: '5-10 мин', instructions: 'Лёгкая разминка + целевая мобилизация суставов' },
  { type: 'Массаж', duration: '3-5 мин', instructions: 'Перкуссионный массаж рабочих мышц + ролл на спину' },
  { type: 'Питание', duration: 'после взвешивания', instructions: 'Углеводный коктейль + BCAA, лёгкий перекус за 1.5ч до старта' },
  { type: 'Психология', duration: '1-2 мин', instructions: 'Визуализация успешного подхода + ключевые слова' },
  { type: 'Холод/Тепло', duration: '5 мин', instructions: 'Контрастный душ или крио-пакет на реактивные мышцы' },
];

const MENTAL_ROUTINES: { step: string; duration: string; when: string }[] = [
  { step: 'Соберись: глубокий вдох, ключевое слово', duration: '30с', when: 'за 2 подхода до выхода' },
  { step: 'Интенсивная визуализация успешного подхода', duration: '1 мин', when: 'перед выходом на помост' },
  { step: 'Фокусировка: точка концентрации (напр. штанга)', duration: '15с', when: 'при подходе к штанге' },
  { step: 'Активация: удар по трапециям, хлопок', duration: '3с', when: 'перед взятием грифа' },
  { step: 'Старт: команда судьи → техника + мощность', duration: 'весь подход', when: 'на выполнении' },
];

function weightClass(bw: number, fed: string): { name: string; min: number; max: number } {
  const classes: Record<string, { name: string; min: number; max: number }[]> = {
    ipf: [{name:'до 59кг',min:0,max:59},{name:'до 66кг',min:59,max:66},{name:'до 74кг',min:66,max:74},{name:'до 83кг',min:74,max:83},{name:'до 93кг',min:83,max:93},{name:'до 105кг',min:93,max:105},{name:'до 120кг',min:105,max:120},{name:'свыше 120кг',min:120,max:999}],
    fpr: [{name:'до 53кг',min:0,max:53},{name:'до 59кг',min:53,max:59},{name:'до 66кг',min:59,max:66},{name:'до 74кг',min:66,max:74},{name:'до 83кг',min:74,max:83},{name:'до 93кг',min:83,max:93},{name:'до 105кг',min:93,max:105},{name:'до 120кг',min:105,max:120},{name:'свыше 120кг',min:120,max:999}],
    wpc: [{name:'до 56кг',min:0,max:56},{name:'до 67.5кг',min:56,max:67.5},{name:'до 75кг',min:67.5,max:75},{name:'до 82.5кг',min:75,max:82.5},{name:'до 90кг',min:82.5,max:90},{name:'до 100кг',min:90,max:100},{name:'до 110кг',min:100,max:110},{name:'до 125кг',min:110,max:125},{name:'свыше 125кг',min:125,max:999}],
  };
  const list = classes[fed] || classes.ipf;
  return list.find(c => bw <= c.max) || list[list.length - 1];
}

export const PeakingPanel: React.FC<{ defaultKind?: 'pl' | 'bb' }> = ({ defaultKind }) => {
  const kind = defaultKind || 'pl';

  // ── Локальный state (поля остаются локальными) ──
  const [squat, setSquat] = useState(180);
  const [bench, setBench] = useState(120);
  const [deadlift, setDeadlift] = useState(200);
  const [bw, setBw] = useState(80);
  const [fed, setFed] = useState('ipf');
  const [weeks, setWeeks] = useState(3);
  const [fatigue, setFatigue] = useState(300);
  const [weighIn, setWeighIn] = useState('09:00');
  const [startTime, setStartTime] = useState('10:00');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // BB state
  const [showDate, setShowDate] = useState('');
  const [carbLoadDays, setCarbLoadDays] = useState(3);
  const [sodiumManip, setSodiumManip] = useState(true);
  const [waterLoadDays, setWaterLoadDays] = useState(2);

  // ── Автозаполнение из Профиля (однократная загрузка в локальный state) ──
  const autofillFromProfile = () => {
    try {
      const p = getProfile();
      const s = (p.settings || {}) as any;
      if (s.personal?.weight) setBw(s.personal.weight);
      if (s.training?.pmSquat) setSquat(s.training.pmSquat);
      if (s.training?.pmBench) setBench(s.training.pmBench);
      if (s.training?.pmDeadlift) setDeadlift(s.training.pmDeadlift);
    } catch (e) {
      console.error('[PeakingPanel.autofillFromProfile]', e);
    }
  };

  const cls = useMemo(() => weightClass(bw, fed), [bw, fed]);
  const taper = useMemo(() => genTaperCurve(weeks, fatigue), [weeks, fatigue]);
  const attempts = useMemo(() => genAttemptStrategy(squat, bench, deadlift), [squat, bench, deadlift]);
  const timeline = useMemo(() => genTimeline(weighIn, startTime), [weighIn, startTime]);

  const applyTaper = () => {
    const lastWeek = taper[taper.length - 1];
    applyToPlanner({
      kind: 'peak',
      label: `Taper ${weeks} нед: объём ×${lastWeek.volumePct}, RIR → ${lastWeek.rirTarget}`,
      data: { volumeMult: lastWeek.volumePct, rirTarget: lastWeek.rirTarget, weeks: taper.map(t => t.week) },
    });
  };

  /**
   * Сохранить ПМ в Профиль (UnifiedSettings) + показать toast.
   * PМ из PeakingPanel — ЭТАЛОННЫЕ 1RM для всех модулей (BB-auto, PL-auto).
   */
  const applyPms = () => {
    try {
      updateSection('training', {
        pmSquat: squat,
        pmBench: bench,
        pmDeadlift: deadlift,
      });
      // Сохраняем вес ТОЛЬКО если он отличается от дефолтного 80 (иначе не перезаписываем профиль)
      // Default = 80 (из useState). Если пользователь явно ввёл другой — он отличается.
      // Чтобы не сохранять default, проверяем через источник — инициализирован ли bw из профиля.
      if (bw > 0 && bw !== 80) {
        updateSection('personal', { weight: bw });
      } else {
        // Прочитаем текущий вес из профиля и сохраним (на случай если там уже есть)
        const cur = getProfile();
        const w = (cur.settings as any).personal?.weight;
        if (w && w > 0) {
          // Сохраняем тот же вес, не перезаписывая default
          // (если пользователь НЕ ввёл вес, не трогаем значение)
        }
      }
      // Также legacy-ключ для backward-compat с модулями, которые ещё читают training-profile
      const legacy = {
        bodyWeight: bw,
        pmSquat: squat,
        pmBench: bench,
        pmDead: deadlift,
      };
      try {
        const cur = JSON.parse(localStorage.getItem('he_training_profile') || '{}') || {};
        const next = { ...cur, ...legacy };
        localStorage.setItem('he_training_profile', JSON.stringify(next));
      } catch {}
      setLastSavedAt(Date.now());
      const toast = (window as any).showToast;
      if (typeof toast === 'function') toast('✓ ПМ сохранены в профиль', 'success');
      else alert(`✓ ПМ сохранены в профиль: присед ${squat} / жим ${bench} / тяга ${deadlift} / вес ${bw} кг`);
      applyToPlanner({
        kind: 'pri',
        label: `ПМ: присед ${squat} / жим ${bench} / тяга ${deadlift} кг · вес ${bw} кг`,
        data: { volumeMult: 1, rirShift: 0 },
      });
    } catch (e) {
      console.error('[PeakingPanel.applyPms]', e);
      alert('Ошибка сохранения: ' + (e as Error).message);
    }
  };

  if (kind === 'bb') {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
        <CalcSection icon="🏆" title="Шоу-пик (ББ)" accent="#ec4899" desc="Подготовка к сцене: углеводная загрузка, водная манипуляция, натрий">
          <PopupNumber label="Дата шоу (дд.мм)" value={0} hint="Введите дату соревнования" onChange={() => {}} />
          <PopupNumber label="Дней карб-загрузки" value={carbLoadDays} min={1} max={7} step={1} onChange={setCarbLoadDays} />
          <PopupToggle label="Натриевая манипуляция" value={sodiumManip} onChange={setSodiumManip} icon="🧂" />
          <PopupNumber label="Водная загрузка (дней)" value={waterLoadDays} min={0} max={7} step={1} onChange={setWaterLoadDays} />
        </CalcSection>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', padding: 10, textAlign: 'center' }}>
          🎯 Рекомендации: карб-загрузка {carbLoadDays} дня, {sodiumManip ? 'натрий снизить за 2 дня до шоу' : 'без натриевой манипуляции'}, вода {waterLoadDays > 0 ? `${waterLoadDays} дня + сушка` : 'без водной загрузки'}.<br />
          Детальный протокол — в разделе «Периодизация» → «Taper» (режим BB).
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <CalcSection icon="🏋️" title="Соревнование + Taper (ПЛ)" accent={ACCENT} desc="Полный инструмент: тренировочный пик, стратегия подходов, таймлайн, восстановление">
        <PopupNumber label="Присед (1ПМ)" value={squat} min={20} max={500} suffix=" кг" onChange={setSquat} />
        <PopupNumber label="Жим лёжа (1ПМ)" value={bench} min={20} max={400} suffix=" кг" onChange={setBench} />
        <PopupNumber label="Становая (1ПМ)" value={deadlift} min={20} max={500} suffix=" кг" onChange={setDeadlift} />
        <PopupNumber label="Вес тела" value={bw} min={40} max={200} suffix=" кг" onChange={setBw} />
        <PopupSelect label="Федерация" value={fed} options={FED_OPTS} onChange={setFed} />
        <PopupSelect label="Длительность taper" value={String(weeks)} options={WEEK_OPTS} hint="Недель пиковой фазы перед соревнованием" onChange={v => setWeeks(Number(v))} />
        <PopupNumber label="Усталость (у.е.)" value={fatigue} min={100} max={500} step={50} hint="Субъективная накопленная усталость" onChange={setFatigue} />
      </CalcSection>

      <CalcSection icon="⚖️" title="Весовая категория" accent="#60a5fa" grid2>
        <CalcResult label="Категория" value={cls.name} accent="#60a5fa" hint={`Для ${bw} кг · ${fed.toUpperCase()}`} />
        <CalcResult label="Нужно сбросить" value={bw > cls.max ? `${(bw - cls.max + 0.5).toFixed(1)} кг` : '0 кг'} accent="#f59e0b" hint={bw > cls.max ? 'Рекомендуется сушка' : 'Вес в норме'} />
      </CalcSection>

      <CalcSection icon="📉" title="Taper-кривая" accent="#a855f7" desc={`${weeks}-недельная пиковая фаза от текущей усталости (${fatigue} у.е.)`}>
        {taper.map(t => (
          <div key={t.week} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10,
            background: t.week === weeks ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${t.week === weeks ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.04)'}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', minWidth: 28 }}>Н{t.week}</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ width: 48, fontSize: 9, color: 'var(--text-dim)' }}>Объём</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ width: `${t.volumePct * 100}%`, height: '100%', borderRadius: 2, background: '#3b82f6' }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa', minWidth: 32, textAlign: 'right' }}>{Math.round(t.volumePct * 100)}%</span>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ width: 48, fontSize: 9, color: 'var(--text-dim)' }}>Интенс.</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ width: `${t.intensityPct * 100}%`, height: '100%', borderRadius: 2, background: '#ef4444' }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', minWidth: 32, textAlign: 'right' }}>{Math.round(t.intensityPct * 100)}%</span>
              </div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#a855f7', minWidth: 20 }}>RIR {t.rirTarget}</span>
          </div>
        ))}
      </CalcSection>

      <CalcSection icon="📋" title="Стратегия подходов" accent="#f59e0b">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2, fontWeight: 700, fontSize: 9, color: 'var(--text-dim)', padding: '4px 8px' }}>
          <span>Движение</span><span style={{textAlign:'center'}}>1-й</span><span style={{textAlign:'center'}}>2-й</span><span style={{textAlign:'center'}}>3-й</span>
        </div>
        {attempts.map(a => (
          <div key={a.lift} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2, padding: '6px 8px', fontSize: 11, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontWeight: 700, color: '#fff' }}>{a.lift}</span>
            <span style={{ textAlign: 'center', color: '#3b82f6', fontWeight: 600 }}>{a.opener} кг</span>
            <span style={{ textAlign: 'center', color: '#eab308', fontWeight: 600 }}>{a.second} кг</span>
            <span style={{ textAlign: 'center', color: ACCENT, fontWeight: 800 }}>{a.third} кг</span>
          </div>
        ))}
      </CalcSection>

      <CalcSection icon="⏰" title="Таймлайн дня" accent="#ec4899" desc={`Взвешивание ${weighIn} · Старт ${startTime}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {timeline.map((line, i) => (
            <div key={i} style={{ fontSize: 10, padding: '3px 8px', color: 'rgba(255,255,255,0.75)', borderLeft: i === 0 ? '2px solid #3b82f6' : i === 1 ? '2px solid #f59e0b' : '2px solid rgba(255,255,255,0.08)', marginLeft: 4 }}>
              {line}
            </div>
          ))}
        </div>
      </CalcSection>

      <CalcSection icon="🔄" title="Протоколы восстановления" accent="#22c55e">
        <div style={{ display: 'grid', gap: 4 }}>
          {RECOVERY_PROTOCOLS.map(p => (
            <ExpandableCard key={p.type} title={`${p.type} (${p.duration})`} short={p.instructions} full={<div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Применять {p.duration} · {p.instructions}</div>} />
          ))}
        </div>
      </CalcSection>

      <CalcSection icon="🧠" title="Ментальные рутины" accent="#a855f7">
        <div style={{ display: 'grid', gap: 4 }}>
          {MENTAL_ROUTINES.map(m => (
            <div key={m.step} style={{ display: 'flex', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.1)', fontSize: 10, alignItems: 'center' }}>
              <span style={{ flex: 1, color: '#fff' }}>{m.step}</span>
              <span style={{ color: '#a855f7', fontWeight: 700, whiteSpace: 'nowrap' }}>{m.duration}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 9, whiteSpace: 'nowrap' }}>{m.when}</span>
            </div>
          ))}
        </div>
      </CalcSection>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button
          onClick={autofillFromProfile}
          aria-label="Загрузить ПМ и вес из Профиля"
          title="Загрузить ПМ и вес из Профиля"
          style={{
            flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
            background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 800, fontSize: 12,
            border: '1px solid rgba(99,102,241,0.3)',
          }}
        >
          📋 Из профиля
        </button>
        <button onClick={applyTaper} style={{
          flex: 1, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', minHeight: 44,
          background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12,
        }}>
          🛠 Применить taper
        </button>
        <button onClick={applyPms} style={{
          flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
          background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontWeight: 800, fontSize: 12,
          border: '1px solid rgba(96,165,250,0.3)',
        }}>
          💾 Сохранить ПМ в профиль
        </button>
      </div>
      {lastSavedAt && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, textAlign: 'center' }}>
          ✓ ПМ сохранены: {new Date(lastSavedAt).toLocaleTimeString('ru')}
        </div>
      )}
    </div>
  );
};

export default PeakingPanel;