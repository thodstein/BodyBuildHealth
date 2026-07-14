import React, { useMemo, useState } from 'react';
import {
  relativeStrengthFullReport,
  dotsScore,
  wilksScore,
  ipfGLPoints,
  allometricScore,
  liftRelativeStrength,
  type Sex,
} from '../../../engines/pro/relative-strength.engine';
import {
  PL_NORM_TABLES,
  classifyTotal,
  type Federation,
  type Discipline,
} from '../../../engines/pl-norms.engine';

import { applyToPlanner } from './planner-bridge';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.6)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const LABEL: React.CSSProperties = { fontSize: 11, color: DIM, marginBottom: 3 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' };

const LIFT_COLORS: Record<string, string> = { squat: '#ef4444', bench: '#3b82f6', deadlift: '#f59e0b' };
const LIFT_RU: Record<string, string> = { squat: 'Присед', bench: 'Жим', deadlift: 'Тяга' };
const CLASS_COLORS: Record<string, string> = {
  novice: 'rgba(255,255,255,0.4)',
  intermediate: '#60a5fa',
  advanced: '#a855f7',
  elite: '#f59e0b',
  world_class: '#ef4444',
};

const CLASS_MAX: Record<string, number> = {
  squat: 3.2, bench: 2.2, deadlift: 3.8, total: 10,
};

const FEDS: { id: Federation; label: string }[] = [
  { id: 'fpr_ipf', label: 'ФПР / IPF (с ДК)' },
  { id: 'wrpf_untested', label: 'WRPF / СПР (без ДК)' },
  { id: 'wrpf_tested', label: 'WRPF / СПР (с ДК)' },
];

export const RelativeStrengthCalcTab: React.FC = () => {
  const [sex, setSex] = useState<Sex>('male');
  const [bw, setBw] = useState<number>(88);
  const [squat, setSquat] = useState<number>(180);
  const [bench, setBench] = useState<number>(120);
  const [deadlift, setDeadlift] = useState<number>(220);

  // Нормативы
  const [fed, setFed] = useState<Federation>('wrpf_untested');
  const [disc, setDisc] = useState<Discipline>('total');

  const report = useMemo(() => relativeStrengthFullReport(squat, bench, deadlift, bw, sex), [squat, bench, deadlift, bw, sex]);
  const total = squat + bench + deadlift;

  // Per-lift RS bars
  const liftsRs = useMemo(() => [
    { key: 'squat', value: squat, rs: liftRelativeStrength(squat, bw) },
    { key: 'bench', value: bench, rs: liftRelativeStrength(bench, bw) },
    { key: 'deadlift', value: deadlift, rs: liftRelativeStrength(deadlift, bw) },
  ], [squat, bench, deadlift, bw]);

  // Нормативы по весовой категории
  const normTable = useMemo(() => PL_NORM_TABLES.find(t => t.federation === fed && t.discipline === disc), [fed, disc]);
  const classif = useMemo(() => normTable ? classifyTotal(normTable, bw, total) : null, [normTable, bw, total]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>🏋️ Калькулятор «сила / масса тела»</div>
      <div style={{ fontSize: 12, color: DIM, marginBottom: 12, lineHeight: 1.5 }}>
        Относительная сила = результат (кг) / собственный вес (кг). Показывает, сколько килограммов на каждый килограмм вашего веса.
        Сравнение с нормативами по весовой категории (ФПР/IPF, WRPF/СПР).
      </div>

      {/* Ввод данных */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 10 }}>📝 Ваши показатели</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <PopupNumber label="Присед, кг" value={squat} min={0} suffix=" кг" onChange={v => setSquat(Math.max(0, v || 0))} />
          <PopupNumber label="Жим лёжа, кг" value={bench} min={0} suffix=" кг" onChange={v => setBench(Math.max(0, v || 0))} />
          <PopupNumber label="Тяга, кг" value={deadlift} min={0} suffix=" кг" onChange={v => setDeadlift(Math.max(0, v || 0))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
          <PopupNumber label="Вес тела, кг" value={bw} min={30} suffix=" кг" onChange={v => setBw(Math.max(30, v || 1))} />
          <PopupSelect label="Пол" value={sex} options={[{ id: 'male', label: 'Мужчина' }, { id: 'female', label: 'Женщина' }]} onChange={v => setSex(v as Sex)} />
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={LABEL}>Тотал</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: ACCENT }}>{total}<span style={{ fontSize: 12, fontWeight: 400, color: DIM }}> кг</span></div>
          </div>
        </div>
      </div>

      {/* Per-lift относительная сила с барами */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📊 Относительная сила по движениям</div>
        {liftsRs.map(l => {
          const cls = report.lifts[l.key as 'squat' | 'bench' | 'deadlift'];
          const maxVal = CLASS_MAX[l.key] || 3;
          const barPct = Math.min(100, (l.rs / maxVal) * 100);
          const clr = LIFT_COLORS[l.key] || '#fff';
          return (
            <div key={l.key} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{LIFT_RU[l.key]}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{l.rs}× <span style={{ color: CLASS_COLORS[cls.class] || DIM, fontSize: 10 }}>({cls.label})</span></span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${barPct}%`, borderRadius: 4, background: `linear-gradient(90deg, ${clr}88, ${clr})`, transition: 'width 0.3s' }} />
                {/* Маркеры классов */}
                {CLASS_COLORS && Object.entries(CLASS_COLORS).map(([clsKey, _]) => {
                  const thr = (() => {
                    if (l.key === 'squat') return { novice: 0, intermediate: 1.5, advanced: 2.0, elite: 2.5, world_class: 3.0 };
                    if (l.key === 'bench') return { novice: 0, intermediate: 1.0, advanced: 1.3, elite: 1.6, world_class: 2.0 };
                    return { novice: 0, intermediate: 2.0, advanced: 2.5, elite: 3.0, world_class: 3.5 };
                  })();
                  const pct = (thr[clsKey as keyof typeof thr] / maxVal) * 100;
                  if (pct <= 0 || pct >= 100) return null;
                  return <div key={clsKey} style={{ position: 'absolute', left: `${pct}%`, top: 0, width: 1, height: '100%', background: 'rgba(255,255,255,0.25)' }} />;
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Коэффициенты тотала */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>🏆 Коэффициенты относительной силы (тотал)</div>
        <div style={ROW}><span style={{ color: DIM }}>Относительная сила (тотал/bw)</span><b style={{ color: '#fff' }}>{report.relative}× <span style={{ color: CLASS_COLORS[report.classification.class], fontSize: 10 }}>{report.classification.label}</span></b></div>
        <div style={ROW}><span style={{ color: DIM }}>DOTS (IPF 2019)</span><b style={{ color: ACCENT }}>{report.dots}</b></div>
        <div style={ROW}><span style={{ color: DIM }}>Wilks (IPF до 2019)</span><b style={{ color: '#fff' }}>{report.wilks}</b></div>
        <div style={ROW}><span style={{ color: DIM }}>IPF GL Points</span><b style={{ color: '#fff' }}>{report.ipfGL}</b></div>
        <div style={ROW}><span style={{ color: DIM }}>Allometric (×bw<sup>⅔</sup>)</span><b style={{ color: '#fff' }}>{report.allometric}</b></div>
      </div>

      {/* Сравнение с нормативами по весовой категории */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📋 Сравнение с разрядными нормативами</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <PopupSelect label="Федерация" value={fed} options={FEDS.map(f => ({ id: f.id, label: f.label }))} onChange={v => { setFed(v as Federation); setDisc('total'); }} />
          <PopupSelect label="Дисциплина" value={disc} options={([['total', 'Троеборье'], ['bench', 'Жим лёжа'], ['deadlift', 'Становая тяга'], ['squat', 'Приседания']] as const).filter(([id]) => fed === 'fpr_ipf' ? id === 'total' : true).map(([id, label]) => ({ id, label }))} onChange={v => setDisc(v as Discipline)} />
        </div>
        {classif && (
          <>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.2)', textAlign: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: DIM }}>Категория: {classif.category.label} · тотал {total} кг</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: classif.achievedRank ? '#f59e0b' : DIM }}>{classif.achievedLabel}</div>
              {classif.kgToNext > 0 && classif.nextRank && (
                <div style={{ fontSize: 11, color: DIM }}>До {classif.nextLabel}: <b style={{ color: '#f59e0b' }}>+{classif.kgToNext} кг</b></div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {classif.allRanks.map(r => (
                <div key={r.key} style={{ flex: 1, minWidth: 60, padding: '6px 8px', borderRadius: 8, textAlign: 'center', background: r.achieved ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', border: '1px solid ' + (r.achieved ? 'rgba(0,230,138,0.3)' : 'rgba(255,255,255,0.05)' ) }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: r.achieved ? ACCENT : DIM }}>{r.achieved ? '✓ ' : ''}{r.label}</div>
                  <div style={{ fontSize: 10, marginTop: 2, color: r.achieved ? '#fff' : DIM }}>{r.threshold} кг</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Шкала уровней */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 700, color: DIM, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Уровни относительной силы (мужчины)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 4 }}>
          {[
            { cls: 'novice', label: 'Новичок', color: 'rgba(255,255,255,0.3)', sq: '<1.5', be: '<1.0', dl: '<2.0' },
            { cls: 'intermediate', label: 'Средний', color: '#60a5fa', sq: '1.5-2.0', be: '1.0-1.3', dl: '2.0-2.5' },
            { cls: 'advanced', label: 'Опытный', color: '#a855f7', sq: '2.0-2.5', be: '1.3-1.6', dl: '2.5-3.0' },
            { cls: 'elite', label: 'Элита', color: '#f59e0b', sq: '2.5-3.0', be: '1.6-2.0', dl: '3.0-3.5' },
            { cls: 'world_class', label: 'Мир. класс', color: '#ef4444', sq: '≥3.0', be: '≥2.0', dl: '≥3.5' },
          ].map(lvl => (
            <div key={lvl.cls} style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: report.classification.class === lvl.cls ? '1px solid ' + lvl.color : '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: lvl.color, marginBottom: 2 }}>{lvl.label}</div>
              <div style={{ fontSize: 10, color: DIM, lineHeight: 1.35 }}>П {lvl.sq}<br />Ж {lvl.be}<br />Т {lvl.dl}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: DIM, marginTop: 16, lineHeight: 1.5 }}>
        Формулы: <b>Wilks</b> — классический коэффициент IPF (до 2019). <b>DOTS</b> — актуальный коэффициент IPF (с 2019).
        <b>IPF GL</b> — GoodLift points. <b>Allometric</b> — тотал / bw<sup>⅔</sup>. <b>Относительная</b> — тотал / bw.
        Нормативы: мужчины, RAW. Источник: спецификация 2026.
      </div>
<div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Определить слабейшее движение по относительной силе и применить как слабую группу к планировщику (приоритет объёма + ↓RIR).</div>
        <button onClick={() => { const weak = liftsRs.reduce((a, b) => b.rs < a.rs ? b : a, liftsRs[0]); const g = weak.key === 'squat' ? 'legs' : weak.key === 'bench' ? 'chest' : 'back'; const ru = weak.key === 'squat' ? 'Присед→ноги' : weak.key === 'bench' ? 'Жим→грудь' : 'Тяга→спина'; applyToPlanner({ kind: 'weakpoints', label: 'Слабейшая группа: ' + ru, data: { groups: [g], lift: weak.key } }); }} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Слабейшая группа → планировщик</button>
      </div>
    </div>
  );
};

export default React.memo(RelativeStrengthCalcTab);
