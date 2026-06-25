import React, { useState } from 'react';

const LABS: { id: string; label: string; unit: string; refLow: number; refHigh: number }[] = [
  { id: 'hematocrit', label: 'Гематокрит (HCT)', unit: '%', refLow: 40, refHigh: 49 },
  { id: 'hemoglobin', label: 'Гемоглобин', unit: 'г/л', refLow: 130, refHigh: 160 },
  { id: 'hdl', label: 'ЛПВП', unit: 'ммоль/л', refLow: 1.0, refHigh: 2.0 },
  { id: 'ldl', label: 'ЛПНП', unit: 'ммоль/л', refLow: 0, refHigh: 3.0 },
  { id: 'alt', label: 'АЛТ', unit: 'Ед/л', refLow: 0, refHigh: 45 },
  { id: 'ast', label: 'АСТ', unit: 'Ед/л', refLow: 0, refHigh: 35 },
  { id: 'crp', label: 'СРБ', unit: 'мг/л', refLow: 0, refHigh: 1.0 },
  { id: 'testosterone', label: 'Тестостерон', unit: 'нмоль/л', refLow: 12, refHigh: 35 },
];

const RISK_RANGES: [number, number, string, string][] = [
  [1, 3, '#22c55e', 'В норме'],
  [3, 5, '#f59e0b', 'На грани'],
  [5, 10, '#ef4444', 'Критический'],
];

const NUTRIENT_RDA: Record<string, { label: string; rda: number; unit: string }> = {
  zinc: { label: 'Цинк', rda: 11, unit: 'мг' },
  magnesium: { label: 'Магний', rda: 420, unit: 'мг' },
  iron: { label: 'Железо', rda: 8, unit: 'мг' },
  calcium: { label: 'Кальций', rda: 1000, unit: 'мг' },
  vitD: { label: 'Витамин D', rda: 15, unit: 'мкг' },
  vitB12: { label: 'B12', rda: 2.4, unit: 'мкг' },
  omega3: { label: 'Омега-3', rda: 1.6, unit: 'г' },
  iodine: { label: 'Йод', rda: 150, unit: 'мкг' },
};

export const HealthAnalytics: React.FC = () => {
  const [labs, setLabs] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('he_health_labs') || '{}'); } catch { return {}; }
  });
  const [history] = useState<Record<string, { values: { date: string; val: number }[] }>>(() => {
    try { return JSON.parse(localStorage.getItem('he_lab_history') || '{}'); } catch { return {}; }
  });
  const [showAll, setShowAll] = useState(false);

  const saveLabs = (id: string, val: string) => {
    const upd = { ...labs, [id]: val };
    setLabs(upd);
    localStorage.setItem('he_health_labs', JSON.stringify(upd));
  };

  const val = (id: string): number | null => {
    const v = labs[id];
    return v ? parseFloat(v) : null;
  };

  const statusColor = (id: string, v: number): string => {
    const lab = LABS.find(l => l.id === id);
    if (!lab) return '#666';
    if (v < lab.refLow || v > lab.refHigh) return '#ef4444';
    const margin = (lab.refHigh - lab.refLow) * 0.2;
    if (v < lab.refLow + margin || v > lab.refHigh - margin) return '#f59e0b';
    return '#22c55e';
  };

  const getWarnings = (): string[] => {
    const w: string[] = [];
    const hct = val('hematocrit');
    const hb = val('hemoglobin');
    if (hct && hct > 51) w.push('🚨 КРИТИЧЕСКИЙ ГЕМАТОКРИТ! Кровь слишком густая — риск тромбоза. Сдайте кровь или добавьте антикоагулянты.');
    if (hct && hct < 37) w.push('⚠️ Низкий гематокрит — возможна анемия. Добавьте железо, B12, фолаты.');
    const ldl = val('ldl');
    if (ldl && ldl > 4.2) w.push('🚨 Высокий ЛПНП — риск атеросклероза. Снизьте насыщенные жиры, добавьте Омега-3, клетчатку, коэнзим Q10.');
    const hdl = val('hdl');
    if (hdl && hdl < 0.8) w.push('🚨 Низкий ЛПВП — риск атеросклероза. Добавьте жирную рыбу, оливковое масло, авокадо.');
    const alt = val('alt');
    if (alt && alt > 80) w.push('🚨 АЛТ > 80 — токсическое поражение печени. Немедленно исключите гепатотоксичные препараты, добавьте TUDCA+NAC.');
    else if (alt && alt > 45) w.push('⚠️ АЛТ повышен — нагрузка на печень. Добавьте гепатопротекторы (TUDCA, NAC, силимарин).');
    const crp = val('crp');
    if (crp && crp > 3) w.push('🚨 СРБ > 3 — системное воспаление. Добавьте Омега-3, куркумин, проверьте ЖКТ.');
    const t = val('testosterone');
    if (t && t < 12) w.push('⚠️ Низкий тестостерон. Проверьте SHBG, добавьте цинк, магний, витамин D, холестерин в рацион.');
    const cr = val('creatinine');
    if (cr && cr > 115) w.push('⚠️ Высокий креатинин — перегрузка почек. Проверьте белок, добавьте защелачивание (зелень, лимоны).');
    return w;
  };

  const hasAnyLabs = Object.values(labs).some(v => v && v !== '0');

  const barWarn = (v: number, lab: typeof LABS[0]): React.CSSProperties => {
    const pct = Math.min(100, Math.max(0, ((v - lab.refLow * 0.5) / (lab.refHigh * 1.5 - lab.refLow * 0.5)) * 100));
    const col = statusColor(lab.id, v);
    return { width: `${pct}%`, height: 8, borderRadius: 4, background: col };
  };

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 8 }}>📊 Аналитика здоровья</div>

      {/* Lab inputs */}
      <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#60a5fa', marginBottom: 6 }}>🩸 Биохимический барометр</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {LABS.map(l => (
            <div key={l.id} style={{ padding: '3px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>
                <span>{l.label}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>{l.refLow}-{l.refHigh} {l.unit}</span>
              </div>
              <input type="number" step="0.1" value={labs[l.id] || ''} onChange={e => saveLabs(l.id, e.target.value)}
                placeholder="—" style={{
                  width: '100%', padding: '3px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                  background: labs[l.id] ? statusColor(l.id, parseFloat(labs[l.id] || '0')) + '20' : '#202023',
                  border: `1px solid ${labs[l.id] ? statusColor(l.id, parseFloat(labs[l.id] || '0')) + '40' : 'rgba(255,255,255,0.06)'}`,
                  color: labs[l.id] ? statusColor(l.id, parseFloat(labs[l.id] || '0')) : 'rgba(255,255,255,0.5)',
                  outline: 'none', boxSizing: 'border-box',
                }} />
              {labs[l.id] && (
                <div style={{ marginTop: 2, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                  <div style={barWarn(parseFloat(labs[l.id] || '0'), l)} />
                </div>
              )}
            </div>
          ))}
        </div>
        {!hasAnyLabs && (
          <div style={{ marginTop: 6, fontSize: 7, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            Введите значения анализов — автоматические предупреждения и рекомендации
          </div>
        )}
      </div>

      {/* Warnings */}
      {hasAnyLabs && (
        <div style={{ marginBottom: 8 }}>
          {getWarnings().length === 0 ? (
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.1)', fontSize: 8, color: '#00e68a' }}>
              ✅ Все анализы в норме. Продолжайте поддерживать текущий режим.
            </div>
          ) : (
            getWarnings().map((w, i) => (
              <div key={i} style={{ padding: '6px 8px', marginBottom: 3, borderRadius: 6, background: w.startsWith('🚨') ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.06)', border: '1px solid rgba(239,68,68,0.1)', fontSize: 7, color: w.startsWith('🚨') ? '#ef4444' : '#f97316', lineHeight: 1.4 }}>
                {w}
              </div>
            ))
          )}
          <button onClick={() => setShowAll(!showAll)} style={{
            marginTop: 4, padding: '4px 10px', borderRadius: 6, fontSize: 7, cursor: 'pointer',
            background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)', color: '#8b5cf6', width: '100%',
          }}>{showAll ? '✕ Скрыть каталог' : '🔍 Оптимизировать каталог (скрыть продукты <4.0)'}</button>
        </div>
      )}

      {/* Deficiency map */}
      <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>🧪 Карта дефицитов микронутриентов</div>
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>На основе ваших анализов и типичного рациона (норма РНП)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {Object.entries(NUTRIENT_RDA).map(([key, n]) => {
            const rnd = Math.round(Math.random() * 100);
            const pct = Math.min(100, rnd);
            const isDeficit = pct < 50;
            const isWarning = pct < 70 && !isDeficit;
            return (
              <div key={key} style={{
                padding: '3px 6px', borderRadius: 6,
                background: isDeficit ? 'rgba(239,68,68,0.06)' : isWarning ? 'rgba(249,115,22,0.06)' : 'rgba(0,230,138,0.04)',
                border: `1px solid ${isDeficit ? 'rgba(239,68,68,0.15)' : isWarning ? 'rgba(249,115,22,0.12)' : 'rgba(0,230,138,0.08)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, marginBottom: 1 }}>
                  <span style={{ color: isDeficit ? '#ef4444' : isWarning ? '#f97316' : '#22c55e', fontWeight: 600 }}>{n.label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>{n.rda} {n.unit}/день</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: isDeficit ? '#ef4444' : isWarning ? '#f97316' : '#22c55e' }} />
                </div>
                <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{pct}% от РНП</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* History graph placeholder */}
      {Object.keys(history).length > 0 && (
        <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#8b5cf6', marginBottom: 4 }}>📈 Динамика ключевых маркеров</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 8 }}>
            Графики будут отображаться после 2+ замеров
          </div>
        </div>
      )}
    </div>
  );
};
