/**
 * VBTCalculator.tsx — VBT (Velocity-Based Training) калькулятор.
 *assessment by velocity → %1RM, target weight by intent, force-velocity curve,
 * zones of intensity, 1RM estimation from submax set, session log, export.
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  predictPercentage, predictTargetWeight, getRecommendedVelocity,
  VBTIntent, LIFT_VBT_PROFILES, INTENT_VELOCITY_RANGES,
} from '../../../engines/vbt-engine';
import { PopupNumber, PopupSelect, ExpandableCard } from './TrainingPopups';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.45 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.8)' };
const BTN: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: `1px solid ${ACCENT}33`, background: `${ACCENT}0d`, color: ACCENT, cursor: 'pointer', fontWeight: 600, fontSize: 11 };

type SessionEntry = {
  id: number;
  date: string;
  lift: string;
  intent: string;
  velocity: number;
  oneRM: number;
  predictedPct: number;
  predictedWeight: number;
  targetWeight: number;
};

const ZONES = [
  { label: 'Сила (95-100%)',  vMin: 0.10, vMax: 0.30, color: '#ef4444' },
  { label: 'Сила/мощность (80-95%)',  vMin: 0.30, vMax: 0.50, color: '#f59e0b' },
  { label: 'Гипертрофия (70-80%)',  vMin: 0.50, vMax: 0.75, color: '#22c55e' },
  { label: 'Мощность (40-70%)',  vMin: 0.75, vMax: 1.00, color: '#3b82f6' },
  { label: 'Скорость (0-40%)',  vMin: 1.00, vMax: 1.50, color: '#a855f7' },
];

export const VBTCalculator: React.FC = () => {
  const [oneRM, setOneRM] = useState<number>(100);
  const [currentVelocity, setCurrentVelocity] = useState<number>(0.5);
  const [lift, setLift] = useState<string>('squat');
  const [intent, setIntent] = useState<VBTIntent>('hypertrophy');

  // 1RM estimation from submax set
  const [submaxWeight, setSubmaxWeight] = useState<number>(0);
  const [submaxVelocity, setSubmaxVelocity] = useState<number>(0);

  // Session log
  const [entries, setEntries] = useState<SessionEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_vbt_log') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem('he_vbt_log', JSON.stringify(entries.slice(0, 50))); } catch { /* ignore */ }
  }, [entries]);

  const predictedPct = useMemo(() => predictPercentage(currentVelocity, lift), [currentVelocity, lift]);
  const targetVelocity = useMemo(() => getRecommendedVelocity(intent).typical, [intent]);
  const targetWeight = useMemo(() => predictTargetWeight(oneRM, targetVelocity, lift), [oneRM, targetVelocity, lift]);
  const recRange = useMemo(() => getRecommendedVelocity(intent), [intent]);

  // 1RM estimation from submax set
  const estimated1RM = useMemo(() => {
    if (submaxWeight <= 0 || submaxVelocity <= 0) return null;
    const pct = predictPercentage(submaxVelocity, lift);
    if (pct <= 0) return null;
    return Math.round(submaxWeight / pct);
  }, [submaxWeight, submaxVelocity, lift]);

  // Identify current zone
  const currentZone = useMemo(() => ZONES.find(z => currentVelocity >= z.vMin && currentVelocity < z.vMax) || ZONES[ZONES.length - 1], [currentVelocity]);

  // F-V curve points (0..1.5 m/s) → %1RM
  const fvPoints = useMemo(() => {
    const profile = LIFT_VBT_PROFILES[lift] || LIFT_VBT_PROFILES.default;
    const pts: { v: number; pct: number }[] = [];
    for (let v = 0.1; v <= 1.5; v += 0.05) {
      const p = predictPercentage(v, lift);
      if (p > 0.01) pts.push({ v, pct: p });
    }
    return pts;
  }, [lift]);

  // Save session
  const saveEntry = () => {
    const e: SessionEntry = {
      id: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      lift, intent,
      velocity: currentVelocity,
      oneRM,
      predictedPct,
      predictedWeight: Math.round(oneRM * predictedPct),
      targetWeight,
    };
    setEntries(prev => [e, ...prev].slice(0, 50));
  };

  // Export to text
  const exportText = () => {
    const lines: string[] = [];
    lines.push('=== VBT Калькулятор — Отчёт ===');
    lines.push(`Дата: ${new Date().toLocaleDateString('ru-RU')}`);
    lines.push(`Упражнение: ${lift} | Цель: ${intent}`);
    lines.push(`1ПМ: ${oneRM} кг | Текущая скорость: ${currentVelocity} м/с`);
    lines.push(`Прогноз %1RM: ${(predictedPct * 100).toFixed(1)}% (${Math.round(oneRM * predictedPct)} кг)`);
    lines.push(`Целевая скорость (${intent}): ${targetVelocity} м/с [${recRange.min}—${recRange.max}]`);
    lines.push(`Рекомендуемый вес: ${targetWeight} кг`);
    if (estimated1RM) {
      lines.push(`Оценка 1ПМ из субмакса: ${submaxWeight} кг @ ${submaxVelocity} м/с → ${estimated1RM} кг`);
    }
    if (entries.length > 0) {
      lines.push('');
      lines.push('=== Журнал сессий ===');
      entries.forEach((e, i) => {
        lines.push(`${i + 1}. ${e.date} | ${e.lift} | ${e.intent} | v=${e.velocity} м/с | %1RM=${(e.predictedPct * 100).toFixed(0)}% | вес=${e.predictedWeight} кг`);
      });
    }
    const text = lines.join('\n');
    navigator.clipboard?.writeText(text).then(() => { /* success */ }).catch(() => { /* ignore */ });
  };

  // SVG F-V curve
  const svgW = 320, svgH = 140, pad = 30;
  const vMax = 1.5, pctMax = 1.0;
  const toX = (v: number) => pad + (v / vMax) * (svgW - pad * 2);
  const toY = (p: number) => svgH - pad - (p / pctMax) * (svgH - pad * 2);

  // Intent zone on F-V chart
  const intentZone = useMemo(() => {
    const r = getRecommendedVelocity(intent);
    return { x1: toX(r.min), x2: toX(r.max) };
  }, [intent]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <PopupNumber label="1ПМ (кг)" value={oneRM} min={0} max={1000} suffix=" кг" hint="Ваш текущий максимальный вес на 1 повторение." onChange={setOneRM} />
        <PopupNumber label="Текущая скорость" value={currentVelocity} min={0.05} max={2.0} step={0.01} suffix=" м/с" hint="Средняя концентрическая скорость последнего повторения." onChange={setCurrentVelocity} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <PopupSelect
          label="Упражнение"
          value={lift}
          options={[
            { id: 'squat', label: 'Присед' },
            { id: 'bench', label: 'Жим' },
            { id: 'deadlift', label: 'Тяга' },
            { id: 'default', label: 'Другое' },
          ]}
          onChange={setLift}
        />
        <PopupSelect
          label="Цель (Intent)"
          value={intent}
          options={[
            { id: 'strength', label: 'Сила' },
            { id: 'hypertrophy', label: 'Гипертрофия' },
            { id: 'power', label: 'Мощность' },
            { id: 'endurance', label: 'Выносливость' },
          ]}
          onChange={v => setIntent(v as VBTIntent)}
        />
      </div>

      {/* Analysis card */}
      <div style={CARD}>
        <div style={H}>🎯 Анализ текущей скорости</div>
        <div style={ROW}><span>Прогноз %1RM:</span><span style={{ color: ACCENT, fontWeight: 700 }}>{(predictedPct * 100).toFixed(1)}%</span></div>
        <div style={ROW}><span>Прогноз веса:</span><span style={{ color: ACCENT, fontWeight: 700 }}>{Math.round(oneRM * predictedPct)} кг</span></div>
        <div style={ROW}><span>Зона интенсивности:</span><span style={{ color: currentZone.color, fontWeight: 700 }}>{currentZone.label}</span></div>
        <div style={{ ...SMALL, marginTop: 6 }}>
          На данной скорости {predictedPct < 0.5 ? 'вы работаете в режиме гипертрофии/мощности' : 'вы работаете близко к отказу/максимуму'}.
        </div>
      </div>

      {/* Target card */}
      <div style={CARD}>
        <div style={H}>🚀 Целевой расчет (по цели)</div>
        <div style={ROW}><span>Целевая скорость:</span><span style={{ color: ACCENT, fontWeight: 700 }}>{targetVelocity} м/с</span></div>
        <div style={ROW}><span>Рекомендуемый вес:</span><span style={{ color: ACCENT, fontWeight: 700 }}>{targetWeight} кг</span></div>
        <div style={ROW}><span>Диапазон скорости:</span><span>{recRange.min} — {recRange.max} м/с</span></div>
        <div style={{ ...SMALL, marginTop: 6 }}>
          Для {intent === 'strength' ? 'развития силы' : intent === 'hypertrophy' ? 'максимального роста' : 'пиковой мощности'} стремитесь к указанному весу, чтобы поддерживать целевую скорость.
        </div>
      </div>

      {/* F-V Curve SVG */}
      <div style={CARD}>
        <div style={H}>📊 Кривая сила-скорость ({lift})</div>
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ overflow: 'visible' }}>
          {/* Intent zone */}
          <rect x={intentZone.x1} y={pad} width={intentZone.x2 - intentZone.x1} height={svgH - pad * 2} fill={`${ACCENT}10`} />
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map(p => (
            <g key={p}>
              <line x1={pad} y1={toY(p)} x2={svgW - pad} y2={toY(p)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <text x={pad - 4} y={toY(p) + 3} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize={7}>{Math.round(p * 100)}%</text>
            </g>
          ))}
          {[0, 0.5, 1.0, 1.5].map(v => (
            <g key={v}>
              <line x1={toX(v)} y1={pad} x2={toX(v)} y2={svgH - pad} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <text x={toX(v)} y={svgH - pad + 12} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={7}>{v.toFixed(1)}</text>
            </g>
          ))}
          {/* Zone bands */}
          {ZONES.map((z, i) => (
            <rect key={i} x={toX(z.vMin)} y={pad} width={toX(z.vMax) - toX(z.vMin)} height={svgH - pad * 2} fill={`${z.color}08`} />
          ))}
          {/* F-V curve */}
          <path
            d={fvPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.v)} ${toY(p.pct)}`).join(' ')}
            fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round"
          />
          {/* Current velocity marker */}
          <line x1={toX(currentVelocity)} y1={pad} x2={toX(currentVelocity)} y2={svgH - pad} stroke={currentZone.color} strokeWidth={1.5} strokeDasharray="3,3" />
          <circle cx={toX(currentVelocity)} cy={toY(predictedPct)} r={4} fill={currentZone.color} stroke="#fff" strokeWidth={1} />
          {/* Target velocity marker */}
          <circle cx={toX(targetVelocity)} cy={toY(predictPercentage(targetVelocity, lift))} r={3} fill={ACCENT} stroke="#fff" strokeWidth={1} />
          {/* Axis labels */}
          <text x={svgW / 2} y={svgH - 2} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={8}>Скорость (м/с)</text>
          <text x={8} y={svgH / 2} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={8} transform={`rotate(-90, 8, ${svgH / 2})`}>%1RM</text>
        </svg>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {ZONES.map(z => (
            <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: z.color }} />
              {z.label}
            </div>
          ))}
        </div>
      </div>

      {/* 1RM Estimation */}
      <ExpandableCard title="📐 Оценка 1ПМ из субмаксимального подхода" accent={ACCENT} short="Оценить 1ПМ из разминочного/подводящего веса и скорости">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <PopupNumber label="Вес на грифе (кг)" value={submaxWeight} min={0} max={1000} suffix=" кг" hint="Вес субмаксимального подхода" onChange={setSubmaxWeight} />
          <PopupNumber label="Скорость (м/с)" value={submaxVelocity} min={0} max={2} step={0.01} suffix=" м/с" hint="Измеренная концентрическая скорость" onChange={setSubmaxVelocity} />
        </div>
        {estimated1RM ? (
          <div style={{ ...CARD, border: `1px solid ${ACCENT}33` }}>
            <div style={ROW}><span>Прогноз %1RM:</span><span style={{ color: ACCENT, fontWeight: 700 }}>{(predictPercentage(submaxVelocity, lift) * 100).toFixed(1)}%</span></div>
            <div style={ROW}><span>Оценка 1ПМ:</span><span style={{ color: ACCENT, fontWeight: 800, fontSize: 14 }}>{estimated1RM} кг</span></div>
            <div style={{ ...SMALL, marginTop: 4 }}>
              Формула: 1ПМ = вес / %1RM(скорость). Точность зависит от стабильности скорости и техники.
            </div>
            <button onClick={() => setOneRM(estimated1RM)} style={{ ...BTN, marginTop: 6 }}>Использовать как 1ПМ</button>
          </div>
        ) : (
          <div style={SMALL}>Введите вес подхода и скорость для оценки 1ПМ.</div>
        )}
      </ExpandableCard>

      {/* Session log */}
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={H}>📓 Журнал сессий ({entries.length})</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={saveEntry} style={BTN}>＋ Запись</button>
            <button onClick={exportText} style={BTN}>📋 Экспорт</button>
          </div>
        </div>
        {entries.length === 0 ? (
          <div style={SMALL}>Нет записей. Нажмите «＋ Запись» для сохранения текущих параметров.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {entries.slice(0, 15).map(e => (
              <div key={e.id} style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{e.date} · {e.lift} · {e.intent}</span>
                  <button onClick={() => setEntries(prev => prev.filter(x => x.id !== e.id))} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 9 }}>✕</button>
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>v={e.velocity} м/с · %1RM={(e.predictedPct * 100).toFixed(0)}% · вес={e.predictedWeight} кг · цель={e.targetWeight} кг</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VBTCalculator;