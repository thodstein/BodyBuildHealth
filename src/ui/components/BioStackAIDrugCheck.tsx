import React, { useState, useMemo } from 'react';
import { type BioStackProfile, saveBioStackProfile } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../data/support-database';
import { GlassCard, PillBtn, showToast, estCost } from './BioStackAIConstants';
import { KNOWN_DRUG_SUP_INTERACTIONS } from '../../engines/biostack-clinical';
import type { DrugSupInteraction } from '../../engines/biostack-clinical';

/* ─── Clinical known interactions (drug-supplement) — imported from shared DB ─── */

/* ─── Drug synonym map for fuzzy matching ─── */
const DRUG_SYNONYM_MAP_DRUGCHECK: Record<string, string[]> = {
  'иАПФ': ['иАПФ (рамиприл)', 'лизиноприл', 'эналаприл', 'каптоприл', 'периндоприл', 'квинаприл', 'фозиноприл', 'трандолаприл', 'беназеприл', 'моэксиприл'],
  'АРА': ['АРА (лозартан)', 'лозартан', 'валсартан', 'ирбесартан', 'кандесартан', 'телмисартан', 'эпросартан', 'олмесартан', 'азилсартан'],
  'β-блокаторы': ['β-блокаторы (бисопролол)', 'бисопролол', 'метопролол', 'атенолол', 'пропранолол', 'небиволол', 'карведилол', 'лабеталол', 'бетаксолол','эсмолол'],
  'БКК': ['БКК (амлодипин)', 'амлодипин', 'нифедипин', 'фелодипин', 'верапамил', 'дилтиазем', 'лацидипин', 'лерканидипин'],
  'СИОЗС': ['эсциталопрам (СИОЗС)', 'эсциталопрам', 'циталопрам', 'флуоксетин', 'пароксетин', 'сертралин', 'флувоксамин'],
  'СИОЗСиН': ['СИОЗСиН (венлафаксин)', 'венлафаксин', 'дулоксетин', 'левомилнаципран'],
  'ИПП': ['ингибиторы протонной помпы', 'омепразол', 'эзомепразол', 'лансопразол', 'пантопразол', 'рабепразол'],
  'статины': ['аторвастатин', 'розувастатин', 'симвастатин', 'ловастатин', 'правастатин', 'питавастатин', 'флувастатин'],
  'НПВС': ['НПВС (ибупрофен)', 'НПВС (диклофенак)', 'ибупрофен', 'диклофенак', 'напроксен', 'кетопрофен', 'индометацин', 'мелоксикам', 'целекоксиб', 'эторикоксиб'],
  'ГКС': ['глюкокортикоиды (преднизолон)', 'преднизолон', 'метилпреднизолон', 'дексаметазон', 'гидрокортизон', 'триамцинолон'],
  'диуретики': ['тиазидные (гидрохлоротиазид)', 'петлевые (фуросемид)', 'калийсберегающие (спиронолактон)', 'гидрохлоротиазид', 'фуросемид', 'торасемид', 'индапамид', 'хлорталидон'],
  'антикоагулянты': ['варфарин', 'апиксабан', 'дабигатран', 'ривароксабан', 'эдоксабан'],
  'противоэпилептические': ['вальпроат', 'карбамазепин', 'топирамат', 'ламотриджин', 'окскарбазепин', 'леветирацетам'],
  'бензодиазепины': ['бензодиазепины', 'диазепам', 'алпразолам', 'лоразепам', 'клоназепам', 'феназепам', 'бромазепам'],
  'антипсихотики': ['оланзапин', 'клозапин', 'рисперидон', 'кетоконазол', 'галоперидол', 'кветиапин'],
  'метформин': ['метформин', 'сиофор', 'глюкофаж'],
  'ПДЭ-5': ['ПДЭ-5 (силденафил)', 'ПДЭ-5 (тадалафил)', 'силденафил', 'тадалафил', 'варденафил'],
};

function expandDrugMatches(input: string): string[] {
  const lowered = input.toLowerCase().trim();
  const results = new Set<string>();
  results.add(lowered);
  for (const [className, synonyms] of Object.entries(DRUG_SYNONYM_MAP_DRUGCHECK)) {
    const loweredClass = className.toLowerCase();
    if (lowered.includes(loweredClass) || loweredClass.includes(lowered)) {
      synonyms.forEach(s => results.add(s.toLowerCase()));
    }
    for (const syn of synonyms) {
      const loweredSyn = syn.toLowerCase();
      if (lowered.includes(loweredSyn) || loweredSyn.includes(lowered)) {
        results.add(loweredClass);
        synonyms.forEach(s => results.add(s.toLowerCase()));
      }
    }
  }
  return [...results];
}

const CYP450_LABELS: Record<string, string> = {
  unknown: '❓ Неизвестен',
  normal: '🟢 Нормальный (EM)',
  poor: '🔴 Медленный (PM)',
  intermediate: '🟡 Промежуточный (IM)',
  rapid: '🔵 Быстрый (RM)',
};

const CYP_DETAILS: Record<string, string> = {
  unknown: 'Стандартные дозировки. Для точной настройки — фармакогенетическое тестирование.',
  normal: 'Стандартный метаболизм через CYP450.',
  poor: 'Риск токсичности: дозы субстратов CYP снизить в 2-4 раза. Особое внимание — CYP2D6, CYP2C19, CYP3A4.',
  intermediate: 'Умеренное снижение метаболизма. Начинать с 50% дозы, титровать.',
  rapid: 'Ускоренный метаболизм: возможны более высокие дозы. Пролекарства → риск токсичных метаболитов.',
};

/* ─── Drug Check Tab ─── */
export function DrugCheckTab({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const [medInput, setMedInput] = useState(profile.currentMeds.join(', '));
  const [allergyInput, setAllergyInput] = useState(profile.drugAllergies.join(', '));
  const [cypState, setCypState] = useState('unknown' as string);
  const [results, setResults] = useState<Array<{
    drug: string; substance: string; effect: string; severity: string; mechanism: string;
  }> | null>(null);
  const [checkMode, setCheckMode] = useState<'stack' | 'catalog'>('stack');

  const catalogSearch = useMemo(() => {
    if (checkMode !== 'catalog') return null;
    const drugs = medInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (drugs.length === 0) return null;
    const found: Array<{ drug: string; substance: string; effect: string; severity: string; mechanism: string }> = [];
    for (const drug of drugs) {
      const expandedDrugs = expandDrugMatches(drug);
      for (const [id, cat] of Object.entries(SUPPORT_CATALOG_DATA)) {
        const subName = (cat.nameRu || cat.name || id).toLowerCase();
        const direct = KNOWN_DRUG_SUP_INTERACTIONS.filter(k =>
          expandedDrugs.some(d => d.includes(k.drug) || k.drug.includes(d)) &&
          (subName.includes(k.substance) || id.includes(k.substance))
        );
        direct.forEach(d => found.push({ ...d, substance: cat.nameRu || cat.name || id }));
      }
    }
    return found;
  }, [medInput, checkMode]);

  const runCheck = () => {
    const drugs = medInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    const allergies = allergyInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (drugs.length === 0) { showToast('Введите хотя бы одно лекарство', 'error'); return; }

    saveBioStackProfile({ ...profile, currentMeds: drugs, drugAllergies: allergies });

    const res: Array<{ drug: string; substance: string; effect: string; severity: string; mechanism: string }> = [];
    const targetIds = checkMode === 'stack' ? stackIds : Object.keys(SUPPORT_CATALOG_DATA).slice(0, 50);

    for (const drug of drugs) {
      const expandedDrugs = expandDrugMatches(drug);
      for (const id of targetIds) {
        const cat = SUPPORT_CATALOG_DATA[id];
        if (!cat) continue;
        const subName = (cat.nameRu || cat.name || id).toLowerCase();
        const direct = KNOWN_DRUG_SUP_INTERACTIONS.filter(k =>
          expandedDrugs.some(d => d.includes(k.drug) || k.drug.includes(d)) &&
          (subName.includes(k.substance) || id.includes(k.substance))
        );
        direct.forEach(d => res.push({ ...d, substance: cat.nameRu || cat.name || id }));
      }
    }

    for (const allergy of allergies) {
      for (const id of (checkMode === 'stack' ? stackIds : Object.keys(SUPPORT_CATALOG_DATA).slice(0, 50))) {
        const cat = SUPPORT_CATALOG_DATA[id];
        if (!cat) continue;
        const subName = (cat.nameRu || cat.name || id).toLowerCase();
        if (subName.includes(allergy) || allergy.includes(id)) {
          res.push({
            drug: allergy, substance: cat.nameRu || cat.name || id,
            effect: '⚠ ВОЗМОЖНА АЛЛЕРГИЧЕСКАЯ РЕАКЦИЯ', severity: 'HIGH',
            mechanism: 'Перекрёстная аллергия',
          });
        }
      }
    }

    if (res.length === 0) {
      res.push({
        drug: drugs.join(', '), substance: checkMode === 'stack' ? 'Ваш стек' : 'Каталог',
        effect: '✅ Клинически значимых взаимодействий не найдено',
        severity: 'LOW', mechanism: 'Нет данных о взаимодействии',
      });
    }
    setResults(res);
    // Persist HIGH interactions to localStorage for Dashboard warning
    const high = res.filter(r => r.severity === 'HIGH');
    try { localStorage.setItem('he_drug_warnings', JSON.stringify({ date: new Date().toISOString(), count: res.length, highCount: high.length, warnings: high.map(r => `${r.drug} + ${r.substance}`) })); } catch {}
  };

  const maxSev = results ? Math.max(...results.map(r => r.severity === 'HIGH' ? 2 : r.severity === 'MEDIUM' ? 1 : 0)) : 0;
  const overallColor = maxSev === 2 ? '#ef4444' : maxSev === 1 ? '#f59e0b' : '#22c55e';
  const overallText = maxSev === 2 ? '🔴 Обнаружены КРИТИЧЕСКИЕ взаимодействия' : maxSev === 1 ? '🟡 Обнаружены умеренные взаимодействия' : '🟢 Безопасно';

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="💊 Детальная проверка лекарственных взаимодействий" icon="💊" color="#ef4444">
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 8, lineHeight: 1.3 }}>
          🔬 Введите названия принимаемых вами лекарств (МНН). Система проверит пересечения — со стеком БАДов или со всем каталогом.
        </div>

        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>
            💊 Лекарства (через запятую, МНН):
          </label>
          <textarea value={medInput} onChange={e => setMedInput(e.target.value)}
            placeholder="варфарин, метформин, аторвастатин, рамиприл, эсциталопрам, омепразол..."
            rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 10, boxSizing: 'border-box', resize: 'none' }} />
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>⚠ Аллергии:</label>
            <input value={allergyInput} onChange={e => setAllergyInput(e.target.value)}
              placeholder="пенициллин, сульфаниламиды..."
              style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 9, boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>🧬 CYP450:</label>
            <select value={cypState} onChange={e => setCypState(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 9, appearance: 'none' }}>
              {Object.entries(CYP450_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <PillBtn active={checkMode === 'stack'} onClick={() => setCheckMode('stack')} color="#60a5fa">
            📋 По моему стеку ({stackIds.length})
          </PillBtn>
          <PillBtn active={checkMode === 'catalog'} onClick={() => setCheckMode('catalog')} color="#8b5cf6">
            📚 По всему каталогу
          </PillBtn>
        </div>

        <button onClick={runCheck} style={{
          width: '100%', padding: '12px 0', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 11,
          background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff', marginBottom: 6,
        }}>🔍 Проверить взаимодействия</button>

        {checkMode === 'catalog' && !results && catalogSearch && catalogSearch.length > 0 && (
          <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', marginBottom: 6, fontSize: 8, color: '#f59e0b' }}>
            ⚡ Найдено {catalogSearch.length} пересечений с каталогом. Нажмите «Проверить» для деталей.
          </div>
        )}
      </GlassCard>

      {results && (
        <GlassCard title="📊 Результаты проверки" color={overallColor}>
          <div style={{
            padding: '8px 10px', borderRadius: 8, marginBottom: 8,
            background: `${overallColor}10`, border: `1px solid ${overallColor}25`,
            fontSize: 10, fontWeight: 700, color: overallColor, textAlign: 'center',
          }}>{overallText} ({results.length} находок)</div>

          {cypState !== 'unknown' && (
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)', marginBottom: 8 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#a78bfa' }}>🧬 CYP450: {CYP450_LABELS[cypState]}</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>{CYP_DETAILS[cypState]}</div>
            </div>
          )}

          {(() => {
            const drugs = medInput.split(',').map((d: string) => d.trim().toLowerCase()).filter(Boolean);
            if (drugs.length === 0) return null;
            const riskIcons: Record<string, string> = { cv:'❤️', liv:'🟢', ren:'🔵', cns:'🧠', rep:'🔴', hem:'💉' };
            const riskNotes: Record<string, string[]> = {};
            for (const drug of drugs) {
              const lowered = drug.trim();
              if (lowered.includes('иАПФ') || lowered.includes('рамиприл') || lowered.includes('эналаприл')) riskNotes['ren'] = ['ren','Гемодинамика почек (креатинин ↑)'];
              if (lowered.includes('АРА') || lowered.includes('лозартан') || lowered.includes('валсартан')) riskNotes['ren'] = ['ren','Нефропротекция'];
              if (lowered.includes('блокатор') || lowered.includes('бисопролол') || lowered.includes('метопролол')) riskNotes['cv'] = ['cv','ЧСС ↓ — защита, блокада β₂'];
              if (lowered.includes('БКК') || lowered.includes('амлодипин') || lowered.includes('нифедипин')) riskNotes['cv'] = ['cv','Снижение АД, антиангинальный'];
              if (lowered.includes('диуретик') || lowered.includes('фуросемид') || lowered.includes('гидрохлоротиазид')) { riskNotes['ren'] = ['ren','Водно-электролитные сдвиги']; riskNotes['hem'] = ['hem','Гипокалиемия → ↑ глюкоза']; }
              if (lowered.includes('СИОЗС') || lowered.includes('эсциталопрам') || lowered.includes('флуоксетин')) { riskNotes['cns'] = ['cns','↑ Серотонин, риск серотонинового синдрома']; riskNotes['rep'] = ['rep','↓ Либидо']; }
              if (lowered.includes('статины') || lowered.includes('аторвастатин') || lowered.includes('розувастатин')) riskNotes['liv'] = ['liv','↑ Трансаминаз'];
              if (lowered.includes('НПВС') || lowered.includes('ибупрофен') || lowered.includes('диклофенак')) { riskNotes['ren'] = ['ren','↓ Почечный кровоток']; riskNotes['cv'] = ['cv','↑ АД, ↑ тромботический риск']; }
              if (lowered.includes('метформин')) riskNotes['hem'] = ['hem','↓ Инсулинорезистентность'];
              if (lowered.includes('ГКС') || lowered.includes('преднизолон') || lowered.includes('дексаметазон')) { riskNotes['hem'] = ['hem','Инсулинорезистентность']; riskNotes['cv'] = ['cv','Задержка Na/H₂O']; }
              if (lowered.includes('антикоагулянт') || lowered.includes('варфарин') || lowered.includes('апиксабан')) riskNotes['hem'] = ['hem','Геморрагический риск'];
            }
            const riskEntries = Object.values(riskNotes);
            if (riskEntries.length === 0) return null;
            return (
              <div style={{ marginTop: 8, padding: '7px 9px', borderRadius: 8, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.08)' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>⚠ Влияние лекарств на системы риска</div>
                {riskEntries.map(([sys, note], i) => (
                  <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start', marginBottom: i < riskEntries.length - 1 ? 3 : 0 }}>
                    <span style={{ fontSize:8 }}>{riskIcons[sys] || '⚪'}</span>
                    <span style={{ fontSize:7, color:'rgba(255,255,255,0.5)' }}>{note}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {results.map((r, i) => (
              <div key={i} style={{
                padding: '7px 9px', borderRadius: 8,
                background: r.severity === 'HIGH' ? 'rgba(239,68,68,0.06)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)',
                border: `1px solid ${r.severity === 'HIGH' ? 'rgba(239,68,68,0.12)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                      background: r.severity === 'HIGH' ? 'rgba(239,68,68,0.15)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                      color: r.severity === 'HIGH' ? '#ef4444' : r.severity === 'MEDIUM' ? '#f59e0b' : '#22c55e',
                    }}>{r.severity === 'HIGH' ? '🔴 ВЫСОКИЙ' : r.severity === 'MEDIUM' ? '🟡 СРЕДНИЙ' : '🟢 НИЗКИЙ'}</span>
                  </div>
                  <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{r.drug} + {r.substance}</span>
                </div>
                <div style={{ fontSize: 8, color: '#fff', lineHeight: 1.3 }}>{r.effect}</div>
                <div style={{ fontSize: 7, color: '#a78bfa', lineHeight: 1.2, marginTop: 1 }}>🧬 {r.mechanism}</div>
              </div>
            ))}
          </div>

          {maxSev === 2 && (
            <div style={{
              marginTop: 8, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
              fontSize: 9, color: '#fca5a5', lineHeight: 1.4,
            }}>
              ⚠ КЛИНИЧЕСКАЯ РЕКОМЕНДАЦИЯ: Выявлены высокорисковые взаимодействия.
              Пожалуйста, проконсультируйтесь с лечащим врачом перед приёмом БАДов.
              Не отменяйте и не меняйте дозировку назначенных лекарств самостоятельно.
            </div>
          )}

          <button onClick={() => {
            const txt = results.map(r => `${r.severity === 'HIGH' ? '🔴' : r.severity === 'MEDIUM' ? '🟡' : '🟢'} ${r.drug} + ${r.substance}: ${r.effect}`).join('\n');
            navigator.clipboard.writeText(txt);
            showToast('Скопировано', 'success');
          }} style={{
            width: '100%', padding: '8px 0', borderRadius: 8, marginTop: 6, cursor: 'pointer', fontSize: 9, fontWeight: 600,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
          }}>📋 Копировать результат</button>
        </GlassCard>
      )}
    </div>
  );
}
