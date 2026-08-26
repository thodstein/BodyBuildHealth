/**
 * MethodologyEncyclopedia.tsx — энциклопедия тренировочных методик по категориям
 * (Периодизация, Прогрессия, Интенсивность, Техника, Объём, Частота, Специализация)
 * с подробным описанием и кнопкой «Применить к планировщику».
 */
import React, { useMemo, useState } from 'react';
import { getTrainingMethods } from '../../../engines/training-methodology.engine';
import { ExpandableCard } from '../SRCBBScreen_parts/TrainingPopups';
import { applyToPlanner } from './planner-bridge';
import ConjugateDesigner from './ConjugateDesigner';

const CAT: { id: string; label: string; icon: string; hint: string }[] = [
  { id: 'periodization', label: 'Периодизация', icon: '🗓️', hint: 'как менять объём/интенсивность по неделям' },
  { id: 'progression', label: 'Прогрессия', icon: '📈', hint: 'как расти без плато' },
  { id: 'intensity', label: 'Интенсивность', icon: '🔥', hint: 'дроп-сеты, кластеры, отдых-пауза' },
  { id: 'technique', label: 'Техника', icon: '🎯', hint: 'темп, паузы, 1.5 повтора' },
  { id: 'volume', label: 'Объём', icon: '📦', hint: 'MEV/MAV/MRV — сколько сетов нужно' },
  { id: 'frequency', label: 'Частота', icon: '🔁', hint: 'сколько раз в неделю группу' },
  { id: 'specialization', label: 'Специализация', icon: '🎯', hint: 'как подтянуть отстающую' },
  { id: 'recovery', label: 'Восстановление', icon: '🔄', hint: 'делод, сон, ACWR' },
  { id: 'mobility', label: 'Мобильность', icon: '🤸', hint: 'разминка и подвижность' },
  { id: 'mindset', label: 'Психология', icon: '🧠', hint: 'фокус и связь мозг-мышца' },
];

const CAT_LABEL: Record<string, string> = {
  periodization: 'Периодизация', progression: 'Прогрессия', intensity: 'Интенсивность',
  technique: 'Техника', volume: 'Объём', frequency: 'Частота', specialization: 'Специализация',
  recovery: 'Восстановление', mobility: 'Мобильность', mindset: 'Психология',
};

const EV_COLOR: Record<string, string> = { A: '#22c55e', B: '#eab308', C: '#f97316' };
const EV_LABEL: Record<string, string> = { A: 'доказательность A', B: 'доказательность B', C: 'доказательность C' };

const HUMAN_TIP: Record<string, string> = {
  periodization: '💡 Без калькулятора: выберите 1 схему волн (напр. DUP: тяж/лёг) и держите её 4 недели — прогресс придёт от постоянства, не от расчётов.',
  progression: '💡 Двойная прогрессия: растите повторами до верха диапазона (8→12), затем +2.5 кг и снова с низа. Просто и работает без формул.',
  intensity: '💡 Суперсеты — для памп-дня: грудь+спина без отдыха экономят 20 мин. Дроп-сет — только на последнем подходе изоляции.',
  technique: '💡 Темп 3-1-1-0 для гипертрофии, 2-1-1-0 для силы. Пауза 1с внизу убирает читинг — почувствуете мышцу сразу.',
  volume: '💡 MEV — минимум для роста (6-8 сетов), MRV — потолок восстановления (15-22). Держитесь в середине, не гонитесь за максимумом.',
  frequency: '💡 Натуральным — 2×/нед на группу лучше 1×. Разделите объём на 2 дня: тяжёлый + памп = меньше усталости, больше роста.',
  specialization: '💡 Отстающую — 1.3× объёма, но за счёт других (не + сверху). Через 6 недель верните баланс.',
  recovery: '💡 Делод — не отдых, а −30% объёма с тем же весом. Сон 7-9ч и 10к шагов восстанавливают лучше добавок.',
  mobility: '💡 5 мин разминки: бар×15 → 50%×10 → 70%×5 → рабочий. Суставы скажут спасибо.',
  mindset: '💡 Mind-muscle: 2с пауза в пике сокращения ×3 повтора в начале = лучшая связь без веса.',
};
const BB_HINT: Record<string, string> = {
  intensity: '🏋️ Из BB-авто: дроп-сет на изоляции груди, мио-репы на ногах, рест-пауза на руках — ставьте как добивку, не как базу.',
  volume: '📊 Из BB-авто: фидер-сеты (2 лёгких подхода отстающей в день другой группы) — добавляют объём без перегруза.',
  frequency: '🔁 Из BB-авто: специализация 2×/нед — целевая мышца в оба дня, остальные — MEV.',
  progression: '📈 Из интеллект-тренировок: если RIR падает на 2 за неделю — снизьте вес 5%, это не слабость, а защита от перетрена (ACWR).',
};

export const MethodologyEncyclopedia: React.FC = () => {
  const methods = useMemo(() => getTrainingMethods(), []);
  const [cat, setCat] = useState<string>('specialization');
  const [applied, setApplied] = useState<Record<string, string>>({});
  const list = methods.filter(m => m.category === cat);

  const handleApply = (m: { name: string; category: string }) => {
    applyToPlanner({ kind: 'methodology', label: m.name + ' (' + (CAT_LABEL[m.category] || m.category) + ')', data: { methodName: m.name, category: m.category } });
    setApplied(p => ({ ...p, [m.category]: m.name }));
    setTimeout(() => setApplied(p => { const n = { ...p }; delete n[m.category]; return n; }), 3000);
  };

  return (
    <div style={{ background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 12, margin: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '0 0 4px' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>🧠 Энциклопедия методик</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '2px 8px' }}>карточки-кнопки · человеческие пояснения · без калькулятора</span>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)', lineHeight: 1.4, marginBottom: 8 }}>Нажмите категорию-карточку ниже — увидите методики с подсказками «как применить руками». BB-фичи (дроп-сеты, фидеры, DUP) — как карточки-советы, не как расчёты.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 8, marginBottom: 10 }}>
        {CAT.map(c => {
          const on = cat === c.id;
          const cnt = methods.filter(m => m.category === c.id).length;
          return (
            <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={on} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 11px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
              border: on ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
              background: on ? 'rgba(0,230,138,0.12)' : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
              boxShadow: on ? '0 4px 14px rgba(0,230,138,0.18)' : '0 2px 8px rgba(0,0,0,0.16)',
            }}>
              <span style={{ fontSize: 13 }}>{c.icon} <b style={{ color: on ? '#00e68a' : '#fff', fontSize: 11 }}>{c.label}</b> <span style={{ fontSize: 10, color: on ? 'rgba(0,230,138,0.85)' : 'rgba(255,255,255,0.45)' }}>{cnt}</span></span>
              <span style={{ fontSize: 10, color: on ? 'rgba(0,230,138,0.75)' : 'rgba(255,255,255,0.50)', lineHeight: 1.25 }}>{c.hint}</span>
            </button>
          );
        })}
      </div>
      {/* Человеческая подсказка категории + BB-фичи без калькулятора */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.18)', fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>{HUMAN_TIP[cat] ?? ''}</div>
        {BB_HINT[cat] && <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.18)', fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>{BB_HINT[cat]}</div>}
      </div>
      {list.length === 0 && <div style={{ fontSize: 11, color: '#fff' }}>Нет методов в категории.</div>}
      {list.map((m, i) => (
        <ExpandableCard key={i} title={m.name} icon="" accent={EV_COLOR[m.evidenceLevel] || '#00e68a'}
          short={<><span style={{ fontSize: 10, color: EV_COLOR[m.evidenceLevel], fontWeight: 700, marginRight: 6 }}>{EV_LABEL[m.evidenceLevel]}</span><span style={{ fontSize: 11, color: '#fff' }}>{m.description}</span> <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>· нажмите для деталей и карточки-применения</span></>}
          full={<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.12)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#00e68a', marginBottom: 2 }}>⚙️ Как работает</div>
                <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.45 }}>{m.howItWorks}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 2 }}>👥 Кому подходит</div>
                <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.45 }}>{m.bestFor}</div>
              </div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 2 }}>📌 Пример без калькулятора</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>{m.example}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>Применяйте как карточку-правило: один приём → одна неделя, не смешивайте 3 методики сразу.</div>
            </div>
            {m.popularizedBy && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Популяризатор: {m.popularizedBy} · уровень доказательности {m.evidenceLevel}</div>}
            {m.caveats.length > 0 && <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.14)' }}><b style={{ color: '#f87171', fontSize: 11 }}>⚠️ Осторожно:</b> <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>{m.caveats.map((c, j) => <li key={j}>{c}</li>)}</ul></div>}
            {m.name.toLowerCase().includes('westside') ? (
              <div style={{ marginTop: 4, padding: 10, background: 'rgba(255,107,53,0.06)', borderRadius: 12, border: '1px solid rgba(255,107,53,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#ff6b35', marginBottom: 4 }}>⚡ Генератор конъюгата (Westside)</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)', marginBottom: 6 }}>Для продвинутых — ротация макс. усилий. Новичкам — начните с DUP или линейной.</div>
                <ConjugateDesigner />
              </div>
            ) : (
              <button onClick={() => handleApply(m)} style={{ marginTop: 2, padding: '10px 14px', borderRadius: 12, fontSize: 11, fontWeight: 800, cursor: 'pointer', border: applied[m.category] === m.name ? '1px solid #00e68a' : 'none', background: applied[m.category] === m.name ? 'rgba(0,230,138,0.14)' : 'linear-gradient(135deg,#00e68a,#00c853)', color: applied[m.category] === m.name ? '#00e68a' : '#06281c', transition: 'all 0.2s', width: '100%', boxShadow: applied[m.category] === m.name ? 'none' : '0 4px 12px rgba(0,230,138,0.22)' }}>
                {applied[m.category] === m.name ? '✅ Применена — смотрите подсказку в Редакторе' : '🃏 Применить как карточку-правило'}
              </button>
            )}
          </div>}
        />
      ))}
    </div>
  );
};

export default MethodologyEncyclopedia;
