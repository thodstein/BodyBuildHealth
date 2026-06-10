import React, { useState, useMemo } from 'react';
import { SYSTEM_NAMES_RU } from '../../../engines/risk-engine-v7-matrix';
import type { V7RiskResult } from '../../../engines/risk-engine-v7';
import { getRiskColor } from '../../../core/utils/risk-colors';
import { MECHANISM_NAMES } from '../../../engines/risk-engine-v7-matrix';
import { SYSTEM_MECHANISMS } from '../../../core/system-mechanisms';

const ORGAN_LABELS: Record<string, string> = {
  heart: 'Сердце', vessels: 'Сосуды', liver: 'Печень', kidney: 'Почки',
  blood: 'Кровь', endocrine: 'Эндокринная', metabolic: 'Метаболизм',
  ghigf: 'ГР/ИФР-1', ins_axis: 'Инсулин',
  musculoskeletal: 'Мышцы/ОДА', neuro_toxicity: 'Нейротоксичность',
  reproductive: 'Репродуктивная',
};
const V7_ORGAN_TO_SYSTEM: Record<string, string> = {
  heart: 'cardio', vessels: 'vessels', liver: 'hepatic', kidney: 'renal',
  blood: 'blood', endocrine: 'endocrine', metabolic: 'metabolic',
  ghigf: 'ghigf', ins_axis: 'ins_axis',
  musculoskeletal: 'musculoskeletal', neuro_toxicity: 'neuro_toxicity',
  reproductive: 'reproductive',
};
function getMechName(sysKey: string, mechIdx: number): string {
  const smKey = V7_ORGAN_TO_SYSTEM[sysKey] || sysKey;
  if (MECHANISM_NAMES[smKey]?.[mechIdx]) return MECHANISM_NAMES[smKey][mechIdx];
  const mechs = SYSTEM_MECHANISMS[smKey];
  if (mechs) { const f = mechs.find(m => m.num === mechIdx); if (f?.label) return f.label; }
  return '';
}
function hasValidMech(sysKey: string, mechIdx: number): boolean { return getMechName(sysKey, mechIdx) !== ''; }

// Anatomic SVG paths — organs properly positioned and scaled on a 280×540 canvas
const bodyW = 280, bodyH = 540, cx = bodyW / 2;
const buildPath = (template: (c: number) => string) => template(cx);
const organShapes: Record<string, string> = {
  neuro_toxicity: `M${cx-28},28 C${cx-38},24 ${cx-42},34 ${cx-36},40 C${cx-30},48 ${cx-18},50 C${cx-8},50 ${cx+0},46 ${cx+0},40 C${cx+0},46 ${cx+8},50 ${cx+18},50 C${cx+30},50 ${cx+38},48 ${cx+42},40 C${cx+48},34 ${cx+44},24 ${cx+34},28 C${cx+26},32 ${cx+18},36 ${cx+8},32 C${cx+4},30 ${cx-4},30 ${cx-8},32 C${cx-18},36 ${cx-26},32 ${cx-28},28 Z`,
  endocrine: `M${cx-6},68 C${cx-14},60 ${cx-20},72 ${cx-12},78 C${cx-4},84 ${cx+6},82 ${cx+10},78 C${cx+14},74 ${cx+22},72 ${cx+22},68 C${cx+22},62 ${cx+16},60 ${cx+10},60 C${cx+4},60 ${cx-0},62 ${cx-6},68 Z`,
  heart: `M${cx+6},108 C${cx-4},100 ${cx-8},90 ${cx+2},84 C${cx+12},78 ${cx+18},84 ${cx+20},90 C${cx+22},84 ${cx+30},78 ${cx+40},84 C${cx+50},90 ${cx+46},100 ${cx+36},108 C${cx+30},116 ${cx+20},130 ${cx+20},132 C${cx+20},130 ${cx+10},116 ${cx+6},108 Z`,
  ghigf: `M${cx-52},148 C${cx-60},142 ${cx-64},152 ${cx-56},158 C${cx-48},164 ${cx-38},162 ${cx-36},158 C${cx-34},152 ${cx-44},154 ${cx-52},148 Z`,
  liver: `M${cx+24},188 C${cx+48},184 ${cx+56},194 ${cx+54},206 L${cx+52},222 C${cx+50},238 ${cx+34},246 ${cx+18},240 L${cx+6},234 C${cx-4},228 ${cx+0},218 ${cx+8},212 C${cx+12},204 ${cx+16},192 ${cx+24},188 Z`,
  kidney: `M${cx-48},218 C${cx-60},214 ${cx-66},226 ${cx-62},238 C${cx-58},250 ${cx-42},252 ${cx-34},250 C${cx-26},248 ${cx-20},240 ${cx-24},228 C${cx-28},218 ${cx-36},222 ${cx-48},218 Z M${cx-22},220 C${cx-34},216 ${cx-40},228 ${cx-36},240 C${cx-32},252 ${cx-16},254 ${cx-8},252 C${cx-0},250 ${cx+6},242 ${cx+2},230 C${cx-2},220 ${cx-10},224 ${cx-22},220 Z`,
  metabolic: `M${cx+18},204 C${cx+8},200 ${cx+6},214 ${cx+14},218 C${cx+22},222 ${cx+34},220 ${cx+36},214 C${cx+38},208 ${cx+28},208 ${cx+18},204 Z`,
  ins_axis: `M${cx+36},210 C${cx+28},206 ${cx+24},218 ${cx+32},224 C${cx+40},230 ${cx+52},226 ${cx+50},218 C${cx+48},212 ${cx+44},214 ${cx+36},210 Z`,
  blood: `M${cx-68},232 Q${cx-44},220 ${cx-20},226 T${cx+22},224 T${cx+70},232 Q${cx+44},244 ${cx+20},240 T${cx-22},242 T${cx-68},232 Z`,
  musculoskeletal: `M${cx-76},275 L${cx-56},262 L${cx-36},275 L${cx-24},310 L${cx-30},355 L${cx-40},395 L${cx-34},440 L${cx-22},470 L${cx-16},485 C${cx-28},490 ${cx-46},484 ${cx-52},470 L${cx-58},440 L${cx-64},395 L${cx-70},355 L${cx-76},310 Z M${cx+16},275 L${cx+36},262 L${cx+56},275 L${cx+68},310 L${cx+62},355 L${cx+52},395 L${cx+58},440 L${cx+46},470 L${cx+40},485 C${cx+28},490 ${cx+16},484 ${cx+10},470 L${cx+16},440 L${cx+24},395 L${cx+30},355 L${cx+36},310 Z`,
  reproductive: `M${cx-28},326 C${cx-40},318 ${cx-46},332 ${cx-36},342 C${cx-26},352 ${cx-12},346 ${cx-10},338 C${cx-8},330 ${cx-16},334 ${cx-28},326 Z M${cx+6},326 C${cx-6},318 ${cx-12},332 ${cx-2},342 C${cx+8},352 ${cx+22},346 ${cx+24},338 C${cx+26},330 ${cx+18},334 ${cx+6},326 Z`,
  vessels: `M${cx-36},96 Q${cx-20},110 ${cx-28},132 Q${cx-36},156 ${cx-24},176 Q${cx-12},196 ${cx-20},216 Q${cx-28},236 ${cx-16},256 Q${cx-4},276 ${cx-12},296 Q${cx-20},316 ${cx-8},336 Q${cx+4},356 ${cx-4},376 Q${cx-12},396 ${cx+0},416 Q${cx+8},432 ${cx+4},448 Q${cx+0},464 ${cx+6},476 Q${cx+12},488 ${cx+18},476 Q${cx+22},464 ${cx+18},448 Q${cx+14},432 ${cx+22},416 Q${cx+30},396 ${cx+22},376 Q${cx+14},356 ${cx+26},336 Q${cx+38},316 ${cx+30},296 Q${cx+22},276 ${cx+34},256 Q${cx+46},236 ${cx+38},216 Q${cx+30},196 ${cx+42},176 Q${cx+54},156 ${cx+46},132 Q${cx+38},110 ${cx+54},96`,
};
// Muscular body outline
const bodyPath = `
  M${cx-82},72 C${cx-100},72 ${cx-112},82 ${cx-114},102 L${cx-114},114
  C${cx-114},126 ${cx-120},142 ${cx-136},156 L${cx-152},170 L${cx-146},182 L${cx-130},168
  C${cx-116},182 ${cx-118},198 ${cx-124},214 L${cx-114},224
  C${cx-106},246 ${cx-100},268 ${cx-96},288 L${cx-90},288
  L${cx-86},266 L${cx-80},318 L${cx-74},346
  L${cx-80},408 L${cx-76},450 L${cx-84},492 L${cx-78},530
  L${cx-28},530 L${cx-28},492 L${cx-34},450 L${cx-32},408
  L${cx-24},370 L${cx-12},408 L${cx-12},450 L${cx-10},492
  L${cx-6},530 L${cx+6},530 L${cx+10},492 L${cx+12},450
  L${cx+12},408 L${cx+24},370 L${cx+32},408 L${cx+34},450
  L${cx+28},492 L${cx+28},530 L${cx+78},530 L${cx+84},492
  L${cx+76},450 L${cx+80},408 L${cx+74},346 L${cx+80},318
  L${cx+86},266 L${cx+90},288 L${cx+96},288
  C${cx+100},268 ${cx+106},246 ${cx+114},224 L${cx+124},214
  C${cx+118},198 ${cx+116},182 ${cx+130},168 L${cx+146},182
  L${cx+152},170 L${cx+136},156 C${cx+120},142 ${cx+114},126 ${cx+114},114
  L${cx+114},102 C${cx+112},82 ${cx+100},72 ${cx+82},72 Z
`;

interface Props {
  result: V7RiskResult;
  mcEnabled: boolean;
  onToggleMC: () => void;
  organWeek: number;
  onWeekChange: (w: number) => void;
}

export const Risk3DModel: React.FC<Props> = ({ result, mcEnabled, onToggleMC, organWeek, onWeekChange }) => {
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const [riskMode, setRiskMode] = useState<'net' | 'raw' | 'delta'>('net');
  const { organSummary, globalRiskRaw, globalRiskNet, globalPEvent, weeklyOrganData = {}, weeklyGlobalData = [] } = result;

  const organKeys = Object.keys(organSummary).sort((a, b) => {
    const order = ['heart', 'vessels', 'liver', 'kidney', 'blood', 'endocrine', 'metabolic', 'ghigf', 'ins_axis', 'musculoskeletal', 'neuro_toxicity', 'reproductive'];
    return (order.indexOf(a) - order.indexOf(b));
  });

  const getOrganVal = (key: string): number => {
    if (organWeek > 0 && weeklyOrganData[key] && weeklyOrganData[key].length >= organWeek)
      return weeklyOrganData[key][organWeek - 1] ?? 0;
    return organSummary[key]?.meanS ?? 0;
  };
  const riskOpacity = (pct: number) => Math.max(0.4, Math.min(0.95, 0.4 + pct / 100 * 0.55));

  const displayRisk = riskMode === 'raw' ? globalRiskRaw : riskMode === 'delta' ? Math.max(0, globalRiskRaw - globalRiskNet) : globalRiskNet;
  const overallColor = getRiskColor(displayRisk);
  const overallLabel = displayRisk < 20 ? 'Низкий' : displayRisk < 40 ? 'Умеренный' : displayRisk < 60 ? 'Повышенный' : displayRisk < 80 ? 'Высокий' : 'Критический';

  const renderLabel = () => {
    if (!selectedOrgan) return null;
    const sd = organSummary[selectedOrgan];
    if (!sd) return null;
    const pct = Math.round(getOrganVal(selectedOrgan) * 100);
    return (
      <div style={{ padding: '8px 10px 6px', background: 'rgba(0,0,0,0.4)', borderRadius: 8, marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{ORGAN_LABELS[selectedOrgan] || selectedOrgan}</span>
          <span style={{ padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, color: '#fff', background: getRiskColor(pct) }}>{pct}%</span>
        </div>
        <div style={{ display: 'flex', gap: 6, fontSize: 10, color: 'var(--text-dim)' }}>
          <span>Острый: <b style={{ color: getRiskColor(Math.round((sd.acute??0)*100)) }}>{Math.round((sd.acute??0)*100)}%</b></span>
          <span>Хронич: <b style={{ color: getRiskColor(Math.round((sd.chronic??0)*100)) }}>{Math.round((sd.chronic??0)*100)}%</b></span>
          <span>Фиброз: <b style={{ color: getRiskColor(Math.round((sd.fibrosis??0)*100)) }}>{Math.round((sd.fibrosis??0)*100)}%</b></span>
        </div>
        {sd.mechanisms && Object.keys(sd.mechanisms).length > 0 && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 6, paddingTop: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#00e68a', marginBottom: 3 }}>Механизмы:</div>
            {Object.entries(sd.mechanisms).slice(0, 4).map(([idx, md]: [string, any]) => {
              const mi = Number(idx);
              if (!hasValidMech(selectedOrgan, mi)) return null;
              const nm = getMechName(selectedOrgan, mi);
              const mp = Math.round((md.P_net ?? md.p5 ?? 0) * 100);
              return <div key={mi} style={{ fontSize: 9, display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)' }}><span>{nm}</span><span style={{ color: getRiskColor(mp), fontWeight: 600 }}>{mp}%</span></div>;
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Controls */}
      <div className="card" style={{ marginBottom: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>🧍 Модель тела — органы</h3>
          <button onClick={onToggleMC} style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: mcEnabled ? 'rgba(139,92,246,0.2)' : 'var(--bg-secondary)',
            border: mcEnabled ? '1px solid #8b5cf6' : '1px solid var(--border)',
            color: mcEnabled ? '#8b5cf6' : 'var(--text-dim)',
          }}>{mcEnabled ? '🎲 MC' : '🎲 Детерм'}</button>
        </div>
        {/* Risk display method selector */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {(['net', 'raw', 'delta'] as const).map(m => (
            <button key={m} onClick={() => setRiskMode(m)} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: riskMode === m ? 700 : 400,
              cursor: 'pointer', border: riskMode === m ? '1px solid #00e68a' : '1px solid var(--border)',
              background: riskMode === m ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
              color: riskMode === m ? '#00e68a' : 'var(--text-dim)',
            }}>
              {m === 'net' ? 'Net (с поддержкой)' : m === 'raw' ? 'Raw (без поддержки)' : 'Δ Разница'}
            </button>
          ))}
        </div>
        {/* Week slider — range input */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Неделя: {organWeek === 0 ? 'Среднее за 12 нед' : `Нед ${organWeek}`}</span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button onClick={() => onWeekChange(0)} style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: organWeek === 0 ? 700 : 400, cursor: 'pointer',
                background: organWeek === 0 ? '#00e68a' : 'var(--bg-secondary)',
                border: organWeek === 0 ? '1px solid #00e68a' : '1px solid var(--border)',
                color: organWeek === 0 ? '#000' : 'var(--text-dim)',
              }}>∅ Среднее</button>
            </div>
          </div>
          <input type="range" min={0} max={12} value={organWeek} onChange={e => {
            const v = parseInt(e.target.value);
            onWeekChange(v);
          }} style={{ width: '100%', height: 4, accentColor: '#00e68a', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-dim)', marginTop: 1 }}>
            <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span><span>11</span><span>12</span>
          </div>
        </div>
        {organWeek > 0 && weeklyGlobalData[organWeek - 1] && (
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>Недельный raw: {Math.round(weeklyGlobalData[organWeek - 1]?.raw ?? 0)}%</div>
        )}
      </div>

      {/* SVG 3D body */}
      <div className="card" style={{ padding: '8px 6px', overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${bodyW} ${bodyH}`} style={{ width: '100%', maxWidth: bodyW, display: 'block', margin: '0 auto' }}>
          <defs>
            <filter id="s3_shadow"><feDropShadow dx="0" dy="3" stdDeviation="5" floodOpacity="0.4" /></filter>
            <filter id="s3_glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="s3_glow_s"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <linearGradient id="s3_body" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
              <stop offset="35%" stopColor="rgba(255,255,255,0.08)" />
              <stop offset="65%" stopColor="rgba(255,255,255,0.08)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
            </linearGradient>
            {/* Body muscle tone */}
            <radialGradient id="s3_muscle" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>

          {/* Glow */}
          <ellipse cx={cx} cy={270} rx={95} ry={210} fill="rgba(0,230,138,0.015)" filter="blur(30px)" />

          {/* Muscular body silhouette */}
          <path d={bodyPath} fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" filter="url(#s3_shadow)" />
          <path d={bodyPath} fill="url(#s3_body)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />

          {/* Arms */}
          <ellipse cx={cx - 98} cy={198} rx="13" ry="46" fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
          <ellipse cx={cx + 98} cy={198} rx="13" ry="46" fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />

          {/* Legs */}
          <ellipse cx={cx - 30} cy={462} rx="22" ry="70" fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
          <ellipse cx={cx + 30} cy={462} rx="22" ry="70" fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />

          {/* Head */}
          <ellipse cx={cx} cy={40} rx="32" ry="38" fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
          <ellipse cx={cx} cy={40} rx="30" ry="36" fill="url(#s3_muscle)" />

          {/* Neck */}
          <rect x={cx - 13} y={66} width={26} height={14} rx={5} fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />

          {/* Vessels (spine) — render behind organs */}
          <g opacity={0.3}>
            <path d={organShapes.vessels} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="4,3" />
          </g>

          {/* Organs — render in z-order from back to front: kidney, metabolic, ins_axis, blood, liver, ghigf, endocrine, heart, musculoskeletal, neuro, reproductive */}
          {['kidney', 'metabolic', 'ins_axis', 'blood', 'liver', 'ghigf', 'endocrine', 'heart', 'musculoskeletal', 'neuro_toxicity', 'reproductive'].filter(k => organKeys.includes(k)).map(okey => {
            const orgVal = getOrganVal(okey);
            const pct = Math.round(orgVal * 100);
            const isSel = selectedOrgan === okey;
            const color = getRiskColor(pct);
            const op = riskOpacity(pct);
            const path = organShapes[okey];
            if (!path) return null;
            const gradId = `g3_${okey}`;
            const hlColor = pct < 20 ? '#66ffb3' : pct < 40 ? '#fff066' : pct < 60 ? '#ffaa44' : pct < 80 ? '#ff6666' : '#ff3344';
            return (
              <g key={okey} onClick={() => setSelectedOrgan(isSel ? null : okey)} style={{ cursor: 'pointer' }}>
                <defs>
                  <radialGradient id={gradId} cx="35%" cy="30%" r="65%">
                    <stop offset="0%" stopColor={hlColor} stopOpacity={isSel ? 0.8 : 0.55} />
                    <stop offset="100%" stopColor={color} stopOpacity={op} />
                  </radialGradient>
                </defs>
                <path d={path} transform="translate(2,3)" fill="rgba(0,0,0,0.3)" opacity={0.5} filter="url(#s3_shadow)" />
                <path d={path} fill={`url(#${gradId})`} stroke={isSel ? '#fff' : 'rgba(255,255,255,0.2)'} strokeWidth={isSel ? 2 : 0.6} filter={isSel ? 'url(#s3_glow_s)' : pct > 40 ? 'url(#s3_glow)' : undefined} />
                {isSel && <text x={cx} y={14} fill="#fff" fontSize="9" fontWeight="700" textAnchor="middle" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{ORGAN_LABELS[okey]}: {pct}%</text>}
              </g>
            );
          })}

          {/* Body part labels */}
          <text x={cx} y={bodyH - 6} fill="var(--text-dim)" fontSize="6" textAnchor="middle">Модель тела — нажмите на орган</text>
          {/* Legend */}
          <g transform="translate(8, bodyH - 22)">
            <rect x={0} y={0} width={6} height={6} rx={1} fill="#22c55e" opacity={0.8} /><text x={8} y={5} fill="var(--text-dim)" fontSize="5">Низк</text>
            <rect x={30} y={0} width={6} height={6} rx={1} fill="#eab308" opacity={0.8} /><text x={38} y={5} fill="var(--text-dim)" fontSize="5">Сред</text>
            <rect x={60} y={0} width={6} height={6} rx={1} fill="#f97316" opacity={0.8} /><text x={68} y={5} fill="var(--text-dim)" fontSize="5">Выс</text>
            <rect x={90} y={0} width={6} height={6} rx={1} fill="#ef4444" opacity={0.8} /><text x={98} y={5} fill="var(--text-dim)" fontSize="5">Крит</text>
          </g>
        </svg>

        {renderLabel()}
      </div>

      {/* Overall risk bar */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Общий риск: <span style={{ color: overallColor }}>{Math.round(displayRisk)}%</span></span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{overallLabel}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 10 }}>
          <span>Raw: <b>{Math.round(globalRiskRaw)}%</b></span>
          <span>Net: <b style={{ color: getRiskColor(globalRiskNet) }}>{Math.round(globalRiskNet)}%</b></span>
          <span>Δ: <b>{Math.round(Math.max(0, globalRiskRaw - globalRiskNet))}%</b></span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 14, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, displayRisk)}%`, height: '100%', background: `linear-gradient(90deg, #22c55e, ${overallColor})`, borderRadius: 6, transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 8, color: 'var(--text-dim)' }}>
          <span>0%</span><span>25</span><span>50</span><span>75</span><span>100%</span>
        </div>
      </div>

      {/* Grid of all organs */}
      <div className="card">
        <h3 style={{ fontSize: 12, marginBottom: 6 }}>Все органы</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {organKeys.map(okey => {
            const pct = Math.round(getOrganVal(okey) * 100);
            const isSel = selectedOrgan === okey;
            return (
              <div key={okey} onClick={() => setSelectedOrgan(isSel ? null : okey)} style={{
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 6px',
                borderRadius: 5, background: isSel ? 'rgba(0,230,138,0.1)' : 'var(--bg-secondary)',
                border: isSel ? '1px solid #00e68a' : '1px solid transparent',
              }}>
                <span style={{ fontSize: 9, flex: 1, color: 'var(--text-dim)', fontWeight: isSel ? 600 : 400 }}>{ORGAN_LABELS[okey] || okey}</span>
                <div style={{ width: 30, background: 'rgba(255,255,255,0.08)', borderRadius: 2, height: 4 }}><div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: getRiskColor(pct), borderRadius: 2 }} /></div>
                <span style={{ fontSize: 9, fontWeight: 700, color: getRiskColor(pct), minWidth: 22, textAlign: 'right' }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};