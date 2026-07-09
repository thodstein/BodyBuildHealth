import React, { useState, useMemo } from 'react';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-database';
import { PHARMA_DB } from '../../../core/pharma-database';
import { PEPTIDE_DB } from '../../../engines/peptide-calculator.engine';
import {
  type EnrichedEntry, type FormWithBio,
  getCatalogFormBio, detectEnhancers, detectCompetition, classifySubstance,
  PERSONAL_ADJUSTERS, bioColor, THERAPEUTIC_WINDOWS, MODIFIERS, COST_PER_GRAM,
} from './SupportBioavailabilityData';
import { S } from './SupportShared';

// ─── Build enriched catalog ───
function buildCatalog(): EnrichedEntry[] {
  const entries: EnrichedEntry[] = [];
  for (const [id, entry] of Object.entries(SUPPORT_CATALOG_DATA)) {
    if (!entry?.nameRu) continue;
    const forms: FormWithBio[] = (entry.forms || []).map(f => {
      const bio = getCatalogFormBio(f);
      return { ...f, bioavailability: bio, bioLabel: `${(bio * 100).toFixed(0)}%`, effectiveDose: (doseMg: number) => Math.round(doseMg * bio) };
    });
    const clinical = classifySubstance(entry.nameRu, entry.category || []);
    entries.push({
      id, source: 'catalog', nameRu: entry.nameRu, nameEn: entry.name || id,
      tier: entry.tier, category: entry.category || [], description: entry.description || '',
      forms, maxBio: forms.length ? Math.max(...forms.map(f=>f.bioavailability)) : 0,
      minBio: forms.length ? Math.min(...forms.map(f=>f.bioavailability)) : 0,
      avgBio: forms.length ? forms.reduce((a, f) => a + f.bioavailability, 0) / forms.length : 0,
      bestForm: forms.find(f => f.best) || null,
      enhancers: detectEnhancers(entry), competitors: detectCompetition(entry, entry.nameRu, entry.category || []),
      absorptionKey: clinical.abs, halfLifeKey: clinical.hl, foodKey: clinical.food, windowKey: clinical.win, costPerGram: clinical.cost,
    });
  }
  for (const [pid, ph] of Object.entries(PHARMA_DB)) {
    if (!ph || !ph.name) continue;
    const bio = ph.pk?.bioavailability ?? (ph.bioavailability ? (typeof ph.bioavailability === 'number' ? ph.bioavailability : (typeof ph.bioavailability === 'object' && 'avg' in (ph.bioavailability as any) ? (ph.bioavailability as any).avg : 0.85)) : 0.85);
    const forms: FormWithBio[] = [{ id: pid, name: ph.name, nameRu: ph.name, dose: ph.dosageRange ? `${ph.dosageRange.min}-${ph.dosageRange.max} ${ph.dosageRange.unit}` : '—', best: true, bioavailability: bio, bioLabel: `${(bio * 100).toFixed(0)}%`, effectiveDose: (d: number) => Math.round(d * bio) }];
    entries.push({ id: pid, source: 'pharma', nameRu: ph.name, nameEn: ph.name || pid, tier: 'standard', category: ['pharma', (ph as any).class || 'aas'].filter(Boolean), description: ph.description || '', forms, maxBio: bio, minBio: bio, avgBio: bio, bestForm: forms[0], enhancers: [], competitors: [], absorptionKey: 'stomach', halfLifeKey: '', foodKey: 'antioxidant', windowKey: '', costPerGram: null });
  }
  return entries;
}

// ─── Therapeutic ranges for key supplements (clinically established oral doses, not bio-adjusted) ───
const DOSE_RANGES: Record<string, { therMin: number; therMax: number; label: string }> = {
  nac: { therMin: 600, therMax: 1800, label: 'N-ацетилцистеин' },
  tudca: { therMin: 500, therMax: 1500, label: 'TUDCA' },
  milk_thistle: { therMin: 280, therMax: 840, label: 'Силимарин' },
  alpha_lipoic: { therMin: 300, therMax: 600, label: 'Альфа-липоевая кислота' },
  curcumin: { therMin: 500, therMax: 2000, label: 'Куркумин (с пиперином)' },
  coq10: { therMin: 100, therMax: 400, label: 'Коэнзим Q10' },
  omega3: { therMin: 2000, therMax: 6000, label: 'Омега-3 (EPA+DHA)' },
  berberine: { therMin: 500, therMax: 1500, label: 'Берберин' },
  magnesium: { therMin: 300, therMax: 600, label: 'Магний (элемент)' },
  zinc: { therMin: 15, therMax: 50, label: 'Цинк (элемент)' },
  vitamin_d3: { therMin: 1000, therMax: 5000, label: 'Витамин D3 (МЕ)' },
  b12: { therMin: 500, therMax: 2000, label: 'B12 (мкг)' },
  folate: { therMin: 400, therMax: 1000, label: 'Фолат (мкг)' },
  iron: { therMin: 18, therMax: 65, label: 'Железо (элемент)' },
  creatine: { therMin: 3000, therMax: 5000, label: 'Креатин' },
  ashwagandha: { therMin: 300, therMax: 600, label: 'Ашваганда' },
  rhodiola: { therMin: 200, therMax: 600, label: 'Родиола' },
};

// ─── Main component ───
export const SupportEffectiveDose: React.FC = () => {
  const [sub1Id, setSub1Id] = useState('');
  const [sub2Id, setSub2Id] = useState('');
  const [dose1, setDose1] = useState(500);
  const [dose2, setDose2] = useState(500);
  const [form1Idx, setForm1Idx] = useState(0);
  const [form2Idx, setForm2Idx] = useState(0);
  const [activeAdjusters, setActiveAdjusters] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_bio_adjusters') || '[]'); } catch { return []; }
  });

  const catalog = useMemo(() => buildCatalog(), []);

  const sub1 = sub1Id ? catalog.find(e => e.id === sub1Id) : null;
  const sub2 = sub2Id ? catalog.find(e => e.id === sub2Id) : null;
  const f1 = sub1?.forms[form1Idx];
  const f2 = sub2?.forms[form2Idx];
  const adjMult = activeAdjusters.reduce((p, k) => p * (PERSONAL_ADJUSTERS[k]?.mult || 1), 1.0);

  // ── Fixed effective dose calculation ──
  // Oral dose is what you take. Bioavailability-adjusted amount = dose x bio%
  // But "effective dose" must be validated against the THERAPEUTIC range (clinical studies use oral doses)
  const calcEffDose = (form: FormWithBio | undefined, doseMg: number, id: string) => {
    if (!form || !doseMg) return { absorbed: 0, rawAbsorbed: 0, range: null as { therMin: number; therMax: number; label: string } | null, status: '' };
    const rawAbsorbed = Math.round(doseMg * form.bioavailability);
    const absorbed = Math.round(rawAbsorbed * adjMult);
    const rangeKey = Object.keys(DOSE_RANGES).find(k => id.toLowerCase().includes(k));
    const range = rangeKey ? DOSE_RANGES[rangeKey] : null;
    let status = '';
    if (range) {
      if (doseMg < range.therMin) status = 'Ниже терапевтического диапазона (мин ' + range.therMin + ' мг)';
      else if (doseMg > range.therMax) status = 'Выше терапевтического (макс ' + range.therMax + ' мг) - риск побочных';
      else status = 'В терапевтическом диапазоне ' + range.therMin + '-' + range.therMax + ' мг';
    }
    return { absorbed, rawAbsorbed, range, status };
  };

  const eff1 = calcEffDose(f1, dose1, sub1Id);
  const eff2 = calcEffDose(f2, dose2, sub2Id);

  // Cost efficiency
  const costPerGram1 = sub1?.costPerGram ?? null;
  const costPerGram2 = sub2?.costPerGram ?? null;
  const costEff1 = costPerGram1 && eff1.absorbed > 0 ? (costPerGram1 / eff1.absorbed * 1000) : null;
  const costEff2 = costPerGram2 && eff2.absorbed > 0 ? (costPerGram2 / eff2.absorbed * 1000) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Расчёт эффективной дозы</div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.4 }}>
          Сравните два вещества или две формы. <b>Эффективная доза</b> = принятая доза биодоступность.
          Однако клиническая эффективность определяется <b>терапевтическим диапазоном</b> доз, установленным в исследованиях для перорального приёма.
        </div>

        {/* Substance selector columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { side: 1, sub: sub1, f: f1, dose: dose1, setDose: setDose1, eff: eff1, costEff: costEff1, formIdx: form1Idx, setFormIdx: setForm1Idx, id: sub1Id, setId: setSub1Id, accent: '#00e68a' },
            { side: 2, sub: sub2, f: f2, dose: dose2, setDose: setDose2, eff: eff2, costEff: costEff2, formIdx: form2Idx, setFormIdx: setForm2Idx, id: sub2Id, setId: setSub2Id, accent: '#60a5fa' },
          ].map(p => (
            <div key={p.side} style={{ padding: 8, borderRadius: 8, background: p.accent + '10', border: '1px solid ' + p.accent + '20' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: p.accent, marginBottom: 4 }}>Вещество {p.side}</div>
              <select value={p.id} onChange={e => { p.setId(e.target.value); p.setFormIdx(0); }}
                style={{ width: '100%', padding: '4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8, marginBottom: 3 }}>
                <option value="">Выберите...</option>
                {catalog.map(e => <option key={e.id} value={e.id}>{e.nameRu} ({e.source})</option>)}
              </select>
              {p.sub && p.sub.forms.length > 0 && (
                <select value={p.formIdx} onChange={e => p.setFormIdx(Number(e.target.value))}
                  style={{ width: '100%', padding: '4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8, marginBottom: 3 }}>
                  {p.sub.forms.map((f, i) => <option key={i} value={i}>{f.nameRu} ({(f.bioavailability * 100).toFixed(0)}%)</option>)}
                </select>
              )}
              <input type="number" value={p.dose} min={0} onChange={e => p.setDose(Math.max(0, Number(e.target.value) || 0))} placeholder="Доза мг"
                style={{ width: '100%', padding: '4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 8, marginBottom: 3 }} />
              {p.f && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Усвоится (скорректировано):</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: p.accent }}>{p.eff.absorbed} <span style={{ fontSize: 9 }}>мг</span></div>
                    <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{p.dose} мг {(p.f.bioavailability * 100).toFixed(0)}%{adjMult < 1 ? ' ' + adjMult.toFixed(2) : ''}</div>
                    {adjMult < 1 && <div style={{ fontSize: 6, color: '#ff9800' }}>без коррекции: {p.eff.rawAbsorbed} мг</div>}
                  </div>
                  {p.eff.status && (
                    <div style={{ marginTop: 3, padding: '3px 5px', borderRadius: 4, fontSize: 7, textAlign: 'center',
                      background: p.eff.status.includes('терапевтическом') ? 'rgba(34,197,94,0.1)' : p.eff.status.includes('Ниже') ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                      color: p.eff.status.includes('терапевтическом') ? '#22c55e' : p.eff.status.includes('Ниже') ? '#f59e0b' : '#ef4444' }}>
                      {p.eff.status}
                    </div>
                  )}
                  {p.costEff !== null && (
                    <div style={{ fontSize: 7, color: 'var(--text-dim)', textAlign: 'center', marginTop: 2 }}>
                      Стоимость: {costPerGram1 !== null ? costPerGram1 + ' /г' : '—'} | {p.costEff.toFixed(2)} /мг усвоенного
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Comparison */}
        {eff1.absorbed > 0 && eff2.absorbed > 0 && (
          <div style={{ marginTop: 6, padding: 10, borderRadius: 8, textAlign: 'center', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>Сравнение</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 8, color: '#00e68a' }}>{f1?.nameRu || '?'}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{eff1.absorbed} мг</div>
                <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{(f1?.bioavailability || 0) * 100}%</div>
              </div>
              <div style={{ fontSize: 16, color: 'var(--text-dim)' }}>vs</div>
              <div>
                <div style={{ fontSize: 8, color: '#60a5fa' }}>{f2?.nameRu || '?'}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>{eff2.absorbed} мг</div>
                <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{(f2?.bioavailability || 0) * 100}%</div>
              </div>
            </div>
            <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-dim)' }}>
              {eff1.absorbed > eff2.absorbed
                ? f1?.nameRu + ' даёт на ' + ((eff1.absorbed / eff2.absorbed * 100) - 100).toFixed(0) + '% больше усвоенного вещества'
                : eff2.absorbed > eff1.absorbed
                  ? f2?.nameRu + ' даёт на ' + ((eff2.absorbed / eff1.absorbed * 100) - 100).toFixed(0) + '% больше усвоенного вещества'
                  : 'Одинаково'}
            </div>
            {adjMult < 1 && <div style={{ marginTop: 3, fontSize: 7, color: '#ff9800' }}>С поправкой ( {adjMult.toFixed(2)}): {eff1.absorbed} мг / {eff2.absorbed} мг</div>}
          </div>
        )}
      </div>

      {/* Personal adjusters */}
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(244,63,94,0.04)', border: '1px solid rgba(244,63,94,0.12)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#f44336', marginBottom: 4 }}>Персонализированная коррекция</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Object.entries(PERSONAL_ADJUSTERS).map(([key, adj]) => {
            const active = activeAdjusters.includes(key);
            return (
              <div key={key} onClick={() => {
                const next = active ? activeAdjusters.filter((k: string) => k !== key) : [...activeAdjusters, key];
                setActiveAdjusters(next);
                localStorage.setItem('he_bio_adjusters', JSON.stringify(next));
              }} style={{ padding: '3px 5px', borderRadius: 3, cursor: 'pointer', border: active ? '1px solid rgba(244,63,94,0.3)' : '1px solid var(--border)', background: active ? 'rgba(244,63,94,0.08)' : 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: active ? '#f44336' : 'var(--text-light)' }}>{adj.label}</span>
                  <span style={{ fontSize: 7, color: 'var(--text-dim)' }}> {adj.mult.toFixed(2)}</span>
                </div>
                {active && <div style={{ fontSize: 6, color: 'var(--text-dim)', marginTop: 1 }}>{adj.desc}</div>}
              </div>
            );
          })}
        </div>
        {activeAdjusters.length > 0 && (
          <div style={{ marginTop: 4, padding: '5px 8px', borderRadius: 6, textAlign: 'center', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Множитель: </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#f44336' }}> {adjMult.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Loading protocols */}
      <div style={{ ...S.cardBlue }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>Протоколы загрузочной фазы</div>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 4, lineHeight: 1.3 }}>
          Для веществ, требующих насыщения тканевых депо перед поддерживающей дозой. Клинически установленные протоколы:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { what: 'Креатин', loading: '20 г/день 5-7 дней', main: '3-5 г/день' },
            { what: 'КoQ10', loading: '200-400 мг/день 2-4 нед', main: '100-200 мг/день' },
            { what: 'Витамин D3', loading: '5000-10000 МЕ/день 4-8 нед', main: '1000-4000 МЕ/день' },
            { what: 'Магний (тяжёлый дефицит)', loading: '400-800 мг/день 4 нед', main: '300-400 мг/день' },
            { what: 'Железо (дефицит)', loading: '100-200 мг/день 3 мес', main: '18-27 мг/день' },
            { what: 'B12 (дефицит)', loading: '1000 мкг/день 4-8 нед', main: '500-1000 мкг/день' },
          ].map((p, i) => (
            <div key={i} style={{ padding: '4px 6px', borderRadius: 4, background: 'rgba(96,165,250,0.03)' }}>
              <b style={{ fontSize: 8, color: 'var(--text-light)' }}>{p.what}</b>
              <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>
                Насыщение: {p.loading} → Поддержка: {p.main}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Educational note */}
      <div style={{ ...S.card, borderColor: 'rgba(167,139,250,0.08)' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>Почему биоскорректированная доза не равна терапевтической?</div>
        <div style={{ fontSize: 7, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          Клинические исследования устанавливают терапевтические дозы для <b>перорального приёма</b> (капсулы/таблетки), а не для внутривенного.
          Например, NAC 600 мг per os — это клинически подтверждённая доза, хотя усваивается всего ~60 мг.
          Поэтому <b>ориентируйтесь на oral-диапазон</b>, а биоскорректированная цифра — лишь показатель относительной эффективности разных форм.
        </div>
      </div>
    </div>
  );
};

export default SupportEffectiveDose;