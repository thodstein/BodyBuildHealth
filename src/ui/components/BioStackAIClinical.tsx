import React, { useState, useMemo } from 'react';
import { type BioStackProfile, saveBioStackProfile } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../data/support-database';
import { LAB_MARKER_MAP } from '../../data/lab-marker-map';
import { GlassCard, PillBtn, showToast, estCost } from './BioStackAIConstants';
import type { LinkedData } from '../../core/data-link';
import { KNOWN_DRUG_SUP_INTERACTIONS } from '../../engines/biostack-clinical';

const CYP450_LABELS: Record<string, string> = {
  unknown: '❓ Неизвестен',
  normal: '🟢 Нормальный (EM)',
  poor: '🔴 Медленный (PM)',
  intermediate: '🟡 Промежуточный (IM)',
  rapid: '🔵 Быстрый (RM)',
};

const CYP_DETAILS: Record<string, string> = {
  unknown: 'Рекомендуется стандартная дозировка. Для точной настройки — фармакогенетическое тестирование.',
  normal: 'Стандартный метаболизм через CYP450. Обычные дозировки.',
  poor: 'Повышен риск токсичности: требуется снижение доз в 2-4 раза для субстратов CYP. Особое внимание — CYP2D6, CYP2C19, CYP3A4.',
  intermediate: 'Умеренное снижение метаболизма. Начинайте с 50% дозы, титруйте под контролем.',
  rapid: 'Ускоренный метаболизм: могут потребоваться более высокие дозы для достижения эффекта. Пролекарства (кодеин, трамадол) → токсичные метаболиты.',
};

/* ─── KNOWN_DRUG_SUP_INTERACTIONS imported from src/engines/biostack-clinical.ts ─── */

// ─── Drug synonym/class map: конкретные МНН → каноническое имя в KNOWN_DRUG_SUP_INTERACTIONS ───
const DRUG_SYNONYM_MAP: Record<string, string[]> = {
  'иАПФ': ['иАПФ (рамиприл)', 'лизиноприл', 'эналаприл', 'каптоприл', 'периндоприл', 'квинаприл', 'фозиноприл', 'трандолаприл', 'беназеприл', 'моэксиприл', 'рамиприл'],
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

// Вспомогательная: расширяет название лекарства до всех возможных совпадений (синонимы + класс)
function expandDrugMatches(input: string): string[] {
  const lowered = input.toLowerCase().trim();
  const results = new Set<string>();
  results.add(lowered);
  // Ищем класс, к которому относится этот препарат, и добавляем все его синонимы
  for (const [className, synonyms] of Object.entries(DRUG_SYNONYM_MAP)) {
    const loweredClass = className.toLowerCase();
    // Если ввод содержит название класса ИЛИ класс содержит ввод → добавляем все синонимы
    if (lowered.includes(loweredClass) || loweredClass.includes(lowered)) {
      synonyms.forEach(s => results.add(s.toLowerCase()));
    }
    // Если ввод совпадает с любым синонимом → добавляем класс и все синонимы класса
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

// ─── Маппинг классов лекарств → системы риска ТЗ ───
const DRUG_CLASS_RISK_IMPACT: Record<string, { system: string; direction: 'up'|'down'|'both'; note: string }[]> = {
  'иАПФ': [{ system:'ren', direction:'up', note:'Гемодинамика/фильтрация (креатинин ↑) при стенозе почечной артерии' }],
  'АРА': [{ system:'ren', direction:'down', note:'Нефропротекция (защита клубочков)' }, { system:'hem', direction:'down', note:'MetS/ИР — нейтрально-положительно' }],
  'β-блокаторы': [{ system:'cv', direction:'both', note:'ЧСС ↓ — защита, но блокада β₂ → периферический сосудистый тонус ↑' }, { system:'hem', direction:'up', note:'Маскировка гипогликемии, ↑ ТГ' }],
  'БКК': [{ system:'cv', direction:'down', note:'Снижение АД, антиангинальный' }, { system:'hem', direction:'down', note:'Нейтрально к липидам/глюкозе' }],
  'диуретики': [{ system:'ren', direction:'up', note:'Водно-электролитные сдвиги (K⁺, Na⁺, объём)' }, { system:'hem', direction:'up', note:'Гипокалиемия ↑ глюкозу, ↑ мочевую кислоту' }],
  'СИОЗС': [{ system:'cns', direction:'both', note:'↑ серотонин — коррекция нейромедиаторной, но риск серотонинового синдрома с MAO-БАД' }, { system:'rep', direction:'up', note:'Снижение либидо, задержка эякуляции (↓ репродуктивной)' }],
  'СИОЗСиН': [{ system:'cv', direction:'up', note:'↑ ЧСС, ↑ АД (норадреналиновый компонент)' }, { system:'cns', direction:'both', note:'Облегчение боли/нейропатии, но ↑ тревоги старт' }],
  'ИПП': [{ system:'liv', direction:'up', note:'Риск холестаза при длительном приёме (↓ Mg → ↑ печёночные ферменты)' }, { system:'hem', direction:'up', note:'↓ B₁₂, ↑ Mg — гипомагниемия → ↑ риск аритмий' }],
  'статины': [{ system:'liv', direction:'up', note:'↑ трансаминаз (дозозависимо, обычно транзиторно)' }, { system:'cns', direction:'up', note:'Редко — когнитивные жалобы, ↑ риск полинейропатии' }],
  'НПВС': [{ system:'ren', direction:'up', note:'↓ простагландины → ↓ почечный кровоток, задержка Na/H₂O, ↑ креатинина' }, { system:'liv', direction:'up', note:'Гепатотоксичность (редко, идиосинкразическая)' }, { system:'cv', direction:'up', note:'↑ АД (Na/H₂O задержка + сосудистый тонус), ↑ тромботический риск' }],
  'ГКС': [{ system:'hem', direction:'up', note:'Инсулинорезистентность, ↑ глюкоза, ↑ ТГ, ↑ аппетит' }, { system:'cv', direction:'up', note:'Задержка Na/H₂O, ↑ АД' }, { system:'ren', direction:'up', note:'Водно-электролитный сдвиг (гипокалиемия)' }, { system:'liv', direction:'up', note:'Гепатоцеллюлярная нагрузка, жировой гепатоз' }],
  'антикоагулянты': [{ system:'hem', direction:'up', note:'Геморрагический риск, контроль INR/MHO' }],
  'бензодиазепины': [{ system:'cns', direction:'up', note:'Снижение GABA-реактивности, толерантность, когнитивное снижение при длительном приёме' }],
  'антипсихотики': [{ system:'hem', direction:'up', note:'↑ Пролактин → ИР, ↑ ТГ, ↑ глюкоза' }, { system:'cv', direction:'up', note:'Удлинение QT, ↑ риск аритмий' }],
  'метформин': [{ system:'hem', direction:'down', note:'↓ Инсулинорезистентность, ↓ глюкоза — метаболический профиль' }, { system:'liv', direction:'down', note:'↓ Отложения жира в печени (NAFLD)' }],
  'ПДЭ-5': [{ system:'cv', direction:'down', note:'Вазодилатация, ↓ АД (осторожно с нитратами)' }, { system:'rep', direction:'down', note:'Улучшение эректильной функции' }],
};

// Возвращает summary-строку по системе риска для заданного набора лекарств
function getDrugRiskSummary(drugs: string[]): { system: string; icon: string; note: string; color: string }[] {
  const impacted = new Map<string, { note: string; direction: 'up'|'down'|'both' }>();
  for (const drug of drugs) {
    const expanded = expandDrugMatches(drug);
    for (const match of expanded) {
      for (const [className, impacts] of Object.entries(DRUG_CLASS_RISK_IMPACT)) {
        if (className.toLowerCase() === match || match.includes(className.toLowerCase()) || className.toLowerCase().includes(match)) {
          impacts.forEach(imp => {
            const existing = impacted.get(imp.system);
            if (!existing) impacted.set(imp.system, { note: imp.note, direction: imp.direction });
            else if (imp.direction !== existing.direction && imp.direction !== 'both') {
              impacted.set(imp.system, { note: existing.note + '; ' + imp.note, direction: 'both' });
            }
          });
        }
      }
    }
  }
  const icons: Record<string, string> = { cv:'❤️', liv:'🟢', ren:'🔵', cns:'🧠', rep:'🔴', hem:'💉' };
  const colors: Record<string, string> = { up:'#ef4444', down:'#4caf50', both:'#f59e0b' };
  return [...impacted.entries()].map(([system, val]) => ({
    system, icon: icons[system] || '⚪',
    note: val.note, color: colors[val.direction] || '#94a3b8',
  }));
}

/* ─── DrugCheck card ─── */
export function DrugCheckCard({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const [medsInput, setMedsInput] = useState(profile.currentMeds.join(', '));
  const [alergiesInput, setAlergiesInput] = useState(profile.drugAllergies.join(', '));
  const [checkResult, setCheckResult] = useState<Array<{ drug: string; substance: string; effect: string; severity: string; mechanism: string; inStack: boolean }> | null>(null);
  const [cypState, setCypState] = useState('unknown' as string);

  const check = () => {
    const drugs = medsInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    const allergies = alergiesInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (drugs.length === 0) { showToast('Введите хотя бы одно лекарство', 'error'); return; }

    // Save to profile
    saveBioStackProfile({ ...profile, currentMeds: drugs, drugAllergies: allergies });

    // Check interactions
    const results: Array<{ drug: string; substance: string; effect: string; severity: string; mechanism: string; inStack: boolean }> = [];
    for (const drug of drugs) {
      const expandedDrugs = expandDrugMatches(drug);
      for (const sub of stackIds) {
        const cat = SUPPORT_CATALOG_DATA[sub];
        if (!cat) continue;
        const subName = (cat.nameRu || cat.name || sub).toLowerCase();
        // Direct match in known interactions (with synonym expansion)
        const direct = KNOWN_DRUG_SUP_INTERACTIONS.filter(k =>
          expandedDrugs.some(d => d.includes(k.drug) || k.drug.includes(d)) &&
          (subName.includes(k.substance) || k.substance.includes(sub))
        );
        if (direct.length > 0) {
          direct.forEach(d => results.push({ ...d, inStack: true }));
        }
        // Check ALL_INTERACTIONS for drug-like substances
        const fromAll = ALL_INTERACTIONS.filter((i: any) =>
          (i.substanceA?.toLowerCase?.() === sub || i.substanceB?.toLowerCase?.() === sub) &&
          expandedDrugs.some(d => i.substanceA?.toLowerCase?.().includes(d) || i.substanceB?.toLowerCase?.().includes(d))
        );
        if (fromAll.length > 0) {
          fromAll.forEach(i => results.push({
            drug, substance: subName,
            effect: i.effect || 'Взаимодействие', severity: i.severity || 'MEDIUM',
            mechanism: (i as any).mechanism || i.mechanisms?.join(', ') || '',
            inStack: true,
          }));
        }
      }
    }

    // Allergy check
    for (const allergy of allergies) {
      for (const sub of stackIds) {
        const cat = SUPPORT_CATALOG_DATA[sub];
        if (!cat) continue;
        const subName = (cat.nameRu || cat.name || sub).toLowerCase();
        if (subName.includes(allergy) || allergy.includes(sub)) {
          results.push({
            drug: allergy, substance: subName,
            effect: '⚠ ВОЗМОЖНА АЛЛЕРГИЧЕСКАЯ РЕАКЦИЯ', severity: 'HIGH',
            mechanism: 'Перекрёстная аллергия / известная гиперчувствительность', inStack: true,
          });
        }
      }
    }

    if (results.length === 0) {
      results.push({
        drug: drugs[0], substance: stackIds.map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || id).join(', '),
        effect: '✅ В известной базе взаимодействий не найдено. Рекомендуется контроль врача.',
        severity: 'LOW', mechanism: 'Нет известных данных о клинически значимых взаимодействиях', inStack: true,
      });
    }
    setCheckResult(results);
    // Persist HIGH interactions to localStorage for Dashboard warning
    const high = results.filter(r => r.severity === 'HIGH');
    try { localStorage.setItem('he_drug_warnings', JSON.stringify({ date: new Date().toISOString(), count: results.length, highCount: high.length, warnings: high.map(r => `${r.drug} + ${r.substance}`) })); } catch {}
  };

  const maxSev = checkResult ? Math.max(...checkResult.map(r => r.severity === 'HIGH' ? 2 : r.severity === 'MEDIUM' ? 1 : 0)) : 0;
  const overallColor = maxSev === 2 ? '#ef4444' : maxSev === 1 ? '#f59e0b' : '#22c55e';
  const overallText = maxSev === 2 ? '🔴 Критические взаимодействия' : maxSev === 1 ? '🟡 Умеренные взаимодействия' : '🟢 Безопасно';

  return (
    <GlassCard title="💊 Проверка лекарственных взаимодействий" icon="💊" color="#ef4444">
      {profile.currentMeds.length === 0 && (
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginBottom: 6, lineHeight: 1.3 }}>
          🔬 Введите названия принимаемых лекарств (МНН через запятую). Система проверит пересечения с вашим стеком БАДов.
        </div>
      )}
      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>💊 Рецептурные лекарства (МНН, через запятую):</label>
        <textarea value={medsInput} onChange={e => setMedsInput(e.target.value)}
          placeholder="варфарин, метформин, рамиприл, аторвастатин, эсциталопрам..."
          rows={2}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 10, boxSizing: 'border-box', resize: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>⚠ Лекарственные аллергии:</label>
          <input value={alergiesInput} onChange={e => setAlergiesInput(e.target.value)} placeholder="пенициллин, сульфаниламиды..."
            style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 9, boxSizing: 'border-box' }} />
        </div>
          <select value={cypState} onChange={e => { setCypState(e.target.value); }}
          style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 9, appearance: 'none' }}>
          {Object.entries(CYP450_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <button onClick={check} style={{
        width: '100%', padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 11,
        background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff', marginBottom: 8,
      }}>🔍 Проверить взаимодействия</button>

      {checkResult && (
        <div>
          <div style={{
            padding: '8px 10px', borderRadius: 8, marginBottom: 8,
            background: `${overallColor}08`, border: `1px solid ${overallColor}20`,
            fontSize: 9, fontWeight: 700, color: overallColor, textAlign: 'center',
          }}>{overallText} ({checkResult.length} находок)</div>

          {cypState !== 'unknown' && (
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)', marginBottom: 8 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#a78bfa', marginBottom: 2 }}>🧬 CYP450: {CYP450_LABELS[cypState]}</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>{CYP_DETAILS[cypState]}</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {checkResult.map((r, i) => (
              <div key={i} style={{
                padding: '7px 9px', borderRadius: 8,
                background: r.severity === 'HIGH' ? 'rgba(239,68,68,0.06)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)',
                border: `1px solid ${r.severity === 'HIGH' ? 'rgba(239,68,68,0.12)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
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
              marginTop: 8, padding: '8px 10px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
              fontSize: 9, color: '#fca5a5', lineHeight: 1.4,
            }}>
              ⚠ КЛИНИЧЕСКАЯ РЕКОМЕНДАЦИЯ: Обнаружены высокорисковые взаимодействия лекарств с БАДами.
              Рекомендуется консультация врача для коррекции терапии. Не отменяйте назначенные лекарства самостоятельно.
            </div>
          )}
          {cypState !== 'unknown' && cypState !== 'normal' && (
            <div style={{
              marginTop: 8, padding: '8px 10px', borderRadius: 8,
              background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)',
              fontSize: 9, color: '#fcd34d', lineHeight: 1.4,
            }}>
              ⚠ ФАРМАКОГЕНЕТИКА: Ваш CYP450 статус ({cypState}) требует индивидуального подбора доз.
              Учитывайте это при назначении новых препаратов.
            </div>
          )}

          {/* Влияние лекарств на системы риска */}
          {(() => {
            const drugs = medsInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
            if (drugs.length === 0) return null;
            const riskSummary = getDrugRiskSummary(drugs);
            if (riskSummary.length === 0) return null;
            return (
              <div style={{ marginTop: 8, padding: '7px 9px', borderRadius: 8, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.08)' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>⚠ Влияние лекарств на системы риска</div>
                {riskSummary.map((r, i) => (
                  <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start', marginBottom: i < riskSummary.length - 1 ? 3 : 0 }}>
                    <span>{r.icon}</span>
                    <div style={{ flex:1 }}>
                      <span style={{ fontSize: 8, color: r.color, fontWeight: 600 }}>{r.icon} {r.system.toUpperCase()}</span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>{r.note}</span>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)', marginTop: 3, lineHeight: 1.2 }}>
                  Учитывается при расчёте рисков и подборе поддержки
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </GlassCard>
  );
}

/* ─── Lab short link card (переход в полную лабораторию) ─── */
export function LabShortcutCard({ linked, onNavigate }: { linked?: LinkedData | null; onNavigate?: () => void }) {
  const labs = linked?.labAnalysis;
  const devCount = labs?.interpretations?.filter((i: any) => i.status === 'high' || i.status === 'critical_high' || i.status === 'low')?.length || 0;

  return (
    <GlassCard title="🧪 Анализы → БАДы" icon="🧪" color="#a78bfa" onClick={onNavigate} style={{ cursor: 'pointer' }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '4px 0', lineHeight: 1.4 }}>
        {!labs ? '🔬 Нет данных. Заполните Лабораторию.' :
         devCount === 0 ? '✅ Все показатели в норме' :
         `⚠ ${devCount} отклонений — нажмите для детального анализа`}
      </div>
      <div style={{ fontSize: 7, color: 'rgba(167,139,250,0.5)', textAlign: 'center', marginTop: 4 }}>
        🧪 Открыть глубинный анализ лаборатории →
      </div>
    </GlassCard>
  );
}

/* ─── ClinicalNote card (Patient Summary) ─── */
export function ClinicalNoteCard({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const [mode, setMode] = useState<'summary' | 'doctor' | 'schedule'>('summary');

  const note = useMemo(() => {
    if (mode === 'summary') {
      const lines: string[] = [];
      const goalLabel = (g: string) => {
        const map: Record<string, string> = {
          muscle_gain:'рост мышечной массы', fat_loss:'снижение жировой массы',
          endurance:'выносливость', sleep:'качество сна', recovery:'восстановление',
          energy:'энергия', libido:'либидо', concentration:'фокус', brain:'когнитивные функции',
          mood:'настроение', stress:'стресс', cardio_health:'здоровье ССС',
          immunity:'иммунитет', hormones:'гормональный баланс', joints:'суставы',
          digestion:'пищеварение', detox:'детоксикация', longevity:'долголетие',
          liver_health:'здоровье печени', kidney:'здоровье почек', skin:'кожа', hair:'волосы',
        };
        return map[g] || g;
      };
      lines.push(`📋 **Клиническая сводка**`);
      lines.push(`Пациент: ${profile.sex === 'male' ? '♂' : '♀'} ${profile.age} лет, ${profile.weight} кг, ${profile.height} см`);
      lines.push(`Уровень: ${profile.experience === 'beginner' ? 'Начинающий' : profile.experience === 'intermediate' ? 'Средний' : 'Продвинутый'}`);
      if (profile.healthConditions.length > 0) {
        const condMap: Record<string, string> = { liver:'заболевания печени', kidney:'заболевания почек', heart:'заболевания ССС', thyroid:'заболевания ЩЖ', stomach:'заболевания ЖКТ', pressure_high:'гипертония', pressure_low:'гипотония', diabetes:'сахарный диабет', autoimmune:'аутоиммунные заболевания' };
        lines.push(`Состояния: ${profile.healthConditions.map(h => condMap[h] || h).join(', ')}`);
      }
      if (profile.goals.length > 0) lines.push(`Цели: ${profile.goals.map(g => goalLabel(g)).join(', ')}`);
      if (profile.currentMeds.length > 0) lines.push(`Лекарства: ${profile.currentMeds.join(', ')}`);
      if (profile.drugAllergies.length > 0) lines.push(`Аллергии: ${profile.drugAllergies.join(', ')}`);
      if (profile.healthConditions.length > 0) lines.push(`Состояния здоровья: ${profile.healthConditions.join(', ')}`);
      lines.push(`ААС: ${profile.aasStatus === 'none' ? 'Нет' : profile.aasStatus}`);
      lines.push(`ААС: ${profile.aasStatus === 'none' ? 'Нет' : profile.aasStatus}`);
      lines.push(`Бюджет: ${profile.budget === 'economy' ? 'Эконом' : profile.budget === 'medium' ? 'Средний' : 'Премиум'}`);
      lines.push(`---`);
      lines.push(`**Текущий стек БАДов (${stackIds.length} веществ):**`);
      stackIds.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) lines.push(`- ${c.nameRu || c.name || id} (${c.tier || 'standard'})`);
      });
      if (stackIds.length === 0) lines.push('(стек не собран)');
      // Contraindication summary
      const allContras = new Map<string, { subs: string[]; severity: string }>();
      stackIds.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c?.contraindications?.length) {
          c.contraindications.slice(0, 3).forEach((contra: string) => {
            const key = contra.slice(0, 60);
            if (!allContras.has(key)) allContras.set(key, { subs: [], severity: 'medium' });
            allContras.get(key)!.subs.push(c.nameRu || c.name || id);
          });
        }
      });
      if (allContras.size > 0) {
        lines.push(`---`);
        lines.push(`**⚠ ПРОТИВОПОКАЗАНИЯ К СТЕКУ:**`);
        for (const [contra, info] of allContras) {
          lines.push(`- ${info.subs.slice(0, 2).join(', ')}: ${contra}`);
        }
      }
      lines.push(`---`);
      lines.push(`**Ориентировочная стоимость/мес:** ${stackIds.reduce((s, id) => s + estCost(id), 0).toLocaleString()} ₽`);
      lines.push(`**Рекомендация:** Перед началом приёма БАДов проконсультируйтесь с врачом. При появлении побочных эффектов — отмените приём.`);
      return lines.join('\n');
    }

    if (mode === 'doctor') {
      const lines: string[] = [];
      lines.push(`**ВРАЧЕБНОЕ ЗАКЛЮЧЕНИЕ ПО СТЕКУ БАД**`);
      lines.push(`Дата: ${new Date().toLocaleDateString('ru-RU')}`);
      lines.push(`Пациент: ${profile.sex === 'male' ? 'Мужчина' : 'Женщина'}, ${profile.age} лет`);
      lines.push(`---`);
      lines.push(`**Анамнез:** ${profile.healthConditions.length > 0 ? profile.healthConditions.join(', ') : 'без особенностей'}`);
      lines.push(`Здоровье: ${profile.healthConditions.length > 0 ? profile.healthConditions.join(', ') : 'без особенностей'}`);
      lines.push(`**Текущая терапия:** ${profile.currentMeds.length > 0 ? profile.currentMeds.join(', ') : 'не принимает'}`);
      lines.push(`**Аллергоанамнез:** ${profile.drugAllergies.length > 0 ? profile.drugAllergies.join(', ') : 'не отягощён'}`);
      lines.push(`---`);
      lines.push(`**Состав стека (${stackIds.length} веществ):**`);
      stackIds.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) {
          lines.push(`- **${c.nameRu || c.name || id}**`);
          if (c.description) lines.push(`  Описание: ${c.description.slice(0, 100)}`);
          if (c.forms && c.forms.length > 0) {
            const best = c.forms.find(d => d.best) || c.forms[0];
            lines.push(`  Форма: ${best.nameRu || best.name || ''} ${best.dose || ''}`);
          }
          if (c.contraindications && c.contraindications.length > 0) {
            lines.push(`  Противопоказания: ${c.contraindications.slice(0, 2).join('; ')}`);
          }
        }
      });
      lines.push(`---`);
      lines.push(`**Заключение:**`);
      if (profile.currentMeds.length > 0) {
        lines.push(`⚠ Пациент принимает рецептурные препараты. Требуется оценка лекарственных взаимодействий.`);
      }
      if (profile.healthConditions.length > 0) {
        lines.push(`⚠ Имеются хронические заболевания. Необходим контроль профильных маркеров.`);
      }
      lines.push(`Рекомендован контроль лабораторных показателей (АЛТ, АСТ, ГГТ, креатинин, липидограмма) через 4 недели после начала приёма.`);
      lines.push(`При появлении нежелательных явлений — отмена БАДов и консультация врача.`);
      return lines.join('\n');
    }

    if (mode === 'schedule') {
      const lines: string[] = [];
      lines.push(`**📅 РАСПИСАНИЕ ПРИЁМА БАД**`);
      lines.push(`Сгенерировано: ${new Date().toLocaleDateString('ru-RU')}`);
      lines.push(`Пациент: ${profile.age} лет, ${profile.sex === 'male' ? '♂' : '♀'}`);
      lines.push(`ААС: ${profile.aasStatus === 'none' ? 'Нет' : profile.aasStatus} · Бюджет: ${profile.budget === 'economy' ? 'Эконом' : profile.budget === 'medium' ? 'Средний' : 'Премиум'} · Стек: ${profile.stackComplexity === 'minimal' ? 'Мин' : profile.stackComplexity === 'balanced' ? 'Средний' : 'Макс'}`);
      lines.push(`---`);
      lines.push(`**🌅 УТРО (с завтраком):**`);
      const morning = ['omega3', 'coq10', 'vitamin_d3', 'zinc', 'selenium', 'curcumin', 'berberine', 'alpha_lipoic'];
      const morningItems = stackIds.filter(id => morning.includes(id) || !['tudca', 'magnesium', 'theanine', 'gaba', 'glycine', 'melatonin', 'ashwagandha', '5htp', 'l_tryptophan'].includes(id)).slice(0, 6);
      morningItems.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) lines.push(`- ${c.nameRu || c.name || id}`);
      });
      lines.push(`---`);
      lines.push(`**🌇 ДЕНЬ (обед/полдник):**`);
      const afternoon = ['magnesium', 'vitamin_c', 'b_complex', 'probiotics', 'ashwagandha', 'rhodiola', 'adaptogens'];
      const afternoonItems = stackIds.filter(id => afternoon.includes(id)).slice(0, 4);
      afternoonItems.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) lines.push(`- ${c.nameRu || c.name || id}`);
      });
      lines.push(`---`);
      lines.push(`**🌙 ВЕЧЕР (за 1-2ч до сна):**`);
      const evening = ['magnesium', 'theanine', 'gaba', 'glycine', 'melatonin', 'zinc', 'ashwagandha', '5htp', 'l_tryptophan', 'tudca', 'nac'];
      const eveningItems = stackIds.filter(id => evening.includes(id) || id.includes('sleep') || id.includes('relax') || id.includes('ashwa') || id.includes('gaba') || id.includes('glycine') || id.includes('melaton') || id.includes('5htp')).slice(0, 5);
      eveningItems.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) lines.push(`- ${c.nameRu || c.name || id}`);
      });
      lines.push(`---`);
      lines.push(`**💧 Режим воды:** 30 мл/кг веса (${(profile.weight * 0.03).toFixed(1)} л/сут)`);
      lines.push(`**⚠ Важно:** БАДы не заменяют полноценное питание и лекарства. Интервал между приёмом лекарств и БАДов — минимум 2 часа.`);
      return lines.join('\n');
    }
    return '';
  }, [profile, stackIds, mode]);

  return (
    <GlassCard title={`📄 Клиническая справка`} icon="📄" color="#60a5fa">
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['summary', 'doctor', 'schedule'] as const).map(m => (
          <PillBtn key={m} active={mode === m} onClick={() => setMode(m)} color="#60a5fa">
            {m === 'summary' ? '📋 Сводка' : m === 'doctor' ? '👨‍⚕️ Врачу' : '📅 Расписание'}
          </PillBtn>
        ))}
      </div>
      <div style={{
        padding: '10px 12px', borderRadius: 10,
        background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)',
        fontSize: 9, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, whiteSpace: 'pre-wrap',
        fontFamily: 'monospace', maxHeight: 300, overflowY: 'auto',
      }}>
        {note}
      </div>
      <button onClick={() => { navigator.clipboard.writeText(note); showToast('Скопировано', 'success'); }} style={{
        width: '100%', padding: '8px 0', borderRadius: 8, marginTop: 6, cursor: 'pointer', fontSize: 9, fontWeight: 700,
        background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa',
      }}>📋 Копировать текст</button>
    </GlassCard>
  );
}

/* ─── Main ClinicalTab (объединяет DrugCheck + LabShortcut + ClinicalNote) ─── */
export function ClinicalTab({ profile, setProfile, stackIds, linked, onNavigateLab }: {
  profile: BioStackProfile; setProfile: (p: BioStackProfile) => void; stackIds: string[]; linked?: LinkedData; onNavigateLab?: () => void;
}) {
  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginBottom: 8, lineHeight: 1.3, textAlign: 'center' }}>
        🏥 Клинический блок — лекарственные взаимодействия, анализы → БАДы, заключение врача
      </div>
      <DrugCheckCard profile={profile} stackIds={stackIds} />
      <LabShortcutCard linked={linked} onNavigate={onNavigateLab} />
      <ClinicalNoteCard profile={profile} stackIds={stackIds} />
    </div>
  );
}
