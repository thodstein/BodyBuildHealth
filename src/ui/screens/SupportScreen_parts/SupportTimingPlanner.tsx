import React, { useState, useMemo } from 'react';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-database';
import { PHARMA_DB } from '../../../core/pharma-database';
import { PEPTIDE_DB } from '../../../engines/peptide-calculator.engine';
import {
  type EnrichedEntry, type TimeSlot, type TimingSlot, type SubstanceTiming, type FormWithBio,
  TIMING_SLOTS, CATEGORY_TIMING, getCatalogFormBio, detectEnhancers, detectCompetition, classifySubstance,
  ROUTE_LABELS_MAP,
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
  for (const [pepId, pp] of Object.entries(PEPTIDE_DB)) {
    if (!pp?.name) continue;
    const forms: FormWithBio[] = [];
    const raw = (pp as any).bioavailability || {};
    for (const [rt, b] of Object.entries(raw)) {
      if (typeof b !== 'number') continue;
      forms.push({ id: `${pepId}_${rt}`, name: `${pp.name} (${ROUTE_LABELS_MAP[rt] || rt})`, nameRu: `${pp.name} (${ROUTE_LABELS_MAP[rt] || rt})`, dose: `${(pp as any).amountMg || '?'} мг`, best: rt === 'sc', bioavailability: b, bioLabel: `${(b * 100).toFixed(0)}%`, notes: '', effectiveDose: (d: number) => Math.round(d * b) });
    }
    entries.push({ id: pepId, source: 'peptide', nameRu: pp.name, nameEn: pp.name || pepId, tier: 'advanced', category: ['peptide', (pp as any).className || 'gh_peptide'].filter(Boolean), description: `${((pp as any).effects || []).join(', ') || ''}`, forms, maxBio: forms.length ? Math.max(...forms.map(f=>f.bioavailability)) : 0, minBio: forms.length ? Math.min(...forms.map(f=>f.bioavailability)) : 0, avgBio: forms.length ? forms.reduce((a, f) => a + f.bioavailability, 0) / forms.length : 0, bestForm: forms[0] || null, enhancers: [], competitors: [], absorptionKey: 'sublingual_area', halfLifeKey: '', foodKey: 'antioxidant', windowKey: '', costPerGram: null });
  }
  return entries;
}

// ─── Timing component ───
export const SupportTimingPlanner: React.FC = () => {
  const [selectedSubs, setSelectedSubs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_bio_timing_subs') || '[]'); } catch { return []; }
  });
  const [timingSearch, setTimingSearch] = useState('');

  const catalog = useMemo(() => buildCatalog(), []);

  const toggleSub = (id: string) => {
    const next = selectedSubs.includes(id) ? selectedSubs.filter(x => x !== id) : [...selectedSubs, id];
    setSelectedSubs(next);
    localStorage.setItem('he_bio_timing_subs', JSON.stringify(next));
  };

  const CATEGORY_PRIORITY: Record<string, number> = {
    enzyme: 1, fibrinolytic: 1, mucolytic: 1, proteolytic: 1, hemorheologic: 1, anticoagulant: 1,
    dopamine: 2, peptide: 2, gh_secretagogue: 2,
    sleep: 1, herb_sedative: 3, serotonin: 3,
    herb_adaptogen: 4, adaptogen: 4, stress: 4,
    b_vitamins: 5, energy: 5, thyroid: 5, nootropic: 5,
    mineral_fe: 6, mineral_zn: 6, mineral_se: 6, mineral: 6, mineral_ca: 6, mineral_mg: 6, iron: 6,
    electrolyte: 6,
    probiotic: 4, gi: 4, gut: 4, detox: 5, digestion: 5,
    hepatoprotector: 8, liver: 8, bile: 8, choleretic: 8, bile_acid: 8,
    cardioprotector: 9, cardio: 9, bp: 9, heart_rate: 9,
    ace_inhibitor: 9, antihypertensive: 9,
    omega: 10, omega3: 10,
    amino: 11, amino_acid: 11, protein: 11, anabolic: 11,
    antioxidant: 12, mitochondrial: 12, anti_aging: 12,
    antioxidant_fat: 12, antioxidant_am: 12,
    vitamin: 13, bone: 13, joint: 13,
    coagulation: 13, vitamin_der: 13, vitamin_a_d: 13,
    antiinflammatory: 14, antiagg: 14,
    hypocholesterolemic: 14, lipid_low: 14, cholesterol: 14,
    methylation: 15, metabolic: 15, recovery: 16,
    immunomodulator: 17, immune: 17,
    neuro: 18, neuroprotector: 18, anxiolytic: 18,
    renal: 19, nephroprotector: 19,
    endocrine: 20, hormonal: 20, aromatase_inhibitor: 20,
    androgen: 20, aas_derivative: 20, pharma: 20,
    skin: 21, beauty: 21, collagen: 21,
    flavonoid: 22, polyphenol: 22, venotonic: 22,
    glucosinolate: 22, herbal: 22, herb: 22,
    creatine: 30,
  };

  const NAME_TIMING_OVERRIDES: { pattern: RegExp; key: keyof typeof CATEGORY_TIMING }[] = [
    { pattern: /серра|serra|серрапептаз|serrapeptas/, key: 'enzyme' },
    { pattern: /натто|natto|наттокиназ|nattokinas/, key: 'fibrinolytic' },
    { pattern: /лумбро|lumbro|люмброкиназ|lumbrokina/, key: 'fibrinolytic' },
    { pattern: /бромелайн|bromelain/, key: 'enzyme' },
    { pattern: /папаин|papain/, key: 'enzyme' },
    { pattern: /tudca|тудц|урсодез|ursodez/, key: 'bile_acid' },
    { pattern: /таурин|taurin/, key: 'amino' },
    { pattern: /кальц|calcium|ca_/, key: 'mineral_ca' },
    { pattern: /магн|magnesium/, key: 'mineral_mg' },
    { pattern: /цинк|zinc/, key: 'mineral_zn' },
    { pattern: /желез|iron|fe_/, key: 'mineral_fe' },
    { pattern: /селен|selen/, key: 'mineral_se' },
    { pattern: /d3|вит.*d|vit.*d/, key: 'fat_soluble' },
    { pattern: /coq10|убихин|ubiquin/, key: 'antioxidant_fat' },
    { pattern: /куркум|curcum/, key: 'antioxidant_fat' },
    { pattern: /омега|omega/, key: 'omega3_any' },
    { pattern: /b12|b-12|фолат|folat|b6|b2|b1/, key: 'b_vitamins' },
    { pattern: /ашваганд|ashwagan|валерьян|valerian|мелатон/, key: 'herb_sedative' },
    { pattern: /родиол|rhodiol|женьшен|ginseng|элеутеро/, key: 'herb_adaptogen' },
    { pattern: /5-htp|гидрокситриптофан|x5htp/, key: 'sleep' },
    { pattern: /креатин|creatin/, key: 'creatine' },
    { pattern: /коллаген|collagen/, key: 'collagen' },
    { pattern: /(про|pro)(био|bio)/, key: 'probiotic' },
    { pattern: /глутатион|glutathione/, key: 'antioxidant_am' },
    { pattern: /nac\b/, key: 'antioxidant_am' },
    { pattern: /ала|ala\b/, key: 'antioxidant_am' },
  ];

  const assignedSlots = useMemo(() => {
    const slots: Record<TimeSlot, { entry: EnrichedEntry; reason: string }[]> = {
      morning_empty: [], morning_food: [], noon_food: [], afternoon_empty: [], evening_food: [], night_empty: []
    };
    selectedSubs.forEach(sid => {
      const entry = catalog.find(e => e.id === sid);
      if (!entry) return;
      const n = entry.nameRu.toLowerCase();

      for (const ov of NAME_TIMING_OVERRIDES) {
        if (n.match(ov.pattern) && CATEGORY_TIMING[ov.key]) {
          slots[CATEGORY_TIMING[ov.key].slot].push({ entry, reason: CATEGORY_TIMING[ov.key].reason });
          return;
        }
      }

      let bestTiming: SubstanceTiming | undefined;
      let bestPriority = 999;
      for (const cat of entry.category) {
        const catLower = cat.toLowerCase();
        const direct = CATEGORY_TIMING[catLower];
        if (direct) {
          const prio = CATEGORY_PRIORITY[catLower] ?? 50;
          if (prio < bestPriority) { bestPriority = prio; bestTiming = direct; }
        }
      }

      if (!bestTiming) {
        const catJoined = entry.category.join(' ').toLowerCase();
        if (catJoined.includes('fat') || catJoined.includes('жирораствор')) bestTiming = CATEGORY_TIMING.fat_soluble;
        else if (catJoined.includes('amino') || catJoined.includes('аминокислот')) bestTiming = CATEGORY_TIMING.amino;
        else if (catJoined.includes('probiot')) bestTiming = CATEGORY_TIMING.probiotic;
        else bestTiming = CATEGORY_TIMING.default;
      }

      slots[bestTiming.slot].push({ entry, reason: bestTiming.reason });
    });
    return slots;
  }, [selectedSubs, catalog]);

  const suppEntries = catalog.filter(e => e.source === 'catalog');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>Тайминг-планировщик приёма БАД</div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 6 }}>Выберите свои добавки — система распределит их по времени суток с учётом конкуренции и совместимости.</div>
        <input value={timingSearch} onChange={e => setTimingSearch(e.target.value)} placeholder="Поиск БАД..."
          style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', fontSize: 10, marginBottom: 6 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxHeight: 150, overflowY: 'auto', marginBottom: 6 }}>
          {suppEntries.filter(e => !selectedSubs.includes(e.id) && (!timingSearch || e.nameRu.toLowerCase().includes(timingSearch.toLowerCase()))).map(e => (
            <div key={e.id} onClick={() => toggleSub(e.id)}
              style={{ padding: '3px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>+ {e.nameRu}</div>
          ))}
        </div>
        {selectedSubs.length > 0 && <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 4 }}>Выбрано: {selectedSubs.length}. Нажмите для удаления.</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {selectedSubs.map(sid => {
            const e = catalog.find(x => x.id === sid);
            return e ? <div key={sid} onClick={() => toggleSub(sid)}
              style={{ padding: '3px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 8, border: '1px solid #00e68a', background: 'rgba(0,230,138,0.1)', color: '#00e68a' }}> {e.nameRu}</div> : null;
          })}
        </div>
      </div>

      {selectedSubs.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#00e68a' }}>Расписание приёма</div>
            <button onClick={() => {
              let text = 'РАСПИСАНИЕ ПРИЁМА БАД\n\n';
              TIMING_SLOTS.forEach(ts => {
                const items = assignedSlots[ts.key];
                if (items.length === 0) return;
                text += ts.label + ' (' + ts.time + '):\n';
                items.forEach(item => { text += '  \u2022 ' + item.entry.nameRu + ' \u2014 ' + item.reason + '\n'; });
                text += '\n';
              });
              navigator.clipboard.writeText(text).then(() => { alert('Расписание скопировано в буфер обмена'); });
            }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 8, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: '#00e68a' }}> Копировать план</button>
          </div>
          {TIMING_SLOTS.map(ts => {
            const items = assignedSlots[ts.key];
            if (items.length === 0) return null;
            return (
              <div key={ts.key} style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.03)', border: '1px solid rgba(0,230,138,0.08)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#00e68a', marginBottom: 3 }}>{ts.label} ({ts.time})</div>
                {items.map((item, i) => (
                  <div key={i} style={{ fontSize: 8, color: 'var(--text-dim)', padding: '2px 0', borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                    <b style={{ color: 'var(--text-light)' }}>{item.entry.nameRu}</b> {'\u00B7'} {item.reason}
                  </div>
                ))}
              </div>
            );
          })}
          {TIMING_SLOTS.every(ts => assignedSlots[ts.key].length === 0) && <div style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', padding: 12 }}>Выберите БАДы для составления расписания</div>}
        </div>
      )}

      {selectedSubs.length >= 2 && (() => {
        const selectedEntries = selectedSubs.map(sid => catalog.find(e => e.id === sid)).filter(Boolean) as EnrichedEntry[];
        const mineralEntries = selectedEntries.filter(e => e.competitors.length > 0);
        if (mineralEntries.length === 0) return null;
        return (
          <div style={{ ...S.cardPink }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f44336', marginBottom: 4 }}>Предупреждения о конкуренции</div>
            {mineralEntries.map(e => (
              <div key={e.id} style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 3 }}>
                <b style={{ color: 'var(--text-light)' }}>{e.nameRu}</b>: {e.competitors.map(c => c.withLabel).join(', ')}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

export default SupportTimingPlanner;