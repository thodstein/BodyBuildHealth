// Вкладка «Риски (ТЗ)» — лабораторные маркеры для механизм-ориентированной модели
import React, { useState, useMemo, useEffect } from 'react';
import { calculateTzSpecRisk, type TzSpecResult, type TzSpecOrganResult } from '../../../engines/risk-engine-tz-spec';
import { useDataLink } from '../../../core/data-link';

const ACCENT = '#00e68a';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 16, background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10 };

// ── Лабораторные маркеры из таблицы T4 ──
const LAB_MARKERS_CONFIG: { code: string; name: string; unit: string; systems: string[]; normalRange: string }[] = [
  { code: 'LDL', name: 'ЛПНП', unit: 'ммоль/л', systems: ['cardio'], normalRange: '<2.6' },
  { code: 'HDL', name: 'ЛПВП', unit: 'ммоль/л', systems: ['cardio'], normalRange: '>1.0' },
  { code: 'TG', name: 'Триглицериды', unit: 'ммоль/л', systems: ['cardio'], normalRange: '<1.7' },
  { code: 'HCT', name: 'Гематокрит', unit: '%', systems: ['cardio', 'hematologic'], normalRange: '<48' },
  { code: 'HGB', name: 'Гемоглобин', unit: 'г/л', systems: ['cardio', 'hematologic'], normalRange: '130-170' },
  { code: 'ALT', name: 'АЛТ', unit: 'Ед/л', systems: ['hepatic'], normalRange: '<40' },
  { code: 'AST', name: 'АСТ', unit: 'Ед/л', systems: ['hepatic'], normalRange: '<40' },
  { code: 'GGT', name: 'ГГТ', unit: 'Ед/л', systems: ['hepatic'], normalRange: '<55' },
  { code: 'ALP', name: 'Щелочная фосфатаза', unit: 'Ед/л', systems: ['hepatic'], normalRange: '<150' },
  { code: 'BILIRUBIN', name: 'Билирубин общий', unit: 'мкмоль/л', systems: ['hepatic'], normalRange: '<21' },
  { code: 'CREATININE', name: 'Креатинин', unit: 'мкмоль/л', systems: ['renal'], normalRange: '60-110' },
  { code: 'eGFR', name: 'СКФ (eGFR)', unit: 'мл/мин', systems: ['renal'], normalRange: '>90' },
  { code: 'UACR', name: 'Альбумин/креатинин мочи', unit: 'мг/г', systems: ['renal'], normalRange: '<30' },
  { code: 'K', name: 'Калий (K+)', unit: 'ммоль/л', systems: ['cardio', 'renal', 'cns', 'hematologic'], normalRange: '3.5-5.0' },
  { code: 'Na', name: 'Натрий (Na+)', unit: 'ммоль/л', systems: ['cardio', 'renal', 'cns', 'hematologic'], normalRange: '135-145' },
  { code: 'GLU', name: 'Глюкоза', unit: 'ммоль/л', systems: ['cns', 'hematologic'], normalRange: '3.9-5.6' },
  { code: 'HbA1c', name: 'Гликированный гемоглобин', unit: '%', systems: ['hematologic'], normalRange: '<5.7' },
  { code: 'LH', name: 'Лютеинизирующий гормон', unit: 'МЕ/л', systems: ['reproductive'], normalRange: '1.5-8.0' },
  { code: 'FSH', name: 'Фолликулостимулирующий гормон', unit: 'МЕ/л', systems: ['reproductive'], normalRange: '1.5-8.0' },
  { code: 'TT', name: 'Тестостерон общий', unit: 'нмоль/л', systems: ['reproductive'], normalRange: '>12' },
  { code: 'E2', name: 'Эстрадиол', unit: 'пмоль/л', systems: ['reproductive'], normalRange: '40-160' },
  { code: 'PRL', name: 'Пролактин', unit: 'мМЕ/л', systems: ['cns', 'reproductive'], normalRange: '100-400' },
];

export const LabsTzRiskTab: React.FC = () => {
  const linked = useDataLink();
  const labs = linked.labs || [];

  const [labValues, setLabValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const l of labs) {
      const code = l.code || l.name;
      if (code) initial[code.toUpperCase()] = String(l.value);
    }
    return initial;
  });

  const [drugClass, setDrugClass] = useState<'aas' | 'gh' | 'insulin'>('aas');
  const [dose, setDose] = useState(500);
  const [duration, setDuration] = useState(12);
  const [result, setResult] = useState<TzSpecResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Авто-загрузка поддержки из калькулятора поддержки
  const [supportIds, setSupportIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const sr = JSON.parse(localStorage.getItem('he_support_risk') || 'null');
      if (sr && Array.isArray(sr.subs)) setSupportIds(sr.subs.map((id: string) => id.toLowerCase()));
    } catch {}
  }, []);

  const numLabValues = useMemo(() => {
    const n: Record<string, number> = {};
    for (const [k, v] of Object.entries(labValues)) {
      const parsed = parseFloat(v);
      if (!isNaN(parsed)) n[k] = parsed;
    }
    return n;
  }, [labValues]);

  const presentCount = LAB_MARKERS_CONFIG.filter(m => labValues[m.code] && labValues[m.code].trim() !== '').length;
  const dCov = LAB_MARKERS_CONFIG.length > 0 ? presentCount / LAB_MARKERS_CONFIG.length : 0.1;

  // Fill from linked labs
  const fillFromLabs = () => {
    const newVals: Record<string, string> = {};
    for (const l of labs) {
      const code = (l.code || l.name || '').toUpperCase();
      if (code && l.value) newVals[code] = String(l.value);
    }
    setLabValues(prev => ({ ...prev, ...newVals }));
  };

  const handleCalc = () => {
    const result = calculateTzSpecRisk({
      drugClass,
      drugName: 'custom',
      dose,
      duration,
      form: 'inject',
      combinations: 1,
      labCoverage: dCov,
      labValues: numLabValues,
      supportSubstances: supportIds,
    });
    setResult(result);
    setShowResult(true);
  };

  const catColor = (pct: number) => {
    if (pct < 25) return '#22c55e';
    if (pct < 50) return '#eab308';
    if (pct < 75) return '#f97316';
    return '#ef4444';
  };

  return (
    <div style={{ padding: '0 0 80px' }}>
      <div style={CARD}>
        <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🧮 Риски по механизм-ориентированной модели (ТЗ)</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, marginBottom: 8 }}>
          Введите лабораторные маркеры из таблицы T4 для оценки выраженности механизмов (m_i) по 6 системам организма.
        </div>
        <button onClick={fillFromLabs} style={{
          padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 600,
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa',
        }}>📥 Заполнить из профиля ({labs.length} маркеров)</button>
        <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
          Покрытие анализами: {presentCount}/{LAB_MARKERS_CONFIG.length} ({Math.round(dCov * 100)}%) · Штраф: ×{(1 + 0.25 * (1 - dCov)).toFixed(2)}
        </div>
      </div>

      {/* Параметры курса */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>💉 Параметры курса</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Класс</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {(['aas', 'gh', 'insulin'] as const).map(dc => (
                <button key={dc} onClick={() => setDrugClass(dc)} style={{
                  flex: 1, padding: '7px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                  transition: 'all 0.2s', textAlign: 'center',
                  background: drugClass === dc ? 'var(--accent)' : 'rgba(24,24,27,0.6)',
                  color: drugClass === dc ? '#000' : '#fff',
                  border: `1px solid ${drugClass === dc ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                  {dc === 'aas' ? '💉 ААС' : dc === 'gh' ? '📈 GH' : '🍬 Инсулин'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Доза</div>
            <input type="number" value={dose} onChange={e => setDose(Number(e.target.value))}
              style={{ width: '100%', padding: '8px 6px', borderRadius: 8, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 10, fontWeight: 600, boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Нед.</div>
            <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))}
              style={{ width: '100%', padding: '8px 6px', borderRadius: 8, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 10, fontWeight: 600, boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      {/* Лабораторные маркеры */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>🧪 Лабораторные маркеры (таблица T4)</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {LAB_MARKERS_CONFIG.map(m => {
            const isFilled = labValues[m.code] && labValues[m.code].trim() !== '';
            return (
              <div key={m.code} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6,
                background: isFilled ? 'rgba(0,230,138,0.04)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isFilled ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)'}`,
              }}>
                <div style={{ minWidth: 90, fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{m.name}</span>
                  <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>{m.unit}</span>
                </div>
                <input type="text" inputMode="decimal"
                  value={labValues[m.code] || ''}
                  onChange={e => setLabValues(prev => ({ ...prev, [m.code]: e.target.value }))}
                  placeholder={m.normalRange}
                  style={{
                    flex: 1, padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', textAlign: 'center',
                  }} />
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', minWidth: 40, textAlign: 'right' }}>
                  {m.systems.join(', ')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Поддержка из калькулятора */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>💊 Поддержка из калькулятора</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
          {supportIds.length > 0
            ? `✅ ${supportIds.length} веществ: ${supportIds.map(id => id.charAt(0).toUpperCase() + id.slice(1)).join(', ')}`
            : '🟡 Нет активной поддержки'}
        </div>
      </div>

      <button onClick={handleCalc} style={{
        width: '100%', padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', marginBottom: 10,
        background: `linear-gradient(135deg,${ACCENT},#00c853)`, color: '#000', fontWeight: 800, fontSize: 14,
      }}>🧮 Рассчитать</button>

      {showResult && result && (
        <>
          <div style={{ ...CARD, textAlign: 'center', background: 'linear-gradient(135deg, rgba(0,230,138,0.06) 0%, rgba(0,230,138,0.02) 100%)', border: `1px solid rgba(0,230,138,0.15)` }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>📊 Общий интегральный риск</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 9, color: '#f87171' }}>Без поддержки</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: catColor(result.overallRaw) }}>{result.overallRaw}%</div>
              </div>
              <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>→</div>
              <div>
                <div style={{ fontSize: 9, color: '#4ade80' }}>С поддержкой</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: catColor(result.overallAfter) }}>{result.overallAfter}%</div>
              </div>
            </div>
            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: catColor(result.overallAfter) }}>
              {result.overallCategory} · K_protect = {result.k_protect_overall}%
            </div>
            {result.overallVerification !== undefined && (
              <div style={{
                marginTop: 4, fontSize: 9, padding: '3px 8px', borderRadius: 6, display: 'inline-block',
                background: result.overallVerification >= 0.5 ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.1)',
                color: result.overallVerification >= 0.5 ? '#4ade80' : '#fbbf24',
              }}>
                {result.overallVerification >= 0.5 ? '🔬' : '⚠'} Индекс риска · верифицировано анализами: {Math.round(result.overallVerification * 100)}% систем
                {result.overallVerification < 0.5 && ' — оценка по фармакологии, сдайте анализы'}
              </div>
            )}
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, result.overallAfter)}%`, background: catColor(result.overallAfter), borderRadius: 3 }} />
            </div>
          </div>

          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>🫀 Риск по системам</div>
            {result.organs.map((organ: TzSpecOrganResult) => (
              <div key={organ.id} style={{ marginBottom: 4, padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 600 }}>
                    {organ.icon} {organ.name}
                    {organ.verification !== undefined && organ.verification < 0.5 && (
                      <span style={{ color: '#fbbf24', marginLeft: 4 }}>⚠</span>
                    )}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: catColor(organ.afterPercent) }}>
                    {organ.rawPercent}% → {organ.afterPercent}%
                  </span>
                </div>
                {organ.floors && organ.floors.length > 0 && (
                  <div style={{ marginTop: 2 }}>
                    {organ.floors.map((f, i) => (
                      <div key={i} style={{ fontSize: 8, color: '#fca5a5', lineHeight: 1.4 }}>⚓ {f.label}</div>
                    ))}
                  </div>
                )}
                <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, organ.afterPercent)}%`, background: catColor(organ.afterPercent), borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
